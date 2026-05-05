import AppKit
import SwiftUI

struct DraftEditorView: NSViewRepresentable {
  @Binding var text: String
  @Binding var selectedRange: NSRange
  var screenplayMode: Bool
  var typewriterMode: Bool
  var fontSize: Double

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
    applyStyle(to: textView)
  }

  private func applyStyle(to textView: NSTextView) {
    let font: NSFont
    if screenplayMode {
      font = NSFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
    } else {
      font = NSFont.systemFont(ofSize: fontSize)
    }
    textView.font = font
    textView.textColor = .labelColor
    textView.backgroundColor = .textBackgroundColor
    textView.insertionPointColor = .controlAccentColor
    textView.usesFindPanel = true
    textView.usesRuler = false
    textView.typingAttributes = [
      .font: font,
      .foregroundColor: NSColor.labelColor
    ]

    if typewriterMode {
      textView.textContainerInset = NSSize(width: 80, height: 120)
    } else {
      textView.textContainerInset = NSSize(width: 44, height: 36)
    }
  }

  final class Coordinator: NSObject, NSTextViewDelegate {
    var parent: DraftEditorView

    init(_ parent: DraftEditorView) {
      self.parent = parent
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
