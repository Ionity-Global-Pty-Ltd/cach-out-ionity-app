const deepCleanButton = document.querySelector("#deep-clean");
const sanitizeButton = document.querySelector("#sanitize-url");
const installButton = document.querySelector("#install-app");
const removeAllQueryParamsInput = document.querySelector("#remove-all-query-params");
const resultList = document.querySelector("#result-list");
const lastRun = document.querySelector("#last-run");

const trackingParams = new Set([
  "gclid",
  "fbclid",
  "msclkid",
  "mkt_tok",
  "mc_eid",
  "mc_cid",
  "_hsenc",
  "_hsmi",
  "ga_source",
  "ga_medium",
  "ga_term",
  "ga_content",
  "ga_campaign"
]);

let installPromptEvent = null;

function addResult(label, value) {
  const listItem = document.createElement("li");
  listItem.innerHTML = `<strong>${label}:</strong> <span>${value}</span>`;
  resultList.appendChild(listItem);
}

function resetResults() {
  resultList.innerHTML = "";
}

function setLastRunLabel() {
  const time = new Date().toLocaleString();
  lastRun.textContent = `Completed at ${time}`;
}

function setButtonsDisabled(disabled) {
  deepCleanButton.disabled = disabled;
  sanitizeButton.disabled = disabled;
}

function getDomainCandidates(hostname) {
  const parts = hostname.split(".").filter(Boolean);
  const domains = new Set([hostname]);

  for (let index = 1; index < parts.length - 1; index += 1) {
    domains.add(`.${parts.slice(index).join(".")}`);
  }

  return [...domains];
}

function clearCookieJar() {
  const cookieEntries = document.cookie ? document.cookie.split(";") : [];
  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  const host = window.location.hostname;
  const domains = getDomainCandidates(host);
  const paths = ["/", window.location.pathname || "/"];
  let attempts = 0;

  for (const cookie of cookieEntries) {
    const separatorIndex = cookie.indexOf("=");
    const rawName = separatorIndex >= 0 ? cookie.slice(0, separatorIndex).trim() : cookie.trim();

    if (!rawName) {
      continue;
    }

    for (const path of paths) {
      document.cookie = `${rawName}=; expires=${expires}; path=${path}`;
      document.cookie = `${rawName}=; expires=${expires}; path=${path}; secure; samesite=lax`;
      attempts += 2;

      for (const domain of domains) {
        document.cookie = `${rawName}=; expires=${expires}; path=${path}; domain=${domain}`;
        document.cookie = `${rawName}=; expires=${expires}; path=${path}; domain=${domain}; secure; samesite=lax`;
        attempts += 2;
      }
    }
  }

  return { detected: cookieEntries.length, attempts };
}

function clearWebStorage() {
  const localStorageEntries = window.localStorage.length;
  const sessionStorageEntries = window.sessionStorage.length;
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.name = "";
  return { localStorageEntries, sessionStorageEntries };
}

async function clearCacheStorage() {
  if (!("caches" in window)) {
    return { supported: false, deleted: 0 };
  }

  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  return { supported: true, deleted: cacheKeys.length };
}

async function clearIndexedDatabases() {
  if (!("indexedDB" in window) || typeof indexedDB.databases !== "function") {
    return { supported: false, deleted: 0 };
  }

  const databases = await indexedDB.databases();
  const names = [...new Set(databases.map((db) => db.name).filter(Boolean))];

  await Promise.all(names.map((name) => new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete IndexedDB database: ${name}`));
    request.onblocked = () => resolve();
  })));

  return { supported: true, deleted: names.length };
}

async function unregisterServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return { supported: false, removed: 0 };
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  return { supported: true, removed: registrations.length };
}

function sanitizeUrl({ removeAllParams }) {
  const currentUrl = new URL(window.location.href);
  const original = currentUrl.toString();
  const removedKeys = [];

  for (const [key] of [...currentUrl.searchParams.entries()]) {
    const lowerKey = key.toLowerCase();
    const isTrackingParam = lowerKey.startsWith("utm_") || trackingParams.has(lowerKey);

    if (removeAllParams || isTrackingParam) {
      removedKeys.push(key);
      currentUrl.searchParams.delete(key);
    }
  }

  if (currentUrl.hash) {
    removedKeys.push("#hash");
    currentUrl.hash = "";
  }

  const sanitized = currentUrl.toString();
  if (sanitized !== original) {
    window.history.replaceState({}, "", sanitized);
  }

  return { removedCount: removedKeys.length, sanitized };
}

async function runDeepClean() {
  resetResults();
  setButtonsDisabled(true);

  try {
    const removeAllParams = removeAllQueryParamsInput.checked;

    const cookieResult = clearCookieJar();
    const webStorageResult = clearWebStorage();
    const [cacheResult, indexedDbResult, serviceWorkerResult] = await Promise.all([
      clearCacheStorage(),
      clearIndexedDatabases(),
      unregisterServiceWorkers()
    ]);
    const urlResult = sanitizeUrl({ removeAllParams });

    addResult("Cookies detected", String(cookieResult.detected));
    addResult("Cookie delete attempts", String(cookieResult.attempts));
    addResult("Local storage entries cleared", String(webStorageResult.localStorageEntries));
    addResult("Session storage entries cleared", String(webStorageResult.sessionStorageEntries));
    addResult("CacheStorage buckets deleted", cacheResult.supported ? String(cacheResult.deleted) : "Not supported in this browser");
    addResult("IndexedDB databases deleted", indexedDbResult.supported ? String(indexedDbResult.deleted) : "Not supported in this browser");
    addResult("Service workers unregistered", serviceWorkerResult.supported ? String(serviceWorkerResult.removed) : "Not supported in this browser");
    addResult("URL strings removed", String(urlResult.removedCount));
    addResult("Current sanitized URL", urlResult.sanitized);

    setLastRunLabel();
  } catch (error) {
    addResult("Cleanup error", error instanceof Error ? error.message : String(error));
  } finally {
    setButtonsDisabled(false);
  }
}

function runUrlSanitizeOnly() {
  resetResults();
  const removeAllParams = removeAllQueryParamsInput.checked;
  const urlResult = sanitizeUrl({ removeAllParams });

  addResult("URL strings removed", String(urlResult.removedCount));
  addResult("Current sanitized URL", urlResult.sanitized);
  setLastRunLabel();
}

deepCleanButton.addEventListener("click", runDeepClean);
sanitizeButton.addEventListener("click", runUrlSanitizeOnly);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPromptEvent = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!installPromptEvent) {
    return;
  }

  installPromptEvent.prompt();
  await installPromptEvent.userChoice;
  installPromptEvent = null;
  installButton.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installPromptEvent = null;
  installButton.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      addResult("Service worker registration", error instanceof Error ? error.message : String(error));
    }
  });
}
