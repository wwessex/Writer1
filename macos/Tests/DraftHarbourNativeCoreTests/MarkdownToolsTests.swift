import DraftHarbourNativeCore
import XCTest

final class MarkdownToolsTests: XCTestCase {
  func testCountsWordsAfterMarkdownCleanup() {
    let text = "# Chapter\n\n**Bold words** and [a link](https://example.com)."
    XCTAssertEqual(MarkdownTools.wordCount(text), 6)
  }

  func testParsesFountainBlocks() {
    let blocks = MarkdownTools.screenplayBlocks(from: "INT. ROOM - DAY\n@JULES\nWe made it native.\n> CUT TO:")

    XCTAssertEqual(blocks.map(\.type), [.sceneHeading, .character, .dialogue, .transition])
    XCTAssertEqual(blocks[1].text, "JULES")
  }
}
