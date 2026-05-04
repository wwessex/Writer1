import DraftHarbourNativeCore
import SwiftUI

struct FindReplaceBar: View {
  @Bindable var store: ProjectStore
  @Binding var isPresented: Bool
  @State private var query = ""
  @State private var replacement = ""
  @State private var caseSensitive = false

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
        Button("Replace All") {
          _ = store.replaceInActiveSection(query: query, replacement: replacement, caseSensitive: caseSensitive)
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
        if let first = matches.first {
          Text(first.preview)
            .lineLimit(1)
            .foregroundStyle(.secondary)
        }
      }
      .font(.caption)
    }
    .padding(10)
    .background(.bar)
  }
}
