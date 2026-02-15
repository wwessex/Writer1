import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useWindowResize } from '@/hooks/useResizable';
import styles from './Windows.module.css';

interface AboutWindowProps {
  open: boolean;
  onClose: () => void;
}

export function AboutWindow({ open, onClose }: AboutWindowProps) {
  const { state } = useApp();
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const { width, height, startResize, reset: resetSize } = useWindowResize({
    initialWidth: 400,
    initialHeight: 480,
    minWidth: 300,
    maxWidth: 600,
    minHeight: 300,
    maxHeight: 700,
    disabled: isMobile,
  });

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 820);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Reset position when reopened
  useEffect(() => {
    if (open && windowRef.current) {
      windowRef.current.style.left = '';
      windowRef.current.style.top = '';
      windowRef.current.style.transform = '';
      resetSize();
    }
  }, [open, resetSize]);

  // Handle drag (desktop only)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    if ((e.target as HTMLElement).closest(`.${styles.resizeHandle}`) || (e.target as HTMLElement).closest(`.${styles.resizeCorner}`)) return;
    if ((e.target as HTMLElement).closest(`.${styles.window__header}`)) {
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  }, [isMobile]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (windowRef.current) {
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        windowRef.current.style.left = `${x}px`;
        windowRef.current.style.top = `${y}px`;
        windowRef.current.style.transform = 'none';
      }
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!open) return null;

  return (
    <>
      <div
        className={`${styles.backdrop} ${styles['backdrop--visible']}`}
        onClick={onClose}
      />
      <div
        ref={windowRef}
        className={styles.window}
        onMouseDown={handleMouseDown}
        style={!isMobile ? { width, height } : undefined}
      >
        <div className={styles.window__header}>
          <h3>About DraftHarbour Studio</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className={styles.window__body}>
          <div className={styles.aboutLogo}>
            <img
              src={`${import.meta.env.BASE_URL}assets/${state.settings.theme === 'light' ? 'logo-black' : 'logo-blue'}.png`}
              alt="DraftHarbour Studio"
              className={styles.brandLogo}
            />
            <p className={styles.version}>Version 2.0.0</p>
          </div>

          <p className={styles.aboutDescription}>
            A lightweight, offline-first Progressive Web Application for writing novels.
            All your data is stored locally in your browser.
          </p>

          <h4>Features</h4>
          <ul className={styles.featureList}>
            <li>
              <span className="material-symbols-rounded">edit_note</span>
              Rich text editing with formatting
            </li>
            <li>
              <span className="material-symbols-rounded">folder</span>
              Chapter management with drag-to-reorder
            </li>
            <li>
              <span className="material-symbols-rounded">history</span>
              Snapshot version history
            </li>
            <li>
              <span className="material-symbols-rounded">analytics</span>
              Writing analysis and readability scores
            </li>
            <li>
              <span className="material-symbols-rounded">download</span>
              Export to DOCX, PDF, RTF
            </li>
            <li>
              <span className="material-symbols-rounded">upload</span>
              Import from DOCX, RTF
            </li>
            <li>
              <span className="material-symbols-rounded">cloud_off</span>
              Works completely offline
            </li>
            <li>
              <span className="material-symbols-rounded">dark_mode</span>
              Warm light, true dark, and high-contrast themes
            </li>
          </ul>

          <p className={styles.aboutCredits}>
            Built with React, TypeScript, and Tiptap.
          </p>
        </div>
        {!isMobile && (
          <>
            <div className={`${styles.resizeHandle} ${styles['resizeHandle--right']}`} onMouseDown={startResize('right')} />
            <div className={`${styles.resizeHandle} ${styles['resizeHandle--bottom']}`} onMouseDown={startResize('bottom')} />
            <div className={styles.resizeCorner} onMouseDown={startResize('bottom-right')} />
          </>
        )}
      </div>
    </>
  );
}
