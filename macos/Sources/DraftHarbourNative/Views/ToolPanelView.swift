import DraftHarbourNativeCore
import SwiftUI

struct ToolPanelView: View {
  var panel: ToolPanel
  @Bindable var store: ProjectStore
  var exportAction: (ExportFormat) -> Void
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    NavigationSplitView {
      List(ToolPanel.allCases, selection: .constant(panel)) { item in
        Label(item.title, systemImage: item.systemImage)
          .tag(item)
      }
      .navigationSplitViewColumnWidth(210)
    } detail: {
      VStack(alignment: .leading, spacing: 16) {
        HStack {
          Label(panel.title, systemImage: panel.systemImage)
            .font(.title2.bold())
          Spacer()
          Button("Done") { dismiss() }
            .keyboardShortcut(.defaultAction)
        }

        Divider()
        content
        Spacer(minLength: 0)
      }
      .padding(22)
    }
  }

  @ViewBuilder
  private var content: some View {
    switch panel {
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
  }

  private var snapshotsContent: some View {
    VStack(alignment: .leading, spacing: 10) {
      Button("Create Snapshot") { _ = try? store.createSnapshot(label: "Manual") }
      ForEach(store.envelope.snapshots) { snapshot in
        HStack {
          VStack(alignment: .leading) {
            Text(snapshot.label ?? "Snapshot")
            Text(Date(timeIntervalSince1970: Double(snapshot.createdAt) / 1000).formatted())
              .font(.caption)
              .foregroundStyle(.secondary)
          }
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
  }

  private var commentsContent: some View {
    List(store.envelope.commentThreads) { thread in
      VStack(alignment: .leading) {
        Text(thread.comments.first?.text ?? "Comment")
        Text(thread.resolved ? "Resolved" : "Open")
          .font(.caption)
          .foregroundStyle(.secondary)
        HStack {
          Button(thread.resolved ? "Reopen" : "Resolve") {
            try? store.resolveCommentThread(threadID: thread.id, resolved: !thread.resolved)
          }
          Button("Reply") {
            try? store.addCommentReply(threadID: thread.id, text: "Reply")
          }
          Button("Delete", role: .destructive) {
            try? store.deleteCommentThread(threadID: thread.id)
          }
        }
      }
    }
  }

  private var characterBibleContent: some View {
    HStack(alignment: .top, spacing: 24) {
      VStack(alignment: .leading) {
        Button("Add Character") { store.addCharacter(name: "New Character") }
        List(store.envelope.characters) { character in
          Text(character.name)
        }
      }
      VStack(alignment: .leading) {
        Button("Add World Entry") { store.addWorldEntry(name: "New Entry") }
        List(store.envelope.worldEntries) { entry in
          Text(entry.name)
        }
      }
    }
  }

  private var storyCardsContent: some View {
    ScrollView {
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 12)], spacing: 12) {
        ForEach(store.envelope.characters) { character in
          card(title: character.name, subtitle: character.role, icon: "person")
        }
        ForEach(store.envelope.worldEntries) { entry in
          card(title: entry.name, subtitle: entry.category, icon: "map")
        }
      }
    }
  }

  private var integrationsContent: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(IntegrationType.allCases, id: \.self) { type in
        HStack {
          Label(type.rawValue, systemImage: "point.3.connected.trianglepath.dotted")
          Spacer()
          Text(store.envelope.integrations?[type]?.status ?? "Not connected")
            .foregroundStyle(.secondary)
        }
      }
    }
  }

  private var aiContent: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Providers")
        .font(.headline)
      Text("Managed cloud, BYOK OpenAI-compatible endpoints, and local OpenAI-compatible servers share the native AIProvider protocol.")
        .foregroundStyle(.secondary)
      Text("Chrome AI is intentionally replaced because it is browser-only.")
        .foregroundStyle(.secondary)
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
      Divider()
      Text("Export History")
        .font(.headline)
      ForEach(store.envelope.exportHistory.prefix(8)) { record in
        HStack {
          Text(record.filename)
          Spacer()
          Text(record.format.rawValue)
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

  private func card(title: String, subtitle: String, icon: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Image(systemName: icon)
        .foregroundStyle(.secondary)
      Text(title)
        .font(.headline)
      Text(subtitle)
        .foregroundStyle(.secondary)
    }
    .padding()
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(.regularMaterial)
    .clipShape(RoundedRectangle(cornerRadius: 8))
  }
}
