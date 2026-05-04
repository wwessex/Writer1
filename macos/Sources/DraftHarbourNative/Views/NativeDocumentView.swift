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
      EditorWorkspaceView(store: store, selectedRange: $selectedRange)
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
    .alert("Export Failed", isPresented: Binding(get: { exportError != nil }, set: { if !$0 { exportError = nil } })) {
      Button("OK", role: .cancel) {}
    } message: {
      Text(exportError ?? "")
    }
    .onChange(of: store.revision) { _, _ in
      document.envelope = store.envelope
    }
  }

  private func export(format: ExportFormat) {
    do {
      let exported = try ExporterRegistry.exporter(for: format).export(store.envelope)
      let panel = NSSavePanel()
      panel.nameFieldStringValue = exported.filename
      panel.canCreateDirectories = true
      panel.begin { response in
        guard response == .OK, let url = panel.url else { return }
        do {
          try exported.data.write(to: url, options: .atomic)
        } catch {
          exportError = error.localizedDescription
        }
      }
    } catch {
      exportError = error.localizedDescription
    }
  }
}
