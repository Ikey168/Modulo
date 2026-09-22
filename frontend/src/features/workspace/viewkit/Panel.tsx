import { type ComponentType, type ReactNode } from 'react';
import { cn } from '@/ui';

export interface PanelProps {
  title: ReactNode;
  /** Lucide icon for the panel header. Omit rather than pass a decorative default. */
  icon?: ComponentType<{ className?: string }>;
  description?: ReactNode;
  /** Controls right-aligned in the panel header. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Override body padding. Pass `p-0` for `divide-y` row lists. */
  bodyClassName?: string;
}

/**
 * Bordered section with a header bar — the dense grouping container used
 * throughout the workspace. This is deliberately not `@/ui`'s `Card`, whose
 * `p-5` is too generous for hub-tab density; it replaces the twelve private
 * `Panel` copies that had drifted apart on header background, icon and padding.
 */
export function Panel({
  title,
  icon: Icon,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section className={cn('min-w-0 rounded-sm border border-border', className)}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 coarse:min-h-touch">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className="truncate">{title}</span>
          </h3>
          {description && <p className="sr-only">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </header>
      <div className={cn('p-3', bodyClassName)}>{children}</div>
    </section>
  );
}
