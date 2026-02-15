import { describe, expect, it } from 'vitest';
import type { Chapter } from '@/types';
import { normalizeProviderPullResponse } from './orchestration';

function chapterFixture(): Chapter {
  return {
    id: 'ch-1',
    novelId: 'novel-1',
    order: 0,
    title: 'Chapter 1',
    updatedAt: Date.now(),
    content: null,
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
  };
}

describe('normalizeProviderPullResponse', () => {
  it('maps remote document body to chapter content', () => {
    const base = chapterFixture();
    const result = normalizeProviderPullResponse(
      [base],
      [{ id: 'ch-1', title: 'Remote', order: 0, updatedAt: 123, body: 'Line one\nLine two' }],
      'rev-1'
    );

    expect(result.chapterUpdates[0].summary).toBe('Line one\nLine two');
    expect(result.chapterUpdates[0].content).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Line one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Line two' }] },
      ],
    });
  });

  it('uses local chapter context for novel id on unmatched remote chapters', () => {
    const base = chapterFixture();
    const result = normalizeProviderPullResponse(
      [base],
      [{ id: 'new-id', title: 'Remote New', order: 1, updatedAt: 321, body: 'Remote text' }],
      'rev-2'
    );

    expect(result.chapterUpdates[0].novelId).toBe('novel-1');
    expect(result.chapterUpdates[0].content).not.toBeNull();
  });
});
