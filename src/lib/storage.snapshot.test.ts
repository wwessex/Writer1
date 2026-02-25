/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  createSnapshot,
  getSnapshots,
  deleteSnapshot,
  updateSnapshotLabel,
} from './storage';

describe('storage snapshot operations', () => {
  beforeEach(async () => {
    await db.transaction('rw', [db.snapshots], async () => {
      await db.snapshots.clear();
    });
  });

  it('creates a snapshot without a label', async () => {
    const doc = { type: 'doc' as const, content: [{ type: 'paragraph' }] };
    const snapshot = await createSnapshot('ch-1', doc);
    expect(snapshot.id).toBeTruthy();
    expect(snapshot.chapterId).toBe('ch-1');
    expect(snapshot.doc).toEqual(doc);
    expect(snapshot.label).toBeUndefined();
  });

  it('creates a snapshot with a label', async () => {
    const doc = { type: 'doc' as const, content: [] };
    const snapshot = await createSnapshot('ch-1', doc, 'Auto');
    expect(snapshot.label).toBe('Auto');
  });

  it('retrieves snapshots sorted by createdAt', async () => {
    const doc = { type: 'doc' as const, content: [] };
    await createSnapshot('ch-1', doc, 'First');
    await new Promise(r => setTimeout(r, 5));
    await createSnapshot('ch-1', doc, 'Second');

    const snapshots = await getSnapshots('ch-1');
    expect(snapshots).toHaveLength(2);
    // Should be reverse chronological
    expect(snapshots[0].label).toBe('Second');
    expect(snapshots[1].label).toBe('First');
  });

  it('only returns snapshots for the given chapter', async () => {
    const doc = { type: 'doc' as const, content: [] };
    await createSnapshot('ch-1', doc);
    await createSnapshot('ch-2', doc);

    const snapshots = await getSnapshots('ch-1');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].chapterId).toBe('ch-1');
  });

  it('updates snapshot label', async () => {
    const doc = { type: 'doc' as const, content: [] };
    const snapshot = await createSnapshot('ch-1', doc, 'Auto');

    await updateSnapshotLabel(snapshot.id, 'Important revision');

    const snapshots = await getSnapshots('ch-1');
    expect(snapshots[0].label).toBe('Important revision');
  });

  it('deletes a snapshot', async () => {
    const doc = { type: 'doc' as const, content: [] };
    const snapshot = await createSnapshot('ch-1', doc);

    await deleteSnapshot(snapshot.id);

    const snapshots = await getSnapshots('ch-1');
    expect(snapshots).toHaveLength(0);
  });

  it('handles empty label string', async () => {
    const doc = { type: 'doc' as const, content: [] };
    const snapshot = await createSnapshot('ch-1', doc, '');
    // Empty string should not set label (due to truthy check)
    expect(snapshot.label).toBeUndefined();
  });
});
