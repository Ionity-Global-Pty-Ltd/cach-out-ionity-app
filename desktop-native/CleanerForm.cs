using System.Diagnostics;
using System.Security.Principal;

namespace CachOutIonity.Native;

internal sealed class CleanerForm : Form
{
    private readonly Color _bg = Color.FromArgb(11, 13, 18);
    private readonly Color _surface = Color.FromArgb(14, 17, 23);
    private readonly Color _purple = Color.FromArgb(87, 70, 227);
    private readonly Color _teal = Color.FromArgb(0, 212, 184);
    private readonly Color _text = Color.FromArgb(231, 235, 242);
    private readonly Color _muted = Color.FromArgb(139, 147, 164);

    private readonly CheckedListBox _options = new();
    private readonly CheckBox _closeBrowsers = new();
    private readonly RichTextBox _log = new();
    private readonly Button _runButton = new();
    private readonly Dictionary<string, Func<Task>> _actions = new();

    internal CleanerForm()
    {
        Text = "CACH OUT Ionity";
        StartPosition = FormStartPosition.CenterScreen;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new Size(760, 620);
        BackColor = _bg;
        ForeColor = _text;
        Font = new Font("Segoe UI", 9f);

        BuildLayout();
        BuildActions();
    }

    private void BuildLayout()
    {
        var title = new Label
        {
            Text = "CACH OUT",
            Font = new Font("Segoe UI", 22, FontStyle.Bold),
            ForeColor = _teal,
            AutoSize = true,
            Location = new Point(18, 12),
        };
        Controls.Add(title);

        var brand = new Label
        {
            Text = "IONITY GLOBAL  ·  ionity.today",
            ForeColor = _muted,
            AutoSize = true,
            Location = new Point(22, 58),
        };
        Controls.Add(brand);

        var admin = new Label
        {
            AutoSize = true,
            ForeColor = IsAdmin() ? _teal : _muted,
            Text = IsAdmin() ? "● Administrator" : "● Limited (admin needed for some network resets)",
            Location = new Point(440, 24),
        };
        Controls.Add(admin);

        var group = new GroupBox
        {
            Text = "What to clean",
            ForeColor = _muted,
            Location = new Point(18, 90),
            Size = new Size(724, 280),
        };
        Controls.Add(group);

        _options.BackColor = _surface;
        _options.ForeColor = _text;
        _options.BorderStyle = BorderStyle.FixedSingle;
        _options.Location = new Point(14, 24);
        _options.Size = new Size(694, 240);
        group.Controls.Add(_options);

        AddOption("FlushDns", "Flush DNS resolver cache");
        AddOption("TempFiles", "Clear temp files (user + Windows Temp)");
        AddOption("Chrome", "Clear Google Chrome cache + cookies");
        AddOption("Edge", "Clear Microsoft Edge cache + cookies");
        AddOption("Brave", "Clear Brave cache + cookies");
        AddOption("Firefox", "Clear Firefox cache");
        AddOption("Thumbnails", "Clear Windows thumbnail cache files");
        AddOption("ArpCache", "Flush ARP cache");
        AddOption("Winsock", "Reset Winsock catalog (reboot required)");
        AddOption("RenewIp", "Release + renew IP address");

        _closeBrowsers.Text = "Force-close browsers before clearing locked cookie files";
        _closeBrowsers.ForeColor = _muted;
        _closeBrowsers.AutoSize = true;
        _closeBrowsers.Checked = true;
        _closeBrowsers.Location = new Point(18, 380);
        Controls.Add(_closeBrowsers);

        _log.Location = new Point(18, 410);
        _log.Size = new Size(724, 150);
        _log.BackColor = _surface;
        _log.ForeColor = _text;
        _log.Font = new Font("Consolas", 9f);
        _log.ReadOnly = true;
        Controls.Add(_log);

        _runButton.Text = "CACH OUT NOW";
        _runButton.Size = new Size(724, 42);
        _runButton.Location = new Point(18, 570);
        _runButton.FlatStyle = FlatStyle.Flat;
        _runButton.FlatAppearance.BorderSize = 0;
        _runButton.BackColor = _purple;
        _runButton.ForeColor = Color.White;
        _runButton.Font = new Font("Segoe UI", 11f, FontStyle.Bold);
        _runButton.Click += async (_, _) => await RunCleanupAsync();
        Controls.Add(_runButton);
    }

    private void AddOption(string key, string label)
    {
        _options.Items.Add(new OptionItem(key, label), true);
    }

    private void BuildActions()
    {
        _actions["FlushDns"] = async () =>
        {
            Log("Flushing DNS...");
            await RunCommandAsync("ipconfig", "/flushdns", requireAdmin: false);
        };

        _actions["TempFiles"] = () =>
        {
            Log("Clearing temp files...");
            var removed = 0;
            removed += RemoveChildrenSafe(Path.GetTempPath());
            removed += RemoveChildrenSafe(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Temp"));
            Log($"  removed {removed} items", _teal);
            return Task.CompletedTask;
        };

        _actions["Chrome"] = () => ClearChromiumAsync("chrome", Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "User Data"));
        _actions["Edge"] = () => ClearChromiumAsync("msedge", Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "User Data"));
        _actions["Brave"] = () => ClearChromiumAsync("brave", Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BraveSoftware", "Brave-Browser", "User Data"));

        _actions["Firefox"] = async () =>
        {
            Log("Firefox...");
            if (_closeBrowsers.Checked)
            {
                StopBrowserProcesses("firefox");
            }

            var cacheRoot = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Mozilla", "Firefox", "Profiles");
            if (!Directory.Exists(cacheRoot))
            {
                Log("  skipped (not installed)", _muted);
                return;
            }

            var removed = 0;
            foreach (var profile in Directory.GetDirectories(cacheRoot))
            {
                removed += RemoveChildrenSafe(Path.Combine(profile, "cache2"));
            }
            Log($"  removed {removed} items", _teal);
            await Task.CompletedTask;
        };

        _actions["Thumbnails"] = () =>
        {
            Log("Clearing thumbnail cache...");
            var explorer = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Microsoft", "Windows", "Explorer");
            if (!Directory.Exists(explorer))
            {
                Log("  skipped", _muted);
                return Task.CompletedTask;
            }

            var removed = 0;
            foreach (var file in Directory.EnumerateFiles(explorer, "thumbcache_*.db"))
            {
                try
                {
                    File.Delete(file);
                    removed++;
                }
                catch (Exception ex)
                {
                    Log($"  skip {Path.GetFileName(file)}: {ex.Message}", Color.IndianRed);
                }
            }
            Log($"  removed {removed} files", _teal);
            return Task.CompletedTask;
        };

        _actions["ArpCache"] = async () =>
        {
            Log("Flushing ARP cache...");
            await RunCommandAsync("netsh", "interface ip delete arpcache", requireAdmin: true);
        };

        _actions["Winsock"] = async () =>
        {
            Log("Resetting Winsock...");
            await RunCommandAsync("netsh", "winsock reset", requireAdmin: true);
            Log("  reboot required after Winsock reset", _muted);
        };

        _actions["RenewIp"] = async () =>
        {
            Log("Renewing IP...");
            await RunCommandAsync("ipconfig", "/release", requireAdmin: true);
            await RunCommandAsync("ipconfig", "/renew", requireAdmin: true);
        };
    }

    private async Task RunCleanupAsync()
    {
        _runButton.Enabled = false;
        _log.Clear();
        Log($"=== CACH OUT started {DateTime.Now:HH:mm:ss} ===", _teal);

        var selected = _options.CheckedItems.Cast<OptionItem>().ToList();
        foreach (var item in selected)
        {
            if (_actions.TryGetValue(item.Key, out var action))
            {
                try
                {
                    await action();
                }
                catch (Exception ex)
                {
                    Log($"  error: {ex.Message}", Color.IndianRed);
                }
            }
        }

        Log("=== Done ===", _teal);
        _runButton.Enabled = true;
    }

    private async Task ClearChromiumAsync(string processName, string userDataRoot)
    {
        Log($"{processName}...");
        if (_closeBrowsers.Checked)
        {
            StopBrowserProcesses(processName);
        }

        if (!Directory.Exists(userDataRoot))
        {
            Log("  skipped (not installed)", _muted);
            return;
        }

        var removed = 0;
        var targets = new[] { "Cache", "Code Cache", "GPUCache", "Service Worker", "Network" };

        foreach (var profile in Directory.EnumerateDirectories(userDataRoot))
        {
            var name = Path.GetFileName(profile);
            if (!string.Equals(name, "Default", StringComparison.OrdinalIgnoreCase)
                && !name.StartsWith("Profile ", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            foreach (var target in targets)
            {
                removed += RemoveChildrenSafe(Path.Combine(profile, target));
            }

            if (_closeBrowsers.Checked)
            {
                removed += DeleteFileSafe(Path.Combine(profile, "Network", "Cookies"));
                removed += DeleteFileSafe(Path.Combine(profile, "Network", "Cookies-journal"));
            }
        }

        Log($"  removed {removed} items", _teal);
        await Task.CompletedTask;
    }

    private async Task RunCommandAsync(string fileName, string args, bool requireAdmin)
    {
        if (requireAdmin && !IsAdmin())
        {
            Log("  needs Administrator - skipped", _muted);
            return;
        }

        using var p = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = args,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            }
        };

        p.Start();
        var stdout = await p.StandardOutput.ReadToEndAsync();
        var stderr = await p.StandardError.ReadToEndAsync();
        await p.WaitForExitAsync();

        var output = string.Join(" ", new[] { stdout, stderr })
            .Replace(Environment.NewLine, " ", StringComparison.Ordinal)
            .Trim();
        if (string.IsNullOrWhiteSpace(output))
        {
            output = p.ExitCode == 0 ? "ok" : $"exit code {p.ExitCode}";
        }

        if (p.ExitCode == 0)
        {
            Log($"  {output}", _teal);
        }
        else
        {
            Log($"  {output}", Color.IndianRed);
        }
    }

    private int RemoveChildrenSafe(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
        {
            return 0;
        }

        var removed = 0;
        foreach (var entry in Directory.EnumerateFileSystemEntries(path))
        {
            try
            {
                if (Directory.Exists(entry))
                {
                    Directory.Delete(entry, recursive: true);
                }
                else
                {
                    File.Delete(entry);
                }
                removed++;
            }
            catch (Exception ex)
            {
                Log($"  skip {Path.GetFileName(entry)}: {ex.Message}", _muted);
            }
        }
        return removed;
    }

    private int DeleteFileSafe(string path)
    {
        if (!File.Exists(path))
        {
            return 0;
        }

        try
        {
            File.Delete(path);
            return 1;
        }
        catch (Exception ex)
        {
            Log($"  skip {Path.GetFileName(path)}: {ex.Message}", _muted);
            return 0;
        }
    }

    private void StopBrowserProcesses(string processName)
    {
        foreach (var proc in Process.GetProcessesByName(processName))
        {
            try
            {
                proc.CloseMainWindow();
            }
            catch (Exception ex)
            {
                Log($"  close {processName}: {ex.Message}", _muted);
            }
        }

        Thread.Sleep(500);

        foreach (var proc in Process.GetProcessesByName(processName))
        {
            try
            {
                proc.Kill(entireProcessTree: true);
            }
            catch (Exception ex)
            {
                Log($"  kill {processName}: {ex.Message}", _muted);
            }
        }
    }

    private bool IsAdmin()
    {
        using var identity = WindowsIdentity.GetCurrent();
        var principal = new WindowsPrincipal(identity);
        return principal.IsInRole(WindowsBuiltInRole.Administrator);
    }

    private void Log(string message, Color? color = null)
    {
        _log.SelectionStart = _log.TextLength;
        _log.SelectionColor = color ?? _text;
        _log.AppendText(message + Environment.NewLine);
        _log.ScrollToCaret();
        Application.DoEvents();
    }

    private sealed record OptionItem(string Key, string Label)
    {
        public override string ToString() => Label;
    }
}
