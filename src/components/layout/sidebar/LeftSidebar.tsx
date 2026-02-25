import { Search, FilePlus, FolderPlus, FileDown } from 'lucide-react';
import { SidebarSection } from './SidebarSection';
import { TreeRow } from './TreeRow';

interface LeftSidebarProps {
  collapsed?: boolean;
}

export function LeftSidebar({ collapsed = false }: LeftSidebarProps) {
  if (collapsed) {
    return (
      <aside className="w-[60px] border-r border-white/10 bg-[#171A1D] min-h-0 flex flex-col items-center py-3 gap-2 transition-all duration-150">
        <button
          className="h-9 w-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-[#AAB2BD]"
          aria-label="New document"
        >
          <FilePlus size={16} />
        </button>
        <button
          className="h-9 w-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-[#AAB2BD]"
          aria-label="Search"
        >
          <Search size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[280px] border-r border-white/10 bg-[#171A1D] min-h-0 flex flex-col transition-all duration-150">
      {/* Header */}
      <div className="p-3 border-b border-white/10 space-y-3">
        <button className="w-full h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 text-left">
          <div className="text-sm font-medium truncate">My Horror Novel</div>
          <div className="text-xs text-[#AAB2BD] truncate">42,318 words &middot; Draft</div>
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button className="h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs flex items-center justify-center gap-1.5 text-[#AAB2BD]">
            <FilePlus size={13} />
            New
          </button>
          <button className="h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs flex items-center justify-center gap-1.5 text-[#AAB2BD]">
            <FolderPlus size={13} />
            Folder
          </button>
          <button className="h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs flex items-center justify-center gap-1.5 text-[#AAB2BD]">
            <FileDown size={13} />
            Import
          </button>
        </div>

        <div className="relative">
          <input
            className="w-full h-9 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-[#ECEFF3] placeholder:text-[#7D8794] focus:outline-none focus:ring-1 focus:ring-[#41DDF2]/60 focus:border-[#41DDF2]/40"
            placeholder="Search in project"
          />
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7D8794]"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <SidebarSection title="Pinned">
          <TreeRow active icon="&#128204;" title="Chapter 4 \u2014 The Corridor" meta="1.8k" />
          <TreeRow icon="&#128221;" title="Killer Backstory Notes" meta="640" />
        </SidebarSection>

        <SidebarSection title="Chapters">
          <TreeRow icon="&#9656;" title="Chapter 1 \u2014 Prologue" meta="2.1k" />
          <TreeRow icon="&#9656;" title="Chapter 2 \u2014 The Party" meta="3.4k" />
          <TreeRow icon="&#9656;" title="Chapter 3 \u2014 The Call" meta="2.9k" />
          <TreeRow active icon="&#9662;" title="Chapter 4 \u2014 The Corridor" meta="1.8k" />
          <TreeRow level={1} icon="&#8226;" title="Scene 1 \u2014 Locker Room" meta="812" />
          <TreeRow level={1} active icon="&#8226;" title="Scene 2 \u2014 The Corridor" meta="1,031" />
          <TreeRow level={1} icon="&#8226;" title="Scene 3 \u2014 Exit Door" meta="0" />
        </SidebarSection>

        <SidebarSection title="Notes">
          <TreeRow icon="&#128450;" title="Characters" />
          <TreeRow icon="&#128450;" title="Locations" />
          <TreeRow icon="&#128450;" title="Timeline" />
        </SidebarSection>
      </div>
    </aside>
  );
}
