# validate_sqlite.py - Implementation Guide

## Overview

`validate_sqlite.py` is a comprehensive validation tool that checks your trading database for:

- ✅ Correct table structure
- ✅ Data completeness (all timeframes present)
- ✅ Data freshness (is collection still running?)
- ✅ OHLCV data quality (valid ranges, no corruption)
- ✅ Indicator values (no NULLs, valid ranges)
- ✅ Color-coded, easy-to-read output

---

## Installation

### Step 1: Download the Script

Save `validate_sqlite.py` to: `C:\Scripts\validate_sqlite.py`

### Step 2: Verify Python is Available

```cmd
python --version
```

Should show: `Python 3.x.x`

### Step 3: Test the Script

```cmd
cd C:\Scripts
python validate_sqlite.py --quick
```

---

## Usage Modes

### 1. Quick Mode (Default) - Show Only Problems

**Use when:** You just want to know if everything is OK

```cmd
python validate_sqlite.py --quick
```

**Output Example:**

```
================================================================================
QUICK VALIDATION: C:\Scripts\database\trading_data.db
================================================================================
✓ btcusd: Data is current (1.2 minutes old)
```

**What it checks:**

- ✅ Is data being collected? (freshness check)
- ✅ Are there NULL values in indicators?
- ✅ Shows only problems (silent if everything OK)

---

### 2. Full Mode - Detailed Report

**Use when:** You want comprehensive analysis

```cmd
python validate_sqlite.py --full
```

**Output Example:**

```
================================================================================
DETECTING DATABASE SCHEMA
================================================================================
ℹ Found 1 table(s): btcusd
ℹ
  Table: btcusd
    Base columns: 8
    Indicator columns: 2
    Indicators: fractal_h_support, fractal_h_resistance

================================================================================
TABLE: BTCUSD
================================================================================

1. Structure Validation:
✓ Table btcusd: All required columns present

2. Data Completeness:

  Timeframe  Records    Status          Last Collection
  ---------- ---------- --------------- --------------------
  M5         283        ✓ Current       2026-01-12 16:21:31
  M15        261        ✓ Current       2026-01-12 16:21:31
  M30        255        ✓ Current       2026-01-12 16:21:31
  H1         253        ✓ Current       2026-01-12 16:21:31
  H2         252        ✓ Current       2026-01-12 16:21:31
  H4         251        ✓ Current       2026-01-12 16:21:31
  H8         251        ✓ Current       2026-01-12 16:21:31
  H12        250        ✓ Current       2026-01-12 16:21:31
  D1         240        ✓ Current       2026-01-12 16:21:31

3. OHLCV Data Quality:
✓ OHLCV ranges valid (Price range: 85234.50 - 94567.89)

4. Indicator Values:

  Indicator                      NULL Count   Valid %    Status
  ------------------------------ ------------ ---------- ---------------
  fractal_h_support              0            100.0%     ✓ Pass
  fractal_h_resistance           0            100.0%     ✓ Pass

ℹ Total records: 2,296

================================================================================
VALIDATION SUMMARY
================================================================================

Total checks: 15
✓ Passed: 15
⚠ Warnings: 0
✗ Failed: 0

✓ DATABASE VALIDATION PASSED - NO ISSUES FOUND
```

**What it checks:**

- ✅ Table structure (all required columns present)
- ✅ Data completeness (all timeframes, record counts)
- ✅ Data freshness (when was last collection)
- ✅ OHLCV validation (price ranges, High≥Low, etc.)
- ✅ Indicator validation (NULL counts, valid percentages)
- ✅ Comprehensive summary

---

### 3. Symbol-Specific Validation

**Use when:** You want to check a specific symbol only

```cmd
python validate_sqlite.py --full --symbol BTCUSD
```

**Or quick mode:**

```cmd
python validate_sqlite.py --quick --symbol BTCUSD
```

---

### 4. Indicator-Specific Validation

**Use when:** You just added an indicator and want to verify it

```cmd
python validate_sqlite.py --full --indicator fractal
```

**This will check ONLY indicator columns containing "fractal":**

- fractal_h_support
- fractal_h_resistance
- fractal_d_support
- fractal_d_resistance

**Example for Keltner:**

```cmd
python validate_sqlite.py --full --indicator keltner
```

---

### 5. Custom Database Path

**Use when:** Database is not in default location

```cmd
python validate_sqlite.py --db "C:\Other\Path\mydata.db" --quick
```

---

## Common Usage Scenarios

### Scenario 1: Daily Health Check

**Morning routine:**

```cmd
cd C:\Scripts
python validate_sqlite.py --quick
```

If all green ✓, you're good!

---

### Scenario 2: After Adding New Indicator

**Just added Fractal Horizontal Line V5:**

```cmd
python validate_sqlite.py --full --indicator fractal
```

**What to look for:**

- ✅ Indicator columns exist
- ✅ NULL Count = 0
- ✅ Valid % = 100.0%
- ✅ Status = ✓ Pass

---

### Scenario 3: Troubleshooting Collection Issues

**Data collection seems stopped:**

```cmd
python validate_sqlite.py --full
```

**Look for:**

- ⚠ Stale (data 5-60 minutes old)
- ✗ Old (data >60 minutes old)

**If you see these:**

1. Check if SimpleDataCollector EA is running
2. Check MT5 Experts tab for errors
3. Check if AutoTrading is enabled

---

### Scenario 4: After Expanding to Multiple Symbols

**Just added EURUSD and XAUUSD:**

```cmd
python validate_sqlite.py --full
```

**Should see:**

```
ℹ Found 3 table(s): btcusd, eurusd, xauusd
```

**Then check each individually:**

```cmd
python validate_sqlite.py --quick --symbol EURUSD
python validate_sqlite.py --quick --symbol XAUUSD
```

---

## Understanding the Output

### Status Indicators

**Data Freshness:**

- ✓ **Current** (green) - Data < 5 minutes old ✅ GOOD
- ⚠ **Stale** (yellow) - Data 5-60 minutes old ⚠️ CHECK EA
- ✗ **Old** (red) - Data > 60 minutes old ❌ PROBLEM

**Indicator Validation:**

- ✓ **Pass** (green) - 0 NULL values, <10% zeros ✅ GOOD
- ⚠ **Warning** (yellow) - <5% NULL values ⚠️ ACCEPTABLE
- ✗ **Fail** (red) - >5% NULL values ❌ INDICATOR NOT WORKING

---

### What NULL Values Mean

**NULL in indicator column means:**

- ❌ Indicator failed to load (Error 4302)
- ❌ Indicator calculation failed
- ❌ Indicator not attached properly

**How to fix:**

1. Check MT5 Experts tab for indicator errors
2. Verify indicator files exist in MT5\Indicators\
3. Check indicator parameters in SimpleDataCollector.mq5
4. Test indicator manually on chart first

---

### What Zero Values Mean

**Many zeros (>10%) might mean:**

- ⚠️ Indicator legitimately returns 0 (e.g., no fractal found)
- ⚠️ Indicator hasn't calculated yet (needs more bars)
- ❌ Indicator calculation error

**Normal for some indicators:**

- Fractals: May be 0 when no fractal detected ✅ OK
- ZigZag: May be 0 between reversal points ✅ OK

**NOT normal:**

- OHLCV values = 0 ❌ PROBLEM
- Moving averages = 0 (after sufficient bars) ❌ PROBLEM

---

## Validation Workflow

### When Adding Each Indicator (Phase 1)

**Before adding indicator:**

```cmd
python validate_sqlite.py --full
```

→ Baseline: Should show only OHLCV columns

**After adding indicator code:**

1. Recompile SimpleDataCollector.mq5
2. Restart MT5
3. Wait 2-3 minutes for data collection

**Then validate:**

```cmd
python validate_sqlite.py --full --indicator [indicator_name]
```

**Expected result:**

```
Indicator                      NULL Count   Valid %    Status
------------------------------ ------------ ---------- ---------------
fractal_h_support              0            100.0%     ✓ Pass
fractal_h_resistance           0            100.0%     ✓ Pass
```

**If you see NULLs:**

1. Check MT5 Experts tab for errors
2. Review indicator loading code
3. Verify indicator parameters
4. Test indicator on chart manually

**Repeat for each of the 6 indicators!**

---

### When Expanding to Multiple Symbols (Phase 2)

**After adding each symbol:**

```cmd
python validate_sqlite.py --quick
```

**Should show:**

```
✓ btcusd: Data is current (1.2 minutes old)
✓ eurusd: Data is current (1.3 minutes old)
✓ xauusd: Data is current (1.4 minutes old)
...
```

**Full check all symbols:**

```cmd
python validate_sqlite.py --full
```

---

## Automation

### Create Quick Check Batch File

**Create:** `C:\Scripts\check_db.bat`

```batch
@echo off
cd C:\Scripts
python validate_sqlite.py --quick
pause
```

**Double-click anytime** to check database health!

---

### Schedule Regular Checks

**Windows Task Scheduler:**

1. Open Task Scheduler
2. Create Basic Task
3. Name: "Validate Trading Database"
4. Trigger: Daily at 9:00 AM
5. Action: Start a program
   - Program: `python`
   - Arguments: `C:\Scripts\validate_sqlite.py --quick`
   - Start in: `C:\Scripts`

**Email alerts** (requires additional setup):

- Capture output to file
- Use Python smtplib to email results
- Only send email if issues found

---

## Troubleshooting

### Script Won't Run

**Error:** `python: command not found`
**Fix:** Install Python or add to PATH

**Error:** `ModuleNotFoundError: No module named 'sqlite3'`
**Fix:** sqlite3 is built-in, check Python installation

**Error:** `PermissionError: [Errno 13]`
**Fix:** Close any programs accessing the database

---

### No Tables Found

**Output:** `No tables found in database!`

**Causes:**

1. Database file is empty (0 KB)
2. Wrong database path
3. Database corrupted

**Fix:**

1. Check file size: Should be >100 KB
2. Verify path: `C:\Scripts\database\trading_data.db`
3. Check SimpleDataCollector is running in MT5

---

### Data is Stale/Old

**Output:** `⚠ btcusd: Data is stale (45 minutes old)`

**Causes:**

1. SimpleDataCollector EA not running
2. AutoTrading disabled in MT5
3. MT5 disconnected from broker
4. EA crashed/stopped

**Fix:**

1. Check MT5 Experts tab for errors
2. Enable AutoTrading button (should be green)
3. Check MT5 connection status
4. Restart EA on chart

---

### Indicator Shows NULL Values

**Output:** `✗ fractal_h_support: 250 NULL values (100.0%)`

**Causes:**

1. Indicator not loading (Error 4302)
2. Wrong indicator parameters
3. Wrong buffer index
4. Indicator file missing/corrupted

**Fix:**

1. Check MT5 Experts tab for "Error 4302"
2. Test indicator on chart manually
3. Verify indicator parameters in code
4. Recompile indicator from source

---

## Best Practices

### Daily Workflow

**Morning (09:00):**

```cmd
python validate_sqlite.py --quick
```

→ Verify data collection is running

**Evening (17:00):**

```cmd
python validate_sqlite.py --quick
```

→ Confirm full day of data collected

---

### Development Workflow (Adding Indicators)

**Before code change:**

```cmd
python validate_sqlite.py --full > before.txt
```

**After code change:**

```cmd
python validate_sqlite.py --full > after.txt
```

**Compare:**

- New indicator columns should appear
- All should show 0 NULLs
- No regressions in existing indicators

---

### Production Monitoring

**Run every hour via Task Scheduler:**

```cmd
python validate_sqlite.py --quick >> C:\Scripts\logs\validation.log
```

**Review log periodically** for patterns

---

## Summary

**Key Commands:**

```cmd
# Quick daily check
python validate_sqlite.py --quick

# Full analysis
python validate_sqlite.py --full

# Check specific indicator after adding
python validate_sqlite.py --full --indicator fractal

# Check specific symbol
python validate_sqlite.py --full --symbol BTCUSD

# Custom database location
python validate_sqlite.py --db "C:\path\to\db.db" --quick
```

**Success Criteria:**

- ✅ All symbols show "✓ Current"
- ✅ All indicators show "✓ Pass"
- ✅ 0 NULL values
- ✅ Valid % = 100.0%
- ✅ No ✗ Fail or ⚠ Warning messages

**Use this tool at EVERY step of development!** It's your safety net. 🛡️

---

## Quick Reference Card

```
VALIDATION QUICK REFERENCE
==========================

Daily Check:
  python validate_sqlite.py --quick

After Adding Indicator:
  python validate_sqlite.py --full --indicator [name]

Troubleshooting:
  python validate_sqlite.py --full

Status Colors:
  ✓ Green  = Good
  ⚠ Yellow = Warning (check it)
  ✗ Red    = Failed (fix it!)

Exit Codes:
  0 = All passed
  1 = Issues found (check summary)
```

---

Good luck with your development! This tool will save you hours of debugging. 🚀
