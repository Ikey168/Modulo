// Planner (#370) — daily/weekly planning over dated journal notes. A day's
// note is the note whose title is the ISO date (`2026-07-21`); the planner
// derives everything from note titles and bodies, so there is no extra
// storage. Carry-over copies yesterday's unchecked items into today's note and
// never mutates the source.

import type { CoreNote } from '@modulo/core';

export const DAILY_TITLE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export function isDailyTitle(title: string): boolean {
  return DAILY_TITLE_RE.test(title.trim());
}

export function findDailyNote(notes: CoreNote[], date: string): CoreNote | undefined {
  return notes.find((n) => n.title.trim() === date);
}

export function dailyTemplate(date: string): string {
  return `## Plan — ${date}

- [ ]

## Notes

`;
}

/** Unchecked `- [ ]` items in a body, with the checkbox marker stripped. */
export function uncheckedItems(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split('\n')) {
    const m = /^\s*[-*]\s+\[ \]\s+(.*)$/.exec(line);
    if (m && m[1].trim() !== '') out.push(m[1].trim());
  }
  return out;
}

/** Markdown block appending carried-over items to a day note. */
export function carryOverBlock(items: string[], fromDate: string): string {
  return `\n## Carried over from ${fromDate}\n\n${items.map((i) => `- [ ] ${i}`).join('\n')}\n`;
}

/** Date arithmetic in UTC to avoid DST surprises. */
export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDate(d);
}

/** Monday-first week containing the given date. */
export function weekOf(date: string): string[] {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const monday = addDays(date, day === 0 ? -6 : 1 - day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** First markdown heading or non-empty line, as the day's headline. */
export function headlineOf(body: string): string | null {
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (t === '') continue;
    const h = /^#{1,6}\s+(.*)$/.exec(t);
    return h ? h[1] : t.length > 60 ? `${t.slice(0, 60)}…` : t;
  }
  return null;
}
