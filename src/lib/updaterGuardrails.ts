export type ReleaseChannel = 'stable' | 'beta' | 'nightly';

const PINNED_VERSION_KEY = 'desktop.updater.pinnedVersion';
const FAILED_ATTEMPTS_KEY = 'desktop.updater.failedAttempts';
const LAST_GOOD_VERSION_KEY = 'desktop.updater.lastGoodVersion';
const MAX_FAILED_ATTEMPTS = 3;

const compareVersionPart = (a: string, b: string): number => {
  const ai = Number.parseInt(a || '0', 10);
  const bi = Number.parseInt(b || '0', 10);
  if (Number.isNaN(ai) || Number.isNaN(bi)) return a.localeCompare(b);
  return ai - bi;
};

export const compareSemver = (left: string, right: string): number => {
  const lhs = left.replace(/^v/, '').split(/[.-]/);
  const rhs = right.replace(/^v/, '').split(/[.-]/);
  const max = Math.max(lhs.length, rhs.length);
  for (let i = 0; i < max; i += 1) {
    const diff = compareVersionPart(lhs[i] ?? '0', rhs[i] ?? '0');
    if (diff !== 0) return diff;
  }
  return 0;
};

const readNumber = (key: string): number => {
  const value = window.localStorage.getItem(key);
  return Number.parseInt(value ?? '0', 10) || 0;
};

export const shouldAcceptVersion = (candidate: string): boolean => {
  const pinned = window.localStorage.getItem(PINNED_VERSION_KEY);
  if (!pinned) return true;
  return compareSemver(candidate, pinned) >= 0;
};

export const markUpdateFailure = (): { attempts: number; fallbackMode: boolean } => {
  const attempts = readNumber(FAILED_ATTEMPTS_KEY) + 1;
  window.localStorage.setItem(FAILED_ATTEMPTS_KEY, String(attempts));
  return { attempts, fallbackMode: attempts >= MAX_FAILED_ATTEMPTS };
};

export const clearUpdateFailures = (): void => {
  window.localStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
};

export const setPinnedVersion = (version: string): void => {
  window.localStorage.setItem(PINNED_VERSION_KEY, version);
};

export const getPinnedVersion = (): string | null => window.localStorage.getItem(PINNED_VERSION_KEY);

export const saveLastKnownGoodVersion = (version: string): void => {
  window.localStorage.setItem(LAST_GOOD_VERSION_KEY, version);
};

export const getLastKnownGoodVersion = (): string | null => window.localStorage.getItem(LAST_GOOD_VERSION_KEY);

export const shouldUseLaunchFallback = (): boolean => readNumber(FAILED_ATTEMPTS_KEY) >= MAX_FAILED_ATTEMPTS;
