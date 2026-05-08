import DraftHarbourNativeCore
import Foundation
import XCTest

final class CollaborationAndGuardrailsTests: XCTestCase {
  override func tearDown() {
    NativePluginRuntime.shared.resetForTesting()
    NativeCrashReporter.shared.clear()
    super.tearDown()
  }

  func testCollaborationInvitesMembersPresenceAndCodecRoundTrip() throws {
    var envelope = DhprojCodec.newProject(title: "Collaboration")
    envelope.sections[0].id = "section-1"
    let store = ProjectStore(envelope: envelope)

    let invite = try store.inviteCollaborator(email: " Editor@Example.COM ", permission: .comment, expiresAt: 3_000)
    XCTAssertEqual(invite.email, "editor@example.com")
    XCTAssertEqual(store.envelope.collaboration.invites.first?.status, .pending)
    XCTAssertEqual(store.envelope.collaboration.members.first?.permission, .comment)

    try store.acceptCollaborationInvite(token: invite.token, displayName: "Editor", now: 1_500)
    var member = try XCTUnwrap(store.envelope.collaboration.members.first)
    XCTAssertEqual(member.displayName, "Editor")
    XCTAssertEqual(member.acceptedAt, 1_500)
    XCTAssertEqual(store.envelope.collaboration.invites.first?.status, .accepted)

    store.updateCollaboratorPermission(memberID: member.id, permission: .edit)
    member = try XCTUnwrap(store.envelope.collaboration.members.first)
    XCTAssertEqual(member.permission, .edit)

    let presence = store.updatePresence(email: "editor@example.com", displayName: "Editor", sectionId: "section-1", now: 1_800)
    XCTAssertEqual(presence.sectionId, "section-1")
    XCTAssertEqual(store.activeCollaborators(now: 1_900, windowMs: 200).count, 1)
    XCTAssertEqual(store.activeCollaborators(now: 2_500, windowMs: 200).count, 0)

    let encoded = try DhprojCodec.encode(store.envelope)
    let decoded = try DhprojCodec.decode(encoded)
    XCTAssertEqual(decoded.collaboration.invites.first?.email, "editor@example.com")
    XCTAssertEqual(decoded.collaboration.members.first?.permission, .edit)
    XCTAssertEqual(decoded.collaboration.presence.first?.sectionId, "section-1")
  }

  func testPluginRuntimeEventsFiltersStorageAndSafeMode() throws {
    try withIsolatedGuardrailsDefaults { guardrails in
      NativePluginRuntime.shared.resetForTesting()
      guardrails.setSafeModeForCurrentSession(false)

      let recorder = EventRecorder()
      let plugin = NativePluginManifest(id: "sample-plugin", name: "Sample Plugin", version: "1.0.0")
      NativePluginRuntime.shared.register(plugin)
      NativePluginRuntime.shared.on("collab:inviteCreated", pluginID: plugin.id) { event in
        recorder.append(event)
      }
      NativePluginRuntime.shared.registerStringFilter("markdown:beforeExport", pluginID: plugin.id) { value in
        value.replacingOccurrences(of: "draft", with: "polished")
      }
      NativePluginRuntime.shared.setStorageValue(.string("enabled"), key: "mode", pluginID: plugin.id)

      let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Plugins"))
      _ = try store.inviteCollaborator(email: "editor@example.com", permission: .comment)

      XCTAssertEqual(recorder.events.count, 1)
      XCTAssertEqual(recorder.events.first?.payload["email"], .string("editor@example.com"))
      XCTAssertEqual(NativePluginRuntime.shared.applyStringFilters("markdown:beforeExport", to: "draft"), "polished")
      XCTAssertEqual(NativePluginRuntime.shared.storageValue(key: "mode", pluginID: plugin.id), .string("enabled"))

      NativePluginRuntime.shared.setEnabled(false, pluginID: plugin.id)
      XCTAssertEqual(NativePluginRuntime.shared.applyStringFilters("markdown:beforeExport", to: "draft"), "draft")

      NativePluginRuntime.shared.setEnabled(true, pluginID: plugin.id)
      guardrails.setSafeModeForCurrentSession(true)
      XCTAssertEqual(NativePluginRuntime.shared.emit("collab:inviteCreated"), 0)
      XCTAssertEqual(NativePluginRuntime.shared.applyStringFilters("markdown:beforeExport", to: "draft"), "draft")
    }
  }

  func testManagedPolicyDisablesNetworkProvidersAndAppliesSettingsOverrides() throws {
    try withIsolatedGuardrailsDefaults { guardrails in
      let policy = NativeManagedPolicy(
        forceLocalOnly: true,
        disableAIProviders: false,
        disabledAIProviderTypes: [.openAICompatible],
        settingsOverrides: AppSettings(dailyWordGoal: 2_000, releaseChannel: "stable"),
        requireSignedUpdates: true
      )
      try guardrails.persistPolicy(policy)

      let settings = AppSettings(dailyWordGoal: 500, sync: SyncConfig(url: "https://sync.example", auth: "secret"), releaseChannel: "nightly")
      let applied = guardrails.applyPolicy(to: settings)
      XCTAssertEqual(applied.dailyWordGoal, 2_000)
      XCTAssertEqual(applied.releaseChannel, "stable")
      XCTAssertEqual(applied.sync?.url, "")
      XCTAssertEqual(applied.sync?.auth, "")

      let factory = NativeAIProviderFactory(secretStore: EmptySecretStore())
      XCTAssertThrowsError(
        try factory.provider(from: AIProviderConfig(provider: .openAICompatible, label: "Cloud", endpoint: "https://ai.example/v1/chat/completions", model: "writer"))
      ) { error in
        XCTAssertEqual(error as? DraftHarbourError, .providerNotConfigured("Cloud disabled by local-only policy"))
      }

      XCTAssertTrue(NativeIntegrationProviderRegistry.provider(for: .dropbox) is PolicyDisabledIntegrationProvider)
      XCTAssertFalse(NativeIntegrationProviderRegistry.provider(for: .scrivener) is PolicyDisabledIntegrationProvider)
    }
  }

  func testCrashReporterRedactsSecretsFromDiagnosticsAndSubmitsRemotePayload() async throws {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [CrashReportURLProtocol.self]
    let session = URLSession(configuration: configuration)
    let reporter = NativeCrashReporter(remoteEndpoint: try XCTUnwrap(URL(string: "https://reports.example/crash")))
    let entry = reporter.report(
      category: "sync",
      message: "Authorization: Bearer abc123 api_key=secret",
      context: "token: hidden-value"
    )

    XCTAssertFalse(entry.message.contains("abc123"))
    XCTAssertFalse(entry.message.contains("secret"))
    XCTAssertFalse(entry.context?.contains("hidden-value") == true)

    let diagnostics = try reporter.diagnosticsJSON(projectSummary: ["projectId": .string("project-1")])
    XCTAssertTrue(diagnostics.contains("project-1"))
    XCTAssertFalse(diagnostics.contains("abc123"))
    XCTAssertFalse(diagnostics.contains("hidden-value"))

    let submitted = try await reporter.submitPendingReports(projectSummary: ["projectId": .string("project-1")], session: session)
    XCTAssertEqual(submitted, 1)
    let submittedRequest = CrashReportURLProtocol.recorder.snapshot()
    XCTAssertEqual(submittedRequest.request?.httpMethod, "POST")
    XCTAssertEqual(submittedRequest.request?.value(forHTTPHeaderField: "Content-Type"), "application/json")
    let submittedBody = String(decoding: submittedRequest.body, as: UTF8.self)
    XCTAssertTrue(submittedBody.contains("project-1"))
    XCTAssertFalse(submittedBody.contains("abc123"))
    XCTAssertFalse(submittedBody.contains("hidden-value"))
    XCTAssertTrue(reporter.localEntries().isEmpty)
  }

  func testSafeModeAndUpdaterFallbackState() throws {
    try withIsolatedGuardrailsDefaults { guardrails in
      guardrails.enableSafeModeForNextLaunch()
      XCTAssertTrue(guardrails.initializeSafeModeSession())
      XCTAssertTrue(guardrails.isSafeModeEnabledForSession)
      XCTAssertFalse(guardrails.initializeSafeModeSession())
      XCTAssertFalse(guardrails.isSafeModeEnabledForSession)

      let firstFailure = guardrails.markUpdateFailure(threshold: 2)
      XCTAssertEqual(firstFailure.attempts, 1)
      XCTAssertFalse(firstFailure.fallbackMode)
      let secondFailure = guardrails.markUpdateFailure(threshold: 2)
      XCTAssertEqual(secondFailure.attempts, 2)
      XCTAssertTrue(secondFailure.fallbackMode)

      guardrails.pinUpdateVersion("2.0.1")
      XCTAssertEqual(guardrails.pinnedUpdateVersion, "2.0.1")
      guardrails.markLastGoodVersion("2.0.0")
      XCTAssertEqual(guardrails.lastGoodVersion, "2.0.0")
      XCTAssertEqual(guardrails.updateFailureCount, 0)
    }
  }

  func testCollaborationSyncClientPushPullPresenceAndInviteContracts() async throws {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [CollaborationSyncURLProtocol.self]
    let session = URLSession(configuration: configuration)
    let endpoint = try XCTUnwrap(URL(string: "https://collab.example/api"))
    let config = CollaborationSyncConfig(endpoint: endpoint, bearerToken: "sync-token")

    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Remote Collab"))
    let invite = try store.inviteCollaborator(email: "editor@example.com", permission: .edit)
    let thread = try store.addComment(text: "Check", from: 0, to: 4, selectedText: "Text")
    var remoteState = store.envelope.collaboration
    remoteState.lastSyncRevision = "rev-2"
    let response = CollaborationSyncResponse(
      projectId: store.envelope.project.id,
      revision: "rev-2",
      collaboration: remoteState,
      commentThreads: [thread],
      serverTime: 2_000
    )

    CollaborationSyncURLProtocol.responder.setHandler { request, body in
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer sync-token")
      XCTAssertEqual(request.value(forHTTPHeaderField: "Accept"), "application/json")
      switch (request.httpMethod, request.url?.path ?? "") {
      case ("PUT", "/api/projects/\(store.envelope.project.id)/collaboration"):
        let decoded = try JSONDecoder().decode(CollaborationSyncRequest.self, from: body)
        XCTAssertEqual(decoded.projectId, store.envelope.project.id)
        XCTAssertEqual(decoded.baseRevision, nil)
        XCTAssertEqual(decoded.collaboration.invites.first?.id, invite.id)
        return (200, try JSONEncoder().encode(response))
      case ("GET", "/api/projects/\(store.envelope.project.id)/collaboration"):
        XCTAssertEqual(URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.first?.value, "rev-2")
        return (200, try JSONEncoder().encode(response))
      case ("POST", "/api/projects/\(store.envelope.project.id)/presence"):
        let decoded = try JSONDecoder().decode(CollaborationPresence.self, from: body)
        XCTAssertEqual(decoded.email, "editor@example.com")
        return (200, body)
      case ("POST", "/api/invites/\(invite.token)/accept"):
        let decoded = try JSONDecoder().decode([String: String].self, from: body)
        XCTAssertEqual(decoded["displayName"], "Editor")
        return (200, try JSONEncoder().encode(response))
      default:
        return (404, Data())
      }
    }

    let client = CollaborationSyncClient(session: session)
    let pushed = try await client.push(store.collaborationSyncRequest(deviceId: "test-device"), config: config)
    store.applyCollaborationSyncResponse(pushed)
    XCTAssertEqual(store.envelope.collaboration.lastSyncRevision, "rev-2")
    XCTAssertEqual(store.envelope.commentThreads.first?.id, thread.id)

    let pulled = try await client.pull(projectId: store.envelope.project.id, since: "rev-2", config: config)
    XCTAssertEqual(pulled.revision, "rev-2")

    let presence = try await client.sendPresence(
      projectId: store.envelope.project.id,
      presence: CollaborationPresence(email: "editor@example.com", displayName: "Editor", sectionId: store.activeSectionID),
      config: config
    )
    XCTAssertEqual(presence.email, "editor@example.com")

    let accepted = try await client.acceptInvite(token: invite.token, displayName: "Editor", config: config)
    XCTAssertEqual(accepted.projectId, store.envelope.project.id)
  }

  private func withIsolatedGuardrailsDefaults(_ body: (NativeOperationalGuardrails) throws -> Void) throws {
    let previousDefaults = NativeOperationalGuardrails.shared.defaults
    let suiteName = "DraftHarbourGuardrailsTests.\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
    NativeOperationalGuardrails.shared.defaults = defaults
    defer {
      defaults.removePersistentDomain(forName: suiteName)
      NativeOperationalGuardrails.shared.defaults = previousDefaults
    }
    try body(NativeOperationalGuardrails.shared)
  }
}

private final class EventRecorder: @unchecked Sendable {
  private let lock = NSLock()
  private var recordedEvents: [NativePluginEvent] = []

  var events: [NativePluginEvent] {
    lock.lock()
    defer { lock.unlock() }
    return recordedEvents
  }

  func append(_ event: NativePluginEvent) {
    lock.lock()
    recordedEvents.append(event)
    lock.unlock()
  }
}

private struct EmptySecretStore: SecretStore {
  func secret(account: String) throws -> String? {
    nil
  }
}

private final class CrashReportURLProtocol: URLProtocol {
  static let recorder = CrashReportRecorder()

  override class func canInit(with request: URLRequest) -> Bool {
    true
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest {
    request
  }

  override func startLoading() {
    Self.recorder.record(request: request, body: requestBodyData(request))
    let response = HTTPURLResponse(url: request.url!, statusCode: 202, httpVersion: nil, headerFields: nil)!
    client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
    client?.urlProtocol(self, didLoad: Data())
    client?.urlProtocolDidFinishLoading(self)
  }

  override func stopLoading() {}
}

private final class CollaborationSyncURLProtocol: URLProtocol {
  static let responder = CollaborationSyncResponder()

  override class func canInit(with request: URLRequest) -> Bool {
    true
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest {
    request
  }

  override func startLoading() {
    do {
      let result = try Self.responder.response(for: request, body: requestBodyData(request))
      let response = HTTPURLResponse(url: request.url!, statusCode: result.status, httpVersion: nil, headerFields: nil)!
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: result.body)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }

  override func stopLoading() {}
}

private final class CollaborationSyncResponder: @unchecked Sendable {
  typealias Handler = (URLRequest, Data) throws -> (status: Int, body: Data)

  private let lock = NSLock()
  private var handler: Handler?

  func setHandler(_ handler: @escaping Handler) {
    lock.lock()
    self.handler = handler
    lock.unlock()
  }

  func response(for request: URLRequest, body: Data) throws -> (status: Int, body: Data) {
    lock.lock()
    let current = handler
    lock.unlock()
    guard let current else { return (404, Data()) }
    return try current(request, body)
  }
}

private final class CrashReportRecorder: @unchecked Sendable {
  private let lock = NSLock()
  private var request: URLRequest?
  private var body = Data()

  func record(request: URLRequest, body: Data) {
    lock.lock()
    self.request = request
    self.body = body
    lock.unlock()
  }

  func snapshot() -> (request: URLRequest?, body: Data) {
    lock.lock()
    defer { lock.unlock() }
    return (request, body)
  }
}

private func requestBodyData(_ request: URLRequest) -> Data {
  if let body = request.httpBody {
    return body
  }
  guard let stream = request.httpBodyStream else { return Data() }
  stream.open()
  defer { stream.close() }

  var data = Data()
  var buffer = [UInt8](repeating: 0, count: 1_024)
  while stream.hasBytesAvailable {
    let count = stream.read(&buffer, maxLength: buffer.count)
    guard count > 0 else { break }
    data.append(buffer, count: count)
  }
  return data
}
