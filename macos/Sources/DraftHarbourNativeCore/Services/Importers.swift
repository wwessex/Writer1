import AppKit
import Foundation
import ZIPFoundation

public enum ImportFormat: String, Codable, CaseIterable, Sendable {
  case plainText = "txt"
  case markdown
  case fountain
  case rtf
  case docx
}

public struct ImportNotice: Codable, Equatable, Sendable {
  public var severity: ValidationSeverity
  public var message: String

  public init(severity: ValidationSeverity = .info, message: String) {
    self.severity = severity
    self.message = message
  }
}

public struct ImportResult: Equatable, Sendable {
  public var sections: [Section]
  public var notices: [ImportNotice]

  public init(sections: [Section], notices: [ImportNotice] = []) {
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

  fileprivate func splitIntoSections(text: String, projectId: String, projectType: ProjectType) -> [Section] {
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

public struct FountainImporter: Importer {
  public let supportedExtensions = ["fountain", "spmd"]

  public init() {}

  public func importDocument(data: Data, filename: String, projectId: String, projectType: ProjectType) throws -> ImportResult {
    guard let text = String(data: data, encoding: .utf8) else {
      throw DraftHarbourError.unsupportedFormat(filename)
    }

    let normalized = text.replacingOccurrences(of: "\r\n", with: "\n")
    let lines = normalized.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    var sections: [Section] = []
    var currentTitle = projectType == .screenplay ? "Scene 1" : "Chapter 1"
    var body: [String] = []
    var notices: [ImportNotice] = []

    func flush() {
      let content = body.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
      guard !content.isEmpty else { return }
      sections.append(Section(novelId: projectId, order: sections.count, title: currentTitle, content: content))
      body = []
    }

    for line in lines {
      let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
      if trimmed.hasPrefix("# ") || trimmed.hasPrefix("## ") {
        flush()
        currentTitle = trimmed.replacingOccurrences(of: #"^#+\s*"#, with: "", options: .regularExpression)
      } else if isSceneHeading(trimmed) {
        flush()
        currentTitle = trimmed
        body.append(line)
      } else {
        body.append(line)
      }
    }
    flush()

    if projectType != .screenplay {
      notices.append(ImportNotice(message: "Fountain formatting was imported as Markdown-compatible plain text."))
    }
    return ImportResult(sections: sections, notices: notices)
  }

  private func isSceneHeading(_ line: String) -> Bool {
    let uppercased = line.uppercased()
    return uppercased.hasPrefix("INT.") || uppercased.hasPrefix("EXT.") || uppercased.hasPrefix("EST.") || uppercased.hasPrefix("INT/EXT.")
  }
}

public struct RTFImporter: Importer {
  public let supportedExtensions = ["rtf"]

  public init() {}

  public func importDocument(data: Data, filename: String, projectId: String, projectType: ProjectType) throws -> ImportResult {
    let attributed = try NSAttributedString(
      data: data,
      options: [.documentType: NSAttributedString.DocumentType.rtf],
      documentAttributes: nil
    )
    let sections = PlainTextImporter().splitIntoSections(text: attributed.string, projectId: projectId, projectType: projectType)
    return ImportResult(sections: sections)
  }
}

public struct DOCXImporter: Importer {
  public let supportedExtensions = ["docx"]

  public init() {}

  public func importDocument(data: Data, filename: String, projectId: String, projectType: ProjectType) throws -> ImportResult {
    let temporaryURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("DraftHarbour-\(makeIdentifier())")
      .appendingPathExtension("docx")
    try data.write(to: temporaryURL, options: .atomic)
    defer { try? FileManager.default.removeItem(at: temporaryURL) }

    let archive = try Archive(url: temporaryURL, accessMode: .read)
    guard let entry = archive["word/document.xml"] else {
      throw DraftHarbourError.unsupportedFormat(filename)
    }

    var xmlData = Data()
    _ = try archive.extract(entry) { chunk in
      xmlData.append(chunk)
    }

    guard let xml = String(data: xmlData, encoding: .utf8) else {
      throw DraftHarbourError.unsupportedFormat(filename)
    }

    let text = DOCXTextCodec.plainText(fromDocumentXML: xml)
    let sections = PlainTextImporter().splitIntoSections(text: text, projectId: projectId, projectType: projectType)
    return ImportResult(sections: sections, notices: [ImportNotice(message: "DOCX styles were flattened to Markdown-compatible text.")])
  }
}

public enum ImporterRegistry {
  public static func importer(for filename: String) -> Importer {
    let ext = URL(fileURLWithPath: filename).pathExtension.lowercased()
    switch ext {
    case "fountain", "spmd":
      return FountainImporter()
    case "rtf":
      return RTFImporter()
    case "docx":
      return DOCXImporter()
    default:
      return PlainTextImporter()
    }
  }
}
