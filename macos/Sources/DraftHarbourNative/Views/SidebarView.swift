import DraftHarbourNativeCore
import SwiftUI

struct SidebarView: View {
  @Bindable var store: ProjectStore

  var body: some View {
    List(selection: Binding(get: {
      store.activeSectionID
    }, set: { newValue in
      store.selectSection(newValue)
    })) {
      Section("Manuscript") {
        ForEach(store.envelope.sections) { section in
          HStack(spacing: 10) {
            Image(systemName: store.projectType == .screenplay ? "film" : "doc.text")
              .foregroundStyle(.secondary)
              .frame(width: 16)

            VStack(alignment: .leading, spacing: 2) {
              Text(section.title)
                .lineLimit(1)
              Text("\(MarkdownTools.wordCount(section.content ?? "")) words")
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
          }
          .tag(section.id)
          .contextMenu {
            Button("Snapshot") {
              store.selectSection(section.id)
              _ = try? store.createSnapshot(label: "Manual")
            }
            Button("Delete", role: .destructive) {
              try? store.deleteSection(id: section.id)
            }
            .disabled(store.envelope.sections.count <= 1)
          }
        }
        .onMove { source, destination in
          store.moveSections(from: source, to: destination)
        }
      }
    }
    .listStyle(.sidebar)
    .safeAreaInset(edge: .bottom) {
      HStack {
        Button {
          _ = store.createSection(after: store.activeSectionID)
        } label: {
          Label(store.projectType == .screenplay ? "Scene" : "Chapter", systemImage: "plus")
        }
        .buttonStyle(.borderless)

        Spacer()

        Text("\(store.metrics.totalWords) words")
          .font(.caption)
          .foregroundStyle(.secondary)
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(.bar)
    }
  }
}
