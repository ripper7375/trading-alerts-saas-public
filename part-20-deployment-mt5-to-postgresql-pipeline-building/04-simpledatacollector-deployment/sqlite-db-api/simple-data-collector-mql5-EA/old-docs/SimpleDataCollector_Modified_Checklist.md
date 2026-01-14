# SimpleDataCollector → SimpleDataCollector_Modified

## Migration & Testing Checklist

---

## Quick Comparison

```
┌───────────────────────────────────────────────────────────────┐
│                    BEFORE (Original)                          │
├───────────────────────────────────────────────────────────────┤
│  SimpleDataCollector.mq5                                      │
│  ├─ Collect OHLCV only                                        │
│  ├─ 9 timeframes                                              │
│  ├─ No indicators                                             │
│  └─ 8 database columns                                        │
│                                                               │
│  Database: trading_data.db                                    │
│  Table: xauusd                                                │
│  ┌────────────┬──────┬──────┬─────┬───────┬────────┬────────┐│
│  │ timestamp  │ open │ high │ low │ close │ volume │ t.frame││
│  ├────────────┼──────┼──────┼─────┼───────┼────────┼────────┤│
│  │ 1705228800 │ 2050 │ 2051 │2049 │ 2050  │  5000  │  H1    ││
│  └────────────┴──────┴──────┴─────┴───────┴────────┴────────┘│
└───────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────┐
│                     AFTER (Modified)                          │
├───────────────────────────────────────────────────────────────┤
│  SimpleDataCollector_Modified.mq5                             │
│  ├─ Collect OHLCV + TEMA/HRMA/SMMA                           │
│  ├─ 9 timeframes                                              │
│  ├─ 1 indicator (3 values)                                    │
│  └─ 11 database columns                                       │
│                                                               │
│  Database: trading_data.db                                    │
│  Table: xauusd                                                │
│  ┌────────┬────┬────┬───┬─────┬────┬───┬──────┬──────┬──────┐│
│  │timestamp│open│high│low│close│vol │t.f│ tema │ hrma │ smma ││
│  ├────────┼────┼────┼───┼─────┼────┼───┼──────┼──────┼──────┤│
│  │17052..8│2050│2051│049│2050 │5000│H1 │2050.2│2050.3│2050.1││
│  └────────┴────┴────┴───┴─────┴────┴───┴──────┴──────┴──────┘│
└───────────────────────────────────────────────────────────────┘
```

---

## Pre-Installation Checklist

### ☐ Required Files

```
[ ] TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
    Location: MT5/MQL5/Indicators/

[ ] SimpleDataCollector_Modified.mq5
    Location: MT5/MQL5/Experts/

[ ] SQLite3Base.mqh
    Location: MT5/MQL5/Include/SQLite3/

[ ] SQLite3Define.mqh
    Location: MT5/MQL5/Include/SQLite3/

[ ] SQLite3Import.mqh
    Location: MT5/MQL5/Include/SQLite3/
```

### ☐ Compilation Check

```
[ ] Indicator compiled successfully
    - Open TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
    - Press F7
    - Check Toolbox for errors
    - Verify .ex5 file created

[ ] EA compiled successfully
    - Open SimpleDataCollector_Modified.mq5
    - Press F7
    - Check Toolbox for errors
    - Verify .ex5 file created
```

### ☐ Indicator Test

```
[ ] Indicator displays on chart
    - Open any XAUUSD chart
    - Insert → Indicators → Custom
    - Select TEMA_HRMA_SMA-SMMA_Modified Buffers
    - Verify 4 lines appear (SMA, SMMA, HRMA, TEMA)

[ ] Indicator values are reasonable
    - TEMA should be near current price
    - HRMA should be near current price
    - SMMA should be near current price
    - Values should not be 0 or EMPTY
```

---

## Installation Steps

### Step 1: Backup Existing Setup

```
[ ] If using original SimpleDataCollector:
    - Stop EA (remove from chart)
    - Backup database file:
      Copy: MT5/MQL5/Files/trading_data.db
      To:   MT5/MQL5/Files/trading_data_backup.db
    - Note current table schema
```

### Step 2: Install Indicator

```
[ ] Copy indicator file
    From: Downloads/TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
    To:   MT5/MQL5/Indicators/

[ ] Compile indicator
    - Open MetaEditor
    - Open indicator file
    - Press F7
    - Verify: "0 error(s), 0 warning(s)"

[ ] Test on chart
    - Open XAUUSD H1 chart
    - Add indicator
    - Verify lines appear
```

### Step 3: Install Modified EA

```
[ ] Copy EA file
    From: Downloads/SimpleDataCollector_Modified.mq5
    To:   MT5/MQL5/Experts/

[ ] Compile EA
    - Open MetaEditor
    - Open EA file
    - Press F7
    - Verify: "0 error(s), 0 warning(s)"
```

### Step 4: Configure EA

```
[ ] Attach to chart
    - Open XAUUSD chart (any timeframe, H1 recommended)
    - Navigator → Expert Advisors
    - Drag SimpleDataCollector_Modified to chart

[ ] Configure inputs
    General:
    [ ] CollectionInterval = 30
    [ ] DatabasePath = "trading_data.db"
    [ ] MonitorSymbol = "" (empty)

    Indicator:
    [ ] InpMAPeriod = 2
    [ ] InpSMMAPeriod = 36
    [ ] len_hrma = 18
    [ ] InpPeriodEMA = 9
    [ ] InpAppliedPrice = PRICE_TYPICAL

[ ] Enable AutoTrading
    - Tools → Options → Expert Advisors
    - ✓ Allow automated trading
```

---

## Post-Installation Verification

### ☐ Initialization Check

**Check Expert Log (Ctrl+T → Expert tab):**

```
[ ] EA started message
    "SimpleDataCollector_Modified Starting..."

[ ] Indicator initialization
    "Initializing TEMA_HRMA_SMA-SMMA indicator..."
    "Waiting for indicator to initialize (3 seconds)..."
    "Indicator ready. Bars calculated: XXX"

[ ] Database connection
    "✓ Database connected successfully"

[ ] Table creation
    "✓ Table created/verified: xauusd"

[ ] Success message
    "✓ SimpleDataCollector_Modified initialized successfully"
```

**If you see errors:**

```
[ ] ERROR: Failed to load indicator
    → Check indicator filename exactly matches
    → Verify indicator is compiled (.ex5 exists)

[ ] ERROR: Failed to connect to database
    → Check DatabasePath is correct
    → Verify MT5/MQL5/Files/ folder exists

[ ] Indicator not ready. Bars calculated: 0
    → Wait 5 more seconds
    → Check indicator works manually on chart
```

### ☐ First Collection Check

**After 30 seconds, check Expert Log:**

```
[ ] Collection triggered
    "--- Collecting data at YYYY.MM.DD HH:MM:SS ---"

[ ] Data inserted for all timeframes
    [ ] "✓ XAUUSD M5: Inserted 250/250 candles"
    [ ] "✓ XAUUSD M15: Inserted 250/250 candles"
    [ ] "✓ XAUUSD M30: Inserted 250/250 candles"
    [ ] "✓ XAUUSD H1: Inserted 250/250 candles"
    [ ] "✓ XAUUSD H2: Inserted 250/250 candles"
    [ ] "✓ XAUUSD H4: Inserted 250/250 candles"
    [ ] "✓ XAUUSD H8: Inserted 250/250 candles"
    [ ] "✓ XAUUSD H12: Inserted 250/250 candles"
    [ ] "✓ XAUUSD D1: Inserted 250/250 candles"

[ ] Summary message
    "--- Collection complete. Inserted: 2250, Skipped: 0 ---"
```

---

## Database Verification

### ☐ Schema Check

**Using DB Browser for SQLite:**

```
[ ] Open database
    File → Open Database
    Navigate to: MT5/MQL5/Files/trading_data.db

[ ] Check table exists
    Database Structure → Tables
    Verify: "xauusd" table present

[ ] Check columns
    Right-click "xauusd" → Modify Table
    Verify columns:
    [ ] timestamp (INTEGER, PRIMARY KEY)
    [ ] open (REAL, NOT NULL)
    [ ] high (REAL, NOT NULL)
    [ ] low (REAL, NOT NULL)
    [ ] close (REAL, NOT NULL)
    [ ] volume (INTEGER)
    [ ] timeframe (TEXT, PRIMARY KEY)
    [ ] tema (REAL)              ← NEW
    [ ] hrma (REAL)              ← NEW
    [ ] smma (REAL)              ← NEW
    [ ] collected_at (INTEGER)
```

### ☐ Data Check

**Run SQL queries:**

```sql
[ ] Check row count
    SELECT COUNT(*) FROM xauusd;
    Expected: ~2250 (first collection)

[ ] Check timeframes
    SELECT DISTINCT timeframe FROM xauusd ORDER BY timeframe;
    Expected: D1, H1, H12, H2, H4, H8, M15, M30, M5

[ ] Check indicator values exist
    SELECT COUNT(*) FROM xauusd WHERE tema IS NOT NULL;
    Expected: > 0 (should be most rows)

[ ] Check sample data
    SELECT timestamp, close, tema, hrma, smma, timeframe
    FROM xauusd
    WHERE timeframe = 'H1'
    ORDER BY timestamp DESC
    LIMIT 5;

    Expected:
    - All columns have values
    - tema, hrma, smma are near close price
    - No NULL values in recent rows
```

### ☐ Value Validation

**Compare with chart:**

```
[ ] Get latest values from database
    SELECT tema, hrma, smma
    FROM xauusd
    WHERE timeframe = 'H1'
    ORDER BY timestamp DESC
    LIMIT 1;

    Example result:
    tema: 2050.25
    hrma: 2050.32
    smma: 2050.18

[ ] Compare with chart
    - Add indicator to H1 chart
    - Check current bar values
    - Should match database (±0.01)

[ ] If values don't match:
    [ ] Check chart timeframe vs data timeframe
    [ ] Check shift parameter
    [ ] Verify indicator parameters match
    [ ] Check BarsCalculated() > 0
```

---

## Functional Testing

### ☐ Test 1: New Bar Creation

```
[ ] Wait for new H1 bar to form (top of hour)

[ ] After new bar:
    - Check Expert Log for collection
    - Query database:
      SELECT * FROM xauusd
      WHERE timeframe = 'H1'
      ORDER BY timestamp DESC
      LIMIT 2;

[ ] Verify:
    [ ] New row created with new timestamp
    [ ] Previous row has final OHLCV values
    [ ] Both rows have indicator values
```

### ☐ Test 2: Bar Update

```
[ ] During bar formation (mid-bar)

[ ] Trigger collection (wait 30 sec)

[ ] Query same timestamp:
    SELECT * FROM xauusd
    WHERE timestamp = [current_bar_timestamp]
      AND timeframe = 'H1';

[ ] Verify:
    [ ] Row exists
    [ ] close value updated
    [ ] high/low may have changed
    [ ] indicator values updated
    [ ] collected_at timestamp is recent
```

### ☐ Test 3: Multi-Timeframe Collection

```
[ ] Query all timeframes at same timestamp:
    SELECT timeframe, close, tema, hrma, smma
    FROM xauusd
    WHERE timestamp = [current_bar_timestamp]
    ORDER BY timeframe;

[ ] Verify:
    [ ] Multiple rows with same timestamp
    [ ] Different timeframes (M5, M15, M30, etc.)
    [ ] Each has OHLCV values
    [ ] Each has indicator values
```

### ☐ Test 4: Indicator Refresh

```
[ ] Remove EA from chart

[ ] Verify OnDeinit() cleanup:
    - Check Expert Log: "Indicator handle released"
    - Check: "Database disconnected"

[ ] Reattach EA

[ ] Verify reinitialization:
    [ ] Indicator reloaded
    [ ] Database reconnected
    [ ] Collection resumes
```

---

## Performance Testing

### ☐ Collection Speed

```
[ ] Monitor collection time in logs:
    "--- Collecting data at 12:00:30 ---"
    ...
    "--- Collection complete. Inserted: 2250, Skipped: 0 ---"

    Time difference should be < 2 seconds

[ ] If > 5 seconds:
    [ ] Check transaction is used
    [ ] Reduce bar count (250 → 100)
    [ ] Check disk I/O speed
```

### ☐ Memory Usage

```
[ ] Check MT5 memory usage:
    - Task Manager → MetaTrader 5
    - Note memory before EA
    - Note memory after EA
    - Increase should be < 20 MB

[ ] If > 50 MB increase:
    [ ] Check for memory leaks
    [ ] Verify arrays are freed
    [ ] Check indicator buffer sizes
```

### ☐ Database Size

```
[ ] Check database file size:
    Location: MT5/MQL5/Files/trading_data.db

    Expected growth:
    - First collection: ~225 KB
    - Per hour: ~120 KB
    - Per day: ~2.88 MB

[ ] If growing too fast:
    [ ] Increase CollectionInterval
    [ ] Reduce bar count
    [ ] Implement cleanup
```

---

## Flask API Testing

### ☐ Basic Endpoint

```python
[ ] Create test endpoint:
    @app.route('/api/test')
    def test():
        conn = sqlite3.connect(DB_PATH)
        cursor = cursor.execute('SELECT COUNT(*) FROM xauusd')
        count = cursor.fetchone()[0]
        return {'status': 'ok', 'rows': count}

[ ] Test with curl:
    curl http://localhost:5000/api/test

    Expected: {"status": "ok", "rows": 2250}
```

### ☐ OHLCV + Indicators Endpoint

```python
[ ] Create enhanced endpoint:
    @app.route('/api/ohlcv_plus/<symbol>/<timeframe>')
    def get_ohlcv_plus(symbol, timeframe):
        cursor.execute('''
            SELECT timestamp, open, high, low, close, volume,
                   tema, hrma, smma
            FROM ?
            WHERE timeframe = ?
            ORDER BY timestamp DESC
            LIMIT 10
        ''', (symbol.lower(), timeframe.upper()))

        return jsonify(cursor.fetchall())

[ ] Test with curl:
    curl http://localhost:5000/api/ohlcv_plus/xauusd/h1

    Expected: JSON array with 10 objects containing OHLCV + indicators
```

### ☐ Verify Indicator Values

```
[ ] Check response contains:
    {
        "timestamp": 1705228800,
        "open": 2050.00,
        "close": 2050.90,
        "tema": 2050.25,    ← Should exist
        "hrma": 2050.32,    ← Should exist
        "smma": 2050.18     ← Should exist
    }

[ ] If tema/hrma/smma are null:
    [ ] Check database has values
    [ ] Check SQL query includes columns
    [ ] Check JSON serialization
```

---

## Troubleshooting Checklist

### ☐ Indicator Not Loading

```
[ ] Check exact filename:
    - Must be: "TEMA_HRMA_SMA-SMMA_Modified Buffers"
    - Case-sensitive
    - Spaces matter

[ ] Check indicator compiled:
    - .ex5 file exists in Indicators folder
    - No compilation errors

[ ] Check parameters match:
    - InpMAPeriod → int
    - InpAppliedPrice → ENUM_APPLIED_PRICE
    - All parameters in correct order
```

### ☐ All Indicator Values NULL

```
[ ] Increase initialization wait:
    Sleep(5000);  // Instead of 3000

[ ] Check BarsCalculated:
    int bars = BarsCalculated(g_h_moving_averages);
    Print("Bars calculated: ", bars);

    If 0 → indicator not ready
    If -1 → indicator error

[ ] Test indicator manually:
    - Add to chart
    - Check values appear
    - If not → indicator has bug
```

### ☐ Database Errors

```
[ ] Check database path:
    - Default: MT5/MQL5/Files/
    - Verify folder exists
    - Check write permissions

[ ] Check SQL syntax:
    - Print SQL before execute
    - Check for typos
    - Verify table name matches

[ ] Check disk space:
    - Database needs ~500 MB free
    - Verify drive not full
```

---

## Production Deployment Checklist

### ☐ Pre-Deployment

```
[ ] Tested on demo account for 24 hours
[ ] Verified data accuracy
[ ] Confirmed no memory leaks
[ ] Database size manageable
[ ] Flask API working
[ ] Performance acceptable
```

### ☐ Deployment

```
[ ] Stop original SimpleDataCollector
[ ] Backup existing database
[ ] Deploy modified EA
[ ] Monitor for 1 hour
[ ] Verify data collection
[ ] Test API endpoints
```

### ☐ Post-Deployment

```
[ ] Set up monitoring:
    [ ] Collection frequency
    [ ] Database size growth
    [ ] Memory usage
    [ ] API response times

[ ] Set up alerts:
    [ ] Collection failures
    [ ] Database errors
    [ ] Indicator errors

[ ] Schedule maintenance:
    [ ] Weekly database cleanup
    [ ] Monthly backup
    [ ] Quarterly optimization
```

---

## Success Criteria

Your installation is successful when:

✅ **Initialization:**

- [ ] EA loads without errors
- [ ] Indicator initializes
- [ ] Database connects
- [ ] Table created with 11 columns

✅ **Data Collection:**

- [ ] Collection runs every 30 seconds
- [ ] All 9 timeframes collected
- [ ] 2,250 rows inserted first time
- [ ] Subsequent collections update data

✅ **Indicator Values:**

- [ ] TEMA, HRMA, SMMA not NULL
- [ ] Values near current price
- [ ] Values match chart display
- [ ] Values update on new bars

✅ **Database Quality:**

- [ ] Schema correct (11 columns)
- [ ] No SQL errors
- [ ] Reasonable file size
- [ ] Fast query performance

✅ **API Integration:**

- [ ] Flask can read database
- [ ] Endpoints return data
- [ ] Indicator values in response
- [ ] No serialization errors

---

## Support & Resources

### Documentation

- SimpleDataCollector_Modified_Guide.md (Full guide)
- This checklist

### Debugging

- Expert Log (Ctrl+T → Expert tab)
- Journal Log (Ctrl+T → Journal tab)
- Database browser (DB Browser for SQLite)

### Common Issues

- Indicator not loading → Check filename
- NULL values → Increase Sleep()
- Database errors → Check path
- Slow performance → Reduce bar count

---

## Final Notes

This checklist ensures systematic testing and deployment. Check each item before moving to production. If any test fails, resolve before proceeding.

Good luck! 🚀
