import Dexie, { type EntityTable } from 'dexie';
import type { Novel, Chapter, Snapshot, BackupData } from '@/types';

class NovelWriterDB extends Dexie {
  novels!: EntityTable<Novel, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  snapshots!: EntityTable<Snapshot, 'id'>;

  constructor() {
    super('NovelWriterDB');
    this.version(2).stores({
      novels: 'id, title, updatedAt',
      chapters: 'id, novelId, order, title, updatedAt',
      snapshots: 'id, chapterId, createdAt'
    });
  }
}

export const db = new NovelWriterDB();

// Novel operations
export async function getNovel(id: string): Promise<Novel | undefined> {
  return db.novels.get(id);
}

export async function createNovel(title: string = 'Untitled Novel'): Promise<Novel> {
  const novel: Novel = {
    id: crypto.randomUUID(),
    title,
    updatedAt: Date.now()
  };
  await db.novels.add(novel);
  return novel;
}

export async function updateNovel(id: string, updates: Partial<Novel>): Promise<void> {
  await db.novels.update(id, { ...updates, updatedAt: Date.now() });
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
    novel = await createNovel('My Novel');
  }
  return novel;
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

export function createChapter(novelId: string, order: number, title?: string): Chapter {
  return {
    id: crypto.randomUUID(),
    novelId,
    order,
    title: title || `Chapter ${order + 1}`,
    updatedAt: Date.now(),
    content: null,
    summary: '',
    pov: '',
    status: 'planned',
    tags: [],
    wordGoal: 0,
    scenes: []
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
    id: crypto.randomUUID(),
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
export async function exportBackup(novelId: string, includeSnapshots: boolean = true): Promise<BackupData> {
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
    version: 2,
    novel,
    chapters,
    snapshots: includeSnapshots ? snapshots : undefined,
    exportedAt: Date.now()
  };
}

export async function importBackup(backup: BackupData): Promise<Novel> {
  const newNovelId = crypto.randomUUID();
  const idMap = new Map<string, string>();
  idMap.set(backup.novel.id, newNovelId);

  const novel: Novel = {
    ...backup.novel,
    id: newNovelId,
    updatedAt: Date.now()
  };

  const chapters: Chapter[] = backup.chapters.map(chapter => {
    const newId = crypto.randomUUID();
    idMap.set(chapter.id, newId);
    return {
      ...chapter,
      id: newId,
      novelId: newNovelId,
      updatedAt: Date.now()
    };
  });

  const snapshots: Snapshot[] = (backup.snapshots || []).map(snapshot => ({
    ...snapshot,
    id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
