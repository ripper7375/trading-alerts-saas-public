# Mock Market Data Generator - Complete Package

**🎯 Everything you need to generate mock market data for your Trading Alerts SaaS**

---

## 📦 What's Included

This package contains scripts and documentation for generating realistic mock market data compatible with your EA v2.27+ (Schema v3.0).

### Scripts (in `/scripts/`)

| Script | Description | Use Case |
|--------|-------------|----------|
| `generate_mock_market_data.py` | Original script | XAUUSD only, quick testing |
| `generate_mock_market_data_multi.py` | **Enhanced version** | Multiple symbols & timeframes |

### Documentation (in `/docs/`)

| Document | Description | When to Use |
|----------|-------------|-------------|
| `MOCK_DATA_GENERATOR_GUIDE.md` | **📖 Complete guide** | First time setup, detailed instructions |
| `MOCK_DATA_QUICK_REFERENCE.md` | **⚡ Quick reference** | Fast configuration, common examples |
| `MOCK_DATA_DEMONSTRATION.md` | **🔍 Live demo results** | See what output looks like |
| `MOCK_DATA_README.md` | **📋 This file** | Package overview |

---

## 🚀 Quick Start (60 Seconds)

### Step 1: Choose Your Script

**Need XAUUSD only?**
```bash
python3 scripts/generate_mock_market_data.py
```

**Need multiple symbols?**
```bash
python3 scripts/generate_mock_market_data_multi.py
```

### Step 2: Customize (Optional)

Edit `generate_mock_market_data_multi.py`:

```python
# Line 355: Change symbols
symbols = [
    ("XAUUSD", 2650.00, "Gold"),
    ("EURUSD", 1.0850, "EUR/USD"),
]

# Line 369: Change timeframes
timeframes = [
    ("M5", 5),
    ("M15", 15),
]

# Line 347: Change dates
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 11, 0, 0, 0)
```

### Step 3: Run & Verify

```bash
# Generate data
python3 scripts/generate_mock_market_data_multi.py

# Check output
ls -lh *_mock_data.txt

# View first few rows
head -3 XAUUSD_M5_mock_data.txt
```

**Done! ✅**

---

## 📊 What You Get

### Data Format

- **61 columns** (pipe-delimited)
- **Schema:** EA v2.27+ (v3.0)
- **Categories:**
  - 9 System columns (timestamp, OHLCV, etc.)
  - 16 FREE indicators (TEMA, HRMA, SMMA, etc.)
  - 36 PRO indicators (Keltner, S/R, ZigZag, etc.)

### Example Output

```
timestamp|symbol|open|high|low|close|volume|timeframe|tema|hrma|...
1770595200|XAUUSD|2649.67|2656.69|2649.66|2653.61|3247|M5|2657.22|...
1770595500|XAUUSD|2655.5|2663.49|2651.79|2658.56|6697|M5|2661.77|...
```

---

## 🎯 Common Use Cases

### 1. Quick Testing (Single Symbol)

**Goal:** Test alert system with Gold M15 data

**Script:** `generate_mock_market_data.py`

**Output:**
- `XAUUSD_M5_mock_data.txt` (576 rows)
- `XAUUSD_M15_mock_data.txt` (192 rows)

**Time:** 2 seconds

---

### 2. Multi-Symbol Dashboard

**Goal:** Test dashboard with 4 symbols × 2 timeframes

**Script:** `generate_mock_market_data_multi.py`

**Configuration:**
```python
symbols = [
    ("EURUSD", 1.0850, "EUR/USD"),
    ("GBPUSD", 1.2750, "GBP/USD"),
    ("USDJPY", 148.50, "USD/JPY"),
    ("XAUUSD", 2650.00, "Gold"),
]
timeframes = [("M15", 15), ("H1", 60)]
```

**Output:** 8 files

**Time:** 5 seconds

---

### 3. Tier Testing

**Goal:** Test FREE vs PRO tier symbol access

**Script:** `generate_mock_market_data_multi.py`

**Configuration:**
```python
# FREE tier: EURUSD M15 only
# PRO tier: XAUUSD M5, GBPUSD H1, etc.

symbols = [
    ("EURUSD", 1.0850, "EUR/USD - FREE"),
    ("XAUUSD", 2650.00, "Gold - PRO"),
    ("GBPUSD", 1.2750, "GBP - PRO"),
]
```

---

### 4. Backtesting (Long-Term Data)

**Goal:** Generate 1 month of H1 data for strategy testing

**Configuration:**
```python
start_date = datetime(2026, 1, 1, 0, 0, 0)
end_date = datetime(2026, 2, 1, 0, 0, 0)  # 1 month

timeframes = [("H1", 60)]
```

**Output:** ~720 rows per symbol

---

## 📚 Documentation Guide

### For First-Time Users

**Start here:**
1. Read this README (you are here!)
2. Read: `MOCK_DATA_GENERATOR_GUIDE.md`
3. Try: Run the original script
4. Customize: Edit multi-symbol script
5. Refer to: `MOCK_DATA_QUICK_REFERENCE.md` as needed

### For Experienced Users

**Quick workflow:**
1. Open: `MOCK_DATA_QUICK_REFERENCE.md`
2. Copy configuration example
3. Edit: `generate_mock_market_data_multi.py`
4. Run script
5. Import data into your system

---

## 🔢 Data Size Reference

### By Timeframe (per symbol, 1 week)

| Timeframe | Bars/Week | File Size | Best For |
|-----------|-----------|-----------|----------|
| M1        | 10,080    | ~2 MB     | Scalping, tick testing |
| M5        | 2,016     | ~400 KB   | Intraday, most alerts |
| M15       | 672       | ~140 KB   | Swing trading, FREE tier |
| M30       | 336       | ~70 KB    | Day trading |
| H1        | 168       | ~35 KB    | Position trading |
| H4        | 42        | ~9 KB     | Long-term trends |
| D1        | 7         | ~2 KB     | Portfolio analysis |

### By Duration (M15 timeframe)

| Duration | Bars | File Size |
|----------|------|-----------|
| 1 day    | 96   | ~20 KB    |
| 1 week   | 672  | ~140 KB   |
| 1 month  | 2,880| ~575 KB   |
| 3 months | 8,640| ~1.7 MB   |
| 1 year   | 35,040| ~7 MB    |

---

## 🛠️ Import Instructions

### Excel / Google Sheets

1. **File > Import > Text/CSV**
2. Select your `.txt` file
3. **Delimiter:** Other → `|` (pipe)
4. Import
5. Verify 61 columns

### Python (Pandas)

```python
import pandas as pd

df = pd.read_csv('XAUUSD_M5_mock_data.txt', delimiter='|')
df['datetime'] = pd.to_datetime(df['timestamp'], unit='s')

print(df.head())
```

### PostgreSQL

```sql
COPY mock_data
FROM '/path/to/XAUUSD_M5_mock_data.txt'
DELIMITER '|'
CSV HEADER;
```

### Node.js

```javascript
const csv = require('csv-parser');
const fs = require('fs');

fs.createReadStream('XAUUSD_M5_mock_data.txt')
  .pipe(csv({ separator: '|' }))
  .on('data', (row) => console.log(row));
```

---

## 🎨 Supported Symbols

### Forex Majors

| Symbol  | Base Price | Volatility |
|---------|------------|------------|
| EURUSD  | 1.0850     | ~0.0005    |
| GBPUSD  | 1.2750     | ~0.0005    |
| USDJPY  | 148.50     | ~0.5       |
| USDCHF  | 0.8750     | ~0.0005    |

### Forex Minors

| Symbol  | Base Price | Volatility |
|---------|------------|------------|
| AUDUSD  | 0.6650     | ~0.0005    |
| USDCAD  | 1.3450     | ~0.0005    |
| NZDUSD  | 0.6150     | ~0.0005    |

### Commodities

| Symbol  | Base Price | Volatility |
|---------|------------|------------|
| XAUUSD  | 2650.00    | ~5.0       |
| XAGUSD  | 30.50      | ~0.5       |
| WTIUSD  | 75.00      | ~2.0       |

### Crypto

| Symbol  | Base Price | Volatility |
|---------|------------|------------|
| BTCUSD  | 45000.00   | ~200.0     |
| ETHUSD  | 2800.00    | ~50.0      |

---

## ⚙️ Advanced Configuration

### Custom Volatility

Edit `generate_market_data()` function (line 100):

```python
# Default volatility logic
if "USD" in symbol and "XAU" not in symbol:
    volatility = 0.0005  # Forex
elif "XAU" in symbol:
    volatility = 5.0      # Gold
elif "BTC" in symbol:
    volatility = 200.0    # Bitcoin

# Add custom symbols
elif symbol == "CUSTOM":
    volatility = 10.0     # Your custom volatility
```

### Trading Hours Only

```python
# Generate only 9 AM - 5 PM
start_date = datetime(2026, 2, 9, 9, 0, 0)   # 9 AM
end_date = datetime(2026, 2, 9, 17, 0, 0)    # 5 PM
```

### Weekend Exclusion

```python
# Skip weekends (add to main loop)
if current_time.weekday() >= 5:  # Saturday=5, Sunday=6
    current_time += timedelta(minutes=interval_minutes)
    continue
```

---

## 🐛 Troubleshooting

### Issue: Empty Files

**Cause:** End date ≤ Start date

**Solution:**
```python
# ❌ Wrong
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 9, 0, 0, 0)  # Same date!

# ✅ Correct
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 11, 0, 0, 0)  # 2 days later
```

---

### Issue: File Too Large

**Cause:** M1 timeframe + long date range

**Solution:**
- Use M5 or M15 instead of M1
- Reduce date range
- Generate in batches

---

### Issue: Wrong Delimiter in Excel

**Cause:** Comma selected instead of pipe

**Solution:**
- During import: Check "Other"
- Enter: `|` (pipe character)
- Preview should show 61 columns

---

## ✅ Verification Checklist

After generation:

- [ ] Files exist in project root
- [ ] File size > 0 bytes
- [ ] Header row present (starts with "timestamp|symbol|...")
- [ ] 61 columns (count pipes: should be 60 per row)
- [ ] Timestamps increase sequentially
- [ ] Symbol matches expected
- [ ] Price values realistic
- [ ] Can import into Excel/database

---

## 🎓 Learning Path

### Level 1: Beginner
1. Run original script (XAUUSD only)
2. View output in text editor
3. Import into Excel
4. Count rows and columns

### Level 2: Intermediate
1. Run multi-symbol script with defaults
2. Customize date range
3. Add 1-2 new symbols
4. Import into Python/database

### Level 3: Advanced
1. Add custom symbols with volatility
2. Generate trading hours only
3. Batch generate multiple date ranges
4. Integrate with your API/pipeline

---

## 📞 Support

### Documentation

- **Complete Guide:** `MOCK_DATA_GENERATOR_GUIDE.md` (20 pages)
- **Quick Reference:** `MOCK_DATA_QUICK_REFERENCE.md` (2 pages)
- **Live Demo:** `MOCK_DATA_DEMONSTRATION.md` (sample output)

### Script Comments

Both scripts have inline comments explaining:
- Configuration options
- Function parameters
- Column definitions
- Example modifications

---

## 🚀 Next Steps

After generating mock data:

1. ✅ Import into database
2. ✅ Test API endpoints
3. ✅ Trigger test alerts
4. ✅ Verify tier restrictions
5. ✅ Load test with larger datasets
6. ✅ Build charts/dashboards
7. ✅ Run backtests

---

## 📊 Project Structure

```
trading-alerts-saas-public/
├── scripts/
│   ├── generate_mock_market_data.py          # Original (XAUUSD only)
│   └── generate_mock_market_data_multi.py    # Enhanced (multi-symbol)
│
├── docs/
│   ├── MOCK_DATA_README.md                   # This file (overview)
│   ├── MOCK_DATA_GENERATOR_GUIDE.md          # Complete guide (20 pages)
│   ├── MOCK_DATA_QUICK_REFERENCE.md          # Quick reference (2 pages)
│   └── MOCK_DATA_DEMONSTRATION.md            # Sample output
│
└── *_mock_data.txt                           # Generated output files
```

---

## 🎉 You're Ready!

You now have everything you need to generate mock market data for your Trading Alerts SaaS platform.

**Start with:**
1. Read this README (✅ you just did!)
2. Run: `python3 scripts/generate_mock_market_data.py`
3. Check: `ls -lh *_mock_data.txt`
4. Import into your system

**Questions?** Check the documentation files above!

---

**Happy Testing! 🚀**

---

**Package Version:** 3.0
**Schema:** EA v2.27+ (61 columns)
**Last Updated:** 2026-02-12
**Compatibility:** Python 3.6+, Excel, PostgreSQL, MySQL, Pandas
