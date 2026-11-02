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
    shopping: {},
    combineDeclined: null,
  };
}

export function normalizeName(name) {
  return name.trim().toLowerCase();
}

export function lineKey(name, unit) {
  return `${normalizeName(name)}::${unit}`;
}

export function aggregateShopping(mealInstances, shoppingMeta = {}) {
  const lines = new Map();
  for (const inst of mealInstances) {
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

export function addMealInstance(state, recipeId, day) {
  const id = `m-${state.mealInstances.length + 1}-${recipeId}`;
  const next = {
    ...state,
    mealInstances: [...state.mealInstances, { id, recipeId, day }],
    combineDeclined: null,
  };
  return reconcileShoppingAfterMealsChange(state, next);
}

export function addMealInstanceById(state, instance) {
  if (state.mealInstances.some((m) => m.id === instance.id)) return state;
  const next = {
    ...state,
    mealInstances: [...state.mealInstances, instance],
    combineDeclined: null,
  };
  return reconcileShoppingAfterMealsChange(state, next);
}

export function updateTask(state, taskId, patch) {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  };
}

export function toggleShoppingLine(state, lineKeyStr, checked) {
  const shopping = { ...state.shopping };
  shopping[lineKeyStr] = { ...(shopping[lineKeyStr] || {}), checked, reopenNote: null };
  return { ...state, shopping };
}

export function reconcileShoppingAfterMealsChange(prevState, nextState) {
  const prevLines = aggregateShopping(prevState.mealInstances, prevState.shopping);
  const nextLines = aggregateShopping(nextState.mealInstances, nextState.shopping);
  const shopping = { ...nextState.shopping };
  for (const nl of nextLines) {
    const pl = prevLines.find((x) => x.key === nl.key);
    const meta = shopping[nl.key] || {};
    if (meta.checked && pl && pl.qty !== nl.qty) {
      shopping[nl.key] = {
        checked: false,
        reopenNote: `Checked ${pl.qty} ${nl.unit} → now ${nl.qty} ${nl.unit}; check again after review.`,
      };
    }
  }
  return { ...nextState, shopping };
}

export function tryCombineUnits(state, nameA, unitA, nameB, unitB) {
  if (unitA === unitB) return { ok: true, state };
  return {
    ok: false,
    state: {
      ...state,
      combineDeclined: `Cannot combine ${unitA} and ${unitB} for ${nameA}. Keep separate lines.`,
    },
  };
}

export function emptyState() {
  return seedState();
}
