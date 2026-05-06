import Foundation

public protocol SecretStore: Sendable {
  func secret(account: String) throws -> String?
}

public protocol WritableSecretStore: SecretStore {
  func setSecret(_ value: String, account: String) throws
  func deleteSecret(account: String) throws
}

extension KeychainClient: WritableSecretStore {}

public enum PipelineInsertionMode: String, Codable, CaseIterable, Sendable {
  case replace
  case append
  case sideBySide = "side-by-side"
}

public struct PipelineStage: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var title: String
  public var promptTemplate: String

  public init(id: String, title: String, promptTemplate: String) {
    self.id = id
    self.title = title
    self.promptTemplate = promptTemplate
  }
}

public struct TranslationLanguage: Codable, Equatable, Identifiable, Sendable {
  public var id: String { code }
  public var code: String
  public var name: String

  public init(code: String, name: String) {
    self.code = code
    self.name = name
  }
}

public enum AIWorkflowServices {
  public static let pipelineStages: [PipelineStage] = [
    PipelineStage(id: "brainstorm", title: "Brainstorm", promptTemplate: "Brainstorm possibilities for {{sectionTitle}} using the current context:\n\n{{context}}"),
    PipelineStage(id: "continue", title: "Continue", promptTemplate: "Continue {{sectionTitle}} in the same voice and continuity:\n\n{{context}}"),
    PipelineStage(id: "revise", title: "Revise", promptTemplate: "Revise this passage for clarity, tension, and character voice:\n\n{{context}}"),
    PipelineStage(id: "summarize", title: "Summarize", promptTemplate: "Summarize this section for the project bible:\n\n{{context}}")
  ]

  public static let translationLanguages: [TranslationLanguage] = [
    TranslationLanguage(code: "es", name: "Spanish"),
    TranslationLanguage(code: "fr", name: "French"),
    TranslationLanguage(code: "de", name: "German"),
    TranslationLanguage(code: "it", name: "Italian"),
    TranslationLanguage(code: "pt", name: "Portuguese"),
    TranslationLanguage(code: "ja", name: "Japanese")
  ]

  public static func renderPrompt(template: String, envelope: DhprojEnvelope, section: Section?, extraPrompt: String = "") -> String {
    var output = template
    let context = buildStoryContext(envelope: envelope, section: section)
    let replacements = [
      "{{projectTitle}}": envelope.project.title,
      "{{projectType}}": envelope.projectType.rawValue,
      "{{sectionTitle}}": section?.title ?? "Current Section",
      "{{context}}": context,
      "{{prompt}}": extraPrompt
    ]
    for (token, value) in replacements {
      output = output.replacingOccurrences(of: token, with: value)
    }
    return output
  }

  public static func applyInsertionMode(base: String, incoming: String, mode: PipelineInsertionMode) -> String {
    switch mode {
    case .replace:
      return incoming
    case .append:
      return [base, incoming].filter { !$0.isEmpty }.joined(separator: "\n\n")
    case .sideBySide:
      return """
      \(base)

      ---

      \(incoming)
      """
    }
  }

  public static func translationPrompt(text: String, language: TranslationLanguage, preserveFormatting: Bool) -> String {
    """
    Translate the following writing into \(language.name). \(preserveFormatting ? "Preserve Markdown/Fountain formatting and line breaks." : "Return natural prose without preserving source formatting.")

    \(text)
    """
  }

  public static func buildStoryContext(envelope: DhprojEnvelope, section: Section?) -> String {
    var parts: [String] = [
      "Project: \(envelope.project.title)",
      "Type: \(envelope.projectType.rawValue)"
    ]
    if let blueprint = envelope.storyBlueprint {
      parts.append("Blueprint: \(blueprint.genre) \(blueprint.subgenre), tone \(blueprint.tone), voice \(blueprint.voice), structure \(blueprint.structure.rawValue)")
    }
    if !envelope.characters.isEmpty {
      parts.append("Characters: " + envelope.characters.map { "\($0.name) (\($0.role))" }.joined(separator: ", "))
    }
    if !envelope.worldEntries.isEmpty {
      parts.append("World: " + envelope.worldEntries.map { "\($0.name) [\($0.category)]" }.joined(separator: ", "))
    }
    if let section {
      parts.append("Current section: \(section.title)\n\(section.content ?? "")")
    }
    let continuity = AnalysisServices.continuityWarnings(for: envelope)
    if !continuity.isEmpty {
      parts.append("Continuity warnings: " + continuity.joined(separator: " | "))
    }
    return parts.joined(separator: "\n\n")
  }
}

public struct NativeAIProviderFactory {
  public var secretStore: SecretStore

  public init(secretStore: SecretStore = KeychainClient.shared) {
    self.secretStore = secretStore
  }

  public func provider(from config: AIProviderConfig) throws -> AIProvider {
    guard config.enabled else {
      throw DraftHarbourError.providerNotConfigured(config.label)
    }
    guard let endpoint = URL(string: config.endpoint) else {
      throw DraftHarbourError.providerNotConfigured("\(config.label) endpoint")
    }
    let apiKey = try config.keychainAccount.flatMap { try secretStore.secret(account: $0) }
    return OpenAICompatibleProvider(
      id: config.id,
      displayName: config.label,
      endpoint: endpoint,
      apiKey: apiKey,
      defaultModel: config.model
    )
  }
}

public struct FallbackAIProvider: AIProvider {
  public var providers: [AIProvider]
  public var id: String { providers.map(\.id).joined(separator: "+") }
  public var displayName: String { "Fallback AI" }

  public init(providers: [AIProvider]) {
    self.providers = providers
  }

  public func generate(_ request: AIRequest) async throws -> AIResponse {
    var lastError: Error?
    for provider in providers {
      do {
        return try await provider.generate(request)
      } catch {
        lastError = error
      }
    }
    throw lastError ?? DraftHarbourError.providerNotConfigured("AI fallback chain")
  }
}
