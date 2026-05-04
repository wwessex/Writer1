import AppKit
import DraftHarbourNativeCore
import SwiftUI

enum ToolPanel: String, CaseIterable, Identifiable {
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
  @State private var store: ProjectStore
  @SceneStorage("DraftHarbour.selectedToolPanel") private var selectedToolPanel = ToolPanel.dashboard.rawValue
  @SceneStorage("DraftHarbour.inspectorVisible") private var inspectorVisible = true
  @State private var showingToolPanel = false
  @State private var showingQuickSwitcher = false
  @State private var showingFindReplace = false
  @State private var exportError: String?
  @State private var selectedRange = NSRange(location: 0, length: 0)

  init(document: Binding<DraftHarbourDocument>) {
    self._document = document
    self._store = State(initialValue: ProjectStore(envelope: document.wrappedValue.envelope))
  }

  var body: some View {
    NavigationSplitView {
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
        exportAction: export(format:)
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
    .onChange(of: store.revision) { _, _ in
      document.envelope = store.envelope
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

  private func runCommand(_ command: NativeCommandID) {
    switch command {
    case .newSection:
      _ = store.createSection(after: store.activeSectionID)
    case .findReplace:
      showingFindReplace = true
    case .quickSwitcher:
      showingQuickSwitcher = true
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
      selectedToolPanel = ToolPanel.snapshots.rawValue
      showingToolPanel = true
    case .comments:
      selectedToolPanel = ToolPanel.comments.rawValue
      showingToolPanel = true
    case .dashboard:
      selectedToolPanel = ToolPanel.dashboard.rawValue
      showingToolPanel = true
    case .wordCount:
      selectedToolPanel = ToolPanel.wordCount.rawValue
      showingToolPanel = true
    case .analysis, .advancedAnalytics:
      selectedToolPanel = ToolPanel.diagnostics.rawValue
      showingToolPanel = true
    case .characterBible:
      selectedToolPanel = ToolPanel.characterBible.rawValue
      showingToolPanel = true
    case .storyCards, .corkboard:
      selectedToolPanel = ToolPanel.storyCards.rawValue
      showingToolPanel = true
    case .integrations:
      selectedToolPanel = ToolPanel.integrations.rawValue
      showingToolPanel = true
    case .aiWriting, .aiPanel, .translation:
      selectedToolPanel = ToolPanel.ai.rawValue
      showingToolPanel = true
    case .export:
      selectedToolPanel = ToolPanel.export.rawValue
      showingToolPanel = true
    case .inspector:
      inspectorVisible.toggle()
    case .toggleTypewriterMode:
      UserDefaults.standard.set(!UserDefaults.standard.bool(forKey: "DraftHarbour.editor.typewriterMode"), forKey: "DraftHarbour.editor.typewriterMode")
    default:
      break
    }
  }
}

extension Notification.Name {
  static let draftHarbourShowQuickSwitcher = Notification.Name("DraftHarbourShowQuickSwitcher")
  static let draftHarbourShowFindReplace = Notification.Name("DraftHarbourShowFindReplace")
  static let draftHarbourRunCommand = Notification.Name("DraftHarbourRunCommand")
}
