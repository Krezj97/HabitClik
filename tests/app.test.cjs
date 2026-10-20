"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const alarmSource = fs.readFileSync(path.join(root, "alarm-sounds.js"), "utf8");

function boot(seed, hour = 20, options = {}) {
  const elements = new Map();
  const storage = new Map(seed ? [["habitclik:v1", JSON.stringify(seed)]] : []);
  const intervals = [];
  const handlers = {};

  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: id === "habit-target" ? "7" : id === "reminder-time" ? "19:00" : id === "alarm-volume" ? "50" : "",
        checked: false,
        hidden: false,
        textContent: "",
        innerHTML: "",
        style: {},
        dataset: {},
        handlers: {},
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(type, fn) { this.handlers[type] = fn; },
        setAttribute() {},
        removeAttribute() {},
        reset() { element("habit-target").value = "7"; },
        showModal() {},
        close() {},
        focus() {},
        click() {},
        remove() {}
      });
    }
    return elements.get(id);
  }

  const document = {
    hidden: false,
    getElementById: element,
    querySelectorAll() { return []; },
    addEventListener(type, fn) { handlers[type] = fn; },
    createElement() { return element("temporary"); },
    body: { append() {} }
  };
  const window = {
    isSecureContext: options.secure ?? false,
    Notification: options.Notification,
    AudioContext: options.AudioContext,
    HABITCLIK_PHRASES: options.phrases,
    addEventListener(type, fn) { handlers["window:" + type] = fn; },
    scrollTo() {}
  };
  const localStorage = {
    getItem(key) { return storage.get(key) ?? null; },
    setItem(key, value) { storage.set(key, value); }
  };
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [2026, 9, 20, hour, 0, 0])); }
    static now() { return new Date(2026, 9, 20, hour).getTime(); }
  }

  const context = {
    document,
    window,
    navigator: options.navigator ?? {},
    URL: options.URL ?? { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    Blob,
    localStorage,
    Date: FixedDate,
    confirm: () => true,
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval(fn) { intervals.push(fn); return 2; },
    console: { warn() {} }
  };
  vm.runInNewContext(alarmSource, context, { filename: "alarm-sounds.js" });
  vm.runInNewContext(source + "\nglobalThis.testApi = {" +
    "getData: () => data, normalizeData, completionsThisWeek, weeklyStreak, " +
    "toggleHabit, showPendingReminder, renderCalendar, motivationForToday };", context, { filename: "app.js" });

  return { api: context.testApi, element, storage, intervals, handlers };
}

test("older data imports as daily habits with reminders disabled", () => {
  const old = {
    habits: [{ id: "a", title: "Leer", category: "mente", createdAt: "2026-10-01" }],
    logs: { "2026-10-19": ["a"] }
  };
  const { api } = boot(old);
  assert.equal(api.getData().habits[0].weeklyTarget, 7);
  assert.equal(api.getData().settings.reminderEnabled, false);
  assert.equal(api.getData().settings.reminderTime, "19:00");
  assert.ok(api.getData().logs["2026-10-19"].includes("a"));
});

test("weekly completions and weekly streak respect Monday-Sunday", () => {
  const { api, element } = boot({
    habits: [
      { id: "a", title: "Pasear", category: "movimiento", createdAt: "2026-10-01", weeklyTarget: 3 },
      { id: "b", title: "Leer", category: "mente", createdAt: "2026-10-01", weeklyTarget: 2 }
    ],
    logs: {
      "2026-10-12": ["a", "b"],
      "2026-10-13": ["a", "b"],
      "2026-10-14": ["a"],
      "2026-10-19": ["a", "b"],
      "2026-10-20": ["b"]
    }
  });
  assert.equal(api.completionsThisWeek(api.getData().habits[0]), 1);
  assert.equal(api.completionsThisWeek(api.getData().habits[1]), 2);
  assert.equal(api.weeklyStreak(api.getData().habits[1]), 2);
  assert.equal(element("weekly-goals-summary").textContent, "1 / 2 alcanzadas");
  assert.match(element("weekly-goals-list").innerHTML, /Meta alcanzada esta semana/);
});

test("editing the weekly target keeps the history and identity", () => {
  const { api, element } = boot({
    habits: [{ id: "a", title: "Leer", category: "mente", createdAt: "2026-10-01", weeklyTarget: 3 }],
    logs: { "2026-10-12": ["a"], "2026-10-20": ["a"] }
  });
  element("habit-list").handlers.click({
    target: { closest() { return { dataset: { action: "edit", id: "a" } }; } }
  });
  assert.equal(element("habit-target").value, "3");
  element("habit-name").value = "Leer por la mañana";
  element("habit-category").value = "mente";
  element("habit-target").value = "4";
  element("habit-form").handlers.submit({ preventDefault() {} });
  assert.equal(api.getData().habits.length, 1);
  assert.equal(api.getData().habits[0].id, "a");
  assert.equal(api.getData().habits[0].weeklyTarget, 4);
  assert.ok(api.getData().logs["2026-10-12"].includes("a"));
});

test("user-created weekly habits persist their chosen target", () => {
  const { api, element, storage } = boot();
  element("open-add-btn").handlers.click();
  element("habit-name").value = "Escribir un diario";
  element("habit-category").value = "mente";
  element("habit-target").value = "5";
  element("habit-form").handlers.submit({ preventDefault() {} });
  const newHabit = api.getData().habits.find((habit) => habit.title === "Escribir un diario");
  assert.ok(newHabit);
  assert.equal(newHabit.weeklyTarget, 5);
  assert.ok(JSON.parse(storage.get("habitclik:v1")).habits.some((habit) => habit.id === newHabit.id));
});

test("optional in-app reminder fires once a day if something is pending", () => {
  const { api, element, storage, intervals } = boot({
    habits: [{ id: "a", title: "Pasear", category: "movimiento", createdAt: "2026-10-01", weeklyTarget: 3 }],
    logs: { "2026-10-19": ["a"] },
    settings: { reminderEnabled: false, reminderTime: "19:00", lastRemindedAt: null }
  });
  assert.equal(api.getData().settings.lastRemindedAt, null);
  element("reminder-enabled").checked = true;
  element("reminder-enabled").handlers.change();
  assert.equal(api.getData().settings.lastRemindedAt, "2026-10-20");
  assert.match(element("toast").textContent, /hábito pendiente/);
  api.showPendingReminder();
  assert.equal(api.getData().settings.lastRemindedAt, "2026-10-20");
  element("reminder-time").value = "22:00";
  element("reminder-time").handlers.change();
  assert.equal(api.getData().settings.reminderTime, "22:00");
  assert.equal(JSON.parse(storage.get("habitclik:v1")).settings.reminderEnabled, true);
  assert.equal(intervals.length, 1);
});

test("PWA shell and DOM references remain consistent", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, id] of source.matchAll(/\$\("([^"]+)"\)/g)) {
    assert.ok(ids.has(id), "missing DOM element " + id);
  }
  assert.match(sw, /habitclik-static-v12/);
  assert.equal((css.match(/{/g) ?? []).length, (css.match(/}/g) ?? []).length);
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), "missing icon " + icon.src);
  }
});


test("historical calendar can mark an existing past day but not a future day", () => {
  const { api, element } = boot({
    habits: [{ id: "a", title: "Pasear", category: "movimiento", createdAt: "2026-10-01", weeklyTarget: 3 }],
    logs: {}
  });
  element("calendar-days").handlers.click({
    target: { closest() { return { disabled: false, dataset: { date: "2026-10-19" } }; } }
  });
  assert.match(element("calendar-selected-title").textContent, /19 de octubre/);
  element("calendar-habits").handlers.click({
    target: { closest() { return { dataset: { action: "calendar-toggle", id: "a" } }; } }
  });
  assert.ok(api.getData().logs["2026-10-19"].includes("a"));
  element("calendar-days").handlers.click({
    target: { closest() { return { disabled: false, dataset: { date: "2026-10-22" } }; } }
  });
  assert.match(element("calendar-selected-title").textContent, /19 de octubre/);
  assert.equal(api.getData().logs["2026-10-22"], undefined);
  element("calendar-prev").handlers.click();
  assert.match(element("calendar-month-title").textContent, /Septiembre/);
  assert.match(element("calendar-selected-title").textContent, /19 de septiembre/);
  element("calendar-next").handlers.click();
  assert.match(element("calendar-month-title").textContent, /Octubre/);
  assert.match(element("calendar-selected-title").textContent, /19 de octubre/);
});

test("calendar ignores logs from before the habit existed", () => {
  const { api } = boot({
    habits: [{ id: "a", title: "Pasear", category: "movimiento", createdAt: "2026-10-20", weeklyTarget: 3 }],
    logs: {}
  });
  api.toggleHabit("a", "2026-10-19");
  assert.equal(api.getData().logs["2026-10-19"], undefined);
  assert.equal(api.getData().habits.length, 1);
});

test("motivational message follows progress and rotates on demand", () => {
  const seed = {
    habits: [
      { id: "a", title: "Agua", category: "salud", createdAt: "2026-10-01", weeklyTarget: 7 },
      { id: "b", title: "Leer", category: "mente", createdAt: "2026-10-01", weeklyTarget: 7 }
    ],
    logs: { "2026-10-18": ["a"], "2026-10-19": ["a"], "2026-10-20": ["a"] }
  };
  const { element } = boot(seed);
  assert.equal(element("motivation-heading").textContent, "¡Tu racha está creciendo!");
  const first = element("motivation-phrase").textContent;
  element("motivation-next").handlers.click();
  assert.notEqual(element("motivation-phrase").textContent, first);
});

test("notifications need an explicit user opt-in, and can be switched off", async () => {
  const sent = [];
  function FakeNotification(title, options) { sent.push({ title, options }); }
  FakeNotification.permission = "default";
  FakeNotification.requestPermission = async () => {
    FakeNotification.permission = "granted";
    return "granted";
  };
  const { api, element } = boot({
    habits: [{ id: "a", title: "Leer", category: "mente", createdAt: "2026-10-01", weeklyTarget: 3 }],
    logs: {}
  }, 20, { secure: true, Notification: FakeNotification });
  assert.equal(api.getData().settings.notificationEnabled, false);
  assert.equal(sent.length, 0);
  await element("notification-permission-btn").handlers.click();
  assert.equal(api.getData().settings.notificationEnabled, true);
  assert.equal(api.getData().settings.reminderEnabled, true);
  assert.equal(sent.length, 0);
  await element("test-notification-btn").handlers.click();
  assert.equal(sent.length, 1);
  assert.match(sent[0].title, /HabitClik/);
  assert.match(element("notification-help").textContent, /enviada/i);
  await element("notification-permission-btn").handlers.click();
  assert.equal(api.getData().settings.notificationEnabled, false);
});

test("alarm sound is opt-in and needs an available browser audio API", async () => {
  let played = 0;
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createOscillator() {
      return { frequency: { value: 0 }, connect() {}, start() { played++; }, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
  }
  const { api, element } = boot(null, 20, { AudioContext: FakeAudioContext });
  assert.equal(api.getData().settings.alarmEnabled, false);
  assert.equal(played, 0);
  element("alarm-enabled").checked = true;
  await element("alarm-enabled").handlers.change();
  assert.equal(api.getData().settings.alarmEnabled, true);
  assert.equal(played, 4);
  assert.match(element("alarm-status").textContent, /Activada/);
  await element("test-alarm-btn").handlers.click();
  assert.equal(played, 8);
  element("alarm-volume").value = "80";
  element("alarm-volume").handlers.input();
  element("alarm-volume").handlers.change();
  assert.equal(api.getData().settings.alarmVolume, 80);
  element("alarm-enabled").checked = false;
  await element("alarm-enabled").handlers.change();
  assert.equal(api.getData().settings.alarmEnabled, false);
});

test("calendar export creates a daily event with an alarm", async () => {
  let blob;
  const fakeUrl = {
    createObjectURL(value) { blob = value; return "blob:habitclik-test"; },
    revokeObjectURL() {}
  };
  const { element } = boot(null, 20, { URL: fakeUrl });
  element("calendar-export-btn").handlers.click();
  const text = await blob.text();
  assert.match(text, /BEGIN:VCALENDAR/);
  assert.match(text, /RRULE:FREQ=DAILY/);
  assert.match(text, /BEGIN:VALARM/);
  assert.match(text, /ACTION:DISPLAY/);
  assert.match(text, /DTSTART:20261021T190000/);
});


test("notifications explain unsupported browsers instead of disabling buttons", async () => {
  const { element } = boot();
  assert.equal(element("notification-permission-btn").disabled, undefined);
  await element("notification-permission-btn").handlers.click();
  assert.match(element("toast").textContent, /navegador compatible/);
  assert.equal(element("notification-status").textContent, "No disponibles");
});

test("sound test reports when the browser has no Web Audio API", async () => {
  const { api, element } = boot();
  await element("test-alarm-btn").handlers.click();
  assert.match(element("alarm-status").textContent, /bloqueado/i);
  element("alarm-enabled").checked = true;
  await element("alarm-enabled").handlers.change();
  assert.equal(api.getData().settings.alarmEnabled, false);
  assert.equal(element("alarm-enabled").checked, false);
});

test("large motivation library loads and rotates among hundreds of unique phrases", () => {
  const phraseSource = fs.readFileSync(path.join(root, "phrases.js"), "utf8");
  const phraseWindow = {};
  vm.runInNewContext(phraseSource, { window: phraseWindow }, { filename: "phrases.js" });
  const phrases = phraseWindow.HABITCLIK_PHRASES;
  const all = Object.values(phrases).flat();
  assert.ok(all.length >= 300, "expected at least 300 motivational phrases");
  assert.equal(new Set(all).size, all.length, "phrases should not repeat");
  assert.ok(Object.values(phrases).every((list) => list.length >= 40));
  const { element } = boot(null, 20, { phrases });
  const first = element("motivation-phrase").textContent;
  element("motivation-next").handlers.click();
  assert.notEqual(element("motivation-phrase").textContent, first);
});

test("reminder settings can be reached through a standalone native link", () => {
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const avisos = fs.readFileSync(path.join(root, "avisos.html"), "utf8");
  assert.match(home, /href="\.\/avisos\.html"/);
  assert.match(avisos, /id="notification-help"/);
  assert.match(avisos, /id="alarm-status"/);
  assert.match(avisos, /id="test-notification-btn"/);
  assert.match(avisos, /id="test-alarm-btn"/);
  assert.match(avisos, /id="alarm-volume"/);
});

test("older habits receive the default alarm without overwriting other preferences", () => {
  const data = {
    habits: [{ id: "a", title: "Correr", category: "movimiento", createdAt: "2026-10-01", weeklyTarget: 3 }],
    logs: {}, settings: { alarmEnabled: true, alarmVolume: 70 }
  };
  const { api } = boot(data);
  assert.equal(api.getData().settings.alarmTone, "campanas");
  assert.equal(api.getData().settings.alarmVolume, 70);
  const imported = api.normalizeData({
    ...data, settings: { alarmEnabled: true, alarmVolume: 70, alarmTone: "digital" }
  });
  assert.equal(imported.settings.alarmTone, "digital");
  assert.equal(imported.settings.alarmEnabled, true);
  assert.equal(imported.settings.alarmVolume, 70);
});
