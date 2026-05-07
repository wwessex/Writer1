import DraftHarbourNativeCore
import SwiftUI

struct SidebarView: View {
  @Bindable var store: ProjectStore
  @State private var searchText = ""
  @State private var statusFilter = "all"

  private var filteredSections: [DraftHarbourNativeCore.Section] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    return store.envelope.sections.filter { section in
      let statusMatches = statusFilter == "all" || section.status.rawValue == statusFilter
      guard statusMatches else { return false }
      guard !query.isEmpty else { return true }
      return section.title.range(of: query, options: .caseInsensitive) != nil ||
        section.summary.range(of: query, options: .caseInsensitive) != nil ||
        (section.content ?? "").range(of: query, options: .caseInsensitive) != nil ||
        section.tags.contains { $0.range(of: query, options: .caseInsensitive) != nil }
    }
  }

  var body: some View {
    List(selection: Binding(get: {
      store.activeSectionID
    }, set: { newValue in
      store.selectSection(newValue)
    })) {
      Section("Manuscript") {
        ForEach(filteredSections) { section in
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

            if section.wordGoal > 0 {
              ProgressView(value: min(1, Double(MarkdownTools.wordCount(section.content ?? "")) / Double(section.wordGoal)))
                .controlSize(.mini)
                .frame(width: 38)
                .help("\(MarkdownTools.wordCount(section.content ?? "")) of \(section.wordGoal) words")
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
          guard searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, statusFilter == "all" else { return }
          store.moveSections(from: source, to: destination)
        }
      }
    }
    .listStyle(.sidebar)
    .searchable(text: $searchText, placement: .sidebar, prompt: "Search manuscript")
    .safeAreaInset(edge: .top) {
      Picker("Status", selection: $statusFilter) {
        Text("All").tag("all")
        ForEach(ChapterStatus.allCases, id: \.self) { status in
          Text(status.rawValue.capitalized).tag(status.rawValue)
        }
      }
      .pickerStyle(.menu)
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(.bar)
    }
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
