import type { Chapter, ProjectType } from '@/types';
import { generateId } from '@/lib/utils';
import { COMMENT_THREADS_STORAGE_PREFIX } from '@/lib/storageKeys';
import { db } from '@/lib/storage/db';

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
