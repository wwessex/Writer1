import AppKit
import Foundation

public enum ExportFormat: String, CaseIterable, Sendable {
  case markdown
  case plainText = "txt"
  case fountain
  case rtf
  case pdf
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

public struct UnsupportedExporter: Exporter {
  public var format: ExportFormat

  public init(format: ExportFormat) {
    self.format = format
  }

  public func export(_ envelope: DhprojEnvelope) throws -> ExportedFile {
    throw DraftHarbourError.featurePlanned("\(format.rawValue.uppercased()) export")
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
    case .docx, .publishingBundle:
      return UnsupportedExporter(format: format)
    }
  }
}

private func safeFilename(_ title: String) -> String {
  let invalid = CharacterSet(charactersIn: "/\\?%*|\"<>:")
  let components = title.components(separatedBy: invalid).filter { !$0.isEmpty }
  let joined = components.joined(separator: "-").trimmingCharacters(in: .whitespacesAndNewlines)
  return joined.isEmpty ? "DraftHarbour Project" : joined
}
