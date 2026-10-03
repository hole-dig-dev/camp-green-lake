param([switch]$NoBrowser)
$gameDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $gameDir 'data'
& (Join-Path $PSScriptRoot 'launch.ps1') -NoBrowser
if ($LASTEXITCODE -eq 1) { exit 1 }
$shareRecord = Join-Path $dataDir 'share-url.json'
if (Test-Path -LiteralPath $shareRecord) {
    try {
        $existingShare = Get-Content -LiteralPath $shareRecord -Raw | ConvertFrom-Json
        $existingProcess = Get-Process -Id $existingShare.pid -ErrorAction Stop
        if ($existingProcess.ProcessName -eq 'cloudflared') {
            Write-Host "Your Internet link: $($existingShare.url)"
            Write-Host 'Open it, join a room, and use Copy Invite in the game.'
            if (-not $NoBrowser) { Start-Process $existingShare.url }
            exit 0
        }
    } catch {}
}
$tunnelExe = Join-Path $PSScriptRoot 'cloudflared.exe'
if (-not (Test-Path -LiteralPath $tunnelExe)) { Write-Host 'The Cloudflare utility is missing. Re-extract the full game folder.'; exit 1 }
$tunnelLog = Join-Path $dataDir 'tunnel.log'
$tunnelOut = Join-Path $dataDir 'tunnel-out.log'
$tunnelProcess = Start-Process -FilePath $tunnelExe -ArgumentList 'tunnel','--url','http://127.0.0.1:4317','--protocol','http2','--no-autoupdate' -WorkingDirectory $gameDir -WindowStyle Hidden -RedirectStandardError $tunnelLog -RedirectStandardOutput $tunnelOut -PassThru
$tunnelProcess.Id | Set-Content -LiteralPath (Join-Path $dataDir 'tunnel.pid')
Write-Host 'Creating your temporary Internet link...'
for ($attempt = 0; $attempt -lt 90; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($tunnelProcess.HasExited) { break }
    if (Test-Path -LiteralPath $tunnelLog) {
        $tunnelText = Get-Content -LiteralPath $tunnelLog -Raw
        $urlMatch = [regex]::Match($tunnelText, 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($urlMatch.Success) {
            @{ url = $urlMatch.Value; pid = $tunnelProcess.Id; created = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $shareRecord
            Write-Host "Your Internet link: $($urlMatch.Value)"
            Write-Host 'Open this link yourself. Join a room, then use Copy Invite to give your friend the same room.'
            Write-Host 'Keep this computer awake. The link works while the server and tunnel are running.'
            if (-not $NoBrowser) { Start-Process $urlMatch.Value }
            exit 0
        }
    }
}
Write-Host 'The tunnel could not connect. Check data\tunnel.log. You can still play on the same network.'
exit 1
