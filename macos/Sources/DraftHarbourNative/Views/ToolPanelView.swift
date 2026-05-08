import AppKit
import Charts
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

private enum ExportPanelTab: String, CaseIterable, Identifiable {
  case presets
  case manuscript
  case custom

  var id: String { rawValue }
}

private struct AnalysisChartPoint: Identifiable {
  var id: String { label }
  var label: String
  var value: Int
}

struct ToolPanelView: View {
  var panel: ToolPanel
  @Bindable var store: ProjectStore
  var exportAction: (ExportRequest) -> Void
  var runCommand: (NativeCommandID) -> Void = { _ in }
  var selectionChanged: (String) -> Void = { _ in }
  var closeAction: (() -> Void)?
  @Environment(\.dismiss) private var dismiss

  @State private var selectedPanel = ToolPanel.dashboard
  @AppStorage("DraftHarbour.export.lastFormat") private var selectedExportFormatRaw = ExportFormat.markdown.rawValue
  @State private var storyMode = StoryPanelMode.corkboard
  @State private var cardSize = CorkboardCardSize.normal
  @State private var corkboardReorderMode = false
  @State private var storyTab = StoryCardTab.all
  @State private var storySearch = ""
  @State private var expandedStoryCardID: String?
  @State private var selectedCharacterID: String?
  @State private var selectedWorldEntryID: String?
  @State private var replyDrafts: [String: String] = [:]
  @State private var inviteEmail = ""
  @State private var invitePermission = CollaborationPermission.comment
  @State private var presenceEmail = ""
  @State private var presenceDisplayName = NSFullUserName()
  @State private var collaborationMessage: String?
  @State private var collaborationSyncToken = ""
  @State private var isCollaborationSyncing = false

  @State private var syncBaseURL = ""
  @State private var syncToken = ""
  @State private var syncMessage: String?
  @State private var syncConflicts: [ConflictInfo] = []
  @State private var remoteRevisions: [RemoteRevision] = []
  @State private var isSyncing = false
  @State private var scrivenerPath = ""
  @State private var scrivenerMessage: String?
  @State private var isScrivenerSyncing = false
  @State private var googleDriveClientID = UserDefaults.standard.string(forKey: "DraftHarbour.googleDrive.clientId") ?? NativeOAuthDefaults.googleClientID
  @State private var googleDriveMessage: String?
  @State private var isGoogleDriveSyncing = false
  @State private var dropboxAppKey = UserDefaults.standard.string(forKey: "DraftHarbour.dropbox.appKey") ?? NativeOAuthDefaults.dropboxAppKey
  @State private var dropboxFolderPath = UserDefaults.standard.string(forKey: "DraftHarbour.dropbox.folderPath") ?? "/DraftHarbour"
  @State private var dropboxMessage: String?
  @State private var isDropboxSyncing = false

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
  @State private var selectedTemplateCategory = "all"
  @State private var selectedTemplateID = SceneTemplateServices.templates.first?.id ?? ""
  @State private var templatePOV = ""
  @State private var templateWordGoal = 0
  @State private var selectedSnapshotID: String?
  @State private var compareSnapshotID: String?
  @State private var showSnapshotDiff = false
  @State private var exportTab = ExportPanelTab.presets
  @State private var selectedPresetID = ExportPresetCatalog.presets.first?.id ?? ""
  @State private var exportProfile = ExportProfile.submission
  @State private var exportLocale = ManuscriptLocale.enUS
  @State private var manuscriptFormat = ExportFormat.docx
  @State private var manuscriptAuthorName = ""
  @State private var manuscriptAuthorSurname = ""
  @State private var manuscriptShortTitle = ""
  @State private var manuscriptFontSize = 12.0
  @State private var manuscriptLineSpacing = 2.0
  @State private var manuscriptFirstLineIndent = 0.5
  @State private var manuscriptMargin = 1.0
  @State private var manuscriptAlignment = ManuscriptTextAlignment.left
  @State private var manuscriptChapterStartsNewPage = true
  @State private var manuscriptIncludeTitlePage = true
  @State private var manuscriptPageNumbering = true
  @State private var manuscriptSceneBreakMarker = "* * *"
  @State private var exportIncludeHeadings = true
  @State private var fountainIncludeSectionTitles = true
  @State private var fountainIncludeMetadataBlock = true
  @State private var fountainFilenameConvention = FountainFilenameConvention.title
  @State private var languageToolURL = UserDefaults.standard.string(forKey: "DraftHarbour.assist.languageToolUrl") ?? "https://api.languagetool.org/v2/check"
  @State private var languageToolLanguage = UserDefaults.standard.string(forKey: "DraftHarbour.assist.languageToolLanguage") ?? "en-US"
  @State private var grammarMatches: [LanguageToolMatch] = []
  @State private var grammarStatus: String?
  @State private var isCheckingGrammar = false
  @State private var publishingDraft: PublishingDraft?

  private let characterRoles = ["protagonist", "antagonist", "supporting", "minor", "other"]
  private let worldCategories = ["location", "lore", "item", "event", "organisation", "other"]

  private var selectedExportFormat: Binding<ExportFormat> {
    Binding {
      ExportFormat(rawValue: selectedExportFormatRaw) ?? .markdown
    } set: { format in
      selectedExportFormatRaw = format.rawValue
    }
  }

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
            .lineLimit(1)
            .minimumScaleFactor(0.85)
          Spacer()
          Button("Done") {
            if let closeAction {
              closeAction()
            } else {
              dismiss()
            }
          }
            .keyboardShortcut(.defaultAction)
            .help("Close tool panel")
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
      if selectedTemplateID.isEmpty {
        selectedTemplateID = SceneTemplateServices.templates.first?.id ?? ""
      }
      publishingDraft = PublishingAssistantServices.draft(for: store.envelope)
    }
    .onChange(of: selectedPanel) { _, newValue in
      selectionChanged(newValue.rawValue)
    }
    .frame(width: 860, height: 640)
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
    case .analysis:
      analysisContent
    case .wordCount:
      wordCountContent
    case .comments:
      commentsContent
    case .collaboration:
      collaborationContent
    case .characterBible:
      characterBibleContent
    case .storyCards:
      storyCardsContent
    case .sceneTemplates:
      sceneTemplatesContent
    case .integrations:
      integrationsContent
    case .ai:
      aiContent
    case .aiSuggestions:
      aiSuggestionsContent
    case .publishingAssistant:
      publishingAssistantContent
    case .gettingStarted:
      gettingStartedContent
    case .diagnostics:
      diagnosticsContent
    }
  }

  private var exportContent: some View {
    let request = currentExportRequest()
    let issues = ExportValidator.validate(store.envelope, request: request)
    let hasErrors = issues.contains { $0.severity == .error }

    return VStack(alignment: .leading, spacing: 14) {
      Picker("Export Mode", selection: $exportTab) {
        ForEach(ExportPanelTab.allCases.filter { store.projectType == .book || $0 != .manuscript }) { tab in
          Text(exportTabTitle(tab)).tag(tab)
        }
      }
      .pickerStyle(.segmented)

      GroupBox("Export Options") {
        VStack(alignment: .leading, spacing: 14) {
          switch exportTab {
          case .presets:
            exportPresetsContent
          case .manuscript:
            manuscriptExportContent
          case .custom:
            customExportContent
          }

          Divider()

          if issues.isEmpty {
            Label("All preflight checks passed.", systemImage: "checkmark.circle")
              .foregroundStyle(.secondary)
          } else {
            ForEach(issues) { issue in
              Label(issue.message, systemImage: validationIcon(issue.severity))
                .foregroundStyle(validationStyle(issue.severity))
            }
          }

          HStack {
            Button {
              exportAction(request)
            } label: {
              Label("Export \(exportTitle(request.format))", systemImage: "square.and.arrow.up")
            }
            .disabled(hasErrors)

            Button("Export Backup") {
              runCommand(.exportBackup)
            }
          }
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
    .onChange(of: exportProfile) { _, _ in hydrateManuscriptDefaults() }
    .onChange(of: exportLocale) { _, _ in hydrateManuscriptDefaults() }
  }

  private var exportPresetsContent: some View {
    VStack(alignment: .leading, spacing: 10) {
      ForEach(exportPresets) { preset in
        Button {
          selectedPresetID = preset.id
          exportAction(preset.request(
            authorName: manuscriptAuthorName,
            authorSurname: manuscriptAuthorSurname,
            shortTitle: manuscriptShortTitle.isEmpty ? String(store.envelope.project.title.prefix(30)) : manuscriptShortTitle
          ))
        } label: {
          HStack(spacing: 12) {
            Image(systemName: exportPresetIcon(preset))
              .frame(width: 18)
              .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
              Text(preset.name)
              Text(preset.description)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            }
            Spacer()
            Text(exportTitle(preset.format))
              .font(.caption)
              .foregroundStyle(.secondary)
          }
          .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
      }
    }
  }

  private var manuscriptExportContent: some View {
    VStack(alignment: .leading, spacing: 12) {
      Grid(alignment: .leading, horizontalSpacing: 14, verticalSpacing: 10) {
        GridRow {
          Picker("Profile", selection: $exportProfile) {
            Text("Submission").tag(ExportProfile.submission)
            Text("Print").tag(ExportProfile.print)
            Text("Custom").tag(ExportProfile.custom)
          }
          Picker("Locale", selection: $exportLocale) {
            Text("en-US").tag(ManuscriptLocale.enUS)
            Text("en-GB").tag(ManuscriptLocale.enGB)
          }
          Picker("Format", selection: $manuscriptFormat) {
            Text("DOCX").tag(ExportFormat.docx)
            Text("PDF").tag(ExportFormat.pdf)
            Text("RTF").tag(ExportFormat.rtf)
          }
        }
        GridRow {
          TextField("Full name", text: $manuscriptAuthorName)
          TextField("Surname", text: $manuscriptAuthorSurname)
          TextField("Short title", text: $manuscriptShortTitle)
        }
        GridRow {
          Picker("Font Size", selection: $manuscriptFontSize) {
            Text("10").tag(10.0)
            Text("11").tag(11.0)
            Text("12").tag(12.0)
            Text("14").tag(14.0)
          }
          Picker("Line Spacing", selection: $manuscriptLineSpacing) {
            Text("Single").tag(1.0)
            Text("1.15").tag(1.15)
            Text("1.5").tag(1.5)
            Text("Double").tag(2.0)
          }
          Picker("Alignment", selection: $manuscriptAlignment) {
            Text("Left").tag(ManuscriptTextAlignment.left)
            Text("Justified").tag(ManuscriptTextAlignment.justified)
            Text("Center").tag(ManuscriptTextAlignment.center)
          }
        }
        GridRow {
          Picker("Indent", selection: $manuscriptFirstLineIndent) {
            Text("None").tag(0.0)
            Text("0.3 in").tag(0.3)
            Text("0.5 in").tag(0.5)
          }
          Picker("Margins", selection: $manuscriptMargin) {
            Text("0.75 in").tag(0.75)
            Text("1.0 in").tag(1.0)
            Text("1.25 in").tag(1.25)
          }
          Picker("Scene Break", selection: $manuscriptSceneBreakMarker) {
            Text("* * *").tag("* * *")
            Text("***").tag("***")
            Text("# # #").tag("# # #")
            Text("~").tag("~")
          }
        }
      }

      HStack {
        Toggle("Title page", isOn: $manuscriptIncludeTitlePage)
        Toggle("New page per chapter", isOn: $manuscriptChapterStartsNewPage)
        Toggle("Page numbers", isOn: $manuscriptPageNumbering)
      }
    }
  }

  private var customExportContent: some View {
    VStack(alignment: .leading, spacing: 12) {
      Picker("Format", selection: selectedExportFormat) {
        ForEach(ExportFormat.allCases, id: \.self) { format in
          Text(exportTitle(format)).tag(format)
        }
      }
      .pickerStyle(.menu)
      .frame(width: 260)

      Toggle("Include chapter headings", isOn: $exportIncludeHeadings)

      if selectedExportFormat.wrappedValue == .fountain {
        Toggle("Include Fountain section titles", isOn: $fountainIncludeSectionTitles)
        Toggle("Include Fountain metadata block", isOn: $fountainIncludeMetadataBlock)
        Picker("Filename", selection: $fountainFilenameConvention) {
          Text("{title}.fountain").tag(FountainFilenameConvention.title)
          Text("{title}-screenplay.fountain").tag(FountainFilenameConvention.titleScreenplay)
          Text("{title}-fountain-export.fountain").tag(FountainFilenameConvention.titleFountain)
        }
      }
    }
  }

  private var exportPresets: [ExportPreset] {
    ExportPresetCatalog.presets(for: store.projectType)
  }

  private func currentExportRequest() -> ExportRequest {
    switch exportTab {
    case .presets:
      let preset = exportPresets.first { $0.id == selectedPresetID } ?? exportPresets.first
      return preset?.request(
        authorName: manuscriptAuthorName,
        authorSurname: manuscriptAuthorSurname,
        shortTitle: manuscriptShortTitle.isEmpty ? String(store.envelope.project.title.prefix(30)) : manuscriptShortTitle
      ) ?? ExportRequest(format: selectedExportFormat.wrappedValue)
    case .manuscript:
      return ExportRequest(
        format: manuscriptFormat,
        presetID: "manuscript-\(exportProfile.rawValue)",
        includeHeadings: true,
        manuscriptOptions: manuscriptOptions()
      )
    case .custom:
      return ExportRequest(
        format: selectedExportFormat.wrappedValue,
        includeHeadings: exportIncludeHeadings,
        fountainOptions: selectedExportFormat.wrappedValue == .fountain ? FountainExportOptions(
          includeSectionTitles: fountainIncludeSectionTitles,
          includeMetadataBlock: fountainIncludeMetadataBlock,
          filenameConvention: fountainFilenameConvention
        ) : nil
      )
    }
  }

  private func manuscriptOptions() -> ManuscriptExportOptions {
    var options = ManuscriptExportOptions.defaults(profile: exportProfile, locale: exportLocale)
    options.fontSizePt = manuscriptFontSize
    options.lineSpacing = manuscriptLineSpacing
    options.firstLineIndentIn = manuscriptFirstLineIndent
    options.marginIn = manuscriptMargin
    options.alignment = manuscriptAlignment
    options.chapterStartsNewPage = manuscriptChapterStartsNewPage
    options.includeTitlePage = manuscriptIncludeTitlePage
    options.pageNumbering = manuscriptPageNumbering
    options.sceneBreakMarker = manuscriptSceneBreakMarker
    options.authorName = manuscriptAuthorName
    options.headerContent = ManuscriptHeaderContent(authorSurname: manuscriptAuthorSurname, shortTitle: manuscriptShortTitle)
    options.includeHeadings = true
    return options
  }

  private func hydrateManuscriptDefaults() {
    let defaults = ManuscriptExportOptions.defaults(profile: exportProfile, locale: exportLocale)
    manuscriptFontSize = defaults.fontSizePt
    manuscriptLineSpacing = defaults.lineSpacing
    manuscriptFirstLineIndent = defaults.firstLineIndentIn
    manuscriptMargin = defaults.marginIn
    manuscriptAlignment = defaults.alignment
    manuscriptChapterStartsNewPage = defaults.chapterStartsNewPage
    manuscriptIncludeTitlePage = defaults.includeTitlePage
    manuscriptPageNumbering = defaults.pageNumbering
    manuscriptSceneBreakMarker = defaults.sceneBreakMarker
  }

  private func exportTabTitle(_ tab: ExportPanelTab) -> String {
    switch tab {
    case .presets:
      return "Presets"
    case .manuscript:
      return "Manuscript"
    case .custom:
      return "Custom"
    }
  }

  private func exportPresetIcon(_ preset: ExportPreset) -> String {
    switch preset.format {
    case .docx:
      return "doc.richtext"
    case .pdf, .screenplayPdf:
      return "doc.viewfinder"
    case .fountain:
      return "film"
    case .rtf, .plainText:
      return "text.alignleft"
    case .markdown:
      return "chevron.left.forwardslash.chevron.right"
    case .publishingBundle:
      return "shippingbox"
    }
  }

  private func validationIcon(_ severity: ValidationSeverity) -> String {
    switch severity {
    case .error:
      return "xmark.octagon"
    case .warning:
      return "exclamationmark.triangle"
    case .info:
      return "info.circle"
    }
  }

  private func validationStyle(_ severity: ValidationSeverity) -> Color {
    switch severity {
    case .error:
      return .red
    case .warning:
      return .orange
    case .info:
      return .secondary
    }
  }

  private func exportTitle(_ format: ExportFormat) -> String {
    switch format {
    case .markdown:
      return "Markdown"
    case .plainText:
      return "Plain Text"
    case .fountain:
      return "Fountain"
    case .rtf:
      return "RTF"
    case .pdf:
      return "PDF"
    case .screenplayPdf:
      return "Screenplay PDF"
    case .docx:
      return "DOCX"
    case .publishingBundle:
      return "Publishing Bundle"
    }
  }

  private var snapshotsContent: some View {
    let activeSnapshots = store.envelope.snapshots.filter { $0.chapterId == store.activeSectionID }
    let selected = activeSnapshots.first { $0.id == selectedSnapshotID }
    let compare = activeSnapshots.first { $0.id == compareSnapshotID }
    return VStack(alignment: .leading, spacing: 14) {
      HStack {
        Button {
          let snapshot = try? store.createSnapshot(label: "Manual")
          selectedSnapshotID = snapshot?.id
        } label: {
          Label("Create Snapshot", systemImage: "camera")
        }
        .disabled(store.activeSection == nil)

        Button("Compare") {
          if selectedSnapshotID == nil {
            selectedSnapshotID = activeSnapshots.first?.id
          }
          compareSnapshotID = activeSnapshots.dropFirst().first?.id
          showSnapshotDiff = true
        }
        .disabled(activeSnapshots.isEmpty)

        Spacer()
        Text("\(activeSnapshots.count) for active section")
          .foregroundStyle(.secondary)
      }

      if activeSnapshots.isEmpty {
        ContentUnavailableView("No Snapshots", systemImage: "clock.arrow.circlepath")
      } else {
        HSplitView {
          List(activeSnapshots, selection: $selectedSnapshotID) { snapshot in
            VStack(alignment: .leading, spacing: 4) {
              Text(snapshot.label?.isEmpty == false ? snapshot.label ?? "Snapshot" : "Snapshot")
              Text(Date(timeIntervalSince1970: Double(snapshot.createdAt) / 1_000).formatted())
                .font(.caption)
                .foregroundStyle(.secondary)
              Text("\(MarkdownTools.wordCount(snapshot.doc)) words")
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
            .tag(snapshot.id)
          }
          .frame(minWidth: 240)

          VStack(alignment: .leading, spacing: 12) {
            if let selected {
              HStack {
                TextField("Label", text: Binding(get: {
                  selected.label ?? ""
                }, set: { value in
                  try? store.updateSnapshotLabel(id: selected.id, label: value)
                }))
                Button("Restore") { try? store.restoreSnapshot(id: selected.id) }
                Button(role: .destructive) {
                  try? store.deleteSnapshot(id: selected.id)
                  selectedSnapshotID = activeSnapshots.first { $0.id != selected.id }?.id
                } label: {
                  Image(systemName: "trash")
                }
              }

              if showSnapshotDiff {
                let diff = SnapshotDiffServices.diff(old: compare?.doc ?? store.activeSection?.content ?? "", new: selected.doc)
                List(diff) { line in
                  Text(line.text.isEmpty ? " " : line.text)
                    .foregroundStyle(line.kind == .added ? .green : line.kind == .removed ? .red : .primary)
                    .font(.system(.body, design: .monospaced))
                }
                .frame(minHeight: 260)
              } else {
                Text(MarkdownTools.plainText(from: selected.doc))
                  .textSelection(.enabled)
                  .frame(maxWidth: .infinity, minHeight: 260, alignment: .topLeading)
                  .padding(10)
                  .background(.regularMaterial)
                  .clipShape(RoundedRectangle(cornerRadius: 8))
              }

              Toggle("Show diff", isOn: $showSnapshotDiff)
            } else {
              ContentUnavailableView("Select a Snapshot", systemImage: "doc.text.magnifyingglass")
            }
          }
          .frame(minWidth: 420)
        }
      }
    }
  }

  private var dashboardContent: some View {
    let dashboard = ProgressDashboardServices.dashboard(for: store.envelope)
    return VStack(alignment: .leading, spacing: 16) {
      Grid(alignment: .leading, horizontalSpacing: 24, verticalSpacing: 12) {
        GridRow {
          metric("Total Words", "\(store.metrics.totalWords)")
          metric("Sections", "\(store.metrics.sectionCount)")
          metric("Sentences", "\(store.metrics.sentenceCount)")
        }
        GridRow {
          metric("Today", "\(dashboard.todayWords)")
          metric("Daily Goal", dashboard.dailyGoal > 0 ? "\(dashboard.dailyGoalPercent)%" : "Not set")
          metric("Project Goal", dashboard.projectGoal > 0 ? "\(dashboard.projectGoalPercent)%" : "Not set")
        }
      }

      GroupBox("Writing Goals") {
        Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 10) {
          GridRow {
            TextField("Daily Words", value: Binding(get: { store.dailyWordTarget }, set: { store.updateGoals(daily: $0) }), format: .number)
            TextField("Weekly Words", value: Binding(get: { store.envelope.settings.goalConfiguration?.weeklyWordTarget ?? 0 }, set: { store.updateGoals(weekly: $0) }), format: .number)
          }
          GridRow {
            TextField("Project Words", value: Binding(get: { store.envelope.settings.novelWordGoal ?? 0 }, set: { store.updateGoals(project: $0) }), format: .number)
            TextField("Deadline YYYY-MM-DD", text: textBinding(
              get: { store.envelope.settings.goalConfiguration?.draftCompletionDeadline ?? store.envelope.settings.novelDeadline ?? "" },
              set: { store.updateGoals(deadline: $0) }
            ))
          }
        }
      }

      if let deadlineDate = dashboard.deadlineDate, !deadlineDate.isEmpty {
        GroupBox("Deadline Pace") {
          VStack(alignment: .leading, spacing: 6) {
            LabeledContent("Deadline", value: deadlineDate)
            LabeledContent("Days Remaining", value: dashboard.daysRemaining.map(String.init) ?? "Unknown")
            LabeledContent("Words Remaining", value: "\(dashboard.wordsRemaining)")
            LabeledContent("Daily Needed", value: "\(dashboard.dailyWordsNeeded)")
            if dashboard.isBehindPace {
              Label("Current daily goal is below the pace needed for this deadline.", systemImage: "exclamationmark.triangle")
                .foregroundStyle(.orange)
            }
          }
        }
      }

      if let progress = store.envelope.progress {
        GroupBox("Writing Progress") {
          Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 10) {
            GridRow {
              metric("Sessions", "\(progress.totalSessions)")
              metric("All-time Words", "\(progress.totalWordsAllTime)")
              metric("Current Streak", "\(progress.streak.current)")
            }
          }
          if !progress.dailyHistory.isEmpty {
            Chart(progress.dailyHistory.suffix(14)) { entry in
              BarMark(
                x: .value("Date", entry.date),
                y: .value("Words", entry.wordsWritten)
              )
              .foregroundStyle(entry.goalMet ? Color.green : Color.accentColor)
            }
            .frame(height: 150)
          }
        }
      }

      GroupBox("Next Actions") {
        VStack(alignment: .leading, spacing: 8) {
          if let resumeID = dashboard.resumeSectionId,
             let section = store.envelope.sections.first(where: { $0.id == resumeID }) {
            Button {
              store.selectSection(resumeID)
              dismiss()
            } label: {
              Label("Resume \(section.title)", systemImage: "arrow.right.circle")
            }
          }
          if dashboard.overdueSectionIds.isEmpty {
            Label("No stale unfinished sections.", systemImage: "checkmark.circle")
              .foregroundStyle(.secondary)
          } else {
            ForEach(dashboard.overdueSectionIds.prefix(5), id: \.self) { sectionID in
              if let section = store.envelope.sections.first(where: { $0.id == sectionID }) {
                Button {
                  store.selectSection(section.id)
                  dismiss()
                } label: {
                  Label(section.title, systemImage: "clock.badge.exclamationmark")
                }
                .buttonStyle(.plain)
              }
            }
          }
        }
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

  private var analysisContent: some View {
    let activeText = store.activeSection?.content ?? ""
    let textAnalysis = AnalysisServices.textAnalysis(for: activeText)
    let advanced = AnalysisServices.advancedAnalytics(for: activeText)
    let weather = AnalysisServices.narrativeWeather(for: store.envelope)
    let distribution = [
      AnalysisChartPoint(label: "Short", value: advanced.sentenceDistribution.short),
      AnalysisChartPoint(label: "Medium", value: advanced.sentenceDistribution.medium),
      AnalysisChartPoint(label: "Long", value: advanced.sentenceDistribution.long),
      AnalysisChartPoint(label: "Very Long", value: advanced.sentenceDistribution.veryLong)
    ]

    return VStack(alignment: .leading, spacing: 16) {
      if store.activeSection == nil {
        ContentUnavailableView("No Section Selected", systemImage: "doc.text.magnifyingglass")
      } else {
        GroupBox("Readability") {
          Grid(alignment: .leading, horizontalSpacing: 24, verticalSpacing: 12) {
            GridRow {
              metric("Words", "\(textAnalysis.wordCount)")
              metric("Sentences", "\(textAnalysis.sentenceCount)")
              metric("Avg Sentence", String(format: "%.1f", textAnalysis.averageSentenceLength))
              metric("Flesch", "\(textAnalysis.fleschScore)")
            }
          }
        }

        GroupBox("Sentence Distribution") {
          Chart(distribution) { item in
            BarMark(
              x: .value("Bucket", item.label),
              y: .value("Count", item.value)
            )
          }
          .frame(height: 150)
        }

        HStack(alignment: .top, spacing: 16) {
          GroupBox("Repeated Words") {
            VStack(alignment: .leading, spacing: 6) {
              if advanced.repeatedWords.isEmpty {
                Text("No notable repeated words.")
                  .foregroundStyle(.secondary)
              } else {
                ForEach(advanced.repeatedWords.sorted { $0.value > $1.value }.prefix(12), id: \.key) { word, count in
                  LabeledContent(word, value: "\(count)")
                }
              }
            }
            .frame(minWidth: 220)
          }

          GroupBox("Advanced") {
            VStack(alignment: .leading, spacing: 6) {
              LabeledContent("Vocabulary Richness", value: "\(Int(advanced.vocabularyRichness))%")
              LabeledContent("Dialogue", value: "\(Int(advanced.dialoguePercentage))%")
              LabeledContent("Avg Paragraph", value: String(format: "%.1f", advanced.averageParagraphLength))
              LabeledContent("Sentiment", value: AnalysisServices.sentiment(activeText).label.rawValue.capitalized)
            }
            .frame(minWidth: 220)
          }
        }

        GroupBox("Long Sentences") {
          if textAnalysis.longSentences.isEmpty {
            Text("No 30+ word sentences found.")
              .foregroundStyle(.secondary)
          } else {
            ForEach(textAnalysis.longSentences, id: \.self) { sentence in
              Text(sentence)
                .lineLimit(2)
                .foregroundStyle(.secondary)
            }
          }
        }

        GroupBox("Grammar & Style") {
          VStack(alignment: .leading, spacing: 10) {
            HStack {
              TextField("LanguageTool URL", text: $languageToolURL)
              TextField("Language", text: $languageToolLanguage)
                .frame(width: 90)
              Button(isCheckingGrammar ? "Checking..." : "Run Grammar Check") {
                Task { await runGrammarCheck(text: activeText) }
              }
              .disabled(isCheckingGrammar || activeText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            if let grammarStatus {
              Text(grammarStatus)
                .foregroundStyle(.secondary)
            }
            if grammarMatches.isEmpty {
              Text("No grammar results loaded.")
                .foregroundStyle(.secondary)
            } else {
              ForEach(grammarMatches) { match in
                VStack(alignment: .leading, spacing: 3) {
                  Text(match.message)
                  Text(match.context.text)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                  if !match.replacements.isEmpty {
                    Text("Suggestions: \(match.replacements.map(\.value).joined(separator: ", "))")
                      .font(.caption)
                  }
                }
                Divider()
              }
            }
          }
        }

        GroupBox("Narrative Weather") {
          if weather.isEmpty {
            Text("No sections available.")
              .foregroundStyle(.secondary)
          } else {
            Chart(weather) { point in
              LineMark(
                x: .value("Section", point.title),
                y: .value("Sentiment", point.sentiment)
              )
              .foregroundStyle(.blue)
              LineMark(
                x: .value("Section", point.title),
                y: .value("Pacing", point.pacing)
              )
              .foregroundStyle(.orange)
              LineMark(
                x: .value("Section", point.title),
                y: .value("Dialogue", point.dialogueDensity)
              )
              .foregroundStyle(.green)
            }
            .frame(height: 170)
          }
        }
      }
    }
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

  private var collaborationContent: some View {
    let activePresence = store.activeCollaborators()
    return VStack(alignment: .leading, spacing: 14) {
      GroupBox("Sync Endpoint") {
        VStack(alignment: .leading, spacing: 10) {
          TextField("https://collab.example.com/api", text: Binding(get: {
            store.envelope.collaboration.syncEndpoint ?? ""
          }, set: { value in
            store.updateCollaborationSyncEndpoint(value)
          }))
          .textFieldStyle(.roundedBorder)

          SecureField("Bearer token", text: $collaborationSyncToken)
            .textFieldStyle(.roundedBorder)

          HStack {
            Button {
              Task { await pushCollaborationState() }
            } label: {
              Label("Push", systemImage: "arrow.up.circle")
            }
            .disabled(isCollaborationSyncing)

            Button {
              Task { await pullCollaborationState() }
            } label: {
              Label("Pull", systemImage: "arrow.down.circle")
            }
            .disabled(isCollaborationSyncing)

            if isCollaborationSyncing {
              ProgressView()
                .scaleEffect(0.7)
            }
          }

          Text("Endpoint contract: PUT/GET /projects/{projectId}/collaboration, POST /projects/{projectId}/presence, POST /invites/{token}/accept.")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }

      GroupBox("Invite Collaborators") {
        VStack(alignment: .leading, spacing: 10) {
          HStack {
            TextField("email@example.com", text: $inviteEmail)
              .textFieldStyle(.roundedBorder)
            Picker("Permission", selection: $invitePermission) {
              ForEach(CollaborationPermission.allCases.filter { $0 != .owner }, id: \.self) { permission in
                Text(permission.rawValue.capitalized).tag(permission)
              }
            }
            .frame(width: 150)
            Button {
              do {
                let invite = try store.inviteCollaborator(email: inviteEmail, permission: invitePermission)
                collaborationMessage = "Created invite token \(invite.token)"
                inviteEmail = ""
              } catch {
                collaborationMessage = error.localizedDescription
              }
            } label: {
              Label("Invite", systemImage: "paperplane")
            }
          }
          if let collaborationMessage {
            Text(collaborationMessage)
              .font(.caption)
              .foregroundStyle(.secondary)
              .textSelection(.enabled)
          }
        }
      }

      GroupBox("Members") {
        if store.envelope.collaboration.members.isEmpty {
          ContentUnavailableView("No Collaborators", systemImage: "person.3")
        } else {
          VStack(alignment: .leading, spacing: 8) {
            ForEach(store.envelope.collaboration.members) { member in
              HStack {
                VStack(alignment: .leading, spacing: 2) {
                  Text(member.displayName.isEmpty ? member.email : member.displayName)
                  Text(member.email)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                Spacer()
                Picker("Permission", selection: Binding(get: {
                  member.permission
                }, set: { value in
                  store.updateCollaboratorPermission(memberID: member.id, permission: value)
                })) {
                  ForEach(CollaborationPermission.allCases, id: \.self) { permission in
                    Text(permission.rawValue.capitalized).tag(permission)
                  }
                }
                .labelsHidden()
                .frame(width: 130)
                Button(role: .destructive) {
                  store.removeCollaborator(memberID: member.id)
                } label: {
                  Image(systemName: "trash")
                }
              }
            }
          }
        }
      }

      GroupBox("Presence") {
        VStack(alignment: .leading, spacing: 10) {
          HStack {
            TextField("Your email", text: $presenceEmail)
              .textFieldStyle(.roundedBorder)
            TextField("Display name", text: $presenceDisplayName)
              .textFieldStyle(.roundedBorder)
            Button {
              guard !presenceEmail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
              _ = store.updatePresence(email: presenceEmail, displayName: presenceDisplayName)
            } label: {
              Label("Heartbeat", systemImage: "dot.radiowaves.left.and.right")
            }
          }

          if activePresence.isEmpty {
            Text("No active collaborators in the current presence window.")
              .foregroundStyle(.secondary)
          } else {
            ForEach(activePresence) { presence in
              HStack {
                Label(presence.displayName.isEmpty ? presence.email : presence.displayName, systemImage: "circle.fill")
                  .foregroundStyle(.green)
                Spacer()
                if let sectionId = presence.sectionId,
                   let section = store.envelope.sections.first(where: { $0.id == sectionId }) {
                  Text(section.title)
                    .foregroundStyle(.secondary)
                }
              }
            }
          }
        }
      }

      GroupBox("Pending Invites") {
        let invites = store.envelope.collaboration.invites
        if invites.isEmpty {
          Text("No invitations have been created.")
            .foregroundStyle(.secondary)
        } else {
          VStack(alignment: .leading, spacing: 8) {
            ForEach(invites) { invite in
              HStack {
                VStack(alignment: .leading, spacing: 2) {
                  Text(invite.email)
                  Text("Token: \(invite.token)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
                }
                Spacer()
                Text(invite.status.rawValue.capitalized)
                  .foregroundStyle(.secondary)
                if invite.status == .pending {
                  Button("Revoke") {
                    try? store.revokeCollaborationInvite(id: invite.id)
                  }
                }
              }
            }
          }
        }
      }
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

  private var filteredSceneTemplates: [SceneTemplate] {
    SceneTemplateServices.templates.filter { template in
      (selectedTemplateCategory == "all" || template.category.rawValue == selectedTemplateCategory) &&
        template.projectTypes.contains(store.projectType)
    }
  }

  private var selectedSceneTemplate: SceneTemplate? {
    filteredSceneTemplates.first { $0.id == selectedTemplateID } ?? filteredSceneTemplates.first
  }

  private var sceneTemplatesContent: some View {
    HSplitView {
      VStack(alignment: .leading, spacing: 12) {
        Picker("Category", selection: $selectedTemplateCategory) {
          Text("All").tag("all")
          ForEach(SceneTemplateCategory.allCases) { category in
            Text(category.rawValue.capitalized).tag(category.rawValue)
          }
        }
        .pickerStyle(.segmented)

        List(filteredSceneTemplates, selection: $selectedTemplateID) { template in
          Label(template.name, systemImage: template.icon)
            .tag(template.id)
        }
        .frame(minWidth: 260, minHeight: 420)
      }

      VStack(alignment: .leading, spacing: 16) {
        if let template = selectedSceneTemplate {
          Label(template.name, systemImage: template.icon)
            .font(.title3.bold())
          Text(template.summary)
            .foregroundStyle(.secondary)

          GroupBox("Beats") {
            VStack(alignment: .leading, spacing: 8) {
              ForEach(Array(template.beats.enumerated()), id: \.offset) { index, beat in
                Label("\(index + 1). \(beat)", systemImage: "circle")
                  .labelStyle(.titleOnly)
              }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
          }

          HStack {
            TextField("POV Character", text: $templatePOV)
            TextField("Word Goal", value: $templateWordGoal, format: .number)
              .frame(width: 120)
          }

          if !template.tags.isEmpty {
            Text(template.tags.joined(separator: ", "))
              .font(.caption)
              .foregroundStyle(.secondary)
          }

          Button {
            if let scene = try? store.applySceneTemplate(template, pov: templatePOV, wordGoal: templateWordGoal) {
              templatePOV = ""
              templateWordGoal = 0
              selectedTemplateID = template.id
              expandedStoryCardID = scene.id
              selectedPanel = .storyCards
            }
          } label: {
            Label("Add Scene from Template", systemImage: "plus")
          }
          .buttonStyle(.borderedProminent)
          .disabled(store.activeSection == nil)
        } else {
          ContentUnavailableView("No Template", systemImage: "doc.badge.plus")
        }
      }
      .frame(minWidth: 440, maxWidth: .infinity, alignment: .topLeading)
      .padding(.leading, 10)
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

      googleDriveBox
      dropboxBox

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
    }
  }

  private var googleDriveBox: some View {
    GroupBox("Google Drive") {
      VStack(alignment: .leading, spacing: 10) {
        TextField("Desktop OAuth client ID", text: $googleDriveClientID)
          .textFieldStyle(.roundedBorder)
        cloudProviderStatus(for: .googleDrive)
        HStack {
          Button {
            Task { await runCloud(.googleDrive, .connect) }
          } label: {
            Label("Connect", systemImage: "link")
          }
          Button {
            Task { await runCloud(.googleDrive, .disconnect) }
          } label: {
            Label("Disconnect", systemImage: "xmark.circle")
          }
          Button {
            Task { await runCloud(.googleDrive, .sync) }
          } label: {
            Label("Sync Now", systemImage: "arrow.triangle.2.circlepath")
          }
          Button {
            Task { await runCloud(.googleDrive, .revisions) }
          } label: {
            Label("Revisions", systemImage: "clock.arrow.circlepath")
          }
        }
        .disabled(isGoogleDriveSyncing)
        if let googleDriveMessage {
          Text(googleDriveMessage)
            .foregroundStyle(.secondary)
        }
      }
      .padding(.vertical, 4)
    }
  }

  private var dropboxBox: some View {
    GroupBox("Dropbox") {
      VStack(alignment: .leading, spacing: 10) {
        TextField("Dropbox app key", text: $dropboxAppKey)
          .textFieldStyle(.roundedBorder)
        TextField("Folder path", text: $dropboxFolderPath)
          .textFieldStyle(.roundedBorder)
        cloudProviderStatus(for: .dropbox)
        HStack {
          Button {
            Task { await runCloud(.dropbox, .connect) }
          } label: {
            Label("Connect", systemImage: "link")
          }
          Button {
            Task { await runCloud(.dropbox, .disconnect) }
          } label: {
            Label("Disconnect", systemImage: "xmark.circle")
          }
          Button {
            Task { await runCloud(.dropbox, .sync) }
          } label: {
            Label("Sync Now", systemImage: "arrow.triangle.2.circlepath")
          }
          Button {
            Task { await runCloud(.dropbox, .revisions) }
          } label: {
            Label("Revisions", systemImage: "clock.arrow.circlepath")
          }
        }
        .disabled(isDropboxSyncing)
        if let dropboxMessage {
          Text(dropboxMessage)
            .foregroundStyle(.secondary)
        }
      }
      .padding(.vertical, 4)
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

  private var aiSuggestionsContent: some View {
    VStack(alignment: .leading, spacing: 14) {
      GroupBox("Quick Actions") {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 10)], spacing: 10) {
          aiSuggestionButton("Continue", systemImage: "square.and.pencil", stageID: "continue")
          aiSuggestionButton("Revise", systemImage: "wand.and.stars", stageID: "revise")
          aiSuggestionButton("Strengthen", systemImage: "bolt", stageID: "revise", prompt: "Make the current section more vivid with stronger verbs, sensory details, and clearer stakes.")
          aiSuggestionButton("Shorten", systemImage: "arrow.down.forward.and.arrow.up.backward", stageID: "revise", prompt: "Tighten the current section to half its length without losing meaning.")
          aiSuggestionButton("Brainstorm Plot", systemImage: "lightbulb", stageID: "continue", prompt: "Suggest three surprising plot developments that could happen next.")
          aiSuggestionButton("Scene Outline", systemImage: "list.number", stageID: "continue", prompt: "Create a five-beat outline for the current scene.")
        }
      }

      GroupBox("Custom Prompt") {
        VStack(alignment: .leading, spacing: 10) {
          TextField("Ask for a rewrite, brainstorm, critique, or continuation", text: $aiPrompt, axis: .vertical)
            .lineLimit(3...6)
          HStack {
            Picker("Insertion", selection: $insertionMode) {
              ForEach(PipelineInsertionMode.allCases, id: \.self) { mode in
                Text(mode.rawValue.capitalized).tag(mode)
              }
            }
            .frame(width: 220)
            Button(isGenerating ? "Generating..." : "Run Prompt") {
              selectedStageID = "continue"
              Task { await runAIWorkflow() }
            }
            .disabled(isGenerating || store.activeSection == nil)
          }
        }
      }

      if !aiResult.isEmpty {
        GroupBox("Latest Suggestion") {
          Text(aiResult)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }

      if let aiError {
        Text(aiError)
          .foregroundStyle(.red)
      }
    }
  }

  private func aiSuggestionButton(_ title: String, systemImage: String, stageID: String, prompt: String = "") -> some View {
    Button {
      selectedStageID = stageID
      aiPrompt = prompt
      Task { await runAIWorkflow() }
    } label: {
      Label(title, systemImage: systemImage)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .disabled(isGenerating || store.activeSection == nil)
  }

  private var publishingAssistantContent: some View {
    let draft = publishingDraft ?? PublishingAssistantServices.draft(for: store.envelope)
    return VStack(alignment: .leading, spacing: 14) {
      HStack {
        Button {
          publishingDraft = PublishingAssistantServices.draft(for: store.envelope)
        } label: {
          Label("Regenerate Draft", systemImage: "arrow.clockwise")
        }
        Button {
          copyPublishingDraft()
        } label: {
          Label("Copy All", systemImage: "doc.on.doc")
        }
        Spacer()
      }

      publishingField("Book description / blurb", value: Binding(get: {
        draft.bookDescription
      }, set: { value in
        var copy = draft
        copy.bookDescription = value
        publishingDraft = copy
      }), rows: 4)
      publishingField("Short synopsis", value: Binding(get: {
        draft.shortSynopsis
      }, set: { value in
        var copy = draft
        copy.shortSynopsis = value
        publishingDraft = copy
      }), rows: 3)
      publishingField("Long synopsis", value: Binding(get: {
        draft.longSynopsis
      }, set: { value in
        var copy = draft
        copy.longSynopsis = value
        publishingDraft = copy
      }), rows: 5)
      publishingField("Author bio", value: Binding(get: {
        draft.authorBioShort
      }, set: { value in
        var copy = draft
        copy.authorBioShort = value
        publishingDraft = copy
      }), rows: 3)
      publishingField("Keywords", value: Binding(get: {
        draft.keywordSuggestions
      }, set: { value in
        var copy = draft
        copy.keywordSuggestions = value
        publishingDraft = copy
      }), rows: 2)
      publishingField("Back-cover copy", value: Binding(get: {
        draft.backCoverCopy
      }, set: { value in
        var copy = draft
        copy.backCoverCopy = value
        publishingDraft = copy
      }), rows: 4)
      publishingField("Hook lines", value: Binding(get: {
        draft.hookLines
      }, set: { value in
        var copy = draft
        copy.hookLines = value
        publishingDraft = copy
      }), rows: 4)
    }
  }

  private func publishingField(_ label: String, value: Binding<String>, rows: Int) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(label)
        .font(.headline)
      TextField(label, text: value, axis: .vertical)
        .lineLimit(2...max(2, rows))
        .textFieldStyle(.roundedBorder)
    }
  }

  private var gettingStartedContent: some View {
    VStack(alignment: .leading, spacing: 16) {
      GroupBox("Project Blueprint") {
        Form {
          TextField("Genre", text: textBinding(
            get: { store.envelope.storyBlueprint?.genre ?? "" },
            set: { value in updateBlueprint { $0.genre = value } }
          ))
          TextField("Subgenre", text: textBinding(
            get: { store.envelope.storyBlueprint?.subgenre ?? "" },
            set: { value in updateBlueprint { $0.subgenre = value } }
          ))
          TextField("Target Audience", text: textBinding(
            get: { store.envelope.storyBlueprint?.targetAudience ?? "" },
            set: { value in updateBlueprint { $0.targetAudience = value } }
          ))
          TextField("Age Band", text: textBinding(
            get: { store.envelope.storyBlueprint?.ageBand ?? "" },
            set: { value in updateBlueprint { $0.ageBand = value } }
          ))
          TextField("Tone", text: textBinding(
            get: { store.envelope.storyBlueprint?.tone ?? "" },
            set: { value in updateBlueprint { $0.tone = value } }
          ))
          TextField("Voice", text: textBinding(
            get: { store.envelope.storyBlueprint?.voice ?? "" },
            set: { value in updateBlueprint { $0.voice = value } }
          ))
          Picker("Structure", selection: Binding(get: {
            store.envelope.storyBlueprint?.structure ?? .threeAct
          }, set: { value in
            updateBlueprint { $0.structure = value }
          })) {
            Text("Three Act").tag(StoryStructurePreference.threeAct)
            Text("Save The Cat").tag(StoryStructurePreference.saveTheCat)
            Text("Hero Journey").tag(StoryStructurePreference.heroJourney)
          }
          Picker("Pacing", selection: Binding(get: {
            store.envelope.storyBlueprint?.pacingProfile ?? .balanced
          }, set: { value in
            updateBlueprint { $0.pacingProfile = value }
          })) {
            Text("Fast").tag(PacingProfile.fast)
            Text("Balanced").tag(PacingProfile.balanced)
            Text("Slow Burn").tag(PacingProfile.slowBurn)
          }
          TextField("Target Words", value: Binding(get: {
            store.envelope.storyBlueprint?.targetWordCount ?? store.envelope.settings.novelWordGoal ?? 80_000
          }, set: { value in
            updateBlueprint { $0.targetWordCount = value }
            store.updateGoals(project: value)
          }), format: .number)
        }
        .formStyle(.grouped)
      }

      GroupBox("Quick Start") {
        VStack(alignment: .leading, spacing: 8) {
          Label("Create sections from the sidebar or Project menu.", systemImage: "plus.circle")
          Label("Use snapshots before major rewrites.", systemImage: "clock.arrow.circlepath")
          Label("Open Scene Templates to add structured beats.", systemImage: "doc.badge.plus")
          Label("Open AI Suggestions after configuring a provider.", systemImage: "wand.and.stars")
        }
        .foregroundStyle(.secondary)
      }
    }
  }

  private var diagnosticsContent: some View {
    let summary = store.diagnosticsSummary()
    let advanced = AnalyticsEngine.advancedAnalytics(for: store.envelope)
    let timeline = AnalysisServices.timelineFindings(for: store.envelope)
    let continuity = AnalysisServices.continuityWarnings(for: store.envelope)
    let guardrails = NativeOperationalGuardrails.shared
    let policy = guardrails.currentPolicy()
    let plugins = NativePluginRuntime.shared.registeredPlugins()
    let enabledPlugins = NativePluginRuntime.shared.enabledPlugins()
    let errors = NativeCrashReporter.shared.localEntries()
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
      Text("Runtime")
        .font(.headline)
      LabeledContent("Safe Mode", value: guardrails.isSafeModeEnabledForSession ? "Enabled" : "Disabled")
      LabeledContent("Updater Fallback", value: guardrails.isUpdaterFallbackMode ? "Enabled" : "Disabled")
      LabeledContent("Update Failures", value: "\(guardrails.updateFailureCount)")
      LabeledContent("Pinned Update", value: guardrails.pinnedUpdateVersion ?? "None")
      LabeledContent("Last Good Version", value: guardrails.lastGoodVersion ?? "Not recorded")
      LabeledContent("Managed Policy", value: runtimePolicySummary(policy))
      LabeledContent("Registered Plugins", value: "\(plugins.count)")
      LabeledContent("Enabled Plugins", value: "\(enabledPlugins.count)")
      LabeledContent("Recent Error Reports", value: "\(errors.count)")
      if !plugins.isEmpty {
        ForEach(plugins) { plugin in
          Label("\(plugin.name) \(plugin.version)", systemImage: enabledPlugins.contains(plugin) ? "checkmark.circle" : "pause.circle")
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

  private func runtimePolicySummary(_ policy: NativeManagedPolicy) -> String {
    var parts: [String] = []
    if policy.forceLocalOnly == true {
      parts.append("local-only")
    }
    if policy.disableAIProviders == true {
      parts.append("AI disabled")
    }
    if policy.disableTelemetry == true {
      parts.append("telemetry disabled")
    }
    if policy.requireSignedUpdates == true {
      parts.append("signed updates")
    }
    if let disabled = policy.disabledAIProviderTypes, !disabled.isEmpty {
      parts.append(disabled.map(\.rawValue).joined(separator: ", "))
    }
    if policy.settingsOverrides != nil {
      parts.append("settings overrides")
    }
    return parts.isEmpty ? "None" : parts.joined(separator: ", ")
  }

  @MainActor
  private func pushCollaborationState() async {
    guard let config = collaborationSyncConfig() else {
      collaborationMessage = "Enter a valid collaboration sync endpoint."
      return
    }
    isCollaborationSyncing = true
    defer { isCollaborationSyncing = false }
    do {
      let deviceId = Host.current().localizedName ?? "DraftHarbour macOS"
      let request = store.collaborationSyncRequest(deviceId: deviceId)
      let response = try await CollaborationSyncClient().push(request, config: config)
      store.applyCollaborationSyncResponse(response)
      collaborationMessage = "Pushed collaboration revision \(response.revision)."
    } catch {
      collaborationMessage = error.localizedDescription
    }
  }

  @MainActor
  private func pullCollaborationState() async {
    guard let config = collaborationSyncConfig() else {
      collaborationMessage = "Enter a valid collaboration sync endpoint."
      return
    }
    isCollaborationSyncing = true
    defer { isCollaborationSyncing = false }
    do {
      let response = try await CollaborationSyncClient().pull(
        projectId: store.envelope.project.id,
        since: store.envelope.collaboration.lastSyncRevision,
        config: config
      )
      store.applyCollaborationSyncResponse(response)
      collaborationMessage = "Pulled collaboration revision \(response.revision)."
    } catch {
      collaborationMessage = error.localizedDescription
    }
  }

  private func collaborationSyncConfig() -> CollaborationSyncConfig? {
    guard let rawEndpoint = store.envelope.collaboration.syncEndpoint,
          let endpoint = URL(string: rawEndpoint),
          endpoint.scheme?.hasPrefix("http") == true else {
      return nil
    }
    let token = collaborationSyncToken.trimmingCharacters(in: .whitespacesAndNewlines)
    return CollaborationSyncConfig(endpoint: endpoint, bearerToken: token.isEmpty ? nil : token)
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

  private func updateBlueprint(_ update: (inout StoryBlueprint) -> Void) {
    var blueprint = store.envelope.storyBlueprint ?? StoryBlueprint()
    update(&blueprint)
    store.updateStoryBlueprint(blueprint)
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

  @ViewBuilder
  private func cloudProviderStatus(for type: IntegrationType) -> some View {
    let config = store.integrationConfig(for: type)
    HStack(spacing: 10) {
      Label(config.enabled ? "Connected" : "Not connected", systemImage: config.enabled ? "checkmark.circle.fill" : "circle")
        .foregroundStyle(config.enabled ? .green : .secondary)
      if let providerUserId = config.providerUserId, !providerUserId.isEmpty {
        Text(providerUserId)
          .foregroundStyle(.secondary)
      }
      if let status = config.status, !status.isEmpty {
        Text(status.capitalized)
          .foregroundStyle(.secondary)
      }
      if let lastSyncAt = config.lastSyncAt {
        Text(Date(timeIntervalSince1970: Double(lastSyncAt) / 1_000).formatted())
          .foregroundStyle(.secondary)
      }
    }
    .font(.caption)
  }

  private func hydrateSyncFields() {
    let config = store.integrationConfig(for: .genericREST)
    syncBaseURL = config.baseUrl ?? UserDefaults.standard.string(forKey: "DraftHarbour.sync.baseUrl") ?? ""
    syncToken = (try? OAuthTokenPersistence.tokenValue(
      config.accessToken,
      account: config.accessTokenKeychainAccount,
      tokenStore: KeychainClient.shared
    )) ?? ""
    let scrivenerConfig = store.integrationConfig(for: .scrivener)
    scrivenerPath = scrivenerConfig.syncFolderPath ?? scrivenerConfig.folderId ?? UserDefaults.standard.string(forKey: "DraftHarbour.scrivener.path") ?? ""
    let googleConfig = store.integrationConfig(for: .googleDrive)
    googleDriveClientID = googleConfig.clientId ?? UserDefaults.standard.string(forKey: "DraftHarbour.googleDrive.clientId") ?? NativeOAuthDefaults.googleClientID
    let dropboxConfig = store.integrationConfig(for: .dropbox)
    dropboxAppKey = dropboxConfig.clientId ?? UserDefaults.standard.string(forKey: "DraftHarbour.dropbox.appKey") ?? NativeOAuthDefaults.dropboxAppKey
    dropboxFolderPath = dropboxConfig.syncFolderPath ?? UserDefaults.standard.string(forKey: "DraftHarbour.dropbox.folderPath") ?? "/DraftHarbour"
    if let config = store.envelope.aiProviders.first {
      loadAIProvider(config)
    }
  }

  private func saveSyncConfig(status: String? = nil) {
    UserDefaults.standard.set(syncBaseURL, forKey: "DraftHarbour.sync.baseUrl")
    var config = store.integrationConfig(for: .genericREST)
    config.enabled = !syncBaseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    config.status = status
    config.baseUrl = syncBaseURL.isEmpty ? nil : syncBaseURL

    let token = syncToken.trimmingCharacters(in: .whitespacesAndNewlines)
    if token.isEmpty {
      if let account = config.accessTokenKeychainAccount {
        try? KeychainClient.shared.deleteSecret(account: account)
      }
      config.accessToken = nil
      config.accessTokenKeychainAccount = nil
    } else {
      let connectionID = config.connectionId ?? makeIdentifier()
      config.connectionId = connectionID
      let account = config.accessTokenKeychainAccount ?? "integration.generic-rest.access.\(connectionID)"
      do {
        try KeychainClient.shared.setSecret(token, account: account)
        config.accessTokenKeychainAccount = account
        config.accessToken = nil
      } catch {
        syncMessage = error.localizedDescription
        config.accessToken = token
      }
    }
    store.updateIntegration(config)
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

  private func saveGoogleDriveConfig(status: String? = nil) -> IntegrationConfig {
    UserDefaults.standard.set(googleDriveClientID, forKey: "DraftHarbour.googleDrive.clientId")
    var config = store.integrationConfig(for: .googleDrive)
    config.clientId = googleDriveClientID.trimmingCharacters(in: .whitespacesAndNewlines)
    if let status {
      config.status = status
    }
    store.updateIntegration(config)
    return config
  }

  private func saveDropboxConfig(status: String? = nil) -> IntegrationConfig {
    UserDefaults.standard.set(dropboxAppKey, forKey: "DraftHarbour.dropbox.appKey")
    UserDefaults.standard.set(dropboxFolderPath, forKey: "DraftHarbour.dropbox.folderPath")
    var config = store.integrationConfig(for: .dropbox)
    config.clientId = dropboxAppKey.trimmingCharacters(in: .whitespacesAndNewlines)
    let folderPath = dropboxFolderPath.trimmingCharacters(in: .whitespacesAndNewlines)
    config.syncFolderPath = folderPath.isEmpty ? "/DraftHarbour" : folderPath
    if let status {
      config.status = status
    }
    store.updateIntegration(config)
    return config
  }

  private enum SyncAction {
    case connect
    case push
    case pull
    case revisions
  }

  private enum CloudAction {
    case connect
    case disconnect
    case sync
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

  @MainActor
  private func runCloud(_ type: IntegrationType, _ action: CloudAction) async {
    setCloudBusy(type, true)
    setCloudMessage(type, nil)
    syncConflicts = []
    defer { setCloudBusy(type, false) }

    let config = type == .dropbox ? saveDropboxConfig() : saveGoogleDriveConfig()
    let clientID = config.clientId ?? NativeOAuthDefaults.defaultClientID(for: type)
    let provider = NativeIntegrationProviderRegistry.provider(for: type, config: config)

    do {
      switch action {
      case .connect:
        let oauthConfig = try await NativeOAuthCoordinator.shared.connect(
          provider: type,
          clientID: clientID,
          existingConfig: config
        )
        store.updateIntegration(oauthConfig)
        let result = try await provider.connect(config: oauthConfig)
        store.applySyncResult(result)
        setCloudMessage(type, result.message)
      case .disconnect:
        let disconnected = try await NativeOAuthCoordinator.shared.disconnect(provider: type, config: config)
        store.updateIntegration(disconnected)
        setCloudMessage(type, disconnected.status ?? "Disconnected \(type.displayName).")
      case .sync:
        let pushResult = try await provider.push(config: config, payload: IntegrationPayload(envelope: store.envelope))
        store.applySyncResult(pushResult)
        let latestConfig = store.integrationConfig(for: type)
        let pullResult = try await provider.pull(config: latestConfig, payload: IntegrationPayload(envelope: store.envelope))
        store.applySyncResult(pullResult)
        syncConflicts = pullResult.conflicts
        setCloudMessage(type, "\(pushResult.message) \(pullResult.message)")
      case .revisions:
        remoteRevisions = try await provider.listRevisions(config: config)
        setCloudMessage(type, "Loaded \(remoteRevisions.count) \(type.displayName) revision(s).")
      }
    } catch {
      setCloudMessage(type, error.localizedDescription)
    }
  }

  private func setCloudBusy(_ type: IntegrationType, _ value: Bool) {
    switch type {
    case .dropbox:
      isDropboxSyncing = value
    case .googleDrive:
      isGoogleDriveSyncing = value
    case .genericREST, .scrivener:
      break
    }
  }

  private func setCloudMessage(_ type: IntegrationType, _ value: String?) {
    switch type {
    case .dropbox:
      dropboxMessage = value
    case .googleDrive:
      googleDriveMessage = value
    case .genericREST, .scrivener:
      break
    }
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
  private func runGrammarCheck(text: String) async {
    guard let url = URL(string: languageToolURL) else {
      grammarStatus = "LanguageTool URL is invalid."
      return
    }
    UserDefaults.standard.set(languageToolURL, forKey: "DraftHarbour.assist.languageToolUrl")
    UserDefaults.standard.set(languageToolLanguage, forKey: "DraftHarbour.assist.languageToolLanguage")

    isCheckingGrammar = true
    grammarStatus = nil
    grammarMatches = []
    defer { isCheckingGrammar = false }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    request.httpBody = LanguageToolServices.requestBody(text: MarkdownTools.plainText(from: text), language: languageToolLanguage)

    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
        grammarStatus = "LanguageTool returned HTTP \(http.statusCode)."
        return
      }
      grammarMatches = try LanguageToolServices.parseMatches(from: data)
      grammarStatus = grammarMatches.isEmpty ? "No grammar or style issues returned." : "Loaded \(grammarMatches.count) issue(s)."
    } catch {
      grammarStatus = error.localizedDescription
    }
  }

  private func copyPublishingDraft() {
    let draft = publishingDraft ?? PublishingAssistantServices.draft(for: store.envelope)
    let text = """
    Book description:
    \(draft.bookDescription)

    Short synopsis:
    \(draft.shortSynopsis)

    Long synopsis:
    \(draft.longSynopsis)

    Short author bio:
    \(draft.authorBioShort)

    Long author bio:
    \(draft.authorBioLong)

    Keywords:
    \(draft.keywordSuggestions)

    Categories:
    \(draft.categorySuggestions)

    Back-cover copy:
    \(draft.backCoverCopy)

    Hooks:
    \(draft.hookLines)
    """
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(text, forType: .string)
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
