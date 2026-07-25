# CACH OUT Ionity — Browser Extension

This is the **working** cross-site cleaner. Unlike a web page (which can only clear its
own origin), this extension uses the official Chromium **`browsingData`** API to clear
data across **every site** in your browser — cache, cookies, local storage, IndexedDB,
service workers and more — in one click.

Works in **Chrome, Edge, Brave, Opera** and any Chromium browser (Manifest V3).

## Install (Load unpacked)

1. Download / clone this repo.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select this `extension/` folder.
5. Pin **CACH OUT Ionity** and click it — choose your time range and data types, then
   hit **⚡ CACH OUT now**.

Prefer a single file? Use `cach-out-ionity-extension.zip` (unzip first, then Load unpacked).

## What it clears

| Option | Scope |
| --- | --- |
| Browser cache | All sites |
| CacheStorage (PWA) | All sites |
| Cookies | All sites |
| Local / session storage | All sites |
| IndexedDB | All sites |
| Service workers | All sites |
| File systems, WebSQL, form data | All sites (optional) |
| Download / browsing history, passwords | Browser-wide (optional, off by default) |

You can also **reload all open tabs** (bypassing cache) right after cleaning, so every
site reconnects fresh.

## Why the PWA can't do this

Browser security isolates every website to its own origin. A page served from one domain
has **no API** — not even with a permission prompt — to wipe another site's cookies or
cache. Only a browser **extension** is granted that power, which is exactly what this is.

© Ionity Global (Pty) Ltd · ionity.today
