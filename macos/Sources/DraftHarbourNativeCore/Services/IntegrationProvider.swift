import Foundation

public struct IntegrationPayload: Sendable {
  public var envelope: DhprojEnvelope

  public init(envelope: DhprojEnvelope) {
    self.envelope = envelope
  }
}

public struct IntegrationResult: Equatable, Sendable {
  public var provider: IntegrationType
  public var message: String
  public var conflicts: [ConflictInfo]

  public init(provider: IntegrationType, message: String, conflicts: [ConflictInfo] = []) {
    self.provider = provider
    self.message = message
    self.conflicts = conflicts
  }
}

public protocol IntegrationProvider: Sendable {
  var type: IntegrationType { get }
  func connect(config: IntegrationConfig) async throws -> IntegrationResult
  func push(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult
  func pull(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult
  func listRevisions(config: IntegrationConfig) async throws -> [RemoteRevision]
}

public struct PlannedIntegrationProvider: IntegrationProvider {
  public var type: IntegrationType

  public init(type: IntegrationType) {
    self.type = type
  }

  public func connect(config: IntegrationConfig) async throws -> IntegrationResult {
    guard config.enabled else { throw DraftHarbourError.providerNotConfigured(type.rawValue) }
    return IntegrationResult(provider: type, message: "\(type.rawValue) native integration is configured but network sync is still being completed.")
  }

  public func push(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    throw DraftHarbourError.featurePlanned("\(type.rawValue) push")
  }

  public func pull(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    throw DraftHarbourError.featurePlanned("\(type.rawValue) pull")
  }

  public func listRevisions(config: IntegrationConfig) async throws -> [RemoteRevision] {
    throw DraftHarbourError.featurePlanned("\(type.rawValue) revisions")
  }
}

public struct ScrivenerPackageImporter {
  public init() {}

  public func importPlainTextFiles(from packageURL: URL, projectId: String) throws -> [Section] {
    let fileManager = FileManager.default
    let enumerator = fileManager.enumerator(at: packageURL, includingPropertiesForKeys: [.isRegularFileKey])
    var sections: [Section] = []

    while let url = enumerator?.nextObject() as? URL {
      guard url.pathExtension.lowercased() == "txt" else { continue }
      let text = try String(contentsOf: url, encoding: .utf8)
      sections.append(
        Section(
          novelId: projectId,
          order: sections.count,
          title: url.deletingPathExtension().lastPathComponent,
          content: text
        )
      )
    }

    return sections
  }
}
