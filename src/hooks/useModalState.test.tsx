/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { useModalState } from './useModalState';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let hookResult: ReturnType<typeof useModalState>;

function Wrapper() {
  hookResult = useModalState();
  return null;
}

describe('useModalState', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Wrapper />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
  });

  it('all modals start as false', () => {
    const keys = Object.keys(hookResult.modals) as Array<keyof typeof hookResult.modals>;
    expect(keys.length).toBeGreaterThanOrEqual(20);
    for (const key of keys) {
      expect(hookResult.modals[key]).toBe(false);
    }
  });

  it('openModal sets modal to true', () => {
    act(() => {
      hookResult.openModal('export');
    });

    expect(hookResult.modals.export).toBe(true);
  });

  it('closeModal sets modal to false', () => {
    act(() => {
      hookResult.openModal('settings');
    });
    expect(hookResult.modals.settings).toBe(true);

    act(() => {
      hookResult.closeModal('settings');
    });
    expect(hookResult.modals.settings).toBe(false);
  });

  it('toggleModal flips state', () => {
    expect(hookResult.modals.about).toBe(false);

    act(() => {
      hookResult.toggleModal('about');
    });
    expect(hookResult.modals.about).toBe(true);

    act(() => {
      hookResult.toggleModal('about');
    });
    expect(hookResult.modals.about).toBe(false);
  });

  it('opening already-open modal is idempotent (no rerender)', () => {
    act(() => {
      hookResult.openModal('dashboard');
    });
    expect(hookResult.modals.dashboard).toBe(true);

    const modalsBefore = hookResult.modals;

    act(() => {
      hookResult.openModal('dashboard');
    });

    // The reducer returns the same state reference when opening an already-open modal
    expect(hookResult.modals).toBe(modalsBefore);
    expect(hookResult.modals.dashboard).toBe(true);
  });

  it('closing already-closed modal is idempotent', () => {
    expect(hookResult.modals.analysis).toBe(false);

    const modalsBefore = hookResult.modals;

    act(() => {
      hookResult.closeModal('analysis');
    });

    // The reducer returns the same state reference when closing an already-closed modal
    expect(hookResult.modals).toBe(modalsBefore);
    expect(hookResult.modals.analysis).toBe(false);
  });
});
