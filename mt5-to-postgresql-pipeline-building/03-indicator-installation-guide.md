# Indicator Installation Guide

**Part 20 - MT5 to PostgreSQL Data Flow**
**Last Updated:** 2026-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Required Indicators](#required-indicators)
3. [Finding MT5 Data Folders](#finding-mt5-data-folders)
4. [Installation Steps](#installation-steps)
5. [Indicator Configuration](#indicator-configuration)
6. [Attaching to Charts](#attaching-to-charts)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers installing 6 custom indicators (.ex5 files) into all 15 MT5 instances. These indicators provide data for DataCollector.mq5.

**Data Flow:**

```
MT5 Terminal
    ↓
Custom Indicators (calculate values)
    ↓
DataCollector.mq5 (reads indicator buffers)
    ↓
SQLite Database (stores data)
```

---

## Required Indicators

You need these 6 compiled indicator files (.ex5):

| #   | Indicator File                                                | Purpose                   | Buffer Data                |
| --- | ------------------------------------------------------------- | ------------------------- | -------------------------- |
| 1   | `Fractal Horizontal Line_V5.ex5`                              | Support/resistance levels | Horizontal trendlines JSON |
| 2   | `Fractal Diagonal Line_V4.ex5`                                | Trend lines               | Diagonal trendlines JSON   |
| 3   | `Body Size Momentum Candle_V2.ex5`                            | Momentum analysis         | Momentum candles JSON      |
| 4   | `Keltner Channel_ATF_10 Bands.ex5`                            | Volatility bands          | Keltner channels JSON      |
| 5   | `TEMA_HRMA_SMA-SMMA_Modified Buffers.ex5`                     | Moving averages           | TEMA, HRMA, SMMA values    |
| 6   | `ZigZagColor & MarketStructure_JSON Export_V27_TXT Input.ex5` | Market structure          | Fractals, ZigZag JSON      |

### Indicator Requirements

- **Format:** Compiled .ex5 files (not source .mq5)
- **Platform:** MT5 64-bit compatible
- **Location:** Must be in each MT5 instance's Indicators folder

---

## Finding MT5 Data Folders

### For Portable Mode Installation

If you followed the MT5 Installation Guide (portable mode):

```
C:\MT5Terminals\MT5_EURUSD\MQL5\Indicators\
C:\MT5Terminals\MT5_BTCUSD\MQL5\Indicators\
... (for each instance)
```

### For Standard Installation

MT5 stores user data in AppData:

```powershell
# Find MT5 data folders
$mt5Folders = Get-ChildItem -Path "$env:APPDATA\MetaQuotes\Terminal" -Directory

foreach ($folder in $mt5Folders) {
    Write-Host "Found: $($folder.FullName)"
    Write-Host "  Indicators: $($folder.FullName)\MQL5\Indicators"
}
```

**Typical path:**

```
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\[HASH]\MQL5\Indicators\
```

### Finding Terminal Hash

Each MT5 installation has a unique hash folder:

1. Open MT5 terminal
2. **File** → **Open Data Folder**
3. Note the path - the hash is the folder name

**Example:**

```
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5\Indicators\
```

---

## Installation Steps

### Step 1: Prepare Indicator Files

1. Gather all 6 .ex5 indicator files
2. Create a staging folder:
   ```powershell
   New-Item -ItemType Directory -Force -Path "C:\MT5Indicators"
   ```
3. Copy all .ex5 files to `C:\MT5Indicators\`

### Step 2: Verify Files

```powershell
# List indicator files
Get-ChildItem "C:\MT5Indicators\*.ex5" | Format-Table Name, Length, LastWriteTime
```

**Expected output:**

```
Name                                                              Length LastWriteTime
----                                                              ------ -------------
Fractal Horizontal Line_V5.ex5                                    XXXXX  MM/DD/YYYY
Fractal Diagonal Line_V4.ex5                                      XXXXX  MM/DD/YYYY
Body Size Momentum Candle_V2.ex5                                  XXXXX  MM/DD/YYYY
Keltner Channel_ATF_10 Bands.ex5                                  XXXXX  MM/DD/YYYY
TEMA_HRMA_SMA-SMMA_Modified Buffers.ex5                          XXXXX  MM/DD/YYYY
ZigZagColor & MarketStructure_JSON Export_V27_TXT Input.ex5      XXXXX  MM/DD/YYYY
```

### Step 3: Copy to All MT5 Instances (Portable Mode)

```powershell
# Copy indicators to all 15 MT5 instances
$sourceDir = "C:\MT5Indicators"
$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

foreach ($symbol in $symbols) {
    $destDir = "C:\MT5Terminals\MT5_$symbol\MQL5\Indicators"

    # Create Indicators folder if doesn't exist
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null

    # Copy all indicator files
    Copy-Item -Path "$sourceDir\*.ex5" -Destination $destDir -Force

    $count = (Get-ChildItem "$destDir\*.ex5").Count
    Write-Host "Copied $count indicators to MT5_$symbol" -ForegroundColor Green
}

Write-Host "`nIndicator installation complete!" -ForegroundColor Cyan
```

### Step 4: Copy to All MT5 Instances (Standard Mode)

```powershell
# For standard installations with hash folders
$sourceDir = "C:\MT5Indicators"
$terminalDir = "$env:APPDATA\MetaQuotes\Terminal"

# Get all terminal folders
$terminals = Get-ChildItem -Path $terminalDir -Directory

foreach ($terminal in $terminals) {
    $indicatorDir = Join-Path $terminal.FullName "MQL5\Indicators"

    if (Test-Path (Join-Path $terminal.FullName "terminal64.exe")) {
        # Create Indicators folder if doesn't exist
        New-Item -ItemType Directory -Force -Path $indicatorDir | Out-Null

        # Copy all indicator files
        Copy-Item -Path "$sourceDir\*.ex5" -Destination $indicatorDir -Force

        Write-Host "Copied indicators to: $indicatorDir" -ForegroundColor Green
    }
}
```

### Step 5: Refresh Indicators in MT5

For each MT5 instance:

1. Open MT5 terminal
2. In **Navigator** panel (Ctrl+N), expand **Indicators**
3. Right-click on **Indicators** → **Refresh**
4. Verify all 6 custom indicators appear

---

## Indicator Configuration

Each indicator may have input parameters. Configure them for optimal data collection.

### Indicator 1: Fractal Horizontal Line_V5

**Purpose:** Identifies support/resistance levels from fractal points

**Typical Parameters:**

```
FractalPeriod: 5 (default)
ShowLabels: false
LinesColor: clrNone
```

### Indicator 2: Fractal Diagonal Line_V4

**Purpose:** Draws trend lines connecting fractal points

**Typical Parameters:**

```
FractalPeriod: 5 (default)
TrendLineColor: clrNone
ShowLabels: false
```

### Indicator 3: Body Size Momentum Candle_V2

**Purpose:** Identifies momentum candles based on body size

**Typical Parameters:**

```
MomentumThreshold: 1.5
BodyRatio: 0.6
HighlightCandles: false
```

### Indicator 4: Keltner Channel_ATF_10 Bands

**Purpose:** Multi-band Keltner Channel for volatility

**Typical Parameters:**

```
EMA_Period: 20
ATR_Period: 10
ATR_Multiplier: 1.5
BandCount: 10
```

### Indicator 5: TEMA_HRMA_SMA-SMMA_Modified Buffers

**Purpose:** Multiple moving average calculations

**Typical Parameters:**

```
TEMA_Period: 20
HRMA_Period: 20
SMA_Period: 50
SMMA_Period: 50
```

### Indicator 6: ZigZagColor & MarketStructure

**Purpose:** ZigZag pattern and market structure analysis

**Typical Parameters:**

```
Depth: 12
Deviation: 5
Backstep: 3
ExportJSON: true
JSONPath: "C:\\MT5Data\\"
```

---

## Attaching to Charts

### Method 1: Manual Attachment (Testing)

For testing one instance:

1. Open MT5 terminal
2. Open chart for the symbol
3. In Navigator (Ctrl+N), expand **Indicators**
4. Find the custom indicator
5. Drag and drop onto chart
6. Configure parameters in popup dialog
7. Click **OK**

Repeat for all 6 indicators on the chart.

### Method 2: Template (Recommended)

Create a chart template with all indicators attached:

1. Attach all 6 indicators to a chart manually
2. Configure each indicator's parameters
3. **Right-click chart** → **Templates** → **Save Template**
4. Name it `DataCollector_Template`
5. Save

**Apply template to other instances:**

1. Open chart
2. **Right-click** → **Templates** → **Load Template**
3. Select `DataCollector_Template`

### Method 3: Profile (For Multiple Charts)

If using multiple charts per terminal:

1. Configure all charts with indicators
2. **File** → **Profiles** → **Save As**
3. Name: `DataCollector_Profile`

---

## Verification

### Step 1: Verify Installation in Navigator

For each MT5 instance:

```
Navigator Panel (Ctrl+N)
└── Indicators
    └── [Your indicators should appear here]
        ├── Fractal Horizontal Line_V5
        ├── Fractal Diagonal Line_V4
        ├── Body Size Momentum Candle_V2
        ├── Keltner Channel_ATF_10 Bands
        ├── TEMA_HRMA_SMA-SMMA_Modified Buffers
        └── ZigZagColor & MarketStructure_JSON Export_V27_TXT Input
```

### Step 2: Test Indicator Loading

1. Drag indicator onto chart
2. If successful: Indicator appears on chart
3. If error: Check Experts tab (Ctrl+T) for error messages

### Step 3: Verify Indicator Buffers

Each indicator must expose its data via buffers. Test with a simple script:

```mql5
// File: TestIndicatorBuffers.mq5
// Place in Scripts folder and run

void OnStart()
{
    string symbol = Symbol();
    ENUM_TIMEFRAMES tf = PERIOD_H1;

    // Test TEMA indicator handle
    int temaHandle = iCustom(symbol, tf, "TEMA_HRMA_SMA-SMMA_Modified Buffers");

    if (temaHandle == INVALID_HANDLE) {
        Print("ERROR: Could not load TEMA indicator");
    } else {
        double temaValue[];
        ArraySetAsSeries(temaValue, true);

        if (CopyBuffer(temaHandle, 0, 0, 1, temaValue) > 0) {
            Print("TEMA Value: ", temaValue[0]);
        } else {
            Print("ERROR: Could not read TEMA buffer");
        }

        IndicatorRelease(temaHandle);
    }
}
```

### Step 4: Verification Script

```powershell
# File: C:\Scripts\verify_indicators.ps1

$symbols = @("AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
             "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
             "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD")

$indicators = @(
    "Fractal Horizontal Line_V5.ex5",
    "Fractal Diagonal Line_V4.ex5",
    "Body Size Momentum Candle_V2.ex5",
    "Keltner Channel_ATF_10 Bands.ex5",
    "TEMA_HRMA_SMA-SMMA_Modified Buffers.ex5",
    "ZigZagColor & MarketStructure_JSON Export_V27_TXT Input.ex5"
)

Write-Host "Indicator Installation Verification" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$allPassed = $true

foreach ($symbol in $symbols) {
    $indicatorDir = "C:\MT5Terminals\MT5_$symbol\MQL5\Indicators"
    $missingCount = 0

    foreach ($indicator in $indicators) {
        $indicatorPath = Join-Path $indicatorDir $indicator
        if (-not (Test-Path $indicatorPath)) {
            $missingCount++
        }
    }

    if ($missingCount -eq 0) {
        Write-Host "[PASS] MT5_$symbol - All 6 indicators present" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] MT5_$symbol - Missing $missingCount indicators" -ForegroundColor Red
        $allPassed = $false
    }
}

if ($allPassed) {
    Write-Host "`nAll indicators installed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nSome installations missing indicators!" -ForegroundColor Red
}
```

---

## Troubleshooting

### Issue 1: Indicator Not Showing in Navigator

**Symptoms:** Indicator file copied but doesn't appear in Navigator

**Solutions:**

1. **Refresh Navigator:**
   - Right-click "Indicators" → "Refresh"
2. **Check file location:**
   - Must be in `MQL5\Indicators\` (not subdirectory)
3. **Check file extension:**
   - Must be `.ex5` (compiled), not `.mq5` (source)
4. **Restart MT5:**
   - Close and reopen the terminal

### Issue 2: "Cannot Load Indicator" Error

**Symptoms:** Error when attaching indicator to chart

**Solutions:**

1. **Check MT5 version:**
   - Indicator must be compiled for MT5 (not MT4)
2. **Check 32/64-bit:**
   - Use 64-bit indicators with 64-bit MT5
3. **Check DLL imports:**
   - Tools → Options → Expert Advisors → Allow DLL imports
4. **Check Experts tab:**
   - Ctrl+T → Experts tab for detailed error
5. **Recompile if source available:**
   - Open .mq5 in MetaEditor → Compile

### Issue 3: Indicator Calculates Wrong Values

**Symptoms:** Indicator shows but values seem incorrect

**Solutions:**

1. **Load historical data:**
   - Indicator needs history to calculate
   - Tools → History Center → Download
2. **Check parameters:**
   - Wrong period or settings
3. **Check symbol:**
   - Some indicators are symbol-specific
4. **Check timeframe:**
   - Some indicators are timeframe-specific

### Issue 4: Indicator Causes MT5 Crash

**Symptoms:** MT5 crashes when attaching indicator

**Solutions:**

1. **Update MT5:**
   - Help → Check Desktop Updates
2. **Remove and reinstall indicator:**
   - Delete .ex5 file
   - Close MT5
   - Copy fresh .ex5 file
   - Restart MT5
3. **Check system resources:**
   - Indicator may use too much memory
4. **Test on clean installation:**
   - Try indicator on fresh MT5 install

### Issue 5: DLL Import Errors

**Symptoms:** Error about missing DLL or access denied

**Solutions:**

1. **Enable DLL imports:**
   ```
   Tools → Options → Expert Advisors → Allow DLL imports
   ```
2. **Check required DLLs:**
   - Some indicators need additional DLL files
   - Place DLLs in `MQL5\Libraries\`
3. **Run MT5 as Administrator:**
   - Right-click → Run as Administrator (first time)
4. **Windows Defender exception:**
   - Add MT5 folder to exclusions

---

## Indicator Buffer Reference

For DataCollector.mq5 to read indicator data, know the buffer indices:

### TEMA_HRMA_SMA-SMMA_Modified Buffers

| Buffer Index | Data       |
| ------------ | ---------- |
| 0            | TEMA value |
| 1            | HRMA value |
| 2            | SMA value  |
| 3            | SMMA value |

### Keltner Channel_ATF_10 Bands

| Buffer Index | Data              |
| ------------ | ----------------- |
| 0            | Middle line (EMA) |
| 1-10         | Upper bands       |
| 11-20        | Lower bands       |

### Other Indicators

Refer to indicator documentation or source code for buffer indices.

---

## Quick Reference

### Indicator Folder Paths

**Portable Mode:**

```
C:\MT5Terminals\MT5_[SYMBOL]\MQL5\Indicators\
```

**Standard Mode:**

```
C:\Users\Administrator\AppData\Roaming\MetaQuotes\Terminal\[HASH]\MQL5\Indicators\
```

### Copy Command (All Instances)

```powershell
# Quick copy to all instances (portable mode)
$symbols = @("AUDJPY","AUDUSD","BTCUSD","ETHUSD","EURUSD","GBPJPY","GBPUSD","NDX100","NZDUSD","US30","USDCAD","USDCHF","USDJPY","XAGUSD","XAUUSD")
foreach ($s in $symbols) { Copy-Item "C:\MT5Indicators\*.ex5" "C:\MT5Terminals\MT5_$s\MQL5\Indicators\" -Force }
```

---

## Next Steps

After installing indicators:

1. ➡️ **[DataCollector Deployment Guide](./04-datacollector-deployment-guide.md)** - Deploy MQL5 service

---

## Checklist

Before proceeding to DataCollector deployment:

- [ ] All 6 indicator .ex5 files obtained
- [ ] Indicators copied to all 15 MT5 instances
- [ ] Indicators appear in Navigator for each instance
- [ ] Indicators can be attached to charts without errors
- [ ] Indicator buffers accessible (tested with script)
- [ ] Chart template created with all indicators (optional)
- [ ] Verification script passes for all instances

---

**Document Version:** 1.0.0
**Created:** 2026-01-08
**Author:** Claude Code (Trading Alerts SaaS Part 20)
