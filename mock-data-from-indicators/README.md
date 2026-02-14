# Mock Market Data for XAUUSD

This directory contains hypothetical/mock market data for XAUUSD (Gold vs USD) to illustrate the 60-column data format used by the Trading Alerts SaaS platform.

## Files

### 1. XAUUSD_M5_mock_data.txt

- **Symbol**: XAUUSD (Gold vs USD)
- **Timeframe**: M5 (5-minute candles)
- **Date Range**: February 9-10, 2026
- **Records**: 576 bars
- **Format**: Pipe-delimited (|) text file

### 2. XAUUSD_M15_mock_data.txt

- **Symbol**: XAUUSD (Gold vs USD)
- **Timeframe**: M15 (15-minute candles)
- **Date Range**: February 9-10, 2026
- **Records**: 192 bars
- **Format**: Pipe-delimited (|) text file

## Data Schema (60 Columns)

The data follows the schema defined in `SimpleDataCollector_v2_26_API_GATEWAY.mq5` and `prisma/schema.prisma`:

### System Columns (8 total: columns 1-7, 60)

1. `timestamp` - Unix timestamp (seconds)
2. `open` - Opening price
3. `high` - Highest price
4. `low` - Lowest price
5. `close` - Closing price
6. `volume` - Trading volume
7. `timeframe` - Timeframe identifier (M5, M15, etc.)
8. `collected_at` - Data collection timestamp (Unix epoch) **[at position 60]**

### Moving Averages (3)

8. `tema` - Triple Exponential Moving Average
9. `hrma` - Hull Moving Average
10. `smma` - Smoothed Moving Average

### Body Size Analysis (2)

11. `Z-Score of body size` - Statistical measure of candle body size
12. `Candle classification` - Classification value (-2 to +2)

### Fractal Diagonal Lines (8)

13-15. `diag_asc_line_1/2/3` - Ascending diagonal support/resistance
16-18. `diag_desc_line_1/2/3` - Descending diagonal support/resistance
19-20. `diag_high_map`, `diag_low_map` - Diagonal fractal maps (**0.0 when no fractal, non-zero when fractal detected**)

### Fractal Horizontal Lines (8)

21-23. `horiz_peak_line_1/2/3` - Horizontal resistance peaks
24-26. `horiz_bottom_line_1/2/3` - Horizontal support bottoms
27-28. `horiz_high_map`, `horiz_low_map` - Horizontal fractal maps (**0.0 when no fractal, non-zero when fractal detected**)

### Heiken Ashi (7)

29-32. `ha_open`, `ha_high`, `ha_low`, `ha_close` - Heiken Ashi OHLC 33. `ha_classification` - Heiken Ashi direction 34. `ha_body_size` - Heiken Ashi body size 35. `ha_body_zscore` - Z-score of HA body size

### Keltner Channels (10)

36-45. `kc_ultra_extreme_upper/lower`, `kc_extreme_upper/lower`, `kc_uppermost/lowermost`, `kc_upper/lower`, `kc_upper_middle/lower_middle` - Multi-level Keltner channels

### Support/Resistance (8)

46-49. `sr_support_4/3/2/1` - Support levels (strongest to weakest)
50-53. `sr_resistance_1/2/3/4` - Resistance levels (strongest to weakest)

### ZigZag Analysis (3)

54. `zigzag_peak` - ZigZag peak points
55. `zigzag_bottom` - ZigZag bottom points
56. `ema_26` - 26-period EMA

### Dual TEMA High/Low (2) - NEW in v2.26

57. `dual_tema_high` - TEMA of bar highs
58. `dual_tema_low` - TEMA of bar lows

### Pinbar Detection (1) - NEW in v2.26

59. `pinbar` - Pinbar detection flag (1 = detected, 0 = none)

## How to Import into Excel

1. Open Microsoft Excel
2. Go to **Data** → **From Text/CSV**
3. Select the `.txt` file
4. In the import dialog:
   - **Delimiter**: Choose "Other" and enter `|` (pipe)
   - **Data Type Detection**: Choose "Based on entire dataset"
5. Click **Load**

## Data Characteristics

- **Price Range**: Realistic XAUUSD prices (~$2,640-$2,660 per ounce)
- **Volatility**: Simulated realistic intraday volatility
- **Indicators**: All 60 columns populated with plausible values
- **Fractal Maps**:
  - `diag_high_map`, `diag_low_map`: ~20% of bars have values (0.0 otherwise)
  - `horiz_high_map`, `horiz_low_map`: ~25% of bars have values (0.0 otherwise)
  - This matches real indicator behavior where fractals are only detected at specific bars
- **Pinbar Detection**: ~10% of bars show pinbar patterns
- **ZigZag**: ~30% of bars show peaks/bottoms

## Purpose

These files serve as:

- **Format Reference**: Demonstration of the 60-column schema
- **Testing Data**: Sample data for development and QA
- **Documentation**: Visual illustration of data structure
- **Excel Integration**: Example of how to import into spreadsheet tools

## Notes

⚠️ **IMPORTANT**: This is **mock/hypothetical data** for illustration purposes only. It does not represent actual market data and should NOT be used for:

- Trading decisions
- Backtesting strategies
- Production systems
- Any financial analysis

## Related Files

- **Data Collector**: `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/SimpleDataCollector_v2_26_API_GATEWAY.mq5`
- **Database Schema**: `prisma/schema.prisma` (MarketData model)
- **Generation Script**: `scripts/generate_mock_market_data.py`

## Version

- **Schema Version**: v2.0 (includes dual_tema_high/low, pinbar)
- **EA Version**: Compatible with v2.26+
- **Generated**: February 11, 2026
