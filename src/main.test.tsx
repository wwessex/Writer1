import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
const initializeSafeModeSessionMock = vi.fn();
const installGlobalErrorHandlersMock = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: createRootMock,
}));

vi.mock('./App', () => ({
  default: () => null,
}));

vi.mock('@/lib/errors', () => ({
  initializeSafeModeSession: initializeSafeModeSessionMock,
  installGlobalErrorHandlers: installGlobalErrorHandlersMock,
}));

describe('main bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    document.documentElement.removeAttribute('data-runtime');
    document.documentElement.removeAttribute('data-platform');

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });

    const keysMock = vi.fn(async () => ['draftharbour-v22', 'workbox-runtime']);
    const deleteMock = vi.fn(async () => true);

    Object.defineProperty(window, 'caches', {
      value: { keys: keysMock, delete: deleteMock },
      configurable: true,
    });

    createRootMock.mockClear();
    renderMock.mockClear();
    initializeSafeModeSessionMock.mockClear();
    installGlobalErrorHandlersMock.mockClear();
  });

  it('sets desktop/platform dataset, initializes safety handlers, and mounts app', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
      writable: true,
    });

    await import('./main');

    expect(document.documentElement.dataset.runtime).toBe('desktop');
    expect(document.documentElement.dataset.platform).toBe('macos');
    expect(initializeSafeModeSessionMock).toHaveBeenCalledTimes(1);
    expect(installGlobalErrorHandlersMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    const cachesApi = window.caches as unknown as { delete: ReturnType<typeof vi.fn> };
    expect(cachesApi.delete).toHaveBeenCalledWith('draftharbour-v22');
    expect(cachesApi.delete).not.toHaveBeenCalledWith('workbox-runtime');
  });
});
