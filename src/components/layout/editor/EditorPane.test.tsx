/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { EditorPane } from './EditorPane';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    activeChapter: {
      id: 'ch-1',
      title: 'Chapter 4 \u2014 The Corridor',
      content: 'Hello world test.',
      status: 'draft',
      updatedAt: Date.now() - 12 * 60_000,
      wordGoal: 1500,
      tags: [],
      scenes: [],
      summary: '',
      pov: '',
      order: 1,
      novelId: 'n-1',
    },
    updateChapterImmediate: vi.fn(),
  }),
}));

describe('EditorPane', () => {
  it('renders document header with chapter title', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<EditorPane />); });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toContain('Chapter 4');
    expect(container.textContent).toContain('Draft');
    act(() => root.unmount());
  });

  it('renders word count and reading time', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<EditorPane />); });

    expect(container.textContent).toContain('words');
    expect(container.textContent).toContain('min read');
    act(() => root.unmount());
  });

  it('renders children when provided', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<EditorPane><div>Custom editor</div></EditorPane>); });

    expect(container.textContent).toContain('Custom editor');
    act(() => root.unmount());
  });
});
