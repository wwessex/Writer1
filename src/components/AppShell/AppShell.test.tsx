/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const headerSpy = vi.fn();

vi.mock('@/components/Header', () => ({
  Header: (props: unknown) => {
    headerSpy(props);
    return <div>Header</div>;
  },
}));
vi.mock('@/components/Sidebar', () => ({ Sidebar: () => <div>Sidebar</div> }));
vi.mock('@/components/Editor', () => ({ Editor: () => <div>Editor</div> }));
vi.mock('@/components/Inspector', () => ({ Inspector: () => <div>Inspector</div> }));
vi.mock('@/components/PanelErrorBoundary', () => ({ PanelErrorBoundary: ({ children }: { children?: ReactNode }) => <>{children}</> }));
vi.mock('@/components/Panels', () => ({ AISuggestionsPanel: () => <div>AI</div> }));
vi.mock('@/components/UI/Tooltip', () => ({ Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</> }));

const baseProps = {
  appLabel: 'app',
  screenplayMode: false,
  onToggleScreenplayMode: vi.fn(),
  onAction: vi.fn(),
  hasTextSelection: false,
  voiceAlerts: [],
  sidebarImportBackup: vi.fn(),
  onExportBackup: vi.fn(),
  onToggleSidebar: vi.fn(),
  aiPanelOpen: false,
  closeAiPanel: vi.fn(),
};

describe('AppShell', () => {
  it('forwards editorFocused state to Header', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(
        <AppShell
          {...baseProps}
          state={{ settings: { sidebarHidden: false } } as never}
          editorFocused
          inspectorOpen={false}
          setInspectorOpen={vi.fn()}
        />
      );
    });

    expect(headerSpy.mock.calls.at(-1)?.[0]).toMatchObject({ editorFocused: true });
    act(() => root.unmount());
  });

  it('uses expand/collapse controls when sidebar is hidden', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onToggleSidebar = vi.fn();
    const setInspectorOpen = vi.fn();

    act(() => {
      root.render(
        <AppShell
          {...baseProps}
          state={{ settings: { sidebarHidden: true } } as never}
          editorFocused={false}
          inspectorOpen={false}
          setInspectorOpen={setInspectorOpen}
          onToggleSidebar={onToggleSidebar}
        />
      );
    });

    act(() => {
      (Array.from(container.querySelectorAll('button')).find(btn => btn.getAttribute('aria-label')?.includes('Expand sidebar')) as HTMLButtonElement).click();
    });

    expect(onToggleSidebar).toHaveBeenCalled();
    expect(container.textContent).toContain('Outline');
    expect(container.textContent).toContain('Write');
    expect(container.textContent).toContain('Inspector');

    act(() => root.unmount());
  });

  it('routes mobile tab actions based on sidebar and inspector state', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onToggleSidebar = vi.fn();
    const setInspectorOpen = vi.fn();

    act(() => {
      root.render(
        <AppShell
          {...baseProps}
          state={{ settings: { sidebarHidden: false } } as never}
          editorFocused={false}
          inspectorOpen
          setInspectorOpen={setInspectorOpen}
          onToggleSidebar={onToggleSidebar}
        />
      );
    });

    const clickByLabel = (label: string) => {
      act(() => {
        (Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes(label)) as HTMLButtonElement).click();
      });
    };

    clickByLabel('Write');
    clickByLabel('Inspector');

    expect(onToggleSidebar).toHaveBeenCalled();
    expect(setInspectorOpen).toHaveBeenCalled();

    act(() => root.unmount());
  });
});
