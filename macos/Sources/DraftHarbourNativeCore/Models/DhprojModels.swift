import Foundation

public enum ProjectType: String, Codable, CaseIterable, Sendable {
  case book
  case screenplay
}

public enum ChapterStatus: String, Codable, CaseIterable, Sendable {
  case planned
  case draft
  case revised
  case final
}

public enum ScreenplayBlockType: String, Codable, CaseIterable, Sendable {
  case sceneHeading = "scene-heading"
  case action
  case character
  case parenthetical
  case dialogue
  case transition
}

public struct DhprojManifest: Codable, Equatable, Sendable {
  public var format: String
  public var version: Int
  public var appVersion: String
  public var createdAt: String
  public var exportOptions: ExportOptions?

  public init(
    format: String = "dhproj",
    version: Int = 1,
    appVersion: String = "native-0.1.0",
    createdAt: String = ISO8601DateFormatter().string(from: Date()),
    exportOptions: ExportOptions? = nil
  ) {
    self.format = format
    self.version = version
    self.appVersion = appVersion
    self.createdAt = createdAt
    self.exportOptions = exportOptions
  }
}

public struct ExportOptions: Codable, Equatable, Sendable {
  public var includeSnapshots: Bool?
  public var includeIntegrationArtifacts: Bool?

  public init(includeSnapshots: Bool? = true, includeIntegrationArtifacts: Bool? = false) {
    self.includeSnapshots = includeSnapshots
    self.includeIntegrationArtifacts = includeIntegrationArtifacts
  }
}

public struct Project: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var title: String
  public var projectType: ProjectType?
  public var updatedAt: Int64

  public init(id: String = makeIdentifier(), title: String, projectType: ProjectType = .book, updatedAt: Int64 = currentTimeMilliseconds()) {
    self.id = id
    self.title = title
    self.projectType = projectType
    self.updatedAt = updatedAt
  }
}

public struct Scene: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var title: String
  public var summary: String
  public var pov: String
  public var status: ChapterStatus
  public var tags: [String]
  public var wordGoal: Int
  public var slugLine: String?
  public var location: String?
  public var interiorExterior: String?
  public var timeOfDay: String?
  public var pageEstimate: Double?
  public var productionTags: [String]?

  public init(
    id: String = makeIdentifier(),
    title: String,
    summary: String = "",
    pov: String = "",
    status: ChapterStatus = .planned,
    tags: [String] = [],
    wordGoal: Int = 0,
    slugLine: String? = nil,
    location: String? = nil,
    interiorExterior: String? = nil,
    timeOfDay: String? = nil,
    pageEstimate: Double? = nil,
    productionTags: [String]? = nil
  ) {
    self.id = id
    self.title = title
    self.summary = summary
    self.pov = pov
    self.status = status
    self.tags = tags
    self.wordGoal = wordGoal
    self.slugLine = slugLine
    self.location = location
    self.interiorExterior = interiorExterior
    self.timeOfDay = timeOfDay
    self.pageEstimate = pageEstimate
    self.productionTags = productionTags
  }
}

public struct ChapterSyncMetadata: Codable, Equatable, Sendable {
  public var providerRevisionIds: [IntegrationType: String]
  public var lastPushedHash: String?
  public var lastPulledAt: Int64?
  public var lastSyncedContent: String?

  public init(
    providerRevisionIds: [IntegrationType: String] = [:],
    lastPushedHash: String? = nil,
    lastPulledAt: Int64? = nil,
    lastSyncedContent: String? = nil
  ) {
    self.providerRevisionIds = providerRevisionIds
    self.lastPushedHash = lastPushedHash
    self.lastPulledAt = lastPulledAt
    self.lastSyncedContent = lastSyncedContent
  }
}

public struct Section: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var novelId: String
  public var order: Int
  public var title: String
  public var updatedAt: Int64
  public var content: String?
  public var summary: String
  public var pov: String
  public var status: ChapterStatus
  public var tags: [String]
  public var wordGoal: Int
  public var scenes: [Scene]
  public var part: String?
  public var act: Int?
  public var sequence: Int?
  public var sync: ChapterSyncMetadata?

  public init(
    id: String = makeIdentifier(),
    novelId: String,
    order: Int,
    title: String,
    updatedAt: Int64 = currentTimeMilliseconds(),
    content: String? = nil,
    summary: String = "",
    pov: String = "",
    status: ChapterStatus = .planned,
    tags: [String] = [],
    wordGoal: Int = 0,
    scenes: [Scene] = [],
    part: String? = nil,
    act: Int? = nil,
    sequence: Int? = nil,
    sync: ChapterSyncMetadata? = ChapterSyncMetadata()
  ) {
    self.id = id
    self.novelId = novelId
    self.order = order
    self.title = title
    self.updatedAt = updatedAt
    self.content = content
    self.summary = summary
    self.pov = pov
    self.status = status
    self.tags = tags
    self.wordGoal = wordGoal
    self.scenes = scenes
    self.part = part
    self.act = act
    self.sequence = sequence
    self.sync = sync
  }
}

public struct Snapshot: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var chapterId: String
  public var createdAt: Int64
  public var doc: String
  public var label: String?

  public init(id: String = makeIdentifier(), chapterId: String, createdAt: Int64 = currentTimeMilliseconds(), doc: String, label: String? = nil) {
    self.id = id
    self.chapterId = chapterId
    self.createdAt = createdAt
    self.doc = doc
    self.label = label
  }
}

public struct CommentAnchorRange: Codable, Equatable, Sendable {
  public var from: Int
  public var to: Int
  public var length: Int
  public var selectedText: String?

  public init(from: Int, to: Int, length: Int, selectedText: String? = nil) {
    self.from = from
    self.to = to
    self.length = length
    self.selectedText = selectedText
  }
}

public struct Comment: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var text: String
  public var author: String
  public var createdAt: Int64

  public init(id: String = makeIdentifier(), text: String, author: String = "Author", createdAt: Int64 = currentTimeMilliseconds()) {
    self.id = id
    self.text = text
    self.author = author
    self.createdAt = createdAt
  }
}

public struct CommentReply: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var text: String
  public var author: String
  public var createdAt: Int64

  public init(id: String = makeIdentifier(), text: String, author: String = "Author", createdAt: Int64 = currentTimeMilliseconds()) {
    self.id = id
    self.text = text
    self.author = author
    self.createdAt = createdAt
  }
}

public struct CommentThread: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var chapterId: String
  public var anchor: CommentAnchorRange
  public var resolved: Bool
  public var createdAt: Int64
  public var updatedAt: Int64
  public var comments: [Comment]

  public init(
    id: String = makeIdentifier(),
    chapterId: String,
    anchor: CommentAnchorRange,
    resolved: Bool = false,
    createdAt: Int64 = currentTimeMilliseconds(),
    updatedAt: Int64 = currentTimeMilliseconds(),
    comments: [Comment] = []
  ) {
    self.id = id
    self.chapterId = chapterId
    self.anchor = anchor
    self.resolved = resolved
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.comments = comments
  }
}

public struct CharacterVoiceProfile: Codable, Equatable, Sendable {
  public var characterId: String
  public var sampleCount: Int
  public var updatedAt: Int64
  public var fingerprint: VoiceFingerprint?

  public init(characterId: String, sampleCount: Int = 0, updatedAt: Int64 = currentTimeMilliseconds(), fingerprint: VoiceFingerprint? = nil) {
    self.characterId = characterId
    self.sampleCount = sampleCount
    self.updatedAt = updatedAt
    self.fingerprint = fingerprint
  }
}

public struct CharacterEntity: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var novelId: String
  public var name: String
  public var aliases: [String]
  public var description: String
  public var role: String
  public var traits: [String]
  public var notes: String
  public var relationships: [CharacterRelationship]
  public var createdAt: Int64
  public var updatedAt: Int64
  public var voiceProfile: CharacterVoiceProfile?

  public init(
    id: String = makeIdentifier(),
    novelId: String,
    name: String,
    aliases: [String] = [],
    description: String = "",
    role: String = "other",
    traits: [String] = [],
    notes: String = "",
    relationships: [CharacterRelationship] = [],
    createdAt: Int64 = currentTimeMilliseconds(),
    updatedAt: Int64 = currentTimeMilliseconds(),
    voiceProfile: CharacterVoiceProfile? = nil
  ) {
    self.id = id
    self.novelId = novelId
    self.name = name
    self.aliases = aliases
    self.description = description
    self.role = role
    self.traits = traits
    self.notes = notes
    self.relationships = relationships
    self.createdAt = createdAt
    self.updatedAt = updatedAt
    self.voiceProfile = voiceProfile
  }
}

public struct CharacterRelationship: Codable, Equatable, Sendable {
  public var targetId: String
  public var type: String

  public init(targetId: String, type: String) {
    self.targetId = targetId
    self.type = type
  }
}

public struct WorldEntry: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var novelId: String
  public var category: String
  public var name: String
  public var description: String
  public var tags: [String]
  public var linkedCharacters: [String]
  public var notes: String
  public var createdAt: Int64
  public var updatedAt: Int64

  public init(
    id: String = makeIdentifier(),
    novelId: String,
    category: String = "other",
    name: String,
    description: String = "",
    tags: [String] = [],
    linkedCharacters: [String] = [],
    notes: String = "",
    createdAt: Int64 = currentTimeMilliseconds(),
    updatedAt: Int64 = currentTimeMilliseconds()
  ) {
    self.id = id
    self.novelId = novelId
    self.category = category
    self.name = name
    self.description = description
    self.tags = tags
    self.linkedCharacters = linkedCharacters
    self.notes = notes
    self.createdAt = createdAt
    self.updatedAt = updatedAt
  }
}

public struct DhprojEnvelope: Codable, Equatable, Sendable {
  public var manifest: DhprojManifest
  public var project: Project
  public var projectType: ProjectType
  public var sections: [Section]
  public var snapshots: [Snapshot]
  public var commentThreads: [CommentThread]
  public var settings: AppSettings
  public var goalTrends: [JSONValue]
  public var progress: ProgressData?
  public var integrations: [IntegrationType: IntegrationConfig]?
  public var characters: [CharacterEntity]
  public var worldEntries: [WorldEntry]
  public var storyBlueprint: StoryBlueprint?
  public var exportHistory: [ExportHistoryRecord]
  public var aiProviders: [AIProviderConfig]
  public var aiRevisionLog: [AIRevisionRecord]

  enum CodingKeys: String, CodingKey {
    case manifest
    case project
    case projectType
    case sections
    case snapshots
    case commentThreads
    case settings
    case goalTrends
    case progress
    case integrations
    case characters
    case worldEntries
    case storyBlueprint
    case exportHistory
    case aiProviders
    case aiRevisionLog
  }

  public init(
    manifest: DhprojManifest = DhprojManifest(),
    project: Project,
    projectType: ProjectType,
    sections: [Section],
    snapshots: [Snapshot] = [],
    commentThreads: [CommentThread] = [],
    settings: AppSettings = AppSettings(),
    goalTrends: [JSONValue] = [],
    progress: ProgressData? = nil,
    integrations: [IntegrationType: IntegrationConfig]? = nil,
    characters: [CharacterEntity] = [],
    worldEntries: [WorldEntry] = [],
    storyBlueprint: StoryBlueprint? = nil,
    exportHistory: [ExportHistoryRecord] = [],
    aiProviders: [AIProviderConfig] = [],
    aiRevisionLog: [AIRevisionRecord] = []
  ) {
    self.manifest = manifest
    self.project = project
    self.projectType = projectType
    self.sections = sections.sorted { $0.order < $1.order }
    self.snapshots = snapshots
    self.commentThreads = commentThreads
    self.settings = settings
    self.goalTrends = goalTrends
    self.progress = progress
    self.integrations = integrations
    self.characters = characters
    self.worldEntries = worldEntries
    self.storyBlueprint = storyBlueprint
    self.exportHistory = exportHistory
    self.aiProviders = aiProviders
    self.aiRevisionLog = aiRevisionLog
  }

  public init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    manifest = try container.decodeIfPresent(DhprojManifest.self, forKey: .manifest) ?? DhprojManifest()
    project = try container.decode(Project.self, forKey: .project)
    let decodedType = try container.decodeIfPresent(ProjectType.self, forKey: .projectType)
    projectType = decodedType ?? project.projectType ?? .book
    sections = try container.decodeIfPresent([Section].self, forKey: .sections) ?? []
    snapshots = try container.decodeIfPresent([Snapshot].self, forKey: .snapshots) ?? []
    commentThreads = try container.decodeIfPresent([CommentThread].self, forKey: .commentThreads) ?? []
    settings = try container.decodeIfPresent(AppSettings.self, forKey: .settings) ?? AppSettings()
    goalTrends = try container.decodeIfPresent([JSONValue].self, forKey: .goalTrends) ?? []
    progress = try container.decodeIfPresent(ProgressData.self, forKey: .progress)
    integrations = try container.decodeIfPresent([IntegrationType: IntegrationConfig].self, forKey: .integrations)
    characters = try container.decodeIfPresent([CharacterEntity].self, forKey: .characters) ?? []
    worldEntries = try container.decodeIfPresent([WorldEntry].self, forKey: .worldEntries) ?? []
    storyBlueprint = try container.decodeIfPresent(StoryBlueprint.self, forKey: .storyBlueprint)
    exportHistory = try container.decodeIfPresent([ExportHistoryRecord].self, forKey: .exportHistory) ?? []
    aiProviders = try container.decodeIfPresent([AIProviderConfig].self, forKey: .aiProviders) ?? []
    aiRevisionLog = try container.decodeIfPresent([AIRevisionRecord].self, forKey: .aiRevisionLog) ?? []
    sections.sort { $0.order < $1.order }
  }
}
