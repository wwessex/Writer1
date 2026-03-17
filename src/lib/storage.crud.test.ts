/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  createNovel,
  getAllNovels,
  createChapter,
  addChapter,
  getChapters,
  createSnapshot,
  getSnapshots,
  deleteNovel,
  getNovel,
} from './storage';

describe('storage CRUD behavior', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.transaction('rw', [db.snapshots, db.chapters, db.novels], async () => {
      await db.snapshots.clear();
      await db.chapters.clear();
      await db.novels.clear();
    });
  });

  it('creates novels and returns them in updated order', async () => {
    const older = await createNovel('Older Novel', 'book');
    await new Promise(resolve => setTimeout(resolve, 5));
    const newer = await createNovel('Newer Novel', 'screenplay');

    const novels = await getAllNovels();

    expect(novels.map(novel => novel.id)).toEqual([newer.id, older.id]);
    expect(novels[0].projectType).toBe('screenplay');
  });

  it('stores chapters and snapshots, then cascades deletes when a novel is removed', async () => {
    const novel = await createNovel('Cascade', 'book');
    const chapter = createChapter(novel.id, 0, 'Chapter 1');
    await addChapter(chapter);

    await createSnapshot(chapter.id, 'Some content');

    expect((await getChapters(novel.id)).length).toBe(1);
    expect((await getSnapshots(chapter.id)).length).toBe(1);

    await deleteNovel(novel.id);

    expect(await getNovel(novel.id)).toBeUndefined();
    expect((await getChapters(novel.id)).length).toBe(0);
    expect((await getSnapshots(chapter.id)).length).toBe(0);
  });
});
