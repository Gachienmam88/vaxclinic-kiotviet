# Stop the processes started by start-all-local.ps1 (anything listening on the app ports).
# Usage (repo root): powershell -ExecutionPolicy Bypass -File scripts\stop-all-local.ps1

foreach ($port in 8081, 8082, 8086, 8088, 8090, 3010) {
    $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $owners) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped process $procId on :$port"
    }
}
