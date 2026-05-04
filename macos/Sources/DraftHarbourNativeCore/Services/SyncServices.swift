import Foundation

public enum ConflictResolutionOption: String, Codable, Sendable {
  case keepLocal
  case useRemote
  case keepBoth
}

public struct ProviderDocument: Codable, Equatable, Sendable {
  public var id: String
  public var title: String
  public var content: String
  public var updatedAt: Int64
  public var hash: String?

  public init(id: String, title: String, content: String, updatedAt: Int64, hash: String? = nil) {
    self.id = id
    self.title = title
    self.content = content
    self.updatedAt = updatedAt
    self.hash = hash
  }
}

public struct ProviderPayload: Codable, Equatable, Sendable {
  public var project: Project
  public var projectType: ProjectType
  public var documents: [ProviderDocument]

  public init(envelope: DhprojEnvelope) {
    self.project = envelope.project
    self.projectType = envelope.projectType
    self.documents = envelope.sections.map {
      ProviderDocument(id: $0.id, title: $0.title, content: $0.content ?? "", updatedAt: $0.updatedAt, hash: SyncMergeEngine.contentHash($0.content ?? ""))
    }
  }
}

public struct PullResult: Codable, Equatable, Sendable {
  public var envelope: DhprojEnvelope
  public var conflicts: [ConflictInfo]
}

public enum SectionMergeResult: Sendable {
  case merged(Section)
  case conflict(ConflictInfo)
}

public enum SyncMergeEngine {
  public static func contentHash(_ text: String) -> String {
    String(text.utf8.reduce(UInt64(14_695_981_039_346_656_037)) { hash, byte in
      (hash ^ UInt64(byte)).multipliedReportingOverflow(by: 1_099_511_628_211).partialValue
    }, radix: 16)
  }

  public static func merge(local: Section, remote: ProviderDocument, baseContent: String?) -> SectionMergeResult {
    let localContent = local.content ?? ""
    if localContent == remote.content {
      return .merged(local)
    }
    if let baseContent, localContent == baseContent {
      var copy = local
      copy.title = remote.title
      copy.content = remote.content
      copy.updatedAt = remote.updatedAt
      return .merged(copy)
    }
    if let baseContent, remote.content == baseContent {
      return .merged(local)
    }
    if remote.updatedAt > local.updatedAt && localContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      var copy = local
      copy.title = remote.title
      copy.content = remote.content
      copy.updatedAt = remote.updatedAt
      return .merged(copy)
    }
    return .conflict(
      ConflictInfo(
        chapterId: local.id,
        localContent: localContent,
        remoteContent: remote.content,
        baseContent: baseContent,
        localUpdatedAt: local.updatedAt,
        remoteUpdatedAt: remote.updatedAt
      )
    )
  }

  public static func resolve(_ conflict: ConflictInfo, option: ConflictResolutionOption, localSection: Section) -> [Section] {
    switch option {
    case .keepLocal:
      return [localSection]
    case .useRemote:
      var copy = localSection
      copy.content = conflict.remoteContent
      copy.updatedAt = conflict.remoteUpdatedAt
      return [copy]
    case .keepBoth:
      var localCopy = localSection
      var remoteCopy = localSection
      remoteCopy.id = makeIdentifier()
      remoteCopy.title = "\(localSection.title) (Remote)"
      remoteCopy.content = conflict.remoteContent
      remoteCopy.updatedAt = conflict.remoteUpdatedAt
      localCopy.updatedAt = currentTimeMilliseconds()
      return [localCopy, remoteCopy]
    }
  }
}

public struct GenericRESTSyncProvider: IntegrationProvider {
  public var type: IntegrationType
  public var session: URLSession

  public init(type: IntegrationType = .genericREST, session: URLSession = .shared) {
    self.type = type
    self.session = session
  }

  public func connect(config: IntegrationConfig) async throws -> IntegrationResult {
    guard config.enabled, config.baseUrl != nil else {
      throw DraftHarbourError.providerNotConfigured(type.rawValue)
    }
    return IntegrationResult(provider: type, message: "\(type.rawValue) sync endpoint configured.")
  }

  public func push(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    let base = try baseURL(config)
    var request = URLRequest(url: base.appending(path: "projects/\(payload.envelope.project.id)"))
    request.httpMethod = "PUT"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let token = config.accessToken {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    request.httpBody = try JSONEncoder().encode(ProviderPayload(envelope: payload.envelope))
    let (_, response) = try await session.data(for: request)
    try validate(response)
    return IntegrationResult(provider: type, message: "Pushed \(payload.envelope.sections.count) sections.")
  }

  public func pull(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    let base = try baseURL(config)
    var request = URLRequest(url: base.appending(path: "projects/\(payload.envelope.project.id)"))
    if let token = config.accessToken {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    let (data, response) = try await session.data(for: request)
    try validate(response)
    let remote = try JSONDecoder().decode(ProviderPayload.self, from: data)
    let pullResult = merge(remote: remote, into: payload.envelope)
    return IntegrationResult(
      provider: type,
      message: "Pulled \(remote.documents.count) remote sections.",
      conflicts: pullResult.conflicts,
      pulledEnvelope: pullResult.envelope
    )
  }

  public func listRevisions(config: IntegrationConfig) async throws -> [RemoteRevision] {
    let base = try baseURL(config)
    var request = URLRequest(url: base.appending(path: "revisions"))
    if let token = config.accessToken {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }
    let (data, response) = try await session.data(for: request)
    try validate(response)
    return try JSONDecoder().decode([RemoteRevision].self, from: data)
  }

  public func merge(remote: ProviderPayload, into envelope: DhprojEnvelope) -> PullResult {
    var merged = envelope
    var conflicts: [ConflictInfo] = []
    let localById = Dictionary(uniqueKeysWithValues: envelope.sections.map { ($0.id, $0) })

    for document in remote.documents {
      if let local = localById[document.id] {
        let base = local.sync?.lastSyncedContent
        switch SyncMergeEngine.merge(local: local, remote: document, baseContent: base) {
        case .merged(let section):
          if let index = merged.sections.firstIndex(where: { $0.id == section.id }) {
            merged.sections[index] = section
          }
        case .conflict(var conflict):
          conflict.provider = type
          conflicts.append(conflict)
        }
      } else {
        merged.sections.append(
          Section(
            id: document.id,
            novelId: envelope.project.id,
            order: merged.sections.count,
            title: document.title,
            updatedAt: document.updatedAt,
            content: document.content
          )
        )
      }
    }

    return PullResult(envelope: DhprojCodec.normalize(merged), conflicts: conflicts)
  }

  private func baseURL(_ config: IntegrationConfig) throws -> URL {
    guard let baseUrl = config.baseUrl, let url = URL(string: baseUrl) else {
      throw DraftHarbourError.providerNotConfigured("\(type.rawValue) base URL")
    }
    return url
  }

  private func validate(_ response: URLResponse) throws {
    if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
      throw DraftHarbourError.providerNotConfigured("\(type.rawValue) HTTP \(http.statusCode)")
    }
  }
}

public struct ScrivenerPackageExporter {
  public init() {}

  public func exportPlainTextFiles(_ envelope: DhprojEnvelope, to packageURL: URL) throws {
    try FileManager.default.createDirectory(at: packageURL, withIntermediateDirectories: true)
    for section in envelope.sections {
      let filename = section.title.replacingOccurrences(of: #"[/\\?%*|"<>:]"#, with: "-", options: .regularExpression)
      let url = packageURL.appendingPathComponent(filename.isEmpty ? section.id : filename).appendingPathExtension("txt")
      try (section.content ?? "").write(to: url, atomically: true, encoding: .utf8)
    }
  }
}
