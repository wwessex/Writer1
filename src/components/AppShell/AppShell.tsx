import type { Dispatch, SetStateAction } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Editor } from '@/components/Editor';
import { Inspector } from '@/components/Inspector';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { AISuggestionsPanel } from '@/components/Panels';
import { Tooltip } from '@/components/UI/Tooltip';
import type { VoiceSimilarityAlert } from '@/lib/voiceFingerprint';
import type { CommandId } from '@/lib/commands';
import type { AppState } from '@/types';
import styles from '@/App.module.css';

interface AppShellProps {
  appLabel: string;
  state: AppState;
  screenplayMode: boolean;
  onToggleScreenplayMode: () => void;
  onAction: (action: CommandId) => void;
  hasTextSelection: boolean;
  inspectorOpen: boolean;
  setInspectorOpen: Dispatch<SetStateAction<boolean>>;
  voiceAlerts: VoiceSimilarityAlert[];
  sidebarImportBackup: () => void;
  onExportBackup: () => void;
  onToggleSidebar: () => void;
  aiPanelOpen: boolean;
  closeAiPanel: () => void;
}

export function AppShell({
  appLabel,
  state,
  screenplayMode,
  onToggleScreenplayMode,
  onAction,
  hasTextSelection,
  inspectorOpen,
  setInspectorOpen,
  voiceAlerts,
  sidebarImportBackup,
  onExportBackup,
  onToggleSidebar,
  aiPanelOpen,
  closeAiPanel,
}: AppShellProps) {
  const layoutClass = [
    styles.layout,
    state.settings.sidebarHidden ? styles['layout--sidebarHidden'] : '',
    inspectorOpen ? styles['layout--inspectorOpen'] : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <Header
        onAction={onAction}
        onToggleInspector={() => setInspectorOpen(prev => !prev)}
        inspectorOpen={inspectorOpen}
        hasTextSelection={hasTextSelection}
      />
      <main className={layoutClass} role="main">
        {state.settings.sidebarHidden && (
          <Tooltip content="Expand sidebar (Ctrl+Shift+B)" position="right">
            <button
              className={styles.expandTab}
              onClick={onToggleSidebar}
              aria-label="Expand sidebar (Ctrl+Shift+B)"
              title="Expand sidebar"
            >
              <span className="material-symbols-rounded">chevron_right</span>
            </button>
          </Tooltip>
        )}
        <PanelErrorBoundary panel="sidebar">
          <Sidebar
            onExportBackup={onExportBackup}
            onImportBackup={sidebarImportBackup}
          />
        </PanelErrorBoundary>
        <PanelErrorBoundary panel="editor">
          <Editor screenplayMode={screenplayMode} onToggleScreenplayMode={onToggleScreenplayMode} />
        </PanelErrorBoundary>
        {!inspectorOpen && (
          <Tooltip content="Expand inspector (Ctrl+Shift+I)" position="left">
            <button
              className={`${styles.expandTab} ${styles['expandTab--right']}`}
              onClick={() => setInspectorOpen(true)}
              aria-label="Expand inspector (Ctrl+Shift+I)"
              title="Expand inspector"
            >
              <span className="material-symbols-rounded">chevron_left</span>
            </button>
          </Tooltip>
        )}
        <PanelErrorBoundary panel="inspector">
          <Inspector open={inspectorOpen} onClose={() => setInspectorOpen(false)} voiceAlerts={voiceAlerts} />
        </PanelErrorBoundary>
        <AISuggestionsPanel open={aiPanelOpen} onClose={closeAiPanel} />
      </main>

      <nav className={styles.mobileNav} aria-label={`${appLabel} mobile navigation`}>
        <button
          className={`${styles.mobileNav__tab} ${!state.settings.sidebarHidden ? styles['mobileNav__tab--active'] : ''}`}
          onClick={() => {
            if (state.settings.sidebarHidden) onToggleSidebar();
            setInspectorOpen(false);
          }}
        >
          <span className="material-symbols-rounded">list</span>
          <span>Outline</span>
        </button>
        <button
          className={`${styles.mobileNav__tab} ${state.settings.sidebarHidden && !inspectorOpen ? styles['mobileNav__tab--active'] : ''}`}
          onClick={() => {
            if (!state.settings.sidebarHidden) onToggleSidebar();
            setInspectorOpen(false);
          }}
        >
          <span className="material-symbols-rounded">edit</span>
          <span>Write</span>
        </button>
        <button
          className={`${styles.mobileNav__tab} ${inspectorOpen ? styles['mobileNav__tab--active'] : ''}`}
          onClick={() => {
            if (!state.settings.sidebarHidden) onToggleSidebar();
            setInspectorOpen(prev => !prev);
          }}
        >
          <span className="material-symbols-rounded">info</span>
          <span>Inspector</span>
        </button>
      </nav>
    </>
  );
}
