/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act, createElement } from 'react';
import * as utils from '@/lib/utils';
import { createCommentThreadFromSelection, useCommentActions } from './useCommentActions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/storage', () => ({
  upsertCommentThread: vi.fn(),
}));

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

  it('sets resolved to false by default', () => {
    vi.spyOn(utils, 'generateId')
      .mockReturnValueOnce('thread-3')
      .mockReturnValueOnce('comment-3');

    const thread = createCommentThreadFromSelection({
      chapterId: 'ch1',
      from: 0,
      to: 5,
      selectedText: 'text',
      text: 'comment',
    });

    expect(thread.resolved).toBe(false);
  });

  it('sets createdAt and updatedAt to the same value', () => {
    vi.spyOn(utils, 'generateId')
      .mockReturnValueOnce('thread-4')
      .mockReturnValueOnce('comment-4');

    const thread = createCommentThreadFromSelection({
      chapterId: 'ch1',
      from: 0,
      to: 5,
      selectedText: 'text',
      text: 'comment',
    });

    expect(thread.createdAt).toBe(thread.updatedAt);
    expect(typeof thread.createdAt).toBe('number');
  });

  it('creates exactly one comment in the thread', () => {
    vi.spyOn(utils, 'generateId')
      .mockReturnValueOnce('thread-5')
      .mockReturnValueOnce('comment-5');

    const thread = createCommentThreadFromSelection({
      chapterId: 'ch1',
      from: 0,
      to: 10,
      selectedText: 'some text',
      text: 'my note',
    });

    expect(thread.comments).toHaveLength(1);
    expect(thread.comments[0].text).toBe('my note');
    expect(thread.comments[0].author).toBe('Author');
  });

  it('handles negative range by clamping length to 0', () => {
    vi.spyOn(utils, 'generateId')
      .mockReturnValueOnce('thread-6')
      .mockReturnValueOnce('comment-6');

    const thread = createCommentThreadFromSelection({
      chapterId: 'ch1',
      from: 10,
      to: 5,
      selectedText: '',
      text: 'note',
    });

    expect(thread.anchor.length).toBe(0);
  });
});

describe('useCommentActions hook', () => {
  let container: HTMLDivElement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let showToast: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let openModal: any;
  let hookResult: { createCommentFromSelection: () => void };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    showToast = vi.fn();
    openModal = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function TestComponent({ editor, activeChapter }: { editor: unknown; activeChapter: unknown }) {
    const result = useCommentActions({
      editor: editor as never,
      activeChapter: activeChapter as never,
      openModal,
      showToast,
    });
    hookResult = result;
    return createElement('div', { 'data-testid': 'hook' });
  }

  it('returns createCommentFromSelection function', () => {
    act(() => {
      createRoot(container).render(createElement(TestComponent, { editor: null, activeChapter: null }));
    });
    expect(typeof hookResult.createCommentFromSelection).toBe('function');
  });

  it('shows warning toast when editor is null', () => {
    act(() => {
      createRoot(container).render(createElement(TestComponent, { editor: null, activeChapter: null }));
    });
    act(() => {
      hookResult.createCommentFromSelection();
    });
    expect(showToast).toHaveBeenCalledWith('Select a chapter and text to add a comment', 'warning');
  });

  it('shows warning toast when activeChapter is null', () => {
    const mockEditor = { getSelection: vi.fn() };
    act(() => {
      createRoot(container).render(createElement(TestComponent, { editor: mockEditor, activeChapter: null }));
    });
    act(() => {
      hookResult.createCommentFromSelection();
    });
    expect(showToast).toHaveBeenCalledWith('Select a chapter and text to add a comment', 'warning');
  });

  it('shows warning toast when selection is empty', () => {
    const mockEditor = {
      getSelection: vi.fn(() => ({ from: 5, to: 5, empty: true })),
      getSelectedText: vi.fn(() => ''),
    };
    const activeChapter = { id: 'ch1', title: 'Ch 1' };

    act(() => {
      createRoot(container).render(createElement(TestComponent, { editor: mockEditor, activeChapter }));
    });
    act(() => {
      hookResult.createCommentFromSelection();
    });
    expect(showToast).toHaveBeenCalledWith('Select text to anchor a comment', 'warning');
  });

  it('does nothing when prompt returns null', () => {
    const mockEditor = {
      getSelection: vi.fn(() => ({ from: 0, to: 5, empty: false })),
      getSelectedText: vi.fn(() => 'hello'),
      setCommentAnchor: vi.fn(),
    };
    const activeChapter = { id: 'ch1', title: 'Ch 1' };
    vi.spyOn(window, 'prompt').mockReturnValue(null);

    act(() => {
      createRoot(container).render(createElement(TestComponent, { editor: mockEditor, activeChapter }));
    });
    act(() => {
      hookResult.createCommentFromSelection();
    });
    expect(mockEditor.setCommentAnchor).not.toHaveBeenCalled();
    expect(openModal).not.toHaveBeenCalled();
  });

  it('does nothing when prompt returns empty string', () => {
    const mockEditor = {
      getSelection: vi.fn(() => ({ from: 0, to: 5, empty: false })),
      getSelectedText: vi.fn(() => 'hello'),
      setCommentAnchor: vi.fn(),
    };
    const activeChapter = { id: 'ch1', title: 'Ch 1' };
    vi.spyOn(window, 'prompt').mockReturnValue('   ');

    act(() => {
      createRoot(container).render(createElement(TestComponent, { editor: mockEditor, activeChapter }));
    });
    act(() => {
      hookResult.createCommentFromSelection();
    });
    expect(mockEditor.setCommentAnchor).not.toHaveBeenCalled();
    expect(openModal).not.toHaveBeenCalled();
  });

  it('creates comment thread and opens modal when all inputs valid', async () => {
    const mockEditor = {
      getSelection: vi.fn(() => ({ from: 0, to: 5, empty: false })),
      getSelectedText: vi.fn(() => 'hello'),
      setCommentAnchor: vi.fn(),
    };
    const activeChapter = { id: 'ch1', title: 'Ch 1' };
    vi.spyOn(window, 'prompt').mockReturnValue('My comment');
    vi.spyOn(utils, 'generateId')
      .mockReturnValueOnce('t-id')
      .mockReturnValueOnce('c-id');

    const storage = await import('@/lib/storage');
    const upsertCommentThread = storage.upsertCommentThread as ReturnType<typeof vi.fn>;

    act(() => {
      createRoot(container).render(createElement(TestComponent, { editor: mockEditor, activeChapter }));
    });
    act(() => {
      hookResult.createCommentFromSelection();
    });

    expect(mockEditor.setCommentAnchor).toHaveBeenCalledWith('t-id', 0, 5, 'open');
    expect(upsertCommentThread).toHaveBeenCalled();
    expect(openModal).toHaveBeenCalledWith('comments');
    expect(showToast).toHaveBeenCalledWith('Comment added', 'success', 'add_comment');
  });
});
