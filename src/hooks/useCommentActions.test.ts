import { afterEach, describe, expect, it, vi } from 'vitest';
import * as utils from '@/lib/utils';
import { createCommentThreadFromSelection } from './useCommentActions';

describe('createCommentThreadFromSelection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a thread with anchor metadata and trimmed comment text', () => {
    vi.spyOn(utils, 'generateId')
      .mockReturnValueOnce('thread-1')
      .mockReturnValueOnce('comment-1');

    const thread = createCommentThreadFromSelection({
      chapterId: 'chapter-123',
      from: 5,
      to: 11,
      selectedText: 'selected text',
      text: '  hello  ',
    });

    expect(thread.id).toBe('thread-1');
    expect(thread.chapterId).toBe('chapter-123');
    expect(thread.anchor).toEqual({
      from: 5,
      to: 11,
      length: 6,
      selectedText: 'selected text',
    });
    expect(thread.comments[0]).toMatchObject({
      id: 'comment-1',
      text: 'hello',
      author: 'Author',
    });
  });

  it('omits selectedText when empty', () => {
    vi.spyOn(utils, 'generateId')
      .mockReturnValueOnce('thread-2')
      .mockReturnValueOnce('comment-2');

    const thread = createCommentThreadFromSelection({
      chapterId: 'chapter-123',
      from: 10,
      to: 10,
      selectedText: '',
      text: 'note',
    });

    expect(thread.anchor.selectedText).toBeUndefined();
    expect(thread.anchor.length).toBe(0);
  });
});
