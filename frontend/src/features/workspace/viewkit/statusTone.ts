import type { BadgeProps } from '@/ui';

export type StatusVariant = NonNullable<BadgeProps['variant']>;

/**
 * Exact, case-insensitive status matches. Deliberately not substring or regex
 * matching: the previous `/done|complete|valid/i.test(status)` sniffing turned
 * "Invalid" green because it contains "valid".
 */
const SUCCESS = new Set(['done', 'complete', 'completed', 'shipped', 'closed', 'paid', 'active', 'online', 'received', 'resolved', 'valid', 'healthy', 'passed', 'archived']);
const WARNING = new Set(['due', 'due soon', 'at risk', 'degraded', 'waiting', 'blocked', 'pending', 'review', 'in review', 'ordered', 'paused', 'idea', 'planned', 'draft']);
const DANGER = new Set(['overdue', 'failed', 'fail', 'expired', 'offline', 'invalid', 'cancelled', 'canceled', 'rejected', 'critical', 'contested']);
const INFO = new Set(['in progress', 'active sprint', 'running', 'building', 'open', 'new', 'triage']);

export function statusVariant(status: string, overrides?: Record<string, StatusVariant>): StatusVariant {
  const key = status.trim().toLowerCase();
  const override = overrides?.[key] ?? overrides?.[status.trim()];
  if (override) return override;
  if (SUCCESS.has(key)) return 'success';
  if (DANGER.has(key)) return 'destructive';
  if (WARNING.has(key)) return 'warning';
  if (INFO.has(key)) return 'info';
  return 'outline';
}
