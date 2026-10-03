$gameDir = Split-Path -Parent $PSScriptRoot
$hostKeyFile = Join-Path $gameDir 'data\host.key'
if (Test-Path -LiteralPath $hostKeyFile) {
    try {
        $hostStopKey = (Get-Content -LiteralPath $hostKeyFile -Raw).Trim()
        Invoke-RestMethod -Uri 'http://127.0.0.1:4317/api/host/stop' -Method Post -Headers @{ Authorization = ('Bearer ' + $hostStopKey) } -TimeoutSec 2 | Out-Null
        Start-Sleep -Milliseconds 300
    } catch {}
}
foreach ($pidFile in @('tunnel.pid','server.pid')) {
    $recordPath = Join-Path $gameDir ('data\' + $pidFile)
    if (Test-Path -LiteralPath $recordPath) {
        $recordPid = 0
        if ([int]::TryParse((Get-Content -LiteralPath $recordPath -Raw).Trim(), [ref]$recordPid)) {
            $recordProcess = Get-Process -Id $recordPid -ErrorAction SilentlyContinue
            if ($recordProcess -and $recordProcess.ProcessName -in @('node','cloudflared')) { Stop-Process -Id $recordPid }
        }
        Remove-Item -LiteralPath $recordPath -ErrorAction SilentlyContinue
    }
}
Write-Host 'Hosting stopped. Your saved worlds are in data\worlds.'
