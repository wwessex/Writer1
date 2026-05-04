import DraftHarbourNativeCore
import XCTest

final class ProviderProtocolTests: XCTestCase {
  func testMockAIProviderMatchesNativeProtocol() async throws {
    let provider = MockAIProvider()
    let response = try await provider.generate(AIRequest(prompt: "Continue", projectType: .book, sectionTitle: "Chapter 1"))

    XCTAssertEqual(response.provider, "mock")
    XCTAssertEqual(response.text, "Native response")
  }

  func testPlainTextExporterProducesProjectText() throws {
    let envelope = DhprojCodec.newProject(title: "Export Me")
    let store = ProjectStore(envelope: envelope)
    store.updateActiveSectionTitle("Opening")
    store.updateActiveSectionContent("Hello **native** export.")

    let exported = try PlainTextExporter().export(store.envelope)
    let text = String(decoding: exported.data, as: UTF8.self)

    XCTAssertEqual(exported.filename, "Export Me.txt")
    XCTAssertTrue(text.contains("Opening"))
    XCTAssertTrue(text.contains("Hello native export."))
  }
}

private struct MockAIProvider: AIProvider {
  let id = "mock"
  let displayName = "Mock"

  func generate(_ request: AIRequest) async throws -> AIResponse {
    AIResponse(text: "Native response", provider: id, model: request.model)
  }
}
