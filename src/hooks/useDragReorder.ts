import { useState, useCallback, useRef } from 'react';

interface DragState {
  dragging: boolean;
  draggedId: string | null;
  dropTargetId: string | null;
  dropPosition: 'above' | 'below' | null;
}

const INITIAL_DRAG_STATE: DragState = {
  dragging: false,
  draggedId: null,
  dropTargetId: null,
  dropPosition: null,
};

interface UseDragReorderOptions {
  items: { id: string }[];
  onReorder: (ids: string[]) => void;
  trackDropPosition?: boolean;
}

export function useDragReorder({ items, onReorder, trackDropPosition = false }: UseDragReorderOptions) {
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE);
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragState({ dragging: true, draggedId: id, dropTargetId: null, dropPosition: null });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (trackDropPosition) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'above' : 'below';
      setDragState(prev => ({ ...prev, dropTargetId: id, dropPosition: position }));
    } else {
      setDragState(prev => ({ ...prev, dropTargetId: id }));
    }
  }, [trackDropPosition]);

  const handleDragEnd = useCallback(() => {
    setDragState(INITIAL_DRAG_STATE);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');

    if (draggedId && draggedId !== targetId) {
      const itemsCopy = [...items];
      const draggedIndex = itemsCopy.findIndex(item => item.id === draggedId);
      const targetIndex = itemsCopy.findIndex(item => item.id === targetId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const [dragged] = itemsCopy.splice(draggedIndex, 1);
        const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
        const insertIndex = trackDropPosition && dragState.dropPosition === 'below'
          ? adjustedTargetIndex + 1
          : adjustedTargetIndex;
        itemsCopy.splice(insertIndex, 0, dragged);
        onReorder(itemsCopy.map(item => item.id));

        setJustMovedId(draggedId);
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = setTimeout(() => setJustMovedId(null), 300);
      }
    }

    setDragState(INITIAL_DRAG_STATE);
  }, [items, onReorder, trackDropPosition, dragState.dropPosition]);

  return { dragState, justMovedId, handleDragStart, handleDragOver, handleDragEnd, handleDrop };
}
