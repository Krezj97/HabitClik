"use strict";

const STORAGE_KEY = "habitclik:v1";
const FREE_HABIT_LIMIT = 3;
const HERO_SCENES = ["amanecer", "enfoque", "bosque", "celebracion"];
let heroSceneOffset = 0;
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
let calendarSelectedKey = keyForDate(new Date());
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
let motivationShift = 0;
let alarmAudioContext = null;

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
    // Start with empty slots so a new user can choose all three free habits.
    habits: [],
    logs: {},
    settings: {
      reminderEnabled: false, reminderTime: "19:00", lastRemindedAt: null,
      alarmEnabled: false, notificationEnabled: false, alarmVolume: 50, alarmTone: "campanas"
    }
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
        ? habit.createdAt : today,
      weeklyTarget: Number.isInteger(habit.weeklyTarget) && habit.weeklyTarget >= 1 &&
        habit.weeklyTarget <= 7 ? habit.weeklyTarget : 7,
      alarmEnabled: habit.alarmEnabled === true,
      alarmTime: isValidReminderTime(habit.alarmTime) ? habit.alarmTime : "19:00",
      alarmTone: window.HABITCLIK_SOUNDS && window.HABITCLIK_SOUNDS.isValid(habit.alarmTone)
        ? habit.alarmTone : "campanas",
      lastAlarmAt: typeof habit.lastAlarmAt === "string" && isValidDateKey(habit.lastAlarmAt)
        ? habit.lastAlarmAt : null
    });
  }
  const logs = {};
  for (const [day, values] of Object.entries(input.logs)) {
    if (!isValidDateKey(day) || !Array.isArray(values)) continue;
    const valid = [...new Set(values.filter((id) => typeof id === "string" && seen.has(id)))];
    if (valid.length) logs[day] = valid;
  }
  const sourceSettings = input.settings && typeof input.settings === "object" &&
    !Array.isArray(input.settings) ? input.settings : {};
  const settings = {
    reminderEnabled: sourceSettings.reminderEnabled === true,
    reminderTime: isValidReminderTime(sourceSettings.reminderTime)
      ? sourceSettings.reminderTime : "19:00",
    lastRemindedAt: typeof sourceSettings.lastRemindedAt === "string" &&
      isValidDateKey(sourceSettings.lastRemindedAt) ? sourceSettings.lastRemindedAt : null,
    alarmEnabled: sourceSettings.alarmEnabled === true,
    notificationEnabled: sourceSettings.notificationEnabled === true,
    alarmVolume: Number.isInteger(sourceSettings.alarmVolume) &&
      sourceSettings.alarmVolume >= 10 && sourceSettings.alarmVolume <= 100
      ? sourceSettings.alarmVolume : 50,
    alarmTone: window.HABITCLIK_SOUNDS && window.HABITCLIK_SOUNDS.isValid(sourceSettings.alarmTone)
      ? sourceSettings.alarmTone : "campanas"
  };
  return { habits, logs, settings };
}

function isValidReminderTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
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
    if (raw) return normalizeData(JSON.parse(raw));
    const initial = starterData();
    // A user can configure Avisos before opening the main dashboard.
    const savedSettings = localStorage.getItem("habitclik:settings:v1");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      initial.settings = normalizeData({ habits: [], logs: {}, settings: parsed }).settings;
    }
    return initial;
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

function startOfWeek(date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function targetFor(habit) {
  return Number.isInteger(habit.weeklyTarget) && habit.weeklyTarget >= 1 &&
    habit.weeklyTarget <= 7 ? habit.weeklyTarget : 7;
}

function completionsThisWeek(habit, reference = new Date()) {
  const monday = startOfWeek(reference);
  let count = 0;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const key = keyForDate(addDays(monday, dayOffset));
    if (key >= habit.createdAt && completedIds(key).includes(habit.id)) count++;
  }
  return count;
}

function weeklyStreak(habit) {
  let week = startOfWeek(new Date());
  const firstWeekKey = keyForDate(startOfWeek(localDate(habit.createdAt)));
  if (completionsThisWeek(habit, week) < targetFor(habit)) {
    week = addDays(week, -7);
  }
  let count = 0;
  while (count < 714 && keyForDate(week) >= firstWeekKey &&
         completionsThisWeek(habit, week) >= targetFor(habit)) {
    count++;
    week = addDays(week, -7);
  }
  return count;
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

function renderWeeklyGoals() {
  const weekGoals = $("weekly-goals-list");
  const reached = data.habits.filter((habit) => completionsThisWeek(habit) >= targetFor(habit)).length;
  $("weekly-goals-summary").textContent = reached + " / " + data.habits.length + " alcanzadas";

  if (!data.habits.length) {
    weekGoals.innerHTML = '<div class="empty-state"><p>Tus metas semanales aparecerán cuando crees un hábito.</p></div>';
    return;
  }

  weekGoals.innerHTML = data.habits.map((habit) => {
    const done = completionsThisWeek(habit);
    const goal = targetFor(habit);
    const percent = Math.min(100, Math.round((done / goal) * 100));
    const complete = done >= goal;
    const remaining = Math.max(0, goal - done);
    return '<article class="weekly-goal-card' + (complete ? ' goal-met' : '') + '">' +
      '<div class="weekly-goal-header"><div class="weekly-goal-name">' + escapeHtml(habit.title) + '</div>' +
      '<strong class="weekly-goal-count">' + done + ' / ' + goal + ' días</strong></div>' +
      '<div class="weekly-goal-track" role="progressbar" aria-label="Meta semanal de ' +
      escapeHtml(habit.title) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      percent + '"><span class="weekly-goal-fill" style="width:' + percent + '%"></span></div>' +
      '<div class="weekly-goal-caption">' +
      (complete ? '✓ Meta alcanzada esta semana' :
        'Faltan ' + remaining + (remaining === 1 ? ' día' : ' días') + ' para tu meta') +
      '</div></article>';
  }).join("");
}

function motivationForToday() {
  const today = keyForDate(new Date());
  const completed = completedCount(today);
  const total = data.habits.length;
  const streak = currentStreak();
  const weeklyReached = data.habits.some((habit) =>
    targetFor(habit) < 7 && completionsThisWeek(habit) >= targetFor(habit));
  let theme = "start";
  let heading = "Un paso a la vez";

  if (total > 0 && completed === total) {
    theme = "complete";
    heading = "¡Objetivo de hoy logrado!";
  } else if (streak >= 7) {
    theme = "longStreak";
    heading = streak + " días sumando constancia";
  } else if (streak >= 3) {
    theme = "streak";
    heading = "¡Tu racha está creciendo!";
  } else if (weeklyReached) {
    theme = "weekly";
    heading = "Tu semana va tomando forma";
  } else if (completed > 0 || streak > 0) {
    theme = "progress";
    heading = "Vas por buen camino";
  } else if (totalCompletions() > 0) {
    theme = "comeback";
    heading = "Siempre puedes volver";
  }

  const library = window.HABITCLIK_PHRASES;
  const phrases = library && Array.isArray(library[theme]) && library[theme].length
    ? library[theme]
    : [
      "Cada pequeño paso cuenta para tu progreso.",
      "Sigue a tu ritmo. Lo importante es lo que te aporta el hábito.",
      "La constancia también incluye descanso y flexibilidad.",
      "Hoy tienes una oportunidad para avanzar a tu manera."
    ];
  const daySeed = Number(today.replace(/-/g, ""));
  return { heading, phrase: phrases[(daySeed + motivationShift) % phrases.length], theme };
}

function renderMotivation() {
  const selected = motivationForToday();
  $("motivation-heading").textContent = selected.heading;
  $("motivation-phrase").textContent = selected.phrase;
}

function renderCalendar() {
  const today = keyForDate(new Date());
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const first = new Date(year, month, 1, 12);
  const lastDay = new Date(year, month + 1, 0, 12).getDate();
  const offset = (first.getDay() + 6) % 7;
  const monthText = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(first);
  $("calendar-month-title").textContent = monthText.charAt(0).toUpperCase() + monthText.slice(1);
  $("calendar-next").disabled = year === new Date().getFullYear() && month === new Date().getMonth();
  const cells = Array.from({ length: offset }, () => '<span class="calendar-pad" aria-hidden="true"></span>');
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month, day, 12);
    const key = keyForDate(date);
    const total = activeHabitsOn(key);
    const completed = completedCount(key);
    const selectable = key <= today && total > 0;
    const status = completed > 0 && completed === total ? " is-complete"
      : completed > 0 ? " has-progress" : "";
    const name = dateFormat.format(date) + ": " + completed + " de " + total + " completados";
    cells.push('<button type="button" class="calendar-day' + status +
      (key === today ? ' is-today' : '') +
      (key === calendarSelectedKey ? ' is-selected' : '') +
      '" data-date="' + key + '" aria-pressed="' + (key === calendarSelectedKey) +
      '" aria-label="' + escapeHtml(name) + '"' + (selectable ? '' : ' disabled') +
      '><span>' + day + '</span><small aria-hidden="true">' +
      (completed ? completed + '/' + total : '·') + '</small></button>');
  }
  $("calendar-days").innerHTML = cells.join("");
  const selectedDate = localDate(calendarSelectedKey);
  $("calendar-selected-title").textContent = "Hábitos del " + dateFormat.format(selectedDate);
  const active = data.habits.filter((habit) => habit.createdAt <= calendarSelectedKey);
  const selectedDone = completedIds(calendarSelectedKey);
  $("calendar-selected-summary").textContent = selectedDone.length + " / " + active.length + " completados";
  $("calendar-habits").innerHTML = active.length
    ? active.map((habit) => {
      const done = selectedDone.includes(habit.id);
      const category = CATEGORIES[habit.category];
      return '<article class="habit-card' + (done ? ' is-done' : '') + '">' +
        '<span class="habit-symbol" style="--soft:' + category.background + '" aria-hidden="true">' +
        category.icon + '</span><div class="habit-info"><h3 class="habit-title">' +
        escapeHtml(habit.title) + '</h3><span class="habit-category">' + category.label +
        '</span></div><button type="button" class="habit-check" data-action="calendar-toggle" data-id="' +
        habit.id + '" aria-pressed="' + done + '" aria-label="' +
        escapeHtml((done ? "Desmarcar " : "Completar ") + habit.title) +
        '">' + (done ? "✓ Hecho" : "○ Completar") + '</button></article>';
    }).join("")
    : '<div class="empty-state"><p>En esta fecha todavía no tenías hábitos registrados.</p></div>';
}

function renderHabits() {
  $("habit-count").textContent = data.habits.length;
  if (!data.habits.length) {
    $("habit-list").innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">🌿</span>' +
      '<h3>¿Qué te gustaría hacer por ti?</h3><p>Elige hasta 3 hábitos sencillos. A tu ritmo, sin prisa.</p>' +
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
      '<span class="habit-category">' + category.label + ' · ' +
      (targetFor(habit) === 7 ? 'Diario' : targetFor(habit) + ' días/semana') +
      (habit.alarmEnabled ? ' · 🔔 ' + escapeHtml(habit.alarmTime) : '') + '</span></div>' +
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
    const daily = targetFor(habit) === 7;
    const streak = daily ? habitStreak(habit.id) : weeklyStreak(habit);
    return '<article class="habit-card"><span class="habit-symbol" style="--soft:' +
      category.background + '" aria-hidden="true">' + category.icon + '</span>' +
      '<div class="habit-info"><h3 class="habit-title">' + escapeHtml(habit.title) + '</h3>' +
      '<span class="habit-category">' + category.label + ' · ' +
      (daily ? 'Diario' : targetFor(habit) + ' días/semana') + '</span></div>' +
      '<span class="streak-tag">' + streak + (daily
        ? (streak === 1 ? ' día' : ' días')
        : (streak === 1 ? ' semana' : ' semanas')) + ' 🔥</span></article>';
  }).join("");
}

function notificationCapability() {
  if (!window.isSecureContext || typeof window.Notification === "undefined") return "unsupported";
  return window.Notification.permission || "default";
}

function renderReminderSettings() {
  $("reminder-enabled").checked = data.settings.reminderEnabled;
  $("reminder-time").value = data.settings.reminderTime;
  $("alarm-enabled").checked = data.settings.alarmEnabled;
  $("alarm-volume").value = String(data.settings.alarmVolume);
  $("alarm-volume-value").textContent = data.settings.alarmVolume + " %";
  $("reminder-overview").textContent = data.settings.reminderEnabled
    ? "Aviso diario activo · " + data.settings.reminderTime
    : "Avisos diarios desactivados";

  const permission = notificationCapability();
  const active = data.settings.notificationEnabled && permission === "granted";
  const status = $("notification-status");
  status.classList.toggle("is-active", active);
  status.classList.toggle("is-warning", permission === "denied" || permission === "unsupported");
  status.textContent = active
    ? data.settings.reminderEnabled ? "Activadas" : "Avisos pausados"
    : permission === "denied" ? "Bloqueadas"
    : permission === "unsupported" ? "No disponibles" : "Desactivadas";

  $("notification-permission-btn").textContent = active
    ? "Desactivar notificaciones"
    : permission === "denied" ? "Cómo desbloquearlas"
    : permission === "unsupported" ? "Ver alternativas"
    : "Activar notificaciones";
  $("notification-help").textContent = permission === "denied"
    ? "El permiso está bloqueado. Abre los ajustes del sitio en tu navegador y permite las notificaciones."
    : permission === "unsupported"
    ? "Este navegador no permite notificaciones en este contexto. En iPhone, instala la web en la pantalla de inicio y ábrela desde allí si tu versión de iOS lo admite. Puedes usar el calendario como alternativa."
    : active
    ? data.settings.reminderEnabled
      ? "Permiso concedido. Prueba el botón para comprobar si tu dispositivo muestra el aviso."
      : "Activa también el recordatorio diario para recibir avisos programados."
    : "Debes dar permiso expresamente. La prueba mostrará si el navegador puede enviarlas.";
}

async function playAlarm() {
  // Shared audio engine for the dashboard and the independent Avisos page.
  return window.HABITCLIK_SOUNDS
    ? window.HABITCLIK_SOUNDS.play(data.settings.alarmTone, data.settings.alarmVolume)
    : false;
}

async function sendDeviceNotification(message) {
  if (!data.settings.notificationEnabled || notificationCapability() !== "granted") return false;
  const options = {
    body: message,
    icon: "./icons/icon-192.png",
    tag: "habitclik-daily",
    data: { url: "./" }
  };
  try {
    if ("serviceWorker" in navigator &&
        typeof navigator.serviceWorker.getRegistration === "function") {
      const registration = await navigator.serviceWorker.getRegistration("./");
      if (registration && typeof registration.showNotification === "function" && registration.active) {
        await registration.showNotification("HabitClik · Tu recordatorio", options);
        return true;
      }
    }
    // Fallback for desktop browsers; some mobile browsers require an active service worker.
    new window.Notification("HabitClik · Tu recordatorio", options);
    return true;
  } catch (error) {
    console.warn("HabitClik: el navegador no mostró la notificación.", error);
    return false;
  }
}

function calendarDate(value) {
  return value.getFullYear() + String(value.getMonth() + 1).padStart(2, "0") +
    String(value.getDate()).padStart(2, "0") + "T" +
    String(value.getHours()).padStart(2, "0") +
    String(value.getMinutes()).padStart(2, "0") + "00";
}

function downloadCalendarReminder() {
  // Floating local time: importing calendar uses the user's calendar time zone.
  const [hours, minutes] = data.settings.reminderTime.split(":").map(Number);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 10 * 60 * 1000);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = "habitclik-" + Date.now() + "-" + Math.random().toString(36).slice(2) + "@habitclik";
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//HabitClik//Daily Reminder//ES", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + stamp,
    "DTSTART:" + calendarDate(start), "DTEND:" + calendarDate(end),
    "RRULE:FREQ=DAILY", "SUMMARY:HabitClik - revisa tus habitos",
    "DESCRIPTION:Entra en HabitClik y revisa tus metas a tu ritmo.",
    "BEGIN:VALARM", "TRIGGER:-PT5M", "ACTION:DISPLAY",
    "DESCRIPTION:HabitClik - es hora de revisar tus habitos",
    "END:VALARM", "END:VEVENT", "END:VCALENDAR", ""
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "habitclik-recordatorio.ics";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast("Aviso diario descargado. Impórtalo a tu calendario y activa sus alertas.");
}

function showHabitReminders() {
  if (document.hidden) return;
  const now = new Date();
  const day = keyForDate(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const due = data.habits.filter((habit) => {
    if (!habit.alarmEnabled || habit.lastAlarmAt === day ||
        !isValidReminderTime(habit.alarmTime) || completedIds(day).includes(habit.id) ||
        habit.createdAt > day || completionsThisWeek(habit) >= targetFor(habit)) return false;
    const [hours, mins] = habit.alarmTime.split(":").map(Number);
    return minutes >= hours * 60 + mins;
  });
  if (!due.length) return;
  for (const habit of due) habit.lastAlarmAt = day;
  persist();
  due.forEach((habit, index) => {
    const message = "Un momento para " + habit.title + ". Si hoy te viene bien, adelante.";
    // Do not make one sound cut off another when two reminders share a minute.
    const deliver = () => {
      showToast(message);
      sendDeviceNotification(message);
      if (window.HABITCLIK_SOUNDS) {
        window.HABITCLIK_SOUNDS.play(habit.alarmTone, data.settings.alarmVolume)
          .catch((error) => console.warn("HabitClik: alarma individual no disponible.", error));
      }
    };
    if (index === 0) deliver();
    else setTimeout(deliver, index * 12000);
  });
}

function showPendingReminder() {
  if (!data.settings.reminderEnabled || document.hidden) return;
  const now = new Date();
  const today = keyForDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const parts = data.settings.reminderTime.split(":").map(Number);
  const targetMinutes = parts[0] * 60 + parts[1];
  if (data.settings.lastRemindedAt === today || currentMinutes < targetMinutes) return;
  const pending = data.habits.filter((habit) =>
    !completedIds(today).includes(habit.id) && completionsThisWeek(habit) < targetFor(habit));
  if (pending.length === 0) return;
  data.settings.lastRemindedAt = today;
  persist();
  const message = "Tienes " + pending.length +
    (pending.length === 1 ? " hábito pendiente" : " hábitos pendientes") +
    " para avanzar en tus metas esta semana.";
  showToast(message);
  sendDeviceNotification(message);
  if (data.settings.alarmEnabled) playAlarm();
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
  $("quick-progress-percent").textContent = percent + " %";
  $("quick-progress-count").textContent = done + " de " + total + " hábitos completados";
  $("quick-progress-fill").style.width = percent + "%";
  $("quick-progress-track").setAttribute("aria-valuenow", String(percent));
  const ringLength = 2 * Math.PI * 54;
  $("progress-circle").style.strokeDasharray = String(ringLength);
  $("progress-circle").style.strokeDashoffset = String(ringLength * (1 - percent / 100));
  $("ring-title").textContent = percent + "% completado hoy";
  $("stats-total").textContent = totalCompletions();
  $("stats-best").textContent = bestStreak() + " días";
  $("stats-count").textContent = total;
  $("free-plan-count").textContent = total > FREE_HABIT_LIMIT
    ? "Plan gratis · " + total + " existentes"
    : "Plan gratis · " + total + "/" + FREE_HABIT_LIMIT;
  $("free-plan-count").classList.toggle("is-full", total >= FREE_HABIT_LIMIT);
  renderWeek();
  renderWeeklyGoals();
  renderHabits();
  renderCalendar();
  renderMotivation();
  renderChart();
  renderHabitStreaks();
  renderReminderSettings();
  renderJourney();
}

function renderJourney() {
  const engine = window.HABITCLIK_PROGRESS;
  if (!engine) return;
  const progress = engine.calculate(data, keyForDate(new Date()));
  $("journey-level").textContent = String(progress.level);
  $("journey-rank").textContent = "· " + progress.rank;
  $("journey-total").textContent = progress.xp.toLocaleString("es-ES") + " XP";
  $("journey-xp").textContent = progress.currentLevelXp + " / " + progress.nextLevelXp + " XP";
  $("journey-next").textContent = progress.remaining + " XP para el nivel " + (progress.level + 1);
  $("journey-bar-fill").style.width = progress.percentage + "%";
  $("journey-bar").setAttribute("aria-valuemax", String(progress.nextLevelXp));
  $("journey-bar").setAttribute("aria-valuenow", String(progress.currentLevelXp));
  $("journey-highlight").textContent = progress.headline;
  $("journey-detail").textContent = progress.detail;
  $("journey-badge-count").textContent = progress.unlocked.length + " insignias";
  $("achievements-count").textContent = progress.unlocked.length + " de " + progress.badges.length + " desbloqueadas";
  $("achievement-list").innerHTML = progress.badges.map((badge) =>
    '<article class="achievement-card' + (badge.unlocked ? ' is-unlocked' : '') +
    '" aria-label="' + escapeHtml(badge.title + (badge.unlocked ? ": conseguida" : ": pendiente")) + '">' +
    '<span class="achievement-icon" aria-hidden="true">' + badge.icon + '</span>' +
    '<div><strong>' + escapeHtml(badge.title) + '</strong><p>' +
    escapeHtml(badge.description) + '</p></div><span class="achievement-status">' +
    (badge.unlocked ? 'Conseguida' : 'Por conseguir') + '</span></article>'
  ).join("");
  const ideal = HERO_SCENES.indexOf(progress.scene);
  const scene = HERO_SCENES[(ideal + heroSceneOffset) % HERO_SCENES.length];
  const hero = $("hero-main");
  for (const name of HERO_SCENES) hero.classList.toggle("hero--" + name, name === scene);
}

function showView(view) {
  currentView = ["today", "stats", "calendar", "reminders"].includes(view) ? view : "today";
  $("today-view").hidden = currentView !== "today";
  $("stats-view").hidden = currentView !== "stats";
  $("calendar-view").hidden = currentView !== "calendar";
  $("reminders-view").hidden = currentView !== "reminders";
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === currentView;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function showUpgradeDialog() {
  const count = data.habits.length;
  $("upgrade-plan-count").textContent = count + " de " + FREE_HABIT_LIMIT +
    " hábitos" + (count > FREE_HABIT_LIMIT ? " existentes" : " utilizados");
  $("upgrade-dialog").showModal();
}

function canAddHabit() {
  // No paid entitlement is issued by the static site; a trustworthy
  // Premium unlock will need server-side payment/identity verification.
  return data.habits.length < FREE_HABIT_LIMIT;
}

function openDialog(id = null) {
  const habit = typeof id === "string" ? data.habits.find((entry) => entry.id === id) : null;
  if (!habit && !canAddHabit()) {
    showUpgradeDialog();
    return;
  }
  $("habit-form").reset();
  editingId = habit ? habit.id : null;
  $("dialog-title").textContent = habit ? "Edita tu hábito" : "Crea un hábito";
  $("save-habit-btn").innerHTML = habit
    ? 'Guardar cambios <span aria-hidden="true">↗</span>'
    : 'Crear hábito <span aria-hidden="true">↗</span>';
  if (habit) {
    $("habit-name").value = habit.title;
    $("habit-category").value = habit.category;
    $("habit-target").value = String(targetFor(habit));
  }
  $("habit-alarm-enabled").checked = habit ? habit.alarmEnabled === true : false;
  $("habit-alarm-time").value = habit && isValidReminderTime(habit.alarmTime) ? habit.alarmTime : "19:00";
  $("habit-alarm-tone").value = habit && window.HABITCLIK_SOUNDS &&
    window.HABITCLIK_SOUNDS.isValid(habit.alarmTone) ? habit.alarmTone : "campanas";
  $("habit-dialog").showModal();
  $("habit-name").focus();
}

function toggleHabit(id, day = keyForDate(new Date())) {
  const habit = data.habits.find((entry) => entry.id === id);
  if (!habit || !isValidDateKey(day) || day > keyForDate(new Date()) || day < habit.createdAt) return;
  const set = new Set(completedIds(day));
  const wasDone = set.has(id);
  const beforeLevel = window.HABITCLIK_PROGRESS
    ? window.HABITCLIK_PROGRESS.calculate(data, keyForDate(new Date())).level : 1;
  if (wasDone) set.delete(id);
  else set.add(id);
  if (set.size) data.logs[day] = [...set];
  else delete data.logs[day];
  persist();
  render();
  const gainedLevel = !wasDone && window.HABITCLIK_PROGRESS &&
    window.HABITCLIK_PROGRESS.calculate(data, keyForDate(new Date())).level > beforeLevel;
  showToast(gainedLevel ? "¡Un nivel más! Mira todo lo que llevas hecho. ✨" :
    wasDone ? "Hábito marcado como pendiente." :
    day === keyForDate(new Date()) ? "¡Qué bien! Un paso más y 10 XP para ti." :
      "¡Listo! También cuenta lo que hiciste aquel día.");
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
    if (imported.habits.length > FREE_HABIT_LIMIT) {
      // Never drop history or silently remove habits from a backup.
      showToast("La copia tiene más de 3 hábitos. No se puede importar en el plan gratis.");
      showUpgradeDialog();
      return;
    }
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
  button.addEventListener("click", () => {
    const target = button.dataset.view;
    if (target !== currentView && window.history &&
        typeof window.history.pushState === "function") {
      const address = target === "today" ? "./index.html" : "./index.html#" + target;
      window.history.pushState({ view: target }, "", address);
    }
    showView(target);
  }));
$("open-add-btn").addEventListener("click", () => openDialog());
$("hero-scene-next").addEventListener("click", () => {
  heroSceneOffset = (heroSceneOffset + 1) % HERO_SCENES.length;
  renderJourney();
});
$("upgrade-info-btn").addEventListener("click", showUpgradeDialog);
$("upgrade-close").addEventListener("click", () => $("upgrade-dialog").close());
$("upgrade-dismiss").addEventListener("click", () => $("upgrade-dialog").close());
$("close-dialog").addEventListener("click", () => $("habit-dialog").close());
$("cancel-dialog").addEventListener("click", () => $("habit-dialog").close());

$("habit-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("habit-name").value.trim();
  const category = $("habit-category").value;
  const weeklyTarget = Number($("habit-target").value);
  const alarmEnabled = $("habit-alarm-enabled").checked;
  const alarmTime = $("habit-alarm-time").value;
  const alarmTone = $("habit-alarm-tone").value;
  if (title.length < 2 || title.length > 60 || !Object.hasOwn(CATEGORIES, category) ||
      !Number.isInteger(weeklyTarget) || weeklyTarget < 1 || weeklyTarget > 7 ||
      !isValidReminderTime(alarmTime) || !(window.HABITCLIK_SOUNDS &&
        window.HABITCLIK_SOUNDS.isValid(alarmTone))) {
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
    habit.weeklyTarget = weeklyTarget;
    habit.alarmEnabled = alarmEnabled;
    habit.alarmTime = alarmTime;
    habit.alarmTone = alarmTone;
    if (!alarmEnabled) habit.lastAlarmAt = null;
  } else {
    // Guard the write as well as the add button: a previously opened form
    // must not bypass the free quota.
    if (!canAddHabit()) {
      $("habit-dialog").close();
      showUpgradeDialog();
      return;
    }
    data.habits.push({ id: newId(), title, category, createdAt: keyForDate(new Date()),
      weeklyTarget, alarmEnabled, alarmTime, alarmTone, lastAlarmAt: null });
  }
  persist();
  render();
  showView("today");
  $("habit-dialog").close();
  showToast(editingId ? "Hábito actualizado sin perder el progreso." : "¡Nuevo hábito creado!");
  editingId = null;
});

$("motivation-next").addEventListener("click", () => {
  motivationShift++;
  renderMotivation();
});
// Unhurried phrase rotation: pause when the app is not visible and respect motion preferences.
function advanceMotivation() {
  if (document.hidden || currentView !== "today") return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  motivationShift++;
  renderMotivation();
}
setInterval(advanceMotivation, 20000);
function moveCalendarMonth(direction) {
  const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + direction, 1, 12);
  const now = new Date();
  if (next.getFullYear() > now.getFullYear() ||
      (next.getFullYear() === now.getFullYear() && next.getMonth() > now.getMonth())) return;
  const desiredDay = localDate(calendarSelectedKey).getDate();
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0, 12).getDate();
  const candidate = keyForDate(new Date(next.getFullYear(), next.getMonth(),
    Math.min(desiredDay, lastDay), 12));
  calendarMonth = next;
  calendarSelectedKey = candidate > keyForDate(now) ? keyForDate(now) : candidate;
  renderCalendar();
}
$("calendar-prev").addEventListener("click", () => moveCalendarMonth(-1));
$("calendar-next").addEventListener("click", () => moveCalendarMonth(1));
$("calendar-today").addEventListener("click", () => {
  calendarSelectedKey = keyForDate(new Date());
  calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
  renderCalendar();
});
$("calendar-days").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-date]");
  if (!button || button.disabled) return;
  const day = button.dataset.date;
  if (isValidDateKey(day) && day <= keyForDate(new Date()) && activeHabitsOn(day) > 0) {
    calendarSelectedKey = day;
    renderCalendar();
  }
});
$("calendar-habits").addEventListener("click", (event) => {
  const button = event.target.closest('button[data-action="calendar-toggle"]');
  if (button) toggleHabit(button.dataset.id, calendarSelectedKey);
});

$("habit-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "new") openDialog();
  if (button.dataset.action === "toggle") toggleHabit(button.dataset.id);
  if (button.dataset.action === "edit") openDialog(button.dataset.id);
  if (button.dataset.action === "delete") deleteHabit(button.dataset.id);
});

function closeDataMenus() {
  for (const id of ["data-menu", "top-data-menu"]) {
    const menu = $(id);
    if (menu && menu.open) menu.open = false;
  }
}
$("export-btn").addEventListener("click", () => { closeDataMenus(); exportData(); });
$("import-btn").addEventListener("click", () => { closeDataMenus(); $("import-file").click(); });
$("top-export-btn").addEventListener("click", () => { closeDataMenus(); exportData(); });
$("top-import-btn").addEventListener("click", () => { closeDataMenus(); $("import-file").click(); });
$("import-file").addEventListener("change", async (event) => {
  await importData(event.target.files[0]);
  event.target.value = "";
});

$("test-alarm-btn").addEventListener("click", async () => {
  $("alarm-status").textContent = "Reproduciendo sonido de prueba…";
  const played = await playAlarm();
  $("alarm-status").textContent = played
    ? "Prueba enviada al altavoz. Si no se oye, sube el volumen y revisa el modo silencio."
    : "El navegador ha bloqueado el audio. Toca de nuevo o revisa el modo silencio.";
  showToast(played ? "♪ Prueba sonora reproducida." : "No se pudo reproducir el sonido.");
});

$("alarm-enabled").addEventListener("change", async () => {
  const enabled = $("alarm-enabled").checked;
  if (!enabled) {
    data.settings.alarmEnabled = false;
    persist();
    $("alarm-status").textContent = "Alarma desactivada.";
    showToast("Alarma sonora desactivada.");
    return;
  }
  $("alarm-status").textContent = "Comprobando audio…";
  const played = await playAlarm();
  if (!played) {
    $("alarm-enabled").checked = false;
    data.settings.alarmEnabled = false;
    $("alarm-status").textContent = "No se puede activar el sonido. Revisa los permisos de audio y el modo silencio.";
    showToast("El navegador no ha permitido reproducir la alarma.");
    persist();
    return;
  }
  data.settings.alarmEnabled = true;
  persist();
  $("alarm-status").textContent = "Activada. Sonará con la página abierta cuando haya un recordatorio pendiente.";
  showToast("♪ Alarma activada. Has escuchado la prueba.");
});

$("alarm-volume").addEventListener("input", () => {
  const volume = Number($("alarm-volume").value);
  if (!Number.isInteger(volume) || volume < 10 || volume > 100) return;
  data.settings.alarmVolume = volume;
  $("alarm-volume-value").textContent = volume + " %";
  if (window.HABITCLIK_SOUNDS) window.HABITCLIK_SOUNDS.setVolume(volume);
});
$("alarm-volume").addEventListener("change", () => {
  const volume = Number($("alarm-volume").value);
  if (!Number.isInteger(volume) || volume < 10 || volume > 100) return;
  data.settings.alarmVolume = volume;
  persist();
  $("alarm-volume-value").textContent = volume + " %";
  showToast("Volumen guardado: " + volume + " %.");
});

$("notification-permission-btn").addEventListener("click", async () => {
  const permission = notificationCapability();
  if (permission === "unsupported") {
    showToast("Usa un navegador compatible o el aviso de calendario. En iPhone, prueba la web instalada.");
    renderReminderSettings();
    return;
  }
  if (permission === "denied") {
    showToast("Permiso bloqueado: actívalo en los ajustes del sitio del navegador.");
    renderReminderSettings();
    return;
  }
  if (data.settings.notificationEnabled && permission === "granted") {
    data.settings.notificationEnabled = false;
    persist();
    renderReminderSettings();
    showToast("Notificaciones desactivadas en HabitClik.");
    return;
  }
  try {
    const result = permission === "granted"
      ? "granted" : await window.Notification.requestPermission();
    if (result !== "granted") {
      data.settings.notificationEnabled = false;
      persist();
      renderReminderSettings();
      showToast("No se concedió permiso. Puedes seguir utilizando el calendario.");
      return;
    }
    data.settings.notificationEnabled = true;
    data.settings.reminderEnabled = true;
    persist();
    renderReminderSettings();
    showToast("Notificaciones activadas. Pulsa «Enviar prueba» para comprobarlas.");
  } catch (error) {
    console.warn("HabitClik: no se pudo pedir permiso.", error);
    showToast("El navegador no pudo solicitar el permiso. Usa el calendario si lo necesitas.");
    renderReminderSettings();
  }
});

$("test-notification-btn").addEventListener("click", async () => {
  const permission = notificationCapability();
  if (permission !== "granted" || !data.settings.notificationEnabled) {
    $("notification-help").textContent = "Primero pulsa «Activar notificaciones» y concede permiso en el navegador.";
    showToast("Activa las notificaciones antes de probarlas.");
    return;
  }
  $("notification-help").textContent = "Enviando notificación de prueba…";
  const sent = await sendDeviceNotification("¡Esta es tu notificación de prueba! Tu configuración está lista.");
  $("notification-help").textContent = sent
    ? "Notificación enviada. Si no aparece, comprueba los permisos y el modo No molestar."
    : "El navegador no pudo mostrar el aviso. Comprueba los permisos e instala la app si tu móvil lo requiere.";
  showToast(sent ? "Prueba enviada: revisa tus notificaciones." : "No se pudo mostrar la notificación en este dispositivo.");
});

$("calendar-export-btn").addEventListener("click", downloadCalendarReminder);

$("reminder-enabled").addEventListener("change", () => {
  data.settings.reminderEnabled = $("reminder-enabled").checked;
  persist();
  showToast(data.settings.reminderEnabled
    ? "Aviso activado mientras tengas HabitClik abierta."
    : "Aviso diario desactivado.");
  showPendingReminder();
});

$("reminder-time").addEventListener("change", () => {
  const time = $("reminder-time").value;
  if (!isValidReminderTime(time)) {
    $("reminder-time").value = data.settings.reminderTime;
    showToast("Selecciona una hora válida.");
    return;
  }
  data.settings.reminderTime = time;
  persist();
  showPendingReminder();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    render();
    showPendingReminder();
  }
});
window.addEventListener("focus", showPendingReminder);
setInterval(showPendingReminder, 60 * 1000);
setInterval(showHabitReminders, 60 * 1000);

let deferredInstallPrompt = null;
const installButton = $("install-app-btn");
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return;
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
showPendingReminder();
showHabitReminders();

// Support direct deep links from the independent Avisos page.
const route = window.location && window.location.hash.slice(1);
if (route && ["today", "stats", "calendar"].includes(route)) showView(route);
function restoreViewFromAddress() {
  const hash = window.location && window.location.hash ? window.location.hash.slice(1) : "";
  showView(["today", "stats", "calendar"].includes(hash) ? hash : "today");
}
window.addEventListener("hashchange", restoreViewFromAddress);
window.addEventListener("popstate", restoreViewFromAddress);
window.addEventListener("pageshow", () => {
  // Refresh daily progress after returning from Android's recents or another tab.
  render();
  showHabitReminders();
});