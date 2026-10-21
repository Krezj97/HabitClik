"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "capacitor.config.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const workflow = fs.readFileSync(path.join(root, ".github/workflows/android-preview.yml"), "utf8");

test("Android preview is self-contained and does not impersonate the commercial application", () => {
  assert.equal(config.appId, "dev.habitclik.preview");
  assert.equal(config.webDir, "www");
  assert.equal(config.server.androidScheme, "https");
  assert.ok(!("url" in config.server), "android must NOT pull a mutable remote web app");
  for (const name of ["@capacitor/android", "@capacitor/cli", "@capacitor/core"]) {
    assert.equal(pkg.devDependencies[name], "8.5.3");
  }
  assert.equal(pkg.private, true);
});

test("Android web bundler includes offline sounds, images and the privacy page", () => {
  const result = spawnSync(process.execPath, [path.join(root, "android/prepare-web.cjs")], {
    cwd: root, encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  const bundled = path.join(root, "www");
  for (const name of [
    "index.html", "avisos.html", "privacy.html", "app.js", "avisos.js",
    "alarm-sounds.js", "progress.js", "styles.css", "sw.js",
    "manifest.webmanifest", "SOUND-LICENSES.md", "icons/icon-512.png",
    "art/amanecer.svg", "art/bosque.svg", "sounds/campanas.mp3", "sounds/energia.mp3"
  ]) {
    const source = fs.readFileSync(path.join(root, name));
    const copy = fs.readFileSync(path.join(bundled, name));
    assert.ok(source.equals(copy), "asset not correctly bundled: " + name);
  }
  assert.ok(!fs.existsSync(path.join(bundled, ".git")), "repository metadata must not be bundled");
  assert.ok(!fs.existsSync(path.join(bundled, "package.json")), "node package metadata must not be bundled");
});

test("CI creates a debug APK artifact and never handles release credentials", () => {
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /java-version:\s*'21'/);
  assert.match(workflow, /platforms;android-36/);
  assert.match(workflow, /targetSdkVersion/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /android\/app\/build\/outputs\/apk\/debug\/app-debug\.apk/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.doesNotMatch(workflow, /assembleRelease|signingConfig|RELEASE_KEYSTORE|ANDROID_KEYSTORE_PASSWORD/);
});
