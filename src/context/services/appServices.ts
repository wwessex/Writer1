import type { Dispatch } from 'react';
import type { AppSettings, Chapter, Novel, ProjectType } from '@/types';
import * as storage from '@/lib/storage';
import { createSettingsEnvelope, loadSettingsFromStorage } from '@/lib/settingsMigration';
import { SETTINGS_STORAGE_KEY } from '@/lib/storageKeys';
import { applyManagedSettingsOverrides } from '@/lib/policy';
import { getSecret, isDesktop, setSecret } from '@/lib/desktopSecrets';

const SYNC_AUTH_SECRET_KEY = 'sync_auth_header';
import type { AppAction } from '@/context/state/appReducer';

export async function getNovelWithChapters(novel: Novel): Promise<{ novel: Novel; chapters: Chapter[] }> {
  const chapters = await storage.getChapters(novel.id);

  if (chapters.length === 0) {
    const firstChapter = storage.createChapter(novel.id, 0, undefined, novel.projectType || 'book');
    await storage.addChapter(firstChapter);
    chapters.push(firstChapter);
  }

  return { novel, chapters };
}

export async function loadDefaultNovelAndChapters(): Promise<{ novel: Novel; chapters: Chapter[] }> {
  const novel = await storage.getOrCreateDefaultNovel();
  return getNovelWithChapters(novel);
}

export async function loadNovelAndChaptersById(id: string): Promise<{ novel: Novel; chapters: Chapter[] } | null> {
  const novel = await storage.getNovel(id);
  if (!novel) {
    return null;
  }

  return getNovelWithChapters(novel);
}

export async function createNovelWithFirstChapter(title: string, projectType: ProjectType): Promise<{ novel: Novel; chapters: Chapter[] }> {
  const novel = await storage.createNovel(title, projectType);
  const firstChapter = storage.createChapter(novel.id, 0, undefined, projectType);
  await storage.addChapter(firstChapter);

  return { novel, chapters: [firstChapter] };
}

export async function withSavingDispatch(dispatch: Dispatch<AppAction>, operation: () => Promise<void>): Promise<void> {
  dispatch({ type: 'SET_SAVING', payload: true });
  try {
    await operation();
  } finally {
    dispatch({ type: 'SET_SAVING', payload: false });
  }
}

export function readSettingsFromLocalStorage(fallback: AppSettings): AppSettings {
  const userSettings = loadSettingsFromStorage(localStorage.getItem(SETTINGS_STORAGE_KEY), fallback);
  const policySettings = applyManagedSettingsOverrides(userSettings);

  if (!isDesktop()) {
    return policySettings;
  }

  void getSecret(SYNC_AUTH_SECRET_KEY).then(secret => {
    if (!secret) return;
    const current = loadSettingsFromStorage(localStorage.getItem(SETTINGS_STORAGE_KEY), fallback);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(createSettingsEnvelope({
      ...current,
      sync: { ...current.sync, auth: secret }
    })));
  });

  return policySettings;
}

export function persistSettingsToLocalStorage(settings: AppSettings): void {
  const policyAppliedSettings = applyManagedSettingsOverrides(settings);
  if (isDesktop() && policyAppliedSettings.sync.auth) {
    void setSecret(SYNC_AUTH_SECRET_KEY, policyAppliedSettings.sync.auth);
  }

  const persistableSettings = isDesktop()
    ? { ...policyAppliedSettings, sync: { ...policyAppliedSettings.sync, auth: '' } }
    : policyAppliedSettings;

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(createSettingsEnvelope(persistableSettings)));
}
