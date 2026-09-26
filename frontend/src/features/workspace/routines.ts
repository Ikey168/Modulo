import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import { addDays } from './planner';

export const ROUTINES_STORE_KEY = 'modulo-routines-habits-v1';

export const SCHEDULE_MODES = ['Daily', 'Weekdays', 'Weekends', 'Custom'] as const;
export type ScheduleMode = typeof SCHEDULE_MODES[number];

export interface Recurrence {
  mode: ScheduleMode;
  /** JavaScript weekday numbers: Sunday 0 through Saturday 6. */
  daysOfWeek: number[];
  startDate?: string;
  endDate?: string;
}

export interface Routine {
  id: string;
  title: string;
  blockId: DayBlockId;
  recurrence: Recurrence;
  durationMinutes?: number;
  active: boolean;
}

export interface Habit {
  id: string;
  title: string;
  blockId: DayBlockId;
  recurrence: Recurrence;
  target: number;
  unit?: string;
  active: boolean;
}

export interface RoutineCompletion {
  routineId: string;
  date: string;
  done: boolean;
}

export interface HabitCheckIn {
  habitId: string;
  date: string;
  count: number;
}

export interface RoutinesData {
  version: 1;
  routines: Routine[];
  habits: Habit[];
  routineCompletions: RoutineCompletion[];
  habitCheckIns: HabitCheckIn[];
}

export const emptyRoutines = (): RoutinesData => ({ version: 1, routines: [], habits: [], routineCompletions: [], habitCheckIns: [] });

const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalString = (value: unknown): string | undefined => string(value) || undefined;
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;
const scheduleMode = (value: unknown): ScheduleMode => SCHEDULE_MODES.includes(value as ScheduleMode) ? value as ScheduleMode : 'Daily';
const weekdays = (value: unknown): number[] => Array.isArray(value)
  ? [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
  : [];

function recurrence(value: unknown): Recurrence {
  const raw = record(value);
  return { mode: scheduleMode(raw.mode), daysOfWeek: weekdays(raw.daysOfWeek), startDate: optionalString(raw.startDate), endDate: optionalString(raw.endDate) };
}

export function parseRoutines(value: unknown): RoutinesData {
  const raw = record(value);
  const routines = Array.isArray(raw.routines) ? raw.routines : [];
  const habits = Array.isArray(raw.habits) ? raw.habits : [];
  const routineCompletions = Array.isArray(raw.routineCompletions) ? raw.routineCompletions : [];
  const habitCheckIns = Array.isArray(raw.habitCheckIns) ? raw.habitCheckIns : [];
  return {
    version: 1,
    routines: routines.map(record).filter((item) => string(item.id) && string(item.title) && blockId(item.blockId)).map((item) => ({
      id: string(item.id), title: string(item.title), blockId: blockId(item.blockId)!, recurrence: recurrence(item.recurrence),
      durationMinutes: Number(item.durationMinutes) > 0 ? Number(item.durationMinutes) : undefined, active: item.active !== false,
    })),
    habits: habits.map(record).filter((item) => string(item.id) && string(item.title) && blockId(item.blockId)).map((item) => ({
      id: string(item.id), title: string(item.title), blockId: blockId(item.blockId)!, recurrence: recurrence(item.recurrence),
      target: Math.max(1, Number(item.target) || 1), unit: optionalString(item.unit), active: item.active !== false,
    })),
    routineCompletions: routineCompletions.map(record).filter((item) => string(item.routineId) && string(item.date)).map((item) => ({ routineId: string(item.routineId), date: string(item.date), done: item.done === true })),
    habitCheckIns: habitCheckIns.map(record).filter((item) => string(item.habitId) && string(item.date)).map((item) => ({ habitId: string(item.habitId), date: string(item.date), count: Math.max(0, Number(item.count) || 0) })),
  };
}

export const newRoutineId = (prefix: 'routine' | 'habit'): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function occursOn(recurrenceRule: Recurrence, date: string): boolean {
  if (recurrenceRule.startDate && date < recurrenceRule.startDate) return false;
  if (recurrenceRule.endDate && date > recurrenceRule.endDate) return false;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (recurrenceRule.mode === 'Daily') return true;
  if (recurrenceRule.mode === 'Weekdays') return weekday >= 1 && weekday <= 5;
  if (recurrenceRule.mode === 'Weekends') return weekday === 0 || weekday === 6;
  return recurrenceRule.daysOfWeek.includes(weekday);
}

export const routinesOn = (data: RoutinesData, date: string): Routine[] => data.routines.filter((item) => item.active && occursOn(item.recurrence, date));
export const habitsOn = (data: RoutinesData, date: string): Habit[] => data.habits.filter((item) => item.active && occursOn(item.recurrence, date));

export function routineDone(data: RoutinesData, routineId: string, date: string): boolean {
  return data.routineCompletions.some((item) => item.routineId === routineId && item.date === date && item.done);
}

export function setRoutineDone(data: RoutinesData, routineId: string, date: string, done: boolean): RoutinesData {
  const others = data.routineCompletions.filter((item) => item.routineId !== routineId || item.date !== date);
  return { ...data, routineCompletions: done ? [...others, { routineId, date, done: true }] : others };
}

export function habitCount(data: RoutinesData, habitId: string, date: string): number {
  return data.habitCheckIns.find((item) => item.habitId === habitId && item.date === date)?.count ?? 0;
}

export function setHabitCount(data: RoutinesData, habitId: string, date: string, count: number): RoutinesData {
  const others = data.habitCheckIns.filter((item) => item.habitId !== habitId || item.date !== date);
  const next = Math.max(0, Math.floor(count));
  return { ...data, habitCheckIns: next > 0 ? [...others, { habitId, date, count: next }] : others };
}

export function habitStreak(data: RoutinesData, habit: Habit, throughDate: string): number {
  let streak = 0;
  let cursor = throughDate;
  for (let inspected = 0; inspected < 3660; inspected += 1) {
    if (!occursOn(habit.recurrence, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (habitCount(data, habit.id, cursor) < habit.target) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function scheduleLabel(rule: Recurrence): string {
  if (rule.mode !== 'Custom') return rule.mode;
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return rule.daysOfWeek.map((day) => labels[day]).join(', ') || 'No days';
}
