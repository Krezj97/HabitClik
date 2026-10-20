"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.join(__dirname, "..");
const files = {
  "campanas.wav": "92097843241dee7fc514fb2ad78669a4a166e35a",
  "digital.wav": "7341e248cd6655b21e61acf80f07d127679fe8f4",
  "clasica.wav": "a0fab32369ced563fcb14c73fbd7bc2099495789",
  "alegre.wav": "5cfa092d1126e14cf4eb5457d2d92bd399809fce",
  "energia.wav": "2355ca6622d984fc63833db18250448556a09d08"
};

test("all five licensed WAV assets are local, valid RIFF files and match upstream blobs", () => {
  for (const [file, expected] of Object.entries(files)) {
    const bytes = fs.readFileSync(path.join(root, "sounds", file));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
    const hash = crypto.createHash("sha1")
      .update(Buffer.from("blob " + bytes.length + "\0"))
      .update(bytes)
      .digest("hex");
    assert.equal(hash, expected, file + " must remain identical to licensed source");
  }
});

test("service worker precaches recorded alarms for offline use", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "alarm-sounds.js"), "utf8");
  const readme = fs.readFileSync(path.join(root, "SOUND-LICENSES.md"), "utf8");
  for (const filename of Object.keys(files)) {
    assert.ok(sw.includes("./sounds/" + filename), filename + " not precached");
    assert.ok(engine.includes("./sounds/" + filename), filename + " not in sound picker");
    assert.ok(readme.includes(filename), filename + " not attributed");
  }
  assert.match(readme, /CC0/);
  assert.match(readme, /akx\/Notifications/);
  assert.match(sw, /habitclik-static-v16/);
});
