import AppKit
import DraftHarbourNativeCore
import SwiftUI

private enum StoryPanelMode: String, CaseIterable, Identifiable {
  case corkboard
  case storyCards

  var id: String { rawValue }
}

private enum StoryCardTab: String, CaseIterable, Identifiable {
  case all
  case characters
  case world

  var id: String { rawValue }
}

private enum CorkboardCardSize: String, CaseIterable, Identifiable {
  case compact
  case normal
  case large

  var id: String { rawValue }

  var minimumWidth: CGFloat {
    switch self {
    case .compact: 170
    case .normal: 230
    case .large: 310
    }
  }
}

struct ToolPanelView: View {
  var panel: ToolPanel
  @Bindable var store: ProjectStore
  var exportAction: (ExportFormat) -> Void
  var runCommand: (NativeCommandID) -> Void = { _ in }
  @Environment(\.dismiss) private var dismiss

  @State private var selectedPanel = ToolPanel.dashboard
  @State private var storyMode = StoryPanelMode.corkboard
  @State private var cardSize = CorkboardCardSize.normal
  @State private var corkboardReorderMode = false
  @State private var storyTab = StoryCardTab.all
  @State private var storySearch = ""
  @State private var expandedStoryCardID: String?
  @State private var selectedCharacterID: String?
  @State private var selectedWorldEntryID: String?
  @State private var replyDrafts: [String: String] = [:]

  @State private var syncBaseURL = ""
  @State private var syncToken = ""
  @State private var syncMessage: String?
  @State private var syncConflicts: [ConflictInfo] = []
  @State private var remoteRevisions: [RemoteRevision] = []
  @State private var isSyncing = false
  @State private var scrivenerPath = ""
  @State private var scrivenerMessage: String?
  @State private var isScrivenerSyncing = false

  @State private var aiEndpoint = UserDefaults.standard.string(forKey: "DraftHarbour.ai.endpoint") ?? "http://localhost:11434/v1/chat/completions"
  @State private var aiModel = UserDefaults.standard.string(forKey: "DraftHarbour.ai.model") ?? "llama3.1"
  @State private var aiAPIKey = ""
  @State private var aiProviderLabel = UserDefaults.standard.string(forKey: "DraftHarbour.ai.label") ?? "Native AI"
  @State private var aiProviderType = AIProviderType.localOpenAI
  @State private var selectedAIProviderID: String?
  @State private var aiPrompt = ""
  @State private var aiResult = ""
  @State private var aiError: String?
  @State private var selectedStageID = AIWorkflowServices.pipelineStages.first?.id ?? "continue"
  @State private var insertionMode = PipelineInsertionMode.append
  @State private var translationCode = AIWorkflowServices.translationLanguages.first?.code ?? "es"
  @State private var preserveTranslationFormatting = true
  @State private var isGenerating = false

  private let characterRoles = ["protagonist", "antagonist", "supporting", "minor", "other"]
  private let worldCategories = ["location", "lore", "item", "event", "organisation", "other"]

  var body: some View {
    NavigationSplitView {
      List(ToolPanel.allCases, selection: $selectedPanel) { item in
        Label(item.title, systemImage: item.systemImage)
          .tag(item)
      }
      .navigationSplitViewColumnWidth(210)
    } detail: {
      VStack(alignment: .leading, spacing: 16) {
        HStack {
          Label(selectedPanel.title, systemImage: selectedPanel.systemImage)
            .font(.title2.bold())
          Spacer()
          Button("Done") { dismiss() }
            .keyboardShortcut(.defaultAction)
        }

        Divider()
        ScrollView {
          content
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
      .padding(22)
    }
    .onAppear {
      selectedPanel = panel
      hydrateSyncFields()
    }
  }

  @ViewBuilder
  private var content: some View {
    switch selectedPanel {
    case .export:
      exportContent
    case .snapshots:
      snapshotsContent
    case .dashboard:
      dashboardContent
    case .wordCount:
      wordCountContent
    case .comments:
      commentsContent
    case .characterBible:
      characterBibleContent
    case .storyCards:
      storyCardsContent
    case .integrations:
      integrationsContent
    case .ai:
      aiContent
    case .diagnostics:
      diagnosticsContent
    }
  }

  private var exportContent: some View {
    VStack(alignment: .leading, spacing: 14) {
      Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 12) {
        GridRow {
          Button("Markdown") { exportAction(.markdown) }
          Button("Plain Text") { exportAction(.plainText) }
          Button("Fountain") { exportAction(.fountain) }
        }
        GridRow {
          Button("RTF") { exportAction(.rtf) }
          Button("PDF") { exportAction(.pdf) }
          Button("DOCX") { exportAction(.docx) }
        }
        GridRow {
          Button("Screenplay PDF") { exportAction(.screenplayPdf) }
          Button("Publishing Bundle") { exportAction(.publishingBundle) }
        }
      }

      Divider()
      Text("Recent Exports")
        .font(.headline)
      if store.envelope.exportHistory.isEmpty {
        Text("No exports recorded for this document.")
          .foregroundStyle(.secondary)
      } else {
        ForEach(store.envelope.exportHistory.prefix(10)) { record in
          HStack {
            VStack(alignment: .leading) {
              Text(record.filename)
              Text(Date(timeIntervalSince1970: Double(record.timestamp) / 1000).formatted())
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Text(record.format.rawValue)
              .foregroundStyle(.secondary)
          }
        }
      }
    }
  }

  private var snapshotsContent: some View {
    VStack(alignment: .leading, spacing: 10) {
      Button("Create Snapshot") { _ = try? store.createSnapshot(label: "Manual") }
      ForEach(store.envelope.snapshots) { snapshot in
        HStack {
          TextField("Label", text: Binding(get: {
            snapshot.label ?? ""
          }, set: { value in
            try? store.updateSnapshotLabel(id: snapshot.id, label: value)
          }))
          Text(Date(timeIntervalSince1970: Double(snapshot.createdAt) / 1000).formatted())
            .font(.caption)
            .foregroundStyle(.secondary)
          Spacer()
          Button("Restore") { try? store.restoreSnapshot(id: snapshot.id) }
          Button(role: .destructive) {
            try? store.deleteSnapshot(id: snapshot.id)
          } label: {
            Image(systemName: "trash")
          }
        }
      }
    }
  }

  private var dashboardContent: some View {
    VStack(alignment: .leading, spacing: 16) {
      Grid(alignment: .leading, horizontalSpacing: 24, verticalSpacing: 12) {
        GridRow {
          metric("Total Words", "\(store.metrics.totalWords)")
          metric("Sections", "\(store.metrics.sectionCount)")
          metric("Sentences", "\(store.metrics.sentenceCount)")
        }
        GridRow {
          metric("Average Words", "\(store.metrics.averageWordsPerSection)")
          metric("Characters", "\(store.envelope.characters.count)")
          metric("World Entries", "\(store.envelope.worldEntries.count)")
        }
      }
      if let progress = store.envelope.progress {
        Divider()
        Text("Writing Progress")
          .font(.headline)
        LabeledContent("Sessions", value: "\(progress.totalSessions)")
        LabeledContent("All-time Words", value: "\(progress.totalWordsAllTime)")
        LabeledContent("Current Streak", value: "\(progress.streak.current)")
      }
    }
  }

  private var wordCountContent: some View {
    Table(store.envelope.sections) {
      TableColumn("Section", value: \.title)
      TableColumn("Words") { section in
        Text("\(MarkdownTools.wordCount(section.content ?? ""))")
      }
      TableColumn("Status") { section in
        Text(section.status.rawValue.capitalized)
      }
    }
    .frame(minHeight: 320)
  }

  private var commentsContent: some View {
    VStack(alignment: .leading, spacing: 10) {
      Button("Add Comment From Selection") {
        runCommand(.addComment)
      }
      List(store.envelope.commentThreads) { thread in
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Text(thread.resolved ? "Resolved" : "Open")
              .font(.caption)
              .foregroundStyle(.secondary)
            Spacer()
            Text("\(thread.anchor.from)-\(thread.anchor.to)")
              .font(.caption2)
              .foregroundStyle(.secondary)
          }

          ForEach(thread.comments) { comment in
            TextField("Comment", text: textBinding(
              get: { comment.text },
              set: { value in try? store.updateComment(threadID: thread.id, commentID: comment.id, text: value) }
            ), axis: .vertical)
            .textFieldStyle(.roundedBorder)
          }

          HStack {
            TextField("Reply", text: textBinding(
              get: { replyDrafts[thread.id] ?? "" },
              set: { replyDrafts[thread.id] = $0 }
            ))
            .textFieldStyle(.roundedBorder)

            Button("Add Reply") {
              let text = (replyDrafts[thread.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
              guard !text.isEmpty else { return }
              try? store.addCommentReply(threadID: thread.id, text: text)
              replyDrafts[thread.id] = ""
            }
          }

          HStack {
            Button(thread.resolved ? "Reopen" : "Resolve") {
              try? store.resolveCommentThread(threadID: thread.id, resolved: !thread.resolved)
            }
            Button("Delete", role: .destructive) {
              try? store.deleteCommentThread(threadID: thread.id)
            }
          }
        }
      }
      .frame(minHeight: 300)
    }
  }

  private var characterBibleContent: some View {
    HStack(alignment: .top, spacing: 20) {
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text("Characters")
            .font(.headline)
          Spacer()
          Button {
            let character = store.addCharacter(name: "New Character")
            selectedCharacterID = character.id
          } label: {
            Image(systemName: "plus")
          }
        }
        List(store.envelope.characters, selection: $selectedCharacterID) { character in
          Text(character.name)
            .tag(character.id)
        }
        .frame(minWidth: 180, minHeight: 360)
      }

      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Text("World")
            .font(.headline)
          Spacer()
          Button {
            let entry = store.addWorldEntry(name: "New Entry")
            selectedWorldEntryID = entry.id
          } label: {
            Image(systemName: "plus")
          }
        }
        List(store.envelope.worldEntries, selection: $selectedWorldEntryID) { entry in
          Text(entry.name)
            .tag(entry.id)
        }
        .frame(minWidth: 180, minHeight: 360)
      }

      Divider()
      bibleDetail
        .frame(minWidth: 280, maxWidth: .infinity, alignment: .topLeading)
    }
  }

  @ViewBuilder
  private var bibleDetail: some View {
    if let id = selectedCharacterID, store.envelope.characters.contains(where: { $0.id == id }) {
      characterEditor(id: id)
    } else if let id = selectedWorldEntryID, store.envelope.worldEntries.contains(where: { $0.id == id }) {
      worldEditor(id: id)
    } else {
      ContentUnavailableView("Select an Entry", systemImage: "person.text.rectangle")
    }
  }

  private func characterEditor(id: String) -> some View {
    Form {
      TextField("Name", text: textBinding(
        get: { store.envelope.characters.first(where: { $0.id == id })?.name ?? "" },
        set: { value in store.updateCharacter(id: id) { $0.name = value } }
      ))
      Picker("Role", selection: textBinding(
        get: { store.envelope.characters.first(where: { $0.id == id })?.role ?? "other" },
        set: { value in store.updateCharacter(id: id) { $0.role = value } }
      )) {
        ForEach(characterRoles, id: \.self) { role in
          Text(role.capitalized).tag(role)
        }
      }
      TextField("Aliases", text: textBinding(
        get: { store.envelope.characters.first(where: { $0.id == id })?.aliases.joined(separator: ", ") ?? "" },
        set: { value in store.updateCharacter(id: id) { $0.aliases = parseCSV(value) } }
      ))
      TextField("Traits", text: textBinding(
        get: { store.envelope.characters.first(where: { $0.id == id })?.traits.joined(separator: ", ") ?? "" },
        set: { value in store.updateCharacter(id: id) { $0.traits = parseCSV(value) } }
      ))
      TextField("Relationships", text: textBinding(
        get: { formatRelationships(store.envelope.characters.first(where: { $0.id == id })?.relationships ?? []) },
        set: { value in store.updateCharacter(id: id) { $0.relationships = parseRelationships(value) } }
      ))
      TextField("Description", text: textBinding(
        get: { store.envelope.characters.first(where: { $0.id == id })?.description ?? "" },
        set: { value in store.updateCharacter(id: id) { $0.description = value } }
      ), axis: .vertical)
      TextField("Notes", text: textBinding(
        get: { store.envelope.characters.first(where: { $0.id == id })?.notes ?? "" },
        set: { value in store.updateCharacter(id: id) { $0.notes = value } }
      ), axis: .vertical)
      Button("Delete Character", role: .destructive) {
        store.deleteCharacter(id: id)
        selectedCharacterID = nil
      }
    }
  }

  private func worldEditor(id: String) -> some View {
    Form {
      TextField("Name", text: textBinding(
        get: { store.envelope.worldEntries.first(where: { $0.id == id })?.name ?? "" },
        set: { value in store.updateWorldEntry(id: id) { $0.name = value } }
      ))
      Picker("Category", selection: textBinding(
        get: { store.envelope.worldEntries.first(where: { $0.id == id })?.category ?? "other" },
        set: { value in store.updateWorldEntry(id: id) { $0.category = value } }
      )) {
        ForEach(worldCategories, id: \.self) { category in
          Text(category.capitalized).tag(category)
        }
      }
      TextField("Tags", text: textBinding(
        get: { store.envelope.worldEntries.first(where: { $0.id == id })?.tags.joined(separator: ", ") ?? "" },
        set: { value in store.updateWorldEntry(id: id) { $0.tags = parseCSV(value) } }
      ))
      TextField("Linked Character IDs", text: textBinding(
        get: { store.envelope.worldEntries.first(where: { $0.id == id })?.linkedCharacters.joined(separator: ", ") ?? "" },
        set: { value in store.updateWorldEntry(id: id) { $0.linkedCharacters = parseCSV(value) } }
      ))
      TextField("Description", text: textBinding(
        get: { store.envelope.worldEntries.first(where: { $0.id == id })?.description ?? "" },
        set: { value in store.updateWorldEntry(id: id) { $0.description = value } }
      ), axis: .vertical)
      TextField("Notes", text: textBinding(
        get: { store.envelope.worldEntries.first(where: { $0.id == id })?.notes ?? "" },
        set: { value in store.updateWorldEntry(id: id) { $0.notes = value } }
      ), axis: .vertical)
      Button("Delete World Entry", role: .destructive) {
        store.deleteWorldEntry(id: id)
        selectedWorldEntryID = nil
      }
    }
  }

  private var storyCardsContent: some View {
    VStack(alignment: .leading, spacing: 14) {
      Picker("View", selection: $storyMode) {
        Text("Corkboard").tag(StoryPanelMode.corkboard)
        Text("Story Cards").tag(StoryPanelMode.storyCards)
      }
      .pickerStyle(.segmented)
      if storyMode == .corkboard {
        corkboardContent
      } else {
        storyEntityCards
      }
    }
  }

  private var corkboardContent: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("\(store.envelope.sections.count) \(store.projectType == .screenplay ? "Scenes" : "Chapters")")
          .font(.headline)
        ForEach(ChapterStatus.allCases, id: \.self) { status in
          let count = store.envelope.sections.filter { $0.status == status }.count
          if count > 0 {
            Text("\(count) \(status.rawValue)")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
        Spacer()
        Picker("Card Size", selection: $cardSize) {
          ForEach(CorkboardCardSize.allCases) { size in
            Text(size.rawValue.capitalized).tag(size)
          }
        }
        .frame(width: 150)
        Toggle("Reorder", isOn: $corkboardReorderMode)
          .toggleStyle(.button)
      }

      if corkboardReorderMode {
        List(selection: Binding(get: {
          store.activeSectionID
        }, set: { value in
          store.selectSection(value)
        })) {
          ForEach(store.envelope.sections) { section in
            HStack(spacing: 10) {
              Image(systemName: "line.3.horizontal")
                .foregroundStyle(.secondary)
              VStack(alignment: .leading, spacing: 3) {
                Text(section.title.isEmpty ? "Untitled" : section.title)
                Text("\(section.status.rawValue.capitalized) · \(MarkdownTools.wordCount(section.content ?? "")) words")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
              Spacer()
              Text("#\(section.order + 1)")
                .foregroundStyle(.secondary)
            }
            .tag(section.id)
          }
          .onMove { source, destination in
            store.moveSections(from: source, to: destination)
          }
        }
        .frame(minHeight: 340)
      } else {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: cardSize.minimumWidth), spacing: 12)], spacing: 12) {
          ForEach(store.envelope.sections) { section in
            Button {
              store.selectSection(section.id)
              dismiss()
            } label: {
              VStack(alignment: .leading, spacing: 8) {
                HStack {
                  Text("#\(section.order + 1)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                  Spacer()
                  Text(section.status.rawValue)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
                Text(section.title.isEmpty ? "Untitled" : section.title)
                  .font(.headline)
                  .lineLimit(2)
                Text(section.summary.isEmpty ? MarkdownTools.plainText(from: section.content ?? "") : section.summary)
                  .font(.callout)
                  .foregroundStyle(.secondary)
                  .lineLimit(cardSize == .compact ? 2 : 5)
                Spacer(minLength: 0)
                Text("\(MarkdownTools.wordCount(section.content ?? "")) words")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
              .padding()
              .frame(minHeight: cardSize == .large ? 190 : 135, alignment: .topLeading)
              .frame(maxWidth: .infinity, alignment: .leading)
              .background(.regularMaterial)
              .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
          }
        }
      }
    }
  }

  private var storyEntityCards: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        TextField("Search story cards", text: $storySearch)
          .textFieldStyle(.roundedBorder)
        Picker("Cards", selection: $storyTab) {
          Text("All").tag(StoryCardTab.all)
          Text("Characters").tag(StoryCardTab.characters)
          Text("World").tag(StoryCardTab.world)
        }
        .pickerStyle(.segmented)
        .frame(width: 260)
      }
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], spacing: 12) {
        if storyTab == .all || storyTab == .characters {
          ForEach(filteredCharacters) { character in
            storyCard(
              id: character.id,
              title: character.name,
              subtitle: character.role,
              icon: "person",
              body: character.description,
              tags: character.traits
            )
          }
        }
        if storyTab == .all || storyTab == .world {
          ForEach(filteredWorldEntries) { entry in
            storyCard(
              id: entry.id,
              title: entry.name,
              subtitle: entry.category,
              icon: "map",
              body: entry.description,
              tags: entry.tags
            )
          }
        }
      }
    }
  }

  private var filteredCharacters: [CharacterEntity] {
    let query = storySearch.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return store.envelope.characters }
    return store.envelope.characters.filter {
      $0.name.range(of: query, options: .caseInsensitive) != nil ||
        $0.description.range(of: query, options: .caseInsensitive) != nil ||
        $0.aliases.contains { $0.range(of: query, options: .caseInsensitive) != nil }
    }
  }

  private var filteredWorldEntries: [WorldEntry] {
    let query = storySearch.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !query.isEmpty else { return store.envelope.worldEntries }
    return store.envelope.worldEntries.filter {
      $0.name.range(of: query, options: .caseInsensitive) != nil ||
        $0.description.range(of: query, options: .caseInsensitive) != nil ||
        $0.tags.contains { $0.range(of: query, options: .caseInsensitive) != nil }
    }
  }

  private var integrationsContent: some View {
    VStack(alignment: .leading, spacing: 16) {
      GroupBox("Generic REST Sync") {
        VStack(alignment: .leading, spacing: 10) {
          TextField("Base URL", text: $syncBaseURL)
            .textFieldStyle(.roundedBorder)
          SecureField("Bearer token", text: $syncToken)
            .textFieldStyle(.roundedBorder)
          HStack {
            Button("Save") { saveSyncConfig(status: "Configured") }
            Button("Test") { Task { await runSync(.connect) } }
            Button("Push") { Task { await runSync(.push) } }
            Button("Pull") { Task { await runSync(.pull) } }
            Button("Revisions") { Task { await runSync(.revisions) } }
          }
          .disabled(isSyncing)
          if let syncMessage {
            Text(syncMessage)
              .foregroundStyle(.secondary)
          }
        }
        .padding(.vertical, 4)
      }

      GroupBox("Scrivener Package Bridge") {
        VStack(alignment: .leading, spacing: 10) {
          TextField("Package or folder path", text: $scrivenerPath)
            .textFieldStyle(.roundedBorder)
          HStack {
            Button("Choose Folder") {
              chooseScrivenerFolder()
            }
            Button("Export") {
              Task { await runScrivener(.export) }
            }
            Button("Import") {
              Task { await runScrivener(.import) }
            }
          }
          .disabled(isScrivenerSyncing)
          if let scrivenerMessage {
            Text(scrivenerMessage)
              .foregroundStyle(.secondary)
          }
        }
        .padding(.vertical, 4)
      }

      if !syncConflicts.isEmpty {
        GroupBox("Conflicts") {
          VStack(alignment: .leading, spacing: 10) {
            ForEach(syncConflicts) { conflict in
              VStack(alignment: .leading, spacing: 6) {
                Text(store.envelope.sections.first(where: { $0.id == conflict.chapterId })?.title ?? conflict.chapterId)
                  .font(.headline)
                Text("Local: \(snippet(conflict.localContent))")
                  .foregroundStyle(.secondary)
                Text("Remote: \(snippet(conflict.remoteContent))")
                  .foregroundStyle(.secondary)
                HStack {
                  Button("Keep Local") { resolve(conflict, .keepLocal) }
                  Button("Use Remote") { resolve(conflict, .useRemote) }
                  Button("Keep Both") { resolve(conflict, .keepBoth) }
                }
              }
              Divider()
            }
          }
        }
      }

      if !remoteRevisions.isEmpty {
        GroupBox("Remote Revisions") {
          ForEach(remoteRevisions) { revision in
            HStack {
              Text(revision.title)
              Spacer()
              Text(Date(timeIntervalSince1970: Double(revision.updatedAt) / 1000).formatted())
                .foregroundStyle(.secondary)
            }
          }
        }
      }

      GroupBox("Deferred Provider OAuth") {
        VStack(alignment: .leading, spacing: 6) {
          Text("Dropbox and Google Drive native OAuth are intentionally deferred for this pass.")
          Text("Use Generic REST sync now, or Scrivener local package import/export.")
            .foregroundStyle(.secondary)
        }
      }
    }
  }

  private var aiContent: some View {
    VStack(alignment: .leading, spacing: 14) {
      GroupBox("Provider") {
        VStack(alignment: .leading, spacing: 10) {
          Picker("Type", selection: $aiProviderType) {
            ForEach(AIProviderType.allCases, id: \.self) { providerType in
              Text(aiProviderTypeTitle(providerType)).tag(providerType)
            }
          }
          TextField("Label", text: $aiProviderLabel)
            .textFieldStyle(.roundedBorder)
          TextField("Endpoint", text: $aiEndpoint)
            .textFieldStyle(.roundedBorder)
          TextField("Model", text: $aiModel)
            .textFieldStyle(.roundedBorder)
          SecureField("API key", text: $aiAPIKey)
            .textFieldStyle(.roundedBorder)
          HStack {
            Button("Save Provider") {
              persistAIProviderFromUI()
            }
            if selectedAIProviderID != nil {
              Button("New Provider") {
                selectedAIProviderID = nil
                aiProviderLabel = "Native AI"
                aiAPIKey = ""
              }
            }
          }
          if !store.envelope.aiProviders.isEmpty {
            Divider()
            Text("Configured Providers")
              .font(.headline)
            ForEach(store.envelope.aiProviders) { config in
              Button {
                loadAIProvider(config)
              } label: {
                HStack {
                  VStack(alignment: .leading) {
                    Text(config.label)
                    Text("\(aiProviderTypeTitle(config.provider)) · \(config.model)")
                      .font(.caption)
                      .foregroundStyle(.secondary)
                  }
                  Spacer()
                  if selectedAIProviderID == config.id {
                    Image(systemName: "checkmark")
                  }
                }
              }
              .buttonStyle(.plain)
            }
          }
        }
        .padding(.vertical, 4)
      }

      GroupBox("Workflow") {
        VStack(alignment: .leading, spacing: 10) {
          Picker("Stage", selection: $selectedStageID) {
            ForEach(AIWorkflowServices.pipelineStages) { stage in
              Text(stage.title).tag(stage.id)
            }
            Text("Translate").tag("translate")
          }
          Picker("Insertion", selection: $insertionMode) {
            ForEach(PipelineInsertionMode.allCases, id: \.self) { mode in
              Text(mode.rawValue.capitalized).tag(mode)
            }
          }
          if selectedStageID == "translate" {
            Picker("Language", selection: $translationCode) {
              ForEach(AIWorkflowServices.translationLanguages) { language in
                Text(language.name).tag(language.code)
              }
            }
            Toggle("Preserve formatting", isOn: $preserveTranslationFormatting)
          }
          TextField("Prompt", text: $aiPrompt, axis: .vertical)
            .textFieldStyle(.roundedBorder)
            .lineLimit(3...6)
          Button(isGenerating ? "Generating..." : "Generate") {
            Task { await runAIWorkflow() }
          }
          .disabled(isGenerating || store.activeSection == nil)
        }
        .padding(.vertical, 4)
      }

      if !aiResult.isEmpty {
        GroupBox("Last Result") {
          Text(aiResult)
            .textSelection(.enabled)
        }
      }

      if let aiError {
        Text(aiError)
          .foregroundStyle(.red)
      }

      if !store.envelope.aiRevisionLog.isEmpty {
        GroupBox("Revision Log") {
          ForEach(store.envelope.aiRevisionLog.prefix(8)) { record in
            HStack {
              Text(record.prompt)
                .lineLimit(1)
              Spacer()
              Text(record.providerId)
                .foregroundStyle(.secondary)
            }
          }
        }
      }
    }
  }

  private var diagnosticsContent: some View {
    let summary = store.diagnosticsSummary()
    let advanced = AnalyticsEngine.advancedAnalytics(for: store.envelope)
    let timeline = AnalysisServices.timelineFindings(for: store.envelope)
    let continuity = AnalysisServices.continuityWarnings(for: store.envelope)
    return VStack(alignment: .leading, spacing: 14) {
      ForEach(summary.keys.sorted(), id: \.self) { key in
        HStack {
          Text(key)
          Spacer()
          Text(String(describing: summary[key] ?? .null))
            .foregroundStyle(.secondary)
        }
      }
      Divider()
      Text("Advanced Analytics")
        .font(.headline)
      LabeledContent("Vocabulary Richness", value: "\(Int(advanced.vocabularyRichness))%")
      LabeledContent("Dialogue", value: "\(Int(advanced.dialoguePercentage))%")
      LabeledContent("Average Sentence", value: String(format: "%.1f", advanced.averageSentenceLength))
      LabeledContent("Timeline Findings", value: "\(timeline.count)")
      if !continuity.isEmpty {
        Text("Continuity")
          .font(.headline)
        ForEach(continuity, id: \.self) { warning in
          Text(warning)
            .foregroundStyle(.secondary)
        }
      }
    }
  }

  private func metric(_ title: String, _ value: String) -> some View {
    VStack(alignment: .leading) {
      Text(value)
        .font(.title.bold())
      Text(title)
        .foregroundStyle(.secondary)
    }
    .frame(minWidth: 140, alignment: .leading)
  }

  private func storyCard(id: String, title: String, subtitle: String, icon: String, body: String, tags: [String]) -> some View {
    Button {
      expandedStoryCardID = expandedStoryCardID == id ? nil : id
    } label: {
      VStack(alignment: .leading, spacing: 8) {
        Image(systemName: icon)
          .foregroundStyle(.secondary)
        Text(title)
          .font(.headline)
        Text(subtitle.capitalized)
          .font(.caption)
          .foregroundStyle(.secondary)
        if !body.isEmpty {
          Text(body)
            .lineLimit(expandedStoryCardID == id ? nil : 2)
        }
        if !tags.isEmpty {
          Text(tags.prefix(5).joined(separator: ", "))
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
      .padding()
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(.regularMaterial)
      .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    .buttonStyle(.plain)
  }

  private func textBinding(get: @escaping () -> String, set: @escaping (String) -> Void) -> Binding<String> {
    Binding(
      get: { get() },
      set: { value in set(value) }
    )
  }

  private func parseCSV(_ value: String) -> [String] {
    value
      .split(separator: ",")
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }

  private func formatRelationships(_ relationships: [CharacterRelationship]) -> String {
    relationships.map { "\($0.targetId):\($0.type)" }.joined(separator: ", ")
  }

  private func parseRelationships(_ value: String) -> [CharacterRelationship] {
    value.split(separator: ",").compactMap { chunk in
      let pieces = chunk.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      guard let targetId = pieces.first, !targetId.isEmpty else { return nil }
      return CharacterRelationship(targetId: targetId, type: pieces.count > 1 && !pieces[1].isEmpty ? pieces[1] : "related")
    }
  }

  private func snippet(_ value: String?) -> String {
    let text = (value ?? "").replacingOccurrences(of: "\n", with: " ")
    return text.count > 120 ? String(text.prefix(120)) + "..." : text
  }

  private func hydrateSyncFields() {
    let config = store.integrationConfig(for: .genericREST)
    syncBaseURL = config.baseUrl ?? UserDefaults.standard.string(forKey: "DraftHarbour.sync.baseUrl") ?? ""
    syncToken = config.accessToken ?? ""
    let scrivenerConfig = store.integrationConfig(for: .scrivener)
    scrivenerPath = scrivenerConfig.syncFolderPath ?? scrivenerConfig.folderId ?? UserDefaults.standard.string(forKey: "DraftHarbour.scrivener.path") ?? ""
    if let config = store.envelope.aiProviders.first {
      loadAIProvider(config)
    }
  }

  private func saveSyncConfig(status: String? = nil) {
    UserDefaults.standard.set(syncBaseURL, forKey: "DraftHarbour.sync.baseUrl")
    store.updateIntegration(
      IntegrationConfig(
        type: .genericREST,
        enabled: !syncBaseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        status: status,
        lastSyncAt: store.integrationConfig(for: .genericREST).lastSyncAt,
        accessToken: syncToken.isEmpty ? nil : syncToken,
        baseUrl: syncBaseURL.isEmpty ? nil : syncBaseURL
      )
    )
  }

  private func saveScrivenerConfig(status: String? = nil) -> IntegrationConfig {
    UserDefaults.standard.set(scrivenerPath, forKey: "DraftHarbour.scrivener.path")
    let config = IntegrationConfig(
      type: .scrivener,
      enabled: !scrivenerPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      status: status,
      folderId: scrivenerPath.isEmpty ? nil : scrivenerPath,
      lastSyncAt: store.integrationConfig(for: .scrivener).lastSyncAt,
      syncFolderPath: scrivenerPath.isEmpty ? nil : scrivenerPath
    )
    store.updateIntegration(config)
    return config
  }

  private enum SyncAction {
    case connect
    case push
    case pull
    case revisions
  }

  private enum ScrivenerAction {
    case export
    case `import`
  }

  private func chooseScrivenerFolder() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = false
    panel.canChooseDirectories = true
    panel.canCreateDirectories = true
    panel.allowsMultipleSelection = false
    panel.begin { response in
      guard response == .OK, let url = panel.url else { return }
      scrivenerPath = url.path
      _ = saveScrivenerConfig(status: "Configured")
    }
  }

  @MainActor
  private func runSync(_ action: SyncAction) async {
    isSyncing = true
    syncMessage = nil
    syncConflicts = []
    saveSyncConfig()
    let config = store.integrationConfig(for: .genericREST)
    let provider = GenericRESTSyncProvider(type: .genericREST)
    do {
      switch action {
      case .connect:
        let result = try await provider.connect(config: config)
        store.applySyncResult(result)
        syncMessage = result.message
      case .push:
        let result = try await provider.push(config: config, payload: IntegrationPayload(envelope: store.envelope))
        store.applySyncResult(result)
        syncMessage = result.message
      case .pull:
        let result = try await provider.pull(config: config, payload: IntegrationPayload(envelope: store.envelope))
        store.applySyncResult(result)
        syncConflicts = result.conflicts
        syncMessage = result.message
      case .revisions:
        remoteRevisions = try await provider.listRevisions(config: config)
        syncMessage = "Loaded \(remoteRevisions.count) revisions."
      }
    } catch {
      syncMessage = error.localizedDescription
    }
    isSyncing = false
  }

  private func resolve(_ conflict: ConflictInfo, _ option: ConflictResolutionOption) {
    store.resolveConflict(conflict, option: option)
    syncConflicts.removeAll { $0.chapterId == conflict.chapterId }
  }

  @MainActor
  private func runScrivener(_ action: ScrivenerAction) async {
    isScrivenerSyncing = true
    scrivenerMessage = nil
    let config = saveScrivenerConfig()
    let provider = ScrivenerIntegrationProvider()
    do {
      let result: IntegrationResult
      switch action {
      case .export:
        result = try await provider.push(config: config, payload: IntegrationPayload(envelope: store.envelope))
      case .import:
        result = try await provider.pull(config: config, payload: IntegrationPayload(envelope: store.envelope))
      }
      store.applySyncResult(result)
      scrivenerMessage = result.message
    } catch {
      scrivenerMessage = error.localizedDescription
    }
    isScrivenerSyncing = false
  }

  private func aiProviderTypeTitle(_ type: AIProviderType) -> String {
    switch type {
    case .managedCloud:
      return "Managed Cloud"
    case .openAICompatible:
      return "OpenAI Compatible"
    case .serverProxy:
      return "Server Proxy"
    case .customLLM:
      return "Custom LLM"
    case .localOpenAI:
      return "Local OpenAI"
    }
  }

  private func loadAIProvider(_ config: AIProviderConfig) {
    selectedAIProviderID = config.id
    aiProviderType = config.provider
    aiProviderLabel = config.label
    aiEndpoint = config.endpoint
    aiModel = config.model
    aiAPIKey = ""
  }

  private func persistAIProviderFromUI() {
    do {
      _ = try saveAIProviderConfig()
      aiError = nil
    } catch {
      aiError = error.localizedDescription
    }
  }

  @discardableResult
  private func saveAIProviderConfig() throws -> AIProviderConfig {
    UserDefaults.standard.set(aiEndpoint, forKey: "DraftHarbour.ai.endpoint")
    UserDefaults.standard.set(aiModel, forKey: "DraftHarbour.ai.model")
    UserDefaults.standard.set(aiProviderLabel, forKey: "DraftHarbour.ai.label")

    let id = selectedAIProviderID ?? makeIdentifier()
    let existing = store.envelope.aiProviders.first { $0.id == id }
    let keychainAccount = aiAPIKey.isEmpty ? existing?.keychainAccount : "ai-provider-\(id)"
    if !aiAPIKey.isEmpty, let keychainAccount {
      try KeychainClient.shared.setSecret(aiAPIKey, account: keychainAccount)
    }
    let label = aiProviderLabel.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Native AI" : aiProviderLabel
    let config = AIProviderConfig(
      id: id,
      provider: aiProviderType,
      label: label,
      endpoint: aiEndpoint,
      model: aiModel,
      keychainAccount: keychainAccount
    )
    store.upsertAIProvider(config)
    selectedAIProviderID = config.id
    return config
  }

  @MainActor
  private func runAIWorkflow() async {
    guard let section = store.activeSection else { return }
    isGenerating = true
    aiError = nil
    aiResult = ""
    do {
      let config = try saveAIProviderConfig()
      let provider = try NativeAIProviderFactory().provider(from: config)
      let prompt: String
      if selectedStageID == "translate" {
        let language = AIWorkflowServices.translationLanguages.first(where: { $0.code == translationCode }) ?? AIWorkflowServices.translationLanguages[0]
        prompt = AIWorkflowServices.translationPrompt(text: section.content ?? "", language: language, preserveFormatting: preserveTranslationFormatting)
      } else {
        let stage = AIWorkflowServices.pipelineStages.first(where: { $0.id == selectedStageID }) ?? AIWorkflowServices.pipelineStages[0]
        prompt = AIWorkflowServices.renderPrompt(template: stage.promptTemplate, envelope: store.envelope, section: section, extraPrompt: aiPrompt)
      }
      let response = try await provider.generate(
        AIRequest(
          prompt: prompt,
          context: section.content,
          projectType: store.projectType,
          sectionTitle: section.title,
          model: aiModel
        )
      )
      aiResult = response.text
      let before = section.content ?? ""
      let after = AIWorkflowServices.applyInsertionMode(base: before, incoming: response.text, mode: insertionMode)
      store.updateActiveSectionContent(after)
      store.recordAIRevision(sectionID: section.id, providerId: response.provider, prompt: prompt, before: before, after: after)
    } catch {
      aiError = error.localizedDescription
    }
    isGenerating = false
  }
}
