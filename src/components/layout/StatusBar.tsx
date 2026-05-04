interface StatusBarProps {
  wordCount: number;
  sessionWords: number;
  goalPercent: number;
  saved: boolean;
  online: boolean;
  readingTime?: string;
  chapterCount?: number;
  compact?: boolean;
  macLiquid?: boolean;
}

export function StatusBar({
  wordCount,
  sessionWords,
  goalPercent,
  saved,
  online,
  readingTime,
  chapterCount,
  compact = false,
  macLiquid = false,
}: StatusBarProps) {
  return (
    <footer
      className={[
        'border-t border-[var(--border)] bg-[var(--panel)] px-3 flex items-center justify-between text-[12px] text-[var(--text-secondary)] shrink-0 transition-[height,opacity] duration-150',
        compact ? 'h-6 opacity-60' : 'h-7',
        macLiquid ? 'app-chrome app-chrome--bottom' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span>Words: {wordCount.toLocaleString()}</span>
        {!compact && chapterCount != null && (
          <>
            <span className="text-[var(--border)]">&bull;</span>
            <span>{chapterCount} chapters</span>
          </>
        )}
        {!compact && readingTime && (
          <>
            <span className="text-[var(--border)]">&bull;</span>
            <span>{readingTime}</span>
          </>
        )}
        <span className="text-[var(--border)]">&bull;</span>
        <span>Session: {sessionWords >= 0 ? '+' : ''}{sessionWords.toLocaleString()}</span>
        {goalPercent > 0 && (
          <>
            <span className="text-[var(--border)]">&bull;</span>
            <span>Goal: {goalPercent}%</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className={saved ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}>
          {saved ? 'Saved' : 'Saving\u2026'}
        </span>
        <span className={online ? '' : 'text-[var(--warning)]'}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>
    </footer>
  );
}
