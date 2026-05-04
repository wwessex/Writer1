import Foundation

public struct ProjectMetrics: Equatable, Sendable {
  public var totalWords: Int
  public var sectionCount: Int
  public var averageWordsPerSection: Int
  public var sentenceCount: Int
  public var completionRatio: Double

  public init(totalWords: Int, sectionCount: Int, averageWordsPerSection: Int, sentenceCount: Int, completionRatio: Double) {
    self.totalWords = totalWords
    self.sectionCount = sectionCount
    self.averageWordsPerSection = averageWordsPerSection
    self.sentenceCount = sentenceCount
    self.completionRatio = completionRatio
  }
}

public enum AnalyticsEngine {
  public static func metrics(for envelope: DhprojEnvelope) -> ProjectMetrics {
    let contents = envelope.sections.map { $0.content ?? "" }
    let totalWords = contents.reduce(0) { $0 + MarkdownTools.wordCount($1) }
    let sentenceCount = contents.reduce(0) { $0 + MarkdownTools.sentenceCount($1) }
    let target = envelope.settings.novelWordGoal ?? envelope.settings.goalConfiguration?.dailyWordTarget ?? 0
    let completionRatio = target > 0 ? min(1, Double(totalWords) / Double(target)) : 0

    return ProjectMetrics(
      totalWords: totalWords,
      sectionCount: envelope.sections.count,
      averageWordsPerSection: envelope.sections.isEmpty ? 0 : totalWords / envelope.sections.count,
      sentenceCount: sentenceCount,
      completionRatio: completionRatio
    )
  }
}
