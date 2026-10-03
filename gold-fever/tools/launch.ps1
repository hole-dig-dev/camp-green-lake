param([switch]$NoBrowser)
$gameDir = Split-Path -Parent $PSScriptRoot
$dataDir = Join-Path $gameDir 'data'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$gameNode = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $gameNode) {
    $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path -LiteralPath $bundledNode) { $gameNode = $bundledNode }
}
if (-not $gameNode) { Write-Host 'Install Node.js 22 or newer, then run this launcher again.'; exit 1 }
if (-not (Test-Path -LiteralPath (Join-Path $gameDir 'node_modules\ws'))) {
    Push-Location -LiteralPath $gameDir
    & npm.cmd install --no-audit --no-fund --cache (Join-Path $dataDir 'npm-cache')
    Pop-Location
    if ($LASTEXITCODE -ne 0) { exit 1 }
}
$running = $false
try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/api/health' -TimeoutSec 2; $running = $health.game -eq 'Gold Fever' } catch {}
if (-not $running) {
    $gameProcess = Start-Process -FilePath $gameNode -ArgumentList 'server.mjs' -WorkingDirectory $gameDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataDir 'server.log') -RedirectStandardError (Join-Path $dataDir 'server-error.log') -PassThru
    $gameProcess.Id | Set-Content -LiteralPath (Join-Path $dataDir 'server.pid')
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:4317/api/health' -TimeoutSec 1; if ($health.game -eq 'Gold Fever') { $running = $true; break } } catch {}
    }
}
if (-not $running) { Write-Host 'The server did not start. Check data\server-error.log.'; exit 1 }
Write-Host 'Gold Fever is running at http://localhost:4317'
Write-Host 'Run Share with Friend.cmd for an Internet link. Stop Hosting.cmd closes the server.'
if (-not $NoBrowser) {
    $playUrl = 'http://localhost:4317'
    try { Start-Process $playUrl -ErrorAction Stop }
    catch {
        $browserCandidates = @(
            (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
            (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
            (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
        )
        $playBrowser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        if ($playBrowser) {
            try { Start-Process -FilePath $playBrowser -ArgumentList $playUrl -WindowStyle Normal -ErrorAction Stop }
            catch { Write-Host ('Open this address in Chrome or Edge: ' + $playUrl) }
        } else { Write-Host ('Open this address in Chrome or Edge: ' + $playUrl) }
    }
}
