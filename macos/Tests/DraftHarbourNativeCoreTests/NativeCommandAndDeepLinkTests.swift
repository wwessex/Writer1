import DraftHarbourNativeCore
import XCTest

final class NativeCommandAndDeepLinkTests: XCTestCase {
  func testNewNativeCommandIDsAreRegistered() {
    let commands: [NativeCommandID] = [
      .nativeFind,
      .projectFindReplace,
      .revealProjectInFinder,
      .copyProjectPath,
      .shareSelection,
      .shareActiveSection,
      .printActiveSection,
      .printProject,
      .toggleToolPanel,
      .dashboard,
      .analysis,
      .advancedAnalytics,
      .sceneTemplates,
      .aiSuggestions,
      .publishingAssistant,
      .exportHistory,
      .onboarding,
      .copyProjectLink,
      .copySectionLink,
      .indexSpotlight,
      .clearSpotlightIndex
    ]

    for command in commands {
      XCTAssertTrue(NativeCommandID.allCases.contains(command))
      XCTAssertEqual(command.disposition, .native)
    }
  }

  func testDocumentCommandHandlerOnlyRunsEnabledCommands() {
    var performed: [NativeCommandID] = []
    let handler = NativeDocumentCommandHandler(
      canRun: { $0 == .printProject },
      run: { performed.append($0) }
    )

    handler.perform(.shareSelection)
    handler.perform(.printProject)

    XCTAssertEqual(performed, [.printProject])
  }

  func testQuickSwitcherIndexesNativeParityToolPanels() {
    let envelope = DhprojCodec.newProject(title: "Switcher")

    XCTAssertTrue(QuickSwitcherIndex.search("dashboard", in: envelope).contains { $0.commandID == .dashboard })
    XCTAssertTrue(QuickSwitcherIndex.search("analysis", in: envelope).contains { $0.commandID == .analysis })
    XCTAssertTrue(QuickSwitcherIndex.search("advanced", in: envelope).contains { $0.commandID == .advancedAnalytics })
    XCTAssertTrue(QuickSwitcherIndex.search("templates", in: envelope).contains { $0.commandID == .sceneTemplates })
    XCTAssertTrue(QuickSwitcherIndex.search("suggestions", in: envelope).contains { $0.commandID == .aiSuggestions })
    XCTAssertTrue(QuickSwitcherIndex.search("publishing", in: envelope).contains { $0.commandID == .publishingAssistant })
    XCTAssertTrue(QuickSwitcherIndex.search("export history", in: envelope).contains { $0.commandID == .exportHistory })
    XCTAssertTrue(QuickSwitcherIndex.search("onboarding", in: envelope).contains { $0.commandID == .onboarding })
  }

  func testNativeDeepLinkParsesProjectURL() throws {
    let url = try XCTUnwrap(URL(string: "draftharbour://project/project-123"))

    XCTAssertEqual(
      NativeDeepLink.parse(url),
      NativeDeepLink(projectID: "project-123")
    )
  }

  func testNativeDeepLinkParsesSectionURL() throws {
    let url = try XCTUnwrap(URL(string: "draftharbour://project/project-123/section/section-456"))

    XCTAssertEqual(
      NativeDeepLink.parse(url),
      NativeDeepLink(projectID: "project-123", sectionID: "section-456")
    )
  }

  func testNativeDeepLinkRejectsOAuthCallback() throws {
    let url = try XCTUnwrap(URL(string: "draftharbour://oauth/dropbox?code=abc&state=123"))

    XCTAssertNil(NativeDeepLink.parse(url))
  }

  func testNativeDeepLinkBuildsCopyableURLs() throws {
    XCTAssertEqual(
      NativeDeepLink(projectID: "project-123").url?.absoluteString,
      "draftharbour://project/project-123"
    )
    XCTAssertEqual(
      NativeDeepLink(projectID: "project-123", sectionID: "section-456").url?.absoluteString,
      "draftharbour://project/project-123/section/section-456"
    )
  }

  func testSpellingAndSubstitutionCommandsRouteThroughResponderChain() {
    let commands: [NativeCommandID] = [
      .showSpellingPanel,
      .checkSpelling,
      .toggleContinuousSpellChecking,
      .toggleGrammarChecking,
      .toggleAutomaticSpellingCorrection,
      .showSubstitutionsPanel,
      .toggleSmartQuotes,
      .toggleSmartDashes,
      .toggleTextReplacement
    ]

    for command in commands {
      XCTAssertEqual(command.disposition, .responderChain)
    }
  }
}
