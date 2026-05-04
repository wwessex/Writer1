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
    CommandGroup(after: .newItem) {
      Button(store?.projectType == .screenplay ? "New Scene" : "New Chapter") {
        _ = store?.createSection(after: store?.activeSectionID)
      }
      .keyboardShortcut("n", modifiers: [.command, .shift])
      .disabled(store == nil)
    }

    CommandMenu("Project") {
      Button("Quick Switcher") {
        NotificationCenter.default.post(name: .draftHarbourShowQuickSwitcher, object: nil)
      }
      .keyboardShortcut("k", modifiers: .command)

      Button("Find And Replace") {
        NotificationCenter.default.post(name: .draftHarbourShowFindReplace, object: nil)
      }
      .keyboardShortcut("f", modifiers: .command)

      Divider()

      Button("Create Snapshot") {
        _ = try? store?.createSnapshot(label: "Manual")
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
  }

  private func post(_ command: NativeCommandID) {
    NotificationCenter.default.post(name: .draftHarbourRunCommand, object: command.rawValue)
  }
}
