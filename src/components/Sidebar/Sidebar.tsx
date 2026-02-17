import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import type { ProjectType, SidebarPanelId } from '@/types';
import { VirtualChapterList } from './VirtualChapterList';
import { OutlinePanel } from './OutlinePanel';
import { ScenePlanner } from './ScenePlanner';
import { Button, IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { useResizable } from '@/hooks/useResizable';
import { useModalAccessibility } from '@/hooks/useModalAccessibility';
import styles from './Sidebar.module.css';

interface SidebarProps {
  onExportBackup: () => void;
  onImportBackup: () => void;
}

interface SidebarPanelDefinition {
  id: SidebarPanelId;
  title: string;
  collapsible: boolean;
  render: () => ReactNode;
}

const FALLBACK_PANEL_ORDER: Record<ProjectType, SidebarPanelId[]> = {
  book: ['chapters', 'scenePlanner', 'outline'],
  screenplay: ['chapters', 'outline', 'scenePlanner']
};

export function Sidebar({ onExportBackup, onImportBackup }: SidebarProps) {
  const { state, dispatch, undoReorder, canUndoReorder, updateSettings } = useApp();
  const isHidden = state.settings.sidebarHidden;
  const sidebarPanels = state.settings.sidebarPanels;

  const sidebarRef = useRef<HTMLElement | null>(null);

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

  const isMobileDialogOpen = isMobile && !isHidden;

  useModalAccessibility({
    enabled: isMobileDialogOpen,
    onRequestClose: closeSidebar,
    containerRef: sidebarRef,
  });

  const panelDefinitions: SidebarPanelDefinition[] = useMemo(() => [
    {
      id: 'chapters',
      title: 'Chapters',
      collapsible: false,
      render: () => (
        <>
          <VirtualChapterList />
          {canUndoReorder && (
            <div className={styles.sidebar__undoBar}>
              <Button variant="ghost" size="small" onClick={undoReorder}>
                <span className="material-symbols-rounded">undo</span>
                Undo Reorder
              </Button>
            </div>
          )}
        </>
      )
    },
    {
      id: 'scenePlanner',
      title: state.projectType === 'screenplay' ? 'Scene Planner' : 'Scenes',
      collapsible: true,
      render: () => <ScenePlanner />
    },
    {
      id: 'outline',
      title: state.projectType === 'screenplay' ? 'Outline' : 'Chapter Outline',
      collapsible: true,
      render: () => <OutlinePanel />
    }
  ], [canUndoReorder, undoReorder, state.projectType]);

  const panelOrder = sidebarPanels.order && sidebarPanels.order.length > 0
    ? sidebarPanels.order
    : FALLBACK_PANEL_ORDER[state.projectType];

  const sidebarClass = `${styles.sidebar} ${isHidden ? styles['sidebar--hidden'] : ''}`;
  const backdropClass = `${styles.backdrop} ${isHidden ? styles['backdrop--hidden'] : styles['backdrop--visible']}`;

  const togglePanelCollapsed = (panelId: SidebarPanelId) => {
    updateSettings({
      sidebarPanels: {
        ...sidebarPanels,
        collapsed: {
          ...sidebarPanels.collapsed,
          [panelId]: !sidebarPanels.collapsed?.[panelId]
        }
      }
    });
  };

  return (
    <>
      <div className={backdropClass} onClick={closeSidebar} aria-hidden="true" />
      <aside
        ref={sidebarRef}
        className={sidebarClass}
        role={isMobileDialogOpen ? 'dialog' : 'complementary'}
        aria-modal={isMobileDialogOpen ? 'true' : undefined}
        aria-label="Sidebar"
        tabIndex={isMobileDialogOpen ? -1 : undefined}
        style={!isMobile && !isHidden ? { width: size } : undefined}
      >
        <h2 className="sr-only">Sidebar</h2>
        {isMobileDialogOpen && (
          <div className={styles.sidebar__collapseBar}>
            <Tooltip content="Close sidebar" position="right">
              <IconButton
                icon="close"
                label="Close sidebar"
                variant="ghost"
                onClick={closeSidebar}
                className={styles.collapseBtn}
              />
            </Tooltip>
          </div>
        )}
        {!isMobile && !isHidden && (
          <div className={styles.sidebar__collapseBar}>
            <Tooltip content="Collapse sidebar (Ctrl+Shift+B)" position="right">
              <IconButton
                icon="chevron_left"
                label="Collapse sidebar (Ctrl+Shift+B)"
                variant="ghost"
                onClick={closeSidebar}
                className={styles.collapseBtn}
              />
            </Tooltip>
          </div>
        )}
        <div className={styles.sidebar__content}>
          {panelOrder.map(panelId => {
            const panel = panelDefinitions.find(def => def.id === panelId);
            if (!panel) return null;

            if (sidebarPanels.visible?.[panel.id] === false) {
              return null;
            }

            const isCollapsed = Boolean(sidebarPanels.collapsed?.[panel.id]);

            if (!panel.collapsible) {
              return <div key={panel.id}>{panel.render()}</div>;
            }

            return (
              <section key={panel.id} className={styles.panelSection}>
                <Tooltip content={isCollapsed ? `Show ${panel.title}` : `Hide ${panel.title}`} position="right">
                  <button
                    type="button"
                    className={styles.panelSection__header}
                    aria-expanded={!isCollapsed}
                    aria-controls={`sidebar-panel-${panel.id}`}
                    onClick={() => togglePanelCollapsed(panel.id)}
                  >
                    <span>{panel.title}</span>
                    <span className="material-symbols-rounded" aria-hidden="true">
                      {isCollapsed ? 'expand_more' : 'expand_less'}
                    </span>
                  </button>
                </Tooltip>
                {!isCollapsed && <div id={`sidebar-panel-${panel.id}`}>{panel.render()}</div>}
              </section>
            );
          })}
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
