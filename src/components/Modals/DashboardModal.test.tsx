/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockUpdateSettings = vi.fn();
const mockSetActiveChapter = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      projectType: 'book',
      chapters: [
        {
          id: 'ch-1',
          title: 'Chapter One',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world test content here for word count testing.' }] }] },
          status: 'draft',
          tags: [],
          wordGoal: 500,
          scenes: [],
          updatedAt: Date.now(),
          pov: 'Alice',
          summary: '',
          order: 0,
        },
        {
          id: 'ch-2',
          title: 'Chapter Two',
          content: null,
          status: 'planned',
          tags: [],
          wordGoal: 0,
          scenes: [],
          updatedAt: Date.now() - 86400000 * 20,
          pov: '',
          summary: '',
          order: 1,
        },
      ],
      settings: {
        dailyWordGoal: 500,
        novelWordGoal: 50000,
        novelDeadline: '2026-06-30',
        theme: 'light',
        goalConfiguration: { dailyWordTarget: 500, weeklyWordTarget: 3000, draftCompletionDeadline: '2026-06-30', milestoneCheckpoints: [{ id: 'm1', label: 'Quarter Draft', targetWords: 10000, targetDate: '2026-03-15' }] },
      },
    },
    setActiveChapter: mockSetActiveChapter,
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock('@/lib/projectMetrics', () => ({
  getProjectMetrics: (chapters: Array<{ id: string; title: string; content: unknown; status: string; wordGoal: number; updatedAt: number }>) => ({
    chapters: chapters.map((ch, i) => ({
      id: ch.id,
      title: ch.title || `Chapter ${i + 1}`,
      words: ch.content ? 9 : 0,
      sentences: ch.content ? 1 : 0,
      paragraphs: ch.content ? 1 : 0,
      characters: ch.content ? 50 : 0,
      status: ch.status,
      wordGoal: ch.wordGoal,
      updatedAt: ch.updatedAt,
    })),
    totalWords: 9,
    totalSentences: 1,
    totalParagraphs: 1,
    totalCharacters: 50,
    totalChapters: chapters.length,
    avgWordsPerChapter: 5,
    statusCounts: { planned: 1, draft: 1, revised: 0, final: 0 },
  }),
}));

vi.mock('@/lib/progressTracker', () => ({
  recordDailyWords: () => ({
    dailyHistory: [],
    streak: { current: 3, longest: 7, lastActiveDate: '2026-02-25' },
    totalSessions: 12,
    totalWordsAllTime: 5000,
  }),
  getWeeklyHistory: () => [
    { date: '2026-02-25', wordsWritten: 200, goalMet: false },
    { date: '2026-02-24', wordsWritten: 600, goalMet: true },
  ],
  getProgressSnapshots: () => [
    { date: '2026-02-24', totalWords: 5000, dailyGoal: 500, weeklyGoal: 3000, novelGoal: 50000 },
    { date: '2026-02-25', totalWords: 5400, dailyGoal: 500, weeklyGoal: 3000, novelGoal: 50000 },
  ],
  recordProgressSnapshot: vi.fn(),
  getMonthlyHistory: () => [
    { date: '2026-02-25', wordsWritten: 200, goalMet: false },
    { date: '2026-02-24', wordsWritten: 600, goalMet: true },
    { date: '2026-02-23', wordsWritten: 300, goalMet: false },
    { date: '2026-02-22', wordsWritten: 450, goalMet: false },
    { date: '2026-02-21', wordsWritten: 520, goalMet: true },
    { date: '2026-02-20', wordsWritten: 100, goalMet: false },
    { date: '2026-02-19', wordsWritten: 700, goalMet: true },
    { date: '2026-02-18', wordsWritten: 400, goalMet: false },
  ],
}));

vi.mock('@/lib/storage', () => ({
  getGoalTrendSnapshots: () => [
    { date: '2026-02-24', wordsToday: 600, dailyGoal: 500, goalMet: true },
    { date: '2026-02-25', wordsToday: 200, dailyGoal: 500, goalMet: false },
  ],
  upsertGoalTrendSnapshot: vi.fn(),
}));

vi.mock('@/lib/commands', () => ({
  COMMAND_IDS: {
    WORD_COUNT: 'word-count',
    ANALYSIS: 'analysis',
    CHARACTER_BIBLE: 'character-bible',
    NEW_CHAPTER: 'new-chapter',
    SCENE_TEMPLATES: 'scene-templates',
  },
}));

const mockShowToast = vi.fn();

vi.mock('@/components/UI', () => ({
  Dialog: ({ open, children, title }: { open: boolean; children?: ReactNode; title?: string }) =>
    open ? <div data-testid="dialog"><h2>{title}</h2>{children}</div> : null,
  Button: ({ children, onClick, disabled, size }: { children?: ReactNode; onClick?: () => void; disabled?: boolean; size?: string }) => (
    <button onClick={onClick} disabled={disabled} data-size={size}>{children}</button>
  ),
  useToast: () => ({ showToast: mockShowToast }),
}));

import { DashboardModal } from './DashboardModal';

describe('DashboardModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('renders nothing when closed', async () => {
    await act(async () => { root.render(<DashboardModal open={false} onClose={vi.fn()} />); });
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('renders dashboard with title when open', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Project Dashboard');
  });

  it('shows writing goal cards', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Writing Goals');
    expect(container.textContent).toContain('Daily Word Goal');
    expect(container.textContent).toContain('Novel Word Goal');
    expect(container.textContent).toContain('Deadline');
    expect(container.textContent).toContain('Weekly Word Target');
  });

  it('shows deadline info with days remaining', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('days remaining');
    expect(container.textContent).toContain('words/day needed');
  });

  it('shows daily word goal progress', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('500');
    expect(container.textContent).toContain('words/day');
  });

  it('shows streak information', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Day Streak');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('Best: 7');
  });

  it('shows chapter status breakdown', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Chapter Status');
    expect(container.textContent).toContain('Final');
    expect(container.textContent).toContain('Draft');
  });

  it('shows weekly chart', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Last 7 Days');
  });

  it('shows monthly chart when enough data', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Last 30 Days');
  });

  it('shows goal trend comparison', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('vs trend');
    expect(container.textContent).toContain('Quarter Draft');
  });

  it('allows inline editing of daily goal', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    // Find the edit button for daily goal
    const editBtns = Array.from(container.querySelectorAll('button'))
      .filter(btn => btn.querySelector('.material-symbols-rounded')?.textContent === 'edit');
    expect(editBtns.length).toBeGreaterThan(0);

    // Click the first edit button (daily goal)
    await act(async () => {
      editBtns[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Should now show an input field
    const input = container.querySelector('input[type="number"]');
    expect(input).toBeTruthy();

    // Click Save
    const saveBtn = Array.from(container.querySelectorAll('button'))
      .find(btn => btn.textContent?.includes('Save'));
    await act(async () => {
      saveBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mockUpdateSettings).toHaveBeenCalled();
  });

  it('shows overdue chapters section', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Overdue');
  });

  it('shows burn-down pace card', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Burn-down Pace');
  });

  it('shows quick actions', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Quick Actions');
    expect(container.textContent).toContain('Resume last');
    expect(container.textContent).toContain('Create Chapter');
  });

  it('shows chapter details table', async () => {
    await act(async () => { root.render(<DashboardModal open onClose={vi.fn()} />); });
    expect(container.textContent).toContain('Chapter Details');
    expect(container.textContent).toContain('Chapter One');
  });
});
