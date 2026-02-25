# FREE and PRO PLAN DATA ACCESSIBILITY

> **Version 4.0.0** — Updated 2026-02-24
> Supersedes: v3.0.0 (61-column schema, 2026-02-11)
> Schema change: 61 → 63 columns (KC band names corrected, ha_body_size renamed, ha_body_zscore + body_classification added)

---

## What Changed in v4.0 (61 → 63 columns)

| Change                            | Detail                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- |
| **10 KC columns renamed**         | Placeholder names → correct 10 ATR-band names (kc_ultra_extreme_upper … etc.) |
| **ha_strength renamed**           | `ha_strength` → `ha_body_size` to match MQL5 export header                    |
| **ha_body_zscore added**          | NEW PRO column: HA body size Z-score (Heiken Ashi group)                      |
| **body_classification added**     | NEW PRO column: candle body classification integer (Body Momentum group)      |
| **ha_classification → ha_color**  | Column renamed and converted: 0-5 enum → 1/-1 (bullish/bearish)               |
| **sr_support/resistance renamed** | sr_support_1-4 → sr_1-4 · sr_resistance_1-4 → sr_5-8                          |
| **zigzag_peak/bottom renamed**    | `zigzag_peak` → `zigzag_high` · `zigzag_bottom` → `zigzag_low`                |
| Total columns                     | 61 → **63**                                                                   |
| System columns                    | 9 (unchanged)                                                                 |
| FREE columns                      | 25 (unchanged)                                                                |
| PRO columns                       | 61 → **63**                                                                   |
| PRO indicator columns             | 36 → **38**                                                                   |
| FREE indicators                   | 2 (unchanged)                                                                 |
| PRO indicator groups              | 10 (unchanged)                                                                |

## What Changed in v3.0 (60 → 61 columns)

| Change                  | Detail                                               |
| ----------------------- | ---------------------------------------------------- |
| **Symbol column added** | NEW system column at position 2 (after timestamp)    |
| **EMA renamed**         | `ema_26` → `ema` for consistency with tema/hrma/smma |
| Total columns           | 60 → **61**                                          |
| System columns          | 8 → **9**                                            |

---

## 🔧 System Columns (9 columns) ---> FREE + PRO

| Column Name    | Data Type       | Nullable | Description              | Notes                        |
| -------------- | --------------- | -------- | ------------------------ | ---------------------------- |
| `timestamp`    | `BIGINT`        | NO       | Unix timestamp (seconds) | Primary Key (with timeframe) |
| `symbol`       | `VARCHAR(20)`   | NO       | Trading symbol           | NEW in v3.0 (e.g., "xauusd") |
| `open`         | `DECIMAL(10,5)` | NO       | Open price               | OHLC data                    |
| `high`         | `DECIMAL(10,5)` | NO       | High price               | OHLC data                    |
| `low`          | `DECIMAL(10,5)` | NO       | Low price                | OHLC data                    |
| `close`        | `DECIMAL(10,5)` | NO       | Close price              | OHLC data                    |
| `volume`       | `INTEGER`       | YES      | Tick volume              | Can be NULL                  |
| `timeframe`    | `VARCHAR(10)`   | NO       | Timeframe (M5, H1, etc.) | Primary Key (with timestamp) |
| `collected_at` | `BIGINT`        | YES      | Collection timestamp     | When data was saved          |

---

## 📈 Indicator #1: TEMA_HRMA_SMA-SMMA (3 columns) ---> PRO ONLY

**Indicator Name:** TEMA_HRMA_SMA-SMMA_Modified Buffers
**Type:** Moving Averages
**Data Pattern:** Continuous (values on every bar)

| Column Name | Data Type       | Nullable | Description                       | Buffer   | Parameters |
| ----------- | --------------- | -------- | --------------------------------- | -------- | ---------- |
| `tema`      | `DECIMAL(10,5)` | YES      | Triple Exponential Moving Average | Buffer 3 | Period: 9  |
| `hrma`      | `DECIMAL(10,5)` | YES      | Hull-like RMA                     | Buffer 2 | Period: 18 |
| `smma`      | `DECIMAL(10,5)` | YES      | Smoothed Moving Average           | Buffer 1 | Period: 36 |

**Usage:**

- Trend identification
- Support/resistance zones
- Entry/exit signals

---

## 📊 Indicator #2: Body Size Momentum (3 columns) ---> PRO ONLY

**Indicator Name:** Body Size Momentum Candle_V2 (Z-Score_OHLC_Candle_V2)
**Type:** Momentum / Volatility
**Data Pattern:** Continuous (values on every bar)

| Column Name           | Data Type       | Nullable | Description                                           | Buffer   | Parameters           |
| --------------------- | --------------- | -------- | ----------------------------------------------------- | -------- | -------------------- |
| `body_direction`      | `INTEGER`       | YES      | Candle direction: 1 (bullish), -1 (bearish), 0 (doji) | Buffer 5 | —                    |
| `body_size`           | `DECIMAL(10,5)` | YES      | Statistical Z-score of candle body size               | Buffer 6 | MA Length: 432       |
| `body_classification` | `INTEGER`       | YES      | Body size classification (0–5)                        | Buffer 4 | Thresholds: 1.5, 2.5 |

**v4.0 changes:** Column names corrected to match Prisma schema (`body_direction`, `body_size`, `body_classification`). `body_classification` is a NEW column added in v4.0 (was not in v3.0 schema).

Classification Values (0–5) for `body_classification`:
TYPE_UP_NORMAL (0) — Bullish candle with normal body size (Z-Score < 1.5)
TYPE_UP_LARGE (1) — Bullish candle with large body size (Z-Score ≥ 1.5 and < 2.5)
TYPE_UP_EXTREME (2) — Bullish candle with extreme body size (Z-Score ≥ 2.5)
TYPE_DOWN_NORMAL (3) — Bearish candle with normal body size (Z-Score < 1.5)
TYPE_DOWN_LARGE (4) — Bearish candle with large body size (Z-Score ≥ 1.5 and < 2.5)
TYPE_DOWN_EXTREME (5) — Bearish candle with extreme body size (Z-Score ≥ 2.5)

---

## 📐 Indicator #3: Fractal Diagonal Lines (8 columns) ---> FREE + PRO

**Indicator Name:** Fractal Diagonal Line_V4
**Type:** Trendlines / Support/Resistance
**Data Pattern:** Sparse (5-15% of bars have values)

### Ascending Lines (Support)

| Column Name       | Data Type       | Nullable | Description                       | Buffer   |
| ----------------- | --------------- | -------- | --------------------------------- | -------- |
| `diag_asc_line_1` | `DECIMAL(10,5)` | YES      | Primary ascending diagonal line   | Buffer 0 |
| `diag_asc_line_2` | `DECIMAL(10,5)` | YES      | Secondary ascending diagonal line | Buffer 1 |
| `diag_asc_line_3` | `DECIMAL(10,5)` | YES      | Tertiary ascending diagonal line  | Buffer 2 |

### Descending Lines (Resistance)

| Column Name        | Data Type       | Nullable | Description                        | Buffer   |
| ------------------ | --------------- | -------- | ---------------------------------- | -------- |
| `diag_desc_line_1` | `DECIMAL(10,5)` | YES      | Primary descending diagonal line   | Buffer 3 |
| `diag_desc_line_2` | `DECIMAL(10,5)` | YES      | Secondary descending diagonal line | Buffer 4 |
| `diag_desc_line_3` | `DECIMAL(10,5)` | YES      | Tertiary descending diagonal line  | Buffer 5 |

### Mapping Buffers

| Column Name     | Data Type       | Nullable | Description                        | Buffer   |
| --------------- | --------------- | -------- | ---------------------------------- | -------- |
| `diag_high_map` | `DECIMAL(10,5)` | YES      | Highest diagonal line value at bar | Buffer 6 |
| `diag_low_map`  | `DECIMAL(10,5)` | YES      | Lowest diagonal line value at bar  | Buffer 7 |

**Parameters:**

- Fractal Bars: 35
- Min Mixed Touches: 4
- Tolerance: 1.5%
- Lookback: 400 bars

**Important:** NULL values mean no line exists at that bar (0.0 → NULL)

---

## 📏 Indicator #4: Fractal Horizontal Lines (8 columns) ---> FREE + PRO

**Indicator Name:** Fractal Horizontal Line_V5
**Type:** Horizontal S/R Lines
**Data Pattern:** Sparse (5-15% of bars have values)

### Peak Lines (Resistance)

| Column Name         | Data Type       | Nullable | Description                    | Buffer   |
| ------------------- | --------------- | -------- | ------------------------------ | -------- |
| `horiz_peak_line_1` | `DECIMAL(10,5)` | YES      | Primary peak horizontal line   | Buffer 4 |
| `horiz_peak_line_2` | `DECIMAL(10,5)` | YES      | Secondary peak horizontal line | Buffer 5 |
| `horiz_peak_line_3` | `DECIMAL(10,5)` | YES      | Tertiary peak horizontal line  | Buffer 6 |

### Bottom Lines (Support)

| Column Name           | Data Type       | Nullable | Description                      | Buffer   |
| --------------------- | --------------- | -------- | -------------------------------- | -------- |
| `horiz_bottom_line_1` | `DECIMAL(10,5)` | YES      | Primary bottom horizontal line   | Buffer 7 |
| `horiz_bottom_line_2` | `DECIMAL(10,5)` | YES      | Secondary bottom horizontal line | Buffer 8 |
| `horiz_bottom_line_3` | `DECIMAL(10,5)` | YES      | Tertiary bottom horizontal line  | Buffer 9 |

### Mapping Buffers

| Column Name      | Data Type       | Nullable | Description                          | Buffer    |
| ---------------- | --------------- | -------- | ------------------------------------ | --------- |
| `horiz_high_map` | `DECIMAL(10,5)` | YES      | Highest horizontal line value at bar | Buffer 10 |
| `horiz_low_map`  | `DECIMAL(10,5)` | YES      | Lowest horizontal line value at bar  | Buffer 11 |

**Parameters:**

- Fractal Bars: 35
- Min Touches: 3
- Max Angle: 60°
- Tolerance: 1.5%

**Important:** NULL values mean no line exists at that bar (0.0 → NULL)

---

## 🕯️ Indicator #5: Heiken Ashi (8 columns) ---> PRO ONLY

**Indicator Name:** Heiken Ashi_Body Size Classification_Doji Detection (Z-Score_Heiken_Ashi)
**Type:** Smoothed Candlesticks
**Data Pattern:** Continuous (values on every bar)

### OHLC Values

| Column Name | Data Type       | Nullable | Description       | Buffer   |
| ----------- | --------------- | -------- | ----------------- | -------- |
| `ha_open`   | `DECIMAL(10,5)` | YES      | Heiken Ashi Open  | Buffer 0 |
| `ha_high`   | `DECIMAL(10,5)` | YES      | Heiken Ashi High  | Buffer 1 |
| `ha_low`    | `DECIMAL(10,5)` | YES      | Heiken Ashi Low   | Buffer 2 |
| `ha_close`  | `DECIMAL(10,5)` | YES      | Heiken Ashi Close | Buffer 3 |

### Classification & Analysis

| Column Name      | Data Type       | Nullable | Description                                                 | Buffer   |
| ---------------- | --------------- | -------- | ----------------------------------------------------------- | -------- |
| `ha_color`       | `INTEGER`       | YES      | HA candle direction: 1 (bullish), -1 (bearish)              | Buffer 4 |
| `ha_trend`       | `INTEGER`       | YES      | Consecutive streak count with sign (+N bullish, -N bearish) | Buffer 5 |
| `ha_body_size`   | `DECIMAL(10,5)` | YES      | HA candle body size (renamed from `ha_strength` in v4.0)    | Buffer 6 |
| `ha_body_zscore` | `DECIMAL(10,5)` | YES      | HA body size Z-score (NEW in v4.0)                          | Buffer 7 |

**v4.0 changes:**

- `ha_classification` (0-5 enum) → `ha_color` (1/-1 integer)
- `ha_strength` → `ha_body_size` (renamed to match MQL5 export)
- `ha_body_zscore` added as new column
- Column count: 7 → **8**

**Parameters:**

- Z-Score Length: 288
- Threshold 1 (Large): 2.0
- Threshold 2 (Extreme): 3.0

**ha_color values:** 1 = bullish (ha_classification 0/1/2), -1 = bearish (ha_classification 3/4/5)

---

## 📊 Indicator #6: Keltner Channel (10 columns) ---> PRO ONLY

**Indicator Name:** Keltner Channel ATF_10 Bands_V2
**Type:** Volatility Bands
**Data Pattern:** Continuous (values on every bar)

### Upper Resistance Bands

| Column Name              | Data Type       | Nullable | Description              | Buffer   | Multiplier     |
| ------------------------ | --------------- | -------- | ------------------------ | -------- | -------------- |
| `kc_ultra_extreme_upper` | `DECIMAL(10,5)` | YES      | Ultra extreme upper band | Buffer 0 | HRMA + 4.0×ATR |
| `kc_extreme_upper`       | `DECIMAL(10,5)` | YES      | Extreme upper band       | Buffer 1 | HRMA + 3.0×ATR |
| `kc_uppermost`           | `DECIMAL(10,5)` | YES      | Uppermost band           | Buffer 2 | HRMA + 2.0×ATR |
| `kc_upper`               | `DECIMAL(10,5)` | YES      | Primary upper band       | Buffer 3 | HRMA + 1.0×ATR |
| `kc_upper_middle`        | `DECIMAL(10,5)` | YES      | Center line (upper)      | Buffer 4 | HRMA           |

### Lower Support Bands

| Column Name              | Data Type       | Nullable | Description              | Buffer   | Multiplier     |
| ------------------------ | --------------- | -------- | ------------------------ | -------- | -------------- |
| `kc_lower_middle`        | `DECIMAL(10,5)` | YES      | Center line (lower)      | Buffer 5 | HRMA           |
| `kc_lower`               | `DECIMAL(10,5)` | YES      | Primary lower band       | Buffer 6 | HRMA - 1.0×ATR |
| `kc_lowermost`           | `DECIMAL(10,5)` | YES      | Lowermost band           | Buffer 7 | HRMA - 2.0×ATR |
| `kc_extreme_lower`       | `DECIMAL(10,5)` | YES      | Extreme lower band       | Buffer 8 | HRMA - 3.0×ATR |
| `kc_ultra_extreme_lower` | `DECIMAL(10,5)` | YES      | Ultra extreme lower band | Buffer 9 | HRMA - 4.0×ATR |

**Parameters:**

- HRMA Period: 72
- ATR Period: 162
- Timeframe: Current

**Usage:**

- Overbought/oversold detection
- Breakout identification
- Volatility measurement
- Mean reversion trading

---

## 🎯 Indicator #7: Support & Resistance (8 columns) ---> PRO ONLY

**Indicator Name:** Support and Resistant at Significant Level
**Type:** Fractal-Based S/R Levels
**Data Pattern:** Sparse (10-30% of bars have values)

### Support Levels (Below Price)

| Column Name | Data Type       | Nullable | Description                  | Buffer   | Rank                | Old Name (v3.0) |
| ----------- | --------------- | -------- | ---------------------------- | -------- | ------------------- | --------------- |
| `sr_1`      | `DECIMAL(10,5)` | YES      | Closest support level        | Buffer 3 | 1st (most relevant) | `sr_support_1`  |
| `sr_2`      | `DECIMAL(10,5)` | YES      | 2nd support level            | Buffer 2 | 2nd                 | `sr_support_2`  |
| `sr_3`      | `DECIMAL(10,5)` | YES      | 3rd support level            | Buffer 1 | 3rd                 | `sr_support_3`  |
| `sr_4`      | `DECIMAL(10,5)` | YES      | 4th support level (furthest) | Buffer 0 | 4th                 | `sr_support_4`  |

### Resistance Levels (Above Price)

| Column Name | Data Type       | Nullable | Description                     | Buffer   | Rank                | Old Name (v3.0)   |
| ----------- | --------------- | -------- | ------------------------------- | -------- | ------------------- | ----------------- |
| `sr_5`      | `DECIMAL(10,5)` | YES      | Closest resistance level        | Buffer 4 | 1st (most relevant) | `sr_resistance_1` |
| `sr_6`      | `DECIMAL(10,5)` | YES      | 2nd resistance level            | Buffer 5 | 2nd                 | `sr_resistance_2` |
| `sr_7`      | `DECIMAL(10,5)` | YES      | 3rd resistance level            | Buffer 6 | 3rd                 | `sr_resistance_3` |
| `sr_8`      | `DECIMAL(10,5)` | YES      | 4th resistance level (furthest) | Buffer 7 | 4th                 | `sr_resistance_4` |

**v4.0 change:** Renamed sr_support_1-4 → sr_1-4 and sr_resistance_1-4 → sr_5-8 to simplify schema naming.

**Parameters:**

- ATR Period: 400
- Accuracy Multiplier: 5.0
- Bars to Analyze: 400

**Important:**

- NULL values mean no level detected at that bar (0.0 → NULL)
- Levels ranked by proximity to current price
- Not all 8 levels exist on every bar (typically 2-6 levels present)

---

## ⚡ Indicator #8: ZigZag + EMA (3 columns) ---> PRO ONLY

**Indicator Name:** ZigZagColor_MarketStructure_JSON_Export_V28_SIMPLIFIED
**Type:** Market Structure + Trend
**Data Pattern:** Mixed (highs/lows sparse, EMA continuous)

| Column Name   | Data Type       | Nullable | Description                | Buffer   | Pattern               | Old Name (v3.0)   |
| ------------- | --------------- | -------- | -------------------------- | -------- | --------------------- | ----------------- |
| `zigzag_high` | `DECIMAL(10,5)` | YES      | ZigZag swing high          | Buffer 0 | Sparse (2-5% of bars) | `zigzag_peak`     |
| `zigzag_low`  | `DECIMAL(10,5)` | YES      | ZigZag swing low           | Buffer 1 | Sparse (2-5% of bars) | `zigzag_bottom`   |
| `ema`         | `DECIMAL(10,5)` | YES      | Exponential Moving Average | Buffer 4 | Period: 26            | `ema` (unchanged) |

> **v4.0 change:** `zigzag_peak` → `zigzag_high` · `zigzag_bottom` → `zigzag_low` to match Prisma schema column names.
> `ema` was renamed from `ema_26` in v3.0 and remains unchanged in v4.0.

**Parameters:**

- Depth: 12 bars
- Deviation: 5 points
- Backstep: 3 bars
- EMA Period: 26
- EMA Applied Price: Typical

**Important:**

- NULL values for peaks/bottoms mean no swing point at that bar (0.0 → NULL)
- Peaks/bottoms appear every 10-50 bars depending on volatility
- 95%+ of bars will have NULL zigzag values ✅

---

## 📈 Indicator #9: Dual TEMA High/Low (2 columns) ---> PRO ONLY ⭐ NEW in v2.0

**Indicator Name:** Dual_TEMA_High_Low
**Type:** Triple Exponential Moving Averages on High/Low
**Data Pattern:** Continuous (values on every bar)

| Column Name      | Data Type       | Nullable | Description                          | Buffer   | Parameters |
| ---------------- | --------------- | -------- | ------------------------------------ | -------- | ---------- |
| `dual_tema_high` | `DECIMAL(10,5)` | YES      | TEMA calculated on candle High price | Buffer 0 | Period: 9  |
| `dual_tema_low`  | `DECIMAL(10,5)` | YES      | TEMA calculated on candle Low price  | Buffer 1 | Period: 9  |

**Buffer Mapping:**

```
Dual_TEMA_High_Low.mq5
  Buffer 0 → TEMAHighBuffer  → dual_tema_high
  Buffer 1 → TEMALowBuffer   → dual_tema_low
  Buffers 2–7 → INDICATOR_CALCULATIONS (EMA intermediates, not collected)
```

**Usage:**

- Dynamic support (dual_tema_low) and resistance (dual_tema_high) channels
- Trend direction with High/Low bias separation
- Channel width as volatility proxy

**iCustom Parameters:**

```mql5
iCustom(sym, tf, "Dual_TEMA_High_Low",
    InpDualTEMA_Period,  // int: EMA period (default 9)
    0                    // int: Shift (default 0)
)
```

---

## 🕯️ Indicator #10: Pinbar Detection (1 column) ---> PRO ONLY ⭐ NEW in v2.0

**Indicator Name:** Pinbar Detector_Diamond Symbol_V17
**Type:** Candlestick Pattern Detection
**Data Pattern:** Sparse (only bars where a pinbar is detected)

| Column Name | Data Type | Nullable | Description                                   | Buffers Used        |
| ----------- | --------- | -------- | --------------------------------------------- | ------------------- |
| `pinbar`    | `INTEGER` | YES      | Combined pinbar flag (1 = pinbar, 0 = no pin) | Buffer 0 + Buffer 1 |

**Buffer Mapping:**

```
Pinbar Detector_Diamond Symbol_V17.mq5
  Buffer 0 → BullishPinbars[]  (arrow value if bullish pinbar, else EMPTY_VALUE/0.0)
  Buffer 1 → BearishPinbars[]  (arrow value if bearish pinbar, else EMPTY_VALUE/0.0)

Combined logic in EA:
  pinbar = 1  if (BullishPinbars[0] != EMPTY_VALUE && BullishPinbars[0] != 0.0)
               OR (BearishPinbars[0] != EMPTY_VALUE && BearishPinbars[0] != 0.0)
  pinbar = 0  otherwise
```

**CRITICAL — DisplayMode must be forced to INDICATOR_BUFFERS (0):**

```mql5
// Default DisplayMode = DRAWING_OBJECTS (1) does NOT populate CopyBuffer()
// Must override to INDICATOR_BUFFERS (0) as the 2nd iCustom parameter
iCustom(sym, tf, "Pinbar Detector_Diamond Symbol_V17",
    InpPinbar_StringencyLevel,
    0,   // ← DisplayMode = INDICATOR_BUFFERS (required for CopyBuffer to work)
    InpPinbar_CountBars,
    ...  // remaining 27 parameters
)
```

**Column Values:**

- `1`: Pinbar detected on this bar (bullish OR bearish)
- `0`: No pinbar on this bar
- `NULL`: Not yet collected / NULL in DB (maps to 0 in API response)

**Data Pattern Notes:**

- Sparse: most bars return `0` or `NULL`
- On pinbar bars: returns `1`
- Direction (bullish vs bearish) is NOT stored — only binary detection
- Store as `INTEGER` not `FLOAT` (no decimal values)

**Parameters (key settings):**

- Stringency Level: 1
- Count Bars: 500
- Use Manual Settings: true
- Min Wick Size: 0.75
- Max Body Size: 0.25
- Body Position: 0.75
- Protruding: 0.40

---

## 📊 Complete Column List (Alphabetical) — 63 Columns

| #   | Column Name              | Indicator          | Type          | Sparse/Continuous | Access         |
| --- | ------------------------ | ------------------ | ------------- | ----------------- | -------------- |
| 1   | `body_classification`    | Body Momentum      | INTEGER       | Continuous        | ---> PRO ONLY  |
| 2   | `body_direction`         | Body Momentum      | INTEGER       | Continuous        | ---> PRO ONLY  |
| 3   | `body_size`              | Body Momentum      | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 4   | `close`                  | System             | DECIMAL(10,5) | Continuous        | --> FREE + PRO |
| 5   | `collected_at`           | System             | BIGINT        | Continuous        | --> FREE + PRO |
| 6   | `diag_asc_line_1`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 7   | `diag_asc_line_2`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 8   | `diag_asc_line_3`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 9   | `diag_desc_line_1`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 10  | `diag_desc_line_2`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 11  | `diag_desc_line_3`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 12  | `diag_high_map`          | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 13  | `diag_low_map`           | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 14  | `dual_tema_high`         | Dual TEMA H/L      | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 15  | `dual_tema_low`          | Dual TEMA H/L      | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 16  | `ema`                    | ZigZag             | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 17  | `ha_body_size`           | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 18  | `ha_body_zscore`         | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 19  | `ha_close`               | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 20  | `ha_color`               | Heiken Ashi        | INTEGER       | Continuous        | ---> PRO ONLY  |
| 21  | `ha_high`                | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 22  | `ha_low`                 | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 23  | `ha_open`                | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 24  | `ha_trend`               | Heiken Ashi        | INTEGER       | Continuous        | ---> PRO ONLY  |
| 25  | `high`                   | System             | DECIMAL(10,5) | Continuous        | --> FREE + PRO |
| 26  | `horiz_bottom_line_1`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 27  | `horiz_bottom_line_2`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 28  | `horiz_bottom_line_3`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 29  | `horiz_high_map`         | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 30  | `horiz_low_map`          | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 31  | `horiz_peak_line_1`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 32  | `horiz_peak_line_2`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 33  | `horiz_peak_line_3`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 34  | `hrma`                   | Moving Averages    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 35  | `kc_extreme_lower`       | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 36  | `kc_extreme_upper`       | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 37  | `kc_lower`               | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 38  | `kc_lower_middle`        | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 39  | `kc_lowermost`           | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 40  | `kc_ultra_extreme_lower` | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 41  | `kc_ultra_extreme_upper` | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 42  | `kc_upper`               | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 43  | `kc_upper_middle`        | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 44  | `kc_uppermost`           | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 45  | `low`                    | System             | DECIMAL(10,5) | Continuous        | --> FREE + PRO |
| 46  | `open`                   | System             | DECIMAL(10,5) | Continuous        | --> FREE + PRO |
| 47  | `pinbar`                 | Pinbar Detection   | INTEGER       | Sparse            | ---> PRO ONLY  |
| 48  | `smma`                   | Moving Averages    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 49  | `sr_1`                   | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 50  | `sr_2`                   | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 51  | `sr_3`                   | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 52  | `sr_4`                   | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 53  | `sr_5`                   | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 54  | `sr_6`                   | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 55  | `sr_7`                   | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 56  | `sr_8`                   | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 57  | `symbol`                 | System             | VARCHAR(20)   | Continuous        | --> FREE + PRO |
| 58  | `tema`                   | Moving Averages    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 59  | `timeframe`              | System             | VARCHAR(10)   | Continuous        | --> FREE + PRO |
| 60  | `timestamp`              | System             | BIGINT        | Continuous        | --> FREE + PRO |
| 61  | `volume`                 | System             | INTEGER       | Continuous        | --> FREE + PRO |
| 62  | `zigzag_high`            | ZigZag             | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 63  | `zigzag_low`             | ZigZag             | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |

## 📊 Summary Statistics

### Column Distribution

| Category        | Count  | Details                                           |
| --------------- | ------ | ------------------------------------------------- |
| **Total**       | **63** | All columns in schema (was 61 in v3.0)            |
| **System**      | 9      | timestamp, symbol, OHLCV, timeframe, collected_at |
| **FREE access** | 25     | 9 system + 16 FREE indicators (unchanged)         |
| **PRO access**  | **63** | All columns (9 system + 16 FREE + 38 PRO)         |
| **FREE-only**   | 16     | Fractal Diagonal (8) + Fractal Horizontal (8)     |
| **PRO-only**    | **38** | All other indicators (was 36 in v3.0)             |

### Indicator Groups

| #   | Indicator Group    | Columns    | Type               | Access     | Change in v4.0               |
| --- | ------------------ | ---------- | ------------------ | ---------- | ---------------------------- |
| 1   | Moving Averages    | 3          | Continuous         | PRO        | Unchanged (tema, hrma, smma) |
| 2   | Body Momentum      | **3** (↑2) | Continuous         | PRO        | +body_classification         |
| 3   | Fractal Diagonal   | 8          | Sparse             | FREE + PRO | Unchanged                    |
| 4   | Fractal Horizontal | 8          | Sparse             | FREE + PRO | Unchanged                    |
| 5   | Heiken Ashi        | **8** (↑7) | Continuous         | PRO        | +ha_body_zscore, renames     |
| 6   | Keltner Channel    | 10         | Continuous         | PRO        | 10 band names corrected      |
| 7   | Support/Resistance | 8          | Sparse             | PRO        | sr_support/resistance→sr_N   |
| 8   | ZigZag             | 3          | Sparse, Continuous | PRO        | peak/bottom→high/low         |
| 9   | Dual TEMA H/L      | 2          | Continuous         | PRO        | Unchanged                    |
| 10  | Pinbar Detection   | 1          | Sparse             | PRO        | Unchanged                    |

---

**Document Version:** 4.0.0
**Last Updated:** 2026-02-24
**Replaces:** v3.0.0 (61-column schema, 2026-02-11)
**Schema Version:** EA v2.27 / Backfill Worker v4 / Prisma schema v4.0
