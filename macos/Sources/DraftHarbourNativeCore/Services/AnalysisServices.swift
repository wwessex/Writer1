import Foundation

public struct SentenceDistribution: Codable, Equatable, Sendable {
  public var short: Int
  public var medium: Int
  public var long: Int
  public var veryLong: Int
}

public struct AdvancedAnalytics: Codable, Equatable, Sendable {
  public var wordCount: Int
  public var sentenceCount: Int
  public var averageSentenceLength: Double
  public var vocabularyRichness: Double
  public var dialoguePercentage: Double
  public var repeatedWords: [String: Int]
  public var sentenceDistribution: SentenceDistribution
}

public struct TimelineFinding: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var severity: ValidationSeverity
  public var message: String
  public var sectionIds: [String]

  public init(id: String = makeIdentifier(), severity: ValidationSeverity, message: String, sectionIds: [String] = []) {
    self.id = id
    self.severity = severity
    self.message = message
    self.sectionIds = sectionIds
  }
}

public struct NarrativeWeatherPoint: Codable, Equatable, Identifiable, Sendable {
  public var id: String { sectionId }
  public var sectionId: String
  public var title: String
  public var sentiment: Double
  public var pacing: Double
  public var dialogueDensity: Double
}

public enum AnalysisServices {
  public static func advancedAnalytics(for text: String) -> AdvancedAnalytics {
    let plain = MarkdownTools.plainText(from: text)
    let words = plain.matches(of: /\b[\p{Letter}\p{Number}'-]+\b/).map { String($0.output).lowercased() }
    let sentences = plain.split(whereSeparator: { ".!?".contains($0) }).map(String.init).filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    let repeated = Dictionary(grouping: words.filter { $0.count > 3 }, by: { $0 })
      .mapValues(\.count)
      .filter { $0.value > 2 }
    let unique = Set(words)
    let dialogueLines = plain.split(separator: "\n").filter { line in
      let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.hasPrefix("\"") || trimmed.hasPrefix("@")
    }
    let lines = max(1, plain.split(separator: "\n", omittingEmptySubsequences: false).count)
    let sentenceLengths = sentences.map { MarkdownTools.wordCount($0) }
    let distribution = SentenceDistribution(
      short: sentenceLengths.filter { $0 <= 8 }.count,
      medium: sentenceLengths.filter { (9...20).contains($0) }.count,
      long: sentenceLengths.filter { (21...35).contains($0) }.count,
      veryLong: sentenceLengths.filter { $0 > 35 }.count
    )

    return AdvancedAnalytics(
      wordCount: words.count,
      sentenceCount: sentences.count,
      averageSentenceLength: sentences.isEmpty ? 0 : Double(words.count) / Double(sentences.count),
      vocabularyRichness: words.isEmpty ? 0 : Double(unique.count) / Double(words.count) * 100,
      dialoguePercentage: Double(dialogueLines.count) / Double(lines) * 100,
      repeatedWords: repeated,
      sentenceDistribution: distribution
    )
  }

  public static func timelineFindings(for envelope: DhprojEnvelope) -> [TimelineFinding] {
    var findings: [TimelineFinding] = []
    let datedScenes = envelope.sections.flatMap { section in
      section.scenes.compactMap { scene -> (Section, Scene, Date)? in
        guard let tag = scene.tags.first(where: { $0.hasPrefix("date:") }) else { return nil }
        let value = String(tag.dropFirst("date:".count))
        guard let date = ISO8601DateFormatter().date(from: value) else { return nil }
        return (section, scene, date)
      }
    }

    for pair in zip(datedScenes, datedScenes.dropFirst()) where pair.0.2 > pair.1.2 {
      findings.append(
        TimelineFinding(
          severity: .warning,
          message: "\(pair.1.1.title) appears earlier in the timeline than the prior scene.",
          sectionIds: [pair.0.0.id, pair.1.0.id]
        )
      )
    }
    return findings
  }

  public static func narrativeWeather(for envelope: DhprojEnvelope) -> [NarrativeWeatherPoint] {
    envelope.sections.map { section in
      let text = MarkdownTools.plainText(from: section.content ?? "")
      let words = max(1, MarkdownTools.wordCount(text))
      let positive = ["hope", "love", "win", "safe", "bright", "relief", "laugh"].reduce(0) { $0 + occurrences(of: $1, in: text) }
      let negative = ["fear", "death", "blood", "lost", "dark", "pain", "alone"].reduce(0) { $0 + occurrences(of: $1, in: text) }
      let dialogue = text.split(separator: "\n").filter { $0.trimmingCharacters(in: .whitespaces).hasPrefix("\"") || $0.trimmingCharacters(in: .whitespaces).hasPrefix("@") }.count
      let lines = max(1, text.split(separator: "\n", omittingEmptySubsequences: false).count)
      return NarrativeWeatherPoint(
        sectionId: section.id,
        title: section.title,
        sentiment: Double(positive - negative) / Double(words),
        pacing: min(1, Double(MarkdownTools.sentenceCount(text)) / Double(words) * 20),
        dialogueDensity: Double(dialogue) / Double(lines)
      )
    }
  }

  public static func continuityWarnings(for envelope: DhprojEnvelope) -> [String] {
    var warnings: [String] = []
    let knownCharacters = Set(envelope.characters.flatMap { [$0.name] + $0.aliases }.map { $0.lowercased() })
    let speakerNames = envelope.sections
      .flatMap { MarkdownTools.screenplayBlocks(from: $0.content) }
      .filter { $0.type == .character }
      .map { $0.text.lowercased() }
    for speaker in Set(speakerNames) where !knownCharacters.isEmpty && !knownCharacters.contains(speaker) {
      warnings.append("Speaker \(speaker.capitalized) is not in the character bible.")
    }
    return warnings.sorted()
  }

  private static func occurrences(of needle: String, in haystack: String) -> Int {
    haystack.lowercased().components(separatedBy: needle.lowercased()).count - 1
  }
}

public extension AnalyticsEngine {
  static func advancedAnalytics(for envelope: DhprojEnvelope) -> AdvancedAnalytics {
    AnalysisServices.advancedAnalytics(for: envelope.sections.map { $0.content ?? "" }.joined(separator: "\n\n"))
  }
}
