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
  case aiSuggestions
  case comments
  case addComment
  case advancedAnalytics
  case integrations
  case projects
  case sceneTemplates
  case exportHistory
  case publishingAssistant
  case aiPanel
  case translation
  case corkboard
  case inspector
  case quickSwitcher
  case findReplace
  case nativeFind
  case projectFindReplace
  case workspaceWrite
  case workspaceCorkboard
  case workspaceReview
  case toggleSidebar
  case toggleToolPanel
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
  case revealProjectInFinder
  case copyProjectPath
  case shareSelection
  case shareActiveSection
  case printActiveSection
  case printProject
  case welcome
  case copyProjectLink
  case copySectionLink
  case indexSpotlight
  case clearSpotlightIndex
  case showSpellingPanel
  case checkSpelling
  case toggleContinuousSpellChecking
  case toggleGrammarChecking
  case toggleAutomaticSpellingCorrection
  case showSubstitutionsPanel
  case toggleSmartQuotes
  case toggleSmartDashes
  case toggleTextReplacement

  public var disposition: NativeCommandDisposition {
    switch self {
    case .undo, .redo, .cut, .copy, .paste, .selectAll, .showSpellingPanel, .checkSpelling, .toggleContinuousSpellChecking, .toggleGrammarChecking, .toggleAutomaticSpellingCorrection, .showSubstitutionsPanel, .toggleSmartQuotes, .toggleSmartDashes, .toggleTextReplacement:
      return .responderChain
    case .openProjectFile, .settings, .about, .welcome:
      return .system
    case .importDocument, .newSection, .export, .saveProjectFile, .openRecent, .reopenLastProject, .exportBackup, .importBackup, .saveProjectCopy, .snapshots, .analysis, .wordCount, .dashboard, .onboarding, .characterBible, .aiWriting, .aiSuggestions, .comments, .addComment, .advancedAnalytics, .integrations, .projects, .sceneTemplates, .exportHistory, .publishingAssistant, .aiPanel, .translation, .corkboard, .inspector, .quickSwitcher, .findReplace, .nativeFind, .projectFindReplace, .workspaceWrite, .workspaceCorkboard, .workspaceReview, .toggleSidebar, .toggleToolPanel, .togglePageView, .toggleFocusMode, .themeAuto, .themeLight, .themeDark, .insertHorizontalRule, .insertBlockquote, .formatBold, .formatItalic, .formatUnderline, .formatHeading1, .formatHeading2, .formatParagraph, .toggleTypewriterMode, .storyCards, .revealProjectInFinder, .copyProjectPath, .shareSelection, .shareActiveSection, .printActiveSection, .printProject, .copyProjectLink, .copySectionLink, .indexSpotlight, .clearSpotlightIndex:
      return .native
    }
  }
}

public enum NativeCommandDisposition: String, Codable, Sendable {
  case native
  case responderChain
  case system
}

public struct NativeDocumentCommandHandler {
  public var canRun: (NativeCommandID) -> Bool
  public var run: (NativeCommandID) -> Void

  public init(
    canRun: @escaping (NativeCommandID) -> Bool,
    run: @escaping (NativeCommandID) -> Void
  ) {
    self.canRun = canRun
    self.run = run
  }

  public func perform(_ command: NativeCommandID) {
    guard canRun(command) else { return }
    run(command)
  }
}

public struct NativeDeepLink: Equatable, Sendable {
  public var projectID: String
  public var sectionID: String?

  public init(projectID: String, sectionID: String? = nil) {
    self.projectID = projectID
    self.sectionID = sectionID
  }

  public static func parse(_ url: URL) -> NativeDeepLink? {
    guard url.scheme?.caseInsensitiveCompare("draftharbour") == .orderedSame else {
      return nil
    }

    var parts: [String] = []
    if let host = url.host, !host.isEmpty {
      parts.append(host)
    }
    parts.append(contentsOf: url.pathComponents.filter { $0 != "/" })

    guard parts.count == 2 || parts.count == 4,
          parts.first == "project",
          !parts[1].isEmpty else {
      return nil
    }

    if parts.count == 4 {
      guard parts[2] == "section", !parts[3].isEmpty else { return nil }
      return NativeDeepLink(projectID: parts[1], sectionID: parts[3])
    }

    return NativeDeepLink(projectID: parts[1])
  }

  public var url: URL? {
    if let sectionID {
      return URL(string: "draftharbour://project/\(projectID)/section/\(sectionID)")
    }
    return URL(string: "draftharbour://project/\(projectID)")
  }
}

public enum WorkspaceMode: String, Codable, CaseIterable, Identifiable, Sendable {
  case write
  case corkboard
  case review

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .write:
      return "Write"
    case .corkboard:
      return "Corkboard"
    case .review:
      return "Review"
    }
  }

  public var systemImage: String {
    switch self {
    case .write:
      return "square.and.pencil"
    case .corkboard:
      return "rectangle.grid.2x2"
    case .review:
      return "checklist"
    }
  }
}

public enum InspectorTab: String, Codable, CaseIterable, Identifiable, Sendable {
  case details
  case comments
  case snapshots
  case metrics

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .details:
      return "Details"
    case .comments:
      return "Comments"
    case .snapshots:
      return "Snapshots"
    case .metrics:
      return "Metrics"
    }
  }
}

public enum ReviewFilter: String, Codable, CaseIterable, Identifiable, Sendable {
  case all
  case comments
  case snapshots
  case validation
  case continuity
  case aiRevisions = "ai-revisions"

  public var id: String { rawValue }

  public var title: String {
    switch self {
    case .all:
      return "All"
    case .comments:
      return "Comments"
    case .snapshots:
      return "Snapshots"
    case .validation:
      return "Validation"
    case .continuity:
      return "Continuity"
    case .aiRevisions:
      return "AI Revisions"
    }
  }
}

public struct WritingSessionState: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var startedAt: Int64
  public var startingWordCount: Int

  public init(id: String = makeIdentifier(), startedAt: Int64 = currentTimeMilliseconds(), startingWordCount: Int) {
    self.id = id
    self.startedAt = startedAt
    self.startingWordCount = startingWordCount
  }
}

public struct WritingSessionResult: Codable, Equatable, Sendable {
  public var session: WritingSessionState
  public var endedAt: Int64
  public var endingWordCount: Int
  public var wordsWritten: Int
  public var date: String

  public init(session: WritingSessionState, endedAt: Int64, endingWordCount: Int, wordsWritten: Int, date: String) {
    self.session = session
    self.endedAt = endedAt
    self.endingWordCount = endingWordCount
    self.wordsWritten = wordsWritten
    self.date = date
  }
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
