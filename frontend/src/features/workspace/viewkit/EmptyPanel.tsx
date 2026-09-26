import { type ComponentType, type ReactNode } from 'react';
import { Button, EmptyState, cn } from '@/ui';

export interface EmptyPanelProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  /** A zero-state the user can act on should offer the action. */
  action?: ReactNode;
  /** Filtered lists offer the same recovery action throughout the workspace. */
  onReset?: () => void;
  /** `panel` sits inside a bordered section; `page` fills the view body. */
  size?: 'panel' | 'page';
  className?: string;
}

/**
 * Zero-state built on the design system's `EmptyState`.
 *
 * Replaces the eleven private `Empty` helpers — dashed boxes or bare grey
 * sentences with no icon and no call to action — and makes the difference
 * between "nothing yet" and "nothing matches the filter" expressible.
 */
export function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
  onReset,
  size = 'panel',
  className,
}: EmptyPanelProps) {
  return (
    <EmptyState
      icon={Icon ? <Icon className="size-5" /> : undefined}
      title={title}
      description={description}
      action={
        action ??
        (onReset ? (
          <Button type="button" size="sm" variant="outline" onClick={onReset}>
            Clear filters
          </Button>
        ) : undefined)
      }
      className={cn(
        '[&>div]:mb-2 [&>div]:size-8 [&>div]:rounded-sm [&>div]:bg-transparent [&>div_svg]:size-4',
        // Inside a panel the zero state is one item among rows, so it aligns
        // with them. Filling a whole view it is the only thing on screen, and
        // left-aligning strands it in the corner.
        size === 'panel'
          ? 'items-start px-3 py-8 text-left [&>div]:justify-start'
          : 'min-h-[46vh] items-center justify-center px-4 py-12 text-center',
        className,
      )}
    />
  );
}
