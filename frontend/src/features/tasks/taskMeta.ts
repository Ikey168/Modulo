/**
 * Centralized status/priority presentation for the tasks feature.
 *
 * Every surface (TaskList badges, CalendarView chips, the calendar legend)
 * derives its label + tone from these maps so the feature stays consistent
 * and theme-aware. Tones use design-system tokens only — a `/15` background
 * with the tone's `text-*` foreground keeps chips readable in both themes
 * (no white-on-solid contrast failures), never hardcoded hex colors.
 */
import type { BadgeProps } from '@/ui';
import type { TaskPriority, TaskStatus } from './types';

export interface TaskMeta {
  /** Human-readable label, e.g. "In Progress". */
  label: string;
  /** Variant fed straight into `<Badge variant={…}>`. */
  badgeVariant: BadgeProps['variant'];
  /** Chip tone: token `/15` background + tone text + `/30` border. */
  chipClass: string;
  /** Solid tone swatch for legends and small indicators. */
  dotClass: string;
}

export const STATUS_META: Record<TaskStatus, TaskMeta> = {
  TODO: {
    label: 'To Do',
    badgeVariant: 'outline',
    chipClass: 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25',
    dotClass: 'bg-primary',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    badgeVariant: 'warning',
    chipClass: 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/25',
    dotClass: 'bg-warning',
  },
  COMPLETED: {
    label: 'Completed',
    badgeVariant: 'success',
    chipClass: 'bg-success/15 text-success border-success/30 hover:bg-success/25',
    dotClass: 'bg-success',
  },
  BLOCKED: {
    label: 'Blocked',
    badgeVariant: 'destructive',
    chipClass: 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25',
    dotClass: 'bg-destructive',
  },
  ON_HOLD: {
    label: 'On Hold',
    badgeVariant: 'info',
    chipClass: 'bg-info/15 text-info border-info/30 hover:bg-info/25',
    dotClass: 'bg-info',
  },
  CANCELLED: {
    label: 'Cancelled',
    badgeVariant: 'secondary',
    chipClass:
      'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30 hover:bg-muted-foreground/25',
    dotClass: 'bg-muted-foreground',
  },
};

export const PRIORITY_META: Record<TaskPriority, TaskMeta> = {
  URGENT: {
    label: 'Urgent',
    badgeVariant: 'destructive',
    chipClass: 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25',
    dotClass: 'bg-destructive',
  },
  HIGH: {
    label: 'High',
    badgeVariant: 'warning',
    chipClass: 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/25',
    dotClass: 'bg-warning',
  },
  MEDIUM: {
    label: 'Medium',
    badgeVariant: 'info',
    chipClass: 'bg-info/15 text-info border-info/30 hover:bg-info/25',
    dotClass: 'bg-info',
  },
  LOW: {
    label: 'Low',
    badgeVariant: 'success',
    chipClass: 'bg-success/15 text-success border-success/30 hover:bg-success/25',
    dotClass: 'bg-success',
  },
};

/** Display order for legends / filters (matches the map declaration order). */
export const STATUS_KEYS = Object.keys(STATUS_META) as TaskStatus[];
export const PRIORITY_KEYS = Object.keys(PRIORITY_META) as TaskPriority[];

/** Safe accessors — fall back to a sane default if the API sends an unknown value. */
export function getStatusMeta(status: TaskStatus): TaskMeta {
  return STATUS_META[status] ?? STATUS_META.TODO;
}

export function getPriorityMeta(priority: TaskPriority): TaskMeta {
  return PRIORITY_META[priority] ?? PRIORITY_META.MEDIUM;
}
