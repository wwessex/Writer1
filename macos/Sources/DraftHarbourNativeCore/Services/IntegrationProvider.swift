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
  public var pulledEnvelope: DhprojEnvelope?
  public var updatedConfig: IntegrationConfig?

  public init(
    provider: IntegrationType,
    message: String,
    conflicts: [ConflictInfo] = [],
    pulledEnvelope: DhprojEnvelope? = nil,
    updatedConfig: IntegrationConfig? = nil
  ) {
    self.provider = provider
    self.message = message
    self.conflicts = conflicts
    self.pulledEnvelope = pulledEnvelope
    self.updatedConfig = updatedConfig
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

public enum NativeIntegrationProviderRegistry {
  public static func provider(for type: IntegrationType, config: IntegrationConfig? = nil) -> IntegrationProvider {
    if NativeOperationalGuardrails.shared.currentPolicy().forceLocalOnly == true, type != .scrivener {
      return PolicyDisabledIntegrationProvider(type: type)
    }
    if config?.baseUrl != nil {
      return GenericRESTSyncProvider(type: type)
    }

    switch type {
    case .genericREST:
      return GenericRESTSyncProvider(type: type)
    case .scrivener:
      return ScrivenerIntegrationProvider()
    case .dropbox:
      return DropboxSyncProvider()
    case .googleDrive:
      return GoogleDriveSyncProvider()
    }
  }
}

public struct PolicyDisabledIntegrationProvider: IntegrationProvider {
  public var type: IntegrationType

  public init(type: IntegrationType) {
    self.type = type
  }

  public func connect(config: IntegrationConfig) async throws -> IntegrationResult {
    throw DraftHarbourError.providerNotConfigured("\(type.rawValue) disabled by managed local-only policy")
  }

  public func push(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    throw DraftHarbourError.providerNotConfigured("\(type.rawValue) disabled by managed local-only policy")
  }

  public func pull(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    throw DraftHarbourError.providerNotConfigured("\(type.rawValue) disabled by managed local-only policy")
  }

  public func listRevisions(config: IntegrationConfig) async throws -> [RemoteRevision] {
    throw DraftHarbourError.providerNotConfigured("\(type.rawValue) disabled by managed local-only policy")
  }
}

public struct ScrivenerIntegrationProvider: IntegrationProvider {
  public let type: IntegrationType = .scrivener

  public init() {}

  public func connect(config: IntegrationConfig) async throws -> IntegrationResult {
    IntegrationResult(provider: type, message: "Scrivener package bridge is available for local import/export.")
  }

  public func push(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    guard let path = config.syncFolderPath ?? config.folderId else {
      throw DraftHarbourError.providerNotConfigured("Scrivener package path")
    }
    try ScrivenerPackageExporter().exportPlainTextFiles(payload.envelope, to: URL(fileURLWithPath: path))
    return IntegrationResult(provider: type, message: "Exported \(payload.envelope.sections.count) sections to Scrivener-compatible text files.")
  }

  public func pull(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    guard let path = config.syncFolderPath ?? config.folderId else {
      throw DraftHarbourError.providerNotConfigured("Scrivener package path")
    }
    let imported = try ScrivenerPackageImporter().importPlainTextFiles(from: URL(fileURLWithPath: path), projectId: payload.envelope.project.id)
    var envelope = payload.envelope
    let startIndex = envelope.sections.count
    envelope.sections.append(contentsOf: imported.enumerated().map { offset, section in
      var copy = section
      copy.novelId = envelope.project.id
      copy.order = startIndex + offset
      return copy
    })
    return IntegrationResult(
      provider: type,
      message: "Imported \(imported.count) Scrivener text files.",
      pulledEnvelope: DhprojCodec.normalize(envelope)
    )
  }

  public func listRevisions(config: IntegrationConfig) async throws -> [RemoteRevision] {
    []
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
