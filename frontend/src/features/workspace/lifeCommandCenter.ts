import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import type { LifePluginConfig } from './lifeConfigs';
import { lifeOccurrenceDone, lifeRecordOccursOn, type LifeCollectionData } from './lifeStore';
import type { MealPlannerData } from './mealPlanner';
import { addDays } from './planner';
import { habitCount, habitsOn, routineDone, routinesOn, type RoutinesData } from './routines';
import type { WorkoutPlannerData } from './workoutPlanner';

export interface LifeCommandCenterItem {
  id: string;
  title: string;
  date: string;
  source: string;
  viewId: string;
  done: boolean;
  detail?: string;
  blockId?: DayBlockId;
}

export interface LifeCommandCenterAlert {
  id: string;
  title: string;
  date: string;
  source: string;
  viewId: string;
  kind: 'Expiry' | 'Use by' | 'Return' | 'Warranty';
}

export interface LifeCommandCenterSnapshot {
  today: LifeCommandCenterItem[];
  upcoming: LifeCommandCenterItem[];
  alerts: LifeCommandCenterAlert[];
  habits: { done: number; total: number };
  routines: { done: number; total: number };
  meals: { done: number; total: number };
  workouts: { done: number; total: number };
}

export interface LifeCommandCenterInput {
  today: string;
  routines?: RoutinesData;
  meals?: MealPlannerData;
  workouts?: WorkoutPlannerData;
  collections: Array<{ config: LifePluginConfig; data: LifeCollectionData }>;
  horizonDays?: number;
}

function sortScheduled(items: LifeCommandCenterItem[]): LifeCommandCenterItem[] {
  const blockOrder = (blockId: DayBlockId | undefined) => blockId ? DAY_BLOCKS.findIndex((block) => block.id === blockId) : DAY_BLOCKS.length;
  return items.sort((a, b) => a.date.localeCompare(b.date) || blockOrder(a.blockId) - blockOrder(b.blockId));
}

function lifeItemsOn(
  collections: LifeCommandCenterInput['collections'],
  date: string,
): LifeCommandCenterItem[] {
  return collections.flatMap(({ config, data }) => data.records
    .filter((record) => lifeRecordOccursOn(record, date))
    .map((record) => ({
      id: `${config.id}:${record.id}:${date}`,
      title: record.title,
      date,
      source: config.calendarSource,
      viewId: config.id,
      done: config.completedStatuses.includes(record.status) || lifeOccurrenceDone(data, record.id, date),
      detail: record.category,
      blockId: record.blockId,
    })));
}

function datedItems(
  date: string,
  meals?: MealPlannerData,
  workouts?: WorkoutPlannerData,
): LifeCommandCenterItem[] {
  return [
    ...(meals?.meals.filter((item) => item.date === date).map((item) => ({
      id: `meal:${item.id}:${date}`,
      title: item.title,
      date,
      source: 'Meals',
      viewId: 'meal-planner',
      done: item.done,
      detail: item.type,
      blockId: item.blockId,
    })) ?? []),
    ...(meals?.prepSessions.filter((item) => item.date === date).map((item) => ({
      id: `prep:${item.id}:${date}`,
      title: item.title,
      date,
      source: 'Meal prep',
      viewId: 'meal-planner',
      done: item.done,
      detail: `${item.portions} portions`,
      blockId: item.blockId,
    })) ?? []),
    ...(meals?.shoppingTrips.filter((item) => item.date === date).map((item) => ({
      id: `trip:${item.id}:${date}`,
      title: item.title,
      date,
      source: 'Shopping',
      viewId: 'meal-planner',
      done: item.done,
      detail: item.store,
    })) ?? []),
    ...(workouts?.workouts.filter((item) => item.date === date).map((item) => ({
      id: `workout:${item.id}:${date}`,
      title: item.title,
      date,
      source: 'Workout',
      viewId: 'workout-planner',
      done: item.done,
      detail: `${item.type} · ${item.durationMinutes} min`,
      blockId: item.blockId,
    })) ?? []),
  ];
}

function timeSensitiveAlerts(
  today: string,
  horizon: string,
  meals: MealPlannerData | undefined,
  collections: LifeCommandCenterInput['collections'],
): LifeCommandCenterAlert[] {
  const inWindow = (date: string | undefined): date is string => Boolean(date && date <= horizon);
  const alerts: LifeCommandCenterAlert[] = [];

  for (const item of meals?.pantry ?? []) {
    if (inWindow(item.expiresOn)) alerts.push({ id: `pantry:${item.id}`, title: item.title, date: item.expiresOn, source: 'Pantry', viewId: 'meal-planner', kind: 'Expiry' });
  }
  for (const item of meals?.prepSessions ?? []) {
    if (item.portionsRemaining > 0 && inWindow(item.useBy)) alerts.push({ id: `prep:${item.id}`, title: item.title, date: item.useBy, source: 'Meal prep', viewId: 'meal-planner', kind: 'Use by' });
  }
  for (const { config, data } of collections) {
    for (const record of data.records) {
      const returnBy = record.values.returnBy;
      const warrantyUntil = record.values.warrantyUntil;
      if (inWindow(returnBy)) alerts.push({ id: `${config.id}:${record.id}:return`, title: record.title, date: returnBy, source: config.calendarSource, viewId: config.id, kind: 'Return' });
      if (inWindow(warrantyUntil)) alerts.push({ id: `${config.id}:${record.id}:warranty`, title: record.title, date: warrantyUntil, source: config.calendarSource, viewId: config.id, kind: 'Warranty' });
    }
  }

  return alerts
    .filter((item) => item.date >= addDays(today, -365))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function buildLifeCommandCenter(input: LifeCommandCenterInput): LifeCommandCenterSnapshot {
  const { today, routines, meals, workouts, collections } = input;
  const horizonDays = input.horizonDays ?? 7;
  const todayRoutines = routines ? routinesOn(routines, today) : [];
  const todayHabits = routines ? habitsOn(routines, today) : [];
  const rhythmItems: LifeCommandCenterItem[] = [
    ...todayRoutines.map((item) => ({
      id: `routine:${item.id}:${today}`,
      title: item.title,
      date: today,
      source: 'Routine',
      viewId: 'routines-habits',
      done: routineDone(routines!, item.id, today),
      detail: item.durationMinutes ? `${item.durationMinutes} min` : undefined,
      blockId: item.blockId,
    })),
    ...todayHabits.map((item) => {
      const count = habitCount(routines!, item.id, today);
      return {
        id: `habit:${item.id}:${today}`,
        title: item.title,
        date: today,
        source: 'Habit',
        viewId: 'routines-habits',
        done: count >= item.target,
        detail: `${count}/${item.target}${item.unit ? ` ${item.unit}` : ''}`,
        blockId: item.blockId,
      };
    }),
  ];
  const todayItems = sortScheduled([...rhythmItems, ...datedItems(today, meals, workouts), ...lifeItemsOn(collections, today)]);
  const upcoming = sortScheduled(Array.from({ length: horizonDays }, (_, index) => addDays(today, index + 1))
    .flatMap((date) => [...datedItems(date, meals, workouts), ...lifeItemsOn(collections, date)]));
  const todayMeals = meals?.meals.filter((item) => item.date === today) ?? [];
  const todayWorkouts = workouts?.workouts.filter((item) => item.date === today) ?? [];

  return {
    today: todayItems,
    upcoming,
    alerts: timeSensitiveAlerts(today, addDays(today, horizonDays), meals, collections),
    habits: { done: todayHabits.filter((item) => habitCount(routines!, item.id, today) >= item.target).length, total: todayHabits.length },
    routines: { done: todayRoutines.filter((item) => routineDone(routines!, item.id, today)).length, total: todayRoutines.length },
    meals: { done: todayMeals.filter((item) => item.done).length, total: todayMeals.length },
    workouts: { done: todayWorkouts.filter((item) => item.done).length, total: todayWorkouts.length },
  };
}
