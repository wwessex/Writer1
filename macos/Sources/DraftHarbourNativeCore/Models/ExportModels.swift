import AppKit
import Foundation

public enum ExportProfile: String, Codable, CaseIterable, Sendable {
  case submission
  case ebook
  case print
  case custom
}

public enum ManuscriptLocale: String, Codable, CaseIterable, Sendable {
  case enUS = "en-US"
  case enGB = "en-GB"
}

public enum ManuscriptPageSize: String, Codable, CaseIterable, Sendable {
  case letter = "LETTER"
  case a4 = "A4"

  public var dimensions: CGSize {
    switch self {
    case .letter:
      return CGSize(width: 612, height: 792)
    case .a4:
      return CGSize(width: 595.2, height: 841.8)
    }
  }
}

public enum ManuscriptTextAlignment: String, Codable, CaseIterable, Sendable {
  case left
  case center
  case right
  case justified

  public var nsAlignment: NSTextAlignment {
    switch self {
    case .left:
      return .left
    case .center:
      return .center
    case .right:
      return .right
    case .justified:
      return .justified
    }
  }
}

public struct ManuscriptHeaderContent: Codable, Equatable, Sendable {
  public var authorSurname: String
  public var shortTitle: String

  public init(authorSurname: String = "", shortTitle: String = "") {
    self.authorSurname = authorSurname
    self.shortTitle = shortTitle
  }
}

public struct ManuscriptExportOptions: Codable, Equatable, Sendable {
  public var profile: ExportProfile
  public var locale: ManuscriptLocale
  public var fontFamily: String
  public var fontSizePt: Double
  public var lineSpacing: Double
  public var paragraphSpacingBeforePt: Double
  public var paragraphSpacingAfterPt: Double
  public var alignment: ManuscriptTextAlignment
  public var firstLineIndentIn: Double
  public var pageSize: ManuscriptPageSize
  public var marginIn: Double
  public var pageNumbering: Bool
  public var headerContent: ManuscriptHeaderContent
  public var chapterStartsNewPage: Bool
  public var sceneBreakMarker: String
  public var includeHeadings: Bool
  public var includeTitlePage: Bool
  public var authorName: String

  public init(
    profile: ExportProfile = .submission,
    locale: ManuscriptLocale = .enUS,
    fontFamily: String = "Times New Roman",
    fontSizePt: Double = 12,
    lineSpacing: Double = 2,
    paragraphSpacingBeforePt: Double = 0,
    paragraphSpacingAfterPt: Double = 0,
    alignment: ManuscriptTextAlignment = .left,
    firstLineIndentIn: Double = 0.5,
    pageSize: ManuscriptPageSize = .letter,
    marginIn: Double = 1,
    pageNumbering: Bool = true,
    headerContent: ManuscriptHeaderContent = ManuscriptHeaderContent(),
    chapterStartsNewPage: Bool = true,
    sceneBreakMarker: String = "* * *",
    includeHeadings: Bool = true,
    includeTitlePage: Bool = true,
    authorName: String = ""
  ) {
    self.profile = profile
    self.locale = locale
    self.fontFamily = fontFamily
    self.fontSizePt = fontSizePt
    self.lineSpacing = lineSpacing
    self.paragraphSpacingBeforePt = paragraphSpacingBeforePt
    self.paragraphSpacingAfterPt = paragraphSpacingAfterPt
    self.alignment = alignment
    self.firstLineIndentIn = firstLineIndentIn
    self.pageSize = pageSize
    self.marginIn = marginIn
    self.pageNumbering = pageNumbering
    self.headerContent = headerContent
    self.chapterStartsNewPage = chapterStartsNewPage
    self.sceneBreakMarker = sceneBreakMarker
    self.includeHeadings = includeHeadings
    self.includeTitlePage = includeTitlePage
    self.authorName = authorName
  }

  public static func defaults(profile: ExportProfile, locale: ManuscriptLocale) -> ManuscriptExportOptions {
    let pageSize: ManuscriptPageSize = locale == .enGB ? .a4 : .letter
    var options = ManuscriptExportOptions(profile: profile, locale: locale, pageSize: pageSize)
    switch profile {
    case .submission:
      break
    case .ebook:
      options.lineSpacing = 1.5
    case .print:
      options.lineSpacing = 1.5
      options.alignment = .justified
    case .custom:
      break
    }
    return options
  }
}

public enum FountainFilenameConvention: String, Codable, CaseIterable, Sendable {
  case title
  case titleScreenplay = "title-screenplay"
  case titleFountain = "title-fountain"
}

public struct FountainExportOptions: Codable, Equatable, Sendable {
  public var includeSectionTitles: Bool
  public var includeMetadataBlock: Bool
  public var filenameConvention: FountainFilenameConvention

  public init(
    includeSectionTitles: Bool = true,
    includeMetadataBlock: Bool = true,
    filenameConvention: FountainFilenameConvention = .title
  ) {
    self.includeSectionTitles = includeSectionTitles
    self.includeMetadataBlock = includeMetadataBlock
    self.filenameConvention = filenameConvention
  }
}

public struct ExportRequest: Codable, Equatable, Sendable {
  public var format: ExportFormat
  public var presetID: String?
  public var includeHeadings: Bool
  public var manuscriptOptions: ManuscriptExportOptions?
  public var fountainOptions: FountainExportOptions?

  public init(
    format: ExportFormat,
    presetID: String? = nil,
    includeHeadings: Bool = true,
    manuscriptOptions: ManuscriptExportOptions? = nil,
    fountainOptions: FountainExportOptions? = nil
  ) {
    self.format = format
    self.presetID = presetID
    self.includeHeadings = includeHeadings
    self.manuscriptOptions = manuscriptOptions
    self.fountainOptions = fountainOptions
  }
}

public struct ExportPreset: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var name: String
  public var description: String
  public var format: ExportFormat
  public var includeHeadings: Bool
  public var projectTypes: [ProjectType]
  public var profile: ExportProfile?
  public var locale: ManuscriptLocale?
  public var fountainOptions: FountainExportOptions?

  public init(
    id: String,
    name: String,
    description: String,
    format: ExportFormat,
    includeHeadings: Bool,
    projectTypes: [ProjectType],
    profile: ExportProfile? = nil,
    locale: ManuscriptLocale? = nil,
    fountainOptions: FountainExportOptions? = nil
  ) {
    self.id = id
    self.name = name
    self.description = description
    self.format = format
    self.includeHeadings = includeHeadings
    self.projectTypes = projectTypes
    self.profile = profile
    self.locale = locale
    self.fountainOptions = fountainOptions
  }

  public func request(authorName: String = "", authorSurname: String = "", shortTitle: String = "") -> ExportRequest {
    var manuscriptOptions: ManuscriptExportOptions?
    if let profile {
      var defaults = ManuscriptExportOptions.defaults(profile: profile, locale: locale ?? .enUS)
      defaults.authorName = authorName
      defaults.headerContent = ManuscriptHeaderContent(authorSurname: authorSurname, shortTitle: shortTitle)
      defaults.includeHeadings = includeHeadings
      manuscriptOptions = defaults
    }

    return ExportRequest(
      format: format,
      presetID: id,
      includeHeadings: includeHeadings,
      manuscriptOptions: manuscriptOptions,
      fountainOptions: fountainOptions
    )
  }
}

public enum ExportPresetCatalog {
  public static let presets: [ExportPreset] = [
    ExportPreset(
      id: "submission-us",
      name: "US Manuscript Submission",
      description: "DOCX, Times New Roman 12pt, double-spaced, US Letter, headers, title page.",
      format: .docx,
      includeHeadings: true,
      projectTypes: [.book],
      profile: .submission,
      locale: .enUS
    ),
    ExportPreset(
      id: "submission-uk",
      name: "UK Manuscript Submission",
      description: "DOCX, Times New Roman 12pt, double-spaced, A4, headers, title page.",
      format: .docx,
      includeHeadings: true,
      projectTypes: [.book],
      profile: .submission,
      locale: .enGB
    ),
    ExportPreset(
      id: "reading-copy",
      name: "Reading Copy (PDF)",
      description: "Clean PDF with headings for beta readers and self-review.",
      format: .pdf,
      includeHeadings: true,
      projectTypes: [.book]
    ),
    ExportPreset(
      id: "print-ready",
      name: "Print-Ready PDF",
      description: "PDF with print margins and justified text.",
      format: .pdf,
      includeHeadings: true,
      projectTypes: [.book],
      profile: .print,
      locale: .enUS
    ),
    ExportPreset(
      id: "plain-text",
      name: "Plain Export (RTF)",
      description: "Simple RTF without chapter headings.",
      format: .rtf,
      includeHeadings: false,
      projectTypes: [.book]
    ),
    ExportPreset(
      id: "screenplay-pdf",
      name: "Industry Screenplay",
      description: "Standard screenplay PDF using Courier 12pt layout.",
      format: .screenplayPdf,
      includeHeadings: true,
      projectTypes: [.screenplay]
    ),
    ExportPreset(
      id: "fountain-full",
      name: "Full Fountain Export",
      description: "Fountain with metadata block and section titles.",
      format: .fountain,
      includeHeadings: true,
      projectTypes: [.screenplay],
      fountainOptions: FountainExportOptions(includeSectionTitles: true, includeMetadataBlock: true, filenameConvention: .title)
    ),
    ExportPreset(
      id: "archive-docx",
      name: "Archive Copy",
      description: "Full DOCX backup with chapter headings.",
      format: .docx,
      includeHeadings: true,
      projectTypes: [.book, .screenplay]
    ),
    ExportPreset(
      id: "markdown",
      name: "Markdown Export",
      description: "Clean Markdown with chapter headings.",
      format: .markdown,
      includeHeadings: true,
      projectTypes: [.book, .screenplay]
    ),
    ExportPreset(
      id: "publishing-bundle",
      name: "Publishing Bundle",
      description: "Metadata JSON and marketing copy payload for launch workflows.",
      format: .publishingBundle,
      includeHeadings: true,
      projectTypes: [.book]
    ),
    ExportPreset(
      id: "plain-text-file",
      name: "Plain Text File",
      description: "Simple text file with no rich formatting.",
      format: .plainText,
      includeHeadings: true,
      projectTypes: [.book, .screenplay]
    )
  ]

  public static func presets(for projectType: ProjectType) -> [ExportPreset] {
    presets.filter { $0.projectTypes.contains(projectType) }
  }
}
