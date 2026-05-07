/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellLayout } from './AppShellLayout';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useAppMock = vi.fn();
const useResponsivePanelsMock = vi.fn();
const editorToPlainTextMock = vi.fn();
const countWordsMock = vi.fn();
const formatReadingTimeMock = vi.fn();
const statusBarMock = vi.fn((props: { compact?: boolean }) => <div>StatusBar:{props.compact ? 'compact' : 'normal'}</div>);

vi.mock('@/context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('@/hooks/useResponsivePanels', () => ({
  useResponsivePanels: () => useResponsivePanelsMock(),
}));

vi.mock('@/lib/utils', () => ({
  editorToPlainText: (content: unknown) => editorToPlainTextMock(content),
  countWords: (text: string) => countWordsMock(text),
  formatReadingTime: (wordCount: number) => formatReadingTimeMock(wordCount),
}));

vi.mock('./TopBar', () => ({
  TopBar: (props: { focusMode?: boolean; onFocusMode?: () => void; onToggleInspector?: () => void }) => (
    <div>
      TopBar:{props.focusMode ? 'focus' : 'normal'}
      <button data-testid="focus" onClick={props.onFocusMode}>Focus</button>
      <button data-testid="inspector" onClick={props.onToggleInspector}>Inspector</button>
    </div>
  ),
}));
vi.mock('./StatusBar', () => ({
  StatusBar: (props: {
    compact?: boolean;
    wordCount?: number;
    sessionWords?: number;
    goalPercent?: number;
    saved?: boolean;
    online?: boolean;
    readingTime?: string;
    chapterCount?: number;
  }) => statusBarMock(props),
}));
vi.mock('./sidebar/LeftSidebar', () => ({
  LeftSidebar: (props: { collapsed?: boolean }) => <div>Sidebar:{props.collapsed ? 'collapsed' : 'expanded'}</div>,
}));
vi.mock('./editor/EditorPane', () => ({ EditorPane: () => <div>EditorPane</div> }));
vi.mock('./inspector/RightInspector', () => ({
  RightInspector: (props: { collapsed?: boolean }) => <div>Inspector:{props.collapsed ? 'collapsed' : 'expanded'}</div>,
}));

describe('AppShellLayout', () => {
  beforeEach(() => {
    useResponsivePanelsMock.mockReturnValue({
      shouldCollapseSidebar: false,
      shouldCollapseInspector: false,
    });

    useAppMock.mockReturnValue({
      state: {
        chapters: [
          { id: 'c1', content: [{ t: 1 }], wordGoal: 500 },
          { id: 'c2', content: [{ t: 2 }], wordGoal: 0 },
        ],
        isSaving: false,
        isOnline: true,
        novelId: 'novel-1',
        settings: { theme: 'auto' },
      },
      activeChapter: { id: 'c1', content: [{ t: 1 }], wordGoal: 500 },
      updateSettings: vi.fn(),
    });

    editorToPlainTextMock.mockImplementation((content: unknown) => {
      if (Array.isArray(content) && content.length > 0 && (content[0] as { t?: number }).t === 1) return 'alpha beta';
      return 'gamma';
    });

    countWordsMock.mockImplementation((text: string) => text.split(/\s+/).filter(Boolean).length);
    formatReadingTimeMock.mockImplementation((wordCount: number) => `${Math.max(1, Math.ceil(wordCount / 250))} min read`);
    statusBarMock.mockClear();
  });

  it('renders all layout sections', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    expect(container.textContent).toContain('TopBar:normal');
    expect(container.textContent).toContain('Sidebar:expanded');
    expect(container.textContent).toContain('EditorPane');
    expect(container.textContent).toContain('Inspector:expanded');
    expect(container.textContent).toContain('StatusBar:normal');
    expect(statusBarMock).toHaveBeenCalledWith(expect.objectContaining({
      wordCount: 2,
      sessionWords: 0,
      goalPercent: 0,
      saved: true,
      online: true,
      readingTime: '1 min read',
      chapterCount: 2,
      compact: false,
    }));
    act(() => root.unmount());
  });

  it('toggles focus mode and collapses side panels while active', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    expect(container.textContent).toContain('TopBar:normal');
    expect(container.textContent).toContain('Sidebar:expanded');
    expect(container.textContent).toContain('Inspector:expanded');
    expect(container.textContent).toContain('StatusBar:normal');

    act(() => {
      (container.querySelector('[data-testid="focus"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain('TopBar:focus');
    expect(container.textContent).toContain('Sidebar:collapsed');
    expect(container.textContent).toContain('Inspector:collapsed');
    expect(container.textContent).toContain('StatusBar:compact');

    act(() => {
      (container.querySelector('[data-testid="focus"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain('TopBar:normal');
    expect(container.textContent).toContain('Sidebar:expanded');
    expect(container.textContent).toContain('Inspector:expanded');
    expect(container.textContent).toContain('StatusBar:normal');
    act(() => root.unmount());
  });

  it('preserves manual inspector collapse state across focus mode toggle', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    act(() => {
      (container.querySelector('[data-testid="inspector"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain('Inspector:collapsed');

    act(() => {
      (container.querySelector('[data-testid="focus"]') as HTMLButtonElement).click();
    });
    act(() => {
      (container.querySelector('[data-testid="focus"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain('Inspector:collapsed');
    act(() => root.unmount());
  });

  it('maps saving and offline state to status bar props', () => {
    useAppMock.mockReturnValue({
      state: {
        chapters: [{ id: 'c1', content: [{ t: 1 }], wordGoal: 100 }],
        isSaving: true,
        isOnline: false,
        novelId: 'novel-1',
        settings: { theme: 'auto' },
      },
      activeChapter: { id: 'c1', content: [{ t: 1 }], wordGoal: 100 },
      updateSettings: vi.fn(),
    });

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    expect(statusBarMock).toHaveBeenCalledWith(expect.objectContaining({
      saved: false,
      online: false,
      chapterCount: 1,
      wordCount: 2,
      goalPercent: 2,
    }));

    act(() => root.unmount());
  });

  it('auto-collapses inspector on medium viewports', () => {
    useResponsivePanelsMock.mockReturnValue({
      shouldCollapseSidebar: false,
      shouldCollapseInspector: true,
    });

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    expect(container.textContent).toContain('Sidebar:expanded');
    expect(container.textContent).toContain('Inspector:collapsed');

    act(() => root.unmount());
  });

  it('auto-collapses both side panels on narrow viewports', () => {
    useResponsivePanelsMock.mockReturnValue({
      shouldCollapseSidebar: true,
      shouldCollapseInspector: true,
    });

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    expect(container.textContent).toContain('Sidebar:collapsed');
    expect(container.textContent).toContain('Inspector:collapsed');

    act(() => root.unmount());
  });
});
