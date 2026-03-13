import type { Snapshot } from '@/types';
import { generateId } from '@/lib/utils';
import { db } from '@/lib/storage/db';

export async function getSnapshots(chapterId: string): Promise<Snapshot[]> {
  return db.snapshots
    .where('chapterId')
    .equals(chapterId)
    .reverse()
    .sortBy('createdAt');
}

export async function createSnapshot(chapterId: string, doc: Snapshot['doc'], label?: string): Promise<Snapshot> {
  const snapshot: Snapshot = {
    id: generateId(),
    chapterId,
    createdAt: Date.now(),
    doc,
    ...(label ? { label } : {}),
  };
  await db.snapshots.add(snapshot);
  return snapshot;
}

export async function updateSnapshotLabel(id: string, label: string): Promise<void> {
  await db.snapshots.update(id, { label });
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.snapshots.delete(id);
}
