import { type ReactNode } from 'react';
import { cn } from '@/ui';

/**
 * Container for `RecordCard`s. These render as full-width divided rows rather
 * than a card grid — the shape the strongest existing screens already used,
 * and the one that stays scannable as a collection grows.
 */
export function CardGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('border-y border-border', className)}>{children}</div>
  );
}

export interface RecordCardProps {
  title: string;
  /** Status pills, rendered above the title. */
  badges?: ReactNode;
  /** Short supporting lines under the title. */
  detail?: ReactNode;
  /** Opens the record. Renders as a real button covering the card body. */
  onOpen?: () => void;
  /** Row actions, kept outside the activating button so they stay reachable. */
  actions?: ReactNode;
  /** Footer strip, e.g. a progress bar or a relation summary. */
  footer?: ReactNode;
  className?: string;
}

/**
 * A record tile in a card grid.
 *
 * The activating control is a real `<button>` beside the actions rather than an
 * `<article role="button">` wrapping them, which previously nested a delete
 * button inside a `role="button"` element.
 */
export function RecordCard({
  title,
  badges,
  detail,
  onOpen,
  actions,
  footer,
  className,
}: RecordCardProps) {
  return (
    <article
      className={cn(
        'group relative flex min-w-0 flex-col border-b border-border bg-transparent px-3 py-2.5 transition-colors last:border-b-0 hover:bg-muted/20',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          {badges && <div className="mb-1.5 flex flex-wrap items-center gap-1">{badges}</div>}
          {onOpen ? (
            <button
              type="button"
              onClick={onOpen}
              className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block break-words text-sm font-medium">{title}</span>
            </button>
          ) : (
            <h3 className="break-words text-sm font-semibold">{title}</h3>
          )}
          {detail && <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">{detail}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {footer && <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">{footer}</div>}
    </article>
  );
}
