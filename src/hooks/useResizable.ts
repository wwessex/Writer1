import { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  useResizable – single-axis resize for sidebar / inspector panels  */
/* ------------------------------------------------------------------ */

interface UseResizableOptions {
  /** Default width/height in px */
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  /**
   * Which edge the handle sits on.
   * "right" → dragging right makes the panel wider  (sidebar)
   * "left"  → dragging left  makes the panel wider  (inspector)
   */
  direction: 'left' | 'right';
  /** localStorage key – if set the size is persisted across sessions */
  persistKey?: string;
  /** Disable resize (e.g. on mobile) */
  disabled?: boolean;
}

export function useResizable({
  initialSize,
  minSize = 180,
  maxSize = 600,
  direction,
  persistKey,
  disabled = false,
}: UseResizableOptions) {
  const [size, setSize] = useState(() => {
    if (persistKey) {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n)) return Math.min(maxSize, Math.max(minSize, n));
      }
    }
    return initialSize;
  });

  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef(0);
  const startSize = useRef(0);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const inverted = direction === 'left';

  /* pointer handlers attached to document while dragging */
  useEffect(() => {
    if (!isResizing) return;

    const onMove = (clientX: number) => {
      const delta = clientX - startPos.current;
      const adjusted = inverted ? -delta : delta;
      setSize(Math.min(maxSize, Math.max(minSize, startSize.current + adjusted)));
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      onMove(e.clientX);
    };
    const onTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientX);
    const onEnd = () => setIsResizing(false);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onEnd);

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, inverted, minSize, maxSize]);

  /* persist on resize end */
  useEffect(() => {
    if (!isResizing && persistKey) {
      localStorage.setItem(persistKey, String(sizeRef.current));
    }
  }, [isResizing, persistKey]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      startPos.current = e.clientX;
      startSize.current = sizeRef.current;
      setIsResizing(true);
    },
    [disabled],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      startPos.current = e.touches[0].clientX;
      startSize.current = sizeRef.current;
      setIsResizing(true);
    },
    [disabled],
  );

  return { size, isResizing, handleProps: { onMouseDown, onTouchStart } };
}

/* ------------------------------------------------------------------ */
/*  useWindowResize – 2-axis resize for floating windows / dialogs    */
/* ------------------------------------------------------------------ */

type Edge = 'right' | 'bottom' | 'bottom-right';

interface UseWindowResizeOptions {
  initialWidth: number;
  initialHeight: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  disabled?: boolean;
}

export function useWindowResize({
  initialWidth,
  initialHeight,
  minWidth = 300,
  maxWidth = 1200,
  minHeight = 200,
  maxHeight = 900,
  disabled = false,
}: UseWindowResizeOptions) {
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const edgeRef = useRef<Edge>('bottom-right');
  const startPos = useRef({ x: 0, y: 0 });
  const startDims = useRef({ w: initialWidth, h: initialHeight });
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  widthRef.current = width;
  heightRef.current = height;

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (cx: number, cy: number) => {
      const dx = cx - startPos.current.x;
      const dy = cy - startPos.current.y;
      const edge = edgeRef.current;

      if (edge === 'right' || edge === 'bottom-right') {
        setWidth(Math.min(maxWidth, Math.max(minWidth, startDims.current.w + dx)));
      }
      if (edge === 'bottom' || edge === 'bottom-right') {
        setHeight(Math.min(maxHeight, Math.max(minHeight, startDims.current.h + dy)));
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      onMove(e.clientX, e.clientY);
    };
    const onTouchMove = (e: TouchEvent) =>
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    const onEnd = () => setIsResizing(false);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onEnd);

    const edge = edgeRef.current;
    document.body.style.userSelect = 'none';
    document.body.style.cursor =
      edge === 'right' ? 'ew-resize' : edge === 'bottom' ? 'ns-resize' : 'nwse-resize';

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, minWidth, maxWidth, minHeight, maxHeight]);

  const startResize = useCallback(
    (edge: Edge) => (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      edgeRef.current = edge;
      startPos.current = { x: e.clientX, y: e.clientY };
      startDims.current = { w: widthRef.current, h: heightRef.current };
      setIsResizing(true);
    },
    [disabled],
  );

  const reset = useCallback(() => {
    setWidth(initialWidth);
    setHeight(initialHeight);
  }, [initialWidth, initialHeight]);

  return { width, height, isResizing, startResize, reset };
}
