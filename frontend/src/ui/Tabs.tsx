import { type ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
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

/**
 * shadcn/ui-style tab bar on Radix Tabs (keyboard nav + a11y). Keeps the
 * project's controlled items/value/onChange API; screens render their own
 * panels based on `value`.
 */
export function Tabs({ items, value, onChange, className, variant = 'underline' }: TabsProps) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange}>
      {variant === 'pills' ? (
        <TabsPrimitive.List className={cn('inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1', className)}>
          {items.map((t) => (
            <TabsPrimitive.Trigger
              key={t.value}
              value={t.value}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors [&_svg]:size-4',
                'text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'data-[state=active]:bg-surface-3 data-[state=active]:text-foreground data-[state=active]:shadow-xs',
              )}
            >
              {t.icon}
              {t.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
      ) : (
        <TabsPrimitive.List className={cn('flex items-center gap-1 border-b border-border', className)}>
          {items.map((t) => (
            <TabsPrimitive.Trigger
              key={t.value}
              value={t.value}
              className={cn(
                'relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors [&_svg]:size-4',
                'text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'data-[state=active]:text-foreground',
                'data-[state=active]:after:absolute data-[state=active]:after:inset-x-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary',
              )}
            >
              {t.icon}
              {t.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
      )}
    </TabsPrimitive.Root>
  );
}
