# Operational Runbooks

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Daily Operations Checklist](#daily-operations-checklist)
3. [Common Issues & Solutions](#common-issues--solutions)
4. [Emergency Procedures](#emergency-procedures)
5. [Maintenance Procedures](#maintenance-procedures)
6. [Disaster Recovery](#disaster-recovery)
7. [Escalation Procedures](#escalation-procedures)
8. [Contact Information](#contact-information)

---

## Overview

This runbook provides step-by-step procedures for operating and troubleshooting the Trading Alerts data pipeline.

**System Components:**
- **Contabo VPS:** Windows Server with MT5 terminals
- **MT5 Terminals:** 15 instances collecting market data
- **DataCollector:** MQL5 service writing to SQLite
- **Sync Script:** Python script syncing to PostgreSQL
- **Railway:** PostgreSQL and Redis hosting
- **Vercel:** Next.js API and frontend

---

## Daily Operations Checklist

### Morning Check (5 minutes)

```
Daily Morning Check - Trading Alerts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: ___________  Time: ___________  Operator: ___________

INFRASTRUCTURE:
[ ] VPS accessible via RDP
[ ] VPS resources normal (CPU <80%, Memory <90%, Disk >20GB)
[ ] Network connectivity to Railway OK

MT5 TERMINALS:
[ ] All 15 MT5 instances running
[ ] All DataCollector services active
[ ] No error messages in Expert tabs

DATA PIPELINE:
[ ] SQLite database being updated (check last modified time)
[ ] Sync task running (check Task Scheduler)
[ ] No errors in sync.log (last 24h)
[ ] PostgreSQL data increasing

API:
[ ] API health check passing
[ ] Response times normal (<300ms)
[ ] No elevated error rates

NOTES:
_____________________________________________
_____________________________________________

Signature: ___________
```

### Quick Health Check Command

```powershell
# One-liner morning check
& C:\Scripts\monitoring\master_check.ps1
```

---

## Common Issues & Solutions

### Issue 1: DataCollector Service Stopped

**Symptoms:**
- SQLite not updating
- No new logs in MT5 Experts tab
- sync.log shows "No new data"

**Diagnosis:**
```powershell
# Check MT5 processes
Get-Process | Where-Object {$_.ProcessName -eq "terminal64"} | Measure-Object

# Check SQLite last update
(Get-Item "C:\MT5Data\trading_data.db").LastWriteTime
```

**Solution:**
```powershell
# Step 1: Identify which instances are affected
$symbols = @("AUDJPY","AUDUSD","BTCUSD","ETHUSD","EURUSD",
             "GBPJPY","GBPUSD","NDX100","NZDUSD","US30",
             "USDCAD","USDCHF","USDJPY","XAGUSD","XAUUSD")

foreach ($symbol in $symbols) {
    $count = sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM $($symbol.ToLower());"
    $latest = sqlite3 C:\MT5Data\trading_data.db "SELECT datetime(MAX(timestamp), 'unixepoch') FROM $($symbol.ToLower());"
    Write-Host "$symbol : $count rows, latest: $latest"
}

# Step 2: Restart affected MT5 instance
# Manual: Open MT5 → Navigator → Services → DataCollector → Start

# Step 3: Or restart MT5 terminal
Start-Process "C:\MT5Terminals\MT5_EURUSD\terminal64.exe"

# Step 4: Verify service started (check Experts tab)
```

**Prevention:**
- Configure MT5 to auto-start services
- Set up monitoring alerts

---

### Issue 2: Sync Script Failing

**Symptoms:**
- PostgreSQL data not updating
- Errors in sync.log
- Task Scheduler showing failures

**Diagnosis:**
```powershell
# Check sync.log for errors
Get-Content "C:\Scripts\sync_package\sync.log" -Tail 50 | Select-String "ERROR"

# Check task status
Get-ScheduledTaskInfo -TaskName "TradingAlertsSyncTask"

# Test database connections
cd C:\Scripts\sync_package
python -c "from db_connections import test_connections; print(test_connections())"
```

**Solution A: Connection Error**
```powershell
# Step 1: Test PostgreSQL connectivity
Test-NetConnection -ComputerName turntable.proxy.rlwy.net -Port 55082

# Step 2: Verify credentials in .env
Get-Content "C:\Scripts\sync_package\.env"

# Step 3: Test manual connection
python -c @"
import psycopg2
import os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(os.environ['POSTGRESQL_URI'])
print('Connection OK')
conn.close()
"@

# Step 4: Run sync manually
python sync_to_postgresql.py
```

**Solution B: SQLite Locked**
```powershell
# Step 1: Check for lock
$lockFile = "C:\MT5Data\trading_data.db-wal"
if (Test-Path $lockFile) {
    Write-Host "WAL file exists - database may be locked"
}

# Step 2: Wait for DataCollector cycle to complete
Start-Sleep -Seconds 35

# Step 3: Retry sync
python sync_to_postgresql.py
```

**Solution C: Task Scheduler Issue**
```powershell
# Step 1: Check task state
Get-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Step 2: Restart task
Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Step 3: Check task history
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 20 | Where-Object {$_.Message -like "*TradingAlerts*"}
```

---

### Issue 3: PostgreSQL Connection Issues

**Symptoms:**
- Sync fails with connection error
- API returns 500 errors
- "Connection refused" messages

**Diagnosis:**
```powershell
# Test connectivity
Test-NetConnection -ComputerName turntable.proxy.rlwy.net -Port 55082

# Check Railway status
# (Visit Railway dashboard)
```

**Solution:**
```powershell
# Step 1: Verify Railway PostgreSQL is running
# Log into Railway dashboard → Check PostgreSQL service status

# Step 2: Check connection string hasn't changed
# Railway may rotate credentials

# Step 3: Update .env if needed
notepad C:\Scripts\sync_package\.env

# Step 4: Restart sync task
Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"
```

---

### Issue 4: Redis Connection Issues

**Symptoms:**
- API slow (no caching)
- Redis errors in Vercel logs
- Cache hit rate = 0%

**Diagnosis:**
```powershell
# Test Redis connectivity
python -c "import redis, os; r = redis.from_url(os.environ['REDIS_URL']); print(r.ping())"
```

**Solution:**
```powershell
# Step 1: Check Railway Redis status
# Log into Railway dashboard

# Step 2: Clear potentially corrupted cache
python -c "import redis, os; r = redis.from_url(os.environ['REDIS_URL']); r.flushdb(); print('Cache cleared')"

# Step 3: Verify app has correct REDIS_URL
# Check Vercel environment variables
```

---

### Issue 5: High Memory Usage on VPS

**Symptoms:**
- VPS slow or unresponsive
- MT5 terminals crashing
- Out of memory errors

**Diagnosis:**
```powershell
# Check memory usage
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name, @{N='Memory(MB)';E={[math]::Round($_.WorkingSet64/1MB,0)}}
```

**Solution:**
```powershell
# Step 1: Identify memory hogs
$mt5Procs = Get-Process | Where-Object {$_.ProcessName -eq "terminal64"} | Sort-Object WorkingSet64 -Descending

# Step 2: Restart highest memory MT5 instances
foreach ($proc in $mt5Procs | Select-Object -First 3) {
    Write-Host "Restarting PID $($proc.Id) using $([math]::Round($proc.WorkingSet64/1MB,0))MB"
    # Note: This will stop DataCollector - restart terminal instead
}

# Step 3: Clear Windows temp files
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue

# Step 4: Restart all MT5 terminals (scheduled maintenance)
# See Maintenance Procedures section
```

---

### Issue 6: API Slow Response Times

**Symptoms:**
- Response time >500ms
- Users reporting slow charts
- Monitoring alerts firing

**Diagnosis:**
```powershell
# Test API performance
Measure-Command { Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1" }

# Check if cached
$response = Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
$response.metadata.data_source  # Should be "cache" for fast responses
```

**Solution:**
```powershell
# Step 1: Warm up cache
$symbols = @("EURUSD","BTCUSD","XAUUSD")
$timeframes = @("M5","H1","D1")
foreach ($s in $symbols) {
    foreach ($t in $timeframes) {
        Invoke-RestMethod "https://your-app.vercel.app/api/indicators/$s/$t" | Out-Null
    }
}

# Step 2: Check PostgreSQL performance
# May need to add indexes or optimize queries

# Step 3: Check Redis memory
python -c "import redis, os; r = redis.from_url(os.environ['REDIS_URL']); print(r.info()['used_memory_human'])"
```

---

## Emergency Procedures

### Complete System Restart

**When to use:** VPS unresponsive, multiple service failures, after Windows updates

```powershell
# EMERGENCY RESTART PROCEDURE
# ===========================

# Step 1: Save any open work
# (Not applicable for automated system)

# Step 2: Stop sync task (prevent conflicts during restart)
Stop-ScheduledTask -TaskName "TradingAlertsSyncTask" -ErrorAction SilentlyContinue

# Step 3: Stop all MT5 terminals gracefully
Get-Process | Where-Object {$_.ProcessName -eq "terminal64"} | Stop-Process -Force

# Step 4: Wait for processes to stop
Start-Sleep -Seconds 30

# Step 5: Restart VPS
Restart-Computer -Force

# Step 6: After restart (RDP back in)
# Wait for Windows to fully boot

# Step 7: Start all MT5 terminals
& C:\Scripts\start_all_mt5.ps1

# Step 8: Wait for DataCollector services to start
Start-Sleep -Seconds 60

# Step 9: Verify SQLite is being updated
(Get-Item "C:\MT5Data\trading_data.db").LastWriteTime

# Step 10: Start sync task
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Step 11: Verify sync is working
Get-Content "C:\Scripts\sync_package\sync.log" -Tail 10

# Step 12: Run health check
& C:\Scripts\monitoring\master_check.ps1
```

### Data Pipeline Freeze

**When to use:** Data not flowing for >30 minutes

```powershell
# DATA PIPELINE FREEZE RECOVERY
# =============================

# Step 1: Identify where data stopped
Write-Host "=== Checking Data Pipeline ===" -ForegroundColor Cyan

# Check SQLite
$sqliteAge = (Get-Date) - (Get-Item "C:\MT5Data\trading_data.db").LastWriteTime
Write-Host "SQLite last update: $($sqliteAge.TotalMinutes) minutes ago"

# Check sync state
$syncAge = (Get-Date) - (Get-Item "C:\Scripts\sync_package\sync_state.json").LastWriteTime
Write-Host "Sync state last update: $($syncAge.TotalMinutes) minutes ago"

# Check PostgreSQL
$pgLatest = psql $env:POSTGRESQL_URI -t -c "SELECT MAX(timestamp) FROM eurusd_m5;"
Write-Host "PostgreSQL latest: $pgLatest"

# Step 2: Fix identified issue
if ($sqliteAge.TotalMinutes -gt 5) {
    Write-Host "Issue: DataCollector not running" -ForegroundColor Red
    # Restart MT5 terminals
    & C:\Scripts\start_all_mt5.ps1
}
elseif ($syncAge.TotalMinutes -gt 5) {
    Write-Host "Issue: Sync script not running" -ForegroundColor Red
    # Restart sync task
    Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"
    Start-ScheduledTask -TaskName "TradingAlertsSyncTask"
}
else {
    Write-Host "Issue: Unknown - check logs" -ForegroundColor Yellow
}

# Step 3: Verify recovery
Start-Sleep -Seconds 120
& C:\Scripts\monitoring\master_check.ps1
```

---

## Maintenance Procedures

### Weekly Maintenance (Sunday 03:00 UTC)

```powershell
# WEEKLY MAINTENANCE PROCEDURE
# ============================

# Step 1: Log maintenance start
Add-Content "C:\Logs\maintenance.log" "$(Get-Date) - Weekly maintenance started"

# Step 2: Rotate logs
& C:\Scripts\monitoring\rotate_logs.ps1

# Step 3: Clear temp files
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue

# Step 4: SQLite optimization
sqlite3 C:\MT5Data\trading_data.db "VACUUM;"
sqlite3 C:\MT5Data\trading_data.db "ANALYZE;"
Write-Host "SQLite optimized"

# Step 5: Backup SQLite
$backupDate = Get-Date -Format "yyyyMMdd"
Copy-Item "C:\MT5Data\trading_data.db" "C:\Backups\trading_data_$backupDate.db"
Write-Host "SQLite backed up"

# Step 6: Clean old backups (keep 7 days)
Get-ChildItem "C:\Backups\trading_data_*.db" | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} | Remove-Item

# Step 7: Restart all MT5 terminals (memory cleanup)
Write-Host "Restarting MT5 terminals..."
Get-Process | Where-Object {$_.ProcessName -eq "terminal64"} | Stop-Process -Force
Start-Sleep -Seconds 30
& C:\Scripts\start_all_mt5.ps1
Start-Sleep -Seconds 120

# Step 8: Verify services running
$runningCount = (Get-Process | Where-Object {$_.ProcessName -eq "terminal64"}).Count
Write-Host "MT5 instances running: $runningCount"

# Step 9: Log maintenance end
Add-Content "C:\Logs\maintenance.log" "$(Get-Date) - Weekly maintenance completed"
```

### Monthly Maintenance

```powershell
# MONTHLY MAINTENANCE PROCEDURE
# =============================

# Step 1: Review and archive logs
$monthYear = (Get-Date).AddMonths(-1).ToString("yyyyMM")
Compress-Archive -Path "C:\Logs\*.log.*" -DestinationPath "C:\Backups\logs_$monthYear.zip"
Remove-Item "C:\Logs\*.log.*" -Force

# Step 2: Check disk space trends
Get-PSDrive C | Select-Object Used,Free

# Step 3: Review monitoring alerts from past month
Get-Content "C:\Logs\alerts.log" | Select-String (Get-Date).AddMonths(-1).ToString("yyyy-MM") | Group-Object {$_.Line.Split('-')[4]} | Sort-Object Count -Descending

# Step 4: Check PostgreSQL table sizes
psql $env:POSTGRESQL_URI -c "
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;"

# Step 5: Enforce row limits in PostgreSQL
# (Sync script handles this automatically)

# Step 6: Update documentation with any changes
```

---

## Disaster Recovery

### Scenario 1: VPS Complete Failure

**Recovery Time Objective (RTO):** 4 hours

```
VPS COMPLETE FAILURE RECOVERY
==============================

1. Order new Contabo VPS (1 hour)
   - VPS M or larger
   - Windows Server 2019/2022
   - Same region if possible

2. Initial Setup (30 minutes)
   - Follow 01-contabo-vps-setup-guide.md
   - Install Python, Git, etc.

3. MT5 Installation (1 hour)
   - Follow 02-mt5-installation-guide.md
   - Install 15 MT5 instances
   - Configure account credentials

4. Indicator Installation (30 minutes)
   - Follow 03-indicator-installation-guide.md
   - Copy .ex5 files from backup

5. DataCollector Deployment (30 minutes)
   - Follow 04-datacollector-deployment-guide.md
   - Copy sqlite3.dll
   - Deploy DataCollector.ex5

6. Sync Script Deployment (30 minutes)
   - Follow 05-sync-script-deployment-guide.md
   - Copy sync package files
   - Configure .env with credentials
   - Start Task Scheduler

7. Verification (30 minutes)
   - Run health checks
   - Verify data flowing
   - Update DNS/firewall if needed
```

### Scenario 2: SQLite Database Corruption

**Recovery Time Objective (RTO):** 30 minutes

```powershell
# SQLITE CORRUPTION RECOVERY
# ==========================

# Step 1: Stop sync script
Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Step 2: Check backup availability
Get-ChildItem "C:\Backups\trading_data_*.db" | Sort-Object LastWriteTime -Descending

# Step 3: Restore from backup
$latestBackup = Get-ChildItem "C:\Backups\trading_data_*.db" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Copy-Item $latestBackup.FullName "C:\MT5Data\trading_data.db" -Force

# Step 4: Verify integrity
sqlite3 C:\MT5Data\trading_data.db "PRAGMA integrity_check;"

# Step 5: Restart services
& C:\Scripts\start_all_mt5.ps1
Start-Sleep -Seconds 120

# Step 6: Start sync
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Note: Some data may be lost since last backup
# DataCollector will resume collecting new data
```

### Scenario 3: PostgreSQL Data Loss

**Recovery Time Objective (RTO):** 2 hours

```
POSTGRESQL DATA LOSS RECOVERY
=============================

Option A: Resync from SQLite (preferred if SQLite has data)

1. Check SQLite has sufficient history
   sqlite3 C:\MT5Data\trading_data.db "SELECT MIN(timestamp), MAX(timestamp) FROM eurusd;"

2. Reset sync state to resync all data
   Remove-Item "C:\Scripts\sync_package\sync_state.json"

3. Run sync manually
   cd C:\Scripts\sync_package
   python sync_to_postgresql.py

4. This may take time depending on data volume

Option B: Railway PostgreSQL Backup Restore

1. Log into Railway dashboard
2. Navigate to PostgreSQL service
3. Check available backups
4. Restore from latest backup
5. Verify data integrity
```

---

## Escalation Procedures

### Escalation Matrix

| Issue Type | First Response | Escalate After | Escalate To |
|------------|----------------|----------------|-------------|
| Service Down | On-call operator | 15 minutes | Tech Lead |
| Data Delay | On-call operator | 30 minutes | Tech Lead |
| Complete Outage | On-call operator | Immediate | Tech Lead + Management |
| Security Issue | On-call operator | Immediate | Security Team |
| Performance Degradation | On-call operator | 1 hour | Tech Lead |

### Escalation Contacts

```
ESCALATION CONTACTS
===================

Level 1 - On-Call Operator:
  Name: [Primary Operator]
  Phone: [Phone Number]
  Email: [Email]

Level 2 - Tech Lead:
  Name: [Tech Lead Name]
  Phone: [Phone Number]
  Email: [Email]

Level 3 - Management:
  Name: [Manager Name]
  Phone: [Phone Number]
  Email: [Email]

External Contacts:
  Contabo Support: support@contabo.com
  Railway Support: support@railway.app
  Vercel Support: support@vercel.com
```

---

## Contact Information

### Service Providers

| Provider | Service | Support URL |
|----------|---------|-------------|
| Contabo | VPS Hosting | https://contabo.com/en/support/ |
| Railway | PostgreSQL, Redis | https://railway.app/help |
| Vercel | Frontend Hosting | https://vercel.com/support |

### Important Links

```
Contabo Control Panel: https://my.contabo.com
Railway Dashboard: https://railway.app/dashboard
Vercel Dashboard: https://vercel.com/dashboard
GitHub Repository: https://github.com/[your-repo]
```

---

## Quick Reference Card

```
QUICK REFERENCE - TRADING ALERTS OPERATIONS
═══════════════════════════════════════════

HEALTH CHECK:
  & C:\Scripts\monitoring\master_check.ps1

START ALL MT5:
  & C:\Scripts\start_all_mt5.ps1

RESTART SYNC:
  Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"
  Start-ScheduledTask -TaskName "TradingAlertsSyncTask"

VIEW LOGS:
  Get-Content "C:\Scripts\sync_package\sync.log" -Tail 50

CHECK SQLITE:
  sqlite3 C:\MT5Data\trading_data.db ".tables"
  sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM eurusd;"

TEST API:
  Invoke-RestMethod "https://your-app.vercel.app/api/health"

EMERGENCY RESTART:
  Restart-Computer -Force
```

---

## Next Steps

After completing runbooks:

1. ➡️ **[Infrastructure Costs](./11-infrastructure-costs.md)** - Cost breakdown

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
