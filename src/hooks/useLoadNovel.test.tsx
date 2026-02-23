/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useLoadNovel } from './useLoadNovel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountHook(props: Parameters<typeof useLoadNovel>[0]) {
  const container = document.createElement('div');
  const root = createRoot(container);

  function Test() {
    useLoadNovel(props);
    return null;
  }

  act(() => {
    root.render(<Test />);
  });

  return {
    unmount: () => act(() => root.unmount()),
  };
}

describe('useLoadNovel', () => {
  it('invokes onLoaded after a successful load', async () => {
    const onLoaded = vi.fn();
    const onError = vi.fn();

    mountHook({
      loadNovel: vi.fn(async () => undefined),
      onLoaded,
      onError,
    });

    await act(async () => Promise.resolve());

    expect(onLoaded).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not invoke callbacks after unmount', async () => {
    const onLoaded = vi.fn();
    const onError = vi.fn();
    let resolveLoad: () => void = () => undefined;

    const mounted = mountHook({
      loadNovel: vi.fn(() => new Promise<void>((resolve) => {
        resolveLoad = resolve;
      })),
      onLoaded,
      onError,
    });

    mounted.unmount();

    await act(async () => {
      resolveLoad();
      await Promise.resolve();
    });

    expect(onLoaded).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
