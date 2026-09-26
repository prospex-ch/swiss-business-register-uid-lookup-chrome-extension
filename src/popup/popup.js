// Toolbar popup: search by name or UID. Also served as a full tab
// (popup.html?q=…) when the right-click card cannot open on a page.
(function () {
  const SBR = globalThis.SBR;
  const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
  const params = new URLSearchParams(location.search);
  const surface = params.get("surface") || "popup";
  const input = document.getElementById("q");
  const result = document.getElementById("result");
  const hint = document.getElementById("hint");

  const cardStyle = document.createElement("style");
  cardStyle.textContent = SBR.card.css;
  document.head.append(cardStyle);

  if (params.has("q")) document.body.classList.add("tab");
  document.documentElement.lang = SBR.card.uiLanguage();

  document.querySelectorAll("[data-i18n]").forEach((n) => (n.textContent = t(n.dataset.i18n)));
  document.querySelectorAll("[data-i18n-placeholder]").forEach((n) => (n.placeholder = t(n.dataset.i18nPlaceholder)));
  document.getElementById("home").href = SBR.prospex.homeUrl(surface);

  let seq = 0;
  let lastMatches = null;

  function paint(state, { back } = {}) {
    const nodes = [];
    if (back) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "back";
      btn.textContent = `← ${t("backToResults")}`;
      btn.addEventListener("click", () => paint(lastMatches));
      nodes.push(btn);
    }
    nodes.push(SBR.card.render(state, { bare: true, surface, onPick: (c) => pick(c) }));
    result.replaceChildren(...nodes);
    hint.hidden = state.kind !== "loading" && state.kind !== "idle";
  }

  async function ask(message) {
    try {
      return (await chrome.runtime.sendMessage(message)) || { kind: "error" };
    } catch (_) {
      return { kind: "error" };
    }
  }

  async function run(query) {
    const q = query.trim();
    const mine = ++seq;
    if (!q || (q.length < 3 && !SBR.uid.normalize(q))) {
      result.replaceChildren();
      hint.hidden = false;
      return;
    }
    paint({ kind: "loading" });
    const state = await ask({ type: "lookup", query: q });
    if (mine !== seq) return;
    lastMatches = state.kind === "matches" ? state : null;
    paint(state);
  }

  async function pick(company) {
    const mine = ++seq;
    paint({ kind: "loading" }, { back: Boolean(lastMatches) });
    const state = await ask({ type: "company", ehraid: company.ehraid });
    if (mine === seq) paint(state, { back: Boolean(lastMatches) });
  }

  let debounce = null;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => run(input.value), 400);
  });
  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    clearTimeout(debounce);
    run(input.value);
  });

  const toggle = document.getElementById("highlight");
  chrome.storage.sync.get({ highlightUids: true }).then(({ highlightUids }) => (toggle.checked = highlightUids));
  toggle.addEventListener("change", () => chrome.storage.sync.set({ highlightUids: toggle.checked }));

  if (params.has("q")) {
    input.value = params.get("q");
    run(input.value);
  }
})();
