function Wait-SteamCdpLoopback {
    param(
        [int]$Port = 8080,
        [int]$TimeoutSeconds = 180
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastError = '等待 Steam CEF 调试端口开放。'

    while ((Get-Date) -lt $deadline) {
        $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
        if ($listeners.Count -gt 0) {
            $allowed = @('127.0.0.1', '::1')
            $unsafe = @($listeners | Where-Object { $_.LocalAddress -notin $allowed })
            if ($unsafe.Count -gt 0) {
                $unsafe | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize | Out-Host
                throw "Steam CDP port $Port is listening on a non-loopback address. The bridge refuses to attach."
            }

            foreach ($uri in @("http://127.0.0.1:$Port/json/version", "http://[::1]:$Port/json/version")) {
                try {
                    $version = Invoke-RestMethod -Uri $uri -TimeoutSec 2
                    if ($version.webSocketDebuggerUrl) {
                        $ws = [Uri]$version.webSocketDebuggerUrl
                        $wsHost = $ws.Host.Trim('[', ']')
                        if ($wsHost -notin $allowed -or $ws.Port -ne $Port) {
                            throw "Steam advertised an unsafe CDP endpoint: $($version.webSocketDebuggerUrl)"
                        }
                        Write-Host "Steam CEF CDP ready at $uri" -ForegroundColor Green
                        return
                    }
                }
                catch {
                    $lastError = $_.Exception.Message
                }
            }
        }
        Start-Sleep -Seconds 2
    }

    throw "Steam CEF CDP did not become ready on a loopback address within $TimeoutSeconds seconds. Last check: $lastError"
}
