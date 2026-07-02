import { type ReactNode } from 'react';
import { LogOut } from 'lucide-react';
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
}

/** Labeled nav row (used in the <md navigation sheet). */
export function NavItem({ active, onClick, icon, label }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
      )}
    >
      <span className="shrink-0 [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

interface UserPillProps {
  label: string;
  sublabel?: string;
  onClick: () => void;
}

/** Sheet footer pill showing the authenticated user; click to log out. */
export function UserPill({ label, sublabel, onClick }: UserPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Log out"
      aria-label={`Log out (${label})`}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
        'hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span className="size-[7px] shrink-0 rounded-full bg-success" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-subtle-foreground">{label}</span>
        {sublabel && <span className="block truncate text-xxs text-muted-foreground">{sublabel}</span>}
      </span>
      <LogOut className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
