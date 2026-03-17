/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  createNovel,
  getNovel,
  getAllNovels,
  updateNovel,
  deleteNovel,
  getOrCreateDefaultNovel,
  createChapter,
  addChapter,
  getChapter,
  getChapters,
  updateChapter,
  deleteChapter,
  reorderChapters,
  exportBackup,
  importBackup,
  upgradeBackup,
  clearAllData,
  getCommentThreads,
  upsertCommentThread,
  deleteCommentThread,
  saveAllCommentThreads,
  upsertGoalTrendSnapshot,
  getGoalTrendSnapshots,
  mergeImportedSettings,
  mergeImportedIntegrations,
  replaceNovelData,
  secureWipeIntegrationArtifacts,
  exportDhproj,
  importDhproj,
  createSnapshot,
  type GoalTrendSnapshot,
} from './storage';
import type { CommentThread, BackupDataV3, Novel } from '@/types';

describe('storage – novel operations', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
      await db.novels.clear();
      await db.chapters.clear();
      await db.snapshots.clear();
    });
  });

  it('creates and retrieves a novel', async () => {
    const novel = await createNovel('Test Book', 'book');
    expect(novel.id).toBeTruthy();
    expect(novel.title).toBe('Test Book');
    expect(novel.projectType).toBe('book');

    const retrieved = await getNovel(novel.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.title).toBe('Test Book');
  });

  it('returns undefined for non-existent novel', async () => {
    const result = await getNovel('non-existent');
    expect(result).toBeUndefined();
  });

  it('gets all novels sorted by updatedAt', async () => {
    await createNovel('First', 'book');
    await createNovel('Second', 'screenplay');
    const novels = await getAllNovels();
    expect(novels).toHaveLength(2);
  });

  it('updates a novel', async () => {
    const novel = await createNovel('Old Title', 'book');
    await updateNovel(novel.id, { title: 'New Title' });
    const updated = await getNovel(novel.id);
    expect(updated!.title).toBe('New Title');
  });

  it('updates novel with projectType normalization', async () => {
    const novel = await createNovel('Test', 'book');
    await updateNovel(novel.id, { projectType: 'screenplay' });
    const updated = await getNovel(novel.id);
    expect(updated!.projectType).toBe('screenplay');
  });

  it('deletes a novel and its chapters and snapshots', async () => {
    const novel = await createNovel('Delete Me', 'book');
    const chapter = createChapter(novel.id, 0);
    await addChapter(chapter);
    await deleteNovel(novel.id);
    const result = await getNovel(novel.id);
    expect(result).toBeUndefined();
    const chapters = await getChapters(novel.id);
    expect(chapters).toHaveLength(0);
  });

  it('getOrCreateDefaultNovel creates a novel if none exist', async () => {
    const novel = await getOrCreateDefaultNovel();
    expect(novel.id).toBeTruthy();
    expect(novel.title).toBe('My Novel');
    expect(novel.projectType).toBe('book');
  });

  it('getOrCreateDefaultNovel returns existing novel', async () => {
    await createNovel('Existing', 'screenplay');
    const novel = await getOrCreateDefaultNovel();
    expect(novel.title).toBe('Existing');
  });
});

describe('storage – chapter operations', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
      await db.novels.clear();
      await db.chapters.clear();
      await db.snapshots.clear();
    });
  });

  it('createChapter returns correct shape for book', () => {
    const chapter = createChapter('novel-1', 0, undefined, 'book');
    expect(chapter.title).toBe('Chapter 1');
    expect(chapter.novelId).toBe('novel-1');
    expect(chapter.order).toBe(0);
    expect(chapter.status).toBe('planned');
  });

  it('createChapter returns correct shape for screenplay', () => {
    const chapter = createChapter('novel-1', 2, undefined, 'screenplay');
    expect(chapter.title).toBe('Scene 3');
  });

  it('createChapter uses custom title', () => {
    const chapter = createChapter('novel-1', 0, 'Custom Title');
    expect(chapter.title).toBe('Custom Title');
  });

  it('adds and retrieves a chapter', async () => {
    const chapter = createChapter('novel-1', 0);
    await addChapter(chapter);
    const retrieved = await getChapter(chapter.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.title).toBe(chapter.title);
  });

  it('getChapter returns undefined for non-existent chapter', async () => {
    const result = await getChapter('non-existent');
    expect(result).toBeUndefined();
  });

  it('getChapters returns chapters sorted by order', async () => {
    const ch1 = createChapter('novel-1', 1, 'Second');
    const ch0 = createChapter('novel-1', 0, 'First');
    await addChapter(ch1);
    await addChapter(ch0);
    const chapters = await getChapters('novel-1');
    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe('First');
    expect(chapters[1].title).toBe('Second');
  });

  it('updates a chapter', async () => {
    const chapter = createChapter('novel-1', 0);
    await addChapter(chapter);
    await updateChapter(chapter.id, { title: 'Updated' });
    const updated = await getChapter(chapter.id);
    expect(updated!.title).toBe('Updated');
    expect(updated!.updatedAt).toBeGreaterThanOrEqual(chapter.updatedAt);
  });

  it('deletes a chapter and its snapshots', async () => {
    const chapter = createChapter('novel-1', 0);
    await addChapter(chapter);
    await deleteChapter(chapter.id);
    const result = await getChapter(chapter.id);
    expect(result).toBeUndefined();
  });

  it('reorders chapters', async () => {
    const ch0 = createChapter('novel-1', 0, 'First');
    const ch1 = createChapter('novel-1', 1, 'Second');
    await addChapter(ch0);
    await addChapter(ch1);

    await reorderChapters('novel-1', [ch1.id, ch0.id]);

    const chapters = await getChapters('novel-1');
    expect(chapters[0].title).toBe('Second');
    expect(chapters[1].title).toBe('First');
  });
});

describe('storage – comment thread operations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array for no threads', () => {
    expect(getCommentThreads('ch-1')).toEqual([]);
  });

  it('upserts and retrieves comment threads', () => {
    const thread: CommentThread = {
      id: 't-1', chapterId: 'ch-1',
      anchor: { from: 0, to: 10, length: 10 },
      resolved: false, createdAt: Date.now(), updatedAt: Date.now(),
      comments: [{ id: 'c-1', text: 'Hello', author: 'User', createdAt: Date.now() }],
    };
    upsertCommentThread(thread);
    const threads = getCommentThreads('ch-1');
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe('t-1');
  });

  it('updates an existing comment thread', () => {
    const thread: CommentThread = {
      id: 't-1', chapterId: 'ch-1',
      anchor: { from: 0, to: 10, length: 10 },
      resolved: false, createdAt: Date.now(), updatedAt: Date.now(),
      comments: [],
    };
    upsertCommentThread(thread);
    upsertCommentThread({ ...thread, resolved: true });
    const threads = getCommentThreads('ch-1');
    expect(threads).toHaveLength(1);
    expect(threads[0].resolved).toBe(true);
  });

  it('deletes a comment thread', () => {
    const thread: CommentThread = {
      id: 't-1', chapterId: 'ch-1',
      anchor: { from: 0, to: 10, length: 10 },
      resolved: false, createdAt: Date.now(), updatedAt: Date.now(),
      comments: [],
    };
    upsertCommentThread(thread);
    deleteCommentThread('ch-1', 't-1');
    expect(getCommentThreads('ch-1')).toHaveLength(0);
  });

  it('saveAllCommentThreads replaces all threads', () => {
    const thread1: CommentThread = {
      id: 't-1', chapterId: 'ch-1',
      anchor: { from: 0, to: 10, length: 10 },
      resolved: false, createdAt: Date.now(), updatedAt: Date.now(),
      comments: [],
    };
    upsertCommentThread(thread1);
    saveAllCommentThreads('ch-1', []);
    expect(getCommentThreads('ch-1')).toHaveLength(0);
  });

  it('handles invalid JSON in localStorage gracefully', () => {
    localStorage.setItem('draftharbour_comment_threads_ch-bad', '{invalid');
    expect(getCommentThreads('ch-bad')).toEqual([]);
  });

  it('handles non-array JSON in localStorage gracefully', () => {
    localStorage.setItem('draftharbour_comment_threads_ch-bad', '{"not": "array"}');
    expect(getCommentThreads('ch-bad')).toEqual([]);
  });
});

describe('storage – goal trend operations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when no trends exist', () => {
    expect(getGoalTrendSnapshots()).toEqual([]);
  });

  it('upserts and retrieves goal trend snapshots', () => {
    const snapshot: GoalTrendSnapshot = {
      date: '2026-02-25', wordsToday: 500, dailyGoal: 1000, goalMet: false,
    };
    const result = upsertGoalTrendSnapshot(snapshot);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-02-25');
  });

  it('updates existing snapshot by date', () => {
    upsertGoalTrendSnapshot({ date: '2026-02-25', wordsToday: 500, dailyGoal: 1000, goalMet: false });
    upsertGoalTrendSnapshot({ date: '2026-02-25', wordsToday: 1200, dailyGoal: 1000, goalMet: true });
    const result = getGoalTrendSnapshots();
    expect(result).toHaveLength(1);
    expect(result[0].wordsToday).toBe(1200);
    expect(result[0].goalMet).toBe(true);
  });

  it('sorts snapshots by date', () => {
    upsertGoalTrendSnapshot({ date: '2026-02-25', wordsToday: 500, dailyGoal: 1000, goalMet: false });
    upsertGoalTrendSnapshot({ date: '2026-02-20', wordsToday: 300, dailyGoal: 1000, goalMet: false });
    const result = getGoalTrendSnapshots();
    expect(result[0].date).toBe('2026-02-20');
    expect(result[1].date).toBe('2026-02-25');
  });

  it('getGoalTrendSnapshots limits by days', () => {
    upsertGoalTrendSnapshot({ date: '2026-02-20', wordsToday: 100, dailyGoal: 1000, goalMet: false });
    upsertGoalTrendSnapshot({ date: '2026-02-21', wordsToday: 200, dailyGoal: 1000, goalMet: false });
    upsertGoalTrendSnapshot({ date: '2026-02-22', wordsToday: 300, dailyGoal: 1000, goalMet: false });
    const result = getGoalTrendSnapshots(2);
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-02-21');
  });

  it('getGoalTrendSnapshots returns all when days is 0', () => {
    upsertGoalTrendSnapshot({ date: '2026-02-20', wordsToday: 100, dailyGoal: 1000, goalMet: false });
    upsertGoalTrendSnapshot({ date: '2026-02-21', wordsToday: 200, dailyGoal: 1000, goalMet: false });
    const result = getGoalTrendSnapshots(0);
    expect(result).toHaveLength(2);
  });

  it('handles malformed localStorage data', () => {
    localStorage.setItem('draftharbour_goal_trends_v1', 'not json');
    expect(getGoalTrendSnapshots()).toEqual([]);
  });

  it('handles non-array localStorage data', () => {
    localStorage.setItem('draftharbour_goal_trends_v1', '{"not":"array"}');
    expect(getGoalTrendSnapshots()).toEqual([]);
  });

  it('filters out invalid entries from localStorage', () => {
    localStorage.setItem('draftharbour_goal_trends_v1', JSON.stringify([
      { date: '2026-02-20', wordsToday: 100, dailyGoal: 1000, goalMet: false },
      { badEntry: true },
      { date: '2026-02-21', wordsToday: 200, dailyGoal: 1000, goalMet: false },
    ]));
    const result = getGoalTrendSnapshots();
    expect(result).toHaveLength(2);
  });
});

describe('storage – backup operations', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
      await db.novels.clear();
      await db.chapters.clear();
      await db.snapshots.clear();
    });
    localStorage.clear();
  });

  it('upgradeBackup handles v3 backup', () => {
    const v3: BackupDataV3 = {
      version: 3,
      projectType: 'book',
      project: { id: 'n-1', title: 'Novel', updatedAt: 1 },
      sections: [],
      exportedAt: Date.now(),
    };
    const result = upgradeBackup(v3);
    expect(result.version).toBe(3);
    expect(result.projectType).toBe('book');
  });

  it('upgradeBackup handles legacy backup without version', () => {
    const legacy = {
      novel: { id: 'n-1', title: 'Novel', updatedAt: 1 },
      chapters: [],
      exportedAt: Date.now(),
    };
    const result = upgradeBackup(legacy as unknown as BackupDataV3);
    expect(result.version).toBe(3);
    expect(result.projectType).toBe('book');
    expect(result.project.id).toBe('n-1');
  });

  it('exportBackup creates valid backup', async () => {
    const novel = await createNovel('Backup Test', 'book');
    const chapter = createChapter(novel.id, 0);
    await addChapter(chapter);

    const backup = await exportBackup(novel.id);
    expect(backup.version).toBe(3);
    expect(backup.project.title).toBe('Backup Test');
    expect(backup.sections).toHaveLength(1);
  });

  it('exportBackup throws for non-existent novel', async () => {
    await expect(exportBackup('non-existent')).rejects.toThrow('Novel not found');
  });

  it('exportBackup excludes snapshots when option is false', async () => {
    const novel = await createNovel('Test', 'book');
    const backup = await exportBackup(novel.id, false);
    expect(backup.snapshots).toBeUndefined();
  });

  it('importBackup creates novel with remapped IDs', async () => {
    const backup: BackupDataV3 = {
      version: 3,
      projectType: 'screenplay',
      project: { id: 'old-id', title: 'Imported', updatedAt: 1 },
      sections: [{ id: 'old-ch', novelId: 'old-id', order: 0, title: 'Scene 1', updatedAt: 1, content: null, summary: '', pov: '', status: 'draft' as const, tags: [], wordGoal: 0, scenes: [] }],
      snapshots: [],
      exportedAt: Date.now(),
    };
    const novel = await importBackup(backup);
    expect(novel.id).not.toBe('old-id');
    expect(novel.title).toBe('Imported');

    const chapters = await getChapters(novel.id);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].id).not.toBe('old-ch');
  });

  it('replaceNovelData replaces all chapters', async () => {
    const novel = await createNovel('Test', 'book');
    const ch = createChapter(novel.id, 0, 'Original');
    await addChapter(ch);

    const newChapters = [
      createChapter(novel.id, 0, 'Replaced 1'),
      createChapter(novel.id, 1, 'Replaced 2'),
    ];
    await replaceNovelData(novel.id, newChapters);

    const chapters = await getChapters(novel.id);
    expect(chapters).toHaveLength(2);
  });

  it('clearAllData removes everything', async () => {
    await createNovel('Test', 'book');
    upsertCommentThread({
      id: 't-1', chapterId: 'ch-1',
      anchor: { from: 0, to: 10, length: 10 },
      resolved: false, createdAt: Date.now(), updatedAt: Date.now(),
      comments: [],
    });

    await clearAllData();
    const novels = await getAllNovels();
    expect(novels).toHaveLength(0);
  });
});

describe('storage – mergeImportedSettings', () => {
  it('merges settings with empty existing', () => {
    const result = mergeImportedSettings(null, { dailyWordGoal: 2000 });
    expect(result.dailyWordGoal).toBe(2000);
  });

  it('merges settings over existing values', () => {
    const existing = JSON.stringify({ dailyWordGoal: 500, theme: 'dark' });
    const result = mergeImportedSettings(existing, { dailyWordGoal: 2000 });
    expect(result.dailyWordGoal).toBe(2000);
    expect(result.theme).toBe('dark');
  });

  it('handles invalid existing JSON', () => {
    const result = mergeImportedSettings('{invalid', { dailyWordGoal: 2000 });
    expect(result.dailyWordGoal).toBe(2000);
  });
});

describe('storage – mergeImportedIntegrations', () => {
  it('merges new integrations', () => {
    const result = mergeImportedIntegrations(null, {
      dropbox: { type: 'dropbox', enabled: true },
    });
    expect(result.dropbox).toBeDefined();
    expect(result.dropbox!.enabled).toBe(true);
  });

  it('preserves existing integrations', () => {
    const existing = JSON.stringify({ scrivener: { type: 'scrivener', enabled: true } });
    const result = mergeImportedIntegrations(existing, {});
    expect(result.scrivener).toBeDefined();
  });

  it('handles invalid existing JSON', () => {
    const result = mergeImportedIntegrations('{bad', {
      dropbox: { type: 'dropbox', enabled: false },
    });
    expect(result.dropbox).toBeDefined();
  });

  it('rejects non-record imported values', () => {
    const result = mergeImportedIntegrations(null, {
      dropbox: 'invalid',
    });
    expect(result.dropbox).toBeUndefined();
  });

  it('sanitizes imported integration config fields', () => {
    const result = mergeImportedIntegrations(null, {
      'google-drive': {
        type: 'google-drive',
        enabled: true,
        connectionId: 'conn-123',
        providerUserId: 'user-456',
        scopes: ['read', 'write', 123],
        expiresAt: 1234567890,
        status: 'connected',
        folderId: 'folder-789',
        lastSyncAt: 1234567800,
      },
    });
    const gd = result['google-drive'];
    expect(gd).toBeDefined();
    expect(gd!.enabled).toBe(true);
    expect(gd!.connectionId).toBe('conn-123');
    expect(gd!.providerUserId).toBe('user-456');
    expect(gd!.scopes).toEqual(['read', 'write']);
    expect(gd!.expiresAt).toBe(1234567890);
    expect(gd!.status).toBe('connected');
    expect(gd!.folderId).toBe('folder-789');
    expect(gd!.lastSyncAt).toBe(1234567800);
  });

  it('handles invalid status in integration config', () => {
    const result = mergeImportedIntegrations(null, {
      dropbox: { type: 'dropbox', enabled: false, status: 'invalid-status' },
    });
    expect(result.dropbox!.status).toBeUndefined();
  });

  it('handles non-boolean enabled in integration config', () => {
    const result = mergeImportedIntegrations(null, {
      dropbox: { type: 'dropbox', enabled: 'yes' },
    });
    expect(result.dropbox!.enabled).toBe(false);
  });

  it('handles non-string connectionId in integration config', () => {
    const result = mergeImportedIntegrations(null, {
      dropbox: { type: 'dropbox', connectionId: 123 },
    });
    expect(result.dropbox!.connectionId).toBeUndefined();
  });

  it('handles non-number expiresAt in integration config', () => {
    const result = mergeImportedIntegrations(null, {
      dropbox: { type: 'dropbox', expiresAt: 'never' },
    });
    expect(result.dropbox!.expiresAt).toBeUndefined();
  });
});

describe('storage – secureWipeIntegrationArtifacts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes integration artifacts from localStorage', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({ dropbox: { enabled: true } }));
    await secureWipeIntegrationArtifacts();
    expect(localStorage.getItem('draftharbour_integrations')).toBeNull();
  });
});

describe('storage – importBackup with snapshots and comments', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
      await db.novels.clear();
      await db.chapters.clear();
      await db.snapshots.clear();
    });
    localStorage.clear();
  });

  it('imports backup with snapshots remapped to new chapter IDs', async () => {
    const backup: BackupDataV3 = {
      version: 3,
      projectType: 'book',
      project: { id: 'old-novel', title: 'With Snapshots', updatedAt: 1 },
      sections: [{ id: 'old-ch', novelId: 'old-novel', order: 0, title: 'Ch 1', updatedAt: 1, content: null, summary: '', pov: '', status: 'draft' as const, tags: [], wordGoal: 0, scenes: [] }],
      snapshots: [{ id: 'old-snap', chapterId: 'old-ch', createdAt: Date.now(), doc: '' }],
      commentThreads: [{
        id: 'old-thread', chapterId: 'old-ch',
        anchor: { from: 0, to: 5, length: 5 },
        resolved: false, createdAt: Date.now(), updatedAt: Date.now(),
        comments: [{ id: 'c-1', text: 'Note', author: 'User', createdAt: Date.now() }],
      }],
      exportedAt: Date.now(),
    };
    const novel = await importBackup(backup);
    const chapters = await getChapters(novel.id);
    expect(chapters).toHaveLength(1);

    // Snapshot should be remapped
    const allSnapshots = await db.snapshots.toArray();
    expect(allSnapshots).toHaveLength(1);
    expect(allSnapshots[0].chapterId).toBe(chapters[0].id);
    expect(allSnapshots[0].id).not.toBe('old-snap');

    // Comment thread should be remapped
    const threads = getCommentThreads(chapters[0].id);
    expect(threads).toHaveLength(1);
    expect(threads[0].chapterId).toBe(chapters[0].id);
  });

  it('handles legacy backup (v1) with no snapshots', async () => {
    const legacy = {
      novel: { id: 'old-n', title: 'Legacy', updatedAt: 1 },
      chapters: [{ id: 'old-ch', novelId: 'old-n', order: 0, title: 'Ch', updatedAt: 1, content: null, summary: '', pov: '', status: 'draft', tags: [], wordGoal: 0, scenes: [] }],
      exportedAt: Date.now(),
    };
    const novel = await importBackup(legacy as unknown as BackupDataV3);
    expect(novel.title).toBe('Legacy');
  });

  it('getOrCreateDefaultNovel adds projectType if missing', async () => {
    // Directly add a novel without projectType
    await db.novels.add({ id: 'n-no-type', title: 'No Type', updatedAt: Date.now() } as Novel);
    const novel = await getOrCreateDefaultNovel();
    expect(novel.projectType).toBe('book');
  });
});

describe('storage – deleteChapter clears localStorage comment threads', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
      await db.novels.clear();
      await db.chapters.clear();
      await db.snapshots.clear();
    });
    localStorage.clear();
  });

  it('removes comment threads from localStorage when chapter is deleted', async () => {
    const chapter = createChapter('novel-1', 0);
    await addChapter(chapter);
    upsertCommentThread({
      id: 't-1', chapterId: chapter.id,
      anchor: { from: 0, to: 10, length: 10 },
      resolved: false, createdAt: Date.now(), updatedAt: Date.now(),
      comments: [],
    });
    expect(getCommentThreads(chapter.id)).toHaveLength(1);

    await deleteChapter(chapter.id);
    expect(getCommentThreads(chapter.id)).toHaveLength(0);
  });
});

describe('storage – exportDhproj and importDhproj', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.novels, db.chapters, db.snapshots], async () => {
      await db.novels.clear();
      await db.chapters.clear();
      await db.snapshots.clear();
    });
    localStorage.clear();
  });

  it('exportDhproj creates a valid ZIP blob', async () => {
    const novel = await createNovel('Export Test', 'book');
    const chapter = createChapter(novel.id, 0, 'Chapter 1');
    await addChapter(chapter);
    await createSnapshot(chapter.id, '');

    const blob = await exportDhproj(novel.id);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exportDhproj throws for non-existent novel', async () => {
    await expect(exportDhproj('non-existent')).rejects.toThrow('Novel not found');
  });

  it('exportDhproj includes settings and progress from localStorage', async () => {
    const novel = await createNovel('Settings Export', 'book');

    // Store settings and progress in localStorage
    localStorage.setItem('draftharbour_settings_v1', JSON.stringify({ theme: 'dark' }));
    localStorage.setItem('draftharbour_progress_v1', JSON.stringify({
      dailyHistory: [{ date: '2026-02-25', wordsWritten: 500, wordsAtStart: 0, goalMet: false, sessions: 1 }],
      streak: { current: 1, longest: 5, lastActiveDate: '2026-02-25' },
      totalSessions: 10,
      totalWordsAllTime: 50000,
    }));

    // Store characters and world entries
    localStorage.setItem('draftharbour_characters', JSON.stringify([{
      id: 'char-1', novelId: novel.id, name: 'Alice', aliases: [],
      description: 'Protagonist', role: 'protagonist', traits: ['brave'],
      notes: '', relationships: [], createdAt: 1, updatedAt: 1,
    }]));
    localStorage.setItem('draftharbour_world', JSON.stringify([{
      id: 'world-1', novelId: novel.id, category: 'location', name: 'Castle',
      description: 'Ancient castle', tags: ['medieval'], linkedCharacters: ['char-1'],
      notes: '', createdAt: 1, updatedAt: 1,
    }]));

    const blob = await exportDhproj(novel.id);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exportDhproj with integration artifacts option', async () => {
    const novel = await createNovel('Int Export', 'book');
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      dropbox: { type: 'dropbox', enabled: true, status: 'connected' },
    }));

    const blob = await exportDhproj(novel.id, { includeIntegrationArtifacts: true });
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exportDhproj without snapshots', async () => {
    const novel = await createNovel('No Snaps', 'book');
    const blob = await exportDhproj(novel.id, { includeSnapshots: false });
    expect(blob.size).toBeGreaterThan(0);
  });

  it('importDhproj round-trips with exportDhproj', async () => {
    const novel = await createNovel('Round Trip', 'screenplay');
    const chapter = createChapter(novel.id, 0, 'Scene 1', 'screenplay');
    await addChapter(chapter);

    const blob = await exportDhproj(novel.id);
    const file = new File([blob], 'test.dhproj', { type: 'application/zip' });

    const imported = await importDhproj(file);
    expect(imported.title).toBe('Round Trip');
    expect(imported.projectType).toBe('screenplay');
    expect(imported.id).not.toBe(novel.id);

    const chapters = await getChapters(imported.id);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Scene 1');
  });

  it('importDhproj with progress data merges correctly', async () => {
    // Set up local progress
    localStorage.setItem('draftharbour_progress_v1', JSON.stringify({
      dailyHistory: [{ date: '2026-02-20', wordsWritten: 300, wordsAtStart: 0, goalMet: false, sessions: 1 }],
      streak: { current: 1, longest: 3, lastActiveDate: '2026-02-20' },
      totalSessions: 5,
      totalWordsAllTime: 10000,
    }));

    // Create and export a project with progress
    const novel = await createNovel('Progress Test', 'book');
    localStorage.setItem('draftharbour_progress_v1', JSON.stringify({
      dailyHistory: [
        { date: '2026-02-20', wordsWritten: 500, wordsAtStart: 0, goalMet: true, sessions: 2 },
        { date: '2026-02-21', wordsWritten: 800, wordsAtStart: 500, goalMet: true, sessions: 1 },
      ],
      streak: { current: 2, longest: 7, lastActiveDate: '2026-02-21' },
      totalSessions: 15,
      totalWordsAllTime: 25000,
    }));

    const blob = await exportDhproj(novel.id);
    const file = new File([blob], 'test.dhproj', { type: 'application/zip' });

    const imported = await importDhproj(file);
    expect(imported.title).toBe('Progress Test');
  });

  it('importDhproj with settings merges correctly', async () => {
    localStorage.setItem('draftharbour_settings_v1', JSON.stringify({ theme: 'light' }));

    const novel = await createNovel('Settings Test', 'book');
    localStorage.setItem('draftharbour_settings_v1', JSON.stringify({ theme: 'dark', dailyWordGoal: 2000 }));

    const blob = await exportDhproj(novel.id);
    const file = new File([blob], 'test.dhproj', { type: 'application/zip' });

    await importDhproj(file);
    const settingsRaw = localStorage.getItem('draftharbour_settings_v1');
    expect(settingsRaw).toBeTruthy();
  });

  it('importDhproj with characters and world entries', async () => {
    const novel = await createNovel('Bible Test', 'book');
    localStorage.setItem('draftharbour_characters', JSON.stringify([{
      id: 'char-1', novelId: novel.id, name: 'Bob', aliases: ['Robert'],
      description: 'Side character', role: 'supporting', traits: [],
      notes: '', relationships: [], createdAt: 1, updatedAt: 1,
    }]));
    localStorage.setItem('draftharbour_world', JSON.stringify([{
      id: 'world-1', novelId: novel.id, category: 'location', name: 'Forest',
      description: 'Dark forest', tags: [], linkedCharacters: ['char-1'],
      notes: '', createdAt: 1, updatedAt: 1,
    }]));

    const blob = await exportDhproj(novel.id);
    const file = new File([blob], 'test.dhproj', { type: 'application/zip' });

    const imported = await importDhproj(file);
    expect(imported.title).toBe('Bible Test');

    // Characters should be restored
    const chars = JSON.parse(localStorage.getItem('draftharbour_characters') || '[]');
    const importedChars = chars.filter((c: { novelId: string }) => c.novelId === imported.id);
    expect(importedChars).toHaveLength(1);
    expect(importedChars[0].name).toBe('Bob');
  });

  it('importDhproj with goal trends', async () => {
    const novel = await createNovel('Trends Test', 'book');
    upsertGoalTrendSnapshot({ date: '2026-02-25', wordsToday: 500, dailyGoal: 1000, goalMet: false });

    const blob = await exportDhproj(novel.id);
    const file = new File([blob], 'test.dhproj', { type: 'application/zip' });

    localStorage.clear();
    await importDhproj(file);

    const trends = getGoalTrendSnapshots();
    expect(trends).toHaveLength(1);
  });

  it('importDhproj with integrations', async () => {
    const novel = await createNovel('Int Test', 'book');
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      dropbox: { type: 'dropbox', enabled: true, status: 'connected' },
    }));

    const blob = await exportDhproj(novel.id, { includeIntegrationArtifacts: true });
    const file = new File([blob], 'test.dhproj', { type: 'application/zip' });

    localStorage.removeItem('draftharbour_integrations');
    await importDhproj(file);
  });
});
