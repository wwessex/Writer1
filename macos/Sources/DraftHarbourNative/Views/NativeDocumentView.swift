import AppKit
import DraftHarbourNativeCore
import SwiftUI
import UniformTypeIdentifiers

enum ToolPanel: String, CaseIterable, Identifiable, Hashable {
  case export
  case snapshots
  case dashboard
  case wordCount
  case comments
  case characterBible
  case storyCards
  case integrations
  case ai
  case diagnostics

  var id: String { rawValue }

  var title: String {
    switch self {
    case .export: "Export"
    case .snapshots: "Snapshots"
    case .dashboard: "Dashboard"
    case .wordCount: "Word Count"
    case .comments: "Comments"
    case .characterBible: "Character & World"
    case .storyCards: "Story Cards"
    case .integrations: "Integrations"
    case .ai: "AI Writing"
    case .diagnostics: "Diagnostics"
    }
  }

  var systemImage: String {
    switch self {
    case .export: "square.and.arrow.up"
    case .snapshots: "clock.arrow.circlepath"
    case .dashboard: "chart.bar.xaxis"
    case .wordCount: "textformat.abc"
    case .comments: "text.bubble"
    case .characterBible: "person.2"
    case .storyCards: "rectangle.grid.2x2"
    case .integrations: "point.3.connected.trianglepath.dotted"
    case .ai: "sparkles"
    case .diagnostics: "stethoscope"
    }
  }
}

struct NativeDocumentView: View {
  @Binding private var document: DraftHarbourDocument
  private let fileURL: URL?
  private let recoveryService = SessionRecoveryService()
  @State private var store: ProjectStore
  @State private var toolPanelCoordinator = ToolPanelWindowCoordinator()
  @State private var columnVisibility = NavigationSplitViewVisibility.all
  @SceneStorage("DraftHarbour.workspaceMode") private var workspaceModeRaw = WorkspaceMode.write.rawValue
  @SceneStorage("DraftHarbour.selectedToolPanel") private var selectedToolPanel = ToolPanel.dashboard.rawValue
  @SceneStorage("DraftHarbour.inspectorVisible") private var inspectorVisible = true
  @State private var showingQuickSwitcher = false
  @State private var showingFindReplace = false
  @State private var exportError: String?
  @State private var operationMessage: String?
  @State private var recoveryState = "Ready"
  @State private var pendingRecovery: RecoverySnapshot?
  @State private var spotlightIndexTask: Task<Void, Never>?
  @State private var selectedRange = NSRange(location: 0, length: 0)
  @State private var showingAddCommentPrompt = false
  @State private var isRunningSelectionAI = false
  @State private var commentDraft = ""
  @AppStorage("DraftHarbour.editor.theme") private var theme = "auto"
  @AppStorage("DraftHarbour.editor.pageView") private var pageView = false
  @AppStorage("DraftHarbour.editor.focusMode") private var focusMode = false
  @AppStorage("DraftHarbour.editor.typewriterMode") private var typewriterMode = false
  @AppStorage("DraftHarbour.ai.translationLanguage") private var contextTranslationCode = "es"

  private var workspaceMode: Binding<WorkspaceMode> {
    Binding {
      WorkspaceMode(rawValue: workspaceModeRaw) ?? .write
    } set: { mode in
      workspaceModeRaw = mode.rawValue
    }
  }

  init(document: Binding<DraftHarbourDocument>, fileURL: URL? = nil) {
    self._document = document
    self.fileURL = fileURL
    self._store = State(initialValue: ProjectStore(envelope: document.wrappedValue.envelope))
  }

  var body: some View {
    NavigationSplitView(columnVisibility: $columnVisibility) {
      SidebarView(store: store)
        .navigationSplitViewColumnWidth(min: 220, ideal: 280, max: 360)
    } detail: {
      workspace
    }
    .focusedValue(\.projectStore, store)
    .navigationTitle(store.envelope.project.title)
    .toolbar {
      ToolbarItemGroup {
        Button {
          runCommand(.toggleSidebar)
        } label: {
          Label("Toggle Sidebar", systemImage: "sidebar.left")
        }
        .labelStyle(.iconOnly)
        .help("Toggle sidebar")
        .disabled(!commandEnabled(.toggleSidebar))

        Button {
          runCommand(.newSection)
        } label: {
          Label(store.projectType == .screenplay ? "New Scene" : "New Chapter", systemImage: "plus")
        }
        .labelStyle(.iconOnly)
        .help(store.projectType == .screenplay ? "New scene" : "New chapter")
        .disabled(!commandEnabled(.newSection))

        Picker("Workspace", selection: workspaceMode) {
          ForEach(WorkspaceMode.allCases) { mode in
            Label(mode.title, systemImage: mode.systemImage).tag(mode)
          }
        }
        .pickerStyle(.segmented)
        .frame(width: 260)
        .disabled(!commandEnabled(.workspaceWrite))

        Button {
          runCommand(.quickSwitcher)
        } label: {
          Label("Quick Switcher", systemImage: "command")
        }
        .labelStyle(.iconOnly)
        .help("Quick switcher")
        .disabled(!commandEnabled(.quickSwitcher))

        Button {
          runCommand(.nativeFind)
        } label: {
          Label("Find", systemImage: "magnifyingglass")
        }
        .labelStyle(.iconOnly)
        .help("Find in active section")
        .disabled(!commandEnabled(.nativeFind))

        Button {
          runCommand(.projectFindReplace)
        } label: {
          Label("Project Find and Replace", systemImage: "doc.text.magnifyingglass")
        }
        .labelStyle(.iconOnly)
        .help("Find and replace in project")
        .disabled(!commandEnabled(.projectFindReplace))

        Button {
          runCommand(.toggleToolPanel)
        } label: {
          Label("Open Tool", systemImage: "slider.horizontal.3")
        }
        .labelStyle(.iconOnly)
        .help("Toggle tool panel")
        .disabled(!commandEnabled(.toggleToolPanel))

        Button {
          runCommand(.inspector)
        } label: {
          Label("Inspector", systemImage: "sidebar.right")
        }
        .labelStyle(.iconOnly)
        .help("Toggle inspector")
        .disabled(!commandEnabled(.inspector))
      }
    }
    .sheet(isPresented: $showingQuickSwitcher) {
      QuickSwitcherView(store: store, runCommand: runCommand(_:))
    }
    .alert("Export Failed", isPresented: Binding(get: { exportError != nil }, set: { if !$0 { exportError = nil } })) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(exportError ?? "")
    }
    .alert("DraftHarbour", isPresented: Binding(get: { operationMessage != nil }, set: { if !$0 { operationMessage = nil } })) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(operationMessage ?? "")
    }
    .alert("Add Comment", isPresented: $showingAddCommentPrompt) {
      TextField("Comment", text: $commentDraft)
      Button("Add") {
        addCommentFromDraft()
      }
      Button("Cancel", role: .cancel) {
        commentDraft = ""
      }
    } message: {
      Text("Attach a comment to the current selection.")
    }
    .alert("Restore Unsaved Draft?", isPresented: Binding(get: { pendingRecovery != nil }, set: { if !$0 { pendingRecovery = nil } })) {
      Button("Restore") {
        if let pendingRecovery {
          store.replaceEnvelope(pendingRecovery.envelope, activeSectionID: pendingRecovery.activeSectionID)
        }
        pendingRecovery = nil
      }
      Button("Discard", role: .destructive) {
        try? recoveryService.clear(projectId: store.envelope.project.id)
        pendingRecovery = nil
      }
      Button("Later", role: .cancel) {
        pendingRecovery = nil
      }
    } message: {
      Text("A newer autosaved recovery copy exists for this project.")
    }
    .onChange(of: store.revision) { _, _ in
      document.envelope = store.envelope
      _ = try? recoveryService.save(envelope: store.envelope, activeSectionID: store.activeSectionID, sourceURL: fileURL)
      recoveryState = "Recovery saved"
      scheduleSpotlightIndexing()
    }
    .onChange(of: store.activeSectionID) { _, newValue in
      recoveryService.recordActiveSectionID(newValue, projectId: store.envelope.project.id)
    }
    .onAppear {
      if let fileURL {
        recoveryService.recordLastOpenedProjectURL(fileURL)
        NSDocumentController.shared.noteNewRecentDocumentURL(fileURL)
      }
      if let savedActiveSection = recoveryService.activeSectionID(projectId: store.envelope.project.id),
         store.envelope.sections.contains(where: { $0.id == savedActiveSection }) {
        store.selectSection(savedActiveSection)
      }
      if let snapshot = try? recoveryService.load(projectId: store.envelope.project.id),
         recoveryService.shouldOfferRestore(snapshot, documentURL: fileURL) {
        pendingRecovery = snapshot
        recoveryState = "Recovery available"
      }
      scheduleSpotlightIndexing(delay: 0)
    }
    .onDisappear {
      spotlightIndexTask?.cancel()
      toolPanelCoordinator.close()
    }
    .onReceive(NotificationCenter.default.publisher(for: .draftHarbourShowQuickSwitcher)) { _ in
      showingQuickSwitcher = true
    }
    .onReceive(NotificationCenter.default.publisher(for: .draftHarbourShowFindReplace)) { _ in
      showingFindReplace = true
    }
    .onReceive(NotificationCenter.default.publisher(for: .draftHarbourRunCommand)) { notification in
      guard let request = notification.object as? NativeDocumentCommandRequest,
            request.target === store,
            commandEnabled(request.command) else {
        return
      }
      runCommand(request.command)
    }
    .onReceive(NotificationCenter.default.publisher(for: .draftHarbourOpenDeepLink)) { notification in
      guard let deepLink = notification.object as? NativeDeepLink,
            deepLink.projectID == store.envelope.project.id else {
        return
      }
      if let sectionID = deepLink.sectionID,
         store.envelope.sections.contains(where: { $0.id == sectionID }) {
        store.selectSection(sectionID)
      }
    }
    .safeAreaInset(edge: .bottom) {
      WritingStatusBar(store: store, fileURL: fileURL, recoveryState: recoveryState) { result in
        operationMessage = result.wordsWritten == 1
          ? "Recorded 1 word for today's writing session."
          : "Recorded \(result.wordsWritten) words for today's writing session."
      }
    }
  }

  private var workspace: some View {
    Group {
      switch workspaceMode.wrappedValue {
      case .write:
        HSplitView {
          EditorWorkspaceView(
            store: store,
            selectedRange: $selectedRange,
            showingFindReplace: $showingFindReplace,
            addComment: { runCommand(.addComment) },
            createSnapshot: createContextSnapshot,
            reviseSelection: { runSelectionAI(stageID: "revise") },
            translateSelection: { runSelectionAI(stageID: "translate") },
            shareSelection: { runCommand(.shareSelection) },
            copyMarkdown: copySelectionMarkdown
          )
            .frame(minWidth: 520, maxWidth: .infinity)

          if inspectorVisible {
            InspectorView(store: store, selectedRange: selectedRange)
              .frame(minWidth: 280, idealWidth: 340, maxWidth: 460)
          }
        }
      case .corkboard:
        CorkboardWorkspaceView(store: store)
      case .review:
        ReviewWorkspaceView(store: store, selectedRange: selectedRange, runCommand: runCommand(_:))
      }
    }
  }

  private func export(format: ExportFormat) {
    do {
      let exported = try ExporterRegistry.exporter(for: format).export(store.envelope)
      let validation = ExportValidator.validate(store.envelope, format: format)
      let panel = NSSavePanel()
      panel.nameFieldStringValue = exported.filename
      panel.canCreateDirectories = true
      if let directory = UserDefaults.standard.string(forKey: "DraftHarbour.export.lastDirectory") {
        panel.directoryURL = URL(fileURLWithPath: directory, isDirectory: true)
      }
      panel.begin { response in
        guard response == .OK, let url = panel.url else { return }
        do {
          try exported.data.write(to: url, options: .atomic)
          UserDefaults.standard.set(url.deletingLastPathComponent().path, forKey: "DraftHarbour.export.lastDirectory")
          store.recordExport(exported, format: format, validationIssues: validation)
        } catch {
          exportError = error.localizedDescription
        }
      }
    } catch {
      exportError = error.localizedDescription
    }
  }

  private func importDocument() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowsMultipleSelection = true
    panel.allowedContentTypes = ["txt", "md", "markdown", "fountain", "spmd", "rtf", "docx"].compactMap { UTType(filenameExtension: $0) }
    panel.begin { response in
      guard response == .OK else { return }
      var importedCount = 0
      var notices: [String] = []
      for url in panel.urls {
        do {
          let data = try Data(contentsOf: url)
          let result = try ImporterRegistry.importer(for: url.lastPathComponent).importDocument(
            data: data,
            filename: url.lastPathComponent,
            projectId: store.envelope.project.id,
            projectType: store.projectType
          )
          importedCount += store.importSections(result.sections, selectFirst: importedCount == 0).count
          notices.append(contentsOf: result.notices.map(\.message))
        } catch {
          notices.append("\(url.lastPathComponent): \(error.localizedDescription)")
        }
      }
      operationMessage = ([importedCount == 1 ? "Imported 1 section." : "Imported \(importedCount) sections."] + notices).joined(separator: "\n")
    }
  }

  private func exportProjectBackup(copyOnly: Bool = false) {
    do {
      let data = try DhprojCodec.encode(store.envelope)
      let panel = NSSavePanel()
      panel.nameFieldStringValue = "\(store.envelope.project.title)-backup.dhproj"
      panel.canCreateDirectories = true
      panel.allowedContentTypes = [.dhproj]
      panel.begin { response in
        guard response == .OK, let url = panel.url else { return }
        do {
          try data.write(to: url, options: .atomic)
          operationMessage = copyOnly ? "Saved project copy to \(url.lastPathComponent)." : "Exported backup to \(url.lastPathComponent)."
        } catch {
          exportError = error.localizedDescription
        }
      }
    } catch {
      exportError = error.localizedDescription
    }
  }

  private func importProjectBackup() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowsMultipleSelection = false
    panel.allowedContentTypes = [.dhproj]
    panel.begin { response in
      guard response == .OK, let url = panel.url else { return }
      do {
        let envelope = try DhprojCodec.decode(Data(contentsOf: url))
        store.replaceEnvelope(envelope)
        operationMessage = "Imported backup from \(url.lastPathComponent)."
      } catch {
        exportError = error.localizedDescription
      }
    }
  }

  private func reopenLastProject() {
    guard let url = recoveryService.recentProjectURLs().first else {
      operationMessage = "No recent DraftHarbour projects have been recorded yet."
      return
    }
    NSDocumentController.shared.openDocument(withContentsOf: url, display: true) { _, _, error in
      if let error {
        operationMessage = error.localizedDescription
      }
    }
  }

  private func addCommentFromDraft() {
    let text = commentDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else { return }
    _ = try? store.addComment(
      text: text,
      from: selectedRange.location,
      to: selectedRange.location + selectedRange.length,
      selectedText: store.activeSection?.content.flatMap { content in
        let bounded = boundedRange(selectedRange, in: content)
        guard let range = Range(bounded, in: content), !content[range].isEmpty else { return nil }
        return String(content[range])
      }
    )
    commentDraft = ""
    showToolPanel(.comments)
  }

  private func insertSceneTemplate() {
    do {
      if store.projectType == .screenplay {
        let scene = try store.createScene(initialData: Scene(
          title: "Template Scene",
          summary: "Scene goal, conflict, and turn.",
          status: .planned,
          tags: ["template", "slugLine", "action", "characterCue", "dialogue"],
          slugLine: "INT. LOCATION - DAY",
          location: "LOCATION",
          interiorExterior: "INT",
          timeOfDay: "DAY",
          pageEstimate: 1,
          productionTags: ["cast", "location"]
        ))
        store.updateActiveSectionContent([
          scene.slugLine ?? "INT. LOCATION - DAY",
          "",
          "Action line.",
          "",
          "@CHARACTER",
          "Dialogue."
        ].joined(separator: "\n"))
      } else {
        _ = try store.createScene(initialData: Scene(
          title: "Template Scene",
          summary: "Goal, conflict, turn, and consequence.",
          status: .planned,
          tags: ["template"],
          wordGoal: 1_000
        ))
      }
      showToolPanel(.storyCards)
    } catch {
      exportError = error.localizedDescription
    }
  }

  private func sendResponderAction(_ selector: String) {
    NSApp.sendAction(Selector((selector)), to: nil, from: nil)
  }

  private func boundedRange(_ range: NSRange, in text: String) -> NSRange {
    let length = (text as NSString).length
    let location = min(max(0, range.location), length)
    return NSRange(location: location, length: min(max(0, range.length), length - location))
  }

  private func showToolPanel(_ panel: ToolPanel) {
    selectedToolPanel = panel.rawValue
    toolPanelCoordinator.show(
      panel: panel,
      store: store,
      exportAction: export(format:),
      runCommand: runCommand(_:)
    )
  }

  private func commandEnabled(_ command: NativeCommandID) -> Bool {
    switch command {
    case .newSection, .importDocument, .export, .saveProjectFile, .exportBackup, .importBackup, .saveProjectCopy, .openRecent, .reopenLastProject, .dashboard, .quickSwitcher, .nativeFind, .projectFindReplace, .workspaceWrite, .workspaceCorkboard, .workspaceReview, .toggleSidebar, .toggleToolPanel, .togglePageView, .toggleFocusMode, .toggleTypewriterMode, .themeAuto, .themeLight, .themeDark, .wordCount, .analysis, .advancedAnalytics, .characterBible, .storyCards, .comments, .aiWriting, .translation, .integrations, .exportHistory, .onboarding, .inspector, .findReplace:
      return true
    case .snapshots, .addComment, .sceneTemplates, .insertBlockquote, .insertHorizontalRule, .formatBold, .formatItalic, .formatUnderline, .formatHeading1, .formatHeading2, .formatParagraph, .shareActiveSection, .printActiveSection:
      return store.activeSection != nil
    case .shareSelection:
      return !selectedText().isEmpty
    case .revealProjectInFinder, .copyProjectPath:
      return fileURL != nil
    case .printProject:
      return !store.envelope.sections.isEmpty
    case .settings, .about, .openProjectFile, .projects, .aiPanel, .corkboard:
      return true
    case .undo, .redo, .cut, .copy, .paste, .selectAll:
      return true
    }
  }

  private func showNativeFind() {
    let menuItem = NSMenuItem()
    if #available(macOS 13.0, *) {
      menuItem.tag = NSTextFinder.Action.showFindInterface.rawValue
    }

    if !NSApp.sendAction(#selector(NSTextView.performFindPanelAction(_:)), to: nil, from: menuItem) {
      NSApp.sendAction(Selector(("orderFrontFindPanel:")), to: nil, from: nil)
    }
  }

  private func revealProjectInFinder() {
    guard let fileURL else { return }
    NSWorkspace.shared.activateFileViewerSelecting([fileURL])
  }

  private func copyProjectPath() {
    guard let fileURL else { return }
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(fileURL.path, forType: .string)
    operationMessage = "Copied project path."
  }

  private func copySelectionMarkdown() {
    let text = selectedText()
    guard !text.isEmpty else { return }
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(text, forType: .string)
    operationMessage = "Copied selection as Markdown."
  }

  private func shareSelection() {
    let text = selectedText()
    guard !text.isEmpty else { return }
    showSharingPicker(items: [text])
  }

  private func shareActiveSection() {
    guard let section = store.activeSection else { return }
    showSharingPicker(items: [printableText(for: [section])])
  }

  private func showSharingPicker(items: [Any]) {
    guard let view = NSApp.keyWindow?.contentView else { return }
    let picker = NSSharingServicePicker(items: items)
    picker.show(relativeTo: view.bounds, of: view, preferredEdge: .minY)
  }

  private func printActiveSection() {
    guard let section = store.activeSection else { return }
    printText(printableText(for: [section]), title: section.title)
  }

  private func printProject() {
    printText(printableText(for: store.envelope.sections), title: store.envelope.project.title)
  }

  private func printableText(for sections: [DraftHarbourNativeCore.Section]) -> String {
    sections.map { section in
      [
        section.title,
        MarkdownTools.plainText(from: section.content ?? "")
      ]
      .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
      .joined(separator: "\n\n")
    }
    .joined(separator: "\n\n---\n\n")
  }

  private func printText(_ text: String, title: String) {
    let textView = NSTextView(frame: NSRect(x: 0, y: 0, width: 612, height: 792))
    textView.string = text
    textView.font = NSFont.systemFont(ofSize: 12)
    textView.isEditable = false
    textView.isSelectable = false
    textView.textContainerInset = NSSize(width: 36, height: 36)
    textView.sizeToFit()

    let operation = NSPrintOperation(view: textView)
    operation.jobTitle = title
    operation.showsPrintPanel = true
    operation.showsProgressPanel = true
    operation.run()
  }

  private func selectedText() -> String {
    guard let content = store.activeSection?.content else { return "" }
    let bounded = boundedRange(selectedRange, in: content)
    guard bounded.length > 0, let range = Range(bounded, in: content) else { return "" }
    return String(content[range])
  }

  private func createContextSnapshot() {
    do {
      _ = try store.createSnapshot(label: "Context")
      operationMessage = "Created snapshot for \(store.activeSection?.title ?? "active section")."
    } catch {
      exportError = error.localizedDescription
    }
  }

  private func runSelectionAI(stageID: String) {
    guard !isRunningSelectionAI else { return }
    let source = selectedText()
    guard let section = store.activeSection, !source.isEmpty else { return }
    guard let config = store.envelope.aiProviders.first(where: \.enabled) else {
      showToolPanel(.ai)
      operationMessage = "Configure an AI provider before using selection actions."
      return
    }

    isRunningSelectionAI = true
    Task { @MainActor in
      defer { isRunningSelectionAI = false }
      do {
        let provider = try NativeAIProviderFactory().provider(from: config)
        let prompt: String
        if stageID == "translate" {
          let language = AIWorkflowServices.translationLanguages.first { $0.code == contextTranslationCode } ?? AIWorkflowServices.translationLanguages[0]
          prompt = AIWorkflowServices.translationPrompt(text: source, language: language, preserveFormatting: true)
        } else {
          prompt = "Revise this selected passage for clarity, tension, and character voice:\n\n\(source)"
        }
        let response = try await provider.generate(AIRequest(prompt: prompt, context: source, projectType: store.projectType, sectionTitle: section.title, model: config.model))
        let before = section.content ?? ""
        store.applyGeneratedText(response.text, mode: .replace, range: selectedRange)
        store.recordAIRevision(
          sectionID: section.id,
          providerId: response.provider,
          prompt: prompt,
          before: before,
          after: store.activeSection?.content ?? ""
        )
        operationMessage = stageID == "translate" ? "Translated selection." : "Revised selection."
      } catch {
        exportError = error.localizedDescription
      }
    }
  }

  private func scheduleSpotlightIndexing(delay: UInt64 = 750_000_000) {
    let envelope = store.envelope
    let fileURL = fileURL
    spotlightIndexTask?.cancel()
    spotlightIndexTask = Task {
      if delay > 0 {
        try? await Task.sleep(nanoseconds: delay)
      }
      guard !Task.isCancelled else { return }
      SpotlightIndexingService.index(envelope: envelope, fileURL: fileURL)
    }
  }

  private func runCommand(_ command: NativeCommandID) {
    switch command {
    case .newSection:
      _ = store.createSection(after: store.activeSectionID)
    case .importDocument:
      importDocument()
    case .saveProjectFile:
      sendResponderAction("saveDocument:")
      _ = try? recoveryService.clear(projectId: store.envelope.project.id)
    case .openProjectFile:
      NSDocumentController.shared.openDocument(nil)
    case .openRecent:
      reopenLastProject()
    case .reopenLastProject:
      reopenLastProject()
    case .exportBackup:
      exportProjectBackup()
    case .importBackup:
      importProjectBackup()
    case .saveProjectCopy:
      exportProjectBackup(copyOnly: true)
    case .settings:
      sendResponderAction("showSettingsWindow:")
    case .about:
      sendResponderAction("orderFrontStandardAboutPanel:")
    case .findReplace, .projectFindReplace:
      showingFindReplace = true
    case .nativeFind:
      showNativeFind()
    case .workspaceWrite:
      workspaceMode.wrappedValue = .write
    case .workspaceCorkboard:
      workspaceMode.wrappedValue = .corkboard
    case .workspaceReview:
      workspaceMode.wrappedValue = .review
    case .quickSwitcher:
      showingQuickSwitcher = true
    case .undo:
      sendResponderAction("undo:")
    case .redo:
      sendResponderAction("redo:")
    case .cut:
      sendResponderAction("cut:")
    case .copy:
      sendResponderAction("copy:")
    case .paste:
      sendResponderAction("paste:")
    case .selectAll:
      sendResponderAction("selectAll:")
    case .formatBold:
      store.applyMarkdownCommand(.bold, range: selectedRange)
    case .formatItalic:
      store.applyMarkdownCommand(.italic, range: selectedRange)
    case .formatUnderline:
      store.applyMarkdownCommand(.underline, range: selectedRange)
    case .formatHeading1:
      store.applyMarkdownCommand(.heading(level: 1), range: selectedRange)
    case .formatHeading2:
      store.applyMarkdownCommand(.heading(level: 2), range: selectedRange)
    case .formatParagraph:
      store.applyMarkdownCommand(.paragraph, range: selectedRange)
    case .insertBlockquote:
      store.applyMarkdownCommand(.blockquote, range: selectedRange)
    case .insertHorizontalRule:
      store.applyMarkdownCommand(.horizontalRule, range: selectedRange)
    case .snapshots:
      showToolPanel(.snapshots)
    case .comments:
      showToolPanel(.comments)
    case .addComment:
      commentDraft = ""
      showingAddCommentPrompt = true
    case .dashboard:
      showToolPanel(.dashboard)
    case .wordCount:
      showToolPanel(.wordCount)
    case .analysis, .advancedAnalytics:
      workspaceMode.wrappedValue = .review
    case .characterBible:
      showToolPanel(.characterBible)
    case .storyCards, .corkboard:
      workspaceMode.wrappedValue = .corkboard
    case .integrations:
      showToolPanel(.integrations)
    case .aiWriting, .aiPanel, .translation:
      showToolPanel(.ai)
    case .export:
      showToolPanel(.export)
    case .projects:
      importProjectBackup()
    case .sceneTemplates:
      insertSceneTemplate()
    case .exportHistory:
      workspaceMode.wrappedValue = .review
    case .onboarding:
      operationMessage = "Use the project settings and Character & World tools to finish setup for this native document."
    case .inspector:
      if workspaceMode.wrappedValue != .write {
        workspaceMode.wrappedValue = .write
      }
      inspectorVisible.toggle()
    case .toggleSidebar:
      columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly
    case .toggleToolPanel:
      if toolPanelCoordinator.isOpen {
        toolPanelCoordinator.close()
      } else {
        showToolPanel(ToolPanel(rawValue: selectedToolPanel) ?? .dashboard)
      }
    case .togglePageView:
      pageView.toggle()
    case .toggleFocusMode:
      focusMode.toggle()
      inspectorVisible = !focusMode
      columnVisibility = focusMode ? .detailOnly : .all
    case .themeAuto:
      theme = "auto"
    case .themeLight:
      theme = "light"
    case .themeDark:
      theme = "dark"
    case .toggleTypewriterMode:
      typewriterMode.toggle()
    case .revealProjectInFinder:
      revealProjectInFinder()
    case .copyProjectPath:
      copyProjectPath()
    case .shareSelection:
      shareSelection()
    case .shareActiveSection:
      shareActiveSection()
    case .printActiveSection:
      printActiveSection()
    case .printProject:
      printProject()
    }
  }
}

extension Notification.Name {
  static let draftHarbourShowQuickSwitcher = Notification.Name("DraftHarbourShowQuickSwitcher")
  static let draftHarbourShowFindReplace = Notification.Name("DraftHarbourShowFindReplace")
  static let draftHarbourRunCommand = Notification.Name("DraftHarbourRunCommand")
  static let draftHarbourOpenDeepLink = Notification.Name("DraftHarbourOpenDeepLink")
  static let draftHarbourShowNewProjectSetup = Notification.Name("DraftHarbourShowNewProjectSetup")
  static let draftHarbourOpenProjectFile = Notification.Name("DraftHarbourOpenProjectFile")
}
