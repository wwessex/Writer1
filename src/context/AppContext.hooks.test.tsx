/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Novel } from '@/types';
import { AppProvider, useApp, useActiveChapter, useSettings, useSavingState } from './AppContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  loadDefaultNovelAndChaptersMock: vi.fn(),
  createSnapshotMock: vi.fn(async () => ({ id: 'snap-1', chapterId: 'ch-1', createdAt: Date.now(), doc: { type: 'doc', content: [] } })),
}));

const baseNovel: Novel = { id: 'novel-1', title: 'Test Novel', updatedAt: 1, projectType: 'book' };
mocks.loadDefaultNovelAndChaptersMock.mockImplementation(async () => ({
  novel: baseNovel,
  chapters: [{
    id: 'ch-1', novelId: 'novel-1', order: 0, title: 'Chapter 1',
    content: { type: 'doc', content: [] }, updatedAt: 0, summary: '',
    pov: '', status: 'draft', tags: [], wordGoal: 0, scenes: [],
  }, {
    id: 'ch-2', novelId: 'novel-1', order: 1, title: 'Chapter 2',
    content: { type: 'doc', content: [] }, updatedAt: 0, summary: '',
    pov: '', status: 'draft', tags: [], wordGoal: 0, scenes: [],
  }],
}));

vi.mock('@/lib/storage', () => ({
  addChapter: vi.fn(async () => undefined),
  deleteChapter: vi.fn(async () => undefined),
  updateChapter: vi.fn(async () => undefined),
  reorderChapters: vi.fn(async () => undefined),
  createChapter: vi.fn(),
  deleteNovel: vi.fn(async () => undefined),
  updateNovel: vi.fn(async () => undefined),
  createSnapshot: mocks.createSnapshotMock,
}));

vi.mock('@/components/UI', () => ({ useToast: () => ({ showErrorToast: vi.fn(), showToast: vi.fn() }) }));
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return { ...actual, debounce: <T extends (...args: unknown[]) => void>(fn: T) => fn };
});
vi.mock('./services/appServices', async () => {
  const actual = await vi.importActual<typeof import('./services/appServices')>('./services/appServices');
  return {
    ...actual,
    loadDefaultNovelAndChapters: mocks.loadDefaultNovelAndChaptersMock,
    loadNovelAndChaptersById: vi.fn(async () => null),
    createNovelWithFirstChapter: vi.fn(),
    readSettingsFromLocalStorage: vi.fn((fallback) => fallback),
    persistSettingsToLocalStorage: vi.fn(),
  };
});

describe('AppContext hook error paths', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('useApp throws when used outside AppProvider', () => {
    const errors: Error[] = [];
    function BadComponent() {
      try { useApp(); } catch (e) { errors.push(e as Error); }
      return null;
    }
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => { root.render(<BadComponent />); });
    spy.mockRestore();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('useApp must be used within an AppProvider');
  });

  it('useActiveChapter throws when used outside AppProvider', () => {
    const errors: Error[] = [];
    function BadComponent() {
      try { useActiveChapter(); } catch (e) { errors.push(e as Error); }
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => { root.render(<BadComponent />); });
    spy.mockRestore();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('useActiveChapter must be used within an AppProvider');
  });

  it('useSettings throws when used outside AppProvider', () => {
    const errors: Error[] = [];
    function BadComponent() {
      try { useSettings(); } catch (e) { errors.push(e as Error); }
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => { root.render(<BadComponent />); });
    spy.mockRestore();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('useSettings must be used within an AppProvider');
  });

  it('useSavingState throws when used outside AppProvider', () => {
    const errors: Error[] = [];
    function BadComponent() {
      try { useSavingState(); } catch (e) { errors.push(e as Error); }
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => { root.render(<BadComponent />); });
    spy.mockRestore();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('useSavingState must be used within an AppProvider');
  });
});

describe('AppContext provided hooks', () => {
  let container: HTMLDivElement;
  let root: Root;
  let activeChapterResult: unknown;
  let settingsResult: unknown;
  let savingResult: unknown;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();

    function Probe() {
      activeChapterResult = useActiveChapter();
      settingsResult = useSettings();
      savingResult = useSavingState();
      return null;
    }
    await act(async () => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('useActiveChapter returns null when no chapter is selected', () => {
    expect(activeChapterResult).toBeNull();
  });

  it('useSettings returns settings object', () => {
    expect(settingsResult).toBeDefined();
    expect(typeof (settingsResult as { theme: string }).theme).toBe('string');
  });

  it('useSavingState returns a boolean', () => {
    expect(typeof savingResult).toBe('boolean');
  });
});

describe('AppContext setActiveChapter auto-snapshot', () => {
  let container: HTMLDivElement;
  let root: Root;
  let app: ReturnType<typeof useApp>;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();

    function Probe() { app = useApp(); return null; }
    await act(async () => {
      root.render(<AppProvider><Probe /></AppProvider>);
    });
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('creates auto-snapshot when switching chapters with content', async () => {
    // Load the novel with two chapters
    await act(async () => { await app.loadNovel(); });

    // Select ch-1
    await act(async () => { app.setActiveChapter('ch-1'); });
    expect(app.state.activeChapterId).toBe('ch-1');

    // Switch to ch-2 — should auto-snapshot ch-1
    await act(async () => { app.setActiveChapter('ch-2'); });
    expect(app.state.activeChapterId).toBe('ch-2');
    expect(mocks.createSnapshotMock).toHaveBeenCalledWith(
      'ch-1',
      { type: 'doc', content: [] },
      'Auto'
    );
  });

  it('updateSettings dispatches SET_SETTINGS', async () => {
    await act(async () => { await app.loadNovel(); });
    const originalGoal = app.state.settings.dailyWordGoal;
    await act(async () => { app.updateSettings({ dailyWordGoal: 2000 }); });
    expect(app.state.settings.dailyWordGoal).toBe(2000);
    expect(app.state.settings.dailyWordGoal).not.toBe(originalGoal);
  });

  it('updateNovelTitle dispatches and persists', async () => {
    await act(async () => { await app.loadNovel(); });
    await act(async () => { app.updateNovelTitle('New Title'); });
    expect(app.state.novelTitle).toBe('New Title');
  });
});
