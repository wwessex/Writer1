/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useFocusModeClass } from './useFocusModeClass';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountWithFocusMode(focusMode: boolean) {
  const container = document.createElement('div');
  const root = createRoot(container);

  function Test({ enabled }: { enabled: boolean }) {
    useFocusModeClass(enabled);
    return null;
  }

  act(() => {
    root.render(<Test enabled={focusMode} />);
  });

  return {
    rerender: (enabled: boolean) => act(() => root.render(<Test enabled={enabled} />)),
    unmount: () => act(() => root.unmount()),
  };
}

describe('useFocusModeClass', () => {
  it('toggles focus-mode class in response to state updates and removes on unmount', () => {
    const harness = mountWithFocusMode(true);
    expect(document.body.classList.contains('focus-mode')).toBe(true);

    harness.rerender(false);
    expect(document.body.classList.contains('focus-mode')).toBe(false);

    harness.rerender(true);
    expect(document.body.classList.contains('focus-mode')).toBe(true);

    harness.unmount();
    expect(document.body.classList.contains('focus-mode')).toBe(false);
  });
});
