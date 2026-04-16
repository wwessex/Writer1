export interface TauriRuntime {
  invoke: <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>;
  listen: <T>(eventName: string, handler: (event: { payload: T }) => void | Promise<void>) => Promise<() => void>;
}

interface LegacyTauriRuntime {
  invoke: TauriRuntime['invoke'];
  event: {
    listen: TauriRuntime['listen'];
  };
}

const getLegacyRuntime = (): LegacyTauriRuntime | null => {
  const runtime = (window as Window & { __TAURI__?: LegacyTauriRuntime }).__TAURI__;
  return runtime ?? null;
};

const hasDesktopInternals = () => '__TAURI_INTERNALS__' in window;

export const getTauriRuntime = async (): Promise<TauriRuntime | null> => {
  const legacyRuntime = getLegacyRuntime();
  if (legacyRuntime) {
    return {
      invoke: legacyRuntime.invoke,
      listen: legacyRuntime.event.listen,
    };
  }

  if (!hasDesktopInternals()) {
    return null;
  }

  const [{ invoke }, { listen }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event'),
  ]);

  return {
    invoke,
    listen,
  };
};
