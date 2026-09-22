import { beforeEach, describe, expect, it } from 'vitest';
import {
  addGroceriesForMeals,
  assignOpenGroceriesToTrip,
  emptyMealPlanner,
  groceriesForMeals,
  mealsOn,
  parseMealPlanner,
  scaledIngredients,
} from '../mealPlanner';

beforeEach(() => localStorage.clear());

describe('meal planner store', () => {
  it('migrates valid v1 records and normalizes unsafe fields', () => {
    const parsed = parseMealPlanner({
      version: 1,
      meals: [{ id: 'm1', date: '2026-09-04', title: 'Pasta', type: 'Unknown', servings: 0, blockId: 'early-evening', done: true }],
      groceries: [{ id: 'g1', title: 'Tomatoes', quantity: '4', checked: false }, { nope: true }],
    });
    expect(parsed.version).toBe(2);
    expect(parsed.meals[0]).toMatchObject({ title: 'Pasta', type: 'Dinner', servings: 1, blockId: 'early-evening', done: true });
    expect(parsed.groceries).toEqual([{ id: 'g1', title: 'Tomatoes', quantity: '4', category: 'Other', sourceMealIds: [], checked: false }]);
    expect(parsed).toMatchObject({ recipes: [], pantry: [], shoppingTrips: [], prepSessions: [] });
  });

  it('upgrades legacy v1 planner data into the v2 shape', () => {
    const loaded = parseMealPlanner({ meals: [{ id: 'm1', date: '2026-09-04', title: 'Soup', type: 'Lunch', servings: 2, done: false }], groceries: [] });
    expect(loaded.meals[0].title).toBe('Soup');
    expect(parseMealPlanner(JSON.parse(JSON.stringify(loaded)))).toEqual(loaded);
  });

  it('persists independently and filters meals by day', () => {
    const data = emptyMealPlanner();
    data.meals.push(
      { id: 'm2', date: '2026-09-04', title: 'Lunch', type: 'Lunch', servings: 1, done: false },
      { id: 'm1', date: '2026-09-04', title: 'Breakfast', type: 'Breakfast', servings: 1, done: false },
      { id: 'm3', date: '2026-09-05', title: 'Dinner', type: 'Dinner', servings: 2, done: false },
    );
    expect(mealsOn(parseMealPlanner(JSON.parse(JSON.stringify(data))), '2026-09-04').map((meal) => meal.title)).toEqual(['Breakfast', 'Lunch']);
  });

  it('scales recipe ingredients to the planned servings', () => {
    const recipe = { id: 'r1', title: 'Pasta', servings: 2, ingredients: [{ id: 'i1', title: 'Tomato', quantity: 3, unit: 'pcs', category: 'Produce' as const }] };
    expect(scaledIngredients(recipe, 5)[0].quantity).toBe(7.5);
  });

  it('generates and combines recipe groceries while excluding pantry inventory', () => {
    const data = emptyMealPlanner();
    data.recipes.push({
      id: 'r1', title: 'Pasta', servings: 2, ingredients: [
        { id: 'i1', title: 'Tomato', quantity: 2, unit: 'pcs', category: 'Produce' },
        { id: 'i2', title: 'Salt', quantity: 1, unit: 'tsp', category: 'Pantry' },
      ],
    });
    data.meals.push(
      { id: 'm1', date: '2026-09-04', title: 'Pasta', type: 'Dinner', servings: 4, recipeId: 'r1', done: false },
      { id: 'm2', date: '2026-09-05', title: 'Pasta', type: 'Lunch', servings: 2, recipeId: 'r1', done: false },
    );
    data.pantry.push({ id: 'p1', title: 'salt', quantity: '1', unit: 'box', category: 'Pantry' });

    const generated = groceriesForMeals(data, ['m1', 'm2']);
    expect(generated).toHaveLength(1);
    expect(generated[0]).toMatchObject({ title: 'Tomato', quantity: '6', unit: 'pcs', category: 'Produce', sourceMealIds: ['m1', 'm2'] });
  });

  it('refreshes an already-generated quantity instead of duplicating it', () => {
    const data = emptyMealPlanner();
    data.recipes.push({ id: 'r1', title: 'Toast', servings: 1, ingredients: [{ id: 'i1', title: 'Bread', quantity: 2, unit: 'slices', category: 'Bakery' }] });
    data.meals.push({ id: 'm1', date: '2026-09-04', title: 'Toast', type: 'Breakfast', servings: 1, recipeId: 'r1', done: false });
    const once = addGroceriesForMeals(data, ['m1']);
    const twice = addGroceriesForMeals(once, ['m1']);
    expect(twice.groceries).toHaveLength(1);
    expect(twice.groceries[0].quantity).toBe('2');
  });

  it('assigns compatible open groceries to a store-aware trip', () => {
    const data = emptyMealPlanner();
    data.shoppingTrips.push({ id: 't1', title: 'Market', store: 'Local', date: '2026-09-05', done: false });
    data.groceries.push(
      { id: 'g1', title: 'Apples', category: 'Produce', store: 'Local', sourceMealIds: [], checked: false },
      { id: 'g2', title: 'Milk', category: 'Dairy', store: 'Other', sourceMealIds: [], checked: false },
      { id: 'g3', title: 'Bread', category: 'Bakery', sourceMealIds: [], checked: true },
    );
    const assigned = assignOpenGroceriesToTrip(data, 't1');
    expect(assigned.groceries.map((item) => item.tripId)).toEqual(['t1', undefined, undefined]);
  });

  it('recovers from corrupt records', () => {
    expect(parseMealPlanner('{broken')).toEqual(emptyMealPlanner());
  });
});
