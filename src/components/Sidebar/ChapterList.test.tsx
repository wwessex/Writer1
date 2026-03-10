/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockSetActiveChapter = vi.fn();
const mockCreateChapter = vi.fn();
const mockReorderChapters = vi.fn();
const mockDispatch = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      novelId: 'n-1',
      projectType: 'book',
      activeChapterId: 'ch-1',
      chapters: [
        {
          id: 'ch-1', title: 'Chapter One', order: 0, status: 'draft',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] },
          tags: [], wordGoal: 1000, scenes: [], updatedAt: Date.now(), pov: '', summary: '', novelId: 'n-1',
        },
        {
          id: 'ch-2', title: 'Chapter Two', order: 1, status: 'revised',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Goodbye' }] }] },
          tags: [], wordGoal: 0, scenes: [], updatedAt: Date.now() - 60000, pov: '', summary: '', novelId: 'n-1',
        },
      ],
      settings: { sidebarHidden: false },
    },
    dispatch: mockDispatch,
    setActiveChapter: mockSetActiveChapter,
    createChapter: mockCreateChapter,
    reorderChapters: mockReorderChapters,
  }),
}));

vi.mock('@/components/UI', () => ({
  IconButton: ({ onClick, label }: { onClick?: () => void; label?: string }) => (
    <button onClick={onClick} aria-label={label}>icon</button>
  ),
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock('@/components/UI/Tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useIsMobile', () => ({
  isMobileViewport: () => false,
}));

import { ChapterList } from './ChapterList';

describe('ChapterList', () => {
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

  it('renders chapter titles', async () => {
    await act(async () => { root.render(<ChapterList />); });
    expect(container.textContent).toContain('Chapter One');
    expect(container.textContent).toContain('Chapter Two');
  });

  it('renders chapter numbers', async () => {
    await act(async () => { root.render(<ChapterList />); });
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('2');
  });

  it('shows word count', async () => {
    await act(async () => { root.render(<ChapterList />); });
    expect(container.textContent).toContain('words');
  });

  it('marks active chapter as selected', async () => {
    await act(async () => { root.render(<ChapterList />); });
    const options = container.querySelectorAll('[role="option"]');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    expect(options[1].getAttribute('aria-selected')).toBe('false');
  });

  it('calls setActiveChapter on click', async () => {
    await act(async () => { root.render(<ChapterList />); });
    const options = container.querySelectorAll('[role="option"]');
    await act(async () => {
      options[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(mockSetActiveChapter).toHaveBeenCalledWith('ch-2');
  });

  it('shows status for non-planned chapters', async () => {
    await act(async () => { root.render(<ChapterList />); });
    expect(container.textContent).toContain('draft');
    expect(container.textContent).toContain('revised');
  });

  it('has navigation role', async () => {
    await act(async () => { root.render(<ChapterList />); });
    const nav = container.querySelector('[role="navigation"]');
    expect(nav).not.toBeNull();
  });

  it('renders header with Chapters title', async () => {
    await act(async () => { root.render(<ChapterList />); });
    expect(container.textContent).toContain('Chapters');
  });
});
