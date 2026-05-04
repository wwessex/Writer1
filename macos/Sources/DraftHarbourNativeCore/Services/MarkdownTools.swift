import Foundation

public enum MarkdownTools {
  public static func plainText(from markdown: String) -> String {
    var output = markdown
    let replacements: [(String, String)] = [
      (#"!\[[^\]]*\]\([^\)]*\)"#, ""),
      (#"\[([^\]]+)\]\([^\)]*\)"#, "$1"),
      (#"(^|\n)#{1,6}\s*"#, "$1"),
      (#"[*_`~>"# + #"]"#, ""),
      (#"\n{3,}"#, "\n\n")
    ]

    for (pattern, replacement) in replacements {
      output = output.replacingOccurrences(of: pattern, with: replacement, options: .regularExpression)
    }

    return output
  }

  public static func wordCount(_ text: String) -> Int {
    let plain = plainText(from: text)
    let matches = plain.matches(of: /\b[\p{Letter}\p{Number}'-]+\b/)
    return matches.count
  }

  public static func sentenceCount(_ text: String) -> Int {
    let plain = plainText(from: text)
    let matches = plain.matches(of: /[.!?]+(\s|$)/)
    return max(matches.count, plain.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0 : 1)
  }

  public static func wrapSelection(in text: String, range: Range<String.Index>, prefix: String, suffix: String) -> String {
    var copy = text
    let selected = copy[range]
    copy.replaceSubrange(range, with: "\(prefix)\(selected)\(suffix)")
    return copy
  }

  public static func screenplayBlocks(from content: String?) -> [ScreenplayBlock] {
    let lines = (content ?? "").replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n", omittingEmptySubsequences: false)
    var blocks: [ScreenplayBlock] = []
    var pendingCharacterCue = false

    for rawLine in lines {
      let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !line.isEmpty else {
        pendingCharacterCue = false
        continue
      }

      let uppercased = line.uppercased()
      if uppercased.hasPrefix("INT.") || uppercased.hasPrefix("EXT.") || uppercased.hasPrefix("EST.") || uppercased.hasPrefix("INT/EXT.") || line.hasPrefix(".") {
        blocks.append(ScreenplayBlock(type: .sceneHeading, text: line.trimmingCharacters(in: CharacterSet(charactersIn: "."))))
        pendingCharacterCue = false
      } else if line.hasPrefix(">") || uppercased.hasSuffix("TO:") {
        blocks.append(ScreenplayBlock(type: .transition, text: line.replacingOccurrences(of: ">", with: "")))
        pendingCharacterCue = false
      } else if line.hasPrefix("@") {
        blocks.append(ScreenplayBlock(type: .character, text: String(line.dropFirst())))
        pendingCharacterCue = true
      } else if isCharacterCue(line) {
        blocks.append(ScreenplayBlock(type: .character, text: line))
        pendingCharacterCue = true
      } else if pendingCharacterCue && line.hasPrefix("(") {
        blocks.append(ScreenplayBlock(type: .parenthetical, text: line))
      } else if pendingCharacterCue {
        blocks.append(ScreenplayBlock(type: .dialogue, text: line))
      } else {
        blocks.append(ScreenplayBlock(type: .action, text: line))
      }
    }

    return blocks
  }

  private static func isCharacterCue(_ line: String) -> Bool {
    guard !line.isEmpty, line.count <= 40 else { return false }
    let uppercased = line.uppercased()
    return line == uppercased && uppercased.range(of: #"[A-Z]"#, options: .regularExpression) != nil
  }
}

public struct ScreenplayBlock: Equatable, Sendable {
  public var type: ScreenplayBlockType
  public var text: String

  public init(type: ScreenplayBlockType, text: String) {
    self.type = type
    self.text = text
  }
}
