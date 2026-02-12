# BodySide Candle Export - 10 Column Modification Summary

## Overview

Modified `BodySide Candle_Download_V1.mq5` to export **10 columns** instead of the original 7 columns, adding Symbol, Timeframe, Z-Score, and integer Candle classification (0-5).

---

## File Information

- **Original File:** `BodySide Candle_Download_V1.mq5`
- **New File:** `BodySide Candle_10-column_Export.mq5`
- **Version:** 2.00
- **Date:** 2026-02-12

---

## Export Format Comparison

### Original Format (7 columns):
```
No | TimeStamp | Open | High | Low | Close | Candle Type
0  | 2026.02.12 15:00 | 5052.88 | 5057.64 | 5051.59 | 5055.85 | ---
1  | 2026.02.12 14:45 | 5057.54 | 5058.53 | 5048.95 | 5052.88 | UpLarge
```

### New Format (10 columns):
```
No | TimeStamp | Symbol | Timeframe | Open | High | Low | Close | Z-Score of body size | Candle classification
0  | 2026.02.12 15:00 | BTCUSD | PERIOD_H1 | 5052.88 | 5057.64 | 5051.59 | 5055.85 | 0.45231 | 0
1  | 2026.02.12 14:45 | BTCUSD | PERIOD_H1 | 5057.54 | 5058.53 | 5048.95 | 5052.88 | 1.67894 | 1
```

---

## Key Modifications

### 1. Modified `CalculateBodySizeCandles()` Function

**Old Signature:**
```mql5
void CalculateBodySizeCandles(const datetime &time[],
                              const double &open[],
                              const double &close[],
                              const int bars_count,
                              string &candleTypes[])
```

**New Signature:**
```mql5
void CalculateBodySizeCandles(const datetime &time[],
                              const double &open[],
                              const double &close[],
                              const int bars_count,
                              double &zScores[],
                              int &classifications[])
```

**Changes:**
- Now returns **Z-Score values** in a separate array
- Returns **integer classifications (0-5)** instead of string types
- Z-Scores are preserved for export

---

### 2. New `GetCandleClassification()` Function

**Purpose:** Convert Z-Score and direction to integer classification (0-5)

```mql5
int GetCandleClassification(double zScore, bool isBullish)
{
   if(isBullish)  // Bullish candle
   {
      if(zScore >= InpThresholdZ2)      // ≥ 2.5
         return 2;  // TYPE_UP_EXTREME
      else if(zScore >= InpThresholdZ1) // ≥ 1.5
         return 1;  // TYPE_UP_LARGE
      else
         return 0;  // TYPE_UP_NORMAL
   }
   else  // Bearish candle
   {
      if(zScore >= InpThresholdZ2)      // ≥ 2.5
         return 5;  // TYPE_DOWN_EXTREME
      else if(zScore >= InpThresholdZ1) // ≥ 1.5
         return 4;  // TYPE_DOWN_LARGE
      else
         return 3;  // TYPE_DOWN_NORMAL
   }
}
```

---

### 3. Integer Classification Mapping

| Classification | Value | Description | Z-Score Range |
|----------------|-------|-------------|---------------|
| **TYPE_UP_NORMAL** | 0 | Bullish candle with normal body size | > 0 to < 1.5 |
| **TYPE_UP_LARGE** | 1 | Bullish candle with large body size | ≥ 1.5 to < 2.5 |
| **TYPE_UP_EXTREME** | 2 | Bullish candle with extreme body size | ≥ 2.5 |
| **TYPE_DOWN_NORMAL** | 3 | Bearish candle with normal body size | < 0 to > -1.5 |
| **TYPE_DOWN_LARGE** | 4 | Bearish candle with large body size | ≤ -1.5 to > -2.5 |
| **TYPE_DOWN_EXTREME** | 5 | Bearish candle with extreme body size | ≤ -2.5 |

**Note:** The thresholds (±1.5, ±2.5) are configured via `InpThresholdZ1` and `InpThresholdZ2` input parameters and are not hardcoded.

---

### 4. Updated `ExportToTxt()` Function

**Header Line (Old):**
```mql5
"No\tTimeStamp\tOpen\tHigh\tLow\tClose\tCandle Type"
```

**Header Line (New):**
```mql5
"No\tTimeStamp\tSymbol\tTimeframe\tOpen\tHigh\tLow\tClose\tZ-Score of body size\tCandle classification"
```

**Data Row (Old):**
```mql5
string line = StringFormat("%d\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%s",
                          i,
                          TimeToString(time[i], TIME_DATE|TIME_MINUTES),
                          open[i], high[i], low[i], close[i],
                          candleTypes[i]);
```

**Data Row (New):**
```mql5
string line = StringFormat("%d\t%s\t%s\t%s\t%.5f\t%.5f\t%.5f\t%.5f\t%.5f\t%d",
                          i,
                          TimeToString(time[i], TIME_DATE|TIME_MINUTES),
                          symbol,                    // NEW
                          EnumToString(timeframe),   // NEW
                          open[i],
                          high[i],
                          low[i],
                          close[i],
                          zScores[i],                // NEW
                          classifications[i]);       // NEW
```

---

### 5. Updated `ExportToJson()` Function

**Old JSON Structure:**
```json
{
    "no": 0,
    "timestamp": "2026.02.12 15:00",
    "open": 5052.88000,
    "high": 5057.64000,
    "low": 5051.59000,
    "close": 5055.85000,
    "candleType": "---"
}
```

**New JSON Structure:**
```json
{
    "no": 0,
    "timestamp": "2026.02.12 15:00",
    "symbol": "BTCUSD",
    "timeframe": "PERIOD_H1",
    "open": 5052.88000,
    "high": 5057.64000,
    "low": 5051.59000,
    "close": 5055.85000,
    "zScore": 0.45231,
    "classification": 0
}
```

---

## Usage Instructions

### 1. Install the Modified Indicator

1. Copy `BodySide Candle_10-column_Export.mq5` to your MT5 indicators folder:
   ```
   MetaTrader 5/MQL5/Indicators/
   ```

2. Compile the indicator in MetaEditor (F7)

3. Attach to a chart

### 2. Configuration Parameters

**Key Parameters:**
- `InpBars` - Number of bars to export (default: 20000)
- `InpZScoreLength` - Z-Score MA Length (default: 52)
- `InpThresholdZ1` - Threshold for Large candles (default: 1.5)
- `InpThresholdZ2` - Threshold for Extreme candles (default: 2.5)
- `InpBaseTimeFrame` - Base timeframe for calculation (default: H1)

### 3. Export Data

1. Click **"Export Data"** button on the chart
2. Files will be saved to:
   ```
   MetaTrader 5/MQL5/Files/
   ```
3. Output files:
   - `BodySizeCandle_SYMBOL_TIMEFRAME` (TXT format)
   - `BodySizeCandle_SYMBOL_TIMEFRAME.json` (JSON format, if enabled)

### 4. Batch Export (Optional)

1. Set `InpEnableBatchExport = true`
2. Configure:
   - `InpBatchSymbols = "BTCUSD,EURUSD,USDJPY"`
   - `InpBatchTimeframes = "M15,H1,H4"`
3. Click **"Batch Export"** button

---

## Example Output

### TXT Format:
```
No	TimeStamp	Symbol	Timeframe	Open	High	Low	Close	Z-Score of body size	Candle classification
0	2026.02.12 15:00	BTCUSD	PERIOD_H1	5052.88000	5057.64000	5051.59000	5055.85000	0.45231	0
1	2026.02.12 14:45	BTCUSD	PERIOD_H1	5057.54000	5058.53000	5048.95000	5052.88000	1.67894	1
2	2026.02.12 14:30	BTCUSD	PERIOD_H1	5062.44000	5068.67000	5054.72000	5057.54000	2.89432	2
```

### JSON Format:
```json
{
    "symbol": "BTCUSD",
    "timeframe": "PERIOD_H1",
    "exportTime": "2026.02.12 18:30:45",
    "bars": 3,
    "data": [
        {
            "no": 0,
            "timestamp": "2026.02.12 15:00",
            "symbol": "BTCUSD",
            "timeframe": "PERIOD_H1",
            "open": 5052.88000,
            "high": 5057.64000,
            "low": 5051.59000,
            "close": 5055.85000,
            "zScore": 0.45231,
            "classification": 0
        },
        {
            "no": 1,
            "timestamp": "2026.02.12 14:45",
            "symbol": "BTCUSD",
            "timeframe": "PERIOD_H1",
            "open": 5057.54000,
            "high": 5058.53000,
            "low": 5048.95000,
            "close": 5052.88000,
            "zScore": 1.67894,
            "classification": 1
        },
        {
            "no": 2,
            "timestamp": "2026.02.12 14:30",
            "symbol": "BTCUSD",
            "timeframe": "PERIOD_H1",
            "open": 5062.44000,
            "high": 5068.67000,
            "low": 5054.72000,
            "close": 5057.54000,
            "zScore": 2.89432,
            "classification": 2
        }
    ]
}
```

---

## Benefits of 10-Column Format

1. **Self-Describing Data**: Each row contains symbol and timeframe information
2. **Multi-Symbol Support**: Can combine data from multiple exports easily
3. **Z-Score Values**: Raw Z-Score values available for further analysis
4. **Integer Classification**: Machine-readable classification (0-5) for database storage
5. **Database-Ready**: Matches the schema used in `SimpleDataCollector_v2_27_API_GATEWAY.mq5`

---

## Compatibility

### With Existing Database Schema:
The 10-column format is **compatible** with the database schema used in:
- `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/SimpleDataCollector_v2_27_API_GATEWAY.mq5`

**Matching Columns:**
- `symbol` ✓
- `timeframe` ✓
- `open`, `high`, `low`, `close` ✓
- `[Z-Score of body size]` → `zscore` ✓
- `[Candle classification]` → `classification` ✓

---

## Testing Checklist

- [ ] Indicator compiles without errors
- [ ] Export button appears on chart
- [ ] TXT file exports with 10 columns
- [ ] JSON file exports with 10 fields (if enabled)
- [ ] Z-Score values are calculated correctly
- [ ] Integer classifications (0-5) match Z-Score thresholds
- [ ] Symbol and timeframe are correctly populated
- [ ] Batch export works for multiple symbols/timeframes

---

## Troubleshooting

### Issue: Export button not visible
**Solution:** Check indicator is attached to chart, reload chart if needed

### Issue: Z-Score values all zero
**Solution:** Ensure `InpZScoreLength` (default: 52) bars of history are available

### Issue: Classification always 0 or 3
**Solution:** Check `InpThresholdZ1` and `InpThresholdZ2` values, may need adjustment

### Issue: Symbol suffix (e.g., ".i") in export
**Solution:** This is expected - the actual broker symbol name is used

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.00 | Original | 7-column export (No, TimeStamp, Open, High, Low, Close, Candle Type) |
| 2.00 | 2026-02-12 | 10-column export (added Symbol, Timeframe, Z-Score, integer Classification) |

---

## Author Notes

This modification was created to align the export format with the database schema used in the Trading Alerts SaaS V7 backend system. The integer classification (0-5) enables efficient database storage and querying, while preserving the raw Z-Score values for advanced analysis.

For questions or issues, refer to the original `BodySide Candle_Download_V1.mq5` implementation and this modification summary.
