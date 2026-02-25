/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { LeftSidebar } from './LeftSidebar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('LeftSidebar', () => {
  it('renders collapsed state with icon-only buttons', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar collapsed />); });

    expect(container.querySelector('button[aria-label="New document"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Search"]')).toBeTruthy();
    expect(container.textContent).not.toContain('My Horror Novel');
    act(() => root.unmount());
  });

  it('renders expanded state with project header', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    expect(container.textContent).toContain('My Horror Novel');
    expect(container.textContent).toContain('42,318 words');
    act(() => root.unmount());
  });

  it('renders action buttons in expanded state', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    expect(container.textContent).toContain('New');
    expect(container.textContent).toContain('Folder');
    expect(container.textContent).toContain('Import');
    act(() => root.unmount());
  });

  it('renders chapter tree with sections', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    expect(container.textContent).toContain('Pinned');
    expect(container.textContent).toContain('Chapters');
    expect(container.textContent).toContain('Notes');
    act(() => root.unmount());
  });

  it('renders chapter rows with metadata', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    expect(container.textContent).toContain('Chapter 1');
    expect(container.textContent).toContain('Chapter 4');
    expect(container.textContent).toContain('Scene 2');
    expect(container.textContent).toContain('1.8k');
    act(() => root.unmount());
  });

  it('renders search input', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<LeftSidebar />); });

    const input = container.querySelector('input[placeholder="Search in project"]');
    expect(input).toBeTruthy();
    act(() => root.unmount());
  });
});
