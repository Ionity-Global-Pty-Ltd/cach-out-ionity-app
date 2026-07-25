@echo off
REM CACH OUT Ionity - launcher (self-elevates to Administrator)
REM Ionity Global (Pty) Ltd

set "PS1=%~dp0CACH-OUT-Ionity.ps1"

powershell -NoProfile -Command "if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','\"%PS1%\"'; exit }"

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
