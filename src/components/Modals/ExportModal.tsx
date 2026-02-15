import { useState } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import { useApp } from '@/context/AppContext';
import type { ExportFormat } from '@/types';
import { exportToDocx, exportToPdf, exportToRtf, exportToFountain, exportToScreenplayPdf } from '@/lib/export';
import type { FountainExportOptions } from '@/lib/export';
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
}

const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'manuscript',
    name: 'Manuscript Submission',
    icon: 'send',
    description: 'Standard DOCX with chapter headings, suitable for agent/editor submission.',
    format: 'docx',
    includeHeadings: true,
    projectTypes: ['book'],
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
];

export function ExportModal({ open, onClose }: ExportModalProps) {
  const { state } = useApp();
  const { showToast } = useToast();
  const [includeHeadings, setIncludeHeadings] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [includeSectionTitles, setIncludeSectionTitles] = useState(true);
  const [includeMetadataBlock, setIncludeMetadataBlock] = useState(true);
  const [filenameConvention, setFilenameConvention] = useState<FountainExportOptions['filenameConvention']>('title');
  const [showPresets, setShowPresets] = useState(true);

  const isScreenplay = state.projectType === 'screenplay';

  const FORMAT_LABELS: Record<ExportFormat, string> = {
    docx: 'DOCX',
    pdf: 'PDF',
    screenplayPdf: 'Screenplay PDF',
    rtf: 'RTF',
    fountain: 'Fountain'
  };

  const totalWords = state.chapters.reduce((sum, ch) => sum + countWords(editorToPlainText(ch.content)), 0);

  const handleExport = async (format: ExportFormat, presetId?: string) => {
    setExporting(true);
    try {
      switch (format) {
        case 'docx':
          await exportToDocx(state.chapters, state.novelTitle, includeHeadings);
          break;
        case 'pdf':
          await exportToPdf(state.chapters, state.novelTitle, includeHeadings);
          break;
        case 'screenplayPdf':
          await exportToScreenplayPdf(state.chapters, state.novelTitle);
          break;
        case 'fountain':
          await exportToFountain(state.chapters, state.novelTitle, {
            includeSectionTitles,
            includeMetadataBlock,
            filenameConvention,
          });
          break;
        case 'rtf':
          await exportToRtf(state.chapters, state.novelTitle, includeHeadings);
          break;
      }

      // Record to export history
      const safeTitle = state.novelTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      recordExport({
        format,
        filename: `${safeTitle}.${format === 'screenplayPdf' ? 'pdf' : format}`,
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
    if (preset.fountainOptions) {
      // Apply preset fountain options before exporting
      setIncludeSectionTitles(preset.fountainOptions.includeSectionTitles ?? true);
      setIncludeMetadataBlock(preset.fountainOptions.includeMetadataBlock ?? true);
      if (preset.fountainOptions.filenameConvention) {
        setFilenameConvention(preset.fountainOptions.filenameConvention);
      }
    }
    setIncludeHeadings(preset.includeHeadings);
    await handleExport(preset.format, preset.id);
  };

  const filteredPresets = EXPORT_PRESETS.filter(p => p.projectTypes.includes(state.projectType));

  return (
    <Dialog open={open} onClose={onClose} title="Export" size="medium">
      {/* Presets Section */}
      <div className={styles.exportPresetsSection}>
        <button
          className={styles.exportPresetsToggle}
          onClick={() => setShowPresets(!showPresets)}
        >
          <span className="material-symbols-rounded">auto_awesome</span>
          <span>Quick Export Presets</span>
          <span className="material-symbols-rounded">
            {showPresets ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {showPresets && (
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
        )}
      </div>

      {/* Manual Options */}
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
            </>
          )}
        </div>
      </div>

      {exporting && (
        <p className={styles.exportStatus}>Exporting...</p>
      )}
    </Dialog>
  );
}
