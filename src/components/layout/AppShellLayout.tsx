import { useState } from 'react';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { LeftSidebar } from './sidebar/LeftSidebar';
import { EditorPane } from './editor/EditorPane';
import { RightInspector } from './inspector/RightInspector';

export function AppShellLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);

  return (
    <div className="h-[100dvh] min-w-[1100px] bg-[#111315] text-[#ECEFF3] flex flex-col">
      <TopBar
        onFocusMode={() => setSidebarCollapsed((c) => !c)}
        onToggleInspector={() => setInspectorCollapsed((c) => !c)}
      />

      {/* Main 3-panel layout */}
      <div className="flex-1 min-h-0 flex">
        <LeftSidebar collapsed={sidebarCollapsed} />
        <EditorPane />
        <RightInspector collapsed={inspectorCollapsed} />
      </div>

      <StatusBar />
    </div>
  );
}
