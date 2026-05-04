import Foundation

public struct TextSearchMatch: Equatable, Identifiable, Sendable {
  public var id: String { "\(range.location)-\(range.length)" }
  public var range: NSRange
  public var preview: String

  public init(range: NSRange, preview: String) {
    self.range = range
    self.preview = preview
  }
}

public enum MarkdownTextCommand: Sendable {
  case bold
  case italic
  case underline
  case heading(level: Int)
  case paragraph
  case blockquote
  case horizontalRule

  public var commandID: NativeCommandID {
    switch self {
    case .bold: .formatBold
    case .italic: .formatItalic
    case .underline: .formatUnderline
    case .heading(let level): level == 1 ? .formatHeading1 : .formatHeading2
    case .paragraph: .formatParagraph
    case .blockquote: .insertBlockquote
    case .horizontalRule: .insertHorizontalRule
    }
  }
}

public enum TextWorkflowServices {
  public static func matches(in text: String, query: String, caseSensitive: Bool = false) -> [TextSearchMatch] {
    guard !query.isEmpty else { return [] }
    let nsText = text as NSString
    let options: NSString.CompareOptions = caseSensitive ? [] : [.caseInsensitive]
    var matches: [TextSearchMatch] = []
    var searchRange = NSRange(location: 0, length: nsText.length)

    while searchRange.location < nsText.length {
      let found = nsText.range(of: query, options: options, range: searchRange)
      if found.location == NSNotFound { break }
      let previewStart = max(0, found.location - 24)
      let previewEnd = min(nsText.length, found.location + found.length + 24)
      let preview = nsText.substring(with: NSRange(location: previewStart, length: previewEnd - previewStart))
      matches.append(TextSearchMatch(range: found, preview: preview.replacingOccurrences(of: "\n", with: " ")))
      let nextLocation = found.location + max(found.length, 1)
      searchRange = NSRange(location: nextLocation, length: nsText.length - nextLocation)
    }

    return matches
  }

  public static func replaceAll(in text: String, query: String, replacement: String, caseSensitive: Bool = false) -> (text: String, count: Int) {
    guard !query.isEmpty else { return (text, 0) }
    var copy = text
    let options: String.CompareOptions = caseSensitive ? [] : [.caseInsensitive]
    var count = 0
    while let range = copy.range(of: query, options: options) {
      copy.replaceSubrange(range, with: replacement)
      count += 1
    }
    return (copy, count)
  }

  public static func apply(_ command: MarkdownTextCommand, to text: String, range: NSRange) -> String {
    var copy = text
    let safeRange = boundedRange(range, in: copy)

    switch command {
    case .bold:
      return wrap(copy, range: safeRange, prefix: "**", suffix: "**")
    case .italic:
      return wrap(copy, range: safeRange, prefix: "_", suffix: "_")
    case .underline:
      return wrap(copy, range: safeRange, prefix: "<u>", suffix: "</u>")
    case .heading(let level):
      return prefixLine(copy, range: safeRange, prefix: String(repeating: "#", count: max(1, min(6, level))) + " ")
    case .paragraph:
      return stripLeadingMarkdownBlockMarker(copy, range: safeRange)
    case .blockquote:
      return prefixLine(copy, range: safeRange, prefix: "> ")
    case .horizontalRule:
      guard let stringRange = Range(safeRange, in: copy) else { return copy }
      copy.replaceSubrange(stringRange, with: "\n\n---\n\n")
      return copy
    }
  }

  private static func wrap(_ text: String, range: NSRange, prefix: String, suffix: String) -> String {
    var copy = text
    guard let stringRange = Range(range, in: copy) else { return copy }
    copy.replaceSubrange(stringRange, with: "\(prefix)\(copy[stringRange])\(suffix)")
    return copy
  }

  private static func prefixLine(_ text: String, range: NSRange, prefix: String) -> String {
    var copy = text
    guard let stringRange = Range(range, in: copy) else { return copy }
    let lineStart = copy[..<stringRange.lowerBound].lastIndex(of: "\n").map { copy.index(after: $0) } ?? copy.startIndex
    copy.insert(contentsOf: prefix, at: lineStart)
    return copy
  }

  private static func stripLeadingMarkdownBlockMarker(_ text: String, range: NSRange) -> String {
    var copy = text
    guard let stringRange = Range(range, in: copy) else { return copy }
    let lineStart = copy[..<stringRange.lowerBound].lastIndex(of: "\n").map { copy.index(after: $0) } ?? copy.startIndex
    let lineEnd = copy[stringRange.lowerBound...].firstIndex(of: "\n") ?? copy.endIndex
    let line = String(copy[lineStart..<lineEnd])
    let stripped = line.replacingOccurrences(of: #"^\s*(#{1,6}\s+|>\s+)"#, with: "", options: .regularExpression)
    copy.replaceSubrange(lineStart..<lineEnd, with: stripped)
    return copy
  }

  private static func boundedRange(_ range: NSRange, in text: String) -> NSRange {
    let length = (text as NSString).length
    let location = min(max(0, range.location), length)
    return NSRange(location: location, length: min(max(0, range.length), length - location))
  }
}

public struct QuickSwitcherItem: Equatable, Identifiable, Sendable {
  public enum Kind: String, Sendable {
    case section
    case command
    case character
    case worldEntry
  }

  public var id: String
  public var kind: Kind
  public var title: String
  public var subtitle: String
  public var commandID: NativeCommandID?

  public init(id: String, kind: Kind, title: String, subtitle: String = "", commandID: NativeCommandID? = nil) {
    self.id = id
    self.kind = kind
    self.title = title
    self.subtitle = subtitle
    self.commandID = commandID
  }
}

public enum QuickSwitcherIndex {
  public static func items(for envelope: DhprojEnvelope) -> [QuickSwitcherItem] {
    var items = envelope.sections.map {
      QuickSwitcherItem(id: $0.id, kind: .section, title: $0.title, subtitle: "\($0.order + 1) • \(MarkdownTools.wordCount($0.content ?? "")) words")
    }
    items.append(contentsOf: NativeCommandID.allCases.map {
      QuickSwitcherItem(id: "command-\($0.rawValue)", kind: .command, title: commandLabel($0), subtitle: "Command", commandID: $0)
    })
    items.append(contentsOf: envelope.characters.map {
      QuickSwitcherItem(id: $0.id, kind: .character, title: $0.name, subtitle: $0.role)
    })
    items.append(contentsOf: envelope.worldEntries.map {
      QuickSwitcherItem(id: $0.id, kind: .worldEntry, title: $0.name, subtitle: $0.category)
    })
    return items
  }

  public static func search(_ query: String, in envelope: DhprojEnvelope, limit: Int = 30) -> [QuickSwitcherItem] {
    let all = items(for: envelope)
    let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return Array(all.prefix(limit)) }
    return all
      .filter { item in
        item.title.range(of: trimmed, options: .caseInsensitive) != nil ||
          item.subtitle.range(of: trimmed, options: .caseInsensitive) != nil
      }
      .prefix(limit)
      .map { $0 }
  }

  public static func commandLabel(_ command: NativeCommandID) -> String {
    command.rawValue
      .replacingOccurrences(of: #"([a-z])([A-Z])"#, with: "$1 $2", options: .regularExpression)
      .replacingOccurrences(of: "-", with: " ")
      .capitalized
  }
}
