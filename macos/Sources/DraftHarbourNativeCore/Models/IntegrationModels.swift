import Foundation

public enum IntegrationType: String, Codable, CaseIterable, Sendable {
  case genericREST = "generic-rest"
  case dropbox
  case googleDrive = "google-drive"
  case scrivener

  public var displayName: String {
    switch self {
    case .genericREST:
      return "Generic REST"
    case .dropbox:
      return "Dropbox"
    case .googleDrive:
      return "Google Drive"
    case .scrivener:
      return "Scrivener"
    }
  }
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
  public var accessTokenKeychainAccount: String?
  public var refreshTokenKeychainAccount: String?
  public var clientId: String?
  public var baseUrl: String?
  public var syncFolderPath: String?
  public var version: Int?

  enum CodingKeys: String, CodingKey {
    case type
    case enabled
    case connectionId
    case providerUserId
    case scopes
    case expiresAt
    case status
    case folderId
    case lastSyncAt
    case accessToken
    case refreshToken
    case accessTokenKeychainAccount
    case refreshTokenKeychainAccount
    case clientId
    case baseUrl
    case syncFolderPath
    case version
  }

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
    accessTokenKeychainAccount: String? = nil,
    refreshTokenKeychainAccount: String? = nil,
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
    self.accessTokenKeychainAccount = accessTokenKeychainAccount
    self.refreshTokenKeychainAccount = refreshTokenKeychainAccount
    self.clientId = clientId
    self.baseUrl = baseUrl
    self.syncFolderPath = syncFolderPath
    self.version = version
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    type = try container.decode(IntegrationType.self, forKey: .type)
    enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? false
    connectionId = try container.decodeIfPresent(String.self, forKey: .connectionId)
    providerUserId = try container.decodeIfPresent(String.self, forKey: .providerUserId)
    scopes = try container.decodeIfPresent([String].self, forKey: .scopes)
    expiresAt = try container.decodeIfPresent(Int64.self, forKey: .expiresAt)
    status = try container.decodeIfPresent(String.self, forKey: .status)
    folderId = try container.decodeIfPresent(String.self, forKey: .folderId)
    lastSyncAt = try container.decodeIfPresent(Int64.self, forKey: .lastSyncAt)
    // Decode legacy project files, but do not re-encode raw OAuth tokens.
    accessToken = try container.decodeIfPresent(String.self, forKey: .accessToken)
    refreshToken = try container.decodeIfPresent(String.self, forKey: .refreshToken)
    accessTokenKeychainAccount = try container.decodeIfPresent(String.self, forKey: .accessTokenKeychainAccount)
    refreshTokenKeychainAccount = try container.decodeIfPresent(String.self, forKey: .refreshTokenKeychainAccount)
    clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
    baseUrl = try container.decodeIfPresent(String.self, forKey: .baseUrl)
    syncFolderPath = try container.decodeIfPresent(String.self, forKey: .syncFolderPath)
    version = try container.decodeIfPresent(Int.self, forKey: .version)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(type, forKey: .type)
    try container.encode(enabled, forKey: .enabled)
    try container.encodeIfPresent(connectionId, forKey: .connectionId)
    try container.encodeIfPresent(providerUserId, forKey: .providerUserId)
    try container.encodeIfPresent(scopes, forKey: .scopes)
    try container.encodeIfPresent(expiresAt, forKey: .expiresAt)
    try container.encodeIfPresent(status, forKey: .status)
    try container.encodeIfPresent(folderId, forKey: .folderId)
    try container.encodeIfPresent(lastSyncAt, forKey: .lastSyncAt)
    try container.encodeIfPresent(accessTokenKeychainAccount, forKey: .accessTokenKeychainAccount)
    try container.encodeIfPresent(refreshTokenKeychainAccount, forKey: .refreshTokenKeychainAccount)
    try container.encodeIfPresent(clientId, forKey: .clientId)
    try container.encodeIfPresent(baseUrl, forKey: .baseUrl)
    try container.encodeIfPresent(syncFolderPath, forKey: .syncFolderPath)
    try container.encodeIfPresent(version, forKey: .version)
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
