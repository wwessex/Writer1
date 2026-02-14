import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { IconButton, Button } from '@/components/UI';
import { countWords, editorToPlainText, formatRelativeTime } from '@/lib/utils';
import styles from './ChapterList.module.css';

const ITEM_HEIGHT = 60;
const OVERSCAN = 5;

interface DragState {
  dragging: boolean;
  draggedId: string | null;
  dropTargetId: string | null;
  dropPosition: 'above' | 'below' | null;
}

/**
 * Virtualized chapter list for large novel projects.
 * Only renders visible chapters plus a small overscan buffer.
 * Falls back to regular rendering if fewer than 30 chapters.
 */
export function VirtualChapterList() {
  const { state, dispatch, setActiveChapter, createChapter, reorderChapters } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(300);
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [dragState, setDragState] = useState<DragState>({
    dragging: false,
    draggedId: null,
    dropTargetId: null,
    dropPosition: null
  });

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  // Calculate visible range
  const totalHeight = state.chapters.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    state.chapters.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
  );
  const visibleChapters = useMemo(
    () => state.chapters.slice(startIndex, endIndex),
    [state.chapters, startIndex, endIndex]
  );

  // If fewer than 30 chapters, don't virtualize (regular list is fine)
  const shouldVirtualize = state.chapters.length >= 30;

  const handleChapterSelect = useCallback((id: string) => {
    setActiveChapter(id);
    if (window.matchMedia('(max-width: 820px)').matches && !state.settings.sidebarHidden) {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
    }
  }, [setActiveChapter, dispatch, state.settings.sidebarHidden]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragState({ dragging: true, draggedId: id, dropTargetId: null, dropPosition: null });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';
    setDragState(prev => ({ ...prev, dropTargetId: id, dropPosition: position }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({ dragging: false, draggedId: null, dropTargetId: null, dropPosition: null });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');

    if (draggedId && draggedId !== targetId) {
      const chapters = [...state.chapters];
      const draggedIndex = chapters.findIndex(ch => ch.id === draggedId);
      const targetIndex = chapters.findIndex(ch => ch.id === targetId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [dragged] = chapters.splice(draggedIndex, 1);
        chapters.splice(targetIndex, 0, dragged);
        reorderChapters(chapters.map(ch => ch.id));

        setJustMovedId(draggedId);
        clearTimeout(animRef.current);
        animRef.current = setTimeout(() => setJustMovedId(null), 300);
      }
    }

    setDragState({ dragging: false, draggedId: null, dropTargetId: null, dropPosition: null });
  }, [state.chapters, reorderChapters]);

  const renderChapterItem = (chapter: typeof state.chapters[0], index: number) => {
    const wordCount = countWords(editorToPlainText(chapter.content));
    const isActive = chapter.id === state.activeChapterId;
    const isDragging = dragState.draggedId === chapter.id;
    const isDropTarget = dragState.dropTargetId === chapter.id && dragState.draggedId !== chapter.id;
    const isJustMoved = justMovedId === chapter.id;
    const goalPercent = chapter.wordGoal > 0 ? Math.min(100, Math.round((wordCount / chapter.wordGoal) * 100)) : -1;

    const itemClasses = [
      styles.chapterItem,
      isActive && styles['chapterItem--active'],
      isDragging && styles['chapterItem--dragging'],
      isDropTarget && styles['chapterItem--dropTarget'],
      isDropTarget && dragState.dropPosition === 'above' && styles['chapterItem--dropAbove'],
      isDropTarget && dragState.dropPosition === 'below' && styles['chapterItem--dropBelow'],
      isJustMoved && styles['chapterItem--justMoved'],
    ].filter(Boolean).join(' ');

    return (
      <div
        key={chapter.id}
        className={itemClasses}
        style={shouldVirtualize ? {
          position: 'absolute',
          top: `${index * ITEM_HEIGHT}px`,
          left: 0,
          right: 0,
          height: `${ITEM_HEIGHT}px`
        } : undefined}
        draggable
        onDragStart={e => handleDragStart(e, chapter.id)}
        onDragOver={e => handleDragOver(e, chapter.id)}
        onDragEnd={handleDragEnd}
        onDrop={e => handleDrop(e, chapter.id)}
        onClick={() => handleChapterSelect(chapter.id)}
        role="option"
        aria-selected={isActive}
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleChapterSelect(chapter.id); } }}
      >
        <span className={styles.chapterItem__number}>{index + 1}</span>
        <div className={styles.chapterItem__content}>
          <span className={styles.chapterItem__title}>{chapter.title}</span>
          <span className={styles.chapterItem__meta}>
            <span className={styles.chapterItem__words}>{wordCount.toLocaleString()} words</span>
            {chapter.status !== 'planned' && (
              <span className={`${styles.chapterItem__status} ${styles[`chapterItem__status--${chapter.status}`]}`}>
                {chapter.status}
              </span>
            )}
            <span className={styles.chapterItem__time}>{formatRelativeTime(chapter.updatedAt)}</span>
          </span>
          {goalPercent >= 0 && (
            <div className={styles.chapterItem__progress}>
              <div className={styles.chapterItem__progressFill} style={{ width: `${goalPercent}%` }} />
            </div>
          )}
        </div>
        <span className={styles.chapterItem__drag}>
          <span className="material-symbols-rounded">drag_indicator</span>
        </span>
      </div>
    );
  };

  return (
    <section className={styles.chapterList} role="navigation" aria-label="Chapters">
      <div className={styles.chapterList__header}>
        <h3 className={styles.chapterList__title}>
          Chapters
          {state.chapters.length > 0 && ` (${state.chapters.length})`}
        </h3>
        <IconButton
          icon="add"
          label="New Chapter"
          variant="ghost"
          onClick={createChapter}
        />
      </div>

      {shouldVirtualize ? (
        <div
          ref={containerRef}
          className={styles.chapterList__items}
          role="listbox"
          aria-label="Chapter list"
          onScroll={handleScroll}
          style={{ position: 'relative', overflow: 'auto' }}
        >
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {visibleChapters.map((chapter, i) =>
              renderChapterItem(chapter, startIndex + i)
            )}
          </div>
        </div>
      ) : (
        <div className={styles.chapterList__items} role="listbox" aria-label="Chapter list">
          {state.chapters.map((chapter, index) => renderChapterItem(chapter, index))}
        </div>
      )}

      {state.chapters.length === 0 && (
        <div className={styles.chapterList__empty}>
          <p>No chapters yet</p>
          <Button variant="primary" onClick={createChapter}>
            Create First Chapter
          </Button>
        </div>
      )}
    </section>
  );
}
