import { useMemo, useEffect, useState } from 'react';
import { Dialog } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { countWords, editorToPlainText } from '@/lib/utils';
import {
  recordDailyWords,
  getWeeklyHistory,
  getMonthlyHistory,
  type DailyProgress,
  type ProgressData,
} from '@/lib/progressTracker';
import styles from './Modals.module.css';

interface DashboardModalProps {
  open: boolean;
  onClose: () => void;
}

export function DashboardModal({ open, onClose }: DashboardModalProps) {
  const { state } = useApp();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<DailyProgress[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<DailyProgress[]>([]);

  const stats = useMemo(() => {
    const chapterStats = state.chapters.map(ch => {
      const text = editorToPlainText(ch.content);
      const words = countWords(text);
      return {
        id: ch.id,
        title: ch.title,
        words,
        status: ch.status,
        wordGoal: ch.wordGoal,
        updatedAt: ch.updatedAt
      };
    });

    const totalWords = chapterStats.reduce((sum, ch) => sum + ch.words, 0);
    const totalChapters = chapterStats.length;
    const completedChapters = chapterStats.filter(ch => ch.status === 'final').length;
    const draftChapters = chapterStats.filter(ch => ch.status === 'draft').length;
    const revisedChapters = chapterStats.filter(ch => ch.status === 'revised').length;
    const plannedChapters = chapterStats.filter(ch => ch.status === 'planned').length;

    const avgWordsPerChapter = totalChapters > 0 ? Math.round(totalWords / totalChapters) : 0;

    return {
      chapterStats,
      totalWords,
      totalChapters,
      completedChapters,
      draftChapters,
      revisedChapters,
      plannedChapters,
      avgWordsPerChapter
    };
  }, [state.chapters]);

  // Record progress and load history when modal opens
  useEffect(() => {
    if (open) {
      const data = recordDailyWords(stats.totalWords, state.settings.dailyWordGoal);
      setProgress(data);
      setWeeklyHistory(getWeeklyHistory());
      setMonthlyHistory(getMonthlyHistory());
    }
  }, [open, stats.totalWords, state.settings.dailyWordGoal]);

  const novelGoalPercent = state.settings.novelWordGoal > 0
    ? Math.min(100, Math.round((stats.totalWords / state.settings.novelWordGoal) * 100))
    : 0;

  const todayEntry = monthlyHistory.find(d => d.date === new Date().toISOString().slice(0, 10));
  const todayWords = todayEntry?.wordsWritten ?? 0;
  const dailyGoalPercent = state.settings.dailyWordGoal > 0
    ? Math.min(100, Math.round((todayWords / state.settings.dailyWordGoal) * 100))
    : 0;

  return (
    <Dialog open={open} onClose={onClose} title="Project Dashboard" size="large">
      <div className={styles.dashboardGrid}>
        {/* Overview stats */}
        <div className={styles.dashboardOverview}>
          <div className={styles.dashboardStat}>
            <span className={styles.dashboardStat__value}>{stats.totalWords.toLocaleString()}</span>
            <span className={styles.dashboardStat__label}>Total Words</span>
          </div>
          <div className={styles.dashboardStat}>
            <span className={styles.dashboardStat__value}>{stats.totalChapters}</span>
            <span className={styles.dashboardStat__label}>Chapters</span>
          </div>
          <div className={styles.dashboardStat}>
            <span className={styles.dashboardStat__value}>{stats.avgWordsPerChapter.toLocaleString()}</span>
            <span className={styles.dashboardStat__label}>Avg per Chapter</span>
          </div>
          <div className={styles.dashboardStat}>
            <span className={styles.dashboardStat__value}>{stats.completedChapters}</span>
            <span className={styles.dashboardStat__label}>Completed</span>
          </div>
        </div>

        {/* Writing Streak and Daily Progress */}
        {progress && (
          <div className={styles.dashboardStreakRow}>
            <div className={styles.dashboardStreakCard}>
              <div className={styles.dashboardStreakCard__icon}>
                <span className="material-symbols-rounded">local_fire_department</span>
              </div>
              <div className={styles.dashboardStreakCard__info}>
                <span className={styles.dashboardStreakCard__value}>{progress.streak.current}</span>
                <span className={styles.dashboardStreakCard__label}>Day Streak</span>
              </div>
              <div className={styles.dashboardStreakCard__best}>
                Best: {progress.streak.longest}
              </div>
            </div>

            <div className={styles.dashboardStreakCard}>
              <div className={styles.dashboardStreakCard__icon}>
                <span className="material-symbols-rounded">edit_note</span>
              </div>
              <div className={styles.dashboardStreakCard__info}>
                <span className={styles.dashboardStreakCard__value}>{todayWords.toLocaleString()}</span>
                <span className={styles.dashboardStreakCard__label}>Words Today</span>
              </div>
              {state.settings.dailyWordGoal > 0 && (
                <div className={styles.dashboardStreakCard__best}>
                  Goal: {state.settings.dailyWordGoal.toLocaleString()}
                </div>
              )}
            </div>

            <div className={styles.dashboardStreakCard}>
              <div className={styles.dashboardStreakCard__icon}>
                <span className="material-symbols-rounded">calendar_month</span>
              </div>
              <div className={styles.dashboardStreakCard__info}>
                <span className={styles.dashboardStreakCard__value}>{progress.totalSessions}</span>
                <span className={styles.dashboardStreakCard__label}>Total Sessions</span>
              </div>
            </div>
          </div>
        )}

        {/* Daily Goal Progress */}
        {state.settings.dailyWordGoal > 0 && (
          <div className={styles.dashboardGoal}>
            <h4>
              <span className="material-symbols-rounded">track_changes</span>
              Daily Target
            </h4>
            <div className={styles.progressBar}>
              <div
                className={styles.progressBar__fill}
                style={{
                  width: `${dailyGoalPercent}%`,
                  background: dailyGoalPercent >= 100 ? 'var(--success, #22c55e)' : 'var(--accent)',
                }}
              />
            </div>
            <span className={styles.progressBar__label}>
              {todayWords.toLocaleString()} / {state.settings.dailyWordGoal.toLocaleString()} words ({dailyGoalPercent}%)
              {dailyGoalPercent >= 100 && ' -- Goal met!'}
            </span>
          </div>
        )}

        {/* Weekly Writing Activity */}
        {weeklyHistory.length > 0 && (
          <div className={styles.dashboardGoal}>
            <h4>
              <span className="material-symbols-rounded">bar_chart</span>
              Last 7 Days
            </h4>
            <div className={styles.weeklyChart}>
              {(() => {
                // Build a full 7-day array
                const days: { date: string; label: string; words: number; goalMet: boolean }[] = [];
                for (let i = 6; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const dateStr = d.toISOString().slice(0, 10);
                  const entry = weeklyHistory.find(h => h.date === dateStr);
                  days.push({
                    date: dateStr,
                    label: d.toLocaleDateString(undefined, { weekday: 'short' }),
                    words: entry?.wordsWritten ?? 0,
                    goalMet: entry?.goalMet ?? false,
                  });
                }
                const maxWords = Math.max(...days.map(d => d.words), 1);
                return days.map(day => (
                  <div key={day.date} className={styles.weeklyChart__day}>
                    <div className={styles.weeklyChart__barWrap}>
                      <div
                        className={`${styles.weeklyChart__bar} ${day.goalMet ? styles['weeklyChart__bar--goalMet'] : ''}`}
                        style={{ height: `${Math.max(2, (day.words / maxWords) * 100)}%` }}
                        title={`${day.words.toLocaleString()} words`}
                      />
                    </div>
                    <span className={styles.weeklyChart__label}>{day.label}</span>
                    <span className={styles.weeklyChart__value}>{day.words > 0 ? day.words.toLocaleString() : '--'}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Novel goal progress */}
        {state.settings.novelWordGoal > 0 && (
          <div className={styles.dashboardGoal}>
            <h4>
              <span className="material-symbols-rounded">flag</span>
              Novel Goal Progress
            </h4>
            <div className={styles.progressBar}>
              <div
                className={styles.progressBar__fill}
                style={{ width: `${novelGoalPercent}%` }}
              />
            </div>
            <span className={styles.progressBar__label}>
              {stats.totalWords.toLocaleString()} / {state.settings.novelWordGoal.toLocaleString()} words ({novelGoalPercent}%)
            </span>
          </div>
        )}

        {/* Status breakdown */}
        <div className={styles.dashboardStatuses}>
          <h4>
            <span className="material-symbols-rounded">pie_chart</span>
            Chapter Status
          </h4>
          <div className={styles.statusBars}>
            <StatusBar label="Final" count={stats.completedChapters} total={stats.totalChapters} color="var(--success)" />
            <StatusBar label="Revised" count={stats.revisedChapters} total={stats.totalChapters} color="var(--accent)" />
            <StatusBar label="Draft" count={stats.draftChapters} total={stats.totalChapters} color="var(--warning)" />
            <StatusBar label="Planned" count={stats.plannedChapters} total={stats.totalChapters} color="var(--text-muted)" />
          </div>
        </div>

        {/* Chapter heatmap */}
        <div className={styles.dashboardHeatmap}>
          <h4>
            <span className="material-symbols-rounded">grid_view</span>
            Chapter Word Count
          </h4>
          <div className={styles.heatmapGrid}>
            {stats.chapterStats.map((ch, idx) => {
              const maxWords = Math.max(...stats.chapterStats.map(c => c.words), 1);
              const intensity = ch.words / maxWords;
              return (
                <div
                  key={ch.id}
                  className={styles.heatmapCell}
                  title={`${ch.title}: ${ch.words.toLocaleString()} words`}
                  style={{
                    opacity: 0.2 + intensity * 0.8,
                    background: `var(--accent)`
                  }}
                >
                  <span className={styles.heatmapCell__number}>{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chapter table */}
        <div className={styles.dashboardTable}>
          <h4>
            <span className="material-symbols-rounded">table_rows</span>
            Chapter Details
          </h4>
          <div className={styles.tableWrapper}>
            <table className={styles.chapterTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Words</th>
                  <th>Status</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {stats.chapterStats.map((ch, idx) => {
                  const goalPercent = ch.wordGoal > 0 ? Math.min(100, Math.round((ch.words / ch.wordGoal) * 100)) : -1;
                  return (
                    <tr key={ch.id}>
                      <td className={styles.tableNum}>{idx + 1}</td>
                      <td className={styles.tableTitle}>{ch.title}</td>
                      <td>{ch.words.toLocaleString()}</td>
                      <td>
                        <span className={`${styles.tableStatus} ${styles[`tableStatus--${ch.status}`]}`}>
                          {ch.status}
                        </span>
                      </td>
                      <td>
                        {goalPercent >= 0 ? (
                          <div className={styles.miniProgress}>
                            <div className={styles.miniProgress__fill} style={{ width: `${goalPercent}%` }} />
                            <span>{goalPercent}%</span>
                          </div>
                        ) : (
                          <span className={styles.tableNoGoal}>--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className={styles.statusBarItem}>
      <div className={styles.statusBarItem__label}>
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className={styles.statusBarTrack}>
        <div
          className={styles.statusBarTrack__fill}
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}
