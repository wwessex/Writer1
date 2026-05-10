import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

public enum AppleFoundationModelsAvailabilityStatus: String, Codable, Equatable, Sendable {
  case available
  case deviceNotEligible
  case appleIntelligenceDisabled
  case modelNotReady
  case unavailable
  case unknown

  public var label: String {
    switch self {
    case .available:
      return "Available"
    case .deviceNotEligible:
      return "This Mac is not eligible for Apple Intelligence."
    case .appleIntelligenceDisabled:
      return "Apple Intelligence is disabled."
    case .modelNotReady:
      return "The local Apple model is not ready yet."
    case .unavailable:
      return "Foundation Models are unavailable on this system."
    case .unknown:
      return "Foundation Models availability could not be determined."
    }
  }
}

public enum AppleFoundationModelsRawAvailability: String, Codable, Equatable, Sendable {
  case available
  case deviceNotEligible
  case appleIntelligenceNotEnabled
  case modelNotReady
  case unavailable
  case unknown
}

public struct AppleFoundationModelsProvider: AIProvider {
  public let id: String
  public let displayName: String
  public var projectContext: AIProjectContextIndex?

  public init(
    id: String = "apple-foundation-default",
    displayName: String = "Apple Foundation Models",
    projectContext: AIProjectContextIndex? = nil
  ) {
    self.id = id
    self.displayName = displayName
    self.projectContext = projectContext
  }

  public static func availabilityStatus() -> AppleFoundationModelsAvailabilityStatus {
    #if canImport(FoundationModels)
    if #available(macOS 26.0, *) {
      switch SystemLanguageModel.default.availability {
      case .available:
        return availabilityStatus(for: .available)
      case .unavailable(let reason):
        switch reason {
        case .deviceNotEligible:
          return availabilityStatus(for: .deviceNotEligible)
        case .appleIntelligenceNotEnabled:
          return availabilityStatus(for: .appleIntelligenceNotEnabled)
        case .modelNotReady:
          return availabilityStatus(for: .modelNotReady)
        @unknown default:
          return availabilityStatus(for: .unknown)
        }
      @unknown default:
        return availabilityStatus(for: .unknown)
      }
    }
    #endif
    return availabilityStatus(for: .unavailable)
  }

  public static func availabilityStatus(for raw: AppleFoundationModelsRawAvailability) -> AppleFoundationModelsAvailabilityStatus {
    switch raw {
    case .available:
      return .available
    case .deviceNotEligible:
      return .deviceNotEligible
    case .appleIntelligenceNotEnabled:
      return .appleIntelligenceDisabled
    case .modelNotReady:
      return .modelNotReady
    case .unavailable:
      return .unavailable
    case .unknown:
      return .unknown
    }
  }

  public func generate(_ request: AIRequest) async throws -> AIResponse {
    guard Self.availabilityStatus() == .available else {
      throw DraftHarbourError.providerNotConfigured(Self.availabilityStatus().label)
    }

    #if canImport(FoundationModels)
    if #available(macOS 26.0, *) {
      let started = Date()
      let session = LanguageModelSession(
        instructions: "You are DraftHarbour's local macOS writing assistant. Work only with the provided project context and user request."
      )
      let prompt = [request.context, request.prompt].compactMap { value -> String? in
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return value
      }.joined(separator: "\n\n")
      let response = try await session.respond(to: prompt)
      return AIResponse(
        text: response.content,
        provider: id,
        model: request.model ?? AIProviderConfig.appleFoundationModel,
        latencyMs: Int(Date().timeIntervalSince(started) * 1000)
      )
    }
    #endif

    throw DraftHarbourError.providerNotConfigured("Apple Foundation Models")
  }

  public func generateChat(prompt: String, envelope: DhprojEnvelope) async throws -> AIChatGenerationResult {
    guard Self.availabilityStatus() == .available else {
      throw DraftHarbourError.providerNotConfigured(Self.availabilityStatus().label)
    }

    let context = projectContext ?? AIProjectContextService.index(for: envelope)

    #if canImport(FoundationModels)
    if #available(macOS 26.0, *) {
      let session = LanguageModelSession(
        tools: [
          SearchProjectTool(context: context),
          ReadSectionChunkTool(context: context),
          ReadStoryBibleTool(context: context),
          ReadSectionMapTool(context: context),
          ReadCharacterCandidatesTool(context: context),
          ReadWorldCandidatesTool(context: context)
        ],
        instructions: """
        You are DraftHarbour's local macOS writing assistant.
        You can inspect the full local project with tools. Use tools before answering questions that depend on chapters, scenes, characters, world entries, or blueprint details.
        If the story bible is empty, do not conclude that there are no characters; use manuscript text and the local manuscript character scan.
        When proposing manuscript edits, return precise UTF-16 ranges, the exact original text, replacement text, and a short rationale. Do not claim an edit was applied.
        """
      )
      let response = try await session.respond(
        to: """
        Project section map:
        \(context.sectionMap())

        Story bible:
        \(context.storyBibleText())

        Local manuscript character scan:
        \(context.manuscriptCharacterSummary())

        Local manuscript world scan:
        \(context.manuscriptWorldSummary())

        User request:
        \(prompt)
        """,
        generating: AppleChatGeneratedResult.self
      )
      return response.content.result(providerId: id, context: context)
    }
    #endif

    throw DraftHarbourError.providerNotConfigured("Apple Foundation Models")
  }
}

#if canImport(FoundationModels)
@available(macOS 26.0, *)
@Generable
private struct AppleChatGeneratedEdit {
  @Guide(description: "The target section id from the section map.")
  var sectionId: String
  @Guide(description: "UTF-16 start offset in the target section content.")
  var utf16Start: Int
  @Guide(description: "UTF-16 length of originalText in the target section content.")
  var utf16Length: Int
  @Guide(description: "The exact text currently present at the target range.")
  var originalText: String
  @Guide(description: "The replacement text to use if the author accepts this edit.")
  var replacementText: String
  @Guide(description: "A concise reason for the proposed edit.")
  var rationale: String
  @Guide(description: "The target section revision from the section map.")
  var baseRevision: Int
}

@available(macOS 26.0, *)
@Generable
private struct AppleChatGeneratedResult {
  @Guide(description: "A helpful conversational reply to the author.")
  var reply: String
  @Guide(description: "Structured manuscript edits for author review. Use an empty array when no text change is needed.")
  var edits: [AppleChatGeneratedEdit]

  func result(providerId: String, context: AIProjectContextIndex) -> AIChatGenerationResult {
    let proposals = edits.compactMap { edit -> AIEditProposal? in
      guard context.sections.contains(where: { $0.id == edit.sectionId }) else { return nil }
      let sectionRevision = context.sections.first(where: { $0.id == edit.sectionId })?.updatedAt ?? Int64(edit.baseRevision)
      return AIEditProposal(
        sectionId: edit.sectionId,
        utf16Start: edit.utf16Start,
        utf16Length: edit.utf16Length,
        originalText: edit.originalText,
        replacementText: edit.replacementText,
        rationale: edit.rationale,
        baseRevision: edit.baseRevision > 0 ? Int64(edit.baseRevision) : sectionRevision
      )
    }
    return AIChatGenerationResult(
      reply: reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "I found no response to return." : reply,
      editProposals: proposals,
      providerId: providerId,
      model: AIProviderConfig.appleFoundationModel
    )
  }
}

@available(macOS 26.0, *)
private struct SearchProjectTool: Tool {
  let name = "searchProject"
  let description = "Search all local chapters/scenes and story bible entries."
  var context: AIProjectContextIndex

  @Generable
  struct Arguments {
    @Guide(description: "Search query.")
    var query: String
    @Guide(description: "Maximum result count.")
    var limit: Int
  }

  func call(arguments: Arguments) async throws -> String {
    let results = context.search(arguments.query, limit: max(1, min(arguments.limit, 12)))
    if results.isEmpty { return "No matches." }
    return results.map {
      "\($0.source): \($0.title) [id: \($0.id), score: \($0.score)]\n\($0.snippet)"
    }.joined(separator: "\n\n")
  }
}

@available(macOS 26.0, *)
private struct ReadSectionChunkTool: Tool {
  let name = "readSectionChunk"
  let description = "Read a UTF-16 chunk of one chapter or scene by section id."
  var context: AIProjectContextIndex

  @Generable
  struct Arguments {
    @Guide(description: "Section id from the section map.")
    var sectionId: String
    @Guide(description: "UTF-16 start offset.")
    var start: Int
    @Guide(description: "Maximum UTF-16 length to read.")
    var length: Int
  }

  func call(arguments: Arguments) async throws -> String {
    context.sectionChunk(sectionId: arguments.sectionId, start: arguments.start, length: max(1, min(arguments.length, 8_000)))
  }
}

@available(macOS 26.0, *)
private struct ReadStoryBibleTool: Tool {
  let name = "readStoryBible"
  let description = "Read the local story bible: blueprint, characters, and world entries."
  var context: AIProjectContextIndex

  @Generable
  struct Arguments {
    @Guide(description: "Optional focus term. Leave empty for all story bible text.")
    var focus: String
  }

  func call(arguments: Arguments) async throws -> String {
    let focus = arguments.focus.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !focus.isEmpty else { return context.storyBibleText() }
    let results = context.search(focus, limit: 10).filter { $0.source != "section" }
    return results.isEmpty ? context.storyBibleText() : results.map { "\($0.source): \($0.title)\n\($0.snippet)" }.joined(separator: "\n\n")
  }
}

@available(macOS 26.0, *)
private struct ReadSectionMapTool: Tool {
  let name = "readSectionMap"
  let description = "Read all section ids, titles, revisions, word counts, and summaries."
  var context: AIProjectContextIndex

  @Generable
  struct Arguments {
    @Guide(description: "Set true to include section summaries.")
    var includeSummaries: Bool
  }

  func call(arguments: Arguments) async throws -> String {
    if arguments.includeSummaries {
      return context.sectionMap()
    }
    return context.sections.map {
      "\($0.order + 1). \($0.title) [id: \($0.id), revision: \($0.updatedAt), words: \($0.wordCount)]"
    }.joined(separator: "\n")
  }
}

@available(macOS 26.0, *)
private struct ReadCharacterCandidatesTool: Tool {
  let name = "readCharacterCandidates"
  let description = "Read likely character names found by scanning every local chapter or scene."
  var context: AIProjectContextIndex

  @Generable
  struct Arguments {
    @Guide(description: "Maximum candidate count.")
    var limit: Int
  }

  func call(arguments: Arguments) async throws -> String {
    context.manuscriptCharacterSummary(limit: max(1, min(arguments.limit, 40)))
  }
}

@available(macOS 26.0, *)
private struct ReadWorldCandidatesTool: Tool {
  let name = "readWorldCandidates"
  let description = "Read likely place, organisation, and world names found by scanning every local chapter or scene."
  var context: AIProjectContextIndex

  @Generable
  struct Arguments {
    @Guide(description: "Maximum candidate count.")
    var limit: Int
  }

  func call(arguments: Arguments) async throws -> String {
    context.manuscriptWorldSummary(limit: max(1, min(arguments.limit, 40)))
  }
}
#endif
