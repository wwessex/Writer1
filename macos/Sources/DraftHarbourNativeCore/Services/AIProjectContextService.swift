import Foundation

public struct AIProjectSectionContext: Codable, Equatable, Sendable {
  public var id: String
  public var title: String
  public var order: Int
  public var updatedAt: Int64
  public var summary: String
  public var wordCount: Int
  public var content: String
}

public struct AIProjectContextSearchResult: Codable, Equatable, Sendable {
  public var source: String
  public var id: String
  public var title: String
  public var snippet: String
  public var score: Int
}

public struct AICharacterCandidate: Codable, Equatable, Identifiable, Sendable {
  public var id: String { normalizedName }
  public var name: String
  public var normalizedName: String
  public var mentionCount: Int
  public var sectionTitles: [String]
  public var evidence: [String]
  public var inStoryBible: Bool

  public init(
    name: String,
    normalizedName: String,
    mentionCount: Int,
    sectionTitles: [String],
    evidence: [String],
    inStoryBible: Bool
  ) {
    self.name = name
    self.normalizedName = normalizedName
    self.mentionCount = mentionCount
    self.sectionTitles = sectionTitles
    self.evidence = evidence
    self.inStoryBible = inStoryBible
  }
}

public struct AIWorldCandidate: Codable, Equatable, Identifiable, Sendable {
  public var id: String { normalizedName }
  public var name: String
  public var normalizedName: String
  public var category: String
  public var mentionCount: Int
  public var sectionTitles: [String]
  public var evidence: [String]
  public var inStoryBible: Bool

  public init(
    name: String,
    normalizedName: String,
    category: String,
    mentionCount: Int,
    sectionTitles: [String],
    evidence: [String],
    inStoryBible: Bool
  ) {
    self.name = name
    self.normalizedName = normalizedName
    self.category = category
    self.mentionCount = mentionCount
    self.sectionTitles = sectionTitles
    self.evidence = evidence
    self.inStoryBible = inStoryBible
  }
}

public struct AIProjectContextIndex: Sendable {
  public static let blockedCharacterCandidateNames: Set<String> = [
    "a", "an", "and", "as", "at", "but", "by", "chapter", "chapters", "come", "could", "day", "did", "do", "does", "don", "down", "emf", "even", "evening", "every", "ext", "fade", "fairview", "for", "friday", "from", "had", "has", "have", "he", "hellfire", "her", "here", "him", "his", "how", "i", "if", "in", "int", "into", "is", "it", "its", "just", "let", "like", "look", "maybe", "monday", "night", "no", "not", "novel", "now", "of", "off", "oh", "ok", "on", "opening", "or", "out", "probably", "prologue", "red", "saturday", "scene", "she", "should", "so", "someone", "something", "somewhere", "sunday", "that", "the", "then", "there", "they", "this", "thursday", "to", "tuesday", "up", "we", "wednesday", "well", "what", "when", "where", "why", "would", "yes", "you"
  ]
  public static let nonPersonTrailingCandidateTerms: Set<String> = [
    "abbey", "bridge", "building", "cave", "caves", "church", "city", "club", "court", "courts", "desk", "forest", "hall", "harbour", "hospital", "house", "inn", "lane", "manor", "office", "park", "pier", "place", "road", "room", "school", "station", "street", "town", "village", "woods"
  ]
  public static let blockedWorldCandidateNames: Set<String> = [
    "a", "an", "and", "as", "at", "but", "by", "chapter", "chapters", "come", "could", "day", "did", "do", "does", "don", "down", "emf", "even", "evening", "every", "ext", "fade", "for", "friday", "from", "had", "has", "have", "he", "her", "here", "him", "his", "how", "i", "if", "in", "int", "into", "is", "it", "its", "judge", "just", "let", "like", "look", "maybe", "monday", "night", "no", "not", "novel", "now", "of", "off", "oh", "ok", "on", "opening", "or", "out", "probably", "prologue", "red", "saturday", "scene", "she", "should", "so", "someone", "something", "somewhere", "sunday", "that", "the", "then", "there", "they", "this", "thursday", "to", "tuesday", "up", "we", "wednesday", "well", "what", "when", "where", "why", "would", "yes", "you"
  ]
  public static let locationCandidateTerms: Set<String> = [
    "abbey", "bridge", "building", "cave", "caves", "church", "city", "court", "courts", "forest", "hall", "harbour", "hospital", "house", "inn", "lane", "manor", "park", "pier", "place", "road", "room", "school", "station", "street", "town", "village", "woods"
  ]
  public static let organisationCandidateTerms: Set<String> = [
    "agency", "club", "company", "council", "department", "foundation", "group", "institute", "order", "society"
  ]

  public var projectTitle: String
  public var projectType: ProjectType
  public var sections: [AIProjectSectionContext]
  public var characters: [CharacterEntity]
  public var worldEntries: [WorldEntry]
  public var storyBlueprint: StoryBlueprint?

  public init(envelope: DhprojEnvelope) {
    projectTitle = envelope.project.title
    projectType = envelope.projectType
    sections = envelope.sections.map {
      AIProjectSectionContext(
        id: $0.id,
        title: $0.title,
        order: $0.order,
        updatedAt: $0.updatedAt,
        summary: $0.summary,
        wordCount: MarkdownTools.wordCount($0.content ?? ""),
        content: $0.content ?? ""
      )
    }
    characters = envelope.characters
    worldEntries = envelope.worldEntries
    storyBlueprint = envelope.storyBlueprint
  }

  public func sectionMap() -> String {
    sections.map {
      "\($0.order + 1). \($0.title) [id: \($0.id), revision: \($0.updatedAt), words: \($0.wordCount)]\($0.summary.isEmpty ? "" : " - \($0.summary)")"
    }
    .joined(separator: "\n")
  }

  public func storyBibleText() -> String {
    var parts: [String] = []
    if let storyBlueprint {
      parts.append("Blueprint: \(storyBlueprint.genre) \(storyBlueprint.subgenre), tone \(storyBlueprint.tone), voice \(storyBlueprint.voice), structure \(storyBlueprint.structure.rawValue)")
    }
    if !characters.isEmpty {
      parts.append("Characters:\n" + characters.map {
        "- \($0.name) (\($0.role)): \([$0.description, $0.notes].filter { !$0.isEmpty }.joined(separator: " "))"
      }.joined(separator: "\n"))
    }
    if !worldEntries.isEmpty {
      parts.append("World:\n" + worldEntries.map {
        "- \($0.name) [\($0.category)]: \([$0.description, $0.notes].filter { !$0.isEmpty }.joined(separator: " "))"
      }.joined(separator: "\n"))
    }
    return parts.isEmpty ? "No story bible entries are available." : parts.joined(separator: "\n\n")
  }

  public func manuscriptCharacterCandidates(limit: Int = 24) -> [AICharacterCandidate] {
    var candidates: [String: CandidateAccumulator] = [:]
    let knownNames = Set(characters.map { normalizeCharacterName($0.name) })

    for section in sections {
      let matches = Self.nameMatches(in: section.content)
      for match in matches {
        let normalized = normalizeCharacterName(match)
        guard Self.isLikelyCharacterName(normalized) else { continue }
        var accumulator = candidates[normalized] ?? CandidateAccumulator(displayName: displayName(for: match), sections: [], evidence: [], count: 0)
        accumulator.count += 1
        if !accumulator.sections.contains(section.title) {
          accumulator.sections.append(section.title)
        }
        if accumulator.evidence.count < 3 {
          accumulator.evidence.append(snippetAround(match, in: section.content, sectionTitle: section.title))
        }
        candidates[normalized] = accumulator
      }
    }

    for character in characters {
      let normalized = normalizeCharacterName(character.name)
      guard Self.isLikelyCharacterName(normalized) else { continue }
      var accumulator = candidates[normalized] ?? CandidateAccumulator(displayName: displayName(for: character.name), sections: [], evidence: [], count: 0)
      if accumulator.evidence.isEmpty {
        let detail = [character.description, character.notes].filter { !$0.isEmpty }.joined(separator: " ")
        accumulator.evidence.append(detail.isEmpty ? "Story bible entry." : "Story bible: \(detail)")
      }
      candidates[normalized] = accumulator
    }

    return candidates
      .map { normalized, accumulator in
        AICharacterCandidate(
          name: accumulator.displayName,
          normalizedName: normalized,
          mentionCount: accumulator.count,
          sectionTitles: accumulator.sections,
          evidence: accumulator.evidence,
          inStoryBible: knownNames.contains(normalized)
        )
      }
      .sorted { lhs, rhs in
        if lhs.inStoryBible != rhs.inStoryBible { return lhs.inStoryBible && !rhs.inStoryBible }
        if lhs.mentionCount != rhs.mentionCount { return lhs.mentionCount > rhs.mentionCount }
        return lhs.name < rhs.name
      }
      .prefix(max(1, limit))
      .map { $0 }
  }

  public func manuscriptCharacterSummary(limit: Int = 24) -> String {
    let candidates = manuscriptCharacterCandidates(limit: limit)
    guard !candidates.isEmpty else {
      return "No likely character names were found in the manuscript text or story bible."
    }
    return candidates.map { candidate in
      let source = candidate.inStoryBible ? "story bible + manuscript" : "manuscript only"
      let sections = candidate.sectionTitles.isEmpty ? "no chapter mentions found" : candidate.sectionTitles.prefix(4).joined(separator: ", ")
      let evidence = candidate.evidence.first ?? ""
      return "- \(candidate.name): \(candidate.mentionCount) mention\(candidate.mentionCount == 1 ? "" : "s"), \(source), sections: \(sections). \(evidence)"
    }.joined(separator: "\n")
  }

  public func manuscriptWorldCandidates(limit: Int = 24) -> [AIWorldCandidate] {
    var candidates: [String: CandidateAccumulator] = [:]
    let knownWorldNames = Set(worldEntries.map { normalizeCharacterName($0.name) })
    let knownCharacterNames = Set(characters.map { normalizeCharacterName($0.name) })

    for section in sections {
      let matches = Self.nameMatches(in: section.content)
      for match in matches {
        let normalized = normalizeCharacterName(match)
        let evidence = snippetAround(match, in: section.content, sectionTitle: section.title)
        guard Self.isLikelyWorldName(normalized, evidence: evidence, knownCharacterNames: knownCharacterNames) else { continue }
        var accumulator = candidates[normalized] ?? CandidateAccumulator(
          displayName: displayName(for: match),
          sections: [],
          evidence: [],
          count: 0,
          category: Self.worldCategory(for: normalized)
        )
        accumulator.count += 1
        if !accumulator.sections.contains(section.title) {
          accumulator.sections.append(section.title)
        }
        if accumulator.evidence.count < 3 {
          accumulator.evidence.append(evidence)
        }
        candidates[normalized] = accumulator
      }
    }

    for entry in worldEntries {
      let normalized = normalizeCharacterName(entry.name)
      var accumulator = candidates[normalized] ?? CandidateAccumulator(
        displayName: displayName(for: entry.name),
        sections: [],
        evidence: [],
        count: 0,
        category: entry.category
      )
      if accumulator.evidence.isEmpty {
        let detail = [entry.description, entry.notes].filter { !$0.isEmpty }.joined(separator: " ")
        accumulator.evidence.append(detail.isEmpty ? "Story bible world entry." : "Story bible: \(detail)")
      }
      accumulator.category = entry.category
      candidates[normalized] = accumulator
    }

    return candidates
      .map { normalized, accumulator in
        AIWorldCandidate(
          name: accumulator.displayName,
          normalizedName: normalized,
          category: accumulator.category,
          mentionCount: accumulator.count,
          sectionTitles: accumulator.sections,
          evidence: accumulator.evidence,
          inStoryBible: knownWorldNames.contains(normalized)
        )
      }
      .sorted { lhs, rhs in
        if lhs.inStoryBible != rhs.inStoryBible { return lhs.inStoryBible && !rhs.inStoryBible }
        if lhs.mentionCount != rhs.mentionCount { return lhs.mentionCount > rhs.mentionCount }
        return lhs.name < rhs.name
      }
      .prefix(max(1, limit))
      .map { $0 }
  }

  public func manuscriptWorldSummary(limit: Int = 24) -> String {
    let candidates = manuscriptWorldCandidates(limit: limit)
    guard !candidates.isEmpty else {
      return "No likely place, organisation, or world names were found in the manuscript text or story bible."
    }
    return candidates.map { candidate in
      let source = candidate.inStoryBible ? "story bible + manuscript" : "manuscript only"
      let sections = candidate.sectionTitles.isEmpty ? "no chapter mentions found" : candidate.sectionTitles.prefix(4).joined(separator: ", ")
      let evidence = candidate.evidence.first ?? ""
      return "- \(candidate.name): \(candidate.mentionCount) mention\(candidate.mentionCount == 1 ? "" : "s"), \(candidate.category), \(source), sections: \(sections). \(evidence)"
    }.joined(separator: "\n")
  }

  public func compactFullContext(maxCharacters: Int = 28_000) -> String {
    var parts: [String] = [
      "Project: \(projectTitle)",
      "Type: \(projectType.rawValue)",
      "Section map:\n\(sectionMap())",
      "Story bible:\n\(storyBibleText())",
      "Manuscript character candidates:\n\(manuscriptCharacterSummary())",
      "Manuscript world candidates:\n\(manuscriptWorldSummary())"
    ]

    var remaining = max(0, maxCharacters - parts.joined(separator: "\n\n").count)
    var sectionParts: [String] = []
    for section in sections {
      guard remaining > 0 else { break }
      let header = "\n\n### \(section.title) [id: \(section.id), revision: \(section.updatedAt)]\n"
      let available = max(0, remaining - header.count)
      guard available > 0 else { break }
      let body = Self.truncate(section.content, maxCharacters: min(available, 4_000))
      sectionParts.append(header + body)
      remaining -= header.count + body.count
    }
    if !sectionParts.isEmpty {
      parts.append("Manuscript excerpts:" + sectionParts.joined())
    }
    return parts.joined(separator: "\n\n")
  }

  public func search(_ query: String, limit: Int = 8) -> [AIProjectContextSearchResult] {
    let terms = query
      .lowercased()
      .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
      .map(String.init)
      .filter { $0.count > 1 }
    guard !terms.isEmpty else { return [] }

    var results: [AIProjectContextSearchResult] = []
    for section in sections {
      let haystack = [section.title, section.summary, section.content].joined(separator: "\n")
      let score = score(haystack, terms: terms)
      if score > 0 {
        results.append(AIProjectContextSearchResult(source: "section", id: section.id, title: section.title, snippet: snippet(in: haystack, terms: terms), score: score))
      }
    }
    for character in characters {
      let haystack = [character.name, character.aliases.joined(separator: " "), character.role, character.description, character.notes, character.traits.joined(separator: " ")].joined(separator: "\n")
      let score = score(haystack, terms: terms)
      if score > 0 {
        results.append(AIProjectContextSearchResult(source: "character", id: character.id, title: character.name, snippet: snippet(in: haystack, terms: terms), score: score))
      }
    }
    for entry in worldEntries {
      let haystack = [entry.name, entry.category, entry.description, entry.notes, entry.tags.joined(separator: " ")].joined(separator: "\n")
      let score = score(haystack, terms: terms)
      if score > 0 {
        results.append(AIProjectContextSearchResult(source: "world", id: entry.id, title: entry.name, snippet: snippet(in: haystack, terms: terms), score: score))
      }
    }

    return results.sorted { lhs, rhs in
      lhs.score == rhs.score ? lhs.title < rhs.title : lhs.score > rhs.score
    }
    .prefix(max(1, limit))
    .map { $0 }
  }

  public func sectionChunk(sectionId: String, start: Int = 0, length: Int = 4_000) -> String {
    guard let section = sections.first(where: { $0.id == sectionId }) else {
      return "Section not found: \(sectionId)"
    }
    let nsText = section.content as NSString
    let boundedStart = min(max(0, start), nsText.length)
    let boundedLength = min(max(0, length), nsText.length - boundedStart)
    return nsText.substring(with: NSRange(location: boundedStart, length: boundedLength))
  }

  private func score(_ text: String, terms: [String]) -> Int {
    let lowered = text.lowercased()
    return terms.reduce(0) { score, term in
      score + (lowered.contains(term) ? 1 : 0)
    }
  }

  private func snippet(in text: String, terms: [String], radius: Int = 180) -> String {
    let lowered = text.lowercased()
    let nsText = text as NSString
    let firstMatch = terms
      .compactMap { term -> Int? in
        let range = lowered.range(of: term)
        guard let range else { return nil }
        return lowered.distance(from: lowered.startIndex, to: range.lowerBound)
      }
      .min() ?? 0
    let start = max(0, firstMatch - radius / 2)
    let length = min(nsText.length - start, radius)
    return Self.truncate(nsText.substring(with: NSRange(location: start, length: max(0, length))).replacingOccurrences(of: "\n", with: " "), maxCharacters: radius)
  }

  private func snippetAround(_ name: String, in text: String, sectionTitle: String, radius: Int = 140) -> String {
    let nsText = text as NSString
    let range = nsText.range(of: name, options: [.caseInsensitive])
    guard range.location != NSNotFound else { return sectionTitle }
    let start = max(0, range.location - radius / 2)
    let length = min(nsText.length - start, radius)
    let body = nsText.substring(with: NSRange(location: start, length: max(0, length)))
      .replacingOccurrences(of: "\n", with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return "\(sectionTitle): \(Self.truncate(body, maxCharacters: radius))"
  }

  private func normalizeCharacterName(_ name: String) -> String {
    name
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .lowercased()
  }

  private func displayName(for raw: String) -> String {
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed == trimmed.uppercased() {
      return trimmed
        .split(separator: " ")
        .map { word in word.prefix(1).uppercased() + word.dropFirst().lowercased() }
        .joined(separator: " ")
    }
    return trimmed
  }

  private static func nameMatches(in text: String) -> [String] {
    let pattern = #"\b(?:[A-Z][a-z]{1,}|[A-Z]{2,})(?:[ '\-]+(?:[A-Z][a-z]{1,}|[A-Z]{2,}))*\b"#
    guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
    let nsText = text as NSString
    return regex.matches(in: text, range: NSRange(location: 0, length: nsText.length))
      .map { nsText.substring(with: $0.range) }
  }

  public static func isLikelyCharacterName(_ normalized: String) -> Bool {
    guard normalized.count > 1 else { return false }
    if blockedCharacterCandidateNames.contains(normalized) { return false }
    let words = normalized.split(separator: " ").map(String.init)
    if let first = words.first, blockedCharacterCandidateNames.contains(first) { return false }
    if let last = words.last, blockedCharacterCandidateNames.contains(last) { return false }
    if words.count > 1,
       let last = words.last,
       nonPersonTrailingCandidateTerms.contains(last) {
      return false
    }
    if normalized.hasPrefix("chapter ") || normalized.hasPrefix("scene ") { return false }
    return true
  }

  public static func isLikelyWorldName(_ normalized: String, evidence: String = "", knownCharacterNames: Set<String> = []) -> Bool {
    guard normalized.count > 1 else { return false }
    if knownCharacterNames.contains(normalized) { return false }
    if blockedWorldCandidateNames.contains(normalized) { return false }
    let words = normalized.split(separator: " ").map(String.init)
    if let first = words.first, blockedWorldCandidateNames.contains(first) { return false }
    if let last = words.last, blockedWorldCandidateNames.contains(last) { return false }
    if words.count > 1,
       let last = words.last,
       locationCandidateTerms.union(organisationCandidateTerms).contains(last) {
      return true
    }
    return worldContextCue(for: normalized, in: evidence)
  }

  public static func worldCategory(for normalized: String) -> String {
    let words = normalized.split(separator: " ").map(String.init)
    if let last = words.last, organisationCandidateTerms.contains(last) {
      return "organisation"
    }
    return "location"
  }

  private static func worldContextCue(for normalized: String, in evidence: String) -> Bool {
    let lowered = evidence.lowercased()
    let cues = [
      "at", "in", "into", "inside", "outside", "to", "from", "near", "under", "beneath", "around", "toward", "towards", "through", "across", "behind", "within"
    ]
    return cues.contains { cue in
      lowered.contains("\(cue) \(normalized)")
    }
  }

  public static func truncate(_ text: String, maxCharacters: Int) -> String {
    guard maxCharacters > 0, text.count > maxCharacters else { return text }
    let index = text.index(text.startIndex, offsetBy: maxCharacters)
    return String(text[..<index]) + "\n[truncated]"
  }
}

private struct CandidateAccumulator {
  var displayName: String
  var sections: [String]
  var evidence: [String]
  var count: Int
  var category: String = "other"
}

public enum AIProjectContextService {
  public static func index(for envelope: DhprojEnvelope) -> AIProjectContextIndex {
    AIProjectContextIndex(envelope: envelope)
  }
}
