import {
  STORAGE_KEY,
  DAYS,
  OWNERS,
  RECIPES,
  seedState,
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

function storageAvailable() {
  try {
    localStorage.getItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState();
  const parsed = JSON.parse(raw);
  const base = seedState();
  return {
    ...base,
    ...parsed,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : base.tasks,
    mealInstances: Array.isArray(parsed.mealInstances) ? parsed.mealInstances : base.mealInstances,
    ingredientsCountedIds: Array.isArray(parsed.ingredientsCountedIds)
      ? parsed.ingredientsCountedIds
      : base.ingredientsCountedIds,
    shopping: parsed.shopping && typeof parsed.shopping === "object" ? parsed.shopping : {},
  };
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
        li.innerHTML = `<span class="owner-badge" title="${t.owner}">${ownerInitial(t.owner)}</span> ${t.title}`;
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
        li.textContent = recipe?.name || m.recipeId;
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn-inline";
        const counted = state.ingredientsCountedIds.includes(m.id);
        addBtn.textContent = counted ? "Ingredients already on list" : "Add ingredients to list";
        addBtn.disabled = counted;
        addBtn.addEventListener("click", () => {
          state = addIngredientsForMeal(state, m.id);
          saveState();
          renderAll();
          addBtn.focus();
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
    const ownerSel = document.createElement("select");
    ownerSel.setAttribute("aria-label", `Owner for ${task.title}`);
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
      renderAll();
    });
    ownerLabel.appendChild(ownerSel);
    const dayLabel = document.createElement("label");
    dayLabel.textContent = " Due ";
    const daySel = document.createElement("select");
    daySel.setAttribute("aria-label", `Due day for ${task.title}`);
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
      renderAll();
      daySel.focus();
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
    const title = document.createElement("p");
    title.innerHTML = `<strong>${recipe.name}</strong>`;
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
      renderAll();
      btn.focus();
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
    storageOk = true;
    $("#storageBanner").hidden = true;
    renderAll();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  storageOk = storageAvailable();
  state = storageOk ? loadState() : seedState();
  if (!storageOk) $("#storageBanner").hidden = false;
  renderAll();
  bindReset();
});
