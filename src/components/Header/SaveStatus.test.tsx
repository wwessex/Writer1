/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveStatus } from './SaveStatus';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('SaveStatus', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('renders nothing when idle', () => {
    act(() => { root.render(<SaveStatus isSaving={false} />); });
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('shows "Saving" when isSaving is true', () => {
    act(() => { root.render(<SaveStatus isSaving={true} />); });
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.textContent).toContain('Saving');
  });

  it('transitions to "Saved" when isSaving goes from true to false', () => {
    act(() => { root.render(<SaveStatus isSaving={true} />); });
    act(() => { root.render(<SaveStatus isSaving={false} />); });
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.textContent).toContain('Saved');
  });

  it('returns to idle after timeout', () => {
    act(() => { root.render(<SaveStatus isSaving={true} />); });
    act(() => { root.render(<SaveStatus isSaving={false} />); });
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('clears pending timer if saving restarts', () => {
    act(() => { root.render(<SaveStatus isSaving={true} />); });
    act(() => { root.render(<SaveStatus isSaving={false} />); });
    // Re-trigger save before timeout
    act(() => { root.render(<SaveStatus isSaving={true} />); });
    expect(container.querySelector('[role="status"]')!.textContent).toContain('Saving');
    act(() => { vi.advanceTimersByTime(3000); });
    // Should still show saving, not idle
    expect(container.querySelector('[role="status"]')!.textContent).toContain('Saving');
  });
});
