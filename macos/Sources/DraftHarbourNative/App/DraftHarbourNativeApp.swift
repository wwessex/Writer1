import AppKit
import Carbon
import DraftHarbourNativeCore
import SwiftUI

@main
struct DraftHarbourNativeApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

  var body: some SwiftUI.Scene {
    documentScene

    Settings {
      SettingsView()
        .nativeAppearanceBridge()
    }
  }

  @SceneBuilder
  private var documentScene: some SwiftUI.Scene {
    DocumentGroup(newDocument: DraftHarbourDocument()) { file in
      NativeDocumentView(document: file.$document, fileURL: file.fileURL)
        .nativeAppearanceBridge()
    }
    .commands {
      DraftHarbourCommands()
    }
  }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
  private let welcomeCoordinator = WelcomeWindowCoordinator()
  private var handledInitialUntitledRequest = false

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
    scheduleEmptyLaunchWelcomeChecks()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleNewProjectRequest),
      name: .draftHarbourShowNewProjectSetup,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleOpenProjectRequest),
      name: .draftHarbourOpenProjectFile,
      object: nil
    )
    NSAppleEventManager.shared().setEventHandler(
      self,
      andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
      forEventClass: AEEventClass(kInternetEventClass),
      andEventID: AEEventID(kAEGetURL)
    )
  }

  func applicationWillTerminate(_ notification: Notification) {
    NotificationCenter.default.removeObserver(self)
    NSAppleEventManager.shared().removeEventHandler(
      forEventClass: AEEventClass(kInternetEventClass),
      andEventID: AEEventID(kAEGetURL)
    )
  }

  func applicationShouldOpenUntitledFile(_ sender: NSApplication) -> Bool {
    !handledInitialUntitledRequest
  }

  func applicationOpenUntitledFile(_ sender: NSApplication) -> Bool {
    guard !handledInitialUntitledRequest else { return false }
    handledInitialUntitledRequest = true
    welcomeCoordinator.show()
    return true
  }

  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    if flag || !NSDocumentController.shared.documents.isEmpty {
      return true
    }
    return false
  }

  @objc private func handleNewProjectRequest() {
    welcomeCoordinator.showProjectSetup()
  }

  @objc private func handleOpenProjectRequest() {
    welcomeCoordinator.openProjectPanel()
  }

  private func scheduleEmptyLaunchWelcomeChecks() {
    for delay in [250_000_000, 750_000_000] as [UInt64] {
      Task { @MainActor in
        try? await Task.sleep(nanoseconds: delay)
        replaceEmptyLaunchDocumentPromptIfNeeded()
      }
    }
  }

  private func replaceEmptyLaunchDocumentPromptIfNeeded() {
    guard NSDocumentController.shared.documents.isEmpty else { return }
    closeInitialOpenPanels()

    guard !handledInitialUntitledRequest else { return }
    handledInitialUntitledRequest = true
    welcomeCoordinator.show()
  }

  private func closeInitialOpenPanels() {
    for window in NSApp.windows where window is NSPanel && isDocumentOpenPanel(window) {
      window.close()
    }
  }

  private func isDocumentOpenPanel(_ window: NSWindow) -> Bool {
    let className = String(describing: type(of: window))
    return window.title == "Open" || className.localizedCaseInsensitiveContains("OpenPanel")
  }

  @objc private func handleGetURLEvent(_ event: NSAppleEventDescriptor, withReplyEvent replyEvent: NSAppleEventDescriptor) {
    guard let rawURL = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue,
          let url = URL(string: rawURL) else {
      return
    }

    if let deepLink = NativeDeepLink.parse(url) {
      route(deepLink)
      return
    }

    Task { @MainActor in
      OAuthCallbackCenter.shared.receive(url)
    }
  }

  private func route(_ deepLink: NativeDeepLink) {
    NotificationCenter.default.post(name: .draftHarbourOpenDeepLink, object: deepLink)

    guard let url = recentProjectURL(for: deepLink.projectID) else { return }
    NSDocumentController.shared.openDocument(withContentsOf: url, display: true) { _, _, _ in
      NotificationCenter.default.post(name: .draftHarbourOpenDeepLink, object: deepLink)
    }
  }

  private func recentProjectURL(for projectID: String) -> URL? {
    let recoveryService = SessionRecoveryService()
    return recoveryService.recentProjectURLs()
      .filter { FileManager.default.fileExists(atPath: $0.path) }
      .first { url in
        guard let data = try? Data(contentsOf: url),
              let envelope = try? DhprojCodec.decode(data) else {
          return false
        }
        return envelope.project.id == projectID
      }
  }
}
