<#
  Backup the POS PostgreSQL database with pg_dump running inside the Docker container.
  Usage: powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1 [-Keep 14] [-Container pos-postgres]
  Schedule it with Windows Task Scheduler (see docs/deployment-guide.md).
  Connection info comes from DATABASE_URL in the environment config file; the password is never printed.
  Messages are ASCII on purpose: PowerShell 5.1 reads BOM-less files as ANSI.
#>
param(
  [int]$Keep = 14,
  [string]$Container = "pos-postgres"
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) { throw "Environment config file not found: $envFile" }
$line = Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $line) { throw "DATABASE_URL not found in the environment config file." }
$value = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
$uri = [Uri]$value
$parts = $uri.UserInfo.Split(':', 2)
$dbUser = [Uri]::UnescapeDataString($parts[0])
$dbPass = if ($parts.Length -gt 1) { [Uri]::UnescapeDataString($parts[1]) } else { "" }
$dbName = $uri.AbsolutePath.TrimStart('/')

$outDir = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$target = Join-Path $outDir "pos-$stamp.sql"
$inContainer = "/tmp/pos-$stamp.sql"

# PGPASSWORD travels through the process environment, not the command line.
$env:PGPASSWORD = $dbPass
try {
  docker exec -e PGPASSWORD $Container pg_dump -U $dbUser -d $dbName --no-owner -f $inContainer
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit code $LASTEXITCODE)." }
  docker cp "${Container}:$inContainer" $target
  if ($LASTEXITCODE -ne 0) { throw "Could not copy the dump out of the container." }
  docker exec $Container rm -f $inContainer | Out-Null
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if (-not (Test-Path $target) -or (Get-Item $target).Length -lt 1024) {
  throw "Backup file is missing or too small: $target"
}

# Keep only the newest $Keep dumps.
Get-ChildItem $outDir -Filter "pos-*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item -Force

Write-Host "Backup written: $target ($([math]::Round((Get-Item $target).Length / 1KB)) KB)"
