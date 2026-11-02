import {
  STORAGE_KEY,
  DAYS,
  OWNERS,
  RECIPES,
  seedState,
  sanitizeParsedState,
  shoppingWithPantry,
  scheduleMeal,
  addIngredientsForMeal,
  updateTask,
  toggleShoppingLine,
  tasksForDay,
} from "./logic.js";

const $ = (sel, root = document) => root.querySelector(sel);

let state = seedState();
let storageOk = true;
/** @type {{ kind: string, label?: string, mealId?: string, recipeId?: string } | null} */
let focusAfterRender = null;

function storageAvailable() {
  try {
    localStorage.getItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    return sanitizeParsedState(JSON.parse(raw));
  } catch {
    return seedState();
  }
}

function saveState() {
  if (!storageOk) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    storageOk = false;
    $("#storageBanner").hidden = false;
  }
}

function applyFocusReturn() {
  if (!focusAfterRender) return;
  const target = focusAfterRender;
  focusAfterRender = null;
  if (target.kind === "taskDay" && target.label) {
    const sel = document.querySelector(`#taskList select[aria-label="${CSS.escape(target.label)}"]`);
    sel?.focus();
    sel?.scrollIntoView({ block: "nearest" });
  } else if (target.kind === "taskOwner" && target.label) {
    const sel = document.querySelector(`#taskList select[aria-label="${CSS.escape(target.label)}"]`);
    sel?.focus();
  } else if (target.kind === "schedule" && target.recipeId) {
    const wrap = document.querySelector(`[data-schedule-recipe="${target.recipeId}"] button`);
    wrap?.focus();
  } else if (target.kind === "mealAdd" && target.mealId) {
    const btn = document.querySelector(`button[data-meal-id="${CSS.escape(target.mealId)}"]`);
    btn?.focus();
  }
}

function ownerInitial(name) {
  return name.charAt(0);
}

function renderWeek() {
  const host = $("#weekGrid");
  host.replaceChildren();
  for (const day of DAYS) {
    const col = document.createElement("article");
    col.className = "day-col";
    const h = document.createElement("h3");
    h.textContent = day;
    col.appendChild(h);

    const tasks = tasksForDay(state, day);
    if (tasks.length) {
      const tUl = document.createElement("ul");
      tUl.className = "agenda-tasks";
      for (const t of tasks) {
        const li = document.createElement("li");
        const badge = document.createElement("span");
        badge.className = "owner-badge";
        badge.title = t.owner;
        badge.textContent = ownerInitial(t.owner);
        li.append(badge, document.createTextNode(` ${t.title}`));
        tUl.appendChild(li);
      }
      col.appendChild(tUl);
    }

    const meals = state.mealInstances.filter((m) => m.day === day);
    if (meals.length) {
      const mUl = document.createElement("ul");
      mUl.className = "agenda-meals";
      for (const m of meals) {
        const li = document.createElement("li");
        const recipe = RECIPES[m.recipeId];
        li.appendChild(document.createTextNode(recipe?.name || m.recipeId));
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn-inline";
        addBtn.dataset.mealId = m.id;
        const counted = state.ingredientsCountedIds.includes(m.id);
        addBtn.textContent = counted ? "Ingredients already on list" : "Add ingredients to list";
        addBtn.disabled = counted;
        addBtn.addEventListener("click", () => {
          state = addIngredientsForMeal(state, m.id);
          saveState();
          focusAfterRender = { kind: "mealAdd", mealId: m.id };
          renderAll();
        });
        li.appendChild(document.createElement("br"));
        li.appendChild(addBtn);
        mUl.appendChild(li);
      }
      col.appendChild(mUl);
    }

    if (!tasks.length && !meals.length) {
      const empty = document.createElement("p");
      empty.className = "day-empty";
      empty.textContent = "—";
      col.appendChild(empty);
    }

    host.appendChild(col);
  }
}

function renderTasks() {
  const host = $("#taskList");
  host.replaceChildren();
  for (const task of state.tasks) {
    const li = document.createElement("li");
    li.className = "task-row";
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;
    const ownerLabel = document.createElement("label");
    ownerLabel.textContent = "Owner ";
    const ownerAria = `Owner for ${task.title}`;
    const ownerSel = document.createElement("select");
    ownerSel.setAttribute("aria-label", ownerAria);
    for (const o of OWNERS) {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      if (o === task.owner) opt.selected = true;
      ownerSel.appendChild(opt);
    }
    ownerSel.addEventListener("change", () => {
      state = updateTask(state, task.id, { owner: ownerSel.value });
      saveState();
      focusAfterRender = { kind: "taskOwner", label: ownerAria };
      renderAll();
    });
    ownerLabel.appendChild(ownerSel);
    const dayLabel = document.createElement("label");
    dayLabel.textContent = " Due ";
    const dayAria = `Due day for ${task.title}`;
    const daySel = document.createElement("select");
    daySel.setAttribute("aria-label", dayAria);
    for (const d of DAYS) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (d === task.day) opt.selected = true;
      daySel.appendChild(opt);
    }
    daySel.addEventListener("change", () => {
      state = updateTask(state, task.id, { day: daySel.value });
      saveState();
      focusAfterRender = { kind: "taskDay", label: dayAria };
      renderAll();
    });
    dayLabel.appendChild(daySel);
    li.append(title, ownerLabel, dayLabel);
    host.appendChild(li);
  }
}

function renderMealsControls() {
  const host = $("#mealControls");
  host.replaceChildren();
  for (const rid of Object.keys(RECIPES)) {
    const recipe = RECIPES[rid];
    const wrap = document.createElement("div");
    wrap.className = "meal-add";
    wrap.dataset.scheduleRecipe = rid;
    const title = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = recipe.name;
    title.appendChild(strong);
    wrap.appendChild(title);
    const daySel = document.createElement("select");
    daySel.setAttribute("aria-label", `Day to schedule ${recipe.name}`);
    for (const d of DAYS) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      daySel.appendChild(opt);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Schedule another night";
    btn.addEventListener("click", () => {
      state = scheduleMeal(state, rid, daySel.value);
      saveState();
      focusAfterRender = { kind: "schedule", recipeId: rid };
      renderAll();
    });
    wrap.append(daySel, btn);
    host.appendChild(wrap);
  }
  const fb = $("#mealFeedback");
  fb.textContent = state.mealFeedback || "";
  fb.hidden = !state.mealFeedback;
}

function renderShopping() {
  const lines = shoppingWithPantry(
    state.mealInstances,
    state.shopping,
    state.ingredientsCountedIds,
  );
  const host = $("#shoppingList");
  host.replaceChildren();
  for (const line of lines) {
    const li = document.createElement("li");
    li.className = line.checked ? "checked" : "";
    if (line.fromPantry) li.classList.add("pantry-line");
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = line.checked;
    cb.addEventListener("change", () => {
      state = toggleShoppingLine(state, line.key, cb.checked);
      saveState();
      renderAll();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` ${line.qty} ${line.unit} ${line.name}`));
    li.appendChild(label);
    if (line.sources?.length) {
      const src = document.createElement("p");
      src.className = "sources";
      src.textContent = `Meals: ${line.sources.map((s) => `${s.recipeName} (${s.day})`).join("; ")}`;
      li.appendChild(src);
    }
    if (line.note) {
      const note = document.createElement("p");
      note.className = "unit-note";
      note.textContent = line.note;
      li.appendChild(note);
    }
    if (line.reopenNote) {
      const note = document.createElement("p");
      note.className = "reopen";
      note.textContent = line.reopenNote;
      li.appendChild(note);
    }
    host.appendChild(li);
  }
}

function renderAll() {
  renderWeek();
  renderTasks();
  renderMealsControls();
  renderShopping();
  applyFocusReturn();
}

function bindReset() {
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Reset this week? Tasks, meals, and shopping return to the sample plan.")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    state = seedState();
    storageOk = storageAvailable();
    focusAfterRender = null;
    $("#storageBanner").hidden = storageOk;
    renderAll();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.documentElement.dataset.storageUnavailable === "1") {
    storageOk = false;
    state = seedState();
    $("#storageBanner").hidden = false;
  } else {
    storageOk = storageAvailable();
    state = storageOk ? loadState() : seedState();
    if (!storageOk) $("#storageBanner").hidden = false;
  }
  renderAll();
  bindReset();
});
