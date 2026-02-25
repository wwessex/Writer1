interface StatusBarProps {
  wordCount?: number;
  sessionWords?: number;
  goalPercent?: number;
  saved?: boolean;
  online?: boolean;
}

export function StatusBar({
  wordCount = 2843,
  sessionWords = 612,
  goalPercent = 61,
  saved = true,
  online = true,
}: StatusBarProps) {
  return (
    <footer className="h-7 border-t border-white/10 bg-[#171A1D] px-3 flex items-center justify-between text-[12px] text-[#AAB2BD] shrink-0">
      <div className="flex items-center gap-3">
        <span>Words: {wordCount.toLocaleString()}</span>
        <span className="text-white/10">&bull;</span>
        <span>Session: +{sessionWords.toLocaleString()}</span>
        <span className="text-white/10">&bull;</span>
        <span>Goal: {goalPercent}%</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={saved ? 'text-[#B8F1D0]' : 'text-[#AAB2BD]'}>
          {saved ? 'Saved' : 'Saving\u2026'}
        </span>
        <span>{online ? 'Online' : 'Offline'}</span>
      </div>
    </footer>
  );
}
