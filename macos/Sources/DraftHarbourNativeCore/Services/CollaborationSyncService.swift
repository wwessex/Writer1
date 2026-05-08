import Foundation

public struct CollaborationSyncConfig: Equatable, Sendable {
  public var endpoint: URL
  public var bearerToken: String?

  public init(endpoint: URL, bearerToken: String? = nil) {
    self.endpoint = endpoint
    self.bearerToken = bearerToken
  }
}

public struct CollaborationSyncClient: Sendable {
  public var session: URLSession

  public init(session: URLSession = .shared) {
    self.session = session
  }

  public func push(_ request: CollaborationSyncRequest, config: CollaborationSyncConfig) async throws -> CollaborationSyncResponse {
    var urlRequest = makeRequest(config: config, path: "projects/\(request.projectId)/collaboration", method: "PUT")
    urlRequest.httpBody = try JSONEncoder().encode(request)
    return try await decode(CollaborationSyncResponse.self, from: urlRequest)
  }

  public func pull(projectId: String, since revision: String? = nil, config: CollaborationSyncConfig) async throws -> CollaborationSyncResponse {
    var components = URLComponents(url: endpointURL(config.endpoint, path: "projects/\(projectId)/collaboration"), resolvingAgainstBaseURL: false)
    if let revision, !revision.isEmpty {
      components?.queryItems = [URLQueryItem(name: "since", value: revision)]
    }
    guard let url = components?.url else { throw URLError(.badURL) }
    var urlRequest = URLRequest(url: url)
    applyHeaders(to: &urlRequest, config: config)
    return try await decode(CollaborationSyncResponse.self, from: urlRequest)
  }

  public func sendPresence(
    projectId: String,
    presence: CollaborationPresence,
    config: CollaborationSyncConfig
  ) async throws -> CollaborationPresence {
    var urlRequest = makeRequest(config: config, path: "projects/\(projectId)/presence", method: "POST")
    urlRequest.httpBody = try JSONEncoder().encode(presence)
    return try await decode(CollaborationPresence.self, from: urlRequest)
  }

  public func acceptInvite(
    token: String,
    displayName: String,
    config: CollaborationSyncConfig
  ) async throws -> CollaborationSyncResponse {
    var urlRequest = makeRequest(config: config, path: "invites/\(token)/accept", method: "POST")
    urlRequest.httpBody = try JSONEncoder().encode(["displayName": displayName])
    return try await decode(CollaborationSyncResponse.self, from: urlRequest)
  }

  private func makeRequest(config: CollaborationSyncConfig, path: String, method: String) -> URLRequest {
    var request = URLRequest(url: endpointURL(config.endpoint, path: path))
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    applyHeaders(to: &request, config: config)
    return request
  }

  private func applyHeaders(to request: inout URLRequest, config: CollaborationSyncConfig) {
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let bearerToken = config.bearerToken, !bearerToken.isEmpty {
      request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
    }
  }

  private func endpointURL(_ endpoint: URL, path: String) -> URL {
    endpoint.appendingPathComponent(path)
  }

  private func decode<T: Decodable>(_ type: T.Type, from request: URLRequest) async throws -> T {
    let (data, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
      throw URLError(.badServerResponse)
    }
    return try JSONDecoder().decode(type, from: data)
  }
}
