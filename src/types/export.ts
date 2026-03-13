export type ExportFormat = 'docx' | 'pdf' | 'screenplayPdf' | 'rtf' | 'fountain' | 'markdown' | 'txt' | 'publishingBundle';

// ── Manuscript export profiles & options ──

export type ManuscriptLocale = 'en-GB' | 'en-US';

export type ExportProfile = 'submission' | 'ebook' | 'print' | 'custom';

export type ManuscriptPageSize = 'A4' | 'LETTER';

export interface ManuscriptExportOptions {
  profile: ExportProfile;
  locale: ManuscriptLocale;
  fontFamily: string;
  fontSizePt: number;
  lineSpacing: number;
  paragraphSpacingBeforePt: number;
  paragraphSpacingAfterPt: number;
  alignment: 'left' | 'center' | 'right' | 'justified';
  firstLineIndentIn: number;
  pageSize: ManuscriptPageSize;
  marginIn: number;
  pageNumbering: boolean;
  headerContent: { authorSurname: string; shortTitle: string };
  chapterStartsNewPage: boolean;
  sceneBreakMarker: string;
  includeHeadings: boolean;
  includeTitlePage: boolean;
  authorName: string;
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ExportValidationRule {
  id: string;
  severity: ValidationSeverity;
  description: string;
  profile: ExportProfile | 'all';
}

export interface ExportValidationResult {
  ruleId: string;
  severity: ValidationSeverity;
  message: string;
  passed: boolean;
}
