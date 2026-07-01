import { type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** 'underline' (default) or 'pills'. */
  variant?: 'underline' | 'pills';
}

/** Controlled, dependency-free tab bar. */
export function Tabs({ items, value, onChange, className, variant = 'underline' }: TabsProps) {
  if (variant === 'pills') {
    return (
      <div className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1', className)} role="tablist">
        {items.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={value === t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors [&_svg]:size-4',
              value === t.value
                ? 'bg-surface-3 text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1 border-b border-border', className)} role="tablist">
      {items.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors [&_svg]:size-4',
            value === t.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.icon}
          {t.label}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
        </button>
      ))}
    </div>
  );
}
