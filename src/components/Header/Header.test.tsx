/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const menuBarSpy = vi.fn();

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      chapters: [],
      activeChapterId: 'c1',
      novelId: 'n1',
      novelTitle: 'Title',
      isOnline: true,
      isSaving: false,
      settings: { dailyWordGoal: 0, theme: 'dark' },
      projectType: 'book',
    },
    updateNovelTitle: vi.fn(),
  }),
}));

vi.mock('@/components/UI', () => ({
  Input: ({ value }: { value: string }) => <input value={value} readOnly />,
  IconButton: ({ label, onClick, className }: { label: string; onClick?: () => void; className?: string }) => (
    <button className={className} onClick={onClick}>{label}</button>
  ),
}));
vi.mock('@/components/UI/Tooltip', () => ({ Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</> }));
vi.mock('@/components/UI/Pill', () => ({
  Pill: ({ label }: { label: string }) => <span>{label}</span>,
  StatusDot: () => <span>Status</span>,
}));
vi.mock('./Toolbar', () => ({ Toolbar: () => <div>Toolbar</div> }));
vi.mock('@/components/Menu/MenuBar', () => ({
  MenuBar: (props: unknown) => {
    menuBarSpy(props);
    return <div data-testid="menu-bar">MenuBar</div>;
  },
}));

vi.mock('@/lib/projectMetrics', () => ({
  getProjectMetrics: () => ({ totalWords: 0, chapters: [] }),
}));
vi.mock('@/lib/progressTracker', () => ({ getMonthlyHistory: () => [] }));
vi.mock('@/lib/ai', () => ({
  loadAIConfig: () => ({}),
  createProvider: () => ({ isAvailable: () => false, destroy: () => undefined }),
}));

describe('Header desktop menu fallback', () => {
  afterEach(() => {
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    menuBarSpy.mockReset();
  });

  it('hides web menubar in desktop runtime and shows it in browser runtime', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { stub: true };
    act(() => {
      root.render(<Header onAction={vi.fn()} hasTextSelection={false} editorFocused={false} />);
    });
    expect(container.querySelector('[data-testid="menu-bar"]')).toBeNull();

    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    act(() => {
      root.render(<Header onAction={vi.fn()} hasTextSelection={false} editorFocused={false} />);
    });
    expect(container.querySelector('[data-testid="menu-bar"]')).not.toBeNull();

    act(() => root.unmount());
  });
});
