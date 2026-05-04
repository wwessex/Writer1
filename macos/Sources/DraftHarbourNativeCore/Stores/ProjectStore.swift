import Foundation
import Observation

@Observable
public final class ProjectStore {
  public var envelope: DhprojEnvelope
  public var activeSectionID: String?
  public private(set) var revision: Int = 0

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

  public func selectSection(_ id: String?) {
    activeSectionID = id
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

  public func updateActiveSectionStatus(_ status: ChapterStatus) {
    guard let activeSectionID else { return }
    updateSection(id: activeSectionID) { section in
      section.status = status
    }
  }

  public func moveSections(from source: IndexSet, to destination: Int) {
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

  @discardableResult
  public func createSnapshot(label: String? = "Manual") throws -> Snapshot {
    guard let section = activeSection else { throw DraftHarbourError.invalidSelection }
    let snapshot = Snapshot(chapterId: section.id, doc: section.content ?? "", label: label)
    envelope.snapshots.insert(snapshot, at: 0)
    markChanged()
    return snapshot
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

  public func addCharacter(name: String) {
    envelope.characters.append(CharacterEntity(novelId: envelope.project.id, name: name))
    markChanged()
  }

  public func addWorldEntry(name: String, category: String = "other") {
    envelope.worldEntries.append(WorldEntry(novelId: envelope.project.id, category: category, name: name))
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

  private func markChanged() {
    envelope.project.updatedAt = currentTimeMilliseconds()
    revision += 1
  }
}
