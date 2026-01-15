# Trading Data Database - Complete Column Reference

## For PostgreSQL / Prisma Schema

**Database:** Trading Alerts SaaS v2.18  
**Total Columns:** 57  
**System Columns:** 8  
**Indicator Columns:** 49  
**Date:** January 14, 2026

---

## 📊 Summary Statistics

| Category                 | Count  | Data Pattern                                 |
| ------------------------ | ------ | -------------------------------------------- |
| System Columns           | 8      | Required fields                              |
| Moving Averages          | 4      | Continuous (every bar)                       |
| Body Size/Momentum       | 2      | Continuous (every bar)                       |
| Fractal Diagonal Lines   | 8      | Sparse (5-15% of bars)                       |
| Fractal Horizontal Lines | 8      | Sparse (5-15% of bars)                       |
| Heiken Ashi              | 7      | Continuous (every bar)                       |
| Keltner Channel          | 10     | Continuous (every bar)                       |
| Support/Resistance       | 8      | Sparse (10-30% of bars)                      |
| ZigZag                   | 3      | Mixed (peaks/bottoms sparse, EMA continuous) |
| **TOTAL**                | **57** | **Mixed**                                    |

---

## 🔧 System Columns (8 columns)

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

## 📈 Indicator #1: TEMA_HRMA_SMA-SMMA (3 columns)

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

## 📊 Indicator #2: Body Size Momentum (2 columns)

**Indicator Name:** Body_Size_Momentum_Candle_V2  
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

## 📐 Indicator #3: Fractal Diagonal Lines (8 columns)

**Indicator Name:** Fractal_Diagonal_Line_V4  
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

## 📏 Indicator #4: Fractal Horizontal Lines (8 columns)

**Indicator Name:** Fractal_Horizontal_Line_V5  
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

## 🕯️ Indicator #5: Heiken Ashi (7 columns)

**Indicator Name:** Heiken_Ashi_Body_Size_Classification_Doji_Detection  
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

## 📊 Indicator #6: Keltner Channel (10 columns)

**Indicator Name:** Keltner_Channel_ATF_10_Bands_V2  
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

## 🎯 Indicator #7: Support & Resistance (8 columns)

**Indicator Name:** Support_and_Resistant_at_Significant_Level  
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

## ⚡ Indicator #8: ZigZag + EMA (3 columns)

**Indicator Name:** ZigZagColor\_\_\_MarketStructure_JSON_Export_V27_TXT_Input  
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
| --- | ------------------------ | ------------------ | ------------- | ----------------- |
| 1   | `close`                  | System             | DECIMAL(10,5) | Continuous        |
| 2   | `collected_at`           | System             | BIGINT        | Continuous        |
| 3   | `Candle classification`  | Body Momentum      | INTEGER       | Continuous        |
| 4   | `diag_asc_line_1`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            |
| 5   | `diag_asc_line_2`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            |
| 6   | `diag_asc_line_3`        | Fractal Diagonal   | DECIMAL(10,5) | Sparse            |
| 7   | `diag_desc_line_1`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            |
| 8   | `diag_desc_line_2`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            |
| 9   | `diag_desc_line_3`       | Fractal Diagonal   | DECIMAL(10,5) | Sparse            |
| 10  | `diag_high_map`          | Fractal Diagonal   | DECIMAL(10,5) | Sparse            |
| 11  | `diag_low_map`           | Fractal Diagonal   | DECIMAL(10,5) | Sparse            |
| 12  | `ema_26`                 | ZigZag             | DECIMAL(10,5) | Continuous        |
| 13  | `ha_body_size`           | Heiken Ashi        | DECIMAL(10,5) | Continuous        |
| 14  | `ha_body_zscore`         | Heiken Ashi        | DECIMAL(10,5) | Continuous        |
| 15  | `ha_classification`      | Heiken Ashi        | INTEGER       | Continuous        |
| 16  | `ha_close`               | Heiken Ashi        | DECIMAL(10,5) | Continuous        |
| 17  | `ha_high`                | Heiken Ashi        | DECIMAL(10,5) | Continuous        |
| 18  | `ha_low`                 | Heiken Ashi        | DECIMAL(10,5) | Continuous        |
| 19  | `ha_open`                | Heiken Ashi        | DECIMAL(10,5) | Continuous        |
| 20  | `high`                   | System             | DECIMAL(10,5) | Continuous        |
| 21  | `horiz_bottom_line_1`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            |
| 22  | `horiz_bottom_line_2`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            |
| 23  | `horiz_bottom_line_3`    | Fractal Horizontal | DECIMAL(10,5) | Sparse            |
| 24  | `horiz_high_map`         | Fractal Horizontal | DECIMAL(10,5) | Sparse            |
| 25  | `horiz_low_map`          | Fractal Horizontal | DECIMAL(10,5) | Sparse            |
| 26  | `horiz_peak_line_1`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            |
| 27  | `horiz_peak_line_2`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            |
| 28  | `horiz_peak_line_3`      | Fractal Horizontal | DECIMAL(10,5) | Sparse            |
| 29  | `hrma`                   | TEMA_HRMA          | DECIMAL(10,5) | Continuous        |
| 30  | `kc_extreme_lower`       | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 31  | `kc_extreme_upper`       | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 32  | `kc_lower`               | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 33  | `kc_lower_middle`        | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 34  | `kc_lowermost`           | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 35  | `kc_ultra_extreme_lower` | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 36  | `kc_ultra_extreme_upper` | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 37  | `kc_upper`               | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 38  | `kc_upper_middle`        | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 39  | `kc_uppermost`           | Keltner Channel    | DECIMAL(10,5) | Continuous        |
| 40  | `low`                    | System             | DECIMAL(10,5) | Continuous        |
| 41  | `open`                   | System             | DECIMAL(10,5) | Continuous        |
| 42  | `smma`                   | TEMA_HRMA          | DECIMAL(10,5) | Continuous        |
| 43  | `sr_resistance_1`        | Support/Resistance | DECIMAL(10,5) | Sparse            |
| 44  | `sr_resistance_2`        | Support/Resistance | DECIMAL(10,5) | Sparse            |
| 45  | `sr_resistance_3`        | Support/Resistance | DECIMAL(10,5) | Sparse            |
| 46  | `sr_resistance_4`        | Support/Resistance | DECIMAL(10,5) | Sparse            |
| 47  | `sr_support_1`           | Support/Resistance | DECIMAL(10,5) | Sparse            |
| 48  | `sr_support_2`           | Support/Resistance | DECIMAL(10,5) | Sparse            |
| 49  | `sr_support_3`           | Support/Resistance | DECIMAL(10,5) | Sparse            |
| 50  | `sr_support_4`           | Support/Resistance | DECIMAL(10,5) | Sparse            |
| 51  | `tema`                   | TEMA_HRMA          | DECIMAL(10,5) | Continuous        |
| 52  | `timeframe`              | System             | VARCHAR(10)   | Continuous        |
| 53  | `timestamp`              | System             | BIGINT        | Continuous        |
| 54  | `volume`                 | System             | INTEGER       | Continuous        |
| 55  | `Z-Score of body size`   | Body Momentum      | DECIMAL(10,5) | Continuous        |
| 56  | `zigzag_bottom`          | ZigZag             | DECIMAL(10,5) | Sparse            |
| 57  | `zigzag_peak`            | ZigZag             | DECIMAL(10,5) | Sparse            |

---

## 🔧 Prisma Schema Example

```prisma
model TradingData {
  // Composite Primary Key
  timestamp  BigInt
  timeframe  String   @db.VarChar(10)

  // OHLC System Fields
  open       Decimal  @db.Decimal(10, 5)
  high       Decimal  @db.Decimal(10, 5)
  low        Decimal  @db.Decimal(10, 5)
  close      Decimal  @db.Decimal(10, 5)
  volume     Int?
  collected_at BigInt?

  // Indicator #1: TEMA_HRMA_SMA-SMMA
  tema       Decimal? @db.Decimal(10, 5)
  hrma       Decimal? @db.Decimal(10, 5)
  smma       Decimal? @db.Decimal(10, 5)

  // Indicator #2: Body Size Momentum
  z_score_of_body_size  Decimal? @db.Decimal(10, 5) @map("Z-Score of body size")
  candle_classification Int?     @map("Candle classification")

  // Indicator #3: Fractal Diagonal Lines
  diag_asc_line_1  Decimal? @db.Decimal(10, 5)
  diag_asc_line_2  Decimal? @db.Decimal(10, 5)
  diag_asc_line_3  Decimal? @db.Decimal(10, 5)
  diag_desc_line_1 Decimal? @db.Decimal(10, 5)
  diag_desc_line_2 Decimal? @db.Decimal(10, 5)
  diag_desc_line_3 Decimal? @db.Decimal(10, 5)
  diag_high_map    Decimal? @db.Decimal(10, 5)
  diag_low_map     Decimal? @db.Decimal(10, 5)

  // Indicator #4: Fractal Horizontal Lines
  horiz_peak_line_1   Decimal? @db.Decimal(10, 5)
  horiz_peak_line_2   Decimal? @db.Decimal(10, 5)
  horiz_peak_line_3   Decimal? @db.Decimal(10, 5)
  horiz_bottom_line_1 Decimal? @db.Decimal(10, 5)
  horiz_bottom_line_2 Decimal? @db.Decimal(10, 5)
  horiz_bottom_line_3 Decimal? @db.Decimal(10, 5)
  horiz_high_map      Decimal? @db.Decimal(10, 5)
  horiz_low_map       Decimal? @db.Decimal(10, 5)

  // Indicator #5: Heiken Ashi
  ha_open           Decimal? @db.Decimal(10, 5)
  ha_high           Decimal? @db.Decimal(10, 5)
  ha_low            Decimal? @db.Decimal(10, 5)
  ha_close          Decimal? @db.Decimal(10, 5)
  ha_classification Int?
  ha_body_size      Decimal? @db.Decimal(10, 5)
  ha_body_zscore    Decimal? @db.Decimal(10, 5)

  // Indicator #6: Keltner Channel
  kc_ultra_extreme_upper Decimal? @db.Decimal(10, 5)
  kc_extreme_upper       Decimal? @db.Decimal(10, 5)
  kc_uppermost           Decimal? @db.Decimal(10, 5)
  kc_upper               Decimal? @db.Decimal(10, 5)
  kc_upper_middle        Decimal? @db.Decimal(10, 5)
  kc_lower_middle        Decimal? @db.Decimal(10, 5)
  kc_lower               Decimal? @db.Decimal(10, 5)
  kc_lowermost           Decimal? @db.Decimal(10, 5)
  kc_extreme_lower       Decimal? @db.Decimal(10, 5)
  kc_ultra_extreme_lower Decimal? @db.Decimal(10, 5)

  // Indicator #7: Support/Resistance
  sr_support_4    Decimal? @db.Decimal(10, 5)
  sr_support_3    Decimal? @db.Decimal(10, 5)
  sr_support_2    Decimal? @db.Decimal(10, 5)
  sr_support_1    Decimal? @db.Decimal(10, 5)
  sr_resistance_1 Decimal? @db.Decimal(10, 5)
  sr_resistance_2 Decimal? @db.Decimal(10, 5)
  sr_resistance_3 Decimal? @db.Decimal(10, 5)
  sr_resistance_4 Decimal? @db.Decimal(10, 5)

  // Indicator #8: ZigZag + EMA
  zigzag_peak   Decimal? @db.Decimal(10, 5)
  zigzag_bottom Decimal? @db.Decimal(10, 5)
  ema_26        Decimal? @db.Decimal(10, 5)

  @@id([timestamp, timeframe])
  @@index([timeframe, timestamp])
  @@map("eurusd")
}
```

---

## 💡 Important Notes for Prisma

### 1. **Column Name Mapping**

Some columns have special characters that need mapping:

```prisma
z_score_of_body_size  Decimal? @map("Z-Score of body size")
candle_classification Int?     @map("Candle classification")
```

### 2. **Nullable Fields**

- All indicator columns are nullable (`?`)
- Only system OHLC fields are required (NOT NULL)

### 3. **Composite Primary Key**

```prisma
@@id([timestamp, timeframe])
```

### 4. **Indexes**

```prisma
@@index([timeframe, timestamp])  // For time-series queries
```

### 5. **Table Naming**

```prisma
@@map("eurusd")  // Maps to actual table name
```

### 6. **Decimal Precision**

All prices use `DECIMAL(10, 5)`:

- 10 total digits
- 5 decimal places
- Range: -99999.99999 to +99999.99999

---

## 📊 Data Volume Estimates

### Per Symbol

- **Rows per timeframe:** 500 bars
- **Timeframes:** 9 (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- **Total rows per symbol:** 4,500 rows
- **Storage per symbol:** ~1.5 MB

### Database Growth (Daily)

- **New bars per day (H1):** ~24 bars
- **New bars per day (all timeframes):** ~200 bars
- **Daily growth:** ~70 KB per symbol

### Continuous Collection (30 seconds)

- **Updates per hour:** 120 updates
- **Updates per day:** 2,880 updates
- **Database writes:** INSERT OR REPLACE (upsert)

---

## 🔍 Query Optimization Tips

### 1. **Always Include Timeframe Filter**

```sql
WHERE timeframe = 'H1'  -- Use index
```

### 2. **Use Timestamp Range Queries**

```sql
WHERE timestamp BETWEEN start_time AND end_time
```

### 3. **Filter NULL Values for Sparse Data**

```sql
WHERE zigzag_peak IS NOT NULL  -- Only get swing points
```

### 4. **Create Composite Indexes**

```sql
CREATE INDEX idx_timeframe_timestamp ON eurusd(timeframe, timestamp DESC);
```

### 5. **Separate Queries for Sparse Data**

Don't fetch all 57 columns if you only need sparse data:

```sql
-- Efficient: Only fetch ZigZag data
SELECT timestamp, zigzag_peak, zigzag_bottom
FROM eurusd
WHERE timeframe = 'H1'
  AND (zigzag_peak IS NOT NULL OR zigzag_bottom IS NOT NULL);
```

---

## ✅ Validation Checklist

- [ ] All 57 columns defined in Prisma schema
- [ ] Composite primary key set (timestamp, timeframe)
- [ ] Indexes created for time-series queries
- [ ] Nullable fields properly marked
- [ ] Column name mapping for special characters
- [ ] Decimal precision set to (10, 5)
- [ ] Table name mapped to correct SQLite table
- [ ] Migration tested on development database
- [ ] Query performance tested with 4,500+ rows

---

## 📚 Related Documentation

- **Modification Summaries:** MODIFICATION_SUMMARY_IndicatorFile1-7.md
- **API Integration:** Complete Next.js code provided in previous response
- **TradingView Charts:** Lightweight Charts integration examples
- **MT5 EA:** SimpleDataCollector_Modified_v2.18.mq5

---

**Document Version:** 1.0  
**Last Updated:** January 14, 2026  
**Database Version:** v2.18 (500 bars per timeframe)

---

## 🎯 Quick Reference

**Total Columns:** 57  
**System:** 8 columns  
**Indicators:** 49 columns  
**Continuous Data:** 30 columns (every bar has value)  
**Sparse Data:** 19 columns (5-30% of bars have values)  
**Primary Key:** (timestamp, timeframe)  
**Storage:** ~1.5 MB per symbol  
**Capacity Used:** 2.85% of SQLite limit (1,943 columns remaining)

---

**End of Document** ✅
