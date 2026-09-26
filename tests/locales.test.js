const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const load = (lang) => JSON.parse(fs.readFileSync(path.join(root, "_locales", lang, "messages.json"), "utf8"));

test("every locale has the same keys as en", () => {
  const en = Object.keys(load("en")).sort();
  for (const lang of ["de", "fr", "it"]) assert.deepEqual(Object.keys(load(lang)).sort(), en, lang);
});

test("store limits: name <= 75, description <= 132", () => {
  for (const lang of ["en", "de", "fr", "it"]) {
    const m = load(lang);
    assert.ok(m.appName.message.length <= 75, lang);
    assert.ok(m.appDescription.message.length <= 132, lang);
  }
});

test("every message the code asks for exists", () => {
  const en = load("en");
  const src = ["src/lib/card.js", "src/popup/popup.js", "src/popup/popup.html", "src/background.js", "manifest.json"]
    .map((f) => fs.readFileSync(path.join(root, f), "utf8"))
    .join("\n");
  const used = new Set();
  for (const m of src.matchAll(/\bt\("([A-Za-z_]+)"\)|data-i18n(?:-placeholder)?="([A-Za-z_]+)"|__MSG_([A-Za-z_]+)__|getMessage\("([A-Za-z_]+)"\)/g)) {
    used.add(m[1] || m[2] || m[3] || m[4]);
  }
  for (const k of ["statusActive", "statusLiquidation", "statusDeleted"]) used.add(k);
  for (const k of used) assert.ok(en[k], `missing message ${k}`);
});
