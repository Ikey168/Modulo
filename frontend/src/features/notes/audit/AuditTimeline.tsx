import React, { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui';
import { auditApi, AuditEventRecord, AuditFilter } from './auditApi';

interface Props {
  noteId?: number;
  userId: string;
  isAdmin?: boolean;
}

const EVENT_ICONS: Record<string, string> = {
  NOTE_READ:      '👁️',
  NOTE_CREATE:    '📝',
  NOTE_UPDATE:    '✏️',
  NOTE_DELETE:    '🗑️',
  SHARE_CREATED:  '🔗',
  SHARE_VIEWED:   '👁️',
  SHARE_REVOKED:  '✕',
};

const OUTCOME_COLORS: Record<string, string> = {
  ALLOW:   '#22c55e',
  SUCCESS: '#22c55e',
  DENY:    '#ef4444',
  FAILURE: '#ef4444',
  ERROR:   '#f59e0b',
};

const EVENT_TYPES = ['NOTE_READ', 'NOTE_CREATE', 'NOTE_UPDATE', 'NOTE_DELETE', 'SHARE_CREATED', 'SHARE_VIEWED', 'SHARE_REVOKED'];

/** Radix SelectItem forbids value=""; sentinel maps to undefined (= no event-type filter). */
const ALL_EVENTS = 'all';

const AuditTimeline: React.FC<Props> = ({ noteId, userId, isAdmin = false }) => {
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [filter, setFilter] = useState<AuditFilter>({
    noteId,
    eventType: undefined,
    from: undefined,
    to: undefined,
    page: 0,
    size: 50,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await auditApi.query({ ...filter, noteId }, userId);
      setEvents(result.content);
      setTotal(result.totalElements);
    } catch {
      setError('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [filter, noteId, userId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  return (
    <div className="mt-4">
      <Button
        variant={open ? 'secondary' : 'outline'}
        size="sm"
        onClick={() => setOpen(v => !v)}
      >
        <Clock className="size-3.5" />
        Access history
      </Button>

      {open && (
        <div className="mt-2 animate-fade-in rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-semibold text-subtle-foreground">Event type</Label>
              <Select
                value={filter.eventType ?? ALL_EVENTS}
                onValueChange={val => setFilter(p => ({ ...p, eventType: val === ALL_EVENTS ? undefined : val, page: 0 }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_EVENTS}>All events</SelectItem>
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] font-semibold text-subtle-foreground">User ID</Label>
                <Input
                  value={filter.userId ?? ''}
                  onChange={e => setFilter(p => ({ ...p, userId: e.target.value || undefined, page: 0 }))}
                  placeholder="Any user"
                  className="h-8 w-[120px] text-xs"
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-semibold text-subtle-foreground">From</Label>
              <Input
                type="datetime-local"
                value={filter.from?.slice(0, 16) ?? ''}
                onChange={e => setFilter(p => ({ ...p, from: e.target.value ? new Date(e.target.value).toISOString() : undefined, page: 0 }))}
                className="h-8 text-xs [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-semibold text-subtle-foreground">To</Label>
              <Input
                type="datetime-local"
                value={filter.to?.slice(0, 16) ?? ''}
                onChange={e => setFilter(p => ({ ...p, to: e.target.value ? new Date(e.target.value).toISOString() : undefined, page: 0 }))}
                className="h-8 text-xs [color-scheme:dark]"
              />
            </div>
            <Button size="sm" onClick={load}>
              Refresh
            </Button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

          {!loading && events.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              No audit events found.
            </p>
          )}

          {!loading && events.length > 0 && (
            <>
              <p className="mb-2 mt-0 text-[11px] text-muted-foreground">
                Showing {events.length} of {total} events
              </p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {events.map(e => (
                  <li
                    key={e.id}
                    className="flex items-center gap-2.5 rounded-md bg-surface-2 px-2.5 py-2 text-[13px]"
                  >
                    <span className="w-[22px] shrink-0 text-center text-base">
                      {EVENT_ICONS[e.eventType] ?? '📋'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{e.eventType.replace(/_/g, ' ')}</span>
                      {e.userId && <span className="ml-1.5 text-muted-foreground">by {e.userName ?? e.userId}</span>}
                      {e.ipAddress && <span className="ml-1.5 text-[11px] text-muted-foreground">from {e.ipAddress}</span>}
                    </div>
                    {e.outcome && (
                      <span className="shrink-0 text-[11px] font-semibold" style={{ color: OUTCOME_COLORS[e.outcome] ?? '#71717a' }}>
                        {e.outcome}
                      </span>
                    )}
                    <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
              {total > events.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setFilter(p => ({ ...p, page: (p.page ?? 0) + 1 }))}
                >
                  Load more
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditTimeline;
