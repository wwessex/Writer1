import { useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { IconButton, Button } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { countWords, editorToPlainText, formatRelativeTime } from '@/lib/utils';
import { useDragReorder } from '@/hooks/useDragReorder';
import { isMobileViewport } from '@/hooks/useIsMobile';
import styles from './ChapterList.module.css';

export function ChapterList() {
  const { state, dispatch, setActiveChapter, createChapter, reorderChapters } = useApp();
  const { dragState, justMovedId, handleDragStart, handleDragOver, handleDragEnd, handleDrop } = useDragReorder({
    items: state.chapters,
    onReorder: reorderChapters,
    trackDropPosition: true,
  });

  const handleChapterSelect = useCallback((id: string) => {
    setActiveChapter(id);
    if (isMobileViewport() && !state.settings.sidebarHidden) {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
    }
  }, [setActiveChapter, dispatch, state.settings.sidebarHidden]);

  return (
    <section className={styles.chapterList} role="navigation" aria-label={state.projectType === 'screenplay' ? 'Scenes' : 'Chapters'}>
      <div className={styles.chapterList__header}>
        <h3 className={styles.chapterList__title}>{state.projectType === 'screenplay' ? 'Scenes' : 'Chapters'}</h3>
        <Tooltip content={state.projectType === 'screenplay' ? 'Create a new scene' : 'Create a new chapter'} position="bottom">
          <IconButton
            icon="add"
            label={state.projectType === 'screenplay' ? 'New Scene' : 'New Chapter'}
            variant="ghost"
            onClick={createChapter}
          />
        </Tooltip>
      </div>
      <div className={styles.chapterList__items} role="listbox" aria-label={state.projectType === 'screenplay' ? 'Scene list' : 'Chapter list'}>
        {state.chapters.map((chapter, index) => {
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
                  {state.projectType === 'screenplay' ? (
                    <span>Act {chapter.act || Math.max(1, Math.ceil((index + 1) / 12))} · Seq {chapter.sequence || Math.max(1, Math.ceil((index + 1) / 4))} · Scene {index + 1}</span>
                  ) : (
                    <span className={styles.chapterItem__words}>{wordCount.toLocaleString()} words</span>
                  )}
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
        })}
      </div>
      {state.chapters.length === 0 && (
        <div className={styles.chapterList__empty}>
          <p>No {state.projectType === 'screenplay' ? 'scenes' : 'chapters'} yet</p>
          <Button variant="primary" onClick={createChapter}>
            Create First {state.projectType === 'screenplay' ? 'Scene' : 'Chapter'}
          </Button>
        </div>
      )}
    </section>
  );
}
