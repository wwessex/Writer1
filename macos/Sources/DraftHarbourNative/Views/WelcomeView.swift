import AppKit
import DraftHarbourNativeCore
import SwiftUI

struct WelcomeView: View {
  let refreshRecentProjects: @MainActor () -> [WelcomeRecentProject]
  let createProject: @MainActor (WelcomeProjectConfiguration) -> Void
  let openProjectPanel: @MainActor () -> Void
  let openRecentProject: @MainActor (URL) -> Void

  @State private var recentProjects: [WelcomeRecentProject]
  @State private var showingProjectSetup: Bool
  @State private var pendingProjectConfiguration: WelcomeProjectConfiguration?

  init(
    recentProjects: [WelcomeRecentProject],
    showingProjectSetup: Bool = false,
    refreshRecentProjects: @escaping @MainActor () -> [WelcomeRecentProject],
    createProject: @escaping @MainActor (WelcomeProjectConfiguration) -> Void,
    openProjectPanel: @escaping @MainActor () -> Void,
    openRecentProject: @escaping @MainActor (URL) -> Void
  ) {
    self.refreshRecentProjects = refreshRecentProjects
    self.createProject = createProject
    self.openProjectPanel = openProjectPanel
    self.openRecentProject = openRecentProject
    self._recentProjects = State(initialValue: recentProjects)
    self._showingProjectSetup = State(initialValue: showingProjectSetup)
  }

  var body: some View {
    HStack(spacing: 0) {
      actionColumn
        .frame(width: 246)
        .background(.thinMaterial)

      Divider()

      recentColumn
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .frame(width: 760, height: 500)
    .onAppear {
      recentProjects = refreshRecentProjects()
    }
    .sheet(isPresented: $showingProjectSetup) {
      WelcomeProjectSetupView(
        continueAction: { configuration in
          pendingProjectConfiguration = configuration
          showingProjectSetup = false
        },
        cancelAction: {
          showingProjectSetup = false
        }
      )
    }
    .onChange(of: showingProjectSetup) { _, isShowing in
      guard !isShowing, let configuration = pendingProjectConfiguration else { return }
      pendingProjectConfiguration = nil
      Task { @MainActor in
        try? await Task.sleep(nanoseconds: 150_000_000)
        createProject(configuration)
      }
    }
  }

  private var actionColumn: some View {
    VStack(alignment: .leading, spacing: 24) {
      VStack(alignment: .leading, spacing: 10) {
        Image(nsImage: NSApp.applicationIconImage)
          .resizable()
          .frame(width: 64, height: 64)
          .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

        VStack(alignment: .leading, spacing: 3) {
          Text("DraftHarbour")
            .font(.title.bold())
            .lineLimit(1)

          Text("Studio")
            .font(.headline)
            .foregroundStyle(.secondary)
        }
      }

      VStack(spacing: 10) {
        Button {
          showingProjectSetup = true
        } label: {
          Label("New Project...", systemImage: "doc.badge.plus")
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .controlSize(.large)
        .buttonStyle(.borderedProminent)

        Button {
          openProjectPanel()
        } label: {
          Label("Open Project...", systemImage: "folder")
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .controlSize(.large)
      }

      Spacer()
    }
    .padding(24)
  }

  private var recentColumn: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        Text("Recent Projects")
          .font(.title3.bold())
        Spacer()
        Button {
          recentProjects = refreshRecentProjects()
        } label: {
          Label("Refresh", systemImage: "arrow.clockwise")
            .labelStyle(.iconOnly)
        }
        .buttonStyle(.borderless)
      }

      if recentProjects.isEmpty {
        ContentUnavailableView(
          "No Recent Projects",
          systemImage: "clock",
          description: Text("Open or create a project to add it here.")
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        List(recentProjects) { project in
          Button {
            openRecentProject(project.url)
          } label: {
            HStack(spacing: 12) {
              Image(systemName: "doc.text")
                .foregroundStyle(.secondary)
                .frame(width: 18)

              VStack(alignment: .leading, spacing: 2) {
                Text(project.title)
                  .lineLimit(1)
                  .foregroundStyle(.primary)

                Text(project.location)
                  .font(.caption)
                  .lineLimit(1)
                  .foregroundStyle(.secondary)
              }
            }
            .padding(.vertical, 6)
          }
          .buttonStyle(.plain)
        }
        .listStyle(.inset)
      }
    }
    .padding(24)
  }
}

struct WelcomeProjectSetupView: View {
  let continueAction: @MainActor (WelcomeProjectConfiguration) -> Void
  let cancelAction: @MainActor () -> Void

  @State private var title = ""
  @State private var projectType: ProjectType = .book

  private var trimmedTitle: String {
    title.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      Text("New Project")
        .font(.title2.bold())

      VStack(alignment: .leading, spacing: 14) {
        TextField("Project Title", text: $title)
          .textFieldStyle(.roundedBorder)

        Picker("Type", selection: $projectType) {
          ForEach(ProjectType.allCases, id: \.self) { type in
            Text(type.welcomeTitle).tag(type)
          }
        }
        .pickerStyle(.segmented)
      }

      HStack {
        Spacer()

        Button("Cancel") {
          cancelAction()
        }
        .keyboardShortcut(.cancelAction)

        Button("Choose Location...") {
          continueAction(WelcomeProjectConfiguration(title: trimmedTitle, projectType: projectType))
        }
        .keyboardShortcut(.defaultAction)
        .disabled(trimmedTitle.isEmpty)
      }
    }
    .padding(24)
    .frame(width: 420)
  }
}

private extension ProjectType {
  var welcomeTitle: String {
    switch self {
    case .book: "Book"
    case .screenplay: "Screenplay"
    }
  }
}
