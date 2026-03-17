/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chapter, Novel } from '@/types';
import { AppProvider, useApp } from './AppContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  addChapterMock: vi.fn(async () => undefined),
  deleteChapterMock: vi.fn(async () => undefined),
  updateChapterMock: vi.fn(async () => undefined),
  reorderChaptersMock: vi.fn(async () => undefined),
  createChapterMock: vi.fn((novelId: string, order: number): Chapter => ({
    id: `chapter-${order + 1}`,
    novelId,
    order,
    title: `Chapter ${order + 1}`,
    content: '',
    updatedAt: 0,
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
  })),
  loadDefaultNovelAndChaptersMock: vi.fn(),
}));

const baseNovel: Novel = { id: 'novel-1', title: 'Primary Novel', updatedAt: 1, projectType: 'book' };
mocks.loadDefaultNovelAndChaptersMock.mockImplementation(async () => ({ novel: baseNovel, chapters: [mocks.createChapterMock(baseNovel.id, 0)] }));

vi.mock('@/lib/storage', () => ({
  addChapter: mocks.addChapterMock,
  deleteChapter: mocks.deleteChapterMock,
  updateChapter: mocks.updateChapterMock,
  reorderChapters: mocks.reorderChaptersMock,
  createChapter: mocks.createChapterMock,
  deleteNovel: vi.fn(async () => undefined),
  updateNovel: vi.fn(async () => undefined),
  getStoryBlueprint: vi.fn(() => null),
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

describe('AppContext action flows', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof useApp>;

  beforeEach(async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    Object.values(mocks).forEach((mock) => { if ('mockClear' in mock) { mock.mockClear(); } });

    function Probe() { app = useApp(); return null; }
    await act(async () => {
      createRoot(container).render(<AppProvider><Probe /></AppProvider>);
    });
  });

  it('loads default novel and supports chapter CRUD and reorder undo/redo', async () => {
    await act(async () => { await app.loadNovel(); });
    expect(mocks.loadDefaultNovelAndChaptersMock).toHaveBeenCalledTimes(1);

    await act(async () => { await app.createChapter(); });
    const createdId = app.state.chapters[1].id;
    await act(async () => { app.updateChapter(createdId, { title: 'Renamed' }); });
    await act(async () => { await app.reorderChapters([createdId, app.state.chapters[0].id]); });
    await act(async () => { await app.undoReorder(); await app.redoReorder(); });
    await act(async () => { await app.deleteChapter(createdId); });

    expect(mocks.addChapterMock).toHaveBeenCalledTimes(1);
    expect(mocks.updateChapterMock).toHaveBeenCalledWith(createdId, { title: 'Renamed' });
    expect(mocks.reorderChaptersMock).toHaveBeenCalledTimes(3);
    expect(mocks.deleteChapterMock).toHaveBeenCalledWith(createdId);
  });
});
