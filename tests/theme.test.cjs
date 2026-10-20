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

test("the olive palette is applied to both pages and the installed PWA", () => {
  const theme = css.slice(css.indexOf("/* HabitClik olive edition"));
  assert.ok(theme.startsWith("/* HabitClik olive edition"), "new theme should exist");
  assert.match(theme, /--hc-bg:\s*#e9ece4/);
  assert.match(theme, /--hc-olive-dark:\s*#404d38/);
  assert.match(theme, /\.sidebar \{/);
  assert.match(theme, /\.settings-card/);
  assert.match(theme, /\.calendar-day/);
  assert.match(theme, /\.upgrade-plan-card/);
  assert.equal(manifest.background_color, "#e9ece4");
  assert.equal(manifest.theme_color, "#404d38");
  assert.match(home, /name="theme-color" content="#404d38"/);
  assert.match(reminders, /name="theme-color" content="#404d38"/);
  for (const filename of ["styles.css", "app.js", "alarm-sounds.js", "avisos.js", "phrases.js"]) {
    assert.match(sw, new RegExp(filename.replace(".", "\\.") + "\\?v=15"));
  }
  assert.match(sw, /habitclik-static-v15/);
  assert.match(home, /styles\.css\?v=15/);
  assert.match(reminders, /styles\.css\?v=15/);
});

test("key olive text combinations retain readable WCAG AA contrast", () => {
  const combinations = [
    ["sidebar labels", "#e1e8d9", "#404d38"],
    ["active navigation", "#ffffff", "#667955"],
    ["hero heading", "#ffffff", "#596b4e"],
    ["hero body text", "#e7eddf", "#596b4e"],
    ["primary button", "#ffffff", "#526b40"],
    ["body text", "#293528", "#e9ece4"],
    ["muted card text", "#63715f", "#f9faf6"],
  ];
  for (const [label, textColor, backgroundColor] of combinations) {
    assert.ok(contrast(textColor, backgroundColor) >= 4.5, label + " has insufficient contrast");
  }
});
