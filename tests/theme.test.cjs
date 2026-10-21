"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const reminders = fs.readFileSync(path.join(root, "avisos.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

function brightness(hex) {
  const srgb = hex.match(/[0-9a-f]{2}/gi).map((n) => parseInt(n, 16) / 255);
  const rgb = srgb.map((n) => n <= .04045 ? n / 12.92 : Math.pow((n + .055) / 1.055, 2.4));
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(text, background) {
  const a = brightness(text), b = brightness(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test("the petrol palette is applied to both pages and the installed PWA", () => {
  const theme = css.slice(css.indexOf("/* HabitClik Atmosphere"));
  assert.ok(theme.startsWith("/* HabitClik Atmosphere"), "new theme should exist");
  assert.match(theme, /--hc-bg:\s*#ecf2f2/);
  assert.match(theme, /--hc-panel:\s*#203943/);
  assert.match(theme, /\.sidebar \{/);
  assert.match(theme, /\.settings-card/);
  assert.match(theme, /\.calendar-day/);
  assert.match(theme, /\.upgrade-plan-card/);
  assert.equal(manifest.background_color, "#ecf2f2");
  assert.equal(manifest.theme_color, "#203943");
  assert.match(home, /name="theme-color" content="#203943"/);
  assert.match(reminders, /name="theme-color" content="#203943"/);
  for (const filename of ["styles.css", "app.js", "progress.js", "alarm-sounds.js", "avisos.js", "phrases.js"]) {
    assert.match(sw, new RegExp(filename.replace(".", "\\.") + "\\?v=23"));
  }
  assert.match(sw, /habitclik-static-v23/);
  assert.match(home, /styles\.css\?v=23/);
  assert.match(reminders, /styles\.css\?v=23/);
});

test("key modern text combinations retain readable WCAG AA contrast", () => {
  const combinations = [
    ["sidebar labels", "#e0edec", "#203943"],
    ["active navigation", "#ffffff", "#386c72"],
    ["hero heading", "#ffffff", "#27525e"],
    ["hero body text", "#e3f1ef", "#27525e"],
    ["primary button", "#ffffff", "#176b69"],
    ["body text", "#203237", "#ecf2f2"],
    ["muted card text", "#566f75", "#ffffff"],
  ];
  for (const [label, textColor, backgroundColor] of combinations) {
    assert.ok(contrast(textColor, backgroundColor) >= 4.5, label + " has insufficient contrast");
  }
});

test("four original hero scenes are local, distinct and preloaded offline", () => {
  for (const name of ["amanecer","enfoque","bosque","celebracion"]) {
    const asset = fs.readFileSync(path.join(root, "art", name + ".svg"), "utf8");
    assert.match(asset,/^<svg xmlns=/);
    assert.match(asset,/viewBox="0 0 1600 520"/);
    assert.match(sw,new RegExp('art/' + name + '\\.svg'));
    assert.match(css,new RegExp('hero--' + name));
  }
  assert.match(home,/id="hero-scene-next"/);
  assert.match(home,/id="journey-bar"/);
  assert.match(home,/id="achievement-list"/);
});


test("habits, daily completion and XP are shown before artwork and secondary content", () => {
  const start = home.indexOf('id="today-view"');
  const end = home.indexOf('id="stats-view"', start);
  const section = home.slice(start,end);
  const at = (id) => section.indexOf('id="' + id + '"');
  for(const id of ["quick-progress-percent", "quick-progress-track", "habit-list", "journey-level",
    "journey-bar", "hero-main", "motivation-heading", "weekly-strip"]) {
    assert.ok(at(id) >= 0,id + " is missing from today's screen");
  }
  assert.ok(at("quick-progress-percent") < at("habit-list"),
    "daily summary should precede habit actions");
  assert.ok(at("habit-list") < at("journey-level"),
    "habits should be immediately actionable before the XP panel");
  assert.ok(at("journey-level") < at("hero-main"),
    "experience progression should be above the decorated hero");
  assert.ok(at("hero-main") < at("motivation-heading"),
    "motivation stays secondary to practical actions");
  assert.equal((home.match(/id="habit-list"/g) || []).length,1);
  assert.match(css,/\.today-priority\s*\{/);
  assert.match(css,/@media\s*\(max-width:\s*1230px\)/);
});
