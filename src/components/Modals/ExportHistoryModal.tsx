import { useState, useEffect, useCallback } from 'react';
import { Dialog, Button, IconButton } from '@/components/UI';
import { useToast } from '@/components/UI';
import {
  getExportHistory,
  deleteExportRecord,
  clearExportHistory,
  downloadExportHistoryAsJson,
  type ExportRecord,
} from '@/lib/exportHistory';
import { formatDateTime } from '@/lib/utils';
import styles from './Modals.module.css';

interface ExportHistoryModalProps {
  open: boolean;
  onClose: () => void;
}

const FORMAT_ICONS: Record<string, string> = {
  docx: 'description',
  pdf: 'picture_as_pdf',
  screenplayPdf: 'movie',
  rtf: 'article',
  fountain: 'theaters',
};

export function ExportHistoryModal({ open, onClose }: ExportHistoryModalProps) {
  const { showToast } = useToast();
  const [records, setRecords] = useState<ExportRecord[]>([]);

  const refresh = useCallback(() => {
    setRecords(getExportHistory());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleDelete = (id: string) => {
    deleteExportRecord(id);
    refresh();
  };

  const handleClearAll = () => {
    if (!confirm('Clear all export history? This cannot be undone.')) return;
    clearExportHistory();
    refresh();
    showToast('Export history cleared', 'success');
  };

  const handleDownloadHistory = () => {
    downloadExportHistoryAsJson();
    showToast('Export history downloaded', 'success', 'download');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export History"
      size="medium"
      footer={
        <div className={styles.exportHistoryFooter}>
          <Button variant="ghost" onClick={handleDownloadHistory} disabled={records.length === 0}>
            <span className="material-symbols-rounded">download</span>
            Download History
          </Button>
          <Button variant="ghost" onClick={handleClearAll} disabled={records.length === 0}>
            <span className="material-symbols-rounded">delete_sweep</span>
            Clear All
          </Button>
        </div>
      }
    >
      {records.length === 0 ? (
        <div className={styles.exportHistoryEmpty}>
          <span className="material-symbols-rounded" style={{ fontSize: '3rem', opacity: 0.3, color: 'var(--text-muted)' }}>
            history
          </span>
          <p className={styles.emptyMessage}>No exports recorded yet. Export your novel and it will appear here.</p>
        </div>
      ) : (
        <div className={styles.exportHistoryList}>
          {records.map(record => (
            <div key={record.id} className={styles.exportHistoryItem}>
              <div className={styles.exportHistoryItem__icon}>
                <span className="material-symbols-rounded">
                  {FORMAT_ICONS[record.format] || 'file_present'}
                </span>
              </div>
              <div className={styles.exportHistoryItem__info}>
                <span className={styles.exportHistoryItem__filename}>{record.filename}</span>
                <span className={styles.exportHistoryItem__meta}>
                  {record.format.toUpperCase()} &middot; {record.chapterCount} chapters &middot; {record.wordCount.toLocaleString()} words
                  {record.preset && ` &middot; Preset: ${record.preset}`}
                </span>
                <span className={styles.exportHistoryItem__date}>{formatDateTime(record.timestamp)}</span>
              </div>
              <IconButton
                icon="delete"
                label="Remove from history"
                variant="ghost"
                onClick={() => handleDelete(record.id)}
              />
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
