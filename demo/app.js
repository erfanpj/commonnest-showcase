import {
  STORAGE_KEY,
  DAYS,
  OWNERS,
  RECIPES,
  seedState,
  aggregateShopping,
  addMealInstance,
  addMealInstanceById,
  updateTask,
  toggleShoppingLine,
  tryCombineUnits,
} from "./logic.js";

const $ = (sel, root = document) => root.querySelector(sel);

let state = seedState();
let storageOk = true;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    return { ...seedState(), ...JSON.parse(raw) };
  } catch {
    storageOk = false;
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

function renderTasks() {
  const host = $("#taskList");
  host.replaceChildren();
  for (const task of state.tasks) {
    const li = document.createElement("li");
    li.className = "task-row";
    li.dataset.taskId = task.id;
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
    });
    dayLabel.appendChild(daySel);
    li.append(title, ownerLabel, dayLabel);
    host.appendChild(li);
  }
}

function renderWeek() {
  const host = $("#weekGrid");
  host.replaceChildren();
  for (const day of DAYS) {
    const col = document.createElement("div");
    col.className = "day-col";
    const h = document.createElement("h3");
    h.textContent = day;
    col.appendChild(h);
    const meals = state.mealInstances.filter((m) => m.day === day);
    const ul = document.createElement("ul");
    for (const m of meals) {
      const li = document.createElement("li");
      li.textContent = RECIPES[m.recipeId]?.name || m.recipeId;
      ul.appendChild(li);
    }
    col.appendChild(ul);
    host.appendChild(col);
  }
}

function renderMealsControls() {
  const host = $("#mealControls");
  host.replaceChildren();
  for (const rid of Object.keys(RECIPES)) {
    const recipe = RECIPES[rid];
    const wrap = document.createElement("div");
    wrap.className = "meal-add";
    wrap.innerHTML = `<p><strong>${recipe.name}</strong></p>`;
    const daySel = document.createElement("select");
    daySel.setAttribute("aria-label", `Day for ${recipe.name}`);
    for (const d of DAYS) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      daySel.appendChild(opt);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Add meal instance";
    btn.addEventListener("click", () => {
      state = addMealInstance(state, rid, daySel.value);
      saveState();
      renderAll();
    });
    const dupBtn = document.createElement("button");
    dupBtn.type = "button";
    dupBtn.className = "btn-quiet";
    dupBtn.textContent = "Re-add same instance id (no-op)";
    dupBtn.addEventListener("click", () => {
      const existing = state.mealInstances.find((m) => m.recipeId === rid);
      if (existing) state = addMealInstanceById(state, existing);
      saveState();
      renderAll();
    });
    wrap.append(daySel, btn, dupBtn);
    host.appendChild(wrap);
  }
}

function renderShopping() {
  const lines = aggregateShopping(state.mealInstances, state.shopping);
  const host = $("#shoppingList");
  host.replaceChildren();
  for (const line of lines) {
    const li = document.createElement("li");
    li.className = line.checked ? "checked" : "";
    const id = `shop-${line.key}`;
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = id;
    cb.checked = line.checked;
    cb.addEventListener("change", () => {
      state = toggleShoppingLine(state, line.key, cb.checked);
      saveState();
      renderAll();
    });
    label.appendChild(cb);
    label.appendChild(
      document.createTextNode(` ${line.qty} ${line.unit} ${line.name}`),
    );
    li.appendChild(label);
    const src = document.createElement("p");
    src.className = "sources";
    src.textContent = `From: ${line.sources.map((s) => `${s.recipeName} (${s.day})`).join("; ")}`;
    li.appendChild(src);
    if (line.reopenNote) {
      const note = document.createElement("p");
      note.className = "reopen";
      note.textContent = line.reopenNote;
      li.appendChild(note);
    }
    host.appendChild(li);
  }
  if (state.combineDeclined) {
    const p = $("#combineMsg");
    p.textContent = state.combineDeclined;
    p.hidden = false;
  } else {
    $("#combineMsg").hidden = true;
  }
}

function renderAll() {
  renderWeek();
  renderTasks();
  renderMealsControls();
  renderShopping();
}

function bindCombineDemo() {
  $("#combineBtn").addEventListener("click", () => {
    const r = tryCombineUnits(state, "Tomatoes", "g", "Tomatoes", "kg");
    state = r.state;
    saveState();
    renderAll();
  });
}

function bindReset() {
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("Reset this demo only? Tasks, meals, and shopping checks return to the seed week.")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    state = seedState();
    storageOk = true;
    renderAll();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  state = loadState();
  if (!storageOk) $("#storageBanner").hidden = false;
  renderAll();
  bindCombineDemo();
  bindReset();
});
