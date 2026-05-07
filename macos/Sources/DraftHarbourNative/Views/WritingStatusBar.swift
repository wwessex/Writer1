import DraftHarbourNativeCore
import SwiftUI

struct WritingStatusBar: View {
  @Bindable var store: ProjectStore
  var fileURL: URL?
  var recoveryState: String
  var focusMode: Bool = false
  var onStoppedSession: (WritingSessionResult) -> Void
  var onExitFocusMode: () -> Void = {}

  var body: some View {
    HStack(spacing: 14) {
      if focusMode {
        Button {
          onExitFocusMode()
        } label: {
          Label("Exit Focus", systemImage: "arrow.down.right.and.arrow.up.left")
        }
        .controlSize(.small)
      }

      Button {
        if store.writingSession == nil {
          _ = store.startWritingSession()
        } else if let result = store.stopWritingSession() {
          onStoppedSession(result)
        }
      } label: {
        Label(store.writingSession == nil ? "Start Session" : "Stop Session", systemImage: store.writingSession == nil ? "play.fill" : "stop.fill")
      }
      .controlSize(.small)

      if store.writingSession != nil {
        Label("\(store.currentWritingSessionDelta) session words", systemImage: "timer")
          .foregroundStyle(.secondary)
      }

      if focusMode, let session = store.writingSession {
        Text(Date(timeIntervalSince1970: Double(session.startedAt) / 1_000).formatted(date: .omitted, time: .shortened))
          .foregroundStyle(.secondary)
      }

      Divider()
        .frame(height: 14)

      Text("\(store.metrics.totalWords) total")
      if let section = store.activeSection {
        Text("\(MarkdownTools.wordCount(section.content ?? "")) in section")
          .foregroundStyle(.secondary)
      }

      if store.dailyWordTarget > 0 {
        HStack(spacing: 6) {
          ProgressView(value: store.dailyGoalCompletionRatio)
            .frame(width: 90)
          Text("\(store.todayProgress?.wordsWritten ?? 0)/\(store.dailyWordTarget) today")
            .foregroundStyle(.secondary)
        }
      }

      Spacer()

      Label(syncStatus, systemImage: "arrow.triangle.2.circlepath")
        .foregroundStyle(.secondary)
        .lineLimit(1)

      Label(recoveryState, systemImage: "externaldrive.badge.checkmark")
        .foregroundStyle(.secondary)
        .lineLimit(1)

      if let fileURL {
        Text(fileURL.lastPathComponent)
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
    .font(.caption)
    .padding(.horizontal, 12)
    .padding(.vertical, 7)
    .background(.bar)
  }

  private var syncStatus: String {
    let active = (store.envelope.integrations ?? [:]).values
      .filter { $0.enabled }
      .sorted { $0.type.rawValue < $1.type.rawValue }

    guard let latest = active.max(by: { ($0.lastSyncAt ?? 0) < ($1.lastSyncAt ?? 0) }) else {
      return "Local only"
    }

    if let lastSyncAt = latest.lastSyncAt {
      let date = Date(timeIntervalSince1970: Double(lastSyncAt) / 1_000)
      return "\(latest.type.displayName) \(date.formatted(date: .omitted, time: .shortened))"
    }

    return latest.status?.isEmpty == false ? "\(latest.type.displayName) \(latest.status ?? "")" : "\(latest.type.displayName) configured"
  }
}
