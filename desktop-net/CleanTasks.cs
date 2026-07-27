using System.Diagnostics;
using System.Security.Principal;

namespace CachOutIonity;

/// <summary>All cleanup operations, grouped by category.</summary>
internal static class CleanTasks
{
    private static string Local => Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    private static string Roaming => Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
    private static string Windows => Environment.GetFolderPath(Environment.SpecialFolder.Windows);

    private static bool IsAdmin()
    {
        using var id = WindowsIdentity.GetCurrent();
        return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
    }

    // ---- shared helpers ---------------------------------------------------
    private static int RemoveContents(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path)) return 0;
        int count = 0;
        foreach (var entry in Directory.EnumerateFileSystemEntries(path))
        {
            try
            {
                var attr = File.GetAttributes(entry);
                if ((attr & FileAttributes.Directory) == FileAttributes.Directory)
                    Directory.Delete(entry, true);
                else
                    File.Delete(entry);
                count++;
            }
            catch { /* locked/in-use — skip */ }
        }
        return count;
    }

    private static long DirSize(string path)
    {
        if (!Directory.Exists(path)) return 0;
        long total = 0;
        try
        {
            foreach (var f in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
            {
                try { total += new FileInfo(f).Length; } catch { }
            }
        }
        catch { }
        return total;
    }

    private static string FmtBytes(long b)
    {
        string[] u = { "B", "KB", "MB", "GB" };
        double v = b; int i = 0;
        while (v >= 1024 && i < u.Length - 1) { v /= 1024; i++; }
        return $"{v:0.#} {u[i]}";
    }

    private static (int code, string output) RunProcess(string exe, string args)
    {
        try
        {
            var psi = new ProcessStartInfo(exe, args)
            {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi)!;
            string outp = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
            p.WaitForExit(60000);
            return (p.ExitCode, outp.Trim());
        }
        catch (Exception ex) { return (-1, ex.Message); }
    }

    private static void StopBrowser(string proc)
    {
        foreach (var p in Process.GetProcessesByName(proc))
        {
            try { p.CloseMainWindow(); } catch { }
        }
        Thread.Sleep(400);
        foreach (var p in Process.GetProcessesByName(proc))
        {
            try { p.Kill(true); } catch { }
        }
    }

    private static void ClearChromium(Logger log, string root, string proc, bool force)
    {
        if (force) StopBrowser(proc);
        if (!Directory.Exists(root)) { log.Muted("skipped (not installed)"); return; }
        string[] targets = { "Cache", "Code Cache", "GPUCache", "Service Worker", "Network\\Cache", "DawnGraphiteCache", "DawnWebGPUCache" };
        int total = 0;
        foreach (var dir in Directory.EnumerateDirectories(root))
        {
            var name = Path.GetFileName(dir);
            if (name != "Default" && !name.StartsWith("Profile ")) continue;
            foreach (var t in targets) total += RemoveContents(Path.Combine(dir, t));
            if (force)
            {
                foreach (var c in new[] { "Cookies", "Cookies-journal" })
                {
                    var cp = Path.Combine(dir, "Network", c);
                    try { if (File.Exists(cp)) { File.Delete(cp); total++; } } catch { }
                }
            }
        }
        log.Ok($"removed {total} items");
    }

    // ---- task list --------------------------------------------------------
    public static List<CleanTask> Build()
    {
        var list = new List<CleanTask>();

        // ═══ Network ═══
        list.Add(new CleanTask
        {
            Key = "FlushDns", Category = "Network reset", Label = "Flush DNS resolver cache",
            Run = (log, _) => { log.Line("Flushing DNS…"); var r = RunProcess("ipconfig", "/flushdns"); log.Ok(r.code == 0 ? "DNS cache flushed" : r.output); }
        });
        list.Add(new CleanTask
        {
            Key = "RegisterDns", Category = "Network reset", Label = "Re-register DNS", DefaultOn = false,
            Run = (log, _) => { log.Line("Registering DNS…"); RunProcess("ipconfig", "/registerdns"); log.Ok("done"); }
        });
        list.Add(new CleanTask
        {
            Key = "ArpCache", Category = "Network reset", Label = "Flush ARP cache", NeedsAdmin = true,
            Run = (log, _) => { log.Line("Flushing ARP cache…"); if (!IsAdmin()) { log.Muted("needs admin — skipped"); return; } RunProcess("netsh", "interface ip delete arpcache"); log.Ok("ARP cache flushed"); }
        });
        list.Add(new CleanTask
        {
            Key = "NetBios", Category = "Network reset", Label = "Purge & reload NetBIOS name cache", DefaultOn = false,
            Run = (log, _) => { log.Line("Reloading NetBIOS cache…"); RunProcess("nbtstat", "-R"); RunProcess("nbtstat", "-RR"); log.Ok("done"); }
        });
        list.Add(new CleanTask
        {
            Key = "Winsock", Category = "Network reset", Label = "Reset Winsock catalog (reboot required)", DefaultOn = false, NeedsAdmin = true,
            Run = (log, _) => { log.Line("Resetting Winsock…"); if (!IsAdmin()) { log.Muted("needs admin — skipped"); return; } RunProcess("netsh", "winsock reset"); log.Ok("done (reboot required)"); }
        });
        list.Add(new CleanTask
        {
            Key = "RenewIp", Category = "Network reset", Label = "Release + renew IP address", DefaultOn = false,
            Run = (log, _) => { log.Line("Renewing IP…"); RunProcess("ipconfig", "/release"); RunProcess("ipconfig", "/renew"); log.Ok("done"); }
        });

        // ═══ Browsers ═══
        list.Add(new CleanTask { Key = "Chrome", Category = "Browsers", Label = "Clear Google Chrome cache + cookies",
            Run = (log, f) => { log.Line("Chrome…"); ClearChromium(log, Path.Combine(Local, "Google\\Chrome\\User Data"), "chrome", f); } });
        list.Add(new CleanTask { Key = "Edge", Category = "Browsers", Label = "Clear Microsoft Edge cache + cookies",
            Run = (log, f) => { log.Line("Edge…"); ClearChromium(log, Path.Combine(Local, "Microsoft\\Edge\\User Data"), "msedge", f); } });
        list.Add(new CleanTask { Key = "Brave", Category = "Browsers", Label = "Clear Brave cache + cookies",
            Run = (log, f) => { log.Line("Brave…"); ClearChromium(log, Path.Combine(Local, "BraveSoftware\\Brave-Browser\\User Data"), "brave", f); } });
        list.Add(new CleanTask { Key = "Firefox", Category = "Browsers", Label = "Clear Firefox cache",
            Run = (log, f) => {
                log.Line("Firefox…");
                if (f) StopBrowser("firefox");
                var cacheRoot = Path.Combine(Local, "Mozilla\\Firefox\\Profiles");
                var profRoot = Path.Combine(Roaming, "Mozilla\\Firefox\\Profiles");
                int n = 0;
                if (Directory.Exists(cacheRoot))
                    foreach (var d in Directory.EnumerateDirectories(cacheRoot)) n += RemoveContents(Path.Combine(d, "cache2"));
                if (!Directory.Exists(profRoot)) log.Muted("skipped (not installed)"); else log.Ok($"removed {n} items");
            } });

        // ═══ System junk ═══
        list.Add(new CleanTask { Key = "TempFiles", Category = "System junk", Label = "Clear temp files (user + Windows Temp)",
            Run = (log, _) => { log.Line("Clearing temp files…"); int n = RemoveContents(Path.GetTempPath()) + RemoveContents(Path.Combine(Windows, "Temp")); log.Ok($"removed {n} items"); } });
        list.Add(new CleanTask { Key = "Thumbnails", Category = "System junk", Label = "Clear Windows thumbnail cache",
            Run = (log, _) => {
                log.Line("Clearing thumbnail cache…");
                foreach (var p in Process.GetProcessesByName("explorer")) { try { p.Kill(); } catch { } }
                Thread.Sleep(500);
                int n = 0;
                var dir = Path.Combine(Local, "Microsoft\\Windows\\Explorer");
                if (Directory.Exists(dir))
                    foreach (var f in Directory.EnumerateFiles(dir, "thumbcache_*.db"))
                    { try { File.Delete(f); n++; } catch { } }
                try { Process.Start(new ProcessStartInfo("explorer") { UseShellExecute = true }); } catch { }
                log.Ok($"removed {n} cache files");
            } });
        list.Add(new CleanTask { Key = "Prefetch", Category = "System junk", Label = "Clear Windows prefetch data", DefaultOn = false, NeedsAdmin = true,
            Run = (log, _) => { log.Line("Clearing prefetch…"); if (!IsAdmin()) { log.Muted("needs admin — skipped"); return; } int n = RemoveContents(Path.Combine(Windows, "Prefetch")); log.Ok($"removed {n} items"); } });
        list.Add(new CleanTask { Key = "FontCache", Category = "System junk", Label = "Clear font cache", DefaultOn = false, NeedsAdmin = true,
            Run = (log, _) => {
                log.Line("Clearing font cache…");
                if (!IsAdmin()) { log.Muted("needs admin — skipped"); return; }
                RunProcess("net", "stop FontCache");
                int n = RemoveContents(Path.Combine(Local, "Microsoft\\Windows\\Fonts"));
                var sc = Path.Combine(Windows, "ServiceProfiles\\LocalService\\AppData\\Local\\FontCache");
                n += RemoveContents(sc);
                RunProcess("net", "start FontCache");
                log.Ok($"removed {n} items");
            } });
        list.Add(new CleanTask { Key = "WuCache", Category = "System junk", Label = "Clear Windows Update download cache", DefaultOn = false, NeedsAdmin = true,
            Run = (log, _) => {
                log.Line("Clearing Windows Update cache…");
                if (!IsAdmin()) { log.Muted("needs admin — skipped"); return; }
                RunProcess("net", "stop wuauserv");
                RunProcess("net", "stop bits");
                int n = RemoveContents(Path.Combine(Windows, "SoftwareDistribution\\Download"));
                RunProcess("net", "start wuauserv");
                RunProcess("net", "start bits");
                log.Ok($"removed {n} items");
            } });

        // ═══ Certificates & SSL ═══
        list.Add(new CleanTask { Key = "SslState", Category = "Certificates & SSL", Label = "Clear SSL state & certificate URL cache",
            Run = (log, _) => {
                log.Line("Clearing SSL / certificate URL cache…");
                RunProcess("certutil", "-urlcache * delete");
                RunProcess("certutil", "-setreg chain\\ChainCacheResyncFiletime @now");
                log.Ok("SSL state cleared");
            } });
        list.Add(new CleanTask { Key = "CryptoCache", Category = "Certificates & SSL", Label = "Clear cryptographic URL cache (CryptnetUrlCache)",
            Run = (log, _) => {
                log.Line("Clearing CryptnetUrlCache…");
                int n = 0;
                var low = Path.Combine(Local, "..\\LocalLow\\Microsoft\\CryptnetUrlCache");
                n += RemoveContents(Path.Combine(low, "Content"));
                n += RemoveContents(Path.Combine(low, "MetaData"));
                log.Ok($"removed {n} items");
            } });
        list.Add(new CleanTask { Key = "UpdateCerts", Category = "Certificates & SSL", Label = "Refresh trusted root certificates from Windows Update", DefaultOn = false, NeedsAdmin = true,
            Run = (log, _) => {
                log.Line("Refreshing root certificates from Windows Update…");
                if (!IsAdmin()) { log.Muted("needs admin — skipped"); return; }
                var tmp = Path.Combine(Path.GetTempPath(), "ionity-roots-" + Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(tmp);
                try
                {
                    var r = RunProcess("certutil", $"-syncWithWU -f \"{tmp}\"");
                    int added = 0;
                    foreach (var crt in Directory.EnumerateFiles(tmp, "*.crt"))
                    {
                        var a = RunProcess("certutil", $"-addstore -f Root \"{crt}\"");
                        if (a.code == 0) added++;
                    }
                    log.Ok(added > 0 ? $"synced & installed {added} root certs (HTTPS/TLS trust refreshed)" : "sync complete");
                }
                finally { try { Directory.Delete(tmp, true); } catch { } }
            } });

        // ═══ Privacy / tracker blocking ═══
        list.Add(new CleanTask { Key = "BlockTrackers", Category = "Privacy (advanced)", Label = "Block known trackers via hosts file (reversible, backed up)", DefaultOn = false, NeedsAdmin = true,
            Run = (log, _) => {
                log.Line("Updating hosts file tracker block…");
                if (!IsAdmin()) { log.Muted("needs admin — skipped"); return; }
                int added = HostsBlocker.Apply(log);
                log.Ok(added >= 0 ? $"tracker block active ({added} domains). Backup: hosts.ionity.bak" : "failed");
            } });

        return list;
    }
}
