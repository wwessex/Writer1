import Foundation

public enum SpotlightIndexingLevel: String, Codable, CaseIterable, Identifiable, Sendable {
  case off
  case metadataOnly = "metadata-only"
  case fullText = "full-text"

  public var id: String { rawValue }

  public init(storageValue: String?) {
    switch storageValue {
    case SpotlightIndexingLevel.off.rawValue:
      self = .off
    case SpotlightIndexingLevel.fullText.rawValue:
      self = .fullText
    case SpotlightIndexingLevel.metadataOnly.rawValue, nil:
      self = .metadataOnly
    default:
      self = .metadataOnly
    }
  }

  public var title: String {
    switch self {
    case .off:
      return "Off"
    case .metadataOnly:
      return "Metadata Only"
    case .fullText:
      return "Full Text"
    }
  }
}

public struct SpotlightIndexedItem: Equatable, Identifiable, Sendable {
  public var id: String { uniqueIdentifier }
  public var uniqueIdentifier: String
  public var domainIdentifier: String
  public var title: String
  public var contentDescription: String
  public var keywords: [String]
  public var url: URL?

  public init(
    uniqueIdentifier: String,
    domainIdentifier: String,
    title: String,
    contentDescription: String,
    keywords: [String],
    url: URL?
  ) {
    self.uniqueIdentifier = uniqueIdentifier
    self.domainIdentifier = domainIdentifier
    self.title = title
    self.contentDescription = contentDescription
    self.keywords = keywords
    self.url = url
  }
}

public enum SpotlightIndexingService {
  public static func domainIdentifier(projectID: String) -> String {
    "draftharbour.project.\(projectID)"
  }

  public static func items(
    for envelope: DhprojEnvelope,
    fileURL: URL?,
    level: SpotlightIndexingLevel
  ) -> [SpotlightIndexedItem] {
    guard level != .off else { return [] }

    let domain = domainIdentifier(projectID: envelope.project.id)
    var items: [SpotlightIndexedItem] = [
      SpotlightIndexedItem(
        uniqueIdentifier: NativeDeepLink(projectID: envelope.project.id).url?.absoluteString ?? "draftharbour://project/\(envelope.project.id)",
        domainIdentifier: domain,
        title: envelope.project.title,
        contentDescription: "DraftHarbour \(envelope.projectType.rawValue) project",
        keywords: compactKeywords(["DraftHarbour", envelope.projectType.rawValue, envelope.project.title]),
        url: fileURL
      )
    ]

    for section in envelope.sections {
      let description: String
      switch level {
      case .off:
        description = ""
      case .metadataOnly:
        description = "\(envelope.projectType.rawValue.capitalized) section"
      case .fullText:
        description = [section.summary, MarkdownTools.plainText(from: section.content ?? "")]
          .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
          .joined(separator: "\n\n")
      }

      items.append(SpotlightIndexedItem(
        uniqueIdentifier: NativeDeepLink(projectID: envelope.project.id, sectionID: section.id).url?.absoluteString ?? "draftharbour://project/\(envelope.project.id)/section/\(section.id)",
        domainIdentifier: domain,
        title: section.title,
        contentDescription: description,
        keywords: compactKeywords(section.tags + [section.title, envelope.project.title, envelope.projectType.rawValue]),
        url: fileURL
      ))
    }

    return items
  }

  private static func compactKeywords(_ values: [String]) -> [String] {
    var seen: Set<String> = []
    return values
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
      .filter { value in
        let key = value.lowercased()
        if seen.contains(key) {
          return false
        }
        seen.insert(key)
        return true
      }
  }
}
