import { useMemo, useState, useCallback } from 'react';
import { Search, FilePlus, FolderPlus, FileDown, ChevronRight, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { countWords, editorToPlainText } from '@/lib/utils';
import { getProjectMetrics } from '@/lib/projectMetrics';
import { SidebarSection } from './SidebarSection';
import { TreeRow } from './TreeRow';
import type { Chapter } from '@/types';

interface LeftSidebarProps {
  collapsed?: boolean;
  width?: number;
  resizeHandleProps?: { onMouseDown: (e: React.MouseEvent) => void; onTouchStart: (e: React.TouchEvent) => void };
  isResizing?: boolean;
  onCreateChapter?: () => void;
  onImport?: () => void;
}

function formatWordCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

function getChapterWordCount(chapter: Chapter): number {
  if (!chapter.content) return 0;
  return countWords(editorToPlainText(chapter.content));
}

export function LeftSidebar({ collapsed = false, width = 280, resizeHandleProps, isResizing, onCreateChapter, onImport }: LeftSidebarProps) {
  const { state, setActiveChapter, createChapter } = useApp();
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const projectMetrics = useMemo(() => getProjectMetrics(state.chapters), [state.chapters]);

  const sortedChapters = useMemo(
    () => [...state.chapters].sort((a, b) => a.order - b.order),
    [state.chapters],
  );

  const filteredChapters = useMemo(() => {
    if (!searchQuery.trim()) return sortedChapters;
    const q = searchQuery.toLowerCase();
    return sortedChapters.filter(
      (ch) =>
        ch.title.toLowerCase().includes(q) ||
        ch.scenes.some((s) => s.title.toLowerCase().includes(q)),
    );
  }, [sortedChapters, searchQuery]);

  const toggleExpand = useCallback((chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  const handleCreateChapter = useCallback(() => {
    if (onCreateChapter) {
      onCreateChapter();
    } else {
      void createChapter();
    }
  }, [onCreateChapter, createChapter]);

  const isBookProject = state.projectType === 'book';
  const chapterLabel = isBookProject ? 'Chapters' : 'Scenes';

  if (collapsed) {
    return (
      <aside className="w-[60px] border-r border-[var(--border)] bg-[var(--panel)] min-h-0 flex flex-col items-center py-3 gap-2 transition-all duration-200 ease-[var(--ease-smooth)]">
        <button
          className="h-9 w-9 rounded-xl hover:bg-[var(--btn-bg)] flex items-center justify-center text-[var(--text-secondary)] transition-colors group relative"
          aria-label="New document"
          onClick={handleCreateChapter}
          title="New document"
        >
          <FilePlus size={16} />
        </button>
        <button
          className="h-9 w-9 rounded-xl hover:bg-[var(--btn-bg)] flex items-center justify-center text-[var(--text-secondary)] transition-colors group relative"
          aria-label="Search"
          title="Search"
        >
          <Search size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="relative border-r border-[var(--border)] bg-[var(--panel)] min-h-0 flex flex-col transition-[width] duration-200 ease-[var(--ease-smooth)]"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)] space-y-3">
        <button className="w-full h-12 rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] hover:bg-[var(--btn-hover)] px-3 text-left transition-colors">
          <div className="text-sm font-medium truncate">{state.novelTitle || 'Untitled Project'}</div>
          <div className="text-xs text-[var(--text-secondary)] truncate">
            {projectMetrics.totalWords.toLocaleString()} words &middot;{' '}
            {projectMetrics.totalChapters} {isBookProject ? 'chapters' : 'scenes'}
          </div>
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            className="h-9 rounded-lg bg-[var(--btn-bg)] hover:bg-[var(--btn-hover)] border border-[var(--border)] text-xs flex items-center justify-center gap-1.5 text-[var(--text-secondary)] transition-colors"
            onClick={handleCreateChapter}
          >
            <FilePlus size={13} />
            New
          </button>
          <button className="h-9 rounded-lg bg-[var(--btn-bg)] hover:bg-[var(--btn-hover)] border border-[var(--border)] text-xs flex items-center justify-center gap-1.5 text-[var(--text-secondary)] transition-colors">
            <FolderPlus size={13} />
            Folder
          </button>
          <button
            className="h-9 rounded-lg bg-[var(--btn-bg)] hover:bg-[var(--btn-hover)] border border-[var(--border)] text-xs flex items-center justify-center gap-1.5 text-[var(--text-secondary)] transition-colors"
            onClick={onImport}
          >
            <FileDown size={13} />
            Import
          </button>
        </div>

        <div className="relative">
          <input
            className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/60 focus:border-[var(--accent)]/40 transition-shadow"
            placeholder="Search in project"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <SidebarSection title={chapterLabel}>
          {filteredChapters.map((chapter) => {
            const isActive = chapter.id === state.activeChapterId;
            const hasScenes = chapter.scenes.length > 0;
            const isExpanded = expandedChapters.has(chapter.id) || isActive;
            const wc = getChapterWordCount(chapter);

            return (
              <div key={chapter.id}>
                <TreeRow
                  active={isActive}
                  icon={
                    hasScenes
                      ? isExpanded
                        ? <ChevronDown size={12} />
                        : <ChevronRight size={12} />
                      : undefined
                  }
                  title={chapter.title || 'Untitled'}
                  meta={formatWordCount(wc)}
                  onClick={() => setActiveChapter(chapter.id)}
                  onIconClick={hasScenes ? () => toggleExpand(chapter.id) : undefined}
                />
                {hasScenes && isExpanded &&
                  chapter.scenes.map((scene) => (
                    <TreeRow
                      key={scene.id}
                      level={1}
                      title={scene.title || 'Untitled Scene'}
                      meta={scene.wordGoal > 0 ? formatWordCount(scene.wordGoal) : undefined}
                    />
                  ))}
              </div>
            );
          })}
        </SidebarSection>

        {filteredChapters.length === 0 && searchQuery && (
          <div className="px-2 py-4 text-sm text-[var(--text-muted)] text-center">
            No results for &ldquo;{searchQuery}&rdquo;
          </div>
        )}

        {state.chapters.length === 0 && !searchQuery && (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-[var(--text-muted)] mb-3">No chapters yet</p>
            <button
              className="h-9 rounded-lg border border-[var(--accent-subtle)] bg-[var(--accent-alpha)] text-[var(--accent)] text-sm px-4 hover:bg-[var(--accent-subtle)] transition-colors"
              onClick={handleCreateChapter}
            >
              Create first chapter
            </button>
          </div>
        )}
      </div>

      {/* Resize handle */}
      {resizeHandleProps && (
        <div
          className={[
            'resize-handle resize-handle--right',
            isResizing ? 'resize-handle--active' : '',
          ].join(' ')}
          onMouseDown={resizeHandleProps.onMouseDown}
          onTouchStart={resizeHandleProps.onTouchStart}
        />
      )}
    </aside>
  );
}
