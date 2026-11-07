param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$testId = [guid]::NewGuid().ToString('N')
$testStartedAt = Get-Date
$verificationPassed = $false
$expectedInstallRoot = Join-Path $env:LOCALAPPDATA 'Programs\ALAXEE\SteamHub'
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
$startMenuShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\ALAXEE SteamHub.lnk'
$bridgeProcess = $null
$installedExe = $null
$uninstaller = $null
$installerLogPath = Join-Path $env:TEMP ('ALAXEE-SteamHub-' + $testId + '-install.log')
$reinstallLogPath = Join-Path $env:TEMP ('ALAXEE-SteamHub-' + $testId + '-reinstall.log')
$keepUninstallLogPath = Join-Path $env:TEMP ('ALAXEE-SteamHub-' + $testId + '-keep-uninstall.log')
$purgeUninstallLogPath = Join-Path $env:TEMP ('ALAXEE-SteamHub-' + $testId + '-purge-uninstall.log')
$installRoot = $expectedInstallRoot

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

function Get-UninstallRegistryDiagnostics {
    $uninstallSubKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall'
    $hives = @(
        [pscustomobject]@{ Name = 'HKCU'; Value = [Microsoft.Win32.RegistryHive]::CurrentUser },
        [pscustomobject]@{ Name = 'HKLM'; Value = [Microsoft.Win32.RegistryHive]::LocalMachine }
    )
    $views = @(
        [Microsoft.Win32.RegistryView]::Registry64,
        [Microsoft.Win32.RegistryView]::Registry32
    )
    $rows = @()

    foreach ($hive in $hives) {
        foreach ($view in $views) {
            $baseKey = $null
            $uninstallKey = $null
            try {
                $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive.Value, $view)
                $uninstallKey = $baseKey.OpenSubKey($uninstallSubKey, $false)
                if (!$uninstallKey) { continue }

                foreach ($subKeyName in $uninstallKey.GetSubKeyNames()) {
                    $appKey = $null
                    try {
                        $appKey = $uninstallKey.OpenSubKey($subKeyName, $false)
                        if (!$appKey) { continue }

                        $displayName = [string]$appKey.GetValue('DisplayName', '')
                        if ($subKeyName -like '*A4C5DAD5*' -or
                            $displayName -like '*SteamHub*' -or
                            $displayName -like '*ALAXEE*') {
                            $rows += [pscustomobject]@{
                                Hive = $hive.Name
                                View = $view.ToString()
                                Key = $subKeyName
                                DisplayName = $displayName
                                InstallLocation = [string]$appKey.GetValue('InstallLocation', '')
                                DisplayIcon = [string]$appKey.GetValue('DisplayIcon', '')
                                UninstallString = [string]$appKey.GetValue('UninstallString', '')
                            }
                        }
                    } finally {
                        if ($appKey) { $appKey.Dispose() }
                    }
                }
            } finally {
                if ($uninstallKey) { $uninstallKey.Dispose() }
                if ($baseKey) { $baseKey.Dispose() }
            }
        }
    }

    return @($rows)
}

function Get-SteamHubUninstallEntries {
    $uninstallSubKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{A4C5DAD5-0D5A-4C96-8EF6-7D23C776A3D1}_is1'
    $views = @(
        [Microsoft.Win32.RegistryView]::Registry64,
        [Microsoft.Win32.RegistryView]::Registry32
    )
    $found = @{}

    foreach ($view in $views) {
        $baseKey = $null
        $appKey = $null
        try {
            $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
                [Microsoft.Win32.RegistryHive]::CurrentUser,
                $view
            )
            $appKey = $baseKey.OpenSubKey($uninstallSubKey, $false)
            if (!$appKey) { continue }

            $registryPath = "HKCU:\$uninstallSubKey"
            if (!$found.ContainsKey($registryPath)) {
                $found[$registryPath] = [pscustomobject]@{
                    DisplayName = [string]$appKey.GetValue('DisplayName', '')
                    InstallLocation = [string]$appKey.GetValue('InstallLocation', '')
                    DisplayIcon = [string]$appKey.GetValue('DisplayIcon', '')
                    UninstallString = [string]$appKey.GetValue('UninstallString', '')
                    RegistryKey = $registryPath
                    RegistryView = $view.ToString()
                }
            }
        } finally {
            if ($appKey) { $appKey.Dispose() }
            if ($baseKey) { $baseKey.Dispose() }
        }
    }

    return @($found.Values)
}

function Get-RegisteredInstallRoot {
    param([Parameter(Mandatory = $true)]$Entry)

    if ($Entry.InstallLocation -and [string]$Entry.InstallLocation -ne '') {
        return [System.IO.Path]::GetFullPath([string]$Entry.InstallLocation)
    }

    $displayIcon = [string]$Entry.DisplayIcon
    if ($displayIcon -match '^"(?<path>[^"]+)"') {
        $iconPath = $Matches.path
        if ([System.IO.Path]::GetFileName($iconPath) -ieq 'AlaxeeSteamBridge.exe') {
            return [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($iconPath))
        }
    } elseif ($displayIcon -match '^(?<path>.+?AlaxeeSteamBridge\.exe)(?:,\s*\d+)?$') {
        $iconPath = $Matches.path
        return [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($iconPath))
    }

    $uninstallString = [string]$Entry.UninstallString
    if ($uninstallString -match '^\s*"(?<path>[^"]+unins\d+\.exe)"') {
        return [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($Matches.path))
    }
    if ($uninstallString -match '^\s*(?<path>.+?unins\d+\.exe)(?:\s|$)') {
        return [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetFullPath($Matches.path))
    }

    throw "Could not resolve the installed directory from Add/Remove Programs. InstallLocation='$($Entry.InstallLocation)'; DisplayIcon='$displayIcon'; UninstallString='$uninstallString'; RegistryKey='$($Entry.RegistryKey)'."
}

function Resolve-InstalledPaths {
    $entries = @(Get-SteamHubUninstallEntries)
    if ($entries.Count -ne 1) {
        $registryDiagnostics = @(Get-UninstallRegistryDiagnostics | ConvertTo-Json -Depth 4 -Compress)
        $installRootExists = Test-Path -LiteralPath $expectedInstallRoot -PathType Container
        $installRootFiles = if ($installRootExists) {
            @(Get-ChildItem -LiteralPath $expectedInstallRoot -Force -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ', '
        } else {
            '<missing>'
        }
        $logTail = if (Test-Path -LiteralPath $script:installerLogPath -PathType Leaf) {
            (Get-Content -LiteralPath $script:installerLogPath -Tail 80 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        } else {
            '<installer log missing>'
        }
        throw "Expected exactly one ALAXEE SteamHub Add/Remove Programs entry, found $($entries.Count). User='$env:USERNAME'; LOCALAPPDATA='$env:LOCALAPPDATA'; TEMP='$env:TEMP'; installerExitCode='$installerExitCode'; expected='$expectedInstallRoot'; installRootExists='$installRootExists'; files='$installRootFiles'; registryCandidates='$registryDiagnostics'; InnoSetupLogPath='$script:installerLogPath'; InnoSetupLogTail='$logTail'."
    }

    if ($entries[0].DisplayName -cne 'ALAXEE SteamHub') {
        throw "The expected AppId uninstall key exists, but DisplayName is '$($entries[0].DisplayName)' instead of 'ALAXEE SteamHub'. RegistryKey='$($entries[0].RegistryKey)'; RegistryView='$($entries[0].RegistryView)'."
    }

    $registeredRoot = Get-RegisteredInstallRoot -Entry $entries[0]
    $expectedFull = [System.IO.Path]::GetFullPath($expectedInstallRoot).TrimEnd('\')
    $registeredFull = [System.IO.Path]::GetFullPath($registeredRoot).TrimEnd('\')
    if (![string]::Equals($registeredFull, $expectedFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Installer registered an unexpected directory. LOCALAPPDATA='$env:LOCALAPPDATA'; expected='$expectedFull'; registered='$registeredFull'; DisplayIcon='$($entries[0].DisplayIcon)'; UninstallString='$($entries[0].UninstallString)'."
    }

    $script:installRoot = $registeredRoot
    $script:installedExe = Join-Path $registeredRoot 'AlaxeeSteamBridge.exe'
    $script:uninstaller = Join-Path $registeredRoot 'unins000.exe'
}

function Invoke-SteamHubUninstaller {
    param(
        [Parameter(Mandatory = $true)][string]$LogPath,
        [switch]$KeepLocalData
    )

    if (!(Test-Path -LiteralPath $script:uninstaller -PathType Leaf)) {
        throw "The registered SteamHub uninstaller is missing: $script:uninstaller"
    }

    $arguments = '/LOG="' + $LogPath + '" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-'
    if ($KeepLocalData) { $arguments += ' /KEEPLOCALDATA' }
    Write-Host "Launching SteamHub uninstaller '$script:uninstaller'. Log: '$LogPath'"
    $process = Start-Process -FilePath $script:uninstaller -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
    if (!$process) {
        throw "Windows did not return a process handle for the SteamHub uninstaller: $script:uninstaller"
    }
    return [int]$process.ExitCode
}
function Assert-ExternalFilesPreserved {
    Assert-FileSentinel -Path $steamExecutableSentinel -ExpectedContent 'steam-install-guard' -Description 'Steam installation guard'
    Assert-FileSentinel -Path $steamSaveSentinel -ExpectedContent 'steam-save-guard' -Description 'Steam save guard'
    Assert-FileSentinel -Path $otherProgramSentinel -ExpectedContent 'other-product-program-guard' -Description 'Other ALAXEE product program guard'
    Assert-FileSentinel -Path $otherDataSentinel -ExpectedContent 'other-product-data-guard' -Description 'Other ALAXEE product data guard'
}

function Get-BridgeProcessDiagnostics {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    try {
        $record = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
        if (!$record) { return "PID $ProcessId no longer exists in Win32_Process." }
        return "PID=$($record.ProcessId); Name='$($record.Name)'; ExecutablePath='$($record.ExecutablePath)'."
    } catch {
        return ("Could not query Win32_Process for PID {0}: {1}" -f $ProcessId, $_.Exception.Message)
    }
}

function Get-StopScriptLogDiagnostics {
    $logs = @(Get-ChildItem -LiteralPath $env:TEMP -Filter 'ALAXEE-SteamHub-stop-*.log' -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -ge $script:testStartedAt } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 5)
    if ($logs.Count -eq 0) { return '<no stop-script diagnostic log was created>' }

    $parts = @()
    foreach ($log in $logs) {
        $tail = (Get-Content -LiteralPath $log.FullName -Tail 40 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        $parts += ("Log='{0}'{1}{2}" -f $log.FullName, [Environment]::NewLine, $tail)
    }
    return ($parts -join [Environment]::NewLine)
}

function Remove-DirectoryOnlyWhenEmpty {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (!(Test-Path -LiteralPath $Path -PathType Container)) { return }
    $children = @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction Stop)
    if ($children.Count -eq 0) {
        Remove-Item -LiteralPath $Path -Force
    }
}

if (!(Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
    throw "Installer not found: $InstallerPath"
}
if (Test-Path -LiteralPath $expectedInstallRoot) {
    throw "Refusing to overwrite an existing test installation: $expectedInstallRoot"
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
    $installArguments = '/DIR="' + $expectedInstallRoot + '" /LOG="' + $installerLogPath + '" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-'
    Write-Host "Launching installer for current user '$env:USERNAME' at '$expectedInstallRoot'. Log: '$installerLogPath'"
    $installerProcess = Start-Process -FilePath $InstallerPath -ArgumentList $installArguments -Wait -PassThru
    $installerExitCode = $installerProcess.ExitCode
    if ($installerExitCode -ne 0) {
        $logTail = if (Test-Path -LiteralPath $installerLogPath -PathType Leaf) {
            (Get-Content -LiteralPath $installerLogPath -Tail 80 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        } else {
            '<installer log missing>'
        }
        throw "Silent installer exited with code $installerExitCode. ExpectedDir='$expectedInstallRoot'; LogPath='$installerLogPath'; Log='$logTail'."
    }
    Resolve-InstalledPaths

    if (!(Test-Path -LiteralPath $installedExe -PathType Leaf)) {
        $actualFiles = @(Get-ChildItem -LiteralPath $installRoot -Force -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name) -join ', '
        throw "Installed bridge executable is missing. Registered root='$installRoot'; LOCALAPPDATA='$env:LOCALAPPDATA'; expected='$expectedInstallRoot'; files found='$actualFiles'."
    }
    if (!(Test-Path -LiteralPath $uninstaller -PathType Leaf)) {
        throw "Registered uninstaller executable is missing: $uninstaller"
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

    $keepUninstallExitCode = Invoke-SteamHubUninstaller -LogPath $keepUninstallLogPath -KeepLocalData
    if ($keepUninstallExitCode -ne 0) {
        $uninstallLogTail = if (Test-Path -LiteralPath $keepUninstallLogPath -PathType Leaf) {
            (Get-Content -LiteralPath $keepUninstallLogPath -Tail 120 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        } else {
            '<uninstaller log missing>'
        }
        throw "Keep-data uninstaller exited with code $keepUninstallExitCode. UninstallerLog='$keepUninstallLogPath'; Log='$uninstallLogTail'."
    }
    if (!(Test-Path -LiteralPath $keepUninstallLogPath -PathType Leaf)) {
        throw "Keep-data uninstaller returned success but produced no Inno Setup log: $keepUninstallLogPath"
    }

    if (Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue) {
        $processDiagnostics = Get-BridgeProcessDiagnostics -ProcessId $bridgeProcess.Id
        $stopLogDiagnostics = Get-StopScriptLogDiagnostics
        $uninstallLogTail = if (Test-Path -LiteralPath $keepUninstallLogPath -PathType Leaf) {
            (Get-Content -LiteralPath $keepUninstallLogPath -Tail 120 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        } else {
            '<uninstaller log missing>'
        }
        throw "The installed bridge process remained running after the keep-data uninstall. Process='$processDiagnostics'; stop-script diagnostics='$stopLogDiagnostics'; uninstaller log='$uninstallLogTail'."
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
    $reinstallArguments = '/DIR="' + $expectedInstallRoot + '" /LOG="' + $reinstallLogPath + '" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-'
    Write-Host "Reinstalling for current user '$env:USERNAME' at '$expectedInstallRoot'. Log: '$reinstallLogPath'"
    $reinstallProcess = Start-Process -FilePath $InstallerPath -ArgumentList $reinstallArguments -Wait -PassThru
    $reinstallExitCode = $reinstallProcess.ExitCode
    if ($reinstallExitCode -ne 0) {
        $logTail = if (Test-Path -LiteralPath $reinstallLogPath -PathType Leaf) {
            (Get-Content -LiteralPath $reinstallLogPath -Tail 80 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        } else {
            '<installer log missing>'
        }
        throw "Reinstall over retained local data exited with code $reinstallExitCode. ExpectedDir='$expectedInstallRoot'; LogPath='$reinstallLogPath'; Log='$logTail'."
    }
    Resolve-InstalledPaths
    if (!(Test-Path -LiteralPath $installedExe -PathType Leaf)) {
        throw "The bridge executable is missing after reinstall: $installedExe"
    }
    Assert-FileSentinel -Path $preservedDataSentinel -ExpectedContent 'keep-data-phase' -Description 'Retained local SteamHub data after reinstall'

    $purgeDataSentinel = Join-Path $localDataRoot 'purge-data-test.sentinel'
    [System.IO.File]::WriteAllText($purgeDataSentinel, 'purge-data-phase')
    $bridgeProcess = Start-Process -FilePath $installedExe -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 800
    if (!(Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue)) {
        throw 'The packaged bridge process exited before the full-cleanup uninstall test.'
    }

    $purgeUninstallExitCode = Invoke-SteamHubUninstaller -LogPath $purgeUninstallLogPath
    if ($purgeUninstallExitCode -ne 0) {
        $uninstallLogTail = if (Test-Path -LiteralPath $purgeUninstallLogPath -PathType Leaf) {
            (Get-Content -LiteralPath $purgeUninstallLogPath -Tail 120 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
        } else {
            '<uninstaller log missing>'
        }
        throw "Full-cleanup uninstaller exited with code $purgeUninstallExitCode. UninstallerLog='$purgeUninstallLogPath'; Log='$uninstallLogTail'."
    }
    if (!(Test-Path -LiteralPath $purgeUninstallLogPath -PathType Leaf)) {
        throw "Full-cleanup uninstaller returned success but produced no Inno Setup log: $purgeUninstallLogPath"
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

    $verificationPassed = $true
    Write-Host 'Installer verification passed: install, keep-local-data uninstall, reinstall, full local-data purge, process shutdown, registry and shortcut cleanup, and external Steam/ALAXEE sentinel preservation.' -ForegroundColor Green
}
finally {
    if ($bridgeProcess -and (Get-Process -Id $bridgeProcess.Id -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $bridgeProcess.Id -Force -ErrorAction SilentlyContinue
    }

    # Remove only paths created by this uniquely identified verification run.
    if (Test-Path -LiteralPath $guardRoot) {
        Remove-Item -LiteralPath $guardRoot -Recurse -Force
    }
    if (Test-Path -LiteralPath $otherProgramRoot) {
        Remove-Item -LiteralPath $otherProgramRoot -Recurse -Force
    }
    if (Test-Path -LiteralPath $otherDataRoot) {
        Remove-Item -LiteralPath $otherDataRoot -Recurse -Force
    }
    Remove-DirectoryOnlyWhenEmpty -Path $programsAlaxeeRoot
    Remove-DirectoryOnlyWhenEmpty -Path $alaxeeDataRoot
    foreach ($logPath in @($installerLogPath, $reinstallLogPath)) {
        if (Test-Path -LiteralPath $logPath -PathType Leaf) {
            Remove-Item -LiteralPath $logPath -Force
        }
    }
    if ($verificationPassed) {
        Get-ChildItem -LiteralPath $env:TEMP -Filter 'ALAXEE-SteamHub-stop-*.log' -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -ge $testStartedAt } |
            Remove-Item -Force -ErrorAction SilentlyContinue
    }
}
