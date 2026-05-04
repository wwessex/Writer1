import DraftHarbourNativeCore
import SwiftUI

struct QuickSwitcherView: View {
  @Bindable var store: ProjectStore
  var runCommand: (NativeCommandID) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var query = ""

  private var results: [QuickSwitcherItem] {
    QuickSwitcherIndex.search(query, in: store.envelope)
  }

  var body: some View {
    VStack(spacing: 0) {
      TextField("Search sections, commands, characters, world", text: $query)
        .textFieldStyle(.roundedBorder)
        .padding()

      List(results) { item in
        Button {
          select(item)
        } label: {
          HStack {
            Image(systemName: icon(for: item.kind))
              .frame(width: 22)
              .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
              Text(item.title)
              if !item.subtitle.isEmpty {
                Text(item.subtitle)
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
            }
            Spacer()
          }
        }
        .buttonStyle(.plain)
      }
    }
    .frame(minWidth: 560, minHeight: 460)
  }

  private func select(_ item: QuickSwitcherItem) {
    if item.kind == .section {
      store.selectSection(item.id)
    } else if let commandID = item.commandID {
      runCommand(commandID)
    }
    dismiss()
  }

  private func icon(for kind: QuickSwitcherItem.Kind) -> String {
    switch kind {
    case .section: store.projectType == .screenplay ? "film" : "doc.text"
    case .command: "command"
    case .character: "person"
    case .worldEntry: "map"
    }
  }
}
