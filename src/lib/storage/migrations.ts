import type { AppSettings, CharacterEntity, WorldEntry, DhprojIntegrations, IntegrationType, PersistedIntegrationConfig } from '@/types';
import type { ProgressData, DailyProgress } from '@/lib/progressTracker';
import { INTEGRATIONS_STORAGE_KEY } from '@/lib/storageKeys';

const ALLOWED_INTEGRATION_TYPES: IntegrationType[] = ['scrivener', 'google-drive', 'dropbox'];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isCharacterEntity(value: unknown): value is CharacterEntity {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CharacterEntity>;
  return typeof candidate.id === 'string'
    && typeof candidate.novelId === 'string'
    && typeof candidate.name === 'string'
    && Array.isArray(candidate.aliases)
    && typeof candidate.description === 'string'
    && typeof candidate.role === 'string'
    && Array.isArray(candidate.traits)
    && typeof candidate.notes === 'string'
    && Array.isArray(candidate.relationships)
    && typeof candidate.createdAt === 'number'
    && typeof candidate.updatedAt === 'number';
}

export function isWorldEntry(value: unknown): value is WorldEntry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorldEntry>;
  return typeof candidate.id === 'string'
    && typeof candidate.novelId === 'string'
    && typeof candidate.category === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.description === 'string'
    && Array.isArray(candidate.tags)
    && Array.isArray(candidate.linkedCharacters)
    && typeof candidate.notes === 'string'
    && typeof candidate.createdAt === 'number'
    && typeof candidate.updatedAt === 'number';
}

function isDailyProgress(entry: unknown): entry is DailyProgress {
  if (!entry || typeof entry !== 'object') return false;

  const candidate = entry as Partial<DailyProgress>;
  return (
    typeof candidate.date === 'string' &&
    typeof candidate.wordsWritten === 'number' &&
    Number.isFinite(candidate.wordsWritten) &&
    typeof candidate.wordsAtStart === 'number' &&
    Number.isFinite(candidate.wordsAtStart) &&
    typeof candidate.goalMet === 'boolean' &&
    typeof candidate.sessions === 'number' &&
    Number.isFinite(candidate.sessions)
  );
}

function isWritingStreak(streak: unknown): streak is ProgressData['streak'] {
  if (!streak || typeof streak !== 'object') return false;

  const candidate = streak as Partial<ProgressData['streak']>;
  return (
    typeof candidate.current === 'number' &&
    Number.isFinite(candidate.current) &&
    typeof candidate.longest === 'number' &&
    Number.isFinite(candidate.longest) &&
    typeof candidate.lastActiveDate === 'string'
  );
}

export function isProgressData(progress: unknown): progress is ProgressData {
  if (!progress || typeof progress !== 'object') return false;

  const candidate = progress as Partial<ProgressData>;
  return (
    Array.isArray(candidate.dailyHistory) &&
    candidate.dailyHistory.every(isDailyProgress) &&
    isWritingStreak(candidate.streak) &&
    typeof candidate.totalSessions === 'number' &&
    Number.isFinite(candidate.totalSessions) &&
    typeof candidate.totalWordsAllTime === 'number' &&
    Number.isFinite(candidate.totalWordsAllTime)
  );
}

export function mergeProgressData(localProgress: ProgressData, importedProgress: ProgressData): ProgressData {
  const mergedByDate = new Map<string, DailyProgress>();

  for (const entry of importedProgress.dailyHistory) {
    mergedByDate.set(entry.date, entry);
  }

  for (const entry of localProgress.dailyHistory) {
    const existing = mergedByDate.get(entry.date);
    if (!existing) {
      mergedByDate.set(entry.date, entry);
      continue;
    }

    mergedByDate.set(entry.date, {
      date: entry.date,
      wordsWritten: Math.max(existing.wordsWritten, entry.wordsWritten),
      wordsAtStart: Math.min(existing.wordsAtStart, entry.wordsAtStart),
      goalMet: existing.goalMet || entry.goalMet,
      sessions: Math.max(existing.sessions, entry.sessions),
    });
  }

  const dailyHistory = Array.from(mergedByDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  return {
    dailyHistory,
    streak: {
      current: Math.max(importedProgress.streak.current, localProgress.streak.current),
      longest: Math.max(importedProgress.streak.longest, localProgress.streak.longest),
      lastActiveDate: importedProgress.streak.lastActiveDate > localProgress.streak.lastActiveDate
        ? importedProgress.streak.lastActiveDate
        : localProgress.streak.lastActiveDate,
    },
    totalSessions: Math.max(importedProgress.totalSessions, localProgress.totalSessions),
    totalWordsAllTime: Math.max(importedProgress.totalWordsAllTime, localProgress.totalWordsAllTime),
  };
}

export function mergeImportedSettings(existingRaw: string | null, importedSettings: Partial<AppSettings>): Record<string, unknown> {
  let existingParsed: unknown = {};
  try {
    existingParsed = existingRaw ? JSON.parse(existingRaw) as unknown : {};
  } catch {
    existingParsed = {};
  }

  const existing = isRecord(existingParsed) ? existingParsed : {};
  return { ...existing, ...importedSettings };
}

export function sanitizeImportedIntegrationConfig(type: IntegrationType, value: unknown): PersistedIntegrationConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = value.status;
  const safeStatus = status === 'disconnected' || status === 'pending' || status === 'connected' || status === 'error'
    ? status
    : undefined;

  return {
    type,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : false,
    connectionId: typeof value.connectionId === 'string' ? value.connectionId : undefined,
    providerUserId: typeof value.providerUserId === 'string' ? value.providerUserId : undefined,
    scopes: Array.isArray(value.scopes) ? value.scopes.filter((scope): scope is string => typeof scope === 'string') : undefined,
    expiresAt: typeof value.expiresAt === 'number' ? value.expiresAt : undefined,
    status: safeStatus,
    folderId: typeof value.folderId === 'string' ? value.folderId : undefined,
    lastSyncAt: typeof value.lastSyncAt === 'number' ? value.lastSyncAt : undefined,
  };
}

export function mergeImportedIntegrations(
  existingRaw: string | null,
  importedIntegrations: Record<string, unknown>
): DhprojIntegrations {
  let existingParsed: unknown = {};
  try {
    existingParsed = existingRaw ? JSON.parse(existingRaw) as unknown : {};
  } catch {
    existingParsed = {};
  }

  const existing = isRecord(existingParsed) ? existingParsed : {};
  const merged: DhprojIntegrations = {};

  for (const type of ALLOWED_INTEGRATION_TYPES) {
    if (Object.prototype.hasOwnProperty.call(existing, type)) {
      merged[type] = existing[type] as PersistedIntegrationConfig;
    }

    const safeImported = sanitizeImportedIntegrationConfig(type, importedIntegrations[type]);
    if (safeImported) {
      merged[type] = safeImported;
    }
  }

  return merged;
}

export function loadStoredEntities<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readSafePersistedIntegrationsFromStorage(): DhprojIntegrations | undefined {
  const raw = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return undefined;
    }

    const integrationKeys = Object.keys(parsed);
    const hasInvalidIntegrationKey = integrationKeys.some(key => !ALLOWED_INTEGRATION_TYPES.includes(key as IntegrationType));
    if (hasInvalidIntegrationKey) {
      return undefined;
    }

    return parsed as DhprojIntegrations;
  } catch {
    return undefined;
  }
}

