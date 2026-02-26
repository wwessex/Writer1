/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { RESPONSIVE_BREAKPOINTS, useResponsivePanels } from './useResponsivePanels';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function HookProbe() {
  const state = useResponsivePanels();
  return (
    <div>
      {state.shouldCollapseSidebar ? 'sidebar:collapsed' : 'sidebar:expanded'}
      {'|'}
      {state.shouldCollapseInspector ? 'inspector:collapsed' : 'inspector:expanded'}
    </div>
  );
}

describe('useResponsivePanels', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: RESPONSIVE_BREAKPOINTS.inspectorAutoCollapse + 120,
    });
  });

  it('keeps both panels expanded above breakpoints', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(<HookProbe />);
    });

    expect(container.textContent).toBe('sidebar:expanded|inspector:expanded');

    act(() => root.unmount());
  });

  it('collapses inspector first and then sidebar as viewport narrows', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(<HookProbe />);
    });

    act(() => {
      window.innerWidth = RESPONSIVE_BREAKPOINTS.inspectorAutoCollapse - 10;
      window.dispatchEvent(new Event('resize'));
    });

    expect(container.textContent).toBe('sidebar:expanded|inspector:collapsed');

    act(() => {
      window.innerWidth = RESPONSIVE_BREAKPOINTS.sidebarAutoCollapse - 10;
      window.dispatchEvent(new Event('resize'));
    });

    expect(container.textContent).toBe('sidebar:collapsed|inspector:collapsed');

    act(() => root.unmount());
  });
});
