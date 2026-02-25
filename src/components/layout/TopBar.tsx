import { Search, Moon, MoreHorizontal, Maximize2, PanelRight, FilePlus } from 'lucide-react';

type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';

interface TopBarProps {
  projectTitle?: string;
  saveStatus?: SaveStatus;
  onFocusMode?: () => void;
  onSearch?: () => void;
  onToggleInspector?: () => void;
  onNewChapter?: () => void;
  onSettings?: () => void;
  onProjectSelect?: () => void;
}

const SAVE_STATUS_STYLES: Record<SaveStatus, { className: string; label: string }> = {
  saved: {
    className: 'border-[#3FC17A]/20 bg-[#3FC17A]/10 text-[#B8F1D0]',
    label: 'Saved',
  },
  saving: {
    className: 'border-white/10 bg-white/5 text-[#AAB2BD]',
    label: 'Saving\u2026',
  },
  offline: {
    className: 'border-[#F59E0B]/20 bg-[#F59E0B]/10 text-[#FDE68A]',
    label: 'Offline',
  },
  error: {
    className: 'border-[#EF4444]/20 bg-[#EF4444]/10 text-[#FCA5A5]',
    label: 'Save failed',
  },
};

export function TopBar({
  projectTitle = 'Writer1 Project',
  saveStatus = 'saved',
  onFocusMode,
  onSearch,
  onToggleInspector,
  onNewChapter,
  onSettings,
  onProjectSelect,
}: TopBarProps) {
  const statusStyle = SAVE_STATUS_STYLES[saveStatus];

  return (
    <header className="h-14 border-b border-white/10 bg-[#171A1D]/95 backdrop-blur supports-[backdrop-filter]:bg-[#171A1D]/80 px-4 flex items-center justify-between gap-3 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          className="h-9 w-9 rounded-xl hover:bg-white/5 flex items-center justify-center"
          aria-label="Writer1 Home"
        >
          <span className="text-sm font-semibold">W</span>
        </button>

        <button
          className="h-9 max-w-[260px] rounded-xl px-3 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 min-w-0"
          onClick={onProjectSelect}
        >
          <span className="truncate text-sm font-medium">{projectTitle}</span>
          <span className="text-xs text-[#AAB2BD]">&#9662;</span>
        </button>

        <button
          className="h-9 rounded-xl px-3 hover:bg-white/5 text-sm text-[#AAB2BD] flex items-center gap-1.5"
          onClick={onNewChapter}
        >
          <FilePlus size={14} />
          New
        </button>
      </div>

      {/* Center — search */}
      <div className="flex-1 max-w-[520px]">
        <button
          className="w-full h-9 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 flex items-center justify-between text-left"
          onClick={onSearch}
        >
          <span className="flex items-center gap-2 text-sm text-[#AAB2BD] truncate">
            <Search size={14} className="shrink-0" />
            Search documents or press &#8984;K
          </span>
          <span className="text-xs text-[#7D8794]">&#8984;K</span>
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <div className={`h-8 rounded-lg px-2.5 text-xs flex items-center border ${statusStyle.className}`}>
          {statusStyle.label}
        </div>

        <button
          className="h-9 rounded-xl px-3 hover:bg-white/5 text-sm text-[#AAB2BD] flex items-center gap-1.5"
          onClick={onFocusMode}
        >
          <Maximize2 size={14} />
          Focus
        </button>

        <button
          className="h-9 w-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-[#AAB2BD]"
          aria-label="Theme"
        >
          <Moon size={16} />
        </button>

        <button
          className="h-9 w-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-[#AAB2BD]"
          aria-label="Toggle inspector"
          onClick={onToggleInspector}
        >
          <PanelRight size={16} />
        </button>

        <button
          className="h-9 w-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-[#AAB2BD]"
          aria-label="Settings"
          onClick={onSettings}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </header>
  );
}
