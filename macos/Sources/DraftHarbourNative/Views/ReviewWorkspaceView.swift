import AppKit
import DraftHarbourNativeCore
import SwiftUI

private struct FormatValidationIssue: Identifiable {
  var id: String { "\(format.rawValue)-\(issue.id)" }
  var format: ExportFormat
  var issue: ExportValidationIssue
}

struct ReviewWorkspaceView: View {
  @Bindable var store: ProjectStore
  var selectedRange: NSRange
  var runCommand: (NativeCommandID) -> Void

  @SceneStorage("DraftHarbour.reviewFilter") private var selectedFilterRaw = ReviewFilter.all.rawValue
  @State private var aiPreview = ""
  @State private var aiStatus: String?
  @State private var insertionMode = PipelineInsertionMode.append
  @State private var isGenerating = false

  private var selectedFilter: Binding<ReviewFilter> {
    Binding {
      ReviewFilter(rawValue: selectedFilterRaw) ?? .all
    } set: { newValue in
      selectedFilterRaw = newValue.rawValue
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      toolbar
      Divider()
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
          if includes(.validation) {
            validationSection
          }
          if includes(.continuity) {
            continuitySection
          }
          if includes(.comments) {
            commentsSection
          }
          if includes(.snapshots) {
            snapshotsSection
          }
          if includes(.aiRevisions) {
            aiSection
          }
          syncSection
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }

  private var toolbar: some View {
    HStack(spacing: 12) {
      Picker("Review", selection: selectedFilter) {
        ForEach(ReviewFilter.allCases) { filter in
          Text(filter.title).tag(filter)
        }
      }
      .pickerStyle(.segmented)
      .frame(maxWidth: 620)

      Spacer()

      Button {
        runCommand(.export)
      } label: {
        Label("Export Review", systemImage: "square.and.arrow.up")
      }

      Button {
        runCommand(.aiWriting)
      } label: {
        Label("AI Tools", systemImage: "sparkles")
      }
    }
    .padding(12)
  }

  private var validationSection: some View {
    GroupBox("Export Validation") {
      VStack(alignment: .leading, spacing: 10) {
        let issues = validationIssues
        if issues.isEmpty {
          Label("All export formats pass current validation.", systemImage: "checkmark.circle")
            .foregroundStyle(.secondary)
        } else {
          ForEach(issues) { item in
            HStack(alignment: .top, spacing: 8) {
              Image(systemName: item.issue.severity == .error ? "xmark.octagon" : "exclamationmark.triangle")
                .foregroundStyle(item.issue.severity == .error ? .red : .orange)
              VStack(alignment: .leading, spacing: 2) {
                Text(item.issue.message)
                Text(item.format.rawValue)
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var continuitySection: some View {
    GroupBox("Timeline And Continuity") {
      VStack(alignment: .leading, spacing: 10) {
        let timeline = AnalysisServices.timelineFindings(for: store.envelope)
        let continuity = AnalysisServices.continuityWarnings(for: store.envelope)
        if timeline.isEmpty && continuity.isEmpty {
          Label("No deterministic continuity warnings.", systemImage: "checkmark.circle")
            .foregroundStyle(.secondary)
        }
        ForEach(timeline) { finding in
          Button {
            store.selectSection(finding.sectionIds.first)
          } label: {
            Label(finding.message, systemImage: "calendar.badge.exclamationmark")
          }
          .buttonStyle(.plain)
        }
        ForEach(continuity, id: \.self) { warning in
          Label(warning, systemImage: "person.crop.circle.badge.exclamationmark")
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var commentsSection: some View {
    GroupBox("Comments") {
      VStack(alignment: .leading, spacing: 10) {
        if store.envelope.commentThreads.isEmpty {
          Text("No comments in this project.")
            .foregroundStyle(.secondary)
        } else {
          ForEach(store.envelope.commentThreads) { thread in
            Button {
              store.selectSection(thread.chapterId)
            } label: {
              HStack {
                VStack(alignment: .leading, spacing: 2) {
                  Text(thread.comments.first?.text ?? "Comment")
                    .lineLimit(2)
                  Text(sectionTitle(thread.chapterId))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                Spacer()
                Text(thread.resolved ? "Resolved" : "Open")
                  .foregroundStyle(.secondary)
              }
            }
            .buttonStyle(.plain)
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var snapshotsSection: some View {
    GroupBox("Snapshots") {
      VStack(alignment: .leading, spacing: 10) {
        if store.envelope.snapshots.isEmpty {
          Text("No snapshots in this project.")
            .foregroundStyle(.secondary)
        } else {
          ForEach(store.envelope.snapshots.prefix(12)) { snapshot in
            HStack {
              VStack(alignment: .leading, spacing: 2) {
                Text(snapshot.label ?? "Snapshot")
                Text(sectionTitle(snapshot.chapterId))
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
              Spacer()
              Text(Date(timeIntervalSince1970: Double(snapshot.createdAt) / 1_000).formatted())
                .foregroundStyle(.secondary)
              Button("Restore") {
                try? store.restoreSnapshot(id: snapshot.id)
              }
            }
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var aiSection: some View {
    GroupBox("Selection-Aware AI") {
      VStack(alignment: .leading, spacing: 12) {
        HStack {
          Picker("Insertion", selection: $insertionMode) {
            ForEach(PipelineInsertionMode.allCases, id: \.self) { mode in
              Text(mode.rawValue.capitalized).tag(mode)
            }
          }
          .frame(width: 220)

          Button("Continue") {
            Task { await generateAI(stageID: "continue") }
          }
          Button("Revise") {
            Task { await generateAI(stageID: "revise") }
          }
          Button("Translate") {
            Task { await generateAI(stageID: "translate") }
          }
        }
        .disabled(isGenerating || store.activeSection == nil || store.envelope.aiProviders.filter { $0.enabled }.isEmpty)

        if let aiStatus {
          Text(aiStatus)
            .foregroundStyle(.secondary)
        }

        if !aiPreview.isEmpty {
          Text(aiPreview)
            .textSelection(.enabled)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 8))

          HStack {
            Button("Apply Preview") {
              applyAIPreview()
            }
            Button("Clear") {
              aiPreview = ""
            }
          }
        }

        if store.envelope.aiRevisionLog.isEmpty {
          Text("AI revisions will appear here after previewed changes are applied.")
            .foregroundStyle(.secondary)
        } else {
          Divider()
          ForEach(store.envelope.aiRevisionLog.prefix(8)) { record in
            VStack(alignment: .leading, spacing: 2) {
              Text(record.prompt)
                .lineLimit(1)
              Text(sectionTitle(record.sectionId))
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var syncSection: some View {
    GroupBox("Sync Status") {
      VStack(alignment: .leading, spacing: 8) {
        let integrations = (store.envelope.integrations ?? [:]).values.sorted { $0.type.rawValue < $1.type.rawValue }
        if integrations.isEmpty {
          Text("No sync providers configured.")
            .foregroundStyle(.secondary)
        } else {
          ForEach(integrations, id: \.type) { config in
            HStack {
              Label(config.enabled ? "Connected" : "Disabled", systemImage: config.enabled ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(config.enabled ? .green : .secondary)
              Text(config.type.displayName)
              Spacer()
              if let status = config.status {
                Text(status.capitalized)
                  .foregroundStyle(.secondary)
              }
              if let lastSyncAt = config.lastSyncAt {
                Text(Date(timeIntervalSince1970: Double(lastSyncAt) / 1_000).formatted())
                  .foregroundStyle(.secondary)
              }
            }
          }
        }
        Button("Open Integrations") {
          runCommand(.integrations)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var validationIssues: [FormatValidationIssue] {
    ExportFormat.allCases.flatMap { format in
      ExportValidator.validate(store.envelope, format: format).map { issue in
        FormatValidationIssue(format: format, issue: issue)
      }
    }
  }

  private func includes(_ filter: ReviewFilter) -> Bool {
    selectedFilter.wrappedValue == .all || selectedFilter.wrappedValue == filter
  }

  private func sectionTitle(_ id: String) -> String {
    store.envelope.sections.first(where: { $0.id == id })?.title ?? "Unknown Section"
  }

  @MainActor
  private func generateAI(stageID: String) async {
    guard let section = store.activeSection,
          let config = store.envelope.aiProviders.first(where: \.enabled) else {
      aiStatus = "Configure an AI provider first."
      return
    }

    isGenerating = true
    aiStatus = "Generating..."
    defer { isGenerating = false }

    do {
      let provider = try NativeAIProviderFactory().provider(from: config)
      let source = selectedText(in: section).isEmpty ? (section.content ?? "") : selectedText(in: section)
      let prompt: String
      if stageID == "translate" {
        prompt = AIWorkflowServices.translationPrompt(
          text: source,
          language: TranslationLanguage(code: "es", name: "Spanish"),
          preserveFormatting: true
        )
      } else {
        let stage = AIWorkflowServices.pipelineStages.first { $0.id == stageID } ?? AIWorkflowServices.pipelineStages[0]
        prompt = AIWorkflowServices.renderPrompt(template: stage.promptTemplate, envelope: store.envelope, section: section, extraPrompt: source)
      }
      let response = try await provider.generate(AIRequest(prompt: prompt, context: source, projectType: store.projectType, sectionTitle: section.title, model: config.model))
      aiPreview = response.text
      aiStatus = "Preview generated by \(config.label)."
    } catch {
      aiStatus = error.localizedDescription
    }
  }

  private func applyAIPreview() {
    guard let section = store.activeSection, !aiPreview.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
    let before = section.content ?? ""
    store.applyGeneratedText(aiPreview, mode: insertionMode, range: selectedRange)
    let after = store.activeSection?.content ?? ""
    store.recordAIRevision(
      sectionID: section.id,
      providerId: store.envelope.aiProviders.first(where: { $0.enabled })?.id ?? "unknown",
      prompt: "Review workspace AI preview",
      before: before,
      after: after
    )
    aiPreview = ""
    aiStatus = "Applied preview."
  }

  private func selectedText(in section: DraftHarbourNativeCore.Section) -> String {
    let text = section.content ?? ""
    let length = (text as NSString).length
    let range = NSRange(location: min(max(0, selectedRange.location), length), length: min(max(0, selectedRange.length), max(0, length - selectedRange.location)))
    guard range.length > 0, let swiftRange = Range(range, in: text) else { return "" }
    return String(text[swiftRange])
  }
}
