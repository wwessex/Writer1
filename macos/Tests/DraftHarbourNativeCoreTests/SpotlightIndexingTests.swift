import DraftHarbourNativeCore
import XCTest

final class SpotlightIndexingTests: XCTestCase {
  func testMetadataOnlyIndexesProjectAndSectionsWithoutBodyText() {
    var envelope = DhprojCodec.newProject(title: "Private Project")
    envelope.project.id = "project-spotlight"
    envelope.sections[0].id = "section-secret"
    envelope.sections[0].title = "Opening"
    envelope.sections[0].summary = "This summary should stay out of metadata indexing."
    envelope.sections[0].content = "The launch code is hidden in the manuscript."
    envelope.sections[0].tags = ["draft"]

    let fileURL = URL(fileURLWithPath: "/tmp/Private Project.dhproj")
    let items = SpotlightIndexingService.items(for: envelope, fileURL: fileURL, level: .metadataOnly)

    XCTAssertEqual(items.count, 2)
    XCTAssertEqual(items.first?.uniqueIdentifier, "draftharbour://project/project-spotlight")
    XCTAssertEqual(items.last?.uniqueIdentifier, "draftharbour://project/project-spotlight/section/section-secret")
    XCTAssertEqual(items.last?.title, "Opening")
    XCTAssertTrue(items.last?.keywords.contains("draft") == true)
    XCTAssertFalse(items.map(\.contentDescription).joined(separator: " ").contains("launch code"))
    XCTAssertFalse(items.map(\.contentDescription).joined(separator: " ").contains("summary should stay out"))
  }

  func testFullTextIndexesSectionSummaryAndBodyText() {
    var envelope = DhprojCodec.newProject(title: "Full Text Project")
    envelope.sections[0].summary = "Harbour clue summary."
    envelope.sections[0].content = "A lantern swings above the full-text clue."

    let items = SpotlightIndexingService.items(for: envelope, fileURL: nil, level: .fullText)
    let section = items.last

    XCTAssertTrue(section?.contentDescription.contains("Harbour clue summary.") == true)
    XCTAssertTrue(section?.contentDescription.contains("full-text clue") == true)
  }

  func testOffReturnsNoItemsAndStorageDefaultsToMetadataOnly() {
    let envelope = DhprojCodec.newProject(title: "No Index")

    XCTAssertEqual(SpotlightIndexingService.items(for: envelope, fileURL: nil, level: .off), [])
    XCTAssertEqual(SpotlightIndexingLevel(storageValue: nil), .metadataOnly)
    XCTAssertEqual(SpotlightIndexingLevel(storageValue: "unexpected"), .metadataOnly)
  }
}
