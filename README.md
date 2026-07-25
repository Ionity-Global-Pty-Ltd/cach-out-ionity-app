# CACH OUT Ionity App

Public Progressive Web App branded with the official **IONITY Global** design tokens and AI brand mark (ionity.co.za / ionity.today).

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
