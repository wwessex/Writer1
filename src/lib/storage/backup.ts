import type { Novel, Chapter, Snapshot, BackupData, BackupDataV3, LegacyBackupData, ProjectType } from '@/types';
import { generateId } from '@/lib/utils';
import { db } from '@/lib/storage/db';
import { getNovel, normalizeNovel } from '@/lib/storage/novels';
import { getChapters } from '@/lib/storage/chapters';
import { getCommentThreadsForChapters, upsertCommentThread } from '@/lib/storage/comments';

const CURRENT_BACKUP_VERSION = 3;

function normalizeProjectType(projectType?: ProjectType): ProjectType {
  return projectType === 'screenplay' ? 'screenplay' : 'book';
}

export function upgradeBackup(backup: BackupData): BackupDataV3 {
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
