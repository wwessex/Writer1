import AppKit
import DraftHarbourNativeCore
import SwiftUI

struct EditorWorkspaceView: View {
  @Bindable var store: ProjectStore
  @Binding var selectedRange: NSRange
  @Binding var showingFindReplace: Bool
  var addComment: () -> Void = {}
  var createSnapshot: () -> Void = {}
  var reviseSelection: () -> Void = {}
  var translateSelection: () -> Void = {}
  var shareSelection: () -> Void = {}
  var copyMarkdown: () -> Void = {}
  @AppStorage("DraftHarbour.editor.fontSize") private var fontSize = 15.0
  @AppStorage("DraftHarbour.editor.fontFamily") private var fontFamily = "System"
  @AppStorage("DraftHarbour.editor.lineHeight") private var lineHeight = 1.5
  @AppStorage("DraftHarbour.editor.pageView") private var pageView = false
  @AppStorage("DraftHarbour.editor.typewriterMode") private var typewriterMode = false
  @State private var screenplayMode = false

  var body: some View {
    VStack(spacing: 0) {
      if showingFindReplace {
        FindReplaceBar(store: store, isPresented: $showingFindReplace, selectedRange: $selectedRange)
        Divider()
      }
      if let section = store.activeSection {
        header(section: section)
        Divider()
        HStack(spacing: 0) {
          if pageView {
            Spacer(minLength: 24)
          }
          DraftEditorView(
            text: Binding(get: {
              store.activeSection?.content ?? ""
            }, set: { value in
              store.updateActiveSectionContent(value)
            }),
            selectedRange: $selectedRange,
            screenplayMode: screenplayMode || store.projectType == .screenplay,
            typewriterMode: typewriterMode,
            fontSize: fontSize,
            fontFamily: fontFamily,
            lineHeight: lineHeight,
            addComment: addComment,
            createSnapshot: createSnapshot,
            reviseSelection: reviseSelection,
            translateSelection: translateSelection,
            shareSelection: shareSelection,
            copyMarkdown: copyMarkdown
          )
          .frame(maxWidth: pageView ? 820 : .infinity)
          if pageView {
            Spacer(minLength: 24)
          }
        }
        .background(pageView ? AnyShapeStyle(.quaternary) : AnyShapeStyle(.clear))
      } else {
        ContentUnavailableView("No Section Selected", systemImage: "doc.text.magnifyingglass")
      }
    }
    .onAppear {
      screenplayMode = store.projectType == .screenplay
    }
  }

  private func header(section: DraftHarbourNativeCore.Section) -> some View {
    HStack(spacing: 12) {
      TextField("Section Title", text: Binding(get: {
        section.title
      }, set: { title in
        store.updateActiveSectionTitle(title)
      }))
      .textFieldStyle(.plain)
      .font(.system(size: 22, weight: .semibold))

      Text("\(MarkdownTools.wordCount(section.content ?? "")) words")
        .font(.caption)
        .foregroundStyle(.secondary)

      Spacer()

      formattingButton("bold", command: .bold)
      formattingButton("italic", command: .italic)
      formattingButton("underline", command: .underline)
      formattingButton("quote.bubble", command: .blockquote)

      Picker("Status", selection: Binding(get: {
        section.status
      }, set: { status in
        store.updateActiveSectionStatus(status)
      })) {
        ForEach(ChapterStatus.allCases, id: \.self) { status in
          Text(status.rawValue.capitalized).tag(status)
        }
      }
      .frame(width: 130)

      Toggle("Page", isOn: $pageView)
        .toggleStyle(.button)
        .help("Toggle page view")

      Toggle("Typewriter", isOn: $typewriterMode)
        .toggleStyle(.button)
        .help("Toggle typewriter mode")

      if store.projectType == .screenplay {
        Toggle("Screenplay", isOn: $screenplayMode)
          .toggleStyle(.button)
          .help("Use screenplay editor styling")
      }
    }
    .padding(16)
  }

  private func formattingButton(_ image: String, command: MarkdownTextCommand) -> some View {
    Button {
      store.applyMarkdownCommand(command, range: selectedRange)
    } label: {
      Image(systemName: image)
    }
    .buttonStyle(.borderless)
  }
}
