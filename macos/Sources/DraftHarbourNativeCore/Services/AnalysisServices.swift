import Foundation

public struct SentenceDistribution: Codable, Equatable, Sendable {
  public var short: Int
  public var medium: Int
  public var long: Int
  public var veryLong: Int

  public init(short: Int = 0, medium: Int = 0, long: Int = 0, veryLong: Int = 0) {
    self.short = short
    self.medium = medium
    self.long = long
    self.veryLong = veryLong
  }
}

public enum SentimentLabel: String, Codable, Equatable, Sendable {
  case positive
  case neutral
  case negative
}

public struct SentimentResult: Codable, Equatable, Sendable {
  public var score: Double
  public var label: SentimentLabel

  public init(score: Double, label: SentimentLabel) {
    self.score = score
    self.label = label
  }
}

public struct AdvancedAnalytics: Codable, Equatable, Sendable {
  public var wordCount: Int
  public var sentenceCount: Int
  public var averageSentenceLength: Double
  public var averageParagraphLength: Double
  public var vocabularyRichness: Double
  public var dialoguePercentage: Double
  public var repeatedWords: [String: Int]
  public var wordFrequency: [String: Int]
  public var paragraphLengths: [Int]
  public var sentimentByParagraph: [SentimentResult]
  public var sentenceDistribution: SentenceDistribution

  public init(
    wordCount: Int,
    sentenceCount: Int,
    averageSentenceLength: Double,
    averageParagraphLength: Double = 0,
    vocabularyRichness: Double,
    dialoguePercentage: Double,
    repeatedWords: [String: Int],
    wordFrequency: [String: Int] = [:],
    paragraphLengths: [Int] = [],
    sentimentByParagraph: [SentimentResult] = [],
    sentenceDistribution: SentenceDistribution
  ) {
    self.wordCount = wordCount
    self.sentenceCount = sentenceCount
    self.averageSentenceLength = averageSentenceLength
    self.averageParagraphLength = averageParagraphLength
    self.vocabularyRichness = vocabularyRichness
    self.dialoguePercentage = dialoguePercentage
    self.repeatedWords = repeatedWords
    self.wordFrequency = wordFrequency
    self.paragraphLengths = paragraphLengths
    self.sentimentByParagraph = sentimentByParagraph
    self.sentenceDistribution = sentenceDistribution
  }
}

public struct TextAnalysis: Codable, Equatable, Sendable {
  public var wordCount: Int
  public var sentenceCount: Int
  public var averageSentenceLength: Double
  public var fleschScore: Int
  public var repeatedWords: [String: Int]
  public var longSentences: [String]

  public init(
    wordCount: Int,
    sentenceCount: Int,
    averageSentenceLength: Double,
    fleschScore: Int,
    repeatedWords: [String: Int],
    longSentences: [String]
  ) {
    self.wordCount = wordCount
    self.sentenceCount = sentenceCount
    self.averageSentenceLength = averageSentenceLength
    self.fleschScore = fleschScore
    self.repeatedWords = repeatedWords
    self.longSentences = longSentences
  }
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
  private static let stopWords: Set<String> = [
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "with", "by", "from", "as", "is", "was", "are", "were", "be", "been", "have",
    "has", "had", "do", "does", "did", "will", "would", "could", "should", "may",
    "might", "must", "it", "this", "that", "these", "those", "i", "you", "he",
    "she", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his",
    "our", "their", "said", "just", "very", "not", "so", "if", "then", "than"
  ]

  private static let positiveWords: Set<String> = [
    "good", "great", "happy", "joy", "love", "wonderful", "beautiful", "excellent",
    "hope", "hopeful", "bright", "warm", "kind", "gentle", "peaceful", "calm",
    "comfort", "smile", "laugh", "triumph", "victory", "success", "relief", "safe",
    "strong", "trust", "wonder", "courage", "dream", "restore", "shine", "thrive"
  ]

  private static let negativeWords: Set<String> = [
    "bad", "terrible", "horrible", "awful", "sad", "angry", "hate", "fear",
    "pain", "suffer", "cruel", "dark", "gloomy", "desperate", "hopeless",
    "tragic", "dread", "violent", "death", "grief", "rage", "agony", "betray",
    "broken", "chaos", "danger", "defeat", "destroy", "doubt", "enemy", "fail",
    "guilt", "harm", "horror", "hurt", "kill", "lonely", "loss", "panic", "threat",
    "trap", "trouble", "war", "weak", "wound"
  ]

  public static func textAnalysis(for text: String) -> TextAnalysis {
    let plain = MarkdownTools.plainText(from: text)
    let words = tokenize(plain)
    let sentences = sentenceFragments(plain)
    let repeated = repeatedWords(in: words)
    let longSentences = sentences.filter { tokenize($0).count >= 30 }

    return TextAnalysis(
      wordCount: words.count,
      sentenceCount: sentences.count,
      averageSentenceLength: sentences.isEmpty ? 0 : rounded(Double(words.count) / Double(sentences.count)),
      fleschScore: fleschReadingEase(words: words.count, sentences: max(1, sentences.count), syllables: syllableCount(in: words)),
      repeatedWords: repeated,
      longSentences: Array(longSentences.prefix(8))
    )
  }

  public static func advancedAnalytics(for text: String) -> AdvancedAnalytics {
    let plain = MarkdownTools.plainText(from: text)
    let words = tokenize(plain)
    let sentences = sentenceFragments(plain)
    let repeated = repeatedWords(in: words)
    let unique = Set(words)
    let paragraphs = paragraphFragments(plain)
    let paragraphLengths = paragraphs.map { tokenize($0).count }
    let wordFrequency = Dictionary(grouping: words.filter { $0.count > 2 && !stopWords.contains($0) }, by: { $0 })
      .mapValues(\.count)
      .filter { $0.value > 1 }
    let dialoguePercentage = dialoguePercentage(in: plain, totalWords: words.count)
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
      averageSentenceLength: sentences.isEmpty ? 0 : rounded(Double(words.count) / Double(sentences.count)),
      averageParagraphLength: paragraphLengths.isEmpty ? 0 : rounded(Double(paragraphLengths.reduce(0, +)) / Double(paragraphLengths.count)),
      vocabularyRichness: words.isEmpty ? 0 : Double(unique.count) / Double(words.count) * 100,
      dialoguePercentage: dialoguePercentage,
      repeatedWords: repeated,
      wordFrequency: wordFrequency,
      paragraphLengths: paragraphLengths,
      sentimentByParagraph: paragraphs.map(sentiment),
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
      let words = max(1, tokenize(text).count)
      let sentiment = sentiment(text)
      return NarrativeWeatherPoint(
        sectionId: section.id,
        title: section.title,
        sentiment: sentiment.score,
        pacing: min(1, Double(MarkdownTools.sentenceCount(text)) / Double(words) * 20),
        dialogueDensity: dialoguePercentage(in: text, totalWords: words) / 100
      )
    }
  }

  public static func sentiment(_ text: String) -> SentimentResult {
    let words = tokenize(text)
    var positive = 0
    var negative = 0
    for word in words {
      if positiveWords.contains(word) { positive += 1 }
      if negativeWords.contains(word) { negative += 1 }
    }
    let total = positive + negative
    guard total > 0 else { return SentimentResult(score: 0, label: .neutral) }
    let score = rounded(Double(positive - negative) / Double(total), places: 2)
    if score > 0.15 {
      return SentimentResult(score: score, label: .positive)
    }
    if score < -0.15 {
      return SentimentResult(score: score, label: .negative)
    }
    return SentimentResult(score: score, label: .neutral)
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

  static func tokenize(_ text: String) -> [String] {
    text.lowercased().matches(of: /\b[\p{Letter}\p{Number}'-]+\b/).map { String($0.output) }
  }

  static func sentenceFragments(_ text: String) -> [String] {
    text.split(whereSeparator: { ".!?".contains($0) })
      .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }

  static func paragraphFragments(_ text: String) -> [String] {
    text.replacingOccurrences(of: "\r\n", with: "\n")
      .components(separatedBy: "\n")
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }

  private static func repeatedWords(in words: [String]) -> [String: Int] {
    Dictionary(grouping: words.filter { $0.count > 3 && !stopWords.contains($0) }, by: { $0 })
      .mapValues(\.count)
      .filter { $0.value > 2 }
  }

  private static func dialoguePercentage(in text: String, totalWords: Int) -> Double {
    guard totalWords > 0 else { return 0 }
    let quoted = (text.matches(of: /"[^"]*"/).map { String($0.output) } +
      text.matches(of: /“[^”]*”/).map { String($0.output) })
    let screenplayDialogue = MarkdownTools.screenplayBlocks(from: text)
      .filter { $0.type == .dialogue }
      .map(\.text)
    let dialogueWords = (quoted + screenplayDialogue).reduce(0) { $0 + tokenize($1).count }
    return min(100, rounded(Double(dialogueWords) / Double(totalWords) * 100))
  }

  private static func fleschReadingEase(words: Int, sentences: Int, syllables: Int) -> Int {
    guard words > 0, sentences > 0 else { return 0 }
    let score = 206.835 - 1.015 * (Double(words) / Double(sentences)) - 84.6 * (Double(syllables) / Double(words))
    return Int(max(0, min(100, score)).rounded())
  }

  private static func syllableCount(in words: [String]) -> Int {
    words.reduce(0) { $0 + max(1, approximateSyllables(in: $1)) }
  }

  private static func approximateSyllables(in word: String) -> Int {
    let vowels = CharacterSet(charactersIn: "aeiouy")
    let scalars = Array(word.unicodeScalars)
    var count = 0
    var previousWasVowel = false
    for scalar in scalars {
      let isVowel = vowels.contains(scalar)
      if isVowel && !previousWasVowel {
        count += 1
      }
      previousWasVowel = isVowel
    }
    if word.hasSuffix("e"), count > 1 {
      count -= 1
    }
    return count
  }

  private static func rounded(_ value: Double, places: Int = 1) -> Double {
    let factor = pow(10, Double(places))
    return (value * factor).rounded() / factor
  }
}

public extension AnalyticsEngine {
  static func advancedAnalytics(for envelope: DhprojEnvelope) -> AdvancedAnalytics {
    AnalysisServices.advancedAnalytics(for: envelope.sections.map { $0.content ?? "" }.joined(separator: "\n\n"))
  }
}
