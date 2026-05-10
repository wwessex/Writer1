import Foundation

public enum AIChatRole: String, Codable, CaseIterable, Sendable {
  case user
  case assistant
  case system
}

public enum AIEditProposalStatus: String, Codable, CaseIterable, Sendable {
  case pending
  case accepted
  case rejected
  case stale
}

public struct AIEditProposal: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var sectionId: String
  public var utf16Start: Int
  public var utf16Length: Int
  public var originalText: String
  public var replacementText: String
  public var rationale: String
  public var baseRevision: Int64
  public var status: AIEditProposalStatus
  public var createdAt: Int64

  public init(
    id: String = makeIdentifier(),
    sectionId: String,
    utf16Start: Int,
    utf16Length: Int,
    originalText: String,
    replacementText: String,
    rationale: String,
    baseRevision: Int64,
    status: AIEditProposalStatus = .pending,
    createdAt: Int64 = currentTimeMilliseconds()
  ) {
    self.id = id
    self.sectionId = sectionId
    self.utf16Start = max(0, utf16Start)
    self.utf16Length = max(0, utf16Length)
    self.originalText = originalText
    self.replacementText = replacementText
    self.rationale = rationale
    self.baseRevision = baseRevision
    self.status = status
    self.createdAt = createdAt
  }
}

public struct AIChatMessage: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var role: AIChatRole
  public var content: String
  public var createdAt: Int64
  public var providerId: String?
  public var model: String?
  public var editProposals: [AIEditProposal]

  public init(
    id: String = makeIdentifier(),
    role: AIChatRole,
    content: String,
    createdAt: Int64 = currentTimeMilliseconds(),
    providerId: String? = nil,
    model: String? = nil,
    editProposals: [AIEditProposal] = []
  ) {
    self.id = id
    self.role = role
    self.content = content
    self.createdAt = createdAt
    self.providerId = providerId
    self.model = model
    self.editProposals = editProposals
  }
}

public struct AIChatThread: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var title: String
  public var createdAt: Int64
  public var updatedAt: Int64
  public var messages: [AIChatMessage]

  public init(
    id: String = makeIdentifier(),
    title: String = "AI Chat",
    createdAt: Int64 = currentTimeMilliseconds(),
    updatedAt: Int64 = currentTimeMilliseconds(),
    messages: [AIChatMessage] = []
  ) {
    self.id = id
    self.title = title
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.messages = messages
  }
}

public struct AIChatGenerationResult: Equatable, Sendable {
  public var reply: String
  public var editProposals: [AIEditProposal]
  public var providerId: String
  public var model: String?

  public init(reply: String, editProposals: [AIEditProposal] = [], providerId: String, model: String? = nil) {
    self.reply = reply
    self.editProposals = editProposals
    self.providerId = providerId
    self.model = model
  }
}

public extension AIProviderConfig {
  static let appleFoundationEndpoint = "apple-foundation://default"
  static let appleFoundationModel = "system-default"

  static func appleFoundationDefault(id: String = "apple-foundation-default") -> AIProviderConfig {
    AIProviderConfig(
      id: id,
      provider: .appleFoundation,
      label: "Apple Foundation Models",
      endpoint: appleFoundationEndpoint,
      model: appleFoundationModel,
      keychainAccount: nil,
      enabled: true
    )
  }
}
