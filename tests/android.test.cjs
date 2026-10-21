"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const css = read("styles.css");
const home = read("index.html");
const reminders = read("avisos.html");
const privacy = read("privacy.html");
const sw = read("sw.js");
const manifest = JSON.parse(read("manifest.webmanifest"));

test("Android viewport and gesture areas are configured on both app screens", () => {
  for (const [page, html] of [["dashboard",home],["reminders",reminders],["privacy",privacy]]) {
    assert.match(html,/viewport-fit=cover/,page+" needs safe-area support");
    assert.match(html,/name="theme-color" content="#203943"/,page+" needs matching Android status bar");
  }
  assert.match(css,/env\(safe-area-inset-bottom/);
  assert.match(css,/env\(safe-area-inset-top/);
  assert.match(css,/\.sidebar \.main-nav \{/);
  assert.match(css,/position: fixed; z-index: 50/);
  assert.match(css,/grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css,/min-height: 44px/);
  assert.match(css,/font-size: 16px/);
  assert.match(css,/overscroll-behavior/);
  assert.match(css,/\.today-priority \.habit-card/);
  assert.match(css,/@media \(max-width: 360px\)/);
  assert.match(css,/\.habit-dialog\[open\]/);
});

test("Android launcher shortcuts preserve the proper origin and four useful destinations", () => {
  assert.equal(manifest.id,"./");
  assert.equal(manifest.start_url,"./");
  assert.equal(manifest.scope,"./");
  assert.equal(manifest.display,"standalone");
  assert.deepEqual(manifest.categories,["lifestyle","productivity"]);
  assert.deepEqual(manifest.shortcuts.map(x=>x.url),
    ["./index.html","./index.html#stats","./index.html#calendar","./avisos.html"]);
  assert.ok(manifest.icons.some(x=>x.sizes==="512x512"));
});

test("public privacy document and offline navigation fallback are present", () => {
  for(const html of [home,reminders])assert.match(html,/href="\.\/privacy\.html"/);
  assert.match(privacy,/<h1 id="privacy-title">Política de privacidad<\/h1>/);
  assert.match(privacy,/localStorage/);
  assert.match(privacy,/IndexedDB/);
  assert.match(privacy,/Exportar datos/);
  assert.match(sw,/"\.\/privacy\.html"/);
  assert.match(sw,/path\.endsWith\("\/privacy\.html"\)/);
  assert.match(sw,/habitclik-static-v23/);
  assert.match(read("avisos.js"),/navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);
});

test("Android back/forward navigation and resume refresh are handled in dashboard", () => {
  const source = read("app.js");
  assert.match(source,/history\.pushState/);
  assert.match(source,/window\.addEventListener\("popstate", restoreViewFromAddress\)/);
  assert.match(source,/window\.addEventListener\("pageshow",/);
  assert.match(source,/display-mode: standalone/);
});

test("assetlinks generator validates package, certificate fingerprint and custom HTTPS origin", () => {
  const script=path.join(root,"android","generate-assetlinks.cjs");
  const fingerprint=Array(32).fill("ab").join(":");
  const run=(args)=>spawnSync(process.execPath,[script,...args],{encoding:"utf8"});
  const good=run(["com.acme.habitclik",fingerprint,"https://habitclik.example/"]);
  assert.equal(good.status,0,good.stderr);
  const entry=JSON.parse(good.stdout)[0];
  assert.equal(entry.target.package_name,"com.acme.habitclik");
  assert.equal(entry.target.sha256_cert_fingerprints[0],fingerprint.toUpperCase());
  assert.equal(entry.target.namespace,"android_app");
  assert.deepEqual(entry.relation,["delegate_permission/common.handle_all_urls"]);
  for (const args of [
    ["wrong",fingerprint,"https://habitclik.example/"],
    ["com.acme.habitclik","AA:BB","https://habitclik.example/"],
    ["com.acme.habitclik",fingerprint,"http://habitclik.example/"],
    ["com.acme.habitclik",fingerprint,"https://krezj97.github.io/HabitClik/"],
    ["com.acme.habitclik",fingerprint,"https://krezj97.github.io/"],
  ]) {
    const bad=run(args);
    assert.notEqual(bad.status,0,"must reject "+args.join(" "));
    assert.match(bad.stderr,/Error:/);
  }
});

test("Play Store checklist clearly marks blockers and does not expose signing secrets", () => {
  const plan=read("android/PLAYSTORE.md");
  assert.match(plan,/NO hay un (?:archivo )?Android App Bundle/);
  assert.match(plan,/targetSdkVersion/);
  assert.match(plan,/36/);
  assert.match(plan,/\.well-known\/assetlinks\.json/);
  assert.match(plan,/Google Play App Signing/);
  assert.match(plan,/Premium/);
  assert.match(plan,/Cambi(ar|ar) el origen|cambiar el origen/i);
});
