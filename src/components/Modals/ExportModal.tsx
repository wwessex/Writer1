import { useState } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { exportToDocx, exportToPdf, exportToRtf } from '@/lib/export';
import styles from './Modals.module.css';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExportModal({ open, onClose }: ExportModalProps) {
  const { state } = useApp();
  const [includeHeadings, setIncludeHeadings] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'docx' | 'pdf' | 'rtf') => {
    setExporting(true);
    try {
      switch (format) {
        case 'docx':
          await exportToDocx(state.chapters, state.novelTitle, includeHeadings);
          break;
        case 'pdf':
          await exportToPdf(state.chapters, state.novelTitle, includeHeadings);
          break;
        case 'rtf':
          await exportToRtf(state.chapters, state.novelTitle, includeHeadings);
          break;
      }
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Export Novel" size="small">
      <div className={styles.exportOptions}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={includeHeadings}
            onChange={e => setIncludeHeadings(e.target.checked)}
          />
          <span>Include chapter headings</span>
        </label>
      </div>

      <div className={styles.exportButtons}>
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
      </div>

      {exporting && (
        <p className={styles.exportStatus}>Exporting...</p>
      )}
    </Dialog>
  );
}
