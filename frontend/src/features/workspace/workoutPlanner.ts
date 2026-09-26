import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const WORKOUT_PLANNER_STORE_KEY = 'modulo-workout-planner-v1';

export const WORKOUT_TYPES = ['Strength', 'Cardio', 'Mobility', 'Recovery', 'Sport'] as const;
export type WorkoutType = typeof WORKOUT_TYPES[number];

export interface WorkoutExercise {
  id: string;
  name: string;
  prescription?: string;
  done: boolean;
}

export interface PlannedWorkout {
  id: string;
  date: string;
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  blockId?: DayBlockId;
  notes?: string;
  done: boolean;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlannerData {
  version: 1;
  workouts: PlannedWorkout[];
}

export const emptyWorkoutPlanner = (): WorkoutPlannerData => ({ version: 1, workouts: [] });

const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;

export function parseWorkoutPlanner(value: unknown): WorkoutPlannerData {
  const raw = record(value);
  const workouts = Array.isArray(raw.workouts) ? raw.workouts : [];
  return {
    version: 1,
    workouts: workouts.map(record).filter((item) => string(item.id) && string(item.title) && string(item.date)).map((item) => ({
      id: string(item.id),
      date: string(item.date),
      title: string(item.title),
      type: WORKOUT_TYPES.includes(item.type as WorkoutType) ? item.type as WorkoutType : 'Strength',
      durationMinutes: Math.max(0, Number(item.durationMinutes) || 0),
      blockId: blockId(item.blockId),
      notes: string(item.notes) || undefined,
      done: item.done === true,
      exercises: (Array.isArray(item.exercises) ? item.exercises : []).map(record).filter((exercise) => string(exercise.id) && string(exercise.name)).map((exercise) => ({
        id: string(exercise.id),
        name: string(exercise.name),
        prescription: string(exercise.prescription) || undefined,
        done: exercise.done === true,
      })),
    })),
  };
}

export const newWorkoutPlannerId = (prefix: 'workout' | 'exercise'): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function workoutsOn(data: WorkoutPlannerData, date: string): PlannedWorkout[] {
  return data.workouts.filter((workout) => workout.date === date);
}
