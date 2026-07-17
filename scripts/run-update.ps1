$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDirectory = Join-Path $root '.update-logs'
$logFile = Join-Path $logDirectory 'latest.log'

New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
Set-Location -LiteralPath $root

try {
  node scripts/update-data.mjs *>&1 | Tee-Object -FilePath $logFile
  if ($LASTEXITCODE -ne 0) {
    throw "Data update exited with code $LASTEXITCODE."
  }
  node scripts/check-update-health.mjs 0.25 *>&1 | Tee-Object -FilePath $logFile -Append
  if ($LASTEXITCODE -ne 0) {
    throw "Update health check exited with code $LASTEXITCODE."
  }
} catch {
  "[$(Get-Date -Format o)] $($_.Exception.Message)" | Add-Content -LiteralPath $logFile
  throw
}
