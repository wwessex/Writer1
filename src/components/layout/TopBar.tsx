import { Search, Moon, Sun, Monitor, MoreHorizontal, Maximize2, Minimize2, PanelRight, FilePlus } from 'lucide-react';

type SaveStatus = 'saved' | 'saving' | 'offline' | 'error';
type Theme = 'light' | 'dark' | 'high-contrast';

interface TopBarProps {
  projectTitle?: string;
  saveStatus?: SaveStatus;
  focusMode?: boolean;
  theme?: Theme;
  onFocusMode?: () => void;
  onSearch?: () => void;
  onToggleInspector?: () => void;
  onNewChapter?: () => void;
  onSettings?: () => void;
  onProjectSelect?: () => void;
  onThemeToggle?: () => void;
}

const SAVE_STATUS_STYLES: Record<SaveStatus, { className: string; label: string }> = {
  saved: {
    className: 'border-[var(--success-border)] bg-[var(--success-alpha)] text-[var(--success)]',
    label: 'Saved',
  },
  saving: {
    className: 'border-[var(--border)] bg-[var(--btn-bg)] text-[var(--text-secondary)]',
    label: 'Saving',
  },
  offline: {
    className: 'border-[var(--warning-border)] bg-[var(--warning-alpha)] text-[var(--warning)]',
    label: 'Offline',
  },
  error: {
    className: 'border-[var(--danger-border)] bg-[var(--danger-alpha)] text-[var(--danger)]',
    label: 'Save failed',
  },
};

export function TopBar({
  projectTitle = 'Writer1 Project',
  saveStatus = 'saved',
  focusMode = false,
  theme = 'light',
  onFocusMode,
  onSearch,
  onToggleInspector,
  onNewChapter,
  onSettings,
  onProjectSelect,
  onThemeToggle,
}: TopBarProps) {
  const statusStyle = SAVE_STATUS_STYLES[saveStatus];

  return (
    <header
      className={[
        'border-b border-[var(--border)] bg-[var(--panel)] backdrop-blur px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 shrink-0 transition-[height] duration-150',
        focusMode ? 'h-10' : 'h-14',
      ].join(' ')}
    >
      {/* Left */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 md:flex-none">
        <button
          className="h-9 w-9 rounded-xl hover:bg-[var(--btn-bg)] flex items-center justify-center transition-colors"
          aria-label="Writer1 Home"
        >
          <span className="text-sm font-semibold">W</span>
        </button>

        {!focusMode && (
          <>
            <button
              className="h-9 max-w-[130px] sm:max-w-[220px] lg:max-w-[260px] rounded-xl px-3 bg-[var(--btn-bg)] hover:bg-[var(--btn-hover)] border border-[var(--border)] flex items-center gap-2 min-w-0 transition-colors"
              onClick={onProjectSelect}
            >
              <span className="truncate text-sm font-medium">{projectTitle}</span>
              <span className="text-xs text-[var(--text-muted)]">&#9662;</span>
            </button>

            <button
              className="hidden lg:flex h-9 rounded-xl px-3 hover:bg-[var(--btn-bg)] text-sm text-[var(--text-secondary)] items-center gap-1.5 transition-colors"
              onClick={onNewChapter}
            >
              <FilePlus size={14} />
              New
            </button>
          </>
        )}
      </div>

      {/* Center — search */}
      {!focusMode && (
        <div className="hidden md:block flex-1 max-w-[520px] min-w-[220px]">
          <button
            className="w-full h-9 rounded-xl border border-[var(--border)] bg-[var(--btn-bg)] hover:bg-[var(--btn-hover)] px-3 flex items-center justify-between text-left transition-colors"
            onClick={onSearch}
          >
            <span className="flex items-center gap-2 text-sm text-[var(--text-secondary)] truncate">
              <Search size={14} className="shrink-0" />
              Search documents or press &#8984;K
            </span>
            <span className="text-xs text-[var(--text-muted)]">&#8984;K</span>
          </button>
        </div>
      )}

      {/* Right */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div
          className={[
            'hidden sm:flex h-8 rounded-lg px-2.5 text-xs items-center gap-1.5 border transition-all duration-200',
            statusStyle.className,
          ].join(' ')}
        >
          {saveStatus === 'saving' && <span className="saving-dot" />}
          {statusStyle.label}
        </div>

        <button
          className="h-9 rounded-xl px-2 sm:px-3 hover:bg-[var(--btn-bg)] text-sm text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors"
          onClick={onFocusMode}
        >
          {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span className="hidden sm:inline">{focusMode ? 'Exit' : 'Focus'}</span>
        </button>

        {!focusMode && (
          <>
            <button
              className="h-9 w-9 rounded-xl hover:bg-[var(--btn-bg)] flex items-center justify-center text-[var(--text-secondary)] transition-colors"
              aria-label={`Theme: ${theme}`}
              onClick={onThemeToggle}
            >
              {theme === 'dark' ? <Moon size={16} /> : theme === 'high-contrast' ? <Monitor size={16} /> : <Sun size={16} />}
            </button>

            <button
              className="h-9 w-9 rounded-xl hover:bg-[var(--btn-bg)] flex items-center justify-center text-[var(--text-secondary)] transition-colors"
              aria-label="Toggle inspector"
              onClick={onToggleInspector}
            >
              <PanelRight size={16} />
            </button>

            <button
              className="h-9 w-9 rounded-xl hover:bg-[var(--btn-bg)] flex items-center justify-center text-[var(--text-secondary)] transition-colors"
              aria-label="Settings"
              onClick={onSettings}
            >
              <MoreHorizontal size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
