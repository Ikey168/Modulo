import { type ComponentType, type ReactNode } from 'react';
import { cn } from '@/ui';
import { Sparkline } from './Sparkline';

export type MetricTone = 'default' | 'success' | 'warning' | 'danger';

const TONE_RULE: Record<MetricTone, string> = {
  default: 'border-l-border-strong',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-destructive',
};

const TONE_VALUE: Record<MetricTone, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

/** 1284 -> "1,284"; 12900 -> "12.9K". Keeps a headline number short. */
function compact(value: ReactNode): ReactNode {
  if (typeof value !== 'number') return value;
  if (Math.abs(value) < 10000) return value.toLocaleString();
  if (Math.abs(value) < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

export interface MetricProps {
  /** Sentence case, no trailing colon. */
  label: string;
  value: ReactNode;
  /** Units, a comparison, or the names behind the count. */
  detail?: ReactNode;
  tone?: MetricTone;
  icon?: ComponentType<{ className?: string }>;
  /** Oldest to newest. Renders a sparkline beside the value. */
  trend?: number[];
  /** Makes the whole tile open the records it counts. */
  onOpen?: () => void;
  className?: string;
}

/**
 * Stat tile: label, value, optional detail and trend.
 *
 * The value uses the font's proportional figures rather than `tabular-nums`,
 * which at this size makes a number like 121 look loose. Tone is carried by a
 * left rule plus the value colour, so a warning reads without relying on a
 * background wash that would compete with the panels below.
 */
export function Metric({
  label,
  value,
  detail,
  tone = 'default',
  icon: Icon,
  trend,
  onOpen,
  className,
}: MetricProps) {
  // A trend with one or no active period is a flat line of stubs: it reads as an
  // artifact rather than as history, so it is not worth the space.
  const showTrend = Boolean(trend && trend.filter((point) => point > 0).length >= 2);

  const body = (
    <>
      <p className="flex items-center gap-1.5 text-xxs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </p>
      <div className="mt-1 flex items-end gap-2">
        <span className={cn('truncate text-2xl font-semibold leading-none', TONE_VALUE[tone])}>
          {compact(value)}
        </span>
        {showTrend && trend && (
          <Sparkline values={trend} label={`${label} over the last ${trend.length} periods`} className="mb-0.5" />
        )}
      </div>
      {detail && <p className="mt-1.5 truncate text-xs text-muted-foreground">{detail}</p>}
    </>
  );

  const shell = cn('min-w-0 border-l-2 py-1 pl-3 pr-2 text-left', TONE_RULE[tone], className);

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label}: ${typeof value === 'number' ? value : ''}`.trim()}
        className={cn(
          shell,
          'rounded-sm transition-colors hover:bg-surface-2/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}

/**
 * The KPI row. Tiles sit on one rule rather than in boxes, so the numbers read
 * as a single band and the panels below own the card weight.
 */
export function MetricRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid gap-x-4 gap-y-3 border-y border-border py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
        className,
      )}
    >
      {children}
    </div>
  );
}
