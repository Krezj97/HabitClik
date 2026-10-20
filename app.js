"use strict";

const STORAGE_KEY = "habitclik:v1";
const CATEGORIES = {
  salud: { label: "Salud", icon: "💧", background: "#e6f7ff" },
  movimiento: { label: "Movimiento", icon: "🏃", background: "#fff0de" },
  mente: { label: "Mente", icon: "📚", background: "#f0ecff" },
  productividad: { label: "Productividad", icon: "🎯", background: "#eaf4e4" },
  bienestar: { label: "Bienestar", icon: "🌱", background: "#e7f5e9" },
  otros: { label: "Otros", icon: "✨", background: "#eff3f8" }
};
const $ = (id) => document.getElementById(id);
const dateFormat = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
let toastTimer;
let currentView = "today";
let editingId = null;

function keyForDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function localDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function newId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "h-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

function starterData() {
  const now = keyForDate(new Date());
  return {
    habits: [
      { id: newId(), title: "Beber suficiente agua", category: "salud", createdAt: now },
      { id: newId(), title: "Leer 15 minutos", category: "mente", createdAt: now },
      { id: newId(), title: "Mover el cuerpo", category: "movimiento", createdAt: now }
    ],
    logs: {}
  };
}

function normalizeData(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.habits) ||
      !input.logs || typeof input.logs !== "object" || Array.isArray(input.logs)) {
    throw new Error("El archivo no tiene el formato de HabitClik.");
  }
  if (input.habits.length > 200 || Object.keys(input.logs).length > 5000) {
    throw new Error("El archivo contiene demasiados registros.");
  }
  const seen = new Set();
  const habits = [];
  const today = keyForDate(new Date());
  for (const habit of input.habits) {
    if (!habit || typeof habit !== "object" ||
        typeof habit.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(habit.id) ||
        typeof habit.title !== "string" || habit.title.trim().length < 2 ||
        habit.title.trim().length > 60 || seen.has(habit.id)) continue;
    seen.add(habit.id);
    habits.push({
      id: habit.id,
      title: habit.title.trim(),
      category: Object.hasOwn(CATEGORIES, habit.category) ? habit.category : "otros",
      createdAt: typeof habit.createdAt === "string" && isValidDateKey(habit.createdAt)
        ? habit.createdAt : today
    });
  }
  const logs = {};
  for (const [day, values] of Object.entries(input.logs)) {
    if (!isValidDateKey(day) || !Array.isArray(values)) continue;
    const valid = [...new Set(values.filter((id) => typeof id === "string" && seen.has(id)))];
    if (valid.length) logs[day] = valid;
  }
  return { habits, logs };
}

function isValidDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return keyForDate(localDate(key)) === key;
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3300);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeData(JSON.parse(raw)) : starterData();
  } catch (error) {
    console.warn("HabitClik: no se pudieron leer los datos locales.", error);
    return starterData();
  }
}

let data = loadData();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("HabitClik: no se pudieron guardar los datos.", error);
    showToast("No se pudieron guardar los cambios en este navegador.");
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function completedIds(day) {
  return data.logs[day] || [];
}

function completedCount(day) {
  return completedIds(day).length;
}

function activeHabitsOn(day) {
  return data.habits.filter((habit) => habit.createdAt <= day).length;
}

function totalCompletions() {
  return Object.values(data.logs).reduce((sum, ids) => sum + ids.length, 0);
}

function streakWith(predicate) {
  const today = new Date();
  let cursor = predicate(keyForDate(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (streak < 5000 && predicate(keyForDate(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function currentStreak() {
  return streakWith((day) => completedCount(day) > 0);
}

function habitStreak(id) {
  return streakWith((day) => completedIds(day).includes(id));
}

function bestStreak() {
  const days = Object.keys(data.logs).filter((day) => completedCount(day) > 0).sort();
  let best = 0;
  let consecutive = 0;
  let previous = null;
  for (const day of days) {
    consecutive = previous && keyForDate(addDays(localDate(previous), 1)) === day
      ? consecutive + 1 : 1;
    best = Math.max(best, consecutive);
    previous = day;
  }
  return best;
}

function renderWeek() {
  const today = new Date();
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const todayKey = keyForDate(today);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const key = keyForDate(date);
    const done = completedCount(key);
    const total = activeHabitsOn(key);
    const isToday = key === todayKey;
    const future = key > todayKey;
    const status = done && total && done >= total ? "full-progress" : done ? "has-progress" : "";
    const dayName = new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(date);
    days.push('<div class="day' + (isToday ? ' today' : '') + (future ? ' future' : '') +
      '" aria-label="' + escapeHtml(dateFormat.format(date)) + ': ' + done + ' de ' + total + ' hábitos">' +
      '<span class="weekday">' + escapeHtml(dayName.replace(".", "")) + '</span>' +
      '<span class="day-number">' + date.getDate() + '</span>' +
      '<span class="day-mark ' + status + '" aria-hidden="true">' + (done ? "✓" : "·") + '</span></div>');
  }
  $("weekly-strip").innerHTML = days.join("");
}

function renderHabits() {
  $("habit-count").textContent = data.habits.length;
  if (!data.habits.length) {
    $("habit-list").innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">🌿</span>' +
      '<h3>Todo gran cambio empieza aquí</h3><p>Crea tu primer hábito y da el paso de hoy.</p>' +
      '<button type="button" class="button-primary" data-action="new">Crear mi primer hábito</button></div>';
    return;
  }
  const today = keyForDate(new Date());
  const done = completedIds(today);
  $("habit-list").innerHTML = data.habits.map((habit) => {
    const category = CATEGORIES[habit.category];
    const checked = done.includes(habit.id);
    return '<article class="habit-card' + (checked ? ' is-done' : '') + '">' +
      '<span class="habit-symbol" style="--soft:' + category.background + '" aria-hidden="true">' + category.icon + '</span>' +
      '<div class="habit-info"><h3 class="habit-title">' + escapeHtml(habit.title) + '</h3>' +
      '<span class="habit-category">' + category.label + ' · Diario</span></div>' +
      '<button type="button" class="habit-check" data-action="toggle" data-id="' + habit.id +
      '" aria-pressed="' + checked + '" aria-label="' + (checked ? 'Desmarcar ' : 'Completar ') +
      escapeHtml(habit.title) + '">' + (checked ? '✓ Hecho' : '○ Completar') + '</button>' +
      '<span class="habit-action-buttons"><button type="button" class="edit-habit" data-action="edit" data-id="' + habit.id +
      '" aria-label="Editar ' + escapeHtml(habit.title) + '" title="Editar hábito">✎</button>' +
      '<button type="button" class="delete-habit" data-action="delete" data-id="' + habit.id +
      '" aria-label="Eliminar ' + escapeHtml(habit.title) + '" title="Eliminar hábito">×</button></span>' +
      '</article>';
  }).join("");
}

function renderChart() {
  const today = new Date();
  const chart = [];
  for (let i = -6; i <= 0; i++) {
    const date = addDays(today, i);
    const day = keyForDate(date);
    const count = completedCount(day);
    const possible = activeHabitsOn(day);
    const percent = possible ? Math.min(100, (count / possible) * 100) : 0;
    const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(date).replace(".", "");
    chart.push('<div class="chart-column' + (i === 0 ? ' today' : '') + '">' +
      '<span class="chart-value">' + count + '/' + possible + '</span>' +
      '<div class="chart-track" title="' + count + ' de ' + possible + ' hábitos completados">' +
      '<div class="chart-bar" style="height:' + percent + '%"></div></div>' +
      '<span class="chart-label">' + escapeHtml(weekday) + '</span></div>');
  }
  $("weekly-chart").innerHTML = chart.join("");
}

function renderHabitStreaks() {
  if (!data.habits.length) {
    $("habit-streak-list").innerHTML = '<div class="empty-state"><p>Añade hábitos para ver sus rachas aquí.</p></div>';
    return;
  }
  $("habit-streak-list").innerHTML = data.habits.map((habit) => {
    const category = CATEGORIES[habit.category];
    const streak = habitStreak(habit.id);
    return '<article class="habit-card"><span class="habit-symbol" style="--soft:' +
      category.background + '" aria-hidden="true">' + category.icon + '</span>' +
      '<div class="habit-info"><h3 class="habit-title">' + escapeHtml(habit.title) + '</h3>' +
      '<span class="habit-category">' + category.label + '</span></div>' +
      '<span class="streak-tag">' + streak + (streak === 1 ? ' día' : ' días') + ' 🔥</span></article>';
  }).join("");
}

function render() {
  const today = new Date();
  const key = keyForDate(today);
  const done = completedCount(key);
  const total = data.habits.length;
  const percent = total ? Math.round(100 * done / total) : 0;
  const hour = today.getHours();
  $("greeting").textContent = hour < 12 ? "BUENOS DÍAS" : hour < 20 ? "BUENAS TARDES" : "BUENAS NOCHES";
  $("current-date").textContent = "◷  " + dateFormat.format(today);
  $("today-completed").textContent = done + " / " + total;
  $("current-streak").textContent = currentStreak() + " días";
  $("total-completed").textContent = totalCompletions();
  $("progress-number").textContent = percent + "%";
  const ringLength = 2 * Math.PI * 54;
  $("progress-circle").style.strokeDasharray = String(ringLength);
  $("progress-circle").style.strokeDashoffset = String(ringLength * (1 - percent / 100));
  $("ring-title").textContent = percent + "% completado hoy";
  $("stats-total").textContent = totalCompletions();
  $("stats-best").textContent = bestStreak() + " días";
  $("stats-count").textContent = total;
  renderWeek();
  renderHabits();
  renderChart();
  renderHabitStreaks();
}

function showView(view) {
  currentView = view === "stats" ? "stats" : "today";
  $("today-view").hidden = currentView !== "today";
  $("stats-view").hidden = currentView !== "stats";
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === currentView;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function openDialog(id = null) {
  $("habit-form").reset();
  const habit = typeof id === "string" ? data.habits.find((entry) => entry.id === id) : null;
  editingId = habit ? habit.id : null;
  $("dialog-title").textContent = habit ? "Edita tu hábito" : "Crea un hábito";
  $("save-habit-btn").innerHTML = habit
    ? 'Guardar cambios <span aria-hidden="true">↗</span>'
    : 'Crear hábito <span aria-hidden="true">↗</span>';
  if (habit) {
    $("habit-name").value = habit.title;
    $("habit-category").value = habit.category;
  }
  $("habit-dialog").showModal();
  $("habit-name").focus();
}

function toggleHabit(id) {
  if (!data.habits.some((habit) => habit.id === id)) return;
  const today = keyForDate(new Date());
  const set = new Set(completedIds(today));
  const wasDone = set.has(id);
  if (wasDone) set.delete(id);
  else set.add(id);
  if (set.size) data.logs[today] = [...set];
  else delete data.logs[today];
  persist();
  render();
  showToast(wasDone ? "Hábito marcado como pendiente." : "¡Un paso más! Hábito completado.");
}

function deleteHabit(id) {
  const habit = data.habits.find((entry) => entry.id === id);
  if (!habit || !confirm('¿Eliminar "' + habit.title + '" y su historial? Esta acción no se puede deshacer.')) return;
  data.habits = data.habits.filter((entry) => entry.id !== id);
  for (const [day, ids] of Object.entries(data.logs)) {
    const remaining = ids.filter((entry) => entry !== id);
    if (remaining.length) data.logs[day] = remaining;
    else delete data.logs[day];
  }
  persist();
  render();
  showToast("Hábito eliminado.");
}

function exportData() {
  const file = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "habitclik-" + keyForDate(new Date()) + ".json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast("Copia de seguridad descargada.");
}

async function importData(file) {
  if (!file) return;
  if (file.size > 1024 * 1024) {
    showToast("El archivo supera el límite de 1 MB.");
    return;
  }
  try {
    const imported = normalizeData(JSON.parse(await file.text()));
    if (!confirm("¿Reemplazar todos tus hábitos y registros actuales por los de esta copia?")) return;
    data = imported;
    persist();
    render();
    showView("today");
    showToast("Datos importados correctamente.");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "No se pudo importar el archivo.");
  }
}

document.querySelectorAll("[data-view]").forEach((button) =>
  button.addEventListener("click", () => showView(button.dataset.view)));
$("open-add-btn").addEventListener("click", () => openDialog());
$("close-dialog").addEventListener("click", () => $("habit-dialog").close());
$("cancel-dialog").addEventListener("click", () => $("habit-dialog").close());

$("habit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("habit-name").value.trim();
  const category = $("habit-category").value;
  if (title.length < 2 || title.length > 60 || !Object.hasOwn(CATEGORIES, category)) {
    showToast("Introduce un nombre válido.");
    return;
  }
  if (editingId) {
    const habit = data.habits.find((entry) => entry.id === editingId);
    if (!habit) {
      showToast("No se ha encontrado el hábito que querías editar.");
      return;
    }
    habit.title = title;
    habit.category = category;
  } else {
    if (data.habits.length >= 200) {
      showToast("Has alcanzado el límite de 200 hábitos.");
      return;
    }
    data.habits.push({ id: newId(), title, category, createdAt: keyForDate(new Date()) });
  }
  persist();
  render();
  showView("today");
  $("habit-dialog").close();
  showToast(editingId ? "Hábito actualizado sin perder el progreso." : "¡Nuevo hábito creado!");
  editingId = null;
});

$("habit-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "new") openDialog();
  if (button.dataset.action === "toggle") toggleHabit(button.dataset.id);
  if (button.dataset.action === "edit") openDialog(button.dataset.id);
  if (button.dataset.action === "delete") deleteHabit(button.dataset.id);
});

$("export-btn").addEventListener("click", exportData);
$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (event) => {
  await importData(event.target.files[0]);
  event.target.value = "";
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

let deferredInstallPrompt = null;
const installButton = $("install-app-btn");
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  installButton.hidden = true;
  try {
    await promptEvent.prompt();
  } catch (error) {
    console.warn("HabitClik: no se pudo mostrar la instalación.", error);
  }
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
  showToast("¡HabitClik se ha instalado!");
});

// Service workers require a secure context (HTTPS or local development).
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("HabitClik: no se pudo activar el modo sin conexión.", error);
    });
  });
}

persist();
render();