$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Assert-SteamCdpLoopback.ps1')

function Get-SteamInstallPath {
    $programFilesX86 = (Get-Item -Path 'Env:ProgramFiles(x86)' -ErrorAction SilentlyContinue).Value
    $candidates = @(
        (Get-ItemProperty -Path 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath,
        (Get-ItemProperty -Path 'HKLM:\Software\Wow6432Node\Valve\Steam' -ErrorAction SilentlyContinue).InstallPath,
        (Get-ItemProperty -Path 'HKLM:\Software\Valve\Steam' -ErrorAction SilentlyContinue).InstallPath,
        $(if ($programFilesX86) { Join-Path $programFilesX86 'Steam' }),
        (Join-Path $env:ProgramFiles 'Steam')
    )
    foreach ($candidate in $candidates) {
        if (![string]::IsNullOrWhiteSpace([string]$candidate)) {
            $exe = Join-Path ([Environment]::ExpandEnvironmentVariables([string]$candidate)) 'steam.exe'
            if (Test-Path -LiteralPath $exe -PathType Leaf) { return (Split-Path -Parent $exe) }
        }
    }
    throw 'Steam installation was not found. Confirm that Steam is installed.'
}

$packageRoot = Split-Path -Parent $PSScriptRoot
$bridgeExe = Join-Path $packageRoot 'AlaxeeSteamBridge.exe'
if (!(Test-Path -LiteralPath $bridgeExe -PathType Leaf)) {
    throw 'The bundled bridge executable is missing. Download and extract the ALAXEE SteamHub Windows x64 package, not the source-code ZIP.'
}

Write-Host ''
Write-Host 'ALAXEE Steam Standalone Bridge' -ForegroundColor Cyan
Write-Host 'The Node.js runtime and page injection assets are bundled in this executable.' -ForegroundColor Green
Write-Host ''

$steamProcess = Get-Process -Name 'steam' -ErrorAction SilentlyContinue
if ($steamProcess) {
    throw 'Steam is still running. Exit Steam normally from the Steam menu, wait for it to close completely, then run Start-Steam-Bridge.bat again. Do not force-kill Steam.'
}

$portListeners = @(Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue)
if ($portListeners.Count -gt 0) {
    $owners = $portListeners | ForEach-Object {
        $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        [PSCustomObject]@{ Address = $_.LocalAddress; Process = $process.ProcessName; PID = $_.OwningProcess }
    }
    $owners | Format-Table -AutoSize | Out-Host
    throw 'Local TCP port 8080 is already in use. This prototype will not switch ports automatically. Identify and close the owning process first.'
}

$steamPath = Get-SteamInstallPath
$steamExe = Join-Path $steamPath 'steam.exe'
Write-Host "Steam: $steamExe"
Write-Host 'Startup argument: -cef-enable-debugging (does not enable -dev or disable the sandbox)'
Write-Host ''
Write-Host 'Notice: Steam CDP has no authentication. Use this prototype only in a trusted local environment.' -ForegroundColor Yellow
Write-Host 'Starting Steam. The bridge will connect only to 127.0.0.1:8080.' -ForegroundColor Green

Start-Process -FilePath $steamExe -ArgumentList @('-cef-enable-debugging') -WorkingDirectory $steamPath
Wait-SteamCdpLoopback -Port 8080 -TimeoutSeconds 180
& $bridgeExe
if ($LASTEXITCODE -ne 0) {
    throw "The bundled Steam bridge exited with code $LASTEXITCODE."
}
