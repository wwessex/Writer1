import { useMemo, useCallback, type ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import { countWords, editorToPlainText } from '@/lib/utils';
import type { ChapterStatus } from '@/types';

interface EditorPaneProps {
  children?: ReactNode;
}

const STATUS_LABELS: Record<ChapterStatus, string> = {
  planned: 'Planned',
  draft: 'Draft',
  revised: 'Revised',
  final: 'Final',
};

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `Edited ${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Edited ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Edited ${days} day${days === 1 ? '' : 's'} ago`;
}

function estimateReadingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / 250));
  return `${minutes} min read`;
}

export function EditorPane({ children }: EditorPaneProps) {
  const { activeChapter, updateChapterImmediate } = useApp();

  const chapterText = useMemo(() => {
    if (!activeChapter?.content) return '';
    return editorToPlainText(activeChapter.content);
  }, [activeChapter?.content]);

  const wordCount = useMemo(() => countWords(chapterText), [chapterText]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (activeChapter) {
        void updateChapterImmediate(activeChapter.id, { title: e.target.value });
      }
    },
    [activeChapter, updateChapterImmediate],
  );

  if (!activeChapter) {
    return (
      <main className="flex-1 min-w-0 min-h-0 bg-[var(--bg)] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--text-muted)] animate-in fade-in">
          <span className="text-5xl opacity-25">&#9998;</span>
          <p className="text-sm">Select a chapter to start writing</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 min-h-0 bg-[var(--bg)] flex flex-col">
      {/* Document Header */}
      <div className="px-6 pt-5 pb-3 border-b border-[var(--border-subtle)] shrink-0">
        <input
          value={activeChapter.title}
          onChange={handleTitleChange}
          className="w-full bg-transparent text-2xl font-semibold leading-tight text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
          placeholder="Untitled document"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="h-6 px-2 rounded-md border border-[var(--border)] bg-[var(--btn-bg)] inline-flex items-center">
            {STATUS_LABELS[activeChapter.status]}
          </span>
          <span>{formatRelativeTime(activeChapter.updatedAt)}</span>
          <span className="text-[var(--border)]">&bull;</span>
          <span>{wordCount.toLocaleString()} words</span>
          <span className="text-[var(--border)]">&bull;</span>
          <span>{estimateReadingTime(wordCount)}</span>
        </div>
      </div>

      {/* Editor Scroll Region */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-6 pb-24">
          <div className="max-w-[720px] mx-auto pt-6">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
