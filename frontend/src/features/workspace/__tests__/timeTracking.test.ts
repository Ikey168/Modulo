import { beforeEach, describe, expect, it } from 'vitest';
import {
  entryAmountEur,
  formatMinutes,
  markBilled,
  readEntries,
  summarizeByEngagement,
  toInvoiceLines,
  unbilledFor,
  writeEntries,
  type TimeEntry,
} from '../timeTracking';

const entry = (id: string, over: Partial<TimeEntry> = {}): TimeEntry => ({
  id,
  date: '2026-07-21',
  engagement: 'acme-vault',
  description: 'Review',
  minutes: 90,
  rateEur: 150,
  billable: true,
  billed: false,
  ...over,
});

beforeEach(() => localStorage.clear());

describe('persistence', () => {
  it('round-trips entries and survives corrupt storage', () => {
    writeEntries([entry('a')]);
    expect(readEntries()).toHaveLength(1);
    localStorage.setItem('modulo-time-entries', '{ nope');
    expect(readEntries()).toEqual([]);
    localStorage.setItem('modulo-time-entries', JSON.stringify([{ bad: true }, entry('ok')]));
    expect(readEntries().map((e) => e.id)).toEqual(['ok']);
  });
});

describe('aggregation', () => {
  it('computes amounts and per-engagement summaries', () => {
    expect(entryAmountEur(entry('a'))).toBe(225);
    const s = summarizeByEngagement([
      entry('a'),
      entry('b', { minutes: 30, billed: true }),
      entry('c', { engagement: 'beta', billable: false, rateEur: 0 }),
      entry('d', { engagement: '' }),
    ]);
    expect(s.map((x) => x.engagement)).toEqual(['(unassigned)', 'acme-vault', 'beta']);
    const acme = s.find((x) => x.engagement === 'acme-vault')!;
    expect(acme.minutes).toBe(120);
    expect(acme.billableUnbilledMinutes).toBe(90);
    expect(acme.unbilledEur).toBe(225);
  });

  it('formats minutes as h/m', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(45)).toBe('45m');
  });
});

describe('billing handoff', () => {
  it('converts unbilled entries to invoice lines and marks them billed', () => {
    const entries = [entry('a'), entry('b', { billed: true }), entry('c', { billable: false })];
    const unbilled = unbilledFor(entries, 'acme-vault');
    expect(unbilled.map((e) => e.id)).toEqual(['a']);
    expect(toInvoiceLines(unbilled)).toBe('line: Review (2026-07-21) | 1.50 | 150');
    const after = markBilled(entries, new Set(['a']));
    expect(after.find((e) => e.id === 'a')?.billed).toBe(true);
    expect(unbilledFor(after, 'acme-vault')).toEqual([]);
  });
});
