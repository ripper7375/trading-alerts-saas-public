# Monitoring Setup Guide

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Monitoring Architecture](#monitoring-architecture)
3. [Contabo VPS Monitoring](#contabo-vps-monitoring)
4. [MT5 Service Monitoring](#mt5-service-monitoring)
5. [Sync Script Monitoring](#sync-script-monitoring)
6. [Railway Monitoring](#railway-monitoring)
7. [Vercel Monitoring](#vercel-monitoring)
8. [Alert Configuration](#alert-configuration)
9. [Dashboard Setup](#dashboard-setup)
10. [Log Management](#log-management)

---

## Overview

Comprehensive monitoring ensures the data pipeline operates reliably 24/7.

**Monitoring Layers:**
```
┌──────────────────────────────────────────────────────────────┐
│ LAYER 1: Infrastructure (Contabo VPS)                        │
│   - CPU, Memory, Disk, Network                               │
├──────────────────────────────────────────────────────────────┤
│ LAYER 2: Application (MT5, Sync Script)                      │
│   - Service status, Data collection rate, Sync success       │
├──────────────────────────────────────────────────────────────┤
│ LAYER 3: Database (PostgreSQL, Redis)                        │
│   - Connections, Query performance, Memory usage             │
├──────────────────────────────────────────────────────────────┤
│ LAYER 4: API (Vercel)                                        │
│   - Response times, Error rates, Cache hit rate              │
└──────────────────────────────────────────────────────────────┘
```

---

## Monitoring Architecture

### Components to Monitor

| Component | Location | Critical Metrics |
|-----------|----------|------------------|
| VPS | Contabo | CPU, Memory, Disk, Network |
| MT5 Terminals | VPS | Process status, Memory usage |
| DataCollector | VPS (MT5) | Service running, Data output |
| SQLite | VPS | Size, Write rate, Lock status |
| Sync Script | VPS | Success rate, Sync time |
| PostgreSQL | Railway | Connections, Size, Performance |
| Redis | Railway | Memory, Hit rate, Connections |
| API | Vercel | Response time, Error rate |

### Monitoring Tools

| Tool | Purpose | Location |
|------|---------|----------|
| Windows Performance Monitor | VPS metrics | Contabo |
| PowerShell scripts | Custom monitoring | Contabo |
| Railway Dashboard | Database metrics | Railway |
| Vercel Analytics | API metrics | Vercel |
| Custom health checks | End-to-end | All |

---

## Contabo VPS Monitoring

### 1. Performance Monitor Setup

```powershell
# Create Performance Monitor Data Collector Set
$name = "TradingAlerts_Monitoring"

# Create data collector set
logman create counter $name -f bincirc -max 100 -si 30 `
    -c "\Processor(_Total)\% Processor Time" `
    -c "\Memory\Available MBytes" `
    -c "\Memory\% Committed Bytes In Use" `
    -c "\PhysicalDisk(_Total)\% Disk Time" `
    -c "\PhysicalDisk(_Total)\Disk Bytes/sec" `
    -c "\Network Interface(*)\Bytes Total/sec"

# Start data collection
logman start $name

Write-Host "Performance monitoring started"
```

### 2. Disk Space Monitoring

```powershell
# File: C:\Scripts\monitoring\check_disk.ps1

$threshold = 20  # GB

$disk = Get-PSDrive C
$freeGB = [math]::Round($disk.Free / 1GB, 2)

if ($freeGB -lt $threshold) {
    $message = "WARNING: Disk space low! Free: ${freeGB}GB"
    Write-Host $message -ForegroundColor Red

    # Log to file
    Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - DISK_LOW - $message"

    # Optional: Send email alert
    # Send-MailMessage -To "admin@example.com" -Subject "Disk Space Alert" -Body $message
} else {
    Write-Host "Disk space OK: ${freeGB}GB free" -ForegroundColor Green
}
```

### 3. Memory Monitoring

```powershell
# File: C:\Scripts\monitoring\check_memory.ps1

$threshold = 90  # percent

$memory = Get-CimInstance Win32_OperatingSystem
$usedPercent = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 2)

if ($usedPercent -gt $threshold) {
    $message = "WARNING: Memory usage high! Used: ${usedPercent}%"
    Write-Host $message -ForegroundColor Red
    Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - MEMORY_HIGH - $message"
} else {
    Write-Host "Memory OK: ${usedPercent}% used" -ForegroundColor Green
}
```

### 4. Network Connectivity Check

```powershell
# File: C:\Scripts\monitoring\check_network.ps1

$targets = @(
    @{Name="Railway PostgreSQL"; Host="turntable.proxy.rlwy.net"; Port=55082},
    @{Name="Railway Redis"; Host="switchyard.proxy.rlwy.net"; Port=47725},
    @{Name="Internet"; Host="google.com"; Port=443}
)

foreach ($target in $targets) {
    $result = Test-NetConnection -ComputerName $target.Host -Port $target.Port -WarningAction SilentlyContinue

    if ($result.TcpTestSucceeded) {
        Write-Host "[OK] $($target.Name)" -ForegroundColor Green
    } else {
        $message = "CRITICAL: $($target.Name) unreachable!"
        Write-Host $message -ForegroundColor Red
        Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - NETWORK_FAIL - $message"
    }
}
```

---

## MT5 Service Monitoring

### 1. MT5 Process Monitor

```powershell
# File: C:\Scripts\monitoring\check_mt5.ps1

$expectedInstances = 15
$symbols = @("AUDJPY","AUDUSD","BTCUSD","ETHUSD","EURUSD",
             "GBPJPY","GBPUSD","NDX100","NZDUSD","US30",
             "USDCAD","USDCHF","USDJPY","XAGUSD","XAUUSD")

$mt5Processes = Get-Process | Where-Object {$_.ProcessName -eq "terminal64"}
$runningCount = $mt5Processes.Count

Write-Host "MT5 Instances Running: $runningCount / $expectedInstances"

if ($runningCount -lt $expectedInstances) {
    $message = "WARNING: Only $runningCount of $expectedInstances MT5 instances running!"
    Write-Host $message -ForegroundColor Yellow

    # Check which instances are missing
    foreach ($symbol in $symbols) {
        $exePath = "C:\MT5Terminals\MT5_$symbol\terminal64.exe"
        $running = $mt5Processes | Where-Object {$_.Path -eq $exePath}

        if (-not $running) {
            Write-Host "  Missing: MT5_$symbol" -ForegroundColor Red
        }
    }

    Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - MT5_DOWN - $message"
}

# Report memory usage
$totalMemMB = ($mt5Processes | Measure-Object WorkingSet64 -Sum).Sum / 1MB
Write-Host "Total MT5 Memory: $([math]::Round($totalMemMB, 0)) MB"
```

### 2. DataCollector Activity Monitor

```powershell
# File: C:\Scripts\monitoring\check_datacollector.ps1

$dbPath = "C:\MT5Data\trading_data.db"
$maxAge = 120  # seconds - alert if no new data in 2 minutes

# Check last modification time
$lastModified = (Get-Item $dbPath).LastWriteTime
$age = (Get-Date) - $lastModified

if ($age.TotalSeconds -gt $maxAge) {
    $message = "WARNING: SQLite not updated in $([math]::Round($age.TotalMinutes, 1)) minutes!"
    Write-Host $message -ForegroundColor Red
    Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - DATACOLLECTOR_STALE - $message"
} else {
    Write-Host "DataCollector active: Last update $([math]::Round($age.TotalSeconds, 0))s ago" -ForegroundColor Green
}

# Check row counts per symbol
$symbols = @("eurusd","btcusd","xauusd")  # Sample check
foreach ($symbol in $symbols) {
    $count = & sqlite3 $dbPath "SELECT COUNT(*) FROM $symbol;"
    $latest = & sqlite3 $dbPath "SELECT datetime(MAX(timestamp), 'unixepoch') FROM $symbol;"
    Write-Host "  $symbol : $count rows, latest: $latest"
}
```

### 3. SQLite Health Check

```powershell
# File: C:\Scripts\monitoring\check_sqlite.ps1

$dbPath = "C:\MT5Data\trading_data.db"

# Check database size
$sizeMB = (Get-Item $dbPath).Length / 1MB
Write-Host "SQLite Size: $([math]::Round($sizeMB, 2)) MB"

# Check integrity
$integrity = & sqlite3 $dbPath "PRAGMA integrity_check;"
if ($integrity -eq "ok") {
    Write-Host "Integrity: OK" -ForegroundColor Green
} else {
    Write-Host "Integrity: FAILED" -ForegroundColor Red
    Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - SQLITE_CORRUPT - $integrity"
}

# Check table count
$tableCount = & sqlite3 $dbPath "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
Write-Host "Tables: $tableCount (expected: 15)"

# Alert if size exceeds threshold
$maxSizeMB = 500
if ($sizeMB -gt $maxSizeMB) {
    Write-Host "WARNING: Database size exceeds ${maxSizeMB}MB!" -ForegroundColor Yellow
}
```

---

## Sync Script Monitoring

### 1. Sync Status Check

```powershell
# File: C:\Scripts\monitoring\check_sync.ps1

$logPath = "C:\Scripts\sync_package\sync.log"
$statePath = "C:\Scripts\sync_package\sync_state.json"
$maxAge = 120  # seconds

# Check sync_state.json age
if (Test-Path $statePath) {
    $stateAge = (Get-Date) - (Get-Item $statePath).LastWriteTime

    if ($stateAge.TotalSeconds -gt $maxAge) {
        $message = "WARNING: Sync hasn't run in $([math]::Round($stateAge.TotalMinutes, 1)) minutes!"
        Write-Host $message -ForegroundColor Red
        Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - SYNC_STALE - $message"
    } else {
        Write-Host "Sync Status: Active (last run $([math]::Round($stateAge.TotalSeconds, 0))s ago)" -ForegroundColor Green
    }
}

# Check for recent errors
$recentErrors = Get-Content $logPath -Tail 100 | Select-String "ERROR"
if ($recentErrors) {
    Write-Host "Recent Errors: $($recentErrors.Count)" -ForegroundColor Yellow
    $recentErrors | Select-Object -Last 3 | ForEach-Object { Write-Host "  $_" }
}

# Check last completion message
$lastCompletion = Get-Content $logPath | Select-String "Sync completed" | Select-Object -Last 1
if ($lastCompletion) {
    Write-Host "Last completion: $($lastCompletion.Line)"
}
```

### 2. Task Scheduler Monitor

```powershell
# File: C:\Scripts\monitoring\check_task.ps1

$taskName = "TradingAlertsSyncTask"

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
    Write-Host "CRITICAL: Scheduled task '$taskName' not found!" -ForegroundColor Red
    exit 1
}

$taskInfo = Get-ScheduledTaskInfo -TaskName $taskName

Write-Host "Task: $taskName"
Write-Host "  State: $($task.State)"
Write-Host "  Last Run: $($taskInfo.LastRunTime)"
Write-Host "  Last Result: $($taskInfo.LastTaskResult)"
Write-Host "  Next Run: $($taskInfo.NextRunTime)"

# Check task state
if ($task.State -ne "Running" -and $task.State -ne "Ready") {
    $message = "WARNING: Task state is '$($task.State)'"
    Write-Host $message -ForegroundColor Yellow
    Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - TASK_ABNORMAL - $message"
}

# Check last result (0 = success)
if ($taskInfo.LastTaskResult -ne 0) {
    $message = "WARNING: Last task result was $($taskInfo.LastTaskResult)"
    Write-Host $message -ForegroundColor Yellow
}
```

---

## Railway Monitoring

### 1. PostgreSQL Monitoring Script

```powershell
# File: C:\Scripts\monitoring\check_postgresql.ps1

python -c @"
import psycopg2
import os

uri = os.environ.get('POSTGRESQL_URI')
conn = psycopg2.connect(uri)
cursor = conn.cursor()

# Database size
cursor.execute('SELECT pg_database_size(current_database()) / 1024 / 1024 as size_mb')
size_mb = cursor.fetchone()[0]
print(f'Database Size: {size_mb:.2f} MB')

# Active connections
cursor.execute('SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()')
connections = cursor.fetchone()[0]
print(f'Active Connections: {connections}')

# Table row counts (sample)
tables = ['eurusd_m5', 'eurusd_h1', 'btcusd_m5']
for table in tables:
    cursor.execute(f'SELECT COUNT(*) FROM {table}')
    count = cursor.fetchone()[0]
    print(f'  {table}: {count} rows')

# Recent data check
cursor.execute('SELECT MAX(timestamp) FROM eurusd_m5')
latest = cursor.fetchone()[0]
print(f'Latest data: {latest}')

conn.close()
"@
```

### 2. Redis Monitoring Script

```powershell
# File: C:\Scripts\monitoring\check_redis.ps1

python -c @"
import redis
import os

url = os.environ.get('REDIS_URL')
r = redis.from_url(url)

info = r.info()

print('Redis Status:')
print(f'  Version: {info[\"redis_version\"]}')
print(f'  Connected Clients: {info[\"connected_clients\"]}')
print(f'  Used Memory: {info[\"used_memory_human\"]}')
print(f'  Peak Memory: {info[\"used_memory_peak_human\"]}')
print(f'  Total Keys: {r.dbsize()}')

# Cache key count by pattern
trading_keys = len(r.keys('trading:*'))
print(f'  Trading Cache Keys: {trading_keys}')

# Memory usage check
used_mb = info['used_memory'] / 1024 / 1024
if used_mb > 100:  # Alert if > 100MB
    print(f'WARNING: Redis memory usage high ({used_mb:.1f}MB)')
"@
```

---

## Vercel Monitoring

### 1. API Health Check

```powershell
# File: C:\Scripts\monitoring\check_api.ps1

$baseUrl = "https://your-app.vercel.app"
$endpoints = @(
    "/api/health",
    "/api/indicators/EURUSD/H1"
)

foreach ($endpoint in $endpoints) {
    $url = "$baseUrl$endpoint"

    try {
        $start = Get-Date
        $response = Invoke-RestMethod $url -TimeoutSec 30
        $duration = ((Get-Date) - $start).TotalMilliseconds

        if ($duration -gt 1000) {
            Write-Host "[SLOW] $endpoint : ${duration}ms" -ForegroundColor Yellow
        } else {
            Write-Host "[OK] $endpoint : ${duration}ms" -ForegroundColor Green
        }
    } catch {
        Write-Host "[FAIL] $endpoint : $($_.Exception.Message)" -ForegroundColor Red
        Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - API_FAIL - $endpoint"
    }
}
```

### 2. End-to-End Data Freshness Check

```powershell
# File: C:\Scripts\monitoring\check_data_freshness.ps1

$url = "https://your-app.vercel.app/api/indicators/EURUSD/M5"
$maxAgeSeconds = 120  # Data should be < 2 minutes old

try {
    $response = Invoke-RestMethod $url
    $latestTimestamp = $response.data.timestamp

    if ($latestTimestamp) {
        $dataAge = (Get-Date) - [datetime]$latestTimestamp
        $ageSeconds = $dataAge.TotalSeconds

        if ($ageSeconds -gt $maxAgeSeconds) {
            $message = "WARNING: API data is $([math]::Round($ageSeconds/60, 1)) minutes old!"
            Write-Host $message -ForegroundColor Yellow
            Add-Content "C:\Logs\alerts.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - DATA_STALE - $message"
        } else {
            Write-Host "Data freshness OK: $([math]::Round($ageSeconds, 0))s old" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "Failed to check data freshness: $($_.Exception.Message)" -ForegroundColor Red
}
```

---

## Alert Configuration

### 1. Master Monitoring Script

```powershell
# File: C:\Scripts\monitoring\master_check.ps1

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "Trading Alerts Monitoring - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Run all checks
Write-Host "`n[1/8] Disk Space" -ForegroundColor Yellow
& C:\Scripts\monitoring\check_disk.ps1

Write-Host "`n[2/8] Memory" -ForegroundColor Yellow
& C:\Scripts\monitoring\check_memory.ps1

Write-Host "`n[3/8] Network" -ForegroundColor Yellow
& C:\Scripts\monitoring\check_network.ps1

Write-Host "`n[4/8] MT5 Processes" -ForegroundColor Yellow
& C:\Scripts\monitoring\check_mt5.ps1

Write-Host "`n[5/8] DataCollector" -ForegroundColor Yellow
& C:\Scripts\monitoring\check_datacollector.ps1

Write-Host "`n[6/8] Sync Script" -ForegroundColor Yellow
& C:\Scripts\monitoring\check_sync.ps1

Write-Host "`n[7/8] Task Scheduler" -ForegroundColor Yellow
& C:\Scripts\monitoring\check_task.ps1

Write-Host "`n[8/8] API Health" -ForegroundColor Yellow
& C:\Scripts\monitoring\check_api.ps1

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "Monitoring Complete" -ForegroundColor Cyan
```

### 2. Schedule Monitoring Task

```powershell
# Create monitoring scheduled task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\Scripts\monitoring\master_check.ps1 >> C:\Logs\monitoring.log 2>&1"

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "TradingAlertsMonitoring" `
    -Action $action -Trigger $trigger -Settings $settings `
    -Description "Trading Alerts System Monitoring"

Write-Host "Monitoring task created (runs every 5 minutes)"
```

### 3. Alert Severity Levels

```powershell
# File: C:\Scripts\monitoring\alert_config.ps1

$AlertConfig = @{
    CRITICAL = @{
        Conditions = @(
            "NETWORK_FAIL",
            "SQLITE_CORRUPT",
            "API_FAIL"
        )
        Action = "ImmediateNotification"
    }
    WARNING = @{
        Conditions = @(
            "DISK_LOW",
            "MEMORY_HIGH",
            "MT5_DOWN",
            "DATACOLLECTOR_STALE",
            "SYNC_STALE",
            "DATA_STALE"
        )
        Action = "LogAndNotify"
    }
    INFO = @{
        Conditions = @(
            "TASK_ABNORMAL"
        )
        Action = "LogOnly"
    }
}
```

---

## Dashboard Setup

### 1. Simple HTML Dashboard

```powershell
# File: C:\Scripts\monitoring\generate_dashboard.ps1

$html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Trading Alerts Dashboard</title>
    <meta http-equiv="refresh" content="60">
    <style>
        body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 20px; }
        h1 { color: #00ff88; }
        .status { padding: 10px; margin: 5px 0; border-radius: 5px; }
        .ok { background: #0a3; }
        .warn { background: #a80; }
        .fail { background: #a00; }
        .metric { display: inline-block; min-width: 200px; }
    </style>
</head>
<body>
    <h1>Trading Alerts Dashboard</h1>
    <p>Last Updated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>

    <h2>Infrastructure</h2>
    <div class="status ok">
        <span class="metric">CPU: $((Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples.CookedValue.ToString('0.0'))%</span>
        <span class="metric">Memory: $([math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024, 0))MB free</span>
        <span class="metric">Disk: $([math]::Round((Get-PSDrive C).Free / 1GB, 1))GB free</span>
    </div>

    <h2>MT5 Terminals</h2>
    <div class="status ok">
        Running: $((Get-Process | Where-Object {`$_.ProcessName -eq 'terminal64'}).Count) / 15
    </div>

    <h2>Sync Status</h2>
    <div class="status ok">
        Last Sync: $((Get-Item 'C:\Scripts\sync_package\sync_state.json').LastWriteTime)
    </div>

    <h2>Recent Alerts</h2>
    <pre>$(Get-Content 'C:\Logs\alerts.log' -Tail 10)</pre>
</body>
</html>
"@

$html | Out-File "C:\Scripts\monitoring\dashboard.html" -Encoding UTF8
Write-Host "Dashboard generated: C:\Scripts\monitoring\dashboard.html"
```

---

## Log Management

### 1. Log Rotation Script

```powershell
# File: C:\Scripts\monitoring\rotate_logs.ps1

$logFiles = @(
    "C:\Scripts\sync_package\sync.log",
    "C:\Logs\alerts.log",
    "C:\Logs\monitoring.log"
)

$maxSizeMB = 10
$keepBackups = 5

foreach ($logFile in $logFiles) {
    if (Test-Path $logFile) {
        $sizeMB = (Get-Item $logFile).Length / 1MB

        if ($sizeMB -gt $maxSizeMB) {
            Write-Host "Rotating $logFile (${sizeMB}MB)"

            # Rotate backups
            for ($i = $keepBackups; $i -gt 0; $i--) {
                $old = "$logFile.$i"
                $new = "$logFile.$($i+1)"
                if (Test-Path $old) {
                    if ($i -eq $keepBackups) {
                        Remove-Item $old
                    } else {
                        Move-Item $old $new
                    }
                }
            }

            # Move current to .1
            Move-Item $logFile "$logFile.1"

            # Create new empty log
            New-Item $logFile -ItemType File | Out-Null
        }
    }
}
```

### 2. Log Cleanup Schedule

```powershell
# Schedule log rotation weekly
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\Scripts\monitoring\rotate_logs.ps1"

$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "03:00"

Register-ScheduledTask -TaskName "TradingAlertsLogRotation" `
    -Action $action -Trigger $trigger `
    -Description "Weekly log rotation"
```

---

## Quick Reference

### Monitoring File Structure

```
C:\Scripts\monitoring\
├── check_disk.ps1
├── check_memory.ps1
├── check_network.ps1
├── check_mt5.ps1
├── check_datacollector.ps1
├── check_sqlite.ps1
├── check_sync.ps1
├── check_task.ps1
├── check_postgresql.ps1
├── check_redis.ps1
├── check_api.ps1
├── check_data_freshness.ps1
├── master_check.ps1
├── generate_dashboard.ps1
├── rotate_logs.ps1
├── alert_config.ps1
└── dashboard.html

C:\Logs\
├── alerts.log
├── monitoring.log
└── resource_log.csv
```

### Quick Health Check

```powershell
# One-liner health check
& C:\Scripts\monitoring\master_check.ps1
```

---

## Next Steps

After monitoring setup:

1. ➡️ **[Operational Runbooks](./10-operational-runbooks.md)** - Response procedures

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
