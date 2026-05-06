import Foundation

public enum NativeCommandID: String, Codable, CaseIterable, Sendable {
  case newSection
  case export
  case importDocument
  case saveProjectFile
  case openProjectFile
  case openRecent
  case reopenLastProject
  case exportBackup
  case importBackup
  case saveProjectCopy
  case settings
  case snapshots
  case analysis
  case wordCount
  case dashboard
  case onboarding
  case about
  case characterBible
  case aiWriting
  case comments
  case addComment
  case advancedAnalytics
  case integrations
  case projects
  case sceneTemplates
  case exportHistory
  case aiPanel
  case translation
  case corkboard
  case inspector
  case quickSwitcher
  case findReplace
  case toggleSidebar
  case togglePageView
  case toggleFocusMode
  case themeAuto
  case themeLight
  case themeDark
  case undo
  case redo
  case cut
  case copy
  case paste
  case selectAll
  case insertHorizontalRule
  case insertBlockquote
  case formatBold
  case formatItalic
  case formatUnderline
  case formatHeading1
  case formatHeading2
  case formatParagraph
  case toggleTypewriterMode
  case storyCards

  public var disposition: NativeCommandDisposition {
    switch self {
    case .undo, .redo, .cut, .copy, .paste, .selectAll:
      return .responderChain
    case .openProjectFile, .saveProjectFile, .openRecent, .reopenLastProject, .exportBackup, .importBackup, .saveProjectCopy, .settings, .about:
      return .system
    case .importDocument, .newSection, .export, .snapshots, .analysis, .wordCount, .dashboard, .onboarding, .characterBible, .aiWriting, .comments, .addComment, .advancedAnalytics, .integrations, .projects, .sceneTemplates, .exportHistory, .aiPanel, .translation, .corkboard, .inspector, .quickSwitcher, .findReplace, .toggleSidebar, .togglePageView, .toggleFocusMode, .themeAuto, .themeLight, .themeDark, .insertHorizontalRule, .insertBlockquote, .formatBold, .formatItalic, .formatUnderline, .formatHeading1, .formatHeading2, .formatParagraph, .toggleTypewriterMode, .storyCards:
      return .native
    }
  }
}

public enum NativeCommandDisposition: String, Codable, Sendable {
  case native
  case responderChain
  case system
}

public enum StoryStructurePreference: String, Codable, CaseIterable, Sendable {
  case threeAct = "three-act"
  case saveTheCat = "save-the-cat"
  case heroJourney = "hero-journey"
}

public enum PacingProfile: String, Codable, CaseIterable, Sendable {
  case fast
  case balanced
  case slowBurn = "slow-burn"
}

public struct StoryBlueprint: Codable, Equatable, Sendable {
  public var genre: String
  public var subgenre: String
  public var targetAudience: String
  public var ageBand: String
  public var tone: String
  public var voice: String
  public var structure: StoryStructurePreference
  public var targetWordCount: Int
  public var pacingProfile: PacingProfile

  public init(
    genre: String = "",
    subgenre: String = "",
    targetAudience: String = "",
    ageBand: String = "",
    tone: String = "",
    voice: String = "",
    structure: StoryStructurePreference = .threeAct,
    targetWordCount: Int = 80_000,
    pacingProfile: PacingProfile = .balanced
  ) {
    self.genre = genre
    self.subgenre = subgenre
    self.targetAudience = targetAudience
    self.ageBand = ageBand
    self.tone = tone
    self.voice = voice
    self.structure = structure
    self.targetWordCount = targetWordCount
    self.pacingProfile = pacingProfile
  }
}

public struct ExportHistoryRecord: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var timestamp: Int64
  public var format: ExportFormat
  public var filename: String
  public var sectionCount: Int
  public var wordCount: Int
  public var validationIssues: [ExportValidationIssue]

  public init(
    id: String = makeIdentifier(),
    timestamp: Int64 = currentTimeMilliseconds(),
    format: ExportFormat,
    filename: String,
    sectionCount: Int,
    wordCount: Int,
    validationIssues: [ExportValidationIssue] = []
  ) {
    self.id = id
    self.timestamp = timestamp
    self.format = format
    self.filename = filename
    self.sectionCount = sectionCount
    self.wordCount = wordCount
    self.validationIssues = validationIssues
  }
}

public enum AIProviderType: String, Codable, CaseIterable, Sendable {
  case managedCloud = "managed-cloud"
  case openAICompatible = "openai-compatible"
  case serverProxy = "server-proxy"
  case customLLM = "custom-llm"
  case localOpenAI = "local-openai"
}

public struct AIProviderConfig: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var provider: AIProviderType
  public var label: String
  public var endpoint: String
  public var model: String
  public var keychainAccount: String?
  public var enabled: Bool

  public init(
    id: String = makeIdentifier(),
    provider: AIProviderType,
    label: String,
    endpoint: String,
    model: String,
    keychainAccount: String? = nil,
    enabled: Bool = true
  ) {
    self.id = id
    self.provider = provider
    self.label = label
    self.endpoint = endpoint
    self.model = model
    self.keychainAccount = keychainAccount
    self.enabled = enabled
  }
}

public struct AIRevisionRecord: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var sectionId: String
  public var createdAt: Int64
  public var providerId: String
  public var prompt: String
  public var before: String
  public var after: String

  public init(
    id: String = makeIdentifier(),
    sectionId: String,
    createdAt: Int64 = currentTimeMilliseconds(),
    providerId: String,
    prompt: String,
    before: String,
    after: String
  ) {
    self.id = id
    self.sectionId = sectionId
    self.createdAt = createdAt
    self.providerId = providerId
    self.prompt = prompt
    self.before = before
    self.after = after
  }
}

public enum ValidationSeverity: String, Codable, Sendable {
  case error
  case warning
  case info
}

public struct ExportValidationIssue: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var severity: ValidationSeverity
  public var message: String
  public var sectionId: String?

  public init(id: String = makeIdentifier(), severity: ValidationSeverity, message: String, sectionId: String? = nil) {
    self.id = id
    self.severity = severity
    self.message = message
    self.sectionId = sectionId
  }
}
