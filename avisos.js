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

function notificationPermission() {
  if (!window.isSecureContext || typeof window.Notification === "undefined") return "unsupported";
  return window.Notification.permission || "default";
}

function render() {
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
  try {
    customAudioInfo = await window.HABITCLIK_SOUNDS.getCustomInfo();
  } catch (error) {
    customAudioInfo = null;
    console.warn("HabitClik: audio personalizado no disponible.", error);
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
}

$("alarm-custom-file").addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file || !window.HABITCLIK_SOUNDS) return;
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

async function notify(message) {
  if (notificationPermission() !== "granted") return false;
  const options = {
    body: message,
    icon: "./icons/icon-192.png",
    tag: "habitclik-daily",
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
  if (!settings.reminderEnabled || document.hidden) return;
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

$("reminder-enabled").addEventListener("change", () => {
  settings.reminderEnabled = $("reminder-enabled").checked;
  saveSettings();
  render();
  showToast(settings.reminderEnabled ? "Recordatorio diario activado." : "Recordatorio diario desactivado.");
  maybeRemind();
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
  $("alarm-volume-value").textContent = $("alarm-volume").value + " %";
});
$("alarm-volume").addEventListener("change", () => {
  const volume = Number($("alarm-volume").value);
  if (!Number.isInteger(volume) || volume < 10 || volume > 100) return;
  settings.alarmVolume = volume;
  saveSettings();
  showToast("Volumen actualizado: " + volume + " %");
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

$("calendar-export-btn").addEventListener("click", downloadCalendar);

window.addEventListener("focus", () => {
  render();
  maybeRemind();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    render();
    maybeRemind();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === DATA_KEY || event.key === SETTINGS_KEY) {
    settings = loadSettings();
    render();
  }
});
setInterval(maybeRemind, 60000);
refreshCustomAudio().catch((error) =>
  console.warn("HabitClik: no se pudo restaurar el audio personalizado.", error)
);
maybeRemind();
