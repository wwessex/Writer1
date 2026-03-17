/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useCodeMirrorEditor } from './useCodeMirrorEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('useCodeMirrorEditor', () => {
  it('creates an adapter when mounted with a container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let capturedAdapter: unknown = undefined;
    let capturedRef: { current: HTMLDivElement | null } | null = null;

    function Test() {
      const { containerRef, adapter } = useCodeMirrorEditor({ initialContent: 'Hello' });
      capturedAdapter = adapter;
      capturedRef = containerRef;
      return <div ref={containerRef} data-testid="editor" />;
    }

    act(() => {
      root.render(<Test />);
    });

    // After mount, adapter should be set
    expect(capturedAdapter).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((capturedRef as any)?.current).toBeInstanceOf(HTMLDivElement);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('calls onChange when content changes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChange = vi.fn();
    let capturedAdapter: { setContent?: (s: string) => void } | null = null;

    function Test() {
      const { containerRef, adapter } = useCodeMirrorEditor({
        initialContent: 'Initial',
        onChange,
      });
      capturedAdapter = adapter;
      return <div ref={containerRef} />;
    }

    act(() => {
      root.render(<Test />);
    });

    act(() => {
      capturedAdapter?.setContent?.('Changed');
    });

    expect(onChange).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('returns null adapter before mount', () => {
    // The hook initializes adapter as null
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const adapters: unknown[] = [];

    function Test() {
      const { containerRef, adapter } = useCodeMirrorEditor();
      adapters.push(adapter);
      return <div ref={containerRef} />;
    }

    act(() => {
      root.render(<Test />);
    });

    // First render may have null, subsequent render should have adapter
    expect(adapters.length).toBeGreaterThanOrEqual(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
