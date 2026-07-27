# Publishing & Trust Guide

How the CACH OUT Ionity desktop `.exe` is built, signed, and distributed — and how to get it fully trusted by Windows.

## 1. Build (compiled .NET, not a script)
```powershell
cd desktop-net
dotnet publish -c Release
# → bin/Release/net10.0-windows/win-x64/publish/CACH-OUT-Ionity.exe  (self-contained, single file)
```
Using a real compiled C#/WinForms app (instead of a PowerShell script packaged into an `.exe`) removes the biggest cause of Defender/SmartScreen *"Virus detected"* false positives.

## 2. Sign + checksum (every release)
```powershell
# one-time: create a self-signed code-signing cert
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=Ionity Global (Pty) Ltd, O=Ionity Global (Pty) Ltd, C=ZA" `
  -CertStoreLocation Cert:\CurrentUser\My -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(5)
Export-PfxCertificate -Cert $cert -FilePath codesign.pfx -Password (Read-Host -AsSecureString)
Export-Certificate  -Cert $cert -FilePath IonityGlobal-CodeSigning.cer

# sign (SHA-256 + RFC-3161 timestamp)
signtool sign /fd SHA256 /f codesign.pfx /p <pw> /tr http://timestamp.digicert.com /td SHA256 CACH-OUT-Ionity.exe

# checksum
Get-FileHash CACH-OUT-Ionity.exe -Algorithm SHA256 | ForEach-Object { "$($_.Hash)  CACH-OUT-Ionity.exe" } > SHA256SUMS.txt
```
> **Never commit `codesign.pfx` or its password.** `.gitignore` excludes `*.pfx`.

## 3. Release
```powershell
gh release create v2.0.0 CACH-OUT-Ionity.exe IonityGlobal-CodeSigning.cer SHA256SUMS.txt Trust-Publisher.ps1 --title "..." --notes-file NOTES.md
```
The site's download button uses `releases/latest/download/CACH-OUT-Ionity.exe`, so it always points at the newest release automatically.

## 4. Trust levels (honest picture)
| Method | Removes "Unknown Publisher" | Removes SmartScreen warning | Cost |
| --- | --- | --- | --- |
| Compiled .NET rewrite | — | Reduces AV false-positive massively | Free ✅ (done) |
| Self-signed cert + user installs `.cer` | ✅ on that PC | ❌ (root not globally trusted) | Free ✅ (done) |
| Publish via **winget** (this repo's `manifests/`) | ✅ | ✅ once accepted | Free |
| **Microsoft Store** (MSIX) | ✅ | ✅ instantly | Free–$19 dev acct |
| **EV code-signing certificate** | ✅ | ✅ instantly | ~$250–400/yr |

The compiled rewrite + timestamped signature is what stops the *"Virus detected"* flag. For a *zero-warning* experience on any PC, submit to winget or the Microsoft Store.

## 5. winget submission
Manifests are ready in [`manifests/i/IonityGlobal/CachOut/2.0.0/`](./manifests/i/IonityGlobal/CachOut/2.0.0) and pass `winget validate`.
To publish:
```powershell
winget validate --manifest manifests/i/IonityGlobal/CachOut/2.0.0
# then open a PR copying that folder into microsoft/winget-pkgs
```
Requirements: the release `.exe` URL + SHA-256 must match (they do), and the installer must pass Microsoft's automated malware scan. After acceptance, anyone can run `winget install IonityGlobal.CachOut`.
