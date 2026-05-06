import CryptoKit
import Foundation
import Security

public enum NativeOAuthDefaults {
  public static let googleClientID = ""
  public static let dropboxAppKey = ""
  public static let googleDriveScope = "https://www.googleapis.com/auth/drive.file"

  public static func defaultClientID(for provider: IntegrationType) -> String {
    switch provider {
    case .googleDrive:
      return googleClientID
    case .dropbox:
      return dropboxAppKey
    case .genericREST, .scrivener:
      return ""
    }
  }
}

public enum OAuthPKCE {
  private static let verifierCharacters = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")

  public static func makeCodeVerifier(length: Int = 64) throws -> String {
    guard (43...128).contains(length) else {
      throw DraftHarbourError.oauthFailure("PKCE code verifier length must be between 43 and 128 characters.")
    }

    var randomBytes = [UInt8](repeating: 0, count: length)
    let status = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
    guard status == errSecSuccess else {
      throw DraftHarbourError.keychainFailure(status)
    }

    return String(randomBytes.map { verifierCharacters[Int($0) % verifierCharacters.count] })
  }

  public static func codeChallenge(for verifier: String) -> String {
    let digest = SHA256.hash(data: Data(verifier.utf8))
    return base64URLEncode(Data(digest))
  }

  public static func makeState() -> String {
    (try? makeCodeVerifier(length: 48)) ?? UUID().uuidString
  }

  public static func base64URLEncode(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }
}

public struct OAuthAuthorizationRequest: Equatable, Sendable {
  public var provider: IntegrationType
  public var authorizationURL: URL
  public var redirectURI: String
  public var codeVerifier: String
  public var state: String

  public init(provider: IntegrationType, authorizationURL: URL, redirectURI: String, codeVerifier: String, state: String) {
    self.provider = provider
    self.authorizationURL = authorizationURL
    self.redirectURI = redirectURI
    self.codeVerifier = codeVerifier
    self.state = state
  }
}

public enum NativeOAuthConfiguration {
  private static let dropboxAuthURL = "https://www.dropbox.com/oauth2/authorize"
  private static let googleAuthURL = "https://accounts.google.com/o/oauth2/v2/auth"

  public static func tokenURL(for provider: IntegrationType) throws -> URL {
    switch provider {
    case .dropbox:
      return URL(string: "https://api.dropboxapi.com/oauth2/token")!
    case .googleDrive:
      return URL(string: "https://oauth2.googleapis.com/token")!
    case .genericREST, .scrivener:
      throw DraftHarbourError.oauthFailure("\(provider.displayName) does not use OAuth.")
    }
  }

  public static func revokeURL(for provider: IntegrationType, token: String) throws -> URL {
    switch provider {
    case .dropbox:
      return URL(string: "https://api.dropboxapi.com/2/auth/token/revoke")!
    case .googleDrive:
      var components = URLComponents(string: "https://oauth2.googleapis.com/revoke")!
      components.queryItems = [URLQueryItem(name: "token", value: token)]
      return components.url!
    case .genericREST, .scrivener:
      throw DraftHarbourError.oauthFailure("\(provider.displayName) does not use OAuth.")
    }
  }

  public static func authorizationRequest(
    provider: IntegrationType,
    clientID: String,
    redirectURI: String
  ) throws -> OAuthAuthorizationRequest {
    guard provider == .dropbox || provider == .googleDrive else {
      throw DraftHarbourError.oauthFailure("\(provider.displayName) does not use OAuth.")
    }
    guard !clientID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw DraftHarbourError.providerNotConfigured("\(provider.displayName) OAuth client ID")
    }

    let verifier = try OAuthPKCE.makeCodeVerifier()
    let challenge = OAuthPKCE.codeChallenge(for: verifier)
    let state = OAuthPKCE.makeState()
    let authorizationURL = try makeAuthorizationURL(
      provider: provider,
      clientID: clientID,
      redirectURI: redirectURI,
      codeChallenge: challenge,
      state: state
    )

    return OAuthAuthorizationRequest(
      provider: provider,
      authorizationURL: authorizationURL,
      redirectURI: redirectURI,
      codeVerifier: verifier,
      state: state
    )
  }

  public static func makeAuthorizationURL(
    provider: IntegrationType,
    clientID: String,
    redirectURI: String,
    codeChallenge: String,
    state: String
  ) throws -> URL {
    let baseURL: String
    var queryItems = [
      URLQueryItem(name: "client_id", value: clientID),
      URLQueryItem(name: "response_type", value: "code"),
      URLQueryItem(name: "redirect_uri", value: redirectURI),
      URLQueryItem(name: "code_challenge", value: codeChallenge),
      URLQueryItem(name: "code_challenge_method", value: "S256"),
      URLQueryItem(name: "state", value: state)
    ]

    switch provider {
    case .dropbox:
      baseURL = dropboxAuthURL
      queryItems.append(URLQueryItem(name: "token_access_type", value: "offline"))
    case .googleDrive:
      baseURL = googleAuthURL
      queryItems.append(contentsOf: [
        URLQueryItem(name: "scope", value: NativeOAuthDefaults.googleDriveScope),
        URLQueryItem(name: "access_type", value: "offline"),
        URLQueryItem(name: "prompt", value: "consent")
      ])
    case .genericREST, .scrivener:
      throw DraftHarbourError.oauthFailure("\(provider.displayName) does not use OAuth.")
    }

    var components = URLComponents(string: baseURL)!
    components.queryItems = queryItems
    guard let url = components.url else {
      throw DraftHarbourError.oauthFailure("Could not build \(provider.displayName) authorization URL.")
    }
    return url
  }
}

public struct OAuthCallback: Equatable, Sendable {
  public var code: String
  public var state: String?

  public init(code: String, state: String? = nil) {
    self.code = code
    self.state = state
  }

  public static func parse(url: URL, expectedState: String? = nil) throws -> OAuthCallback {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
      throw DraftHarbourError.oauthFailure("Invalid OAuth callback URL.")
    }

    let values = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).compactMap { item in
      item.value.map { (item.name, $0) }
    })

    if let error = values["error"] {
      throw DraftHarbourError.oauthFailure(values["error_description"] ?? error)
    }

    if let expectedState, values["state"] != expectedState {
      throw DraftHarbourError.oauthFailure("OAuth state did not match. Please try connecting again.")
    }

    guard let code = values["code"], !code.isEmpty else {
      throw DraftHarbourError.oauthFailure("No authorization code was returned by the provider.")
    }

    return OAuthCallback(code: code, state: values["state"])
  }
}

public struct OAuthTokenResponse: Codable, Equatable, Sendable {
  public var accessToken: String
  public var tokenType: String
  public var expiresIn: Int64?
  public var refreshToken: String?
  public var scope: String?
  public var uid: String?
  public var accountId: String?

  enum CodingKeys: String, CodingKey {
    case accessToken = "access_token"
    case tokenType = "token_type"
    case expiresIn = "expires_in"
    case refreshToken = "refresh_token"
    case scope
    case uid
    case accountId = "account_id"
  }
}

public enum OAuthTokenPersistence {
  public static func apply(
    tokens: OAuthTokenResponse,
    provider: IntegrationType,
    clientID: String,
    to config: inout IntegrationConfig,
    tokenStore: (any WritableSecretStore)? = KeychainClient.shared
  ) throws {
    let connectionID = config.connectionId ?? tokens.accountId ?? tokens.uid ?? makeIdentifier()
    config.enabled = true
    config.connectionId = connectionID
    config.providerUserId = tokens.accountId ?? tokens.uid ?? config.providerUserId
    config.scopes = tokens.scope?.split(separator: " ").map(String.init) ?? config.scopes
    config.expiresAt = currentTimeMilliseconds() + (tokens.expiresIn ?? 3_600) * 1_000
    config.status = "connected"
    config.clientId = clientID

    if let tokenStore {
      let accessAccount = config.accessTokenKeychainAccount ?? keychainAccount(provider: provider, kind: "access", connectionID: connectionID)
      try tokenStore.setSecret(tokens.accessToken, account: accessAccount)
      config.accessTokenKeychainAccount = accessAccount
      config.accessToken = nil

      if let refreshToken = tokens.refreshToken {
        let refreshAccount = config.refreshTokenKeychainAccount ?? keychainAccount(provider: provider, kind: "refresh", connectionID: connectionID)
        try tokenStore.setSecret(refreshToken, account: refreshAccount)
        config.refreshTokenKeychainAccount = refreshAccount
        config.refreshToken = nil
      }
    } else {
      config.accessToken = tokens.accessToken
      if let refreshToken = tokens.refreshToken {
        config.refreshToken = refreshToken
      }
    }
  }

  public static func tokenValue(_ inline: String?, account: String?, tokenStore: (any SecretStore)? = KeychainClient.shared) throws -> String? {
    if let inline, !inline.isEmpty {
      return inline
    }
    if let account, !account.isEmpty {
      return try tokenStore?.secret(account: account)
    }
    return nil
  }

  public static func deleteStoredTokens(config: IntegrationConfig, tokenStore: (any WritableSecretStore)? = KeychainClient.shared) throws {
    if let account = config.accessTokenKeychainAccount {
      try tokenStore?.deleteSecret(account: account)
    }
    if let account = config.refreshTokenKeychainAccount {
      try tokenStore?.deleteSecret(account: account)
    }
  }

  private static func keychainAccount(provider: IntegrationType, kind: String, connectionID: String) -> String {
    "integration.\(provider.rawValue).\(kind).\(connectionID)"
  }
}

public struct OAuthTokenClient: Sendable {
  public var session: URLSession

  public init(session: URLSession = .shared) {
    self.session = session
  }

  public func exchangeAuthorizationCode(
    provider: IntegrationType,
    code: String,
    codeVerifier: String,
    clientID: String,
    redirectURI: String
  ) async throws -> OAuthTokenResponse {
    let body = formEncodedData([
      ("grant_type", "authorization_code"),
      ("code", code),
      ("code_verifier", codeVerifier),
      ("client_id", clientID),
      ("redirect_uri", redirectURI)
    ])
    return try await tokenRequest(provider: provider, body: body)
  }

  public func refreshAccessToken(
    provider: IntegrationType,
    refreshToken: String,
    clientID: String
  ) async throws -> OAuthTokenResponse {
    let body = formEncodedData([
      ("grant_type", "refresh_token"),
      ("refresh_token", refreshToken),
      ("client_id", clientID)
    ])
    return try await tokenRequest(provider: provider, body: body)
  }

  public func revoke(provider: IntegrationType, accessToken: String) async throws {
    var request = URLRequest(url: try NativeOAuthConfiguration.revokeURL(for: provider, token: accessToken))
    request.httpMethod = "POST"
    if provider == .dropbox {
      request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    } else {
      request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    }
    let (_, response) = try await session.data(for: request)
    try validate(response, provider: provider)
  }

  private func tokenRequest(provider: IntegrationType, body: Data) async throws -> OAuthTokenResponse {
    var request = URLRequest(url: try NativeOAuthConfiguration.tokenURL(for: provider))
    request.httpMethod = "POST"
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    request.httpBody = body
    let (data, response) = try await session.data(for: request)
    try validate(response, provider: provider, data: data)
    return try JSONDecoder().decode(OAuthTokenResponse.self, from: data)
  }

  private func validate(_ response: URLResponse, provider: IntegrationType, data: Data = Data()) throws {
    guard let http = response as? HTTPURLResponse else { return }
    guard !(200..<300).contains(http.statusCode) else { return }

    if let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      let description = payload["error_description"] as? String
      let error = payload["error"] as? String
      throw DraftHarbourError.oauthFailure(description ?? error ?? "\(provider.displayName) OAuth HTTP \(http.statusCode).")
    }

    throw DraftHarbourError.oauthFailure("\(provider.displayName) OAuth HTTP \(http.statusCode).")
  }
}

private func formEncodedData(_ pairs: [(String, String)]) -> Data {
  pairs
    .map { "\(formEscape($0.0))=\(formEscape($0.1))" }
    .joined(separator: "&")
    .data(using: .utf8) ?? Data()
}

private func formEscape(_ value: String) -> String {
  var allowed = CharacterSet.urlQueryAllowed
  allowed.remove(charactersIn: ":#[]@!$&'()*+,;=")
  return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
}
