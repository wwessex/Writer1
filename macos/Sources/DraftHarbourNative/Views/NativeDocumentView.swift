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
  @State private var columnVisibility = NavigationSplitViewVisibility.all
  @SceneStorage("DraftHarbour.selectedToolPanel") private var selectedToolPanel = ToolPanel.dashboard.rawValue
  @SceneStorage("DraftHarbour.inspectorVisible") private var inspectorVisible = true
  @State private var showingToolPanel = false
  @State private var showingQuickSwitcher = false
  @State private var showingFindReplace = false
  @State private var exportError: String?
  @State private var operationMessage: String?
  @State private var pendingRecovery: RecoverySnapshot?
  @State private var selectedRange = NSRange(location: 0, length: 0)
  @AppStorage("DraftHarbour.editor.theme") private var theme = "system"
  @AppStorage("DraftHarbour.editor.pageView") private var pageView = false
  @AppStorage("DraftHarbour.editor.focusMode") private var focusMode = false
  @AppStorage("DraftHarbour.editor.typewriterMode") private var typewriterMode = false

  init(document: Binding<DraftHarbourDocument>, fileURL: URL? = nil) {
    self._document = document
    self.fileURL = fileURL
    self._store = State(initialValue: ProjectStore(envelope: document.wrappedValue.envelope))
  }

  var body: some View {
    NavigationSplitView(columnVisibility: $columnVisibility) {
      SidebarView(store: store)
        .navigationSplitViewColumnWidth(min: 220, ideal: 280, max: 360)
    } content: {
      EditorWorkspaceView(store: store, selectedRange: $selectedRange, showingFindReplace: $showingFindReplace)
        .navigationSplitViewColumnWidth(min: 520, ideal: 820)
    } detail: {
      if inspectorVisible {
        InspectorView(store: store, selectedRange: selectedRange)
          .navigationSplitViewColumnWidth(min: 260, ideal: 320, max: 420)
      }
    }
    .focusedValue(\.projectStore, store)
    .navigationTitle(store.envelope.project.title)
    .toolbar {
      ToolbarItemGroup {
        Button {
          _ = store.createSection(after: store.activeSectionID)
        } label: {
          Label(store.projectType == .screenplay ? "New Scene" : "New Chapter", systemImage: "plus")
        }

        Picker("Tools", selection: $selectedToolPanel) {
          ForEach(ToolPanel.allCases) { panel in
            Label(panel.title, systemImage: panel.systemImage).tag(panel.rawValue)
          }
        }
        .pickerStyle(.menu)
        .onChange(of: selectedToolPanel) { _, _ in showingToolPanel = true }

        Button {
          showingQuickSwitcher = true
        } label: {
          Label("Quick Switcher", systemImage: "command")
        }

        Button {
          showingFindReplace.toggle()
        } label: {
          Label("Find", systemImage: "magnifyingglass")
        }

        Button {
          showingToolPanel = true
        } label: {
          Label("Open Tool", systemImage: "slider.horizontal.3")
        }

        Button {
          inspectorVisible.toggle()
        } label: {
          Label("Inspector", systemImage: inspectorVisible ? "sidebar.right" : "sidebar.right")
        }
      }
    }
    .sheet(isPresented: $showingToolPanel) {
      ToolPanelView(
        panel: ToolPanel(rawValue: selectedToolPanel) ?? .dashboard,
        store: store,
        exportAction: export(format:),
        runCommand: runCommand(_:)
      )
      .frame(minWidth: 680, minHeight: 520)
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
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: .draftHarbourShowQuickSwitcher)) { _ in
      showingQuickSwitcher = true
    }
    .onReceive(NotificationCenter.default.publisher(for: .draftHarbourShowFindReplace)) { _ in
      showingFindReplace = true
    }
    .onReceive(NotificationCenter.default.publisher(for: .draftHarbourRunCommand)) { notification in
      guard let raw = notification.object as? String, let command = NativeCommandID(rawValue: raw) else { return }
      runCommand(command)
    }
  }

  private func export(format: ExportFormat) {
    do {
      let exported = try ExporterRegistry.exporter(for: format).export(store.envelope)
      let validation = ExportValidator.validate(store.envelope, format: format)
      let panel = NSSavePanel()
      panel.nameFieldStringValue = exported.filename
      panel.canCreateDirectories = true
      panel.begin { response in
        guard response == .OK, let url = panel.url else { return }
        do {
          try exported.data.write(to: url, options: .atomic)
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

  private func sendResponderAction(_ selector: String) {
    NSApp.sendAction(Selector((selector)), to: nil, from: nil)
  }

  private func showToolPanel(_ panel: ToolPanel) {
    selectedToolPanel = panel.rawValue
    showingToolPanel = true
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
      let recent = recoveryService.recentProjectURLs()
      operationMessage = recent.isEmpty
        ? "No recent DraftHarbour projects have been recorded yet."
        : recent.map(\.path).joined(separator: "\n")
    case .settings:
      sendResponderAction("showSettingsWindow:")
    case .about:
      sendResponderAction("orderFrontStandardAboutPanel:")
    case .findReplace:
      showingFindReplace = true
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
      _ = try? store.addComment(text: "New comment", from: selectedRange.location, to: selectedRange.location + selectedRange.length)
      showToolPanel(.comments)
    case .dashboard:
      showToolPanel(.dashboard)
    case .wordCount:
      showToolPanel(.wordCount)
    case .analysis, .advancedAnalytics:
      showToolPanel(.diagnostics)
    case .characterBible:
      showToolPanel(.characterBible)
    case .storyCards, .corkboard:
      showToolPanel(.storyCards)
    case .integrations:
      showToolPanel(.integrations)
    case .aiWriting, .aiPanel, .translation:
      showToolPanel(.ai)
    case .export:
      showToolPanel(.export)
    case .projects:
      showToolPanel(.dashboard)
    case .sceneTemplates:
      showToolPanel(.diagnostics)
    case .exportHistory:
      showToolPanel(.export)
    case .onboarding:
      operationMessage = "Use the project settings and Character & World tools to finish setup for this native document."
    case .inspector:
      inspectorVisible.toggle()
    case .toggleSidebar:
      columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly
    case .togglePageView:
      pageView.toggle()
    case .toggleFocusMode:
      focusMode.toggle()
      inspectorVisible = !focusMode
      columnVisibility = focusMode ? .detailOnly : .all
    case .themeDark:
      theme = "dark"
    case .themeLight:
      theme = "light"
    case .themeHighContrast:
      theme = "high-contrast"
    case .toggleTypewriterMode:
      typewriterMode.toggle()
    }
  }
}

extension Notification.Name {
  static let draftHarbourShowQuickSwitcher = Notification.Name("DraftHarbourShowQuickSwitcher")
  static let draftHarbourShowFindReplace = Notification.Name("DraftHarbourShowFindReplace")
  static let draftHarbourRunCommand = Notification.Name("DraftHarbourRunCommand")
}
