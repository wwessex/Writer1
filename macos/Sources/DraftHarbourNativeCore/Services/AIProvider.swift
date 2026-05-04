import Foundation

public struct AIRequest: Codable, Equatable, Sendable {
  public var prompt: String
  public var context: String?
  public var projectType: ProjectType
  public var sectionTitle: String?
  public var model: String?

  public init(prompt: String, context: String? = nil, projectType: ProjectType, sectionTitle: String? = nil, model: String? = nil) {
    self.prompt = prompt
    self.context = context
    self.projectType = projectType
    self.sectionTitle = sectionTitle
    self.model = model
  }
}

public struct AIResponse: Codable, Equatable, Sendable {
  public var text: String
  public var provider: String
  public var model: String?
  public var latencyMs: Int?

  public init(text: String, provider: String, model: String? = nil, latencyMs: Int? = nil) {
    self.text = text
    self.provider = provider
    self.model = model
    self.latencyMs = latencyMs
  }
}

public protocol AIProvider: Sendable {
  var id: String { get }
  var displayName: String { get }
  func generate(_ request: AIRequest) async throws -> AIResponse
}

public struct OpenAICompatibleProvider: AIProvider {
  public var id: String
  public var displayName: String
  public var endpoint: URL
  public var apiKey: String?
  public var defaultModel: String

  public init(id: String, displayName: String, endpoint: URL, apiKey: String?, defaultModel: String) {
    self.id = id
    self.displayName = displayName
    self.endpoint = endpoint
    self.apiKey = apiKey
    self.defaultModel = defaultModel
  }

  public func generate(_ request: AIRequest) async throws -> AIResponse {
    guard apiKey != nil || endpoint.host?.contains("localhost") == true || endpoint.host == "127.0.0.1" else {
      throw DraftHarbourError.providerNotConfigured(displayName)
    }

    let started = Date()
    var urlRequest = URLRequest(url: endpoint)
    urlRequest.httpMethod = "POST"
    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let apiKey, !apiKey.isEmpty {
      urlRequest.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    }

    let prompt = buildPrompt(request)
    let payload = ChatCompletionPayload(
      model: request.model ?? defaultModel,
      messages: [
        ChatMessage(role: "system", content: "You are DraftHarbour's native macOS writing assistant."),
        ChatMessage(role: "user", content: prompt)
      ]
    )
    urlRequest.httpBody = try JSONEncoder().encode(payload)

    let (data, response) = try await URLSession.shared.data(for: urlRequest)
    if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
      throw DraftHarbourError.providerNotConfigured("\(displayName) HTTP \(http.statusCode)")
    }

    let decoded = try JSONDecoder().decode(ChatCompletionResponse.self, from: data)
    return AIResponse(
      text: decoded.choices.first?.message.content ?? "",
      provider: id,
      model: request.model ?? defaultModel,
      latencyMs: Int(Date().timeIntervalSince(started) * 1000)
    )
  }

  private func buildPrompt(_ request: AIRequest) -> String {
    let sectionLabel = request.projectType == .screenplay ? "scene" : "chapter"
    if let context = request.context, !context.isEmpty {
      return "Current \(sectionLabel): \(request.sectionTitle ?? "Untitled")\n\n---\n\(context)\n---\n\n\(request.prompt)"
    }
    return request.prompt
  }
}

private struct ChatCompletionPayload: Codable {
  var model: String
  var messages: [ChatMessage]
}

private struct ChatMessage: Codable {
  var role: String
  var content: String
}

private struct ChatCompletionResponse: Codable {
  var choices: [Choice]

  struct Choice: Codable {
    var message: ChatMessage
  }
}
