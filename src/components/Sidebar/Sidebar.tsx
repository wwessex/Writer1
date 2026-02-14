import { useApp } from '@/context/AppContext';
import { VirtualChapterList } from './VirtualChapterList';
import { OutlinePanel } from './OutlinePanel';
import { ScenePlanner } from './ScenePlanner';
import { Button } from '@/components/UI';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onExportBackup: () => void;
  onImportBackup: () => void;
}

export function Sidebar({ onExportBackup, onImportBackup }: SidebarProps) {
  const { state, dispatch, undoReorder, canUndoReorder } = useApp();
  const isHidden = state.settings.sidebarHidden;

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
      <aside className={sidebarClass}>
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
          <ScenePlanner />
          <OutlinePanel />
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
      </aside>
    </>
  );
}
