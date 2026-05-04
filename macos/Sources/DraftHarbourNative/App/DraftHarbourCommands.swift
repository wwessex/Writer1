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
        NSApp.sendAction(Selector(("toggleBoldface:")), to: nil, from: nil)
      }
      .keyboardShortcut("b", modifiers: .command)

      Button("Italic") {
        NSApp.sendAction(Selector(("toggleItalics:")), to: nil, from: nil)
      }
      .keyboardShortcut("i", modifiers: .command)

      Button("Underline") {
        NSApp.sendAction(Selector(("toggleUnderline:")), to: nil, from: nil)
      }
      .keyboardShortcut("u", modifiers: .command)
    }
  }
}
