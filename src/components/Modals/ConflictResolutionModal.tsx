import { useState } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText } from '@/lib/utils';
import type { ConflictInfo, ConflictResolutionOption } from '@/types';
import styles from './Modals.module.css';

interface ConflictResolutionModalProps {
  open: boolean;
  onClose: () => void;
  conflict: ConflictInfo | null;
  onResolve: (resolution: ConflictResolutionOption) => void;
}

export function ConflictResolutionModal({ open, onClose, conflict, onResolve }: ConflictResolutionModalProps) {
  const { state } = useApp();
  const [selectedResolution, setSelectedResolution] = useState<ConflictResolutionOption>('local');

  if (!conflict) {
    return (
      <Dialog open={open} onClose={onClose} title="Conflict Resolution">
        <p className={styles.emptyMessage}>No conflicts detected</p>
      </Dialog>
    );
  }

  const chapter = state.chapters.find(ch => ch.id === conflict.chapterId);
  const localText = conflict.localContent ? editorToPlainText(conflict.localContent) : '';
  const remoteText = conflict.remoteContent ? editorToPlainText(conflict.remoteContent) : '';

  const localPreview = localText.slice(0, 500) + (localText.length > 500 ? '...' : '');
  const remotePreview = remoteText.slice(0, 500) + (remoteText.length > 500 ? '...' : '');

  const formatTime = (ts: number) => new Date(ts).toLocaleString();
  const allowedOptions = conflict.resolutionOptions || ['local', 'remote', 'merge'];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Conflict Detected"
      size="large"
      footer={
        <div className={styles.conflictFooter}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              onResolve(selectedResolution);
              onClose();
            }}
          >
            <span className="material-symbols-rounded">check</span>
            Apply {selectedResolution === 'local' ? 'Keep Local' : selectedResolution === 'remote' ? 'Keep Remote' : 'Manual Merge'}
          </Button>
        </div>
      }
    >
      <div className={styles.conflictLayout}>
        <div className={styles.conflictWarning}>
          <span className="material-symbols-rounded">warning</span>
          <p>
            The chapter <strong>"{chapter?.title || 'Unknown'}"</strong> has diverged.
            Choose an action: keep local, keep remote, or start from a manual merge draft.
          </p>
        </div>

        <div className={styles.conflictOptions}>
          {allowedOptions.includes('local') && (
            <div
              className={`${styles.conflictOption} ${selectedResolution === 'local' ? styles['conflictOption--selected'] : ''}`}
              onClick={() => setSelectedResolution('local')}
            >
              <div className={styles.conflictOption__header}>
                <input type="radio" name="resolution" checked={selectedResolution === 'local'} onChange={() => setSelectedResolution('local')} />
                <div>
                  <h4><span className="material-symbols-rounded">computer</span>Local Version</h4>
                  <span className={styles.conflictOption__time}>Modified: {formatTime(conflict.localUpdatedAt)}</span>
                </div>
              </div>
              <div className={styles.conflictOption__preview}>{localPreview || <em>Empty content</em>}</div>
            </div>
          )}

          {allowedOptions.includes('remote') && (
            <div
              className={`${styles.conflictOption} ${selectedResolution === 'remote' ? styles['conflictOption--selected'] : ''}`}
              onClick={() => setSelectedResolution('remote')}
            >
              <div className={styles.conflictOption__header}>
                <input type="radio" name="resolution" checked={selectedResolution === 'remote'} onChange={() => setSelectedResolution('remote')} />
                <div>
                  <h4><span className="material-symbols-rounded">cloud</span>Remote Version</h4>
                  <span className={styles.conflictOption__time}>Modified: {formatTime(conflict.remoteUpdatedAt)}</span>
                </div>
              </div>
              <div className={styles.conflictOption__preview}>{remotePreview || <em>Empty content</em>}</div>
            </div>
          )}

          {allowedOptions.includes('merge') && (
            <div
              className={`${styles.conflictOption} ${selectedResolution === 'merge' ? styles['conflictOption--selected'] : ''}`}
              onClick={() => setSelectedResolution('merge')}
            >
              <div className={styles.conflictOption__header}>
                <input type="radio" name="resolution" checked={selectedResolution === 'merge'} onChange={() => setSelectedResolution('merge')} />
                <div>
                  <h4><span className="material-symbols-rounded">merge</span>Manual Merge Draft</h4>
                  <span className={styles.conflictOption__time}>Uses an auto-merged draft you can edit afterward.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.conflictDiff}>
          <h4><span className="material-symbols-rounded">compare</span>Side-by-Side Comparison</h4>
          <div className={styles.diffView}>
            <div className={styles.diffPane}>
              <div className={styles.diffPane__header}>Local</div>
              <div className={styles.diffPane__content}>{localPreview || <em>Empty</em>}</div>
            </div>
            <div className={styles.diffPane}>
              <div className={styles.diffPane__header}>Remote</div>
              <div className={styles.diffPane__content}>{remotePreview || <em>Empty</em>}</div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
