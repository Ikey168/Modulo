import { type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/ui';

export type NextActionTone = 'default' | 'warning' | 'danger';

const DOT: Record<NextActionTone, string> = {
  default: 'bg-primary',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

export interface NextAction {
  id: string;
  /** The thing to do, phrased as a thing to do. */
  title: string;
  /** Where it comes from and why it is next. */
  context?: ReactNode;
  tone?: NextActionTone;
  onOpen?: () => void;
}

/**
 * The lead block of a dashboard: what to do next, drawn from the records.
 *
 * A dashboard that opens with counts makes the reader derive their own next
 * step from six panels of aggregates. This states it. Everything below is
 * supporting detail, so this is the only element on the page at this weight.
 */
export function NextUp({
  actions,
  emptyMessage = 'Nothing needs you right now.',
  className,
}: {
  actions: NextAction[];
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Next up</h3>

      {actions.length === 0 ? (
        <p className="mt-3 text-[15px] text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {actions.map((action) => {
            const dot = (
              <span
                className={cn('mt-[7px] size-2 shrink-0 rounded-full', DOT[action.tone ?? 'default'])}
                aria-hidden="true"
              />
            );
            const body = (
              <>
                {dot}
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium leading-snug text-foreground">{action.title}</span>
                  {action.context && (
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{action.context}</span>
                  )}
                </span>
              </>
            );

            if (!action.onOpen) {
              return (
                <li key={action.id} className="flex min-w-0 gap-3 rounded-md px-2 py-2">
                  {body}
                </li>
              );
            }
            return (
              <li key={action.id} className="min-w-0">
                <button
                  type="button"
                  onClick={action.onOpen}
                  className={cn(
                    'group flex w-full min-w-0 items-start gap-3 rounded-md px-2 py-2 text-left transition-colors',
                    'hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {body}
                  <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export interface StripStat {
  label: string;
  value: ReactNode;
  tone?: NextActionTone;
  onOpen?: () => void;
}

/**
 * The supporting numbers, on one line under the lead.
 *
 * Deliberately not the boxed KPI row: once "next up" carries the page, the
 * counts are context, and six bordered tiles would compete with it.
 */
export function MetricStrip({ stats, className }: { stats: StripStat[]; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-[13px]',
        className,
      )}
    >
      {stats.map((stat) => {
        const content = (
          <>
            <span
              className={cn(
                'font-semibold tabular-nums',
                stat.tone === 'warning' && 'text-warning',
                stat.tone === 'danger' && 'text-destructive',
                !stat.tone && 'text-foreground',
              )}
            >
              {stat.value}
            </span>{' '}
            <span className="text-muted-foreground">{stat.label}</span>
          </>
        );
        if (!stat.onOpen) {
          return (
            <span key={stat.label} className="whitespace-nowrap">
              {content}
            </span>
          );
        }
        return (
          <button
            key={stat.label}
            type="button"
            onClick={stat.onOpen}
            className="whitespace-nowrap rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

/** The row of "go deeper" links that closes the lead block. */
export function QuickLinks({
  links,
  className,
}: {
  links: { label: string; onOpen: () => void }[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-2', className)}>
      {links.map((link) => (
        <button
          key={link.label}
          type="button"
          onClick={link.onOpen}
          className="inline-flex items-center gap-1 rounded-sm text-[13px] text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {link.label}
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
