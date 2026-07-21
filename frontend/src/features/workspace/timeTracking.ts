// Zeiterfassung (#365) — billable time per engagement, feeding invoice line
// items. Entries persist client-side (consistent with plugin install state and
// canvas layout); a backend store can replace this later. Pure module so
// aggregation and the billing handoff are unit-testable.

export interface TimeEntry {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  /** Bare engagement name (no `engagement/` prefix); '' = unassigned. */
  engagement: string;
  description: string;
  minutes: number;
  /** Hourly rate in EUR; 0 = non-billable/fixed-fee logging. */
  rateEur: number;
  billable: boolean;
  billed: boolean;
}

const STORE_KEY = 'modulo-time-entries';

export function readEntries(): TimeEntry[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is TimeEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as TimeEntry).id === 'string' &&
        typeof (e as TimeEntry).minutes === 'number',
    );
  } catch {
    return [];
  }
}

export function writeEntries(entries: TimeEntry[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable — entries live for the session only.
  }
}

export function newEntryId(): string {
  return `te-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Aggregation ──────────────────────────────────────────────────────────────

export interface EngagementSummary {
  engagement: string;
  minutes: number;
  billableUnbilledMinutes: number;
  /** EUR value of billable, unbilled minutes. */
  unbilledEur: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const entryAmountEur = (e: TimeEntry): number => round2((e.minutes / 60) * e.rateEur);

export function summarizeByEngagement(entries: TimeEntry[]): EngagementSummary[] {
  const map = new Map<string, EngagementSummary>();
  for (const e of entries) {
    const key = e.engagement || '(unassigned)';
    const s = map.get(key) ?? { engagement: key, minutes: 0, billableUnbilledMinutes: 0, unbilledEur: 0 };
    s.minutes += e.minutes;
    if (e.billable && !e.billed) {
      s.billableUnbilledMinutes += e.minutes;
      s.unbilledEur = round2(s.unbilledEur + entryAmountEur(e));
    }
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => a.engagement.localeCompare(b.engagement));
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

// ── Billing handoff ──────────────────────────────────────────────────────────

/** Billable, unbilled entries of one engagement. */
export function unbilledFor(entries: TimeEntry[], engagement: string): TimeEntry[] {
  return entries.filter((e) => e.engagement === engagement && e.billable && !e.billed);
}

/** `line:` rows for an ```invoice fence — hours with 2 decimals, net rate. */
export function toInvoiceLines(entries: TimeEntry[]): string {
  return entries
    .map((e) => `line: ${e.description} (${e.date}) | ${(e.minutes / 60).toFixed(2)} | ${e.rateEur}`)
    .join('\n');
}

export function markBilled(entries: TimeEntry[], ids: Set<string>): TimeEntry[] {
  return entries.map((e) => (ids.has(e.id) ? { ...e, billed: true } : e));
}
