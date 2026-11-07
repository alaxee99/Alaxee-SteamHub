$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Assert-SteamCdpLoopback.ps1')

$packageRoot = Split-Path -Parent $PSScriptRoot
$bridgeExe = Join-Path $packageRoot 'AlaxeeSteamBridge.exe'
if (!(Test-Path -LiteralPath $bridgeExe -PathType Leaf)) {
    throw 'The bundled bridge executable is missing. Download and extract the ALAXEE SteamHub Windows x64 package, not the source-code ZIP.'
}

Wait-SteamCdpLoopback -Port 8080 -TimeoutSeconds 8
& $bridgeExe
if ($LASTEXITCODE -ne 0) {
    throw "The bundled Steam bridge exited with code $LASTEXITCODE."
}
