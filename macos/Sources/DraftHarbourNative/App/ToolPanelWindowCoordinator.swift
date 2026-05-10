import AppKit
import DraftHarbourNativeCore
import SwiftUI

@MainActor
final class ToolPanelWindowCoordinator: NSObject, NSWindowDelegate {
  private var panel: NSPanel?
  private var hostingController: NSHostingController<ToolPanelView>?

  var isOpen: Bool {
    panel != nil
  }

  func show(
    panel selectedPanel: ToolPanel,
    store: ProjectStore,
    exportAction: @escaping (ExportRequest) -> Void,
    runCommand: @escaping (NativeCommandID) -> Void,
    selectionChanged: @escaping (String) -> Void,
    focusEditProposal: @escaping (AIEditProposal) -> Void
  ) {
    let content = ToolPanelView(
      panel: selectedPanel,
      store: store,
      exportAction: exportAction,
      runCommand: runCommand,
      selectionChanged: selectionChanged,
      focusEditProposal: focusEditProposal,
      closeAction: { [weak self] in self?.close() }
    )

    if let panel {
      hostingController?.rootView = content
      panel.title = selectedPanel.title
      panel.makeKeyAndOrderFront(nil)
      NSApp.activate(ignoringOtherApps: true)
      return
    }

    let hostingController = NSHostingController(rootView: content)
    let panel = NSPanel(
      contentRect: NSRect(x: 0, y: 0, width: 1180, height: 760),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .utilityWindow],
      backing: .buffered,
      defer: false
    )
    panel.title = selectedPanel.title
    panel.minSize = NSSize(width: 1120, height: 700)
    panel.contentViewController = hostingController
    panel.isReleasedWhenClosed = false
    panel.delegate = self
    panel.collectionBehavior = [.fullScreenAuxiliary]
    let autosaveName = "DraftHarbour.toolPanel.frame.\(store.envelope.project.id)"
    if !panel.setFrameUsingName(autosaveName) {
      panel.center()
    }
    panel.setFrameAutosaveName(autosaveName)

    self.hostingController = hostingController
    self.panel = panel

    panel.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func close() {
    panel?.close()
  }

  func windowWillClose(_ notification: Notification) {
    guard notification.object as? NSPanel === panel else { return }
    hostingController = nil
    panel = nil
  }
}
