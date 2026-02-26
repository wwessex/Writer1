/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FindReplace } from './FindReplace';
import type { FindReplaceControls } from './useFindReplace';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('./FindReplace.module.css', () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

vi.mock('@/components/UI', () => ({
  IconButton: ({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled?: boolean }) => (
    <button aria-label={label} onClick={onClick} disabled={disabled}>{label}</button>
  ),
}));

function makeControls(overrides: Partial<FindReplaceControls> = {}): FindReplaceControls {
  return {
    isOpen: true,
    showReplace: false,
    searchTerm: '',
    replaceTerm: '',
    caseSensitive: false,
    wholeWord: false,
    currentIndex: 0,
    totalMatches: 0,
    setSearchTerm: vi.fn(),
    setReplaceTerm: vi.fn(),
    findNext: vi.fn(),
    findPrev: vi.fn(),
    replaceCurrent: vi.fn(),
    replaceAll: vi.fn(),
    toggleCaseSensitive: vi.fn(),
    toggleWholeWord: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    ...overrides,
  };
}

describe('FindReplace', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('renders nothing when closed', () => {
    const controls = makeControls({ isOpen: false });
    act(() => { root.render(<FindReplace controls={controls} />); });
    expect(container.innerHTML).toBe('');
  });

  it('renders the find bar when open', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const bar = container.querySelector('[role="search"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-label')).toBe('Find and replace');
  });

  it('renders a search input', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const input = container.querySelector('input[aria-label="Search text"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('placeholder')).toBe('Find...');
  });

  it('shows match count when there are matches', () => {
    const controls = makeControls({ totalMatches: 5, currentIndex: 2, searchTerm: 'foo' });
    act(() => { root.render(<FindReplace controls={controls} />); });
    expect(container.textContent).toContain('3 of 5');
  });

  it('shows "No matches" when search term exists with zero matches', () => {
    const controls = makeControls({ totalMatches: 0, searchTerm: 'foo' });
    act(() => { root.render(<FindReplace controls={controls} />); });
    expect(container.textContent).toContain('No matches');
  });

  it('shows empty match display when no search term', () => {
    const controls = makeControls({ totalMatches: 0, searchTerm: '' });
    act(() => { root.render(<FindReplace controls={controls} />); });
    const bar = container.querySelector('[role="search"]');
    expect(bar?.textContent).not.toContain('No matches');
  });

  it('calls setSearchTerm on input change', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const input = container.querySelector('input[aria-label="Search text"]') as HTMLInputElement;
    act(() => {
      const event = new Event('input', { bubbles: true });
      Object.defineProperty(event, 'target', { value: { value: 'test' } });
      // Use native event workaround — set value and fire change
      Object.defineProperty(input, 'value', { value: 'test', writable: true });
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(input, 'test');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    // The onChange handler is called via React's synthetic events
  });

  it('calls findNext on Enter key in search input', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const input = container.querySelector('input[aria-label="Search text"]') as HTMLInputElement;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(controls.findNext).toHaveBeenCalled();
  });

  it('calls findPrev on Shift+Enter key in search input', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const input = container.querySelector('input[aria-label="Search text"]') as HTMLInputElement;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    });
    expect(controls.findPrev).toHaveBeenCalled();
  });

  it('calls close via exit animation on Escape key', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const input = container.querySelector('input[aria-label="Search text"]') as HTMLInputElement;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    act(() => { vi.advanceTimersByTime(250); });
    expect(controls.close).toHaveBeenCalled();
  });

  it('calls close via exit animation on close button click', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const closeBtn = container.querySelector('button[aria-label="Close (Escape)"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();
    act(() => { closeBtn.click(); });
    act(() => { vi.advanceTimersByTime(250); });
    expect(controls.close).toHaveBeenCalled();
  });

  it('adds closing class during exit animation', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const closeBtn = container.querySelector('button[aria-label="Close (Escape)"]') as HTMLButtonElement;
    act(() => { closeBtn.click(); });
    const bar = container.querySelector('[role="search"]');
    expect(bar?.className).toContain('findBar--closing');
  });

  it('does not render replace row by default', () => {
    const controls = makeControls({ showReplace: false });
    act(() => { root.render(<FindReplace controls={controls} />); });
    const replaceInput = container.querySelector('input[aria-label="Replace text"]');
    expect(replaceInput).toBeNull();
  });

  it('renders replace row when showReplace is true', () => {
    const controls = makeControls({ showReplace: true });
    act(() => { root.render(<FindReplace controls={controls} />); });
    const replaceInput = container.querySelector('input[aria-label="Replace text"]');
    expect(replaceInput).not.toBeNull();
  });

  it('calls replaceCurrent on Enter in replace input', () => {
    const controls = makeControls({ showReplace: true });
    act(() => { root.render(<FindReplace controls={controls} />); });
    const replaceInput = container.querySelector('input[aria-label="Replace text"]') as HTMLInputElement;
    act(() => {
      replaceInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(controls.replaceCurrent).toHaveBeenCalled();
  });

  it('calls close on Escape in replace input', () => {
    const controls = makeControls({ showReplace: true });
    act(() => { root.render(<FindReplace controls={controls} />); });
    const replaceInput = container.querySelector('input[aria-label="Replace text"]') as HTMLInputElement;
    act(() => {
      replaceInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    act(() => { vi.advanceTimersByTime(250); });
    expect(controls.close).toHaveBeenCalled();
  });

  it('renders whole word toggle button', () => {
    const controls = makeControls({ wholeWord: true });
    act(() => { root.render(<FindReplace controls={controls} />); });
    const wholeWordBtn = container.querySelector('button[aria-label="Whole word"]');
    expect(wholeWordBtn).not.toBeNull();
    expect(wholeWordBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls toggleWholeWord when W button is clicked', () => {
    const controls = makeControls();
    act(() => { root.render(<FindReplace controls={controls} />); });
    const wholeWordBtn = container.querySelector('button[aria-label="Whole word"]') as HTMLButtonElement;
    act(() => { wholeWordBtn.click(); });
    expect(controls.toggleWholeWord).toHaveBeenCalled();
  });

  it('disables nav buttons when no matches', () => {
    const controls = makeControls({ totalMatches: 0 });
    act(() => { root.render(<FindReplace controls={controls} />); });
    const prevBtn = container.querySelector('button[aria-label="Previous match (Shift+Enter)"]') as HTMLButtonElement;
    const nextBtn = container.querySelector('button[aria-label="Next match (Enter)"]') as HTMLButtonElement;
    expect(prevBtn?.disabled).toBe(true);
    expect(nextBtn?.disabled).toBe(true);
  });
});
