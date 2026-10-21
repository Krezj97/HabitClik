"use strict";

/* Android Capacitor bridge. The website never asks for native permissions.
 * Schedule only short, bounded local reminders after explicit Android consent.
 * Inexact alarms avoid privileged exact-alarm permission / Play Store restrictions.
 */
(function () {
  const CHANNELS = Object.freeze({
    campanas: "hc_brisa_v1",
    digital: "hc_luz_v1",
    clasica: "hc_despertar_v1",
    alegre: "hc_buen_dia_v1",
    energia: "hc_bosque_v1"
  });
  const TEST_CHANNEL = "hc_prueba_v1";
  const SCHEDULE_START = 810000;
  const GENERAL_START = 820000;
  const TEST_NOW = 829990;
  const TEST_LATER = 829991;
  const DAYS = 7;
  let queue = Promise.resolve();

  function isNative() {
    const c = window.Capacitor;
    return !!(c && typeof c.isNativePlatform === "function" && c.isNativePlatform() &&
      typeof c.getPlatform === "function" && c.getPlatform() === "android");
  }

  function plugin() {
    return isNative() && window.Capacitor.Plugins
      ? window.Capacitor.Plugins.LocalNotifications : null;
  }

  function validTime(value) {
    return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function dateKey(date) {
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
      "-" + String(date.getDate()).padStart(2, "0");
  }

  function checkPermission() {
    const p = plugin();
    if (!p) return Promise.resolve({display: "unavailable"});
    return p.checkPermissions();
  }

  async function requestPermission() {
    const p = plugin();
    if (!p) return {display: "unavailable"};
    return p.requestPermissions();
  }

  async function channels() {
    const p = plugin();
    if (!p) return;
    const descriptions = [
      ["campanas", "Brisa"], ["digital", "Luz"],
      ["clasica", "Despertar"], ["alegre", "Buen día"], ["energia", "Bosque"]
    ];
    for (const [tone, title] of descriptions) {
      // Android 8+ picks native sounds from notification channels, NOT Web Audio.
      await p.createChannel({
        id: CHANNELS[tone], name: "Hábitos · " + title,
        description: "Recordatorios de hábitos con el tono " + title,
        importance: 4, visibility: 1, vibration: true,
        sound: "hc_" + tone + ".mp3"
      });
    }
    await p.createChannel({
      id: TEST_CHANNEL, name: "Pruebas HabitClik",
      description: "Comprobaciones de avisos nativos de Android",
      importance: 4, visibility: 1, vibration: true, sound: "hc_campanas.mp3"
    });
  }

  function isPendingOn(data, habit, day) {
    if (!habit || !habit.alarmEnabled || !validTime(habit.alarmTime) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(habit.createdAt || "") ||
        habit.createdAt > day) return false;
    const logs = data.logs && typeof data.logs === "object" ? data.logs : {};
    if (Array.isArray(logs[day]) && logs[day].includes(habit.id)) return false;
    const target = Number.isInteger(habit.weeklyTarget) &&
      habit.weeklyTarget >= 1 && habit.weeklyTarget <= 7 ? habit.weeklyTarget : 7;
    const cursor = new Date(day + "T12:00:00");
    cursor.setDate(cursor.getDate() - (cursor.getDay() + 6) % 7);
    let completed = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      const key = dateKey(d);
      if (key <= day && key >= habit.createdAt &&
          Array.isArray(logs[key]) && logs[key].includes(habit.id)) completed++;
    }
    return completed < target;
  }

  function nextNotifications(data, now = new Date()) {
    if (!data || !Array.isArray(data.habits)) return [];
    const result = [];
    const settings = data.settings || {};
    const habits = data.habits.slice(0, 200);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    for (let offset = 0; offset < DAYS; offset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const day = dateKey(date);
      let active = 0;
      habits.forEach((habit, index) => {
        if (!isPendingOn(data, habit, day)) {
          if (habit.createdAt <= day) active++;
          return;
        }
        active++;
        const [hours, minutes] = habit.alarmTime.split(":").map(Number);
        const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
        if (at.getTime() <= now.getTime() + 15000) return;
        const tone = Object.hasOwn(CHANNELS, habit.alarmTone) ? habit.alarmTone : "campanas";
        result.push({
          id: SCHEDULE_START + index * DAYS + offset,
          title: "HabitClik · " + String(habit.title).slice(0, 60),
          body: "Un momento para ti, cuando te venga bien.",
          channelId: CHANNELS[tone], foreground: true, autoCancel: true,
          extra: {type: "habit", habitId: habit.id},
          schedule: {at, isExactNotification: false}
        });
      });
      if (settings.reminderEnabled && validTime(settings.reminderTime) && active > 0) {
        const [hours, minutes] = settings.reminderTime.split(":").map(Number);
        const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
        if (at.getTime() > now.getTime() + 15000) {
          result.push({
            id: GENERAL_START + offset, title: "HabitClik · Tu momento",
            body: "Cuando tengas un momento, revisa cómo van tus hábitos.",
            channelId: CHANNELS.campanas, foreground: true, autoCancel: true,
            extra: {type: "general"},
            schedule: {at, isExactNotification: false}
          });
        }
      }
    }
    return result;
  }

  async function doSync(data) {
    const p = plugin();
    if (!p) return {ok: false, reason: "unavailable"};
    const permission = await p.checkPermissions();
    if (permission.display !== "granted") return {ok: false, reason: permission.display};
    await channels();
    const pending = await p.getPending();
    const ids = (pending.notifications || []).filter((item) =>
      Number.isInteger(item.id) &&
      ((item.id >= SCHEDULE_START && item.id < GENERAL_START) ||
       (item.id >= GENERAL_START && item.id < GENERAL_START + DAYS))
    ).map((item) => ({id: item.id}));
    if (ids.length) await p.cancel({notifications: ids});
    const notifications = nextNotifications(data);
    if (notifications.length) await p.schedule({notifications});
    return {ok: true, scheduled: notifications.length};
  }

  function sync(data) {
    if (!isNative()) return Promise.resolve({ok: false, reason: "web"});
    const snapshot = JSON.parse(JSON.stringify(data || {}));
    // Changes can arrive while the previous native call is running.
    queue = queue.catch(() => {}).then(() => doSync(snapshot));
    return queue;
  }

  async function test(delaySeconds = 0) {
    const p = plugin();
    if (!p) return {ok: false, reason: isNative() ? "missing-plugin" : "web"};
    const status = await p.checkPermissions();
    if (status.display !== "granted") return {ok: false, reason: status.display};
    await channels();
    const later = delaySeconds > 0;
    const at = new Date(Date.now() + Math.max(10, delaySeconds) * 1000);
    const notification = {
      id: later ? TEST_LATER : TEST_NOW,
      title: "HabitClik · ¡Funciona!",
      body: later
        ? "Esta notificación la ha enviado Android, incluso sin abrir HabitClik."
        : "Esta prueba viene de Android, no del navegador.",
      channelId: TEST_CHANNEL, foreground: true, autoCancel: true,
      extra: {type: "test"}
    };
    if (later) notification.schedule = {at, isExactNotification: false};
    await p.schedule({notifications: [notification]});
    return {ok: true, delaySeconds: later ? delaySeconds : 0};
  }

  window.HABITCLIK_NATIVE = Object.freeze({
    isNative, isAvailable: () => !!plugin(),
    checkPermission, requestPermission, sync, test,
    nextNotifications, // deterministic scheduling, covered by regression tests
    channels
  });
})();
