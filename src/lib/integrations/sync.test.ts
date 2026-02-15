import type { Chapter } from '@/types';
import type { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { mergeChapterFromRemote } from './sync';
import type { ProviderDocument } from './types';

function makeDoc(text: string): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
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

function makeRemote(body: string): ProviderDocument {
  return {
    id: 'remote-1',
    title: 'Remote Title',
    body,
    order: 1,
    updatedAt: 200,
  };
}

describe('mergeChapterFromRemote', () => {
  it('keeps lastSyncedContent at base when only local content changed', () => {
    const baseContent = makeDoc('Base text');
    const chapter = makeChapter({
      content: makeDoc('Local draft change'),
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: baseContent,
      },
    });

    const { chapterUpdate, conflict } = mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Base text'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeUndefined();
    expect(chapterUpdate.content).toEqual(makeDoc('Local draft change'));
    expect(chapterUpdate.sync?.lastSyncedContent).toEqual(baseContent);
  });

  it('updates lastSyncedContent when remote content is accepted', () => {
    const chapter = makeChapter({
      content: makeDoc('Base text'),
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: makeDoc('Base text'),
      },
    });

    const { chapterUpdate, conflict } = mergeChapterFromRemote({
      chapter,
      remoteDocument: makeRemote('Remote edit'),
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(conflict).toBeUndefined();
    expect(chapterUpdate.content).toEqual(makeDoc('Remote edit'));
    expect(chapterUpdate.sync?.lastSyncedContent).toEqual(makeDoc('Remote edit'));
  });
});
