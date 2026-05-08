import Foundation

public enum CollaborationPermission: String, Codable, CaseIterable, Sendable {
  case view
  case comment
  case edit
  case owner
}

public enum CollaborationInviteStatus: String, Codable, CaseIterable, Sendable {
  case pending
  case accepted
  case revoked
  case expired
}

public struct CollaborationInvite: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var email: String
  public var permission: CollaborationPermission
  public var token: String
  public var status: CollaborationInviteStatus
  public var createdAt: Int64
  public var expiresAt: Int64?

  public init(
    id: String = makeIdentifier(),
    email: String,
    permission: CollaborationPermission,
    token: String = makeIdentifier(),
    status: CollaborationInviteStatus = .pending,
    createdAt: Int64 = currentTimeMilliseconds(),
    expiresAt: Int64? = nil
  ) {
    self.id = id
    self.email = email
    self.permission = permission
    self.token = token
    self.status = status
    self.createdAt = createdAt
    self.expiresAt = expiresAt
  }
}

public struct CollaborationMember: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var email: String
  public var displayName: String
  public var permission: CollaborationPermission
  public var invitedAt: Int64
  public var acceptedAt: Int64?
  public var lastSeenAt: Int64?

  public init(
    id: String = makeIdentifier(),
    email: String,
    displayName: String = "",
    permission: CollaborationPermission,
    invitedAt: Int64 = currentTimeMilliseconds(),
    acceptedAt: Int64? = nil,
    lastSeenAt: Int64? = nil
  ) {
    self.id = id
    self.email = email
    self.displayName = displayName
    self.permission = permission
    self.invitedAt = invitedAt
    self.acceptedAt = acceptedAt
    self.lastSeenAt = lastSeenAt
  }
}

public struct CollaborationPresence: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var email: String
  public var displayName: String
  public var sectionId: String?
  public var lastSeenAt: Int64

  public init(
    id: String = makeIdentifier(),
    email: String,
    displayName: String = "",
    sectionId: String? = nil,
    lastSeenAt: Int64 = currentTimeMilliseconds()
  ) {
    self.id = id
    self.email = email
    self.displayName = displayName
    self.sectionId = sectionId
    self.lastSeenAt = lastSeenAt
  }

  public func isActive(now: Int64 = currentTimeMilliseconds(), windowMs: Int64 = 120_000) -> Bool {
    now - lastSeenAt <= windowMs
  }
}

public struct CollaborationState: Codable, Equatable, Sendable {
  public var ownerEmail: String?
  public var members: [CollaborationMember]
  public var invites: [CollaborationInvite]
  public var presence: [CollaborationPresence]
  public var syncEndpoint: String?
  public var lastSyncRevision: String?

  public init(
    ownerEmail: String? = nil,
    members: [CollaborationMember] = [],
    invites: [CollaborationInvite] = [],
    presence: [CollaborationPresence] = [],
    syncEndpoint: String? = nil,
    lastSyncRevision: String? = nil
  ) {
    self.ownerEmail = ownerEmail
    self.members = members
    self.invites = invites
    self.presence = presence
    self.syncEndpoint = syncEndpoint
    self.lastSyncRevision = lastSyncRevision
  }
}

public struct CollaborationSyncRequest: Codable, Equatable, Sendable {
  public var projectId: String
  public var deviceId: String
  public var baseRevision: String?
  public var collaboration: CollaborationState
  public var commentThreads: [CommentThread]
  public var activeSectionId: String?

  public init(
    projectId: String,
    deviceId: String,
    baseRevision: String? = nil,
    collaboration: CollaborationState,
    commentThreads: [CommentThread],
    activeSectionId: String? = nil
  ) {
    self.projectId = projectId
    self.deviceId = deviceId
    self.baseRevision = baseRevision
    self.collaboration = collaboration
    self.commentThreads = commentThreads
    self.activeSectionId = activeSectionId
  }
}

public struct CollaborationSyncResponse: Codable, Equatable, Sendable {
  public var projectId: String
  public var revision: String
  public var collaboration: CollaborationState
  public var commentThreads: [CommentThread]
  public var serverTime: Int64

  public init(
    projectId: String,
    revision: String,
    collaboration: CollaborationState,
    commentThreads: [CommentThread] = [],
    serverTime: Int64 = currentTimeMilliseconds()
  ) {
    self.projectId = projectId
    self.revision = revision
    self.collaboration = collaboration
    self.commentThreads = commentThreads
    self.serverTime = serverTime
  }
}
