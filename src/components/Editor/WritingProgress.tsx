import { useMemo, useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getProjectMetrics } from '@/lib/projectMetrics';
import { getProgressData, getTodayProgress, getProgressSnapshots, recordDailyWords, recordProgressSnapshot } from '@/lib/progressTracker';
import styles from './WritingProgress.module.css';

interface WritingProgressProps {
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}

export function WritingProgress({ showToast }: WritingProgressProps) {
  const { state } = useApp();
  const configuredGoals = state.settings.goalConfiguration ?? { dailyWordTarget: 0, weeklyWordTarget: 0, draftCompletionDeadline: '', milestoneCheckpoints: [] };
  const configuredDailyGoal = configuredGoals.dailyWordTarget;
  const fallbackDailyGoal = state.settings.dailyWordGoal;
  const dailyGoal = configuredDailyGoal > 0 ? configuredDailyGoal : fallbackDailyGoal;
  const weeklyGoal = configuredGoals.weeklyWordTarget;

  const projectMetrics = useMemo(() => getProjectMetrics(state.chapters), [state.chapters]);
  const totalWords = projectMetrics.totalWords;

  const { wordsToday } = useMemo(() => getTodayProgress(totalWords), [totalWords]);

  const streakCurrent = getProgressData().streak.current;
  const weeklyWords = getProgressSnapshots(7)
    .reduce((sum, snapshot) => sum + snapshot.totalWords, 0);

  const goalReachedRef = useRef(false);
  const weeklyNudgeRef = useRef(false);

  useEffect(() => {
    if (dailyGoal <= 0 && weeklyGoal <= 0) return;

    const record = () => {
      recordDailyWords(totalWords, dailyGoal);
      const today = new Date().toISOString().slice(0, 10);
      recordProgressSnapshot({
        date: today,
        totalWords: wordsToday,
        dailyGoal,
        weeklyGoal,
        novelGoal: state.settings.novelWordGoal,
      });
    };

    record();
    const interval = window.setInterval(record, 30_000);
    return () => window.clearInterval(interval);
  }, [totalWords, wordsToday, dailyGoal, weeklyGoal, state.settings.novelWordGoal]);

  useEffect(() => {
    if (dailyGoal <= 0 || !showToast) return;
    if (wordsToday >= dailyGoal && !goalReachedRef.current) {
      goalReachedRef.current = true;
      showToast(`Daily target hit — ${wordsToday.toLocaleString()} words today.`, 'success', 'celebration');
    }
    if (wordsToday < dailyGoal) {
      goalReachedRef.current = false;
      if (dailyGoal - wordsToday <= Math.max(25, Math.round(dailyGoal * 0.1))) {
        showToast('You are close to today\'s target. Keep going!', 'info', 'insights');
      }
    }
  }, [wordsToday, dailyGoal, showToast]);

  useEffect(() => {
    if (!showToast || weeklyGoal <= 0) return;
    if (weeklyWords < weeklyGoal * 0.4 && !weeklyNudgeRef.current) {
      weeklyNudgeRef.current = true;
      showToast('Weekly pace is slipping a bit — a short session today will help.', 'warning', 'schedule');
    }
    if (weeklyWords >= weeklyGoal * 0.4) {
      weeklyNudgeRef.current = false;
    }
  }, [weeklyWords, weeklyGoal, showToast]);

  if (dailyGoal <= 0) return null;

  const percentage = Math.min(100, Math.round((wordsToday / dailyGoal) * 100));
  const remaining = Math.max(0, dailyGoal - wordsToday);
  const paceLabel = wordsToday >= dailyGoal ? 'ahead' : 'behind';

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
        <span className={paceLabel === 'ahead' ? styles.progressAhead : styles.progressBehind}>{paceLabel}</span>
        {percentage < 100 ? (
          <span className={styles.progressRemaining}>{remaining.toLocaleString()} to go · streak {streakCurrent}</span>
        ) : (
          <span className={styles.progressComplete}>Goal reached · streak {streakCurrent}</span>
        )}
      </div>
    </div>
  );
}
