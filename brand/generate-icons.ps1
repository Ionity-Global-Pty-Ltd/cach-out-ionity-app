<#
  Generate the full CACH OUT Ionity icon set from the OFFICIAL IONITY logo.
  Source: brand/source/ionity-logo-hires.png (transparent, official brand asset)
  Produces uniform square icons on the IONITY dark/purple/teal brand background.
#>
Add-Type -AssemblyName System.Drawing

$app = Split-Path -Parent $PSScriptRoot
$src = Join-Path $app "brand\source\ionity-logo-hires.png"
if (-not (Test-Path $src)) { throw "Missing source logo: $src" }

# Render one square branded icon at a given size.
function New-BrandIcon([int]$size, [bool]$maskable = $false) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'

  # IONITY dark base
  $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $baseBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(11, 13, 18))
  $g.FillRectangle($baseBrush, $rect)

  # Purple glow (top-left) + teal glow (bottom-right) using radial path gradients
  foreach ($glow in @(
    @{ cx = $size * 0.20; cy = $size * 0.10; col = [System.Drawing.Color]::FromArgb(150, 87, 70, 227); r = $size * 0.85 },
    @{ cx = $size * 0.90; cy = $size * 0.95; col = [System.Drawing.Color]::FromArgb(90, 0, 212, 184); r = $size * 0.80 }
  )) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [int]($glow.r * 2)
    $path.AddEllipse([int]($glow.cx - $glow.r), [int]($glow.cy - $glow.r), $d, $d)
    $pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $pgb.CenterColor = $glow.col
    $pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $glow.col.R, $glow.col.G, $glow.col.B))
    $g.FillRectangle($pgb, $rect)
    $pgb.Dispose(); $path.Dispose()
  }

  # Center the transparent logo, contain-fit with padding.
  $logo = [System.Drawing.Image]::FromFile($src)
  $pad = if ($maskable) { $size * 0.18 } else { $size * 0.06 }
  $avail = $size - ($pad * 2)
  $scale = [Math]::Min($avail / $logo.Width, $avail / $logo.Height)
  $w = $logo.Width * $scale
  $h = $logo.Height * $scale
  $x = ($size - $w) / 2
  $y = ($size - $h) / 2
  $g.DrawImage($logo, $x, $y, $w, $h)
  $logo.Dispose()

  $g.Dispose()
  $baseBrush.Dispose()
  return $bmp
}

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  "  {0}  ({1}x{1})" -f (Split-Path -Leaf $path), $bmp.Width
}

# ---- Web / PWA icons ----
$targets = @(
  @{ p = "icons\icon-512.png";           s = 512 },
  @{ p = "icons\icon-192.png";           s = 192 },
  @{ p = "icons\icon-maskable-512.png";  s = 512; m = $true },
  @{ p = "icons\apple-touch-icon.png";   s = 180 },
  @{ p = "icons\favicon-32.png";         s = 32 },
  @{ p = "icons\hero-mark.png";          s = 96 },
  @{ p = "extension\icons\icon-128.png"; s = 128 },
  @{ p = "extension\icons\icon-48.png";  s = 48 },
  @{ p = "extension\icons\icon-32.png";  s = 32 },
  @{ p = "extension\icons\icon-16.png";  s = 16 }
)
Write-Host "Generating brand icons..." -ForegroundColor Cyan
foreach ($t in $targets) {
  $bmp = New-BrandIcon $t.s ([bool]$t.m)
  Save-Png $bmp (Join-Path $app $t.p)
  $bmp.Dispose()
}

# ---- Multi-resolution favicon.ico + desktop app.ico ----
function Write-Ico([int[]]$sizes, [string]$outPath) {
  $pngs = @()
  foreach ($s in $sizes) {
    $bmp = New-BrandIcon $s $false
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs += ,($ms.ToArray())
    $bmp.Dispose(); $ms.Dispose()
  }
  $fs = New-Object System.IO.FileStream($outPath, [System.IO.FileMode]::Create)
  $bw = New-Object System.IO.BinaryWriter($fs)
  $bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
  $offset = 6 + (16 * $sizes.Count)
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $s = $sizes[$i]
    $bw.Write([Byte]($(if ($s -ge 256) { 0 } else { $s })))
    $bw.Write([Byte]($(if ($s -ge 256) { 0 } else { $s })))
    $bw.Write([Byte]0); $bw.Write([Byte]0)
    $bw.Write([UInt16]1); $bw.Write([UInt16]32)
    $bw.Write([UInt32]$pngs[$i].Length)
    $bw.Write([UInt32]$offset)
    $offset += $pngs[$i].Length
  }
  foreach ($p in $pngs) { $bw.Write($p) }
  $bw.Flush(); $bw.Close(); $fs.Close()
  "  {0}  (multi-res: {1})" -f (Split-Path -Leaf $outPath), ($sizes -join ',')
}

Write-Host "Generating .ico files..." -ForegroundColor Cyan
Write-Ico @(16, 32, 48, 64, 128, 256) (Join-Path $app "favicon.ico")
Write-Ico @(16, 32, 48, 64, 128, 256) (Join-Path $app "desktop\app.ico")

Write-Host "Done." -ForegroundColor Green
