import { type ReactNode } from 'react';
import { cn } from '@/ui';

/** Uppercase micro-heading used above sidebar/panel sections. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-xxs font-semibold uppercase tracking-[0.1em] text-muted-foreground', className)}>
      {children}
    </div>
  );
}

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  /** Icon-rail mode (md breakpoint): icon only, label moves to title/aria-label. */
  collapsed?: boolean;
}

export function NavItem({ active, onClick, icon, label, collapsed = false }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed && 'justify-center px-0',
        active ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground',
      )}
    >
      <span className="shrink-0 [&_svg]:size-[15px]" aria-hidden="true">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

interface UserPillProps {
  label: string;
  sublabel?: string;
  onClick: () => void;
}

/** Sidebar footer pill showing the authenticated user; click to log out. */
export function UserPill({ label, sublabel, onClick }: UserPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Log out"
      aria-label={`Log out (${label})`}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border border-border-strong bg-surface-2 px-2.5 py-2 text-left',
        'transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="size-[7px] shrink-0 rounded-full bg-success" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-subtle-foreground">{label}</span>
        {sublabel && <span className="block truncate text-xxs text-muted-foreground">{sublabel}</span>}
      </span>
      <svg width={12} height={12} viewBox="0 0 12 12" fill="none" className="shrink-0 text-muted-foreground" aria-hidden="true">
        <path d="M4.5 1.5H2.5A1 1 0 001.5 2.5v7a1 1 0 001 1h2" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" />
        <path d="M7 8.5L9.5 6 7 3.5M9.5 6h-6" stroke="currentColor" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
