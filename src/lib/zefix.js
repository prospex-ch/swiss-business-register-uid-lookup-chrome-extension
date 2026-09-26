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

  // Zefix serves SHAB messages as UTF-8 bytes re-read as Latin-1 ("NestlÃ©").
  function fixEncoding(text) {
    if (!text || !/[Â-Ã][\u0080-¿]/.test(text)) return text;
    try {
      const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (_) {
      return text;
    }
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
