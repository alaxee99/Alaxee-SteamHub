param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedExecutable
)

$ErrorActionPreference = 'Stop'
$expectedPath = [System.IO.Path]::GetFullPath($ExpectedExecutable)

function Get-BridgeProcessRecords {
    $processes = @(Get-Process -Name 'AlaxeeSteamBridge' -ErrorAction SilentlyContinue)
    $records = @()

    foreach ($process in $processes) {
        $actualPath = $null
        try {
            $actualPath = [string]$process.Path
        } catch {
            $actualPath = $null
        }

        if ([string]::IsNullOrWhiteSpace($actualPath)) {
            try {
                $processRecord = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $($process.Id)" -ErrorAction Stop
                $actualPath = [string]$processRecord.ExecutablePath
            } catch {
                $actualPath = $null
            }
        }

        $records += [pscustomobject]@{
            Id = [int]$process.Id
            Path = $actualPath
        }
    }

    return @($records)
}

$processes = @(Get-BridgeProcessRecords)
foreach ($process in $processes) {
    if ([string]::IsNullOrWhiteSpace($process.Path)) {
        throw "Cannot verify the executable path for ALAXEE SteamHub process PID $($process.Id). Uninstall is blocked to avoid stopping an unrelated process."
    }

    $actualFullPath = [System.IO.Path]::GetFullPath([string]$process.Path)
    if ([string]::Equals(
        $actualFullPath,
        $expectedPath,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        Stop-Process -Id $process.Id -Force -ErrorAction Stop
        Wait-Process -Id $process.Id -Timeout 5 -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Milliseconds 300
$remaining = @(Get-BridgeProcessRecords)
foreach ($process in $remaining) {
    if ([string]::IsNullOrWhiteSpace($process.Path)) {
        throw "An ALAXEE SteamHub-named process remains, but its executable path cannot be verified (PID $($process.Id)). Uninstall is blocked."
    }

    if ([string]::Equals(
        [System.IO.Path]::GetFullPath([string]$process.Path),
        $expectedPath,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "The ALAXEE SteamHub bridge process could not be stopped (PID $($process.Id), path '$($process.Path)'). Close it manually and retry uninstall."
    }
}
