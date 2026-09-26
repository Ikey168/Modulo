import { cn } from '@/ui';

export interface SparklineProps {
  /** Oldest to newest. Rendered as-is; pass at most ~14 points. */
  values: number[];
  /** Describes the series for screen readers. Required — this is data, not decoration. */
  label: string;
  className?: string;
}

/**
 * Bar sparkline for a stat tile: the trend behind a headline number.
 *
 * Past periods sit in the de-emphasis hue and the current period carries the
 * accent, so the eye lands on "now" without a legend. Bars rather than a line
 * because these series are counts, and a 2px gap keeps adjacent bars separate
 * without a stroke.
 */
export function Sparkline({ values, label, className }: SparklineProps) {
  if (values.length === 0) return null;

  const peak = Math.max(...values, 1);
  const width = 4;
  const gap = 2;
  const height = 18;
  const total = values.length * width + (values.length - 1) * gap;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${height}`}
      preserveAspectRatio="none"
      className={cn('h-4 w-16 shrink-0', className)}
    >
      {values.map((value, index) => {
        // Every period keeps a visible stub, so an empty period reads as a
        // period with no activity rather than as missing data.
        const barHeight = Math.max(1.5, (value / peak) * height);
        const current = index === values.length - 1;
        return (
          <rect
            key={index}
            x={index * (width + gap)}
            y={height - barHeight}
            width={width}
            height={barHeight}
            rx={1}
            className={current ? 'fill-primary' : 'fill-muted-foreground/40'}
          />
        );
      })}
    </svg>
  );
}
