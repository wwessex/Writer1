const isDesktopRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI__' in window;

type TauriRuntime = {
  invoke: <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>;
};

function getRuntime(): TauriRuntime | null {
  if (!isDesktopRuntime()) return null;
  return (window as Window & { __TAURI__?: TauriRuntime }).__TAURI__ ?? null;
}

export async function setSecret(key: string, value: string): Promise<void> {
  const runtime = getRuntime();
  if (!runtime) return;
  await runtime.invoke('set_secure_secret', { key, value });
}

export async function getSecret(key: string): Promise<string | null> {
  const runtime = getRuntime();
  if (!runtime) return null;
  const value = await runtime.invoke<string | null>('get_secure_secret', { key });
  return value ?? null;
}

export async function deleteSecret(key: string): Promise<void> {
  const runtime = getRuntime();
  if (!runtime) return;
  await runtime.invoke('delete_secure_secret', { key });
}

export function isDesktop(): boolean {
  return isDesktopRuntime();
}
