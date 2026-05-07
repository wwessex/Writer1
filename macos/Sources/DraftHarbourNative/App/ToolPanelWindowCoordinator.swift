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
    exportAction: @escaping (ExportFormat) -> Void,
    runCommand: @escaping (NativeCommandID) -> Void
  ) {
    let content = ToolPanelView(
      panel: selectedPanel,
      store: store,
      exportAction: exportAction,
      runCommand: runCommand,
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
      contentRect: NSRect(x: 0, y: 0, width: 900, height: 680),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .utilityWindow],
      backing: .buffered,
      defer: false
    )
    panel.title = selectedPanel.title
    panel.contentViewController = hostingController
    panel.isReleasedWhenClosed = false
    panel.delegate = self
    panel.collectionBehavior = [.fullScreenAuxiliary]
    panel.center()

    self.hostingController = hostingController
    self.panel = panel

    if let owner = NSApp.keyWindow, owner !== panel {
      owner.addChildWindow(panel, ordered: .above)
    }

    panel.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func close() {
    panel?.close()
  }

  func windowWillClose(_ notification: Notification) {
    guard notification.object as? NSPanel === panel else { return }
    if let panel, let parent = panel.parent {
      parent.removeChildWindow(panel)
    }
    hostingController = nil
    panel = nil
  }
}
