/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
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

  it('renders icon and meta when provided', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TreeRow title="Ch 1" icon="▸" meta="2.1k" />); });

    expect(container.textContent).toContain('▸');
    expect(container.textContent).toContain('2.1k');
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

  it('does not show active indicator when inactive', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TreeRow title="Inactive Row" />); });

    const indicator = container.querySelector('span.absolute');
    expect(indicator).toBeNull();
    act(() => root.unmount());
  });

  it('applies indentation for nested levels', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TreeRow title="Sub item" level={2} />); });

    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.style.paddingLeft).toBe('40px');
    act(() => root.unmount());
  });
});
