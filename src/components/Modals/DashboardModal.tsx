import { useMemo, useEffect, useState, useCallback } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { getProjectMetrics } from '@/lib/projectMetrics';
import {
  recordDailyWords,
  getWeeklyHistory,
  getMonthlyHistory,
  type DailyProgress,
  type ProgressData,
} from '@/lib/progressTracker';
import { getGoalTrendSnapshots, upsertGoalTrendSnapshot } from '@/lib/storage';
import { COMMAND_IDS, type CommandId } from '@/lib/commands';
import styles from './Modals.module.css';

interface DashboardModalProps {
  open: boolean;
  onClose: () => void;
  onAction?: (action: CommandId) => void;
}

const OVERDUE_DAYS = 14;

export function DashboardModal({ open, onClose, onAction }: DashboardModalProps) {
  const { state, setActiveChapter, updateSettings } = useApp();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [weeklyHistory, setWeeklyHistory] = useState<DailyProgress[]>([]);
  const [monthlyHistory, setMonthlyHistory] = useState<DailyProgress[]>([]);
  const [editingGoal, setEditingGoal] = useState<'daily' | 'novel' | 'deadline' | null>(null);
  const [goalInputValue, setGoalInputValue] = useState('');

  const stats = useMemo(() => getProjectMetrics(state.chapters), [state.chapters]);

  const overdue = useMemo(() => {
    const cutoff = Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000;

    const chapters = stats.chapters
      .filter(ch => ch.status !== 'final' && ch.updatedAt < cutoff)
      .sort((a, b) => a.updatedAt - b.updatedAt);

    const scenes = state.chapters.flatMap((chapter, chapterIdx) =>
      chapter.scenes
        .filter(scene => scene.status !== 'final')
        .map((scene, sceneIdx) => ({
          id: scene.id,
          title: scene.title || `Scene ${sceneIdx + 1}`,
          chapterId: chapter.id,
          chapterTitle: chapter.title || `Chapter ${chapterIdx + 1}`,
          chapterUpdatedAt: chapter.updatedAt,
        }))
        .filter(scene => scene.chapterUpdatedAt < cutoff)
    );

    return { chapters, scenes };
  }, [state.chapters, stats.chapters]);

  // Record progress and load history when modal opens
  useEffect(() => {
    if (open) {
      const data = recordDailyWords(stats.totalWords, state.settings.dailyWordGoal);
      setProgress(data);
      const monthly = getMonthlyHistory();
      const weekly = getWeeklyHistory();
      setWeeklyHistory(weekly);
      setMonthlyHistory(monthly);

      const today = new Date().toISOString().slice(0, 10);
      const todayEntry = monthly.find(d => d.date === today);
      const wordsToday = todayEntry?.wordsWritten ?? 0;
      upsertGoalTrendSnapshot({
        date: today,
        wordsToday,
        dailyGoal: state.settings.dailyWordGoal,
        goalMet: state.settings.dailyWordGoal > 0 && wordsToday >= state.settings.dailyWordGoal,
      });
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

  const goalTrend = (() => {
    const snapshots = getGoalTrendSnapshots(8);
    if (snapshots.length === 0) return null;

    const today = snapshots[snapshots.length - 1];
    const previousSeven = snapshots.slice(Math.max(0, snapshots.length - 8), snapshots.length - 1);
    const previousAvg = previousSeven.length > 0
      ? Math.round(previousSeven.reduce((sum, snap) => sum + snap.wordsToday, 0) / previousSeven.length)
      : 0;

    return {
      today,
      previousAvg,
      delta: today.wordsToday - previousAvg,
      previousDays: previousSeven.length,
    };
  })();

  // Deadline calculations
  const deadlineInfo = useMemo(() => {
    const deadline = state.settings.novelDeadline;
    if (!deadline) return null;

    const deadlineDate = new Date(deadline + 'T23:59:59');
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const wordsRemaining = Math.max(0, (state.settings.novelWordGoal || 0) - stats.totalWords);
    const dailyNeeded = daysRemaining > 0 ? Math.ceil(wordsRemaining / daysRemaining) : wordsRemaining;

    return {
      date: deadline,
      daysRemaining,
      wordsRemaining,
      dailyNeeded,
      isPast: daysRemaining < 0,
      formattedDate: deadlineDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    };
  }, [state.settings.novelDeadline, state.settings.novelWordGoal, stats.totalWords]);

  const chapterLabel = state.projectType === 'screenplay' ? 'Scenes' : 'Chapters';
  const chapterSingleLabel = state.projectType === 'screenplay' ? 'scene' : 'chapter';

  const resumeChapter = useMemo(() => {
    if (stats.chapters.length === 0) return null;
    return [...stats.chapters].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }, [stats.chapters]);

  const maxChapterWords = Math.max(...stats.chapters.map(c => c.words), 1);

  const handleStartEditGoal = useCallback((type: 'daily' | 'novel' | 'deadline') => {
    setEditingGoal(type);
    if (type === 'daily') setGoalInputValue(String(state.settings.dailyWordGoal || ''));
    else if (type === 'novel') setGoalInputValue(String(state.settings.novelWordGoal || ''));
    else setGoalInputValue(state.settings.novelDeadline || '');
  }, [state.settings.dailyWordGoal, state.settings.novelWordGoal, state.settings.novelDeadline]);

  const handleSaveGoal = useCallback(() => {
    if (!editingGoal) return;
    if (editingGoal === 'daily') {
      updateSettings({ dailyWordGoal: parseInt(goalInputValue) || 0 });
    } else if (editingGoal === 'novel') {
      updateSettings({ novelWordGoal: parseInt(goalInputValue) || 0 });
    } else {
      updateSettings({ novelDeadline: goalInputValue });
    }
    setEditingGoal(null);
  }, [editingGoal, goalInputValue, updateSettings]);

  return (
    <Dialog open={open} onClose={onClose} title="Project Dashboard" size="large">
      <div className={styles.dashboardGrid}>
        <div className={styles.dashboardOverview}>
          <button className={styles.dashboardActionCard} onClick={() => onAction?.(COMMAND_IDS.WORD_COUNT)}>
            <span className={styles.dashboardStat__value}>{stats.totalWords.toLocaleString()}</span>
            <span className={styles.dashboardStat__label}>Total Words</span>
          </button>
          <div className={styles.dashboardStat}>
            <span className={styles.dashboardStat__value}>{stats.totalChapters}</span>
            <span className={styles.dashboardStat__label}>{chapterLabel}</span>
          </div>
          <button className={styles.dashboardActionCard} onClick={() => onAction?.(COMMAND_IDS.ANALYSIS)}>
            <span className={styles.dashboardStat__value}>{stats.avgWordsPerChapter.toLocaleString()}</span>
            <span className={styles.dashboardStat__label}>Avg per {chapterSingleLabel}</span>
          </button>
          <button className={styles.dashboardActionCard} onClick={() => onAction?.(COMMAND_IDS.CHARACTER_BIBLE)}>
            <span className={styles.dashboardStat__value}>{stats.statusCounts.final}</span>
            <span className={styles.dashboardStat__label}>Completed</span>
          </button>
        </div>

        {progress && (
          <div className={styles.dashboardStreakRow}>
            <div className={styles.dashboardStreakCard}>
              <div className={styles.dashboardStreakCard__icon}><span className="material-symbols-rounded">local_fire_department</span></div>
              <div className={styles.dashboardStreakCard__info}>
                <span className={styles.dashboardStreakCard__value}>{progress.streak.current}</span>
                <span className={styles.dashboardStreakCard__label}>Day Streak</span>
              </div>
              <div className={styles.dashboardStreakCard__best}>Best: {progress.streak.longest}</div>
            </div>

            <div className={styles.dashboardStreakCard}>
              <div className={styles.dashboardStreakCard__icon}><span className="material-symbols-rounded">edit_note</span></div>
              <div className={styles.dashboardStreakCard__info}>
                <span className={styles.dashboardStreakCard__value}>{todayWords.toLocaleString()}</span>
                <span className={styles.dashboardStreakCard__label}>Words Today</span>
              </div>
              {state.settings.dailyWordGoal > 0 && <div className={styles.dashboardStreakCard__best}>Goal: {state.settings.dailyWordGoal.toLocaleString()}</div>}
            </div>

            <div className={styles.dashboardStreakCard}>
              <div className={styles.dashboardStreakCard__icon}><span className="material-symbols-rounded">calendar_month</span></div>
              <div className={styles.dashboardStreakCard__info}>
                <span className={styles.dashboardStreakCard__value}>{progress.totalSessions}</span>
                <span className={styles.dashboardStreakCard__label}>Total Sessions</span>
              </div>
            </div>
          </div>
        )}

        {/* Writing Goals — inline editable */}
        <div className={styles.dashboardGoal}>
          <h4><span className="material-symbols-rounded">flag</span>Writing Goals</h4>
          <div className={styles.goalCards}>
            <div className={styles.goalCard}>
              <div className={styles.goalCard__header}>
                <span className={styles.goalCard__title}>Daily Word Goal</span>
                <button className={styles.goalCard__editBtn} onClick={() => handleStartEditGoal('daily')}>
                  <span className="material-symbols-rounded">edit</span>
                </button>
              </div>
              {editingGoal === 'daily' ? (
                <div className={styles.goalCard__editRow}>
                  <input
                    type="number"
                    className={styles.goalCard__input}
                    value={goalInputValue}
                    onChange={e => setGoalInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') setEditingGoal(null); }}
                    placeholder="e.g. 1000"
                    autoFocus
                  />
                  <Button variant="primary" size="small" onClick={handleSaveGoal}>Save</Button>
                </div>
              ) : (
                <>
                  <span className={styles.goalCard__value}>
                    {state.settings.dailyWordGoal > 0 ? `${state.settings.dailyWordGoal.toLocaleString()} words/day` : 'Not set'}
                  </span>
                  {state.settings.dailyWordGoal > 0 && (
                    <div className={styles.progressBar}>
                      <div className={styles.progressBar__fill} style={{ width: `${dailyGoalPercent}%`, background: dailyGoalPercent >= 100 ? 'var(--success, #22c55e)' : 'var(--accent)' }} />
                    </div>
                  )}
                  {state.settings.dailyWordGoal > 0 && (
                    <span className={styles.goalCard__meta}>
                      {todayWords.toLocaleString()} / {state.settings.dailyWordGoal.toLocaleString()} ({dailyGoalPercent}%)
                      {dailyGoalPercent >= 100 && ' — Goal met!'}
                    </span>
                  )}
                </>
              )}
            </div>

            <div className={styles.goalCard}>
              <div className={styles.goalCard__header}>
                <span className={styles.goalCard__title}>Novel Word Goal</span>
                <button className={styles.goalCard__editBtn} onClick={() => handleStartEditGoal('novel')}>
                  <span className="material-symbols-rounded">edit</span>
                </button>
              </div>
              {editingGoal === 'novel' ? (
                <div className={styles.goalCard__editRow}>
                  <input
                    type="number"
                    className={styles.goalCard__input}
                    value={goalInputValue}
                    onChange={e => setGoalInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') setEditingGoal(null); }}
                    placeholder="e.g. 80000"
                    autoFocus
                  />
                  <Button variant="primary" size="small" onClick={handleSaveGoal}>Save</Button>
                </div>
              ) : (
                <>
                  <span className={styles.goalCard__value}>
                    {state.settings.novelWordGoal > 0 ? `${state.settings.novelWordGoal.toLocaleString()} words` : 'Not set'}
                  </span>
                  {state.settings.novelWordGoal > 0 && (
                    <div className={styles.progressBar}>
                      <div className={styles.progressBar__fill} style={{ width: `${novelGoalPercent}%` }} />
                    </div>
                  )}
                  {state.settings.novelWordGoal > 0 && (
                    <span className={styles.goalCard__meta}>
                      {stats.totalWords.toLocaleString()} / {state.settings.novelWordGoal.toLocaleString()} ({novelGoalPercent}%)
                    </span>
                  )}
                </>
              )}
            </div>

            <div className={styles.goalCard}>
              <div className={styles.goalCard__header}>
                <span className={styles.goalCard__title}>Deadline</span>
                <button className={styles.goalCard__editBtn} onClick={() => handleStartEditGoal('deadline')}>
                  <span className="material-symbols-rounded">edit</span>
                </button>
              </div>
              {editingGoal === 'deadline' ? (
                <div className={styles.goalCard__editRow}>
                  <input
                    type="date"
                    className={styles.goalCard__input}
                    value={goalInputValue}
                    onChange={e => setGoalInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveGoal(); if (e.key === 'Escape') setEditingGoal(null); }}
                    autoFocus
                  />
                  <Button variant="primary" size="small" onClick={handleSaveGoal}>Save</Button>
                </div>
              ) : deadlineInfo ? (
                <>
                  <span className={styles.goalCard__value}>{deadlineInfo.formattedDate}</span>
                  <span className={`${styles.goalCard__meta} ${deadlineInfo.isPast ? styles['goalCard__meta--overdue'] : ''}`}>
                    {deadlineInfo.isPast
                      ? `${Math.abs(deadlineInfo.daysRemaining)} days overdue`
                      : `${deadlineInfo.daysRemaining} days remaining`}
                  </span>
                  {!deadlineInfo.isPast && deadlineInfo.wordsRemaining > 0 && state.settings.novelWordGoal > 0 && (
                    <span className={styles.goalCard__meta}>
                      {deadlineInfo.dailyNeeded.toLocaleString()} words/day needed
                    </span>
                  )}
                </>
              ) : (
                <span className={styles.goalCard__value}>Not set</span>
              )}
            </div>
          </div>

          {goalTrend && (
            <div className={styles.dashboardTrend}>
              <span>Today: {goalTrend.today.wordsToday.toLocaleString()}</span>
              <span>Last {goalTrend.previousDays || 1}d avg: {goalTrend.previousAvg.toLocaleString()}</span>
              <span className={goalTrend.delta >= 0 ? styles.dashboardTrend__positive : styles.dashboardTrend__negative}>
                {goalTrend.delta >= 0 ? '+' : ''}{goalTrend.delta.toLocaleString()} vs trend
              </span>
            </div>
          )}
        </div>

        <div className={styles.dashboardGoal}>
          <h4><span className="material-symbols-rounded">bolt</span>Quick Actions</h4>
          <div className={styles.dashboardQuickActions}>
            <button
              className={styles.dashboardQuickActionBtn}
              onClick={() => {
                if (!resumeChapter) return;
                setActiveChapter(resumeChapter.id);
                onClose();
              }}
            >
              Resume last {chapterSingleLabel}
            </button>
            <button className={styles.dashboardQuickActionBtn} onClick={() => onAction?.(COMMAND_IDS.NEW_CHAPTER)}>
              {state.projectType === 'screenplay' ? 'Create Scene' : 'Create Chapter'}
            </button>
            <button className={styles.dashboardQuickActionBtn} onClick={() => onAction?.(COMMAND_IDS.ANALYSIS)}>
              Open analysis
            </button>
            <button className={styles.dashboardQuickActionBtn} onClick={() => onAction?.(COMMAND_IDS.SCENE_TEMPLATES)}>
              Open scene templates
            </button>
          </div>
        </div>

        <div className={styles.dashboardGoal}>
          <h4><span className="material-symbols-rounded">warning</span>Overdue Chapters & Scenes</h4>
          <div className={styles.dashboardOverdue}>
            <span>{overdue.chapters.length} chapters and {overdue.scenes.length} scenes not updated in {OVERDUE_DAYS}+ days.</span>
            {overdue.chapters.slice(0, 3).map(ch => (
              <button key={ch.id} className={styles.dashboardOverdueItem} onClick={() => { setActiveChapter(ch.id); onClose(); }}>
                {ch.title} · {ch.words.toLocaleString()} words
              </button>
            ))}
            {overdue.scenes.slice(0, 3).map(scene => (
              <button key={scene.id} className={styles.dashboardOverdueItem} onClick={() => { setActiveChapter(scene.chapterId); onClose(); }}>
                {scene.title} in {scene.chapterTitle}
              </button>
            ))}
          </div>
        </div>

        {weeklyHistory.length > 0 && (
          <div className={styles.dashboardGoal}>
            <h4><span className="material-symbols-rounded">bar_chart</span>Last 7 Days</h4>
            <div className={styles.weeklyChart}>
              {(() => {
                const days: { date: string; label: string; words: number; goalMet: boolean }[] = [];
                for (let i = 6; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const dateStr = d.toISOString().slice(0, 10);
                  const entry = weeklyHistory.find(h => h.date === dateStr);
                  days.push({ date: dateStr, label: d.toLocaleDateString(undefined, { weekday: 'short' }), words: entry?.wordsWritten ?? 0, goalMet: entry?.goalMet ?? false });
                }
                const maxWords = Math.max(...days.map(d => d.words), 1);
                return days.map(day => (
                  <div key={day.date} className={styles.weeklyChart__day}>
                    <div className={styles.weeklyChart__barWrap}>
                      <div className={`${styles.weeklyChart__bar} ${day.goalMet ? styles['weeklyChart__bar--goalMet'] : ''}`} style={{ height: `${Math.max(2, (day.words / maxWords) * 100)}%` }} title={`${day.words.toLocaleString()} words`} />
                    </div>
                    <span className={styles.weeklyChart__label}>{day.label}</span>
                    <span className={styles.weeklyChart__value}>{day.words > 0 ? day.words.toLocaleString() : '--'}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {monthlyHistory.length > 7 && (
          <div className={styles.dashboardGoal}>
            <h4><span className="material-symbols-rounded">calendar_month</span>Last 30 Days</h4>
            <div className={styles.monthlyChart}>
              {(() => {
                const days: { date: string; words: number; goalMet: boolean }[] = [];
                for (let i = 29; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const dateStr = d.toISOString().slice(0, 10);
                  const entry = monthlyHistory.find(h => h.date === dateStr);
                  days.push({ date: dateStr, words: entry?.wordsWritten ?? 0, goalMet: entry?.goalMet ?? false });
                }
                const maxWords = Math.max(...days.map(d => d.words), 1);
                return days.map(day => (
                  <div
                    key={day.date}
                    className={`${styles.monthlyChart__cell} ${day.goalMet ? styles['monthlyChart__cell--goalMet'] : ''}`}
                    style={{ opacity: day.words > 0 ? 0.3 + (day.words / maxWords) * 0.7 : 0.1 }}
                    title={`${day.date}: ${day.words.toLocaleString()} words${day.goalMet ? ' (goal met)' : ''}`}
                  />
                ));
              })()}
            </div>
          </div>
        )}

        <div className={styles.dashboardStatuses}>
          <h4><span className="material-symbols-rounded">pie_chart</span>Chapter Status</h4>
          <div className={styles.statusBars}>
            <StatusBar label="Final" count={stats.statusCounts.final} total={stats.totalChapters} color="var(--success)" />
            <StatusBar label="Revised" count={stats.statusCounts.revised} total={stats.totalChapters} color="var(--accent)" />
            <StatusBar label="Draft" count={stats.statusCounts.draft} total={stats.totalChapters} color="var(--warning)" />
            <StatusBar label="Planned" count={stats.statusCounts.planned} total={stats.totalChapters} color="var(--text-muted)" />
          </div>
        </div>

        <div className={styles.dashboardHeatmap}>
          <h4><span className="material-symbols-rounded">grid_view</span>Chapter Word Count</h4>
          <div className={styles.heatmapGrid}>
            {stats.chapters.map((ch, idx) => {
              const intensity = ch.words / maxChapterWords;
              return (
                <div
                  key={ch.id}
                  className={styles.heatmapCell}
                  title={`${ch.title}: ${ch.words.toLocaleString()} words`}
                  style={{ opacity: 0.2 + intensity * 0.8, background: 'var(--accent)' }}
                >
                  <span className={styles.heatmapCell__number}>{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.dashboardTable}>
          <h4><span className="material-symbols-rounded">table_rows</span>Chapter Details</h4>
          <div className={styles.tableWrapper}>
            <table className={styles.chapterTable}>
              <thead><tr><th>#</th><th>Title</th><th>Words</th><th>Status</th><th>Progress</th></tr></thead>
              <tbody>
                {stats.chapters.map((ch, idx) => {
                  const goalPercent = ch.wordGoal > 0 ? Math.min(100, Math.round((ch.words / ch.wordGoal) * 100)) : -1;
                  return (
                    <tr key={ch.id}>
                      <td className={styles.tableNum}>{idx + 1}</td>
                      <td className={styles.tableTitle}>{ch.title}</td>
                      <td>{ch.words.toLocaleString()}</td>
                      <td><span className={`${styles.tableStatus} ${styles[`tableStatus--${ch.status}`]}`}>{ch.status}</span></td>
                      <td>
                        {goalPercent >= 0 ? (
                          <div className={styles.miniProgress}><div className={styles.miniProgress__fill} style={{ width: `${goalPercent}%` }} /><span>{goalPercent}%</span></div>
                        ) : <span className={styles.tableNoGoal}>--</span>}
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
      <div className={styles.statusBarItem__label}><span>{label}</span><span>{count}</span></div>
      <div className={styles.statusBarTrack}><div className={styles.statusBarTrack__fill} style={{ width: `${percent}%`, background: color }} /></div>
    </div>
  );
}
