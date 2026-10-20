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
    habits: [
      { id: newId(), title: "Beber suficiente agua", category: "salud", createdAt: now, weeklyTarget: 7 },
      { id: newId(), title: "Leer 15 minutos", category: "mente", createdAt: now, weeklyTarget: 7 },
      { id: newId(), title: "Mover el cuerpo", category: "movimiento", createdAt: now, weeklyTarget: 7 }
    ],
    logs: {},
    settings: {
      reminderEnabled: false, reminderTime: "19:00", lastRemindedAt: null,
      alarmEnabled: false, notificationEnabled: false
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
        habit.weeklyTarget <= 7 ? habit.weeklyTarget : 7
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
    notificationEnabled: sourceSettings.notificationEnabled === true
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
  let heading = "Un paso a la vez";
  let phrases;
  if (total > 0 && completed === total) {
    heading = "¡Objetivo de hoy logrado!";
    phrases = [
      "Hoy lo has conseguido. Disfruta el progreso que estás construyendo.",
      "Cada hábito completado cuenta. Mañana tendrás otra oportunidad de avanzar.",
      "Has cumplido tus objetivos de hoy. ¡Buen trabajo con tu constancia!",
      "Lo importante no es la perfección, sino volver a intentarlo cada día."
    ];
  } else if (streak >= 7) {
    heading = streak + " días sumando constancia";
    phrases = [
      "Tu racha refleja pequeños esfuerzos repetidos. Sigue a tu ritmo.",
      "Mira todo lo que has avanzado. Un nuevo día es una nueva oportunidad.",
      "La constancia se construye con pasos sencillos, no con días perfectos.",
      "Llevas " + streak + " días activo. Celebra lo aprendido por el camino."
    ];
  } else if (streak >= 3) {
    heading = "¡Tu racha está creciendo!";
    phrases = [
      "Cada día cuenta, y ya estás creando tu propio ritmo.",
      "Un pequeño gesto hoy mantiene vivo el impulso de esta semana.",
      "No necesitas hacer más: necesitas continuar a tu manera.",
      "Los cambios grandes nacen de hábitos pequeños."
    ];
  } else if (completed > 0 || streak > 0) {
    heading = "Vas por buen camino";
    phrases = [
      "Ese primer paso cuenta mucho más de lo que parece.",
      "Tu esfuerzo de hoy merece reconocimiento.",
      "Lo estás haciendo: poco a poco, con calma y constancia.",
      "No hace falta terminarlo todo para haber avanzado."
    ];
  } else {
    phrases = [
      "Empieza por algo pequeño. Una acción ya es progreso.",
      "Nunca es tarde para empezar de nuevo, incluso hoy.",
      "Ve a tu ritmo. Lo importante es dar el siguiente paso.",
      "Un día sin marcas no borra todo lo que ya has conseguido."
    ];
  }
  const daySeed = Number(today.replace(/-/g, ""));
  return { heading, phrase: phrases[(daySeed + motivationShift) % phrases.length] };
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
      '<span class="habit-category">' + category.label + ' · ' +
      (targetFor(habit) === 7 ? 'Diario' : targetFor(habit) + ' días/semana') + '</span></div>' +
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

function renderReminderSettings() {
  $("reminder-enabled").checked = data.settings.reminderEnabled;
  $("reminder-time").value = data.settings.reminderTime;
  $("alarm-enabled").checked = data.settings.alarmEnabled;
  const supported = window.isSecureContext && typeof window.Notification !== "undefined";
  const permission = supported ? window.Notification.permission : "unsupported";
  const active = data.settings.notificationEnabled && permission === "granted";
  $("notification-permission-btn").textContent = active
    ? "✓ Desactivar notificaciones"
    : "Activar notificaciones del dispositivo";
  $("notification-permission-btn").disabled = permission === "unsupported" || permission === "denied";
  $("notification-status").textContent = active
    ? "Notificaciones activadas mientras HabitClik está abierta."
    : permission === "denied" ? "El navegador las ha bloqueado. Cámbialo en sus ajustes."
    : permission === "granted" ? "Permiso concedido; notificaciones de HabitClik desactivadas."
    : permission === "unsupported" ? "Este navegador o contexto no admite estas notificaciones."
    : "Permiso pendiente. Debes activarlas expresamente.";
}

function playAlarm() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return false;
  try {
    if (!alarmAudioContext) alarmAudioContext = new AudioContextClass();
    const context = alarmAudioContext;
    if (context.state === "suspended") {
      context.resume().catch((error) => console.warn("HabitClik: audio no autorizado.", error));
    }
    const origin = context.currentTime + 0.04;
    for (let i = 0; i < 2; i++) {
      const at = origin + i * 0.35;
      const osc = context.createOscillator();
      const volume = context.createGain();
      osc.type = "sine";
      osc.frequency.value = i === 0 ? 660 : 880;
      volume.gain.setValueAtTime(0.001, at);
      volume.gain.exponentialRampToValueAtTime(0.11, at + 0.04);
      volume.gain.exponentialRampToValueAtTime(0.001, at + 0.28);
      osc.connect(volume);
      volume.connect(context.destination);
      osc.start(at);
      osc.stop(at + 0.29);
    }
    return true;
  } catch (error) {
    console.warn("HabitClik: alarma no disponible.", error);
    return false;
  }
}

function sendDeviceNotification(message) {
  if (!data.settings.notificationEnabled ||
      !window.isSecureContext || !window.Notification ||
      window.Notification.permission !== "granted") return;
  const options = {
    body: message,
    icon: "./icons/icon-192.png",
    tag: "habitclik-daily",
    data: { url: "./" }
  };
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((registration) =>
      registration.showNotification("HabitClik · Tu recordatorio", options)
    ).catch((error) => console.warn("HabitClik: notificación no disponible.", error));
  } else {
    try {
      new window.Notification("HabitClik · Tu recordatorio", options);
    } catch (error) {
      console.warn("HabitClik: notificación no disponible.", error);
    }
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
  const ringLength = 2 * Math.PI * 54;
  $("progress-circle").style.strokeDasharray = String(ringLength);
  $("progress-circle").style.strokeDashoffset = String(ringLength * (1 - percent / 100));
  $("ring-title").textContent = percent + "% completado hoy";
  $("stats-total").textContent = totalCompletions();
  $("stats-best").textContent = bestStreak() + " días";
  $("stats-count").textContent = total;
  renderWeek();
  renderWeeklyGoals();
  renderHabits();
  renderCalendar();
  renderMotivation();
  renderChart();
  renderHabitStreaks();
  renderReminderSettings();
}

function showView(view) {
  currentView = ["today", "stats", "calendar"].includes(view) ? view : "today";
  $("today-view").hidden = currentView !== "today";
  $("stats-view").hidden = currentView !== "stats";
  $("calendar-view").hidden = currentView !== "calendar";
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
    $("habit-target").value = String(targetFor(habit));
  }
  $("habit-dialog").showModal();
  $("habit-name").focus();
}

function toggleHabit(id, day = keyForDate(new Date())) {
  const habit = data.habits.find((entry) => entry.id === id);
  if (!habit || !isValidDateKey(day) || day > keyForDate(new Date()) || day < habit.createdAt) return;
  const set = new Set(completedIds(day));
  const wasDone = set.has(id);
  if (wasDone) set.delete(id);
  else set.add(id);
  if (set.size) data.logs[day] = [...set];
  else delete data.logs[day];
  persist();
  render();
  showToast(wasDone ? "Hábito marcado como pendiente." :
    day === keyForDate(new Date()) ? "¡Un paso más! Hábito completado." :
      "¡Día anterior registrado! Tu historial está actualizado.");
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
  const weeklyTarget = Number($("habit-target").value);
  if (title.length < 2 || title.length > 60 || !Object.hasOwn(CATEGORIES, category) ||
      !Number.isInteger(weeklyTarget) || weeklyTarget < 1 || weeklyTarget > 7) {
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
  } else {
    if (data.habits.length >= 200) {
      showToast("Has alcanzado el límite de 200 hábitos.");
      return;
    }
    data.habits.push({ id: newId(), title, category, createdAt: keyForDate(new Date()), weeklyTarget });
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

$("export-btn").addEventListener("click", exportData);
$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (event) => {
  await importData(event.target.files[0]);
  event.target.value = "";
});

$("test-alarm-btn").addEventListener("click", () => {
  if (!playAlarm()) showToast("El navegador no admite esta alarma.");
});
$("alarm-enabled").addEventListener("change", () => {
  const enabled = $("alarm-enabled").checked;
  if (enabled && !playAlarm()) {
    $("alarm-enabled").checked = false;
    showToast("Este navegador no permite reproducir la alarma.");
    return;
  }
  data.settings.alarmEnabled = enabled;
  persist();
  showToast(enabled
    ? "Alarma activada si HabitClik está abierta y el audio permitido."
    : "Alarma sonora desactivada.");
});
$("notification-permission-btn").addEventListener("click", async () => {
  const supported = window.isSecureContext && typeof window.Notification !== "undefined";
  if (!supported) {
    showToast("Las notificaciones no están disponibles en este navegador.");
    return;
  }
  if (data.settings.notificationEnabled) {
    data.settings.notificationEnabled = false;
    persist();
    renderReminderSettings();
    showToast("Notificaciones de HabitClik desactivadas.");
    return;
  }
  try {
    const permission = window.Notification.permission === "granted"
      ? "granted" : await window.Notification.requestPermission();
    if (permission === "granted") {
      data.settings.notificationEnabled = true;
      data.settings.reminderEnabled = true;
      persist();
      showToast("Notificaciones activadas. Mantén HabitClik abierta para recibirlas.");
      showPendingReminder();
    } else {
      showToast("Sin permiso del navegador; puedes usar avisos dentro de la app.");
    }
  } catch (error) {
    console.warn("HabitClik: permiso de notificación no disponible.", error);
    showToast("No se pudo solicitar permiso para notificaciones.");
  }
  renderReminderSettings();
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
showPendingReminder();