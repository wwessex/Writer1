import Dexie, { type EntityTable } from 'dexie';
import type { Novel, Chapter, Snapshot, BackupData, BackupDataV3, LegacyBackupData, ProjectType } from '@/types';
import { generateId } from '@/lib/utils';

const CURRENT_BACKUP_VERSION = 3;

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

  await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
    await db.novels.add(novel);
    await db.chapters.bulkAdd(chapters);
    if (snapshots.length > 0) {
      await db.snapshots.bulkAdd(snapshots);
    }
  });

  return novel;
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

// Clear all data
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
    await db.snapshots.clear();
    await db.chapters.clear();
    await db.novels.clear();
  });
}
