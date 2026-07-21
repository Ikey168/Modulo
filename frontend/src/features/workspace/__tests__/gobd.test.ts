import { beforeEach, describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import {
  DEFAULT_RETENTION_CLASSES,
  readRetentionClasses,
  retentionEnd,
  vaultEntries,
  VERFAHRENSDOKUMENTATION_TEMPLATE,
  writeRetentionClasses,
} from '../gobd';

const note = (id: number, tags: string[], createdAt?: string, anchored = false): CoreNote => ({
  id,
  title: `Note ${id}`,
  content: '',
  tags: tags.map((name) => ({ id: `t-${name}`, name })),
  createdAt,
  isOnBlockchain: anchored,
});

beforeEach(() => localStorage.clear());

describe('retentionEnd', () => {
  it('runs to the end of the calendar year plus the period', () => {
    expect(retentionEnd('2026-07-21', 8)).toBe('2034-12-31');
    expect(retentionEnd('2026-01-01', 10)).toBe('2036-12-31');
  });
});

describe('vaultEntries', () => {
  const today = '2026-07-21';

  it('tracks retained notes with class, dates, anchor status; sorted by expiry', () => {
    const notes = [
      note(1, ['retain/buecher'], '2026-03-01T10:00:00Z', true),
      note(2, ['retain/belege', 'engagement/x'], '2026-01-15T09:00:00Z'),
      note(3, ['unrelated']),
    ];
    const entries = vaultEntries(notes, DEFAULT_RETENTION_CLASSES, today);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ noteId: 2, classId: 'belege', docDate: '2026-01-15', retainUntil: '2034-12-31', anchored: false, expired: false });
    expect(entries[1]).toMatchObject({ noteId: 1, classId: 'buecher', retainUntil: '2036-12-31', anchored: true });
  });

  it('flags expired retention and defaults unknown classes to 10 years', () => {
    const entries = vaultEntries([note(1, ['retain/custom'], '2010-05-01T00:00:00Z')], DEFAULT_RETENTION_CLASSES, today);
    expect(entries[0].years).toBe(10);
    expect(entries[0].retainUntil).toBe('2020-12-31');
    expect(entries[0].expired).toBe(true);
  });
});

describe('class persistence', () => {
  it('round-trips edited periods and falls back to defaults on corrupt data', () => {
    expect(readRetentionClasses()).toEqual(DEFAULT_RETENTION_CLASSES);
    const edited = DEFAULT_RETENTION_CLASSES.map((c) => (c.id === 'belege' ? { ...c, years: 10 } : c));
    writeRetentionClasses(edited);
    expect(readRetentionClasses().find((c) => c.id === 'belege')?.years).toBe(10);
    localStorage.setItem('modulo-gobd-classes', '[]');
    expect(readRetentionClasses()).toEqual(DEFAULT_RETENTION_CLASSES);
  });
});

describe('Verfahrensdokumentation template', () => {
  it('covers capture, integrity, retention, export, access', () => {
    for (const section of ['Erfassung', 'Unveränderbarkeit', 'Aufbewahrung', 'Export', 'Access']) {
      expect(VERFAHRENSDOKUMENTATION_TEMPLATE).toContain(section);
    }
  });
});
