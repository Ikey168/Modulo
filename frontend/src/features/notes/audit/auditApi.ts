export interface AuditEventRecord {
  id: number;
  eventType: string;
  noteId: number | null;
  userId: string | null;
  userName: string | null;
  outcome: string | null;
  ipAddress: string | null;
  detail: string | null;
  createdAt: string;
}

export interface AuditPage {
  content: AuditEventRecord[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface AuditFilter {
  noteId?: number;
  userId?: string;
  eventType?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export const auditApi = {
  async query(filter: AuditFilter, requesterId: string): Promise<AuditPage> {
    const params = new URLSearchParams();
    if (filter.noteId)    params.set('noteId', String(filter.noteId));
    if (filter.userId)    params.set('userId', filter.userId);
    if (filter.eventType) params.set('eventType', filter.eventType);
    if (filter.from)      params.set('from', filter.from);
    if (filter.to)        params.set('to', filter.to);
    params.set('page', String(filter.page ?? 0));
    params.set('size', String(filter.size ?? 50));

    const res = await fetch(`/api/audit?${params}`, {
      headers: { 'X-User-Id': requesterId },
    });
    if (!res.ok) throw new Error('Failed to load audit log');
    return res.json();
  },
};
