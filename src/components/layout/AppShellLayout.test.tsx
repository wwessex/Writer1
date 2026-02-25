/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AppShellLayout } from './AppShellLayout';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('./TopBar', () => ({
  TopBar: (props: { onFocusMode?: () => void; onToggleInspector?: () => void }) => (
    <div>
      TopBar
      <button data-testid="focus" onClick={props.onFocusMode}>Focus</button>
      <button data-testid="inspector" onClick={props.onToggleInspector}>Inspector</button>
    </div>
  ),
}));
vi.mock('./StatusBar', () => ({ StatusBar: () => <div>StatusBar</div> }));
vi.mock('./sidebar/LeftSidebar', () => ({
  LeftSidebar: (props: { collapsed?: boolean }) => <div>Sidebar:{props.collapsed ? 'collapsed' : 'expanded'}</div>,
}));
vi.mock('./editor/EditorPane', () => ({ EditorPane: () => <div>EditorPane</div> }));
vi.mock('./inspector/RightInspector', () => ({
  RightInspector: (props: { collapsed?: boolean }) => <div>Inspector:{props.collapsed ? 'collapsed' : 'expanded'}</div>,
}));

describe('AppShellLayout', () => {
  it('renders all layout sections', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    expect(container.textContent).toContain('TopBar');
    expect(container.textContent).toContain('Sidebar:expanded');
    expect(container.textContent).toContain('EditorPane');
    expect(container.textContent).toContain('Inspector:expanded');
    expect(container.textContent).toContain('StatusBar');
    act(() => root.unmount());
  });

  it('toggles sidebar collapsed state via Focus button', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    expect(container.textContent).toContain('Sidebar:expanded');

    act(() => {
      (container.querySelector('[data-testid="focus"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain('Sidebar:collapsed');
    act(() => root.unmount());
  });

  it('toggles inspector collapsed state via Inspector button', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<AppShellLayout />); });

    expect(container.textContent).toContain('Inspector:expanded');

    act(() => {
      (container.querySelector('[data-testid="inspector"]') as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain('Inspector:collapsed');
    act(() => root.unmount());
  });
});
