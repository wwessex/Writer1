import type { ReactNode } from 'react';

interface TreeRowProps {
  icon?: ReactNode;
  title: string;
  meta?: string;
  active?: boolean;
  level?: number;
  onClick?: () => void;
  onIconClick?: () => void;
}

export function TreeRow({ icon, title, meta, active = false, level = 0, onClick, onIconClick }: TreeRowProps) {
  return (
    <div className="relative">
      {active && (
        <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-[#41DDF2]" />
      )}
      <button
        className={[
          'w-full h-8 rounded-lg px-2 flex items-center gap-2 text-left hover:bg-white/5',
          active ? 'bg-white/5' : '',
        ].join(' ')}
        style={level > 0 ? { paddingLeft: `${8 + level * 16}px` } : undefined}
        onClick={onClick}
      >
        {icon != null && (
          <span
            className="text-xs text-[#AAB2BD] w-4 shrink-0 flex items-center justify-center"
            onClick={onIconClick ? (e) => { e.stopPropagation(); onIconClick(); } : undefined}
          >
            {icon}
          </span>
        )}
        <span className="text-sm truncate flex-1">{title}</span>
        {meta && <span className="text-[11px] text-[#7D8794]">{meta}</span>}
      </button>
    </div>
  );
}
