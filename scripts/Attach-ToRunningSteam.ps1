$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Assert-SteamCdpLoopback.ps1')
. (Join-Path $PSScriptRoot 'Resolve-NodeExecutable.ps1')

$nodeExe = Resolve-NodeExecutable
$nodeVersion = (& $nodeExe -p 'process.versions.node').Trim()
if ([int]($nodeVersion.Split('.')[0]) -lt 22) { throw "Node.js $nodeVersion is below the required version. Node.js 22+ is required." }
Write-Host "Node.js: $nodeExe ($nodeVersion)" -ForegroundColor Green

Wait-SteamCdpLoopback -Port 8080 -TimeoutSeconds 8
$root = Split-Path -Parent $PSScriptRoot
& $nodeExe (Join-Path $root 'src\bridge.mjs')
