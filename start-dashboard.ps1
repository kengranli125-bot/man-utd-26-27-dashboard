$ErrorActionPreference = 'Stop'

$port = 4173
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = 'C:\Python314\python.exe'

if (-not (Test-Path -LiteralPath $python)) {
  $python = (Get-Command python -ErrorAction Stop).Source
}

$existing = netstat -ano | Select-String ":$port\s+.*LISTENING"
if ($existing) {
  Write-Host "Dashboard is already running: http://localhost:$port"
  exit 0
}

$process = Start-Process -FilePath $python `
  -ArgumentList '-m', 'http.server', "$port", '--bind', '0.0.0.0' `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -PassThru

Start-Sleep -Milliseconds 800
if ($process.HasExited) {
  throw 'Dashboard server failed to start.'
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host "Computer: http://localhost:$port"
if ($ip) {
  Write-Host "Phone:    http://${ip}:$port"
}
