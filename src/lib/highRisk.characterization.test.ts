import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Chapter } from '@/types';
import { screenplayChapterToFountain } from './export';
import { importFountain } from './import';
import { mergeChapterFromRemote } from './integrations/sync';

function fixture(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('high-risk module characterization snapshots', () => {
  it('keeps screenplay fountain formatting stable for reference fixture', () => {
    const chapter = JSON.parse(fixture('src/lib/fixtures/export/chapter-screenplay.json')) as Chapter;
    expect(screenplayChapterToFountain(chapter)).toMatchSnapshot();
  });

  it('keeps fountain import parsing structure stable for partial-support fixture', async () => {
    const file = new File([fixture('src/lib/fixtures/import/sample-partial-support.fountain')], 'sample-partial-support.fountain', { type: 'text/plain' });
    const result = await importFountain(file);
    expect(result).toMatchSnapshot();
  });

  it('keeps sync conflict payload shape stable when local and remote diverge', () => {
    const chapter: Chapter = {
      id: 'chapter-1',
      novelId: 'novel-1',
      order: 1,
      title: 'Chapter 1',
      updatedAt: 10,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local' }] }] },
      summary: 'Local',
      pov: '',
      status: 'draft',
      tags: [],
      wordGoal: 0,
      scenes: [],
      sync: {
        providerRevisionIds: { dropbox: 'rev-1' },
        lastSyncedContent: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Base' }] }] },
      },
    };

    const output = mergeChapterFromRemote({
      chapter,
      remoteDocument: { id: 'remote-1', title: 'Remote Chapter', body: 'Remote', order: 4, updatedAt: 20 },
      context: { provider: 'dropbox', remoteRevision: 'rev-2' },
    });

    expect(output.conflict).toMatchSnapshot();
  });
});
