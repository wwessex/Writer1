import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, Button, IconButton } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { getSnapshots, createSnapshot, deleteSnapshot } from '@/lib/storage';
import { editorToPlainText, formatDateTime, countWords } from '@/lib/utils';
import type { Snapshot } from '@/types';
import styles from './Modals.module.css';

// -- Visual Timeline Component --
function SnapshotTimeline({
  snapshots,
  selectedId,
  onSelect,
}: {
  snapshots: Snapshot[];
  selectedId: string | null;
  onSelect: (s: Snapshot) => void;
}) {
  if (snapshots.length === 0) return null;

  const wordCounts = snapshots.map(s => countWords(editorToPlainText(s.doc)));
  const maxWords = Math.max(...wordCounts, 1);

  // Group by date
  const groups = new Map<string, { snapshot: Snapshot; words: number }[]>();
  snapshots.forEach((s, i) => {
    const dateKey = new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push({ snapshot: s, words: wordCounts[i] });
  });

  return (
    <div className={styles.timeline}>
      <div className={styles.timeline__line} />
      {[...groups.entries()].map(([dateLabel, items]) => (
        <div key={dateLabel} className={styles.timeline__group}>
          <div className={styles.timeline__dateLabel}>{dateLabel}</div>
          {items.map(({ snapshot, words }) => {
            const isSelected = selectedId === snapshot.id;
            const heightPercent = Math.max(8, (words / maxWords) * 100);
            const time = new Date(snapshot.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            return (
              <button
                key={snapshot.id}
                className={`${styles.timeline__node} ${isSelected ? styles['timeline__node--selected'] : ''}`}
                onClick={() => onSelect(snapshot)}
                title={`${time} - ${words.toLocaleString()} words`}
              >
                <div className={styles.timeline__dot} />
                <div className={styles.timeline__bar} style={{ height: `${heightPercent}%` }} />
                <span className={styles.timeline__time}>{time}</span>
                <span className={styles.timeline__words}>{words.toLocaleString()}w</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface SnapshotModalProps {
  open: boolean;
  onClose: () => void;
}

export function SnapshotModal({ open, onClose }: SnapshotModalProps) {
  const { activeChapter, updateChapter, state } = useApp();
  const { showToast } = useToast();
  const sectionLabel = state.projectType === 'screenplay' ? 'scene' : 'chapter';
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [compareSnapshot, setCompareSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const loadSnapshots = useCallback(async () => {
    if (!activeChapter) return;
    setLoading(true);
    try {
      const loaded = await getSnapshots(activeChapter.id);
      setSnapshots(loaded);
      setSelectedSnapshot(null);
      setCompareSnapshot(null);
      setShowDiff(false);
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
      showToast('Snapshot saved', 'success', 'photo_camera');
    } catch (err) {
      console.error('Failed to save snapshot:', err);
      showToast('Failed to save snapshot', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshot || !activeChapter) return;
    if (!confirm(`Restore this snapshot? Current ${sectionLabel} content will be replaced.`)) return;

    updateChapter(activeChapter.id, { content: selectedSnapshot.doc });
    onClose();
  };

  const handleDeleteSnapshot = async (snapshot: Snapshot) => {
    if (!confirm('Delete this snapshot?')) return;
    await deleteSnapshot(snapshot.id);
    await loadSnapshots();
  };

  const handleCompare = () => {
    if (selectedSnapshot && snapshots.length >= 1) {
      const selectedIndex = snapshots.findIndex(s => s.id === selectedSnapshot.id);
      const olderSnapshot = snapshots[selectedIndex + 1] || null;
      setCompareSnapshot(olderSnapshot);
      setShowDiff(true);
    }
  };

  const diffLines = useMemo(() => {
    if (!showDiff || !selectedSnapshot) return null;

    const newText = editorToPlainText(selectedSnapshot.doc);
    const oldText = compareSnapshot
      ? editorToPlainText(compareSnapshot.doc)
      : (activeChapter ? editorToPlainText(activeChapter.content) : '');

    const newLines = newText.split('\n');
    const oldLines = oldText.split('\n');

    return { newLines, oldLines };
  }, [showDiff, selectedSnapshot, compareSnapshot, activeChapter]);

  if (!activeChapter) {
    return (
      <Dialog open={open} onClose={onClose} title="Snapshots" size="medium">
        <p className={styles.emptyMessage}>Select a {sectionLabel} to view snapshots</p>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Snapshots - ${activeChapter.title}`} size="large">
      {/* Visual Timeline */}
      {snapshots.length > 1 && (
        <div className={styles.snapshotTimelineWrap}>
          <h4 className={styles.snapshotTimelineWrap__title}>
            <span className="material-symbols-rounded">timeline</span>
            Version Timeline
          </h4>
          <SnapshotTimeline
            snapshots={snapshots}
            selectedId={selectedSnapshot?.id ?? null}
            onSelect={(s) => { setSelectedSnapshot(s); setShowDiff(false); }}
          />
        </div>
      )}

      <div className={styles.snapshotLayout}>
        <div className={styles.snapshotList}>
          <div className={styles.snapshotList__header}>
            <h4>Saved Snapshots</h4>
            <Button variant="primary" size="small" onClick={handleSaveSnapshot} disabled={loading}>
              <span className="material-symbols-rounded">save</span>
              Save Now
            </Button>
          </div>

          {loading && <p className={styles.loadingText}>Loading...</p>}

          {!loading && snapshots.length === 0 && (
            <div className={styles.snapshotEmptyState}>
              <span className={`material-symbols-rounded ${styles.snapshotEmptyState__icon}`}>photo_camera</span>
              <p className={styles.emptyMessage}>No snapshots yet</p>
              <p className={styles.snapshotEmptyState__hint}>
                Save a snapshot to preserve your current {sectionLabel} draft. You can compare versions side-by-side and restore any snapshot later.
              </p>
              <Button variant="primary" size="small" onClick={handleSaveSnapshot} disabled={loading || !activeChapter?.content}>
                <span className="material-symbols-rounded">save</span>
                Save First Snapshot
              </Button>
            </div>
          )}

          <div className={styles.snapshotItems}>
            {snapshots.map(snapshot => (
              <div
                key={snapshot.id}
                className={`${styles.snapshotItem} ${selectedSnapshot?.id === snapshot.id ? styles['snapshotItem--selected'] : ''}`}
                onClick={() => { setSelectedSnapshot(snapshot); setShowDiff(false); }}
                role="button"
                tabIndex={0}
                aria-label={`Snapshot from ${formatDateTime(snapshot.createdAt)}`}
                onKeyDown={e => { if (e.key === 'Enter') { setSelectedSnapshot(snapshot); setShowDiff(false); } }}
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
              {!showDiff ? (
                <>
                  <div className={styles.snapshotPreview__content}>
                    {editorToPlainText(selectedSnapshot.doc)}
                  </div>
                  <div className={styles.snapshotPreview__actions}>
                    <Button variant="primary" onClick={handleRestoreSnapshot}>
                      <span className="material-symbols-rounded">restore</span>
                      Restore
                    </Button>
                    {snapshots.length >= 1 && (
                      <Button variant="default" onClick={handleCompare}>
                        <span className="material-symbols-rounded">compare_arrows</span>
                        Compare
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.diffToggle}>
                    <Button variant="ghost" size="small" onClick={() => setShowDiff(false)}>
                      <span className="material-symbols-rounded">visibility</span>
                      Preview
                    </Button>
                    <Button variant="primary" size="small" onClick={() => setShowDiff(true)}>
                      <span className="material-symbols-rounded">compare_arrows</span>
                      Diff
                    </Button>
                  </div>
                  <div className={styles.diffView}>
                    <div className={styles.diffPane}>
                      <div className={styles.diffPane__header}>
                        {compareSnapshot ? `Older (${formatDateTime(compareSnapshot.createdAt)})` : `Current ${sectionLabel} Content`}
                      </div>
                      <div className={styles.diffPane__content}>
                        {diffLines?.oldLines.map((line, i) => (
                          <div key={i} className={
                            diffLines.newLines[i] !== line
                              ? `${styles.diffLine} ${styles['diffLine--removed']}`
                              : styles.diffLine
                          }>
                            {line || '\u00A0'}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className={styles.diffPane}>
                      <div className={styles.diffPane__header}>
                        Selected ({formatDateTime(selectedSnapshot.createdAt)})
                      </div>
                      <div className={styles.diffPane__content}>
                        {diffLines?.newLines.map((line, i) => (
                          <div key={i} className={
                            diffLines.oldLines[i] !== line
                              ? `${styles.diffLine} ${styles['diffLine--added']}`
                              : styles.diffLine
                          }>
                            {line || '\u00A0'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={styles.snapshotPreview__actions}>
                    <Button variant="primary" onClick={handleRestoreSnapshot}>
                      <span className="material-symbols-rounded">restore</span>
                      Restore Selected
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className={styles.emptyMessage}>Select a snapshot to preview</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
