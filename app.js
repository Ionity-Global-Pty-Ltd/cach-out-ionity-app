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

// Smart Link Cleaner refs
const linkInput = $("link-input");
const linkAnalyzeBtn = $("link-analyze");
const linkPasteBtn = $("link-paste");
const linkExplainBtn = $("link-explain");
const linkVerdict = $("link-verdict");
const linkParams = $("link-params");
const linkCleanWrap = $("link-clean-wrap");
const linkClean = $("link-clean");
const linkCopyBtn = $("link-copy");
const linkExplanation = $("link-explanation");
let lastLink = null;

// Connectivity Doctor refs
const connStatus = $("conn-status");
const connResults = $("conn-results");
const connVerdict = $("conn-verdict");
const connExplanation = $("conn-explanation");
const connRetestBtn = $("conn-retest");
const connExplainBtn = $("conn-explain");
let lastConn = null;

// Organizer refs
const orgStatus = $("org-status");
const orgUnsupported = $("org-unsupported");
const orgControls = $("org-controls");
const orgApply = $("org-apply");
const orgDupes = $("org-dupes");
const orgDownloadsBtn = $("org-downloads");
const orgDocumentsBtn = $("org-documents");
const orgExplainBtn = $("org-explain");
const orgDash = $("org-dash");
const orgResults = $("org-results");
const orgVerdict = $("org-verdict");
const orgExplanation = $("org-explanation");
let lastOrg = null;

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
/* AI Smart Link Cleaner                                               */
/* ------------------------------------------------------------------ */
// Params that are ONLY there to track you across sites — safe to strip.
const LINK_TRACKERS = [
  { rx: /^utm_/i, label: "Campaign tracking (UTM)" },
  { rx: /^(gclid|gbraid|wbraid|dclid|gclsrc|gad_source|gad|_ga|_gl)$/i, label: "Google Ads / Analytics click ID" },
  { rx: /^(fbclid|fb_action_ids|fb_action_types|fb_source|fb_ref)$/i, label: "Facebook click ID" },
  { rx: /^msclkid$/i, label: "Microsoft Ads click ID" },
  { rx: /^(yclid|ymclid|_openstat)$/i, label: "Yandex click ID" },
  { rx: /^twclid$/i, label: "Twitter / X click ID" },
  { rx: /^(ttclid|tt_medium|tt_content)$/i, label: "TikTok click ID" },
  { rx: /^igshid$/i, label: "Instagram share ID" },
  { rx: /^(mc_eid|mc_cid)$/i, label: "Mailchimp tracking" },
  { rx: /^mkt_tok$/i, label: "Marketo tracking" },
  { rx: /^(_hsenc|_hsmi|__hstc|__hssc|__hsfp|hsctatracking|hsa_[a-z]+)$/i, label: "HubSpot tracking" },
  { rx: /^(vero_id|vero_conv)$/i, label: "Vero tracking" },
  { rx: /^(oly_anon_id|oly_enc_id)$/i, label: "Omeda tracking" },
  { rx: /^(s_kwcid|s_cid|ef_id)$/i, label: "Adobe / campaign tracking" },
  { rx: /^(spm|scm|_trkparms|_trksid)$/i, label: "Marketplace tracking" },
  { rx: /^(ref|ref_src|ref_url|referrer|referer|source|src)$/i, label: "Referrer tracking" },
  { rx: /^(cmpid|campaign|campaignid|cid|icid|ncid|mbid|sr_share)$/i, label: "Campaign ID" },
  { rx: /^(trk|trkcampaign|li_fat_id)$/i, label: "LinkedIn tracking" },
  { rx: /^(guccounter|guce_referrer|guce_referrer_sig)$/i, label: "Consent-wall tracking" },
  { rx: /^(__twitter_impression|wt_zmc|wt_mc)$/i, label: "Impression tracking" },
];

// Params that make a page / login actually WORK — never strip these.
const LINK_ESSENTIAL = [
  { rx: /^(client_id|redirect_uri|redirect_url|response_type|response_mode|scope|state|code|code_verifier|code_challenge|code_challenge_method|nonce|grant_type|refresh_token|access_token|id_token|session_state|login_hint|prompt|resource|audience|acr_values|max_age|claims|assertion)$/i, label: "OAuth / login token" },
  { rx: /^(sig|signature|hmac|checksum|mac|token|auth|apikey|api_key|secret|expires|expiry|se|sp|sv|st|sr|skoid|sig)$/i, label: "Security signature / expiry" },
  { rx: /^(contextid|opid|uaid|bk|cobrandid|npc|mkt|lc|wa|wreply|wctx|wtrealm|cid_qs)$/i, label: "Microsoft sign-in token" },
  { rx: /^(username|user|email|login|account)$/i, label: "Login identity (personal)", personal: true },
];

// Hostname → friendly identity provider name (for login-flow detection).
const LINK_PROVIDERS = [
  { rx: /(^|\.)(login\.live|login\.microsoftonline|microsoftonline|live|microsoft|office|outlook|azure|sharepoint)\.com$/i, name: "Microsoft" },
  { rx: /(^|\.)(accounts\.google|google|youtube|gmail)\.com$/i, name: "Google" },
  { rx: /(^|\.)(facebook|fb)\.com$/i, name: "Facebook" },
  { rx: /(^|\.)(appleid|apple)\.com$/i, name: "Apple" },
  { rx: /(^|\.)(github)\.com$/i, name: "GitHub" },
  { rx: /(^|\.)(okta|auth0|onelogin)\.com$/i, name: "SSO provider" },
];

function classifyLinkParam(key) {
  for (const t of LINK_TRACKERS) if (t.rx.test(key)) return { kind: "strip", label: t.label };
  for (const e of LINK_ESSENTIAL) if (e.rx.test(key)) return { kind: "keep", label: e.label, personal: !!e.personal };
  return { kind: "other", label: "Functional / unknown — kept" };
}

function providerFor(hostname) {
  for (const p of LINK_PROVIDERS) if (p.rx.test(hostname)) return p.name;
  return null;
}

function analyzeLink(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "That doesn't look like a full URL. Include the https:// part." };
  }
  const params = [];
  for (const [key, value] of url.searchParams.entries()) {
    params.push({ key, value, ...classifyLinkParam(key) });
  }
  const provider = providerFor(url.hostname);
  const looksLikeAuth = /oauth|authorize|signin|login|connect|token/i.test(url.pathname) ||
    params.some((p) => /^(client_id|redirect_uri|response_type|code|id_token|scope)$/i.test(p.key));

  // Build cleaned URL: drop trackers only, keep everything else in order.
  const clean = new URL(url.toString());
  const stripped = [];
  const keys = [...clean.searchParams.keys()];
  for (const k of keys) {
    if (LINK_TRACKERS.some((t) => t.rx.test(k))) { stripped.push(k); }
  }
  // rebuild search params without stripped keys (handles duplicates safely)
  const kept = [];
  for (const [k, v] of url.searchParams.entries()) {
    if (!stripped.includes(k)) kept.push([k, v]);
  }
  clean.search = "";
  for (const [k, v] of kept) clean.searchParams.append(k, v);
  const cleanUrl = clean.toString();

  const trackerCount = params.filter((p) => p.kind === "strip").length;
  const personal = params.some((p) => p.personal);

  return { url, params, provider, looksLikeAuth, cleanUrl, stripped, trackerCount, personal, hadHash: !!url.hash };
}

function truncateVal(v) {
  if (v.length <= 46) return v;
  return v.slice(0, 40) + "…(" + v.length + " chars)";
}

function renderLinkAnalysis(a) {
  linkExplanation.hidden = true;
  linkParams.innerHTML = "";
  linkCleanWrap.hidden = true;

  if (a.error) {
    linkVerdict.hidden = false;
    linkVerdict.className = "link-verdict warn";
    linkVerdict.textContent = a.error;
    return;
  }

  // Verdict banner
  linkVerdict.hidden = false;
  let cls, msg;
  if (a.looksLikeAuth || a.provider) {
    cls = "auth";
    const who = a.provider ? `a ${a.provider} sign-in` : "a login / OAuth";
    msg = `<strong>This is ${who} link.</strong> The long strings are <strong>login tokens</strong> — removing them will break the sign-in, so keep them. ` +
      (a.trackerCount
        ? `I found <strong>${a.trackerCount}</strong> tracker string${a.trackerCount === 1 ? "" : "s"} that can be safely stripped.`
        : `There are <strong>no removable trackers</strong> here — nothing to clean, and nothing is "broken". This is normal for a sign-in link.`);
  } else if (a.trackerCount) {
    cls = "warn";
    msg = `<strong>${a.trackerCount}</strong> tracker string${a.trackerCount === 1 ? "" : "s"} found. The cleaned link below removes them while keeping the page working.`;
  } else {
    cls = "ok";
    msg = `<strong>Clean already.</strong> No known tracking strings in this link.`;
  }
  if (a.personal) msg += ` ⚠ It also contains <strong>personal data</strong> (a username/email) — be careful sharing it.`;
  linkVerdict.className = "link-verdict " + cls;
  linkVerdict.innerHTML = msg;

  // Per-param breakdown
  if (!a.params.length) {
    const li = document.createElement("li");
    li.className = "ok";
    li.innerHTML = `<span>No query strings on this link.</span>`;
    linkParams.appendChild(li);
  }
  for (const p of a.params) {
    const li = document.createElement("li");
    const tag = p.kind === "strip"
      ? `<span class="tag tag-strip">STRIP</span>`
      : p.kind === "keep"
        ? `<span class="tag tag-keep">KEEP</span>`
        : `<span class="tag tag-other">KEEP</span>`;
    li.className = p.kind === "strip" ? "danger" : p.kind === "keep" ? "ok" : "";
    li.innerHTML = `${tag}<strong>${p.key}</strong> <span>— ${p.label}</span><br><code>${truncateVal(p.value)}</code>`;
    linkParams.appendChild(li);
  }

  // Cleaned URL
  linkCleanWrap.hidden = false;
  linkClean.textContent = a.cleanUrl;
}

async function runLinkAnalysis() {
  const raw = (linkInput.value || "").trim();
  if (!raw) {
    linkVerdict.hidden = false;
    linkVerdict.className = "link-verdict warn";
    linkVerdict.textContent = "Paste a link first.";
    return;
  }
  lastLink = analyzeLink(raw);
  renderLinkAnalysis(lastLink);
  linkExplainBtn.disabled = !!lastLink.error || !(await ensureAiSession());
}

function ruleBasedLinkExplanation(a) {
  if (!a || a.error) return "Analyse a link first.";
  const out = [];
  if (a.provider || a.looksLikeAuth) {
    out.push(`This is a ${a.provider || "sign-in / OAuth"} authentication link. The long codes (things like client_id, code, state, nonce, contextid, uaid) are one-time login tokens the server needs to verify who you are. If you delete them the login will fail — so this link isn't "dirty", it just looks busy.`);
  }
  if (a.trackerCount) {
    const names = a.params.filter((p) => p.kind === "strip").map((p) => p.key).join(", ");
    out.push(`Removable trackers: ${names}. These only exist to record where you came from, so stripping them is safe and improves your privacy. Use the cleaned link below.`);
  } else {
    out.push("There are no advertising/analytics trackers in this link, so there's nothing to strip.");
  }
  if (a.personal) out.push("Heads-up: the link contains a username/email. Avoid sharing it publicly.");
  out.push("(On-device AI wasn't available, so this is the built-in explanation.)");
  return out.join("\n\n");
}

async function explainLinkWithAi() {
  if (!lastLink || lastLink.error) return;
  linkExplanation.hidden = false;
  linkExplanation.textContent = "Thinking on-device…";
  const ok = await ensureAiSession();
  if (!ok) { linkExplanation.textContent = ruleBasedLinkExplanation(lastLink); return; }
  const summary = lastLink.params
    .map((p) => `${p.key} [${p.kind === "strip" ? "tracker" : p.kind === "keep" ? "essential" : "functional"}]`)
    .join(", ") || "no parameters";
  const prompt = `A user pasted this link: host "${lastLink.url.hostname}", path "${lastLink.url.pathname}". ` +
    `Is-login-flow: ${lastLink.looksLikeAuth || !!lastLink.provider}. Parameters: ${summary}. ` +
    `In plain, reassuring language explain which strings are trackers they can safely remove and which are login/functional tokens they must keep (and why removing those would break the page/login). Under 120 words.`;
  try {
    linkExplanation.textContent = await aiSession.prompt(prompt);
  } catch (err) {
    linkExplanation.textContent = ruleBasedLinkExplanation(lastLink) +
      `\n\n(On-device AI error: ${err instanceof Error ? err.message : String(err)})`;
  }
}

/* ------------------------------------------------------------------ */
/* Connectivity Doctor — automated Azure Cloud Shell / WebSocket test  */
/* ------------------------------------------------------------------ */
const CONN_ENDPOINTS = [
  { key: "ws",      kind: "ws",    label: "Cloud Shell terminal (WebSocket)", url: "wss://ux.console.azure.com/" },
  { key: "console", kind: "fetch", label: "Cloud Shell endpoint",            url: "https://ux.console.azure.com/" },
  { key: "relay",   kind: "fetch", label: "ServiceBus relay",                url: "https://gateway.servicebus.windows.net/" },
  { key: "arm",     kind: "fetch", label: "Azure Resource Manager",          url: "https://management.azure.com/" },
  { key: "login",   kind: "fetch", label: "Microsoft sign-in",               url: "https://login.microsoftonline.com/" },
];

// no-cors fetch: resolves (opaque) if the network reached the server — even on
// 4xx/5xx. Rejects only when the proxy/DNS/network actually blocked the request.
function testReachable(url, timeout = 8000) {
  return new Promise((resolve) => {
    const ctrl = new AbortController();
    const start = performance.now();
    const t = setTimeout(() => ctrl.abort(), timeout);
    fetch(url, { mode: "no-cors", cache: "no-store", signal: ctrl.signal })
      .then(() => { clearTimeout(t); resolve({ status: "pass", ms: Math.round(performance.now() - start), detail: "reachable" }); })
      .catch((err) => {
        clearTimeout(t);
        const aborted = err && err.name === "AbortError";
        resolve({ status: "fail", ms: Math.round(performance.now() - start), detail: aborted ? "timed out" : "network/proxy blocked" });
      });
  });
}

// WebSocket handshake timing: a fast close/open means the upgrade reached Azure
// (network allows WebSockets). A timeout means a proxy is stripping/holding it.
function testWebSocketTerminal(url, timeout = 9000) {
  return new Promise((resolve) => {
    let done = false, ws;
    const start = performance.now();
    const finish = (status, detail) => {
      if (done) return; done = true;
      try { ws && ws.close(); } catch { /* ignore */ }
      resolve({ status, detail, ms: Math.round(performance.now() - start) });
    };
    const timer = setTimeout(() => finish("fail", "no response — WebSocket likely stripped/blocked by a proxy"), timeout);
    try {
      ws = new WebSocket(url);
      ws.onopen = () => { clearTimeout(timer); finish("pass", "upgrade accepted"); };
      ws.onclose = () => {
        clearTimeout(timer);
        const ms = performance.now() - start;
        if (ms < 3500) finish("pass", `reached Azure (answered in ${Math.round(ms)}ms)`);
        else finish("warn", `slow response (${Math.round(ms)}ms) — possible interference`);
      };
      ws.onerror = () => { /* let onclose/timeout decide — error alone is ambiguous cross-origin */ };
    } catch (err) {
      clearTimeout(timer);
      finish("fail", "blocked before connect: " + (err instanceof Error ? err.message : String(err)));
    }
  });
}

function connRow(label, r) {
  const li = document.createElement("li");
  const icon = r.status === "pass" ? "PASS" : r.status === "warn" ? "SLOW" : "FAIL";
  const tagCls = r.status === "pass" ? "tag-keep" : r.status === "warn" ? "tag-other" : "tag-strip";
  li.className = r.status === "pass" ? "ok" : r.status === "warn" ? "warn" : "danger";
  li.innerHTML = `<span class="tag ${tagCls}">${icon}</span><strong>${label}</strong> <span>— ${r.detail} (${r.ms}ms)</span>`;
  return li;
}

async function runConnDoctor() {
  connExplanation.hidden = true;
  connVerdict.hidden = true;
  connResults.innerHTML = "";
  connStatus.textContent = "testing…";
  connRetestBtn.disabled = true;

  const results = {};
  await Promise.all(CONN_ENDPOINTS.map(async (ep) => {
    const r = ep.kind === "ws" ? await testWebSocketTerminal(ep.url) : await testReachable(ep.url);
    results[ep.key] = { ...r, label: ep.label, kind: ep.kind };
  }));

  // Render in defined order
  for (const ep of CONN_ENDPOINTS) connResults.appendChild(connRow(ep.label, results[ep.key]));

  lastConn = results;
  connStatus.textContent = "done";
  connRetestBtn.disabled = false;

  // Verdict
  connVerdict.hidden = false;
  const ws = results.ws;
  const blockedFetches = CONN_ENDPOINTS.filter((e) => e.kind === "fetch" && results[e.key].status === "fail");
  if (ws.status === "fail") {
    connVerdict.className = "link-verdict auth";
    connVerdict.innerHTML = `<strong>WebSocket to Cloud Shell is being blocked or stripped.</strong> ` +
      `This is the exact cause of <em>"failed to request a terminal."</em> Your proxy/firewall is decrypting or dropping the <code>wss://</code> upgrade. ` +
      `<strong>Fix:</strong> add <code>*.console.azure.com</code> and <code>*.servicebus.windows.net</code> to the proxy's <strong>do-not-decrypt (SSL-inspection bypass)</strong> list and allow WebSocket pass-through on 443.`;
  } else if (blockedFetches.length) {
    connVerdict.className = "link-verdict warn";
    const names = blockedFetches.map((e) => e.label).join(", ");
    connVerdict.innerHTML = `<strong>WebSocket path is OK, but these endpoints are blocked:</strong> ${names}. ` +
      `Ask your admin to allowlist them on 443. Cloud Shell needs every row green.`;
  } else {
    connVerdict.className = "link-verdict ok";
    connVerdict.innerHTML = `<strong>Network path is clean from this browser.</strong> Cloud Shell's servers and WebSocket terminal are reachable. ` +
      `If it still fails, the problem is your <strong>portal session</strong>, not the network — run a <strong>Deep clean</strong> above (clears portal.azure.com / login cookies), then retry in a fresh tab.`;
  }

  connExplainBtn.disabled = !(await ensureAiSession());
}

function ruleBasedConnExplanation(r) {
  if (!r) return "Run the connectivity test first.";
  const out = [];
  if (r.ws.status === "fail") {
    out.push("Azure Cloud Shell opens a live WebSocket (wss://) tunnel to run the terminal. Your test shows that tunnel isn't getting through — a corporate proxy with SSL inspection is decrypting the traffic, which breaks the WebSocket handshake. That's why you see 'failed to request a terminal'.");
    out.push("Fix: ask IT to add *.console.azure.com and *.servicebus.windows.net to the SSL do-not-decrypt / TLS-inspection bypass list, and allow WebSocket pass-through on port 443.");
    out.push("Instant workaround: open the Azure portal from a phone hotspot or home network — Cloud Shell will work immediately, proving the proxy is the cause. Or run Azure CLI locally instead (az login).");
  } else {
    out.push("Good news: from this browser, Cloud Shell's endpoints and its WebSocket terminal are reachable — the network isn't the blocker.");
    out.push("If Cloud Shell still errors, it's a stale portal session. Run a Deep clean to wipe portal.azure.com and login cookies, then open a fresh tab and retry.");
  }
  out.push("(On-device AI wasn't available, so this is the built-in explanation.)");
  return out.join("\n\n");
}

async function explainConnWithAi() {
  if (!lastConn) return;
  connExplanation.hidden = false;
  connExplanation.textContent = "Thinking on-device…";
  const ok = await ensureAiSession();
  if (!ok) { connExplanation.textContent = ruleBasedConnExplanation(lastConn); return; }
  const summary = CONN_ENDPOINTS.map((e) => `${e.label}: ${lastConn[e.key].status}`).join("; ");
  const prompt = `Azure Cloud Shell connectivity test results from a corporate network: ${summary}. ` +
    `The WebSocket terminal test is the key one. Explain in plain language what is blocking Cloud Shell (likely proxy SSL-inspection breaking the WebSocket), the exact proxy fix (do-not-decrypt + WebSocket pass-through for *.console.azure.com and *.servicebus.windows.net), and a quick workaround. Under 130 words.`;
  try {
    connExplanation.textContent = await aiSession.prompt(prompt);
  } catch (err) {
    connExplanation.textContent = ruleBasedConnExplanation(lastConn) +
      `\n\n(On-device AI error: ${err instanceof Error ? err.message : String(err)})`;
  }
}

/* ------------------------------------------------------------------ */
/* AI File Organizer (File System Access API — non-destructive)        */
/* ------------------------------------------------------------------ */
const FILE_CATEGORIES = [
  { name: "Images",        rx: /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|tiff?|ico|avif)$/i },
  { name: "Documents",     rx: /\.(pdf|docx?|txt|rtf|odt|pages|tex|wpd)$/i },
  { name: "Spreadsheets",  rx: /\.(xlsx?|csv|ods|numbers|tsv)$/i },
  { name: "Presentations", rx: /\.(pptx?|odp|key)$/i },
  { name: "Video",         rx: /\.(mp4|mkv|mov|avi|wmv|webm|flv|m4v|mpe?g)$/i },
  { name: "Audio",         rx: /\.(mp3|wav|flac|aac|ogg|m4a|wma|opus)$/i },
  { name: "Archives",      rx: /\.(zip|rar|7z|tar|gz|bz2|xz|iso)$/i },
  { name: "Installers",    rx: /\.(exe|msi|dmg|pkg|deb|rpm|appimage|apk)$/i },
  { name: "Code",          rx: /\.(js|ts|jsx|tsx|py|java|c|cpp|cs|go|rs|rb|php|html?|css|json|xml|ya?ml|sh|ps1|sql)$/i },
  { name: "Ebooks",        rx: /\.(epub|mobi|azw3?|fb2)$/i },
  { name: "Fonts",         rx: /\.(ttf|otf|woff2?|eot)$/i },
];
const OTHER_CATEGORY = "Other";
const CATEGORY_NAMES = [...FILE_CATEGORIES.map((c) => c.name), OTHER_CATEGORY];

function categorize(name) {
  for (const c of FILE_CATEGORIES) if (c.rx.test(name)) return c.name;
  return OTHER_CATEGORY;
}

function orgSupported() { return typeof window.showDirectoryPicker === "function"; }

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function uniqueName(dirHandle, name) {
  let candidate = name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 1;
  // Loop until getFileHandle throws NotFound (name is free)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try { await dirHandle.getFileHandle(candidate); candidate = `${base} (${i++})${ext}`; }
    catch { return candidate; }
  }
}

async function moveFile(rootDir, subDir, name, fileHandle) {
  const target = await uniqueName(subDir, name);
  if (typeof fileHandle.move === "function") {
    await fileHandle.move(subDir, target);
    return target;
  }
  // Fallback: copy bytes then remove original (relocate — never data-loss)
  const file = await fileHandle.getFile();
  const dest = await subDir.getFileHandle(target, { create: true });
  const writable = await dest.createWritable();
  await writable.write(file);
  await writable.close();
  await rootDir.removeEntry(name);
  return target;
}

function orgAdd(label, value, level = "") {
  const li = document.createElement("li");
  if (level) li.className = level;
  li.innerHTML = `<strong>${label}:</strong> <span>${value}</span>`;
  orgResults.appendChild(li);
}

async function organizeFolder(kind) {
  if (!orgSupported()) return;
  const apply = orgApply.checked;
  const scanDupes = orgDupes.checked;

  let rootDir;
  try {
    rootDir = await window.showDirectoryPicker({
      id: "org-" + kind,
      mode: apply ? "readwrite" : "read",
      startIn: kind === "downloads" ? "downloads" : "documents",
    });
  } catch {
    return; // user cancelled the picker
  }

  orgResults.innerHTML = "";
  orgDash.hidden = true;
  orgVerdict.hidden = true;
  orgExplanation.hidden = true;
  orgStatus.textContent = apply ? "organizing…" : "scanning…";
  orgDownloadsBtn.disabled = orgDocumentsBtn.disabled = true;

  const tally = {};       // category -> { count, bytes }
  const hashes = new Map(); // hash -> [names]
  let scanned = 0, moved = 0, skipped = 0;

  try {
    for await (const [name, handle] of rootDir.entries()) {
      if (handle.kind !== "file") continue;
      if (name.startsWith(".")) continue;
      const cat = categorize(name);
      let size = 0;
      try { size = (await handle.getFile()).size; } catch { /* ignore */ }
      tally[cat] = tally[cat] || { count: 0, bytes: 0 };
      tally[cat].count += 1;
      tally[cat].bytes += size;
      scanned += 1;

      if (scanDupes) {
        try {
          const buf = await (await handle.getFile()).arrayBuffer();
          const h = await sha256Hex(buf);
          if (!hashes.has(h)) hashes.set(h, []);
          hashes.get(h).push(name);
        } catch { /* ignore unreadable */ }
      }

      if (apply) {
        try {
          const sub = await rootDir.getDirectoryHandle(cat, { create: true });
          await moveFile(rootDir, sub, name, handle);
          moved += 1;
        } catch { skipped += 1; }
      }
    }

    // Dashboard
    orgDash.hidden = false;
    orgDash.innerHTML = "";
    for (const cat of CATEGORY_NAMES) {
      const t = tally[cat];
      if (!t) continue;
      const card = document.createElement("div");
      card.className = "org-card";
      card.innerHTML = `<div class="cat">${cat}</div><div class="meta">${t.count} file${t.count === 1 ? "" : "s"} · ${fmtBytes(t.bytes)}</div>`;
      orgDash.appendChild(card);
    }

    // Results
    orgAdd("Folder", rootDir.name);
    orgAdd("Files scanned", String(scanned), scanned ? "ok" : "warn");
    if (apply) {
      orgAdd("Files moved into type folders", String(moved), moved ? "ok" : "");
      if (skipped) orgAdd("Skipped (in use / locked)", String(skipped), "warn");
    } else {
      orgAdd("Mode", "Preview only — nothing was moved", "warn");
    }

    // Duplicates (flag only — never delete)
    const dupeGroups = [...hashes.values()].filter((arr) => arr.length > 1);
    const dupeFiles = dupeGroups.reduce((s, a) => s + (a.length - 1), 0);
    if (scanDupes) {
      orgAdd("Duplicate sets found", String(dupeGroups.length), dupeGroups.length ? "danger" : "ok");
      for (const g of dupeGroups.slice(0, 8)) orgAdd("• Identical", g.join("  ·  "), "warn");
    }

    lastOrg = { folder: rootDir.name, kind, apply, scanned, moved, tally, dupeGroups: dupeGroups.length, dupeFiles };

    // Verdict
    orgVerdict.hidden = false;
    orgVerdict.className = "link-verdict " + (apply ? "ok" : "auth");
    orgVerdict.innerHTML = apply
      ? `<strong>Done.</strong> Sorted <strong>${moved}</strong> file${moved === 1 ? "" : "s"} in <em>${rootDir.name}</em> into type folders — nothing deleted.` +
        (dupeFiles ? ` Also flagged <strong>${dupeFiles}</strong> duplicate file${dupeFiles === 1 ? "" : "s"} you could remove to reclaim space.` : "")
      : `<strong>Preview ready.</strong> Found <strong>${scanned}</strong> file${scanned === 1 ? "" : "s"} across <strong>${Object.keys(tally).length}</strong> categories in <em>${rootDir.name}</em>. ` +
        `Tick <em>"Actually move files"</em> and run again to sort them (still no deletions).`;

    orgStatus.textContent = "done";
    orgExplainBtn.disabled = !(await ensureAiSession());
  } catch (err) {
    orgAdd("Organizer error", err instanceof Error ? err.message : String(err), "danger");
    orgStatus.textContent = "error";
  } finally {
    orgDownloadsBtn.disabled = orgDocumentsBtn.disabled = false;
  }
}

function ruleBasedOrgExplanation(o) {
  if (!o) return "Organize a folder first.";
  const top = Object.entries(o.tally).sort((a, b) => b[1].count - a[1].count).slice(0, 3)
    .map(([k, v]) => `${k} (${v.count})`).join(", ");
  const out = [];
  out.push(`In "${o.folder}" your biggest groups are: ${top || "none"}.`);
  if (o.dupeFiles) out.push(`You have ${o.dupeFiles} duplicate file(s) taking up space — safe to delete the extra copies since identical originals remain.`);
  out.push(o.apply
    ? "Files are now sorted into type folders. Tip: re-run monthly, or grab the desktop .exe to automate it in the background."
    : "This was a preview. Enable 'Actually move files' to sort them — nothing gets deleted, only relocated.");
  out.push("(On-device AI wasn't available, so this is the built-in recommendation.)");
  return out.join("\n\n");
}

async function explainOrgWithAi() {
  if (!lastOrg) return;
  orgExplanation.hidden = false;
  orgExplanation.textContent = "Thinking on-device…";
  const ok = await ensureAiSession();
  if (!ok) { orgExplanation.textContent = ruleBasedOrgExplanation(lastOrg); return; }
  const cats = Object.entries(lastOrg.tally).map(([k, v]) => `${k}:${v.count}`).join(", ");
  const prompt = `A user organized their "${lastOrg.folder}" folder. Category counts: ${cats}. Duplicate files: ${lastOrg.dupeFiles}. ` +
    `Give short, friendly recommendations on how to keep it tidy, what to archive or delete (duplicates), and a good folder routine. Under 120 words.`;
  try {
    orgExplanation.textContent = await aiSession.prompt(prompt);
  } catch (err) {
    orgExplanation.textContent = ruleBasedOrgExplanation(lastOrg) +
      `\n\n(On-device AI error: ${err instanceof Error ? err.message : String(err)})`;
  }
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

// Smart Link Cleaner wiring
linkAnalyzeBtn.addEventListener("click", runLinkAnalysis);
linkExplainBtn.addEventListener("click", explainLinkWithAi);
linkPasteBtn.addEventListener("click", async () => {
  try { linkInput.value = await navigator.clipboard.readText(); await runLinkAnalysis(); }
  catch { linkInput.focus(); }
});
linkCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(linkClean.textContent || "");
    linkCopyBtn.textContent = "Copied ✓";
    setTimeout(() => (linkCopyBtn.textContent = "Copy"), 1500);
  } catch { linkCopyBtn.textContent = "Copy failed"; setTimeout(() => (linkCopyBtn.textContent = "Copy"), 1500); }
});

// Connectivity Doctor wiring
connRetestBtn.addEventListener("click", runConnDoctor);
connExplainBtn.addEventListener("click", explainConnWithAi);

// Organizer wiring
orgDownloadsBtn.addEventListener("click", () => organizeFolder("downloads"));
orgDocumentsBtn.addEventListener("click", () => organizeFolder("documents"));
orgExplainBtn.addEventListener("click", explainOrgWithAi);
if (orgSupported()) { orgControls.hidden = false; } else { orgUnsupported.hidden = false; }

// Tab navigation
function activateTab(tab) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll("[data-group]").forEach((s) => s.classList.toggle("show", s.dataset.group === tab));
}
document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => activateTab(b.dataset.tab)));
activateTab("clean");

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
renderDnsCommands();
wireOpenButtons();
refreshEstimateBadge();
detectAi();
runConnDoctor(); // automatic on load

if ("serviceWorker" in navigator) {
  const updateBtn = $("app-update");
  let refreshing = false;

  // When the new SW takes control, reload once to load fresh assets.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const showUpdate = (worker) => {
    if (!updateBtn || !worker) return;
    updateBtn.hidden = false;
    updateBtn.onclick = () => {
      updateBtn.textContent = "Updating…";
      worker.postMessage({ type: "SKIP_WAITING" });
    };
  };

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");

      // An update is already waiting from a previous visit.
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);

      // A new version is being installed right now.
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdate(nw);
        });
      });

      // Automatic update checks: every 60s and whenever the tab regains focus.
      setInterval(() => reg.update().catch(() => {}), 60000);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    } catch { /* offline cache optional */ }
  });
}
