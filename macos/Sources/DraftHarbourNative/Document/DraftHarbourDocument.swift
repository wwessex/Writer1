import DraftHarbourNativeCore
import Foundation
import SwiftUI
import UniformTypeIdentifiers

struct DraftHarbourDocument: FileDocument {
  static var readableContentTypes: [UTType] { [.dhproj] }
  static var writableContentTypes: [UTType] { [.dhproj] }

  var envelope: DhprojEnvelope

  init(envelope: DhprojEnvelope = DhprojCodec.newProject(title: "Untitled Project")) {
    self.envelope = envelope
  }

  init(configuration: ReadConfiguration) throws {
    guard let data = configuration.file.regularFileContents else {
      throw CocoaError(.fileReadCorruptFile)
    }
    envelope = try DhprojCodec.decode(data)
  }

  func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
    let data = try DhprojCodec.encode(envelope)
    return FileWrapper(regularFileWithContents: data)
  }
}
