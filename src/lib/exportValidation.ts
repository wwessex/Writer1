/**
 * Manuscript export validation engine.
 *
 * Validates export settings and document structure against
 * industry-standard manuscript formatting rules, organised by
 * export profile (submission, ebook, print) and severity.
 */

import type {
  Chapter,
  ExportFormat,
  ExportProfile,
  ExportValidationResult,
  ExportValidationRule,
  ManuscriptExportOptions,
  ManuscriptLocale,
  ManuscriptPageSize,
  ValidationSeverity,
} from '@/types';
import { editorToPlainText, countWords } from '@/lib/utils';

// ── Profile defaults ──

const SUBMISSION_DEFAULTS: ManuscriptExportOptions = {
  profile: 'submission',
  locale: 'en-US',
  fontFamily: 'Times New Roman',
  fontSizePt: 12,
  lineSpacing: 2.0,
  paragraphSpacingBeforePt: 0,
  paragraphSpacingAfterPt: 0,
  alignment: 'left',
  firstLineIndentIn: 0.5,
  pageSize: 'LETTER',
  marginIn: 1,
  pageNumbering: true,
  headerContent: { authorSurname: '', shortTitle: '' },
  chapterStartsNewPage: true,
  sceneBreakMarker: '* * *',
  includeHeadings: true,
  includeTitlePage: true,
  authorName: '',
};

export function getProfileDefaults(
  profile: ExportProfile,
  locale: ManuscriptLocale,
): ManuscriptExportOptions {
  const pageSize: ManuscriptPageSize = locale === 'en-GB' ? 'A4' : 'LETTER';

  switch (profile) {
    case 'submission':
      return { ...SUBMISSION_DEFAULTS, locale, pageSize };
    case 'ebook':
      return {
        ...SUBMISSION_DEFAULTS,
        profile: 'ebook',
        locale,
        pageSize,
        lineSpacing: 1.5,
        includeTitlePage: true,
        chapterStartsNewPage: true,
      };
    case 'print':
      return {
        ...SUBMISSION_DEFAULTS,
        profile: 'print',
        locale,
        pageSize,
        lineSpacing: 1.5,
        alignment: 'justified',
        includeTitlePage: true,
      };
    case 'custom':
    default:
      return { ...SUBMISSION_DEFAULTS, profile: 'custom', locale, pageSize };
  }
}

// ── Validation rules ──

const RULES: ExportValidationRule[] = [
  // Submission manuscript rules
  {
    id: 'SM-FILETYPE-001',
    severity: 'error',
    description: 'Export must produce DOCX, PDF, or RTF for submission.',
    profile: 'submission',
  },
  {
    id: 'SM-TYPO-001',
    severity: 'warning',
    description: 'Font size should be at least 12pt for readability.',
    profile: 'submission',
  },
  {
    id: 'SM-SPACING-001',
    severity: 'warning',
    description: 'Double spacing (2.0) is recommended for submission manuscripts.',
    profile: 'submission',
  },
  {
    id: 'SM-SPACING-002',
    severity: 'error',
    description: 'No extra space between paragraphs; use first-line indents instead.',
    profile: 'submission',
  },
  {
    id: 'SM-PAGINATION-001',
    severity: 'error',
    description: 'Pages must be numbered continuously.',
    profile: 'submission',
  },
  {
    id: 'SM-HEADER-001',
    severity: 'warning',
    description: 'Header should include author surname and abbreviated title.',
    profile: 'submission',
  },
  {
    id: 'SM-STRUCT-001',
    severity: 'error',
    description: 'Chapters must start on a new page in submission profile.',
    profile: 'submission',
  },
  {
    id: 'SM-STRUCT-002',
    severity: 'warning',
    description: 'Manuscript should contain at least one chapter with content.',
    profile: 'all',
  },
  {
    id: 'SM-MARGIN-001',
    severity: 'warning',
    description: 'Margins should be approximately 1 inch (2.54 cm).',
    profile: 'submission',
  },
  {
    id: 'SM-INDENT-001',
    severity: 'warning',
    description: 'First-line indent of approximately 0.5 inches is standard.',
    profile: 'submission',
  },
  {
    id: 'SM-TITLE-001',
    severity: 'info',
    description: 'A title page with author name is recommended for submissions.',
    profile: 'submission',
  },
  // Print rules
  {
    id: 'PX-PAGESIZE-001',
    severity: 'warning',
    description: 'Print exports should use a standard page size (A4 or US Letter).',
    profile: 'print',
  },
];

function matchesProfile(rule: ExportValidationRule, profile: ExportProfile): boolean {
  return rule.profile === 'all' || rule.profile === profile;
}

/**
 * Run validation rules against the current export options and chapters.
 */
export function validateExport(
  options: ManuscriptExportOptions,
  chapters: Chapter[],
  format: ExportFormat,
): ExportValidationResult[] {
  const results: ExportValidationResult[] = [];

  const applicableRules = RULES.filter(r => matchesProfile(r, options.profile));

  for (const rule of applicableRules) {
    const result = evaluateRule(rule, options, chapters, format);
    results.push(result);
  }

  return results;
}

function evaluateRule(
  rule: ExportValidationRule,
  opts: ManuscriptExportOptions,
  chapters: Chapter[],
  format: ExportFormat,
): ExportValidationResult {
  const base: Pick<ExportValidationResult, 'ruleId' | 'severity'> = {
    ruleId: rule.id,
    severity: rule.severity,
  };

  switch (rule.id) {
    case 'SM-FILETYPE-001': {
      const allowed: ExportFormat[] = ['docx', 'pdf', 'rtf'];
      const passed = allowed.includes(format);
      return {
        ...base,
        passed,
        message: passed
          ? 'Export format is acceptable for submission.'
          : `Format "${format}" is not standard for submission. Use DOCX, PDF, or RTF.`,
      };
    }

    case 'SM-TYPO-001':
      return {
        ...base,
        passed: opts.fontSizePt >= 12,
        message: opts.fontSizePt >= 12
          ? 'Font size meets minimum readability threshold.'
          : `Font size ${opts.fontSizePt}pt is below the recommended 12pt minimum.`,
      };

    case 'SM-SPACING-001':
      return {
        ...base,
        passed: opts.lineSpacing === 2.0,
        message: opts.lineSpacing === 2.0
          ? 'Double spacing is set.'
          : `Line spacing is ${opts.lineSpacing}. Double spacing (2.0) is the standard default.`,
      };

    case 'SM-SPACING-002':
      return {
        ...base,
        passed: opts.paragraphSpacingBeforePt === 0 && opts.paragraphSpacingAfterPt === 0,
        message:
          opts.paragraphSpacingBeforePt === 0 && opts.paragraphSpacingAfterPt === 0
            ? 'No extra paragraph spacing; using indents.'
            : 'Extra paragraph spacing detected. Submission manuscripts should use first-line indents, not paragraph spacing.',
      };

    case 'SM-PAGINATION-001':
      return {
        ...base,
        passed: opts.pageNumbering,
        message: opts.pageNumbering
          ? 'Continuous page numbering is enabled.'
          : 'Page numbering is disabled. Submissions require numbered pages.',
      };

    case 'SM-HEADER-001': {
      const hasHeader =
        !!opts.headerContent.authorSurname && !!opts.headerContent.shortTitle;
      return {
        ...base,
        passed: hasHeader,
        message: hasHeader
          ? 'Header includes author surname and short title.'
          : 'Header is missing author surname or short title. Many agents expect these in the page header.',
      };
    }

    case 'SM-STRUCT-001':
      return {
        ...base,
        passed: opts.chapterStartsNewPage,
        message: opts.chapterStartsNewPage
          ? 'Chapters start on new pages.'
          : 'Chapters do not start on new pages. This is expected for submission manuscripts.',
      };

    case 'SM-STRUCT-002': {
      const hasContent = chapters.some(ch => {
        const text = editorToPlainText(ch.content);
        return countWords(text) > 0;
      });
      return {
        ...base,
        passed: hasContent,
        message: hasContent
          ? 'Manuscript contains content.'
          : 'No chapters with content found. Add content before exporting.',
      };
    }

    case 'SM-MARGIN-001':
      return {
        ...base,
        passed: opts.marginIn >= 0.75 && opts.marginIn <= 1.25,
        message:
          opts.marginIn >= 0.75 && opts.marginIn <= 1.25
            ? 'Margins are within standard range.'
            : `Margin of ${opts.marginIn}" is outside the standard range (0.75"–1.25").`,
      };

    case 'SM-INDENT-001':
      return {
        ...base,
        passed: opts.firstLineIndentIn >= 0.3 && opts.firstLineIndentIn <= 0.5,
        message:
          opts.firstLineIndentIn >= 0.3 && opts.firstLineIndentIn <= 0.5
            ? 'First-line indent is within standard range.'
            : `First-line indent of ${opts.firstLineIndentIn}" is outside the standard range (0.3"–0.5").`,
      };

    case 'SM-TITLE-001':
      return {
        ...base,
        passed: opts.includeTitlePage && !!opts.authorName,
        message:
          opts.includeTitlePage && !!opts.authorName
            ? 'Title page with author name is included.'
            : 'Consider adding a title page with your name for agent/editor submissions.',
      };

    case 'PX-PAGESIZE-001':
      return {
        ...base,
        passed: opts.pageSize === 'A4' || opts.pageSize === 'LETTER',
        message: 'Page size is a standard format.',
      };

    default:
      return {
        ...base,
        passed: true,
        message: rule.description,
      };
  }
}

/**
 * Returns only failed validations, sorted by severity (errors first).
 */
export function getValidationIssues(
  results: ExportValidationResult[],
): ExportValidationResult[] {
  const order: Record<ValidationSeverity, number> = { error: 0, warning: 1, info: 2 };
  return results
    .filter(r => !r.passed)
    .sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Quick check: does the validation contain any errors (hard blockers)?
 */
export function hasValidationErrors(results: ExportValidationResult[]): boolean {
  return results.some(r => !r.passed && r.severity === 'error');
}
