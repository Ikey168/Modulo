import { beforeEach, describe, expect, it } from 'vitest';
import {
  emptyRoutines,
  habitCount,
  habitStreak,
  habitsOn,
  occursOn,
  parseRoutines,
  routineDone,
  routinesOn,
  setHabitCount,
  setRoutineDone,
  type Habit,
} from '../routines';

beforeEach(() => localStorage.clear());

describe('routines and habits store', () => {
  it('normalizes records and rejects invalid day blocks', () => {
    const parsed = parseRoutines({
      routines: [
        { id: 'r1', title: 'Morning reset', blockId: 'morning-prime', recurrence: { mode: 'Custom', daysOfWeek: [1, 1, 8, '3'] }, durationMinutes: -2 },
        { id: 'bad', title: 'Nowhere', blockId: 'nope' },
      ],
      habits: [{ id: 'h1', title: 'Water', blockId: 'reset', recurrence: { mode: 'Unknown' }, target: 0 }],
    });
    expect(parsed.routines).toHaveLength(1);
    expect(parsed.routines[0]).toMatchObject({ id: 'r1', active: true, recurrence: { mode: 'Custom', daysOfWeek: [1, 3] } });
    expect(parsed.routines[0].durationMinutes).toBeUndefined();
    expect(parsed.habits[0]).toMatchObject({ target: 1, recurrence: { mode: 'Daily' } });
  });

  it('evaluates common and custom schedules with date boundaries', () => {
    expect(occursOn({ mode: 'Weekdays', daysOfWeek: [] }, '2026-09-03')).toBe(true);
    expect(occursOn({ mode: 'Weekdays', daysOfWeek: [] }, '2026-09-05')).toBe(false);
    expect(occursOn({ mode: 'Weekends', daysOfWeek: [] }, '2026-09-06')).toBe(true);
    expect(occursOn({ mode: 'Custom', daysOfWeek: [2, 4] }, '2026-09-03')).toBe(true);
    expect(occursOn({ mode: 'Daily', daysOfWeek: [], startDate: '2026-09-04' }, '2026-09-03')).toBe(false);
    expect(occursOn({ mode: 'Daily', daysOfWeek: [], endDate: '2026-09-02' }, '2026-09-03')).toBe(false);
  });

  it('materializes only active scheduled items for a day', () => {
    const data = emptyRoutines();
    data.routines.push(
      { id: 'r1', title: 'Weekday routine', blockId: 'morning-prime', recurrence: { mode: 'Weekdays', daysOfWeek: [] }, active: true },
      { id: 'r2', title: 'Paused', blockId: 'reset', recurrence: { mode: 'Daily', daysOfWeek: [] }, active: false },
    );
    data.habits.push({ id: 'h1', title: 'Weekend habit', blockId: 'wind-down', recurrence: { mode: 'Weekends', daysOfWeek: [] }, target: 1, active: true });
    expect(routinesOn(data, '2026-09-03').map((item) => item.id)).toEqual(['r1']);
    expect(habitsOn(data, '2026-09-03')).toEqual([]);
  });

  it('stores routine completion and habit counts without duplicate daily records', () => {
    let data = emptyRoutines();
    data = setRoutineDone(data, 'r1', '2026-09-03', true);
    data = setRoutineDone(data, 'r1', '2026-09-03', true);
    expect(routineDone(data, 'r1', '2026-09-03')).toBe(true);
    expect(data.routineCompletions).toHaveLength(1);
    data = setRoutineDone(data, 'r1', '2026-09-03', false);
    expect(routineDone(data, 'r1', '2026-09-03')).toBe(false);

    data = setHabitCount(data, 'h1', '2026-09-03', 3);
    data = setHabitCount(data, 'h1', '2026-09-03', 4);
    expect(habitCount(data, 'h1', '2026-09-03')).toBe(4);
    expect(data.habitCheckIns).toHaveLength(1);
  });

  it('calculates streaks across scheduled days only', () => {
    const habit: Habit = { id: 'h1', title: 'Read', blockId: 'wind-down', recurrence: { mode: 'Weekdays', daysOfWeek: [] }, target: 2, active: true };
    let data = emptyRoutines();
    data.habits.push(habit);
    data = setHabitCount(data, habit.id, '2026-09-03', 2);
    data = setHabitCount(data, habit.id, '2026-09-04', 3);
    expect(habitStreak(data, habit, '2026-09-06')).toBe(2);
  });

  it('persists independently and recovers from corrupt storage', () => {
    const data = emptyRoutines();
    data.routines.push({ id: 'r1', title: 'Shutdown', blockId: 'wind-down', recurrence: { mode: 'Daily', daysOfWeek: [] }, active: true });
    expect(parseRoutines(JSON.parse(JSON.stringify(data))).routines[0].title).toBe('Shutdown');
    expect(parseRoutines('{bad')).toEqual(emptyRoutines());
  });
});
