import type { Chapter, ConflictInfo } from '@/types';
import { describe, expect, it } from 'vitest';
import { mergeChapterFromRemote, resolveSyncConflict, buildPushSyncMetadata } from './sync';
import { mapAppStateToProviderPayload, normalizeProviderPullResponse } from './orchestration';
import type { ProviderDocument } from './types';

function makeChapter(overrides?: Partial<Chapter>): Chapter {
  return {
    id: 'chapter-1',
    novelId: 'novel-1',
    order: 1,
    title: 'Chapter 1',
    updatedAt: 100,
    content: 'Base text',
    summary: 'Base text',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
    sync: {
      providerRevisionIds: { dropbox: 'rev-1' },
      lastSyncedContent: 'Base text',
    },
    ...overrides,
  };
}

function makeRemote(body: string, overrides?: Partial<ProviderDocument>): ProviderDocument {
  return {
    id: 'remote-1',
    title: 'Remote Title',
    body,
    order: 1,
    updatedAt: 200,
    ...overrides,
  };
}

describe('mergeChapterFromRemote', () => {
  it('keeps lastSyncedContent at base when only local content changed', async () => {
    const chapter = makeChapter({
      content: 'Local draft change',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: 'Base text',
      },
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Base text'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeUndefined();
    expect(chapterUpdate.content).toBe('Local draft change');
    expect(chapterUpdate.sync?.lastSyncedContent).toBe('Base text');
  });

  it('updates lastSyncedContent when remote content is accepted', async () => {
    const chapter = makeChapter({
      content: 'Base text',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: 'Base text',
      },
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Remote edit'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeUndefined();
    expect(chapterUpdate.content).toBe('Remote edit');
    expect(chapterUpdate.sync?.lastSyncedContent).toBe('Remote edit');
  });

  it('auto-merges non-overlapping local and remote edits', async () => {
    const baseContent = 'Line 1\nLine 2\nLine 3';
    const chapter = makeChapter({
      content: 'Line 1 - local\nLine 2\nLine 3',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: baseContent,
      },
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Line 1\nLine 2\nLine 3 - remote'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeUndefined();
    expect(chapterUpdate.content).toBe('Line 1 - local\nLine 2\nLine 3 - remote');
    expect(chapterUpdate.sync?.lastSyncedContent).toBe('Line 1 - local\nLine 2\nLine 3 - remote');
  });

  it('surfaces conflict markers and block metadata for overlapping edits', async () => {
    const baseContent = 'Base text';
    const chapter = makeChapter({
      content: 'Local changed text',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: baseContent,
      },
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Remote changed text'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeDefined();
    expect(conflict!.chapterId).toBe('chapter-1');
    expect(conflict!.resolutionOptions).toContain('local');
    expect(conflict!.resolutionOptions).toContain('remote');
    expect(conflict!.resolutionOptions).toContain('merge');
    expect(conflict!.localContent).toBe('Local changed text');
    expect(conflict!.remoteContent).toBeDefined();
    expect(conflict!.baseContent).toBe(baseContent);
    expect(conflict!.mergedContent).toBe(
      '<<<<<<< LOCAL\nLocal changed text\n=======\nRemote changed text\n>>>>>>> REMOTE'
    );
    expect(conflict!.mergeConflictBlocks).toEqual([
      expect.objectContaining({
        baseStart: 0,
        baseEnd: 1,
        localLines: ['Local changed text'],
        remoteLines: ['Remote changed text'],
      }),
    ]);
    // Chapter update should keep base as sync content during conflict
    expect(chapterUpdate.sync?.lastSyncedContent).toBe(baseContent);
  });

  it('does not duplicate paragraphs across repeated sync cycles', async () => {
    const baseContent = 'Intro\nBody\nEnding';
    const chapter = makeChapter({
      content: 'Intro local\nBody\nEnding',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: baseContent,
      },
    });

    const first = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Intro\nBody\nEnding remote'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(first.conflict).toBeUndefined();
    expect(first.chapterUpdate.content).toBe('Intro local\nBody\nEnding remote');

    const second = await mergeChapterFromRemote({
      chapter: first.chapterUpdate,
      remoteDocument: makeRemote('Intro\nBody\nEnding remote', { updatedAt: 300 }),
      context: { provider: 'dropbox', remoteRevision: 'rev-3' },
    });

    expect(second.conflict).toBeUndefined();
    expect(second.chapterUpdate.content).toBe('Intro\nBody\nEnding remote');
  });

  it('updates title and order from remote when no conflict', async () => {
    const chapter = makeChapter({
      content: 'Base text',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: 'Base text',
      },
    });

    const { chapterUpdate } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Remote edit', { title: 'New Remote Title', order: 5 }),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(chapterUpdate.title).toBe('New Remote Title');
    expect(chapterUpdate.order).toBe(5);
  });

  it('handles chapter with no prior sync metadata', async () => {
    const chapter = makeChapter({
      content: 'Local content',
      sync: undefined,
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Remote content'),
      context: { provider: 'google-drive', remoteRevision: 'gdrive-rev-1' },
    });

    // Both "changed" from null base -> conflict
    expect(conflict).toBeDefined();
    expect(chapterUpdate.sync?.providerRevisionIds?.['google-drive']).toBe('gdrive-rev-1');
  });

  it('handles empty remote document body', async () => {
    const chapter = makeChapter({
      content: 'Base text',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: 'Base text',
      },
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote(''),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    // Remote changed (to empty), local unchanged -> accept remote
    expect(conflict).toBeUndefined();
    expect(chapterUpdate.sync?.providerRevisionIds?.dropbox).toBe('rev-2');
  });

  it('preserves provider revision IDs from multiple providers', async () => {
    const chapter = makeChapter({
      content: 'Base text',
      sync: {
        providerRevisionIds: { dropbox: 'dropbox-rev-1', 'google-drive': 'gdrive-rev-1' },
        lastSyncedContent: 'Base text',
      },
    });

    const { chapterUpdate } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Remote edit'),
      context: { provider: 'dropbox', remoteRevision: 'dropbox-rev-2' },
    });

    expect(chapterUpdate.sync?.providerRevisionIds?.dropbox).toBe('dropbox-rev-2');
    expect(chapterUpdate.sync?.providerRevisionIds?.['google-drive']).toBe('gdrive-rev-1');
  });

  it('sets lastPulledAt timestamp on merge', async () => {
    const before = Date.now();
    const chapter = makeChapter({
      content: 'Base text',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: 'Base text',
      },
    });

    const { chapterUpdate } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Remote edit'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(chapterUpdate.sync?.lastPulledAt).toBeGreaterThanOrEqual(before);
  });
});

describe('resolveSyncConflict', () => {
  const conflict: ConflictInfo = {
    chapterId: 'chapter-1',
    localVersion: 100,
    remoteVersion: 200,
    localContent: 'Local text',
    remoteContent: 'Remote text',
    baseContent: 'Base text',
    mergedContent: 'Local text\nRemote text',
    localUpdatedAt: 100,
    remoteUpdatedAt: 200,
    resolutionOptions: ['local', 'remote', 'merge'],
  };

  it('returns local content for local resolution', () => {
    const result = resolveSyncConflict(conflict, 'local');
    expect(result).toBe('Local text');
  });

  it('returns remote content for remote resolution', () => {
    const result = resolveSyncConflict(conflict, 'remote');
    expect(result).toBe('Remote text');
  });

  it('returns merged content for merge resolution', () => {
    const result = resolveSyncConflict(conflict, 'merge');
    expect(result).toBe(conflict.mergedContent);
  });

  it('falls back to local when merge content is missing', () => {
    const conflictNoMerge: ConflictInfo = {
      ...conflict,
      mergedContent: undefined,
    };
    const result = resolveSyncConflict(conflictNoMerge, 'merge');
    expect(result).toBe('Local text');
  });
});

describe('buildPushSyncMetadata', () => {
  it('records lastPushedHash for the current content', async () => {
    const chapter = makeChapter({ content: 'Push me' });

    const meta = await buildPushSyncMetadata(chapter, 'dropbox', 'push-rev-1');

    expect(meta.providerRevisionIds.dropbox).toBe('push-rev-1');
    expect(meta.lastPushedHash).toBeDefined();
    expect(typeof meta.lastPushedHash).toBe('string');
    expect(meta.lastSyncedContent).toBe('Push me');
  });

  it('preserves existing provider revision IDs', async () => {
    const chapter = makeChapter({
      sync: {
        providerRevisionIds: { 'google-drive': 'gdrive-1' },
        lastSyncedContent: 'Base text',
      },
    });

    const meta = await buildPushSyncMetadata(chapter, 'dropbox', 'push-rev-1');

    expect(meta.providerRevisionIds.dropbox).toBe('push-rev-1');
    expect(meta.providerRevisionIds['google-drive']).toBe('gdrive-1');
  });

  it('produces identical SHA-256 hashes for equivalent content', async () => {
    const chapterA = makeChapter({ content: 'Equivalent' });
    const chapterB = makeChapter({ content: 'Equivalent' });

    const metaA = await buildPushSyncMetadata(chapterA, 'dropbox', 'push-rev-1');
    const metaB = await buildPushSyncMetadata(chapterB, 'dropbox', 'push-rev-1');

    expect(metaA.lastPushedHash).toEqual(metaB.lastPushedHash);
    expect(metaA.lastPushedHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe('canonical hash merge behavior', () => {
  it('treats identical local content as unchanged relative to base', async () => {
    const baseContent = 'Base text';

    const chapter = makeChapter({
      content: 'Base text',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: baseContent,
      },
    });

    const { conflict, chapterUpdate } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Base text'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeUndefined();
    expect(chapterUpdate.content).toBe(baseContent);
  });

  it('clears legacy non-SHA lastPushedHash when metadata is carried forward', async () => {
    const chapter = makeChapter({
      content: 'Base text',
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: 'Base text',
        lastPushedHash: 'h12345',
      },
    });

    const { chapterUpdate } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Base text'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(chapterUpdate.sync?.lastPushedHash).toBeUndefined();
  });
});

describe('mapAppStateToProviderPayload', () => {
  it('maps chapters to provider documents', () => {
    const chapters: Chapter[] = [
      makeChapter({
        id: 'ch-1',
        title: 'First Chapter',
        order: 0,
        content: 'Hello world',
      }),
      makeChapter({
        id: 'ch-2',
        title: 'Second Chapter',
        order: 1,
        content: 'Goodbye world',
      }),
    ];

    const payload = mapAppStateToProviderPayload({
      novelId: 'novel-1',
      projectType: 'book',
      chapters,
    });

    expect(payload.novelId).toBe('novel-1');
    expect(payload.projectType).toBe('book');
    expect(payload.chapters).toHaveLength(2);
    expect(payload.chapters[0].id).toBe('ch-1');
    expect(payload.chapters[0].title).toBe('First Chapter');
    expect(payload.chapters[0].body).toContain('Hello world');
    expect(payload.chapters[1].body).toContain('Goodbye world');
  });

  it('handles chapters with null content', () => {
    const chapters: Chapter[] = [
      makeChapter({ id: 'ch-1', content: null, summary: 'A summary' }),
    ];

    const payload = mapAppStateToProviderPayload({
      novelId: 'novel-1',
      projectType: 'book',
      chapters,
    });

    expect(payload.chapters[0].body).toBe('A summary');
  });

  it('handles chapters with empty content', () => {
    const chapters: Chapter[] = [
      makeChapter({ id: 'ch-1', content: '', summary: '' }),
    ];

    const payload = mapAppStateToProviderPayload({
      novelId: 'novel-1',
      projectType: 'book',
      chapters,
    });

    expect(payload.chapters[0].body).toBe('');
  });
});

describe('normalizeProviderPullResponse', () => {
  it('creates new chapters for unmatched remote documents', async () => {
    const localChapters: Chapter[] = [];
    const remoteDocs: ProviderDocument[] = [
      makeRemote('New chapter text', { id: 'new-1', title: 'New Chapter', order: 0 }),
    ];

    const result = await normalizeProviderPullResponse(localChapters, remoteDocs, 'rev-1', 'dropbox');

    expect(result.chapterUpdates).toHaveLength(1);
    expect(result.chapterUpdates[0].id).toBe('new-1');
    expect(result.chapterUpdates[0].title).toBe('New Chapter');
    expect(result.chapterUpdates[0].summary).toBe('New chapter text');
    expect(result.chapterUpdates[0].sync?.providerRevisionIds.dropbox).toBe('rev-1');
    expect(result.conflicts).toHaveLength(0);
  });

  it('merges existing chapters with matching remote docs', async () => {
    const localChapters: Chapter[] = [
      makeChapter({
        id: 'chapter-1',
        content: 'Base text',
        sync: {
          providerRevisionIds: { dropbox: 'rev-1' },
          lastSyncedContent: 'Base text',
        },
      }),
    ];

    const remoteDocs: ProviderDocument[] = [
      makeRemote('Updated remote', { id: 'chapter-1', title: 'Updated Title' }),
    ];

    const result = await normalizeProviderPullResponse(localChapters, remoteDocs, 'rev-2', 'dropbox');

    expect(result.chapterUpdates).toHaveLength(1);
    expect(result.chapterUpdates[0].title).toBe('Updated Title');
    expect(result.conflicts).toHaveLength(0);
  });

  it('collects conflicts for diverged chapters', async () => {
    const localChapters: Chapter[] = [
      makeChapter({
        id: 'chapter-1',
        content: 'Local edit',
        sync: {
          providerRevisionIds: { dropbox: 'rev-1' },
          lastSyncedContent: 'Base text',
        },
      }),
    ];

    const remoteDocs: ProviderDocument[] = [
      makeRemote('Remote edit', { id: 'chapter-1', title: 'Ch 1' }),
    ];

    const result = await normalizeProviderPullResponse(localChapters, remoteDocs, 'rev-2', 'dropbox');

    expect(result.chapterUpdates).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].chapterId).toBe('chapter-1');
  });

  it('handles multiple chapters with mixed results', async () => {
    const localChapters: Chapter[] = [
      makeChapter({
        id: 'ch-1',
        content: 'Base text',
        sync: {
          providerRevisionIds: { dropbox: 'rev-1' },
          lastSyncedContent: 'Base text',
        },
      }),
      makeChapter({
        id: 'ch-2',
        content: 'Local edit ch2',
        order: 2,
        sync: {
          providerRevisionIds: { dropbox: 'rev-1' },
          lastSyncedContent: 'Base text ch2',
        },
      }),
    ];

    const remoteDocs: ProviderDocument[] = [
      makeRemote('Remote update', { id: 'ch-1', title: 'Ch 1 Updated', order: 1 }),
      makeRemote('Remote edit ch2', { id: 'ch-2', title: 'Ch 2 Updated', order: 2 }),
    ];

    const result = await normalizeProviderPullResponse(localChapters, remoteDocs, 'rev-2', 'dropbox');

    expect(result.chapterUpdates).toHaveLength(2);
    // ch-1: local unchanged, remote changed -> no conflict
    expect(result.conflicts.filter(c => c.chapterId === 'ch-1')).toHaveLength(0);
    // ch-2: both changed -> conflict
    expect(result.conflicts.filter(c => c.chapterId === 'ch-2')).toHaveLength(1);
  });
});
