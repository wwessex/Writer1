/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setActiveChapterMock = vi.fn();
const onCloseMock = vi.fn();

const defaultChapters = [
  { id: 'c1', order: 0, title: 'Chapter One', status: 'draft', summary: 'A beginning', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] }, scenes: [], tags: [], wordGoal: 0, pov: '', novelId: 'n1', updatedAt: 0 },
  { id: 'c2', order: 1, title: 'Chapter Two', status: 'planned', summary: '', content: null, scenes: [], tags: [], wordGoal: 0, pov: '', novelId: 'n1', updatedAt: 0 },
];

const mockUseApp = vi.fn((): {
  state: { projectType: string; chapters: typeof defaultChapters };
  setActiveChapter: typeof setActiveChapterMock;
} => ({
  state: {
    projectType: 'book',
    chapters: defaultChapters,
  },
  setActiveChapter: setActiveChapterMock,
}));

vi.mock('@/components/UI', () => ({
  Dialog: ({ open, title, children }: { open: boolean; title: string; children?: ReactNode }) =>
    open ? <div data-testid="dialog"><h2>{title}</h2>{children}</div> : null,
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => mockUseApp(),
}));

vi.mock('@/lib/utils', () => ({
  editorToPlainText: (content: unknown) => content ? 'Hello world' : '',
  countWords: (text: string) => text.split(/\s+/).filter(Boolean).length,
}));

vi.mock('./Modals.module.css', () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { CorkboardModal } from './CorkboardModal';

describe('CorkboardModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    setActiveChapterMock.mockClear();
    onCloseMock.mockClear();
    mockUseApp.mockClear();
    mockUseApp.mockReturnValue({
      state: {
        projectType: 'book' as const,
        chapters: defaultChapters,
      },
      setActiveChapter: setActiveChapterMock,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('renders nothing when closed', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<CorkboardModal open={false} onClose={onCloseMock} />);
    });

    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('renders dialog with chapters', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<CorkboardModal open={true} onClose={onCloseMock} />);
    });

    const dialog = container.querySelector('[data-testid="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector('h2')!.textContent).toBe('Corkboard');

    // Should render two chapter cards (role="button")
    const cards = container.querySelectorAll('[role="button"]');
    expect(cards.length).toBe(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('shows chapter titles and status', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<CorkboardModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('Chapter One');
    expect(text).toContain('Chapter Two');
    expect(text).toContain('draft');
    expect(text).toContain('planned');
    // Word count for first chapter: "Hello world" = 2 words
    expect(text).toContain('2 words');
    // Summary for first chapter
    expect(text).toContain('A beginning');
    // Section count label
    expect(text).toContain('2 Chapters');

    await act(async () => {
      root.unmount();
    });
  });

  it('clicking card sets active chapter and closes', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<CorkboardModal open={true} onClose={onCloseMock} />);
    });

    const cards = container.querySelectorAll('[role="button"]');
    expect(cards.length).toBeGreaterThan(0);

    await act(async () => {
      cards[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setActiveChapterMock).toHaveBeenCalledWith('c1');
    expect(onCloseMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('shows empty state when no chapters', async () => {
    mockUseApp.mockReturnValue({
      state: {
        projectType: 'book' as const,
        chapters: [],
      },
      setActiveChapter: setActiveChapterMock,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<CorkboardModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('No chapters yet');

    // No cards rendered
    const cards = container.querySelectorAll('[role="button"]');
    expect(cards.length).toBe(0);

    await act(async () => {
      root.unmount();
    });
  });

  it('card size buttons toggle grid class', async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(<CorkboardModal open={true} onClose={onCloseMock} />);
    });

    // Find the size toggle buttons
    const buttons = Array.from(container.querySelectorAll('button'));
    const compactBtn = buttons.find(b => b.textContent === 'compact');
    const normalBtn = buttons.find(b => b.textContent === 'normal');
    const largeBtn = buttons.find(b => b.textContent === 'large');

    expect(compactBtn).toBeTruthy();
    expect(normalBtn).toBeTruthy();
    expect(largeBtn).toBeTruthy();

    // Default is 'normal', so the grid should have corkboardGrid--normal class
    let grid = container.querySelector('.corkboardGrid');
    expect(grid).not.toBeNull();
    expect(grid!.className).toContain('corkboardGrid--normal');

    // Click compact
    await act(async () => {
      compactBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    grid = container.querySelector('.corkboardGrid');
    expect(grid!.className).toContain('corkboardGrid--compact');

    // Click large
    await act(async () => {
      largeBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    grid = container.querySelector('.corkboardGrid');
    expect(grid!.className).toContain('corkboardGrid--large');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows correct section label for screenplay', async () => {
    mockUseApp.mockReturnValue({
      state: {
        projectType: 'screenplay' as const,
        chapters: defaultChapters,
      },
      setActiveChapter: setActiveChapterMock,
    });

    const root = createRoot(container);
    await act(async () => {
      root.render(<CorkboardModal open={true} onClose={onCloseMock} />);
    });

    const text = container.textContent || '';
    expect(text).toContain('Scenes');
    expect(text).not.toContain('Chapters');

    await act(async () => {
      root.unmount();
    });
  });
});
