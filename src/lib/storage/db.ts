import Dexie, { type EntityTable } from 'dexie';
import type { Novel, Chapter, Snapshot } from '@/types';

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
