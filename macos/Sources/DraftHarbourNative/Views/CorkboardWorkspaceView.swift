import DraftHarbourNativeCore
import SwiftUI

private enum WorkspaceCardSize: String, CaseIterable, Identifiable {
  case compact
  case normal
  case large

  var id: String { rawValue }

  var minimumWidth: CGFloat {
    switch self {
    case .compact:
      return 170
    case .normal:
      return 230
    case .large:
      return 310
    }
  }

  var minimumHeight: CGFloat {
    switch self {
    case .compact:
      return 120
    case .normal:
      return 150
    case .large:
      return 205
    }
  }
}

struct CorkboardWorkspaceView: View {
  @Bindable var store: ProjectStore
  @State private var searchText = ""
  @State private var statusFilter = "all"
  @State private var cardSize = WorkspaceCardSize.normal
  @State private var reorderMode = false

  private var filteredSections: [DraftHarbourNativeCore.Section] {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    return store.envelope.sections.filter { section in
      let statusMatches = statusFilter == "all" || section.status.rawValue == statusFilter
      guard statusMatches else { return false }
      guard !query.isEmpty else { return true }
      return section.title.range(of: query, options: .caseInsensitive) != nil ||
        section.summary.range(of: query, options: .caseInsensitive) != nil ||
        section.tags.contains { $0.range(of: query, options: .caseInsensitive) != nil }
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      toolbar
      Divider()
      if reorderMode {
        reorderList
      } else {
        ScrollView {
          LazyVGrid(columns: [GridItem(.adaptive(minimum: cardSize.minimumWidth), spacing: 12)], spacing: 12) {
            ForEach(filteredSections) { section in
              card(section)
            }
          }
          .padding(18)
        }
      }
    }
  }

  private var toolbar: some View {
    HStack(spacing: 12) {
      TextField("Search corkboard", text: $searchText)
        .textFieldStyle(.roundedBorder)
        .frame(minWidth: 180, maxWidth: 280)

      Picker("Status", selection: $statusFilter) {
        Text("All").tag("all")
        ForEach(ChapterStatus.allCases, id: \.self) { status in
          Text(status.rawValue.capitalized).tag(status.rawValue)
        }
      }
      .frame(width: 140)

      Picker("Card Size", selection: $cardSize) {
        ForEach(WorkspaceCardSize.allCases) { size in
          Text(size.rawValue.capitalized).tag(size)
        }
      }
      .frame(width: 140)

      Toggle("Reorder", isOn: $reorderMode)
        .toggleStyle(.button)

      Spacer()

      Text("\(filteredSections.count) \(store.projectType == .screenplay ? "scenes" : "chapters")")
        .foregroundStyle(.secondary)

      Button {
        _ = store.createSection(after: store.activeSectionID)
      } label: {
        Label(store.projectType == .screenplay ? "New Scene" : "New Chapter", systemImage: "plus")
      }
    }
    .padding(12)
  }

  private var reorderList: some View {
    List(selection: Binding(get: {
      store.activeSectionID
    }, set: { value in
      store.selectSection(value)
    })) {
      ForEach(store.envelope.sections) { section in
        HStack(spacing: 10) {
          Image(systemName: "line.3.horizontal")
            .foregroundStyle(.secondary)
          VStack(alignment: .leading, spacing: 2) {
            Text(section.title.isEmpty ? "Untitled" : section.title)
            Text("\(section.status.rawValue.capitalized) · \(MarkdownTools.wordCount(section.content ?? "")) words")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
          Spacer()
          Text("#\(section.order + 1)")
            .foregroundStyle(.secondary)
        }
        .tag(section.id)
      }
      .onMove { source, destination in
        store.moveSections(from: source, to: destination)
      }
    }
  }

  private func card(_ section: DraftHarbourNativeCore.Section) -> some View {
    Button {
      store.selectSection(section.id)
    } label: {
      VStack(alignment: .leading, spacing: 9) {
        HStack {
          Text("#\(section.order + 1)")
            .font(.caption)
            .foregroundStyle(.secondary)
          Spacer()
          Text(section.status.rawValue.capitalized)
            .font(.caption2)
            .foregroundStyle(.secondary)
        }

        Text(section.title.isEmpty ? "Untitled" : section.title)
          .font(.headline)
          .lineLimit(2)

        Text(summary(for: section))
          .font(.callout)
          .foregroundStyle(.secondary)
          .lineLimit(cardSize == .compact ? 2 : 5)

        Spacer(minLength: 0)

        HStack {
          Text("\(MarkdownTools.wordCount(section.content ?? "")) words")
            .font(.caption)
            .foregroundStyle(.secondary)
          Spacer()
          if section.wordGoal > 0 {
            ProgressView(value: min(1, Double(MarkdownTools.wordCount(section.content ?? "")) / Double(section.wordGoal)))
              .controlSize(.mini)
              .frame(width: 44)
          }
        }
      }
      .padding(12)
      .frame(minHeight: cardSize.minimumHeight, alignment: .topLeading)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(store.activeSectionID == section.id ? AnyShapeStyle(Color.accentColor.opacity(0.18)) : AnyShapeStyle(.regularMaterial))
      .clipShape(RoundedRectangle(cornerRadius: 8))
    }
    .buttonStyle(.plain)
  }

  private func summary(for section: DraftHarbourNativeCore.Section) -> String {
    let summary = section.summary.trimmingCharacters(in: .whitespacesAndNewlines)
    if !summary.isEmpty {
      return summary
    }
    let plain = MarkdownTools.plainText(from: section.content ?? "")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return plain.isEmpty ? "No summary yet." : plain
  }
}
