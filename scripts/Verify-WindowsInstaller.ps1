param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ALAXEE\SteamHub'
$localDataRoot = Join-Path $env:LOCALAPPDATA 'ALAXEE\SteamHub'
$alaxeeDataRoot = Join-Path $env:LOCALAPPDATA 'ALAXEE'

if (!(Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
    throw "Installer not found: $InstallerPath"
}
if (Test-Path -LiteralPath $installRoot) {
    throw "Refusing to overwrite an existing test installation: $installRoot"
}
if (Test-Path -LiteralPath $localDataRoot) {
    throw "Refusing to overwrite an existing test data directory: $localDataRoot"
}

& $InstallerPath /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-
if ($LASTEXITCODE -ne 0) {
    throw "Silent installer exited with code $LASTEXITCODE."
}

$installedExe = Join-Path $installRoot 'AlaxeeSteamBridge.exe'
$uninstaller = Join-Path $installRoot 'unins000.exe'
if (!(Test-Path -LiteralPath $installedExe -PathType Leaf)) {
    throw 'Installed bridge executable is missing.'
}
if (!(Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
    throw 'Registered uninstaller executable is missing.'
}
if (!(Test-Path -LiteralPath $localDataRoot -PathType Container)) {
    throw 'The per-user ALAXEE SteamHub data directory was not created.'
}

$sentinel = Join-Path $localDataRoot 'uninstall-verification-sentinel.tmp'
[System.IO.File]::WriteAllText($sentinel, 'This file must be removed by the uninstaller.')

$bridgeProcess = Start-Process -FilePath $installedExe -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 800
if (!(Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue)) {
    throw 'The packaged bridge process exited before the uninstall test.'
}

$uninstallEntries = @(
    Get-ChildItem -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction Stop |
    ForEach-Object {
        $entry = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
        if ($entry.DisplayName -eq 'ALAXEE SteamHub') { $entry }
    }
)
if ($uninstallEntries.Count -ne 1) {
    throw "Expected one Add/Remove Programs entry, found $($uninstallEntries.Count)."
}

& $uninstaller /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-
if ($LASTEXITCODE -ne 0) {
    throw "Silent uninstaller exited with code $LASTEXITCODE."
}

if (Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue) {
    throw 'The installed bridge process remained running after uninstall.'
}
if (Test-Path -LiteralPath $installRoot) {
    throw 'Program files remain after uninstall.'
}
if (Test-Path -LiteralPath $localDataRoot) {
    throw 'Local settings/cache directory remains after a full silent uninstall.'
}
if (Test-Path -LiteralPath $alaxeeDataRoot) {
    $remainingData = @(Get-ChildItem -LiteralPath $alaxeeDataRoot -Force -ErrorAction SilentlyContinue)
    if ($remainingData.Count -eq 0) {
        throw 'An empty ALAXEE data parent directory remains after uninstall.'
    }
}

$remaining = @(
    Get-ChildItem -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    ForEach-Object {
        $entry = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
        if ($entry.DisplayName -eq 'ALAXEE SteamHub') { $entry }
    }
)
if ($remaining.Count -ne 0) {
    throw 'The Add/Remove Programs uninstall registration remains.'
}

$startMenuShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ALAXEE SteamHub.lnk'
if (Test-Path -LiteralPath $startMenuShortcut) {
    throw 'The Start Menu shortcut remains after uninstall.'
}

Write-Host 'Installer verification passed: install, Add/Remove Programs entry, uninstall, local-data purge and shortcut cleanup.' -ForegroundColor Green
