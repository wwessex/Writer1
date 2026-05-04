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
}
