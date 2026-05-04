import AppKit
import DraftHarbourNativeCore
import SwiftUI

@main
struct DraftHarbourNativeApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

  var body: some SwiftUI.Scene {
    DocumentGroup(newDocument: DraftHarbourDocument()) { file in
      NativeDocumentView(document: file.$document)
    }
    .commands {
      DraftHarbourCommands()
    }

    Settings {
      SettingsView()
    }
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
  }
}
