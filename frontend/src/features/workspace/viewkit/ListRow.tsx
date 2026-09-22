import { type ReactNode } from 'react';
import { cn } from '@/ui';

/** `<ul>` with the standard row dividers. */
export function ListRows({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('divide-y divide-border', className)}>{children}</ul>;
}

export interface ListRowProps {
  /** Primary text. Truncates. */
  title: ReactNode;
  /** Secondary line under the title. */
  detail?: ReactNode;
  /** Leading control — a checkbox, avatar or icon. */
  leading?: ReactNode;
  /** Badges or metadata, right-aligned before the actions. */
  meta?: ReactNode;
  /** Row actions, e.g. `ConfirmDelete`. */
  actions?: ReactNode;
  /** Makes the row body activate. Renders a real button, never a div with onClick. */
  onOpen?: () => void;
  /** Accessible name for the activating button. Defaults to the title text. */
  openLabel?: string;
  muted?: boolean;
  className?: string;
}

/**
 * One record in a list. The previous rows were `flex` + `ml-auto` div soup with
 * metadata concatenated into a single span, so nothing column-aligned and
 * whole-row activation was often a `div onClick` with no keyboard path.
 */
export function ListRow({
  title,
  detail,
  leading,
  meta,
  actions,
  onOpen,
  openLabel,
  muted = false,
  className,
}: ListRowProps) {
  const body = (
    <span className="min-w-0 flex-1 text-left">
      <span className={cn('block truncate text-[13.5px]', muted && 'text-muted-foreground line-through')}>
        {title}
      </span>
      {detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>}
    </span>
  );
  return (
    <li
      className={cn(
        'flex min-w-0 items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/20',
        // A record row is the primary tap target in most of these screens, so
        // on touch it is at least a finger tall and flashes on press.
        'coarse:min-h-touch coarse:gap-3 coarse:py-2.5 coarse:active:bg-muted/40',
        className,
      )}
    >
      {leading && <span className="shrink-0">{leading}</span>}
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel ?? (typeof title === 'string' ? `Open ${title}` : undefined)}
          className="flex min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {meta && <span className="flex shrink-0 items-center gap-1.5 text-xxs text-muted-foreground">{meta}</span>}
      {actions && <span className="flex shrink-0 items-center gap-1">{actions}</span>}
    </li>
  );
}
