export type RuntimePlatform = 'macos' | 'windows' | 'linux';

const TAURI_FLAG = '__TAURI_INTERNALS__';

export const isDesktopRuntime = () => TAURI_FLAG in window;

export const detectRuntimePlatform = (): RuntimePlatform => {
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || '';
  const normalized = platform.toLowerCase();

  if (normalized.includes('mac')) return 'macos';
  if (normalized.includes('win')) return 'windows';
  return 'linux';
};

export const isMacDesktopRuntime = () => isDesktopRuntime() && detectRuntimePlatform() === 'macos';
