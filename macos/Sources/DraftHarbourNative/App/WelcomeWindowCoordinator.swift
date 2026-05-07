import AppKit
import DraftHarbourNativeCore
import SwiftUI
import UniformTypeIdentifiers

struct WelcomeRecentProject: Identifiable, Equatable {
  let url: URL
  let projectID: String?
  let projectTitle: String?

  var id: String { url.standardizedFileURL.path }
  var title: String { projectTitle?.isEmpty == false ? projectTitle ?? url.deletingPathExtension().lastPathComponent : url.deletingPathExtension().lastPathComponent }
  var location: String { (url.deletingLastPathComponent().path as NSString).abbreviatingWithTildeInPath }
  var canCopyProjectLink: Bool { projectID?.isEmpty == false }
}

struct WelcomeProjectConfiguration: Equatable {
  var title: String
  var projectType: ProjectType
  var genre: String
  var targetWordCount: Int
  var dailyWordTarget: Int
  var deadline: String
  var structure: StoryStructurePreference
}

@MainActor
final class WelcomeWindowCoordinator: NSObject, NSWindowDelegate {
  private let recoveryService: SessionRecoveryService
  private let fileManager: FileManager
  private var window: NSWindow?
  private var hostingController: NSHostingController<WelcomeView>?

  init(recoveryService: SessionRecoveryService = SessionRecoveryService(), fileManager: FileManager = .default) {
    self.recoveryService = recoveryService
    self.fileManager = fileManager
    super.init()
  }

  func show(showingProjectSetup: Bool = false) {
    if let window {
      hostingController?.rootView = makeWelcomeView(showingProjectSetup: showingProjectSetup)
      window.makeKeyAndOrderFront(nil)
      NSApp.activate(ignoringOtherApps: true)
      return
    }

    let hostingController = NSHostingController(rootView: makeWelcomeView(showingProjectSetup: showingProjectSetup))
    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 760, height: 500),
      styleMask: [.titled, .closable, .miniaturizable],
      backing: .buffered,
      defer: false
    )
    window.title = "Welcome to DraftHarbour"
    window.contentViewController = hostingController
    window.isReleasedWhenClosed = false
    window.delegate = self
    window.center()

    self.hostingController = hostingController
    self.window = window
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func showProjectSetup() {
    show(showingProjectSetup: true)
  }

  func openProjectPanel() {
    prepareForPanelPresentation()

    let panel = NSOpenPanel()
    panel.title = "Open DraftHarbour Project"
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.allowsMultipleSelection = false
    panel.allowedContentTypes = [.dhproj]

    begin(panel) { [weak self] response in
      guard response == .OK, let url = panel.url else { return }
      self?.openProject(at: url)
    }
  }

  func createProject(_ configuration: WelcomeProjectConfiguration) {
    prepareForPanelPresentation()

    let panel = NSSavePanel()
    panel.title = "Save DraftHarbour Project"
    panel.canCreateDirectories = true
    panel.allowedContentTypes = [.dhproj]
    panel.nameFieldStringValue = defaultFilename(for: configuration.title)

    begin(panel) { [weak self] response in
      guard let self, response == .OK, let url = panel.url else { return }

      do {
        var envelope = DhprojCodec.newProject(title: configuration.title, projectType: configuration.projectType)
        envelope.storyBlueprint = StoryBlueprint(
          genre: configuration.genre,
          structure: configuration.structure,
          targetWordCount: max(0, configuration.targetWordCount)
        )
        envelope.settings.dailyWordGoal = configuration.dailyWordTarget > 0 ? configuration.dailyWordTarget : nil
        envelope.settings.novelWordGoal = configuration.targetWordCount > 0 ? configuration.targetWordCount : nil
        envelope.settings.novelDeadline = configuration.deadline.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : configuration.deadline
        envelope.settings.goalConfiguration = GoalConfiguration(
          dailyWordTarget: configuration.dailyWordTarget > 0 ? configuration.dailyWordTarget : nil,
          draftCompletionDeadline: configuration.deadline.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : configuration.deadline
        )
        let data = try DhprojCodec.encode(envelope)
        try data.write(to: url, options: .atomic)
        self.openProject(at: url)
      } catch {
        self.presentError(error.localizedDescription)
      }
    }
  }

  func openProject(at url: URL) {
    NSDocumentController.shared.openDocument(withContentsOf: url, display: true) { [weak self] _, _, error in
      guard let self else { return }
      if let error {
        self.presentError(error.localizedDescription)
        self.refresh()
        return
      }

      self.recoveryService.recordLastOpenedProjectURL(url)
      NSDocumentController.shared.noteNewRecentDocumentURL(url)
      self.close()
    }
  }

  func windowWillClose(_ notification: Notification) {
    guard notification.object as? NSWindow === window else { return }
    hostingController = nil
    window = nil
  }

  private func makeWelcomeView(showingProjectSetup: Bool) -> WelcomeView {
    WelcomeView(
      recentProjects: recentProjects(),
      showingProjectSetup: showingProjectSetup,
      refreshRecentProjects: { [weak self] in self?.recentProjects() ?? [] },
      createProject: { [weak self] configuration in self?.createProject(configuration) },
      openProjectPanel: { [weak self] in self?.openProjectPanel() },
      openRecentProject: { [weak self] url in self?.openProject(at: url) },
      revealRecentProject: { [weak self] url in self?.revealProject(at: url) },
      copyRecentProjectPath: { [weak self] url in self?.copyProjectPath(url) },
      copyRecentProjectLink: { [weak self] projectID in self?.copyProjectLink(projectID: projectID) },
      removeRecentProject: { [weak self] url in self?.removeRecentProject(url) }
    )
  }

  private func refresh() {
    hostingController?.rootView = makeWelcomeView(showingProjectSetup: false)
  }

  private func close() {
    window?.close()
  }

  private func prepareForPanelPresentation() {
    if let window {
      window.makeKeyAndOrderFront(nil)
      NSApp.activate(ignoringOtherApps: true)
    } else {
      show()
    }
  }

  private func begin(_ panel: NSSavePanel, completion: @escaping (NSApplication.ModalResponse) -> Void) {
    if let window {
      panel.beginSheetModal(for: window, completionHandler: completion)
    } else {
      panel.begin(completionHandler: completion)
    }
  }

  private func recentProjects() -> [WelcomeRecentProject] {
    recoveryService.pruneMissingRecentProjectURLs()
      .map { url in
        let envelope = envelope(at: url)
        return WelcomeRecentProject(url: url, projectID: envelope?.project.id, projectTitle: envelope?.project.title)
      }
  }

  private func envelope(at url: URL) -> DhprojEnvelope? {
    guard let data = try? Data(contentsOf: url) else { return nil }
    return try? DhprojCodec.decode(data)
  }

  private func revealProject(at url: URL) {
    NSWorkspace.shared.activateFileViewerSelecting([url])
  }

  private func copyProjectPath(_ url: URL) {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(url.path, forType: .string)
  }

  private func copyProjectLink(projectID: String) {
    guard let url = NativeDeepLink(projectID: projectID).url else { return }
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(url.absoluteString, forType: .string)
  }

  private func removeRecentProject(_ url: URL) {
    recoveryService.removeRecentProjectURL(url)
  }

  private func defaultFilename(for title: String) -> String {
    let invalidCharacters = CharacterSet(charactersIn: "/:\\")
      .union(.newlines)
      .union(.controlCharacters)
    let sanitized = title
      .components(separatedBy: invalidCharacters)
      .joined(separator: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    return "\(sanitized.isEmpty ? "Untitled Project" : sanitized).dhproj"
  }

  private func presentError(_ message: String) {
    let alert = NSAlert()
    alert.messageText = "DraftHarbour"
    alert.informativeText = message
    alert.alertStyle = .warning

    if let window {
      alert.beginSheetModal(for: window)
    } else {
      alert.runModal()
    }
  }
}
