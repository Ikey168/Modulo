// A small segmented toggle used by the view plugins (Calendar, Timeline) for
// compact two/three-way switches in a toolbar.
import { cn } from '@/ui';

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  className?: string;
}

export function Segmented<T extends string>({ value, onChange, options, className }: SegmentedProps<T>) {
  return (
    <div className={cn('flex overflow-hidden rounded-md border border-border', className)} role="tablist">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'px-2 py-1 text-xxs font-medium transition-colors',
            value === v
              ? 'bg-primary text-primary-foreground'
              : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
