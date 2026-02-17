import { useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { upsertCommentThread } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import type { Chapter, CommentThread } from '@/types';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;

interface UseCommentActionsParams {
  editor: Editor | null;
  activeChapter: Chapter | null | undefined;
  openModal: (id: 'comments') => void;
  showToast: ToastFn;
}

interface CommentThreadParams {
  chapterId: string;
  from: number;
  to: number;
  selectedText: string;
  text: string;
}

export function createCommentThreadFromSelection({ chapterId, from, to, selectedText, text }: CommentThreadParams): CommentThread {
  const threadId = generateId();
  const now = Date.now();

  return {
    id: threadId,
    chapterId,
    anchor: {
      from,
      to,
      length: Math.max(to - from, 0),
      selectedText: selectedText || undefined,
    },
    resolved: false,
    createdAt: now,
    updatedAt: now,
    comments: [
      {
        id: generateId(),
        text: text.trim(),
        author: 'Author',
        createdAt: now,
      }
    ],
  };
}

export function useCommentActions({ editor, activeChapter, openModal, showToast }: UseCommentActionsParams) {
  const createCommentFromSelection = useCallback(() => {
    if (!editor || !activeChapter) {
      showToast('Select a chapter and text to add a comment', 'warning');
      return;
    }

    const { from, to, empty } = editor.state.selection;
    if (empty) {
      showToast('Select text to anchor a comment', 'warning');
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();
    const text = window.prompt('Comment for selected text:');
    if (!text || !text.trim()) return;

    const thread = createCommentThreadFromSelection({
      chapterId: activeChapter.id,
      from,
      to,
      selectedText,
      text,
    });

    const marked = editor.chain().focus().setCommentAnchor({ threadId: thread.id, state: 'open' }).run();
    if (!marked) {
      showToast('Unable to create comment on current selection', 'error');
      return;
    }

    upsertCommentThread(thread);
    openModal('comments');
    showToast('Comment added', 'success', 'add_comment');
  }, [activeChapter, editor, openModal, showToast]);

  return {
    createCommentFromSelection,
  };
}
