import { useMealPlannerStore } from './usePluginDataStores';
import { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Link2,
  Package,
  Plus,
  ShoppingBasket,
  Store,
  Trash2,
  Utensils,
} from 'lucide-react';
import { Badge, Button, Checkbox, EmptyState, Input, Tabs, TabsContent, TabsList, TabsTrigger, Textarea, cn } from '@/ui';
import { ChoiceInline } from './viewkit';
import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';
import { PopoverEditor } from './EntryPopover';
import { addDays, isoDate, weekOf, WEEKDAY_LABELS } from './planner';
import {
  FOOD_CATEGORIES,
  MEAL_TYPES,
  STORAGE_LOCATIONS,
  addGroceriesForMeals,
  assignOpenGroceriesToTrip,
  mealsOn,
  newMealPlannerId,
  type FoodCategory,
  type MealPlannerData,
  type MealType,
  type Recipe,
  type StorageLocation,
} from './mealPlanner';

const DEFAULT_BLOCK: Record<MealType, DayBlockId> = {
  Breakfast: 'morning-prime',
  Lunch: 'reset',
  Dinner: 'early-evening',
  Snack: 'early-evening',
};
type Persist = (update: (current: MealPlannerData) => MealPlannerData) => void;

export function MealPlannerView() {
  const [data, persist] = useMealPlannerStore();
  const [anchor, setAnchor] = useState(() => isoDate(new Date()));
  const week = useMemo(() => weekOf(anchor), [anchor]);
  const today = isoDate(new Date());


  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h2 className="text-sm font-semibold">Meal Planner</h2>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-mono text-xs">{week[0]} → {week[6]}</span>
          <Button size="icon-sm" variant="ghost" aria-label="Next week" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="size-4" />
          </Button>
          {!week.includes(today) && <Button size="sm" variant="ghost" onClick={() => setAnchor(today)}>This week</Button>}
        </div>
      </header>

      <Tabs defaultValue="plan" className="flex min-h-0 flex-1 flex-col">
        <div className="overflow-x-auto border-b border-border px-4">
          <TabsList variant="underline" className="min-w-max border-b-0">
            <TabsTrigger value="plan"><CalendarDays />Plan</TabsTrigger>
            <TabsTrigger value="recipes"><ChefHat />Recipes</TabsTrigger>
            <TabsTrigger value="shopping"><ShoppingBasket />Shopping</TabsTrigger>
            <TabsTrigger value="pantry"><Package />Pantry</TabsTrigger>
            <TabsTrigger value="prep"><ClipboardList />Meal prep</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="plan" className="m-0"><PlanView data={data} persist={persist} week={week} today={today} /></TabsContent>
        <TabsContent value="recipes" className="m-0"><RecipesView data={data} persist={persist} /></TabsContent>
        <TabsContent value="shopping" className="m-0"><ShoppingView data={data} persist={persist} week={week} /></TabsContent>
        <TabsContent value="pantry" className="m-0"><PantryView data={data} persist={persist} /></TabsContent>
        <TabsContent value="prep" className="m-0"><PrepView data={data} persist={persist} week={week} today={today} /></TabsContent>
      </Tabs>
    </div>
  );
}

function PlanView({ data, persist, week, today }: { data: MealPlannerData; persist: Persist; week: string[]; today: string }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [type, setType] = useState<MealType>('Dinner');
  const [servings, setServings] = useState(1);
  const [blockId, setBlockId] = useState<DayBlockId>(DEFAULT_BLOCK.Dinner);
  const [recipeId, setRecipeId] = useState('');

  const selectRecipe = (id: string) => {
    setRecipeId(id);
    const recipe = data.recipes.find((item) => item.id === id);
    if (recipe) {
      setTitle(recipe.title);
      setServings(recipe.servings);
    }
  };
  const addMeal = () => {
    if (!title.trim()) return;
    persist((current) => ({
      ...current,
      meals: [...current.meals, {
        id: newMealPlannerId('meal'), date, title: title.trim(), type, servings, blockId,
        recipeId: recipeId || undefined, done: false,
      }],
    }));
    setTitle('');
    setRecipeId('');
  };

  return (
    <div>
      <div className="border-b border-border p-4"><PopoverEditor title="Add meal">
        <ChoiceInline label="Recipe" value={recipeId} onChange={selectRecipe} clearable clearLabel="Custom meal" options={data.recipes.map((recipe) => ({ value: recipe.id, label: recipe.title }))} className="w-48" />
        <Input value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addMeal()} placeholder="Meal" className="h-8 w-56" />
        <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 w-36 text-xs" aria-label="Meal date" />
        <ChoiceInline label="Meal type" value={type} onChange={(value) => { const next = value as MealType; setType(next); setBlockId(DEFAULT_BLOCK[next]); }} options={MEAL_TYPES} />
        <Input type="number" min={1} value={servings} onChange={(event) => setServings(Math.max(1, Number(event.target.value) || 1))} className="h-8 w-24 text-xs" aria-label="Servings" />
        <ChoiceInline label="Day block" value={blockId} onChange={(value) => setBlockId(value as DayBlockId)} options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))} />
        <Button size="sm" onClick={addMeal}><Plus />Add meal</Button>
      </PopoverEditor></div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-7">
        {week.map((day, index) => {
          const meals = mealsOn(data, day);
          return (
            <section key={day} className={cn('min-h-40 rounded-md border border-border', day === today && 'border-primary/60 bg-primary/5')}>
              <header className="border-b border-border px-3 py-2">
                <h3 className="text-xs font-medium">{WEEKDAY_LABELS[index]} <span className="font-mono text-muted-foreground">{day.slice(5)}</span></h3>
              </header>
              <div className="flex flex-col gap-2 p-2">
                {meals.length === 0 && <p className="text-xs text-muted-foreground">No meals planned.</p>}
                {meals.map((meal) => {
                  const block = DAY_BLOCKS.find((item) => item.id === meal.blockId);
                  const prep = data.prepSessions.find((item) => item.id === meal.prepSessionId);
                  return (
                    <article key={meal.id} className="rounded border border-border bg-surface/70 p-2">
                      <div className="flex items-start gap-1.5">
                        <Checkbox checked={meal.done} onCheckedChange={(checked) => persist((current) => ({ ...current, meals: current.meals.map((item) => item.id === meal.id ? { ...item, done: checked === true } : item) }))} aria-label={`Mark ${meal.title} ${meal.done ? 'open' : 'done'}`} />
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-xs font-medium', meal.done && 'text-muted-foreground line-through')}>{meal.title}</p>
                          <p className="text-xxs text-muted-foreground">{meal.type} · {meal.servings} serving{meal.servings === 1 ? '' : 's'}</p>
                          {block && <p className="truncate text-xxs text-muted-foreground">{block.label}</p>}
                          {prep && <p className="mt-1 flex items-center gap-1 text-xxs text-primary"><Link2 className="size-3" />{prep.title}</p>}
                        </div>
                        <button type="button" aria-label={`Delete ${meal.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => persist((current) => ({ ...current, meals: current.meals.filter((item) => item.id !== meal.id), prepSessions: current.prepSessions.map((session) => ({ ...session, mealIds: session.mealIds.filter((id) => id !== meal.id) })) }))}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RecipesView({ data, persist }: { data: MealPlannerData; persist: Persist }) {
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState(4);
  const [prepMinutes, setPrepMinutes] = useState(15);
  const [cookMinutes, setCookMinutes] = useState(30);
  const [instructions, setInstructions] = useState('');
  const addRecipe = () => {
    if (!title.trim()) return;
    persist((current) => ({ ...current, recipes: [...current.recipes, { id: newMealPlannerId('recipe'), title: title.trim(), servings, prepMinutes, cookMinutes, instructions: instructions.trim() || undefined, ingredients: [] }] }));
    setTitle('');
    setInstructions('');
  };
  return (
    <div className="p-4">
      <section className="border-b border-border pb-3">
        <PopoverEditor title="Add recipe">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Recipe name" className="h-8 md:col-span-2" />
          <Input type="number" min={1} value={servings} onChange={(event) => setServings(Math.max(1, Number(event.target.value) || 1))} aria-label="Recipe servings" className="h-8" />
          <Button size="sm" onClick={addRecipe}><Plus />Add recipe</Button>
          <Input type="number" min={0} value={prepMinutes} onChange={(event) => setPrepMinutes(Math.max(0, Number(event.target.value) || 0))} aria-label="Prep minutes" className="h-8" placeholder="Prep minutes" />
          <Input type="number" min={0} value={cookMinutes} onChange={(event) => setCookMinutes(Math.max(0, Number(event.target.value) || 0))} aria-label="Cook minutes" className="h-8" placeholder="Cook minutes" />
          <Textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Method or notes" className="min-h-16 md:col-span-2" />
        </PopoverEditor>
      </section>
      {data.recipes.length === 0 ? <EmptyState icon={<ChefHat />} title="No recipes yet" description="Add recipes once, then reuse them in weekly plans and shopping lists." className="mt-8" /> : (
        <div className="mt-4 divide-y divide-border border-y border-border">
          {data.recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} persist={persist} />)}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe, persist }: { recipe: Recipe; persist: Persist }) {
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Produce');
  const [store, setStore] = useState('');
  const addIngredient = () => {
    if (!title.trim()) return;
    persist((current) => ({ ...current, recipes: current.recipes.map((item) => item.id === recipe.id ? { ...item, ingredients: [...item.ingredients, { id: newMealPlannerId('ingredient'), title: title.trim(), quantity: Number(quantity) > 0 ? Number(quantity) : undefined, unit: unit.trim() || undefined, category, store: store.trim() || undefined }] } : item) }));
    setTitle(''); setQuantity(''); setUnit('');
  };
  return (
    <section>
      <header className="flex items-start gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{recipe.title}</h3>
          <p className="text-xs text-muted-foreground">{recipe.servings} servings · {recipe.prepMinutes ?? 0} min prep · {recipe.cookMinutes ?? 0} min cook</p>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${recipe.title}`} onClick={() => persist((current) => ({ ...current, recipes: current.recipes.filter((item) => item.id !== recipe.id), meals: current.meals.map((meal) => meal.recipeId === recipe.id ? { ...meal, recipeId: undefined } : meal), prepSessions: current.prepSessions.map((session) => session.recipeId === recipe.id ? { ...session, recipeId: undefined } : session) }))}><Trash2 /></Button>
      </header>
      {recipe.instructions && <p className="whitespace-pre-wrap border-b border-border px-3 py-2 text-xs text-muted-foreground">{recipe.instructions}</p>}
      <ul className="divide-y divide-border">
        {recipe.ingredients.map((ingredient) => (
          <li key={ingredient.id} className="flex items-center gap-2 px-3 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate">{ingredient.title}</span>
            <span className="text-muted-foreground">{ingredient.quantity} {ingredient.unit}</span>
            <Badge variant="outline" className="rounded-sm bg-transparent">{ingredient.category}</Badge>
            {ingredient.store && <span className="text-muted-foreground">{ingredient.store}</span>}
            <button type="button" aria-label={`Remove ${ingredient.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => persist((current) => ({ ...current, recipes: current.recipes.map((item) => item.id === recipe.id ? { ...item, ingredients: item.ingredients.filter((entry) => entry.id !== ingredient.id) } : item) }))}><Trash2 className="size-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ingredient" className="h-8 min-w-40 flex-1" />
        <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} type="number" min={0} step="any" placeholder="Qty" className="h-8 w-20" />
        <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" className="h-8 w-20" />
        <ChoiceInline label="Ingredient category" value={category} onChange={(value) => setCategory(value as FoodCategory)} options={FOOD_CATEGORIES} />
        <Input value={store} onChange={(event) => setStore(event.target.value)} placeholder="Store" className="h-8 w-28" />
        <Button size="sm" variant="outline" onClick={addIngredient}><Plus />Ingredient</Button>
      </div>
    </section>
  );
}

function ShoppingView({ data, persist, week }: { data: MealPlannerData; persist: Persist; week: string[] }) {
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Other');
  const [store, setStore] = useState('');
  const [tripTitle, setTripTitle] = useState('Weekly shop');
  const [tripStore, setTripStore] = useState('');
  const [tripDate, setTripDate] = useState(week[0]);
  const weekMealIds = data.meals.filter((meal) => week.includes(meal.date)).map((meal) => meal.id);
  const recipeMealCount = data.meals.filter((meal) => week.includes(meal.date) && meal.recipeId).length;
  const addGrocery = () => {
    if (!title.trim()) return;
    persist((current) => ({ ...current, groceries: [...current.groceries, { id: newMealPlannerId('grocery'), title: title.trim(), quantity: quantity.trim() || undefined, unit: unit.trim() || undefined, category, store: store.trim() || undefined, sourceMealIds: [], checked: false }] }));
    setTitle(''); setQuantity(''); setUnit('');
  };
  const addTrip = () => {
    if (!tripTitle.trim()) return;
    persist((current) => ({ ...current, shoppingTrips: [...current.shoppingTrips, { id: newMealPlannerId('trip'), title: tripTitle.trim(), store: tripStore.trim() || undefined, date: tripDate, done: false }] }));
    setTripTitle('Weekly shop');
  };
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <section className="rounded-md border border-border">
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <ShoppingBasket className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Shopping list</h3>
          <span className="mr-auto text-xs text-muted-foreground">{data.groceries.filter((item) => !item.checked).length} left</span>
          <Button size="sm" variant="outline" disabled={recipeMealCount === 0} onClick={() => persist((current) => addGroceriesForMeals(current, weekMealIds))}>Generate from {recipeMealCount} planned meal{recipeMealCount === 1 ? '' : 's'}</Button>
        </header>
        <div className="border-b border-border p-3"><PopoverEditor title="Add grocery">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ingredient" className="h-8 min-w-40 flex-1" />
          <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Qty" className="h-8 w-20" />
          <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" className="h-8 w-20" />
          <ChoiceInline label="Grocery category" value={category} onChange={(value) => setCategory(value as FoodCategory)} options={FOOD_CATEGORIES} />
          <Input value={store} onChange={(event) => setStore(event.target.value)} placeholder="Store" className="h-8 w-28" />
          <Button size="sm" onClick={addGrocery}><Plus />Add</Button>
        </PopoverEditor></div>
        {data.groceries.length === 0 ? <EmptyState icon={<ShoppingBasket />} title="Shopping list is empty" description="Generate ingredients from this week's recipe-based meals or add an item." className="my-8" /> : (
          <ul className="divide-y divide-border">
            {data.groceries.map((item) => {
              const trip = data.shoppingTrips.find((entry) => entry.id === item.tripId);
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <Checkbox checked={item.checked} onCheckedChange={(checked) => persist((current) => ({ ...current, groceries: current.groceries.map((entry) => entry.id === item.id ? { ...entry, checked: checked === true } : entry) }))} aria-label={`Mark ${item.title} ${item.checked ? 'needed' : 'bought'}`} />
                  <span className={cn('min-w-32 flex-1 text-sm', item.checked && 'text-muted-foreground line-through')}>{item.title}</span>
                  {(item.quantity || item.unit) && <span className="text-xs text-muted-foreground">{item.quantity} {item.unit}</span>}
                  <Badge variant="outline" className="rounded-sm bg-transparent">{item.category}</Badge>
                  {item.store && <span className="text-xs text-muted-foreground">{item.store}</span>}
                  {item.sourceMealIds.length > 0 && <span title="Generated from planned meals"><Link2 className="size-3.5 text-primary" /></span>}
                  {trip && <Badge className="rounded-sm bg-transparent">{trip.title}</Badge>}
                  <button type="button" aria-label={`Delete ${item.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => persist((current) => ({ ...current, groceries: current.groceries.filter((entry) => entry.id !== item.id) }))}><Trash2 className="size-3.5" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="rounded-md border border-border">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2"><Store className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Shopping trips</h3></header>
        <div className="border-b border-border p-3"><PopoverEditor title="Add shopping trip">
          <Input value={tripTitle} onChange={(event) => setTripTitle(event.target.value)} placeholder="Trip name" className="h-8" />
          <div className="flex gap-1.5"><Input value={tripStore} onChange={(event) => setTripStore(event.target.value)} placeholder="Store" className="h-8" /><Input type="date" value={tripDate} onChange={(event) => setTripDate(event.target.value)} className="h-8" /></div>
          <Button size="sm" onClick={addTrip}><Plus />New trip</Button>
        </PopoverEditor></div>
        <div className="divide-y divide-border border-y border-border">
          {data.shoppingTrips.map((trip) => {
            const items = data.groceries.filter((item) => item.tripId === trip.id);
            return (
              <article key={trip.id} className="p-3">
                <div className="flex items-start gap-2">
                  <Checkbox checked={trip.done} onCheckedChange={(checked) => persist((current) => ({ ...current, shoppingTrips: current.shoppingTrips.map((item) => item.id === trip.id ? { ...item, done: checked === true } : item) }))} aria-label={`Mark ${trip.title} ${trip.done ? 'open' : 'done'}`} />
                  <div className="min-w-0 flex-1"><p className="text-sm font-medium">{trip.title}</p><p className="text-xs text-muted-foreground">{trip.date}{trip.store ? ` · ${trip.store}` : ''} · {items.length} items</p></div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${trip.title}`} onClick={() => persist((current) => ({ ...current, shoppingTrips: current.shoppingTrips.filter((item) => item.id !== trip.id), groceries: current.groceries.map((item) => item.tripId === trip.id ? { ...item, tripId: undefined } : item) }))}><Trash2 /></Button>
                </div>
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => persist((current) => assignOpenGroceriesToTrip(current, trip.id))}>Assign matching open items</Button>
              </article>
            );
          })}
          {data.shoppingTrips.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No shopping trips yet.</p>}
        </div>
      </section>
    </div>
  );
}

function PantryView({ data, persist }: { data: MealPlannerData; persist: Persist }) {
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Pantry');
  const [expiresOn, setExpiresOn] = useState('');
  const addItem = () => {
    if (!title.trim()) return;
    persist((current) => ({ ...current, pantry: [...current.pantry, { id: newMealPlannerId('pantry'), title: title.trim(), quantity: quantity.trim() || undefined, unit: unit.trim() || undefined, category, expiresOn: expiresOn || undefined }] }));
    setTitle(''); setQuantity(''); setUnit(''); setExpiresOn('');
  };
  const today = isoDate(new Date());
  return (
    <div className="p-4">
      <section className="rounded-md border border-border">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2"><Package className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Pantry inventory</h3><span className="text-xs text-muted-foreground">Items here are excluded from generated shopping lists.</span></header>
        <div className="border-b border-border p-3"><PopoverEditor title="Add pantry item">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ingredient" className="h-8 min-w-40 flex-1" />
          <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Qty" className="h-8 w-20" />
          <Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit" className="h-8 w-20" />
          <ChoiceInline label="Pantry category" value={category} onChange={(value) => setCategory(value as FoodCategory)} options={FOOD_CATEGORIES} />
          <Input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} className="h-8 w-36" aria-label="Use-by date" />
          <Button size="sm" onClick={addItem}><Plus />Add</Button>
        </PopoverEditor></div>
        {data.pantry.length === 0 ? <EmptyState icon={<Package />} title="Pantry is empty" description="Track ingredients you already have so shopping generation can skip them." className="my-8" /> : (
          <ul className="divide-y divide-border border-y border-border">
            {data.pantry.map((item) => <li key={item.id} className="flex items-center gap-2 px-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-sm">{item.title}</p><p className={cn('text-xs text-muted-foreground', item.expiresOn && item.expiresOn < today && 'text-destructive')}>{item.quantity} {item.unit}{item.expiresOn ? ` · use by ${item.expiresOn}` : ''}</p></div><Badge variant="outline" className="rounded-sm bg-transparent">{item.category}</Badge><button type="button" aria-label={`Remove ${item.title}`} className="text-muted-foreground hover:text-destructive" onClick={() => persist((current) => ({ ...current, pantry: current.pantry.filter((entry) => entry.id !== item.id) }))}><Trash2 className="size-3.5" /></button></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

function PrepView({ data, persist, week, today }: { data: MealPlannerData; persist: Persist; week: string[]; today: string }) {
  const [recipeId, setRecipeId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [blockId, setBlockId] = useState<DayBlockId>('reset');
  const [portions, setPortions] = useState(4);
  const [location, setLocation] = useState<StorageLocation>('Fridge');
  const [useBy, setUseBy] = useState('');
  const [mealIds, setMealIds] = useState<string[]>([]);
  const linkableMeals = data.meals.filter((meal) => week.includes(meal.date) && (!recipeId || meal.recipeId === recipeId));
  const selectRecipe = (id: string) => {
    setRecipeId(id);
    const recipe = data.recipes.find((item) => item.id === id);
    if (recipe) { setTitle(`Prep ${recipe.title}`); setPortions(recipe.servings); }
    setMealIds(data.meals.filter((meal) => week.includes(meal.date) && meal.recipeId === id).map((meal) => meal.id));
  };
  const addSession = () => {
    if (!title.trim()) return;
    const id = newMealPlannerId('prep');
    persist((current) => ({
      ...current,
      prepSessions: [...current.prepSessions, { id, title: title.trim(), date, blockId, recipeId: recipeId || undefined, mealIds, portions, portionsRemaining: portions, location, useBy: useBy || undefined, done: false }],
      meals: current.meals.map((meal) => mealIds.includes(meal.id) ? { ...meal, prepSessionId: id } : meal),
    }));
    setTitle(''); setRecipeId(''); setMealIds([]); setUseBy('');
  };
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[auto_minmax(0,1fr)]">
      <section className="self-start"><PopoverEditor title="Schedule batch prep">
          <ChoiceInline label="Prep recipe" value={recipeId} onChange={selectRecipe} clearable clearLabel="No recipe" options={data.recipes.map((recipe) => ({ value: recipe.id, label: recipe.title }))} />
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prep session" className="h-8" />
          <div className="flex gap-2"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8" /><ChoiceInline label="Prep day block" value={blockId} onChange={(value) => setBlockId(value as DayBlockId)} options={DAY_BLOCKS.map((block) => ({ value: block.id, label: block.label }))} className="min-w-0 flex-1" /></div>
          <div className="flex gap-2"><Input type="number" min={1} value={portions} onChange={(event) => setPortions(Math.max(1, Number(event.target.value) || 1))} className="h-8" aria-label="Prepared portions" /><ChoiceInline label="Storage location" value={location} onChange={(value) => setLocation(value as StorageLocation)} options={STORAGE_LOCATIONS} /></div>
          <Input type="date" value={useBy} onChange={(event) => setUseBy(event.target.value)} className="h-8" aria-label="Use-by date" />
          {linkableMeals.length > 0 && <fieldset className="rounded border border-border p-2"><legend className="px-1 text-xs text-muted-foreground">Link planned meals</legend>{linkableMeals.map((meal) => <label key={meal.id} className="flex items-center gap-2 py-1 text-xs"><Checkbox checked={mealIds.includes(meal.id)} onCheckedChange={(checked) => setMealIds((current) => checked === true ? [...new Set([...current, meal.id])] : current.filter((id) => id !== meal.id))} />{meal.date} · {meal.title}</label>)}</fieldset>}
          <Button size="sm" onClick={addSession}><Plus />Add prep session</Button>
      </PopoverEditor></section>
      <section className="rounded-md border border-border">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2"><ClipboardList className="size-4 text-muted-foreground" /><h3 className="text-sm font-medium">Prepared food & leftovers</h3></header>
        {data.prepSessions.length === 0 ? <EmptyState icon={<Utensils />} title="Nothing prepped yet" description="Schedule a batch, choose its day block, and link the meals it will supply." className="my-8" /> : (
          <div className="divide-y divide-border border-y border-border">
            {data.prepSessions.map((session) => {
              const block = DAY_BLOCKS.find((item) => item.id === session.blockId);
              const linked = data.meals.filter((meal) => session.mealIds.includes(meal.id));
              return (
                <article key={session.id} className="p-3">
                  <div className="flex items-start gap-2"><Checkbox checked={session.done} onCheckedChange={(checked) => persist((current) => ({ ...current, prepSessions: current.prepSessions.map((item) => item.id === session.id ? { ...item, done: checked === true } : item) }))} aria-label={`Mark ${session.title} ${session.done ? 'open' : 'done'}`} /><div className="min-w-0 flex-1"><h4 className={cn('text-sm font-medium', session.done && 'text-muted-foreground line-through')}>{session.title}</h4><p className="text-xs text-muted-foreground">{session.date}{block ? ` · ${block.label}` : ''}</p></div><Button size="icon-sm" variant="ghost" aria-label={`Delete ${session.title}`} onClick={() => persist((current) => ({ ...current, prepSessions: current.prepSessions.filter((item) => item.id !== session.id), meals: current.meals.map((meal) => meal.prepSessionId === session.id ? { ...meal, prepSessionId: undefined } : meal) }))}><Trash2 /></Button></div>
                  <div className="mt-3 flex flex-wrap gap-1.5"><Badge className="rounded-sm bg-transparent">{session.portionsRemaining} / {session.portions} portions</Badge><Badge variant="outline" className="rounded-sm bg-transparent">{session.location}</Badge>{session.useBy && <Badge variant={session.useBy < today ? 'destructive' : 'outline'} className="rounded-sm bg-transparent">Use by {session.useBy}</Badge>}</div>
                  {linked.length > 0 && <p className="mt-2 text-xs text-muted-foreground"><Link2 className="mr-1 inline size-3" />{linked.map((meal) => `${meal.date} ${meal.title}`).join(', ')}</p>}
                  <Button size="sm" variant="outline" className="mt-3" disabled={session.portionsRemaining === 0} onClick={() => persist((current) => ({ ...current, prepSessions: current.prepSessions.map((item) => item.id === session.id ? { ...item, portionsRemaining: Math.max(0, item.portionsRemaining - 1) } : item) }))}>Use one portion</Button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
