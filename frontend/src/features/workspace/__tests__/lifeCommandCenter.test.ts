import { describe, expect, it } from 'vitest';
import { buildLifeCommandCenter } from '../lifeCommandCenter';
import { FINANCE_CONFIG, WISHLIST_CONFIG } from '../lifeConfigs';
import { emptyLifeCollection, type LifeRecord } from '../lifeStore';
import { emptyMealPlanner } from '../mealPlanner';
import { emptyRoutines, setHabitCount, setRoutineDone } from '../routines';
import { emptyWorkoutPlanner } from '../workoutPlanner';

const record = (update: Partial<LifeRecord> = {}): LifeRecord => ({
  id: 'record-1', title: 'Electric bill', status: 'Due', category: 'Bill', date: '2026-09-04', recurrence: 'Once', favorite: false, tags: [], values: {}, checklist: [], log: [], ...update,
});

describe('Life Command Center projection', () => {
  it('combines today across routines, habits, meals, workouts, shopping, and Life records', () => {
    let routines = emptyRoutines();
    routines.routines.push({ id: 'routine-1', title: 'Morning reset', blockId: 'morning-prime', recurrence: { mode: 'Daily', daysOfWeek: [] }, active: true });
    routines.habits.push({ id: 'habit-1', title: 'Drink water', blockId: 'reset', recurrence: { mode: 'Daily', daysOfWeek: [] }, target: 2, unit: 'glasses', active: true });
    routines = setRoutineDone(routines, 'routine-1', '2026-09-04', true);
    routines = setHabitCount(routines, 'habit-1', '2026-09-04', 1);

    const meals = emptyMealPlanner();
    meals.meals.push({ id: 'meal-1', date: '2026-09-04', title: 'Pasta', type: 'Dinner', servings: 2, done: false });
    meals.shoppingTrips.push({ id: 'trip-1', date: '2026-09-04', title: 'Weekly shop', done: true });
    const workouts = emptyWorkoutPlanner();
    workouts.workouts.push({ id: 'workout-1', date: '2026-09-04', title: 'Strength A', type: 'Strength', durationMinutes: 45, done: false, exercises: [] });
    const finance = emptyLifeCollection();
    finance.records.push(record());

    const snapshot = buildLifeCommandCenter({ today: '2026-09-04', routines, meals, workouts, collections: [{ config: FINANCE_CONFIG, data: finance }] });

    expect(snapshot.today.map((item) => item.source)).toEqual(['Routine', 'Habit', 'Meals', 'Shopping', 'Workout', 'Finance']);
    expect(snapshot.today).toHaveLength(6);
    expect(snapshot.routines).toEqual({ done: 1, total: 1 });
    expect(snapshot.habits).toEqual({ done: 0, total: 1 });
    expect(snapshot.meals).toEqual({ done: 0, total: 1 });
    expect(snapshot.workouts).toEqual({ done: 0, total: 1 });
  });

  it('materializes recurring Life commitments across the seven-day outlook', () => {
    const finance = emptyLifeCollection();
    finance.records.push(record({ recurrence: 'Daily', date: '2026-09-04', blockId: 'ops-people' }));
    const snapshot = buildLifeCommandCenter({ today: '2026-09-04', collections: [{ config: FINANCE_CONFIG, data: finance }] });

    expect(snapshot.today).toHaveLength(1);
    expect(snapshot.upcoming).toHaveLength(7);
    expect(snapshot.upcoming[0]).toMatchObject({ date: '2026-09-05', viewId: 'finance-subscriptions' });
    expect(snapshot.upcoming[snapshot.upcoming.length - 1]?.date).toBe('2026-09-11');
  });

  it('surfaces nearby food, return, and warranty deadlines with owning-plugin links', () => {
    const meals = emptyMealPlanner();
    meals.pantry.push({ id: 'pantry-1', title: 'Spinach', category: 'Produce', expiresOn: '2026-09-05' });
    meals.prepSessions.push({ id: 'prep-1', title: 'Chili batch', date: '2026-09-01', mealIds: [], portions: 4, portionsRemaining: 2, location: 'Freezer', useBy: '2026-09-07', done: true });
    const purchases = emptyLifeCollection();
    purchases.records.push(record({ id: 'purchase-1', title: 'Headphones', values: { returnBy: '2026-09-06', warrantyUntil: '2027-09-04' } }));

    const snapshot = buildLifeCommandCenter({ today: '2026-09-04', meals, collections: [{ config: WISHLIST_CONFIG, data: purchases }] });

    expect(snapshot.alerts.map((item) => item.kind)).toEqual(['Expiry', 'Return', 'Use by']);
    expect(snapshot.alerts.find((item) => item.kind === 'Return')).toMatchObject({ viewId: 'wishlist-purchases', title: 'Headphones' });
    expect(snapshot.alerts.some((item) => item.kind === 'Warranty')).toBe(false);
  });
});
