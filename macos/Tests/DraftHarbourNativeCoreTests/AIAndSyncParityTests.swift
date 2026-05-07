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
    XCTAssertEqual(NativeCommandID.workspaceReview.disposition, .native)
    XCTAssertEqual(WorkspaceMode.corkboard.title, "Corkboard")
    XCTAssertEqual(InspectorTab.metrics.title, "Metrics")
    XCTAssertEqual(ReviewFilter.aiRevisions.title, "AI Revisions")
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
    let tokenStore = MemorySecretStore(values: ["generic-rest-token": "token"])
    let provider = GenericRESTSyncProvider(session: session, tokenStore: tokenStore)
    let config = IntegrationConfig(type: .genericREST, enabled: true, accessTokenKeychainAccount: "generic-rest-token", baseUrl: "https://sync.example/")
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

  func testIntegrationConfigRedactsRawOAuthTokensButReadsLegacyTokens() throws {
    let config = IntegrationConfig(
      type: .dropbox,
      enabled: true,
      accessToken: "secret-access",
      refreshToken: "secret-refresh",
      accessTokenKeychainAccount: "dropbox-access-account",
      refreshTokenKeychainAccount: "dropbox-refresh-account",
      clientId: "dropbox-app"
    )

    let encoded = try JSONEncoder().encode(config)
    let text = try XCTUnwrap(String(data: encoded, encoding: .utf8))
    XCTAssertFalse(text.contains("secret-access"))
    XCTAssertFalse(text.contains("secret-refresh"))
    XCTAssertTrue(text.contains("dropbox-access-account"))
    XCTAssertTrue(text.contains("dropbox-refresh-account"))

    let legacy = Data("""
    {"type":"dropbox","enabled":true,"accessToken":"legacy-access","refreshToken":"legacy-refresh"}
    """.utf8)
    let decoded = try JSONDecoder().decode(IntegrationConfig.self, from: legacy)
    XCTAssertEqual(decoded.accessToken, "legacy-access")
    XCTAssertEqual(decoded.refreshToken, "legacy-refresh")
  }

  func testOAuthPKCECallbackValidationAndAuthorizationParameters() throws {
    let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    XCTAssertEqual(OAuthPKCE.codeChallenge(for: verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")

    let callbackURL = try XCTUnwrap(URL(string: "draftharbour://oauth/dropbox?code=abc123&state=expected"))
    let callback = try OAuthCallback.parse(url: callbackURL, expectedState: "expected")
    XCTAssertEqual(callback.code, "abc123")
    XCTAssertThrowsError(try OAuthCallback.parse(url: callbackURL, expectedState: "wrong"))

    let dropboxURL = try NativeOAuthConfiguration.makeAuthorizationURL(
      provider: .dropbox,
      clientID: "dropbox-app",
      redirectURI: "draftharbour://oauth/dropbox",
      codeChallenge: "challenge",
      state: "state"
    )
    XCTAssertTrue(dropboxURL.absoluteString.contains("token_access_type=offline"))

    let googleURL = try NativeOAuthConfiguration.makeAuthorizationURL(
      provider: .googleDrive,
      clientID: "google-client",
      redirectURI: "http://127.0.0.1:55555",
      codeChallenge: "challenge",
      state: "state"
    )
    XCTAssertTrue(googleURL.absoluteString.contains("access_type=offline"))
    XCTAssertTrue(googleURL.absoluteString.contains("drive.file"))
  }

  func testOAuthTokenClientExchangeRefreshAndRevokeWithMockProtocol() async throws {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockURLProtocol.self]
    let session = URLSession(configuration: configuration)
    let client = OAuthTokenClient(session: session)
    var sawExchange = false
    var sawRefresh = false
    var sawRevoke = false

    MockURLProtocol.requestHandler = { request in
      let body = String(data: requestBodyData(request), encoding: .utf8) ?? ""
      if request.url?.path == "/oauth2/token", body.contains("grant_type=authorization_code") {
        sawExchange = true
        XCTAssertTrue(body.contains("code=auth-code"))
        XCTAssertTrue(body.contains("code_verifier=verifier"))
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"access_token":"access","token_type":"bearer","expires_in":3600,"refresh_token":"refresh","account_id":"acct"}
        """.utf8))
      }
      if request.url?.path == "/oauth2/token", body.contains("grant_type=refresh_token") {
        sawRefresh = true
        XCTAssertTrue(body.contains("refresh_token=refresh"))
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"access_token":"new-access","token_type":"bearer","expires_in":1800}
        """.utf8))
      }
      if request.url?.path == "/2/auth/token/revoke" {
        sawRevoke = true
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer new-access")
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data())
      }
      throw URLError(.badURL)
    }
    defer { MockURLProtocol.requestHandler = nil }

    let exchanged = try await client.exchangeAuthorizationCode(
      provider: .dropbox,
      code: "auth-code",
      codeVerifier: "verifier",
      clientID: "dropbox-app",
      redirectURI: "draftharbour://oauth/dropbox"
    )
    let refreshed = try await client.refreshAccessToken(provider: .dropbox, refreshToken: "refresh", clientID: "dropbox-app")
    try await client.revoke(provider: .dropbox, accessToken: refreshed.accessToken)

    XCTAssertEqual(exchanged.refreshToken, "refresh")
    XCTAssertEqual(refreshed.accessToken, "new-access")
    XCTAssertTrue(sawExchange)
    XCTAssertTrue(sawRefresh)
    XCTAssertTrue(sawRevoke)
  }

  func testNativeProviderRegistryUsesDirectCloudProviders() {
    XCTAssertTrue(NativeIntegrationProviderRegistry.provider(for: .dropbox) is DropboxSyncProvider)
    XCTAssertTrue(NativeIntegrationProviderRegistry.provider(for: .googleDrive) is GoogleDriveSyncProvider)
  }

  func testDropboxProviderPushPullRevisionsAndRefreshWithMockSession() async throws {
    var local = DhprojCodec.newProject(title: "Dropbox")
    local.sections[0].id = "section-1"
    local.sections[0].title = "Local"
    local.sections[0].content = "local"
    local.sections[0].updatedAt = 100

    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockURLProtocol.self]
    let session = URLSession(configuration: configuration)
    let tokenStore = MemorySecretStore(values: ["access": "expired-token", "refresh": "refresh-token"])
    let provider = DropboxSyncProvider(
      session: session,
      tokenClient: OAuthTokenClient(session: session),
      tokenStore: tokenStore
    )
    let config = IntegrationConfig(
      type: .dropbox,
      enabled: true,
      expiresAt: currentTimeMilliseconds() + 3_600_000,
      accessTokenKeychainAccount: "access",
      refreshTokenKeychainAccount: "refresh",
      clientId: "dropbox-app",
      syncFolderPath: "/DraftHarbour"
    )
    var sawExpiredRequest = false
    var sawSectionUploadSchema = false

    MockURLProtocol.requestHandler = { request in
      if request.url?.path == "/oauth2/token" {
        let body = String(data: requestBodyData(request), encoding: .utf8) ?? ""
        XCTAssertTrue(body.contains("grant_type=refresh_token"))
        XCTAssertTrue(body.contains("refresh_token=refresh-token"))
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"access_token":"refreshed-token","token_type":"bearer","expires_in":3600,"refresh_token":"refresh-token"}
        """.utf8))
      }

      if request.value(forHTTPHeaderField: "Authorization") == "Bearer expired-token" {
        sawExpiredRequest = true
        return (HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
      }
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer refreshed-token")

      switch request.url?.path {
      case "/2/files/create_folder_v2":
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("{}".utf8))
      case "/2/files/upload":
        let arg = request.value(forHTTPHeaderField: "Dropbox-API-Arg") ?? ""
        if arg.contains("section-1.json") {
          let body = String(data: requestBodyData(request), encoding: .utf8) ?? ""
          sawSectionUploadSchema = body.contains("\"body\":\"local\"") && !body.contains("\"content\"")
        }
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("{}".utf8))
      case "/2/files/list_folder":
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"entries":[{".tag":"file","name":"section-1.json","path_lower":"/draftharbour/section-1.json","path_display":"/DraftHarbour/section-1.json","server_modified":"2026-05-06T12:00:00Z","rev":"rev1"}],"has_more":false}
        """.utf8))
      case "/2/files/download":
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"id":"section-1","title":"Remote","content":"legacy remote","order":0,"updatedAt":200}
        """.utf8))
      case "/2/files/list_revisions":
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"entries":[{"rev":"rev1","server_modified":"2026-05-06T12:00:00Z"}]}
        """.utf8))
      default:
        throw URLError(.badURL)
      }
    }
    defer { MockURLProtocol.requestHandler = nil }

    let push = try await provider.push(config: config, payload: IntegrationPayload(envelope: local))
    let refreshedConfig = try XCTUnwrap(push.updatedConfig)
    let pull = try await provider.pull(config: refreshedConfig, payload: IntegrationPayload(envelope: local))
    let revisions = try await provider.listRevisions(config: refreshedConfig)

    XCTAssertTrue(sawExpiredRequest)
    XCTAssertTrue(sawSectionUploadSchema)
    XCTAssertEqual(try tokenStore.secret(account: "access"), "refreshed-token")
    XCTAssertEqual(pull.conflicts.first?.remoteContent, "legacy remote")
    XCTAssertEqual(revisions.first?.id, "dropbox-rev-rev1")
  }

  func testGoogleDriveProviderPushPullRevisionsAndRefreshWithMockSession() async throws {
    var local = DhprojCodec.newProject(title: "Google Drive")
    local.sections[0].id = "section-1"
    local.sections[0].title = "Local"
    local.sections[0].content = "local"
    local.sections[0].updatedAt = 100

    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [MockURLProtocol.self]
    let session = URLSession(configuration: configuration)
    let tokenStore = MemorySecretStore(values: ["access": "expired-google", "refresh": "refresh-google"])
    let provider = GoogleDriveSyncProvider(
      session: session,
      tokenClient: OAuthTokenClient(session: session),
      tokenStore: tokenStore
    )
    let config = IntegrationConfig(
      type: .googleDrive,
      enabled: true,
      expiresAt: currentTimeMilliseconds() + 3_600_000,
      accessTokenKeychainAccount: "access",
      refreshTokenKeychainAccount: "refresh",
      clientId: "google-client"
    )
    var sawExpiredRequest = false
    var sawMultipartSchema = false
    var manifestUploaded = false

    MockURLProtocol.requestHandler = { request in
      if request.url?.path == "/token" {
        let body = String(data: requestBodyData(request), encoding: .utf8) ?? ""
        XCTAssertTrue(body.contains("grant_type=refresh_token"))
        XCTAssertTrue(body.contains("refresh_token=refresh-google"))
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"access_token":"fresh-google","token_type":"Bearer","expires_in":3600}
        """.utf8))
      }

      if request.value(forHTTPHeaderField: "Authorization") == "Bearer expired-google" {
        sawExpiredRequest = true
        return (HTTPURLResponse(url: request.url!, statusCode: 401, httpVersion: nil, headerFields: nil)!, Data())
      }
      XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer fresh-google")

      let components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
      let query = Dictionary(uniqueKeysWithValues: (components?.queryItems ?? []).compactMap { item in item.value.map { (item.name, $0) } })

      if request.url?.path == "/drive/v3/files", request.httpMethod == "GET", query["q"]?.contains("name='DraftHarbour'") == true {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"files":[]}
        """.utf8))
      }
      if request.url?.path == "/drive/v3/files", request.httpMethod == "POST" {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"id":"folder-1"}
        """.utf8))
      }
      if request.url?.path == "/drive/v3/files", request.httpMethod == "GET", query["q"]?.contains("name='section-1.json'") == true {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"files":[]}
        """.utf8))
      }
      if request.url?.path == "/drive/v3/files", request.httpMethod == "GET", query["q"]?.contains("name='_manifest.json'") == true {
        guard manifestUploaded else {
          return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
          {"files":[]}
          """.utf8))
        }
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"files":[{"id":"manifest-file","name":"_manifest.json","modifiedTime":"2026-05-06T12:00:00Z"}]}
        """.utf8))
      }
      if request.url?.path == "/upload/drive/v3/files", request.httpMethod == "POST" {
        let body = String(data: requestBodyData(request), encoding: .utf8) ?? ""
        if body.contains("section-1.json") {
          sawMultipartSchema = body.contains("\"body\":\"local\"") && !body.contains("\"content\"")
        }
        if body.contains("_manifest.json") {
          manifestUploaded = true
        }
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"id":"uploaded-file"}
        """.utf8))
      }
      if request.url?.path == "/drive/v3/files", request.httpMethod == "GET", query["q"]?.contains("mimeType='application/json'") == true {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"files":[{"id":"section-file","name":"section-1.json","modifiedTime":"2026-05-06T12:00:00Z"},{"id":"manifest-file","name":"_manifest.json","modifiedTime":"2026-05-06T12:00:00Z"}]}
        """.utf8))
      }
      if request.url?.path == "/drive/v3/files/section-file" {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"id":"section-1","title":"Remote","body":"remote","order":0,"updatedAt":200}
        """.utf8))
      }
      if request.url?.path == "/drive/v3/files/manifest-file/revisions" {
        return (HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!, Data("""
        {"revisions":[{"id":"rev1","modifiedTime":"2026-05-06T12:00:00Z"}]}
        """.utf8))
      }

      throw URLError(.badURL)
    }
    defer { MockURLProtocol.requestHandler = nil }

    let push = try await provider.push(config: config, payload: IntegrationPayload(envelope: local))
    let refreshedConfig = try XCTUnwrap(push.updatedConfig)
    let pull = try await provider.pull(config: refreshedConfig, payload: IntegrationPayload(envelope: local))
    let revisions = try await provider.listRevisions(config: refreshedConfig)

    XCTAssertTrue(sawExpiredRequest)
    XCTAssertTrue(sawMultipartSchema)
    XCTAssertEqual(try tokenStore.secret(account: "access"), "fresh-google")
    XCTAssertEqual(pull.conflicts.first?.remoteContent, "remote")
    XCTAssertEqual(revisions.first?.id, "gdrive-rev-rev1")
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

private final class MemorySecretStore: WritableSecretStore, @unchecked Sendable {
  private let lock = NSLock()
  private var values: [String: String]

  init(values: [String: String]) {
    self.values = values
  }

  func secret(account: String) throws -> String? {
    lock.lock()
    defer { lock.unlock() }
    return values[account]
  }

  func setSecret(_ value: String, account: String) throws {
    lock.lock()
    defer { lock.unlock() }
    values[account] = value
  }

  func deleteSecret(account: String) throws {
    lock.lock()
    defer { lock.unlock() }
    values.removeValue(forKey: account)
  }
}

private func requestBodyData(_ request: URLRequest) -> Data {
  if let body = request.httpBody {
    return body
  }
  guard let stream = request.httpBodyStream else {
    return Data()
  }

  stream.open()
  defer { stream.close() }
  var data = Data()
  let bufferSize = 1_024
  let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
  defer { buffer.deallocate() }

  while stream.hasBytesAvailable {
    let count = stream.read(buffer, maxLength: bufferSize)
    if count <= 0 {
      break
    }
    data.append(buffer, count: count)
  }
  return data
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
