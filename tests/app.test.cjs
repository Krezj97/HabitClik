"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

function boot(seed, hour = 20) {
  const elements = new Map();
  const storage = new Map(seed ? [["habitclik:v1", JSON.stringify(seed)]] : []);
  const intervals = [];
  const handlers = {};

  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: id === "habit-target" ? "7" : id === "reminder-time" ? "19:00" : "",
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
    isSecureContext: false,
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
    navigator: {},
    localStorage,
    Date: FixedDate,
    confirm: () => true,
    setTimeout: () => 1,
    clearTimeout() {},
    setInterval(fn) { intervals.push(fn); return 2; },
    console: { warn() {} }
  };
  vm.runInNewContext(source + "\nglobalThis.testApi = {" +
    "getData: () => data, normalizeData, completionsThisWeek, weeklyStreak, " +
    "toggleHabit, showPendingReminder };", context, { filename: "app.js" });

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
  assert.match(sw, /habitclik-static-v5/);
  assert.equal((css.match(/{/g) ?? []).length, (css.match(/}/g) ?? []).length);
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), "missing icon " + icon.src);
  }
});
