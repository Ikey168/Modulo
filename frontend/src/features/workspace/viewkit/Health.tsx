import { type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/ui';

export interface HealthLineProps {
  okay: boolean;
  children: ReactNode;
  /** Resolves the problem — a health line that only states a fault is a dead end. */
  action?: ReactNode;
}

/**
 * One pass/warn line in a health panel. Uses the `success`/`warning` tokens
 * instead of the raw `text-emerald-500` / `text-amber-500` pairs the ten
 * private copies hardcoded, so it tracks the theme.
 */
export function HealthLine({ okay, children, action }: HealthLineProps) {
  const Icon = okay ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-start gap-2 py-1 text-xs">
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', okay ? 'text-success' : 'text-warning')}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">{children}</span>
      {action && <span className="shrink-0">{action}</span>}
    </li>
  );
}

/** Groups `HealthLine`s with list semantics. */
export function HealthList({ children }: { children: ReactNode }) {
  return <ul className="min-w-0">{children}</ul>;
}
