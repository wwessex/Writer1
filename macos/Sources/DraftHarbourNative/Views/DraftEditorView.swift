import AppKit
import SwiftUI

struct DraftEditorView: NSViewRepresentable {
  @Binding var text: String
  @Binding var selectedRange: NSRange
  var screenplayMode: Bool
  var typewriterMode: Bool
  var fontSize: Double
  var fontFamily: String
  var lineHeight: Double
  var addComment: () -> Void = {}
  var createSnapshot: () -> Void = {}
  var reviseSelection: () -> Void = {}
  var translateSelection: () -> Void = {}
  var shareSelection: () -> Void = {}
  var copyMarkdown: () -> Void = {}

  func makeCoordinator() -> Coordinator {
    Coordinator(self)
  }

  func makeNSView(context: Context) -> NSScrollView {
    let scrollView = NSScrollView()
    scrollView.hasVerticalScroller = true
    scrollView.hasHorizontalScroller = false
    scrollView.autohidesScrollers = true
    scrollView.borderType = .noBorder

    let textView = NSTextView()
    textView.delegate = context.coordinator
    textView.isRichText = false
    textView.importsGraphics = false
    textView.allowsUndo = true
    textView.isAutomaticQuoteSubstitutionEnabled = true
    textView.isAutomaticDashSubstitutionEnabled = true
    textView.isAutomaticTextReplacementEnabled = true
    textView.textContainerInset = NSSize(width: 44, height: 36)
    textView.textContainer?.widthTracksTextView = true
    textView.textContainer?.containerSize = NSSize(width: scrollView.contentSize.width, height: CGFloat.greatestFiniteMagnitude)
    textView.minSize = NSSize(width: 0, height: 0)
    textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
    textView.isVerticallyResizable = true
    textView.isHorizontallyResizable = false
    textView.autoresizingMask = [.width]
    textView.string = text
    applyStyle(to: textView)
    textView.menu = context.coordinator.makeContextMenu()

    scrollView.documentView = textView
    return scrollView
  }

  func updateNSView(_ scrollView: NSScrollView, context: Context) {
    guard let textView = scrollView.documentView as? NSTextView else { return }
    context.coordinator.parent = self
    if textView.string != text {
      textView.string = text
    }
    let safeSelection = boundedRange(selectedRange, in: textView.string)
    if textView.selectedRange() != safeSelection {
      textView.setSelectedRange(safeSelection)
      textView.scrollRangeToVisible(safeSelection)
      textView.window?.makeFirstResponder(textView)
    }
    textView.menu = context.coordinator.makeContextMenu()
    applyStyle(to: textView)
  }

  private func applyStyle(to textView: NSTextView) {
    let font = resolvedFont()
    let paragraphStyle = NSMutableParagraphStyle()
    paragraphStyle.lineHeightMultiple = max(1.0, min(2.5, lineHeight))

    textView.font = font
    textView.textColor = .labelColor
    textView.backgroundColor = .textBackgroundColor
    textView.insertionPointColor = .controlAccentColor
    textView.usesFindPanel = true
    textView.usesRuler = false
    textView.defaultParagraphStyle = paragraphStyle
    textView.typingAttributes = [
      .font: font,
      .foregroundColor: NSColor.labelColor,
      .paragraphStyle: paragraphStyle
    ]

    if typewriterMode {
      textView.textContainerInset = NSSize(width: 80, height: 120)
    } else {
      textView.textContainerInset = NSSize(width: 44, height: 36)
    }

    let fullRange = NSRange(location: 0, length: (textView.string as NSString).length)
    if fullRange.length > 0 {
      textView.textStorage?.addAttributes([
        .font: font,
        .foregroundColor: NSColor.labelColor,
        .paragraphStyle: paragraphStyle
      ], range: fullRange)
    }
  }

  private func resolvedFont() -> NSFont {
    let trimmedFamily = fontFamily.trimmingCharacters(in: .whitespacesAndNewlines)
    if !trimmedFamily.isEmpty,
       trimmedFamily.localizedCaseInsensitiveCompare("System") != .orderedSame,
       let namedFont = NSFont(name: trimmedFamily, size: fontSize) {
      return namedFont
    }

    if screenplayMode {
      return NSFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
    }
    return NSFont.systemFont(ofSize: fontSize)
  }

  final class Coordinator: NSObject, NSTextViewDelegate, NSMenuItemValidation {
    var parent: DraftEditorView

    init(_ parent: DraftEditorView) {
      self.parent = parent
    }

    @MainActor func makeContextMenu() -> NSMenu {
      let menu = NSMenu()
      addResponderItem("Look Up", action: NSSelectorFromString("lookupSelection:"), to: menu)
      addServicesSubmenu(to: menu)
      menu.addItem(.separator())
      addResponderItem("Cut", action: #selector(NSText.cut(_:)), to: menu)
      addResponderItem("Copy", action: #selector(NSText.copy(_:)), to: menu)
      addResponderItem("Paste", action: #selector(NSText.paste(_:)), to: menu)
      menu.addItem(.separator())
      addSpellingSubmenu(to: menu)
      addSubstitutionsSubmenu(to: menu)
      addTransformationsSubmenu(to: menu)
      menu.addItem(.separator())
      addItem("Add Comment", action: #selector(addComment(_:)), to: menu)
      addItem("Create Snapshot", action: #selector(createSnapshot(_:)), to: menu)
      menu.addItem(.separator())
      addItem("AI Revise Selection", action: #selector(reviseSelection(_:)), to: menu)
      addItem("Translate Selection", action: #selector(translateSelection(_:)), to: menu)
      menu.addItem(.separator())
      addItem("Share Selection", action: #selector(shareSelection(_:)), to: menu)
      addItem("Copy Markdown", action: #selector(copyMarkdown(_:)), to: menu)
      return menu
    }

    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
      guard let action = menuItem.action else { return true }
      if action == #selector(createSnapshot(_:)) {
        return true
      }
      if action == #selector(addComment(_:)) ||
        action == #selector(reviseSelection(_:)) ||
        action == #selector(translateSelection(_:)) ||
        action == #selector(shareSelection(_:)) ||
        action == #selector(copyMarkdown(_:)) {
        return parent.selectedRange.length > 0
      }
      return true
    }

    private func addResponderItem(_ title: String, action: Selector, to menu: NSMenu) {
      let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
      item.target = nil
      menu.addItem(item)
    }

    @MainActor private func addServicesSubmenu(to menu: NSMenu) {
      let item = NSMenuItem(title: "Services", action: nil, keyEquivalent: "")
      if let servicesMenu = NSApp.servicesMenu?.copy() as? NSMenu {
        item.submenu = servicesMenu
      } else {
        item.isEnabled = false
      }
      menu.addItem(item)
    }

    private func addSpellingSubmenu(to menu: NSMenu) {
      let submenu = NSMenu(title: "Spelling and Grammar")
      addResponderItem("Show Spelling and Grammar", action: NSSelectorFromString("showGuessPanel:"), to: submenu)
      addResponderItem("Check Document Now", action: NSSelectorFromString("checkSpelling:"), to: submenu)
      submenu.addItem(.separator())
      addResponderItem("Check Spelling While Typing", action: NSSelectorFromString("toggleContinuousSpellChecking:"), to: submenu)
      addResponderItem("Check Grammar With Spelling", action: NSSelectorFromString("toggleGrammarChecking:"), to: submenu)
      addResponderItem("Correct Spelling Automatically", action: NSSelectorFromString("toggleAutomaticSpellingCorrection:"), to: submenu)

      let item = NSMenuItem(title: "Spelling and Grammar", action: nil, keyEquivalent: "")
      item.submenu = submenu
      menu.addItem(item)
    }

    private func addSubstitutionsSubmenu(to menu: NSMenu) {
      let submenu = NSMenu(title: "Substitutions")
      addResponderItem("Show Substitutions", action: NSSelectorFromString("orderFrontSubstitutionsPanel:"), to: submenu)
      submenu.addItem(.separator())
      addResponderItem("Smart Quotes", action: NSSelectorFromString("toggleAutomaticQuoteSubstitution:"), to: submenu)
      addResponderItem("Smart Dashes", action: NSSelectorFromString("toggleAutomaticDashSubstitution:"), to: submenu)
      addResponderItem("Text Replacement", action: NSSelectorFromString("toggleAutomaticTextReplacement:"), to: submenu)

      let item = NSMenuItem(title: "Substitutions", action: nil, keyEquivalent: "")
      item.submenu = submenu
      menu.addItem(item)
    }

    private func addTransformationsSubmenu(to menu: NSMenu) {
      let submenu = NSMenu(title: "Transformations")
      addResponderItem("Make Upper Case", action: NSSelectorFromString("uppercaseWord:"), to: submenu)
      addResponderItem("Make Lower Case", action: NSSelectorFromString("lowercaseWord:"), to: submenu)
      addResponderItem("Capitalize", action: NSSelectorFromString("capitalizeWord:"), to: submenu)

      let item = NSMenuItem(title: "Transformations", action: nil, keyEquivalent: "")
      item.submenu = submenu
      menu.addItem(item)
    }

    private func addItem(_ title: String, action: Selector, to menu: NSMenu) {
      let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
      item.target = self
      menu.addItem(item)
    }

    @MainActor
    @objc private func addComment(_ sender: Any?) {
      parent.addComment()
    }

    @MainActor
    @objc private func createSnapshot(_ sender: Any?) {
      parent.createSnapshot()
    }

    @MainActor
    @objc private func reviseSelection(_ sender: Any?) {
      parent.reviseSelection()
    }

    @MainActor
    @objc private func translateSelection(_ sender: Any?) {
      parent.translateSelection()
    }

    @MainActor
    @objc private func shareSelection(_ sender: Any?) {
      parent.shareSelection()
    }

    @MainActor
    @objc private func copyMarkdown(_ sender: Any?) {
      parent.copyMarkdown()
    }

    func textDidChange(_ notification: Notification) {
      guard let textView = notification.object as? NSTextView else { return }
      parent.text = textView.string
    }

    func textViewDidChangeSelection(_ notification: Notification) {
      guard let textView = notification.object as? NSTextView else { return }
      parent.selectedRange = textView.selectedRange()
    }
  }

  private func boundedRange(_ range: NSRange, in text: String) -> NSRange {
    let length = (text as NSString).length
    let location = min(max(0, range.location), length)
    return NSRange(location: location, length: min(max(0, range.length), length - location))
  }
}
