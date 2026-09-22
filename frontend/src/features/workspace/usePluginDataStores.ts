import type { PluginStateClient, StateJson } from '../../services/pluginStateClient';
import { importBrowserLegacyBundle } from '../../services/legacyStateImport';
import {
  CATEGORIES_KEY,
  DEFAULT_CATEGORIES,
  EXPENSES_KEY,
  EXPORTED_KEY,
  parseExpenseCategories,
  parseExpenses,
  parseExportedPeriods,
  type ExpenseRecord,
} from './euer';
import {
  DEFAULT_RETENTION_CLASSES,
  GOBD_CLASSES_KEY,
  parseRetentionClasses,
  type RetentionClass,
} from './gobd';
import {
  parseSellerProfile,
  SELLER_PROFILE_KEY,
  type SellerProfile,
} from './invoicing';
import { DEFAULT_STAGES, parseStages, PIPELINE_STAGES_KEY } from './pipeline';
import { parseTimeEntries, TIME_ENTRIES_KEY, type TimeEntry } from './timeTracking';
import { parseTodos, TODOS_STORE_KEY, type TodoItem } from './todos';
import { useServerWorkspaceStore } from './useWorkspaceStore';
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

async function importLegacyEuer(client: PluginStateClient): Promise<void> {
  await importBrowserLegacyBundle(
    client,
    [EXPENSES_KEY, CATEGORIES_KEY, EXPORTED_KEY],
    'data',
    'modulo.workspace.euer',
    values => asStateJson(parseEuerData({
      expenses: values[EXPENSES_KEY] ?? [],
      categories: values[CATEGORIES_KEY] ?? DEFAULT_CATEGORIES,
      exportedPeriods: values[EXPORTED_KEY] ?? [],
    })),
  );
}

export function useEuerStore() {
  return useServerWorkspaceStore(
    'euer',
    'data',
    'modulo.workspace.euer',
    emptyEuerData(),
    parseEuerData,
    [EXPENSES_KEY, CATEGORIES_KEY, EXPORTED_KEY],
    'EÜR bookkeeping',
    importLegacyEuer,
  );
}

export function useGobdClassesStore() {
  return useServerWorkspaceStore<RetentionClass[]>(
    'gobd',
    'retention-classes',
    'modulo.workspace.gobd.retention-classes',
    DEFAULT_RETENTION_CLASSES.map(item => ({ ...item })),
    parseRetentionClasses,
    GOBD_CLASSES_KEY,
    'GoBD retention classes',
  );
}

export function useSellerProfileStore() {
  return useServerWorkspaceStore<SellerProfile | null>(
    'invoicing',
    'seller-profile',
    'modulo.workspace.invoice.seller-profile',
    null,
    parseSellerProfile,
    SELLER_PROFILE_KEY,
    'Invoice seller profile',
  );
}

export function usePipelineStagesStore() {
  return useServerWorkspaceStore<string[]>(
    'pipeline',
    'stages',
    'modulo.workspace.pipeline.stages',
    [...DEFAULT_STAGES],
    parseStages,
    PIPELINE_STAGES_KEY,
    'Engagement pipeline',
  );
}

export function useTimeEntriesStore() {
  return useServerWorkspaceStore<TimeEntry[]>(
    'time-tracking',
    'entries',
    'modulo.workspace.time.entries',
    [],
    parseTimeEntries,
    TIME_ENTRIES_KEY,
    'Time tracking',
  );
}

export function useTodosStore() {
  return useServerWorkspaceStore<TodoItem[]>(
    'todos',
    'items',
    'modulo.workspace.todos',
    [],
    parseTodos,
    TODOS_STORE_KEY,
    'Todo lists',
  );
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
