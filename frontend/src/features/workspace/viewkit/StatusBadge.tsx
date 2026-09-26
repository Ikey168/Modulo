import { Badge, cn } from '@/ui';
import { statusVariant, type StatusVariant } from './statusTone';

export interface StatusBadgeProps {
  status: string;
  /** Statuses this collection treats as complete. Takes priority over the defaults. */
  completedStatuses?: readonly string[];
  /** Explicit status → variant map for domain vocabulary the defaults do not cover. */
  overrides?: Record<string, StatusVariant>;
  className?: string;
}

/**
 * Status pill. Replaces the hand-rolled
 * `rounded-full bg-muted px-2 py-0.5 text-[11px]` spans — which were `Badge`
 * reimplemented badly, at an arbitrary size that the `text-xxs` token already
 * defines — and the raw-palette amber/emerald pairs that ignored the theme.
 */
export function StatusBadge({ status, completedStatuses, overrides, className }: StatusBadgeProps) {
  if (!status) return null;
  const complete = completedStatuses?.some((value) => value.toLowerCase() === status.trim().toLowerCase());
  const variant = complete ? 'success' : statusVariant(status, overrides);
  return (
    <Badge variant={variant} className={cn('shrink-0 rounded-sm bg-transparent', className)}>
      {status}
    </Badge>
  );
}
