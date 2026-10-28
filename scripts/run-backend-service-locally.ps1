# Run one backend service from its built jar using values in ./.env (dev only).
# Usage: ./scripts/run-backend-service-locally.ps1 identity-service
param([Parameter(Mandatory = $true)][string]$Module)

$root = Split-Path -Parent $PSScriptRoot
Get-Content (Join-Path $root '.env') | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "env:$($name.Trim())" -Value $value.Trim()
}
$port = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { '5432' }
$db = ($Module -replace '-service$', '') + '_db'
$env:DB_URL = "jdbc:postgresql://localhost:$port/$db"

$jar = Get-ChildItem (Join-Path $root "backend/$Module/target") -Filter "$Module-*.jar" | Select-Object -First 1
if (-not $jar) { throw "Jar not found. Run: cd backend; mvn package -DskipTests" }
java -jar $jar.FullName
