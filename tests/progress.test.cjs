"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "progress.js"), "utf8");
function engine() {
  const context = {window:{},Date,console};
  vm.runInNewContext(source,context);
  return context.window.HABITCLIK_PROGRESS;
}
function habit(id, goal=7, date="2026-10-01") {
  return {id,title:"Hábito "+id,createdAt:date,weeklyTarget:goal,category:"salud"};
}
const DATE = "2026-10-20";

test("initial level needs real completions and starts without a fake reward", () => {
  const e=engine(), p=e.calculate({habits:[],logs:{}},DATE);
  assert.equal(p.xp,0);assert.equal(p.level,1);assert.equal(p.unlocked.length,0);
  assert.equal(p.scene,"amanecer");assert.equal(p.remaining,100);
  assert.equal(p.percentage,0);
});

test("rewards grant 10 XP per completion and 20 for each fully completed day", () => {
  const e=engine(),data={habits:[habit("a"),habit("b")],logs:{
    "2026-10-19":["a"],
    "2026-10-20":["a","b"]
  }};
  const p=e.calculate(data,DATE);
  assert.equal(p.metrics.completions,3);
  assert.equal(p.metrics.perfectDays,1);
  assert.equal(p.xp,50);
  assert.equal(p.todayDone,2);
  assert.equal(p.scene,"celebracion");
  assert.ok(p.badges.find(x=>x.id==="primera").unlocked);
  assert.ok(p.badges.find(x=>x.id==="dia").unlocked);
});

test("reversing and backdating a log updates XP deterministically", () => {
  const e=engine(),data={habits:[habit("a")],logs:{"2026-10-20":["a"]}};
  assert.equal(e.calculate(data,DATE).xp,30);
  delete data.logs["2026-10-20"];
  assert.equal(e.calculate(data,DATE).xp,0);
  data.logs["2026-10-12"]=["a"];
  assert.equal(e.calculate(data,DATE).xp,30);
  data.logs["2026-10-22"]=["a"];
  assert.equal(e.calculate(data,DATE).xp,30, "future marks must not count");
  data.logs["2026-09-30"]=["a"];
  assert.equal(e.calculate(data,DATE).xp,30, "marks before habit creation must not count");
});

test("weekly rewards apply once per reached target, not every time the page loads", () => {
  const e=engine(),data={
    habits:[habit("a",2)],logs:{"2026-10-19":["a"],"2026-10-20":["a"]}
  };
  const first=e.calculate(data,DATE),second=e.calculate(data,DATE);
  assert.equal(first.metrics.weeklyGoals,1);
  assert.equal(first.xp,95); // 20 completion + 40 full day + 35 weekly
  assert.equal(second.xp,first.xp);
  assert.equal(first.badges.find(x=>x.id==="meta").unlocked,true);
});

test("levels are monotonic and badges arise from historical milestones", () => {
  const e=engine();
  assert.equal(e.requiredXp(1),0);
  assert.equal(e.requiredXp(2),100);
  assert.equal(e.requiredXp(3),250);
  assert.equal(e.levelFromXp(99),1);
  assert.equal(e.levelFromXp(100),2);
  assert.equal(e.levelFromXp(250),3);
  const logs={};
  for(let d=1;d<=20;d++){
    const date = "2026-10-"+String(d).padStart(2,"0");
    logs[date]=["a"];
  }
  const p=e.calculate({habits:[habit("a")],logs},DATE);
  assert.equal(p.xp,670); // 20*10 + 20*20 + two full 7-day weekly goals
  assert.ok(p.level>=3);
  assert.equal(p.metrics.bestStreak,20);
  assert.ok(p.badges.find(x=>x.id==="siete-rachas").unlocked);
  assert.ok(p.unlocked.length>=5);
});

test("invalid IDs, duplicated logs and unknown habits do not farm experience", () => {
  const e=engine();
  const p=e.calculate({habits:[habit("a"),habit("b")],
    logs:{"2026-10-20":["a","a","missing","missing"]}}, DATE);
  assert.equal(p.metrics.completions,1);
  assert.equal(p.xp,10);
});


test("all eleven milestones remain achievable with just one free habit", () => {
  const e=engine(),logs={};
  const start=new Date("2026-07-01T12:00:00Z");
  for(let i=0;i<45;i++) {
    const d=new Date(start);
    d.setUTCDate(start.getUTCDate()+i);
    logs[d.toISOString().slice(0,10)]=["a"];
  }
  const p=e.calculate({
    habits:[habit("a",3,"2026-07-01")],logs
  },"2026-09-20");
  assert.equal(p.badges.length,11);
  assert.equal(p.badges.filter(x=>x.unlocked).length,11);
  assert.equal(p.metrics.activeDays,45);
  assert.ok(p.badges.every(x=>!/100 hábit|100 hábitos/i.test(x.description)));
});
