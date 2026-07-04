import { describe, expect, it } from 'vitest';
import type { CoreNote } from '@modulo/core';
import {
  dayKey,
  groupByPeriod,
  monthGrid,
  noteDate,
  periodKey,
  sameDay,
  startOfWeek,
  weekGrid,
} from '../noteDates';

const note = (id: number, updatedAt?: string, createdAt?: string): CoreNote => ({
  id,
  title: `Note ${id}`,
  content: '',
  tags: [],
  updatedAt,
  createdAt,
});

describe('noteDates - date helpers', () => {
  it('reads the chosen field and falls back to the other', () => {
    expect(noteDate(note(1, '2026-01-05T10:00:00Z'), 'updatedAt')?.getFullYear()).toBe(2026);
    expect(noteDate(note(1, undefined, '2026-02-01T00:00:00Z'), 'updatedAt')?.getMonth()).toBe(1);
    expect(noteDate(note(1), 'updatedAt')).toBeNull();
    expect(noteDate({ ...note(1), updatedAt: 'not-a-date' }, 'updatedAt')).toBeNull();
  });

  it('dayKey and sameDay agree', () => {
    const a = new Date(2026, 0, 5, 9);
    const b = new Date(2026, 0, 5, 23);
    expect(dayKey(a)).toBe('2026-01-05');
    expect(sameDay(a, b)).toBe(true);
    expect(sameDay(a, new Date(2026, 0, 6))).toBe(false);
  });

  it('startOfWeek returns the Monday of the week', () => {
    // 2026-01-07 is a Wednesday; its Monday is 2026-01-05.
    expect(dayKey(startOfWeek(new Date(2026, 0, 7)))).toBe('2026-01-05');
  });

  it('monthGrid covers 42 days starting on a Monday and includes the month', () => {
    const grid = monthGrid(2026, 0); // January 2026
    expect(grid).toHaveLength(42);
    expect(grid[0].getDay()).toBe(1); // Monday
    expect(grid.some((d) => d.getMonth() === 0 && d.getDate() === 1)).toBe(true);
    expect(grid.some((d) => d.getMonth() === 0 && d.getDate() === 31)).toBe(true);
  });

  it('weekGrid returns 7 consecutive days', () => {
    const week = weekGrid(new Date(2026, 0, 7));
    expect(week).toHaveLength(7);
    expect(dayKey(week[0])).toBe('2026-01-05');
    expect(dayKey(week[6])).toBe('2026-01-11');
  });
});

describe('noteDates - grouping', () => {
  it('groups by day, newest group first, dropping dateless notes', () => {
    const notes = [
      note(1, '2026-01-05T10:00:00Z'),
      note(2, '2026-01-05T12:00:00Z'),
      note(3, '2026-01-06T09:00:00Z'),
      note(4), // no date -> dropped
    ];
    const groups = groupByPeriod(notes, 'updatedAt', 'day');
    expect(groups).toHaveLength(2);
    expect(groups[0].date.getTime()).toBeGreaterThan(groups[1].date.getTime());
    // Within the Jan 5 group, the later note comes first.
    const jan5 = groups.find((g) => g.key === periodKey(new Date(2026, 0, 5), 'day'))!;
    expect(jan5.notes.map((n) => n.id)).toEqual([2, 1]);
  });

  it('collapses a month into a single group', () => {
    const notes = [note(1, '2026-03-02T00:00:00Z'), note(2, '2026-03-20T00:00:00Z')];
    const groups = groupByPeriod(notes, 'updatedAt', 'month');
    expect(groups).toHaveLength(1);
    expect(groups[0].notes).toHaveLength(2);
    expect(groups[0].label).toContain('March');
  });
});
