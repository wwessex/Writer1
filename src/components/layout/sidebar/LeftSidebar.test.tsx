/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { LeftSidebar } from './LeftSidebar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockSetActiveChapter = vi.fn();
const mockCreateChapter = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      projectType: 'book',
      novelTitle: 'My Horror Novel',
      novelId: 'n-1',
      activeChapterId: 'ch-4',
      chapters: [
        { id: 'ch-1', title: 'Chapter 1 \u2014 Prologue', order: 1, content: null, scenes: [], tags: [], status: 'draft', summary: '', pov: '', wordGoal: 0, novelId: 'n-1', updatedAt: 0 },
        { id: 'ch-2', title: 'Chapter 2 \u2014 The Party', order: 2, content: null, scenes: [], tags: [], status: 'draft', summary: '', pov: '', wordGoal: 0, novelId: 'n-1', updatedAt: 0 },
        { id: 'ch-4', title: 'Chapter 4 \u2014 The Corridor', order: 4, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test content here.' }] }] }, scenes: [{ id: 's-1', title: 'Scene 1', summary: '', status: 'draft', pov: '', tags: [], wordGoal: 0 }], tags: [], status: 'draft', summary: '', pov: '', wordGoal: 0, novelId: 'n-1', updatedAt: 0 },
      ],
      settings: { sidebarHidden: false },
    },
    setActiveChapter: mockSetActiveChapter,
    createChapter: mockCreateChapter,
  }),
}));

vi.mock('@/lib/projectMetrics', () => ({
  getProjectMetrics: () => ({
    totalWords: 42318,
    totalChapters: 3,
    chapters: [],
    totalSentences: 0,
    totalParagraphs: 0,
    totalCharacters: 0,
    avgWordsPerChapter: 0,
    statusCounts: { planned: 0, draft: 3, revised: 0, final: 0 },
  }),
}));

describe('LeftSidebar', () => {
  it('renders collapsed state with icon-only buttons', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar collapsed />); });

    expect(container.querySelector('button[aria-label="New document"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Search"]')).toBeTruthy();
    act(() => root.unmount());
  });

  it('invokes onSearch when collapsed search button is clicked', () => {
    const onSearch = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar collapsed onSearch={onSearch} />); });

    const searchButton = container.querySelector('button[aria-label="Search"]') as HTMLButtonElement;
    act(() => { searchButton.click(); });

    expect(onSearch).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('renders expanded state with project header', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    expect(container.textContent).toContain('My Horror Novel');
    expect(container.textContent).toContain('42,318 words');
    act(() => root.unmount());
  });

  it('renders action buttons in expanded state', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    expect(container.textContent).toContain('New');
    expect(container.textContent).toContain('Folder');
    expect(container.textContent).toContain('Import');
    act(() => root.unmount());
  });

  it('renders chapter tree with section label', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    expect(container.textContent).toContain('Chapters');
    act(() => root.unmount());
  });

  it('renders chapter rows', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    expect(container.textContent).toContain('Chapter 1');
    expect(container.textContent).toContain('Chapter 4');
    act(() => root.unmount());
  });

  it('renders search input', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    const input = container.querySelector('input[placeholder="Search in project"]');
    expect(input).toBeTruthy();
    act(() => root.unmount());
  });
});
