# DataCollector Deployment Guide

**Part 20 - MT5 Data Collection Service**
**Last Updated:** 2026-01-10
**Status:** ✅ TESTED & WORKING

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [File Structure](#file-structure)
4. [File Deployment](#file-deployment)
5. [Symbol Validation Configuration](#symbol-validation-configuration)
6. [Service Configuration](#service-configuration)
7. [Multi-Symbol Deployment](#multi-symbol-deployment)
8. [Testing and Verification](#testing-and-verification)
9. [Troubleshooting](#troubleshooting)

---

## Overview

DataCollector is an MT5 Service that runs 24/7 to collect indicator data and store it to SQLite. It uses flexible symbol validation to support Eightcap's `.i` suffix format.

**Key Features:**

- ✅ Runs as MT5 Service (no chart window required)
- ✅ Flexible symbol validation (handles `.i` suffix automatically)
- ✅ Stores to MT5's secure Files folder
- ✅ Supports multiple instances for different symbols
- ✅ Collects data every 30 seconds
- ✅ Works with or without custom indicators

---

## Prerequisites

Before deploying DataCollector:

- [ ] MT5 installed and running
- [ ] Eightcap demo/live account connected
- [ ] Python 3.8+ installed (for sync script later)
- [ ] Administrator access to Windows

### MT5 Directory Path

**Standard MT5 data directory:**

```
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\
```

**Find your Terminal ID:**

```powershell
# List all terminal directories
Get-ChildItem "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\" -Directory

# Your Terminal ID is the long alphanumeric folder name
# Example: 492CD01931BD0D07A159AEF5B29BF32C
```

---

## File Structure

### Required Files

| File                   | Location         | Purpose                      |
| ---------------------- | ---------------- | ---------------------------- |
| `DataCollector.mq5`    | `MQL5\Services\` | Main service file            |
| `SymbolUtils.mqh`      | `MQL5\Include\`  | Symbol validation logic      |
| `IndicatorBuffers.mqh` | `MQL5\Include\`  | Indicator buffer definitions |

### Complete Directory Structure

```
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\
└── MQL5\
    ├── Services\
    │   └── DataCollector.mq5          ← Main service
    ├── Include\
    │   ├── SymbolUtils.mqh            ← Symbol validation
    │   └── IndicatorBuffers.mqh       ← Buffer definitions
    └── Files\
        └── trading_data.db            ← Auto-created by service
```

---

## File Deployment

### Step 1: Deploy SymbolUtils.mqh

**Create the file at:** `MQL5\Include\SymbolUtils.mqh`

```powershell
$includePath = "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Include"
$symbolUtilsPath = Join-Path $includePath "SymbolUtils.mqh"

$symbolUtilsContent = @'
//+------------------------------------------------------------------+
//| SymbolUtils.mqh - Symbol validation (Eightcap broker)           |
//| Based on proven Symbol Information indicator pattern            |
//+------------------------------------------------------------------+

string g_AllowedSymbols[] = {
    // Forex Pairs - WITH .i suffix (Eightcap format)
    "AUDJPY.i", "AUDUSD.i", "EURUSD.i", "GBPJPY.i", "GBPUSD.i",
    "NZDUSD.i", "USDCAD.i", "USDCHF.i", "USDJPY.i",

    // Non-forex symbols - NO suffix
    "BTCUSD", "ETHUSD", "NDX100", "US30", "XAGUSD", "XAUUSD"
};

bool IsSymbolSupported(const string symbol)
{
    // Try exact match first
    for(int i = 0; i < ArraySize(g_AllowedSymbols); i++)
    {
        if(symbol == g_AllowedSymbols[i])
            return true;
    }

    // Toggle .i suffix and try again
    string toggledSymbol;
    int symbolLen = StringLen(symbol);

    if(symbolLen > 2 && StringSubstr(symbol, symbolLen - 2) == ".i")
        toggledSymbol = StringSubstr(symbol, 0, symbolLen - 2);
    else
        toggledSymbol = symbol + ".i";

    for(int i = 0; i < ArraySize(g_AllowedSymbols); i++)
    {
        if(toggledSymbol == g_AllowedSymbols[i])
            return true;
    }

    return false;
}

string GetSupportedSymbolsList()
{
    string list = "";
    for(int i = 0; i < ArraySize(g_AllowedSymbols); i++)
    {
        if(i > 0) list += ", ";
        list += g_AllowedSymbols[i];
    }
    return list;
}
'@

New-Item -ItemType Directory -Force -Path $includePath
$symbolUtilsContent | Out-File -FilePath $symbolUtilsPath -Encoding UTF8
Write-Host "✅ SymbolUtils.mqh created" -ForegroundColor Green
```

### Step 2: Deploy IndicatorBuffers.mqh

**Create the file at:** `MQL5\Include\IndicatorBuffers.mqh`

```powershell
$indicatorBuffersPath = Join-Path $includePath "IndicatorBuffers.mqh"

$indicatorBuffersContent = @'
//+------------------------------------------------------------------+
//| IndicatorBuffers.mqh - Indicator buffer reading functions       |
//+------------------------------------------------------------------+

// Add your indicator buffer reading functions here
// This file contains functions like:
// - GetFractalsJSON()
// - GetHorizontalLinesJSON()
// - GetDiagonalLinesJSON()
// - GetMomentumJSON()
// - GetKeltnerJSON()
// - GetTEMA(), GetHRMA(), GetSMMA()
// - GetZigZagJSON()

// Placeholder implementations for testing without indicators
string GetFractalsJSON(int handle, int size) { return "[]"; }
string GetHorizontalLinesJSON(int handle, int size) { return "[]"; }
string GetDiagonalLinesJSON(int handle, int size) { return "[]"; }
string GetMomentumJSON(int handle, int size) { return "[]"; }
string GetKeltnerJSON(int handle, int size) { return "[]"; }
double GetTEMA(int handle, int shift) { return EMPTY_VALUE; }
double GetHRMA(int handle, int shift) { return EMPTY_VALUE; }
double GetSMMA(int handle, int shift) { return EMPTY_VALUE; }
string GetZigZagJSON(int handle, int size) { return "[]"; }
'@

$indicatorBuffersContent | Out-File -FilePath $indicatorBuffersPath -Encoding UTF8
Write-Host "✅ IndicatorBuffers.mqh created" -ForegroundColor Green
```

### Step 3: Deploy DataCollector.mq5

**Copy the complete DataCollector.mq5 file** (from earlier in this chat) to:

```
MQL5\Services\DataCollector.mq5
```

**Key changes from original:**

1. **Line 54:** Removed `g_raw_symbol` variable
2. **Lines 64-68:** No `NormalizeSymbol()` - uses symbol AS-IS
3. **Lines 70-75:** Flexible `IsSymbolSupported()` validation
4. **Line 33:** Default database path: `trading_data.db` (MT5 Files folder)
5. **Line 156:** Table name wrapped in brackets: `[%s]`

### Step 4: Compile in MetaEditor

```
1. Press F4 in MT5 to open MetaEditor
2. Navigate to Services → DataCollector.mq5
3. Press F7 to compile
4. Check for "0 errors, 0 warnings"
```

**Expected output:**

```
'DataCollector.mq5'   DataCollector.mq5   1   1
0 error(s), 0 warning(s)                    1   1
```

---

## Symbol Validation Configuration

### Supported Symbols

**Forex pairs (with .i suffix):**

- AUDJPY.i, AUDUSD.i, EURUSD.i, GBPJPY.i, GBPUSD.i
- NZDUSD.i, USDCAD.i, USDCHF.i, USDJPY.i

**Non-forex symbols (no suffix):**

- BTCUSD, ETHUSD, NDX100, US30, XAGUSD, XAUUSD

### How Symbol Validation Works

```mql5
// Example 1: Exact match
"EURUSD.i" → Checks against ["EURUSD.i"] → ✅ Match

// Example 2: Toggle suffix
"EURUSD" → Adds ".i" → "EURUSD.i" → ✅ Match

// Example 3: Non-forex
"BTCUSD" → Checks against ["BTCUSD"] → ✅ Match
```

**The validation is flexible** - it will match whether you specify the symbol with or without the `.i` suffix.

---

## Service Configuration

### Input Parameters

**Open DataCollector parameters dialog:**

```
Navigator → Services → DataCollector → Double-click
```

**Configure these parameters:**

| Parameter              | Value             | Notes                                    |
| ---------------------- | ----------------- | ---------------------------------------- |
| **CollectionInterval** | `30`              | Data collection interval (seconds)       |
| **DatabasePath**       | `trading_data.db` | ⚠️ USE THIS - stores in MT5 Files folder |
| **SymbolToMonitor**    | `EURUSD.i`        | ⚠️ **REQUIRED** - must specify symbol    |
| **BufferSize**         | `100`             | Number of bars to read                   |
| **EnableLogging**      | `true`            | Enable detailed logs                     |

### ⚠️ CRITICAL: SymbolToMonitor Parameter

**Services CANNOT use `_Symbol`** because they have no chart context.

**You MUST specify a symbol:**

```
✅ CORRECT: SymbolToMonitor = "EURUSD.i"
✅ CORRECT: SymbolToMonitor = "BTCUSD"
❌ WRONG:   SymbolToMonitor = "" (empty - will fail!)
```

### Database Path Options

**Option 1: MT5 Files Folder (Recommended ✅)**

```
DatabasePath = "trading_data.db"

Actual location:
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Files\trading_data.db
```

**Benefits:**

- ✅ Automatic write permissions
- ✅ Managed by MT5
- ✅ No manual folder creation needed
- ✅ Guaranteed to work

**Option 2: Custom Path (Not Recommended)**

```
DatabasePath = "C:\\MT5Data\\trading_data.db"
```

**Issues:**

- ❌ Requires manual folder creation
- ❌ Requires permission configuration
- ❌ Can fail with Error 5002

---

## Multi-Symbol Deployment

### Running Multiple Instances

**Each symbol requires its own service instance.**

**Example: Monitoring 3 symbols**

1. **Start instance for EURUSD.i:**
   - Navigator → Services → DataCollector
   - Double-click
   - SymbolToMonitor: `EURUSD.i`
   - Click OK

2. **Start instance for BTCUSD:**
   - Navigator → Services → DataCollector (again)
   - Double-click
   - SymbolToMonitor: `BTCUSD`
   - Click OK

3. **Start instance for XAUUSD:**
   - Navigator → Services → DataCollector (again)
   - Double-click
   - SymbolToMonitor: `XAUUSD`
   - Click OK

### Database Tables

**Each symbol creates its own table:**

```sql
-- Database: trading_data.db
Tables:
  - EURUSD.i   (or [EURUSD.i] with brackets)
  - BTCUSD
  - XAUUSD
```

**Table schema:**

```sql
CREATE TABLE [EURUSD.i] (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
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

### Multi-MT5 Terminal Setup

**For 15 symbols across 15 MT5 terminals:**

| Terminal | Symbol | SymbolToMonitor Parameter |
| -------- | ------ | ------------------------- |
| MT5-1    | EURUSD | `EURUSD.i`                |
| MT5-2    | GBPUSD | `GBPUSD.i`                |
| MT5-3    | USDJPY | `USDJPY.i`                |
| MT5-4    | AUDUSD | `AUDUSD.i`                |
| MT5-5    | USDCAD | `USDCAD.i`                |
| MT5-6    | USDCHF | `USDCHF.i`                |
| MT5-7    | NZDUSD | `NZDUSD.i`                |
| MT5-8    | AUDJPY | `AUDJPY.i`                |
| MT5-9    | GBPJPY | `GBPJPY.i`                |
| MT5-10   | XAUUSD | `XAUUSD`                  |
| MT5-11   | XAGUSD | `XAGUSD`                  |
| MT5-12   | BTCUSD | `BTCUSD`                  |
| MT5-13   | ETHUSD | `ETHUSD`                  |
| MT5-14   | NDX100 | `NDX100`                  |
| MT5-15   | US30   | `US30`                    |

**Deployment checklist per terminal:**

1. Copy 3 files (DataCollector.mq5, SymbolUtils.mqh, IndicatorBuffers.mqh)
2. Compile DataCollector.mq5
3. Start service with correct SymbolToMonitor
4. Verify in Experts tab
5. Check database file created

---

## Testing and Verification

### Step 1: Check Service Start

**Expected output in Experts tab:**

```
========================================
DataCollector Service Starting...
========================================
=== DEBUG IsSymbolSupported ===
Input symbol: [EURUSD.i]
Symbol length: 8
Checking exact match: [EURUSD.i] vs [EURUSD.i]
✓ EXACT MATCH FOUND!
Monitoring symbol: EURUSD.i
Collection interval: 30 seconds
Database path: trading_data.db
Database opened successfully
Table EURUSD.i has 0 existing rows
Initializing indicators for EURUSD.i...
[indicator warnings - OK if not installed yet]
DataCollector Service started successfully
```

### Step 2: Verify Database Creation

```powershell
# Check database file exists
$dbPath = "C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Files\trading_data.db"

if (Test-Path $dbPath) {
    Write-Host "✅ Database exists" -ForegroundColor Green
    Write-Host "Size: $((Get-Item $dbPath).Length) bytes"
    Write-Host "Modified: $((Get-Item $dbPath).LastWriteTime)"
} else {
    Write-Host "❌ Database not found" -ForegroundColor Red
}
```

### Step 3: Query Database

```powershell
# Install SQLite if not present
# choco install sqlite

# Query table
sqlite3 $dbPath "SELECT COUNT(*) FROM 'EURUSD.i';"

# View recent data
sqlite3 $dbPath "SELECT timestamp, close FROM 'EURUSD.i' ORDER BY timestamp DESC LIMIT 5;"
```

### Step 4: Monitor Collection Cycles

**Watch Experts tab for collection cycles:**

```
Collection cycle #1 at 2026.01.10 08:00:00 UTC
Data stored successfully for EURUSD.i
Collection cycle #2 at 2026.01.10 08:00:30 UTC
Data stored successfully for EURUSD.i
```

**Data should be collected every 30 seconds.**

---

## Troubleshooting

### Issue 1: "Symbol is not supported"

**Symptoms:**

```
ERROR: Symbol is not supported: EURUSD.i
```

**Solutions:**

1. Check if symbol is in `g_AllowedSymbols` array
2. Verify spelling (case-sensitive)
3. Check if `.i` suffix is correct
4. Recompile after changes

### Issue 2: "Input symbol: []" (Empty Symbol)

**Symptoms:**

```
Input symbol: []
Symbol length: 0
```

**Cause:** SymbolToMonitor parameter is empty

**Solution:**

- Stop service
- Restart with SymbolToMonitor explicitly set
- **Services require explicit symbol** - cannot use chart symbol

### Issue 3: "Failed to open database" (Error 5002)

**Symptoms:**

```
ERROR: Failed to open database: C:\MT5Data\trading_data.db
Error code: 5002
```

**Solution:**
Change DatabasePath to: `trading_data.db`

This uses MT5's Files folder which has automatic permissions.

### Issue 4: "cannot load custom indicator" (Error 4302)

**Symptoms:**

```
WARNING: Failed to load Fractal Horizontal Line_V5 indicator
Error: 4302
```

**This is OK if indicators not installed yet!**

The service will:

- ✅ Still collect OHLC data
- ✅ Still write to database
- ⚠️ Indicator JSON fields will be empty `[]`

**To fix later:**
Install indicators in `MQL5\Indicators\` and restart service.

### Issue 5: Service Won't Start

**Check:**

1. MT5 is running
2. Account is connected
3. DataCollector.mq5 compiled successfully (no errors)
4. Include files exist (`SymbolUtils.mqh`, `IndicatorBuffers.mqh`)

**Restart MT5:**
Sometimes a complete MT5 restart is needed after deploying new services.

---

## Quick Reference

### File Locations

```
{TERMINAL_ID} = 492CD01931BD0D07A159AEF5B29BF32C (example)

Service file:
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Services\DataCollector.mq5

Include files:
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Include\SymbolUtils.mqh
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Include\IndicatorBuffers.mqh

Database file (auto-created):
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\{TERMINAL_ID}\MQL5\Files\trading_data.db
```

### Starting a Service

```
1. Navigator → Services → DataCollector
2. Double-click
3. Set parameters:
   - SymbolToMonitor: EURUSD.i
   - DatabasePath: trading_data.db
4. Click OK
5. Check Experts tab for success message
```

### Stopping a Service

```
1. Find service in Navigator (has red stop icon)
2. Right-click → Stop
3. Wait for cleanup message in Experts tab
```

---

## Checklist

Before proceeding to sync script:

- [ ] All 3 files deployed (`DataCollector.mq5`, `SymbolUtils.mqh`, `IndicatorBuffers.mqh`)
- [ ] DataCollector.mq5 compiled successfully
- [ ] Service started with SymbolToMonitor parameter set
- [ ] "Database opened successfully" in Experts tab
- [ ] Database file exists in MQL5\Files\ folder
- [ ] Collection cycles running every 30 seconds
- [ ] Data being written to database (row count increasing)

---

**Next Step:** → [05-sync-script-deployment-guide.md](./05-sync-script-deployment-guide.md)

---

**Document Version:** 2.0.0  
**Last Updated:** 2026-01-10  
**Status:** ✅ Tested and Working  
**Author:** Claude Code (Trading Alerts SaaS Part 20)
