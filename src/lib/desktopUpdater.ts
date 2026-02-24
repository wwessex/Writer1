import { relaunch } from '@tauri-apps/plugin-process';
import { message } from '@tauri-apps/plugin-dialog';
import { check } from '@tauri-apps/plugin-updater';
import {
  clearUpdateFailures,
  markUpdateFailure,
  saveLastKnownGoodVersion,
  shouldAcceptVersion,
  shouldUseLaunchFallback,
  type ReleaseChannel,
} from '@/lib/updaterGuardrails';

const CHANNEL_HEADER_KEY = 'desktop.updater.channel';
const DEFERRED_UPDATE_KEY = 'desktop.updater.deferredVersion';

export interface UpdaterSummary {
  available: boolean;
  version?: string;
  currentVersion?: string;
  body?: string;
  date?: string;
}

export const getReleaseChannel = (): ReleaseChannel => {
  const value = window.localStorage.getItem(CHANNEL_HEADER_KEY);
  if (value === 'beta' || value === 'nightly') return value;
  return 'stable';
};

export const setReleaseChannel = (channel: ReleaseChannel): void => {
  window.localStorage.setItem(CHANNEL_HEADER_KEY, channel);
};

export const checkForUpdate = async (): Promise<UpdaterSummary> => {
  try {
    const update = await check({ headers: { 'x-release-channel': getReleaseChannel() } });
    if (!update?.available || !update.version) {
      clearUpdateFailures();
      return { available: false, currentVersion: update?.currentVersion };
    }

    if (!shouldAcceptVersion(update.version)) {
      return {
        available: false,
        currentVersion: update.currentVersion,
        version: update.version,
        body: `Update ${update.version} blocked by pinned version guardrail.`,
      };
    }

    return {
      available: true,
      version: update.version,
      currentVersion: update.currentVersion,
      body: update.body,
      date: update.date,
    };
  } catch (error) {
    const state = markUpdateFailure();
    if (state.fallbackMode) {
      await message('Automatic update checks were paused after repeated failures. Please reinstall from the latest signed release.', {
        title: 'Updater in Fallback Mode',
        kind: 'warning',
      });
    }
    throw error;
  }
};

export const deferUpdate = (version: string): void => {
  window.localStorage.setItem(DEFERRED_UPDATE_KEY, version);
};

export const getDeferredUpdateVersion = (): string | null => window.localStorage.getItem(DEFERRED_UPDATE_KEY);

export const applyUpdateAndRestart = async (): Promise<void> => {
  const update = await check({ headers: { 'x-release-channel': getReleaseChannel() } });
  if (!update?.available || !update.version) return;

  if (!shouldAcceptVersion(update.version)) {
    throw new Error(`Version ${update.version} rejected by guardrail policy`);
  }

  await update.downloadAndInstall();
  saveLastKnownGoodVersion(update.version);
  window.localStorage.removeItem(DEFERRED_UPDATE_KEY);
  clearUpdateFailures();
  await relaunch();
};

export const getLaunchFallbackMessage = (): string | null => {
  if (!shouldUseLaunchFallback()) return null;
  return 'Updater fallback mode enabled after repeated failures. App launch continues using the last known good build.';
};
