import { useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { Editor } from '@/components/Editor';
import { AISuggestionsPanel } from '@/components/Panels';
import { TopBar } from '@/components/layout/TopBar';
import { StatusBar } from '@/components/layout/StatusBar';
import { LeftSidebar } from '@/components/layout/sidebar/LeftSidebar';
import { RightInspector } from '@/components/layout/inspector/RightInspector';
import { useResizable } from '@/hooks/useResizable';
import { getProjectMetrics } from '@/lib/projectMetrics';
import { getTodayProgress } from '@/lib/progressTracker';
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
    sidebarImportBackup,
    aiPanelOpen,
    closeAiPanel,
    editor: tiptapEditor,
  } = props;

  const focusMode = state.settings.focusMode;

  // Compute project-level metrics for status bar
  const projectMetrics = useMemo(() => getProjectMetrics(state.chapters), [state.chapters]);

  const { wordsToday } = useMemo(
    () => getTodayProgress(projectMetrics.totalWords),
    [projectMetrics.totalWords],
  );

  // Session word tracking: store baseline on first render
  const sessionBaselineRef = useRef<number | null>(null);
  if (sessionBaselineRef.current === null) {
    sessionBaselineRef.current = projectMetrics.totalWords;
  }
  const sessionWords = projectMetrics.totalWords - sessionBaselineRef.current;

  // Daily goal progress
  const dailyGoal = state.settings.dailyWordGoal;
  const goalPercent = dailyGoal > 0
    ? Math.min(100, Math.round((wordsToday / dailyGoal) * 100))
    : 0;

  // Save status for TopBar
  const saveStatus = state.isSaving
    ? 'saving' as const
    : state.isOnline
      ? 'saved' as const
      : 'offline' as const;

  // Resizable sidebar
  const sidebarResize = useResizable({
    initialSize: 280,
    minSize: 200,
    maxSize: 420,
    direction: 'right',
    persistKey: 'writer1_sidebar_width',
    disabled: state.settings.sidebarHidden || focusMode,
  });

  // Resizable inspector
  const inspectorResize = useResizable({
    initialSize: 320,
    minSize: 240,
    maxSize: 480,
    direction: 'left',
    persistKey: 'writer1_inspector_width',
    disabled: !inspectorOpen || focusMode,
  });

  return (
    <div className="h-[100dvh] min-w-[1100px] bg-[var(--bg)] text-[var(--text)] flex flex-col">
      <TopBar
        projectTitle={state.novelTitle || 'Writer1 Project'}
        saveStatus={saveStatus}
        focusMode={focusMode}
        theme={state.settings.theme}
        onFocusMode={() => onAction('toggleFocusMode' as CommandId)}
        onSearch={() => onAction('QUICK_SWITCHER' as CommandId)}
        onToggleInspector={() => setInspectorOpen(prev => !prev)}
        onNewChapter={() => onAction('NEW_CHAPTER' as CommandId)}
        onSettings={() => onAction('SETTINGS' as CommandId)}
        onProjectSelect={() => onAction('PROJECTS' as CommandId)}
        onThemeToggle={() => {
          const themes = ['light', 'dark', 'high-contrast'] as const;
          const idx = themes.indexOf(state.settings.theme);
          const next = themes[(idx + 1) % themes.length];
          onAction(next === 'dark' ? 'themeDark' as CommandId : next === 'light' ? 'themeLight' as CommandId : 'themeHighContrast' as CommandId);
        }}
      />

      {/* Main 3-panel layout */}
      <div className="flex-1 min-h-0 flex">
        <LeftSidebar
          collapsed={focusMode || state.settings.sidebarHidden}
          width={sidebarResize.size}
          resizeHandleProps={sidebarResize.handleProps}
          isResizing={sidebarResize.isResizing}
          onCreateChapter={() => onAction('NEW_CHAPTER' as CommandId)}
          onImport={sidebarImportBackup}
        />

        {/* Editor pane */}
        <main className="flex-1 min-w-0 min-h-0 bg-[var(--bg)] flex flex-col">
          <Editor
            screenplayMode={screenplayMode}
            onToggleScreenplayMode={onToggleScreenplayMode}
          />
        </main>

        <RightInspector
          collapsed={focusMode || !inspectorOpen}
          width={inspectorResize.size}
          resizeHandleProps={inspectorResize.handleProps}
          isResizing={inspectorResize.isResizing}
          onOpenAiPanel={() => onAction('AI_PANEL' as CommandId)}
        />
      </div>

      <StatusBar
        wordCount={projectMetrics.totalWords}
        sessionWords={sessionWords}
        goalPercent={goalPercent}
        saved={!state.isSaving}
        online={state.isOnline}
        chapterCount={projectMetrics.totalChapters}
        compact={focusMode}
      />

      {focusMode && (
        <div className="focus-mode-hint">
          Press Esc to exit focus mode
        </div>
      )}

      <AISuggestionsPanel open={aiPanelOpen} onClose={closeAiPanel} editor={tiptapEditor} />
    </div>
  );
}
