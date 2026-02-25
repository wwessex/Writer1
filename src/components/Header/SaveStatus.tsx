import { useState, useEffect, useRef } from 'react';
import styles from './SaveStatus.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusProps {
  isSaving: boolean;
}

export function SaveStatus({ isSaving }: SaveStatusProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timerRef = useRef<number | null>(null);
  const hadSaveRef = useRef(false);

  useEffect(() => {
    if (isSaving) {
      hadSaveRef.current = true;
      setSaveState('saving');
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } else if (hadSaveRef.current) {
      setSaveState('saved');
      timerRef.current = window.setTimeout(() => {
        setSaveState('idle');
        timerRef.current = null;
      }, 2500);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [isSaving]);

  if (saveState === 'idle') return null;

  return (
    <span
      className={`${styles.saveStatus} ${styles[`saveStatus--${saveState}`]}`}
      role="status"
      aria-live="polite"
    >
      {saveState === 'saving' && (
        <>
          <span className={styles.saveDot} />
          <span>Saving</span>
        </>
      )}
      {saveState === 'saved' && (
        <>
          <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>check</span>
          <span>Saved</span>
        </>
      )}
      {saveState === 'error' && (
        <>
          <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>error</span>
          <span>Save failed</span>
        </>
      )}
    </span>
  );
}
