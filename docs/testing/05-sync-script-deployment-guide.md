# Sync Script Deployment Guide

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Sync Script Architecture](#sync-script-architecture)
3. [Prerequisites](#prerequisites)
4. [File Deployment](#file-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Dependency Installation](#dependency-installation)
7. [Manual Test Run](#manual-test-run)
8. [Windows Task Scheduler Setup](#windows-task-scheduler-setup)
9. [Monitoring and Logging](#monitoring-and-logging)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The sync script synchronizes data from local SQLite (written by DataCollector.mq5) to Railway PostgreSQL. It runs every 30 seconds via Windows Task Scheduler.

**Data Flow:**
```
SQLite (C:\MT5Data\trading_data.db)
    ↓ (Python sync script reads)
Filter by timeframe (9 timeframes)
    ↓ (UPSERT to PostgreSQL)
Railway PostgreSQL (135 tables)
    → eurusd_m5, eurusd_m15, ... eurusd_d1
    → btcusd_m5, btcusd_m15, ... btcusd_d1
    → ... (15 symbols × 9 timeframes = 135 tables)
```

---

## Sync Script Architecture

### Component Files

| File | Purpose |
|------|---------|
| `config.py` | Configuration settings (symbols, timeframes, paths) |
| `db_connections.py` | Database connection management (SQLite + PostgreSQL) |
| `sync_to_postgresql.py` | Main sync logic |
| `timeframe_filter.py` | Filters data by timeframe |
| `requirements.txt` | Python dependencies |
| `run_sync.ps1` | PowerShell wrapper for Task Scheduler |
| `run_sync.bat` | Batch file alternative |
| `setup-sync-package.ps1` | Automated setup script |

### Sync Process Flow

```
1. Load last sync state (sync_state.json)
2. For each symbol (15 total):
   a. Query SQLite for rows since last sync
   b. For each timeframe (9 total):
      - Filter rows matching timeframe
      - UPSERT to PostgreSQL table
      - Enforce max row limit (10,000)
   c. Update last sync timestamp
3. Save sync state
4. Log completion statistics
```

### Timeframe Filtering Logic

| Timeframe | Criteria | Example Times |
|-----------|----------|---------------|
| M5 | minute % 5 == 0 | :00, :05, :10, :15... |
| M15 | minute % 15 == 0 | :00, :15, :30, :45 |
| M30 | minute % 30 == 0 | :00, :30 |
| H1 | minute == 0 | X:00 |
| H2 | minute == 0 AND hour % 2 == 0 | 00:00, 02:00, 04:00... |
| H4 | minute == 0 AND hour % 4 == 0 | 00:00, 04:00, 08:00... |
| H8 | minute == 0 AND hour % 8 == 0 | 00:00, 08:00, 16:00 |
| H12 | minute == 0 AND hour % 12 == 0 | 00:00, 12:00 |
| D1 | hour == 0 AND minute == 0 | 00:00 (midnight) |

---

## Prerequisites

Before deploying sync script:

- [ ] Contabo VPS setup complete
- [ ] Python 3.8+ installed
- [ ] DataCollector running and writing to SQLite
- [ ] `C:\MT5Data\trading_data.db` exists with data
- [ ] Railway PostgreSQL credentials available
- [ ] Railway Redis credentials available (optional)

### Verify Python Installation

```powershell
python --version
# Expected: Python 3.11.x or similar

pip --version
# Expected: pip 23.x.x
```

---

## File Deployment

### Step 1: Create Directory Structure

```powershell
# Create sync package directory
New-Item -ItemType Directory -Force -Path "C:\Scripts\sync_package"
New-Item -ItemType Directory -Force -Path "C:\Scripts\sync_package\logs"
```

### Step 2: Copy Sync Package Files

Copy these files from your development machine to `C:\Scripts\sync_package\`:

```powershell
# Files to copy:
# - __init__.py
# - config.py
# - db_connections.py
# - sync_to_postgresql.py
# - timeframe_filter.py
# - requirements.txt

# Also copy to C:\Scripts\ (parent folder):
# - run_sync.ps1
# - run_sync.bat
# - setup-sync-package.ps1
```

### Step 3: Verify Files

```powershell
# List files in sync_package
Get-ChildItem "C:\Scripts\sync_package" -Recurse

# Expected:
# __init__.py
# config.py
# db_connections.py
# sync_to_postgresql.py
# timeframe_filter.py
# requirements.txt
```

### File Contents Reference

**config.py** - Key settings:
```python
# 15 symbols (lowercase to match SQLite tables)
SYMBOLS = ["audjpy", "audusd", "btcusd", "ethusd", "eurusd",
           "gbpjpy", "gbpusd", "ndx100", "nzdusd", "us30",
           "usdcad", "usdchf", "usdjpy", "xagusd", "xauusd"]

# 9 timeframes (lowercase to match PostgreSQL tables)
TIMEFRAMES = ["m5", "m15", "m30", "h1", "h2", "h4", "h8", "h12", "d1"]

# Sync settings
SYNC_INTERVAL_SECONDS = 30
MAX_ROWS_PER_TABLE = 10000
```

---

## Environment Configuration

### Step 1: Create .env File

```powershell
# Create .env file with Railway credentials
$envContent = @"
# Trading Alerts Sync Package Configuration
# Part 20 Migration

# SQLite database path (local)
SQLITE_PATH=C:\MT5Data\trading_data.db

# Railway PostgreSQL connection string
POSTGRESQL_URI=postgresql://postgres:YOUR_PASSWORD@turntable.proxy.rlwy.net:55082/railway

# Railway Redis connection string (optional)
REDIS_URL=redis://default:YOUR_PASSWORD@switchyard.proxy.rlwy.net:47725

# Logging
LOG_LEVEL=INFO

# Sync state file path
SYNC_STATE_FILE=C:\Scripts\sync_package\sync_state.json
"@

$envContent | Out-File -FilePath "C:\Scripts\sync_package\.env" -Encoding ASCII
```

### Step 2: Set System Environment Variables (Alternative)

```powershell
# Set environment variables at system level (persists across reboots)
[Environment]::SetEnvironmentVariable("POSTGRESQL_URI", "postgresql://postgres:YOUR_PASSWORD@turntable.proxy.rlwy.net:55082/railway", "Machine")
[Environment]::SetEnvironmentVariable("SQLITE_PATH", "C:\MT5Data\trading_data.db", "Machine")
[Environment]::SetEnvironmentVariable("LOG_LEVEL", "INFO", "Machine")
```

### Step 3: Verify Environment

```powershell
# Test .env file exists
if (Test-Path "C:\Scripts\sync_package\.env") {
    Write-Host ".env file exists" -ForegroundColor Green
    Get-Content "C:\Scripts\sync_package\.env" | Select-String -NotMatch "PASSWORD" | ForEach-Object { $_.Line }
} else {
    Write-Host ".env file NOT found" -ForegroundColor Red
}
```

### Security Note

⚠️ **Never commit .env files to version control!**

```powershell
# Add to .gitignore if using Git
Add-Content -Path "C:\Scripts\.gitignore" -Value ".env"
Add-Content -Path "C:\Scripts\.gitignore" -Value "*.log"
Add-Content -Path "C:\Scripts\.gitignore" -Value "sync_state.json"
```

---

## Dependency Installation

### Step 1: Install Required Packages

```powershell
# Navigate to sync package
cd C:\Scripts\sync_package

# Install dependencies
pip install -r requirements.txt
```

**requirements.txt contents:**
```
psycopg2-binary>=2.9.9
python-dotenv>=1.0.0
```

### Step 2: Verify Installation

```powershell
# Check installed packages
pip list | Select-String "psycopg2|dotenv"

# Expected output:
# psycopg2-binary    2.9.9
# python-dotenv      1.0.0
```

### Step 3: Test Imports

```powershell
# Quick import test
python -c "import psycopg2; print('psycopg2 OK')"
python -c "from dotenv import load_dotenv; print('python-dotenv OK')"
```

---

## Manual Test Run

### Step 1: Test Database Connections

```powershell
cd C:\Scripts\sync_package

# Create a simple connection test
python -c @"
from db_connections import test_connections
import json

result = test_connections()
print(json.dumps(result, indent=2))
"@
```

**Expected output:**
```json
{
  "sqlite": {
    "connected": true,
    "error": null
  },
  "postgresql": {
    "connected": true,
    "error": null
  }
}
```

### Step 2: Run Sync Script Manually

```powershell
cd C:\Scripts\sync_package

# Run sync
python sync_to_postgresql.py
```

**Expected output:**
```
2026-01-08 12:00:00 - __main__ - INFO - ============================================================
2026-01-08 12:00:00 - __main__ - INFO - SQLite to PostgreSQL Sync Script - Part 20
2026-01-08 12:00:00 - __main__ - INFO - ============================================================
2026-01-08 12:00:00 - __main__ - INFO - Loaded sync state from sync_state.json
2026-01-08 12:00:00 - __main__ - INFO - Starting sync for 15 symbols...
2026-01-08 12:00:00 - __main__ - INFO - Syncing audjpy...
2026-01-08 12:00:00 - __main__ - INFO - Found 10 new rows for audjpy
2026-01-08 12:00:01 - __main__ - INFO - Synced audjpy: 10 rows processed
...
2026-01-08 12:00:15 - __main__ - INFO - Sync completed: 15/15 symbols, 150 rows, 0 errors
```

### Step 3: Verify Data in PostgreSQL

```powershell
# Using psql (if installed)
$env:POSTGRESQL_URI = "postgresql://postgres:YOUR_PASSWORD@turntable.proxy.rlwy.net:55082/railway"

# Count rows in a table
psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"

# View recent data
psql $env:POSTGRESQL_URI -c "SELECT timestamp, close FROM eurusd_h1 ORDER BY timestamp DESC LIMIT 5;"
```

**Alternative - Python query:**
```powershell
python -c @"
from db_connections import postgresql_connection

with postgresql_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM eurusd_h1')
    print(f'eurusd_h1 rows: {cursor.fetchone()[0]}')
"@
```

### Step 4: Check Sync State

```powershell
# View sync state file
Get-Content "C:\Scripts\sync_package\sync_state.json"
```

**Expected content:**
```json
{
  "audjpy": 1704700800,
  "audusd": 1704700800,
  "btcusd": 1704700800,
  ...
}
```

### Step 5: Check Logs

```powershell
# View sync log
Get-Content "C:\Scripts\sync_package\sync.log" -Tail 50
```

---

## Windows Task Scheduler Setup

### Method 1: Automated Setup (Recommended)

```powershell
# Run setup script
cd C:\Scripts
.\setup-sync-package.ps1
```

This script:
1. Creates directory structure
2. Checks prerequisites
3. Prompts for PostgreSQL URI
4. Creates .env file
5. Installs dependencies
6. Tests connections
7. Creates scheduled task

### Method 2: Manual Setup

#### Step A: Create Scheduled Task

```powershell
# Remove existing task if exists
Unregister-ScheduledTask -TaskName "TradingAlertsSyncTask" -Confirm:$false -ErrorAction SilentlyContinue

# Create task action
$action = New-ScheduledTaskAction `
    -Execute "PowerShell.exe" `
    -Argument "-ExecutionPolicy Bypass -File C:\Scripts\run_sync.ps1"

# Create trigger (every 30 seconds simulation)
# Note: Task Scheduler minimum is 1 minute, so we use a workaround
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

# Create principal (run as SYSTEM)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Register task
Register-ScheduledTask `
    -TaskName "TradingAlertsSyncTask" `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Trading Alerts SQLite to PostgreSQL Sync (Part 20)"

Write-Host "Scheduled task created successfully!" -ForegroundColor Green
```

#### Step B: 30-Second Interval Workaround

Task Scheduler doesn't natively support 30-second intervals. Options:

**Option 1: Create Two Tasks**
```powershell
# Task 1: Runs at :00 and :30 each minute
# Task 2: Offset by 30 seconds (starts at different time)

# This is complex - use Option 2 instead
```

**Option 2: Use run_sync.ps1 Loop**

Modify `run_sync.ps1` to run twice per minute:
```powershell
# File: C:\Scripts\run_sync.ps1 (modified)

# First run
Set-Location "C:\Scripts\sync_package"
python sync_to_postgresql.py

# Wait 30 seconds
Start-Sleep -Seconds 30

# Second run
python sync_to_postgresql.py
```

**Option 3: Use Windows Service** (Advanced)

Create a Windows Service that runs continuously with 30-second intervals.

### Step C: Start Scheduled Task

```powershell
# Start the task
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Verify task is running
Get-ScheduledTask -TaskName "TradingAlertsSyncTask" | Select-Object TaskName, State
```

### Step D: Verify Task Execution

```powershell
# Check task history
Get-ScheduledTaskInfo -TaskName "TradingAlertsSyncTask"

# View in Task Scheduler GUI
taskschd.msc
# Navigate to: Task Scheduler Library → TradingAlertsSyncTask
```

---

## Monitoring and Logging

### Log Files

| File | Location | Purpose |
|------|----------|---------|
| `sync.log` | `C:\Scripts\sync_package\sync.log` | Main sync operations |
| `sync_output.log` | `C:\Scripts\sync_package\sync_output.log` | Task Scheduler output |
| `sync_state.json` | `C:\Scripts\sync_package\sync_state.json` | Last sync timestamps |

### Real-Time Log Monitoring

```powershell
# Watch sync.log in real-time
Get-Content "C:\Scripts\sync_package\sync.log" -Tail 10 -Wait
```

### Log Rotation

Add log rotation to prevent disk filling:

```powershell
# File: C:\Scripts\rotate_logs.ps1

$logPath = "C:\Scripts\sync_package\sync.log"
$maxSize = 10MB
$backupCount = 5

if ((Get-Item $logPath).Length -gt $maxSize) {
    # Rotate logs
    for ($i = $backupCount; $i -gt 0; $i--) {
        $oldLog = "$logPath.$i"
        $newLog = "$logPath.$($i+1)"
        if (Test-Path $oldLog) {
            if ($i -eq $backupCount) {
                Remove-Item $oldLog
            } else {
                Move-Item $oldLog $newLog
            }
        }
    }
    Move-Item $logPath "$logPath.1"
}
```

### Health Check Script

```powershell
# File: C:\Scripts\health_check.ps1

Write-Host "=== Sync Health Check ===" -ForegroundColor Cyan

# Check task status
$task = Get-ScheduledTask -TaskName "TradingAlertsSyncTask"
Write-Host "Task Status: $($task.State)"

# Check last run time
$taskInfo = Get-ScheduledTaskInfo -TaskName "TradingAlertsSyncTask"
Write-Host "Last Run: $($taskInfo.LastRunTime)"
Write-Host "Last Result: $($taskInfo.LastTaskResult)"

# Check sync.log for recent activity
$lastLog = Get-Content "C:\Scripts\sync_package\sync.log" -Tail 1
Write-Host "Latest Log: $lastLog"

# Check sync_state.json age
$stateFile = Get-Item "C:\Scripts\sync_package\sync_state.json"
$age = (Get-Date) - $stateFile.LastWriteTime
Write-Host "State File Age: $([math]::Round($age.TotalMinutes, 1)) minutes"

# Check SQLite
$sqliteAge = (Get-Date) - (Get-Item "C:\MT5Data\trading_data.db").LastWriteTime
Write-Host "SQLite Last Modified: $([math]::Round($sqliteAge.TotalMinutes, 1)) minutes ago"

# Alert if sync hasn't run in 5 minutes
if ($age.TotalMinutes -gt 5) {
    Write-Host "WARNING: Sync may be stalled!" -ForegroundColor Red
}
```

---

## Troubleshooting

### Issue 1: Module Not Found Error

**Symptoms:**
```
ModuleNotFoundError: No module named 'psycopg2'
```

**Solutions:**
```powershell
# Reinstall dependencies
cd C:\Scripts\sync_package
pip install -r requirements.txt

# Check Python path
python -c "import sys; print(sys.executable)"
# Ensure using correct Python installation
```

### Issue 2: PostgreSQL Connection Refused

**Symptoms:**
```
psycopg2.OperationalError: connection refused
```

**Solutions:**
1. Check Railway PostgreSQL is running
2. Verify connection string in .env
3. Test network connectivity:
   ```powershell
   Test-NetConnection -ComputerName turntable.proxy.rlwy.net -Port 55082
   ```
4. Check firewall allows outbound on port 55082

### Issue 3: SQLite Database Locked

**Symptoms:**
```
sqlite3.OperationalError: database is locked
```

**Solutions:**
1. Ensure only one sync process runs at a time
2. Add retry logic (already in db_connections.py)
3. Check DataCollector isn't holding lock
4. Increase SQLite timeout:
   ```python
   conn = sqlite3.connect(SQLITE_PATH, timeout=30)
   ```

### Issue 4: Scheduled Task Not Running

**Symptoms:** Task shows "Ready" but doesn't execute

**Solutions:**
1. Check task history for errors
2. Verify user has permissions
3. Test script manually:
   ```powershell
   C:\Scripts\run_sync.ps1
   ```
4. Check execution policy:
   ```powershell
   Get-ExecutionPolicy
   # If Restricted, run:
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine
   ```

### Issue 5: No New Data Synced

**Symptoms:** PostgreSQL row count not increasing

**Solutions:**
1. Check sync_state.json timestamps
2. Verify SQLite has new data:
   ```powershell
   sqlite3 C:\MT5Data\trading_data.db "SELECT MAX(timestamp) FROM eurusd;"
   ```
3. Check sync.log for "No new data" messages
4. Reset sync state (start from scratch):
   ```powershell
   Remove-Item "C:\Scripts\sync_package\sync_state.json"
   ```

### Issue 6: Timeframe Tables Empty

**Symptoms:** Some PostgreSQL tables have no data

**Solutions:**
1. Check timeframe filter logic
2. Verify timestamps are on expected boundaries
3. Higher timeframes (H8, H12, D1) get fewer rows
4. Wait for appropriate time (D1 only syncs at midnight)

---

## Quick Reference

### File Paths

```
C:\Scripts\
├── run_sync.ps1              # Task Scheduler wrapper
├── run_sync.bat              # Batch alternative
├── setup-sync-package.ps1    # Automated setup
└── sync_package\
    ├── __init__.py
    ├── config.py
    ├── db_connections.py
    ├── sync_to_postgresql.py
    ├── timeframe_filter.py
    ├── requirements.txt
    ├── .env                  # Credentials (DO NOT COMMIT)
    ├── sync_state.json       # Last sync timestamps
    └── sync.log              # Operation logs
```

### Common Commands

```powershell
# Manual sync run
cd C:\Scripts\sync_package
python sync_to_postgresql.py

# Check task status
Get-ScheduledTask -TaskName "TradingAlertsSyncTask" | Select-Object State

# Start/Stop task
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"
Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Watch logs
Get-Content "C:\Scripts\sync_package\sync.log" -Tail 20 -Wait

# Reset sync state
Remove-Item "C:\Scripts\sync_package\sync_state.json"
```

---

## Next Steps

After sync script is running:

1. ➡️ **[E2E Testing Plan](./06-e2e-testing-plan.md)** - Complete end-to-end testing

---

## Checklist

Before proceeding to E2E testing:

- [ ] All sync package files deployed to `C:\Scripts\sync_package\`
- [ ] .env file created with correct credentials
- [ ] Python dependencies installed
- [ ] Manual sync run successful
- [ ] Data appearing in PostgreSQL tables
- [ ] Windows Task Scheduler configured
- [ ] Task running automatically
- [ ] Logs being written
- [ ] sync_state.json updating after each run

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
