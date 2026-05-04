/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const invokeMock = vi.fn();
const listenMock = vi.fn();
const importDhprojMock = vi.fn();

vi.mock('@/lib/storage', () => ({ importDhproj: importDhprojMock }));

async function mountHook(props: {
  hasUnsavedEdits: boolean;
  onDeepLink: (url: string) => void;
  onMenuAction: (action: string) => void;
  menuState: { editorFocused: boolean; hasSelection: boolean };
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}) {
  const { useDesktopRuntime } = await import('./useDesktopRuntime');

  const container = document.createElement('div');
  const root = createRoot(container);

  function Test(current: typeof props) {
    useDesktopRuntime(current);
    return null;
  }

  act(() => {
    root.render(<Test {...props} />);
  });

  return {
    rerender(next: typeof props) {
      act(() => {
        root.render(<Test {...next} />);
      });
    },
  };
}

describe('useDesktopRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as Window & { __TAURI__?: unknown }).__TAURI__;
    window.confirm = vi.fn(() => true);
  });

  it('is a no-op outside desktop runtime', async () => {
    await mountHook({ hasUnsavedEdits: true, onDeepLink: vi.fn(), onMenuAction: vi.fn(), menuState: { editorFocused: false, hasSelection: false }, showToast: vi.fn() });
    await act(async () => Promise.resolve());

    expect(invokeMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();
  });

  it('wires desktop listeners and handles events', async () => {
    const listeners = new Map<string, (event: { payload: string }) => void | Promise<void>>();
    listenMock.mockImplementation(async (name: string, handler: (event: { payload: string }) => void | Promise<void>) => {
      listeners.set(name, handler);
      return () => listeners.delete(name);
    });
    invokeMock.mockImplementation(async (name: string) => {
      if (name === 'read_project_file') {
        return '{"manifest":{"format":"dhproj","version":1,"appVersion":"2.0.0","createdAt":"2026-01-01"},"project":{"id":"p1","title":"T"},"projectType":"book","sections":[],"snapshots":[],"commentThreads":[],"settings":{},"goalTrends":[]}';
      }
      return undefined;
    });
    (window as Window & { __TAURI__?: unknown }).__TAURI__ = { invoke: invokeMock, event: { listen: listenMock } };

    const onDeepLink = vi.fn();
    const onMenuAction = vi.fn();
    const showToast = vi.fn();

    await mountHook({ hasUnsavedEdits: true, onDeepLink, onMenuAction, menuState: { editorFocused: true, hasSelection: true }, showToast });
    await act(async () => Promise.resolve());

    expect(invokeMock).toHaveBeenCalledWith('set_unsaved_edits', { value: true });

    await act(async () => {
      await listeners.get('desktop://deep-link')?.({ payload: 'draftharbour://open?id=1' });
      await listeners.get('desktop://confirm-quit')?.({ payload: '' });
      await listeners.get('desktop://open-project')?.({ payload: '/tmp/test.dhproj' });
      await listeners.get('desktop://menu-command')?.({ payload: 'export' });
    });

    expect(onDeepLink).toHaveBeenCalledWith('draftharbour://open?id=1');
    expect(onMenuAction).toHaveBeenCalledWith('export');
    expect(invokeMock).toHaveBeenCalledWith('quit_app');
    expect(importDhprojMock).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalled();
  });

  it('updates unsaved state on rerender', async () => {
    listenMock.mockResolvedValue(() => undefined);
    (window as Window & { __TAURI__?: unknown }).__TAURI__ = { invoke: invokeMock, event: { listen: listenMock } };

    const hook = await mountHook({ hasUnsavedEdits: false, onDeepLink: vi.fn(), onMenuAction: vi.fn(), menuState: { editorFocused: false, hasSelection: false }, showToast: vi.fn() });
    await act(async () => Promise.resolve());

    hook.rerender({ hasUnsavedEdits: true, onDeepLink: vi.fn(), onMenuAction: vi.fn(), menuState: { editorFocused: true, hasSelection: true }, showToast: vi.fn() });
    await act(async () => Promise.resolve());

    expect(invokeMock.mock.calls.some(([name, payload]) => name === 'set_unsaved_edits' && payload?.value === false)).toBe(true);
    expect(invokeMock.mock.calls.some(([name, payload]) => name === 'set_unsaved_edits' && payload?.value === true)).toBe(true);
  });
});
