import AppKit
import DraftHarbourNativeCore
import SwiftUI

struct InspectorView: View {
  @Bindable var store: ProjectStore
  var selectedRange: NSRange

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        metricsSection
        sectionMetadata
        snapshotsSection
        commentsSection
      }
      .padding(16)
    }
  }

  private var metricsSection: some View {
    VStack(alignment: .leading, spacing: 8) {
      Label("Project", systemImage: "chart.bar")
        .font(.headline)
      LabeledContent("Words", value: "\(store.metrics.totalWords)")
      LabeledContent("Sections", value: "\(store.metrics.sectionCount)")
      LabeledContent("Average", value: "\(store.metrics.averageWordsPerSection)")
      ProgressView(value: store.metrics.completionRatio)
    }
  }

  private var sectionMetadata: some View {
    VStack(alignment: .leading, spacing: 8) {
      Label(store.projectType == .screenplay ? "Scene" : "Chapter", systemImage: "info.circle")
        .font(.headline)
      if let section = store.activeSection {
        LabeledContent("Status", value: section.status.rawValue.capitalized)
        LabeledContent("Selected", value: "\(selectedRange.length) chars")
        LabeledContent("Words", value: "\(MarkdownTools.wordCount(section.content ?? ""))")
      }
    }
  }

  private var snapshotsSection: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Label("Snapshots", systemImage: "clock.arrow.circlepath")
          .font(.headline)
        Spacer()
        Button {
          _ = try? store.createSnapshot(label: "Manual")
        } label: {
          Image(systemName: "plus")
        }
        .buttonStyle(.borderless)
      }

      let snapshots = store.envelope.snapshots.filter { $0.chapterId == store.activeSectionID }
      if snapshots.isEmpty {
        Text("No snapshots")
          .foregroundStyle(.secondary)
      } else {
        ForEach(snapshots.prefix(5)) { snapshot in
          VStack(alignment: .leading, spacing: 2) {
            Text(snapshot.label ?? "Snapshot")
            Text(Date(timeIntervalSince1970: Double(snapshot.createdAt) / 1000).formatted())
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      }
    }
  }

  private var commentsSection: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Label("Comments", systemImage: "text.bubble")
          .font(.headline)
        Spacer()
        Button {
          _ = try? store.addComment(text: "New comment", from: selectedRange.location, to: selectedRange.location + selectedRange.length)
        } label: {
          Image(systemName: "plus")
        }
        .buttonStyle(.borderless)
        .disabled(selectedRange.length == 0)
      }

      let comments = store.envelope.commentThreads.filter { $0.chapterId == store.activeSectionID }
      if comments.isEmpty {
        Text("No comments")
          .foregroundStyle(.secondary)
      } else {
        ForEach(comments.prefix(5)) { thread in
          VStack(alignment: .leading, spacing: 2) {
            Text(thread.comments.first?.text ?? "Comment")
              .lineLimit(2)
            Text(thread.resolved ? "Resolved" : "Open")
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      }
    }
  }
}
