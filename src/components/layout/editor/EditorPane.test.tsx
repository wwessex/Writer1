/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { EditorPane } from './EditorPane';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('EditorPane', () => {
  it('renders document header with default title', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<EditorPane />); });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toContain('Chapter 4');
    expect(container.textContent).toContain('Draft');
    expect(container.textContent).toContain('1,031 words');
    act(() => root.unmount());
  });

  it('renders contextual toolbar buttons', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<EditorPane />); });

    expect(container.textContent).toContain('Draft preset');
    expect(container.textContent).toContain('Width');
    expect(container.textContent).toContain('Line spacing');
    expect(container.textContent).toContain('Typewriter');
    act(() => root.unmount());
  });

  it('renders placeholder prose content when no children given', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<EditorPane />); });

    expect(container.textContent).toContain('The corridor stretched endlessly');
    expect(container.textContent).toContain('The Discovery');
    act(() => root.unmount());
  });

  it('renders children instead of placeholder when provided', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<EditorPane><div>Custom editor</div></EditorPane>); });

    expect(container.textContent).toContain('Custom editor');
    expect(container.textContent).not.toContain('The corridor stretched');
    act(() => root.unmount());
  });
});
