import React, { useState, useEffect, useCallback } from 'react';
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
  ALLOW:   '#16a34a',
  SUCCESS: '#16a34a',
  DENY:    '#ef4444',
  FAILURE: '#ef4444',
  ERROR:   '#f97316',
};

const EVENT_TYPES = ['NOTE_READ', 'NOTE_CREATE', 'NOTE_UPDATE', 'NOTE_DELETE', 'SHARE_CREATED', 'SHARE_VIEWED', 'SHARE_REVOKED'];

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
    <div style={{ marginTop: '16px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '5px 12px',
          fontSize: '12px',
          background: open ? 'var(--color-primary-subtle, #eff6ff)' : 'var(--color-surface-raised, #f3f4f6)',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        🕒 Access history
      </button>

      {open && (
        <div style={{ marginTop: '8px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '8px', padding: '16px', background: 'var(--color-surface, #fff)' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>Event type</label>
              <select
                value={filter.eventType ?? ''}
                onChange={e => setFilter(p => ({ ...p, eventType: e.target.value || undefined, page: 0 }))}
                style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '4px' }}
              >
                <option value="">All events</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>User ID</label>
                <input
                  value={filter.userId ?? ''}
                  onChange={e => setFilter(p => ({ ...p, userId: e.target.value || undefined, page: 0 }))}
                  placeholder="Any user"
                  style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '4px', width: '120px' }}
                />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>From</label>
              <input
                type="datetime-local"
                value={filter.from?.slice(0, 16) ?? ''}
                onChange={e => setFilter(p => ({ ...p, from: e.target.value ? new Date(e.target.value).toISOString() : undefined, page: 0 }))}
                style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>To</label>
              <input
                type="datetime-local"
                value={filter.to?.slice(0, 16) ?? ''}
                onChange={e => setFilter(p => ({ ...p, to: e.target.value ? new Date(e.target.value).toISOString() : undefined, page: 0 }))}
                style={{ padding: '5px 8px', fontSize: '12px', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '4px' }}
              />
            </div>
            <button
              onClick={load}
              style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--color-primary, #3b82f6)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Refresh
            </button>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '12px' }}>{error}</p>}
          {loading && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)' }}>Loading…</p>}

          {!loading && events.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #6b7280)', textAlign: 'center', padding: '24px 0' }}>
              No audit events found.
            </p>
          )}

          {!loading && events.length > 0 && (
            <>
              <p style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', margin: '0 0 8px' }}>
                Showing {events.length} of {total} events
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {events.map(e => (
                  <li key={e.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--color-surface-raised, #f9fafb)',
                    fontSize: '13px',
                  }}>
                    <span style={{ fontSize: '16px', width: '22px', textAlign: 'center', flexShrink: 0 }}>
                      {EVENT_ICONS[e.eventType] ?? '📋'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 500 }}>{e.eventType.replace(/_/g, ' ')}</span>
                      {e.userId && <span style={{ color: 'var(--color-text-secondary, #6b7280)', marginLeft: '6px' }}>by {e.userName ?? e.userId}</span>}
                      {e.ipAddress && <span style={{ color: 'var(--color-text-secondary, #6b7280)', marginLeft: '6px', fontSize: '11px' }}>from {e.ipAddress}</span>}
                    </div>
                    {e.outcome && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: OUTCOME_COLORS[e.outcome] ?? '#6b7280', flexShrink: 0 }}>
                        {e.outcome}
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
              {total > events.length && (
                <button
                  onClick={() => setFilter(p => ({ ...p, page: (p.page ?? 0) + 1 }))}
                  style={{ marginTop: '8px', padding: '5px 12px', fontSize: '12px', background: 'var(--color-surface-raised, #f3f4f6)', border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Load more
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditTimeline;
