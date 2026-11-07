param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedExecutable
)

$ErrorActionPreference = 'Stop'
$expectedPath = [System.IO.Path]::GetFullPath($ExpectedExecutable)
$expectedName = [System.IO.Path]::GetFileName($expectedPath)
$logPath = Join-Path $env:TEMP ('ALAXEE-SteamHub-stop-' + [guid]::NewGuid().ToString('N') + '.log')

function Write-StopLog {
    param([Parameter(Mandatory = $true)][string]$Message)
    $line = ('[{0}] {1}{2}' -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK'), $Message, [Environment]::NewLine)
    [System.IO.File]::AppendAllText($logPath, $line, [System.Text.Encoding]::ASCII)
}

function Get-BridgeProcessRecords {
    $allProcesses = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)
    $records = @()

    foreach ($process in $allProcesses) {
        $nameMatches = [string]::Equals(
            [string]$process.Name,
            $expectedName,
            [System.StringComparison]::OrdinalIgnoreCase
        )
        $path = [string]$process.ExecutablePath
        $pathMatches = $false

        if (![string]::IsNullOrWhiteSpace($path)) {
            try {
                $pathMatches = [string]::Equals(
                    [System.IO.Path]::GetFullPath($path),
                    $expectedPath,
                    [System.StringComparison]::OrdinalIgnoreCase
                )
            } catch {
                $pathMatches = $false
            }
        }

        if ($nameMatches -or $pathMatches) {
            $records += [pscustomobject]@{
                Id = [int]$process.ProcessId
                Name = [string]$process.Name
                Path = $path
                PathMatches = $pathMatches
            }
        }
    }

    return @($records)
}

try {
    Write-StopLog "Begin stop check. ExpectedExecutable='$expectedPath'; ExpectedName='$expectedName'; Log='$logPath'."

    $processes = @(Get-BridgeProcessRecords)
    Write-StopLog "Discovered $($processes.Count) process candidate(s)."

    foreach ($process in $processes) {
        Write-StopLog "Candidate PID=$($process.Id); Name='$($process.Name)'; Path='$($process.Path)'; ExactPathMatch='$($process.PathMatches)'."

        if ([string]::IsNullOrWhiteSpace($process.Path)) {
            throw "Cannot verify the executable path for ALAXEE SteamHub process PID $($process.Id). Uninstall is blocked to avoid stopping an unrelated process."
        }

        if (!$process.PathMatches) {
            Write-StopLog "Skipping same-name process because its executable path does not match the installed bridge."
            continue
        }

        Stop-Process -Id $process.Id -Force -ErrorAction Stop
        Write-StopLog "Stop-Process issued for verified bridge PID=$($process.Id)."
        Wait-Process -Id $process.Id -Timeout 10 -ErrorAction SilentlyContinue
    }

    Start-Sleep -Milliseconds 300
    $remaining = @(Get-BridgeProcessRecords)
    foreach ($process in $remaining) {
        Write-StopLog "Post-stop candidate PID=$($process.Id); Name='$($process.Name)'; Path='$($process.Path)'; ExactPathMatch='$($process.PathMatches)'."

        if ([string]::IsNullOrWhiteSpace($process.Path)) {
            throw "An ALAXEE SteamHub-named process remains, but its executable path cannot be verified (PID $($process.Id)). Uninstall is blocked."
        }

        if ($process.PathMatches) {
            throw "The ALAXEE SteamHub bridge process could not be stopped (PID $($process.Id), path '$($process.Path)'). Close it manually and retry uninstall."
        }
    }

    Write-StopLog 'Stop check completed successfully.'
} catch {
    try { Write-StopLog "ERROR: $($_.Exception.Message)" } catch {}
    throw
}
