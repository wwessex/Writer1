import type { ReactNode } from 'react';

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="mb-2">
      <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
