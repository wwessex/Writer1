import AppKit
import DraftHarbourNativeCore
import SwiftUI

private struct ProjectStoreFocusedKey: FocusedValueKey {
  typealias Value = ProjectStore
}

extension FocusedValues {
  var projectStore: ProjectStore? {
    get { self[ProjectStoreFocusedKey.self] }
    set { self[ProjectStoreFocusedKey.self] = newValue }
  }
}

struct DraftHarbourCommands: Commands {
  @FocusedValue(\.projectStore) private var store

  var body: some Commands {
    CommandGroup(replacing: .newItem) {
      Button("New Project...") {
        NotificationCenter.default.post(name: .draftHarbourShowNewProjectSetup, object: nil)
      }
      .keyboardShortcut("n", modifiers: .command)

      Divider()

      Button(store?.projectType == .screenplay ? "New Scene" : "New Chapter") {
        post(.newSection)
      }
      .keyboardShortcut("n", modifiers: [.command, .shift])
      .disabled(store == nil)
    }

    CommandGroup(after: .newItem) {
      Button("Open Project...") {
        NotificationCenter.default.post(name: .draftHarbourOpenProjectFile, object: nil)
      }
      .keyboardShortcut("o", modifiers: .command)

      Button("Open Recent Projects") {
        post(.openRecent)
      }

      Button("Reopen Last Project") {
        post(.reopenLastProject)
      }

      Divider()

      Button("Save Project") {
        post(.saveProjectFile)
      }
      .keyboardShortcut("s", modifiers: .command)
      .disabled(store == nil)

      Button("Save Project Copy...") {
        post(.saveProjectCopy)
      }
      .keyboardShortcut("s", modifiers: [.command, .shift])
      .disabled(store == nil)

      Divider()

      Button("Import Document...") {
        post(.importDocument)
      }
      .disabled(store == nil)

      Button("Export...") {
        post(.export)
      }
      .keyboardShortcut("e", modifiers: [.command, .shift])
      .disabled(store == nil)

      Button("Export Backup...") {
        post(.exportBackup)
      }
      .disabled(store == nil)

      Button("Import Backup...") {
        post(.importBackup)
      }
      .disabled(store == nil)
    }

    CommandMenu("Project") {
      Button("Project Dashboard") {
        post(.dashboard)
      }
      .disabled(store == nil)

      Button("Quick Switcher") {
        post(.quickSwitcher)
      }
      .keyboardShortcut("k", modifiers: .command)
      .disabled(store == nil)

      Button("Find And Replace") {
        post(.findReplace)
      }
      .keyboardShortcut("f", modifiers: .command)
      .disabled(store == nil)

      Divider()

      Button("Create Snapshot") {
        post(.snapshots)
      }
      .keyboardShortcut("s", modifiers: [.command, .option])
      .disabled(store?.activeSection == nil)

      Button("Delete Section") {
        try? store?.deleteActiveSection()
      }
      .keyboardShortcut(.delete, modifiers: [.command])
      .disabled(store?.activeSection == nil || (store?.envelope.sections.count ?? 0) <= 1)

      Divider()

      Button("Add Character") {
        store?.addCharacter(name: "New Character")
      }
      .disabled(store == nil)

      Button("Add World Entry") {
        store?.addWorldEntry(name: "New Entry")
      }
      .disabled(store == nil)
    }

    CommandMenu("View") {
      Button("Write Workspace") {
        post(.workspaceWrite)
      }
      .keyboardShortcut("1", modifiers: [.command, .shift])
      .disabled(store == nil)

      Button("Corkboard Workspace") {
        post(.workspaceCorkboard)
      }
      .keyboardShortcut("2", modifiers: [.command, .shift])
      .disabled(store == nil)

      Button("Review Workspace") {
        post(.workspaceReview)
      }
      .keyboardShortcut("3", modifiers: [.command, .shift])
      .disabled(store == nil)

      Divider()

      Button("Toggle Sidebar") {
        post(.toggleSidebar)
      }
      .keyboardShortcut("b", modifiers: [.command, .shift])
      .disabled(store == nil)

      Button("Toggle Inspector") {
        post(.inspector)
      }
      .keyboardShortcut("i", modifiers: [.command, .shift])
      .disabled(store == nil)

      Button("Toggle Page View") {
        post(.togglePageView)
      }
      .disabled(store == nil)

      Button("Focus Mode") {
        post(.toggleFocusMode)
      }
      .keyboardShortcut("f", modifiers: [.command, .shift])
      .disabled(store == nil)

      Button("Typewriter Mode") {
        post(.toggleTypewriterMode)
      }
      .keyboardShortcut("t", modifiers: [.command, .shift])
      .disabled(store == nil)

      Divider()

      Button("Auto Appearance") {
        post(.themeAuto)
      }

      Button("Light Appearance") {
        post(.themeLight)
      }

      Button("Dark Appearance") {
        post(.themeDark)
      }
    }

    CommandMenu("Insert") {
      Button("Comment") {
        post(.addComment)
      }
      .keyboardShortcut("m", modifiers: [.command, .shift])
      .disabled(store?.activeSection == nil)

      Button("Scene Template") {
        post(.sceneTemplates)
      }
      .disabled(store?.activeSection == nil)

      Divider()

      Button("Blockquote") {
        post(.insertBlockquote)
      }
      .keyboardShortcut(">", modifiers: [.command, .option])
      .disabled(store?.activeSection == nil)

      Button("Horizontal Rule") {
        post(.insertHorizontalRule)
      }
      .disabled(store?.activeSection == nil)
    }

    CommandMenu("Format") {
      Button("Bold") {
        post(.formatBold)
      }
      .keyboardShortcut("b", modifiers: .command)

      Button("Italic") {
        post(.formatItalic)
      }
      .keyboardShortcut("i", modifiers: .command)

      Button("Underline") {
        post(.formatUnderline)
      }
      .keyboardShortcut("u", modifiers: .command)

      Divider()

      Button("Heading 1") {
        post(.formatHeading1)
      }
      .keyboardShortcut("1", modifiers: [.command, .option])

      Button("Heading 2") {
        post(.formatHeading2)
      }
      .keyboardShortcut("2", modifiers: [.command, .option])

      Button("Blockquote") {
        post(.insertBlockquote)
      }
      .keyboardShortcut(">", modifiers: [.command, .option])

      Button("Horizontal Rule") {
        post(.insertHorizontalRule)
      }
    }

    CommandMenu("Tools") {
      Button("Snapshots") {
        post(.snapshots)
      }
      .disabled(store == nil)

      Button("Word Count") {
        post(.wordCount)
      }
      .disabled(store == nil)

      Button("Writing Analysis") {
        post(.analysis)
      }
      .disabled(store == nil)

      Button("Advanced Analytics") {
        post(.advancedAnalytics)
      }
      .disabled(store == nil)

      Divider()

      Button("Character And World Bible") {
        post(.characterBible)
      }
      .disabled(store == nil)

      Button("Story Cards And Corkboard") {
        post(.storyCards)
      }
      .disabled(store == nil)

      Button("Comments") {
        post(.comments)
      }
      .disabled(store == nil)

      Divider()

      Button("AI Writing Tools") {
        post(.aiWriting)
      }
      .disabled(store == nil)

      Button("Translate") {
        post(.translation)
      }
      .disabled(store == nil)

      Button("Integrations") {
        post(.integrations)
      }
      .disabled(store == nil)

      Divider()

      Button("Export History") {
        post(.exportHistory)
      }
      .disabled(store == nil)

      Button("Settings") {
        post(.settings)
      }
    }

    CommandGroup(replacing: .help) {
      Button("Getting Started") {
        post(.onboarding)
      }
      .disabled(store == nil)

      Button("About DraftHarbour") {
        post(.about)
      }
    }
  }

  private func post(_ command: NativeCommandID) {
    NotificationCenter.default.post(name: .draftHarbourRunCommand, object: command.rawValue)
  }
}
