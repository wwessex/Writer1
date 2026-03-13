import type { CommentThread } from '@/types';
import { COMMENT_THREADS_STORAGE_PREFIX } from '@/lib/storageKeys';

export function getCommentThreads(chapterId: string): CommentThread[] {
  try {
    const raw = localStorage.getItem(`${COMMENT_THREADS_STORAGE_PREFIX}${chapterId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCommentThreads(chapterId: string, threads: CommentThread[]): void {
  localStorage.setItem(`${COMMENT_THREADS_STORAGE_PREFIX}${chapterId}`, JSON.stringify(threads));
}

export function getCommentThreadsForChapters(chapterIds: string[]): CommentThread[] {
  return chapterIds.flatMap(chapterId => getCommentThreads(chapterId));
}

export function upsertCommentThread(thread: CommentThread): void {
  const threads = getCommentThreads(thread.chapterId);
  const index = threads.findIndex(item => item.id === thread.id);
  if (index >= 0) {
    threads[index] = thread;
  } else {
    threads.unshift(thread);
  }
  saveCommentThreads(thread.chapterId, threads);
}

export function saveAllCommentThreads(chapterId: string, threads: CommentThread[]): void {
  saveCommentThreads(chapterId, threads);
}

export function deleteCommentThread(chapterId: string, threadId: string): void {
  const threads = getCommentThreads(chapterId).filter(thread => thread.id !== threadId);
  saveCommentThreads(chapterId, threads);
}
