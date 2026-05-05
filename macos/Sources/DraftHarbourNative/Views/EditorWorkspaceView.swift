import AppKit
import DraftHarbourNativeCore
import SwiftUI

struct EditorWorkspaceView: View {
  @Bindable var store: ProjectStore
  @Binding var selectedRange: NSRange
  @Binding var showingFindReplace: Bool
  @AppStorage("DraftHarbour.editor.fontSize") private var fontSize = 15.0
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
        DraftEditorView(
          text: Binding(get: {
            store.activeSection?.content ?? ""
          }, set: { value in
            store.updateActiveSectionContent(value)
          }),
          selectedRange: $selectedRange,
          screenplayMode: screenplayMode || store.projectType == .screenplay,
          typewriterMode: typewriterMode,
          fontSize: fontSize
        )
      } else {
        ContentUnavailableView("No Section Selected", systemImage: "doc.text.magnifyingglass")
      }
    }
    .onAppear {
      screenplayMode = store.projectType == .screenplay
    }
  }

  private func header(section: DraftHarbourNativeCore.Section) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        TextField("Section Title", text: Binding(get: {
          section.title
        }, set: { title in
          store.updateActiveSectionTitle(title)
        }))
        .textFieldStyle(.plain)
        .font(.system(size: 24, weight: .semibold))

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

        Toggle("Typewriter", isOn: $typewriterMode)
          .toggleStyle(.switch)

        if store.projectType == .screenplay {
          Toggle("Screenplay", isOn: $screenplayMode)
            .toggleStyle(.switch)
        }
      }

      TextField("Summary", text: Binding(get: {
        section.summary
      }, set: { summary in
        store.updateActiveSectionSummary(summary)
      }), axis: .vertical)
      .textFieldStyle(.roundedBorder)
      .lineLimit(1...3)
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
