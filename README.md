# CACH OUT Ionity App

Public Progressive Web App branded with the official **IONITY Global** design tokens and AI brand mark (ionity.co.za / ionity.today).

## Two ways to use it

**1. Browser extension (recommended — clears ALL sites).**
See [`extension/`](./extension). Uses Chrome/Edge's official `browsingData` API to wipe
cache, cookies, storage, IndexedDB and service workers across every site, and can reload
all open tabs afterwards. Load unpacked from `chrome://extensions` (Developer mode).

**2. Web PWA (this site — clears its own origin only).**
A hosted page that resets its own site data and runs the on-device AI advisor. Browser
security prevents any web page from touching other sites' data, so for cross-site cleaning
use the extension above.

## Three ways to run it

| | Clears | Best for |
| --- | --- | --- |
| **Windows desktop app** ([`desktop/`](./desktop)) | DNS cache, every browser's cache/cookies, temp + thumbnail cache, Winsock/ARP, IP renew | Full OS-level reset |
| **Browser extension** ([`extension/`](./extension)) | Cache, cookies, storage, IndexedDB, service workers across **all** sites | Cross-site browser cleanup |
| **Web PWA** (this site) | This site's own data only + on-device AI advisor | Quick per-site reset |

Download the desktop app: **[CACH-OUT-Ionity.exe](https://github.com/Ionity-Global-Pty-Ltd/cach-out-ionity-app/releases/latest/download/CACH-OUT-Ionity.exe)** — double-click, approve the admin prompt, done. (Script version: [`cach-out-ionity-desktop.zip`](./cach-out-ionity-desktop.zip).)

## Features

**Deep clean (selectable):**
- Cookies for the current site domain/path scope
- LocalStorage, SessionStorage and `window.name`
- CacheStorage buckets
- IndexedDB databases (when supported)
- Service worker registrations
- Tracking query strings and URL hash fragments
- Optional hard reload that bypasses the HTTP cache
- Reports storage **reclaimed** via the Storage Estimate API

**🤖 AI Privacy Advisor (100% on-device):**
- Scans this site's cookies + storage and classifies **known trackers** (Google Analytics/Ads, Meta Pixel, Hotjar, TikTok, LinkedIn, HubSpot, Mixpanel, Segment, and more)
- Produces a **privacy score** with a visual ring and recommendations
- "Explain with AI" uses the browser's built-in on-device model (Chrome/Edge **Prompt API / Gemini Nano**) when available, with a rule-based fallback that always works — nothing is ever uploaded

**🌐 DNS flush & OS-level reset:**
- Copy-ready DNS flush commands for Windows, macOS and Linux
- Shortcuts to the browser's internal DNS pages (`chrome://net-internals/#dns`, Firefox, Edge)

## Why this app exists

When portal sessions, cached headers, tracking strings, or stale site data cause login/deployment issues, this app gives a one-click cleanup workflow.

## Run locally

Open `index.html` directly, or serve with any static server.

## Deploy on GitHub Pages

1. Push to `main` (or `master`).
2. In repository settings, open **Pages** and set **Build and deployment** to **GitHub Actions**.
3. The workflow `.github/workflows/deploy-pages.yml` deploys this app automatically.

## Important limits

- Browsers do not allow JavaScript to clear **HttpOnly** cookies.
- Browsers do not allow a site to clear the **OS DNS cache** or **global browser cache** outside its own scope — use the DNS panel commands for that.
- Some browsers do not expose IndexedDB database listing APIs; the app reports this when unsupported.
- On-device AI requires a browser with the built-in Prompt API enabled; otherwise the rule-based advisor is used automatically.
