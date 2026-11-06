$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Assert-SteamCdpLoopback.ps1')

$node = Get-Command node -ErrorAction SilentlyContinue
if (!$node) { throw 'Node.js was not found. Install Node.js 22 or later.' }
$nodeVersion = (& node -p 'process.versions.node').Trim()
if ([int]($nodeVersion.Split('.')[0]) -lt 22) { throw "Node.js $nodeVersion is below the required version. Node.js 22+ is required." }

Wait-SteamCdpLoopback -Port 8080 -TimeoutSeconds 8
$root = Split-Path -Parent $PSScriptRoot
& node (Join-Path $root 'src\bridge.mjs')
