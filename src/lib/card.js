// The company card, shared by the hover card, the right-click card and the
// popup. Built with createElement only: register data never goes through
// innerHTML.
(function (root) {
  const SBR = (root.SBR = root.SBR || {});

  const LANGS = ["en", "de", "fr", "it"];

  // chrome.* throws "Extension context invalidated" in a content script left
  // behind on an open page after the extension was reloaded or updated.
  function safe(fn) {
    try {
      return fn();
    } catch (_) {
      return undefined;
    }
  }

  // The language of the message bundle Chrome picked, so dates and legal
  // forms match the labels around them.
  function uiLanguage() {
    const bundle = safe(() => root.chrome?.i18n?.getMessage?.("langCode"));
    if (LANGS.includes(bundle)) return bundle;
    const raw = (safe(() => root.chrome?.i18n?.getUILanguage?.()) || root.navigator?.language || "en").slice(0, 2).toLowerCase();
    return LANGS.includes(raw) ? raw : "en";
  }

  function defaultT(key, subs) {
    return safe(() => root.chrome?.i18n?.getMessage?.(key, subs)) || key;
  }

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  function formatDate(iso, lang) {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const locale = { en: "en-GB", de: "de-CH", fr: "fr-CH", it: "it-CH" }[lang] || "en-GB";
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(d);
  }

  function legalFormName(id, lang) {
    const form = SBR.legalForms?.[id];
    return form ? form.name[lang] || form.name.en : "";
  }

  function mutationLabels(types, t) {
    // "status" is the generic tag Zefix puts next to nearly every mutation.
    const specific = types.filter((k) => k !== "status");
    const keys = specific.length ? specific : ["status"];
    const labels = keys.map((k) => {
      const base = k.startsWith("kapitalaenderung") ? "kapitalaenderung" : k;
      const msg = t(`mut_${base.replace(/\./g, "_")}`);
      return msg && !msg.startsWith("mut_") ? msg : t("mut_status");
    });
    return [...new Set(labels)].join(", ");
  }

  function truncate(text, max) {
    if (!text || text.length <= max) return text || "";
    const cut = text.slice(0, max);
    return cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max).trimEnd() + "…";
  }

  function header(t, onClose) {
    return el(
      "div",
      { class: "sbr-top" },
      el("span", { class: "sbr-brand" }, t("cardHeading")),
      onClose ? el("button", { class: "sbr-close", type: "button", "aria-label": t("close"), title: t("close"), onclick: onClose }, "×") : null
    );
  }

  function footer(t) {
    return el("p", { class: "sbr-source" }, t("dataSource"));
  }

  function companyBody(company, { t, lang, surface }) {
    const statusKey = { active: "statusActive", liquidation: "statusLiquidation", deleted: "statusDeleted" }[company.status];
    const copy = el(
      "button",
      {
        class: "sbr-copy",
        type: "button",
        title: t("copyUid"),
        onclick: async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(company.uidFormatted);
            copy.textContent = t("copied");
            setTimeout(() => (copy.textContent = t("copyUid")), 1500);
          } catch (_) {
            /* clipboard blocked by the page */
          }
        },
      },
      t("copyUid")
    );

    const facts = [];
    const form = legalFormName(company.legalFormId, lang);
    if (form) facts.push([t("labelLegalForm"), form]);
    if (company.seat || company.canton) {
      facts.push([t("labelSeat"), [company.seat, company.canton && `(${company.canton})`].filter(Boolean).join(" ")]);
    }
    if (company.status === "deleted" && company.deleteDate) facts.push([t("labelDeleted"), formatDate(company.deleteDate, lang)]);

    const latest = company.latest;
    return [
      el("h2", { class: "sbr-name" }, company.name),
      el(
        "div",
        { class: "sbr-idline" },
        el("span", { class: "sbr-uid" }, company.uidFormatted),
        copy,
        el("span", { class: `sbr-status sbr-status-${company.status}` }, t(statusKey))
      ),
      facts.length
        ? el("dl", { class: "sbr-facts" }, facts.map(([k, v]) => [el("dt", null, k), el("dd", null, v)]))
        : null,
      latest
        ? el(
            "div",
            { class: "sbr-latest" },
            el("div", { class: "sbr-latest-head" }, t("labelLatestPublication"), el("span", { class: "sbr-date" }, formatDate(latest.date, lang))),
            el("div", { class: "sbr-latest-type" }, mutationLabels(latest.types, t)),
            latest.text ? el("p", { class: "sbr-latest-text" }, truncate(latest.text, 260)) : null
          )
        : null,
      el(
        "div",
        { class: "sbr-actions" },
        el("a", { class: "sbr-primary", href: SBR.prospex.profileUrl(company.uid, surface), target: "_blank", rel: "noopener" }, t("linkProspex"), " →"),
        company.excerptUrl
          ? el("a", { class: "sbr-secondary", href: company.excerptUrl, target: "_blank", rel: "noopener noreferrer" }, t("linkExcerpt"))
          : null
      ),
    ];
  }

  function matchesBody(state, { t, onPick }) {
    if (!state.companies.length) return [el("p", { class: "sbr-message" }, t("noResults"))];
    return [
      el(
        "ul",
        { class: "sbr-matches" },
        state.companies.map((c) =>
          el(
            "li",
            null,
            el(
              "button",
              { type: "button", class: "sbr-match", onclick: () => onPick?.(c) },
              el("span", { class: "sbr-match-name" }, c.name),
              el(
                "span",
                { class: "sbr-match-meta" },
                [c.uidFormatted, [c.seat, c.canton && `(${c.canton})`].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
                c.status !== "active" ? el("span", { class: `sbr-status sbr-status-${c.status}` }, t(c.status === "deleted" ? "statusDeleted" : "statusLiquidation")) : null
              )
            )
          )
        )
      ),
      state.hasMore ? el("p", { class: "sbr-hint" }, t("moreResults")) : null,
    ];
  }

  /**
   * state: { kind: "loading" | "error" | "notFound" | "company" | "matches", ... }
   * opts:  { t, lang, surface, onPick(company), onClose, bare }
   */
  function render(state, opts = {}) {
    const o = { t: defaultT, lang: uiLanguage(), ...opts };
    const t = o.t;
    let body;
    switch (state.kind) {
      case "loading":
        body = [el("p", { class: "sbr-message sbr-loading" }, t("loading"))];
        break;
      case "error":
        body = [el("p", { class: "sbr-message" }, t("errorRegister"))];
        break;
      case "notFound":
        body = [el("p", { class: "sbr-message" }, t(state.uid ? "notFoundUid" : "noResults"))];
        break;
      case "company":
        body = companyBody(state.company, o);
        break;
      case "matches":
        body = matchesBody(state, o);
        break;
      default:
        body = [];
    }
    return el(
      "div",
      { class: o.bare ? "sbr-card sbr-bare" : "sbr-card", role: "dialog", "aria-live": "polite", lang: o.lang },
      o.bare ? null : header(t, o.onClose),
      body,
      state.kind === "company" || state.kind === "matches" ? footer(t) : null
    );
  }

  const css = `
  :host { all: initial; }
  .sbr-card {
    --sbr-paper: #F8F7F4; --sbr-ink: #1B1A20; --sbr-ink-soft: #3D3A44; --sbr-ink-faint: #6D6A77;
    --sbr-rule: #E5E3DE; --sbr-accent: #5A55C9; --sbr-accent-deep: #4741B3;
    --sbr-ok: #1F7A4D; --sbr-warn: #9A5B00; --sbr-bad: #A12A2A;
    box-sizing: border-box; width: 340px; max-width: calc(100vw - 16px);
    font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: var(--sbr-ink); background: var(--sbr-paper);
    border: 1px solid var(--sbr-rule); border-radius: 10px;
    box-shadow: 0 8px 28px rgba(27, 26, 32, .18);
    padding: 12px 14px; text-align: left;
    max-height: calc(100vh - 16px); overflow-y: auto; overscroll-behavior: contain;
  }
  .sbr-card.sbr-bare { width: auto; max-width: none; max-height: none; overflow: visible; border: 0; box-shadow: none; border-radius: 0; padding: 0; background: transparent; }
  @media (prefers-color-scheme: dark) {
    .sbr-card {
      --sbr-paper: #1F1E24; --sbr-ink: #EFEEEA; --sbr-ink-soft: #D2D0D8; --sbr-ink-faint: #A09DAA;
      --sbr-rule: #36343D; --sbr-accent: #9B97F0; --sbr-accent-deep: #B7B4F5;
      --sbr-ok: #5CC592; --sbr-warn: #E0A548; --sbr-bad: #F07D7D;
      box-shadow: 0 8px 28px rgba(0, 0, 0, .5);
    }
  }
  .sbr-card * { box-sizing: border-box; }
  .sbr-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .sbr-brand { font-size: 11px; letter-spacing: .02em; color: var(--sbr-ink-faint); }
  .sbr-close { all: unset; cursor: pointer; font-size: 18px; line-height: 1; padding: 0 4px; color: var(--sbr-ink-faint); }
  .sbr-close:hover { color: var(--sbr-ink); }
  .sbr-name { margin: 0 0 4px; font-size: 15px; font-weight: 650; line-height: 1.3; color: var(--sbr-ink); }
  .sbr-idline { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-bottom: 8px; }
  .sbr-uid { font-variant-numeric: tabular-nums; color: var(--sbr-ink-soft); }
  .sbr-copy { all: unset; cursor: pointer; font-size: 11px; color: var(--sbr-accent); }
  .sbr-copy:hover { text-decoration: underline; }
  .sbr-status { display: inline-block; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; border: 1px solid currentColor; }
  .sbr-status-active { color: var(--sbr-ok); }
  .sbr-status-liquidation { color: var(--sbr-warn); }
  .sbr-status-deleted { color: var(--sbr-bad); }
  .sbr-facts { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 10px; }
  .sbr-facts dt { color: var(--sbr-ink-faint); }
  .sbr-facts dd { margin: 0; color: var(--sbr-ink); }
  .sbr-latest { background: rgba(90, 85, 201, .07); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
  .sbr-latest-head { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; color: var(--sbr-ink-faint); }
  .sbr-latest-type { font-weight: 600; margin-top: 2px; }
  .sbr-latest-text { margin: 4px 0 0; color: var(--sbr-ink-soft); font-size: 12px; }
  .sbr-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; }
  .sbr-primary { display: inline-block; background: var(--sbr-accent-deep); color: #fff; text-decoration: none; font-weight: 600; padding: 6px 12px; border-radius: 7px; }
  @media (prefers-color-scheme: dark) { .sbr-primary { color: #17161B; } }
  .sbr-primary:hover { background: var(--sbr-accent); }
  .sbr-secondary { color: var(--sbr-accent); text-decoration: none; font-size: 12px; }
  .sbr-secondary:hover { text-decoration: underline; }
  .sbr-source { margin: 10px 0 0; font-size: 11px; color: var(--sbr-ink-faint); }
  .sbr-message { margin: 4px 0; color: var(--sbr-ink-soft); }
  .sbr-hint { margin: 8px 0 0; font-size: 11px; color: var(--sbr-ink-faint); }
  .sbr-matches { list-style: none; margin: 0; padding: 0; }
  .sbr-matches li + li { border-top: 1px solid var(--sbr-rule); }
  .sbr-match { all: unset; box-sizing: border-box; display: block; width: 100%; cursor: pointer; padding: 7px 4px; border-radius: 6px; }
  .sbr-match:hover, .sbr-match:focus-visible { background: rgba(90, 85, 201, .08); }
  .sbr-match-name { display: block; font-weight: 600; color: var(--sbr-ink); }
  .sbr-match-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; color: var(--sbr-ink-faint); }
  .sbr-loading::after { content: ""; display: inline-block; width: 10px; height: 10px; margin-left: 8px; border: 2px solid var(--sbr-rule); border-top-color: var(--sbr-accent); border-radius: 50%; animation: sbr-spin .8s linear infinite; vertical-align: -1px; }
  @keyframes sbr-spin { to { transform: rotate(360deg); } }
  `;

  SBR.card = { render, css, uiLanguage, formatDate, mutationLabels, truncate };
})(globalThis);
