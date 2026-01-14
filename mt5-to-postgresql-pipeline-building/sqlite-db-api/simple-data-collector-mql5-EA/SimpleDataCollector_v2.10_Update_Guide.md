# SimpleDataCollector_Modified v2.10 - Symbol Sanitization Update

## What Changed and How to Use It

---

## 🆕 Version 2.10 Changes

### Version History

- **v1.00**: Original SimpleDataCollector (OHLCV only)
- **v2.00**: Added TEMA/HRMA/SMMA indicators
- **v2.10**: Added symbol sanitization (handles suffixes) ← **NEW**

---

## ✨ New Feature: Symbol Sanitization

### What It Does

```
Auto-detects symbol WITH suffix → Sanitizes for database → Fetches data correctly

EURUSD      → eurusd      ✅
EURUSD.i    → eurusd      ✅  (Removes .i)
EURUSD.raw  → eurusd      ✅  (Removes .raw)
EURUSD.pro  → eurusd      ✅  (Removes .pro)
XAUUSD      → xauusd      ✅
XAUUSD.i    → xauusd      ✅  (Removes .i)
BTCUSD#1    → btcusd_1    ✅  (Replaces # with _)
```

---

## 🔧 Code Changes

### 1. New Function: SanitizeSymbolName()

```mql5
//+------------------------------------------------------------------+
//| Sanitize symbol name for safe table naming                        |
//| Removes broker suffixes and special characters                    |
//+------------------------------------------------------------------+
string SanitizeSymbolName(string symbol)
{
   string sanitized = symbol;

   // Remove common broker suffixes
   StringReplace(sanitized, ".i", "");      // ICMarkets
   StringReplace(sanitized, ".a", "");      // Alpari
   StringReplace(sanitized, ".raw", "");    // Raw spread
   StringReplace(sanitized, ".pro", "");    // Pro account
   StringReplace(sanitized, ".ecn", "");    // ECN account
   StringReplace(sanitized, ".std", "");    // Standard account
   StringReplace(sanitized, ".m", "");      // Micro account
   StringReplace(sanitized, ".c", "");      // Cent account
   StringReplace(sanitized, ".", "");       // Remove any remaining dots

   // Replace special characters with underscores
   StringReplace(sanitized, "#", "_");
   StringReplace(sanitized, " ", "_");
   StringReplace(sanitized, "-", "_");

   // Convert to lowercase for consistency
   StringToLower(sanitized);

   return sanitized;
}
```

### 2. Modified OnInit()

**Before (v2.00):**

```mql5
currentSymbol = _Symbol;
tableName = currentSymbol;
StringToLower(tableName);

Print("Symbol: ", currentSymbol);
Print("Table: ", tableName);
```

**After (v2.10):**

```mql5
currentSymbol = _Symbol;
tableName = SanitizeSymbolName(currentSymbol);  // ← NEW

Print("Chart Symbol: ", _Symbol);
Print("Monitor Symbol: ", currentSymbol);
Print("Database Table: ", tableName);           // ← Shows sanitized name
```

### 3. Enhanced Logging

**Old output:**

```
Symbol: EURUSD.i
Table: eurusd.i
```

**New output:**

```
Chart Symbol: EURUSD.i
Monitor Symbol: EURUSD.i
Database Table: eurusd          ← Clean name!
```

---

## 🎯 How It Works

### The Two-Name System

```mql5
// Variable 1: currentSymbol (original with suffix)
currentSymbol = "EURUSD.i"

// Used for:
CopyRates(currentSymbol, ...)         // ✅ Gets correct MT5 data
iCustom(currentSymbol, ...)           // ✅ Loads indicator correctly

// Variable 2: tableName (sanitized without suffix)
tableName = "eurusd"

// Used for:
CREATE TABLE eurusd (...)             // ✅ Clean table name
INSERT INTO eurusd (...)              // ✅ Easy to query
```

### Data Flow

```
1. Chart: EURUSD.i
   ↓
2. _Symbol = "EURUSD.i"
   ↓
3. currentSymbol = "EURUSD.i"
   ↓
4. tableName = SanitizeSymbolName("EURUSD.i")
   ↓
5. tableName = "eurusd"
   ↓
6. CopyRates("EURUSD.i", ...)  → Fetch from MT5
   ↓
7. INSERT INTO eurusd (...)    → Store clean
```

---

## 📊 Practical Examples

### Example 1: ICMarkets (symbols with .i)

**Setup:**

```
Chart: EURUSD.i
Chart: GBPUSD.i
Chart: XAUUSD.i
```

**Output:**

```
Expert Log:
  Chart Symbol: EURUSD.i
  Database Table: eurusd

  Chart Symbol: GBPUSD.i
  Database Table: gbpusd

  Chart Symbol: XAUUSD.i
  Database Table: xauusd

Database:
  Tables: eurusd, gbpusd, xauusd  (all clean!)
```

### Example 2: Mixed Brokers

**Setup:**

```
Broker A: EURUSD    (no suffix)
Broker B: EURUSD.i  (with .i)
```

**Result:**

```
Both → Same table: eurusd

Database has ONE table with data from both brokers!
```

### Example 3: Crypto with Hash

**Setup:**

```
Chart: BTCUSD#1
```

**Output:**

```
Chart Symbol: BTCUSD#1
Database Table: btcusd_1  (# replaced with _)
```

---

## 🆚 Comparison: v2.00 vs v2.10

| Aspect                 | v2.00 (Old)                 | v2.10 (New)               |
| ---------------------- | --------------------------- | ------------------------- |
| **EURUSD detection**   | ✅ Works                    | ✅ Works                  |
| **EURUSD.i detection** | ⚠️ Creates "eurusd.i" table | ✅ Creates "eurusd" table |
| **SQL queries**        | Needs `[eurusd.i]` brackets | Simple `eurusd`           |
| **Cross-broker**       | Separate tables             | ✅ Same table             |
| **Flask API**          | Complex paths               | ✅ Clean paths            |
| **Special chars**      | Potential issues            | ✅ Handled                |

---

## 🧪 Testing the Update

### Test 1: Symbol Detection

**On EURUSD.i chart:**

```
Expected log output:
=================================================
SimpleDataCollector_Modified Starting...
Chart Symbol: EURUSD.i
Monitor Symbol: EURUSD.i
Database Table: eurusd
=================================================
```

✅ **Pass criteria:** Table name is "eurusd" (no .i)

### Test 2: Data Collection

**Query database:**

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

**Expected result:**

```
eurusd   (not "eurusd.i")
gbpusd   (not "gbpusd.i")
xauusd   (not "xauusd.i")
```

✅ **Pass criteria:** All table names are clean (no suffixes)

### Test 3: Data Accuracy

**Query data:**

```sql
SELECT COUNT(*) FROM eurusd;
-- Should return 2250 (first collection)

SELECT * FROM eurusd WHERE timeframe = 'H1' ORDER BY timestamp DESC LIMIT 1;
-- Should show recent data with OHLCV + indicators
```

✅ **Pass criteria:** Data collected correctly despite suffix

### Test 4: Indicator Values

**Query indicators:**

```sql
SELECT tema, hrma, smma
FROM eurusd
WHERE timeframe = 'H1'
  AND tema IS NOT NULL
ORDER BY timestamp DESC
LIMIT 1;
```

**Expected result:**

```
tema: 1.08425
hrma: 1.08432
smma: 1.08418
```

✅ **Pass criteria:** Indicator values are present and reasonable

---

## 🔄 Migration from v2.00 to v2.10

### Option 1: Fresh Start (Recommended)

```
1. Stop v2.00 EA
2. Backup database:
   Copy trading_data.db → trading_data_v2.00_backup.db

3. Delete or rename old database:
   trading_data.db → trading_data_old.db

4. Install v2.10 EA
5. Attach to charts
6. New clean database created automatically
```

### Option 2: Keep Old Data

```
If you have EURUSD.i table and want to migrate:

1. Stop v2.00 EA

2. Rename table in SQLite:
   ALTER TABLE [eurusd.i] RENAME TO eurusd_old;

3. Install v2.10 EA

4. New "eurusd" table created

5. Optional: Merge old data
   INSERT INTO eurusd SELECT * FROM eurusd_old;
   DROP TABLE eurusd_old;
```

### Option 3: Run Both in Parallel

```
1. Keep v2.00 running
2. Use different database for v2.10:
   DatabasePath = "trading_data_v2.db"
3. Compare results
4. Switch when confident
```

---

## 📡 Flask API Benefits

### Before (v2.00)

```python
# Had to handle suffix in URL
@app.route('/api/ohlcv_plus/<symbol>/<timeframe>')
def get_ohlcv_plus(symbol, timeframe):
    # User must specify: /api/ohlcv_plus/eurusd.i/h1
    cursor.execute(f'SELECT * FROM [{symbol}] ...')
```

### After (v2.10)

```python
# Clean, simple paths
@app.route('/api/ohlcv_plus/<symbol>/<timeframe>')
def get_ohlcv_plus(symbol, timeframe):
    # User can simply: /api/ohlcv_plus/eurusd/h1
    cursor.execute(f'SELECT * FROM {symbol.lower()} ...')
```

**API Calls:**

```bash
# Old way (v2.00):
curl http://localhost:5000/api/ohlcv_plus/eurusd.i/h1  # ⚠️ Suffix required

# New way (v2.10):
curl http://localhost:5000/api/ohlcv_plus/eurusd/h1   # ✅ Clean and simple
```

---

## ⚙️ Configuration

### No Changes Required!

The EA works **exactly the same** as v2.00:

```
1. Open any chart (EURUSD, EURUSD.i, EURUSD.raw, etc.)
2. Drag EA to chart
3. Configure inputs (same as before):
   - CollectionInterval = 30
   - DatabasePath = "trading_data.db"
   - MonitorSymbol = "" (empty)
   - InpPeriodEMA = 9
   - etc.
4. Click OK

That's it! Sanitization happens automatically.
```

---

## 🛡️ Supported Suffix Formats

The EA removes these common suffixes:

| Suffix | Broker/Type | Example    | Result   |
| ------ | ----------- | ---------- | -------- |
| `.i`   | ICMarkets   | EURUSD.i   | eurusd   |
| `.a`   | Alpari      | EURUSD.a   | eurusd   |
| `.raw` | Raw spread  | EURUSD.raw | eurusd   |
| `.pro` | Pro account | EURUSD.pro | eurusd   |
| `.ecn` | ECN account | EURUSD.ecn | eurusd   |
| `.std` | Standard    | EURUSD.std | eurusd   |
| `.m`   | Micro       | EURUSD.m   | eurusd   |
| `.c`   | Cent        | EURUSD.c   | eurusd   |
| `#`    | Crypto      | BTCUSD#1   | btcusd_1 |
| `.`    | Any dot     | EUR.USD    | eurusd   |

### Adding Custom Suffixes

If your broker uses a different suffix:

```mql5
// In SanitizeSymbolName() function, add:
StringReplace(sanitized, ".custom", "");  // Your custom suffix
```

---

## 🐛 Troubleshooting

### Issue 1: Table Name Still Has Suffix

**Symptoms:**

```
Database has table: eurusd.i (not eurusd)
```

**Cause:** Using v2.00, not v2.10

**Solution:**

```
1. Verify version in code:
   #property version "2.10"

2. Recompile EA (F7)

3. Verify log shows:
   "Database Table: eurusd"  (without .i)
```

### Issue 2: Indicator Not Loading

**Symptoms:**

```
ERROR: Failed to load indicator for EURUSD.i
```

**Cause:** MT5 can't find symbol

**Solution:**

```
1. Verify symbol exists in Market Watch
2. Right-click Market Watch → Show All
3. Check symbol name exactly (case-sensitive)
4. If still fails, try without suffix:
   MonitorSymbol = "EURUSD"
```

### Issue 3: No Data Collected

**Symptoms:**

```
⚠ Failed to copy rates for EURUSD.i M5
```

**Cause:** Symbol doesn't have that timeframe

**Solution:**

```
1. Check symbol availability in MT5
2. Some brokers don't offer all timeframes
3. Data will skip that timeframe (normal)
```

---

## 📋 Quick Reference

### Key Variables

```mql5
_Symbol         // "EURUSD.i"  (MT5 built-in)
currentSymbol   // "EURUSD.i"  (stored for data fetching)
tableName       // "eurusd"    (sanitized for database)
```

### Where Each Is Used

```mql5
// currentSymbol (with suffix)
CopyRates(currentSymbol, ...)
iCustom(currentSymbol, ...)
Print("Monitor Symbol: ", currentSymbol)

// tableName (sanitized)
CREATE TABLE [tableName] (...)
INSERT INTO [tableName] (...)
Print("Database Table: ", tableName)
```

---

## ✅ Installation Checklist

```
☐ Backup old database (if upgrading)
☐ Copy v2.10 file to MT5/MQL5/Experts/
☐ Compile EA (F7)
☐ Verify version shows "2.10"
☐ Attach to chart (any symbol format)
☐ Check log shows:
  ☐ "Chart Symbol: [symbol with suffix]"
  ☐ "Database Table: [clean name]"
☐ Wait 30 seconds for first collection
☐ Verify database has clean table name
☐ Query data to confirm collection works
☐ Test Flask API with clean URLs
```

---

## 🎉 Summary

### What v2.10 Adds

✅ **Automatic suffix removal**
✅ **Clean database table names**
✅ **Cross-broker compatibility**
✅ **Simple Flask API paths**
✅ **No configuration changes needed**

### Backwards Compatible

✅ Works with symbols without suffixes (EURUSD)
✅ Works with symbols with suffixes (EURUSD.i)
✅ Same inputs as v2.00
✅ Same database schema
✅ Same indicator integration

### Upgrade Benefits

| Before                          | After                       |
| ------------------------------- | --------------------------- |
| Table: `eurusd.i`               | Table: `eurusd`             |
| SQL: `SELECT * FROM [eurusd.i]` | SQL: `SELECT * FROM eurusd` |
| API: `/api/eurusd.i/h1`         | API: `/api/eurusd/h1`       |
| Broker-specific tables          | Universal tables            |

**The update is production-ready and recommended for all users!** 🚀

---

## 📞 Need Help?

Check logs for these success messages:

```
✓ Indicator loaded successfully for EURUSD.i
✓ Database connected successfully
✓ Table created/verified: eurusd
✓ SimpleDataCollector_Modified initialized successfully
```

If you see these, v2.10 is working perfectly!
