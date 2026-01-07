# Staging Health Monitor
# Usage: .\scripts\monitor-staging.ps1

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Staging Health Monitor" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
Get-Content .env.staging | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

$dbUrl = $env:DATABASE_URL
$redisUrl = $env:REDIS_URL

Write-Host "1. PostgreSQL Connection:" -ForegroundColor Yellow
try {
    $result = psql "$dbUrl" -c "SELECT 1;" -t 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    Connected" -ForegroundColor Green
    } else {
        Write-Host "    Connection failed" -ForegroundColor Red
    }
} catch {
    Write-Host "    Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Redis Connection:" -ForegroundColor Yellow
try {
    $result = redis-cli -u "$redisUrl" PING 2>&1
    if ($result -match "PONG") {
        Write-Host "    Connected (PONG)" -ForegroundColor Green
    } else {
        Write-Host "    Connection failed" -ForegroundColor Red
    }
} catch {
    Write-Host "    Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Database Tables:" -ForegroundColor Yellow
try {
    $tableCount = psql "$dbUrl" -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public';" -t 2>&1
    Write-Host "   Total tables: $($tableCount.Trim())" -ForegroundColor Green
} catch {
    Write-Host "    Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. Test Data:" -ForegroundColor Yellow
try {
    $eurusdCount = psql "$dbUrl" -c "SELECT COUNT(*) FROM eurusd_h1;" -t 2>&1
    $btcusdCount = psql "$dbUrl" -c "SELECT COUNT(*) FROM btcusd_m5;" -t 2>&1
    Write-Host "   eurusd_h1: $($eurusdCount.Trim()) rows" -ForegroundColor Green
    Write-Host "   btcusd_m5: $($btcusdCount.Trim()) rows" -ForegroundColor Green
} catch {
    Write-Host "    Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Monitoring complete" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
