const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/lib/uid.js");
const { uid } = globalThis.SBR;

test("normalize accepts the common spellings", () => {
  for (const s of ["CHE-105.909.036", "CHE105909036", "che 105 909 036", "CHE-105 909 036 MWST", "CHE–105.909.036 TVA"]) {
    assert.equal(uid.normalize(s), "CHE105909036", s);
  }
});

test("normalize rejects a wrong check digit", () => {
  assert.equal(uid.normalize("CHE-105.909.035"), "");
  assert.equal(uid.normalize("Nestlé"), "");
});

test("format and slug", () => {
  assert.equal(uid.format("CHE105909036"), "CHE-105.909.036");
  assert.equal(uid.slugPart("CHE105909036"), "che-105-909-036");
});

test("findAll locates every valid UID in running text", () => {
  const text = "Nestlé S.A. (CHE-105.909.036) and a typo CHE-105.909.035, then CHE101237723 MWST.";
  const hits = uid.findAll(text);
  assert.deepEqual(hits.map((h) => h.uid), ["CHE105909036", "CHE101237723"]);
  assert.equal(text.slice(hits[0].index, hits[0].index + hits[0].length), "CHE-105.909.036");
  assert.equal(text.slice(hits[1].index, hits[1].index + hits[1].length), "CHE101237723");
});

test("findAll ignores longer digit runs", () => {
  assert.deepEqual(uid.findAll("CHE1059090361"), []);
});

test("looksLikeUid", () => {
  assert.equal(uid.looksLikeUid("CHE-105.909.036 MWST"), true);
  assert.equal(uid.looksLikeUid("Nestlé CHE-105.909.036"), false);
});
