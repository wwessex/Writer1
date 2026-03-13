import type { Novel, Chapter, Snapshot, AppSettings, CharacterEntity, WorldEntry, DhprojData, DhprojManifest, IntegrationType } from '@/types';
import { generateId } from '@/lib/utils';
import {
  SETTINGS_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  CHARACTERS_STORAGE_KEY,
  WORLD_ENTRIES_STORAGE_KEY,
  INTEGRATIONS_STORAGE_KEY,
} from '@/lib/storageKeys';
import type { ProgressData } from '@/lib/progressTracker';
import { db } from '@/lib/storage/db';
import { getNovel } from '@/lib/storage/novels';
import { getChapters } from '@/lib/storage/chapters';
import { getCommentThreadsForChapters, upsertCommentThread } from '@/lib/storage/comments';
import { loadGoalTrendSnapshots, upsertGoalTrendSnapshot } from '@/lib/storage/goalTrends';
import type { GoalTrendSnapshot } from '@/lib/storage/goalTrends';
import {
  isRecord,
  isCharacterEntity,
  isWorldEntry,
  isProgressData,
  mergeProgressData,
  mergeImportedSettings,
  mergeImportedIntegrations,
  loadStoredEntities,
  readSafePersistedIntegrationsFromStorage,
} from '@/lib/storage/migrations';

const ALLOWED_INTEGRATION_TYPES: IntegrationType[] = ['scrivener', 'google-drive', 'dropbox'];
const SUPPORTED_DHPROJ_VERSIONS = new Set<number>([1]);

export interface DhprojExportOptions {
  includeSnapshots?: boolean;
  includeIntegrationArtifacts?: boolean;
}

function normalizeProjectType(projectType?: string): 'book' | 'screenplay' {
  return projectType === 'screenplay' ? 'screenplay' : 'book';
}

export async function exportDhproj(novelId: string, options: DhprojExportOptions = {}): Promise<Blob> {
  const novel = await getNovel(novelId);
  if (!novel) throw new Error('Novel not found');

  const chapters = await getChapters(novelId);
  const chapterIds = chapters.map(c => c.id);
  const includeSnapshots = options.includeSnapshots ?? true;
  const snapshots = includeSnapshots
    ? await db.snapshots.where('chapterId').anyOf(chapterIds).toArray()
    : [];
  const commentThreads = getCommentThreadsForChapters(chapterIds);

  let settings: Partial<AppSettings> = {};
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) settings = JSON.parse(raw);
  } catch { /* ignore parse errors */ }

  const goalTrends = loadGoalTrendSnapshots();

  let progress: ProgressData | undefined;
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isProgressData(parsed)) {
        progress = parsed;
      }
    }
  } catch { /* ignore parse errors */ }

  const characters = loadStoredEntities<CharacterEntity>(CHARACTERS_STORAGE_KEY)
    .filter(isCharacterEntity)
    .filter(character => character.novelId === novelId);
  const worldEntries = loadStoredEntities<WorldEntry>(WORLD_ENTRIES_STORAGE_KEY)
    .filter(isWorldEntry)
    .filter(entry => entry.novelId === novelId);
  const includeIntegrationArtifacts = options.includeIntegrationArtifacts ?? false;
  const integrations = includeIntegrationArtifacts ? readSafePersistedIntegrationsFromStorage() : undefined;

  const manifest: DhprojManifest = {
    format: 'dhproj',
    version: 1,
    appVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    exportOptions: {
      includeSnapshots,
      includeIntegrationArtifacts,
    }
  };

  const data: DhprojData = {
    manifest,
    project: novel,
    projectType: novel.projectType || 'book',
    sections: chapters,
    snapshots,
    commentThreads,
    settings,
    goalTrends,
    progress,
    integrations,
    characters,
    worldEntries,
  };

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('project.json', JSON.stringify(data, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function importDhproj(file: File): Promise<Novel> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const manifestFile = zip.file('manifest.json');
  if (manifestFile) {
    let manifestRaw: string;
    try {
      manifestRaw = await manifestFile.async('string');
    } catch {
      throw new Error('Invalid .dhproj file: unable to read manifest.json');
    }

    let manifestData: unknown;
    try {
      manifestData = JSON.parse(manifestRaw);
    } catch {
      throw new Error('Invalid .dhproj file: malformed manifest.json');
    }

    const manifest = manifestData as Partial<DhprojManifest>;
    if (manifest.format !== 'dhproj') {
      throw new Error('Invalid .dhproj file: manifest format must be "dhproj"');
    }

    if (!SUPPORTED_DHPROJ_VERSIONS.has(Number(manifest.version))) {
      throw new Error(`Unsupported .dhproj version: ${String(manifest.version)}`);
    }
  }

  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('Invalid .dhproj file: missing project.json');

  let raw: string;
  try {
    raw = await projectFile.async('string');
  } catch {
    throw new Error('Invalid .dhproj file: unable to read project.json');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid .dhproj file: malformed project.json');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid .dhproj file: malformed payload (expected object)');
  }

  const candidate = parsed as Partial<DhprojData>;
  if (!candidate.project || typeof candidate.project !== 'object') {
    throw new Error('Invalid .dhproj file: malformed payload (missing project)');
  }
  if (!Array.isArray(candidate.sections)) {
    throw new Error('Invalid .dhproj file: malformed payload (sections must be an array)');
  }
  if (!candidate.projectType || (candidate.projectType !== 'book' && candidate.projectType !== 'screenplay')) {
    throw new Error('Invalid .dhproj file: malformed payload (invalid projectType)');
  }
  if (candidate.characters !== undefined && !Array.isArray(candidate.characters)) {
    throw new Error('Invalid .dhproj file: malformed payload (characters must be an array)');
  }
  if (candidate.worldEntries !== undefined && !Array.isArray(candidate.worldEntries)) {
    throw new Error('Invalid .dhproj file: malformed payload (worldEntries must be an array)');
  }
  if (candidate.progress !== undefined && !isProgressData(candidate.progress)) {
    throw new Error('Invalid .dhproj file: malformed payload (progress shape is invalid)');
  }
  if (candidate.integrations !== undefined) {
    if (!isRecord(candidate.integrations)) {
      throw new Error('Invalid .dhproj file: malformed payload (integrations must be an object)');
    }

    const integrationKeys = Object.keys(candidate.integrations);
    const hasInvalidIntegrationKey = integrationKeys.some(key => !ALLOWED_INTEGRATION_TYPES.includes(key as IntegrationType));
    if (hasInvalidIntegrationKey) {
      throw new Error('Invalid .dhproj file: malformed payload (unsupported integration provider key)');
    }
  }

  const data = candidate as DhprojData;
  const projectId = typeof data.project.id === 'string' ? data.project.id : undefined;
  if (!projectId) {
    throw new Error('Invalid .dhproj file: malformed payload (project.id is required)');
  }

  const newNovelId = generateId();
  const idMap = new Map<string, string>();
  idMap.set(projectId, newNovelId);

  const novel: Novel = {
    ...data.project,
    id: newNovelId,
    projectType: normalizeProjectType(data.projectType),
    updatedAt: Date.now(),
  };

  const chapters: Chapter[] = data.sections.map(chapter => {
    const newId = generateId();
    idMap.set(chapter.id, newId);
    return { ...chapter, id: newId, novelId: newNovelId, updatedAt: Date.now() };
  });

  const snapshotsSource = Array.isArray(data.snapshots) ? data.snapshots : [];
  const snapshots: Snapshot[] = snapshotsSource.map(snapshot => ({
    ...snapshot,
    id: generateId(),
    chapterId: idMap.get(snapshot.chapterId) || snapshot.chapterId,
  }));

  const commentThreadsSource = Array.isArray(data.commentThreads) ? data.commentThreads : [];
  const commentThreads = commentThreadsSource.map(thread => ({
    ...thread,
    chapterId: idMap.get(thread.chapterId) || thread.chapterId,
  }));

  const importedCharactersSource = Array.isArray(data.characters) ? data.characters : [];
  const importedCharacters = importedCharactersSource
    .filter(isCharacterEntity)
    .filter(character => character.novelId === projectId)
    .map(character => ({
      ...character,
      novelId: newNovelId,
    }));
  const importedCharacterIds = new Set(importedCharacters.map(character => character.id));

  const importedWorldEntriesSource = Array.isArray(data.worldEntries) ? data.worldEntries : [];
  const importedWorldEntries = importedWorldEntriesSource
    .filter(isWorldEntry)
    .filter(entry => entry.novelId === projectId)
    .map(entry => ({
      ...entry,
      novelId: newNovelId,
      linkedCharacters: entry.linkedCharacters.filter(characterId => importedCharacterIds.has(characterId)),
    }));

  await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
    await db.novels.add(novel);
    await db.chapters.bulkAdd(chapters);
    if (snapshots.length > 0) {
      await db.snapshots.bulkAdd(snapshots);
    }
  });

  commentThreads.forEach(thread => upsertCommentThread(thread));

  if (importedCharactersSource.length > 0) {
    const existingCharacters = loadStoredEntities<CharacterEntity>(CHARACTERS_STORAGE_KEY).filter(isCharacterEntity);
    const mergedCharacters = [
      ...existingCharacters.filter(character => character.novelId !== newNovelId),
      ...importedCharacters,
    ];
    localStorage.setItem(CHARACTERS_STORAGE_KEY, JSON.stringify(mergedCharacters));
  }

  if (importedWorldEntriesSource.length > 0) {
    const existingWorldEntries = loadStoredEntities<WorldEntry>(WORLD_ENTRIES_STORAGE_KEY).filter(isWorldEntry);
    const mergedWorldEntries = [
      ...existingWorldEntries.filter(entry => entry.novelId !== newNovelId),
      ...importedWorldEntries,
    ];
    localStorage.setItem(WORLD_ENTRIES_STORAGE_KEY, JSON.stringify(mergedWorldEntries));
  }

  if (data.settings && typeof data.settings === 'object') {
    try {
      const existingRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const mergedSettings = mergeImportedSettings(existingRaw, data.settings);
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(mergedSettings));
    } catch { /* ignore */ }
  }

  if (Array.isArray(data.goalTrends)) {
    for (const entry of data.goalTrends) {
      if (
        entry &&
        typeof entry === 'object' &&
        'date' in entry &&
        typeof (entry as GoalTrendSnapshot).date === 'string'
      ) {
        upsertGoalTrendSnapshot(entry as GoalTrendSnapshot);
      }
    }
  }

  if (data.progress) {
    try {
      const existingRaw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      const existingParsed = existingRaw ? JSON.parse(existingRaw) : undefined;
      const localProgress = isProgressData(existingParsed)
        ? existingParsed
        : {
            dailyHistory: [],
            streak: { current: 0, longest: 0, lastActiveDate: '' },
            totalSessions: 0,
            totalWordsAllTime: 0,
          };

      const mergedProgress = mergeProgressData(localProgress, data.progress);
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(mergedProgress));
    } catch { /* ignore parse errors */ }
  }

  if (data.integrations && typeof data.integrations === 'object') {
    try {
      const existingRaw = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
      const merged = mergeImportedIntegrations(existingRaw, data.integrations as Record<string, unknown>);

      if (Object.keys(merged).length > 0) {
        localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(merged));
      }
    } catch {
      /* ignore */
    }
  }

  return novel;
}
