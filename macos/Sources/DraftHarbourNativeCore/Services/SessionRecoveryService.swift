import Foundation

public struct RecoverySnapshot: Codable, Equatable, Sendable {
  public var projectId: String
  public var activeSectionID: String?
  public var savedAt: Int64
  public var sourceURL: String?
  public var envelope: DhprojEnvelope

  public init(projectId: String, activeSectionID: String?, savedAt: Int64 = currentTimeMilliseconds(), sourceURL: String? = nil, envelope: DhprojEnvelope) {
    self.projectId = projectId
    self.activeSectionID = activeSectionID
    self.savedAt = savedAt
    self.sourceURL = sourceURL
    self.envelope = envelope
  }
}

public struct SessionRecoveryService {
  public var baseDirectory: URL
  public var fileManager: FileManager
  public var defaults: UserDefaults

  private static let recentProjectURLsKey = "DraftHarbour.recentProjectURLs"
  private static let pinnedProjectURLsKey = "DraftHarbour.pinnedProjectURLs"

  public init(baseDirectory: URL? = nil, fileManager: FileManager = .default, defaults: UserDefaults = .standard) {
    if let baseDirectory {
      self.baseDirectory = baseDirectory
    } else {
      self.baseDirectory = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)
        .first?
        .appendingPathComponent("DraftHarbourNative", isDirectory: true)
        .appendingPathComponent("Recovery", isDirectory: true)
        ?? fileManager.temporaryDirectory.appendingPathComponent("DraftHarbourNative-Recovery", isDirectory: true)
    }
    self.fileManager = fileManager
    self.defaults = defaults
  }

  public func save(envelope: DhprojEnvelope, activeSectionID: String?, sourceURL: URL? = nil) throws -> RecoverySnapshot {
    try fileManager.createDirectory(at: baseDirectory, withIntermediateDirectories: true)
    let snapshot = RecoverySnapshot(
      projectId: envelope.project.id,
      activeSectionID: activeSectionID,
      sourceURL: sourceURL?.path,
      envelope: DhprojCodec.normalize(envelope)
    )
    let data = try JSONEncoder().encode(snapshot)
    try data.write(to: recoveryURL(projectId: envelope.project.id), options: .atomic)
    return snapshot
  }

  public func load(projectId: String) throws -> RecoverySnapshot? {
    let url = recoveryURL(projectId: projectId)
    guard fileManager.fileExists(atPath: url.path) else { return nil }
    return try JSONDecoder().decode(RecoverySnapshot.self, from: Data(contentsOf: url))
  }

  public func clear(projectId: String) throws {
    let url = recoveryURL(projectId: projectId)
    guard fileManager.fileExists(atPath: url.path) else { return }
    try fileManager.removeItem(at: url)
  }

  public func shouldOfferRestore(_ snapshot: RecoverySnapshot, documentURL: URL?) -> Bool {
    guard let documentURL else { return true }
    let modified = (try? fileManager.attributesOfItem(atPath: documentURL.path)[.modificationDate] as? Date) ?? .distantPast
    return snapshot.savedAt > Int64(modified.timeIntervalSince1970 * 1000)
  }

  public func recoveryURL(projectId: String) -> URL {
    baseDirectory.appendingPathComponent("\(projectId).recovery.json")
  }

  public func recordLastOpenedProjectURL(_ url: URL, limit: Int = 10) {
    let path = url.standardizedFileURL.path
    var paths = defaults.stringArray(forKey: Self.recentProjectURLsKey) ?? []
    paths.removeAll { $0 == path }
    paths.insert(path, at: 0)
    defaults.set(Array(paths.prefix(limit)), forKey: Self.recentProjectURLsKey)
  }

  public func recentProjectURLs() -> [URL] {
    (defaults.stringArray(forKey: Self.recentProjectURLsKey) ?? []).map { URL(fileURLWithPath: $0) }
  }

  public func removeRecentProjectURL(_ url: URL) {
    let path = url.standardizedFileURL.path
    var paths = defaults.stringArray(forKey: Self.recentProjectURLsKey) ?? []
    paths.removeAll { $0 == path }
    defaults.set(paths, forKey: Self.recentProjectURLsKey)
    unpinProjectURL(url)
  }

  public func pinProjectURL(_ url: URL) {
    let path = url.standardizedFileURL.path
    var paths = defaults.stringArray(forKey: Self.pinnedProjectURLsKey) ?? []
    paths.removeAll { $0 == path }
    paths.insert(path, at: 0)
    defaults.set(paths, forKey: Self.pinnedProjectURLsKey)
  }

  public func unpinProjectURL(_ url: URL) {
    let path = url.standardizedFileURL.path
    var paths = defaults.stringArray(forKey: Self.pinnedProjectURLsKey) ?? []
    paths.removeAll { $0 == path }
    defaults.set(paths, forKey: Self.pinnedProjectURLsKey)
  }

  public func toggleProjectPin(_ url: URL) {
    isProjectPinned(url) ? unpinProjectURL(url) : pinProjectURL(url)
  }

  public func isProjectPinned(_ url: URL) -> Bool {
    let path = url.standardizedFileURL.path
    return (defaults.stringArray(forKey: Self.pinnedProjectURLsKey) ?? []).contains(path)
  }

  public func pinnedProjectURLs() -> [URL] {
    (defaults.stringArray(forKey: Self.pinnedProjectURLsKey) ?? []).map { URL(fileURLWithPath: $0) }
  }

  @discardableResult
  public func pruneMissingRecentProjectURLs() -> [URL] {
    let existing = recentProjectURLs().filter { fileManager.fileExists(atPath: $0.path) }
    defaults.set(existing.map { $0.standardizedFileURL.path }, forKey: Self.recentProjectURLsKey)
    let existingSet = Set(existing.map { $0.standardizedFileURL.path })
    let pinned = pinnedProjectURLs().filter { existingSet.contains($0.standardizedFileURL.path) }
    defaults.set(pinned.map { $0.standardizedFileURL.path }, forKey: Self.pinnedProjectURLsKey)
    return existing
  }

  public func recordActiveSectionID(_ id: String?, projectId: String) {
    let key = activeSectionKey(projectId: projectId)
    if let id {
      defaults.set(id, forKey: key)
    } else {
      defaults.removeObject(forKey: key)
    }
  }

  public func activeSectionID(projectId: String) -> String? {
    defaults.string(forKey: activeSectionKey(projectId: projectId))
  }

  private func activeSectionKey(projectId: String) -> String {
    "DraftHarbour.activeSection.\(projectId)"
  }
}
