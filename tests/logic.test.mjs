import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  seedState,
  aggregateShopping,
  addMealInstanceById,
  addMealInstance,
  updateTask,
  toggleShoppingLine,
  tryCombineUnits,
  lineKey,
  STORAGE_KEY,
} from "../demo/logic.js";

describe("shopping aggregation", () => {
  it("sums tomatoes from two meal instances in grams", () => {
    const s = seedState();
    const lines = aggregateShopping(s.mealInstances, s.shopping);
    const tom = lines.find((l) => l.name === "Tomatoes");
    assert.equal(tom.qty, 350);
    assert.equal(tom.sources.length, 2);
  });

  it("does not double when re-adding the same instance id", () => {
    const s = seedState();
    const inst = s.mealInstances[0];
    const next = addMealInstanceById(s, inst);
    assert.equal(next.mealInstances.length, s.mealInstances.length);
    const tom = aggregateShopping(next.mealInstances).find((l) => l.name === "Tomatoes");
    assert.equal(tom.qty, 350);
  });

  it("adds a second recipe instance", () => {
    let s = seedState();
    s = addMealInstance(s, "veggie-pasta", "Sun");
    const tom = aggregateShopping(s.mealInstances).find((l) => l.name === "Tomatoes");
    assert.equal(tom.qty, 550);
  });
});

describe("tasks", () => {
  it("keeps stable id when owner and day change", () => {
    let s = seedState();
    s = updateTask(s, "t1", { owner: "Mira", day: "Wed" });
    const t = s.tasks.find((x) => x.id === "t1");
    assert.equal(t.owner, "Mira");
    assert.equal(t.day, "Wed");
    assert.equal(s.tasks.filter((x) => x.id === "t1").length, 1);
  });
});

describe("checked lines reopen on qty change", () => {
  it("clears check and stores note", () => {
    let s = seedState();
    const key = lineKey("Tomatoes", "g");
    s = toggleShoppingLine(s, key, true);
    s = addMealInstance(s, "tomato-soup", "Sun");
    const line = aggregateShopping(s.mealInstances, s.shopping).find((l) => l.key === key);
    assert.equal(line.checked, false);
    assert.match(line.reopenNote, /Checked 350/);
  });
});

describe("units", () => {
  it("declines incompatible combine", () => {
    const r = tryCombineUnits(seedState(), "Tomatoes", "g", "Tomatoes", "kg");
    assert.equal(r.ok, false);
    assert.match(r.state.combineDeclined, /Cannot combine/);
  });
});

describe("storage key", () => {
  it("is app-specific", () => {
    assert.match(STORAGE_KEY, /^commonnest-independent/);
  });
});
