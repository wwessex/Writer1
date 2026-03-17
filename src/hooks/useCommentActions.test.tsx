/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import * as utils from '@/lib/utils';
import { createCommentThreadFromSelection, useCommentActions } from './useCommentActions';

vi.mock('@/lib/storage', () => ({
  upsertCommentThread: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('useCommentActions hook', () => {
  let showToast: ReturnType<typeof vi.fn>;
  let openModal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    showToast = vi.fn();
    openModal = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mountHook(editor: unknown, activeChapter: unknown) {
    const container = document.createElement('div');
    const root = createRoot(container);
    let result: ReturnType<typeof useCommentActions> | null = null;

    function Test() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = useCommentActions({ editor: editor as any, activeChapter: activeChapter as any, openModal, showToast });
      return null;
    }

    act(() => { root.render(<Test />); });
    return { get result() { return result!; }, unmount: () => act(() => root.unmount()) };
  }

  it('shows warning when no editor', () => {
    const h = mountHook(null, null);
    act(() => h.result.createCommentFromSelection());
    expect(showToast).toHaveBeenCalledWith('Select a chapter and text to add a comment', 'warning');
    h.unmount();
  });

  it('shows warning when no active chapter', () => {
    const editor = { getSelection: vi.fn() };
    const h = mountHook(editor, null);
    act(() => h.result.createCommentFromSelection());
    expect(showToast).toHaveBeenCalledWith('Select a chapter and text to add a comment', 'warning');
    h.unmount();
  });

  it('shows warning when selection is empty', () => {
    const editor = { getSelection: vi.fn(() => ({ from: 0, to: 0, empty: true })) };
    const chapter = { id: 'ch-1' };
    const h = mountHook(editor, chapter);
    act(() => h.result.createCommentFromSelection());
    expect(showToast).toHaveBeenCalledWith('Select text to anchor a comment', 'warning');
    h.unmount();
  });

  it('creates comment when selection exists and user provides text', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('My comment');
    vi.spyOn(utils, 'generateId').mockReturnValue('test-id');
    const editor = {
      getSelection: vi.fn(() => ({ from: 0, to: 5, empty: false })),
      getSelectedText: vi.fn(() => 'Hello'),
      setCommentAnchor: vi.fn(),
    };
    const chapter = { id: 'ch-1' };
    const h = mountHook(editor, chapter);
    act(() => h.result.createCommentFromSelection());
    expect(editor.setCommentAnchor).toHaveBeenCalled();
    expect(openModal).toHaveBeenCalledWith('comments');
    expect(showToast).toHaveBeenCalledWith('Comment added', 'success', 'add_comment');
    h.unmount();
  });

  it('does nothing when user cancels prompt', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    const editor = {
      getSelection: vi.fn(() => ({ from: 0, to: 5, empty: false })),
      getSelectedText: vi.fn(() => 'Hello'),
      setCommentAnchor: vi.fn(),
    };
    const chapter = { id: 'ch-1' };
    const h = mountHook(editor, chapter);
    act(() => h.result.createCommentFromSelection());
    expect(editor.setCommentAnchor).not.toHaveBeenCalled();
    h.unmount();
  });
});
