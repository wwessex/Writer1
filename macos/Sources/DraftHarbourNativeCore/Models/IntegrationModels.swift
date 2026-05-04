import Foundation

public enum IntegrationType: String, Codable, CaseIterable, Sendable {
  case dropbox
  case googleDrive = "google-drive"
  case scrivener
}

public struct IntegrationConfig: Codable, Equatable, Sendable {
  public var type: IntegrationType
  public var enabled: Bool
  public var connectionId: String?
  public var providerUserId: String?
  public var scopes: [String]?
  public var expiresAt: Int64?
  public var status: String?
  public var folderId: String?
  public var lastSyncAt: Int64?
  public var accessToken: String?
  public var refreshToken: String?
  public var clientId: String?
  public var baseUrl: String?
  public var syncFolderPath: String?
  public var version: Int?

  public init(
    type: IntegrationType,
    enabled: Bool = false,
    connectionId: String? = nil,
    providerUserId: String? = nil,
    scopes: [String]? = nil,
    expiresAt: Int64? = nil,
    status: String? = nil,
    folderId: String? = nil,
    lastSyncAt: Int64? = nil,
    accessToken: String? = nil,
    refreshToken: String? = nil,
    clientId: String? = nil,
    baseUrl: String? = nil,
    syncFolderPath: String? = nil,
    version: Int? = 1
  ) {
    self.type = type
    self.enabled = enabled
    self.connectionId = connectionId
    self.providerUserId = providerUserId
    self.scopes = scopes
    self.expiresAt = expiresAt
    self.status = status
    self.folderId = folderId
    self.lastSyncAt = lastSyncAt
    self.accessToken = accessToken
    self.refreshToken = refreshToken
    self.clientId = clientId
    self.baseUrl = baseUrl
    self.syncFolderPath = syncFolderPath
    self.version = version
  }
}

public struct RemoteRevision: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var provider: IntegrationType
  public var title: String
  public var updatedAt: Int64
  public var hash: String?

  public init(id: String, provider: IntegrationType, title: String, updatedAt: Int64, hash: String? = nil) {
    self.id = id
    self.provider = provider
    self.title = title
    self.updatedAt = updatedAt
    self.hash = hash
  }
}

public struct ConflictInfo: Codable, Equatable, Identifiable, Sendable {
  public var id: String { chapterId }
  public var chapterId: String
  public var provider: IntegrationType?
  public var localContent: String?
  public var remoteContent: String?
  public var baseContent: String?
  public var localUpdatedAt: Int64
  public var remoteUpdatedAt: Int64

  public init(
    chapterId: String,
    provider: IntegrationType? = nil,
    localContent: String?,
    remoteContent: String?,
    baseContent: String? = nil,
    localUpdatedAt: Int64,
    remoteUpdatedAt: Int64
  ) {
    self.chapterId = chapterId
    self.provider = provider
    self.localContent = localContent
    self.remoteContent = remoteContent
    self.baseContent = baseContent
    self.localUpdatedAt = localUpdatedAt
    self.remoteUpdatedAt = remoteUpdatedAt
  }
}
