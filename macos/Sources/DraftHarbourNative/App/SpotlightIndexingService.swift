import CoreSpotlight
import DraftHarbourNativeCore
import Foundation
import UniformTypeIdentifiers

enum SpotlightIndexingService {
  static func index(envelope: DhprojEnvelope, fileURL: URL?) {
    let domain = "draftharbour.project.\(envelope.project.id)"
    var items: [CSSearchableItem] = []

    let projectAttributes = CSSearchableItemAttributeSet(contentType: .text)
    projectAttributes.title = envelope.project.title
    projectAttributes.contentDescription = "DraftHarbour \(envelope.projectType.rawValue) project"
    projectAttributes.keywords = ["DraftHarbour", envelope.projectType.rawValue]
    projectAttributes.url = fileURL
    items.append(CSSearchableItem(uniqueIdentifier: "draftharbour://project/\(envelope.project.id)", domainIdentifier: domain, attributeSet: projectAttributes))

    for section in envelope.sections {
      let attributes = CSSearchableItemAttributeSet(contentType: .text)
      attributes.title = section.title
      attributes.contentDescription = [section.summary, MarkdownTools.plainText(from: section.content ?? "")]
        .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
        .joined(separator: "\n\n")
      attributes.keywords = section.tags + [envelope.project.title, envelope.projectType.rawValue]
      attributes.url = fileURL
      items.append(CSSearchableItem(uniqueIdentifier: "draftharbour://project/\(envelope.project.id)/section/\(section.id)", domainIdentifier: domain, attributeSet: attributes))
    }

    CSSearchableIndex.default().indexSearchableItems(items)
  }
}
