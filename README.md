# CACH OUT Ionity App

Public Progressive Web App branded for **IONITY.co.za**.  
It helps users clear site data fast:

- Cookies for the current site domain/path scope
- LocalStorage and SessionStorage
- CacheStorage buckets
- IndexedDB databases (when supported)
- Service worker registrations
- Tracking query strings and URL hash fragments

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
- Browsers do not allow a site to clear **global browser cache** outside its own scope.
- Some browsers do not expose IndexedDB database listing APIs; the app reports this when unsupported.
