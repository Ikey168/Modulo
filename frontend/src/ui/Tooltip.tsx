import { type ReactNode } from 'react';
import { cn } from './cn';

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
  left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
  right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
};

/** CSS-only hover/focus tooltip (no positioning library). */
export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border-strong bg-popover px-2 py-1 ' +
            'text-xxs font-medium text-foreground opacity-0 shadow-md transition-opacity duration-100 ' +
            'group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          sideClasses[side],
          className,
        )}
      >
        {label}
      </span>
    </span>
  );
}
