# Stop earn-flow Vite dev servers on 8080/8081 (Windows).
$ports = 8080, 8081
$killed = 0

foreach ($port in $ports) {
  $lines = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
  foreach ($line in $lines) {
    $procId = ($line -split "\s+")[-1]
    if ($procId -match "^\d+$") {
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId" -ErrorAction SilentlyContinue
      if ($proc -and $proc.CommandLine -like "*vite.js*dev*") {
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped PID $procId (port $port)"
        $killed++
      }
    }
  }
}

if ($killed -eq 0) {
  Write-Host "No Vite dev process on 8080/8081."
} else {
  Write-Host "Done. Run: bun run dev"
}
