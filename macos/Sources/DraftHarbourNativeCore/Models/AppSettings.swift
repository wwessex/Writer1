import Foundation

public enum ThemePreference: String, Codable, CaseIterable, Sendable {
  case auto
  case light
  case dark

  public init(storageValue: String) {
    switch storageValue {
    case "auto", "system":
      self = .auto
    case "light":
      self = .light
    case "dark", "high-contrast":
      self = .dark
    default:
      self = .light
    }
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    let value = try container.decode(String.self)
    self = ThemePreference(storageValue: value)
  }

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(rawValue)
  }

  public static func normalizedRawValue(_ value: String) -> String {
    ThemePreference(storageValue: value).rawValue
  }
}

public struct SyncConfig: Codable, Equatable, Sendable {
  public var novelId: String?
  public var url: String?
  public var auth: String?

  public init(novelId: String? = nil, url: String? = nil, auth: String? = nil) {
    self.novelId = novelId
    self.url = url
    self.auth = auth
  }
}

public struct AssistConfig: Codable, Equatable, Sendable {
  public var languageToolEnabled: Bool?
  public var languageToolUrl: String?
  public var languageToolLanguage: String?

  public init(languageToolEnabled: Bool? = nil, languageToolUrl: String? = nil, languageToolLanguage: String? = nil) {
    self.languageToolEnabled = languageToolEnabled
    self.languageToolUrl = languageToolUrl
    self.languageToolLanguage = languageToolLanguage
  }
}

public struct TypographySettings: Codable, Equatable, Sendable {
  public var fontFamily: String?
  public var fontSize: Int?
  public var lineHeight: Double?

  public init(fontFamily: String? = nil, fontSize: Int? = nil, lineHeight: Double? = nil) {
    self.fontFamily = fontFamily
    self.fontSize = fontSize
    self.lineHeight = lineHeight
  }
}

public struct SidebarPanelsSettings: Codable, Equatable, Sendable {
  public var order: [String]?
  public var collapsed: [String: Bool]?
  public var visible: [String: Bool]?

  public init(order: [String]? = nil, collapsed: [String: Bool]? = nil, visible: [String: Bool]? = nil) {
    self.order = order
    self.collapsed = collapsed
    self.visible = visible
  }
}

public struct GoalMilestone: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var label: String
  public var targetWords: Int
  public var targetDate: String

  public init(id: String = makeIdentifier(), label: String, targetWords: Int, targetDate: String) {
    self.id = id
    self.label = label
    self.targetWords = targetWords
    self.targetDate = targetDate
  }
}

public struct GoalConfiguration: Codable, Equatable, Sendable {
  public var dailyWordTarget: Int?
  public var weeklyWordTarget: Int?
  public var draftCompletionDeadline: String?
  public var milestoneCheckpoints: [GoalMilestone]?

  public init(
    dailyWordTarget: Int? = nil,
    weeklyWordTarget: Int? = nil,
    draftCompletionDeadline: String? = nil,
    milestoneCheckpoints: [GoalMilestone]? = nil
  ) {
    self.dailyWordTarget = dailyWordTarget
    self.weeklyWordTarget = weeklyWordTarget
    self.draftCompletionDeadline = draftCompletionDeadline
    self.milestoneCheckpoints = milestoneCheckpoints
  }
}

public struct AppSettings: Codable, Equatable, Sendable {
  public var autosaveMs: Int?
  public var dailyWordGoal: Int?
  public var novelWordGoal: Int?
  public var novelDeadline: String?
  public var sync: SyncConfig?
  public var assist: AssistConfig?
  public var theme: ThemePreference?
  public var sidebarHidden: Bool?
  public var pageView: Bool?
  public var focusMode: Bool?
  public var quickSwitcherMode: String?
  public var typography: TypographySettings?
  public var onboardingComplete: Bool?
  public var typewriterMode: Bool?
  public var releaseChannel: String?
  public var sidebarPanels: SidebarPanelsSettings?
  public var goalConfiguration: GoalConfiguration?

  public init(
    autosaveMs: Int? = nil,
    dailyWordGoal: Int? = nil,
    novelWordGoal: Int? = nil,
    novelDeadline: String? = nil,
    sync: SyncConfig? = nil,
    assist: AssistConfig? = nil,
    theme: ThemePreference? = nil,
    sidebarHidden: Bool? = nil,
    pageView: Bool? = nil,
    focusMode: Bool? = nil,
    quickSwitcherMode: String? = nil,
    typography: TypographySettings? = nil,
    onboardingComplete: Bool? = nil,
    typewriterMode: Bool? = nil,
    releaseChannel: String? = nil,
    sidebarPanels: SidebarPanelsSettings? = nil,
    goalConfiguration: GoalConfiguration? = nil
  ) {
    self.autosaveMs = autosaveMs
    self.dailyWordGoal = dailyWordGoal
    self.novelWordGoal = novelWordGoal
    self.novelDeadline = novelDeadline
    self.sync = sync
    self.assist = assist
    self.theme = theme
    self.sidebarHidden = sidebarHidden
    self.pageView = pageView
    self.focusMode = focusMode
    self.quickSwitcherMode = quickSwitcherMode
    self.typography = typography
    self.onboardingComplete = onboardingComplete
    self.typewriterMode = typewriterMode
    self.releaseChannel = releaseChannel
    self.sidebarPanels = sidebarPanels
    self.goalConfiguration = goalConfiguration
  }
}

public struct DailyProgress: Codable, Equatable, Identifiable, Sendable {
  public var id: String { date }
  public var date: String
  public var wordsWritten: Int
  public var wordsAtStart: Int
  public var goalMet: Bool
  public var sessions: Int

  public init(date: String, wordsWritten: Int, wordsAtStart: Int, goalMet: Bool, sessions: Int) {
    self.date = date
    self.wordsWritten = wordsWritten
    self.wordsAtStart = wordsAtStart
    self.goalMet = goalMet
    self.sessions = sessions
  }
}

public struct WritingStreak: Codable, Equatable, Sendable {
  public var current: Int
  public var longest: Int
  public var lastActiveDate: String

  public init(current: Int = 0, longest: Int = 0, lastActiveDate: String = "") {
    self.current = current
    self.longest = longest
    self.lastActiveDate = lastActiveDate
  }
}

public struct ProgressData: Codable, Equatable, Sendable {
  public var dailyHistory: [DailyProgress]
  public var streak: WritingStreak
  public var totalSessions: Int
  public var totalWordsAllTime: Int

  public init(dailyHistory: [DailyProgress] = [], streak: WritingStreak = WritingStreak(), totalSessions: Int = 0, totalWordsAllTime: Int = 0) {
    self.dailyHistory = dailyHistory
    self.streak = streak
    self.totalSessions = totalSessions
    self.totalWordsAllTime = totalWordsAllTime
  }
}
