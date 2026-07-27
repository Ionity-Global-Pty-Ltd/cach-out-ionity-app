param(
  [string]$Runtime = "win-x64",
  [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $repoRoot "desktop-native\CachOutIonity.Native.csproj"
$outDir = Join-Path $repoRoot "desktop\publish\$Runtime"

dotnet publish $project `
  -c $Configuration `
  -r $Runtime `
  -p:PublishSingleFile=true `
  -p:SelfContained=true `
  -p:EnableCompressionInSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -o $outDir

Write-Host ""
Write-Host "Published to: $outDir" -ForegroundColor Green
Get-ChildItem $outDir | Select-Object Name, Length
