import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { IconButton, Button } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import { countWords, editorToPlainText, formatRelativeTime } from '@/lib/utils';
import type { Chapter } from '@/types';
import styles from './ChapterList.module.css';

const ITEM_HEIGHT = 60;
const OVERSCAN = 5;

interface DragState {
  dragging: boolean;
  draggedId: string | null;
  dropTargetId: string | null;
  dropPosition: 'above' | 'below' | null;
}

interface PartGroup {
  part: string;
  chapters: Chapter[];
}

export function VirtualChapterList() {
  const { state, dispatch, setActiveChapter, createChapter, reorderChapters } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(300);
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'draft' | 'revised' | 'final'>('all');
  const [productionTagFilter, setProductionTagFilter] = useState('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [collapsedParts, setCollapsedParts] = useState<Set<string>>(new Set());

  const isScreenplay = state.projectType === 'screenplay';
  const sectionLabel = isScreenplay ? 'Scenes' : 'Chapters';
  const singularLabel = isScreenplay ? 'Scene' : 'Chapter';

  // Disable drag on touch/mobile devices to prevent interference with scroll
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const hasActiveFilters = statusFilter !== 'all' || productionTagFilter !== 'all';

  const [dragState, setDragState] = useState<DragState>({
    dragging: false,
    draggedId: null,
    dropTargetId: null,
    dropPosition: null
  });

  const filteredChapters = useMemo(() => {
    let chapters = state.chapters;

    if (statusFilter !== 'all') {
      if (isScreenplay) {
        chapters = chapters.filter(chapter => {
          const scenes = chapter.scenes || [];
          return scenes.some(scene => scene.status === statusFilter);
        });
      } else {
        chapters = chapters.filter(chapter => chapter.status === statusFilter);
      }
    }

    if (isScreenplay && productionTagFilter !== 'all') {
      chapters = chapters.filter(chapter => {
        const scenes = chapter.scenes || [];
        return scenes.some(scene => (scene.productionTags || []).includes(productionTagFilter));
      });
    }

    return chapters;
  }, [state.chapters, isScreenplay, statusFilter, productionTagFilter]);

  // Group chapters by part (books only)
  const partGroups = useMemo((): PartGroup[] => {
    if (isScreenplay) return [];
    const hasParts = filteredChapters.some(ch => ch.part);
    if (!hasParts) return [];

    const groups = new Map<string, Chapter[]>();
    for (const ch of filteredChapters) {
      const part = ch.part || '';
      if (!groups.has(part)) groups.set(part, []);
      groups.get(part)!.push(ch);
    }
    return Array.from(groups.entries()).map(([part, chapters]) => ({ part, chapters }));
  }, [filteredChapters, isScreenplay]);

  const hasParts = partGroups.length > 0;

  const togglePartCollapse = useCallback((part: string) => {
    setCollapsedParts(prev => {
      const next = new Set(prev);
      if (next.has(part)) next.delete(part);
      else next.add(part);
      return next;
    });
  }, []);

  const productionTags = useMemo(() => {
    const tags = new Set<string>();
    state.chapters.forEach(ch => (ch.scenes || []).forEach(scene => (scene.productionTags || []).forEach(tag => tags.add(tag))));
    return Array.from(tags).sort();
  }, [state.chapters]);

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

  const totalHeight = filteredChapters.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    filteredChapters.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
  );
  const visibleChapters = useMemo(
    () => filteredChapters.slice(startIndex, endIndex),
    [filteredChapters, startIndex, endIndex]
  );

  const shouldVirtualize = filteredChapters.length >= 30;

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
        const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
        const insertIndex = dragState.dropPosition === 'below' ? adjustedTargetIndex + 1 : adjustedTargetIndex;
        chapters.splice(insertIndex, 0, dragged);
        reorderChapters(chapters.map(ch => ch.id));

        setJustMovedId(draggedId);
        clearTimeout(animRef.current);
        animRef.current = setTimeout(() => setJustMovedId(null), 300);
      }
    }

    setDragState({ dragging: false, draggedId: null, dropTargetId: null, dropPosition: null });
  }, [state.chapters, reorderChapters, dragState.dropPosition]);

  const renderChapterItem = (chapter: Chapter, index: number, virtualStyle?: React.CSSProperties) => {
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

    const act = chapter.act || Math.max(1, Math.ceil((index + 1) / 12));
    const sequence = chapter.sequence || Math.max(1, Math.ceil((index + 1) / 4));

    return (
      <div
        key={chapter.id}
        className={itemClasses}
        style={virtualStyle}
        draggable={!isTouchDevice}
        onDragStart={!isTouchDevice ? (e => handleDragStart(e, chapter.id)) : undefined}
        onDragOver={!isTouchDevice ? (e => handleDragOver(e, chapter.id)) : undefined}
        onDragEnd={!isTouchDevice ? handleDragEnd : undefined}
        onDrop={!isTouchDevice ? (e => handleDrop(e, chapter.id)) : undefined}
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
            {isScreenplay ? (
              <>
                <span>Act {act}</span>
                <span>· Seq {sequence}</span>
                <span>· Scene {index + 1}</span>
              </>
            ) : (
              <span className={styles.chapterItem__words}>{wordCount.toLocaleString()} words</span>
            )}
            <span className={`${styles.chapterItem__status} ${styles[`chapterItem__status--${chapter.status}`]}`}>
              {chapter.status}
            </span>
            {chapter.tags.length > 0 && !isScreenplay && (
              <span className={styles.chapterItem__tags}>
                {chapter.tags.slice(0, 2).map(tag => (
                  <span key={tag} className={styles.chapterItem__tag}>{tag}</span>
                ))}
                {chapter.tags.length > 2 && <span className={styles.chapterItem__tag}>+{chapter.tags.length - 2}</span>}
              </span>
            )}
            <span className={styles.chapterItem__time}>{formatRelativeTime(chapter.updatedAt)}</span>
          </span>
          {goalPercent >= 0 && !isScreenplay && (
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

  const renderPartGroup = (group: PartGroup) => {
    const isCollapsed = collapsedParts.has(group.part);
    const partWordCount = group.chapters.reduce((sum, ch) => sum + countWords(editorToPlainText(ch.content)), 0);
    const partLabel = group.part || 'Ungrouped';

    return (
      <div key={group.part} className={styles.partGroup}>
        <button
          className={styles.partGroup__header}
          onClick={() => togglePartCollapse(group.part)}
          aria-expanded={!isCollapsed}
        >
          <span className={`material-symbols-rounded ${styles.partGroup__chevron} ${isCollapsed ? styles['partGroup__chevron--collapsed'] : ''}`}>
            expand_more
          </span>
          <span className={styles.partGroup__title}>{partLabel}</span>
          <span className={styles.partGroup__count}>
            {group.chapters.length} ch · {partWordCount.toLocaleString()}w
          </span>
        </button>
        {!isCollapsed && (
          <div className={styles.partGroup__chapters}>
            {group.chapters.map((chapter, index) => {
              const globalIndex = filteredChapters.indexOf(chapter);
              return renderChapterItem(chapter, globalIndex >= 0 ? globalIndex : index);
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className={styles.chapterList} role="navigation" aria-label={sectionLabel}>
      <div className={styles.chapterList__header}>
        <h3 className={styles.chapterList__title}>
          {sectionLabel}
          {filteredChapters.length > 0 && ` (${filteredChapters.length})`}
        </h3>
        <div className={styles.chapterList__actions}>
          <IconButton
            icon="filter_list"
            label="Toggle filters"
            variant="ghost"
            active={filtersExpanded || hasActiveFilters}
            onClick={() => setFiltersExpanded(prev => !prev)}
          />
          <IconButton
            icon="add"
            label={`New ${singularLabel}`}
            variant="ghost"
            onClick={createChapter}
          />
        </div>
      </div>

      {filtersExpanded && (
        <div className={styles.chapterList__filters}>
          <Select
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'planned', label: 'Planned' },
              { value: 'draft', label: 'Draft' },
              { value: 'revised', label: 'Revised' },
              { value: 'final', label: 'Final' },
            ]}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          />
          {isScreenplay && (
            <Select
              options={[
                { value: 'all', label: 'All production tags' },
                ...productionTags.map(tag => ({ value: tag, label: tag }))
              ]}
              value={productionTagFilter}
              onChange={e => setProductionTagFilter(e.target.value)}
            />
          )}
          {hasActiveFilters && (
            <button
              className={styles.chapterList__clearFilters}
              onClick={() => { setStatusFilter('all'); setProductionTagFilter('all'); }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {hasParts ? (
        <div className={styles.chapterList__items} role="listbox" aria-label={`${sectionLabel} list`}>
          {partGroups.map(group => renderPartGroup(group))}
        </div>
      ) : shouldVirtualize ? (
        <div
          ref={containerRef}
          className={styles.chapterList__items}
          role="listbox"
          aria-label={`${sectionLabel} list`}
          onScroll={handleScroll}
          style={{ position: 'relative', overflow: 'auto' }}
        >
          <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {visibleChapters.map((chapter, i) =>
              renderChapterItem(chapter, startIndex + i, {
                position: 'absolute',
                top: `${(startIndex + i) * ITEM_HEIGHT}px`,
                left: 0,
                right: 0,
                height: `${ITEM_HEIGHT}px`
              })
            )}
          </div>
        </div>
      ) : (
        <div className={styles.chapterList__items} role="listbox" aria-label={`${sectionLabel} list`}>
          {filteredChapters.map((chapter, index) => renderChapterItem(chapter, index))}
        </div>
      )}

      {filteredChapters.length === 0 && (
        <div className={styles.chapterList__empty}>
          <p>No {sectionLabel.toLowerCase()} yet</p>
          <Button variant="primary" onClick={createChapter}>
            Create First {singularLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
