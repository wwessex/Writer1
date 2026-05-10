import DraftHarbourNativeCore
import SwiftUI

private struct AIProposalDisplayRow: Identifiable {
  var threadID: String
  var messageID: String
  var proposal: AIEditProposal

  var id: String { proposal.id }
}

struct AIChatPanelView: View {
  @Bindable var store: ProjectStore
  var focusEditProposal: (AIEditProposal) -> Void

  @State private var selectedThreadID: String?
  @State private var selectedProviderID: String?
  @State private var prompt = ""
  @State private var isSending = false
  @State private var errorMessage: String?

  private var providerOptions: [AIProviderConfig] {
    var providers = store.envelope.aiProviders.filter(\.enabled)
    if !providers.contains(where: { $0.provider == .appleFoundation }) {
      providers.insert(.appleFoundationDefault(), at: 0)
    }
    return providers
  }

  private var selectedProvider: AIProviderConfig {
    if let selectedProviderID,
       let provider = providerOptions.first(where: { $0.id == selectedProviderID }) {
      return provider
    }
    return providerOptions.first ?? .appleFoundationDefault()
  }

  private var selectedThread: AIChatThread? {
    if let selectedThreadID,
       let thread = store.envelope.aiChatThreads.first(where: { $0.id == selectedThreadID }) {
      return thread
    }
    return store.envelope.aiChatThreads.first
  }

  private var proposalRows: [AIProposalDisplayRow] {
    guard let selectedThread else { return [] }
    return selectedThread.messages.flatMap { message in
      message.editProposals.map {
        AIProposalDisplayRow(threadID: selectedThread.id, messageID: message.id, proposal: $0)
      }
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      header
      threadSelector
      transcript
      composer
      proposals
      if let errorMessage {
        Label(errorMessage, systemImage: "exclamationmark.triangle")
          .foregroundStyle(.red)
      }
    }
    .onAppear {
      selectedThreadID = selectedThreadID ?? store.envelope.aiChatThreads.first?.id
      selectedProviderID = selectedProviderID ?? providerOptions.first?.id
    }
  }

  private var header: some View {
    GroupBox("Provider") {
      VStack(alignment: .leading, spacing: 10) {
        Picker("Provider", selection: Binding(get: {
          selectedProvider.id
        }, set: { value in
          selectedProviderID = value
        })) {
          ForEach(providerOptions) { provider in
            Text(provider.label).tag(provider.id)
          }
        }
        HStack(spacing: 10) {
          Label(providerStatusText(selectedProvider), systemImage: selectedProvider.provider == .appleFoundation ? "apple.logo" : "cpu")
            .foregroundStyle(providerStatusStyle(selectedProvider))
          Spacer()
          Text("Full project context")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        Text("Chapters, scenes, characters, world entries, and blueprint details stay local for Apple Foundation Models requests. Edits are proposals until accepted.")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding(.vertical, 4)
    }
  }

  private var threadSelector: some View {
    HStack {
      Picker("Thread", selection: Binding(get: {
        selectedThread?.id ?? ""
      }, set: { value in
        selectedThreadID = value.isEmpty ? nil : value
      })) {
        if store.envelope.aiChatThreads.isEmpty {
          Text("New Chat").tag("")
        }
        ForEach(store.envelope.aiChatThreads) { thread in
          Text(thread.title).tag(thread.id)
        }
      }
      .frame(maxWidth: 360)

      Button {
        selectedThreadID = nil
        prompt = ""
      } label: {
        Label("New Chat", systemImage: "plus.message")
      }
    }
  }

  private var transcript: some View {
    GroupBox("Chat") {
      VStack(alignment: .leading, spacing: 12) {
        if let selectedThread, !selectedThread.messages.isEmpty {
          ForEach(selectedThread.messages) { message in
            VStack(alignment: .leading, spacing: 4) {
              HStack {
                Text(message.role == .user ? "You" : "Assistant")
                  .font(.headline)
                Spacer()
                if let providerId = message.providerId {
                  Text(providerId)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
              }
              Text(message.content)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
              if !message.editProposals.isEmpty {
                Text("\(message.editProposals.count) proposed edit\(message.editProposals.count == 1 ? "" : "s")")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
            .padding(.vertical, 6)
            Divider()
          }
        } else {
          ContentUnavailableView("No Chat Yet", systemImage: "message.badge", description: Text("Ask about the manuscript or request edits across the full local project."))
            .frame(maxWidth: .infinity, minHeight: 160)
        }
      }
      .padding(.vertical, 4)
    }
  }

  private var composer: some View {
    GroupBox("Ask") {
      VStack(alignment: .leading, spacing: 10) {
        TextField("Ask about continuity, characters, plot, or request specific edits", text: $prompt, axis: .vertical)
          .lineLimit(3...7)
          .textFieldStyle(.roundedBorder)
        HStack {
          Button {
            Task { await sendPrompt() }
          } label: {
            Label(isSending ? "Thinking..." : "Send", systemImage: "paperplane")
          }
          .disabled(isSending || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || (selectedProviderUnavailable && !canSendWithLocalCommand))

          if selectedProviderUnavailable {
            Text(providerStatusText(selectedProvider))
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      }
      .padding(.vertical, 4)
    }
  }

  private var proposals: some View {
    GroupBox("Proposed Edits") {
      VStack(alignment: .leading, spacing: 10) {
        let pendingCount = proposalRows.filter { $0.proposal.status == .pending }.count
        if proposalRows.isEmpty {
          Text("No proposed edits in this chat.")
            .foregroundStyle(.secondary)
        } else {
          HStack {
            Text("\(pendingCount) pending")
              .foregroundStyle(.secondary)
            Spacer()
            Button("Accept All") {
              guard let selectedThread else { return }
              _ = store.acceptAllPendingAIEditProposals(threadID: selectedThread.id, providerId: selectedProvider.id, prompt: latestUserPrompt(in: selectedThread))
            }
            .disabled(pendingCount == 0)
          }

          ForEach(proposalRows) { row in
            proposalRow(row)
            Divider()
          }
        }
      }
      .padding(.vertical, 4)
    }
  }

  private func proposalRow(_ row: AIProposalDisplayRow) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Text(sectionTitle(row.proposal.sectionId))
          .font(.headline)
        Text(row.proposal.status.rawValue.capitalized)
          .font(.caption)
          .foregroundStyle(statusStyle(row.proposal.status))
        Spacer()
        Button {
          focusEditProposal(row.proposal)
        } label: {
          Label("Focus", systemImage: "scope")
        }
      }
      Text(row.proposal.rationale)
        .foregroundStyle(.secondary)
      Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
        GridRow {
          Text("Original")
            .foregroundStyle(.secondary)
          Text(row.proposal.originalText)
            .textSelection(.enabled)
        }
        GridRow {
          Text("Replacement")
            .foregroundStyle(.secondary)
          Text(row.proposal.replacementText)
            .textSelection(.enabled)
        }
      }
      HStack {
        Button("Accept") {
          do {
            _ = try store.acceptAIEditProposal(
              threadID: row.threadID,
              messageID: row.messageID,
              proposalID: row.proposal.id,
              providerId: selectedProvider.id,
              prompt: selectedThread.map { latestUserPrompt(in: $0) } ?? ""
            )
          } catch {
            errorMessage = error.localizedDescription
          }
        }
        .disabled(row.proposal.status != .pending)

        Button("Reject") {
          do {
            _ = try store.rejectAIEditProposal(threadID: row.threadID, messageID: row.messageID, proposalID: row.proposal.id)
          } catch {
            errorMessage = error.localizedDescription
          }
        }
        .disabled(row.proposal.status != .pending)
      }
    }
  }

  @MainActor
  private func sendPrompt() async {
    let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    isSending = true
    errorMessage = nil
    defer { isSending = false }

    do {
      let thread = store.ensureAIChatThread(id: selectedThreadID, title: trimmed)
      selectedThreadID = thread.id
      if selectedProvider.provider == .appleFoundation,
         !store.envelope.aiProviders.contains(where: { $0.id == selectedProvider.id }) {
        store.upsertAIProvider(selectedProvider)
      }
      _ = try store.appendAIChatMessage(threadID: thread.id, role: .user, content: trimmed)
      prompt = ""

      let shouldAddCharacters = AIChatService.shouldAddCharactersToStoryBible(trimmed)
      let shouldAddWorldEntries = AIChatService.shouldAddWorldEntriesToStoryBible(trimmed)
      if shouldAddCharacters || shouldAddWorldEntries {
        var replyParts: [String] = []
        var context = AIProjectContextService.index(for: store.envelope)

        if shouldAddCharacters {
          let candidates = context.manuscriptCharacterCandidates(limit: 80)
          let addedCharacters = store.addAICharacterCandidatesToStoryBible(candidates)
          replyParts.append(AIChatService.storyBibleAddResponse(
            addedCharacters: addedCharacters,
            candidates: candidates,
            checkedSectionCount: context.sections.count,
            projectType: context.projectType
          ))
          context = AIProjectContextService.index(for: store.envelope)
        }

        if shouldAddWorldEntries {
          let candidates = context.manuscriptWorldCandidates(limit: 80)
          let addedWorldEntries = store.addAIWorldCandidatesToStoryBible(candidates)
          replyParts.append(AIChatService.storyBibleWorldAddResponse(
            addedWorldEntries: addedWorldEntries,
            candidates: candidates,
            checkedSectionCount: context.sections.count,
            projectType: context.projectType
          ))
        }

        _ = try store.appendAIChatMessage(
          threadID: thread.id,
          role: .assistant,
          content: replyParts.joined(separator: "\n\n"),
          providerId: "local-story-bible-update",
          model: "story-bible-candidate-scan"
        )
        return
      }

      let result = try await AIChatService.respond(to: trimmed, envelope: store.envelope, providerConfig: selectedProvider)
      _ = try store.appendAIChatMessage(
        threadID: thread.id,
        role: .assistant,
        content: result.reply,
        providerId: result.providerId,
        model: result.model,
        editProposals: result.editProposals
      )
    } catch {
      errorMessage = error.localizedDescription
    }
  }

  private var selectedProviderUnavailable: Bool {
    selectedProvider.provider == .appleFoundation && AppleFoundationModelsProvider.availabilityStatus() != .available
  }

  private var canSendWithLocalCommand: Bool {
    AIChatService.shouldAnswerWithLocalCharacterScan(prompt) ||
      AIChatService.shouldAddCharactersToStoryBible(prompt) ||
      AIChatService.shouldAddWorldEntriesToStoryBible(prompt)
  }

  private func providerStatusText(_ provider: AIProviderConfig) -> String {
    if provider.provider == .appleFoundation {
      return AppleFoundationModelsProvider.availabilityStatus().label
    }
    return provider.endpoint.contains("localhost") || provider.endpoint.contains("127.0.0.1") ? "Local endpoint" : "Configured endpoint"
  }

  private func providerStatusStyle(_ provider: AIProviderConfig) -> Color {
    if provider.provider == .appleFoundation {
      return AppleFoundationModelsProvider.availabilityStatus() == .available ? .green : .secondary
    }
    return provider.endpoint.contains("localhost") || provider.endpoint.contains("127.0.0.1") ? .green : .secondary
  }

  private func statusStyle(_ status: AIEditProposalStatus) -> Color {
    switch status {
    case .pending:
      return .orange
    case .accepted:
      return .green
    case .rejected:
      return .secondary
    case .stale:
      return .red
    }
  }

  private func sectionTitle(_ id: String) -> String {
    store.envelope.sections.first(where: { $0.id == id })?.title ?? "Missing Section"
  }

  private func latestUserPrompt(in thread: AIChatThread) -> String {
    thread.messages.last(where: { $0.role == .user })?.content ?? ""
  }
}
