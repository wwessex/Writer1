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

  func testWritingSessionsRecordProgressAndSectionMetadata() throws {
    var envelope = DhprojCodec.newProject(title: "Progress")
    envelope.settings.dailyWordGoal = 5
    let store = ProjectStore(envelope: envelope)

    let session = store.startWritingSession(startedAt: 1_000)
    XCTAssertEqual(session.startingWordCount, 0)
    store.updateActiveSectionContent("one two three four five six")

    let result = try XCTUnwrap(store.stopWritingSession(date: "2026-05-07", endedAt: 2_000))
    XCTAssertEqual(result.wordsWritten, 6)
    XCTAssertNil(store.writingSession)
    XCTAssertEqual(store.progress(for: "2026-05-07")?.wordsWritten, 6)
    XCTAssertEqual(store.progress(for: "2026-05-07")?.sessions, 1)
    XCTAssertEqual(store.progress(for: "2026-05-07")?.goalMet, true)
    XCTAssertEqual(store.envelope.progress?.streak.current, 1)

    _ = store.startWritingSession(startedAt: 3_000)
    store.updateActiveSectionContent("one two three four five six seven eight")
    _ = store.stopWritingSession(date: "2026-05-07", endedAt: 4_000)
    XCTAssertEqual(store.progress(for: "2026-05-07")?.wordsWritten, 8)
    XCTAssertEqual(store.progress(for: "2026-05-07")?.sessions, 2)

    store.updateActiveSectionPOV("Jules")
    store.updateActiveSectionWordGoal(1_200)
    store.updateActiveSectionTags(["draft", "native"])
    store.updateActiveSectionPart("Part One")
    store.updateActiveSectionAct(2)
    store.updateActiveSectionSequence(7)

    XCTAssertEqual(store.activeSection?.pov, "Jules")
    XCTAssertEqual(store.activeSection?.wordGoal, 1_200)
    XCTAssertEqual(store.activeSection?.tags, ["draft", "native"])
    XCTAssertEqual(store.activeSection?.part, "Part One")
    XCTAssertEqual(store.activeSection?.act, 2)
    XCTAssertEqual(store.activeSection?.sequence, 7)
  }

  func testGeneratedTextAppliesToSelectionAndRecordsRevision() throws {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "AI Apply"))
    let sectionID = try XCTUnwrap(store.activeSectionID)
    store.updateActiveSectionContent("Old sentence. Keep this.")
    store.applyGeneratedText("New sentence.", mode: .replace, range: NSRange(location: 0, length: 13))
    XCTAssertEqual(store.activeSection?.content, "New sentence. Keep this.")

    store.recordAIRevision(sectionID: sectionID, providerId: "provider", prompt: "Revise", before: "Old", after: store.activeSection?.content ?? "")
    XCTAssertEqual(store.envelope.aiRevisionLog.first?.providerId, "provider")
  }
}
