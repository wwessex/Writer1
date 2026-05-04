import Foundation

public enum DhprojCodec {
  public static let currentAppVersion = "native-0.1.0"

  public static func decode(_ data: Data) throws -> DhprojEnvelope {
    let decoder = JSONDecoder()
    let envelope = try decoder.decode(DhprojEnvelope.self, from: data)

    guard envelope.manifest.format == "dhproj" else {
      throw DraftHarbourError.unsupportedFormat(envelope.manifest.format)
    }

    guard envelope.manifest.version == 1 else {
      throw DraftHarbourError.unsupportedVersion(envelope.manifest.version)
    }

    return normalize(envelope)
  }

  public static func encode(_ envelope: DhprojEnvelope, prettyPrinted: Bool = true) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = prettyPrinted ? [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes] : [.withoutEscapingSlashes]
    return try encoder.encode(normalize(envelope))
  }

  public static func normalize(_ envelope: DhprojEnvelope) -> DhprojEnvelope {
    var normalized = envelope
    let projectType = normalized.project.projectType ?? normalized.projectType
    normalized.projectType = projectType
    normalized.project.projectType = projectType
    normalized.sections = normalized.sections
      .enumerated()
      .map { index, section in
        var copy = section
        copy.novelId = normalized.project.id
        copy.order = index
        return copy
      }
      .sorted { $0.order < $1.order }
    return normalized
  }

  public static func newProject(title: String = "Untitled Project", projectType: ProjectType = .book) -> DhprojEnvelope {
    let project = Project(title: title, projectType: projectType)
    let firstTitle = projectType == .screenplay ? "Scene 1" : "Chapter 1"
    let firstSection = Section(
      novelId: project.id,
      order: 0,
      title: firstTitle,
      content: ""
    )

    return DhprojEnvelope(
      manifest: DhprojManifest(appVersion: currentAppVersion, exportOptions: ExportOptions()),
      project: project,
      projectType: projectType,
      sections: [firstSection]
    )
  }
}
