import { useEffect, useRef, useCallback } from 'react';

const RECOVERY_KEY = 'draftharbour_crash_recovery';

interface RecoveryState {
  novelId: string;
  chapterId: string | null;
  timestamp: number;
  clean: boolean;
}

/**
 * Tracks whether the session shut down cleanly. On the next load, if the
 * previous session was not clean (e.g. browser crashed, tab killed), we
 * surface a toast so the user knows to check their last edits.
 *
 * Also registers a `beforeunload` handler that warns users if there are
 * unsaved edits when they try to close the tab.
 */
export function useCrashRecovery({
  hasUnsavedEdits,
  novelId,
  activeChapterId,
  onRecoveryDetected,
}: {
  hasUnsavedEdits: boolean;
  novelId: string;
  activeChapterId: string | null;
  onRecoveryDetected: (info: { novelId: string; chapterId: string | null }) => void;
}) {
  const hasUnsavedRef = useRef(hasUnsavedEdits);
  hasUnsavedRef.current = hasUnsavedEdits;
  const recoveryFiredRef = useRef(false);

  // On mount: check if previous session ended uncleanly
  useEffect(() => {
    if (recoveryFiredRef.current) return;
    try {
      const raw = localStorage.getItem(RECOVERY_KEY);
      if (!raw) return;
      const prev: RecoveryState = JSON.parse(raw);
      if (!prev.clean && prev.novelId) {
        recoveryFiredRef.current = true;
        onRecoveryDetected({ novelId: prev.novelId, chapterId: prev.chapterId });
      }
    } catch {
      // corrupted data — ignore
    }
  }, [onRecoveryDetected]);

  // Persist recovery state periodically
  useEffect(() => {
    if (!novelId) return;

    const persist = () => {
      const state: RecoveryState = {
        novelId,
        chapterId: activeChapterId,
        timestamp: Date.now(),
        clean: false,
      };
      try {
        localStorage.setItem(RECOVERY_KEY, JSON.stringify(state));
      } catch {
        // storage full — non-critical
      }
    };

    persist();
    const interval = window.setInterval(persist, 5000);
    return () => window.clearInterval(interval);
  }, [novelId, activeChapterId]);

  // Mark clean on orderly unload
  useEffect(() => {
    const markClean = () => {
      try {
        const raw = localStorage.getItem(RECOVERY_KEY);
        if (raw) {
          const state: RecoveryState = JSON.parse(raw);
          state.clean = true;
          localStorage.setItem(RECOVERY_KEY, JSON.stringify(state));
        }
      } catch {
        // best-effort
      }
    };

    window.addEventListener('pagehide', markClean);
    return () => window.removeEventListener('pagehide', markClean);
  }, []);

  // beforeunload warning for unsaved edits
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasUnsavedRef.current) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);
}
