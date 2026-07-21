import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import {
  addDays,
  carryOverBlock,
  findDailyNote,
  headlineOf,
  isDailyTitle,
  uncheckedItems,
  weekOf,
} from '../planner';

const note = (id: number, title: string, content = ''): CoreNote => ({ id, title, content, tags: [] });

describe('daily titles', () => {
  it('matches ISO dates only', () => {
    expect(isDailyTitle('2026-07-21')).toBe(true);
    expect(isDailyTitle(' 2026-07-21 ')).toBe(true);
    expect(isDailyTitle('21.07.2026')).toBe(false);
    expect(isDailyTitle('2026-07-21 extra')).toBe(false);
  });

  it('finds a day note by trimmed title', () => {
    const notes = [note(1, 'Other'), note(2, '2026-07-21')];
    expect(findDailyNote(notes, '2026-07-21')?.id).toBe(2);
    expect(findDailyNote(notes, '2026-07-22')).toBeUndefined();
  });
});

describe('unchecked items and carry-over', () => {
  it('extracts unchecked items, ignoring checked and empty ones', () => {
    const body = '- [ ] alpha\n- [x] done\n* [ ] beta\n- [ ]   \nprose';
    expect(uncheckedItems(body)).toEqual(['alpha', 'beta']);
  });

  it('builds a copy block referencing the source day', () => {
    const block = carryOverBlock(['alpha', 'beta'], '2026-07-20');
    expect(block).toContain('## Carried over from 2026-07-20');
    expect(block).toContain('- [ ] alpha');
    expect(block).toContain('- [ ] beta');
  });
});

describe('date math', () => {
  it('adds days across month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('builds a Monday-first week for any weekday', () => {
    // 2026-07-21 is a Tuesday.
    const week = weekOf('2026-07-21');
    expect(week[0]).toBe('2026-07-20');
    expect(week[6]).toBe('2026-07-26');
    // Sunday belongs to the week that started the previous Monday.
    expect(weekOf('2026-07-26')[0]).toBe('2026-07-20');
  });
});

describe('headlineOf', () => {
  it('prefers the first heading, falls back to the first line, truncates long lines', () => {
    expect(headlineOf('\n## Plan\ntext')).toBe('Plan');
    expect(headlineOf('just a line')).toBe('just a line');
    expect(headlineOf('x'.repeat(80))!.endsWith('…')).toBe(true);
    expect(headlineOf('   \n\n')).toBeNull();
  });
});
