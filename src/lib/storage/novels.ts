import type { Novel, ProjectType } from '@/types';
import { generateId } from '@/lib/utils';
import { db } from '@/lib/storage/db';
import { deleteStoryBlueprint } from '@/lib/storage/blueprints';

function normalizeProjectType(projectType?: ProjectType): ProjectType {
  return projectType === 'screenplay' ? 'screenplay' : 'book';
}

export function normalizeNovel(novel: Novel): Novel {
  return {
    ...novel,
    projectType: normalizeProjectType(novel.projectType)
  };
}

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
  deleteStoryBlueprint(id);
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
