/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      projectType: 'book',
      chapters: [],
      settings: {
        sidebarHidden: false,
        sidebarPanels: { order: ['chapters', 'scenePlanner', 'outline'], collapsed: {}, visible: {} },
      },
    },
    dispatch: vi.fn(),
    undoReorder: vi.fn(),
    canUndoReorder: false,
    updateSettings: vi.fn(),
  }),
}));

vi.mock('./VirtualChapterList', () => ({
  VirtualChapterList: () => <div data-testid="chapter-list">ChapterList</div>,
}));
vi.mock('./OutlinePanel', () => ({
  OutlinePanel: () => <div data-testid="outline">Outline</div>,
}));
vi.mock('./ScenePlanner', () => ({
  ScenePlanner: () => <div data-testid="scene-planner">ScenePlanner</div>,
}));
vi.mock('./SidebarSearch', () => ({
  SidebarSearch: () => <div data-testid="sidebar-search">Search</div>,
}));
vi.mock('@/components/UI', () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  IconButton: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button onClick={onClick} aria-label={label}>{label}</button>
  ),
}));
vi.mock('@/components/UI/Tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/useResizable', () => ({
  useResizable: () => ({ size: 280, isResizing: false, handleProps: {} }),
}));
vi.mock('@/hooks/useModalAccessibility', () => ({
  useModalAccessibility: () => undefined,
}));

describe('Sidebar', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders sidebar with search, chapters, and panels', () => {
    act(() => { root.render(<Sidebar onExportBackup={vi.fn()} onImportBackup={vi.fn()} />); });
    expect(container.querySelector('[data-testid="sidebar-search"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="chapter-list"]')).not.toBeNull();
  });

  it('renders export and import backup buttons', () => {
    act(() => { root.render(<Sidebar onExportBackup={vi.fn()} onImportBackup={vi.fn()} />); });
    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map(b => b.textContent);
    expect(buttonTexts.some(t => t?.includes('Export Backup'))).toBe(true);
    expect(buttonTexts.some(t => t?.includes('Import Backup'))).toBe(true);
  });

  it('renders collapse button on desktop', () => {
    act(() => { root.render(<Sidebar onExportBackup={vi.fn()} onImportBackup={vi.fn()} />); });
    expect(container.querySelector('[aria-label*="Collapse sidebar"]')).not.toBeNull();
  });
});
