import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const MEAL_PLANNER_STORE_KEY = 'modulo-meal-planner-v2';
export const LEGACY_MEAL_PLANNER_STORE_KEY = 'modulo-meal-planner-v1';

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type MealType = typeof MEAL_TYPES[number];

export const FOOD_CATEGORIES = ['Produce', 'Bakery', 'Dairy', 'Meat & fish', 'Pantry', 'Frozen', 'Drinks', 'Household', 'Other'] as const;
export type FoodCategory = typeof FOOD_CATEGORIES[number];

export const STORAGE_LOCATIONS = ['Fridge', 'Freezer', 'Pantry'] as const;
export type StorageLocation = typeof STORAGE_LOCATIONS[number];

export interface RecipeIngredient {
  id: string;
  title: string;
  quantity?: number;
  unit?: string;
  category: FoodCategory;
  store?: string;
}

export interface Recipe {
  id: string;
  title: string;
  servings: number;
  prepMinutes?: number;
  cookMinutes?: number;
  instructions?: string;
  ingredients: RecipeIngredient[];
}

export interface PlannedMeal {
  id: string;
  date: string;
  title: string;
  type: MealType;
  servings: number;
  blockId?: DayBlockId;
  recipeId?: string;
  prepSessionId?: string;
  notes?: string;
  done: boolean;
}

export interface GroceryItem {
  id: string;
  title: string;
  quantity?: string;
  unit?: string;
  category: FoodCategory;
  store?: string;
  tripId?: string;
  sourceMealIds: string[];
  checked: boolean;
}

export interface PantryItem {
  id: string;
  title: string;
  quantity?: string;
  unit?: string;
  category: FoodCategory;
  expiresOn?: string;
}

export interface ShoppingTrip {
  id: string;
  title: string;
  store?: string;
  date: string;
  done: boolean;
}

export interface PrepSession {
  id: string;
  title: string;
  date: string;
  blockId?: DayBlockId;
  recipeId?: string;
  mealIds: string[];
  portions: number;
  portionsRemaining: number;
  location: StorageLocation;
  useBy?: string;
  done: boolean;
}

export interface MealPlannerData {
  version: 2;
  meals: PlannedMeal[];
  recipes: Recipe[];
  groceries: GroceryItem[];
  pantry: PantryItem[];
  shoppingTrips: ShoppingTrip[];
  prepSessions: PrepSession[];
}

export const emptyMealPlanner = (): MealPlannerData => ({
  version: 2,
  meals: [],
  recipes: [],
  groceries: [],
  pantry: [],
  shoppingTrips: [],
  prepSessions: [],
});

const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const string = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalString = (value: unknown): string | undefined => string(value) || undefined;
const positiveNumber = (value: unknown, fallback = 1): number => Math.max(1, Number(value) || fallback);
const optionalPositiveNumber = (value: unknown): number | undefined => Number(value) > 0 ? Number(value) : undefined;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;
const category = (value: unknown): FoodCategory => FOOD_CATEGORIES.includes(value as FoodCategory) ? value as FoodCategory : 'Other';
const location = (value: unknown): StorageLocation => STORAGE_LOCATIONS.includes(value as StorageLocation) ? value as StorageLocation : 'Fridge';

export function parseMealPlanner(value: unknown): MealPlannerData {
  const raw = record(value);
  const meals = Array.isArray(raw.meals) ? raw.meals : [];
  const recipes = Array.isArray(raw.recipes) ? raw.recipes : [];
  const groceries = Array.isArray(raw.groceries) ? raw.groceries : [];
  const pantry = Array.isArray(raw.pantry) ? raw.pantry : [];
  const shoppingTrips = Array.isArray(raw.shoppingTrips) ? raw.shoppingTrips : [];
  const prepSessions = Array.isArray(raw.prepSessions) ? raw.prepSessions : [];
  return {
    version: 2,
    meals: meals.map(record).filter((item) => string(item.id) && string(item.title) && string(item.date)).map((item) => ({
      id: string(item.id),
      date: string(item.date),
      title: string(item.title),
      type: MEAL_TYPES.includes(item.type as MealType) ? item.type as MealType : 'Dinner',
      servings: positiveNumber(item.servings),
      blockId: blockId(item.blockId),
      recipeId: optionalString(item.recipeId),
      prepSessionId: optionalString(item.prepSessionId),
      notes: optionalString(item.notes),
      done: item.done === true,
    })),
    recipes: recipes.map(record).filter((item) => string(item.id) && string(item.title)).map((item) => ({
      id: string(item.id),
      title: string(item.title),
      servings: positiveNumber(item.servings),
      prepMinutes: optionalPositiveNumber(item.prepMinutes),
      cookMinutes: optionalPositiveNumber(item.cookMinutes),
      instructions: optionalString(item.instructions),
      ingredients: (Array.isArray(item.ingredients) ? item.ingredients : []).map(record)
        .filter((ingredient) => string(ingredient.id) && string(ingredient.title))
        .map((ingredient) => ({
          id: string(ingredient.id),
          title: string(ingredient.title),
          quantity: optionalPositiveNumber(ingredient.quantity),
          unit: optionalString(ingredient.unit),
          category: category(ingredient.category),
          store: optionalString(ingredient.store),
        })),
    })),
    groceries: groceries.map(record).filter((item) => string(item.id) && string(item.title)).map((item) => ({
      id: string(item.id),
      title: string(item.title),
      quantity: optionalString(item.quantity),
      unit: optionalString(item.unit),
      category: category(item.category),
      store: optionalString(item.store),
      tripId: optionalString(item.tripId),
      sourceMealIds: strings(item.sourceMealIds),
      checked: item.checked === true,
    })),
    pantry: pantry.map(record).filter((item) => string(item.id) && string(item.title)).map((item) => ({
      id: string(item.id),
      title: string(item.title),
      quantity: optionalString(item.quantity),
      unit: optionalString(item.unit),
      category: category(item.category),
      expiresOn: optionalString(item.expiresOn),
    })),
    shoppingTrips: shoppingTrips.map(record).filter((item) => string(item.id) && string(item.title) && string(item.date)).map((item) => ({
      id: string(item.id),
      title: string(item.title),
      store: optionalString(item.store),
      date: string(item.date),
      done: item.done === true,
    })),
    prepSessions: prepSessions.map(record).filter((item) => string(item.id) && string(item.title) && string(item.date)).map((item) => ({
      id: string(item.id),
      title: string(item.title),
      date: string(item.date),
      blockId: blockId(item.blockId),
      recipeId: optionalString(item.recipeId),
      mealIds: strings(item.mealIds),
      portions: positiveNumber(item.portions),
      portionsRemaining: Math.max(0, Math.min(positiveNumber(item.portions), Number(item.portionsRemaining) >= 0 ? Number(item.portionsRemaining) : positiveNumber(item.portions))),
      location: location(item.location),
      useBy: optionalString(item.useBy),
      done: item.done === true,
    })),
  };
}

export const newMealPlannerId = (prefix: 'meal' | 'recipe' | 'ingredient' | 'grocery' | 'pantry' | 'trip' | 'prep'): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export function mealsOn(data: MealPlannerData, date: string): PlannedMeal[] {
  return data.meals.filter((meal) => meal.date === date).sort((a, b) => MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type));
}

export function scaledIngredients(recipe: Recipe, servings: number): RecipeIngredient[] {
  const scale = positiveNumber(servings) / recipe.servings;
  return recipe.ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: ingredient.quantity === undefined ? undefined : Math.round(ingredient.quantity * scale * 100) / 100,
  }));
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** Generates a deduplicated list without mutating the planner. Pantry matches are treated as already available. */
export function groceriesForMeals(data: MealPlannerData, mealIds: string[]): GroceryItem[] {
  const wanted = new Set(mealIds);
  const pantry = new Set(data.pantry.map((item) => normalized(item.title)));
  const grouped = new Map<string, GroceryItem & { numericQuantity?: number }>();

  for (const meal of data.meals.filter((item) => wanted.has(item.id) && item.recipeId)) {
    const recipe = data.recipes.find((item) => item.id === meal.recipeId);
    if (!recipe) continue;
    for (const ingredient of scaledIngredients(recipe, meal.servings)) {
      if (pantry.has(normalized(ingredient.title))) continue;
      const key = [normalized(ingredient.title), normalized(ingredient.unit ?? ''), ingredient.category, normalized(ingredient.store ?? '')].join('|');
      const existing = grouped.get(key);
      if (existing) {
        if (ingredient.quantity !== undefined) existing.numericQuantity = (existing.numericQuantity ?? 0) + ingredient.quantity;
        if (!existing.sourceMealIds.includes(meal.id)) existing.sourceMealIds.push(meal.id);
        continue;
      }
      grouped.set(key, {
        id: newMealPlannerId('grocery'),
        title: ingredient.title,
        quantity: ingredient.quantity === undefined ? undefined : formatQuantity(ingredient.quantity),
        numericQuantity: ingredient.quantity,
        unit: ingredient.unit,
        category: ingredient.category,
        store: ingredient.store,
        sourceMealIds: [meal.id],
        checked: false,
      });
    }
  }

  return [...grouped.values()].map(({ numericQuantity, ...item }) => ({
    ...item,
    quantity: numericQuantity === undefined ? item.quantity : formatQuantity(numericQuantity),
  }));
}

/** Adds generated items while merging them into equivalent unchecked entries already on the list. */
export function addGroceriesForMeals(data: MealPlannerData, mealIds: string[]): MealPlannerData {
  const groceries = data.groceries.map((item) => ({ ...item, sourceMealIds: [...item.sourceMealIds] }));
  for (const generated of groceriesForMeals(data, mealIds)) {
    const existing = groceries.find((item) => !item.checked
      && normalized(item.title) === normalized(generated.title)
      && normalized(item.unit ?? '') === normalized(generated.unit ?? '')
      && item.category === generated.category
      && normalized(item.store ?? '') === normalized(generated.store ?? ''));
    if (!existing) {
      groceries.push(generated);
      continue;
    }
    if (existing.sourceMealIds.length > 0) {
      existing.quantity = generated.quantity;
    } else {
      const total = Number(existing.quantity) + Number(generated.quantity);
      if (Number.isFinite(total) && total > 0) existing.quantity = formatQuantity(total);
    }
    existing.sourceMealIds = [...new Set([...existing.sourceMealIds, ...generated.sourceMealIds])];
  }
  return { ...data, groceries };
}

export function assignOpenGroceriesToTrip(data: MealPlannerData, tripId: string): MealPlannerData {
  const trip = data.shoppingTrips.find((item) => item.id === tripId);
  if (!trip) return data;
  return {
    ...data,
    groceries: data.groceries.map((item) => !item.checked && !item.tripId && (!trip.store || !item.store || normalized(item.store) === normalized(trip.store))
      ? { ...item, tripId }
      : item),
  };
}

export function prepSessionsOn(data: MealPlannerData, date: string): PrepSession[] {
  return data.prepSessions.filter((session) => session.date === date);
}
