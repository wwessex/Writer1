import { useState, useCallback, useEffect, useMemo } from 'react';
import { useCurrentEditor } from '@tiptap/react';
import { Dialog, Button, Textarea, IconButton } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { formatDateTime, generateId } from '@/lib/utils';
import { getCommentThreads, saveAllCommentThreads, deleteCommentThread } from '@/lib/storage';
import type { Comment, CommentThread } from '@/types';
import styles from './Modals.module.css';

interface CommentModalProps {
  open: boolean;
  onClose: () => void;
}

type FilterMode = 'all' | 'open' | 'resolved';

export function CommentModal({ open, onClose }: CommentModalProps) {
  const { activeChapter, state } = useApp();
  const { editor } = useCurrentEditor();
  const sectionLabel = state.projectType === 'screenplay' ? 'scene' : 'chapter';

  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  useEffect(() => {
    if (!open || !activeChapter) return;
    setThreads(getCommentThreads(activeChapter.id));
    setNewCommentText('');
    setReplyText('');
    setReplyTargetId(null);
  }, [open, activeChapter]);

  const persistThreads = useCallback((updated: CommentThread[]) => {
    if (!activeChapter) return;
    setThreads(updated);
    saveAllCommentThreads(activeChapter.id, updated);
  }, [activeChapter]);

  const handleAddThread = useCallback(() => {
    if (!activeChapter || !editor || !newCommentText.trim()) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) return;

    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();
    const threadId = generateId();
    const now = Date.now();

    const created = editor.chain().focus().setCommentAnchor({ threadId, state: 'open' }).run();
    if (!created) return;

    const nextThread: CommentThread = {
      id: threadId,
      chapterId: activeChapter.id,
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
          text: newCommentText.trim(),
          author: 'Author',
          createdAt: now,
        }
      ],
    };

    persistThreads([nextThread, ...threads]);
    setNewCommentText('');
  }, [activeChapter, editor, newCommentText, persistThreads, threads]);

  const handleReply = useCallback((threadId: string) => {
    if (!replyText.trim()) return;
    const reply: Comment = {
      id: generateId(),
      text: replyText.trim(),
      author: 'Author',
      createdAt: Date.now(),
    };

    const updated = threads.map(thread =>
      thread.id === threadId
        ? { ...thread, comments: [...thread.comments, reply], updatedAt: Date.now() }
        : thread
    );

    persistThreads(updated);
    setReplyTargetId(null);
    setReplyText('');
  }, [persistThreads, replyText, threads]);

  const handleToggleResolved = useCallback((threadId: string) => {
    const target = threads.find(thread => thread.id === threadId);
    if (!target) return;
    const nextResolved = !target.resolved;

    const updated = threads.map(thread =>
      thread.id === threadId
        ? { ...thread, resolved: nextResolved, updatedAt: Date.now() }
        : thread
    );

    if (editor) {
      editor.commands.setCommentAnchorState({ threadId, state: nextResolved ? 'resolved' : 'open' });
    }

    persistThreads(updated);
  }, [editor, persistThreads, threads]);

  const handleDeleteThread = useCallback((threadId: string) => {
    if (!activeChapter) return;
    deleteCommentThread(activeChapter.id, threadId);
    setThreads(threads.filter(thread => thread.id !== threadId));
  }, [activeChapter, threads]);

  const handleJumpToAnchor = useCallback((threadId: string) => {
    if (!editor) return;
    editor.commands.scrollToCommentAnchor(threadId);
  }, [editor]);

  const filteredThreads = useMemo(() => {
    switch (filterMode) {
      case 'open':
        return threads.filter(thread => !thread.resolved);
      case 'resolved':
        return threads.filter(thread => thread.resolved);
      default:
        return threads;
    }
  }, [threads, filterMode]);

  const openCount = useMemo(() => threads.filter(thread => !thread.resolved).length, [threads]);
  const resolvedCount = useMemo(() => threads.filter(thread => thread.resolved).length, [threads]);

  if (!activeChapter) {
    return (
      <Dialog open={open} onClose={onClose} title="Comments" size="medium">
        <p className={styles.emptyMessage}>Select a {sectionLabel} to view comments</p>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Comments - ${activeChapter.title}`} size="medium">
      <div className={styles.commentLayout}>
        <div className={styles.commentForm}>
          <Textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add a comment for current selection..."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleAddThread();
              }
            }}
          />
          <div className={styles.commentForm__actions}>
            <span className={styles.commentForm__hint}>Select text first, then Ctrl+Enter to submit</span>
            <Button variant="primary" size="small" onClick={handleAddThread} disabled={!newCommentText.trim()}>
              <span className="material-symbols-rounded">add_comment</span>
              Add Comment
            </Button>
          </div>
        </div>

        <div className={styles.commentFilters}>
          <button className={`${styles.commentFilterBtn} ${filterMode === 'all' ? styles['commentFilterBtn--active'] : ''}`} onClick={() => setFilterMode('all')}>
            All ({threads.length})
          </button>
          <button className={`${styles.commentFilterBtn} ${filterMode === 'open' ? styles['commentFilterBtn--active'] : ''}`} onClick={() => setFilterMode('open')}>
            Open ({openCount})
          </button>
          <button className={`${styles.commentFilterBtn} ${filterMode === 'resolved' ? styles['commentFilterBtn--active'] : ''}`} onClick={() => setFilterMode('resolved')}>
            Resolved ({resolvedCount})
          </button>
        </div>

        <div className={styles.commentList}>
          {filteredThreads.length === 0 && (
            <p className={styles.emptyMessage}>
              {threads.length === 0
                ? `No comments yet. Select text and add one above to annotate this ${sectionLabel}.`
                : 'No comments match the current filter.'}
            </p>
          )}

          {filteredThreads.map((thread) => {
            const rootComment = thread.comments[0];
            return (
              <div key={thread.id} className={`${styles.commentItem} ${thread.resolved ? styles['commentItem--resolved'] : ''}`}>
                <div className={styles.commentItem__header}>
                  <div className={styles.commentItem__meta}>
                    <span className={styles.commentItem__author}>{rootComment?.author || 'Author'}</span>
                    <span className={styles.commentItem__date}>{formatDateTime(thread.createdAt)}</span>
                  </div>
                  <div className={styles.commentItem__actions}>
                    <IconButton
                      icon="pin_drop"
                      label="Jump to anchor"
                      variant="ghost"
                      onClick={() => handleJumpToAnchor(thread.id)}
                    />
                    <IconButton
                      icon={thread.resolved ? 'undo' : 'check_circle'}
                      label={thread.resolved ? 'Reopen thread' : 'Resolve thread'}
                      variant="ghost"
                      onClick={() => handleToggleResolved(thread.id)}
                    />
                    <IconButton
                      icon="delete"
                      label="Delete thread"
                      variant="ghost"
                      onClick={() => handleDeleteThread(thread.id)}
                    />
                  </div>
                </div>

                {thread.anchor.selectedText && (
                  <p className={styles.commentItem__text}><strong>Anchor:</strong> “{thread.anchor.selectedText}”</p>
                )}
                <p className={styles.commentItem__text}>{rootComment?.text}</p>

                {thread.resolved && <span className={styles.commentItem__badge}>Resolved</span>}

                {thread.comments.length > 1 && (
                  <div className={styles.commentReplies}>
                    {thread.comments.slice(1).map((reply) => (
                      <div key={reply.id} className={styles.commentReply}>
                        <div className={styles.commentReply__meta}>
                          <span className={styles.commentReply__author}>{reply.author}</span>
                          <span className={styles.commentReply__date}>{formatDateTime(reply.createdAt)}</span>
                        </div>
                        <p className={styles.commentReply__text}>{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {replyTargetId === thread.id ? (
                  <div className={styles.commentReplyForm}>
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      rows={2}
                    />
                    <div className={styles.commentReplyForm__actions}>
                      <Button variant="ghost" size="small" onClick={() => { setReplyTargetId(null); setReplyText(''); }}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="small" onClick={() => handleReply(thread.id)} disabled={!replyText.trim()}>
                        Reply
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button className={styles.commentReplyTrigger} onClick={() => setReplyTargetId(thread.id)}>
                    <span className="material-symbols-rounded">reply</span>
                    Reply
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
