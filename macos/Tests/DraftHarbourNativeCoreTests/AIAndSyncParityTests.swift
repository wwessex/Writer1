import DraftHarbourNativeCore
import XCTest

final class AIAndSyncParityTests: XCTestCase {
  func testAIWorkflowRendersStoryContextAndInsertionModes() {
    var envelope = DhprojCodec.newProject(title: "AI Story")
    envelope.storyBlueprint = StoryBlueprint(genre: "Mystery", tone: "tense", voice: "close third")
    envelope.characters = [CharacterEntity(novelId: envelope.project.id, name: "Jules", role: "lead")]
    let section = envelope.sections[0]

    let prompt = AIWorkflowServices.renderPrompt(
      template: "{{projectTitle}}\n{{sectionTitle}}\n{{context}}\n{{prompt}}",
      envelope: envelope,
      section: section,
      extraPrompt: "Continue"
    )

    XCTAssertTrue(prompt.contains("AI Story"))
    XCTAssertTrue(prompt.contains("Mystery"))
    XCTAssertTrue(prompt.contains("Jules"))
    XCTAssertEqual(AIWorkflowServices.applyInsertionMode(base: "A", incoming: "B", mode: .append), "A\n\nB")
  }

  func testFallbackProviderUsesNextProviderAfterFailure() async throws {
    let provider = FallbackAIProvider(providers: [FailingProvider(), PassingProvider()])
    let response = try await provider.generate(AIRequest(prompt: "Go", projectType: .book))
    XCTAssertEqual(response.provider, "pass")
    XCTAssertEqual(response.text, "Done")
  }

  func testProviderFactoryUsesInjectableSecretStore() throws {
    let factory = NativeAIProviderFactory(secretStore: MockSecretStore(values: ["ai": "token"]))
    let provider = try factory.provider(
      from: AIProviderConfig(
        provider: .localOpenAI,
        label: "Local",
        endpoint: "http://localhost:11434/v1/chat/completions",
        model: "llama3.1",
        keychainAccount: "ai"
      )
    )

    let concrete = try XCTUnwrap(provider as? OpenAICompatibleProvider)
    XCTAssertEqual(concrete.apiKey, "token")
    XCTAssertEqual(concrete.defaultModel, "llama3.1")
  }


  func testSyncMergeDetectsConflictsAndResolvesKeepBoth() {
    var local = Section(id: "s1", novelId: "p1", order: 0, title: "Chapter", updatedAt: 20, content: "local")
    local.sync = ChapterSyncMetadata(lastSyncedContent: "base")
    let remote = ProviderDocument(id: "s1", title: "Chapter", content: "remote", updatedAt: 30)

    switch SyncMergeEngine.merge(local: local, remote: remote, baseContent: local.sync?.lastSyncedContent) {
    case .merged:
      XCTFail("Expected conflict")
    case .conflict(let conflict):
      let resolved = SyncMergeEngine.resolve(conflict, option: .keepBoth, localSection: local)
      XCTAssertEqual(resolved.count, 2)
      XCTAssertEqual(resolved[1].content, "remote")
    }
  }

  func testQuickSwitcherIndexesSectionsCommandsAndBibleEntries() {
    var envelope = DhprojCodec.newProject(title: "Switch")
    envelope.characters = [CharacterEntity(novelId: envelope.project.id, name: "Mara")]
    let results = QuickSwitcherIndex.search("mara", in: envelope)
    XCTAssertEqual(results.first?.kind, .character)
    XCTAssertTrue(QuickSwitcherIndex.search("export", in: envelope).contains { $0.commandID == .export })
  }
}

private struct FailingProvider: AIProvider {
  let id = "fail"
  let displayName = "Fail"

  func generate(_ request: AIRequest) async throws -> AIResponse {
    throw DraftHarbourError.providerNotConfigured("fail")
  }
}

private struct PassingProvider: AIProvider {
  let id = "pass"
  let displayName = "Pass"

  func generate(_ request: AIRequest) async throws -> AIResponse {
    AIResponse(text: "Done", provider: id)
  }
}

private struct MockSecretStore: SecretStore {
  var values: [String: String]

  func secret(account: String) throws -> String? {
    values[account]
  }
}
