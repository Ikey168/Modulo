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
