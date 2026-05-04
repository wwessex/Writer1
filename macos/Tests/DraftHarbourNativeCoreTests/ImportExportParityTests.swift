import DraftHarbourNativeCore
import XCTest

final class ImportExportParityTests: XCTestCase {
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
