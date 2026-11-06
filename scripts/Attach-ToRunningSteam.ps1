$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Assert-SteamCdpLoopback.ps1')

$node = Get-Command node -ErrorAction SilentlyContinue
if (!$node) { throw '未找到 Node.js。需要 Node.js 22 或更高版本。' }
$nodeVersion = (& node -p 'process.versions.node').Trim()
if ([int]($nodeVersion.Split('.')[0]) -lt 22) { throw "当前 Node.js $nodeVersion 低于要求；需要 Node.js 22+。" }

Wait-SteamCdpLoopback -Port 8080 -TimeoutSeconds 8
$root = Split-Path -Parent $PSScriptRoot
& node (Join-Path $root 'src\bridge.mjs')
