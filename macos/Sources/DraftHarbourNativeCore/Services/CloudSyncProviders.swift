import Foundation

private let cloudManifestName = "_manifest.json"

private struct CloudProviderDocument: Codable, Equatable {
  var id: String
  var title: String
  var body: String
  var order: Int
  var updatedAt: Int64

  enum CodingKeys: String, CodingKey {
    case id
    case title
    case body
    case content
    case order
    case updatedAt
  }

  init(section: Section) {
    self.id = section.id
    self.title = section.title
    self.body = section.content ?? ""
    self.order = section.order
    self.updatedAt = section.updatedAt
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    id = try container.decode(String.self, forKey: .id)
    title = try container.decode(String.self, forKey: .title)
    body = try container.decodeIfPresent(String.self, forKey: .body)
      ?? container.decodeIfPresent(String.self, forKey: .content)
      ?? ""
    order = try container.decodeIfPresent(Int.self, forKey: .order) ?? 0
    updatedAt = try container.decode(Int64.self, forKey: .updatedAt)
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(id, forKey: .id)
    try container.encode(title, forKey: .title)
    try container.encode(body, forKey: .body)
    try container.encode(order, forKey: .order)
    try container.encode(updatedAt, forKey: .updatedAt)
  }

  var providerDocument: ProviderDocument {
    ProviderDocument(id: id, title: title, content: body, updatedAt: updatedAt)
  }
}

private struct CloudManifest: Codable {
  var novelId: String
  var projectType: ProjectType
  var chapterIds: [String]
  var syncedAt: Int64
}

private struct OAuthTokenSupport: Sendable {
  var provider: IntegrationType
  var tokenClient: OAuthTokenClient
  var tokenStore: (any WritableSecretStore)?

  init(
    provider: IntegrationType,
    tokenClient: OAuthTokenClient,
    tokenStore: (any WritableSecretStore)?
  ) {
    self.provider = provider
    self.tokenClient = tokenClient
    self.tokenStore = tokenStore
  }

  func accessToken(config: inout IntegrationConfig, forceRefresh: Bool = false) async throws -> String {
    if forceRefresh || shouldRefresh(config) {
      if let refreshToken = try OAuthTokenPersistence.tokenValue(config.refreshToken, account: config.refreshTokenKeychainAccount, tokenStore: tokenStore),
         let clientID = config.clientId,
         !clientID.isEmpty {
        let tokens = try await tokenClient.refreshAccessToken(
          provider: provider,
          refreshToken: refreshToken,
          clientID: clientID
        )
        try OAuthTokenPersistence.apply(tokens: tokens, provider: provider, clientID: clientID, to: &config, tokenStore: tokenStore)
      }
    }

    if let token = try OAuthTokenPersistence.tokenValue(config.accessToken, account: config.accessTokenKeychainAccount, tokenStore: tokenStore), !token.isEmpty {
      return token
    }

    throw DraftHarbourError.providerNotConfigured("\(provider.displayName) access token")
  }

  func deleteStoredTokens(config: IntegrationConfig) throws {
    try OAuthTokenPersistence.deleteStoredTokens(config: config, tokenStore: tokenStore)
  }

  private func shouldRefresh(_ config: IntegrationConfig) -> Bool {
    guard config.refreshToken != nil || config.refreshTokenKeychainAccount != nil else { return false }
    guard let expiresAt = config.expiresAt else { return false }
    return expiresAt <= currentTimeMilliseconds() + 60_000
  }
}

public struct DropboxSyncProvider: IntegrationProvider {
  public let type: IntegrationType = .dropbox
  public var session: URLSession
  public var tokenClient: OAuthTokenClient
  public var tokenStore: (any WritableSecretStore)?

  private let apiBase = URL(string: "https://api.dropboxapi.com/2")!
  private let contentBase = URL(string: "https://content.dropboxapi.com/2")!

  public init(
    session: URLSession = .shared,
    tokenClient: OAuthTokenClient = OAuthTokenClient(),
    tokenStore: (any WritableSecretStore)? = KeychainClient.shared
  ) {
    self.session = session
    self.tokenClient = tokenClient
    self.tokenStore = tokenStore
  }

  public func connect(config: IntegrationConfig) async throws -> IntegrationResult {
    var working = try requireEnabled(config)
    let account = try await dropboxJSON(
      path: "users/get_current_account",
      config: &working,
      method: "POST",
      body: Data("null".utf8)
    )
    let folderPath = folderPath(for: working)
    try await ensureFolderExists(folderPath, config: &working)
    let displayName = ((account["name"] as? [String: Any])?["display_name"] as? String)
      ?? account["email"] as? String
      ?? working.providerUserId
      ?? "Dropbox"
    working.providerUserId = working.providerUserId ?? account["account_id"] as? String
    return IntegrationResult(
      provider: type,
      message: "Connected to Dropbox as \(displayName). Folder: \(folderPath)",
      updatedConfig: working
    )
  }

  public func push(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    var working = try requireEnabled(config)
    let folderPath = folderPath(for: working)
    try await ensureFolderExists(folderPath, config: &working)

    for section in payload.envelope.sections {
      let document = CloudProviderDocument(section: section)
      let data = try JSONEncoder().encode(document)
      try await uploadFile(path: "\(folderPath)/\(section.id).json", data: data, config: &working)
    }

    let manifest = CloudManifest(
      novelId: payload.envelope.project.id,
      projectType: payload.envelope.projectType,
      chapterIds: payload.envelope.sections.map(\.id),
      syncedAt: currentTimeMilliseconds()
    )
    try await uploadFile(path: "\(folderPath)/\(cloudManifestName)", data: try JSONEncoder().encode(manifest), config: &working)

    return IntegrationResult(
      provider: type,
      message: "Uploaded \(payload.envelope.sections.count) section(s) to Dropbox.",
      updatedConfig: working
    )
  }

  public func pull(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    var working = try requireEnabled(config)
    let folderPath = folderPath(for: working)
    let entries = try await listFiles(folderPath: folderPath, config: &working)
    let documents = try await downloadedDocuments(from: entries, config: &working)

    guard !documents.isEmpty else {
      return IntegrationResult(provider: type, message: "No Dropbox sections found.", pulledEnvelope: payload.envelope, updatedConfig: working)
    }

    let orderedDocuments = documents.sorted { $0.order < $1.order }
    var remotePayload = ProviderPayload(envelope: payload.envelope)
    remotePayload.documents = orderedDocuments.map(\.providerDocument)
    let pullResult = GenericRESTSyncProvider(type: type).merge(remote: remotePayload, into: payload.envelope)
    let pulledEnvelope = applyCloudOrder(to: pullResult.envelope, documents: orderedDocuments)
    return IntegrationResult(
      provider: type,
      message: "Pulled \(documents.count) section(s) from Dropbox.",
      conflicts: pullResult.conflicts,
      pulledEnvelope: pulledEnvelope,
      updatedConfig: working
    )
  }

  public func listRevisions(config: IntegrationConfig) async throws -> [RemoteRevision] {
    var working = try requireEnabled(config)
    let folderPath = folderPath(for: working)
    let manifestPath = "\(folderPath)/\(cloudManifestName)"
    let requestBody = try JSONSerialization.data(withJSONObject: ["path": manifestPath, "limit": 10])
    do {
      let payload = try await dropboxJSON(path: "files/list_revisions", config: &working, method: "POST", body: requestBody)
      let entries = payload["entries"] as? [[String: Any]] ?? []
      return entries.enumerated().compactMap { index, entry in
        guard let rev = entry["rev"] as? String,
              let modified = entry["server_modified"] as? String,
              let date = ISO8601DateFormatter().date(from: modified) else {
          return nil
        }
        return RemoteRevision(
          id: "dropbox-rev-\(rev)",
          provider: type,
          title: index == 0 ? "Latest Sync" : "Sync \(date.formatted())",
          updatedAt: Int64(date.timeIntervalSince1970 * 1_000)
        )
      }
    } catch {
      return try await listFiles(folderPath: folderPath, config: &working)
        .filter { $0.serverModified != nil && $0.name != cloudManifestName }
        .prefix(5)
        .map {
          RemoteRevision(
            id: $0.rev.map { "dropbox-rev-\($0)" } ?? "dropbox-file-\($0.name)",
            provider: type,
            title: $0.name.replacingOccurrences(of: ".json", with: ""),
            updatedAt: $0.serverModified.map { Int64($0.timeIntervalSince1970 * 1_000) } ?? currentTimeMilliseconds()
          )
        }
    }
  }

  private func requireEnabled(_ config: IntegrationConfig) throws -> IntegrationConfig {
    guard config.enabled else { throw DraftHarbourError.providerNotConfigured(type.rawValue) }
    return config
  }

  private func folderPath(for config: IntegrationConfig) -> String {
    let raw = config.folderId?.trimmingCharacters(in: .whitespacesAndNewlines)
    let folder = raw?.isEmpty == false ? raw! : "/DraftHarbour"
    return folder.hasPrefix("/") ? folder : "/\(folder)"
  }

  private func ensureFolderExists(_ path: String, config: inout IntegrationConfig) async throws {
    let body = try JSONSerialization.data(withJSONObject: ["path": path, "autorename": false])
    do {
      _ = try await dropboxData(path: "files/create_folder_v2", config: &config, method: "POST", body: body, allowedStatuses: [409])
    } catch {
      let metadata = try JSONSerialization.data(withJSONObject: ["path": path])
      _ = try await dropboxData(path: "files/get_metadata", config: &config, method: "POST", body: metadata)
    }
  }

  private func listFiles(folderPath: String, config: inout IntegrationConfig) async throws -> [DropboxEntry] {
    let body = try JSONSerialization.data(withJSONObject: ["path": folderPath, "recursive": false])
    var payload = try await dropboxJSON(path: "files/list_folder", config: &config, method: "POST", body: body)
    var entries = decodeDropboxEntries(payload["entries"] as? [[String: Any]] ?? [])
    var cursor = payload["cursor"] as? String
    var hasMore = payload["has_more"] as? Bool ?? false

    while hasMore, let currentCursor = cursor {
      let continueBody = try JSONSerialization.data(withJSONObject: ["cursor": currentCursor])
      payload = try await dropboxJSON(path: "files/list_folder/continue", config: &config, method: "POST", body: continueBody)
      entries.append(contentsOf: decodeDropboxEntries(payload["entries"] as? [[String: Any]] ?? []))
      cursor = payload["cursor"] as? String
      hasMore = payload["has_more"] as? Bool ?? false
    }

    return entries.filter { $0.tag == "file" }
  }

  private func downloadedDocuments(from entries: [DropboxEntry], config: inout IntegrationConfig) async throws -> [CloudProviderDocument] {
    var documents: [CloudProviderDocument] = []
    for entry in entries where entry.name != cloudManifestName && entry.name.hasSuffix(".json") {
      guard let data = try? await downloadFile(path: entry.pathDisplay ?? entry.pathLower, config: &config) else { continue }
      if let document = try? JSONDecoder().decode(CloudProviderDocument.self, from: data) {
        documents.append(document)
      }
    }
    return documents
  }

  private func uploadFile(path: String, data: Data, config: inout IntegrationConfig) async throws {
    var headers = [
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": jsonHeader(["path": path, "mode": "overwrite", "autorename": false, "mute": true])
    ]
    _ = try await authorizedData(url: contentBase.appending(path: "files/upload"), config: &config, method: "POST", headers: &headers, body: data)
  }

  private func downloadFile(path: String, config: inout IntegrationConfig) async throws -> Data {
    var headers = ["Dropbox-API-Arg": jsonHeader(["path": path])]
    return try await authorizedData(url: contentBase.appending(path: "files/download"), config: &config, method: "POST", headers: &headers)
  }

  private func dropboxJSON(path: String, config: inout IntegrationConfig, method: String, body: Data? = nil) async throws -> [String: Any] {
    let data = try await dropboxData(path: path, config: &config, method: method, body: body)
    return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
  }

  @discardableResult
  private func dropboxData(
    path: String,
    config: inout IntegrationConfig,
    method: String,
    body: Data? = nil,
    allowedStatuses: Set<Int> = []
  ) async throws -> Data {
    var headers = ["Content-Type": "application/json"]
    return try await authorizedData(
      url: apiBase.appending(path: path),
      config: &config,
      method: method,
      headers: &headers,
      body: body,
      allowedStatuses: allowedStatuses
    )
  }

  private func authorizedData(
    url: URL,
    config: inout IntegrationConfig,
    method: String,
    headers: inout [String: String],
    body: Data? = nil,
    allowedStatuses: Set<Int> = []
  ) async throws -> Data {
    let support = OAuthTokenSupport(provider: type, tokenClient: tokenClient, tokenStore: tokenStore)
    var token = try await support.accessToken(config: &config)
    var result = try await send(url: url, token: token, method: method, headers: headers, body: body)
    if result.statusCode == 401 {
      token = try await support.accessToken(config: &config, forceRefresh: true)
      result = try await send(url: url, token: token, method: method, headers: headers, body: body)
    }
    try validate(status: result.statusCode, data: result.data, allowedStatuses: allowedStatuses)
    return result.data
  }

  private func send(url: URL, token: String, method: String, headers: [String: String], body: Data?) async throws -> (data: Data, statusCode: Int) {
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    for (key, value) in headers {
      request.setValue(value, forHTTPHeaderField: key)
    }
    request.httpBody = body
    let (data, response) = try await session.data(for: request)
    return (data, (response as? HTTPURLResponse)?.statusCode ?? 200)
  }

  private func validate(status: Int, data: Data, allowedStatuses: Set<Int>) throws {
    if (200..<300).contains(status) || allowedStatuses.contains(status) {
      return
    }
    if status == 429 {
      throw DraftHarbourError.oauthFailure("Dropbox rate limit reached. Try again later.")
    }
    if status == 401 || status == 403 {
      throw DraftHarbourError.oauthFailure("Dropbox authorization failed. Reconnect your account.")
    }
    if status == 404 || status == 409 {
      throw DraftHarbourError.oauthFailure("Dropbox path not found or unavailable.")
    }
    let detail = String(data: data, encoding: .utf8) ?? ""
    throw DraftHarbourError.oauthFailure("Dropbox API HTTP \(status). \(detail)")
  }

  private func decodeDropboxEntries(_ raw: [[String: Any]]) -> [DropboxEntry] {
    raw.map { entry in
      DropboxEntry(
        tag: entry[".tag"] as? String ?? "",
        name: entry["name"] as? String ?? "",
        pathLower: entry["path_lower"] as? String ?? "",
        pathDisplay: entry["path_display"] as? String,
        serverModified: (entry["server_modified"] as? String).flatMap { ISO8601DateFormatter().date(from: $0) },
        rev: entry["rev"] as? String
      )
    }
  }
}

private struct DropboxEntry {
  var tag: String
  var name: String
  var pathLower: String
  var pathDisplay: String?
  var serverModified: Date?
  var rev: String?
}

public struct GoogleDriveSyncProvider: IntegrationProvider {
  public let type: IntegrationType = .googleDrive
  public var session: URLSession
  public var tokenClient: OAuthTokenClient
  public var tokenStore: (any WritableSecretStore)?

  private let driveAPI = URL(string: "https://www.googleapis.com/drive/v3")!
  private let driveUpload = URL(string: "https://www.googleapis.com/upload/drive/v3")!

  public init(
    session: URLSession = .shared,
    tokenClient: OAuthTokenClient = OAuthTokenClient(),
    tokenStore: (any WritableSecretStore)? = KeychainClient.shared
  ) {
    self.session = session
    self.tokenClient = tokenClient
    self.tokenStore = tokenStore
  }

  public func connect(config: IntegrationConfig) async throws -> IntegrationResult {
    var working = try requireEnabled(config)
    let account = try await googleJSON(path: "about", config: &working, query: ["fields": "user"])
    let folderId = try await getOrCreateAppFolder(config: &working)
    let user = account["user"] as? [String: Any]
    let displayName = user?["displayName"] as? String ?? user?["emailAddress"] as? String ?? "Google Drive"
    working.providerUserId = working.providerUserId ?? user?["emailAddress"] as? String
    working.folderId = folderId
    return IntegrationResult(
      provider: type,
      message: "Connected to Google Drive as \(displayName).",
      updatedConfig: working
    )
  }

  public func push(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    var working = try requireEnabled(config)
    let folderId = try await getOrCreateAppFolder(config: &working)
    for section in payload.envelope.sections {
      let document = CloudProviderDocument(section: section)
      try await upsertFile(folderId: folderId, name: "\(section.id).json", data: try JSONEncoder().encode(document), config: &working)
    }
    let manifest = CloudManifest(
      novelId: payload.envelope.project.id,
      projectType: payload.envelope.projectType,
      chapterIds: payload.envelope.sections.map(\.id),
      syncedAt: currentTimeMilliseconds()
    )
    try await upsertFile(folderId: folderId, name: cloudManifestName, data: try JSONEncoder().encode(manifest), config: &working)
    return IntegrationResult(
      provider: type,
      message: "Pushed \(payload.envelope.sections.count) section(s) to Google Drive.",
      updatedConfig: working
    )
  }

  public func pull(config: IntegrationConfig, payload: IntegrationPayload) async throws -> IntegrationResult {
    var working = try requireEnabled(config)
    let folderId = try await getOrCreateAppFolder(config: &working)
    let files = try await listFiles(folderId: folderId, config: &working)
    var documents: [CloudProviderDocument] = []
    for file in files where file.name != cloudManifestName {
      guard let data = try? await googleData(path: "files/\(file.id)", config: &working, query: ["alt": "media"]) else { continue }
      if let document = try? JSONDecoder().decode(CloudProviderDocument.self, from: data) {
        documents.append(document)
      }
    }

    guard !documents.isEmpty else {
      return IntegrationResult(provider: type, message: "No Google Drive sections found.", pulledEnvelope: payload.envelope, updatedConfig: working)
    }

    let orderedDocuments = documents.sorted { $0.order < $1.order }
    var remotePayload = ProviderPayload(envelope: payload.envelope)
    remotePayload.documents = orderedDocuments.map(\.providerDocument)
    let pullResult = GenericRESTSyncProvider(type: type).merge(remote: remotePayload, into: payload.envelope)
    let pulledEnvelope = applyCloudOrder(to: pullResult.envelope, documents: orderedDocuments)
    return IntegrationResult(
      provider: type,
      message: "Pulled \(documents.count) section(s) from Google Drive.",
      conflicts: pullResult.conflicts,
      pulledEnvelope: pulledEnvelope,
      updatedConfig: working
    )
  }

  public func listRevisions(config: IntegrationConfig) async throws -> [RemoteRevision] {
    var working = try requireEnabled(config)
    let folderId = try await getOrCreateAppFolder(config: &working)
    if let manifest = try await findFile(folderId: folderId, name: cloudManifestName, config: &working) {
      do {
        let payload = try await googleJSON(path: "files/\(manifest.id)/revisions", config: &working, query: ["fields": "revisions(id,modifiedTime)"])
        let revisions = payload["revisions"] as? [[String: Any]] ?? []
        return revisions
          .compactMap { revision -> (String, Date)? in
            guard let id = revision["id"] as? String,
                  let modified = revision["modifiedTime"] as? String,
                  let date = ISO8601DateFormatter().date(from: modified) else {
              return nil
            }
            return (id, date)
          }
          .sorted { $0.1 > $1.1 }
          .prefix(10)
          .enumerated()
          .map { index, revision in
            RemoteRevision(
              id: "gdrive-rev-\(revision.0)",
              provider: type,
              title: index == 0 ? "Latest Sync" : "Sync \(revision.1.formatted())",
              updatedAt: Int64(revision.1.timeIntervalSince1970 * 1_000)
            )
          }
      } catch {
        // Fall through to file modified times.
      }
    }

    return try await listFiles(folderId: folderId, config: &working)
      .filter { $0.name != cloudManifestName && $0.modifiedTime != nil }
      .sorted { ($0.modifiedTime ?? .distantPast) > ($1.modifiedTime ?? .distantPast) }
      .prefix(10)
      .map {
        RemoteRevision(
          id: "gdrive-file-\($0.id)",
          provider: type,
          title: $0.name.replacingOccurrences(of: ".json", with: ""),
          updatedAt: Int64(($0.modifiedTime ?? Date()).timeIntervalSince1970 * 1_000)
        )
      }
  }

  private func requireEnabled(_ config: IntegrationConfig) throws -> IntegrationConfig {
    guard config.enabled else { throw DraftHarbourError.providerNotConfigured(type.rawValue) }
    return config
  }

  private func getOrCreateAppFolder(config: inout IntegrationConfig) async throws -> String {
    if let folderId = config.folderId, !folderId.isEmpty {
      return folderId
    }

    let query = "name='DraftHarbour' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    let payload = try await googleJSON(path: "files", config: &config, query: [
      "q": query,
      "fields": "files(id,name)",
      "spaces": "drive"
    ])
    let files = decodeDriveFiles(payload["files"] as? [[String: Any]] ?? [])
    if let existing = files.first {
      config.folderId = existing.id
      return existing.id
    }

    let body = try JSONSerialization.data(withJSONObject: [
      "name": "DraftHarbour",
      "mimeType": "application/vnd.google-apps.folder"
    ])
    let created = try await googleJSON(path: "files", config: &config, method: "POST", body: body, contentType: "application/json")
    guard let id = created["id"] as? String else {
      throw DraftHarbourError.oauthFailure("Google Drive did not return an app folder ID.")
    }
    config.folderId = id
    return id
  }

  private func listFiles(folderId: String, config: inout IntegrationConfig) async throws -> [DriveFile] {
    var files: [DriveFile] = []
    var pageToken: String?

    repeat {
      var query = [
        "q": "'\(folderId)' in parents and trashed=false and mimeType='application/json'",
        "fields": "files(id,name,modifiedTime,mimeType),nextPageToken",
        "spaces": "drive",
        "pageSize": "100"
      ]
      if let pageToken {
        query["pageToken"] = pageToken
      }

      let payload = try await googleJSON(path: "files", config: &config, query: query)
      files.append(contentsOf: decodeDriveFiles(payload["files"] as? [[String: Any]] ?? []))
      pageToken = payload["nextPageToken"] as? String
    } while pageToken != nil

    return files
  }

  private func findFile(folderId: String, name: String, config: inout IntegrationConfig) async throws -> DriveFile? {
    let query = "'\(folderId)' in parents and name='\(name)' and trashed=false"
    let payload = try await googleJSON(path: "files", config: &config, query: ["q": query, "fields": "files(id,name,modifiedTime)"])
    return decodeDriveFiles(payload["files"] as? [[String: Any]] ?? []).first
  }

  private func upsertFile(folderId: String, name: String, data: Data, config: inout IntegrationConfig) async throws {
    if let existing = try await findFile(folderId: folderId, name: name, config: &config) {
      _ = try await googleData(
        url: driveUpload.appending(path: "files/\(existing.id)"),
        config: &config,
        method: "PATCH",
        query: ["uploadType": "media"],
        body: data,
        contentType: "application/json"
      )
      return
    }

    let boundary = "draftharbour_\(currentTimeMilliseconds())"
    let metadata = try JSONSerialization.data(withJSONObject: [
      "name": name,
      "parents": [folderId],
      "mimeType": "application/json"
    ])
    var body = Data()
    body.append("--\(boundary)\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n".data(using: .utf8)!)
    body.append(metadata)
    body.append("\r\n--\(boundary)\r\nContent-Type: application/json\r\n\r\n".data(using: .utf8)!)
    body.append(data)
    body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

    _ = try await googleData(
      url: driveUpload.appending(path: "files"),
      config: &config,
      method: "POST",
      query: ["uploadType": "multipart"],
      body: body,
      contentType: "multipart/related; boundary=\(boundary)"
    )
  }

  private func googleJSON(
    path: String,
    config: inout IntegrationConfig,
    method: String = "GET",
    query: [String: String] = [:],
    body: Data? = nil,
    contentType: String? = nil
  ) async throws -> [String: Any] {
    let data = try await googleData(path: path, config: &config, method: method, query: query, body: body, contentType: contentType)
    return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
  }

  private func googleData(
    path: String,
    config: inout IntegrationConfig,
    method: String = "GET",
    query: [String: String] = [:],
    body: Data? = nil,
    contentType: String? = nil
  ) async throws -> Data {
    try await googleData(url: driveAPI.appending(path: path), config: &config, method: method, query: query, body: body, contentType: contentType)
  }

  private func googleData(
    url: URL,
    config: inout IntegrationConfig,
    method: String,
    query: [String: String] = [:],
    body: Data? = nil,
    contentType: String? = nil
  ) async throws -> Data {
    let support = OAuthTokenSupport(provider: type, tokenClient: tokenClient, tokenStore: tokenStore)
    var token = try await support.accessToken(config: &config)
    var result = try await send(url: url, token: token, method: method, query: query, body: body, contentType: contentType)
    if result.statusCode == 401 {
      token = try await support.accessToken(config: &config, forceRefresh: true)
      result = try await send(url: url, token: token, method: method, query: query, body: body, contentType: contentType)
    }
    try validate(status: result.statusCode, data: result.data)
    return result.data
  }

  private func send(
    url: URL,
    token: String,
    method: String,
    query: [String: String],
    body: Data?,
    contentType: String?
  ) async throws -> (data: Data, statusCode: Int) {
    var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
    if !query.isEmpty {
      components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
    }
    var request = URLRequest(url: components.url!)
    request.httpMethod = method
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    if let contentType {
      request.setValue(contentType, forHTTPHeaderField: "Content-Type")
    }
    request.httpBody = body
    let (data, response) = try await session.data(for: request)
    return (data, (response as? HTTPURLResponse)?.statusCode ?? 200)
  }

  private func validate(status: Int, data: Data) throws {
    if (200..<300).contains(status) {
      return
    }
    if status == 401 || status == 403 {
      throw DraftHarbourError.oauthFailure("Google Drive authorization failed. Reconnect your account.")
    }
    if status == 404 {
      throw DraftHarbourError.oauthFailure("Google Drive resource was not found.")
    }
    if status == 429 {
      throw DraftHarbourError.oauthFailure("Google Drive rate limit reached. Try again later.")
    }
    let detail = String(data: data, encoding: .utf8) ?? ""
    throw DraftHarbourError.oauthFailure("Google Drive API HTTP \(status). \(detail)")
  }

  private func decodeDriveFiles(_ raw: [[String: Any]]) -> [DriveFile] {
    raw.compactMap { file in
      guard let id = file["id"] as? String, let name = file["name"] as? String else { return nil }
      return DriveFile(
        id: id,
        name: name,
        modifiedTime: (file["modifiedTime"] as? String).flatMap { ISO8601DateFormatter().date(from: $0) }
      )
    }
  }
}

private struct DriveFile {
  var id: String
  var name: String
  var modifiedTime: Date?
}

private func jsonHeader(_ value: [String: Any]) -> String {
  guard let data = try? JSONSerialization.data(withJSONObject: value),
        let text = String(data: data, encoding: .utf8) else {
    return "{}"
  }
  return text
}

private func applyCloudOrder(to envelope: DhprojEnvelope, documents: [CloudProviderDocument]) -> DhprojEnvelope {
  let remoteOrder = Dictionary(uniqueKeysWithValues: documents.map { ($0.id, $0.order) })
  var ordered = envelope
  ordered.sections.sort { lhs, rhs in
    let lhsOrder = remoteOrder[lhs.id] ?? lhs.order
    let rhsOrder = remoteOrder[rhs.id] ?? rhs.order
    if lhsOrder == rhsOrder {
      return lhs.order < rhs.order
    }
    return lhsOrder < rhsOrder
  }
  return DhprojCodec.normalize(ordered)
}
