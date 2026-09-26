const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/lib/uid.js");
require("../src/data/legal-forms.js");
require("../src/lib/zefix.js");
const { zefix } = globalThis.SBR;

const FIRM = {
  name: "Nestlé AG",
  ehraid: 126286,
  uid: "CHE105909036",
  uidFormatted: "CHE-105.909.036",
  legalSeat: "Cham",
  registerOfficeId: 170,
  legalFormId: 3,
  status: "EXISTIEREND",
  shabDate: "2026-07-01",
  cantonalExcerptWeb: "https://zg.chregister.ch/cr-portal/auszug/auszug.xhtml?uid=CHE-105.909.036",
  shabPub: [
    { shabDate: "2026-05-04", mutationTypes: [{ id: 17, key: "aenderungorgane" }], message: "older" },
    {
      shabDate: "2026-07-01",
      shabId: 1006693778,
      mutationTypes: [{ id: 17, key: "aenderungorgane" }],
      message:
        '<FT TYPE="F">NestlÃ© AG</FT>, in <FT TYPE="S">Cham</FT>, <FT TYPE="A">CHE-105.909.036</FT>, Aktiengesellschaft (SHAB Nr. 84 vom 04.05.2026, Publ. 1006641714). Ausgeschiedene Personen: Mohl, Anna, amerikanische StaatsangehÃ¶rige &amp; Co.',
    },
  ],
};

test("toCompany normalizes a firm detail", () => {
  const c = zefix.toCompany(FIRM);
  assert.equal(c.name, "Nestlé AG");
  assert.equal(c.canton, "ZG");
  assert.equal(c.status, "active");
  assert.equal(c.latest.date, "2026-07-01");
  assert.deepEqual(c.latest.types, ["aenderungorgane"]);
  assert.equal(c.latest.text, "Ausgeschiedene Personen: Mohl, Anna, amerikanische Staatsangehörige & Co.");
});

test("status mapping", () => {
  assert.equal(zefix.toCompany({ ...FIRM, status: "GELOESCHT" }).status, "deleted");
  assert.equal(zefix.toCompany({ ...FIRM, status: "IN_AUFLOESUNG" }).status, "liquidation");
});

test("fixEncoding leaves clean text alone", () => {
  assert.equal(zefix.fixEncoding("Zürich Société"), "Zürich Société");
  assert.equal(zefix.fixEncoding("ZÃ¼rich"), "Zürich");
});

test("byUid prefers the active registration and loads its detail", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([url, init?.body]);
    const json = url.endsWith("search.json")
      ? { list: [{ ...FIRM, ehraid: 1, status: "GELOESCHT", shabDate: "2026-08-01" }, { ...FIRM, ehraid: 126286 }, { ...FIRM, ehraid: 9, uid: "CHE101237723" }] }
      : FIRM;
    return { ok: true, status: 200, text: async () => JSON.stringify(json) };
  };
  const client = zefix.createClient({ fetchImpl, language: "de" });
  const c = await client.byUid("CHE105909036");
  assert.equal(c.ehraid, 126286);
  assert.match(calls[0][1], /"name":"CHE-105.909.036"/);
  assert.match(calls[0][1], /"deletedFirms":true/);
  assert.match(calls[1][0], /firm\/126286\.json$/);
});

test("byUid returns null when nothing matches exactly", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ list: [] }) });
  assert.equal(await zefix.createClient({ fetchImpl }).byUid("CHE105909036"), null);
});

test("live: Zefix still answers in the expected shape", { skip: !process.env.LIVE }, async () => {
  const client = zefix.createClient({ fetchImpl: fetch, language: "fr" });
  const c = await client.byUid("CHE-105.909.036");
  assert.ok(c && c.name.startsWith("Nestl"));
  assert.ok(c.latest && c.latest.date);
  const { companies } = await client.search("migros", { max: 5 });
  assert.ok(companies.length > 0);
});

test("rankByName puts names starting with the query first, then whole words", () => {
  const mk = (name, status = "active") => ({ name, status, translations: [] });
  const ranked = zefix.rankByName(
    [mk("Auric Design F. Nestler"), mk("Nestlé S.A.", "deleted"), mk("Lactalis Nestlé Brands AG"), mk("Nestlé S.A.")],
    "nestle"
  );
  assert.deepEqual(ranked.map((c) => `${c.name}/${c.status}`), [
    "Nestlé S.A./active",
    "Nestlé S.A./deleted",
    "Lactalis Nestlé Brands AG/active",
    "Auric Design F. Nestler/active",
  ]);
});
