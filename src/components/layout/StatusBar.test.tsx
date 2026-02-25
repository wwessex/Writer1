/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { StatusBar } from './StatusBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('StatusBar', () => {
  it('renders with default values', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<StatusBar />); });

    expect(container.textContent).toContain('Words: 2,843');
    expect(container.textContent).toContain('Session: +612');
    expect(container.textContent).toContain('Goal: 61%');
    expect(container.textContent).toContain('Saved');
    expect(container.textContent).toContain('Online');
    act(() => root.unmount());
  });

  it('renders custom values', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(
        <StatusBar wordCount={1000} sessionWords={200} goalPercent={50} saved={false} online={false} />
      );
    });

    expect(container.textContent).toContain('Words: 1,000');
    expect(container.textContent).toContain('Session: +200');
    expect(container.textContent).toContain('Goal: 50%');
    expect(container.textContent).toContain('Saving\u2026');
    expect(container.textContent).toContain('Offline');
    act(() => root.unmount());
  });
});
