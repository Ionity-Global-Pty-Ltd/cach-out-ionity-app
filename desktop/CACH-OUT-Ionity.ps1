<#
  CACH OUT Ionity — Desktop cleaner (Windows)
  Ionity Global (Pty) Ltd · ionity.today

  A no-install WinForms GUI that performs real OS-level cleanup:
  DNS flush, browser cache/cookies, temp files, thumbnail cache,
  Winsock/ARP reset, and IP renew.

  Run via CACH-OUT-Ionity.bat (self-elevates to Administrator).
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# ── Brand palette ──────────────────────────────────────────────
$cBg      = [System.Drawing.Color]::FromArgb(11, 13, 18)
$cSurface = [System.Drawing.Color]::FromArgb(21, 25, 34)
$cSurface2= [System.Drawing.Color]::FromArgb(14, 17, 23)
$cPurple  = [System.Drawing.Color]::FromArgb(87, 70, 227)
$cTeal    = [System.Drawing.Color]::FromArgb(0, 212, 184)
$cText    = [System.Drawing.Color]::FromArgb(231, 235, 242)
$cMuted   = [System.Drawing.Color]::FromArgb(139, 147, 164)

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ── Form ───────────────────────────────────────────────────────
$form = New-Object System.Windows.Forms.Form
$form.Text = "CACH OUT Ionity"
$form.Size = New-Object System.Drawing.Size(560, 640)
$form.StartPosition = "CenterScreen"
$form.BackColor = $cBg
$form.ForeColor = $cText
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

$title = New-Object System.Windows.Forms.Label
$title.Text = "CACH OUT"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $cTeal
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(20, 14)
$form.Controls.Add($title)

$brand = New-Object System.Windows.Forms.Label
$brand.Text = "IONITY GLOBAL  ·  ionity.today"
$brand.ForeColor = $cMuted
$brand.AutoSize = $true
$brand.Location = New-Object System.Drawing.Point(23, 58)
$form.Controls.Add($brand)

$adminLbl = New-Object System.Windows.Forms.Label
$adminLbl.AutoSize = $true
$adminLbl.Location = New-Object System.Drawing.Point(360, 24)
if (Test-Admin) { $adminLbl.Text = "● Administrator"; $adminLbl.ForeColor = $cTeal }
else { $adminLbl.Text = "● Limited (run as admin`nfor DNS/Winsock)"; $adminLbl.ForeColor = $cMuted }
$form.Controls.Add($adminLbl)

# ── Options group ──────────────────────────────────────────────
$group = New-Object System.Windows.Forms.GroupBox
$group.Text = "What to clean"
$group.ForeColor = $cMuted
$group.Location = New-Object System.Drawing.Point(20, 90)
$group.Size = New-Object System.Drawing.Size(505, 300)
$form.Controls.Add($group)

$options = [ordered]@{
  "FlushDns"     = "Flush DNS resolver cache (ipconfig /flushdns)"
  "TempFiles"    = "Clear temp files (user + Windows Temp)"
  "Chrome"       = "Clear Google Chrome cache + cookies"
  "Edge"         = "Clear Microsoft Edge cache + cookies"
  "Brave"        = "Clear Brave cache + cookies"
  "Firefox"      = "Clear Firefox cache"
  "Thumbnails"   = "Clear Windows thumbnail cache"
  "ArpCache"     = "Flush ARP cache (netsh)"
  "Winsock"      = "Reset Winsock catalog (needs reboot)"
  "RenewIp"      = "Release + renew IP address"
}
$defaults = @("FlushDns","TempFiles","Chrome","Edge","Brave","Firefox","Thumbnails","ArpCache")

$checks = @{}
$y = 26
foreach ($key in $options.Keys) {
  $cb = New-Object System.Windows.Forms.CheckBox
  $cb.Text = $options[$key]
  $cb.ForeColor = $cText
  $cb.AutoSize = $true
  $cb.Location = New-Object System.Drawing.Point(16, $y)
  $cb.Checked = $defaults -contains $key
  $group.Controls.Add($cb)
  $checks[$key] = $cb
  $y += 27
}

$closeCb = New-Object System.Windows.Forms.CheckBox
$closeCb.Text = "Force-close browsers before clearing (required to remove locked files)"
$closeCb.ForeColor = $cMuted
$closeCb.AutoSize = $true
$closeCb.Location = New-Object System.Drawing.Point(20, 398)
$closeCb.Checked = $true
$form.Controls.Add($closeCb)

# ── Log box ────────────────────────────────────────────────────
$log = New-Object System.Windows.Forms.RichTextBox
$log.Location = New-Object System.Drawing.Point(20, 428)
$log.Size = New-Object System.Drawing.Size(505, 120)
$log.BackColor = $cSurface2
$log.ForeColor = $cText
$log.Font = New-Object System.Drawing.Font("Consolas", 9)
$log.ReadOnly = $true
$form.Controls.Add($log)

function Write-Log($msg, $color = $cText) {
  $log.SelectionStart = $log.TextLength
  $log.SelectionColor = $color
  $log.AppendText("$msg`n")
  $log.ScrollToCaret()
  [System.Windows.Forms.Application]::DoEvents()
}

# ── Cleanup helpers ────────────────────────────────────────────
function Remove-PathSafe($path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return 0 }
  if (-not (Test-Path $path)) { return 0 }
  $count = 0
  Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue | ForEach-Object {
    try { Remove-Item $_.FullName -Recurse -Force -ErrorAction Stop; $count++ } catch {}
  }
  return $count
}

function Stop-Browser($name) {
  Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
    try { $_.CloseMainWindow() | Out-Null } catch {}
  }
  Start-Sleep -Milliseconds 400
  Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
    try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } catch {}
  }
}

function Clear-ChromiumProfile($root, $procName) {
  if ($closeCb.Checked) { Stop-Browser $procName }
  if (-not (Test-Path $root)) { Write-Log "  skipped (not installed)" $cMuted; return }
  $targets = @("Cache","Code Cache","GPUCache","Service Worker","Network")
  $total = 0
  Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "Default" -or $_.Name -like "Profile *" } | ForEach-Object {
      foreach ($t in $targets) { $total += Remove-PathSafe (Join-Path $_.FullName $t) }
      # Cookies live in a locked DB; only removable when browser closed
      if ($closeCb.Checked) {
        foreach ($c in @("Cookies","Cookies-journal")) {
          $cp = Join-Path (Join-Path $_.FullName "Network") $c
          if (Test-Path $cp) { try { Remove-Item $cp -Force -ErrorAction Stop; $total++ } catch {} }
        }
      }
    }
  Write-Log "  removed $total items" $cTeal
}

# ── Actions ────────────────────────────────────────────────────
$actions = @{
  FlushDns = {
    Write-Log "Flushing DNS…"
    $out = ipconfig /flushdns 2>&1
    Write-Log "  $($out | Select-String 'Successfully' | ForEach-Object { $_.Line.Trim() })" $cTeal
  }
  TempFiles = {
    Write-Log "Clearing temp files…"
    $n = 0
    $n += Remove-PathSafe $env:TEMP
    $n += Remove-PathSafe "C:\Windows\Temp"
    Write-Log "  removed $n items" $cTeal
  }
  Chrome    = { Write-Log "Chrome…"; Clear-ChromiumProfile "$env:LOCALAPPDATA\Google\Chrome\User Data" "chrome" }
  Edge      = { Write-Log "Edge…";   Clear-ChromiumProfile "$env:LOCALAPPDATA\Microsoft\Edge\User Data" "msedge" }
  Brave     = { Write-Log "Brave…";  Clear-ChromiumProfile "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data" "brave" }
  Firefox   = {
    Write-Log "Firefox…"
    if ($closeCb.Checked) { Stop-Browser "firefox" }
    $profiles = "$env:APPDATA\Mozilla\Firefox\Profiles"
    $cacheRoot = "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles"
    $n = 0
    if (Test-Path $cacheRoot) {
      Get-ChildItem $cacheRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $n += Remove-PathSafe (Join-Path $_.FullName "cache2")
      }
    }
    if (-not (Test-Path $profiles)) { Write-Log "  skipped (not installed)" $cMuted } else { Write-Log "  removed $n items" $cTeal }
  }
  Thumbnails = {
    Write-Log "Clearing thumbnail cache…"
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    $n = 0
    Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter "thumbcache_*.db" -ErrorAction SilentlyContinue |
      ForEach-Object { try { Remove-Item $_.FullName -Force -ErrorAction Stop; $n++ } catch {} }
    Start-Process explorer
    Write-Log "  removed $n cache files" $cTeal
  }
  ArpCache = {
    Write-Log "Flushing ARP cache…"
    $out = netsh interface ip delete arpcache 2>&1
    Write-Log "  $($out -join ' ')" $cTeal
  }
  Winsock = {
    Write-Log "Resetting Winsock…"
    if (-not (Test-Admin)) { Write-Log "  needs Administrator — skipped" $cMuted; return }
    $out = netsh winsock reset 2>&1
    Write-Log "  done (reboot required)" $cTeal
  }
  RenewIp = {
    Write-Log "Renewing IP…"
    ipconfig /release 2>&1 | Out-Null
    ipconfig /renew 2>&1 | Out-Null
    Write-Log "  done" $cTeal
  }
}

# ── Run button ─────────────────────────────────────────────────
$runBtn = New-Object System.Windows.Forms.Button
$runBtn.Text = "⚡  CACH OUT NOW"
$runBtn.Size = New-Object System.Drawing.Size(505, 46)
$runBtn.Location = New-Object System.Drawing.Point(20, 560)
$runBtn.FlatStyle = "Flat"
$runBtn.FlatAppearance.BorderSize = 0
$runBtn.BackColor = $cPurple
$runBtn.ForeColor = [System.Drawing.Color]::White
$runBtn.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$runBtn.Cursor = "Hand"
$form.Controls.Add($runBtn)

$runBtn.Add_Click({
  $runBtn.Enabled = $false
  $log.Clear()
  Write-Log "=== CACH OUT started $(Get-Date -Format 'HH:mm:ss') ===" $cTeal
  foreach ($key in $options.Keys) {
    if ($checks[$key].Checked) {
      try { & $actions[$key] } catch { Write-Log "  error: $($_.Exception.Message)" ([System.Drawing.Color]::IndianRed) }
    }
  }
  Write-Log "=== Done ===" $cTeal
  $runBtn.Enabled = $true
})

[void]$form.ShowDialog()
