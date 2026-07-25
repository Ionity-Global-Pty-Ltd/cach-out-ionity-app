# CACH OUT Ionity — Desktop mini-app (Windows)

A no-install cleaner that does the **OS-level** things a web page or extension can't:
flush DNS, wipe every browser's cache/cookies, clear temp + thumbnail caches, reset
Winsock/ARP and renew your IP — all from one branded window.

## Run it

1. Download this `desktop/` folder (or `cach-out-ionity-desktop.zip` and unzip it).
2. Double-click **`CACH-OUT-Ionity.bat`**.
3. Approve the Administrator prompt (needed for DNS / Winsock / renew IP).
4. Tick what you want, then click **⚡ CACH OUT NOW**.

No installation, no dependencies — it's a signed-by-you PowerShell GUI that runs on any
Windows 10/11 machine.

## What it can clean

| Action | Needs admin |
| --- | --- |
| Flush DNS resolver cache | recommended |
| Clear temp files (user + Windows) | no |
| Chrome / Edge / Brave cache + cookies | no (auto-closes browser) |
| Firefox cache | no |
| Windows thumbnail cache | no |
| Flush ARP cache | yes |
| Reset Winsock (reboot after) | yes |
| Release + renew IP | yes |

> Browser cookies are locked while the browser is open, so leave **"Force-close browsers"**
> ticked to fully remove them.

## Notes

- It only deletes cache/cookie/temp locations — it never touches your documents or bookmarks.
- "Reset Winsock" requires a **reboot** to take effect.
- If a file is in use it's skipped safely and reported in the log.

© Ionity Global (Pty) Ltd · ionity.today
