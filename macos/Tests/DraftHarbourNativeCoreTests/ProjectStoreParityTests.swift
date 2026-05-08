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

  func testRecoveryServiceSavesRestoresRecentMetadataAndClears() throws {
    let fileManager = FileManager.default
    let temp = fileManager.temporaryDirectory.appendingPathComponent("DraftHarbourRecovery-\(UUID().uuidString)", isDirectory: true)
    let defaultsName = "DraftHarbourRecoveryTests.\(UUID().uuidString)"
    let defaults = try XCTUnwrap(UserDefaults(suiteName: defaultsName))
    defer {
      try? fileManager.removeItem(at: temp)
      defaults.removePersistentDomain(forName: defaultsName)
    }

    var envelope = DhprojCodec.newProject(title: "Recovery")
    envelope.sections[0].content = "Recovered draft"
    let service = SessionRecoveryService(baseDirectory: temp, defaults: defaults)
    let documentURL = temp.appendingPathComponent("Recovery.dhproj")
    try fileManager.createDirectory(at: temp, withIntermediateDirectories: true)
    try Data("saved".utf8).write(to: documentURL)
    try fileManager.setAttributes([.modificationDate: Date(timeIntervalSince1970: 1)], ofItemAtPath: documentURL.path)

    let snapshot = try service.save(envelope: envelope, activeSectionID: envelope.sections[0].id, sourceURL: documentURL)
    let loaded = try XCTUnwrap(try service.load(projectId: envelope.project.id))
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Blank"))
    store.replaceEnvelope(loaded.envelope, activeSectionID: loaded.activeSectionID)

    XCTAssertEqual(snapshot.sourceURL, documentURL.path)
    XCTAssertTrue(service.shouldOfferRestore(snapshot, documentURL: documentURL))
    XCTAssertEqual(store.activeSection?.content, "Recovered draft")

    try fileManager.setAttributes(
      [.modificationDate: Date(timeIntervalSince1970: Double(snapshot.savedAt) / 1_000 + 60)],
      ofItemAtPath: documentURL.path
    )
    XCTAssertFalse(service.shouldOfferRestore(snapshot, documentURL: documentURL))

    service.recordLastOpenedProjectURL(documentURL)
    let missingURL = temp.appendingPathComponent("Missing.dhproj")
    service.recordLastOpenedProjectURL(missingURL)
    service.pinProjectURL(documentURL)
    XCTAssertTrue(service.isProjectPinned(documentURL))
    service.recordActiveSectionID(envelope.sections[0].id, projectId: envelope.project.id)
    XCTAssertEqual(service.recentProjectURLs().first?.path, missingURL.path)
    XCTAssertEqual(service.pruneMissingRecentProjectURLs().map(\.path), [documentURL.path])
    XCTAssertEqual(service.pinnedProjectURLs().map(\.path), [documentURL.path])
    service.toggleProjectPin(documentURL)
    XCTAssertFalse(service.isProjectPinned(documentURL))
    service.toggleProjectPin(documentURL)
    service.removeRecentProjectURL(documentURL)
    XCTAssertTrue(service.recentProjectURLs().isEmpty)
    XCTAssertTrue(service.pinnedProjectURLs().isEmpty)
    XCTAssertEqual(service.activeSectionID(projectId: envelope.project.id), envelope.sections[0].id)

    try service.clear(projectId: envelope.project.id)
    XCTAssertNil(try service.load(projectId: envelope.project.id))
  }

  func testStoreAppliesSyncResultsAndConflictResolutionOptions() {
    var envelope = DhprojCodec.newProject(title: "Sync")
    envelope.sections[0].id = "section-1"
    envelope.sections[0].title = "Chapter"
    envelope.sections[0].content = "local"
    let store = ProjectStore(envelope: envelope)

    var remote = envelope
    remote.sections[0].content = "remote"
    store.applySyncResult(IntegrationResult(provider: .genericREST, message: "Pulled", pulledEnvelope: remote))
    XCTAssertEqual(store.activeSection?.content, "remote")
    XCTAssertEqual(store.integrationConfig(for: .genericREST).status, "Pulled")
    XCTAssertNotNil(store.integrationConfig(for: .genericREST).lastSyncAt)

    store.updateActiveSectionContent("local")
    let conflict = ConflictInfo(
      chapterId: "section-1",
      provider: .genericREST,
      localContent: "local",
      remoteContent: "remote",
      baseContent: "base",
      localUpdatedAt: 10,
      remoteUpdatedAt: 20
    )

    store.resolveConflict(conflict, option: .keepLocal)
    XCTAssertEqual(store.activeSection?.content, "local")
    store.resolveConflict(conflict, option: .useRemote)
    XCTAssertEqual(store.activeSection?.content, "remote")

    let beforeCount = store.envelope.sections.count
    store.resolveConflict(conflict, option: .keepBoth)
    XCTAssertEqual(store.envelope.sections.count, beforeCount + 1)
    XCTAssertTrue(store.envelope.sections.contains { $0.title == "Chapter (Remote)" && $0.content == "remote" })
  }
}
