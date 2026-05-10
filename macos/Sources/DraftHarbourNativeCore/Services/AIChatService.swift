import Foundation

public enum AIChatService {
  public static func respond(
    to prompt: String,
    envelope: DhprojEnvelope,
    providerConfig: AIProviderConfig,
    secretStore: SecretStore = KeychainClient.shared
  ) async throws -> AIChatGenerationResult {
    let context = AIProjectContextService.index(for: envelope)
    if shouldAnswerWithLocalCharacterScan(prompt) {
      return localCharacterScanResponse(prompt: prompt, context: context)
    }

    if providerConfig.provider == .appleFoundation {
      let provider = AppleFoundationModelsProvider(id: providerConfig.id, displayName: providerConfig.label, projectContext: context)
      return try await provider.generateChat(prompt: prompt, envelope: envelope)
    }

    let provider = try NativeAIProviderFactory(secretStore: secretStore).provider(from: providerConfig)
    let response = try await provider.generate(
      AIRequest(
        prompt: genericProviderPrompt(userPrompt: prompt, context: context),
        context: context.compactFullContext(),
        projectType: envelope.projectType,
        sectionTitle: envelope.sections.first?.title,
        model: providerConfig.model
      )
    )
    return decodeGenericResponse(response.text, context: context, providerId: response.provider, model: response.model ?? providerConfig.model)
  }

  public static func genericProviderPrompt(userPrompt: String, context: AIProjectContextIndex) -> String {
    """
    You are DraftHarbour's writing assistant. You have local project context in this request.

    Return valid JSON only, with this shape:
    {
      "reply": "short conversational answer",
      "edits": [
        {
          "sectionId": "section id from the map",
          "utf16Start": 0,
          "utf16Length": 0,
          "originalText": "exact current text at that range",
          "replacementText": "replacement text",
          "rationale": "brief reason",
          "baseRevision": 0
        }
      ]
    }

    Use edits only when the author asks you to change manuscript text. Never say edits have been applied. If no edit is needed, return an empty edits array.

    Section map:
    \(context.sectionMap())

    Story bible:
    \(context.storyBibleText())

    Manuscript character candidates:
    \(context.manuscriptCharacterSummary())

    Manuscript world candidates:
    \(context.manuscriptWorldSummary())

    User request:
    \(userPrompt)
    """
  }

  public static func decodeGenericResponse(
    _ text: String,
    context: AIProjectContextIndex,
    providerId: String,
    model: String?
  ) -> AIChatGenerationResult {
    guard let jsonText = extractJSONObject(from: text),
          let data = jsonText.data(using: .utf8),
          let decoded = try? JSONDecoder().decode(GenericAIChatResponse.self, from: data) else {
      return AIChatGenerationResult(reply: text, providerId: providerId, model: model)
    }

    let proposals = decoded.edits.compactMap { edit -> AIEditProposal? in
      guard let section = context.sections.first(where: { $0.id == edit.sectionId }) else { return nil }
      return AIEditProposal(
        sectionId: edit.sectionId,
        utf16Start: edit.utf16Start,
        utf16Length: edit.utf16Length,
        originalText: edit.originalText,
        replacementText: edit.replacementText,
        rationale: edit.rationale,
        baseRevision: edit.baseRevision ?? section.updatedAt
      )
    }
    return AIChatGenerationResult(
      reply: decoded.reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? text : decoded.reply,
      editProposals: proposals,
      providerId: providerId,
      model: model
    )
  }

  private static func extractJSONObject(from text: String) -> String? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.hasPrefix("{"), trimmed.hasSuffix("}") {
      return trimmed
    }
    guard let start = trimmed.firstIndex(of: "{"),
          let end = trimmed.lastIndex(of: "}"),
          start <= end else {
      return nil
    }
    return String(trimmed[start...end])
  }

  public static func shouldAnswerWithLocalCharacterScan(_ prompt: String) -> Bool {
    let normalized = prompt.lowercased()
    if shouldAddCharactersToStoryBible(prompt) || shouldAddWorldEntriesToStoryBible(prompt) { return false }

    let mentionsCharacters = normalized.contains("character") ||
      normalized.contains("chacter") ||
      normalized.contains("cast") ||
      normalized.contains("people in") ||
      normalized.contains("who is in") ||
      normalized.contains("who's in")
    guard mentionsCharacters else { return false }

    let asksForInventory = [
      "check", "find", "list", "what", "which", "who", "analyse", "analyze", "scan", "identify"
    ].contains { normalized.contains($0) }
    let mentionsProjectText = [
      "chapter", "chaper", "chapters", "chapers", "novel", "book", "manuscript", "story"
    ].contains { normalized.contains($0) }
    let asksForGeneration = [
      "write", "rewrite", "revise", "continue", "edit", "make"
    ].contains { normalized.contains($0) }

    return asksForInventory && mentionsProjectText && !asksForGeneration
  }

  public static func shouldAddCharactersToStoryBible(_ prompt: String) -> Bool {
    let normalized = prompt.lowercased()
    let mentionsCharacters = normalized.contains("character") ||
      normalized.contains("chacter") ||
      normalized.contains("cast")
    let asksToAdd = normalized.contains("add") ||
      normalized.contains("create") ||
      normalized.contains("put")
    let targetsStoryBible = normalized.contains("story bible") ||
      normalized.contains("bible") ||
      normalized.contains("character & world") ||
      normalized.contains("character and world")

    return mentionsCharacters && asksToAdd && targetsStoryBible
  }

  public static func shouldAddWorldEntriesToStoryBible(_ prompt: String) -> Bool {
    let normalized = prompt.lowercased()
    let mentionsWorldEntries = normalized.contains("place") ||
      normalized.contains("places") ||
      normalized.contains("location") ||
      normalized.contains("locations") ||
      normalized.contains("world") ||
      normalized.contains("worlds") ||
      normalized.contains("lore") ||
      normalized.contains("organisation") ||
      normalized.contains("organisations") ||
      normalized.contains("organization") ||
      normalized.contains("organizations")
    let asksToAdd = normalized.contains("add") ||
      normalized.contains("create") ||
      normalized.contains("put")
    let targetsStoryBible = normalized.contains("story bible") ||
      normalized.contains("bible") ||
      normalized.contains("character & world") ||
      normalized.contains("character and world") ||
      normalized.contains("as worlds") ||
      normalized.contains("as world")

    return mentionsWorldEntries && asksToAdd && targetsStoryBible
  }

  public static func storyBibleAddResponse(
    addedCharacters: [CharacterEntity],
    candidates: [AICharacterCandidate],
    checkedSectionCount: Int,
    projectType: ProjectType
  ) -> String {
    let sectionLabel = projectType == .screenplay ? "scene" : "chapter"
    let eligibleCount = candidates.filter { !$0.inStoryBible && $0.mentionCount >= 2 }.count

    guard !addedCharacters.isEmpty else {
      return """
      I checked all \(checkedSectionCount) \(sectionLabel)\(checkedSectionCount == 1 ? "" : "s") and did not add new story bible character entries. The scan found \(eligibleCount) new high-confidence candidate\(eligibleCount == 1 ? "" : "s"); they may already be in Character & World or below the confidence threshold.
      """
    }

    let lines = addedCharacters.map { character in
      "- \(character.name): \(character.description)"
    }.joined(separator: "\n")

    return """
    I checked all \(checkedSectionCount) \(sectionLabel)\(checkedSectionCount == 1 ? "" : "s") and added \(addedCharacters.count) character entr\(addedCharacters.count == 1 ? "y" : "ies") to Character & World.

    \(lines)

    Each new entry includes manuscript evidence in Notes so you can review and refine it.
    """
  }

  public static func storyBibleWorldAddResponse(
    addedWorldEntries: [WorldEntry],
    candidates: [AIWorldCandidate],
    checkedSectionCount: Int,
    projectType: ProjectType
  ) -> String {
    let sectionLabel = projectType == .screenplay ? "scene" : "chapter"
    let eligibleCount = candidates.filter { !$0.inStoryBible }.count

    guard !addedWorldEntries.isEmpty else {
      return """
      I checked all \(checkedSectionCount) \(sectionLabel)\(checkedSectionCount == 1 ? "" : "s") and did not add new story bible world entries. The scan found \(eligibleCount) candidate\(eligibleCount == 1 ? "" : "s"); they may already be in Character & World or below the confidence threshold.
      """
    }

    let lines = addedWorldEntries.map { entry in
      "- \(entry.name) [\(entry.category)]: \(entry.description)"
    }.joined(separator: "\n")

    return """
    I checked all \(checkedSectionCount) \(sectionLabel)\(checkedSectionCount == 1 ? "" : "s") and added \(addedWorldEntries.count) world entr\(addedWorldEntries.count == 1 ? "y" : "ies") to Character & World.

    \(lines)

    Each new world entry includes manuscript evidence in Notes so you can review and refine it.
    """
  }

  public static func localCharacterScanResponse(prompt: String, context: AIProjectContextIndex) -> AIChatGenerationResult {
    let candidates = context.manuscriptCharacterCandidates()
    let sectionLabel = context.projectType == .screenplay ? "scene" : "chapter"
    let checked = context.sections.count
    let storyBibleCount = context.characters.count

    let reply: String
    if candidates.isEmpty {
      reply = """
      I checked all \(checked) \(sectionLabel)\(checked == 1 ? "" : "s") and the story bible. I did not find likely character names.

      Story bible character entries: \(storyBibleCount).
      """
    } else {
      let lines = candidates.map { candidate in
        let source = candidate.inStoryBible ? "also in story bible" : "not in story bible"
        let sections = candidate.sectionTitles.isEmpty ? "no manuscript section evidence" : candidate.sectionTitles.prefix(5).joined(separator: ", ")
        let evidence = candidate.evidence.first ?? ""
        return "- \(candidate.name): \(candidate.mentionCount) mention\(candidate.mentionCount == 1 ? "" : "s"), \(source). Appears in: \(sections). \(evidence)"
      }.joined(separator: "\n")
      reply = """
      I checked all \(checked) \(sectionLabel)\(checked == 1 ? "" : "s") plus the story bible. The story bible currently has \(storyBibleCount) character entr\(storyBibleCount == 1 ? "y" : "ies"), and the manuscript scan found these likely characters:

      \(lines)

      This is a local name scan from the manuscript text, so it may include place names or proper nouns that are not characters.
      """
    }

    return AIChatGenerationResult(
      reply: reply,
      providerId: "local-manuscript-scan",
      model: "character-candidate-scan"
    )
  }
}

private struct GenericAIChatResponse: Decodable {
  var reply: String
  var edits: [GenericAIEdit]
}

private struct GenericAIEdit: Decodable {
  var sectionId: String
  var utf16Start: Int
  var utf16Length: Int
  var originalText: String
  var replacementText: String
  var rationale: String
  var baseRevision: Int64?
}
