# Mock Data Generator - Quick Reference

**⚡ Fast Configuration Guide**

---

## 🎯 Most Common Customizations

### 1. Change Symbols (Line 355)

```python
# Add/remove symbols from this list:
symbols = [
    ("XAUUSD", 2650.00, "Gold"),
    ("EURUSD", 1.0850, "EUR/USD"),
    ("GBPUSD", 1.2750, "GBP/USD"),
    ("USDJPY", 148.50, "USD/JPY"),
]
```

**Format:** `(symbol_code, base_price, display_name)`

---

### 2. Change Timeframes (Line 369)

```python
# Add/remove timeframes:
timeframes = [
    ("M5", 5),
    ("M15", 15),
    ("H1", 60),
]
```

**Format:** `(code, minutes_per_bar)`

---

### 3. Change Date Range (Line 347)

```python
# Adjust dates:
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 11, 0, 0, 0)
```

---

## 📊 Quick Examples

### Example 1: Single Symbol, Multiple Timeframes

```python
symbols = [
    ("XAUUSD", 2650.00, "Gold"),
]

timeframes = [
    ("M5", 5),
    ("M15", 15),
    ("M30", 30),
    ("H1", 60),
]
```

**Output:** 4 files (XAUUSD_M5, M15, M30, H1)

---

### Example 2: Multiple Symbols, Single Timeframe

```python
symbols = [
    ("EURUSD", 1.0850, "EUR/USD"),
    ("GBPUSD", 1.2750, "GBP/USD"),
    ("USDJPY", 148.50, "USD/JPY"),
    ("XAUUSD", 2650.00, "Gold"),
]

timeframes = [
    ("M15", 15),
]
```

**Output:** 4 files (all M15)

---

### Example 3: One Week of Data

```python
start_date = datetime(2026, 2, 9, 0, 0, 0)
end_date = datetime(2026, 2, 16, 0, 0, 0)  # +7 days
```

---

### Example 4: Trading Hours Only (9 AM - 5 PM)

```python
start_date = datetime(2026, 2, 9, 9, 0, 0)   # 9 AM
end_date = datetime(2026, 2, 9, 17, 0, 0)    # 5 PM
```

---

## 🔢 Data Size Calculator

| Duration | M5 Bars | M15 Bars | H1 Bars | D1 Bars |
| -------- | ------- | -------- | ------- | ------- |
| 1 day    | 288     | 96       | 24      | 1       |
| 1 week   | 2,016   | 672      | 168     | 7       |
| 1 month  | 8,640   | 2,880    | 720     | 30      |

**File size estimate:** ~0.2 KB per row

---

## 🎨 Symbol Base Prices

| Symbol | Typical Base Price | Asset Type     |
| ------ | ------------------ | -------------- |
| XAUUSD | 2600-2700          | Gold           |
| EURUSD | 1.05-1.10          | Forex Major    |
| GBPUSD | 1.25-1.30          | Forex Major    |
| USDJPY | 145-150            | Forex Major    |
| AUDUSD | 0.65-0.68          | Forex Minor    |
| USDCAD | 1.33-1.36          | Forex Minor    |
| BTCUSD | 40000-50000        | Cryptocurrency |
| ETHUSD | 2500-3000          | Cryptocurrency |

---

## ⚡ Quick Commands

```bash
# Navigate to project
cd /home/user/trading-alerts-saas-public

# Run original script (XAUUSD only)
python3 scripts/generate_mock_market_data.py

# Run multi-symbol script
python3 scripts/generate_mock_market_data_multi.py

# Check output
ls -lh *_mock_data.txt

# View first 5 rows
head -5 XAUUSD_M5_mock_data.txt

# Count rows
wc -l XAUUSD_M5_mock_data.txt
```

---

## 🐛 Common Issues

| Issue                    | Solution                                  |
| ------------------------ | ----------------------------------------- |
| Empty file               | Check end_date > start_date               |
| File too large           | Reduce date range or use larger timeframe |
| Wrong delimiter in Excel | Use pipe `\|` not comma                   |
| Script not found         | Ensure you're in project root             |

---

## 📁 Output Files Location

After running, files are created in project root:

```
/home/user/trading-alerts-saas-public/
├── XAUUSD_M5_mock_data.txt
├── XAUUSD_M15_mock_data.txt
├── EURUSD_M5_mock_data.txt
└── ...
```

---

## ✅ Verification Checklist

After generation:

- [ ] File exists
- [ ] File size > 0 bytes
- [ ] First line is header (starts with "timestamp|symbol|...")
- [ ] 61 columns present (count pipes: should be 60)
- [ ] Timestamps increase sequentially
- [ ] Symbol matches expected
- [ ] Timeframe matches expected

---

**🚀 Ready to generate? Edit the script and run it!**
