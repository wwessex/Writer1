import DraftHarbourNativeCore
import XCTest

final class AIChatTests: XCTestCase {
  func testAppleFoundationAvailabilityMappingDoesNotRequireAppleIntelligence() {
    XCTAssertEqual(AppleFoundationModelsProvider.availabilityStatus(for: .available), .available)
    XCTAssertEqual(AppleFoundationModelsProvider.availabilityStatus(for: .deviceNotEligible), .deviceNotEligible)
    XCTAssertEqual(AppleFoundationModelsProvider.availabilityStatus(for: .appleIntelligenceNotEnabled), .appleIntelligenceDisabled)
    XCTAssertEqual(AppleFoundationModelsProvider.availabilityStatus(for: .modelNotReady), .modelNotReady)
    XCTAssertEqual(AppleFoundationModelsProvider.availabilityStatus(for: .unavailable), .unavailable)
  }

  func testProjectContextIndexesAllSectionsAndStoryBible() {
    var envelope = DhprojCodec.newProject(title: "Context")
    envelope.sections[0].id = "chapter-1"
    envelope.sections[0].title = "Opening"
    envelope.sections[0].content = "Mara finds the brass compass under the pier."
    envelope.sections.append(Section(id: "chapter-2", novelId: envelope.project.id, order: 1, title: "Return", content: "The compass points back to Greyhaven."))
    envelope.characters = [CharacterEntity(novelId: envelope.project.id, name: "Mara", description: "A cartographer.", role: "protagonist")]
    envelope.worldEntries = [WorldEntry(novelId: envelope.project.id, category: "location", name: "Greyhaven", description: "A coastal city.")]

    let context = AIProjectContextService.index(for: envelope)

    XCTAssertEqual(context.sections.count, 2)
    XCTAssertTrue(context.sectionMap().contains("chapter-2"))
    XCTAssertTrue(context.storyBibleText().contains("Mara"))
    XCTAssertTrue(context.storyBibleText().contains("Greyhaven"))
    XCTAssertTrue(context.search("compass", limit: 3).contains { $0.id == "chapter-1" })
    XCTAssertEqual(context.sectionChunk(sectionId: "chapter-2", start: 4, length: 7), "compass")
  }

  func testLocalCharacterScanChecksManuscriptWhenStoryBibleIsEmpty() {
    var envelope = DhprojCodec.newProject(title: "Characters")
    envelope.sections[0].id = "chapter-1"
    envelope.sections[0].title = "Prologue"
    envelope.sections[0].content = "Mara met Jules at the pier. Jules warned Mara before Captain Vale arrived."
    envelope.sections.append(Section(id: "chapter-2", novelId: envelope.project.id, order: 1, title: "Crossing", content: "Captain Vale followed Mara through the rain."))

    let context = AIProjectContextService.index(for: envelope)
    let names = Set(context.manuscriptCharacterCandidates().map(\.name))
    let result = AIChatService.localCharacterScanResponse(prompt: "analyse the chapers for chacters", context: context)

    XCTAssertTrue(AIChatService.shouldAnswerWithLocalCharacterScan("analyse the chapers for chacters"))
    XCTAssertFalse(AIChatService.shouldAnswerWithLocalCharacterScan("Find each of these characters and their details and add them to story bible"))
    XCTAssertTrue(AIChatService.shouldAddCharactersToStoryBible("Find each of these characters and their details and add them to story bible"))
    XCTAssertTrue(names.contains("Mara"))
    XCTAssertTrue(names.contains("Jules"))
    XCTAssertTrue(names.contains("Captain Vale"))
    XCTAssertEqual(result.providerId, "local-manuscript-scan")
    XCTAssertTrue(result.reply.contains("I checked all 2 chapters"))
    XCTAssertTrue(result.reply.contains("story bible currently has 0"))
  }

  func testAddsManuscriptCharacterCandidatesToStoryBible() {
    var envelope = DhprojCodec.newProject(title: "Characters")
    envelope.sections[0].id = "chapter-1"
    envelope.sections[0].title = "Prologue"
    envelope.sections[0].content = "Now Mara met Jules at the pier. For Jules, the warning mattered. Judge watched Mara before Captain Vale arrived. Don’t follow, Mara thought. Maybe Jules saw the red door at Fairview."
    envelope.sections.append(Section(id: "chapter-2", novelId: envelope.project.id, order: 1, title: "Crossing", content: "In the rain, Captain Vale followed Mara. You should wait, Jules said. Probably, Judge knew the Hellfire Club. OK, come back later."))
    let store = ProjectStore(envelope: envelope)
    let context = AIProjectContextService.index(for: store.envelope)

    let added = store.addAICharacterCandidatesToStoryBible(context.manuscriptCharacterCandidates(limit: 20))
    let addedAgain = store.addAICharacterCandidatesToStoryBible(context.manuscriptCharacterCandidates(limit: 20))
    let names = Set(store.envelope.characters.map(\.name))
    let reply = AIChatService.storyBibleAddResponse(
      addedCharacters: added,
      candidates: context.manuscriptCharacterCandidates(limit: 20),
      checkedSectionCount: context.sections.count,
      projectType: context.projectType
    )

    XCTAssertTrue(names.contains("Mara"))
    XCTAssertTrue(names.contains("Jules"))
    XCTAssertTrue(names.contains("Captain Vale"))
    XCTAssertTrue(names.contains("Judge"))
    XCTAssertFalse(names.contains("Now"))
    XCTAssertFalse(names.contains("Don"))
    XCTAssertFalse(names.contains("For"))
    XCTAssertFalse(names.contains("In"))
    XCTAssertFalse(names.contains("You"))
    XCTAssertFalse(names.contains("Maybe"))
    XCTAssertFalse(names.contains("Probably"))
    XCTAssertFalse(names.contains("Fairview"))
    XCTAssertFalse(names.contains("Hellfire Club"))
    XCTAssertEqual(addedAgain.count, 0)
    XCTAssertTrue(store.envelope.characters.allSatisfy { $0.notes.contains("Evidence:") })
    XCTAssertTrue(reply.contains("added 4 character entries"))
  }

  func testAddsManuscriptWorldCandidatesToStoryBible() {
    var envelope = DhprojCodec.newProject(title: "Worlds")
    envelope.sections[0].id = "chapter-1"
    envelope.sections[0].title = "Prologue"
    envelope.sections[0].content = "Mara drove to Gallows Court. Judge waited near Hellfire Club. They met at Fairview before dusk."
    envelope.sections.append(Section(id: "chapter-2", novelId: envelope.project.id, order: 1, title: "Return", content: "Jules returned from Gallows Court and hid inside Fairview. Hellfire Club watched the road."))
    envelope.characters = [
      CharacterEntity(novelId: envelope.project.id, name: "Mara"),
      CharacterEntity(novelId: envelope.project.id, name: "Jules"),
      CharacterEntity(novelId: envelope.project.id, name: "Judge")
    ]
    let store = ProjectStore(envelope: envelope)
    let context = AIProjectContextService.index(for: store.envelope)

    let candidates = context.manuscriptWorldCandidates(limit: 20)
    let added = store.addAIWorldCandidatesToStoryBible(candidates)
    let addedAgain = store.addAIWorldCandidatesToStoryBible(candidates)
    let names = Set(store.envelope.worldEntries.map(\.name))
    let categories = Dictionary(uniqueKeysWithValues: store.envelope.worldEntries.map { ($0.name, $0.category) })
    let reply = AIChatService.storyBibleWorldAddResponse(
      addedWorldEntries: added,
      candidates: candidates,
      checkedSectionCount: context.sections.count,
      projectType: context.projectType
    )

    XCTAssertTrue(AIChatService.shouldAddWorldEntriesToStoryBible("Find place and world names and add them to story bible as worlds"))
    XCTAssertTrue(names.contains("Gallows Court"))
    XCTAssertTrue(names.contains("Hellfire Club"))
    XCTAssertTrue(names.contains("Fairview"))
    XCTAssertFalse(names.contains("Mara"))
    XCTAssertFalse(names.contains("Jules"))
    XCTAssertFalse(names.contains("Judge"))
    XCTAssertEqual(categories["Gallows Court"], "location")
    XCTAssertEqual(categories["Fairview"], "location")
    XCTAssertEqual(categories["Hellfire Club"], "organisation")
    XCTAssertEqual(addedAgain.count, 0)
    XCTAssertTrue(store.envelope.worldEntries.allSatisfy { $0.notes.contains("Evidence:") })
    XCTAssertTrue(reply.contains("added 3 world entries"))
  }

  func testRemovesGeneratedFalsePositiveCharacterEntries() {
    var envelope = DhprojCodec.newProject(title: "Cleanup")
    envelope.characters = [
      CharacterEntity(novelId: envelope.project.id, name: "For", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Gallows Court", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Every", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Emf", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Even", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Fairview", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Maybe", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Red", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Probably", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Ok", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Somewhere", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Come", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Hellfire Club", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Like", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Judge", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "Mara", description: "Detected from manuscript scan.", traits: ["AI-detected"], notes: "AI manuscript scan: 7 mentions."),
      CharacterEntity(novelId: envelope.project.id, name: "For", description: "A deliberate manual entry.", traits: [], notes: "")
    ]
    let generatedFalsePositiveID = envelope.characters[0].id
    let generatedFalsePositiveIds = Set(envelope.characters[0...13].map(\.id))
    let manualEntryID = envelope.characters[16].id
    let store = ProjectStore(envelope: envelope)

    let removed = store.removeAICharacterFalsePositiveEntries()
    let remainingIds = Set(store.envelope.characters.map(\.id))

    XCTAssertEqual(Set(removed), generatedFalsePositiveIds)
    XCTAssertFalse(remainingIds.contains(generatedFalsePositiveID))
    XCTAssertTrue(remainingIds.contains(manualEntryID))
    XCTAssertTrue(store.envelope.characters.contains { $0.name == "Judge" })
    XCTAssertTrue(store.envelope.characters.contains { $0.name == "Mara" })
  }

  func testGenericChatResponseDecodesStructuredEditProposal() {
    var envelope = DhprojCodec.newProject(title: "Decode")
    envelope.sections[0].id = "chapter-1"
    envelope.sections[0].content = "The door was very old."
    let context = AIProjectContextService.index(for: envelope)
    let json = """
    {
      "reply": "I tightened one sentence.",
      "edits": [
        {
          "sectionId": "chapter-1",
          "utf16Start": 13,
          "utf16Length": 8,
          "originalText": "very old",
          "replacementText": "ancient",
          "rationale": "Tighter diction.",
          "baseRevision": \(envelope.sections[0].updatedAt)
        }
      ]
    }
    """

    let result = AIChatService.decodeGenericResponse(json, context: context, providerId: "mock", model: "writer")

    XCTAssertEqual(result.reply, "I tightened one sentence.")
    XCTAssertEqual(result.editProposals.count, 1)
    XCTAssertEqual(result.editProposals[0].sectionId, "chapter-1")
    XCTAssertEqual(result.editProposals[0].replacementText, "ancient")
  }

  func testAcceptingAIEditProposalCreatesSnapshotRevisionAndUpdatesText() throws {
    var envelope = DhprojCodec.newProject(title: "Apply")
    envelope.sections[0].id = "chapter-1"
    envelope.sections[0].content = "The door was very old."
    let store = ProjectStore(envelope: envelope)
    let thread = store.ensureAIChatThread(title: "Revise")
    let proposal = AIEditProposal(
      sectionId: "chapter-1",
      utf16Start: 13,
      utf16Length: 8,
      originalText: "very old",
      replacementText: "ancient",
      rationale: "Tighter diction.",
      baseRevision: envelope.sections[0].updatedAt
    )
    let message = try store.appendAIChatMessage(threadID: thread.id, role: .assistant, content: "Review this.", providerId: "mock", editProposals: [proposal])

    let status = try store.acceptAIEditProposal(threadID: thread.id, messageID: message.id, proposalID: proposal.id, providerId: "mock", prompt: "Tighten")

    XCTAssertEqual(status, .accepted)
    XCTAssertEqual(store.envelope.sections[0].content, "The door was ancient.")
    XCTAssertEqual(store.envelope.snapshots.first?.doc, "The door was very old.")
    XCTAssertEqual(store.envelope.aiRevisionLog.first?.providerId, "mock")
    XCTAssertEqual(store.envelope.aiChatThreads[0].messages[0].editProposals[0].status, .accepted)
  }

  func testStaleAIEditProposalDoesNotMutateText() throws {
    var envelope = DhprojCodec.newProject(title: "Stale")
    envelope.sections[0].id = "chapter-1"
    envelope.sections[0].content = "The door was new."
    let store = ProjectStore(envelope: envelope)
    let thread = store.ensureAIChatThread(title: "Revise")
    let proposal = AIEditProposal(
      sectionId: "chapter-1",
      utf16Start: 13,
      utf16Length: 3,
      originalText: "old",
      replacementText: "ancient",
      rationale: "Tighter diction.",
      baseRevision: envelope.sections[0].updatedAt
    )
    let message = try store.appendAIChatMessage(threadID: thread.id, role: .assistant, content: "Review this.", editProposals: [proposal])

    let status = try store.acceptAIEditProposal(threadID: thread.id, messageID: message.id, proposalID: proposal.id, providerId: "mock", prompt: "Tighten")

    XCTAssertEqual(status, .stale)
    XCTAssertEqual(store.envelope.sections[0].content, "The door was new.")
    XCTAssertTrue(store.envelope.snapshots.isEmpty)
    XCTAssertEqual(store.envelope.aiChatThreads[0].messages[0].editProposals[0].status, .stale)
  }

  func testAcceptAllAppliesSameSectionEditsFromEndToStart() throws {
    var envelope = DhprojCodec.newProject(title: "Batch")
    envelope.sections[0].id = "chapter-1"
    envelope.sections[0].content = "A old B old C"
    let store = ProjectStore(envelope: envelope)
    let thread = store.ensureAIChatThread(title: "Batch")
    let first = AIEditProposal(sectionId: "chapter-1", utf16Start: 2, utf16Length: 3, originalText: "old", replacementText: "new", rationale: "First.", baseRevision: envelope.sections[0].updatedAt)
    let second = AIEditProposal(sectionId: "chapter-1", utf16Start: 8, utf16Length: 3, originalText: "old", replacementText: "ancient", rationale: "Second.", baseRevision: envelope.sections[0].updatedAt)
    _ = try store.appendAIChatMessage(threadID: thread.id, role: .assistant, content: "Review.", editProposals: [first, second])

    let statuses = store.acceptAllPendingAIEditProposals(threadID: thread.id, providerId: "mock", prompt: "Batch")

    XCTAssertEqual(statuses, [.accepted, .accepted])
    XCTAssertEqual(store.envelope.sections[0].content, "A new B ancient C")
  }

  func testChatFieldsRoundTripAndDefaultWhenMissing() throws {
    let missingChatJson = """
    {
      "manifest": { "format": "dhproj", "version": 1, "appVersion": "2.0.0", "createdAt": "2026-05-04T00:00:00.000Z" },
      "project": { "id": "project-1", "title": "Legacy", "projectType": "book", "updatedAt": 1777852800000 },
      "projectType": "book",
      "sections": [],
      "snapshots": [],
      "commentThreads": [],
      "settings": {},
      "goalTrends": []
    }
    """
    let legacy = try DhprojCodec.decode(Data(missingChatJson.utf8))
    XCTAssertTrue(legacy.aiChatThreads.isEmpty)

    let store = ProjectStore(envelope: legacy)
    let thread = store.ensureAIChatThread(title: "Thread")
    _ = try store.appendAIChatMessage(threadID: thread.id, role: .user, content: "Hello")
    let decoded = try DhprojCodec.decode(try DhprojCodec.encode(store.envelope))

    XCTAssertEqual(decoded.aiChatThreads.count, 1)
    XCTAssertEqual(decoded.aiChatThreads[0].messages.first?.content, "Hello")
  }
}
