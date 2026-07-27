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
| **Windows desktop app** ([`desktop-net/`](./desktop-net)) | DNS/ARP/NetBIOS/Winsock, every browser's cache/cookies, temp/thumbnail/prefetch/font/Windows-Update caches, SSL & certificate cache, trusted-root refresh, optional reversible tracker blocking | Full OS-level reset |
| **Browser extension** ([`extension/`](./extension)) | Cache, cookies, storage, IndexedDB, service workers across **all** sites | Cross-site browser cleanup |
| **Web PWA** (this site) | This site's own data only + on-device AI advisor | Quick per-site reset |

Download the desktop app: **[CACH-OUT-Ionity.exe](https://github.com/Ionity-Global-Pty-Ltd/cach-out-ionity-app/releases/latest/download/CACH-OUT-Ionity.exe)** — double-click, approve the admin prompt, done.

Desktop release note (v2.0.0): the `.exe` is now a **real compiled .NET 10 / C# WinForms application** (source in [`desktop-net/`](./desktop-net)), self-contained (no .NET install needed) and **digitally signed** by *Ionity Global (Pty) Ltd* with a SHA-256 timestamp. This replaces the earlier PowerShell-packaged build, which was the main cause of antivirus false positives. Each release ships a `SHA256SUMS.txt` checksum and a publisher certificate (`IonityGlobal-CodeSigning.cer` + `Trust-Publisher.ps1`) so you can verify and trust the publisher.

## Features

The web app is organised into **tabs**:

**🧹 Privacy Reset** — deep clean of this site's cookies/storage/caches/service workers, an on-device **AI Privacy Advisor** (privacy score + tracker detection), the **AI Smart Link Cleaner** (paste any URL — it labels each string as a *tracker to strip* or a *login token to keep*, and outputs a clean shareable link), and DNS/OS reset commands.

**🔌 Cloud Shell** — an automated **Connectivity Doctor** that runs on load and tests whether Azure Cloud Shell's endpoints and its **WebSocket terminal** are reachable from your network, pinpointing the proxy/SSL-inspection block behind *"failed to request a terminal"* and giving the exact fix.

**🗂️ AI File Organizer** — using the browser's File System Access API (Chrome/Edge desktop), it sorts your **Downloads** and **Documents** folders into type folders (Images, Documents, Video, Audio, Archives, Installers…), flags **duplicate files** by content hash, shows a size-per-category dashboard, and gives AI tidy-up recommendations. It **never deletes** anything — it only relocates, and always offers a safe preview first.

## Deep clean details

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
