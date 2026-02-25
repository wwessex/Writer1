/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { RightInspector } from './RightInspector';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    activeChapter: {
      id: 'ch-1',
      title: 'Chapter One',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world test sentence.' }] }] },
      status: 'draft',
      tags: ['horror', 'suspense'],
      wordGoal: 1500,
      scenes: [],
      summary: 'A test chapter summary',
      pov: 'Sarah',
      order: 1,
      novelId: 'n-1',
      updatedAt: Date.now(),
    },
    updateChapter: vi.fn(),
  }),
}));

vi.mock('@/lib/storage', () => ({
  getSnapshots: vi.fn().mockResolvedValue([]),
}));

describe('RightInspector', () => {
  it('renders null when collapsed', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector collapsed />); });

    expect(container.innerHTML).toBe('');
    act(() => root.unmount());
  });

  it('renders tab header with all 5 tabs', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    expect(container.textContent).toContain('Info');
    expect(container.textContent).toContain('Notes');
    expect(container.textContent).toContain('Tags');
    expect(container.textContent).toContain('AI');
    expect(container.textContent).toContain('History');
    act(() => root.unmount());
  });

  it('shows Info tab content by default with real data', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    expect(container.textContent).toContain('Document');
    expect(container.textContent).toContain('Draft');
    expect(container.textContent).toContain('Goal Progress');
    act(() => root.unmount());
  });

  it('switches to Notes tab on click', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    const notesTab = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('Notes')
    ) as HTMLButtonElement;
    act(() => { notesTab.click(); });

    expect(container.textContent).toContain('Chapter Notes');
    act(() => root.unmount());
  });

  it('switches to Tags tab on click and shows real tags', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    const tagsTab = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('Tags')
    ) as HTMLButtonElement;
    act(() => { tagsTab.click(); });

    expect(container.textContent).toContain('horror');
    expect(container.textContent).toContain('suspense');
    act(() => root.unmount());
  });

  it('switches to AI tab on click', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    const aiTab = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.trim() === 'AI'
    ) as HTMLButtonElement;
    act(() => { aiTab.click(); });

    expect(container.textContent).toContain('AI Assistant');
    expect(container.textContent).toContain('Open AI Panel');
    act(() => root.unmount());
  });

  it('switches to History tab on click', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    const historyTab = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('History')
    ) as HTMLButtonElement;
    act(() => { historyTab.click(); });

    expect(container.textContent).toContain('Snapshots');
    act(() => root.unmount());
  });
});
