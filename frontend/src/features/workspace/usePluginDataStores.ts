import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';
import { importBrowserLegacyBundle } from '../../services/legacyStateImport';
import {
  DEFAULT_CATEGORIES,
  parseExpenseCategories,
  parseExpenses,
  parseExportedPeriods,
  type ExpenseRecord,
} from './euer';
import type { TimeEntry } from './timeTracking';
import { EXPENSE_COLLECTION, TIME_COLLECTION } from './operationalSchemas';
import { useOperationalCollection } from './useOperationalCollection';
import { useExpenseCategories, useExportedPeriods } from './useBusinessSettings';
import { useServerWorkspaceStore, type StoreUpdate, type WorkspaceStore } from './useWorkspaceStore';
import {
  LEGACY_MEAL_PLANNER_STORE_KEY,
  MEAL_PLANNER_STORE_KEY,
  emptyMealPlanner,
  parseMealPlanner,
} from './mealPlanner';
import {
  WORKOUT_PLANNER_STORE_KEY,
  emptyWorkoutPlanner,
  parseWorkoutPlanner,
} from './workoutPlanner';

export interface EuerData {
  version: 1;
  expenses: ExpenseRecord[];
  categories: string[];
  exportedPeriods: string[];
}

export const emptyEuerData = (): EuerData => ({
  version: 1,
  expenses: [],
  categories: [...DEFAULT_CATEGORIES],
  exportedPeriods: [],
});

export function parseEuerData(value: unknown): EuerData {
  const raw = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    version: 1,
    expenses: parseExpenses(raw.expenses),
    categories: parseExpenseCategories(raw.categories),
    exportedPeriods: parseExportedPeriods(raw.exportedPeriods),
  };
}

const asStateJson = (value: unknown): StateJson =>
  JSON.parse(JSON.stringify(value)) as StateJson;

/**
 * Read/write view of the per-record business stores (#422). Expenses, time
 * entries and their settings live in the plugin namespaces owned by the EÜR
 * and time-tracking plugins; this adapter never keeps a second copy.
 */
export function useEuerStore(): WorkspaceStore<EuerData> {
  const expenses = useOperationalCollection(EXPENSE_COLLECTION);
  const categories = useExpenseCategories();
  const exported = useExportedPeriods();
  const value: EuerData = { version: 1, expenses: expenses.value, categories: categories.value, exportedPeriods: exported.value };
  const set = (next: StoreUpdate<EuerData>): boolean => {
    if (!expenses.ready || !categories.ready || !exported.ready) return false;
    const resolved = parseEuerData(typeof next === 'function' ? next(value) : next);
    if (JSON.stringify(resolved.expenses) !== JSON.stringify(value.expenses)) expenses.set(resolved.expenses);
    if (JSON.stringify(resolved.categories) !== JSON.stringify(value.categories) && !categories.set(resolved.categories)) return false;
    if (JSON.stringify(resolved.exportedPeriods) !== JSON.stringify(value.exportedPeriods) && !exported.set(resolved.exportedPeriods)) return false;
    return true;
  };
  return [value, set];
}

export function useTimeEntriesStore(): WorkspaceStore<TimeEntry[]> {
  const entries = useOperationalCollection(TIME_COLLECTION);
  return [entries.value, next => {
    if (!entries.ready) return false;
    entries.set(typeof next === 'function' ? next(entries.value) : next);
    return true;
  }];
}

async function importLegacyMealPlanner(client: PluginStateClient): Promise<void> {
  await importBrowserLegacyBundle(
    client,
    [MEAL_PLANNER_STORE_KEY, LEGACY_MEAL_PLANNER_STORE_KEY],
    'data',
    'modulo.workspace.meal-planner.v2',
    values => asStateJson(parseMealPlanner(
      values[MEAL_PLANNER_STORE_KEY] ?? values[LEGACY_MEAL_PLANNER_STORE_KEY] ?? emptyMealPlanner(),
    )),
  );
}

export function useMealPlannerStore() {
  return useServerWorkspaceStore(
    'meal-planner',
    'data',
    'modulo.workspace.meal-planner.v2',
    emptyMealPlanner(),
    parseMealPlanner,
    [MEAL_PLANNER_STORE_KEY, LEGACY_MEAL_PLANNER_STORE_KEY],
    'Meal planner',
    importLegacyMealPlanner,
  );
}

export { useMediaLibraryStore } from './mediaLibraryStore';

export function useWorkoutPlannerStore() {
  return useServerWorkspaceStore(
    'workout-planner',
    'data',
    'modulo.workspace.workout-planner',
    emptyWorkoutPlanner(),
    parseWorkoutPlanner,
    WORKOUT_PLANNER_STORE_KEY,
    'Workout planner',
  );
}
