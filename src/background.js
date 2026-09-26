// Service worker: talks to Zefix, caches answers, owns the context menu.
importScripts("lib/uid.js", "data/legal-forms.js", "lib/zefix.js");

const SBR = globalThis.SBR;
const MENU_ID = "sbr-lookup-selection";
const CACHE_TTL_MS = 60 * 60 * 1000;

function language() {
  const lang = chrome.i18n.getMessage("langCode") || chrome.i18n.getUILanguage().slice(0, 2).toLowerCase();
  return ["de", "fr", "it", "en"].includes(lang) ? lang : "en";
}

const client = SBR.zefix.createClient({ language: language() });

// chrome.storage.session outlives the worker's idle shutdowns but not the
// browser session, which is what a lookup cache wants.
async function cached(key, load) {
  const store = chrome.storage.session;
  const hit = (await store.get(key))[key];
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await load();
  try {
    await store.set({ [key]: { at: Date.now(), value } });
  } catch (_) {
    // Session storage is capped at 10 MB; start over rather than fail the lookup.
    await store.clear();
  }
  return value;
}

async function lookup(query) {
  const text = String(query || "").trim().slice(0, 200);
  const uid = SBR.uid.normalize(text);
  // A selection that contains a UID anywhere is a UID lookup.
  if (uid) {
    const company = await cached(`uid:${uid}`, () => client.byUid(uid));
    return company ? { kind: "company", company } : { kind: "notFound", uid };
  }
  if (text.length < 3) return { kind: "matches", query: text, companies: [], hasMore: false };
  const { companies, hasMore } = await cached(`q:${language()}:${text.toLowerCase()}`, () => client.search(text, { max: 8 }));
  if (companies.length === 1) return company(companies[0].ehraid);
  return { kind: "matches", query: text, companies, hasMore };
}

async function company(ehraid) {
  const found = await cached(`firm:${ehraid}`, () => client.detail(ehraid));
  return found ? { kind: "company", company: found } : { kind: "notFound" };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  let work;
  if (msg?.type === "lookup") work = lookup(msg.query);
  else if (msg?.type === "company") work = company(msg.ehraid);
  else return false;
  work.then(sendResponse, (err) => {
    console.warn("Swiss register lookup failed", err);
    sendResponse({ kind: "error" });
  });
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: chrome.i18n.getMessage("contextMenuTitle"),
    contexts: ["selection"],
  });
  const { highlightUids } = await chrome.storage.sync.get("highlightUids");
  if (highlightUids === undefined) await chrome.storage.sync.set({ highlightUids: true });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const query = (info.selectionText || "").trim();
  if (!query) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "show-card", query }, { frameId: info.frameId ?? 0 });
  } catch (_) {
    // No content script on this page (chrome://, the Web Store, PDFs): open
    // the search page in a tab instead.
    const url = chrome.runtime.getURL(`src/popup/popup.html?q=${encodeURIComponent(query)}&surface=context-menu`);
    chrome.tabs.create({ url, index: tab ? tab.index + 1 : undefined });
  }
});
