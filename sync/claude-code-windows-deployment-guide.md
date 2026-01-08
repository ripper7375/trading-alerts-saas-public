# Claude Code Sync Script - Windows Deployment Guide

**Part 20 Migration - Contabo VPS (Windows)**
**Date:** 2026-01-08
**Estimated Time:** 20 minutes

---

## 📋 What You Have

You have the **Claude Code implementation** of the sync script - a professional, production-grade solution with:

✅ Modular package structure  
✅ Timeframe filtering (splits data into 135 tables)  
✅ Sync state management (efficient incremental syncs)  
✅ Connection pooling  
✅ Row limit enforcement  
✅ Proper error handling

---

## 🔧 Required Fixes

### Fix #1: Symbol and Timeframe Casing

**Issue:** `config.py` has uppercase symbols/timeframes, but:

- DataCollector.mq5 creates **lowercase** tables (`eurusd`, not `EURUSD`)
- PostgreSQL tables are **lowercase** (`eurusd_h1`, not `EURUSD_H1`)

**Fix:** Replace `config.py` with the corrected `config-fixed.py` file.

### Fix #2: Windows Deployment

**Issue:** Script designed for Linux cron, but you're on Windows.

**Fix:** Use Windows Task Scheduler (instructions below).

---

## 🚀 Step 1: Deploy Files to Contabo VPS

### 1.1 Create Directory Structure

```powershell
# Create sync package directory
New-Item -ItemType Directory -Force -Path "C:\Scripts\sync_package"

# Verify
Test-Path "C:\Scripts\sync_package"  # Should return: True
```

### 1.2 Copy All Files

Copy these files to `C:\Scripts\sync_package\`:

```
C:\Scripts\sync_package\
  ├── __init__.py
  ├── config.py              ← Replace with config-fixed.py
  ├── db_connections.py
  ├── sync_to_postgresql.py
  ├── timeframe_filter.py
  └── requirements.txt
```

**IMPORTANT:** Rename `config-fixed.py` to `config.py` when copying.

### 1.3 Set Environment Variable

Create a `.env` file in `C:\Scripts\sync_package\`:

```powershell
# Create .env file
@"
SQLITE_PATH=C:\MT5Data\trading_data.db
POSTGRESQL_URI=postgresql://postgres:wjFjtjrCLgGNgueAYhVDtEypHkWWmbcW@turntable.proxy.rlwy.net:55082/railway
LOG_LEVEL=INFO
SYNC_STATE_FILE=C:\Scripts\sync_package\sync_state.json
"@ | Out-File -FilePath "C:\Scripts\sync_package\.env" -Encoding ASCII
```

**Or use environment variables:**

```powershell
# Set permanent environment variables
[Environment]::SetEnvironmentVariable("POSTGRESQL_URI", "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:YOUR_PORT/railway", "Machine")
[Environment]::SetEnvironmentVariable("SQLITE_PATH", "C:\MT5Data\trading_data.db", "Machine")
```

---

## 📦 Step 2: Install Dependencies

```powershell
# Navigate to package directory
cd C:\Scripts\sync_package

# Install requirements
pip install -r requirements.txt

# Verify installation
pip list | Select-String psycopg2
pip list | Select-String python-dotenv
```

**Expected output:**

```
psycopg2-binary    2.9.9
python-dotenv      1.0.0
```

---

## 🧪 Step 3: Test the Script

### 3.1 First Test Run

```powershell
# Navigate to package directory
cd C:\Scripts\sync_package

# Run sync script
python sync_to_postgresql.py
```

**Expected output:**

```
============================================================
SQLite to PostgreSQL Sync Script - Part 20
============================================================
INFO - Loaded sync state from sync_state.json
INFO - Starting sync for 15 symbols...
INFO - Syncing eurusd...
INFO - Found 8 new rows for eurusd
INFO - Synced eurusd: 8 rows processed
INFO - Syncing btcusd...
INFO - Found 4 new rows for btcusd
INFO - Synced btcusd: 4 rows processed
...
INFO - Sync completed: 15/15 symbols, 42 rows, 0 errors
```

### 3.2 Verify Data in PostgreSQL

```powershell
# Check row counts
psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
# Should show more rows than test data

# Check latest timestamps
psql $env:POSTGRESQL_URI -c "SELECT timestamp FROM eurusd_h1 ORDER BY timestamp DESC LIMIT 3;"
# Should show recent MT5 data
```

### 3.3 Check Sync State

```powershell
# View sync state file
Get-Content "C:\Scripts\sync_package\sync_state.json"
```

**Should show:**

```json
{
  "eurusd": 1704700800,
  "btcusd": 1704700800,
  "usdjpy": 1704700800,
  ...
}
```

---

## 🔄 Step 4: Schedule with Windows Task Scheduler

### 4.1 Create Run Script

Create `C:\Scripts\run_sync.bat`:

```batch
@echo off
cd /d C:\Scripts\sync_package
python sync_to_postgresql.py >> sync_output.log 2>&1
```

**Or use PowerShell:**

Create `C:\Scripts\run_sync.ps1`:

```powershell
# Run sync script
Set-Location "C:\Scripts\sync_package"
python sync_to_postgresql.py
```

### 4.2 Create Scheduled Task

```powershell
# Create scheduled task to run every 30 seconds
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Scripts\run_sync.ps1"

# Trigger: Run every 1 minute (we'll modify to 30 sec below)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Seconds 30)

# Settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Principal (run as SYSTEM for reliability)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Register task
Register-ScheduledTask -TaskName "TradingAlertsSyncTask" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Trading Alerts SQLite to PostgreSQL Sync (Part 20)"
```

### 4.3 Modify Task for 30-Second Interval

**Issue:** Windows Task Scheduler minimum GUI interval is 1 minute.

**Solution:** Manually edit task XML to run every 30 seconds:

```powershell
# Export task to XML
Export-ScheduledTask -TaskName "TradingAlertsSyncTask" | Out-File "C:\Scripts\task.xml" -Encoding UTF8

# Edit C:\Scripts\task.xml - find this section:
# <Repetition>
#   <Interval>PT1M</Interval>
# </Repetition>

# Change PT1M to PT30S:
# <Repetition>
#   <Interval>PT30S</Interval>
# </Repetition>

# Re-import modified task
Unregister-ScheduledTask -TaskName "TradingAlertsSyncTask" -Confirm:$false
Register-ScheduledTask -Xml (Get-Content "C:\Scripts\task.xml" | Out-String) -TaskName "TradingAlertsSyncTask"
```

### 4.4 Start and Verify Task

```powershell
# Start task manually
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Check task status
Get-ScheduledTask -TaskName "TradingAlertsSyncTask" | Select-Object TaskName, State, LastRunTime

# Should show:
# TaskName                 State   LastRunTime
# --------                 -----   -----------
# TradingAlertsSyncTask    Ready   [recent time]
```

### 4.5 Monitor Task Logs

```powershell
# View sync logs
Get-Content "C:\Scripts\sync_package\sync.log" -Tail 50 -Wait

# View output log
Get-Content "C:\Scripts\sync_package\sync_output.log" -Tail 20 -Wait
```

---

## ✅ Step 5: Final Verification

### 5.1 Monitor Data Flow (2-3 minutes)

```powershell
# Check row count
psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
# Note the count

# Wait 1 minute
Start-Sleep 60

# Check again
psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
# Should show MORE rows
```

### 5.2 Check All Timeframes

```powershell
# Check all EURUSD timeframes
psql $env:POSTGRESQL_URI -c "
SELECT
  'eurusd_m5' as table_name, COUNT(*) as rows FROM eurusd_m5
UNION ALL SELECT 'eurusd_m15', COUNT(*) FROM eurusd_m15
UNION ALL SELECT 'eurusd_m30', COUNT(*) FROM eurusd_m30
UNION ALL SELECT 'eurusd_h1', COUNT(*) FROM eurusd_h1
UNION ALL SELECT 'eurusd_h2', COUNT(*) FROM eurusd_h2
UNION ALL SELECT 'eurusd_h4', COUNT(*) FROM eurusd_h4
UNION ALL SELECT 'eurusd_h8', COUNT(*) FROM eurusd_h8
UNION ALL SELECT 'eurusd_h12', COUNT(*) FROM eurusd_h12
UNION ALL SELECT 'eurusd_d1', COUNT(*) FROM eurusd_d1;
"
```

**Expected:** Different row counts per timeframe (H1 has most, D1 has least).

### 5.3 Verify Charts Display

1. Go to: https://trading-alerts-saas-public-go8p.vercel.app
2. Sign in
3. Navigate to Charts
4. Select EURUSD + H1
5. **Should display REAL MT5 DATA!** 📈

---

## 🎯 Troubleshooting

### Issue 1: "ModuleNotFoundError: No module named 'config'"

**Cause:** Missing `__init__.py` or wrong directory structure.

**Fix:**

```powershell
# Ensure __init__.py exists
Test-Path "C:\Scripts\sync_package\__init__.py"

# Should return: True
```

### Issue 2: "psycopg2.OperationalError: connection failed"

**Cause:** Wrong PostgreSQL connection string.

**Fix:**

```powershell
# Test connection manually
psql $env:POSTGRESQL_URI -c "SELECT 1;"

# If fails, update .env file with correct Railway connection string
```

### Issue 3: "sqlite3.OperationalError: no such table: EURUSD"

**Cause:** Table name mismatch (uppercase vs lowercase).

**Fix:**

- Verify you replaced `config.py` with `config-fixed.py`
- Check SQLite database has lowercase tables:
  ```powershell
  sqlite3 C:\MT5Data\trading_data.db ".tables"
  # Should show: audusd, btcusd, eurusd, etc. (lowercase)
  ```

### Issue 4: No New Data Syncing

**Cause:** DataCollector.mq5 not running or not writing to SQLite.

**Fix:**

```powershell
# Check SQLite database has data
sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM eurusd;"

# If 0 rows, DataCollector.mq5 is not running
# Open MT5 → Tools → Services → Start DataCollector
```

### Issue 5: Task Not Running Every 30 Seconds

**Cause:** Task Scheduler minimum interval default is 1 minute.

**Fix:**

- Follow Step 4.3 to manually edit task XML
- Change `<Interval>PT1M</Interval>` to `<Interval>PT30S</Interval>`

---

## 📊 Task Management Commands

### Check Task Status

```powershell
Get-ScheduledTask -TaskName "TradingAlertsSyncTask"
```

### Start Task

```powershell
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"
```

### Stop Task

```powershell
Stop-ScheduledTask -TaskName "TradingAlertsSyncTask"
```

### Disable Task

```powershell
Disable-ScheduledTask -TaskName "TradingAlertsSyncTask"
```

### Enable Task

```powershell
Enable-ScheduledTask -TaskName "TradingAlertsSyncTask"
```

### Remove Task

```powershell
Unregister-ScheduledTask -TaskName "TradingAlertsSyncTask" -Confirm:$false
```

### View Task History

```powershell
# Open Task Scheduler GUI
taskschd.msc

# Navigate to: Task Scheduler Library → TradingAlertsSyncTask
# Click "History" tab
```

---

## 🎉 Success Criteria

Migration is **COMPLETE** when:

- [x] Sync task shows "Ready" in Task Scheduler
- [x] `sync.log` shows successful cycles every 30 seconds
- [x] PostgreSQL row counts increasing across all timeframes
- [x] `sync_state.json` shows updated timestamps
- [x] Charts display REAL MT5 data in production
- [x] All 15 symbols × 9 timeframes = 135 table combinations working

---

## 📞 Quick Reference

**Important Paths:**

```
Package:       C:\Scripts\sync_package\
Config:        C:\Scripts\sync_package\config.py
Logs:          C:\Scripts\sync_package\sync.log
State:         C:\Scripts\sync_package\sync_state.json
Run Script:    C:\Scripts\run_sync.ps1
Task Name:     TradingAlertsSyncTask
```

**Important Commands:**

```powershell
# Check task
Get-ScheduledTask -TaskName "TradingAlertsSyncTask"

# View logs
Get-Content "C:\Scripts\sync_package\sync.log" -Tail 50 -Wait

# Test sync manually
cd C:\Scripts\sync_package
python sync_to_postgresql.py

# Check PostgreSQL data
psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
```

---

## 🚀 Advantages of Claude Code Version

Compared to a simple sync script, this version offers:

1. **Efficiency:** Only syncs NEW data (via sync_state.json)
2. **Reliability:** Connection pooling + retry logic
3. **Scalability:** Handles all 15 symbols × 9 timeframes = 135 tables
4. **Maintainability:** Modular code structure
5. **Observability:** Comprehensive logging
6. **Safety:** Row limits prevent unbounded growth

---

**Document Version:** 1.0
**Last Updated:** 2026-01-08
**Status:** READY FOR DEPLOYMENT
