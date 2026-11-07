param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedExecutable
)

$ErrorActionPreference = 'Stop'
$expectedPath = [System.IO.Path]::GetFullPath($ExpectedExecutable)

function Get-BridgeProcessRecords {
    try {
        return @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'AlaxeeSteamBridge.exe'" -ErrorAction Stop)
    } catch {
        throw "Could not inspect ALAXEE SteamHub process paths safely: $($_.Exception.Message)"
    }
}

function Stop-ExactBridgeProcess {
    param(
        [Parameter(Mandatory = $true)]
        $ProcessRecord
    )

    $actualPath = [string]$ProcessRecord.ExecutablePath
    if ([string]::IsNullOrWhiteSpace($actualPath)) {
        throw "Cannot verify the executable path for ALAXEE SteamHub process PID $($ProcessRecord.ProcessId). Uninstall is blocked to avoid stopping an unrelated process."
    }

    $actualFullPath = [System.IO.Path]::GetFullPath($actualPath)
    if (![string]::Equals(
        $actualFullPath,
        $expectedPath,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        return
    }

    Stop-Process -Id ([int]$ProcessRecord.ProcessId) -Force -ErrorAction Stop
    Wait-Process -Id ([int]$ProcessRecord.ProcessId) -Timeout 5 -ErrorAction SilentlyContinue
}

$processes = @(Get-BridgeProcessRecords)
foreach ($process in $processes) {
    Stop-ExactBridgeProcess -ProcessRecord $process
}

Start-Sleep -Milliseconds 300
$remaining = @(Get-BridgeProcessRecords)
foreach ($process in $remaining) {
    $actualPath = [string]$process.ExecutablePath
    if ([string]::IsNullOrWhiteSpace($actualPath)) {
        throw "An ALAXEE SteamHub-named process remains, but its executable path cannot be verified (PID $($process.ProcessId)). Uninstall is blocked."
    }

    if ([string]::Equals(
        [System.IO.Path]::GetFullPath($actualPath),
        $expectedPath,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw "The ALAXEE SteamHub bridge process could not be stopped (PID $($process.ProcessId), path '$actualPath'). Close it manually and retry uninstall."
    }
}
