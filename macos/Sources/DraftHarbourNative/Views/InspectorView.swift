import AppKit
import DraftHarbourNativeCore
import SwiftUI

struct InspectorView: View {
  @Bindable var store: ProjectStore
  var selectedRange: NSRange
  @SceneStorage("DraftHarbour.inspectorTab") private var selectedTabRaw = InspectorTab.details.rawValue
  @State private var replyDrafts: [String: String] = [:]

  private var selectedTab: Binding<InspectorTab> {
    Binding {
      InspectorTab(rawValue: selectedTabRaw) ?? .details
    } set: { newValue in
      selectedTabRaw = newValue.rawValue
    }
  }

  var body: some View {
    VStack(spacing: 0) {
      Picker("Inspector", selection: selectedTab) {
        ForEach(InspectorTab.allCases) { tab in
          Text(tab.title).tag(tab)
        }
      }
      .pickerStyle(.segmented)
      .padding(12)

      Divider()

      ScrollView {
        VStack(alignment: .leading, spacing: 18) {
          switch selectedTab.wrappedValue {
          case .details:
            detailsSection
          case .comments:
            commentsSection
          case .snapshots:
            snapshotsSection
          case .metrics:
            metricsSection
          }
        }
        .padding(16)
      }
    }
  }

  private var detailsSection: some View {
    VStack(alignment: .leading, spacing: 14) {
      Label(store.projectType == .screenplay ? "Scene Details" : "Chapter Details", systemImage: "info.circle")
        .font(.headline)

      if let section = store.activeSection {
        Picker("Status", selection: Binding(get: {
          section.status
        }, set: { status in
          store.updateActiveSectionStatus(status)
        })) {
          ForEach(ChapterStatus.allCases, id: \.self) { status in
            Text(status.rawValue.capitalized).tag(status)
          }
        }

        TextField("Summary", text: textBinding(
          get: { store.activeSection?.summary ?? "" },
          set: { store.updateActiveSectionSummary($0) }
        ), axis: .vertical)
        .lineLimit(3...7)

        TextField("POV", text: textBinding(
          get: { store.activeSection?.pov ?? "" },
          set: { store.updateActiveSectionPOV($0) }
        ))

        TextField("Tags", text: textBinding(
          get: { store.activeSection?.tags.joined(separator: ", ") ?? "" },
          set: { store.updateActiveSectionTags(parseCSV($0)) }
        ))

        TextField("Word Goal", value: Binding(get: {
          store.activeSection?.wordGoal ?? 0
        }, set: { value in
          store.updateActiveSectionWordGoal(value)
        }), format: .number)

        TextField("Part", text: textBinding(
          get: { store.activeSection?.part ?? "" },
          set: { store.updateActiveSectionPart($0) }
        ))

        TextField("Act", text: textBinding(
          get: { optionalIntString(store.activeSection?.act) },
          set: { store.updateActiveSectionAct(Int($0.trimmingCharacters(in: .whitespacesAndNewlines))) }
        ))

        TextField("Sequence", text: textBinding(
          get: { optionalIntString(store.activeSection?.sequence) },
          set: { store.updateActiveSectionSequence(Int($0.trimmingCharacters(in: .whitespacesAndNewlines))) }
        ))

        if section.wordGoal > 0 {
          LabeledContent("Goal Progress") {
            ProgressView(value: min(1, Double(MarkdownTools.wordCount(section.content ?? "")) / Double(section.wordGoal)))
              .frame(width: 120)
          }
        }

        if store.projectType == .screenplay || !section.scenes.isEmpty {
          sceneMetadata(section: section)
        }
      } else {
        ContentUnavailableView("No Section Selected", systemImage: "doc.text.magnifyingglass")
      }
    }
  }

  private func sceneMetadata(section: DraftHarbourNativeCore.Section) -> some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Label("Scene Cards", systemImage: "film")
          .font(.headline)
        Spacer()
        Button {
          _ = try? store.createScene()
        } label: {
          Label("Add Scene", systemImage: "plus")
        }
        .labelStyle(.iconOnly)
      }

      if section.scenes.isEmpty {
        Text("No scene cards yet.")
          .foregroundStyle(.secondary)
      } else {
        ForEach(section.scenes) { scene in
          GroupBox(scene.title.isEmpty ? "Scene" : scene.title) {
            VStack(alignment: .leading, spacing: 8) {
              TextField("Title", text: sceneStringBinding(sceneID: scene.id, get: { $0.title }, set: { $0.title = $1 }))
              TextField("Slug Line", text: sceneStringBinding(sceneID: scene.id, get: { $0.slugLine ?? "" }, set: { $0.slugLine = emptyNil($1) }))
              TextField("Location", text: sceneStringBinding(sceneID: scene.id, get: { $0.location ?? "" }, set: { $0.location = emptyNil($1) }))
              TextField("Time Of Day", text: sceneStringBinding(sceneID: scene.id, get: { $0.timeOfDay ?? "" }, set: { $0.timeOfDay = emptyNil($1) }))
              TextField("Production Tags", text: sceneStringBinding(
                sceneID: scene.id,
                get: { ($0.productionTags ?? []).joined(separator: ", ") },
                set: { $0.productionTags = parseCSV($1) }
              ))
              TextField("Page Estimate", text: sceneStringBinding(
                sceneID: scene.id,
                get: { $0.pageEstimate.map { String(format: "%.1f", $0) } ?? "" },
                set: { $0.pageEstimate = Double($1.trimmingCharacters(in: .whitespacesAndNewlines)) }
              ))
              Button("Delete Scene", role: .destructive) {
                store.deleteScene(sectionID: section.id, sceneID: scene.id)
              }
            }
          }
        }
      }
    }
  }

  private var commentsSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Label("Comments", systemImage: "text.bubble")
          .font(.headline)
        Spacer()
        Button {
          _ = try? store.addComment(
            text: "New comment",
            from: selectedRange.location,
            to: selectedRange.location + selectedRange.length
          )
        } label: {
          Label("Add Comment", systemImage: "plus")
        }
        .disabled(selectedRange.length == 0)
      }

      let threads = store.envelope.commentThreads.filter { $0.chapterId == store.activeSectionID }
      if threads.isEmpty {
        Text("No comments for this section.")
          .foregroundStyle(.secondary)
      } else {
        ForEach(threads) { thread in
          GroupBox(thread.resolved ? "Resolved" : "Open") {
            VStack(alignment: .leading, spacing: 8) {
              if let selectedText = thread.anchor.selectedText, !selectedText.isEmpty {
                Text(selectedText)
                  .font(.caption)
                  .foregroundStyle(.secondary)
                  .lineLimit(2)
              }

              ForEach(thread.comments) { comment in
                TextField("Comment", text: textBinding(
                  get: { comment.text },
                  set: { value in try? store.updateComment(threadID: thread.id, commentID: comment.id, text: value) }
                ), axis: .vertical)
                .lineLimit(2...5)
              }

              HStack {
                TextField("Reply", text: textBinding(
                  get: { replyDrafts[thread.id] ?? "" },
                  set: { replyDrafts[thread.id] = $0 }
                ))
                Button("Reply") {
                  let text = (replyDrafts[thread.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                  guard !text.isEmpty else { return }
                  try? store.addCommentReply(threadID: thread.id, text: text)
                  replyDrafts[thread.id] = ""
                }
              }

              HStack {
                Button(thread.resolved ? "Reopen" : "Resolve") {
                  try? store.resolveCommentThread(threadID: thread.id, resolved: !thread.resolved)
                }
                Button("Delete", role: .destructive) {
                  try? store.deleteCommentThread(threadID: thread.id)
                }
              }
            }
          }
        }
      }
    }
  }

  private var snapshotsSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Label("Snapshots", systemImage: "clock.arrow.circlepath")
          .font(.headline)
        Spacer()
        Button {
          _ = try? store.createSnapshot(label: "Manual")
        } label: {
          Label("Create Snapshot", systemImage: "plus")
        }
      }

      let snapshots = store.envelope.snapshots.filter { $0.chapterId == store.activeSectionID }
      if snapshots.isEmpty {
        Text("No snapshots for this section.")
          .foregroundStyle(.secondary)
      } else {
        ForEach(snapshots) { snapshot in
          GroupBox {
            VStack(alignment: .leading, spacing: 8) {
              TextField("Label", text: textBinding(
                get: { snapshot.label ?? "" },
                set: { value in try? store.updateSnapshotLabel(id: snapshot.id, label: value) }
              ))
              Text(Date(timeIntervalSince1970: Double(snapshot.createdAt) / 1_000).formatted())
                .font(.caption)
                .foregroundStyle(.secondary)
              HStack {
                Button("Restore") { try? store.restoreSnapshot(id: snapshot.id) }
                Button("Delete", role: .destructive) { try? store.deleteSnapshot(id: snapshot.id) }
              }
            }
          }
        }
      }
    }
  }

  private var metricsSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      Label("Metrics", systemImage: "chart.bar")
        .font(.headline)

      LabeledContent("Project Words", value: "\(store.metrics.totalWords)")
      LabeledContent("Sections", value: "\(store.metrics.sectionCount)")
      LabeledContent("Average", value: "\(store.metrics.averageWordsPerSection)")
      if let section = store.activeSection {
        LabeledContent("Active Section", value: "\(MarkdownTools.wordCount(section.content ?? ""))")
      }

      Divider()

      let target = store.dailyWordTarget
      LabeledContent("Daily Target", value: target > 0 ? "\(target)" : "Not set")
      LabeledContent("Today", value: "\(store.todayProgress?.wordsWritten ?? 0)")
      ProgressView(value: store.dailyGoalCompletionRatio)

      if let progress = store.envelope.progress {
        LabeledContent("Sessions", value: "\(progress.totalSessions)")
        LabeledContent("Current Streak", value: "\(progress.streak.current)")
        LabeledContent("Longest Streak", value: "\(progress.streak.longest)")
      }

      if let session = store.writingSession {
        Divider()
        Label("Writing Session", systemImage: "timer")
          .font(.headline)
        LabeledContent("Started", value: Date(timeIntervalSince1970: Double(session.startedAt) / 1_000).formatted(date: .omitted, time: .shortened))
        LabeledContent("Session Words", value: "\(store.currentWritingSessionDelta)")
      }
    }
  }

  private func textBinding(get: @escaping @MainActor () -> String, set: @escaping @MainActor (String) -> Void) -> Binding<String> {
    Binding {
      get()
    } set: { value in
      set(value)
    }
  }

  private func sceneStringBinding(
    sceneID: String,
    get: @escaping (DraftHarbourNativeCore.Scene) -> String,
    set: @escaping (inout DraftHarbourNativeCore.Scene, String) -> Void
  ) -> Binding<String> {
    Binding {
      guard let scene = store.activeSection?.scenes.first(where: { $0.id == sceneID }) else {
        return ""
      }
      return get(scene)
    } set: { value in
      guard let sectionID = store.activeSectionID else { return }
      store.updateScene(sectionID: sectionID, sceneID: sceneID) { scene in
        set(&scene, value)
      }
    }
  }

  private func parseCSV(_ value: String) -> [String] {
    value
      .split(separator: ",")
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
  }

  private func optionalIntString(_ value: Int?) -> String {
    value.map(String.init) ?? ""
  }
}

private func emptyNil(_ value: String) -> String? {
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.isEmpty ? nil : trimmed
}
