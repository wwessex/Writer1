import AppKit
import DraftHarbourNativeCore
import Foundation
import Network

@MainActor
final class OAuthCallbackCenter {
  static let shared = OAuthCallbackCenter()

  private var continuations: [IntegrationType: CheckedContinuation<URL, Error>] = [:]

  private init() {}

  func waitForCallback(provider: IntegrationType) async throws -> URL {
    if continuations[provider] != nil {
      throw DraftHarbourError.oauthFailure("\(provider.displayName) OAuth is already in progress.")
    }

    return try await withCheckedThrowingContinuation { continuation in
      continuations[provider] = continuation
    }
  }

  func receive(_ url: URL) {
    guard url.scheme == "draftharbour",
          url.host == "oauth",
          url.path == "/dropbox" else {
      return
    }
    resume(provider: .dropbox, with: .success(url))
  }

  private func resume(provider: IntegrationType, with result: Result<URL, Error>) {
    guard let continuation = continuations.removeValue(forKey: provider) else { return }
    switch result {
    case .success(let url):
      continuation.resume(returning: url)
    case .failure(let error):
      continuation.resume(throwing: error)
    }
  }
}

@MainActor
final class NativeOAuthCoordinator {
  static let shared = NativeOAuthCoordinator()

  private let tokenClient: OAuthTokenClient

  init(tokenClient: OAuthTokenClient = OAuthTokenClient()) {
    self.tokenClient = tokenClient
  }

  func connect(provider: IntegrationType, clientID: String, existingConfig: IntegrationConfig) async throws -> IntegrationConfig {
    switch provider {
    case .dropbox:
      return try await connectWithCustomScheme(provider: provider, clientID: clientID, existingConfig: existingConfig)
    case .googleDrive:
      return try await connectWithLoopback(provider: provider, clientID: clientID, existingConfig: existingConfig)
    case .genericREST, .scrivener:
      throw DraftHarbourError.oauthFailure("\(provider.displayName) does not use OAuth.")
    }
  }

  func disconnect(provider: IntegrationType, config: IntegrationConfig) async throws -> IntegrationConfig {
    let accessToken = try OAuthTokenPersistence.tokenValue(
      config.accessToken,
      account: config.accessTokenKeychainAccount,
      tokenStore: KeychainClient.shared
    )
    var revokeMessage: String?
    if let accessToken, !accessToken.isEmpty {
      do {
        try await tokenClient.revoke(provider: provider, accessToken: accessToken)
      } catch {
        revokeMessage = "Token revoke failed: \(error.localizedDescription)"
      }
    }
    try OAuthTokenPersistence.deleteStoredTokens(config: config, tokenStore: KeychainClient.shared)

    return IntegrationConfig(
      type: provider,
      enabled: false,
      status: revokeMessage ?? "Disconnected",
      clientId: config.clientId,
      baseUrl: config.baseUrl,
      syncFolderPath: config.syncFolderPath,
      version: config.version
    )
  }

  private func connectWithCustomScheme(
    provider: IntegrationType,
    clientID: String,
    existingConfig: IntegrationConfig
  ) async throws -> IntegrationConfig {
    let redirectURI = "draftharbour://oauth/dropbox"
    let request = try NativeOAuthConfiguration.authorizationRequest(
      provider: provider,
      clientID: clientID,
      redirectURI: redirectURI
    )
    try openAuthorizationURL(request.authorizationURL)
    let callbackURL = try await OAuthCallbackCenter.shared.waitForCallback(provider: provider)
    let callback = try OAuthCallback.parse(url: callbackURL, expectedState: request.state)
    let tokens = try await tokenClient.exchangeAuthorizationCode(
      provider: provider,
      code: callback.code,
      codeVerifier: request.codeVerifier,
      clientID: clientID,
      redirectURI: redirectURI
    )

    var config = existingConfig
    try OAuthTokenPersistence.apply(
      tokens: tokens,
      provider: provider,
      clientID: clientID,
      to: &config,
      tokenStore: KeychainClient.shared
    )
    return config
  }

  private func connectWithLoopback(
    provider: IntegrationType,
    clientID: String,
    existingConfig: IntegrationConfig
  ) async throws -> IntegrationConfig {
    let receiver = try LoopbackOAuthReceiver()
    let request = try NativeOAuthConfiguration.authorizationRequest(
      provider: provider,
      clientID: clientID,
      redirectURI: receiver.redirectURI
    )
    try openAuthorizationURL(request.authorizationURL)
    let callbackURL = try await receiver.waitForCallback()
    let callback = try OAuthCallback.parse(url: callbackURL, expectedState: request.state)
    let tokens = try await tokenClient.exchangeAuthorizationCode(
      provider: provider,
      code: callback.code,
      codeVerifier: request.codeVerifier,
      clientID: clientID,
      redirectURI: request.redirectURI
    )

    var config = existingConfig
    try OAuthTokenPersistence.apply(
      tokens: tokens,
      provider: provider,
      clientID: clientID,
      to: &config,
      tokenStore: KeychainClient.shared
    )
    return config
  }

  private func openAuthorizationURL(_ url: URL) throws {
    guard NSWorkspace.shared.open(url) else {
      throw DraftHarbourError.oauthFailure("Could not open the system browser for OAuth.")
    }
  }
}

private final class LoopbackOAuthReceiver: @unchecked Sendable {
  let redirectURI: String

  private let listener: NWListener
  private let port: UInt16
  private let queue = DispatchQueue(label: "studio.draftharbour.oauth.loopback")
  private let lock = NSLock()
  private var continuation: CheckedContinuation<URL, Error>?

  init() throws {
    var selectedListener: NWListener?
    var selectedPort: UInt16?
    for _ in 0..<30 {
      let port = UInt16.random(in: 49_152...65_535)
      guard let endpointPort = NWEndpoint.Port(rawValue: port) else { continue }
      do {
        selectedListener = try NWListener(using: .tcp, on: endpointPort)
        selectedPort = port
        break
      } catch {
        continue
      }
    }

    guard let listener = selectedListener, let port = selectedPort else {
      throw DraftHarbourError.oauthFailure("Could not start a local OAuth callback listener.")
    }

    self.listener = listener
    self.port = port
    self.redirectURI = "http://127.0.0.1:\(port)"
  }

  func waitForCallback() async throws -> URL {
    try await withCheckedThrowingContinuation { continuation in
      lock.lock()
      self.continuation = continuation
      lock.unlock()

      listener.stateUpdateHandler = { [weak self] state in
        guard let self else { return }
        if case .failed(let error) = state {
          self.resume(with: .failure(DraftHarbourError.oauthFailure("OAuth loopback listener failed: \(error.localizedDescription)")))
        }
      }
      listener.newConnectionHandler = { [weak self] connection in
        self?.handle(connection)
      }
      listener.start(queue: queue)
    }
  }

  private func handle(_ connection: NWConnection) {
    connection.start(queue: queue)
    connection.receive(minimumIncompleteLength: 1, maximumLength: 8_192) { [weak self] data, _, _, error in
      guard let self else { return }
      if let error {
        self.sendResponse("Authorization failed.", status: "500 Internal Server Error", connection: connection)
        self.resume(with: .failure(DraftHarbourError.oauthFailure(error.localizedDescription)))
        return
      }

      guard let data,
            let requestLine = String(data: data, encoding: .utf8)?.components(separatedBy: "\r\n").first,
            let target = requestLine.split(separator: " ").dropFirst().first,
            let callbackURL = URL(string: "http://127.0.0.1:\(self.port)\(target)") else {
        self.sendResponse("Authorization callback was invalid.", status: "400 Bad Request", connection: connection)
        self.resume(with: .failure(DraftHarbourError.oauthFailure("Invalid OAuth loopback callback.")))
        return
      }

      self.sendResponse("DraftHarbour is connected. You can close this browser tab.", status: "200 OK", connection: connection)
      self.resume(with: .success(callbackURL))
    }
  }

  private func sendResponse(_ message: String, status: String, connection: NWConnection) {
    let html = """
    <!doctype html><html><head><meta charset="utf-8"><title>DraftHarbour</title></head><body><p>\(message)</p></body></html>
    """
    let body = Data(html.utf8)
    let header = "HTTP/1.1 \(status)\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: \(body.count)\r\nConnection: close\r\n\r\n"
    var payload = Data(header.utf8)
    payload.append(body)
    connection.send(content: payload, completion: .contentProcessed { _ in
      connection.cancel()
    })
  }

  private func resume(with result: Result<URL, Error>) {
    lock.lock()
    let continuation = continuation
    self.continuation = nil
    lock.unlock()

    listener.cancel()
    guard let continuation else { return }
    switch result {
    case .success(let url):
      continuation.resume(returning: url)
    case .failure(let error):
      continuation.resume(throwing: error)
    }
  }
}
