import type { Dispatch, SetStateAction } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { Editor } from '@/components/Editor';
import { AISuggestionsPanel } from '@/components/Panels';
import { TopBar } from '@/components/layout/TopBar';
import { StatusBar } from '@/components/layout/StatusBar';
import { LeftSidebar } from '@/components/layout/sidebar/LeftSidebar';
import { RightInspector } from '@/components/layout/inspector/RightInspector';
import type { VoiceSimilarityAlert } from '@/lib/voiceFingerprint';
import type { CommandId } from '@/lib/commands';
import type { AppState } from '@/types';

interface AppShellProps {
  appLabel: string;
  state: AppState;
  screenplayMode: boolean;
  onToggleScreenplayMode: () => void;
  onAction: (action: CommandId) => void;
  hasTextSelection: boolean;
  editorFocused: boolean;
  inspectorOpen: boolean;
  setInspectorOpen: Dispatch<SetStateAction<boolean>>;
  voiceAlerts: VoiceSimilarityAlert[];
  sidebarImportBackup: () => void;
  onExportBackup: () => void;
  onToggleSidebar: () => void;
  aiPanelOpen: boolean;
  closeAiPanel: () => void;
  editor: TiptapEditor | null;
}

export function AppShell(props: AppShellProps) {
  const {
    state,
    screenplayMode,
    onToggleScreenplayMode,
    onAction,
    inspectorOpen,
    setInspectorOpen,
    onToggleSidebar,
    aiPanelOpen,
    closeAiPanel,
    editor: tiptapEditor,
  } = props;

  return (
    <div className="h-[100dvh] min-w-[1100px] bg-[#111315] text-[#ECEFF3] flex flex-col">
      <TopBar
        projectTitle={state.novelTitle || 'Writer1 Project'}
        onFocusMode={onToggleSidebar}
        onSearch={() => onAction('QUICK_SWITCHER' as CommandId)}
        onToggleInspector={() => setInspectorOpen(prev => !prev)}
      />

      {/* Main 3-panel layout */}
      <div className="flex-1 min-h-0 flex">
        <LeftSidebar collapsed={state.settings.sidebarHidden} />

        {/* Editor pane */}
        <main className="flex-1 min-w-0 min-h-0 bg-[#111315] flex flex-col">
          <Editor
            screenplayMode={screenplayMode}
            onToggleScreenplayMode={onToggleScreenplayMode}
          />
        </main>

        <RightInspector collapsed={!inspectorOpen} />
      </div>

      <StatusBar
        wordCount={2843}
        sessionWords={612}
        goalPercent={61}
        saved={!state.isSaving}
        online={state.isOnline}
      />

      <AISuggestionsPanel open={aiPanelOpen} onClose={closeAiPanel} editor={tiptapEditor} />
    </div>
  );
}
