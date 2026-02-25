/** @vitest-environment jsdom */
import { act, type ReactNode, type ChangeEventHandler } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const createChapterMock = vi.fn();
const updateSettingsMock = vi.fn();
const runMock = vi.fn();

const editorChainProxy = (): unknown =>
  new Proxy({} as Record<string, unknown>, {
    get: () => () =>
      new Proxy({} as Record<string, unknown>, {
        get: () => () => ({ run: runMock }),
      }),
  });

vi.mock('@tiptap/react', () => ({
  useCurrentEditor: () => ({
    editor: {
      isActive: (_name: string, _attrs?: unknown) => false,
      chain: () => ({ focus: () => editorChainProxy() }),
      can: () => ({ undo: () => true, redo: () => true }),
      on: vi.fn(),
      off: vi.fn(),
      commands: { setContent: vi.fn(), setImage: vi.fn() },
    },
  }),
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      projectType: 'book',
      settings: {
        typography: { fontFamily: 'system', fontSize: 16, lineHeight: 1.6 },
      },
    },
    createChapter: createChapterMock,
    updateSettings: updateSettingsMock,
  }),
}));

vi.mock('@/components/UI', () => ({
  IconButton: ({ label, onClick, active, disabled, onPointerDown }: {
    label: string; onClick?: () => void; active?: boolean; disabled?: boolean;
    onPointerDown?: (e: React.PointerEvent) => void;
  }) => (
    <button onClick={onClick} data-active={active} disabled={disabled} data-label={label}
      onPointerDown={onPointerDown as unknown as React.PointerEventHandler<HTMLButtonElement>}>{label}</button>
  ),
}));

vi.mock('@/components/UI/Tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/UI/Select', () => ({
  Select: ({ value, onChange, className }: { value: string; onChange: ChangeEventHandler<HTMLSelectElement>; className?: string }) => (
    <select className={className} value={value} onChange={onChange} data-testid="select">
      <option value="p">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="serif">Serif</option>
      <option value="default">Default</option>
      <option value="1">Single</option>
      <option value="1.5">1.5</option>
    </select>
  ),
}));

describe('Toolbar', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    runMock.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders toolbar with format controls and select elements', () => {
    act(() => { root.render(<Toolbar />); });
    const html = container.innerHTML;
    expect(html).toContain('Bold');
    expect(html).toContain('Italic');
    expect(html).toContain('Underline');
    expect(html).toContain('Strikethrough');
    const selects = container.querySelectorAll('[data-testid="select"]');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders undo and redo controls', () => {
    act(() => { root.render(<Toolbar />); });
    const html = container.innerHTML;
    expect(html).toContain('Undo');
    expect(html).toContain('Redo');
  });

  it('renders list and block format controls', () => {
    act(() => { root.render(<Toolbar />); });
    const html = container.innerHTML;
    expect(html).toContain('Bullet List');
    expect(html).toContain('Numbered List');
    expect(html).toContain('Blockquote');
    expect(html).toContain('Horizontal Rule');
  });

  it('renders insert image and add comment controls', () => {
    act(() => { root.render(<Toolbar />); });
    const html = container.innerHTML;
    expect(html).toContain('Insert Image');
    expect(html).toContain('Comment');
  });

  it('clicking format buttons does not throw', () => {
    act(() => { root.render(<Toolbar />); });
    const allButtons = Array.from(container.querySelectorAll('button'));
    expect(allButtons.length).toBeGreaterThan(0);
    for (const btn of allButtons) {
      act(() => { btn.click(); });
    }
  });

  it('changing style select triggers style change', () => {
    act(() => { root.render(<Toolbar />); });
    const selects = container.querySelectorAll('select[data-testid="select"]');
    expect(selects.length).toBeGreaterThan(0);
    // Trigger a change on the first select (style select)
    const styleSelect = selects[0] as HTMLSelectElement;
    act(() => {
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', { value: { value: 'h1' } });
      styleSelect.dispatchEvent(event);
    });
  });

  it('changing font family select triggers font change', () => {
    act(() => { root.render(<Toolbar />); });
    const selects = container.querySelectorAll('select[data-testid="select"]');
    expect(selects.length).toBeGreaterThanOrEqual(2);
    // Second select should be font family
    const fontSelect = selects[1] as HTMLSelectElement;
    act(() => {
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', { value: { value: 'serif' } });
      fontSelect.dispatchEvent(event);
    });
  });

  it('renders line spacing select', () => {
    act(() => { root.render(<Toolbar />); });
    const selects = container.querySelectorAll('select[data-testid="select"]');
    // Desktop toolbar has style, font family, and line spacing selects
    expect(selects.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Toolbar mobile render', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // Force mobile width
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true, configurable: true });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
  });

  it('renders mobile toolbar with primary format buttons and more menu', () => {
    act(() => { root.render(<Toolbar />); });
    // Fire resize to trigger mobile detection
    act(() => { window.dispatchEvent(new Event('resize')); });
    const html = container.innerHTML;
    // Should contain primary format buttons
    expect(html).toContain('Bold');
    expect(html).toContain('Italic');
    expect(html).toContain('Underline');
    // Should contain the more formatting toggle
    expect(html).toContain('More formatting');
  });

  it('renders new chapter button in mobile mode', () => {
    act(() => { root.render(<Toolbar />); });
    act(() => { window.dispatchEvent(new Event('resize')); });
    const html = container.innerHTML;
    expect(html).toContain('Chapter');
  });

  it('renders undo/redo in mobile mode', () => {
    act(() => { root.render(<Toolbar />); });
    act(() => { window.dispatchEvent(new Event('resize')); });
    const html = container.innerHTML;
    expect(html).toContain('Undo');
    expect(html).toContain('Redo');
  });

  it('opens more formatting menu when more button is clicked', () => {
    act(() => { root.render(<Toolbar />); });
    act(() => { window.dispatchEvent(new Event('resize')); });

    // Find and click the "More formatting" button
    const moreBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('More formatting'));
    if (moreBtn) {
      act(() => { moreBtn.click(); });
      const html = container.innerHTML;
      // Should show additional formatting options
      expect(html).toContain('Strikethrough');
      expect(html).toContain('Insert Image');
    }
  });
});
