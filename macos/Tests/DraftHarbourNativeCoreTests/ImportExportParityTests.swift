import AppKit
import DraftHarbourNativeCore
import XCTest

final class ImportExportParityTests: XCTestCase {
  func testSupportedImportsAppendSectionsAndPreserveProjectMetadata() throws {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Import", projectType: .book))
    let projectId = store.envelope.project.id
    var docxEnvelope = DhprojCodec.newProject(title: "DOCX", projectType: .book)
    docxEnvelope.sections[0].title = "Chapter DOCX"
    docxEnvelope.sections[0].content = "DOCX body"
    let docx = try DOCXExporter().export(docxEnvelope)
    let rtf = try NSAttributedString(string: "Chapter RTF\n\nRTF body").data(
      from: NSRange(location: 0, length: "Chapter RTF\n\nRTF body".count),
      documentAttributes: [.documentType: NSAttributedString.DocumentType.rtf]
    )

    let samples: [(String, Data)] = [
      ("plain.txt", Data("Chapter TXT\n\nPlain body".utf8)),
      ("markdown.md", Data("Chapter Markdown\n\n**Markdown** body".utf8)),
      ("script.fountain", Data("INT. ROOM - DAY\n\nAction.".utf8)),
      ("rich.rtf", rtf),
      ("word.docx", docx.data)
    ]

    var noticeMessages: [String] = []
    for sample in samples {
      let result = try ImporterRegistry.importer(for: sample.0).importDocument(
        data: sample.1,
        filename: sample.0,
        projectId: projectId,
        projectType: store.projectType
      )
      let beforeCount = store.envelope.sections.count
      let insertedIDs = store.importSections(result.sections, selectFirst: true)
      noticeMessages.append(contentsOf: result.notices.map(\.message))

      XCTAssertFalse(insertedIDs.isEmpty, sample.0)
      XCTAssertEqual(store.activeSectionID, insertedIDs.first)
      XCTAssertEqual(store.envelope.sections.count, beforeCount + insertedIDs.count)
      XCTAssertTrue(store.envelope.sections.suffix(insertedIDs.count).allSatisfy { $0.novelId == projectId })
    }

    XCTAssertEqual(store.envelope.project.id, projectId)
    XCTAssertEqual(store.projectType, .book)
    XCTAssertEqual(store.envelope.sections.map(\.order), Array(0..<store.envelope.sections.count))
    XCTAssertTrue(noticeMessages.contains { $0.contains("DOCX styles") })
  }

  func testDocxExportCanBeImportedBackIntoSections() throws {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "DOCX Round Trip"))
    store.updateActiveSectionTitle("Chapter One")
    store.updateActiveSectionContent("First paragraph.\n\nSecond paragraph.")

    let exported = try DOCXExporter().export(store.envelope)
    XCTAssertEqual(exported.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    let imported = try DOCXImporter().importDocument(
      data: exported.data,
      filename: exported.filename,
      projectId: store.envelope.project.id,
      projectType: .book
    )

    XCTAssertFalse(imported.sections.isEmpty)
    XCTAssertTrue(imported.sections.map { $0.content ?? "" }.joined(separator: "\n").contains("First paragraph."))
    XCTAssertEqual(imported.notices.first?.severity, .info)
  }

  func testFountainImportAndScreenplayExportStayScreenplayAware() throws {
    let input = """
    INT. HARBOUR - NIGHT
    @JULES
    We keep the lights on.
    > CUT TO:
    """

    let imported = try FountainImporter().importDocument(
      data: Data(input.utf8),
      filename: "sample.fountain",
      projectId: "project-1",
      projectType: .screenplay
    )
    XCTAssertEqual(imported.sections.first?.title, "INT. HARBOUR - NIGHT")

    var envelope = DhprojCodec.newProject(title: "Screen", projectType: .screenplay)
    envelope.sections = imported.sections
    let fountain = try FountainExporter().export(envelope)
    let text = String(decoding: fountain.data, as: UTF8.self)
    XCTAssertTrue(text.contains("INT. HARBOUR - NIGHT"))
    XCTAssertTrue(ExportValidator.validate(envelope, format: .screenplayPdf).isEmpty)
  }

  func testPublishingBundleContainsProjectMetadata() throws {
    let envelope = DhprojCodec.newProject(title: "Bundle")
    let exported = try PublishingBundleExporter().export(envelope)
    XCTAssertEqual(exported.filename, "Bundle-publishing-bundle.json")
    let payload = try JSONDecoder().decode([String: JSONValue].self, from: exported.data)
    XCTAssertEqual(payload["title"], .string("Bundle"))
    XCTAssertEqual(payload["projectType"], .string("book"))
  }

  func testEveryExportMenuFormatProducesAFile() throws {
    for format in ExportFormat.allCases {
      let envelope = format == .screenplayPdf || format == .fountain
        ? screenplayEnvelope(paragraphCount: 2)
        : bookEnvelope()
      let exported = try ExporterRegistry.exporter(for: format).export(envelope)

      XCTAssertFalse(exported.filename.isEmpty, format.rawValue)
      XCTAssertFalse(exported.contentType.isEmpty, format.rawValue)
      XCTAssertFalse(exported.data.isEmpty, format.rawValue)
    }
  }

  func testLongPDFExportsPaginateInsteadOfTruncating() throws {
    var envelope = DhprojCodec.newProject(title: "Long PDF")
    envelope.sections[0].title = "Chapter One"
    envelope.sections[0].content = (0..<240)
      .map { "Paragraph \($0). This is a long manuscript line that should flow onto later pages." }
      .joined(separator: "\n\n")

    let pdf = try PDFExporter().export(envelope)
    let screenplay = try ScreenplayPDFExporter().export(screenplayEnvelope(paragraphCount: 180))

    XCTAssertGreaterThan(pageCount(pdf.data), 1)
    XCTAssertGreaterThan(pageCount(screenplay.data), 1)
  }

  func testLongFormattedExportsRoundTripUsableText() throws {
    var envelope = DhprojCodec.newProject(title: "Long Round Trip")
    envelope.sections[0].title = "Chapter One"
    envelope.sections[0].content = (0..<80)
      .map { "Long manuscript line \($0) with **bold** markers and export-safe text." }
      .joined(separator: "\n\n")

    let docx = try DOCXExporter().export(envelope)
    let rtf = try RTFExporter().export(envelope)
    let fountain = try FountainExporter().export(screenplayEnvelope(paragraphCount: 12))

    let importedDocx = try DOCXImporter().importDocument(data: docx.data, filename: docx.filename, projectId: envelope.project.id, projectType: .book)
    let importedRTF = try RTFImporter().importDocument(data: rtf.data, filename: rtf.filename, projectId: envelope.project.id, projectType: .book)
    let fountainText = String(decoding: fountain.data, as: UTF8.self)

    XCTAssertTrue(importedDocx.sections.map { $0.content ?? "" }.joined(separator: "\n").contains("Long manuscript line 79"))
    XCTAssertTrue(importedRTF.sections.map { $0.content ?? "" }.joined(separator: "\n").contains("Long manuscript line 79"))
    XCTAssertTrue(fountainText.contains("INT. ROOM 11 - DAY"))
  }

  private func pageCount(_ data: Data) -> Int {
    guard let provider = CGDataProvider(data: data as CFData), let document = CGPDFDocument(provider) else {
      return 0
    }
    return document.numberOfPages
  }

  private func screenplayEnvelope(paragraphCount: Int) -> DhprojEnvelope {
    var envelope = DhprojCodec.newProject(title: "Long Screenplay", projectType: .screenplay)
    envelope.sections[0].content = (0..<paragraphCount)
      .map { index in
        """
        INT. ROOM \(index) - DAY

        Action beat \(index) stretches across the page with production-friendly text.

        @JULES
        We keep moving.
        """
      }
      .joined(separator: "\n\n")
    return envelope
  }

  private func bookEnvelope() -> DhprojEnvelope {
    var envelope = DhprojCodec.newProject(title: "Export Menu")
    envelope.sections[0].title = "Chapter One"
    envelope.sections[0].summary = "A chapter prepared for export checks."
    envelope.sections[0].tags = ["draft", "native"]
    envelope.sections[0].content = """
    This chapter gives every native exporter enough manuscript text to produce a useful file.

    It includes a second paragraph so rich text, PDF, DOCX, Markdown, plain text, and bundle exports all have body content.
    """
    return envelope
  }
}
