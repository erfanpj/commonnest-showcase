import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  seedState,
  shoppingWithPantry,
  scheduleMeal,
  addIngredientsForMeal,
  updateTask,
  toggleShoppingLine,
  tasksForDay,
  STORAGE_KEY,
} from "../logic.js";

describe("week agenda", () => {
  it("lists tasks on their due day only", () => {
    let s = seedState();
    assert.equal(tasksForDay(s, "Mon").length, 2);
    s = updateTask(s, "t1", { day: "Wed" });
    assert.equal(tasksForDay(s, "Wed").length, 1);
    assert.equal(tasksForDay(s, "Mon").length, 1);
  });
});

describe("shopping", () => {
  it("sums counted meal ingredients and shows pantry kg separately", () => {
    const s = seedState();
    const lines = shoppingWithPantry(s.mealInstances, s.shopping, s.ingredientsCountedIds);
    const g = lines.find((l) => l.unit === "g" && l.name === "Tomatoes");
    const kg = lines.find((l) => l.unit === "kg");
    assert.equal(g.qty, 350);
    assert.equal(kg.qty, 1);
    assert.ok(kg.note);
  });

  it("refuses duplicate ingredient add for same meal", () => {
    let s = seedState();
    const r = addIngredientsForMeal(s, "m1");
    assert.match(r.mealFeedback, /already/i);
  });

  it("reopens checked line when qty increases", () => {
    let s = seedState();
    const key = "tomatoes::g";
    s = toggleShoppingLine(s, key, true);
    s = scheduleMeal(s, "tomato-soup", "Sun");
    const newId = s.mealInstances.at(-1).id;
    s = addIngredientsForMeal(s, newId);
    const line = shoppingWithPantry(s.mealInstances, s.shopping, s.ingredientsCountedIds).find(
      (l) => l.key === key,
    );
    assert.equal(line.checked, false);
    assert.match(line.reopenNote, /500/);
  });
});

describe("storage key", () => {
  it("is app-specific", () => {
    assert.match(STORAGE_KEY, /^commonnest-independent/);
  });
});
