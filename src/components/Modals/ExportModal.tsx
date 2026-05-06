import { useState, useMemo, useCallback } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import { useApp } from '@/context/AppContext';
import type { ExportFormat, ExportProfile, ManuscriptLocale, ManuscriptExportOptions } from '@/types';
import { exportToDocx, exportToPdf, exportToRtf, exportToFountain, exportToScreenplayPdf, exportToMarkdown, exportToPlainText, exportPublishingBundle } from '@/lib/export';
import type { FountainExportOptions } from '@/lib/export';
import { getProfileDefaults, validateExport, getValidationIssues, hasValidationErrors } from '@/lib/exportValidation';
import { recordExport } from '@/lib/exportHistory';
import { countWords, editorToPlainText } from '@/lib/utils';
import styles from './Modals.module.css';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

// ---- Export Presets ----

interface ExportPreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  format: ExportFormat;
  includeHeadings: boolean;
  projectTypes: ('book' | 'screenplay')[];
  fountainOptions?: Partial<FountainExportOptions>;
  profile?: ExportProfile;
}

const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'submission-us',
    name: 'US Manuscript Submission',
    icon: 'send',
    description: 'Industry-standard DOCX: Times New Roman 12pt, double-spaced, US Letter, headers, title page.',
    format: 'docx',
    includeHeadings: true,
    projectTypes: ['book'],
    profile: 'submission',
  },
  {
    id: 'submission-uk',
    name: 'UK Manuscript Submission',
    icon: 'send',
    description: 'Industry-standard DOCX: Times New Roman 12pt, double-spaced, A4, headers, title page.',
    format: 'docx',
    includeHeadings: true,
    projectTypes: ['book'],
    profile: 'submission',
  },
  {
    id: 'reading-copy',
    name: 'Reading Copy (PDF)',
    icon: 'menu_book',
    description: 'Clean PDF with headings for beta readers and self-review.',
    format: 'pdf',
    includeHeadings: true,
    projectTypes: ['book'],
  },
  {
    id: 'print-ready',
    name: 'Print-Ready PDF',
    icon: 'print',
    description: 'PDF with embedded fonts, proper margins, justified text for print-on-demand.',
    format: 'pdf',
    includeHeadings: true,
    projectTypes: ['book'],
    profile: 'print',
  },
  {
    id: 'plain-text',
    name: 'Plain Export (RTF)',
    icon: 'text_snippet',
    description: 'Simple RTF without chapter headings, for compatibility.',
    format: 'rtf',
    includeHeadings: false,
    projectTypes: ['book'],
  },
  {
    id: 'screenplay-pdf',
    name: 'Industry Screenplay',
    icon: 'movie',
    description: 'Standard screenplay PDF format (Courier 12pt, proper margins).',
    format: 'screenplayPdf',
    includeHeadings: true,
    projectTypes: ['screenplay'],
  },
  {
    id: 'fountain-full',
    name: 'Full Fountain Export',
    icon: 'theaters',
    description: 'Fountain format with metadata block and section titles.',
    format: 'fountain',
    includeHeadings: true,
    projectTypes: ['screenplay'],
    fountainOptions: { includeSectionTitles: true, includeMetadataBlock: true, filenameConvention: 'title' },
  },
  {
    id: 'archive-docx',
    name: 'Archive Copy',
    icon: 'inventory_2',
    description: 'Full DOCX backup with all chapter headings for archiving.',
    format: 'docx',
    includeHeadings: true,
    projectTypes: ['book', 'screenplay'],
  },
  {
    id: 'markdown',
    name: 'Markdown Export',
    icon: 'code',
    description: 'Clean Markdown with chapter headings, ideal for GitHub, blogs, or static site generators.',
    format: 'markdown',
    includeHeadings: true,
    projectTypes: ['book', 'screenplay'],
  },
  {
    id: 'publishing-bundle',
    name: 'Publishing Bundle',
    icon: 'inventory_2',
    description: 'Manuscript + metadata JSON/TXT + marketing copy files for launch workflows.',
    format: 'publishingBundle',
    includeHeadings: true,
    projectTypes: ['book'],
  },
  {
    id: 'plain-text-file',
    name: 'Plain Text File',
    icon: 'text_snippet',
    description: 'Simple .txt file with no formatting, maximum compatibility.',
    format: 'txt',
    includeHeadings: true,
    projectTypes: ['book', 'screenplay'],
  },
];

type ExportTab = 'presets' | 'manuscript' | 'custom' | 'publishing';

interface ExportActionOptions {
  includeHeadings?: boolean;
  fountainOptions?: Partial<FountainExportOptions>;
}

export function ExportModal({ open, onClose }: ExportModalProps) {
  const { state } = useApp();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<ExportTab>('presets');

  // Manuscript settings
  const [profile, setProfile] = useState<ExportProfile>('submission');
  const [locale, setLocale] = useState<ManuscriptLocale>('en-US');
  const [authorName, setAuthorName] = useState('');
  const [authorSurname, setAuthorSurname] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [manuscriptFormat, setManuscriptFormat] = useState<ExportFormat>('docx');
  const [fontSizePt, setFontSizePt] = useState(12);
  const [lineSpacing, setLineSpacing] = useState(2.0);
  const [firstLineIndentIn, setFirstLineIndentIn] = useState(0.5);
  const [marginIn, setMarginIn] = useState(1.0);
  const [alignment, setAlignment] = useState<ManuscriptExportOptions['alignment']>('left');
  const [chapterStartsNewPage, setChapterStartsNewPage] = useState(true);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [pageNumbering, setPageNumbering] = useState(true);
  const [sceneBreakMarker, setSceneBreakMarker] = useState('* * *');

  // Custom export settings
  const [includeHeadings, setIncludeHeadings] = useState(true);
  const [includeSectionTitles, setIncludeSectionTitles] = useState(true);
  const [includeMetadataBlock, setIncludeMetadataBlock] = useState(true);
  const [filenameConvention, setFilenameConvention] = useState<FountainExportOptions['filenameConvention']>('title');
  const [includeKdpTemplate, setIncludeKdpTemplate] = useState(true);
  const [bookDescription, setBookDescription] = useState('');
  const [shortSynopsis, setShortSynopsis] = useState('');
  const [longSynopsis, setLongSynopsis] = useState('');
  const [authorBioShort, setAuthorBioShort] = useState('');
  const [authorBioLong, setAuthorBioLong] = useState('');
  const [keywordSuggestions, setKeywordSuggestions] = useState('');
  const [categorySuggestions, setCategorySuggestions] = useState('');
  const [backCoverCopy, setBackCoverCopy] = useState('');
  const [hookLines, setHookLines] = useState('');

  const isScreenplay = state.projectType === 'screenplay';

  const FORMAT_LABELS: Record<ExportFormat, string> = {
    docx: 'DOCX',
    pdf: 'PDF',
    screenplayPdf: 'Screenplay PDF',
    rtf: 'RTF',
    fountain: 'Fountain',
    markdown: 'Markdown',
    txt: 'Plain Text',
    publishingBundle: 'Publishing Bundle',
  };

  const totalWords = state.chapters.reduce((sum, ch) => sum + countWords(editorToPlainText(ch.content)), 0);

  // Build current manuscript options from state
  const buildManuscriptOptions = useCallback((): ManuscriptExportOptions => {
    const defaults = getProfileDefaults(profile, locale);
    return {
      ...defaults,
      fontSizePt,
      lineSpacing,
      firstLineIndentIn,
      marginIn,
      alignment,
      chapterStartsNewPage,
      includeTitlePage,
      pageNumbering,
      sceneBreakMarker,
      authorName,
      headerContent: { authorSurname, shortTitle },
      includeHeadings: true,
    };
  }, [profile, locale, fontSizePt, lineSpacing, firstLineIndentIn, marginIn,
    alignment, chapterStartsNewPage, includeTitlePage, pageNumbering,
    sceneBreakMarker, authorName, authorSurname, shortTitle]);

  // Validation results for manuscript tab
  const validationResults = useMemo(() => {
    if (activeTab !== 'manuscript') return [];
    const opts = buildManuscriptOptions();
    return validateExport(opts, state.chapters, manuscriptFormat);
  }, [activeTab, buildManuscriptOptions, state.chapters, manuscriptFormat]);

  const validationIssues = useMemo(() => getValidationIssues(validationResults), [validationResults]);
  const hasErrors = useMemo(() => hasValidationErrors(validationResults), [validationResults]);

  // Apply profile defaults when profile or locale changes
  const handleProfileChange = (newProfile: ExportProfile) => {
    setProfile(newProfile);
    const defaults = getProfileDefaults(newProfile, locale);
    setFontSizePt(defaults.fontSizePt);
    setLineSpacing(defaults.lineSpacing);
    setFirstLineIndentIn(defaults.firstLineIndentIn);
    setMarginIn(defaults.marginIn);
    setAlignment(defaults.alignment);
    setChapterStartsNewPage(defaults.chapterStartsNewPage);
    setIncludeTitlePage(defaults.includeTitlePage);
    setPageNumbering(defaults.pageNumbering);
    setSceneBreakMarker(defaults.sceneBreakMarker);
  };

  const handleLocaleChange = (newLocale: ManuscriptLocale) => {
    setLocale(newLocale);
    const defaults = getProfileDefaults(profile, newLocale);
    setMarginIn(defaults.marginIn);
  };

  const handleExport = async (
    format: ExportFormat,
    presetId?: string,
    manuscriptOpts?: ManuscriptExportOptions,
    exportOptions: ExportActionOptions = {},
  ) => {
    const resolvedIncludeHeadings = exportOptions.includeHeadings ?? includeHeadings;
    const resolvedFountainOptions = {
      includeSectionTitles: exportOptions.fountainOptions?.includeSectionTitles ?? includeSectionTitles,
      includeMetadataBlock: exportOptions.fountainOptions?.includeMetadataBlock ?? includeMetadataBlock,
      filenameConvention: exportOptions.fountainOptions?.filenameConvention ?? filenameConvention,
    };

    setExporting(true);
    try {
      switch (format) {
        case 'docx':
          await exportToDocx(state.chapters, state.novelTitle, resolvedIncludeHeadings, manuscriptOpts);
          break;
        case 'pdf':
          await exportToPdf(state.chapters, state.novelTitle, resolvedIncludeHeadings, manuscriptOpts);
          break;
        case 'screenplayPdf':
          await exportToScreenplayPdf(state.chapters, state.novelTitle);
          break;
        case 'fountain':
          await exportToFountain(state.chapters, state.novelTitle, resolvedFountainOptions);
          break;
        case 'rtf':
          await exportToRtf(state.chapters, state.novelTitle, resolvedIncludeHeadings, manuscriptOpts);
          break;
        case 'markdown':
          await exportToMarkdown(state.chapters, state.novelTitle, resolvedIncludeHeadings);
          break;
        case 'txt':
          await exportToPlainText(state.chapters, state.novelTitle, resolvedIncludeHeadings);
          break;
        case 'publishingBundle':
          await exportPublishingBundle(state.chapters, state.novelTitle, {
            includeHeadings: resolvedIncludeHeadings,
            includeKdpTemplate,
            manuscriptFormat: 'docx',
            data: {
              bookDescription,
              shortSynopsis,
              longSynopsis,
              authorBioShort,
              authorBioLong,
              keywordSuggestions: keywordSuggestions.split(',').map(item => item.trim()).filter(Boolean),
              categorySuggestions: categorySuggestions.split(/[;,]/).map(item => item.trim()).filter(Boolean),
              backCoverCopy,
              hookLines: hookLines.split('\n').map(item => item.trim()).filter(Boolean),
            },
          });
          break;
      }

      // Record to export history
      const safeTitle = state.novelTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      recordExport({
        format,
        filename: `${safeTitle}.${format === 'screenplayPdf' ? 'pdf' : format === 'markdown' ? 'md' : format === 'publishingBundle' ? 'bundle' : format}`,
        novelTitle: state.novelTitle,
        chapterCount: state.chapters.length,
        wordCount: totalWords,
        preset: presetId,
      });

      showToast(`Exported ${FORMAT_LABELS[format]} successfully`, 'success', 'download_done');
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      showToast(`${FORMAT_LABELS[format]} export failed. Please try again.`, 'error', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePresetExport = async (preset: ExportPreset) => {
    let manuscriptOpts: ManuscriptExportOptions | undefined;

    if (preset.profile) {
      const presetLocale: ManuscriptLocale = preset.id.includes('-uk') ? 'en-GB' : 'en-US';
      manuscriptOpts = getProfileDefaults(preset.profile, presetLocale);
      manuscriptOpts.authorName = authorName;
      manuscriptOpts.headerContent = { authorSurname, shortTitle: shortTitle || state.novelTitle.substring(0, 30) };
    }

    if (preset.fountainOptions) {
      setIncludeSectionTitles(preset.fountainOptions.includeSectionTitles ?? true);
      setIncludeMetadataBlock(preset.fountainOptions.includeMetadataBlock ?? true);
      if (preset.fountainOptions.filenameConvention) {
        setFilenameConvention(preset.fountainOptions.filenameConvention);
      }
    }
    setIncludeHeadings(preset.includeHeadings);
    await handleExport(preset.format, preset.id, manuscriptOpts, {
      includeHeadings: preset.includeHeadings,
      fountainOptions: preset.fountainOptions,
    });
  };

  const handleManuscriptExport = async () => {
    if (hasErrors) {
      showToast('Fix validation errors before exporting.', 'error', 'error');
      return;
    }
    const opts = buildManuscriptOptions();
    await handleExport(manuscriptFormat, `manuscript-${profile}`, opts);
  };

  const filteredPresets = EXPORT_PRESETS.filter(p => p.projectTypes.includes(state.projectType));

  return (
    <Dialog open={open} onClose={onClose} title="Export" size="medium">
      {/* Tab bar */}
      <div className={styles.exportTabBar}>
        <button
          className={`${styles.exportTab} ${activeTab === 'presets' ? styles.exportTabActive : ''}`}
          onClick={() => setActiveTab('presets')}
        >
          <span className="material-symbols-rounded">auto_awesome</span>
          Quick Presets
        </button>
        {!isScreenplay && (
          <button
            className={`${styles.exportTab} ${activeTab === 'manuscript' ? styles.exportTabActive : ''}`}
            onClick={() => setActiveTab('manuscript')}
          >
            <span className="material-symbols-rounded">edit_document</span>
            Manuscript
          </button>
        )}
        <button
          className={`${styles.exportTab} ${activeTab === 'custom' ? styles.exportTabActive : ''}`}
          onClick={() => setActiveTab('custom')}
        >
          <span className="material-symbols-rounded">tune</span>
          Custom
        </button>
        {!isScreenplay && (
          <button
            className={`${styles.exportTab} ${activeTab === 'publishing' ? styles.exportTabActive : ''}`}
            onClick={() => setActiveTab('publishing')}
          >
            <span className="material-symbols-rounded">campaign</span>
            Publishing
          </button>
        )}
      </div>

      {/* ── Presets Tab ── */}
      {activeTab === 'presets' && (
        <div className={styles.exportPresetsSection}>
          {/* Author info hint for manuscript presets */}
          {!isScreenplay && (
            <div className={styles.exportAuthorHint}>
              <span className="material-symbols-rounded">info</span>
              <span>
                Set your name in the Manuscript tab for title pages and headers.
              </span>
            </div>
          )}

          <div className={styles.exportPresetsList}>
            {filteredPresets.map(preset => (
              <button
                key={preset.id}
                className={styles.exportPresetItem}
                onClick={() => handlePresetExport(preset)}
                disabled={exporting}
              >
                <span className="material-symbols-rounded">{preset.icon}</span>
                <div className={styles.exportPresetItem__info}>
                  <span className={styles.exportPresetItem__name}>{preset.name}</span>
                  <span className={styles.exportPresetItem__desc}>{preset.description}</span>
                </div>
                <span className={styles.exportPresetItem__format}>{FORMAT_LABELS[preset.format]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Manuscript Tab ── */}
      {activeTab === 'manuscript' && !isScreenplay && (
        <div className={styles.exportManuscriptSection}>
          {/* Profile & Locale row */}
          <div className={styles.exportRow}>
            <label className={styles.exportField}>
              <span>Profile</span>
              <select
                value={profile}
                onChange={e => handleProfileChange(e.target.value as ExportProfile)}
              >
                <option value="submission">Submission Manuscript</option>
                <option value="print">Print-Ready</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            <label className={styles.exportField}>
              <span>Locale</span>
              <select
                value={locale}
                onChange={e => handleLocaleChange(e.target.value as ManuscriptLocale)}
              >
                <option value="en-US">en-US (US Letter)</option>
                <option value="en-GB">en-GB (A4)</option>
              </select>
            </label>

            <label className={styles.exportField}>
              <span>Format</span>
              <select
                value={manuscriptFormat}
                onChange={e => setManuscriptFormat(e.target.value as ExportFormat)}
              >
                <option value="docx">DOCX</option>
                <option value="pdf">PDF</option>
                <option value="rtf">RTF</option>
              </select>
            </label>
          </div>

          {/* Author info */}
          <p className={styles.exportOptionHeading}>Author Information</p>
          <div className={styles.exportRow}>
            <label className={styles.exportField}>
              <span>Full Name</span>
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className={styles.exportInput}
              />
            </label>
            <label className={styles.exportField}>
              <span>Surname (for header)</span>
              <input
                type="text"
                value={authorSurname}
                onChange={e => setAuthorSurname(e.target.value)}
                placeholder="e.g. Smith"
                className={styles.exportInput}
              />
            </label>
            <label className={styles.exportField}>
              <span>Short Title (for header)</span>
              <input
                type="text"
                value={shortTitle}
                onChange={e => setShortTitle(e.target.value)}
                placeholder={state.novelTitle.substring(0, 30)}
                className={styles.exportInput}
              />
            </label>
          </div>

          {/* Typography & Layout */}
          <p className={styles.exportOptionHeading}>Typography &amp; Layout</p>
          <div className={styles.exportRow}>
            <label className={styles.exportField}>
              <span>Font Size (pt)</span>
              <select value={fontSizePt} onChange={e => setFontSizePt(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={11}>11</option>
                <option value={12}>12</option>
                <option value={14}>14</option>
              </select>
            </label>
            <label className={styles.exportField}>
              <span>Line Spacing</span>
              <select value={lineSpacing} onChange={e => setLineSpacing(Number(e.target.value))}>
                <option value={1.0}>Single (1.0)</option>
                <option value={1.15}>1.15</option>
                <option value={1.5}>1.5</option>
                <option value={2.0}>Double (2.0)</option>
              </select>
            </label>
            <label className={styles.exportField}>
              <span>Alignment</span>
              <select value={alignment} onChange={e => setAlignment(e.target.value as ManuscriptExportOptions['alignment'])}>
                <option value="left">Left</option>
                <option value="justified">Justified</option>
                <option value="center">Center</option>
              </select>
            </label>
          </div>

          <div className={styles.exportRow}>
            <label className={styles.exportField}>
              <span>First-line Indent (in)</span>
              <select value={firstLineIndentIn} onChange={e => setFirstLineIndentIn(Number(e.target.value))}>
                <option value={0}>None</option>
                <option value={0.3}>0.3"</option>
                <option value={0.5}>0.5"</option>
              </select>
            </label>
            <label className={styles.exportField}>
              <span>Margins (in)</span>
              <select value={marginIn} onChange={e => setMarginIn(Number(e.target.value))}>
                <option value={0.75}>0.75"</option>
                <option value={1.0}>1.0"</option>
                <option value={1.25}>1.25"</option>
              </select>
            </label>
            <label className={styles.exportField}>
              <span>Scene Break</span>
              <select value={sceneBreakMarker} onChange={e => setSceneBreakMarker(e.target.value)}>
                <option value="* * *">* * *</option>
                <option value="***">***</option>
                <option value="# # #"># # #</option>
                <option value="~">~</option>
              </select>
            </label>
          </div>

          {/* Structure options */}
          <p className={styles.exportOptionHeading}>Structure</p>
          <div className={styles.exportOptions}>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={includeTitlePage}
                onChange={e => setIncludeTitlePage(e.target.checked)}
              />
              <span>Include title page</span>
              <HelpTooltip text="Adds a standard title page with title, author name, and word count" position="right" />
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={chapterStartsNewPage}
                onChange={e => setChapterStartsNewPage(e.target.checked)}
              />
              <span>Each chapter starts on a new page</span>
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={pageNumbering}
                onChange={e => setPageNumbering(e.target.checked)}
              />
              <span>Page numbering</span>
            </label>
          </div>

          {/* Validation results */}
          {validationIssues.length > 0 && (
            <div className={styles.exportValidation}>
              <p className={styles.exportOptionHeading}>Preflight Check</p>
              {validationIssues.map(issue => (
                <div
                  key={issue.ruleId}
                  className={`${styles.exportValidationItem} ${
                    issue.severity === 'error'
                      ? styles.exportValidationError
                      : issue.severity === 'warning'
                        ? styles.exportValidationWarning
                        : styles.exportValidationInfo
                  }`}
                >
                  <span className="material-symbols-rounded">
                    {issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info'}
                  </span>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}

          {validationIssues.length === 0 && (
            <div className={styles.exportValidationPass}>
              <span className="material-symbols-rounded">check_circle</span>
              <span>All preflight checks passed</span>
            </div>
          )}

          <div className={styles.exportButtons} style={{ marginTop: '1rem' }}>
            <Button
              variant="primary"
              onClick={handleManuscriptExport}
              disabled={exporting || hasErrors}
            >
              <span className="material-symbols-rounded">download</span>
              Export {FORMAT_LABELS[manuscriptFormat]}
              {profile === 'submission' ? ' (Submission)' : profile === 'print' ? ' (Print-Ready)' : ''}
            </Button>
          </div>
        </div>
      )}

      {/* ── Custom Tab ── */}
      {activeTab === 'custom' && (
        <div className={styles.exportManualSection}>
          <p className={styles.exportOptionHeading}>Custom Export</p>

          {!isScreenplay && (
            <div className={styles.exportOptions}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={includeHeadings}
                  onChange={e => setIncludeHeadings(e.target.checked)}
                />
                <span>Include chapter headings</span>
                <HelpTooltip text="When enabled, each chapter title appears as a heading in the exported document" position="right" />
              </label>
            </div>
          )}

          {isScreenplay && (
            <div className={styles.exportOptions}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={includeSectionTitles}
                  onChange={e => setIncludeSectionTitles(e.target.checked)}
                />
                <span>Include section titles as Fountain sections</span>
              </label>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={includeMetadataBlock}
                  onChange={e => setIncludeMetadataBlock(e.target.checked)}
                />
                <span>Include Fountain metadata block</span>
              </label>
              <label className={styles.exportField}>
                <span>Filename convention</span>
                <select
                  value={filenameConvention}
                  onChange={e => setFilenameConvention(e.target.value as FountainExportOptions['filenameConvention'])}
                >
                  <option value="title">{`{title}.fountain`}</option>
                  <option value="title-screenplay">{`{title}.screenplay.fountain`}</option>
                  <option value="title-fountain">{`{title}.fountain-export.fountain`}</option>
                </select>
              </label>
            </div>
          )}

          <div className={styles.exportButtons}>
            {isScreenplay ? (
              <>
                <Button variant="primary" onClick={() => handleExport('screenplayPdf')} disabled={exporting}>
                  <span className="material-symbols-rounded">picture_as_pdf</span>
                  Export Screenplay PDF
                </Button>
                <Button variant="primary" onClick={() => handleExport('fountain')} disabled={exporting}>
                  <span className="material-symbols-rounded">article</span>
                  Export Fountain
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => handleExport('docx')} disabled={exporting}>
                  <span className="material-symbols-rounded">description</span>
                  Export DOCX
                </Button>
                <Button variant="primary" onClick={() => handleExport('pdf')} disabled={exporting}>
                  <span className="material-symbols-rounded">picture_as_pdf</span>
                  Export PDF
                </Button>
                <Button variant="primary" onClick={() => handleExport('rtf')} disabled={exporting}>
                  <span className="material-symbols-rounded">article</span>
                  Export RTF
                </Button>
                <Button variant="primary" onClick={() => handleExport('markdown')} disabled={exporting}>
                  <span className="material-symbols-rounded">code</span>
                  Export Markdown
                </Button>
                <Button variant="primary" onClick={() => handleExport('txt')} disabled={exporting}>
                  <span className="material-symbols-rounded">text_snippet</span>
                  Export Plain Text
                </Button>
              </>
            )}
          </div>
        </div>
      )}


      {activeTab === 'publishing' && !isScreenplay && (
        <div className={styles.exportManualSection}>
          <p className={styles.exportOptionHeading}>Publishing Bundle</p>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={includeKdpTemplate} onChange={e => setIncludeKdpTemplate(e.target.checked)} />
            <span>Include Amazon KDP-style metadata template</span>
          </label>
          <label className={styles.exportField}><span>Book description / blurb</span><textarea rows={4} value={bookDescription} onChange={e => setBookDescription(e.target.value)} /></label>
          <label className={styles.exportField}><span>Short synopsis</span><textarea rows={3} value={shortSynopsis} onChange={e => setShortSynopsis(e.target.value)} /></label>
          <label className={styles.exportField}><span>Long synopsis</span><textarea rows={5} value={longSynopsis} onChange={e => setLongSynopsis(e.target.value)} /></label>
          <label className={styles.exportField}><span>Author bio (short)</span><textarea rows={3} value={authorBioShort} onChange={e => setAuthorBioShort(e.target.value)} /></label>
          <label className={styles.exportField}><span>Author bio (long)</span><textarea rows={4} value={authorBioLong} onChange={e => setAuthorBioLong(e.target.value)} /></label>
          <label className={styles.exportField}><span>Keyword suggestions (comma separated)</span><textarea rows={2} value={keywordSuggestions} onChange={e => setKeywordSuggestions(e.target.value)} /></label>
          <label className={styles.exportField}><span>Category suggestions (comma/semicolon separated)</span><textarea rows={2} value={categorySuggestions} onChange={e => setCategorySuggestions(e.target.value)} /></label>
          <label className={styles.exportField}><span>Back-cover copy</span><textarea rows={4} value={backCoverCopy} onChange={e => setBackCoverCopy(e.target.value)} /></label>
          <label className={styles.exportField}><span>Hook lines (one per line)</span><textarea rows={4} value={hookLines} onChange={e => setHookLines(e.target.value)} /></label>

          <div className={styles.exportButtons}>
            <Button variant="primary" onClick={() => handleExport('publishingBundle')} disabled={exporting}>
              <span className="material-symbols-rounded">inventory_2</span>
              Export Publishing Bundle
            </Button>
          </div>
        </div>
      )}

      {exporting && (
        <p className={styles.exportStatus}>Exporting...</p>
      )}
    </Dialog>
  );
}
