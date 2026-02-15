import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { VirtualChapterList } from './VirtualChapterList';
import { OutlinePanel } from './OutlinePanel';
import { ScenePlanner } from './ScenePlanner';
import { Button } from '@/components/UI';
import { useResizable } from '@/hooks/useResizable';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onExportBackup: () => void;
  onImportBackup: () => void;
}

export function Sidebar({ onExportBackup, onImportBackup }: SidebarProps) {
  const { state, dispatch, undoReorder, canUndoReorder } = useApp();
  const isHidden = state.settings.sidebarHidden;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 820);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { size, isResizing, handleProps } = useResizable({
    initialSize: 280,
    minSize: 200,
    maxSize: 480,
    direction: 'right',
    persistKey: 'dh-sidebar-width',
    disabled: isMobile,
  });

  const closeSidebar = () => {
    if (!isHidden) {
      dispatch({ type: 'TOGGLE_SIDEBAR' });
    }
  };

  const sidebarClass = `${styles.sidebar} ${isHidden ? styles['sidebar--hidden'] : ''}`;
  const backdropClass = `${styles.backdrop} ${isHidden ? styles['backdrop--hidden'] : styles['backdrop--visible']}`;

  return (
    <>
      <div className={backdropClass} onClick={closeSidebar} aria-hidden="true" />
      <aside
        className={sidebarClass}
        style={!isMobile && !isHidden ? { width: size } : undefined}
      >
        <div className={styles.sidebar__content}>
          <VirtualChapterList />
          {canUndoReorder && (
            <div className={styles.sidebar__undoBar}>
              <Button variant="ghost" size="small" onClick={undoReorder}>
                <span className="material-symbols-rounded">undo</span>
                Undo Reorder
              </Button>
            </div>
          )}
          {state.projectType === 'screenplay' ? (
            <>
              <OutlinePanel />
              <ScenePlanner />
            </>
          ) : (
            <>
              <ScenePlanner />
              <OutlinePanel />
            </>
          )}
        </div>
        <div className={styles.sidebar__footer}>
          <Button variant="ghost" onClick={onExportBackup}>
            <span className="material-symbols-rounded">download</span>
            Export Backup
          </Button>
          <Button variant="ghost" onClick={onImportBackup}>
            <span className="material-symbols-rounded">upload</span>
            Import Backup
          </Button>
        </div>
        {!isMobile && !isHidden && (
          <div
            className={`${styles.resizeHandle} ${isResizing ? styles['resizeHandle--active'] : ''}`}
            {...handleProps}
          />
        )}
      </aside>
    </>
  );
}
