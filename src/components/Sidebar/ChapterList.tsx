import { useState, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { IconButton, Button } from '@/components/UI';
import { countWords, editorToPlainText, formatRelativeTime } from '@/lib/utils';
import styles from './ChapterList.module.css';

interface DragState {
  dragging: boolean;
  draggedId: string | null;
  dropTargetId: string | null;
}

export function ChapterList() {
  const { state, dispatch, setActiveChapter, createChapter, reorderChapters } = useApp();
  const [dragState, setDragState] = useState<DragState>({
    dragging: false,
    draggedId: null,
    dropTargetId: null
  });

  const handleChapterSelect = useCallback((id: string) => {
    setActiveChapter(id);
    if (window.matchMedia('(max-width: 820px)').matches && !state.settings.sidebarHidden) {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
    }
  }, [setActiveChapter, dispatch, state.settings.sidebarHidden]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragState({ dragging: true, draggedId: id, dropTargetId: null });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState(prev => ({ ...prev, dropTargetId: id }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({ dragging: false, draggedId: null, dropTargetId: null });
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
      }
    }

    setDragState({ dragging: false, draggedId: null, dropTargetId: null });
  }, [state.chapters, reorderChapters]);

  return (
    <section className={styles.chapterList} role="navigation" aria-label="Chapters">
      <div className={styles.chapterList__header}>
        <h3 className={styles.chapterList__title}>Chapters</h3>
        <IconButton
          icon="add"
          label="New Chapter"
          variant="ghost"
          onClick={createChapter}
        />
      </div>
      <div className={styles.chapterList__items} role="listbox" aria-label="Chapter list">
        {state.chapters.map((chapter, index) => {
          const wordCount = countWords(editorToPlainText(chapter.content));
          const isActive = chapter.id === state.activeChapterId;
          const isDragging = dragState.draggedId === chapter.id;
          const isDropTarget = dragState.dropTargetId === chapter.id;
          const goalPercent = chapter.wordGoal > 0 ? Math.min(100, Math.round((wordCount / chapter.wordGoal) * 100)) : -1;

          return (
            <div
              key={chapter.id}
              className={`${styles.chapterItem} ${isActive ? styles['chapterItem--active'] : ''} ${isDragging ? styles['chapterItem--dragging'] : ''} ${isDropTarget ? styles['chapterItem--dropTarget'] : ''}`}
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
        })}
      </div>
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
