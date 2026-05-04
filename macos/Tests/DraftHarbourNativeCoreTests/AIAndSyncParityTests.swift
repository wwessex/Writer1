import DraftHarbourNativeCore
import Foundation
import XCTest

final class AIAndSyncParityTests: XCTestCase {
  func testNativeCommandsHaveExplicitDisposition() {
    XCTAssertEqual(Set(NativeCommandID.allCases.map(\.rawValue)).count, NativeCommandID.allCases.count)
    XCTAssertEqual(NativeCommandID.undo.disposition, .responderChain)
    XCTAssertEqual(NativeCommandID.openProjectFile.disposition, .system)
    XCTAssertEqual(NativeCommandID.importDocument.disposition, .native)
    XCTAssertEqual(NativeCommandID.storyCards.disposition, .native)
  }

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
    XCTAssertTrue(AIWorkflowServices.translationPrompt(text: "**Hello**", language: TranslationLanguage(code: "fr", name: "French"), preserveFormatting: true).contains("Preserve Markdown"))
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

  func testAIProviderConfigAndRevisionLogPersistInStore() {
    let store = ProjectStore(envelope: DhprojCodec.newProject(title: "AI Store"))
    let sectionID = store.activeSectionID!
    let config = AIProviderConfig(
      id: "provider-1",
      provider: .openAICompatible,
      label: "OpenAI Compatible",
      endpoint: "https://example.test/v1/chat/completions",
      model: "writer"
    )

    store.upsertAIProvider(config)
    store.upsertAIProvider(AIProviderConfig(id: "provider-1", provider: .openAICompatible, label: "OpenAI Compatible", endpoint: config.endpoint, model: "writer-2"))
    store.recordAIRevision(sectionID: sectionID, providerId: "provider-1", prompt: "Revise", before: "Before", after: "After")

    XCTAssertEqual(store.envelope.aiProviders.count, 1)
    XCTAssertEqual(store.envelope.aiProviders.first?.model, "writer-2")
    XCTAssertEqual(store.envelope.aiRevisionLog.first?.after, "After")
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

  func testGenericRESTProviderPushPullAndRevisionsWithMockSession() async throws {
    var local = DhprojCodec.newProject(title: "REST")
    local.sections[0].id = "section-1"
    local.sections[0].content = "base"
    local.sections[0].sync = ChapterSyncMetadata(lastSyncedContent: "base")

    var remote = local
    remote.sections[0].content = "remote"
    remote.sections[0].updatedAt = local.sections[0].updatedAt + 1_000

    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockURLProtocol.self]
    let session = URLSession(configuration: configuration)
    let provider = GenericRESTSyncProvider(session: session)
    let config = IntegrationConfig(type: .genericREST, enabled: true, accessToken: "token", baseUrl: "https://sync.example/")
    let revisions = [RemoteRevision(id: "r1", provider: .genericREST, title: "Remote Revision", updatedAt: 123)]

    MockURLProtocol.requestHandler = { request in
      guard request.value(forHTTPHeaderField: "Authorization") == "Bearer token" else {
        throw URLError(.userAuthenticationRequired)
      }
      if request.httpMethod == "PUT", request.url?.path.hasSuffix("/projects/\(local.project.id)") == true {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
      }
      if request.httpMethod == "GET", request.url?.path.hasSuffix("/projects/\(local.project.id)") == true {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, try JSONEncoder().encode(ProviderPayload(envelope: remote)))
      }
      if request.httpMethod == "GET", request.url?.path.hasSuffix("/revisions") == true {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, try JSONEncoder().encode(revisions))
      }
      throw URLError(.badURL)
    }
    defer { MockURLProtocol.requestHandler = nil }

    let push = try await provider.push(config: config, payload: IntegrationPayload(envelope: local))
    let pull = try await provider.pull(config: config, payload: IntegrationPayload(envelope: local))
    let listedRevisions = try await provider.listRevisions(config: config)

    XCTAssertEqual(push.message, "Pushed 1 sections.")
    XCTAssertEqual(pull.pulledEnvelope?.sections.first?.content, "remote")
    XCTAssertTrue(pull.conflicts.isEmpty)
    XCTAssertEqual(listedRevisions, revisions)
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

private final class MockURLProtocol: URLProtocol {
  nonisolated(unsafe) static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

  override class func canInit(with request: URLRequest) -> Bool {
    true
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest {
    request
  }

  override func startLoading() {
    guard let requestHandler = Self.requestHandler else {
      client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
      return
    }

    do {
      let (response, data) = try requestHandler(request)
      client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    } catch {
      client?.urlProtocol(self, didFailWithError: error)
    }
  }

  override func stopLoading() {}
}
