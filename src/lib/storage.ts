import Dexie, { type EntityTable } from 'dexie';
import type { Novel, Chapter, Snapshot, BackupData, BackupDataV3, LegacyBackupData, ProjectType, CommentThread, DhprojData, DhprojManifest, AppSettings, CharacterEntity, WorldEntry } from '@/types';
import { generateId } from '@/lib/utils';

const CURRENT_BACKUP_VERSION = 3;
const GOAL_TREND_STORAGE_KEY = 'draftharbour_goal_trends_v1';
const MAX_GOAL_TREND_ENTRIES = 90;

export interface GoalTrendSnapshot {
  date: string;
  wordsToday: number;
  dailyGoal: number;
  goalMet: boolean;
}

const COMMENT_THREADS_STORAGE_PREFIX = 'draftharbour_comment_threads_';
const SETTINGS_STORAGE_KEY = 'draftharbour_settings_v1';
const CHARACTERS_STORAGE_KEY = 'draftharbour_characters';
const WORLD_ENTRIES_STORAGE_KEY = 'draftharbour_world';
const SUPPORTED_DHPROJ_VERSIONS = new Set<number>([1]);

class DraftHarbourDB extends Dexie {
  novels!: EntityTable<Novel, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  snapshots!: EntityTable<Snapshot, 'id'>;

  constructor() {
    super('DraftHarbourDB');
    this.version(2).stores({
      novels: 'id, title, updatedAt',
      chapters: 'id, novelId, order, title, updatedAt',
      snapshots: 'id, chapterId, createdAt'
    });

    this.version(3)
      .stores({
        novels: 'id, title, projectType, updatedAt',
        chapters: 'id, novelId, order, title, updatedAt',
        snapshots: 'id, chapterId, createdAt'
      })
      .upgrade(async tx => {
        await tx.table('novels').toCollection().modify((novel: Novel) => {
          if (!novel.projectType) {
            novel.projectType = 'book';
          }
        });
      });
  }
}

export const db = new DraftHarbourDB();

function normalizeProjectType(projectType?: ProjectType): ProjectType {
  return projectType === 'screenplay' ? 'screenplay' : 'book';
}

function normalizeNovel(novel: Novel): Novel {
  return {
    ...novel,
    projectType: normalizeProjectType(novel.projectType)
  };
}

function upgradeBackup(backup: BackupData): BackupDataV3 {
  if (backup.version === 3 && 'project' in backup && 'sections' in backup) {
    return {
      ...backup,
      version: 3,
      projectType: normalizeProjectType(backup.projectType),
      project: normalizeNovel(backup.project)
    };
  }

  const legacy = backup as LegacyBackupData;
  const project = normalizeNovel(legacy.novel);
  return {
    version: CURRENT_BACKUP_VERSION,
    projectType: project.projectType || 'book',
    project,
    sections: legacy.chapters,
    snapshots: legacy.snapshots,
    exportedAt: legacy.exportedAt || Date.now()
  };
}

// Novel operations
export async function getAllNovels(): Promise<Novel[]> {
  const novels = await db.novels.orderBy('updatedAt').reverse().toArray();
  return novels.map(normalizeNovel);
}

export async function getNovel(id: string): Promise<Novel | undefined> {
  const novel = await db.novels.get(id);
  return novel ? normalizeNovel(novel) : undefined;
}

export async function createNovel(title: string = 'Untitled Novel', projectType: ProjectType = 'book'): Promise<Novel> {
  const novel: Novel = {
    id: generateId(),
    title,
    projectType,
    updatedAt: Date.now()
  };
  await db.novels.add(novel);
  return novel;
}

export async function updateNovel(id: string, updates: Partial<Novel>): Promise<void> {
  const normalizedUpdates = 'projectType' in updates
    ? { ...updates, projectType: normalizeProjectType(updates.projectType) }
    : updates;
  await db.novels.update(id, { ...normalizedUpdates, updatedAt: Date.now() });
}

export async function deleteNovel(id: string): Promise<void> {
  await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
    const chapters = await db.chapters.where('novelId').equals(id).toArray();
    const chapterIds = chapters.map(c => c.id);

    await db.snapshots.where('chapterId').anyOf(chapterIds).delete();
    await db.chapters.where('novelId').equals(id).delete();
    await db.novels.delete(id);
  });
}

export async function getOrCreateDefaultNovel(): Promise<Novel> {
  let novel = await db.novels.orderBy('updatedAt').last();
  if (!novel) {
    novel = await createNovel('My Novel', 'book');
  }

  if (!novel.projectType) {
    await updateNovel(novel.id, { projectType: 'book' });
    novel.projectType = 'book';
  }

  return normalizeNovel(novel);
}

// Chapter operations
export async function getChapters(novelId: string): Promise<Chapter[]> {
  return db.chapters
    .where('novelId')
    .equals(novelId)
    .sortBy('order');
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  return db.chapters.get(id);
}

export function createChapter(
  novelId: string,
  order: number,
  title?: string,
  projectType: ProjectType = 'book'
): Chapter {
  return {
    id: generateId(),
    novelId,
    order,
    title: title || (projectType === 'screenplay' ? `Scene ${order + 1}` : `Chapter ${order + 1}`),
    updatedAt: Date.now(),
    content: null,
    summary: '',
    pov: '',
    status: 'planned',
    tags: [],
    wordGoal: 0,
    scenes: [],
    sync: {
      providerRevisionIds: {},
      lastPushedHash: undefined,
      lastPulledAt: undefined,
      lastSyncedContent: null,
    }
  };
}

export async function addChapter(chapter: Chapter): Promise<void> {
  await db.chapters.add(chapter);
}

export async function updateChapter(id: string, updates: Partial<Chapter>): Promise<void> {
  await db.chapters.update(id, { ...updates, updatedAt: Date.now() });
}

export async function deleteChapter(id: string): Promise<void> {
  await db.transaction('rw', [db.chapters, db.snapshots], async () => {
    await db.snapshots.where('chapterId').equals(id).delete();
    await db.chapters.delete(id);
  });
  localStorage.removeItem(`${COMMENT_THREADS_STORAGE_PREFIX}${id}`);
}

export async function reorderChapters(_novelId: string, chapterIds: string[]): Promise<void> {
  await db.transaction('rw', db.chapters, async () => {
    const updates = chapterIds.map((id, index) =>
      db.chapters.update(id, { order: index, updatedAt: Date.now() })
    );
    await Promise.all(updates);
  });
}

// Snapshot operations
export async function getSnapshots(chapterId: string): Promise<Snapshot[]> {
  return db.snapshots
    .where('chapterId')
    .equals(chapterId)
    .reverse()
    .sortBy('createdAt');
}

export async function createSnapshot(chapterId: string, doc: Snapshot['doc']): Promise<Snapshot> {
  const snapshot: Snapshot = {
    id: generateId(),
    chapterId,
    createdAt: Date.now(),
    doc
  };
  await db.snapshots.add(snapshot);
  return snapshot;
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.snapshots.delete(id);
}

// Backup operations
export async function exportBackup(novelId: string, includeSnapshots: boolean = true): Promise<BackupDataV3> {
  const novel = await getNovel(novelId);
  if (!novel) {
    throw new Error('Novel not found');
  }

  const chapters = await getChapters(novelId);
  const commentThreads = getCommentThreadsForChapters(chapters.map(chapter => chapter.id));
  let snapshots: Snapshot[] = [];

  if (includeSnapshots) {
    const chapterIds = chapters.map(c => c.id);
    snapshots = await db.snapshots.where('chapterId').anyOf(chapterIds).toArray();
  }

  return {
    version: CURRENT_BACKUP_VERSION,
    projectType: novel.projectType || 'book',
    project: novel,
    sections: chapters,
    snapshots: includeSnapshots ? snapshots : undefined,
    commentThreads,
    exportedAt: Date.now()
  };
}

export async function importBackup(backup: BackupData): Promise<Novel> {
  const normalizedBackup = upgradeBackup(backup);
  const newNovelId = generateId();
  const idMap = new Map<string, string>();
  idMap.set(normalizedBackup.project.id, newNovelId);

  const novel: Novel = {
    ...normalizedBackup.project,
    id: newNovelId,
    projectType: normalizedBackup.projectType,
    updatedAt: Date.now()
  };

  const chapters: Chapter[] = normalizedBackup.sections.map(chapter => {
    const newId = generateId();
    idMap.set(chapter.id, newId);
    return {
      ...chapter,
      id: newId,
      novelId: newNovelId,
      updatedAt: Date.now()
    };
  });

  const snapshots: Snapshot[] = (normalizedBackup.snapshots || []).map(snapshot => ({
    ...snapshot,
    id: generateId(),
    chapterId: idMap.get(snapshot.chapterId) || snapshot.chapterId
  }));

  const commentThreads = (normalizedBackup.commentThreads || []).map(thread => ({
    ...thread,
    chapterId: idMap.get(thread.chapterId) || thread.chapterId,
  }));

  await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
    await db.novels.add(novel);
    await db.chapters.bulkAdd(chapters);
    if (snapshots.length > 0) {
      await db.snapshots.bulkAdd(snapshots);
    }
  });

  commentThreads.forEach(thread => {
    upsertCommentThread(thread);
  });

  return novel;
}

export function getCommentThreads(chapterId: string): CommentThread[] {
  try {
    const raw = localStorage.getItem(`${COMMENT_THREADS_STORAGE_PREFIX}${chapterId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCommentThreads(chapterId: string, threads: CommentThread[]): void {
  localStorage.setItem(`${COMMENT_THREADS_STORAGE_PREFIX}${chapterId}`, JSON.stringify(threads));
}

function getCommentThreadsForChapters(chapterIds: string[]): CommentThread[] {
  return chapterIds.flatMap(chapterId => getCommentThreads(chapterId));
}

export function upsertCommentThread(thread: CommentThread): void {
  const threads = getCommentThreads(thread.chapterId);
  const index = threads.findIndex(item => item.id === thread.id);
  if (index >= 0) {
    threads[index] = thread;
  } else {
    threads.unshift(thread);
  }
  saveCommentThreads(thread.chapterId, threads);
}

export function saveAllCommentThreads(chapterId: string, threads: CommentThread[]): void {
  saveCommentThreads(chapterId, threads);
}

export function deleteCommentThread(chapterId: string, threadId: string): void {
  const threads = getCommentThreads(chapterId).filter(thread => thread.id !== threadId);
  saveCommentThreads(chapterId, threads);
}

// Replace entire novel data (for sync)
export async function replaceNovelData(novelId: string, chapters: Chapter[]): Promise<void> {
  await db.transaction('rw', [db.chapters, db.snapshots], async () => {
    // Delete existing chapters and snapshots
    const existingChapters = await db.chapters.where('novelId').equals(novelId).toArray();
    const chapterIds = existingChapters.map(c => c.id);
    await db.snapshots.where('chapterId').anyOf(chapterIds).delete();
    await db.chapters.where('novelId').equals(novelId).delete();

    // Add new chapters
    const newChapters = chapters.map((chapter, index) => ({
      ...chapter,
      id: generateId(),
      novelId,
      order: index,
      updatedAt: Date.now()
    }));
    await db.chapters.bulkAdd(newChapters);
  });
}

function loadGoalTrendSnapshots(): GoalTrendSnapshot[] {
  try {
    const raw = localStorage.getItem(GOAL_TREND_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is GoalTrendSnapshot => (
      typeof item?.date === 'string'
      && typeof item?.wordsToday === 'number'
      && typeof item?.dailyGoal === 'number'
      && typeof item?.goalMet === 'boolean'
    ));
  } catch {
    return [];
  }
}

function saveGoalTrendSnapshots(entries: GoalTrendSnapshot[]): void {
  localStorage.setItem(GOAL_TREND_STORAGE_KEY, JSON.stringify(entries.slice(-MAX_GOAL_TREND_ENTRIES)));
}

function loadStoredEntities<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isCharacterEntity(value: unknown): value is CharacterEntity {
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

function isWorldEntry(value: unknown): value is WorldEntry {
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

export function upsertGoalTrendSnapshot(snapshot: GoalTrendSnapshot): GoalTrendSnapshot[] {
  const entries = loadGoalTrendSnapshots();
  const existingIdx = entries.findIndex(item => item.date === snapshot.date);

  if (existingIdx >= 0) {
    entries[existingIdx] = snapshot;
  } else {
    entries.push(snapshot);
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveGoalTrendSnapshots(entries);
  return entries;
}

export function getGoalTrendSnapshots(days: number = 8): GoalTrendSnapshot[] {
  const entries = loadGoalTrendSnapshots();
  if (days <= 0) return entries;
  return entries.slice(-days);
}

// Clear all data
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
    await db.snapshots.clear();
    await db.chapters.clear();
    await db.novels.clear();
  });

  Object.keys(localStorage)
    .filter(key => key.startsWith(COMMENT_THREADS_STORAGE_PREFIX))
    .forEach(key => localStorage.removeItem(key));
}

// Project file (.dhproj) operations
export async function exportDhproj(novelId: string): Promise<Blob> {
  const novel = await getNovel(novelId);
  if (!novel) throw new Error('Novel not found');

  const chapters = await getChapters(novelId);
  const chapterIds = chapters.map(c => c.id);
  const snapshots = await db.snapshots.where('chapterId').anyOf(chapterIds).toArray();
  const commentThreads = getCommentThreadsForChapters(chapterIds);

  // Read settings from localStorage
  let settings: Partial<AppSettings> = {};
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) settings = JSON.parse(raw);
  } catch { /* ignore parse errors */ }

  // Read goal trends
  const goalTrends = loadGoalTrendSnapshots();

  const characters = loadStoredEntities<CharacterEntity>(CHARACTERS_STORAGE_KEY)
    .filter(isCharacterEntity)
    .filter(character => character.novelId === novelId);
  const worldEntries = loadStoredEntities<WorldEntry>(WORLD_ENTRIES_STORAGE_KEY)
    .filter(isWorldEntry)
    .filter(entry => entry.novelId === novelId);

  const manifest: DhprojManifest = {
    format: 'dhproj',
    version: 1,
    appVersion: '1.0.0',
    createdAt: new Date().toISOString(),
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

  const data = candidate as DhprojData;
  const projectId = typeof data.project.id === 'string' ? data.project.id : undefined;
  if (!projectId) {
    throw new Error('Invalid .dhproj file: malformed payload (project.id is required)');
  }

  // Remap IDs so the imported project doesn't collide with existing data
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

  // Restore comment threads
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

  // Restore settings if present
  if (data.settings && typeof data.settings === 'object') {
    try {
      const existingRaw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...existing, ...data.settings }));
    } catch { /* ignore */ }
  }

  // Restore goal trends if present
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

  return novel;
}
