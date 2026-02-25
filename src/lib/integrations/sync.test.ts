import type { Chapter, ConflictInfo } from '@/types';
import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { mergeChapterFromRemote, resolveSyncConflict, buildPushSyncMetadata } from './sync';
import { mapAppStateToProviderPayload, normalizeProviderPullResponse } from './orchestration';
import type { ProviderDocument } from './types';

function makeDoc(text: string): JSONContent {
  return makeDocFromLines([text]);
}

function makeDocFromLines(lines: string[]): JSONContent {
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line.trim() ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function makeEmptyDoc(): JSONContent {
  return {
    type: 'doc',
    content: [],
  };
}

function makeChapter(overrides?: Partial<Chapter>): Chapter {
  return {
    id: 'chapter-1',
    novelId: 'novel-1',
    order: 1,
    title: 'Chapter 1',
    updatedAt: 100,
    content: makeDoc('Base text'),
    summary: 'Base text',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
    sync: {
      providerRevisionIds: { dropbox: 'rev-1' },
      lastSyncedContent: makeDoc('Base text'),
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
    const baseContent = makeDoc('Base text');
    const chapter = makeChapter({
      content: makeDoc('Local draft change'),
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: baseContent,
      },
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Base text'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeUndefined();
    expect(chapterUpdate.content).toEqual(makeDoc('Local draft change'));
    expect(chapterUpdate.sync?.lastSyncedContent).toEqual(baseContent);
  });

  it('updates lastSyncedContent when remote content is accepted', async () => {
    const chapter = makeChapter({
      content: makeDoc('Base text'),
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: makeDoc('Base text'),
      },
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Remote edit'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeUndefined();
    expect(chapterUpdate.content).toEqual(makeDoc('Remote edit'));
    expect(chapterUpdate.sync?.lastSyncedContent).toEqual(makeDoc('Remote edit'));
  });

  it('auto-merges non-overlapping local and remote edits', async () => {
    const baseContent = makeDocFromLines(['Line 1', 'Line 2', 'Line 3']);
    const chapter = makeChapter({
      content: makeDocFromLines(['Line 1 - local', 'Line 2', 'Line 3']),
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
    expect(chapterUpdate.content).toEqual(makeDocFromLines(['Line 1 - local', 'Line 2', 'Line 3 - remote']));
    expect(chapterUpdate.sync?.lastSyncedContent).toEqual(makeDocFromLines(['Line 1 - local', 'Line 2', 'Line 3 - remote']));
  });

  it('surfaces conflict markers and block metadata for overlapping edits', async () => {
    const baseContent = makeDoc('Base text');
    const chapter = makeChapter({
      content: makeDoc('Local changed text'),
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
    expect(conflict!.localContent).toEqual(makeDoc('Local changed text'));
    expect(conflict!.remoteContent).toBeDefined();
    expect(conflict!.baseContent).toEqual(baseContent);
    expect(conflict!.mergedContent).toEqual(makeDocFromLines([
      '<<<<<<< LOCAL',
      'Local changed text',
      '=======',
      'Remote changed text',
      '>>>>>>> REMOTE',
    ]));
    expect(conflict!.mergeConflictBlocks).toEqual([
      expect.objectContaining({
        baseStart: 0,
        baseEnd: 1,
        localLines: ['Local changed text'],
        remoteLines: ['Remote changed text'],
      }),
    ]);
    // Chapter update should keep base as sync content during conflict
    expect(chapterUpdate.sync?.lastSyncedContent).toEqual(baseContent);
  });

  it('does not duplicate paragraphs across repeated sync cycles', async () => {
    const baseContent = makeDocFromLines(['Intro', 'Body', 'Ending']);
    const chapter = makeChapter({
      content: makeDocFromLines(['Intro local', 'Body', 'Ending']),
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
    expect(first.chapterUpdate.content).toEqual(makeDocFromLines(['Intro local', 'Body', 'Ending remote']));

    const second = await mergeChapterFromRemote({
      chapter: first.chapterUpdate,
      remoteDocument: makeRemote('Intro\nBody\nEnding remote', { updatedAt: 300 }),
      context: { provider: 'dropbox', remoteRevision: 'rev-3' },
    });

    expect(second.conflict).toBeUndefined();
    expect(second.chapterUpdate.content).toEqual(makeDocFromLines(['Intro', 'Body', 'Ending remote']));
  });

  it('updates title and order from remote when no conflict', async () => {
    const chapter = makeChapter({
      content: makeDoc('Base text'),
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: makeDoc('Base text'),
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
      content: makeDoc('Local content'),
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
      content: makeDoc('Base text'),
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: makeDoc('Base text'),
      },
    });

    const { chapterUpdate, conflict } = await mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote(''),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    // Remote changed (to empty), local unchanged -> accept remote
    expect(conflict).toBeUndefined();
    // Content should be the empty doc from remote
    expect(chapterUpdate.sync?.providerRevisionIds?.dropbox).toBe('rev-2');
  });

  it('preserves provider revision IDs from multiple providers', async () => {
    const chapter = makeChapter({
      content: makeDoc('Base text'),
      sync: {
        providerRevisionIds: { dropbox: 'dropbox-rev-1', 'google-drive': 'gdrive-rev-1' },
        lastSyncedContent: makeDoc('Base text'),
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
      content: makeDoc('Base text'),
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: makeDoc('Base text'),
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
    localContent: makeDoc('Local text'),
    remoteContent: makeDoc('Remote text'),
    baseContent: makeDoc('Base text'),
    mergedContent: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Local text' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Remote text' }] },
      ],
    },
    localUpdatedAt: 100,
    remoteUpdatedAt: 200,
    resolutionOptions: ['local', 'remote', 'merge'],
  };

  it('returns local content for local resolution', () => {
    const result = resolveSyncConflict(conflict, 'local');
    expect(result).toEqual(makeDoc('Local text'));
  });

  it('returns remote content for remote resolution', () => {
    const result = resolveSyncConflict(conflict, 'remote');
    expect(result).toEqual(makeDoc('Remote text'));
  });

  it('returns merged content for merge resolution', () => {
    const result = resolveSyncConflict(conflict, 'merge');
    expect(result).toEqual(conflict.mergedContent);
  });

  it('falls back to local when merge content is missing', () => {
    const conflictNoMerge: ConflictInfo = {
      ...conflict,
      mergedContent: undefined,
    };
    const result = resolveSyncConflict(conflictNoMerge, 'merge');
    expect(result).toEqual(makeDoc('Local text'));
  });
});

describe('buildPushSyncMetadata', () => {
  it('records lastPushedHash for the current content', async () => {
    const chapter = makeChapter({ content: makeDoc('Push me') });

    const meta = await buildPushSyncMetadata(chapter, 'dropbox', 'push-rev-1');

    expect(meta.providerRevisionIds.dropbox).toBe('push-rev-1');
    expect(meta.lastPushedHash).toBeDefined();
    expect(typeof meta.lastPushedHash).toBe('string');
    expect(meta.lastSyncedContent).toEqual(makeDoc('Push me'));
  });

  it('preserves existing provider revision IDs', async () => {
    const chapter = makeChapter({
      sync: {
        providerRevisionIds: { 'google-drive': 'gdrive-1' },
        lastSyncedContent: makeDoc('Base text'),
      },
    });

    const meta = await buildPushSyncMetadata(chapter, 'dropbox', 'push-rev-1');

    expect(meta.providerRevisionIds.dropbox).toBe('push-rev-1');
    expect(meta.providerRevisionIds['google-drive']).toBe('gdrive-1');
  });

  it('produces identical SHA-256 hashes for structurally equivalent docs', async () => {
    const chapterA = makeChapter({
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { align: 'left', id: 'p1' },
            content: [{ text: 'Equivalent', type: 'text' }],
          },
        ],
      },
    });

    const chapterB = makeChapter({
      content: {
        content: [
          {
            content: [{ type: 'text', text: 'Equivalent' }],
            attrs: { id: 'p1', align: 'left' },
            type: 'paragraph',
          },
        ],
        type: 'doc',
      },
    });

    const metaA = await buildPushSyncMetadata(chapterA, 'dropbox', 'push-rev-1');
    const metaB = await buildPushSyncMetadata(chapterB, 'dropbox', 'push-rev-1');

    expect(metaA.lastPushedHash).toEqual(metaB.lastPushedHash);
    expect(metaA.lastPushedHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe('canonical hash merge behavior', () => {
  it('treats key-order-only local differences as unchanged relative to base', async () => {
    const baseContent: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Base text' }] }],
    };
    const localEquivalentContent: JSONContent = {
      content: [{ content: [{ text: 'Base text', type: 'text' }], type: 'paragraph' }],
      type: 'doc',
    };

    const chapter = makeChapter({
      content: localEquivalentContent,
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
    expect(chapterUpdate.content).toEqual(baseContent);
  });

  it('clears legacy non-SHA lastPushedHash when metadata is carried forward', async () => {
    const chapter = makeChapter({
      content: makeDoc('Base text'),
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: makeDoc('Base text'),
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
        content: makeDoc('Hello world'),
      }),
      makeChapter({
        id: 'ch-2',
        title: 'Second Chapter',
        order: 1,
        content: makeDoc('Goodbye world'),
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

  it('handles chapters with empty doc content', () => {
    const chapters: Chapter[] = [
      makeChapter({ id: 'ch-1', content: makeEmptyDoc(), summary: '' }),
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
        content: makeDoc('Base text'),
        sync: {
          providerRevisionIds: { dropbox: 'rev-1' },
          lastSyncedContent: makeDoc('Base text'),
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
        content: makeDoc('Local edit'),
        sync: {
          providerRevisionIds: { dropbox: 'rev-1' },
          lastSyncedContent: makeDoc('Base text'),
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
        content: makeDoc('Base text'),
        sync: {
          providerRevisionIds: { dropbox: 'rev-1' },
          lastSyncedContent: makeDoc('Base text'),
        },
      }),
      makeChapter({
        id: 'ch-2',
        content: makeDoc('Local edit ch2'),
        order: 2,
        sync: {
          providerRevisionIds: { dropbox: 'rev-1' },
          lastSyncedContent: makeDoc('Base text ch2'),
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
