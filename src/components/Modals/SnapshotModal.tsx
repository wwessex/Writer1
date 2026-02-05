import { useState, useEffect, useCallback } from 'react';
import { Dialog, Button, IconButton } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { getSnapshots, createSnapshot, deleteSnapshot } from '@/lib/storage';
import { editorToPlainText, formatDateTime } from '@/lib/utils';
import type { Snapshot } from '@/types';
import styles from './Modals.module.css';

interface SnapshotModalProps {
  open: boolean;
  onClose: () => void;
}

export function SnapshotModal({ open, onClose }: SnapshotModalProps) {
  const { activeChapter, updateChapter } = useApp();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSnapshots = useCallback(async () => {
    if (!activeChapter) return;
    setLoading(true);
    try {
      const loaded = await getSnapshots(activeChapter.id);
      setSnapshots(loaded);
      setSelectedSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [activeChapter]);

  useEffect(() => {
    if (open && activeChapter) {
      loadSnapshots();
    }
  }, [open, activeChapter, loadSnapshots]);

  const handleSaveSnapshot = async () => {
    if (!activeChapter?.content) return;
    setLoading(true);
    try {
      await createSnapshot(activeChapter.id, activeChapter.content);
      await loadSnapshots();
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshot || !activeChapter) return;
    if (!confirm('Restore this snapshot? Current content will be replaced.')) return;

    updateChapter(activeChapter.id, { content: selectedSnapshot.doc });
    onClose();
  };

  const handleDeleteSnapshot = async (snapshot: Snapshot) => {
    if (!confirm('Delete this snapshot?')) return;
    await deleteSnapshot(snapshot.id);
    await loadSnapshots();
  };

  if (!activeChapter) {
    return (
      <Dialog open={open} onClose={onClose} title="Snapshots" size="medium">
        <p className={styles.emptyMessage}>Select a chapter to view snapshots</p>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Snapshots - ${activeChapter.title}`} size="large">
      <div className={styles.snapshotLayout}>
        <div className={styles.snapshotList}>
          <div className={styles.snapshotList__header}>
            <h4>Saved Snapshots</h4>
            <Button variant="primary" size="small" onClick={handleSaveSnapshot} disabled={loading}>
              <span className="material-symbols-rounded">save</span>
              Save Snapshot
            </Button>
          </div>

          {loading && <p className={styles.loadingText}>Loading...</p>}

          {!loading && snapshots.length === 0 && (
            <p className={styles.emptyMessage}>No snapshots yet. Save a snapshot to preserve your current work.</p>
          )}

          <div className={styles.snapshotItems}>
            {snapshots.map(snapshot => (
              <div
                key={snapshot.id}
                className={`${styles.snapshotItem} ${selectedSnapshot?.id === snapshot.id ? styles['snapshotItem--selected'] : ''}`}
                onClick={() => setSelectedSnapshot(snapshot)}
              >
                <div className={styles.snapshotItem__info}>
                  <span className={styles.snapshotItem__date}>
                    {formatDateTime(snapshot.createdAt)}
                  </span>
                  <span className={styles.snapshotItem__preview}>
                    {editorToPlainText(snapshot.doc).slice(0, 100)}...
                  </span>
                </div>
                <IconButton
                  icon="delete"
                  label="Delete snapshot"
                  variant="ghost"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteSnapshot(snapshot);
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={styles.snapshotPreview}>
          <h4>Preview</h4>
          {selectedSnapshot ? (
            <>
              <div className={styles.snapshotPreview__content}>
                {editorToPlainText(selectedSnapshot.doc)}
              </div>
              <div className={styles.snapshotPreview__actions}>
                <Button variant="primary" onClick={handleRestoreSnapshot}>
                  <span className="material-symbols-rounded">restore</span>
                  Restore This Snapshot
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.emptyMessage}>Select a snapshot to preview</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
