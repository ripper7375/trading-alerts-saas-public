# MT5 Custom Indicators

This directory contains documentation for the custom MQL5 indicators used by the Flask MT5 Service.

## Required Indicators

The Flask MT5 Service reads data from two custom indicators running on MetaTrader 5:

### 1. Fractal Horizontal Line_V5.mq5

**Purpose:** Identifies horizontal support and resistance levels based on fractal patterns.

**Buffers:**
- Buffer 0: Fractal peaks (resistance points)
- Buffer 1: Fractal bottoms (support points)
- Buffer 4: Peak Line 1 (primary resistance)
- Buffer 5: Peak Line 2 (secondary resistance)
- Buffer 6: Peak Line 3 (tertiary resistance)
- Buffer 7: Bottom Line 1 (primary support)
- Buffer 8: Bottom Line 2 (secondary support)
- Buffer 9: Bottom Line 3 (tertiary support)

**Installation:**
1. Copy `Fractal Horizontal Line_V5.mq5` to `MT5_DATA_FOLDER/MQL5/Indicators/`
2. Compile the indicator in MetaEditor
3. Attach to charts for all 15 symbols × 9 timeframes

### 2. Fractal Diagonal Line_V4.mq5

**Purpose:** Identifies diagonal trend lines (ascending and descending).

**Buffers:**
- Buffer 0: Ascending Line 1 (primary uptrend)
- Buffer 1: Ascending Line 2 (secondary uptrend)
- Buffer 2: Ascending Line 3 (tertiary uptrend)
- Buffer 3: Descending Line 1 (primary downtrend)
- Buffer 4: Descending Line 2 (secondary downtrend)
- Buffer 5: Descending Line 3 (tertiary downtrend)

**Installation:**
1. Copy `Fractal Diagonal Line_V4.mq5` to `MT5_DATA_FOLDER/MQL5/Indicators/`
2. Compile the indicator in MetaEditor
3. Attach to charts for all 15 symbols × 9 timeframes

## Indicator Configuration

### Symbols (15 total)
- **FREE tier (5):** BTCUSD, EURUSD, USDJPY, US30, XAUUSD
- **PRO tier (10 additional):** AUDJPY, AUDUSD, ETHUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, USDCAD, USDCHF, XAGUSD

### Timeframes (9 total)
- **FREE tier (3):** H1, H4, D1
- **PRO tier (6 additional):** M5, M15, M30, H2, H8, H12

## Data Reading

The Flask service uses `MetaTrader5.copy_buffer()` to read indicator buffer values:

```python
# Example: Read horizontal line buffer 4 (Peak Line 1)
peak_line_1 = mt5.copy_buffer('Fractal Horizontal Line_V5', mt5.TIMEFRAME_H1, 4, 0, 1000)
```

## Troubleshooting

### Indicator Not Found Error
```
Failed to get handle for Fractal Horizontal Line_V5
```

**Solution:**
1. Ensure indicator is compiled in MetaEditor
2. Check indicator is attached to the chart
3. Verify indicator name matches exactly (case-sensitive)
4. Restart MT5 terminal

### No Data Returned
```
Buffer returns empty array
```

**Solution:**
1. Check symbol is available on broker
2. Verify timeframe is supported
3. Ensure sufficient historical data is loaded
4. Check indicator is calculating (not showing errors)

## Reference

- **MQL5 Documentation:** https://www.mql5.com/en/docs
- **MetaTrader5 Python Package:** https://pypi.org/project/MetaTrader5/
- **Indicator Buffer Reading:** https://www.mql5.com/en/docs/integration/python_metatrader5/mt5copybuffer_py

## Support

For issues with indicators:
1. Check MT5 terminal logs (Tools → Options → Expert Advisors)
2. Verify indicator compilation errors in MetaEditor
3. Test indicator manually on a chart first
4. Contact indicator developer if persistent issues
