using System.Diagnostics;
using System.Drawing;
using System.Security.Principal;
using System.Windows.Forms;

namespace CachOutIonity;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
        Application.Run(new MainForm());
    }
}

/// <summary>A single cleanup task the user can toggle.</summary>
internal sealed class CleanTask
{
    public required string Key;
    public required string Label;
    public required string Category;
    public bool DefaultOn = true;
    public bool NeedsAdmin;
    public required Action<Logger, bool> Run;   // (logger, forceCloseBrowsers)
    public CheckBox? Box;
}

internal sealed class Logger
{
    private readonly RichTextBox _box;
    public Logger(RichTextBox box) => _box = box;

    public void Line(string msg, Color? color = null)
    {
        _box.SelectionStart = _box.TextLength;
        _box.SelectionColor = color ?? Theme.Text;
        _box.AppendText(msg + "\n");
        _box.ScrollToCaret();
        Application.DoEvents();
    }
    public void Ok(string msg) => Line("  " + msg, Theme.Teal);
    public void Muted(string msg) => Line("  " + msg, Theme.Muted);
    public void Err(string msg) => Line("  " + msg, Color.IndianRed);
}

internal static class Theme
{
    public static readonly Color Bg = Color.FromArgb(11, 13, 18);
    public static readonly Color Surface = Color.FromArgb(21, 25, 34);
    public static readonly Color Surface2 = Color.FromArgb(14, 17, 23);
    public static readonly Color Purple = Color.FromArgb(87, 70, 227);
    public static readonly Color Teal = Color.FromArgb(0, 212, 184);
    public static readonly Color Text = Color.FromArgb(231, 235, 242);
    public static readonly Color Muted = Color.FromArgb(139, 147, 164);
}

internal sealed class MainForm : Form
{
    private readonly RichTextBox _log = new();
    private readonly CheckBox _closeBrowsers = new();
    private readonly Button _runBtn = new();
    private readonly List<CleanTask> _tasks;
    private Logger _logger = null!;

    public MainForm()
    {
        _tasks = CleanTasks.Build();
        BuildUi();
    }

    private static bool IsAdmin()
    {
        using var id = WindowsIdentity.GetCurrent();
        return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
    }

    private void BuildUi()
    {
        Text = "CACH OUT Ionity";
        Size = new Size(600, 760);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Theme.Bg;
        ForeColor = Theme.Text;
        Font = new Font("Segoe UI", 9f);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        try { Icon = new Icon("app.ico"); } catch { /* icon embedded anyway */ }

        var title = new Label
        {
            Text = "CACH OUT",
            Font = new Font("Segoe UI", 22f, FontStyle.Bold),
            ForeColor = Theme.Teal,
            AutoSize = true,
            Location = new Point(20, 14),
        };
        Controls.Add(title);

        var brand = new Label
        {
            Text = "IONITY GLOBAL  ·  ionity.co.za",
            ForeColor = Theme.Muted,
            AutoSize = true,
            Location = new Point(23, 58),
        };
        Controls.Add(brand);

        var admin = new Label { AutoSize = true, Location = new Point(360, 22) };
        if (IsAdmin()) { admin.Text = "● Administrator"; admin.ForeColor = Theme.Teal; }
        else { admin.Text = "● Limited (some resets need admin)"; admin.ForeColor = Theme.Muted; }
        Controls.Add(admin);

        // Scrollable options area grouped by category
        var group = new GroupBox
        {
            Text = "What to clean",
            ForeColor = Theme.Muted,
            Location = new Point(20, 88),
            Size = new Size(545, 380),
        };
        Controls.Add(group);

        var panel = new Panel
        {
            Location = new Point(10, 22),
            Size = new Size(525, 348),
            AutoScroll = true,
            BackColor = Theme.Bg,
        };
        group.Controls.Add(panel);

        int y = 6;
        string? lastCat = null;
        foreach (var t in _tasks)
        {
            if (t.Category != lastCat)
            {
                var head = new Label
                {
                    Text = "▸ " + t.Category,
                    ForeColor = Theme.Teal,
                    Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                    AutoSize = true,
                    Location = new Point(6, y + 6),
                };
                panel.Controls.Add(head);
                y += 30;
                lastCat = t.Category;
            }

            var cb = new CheckBox
            {
                Text = t.Label + (t.NeedsAdmin ? "   (admin)" : ""),
                ForeColor = Theme.Text,
                AutoSize = true,
                Location = new Point(20, y),
                Checked = t.DefaultOn,
            };
            panel.Controls.Add(cb);
            t.Box = cb;
            y += 26;
        }

        _closeBrowsers.Text = "Force-close browsers before clearing (required to remove locked cookie files)";
        _closeBrowsers.ForeColor = Theme.Muted;
        _closeBrowsers.AutoSize = true;
        _closeBrowsers.Location = new Point(20, 476);
        _closeBrowsers.Checked = true;
        Controls.Add(_closeBrowsers);

        // Select all / defaults quick actions
        var selAll = MakeLink("Select all", new Point(20, 502), () => SetAll(true));
        var selNone = MakeLink("Clear all", new Point(110, 502), () => SetAll(false));
        var selDef = MakeLink("Defaults", new Point(190, 502), ResetDefaults);
        Controls.Add(selAll); Controls.Add(selNone); Controls.Add(selDef);

        _log.Location = new Point(20, 528);
        _log.Size = new Size(545, 148);
        _log.BackColor = Theme.Surface2;
        _log.ForeColor = Theme.Text;
        _log.Font = new Font("Consolas", 9f);
        _log.ReadOnly = true;
        _log.BorderStyle = BorderStyle.None;
        Controls.Add(_log);
        _logger = new Logger(_log);

        _runBtn.Text = "⚡  CACH OUT NOW";
        _runBtn.Size = new Size(545, 46);
        _runBtn.Location = new Point(20, 686);
        _runBtn.FlatStyle = FlatStyle.Flat;
        _runBtn.FlatAppearance.BorderSize = 0;
        _runBtn.BackColor = Theme.Purple;
        _runBtn.ForeColor = Color.White;
        _runBtn.Font = new Font("Segoe UI", 12f, FontStyle.Bold);
        _runBtn.Cursor = Cursors.Hand;
        _runBtn.Click += RunAll;
        Controls.Add(_runBtn);
    }

    private LinkLabel MakeLink(string text, Point loc, Action onClick)
    {
        var l = new LinkLabel
        {
            Text = text,
            AutoSize = true,
            Location = loc,
            LinkColor = Theme.Teal,
            ActiveLinkColor = Theme.Purple,
        };
        l.LinkClicked += (_, _) => onClick();
        return l;
    }

    private void SetAll(bool on) { foreach (var t in _tasks) if (t.Box != null) t.Box.Checked = on; }
    private void ResetDefaults() { foreach (var t in _tasks) if (t.Box != null) t.Box.Checked = t.DefaultOn; }

    private void RunAll(object? sender, EventArgs e)
    {
        _runBtn.Enabled = false;
        _log.Clear();
        _logger.Line($"=== CACH OUT started {DateTime.Now:HH:mm:ss} ===", Theme.Teal);
        bool force = _closeBrowsers.Checked;
        foreach (var t in _tasks)
        {
            if (t.Box is not { Checked: true }) continue;
            try { t.Run(_logger, force); }
            catch (Exception ex) { _logger.Err("error: " + ex.Message); }
        }
        _logger.Line("=== Done ===", Theme.Teal);
        _runBtn.Enabled = true;
    }
}
