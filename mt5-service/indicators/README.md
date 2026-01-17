# MT5 Custom Indicators

## ⚠️ IMPORTANT: Custom Indicators Not Used

**Part 6 (Flask MT5 Service) does NOT use custom indicators.**

## Why Custom Indicators Were Removed

The MT5 Python API's `iCustom()` function is unreliable and does not work consistently for fetching custom indicator data. After testing, we found that:

- `copy_buffer()` calls for custom indicators fail frequently
- `iCustom()` handle creation is unstable
- Fractal and trendline calculations from OHLCV data were incorrect

## Current Architecture

### Part 6 (Flask MT5 Service) - OHLCV Data Only

**Purpose:** Fetch raw OHLCV (Open, High, Low, Close, Volume) data from MT5 terminals

**Method:** `mt5.copy_rates_from_pos()`

**Data Provided:**

- Candlestick OHLC data
- Volume data
- Timestamp data
- **NO custom indicators**
- **NO fractals or trendlines**

### Part 20 (SQLite-Sync Script) - All Indicators

**Purpose:** Process and sync indicator data from MQL5 expert advisor exports

**Method:** Reads SQLite databases exported by MQL5 EA running on MT5 terminals

**Indicators Provided:**

- Momentum Candles (Z-score based classification)
- Keltner Channels (10-band ATR system)
- TEMA (Triple Exponential Moving Average)
- HRMA (Hull-like Responsive Moving Average)
- SMMA (Smoothed Moving Average)
- ZigZag (Peak/Bottom structure detection)

## Data Flow

```
MT5 Terminal
    ├─→ Part 6 (Flask MT5 Service)
    │     └─→ Fetches: OHLCV data only via copy_rates_from_pos()
    │
    └─→ MQL5 Expert Advisor
          └─→ Exports: Indicators to SQLite database
                └─→ Part 20 (SQLite-Sync Script)
                      └─→ Syncs: Indicator data to PostgreSQL
```

## Symbol Resolver

Part 6 includes a broker-specific symbol name resolver to handle naming variations:

- Eightcap: Adds `.i` suffix (e.g., `EURUSD.i`)
- Other brokers: Uses suffixes like `-c`, `c`, `.a`, etc.

See: `mt5-service/app/utils/symbol_resolver.py` and `mt5-service/docs/symbol-resolution.md`

## Reference

- **Part 6 Documentation:** See `mt5-service/README.md` (if exists)
- **Part 20 Documentation:** See `docs/sqlite-and-mt5service/`
- **MetaTrader5 Python Package:** https://pypi.org/project/MetaTrader5/
- **Symbol Resolver Guide:** `mt5-service/docs/symbol-resolution.md`
