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

  it('renders semantic tabs and tabpanel relationships', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).toBeTruthy();

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(5);
    tabs.forEach((tab) => {
      const controls = tab.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
      const panel = container.querySelector(`#${controls}`);
      expect(panel?.getAttribute('role')).toBe('tabpanel');
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.getAttribute('id'));
    });

    expect((tabs[0] as HTMLElement).getAttribute('aria-selected')).toBe('true');
    expect((tabs[1] as HTMLElement).getAttribute('aria-selected')).toBe('false');
    act(() => root.unmount());
  });

  it('switches to Notes tab on click', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    const notesTab = container.querySelector('#inspector-tab-notes') as HTMLButtonElement;
    act(() => { notesTab.click(); });

    expect(container.textContent).toContain('Chapter Notes');
    expect(notesTab.getAttribute('aria-selected')).toBe('true');
    act(() => root.unmount());
  });

  it('supports right and left arrow keyboard navigation', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => { root.render(<RightInspector />); });

    const infoTab = container.querySelector('#inspector-tab-info') as HTMLButtonElement;
    const notesTab = container.querySelector('#inspector-tab-notes') as HTMLButtonElement;

    act(() => {
      infoTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });

    expect(notesTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(notesTab);

    act(() => {
      notesTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });

    expect(infoTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(infoTab);
    act(() => root.unmount());
    container.remove();
  });
});
