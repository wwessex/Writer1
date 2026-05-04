import AppKit
import DraftHarbourNativeCore
import SwiftUI

struct EditorWorkspaceView: View {
  @Bindable var store: ProjectStore
  @Binding var selectedRange: NSRange
  @AppStorage("DraftHarbour.editor.fontSize") private var fontSize = 15.0
  @AppStorage("DraftHarbour.editor.typewriterMode") private var typewriterMode = false
  @State private var screenplayMode = false

  var body: some View {
    VStack(spacing: 0) {
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
}
