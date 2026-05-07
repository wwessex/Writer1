import Foundation

public struct LanguageToolReplacement: Codable, Equatable, Sendable {
  public var value: String

  public init(value: String) {
    self.value = value
  }
}

public struct LanguageToolContext: Codable, Equatable, Sendable {
  public var text: String
  public var offset: Int
  public var length: Int

  public init(text: String, offset: Int = 0, length: Int = 0) {
    self.text = text
    self.offset = offset
    self.length = length
  }
}

public struct LanguageToolMatch: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var message: String
  public var context: LanguageToolContext
  public var replacements: [LanguageToolReplacement]

  public init(id: String = makeIdentifier(), message: String, context: LanguageToolContext, replacements: [LanguageToolReplacement] = []) {
    self.id = id
    self.message = message
    self.context = context
    self.replacements = replacements
  }
}

public enum LanguageToolServices {
  private struct Response: Decodable {
    var matches: [Match]
  }

  private struct Match: Decodable {
    var message: String
    var context: Context
    var replacements: [Replacement]
  }

  private struct Context: Decodable {
    var text: String
    var offset: Int?
    var length: Int?
  }

  private struct Replacement: Decodable {
    var value: String
  }

  public static func parseMatches(from data: Data) throws -> [LanguageToolMatch] {
    let response = try JSONDecoder().decode(Response.self, from: data)
    return response.matches.prefix(30).map { match in
      LanguageToolMatch(
        message: match.message,
        context: LanguageToolContext(
          text: match.context.text,
          offset: match.context.offset ?? 0,
          length: match.context.length ?? 0
        ),
        replacements: match.replacements.prefix(5).map { LanguageToolReplacement(value: $0.value) }
      )
    }
  }

  public static func requestBody(text: String, language: String) -> Data {
    var components = URLComponents()
    components.queryItems = [
      URLQueryItem(name: "text", value: text),
      URLQueryItem(name: "language", value: language)
    ]
    return Data((components.percentEncodedQuery ?? "").utf8)
  }
}

public struct ProgressDashboard: Equatable, Sendable {
  public var todayWords: Int
  public var dailyGoal: Int
  public var weeklyGoal: Int
  public var projectGoal: Int
  public var totalWords: Int
  public var dailyGoalPercent: Int
  public var projectGoalPercent: Int
  public var deadlineDate: String?
  public var daysRemaining: Int?
  public var wordsRemaining: Int
  public var dailyWordsNeeded: Int
  public var isBehindPace: Bool
  public var overdueSectionIds: [String]
  public var resumeSectionId: String?

  public init(
    todayWords: Int,
    dailyGoal: Int,
    weeklyGoal: Int,
    projectGoal: Int,
    totalWords: Int,
    dailyGoalPercent: Int,
    projectGoalPercent: Int,
    deadlineDate: String?,
    daysRemaining: Int?,
    wordsRemaining: Int,
    dailyWordsNeeded: Int,
    isBehindPace: Bool,
    overdueSectionIds: [String],
    resumeSectionId: String?
  ) {
    self.todayWords = todayWords
    self.dailyGoal = dailyGoal
    self.weeklyGoal = weeklyGoal
    self.projectGoal = projectGoal
    self.totalWords = totalWords
    self.dailyGoalPercent = dailyGoalPercent
    self.projectGoalPercent = projectGoalPercent
    self.deadlineDate = deadlineDate
    self.daysRemaining = daysRemaining
    self.wordsRemaining = wordsRemaining
    self.dailyWordsNeeded = dailyWordsNeeded
    self.isBehindPace = isBehindPace
    self.overdueSectionIds = overdueSectionIds
    self.resumeSectionId = resumeSectionId
  }
}

public enum ProgressDashboardServices {
  public static func dashboard(for envelope: DhprojEnvelope, now: Date = Date(), calendar: Calendar = Calendar(identifier: .gregorian)) -> ProgressDashboard {
    let totalWords = AnalyticsEngine.metrics(for: envelope).totalWords
    let dailyGoal = envelope.settings.dailyWordGoal ?? envelope.settings.goalConfiguration?.dailyWordTarget ?? 0
    let weeklyGoal = envelope.settings.goalConfiguration?.weeklyWordTarget ?? 0
    let projectGoal = envelope.settings.novelWordGoal ?? envelope.settings.goalConfiguration?.milestoneCheckpoints?.last?.targetWords ?? 0
    let today = ProjectStore.todayString(date: now)
    let todayWords = envelope.progress?.dailyHistory.first(where: { $0.date == today })?.wordsWritten ?? 0
    let deadline = envelope.settings.goalConfiguration?.draftCompletionDeadline ?? envelope.settings.novelDeadline
    let deadlineInfo = deadlinePace(deadline: deadline, totalWords: totalWords, projectGoal: projectGoal, now: now, calendar: calendar)
    let overdueCutoff = now.addingTimeInterval(-14 * 24 * 60 * 60)
    let overdue = envelope.sections
      .filter { $0.status != .final && Date(timeIntervalSince1970: Double($0.updatedAt) / 1_000) < overdueCutoff }
      .map(\.id)
    let resume = envelope.sections.sorted { $0.updatedAt > $1.updatedAt }.first?.id

    return ProgressDashboard(
      todayWords: todayWords,
      dailyGoal: dailyGoal,
      weeklyGoal: weeklyGoal,
      projectGoal: projectGoal,
      totalWords: totalWords,
      dailyGoalPercent: percent(todayWords, dailyGoal),
      projectGoalPercent: percent(totalWords, projectGoal),
      deadlineDate: deadline,
      daysRemaining: deadlineInfo.daysRemaining,
      wordsRemaining: max(0, projectGoal - totalWords),
      dailyWordsNeeded: deadlineInfo.dailyWordsNeeded,
      isBehindPace: dailyGoal > 0 && deadlineInfo.dailyWordsNeeded > dailyGoal,
      overdueSectionIds: overdue,
      resumeSectionId: resume
    )
  }

  private static func percent(_ value: Int, _ target: Int) -> Int {
    guard target > 0 else { return 0 }
    return min(100, Int((Double(value) / Double(target) * 100).rounded()))
  }

  private static func deadlinePace(deadline: String?, totalWords: Int, projectGoal: Int, now: Date, calendar: Calendar) -> (daysRemaining: Int?, dailyWordsNeeded: Int) {
    guard let deadline, !deadline.isEmpty, projectGoal > 0 else {
      return (nil, 0)
    }
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    guard let date = formatter.date(from: deadline) else {
      return (nil, 0)
    }
    let endOfDeadline = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: date) ?? date
    let days = calendar.dateComponents([.day], from: now, to: endOfDeadline).day ?? 0
    let remaining = max(0, projectGoal - totalWords)
    return (days, days > 0 ? Int(ceil(Double(remaining) / Double(days))) : remaining)
  }
}

public enum SceneTemplateCategory: String, Codable, CaseIterable, Identifiable, Sendable {
  case structure
  case genre
  case pacing

  public var id: String { rawValue }
}

public struct SceneTemplate: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var name: String
  public var icon: String
  public var category: SceneTemplateCategory
  public var projectTypes: [ProjectType]
  public var summary: String
  public var tags: [String]
  public var beats: [String]

  public init(id: String, name: String, icon: String, category: SceneTemplateCategory, projectTypes: [ProjectType], summary: String, tags: [String] = [], beats: [String]) {
    self.id = id
    self.name = name
    self.icon = icon
    self.category = category
    self.projectTypes = projectTypes
    self.summary = summary
    self.tags = tags
    self.beats = beats
  }
}

public enum SceneTemplateServices {
  public static let templates: [SceneTemplate] = [
    SceneTemplate(id: "opening-hook", name: "Opening Hook", icon: "play.fill", category: .structure, projectTypes: [.book, .screenplay], summary: "Establish the world and hook the reader with an immediate question.", beats: ["Sensory anchor", "Introduce POV character mid-action", "Plant the central question", "End on a micro-cliffhanger"]),
    SceneTemplate(id: "rising-action", name: "Rising Action", icon: "chart.line.uptrend.xyaxis", category: .structure, projectTypes: [.book, .screenplay], summary: "Escalate pressure with obstacles and difficult choices.", beats: ["Recap current stakes", "Introduce a new obstacle", "Force a difficult choice", "Raise the consequence"]),
    SceneTemplate(id: "midpoint-twist", name: "Midpoint Twist", icon: "arrow.triangle.2.circlepath", category: .structure, projectTypes: [.book, .screenplay], summary: "Deliver a twist that changes everything the character believed.", beats: ["Build false confidence", "Deliver the revelation", "Show emotional reaction", "Set the new direction"]),
    SceneTemplate(id: "climax", name: "Climax Scene", icon: "bolt.fill", category: .structure, projectTypes: [.book, .screenplay], summary: "The protagonist confronts the central conflict in a decisive moment.", beats: ["Threads converge", "Defining choice", "Decisive confrontation", "Immediate cost"]),
    SceneTemplate(id: "mystery-clue", name: "Mystery: Clue Discovery", icon: "magnifyingglass", category: .genre, projectTypes: [.book, .screenplay], summary: "Plant a crucial clue hidden in plain sight.", tags: ["mystery", "clue"], beats: ["Investigation context", "Clue beside red herring", "Misinterpretation", "Larger pattern"]),
    SceneTemplate(id: "romance-tension", name: "Romance: Tension Scene", icon: "heart.fill", category: .genre, projectTypes: [.book], summary: "Forced proximity or conflict creates undeniable tension.", tags: ["romance"], beats: ["Close proximity", "Sensory awareness", "Vulnerability", "Interrupted resolution"]),
    SceneTemplate(id: "action-sequence", name: "Action Sequence", icon: "figure.run", category: .genre, projectTypes: [.book, .screenplay], summary: "High-stakes action sequence with clear spatial awareness.", tags: ["action"], beats: ["Establish space", "Trigger action", "Complicate mid-sequence", "Resolve with cost"]),
    SceneTemplate(id: "horror-dread", name: "Horror: Building Dread", icon: "eye.slash", category: .genre, projectTypes: [.book, .screenplay], summary: "Build atmospheric dread leading to a horrifying moment.", tags: ["horror"], beats: ["Normalcy with wrong detail", "Escalate unease", "Rationalize warnings", "Reveal just enough"]),
    SceneTemplate(id: "quiet-moment", name: "Quiet Character Moment", icon: "person.crop.circle", category: .pacing, projectTypes: [.book], summary: "A reflective pause that deepens character understanding.", tags: ["character"], beats: ["Safe pause", "Internal reflection", "Vulnerability", "Small foreshadowing decision"]),
    SceneTemplate(id: "dialogue-confrontation", name: "Dialogue Confrontation", icon: "text.bubble", category: .pacing, projectTypes: [.book, .screenplay], summary: "A verbal confrontation where words are weapons.", tags: ["dialogue", "conflict"], beats: ["Power dynamic", "Hidden agendas", "Subtext escalates", "One side gains ground"]),
    SceneTemplate(id: "montage", name: "Montage / Time Skip", icon: "forward.fill", category: .pacing, projectTypes: [.book, .screenplay], summary: "Compress time to show transformation or preparation.", tags: ["montage"], beats: ["Three to five vignettes", "Micro-conflicts", "Shifting sensory anchors", "Launch next act"])
  ]

  public static func scene(from template: SceneTemplate, pov: String = "", wordGoal: Int = 0, projectType: ProjectType) -> Scene {
    let beatText = template.beats.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
    return Scene(
      title: template.name,
      summary: "\(template.summary)\n\nBEATS:\n\(beatText)",
      pov: pov,
      status: .planned,
      tags: Array(Set(template.tags + template.beats.indices.map { "beat-\($0 + 1)" })),
      wordGoal: max(0, wordGoal),
      slugLine: projectType == .screenplay ? "INT. LOCATION - DAY" : nil,
      location: projectType == .screenplay ? "LOCATION" : nil,
      interiorExterior: projectType == .screenplay ? "INT" : nil,
      timeOfDay: projectType == .screenplay ? "DAY" : nil,
      pageEstimate: projectType == .screenplay ? 1 : nil,
      productionTags: projectType == .screenplay ? template.tags : nil
    )
  }
}

public struct PublishingDraft: Codable, Equatable, Sendable {
  public var bookDescription: String
  public var shortSynopsis: String
  public var longSynopsis: String
  public var authorBioShort: String
  public var authorBioLong: String
  public var keywordSuggestions: String
  public var categorySuggestions: String
  public var backCoverCopy: String
  public var hookLines: String

  public init(bookDescription: String, shortSynopsis: String, longSynopsis: String, authorBioShort: String, authorBioLong: String, keywordSuggestions: String, categorySuggestions: String, backCoverCopy: String, hookLines: String) {
    self.bookDescription = bookDescription
    self.shortSynopsis = shortSynopsis
    self.longSynopsis = longSynopsis
    self.authorBioShort = authorBioShort
    self.authorBioLong = authorBioLong
    self.keywordSuggestions = keywordSuggestions
    self.categorySuggestions = categorySuggestions
    self.backCoverCopy = backCoverCopy
    self.hookLines = hookLines
  }
}

public enum PublishingAssistantServices {
  public static func draft(for envelope: DhprojEnvelope) -> PublishingDraft {
    let title = envelope.project.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled Project" : envelope.project.title
    let summaries = envelope.sections
      .map { section in
        let summary = section.summary.trimmingCharacters(in: .whitespacesAndNewlines)
        return summary.isEmpty ? String(MarkdownTools.plainText(from: section.content ?? "").prefix(220)) : summary
      }
      .filter { !$0.isEmpty }
    let seed = summaries.prefix(6).joined(separator: " ")
    let genre = envelope.storyBlueprint?.genre.isEmpty == false ? envelope.storyBlueprint?.genre ?? "fiction" : "fiction"
    return PublishingDraft(
      bookDescription: "\(title) is a \(genre)-driven story that blends emotional stakes with escalating conflict. \(String(seed.prefix(280)))...",
      shortSynopsis: "\(title) follows a protagonist forced to make impossible choices as tension rises and personal cost deepens.",
      longSynopsis: "\(title) opens with a clear status quo before introducing disruption, opposition, and a sequence of increasingly difficult decisions. \(seed)",
      authorBioShort: "Author Name writes emotionally resonant fiction with cinematic pacing and vivid prose.",
      authorBioLong: "Author Name is a storyteller focused on high-stakes character arcs, immersive worldbuilding, and strong thematic threads.",
      keywordSuggestions: "\(genre), character-driven fiction, emotional stakes, fast-paced narrative, high tension",
      categorySuggestions: "Fiction / General; Fiction / Literary; Fiction / Action & Adventure",
      backCoverCopy: "\(title): One decision. One secret. One chance to survive what comes next.",
      hookLines: "What if the truth that could save you is the same truth that could destroy everything?\nSome stories ask who you are. This one asks what you are willing to lose."
    )
  }
}

public enum SnapshotDiffKind: String, Codable, Equatable, Sendable {
  case unchanged
  case added
  case removed
}

public struct SnapshotDiffLine: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var kind: SnapshotDiffKind
  public var text: String

  public init(id: String = makeIdentifier(), kind: SnapshotDiffKind, text: String) {
    self.id = id
    self.kind = kind
    self.text = text
  }
}

public enum SnapshotDiffServices {
  public static func diff(old: String, new: String) -> [SnapshotDiffLine] {
    let oldLines = MarkdownTools.plainText(from: old).components(separatedBy: .newlines)
    let newLines = MarkdownTools.plainText(from: new).components(separatedBy: .newlines)
    let count = max(oldLines.count, newLines.count)
    var result: [SnapshotDiffLine] = []
    for index in 0..<count {
      let oldLine = index < oldLines.count ? oldLines[index] : nil
      let newLine = index < newLines.count ? newLines[index] : nil
      if oldLine == newLine, let newLine {
        result.append(SnapshotDiffLine(kind: .unchanged, text: newLine))
      } else {
        if let oldLine, !oldLine.isEmpty {
          result.append(SnapshotDiffLine(kind: .removed, text: oldLine))
        }
        if let newLine, !newLine.isEmpty {
          result.append(SnapshotDiffLine(kind: .added, text: newLine))
        }
      }
    }
    return result
  }
}

public struct ContinuityMemorySnapshot: Codable, Equatable, Sendable {
  public var projectId: String
  public var characters: [String]
  public var timelineEvents: [String]
  public var worldRules: [String]
  public var unresolvedThreads: [String]
  public var conflicts: [TimelineFinding]

  public init(projectId: String, characters: [String], timelineEvents: [String], worldRules: [String], unresolvedThreads: [String], conflicts: [TimelineFinding]) {
    self.projectId = projectId
    self.characters = characters
    self.timelineEvents = timelineEvents
    self.worldRules = worldRules
    self.unresolvedThreads = unresolvedThreads
    self.conflicts = conflicts
  }
}

public enum ContinuityMemoryServices {
  public static func snapshot(for envelope: DhprojEnvelope) -> ContinuityMemorySnapshot {
    let characters = Set(envelope.characters.flatMap { [$0.name] + $0.aliases }.filter { !$0.isEmpty })
    var events: [String] = []
    var rules: [String] = []
    var openThreads: [String] = []
    for section in envelope.sections {
      let text = [section.title, section.summary, MarkdownTools.plainText(from: section.content ?? "")].joined(separator: "\n")
      events.append(contentsOf: capture(pattern: #"(?i)\bevent:\s*([^\n;]+)"#, in: text))
      rules.append(contentsOf: capture(pattern: #"(?i)\b(?:rule|law):\s*([^\n;]+)"#, in: text))
      openThreads.append(contentsOf: capture(pattern: #"(?i)\bthread:\s*([^\n;]+?)\s*(?:->|-)\s*open\b"#, in: text))
    }
    return ContinuityMemorySnapshot(
      projectId: envelope.project.id,
      characters: characters.sorted(),
      timelineEvents: events,
      worldRules: Array(Set(rules)).sorted(),
      unresolvedThreads: Array(Set(openThreads)).sorted(),
      conflicts: AnalysisServices.timelineFindings(for: envelope)
    )
  }

  private static func capture(pattern: String, in text: String) -> [String] {
    guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
    let nsText = text as NSString
    return regex.matches(in: text, range: NSRange(location: 0, length: nsText.length)).compactMap { match in
      guard match.numberOfRanges > 1 else { return nil }
      return nsText.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespacesAndNewlines)
    }
  }
}

public struct VoiceStyleFeatures: Codable, Equatable, Sendable {
  public var sampleTokens: Int
  public var sentenceCount: Int
  public var averageSentenceLength: Double
  public var uniqueTokenRatio: Double

  public init(sampleTokens: Int, sentenceCount: Int, averageSentenceLength: Double, uniqueTokenRatio: Double) {
    self.sampleTokens = sampleTokens
    self.sentenceCount = sentenceCount
    self.averageSentenceLength = averageSentenceLength
    self.uniqueTokenRatio = uniqueTokenRatio
  }
}

public struct VoiceFingerprint: Codable, Equatable, Sendable {
  public var speaker: String
  public var utteranceCount: Int
  public var features: VoiceStyleFeatures

  public init(speaker: String, utteranceCount: Int, features: VoiceStyleFeatures) {
    self.speaker = speaker
    self.utteranceCount = utteranceCount
    self.features = features
  }
}

public enum VoiceFingerprintServices {
  public static func dialogueBySpeaker(_ content: String?) -> [String: [String]] {
    var result: [String: [String]] = [:]
    var currentSpeaker: String?
    for block in MarkdownTools.screenplayBlocks(from: content) {
      if block.type == .character {
        currentSpeaker = block.text.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
      } else if block.type == .dialogue, let currentSpeaker {
        result[currentSpeaker, default: []].append(block.text)
      }
    }
    return result
  }

  public static func fingerprint(speaker: String, lines: [String]) -> VoiceFingerprint {
    let text = lines.joined(separator: " ")
    let tokens = AnalysisServices.tokenize(text)
    let sentences = max(1, AnalysisServices.sentenceFragments(text).count)
    let unique = Set(tokens)
    return VoiceFingerprint(
      speaker: speaker,
      utteranceCount: lines.count,
      features: VoiceStyleFeatures(
        sampleTokens: tokens.count,
        sentenceCount: sentences,
        averageSentenceLength: tokens.isEmpty ? 0 : Double(tokens.count) / Double(sentences),
        uniqueTokenRatio: tokens.isEmpty ? 0 : Double(unique.count) / Double(tokens.count)
      )
    )
  }

  public static func profiles(for envelope: DhprojEnvelope) -> [CharacterVoiceProfile] {
    envelope.characters.map { character in
      let names = Set(([character.name] + character.aliases).map { $0.uppercased() })
      let lines = envelope.sections.flatMap { section in
        dialogueBySpeaker(section.content)
          .filter { names.contains($0.key.uppercased()) }
          .flatMap(\.value)
      }
      return CharacterVoiceProfile(characterId: character.id, sampleCount: lines.count, fingerprint: fingerprint(speaker: character.name, lines: lines))
    }
  }
}

public struct SceneChemistryResult: Codable, Equatable, Sendable {
  public var tension: Double
  public var readability: Double
  public var thematicAlignment: Double
  public var confidence: Double
  public var recommendation: String

  public init(tension: Double, readability: Double, thematicAlignment: Double, confidence: Double, recommendation: String) {
    self.tension = tension
    self.readability = readability
    self.thematicAlignment = thematicAlignment
    self.confidence = confidence
    self.recommendation = recommendation
  }
}

public enum SceneChemistryServices {
  public static func evaluate(_ scene: Scene) -> SceneChemistryResult {
    let text = [scene.title, scene.summary, scene.pov, scene.location ?? "", scene.tags.joined(separator: " ")].joined(separator: " ")
    let words = max(1, AnalysisServices.tokenize(text).count)
    let sentiment = AnalysisServices.sentiment(text)
    let tension = min(100, Double(words * 3) + Double(scene.tags.count * 5) + (sentiment.label == .negative ? 15 : 0))
    let readability = Double(AnalysisServices.textAnalysis(for: scene.summary).fleschScore)
    let thematic = min(100, Double(Set(AnalysisServices.tokenize(text)).count) / Double(words) * 100)
    let confidence = Double(min(100, 45 + (scene.summary.isEmpty ? 0 : 20) + (scene.pov.isEmpty ? 0 : 15) + ((scene.location ?? "").isEmpty ? 0 : 10)))
    return SceneChemistryResult(
      tension: tension,
      readability: readability,
      thematicAlignment: thematic,
      confidence: confidence,
      recommendation: tension >= 55 ? "Lean into escalating beats and sharper reversals." : "Clarify stakes, POV intent, and scene consequence."
    )
  }
}
