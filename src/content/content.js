// Finds UIDs on the page, underlines them, and shows the company card on
// hover. Also shows the card for the right-click menu.
(function () {
  const SBR = globalThis.SBR;
  if (!SBR || window.__sbrLoaded) return;
  window.__sbrLoaded = true;

  const MARK_CLASS = "sbr-uid-mark";
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "TEMPLATE", "SVG", "CANVAS", "IFRAME"]);
  const HOVER_DELAY_MS = 350;
  const HIDE_DELAY_MS = 300;
  const MAX_NODES_PER_PASS = 4000;

  let enabled = true;
  let observer = null;
  let pending = new Set();
  let scheduled = false;

  // ---------------------------------------------------------------- marking

  function injectMarkStyle() {
    if (document.getElementById("sbr-mark-style")) return;
    const style = document.createElement("style");
    style.id = "sbr-mark-style";
    style.textContent = `.${MARK_CLASS}{text-decoration:underline dotted #5A55C9 1.5px;text-underline-offset:2px;cursor:help}`;
    (document.head || document.documentElement).append(style);
  }

  function skippable(node) {
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (SKIP_TAGS.has(el.tagName) || el.isContentEditable || el.classList.contains(MARK_CLASS) || el.id === "sbr-card-host") return true;
    }
    return false;
  }

  function markTextNode(node) {
    const text = node.nodeValue;
    const hits = SBR.uid.findAll(text);
    if (!hits.length || skippable(node)) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const hit of hits) {
      if (hit.index > last) frag.append(text.slice(last, hit.index));
      const mark = document.createElement("span");
      mark.className = MARK_CLASS;
      mark.dataset.sbrUid = hit.uid;
      mark.textContent = text.slice(hit.index, hit.index + hit.length);
      frag.append(mark);
      last = hit.index + hit.length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }

  function scan(root) {
    if (!root || !enabled) return;
    if (root.nodeType === Node.TEXT_NODE) {
      if (/CHE/i.test(root.nodeValue)) markTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && SKIP_TAGS.has(root.tagName)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/CHE/i.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode() && nodes.length < MAX_NODES_PER_PASS) nodes.push(walker.currentNode);
    nodes.forEach(markTextNode);
  }

  function flush() {
    scheduled = false;
    const roots = [...pending];
    pending = new Set();
    roots.forEach((n) => n.isConnected && scan(n));
  }

  function schedule(node) {
    pending.add(node);
    if (scheduled) return;
    scheduled = true;
    (window.requestIdleCallback || ((cb) => setTimeout(cb, 200)))(flush, { timeout: 1000 });
  }

  function startMarking() {
    injectMarkStyle();
    scan(document.body);
    observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") schedule(r.target);
        for (const n of r.addedNodes) {
          if (n.nodeType === Node.ELEMENT_NODE && (n.id === "sbr-card-host" || n.classList?.contains(MARK_CLASS))) continue;
          schedule(n);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function stopMarking() {
    observer?.disconnect();
    observer = null;
    document.querySelectorAll(`.${MARK_CLASS}`).forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
    document.body.normalize();
  }

  // ------------------------------------------------------------------- card

  let host = null;
  let shadow = null;
  let hideTimer = null;
  let showTimer = null;
  let currentAnchor = null;
  let requestSeq = 0;

  function ensureHost() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "sbr-card-host";
    host.style.cssText = "position:fixed;z-index:2147483647;top:0;left:0;display:none;";
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = SBR.card.css;
    shadow.append(style, document.createElement("div"));
    host.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    host.addEventListener("mouseleave", () => {
      if (host.dataset.sticky !== "1") scheduleHide();
    });
    document.documentElement.append(host);
  }

  function place(rect) {
    const margin = 8;
    const card = shadow.lastElementChild;
    const w = card.offsetWidth || 340;
    const h = card.offsetHeight || 200;
    let left = Math.min(Math.max(margin, rect.left), window.innerWidth - w - margin);
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - margin) {
      // Above the anchor if it fits there, else as low as the window allows.
      top = rect.top - h - 6 > margin ? rect.top - h - 6 : window.innerHeight - h - margin;
    }
    host.style.left = `${Math.max(margin, left)}px`;
    host.style.top = `${Math.max(margin, top)}px`;
  }

  function show(state, rect, { sticky, surface }) {
    ensureHost();
    host.dataset.sticky = sticky ? "1" : "0";
    const node = SBR.card.render(state, {
      surface,
      onClose: hide,
      onPick: (c) => loadCompany(c.ehraid, rect, { sticky, surface }),
    });
    const wrapper = shadow.lastElementChild;
    wrapper.replaceChildren(node);
    host.style.display = "block";
    place(rect);
  }

  function hide() {
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    currentAnchor = null;
    requestSeq++;
    if (host) host.style.display = "none";
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, HIDE_DELAY_MS);
  }

  async function ask(message) {
    try {
      return (await chrome.runtime.sendMessage(message)) || { kind: "error" };
    } catch (_) {
      // The extension was reloaded or updated while this page stayed open.
      return { kind: "error" };
    }
  }

  async function load(query, rect, opts) {
    const seq = ++requestSeq;
    show({ kind: "loading" }, rect, opts);
    const state = await ask({ type: "lookup", query });
    if (seq === requestSeq) show(state, rect, opts);
  }

  async function loadCompany(ehraid, rect, opts) {
    const seq = ++requestSeq;
    show({ kind: "loading" }, rect, opts);
    const state = await ask({ type: "company", ehraid });
    if (seq === requestSeq) show(state, rect, opts);
  }

  // ------------------------------------------------------------------ hover

  document.addEventListener(
    "mouseover",
    (e) => {
      const mark = e.target instanceof Element ? e.target.closest(`.${MARK_CLASS}`) : null;
      if (!mark) return;
      clearTimeout(hideTimer);
      if (mark === currentAnchor) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        currentAnchor = mark;
        load(mark.dataset.sbrUid, mark.getBoundingClientRect(), { sticky: false, surface: "hover" });
      }, HOVER_DELAY_MS);
    },
    true
  );

  document.addEventListener(
    "mouseout",
    (e) => {
      const mark = e.target instanceof Element ? e.target.closest(`.${MARK_CLASS}`) : null;
      if (!mark) return;
      clearTimeout(showTimer);
      if (host?.dataset.sticky !== "1") scheduleHide();
    },
    true
  );

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });

  document.addEventListener(
    "mousedown",
    (e) => {
      if (host && host.style.display !== "none" && !e.composedPath().includes(host)) hide();
    },
    true
  );

  window.addEventListener("scroll", () => host?.dataset.sticky !== "1" && hide(), { passive: true });

  // ------------------------------------------------------------ right-click

  function selectionRect() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width || r.height) return r;
    }
    return new DOMRect(window.innerWidth / 2 - 170, 80, 0, 0);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== "show-card") return false;
    currentAnchor = null;
    load(msg.query, selectionRect(), { sticky: true, surface: "context-menu" });
    sendResponse({ ok: true });
    return false;
  });

  // --------------------------------------------------------------- settings

  chrome.storage.sync.get({ highlightUids: true }).then(({ highlightUids }) => {
    enabled = highlightUids;
    if (enabled && document.body) startMarking();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.highlightUids) return;
    enabled = changes.highlightUids.newValue !== false;
    if (enabled && !observer) startMarking();
    if (!enabled && observer) stopMarking();
  });
})();
