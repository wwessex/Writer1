import AppKit
import Foundation
import ZIPFoundation

public enum ExportFormat: String, Codable, CaseIterable, Sendable {
  case markdown
  case plainText = "txt"
  case fountain
  case rtf
  case pdf
  case screenplayPdf
  case docx
  case publishingBundle
}

public struct ExportedFile: Equatable, Sendable {
  public var filename: String
  public var contentType: String
  public var data: Data

  public init(filename: String, contentType: String, data: Data) {
    self.filename = filename
    self.contentType = contentType
    self.data = data
  }
}

public protocol Exporter: Sendable {
  var format: ExportFormat { get }
  func export(_ envelope: DhprojEnvelope) throws -> ExportedFile
}

public struct MarkdownExporter: Exporter {
  public let format: ExportFormat = .markdown

  public init() {}

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    let body = envelope.sections.map { "# \($0.title)\n\n\($0.content ?? "")" }.joined(separator: "\n\n")
    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title)).md",
      contentType: "text/markdown",
      data: Data(body.utf8)
    )
  }
}

public struct PlainTextExporter: Exporter {
  public let format: ExportFormat = .plainText

  public init() {}

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    let body = envelope.sections
      .map { "\($0.title)\n\n\(MarkdownTools.plainText(from: $0.content ?? ""))" }
      .joined(separator: "\n\n")
    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title)).txt",
      contentType: "text/plain",
      data: Data(body.utf8)
    )
  }
}

public struct FountainExporter: Exporter {
  public let format: ExportFormat = .fountain

  public init() {}

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    let body = envelope.sections
      .map { "## \($0.title)\n\n\(($0.content ?? "").trimmingCharacters(in: .whitespacesAndNewlines))" }
      .joined(separator: "\n\n")
    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title)).fountain",
      contentType: "text/plain",
      data: Data(body.utf8)
    )
  }
}

public struct RTFExporter: Exporter {
  public let format: ExportFormat = .rtf

  public init() {}

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    let plain = envelope.sections
      .map { "\($0.title)\n\n\(MarkdownTools.plainText(from: $0.content ?? ""))" }
      .joined(separator: "\n\n")
    let attributed = NSAttributedString(
      string: plain,
      attributes: [
        .font: NSFont.systemFont(ofSize: 13),
        .foregroundColor: NSColor.labelColor
      ]
    )
    let data = try attributed.data(
      from: NSRange(location: 0, length: attributed.length),
      documentAttributes: [.documentType: NSAttributedString.DocumentType.rtf]
    )
    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title)).rtf",
      contentType: "application/rtf",
      data: data
    )
  }
}

public struct PDFExporter: Exporter {
  public let format: ExportFormat = .pdf

  public init() {}

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    let text = envelope.sections
      .map { "\($0.title)\n\n\(MarkdownTools.plainText(from: $0.content ?? ""))" }
      .joined(separator: "\n\n")
    let data = NSMutableData()
    var mediaBox = CGRect(x: 0, y: 0, width: 612, height: 792)
    guard let consumer = CGDataConsumer(data: data), let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
      throw DraftHarbourError.featurePlanned("PDF export")
    }

    context.beginPDFPage(nil)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = 4
    let attributes: [NSAttributedString.Key: Any] = [
      .font: NSFont.systemFont(ofSize: 12),
      .paragraphStyle: paragraph
    ]
    (text as NSString).draw(in: CGRect(x: 54, y: 54, width: 504, height: 684), withAttributes: attributes)
    NSGraphicsContext.restoreGraphicsState()
    context.endPDFPage()
    context.closePDF()

    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title)).pdf",
      contentType: "application/pdf",
      data: data as Data
    )
  }
}

public struct ScreenplayPDFExporter: Exporter {
  public let format: ExportFormat = .screenplayPdf

  public init() {}

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    let text = envelope.sections
      .flatMap { MarkdownTools.screenplayBlocks(from: $0.content) }
      .map { block in
        switch block.type {
        case .sceneHeading, .character, .transition:
          return block.text.uppercased()
        case .parenthetical, .dialogue, .action:
          return block.text
        }
      }
      .joined(separator: "\n")

    let data = NSMutableData()
    var mediaBox = CGRect(x: 0, y: 0, width: 612, height: 792)
    guard let consumer = CGDataConsumer(data: data), let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
      throw DraftHarbourError.featurePlanned("Screenplay PDF export")
    }

    context.beginPDFPage(nil)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = 2
    let attributes: [NSAttributedString.Key: Any] = [
      .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
      .paragraphStyle: paragraph
    ]
    (text as NSString).draw(in: CGRect(x: 72, y: 54, width: 468, height: 684), withAttributes: attributes)
    NSGraphicsContext.restoreGraphicsState()
    context.endPDFPage()
    context.closePDF()

    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title))-screenplay.pdf",
      contentType: "application/pdf",
      data: data as Data
    )
  }
}

public struct DOCXExporter: Exporter {
  public let format: ExportFormat = .docx

  public init() {}

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    let documentXML = DOCXTextCodec.documentXML(title: envelope.project.title, sections: envelope.sections)
    let entries: [String: Data] = [
      "[Content_Types].xml": Data(DOCXTextCodec.contentTypesXML.utf8),
      "_rels/.rels": Data(DOCXTextCodec.relationshipsXML.utf8),
      "word/document.xml": Data(documentXML.utf8),
      "word/_rels/document.xml.rels": Data(DOCXTextCodec.documentRelationshipsXML.utf8)
    ]
    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title)).docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      data: try ZIPDataWriter.archive(entries: entries)
    )
  }
}

public struct PublishingBundleExporter: Exporter {
  public let format: ExportFormat = .publishingBundle

  public init() {}

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    let synopsis = envelope.sections
      .map { $0.summary }
      .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
      .joined(separator: "\n\n")
    let payload: [String: JSONValue] = [
      "title": .string(envelope.project.title),
      "projectType": .string(envelope.projectType.rawValue),
      "shortSynopsis": .string(String(synopsis.prefix(1_000))),
      "longSynopsis": .string(synopsis),
      "wordCount": .number(Double(AnalyticsEngine.metrics(for: envelope).totalWords)),
      "keywords": .array(envelope.sections.flatMap(\.tags).uniqued().map { .string($0) }),
      "sections": .array(envelope.sections.map { .object(["title": .string($0.title), "summary": .string($0.summary)]) })
    ]
    let data = try JSONEncoder().encode(payload)
    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title))-publishing-bundle.json",
      contentType: "application/json",
      data: data
    )
  }
}

public enum ExporterRegistry {
  public static func exporter(for format: ExportFormat) -> Exporter {
    switch format {
    case .markdown:
      return MarkdownExporter()
    case .plainText:
      return PlainTextExporter()
    case .fountain:
      return FountainExporter()
    case .rtf:
      return RTFExporter()
    case .pdf:
      return PDFExporter()
    case .screenplayPdf:
      return ScreenplayPDFExporter()
    case .docx:
      return DOCXExporter()
    case .publishingBundle:
      return PublishingBundleExporter()
    }
  }
}

public enum ExportValidator {
  public static func validate(_ envelope: DhprojEnvelope, format: ExportFormat) -> [ExportValidationIssue] {
    var issues: [ExportValidationIssue] = []
    if envelope.sections.isEmpty {
      issues.append(ExportValidationIssue(severity: .error, message: "Project has no sections to export."))
    }
    for section in envelope.sections where (section.content ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      issues.append(ExportValidationIssue(severity: .warning, message: "\(section.title) is empty.", sectionId: section.id))
    }
    if envelope.projectType == .screenplay && (format == .screenplayPdf || format == .fountain) {
      let hasSceneHeading = envelope.sections.contains { section in
        MarkdownTools.screenplayBlocks(from: section.content).contains { $0.type == .sceneHeading }
      }
      if !hasSceneHeading {
        issues.append(ExportValidationIssue(severity: .warning, message: "Screenplay export has no scene headings."))
      }
    }
    return issues
  }
}

private enum ZIPDataWriter {
  static func archive(entries: [String: Data]) throws -> Data {
    let temporaryURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("DraftHarbour-\(makeIdentifier())")
      .appendingPathExtension("zip")
    defer { try? FileManager.default.removeItem(at: temporaryURL) }

    let archive = try Archive(url: temporaryURL, accessMode: .create)

    for (path, data) in entries {
      try archive.addEntry(
        with: path,
        type: .file,
        uncompressedSize: Int64(data.count),
        compressionMethod: .deflate
      ) { position, size in
        data.subdata(in: Int(position)..<Int(position) + size)
      }
    }

    return try Data(contentsOf: temporaryURL)
  }
}

public enum DOCXTextCodec {
  public static let contentTypesXML = """
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  </Types>
  """

  public static let relationshipsXML = """
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  </Relationships>
  """

  public static let documentRelationshipsXML = """
  <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
  """

  public static func documentXML(title: String, sections: [Section]) -> String {
    let paragraphs = sections.flatMap { section -> [String] in
      let heading = paragraph(section.title, style: "Heading1")
      let body = (section.content ?? "")
        .replacingOccurrences(of: "\r\n", with: "\n")
        .components(separatedBy: "\n")
        .map { paragraph(MarkdownTools.plainText(from: $0)) }
      return [heading] + body
    }.joined()

    return """
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        \(paragraph(title, style: "Title"))
        \(paragraphs)
        <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
      </w:body>
    </w:document>
    """
  }

  public static func plainText(fromDocumentXML xml: String) -> String {
    let paragraphPattern = #"<w:p[\s\S]*?</w:p>"#
    let paragraphs = xml.matches(of: try! Regex(paragraphPattern)).map { String(xml[$0.range]) }
    let source = paragraphs.isEmpty ? [xml] : paragraphs
    return source
      .map { paragraph in
        paragraph.matches(of: /<w:t[^>]*>([\s\S]*?)<\/w:t>/)
          .map { String($0.1).xmlUnescaped }
          .joined()
      }
      .joined(separator: "\n\n")
      .replacingOccurrences(of: "\u{00a0}", with: " ")
  }

  private static func paragraph(_ text: String, style: String? = nil) -> String {
    let styleXML = style.map { "<w:pPr><w:pStyle w:val=\"\($0)\"/></w:pPr>" } ?? ""
    return "<w:p>\(styleXML)<w:r><w:t xml:space=\"preserve\">\(text.xmlEscaped)</w:t></w:r></w:p>"
  }
}

private func safeFilename(_ title: String) -> String {
  let invalid = CharacterSet(charactersIn: "/\\?%*|\"<>:")
  let components = title.components(separatedBy: invalid).filter { !$0.isEmpty }
  let joined = components.joined(separator: "-").trimmingCharacters(in: .whitespacesAndNewlines)
  return joined.isEmpty ? "DraftHarbour Project" : joined
}

private extension Array where Element: Hashable {
  func uniqued() -> [Element] {
    var seen = Set<Element>()
    return filter { seen.insert($0).inserted }
  }
}

private extension String {
  var xmlEscaped: String {
    replacingOccurrences(of: "&", with: "&amp;")
      .replacingOccurrences(of: "<", with: "&lt;")
      .replacingOccurrences(of: ">", with: "&gt;")
      .replacingOccurrences(of: "\"", with: "&quot;")
      .replacingOccurrences(of: "'", with: "&apos;")
  }

  var xmlUnescaped: String {
    replacingOccurrences(of: "&lt;", with: "<")
      .replacingOccurrences(of: "&gt;", with: ">")
      .replacingOccurrences(of: "&quot;", with: "\"")
      .replacingOccurrences(of: "&apos;", with: "'")
      .replacingOccurrences(of: "&amp;", with: "&")
  }
}
