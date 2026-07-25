// CACH OUT Ionity App — privacy reset + on-device AI advisor
// Ionity Global (Pty) Ltd · ionity.today

/* ------------------------------------------------------------------ */
/* Element refs                                                        */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);

const deepCleanButton = $("deep-clean");
const sanitizeButton = $("sanitize-url");
const hardReloadButton = $("hard-reload");
const installButton = $("install-app");
const resultList = $("result-list");
const lastRun = $("last-run");
const storageEstimate = $("storage-estimate");

const opt = {
  cookies: $("opt-cookies"),
  storage: $("opt-storage"),
  caches: $("opt-caches"),
  idb: $("opt-idb"),
  sw: $("opt-sw"),
  url: $("opt-url"),
  reload: $("opt-reload"),
};

const aiScanButton = $("ai-scan");
const aiExplainButton = $("ai-explain");
const aiStatus = $("ai-status");
const aiFindings = $("ai-findings");
const aiExplanation = $("ai-explanation");
const scoreWrap = $("ai-score-wrap");
const scoreRing = $("score-ring");
const scoreValue = $("score-value");
const scoreSummary = $("score-summary");

const cmdList = $("cmd-list");
const openNote = $("open-note");

let installPromptEvent = null;
let lastScan = null;

/* ------------------------------------------------------------------ */
/* Tracking signatures                                                 */
/* ------------------------------------------------------------------ */
const trackingParams = new Set([
  "gclid", "fbclid", "msclkid", "mc_eid", "mc_cid", "mkt_tok",
  "_hsenc", "_hsmi", "igshid", "vero_id", "wickedid", "yclid", "twclid",
]);

// name-substring -> human label for known trackers/analytics cookies+storage keys
const trackerSignatures = [
  { match: /^_ga($|_)/i, label: "Google Analytics", weight: 8 },
  { match: /^_gid$/i, label: "Google Analytics (session)", weight: 5 },
  { match: /^_gcl_/i, label: "Google Ads conversion", weight: 8 },
  { match: /^_fbp$|^_fbc$/i, label: "Meta / Facebook Pixel", weight: 9 },
  { match: /^_uet/i, label: "Microsoft / Bing UET", weight: 7 },
  { match: /^__hstc|hubspot|^hs/i, label: "HubSpot", weight: 6 },
  { match: /^_hj/i, label: "Hotjar session recording", weight: 8 },
  { match: /mixpanel|^mp_/i, label: "Mixpanel", weight: 6 },
  { match: /amplitude/i, label: "Amplitude", weight: 6 },
  { match: /segment|ajs_/i, label: "Segment", weight: 6 },
  { match: /intercom/i, label: "Intercom", weight: 5 },
  { match: /_pk_|matomo|piwik/i, label: "Matomo / Piwik", weight: 5 },
  { match: /doubleclick|^ide$|^dsid$/i, label: "DoubleClick ad targeting", weight: 9 },
  { match: /^_tt|tiktok/i, label: "TikTok Pixel", weight: 8 },
  { match: /^li_|linkedin|bcookie|lidc/i, label: "LinkedIn Insight", weight: 6 },
  { match: /^utm/i, label: "Campaign attribution", weight: 4 },
];

/* ------------------------------------------------------------------ */
/* Result logging                                                      */
/* ------------------------------------------------------------------ */
function addResult(label, value, level = "") {
  const li = document.createElement("li");
  if (level) li.className = level;
  li.innerHTML = `<strong>${label}:</strong> <span>${value}</span>`;
  resultList.appendChild(li);
}
function resetResults() { resultList.innerHTML = ""; }
function stampLastRun() { lastRun.textContent = `Completed at ${new Date().toLocaleString()}`; }
function setBusy(busy) {
  deepCleanButton.disabled = busy;
  sanitizeButton.disabled = busy;
}

/* ------------------------------------------------------------------ */
/* Storage estimate                                                    */
/* ------------------------------------------------------------------ */
function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return "n/a";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
async function readEstimate() {
  if (!navigator.storage?.estimate) return null;
  try { return await navigator.storage.estimate(); } catch { return null; }
}
async function refreshEstimateBadge() {
  const est = await readEstimate();
  storageEstimate.textContent = est ? `storage: ${fmtBytes(est.usage)}` : "storage: n/a";
  return est;
}

/* ------------------------------------------------------------------ */
/* Cleanup primitives                                                  */
/* ------------------------------------------------------------------ */
function domainCandidates(hostname) {
  const parts = hostname.split(".").filter(Boolean);
  const domains = new Set([hostname]);
  for (let i = 1; i < parts.length - 1; i += 1) domains.add(`.${parts.slice(i).join(".")}`);
  return [...domains];
}

function clearCookieJar() {
  const entries = document.cookie ? document.cookie.split(";") : [];
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  const domains = domainCandidates(window.location.hostname);
  const paths = ["/", window.location.pathname || "/"];
  let attempts = 0;
  for (const cookie of entries) {
    const idx = cookie.indexOf("=");
    const name = (idx >= 0 ? cookie.slice(0, idx) : cookie).trim();
    if (!name) continue;
    for (const path of paths) {
      document.cookie = `${name}=; expires=${expires}; path=${path}`;
      document.cookie = `${name}=; expires=${expires}; path=${path}; secure; samesite=lax`;
      attempts += 2;
      for (const domain of domains) {
        document.cookie = `${name}=; expires=${expires}; path=${path}; domain=${domain}`;
        document.cookie = `${name}=; expires=${expires}; path=${path}; domain=${domain}; secure; samesite=lax`;
        attempts += 2;
      }
    }
  }
  return { detected: entries.length, attempts };
}

function clearWebStorage() {
  const local = window.localStorage.length;
  const session = window.sessionStorage.length;
  window.localStorage.clear();
  window.sessionStorage.clear();
  try { window.name = ""; } catch { /* ignore */ }
  return { local, session };
}

async function clearCacheStorage() {
  if (!("caches" in window)) return { supported: false, deleted: 0 };
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  return { supported: true, deleted: keys.length };
}

async function clearIndexedDatabases() {
  if (!("indexedDB" in window) || typeof indexedDB.databases !== "function") {
    return { supported: false, deleted: 0 };
  }
  const dbs = await indexedDB.databases();
  const names = [...new Set(dbs.map((d) => d.name).filter(Boolean))];
  await Promise.all(names.map((name) => new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  })));
  return { supported: true, deleted: names.length };
}

async function unregisterServiceWorkers() {
  if (!("serviceWorker" in navigator)) return { supported: false, removed: 0 };
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((r) => r.unregister()));
  return { supported: true, removed: regs.length };
}

function sanitizeUrl({ removeAll }) {
  const url = new URL(window.location.href);
  const before = url.toString();
  const removed = [];
  for (const [key] of [...url.searchParams.entries()]) {
    const lower = key.toLowerCase();
    const isTracker = lower.startsWith("utm_") || trackingParams.has(lower);
    if (removeAll || isTracker) { removed.push(key); url.searchParams.delete(key); }
  }
  if (url.hash) { removed.push("#hash"); url.hash = ""; }
  const after = url.toString();
  if (after !== before) window.history.replaceState({}, "", after);
  return { removed: removed.length, url: after };
}

function hardReload() {
  const url = new URL(window.location.href);
  url.searchParams.set("_cb", Date.now().toString(36));
  window.location.replace(url.toString());
}

/* ------------------------------------------------------------------ */
/* Deep clean orchestration                                            */
/* ------------------------------------------------------------------ */
async function runDeepClean() {
  resetResults();
  setBusy(true);
  aiExplanation.hidden = true;
  const before = await readEstimate();
  try {
    if (opt.cookies.checked) {
      const r = clearCookieJar();
      addResult("Cookies detected", String(r.detected), r.detected ? "warn" : "ok");
      addResult("Cookie delete attempts", String(r.attempts));
    }
    if (opt.storage.checked) {
      const r = clearWebStorage();
      addResult("LocalStorage cleared", String(r.local), r.local ? "warn" : "ok");
      addResult("SessionStorage cleared", String(r.session));
    }
    const jobs = [];
    if (opt.caches.checked) jobs.push(clearCacheStorage().then((r) =>
      addResult("CacheStorage buckets deleted", r.supported ? String(r.deleted) : "unsupported")));
    if (opt.idb.checked) jobs.push(clearIndexedDatabases().then((r) =>
      addResult("IndexedDB databases deleted", r.supported ? String(r.deleted) : "unsupported")));
    if (opt.sw.checked) jobs.push(unregisterServiceWorkers().then((r) =>
      addResult("Service workers unregistered", r.supported ? String(r.removed) : "unsupported")));
    await Promise.all(jobs);

    if (opt.url.checked) {
      const r = sanitizeUrl({ removeAll: true });
      addResult("URL strings removed", String(r.removed));
      addResult("Sanitized URL", r.url);
    }

    const after = await refreshEstimateBadge();
    if (before && after) {
      const reclaimed = Math.max(0, (before.usage || 0) - (after.usage || 0));
      addResult("Storage reclaimed", fmtBytes(reclaimed), reclaimed ? "ok" : "");
    }

    stampLastRun();

    if (opt.reload.checked) {
      addResult("Reloading", "bypassing HTTP cache…");
      setTimeout(hardReload, 600);
    }
  } catch (err) {
    addResult("Cleanup error", err instanceof Error ? err.message : String(err), "danger");
  } finally {
    setBusy(false);
  }
}

/* ------------------------------------------------------------------ */
/* AI Privacy Advisor (offline rule engine + on-device LLM)            */
/* ------------------------------------------------------------------ */
function collectInventory() {
  const cookies = (document.cookie ? document.cookie.split(";") : [])
    .map((c) => c.split("=")[0].trim()).filter(Boolean);
  const localKeys = Object.keys(window.localStorage || {});
  const sessionKeys = Object.keys(window.sessionStorage || {});
  return { cookies, localKeys, sessionKeys };
}

function classify(names) {
  const hits = [];
  for (const name of names) {
    for (const sig of trackerSignatures) {
      if (sig.match.test(name)) { hits.push({ name, label: sig.label, weight: sig.weight }); break; }
    }
  }
  return hits;
}

async function runScan() {
  aiExplanation.hidden = true;
  const inv = collectInventory();
  const allNames = [...inv.cookies, ...inv.localKeys, ...inv.sessionKeys];
  const trackers = classify(allNames);
  const uniqueTrackers = [...new Map(trackers.map((t) => [t.label, t])).values()];

  const totalItems = allNames.length;
  const penalty = trackers.reduce((sum, t) => sum + t.weight, 0);
  const score = Math.max(0, 100 - penalty - Math.min(20, Math.floor(totalItems / 3)));

  lastScan = { inventory: inv, totalItems, trackers: uniqueTrackers, score };

  // Render score ring
  scoreWrap.hidden = false;
  const color = score >= 80 ? "var(--ionity-teal)" : score >= 50 ? "var(--ionity-warn)" : "var(--ionity-danger-text)";
  scoreRing.style.setProperty("--pct", String(score));
  scoreRing.style.setProperty("--ring-color", color);
  scoreValue.textContent = String(score);
  scoreSummary.textContent =
    score >= 80 ? "Low exposure on this site." :
    score >= 50 ? "Moderate tracking present — a clean is recommended." :
    "High tracking exposure — run a deep clean now.";

  // Findings
  aiFindings.innerHTML = "";
  const add = (label, value, level = "") => {
    const li = document.createElement("li");
    if (level) li.className = level;
    li.innerHTML = `<strong>${label}:</strong> <span>${value}</span>`;
    aiFindings.appendChild(li);
  };
  add("Cookies", String(inv.cookies.length), inv.cookies.length ? "warn" : "ok");
  add("LocalStorage keys", String(inv.localKeys.length));
  add("SessionStorage keys", String(inv.sessionKeys.length));
  if (uniqueTrackers.length) {
    add("Known trackers detected", String(uniqueTrackers.length), "danger");
    for (const t of uniqueTrackers) add("• " + t.label, t.name, "warn");
  } else {
    add("Known trackers detected", "none 🎉", "ok");
  }

  aiExplainButton.disabled = !(await ensureAiSession());
  return lastScan;
}

/* ---- On-device AI (Chrome Prompt API / window.ai) ---------------- */
let aiSession = null;

function aiApi() {
  // Chrome exposes global `LanguageModel`; older builds used `window.ai.languageModel`
  if (typeof LanguageModel !== "undefined") return LanguageModel;
  if (window.ai?.languageModel) return window.ai.languageModel;
  return null;
}

async function detectAi() {
  const api = aiApi();
  if (!api) { aiStatus.textContent = "on-device: unavailable"; return false; }
  try {
    const availability = await (api.availability?.() ?? api.capabilities?.().then((c) => c.available));
    const ok = availability === "available" || availability === "readily" || availability === "downloadable" || availability === "after-download";
    aiStatus.textContent = ok ? "on-device: ready" : "on-device: unavailable";
    return ok;
  } catch {
    aiStatus.textContent = "on-device: unavailable";
    return false;
  }
}

async function ensureAiSession() {
  const api = aiApi();
  if (!api) return false;
  if (aiSession) return true;
  try {
    aiSession = await api.create({
      initialPrompts: [{
        role: "system",
        content: "You are the CACH OUT privacy advisor for Ionity Global. Explain browser tracking findings in short, clear, non-technical language and give practical advice. Keep answers under 120 words.",
      }],
    });
    return true;
  } catch {
    return false;
  }
}

async function explainWithAi() {
  if (!lastScan) { await runScan(); }
  aiExplanation.hidden = false;
  aiExplanation.textContent = "Thinking on-device…";
  const ok = await ensureAiSession();
  if (!ok) {
    aiExplanation.textContent = ruleBasedExplanation(lastScan);
    return;
  }
  const t = lastScan.trackers.map((x) => x.label).join(", ") || "none";
  const prompt = `Privacy score: ${lastScan.score}/100. Total stored items: ${lastScan.totalItems}. Trackers found: ${t}. Explain what this means for the user's privacy on this site and what to do next.`;
  try {
    aiExplanation.textContent = await aiSession.prompt(prompt);
  } catch (err) {
    aiExplanation.textContent = ruleBasedExplanation(lastScan) +
      `\n\n(On-device AI error: ${err instanceof Error ? err.message : String(err)})`;
  }
}

function ruleBasedExplanation(scan) {
  if (!scan) return "Run a scan first.";
  const names = scan.trackers.map((t) => t.label).join(", ");
  const lines = [];
  lines.push(`Your privacy score for this site is ${scan.score}/100.`);
  if (scan.trackers.length) {
    lines.push(`We found data belonging to: ${names}. These identifiers can be used to recognise you across visits and, in some cases, across other websites.`);
    lines.push("Recommendation: run a Deep Clean to remove them, and enable your browser's tracking protection.");
  } else {
    lines.push("No known third-party trackers were found in this site's cookies or storage — good news.");
    lines.push("You can still Deep Clean to reset all first-party site data.");
  }
  lines.push("Note: on-device AI (Chrome/Edge built-in Gemini Nano) was not available, so this is the built-in rule-based explanation.");
  return lines.join("\n\n");
}

/* ------------------------------------------------------------------ */
/* DNS / OS-level command panel                                        */
/* ------------------------------------------------------------------ */
const dnsCommands = [
  { os: "Windows", cmd: "ipconfig /flushdns" },
  { os: "macOS", cmd: "sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder" },
  { os: "Linux (systemd)", cmd: "sudo resolvectl flush-caches" },
  { os: "Linux (nscd)", cmd: "sudo systemctl restart nscd" },
];

function renderDnsCommands() {
  cmdList.innerHTML = "";
  for (const item of dnsCommands) {
    const row = document.createElement("div");
    row.className = "cmd";
    row.innerHTML = `<span><small>${item.os}</small><br><code>${item.cmd}</code></span>`;
    const btn = document.createElement("button");
    btn.className = "copy-btn";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.cmd);
        btn.textContent = "Copied ✓";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      } catch {
        btn.textContent = "Copy failed";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      }
    });
    row.appendChild(btn);
    cmdList.appendChild(row);
  }
}

function wireOpenButtons() {
  for (const btn of document.querySelectorAll("[data-open]")) {
    btn.addEventListener("click", async () => {
      const target = btn.getAttribute("data-open");
      try { await navigator.clipboard.writeText(target); } catch { /* ignore */ }
      openNote.textContent = `Internal pages can't be opened by a website for security reasons. The address "${target}" was copied — paste it into your address bar.`;
    });
  }
}

/* ------------------------------------------------------------------ */
/* Install prompt + wiring                                             */
/* ------------------------------------------------------------------ */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPromptEvent = e;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!installPromptEvent) return;
  installPromptEvent.prompt();
  await installPromptEvent.userChoice;
  installPromptEvent = null;
  installButton.hidden = true;
});
window.addEventListener("appinstalled", () => { installPromptEvent = null; installButton.hidden = true; });

deepCleanButton.addEventListener("click", runDeepClean);
sanitizeButton.addEventListener("click", () => {
  resetResults();
  const r = sanitizeUrl({ removeAll: opt.url.checked });
  addResult("URL strings removed", String(r.removed));
  addResult("Sanitized URL", r.url);
  stampLastRun();
});
hardReloadButton.addEventListener("click", hardReload);
aiScanButton.addEventListener("click", runScan);
aiExplainButton.addEventListener("click", explainWithAi);

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
renderDnsCommands();
wireOpenButtons();
refreshEstimateBadge();
detectAi();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline cache optional */ });
  });
}
