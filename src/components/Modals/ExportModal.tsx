import { useState } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import { useApp } from '@/context/AppContext';
import type { ExportFormat } from '@/types';
import { exportToDocx, exportToPdf, exportToRtf, exportToFountain, exportToScreenplayPdf } from '@/lib/export';
import type { FountainExportOptions } from '@/lib/export';
import styles from './Modals.module.css';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportModal({ open, onClose }: ExportModalProps) {
  const { state } = useApp();
  const { showToast } = useToast();
  const [includeHeadings, setIncludeHeadings] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [includeSectionTitles, setIncludeSectionTitles] = useState(true);
  const [includeMetadataBlock, setIncludeMetadataBlock] = useState(true);
  const [filenameConvention, setFilenameConvention] = useState<FountainExportOptions['filenameConvention']>('title');

  const isScreenplay = state.projectType === 'screenplay';

  const FORMAT_LABELS: Record<ExportFormat, string> = {
    docx: 'DOCX',
    pdf: 'PDF',
    screenplayPdf: 'Screenplay PDF',
    rtf: 'RTF',
    fountain: 'Fountain'
  };

  const handleExport = async (format: ExportFormat) => {
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
      showToast(`Exported ${FORMAT_LABELS[format]} successfully`, 'success', 'download_done');
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      showToast(`${FORMAT_LABELS[format]} export failed. Please try again.`, 'error', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={isScreenplay ? 'Export Screenplay' : 'Export Novel'} size="small">
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
          <p className={styles.exportOptionHeading}>Fountain options</p>
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
            <Button
              variant="primary"
              onClick={() => handleExport('screenplayPdf')}
              disabled={exporting}
            >
              <span className="material-symbols-rounded">picture_as_pdf</span>
              Export Screenplay PDF
            </Button>
            <Button
              variant="primary"
              onClick={() => handleExport('fountain')}
              disabled={exporting}
            >
              <span className="material-symbols-rounded">article</span>
              Export Fountain
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={() => handleExport('docx')}
              disabled={exporting}
            >
              <span className="material-symbols-rounded">description</span>
              Export DOCX
            </Button>
            <Button
              variant="primary"
              onClick={() => handleExport('pdf')}
              disabled={exporting}
            >
              <span className="material-symbols-rounded">picture_as_pdf</span>
              Export PDF
            </Button>
            <Button
              variant="primary"
              onClick={() => handleExport('rtf')}
              disabled={exporting}
            >
              <span className="material-symbols-rounded">article</span>
              Export RTF
            </Button>
            <Button
              variant="primary"
              onClick={() => handleExport('screenplayPdf')}
              disabled={exporting}
            >
              <span className="material-symbols-rounded">picture_as_pdf</span>
              Export Screenplay PDF
            </Button>
            <Button
              variant="primary"
              onClick={() => handleExport('fountain')}
              disabled={exporting}
            >
              <span className="material-symbols-rounded">article</span>
              Export Fountain
            </Button>
          </>
        )}
      </div>

      {exporting && (
        <p className={styles.exportStatus}>Exporting...</p>
      )}
    </Dialog>
  );
}
