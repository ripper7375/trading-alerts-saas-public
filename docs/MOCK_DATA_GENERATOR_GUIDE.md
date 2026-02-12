# Mock Market Data Generator - Complete Guide

**Version:** 3.0
**Schema:** EA v2.27+ (61 columns)
**Last Updated:** 2026-02-12

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Script Versions](#script-versions)
4. [Configuration Guide](#configuration-guide)
5. [Common Use Cases](#common-use-cases)
6. [Output Format](#output-format)
7. [Data Import Instructions](#data-import-instructions)
8. [Troubleshooting](#troubleshooting)

---

## 📖 Overview

These scripts generate **realistic mock market data** for testing your Trading Alerts SaaS platform without requiring live market data connections.

### What's Generated

- **61 columns** matching EA v2.27+ schema (v3.0)
- **9 System columns**: timestamp, symbol, OHLCV, timeframe, collected_at
- **16 FREE indicators**: TEMA, HRMA, SMMA, diagonal/horizontal lines, Heiken Ashi
- **36 PRO indicators**: Keltner Channels (10), Support/Resistance (8), ZigZag (2), EMA, Dual TEMA (2), Pinbar
- **Pipe-delimited format** (|) for Excel/CSV compatibility

### Key Features

✅ Realistic OHLCV price movements
✅ Proper indicator calculations
✅ Multiple symbols supported
✅ Multiple timeframes (M1, M5, M15, M30, H1, H4, D1)
✅ Customizable date ranges
✅ Excel-compatible output format

---

## 🚀 Quick Start

### Option 1: Original Script (XAUUSD only)

```bash
cd /home/user/trading-alerts-saas-public
python3 scripts/generate_mock_market_data.py
```

**Output:**
- `XAUUSD_M5_mock_data.txt` (5-minute Gold data)
- `XAUUSD_M15_mock_data.txt` (15-minute Gold data)

### Option 2: Multi-Symbol/Timeframe Script

```bash
cd /home/user/trading-alerts-saas-public
python3 scripts/generate_mock_market_data_multi.py
```

**Output (default):**
- `XAUUSD_M5_mock_data.txt`, `XAUUSD_M15_mock_data.txt`
- `EURUSD_M5_mock_data.txt`, `EURUSD_M15_mock_data.txt`
- `GBPUSD_M5_mock_data.txt`, `GBPUSD_M15_mock_data.txt`
- `USDJPY_M5_mock_data.txt`, `USDJPY_M15_mock_data.txt`

---

## 📋 Script Versions

### Version 1: Original (generate_mock_market_data.py)

**Best for:**
- Quick testing with Gold (XAUUSD) only
- Simple use cases
- Small datasets (2 days, 2 timeframes)

**Fixed configuration:**
- Symbol: XAUUSD
- Timeframes: M5, M15
- Date range: Feb 9-10, 2026

### Version 2: Multi-Symbol/Timeframe (generate_mock_market_data_multi.py)

**Best for:**
- Testing multiple currency pairs
- Different timeframes (M1-D1)
- Flexible date ranges
- Production-ready datasets

**Configurable:**
- ✅ Multiple symbols (Forex, Gold, Bitcoin)
- ✅ Any timeframe (M1, M5, M15, M30, H1, H4, D1)
- ✅ Custom date ranges
- ✅ Easy to extend

---

## ⚙️ Configuration Guide

### 1️⃣ Changing Symbols

**Edit:** `generate_mock_market_data_multi.py` line 355

```python
symbols = [
    ("XAUUSD", 2650.00, "Gold"),           # Gold vs USD
    ("EURUSD", 1.0850, "EUR/USD"),         # Euro vs USD
    ("GBPUSD", 1.2750, "GBP/USD"),         # British Pound vs USD
    ("USDJPY", 148.50, "USD/JPY"),         # USD vs Japanese Yen
    ("BTCUSD", 45000.00, "Bitcoin"),       # Bitcoin
    ("AUDUSD", 0.6650, "AUD/USD"),         # Australian Dollar
    ("USDCAD", 1.3450, "USD/CAD"),         # USD vs Canadian Dollar
    ("USDCHF", 0.8750, "USD/CHF"),         # USD vs Swiss Franc
]
```

**Format:** `(symbol_code, base_price, display_name)`

**Finding base prices:**
- Forex pairs: Use current market rate (e.g., EURUSD ≈ 1.08)
- Gold (XAUUSD): Around $2,600-2,700
- Bitcoin (BTCUSD): Check current price (e.g., $45,000)

---

### 2️⃣ Changing Timeframes

**Edit:** `generate_mock_market_data_multi.py` line 369

```python
timeframes = [
    ("M1", 1),       # 1-minute bars
    ("M5", 5),       # 5-minute bars
    ("M15", 15),     # 15-minute bars
    ("M30", 30),     # 30-minute bars
    ("H1", 60),      # 1-hour bars
    ("H4", 240),     # 4-hour bars
    ("D1", 1440),    # Daily bars
]
```

**Format:** `(timeframe_code, interval_in_minutes)`

**Choosing timeframes:**
- **M1, M5**: Scalping strategies, high-frequency testing
- **M15, M30**: Intraday trading, most alerts
- **H1, H4**: Swing trading, medium-term alerts
- **D1**: Long-term trends, position trading

---

### 3️⃣ Changing Date Range

**Edit:** `generate_mock_market_data_multi.py` line 347

```python
# Example 1: Two days (default)
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 11, 0, 0, 0)

# Example 2: One week
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 16, 0, 0, 0)

# Example 3: One month
start_date = datetime(2026, 2, 1, 0, 0, 0)
end_date = datetime(2026, 3, 1, 0, 0, 0)

# Example 4: Specific trading hours (9 AM - 5 PM)
start_date = datetime(2026, 2, 9, 9, 0, 0)
end_date = datetime(2026, 2, 9, 17, 0, 0)
```

**Data size calculator:**

| Date Range | M5 Bars | M15 Bars | H1 Bars | File Size (M5) |
|------------|---------|----------|---------|----------------|
| 1 hour     | 12      | 4        | 1       | ~2 KB          |
| 8 hours    | 96      | 32       | 8       | ~15 KB         |
| 1 day      | 288     | 96       | 24      | ~50 KB         |
| 1 week     | 2,016   | 672      | 168     | ~350 KB        |
| 1 month    | 8,640   | 2,880    | 720     | ~1.5 MB        |
| 1 year     | 105,120 | 35,040   | 8,760   | ~18 MB         |

**⚠️ Warning:** Large date ranges with M1 timeframe can generate very large files!

---

## 💡 Common Use Cases

### Use Case 1: Testing Alert System with Single Symbol

**Goal:** Test XAUUSD alerts on M15 timeframe for 2 days

**Script:** Original `generate_mock_market_data.py`

```bash
python3 scripts/generate_mock_market_data.py
```

**Output:**
- `XAUUSD_M15_mock_data.txt` (96 rows = 2 days × 24 hours × 4 bars/hour)

---

### Use Case 2: Testing Multi-Symbol Dashboard

**Goal:** Test dashboard with 4 major pairs, 2 timeframes each

**Script:** Multi `generate_mock_market_data_multi.py`

**Configuration:**
```python
symbols = [
    ("EURUSD", 1.0850, "EUR/USD"),
    ("GBPUSD", 1.2750, "GBP/USD"),
    ("USDJPY", 148.50, "USD/JPY"),
    ("XAUUSD", 2650.00, "Gold"),
]

timeframes = [
    ("M15", 15),
    ("H1", 60),
]

start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 16, 0, 0, 0)  # 1 week
```

**Run:**
```bash
python3 scripts/generate_mock_market_data_multi.py
```

**Output:** 8 files (4 symbols × 2 timeframes)

---

### Use Case 3: Testing Tier-Based Symbol Access

**Goal:** Generate data for FREE tier (EURUSD M15) and PRO tier (XAUUSD M5, GBPUSD H1)

**Configuration:**
```python
symbols = [
    ("EURUSD", 1.0850, "EUR/USD - FREE"),  # FREE tier symbol
    ("XAUUSD", 2650.00, "Gold - PRO"),      # PRO tier symbol
    ("GBPUSD", 1.2750, "GBP/USD - PRO"),    # PRO tier symbol
]

timeframes = [
    ("M5", 5),
    ("M15", 15),
    ("H1", 60),
]
```

**Output:** 9 files for testing tier restrictions

---

### Use Case 4: Scalping Strategy Testing

**Goal:** Test high-frequency M1 and M5 data for 24 hours

**Configuration:**
```python
symbols = [
    ("EURUSD", 1.0850, "EUR/USD"),
]

timeframes = [
    ("M1", 1),   # 1-minute bars
    ("M5", 5),   # 5-minute bars
]

start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 10, 0, 0, 0)  # 24 hours
```

**Output:**
- `EURUSD_M1_mock_data.txt` (1,440 rows)
- `EURUSD_M5_mock_data.txt` (288 rows)

---

### Use Case 5: Long-Term Backtesting

**Goal:** Generate 3 months of H4 and D1 data

**Configuration:**
```python
symbols = [
    ("XAUUSD", 2650.00, "Gold"),
]

timeframes = [
    ("H4", 240),   # 4-hour bars
    ("D1", 1440),  # Daily bars
]

start_date = datetime(2025, 11, 1, 0, 0, 0)
end_date = datetime(2026, 2, 1, 0, 0, 0)  # 3 months
```

**Output:**
- `XAUUSD_H4_mock_data.txt` (540 rows = 90 days × 6 bars/day)
- `XAUUSD_D1_mock_data.txt` (90 rows)

---

## 📄 Output Format

### File Structure

```
timestamp|symbol|open|high|low|close|volume|timeframe|tema|hrma|smma|...
1738972800|XAUUSD|2652.45|2657.89|2650.12|2655.34|5432|M5|2654.123|...
1738973100|XAUUSD|2655.34|2659.21|2654.87|2658.76|6129|M5|2656.891|...
```

**Format:** Pipe-delimited (`|`) text file

### Column Layout (61 columns)

| # | Column Name | Category | Description |
|---|-------------|----------|-------------|
| 1 | timestamp | System | Unix epoch timestamp |
| 2 | symbol | System | Trading symbol (e.g., XAUUSD) |
| 3-6 | open, high, low, close | System | OHLC prices |
| 7 | volume | System | Volume |
| 8 | timeframe | System | Timeframe (M5, M15, etc.) |
| 9-13 | tema, hrma, smma, zscore, classification | FREE | Moving averages & signals |
| 14-28 | diag_asc_*, diag_desc_*, horiz_* | FREE | Diagonal & horizontal lines |
| 29-35 | ha_open, ha_high, ha_low, ha_close, etc. | FREE | Heiken Ashi candles |
| 36-45 | kc_ultra_extreme_upper, kc_upper, etc. | PRO | Keltner Channel bands |
| 46-53 | sr_support_*, sr_resistance_* | PRO | Support/Resistance levels |
| 54-59 | zigzag_high, zigzag_low, ema, dual_tema_* | PRO | ZigZag & TEMA indicators |
| 60 | pinbar | PRO | Pinbar detection (0 or 1) |
| 61 | collected_at | System | Collection timestamp |

---

## 📊 Data Import Instructions

### Excel / Google Sheets

1. **Open Excel or Google Sheets**
2. Go to: **Data > Import > From Text/CSV**
3. Select your `.txt` file (e.g., `XAUUSD_M5_mock_data.txt`)
4. **Set delimiter:** Click "Other" and enter `|` (pipe character)
5. Click **Import**
6. Verify: You should see 61 columns with proper headers

### PostgreSQL (Direct COPY)

```sql
-- Create temporary table
CREATE TEMP TABLE mock_data (
    timestamp BIGINT,
    symbol TEXT,
    open NUMERIC,
    high NUMERIC,
    low NUMERIC,
    close NUMERIC,
    volume INTEGER,
    timeframe TEXT,
    -- ... (add remaining 53 columns)
);

-- Import data (skip header row)
COPY mock_data
FROM '/path/to/XAUUSD_M5_mock_data.txt'
DELIMITER '|'
CSV HEADER;

-- Verify import
SELECT COUNT(*), symbol, timeframe
FROM mock_data
GROUP BY symbol, timeframe;
```

### Python (Pandas)

```python
import pandas as pd

# Load data
df = pd.read_csv('XAUUSD_M5_mock_data.txt', delimiter='|')

# Verify
print(f"Rows: {len(df)}")
print(f"Columns: {len(df.columns)}")
print(df.head())

# Convert timestamp to datetime
df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')
```

### Node.js (fs + csv-parser)

```javascript
const fs = require('fs');
const csv = require('csv-parser');

const results = [];

fs.createReadStream('XAUUSD_M5_mock_data.txt')
  .pipe(csv({ separator: '|' }))
  .on('data', (data) => results.push(data))
  .on('end', () => {
    console.log(`Loaded ${results.length} rows`);
    console.log('First row:', results[0]);
  });
```

---

## 🔧 Troubleshooting

### Issue 1: Script Not Found

**Error:**
```
python3: can't open file 'scripts/generate_mock_market_data.py': [Errno 2] No such file or directory
```

**Solution:**
```bash
# Ensure you're in the project root
cd /home/user/trading-alerts-saas-public

# Verify script exists
ls -l scripts/generate_mock_market_data*.py

# Run with correct path
python3 scripts/generate_mock_market_data_multi.py
```

---

### Issue 2: Empty Output Files

**Symptoms:** Generated files are empty or only contain headers

**Cause:** End date is before or equal to start date

**Solution:**
```python
# ❌ Wrong - end_date same as start_date
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 9, 0, 0, 0)

# ✅ Correct - end_date after start_date
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 11, 0, 0, 0)  # 2 days later
```

---

### Issue 3: File Too Large

**Symptoms:** Script runs for a long time, file size exceeds GB

**Cause:** M1 timeframe with long date range

**Example calculation:**
```
M1 bars per day = 24 hours × 60 minutes = 1,440 bars/day
1 year = 365 days × 1,440 bars = 525,600 bars
File size ≈ 525,600 × 0.3 KB = 157 MB (per symbol!)
```

**Solution:**
```python
# Option 1: Use larger timeframe
timeframes = [
    ("M5", 5),    # 20× fewer rows than M1
    ("M15", 15),  # 60× fewer rows than M1
]

# Option 2: Reduce date range
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 16, 0, 0, 0)  # 1 week instead of 1 year

# Option 3: Generate in batches
for week in range(4):  # 4 weeks
    start = datetime(2026, 2, 1 + week*7, 0, 0, 0)
    end = start + timedelta(days=7)
    # Generate and save with week suffix
```

---

### Issue 4: Import Fails in Excel

**Symptoms:** All data appears in one column

**Cause:** Wrong delimiter selected

**Solution:**
1. During import, click **"Delimited"** (not "Fixed width")
2. Uncheck "Tab", "Comma", "Semicolon"
3. Check **"Other"** and enter `|` (pipe character)
4. Preview should show 61 columns
5. Click Finish

---

### Issue 5: Timestamps Are Wrong

**Symptoms:** All timestamps are the same or dates don't match

**Cause:** Timezone issues or wrong date format

**Solution:**
```python
# Verify generated timestamps
from datetime import datetime

timestamp = 1738972800
dt = datetime.fromtimestamp(timestamp)
print(f"Timestamp {timestamp} = {dt}")

# Expected: 2026-02-09 00:00:00 (UTC)
```

**In Python (when reading):**
```python
import pandas as pd

df = pd.read_csv('XAUUSD_M5_mock_data.txt', delimiter='|')
df['datetime'] = pd.to_datetime(df['timestamp'], unit='s', utc=True)

print(df[['timestamp', 'datetime']].head())
```

---

## 🎯 Best Practices

### 1. Start Small, Scale Up

✅ **DO:**
- Generate 1-2 days of M15 data first
- Verify import works correctly
- Check data looks realistic
- Then scale to production size

❌ **DON'T:**
- Jump to 1 year of M1 data immediately
- Generate all symbols at once without testing

---

### 2. Match Production Timeframes

✅ **DO:**
- Use timeframes your users will actually access (M15, H1)
- Match your tier restrictions (FREE: M15, PRO: M5+H1)

❌ **DON'T:**
- Generate M1 data if your system doesn't support it
- Create D1 data for a scalping platform

---

### 3. Organize Output Files

✅ **DO:**
```bash
# Create organized directory structure
mkdir -p mock_data/{gold,forex,crypto}
mv XAUUSD_* mock_data/gold/
mv EURUSD_* mock_data/forex/
mv BTCUSD_* mock_data/crypto/
```

❌ **DON'T:**
- Leave 50+ files in project root
- Mix production and test data

---

### 4. Version Your Mock Data

✅ **DO:**
```bash
# Include date in folder name
mkdir mock_data_2026-02-12
python3 scripts/generate_mock_market_data_multi.py
mv *_mock_data.txt mock_data_2026-02-12/

# Document what was generated
echo "Generated: 4 symbols × 2 timeframes × 7 days" > mock_data_2026-02-12/README.txt
```

---

## 📚 Additional Resources

- **Schema Documentation:** See `docs/ea_schema_v3.0.md` (if exists)
- **Indicator Definitions:** Refer to your EA documentation
- **Production Data Format:** Match this exact 61-column schema

---

## 🚀 Next Steps

After generating mock data:

1. ✅ **Verify file structure** - Check 61 columns present
2. ✅ **Test import** - Load into your database/application
3. ✅ **Validate indicators** - Spot-check a few rows for realistic values
4. ✅ **Test tier restrictions** - Ensure FREE/PRO symbols work correctly
5. ✅ **Run alerts** - Trigger alerts based on mock data
6. ✅ **Check dashboards** - Verify charts render correctly
7. ✅ **Load testing** - Test with larger datasets if needed

---

**Questions or Issues?**

If you encounter problems not covered in this guide, check:
- Script comments in `generate_mock_market_data_multi.py`
- Python error messages (usually very descriptive)
- Your project's main documentation

---

**Last Updated:** 2026-02-12
**Maintained By:** Trading Alerts SaaS Team
**Version:** 3.0 (EA v2.27+ compatible)
