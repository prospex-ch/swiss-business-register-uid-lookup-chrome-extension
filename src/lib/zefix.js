// Client for the public Zefix REST API (the one behind zefix.admin.ch) and
// the normalization of its answers into the shape the card renders.
(function (root) {
  const SBR = (root.SBR = root.SBR || {});

  const BASE = "https://www.zefix.admin.ch/ZefixREST/api/v1";

  const STATUS = {
    EXISTIEREND: "active",
    IN_AUFLOESUNG: "liquidation",
    AUFGELOEST: "liquidation",
    GELOESCHT: "deleted",
  };

  // Zefix serves SHAB messages as UTF-8 bytes decoded as Windows-1252
  // ("NestlÃ©", "Ãœbernahme"). Windows-1252 puts printable characters in
  // 0x80-0x9F, so those map back to their byte, not to their code point.
  const CP1252 = {
    0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
    0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
    0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
    0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
  };

  const CONT = "[\\u0080-\\u00BF" + Object.keys(CP1252).map((c) => String.fromCharCode(c)).join("") + "]";
  // A lead byte (C2-F4 read as Latin-1) and its continuation bytes. "Ã " with
  // a plain space is "à" whose no-break space (A0) was normalized on the way.
  const MOJIBAKE = new RegExp(`[\\u00C2-\\u00F4]${CONT}{1,3}|\\u00C3 `, "g");

  function toByte(ch) {
    const code = ch.charCodeAt(0);
    return code <= 0xff ? code : CP1252[code];
  }

  // Each broken sequence is decoded on its own, so one odd character does
  // not leave the rest of the message garbled.
  function fixEncoding(text) {
    if (!text || !/[\u00C2-\u00F4]/.test(text)) return text;
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return text.replace(MOJIBAKE, (seq) => {
      if (seq === "\u00C3 ") return "\u00E0";
      try {
        return decoder.decode(Uint8Array.from(seq, toByte));
      } catch (_) {
        return seq;
      }
    });
  }

  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

  function stripMarkup(text) {
    return String(text || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, code) => {
        if (code[0] === "#") {
          const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
          return Number.isFinite(n) ? String.fromCodePoint(n) : all;
        }
        return ENTITIES[code.toLowerCase()] ?? all;
      })
      .replace(/\s+/g, " ")
      .trim();
  }

  // Drops the header every SHAB message repeats ("Nestlé AG, in Cham,
  // CHE-105.909.036, Aktiengesellschaft (SHAB Nr. 84 vom 04.05.2026, Publ. …).")
  // so the card shows what changed.
  function publicationBody(message) {
    const text = stripMarkup(fixEncoding(message));
    const m = /^.{0,400}?\((?:SHAB|FOSC|FUSC)[^)]*\)\.\s*/.exec(text);
    return m ? text.slice(m[0].length) : text;
  }

  function cantonFor(firm) {
    const byOffice = SBR.registerOfficeCantons?.[firm.registerOfficeId];
    if (byOffice) return byOffice;
    const pub = (firm.shabPub || [])[0];
    if (pub?.registryOfficeCanton) return pub.registryOfficeCanton;
    const m = /^https?:\/\/([a-z]{2})\.chregister\.ch/.exec(firm.cantonalExcerptWeb || "");
    return m ? m[1].toUpperCase() : "";
  }

  function latestPublication(firm) {
    const pubs = (firm.shabPub || []).slice().sort((a, b) => (b.shabDate || "").localeCompare(a.shabDate || ""));
    const pub = pubs[0];
    if (!pub) return null;
    return {
      date: pub.shabDate || "",
      id: pub.shabId || null,
      types: (pub.mutationTypes || []).map((t) => t.key).filter(Boolean),
      text: publicationBody(pub.message),
    };
  }

  /** A search hit or a firm detail -> the object the card renders. */
  function toCompany(firm) {
    return {
      ehraid: firm.ehraid,
      uid: firm.uid || "",
      uidFormatted: firm.uidFormatted || SBR.uid.format(firm.uid),
      name: firm.name || "",
      translations: firm.translation || [],
      legalFormId: firm.legalFormId ?? null,
      seat: firm.legalSeat || "",
      canton: cantonFor(firm),
      status: STATUS[firm.status] || "active",
      shabDate: firm.shabDate || "",
      deleteDate: firm.deleteDate || "",
      excerptUrl: firm.cantonalExcerptWeb || "",
      latest: latestPublication(firm),
    };
  }

  // Active first, then in liquidation, then deleted; newest publication first.
  const STATUS_RANK = { active: 0, liquidation: 1, deleted: 2 };
  function bestMatch(companies) {
    return companies
      .slice()
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (b.shabDate || "").localeCompare(a.shabDate || ""))[0];
  }

  function fold(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // Zefix returns substring matches in no useful order ("Nestler" before
  // "Nestlé S.A."). Exact names first, then whole-word matches (those that
  // start with the query ahead), then prefixes; active before the others.
  function rankByName(companies, query) {
    const q = fold(query);
    if (!q) return companies;
    const words = q.split(" ");
    const score = (c) => {
      const names = [c.name, ...(c.translations || [])].map(fold);
      let best = 4;
      for (const n of names) {
        const whole = words.every((w) => n.split(" ").includes(w));
        const starts = n.startsWith(q);
        const s = n === q ? 0 : whole && starts ? 1 : whole ? 2 : starts ? 3 : 4;
        best = Math.min(best, s);
      }
      return best * 10 + STATUS_RANK[c.status];
    };
    return companies
      .map((c, i) => ({ c, i, s: score(c) }))
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .map((x) => x.c);
  }

  function createClient({ fetchImpl = root.fetch.bind(root), language = "en" } = {}) {
    async function request(path, init) {
      const res = await fetchImpl(`${BASE}/${path}`, {
        ...init,
        headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Zefix answered ${res.status}`);
      const body = await res.text();
      return body ? JSON.parse(body) : null;
    }

    // Asks Zefix for `fetch` rows so the ranking has something to choose
    // from, and returns the best `max`.
    async function search(query, { max = 10, fetch = Math.max(max, 30), includeDeleted = false } = {}) {
      const body = { name: query, languageKey: language, maxEntries: fetch };
      if (includeDeleted) body.deletedFirms = true;
      const data = await request("firm/search.json", { method: "POST", body: JSON.stringify(body) });
      const ranked = rankByName((data?.list || []).map(toCompany), query);
      return {
        companies: ranked.slice(0, max),
        hasMore: ranked.length > max || Boolean(data?.hasMoreResults),
      };
    }

    async function detail(ehraid) {
      const firm = await request(`firm/${encodeURIComponent(ehraid)}.json`);
      return firm ? toCompany(firm) : null;
    }

    /** The company a UID names (with its latest SHAB publication), or null. */
    async function byUid(uid) {
      const formatted = SBR.uid.format(uid);
      if (!formatted) return null;
      const { companies } = await search(formatted, { max: 10, fetch: 10, includeDeleted: true });
      const exact = companies.filter((c) => c.uid === `CHE${formatted.replace(/\D/g, "")}`);
      const best = bestMatch(exact);
      if (!best) return null;
      return (await detail(best.ehraid)) || best;
    }

    return { search, detail, byUid };
  }

  SBR.zefix = { createClient, toCompany, rankByName, publicationBody, fixEncoding, stripMarkup, bestMatch };
})(globalThis);
