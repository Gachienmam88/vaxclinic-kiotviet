# Start every backend service + the built frontend as separate, minimized windows (dev / single machine).
# Each JVM is capped (machine has little free RAM). Services already listening on their port are skipped.
# Usage (repo root): powershell -ExecutionPolicy Bypass -File scripts\start-all-local.ps1
# Logs: %TEMP%\vax-<service>.log   Stop: close the windows, or scripts\stop-all-local.ps1

$root = Split-Path -Parent $PSScriptRoot
$services = @(
    @{ Module = 'identity-service';    Port = 8081; Heap = '256m' },
    @{ Module = 'product-service';     Port = 8082; Heap = '256m' },
    @{ Module = 'sales-service';       Port = 8086; Heap = '256m' },
    @{ Module = 'integration-service'; Port = 8088; Heap = '256m' },
    @{ Module = 'gateway-service';     Port = 8090; Heap = '192m' }
)

function Test-Port([int]$port) {
    [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

foreach ($s in $services) {
    if (Test-Port $s.Port) { Write-Host "$($s.Module) already running on :$($s.Port)"; continue }
    $log = Join-Path $env:TEMP "vax-$($s.Module).log"
    $cmd = "`$env:JAVA_TOOL_OPTIONS='-Xmx$($s.Heap) -Xss512k -XX:+UseSerialGC -XX:TieredStopAtLevel=1'; " +
           "& '$root\scripts\run-backend-service-locally.ps1' $($s.Module) *> '$log'"
    Start-Process powershell -WindowStyle Minimized -WorkingDirectory $root -ArgumentList '-NoProfile', '-Command', $cmd
    Write-Host "Started $($s.Module) (log: $log)"
    Start-Sleep -Seconds 4   # stagger JVM start-up to avoid a memory spike
}

if (Test-Port 3010) {
    Write-Host 'frontend already running on :3010'
} else {
    $log = Join-Path $env:TEMP 'vax-frontend.log'
    Start-Process powershell -WindowStyle Minimized -WorkingDirectory (Join-Path $root 'frontend') `
        -ArgumentList '-NoProfile', '-Command', "npx next start -p 3010 *> '$log'"
    Write-Host "Started frontend on http://localhost:3010 (log: $log)"
}
