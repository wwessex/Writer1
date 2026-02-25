/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarSearch } from './SidebarSearch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setActiveChapterMock = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      chapters: [
        {
          id: 'ch1',
          title: 'Chapter One',
          content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Once upon a time' }] }] },
          order: 0,
          novelId: 'n1',
          updatedAt: Date.now(),
          summary: '',
          pov: '',
          status: 'draft',
          tags: [],
          wordGoal: 0,
          scenes: [],
        },
      ],
    },
    setActiveChapter: setActiveChapterMock,
  }),
}));

describe('SidebarSearch', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    setActiveChapterMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('renders search toggle button', () => {
    act(() => { root.render(<SidebarSearch />); });
    const toggle = container.querySelector('[aria-label="Search all chapters"]');
    expect(toggle).not.toBeNull();
    expect(toggle!.textContent).toContain('Search');
  });

  it('expands search panel on toggle click', () => {
    act(() => { root.render(<SidebarSearch />); });
    const toggle = container.querySelector('[aria-label="Search all chapters"]') as HTMLButtonElement;
    act(() => { toggle.click(); });
    act(() => { vi.advanceTimersByTime(100); });
    const input = container.querySelector('input[placeholder="Search all chapters..."]');
    expect(input).not.toBeNull();
  });

  it('shows search results after typing and debounce', () => {
    act(() => { root.render(<SidebarSearch />); });
    const toggle = container.querySelector('[aria-label="Search all chapters"]') as HTMLButtonElement;
    act(() => { toggle.click(); });
    act(() => { vi.advanceTimersByTime(100); });

    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'once upon');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Wait for debounce
    act(() => { vi.advanceTimersByTime(300); });
    const results = container.querySelectorAll('[role="option"]');
    expect(results.length).toBeGreaterThan(0);
  });

  it('navigates to chapter on result click', () => {
    act(() => { root.render(<SidebarSearch />); });
    const toggle = container.querySelector('[aria-label="Search all chapters"]') as HTMLButtonElement;
    act(() => { toggle.click(); });
    act(() => { vi.advanceTimersByTime(100); });

    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'once upon');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { vi.advanceTimersByTime(300); });

    const result = container.querySelector('[role="option"]') as HTMLButtonElement;
    if (result) {
      act(() => { result.click(); });
      expect(setActiveChapterMock).toHaveBeenCalledWith('ch1');
    }
  });

  it('collapses on Escape key', () => {
    act(() => { root.render(<SidebarSearch />); });
    const toggle = container.querySelector('[aria-label="Search all chapters"]') as HTMLButtonElement;
    act(() => { toggle.click(); });
    act(() => { vi.advanceTimersByTime(100); });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    // After escape, panel should close
    expect(container.querySelector('input[placeholder="Search all chapters..."]')).toBeNull();
  });
});
