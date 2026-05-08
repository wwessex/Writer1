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

final class NativeDocumentCommandRequest {
  let command: NativeCommandID
  let target: ProjectStore

  init(command: NativeCommandID, target: ProjectStore) {
    self.command = command
    self.target = target
  }
}

struct DraftHarbourCommands: Commands {
  @FocusedValue(\.projectStore) private var store
  @Environment(\.openSettings) private var openSettings

  var body: some Commands {
    CommandGroup(replacing: .newItem) {
      Button("New Project...") {
        NotificationCenter.default.post(name: .draftHarbourShowNewProjectSetup, object: nil)
      }
      .keyboardShortcut("n", modifiers: .command)

      Divider()

      Button(store?.projectType == .screenplay ? "New Scene" : "New Chapter") {
        perform(.newSection)
      }
      .keyboardShortcut("n", modifiers: [.command, .shift])
      .disabled(!canPerform(.newSection))
    }

    CommandGroup(after: .newItem) {
      Button("Open Project...") {
        NotificationCenter.default.post(name: .draftHarbourOpenProjectFile, object: nil)
      }
      .keyboardShortcut("o", modifiers: .command)

      Button("Welcome") {
        perform(.welcome)
      }
      .keyboardShortcut("0", modifiers: [.command, .shift])

      Button("Reopen Last Project") {
        perform(.reopenLastProject)
      }
      .disabled(!canPerform(.reopenLastProject))

      Divider()

      Button("Save Project") {
        perform(.saveProjectFile)
      }
      .keyboardShortcut("s", modifiers: .command)
      .disabled(!canPerform(.saveProjectFile))

      Button("Save Project Copy...") {
        perform(.saveProjectCopy)
      }
      .keyboardShortcut("s", modifiers: [.command, .shift])
      .disabled(!canPerform(.saveProjectCopy))

      Divider()

      Button("Import Document...") {
        perform(.importDocument)
      }
      .disabled(!canPerform(.importDocument))

      Button("Export...") {
        perform(.export)
      }
      .keyboardShortcut("e", modifiers: [.command, .shift])
      .disabled(!canPerform(.export))

      Button("Export Backup...") {
        perform(.exportBackup)
      }
      .disabled(!canPerform(.exportBackup))

      Button("Import Backup...") {
        perform(.importBackup)
      }
      .disabled(!canPerform(.importBackup))

      Divider()

      Button("Reveal Project in Finder") {
        perform(.revealProjectInFinder)
      }
      .disabled(!canPerform(.revealProjectInFinder))

      Button("Copy Project Path") {
        perform(.copyProjectPath)
      }
      .disabled(!canPerform(.copyProjectPath))

      Button("Copy Project Link") {
        perform(.copyProjectLink)
      }
      .disabled(!canPerform(.copyProjectLink))

      Button("Copy Section Link") {
        perform(.copySectionLink)
      }
      .disabled(!canPerform(.copySectionLink))

      Button("Share Active Section") {
        perform(.shareActiveSection)
      }
      .disabled(!canPerform(.shareActiveSection))

      Divider()

      Button("Print Active Section") {
        perform(.printActiveSection)
      }
      .keyboardShortcut("p", modifiers: [.command, .shift])
      .disabled(!canPerform(.printActiveSection))

      Button("Print Project") {
        perform(.printProject)
      }
      .keyboardShortcut("p", modifiers: .command)
      .disabled(!canPerform(.printProject))
    }

    CommandMenu("Project") {
      Button("Project Dashboard") {
        perform(.dashboard)
      }
      .disabled(!canPerform(.dashboard))

      Button("Quick Switcher") {
        perform(.quickSwitcher)
      }
      .keyboardShortcut("k", modifiers: .command)
      .disabled(!canPerform(.quickSwitcher))

      Button("Find") {
        perform(.nativeFind)
      }
      .keyboardShortcut("f", modifiers: .command)
      .disabled(!canPerform(.nativeFind))

      Button("Find And Replace In Project") {
        perform(.projectFindReplace)
      }
      .keyboardShortcut("f", modifiers: [.command, .option])
      .disabled(!canPerform(.projectFindReplace))

      Divider()

      Button("Create Snapshot") {
        perform(.snapshots)
      }
      .keyboardShortcut("s", modifiers: [.command, .option])
      .disabled(!canPerform(.snapshots))

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
        perform(.workspaceWrite)
      }
      .keyboardShortcut("1", modifiers: [.command, .shift])
      .disabled(!canPerform(.workspaceWrite))

      Button("Corkboard Workspace") {
        perform(.workspaceCorkboard)
      }
      .keyboardShortcut("2", modifiers: [.command, .shift])
      .disabled(!canPerform(.workspaceCorkboard))

      Button("Review Workspace") {
        perform(.workspaceReview)
      }
      .keyboardShortcut("3", modifiers: [.command, .shift])
      .disabled(!canPerform(.workspaceReview))

      Divider()

      Button("Toggle Sidebar") {
        perform(.toggleSidebar)
      }
      .keyboardShortcut("b", modifiers: [.command, .shift])
      .disabled(!canPerform(.toggleSidebar))

      Button("Toggle Inspector") {
        perform(.inspector)
      }
      .keyboardShortcut("i", modifiers: [.command, .shift])
      .disabled(!canPerform(.inspector))

      Button("Toggle Tool Panel") {
        perform(.toggleToolPanel)
      }
      .disabled(!canPerform(.toggleToolPanel))

      Button("Toggle Page View") {
        perform(.togglePageView)
      }
      .disabled(!canPerform(.togglePageView))

      Button("Focus Mode") {
        perform(.toggleFocusMode)
      }
      .keyboardShortcut("f", modifiers: [.command, .shift])
      .disabled(!canPerform(.toggleFocusMode))

      Button("Typewriter Mode") {
        perform(.toggleTypewriterMode)
      }
      .keyboardShortcut("t", modifiers: [.command, .shift])
      .disabled(!canPerform(.toggleTypewriterMode))

      Divider()

      Button("Auto Appearance") {
        perform(.themeAuto)
      }

      Button("Light Appearance") {
        perform(.themeLight)
      }

      Button("Dark Appearance") {
        perform(.themeDark)
      }
    }

    CommandMenu("Insert") {
      Button("Comment") {
        perform(.addComment)
      }
      .keyboardShortcut("m", modifiers: [.command, .shift])
      .disabled(!canPerform(.addComment))

      Button("Scene Template") {
        perform(.sceneTemplates)
      }
      .disabled(!canPerform(.sceneTemplates))

      Divider()

      Button("Blockquote") {
        perform(.insertBlockquote)
      }
      .keyboardShortcut(">", modifiers: [.command, .option])
      .disabled(!canPerform(.insertBlockquote))

      Button("Horizontal Rule") {
        perform(.insertHorizontalRule)
      }
      .disabled(!canPerform(.insertHorizontalRule))
    }

    CommandMenu("Format") {
      Button("Bold") {
        perform(.formatBold)
      }
      .keyboardShortcut("b", modifiers: .command)

      Button("Italic") {
        perform(.formatItalic)
      }
      .keyboardShortcut("i", modifiers: .command)

      Button("Underline") {
        perform(.formatUnderline)
      }
      .keyboardShortcut("u", modifiers: .command)

      Divider()

      Button("Heading 1") {
        perform(.formatHeading1)
      }
      .keyboardShortcut("1", modifiers: [.command, .option])

      Button("Heading 2") {
        perform(.formatHeading2)
      }
      .keyboardShortcut("2", modifiers: [.command, .option])

      Button("Blockquote") {
        perform(.insertBlockquote)
      }
      .keyboardShortcut(">", modifiers: [.command, .option])

      Button("Horizontal Rule") {
        perform(.insertHorizontalRule)
      }
    }

    CommandMenu("Tools") {
      Button("Snapshots") {
        perform(.snapshots)
      }
      .disabled(!canPerform(.snapshots))

      Button("Word Count") {
        perform(.wordCount)
      }
      .disabled(!canPerform(.wordCount))

      Button("Writing Analysis") {
        perform(.analysis)
      }
      .disabled(!canPerform(.analysis))

      Button("Advanced Analytics") {
        perform(.advancedAnalytics)
      }
      .disabled(!canPerform(.advancedAnalytics))

      Divider()

      Button("Character And World Bible") {
        perform(.characterBible)
      }
      .disabled(!canPerform(.characterBible))

      Button("Story Cards And Corkboard") {
        perform(.storyCards)
      }
      .disabled(!canPerform(.storyCards))

      Button("Comments") {
        perform(.comments)
      }
      .disabled(!canPerform(.comments))

      Divider()

      Button("AI Writing Tools") {
        perform(.aiWriting)
      }
      .disabled(!canPerform(.aiWriting))

      Button("AI Suggestions") {
        perform(.aiSuggestions)
      }
      .disabled(!canPerform(.aiSuggestions))

      Button("Translate") {
        perform(.translation)
      }
      .disabled(!canPerform(.translation))

      Button("Integrations") {
        perform(.integrations)
      }
      .disabled(!canPerform(.integrations))

      Divider()

      Button("Export History") {
        perform(.exportHistory)
      }
      .disabled(!canPerform(.exportHistory))

      Divider()

      Button("Index Project in Spotlight") {
        perform(.indexSpotlight)
      }
      .disabled(!canPerform(.indexSpotlight))

      Button("Clear Project Spotlight Index") {
        perform(.clearSpotlightIndex)
      }
      .disabled(!canPerform(.clearSpotlightIndex))

      Button("Publishing Assistant") {
        perform(.publishingAssistant)
      }
      .disabled(!canPerform(.publishingAssistant))

      Button("Settings") {
        perform(.settings)
      }
    }

    CommandGroup(replacing: .help) {
      Button("Getting Started") {
        perform(.onboarding)
      }
      .disabled(!canPerform(.onboarding))

      Button("About DraftHarbour") {
        perform(.about)
      }
    }

    CommandGroup(after: .textEditing) {
      Divider()

      Menu("Spelling and Grammar") {
        Button("Show Spelling and Grammar") {
          perform(.showSpellingPanel)
        }
        .keyboardShortcut(":", modifiers: .command)

        Button("Check Document Now") {
          perform(.checkSpelling)
        }
        .keyboardShortcut(";", modifiers: .command)

        Divider()

        Button("Check Spelling While Typing") {
          perform(.toggleContinuousSpellChecking)
        }

        Button("Check Grammar With Spelling") {
          perform(.toggleGrammarChecking)
        }

        Button("Correct Spelling Automatically") {
          perform(.toggleAutomaticSpellingCorrection)
        }
      }

      Menu("Substitutions") {
        Button("Show Substitutions") {
          perform(.showSubstitutionsPanel)
        }

        Divider()

        Button("Smart Quotes") {
          perform(.toggleSmartQuotes)
        }

        Button("Smart Dashes") {
          perform(.toggleSmartDashes)
        }

        Button("Text Replacement") {
          perform(.toggleTextReplacement)
        }
      }
    }
  }

  private func canPerform(_ command: NativeCommandID) -> Bool {
    switch command {
    case .openProjectFile, .settings, .about, .welcome, .showSpellingPanel, .checkSpelling, .toggleContinuousSpellChecking, .toggleGrammarChecking, .toggleAutomaticSpellingCorrection, .showSubstitutionsPanel, .toggleSmartQuotes, .toggleSmartDashes, .toggleTextReplacement:
      return true
    default:
      return store != nil
    }
  }

  private func perform(_ command: NativeCommandID) {
    switch command {
    case .openProjectFile:
      NotificationCenter.default.post(name: .draftHarbourOpenProjectFile, object: nil)
    case .welcome:
      NotificationCenter.default.post(name: .draftHarbourShowWelcomeWindow, object: nil)
    case .settings:
      openSettings()
    case .about:
      NSApp.sendAction(#selector(NSApplication.orderFrontStandardAboutPanel(_:)), to: nil, from: nil)
    case .showSpellingPanel:
      sendResponderAction("showGuessPanel:")
    case .checkSpelling:
      sendResponderAction("checkSpelling:")
    case .toggleContinuousSpellChecking:
      sendResponderAction("toggleContinuousSpellChecking:")
    case .toggleGrammarChecking:
      sendResponderAction("toggleGrammarChecking:")
    case .toggleAutomaticSpellingCorrection:
      sendResponderAction("toggleAutomaticSpellingCorrection:")
    case .showSubstitutionsPanel:
      sendResponderAction("orderFrontSubstitutionsPanel:")
    case .toggleSmartQuotes:
      sendResponderAction("toggleAutomaticQuoteSubstitution:")
    case .toggleSmartDashes:
      sendResponderAction("toggleAutomaticDashSubstitution:")
    case .toggleTextReplacement:
      sendResponderAction("toggleAutomaticTextReplacement:")
    default:
      guard let store else { return }
      NotificationCenter.default.post(
        name: .draftHarbourRunCommand,
        object: NativeDocumentCommandRequest(command: command, target: store)
      )
    }
  }

  private func sendResponderAction(_ selector: String) {
    NSApp.sendAction(NSSelectorFromString(selector), to: nil, from: nil)
  }
}
