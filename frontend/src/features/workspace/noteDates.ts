// Date helpers shared by the Calendar and Timeline view plugins: extract a
// note's date, build month/week grids, and group notes into ordered period
// buckets. Pure functions so they can be unit-tested without a DOM.
import type { CoreNote } from '@modulo/core';

export type DateField = 'updatedAt' | 'createdAt';
export type Period = 'day' | 'week' | 'month';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
/** Weekday headers, Monday first (matches the Monday-start grids below). */
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The chosen timestamp for a note, falling back to the other date if missing. */
export function noteDate(note: CoreNote, field: DateField): Date | null {
  const iso = note[field] ?? (field === 'updatedAt' ? note.createdAt : note.updatedAt);
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Local-time 'YYYY-MM-DD' key. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Start-of-week date (Monday by default) for the week containing `d`. */
export function startOfWeek(d: Date, weekStartsOn = 1): Date {
  const offset = (d.getDay() - weekStartsOn + 7) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
}

/** 42 days (6 weeks) covering `month`, including leading and trailing days. */
export function monthGrid(year: number, month: number, weekStartsOn = 1): Date[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** The 7 days of the week containing `date`. */
export function weekGrid(date: Date, weekStartsOn = 1): Date[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export interface PeriodGroup {
  key: string;
  label: string;
  /** Start-of-period date, used to order groups. */
  date: Date;
  notes: CoreNote[];
}

export function periodKey(d: Date, period: Period): string {
  if (period === 'day') return `d:${dayKey(d)}`;
  if (period === 'week') return `w:${dayKey(startOfWeek(d))}`;
  return `m:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function periodLabel(d: Date, period: Period): string {
  if (period === 'day') return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
  if (period === 'week') {
    const s = startOfWeek(d);
    return `Week of ${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getDate()}, ${s.getFullYear()}`;
  }
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function periodStart(d: Date, period: Period): Date {
  if (period === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === 'week') return startOfWeek(d);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Group notes into period buckets, newest first, with notes newest first
 *  inside each bucket. Notes without a usable date are dropped. */
export function groupByPeriod(notes: CoreNote[], field: DateField, period: Period): PeriodGroup[] {
  const map = new Map<string, PeriodGroup>();
  for (const n of notes) {
    const d = noteDate(n, field);
    if (!d) continue;
    const key = periodKey(d, period);
    const group = map.get(key);
    if (group) group.notes.push(n);
    else map.set(key, { key, label: periodLabel(d, period), date: periodStart(d, period), notes: [n] });
  }
  const groups = [...map.values()];
  groups.sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const g of groups) {
    g.notes.sort((a, b) => (noteDate(b, field)?.getTime() ?? 0) - (noteDate(a, field)?.getTime() ?? 0));
  }
  return groups;
}
