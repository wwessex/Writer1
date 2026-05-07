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
      .toggleToolPanel
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
}
