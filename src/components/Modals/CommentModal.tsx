import { useState, useCallback, useEffect, useMemo } from 'react';
import { Dialog, Button, Textarea, IconButton } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { formatDateTime } from '@/lib/utils';
import type { Comment, CommentReply } from '@/types';
import styles from './Modals.module.css';

interface CommentModalProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_PREFIX = 'novelwriter_comments_';

function loadComments(chapterId: string): Comment[] {
  try {
    const data = localStorage.getItem(`${STORAGE_PREFIX}${chapterId}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveComments(chapterId: string, comments: Comment[]) {
  localStorage.setItem(`${STORAGE_PREFIX}${chapterId}`, JSON.stringify(comments));
}

type FilterMode = 'all' | 'open' | 'resolved';

export function CommentModal({ open, onClose }: CommentModalProps) {
  const { activeChapter, state } = useApp();
  const sectionLabel = state.projectType === 'screenplay' ? 'scene' : 'chapter';

  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Load comments when modal opens or active chapter changes
  useEffect(() => {
    if (open && activeChapter) {
      setComments(loadComments(activeChapter.id));
      setNewCommentText('');
      setReplyTargetId(null);
      setReplyText('');
    }
  }, [open, activeChapter]);

  const persistComments = useCallback(
    (updated: Comment[]) => {
      if (!activeChapter) return;
      setComments(updated);
      saveComments(activeChapter.id, updated);
    },
    [activeChapter]
  );

  const handleAddComment = useCallback(() => {
    if (!activeChapter || !newCommentText.trim()) return;

    const comment: Comment = {
      id: crypto.randomUUID(),
      chapterId: activeChapter.id,
      anchorOffset: 0,
      anchorLength: 0,
      text: newCommentText.trim(),
      author: 'Author',
      resolved: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      replies: [],
    };

    persistComments([comment, ...comments]);
    setNewCommentText('');
  }, [activeChapter, newCommentText, comments, persistComments]);

  const handleReply = useCallback(
    (commentId: string) => {
      if (!replyText.trim()) return;

      const reply: CommentReply = {
        id: crypto.randomUUID(),
        text: replyText.trim(),
        author: 'Author',
        createdAt: Date.now(),
      };

      const updated = comments.map((c) =>
        c.id === commentId
          ? { ...c, replies: [...c.replies, reply], updatedAt: Date.now() }
          : c
      );

      persistComments(updated);
      setReplyTargetId(null);
      setReplyText('');
    },
    [replyText, comments, persistComments]
  );

  const handleToggleResolved = useCallback(
    (commentId: string) => {
      const updated = comments.map((c) =>
        c.id === commentId
          ? { ...c, resolved: !c.resolved, updatedAt: Date.now() }
          : c
      );
      persistComments(updated);
    },
    [comments, persistComments]
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      persistComments(comments.filter((c) => c.id !== commentId));
    },
    [comments, persistComments]
  );

  const filteredComments = useMemo(() => {
    switch (filterMode) {
      case 'open':
        return comments.filter((c) => !c.resolved);
      case 'resolved':
        return comments.filter((c) => c.resolved);
      default:
        return comments;
    }
  }, [comments, filterMode]);

  const openCount = useMemo(
    () => comments.filter((c) => !c.resolved).length,
    [comments]
  );

  const resolvedCount = useMemo(
    () => comments.filter((c) => c.resolved).length,
    [comments]
  );

  if (!activeChapter) {
    return (
      <Dialog open={open} onClose={onClose} title="Comments" size="medium">
        <p className={styles.emptyMessage}>Select a {sectionLabel} to view comments</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Comments - ${activeChapter.title}`}
      size="medium"
    >
      <div className={styles.commentLayout}>
        {/* New comment form */}
        <div className={styles.commentForm}>
          <Textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleAddComment();
              }
            }}
          />
          <div className={styles.commentForm__actions}>
            <span className={styles.commentForm__hint}>Ctrl+Enter to submit</span>
            <Button
              variant="primary"
              size="small"
              onClick={handleAddComment}
              disabled={!newCommentText.trim()}
            >
              <span className="material-symbols-rounded">add_comment</span>
              Add Comment
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className={styles.commentFilters}>
          <button
            className={`${styles.commentFilterBtn} ${filterMode === 'all' ? styles['commentFilterBtn--active'] : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All ({comments.length})
          </button>
          <button
            className={`${styles.commentFilterBtn} ${filterMode === 'open' ? styles['commentFilterBtn--active'] : ''}`}
            onClick={() => setFilterMode('open')}
          >
            Open ({openCount})
          </button>
          <button
            className={`${styles.commentFilterBtn} ${filterMode === 'resolved' ? styles['commentFilterBtn--active'] : ''}`}
            onClick={() => setFilterMode('resolved')}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        {/* Comment list */}
        <div className={styles.commentList}>
          {filteredComments.length === 0 && (
            <p className={styles.emptyMessage}>
              {comments.length === 0
                ? `No comments yet. Add one above to start annotating this ${sectionLabel}.`
                : 'No comments match the current filter.'}
            </p>
          )}

          {filteredComments.map((comment) => (
            <div
              key={comment.id}
              className={`${styles.commentItem} ${comment.resolved ? styles['commentItem--resolved'] : ''}`}
            >
              <div className={styles.commentItem__header}>
                <div className={styles.commentItem__meta}>
                  <span className={styles.commentItem__author}>{comment.author}</span>
                  <span className={styles.commentItem__date}>
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <div className={styles.commentItem__actions}>
                  <IconButton
                    icon={comment.resolved ? 'undo' : 'check_circle'}
                    label={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
                    variant="ghost"
                    onClick={() => handleToggleResolved(comment.id)}
                  />
                  <IconButton
                    icon="delete"
                    label="Delete comment"
                    variant="ghost"
                    onClick={() => handleDeleteComment(comment.id)}
                  />
                </div>
              </div>

              <p className={styles.commentItem__text}>{comment.text}</p>

              {comment.resolved && (
                <span className={styles.commentItem__badge}>Resolved</span>
              )}

              {/* Replies */}
              {comment.replies.length > 0 && (
                <div className={styles.commentReplies}>
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className={styles.commentReply}>
                      <div className={styles.commentReply__meta}>
                        <span className={styles.commentReply__author}>{reply.author}</span>
                        <span className={styles.commentReply__date}>
                          {formatDateTime(reply.createdAt)}
                        </span>
                      </div>
                      <p className={styles.commentReply__text}>{reply.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              {replyTargetId === comment.id ? (
                <div className={styles.commentReplyForm}>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleReply(comment.id);
                      }
                    }}
                  />
                  <div className={styles.commentReplyForm__actions}>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => {
                        setReplyTargetId(null);
                        setReplyText('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => handleReply(comment.id)}
                      disabled={!replyText.trim()}
                    >
                      Reply
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  className={styles.commentReplyTrigger}
                  onClick={() => {
                    setReplyTargetId(comment.id);
                    setReplyText('');
                  }}
                >
                  <span className="material-symbols-rounded">reply</span>
                  Reply
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
