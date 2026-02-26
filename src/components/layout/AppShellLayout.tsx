import { useState } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { LeftSidebar } from './sidebar/LeftSidebar';
import { EditorPane } from './editor/EditorPane';
import { RightInspector } from './inspector/RightInspector';
import { useResizable } from '@/hooks/useResizable';

/**
 * Standalone layout shell that wraps the Tailwind 3-panel layout.
 * Requires AppProvider context to be present in the component tree.
 */
export function AppShellLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

  const sidebarResize = useResizable({
    initialSize: 280,
    minSize: 200,
    maxSize: 420,
    direction: 'right',
    persistKey: 'writer1_sidebar_width',
    disabled: sidebarCollapsed,
  });

  const inspectorResize = useResizable({
    initialSize: 320,
    minSize: 240,
    maxSize: 480,
    direction: 'left',
    persistKey: 'writer1_inspector_width',
    disabled: inspectorCollapsed,
  });

  return (
    <div className="h-[100dvh] min-w-[1100px] bg-[var(--bg)] text-[var(--text)] flex flex-col">
      <TopBar
        onFocusMode={() => setSidebarCollapsed((c) => !c)}
        onToggleInspector={() => setInspectorCollapsed((c) => !c)}
      />

      {/* Main 3-panel layout */}
      <div className="flex-1 min-h-0 flex">
        <LeftSidebar
          collapsed={sidebarCollapsed}
          width={sidebarResize.size}
          resizeHandleProps={sidebarResize.handleProps}
          isResizing={sidebarResize.isResizing}
        />
        <EditorPane />
        <RightInspector
          collapsed={inspectorCollapsed}
          width={inspectorResize.size}
          resizeHandleProps={inspectorResize.handleProps}
          isResizing={inspectorResize.isResizing}
        />
      </div>

      <StatusBar
        wordCount={0}
        sessionWords={0}
        goalPercent={0}
        saved={true}
        online={true}
      />
    </div>
  );
}
