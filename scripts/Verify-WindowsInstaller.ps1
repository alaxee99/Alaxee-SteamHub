param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$testId = [guid]::NewGuid().ToString('N')
$installRoot = Join-Path $env:LOCALAPPDATA 'Programs\ALAXEE\SteamHub'
$programsAlaxeeRoot = Join-Path $env:LOCALAPPDATA 'Programs\ALAXEE'
$localDataRoot = Join-Path $env:LOCALAPPDATA 'ALAXEE\SteamHub'
$alaxeeDataRoot = Join-Path $env:LOCALAPPDATA 'ALAXEE'
$otherProgramRoot = Join-Path $programsAlaxeeRoot ('OtherProduct-' + $testId)
$otherDataRoot = Join-Path $alaxeeDataRoot ('OtherProduct-' + $testId)
$guardRoot = Join-Path $env:TEMP ('ALAXEE-SteamHub-Uninstall-Guard-' + $testId)
$steamRoot = Join-Path $guardRoot 'Steam'
$steamExecutableSentinel = Join-Path $steamRoot 'steam.exe'
$steamSaveSentinel = Join-Path $steamRoot 'steamapps\userdata\test-user\3678970\remote\save.dat'
$otherProgramSentinel = Join-Path $otherProgramRoot 'keep-program-files.sentinel'
$otherDataSentinel = Join-Path $otherDataRoot 'keep-product-data.sentinel'
$uninstallRegistryRoot = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
$startMenuShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ALAXEE SteamHub.lnk'
$bridgeProcess = $null

function Assert-FileSentinel {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$ExpectedContent,
        [Parameter(Mandatory = $true)][string]$Description
    )

    if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Description was deleted: $Path"
    }
    $actualContent = [System.IO.File]::ReadAllText($Path)
    if ($actualContent -cne $ExpectedContent) {
        throw "$Description content changed: $Path"
    }
}

function Get-SteamHubUninstallEntries {
    return @(
        Get-ChildItem -LiteralPath $uninstallRegistryRoot -ErrorAction SilentlyContinue |
        ForEach-Object {
            $entry = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
            if ($entry.DisplayName -eq 'ALAXEE SteamHub') { $entry }
        }
    )
}

function Assert-ExternalFilesPreserved {
    Assert-FileSentinel -Path $steamExecutableSentinel -ExpectedContent 'steam-install-guard' -Description 'Steam installation guard'
    Assert-FileSentinel -Path $steamSaveSentinel -ExpectedContent 'steam-save-guard' -Description 'Steam save guard'
    Assert-FileSentinel -Path $otherProgramSentinel -ExpectedContent 'other-product-program-guard' -Description 'Other ALAXEE product program guard'
    Assert-FileSentinel -Path $otherDataSentinel -ExpectedContent 'other-product-data-guard' -Description 'Other ALAXEE product data guard'
}

if (!(Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
    throw "Installer not found: $InstallerPath"
}
if (Test-Path -LiteralPath $installRoot) {
    throw "Refusing to overwrite an existing test installation: $installRoot"
}
if (Test-Path -LiteralPath $localDataRoot) {
    throw "Refusing to overwrite an existing test data directory: $localDataRoot"
}

try {
    New-Item -ItemType Directory -Path $otherProgramRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $otherDataRoot -Force | Out-Null
    New-Item -ItemType Directory -Path (Split-Path -Parent $steamExecutableSentinel) -Force | Out-Null
    New-Item -ItemType Directory -Path (Split-Path -Parent $steamSaveSentinel) -Force | Out-Null
    [System.IO.File]::WriteAllText($otherProgramSentinel, 'other-product-program-guard')
    [System.IO.File]::WriteAllText($otherDataSentinel, 'other-product-data-guard')
    [System.IO.File]::WriteAllText($steamExecutableSentinel, 'steam-install-guard')
    [System.IO.File]::WriteAllText($steamSaveSentinel, 'steam-save-guard')

    # Phase 1: install, then explicitly keep user data during silent uninstall.
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

    $preservedDataSentinel = Join-Path $localDataRoot 'preserved-data-test.sentinel'
    [System.IO.File]::WriteAllText($preservedDataSentinel, 'keep-data-phase')
    $bridgeProcess = Start-Process -FilePath $installedExe -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 800
    if (!(Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue)) {
        throw 'The packaged bridge process exited before the data-preservation uninstall test.'
    }

    $uninstallEntries = @(Get-SteamHubUninstallEntries)
    if ($uninstallEntries.Count -ne 1) {
        throw "Expected one Add/Remove Programs entry, found $($uninstallEntries.Count)."
    }

    & $uninstaller /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /KEEPLOCALDATA
    if ($LASTEXITCODE -ne 0) {
        throw "Keep-data uninstaller exited with code $LASTEXITCODE."
    }

    if (Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue) {
        throw 'The installed bridge process remained running after the keep-data uninstall.'
    }
    $bridgeProcess = $null
    if (Test-Path -LiteralPath $installRoot) {
        throw 'Program files remain after the keep-data uninstall.'
    }
    Assert-FileSentinel -Path $preservedDataSentinel -ExpectedContent 'keep-data-phase' -Description 'Preserved local SteamHub data'
    if ((Get-SteamHubUninstallEntries).Count -ne 0) {
        throw 'The Add/Remove Programs uninstall registration remains after the keep-data uninstall.'
    }
    if (Test-Path -LiteralPath $startMenuShortcut) {
        throw 'The Start Menu shortcut remains after the keep-data uninstall.'
    }
    Assert-ExternalFilesPreserved

    # Phase 2: reinstall over retained data, then verify the default silent purge path.
    & $InstallerPath /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-
    if ($LASTEXITCODE -ne 0) {
        throw "Reinstall over retained local data exited with code $LASTEXITCODE."
    }
    if (!(Test-Path -LiteralPath (Join-Path $installRoot 'AlaxeeSteamBridge.exe') -PathType Leaf)) {
        throw 'The bridge executable is missing after reinstall over retained data.'
    }
    Assert-FileSentinel -Path $preservedDataSentinel -ExpectedContent 'keep-data-phase' -Description 'Retained local SteamHub data after reinstall'

    $purgeDataSentinel = Join-Path $localDataRoot 'purge-data-test.sentinel'
    [System.IO.File]::WriteAllText($purgeDataSentinel, 'purge-data-phase')
    $bridgeProcess = Start-Process -FilePath (Join-Path $installRoot 'AlaxeeSteamBridge.exe') -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 800
    if (!(Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue)) {
        throw 'The packaged bridge process exited before the full-cleanup uninstall test.'
    }

    $uninstaller = Join-Path $installRoot 'unins000.exe'
    & $uninstaller /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-
    if ($LASTEXITCODE -ne 0) {
        throw "Full-cleanup uninstaller exited with code $LASTEXITCODE."
    }

    if (Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue) {
        throw 'The installed bridge process remained running after the full-cleanup uninstall.'
    }
    $bridgeProcess = $null
    if (Test-Path -LiteralPath $installRoot) {
        throw 'Program files remain after the full-cleanup uninstall.'
    }
    if (Test-Path -LiteralPath $localDataRoot) {
        throw 'Local SteamHub settings/cache files remain after the full-cleanup uninstall.'
    }
    if ((Get-SteamHubUninstallEntries).Count -ne 0) {
        throw 'The Add/Remove Programs uninstall registration remains after the full-cleanup uninstall.'
    }
    if (Test-Path -LiteralPath $startMenuShortcut) {
        throw 'The Start Menu shortcut remains after the full-cleanup uninstall.'
    }
    if (!(Test-Path -LiteralPath $programsAlaxeeRoot -PathType Container)) {
        throw 'The shared ALAXEE programs parent was removed despite containing another product.'
    }
    if (!(Test-Path -LiteralPath $alaxeeDataRoot -PathType Container)) {
        throw 'The shared ALAXEE data parent was removed despite containing another product.'
    }
    Assert-ExternalFilesPreserved

    Write-Host 'Installer verification passed: install, keep-local-data uninstall, reinstall, full local-data purge, process shutdown, registry and shortcut cleanup, and external Steam/ALAXEE sentinel preservation.' -ForegroundColor Green
}
finally {
    if ($bridgeProcess -and (Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $bridgeProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $guardRoot) {
        Remove-Item -LiteralPath $guardRoot -Recurse -Force
    }
    if (Test-Path -LiteralPath $otherProgramRoot) {
        Remove-Item -LiteralPath $otherProgramRoot -Recurse -Force
    }
    if (Test-Path -LiteralPath $otherDataRoot) {
        Remove-Item -LiteralPath $otherDataRoot -Recurse -Force
    }
    Remove-Item -LiteralPath $programsAlaxeeRoot -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $alaxeeDataRoot -ErrorAction SilentlyContinue
}
