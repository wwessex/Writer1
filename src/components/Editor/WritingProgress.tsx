import { useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getProjectMetrics } from '@/lib/projectMetrics';
import { recordDailyWords, getTodayProgress } from '@/lib/progressTracker';
import styles from './WritingProgress.module.css';

interface WritingProgressProps {
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}

export function WritingProgress({ showToast }: WritingProgressProps) {
  const { state } = useApp();
  const dailyGoal = state.settings.dailyWordGoal;

  const projectMetrics = useMemo(() => getProjectMetrics(state.chapters), [state.chapters]);
  const totalWords = projectMetrics.totalWords;

  const { wordsToday } = useMemo(
    () => getTodayProgress(totalWords),
    [totalWords]
  );

  const goalReachedRef = useRef(false);

  // Auto-record progress every 30 seconds
  useEffect(() => {
    if (dailyGoal <= 0) return;

    const record = () => recordDailyWords(totalWords, dailyGoal);
    record();
    const interval = window.setInterval(record, 30_000);
    return () => window.clearInterval(interval);
  }, [totalWords, dailyGoal]);

  // Goal reached toast
  useEffect(() => {
    if (dailyGoal <= 0 || !showToast) return;
    if (wordsToday >= dailyGoal && !goalReachedRef.current) {
      goalReachedRef.current = true;
      showToast(`Daily goal reached! ${wordsToday.toLocaleString()} words today.`, 'success', 'celebration');
    }
    if (wordsToday < dailyGoal) {
      goalReachedRef.current = false;
    }
  }, [wordsToday, dailyGoal, showToast]);

  if (dailyGoal <= 0) return null;

  const percentage = Math.min(100, Math.round((wordsToday / dailyGoal) * 100));
  const remaining = Math.max(0, dailyGoal - wordsToday);

  return (
    <div className={styles.progressContainer} role="status" aria-label="Daily writing progress">
      <div className={styles.progressTrack}>
        <div
          className={`${styles.progressFill} ${percentage >= 100 ? styles['progressFill--complete'] : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className={styles.progressLabel}>
        <span>{wordsToday.toLocaleString()} / {dailyGoal.toLocaleString()}</span>
        {percentage < 100 ? (
          <span className={styles.progressRemaining}>{remaining.toLocaleString()} to go</span>
        ) : (
          <span className={styles.progressComplete}>Goal reached</span>
        )}
      </div>
    </div>
  );
}
