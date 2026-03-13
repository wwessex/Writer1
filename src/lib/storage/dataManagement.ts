import type { Chapter } from '@/types';
import { generateId } from '@/lib/utils';
import {
  COMMENT_THREADS_STORAGE_PREFIX,
  STORY_BLUEPRINTS_STORAGE_KEY,
  INTEGRATIONS_STORAGE_KEY,
} from '@/lib/storageKeys';
import { db } from '@/lib/storage/db';

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
    await db.snapshots.clear();
    await db.chapters.clear();
    await db.novels.clear();
  });

  Object.keys(localStorage)
    .filter(key => key.startsWith(COMMENT_THREADS_STORAGE_PREFIX))
    .forEach(key => localStorage.removeItem(key));
  localStorage.removeItem(STORY_BLUEPRINTS_STORAGE_KEY);
}

export async function replaceNovelData(novelId: string, chapters: Chapter[]): Promise<void> {
  await db.transaction('rw', [db.chapters, db.snapshots], async () => {
    const existingChapters = await db.chapters.where('novelId').equals(novelId).toArray();
    const chapterIds = existingChapters.map(c => c.id);
    await db.snapshots.where('chapterId').anyOf(chapterIds).delete();
    await db.chapters.where('novelId').equals(novelId).delete();

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

export async function secureWipeIntegrationArtifacts(): Promise<void> {
  localStorage.removeItem(INTEGRATIONS_STORAGE_KEY);
}
