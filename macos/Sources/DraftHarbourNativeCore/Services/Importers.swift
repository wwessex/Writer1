import Foundation

public struct ImportResult: Equatable, Sendable {
  public var sections: [Section]
  public var notices: [String]

  public init(sections: [Section], notices: [String] = []) {
    self.sections = sections
    self.notices = notices
  }
}

public protocol Importer: Sendable {
  var supportedExtensions: [String] { get }
  func importDocument(data: Data, filename: String, projectId: String, projectType: ProjectType) throws -> ImportResult
}

public struct PlainTextImporter: Importer {
  public let supportedExtensions = ["txt", "md", "markdown"]

  public init() {}

  public func importDocument(data: Data, filename: String, projectId: String, projectType: ProjectType) throws -> ImportResult {
    guard let text = String(data: data, encoding: .utf8) else {
      throw DraftHarbourError.unsupportedFormat(filename)
    }

    let sections = splitIntoSections(text: text, projectId: projectId, projectType: projectType)
    return ImportResult(sections: sections)
  }

  private func splitIntoSections(text: String, projectId: String, projectType: ProjectType) -> [Section] {
    let lines = text.replacingOccurrences(of: "\r\n", with: "\n").split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    var sections: [Section] = []
    var title = projectType == .screenplay ? "Scene 1" : "Chapter 1"
    var body: [String] = []

    func flush() {
      let content = body.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
      guard !content.isEmpty || sections.isEmpty else { return }
      sections.append(Section(novelId: projectId, order: sections.count, title: title, content: content))
      body = []
    }

    for line in lines {
      if isLikelyHeading(line) {
        flush()
        title = line.trimmingCharacters(in: .whitespacesAndNewlines)
      } else {
        body.append(line)
      }
    }
    flush()

    return sections
  }

  private func isLikelyHeading(_ line: String) -> Bool {
    let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, trimmed.count <= 80 else { return false }
    return trimmed.range(of: #"^(chapter|chap\.?|part)\s+([0-9ivxlcdm]+)"#, options: [.regularExpression, .caseInsensitive]) != nil
      || trimmed.range(of: #"^(prologue|epilogue|interlude|introduction|preface)\b"#, options: [.regularExpression, .caseInsensitive]) != nil
  }
}
