import { useApp } from '@/context/AppContext';
import { ChapterList } from './ChapterList';
import { OutlinePanel } from './OutlinePanel';
import { Button } from '@/components/UI';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onExportBackup: () => void;
  onImportBackup: () => void;
}

export function Sidebar({ onExportBackup, onImportBackup }: SidebarProps) {
  const { state } = useApp();

  if (state.settings.sidebarHidden) {
    return null;
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebar__content}>
        <ChapterList />
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
  );
}
