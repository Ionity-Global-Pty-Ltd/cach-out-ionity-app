// CACH OUT Ionity — extension popup logic
// Uses the official chrome.browsingData API to clear data across ALL sites.

const $ = (sel) => document.querySelector(sel);
const status = $("#status");
const cachOutBtn = $("#cach-out");

// Data types that browsingData.remove() accepts as its dataToRemove object.
const SAFE_DEFAULTS = new Set([
  "cache", "cacheStorage", "cookies", "localStorage", "indexedDB", "serviceWorkers",
]);

function selectedTypes() {
  const dataToRemove = {};
  document.querySelectorAll('.types input[data-type]').forEach((el) => {
    dataToRemove[el.dataset.type] = el.checked;
  });
  return dataToRemove;
}

function anySelected(types) {
  return Object.values(types).some(Boolean);
}

function setStatus(msg, isError = false) {
  status.textContent = msg;
  status.classList.toggle("error", isError);
}

async function reloadAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    let reloaded = 0;
    for (const tab of tabs) {
      if (tab.id == null) continue;
      const url = tab.url || "";
      // Skip internal pages that cannot be scripted/reloaded meaningfully.
      if (/^(chrome|edge|about|chrome-extension|devtools):/i.test(url)) continue;
      try { await chrome.tabs.reload(tab.id, { bypassCache: true }); reloaded += 1; } catch { /* ignore */ }
    }
    return reloaded;
  } catch {
    return 0;
  }
}

async function cachOut() {
  const types = selectedTypes();
  if (!anySelected(types)) {
    setStatus("Select at least one data type.", true);
    return;
  }

  const since = Number($("#range").value) === 0 ? 0 : Date.now() - Number($("#range").value);

  cachOutBtn.disabled = true;
  setStatus("Cleaning…");

  try {
    await chrome.browsingData.remove(
      { since },
      types
    );

    const cleared = Object.entries(types).filter(([, v]) => v).map(([k]) => k);
    let msg = `✓ Cleared ${cleared.length} data types.`;

    if ($("#reload-tabs").checked) {
      const n = await reloadAllTabs();
      msg += ` Reloaded ${n} tab${n === 1 ? "" : "s"}.`;
    }
    setStatus(msg);
  } catch (err) {
    setStatus("Error: " + (err?.message || String(err)), true);
  } finally {
    cachOutBtn.disabled = false;
  }
}

function applyPreset(all) {
  document.querySelectorAll('.types input[data-type]').forEach((el) => {
    el.checked = all ? true : SAFE_DEFAULTS.has(el.dataset.type);
  });
}

cachOutBtn.addEventListener("click", cachOut);
$("#select-all").addEventListener("click", () => applyPreset(true));
$("#select-safe").addEventListener("click", () => applyPreset(false));
