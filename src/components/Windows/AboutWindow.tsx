import { useState, useRef, useEffect } from 'react';
import styles from './Windows.module.css';

interface AboutWindowProps {
  open: boolean;
  onClose: () => void;
}

export function AboutWindow({ open, onClose }: AboutWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(`.${styles.window__header}`)) {
      setIsDragging(true);
      const rect = windowRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  };

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
    <div
      ref={windowRef}
      className={styles.window}
      onMouseDown={handleMouseDown}
    >
      <div className={styles.window__header}>
        <h3>About NovelWriter</h3>
        <button className={styles.closeBtn} onClick={onClose}>
          <span className="material-symbols-rounded">close</span>
        </button>
      </div>

      <div className={styles.window__body}>
        <div className={styles.aboutLogo}>
          <span className={styles.logoIcon}>NW</span>
          <h2>NovelWriter</h2>
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
            Dark and light themes
          </li>
        </ul>

        <p className={styles.aboutCredits}>
          Built with React, TypeScript, and Tiptap.
        </p>
      </div>
    </div>
  );
}
