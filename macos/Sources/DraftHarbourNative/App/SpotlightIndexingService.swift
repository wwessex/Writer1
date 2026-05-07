import CoreSpotlight
import DraftHarbourNativeCore
import Foundation
import UniformTypeIdentifiers

extension SpotlightIndexingService {
  static func index(envelope: DhprojEnvelope, fileURL: URL?, level: SpotlightIndexingLevel) {
    let domain = domainIdentifier(projectID: envelope.project.id)
    let payload = items(for: envelope, fileURL: fileURL, level: level)
    CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [domain]) { _ in
      guard !payload.isEmpty else { return }
      CSSearchableIndex.default().indexSearchableItems(payload.map(searchableItem(from:)))
    }
  }

  static func clear(projectID: String) {
    CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [domainIdentifier(projectID: projectID)])
  }

  private static func searchableItem(from item: SpotlightIndexedItem) -> CSSearchableItem {
    let attributes = CSSearchableItemAttributeSet(contentType: .text)
    attributes.title = item.title
    attributes.contentDescription = item.contentDescription
    attributes.keywords = item.keywords
    attributes.url = item.url
    return CSSearchableItem(
      uniqueIdentifier: item.uniqueIdentifier,
      domainIdentifier: item.domainIdentifier,
      attributeSet: attributes
    )
  }
}
