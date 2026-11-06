@echo off
setlocal
cd /d "%~dp0"
title ALAXEE Steam Standalone Bridge
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Start-AlaxeeSteamBridge.ps1"
if errorlevel 1 (
  echo.
  echo Bridge did not start. Read the message above.
  pause
)
