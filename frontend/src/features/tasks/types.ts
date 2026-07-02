/**
 * Canonical task model for the tasks feature.
 *
 * Single source of truth — previously each component carried its own drifted
 * copy of this interface. This is the superset of every field the API returns
 * or accepts; fields not present in every payload are optional.
 */

export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'BLOCKED'
  | 'ON_HOLD';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  startDate?: string;
  completionDate?: string;
  estimatedDurationMinutes?: number;
  progressPercentage: number;
  isOverdue?: boolean;
  isDueToday?: boolean;
  linkedNotes?: unknown[];
  tags?: string;
  googleCalendarEventId?: string;
  syncWithGoogleCalendar?: boolean;
}

/**
 * Form-side shape: identical to `Task` except `id` is absent until the task
 * has been persisted (create flow).
 */
export type TaskDraft = Omit<Task, 'id'> & { id?: number };
