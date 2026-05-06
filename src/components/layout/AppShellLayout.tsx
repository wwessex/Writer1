import { useMemo, useRef, useState } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { LeftSidebar } from './sidebar/LeftSidebar';
import { EditorPane } from './editor/EditorPane';
import { RightInspector } from './inspector/RightInspector';
import { useResizable } from '@/hooks/useResizable';
import { useResponsivePanels } from '@/hooks/useResponsivePanels';
import { useApp } from '@/context/AppContext';
import { countWords, editorToPlainText, formatReadingTime } from '@/lib/utils';
import { isMacDesktopRuntime } from '@/lib/runtimePlatform';

/**
 * Standalone layout shell that wraps the Tailwind 3-panel layout.
 * Requires AppProvider context to be present in the component tree.
 */
export function AppShellLayout() {
  const { state, activeChapter, updateSettings } = useApp();
  const macDesktopRuntime = isMacDesktopRuntime();
  const [focusMode, setFocusMode] = useState(false);
  const { shouldCollapseSidebar, shouldCollapseInspector } = useResponsivePanels();
  const [sidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const leftPanelCollapsed = focusMode || shouldCollapseSidebar || sidebarCollapsed;
  const rightPanelCollapsed = focusMode || shouldCollapseInspector || inspectorCollapsed;

  const wordCount = useMemo(
    () => countWords(editorToPlainText(activeChapter?.content ?? null)),
    [activeChapter?.content]
  );

  const totalWords = useMemo(
    () => state.chapters.reduce((sum, chapter) => sum + countWords(editorToPlainText(chapter.content)), 0),
    [state.chapters]
  );

  const sessionStartWords = useRef<number | null>(null);
  const previousNovelId = useRef(state.novelId);

  if (previousNovelId.current !== state.novelId) {
    sessionStartWords.current = totalWords;
    previousNovelId.current = state.novelId;
  }

  if (sessionStartWords.current === null) {
    sessionStartWords.current = totalWords;
  }

  const sessionWords = Math.max(0, totalWords - (sessionStartWords.current ?? 0));
  const goalPercent = activeChapter && activeChapter.wordGoal > 0
    ? Math.min(100, Math.round((wordCount / activeChapter.wordGoal) * 100))
    : 0;

  const sidebarResize = useResizable({
    initialSize: 280,
    minSize: 200,
    maxSize: 420,
    direction: 'right',
    persistKey: 'writer1_sidebar_width',
    disabled: leftPanelCollapsed,
  });

  const inspectorResize = useResizable({
    initialSize: 320,
    minSize: 240,
    maxSize: 480,
    direction: 'left',
    persistKey: 'writer1_inspector_width',
    disabled: rightPanelCollapsed,
  });

  const handleSearch = () => {
    const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search in project"]');
    if (searchInput) {
      searchInput.focus();
      return;
    }

    const searchTrigger = document.querySelector<HTMLButtonElement>('button[aria-label="Search"]');
    searchTrigger?.focus();
  };

  return (
    <div className={[
      'h-[100dvh] min-w-0 bg-[var(--bg)] text-[var(--text)] flex flex-col overflow-x-hidden',
      macDesktopRuntime ? 'mac-liquid-root' : '',
    ].join(' ')}>
      <TopBar
        macLiquid={macDesktopRuntime}
        focusMode={focusMode}
        theme={state.settings.theme}
        onFocusMode={() => setFocusMode((mode) => !mode)}
        onSearch={handleSearch}
        onToggleInspector={() => setInspectorCollapsed((c) => !c)}
        onThemeToggle={() => updateSettings({
          theme: state.settings.theme === 'auto'
            ? 'light'
            : state.settings.theme === 'light'
              ? 'dark'
              : 'auto',
        })}
      />

      {/*
        Main 3-panel layout.
        Responsive panel auto-collapse keeps the editor readable on smaller viewports.
      */}
      <div className="flex-1 min-h-0 flex">
        <LeftSidebar
          collapsed={leftPanelCollapsed}
          width={sidebarResize.size}
          resizeHandleProps={sidebarResize.handleProps}
          isResizing={sidebarResize.isResizing}
          onSearch={handleSearch}
        />
        <EditorPane />
        <RightInspector
          collapsed={rightPanelCollapsed}
          width={inspectorResize.size}
          resizeHandleProps={inspectorResize.handleProps}
          isResizing={inspectorResize.isResizing}
        />
      </div>

      <StatusBar
        macLiquid={macDesktopRuntime}
        wordCount={wordCount}
        sessionWords={sessionWords}
        goalPercent={goalPercent}
        saved={!state.isSaving}
        online={state.isOnline}
        readingTime={formatReadingTime(wordCount)}
        chapterCount={state.chapters.length}
        compact={focusMode}
      />
    </div>
  );
}
