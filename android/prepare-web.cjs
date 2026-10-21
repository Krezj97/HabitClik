#!/usr/bin/env node
"use strict";
// Bundle the exact same offline-capable static UI in the Android WebView.
// This does not change the GitHub Pages release or transfer browser data.
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dest = path.join(root, "www");
const files = Object.freeze([
  "index.html", "avisos.html", "privacy.html", "styles.css",
  "app.js", "avisos.js", "alarm-sounds.js", "progress.js", "phrases.js",
  "sw.js", "manifest.webmanifest", "icon.svg", "SOUND-LICENSES.md"
]);
const directories = Object.freeze(["art", "icons", "sounds"]);
const required = [...files, ...directories];

for (const name of required) {
  if (!fs.existsSync(path.join(root, name))) {
    throw new Error("Android bundle missing required source: " + name);
  }
}
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
for (const name of files) {
  fs.copyFileSync(path.join(root, name), path.join(dest, name));
}
for (const name of directories) {
  fs.cpSync(path.join(root, name), path.join(dest, name), { recursive: true });
}
// Do not point a production app build at the mutable github.io website.
// Bundling preserves full offline use in a development APK.
const manifest = JSON.parse(fs.readFileSync(path.join(dest, "manifest.webmanifest"), "utf8"));
if (manifest.display !== "standalone") throw new Error("Expected standalone HabitClik app");
const expected = fs.readdirSync(path.join(dest, "sounds")).filter(x => x.endsWith(".mp3"));
if (expected.length !== 5) throw new Error("Expected five bundled CC0 alarm recordings");
console.log("HabitClik Android web bundle prepared at www/: " +
  (files.length + directories.length) + " resources/groups (5 MP3 alarms).");
