import DraftHarbourNativeCore
import XCTest

final class ProjectStoreParityTests: XCTestCase {
  func testStoreHandlesWriterCoreParityMutations() throws {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Parity", projectType: .screenplay))
    store.updateProjectTitle("Native Parity")
    store.updateSettings { settings in
      settings.dailyWordGoal = 1_500
      settings.typewriterMode = true
    }

    store.updateActiveSectionContent("INT. ROOM - DAY\n@JULES\nhello")
    store.applyMarkdownCommand(.bold, range: NSRange(location: 17, length: 5))
    XCTAssertTrue(store.activeSection?.content?.contains("**JULES**") == true)

    let scene = try store.createScene()
    store.updateScene(sectionID: store.activeSectionID!, sceneID: scene.id) { current in
      current.title = "Opening Beat"
      current.location = "Harbour"
    }
    XCTAssertEqual(store.activeSection?.scenes.first?.location, "Harbour")

    let snapshot = try store.createSnapshot(label: "Before")
    store.updateActiveSectionContent("Changed")
    try store.restoreSnapshot(id: snapshot.id)
    XCTAssertEqual(store.activeSection?.content, "INT. ROOM - DAY\n@**JULES**\nhello")

    let thread = try store.addComment(text: "Clarify", from: 0, to: 3, selectedText: "INT")
    try store.addCommentReply(threadID: thread.id, text: "Done")
    try store.resolveCommentThread(threadID: thread.id, resolved: true)
    XCTAssertEqual(store.envelope.commentThreads.first?.comments.count, 2)
    XCTAssertTrue(store.envelope.commentThreads.first?.resolved == true)
    XCTAssertEqual(store.envelope.project.title, "Native Parity")
    XCTAssertEqual(store.envelope.settings.dailyWordGoal, 1_500)
  }

  func testSectionReorderUndoRedo() {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Reorder"))
    let first = store.activeSectionID!
    let second = store.createSection().id
    let third = store.createSection().id

    store.reorderSections(ids: [third, first, second])
    XCTAssertEqual(store.envelope.sections.map(\.id), [third, first, second])
    XCTAssertTrue(store.canUndoSectionReorder)

    store.undoSectionReorder()
    XCTAssertEqual(store.envelope.sections.map(\.id), [first, second, third])
    XCTAssertTrue(store.canRedoSectionReorder)

    store.redoSectionReorder()
    XCTAssertEqual(store.envelope.sections.map(\.id), [third, first, second])
  }
}
