namespace CachOutIonity;

/// <summary>
/// Safely appends a curated tracker block to the Windows hosts file.
/// Backs up once, is idempotent (wrapped in markers), and never removes
/// existing host entries.
/// </summary>
internal static class HostsBlocker
{
    private const string Begin = "# === IONITY CACH OUT tracker block (begin) ===";
    private const string End = "# === IONITY CACH OUT tracker block (end) ===";

    // Curated advertising / analytics / telemetry domains.
    private static readonly string[] Domains =
    {
        "google-analytics.com", "www.google-analytics.com", "ssl.google-analytics.com",
        "analytics.google.com", "googletagmanager.com", "www.googletagmanager.com",
        "doubleclick.net", "stats.g.doubleclick.net", "ad.doubleclick.net",
        "googlesyndication.com", "pagead2.googlesyndication.com", "googleadservices.com",
        "connect.facebook.net", "pixel.facebook.com", "an.facebook.com",
        "graph.facebook.com", "analytics.tiktok.com", "ads.tiktok.com",
        "business-api.tiktok.com", "px.ads.linkedin.com", "analytics.pointdrive.linkedin.com",
        "static.ads-twitter.com", "ads-api.twitter.com", "analytics.twitter.com",
        "bat.bing.com", "c.bing.com", "hotjar.com", "static.hotjar.com",
        "script.hotjar.com", "in.hotjar.com", "cdn.mxpnl.com", "api.mixpanel.com",
        "amplitude.com", "api.amplitude.com", "cdn.amplitude.com",
        "segment.com", "api.segment.io", "cdn.segment.com",
        "scorecardresearch.com", "sb.scorecardresearch.com", "quantserve.com",
        "quantcount.com", "crwdcntrl.net", "adnxs.com", "adsrvr.org",
        "outbrain.com", "taboola.com", "cdn.taboola.com", "criteo.com",
        "static.criteo.net", "rubiconproject.com", "pubmatic.com",
        "app.link", "branch.io", "cdn.branch.io", "fullstory.com",
        "rs.fullstory.com", "clarity.ms", "c.clarity.ms",
    };

    /// <returns>Number of domains in the block, or -1 on failure.</returns>
    public static int Apply(Logger log)
    {
        var hosts = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.Windows),
            "System32\\drivers\\etc\\hosts");

        try
        {
            string current = File.Exists(hosts) ? File.ReadAllText(hosts) : "";

            // One-time backup
            var backup = hosts + ".ionity.bak";
            if (!File.Exists(backup) && File.Exists(hosts))
            {
                File.Copy(hosts, backup);
                log.Muted("backed up original hosts → hosts.ionity.bak");
            }

            // Strip any previous IONITY block so re-runs stay idempotent
            int bi = current.IndexOf(Begin, StringComparison.Ordinal);
            int ei = current.IndexOf(End, StringComparison.Ordinal);
            if (bi >= 0 && ei > bi)
            {
                current = current.Remove(bi, (ei - bi) + End.Length);
                current = current.TrimEnd() + "\n";
            }

            var block = new System.Text.StringBuilder();
            block.Append('\n').Append(Begin).Append('\n');
            block.Append("# Reversible: delete everything between these markers, or restore hosts.ionity.bak\n");
            foreach (var d in Domains)
            {
                block.Append("0.0.0.0 ").Append(d).Append('\n');
            }
            block.Append(End).Append('\n');

            File.WriteAllText(hosts, current.TrimEnd() + "\n" + block.ToString());

            // Flush DNS so the block takes effect immediately
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo("ipconfig", "/flushdns")
                { UseShellExecute = false, CreateNoWindow = true };
                System.Diagnostics.Process.Start(psi)?.WaitForExit(10000);
            }
            catch { }

            return Domains.Length;
        }
        catch (Exception ex)
        {
            log.Err("hosts update failed: " + ex.Message);
            return -1;
        }
    }
}
