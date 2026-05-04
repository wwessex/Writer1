import Foundation
import UniformTypeIdentifiers

public extension UTType {
  static let dhproj = UTType(exportedAs: "com.draftharbour.project", conformingTo: .json)
}

public enum DraftHarbourError: LocalizedError, Equatable {
  case unsupportedFormat(String)
  case unsupportedVersion(Int)
  case missingProject
  case missingSection(String)
  case missingSnapshot(String)
  case missingCommentThread(String)
  case invalidSelection
  case featurePlanned(String)
  case providerNotConfigured(String)
  case keychainFailure(OSStatus)

  public var errorDescription: String? {
    switch self {
    case .unsupportedFormat(let format):
      return "Unsupported DraftHarbour format: \(format)"
    case .unsupportedVersion(let version):
      return "Unsupported DraftHarbour project version: \(version)"
    case .missingProject:
      return "The project file does not contain a project."
    case .missingSection(let id):
      return "Section not found: \(id)"
    case .missingSnapshot(let id):
      return "Snapshot not found: \(id)"
    case .missingCommentThread(let id):
      return "Comment thread not found: \(id)"
    case .invalidSelection:
      return "No section is selected."
    case .featurePlanned(let feature):
      return "\(feature) is part of the native parity roadmap but is not implemented yet."
    case .providerNotConfigured(let provider):
      return "\(provider) is not configured."
    case .keychainFailure(let status):
      return "Keychain operation failed with status \(status)."
    }
  }
}

public func currentTimeMilliseconds() -> Int64 {
  Int64(Date().timeIntervalSince1970 * 1000)
}

public func makeIdentifier() -> String {
  UUID().uuidString.lowercased()
}
