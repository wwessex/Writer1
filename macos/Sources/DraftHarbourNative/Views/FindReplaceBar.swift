import DraftHarbourNativeCore
import SwiftUI

struct FindReplaceBar: View {
  @Bindable var store: ProjectStore
  @Binding var isPresented: Bool
  @Binding var selectedRange: NSRange
  @State private var query = ""
  @State private var replacement = ""
  @State private var caseSensitive = false
  @State private var currentMatchIndex = 0

  private var matches: [TextSearchMatch] {
    TextWorkflowServices.matches(in: store.activeSection?.content ?? "", query: query, caseSensitive: caseSensitive)
  }

  var body: some View {
    VStack(spacing: 8) {
      HStack(spacing: 8) {
        TextField("Find", text: $query)
          .textFieldStyle(.roundedBorder)
        TextField("Replace", text: $replacement)
          .textFieldStyle(.roundedBorder)
        Toggle("Aa", isOn: $caseSensitive)
          .toggleStyle(.button)
          .help("Case sensitive")
        Button {
          selectMatch(offset: -1)
        } label: {
          Image(systemName: "chevron.up")
        }
        .disabled(matches.isEmpty)
        Button {
          selectMatch(offset: 1)
        } label: {
          Image(systemName: "chevron.down")
        }
        .disabled(matches.isEmpty)
        Button("Replace All") {
          _ = store.replaceInActiveSection(query: query, replacement: replacement, caseSensitive: caseSensitive)
          currentMatchIndex = 0
        }
        .disabled(query.isEmpty || matches.isEmpty)
        Button {
          isPresented = false
        } label: {
          Image(systemName: "xmark")
        }
        .buttonStyle(.borderless)
      }

      HStack {
        Text(query.isEmpty ? "Enter a search term" : "\(matches.count) match\(matches.count == 1 ? "" : "es")")
          .foregroundStyle(.secondary)
        Spacer()
        if !matches.isEmpty {
          Text("\(min(currentMatchIndex + 1, matches.count)) of \(matches.count)")
            .foregroundStyle(.secondary)
          if matches.indices.contains(currentMatchIndex) {
            Text(matches[currentMatchIndex].preview)
              .lineLimit(1)
              .foregroundStyle(.secondary)
          }
        } else if let first = matches.first {
          Text(first.preview)
            .lineLimit(1)
            .foregroundStyle(.secondary)
        }
      }
      .font(.caption)
    }
    .padding(10)
    .background(.bar)
    .onChange(of: query) { _, _ in
      currentMatchIndex = 0
      selectCurrentMatch()
    }
    .onChange(of: caseSensitive) { _, _ in
      currentMatchIndex = 0
      selectCurrentMatch()
    }
  }

  private func selectMatch(offset: Int) {
    guard !matches.isEmpty else { return }
    currentMatchIndex = (currentMatchIndex + offset + matches.count) % matches.count
    selectCurrentMatch()
  }

  private func selectCurrentMatch() {
    guard matches.indices.contains(currentMatchIndex) else { return }
    selectedRange = matches[currentMatchIndex].range
  }
}
