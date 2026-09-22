import { beforeEach, describe, expect, it } from 'vitest';
import {
  emptyWorkoutPlanner,
  parseWorkoutPlanner,
  workoutsOn,
} from '../workoutPlanner';

beforeEach(() => localStorage.clear());

describe('workout planner store', () => {
  it('parses sessions and nested exercises with safe defaults', () => {
    const parsed = parseWorkoutPlanner({
      workouts: [{
        id: 'w1', date: '2026-09-04', title: 'Lower A', type: 'Unknown', durationMinutes: -10,
        blockId: 'morning-prime', exercises: [{ id: 'e1', name: 'Squat', prescription: '3 × 5', done: true }, { invalid: true }],
      }],
    });
    expect(parsed.workouts[0]).toMatchObject({ title: 'Lower A', type: 'Strength', durationMinutes: 0, blockId: 'morning-prime' });
    expect(parsed.workouts[0].exercises).toEqual([{ id: 'e1', name: 'Squat', prescription: '3 × 5', done: true }]);
  });

  it('persists independently and filters workouts by day', () => {
    const data = emptyWorkoutPlanner();
    data.workouts.push({ id: 'w1', date: '2026-09-04', title: 'Run', type: 'Cardio', durationMinutes: 30, done: false, exercises: [] });
    const stored = parseWorkoutPlanner(JSON.parse(JSON.stringify(data)));
    expect(workoutsOn(stored, '2026-09-04').map((workout) => workout.title)).toEqual(['Run']);
    expect(workoutsOn(stored, '2026-09-05')).toEqual([]);
  });

  it('recovers from corrupt storage', () => {
    expect(parseWorkoutPlanner('{broken')).toEqual(emptyWorkoutPlanner());
  });
});
