# FREE and PRO PLAN DATA ACCESSIBILITY

## 🔧 System Columns (8 columns) ---> FREE + PRO

| Column Name    | Data Type       | Nullable | Description              | Notes                        |
| -------------- | --------------- | -------- | ------------------------ | ---------------------------- |
| `timestamp`    | `BIGINT`        | NO       | Unix timestamp (seconds) | Primary Key (with timeframe) |
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

## 📊 Indicator #2: Body Size Momentum (2 columns) ---> PRO ONLY

**Indicator Name:** Body Size Momentum Candle_V2  
**Type:** Momentum / Volatility  
**Data Pattern:** Continuous (values on every bar)

| Column Name             | Data Type       | Nullable | Description                             | Buffer   | Parameters           |
| ----------------------- | --------------- | -------- | --------------------------------------- | -------- | -------------------- |
| `Z-Score of body size`  | `DECIMAL(10,5)` | YES      | Statistical Z-score of candle body size | Buffer 6 | MA Length: 432       |
| `Candle classification` | `INTEGER`       | YES      | Body size classification (-3 to +3)     | Buffer 4 | Thresholds: 1.5, 2.5 |

**Classification Values:**

- `-3`: Extreme bearish body
- `-2`: Large bearish body
- `-1`: Normal bearish body
- `0`: Doji / Small body
- `+1`: Normal bullish body
- `+2`: Large bullish body
- `+3`: Extreme bullish body

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

## 🕯️ Indicator #5: Heiken Ashi (7 columns) ---> PRO ONLY

**Indicator Name:** Heiken Ashi_Body Size Classification_Doji Detection  
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

| Column Name         | Data Type       | Nullable | Description                            | Buffer   |
| ------------------- | --------------- | -------- | -------------------------------------- | -------- |
| `ha_classification` | `INTEGER`       | YES      | HA body size classification (-3 to +3) | Buffer 4 |
| `ha_body_size`      | `DECIMAL(10,5)` | YES      | HA candle body size                    | Buffer 6 |
| `ha_body_zscore`    | `DECIMAL(10,5)` | YES      | HA body size Z-score                   | Buffer 7 |

**Parameters:**

- Z-Score Length: 288
- Threshold 1 (Large): 2.0
- Threshold 2 (Extreme): 3.0

**Classification Values:** Same as Body Size Momentum (-3 to +3)

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

| Column Name    | Data Type       | Nullable | Description                  | Buffer   | Rank                |
| -------------- | --------------- | -------- | ---------------------------- | -------- | ------------------- |
| `sr_support_1` | `DECIMAL(10,5)` | YES      | Closest support level        | Buffer 3 | 1st (most relevant) |
| `sr_support_2` | `DECIMAL(10,5)` | YES      | 2nd support level            | Buffer 2 | 2nd                 |
| `sr_support_3` | `DECIMAL(10,5)` | YES      | 3rd support level            | Buffer 1 | 3rd                 |
| `sr_support_4` | `DECIMAL(10,5)` | YES      | 4th support level (furthest) | Buffer 0 | 4th                 |

### Resistance Levels (Above Price)

| Column Name       | Data Type       | Nullable | Description                     | Buffer   | Rank                |
| ----------------- | --------------- | -------- | ------------------------------- | -------- | ------------------- |
| `sr_resistance_1` | `DECIMAL(10,5)` | YES      | Closest resistance level        | Buffer 4 | 1st (most relevant) |
| `sr_resistance_2` | `DECIMAL(10,5)` | YES      | 2nd resistance level            | Buffer 5 | 2nd                 |
| `sr_resistance_3` | `DECIMAL(10,5)` | YES      | 3rd resistance level            | Buffer 6 | 3rd                 |
| `sr_resistance_4` | `DECIMAL(10,5)` | YES      | 4th resistance level (furthest) | Buffer 7 | 4th                 |

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

**Indicator Name:** ZigZagColor\_\_\_MarketStructure_JSON_Export_V28_FIXED  
**Type:** Market Structure + Trend  
**Data Pattern:** Mixed (peaks/bottoms sparse, EMA continuous)

| Column Name     | Data Type       | Nullable | Description                     | Buffer   | Pattern                |
| --------------- | --------------- | -------- | ------------------------------- | -------- | ---------------------- |
| `zigzag_peak`   | `DECIMAL(10,5)` | YES      | ZigZag swing high (peak)        | Buffer 0 | Sparse (2-5% of bars)  |
| `zigzag_bottom` | `DECIMAL(10,5)` | YES      | ZigZag swing low (bottom)       | Buffer 1 | Sparse (2-5% of bars)  |
| `ema_26`        | `DECIMAL(10,5)` | YES      | Exponential Moving Average (26) | Buffer 4 | Continuous (every bar) |

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

## 📊 Complete Column List (Alphabetical)

| #   | Column Name              | Indicator          | Type          | Sparse/Continuous |
| --- | ------------------------ | ------------------ | ------------- | ----------------- | -------------- |
| 1   | `close`                  | System             | DECIMAL(10,5) | Continuous        | -->FREE + PRO  |
| 2   | `collected_at`           | System             | BIGINT        | Continuous        | --> FREE + PRO |
| 3   | `Candle classification`  | Body Momentum      | INTEGER       | Continuous        | ---> PRO ONLY  |
| 4   | `diag_asc_line_1`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 5   | `diag_asc_line_2`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 6   | `diag_asc_line_3`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 7   | `diag_desc_line_1`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 8   | `diag_desc_line_2`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 9   | `diag_desc_line_3`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 10  | `diag_high_map`          | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 11  | `diag_low_map`           | Fractal Diagonal   | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 12  | `ema_26`                 | ZigZag             | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 13  | `ha_body_size`           | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 14  | `ha_body_zscore`         | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 15  | `ha_classification`      | Heiken Ashi        | INTEGER       | Continuous        | ---> PRO ONLY  |
| 16  | `ha_close`               | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 17  | `ha_high`                | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 18  | `ha_low`                 | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 19  | `ha_open`                | Heiken Ashi        | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 20  | `high`                   | System             | DECIMAL(10,5) | Continuous        | --> FREE + PRO |
| 21  | `horiz_bottom_line_1`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 22  | `horiz_bottom_line_2`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 23  | `horiz_bottom_line_3`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 24  | `horiz_high_map`         | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 25  | `horiz_low_map`          | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 26  | `horiz_peak_line_1`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 27  | `horiz_peak_line_2`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 28  | `horiz_peak_line_3`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            | --> FREE + PRO |
| 29  | `hrma`                   | TEMA_HRMA          | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 30  | `kc_extreme_lower`       | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 31  | `kc_extreme_upper`       | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 32  | `kc_lower`               | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 33  | `kc_lower_middle`        | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 34  | `kc_lowermost`           | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 35  | `kc_ultra_extreme_lower` | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 36  | `kc_ultra_extreme_upper` | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 37  | `kc_upper`               | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 38  | `kc_upper_middle`        | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 39  | `kc_uppermost`           | Keltner Channel    | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 40  | `low`                    | System             | DECIMAL(10,5) | Continuous        | --> FREE + PRO |
| 41  | `open`                   | System             | DECIMAL(10,5) | Continuous        | --> FREE + PRO |
| 42  | `smma`                   | TEMA_HRMA          | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 43  | `sr_resistance_1`        | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 44  | `sr_resistance_2`        | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 45  | `sr_resistance_3`        | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 46  | `sr_resistance_4`        | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 47  | `sr_support_1`           | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 48  | `sr_support_2`           | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 49  | `sr_support_3`           | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 50  | `sr_support_4`           | Support/Resistance | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 51  | `tema`                   | TEMA_HRMA          | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 52  | `timeframe`              | System             | VARCHAR(10)   | Continuous        | --> FREE + PRO |
| 53  | `timestamp`              | System             | BIGINT        | Continuous        | --> FREE + PRO |
| 54  | `volume`                 | System             | INTEGER       | Continuous        | --> FREE + PRO |
| 55  | `Z-Score of body size`   | Body Momentum      | DECIMAL(10,5) | Continuous        | ---> PRO ONLY  |
| 56  | `zigzag_bottom`          | ZigZag             | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
| 57  | `zigzag_peak`            | ZigZag             | DECIMAL(10,5) | Sparse            | ---> PRO ONLY  |
