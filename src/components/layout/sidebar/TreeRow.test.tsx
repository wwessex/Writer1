/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { TreeRow } from './TreeRow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TreeRow', () => {
  it('renders title', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TreeRow title="My Chapter" />); });

    expect(container.textContent).toContain('My Chapter');
    act(() => root.unmount());
  });

  it('renders icon button and meta when provided', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(
        <TreeRow
          title="Ch 1"
          icon="▸"
          meta="2.1k"
          expandButtonLabel="Expand Ch 1"
          ariaExpanded={false}
          ariaControls="chapter-scenes-ch-1"
        />,
      );
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(2);

    const iconButton = buttons[0] as HTMLButtonElement;
    expect(iconButton.textContent).toContain('▸');
    expect(iconButton.getAttribute('type')).toBe('button');
    expect(iconButton.getAttribute('aria-label')).toBe('Expand Ch 1');
    expect(iconButton.getAttribute('aria-expanded')).toBe('false');
    expect(iconButton.getAttribute('aria-controls')).toBe('chapter-scenes-ch-1');
    expect(container.textContent).toContain('2.1k');
    act(() => root.unmount());
  });

  it('keeps row and expand controls independently clickable', () => {
    const onRowClick = vi.fn();
    const onIconClick = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(
        <TreeRow
          title="Chapter"
          icon="▾"
          onClick={onRowClick}
          onIconClick={onIconClick}
          expandButtonLabel="Collapse Chapter"
          ariaExpanded
          ariaControls="chapter-scenes-ch-2"
        />,
      );
    });

    const buttons = container.querySelectorAll('button');
    const iconButton = buttons[0] as HTMLButtonElement;
    const rowButton = buttons[1] as HTMLButtonElement;

    act(() => { iconButton.click(); });
    expect(onIconClick).toHaveBeenCalledOnce();
    expect(onRowClick).not.toHaveBeenCalled();

    act(() => { rowButton.click(); });
    expect(onRowClick).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('shows active indicator when active', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TreeRow title="Active Row" active />); });

    const indicator = container.querySelector('span.absolute');
    expect(indicator).toBeTruthy();
    act(() => root.unmount());
  });

  it('applies indentation for nested levels', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TreeRow title="Sub item" level={2} />); });

    const row = container.querySelector('div.w-full') as HTMLDivElement;
    expect(row.style.paddingLeft).toBe('40px');
    act(() => root.unmount());
  });
});
