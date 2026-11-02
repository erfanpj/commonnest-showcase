/** Fictional week planner — pure logic for tests and UI. */

export const STORAGE_KEY = "commonnest-independent-demo-v1";

export const OWNERS = ["Mira", "Noah"];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const RECIPES = {
  "veggie-pasta": {
    id: "veggie-pasta",
    name: "Colourful vegetable pasta",
    ingredients: [
      { name: "Tomatoes", unit: "g", qty: 200 },
      { name: "Spinach", unit: "g", qty: 100 },
      { name: "Pasta", unit: "g", qty: 180 },
    ],
  },
  "tomato-soup": {
    id: "tomato-soup",
    name: "Quick tomato soup",
    ingredients: [{ name: "Tomatoes", unit: "g", qty: 150 }],
  },
};

/** Pantry line — different unit from recipe grams; never auto-combined. */
export const PANTRY_LINES = [
  {
    key: "tomatoes::kg",
    name: "Tomatoes",
    unit: "kg",
    qty: 1,
    note: "Pantry bag — kilograms are kept separate from recipe amounts in grams.",
  },
];

export function seedState() {
  return {
    tasks: [
      { id: "t1", title: "Pick up vegetables", owner: "Noah", day: "Mon" },
      { id: "t2", title: "Choose two dinners", owner: "Mira", day: "Mon" },
      { id: "t3", title: "Book weekend activity", owner: "Mira", day: "Fri" },
    ],
    mealInstances: [
      { id: "m1", recipeId: "veggie-pasta", day: "Thu" },
      { id: "m2", recipeId: "tomato-soup", day: "Sat" },
    ],
    ingredientsCountedIds: ["m1", "m2"],
    shopping: {},
    mealFeedback: null,
  };
}

export function normalizeName(name) {
  return name.trim().toLowerCase();
}

export function lineKey(name, unit) {
  return `${normalizeName(name)}::${unit}`;
}

export function aggregateShopping(mealInstances, shoppingMeta = {}, countedIds = null) {
  const allowed = countedIds
    ? mealInstances.filter((m) => countedIds.includes(m.id))
    : mealInstances;
  const lines = new Map();
  for (const inst of allowed) {
    const recipe = RECIPES[inst.recipeId];
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      const key = lineKey(ing.name, ing.unit);
      const prev = lines.get(key) || {
        key,
        name: ing.name,
        unit: ing.unit,
        qty: 0,
        sources: [],
        fromPantry: false,
      };
      prev.qty += ing.qty;
      prev.sources.push({ mealInstanceId: inst.id, recipeName: recipe.name, day: inst.day });
      lines.set(key, prev);
    }
  }
  const result = [...lines.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const line of result) {
    const meta = shoppingMeta[line.key] || {};
    line.checked = Boolean(meta.checked);
    line.reopenNote = meta.reopenNote || null;
  }
  return result;
}

export function shoppingWithPantry(mealInstances, shoppingMeta, countedIds) {
  const mealLines = aggregateShopping(mealInstances, shoppingMeta, countedIds);
  const pantry = PANTRY_LINES.map((p) => ({
    ...p,
    sources: [],
    checked: Boolean(shoppingMeta[p.key]?.checked),
    reopenNote: shoppingMeta[p.key]?.reopenNote || null,
    fromPantry: true,
  }));
  return [...mealLines, ...pantry].sort((a, b) =>
    `${a.name}${a.unit}`.localeCompare(`${b.name}${b.unit}`),
  );
}

export function scheduleMeal(state, recipeId, day) {
  const id = `m-${state.mealInstances.length + 1}-${recipeId}-${day}`;
  return {
    ...state,
    mealInstances: [...state.mealInstances, { id, recipeId, day }],
    mealFeedback: `Scheduled ${RECIPES[recipeId]?.name ?? recipeId} on ${day}. Add ingredients when ready.`,
  };
}

export function addIngredientsForMeal(state, instanceId) {
  if (!state.mealInstances.some((m) => m.id === instanceId)) {
    return { ...state, mealFeedback: "That meal is not on the week plan." };
  }
  if (state.ingredientsCountedIds.includes(instanceId)) {
    return { ...state, mealFeedback: "Ingredients from that meal are already on the list." };
  }
  const prev = structuredClone(state);
  const next = {
    ...state,
    ingredientsCountedIds: [...state.ingredientsCountedIds, instanceId],
    mealFeedback: "Added ingredients from that meal to the shopping list.",
  };
  return reconcileShoppingAfterMealsChange(prev, next);
}

export function updateTask(state, taskId, patch) {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  };
}

export function tasksForDay(state, day) {
  return state.tasks.filter((t) => t.day === day);
}

export function toggleShoppingLine(state, lineKeyStr, checked) {
  const shopping = { ...state.shopping };
  shopping[lineKeyStr] = { ...(shopping[lineKeyStr] || {}), checked, reopenNote: null };
  return { ...state, shopping };
}

export function reconcileShoppingAfterMealsChange(prevState, nextState) {
  const prevLines = shoppingWithPantry(
    prevState.mealInstances,
    prevState.shopping,
    prevState.ingredientsCountedIds,
  );
  const nextLines = shoppingWithPantry(
    nextState.mealInstances,
    nextState.shopping,
    nextState.ingredientsCountedIds,
  );
  const shopping = { ...nextState.shopping };
  for (const nl of nextLines) {
    if (nl.fromPantry) continue;
    const pl = prevLines.find((x) => x.key === nl.key && !x.fromPantry);
    const meta = shopping[nl.key] || {};
    if (meta.checked && pl && pl.qty !== nl.qty) {
      shopping[nl.key] = {
        checked: false,
        reopenNote: `You checked off ${pl.qty} ${nl.unit}; the list now shows ${nl.qty} ${nl.unit}. Review and check again.`,
      };
    }
  }
  return { ...nextState, shopping };
}

export function emptyState() {
  return seedState();
}

export const PAGES_PATH_PREFIX = "/commonnest-showcase";
