# End-to-End Testing Plan

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Test Verification](#pre-test-verification)
3. [Test Scenario 1: Single Symbol E2E](#test-scenario-1-single-symbol-e2e)
4. [Test Scenario 2: Multiple Symbols](#test-scenario-2-multiple-symbols)
5. [Test Scenario 3: Automatic Sync](#test-scenario-3-automatic-sync)
6. [Test Scenario 4: Failure Recovery](#test-scenario-4-failure-recovery)
7. [Test Scenario 5: Data Integrity](#test-scenario-5-data-integrity)
8. [Test Execution Checklist](#test-execution-checklist)
9. [Test Results Template](#test-results-template)

---

## Overview

This document provides comprehensive test scenarios to validate the complete data flow from MT5 terminals to the production application.

**Complete Data Flow:**
```
MT5 Terminal (×15)
    ↓ DataCollector.mq5 Service
SQLite Buffer (C:\MT5Data\trading_data.db)
    ↓ Sync Script (Python - every 30 sec)
Railway PostgreSQL (135 tables)
    ↓ API queries
Vercel Next.js (Chart display)
```

**Testing Goals:**
1. ✅ Verify data flows correctly through all components
2. ✅ Validate data integrity (no corruption or loss)
3. ✅ Test automatic recovery from failures
4. ✅ Confirm timeframe filtering works correctly
5. ✅ Ensure production-ready stability

---

## Pre-Test Verification

Before running test scenarios, verify all components are ready.

### Contabo VPS Checklist

```
Pre-Test: VPS Infrastructure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] Windows Server accessible via RDP
[ ] Python 3.8+ installed and verified
[ ] Correct timezone set (UTC recommended)
[ ] Disk space > 20GB free
[ ] Network connectivity to Railway verified
```

**Verification Commands:**
```powershell
# Check Python
python --version

# Check disk space
Get-PSDrive C | Select-Object Used,Free

# Test Railway PostgreSQL
Test-NetConnection -ComputerName turntable.proxy.rlwy.net -Port 55082

# Test Railway Redis
Test-NetConnection -ComputerName switchyard.proxy.rlwy.net -Port 47725
```

### MT5 Instances Checklist

```
Pre-Test: MT5 Terminals
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] All 15 MT5 instances installed
[ ] Each instance logged into trading account
[ ] All 6 custom indicators installed in each instance
[ ] DataCollector.mq5 compiled and deployed
[ ] SQLite DLL (sqlite3.dll) in each Libraries folder
[ ] DLL imports enabled in all instances
```

**Verification Script:**
```powershell
$symbols = @("AUDJPY","AUDUSD","BTCUSD","ETHUSD","EURUSD",
             "GBPJPY","GBPUSD","NDX100","NZDUSD","US30",
             "USDCAD","USDCHF","USDJPY","XAGUSD","XAUUSD")

$passed = 0
foreach ($symbol in $symbols) {
    $servicePath = "C:\MT5Terminals\MT5_$symbol\MQL5\Services\DataCollector.ex5"
    $dllPath = "C:\MT5Terminals\MT5_$symbol\MQL5\Libraries\sqlite3.dll"

    if ((Test-Path $servicePath) -and (Test-Path $dllPath)) {
        Write-Host "[PASS] MT5_$symbol" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "[FAIL] MT5_$symbol - Missing files" -ForegroundColor Red
    }
}
Write-Host "`n$passed/15 instances ready"
```

### SQLite Database Checklist

```
Pre-Test: SQLite Database
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] C:\MT5Data\ directory exists
[ ] trading_data.db created by DataCollector
[ ] 15 tables exist (one per symbol)
[ ] Data being written every 30 seconds
```

**Verification Commands:**
```powershell
# Check database exists
Test-Path "C:\MT5Data\trading_data.db"

# List tables
sqlite3 C:\MT5Data\trading_data.db ".tables"

# Count tables
sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
```

### Railway Infrastructure Checklist

```
Pre-Test: Railway Services
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] PostgreSQL online and accessible
[ ] Redis online and accessible
[ ] 162 tables exist in PostgreSQL (26 app + 136 indicator)
[ ] Connection strings tested from Contabo
```

**Verification Script:**
```powershell
# Test PostgreSQL connection
python -c @"
from db_connections import test_connections
import json
result = test_connections()
print(json.dumps(result, indent=2))
"@

# Count PostgreSQL tables
psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

### Sync Script Checklist

```
Pre-Test: Sync Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] All files in C:\Scripts\sync_package\
[ ] Dependencies installed (psycopg2, python-dotenv)
[ ] .env file configured with credentials
[ ] Manual test run successful
```

---

## Test Scenario 1: Single Symbol E2E

**Goal:** Verify complete data flow for one symbol (EURUSD)

**Duration:** 15 minutes

**Prerequisites:**
- Only MT5_EURUSD instance running
- DataCollector service started
- Sync script ready

### Test Steps

#### Step 1.1: Start DataCollector (2 min)

```powershell
# Start MT5_EURUSD
Start-Process "C:\MT5Terminals\MT5_EURUSD\terminal64.exe"
```

In MT5_EURUSD:
1. Navigator → Services → DataCollector → Start Service
2. Verify in Experts tab: "Service started"

#### Step 1.2: Wait for Data Collection (2 min)

```powershell
# Wait 2 minutes for data collection
Start-Sleep -Seconds 120
```

#### Step 1.3: Verify SQLite Data (2 min)

```powershell
# Check table exists
sqlite3 C:\MT5Data\trading_data.db ".tables" | Select-String "eurusd"

# Count rows (should be ~4 rows after 2 minutes)
$rowCount = sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM eurusd;"
Write-Host "eurusd rows: $rowCount"

# Expected: 4 rows (2 min / 30 sec = 4 cycles)
if ($rowCount -ge 4) {
    Write-Host "[PASS] SQLite has expected row count" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Expected ~4 rows, got $rowCount" -ForegroundColor Red
}

# View recent data
sqlite3 C:\MT5Data\trading_data.db "SELECT datetime(timestamp, 'unixepoch'), open, close FROM eurusd ORDER BY timestamp DESC LIMIT 5;"
```

#### Step 1.4: Run Sync Script (2 min)

```powershell
cd C:\Scripts\sync_package
python sync_to_postgresql.py
```

**Expected output:**
```
Starting sync for 15 symbols...
Syncing eurusd...
Found X new rows for eurusd
Synced eurusd: X rows processed
...
Sync completed: 15/15 symbols, X rows, 0 errors
```

#### Step 1.5: Verify PostgreSQL Data (3 min)

```powershell
# Check all 9 timeframe tables for EURUSD
$timeframes = @("m5","m15","m30","h1","h2","h4","h8","h12","d1")

foreach ($tf in $timeframes) {
    $table = "eurusd_$tf"
    $count = psql $env:POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM $table;"
    Write-Host "$table : $count rows"
}
```

**Note:** Higher timeframes (H4+) may have 0 rows initially - this is expected as they only sync on boundary times.

#### Step 1.6: Verify Timeframe Filtering (2 min)

```powershell
# Check that M5 has more rows than H1
$m5_count = psql $env:POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM eurusd_m5;"
$h1_count = psql $env:POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM eurusd_h1;"

Write-Host "M5: $m5_count rows"
Write-Host "H1: $h1_count rows"

if ([int]$m5_count -ge [int]$h1_count) {
    Write-Host "[PASS] M5 has >= rows than H1 (correct)" -ForegroundColor Green
} else {
    Write-Host "[FAIL] M5 should have more rows than H1" -ForegroundColor Red
}
```

#### Step 1.7: Verify Data Values Match (2 min)

```powershell
# Get latest row from SQLite
$sqliteData = sqlite3 C:\MT5Data\trading_data.db "SELECT timestamp, open, high, low, close FROM eurusd ORDER BY timestamp DESC LIMIT 1;"
Write-Host "SQLite: $sqliteData"

# Get same timestamp from PostgreSQL (if it matches a timeframe)
# Note: Only M5 will have all timestamps
$pgData = psql $env:POSTGRESQL_URI -t -c "SELECT timestamp, open, high, low, close FROM eurusd_m5 ORDER BY timestamp DESC LIMIT 1;"
Write-Host "PostgreSQL: $pgData"
```

### Test 1 Success Criteria

```
Test 1 Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] SQLite shows increasing rows every 30 seconds
[ ] PostgreSQL receives data after sync
[ ] Data correctly filtered into 9 timeframe tables
[ ] OHLC values match between SQLite and PostgreSQL
[ ] JSON fields (fractals, trendlines, etc.) are valid
[ ] No errors in sync.log
```

---

## Test Scenario 2: Multiple Symbols

**Goal:** Verify all 15 symbols working simultaneously

**Duration:** 30 minutes

**Prerequisites:**
- Test Scenario 1 passed
- All 15 MT5 instances ready

### Test Steps

#### Step 2.1: Start All MT5 Instances (5 min)

```powershell
# Start all 15 MT5 terminals
C:\Scripts\start_all_mt5.ps1

# Or manually:
$symbols = @("AUDJPY","AUDUSD","BTCUSD","ETHUSD","EURUSD",
             "GBPJPY","GBPUSD","NDX100","NZDUSD","US30",
             "USDCAD","USDCHF","USDJPY","XAGUSD","XAUUSD")

foreach ($symbol in $symbols) {
    Start-Process "C:\MT5Terminals\MT5_$symbol\terminal64.exe"
    Start-Sleep -Seconds 2
}
```

In each MT5 instance:
- Start DataCollector service (Navigator → Services → Start)

#### Step 2.2: Wait for Data Collection (5 min)

```powershell
# Wait 5 minutes for all symbols to collect data
Start-Sleep -Seconds 300
```

#### Step 2.3: Verify SQLite Has All Tables (2 min)

```powershell
# Count tables (should be 15)
$tableCount = sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';"
Write-Host "SQLite tables: $tableCount"

# List all tables
sqlite3 C:\MT5Data\trading_data.db ".tables"

# Expected: audjpy audusd btcusd ethusd eurusd gbpjpy gbpusd ndx100 nzdusd us30 usdcad usdchf usdjpy xagusd xauusd

if ([int]$tableCount -eq 15) {
    Write-Host "[PASS] All 15 tables exist" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Expected 15 tables, got $tableCount" -ForegroundColor Red
}
```

#### Step 2.4: Verify Each Symbol Has Data (3 min)

```powershell
$symbols = @("audjpy","audusd","btcusd","ethusd","eurusd",
             "gbpjpy","gbpusd","ndx100","nzdusd","us30",
             "usdcad","usdchf","usdjpy","xagusd","xauusd")

$allHaveData = $true
foreach ($symbol in $symbols) {
    $count = sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM $symbol;"
    if ([int]$count -gt 0) {
        Write-Host "[OK] $symbol : $count rows" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $symbol : NO DATA" -ForegroundColor Red
        $allHaveData = $false
    }
}

if ($allHaveData) {
    Write-Host "`n[PASS] All symbols have data" -ForegroundColor Green
}
```

#### Step 2.5: Run Sync Script (5 min)

```powershell
cd C:\Scripts\sync_package
python sync_to_postgresql.py
```

#### Step 2.6: Verify PostgreSQL Has All Tables (5 min)

```powershell
# Count indicator tables (should be 135 = 15 symbols × 9 timeframes)
$pgTableCount = psql $env:POSTGRESQL_URI -t -c "
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name ~ '^(audjpy|audusd|btcusd|ethusd|eurusd|gbpjpy|gbpusd|ndx100|nzdusd|us30|usdcad|usdchf|usdjpy|xagusd|xauusd)_';"

Write-Host "PostgreSQL indicator tables: $pgTableCount"

if ([int]$pgTableCount -eq 135) {
    Write-Host "[PASS] All 135 indicator tables exist" -ForegroundColor Green
} else {
    Write-Host "[WARN] Expected 135 tables, got $pgTableCount" -ForegroundColor Yellow
}
```

#### Step 2.7: Check Sync Logs (2 min)

```powershell
# Check for errors
$errors = Get-Content "C:\Scripts\sync_package\sync.log" | Select-String "ERROR"
if ($errors) {
    Write-Host "[WARN] Errors found in log:" -ForegroundColor Yellow
    $errors | ForEach-Object { Write-Host $_.Line }
} else {
    Write-Host "[PASS] No errors in sync log" -ForegroundColor Green
}

# Check sync completion
$lastCompletion = Get-Content "C:\Scripts\sync_package\sync.log" | Select-String "Sync completed" | Select-Object -Last 1
Write-Host "Last sync: $($lastCompletion.Line)"
```

#### Step 2.8: Verify sync_state.json (1 min)

```powershell
# Check sync state has all symbols
$state = Get-Content "C:\Scripts\sync_package\sync_state.json" | ConvertFrom-Json
$symbolCount = ($state | Get-Member -MemberType NoteProperty).Count
Write-Host "Symbols in sync state: $symbolCount"

if ($symbolCount -eq 15) {
    Write-Host "[PASS] sync_state.json tracking all 15 symbols" -ForegroundColor Green
}
```

### Test 2 Success Criteria

```
Test 2 Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] All 15 symbols collecting data to SQLite
[ ] All 135 PostgreSQL tables receiving data
[ ] No errors in sync logs
[ ] sync_state.json tracking all 15 symbols
[ ] VPS resources (CPU, memory) stable
```

---

## Test Scenario 3: Automatic Sync

**Goal:** Verify Windows Task Scheduler runs sync automatically

**Duration:** 60 minutes

**Prerequisites:**
- Test Scenario 2 passed
- Task Scheduler configured

### Test Steps

#### Step 3.1: Start Task Scheduler Task (1 min)

```powershell
# Start the sync task
Start-ScheduledTask -TaskName "TradingAlertsSyncTask"

# Verify task is running
Get-ScheduledTask -TaskName "TradingAlertsSyncTask" | Select-Object TaskName, State
```

#### Step 3.2: Monitor for 60 Minutes

```powershell
# Monitoring script
$startTime = Get-Date
$duration = 60  # minutes
$checkInterval = 10  # minutes

while ((Get-Date) -lt $startTime.AddMinutes($duration)) {
    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)

    # Get task info
    $taskInfo = Get-ScheduledTaskInfo -TaskName "TradingAlertsSyncTask"

    # Get row count from PostgreSQL
    $rowCount = psql $env:POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM eurusd_m5;"

    # Get last log entry
    $lastLog = Get-Content "C:\Scripts\sync_package\sync.log" -Tail 1

    Write-Host "`n=== Check at $elapsed minutes ===" -ForegroundColor Cyan
    Write-Host "Task Last Run: $($taskInfo.LastRunTime)"
    Write-Host "Task Result: $($taskInfo.LastTaskResult)"
    Write-Host "eurusd_m5 rows: $rowCount"
    Write-Host "Last Log: $lastLog"

    Start-Sleep -Seconds ($checkInterval * 60)
}

Write-Host "`n=== 60-minute monitoring complete ===" -ForegroundColor Green
```

#### Step 3.3: Verify Task History (2 min)

```powershell
# Check task ran multiple times
$taskHistory = Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" | Where-Object {
    $_.Message -like "*TradingAlertsSyncTask*" -and
    $_.TimeCreated -gt (Get-Date).AddHours(-1)
} | Select-Object TimeCreated, Message -First 20

$taskHistory | Format-Table
```

#### Step 3.4: Verify Data Growth (2 min)

```powershell
# PostgreSQL should have grown over the hour
$symbols = @("eurusd","btcusd","xauusd")  # Sample check

foreach ($symbol in $symbols) {
    $count = psql $env:POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM ${symbol}_m5;"
    Write-Host "$symbol M5: $count rows"
}
```

### Test 3 Success Criteria

```
Test 3 Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] Task runs every 30 seconds (or configured interval)
[ ] No task failures in Task Scheduler
[ ] sync.log shows regular cycles
[ ] PostgreSQL data continuously increasing
[ ] No gaps in data collection (check timestamps)
[ ] System stable for full 60 minutes
```

---

## Test Scenario 4: Failure Recovery

**Goal:** Verify system handles failures gracefully

**Duration:** 30 minutes

### Test 4A: Network Interruption (10 min)

#### Steps

```powershell
# 1. Note current state
$beforeCount = psql $env:POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM eurusd_m5;"
Write-Host "Before: $beforeCount rows"

# 2. Disable network adapter (simulates outage)
Get-NetAdapter | Where-Object Status -eq "Up" | Disable-NetAdapter -Confirm:$false
Write-Host "Network disabled"

# 3. Wait 5 minutes (DataCollector continues to SQLite)
Start-Sleep -Seconds 300
Write-Host "Waited 5 minutes with network down"

# 4. Re-enable network
Get-NetAdapter | Enable-NetAdapter -Confirm:$false
Start-Sleep -Seconds 30
Write-Host "Network re-enabled"

# 5. Run sync manually (or wait for scheduled task)
cd C:\Scripts\sync_package
python sync_to_postgresql.py

# 6. Verify catch-up
$afterCount = psql $env:POSTGRESQL_URI -t -c "SELECT COUNT(*) FROM eurusd_m5;"
Write-Host "After: $afterCount rows"

$newRows = [int]$afterCount - [int]$beforeCount
Write-Host "New rows synced: $newRows"
```

**Success Criteria:**
- SQLite continued receiving data during outage
- Sync caught up after network restored
- No data loss

### Test 4B: PostgreSQL Unavailable (10 min)

```powershell
# Note: This requires stopping Railway PostgreSQL service
# OR simulating by blocking the port temporarily

# 1. Block PostgreSQL port (firewall rule)
New-NetFirewallRule -DisplayName "Block PostgreSQL Test" -Direction Outbound -RemotePort 55082 -Action Block

# 2. Try sync (should fail gracefully)
cd C:\Scripts\sync_package
python sync_to_postgresql.py
# Expected: Retry errors, then fail after MAX_RETRIES

# 3. Remove block
Remove-NetFirewallRule -DisplayName "Block PostgreSQL Test"

# 4. Run sync again
python sync_to_postgresql.py
# Expected: Success, catches up
```

**Success Criteria:**
- Sync script retries on failure
- Graceful error handling (no crash)
- Auto-recovery when PostgreSQL available

### Test 4C: MT5 Service Crash (10 min)

```powershell
# 1. Note current SQLite state
$before = sqlite3 C:\MT5Data\trading_data.db "SELECT MAX(timestamp) FROM eurusd;"
Write-Host "Last timestamp before: $before"

# 2. Stop DataCollector service in MT5_EURUSD
# (Do this manually in MT5: Navigator → Services → Stop)
Write-Host "Stop DataCollector service now..."
Start-Sleep -Seconds 60

# 3. Verify no new data
$during = sqlite3 C:\MT5Data\trading_data.db "SELECT MAX(timestamp) FROM eurusd;"
Write-Host "Last timestamp during stop: $during"

# 4. Restart DataCollector service
# (Do this manually in MT5: Navigator → Services → Start)
Write-Host "Start DataCollector service now..."
Start-Sleep -Seconds 120

# 5. Verify data collection resumed
$after = sqlite3 C:\MT5Data\trading_data.db "SELECT MAX(timestamp) FROM eurusd;"
Write-Host "Last timestamp after restart: $after"
```

**Success Criteria:**
- No crash when DataCollector stops
- Data collection resumes after restart
- Sync script handles "no new data" gracefully

### Test 4 Success Criteria

```
Test 4 Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] SQLite acts as reliable buffer during outages
[ ] No data loss during network interruptions
[ ] Sync script retries on failure
[ ] System auto-recovers when services restore
[ ] Graceful degradation (no crashes)
```

---

## Test Scenario 5: Data Integrity

**Goal:** Verify data accuracy end-to-end

**Duration:** 30 minutes

### Test Steps

#### Step 5.1: Select Test Timestamp (2 min)

```powershell
# Get a timestamp that exists in all systems
# Choose one that's on an M5 boundary (minute % 5 == 0)

$testTimestamp = sqlite3 C:\MT5Data\trading_data.db "
SELECT timestamp FROM eurusd
WHERE timestamp % 300 = 0  -- M5 boundary
ORDER BY timestamp DESC
LIMIT 1;"

Write-Host "Test timestamp: $testTimestamp"
$testDateTime = [DateTimeOffset]::FromUnixTimeSeconds($testTimestamp).DateTime
Write-Host "DateTime: $testDateTime UTC"
```

#### Step 5.2: Query SQLite (3 min)

```powershell
# Get complete row from SQLite
$sqliteRow = sqlite3 C:\MT5Data\trading_data.db "
SELECT timestamp, open, high, low, close,
       fractals, horizontal_trendlines, diagonal_trendlines,
       momentum_candles, keltner_channels, tema, hrma, smma, zigzag
FROM eurusd
WHERE timestamp = $testTimestamp;"

Write-Host "SQLite data:"
Write-Host $sqliteRow
```

#### Step 5.3: Query PostgreSQL (3 min)

```powershell
# Get same row from PostgreSQL (eurusd_m5 will have it)
$pgRow = psql $env:POSTGRESQL_URI -t -c "
SELECT timestamp, open, high, low, close,
       fractals, horizontal_trendlines, diagonal_trendlines,
       momentum_candles, keltner_channels, tema, hrma, smma, zigzag
FROM eurusd_m5
WHERE timestamp = to_timestamp($testTimestamp);"

Write-Host "PostgreSQL data:"
Write-Host $pgRow
```

#### Step 5.4: Compare OHLC Values (5 min)

```powershell
# Parse and compare OHLC
$sqliteOHLC = sqlite3 C:\MT5Data\trading_data.db "SELECT open, high, low, close FROM eurusd WHERE timestamp = $testTimestamp;"
$pgOHLC = psql $env:POSTGRESQL_URI -t -c "SELECT open, high, low, close FROM eurusd_m5 WHERE timestamp = to_timestamp($testTimestamp);"

Write-Host "`nComparison:"
Write-Host "SQLite OHLC:     $sqliteOHLC"
Write-Host "PostgreSQL OHLC: $pgOHLC"

# Values should be identical
```

#### Step 5.5: Validate JSON Fields (10 min)

```powershell
# Check JSON fields are valid
$fractals = psql $env:POSTGRESQL_URI -t -c "SELECT fractals FROM eurusd_m5 WHERE timestamp = to_timestamp($testTimestamp);"

# Try to parse as JSON
try {
    $jsonTest = $fractals | ConvertFrom-Json
    Write-Host "[PASS] Fractals JSON is valid" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Fractals JSON is invalid" -ForegroundColor Red
}
```

#### Step 5.6: Check for Data Corruption (5 min)

```powershell
# Check for NULL values where data should exist
$nullCheck = psql $env:POSTGRESQL_URI -t -c "
SELECT COUNT(*)
FROM eurusd_m5
WHERE open IS NULL OR high IS NULL OR low IS NULL OR close IS NULL;"

if ([int]$nullCheck -eq 0) {
    Write-Host "[PASS] No NULL OHLC values" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Found $nullCheck rows with NULL OHLC" -ForegroundColor Red
}

# Check for price anomalies (high < low, etc.)
$anomalyCheck = psql $env:POSTGRESQL_URI -t -c "
SELECT COUNT(*)
FROM eurusd_m5
WHERE high < low OR open < 0 OR close < 0;"

if ([int]$anomalyCheck -eq 0) {
    Write-Host "[PASS] No price anomalies" -ForegroundColor Green
} else {
    Write-Host "[FAIL] Found $anomalyCheck rows with anomalies" -ForegroundColor Red
}
```

### Test 5 Success Criteria

```
Test 5 Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] OHLC values identical between SQLite and PostgreSQL
[ ] JSON fields valid and parseable
[ ] No data corruption or truncation
[ ] Timestamps correctly converted (Unix → PostgreSQL)
[ ] No NULL values in required fields
[ ] No price anomalies
```

---

## Test Execution Checklist

### Master Test Checklist

```
E2E Testing Execution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pre-Test Verification:
[ ] VPS infrastructure verified
[ ] MT5 instances verified
[ ] SQLite database verified
[ ] Railway services verified
[ ] Sync script verified

Test Scenario 1: Single Symbol E2E (15 min)
[ ] Step 1.1: Start DataCollector
[ ] Step 1.2: Wait for collection
[ ] Step 1.3: Verify SQLite data
[ ] Step 1.4: Run sync script
[ ] Step 1.5: Verify PostgreSQL data
[ ] Step 1.6: Verify timeframe filtering
[ ] Step 1.7: Verify data values match
[ ] PASSED / FAILED

Test Scenario 2: Multiple Symbols (30 min)
[ ] Step 2.1: Start all MT5 instances
[ ] Step 2.2: Wait for collection
[ ] Step 2.3: Verify SQLite tables
[ ] Step 2.4: Verify each symbol
[ ] Step 2.5: Run sync script
[ ] Step 2.6: Verify PostgreSQL tables
[ ] Step 2.7: Check sync logs
[ ] Step 2.8: Verify sync_state.json
[ ] PASSED / FAILED

Test Scenario 3: Automatic Sync (60 min)
[ ] Step 3.1: Start scheduled task
[ ] Step 3.2: Monitor for 60 minutes
[ ] Step 3.3: Verify task history
[ ] Step 3.4: Verify data growth
[ ] PASSED / FAILED

Test Scenario 4: Failure Recovery (30 min)
[ ] Test 4A: Network interruption
[ ] Test 4B: PostgreSQL unavailable
[ ] Test 4C: MT5 service crash
[ ] PASSED / FAILED

Test Scenario 5: Data Integrity (30 min)
[ ] Step 5.1: Select test timestamp
[ ] Step 5.2: Query SQLite
[ ] Step 5.3: Query PostgreSQL
[ ] Step 5.4: Compare OHLC values
[ ] Step 5.5: Validate JSON fields
[ ] Step 5.6: Check for corruption
[ ] PASSED / FAILED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Time: ~2.75 hours
Pass Rate: __/5 scenarios passed
```

---

## Test Results Template

Use this template to document test results:

```
E2E Test Results Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test Date: YYYY-MM-DD
Test Time: HH:MM - HH:MM
Tester: [Name]
Environment: Contabo VPS / Railway PostgreSQL

Pre-Test Verification:
  VPS Status: [PASS/FAIL]
  MT5 Status: [PASS/FAIL]
  SQLite Status: [PASS/FAIL]
  PostgreSQL Status: [PASS/FAIL]
  Sync Script Status: [PASS/FAIL]

Test Results:

Scenario 1: Single Symbol E2E
  Status: [PASS/FAIL]
  Duration: XX minutes
  Notes: [Any observations]

Scenario 2: Multiple Symbols
  Status: [PASS/FAIL]
  Duration: XX minutes
  Symbols Synced: XX/15
  Tables Created: XXX/135
  Notes: [Any observations]

Scenario 3: Automatic Sync
  Status: [PASS/FAIL]
  Duration: 60 minutes
  Task Executions: XX
  Errors: XX
  Notes: [Any observations]

Scenario 4: Failure Recovery
  Test 4A (Network): [PASS/FAIL]
  Test 4B (PostgreSQL): [PASS/FAIL]
  Test 4C (MT5): [PASS/FAIL]
  Notes: [Any observations]

Scenario 5: Data Integrity
  Status: [PASS/FAIL]
  OHLC Match: [YES/NO]
  JSON Valid: [YES/NO]
  Corruption Found: [YES/NO]
  Notes: [Any observations]

Overall Result: [PASS/FAIL]
Pass Rate: X/5 (XX%)

Issues Found:
1. [Issue description]
2. [Issue description]

Recommendations:
1. [Recommendation]
2. [Recommendation]

Sign-off:
  Tester: _______________ Date: ___________
  Reviewer: _____________ Date: ___________
```

---

## Next Steps

After E2E testing passes:

1. ➡️ **[Redis Caching Testing Plan](./07-redis-caching-testing-plan.md)** - Test caching layer
2. ➡️ **[Performance Testing Plan](./08-performance-testing-plan.md)** - Load testing

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
