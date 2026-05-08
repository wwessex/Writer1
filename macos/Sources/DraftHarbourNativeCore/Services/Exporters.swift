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
  func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile
}

public extension Exporter {
  func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    try export(envelope, request: ExportRequest(format: format))
  }
}

public struct MarkdownExporter: Exporter {
  public let format: ExportFormat = .markdown

  public init() {}

  public func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile {
    let body = envelope.sections.map { section in
      request.includeHeadings ? "# \(section.title)\n\n\(section.content ?? "")" : section.content ?? ""
    }.joined(separator: "\n\n")
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

  public func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile {
    let body = envelope.sections
      .map { section in
        let text = MarkdownTools.plainText(from: section.content ?? "")
        return request.includeHeadings ? "\(section.title)\n\n\(text)" : text
      }
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

  public func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile {
    let options = request.fountainOptions ?? FountainExportOptions(includeSectionTitles: request.includeHeadings, includeMetadataBlock: false)
    let metadata = options.includeMetadataBlock
      ? [
        "Title: \(envelope.project.title)",
        request.manuscriptOptions?.authorName.isEmpty == false ? "Author: \(request.manuscriptOptions?.authorName ?? "")" : nil,
        "Draft date: \(ISO8601DateFormatter().string(from: Date()))"
      ].compactMap { $0 }.joined(separator: "\n") + "\n\n"
      : ""
    let body = envelope.sections
      .map { section in
        let content = (section.content ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return options.includeSectionTitles ? "## \(section.title)\n\n\(content)" : content
      }
      .joined(separator: "\n\n")
    let suffix: String
    switch options.filenameConvention {
    case .title:
      suffix = ".fountain"
    case .titleScreenplay:
      suffix = "-screenplay.fountain"
    case .titleFountain:
      suffix = "-fountain-export.fountain"
    }
    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title))\(suffix)",
      contentType: "text/plain",
      data: Data((metadata + body).utf8)
    )
  }
}

public struct RTFExporter: Exporter {
  public let format: ExportFormat = .rtf

  public init() {}

  public func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile {
    let plain = manuscriptPlainText(envelope, request: request)
    let options = request.manuscriptOptions
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = CGFloat(((options?.lineSpacing ?? 1.15) - 1) * (options?.fontSizePt ?? 13))
    paragraph.paragraphSpacingBefore = CGFloat(options?.paragraphSpacingBeforePt ?? 0)
    paragraph.paragraphSpacing = CGFloat(options?.paragraphSpacingAfterPt ?? 0)
    paragraph.firstLineHeadIndent = CGFloat((options?.firstLineIndentIn ?? 0) * 72)
    paragraph.alignment = options?.alignment.nsAlignment ?? .left
    let attributed = NSAttributedString(
      string: plain,
      attributes: [
        .font: exportFont(options?.fontFamily, size: CGFloat(options?.fontSizePt ?? 13)),
        .foregroundColor: NSColor.labelColor,
        .paragraphStyle: paragraph
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

  public func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile {
    let text = manuscriptPlainText(envelope, request: request)
    let options = request.manuscriptOptions
    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = CGFloat(((options?.lineSpacing ?? 1.35) - 1) * (options?.fontSizePt ?? 12))
    paragraph.paragraphSpacingBefore = CGFloat(options?.paragraphSpacingBeforePt ?? 0)
    paragraph.paragraphSpacing = CGFloat(options?.paragraphSpacingAfterPt ?? 0)
    paragraph.firstLineHeadIndent = CGFloat((options?.firstLineIndentIn ?? 0) * 72)
    paragraph.alignment = options?.alignment.nsAlignment ?? .left
    let margins = options.map { manuscriptMargins($0) } ?? NSEdgeInsets(top: 54, left: 54, bottom: 54, right: 54)
    let data = try PDFTextRenderer.render(
      text: text,
      pageSize: options?.pageSize.dimensions ?? CGSize(width: 612, height: 792),
      margins: margins,
      attributes: [
        .font: exportFont(options?.fontFamily, size: CGFloat(options?.fontSizePt ?? 12)),
        .paragraphStyle: paragraph
      ],
      headerText: manuscriptHeader(options),
      pageNumbering: options?.pageNumbering ?? false
    )

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

  public func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile {
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

    let paragraph = NSMutableParagraphStyle()
    paragraph.lineSpacing = 2
    let data = try PDFTextRenderer.render(
      text: text,
      pageSize: CGSize(width: 612, height: 792),
      margins: NSEdgeInsets(top: 54, left: 72, bottom: 54, right: 72),
      attributes: [
        .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
        .paragraphStyle: paragraph
      ]
    )

    return ExportedFile(
      filename: "\(safeFilename(envelope.project.title))-screenplay.pdf",
      contentType: "application/pdf",
      data: data as Data
    )
  }
}

private enum PDFTextRenderer {
  static func render(
    text: String,
    pageSize: CGSize,
    margins: NSEdgeInsets,
    attributes: [NSAttributedString.Key: Any],
    headerText: String? = nil,
    pageNumbering: Bool = false
  ) throws -> Data {
    let data = NSMutableData()
    var mediaBox = CGRect(origin: .zero, size: pageSize)
    guard let consumer = CGDataConsumer(data: data), let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
      throw DraftHarbourError.featurePlanned("PDF export")
    }

    let contentSize = CGSize(
      width: pageSize.width - margins.left - margins.right,
      height: pageSize.height - margins.top - margins.bottom
    )
    let textStorage = NSTextStorage(attributedString: NSAttributedString(string: text.isEmpty ? " " : text, attributes: attributes))
    let layoutManager = NSLayoutManager()
    textStorage.addLayoutManager(layoutManager)

    while layoutManager.numberOfGlyphs == 0 || layoutManager.textContainers.isEmpty || NSMaxRange(layoutManager.glyphRange(for: layoutManager.textContainers.last!)) < layoutManager.numberOfGlyphs {
      let textContainer = NSTextContainer(size: contentSize)
      textContainer.lineFragmentPadding = 0
      layoutManager.addTextContainer(textContainer)
      layoutManager.ensureLayout(for: textContainer)
      let glyphRange = layoutManager.glyphRange(for: textContainer)
      if glyphRange.length == 0, layoutManager.textContainers.count > 1 {
        layoutManager.removeTextContainer(at: layoutManager.textContainers.count - 1)
        break
      }

      let pageIndex = layoutManager.textContainers.count
      context.beginPDFPage(nil)
      NSGraphicsContext.saveGraphicsState()
      NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
      drawHeader(headerText: headerText, pageNumbering: pageNumbering, pageIndex: pageIndex, pageSize: pageSize, margins: margins)
      let origin = CGPoint(x: margins.left, y: margins.bottom)
      layoutManager.drawBackground(forGlyphRange: glyphRange, at: origin)
      layoutManager.drawGlyphs(forGlyphRange: glyphRange, at: origin)
      NSGraphicsContext.restoreGraphicsState()
      context.endPDFPage()

      if NSMaxRange(glyphRange) >= layoutManager.numberOfGlyphs {
        break
      }
    }

    context.closePDF()
    return data as Data
  }

  private static func drawHeader(
    headerText: String?,
    pageNumbering: Bool,
    pageIndex: Int,
    pageSize: CGSize,
    margins: NSEdgeInsets
  ) {
    guard headerText?.isEmpty == false || pageNumbering else { return }
    let header = [headerText, pageNumbering ? "\(pageIndex)" : nil]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .joined(separator: " / ")
    guard !header.isEmpty else { return }
    let attributed = NSAttributedString(
      string: header,
      attributes: [
        .font: NSFont.systemFont(ofSize: 9),
        .foregroundColor: NSColor.secondaryLabelColor
      ]
    )
    attributed.draw(at: CGPoint(x: margins.left, y: pageSize.height - margins.top + 16))
  }
}

public struct DOCXExporter: Exporter {
  public let format: ExportFormat = .docx

  public init() {}

  public func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile {
    let documentXML = DOCXTextCodec.documentXML(title: envelope.project.title, sections: envelope.sections, request: request)
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

  public func export(_ envelope: DhprojEnvelope, request: ExportRequest) throws -> ExportedFile {
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
    validate(envelope, request: ExportRequest(format: format))
  }

  public static func validate(_ envelope: DhprojEnvelope, request: ExportRequest) -> [ExportValidationIssue] {
    let format = request.format
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
    if envelope.projectType == .book, let options = request.manuscriptOptions {
      issues.append(contentsOf: manuscriptValidationIssues(options: options, sections: envelope.sections, format: format))
    }
    return issues
  }

  private static func manuscriptValidationIssues(
    options: ManuscriptExportOptions,
    sections: [Section],
    format: ExportFormat
  ) -> [ExportValidationIssue] {
    var issues: [ExportValidationIssue] = []
    if options.profile == .submission {
      if ![ExportFormat.docx, .pdf, .rtf].contains(format) {
        issues.append(ExportValidationIssue(severity: .error, message: "Format \"\(format.rawValue)\" is not standard for submission. Use DOCX, PDF, or RTF."))
      }
      if options.fontSizePt < 12 {
        issues.append(ExportValidationIssue(severity: .warning, message: "Font size \(formatNumber(options.fontSizePt))pt is below the recommended 12pt minimum."))
      }
      if options.lineSpacing != 2 {
        issues.append(ExportValidationIssue(severity: .warning, message: "Line spacing is \(formatNumber(options.lineSpacing)). Double spacing (2.0) is the standard default."))
      }
      if options.paragraphSpacingBeforePt != 0 || options.paragraphSpacingAfterPt != 0 {
        issues.append(ExportValidationIssue(severity: .error, message: "Extra paragraph spacing detected. Submission manuscripts should use first-line indents, not paragraph spacing."))
      }
      if !options.pageNumbering {
        issues.append(ExportValidationIssue(severity: .error, message: "Page numbering is disabled. Submissions require numbered pages."))
      }
      if options.headerContent.authorSurname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        options.headerContent.shortTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        issues.append(ExportValidationIssue(severity: .warning, message: "Header is missing author surname or short title. Many agents expect these in the page header."))
      }
      if !options.chapterStartsNewPage {
        issues.append(ExportValidationIssue(severity: .error, message: "Chapters do not start on new pages. This is expected for submission manuscripts."))
      }
      if options.marginIn < 0.75 || options.marginIn > 1.25 {
        issues.append(ExportValidationIssue(severity: .warning, message: "Margin of \(formatNumber(options.marginIn))\" is outside the standard range (0.75\"-1.25\")."))
      }
      if options.firstLineIndentIn < 0.3 || options.firstLineIndentIn > 0.5 {
        issues.append(ExportValidationIssue(severity: .warning, message: "First-line indent of \(formatNumber(options.firstLineIndentIn))\" is outside the standard range (0.3\"-0.5\")."))
      }
      if !options.includeTitlePage || options.authorName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        issues.append(ExportValidationIssue(severity: .info, message: "Consider adding a title page with your name for agent/editor submissions."))
      }
    }
    if options.profile == .print, options.pageSize != .a4, options.pageSize != .letter {
      issues.append(ExportValidationIssue(severity: .warning, message: "Print exports should use a standard page size."))
    }
    let hasContent = sections.contains { MarkdownTools.wordCount($0.content ?? "") > 0 }
    if !hasContent {
      issues.append(ExportValidationIssue(severity: .warning, message: "No chapters with content found. Add content before exporting."))
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
    documentXML(title: title, sections: sections, request: ExportRequest(format: .docx))
  }

  public static func documentXML(title: String, sections: [Section], request: ExportRequest) -> String {
    let options = request.manuscriptOptions
    let bodyParagraphProperties = options.map { paragraphProperties($0) }
    var leading: [String] = []
    if options?.includeTitlePage == true {
      leading.append(paragraph(title, style: "Title"))
      if options?.authorName.isEmpty == false {
        leading.append(paragraph(options?.authorName ?? ""))
      }
      leading.append(pageBreak())
    } else {
      leading.append(paragraph(title, style: "Title"))
    }

    let paragraphs = sections.flatMap { section -> [String] in
      let heading = request.includeHeadings && (options?.includeHeadings ?? true) ? [paragraph(section.title, style: "Heading1")] : []
      let body = (section.content ?? "")
        .replacingOccurrences(of: "\r\n", with: "\n")
        .components(separatedBy: "\n")
        .map { paragraph(MarkdownTools.plainText(from: $0), properties: bodyParagraphProperties) }
      let breakBefore = options?.chapterStartsNewPage == true ? [pageBreak()] : []
      return breakBefore + heading + body
    }.joined()
    let sectionProperties = sectionProperties(options)

    return """
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        \(leading.joined())
        \(paragraphs)
        \(sectionProperties)
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

  private static func paragraph(_ text: String, style: String? = nil, properties: String? = nil) -> String {
    let styleXML = style.map { "<w:pStyle w:val=\"\($0)\"/>" } ?? ""
    let propertiesXML = [styleXML, properties ?? ""].filter { !$0.isEmpty }.joined()
    let paragraphProperties = propertiesXML.isEmpty ? "" : "<w:pPr>\(propertiesXML)</w:pPr>"
    return "<w:p>\(paragraphProperties)<w:r><w:t xml:space=\"preserve\">\(text.xmlEscaped)</w:t></w:r></w:p>"
  }

  private static func pageBreak() -> String {
    "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>"
  }

  private static func paragraphProperties(_ options: ManuscriptExportOptions) -> String {
    let line = max(240, Int((options.lineSpacing * 240).rounded()))
    let before = max(0, Int((options.paragraphSpacingBeforePt * 20).rounded()))
    let after = max(0, Int((options.paragraphSpacingAfterPt * 20).rounded()))
    let firstLine = max(0, Int((options.firstLineIndentIn * 1440).rounded()))
    let justification: String
    switch options.alignment {
    case .left:
      justification = "left"
    case .center:
      justification = "center"
    case .right:
      justification = "right"
    case .justified:
      justification = "both"
    }
    return "<w:spacing w:before=\"\(before)\" w:after=\"\(after)\" w:line=\"\(line)\" w:lineRule=\"auto\"/><w:ind w:firstLine=\"\(firstLine)\"/><w:jc w:val=\"\(justification)\"/>"
  }

  private static func sectionProperties(_ options: ManuscriptExportOptions?) -> String {
    let pageSize = options?.pageSize ?? .letter
    let size: (width: Int, height: Int)
    switch pageSize {
    case .letter:
      size = (12_240, 15_840)
    case .a4:
      size = (11_906, 16_838)
    }
    let margin = max(0, Int(((options?.marginIn ?? 1) * 1440).rounded()))
    return "<w:sectPr><w:pgSz w:w=\"\(size.width)\" w:h=\"\(size.height)\"/><w:pgMar w:top=\"\(margin)\" w:right=\"\(margin)\" w:bottom=\"\(margin)\" w:left=\"\(margin)\"/></w:sectPr>"
  }
}

private func manuscriptPlainText(_ envelope: DhprojEnvelope, request: ExportRequest) -> String {
  let options = request.manuscriptOptions
  var parts: [String] = []
  if options?.includeTitlePage == true {
    parts.append([
      envelope.project.title,
      options?.authorName.isEmpty == false ? "by \(options?.authorName ?? "")" : nil,
      "\(AnalyticsEngine.metrics(for: envelope).totalWords) words"
    ].compactMap { $0 }.joined(separator: "\n\n"))
  }
  for section in envelope.sections {
    if request.includeHeadings && (options?.includeHeadings ?? true) {
      parts.append(section.title)
    }
    let body = MarkdownTools.plainText(from: section.content ?? "")
      .replacingOccurrences(of: "\n---\n", with: "\n\(options?.sceneBreakMarker ?? "* * *")\n")
    if !body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      parts.append(body)
    }
  }
  return parts.joined(separator: options?.chapterStartsNewPage == true ? "\n\n\n" : "\n\n")
}

private func exportFont(_ name: String?, size: CGFloat) -> NSFont {
  if let name, let font = NSFont(name: name, size: size) {
    return font
  }
  return NSFont(name: "Times New Roman", size: size) ?? NSFont.systemFont(ofSize: size)
}

private func manuscriptMargins(_ options: ManuscriptExportOptions) -> NSEdgeInsets {
  let value = CGFloat(options.marginIn * 72)
  return NSEdgeInsets(top: value, left: value, bottom: value, right: value)
}

private func manuscriptHeader(_ options: ManuscriptExportOptions?) -> String? {
  guard let options else { return nil }
  let surname = options.headerContent.authorSurname.trimmingCharacters(in: .whitespacesAndNewlines)
  let title = options.headerContent.shortTitle.trimmingCharacters(in: .whitespacesAndNewlines)
  guard !surname.isEmpty || !title.isEmpty else { return nil }
  return [surname, title].filter { !$0.isEmpty }.joined(separator: " / ")
}

private func formatNumber(_ value: Double) -> String {
  value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
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
