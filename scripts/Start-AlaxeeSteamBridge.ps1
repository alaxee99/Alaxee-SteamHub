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
    throw '没有找到 steam.exe。请确认 Steam 已正确安装。'
}

Write-Host ''
Write-Host 'ALAXEE Steam Standalone Bridge — Proof of Concept' -ForegroundColor Cyan
Write-Host '本版本只验证独立页面注入，不启用 Millennium / Extendium，也不执行汉化。' -ForegroundColor Yellow
Write-Host ''

$node = Get-Command node -ErrorAction SilentlyContinue
if (!$node) { throw '未找到 Node.js。需要 Node.js 22 或更高版本。' }
$nodeVersion = (& node -p 'process.versions.node').Trim()
$major = [int]($nodeVersion.Split('.')[0])
if ($major -lt 22) { throw "当前 Node.js $nodeVersion 低于要求；需要 Node.js 22+。" }

$steamProcess = Get-Process -Name 'steam' -ErrorAction SilentlyContinue
if ($steamProcess) {
    throw 'Steam 当前仍在运行。请使用 Steam 菜单中的“退出”正常关闭（不要强制结束进程），确认 Steam 完全退出后，再双击本目录的 Start-Steam-Bridge.bat。'
}

$portListeners = @(Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue)
if ($portListeners.Count -gt 0) {
    $owners = $portListeners | ForEach-Object {
        $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        [PSCustomObject]@{ Address = $_.LocalAddress; Process = $process.ProcessName; PID = $_.OwningProcess }
    }
    $owners | Format-Table -AutoSize | Out-Host
    throw '本机 8080 端口已经被占用。为避免连错调试目标，本原型不会自动切换端口。请先确认占用进程并关闭它。'
}

$steamPath = Get-SteamInstallPath
$steamExe = Join-Path $steamPath 'steam.exe'
Write-Host "Steam: $steamExe"
Write-Host '启动参数: -cef-enable-debugging（不启用 -dev，不禁用沙箱）'
Write-Host ''
Write-Host '注意：Steam 的 CDP 端口不带身份认证。请只在信任的本机环境中使用此原型。' -ForegroundColor Yellow
Write-Host '现在启动 Steam；桥接程序将只连接 127.0.0.1:8080。' -ForegroundColor Green

Start-Process -FilePath $steamExe -ArgumentList @('-cef-enable-debugging') -WorkingDirectory $steamPath
Wait-SteamCdpLoopback -Port 8080 -TimeoutSeconds 180
& node (Join-Path $PSScriptRoot '..\src\bridge.mjs')
