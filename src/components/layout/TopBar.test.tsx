/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TopBar', () => {
  it('renders with default project title', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar />); });

    expect(container.textContent).toContain('Writer1 Project');
    act(() => root.unmount());
  });

  it('renders with custom project title', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar projectTitle="My Novel" />); });

    expect(container.textContent).toContain('My Novel');
    act(() => root.unmount());
  });

  it('calls onSearch when search button is clicked', () => {
    const onSearch = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar onSearch={onSearch} />); });

    const searchBtn = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('Search documents')
    ) as HTMLButtonElement;
    act(() => { searchBtn.click(); });

    expect(onSearch).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('calls onFocusMode when Focus button is clicked', () => {
    const onFocusMode = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar onFocusMode={onFocusMode} />); });

    const focusBtn = Array.from(container.querySelectorAll('button')).find(
      btn => btn.textContent?.includes('Focus')
    ) as HTMLButtonElement;
    act(() => { focusBtn.click(); });

    expect(onFocusMode).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('calls onToggleInspector when inspector button is clicked', () => {
    const onToggleInspector = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar onToggleInspector={onToggleInspector} />); });

    const inspectorBtn = container.querySelector('button[aria-label="Toggle inspector"]') as HTMLButtonElement;
    act(() => { inspectorBtn.click(); });

    expect(onToggleInspector).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('renders the Saved status badge', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar />); });

    expect(container.textContent).toContain('Saved');
    act(() => root.unmount());
  });

  it('renders compact header content and exit label in focus mode', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar focusMode />); });

    const header = container.querySelector('header');
    expect(header?.className).toContain('h-10');
    expect(header?.className).not.toContain('h-14');
    expect(container.textContent).toContain('Exit');
    expect(container.textContent).not.toContain('Search documents');
    expect(container.textContent).not.toContain('Writer1 Project');
    expect(container.querySelector('button[aria-label="Toggle inspector"]')).toBeNull();
    act(() => root.unmount());
  });

  it('renders expanded header in normal mode', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar focusMode={false} />); });

    const header = container.querySelector('header');
    expect(header?.className).toContain('h-14');
    expect(container.textContent).toContain('Focus');
    expect(container.textContent).toContain('Search documents');
    act(() => root.unmount());
  });

  it('uses responsive classes to preserve controls in constrained space', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<TopBar projectTitle="A Very Long Project Title" />); });

    const projectButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('A Very Long Project Title')
    );
    expect(projectButton?.className).toContain('max-w-[130px]');
    expect(projectButton?.className).toContain('lg:max-w-[260px]');

    const newButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('New')
    );
    expect(newButton?.className).toContain('hidden lg:flex');

    const searchContainer = container.querySelector('div.hidden.md\\:block');
    expect(searchContainer).not.toBeNull();

    act(() => root.unmount());
  });
});
