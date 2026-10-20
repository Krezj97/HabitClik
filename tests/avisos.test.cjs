"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "avisos.html"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "avisos.js"), "utf8");

function openAvisos(options = {}) {
  const saved = new Map();
  if (options.data) saved.set("habitclik:v1", JSON.stringify(options.data));
  const nodes = new Map(), listeners = {}, notifications = [], audioNotes = [];
  const get = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      value: id === "alarm-volume" ? "50" : "19:00", checked: false,
      textContent: "", hidden: false, disabled: false, style: {},
      listeners: {},
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(name, handler) { this.listeners[name] = handler; },
      click() { this.wasClicked = true; },
      remove() {}
    });
    return nodes.get(id);
  };
  const document = {
    hidden: false,
    getElementById: get,
    createElement() { return get("download"); },
    body: { append() {} },
    addEventListener(name, cb) { listeners["document:"+name] = cb; }
  };
  const window = {
    isSecureContext: options.secure ?? true,
    addEventListener(name, cb) { listeners[name] = cb; }
  };
  function Notification(title, notificationOptions) {
    notifications.push({ title, notificationOptions });
  }
  Notification.permission = options.permission ?? "default";
  Notification.requestPermission = async () => {
    Notification.permission = "granted";
    return "granted";
  };
  if (options.Notification !== false) window.Notification = Notification;

  class AudioContext {
    constructor() { this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createOscillator() { return {type:"sine", frequency:{value:0},connect(){},
      start() {audioNotes.push("start");},stop(){}}; }
    createGain() {return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
  }
  if (options.audio !== false) window.AudioContext = AudioContext;

  const localStorage = {
    getItem(k) {return saved.get(k) ?? null;},
    setItem(k,v){saved.set(k,v);}
  };
  const FixedDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : [2026,9,20,20,0,0])); }
    static now() { return new Date(2026,9,20,20,0,0).getTime(); }
  };
  const context = {
    window,document,localStorage,Date:FixedDate,
    navigator:options.navigator ?? {},
    URL:{ createObjectURL:()=>"blob:test", revokeObjectURL(){} },
    Blob,
    clearTimeout(){},setTimeout(){return 1;},setInterval(){},
    console:{warn(){}}
  };
  vm.runInNewContext(script + "\nglobalThis.testSettings = () => settings;", context, {filename:"avisos.js"});
  return {nodes:get,saved,notifications,audioNotes,window,listeners,settings:context.testSettings};
}

test("Avisos navigation uses an independent real HTML link", () => {
  assert.match(index, /<a[^>]+href="\.\/avisos\.html"[^>]*>[\s\S]*?Avisos<\/a>/);
  assert.match(html, /<title>Avisos · HabitClik<\/title>/);
  assert.match(html, /<script src="\.\/avisos\.js\?v=9" defer><\/script>/);
  assert.doesNotMatch(html, /src="app\.js"/);
  for (const [,id] of script.matchAll(/\$\("([^"]+)"\)/g)) {
    assert.ok(html.includes('id="' + id + '"'), "missing on Avisos page: " + id);
  }
  assert.match(fs.readFileSync(path.join(root,"sw.js"),"utf8"), /habitclik-static-v9/);
  assert.match(fs.readFileSync(path.join(root,"sw.js"),"utf8"), /"\.\/avisos\.html"/);
});

test("Avisos opens, enables reminder and saves the same original habit data", () => {
  const data = { habits: [{id:"a",title:"Leer",category:"mente",createdAt:"2026-10-01",weeklyTarget:3}],
    logs:{"2026-10-19":["a"]} };
  const page = openAvisos({data});
  assert.equal(page.nodes("reminder-overview").textContent,"Avisos diarios desactivados");
  page.nodes("reminder-enabled").checked = true;
  page.nodes("reminder-enabled").listeners.change();
  const stored = JSON.parse(page.saved.get("habitclik:v1"));
  assert.equal(stored.habits.length,1);
  assert.deepEqual(stored.logs,{"2026-10-19":["a"]});
  assert.equal(stored.settings.reminderEnabled,true);
  assert.equal(page.nodes("reminder-overview").textContent,"Aviso diario activo · 19:00");
  page.nodes("reminder-time").value="21:30";
  page.nodes("reminder-time").listeners.change();
  assert.equal(JSON.parse(page.saved.get("habitclik:v1")).settings.reminderTime,"21:30");
});

test("Avisos can be configured before first use without deleting demo habits", () => {
  const page = openAvisos();
  page.nodes("reminder-time").value="16:00";
  page.nodes("reminder-time").listeners.change();
  assert.equal(page.saved.get("habitclik:v1"),undefined);
  assert.equal(JSON.parse(page.saved.get("habitclik:settings:v1")).reminderTime,"16:00");
});

test("Alarm test and switch respond, volume persists", async () => {
  const page = openAvisos();
  await page.nodes("test-alarm-btn").listeners.click();
  assert.equal(page.audioNotes.length,3);
  assert.match(page.nodes("alarm-status").textContent,/Prueba reproducida/);
  page.nodes("alarm-enabled").checked=true;
  await page.nodes("alarm-enabled").listeners.change();
  assert.equal(page.settings().alarmEnabled,true);
  assert.equal(page.audioNotes.length,6);
  page.nodes("alarm-volume").value="80";
  page.nodes("alarm-volume").listeners.change();
  assert.equal(page.settings().alarmVolume,80);
  assert.equal(page.nodes("alarm-volume-value").textContent,"80 %");
});

test("Notifications request permission after direct click and send a test", async () => {
  const page = openAvisos();
  await page.nodes("notification-permission-btn").listeners.click();
  assert.equal(page.settings().notificationEnabled,true);
  assert.equal(page.settings().reminderEnabled,true);
  await page.nodes("test-notification-btn").listeners.click();
  assert.equal(page.notifications.length,1);
  assert.match(page.notifications[0].title,/HabitClik/);
  assert.match(page.nodes("notification-help").textContent,/Prueba enviada/);
  await page.nodes("notification-permission-btn").listeners.click();
  assert.equal(page.settings().notificationEnabled,false);
});

test("Unsupported browsers show actionable feedback, not inert buttons", async () => {
  const page = openAvisos({secure:false,audio:false,Notification:false});
  assert.equal(page.nodes("notification-status").textContent,"No disponibles");
  await page.nodes("notification-permission-btn").listeners.click();
  assert.match(page.nodes("toast").textContent,/no admite/i);
  await page.nodes("test-alarm-btn").listeners.click();
  assert.match(page.nodes("alarm-status").textContent,/no permitió/i);
});
