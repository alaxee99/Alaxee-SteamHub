param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedExecutable
)

$ErrorActionPreference = 'Stop'
$expectedPath = [System.IO.Path]::GetFullPath($ExpectedExecutable)
$processes = @(Get-Process -Name 'AlaxeeSteamBridge' -ErrorAction SilentlyContinue)

foreach ($process in $processes) {
    $actualPath = $null
    try {
        $actualPath = $process.Path
    } catch {
        $actualPath = $null
    }

    if ($actualPath -and [string]::Equals(
        [System.IO.Path]::GetFullPath($actualPath),
        $expectedPath,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Milliseconds 300
$remaining = @(Get-Process -Name 'AlaxeeSteamBridge' -ErrorAction SilentlyContinue)
foreach ($process in $remaining) {
    $actualPath = $null
    try {
        $actualPath = $process.Path
    } catch {
        $actualPath = $null
    }
    if ($actualPath -and [string]::Equals(
        [System.IO.Path]::GetFullPath($actualPath),
        $expectedPath,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw 'The ALAXEE SteamHub bridge process could not be stopped. Close it manually and retry uninstall.'
    }
}
