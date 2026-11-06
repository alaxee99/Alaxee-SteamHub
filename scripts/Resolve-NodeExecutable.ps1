function Resolve-NodeExecutable {
    if (![string]::IsNullOrWhiteSpace($env:ALAXEE_NODE_EXE)) {
        $explicitPath = [Environment]::ExpandEnvironmentVariables($env:ALAXEE_NODE_EXE.Trim('"'))
        if (Test-Path -LiteralPath $explicitPath -PathType Leaf) {
            return (Resolve-Path -LiteralPath $explicitPath).Path
        }
        throw "ALAXEE_NODE_EXE is set but does not point to a file: $explicitPath"
    }

    $command = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command -and (Test-Path -LiteralPath $command.Source -PathType Leaf)) {
        return $command.Source
    }

    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    foreach ($pathEntry in (@($userPath, $machinePath) -join ';').Split(';')) {
        $directory = [Environment]::ExpandEnvironmentVariables(([string]$pathEntry).Trim('"', ' '))
        if (![string]::IsNullOrWhiteSpace($directory)) {
            $pathCandidate = Join-Path $directory 'node.exe'
            if (Test-Path -LiteralPath $pathCandidate -PathType Leaf) {
                return (Resolve-Path -LiteralPath $pathCandidate).Path
            }
        }
    }

    $programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    $candidates = @(
        $(if ($env:ProgramFiles) { Join-Path $env:ProgramFiles 'nodejs\node.exe' }),
        $(if ($programFilesX86) { Join-Path $programFilesX86 'nodejs\node.exe' }),
        $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe' }),
        $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Volta\bin\node.exe' }),
        $(if ($env:VOLTA_HOME) { Join-Path $env:VOLTA_HOME 'bin\node.exe' }),
        $(if ($env:NVM_SYMLINK) { Join-Path $env:NVM_SYMLINK 'node.exe' }),
        $(if ($env:FNM_MULTISHELL_PATH) { Join-Path $env:FNM_MULTISHELL_PATH 'node.exe' }),
        $(if ($env:FNM_DIR) { Join-Path $env:FNM_DIR 'aliases\default\node.exe' }),
        $(if ($env:USERPROFILE) { Join-Path $env:USERPROFILE 'scoop\apps\nodejs\current\node.exe' })
    )

    foreach ($candidate in $candidates) {
        if (![string]::IsNullOrWhiteSpace([string]$candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw 'Node.js 22+ was not found. The launcher checked process PATH, saved Windows PATH entries, and common installation folders. Set ALAXEE_NODE_EXE to the full node.exe path, or add the Node.js folder to Windows PATH.'
}
