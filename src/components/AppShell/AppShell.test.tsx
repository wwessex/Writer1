/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/components/Editor', () => ({ Editor: () => <div>Editor</div> }));
vi.mock('@/components/Panels', () => ({ AISuggestionsPanel: () => <div>AI</div> }));
vi.mock('@/components/layout/TopBar', () => ({
  TopBar: (props: { projectTitle?: string; onToggleInspector?: () => void }) => (
    <div>
      TopBar:{props.projectTitle}
      <button aria-label="Toggle inspector" onClick={props.onToggleInspector}>Inspector Toggle</button>
    </div>
  ),
}));
vi.mock('@/components/layout/StatusBar', () => ({
  StatusBar: (props: { wordCount?: number }) => <div>StatusBar:{props.wordCount}</div>,
}));
vi.mock('@/components/layout/sidebar/LeftSidebar', () => ({
  LeftSidebar: (props: { collapsed?: boolean }) => <div>LeftSidebar:{props.collapsed ? 'collapsed' : 'expanded'}</div>,
}));
vi.mock('@/components/layout/inspector/RightInspector', () => ({
  RightInspector: (props: { collapsed?: boolean }) => <div>RightInspector:{props.collapsed ? 'collapsed' : 'expanded'}</div>,
}));
vi.mock('@/lib/projectMetrics', () => ({
  getProjectMetrics: () => ({ totalWords: 5000, totalChapters: 3, chapters: [] }),
}));
vi.mock('@/lib/progressTracker', () => ({
  getTodayProgress: () => ({ wordsToday: 500, goalMet: false }),
}));

const makeState = (overrides: Record<string, unknown> = {}) => ({
  novelTitle: 'Test Novel',
  novelId: 'n-1',
  projectType: 'book',
  chapters: [],
  activeChapterId: null,
  isSaving: false,
  isOnline: true,
  settings: { sidebarHidden: false, dailyWordGoal: 1000 },
  ...overrides,
});

const baseProps = {
  appLabel: 'app',
  screenplayMode: false,
  onToggleScreenplayMode: vi.fn(),
  onAction: vi.fn(),
  hasTextSelection: false,
  editorFocused: false,
  voiceAlerts: [],
  sidebarImportBackup: vi.fn(),
  onExportBackup: vi.fn(),
  onToggleSidebar: vi.fn(),
  aiPanelOpen: false,
  closeAiPanel: vi.fn(),
  editor: null,
};

describe('AppShell', () => {
  it('renders the Tailwind layout shell with all panels', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppShell
          {...baseProps}
          state={makeState() as never}
          inspectorOpen
          setInspectorOpen={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('TopBar:Test Novel');
    expect(container.textContent).toContain('LeftSidebar:expanded');
    expect(container.textContent).toContain('Editor');
    expect(container.textContent).toContain('RightInspector:expanded');
    expect(container.textContent).toContain('StatusBar');

    act(() => root.unmount());
  });

  it('collapses sidebar when sidebarHidden is true', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppShell
          {...baseProps}
          state={makeState({ settings: { sidebarHidden: true, dailyWordGoal: 0 } }) as never}
          inspectorOpen={false}
          setInspectorOpen={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('LeftSidebar:collapsed');
    expect(container.textContent).toContain('RightInspector:collapsed');

    act(() => root.unmount());
  });

  it('passes setInspectorOpen toggle to TopBar', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const setInspectorOpen = vi.fn();

    act(() => {
      root.render(
        <AppShell
          {...baseProps}
          state={makeState() as never}
          inspectorOpen={false}
          setInspectorOpen={setInspectorOpen}
        />
      );
    });

    act(() => {
      (container.querySelector('button[aria-label="Toggle inspector"]') as HTMLButtonElement).click();
    });

    expect(setInspectorOpen).toHaveBeenCalled();

    act(() => root.unmount());
  });
});
