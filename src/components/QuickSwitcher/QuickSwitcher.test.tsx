/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { QuickSwitcher } from './QuickSwitcher';

const onCloseMock = vi.fn();
const onActionMock = vi.fn();
const setActiveChapterMock = vi.fn();
const updateSettingsMock = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      projectType: 'book',
      chapters: [
        { id: 'c1', order: 0, title: 'Chapter One', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Some text here' }] }] }, status: 'draft', summary: '', pov: '', tags: [], wordGoal: 0, scenes: [], novelId: 'n1', updatedAt: 0 },
      ],
      settings: { quickSwitcherMode: 'all' },
    },
    setActiveChapter: setActiveChapterMock,
    updateSettings: updateSettingsMock,
  }),
}));

vi.mock('@/lib/commands', () => ({
  COMMAND_METADATA: {
    export: { id: 'export', label: 'Export…', icon: 'download', shortcut: 'Ctrl+Shift+E', group: 'Project', includeInQuickSwitcher: true },
    settings: { id: 'settings', label: 'Settings', icon: 'settings', group: 'Navigation', includeInQuickSwitcher: true },
    themeDark: { id: 'themeDark', label: 'True Dark', icon: 'dark_mode', group: 'Views', includeInQuickSwitcher: true },
  },
}));

vi.mock('@/lib/projectMetrics', () => ({
  getProjectMetrics: (chapters: Array<{ id: string; title: string }>) => ({
    chapters: chapters.map(ch => ({ ...ch, words: 100 })),
  }),
}));

vi.mock('@/lib/search', () => ({
  buildChapterSearchIndex: () => [],
  findChapterContentMatches: () => [],
  normalizeSearchText: (text: string) => text.toLowerCase().trim(),
}));

vi.mock('./QuickSwitcher.module.css', () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

describe('QuickSwitcher', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    // jsdom does not implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onCloseMock.mockReset();
    onActionMock.mockReset();
    setActiveChapterMock.mockReset();
    updateSettingsMock.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('returns null when not open', () => {
    act(() => {
      root.render(
        <QuickSwitcher open={false} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders command palette when open', () => {
    act(() => {
      root.render(
        <QuickSwitcher open={true} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-label')).toBe('Command Palette');
  });

  it('shows mode tabs including All mode', () => {
    act(() => {
      root.render(
        <QuickSwitcher open={true} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(4);

    const tabLabels = Array.from(tabs).map(tab => tab.textContent);
    expect(tabLabels.some(label => label?.includes('All'))).toBe(true);
    expect(tabLabels.some(label => label?.includes('Actions'))).toBe(true);
    expect(tabLabels.some(label => label?.includes('Chapters'))).toBe(true);
    expect(tabLabels.some(label => label?.includes('Content'))).toBe(true);
  });

  it('shows footer with keyboard hints', () => {
    act(() => {
      root.render(
        <QuickSwitcher open={true} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    const footerText = container.textContent ?? '';
    expect(footerText).toContain('Navigate');
    expect(footerText).toContain('Select');
    expect(footerText).toContain('Switch Mode');
    expect(footerText).toContain('Close');
  });

  it('shows action items in all mode', () => {
    act(() => {
      root.render(
        <QuickSwitcher open={true} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    const text = container.textContent ?? '';
    expect(text).toContain('Export…');
    expect(text).toContain('Settings');
    expect(text).toContain('True Dark');
  });

  it('shows chapter items', () => {
    act(() => {
      root.render(
        <QuickSwitcher open={true} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    const text = container.textContent ?? '';
    expect(text).toContain('Chapter One');
  });

  it('shows section headers in all mode', () => {
    act(() => {
      root.render(
        <QuickSwitcher open={true} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    const headers = container.querySelectorAll('.sectionHeader');
    const headerTexts = Array.from(headers).map(h => h.textContent);
    expect(headerTexts).toContain('Actions');
    expect(headerTexts).toContain('Chapters');
  });

  it('calls onClose when clicking overlay', () => {
    vi.useFakeTimers();
    act(() => {
      root.render(
        <QuickSwitcher open={true} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    const overlay = container.querySelector('.overlay');
    expect(overlay).not.toBeNull();
    act(() => {
      overlay!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Exit animation uses a setTimeout fallback before calling onClose
    act(() => { vi.advanceTimersByTime(250); });
    expect(onCloseMock).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('Escape key calls onClose', () => {
    vi.useFakeTimers();
    act(() => {
      root.render(
        <QuickSwitcher open={true} onClose={onCloseMock} onAction={onActionMock} />
      );
    });
    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    act(() => {
      input!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
    });
    // Exit animation uses a setTimeout fallback before calling onClose
    act(() => { vi.advanceTimersByTime(250); });
    expect(onCloseMock).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
