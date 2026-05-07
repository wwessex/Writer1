import DraftHarbourNativeCore
import Foundation
import XCTest

final class WebParityServicesTests: XCTestCase {
  func testAnalysisServicesExposeReadabilityRepetitionSentimentAndDistributions() {
    let text = """
    Bright courage restored hope. "We can win," Mara said.

    Danger danger danger followed the crew through the broken dark passage while every exhausted witness kept counting the same footsteps behind them and wondering whether the door ahead would open before the threat arrived.
    """

    let analysis = AnalysisServices.textAnalysis(for: text)
    XCTAssertGreaterThan(analysis.wordCount, 25)
    XCTAssertGreaterThan(analysis.fleschScore, 0)
    XCTAssertEqual(analysis.repeatedWords["danger"], 3)
    XCTAssertEqual(analysis.longSentences.count, 1)

    let advanced = AnalysisServices.advancedAnalytics(for: text)
    XCTAssertGreaterThan(advanced.dialoguePercentage, 0)
    XCTAssertEqual(advanced.sentimentByParagraph.count, 2)
    XCTAssertGreaterThanOrEqual(advanced.sentenceDistribution.long + advanced.sentenceDistribution.veryLong, 1)
    XCTAssertEqual(advanced.wordFrequency["danger"], 3)

    var envelope = DhprojCodec.newProject(title: "Weather")
    envelope.sections[0].content = text
    let weather = AnalysisServices.narrativeWeather(for: envelope)
    XCTAssertEqual(weather.first?.title, "Chapter 1")
    XCTAssertGreaterThanOrEqual(weather.first?.dialogueDensity ?? 0, 0)
  }

  func testLanguageToolMockedResponsesAndRequestBody() throws {
    let response = Data("""
    {
      "matches": [
        {
          "message": "Possible spelling mistake found.",
          "context": { "text": "A mistke appears.", "offset": 2, "length": 6 },
          "replacements": [{ "value": "mistake" }, { "value": "mistook" }]
        }
      ]
    }
    """.utf8)

    let matches = try LanguageToolServices.parseMatches(from: response)
    XCTAssertEqual(matches.count, 1)
    XCTAssertEqual(matches.first?.message, "Possible spelling mistake found.")
    XCTAssertEqual(matches.first?.context.offset, 2)
    XCTAssertEqual(matches.first?.replacements.map(\.value), ["mistake", "mistook"])

    let body = String(data: LanguageToolServices.requestBody(text: "A mistke", language: "en-US"), encoding: .utf8)
    XCTAssertTrue(body?.contains("language=en-US") == true)
    XCTAssertTrue(body?.contains("text=A%20mistke") == true)
  }

  func testDashboardGoalsStreaksAndGoalTrends() {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Goals"))
    store.updateGoals(daily: 100, weekly: 700, project: 1_000, deadline: "2026-05-10")
    store.recordWritingSession(wordsWritten: 50, date: "2026-05-07")

    let dashboard = ProgressDashboardServices.dashboard(for: store.envelope, now: date(year: 2026, month: 5, day: 7, hour: 12))
    XCTAssertEqual(dashboard.todayWords, 50)
    XCTAssertEqual(dashboard.dailyGoal, 100)
    XCTAssertEqual(dashboard.weeklyGoal, 700)
    XCTAssertEqual(dashboard.projectGoal, 1_000)
    XCTAssertEqual(dashboard.dailyGoalPercent, 50)
    XCTAssertTrue(dashboard.isBehindPace)
    XCTAssertEqual(store.envelope.progress?.streak.current, 1)

    guard case .object(let trend)? = store.envelope.goalTrends.first else {
      return XCTFail("Expected goal trend snapshot.")
    }
    XCTAssertEqual(trend["date"], .string("2026-05-07"))
    XCTAssertEqual(trend["wordsToday"], .number(50))
    XCTAssertEqual(trend["goalMet"], .bool(false))
  }

  func testSceneTemplateApplicationCreatesMetadataRichScenes() throws {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "Templates", projectType: .screenplay))
    let template = try XCTUnwrap(SceneTemplateServices.templates.first { $0.id == "mystery-clue" })

    let scene = try store.applySceneTemplate(template, pov: "Jules", wordGoal: 1_200)

    XCTAssertEqual(scene.title, "Mystery: Clue Discovery")
    XCTAssertEqual(scene.pov, "Jules")
    XCTAssertEqual(scene.wordGoal, 1_200)
    XCTAssertEqual(scene.slugLine, "INT. LOCATION - DAY")
    XCTAssertTrue(scene.summary.contains("BEATS:"))
    XCTAssertTrue(scene.tags.contains("mystery"))
    XCTAssertEqual(store.activeSection?.scenes.first?.id, scene.id)
  }

  func testPublishingDraftExportHistoryAndSnapshotDiffHelpers() throws {
    var envelope = DhprojCodec.newProject(title: "Glass Harbour")
    envelope.storyBlueprint = StoryBlueprint(genre: "Mystery", tone: "noir", voice: "close third")
    envelope.sections[0].summary = "A detective follows a clue through a rain-soaked harbour."

    let draft = PublishingAssistantServices.draft(for: envelope)
    XCTAssertTrue(draft.bookDescription.contains("Glass Harbour"))
    XCTAssertTrue(draft.keywordSuggestions.contains("Mystery"))
    XCTAssertTrue(draft.hookLines.contains("truth"))

    let store = ProjectStore(envelope: envelope)
    store.recordExport(
      ExportedFile(filename: "Glass-Harbour.md", contentType: "text/markdown", data: Data()),
      format: .markdown,
      validationIssues: [ExportValidationIssue(severity: .warning, message: "Chapter 1 is empty.", sectionId: store.activeSectionID)]
    )
    XCTAssertEqual(store.envelope.exportHistory.first?.format, .markdown)
    XCTAssertEqual(store.envelope.exportHistory.first?.validationIssues.first?.severity, .warning)

    store.envelope.manifest.exportOptions = ExportOptions(includeSnapshots: false, includeIntegrationArtifacts: true)
    let roundTripped = try DhprojCodec.decode(try DhprojCodec.encode(store.envelope))
    XCTAssertEqual(roundTripped.manifest.exportOptions?.includeSnapshots, false)
    XCTAssertEqual(roundTripped.manifest.exportOptions?.includeIntegrationArtifacts, true)

    let diff = SnapshotDiffServices.diff(old: "Line A\nLine B", new: "Line A\nLine C\nLine D")
    XCTAssertTrue(diff.contains { $0.kind == .unchanged && $0.text == "Line A" })
    XCTAssertTrue(diff.contains { $0.kind == .removed && $0.text == "Line B" })
    XCTAssertTrue(diff.contains { $0.kind == .added && $0.text == "Line C" })
    XCTAssertTrue(diff.contains { $0.kind == .added && $0.text == "Line D" })
  }

  func testContinuityMemoryVoiceFingerprintsAndSceneChemistry() {
    var envelope = DhprojCodec.newProject(title: "Continuity", projectType: .screenplay)
    envelope.characters = [
      CharacterEntity(id: "jules", novelId: envelope.project.id, name: "Jules", aliases: ["J"])
    ]
    envelope.sections[0].content = """
    Event: The map burns.
    Rule: Magic costs memory.
    Thread: Missing sister -> open

    INT. HARBOUR OFFICE - NIGHT
    @JULES
    We move now before the trail goes cold.
    """

    let memory = ContinuityMemoryServices.snapshot(for: envelope)
    XCTAssertEqual(memory.characters, ["J", "Jules"])
    XCTAssertTrue(memory.timelineEvents.contains("The map burns."))
    XCTAssertTrue(memory.worldRules.contains("Magic costs memory."))
    XCTAssertTrue(memory.unresolvedThreads.contains("Missing sister"))

    let profiles = VoiceFingerprintServices.profiles(for: envelope)
    XCTAssertEqual(profiles.first?.sampleCount, 1)
    XCTAssertEqual(profiles.first?.fingerprint?.speaker, "Jules")
    XCTAssertGreaterThan(profiles.first?.fingerprint?.features.sampleTokens ?? 0, 0)

    let chemistry = SceneChemistryServices.evaluate(
      Scene(
        title: "Harbour Betrayal",
        summary: "Jules discovers a dangerous betrayal and must choose who to trust.",
        pov: "Jules",
        tags: ["mystery", "danger", "betrayal"],
        location: "Harbour"
      )
    )
    XCTAssertGreaterThan(chemistry.confidence, 70)
    XCTAssertGreaterThan(chemistry.tension, 20)
    XCTAssertFalse(chemistry.recommendation.isEmpty)
  }

  private func date(year: Int, month: Int, day: Int, hour: Int = 0) -> Date {
    var components = DateComponents()
    components.calendar = Calendar(identifier: .gregorian)
    components.timeZone = TimeZone(secondsFromGMT: 0)
    components.year = year
    components.month = month
    components.day = day
    components.hour = hour
    return components.date ?? Date(timeIntervalSince1970: 0)
  }
}
