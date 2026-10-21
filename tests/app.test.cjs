"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const alarmSource = fs.readFileSync(path.join(root, "alarm-sounds.js"), "utf8");
const progressSource = fs.readFileSync(path.join(root, "progress.js"), "utf8");

function boot(seed, hour = 20, options = {}) {
  const elements = new Map();
  const storage = new Map(seed ? [["habitclik:v1", JSON.stringify(seed)]] : []);
  const intervals = [];
  const handlers = {};
  const alarmDayFields = [1,2,3,4,5,6,0].map((day) => ({
    checked:true, dataset:{alarmDay:String(day)}
  }));

  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: id === "habit-target" ? "7" :
          id === "habit-alarm-time" || id === "reminder-time" ? "19:00" :
          id === "habit-alarm-tone" ? "campanas" :
          id === "alarm-volume" ? "50" : "",
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
        showModal() { this.isOpen = true; },
        close() { this.isOpen = false; },
        focus() {},
        click() {},
        remove() {}
      });
    }
    return elements.get(id);
  }

  const document = {
    hidden: options.hidden ?? false,
    getElementById: element,
    querySelectorAll(selector) {
      if (selector === "[data-view]") return options.navButtons ?? [];
      if (selector === ".alarm-days-picker input[data-alarm-day]")
        return alarmDayFields;
      return [];
    },
    addEventListener(type, fn) { handlers[type] = fn; },
    createElement() { return element("temporary"); },
    body: { append() {} }
  };
  const window = {
    isSecureContext: options.secure ?? false,
    Notification: options.Notification,
    AudioContext: options.AudioContext,
    HABITCLIK_PHRASES: options.phrases,
    history: options.history,
    location: options.location,
    matchMedia: options.matchMedia,
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
  if (options.alarmPlays) {
    const engine = window.HABITCLIK_SOUNDS;
    window.HABITCLIK_SOUNDS = {
      ...engine,
      play(id, volume) { options.alarmPlays.push({ id, volume }); return Promise.resolve(true); }
    };
  }
  vm.runInNewContext(progressSource, context, { filename: "progress.js" });
  vm.runInNewContext(source + "\nglobalThis.testApi = {" +
    "getData: () => data, normalizeData, completionsThisWeek, weeklyStreak, " +
    "toggleHabit, showPendingReminder, showHabitReminders, advanceMotivation, openDialog, renderCalendar, motivationForToday };", context, { filename: "app.js" });

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
  assert.equal(intervals.length, 3); // general reminders, individual alarms and slow phrase rotation
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
  assert.match(sw, /habitclik-static-v26/);
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

test("new users have three usable free slots rather than three pre-filled demo habits", () => {
  const { api, element } = boot();
  assert.equal(api.getData().habits.length, 0);
  assert.equal(element("free-plan-count").textContent, "Plan gratis · 0/3");
  element("open-add-btn").handlers.click();
  assert.equal(element("habit-dialog").isOpen, true);
});

test("free plan allows exactly three new habits and blocks the fourth", () => {
  const { api, element, storage } = boot();
  for (let n = 1; n <= 3; n++) {
    element("open-add-btn").handlers.click();
    element("habit-name").value = "Nuevo hábito " + n;
    element("habit-category").value = "mente";
    element("habit-target").value = "5";
    element("habit-form").handlers.submit({ preventDefault() {} });
    assert.equal(api.getData().habits.length, n);
    assert.equal(element("free-plan-count").textContent, "Plan gratis · " + n + "/3");
  }
  element("open-add-btn").handlers.click();
  assert.equal(element("upgrade-dialog").isOpen, true);
  assert.equal(element("habit-dialog").isOpen, false);
  assert.equal(api.getData().habits.length, 3);

  // Guard at submit too: a stale/open developer-triggered form cannot add a fourth.
  element("habit-name").value = "Intento de cuarto";
  element("habit-category").value = "mente";
  element("habit-target").value = "7";
  element("habit-form").handlers.submit({ preventDefault() {} });
  assert.equal(api.getData().habits.length, 3);
  assert.equal(JSON.parse(storage.get("habitclik:v1")).habits.length, 3);
  assert.equal(element("upgrade-dialog").isOpen, true);
  element("upgrade-dismiss").handlers.click();
  assert.equal(element("upgrade-dialog").isOpen, false);
});

test("editing and completing existing habits remain free when quota is full", () => {
  const habits = Array.from({ length: 3 }, (_, i) => ({
    id: "h" + i, title: "Hábito " + i, category: "salud",
    createdAt: "2026-10-01", weeklyTarget: 7
  }));
  const { api, element } = boot({ habits, logs: {} });
  element("habit-list").handlers.click({
    target: { closest() { return { dataset: { action: "edit", id: "h1" } }; } }
  });
  assert.equal(element("habit-dialog").isOpen, true);
  element("habit-name").value = "Hábito actualizado";
  element("habit-target").value = "4";
  element("habit-form").handlers.submit({ preventDefault() {} });
  assert.equal(api.getData().habits.length, 3);
  assert.equal(api.getData().habits[1].title, "Hábito actualizado");
  api.toggleHabit("h1");
  assert.ok(api.getData().logs["2026-10-20"].includes("h1"));
});

test("existing users with more than three habits keep their history without gaining new slots", () => {
  const habits = Array.from({ length: 4 }, (_, i) => ({
    id: "h" + i, title: "Hábito " + i, category: "salud",
    createdAt: "2026-10-01", weeklyTarget: 7
  }));
  const { api, element } = boot({ habits, logs: { "2026-10-19": ["h3"] } });
  assert.equal(api.getData().habits.length, 4);
  assert.deepEqual(Array.from(api.getData().logs["2026-10-19"]), ["h3"]);
  assert.match(element("free-plan-count").textContent, /4 existentes/);
  element("open-add-btn").handlers.click();
  assert.equal(element("upgrade-dialog").isOpen, true);
  assert.equal(api.getData().habits.length, 4);
  api.toggleHabit("h3");
  assert.ok(api.getData().logs["2026-10-20"].includes("h3"));
});

test("backup imports cannot bypass the free limit or silently delete imported history", async () => {
  const { api, element } = boot();
  const makeBackup = (count) => ({
    habits: Array.from({ length: count }, (_, i) => ({
      id: "h" + i, title: "Hábito " + i, category: "salud",
      createdAt: "2026-10-01", weeklyTarget: 7
    })),
    logs: { "2026-10-19": ["h0"] }
  });
  await element("import-file").handlers.change({
    target: { files: [{ size: 2000, text: async () => JSON.stringify(makeBackup(4)) }], value: "" }
  });
  assert.equal(api.getData().habits.length, 0);
  assert.equal(element("upgrade-dialog").isOpen, true);
  assert.match(element("toast").textContent, /más de 3 hábitos/);
  await element("import-file").handlers.change({
    target: { files: [{ size: 2000, text: async () => JSON.stringify(makeBackup(3)) }], value: "" }
  });
  assert.equal(api.getData().habits.length, 3);
  assert.ok(api.getData().logs["2026-10-19"].includes("h0"));
});

test("the Premium dialog discloses that billing is not enabled", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(root, "index.html"), "utf8");
  assert.match(html, /id="upgrade-dialog"/);
  assert.match(html, /Premium todavía no está disponible/);
  assert.match(html, /No es posible comprar o desbloquear Premium/);
});

test("progress panel and achievements are connected to real habit history", () => {
  const logs = {"2026-10-19": ["a"], "2026-10-20": ["a"]};
  const { element, api } = boot({
    habits: [{id:"a",title:"Caminar",category:"salud",createdAt:"2026-10-01",weeklyTarget:7}],
    logs
  });
  assert.equal(element("journey-level").textContent, "1");
  assert.match(element("journey-total").textContent,/60 XP/);
  assert.match(element("achievement-list").innerHTML,/Mi primer día/);
  assert.match(element("journey-highlight").textContent,/hecho genial/);
  element("hero-scene-next").handlers.click();
  api.toggleHabit("a");
  assert.equal(element("journey-total").textContent,"30 XP");
});

test("top daily progress responds immediately when completing or undoing habits", () => {
  const seed = {
    habits: [
      {id:"a",title:"Caminar",createdAt:"2026-10-01",category:"salud",weeklyTarget:7},
      {id:"b",title:"Leer",createdAt:"2026-10-01",category:"mente",weeklyTarget:7}
    ],
    logs: { "2026-10-20": ["a"] }
  };
  const { element, api } = boot(seed);
  assert.equal(element("quick-progress-count").textContent,"1 de 2 hábitos completados");
  assert.equal(element("quick-progress-percent").textContent,"50 %");
  assert.equal(element("quick-progress-fill").style.width,"50%");
  api.toggleHabit("b");
  assert.equal(element("quick-progress-count").textContent,"2 de 2 hábitos completados");
  assert.equal(element("quick-progress-percent").textContent,"100 %");
  assert.equal(element("quick-progress-fill").style.width,"100%");
  api.toggleHabit("a");
  assert.equal(element("quick-progress-count").textContent,"1 de 2 hábitos completados");
  assert.equal(element("quick-progress-percent").textContent,"50 %");
});

test("new users see a useful zero-state in top progress before adding habits", () => {
  const { element } = boot();
  assert.equal(element("quick-progress-percent").textContent,"0 %");
  assert.equal(element("quick-progress-count").textContent,"0 de 0 hábitos completados");
  assert.equal(element("quick-progress-fill").style.width,"0%");
});

test("Android bottom navigation supports the system back button", () => {
  const location = { hash: "" };
  const pushed = [];
  const history = { pushState(_state,_title,url) {
    pushed.push(url);
    location.hash = url.includes("#") ? "#" + url.split("#")[1] : "";
  } };
  function tab(view) {
    return {
      dataset: {view}, handlers: {}, classList:{toggle(){}},
      addEventListener(type,listener){this.handlers[type]=listener;},
      setAttribute(){}, removeAttribute(){}
    };
  }
  const tabs=["today","stats","calendar"].map(tab);
  const { element,handlers }=boot(undefined,20,{history,location,navButtons:tabs});
  tabs[1].handlers.click();
  assert.equal(pushed.at(-1),"./index.html#stats");
  assert.equal(element("stats-view").hidden,false);
  tabs[2].handlers.click();
  assert.equal(pushed.at(-1),"./index.html#calendar");
  assert.equal(element("calendar-view").hidden,false);
  // Android back restores the prior URL and invokes popstate.
  location.hash="#stats";
  handlers["window:popstate"]();
  assert.equal(element("stats-view").hidden,false);
  location.hash="";
  handlers["window:popstate"]();
  assert.equal(element("today-view").hidden,false);
  const numberBefore=element("quick-progress-percent").textContent;
  handlers["window:pageshow"]();
  assert.equal(element("quick-progress-percent").textContent,numberBefore);
});


test("independent alarms keep their own time and tune without changing the old daily reminder", () => {
  const played=[];
  const seed={
    habits:[
      {id:"a",title:"Leer",category:"mente",createdAt:"2026-10-01",weeklyTarget:7,
        alarmEnabled:true,alarmTime:"19:00",alarmTone:"digital",lastAlarmAt:null},
      {id:"b",title:"Pasear",category:"movimiento",createdAt:"2026-10-01",weeklyTarget:3,
        alarmEnabled:true,alarmTime:"21:30",alarmTone:"energia",lastAlarmAt:null},
      {id:"c",title:"Meditar",category:"bienestar",createdAt:"2026-10-01",weeklyTarget:7,
        alarmEnabled:false,alarmTime:"18:00",alarmTone:"alegre",lastAlarmAt:null}
    ],logs:{},settings:{reminderEnabled:false,alarmVolume:70,alarmEnabled:false}
  };
  const {api,storage}=boot(seed,20,{alarmPlays:played});
  assert.equal(played.length,1,"only the 19:00 alarm should play at 20:00");
  assert.equal(played[0].id,"digital");
  assert.equal(played[0].volume,70);
  assert.equal(api.getData().habits[0].lastAlarmAt,"2026-10-20");
  assert.equal(api.getData().habits[1].lastAlarmAt,null);
  assert.equal(api.getData().habits[2].lastAlarmAt,null);
  assert.equal(api.getData().settings.reminderEnabled,false,"independent schedules do not depend on global reminders");
  api.showHabitReminders();
  assert.equal(played.length,1,"individual alarms fire at most once per day");
  const backup=JSON.parse(storage.get("habitclik:v1"));
  assert.equal(backup.habits[0].alarmTone,"digital");
  assert.equal(backup.habits[1].alarmTime,"21:30");
  const followup=boot(backup,22,{alarmPlays:[]});
  assert.equal(followup.api.getData().habits[1].lastAlarmAt,"2026-10-20");
});

test("editing a habit preserves its logs while giving it an independent sound and time", () => {
  const {api,element,storage}=boot({
    habits:[{id:"a",title:"Leer",category:"mente",createdAt:"2026-10-01",weeklyTarget:5}],
    logs:{"2026-10-19":["a"]}
  });
  api.openDialog("a");
  element("habit-name").value="Leer un ratito";
  element("habit-category").value="mente";
  element("habit-target").value="5";
  element("habit-alarm-enabled").checked=true;
  element("habit-alarm-time").value="08:15";
  element("habit-alarm-tone").value="clasica";
  element("habit-form").handlers.submit({preventDefault(){}});
  assert.equal(api.getData().habits[0].id,"a");
  assert.equal(api.getData().habits[0].alarmEnabled,true);
  assert.equal(api.getData().habits[0].alarmTime,"08:15");
  assert.equal(api.getData().habits[0].alarmTone,"clasica");
  assert.ok(api.getData().logs["2026-10-19"].includes("a"));
  const stored=JSON.parse(storage.get("habitclik:v1"));
  assert.equal(stored.habits[0].alarmTime,"08:15");
});

test("gentle phrase rotation pauses when hidden and never rotates in reduced-motion mode", () => {
  const base={habits:[],logs:{}};
  const phrases={start:["Una cosa cada vez.","Hoy basta con intentarlo.","Si necesitas descansar, hazlo."]};
  const {api,element,handlers}=boot(base,12,{phrases});
  const first=element("motivation-phrase").textContent;
  api.advanceMotivation();
  const second=element("motivation-phrase").textContent;
  assert.notEqual(first,second);
  element("motivation-next").handlers.click();
  assert.notEqual(second,element("motivation-phrase").textContent);
  assert.equal(typeof handlers["visibilitychange"],"function");
  const hidden=boot(base,12,{phrases,hidden:true});
  const hiddenPhrase=hidden.element("motivation-phrase").textContent;
  hidden.api.advanceMotivation();
  assert.equal(hidden.element("motivation-phrase").textContent,hiddenPhrase);
  const reduced=boot(base,12,{phrases,matchMedia:()=>({matches:true})});
  const before=reduced.element("motivation-phrase").textContent;
  reduced.api.advanceMotivation();
  assert.notEqual(reduced.element("motivation-phrase").textContent,before,
    "reduced motion must not freeze the quote text");
});

test("motivational quotes rotate on a 15-second timer and can resume after a pause", () => {
  const pool={start:["Empieza con calma.","Con una cosa basta.","Lo estás haciendo bien."]};
  const {element,intervals,api}=boot({habits:[],logs:{}},20,{phrases:pool,
    matchMedia:()=>({matches:true})});
  const phrase=element("motivation-phrase").textContent;
  assert.equal(intervals.length,3);
  intervals[0]();
  assert.notEqual(element("motivation-phrase").textContent,phrase,
    "automatic interval should change the phrase, also with reduce motion");
  api.advanceMotivation();
  assert.notEqual(element("motivation-phrase").textContent,phrase);
  assert.equal(typeof api.advanceMotivation,"function");
});

test("reference mobile options and inspiration panel open and honor autoplay settings", () => {
  const { element,api }=boot({habits:[],logs:{}},12);
  element("motivation-settings").handlers.click();
  assert.equal(element("motivation-dialog").isOpen,true);
  element("motivation-dialog-close").handlers.click();
  assert.equal(element("motivation-dialog").isOpen,false);
  const first=element("motivation-phrase").textContent;
  element("motivation-auto-toggle").checked=false;
  element("motivation-auto-toggle").handlers.change();
  api.advanceMotivation();
  assert.equal(element("motivation-phrase").textContent,first);
  element("motivation-auto-toggle").checked=true;
  element("motivation-auto-toggle").handlers.change();
  api.advanceMotivation();
  assert.notEqual(element("motivation-phrase").textContent,first);
  element("motivation-short-toggle").checked=true;
  element("motivation-short-toggle").handlers.change();
  element("motivation-prev").handlers.click();
  assert.equal(element("motivation-counter").textContent.includes("/"),true);
  element("options-phrases-btn").handlers.click();
  assert.equal(element("motivation-dialog").isOpen,true);
  element("close-options-btn").handlers.click();
  element("habit-add-inline").handlers.click();
  assert.equal(element("habit-dialog").isOpen,true);
});

test("custom weekday alarm and message persist on habit editor", () => {
  const {element,api,storage}=boot({
    habits:[{id:"a",title:"Leer",category:"mente",createdAt:"2026-10-01",weeklyTarget:7}],
    logs:{}
  });
  api.openDialog("a");
  element("habit-name").value="Leer más";
  element("habit-category").value="mente";
  element("habit-target").value="7";
  element("habit-alarm-enabled").checked=true;
  element("habit-alarm-time").value="08:00";
  element("habit-alarm-tone").value="campanas";
  element("habit-alarm-message").value="¡Un ratito de lectura!";
  element("habit-form").handlers.submit({preventDefault(){}});
  const habit=JSON.parse(storage.get("habitclik:v1")).habits[0];
  assert.equal(habit.alarmMessage,"¡Un ratito de lectura!");
  assert.deepEqual(Array.from(habit.alarmDays),[1,2,3,4,5,6,0]);
});
test("backups live in Options menus, not exposed as primary header buttons", () => {
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  assert.match(html,/<details class="data-menu" id="data-menu">/);
  assert.match(html,/<details class="data-menu data-menu--top" id="top-data-menu">/);
  assert.match(html,/<button[^>]*id="top-export-btn">/);
  assert.match(html,/<button[^>]*id="top-import-btn">/);
  assert.match(html,/<button[^>]*id="export-btn">/);
  assert.match(html,/<button[^>]*id="import-btn">/);
});
