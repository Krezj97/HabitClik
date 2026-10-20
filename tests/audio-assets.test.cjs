"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.join(__dirname, "..");
const ids = ["campanas","digital","clasica","alegre","energia"];

test("five distinct, locally hosted MP3 alarms have recognizable MPEG headers", () => {
  const hashes = new Set();
  for (const id of ids) {
    const bytes = fs.readFileSync(path.join(root,"sounds",id+".mp3"));
    assert.ok(bytes.length > 15000 && bytes.length < 600000,id+" has unexpected audio size");
    assert.ok(bytes.toString("ascii",0,3)==="ID3" ||
      (bytes[0]===0xff && (bytes[1]&0xe0)===0xe0),id+" is not recognizable MP3 audio");
    hashes.add(crypto.createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size,5,"each preset should contain a different recording");
});

test("service worker caches new audio and illustrates provenance and licensing", () => {
  const sw=fs.readFileSync(path.join(root,"sw.js"),"utf8");
  const engine=fs.readFileSync(path.join(root,"alarm-sounds.js"),"utf8");
  const license=fs.readFileSync(path.join(root,"SOUND-LICENSES.md"),"utf8");
  for (const id of ids) {
    assert.ok(sw.includes("./sounds/"+id+".mp3"),id+" not cached offline");
    assert.ok(engine.includes("./sounds/"+id+".mp3"),id+" not playable");
    assert.ok(license.includes("sounds/"+id+".mp3"),id+" missing license ledger");
  }
  assert.match(license,/CC0/);
  assert.match(license,/gretzke\/open-alarm/);
  assert.match(sw,/habitclik-static-v17/);
});
