import DraftHarbourNativeCore
import XCTest

final class ProjectStoreTests: XCTestCase {
  func testCreatesUpdatesSnapshotsAndDeletesSections() throws {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Store Test"))

    XCTAssertEqual(store.envelope.sections.count, 1)
    store.updateActiveSectionTitle("Opening")
    store.updateActiveSectionContent("One two three.")
    XCTAssertEqual(store.activeSection?.title, "Opening")
    XCTAssertEqual(store.metrics.totalWords, 3)

    let snapshot = try store.createSnapshot(label: "Before rewrite")
    XCTAssertEqual(snapshot.doc, "One two three.")
    XCTAssertEqual(store.envelope.snapshots.count, 1)

    let second = store.createSection()
    XCTAssertEqual(store.activeSectionID, second.id)
    XCTAssertEqual(store.envelope.sections.count, 2)

    try store.deleteSection(id: second.id)
    XCTAssertEqual(store.envelope.sections.count, 1)
    XCTAssertEqual(store.activeSection?.title, "Opening")
  }

  func testAddsCommentsAndStoryBibleEntries() throws {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Comments"))
    store.updateActiveSectionContent("A selected sentence.")

    let thread = try store.addComment(text: "Clarify this", from: 2, to: 10, selectedText: "selected")
    XCTAssertEqual(thread.comments.first?.text, "Clarify this")
    XCTAssertEqual(store.envelope.commentThreads.count, 1)

    store.addCharacter(name: "Jules")
    store.addWorldEntry(name: "Harbour", category: "location")
    XCTAssertEqual(store.envelope.characters.first?.name, "Jules")
    XCTAssertEqual(store.envelope.worldEntries.first?.category, "location")
  }
}
