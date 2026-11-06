$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $repoRoot 'dist'
$runtimeStage = Join-Path $distRoot '_runtime-vfs'
$runtimeZip = Join-Path $distRoot '_runtime-vfs.zip'
$packageRoot = Join-Path $distRoot '_windows-package'
$packageZip = Join-Path $distRoot 'Alaxee-SteamHub-Windows-x64.zip'
$configPath = Join-Path $distRoot '_sea-config.json'
$executablePath = Join-Path $packageRoot 'AlaxeeSteamBridge.exe'

if ($PSVersionTable.PSVersion.Major -lt 5) {
    throw 'Windows PowerShell 5.1 or later is required by the build script.'
}

$node = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
$nodeVersion = (& $node.Source -p 'process.versions.node').Trim()
$nodeParts = $nodeVersion.Split('.')
$nodeMajor = [int]$nodeParts[0]
$nodeMinor = [int]$nodeParts[1]
if ($nodeMajor -lt 26 -or ($nodeMajor -eq 26 -and $nodeMinor -lt 9)) {
    throw "Node.js $nodeVersion cannot build the required SEA virtual file system. Node.js 26.9+ is required for packaging."
}

if (Test-Path -LiteralPath $runtimeStage) { Remove-Item -LiteralPath $runtimeStage -Recurse -Force }
if (Test-Path -LiteralPath $packageRoot) { Remove-Item -LiteralPath $packageRoot -Recurse -Force }
if (Test-Path -LiteralPath $runtimeZip) { Remove-Item -LiteralPath $runtimeZip -Force }
if (Test-Path -LiteralPath $packageZip) { Remove-Item -LiteralPath $packageZip -Force }
if (Test-Path -LiteralPath $configPath) { Remove-Item -LiteralPath $configPath -Force }

New-Item -ItemType Directory -Path (Join-Path $runtimeStage 'src') -Force | Out-Null
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'scripts') -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $repoRoot 'src\bridge.mjs') -Destination (Join-Path $runtimeStage 'src\bridge.mjs')
Copy-Item -LiteralPath (Join-Path $repoRoot 'src\page-runtime.js') -Destination (Join-Path $runtimeStage 'src\page-runtime.js')

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $runtimeStage,
    $runtimeZip,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)

$config = @{
    main = (Resolve-Path -LiteralPath (Join-Path $repoRoot 'build\sea-entry.mjs')).Path
    mainFormat = 'module'
    output = $executablePath
    useVfs = $true
    vfsArchive = $runtimeZip
    useSnapshot = $false
    useCodeCache = $false
    execArgvExtension = 'none'
}
$configJson = $config | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($configPath, $configJson, [System.Text.UTF8Encoding]::new($false))

Push-Location $repoRoot
try {
    & $node.Source --build-sea $configPath
    if ($LASTEXITCODE -ne 0) {
        throw "Node.js SEA build failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

if (!(Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    throw 'The SEA executable was not created.'
}

& $executablePath --self-test
if ($LASTEXITCODE -ne 0) {
    throw "The packaged executable self-test failed with exit code $LASTEXITCODE."
}

Copy-Item -LiteralPath (Join-Path $repoRoot 'Start-Steam-Bridge.bat') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $repoRoot 'Attach-To-Running-Steam.bat') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $repoRoot 'README.zh-CN.md') -Destination $packageRoot
Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts\Start-AlaxeeSteamBridge.ps1') -Destination (Join-Path $packageRoot 'scripts')
Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts\Attach-ToRunningSteam.ps1') -Destination (Join-Path $packageRoot 'scripts')
Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts\Assert-SteamCdpLoopback.ps1') -Destination (Join-Path $packageRoot 'scripts')

[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $packageRoot,
    $packageZip,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)

Write-Host "Windows x64 package created: $packageZip" -ForegroundColor Green
Write-Host "Bundled executable size: $((Get-Item -LiteralPath $executablePath).Length) bytes"
