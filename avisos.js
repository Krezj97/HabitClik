"use strict";

// Standalone reminder settings: this page does not depend on app.js.
// This keeps Avisos usable if an older dashboard script is cached or fails.
const SETTINGS_KEY = "habitclik:settings:v1";
const DATA_KEY = "habitclik:v1";
const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  reminderEnabled: false,
  reminderTime: "19:00",
  lastRemindedAt: null,
  notificationEnabled: false,
  alarmEnabled: false,
  alarmVolume: 50,
  alarmTone: "campanas"
};
let settings = { ...DEFAULTS };
let audioContext = null;
let toastTimer;
let customAudioInfo = null;
let customAudioRevision = 0;

function validTime(t) {
  return typeof t === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
}

function dateKey(value) {
  return value.getFullYear() + "-" +
    String(value.getMonth() + 1).padStart(2, "0") + "-" +
    String(value.getDate()).padStart(2, "0");
}

function sanitizedSettings(input) {
  const s = input && typeof input === "object" ? input : {};
  return {
    reminderEnabled: s.reminderEnabled === true,
    reminderTime: validTime(s.reminderTime) ? s.reminderTime : "19:00",
    lastRemindedAt: typeof s.lastRemindedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(s.lastRemindedAt) ? s.lastRemindedAt : null,
    notificationEnabled: s.notificationEnabled === true,
    alarmEnabled: s.alarmEnabled === true,
    alarmVolume: Number.isInteger(s.alarmVolume) && s.alarmVolume >= 10 &&
      s.alarmVolume <= 100 ? s.alarmVolume : 50,
    alarmTone: window.HABITCLIK_SOUNDS &&
      window.HABITCLIK_SOUNDS.isValid(s.alarmTone) ? s.alarmTone : "campanas"
  };
}

function readSavedData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && Array.isArray(data.habits) && data.logs &&
      typeof data.logs === "object" && !Array.isArray(data.logs) ? data : null;
  } catch (error) {
    console.warn("HabitClik: no se pudieron leer los hábitos.", error);
    return null;
  }
}

function loadSettings() {
  const data = readSavedData();
  if (data) return sanitizedSettings(data.settings);
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return sanitizedSettings(raw ? JSON.parse(raw) : null);
  } catch (error) {
    console.warn("HabitClik: no se pudieron leer las preferencias.", error);
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    const data = readSavedData();
    if (data) {
      // Refresh the stored object first: never overwrite habit logs with a stale copy.
      data.settings = { ...sanitizedSettings(data.settings), ...settings };
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
    } else {
      // Do not initialize an empty HabitClik data set; preserve first-run examples.
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
    if (isAndroidApp() && window.HABITCLIK_NATIVE.isAvailable()) {
      const current = readSavedData() || {habits: [], logs: {}, settings};
      window.HABITCLIK_NATIVE.sync(current)
        .catch((error) => console.warn("HabitClik: error programando avisos Android.", error));
    }
    return true;
  } catch (error) {
    console.warn("HabitClik: no se pudieron guardar las preferencias.", error);
    showToast("No se pudo guardar: revisa el almacenamiento del navegador.");
    return false;
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4500);
}

function isAndroidApp() {
  return !!(window.HABITCLIK_NATIVE && window.HABITCLIK_NATIVE.isNative());
}

async function showNativeNotificationStatus() {
  if (!isAndroidApp()) return;
  const native = window.HABITCLIK_NATIVE;
  const status = $("notification-status");
  $("native-test-later-btn").hidden = !native.isAvailable();
  $("native-test-help").hidden = !native.isAvailable();
  $("individual-alarm-help").textContent = native.isAvailable()
    ? "En Android, cada hábito con aviso activo se programa en el sistema durante los próximos 7 días, con su propio tono. Abre la app semanalmente para renovarlos; la hora puede retrasarse por el ahorro de batería."
    : "Esta APK es anterior al sistema de notificaciones nativas. Actualiza HabitClik (Pruebas) para recibirlas.";
  if (!native.isAvailable()) {
    status.textContent = "Actualiza la APK";
    $("notification-permission-btn").textContent = "Instala la nueva APK";
    $("notification-help").textContent = "No se encuentra el complemento de notificaciones Android. Esta prueba requiere la nueva versión de HabitClik.";
    return;
  }
  try {
    const permission = await native.checkPermission();
    const granted = permission.display === "granted";
    status.textContent = granted
      ? settings.notificationEnabled ? "Android activado" : "Pausadas en HabitClik"
      : permission.display === "denied" ? "Bloqueadas en Android" : "Sin permiso de Android";
    $("notification-permission-btn").textContent = granted && settings.notificationEnabled
      ? "Desactivar en HabitClik" : "Activar en Android";
    $("notification-help").textContent = granted
      ? settings.notificationEnabled
        ? "¡Perfecto! Android tiene permiso. Haz una prueba ahora o con la pantalla bloqueada. Los tonos se regulan desde Notificaciones del sistema."
        : "Android permite los avisos, pero los has pausado dentro de HabitClik."
      : permission.display === "denied"
        ? "Android ha bloqueado los avisos. Ve a Ajustes > Apps > HabitClik (Pruebas) > Notificaciones y permítelos."
        : "Pulsa «Activar en Android». Tu móvil te preguntará si quieres permitir notificaciones.";
  } catch (error) {
    $("notification-help").textContent = "No he podido comprobar los permisos de Android. Cierra y abre HabitClik para probar de nuevo.";
    console.warn("HabitClik: no se pudo consultar el permiso Android.", error);
  }
}

function notificationPermission() {
  if (!window.isSecureContext || typeof window.Notification === "undefined") return "unsupported";
  return window.Notification.permission || "default";
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function renderHabitAlarms() {
  const data = readSavedData();
  const habits = data ? data.habits : [];
  const target = $("per-habit-alarm-list");
  if (!habits.length) {
    target.innerHTML = '<div class="per-habit-empty">Todavía no tienes hábitos. Crea uno en Mi día y podrás elegir aquí cuándo recordarlo.</div>';
    return;
  }
  const tones = window.HABITCLIK_SOUNDS ? window.HABITCLIK_SOUNDS.choices : [];
  target.innerHTML = habits.map((habit) => {
    const id = safeText(habit.id);
    const time = validTime(habit.alarmTime) ? habit.alarmTime : "19:00";
    const tone = window.HABITCLIK_SOUNDS && window.HABITCLIK_SOUNDS.isValid(habit.alarmTone)
      ? habit.alarmTone : "campanas";
    const choices = tones.filter((voice) => voice.id !== "personalizada").map((voice) =>
      '<option value="' + safeText(voice.id) + '"' + (voice.id === tone ? ' selected' : '') +
      '>' + safeText(voice.title) + '</option>').join("");
    const hasCustom = tone === "personalizada";
    return '<div class="per-habit-alarm-item" data-habit="' + id + '">' +
      '<div class="per-habit-alarm-heading"><strong>' + safeText(habit.title) + '</strong>' +
      '<label class="per-habit-alarm-switch"><input type="checkbox" data-habit-alarm="enabled" data-id="' + id + '"' +
      (habit.alarmEnabled ? " checked" : "") + '> Avisarme</label></div>' +
      '<div class="per-habit-alarm-controls"><label>Hora<input type="time" data-habit-alarm="time" data-id="' + id +
      '" value="' + time + '"></label><label>Sonido<select data-habit-alarm="tone" data-id="' + id + '">' +
      choices + (customAudioInfo || hasCustom ? '<option value="personalizada"' +
      (hasCustom ? ' selected' : '') + '>Mi audio personalizado</option>' : '') +
      '</select></label></div>' +
      '<button type="button" class="settings-action per-habit-preview" data-habit-alarm="preview" data-id="' + id +
      '">♪ Escuchar sonido</button></div>';
  }).join("");
}

function updateHabitAlarm(id, update) {
  const data = readSavedData();
  const habit = data && data.habits.find((item) => item.id === id);
  if (!habit) return false;
  if (Object.hasOwn(update, "alarmTime") && !validTime(update.alarmTime)) return false;
  if (Object.hasOwn(update, "alarmTone") &&
      !(window.HABITCLIK_SOUNDS && window.HABITCLIK_SOUNDS.isValid(update.alarmTone))) return false;
  Object.assign(habit, update);
  if (update.alarmEnabled === false) habit.lastAlarmAt = null;
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    if (isAndroidApp() && window.HABITCLIK_NATIVE.isAvailable()) {
      window.HABITCLIK_NATIVE.sync(data)
        .catch((error) => console.warn("HabitClik: no se pudo actualizar el aviso Android.", error));
    }
    return true;
  } catch (error) {
    console.warn("HabitClik: no se pudo guardar el aviso del hábito.", error);
    return false;
  }
}

function dueHabitAlarms(data, now) {
  const today = dateKey(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  const completed = Array.isArray(data.logs[today]) ? data.logs[today] : [];
  return data.habits.filter((habit) => {
    if (!habit.alarmEnabled || habit.lastAlarmAt === today ||
        !validTime(habit.alarmTime) || completed.includes(habit.id) ||
        habit.createdAt > today) return false;
    const [hours, mins] = habit.alarmTime.split(":").map(Number);
    if (minutes < hours * 60 + mins) return false;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    let weekly = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = dateKey(d);
      if (key >= habit.createdAt && Array.isArray(data.logs[key]) &&
          data.logs[key].includes(habit.id)) weekly++;
    }
    return weekly < (habit.weeklyTarget || 7);
  });
}

function maybeRemindHabits() {
  if (isAndroidApp() || document.hidden) return;
  const data = readSavedData();
  if (!data) return;
  const now = new Date();
  const due = dueHabitAlarms(data, now);
  if (!due.length) return;
  const today = dateKey(now);
  for (const habit of due) habit.lastAlarmAt = today;
  try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); }
  catch (error) { console.warn("HabitClik: no se guardaron las alarmas individuales.", error); return; }
  due.forEach((habit, index) => {
    const announce = () => {
      const message = "Un momento para " + habit.title + ". ¿Te apetece hacerlo ahora?";
      showToast(message);
      if (settings.notificationEnabled) notify(message, "habitclik-habit-" + habit.id);
      if (window.HABITCLIK_SOUNDS) {
        window.HABITCLIK_SOUNDS.play(habit.alarmTone, settings.alarmVolume)
          .catch((error) => console.warn("HabitClik: fallo al reproducir el aviso.", error));
      }
    };
    if (index === 0) announce();
    else setTimeout(announce, index * 12000);
  });
}

function render() {
  renderHabitAlarms();
  $("reminder-enabled").checked = settings.reminderEnabled;
  $("reminder-time").value = settings.reminderTime;
  $("alarm-enabled").checked = settings.alarmEnabled;
  $("alarm-tone").value = settings.alarmTone;
  renderToneDescription();
  $("alarm-volume").value = String(settings.alarmVolume);
  $("alarm-volume-value").textContent = settings.alarmVolume + " %";
  $("reminder-overview").textContent = settings.reminderEnabled
    ? "Aviso diario activo · " + settings.reminderTime
    : "Avisos diarios desactivados";

  const permission = notificationPermission();
  const active = settings.notificationEnabled && permission === "granted";
  const status = $("notification-status");
  status.classList.toggle("is-active", active);
  status.classList.toggle("is-warning", permission === "denied" || permission === "unsupported");
  status.textContent = active ? "Activadas"
    : permission === "denied" ? "Bloqueadas"
    : permission === "unsupported" ? "No disponibles" : "Desactivadas";

  $("notification-permission-btn").textContent = active
    ? "Desactivar notificaciones"
    : permission === "denied" ? "Cómo desbloquearlas"
    : permission === "unsupported" ? "Ver alternativas"
    : "Activar notificaciones";
  $("notification-help").textContent = permission === "denied"
    ? "Bloqueadas en el navegador. Abre los ajustes de permisos de este sitio y permite las notificaciones."
    : permission === "unsupported"
    ? "Este navegador no las ofrece aquí. En algunos iPhone hay que instalar la web desde Safari. También puedes usar el calendario."
    : active
    ? "Permiso concedido. Pulsa «Enviar prueba» para comprobarlo. Funcionan mientras HabitClik está activa."
    : "Actívalas y concede el permiso. Después pulsa «Enviar prueba» para verificarlo.";
  if (isAndroidApp()) {
    showNativeNotificationStatus();
  }
}

function renderToneDescription() {
  const voices = window.HABITCLIK_SOUNDS && window.HABITCLIK_SOUNDS.choices;
  const chosen = voices && voices.find((voice) => voice.id === settings.alarmTone);
  $("alarm-tone-description").textContent = settings.alarmTone === "personalizada"
    ? customAudioInfo
      ? "Mi alarma: " + customAudioInfo.name + ". Pulsa «Escuchar prueba» para oírla."
      : "No se encuentra tu archivo. Añade un audio para volver a usar este tono."
    : chosen
      ? chosen.title + ": " + chosen.description + "."
      : "Elige el sonido que más te guste y pulsa «Escuchar prueba».";
}

async function refreshCustomAudio() {
  if (!window.HABITCLIK_SOUNDS) return;
  const revision = customAudioRevision;
  let info = null;
  let failed = false;
  try {
    info = await window.HABITCLIK_SOUNDS.getCustomInfo();
  } catch (error) {
    failed = true;
    console.warn("HabitClik: audio personalizado no disponible.", error);
  }
  // Avoid a stale on-load lookup undoing a file uploaded while it was running.
  if (revision !== customAudioRevision) return;
  customAudioInfo = info;
  if (failed) {
    $("alarm-custom-status").textContent = "Este navegador no permite acceder al audio guardado.";
  }
  const option = $("alarm-custom-choice");
  option.disabled = !customAudioInfo;
  option.textContent = customAudioInfo
    ? "Mi alarma — " + customAudioInfo.name.slice(0, 28)
    : "Mi alarma (sube tu audio)";
  $("alarm-custom-remove").hidden = !customAudioInfo;
  if (customAudioInfo) {
    $("alarm-custom-status").textContent = "Guardado: " + customAudioInfo.name;
  } else if ($("alarm-custom-status").textContent.startsWith("Guardado:")) {
    $("alarm-custom-status").textContent = "Aún no has añadido un sonido propio.";
  }
  if (settings.alarmTone === "personalizada" && !customAudioInfo) {
    settings.alarmTone = "campanas";
    saveSettings();
  }
  $("alarm-tone").value = settings.alarmTone;
  renderToneDescription();
  renderHabitAlarms();
}

$("alarm-custom-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file || !window.HABITCLIK_SOUNDS) return;
  customAudioRevision++;
  $("alarm-custom-status").textContent = "Guardando tu audio en este dispositivo…";
  try {
    const saved = await window.HABITCLIK_SOUNDS.saveCustom(file);
    customAudioInfo = saved;
    settings.alarmTone = "personalizada";
    saveSettings();
    await refreshCustomAudio();
    $("alarm-custom-status").textContent = "Listo: " + saved.name + ". Ya puedes escucharlo.";
    showToast("Tu alarma personalizada se ha guardado y seleccionado.");
  } catch (error) {
    $("alarm-custom-status").textContent = error instanceof Error
      ? error.message : "No se pudo guardar el audio.";
    showToast("No se pudo añadir tu sonido. Comprueba el formato y el tamaño.");
  } finally {
    $("alarm-custom-file").value = "";
  }
});

$("alarm-custom-remove").addEventListener("click", async () => {
  if (!window.HABITCLIK_SOUNDS) return;
  customAudioRevision++;
  try {
    await window.HABITCLIK_SOUNDS.removeCustom();
    customAudioInfo = null;
    if (settings.alarmTone === "personalizada") {
      settings.alarmTone = "campanas";
      saveSettings();
    }
    await refreshCustomAudio();
    $("alarm-custom-status").textContent = "Audio eliminado de este navegador.";
    showToast("Alarma personal eliminada. Se ha seleccionado Campanas.");
  } catch (error) {
    $("alarm-custom-status").textContent = "No se pudo eliminar el archivo del navegador.";
    console.warn("HabitClik: error al eliminar audio.", error);
  }
});

async function playSound() {
  if (!window.HABITCLIK_SOUNDS) return false;
  return window.HABITCLIK_SOUNDS.play(settings.alarmTone, settings.alarmVolume);
}

async function notify(message, tag = "habitclik-daily") {
  if (notificationPermission() !== "granted") return false;
  const options = {
    body: message,
    icon: "./icons/icon-192.png",
    tag,
    data: { url: "./" }
  };
  try {
    if ("serviceWorker" in navigator &&
        typeof navigator.serviceWorker.getRegistration === "function") {
      const reg = await navigator.serviceWorker.getRegistration("./");
      if (reg && reg.active && typeof reg.showNotification === "function") {
        await reg.showNotification("HabitClik · Tu recordatorio", options);
        return true;
      }
    }
    new window.Notification("HabitClik · Tu recordatorio", options);
    return true;
  } catch (error) {
    console.warn("HabitClik: el navegador no pudo mostrar la notificación.", error);
    return false;
  }
}

function pendingCount() {
  const data = readSavedData();
  if (!data) return 0;
  const today = dateKey(new Date());
  const dates = data.logs || {};
  const daily = Array.isArray(dates[today]) ? dates[today] : [];
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return data.habits.filter((habit) => {
    if (habit.createdAt > today || daily.includes(habit.id)) return false;
    const target = Number.isInteger(habit.weeklyTarget) &&
      habit.weeklyTarget >= 1 && habit.weeklyTarget <= 7 ? habit.weeklyTarget : 7;
    let weekly = 0;
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const key = dateKey(day);
      if (key >= habit.createdAt && Array.isArray(dates[key]) && dates[key].includes(habit.id)) weekly++;
    }
    return weekly < target;
  }).length;
}

function maybeRemind() {
  if (isAndroidApp() || !settings.reminderEnabled || document.hidden) return;
  const now = new Date();
  const today = dateKey(now);
  if (settings.lastRemindedAt === today ||
      now.getHours() * 60 + now.getMinutes() <
      Number(settings.reminderTime.slice(0, 2)) * 60 + Number(settings.reminderTime.slice(3))) return;

  const count = pendingCount();
  if (!count) return;
  settings.lastRemindedAt = today;
  if (!saveSettings()) return;
  const message = "Tienes " + count + (count === 1 ? " hábito pendiente" : " hábitos pendientes") +
    " para avanzar en tus metas.";
  showToast(message);
  if (settings.notificationEnabled) {
    notify(message).catch((error) => console.warn("HabitClik:", error));
  }
  if (settings.alarmEnabled) {
    playSound().catch((error) => console.warn("HabitClik:", error));
  }
}

function icalTime(d) {
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") + "T" +
    String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "00";
}

function downloadCalendar() {
  const [hours, minutes] = settings.reminderTime.split(":").map(Number);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
  if (start <= now) start.setDate(start.getDate() + 1);
  const end = new Date(start.getTime() + 10 * 60 * 1000);
  const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ical = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN",
    "PRODID:-//HabitClik//Reminder//ES", "BEGIN:VEVENT",
    "UID:habitclik-" + Date.now() + "-" + Math.random().toString(36).slice(2) + "@habitclik",
    "DTSTAMP:" + dtstamp,
    "DTSTART:" + icalTime(start), "DTEND:" + icalTime(end),
    "RRULE:FREQ=DAILY",
    "SUMMARY:HabitClik - revisar mis habitos",
    "DESCRIPTION:Revisa tus habitos en HabitClik.",
    "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT5M",
    "DESCRIPTION:HabitClik - tu aviso diario", "END:VALARM", "END:VEVENT", "END:VCALENDAR", ""
  ].join("\r\n");

  try {
    const url = URL.createObjectURL(new Blob([ical], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "habitclik-recordatorio.ics";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Archivo descargado: impórtalo en tu calendario y activa sus alertas.");
  } catch (error) {
    console.warn("HabitClik: no se pudo exportar el calendario.", error);
    showToast("No se pudo descargar el calendario en este navegador.");
  }
}

settings = loadSettings();
render();

$("per-habit-alarm-list").addEventListener("change", (event) => {
  const control = event.target;
  const id = control && control.dataset && control.dataset.id;
  if (!id) return;
  const kind = control.dataset.habitAlarm;
  const next = kind === "enabled" ? { alarmEnabled: control.checked }
    : kind === "time" ? { alarmTime: control.value }
    : kind === "tone" ? { alarmTone: control.value } : null;
  if (!next) return;
  if (updateHabitAlarm(id, next)) showToast("¡Listo! Este hábito ya tiene su propio aviso.");
  else showToast("No hemos podido guardar el cambio. Inténtalo otra vez.");
  renderHabitAlarms();
});

$("per-habit-alarm-list").addEventListener("click", (event) => {
  const control = event.target.closest('button[data-habit-alarm="preview"]');
  if (!control) return;
  const data = readSavedData();
  const habit = data && data.habits.find((h) => h.id === control.dataset.id);
  if (!habit || !window.HABITCLIK_SOUNDS) return;
  window.HABITCLIK_SOUNDS.play(habit.alarmTone || "campanas", settings.alarmVolume)
    .then((ok) => showToast(ok ? "♪ Así sonará este hábito." : "No se pudo reproducir el sonido."))
    .catch(() => showToast("No se pudo reproducir el sonido."));
});


$("reminder-enabled").addEventListener("change", () => {
  settings.reminderEnabled = $("reminder-enabled").checked;
  saveSettings();
  render();
  showToast(settings.reminderEnabled ? "Recordatorio diario activado." : "Recordatorio diario desactivado.");
  maybeRemind();
  maybeRemindHabits();
});

$("reminder-time").addEventListener("change", () => {
  const time = $("reminder-time").value;
  if (!validTime(time)) {
    render();
    showToast("Selecciona una hora válida.");
    return;
  }
  settings.reminderTime = time;
  saveSettings();
  render();
  showToast("Hora del recordatorio guardada: " + time);
  maybeRemind();
});

$("alarm-tone").addEventListener("change", () => {
  const tone = $("alarm-tone").value;
  if (!window.HABITCLIK_SOUNDS || !window.HABITCLIK_SOUNDS.isValid(tone)) {
    render();
    showToast("Selecciona uno de los cinco sonidos disponibles.");
    return;
  }
  settings.alarmTone = tone;
  saveSettings();
  renderToneDescription();
  showToast("Sonido seleccionado. Pulsa «Escuchar prueba» para oírlo.");
});

$("alarm-volume").addEventListener("input", () => {
  const volume = Number($("alarm-volume").value);
  if (!Number.isInteger(volume) || volume < 10 || volume > 100) return;
  settings.alarmVolume = volume;
  $("alarm-volume-value").textContent = volume + " %";
  // Update the sound already playing, instead of changing only the label.
  if (window.HABITCLIK_SOUNDS) window.HABITCLIK_SOUNDS.setVolume(volume);
  $("alarm-volume-hint").textContent = "Volumen: " + volume + " %. Suelta para escuchar cómo queda.";
});
$("alarm-volume").addEventListener("change", async () => {
  const volume = Number($("alarm-volume").value);
  if (!Number.isInteger(volume) || volume < 10 || volume > 100) return;
  settings.alarmVolume = volume;
  saveSettings();
  $("alarm-volume-value").textContent = volume + " %";
  $("alarm-volume-hint").textContent = "Volumen guardado al " + volume + " %. Reproduciendo prueba…";
  const played = await playSound();
  $("alarm-volume-hint").textContent = played
    ? "Volumen guardado: " + volume + " %. Puedes volver a ajustarlo."
    : "Volumen guardado. El navegador no permitió reproducir la prueba.";
  $("alarm-status").textContent = played
    ? "Prueba reproducida al " + volume + " % de volumen."
    : "El navegador ha bloqueado la prueba de volumen.";
});

$("test-alarm-btn").addEventListener("click", async () => {
  $("alarm-status").textContent = "Comprobando sonido…";
  const played = await playSound();
  $("alarm-status").textContent = played
    ? "Sonido seleccionado reproducido. Si no lo oyes, comprueba el volumen y el modo silencio."
    : "El navegador no permitió el audio. Prueba otra vez o revisa el dispositivo.";
  showToast(played ? "♪ Prueba de sonido enviada." : "No fue posible reproducir la prueba.");
});

$("alarm-enabled").addEventListener("change", async () => {
  if (!$("alarm-enabled").checked) {
    settings.alarmEnabled = false;
    saveSettings();
    $("alarm-status").textContent = "Alarma desactivada.";
    showToast("Alarma desactivada.");
    return;
  }
  const played = await playSound();
  if (!played) {
    $("alarm-enabled").checked = false;
    settings.alarmEnabled = false;
    saveSettings();
    $("alarm-status").textContent = "El navegador no ha permitido reproducir audio.";
    showToast("Alarma no disponible. Revisa el navegador o el modo silencio.");
    return;
  }
  settings.alarmEnabled = true;
  saveSettings();
  $("alarm-status").textContent = "Activada. Sonará cuando HabitClik esté abierta y haya un recordatorio.";
  showToast("♪ Alarma activada y sonido de prueba reproducido.");
});

$("notification-permission-btn").addEventListener("click", async () => {
  if (isAndroidApp()) {
    const native = window.HABITCLIK_NATIVE;
    if (!native.isAvailable()) {
      showToast("Actualiza la APK: este complemento no está instalado.");
      await showNativeNotificationStatus();
      return;
    }
    try {
      const status = await native.checkPermission();
      if (status.display === "granted" && settings.notificationEnabled) {
        settings.notificationEnabled = false;
        saveSettings();
        showToast("Notificaciones de HabitClik pausadas. Puedes volver a activarlas.");
      } else {
        const permission = status.display === "granted" ? status : await native.requestPermission();
        if (permission.display !== "granted") {
          settings.notificationEnabled = false;
          saveSettings();
          showToast("Android no ha concedido permiso. Revisa los ajustes de la app.");
        } else {
          settings.notificationEnabled = true;
          saveSettings();
          const result = await native.sync(readSavedData() || {habits: [],logs: {}, settings});
          showToast(result.ok
            ? "¡Notificaciones Android activadas! Ya puedes probarlas."
            : "Permiso concedido, pero no se pudo programar el recordatorio.");
        }
      }
      await showNativeNotificationStatus();
    } catch (error) {
      console.warn("HabitClik: notificaciones Android.", error);
      showToast("No se pudo configurar Android. Revisa los permisos en Ajustes.");
      await showNativeNotificationStatus();
    }
    return;
  }
  const permission = notificationPermission();
  if (permission === "unsupported") {
    $("notification-help").textContent = "Puedes instalar la web en un navegador compatible o usar el calendario del dispositivo.";
    showToast("Este navegador no admite las notificaciones de la web en este contexto.");
    return;
  }
  if (permission === "denied") {
    $("notification-help").textContent = "En ajustes del navegador → permisos del sitio → permite notificaciones para HabitClik.";
    showToast("Notificaciones bloqueadas en los ajustes del navegador.");
    return;
  }
  if (settings.notificationEnabled) {
    settings.notificationEnabled = false;
    saveSettings();
    render();
    showToast("Notificaciones desactivadas en HabitClik.");
    return;
  }
  try {
    const result = permission === "granted"
      ? "granted" : await window.Notification.requestPermission();
    if (result !== "granted") {
      render();
      showToast("Permiso no concedido; puedes utilizar los avisos del calendario.");
      return;
    }
    settings.notificationEnabled = true;
    settings.reminderEnabled = true;
    saveSettings();
    render();
    showToast("Notificaciones activadas. Pulsa «Enviar prueba» para comprobarlas.");
  } catch (error) {
    console.warn("HabitClik: fallo al solicitar permiso.", error);
    showToast("No fue posible solicitar el permiso.");
    render();
  }
});

$("test-notification-btn").addEventListener("click", async () => {
  if (isAndroidApp()) {
    try {
      const result = await window.HABITCLIK_NATIVE.test();
      $("notification-help").textContent = result.ok
        ? "Prueba enviada directamente desde Android. Abre la barra de notificaciones si no aparece como banner."
        : "Primero activa y permite las notificaciones de HabitClik en Android.";
      showToast(result.ok ? "📱 Mira las notificaciones de tu móvil." : "Activa primero los avisos de Android.");
    } catch (error) {
      console.warn("HabitClik: prueba Android.", error);
      showToast("No se pudo enviar la prueba nativa. Comprueba los ajustes de Android.");
    }
    return;
  }
  if (!settings.notificationEnabled || notificationPermission() !== "granted") {
    $("notification-help").textContent = "Primero activa las notificaciones y concede permiso al navegador.";
    showToast("Primero activa las notificaciones.");
    return;
  }
  $("notification-help").textContent = "Enviando prueba…";
  const sent = await notify("¡Esta es tu prueba de HabitClik!");
  $("notification-help").textContent = sent
    ? "Prueba enviada. Si no aparece, revisa los ajustes del sistema y el modo No molestar."
    : "El navegador no ha podido mostrarla. Prueba la web instalada o usa el calendario.";
  showToast(sent ? "Prueba de notificación enviada." : "No se pudo mostrar la notificación.");
});

$("native-test-later-btn").addEventListener("click", async () => {
  if (!isAndroidApp() || !window.HABITCLIK_NATIVE.isAvailable()) return;
  try {
    const result = await window.HABITCLIK_NATIVE.test(20);
    $("notification-help").textContent = result.ok
      ? "Prueba programada. Bloquea la pantalla: Android debería avisarte en unos 20 segundos o un poco después."
      : "Activa antes las notificaciones de Android y vuelve a probar.";
    showToast(result.ok ? "📱 Bloquea el móvil para probarlo." : "Primero activa los permisos de Android.");
  } catch (error) {
    console.warn("HabitClik: no se pudo programar una prueba.", error);
    showToast("No se pudo programar la prueba. Comprueba los ajustes de Android.");
  }
});

$("calendar-export-btn").addEventListener("click", downloadCalendar);

window.addEventListener("focus", () => {
  render();
  maybeRemind();
  maybeRemindHabits();
  if (isAndroidApp() && window.HABITCLIK_NATIVE.isAvailable()) {
    window.HABITCLIK_NATIVE.sync(readSavedData() || {habits: [], logs: {}, settings})
      .catch((error) => console.warn("HabitClik: no se pudieron renovar los avisos.", error));
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    render();
    maybeRemind();
    maybeRemindHabits();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === DATA_KEY || event.key === SETTINGS_KEY) {
    settings = loadSettings();
    render();
  }
});
// Register offline support even when Android opens Avisos directly.
if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) =>
      console.warn("HabitClik: no se pudo activar el modo sin conexión.", error)
    );
  });
}
setInterval(maybeRemind, 60000);
setInterval(maybeRemindHabits, 60000);
refreshCustomAudio().catch((error) =>
  console.warn("HabitClik: no se pudo restaurar el audio personalizado.", error)
);
maybeRemind();
maybeRemindHabits();
if (isAndroidApp() && window.HABITCLIK_NATIVE.isAvailable()) {
  window.HABITCLIK_NATIVE.sync(readSavedData() || {habits: [], logs: {}, settings})
    .catch((error) => console.warn("HabitClik: sincronización de avisos Android.", error));
}
