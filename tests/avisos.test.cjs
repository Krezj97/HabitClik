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
const audioScript = fs.readFileSync(path.join(root, "alarm-sounds.js"), "utf8");

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
  if (options.audio !== false) window.AudioContext = options.AudioContext ?? AudioContext;
  if (options.indexedDB) window.indexedDB = options.indexedDB;
  if (options.Audio) window.Audio = options.Audio;
  window.URL = options.URL ?? { createObjectURL: () => "blob:custom-test", revokeObjectURL() {} };

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
    URL:window.URL,
    Blob,
    clearTimeout(){},setTimeout(){return 1;},setInterval(){},
    console:{warn(){}}
  };
  vm.runInNewContext(audioScript, context, {filename:"alarm-sounds.js"});
  vm.runInNewContext(script + "\nglobalThis.testSettings = () => settings;", context, {filename:"avisos.js"});
  return {nodes:get,saved,notifications,audioNotes,window,listeners,settings:context.testSettings};
}

test("Avisos navigation uses an independent real HTML link", () => {
  assert.match(index, /<a[^>]+href="\.\/avisos\.html"[^>]*>[\s\S]*?Avisos<\/a>/);
  assert.match(html, /<title>Avisos · HabitClik<\/title>/);
  assert.match(html, /<script src="\.\/avisos\.js\?v=26" defer><\/script>/);
  assert.doesNotMatch(html, /src="app\.js"/);
  for (const [,id] of script.matchAll(/\$\("([^"]+)"\)/g)) {
    assert.ok(html.includes('id="' + id + '"'), "missing on Avisos page: " + id);
  }
  assert.match(fs.readFileSync(path.join(root,"sw.js"),"utf8"), /habitclik-static-v26/);
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
  assert.equal(page.audioNotes.length,4);
  assert.match(page.nodes("alarm-status").textContent,/reproducido/i);
  page.nodes("alarm-enabled").checked=true;
  await page.nodes("alarm-enabled").listeners.change();
  assert.equal(page.settings().alarmEnabled,true);
  assert.equal(page.audioNotes.length,8);
  page.nodes("alarm-volume").value="80";
  page.nodes("alarm-volume").listeners.input();
  assert.equal(page.settings().alarmVolume,80);
  assert.equal(page.nodes("alarm-volume-value").textContent,"80 %");
  assert.match(page.nodes("alarm-volume-hint").textContent,/80 %/);
  await page.nodes("alarm-volume").listeners.change();
  assert.match(page.nodes("alarm-status").textContent,/80 %/);
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


test("user can choose and save any of the five alarm tones", async () => {
  const page = openAvisos();
  const expected = [
    ["campanas", 4], ["digital", 6], ["clasica", 6], ["alegre", 6], ["energia", 5]
  ];
  let total = 0;
  for (const [tone, notes] of expected) {
    page.nodes("alarm-tone").value = tone;
    page.nodes("alarm-tone").listeners.change();
    assert.equal(page.settings().alarmTone, tone);
    assert.equal(JSON.parse(page.saved.get("habitclik:settings:v1")).alarmTone, tone);
    await page.nodes("test-alarm-btn").listeners.click();
    total += notes;
    assert.equal(page.audioNotes.length, total);
  }
});

test("existing preferences default to Campanas without losing saved habits", () => {
  const data = {
    habits: [{ id:"a",title:"Caminar",createdAt:"2026-10-01",weeklyTarget:3 }],
    logs: { "2026-10-19": ["a"] },
    settings: { alarmEnabled:true, alarmVolume:70 }
  };
  const page = openAvisos({data});
  assert.equal(page.settings().alarmTone, "campanas");
  page.nodes("alarm-tone").value = "digital";
  page.nodes("alarm-tone").listeners.change();
  const savedData = JSON.parse(page.saved.get("habitclik:v1"));
  assert.equal(savedData.habits[0].title,"Caminar");
  assert.ok(savedData.logs["2026-10-19"].includes("a"));
  assert.equal(savedData.settings.alarmVolume,70);
  assert.equal(savedData.settings.alarmTone,"digital");
});

test("five alarm tones use different pitches and waveforms", async () => {
  const source = fs.readFileSync(path.join(root,"alarm-sounds.js"),"utf8");
  const played = [];
  class AudioContext {
    constructor() { this.currentTime=0; this.state="running"; this.destination={}; }
    createOscillator() {
      const osc = { type:"sine", frequency:{value:0}, connect(){},
        start(){ played.push([this.type,this.frequency.value]); }, stop(){} };
      return osc;
    }
    createGain() { return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; }
  }
  const ctx = {window:{AudioContext}, console:{warn(){}}};
  vm.runInNewContext(source,ctx);
  const patterns = [];
  for (const tone of ctx.window.HABITCLIK_SOUNDS.choices) {
    const before=played.length;
    assert.equal(await ctx.window.HABITCLIK_SOUNDS.play(tone.id,100),true);
    patterns.push(JSON.stringify(played.slice(before)));
  }
  assert.equal(patterns.length,5);
  assert.equal(new Set(patterns).size,5);
});

test("maximum slider setting generates a stronger signal than the old alarm", async () => {
  const source=fs.readFileSync(path.join(root,"alarm-sounds.js"),"utf8");
  const peaks=[];
  class AudioContext {
    constructor(){ this.currentTime=0;this.state="running";this.destination={}; }
    createOscillator(){return{frequency:{value:0},connect(){},start(){},stop(){}};}
    createGain(){return{gain:{
      setValueAtTime(){},
      exponentialRampToValueAtTime(v){if(v>0.001)peaks.push(v);}
    },connect(){}};}
  }
  const ctx={window:{AudioContext},console:{warn(){}}};
  vm.runInNewContext(source,ctx);
  await ctx.window.HABITCLIK_SOUNDS.play("campanas",10);
  const low=Math.max(...peaks);
  peaks.length=0;
  await ctx.window.HABITCLIK_SOUNDS.play("campanas",100);
  const high=Math.max(...peaks);
  assert.ok(high>low);
  assert.ok(high>0.18,"the new 100% output should exceed old maximum gain");
  assert.ok(high<=0.5,"do not exceed the intended per-voice output cap");
});


function fakeAudioStorage() {
  const records = new Map();
  let ready = false;
  return {
    records,
    open() {
      const request = { result: null, error: null };
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: () => ready },
          createObjectStore() { ready = true; },
          close() {},
          transaction() {
            const tx = {
              error: null, oncomplete: null, onerror: null, onabort: null,
              objectStore() {
                return {
                  get(key) { return requestFor(records.get(key)); },
                  put(value, key) { records.set(key, value); return requestFor(key); },
                  delete(key) { records.delete(key); return requestFor(undefined); }
                };
              }
            };
            function requestFor(value) {
              const req = { result: undefined, error: null, onsuccess: null };
              queueMicrotask(() => {
                req.result = value;
                req.onsuccess?.();
                queueMicrotask(() => tx.oncomplete?.());
              });
              return req;
            }
            return tx;
          }
        };
        request.result = db;
        if (!ready) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
}

test("custom alarm file uploads, persists locally, previews and can be removed", async () => {
  const indexedDB = fakeAudioStorage();
  const played = [];
  class Audio {
    constructor(url) { this.url = url; this.volume = 0; this.listeners = {}; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    async play() { played.push({ url: this.url, volume: this.volume }); }
    pause() {}
  }
  const page = openAvisos({ indexedDB, Audio });
  const file = new Blob(["local audio data"], { type: "audio/mpeg" });
  file.name = "mi-cancion.mp3";
  await page.nodes("alarm-custom-file").listeners.change({ target: { files: [file] } });
  assert.equal(page.settings().alarmTone, "personalizada");
  assert.ok(indexedDB.records.has("selected"));
  assert.match(page.nodes("alarm-custom-status").textContent, /mi-cancion\.mp3/);
  assert.equal(page.nodes("alarm-custom-choice").disabled, false);
  assert.equal(page.nodes("alarm-custom-remove").hidden, false);
  await page.nodes("test-alarm-btn").listeners.click();
  assert.equal(played.length, 1);
  assert.equal(played[0].volume, 0.5);
  page.nodes("alarm-volume").value = "90";
  page.nodes("alarm-volume").listeners.input();
  await page.nodes("alarm-volume").listeners.change();
  await page.nodes("test-alarm-btn").listeners.click();
  assert.equal(played[1].volume, 0.9);
  await page.nodes("alarm-custom-remove").listeners.click();
  assert.equal(page.settings().alarmTone, "campanas");
  assert.equal(indexedDB.records.has("selected"), false);
  assert.equal(page.nodes("alarm-custom-choice").disabled, true);
  assert.equal(page.nodes("alarm-custom-remove").hidden, true);
});

test("oversized or unsupported files cannot replace the saved alarm", async () => {
  const indexedDB = fakeAudioStorage();
  const page = openAvisos({ indexedDB });
  const invalid = new Blob(["not audio"], { type: "text/plain" });
  invalid.name = "a.txt";
  await page.nodes("alarm-custom-file").listeners.change({ target: { files: [invalid] } });
  assert.equal(page.settings().alarmTone, "campanas");
  assert.match(page.nodes("alarm-custom-status").textContent, /MP3|audio/i);
  assert.equal(indexedDB.records.has("selected"), false);
  const tooLarge = { name: "long.wav", type: "audio/wav", size: 9 * 1024 * 1024 };
  await page.nodes("alarm-custom-file").listeners.change({ target: { files: [tooLarge] } });
  assert.match(page.nodes("alarm-custom-status").textContent, /8 MB/);
  assert.equal(indexedDB.records.has("selected"), false);
});


test("the volume slider audibly changes the live gain of an integrated alarm", async () => {
  const gains=[];
  class AudioContext {
    constructor() { this.currentTime=0; this.state="running"; this.destination={}; }
    createOscillator(){return{frequency:{value:0},connect(){},start(){},stop(){}};}
    createGain(){
      const node={gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};
      gains.push(node);
      return node;
    }
  }
  const page=openAvisos({ AudioContext });
  await page.nodes("test-alarm-btn").listeners.click();
  const master=gains[0];
  assert.equal(master.gain.value, 1);
  page.nodes("alarm-volume").value="10";
  page.nodes("alarm-volume").listeners.input();
  const quiet=master.gain.value;
  page.nodes("alarm-volume").value="100";
  page.nodes("alarm-volume").listeners.input();
  const loud=master.gain.value;
  assert.ok(loud > quiet * 10, "100% must be dramatically louder than 10%");
  assert.equal(page.settings().alarmVolume,100);
  await page.nodes("alarm-volume").listeners.change();
  assert.match(page.nodes("alarm-status").textContent,/100 %/);
  assert.equal(JSON.parse(page.saved.get("habitclik:settings:v1")).alarmVolume,100);
});

test("custom audio uses a gain node when mobile media volume cannot be changed", async () => {
  const indexedDB = fakeAudioStorage();
  const sources=[], gains=[], players=[];
  class Audio {
    constructor(){this.listeners={};this.currentTime=0;this.volume=0;players.push(this);}
    addEventListener(name,handler){this.listeners[name]=handler;}
    async play(){}
    pause(){}
  }
  class AudioContext {
    constructor(){this.state="running";this.currentTime=0;this.destination={};}
    createMediaElementSource(player){
      const source={player,connect(){}};sources.push(source);return source;
    }
    createGain(){const node={gain:{value:1},connect(){}};gains.push(node);return node;}
    createOscillator(){return{frequency:{value:0},connect(){},start(){},stop(){}};}
  }
  const page=openAvisos({indexedDB,Audio,AudioContext});
  const file=new Blob(["audio"],{type:"audio/mpeg"});
  file.name="alarma.mp3";
  await page.nodes("alarm-custom-file").listeners.change({target:{files:[file]}});
  await page.nodes("test-alarm-btn").listeners.click();
  assert.equal(sources.length,1);
  assert.equal(players[0].volume,1);
  const quiet=gains[0].gain.value;
  page.nodes("alarm-volume").value="100";
  page.nodes("alarm-volume").listeners.input();
  const loud=gains[0].gain.value;
  assert.ok(loud>quiet*2,"custom sound gain changes in Web Audio even if media volume is fixed");
  assert.equal(players[0].volume,1,"the web audio graph controls playback level");
  await page.nodes("alarm-volume").listeners.change();
  assert.equal(page.settings().alarmVolume,100);
});


test("licensed WAV recordings play as real audio while retaining the volume control", async () => {
  const heard = [];
  class FakeAudio {
    constructor(path) {
      this.path = path;
      this.volume = -1;
      this.listeners = {};
    }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    async play() { heard.push({ path: this.path, volume: this.volume }); }
    pause() {}
  }
  const page = openAvisos({ Audio: FakeAudio, audio: false });
  const expected = ["campanas", "digital", "clasica", "alegre", "energia"];
  for (const name of expected) {
    page.nodes("alarm-tone").value = name;
    page.nodes("alarm-tone").listeners.change();
    await page.nodes("test-alarm-btn").listeners.click();
    const last = heard.at(-1);
    assert.equal(last.path, "./sounds/" + name + ".mp3");
    assert.equal(last.volume, 0.5);
  }
  assert.equal(heard.length, 5);
  page.nodes("alarm-volume").value = "90";
  page.nodes("alarm-volume").listeners.input();
  await page.nodes("alarm-volume").listeners.change();
  assert.equal(heard.at(-1).volume, 0.9);
});

test("real WAV alarms feed a Web Audio gain node on mobile browsers", async () => {
  const gainValues = [], played = [];
  class Audio {
    constructor(path) { this.path = path; this.listeners={}; this.volume=0; }
    addEventListener(name,callback){this.listeners[name]=callback;}
    async play(){played.push(this.path);}
    pause(){}
  }
  class AudioContext {
    constructor() {this.state="running"; this.currentTime=0; this.destination={};}
    createMediaElementSource() {return {connect(){}};}
    createGain() {
      const node = {gain:{value:1},connect(){}};
      gainValues.push(node);
      return node;
    }
  }
  const page = openAvisos({Audio, AudioContext});
  await page.nodes("test-alarm-btn").listeners.click();
  assert.equal(played.length,1);
  assert.equal(gainValues.length,1);
  const quiet = gainValues[0].gain.value;
  page.nodes("alarm-volume").value="100";
  page.nodes("alarm-volume").listeners.input();
  const loud = gainValues[0].gain.value;
  assert.ok(loud > quiet, "gain must change while playing a licensed WAV");
});


test("Avisos shows one independent alarm card per habit and changes only the chosen habit", () => {
  const habits=[
    {id:"a",title:"Leer",category:"mente",createdAt:"2026-10-01",weeklyTarget:7},
    {id:"b",title:"Caminar",category:"movimiento",createdAt:"2026-10-01",weeklyTarget:3}
  ];
  const page=openAvisos({data:{habits,logs:{"2026-10-19":["a"]}}});
  assert.match(page.nodes("per-habit-alarm-list").innerHTML,/Leer/);
  assert.match(page.nodes("per-habit-alarm-list").innerHTML,/Caminar/);
  page.nodes("per-habit-alarm-list").listeners.change({
    target:{dataset:{id:"b",habitAlarm:"enabled"},checked:true}
  });
  page.nodes("per-habit-alarm-list").listeners.change({
    target:{dataset:{id:"b",habitAlarm:"time"},value:"07:45"}
  });
  page.nodes("per-habit-alarm-list").listeners.change({
    target:{dataset:{id:"b",habitAlarm:"tone"},value:"energia"}
  });
  const saved=JSON.parse(page.saved.get("habitclik:v1"));
  assert.equal(saved.habits[1].alarmEnabled,true);
  assert.equal(saved.habits[1].alarmTime,"07:45");
  assert.equal(saved.habits[1].alarmTone,"energia");
  assert.equal(saved.habits[0].alarmEnabled,undefined);
  assert.equal(saved.logs["2026-10-19"][0],"a");
  assert.equal(saved.settings?.reminderEnabled??false,false);
});

test("independent Avisos alarm respects each habit's time and does not repeat", () => {
  const data={habits:[
    {id:"a",title:"Leer",category:"mente",createdAt:"2026-10-01",weeklyTarget:7,
      alarmEnabled:true,alarmTime:"19:00",alarmTone:"campanas"},
    {id:"b",title:"Caminar",category:"movimiento",createdAt:"2026-10-01",weeklyTarget:7,
      alarmEnabled:true,alarmTime:"22:00",alarmTone:"digital"}
  ],logs:{}};
  const page=openAvisos({data});
  const saved=JSON.parse(page.saved.get("habitclik:v1"));
  assert.equal(saved.habits[0].lastAlarmAt,"2026-10-20");
  assert.equal(saved.habits[1].lastAlarmAt,undefined);
  assert.match(page.nodes("per-habit-alarm-list").innerHTML,/19:00/);
  assert.equal(page.settings().reminderEnabled,false);
  page.listeners["focus"]();
  const latest=JSON.parse(page.saved.get("habitclik:v1"));
  assert.equal(latest.habits[0].lastAlarmAt,"2026-10-20");
  assert.equal(latest.habits[1].lastAlarmAt,undefined);
});
