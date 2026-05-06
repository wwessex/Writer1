import DraftHarbourNativeCore
import XCTest

final class ThemePreferenceTests: XCTestCase {
  func testDecodesCurrentAndLegacyThemeValues() throws {
    XCTAssertEqual(try decodeTheme("\"auto\""), .auto)
    XCTAssertEqual(try decodeTheme("\"light\""), .light)
    XCTAssertEqual(try decodeTheme("\"dark\""), .dark)
    XCTAssertEqual(try decodeTheme("\"system\""), .auto)
    XCTAssertEqual(try decodeTheme("\"high-contrast\""), .dark)
  }

  func testEncodesCanonicalThemeValues() throws {
    XCTAssertEqual(try encodeTheme(.auto), "\"auto\"")
    XCTAssertEqual(try encodeTheme(.light), "\"light\"")
    XCTAssertEqual(try encodeTheme(.dark), "\"dark\"")
  }

  func testNormalizesStoredThemeValues() {
    XCTAssertEqual(ThemePreference.normalizedRawValue("system"), "auto")
    XCTAssertEqual(ThemePreference.normalizedRawValue("high-contrast"), "dark")
    XCTAssertEqual(ThemePreference.normalizedRawValue("light"), "light")
  }

  private func decodeTheme(_ raw: String) throws -> ThemePreference {
    try JSONDecoder().decode(ThemePreference.self, from: Data(raw.utf8))
  }

  private func encodeTheme(_ theme: ThemePreference) throws -> String {
    let data = try JSONEncoder().encode(theme)
    return String(decoding: data, as: UTF8.self)
  }
}
