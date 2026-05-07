import Foundation
import Observation

@Observable
public final class ProjectStore {
  public var envelope: DhprojEnvelope
  public var activeSectionID: String?
  public private(set) var writingSession: WritingSessionState?
  public private(set) var revision: Int = 0
  private var sectionOrderUndoStack: [[String]] = []
  private var sectionOrderRedoStack: [[String]] = []

  public init(envelope: DhprojEnvelope) {
    self.envelope = DhprojCodec.normalize(envelope)
    self.activeSectionID = self.envelope.sections.first?.id
  }

  public var projectType: ProjectType {
    envelope.projectType
  }

  public var activeSection: Section? {
    guard let activeSectionID else { return nil }
    return envelope.sections.first { $0.id == activeSectionID }
  }

  public var metrics: ProjectMetrics {
    AnalyticsEngine.metrics(for: envelope)
  }

  public var dailyWordTarget: Int {
    envelope.settings.dailyWordGoal ?? envelope.settings.goalConfiguration?.dailyWordTarget ?? 0
  }

  public var todayProgress: DailyProgress? {
    progress(for: Self.todayString())
  }

  public var currentWritingSessionDelta: Int {
    guard let writingSession else { return 0 }
    return max(0, metrics.totalWords - writingSession.startingWordCount)
  }

  public var dailyGoalCompletionRatio: Double {
    guard dailyWordTarget > 0 else { return 0 }
    return min(1, Double(todayProgress?.wordsWritten ?? 0) / Double(dailyWordTarget))
  }

  public var canUndoSectionReorder: Bool {
    !sectionOrderUndoStack.isEmpty
  }

  public var canRedoSectionReorder: Bool {
    !sectionOrderRedoStack.isEmpty
  }

  public func selectSection(_ id: String?) {
    activeSectionID = id
  }

  public func replaceEnvelope(_ envelope: DhprojEnvelope, activeSectionID: String? = nil) {
    self.envelope = DhprojCodec.normalize(envelope)
    if let activeSectionID, self.envelope.sections.contains(where: { $0.id == activeSectionID }) {
      self.activeSectionID = activeSectionID
    } else {
      self.activeSectionID = self.envelope.sections.first?.id
    }
    markChanged()
  }

  public func updateProjectTitle(_ title: String) {
    envelope.project.title = title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Untitled Project" : title
    markChanged()
  }

  public func updateSettings(_ update: (inout AppSettings) -> Void) {
    update(&envelope.settings)
    markChanged()
  }

  public func updateStoryBlueprint(_ blueprint: StoryBlueprint?) {
    envelope.storyBlueprint = blueprint
    markChanged()
  }

  public func updateGoals(daily: Int? = nil, weekly: Int? = nil, project: Int? = nil, deadline: String? = nil) {
    if let daily {
      envelope.settings.dailyWordGoal = daily > 0 ? daily : nil
    }
    if let project {
      envelope.settings.novelWordGoal = project > 0 ? project : nil
    }

    var goalConfiguration = envelope.settings.goalConfiguration ?? GoalConfiguration()
    if let daily {
      goalConfiguration.dailyWordTarget = daily > 0 ? daily : nil
    }
    if let weekly {
      goalConfiguration.weeklyWordTarget = weekly > 0 ? weekly : nil
    }
    if let deadline {
      let trimmed = deadline.trimmingCharacters(in: .whitespacesAndNewlines)
      envelope.settings.novelDeadline = trimmed.isEmpty ? nil : trimmed
      goalConfiguration.draftCompletionDeadline = trimmed.isEmpty ? nil : trimmed
    }
    envelope.settings.goalConfiguration = goalConfiguration
    markChanged()
  }

  @discardableResult
  public func importSections(_ sections: [Section], selectFirst: Bool = true) -> [String] {
    guard !sections.isEmpty else { return [] }
    let startIndex = envelope.sections.count
    let imported = sections.enumerated().map { offset, section in
      var copy = section
      copy.novelId = envelope.project.id
      copy.order = startIndex + offset
      if copy.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        copy.title = "\(projectType == .screenplay ? "Scene" : "Chapter") \(copy.order + 1)"
      }
      return copy
    }
    envelope.sections.append(contentsOf: imported)
    renumberSections()
    if selectFirst {
      activeSectionID = imported.first?.id
    }
    markChanged()
    return imported.map(\.id)
  }

  @discardableResult
  public func createSection(after sectionID: String? = nil) -> Section {
    let insertionIndex: Int
    if let sectionID, let index = envelope.sections.firstIndex(where: { $0.id == sectionID }) {
      insertionIndex = index + 1
    } else {
      insertionIndex = envelope.sections.count
    }

    let titlePrefix = projectType == .screenplay ? "Scene" : "Chapter"
    let section = Section(
      novelId: envelope.project.id,
      order: insertionIndex,
      title: "\(titlePrefix) \(insertionIndex + 1)",
      content: ""
    )
    envelope.sections.insert(section, at: insertionIndex)
    renumberSections()
    activeSectionID = section.id
    markChanged()
    return section
  }

  public func deleteActiveSection() throws {
    guard let activeSectionID else { throw DraftHarbourError.invalidSelection }
    try deleteSection(id: activeSectionID)
  }

  public func deleteSection(id: String) throws {
    guard let index = envelope.sections.firstIndex(where: { $0.id == id }) else {
      throw DraftHarbourError.missingSection(id)
    }
    envelope.sections.remove(at: index)
    envelope.snapshots.removeAll { $0.chapterId == id }
    envelope.commentThreads.removeAll { $0.chapterId == id }
    if envelope.sections.isEmpty {
      let titlePrefix = projectType == .screenplay ? "Scene" : "Chapter"
      envelope.sections.append(Section(novelId: envelope.project.id, order: 0, title: "\(titlePrefix) 1", content: ""))
    }
    renumberSections()
    activeSectionID = envelope.sections[min(index, max(0, envelope.sections.count - 1))].id
    markChanged()
  }

  public func updateActiveSectionTitle(_ title: String) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      section.title = title
    }
  }

  public func updateActiveSectionContent(_ content: String) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      section.content = content
    }
  }

  public func updateActiveSectionSummary(_ summary: String) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      section.summary = summary
    }
  }

  public func updateActiveSectionPOV(_ pov: String) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      section.pov = pov
    }
  }

  public func updateActiveSectionStatus(_ status: ChapterStatus) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      section.status = status
    }
  }

  public func updateActiveSectionWordGoal(_ wordGoal: Int) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      section.wordGoal = max(0, wordGoal)
    }
  }

  public func updateActiveSectionTags(_ tags: [String]) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      section.tags = tags
    }
  }

  public func updateActiveSectionPart(_ part: String?) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      let trimmed = part?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      section.part = trimmed.isEmpty ? nil : trimmed
    }
  }

  public func updateActiveSectionAct(_ act: Int?) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      if let act, act > 0 {
        section.act = act
      } else {
        section.act = nil
      }
    }
  }

  public func updateActiveSectionSequence(_ sequence: Int?) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      if let sequence, sequence > 0 {
        section.sequence = sequence
      } else {
        section.sequence = nil
      }
    }
  }

  public func moveSections(from source: IndexSet, to destination: Int) {
    sectionOrderUndoStack.append(envelope.sections.map(\.id))
    sectionOrderRedoStack.removeAll()
    var moving = source.map { envelope.sections[$0] }
    envelope.sections.removeAll { section in
      moving.contains { $0.id == section.id }
    }
    let insertion = min(destination, envelope.sections.count)
    envelope.sections.insert(contentsOf: moving, at: insertion)
    moving.removeAll()
    renumberSections()
    markChanged()
  }

  public func reorderSections(ids: [String]) {
    let byId = Dictionary(uniqueKeysWithValues: envelope.sections.map { ($0.id, $0) })
    let ordered = ids.compactMap { byId[$0] }
    guard ordered.count == envelope.sections.count else { return }
    sectionOrderUndoStack.append(envelope.sections.map(\.id))
    sectionOrderRedoStack.removeAll()
    envelope.sections = ordered
    renumberSections()
    markChanged()
  }

  public func undoSectionReorder() {
    guard let previous = sectionOrderUndoStack.popLast() else { return }
    sectionOrderRedoStack.append(envelope.sections.map(\.id))
    applySectionOrder(previous)
  }

  public func redoSectionReorder() {
    guard let next = sectionOrderRedoStack.popLast() else { return }
    sectionOrderUndoStack.append(envelope.sections.map(\.id))
    applySectionOrder(next)
  }

  @discardableResult
  public func createScene(in sectionID: String? = nil, initialData: Scene? = nil) throws -> Scene {
    let targetID = sectionID ?? activeSectionID
    guard let targetID else { throw DraftHarbourError.invalidSelection }
    let scene = initialData ?? Scene(
      title: "Scene \(((envelope.sections.first { $0.id == targetID }?.scenes.count) ?? 0) + 1)",
      status: projectType == .screenplay ? .draft : .planned,
      tags: projectType == .screenplay ? ["slugLine", "action", "characterCue", "dialogue"] : [],
      slugLine: projectType == .screenplay ? "" : nil,
      location: projectType == .screenplay ? "" : nil,
      interiorExterior: projectType == .screenplay ? "INT" : nil,
      timeOfDay: projectType == .screenplay ? "DAY" : nil,
      pageEstimate: projectType == .screenplay ? 1 : nil,
      productionTags: projectType == .screenplay ? [] : nil
    )
    updateSection(id: targetID) { section in
      section.scenes.append(scene)
    }
    return scene
  }

  @discardableResult
  public func applySceneTemplate(_ template: SceneTemplate, pov: String = "", wordGoal: Int = 0) throws -> Scene {
    try createScene(
      initialData: SceneTemplateServices.scene(
        from: template,
        pov: pov.trimmingCharacters(in: .whitespacesAndNewlines),
        wordGoal: wordGoal,
        projectType: projectType
      )
    )
  }

  public func updateScene(sectionID: String, sceneID: String, update: (inout Scene) -> Void) {
    updateSection(id: sectionID) { section in
      guard let index = section.scenes.firstIndex(where: { $0.id == sceneID }) else { return }
      update(&section.scenes[index])
    }
  }

  public func deleteScene(sectionID: String, sceneID: String) {
    updateSection(id: sectionID) { section in
      section.scenes.removeAll { $0.id == sceneID }
    }
  }

  public func reorderScenes(sectionID: String, sceneIDs: [String]) {
    updateSection(id: sectionID) { section in
      let byId = Dictionary(uniqueKeysWithValues: section.scenes.map { ($0.id, $0) })
      let ordered = sceneIDs.compactMap { byId[$0] }
      guard ordered.count == section.scenes.count else { return }
      section.scenes = ordered
    }
  }

  @discardableResult
  public func createSnapshot(label: String? = "Manual") throws -> Snapshot {
    guard let section = activeSection else { throw DraftHarbourError.invalidSelection }
    let snapshot = Snapshot(chapterId: section.id, doc: section.content ?? "", label: label)
    envelope.snapshots.insert(snapshot, at: 0)
    markChanged()
    return snapshot
  }

  public func createAutoSnapshotForActiveSection() throws {
    guard let section = activeSection, let content = section.content, !content.isEmpty else { return }
    _ = try createSnapshot(label: "Auto")
  }

  public func restoreSnapshot(id: String) throws {
    guard let snapshot = envelope.snapshots.first(where: { $0.id == id }) else {
      throw DraftHarbourError.missingSnapshot(id)
    }
    updateSection(id: snapshot.chapterId) { section in
      section.content = snapshot.doc
    }
    activeSectionID = snapshot.chapterId
  }

  public func updateSnapshotLabel(id: String, label: String) throws {
    guard let index = envelope.snapshots.firstIndex(where: { $0.id == id }) else {
      throw DraftHarbourError.missingSnapshot(id)
    }
    envelope.snapshots[index].label = label
    markChanged()
  }

  public func deleteSnapshot(id: String) throws {
    guard let index = envelope.snapshots.firstIndex(where: { $0.id == id }) else {
      throw DraftHarbourError.missingSnapshot(id)
    }
    envelope.snapshots.remove(at: index)
    markChanged()
  }

  @discardableResult
  public func addComment(text: String, from: Int, to: Int, selectedText: String? = nil, author: String = NSFullUserName()) throws -> CommentThread {
    guard let section = activeSection else { throw DraftHarbourError.invalidSelection }
    let anchor = CommentAnchorRange(from: from, to: to, length: max(0, to - from), selectedText: selectedText)
    let thread = CommentThread(chapterId: section.id, anchor: anchor, comments: [Comment(text: text, author: author)])
    envelope.commentThreads.insert(thread, at: 0)
    markChanged()
    return thread
  }

  public func addCommentReply(threadID: String, text: String, author: String = NSFullUserName()) throws {
    guard let index = envelope.commentThreads.firstIndex(where: { $0.id == threadID }) else {
      throw DraftHarbourError.missingCommentThread(threadID)
    }
    envelope.commentThreads[index].comments.append(Comment(text: text, author: author))
    envelope.commentThreads[index].updatedAt = currentTimeMilliseconds()
    markChanged()
  }

  public func updateComment(threadID: String, commentID: String, text: String) throws {
    guard let threadIndex = envelope.commentThreads.firstIndex(where: { $0.id == threadID }) else {
      throw DraftHarbourError.missingCommentThread(threadID)
    }
    guard let commentIndex = envelope.commentThreads[threadIndex].comments.firstIndex(where: { $0.id == commentID }) else {
      throw DraftHarbourError.missingCommentThread(commentID)
    }
    envelope.commentThreads[threadIndex].comments[commentIndex].text = text
    envelope.commentThreads[threadIndex].updatedAt = currentTimeMilliseconds()
    markChanged()
  }

  public func resolveCommentThread(threadID: String, resolved: Bool) throws {
    guard let index = envelope.commentThreads.firstIndex(where: { $0.id == threadID }) else {
      throw DraftHarbourError.missingCommentThread(threadID)
    }
    envelope.commentThreads[index].resolved = resolved
    envelope.commentThreads[index].updatedAt = currentTimeMilliseconds()
    markChanged()
  }

  public func deleteCommentThread(threadID: String) throws {
    guard let index = envelope.commentThreads.firstIndex(where: { $0.id == threadID }) else {
      throw DraftHarbourError.missingCommentThread(threadID)
    }
    envelope.commentThreads.remove(at: index)
    markChanged()
  }

  public func applyMarkdownWrap(prefix: String, suffix: String, range: NSRange) {
    guard var content = activeSection?.content, let activeSectionID else { return }
    let safeRange = boundedRange(range, in: content)
    guard let stringRange = Range(safeRange, in: content) else { return }
    content.replaceSubrange(stringRange, with: "\(prefix)\(content[stringRange])\(suffix)")
    updateSection(id: activeSectionID) { section in
      section.content = content
    }
  }

  public func insertMarkdownLine(prefix: String, range: NSRange) {
    guard var content = activeSection?.content, let activeSectionID else { return }
    let safeRange = boundedRange(range, in: content)
    guard let stringRange = Range(safeRange, in: content) else { return }
    let lineStart = content[..<stringRange.lowerBound].lastIndex(of: "\n").map { content.index(after: $0) } ?? content.startIndex
    content.insert(contentsOf: prefix, at: lineStart)
    updateSection(id: activeSectionID) { section in
      section.content = content
    }
  }

  public func replaceInActiveSection(query: String, replacement: String, caseSensitive: Bool = false) -> Int {
    guard var content = activeSection?.content, let activeSectionID, !query.isEmpty else { return 0 }
    let options: String.CompareOptions = caseSensitive ? [] : [.caseInsensitive]
    var count = 0
    while let range = content.range(of: query, options: options) {
      content.replaceSubrange(range, with: replacement)
      count += 1
    }
    if count > 0 {
      updateSection(id: activeSectionID) { section in
        section.content = content
      }
    }
    return count
  }

  public func applyMarkdownCommand(_ command: MarkdownTextCommand, range: NSRange) {
    guard let content = activeSection?.content, let activeSectionID else { return }
    let updated = TextWorkflowServices.apply(command, to: content, range: range)
    guard updated != content else { return }
    updateSection(id: activeSectionID) { section in
      section.content = updated
    }
  }

  public func applyGeneratedText(_ incoming: String, mode: PipelineInsertionMode, range: NSRange? = nil) {
    guard var content = activeSection?.content, let activeSectionID else { return }
    let trimmed = incoming.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }

    if let range, range.length > 0 {
      let safeRange = boundedRange(range, in: content)
      guard let stringRange = Range(safeRange, in: content) else { return }
      let selected = String(content[stringRange])
      let replacement: String
      switch mode {
      case .replace:
        replacement = trimmed
      case .append:
        replacement = AIWorkflowServices.applyInsertionMode(base: selected, incoming: trimmed, mode: .append)
      case .sideBySide:
        replacement = AIWorkflowServices.applyInsertionMode(base: selected, incoming: trimmed, mode: .sideBySide)
      }
      content.replaceSubrange(stringRange, with: replacement)
    } else {
      content = AIWorkflowServices.applyInsertionMode(base: content, incoming: trimmed, mode: mode)
    }

    updateSection(id: activeSectionID) { section in
      section.content = content
    }
  }

  @discardableResult
  public func addCharacter(name: String) -> CharacterEntity {
    let character = CharacterEntity(novelId: envelope.project.id, name: name)
    envelope.characters.append(character)
    markChanged()
    return character
  }

  @discardableResult
  public func addWorldEntry(name: String, category: String = "other") -> WorldEntry {
    let entry = WorldEntry(novelId: envelope.project.id, category: category, name: name)
    envelope.worldEntries.append(entry)
    markChanged()
    return entry
  }

  public func updateCharacter(id: String, update: (inout CharacterEntity) -> Void) {
    guard let index = envelope.characters.firstIndex(where: { $0.id == id }) else { return }
    update(&envelope.characters[index])
    envelope.characters[index].updatedAt = currentTimeMilliseconds()
    markChanged()
  }

  public func updateWorldEntry(id: String, update: (inout WorldEntry) -> Void) {
    guard let index = envelope.worldEntries.firstIndex(where: { $0.id == id }) else { return }
    update(&envelope.worldEntries[index])
    envelope.worldEntries[index].updatedAt = currentTimeMilliseconds()
    markChanged()
  }

  public func deleteCharacter(id: String) {
    envelope.characters.removeAll { $0.id == id }
    for index in envelope.worldEntries.indices {
      envelope.worldEntries[index].linkedCharacters.removeAll { $0 == id }
    }
    markChanged()
  }

  public func deleteWorldEntry(id: String) {
    envelope.worldEntries.removeAll { $0.id == id }
    markChanged()
  }

  public func updateIntegration(_ config: IntegrationConfig) {
    var integrations = envelope.integrations ?? [:]
    integrations[config.type] = config
    envelope.integrations = integrations
    markChanged()
  }

  public func integrationConfig(for type: IntegrationType) -> IntegrationConfig {
    envelope.integrations?[type] ?? IntegrationConfig(type: type)
  }

  public func applySyncResult(_ result: IntegrationResult) {
    if let pulledEnvelope = result.pulledEnvelope {
      envelope = DhprojCodec.normalize(pulledEnvelope)
      activeSectionID = envelope.sections.first(where: { $0.id == activeSectionID })?.id ?? envelope.sections.first?.id
    }
    var config = result.updatedConfig ?? integrationConfig(for: result.provider)
    config.status = result.conflicts.isEmpty ? result.message : "\(result.conflicts.count) conflict(s)"
    config.lastSyncAt = currentTimeMilliseconds()
    updateIntegration(config)
  }

  public func resolveConflict(_ conflict: ConflictInfo, option: ConflictResolutionOption) {
    guard let index = envelope.sections.firstIndex(where: { $0.id == conflict.chapterId }) else { return }
    let resolved = SyncMergeEngine.resolve(conflict, option: option, localSection: envelope.sections[index])
    envelope.sections.remove(at: index)
    envelope.sections.insert(contentsOf: resolved, at: index)
    renumberSections()
    activeSectionID = resolved.first?.id ?? activeSectionID
    markChanged()
  }

  public func updateProgress(wordsWritten: Int, date: String? = nil) {
    recordWritingSession(wordsWritten: wordsWritten, date: date)
  }

  @discardableResult
  public func startWritingSession(startedAt: Int64 = currentTimeMilliseconds()) -> WritingSessionState {
    if let writingSession {
      return writingSession
    }

    let session = WritingSessionState(startedAt: startedAt, startingWordCount: metrics.totalWords)
    writingSession = session
    return session
  }

  @discardableResult
  public func stopWritingSession(date: String? = nil, endedAt: Int64 = currentTimeMilliseconds()) -> WritingSessionResult? {
    guard let session = writingSession else { return nil }
    let date = date ?? Self.todayString()
    let endingWordCount = metrics.totalWords
    let wordsWritten = max(0, endingWordCount - session.startingWordCount)
    writingSession = nil
    recordWritingSession(wordsWritten: wordsWritten, date: date)
    return WritingSessionResult(
      session: session,
      endedAt: endedAt,
      endingWordCount: endingWordCount,
      wordsWritten: wordsWritten,
      date: date
    )
  }

  public func cancelWritingSession() {
    writingSession = nil
  }

  public func progress(for date: String) -> DailyProgress? {
    envelope.progress?.dailyHistory.first { $0.date == date }
  }

  public func recordWritingSession(wordsWritten: Int, date: String? = nil) {
    let date = date ?? ProjectStore.todayString()
    var progress = envelope.progress ?? ProgressData()
    let currentWords = metrics.totalWords
    let delta = max(0, wordsWritten)
    if let index = progress.dailyHistory.firstIndex(where: { $0.date == date }) {
      progress.dailyHistory[index].wordsWritten += delta
      progress.dailyHistory[index].wordsAtStart = min(progress.dailyHistory[index].wordsAtStart, max(0, currentWords - progress.dailyHistory[index].wordsWritten))
      progress.dailyHistory[index].goalMet = dailyWordTarget > 0 && progress.dailyHistory[index].wordsWritten >= dailyWordTarget
      progress.dailyHistory[index].sessions += 1
    } else {
      progress.dailyHistory.append(
        DailyProgress(
          date: date,
          wordsWritten: delta,
          wordsAtStart: max(0, currentWords - delta),
          goalMet: dailyWordTarget > 0 && delta >= dailyWordTarget,
          sessions: 1
        )
      )
      progress.streak = Self.nextWritingStreak(previous: progress.streak, newDate: date)
    }
    progress.totalSessions += 1
    progress.totalWordsAllTime = max(progress.totalWordsAllTime + delta, currentWords)
    if progress.streak.lastActiveDate.isEmpty {
      progress.streak = WritingStreak(current: 1, longest: max(1, progress.streak.longest), lastActiveDate: date)
    }
    envelope.progress = progress
    recordGoalTrendSnapshot(date: date, wordsToday: progress.dailyHistory.first { $0.date == date }?.wordsWritten ?? 0)
    markChanged()
  }

  public func recordGoalTrendSnapshot(date: String = ProjectStore.todayString(), wordsToday: Int? = nil) {
    let dailyGoal = dailyWordTarget
    let words = wordsToday ?? progress(for: date)?.wordsWritten ?? 0
    let snapshot: JSONValue = .object([
      "date": .string(date),
      "wordsToday": .number(Double(words)),
      "dailyGoal": .number(Double(dailyGoal)),
      "goalMet": .bool(dailyGoal > 0 && words >= dailyGoal)
    ])
    envelope.goalTrends.removeAll {
      guard case .object(let object) = $0,
            case .string(let existingDate) = object["date"] else {
        return false
      }
      return existingDate == date
    }
    envelope.goalTrends.append(snapshot)
    if envelope.goalTrends.count > 30 {
      envelope.goalTrends = Array(envelope.goalTrends.suffix(30))
    }
  }

  public func recordExport(_ exported: ExportedFile, format: ExportFormat, validationIssues: [ExportValidationIssue] = []) {
    envelope.exportHistory.insert(
      ExportHistoryRecord(
        format: format,
        filename: exported.filename,
        sectionCount: envelope.sections.count,
        wordCount: metrics.totalWords,
        validationIssues: validationIssues
      ),
      at: 0
    )
    markChanged()
  }

  public func recordAIRevision(sectionID: String, providerId: String, prompt: String, before: String, after: String) {
    envelope.aiRevisionLog.insert(
      AIRevisionRecord(sectionId: sectionID, providerId: providerId, prompt: prompt, before: before, after: after),
      at: 0
    )
    markChanged()
  }

  public func upsertAIProvider(_ config: AIProviderConfig) {
    if let index = envelope.aiProviders.firstIndex(where: { $0.id == config.id || $0.label == config.label }) {
      envelope.aiProviders[index] = config
    } else {
      envelope.aiProviders.append(config)
    }
    markChanged()
  }

  public func diagnosticsSummary() -> [String: JSONValue] {
    [
      "projectId": .string(envelope.project.id),
      "projectType": .string(envelope.projectType.rawValue),
      "sectionCount": .number(Double(envelope.sections.count)),
      "snapshotCount": .number(Double(envelope.snapshots.count)),
      "commentThreadCount": .number(Double(envelope.commentThreads.count)),
      "totalWords": .number(Double(metrics.totalWords))
    ]
  }

  public static func todayString(date: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  private static func nextWritingStreak(previous: WritingStreak, newDate: String) -> WritingStreak {
    guard previous.lastActiveDate != newDate else {
      return previous
    }

    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "yyyy-MM-dd"

    guard let previousDate = formatter.date(from: previous.lastActiveDate),
          let currentDate = formatter.date(from: newDate),
          let dayDelta = formatter.calendar.dateComponents([.day], from: previousDate, to: currentDate).day else {
      return WritingStreak(current: 1, longest: max(1, previous.longest), lastActiveDate: newDate)
    }

    let current = dayDelta == 1 ? previous.current + 1 : 1
    return WritingStreak(current: current, longest: max(previous.longest, current), lastActiveDate: newDate)
  }

  private func updateSection(id: String, update: (inout Section) -> Void) {
    guard let index = envelope.sections.firstIndex(where: { $0.id == id }) else { return }
    update(&envelope.sections[index])
    envelope.sections[index].updatedAt = currentTimeMilliseconds()
    markChanged()
  }

  private func renumberSections() {
    for index in envelope.sections.indices {
      envelope.sections[index].order = index
      envelope.sections[index].novelId = envelope.project.id
    }
  }

  private func applySectionOrder(_ ids: [String]) {
    let byId = Dictionary(uniqueKeysWithValues: envelope.sections.map { ($0.id, $0) })
    let ordered = ids.compactMap { byId[$0] }
    guard ordered.count == envelope.sections.count else { return }
    envelope.sections = ordered
    renumberSections()
    markChanged()
  }

  private func markChanged() {
    envelope.project.updatedAt = currentTimeMilliseconds()
    revision += 1
  }

  private func boundedRange(_ range: NSRange, in text: String) -> NSRange {
    let count = (text as NSString).length
    let location = min(max(0, range.location), count)
    let length = min(max(0, range.length), count - location)
    return NSRange(location: location, length: length)
  }
}
