import AppKit
import Carbon
import DraftHarbourNativeCore
import SwiftUI

@main
struct DraftHarbourNativeApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

  var body: some SwiftUI.Scene {
    DocumentGroup(newDocument: DraftHarbourDocument()) { file in
      NativeDocumentView(document: file.$document, fileURL: file.fileURL)
        .nativeAppearanceBridge()
    }
    .commands {
      DraftHarbourCommands()
    }

    Settings {
      SettingsView()
        .nativeAppearanceBridge()
    }
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
    NSAppleEventManager.shared().setEventHandler(
      self,
      andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
      forEventClass: AEEventClass(kInternetEventClass),
      andEventID: AEEventID(kAEGetURL)
    )
  }

  func applicationWillTerminate(_ notification: Notification) {
    NSAppleEventManager.shared().removeEventHandler(
      forEventClass: AEEventClass(kInternetEventClass),
      andEventID: AEEventID(kAEGetURL)
    )
  }

  @objc private func handleGetURLEvent(_ event: NSAppleEventDescriptor, withReplyEvent replyEvent: NSAppleEventDescriptor) {
    guard let rawURL = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue,
          let url = URL(string: rawURL) else {
      return
    }

    Task { @MainActor in
      OAuthCallbackCenter.shared.receive(url)
    }
  }
}
