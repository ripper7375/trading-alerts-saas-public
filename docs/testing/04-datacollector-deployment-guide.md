# DataCollector.mq5 Deployment Guide

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [DataCollector.mq5 Architecture](#datacollectormq5-architecture)
3. [Prerequisites](#prerequisites)
4. [SQLite DLL Installation](#sqlite-dll-installation)
5. [Compilation](#compilation)
6. [Deployment to MT5 Instances](#deployment-to-mt5-instances)
7. [Service Configuration](#service-configuration)
8. [Starting the Service](#starting-the-service)
9. [Verifying Data Collection](#verifying-data-collection)
10. [Troubleshooting](#troubleshooting)

---

## Overview

**DataCollector.mq5** is an MQL5 Service that:
- Runs 24/7 without requiring a chart window
- Reads indicator buffers from 6 custom indicators
- Collects OHLC + indicator data every 30 seconds
- Stores data in SQLite database (`C:\MT5Data\trading_data.db`)
- Creates one table per symbol (lowercase: `eurusd`, `btcusd`, etc.)

**Architecture Position:**
```
┌─────────────────────────────────────────────────────────────┐
│                        MT5 Terminal                          │
├─────────────────────────────────────────────────────────────┤
│  Custom Indicators (running on chart)                        │
│         ↓ (indicator buffers)                                │
│  DataCollector.mq5 Service [THIS COMPONENT]                  │
│         ↓ (writes every 30 seconds)                          │
│  SQLite Database (C:\MT5Data\trading_data.db)               │
└─────────────────────────────────────────────────────────────┘
```

---

## DataCollector.mq5 Architecture

### Service vs Expert Advisor

| Feature | Expert Advisor (EA) | Service |
|---------|---------------------|---------|
| Requires chart | Yes | **No** |
| Runs continuously | Yes (if chart open) | **Yes (always)** |
| Multi-symbol | One symbol | **Any symbol** |
| Auto-start | Chart must be open | **Starts with terminal** |

**DataCollector is a SERVICE** because:
- It needs to run 24/7 without user interaction
- It monitors multiple symbols from one instance
- It survives chart changes and terminal restarts

### Data Collection Flow

```
Every 30 seconds:
┌─────────────────────────────────────────────┐
│ 1. Read current time (Unix timestamp)       │
│ 2. For each monitored symbol:               │
│    ├─ Read OHLC from chart                  │
│    ├─ Read each indicator buffer            │
│    ├─ Convert indicator data to JSON        │
│    └─ Insert row into SQLite                │
│ 3. Log collection status                    │
└─────────────────────────────────────────────┘
```

### Database Schema

DataCollector creates this table structure per symbol:

```sql
CREATE TABLE eurusd (
    timestamp INTEGER PRIMARY KEY,      -- Unix timestamp
    open REAL,                          -- Open price
    high REAL,                          -- High price
    low REAL,                           -- Low price
    close REAL,                         -- Close price
    fractals TEXT,                      -- JSON: fractal points
    horizontal_trendlines TEXT,         -- JSON: horizontal lines
    diagonal_trendlines TEXT,           -- JSON: diagonal lines
    momentum_candles TEXT,              -- JSON: momentum candle data
    keltner_channels TEXT,              -- JSON: Keltner band values
    tema REAL,                          -- TEMA moving average
    hrma REAL,                          -- HRMA moving average
    smma REAL,                          -- SMMA moving average
    zigzag TEXT                         -- JSON: ZigZag structure
);
```

---

## Prerequisites

Before deploying DataCollector:

- [ ] MT5 instances installed (see [MT5 Installation Guide](./02-mt5-installation-guide.md))
- [ ] Custom indicators installed (see [Indicator Installation Guide](./03-indicator-installation-guide.md))
- [ ] DLL imports enabled in MT5
- [ ] `C:\MT5Data\` directory created
- [ ] DataCollector.mq5 source file available

---

## SQLite DLL Installation

DataCollector requires SQLite3 DLL for database operations.

### Step 1: Download SQLite DLL

```powershell
# Download SQLite DLL
$sqliteUrl = "https://www.sqlite.org/2024/sqlite-dll-win-x64-3450000.zip"
$downloadPath = "C:\Users\Administrator\Downloads\sqlite-dll.zip"

Invoke-WebRequest -Uri $sqliteUrl -OutFile $downloadPath
```

### Step 2: Extract and Copy

```powershell
# Extract SQLite DLL
Expand-Archive -Path $downloadPath -DestinationPath "C:\Users\Administrator\Downloads\sqlite-dll"

# Copy to each MT5 instance's Libraries folder
$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

foreach ($symbol in $symbols) {
    $libDir = "C:\MT5Terminals\MT5_$symbol\MQL5\Libraries"
    New-Item -ItemType Directory -Force -Path $libDir | Out-Null

    Copy-Item "C:\Users\Administrator\Downloads\sqlite-dll\sqlite3.dll" -Destination $libDir -Force
    Write-Host "Copied sqlite3.dll to MT5_$symbol" -ForegroundColor Green
}
```

### Step 3: Verify DLL Installation

```powershell
# Verify DLL exists in all instances
$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

foreach ($symbol in $symbols) {
    $dllPath = "C:\MT5Terminals\MT5_$symbol\MQL5\Libraries\sqlite3.dll"
    if (Test-Path $dllPath) {
        Write-Host "[OK] MT5_$symbol: sqlite3.dll present" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] MT5_$symbol: sqlite3.dll NOT found" -ForegroundColor Red
    }
}
```

---

## Compilation

### Step 1: Open MetaEditor

1. In any MT5 terminal: **Tools** → **MetaQuotes Language Editor** (or F4)
2. Or run directly: `C:\MT5Terminals\MT5_EURUSD\metaeditor64.exe`

### Step 2: Create DataCollector.mq5

1. **File** → **New** → **Service** → **Next**
2. Name: `DataCollector`
3. Click **Finish**

### Step 3: Paste Source Code

Replace the generated template with your DataCollector.mq5 source code.

**Key input parameters:**

```mql5
//+------------------------------------------------------------------+
//| DataCollector.mq5 - MT5 Data Collection Service                  |
//| Part 20 - Trading Alerts SaaS                                    |
//+------------------------------------------------------------------+
#property service

// Input parameters
input int    CollectionInterval = 30;                    // Collection interval (seconds)
input string DatabasePath = "C:\\MT5Data\\trading_data.db";  // SQLite database path
input string SymbolToMonitor = "";                       // Symbol to monitor (empty = use terminal symbol)
input int    BufferSize = 100;                           // Historical bars to check
input bool   EnableLogging = true;                       // Enable detailed logging
```

### Step 4: Compile

1. Click **Compile** button (or F7)
2. Check **Errors** tab at bottom
3. Expected: "0 error(s), 0 warning(s)"
4. Compiled file: `DataCollector.ex5` in `MQL5\Services\`

### Compilation Errors and Solutions

| Error | Solution |
|-------|----------|
| `'sqlite3.dll' - library not found` | Copy sqlite3.dll to MQL5\Libraries |
| `Cannot open file` | Check file path in #include |
| `Function not found` | Check indicator names match exactly |
| `Undeclared identifier` | Check variable declarations |

### Step 5: Copy Compiled Service to All Instances

```powershell
# Copy compiled DataCollector.ex5 to all instances
$sourceFile = "C:\MT5Terminals\MT5_EURUSD\MQL5\Services\DataCollector.ex5"
$symbols = @("AUDUSD", "BTCUSD", "ETHUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")
# Note: EURUSD is source, so not in list

foreach ($symbol in $symbols) {
    $destDir = "C:\MT5Terminals\MT5_$symbol\MQL5\Services"
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null

    Copy-Item $sourceFile -Destination $destDir -Force
    Write-Host "Copied DataCollector.ex5 to MT5_$symbol" -ForegroundColor Green
}
```

---

## Deployment to MT5 Instances

### Service Location

Place compiled `DataCollector.ex5` in:
```
C:\MT5Terminals\MT5_[SYMBOL]\MQL5\Services\DataCollector.ex5
```

### Verify Deployment

```powershell
# Verify DataCollector.ex5 exists in all instances
$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

$allPresent = $true
foreach ($symbol in $symbols) {
    $servicePath = "C:\MT5Terminals\MT5_$symbol\MQL5\Services\DataCollector.ex5"
    if (Test-Path $servicePath) {
        Write-Host "[OK] MT5_$symbol: DataCollector.ex5 present" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] MT5_$symbol: DataCollector.ex5 NOT found" -ForegroundColor Red
        $allPresent = $false
    }
}

if ($allPresent) {
    Write-Host "`nAll instances have DataCollector service!" -ForegroundColor Cyan
}
```

---

## Service Configuration

### Input Parameters

Configure DataCollector for each MT5 instance:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `CollectionInterval` | `30` | Collect data every 30 seconds |
| `DatabasePath` | `C:\MT5Data\trading_data.db` | Shared SQLite database |
| `SymbolToMonitor` | Leave empty | Uses the terminal's default symbol |
| `BufferSize` | `100` | Bars to read for indicators |
| `EnableLogging` | `true` | Log to Experts tab |

### Symbol Assignment Per Instance

Each MT5 instance monitors one symbol:

| Instance | Symbol | Table Name (lowercase) |
|----------|--------|------------------------|
| MT5_AUDJPY | AUDJPY | `audjpy` |
| MT5_AUDUSD | AUDUSD | `audusd` |
| MT5_BTCUSD | BTCUSD | `btcusd` |
| MT5_ETHUSD | ETHUSD | `ethusd` |
| MT5_EURUSD | EURUSD | `eurusd` |
| MT5_GBPJPY | GBPJPY | `gbpjpy` |
| MT5_GBPUSD | GBPUSD | `gbpusd` |
| MT5_NDX100 | NDX100 | `ndx100` |
| MT5_NZDUSD | NZDUSD | `nzdusd` |
| MT5_US30 | US30 | `us30` |
| MT5_USDCAD | USDCAD | `usdcad` |
| MT5_USDCHF | USDCHF | `usdchf` |
| MT5_USDJPY | USDJPY | `usdjpy` |
| MT5_XAGUSD | XAGUSD | `xagusd` |
| MT5_XAUUSD | XAUUSD | `xauusd` |

---

## Starting the Service

### Method 1: Via Navigator (Manual)

For each MT5 instance:

1. Open **Navigator** panel (Ctrl+N)
2. Expand **Services**
3. Find **DataCollector**
4. Right-click → **Start Service**
5. Configure parameters if prompted
6. Click **OK**

### Method 2: Via Menu

1. **Tools** → **Services**
2. Find **DataCollector** in list
3. Click **Start**

### Method 3: Auto-Start on Terminal Launch

To make DataCollector start automatically:

1. Start the service manually (Method 1 or 2)
2. Save the profile: **File** → **Profiles** → **Save As** → "DataCollector"
3. Set as default profile (optional)

Or configure in terminal config file:
```ini
; File: C:\MT5Terminals\MT5_EURUSD\config\common.ini
[Services]
AutoStart=DataCollector
```

### Batch Start Script

```powershell
# File: C:\Scripts\start_datacollector.ps1
# Note: Services auto-start if previously running when MT5 restarts

Write-Host "Starting all MT5 terminals with DataCollector..." -ForegroundColor Cyan

$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

foreach ($symbol in $symbols) {
    $exePath = "C:\MT5Terminals\MT5_$symbol\terminal64.exe"

    if (Test-Path $exePath) {
        Start-Process -FilePath $exePath
        Write-Host "Started MT5_$symbol" -ForegroundColor Green
        Start-Sleep -Seconds 3  # Stagger startups
    }
}

Write-Host "`nAll terminals started. Check Services tab in each terminal." -ForegroundColor Cyan
```

---

## Verifying Data Collection

### Step 1: Check Service Status

In each MT5 instance:

1. Open **Experts** tab (Ctrl+T → Experts)
2. Look for DataCollector logs:
   ```
   DataCollector: Service started
   DataCollector: Connected to database C:\MT5Data\trading_data.db
   DataCollector: Collecting data for EURUSD
   DataCollector: Inserted row at timestamp 1704700800
   ```

### Step 2: Verify SQLite Database Created

```powershell
# Check database file exists
$dbPath = "C:\MT5Data\trading_data.db"

if (Test-Path $dbPath) {
    $size = (Get-Item $dbPath).Length / 1KB
    Write-Host "Database exists: $dbPath" -ForegroundColor Green
    Write-Host "Size: $([math]::Round($size, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "Database NOT found: $dbPath" -ForegroundColor Red
}
```

### Step 3: Query SQLite Database

```powershell
# Using sqlite3 CLI
cd C:\Tools\sqlite

# List tables
.\sqlite3 C:\MT5Data\trading_data.db ".tables"
# Expected: audjpy audusd btcusd ethusd eurusd ...

# Count rows per table
.\sqlite3 C:\MT5Data\trading_data.db "SELECT 'eurusd', COUNT(*) FROM eurusd;"
.\sqlite3 C:\MT5Data\trading_data.db "SELECT 'btcusd', COUNT(*) FROM btcusd;"

# View recent data
.\sqlite3 C:\MT5Data\trading_data.db "SELECT * FROM eurusd ORDER BY timestamp DESC LIMIT 5;"
```

### Step 4: Verify Data Structure

```powershell
# Check table schema
.\sqlite3 C:\MT5Data\trading_data.db ".schema eurusd"
```

**Expected output:**
```sql
CREATE TABLE eurusd (
    timestamp INTEGER PRIMARY KEY,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    fractals TEXT,
    horizontal_trendlines TEXT,
    diagonal_trendlines TEXT,
    momentum_candles TEXT,
    keltner_channels TEXT,
    tema REAL,
    hrma REAL,
    smma REAL,
    zigzag TEXT
);
```

### Step 5: Monitor Data Collection

```powershell
# Watch row count increase over time
while ($true) {
    $timestamp = Get-Date -Format "HH:mm:ss"
    $count = & C:\Tools\sqlite\sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM eurusd;"
    Write-Host "[$timestamp] eurusd rows: $count"
    Start-Sleep -Seconds 30
}
```

---

## Troubleshooting

### Issue 1: Service Not Appearing in Navigator

**Symptoms:** DataCollector not visible in Services list

**Solutions:**
1. **Refresh Navigator:**
   - Right-click "Services" → "Refresh"
2. **Check file location:**
   - Must be in `MQL5\Services\` folder
3. **Check file extension:**
   - Must be `.ex5` (compiled)
4. **Restart MT5:**
   - Close and reopen terminal

### Issue 2: Service Fails to Start

**Symptoms:** Error when starting service

**Solutions:**
1. **Check Experts tab for errors:**
   - Ctrl+T → Experts
2. **Verify DLL imports enabled:**
   - Tools → Options → Expert Advisors → Allow DLL imports
3. **Check sqlite3.dll:**
   - Must be in MQL5\Libraries
4. **Run MT5 as Administrator:**
   - First time may need elevated permissions

### Issue 3: Database Not Created

**Symptoms:** `trading_data.db` doesn't exist

**Solutions:**
1. **Check DatabasePath:**
   - Verify path is correct in service parameters
2. **Check folder permissions:**
   ```powershell
   icacls "C:\MT5Data" /grant "Everyone:(OI)(CI)F"
   ```
3. **Check Experts tab for errors:**
   - Database connection errors appear here
4. **Test SQLite DLL:**
   - Create test script that just opens database

### Issue 4: No Data Being Written

**Symptoms:** Database exists but no rows

**Solutions:**
1. **Check service is running:**
   - Tools → Services → DataCollector should show "Running"
2. **Check symbol is available:**
   - Symbol must be in Market Watch
3. **Check indicators are loaded:**
   - Indicators must be attached or available
4. **Check Experts tab:**
   - Look for collection errors

### Issue 5: Indicator Data Missing or NULL

**Symptoms:** OHLC present but indicator columns are NULL

**Solutions:**
1. **Verify indicator names:**
   - Names in code must match exactly
2. **Check indicator buffer indices:**
   - Buffer numbers must be correct
3. **Attach indicators to chart:**
   - Some indicators need to be on chart first
4. **Load historical data:**
   - Indicators need history to calculate

### Issue 6: High CPU Usage

**Symptoms:** MT5 using excessive CPU

**Solutions:**
1. **Increase CollectionInterval:**
   - Change from 30 to 60 seconds
2. **Reduce BufferSize:**
   - Change from 100 to 50
3. **Disable unnecessary indicators:**
   - Remove unused indicators from chart
4. **Close unused charts:**
   - Keep only necessary charts open

---

## Quick Reference

### Service Paths

```
Service executable:
C:\MT5Terminals\MT5_[SYMBOL]\MQL5\Services\DataCollector.ex5

SQLite DLL:
C:\MT5Terminals\MT5_[SYMBOL]\MQL5\Libraries\sqlite3.dll

Database:
C:\MT5Data\trading_data.db
```

### SQLite Commands

```powershell
# List tables
sqlite3 C:\MT5Data\trading_data.db ".tables"

# Count all tables
sqlite3 C:\MT5Data\trading_data.db "SELECT name FROM sqlite_master WHERE type='table';"

# Row count for all tables
sqlite3 C:\MT5Data\trading_data.db "SELECT name, (SELECT COUNT(*) FROM eurusd) FROM sqlite_master WHERE type='table' AND name='eurusd';"

# View recent data
sqlite3 C:\MT5Data\trading_data.db "SELECT datetime(timestamp, 'unixepoch'), open, close FROM eurusd ORDER BY timestamp DESC LIMIT 10;"

# Check database size
sqlite3 C:\MT5Data\trading_data.db "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();"
```

### MT5 Service Commands

| Action | Method |
|--------|--------|
| Start service | Navigator → Services → Right-click → Start |
| Stop service | Navigator → Services → Right-click → Stop |
| View logs | Toolbox (Ctrl+T) → Experts tab |
| Edit parameters | Stop service → Right-click → Properties |

---

## Next Steps

After DataCollector is running:

1. ➡️ **[Sync Script Deployment Guide](./05-sync-script-deployment-guide.md)** - Deploy Python sync script

---

## Checklist

Before proceeding to sync script deployment:

- [ ] SQLite DLL (sqlite3.dll) installed in all MT5 instances
- [ ] DataCollector.mq5 compiled successfully
- [ ] DataCollector.ex5 deployed to all 15 instances
- [ ] Services started in all MT5 instances
- [ ] `C:\MT5Data\trading_data.db` created
- [ ] 15 tables created (one per symbol)
- [ ] Data being written every 30 seconds
- [ ] OHLC values present in database
- [ ] Indicator values present in database

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
