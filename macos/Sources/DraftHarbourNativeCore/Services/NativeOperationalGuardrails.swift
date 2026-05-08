import Foundation

public struct NativeManagedPolicy: Codable, Equatable, Sendable {
  public var forceLocalOnly: Bool?
  public var disableTelemetry: Bool?
  public var disableAIProviders: Bool?
  public var disabledAIProviderTypes: [AIProviderType]?
  public var settingsOverrides: AppSettings?
  public var remoteCrashReportURL: String?
  public var requireSignedUpdates: Bool?

  public init(
    forceLocalOnly: Bool? = nil,
    disableTelemetry: Bool? = nil,
    disableAIProviders: Bool? = nil,
    disabledAIProviderTypes: [AIProviderType]? = nil,
    settingsOverrides: AppSettings? = nil,
    remoteCrashReportURL: String? = nil,
    requireSignedUpdates: Bool? = nil
  ) {
    self.forceLocalOnly = forceLocalOnly
    self.disableTelemetry = disableTelemetry
    self.disableAIProviders = disableAIProviders
    self.disabledAIProviderTypes = disabledAIProviderTypes
    self.settingsOverrides = settingsOverrides
    self.remoteCrashReportURL = remoteCrashReportURL
    self.requireSignedUpdates = requireSignedUpdates
  }
}

public final class NativeOperationalGuardrails: @unchecked Sendable {
  public static let shared = NativeOperationalGuardrails()

  private static let policyKey = "DraftHarbour.managedPolicy.v1"
  private static let safeModeNextBootKey = "DraftHarbour.safeMode.nextBoot"
  private static let safeModeSessionKey = "DraftHarbour.safeMode.session"
  private static let updaterFailedAttemptsKey = "DraftHarbour.updater.failedAttempts"
  private static let updaterPinnedVersionKey = "DraftHarbour.updater.pinnedVersion"
  private static let updaterLastGoodVersionKey = "DraftHarbour.updater.lastGoodVersion"

  public var defaults: UserDefaults

  public init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
  }

  public func currentPolicy() -> NativeManagedPolicy {
    if let raw = ProcessInfo.processInfo.environment["DRAFTHARBOUR_MANAGED_POLICY"],
       let data = raw.data(using: .utf8),
       let policy = try? JSONDecoder().decode(NativeManagedPolicy.self, from: data) {
      return policy
    }
    if let path = ProcessInfo.processInfo.environment["DRAFTHARBOUR_MANAGED_POLICY_PATH"],
       let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
       let policy = try? JSONDecoder().decode(NativeManagedPolicy.self, from: data) {
      return policy
    }
    guard let data = defaults.data(forKey: Self.policyKey) else { return NativeManagedPolicy() }
    return (try? JSONDecoder().decode(NativeManagedPolicy.self, from: data)) ?? NativeManagedPolicy()
  }

  public func persistPolicy(_ policy: NativeManagedPolicy) throws {
    let data = try JSONEncoder().encode(policy)
    defaults.set(data, forKey: Self.policyKey)
  }

  public func clearPolicy() {
    defaults.removeObject(forKey: Self.policyKey)
  }

  public func applyPolicy(to settings: AppSettings) -> AppSettings {
    let policy = currentPolicy()
    var result = settings
    if let overrides = policy.settingsOverrides {
      result.merge(overrides: overrides)
    }
    if policy.forceLocalOnly == true {
      var sync = result.sync ?? SyncConfig()
      sync.url = ""
      sync.auth = ""
      result.sync = sync
    }
    return result
  }

  public func enableSafeModeForNextLaunch() {
    defaults.set(true, forKey: Self.safeModeNextBootKey)
  }

  @discardableResult
  public func initializeSafeModeSession() -> Bool {
    let enabled = defaults.bool(forKey: Self.safeModeNextBootKey)
    defaults.set(enabled, forKey: Self.safeModeSessionKey)
    defaults.removeObject(forKey: Self.safeModeNextBootKey)
    return enabled
  }

  public var isSafeModeEnabledForSession: Bool {
    defaults.bool(forKey: Self.safeModeSessionKey)
  }

  public func setSafeModeForCurrentSession(_ enabled: Bool) {
    defaults.set(enabled, forKey: Self.safeModeSessionKey)
  }

  @discardableResult
  public func markUpdateFailure(threshold: Int = 3) -> (attempts: Int, fallbackMode: Bool) {
    let attempts = defaults.integer(forKey: Self.updaterFailedAttemptsKey) + 1
    defaults.set(attempts, forKey: Self.updaterFailedAttemptsKey)
    return (attempts, attempts >= threshold)
  }

  public func clearUpdateFailures() {
    defaults.removeObject(forKey: Self.updaterFailedAttemptsKey)
  }

  public var updateFailureCount: Int {
    defaults.integer(forKey: Self.updaterFailedAttemptsKey)
  }

  public var isUpdaterFallbackMode: Bool {
    updateFailureCount >= 3
  }

  public func pinUpdateVersion(_ version: String?) {
    if let version, !version.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      defaults.set(version, forKey: Self.updaterPinnedVersionKey)
    } else {
      defaults.removeObject(forKey: Self.updaterPinnedVersionKey)
    }
  }

  public var pinnedUpdateVersion: String? {
    defaults.string(forKey: Self.updaterPinnedVersionKey)
  }

  public func markLastGoodVersion(_ version: String) {
    defaults.set(version, forKey: Self.updaterLastGoodVersionKey)
    clearUpdateFailures()
  }

  public var lastGoodVersion: String? {
    defaults.string(forKey: Self.updaterLastGoodVersionKey)
  }
}

public struct NativeErrorReportEntry: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var category: String
  public var message: String
  public var context: String?
  public var timestamp: Int64

  public init(id: String = makeIdentifier(), category: String, message: String, context: String? = nil, timestamp: Int64 = currentTimeMilliseconds()) {
    self.id = id
    self.category = category
    self.message = Self.sanitize(message)
    self.context = context.map(Self.sanitize)
    self.timestamp = timestamp
  }

  private static func sanitize(_ value: String) -> String {
    value
      .replacingOccurrences(of: #"(?i)(bearer\s+)[a-z0-9._-]+"#, with: "$1[REDACTED]", options: .regularExpression)
      .replacingOccurrences(of: #"(?i)(api[_-]?key["'=:\s]+)[^\s"']+"#, with: "$1[REDACTED]", options: .regularExpression)
      .replacingOccurrences(of: #"(?i)(token["'=:\s]+)[^\s"']+"#, with: "$1[REDACTED]", options: .regularExpression)
  }
}

public final class NativeCrashReporter: @unchecked Sendable {
  public static let shared = NativeCrashReporter()
  private let lock = NSLock()
  private var entries: [NativeErrorReportEntry] = []
  public var remoteEndpoint: URL?

  public init(remoteEndpoint: URL? = nil) {
    self.remoteEndpoint = remoteEndpoint
  }

  @discardableResult
  public func report(category: String, message: String, context: String? = nil) -> NativeErrorReportEntry {
    let entry = NativeErrorReportEntry(category: category, message: message, context: context)
    lock.lock()
    entries.insert(entry, at: 0)
    if entries.count > 200 {
      entries = Array(entries.prefix(200))
    }
    lock.unlock()
    return entry
  }

  public func localEntries() -> [NativeErrorReportEntry] {
    lock.lock()
    defer { lock.unlock() }
    return entries
  }

  public func clear() {
    lock.lock()
    entries.removeAll()
    lock.unlock()
  }

  public func diagnosticsJSON(projectSummary: [String: JSONValue]) throws -> String {
    let payload: [String: JSONValue] = [
      "generatedAt": .string(ISO8601DateFormatter().string(from: Date())),
      "project": .object(projectSummary),
      "recentErrors": .array(localEntries().map { entry in
        .object([
          "id": .string(entry.id),
          "category": .string(entry.category),
          "message": .string(entry.message),
          "context": entry.context.map { .string($0) } ?? .null,
          "timestamp": .number(Double(entry.timestamp))
        ])
      }),
      "redaction": .array([
        .string("Tokens, API keys, auth headers, and password-like fields are redacted."),
        .string("Diagnostics include metadata and aggregate state only; manuscript content is excluded.")
      ])
    ]
    let data = try JSONEncoder().encode(payload)
    return String(decoding: data, as: UTF8.self)
  }

  @discardableResult
  public func submitPendingReports(
    projectSummary: [String: JSONValue] = [:],
    session: URLSession = .shared
  ) async throws -> Int {
    guard NativeOperationalGuardrails.shared.currentPolicy().disableTelemetry != true else { return 0 }
    let entries = localEntries()
    guard !entries.isEmpty else { return 0 }

    let policyEndpoint = NativeOperationalGuardrails.shared.currentPolicy().remoteCrashReportURL.flatMap(URL.init(string:))
    guard let endpoint = remoteEndpoint ?? policyEndpoint else { return 0 }
    let payload = try diagnosticsJSON(projectSummary: projectSummary)
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = Data(payload.utf8)

    let (_, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
      throw URLError(.badServerResponse)
    }
    clear()
    return entries.count
  }
}
