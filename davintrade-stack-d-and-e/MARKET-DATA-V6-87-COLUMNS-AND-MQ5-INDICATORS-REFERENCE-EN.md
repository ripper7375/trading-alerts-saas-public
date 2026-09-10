# DavinTrade Architecture Reference: 87 Columns in `market_data_v6` & MQL5 Indicator Suite

**Document Version:** 1.1.0  
**Document Code:** `MARKET-DATA-V6-79-COLUMNS-AND-MQ5-INDICATORS-REFERENCE-EN.md` _(Upgraded to 87 Columns)_  
**Target Scope:** `XAUUSD` on `M5` and `M15` Timeframes  
**System Layer:** Data Pipeline (Stack C) ➔ PostgreSQL Datastore ➔ Conversational AI Co-Pilot (Stack D & E)  
**Last Updated:** 2026-09-05 _(Reflecting 2026-09-03 `best_fit` isolated-coexistence split into `best_fit_a` & `best_fit_b`)_

---

## 📌 1. Executive Summary & Data Pipeline Architecture

The `market_data_v6` database table (hosted on PostgreSQL via Railway and SQLite on Contabo VPS) serves as the **Single Source of Truth (SSOT)** for all quantitative technical analysis across the DavinTrade platform. This table consolidates raw candlestick data (OHLCV) alongside advanced mathematical and statistical indicators (7 Centroid Regression variants, Singular Spectrum Analysis [SSA], Fractal Support/Resistance lines, Z-Score Candle Volatility, and ZigZag Market Structure metrics), comprising **87 columns** in total _(upgraded from the previous 79-column schema following the 2026-09-03 migration splitting `best_fit` into `best_fit_a` and `best_fit_b`)_.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              END-TO-END DATA GENERATION & STORAGE PIPELINE                             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. MT5 Terminal (Contabo VPS)                                                                          │
│    • 13 MQL5 Indicators export raw calculations every 5 minutes at second :59                         │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 2. SQLite Ingestion & Python Calc Stack                                                                 │
│    • Ingests Admin Layer (OHLCV, Crossovers, Fractals, ZigZag Pivots) into SQLite staging              │
│    • Python Calc Modules (`centroid_regression.py`, `fractal_lines.py`, `zscore_candle.py`,           │
│      `zigzag_metrics.py`) calculate derived lines and statistical classifications                      │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 3. Push Worker ➔ Railway Gateway (NestJS)                                                              │
│    • Idempotent UPSERT on `(symbol, timeframe, timestamp)`                                            │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 4. PostgreSQL `market_data_v6` (Wide Table: 87 Columns)                                                │
│    • Serves as the quantitative foundation for:                                                        │
│      - Engine 1 (VANNA NL2SQL)                                                                         │
│      - Engine 1.5A (MCD01-MCD10+ Discrete States & FREQ54 Signal Density)                              │
│      - Engine 1.5B (JSONB54 Deduplicated Storyline Narrative)                                          │
│      - Engine 1.5C (WACS54 Weighted Confluence Score)                                                  │
│      - Engine 2 (Multimodal Synthesis & Rules Engine)                                                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Overview of the 13 MQL5 Indicators (Exporting Raw Calculations Every 5 Minutes at Second :59)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MQL5 INDICATOR SUITE ARCHITECTURE OVERVIEW                             │
├────┬─────────────────────────────────────────────────┬──────────────────────────────────────────────────┤
│ #  │ MQL5 Indicator Filename                         │ Mathematical / Statistical Function & Role       │
├────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 1  │ `ohlcvexportlightweight_v2_29.mq5`              │ Exports 3,000-bar OHLCV history with time grid   │
│ 2  │ `2EDTCentroidRegressionBestFitNonMostRecentA...`│ Best-Fit A (Primary): SSA (30,6,3), DBSCAN,      │
│    │                                                 │ WLS (Lambda=0.000, Exclude=0), 2EDT Channels     │
│ 3  │ `2EDTCentroidRegressionBestFitNonMostRecentB...`│ Best-Fit B (Secondary): SSA (30,6,3), DBSCAN,    │
│    │                                                 │ WLS (Lambda=0.000, Exclude=3 recent centroids),  │
│    │                                                 │ runs in isolated coexistence on the same chart   │
│ 4  │ `2EDTCentroidRegressionCherryPickA_v2_29.mq5`   │ Centroid Regression via OLS (Cherry-Pick Set A)  │
│ 5  │ `2EDTCentroidRegressionCherryPickB_v2_29.mq5`   │ Centroid Regression via OLS (Cherry-Pick Set B)  │
│ 6  │ `2EDTCentroidRegressionMostRecentLineExt...`    │ Centroid Regression via OLS (N Most Recent)      │
│ 7  │ `2EDTCentroidRegressionNonMostRecentLineExtA...`│ Centroid Regression via OLS (Excludes Recent A)  │
│ 8  │ `2EDTCentroidRegressionNonMostRecentLineExtB...`│ Centroid Regression via OLS (Excludes Recent B)  │
│ 9  │ `2EDTFractalBestFitv5_v2_29.mq5`                │ Best S&R Flip Line + Fractal 2EDT Channels       │
│ 10 │ `SingleBestResistanceLinev3_v2_29.mq5`          │ Single Best Resistance Line from Upper Fractals  │
│ 11 │ `SingleBestSupportLinev3_v2_29.mq5`             │ Single Best Support Line from Lower Fractals     │
│ 12 │ `ZigZagExportv43_v2_29.mq5`                     │ ZigZag (12,5,3), Structure (HH/HL/LH/LL/EQ),     │
│    │                                                 │ Rolling Z-Score 50 Segments (%Chg, Bar, Speed)   │
│ 13 │ `zscoreohlccandleexport_v2_29.mq5`              │ Candle Body Z-Score (Window 432, Z1=1.5, Z2=2.5) │
│    │                                                 │ Direction & Classification Enum (Codes 0 to 5)   │
└────┴─────────────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

## 📊 2. High-Level Classification Matrix (12 Groups / 87 Columns Total)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MARKET_DATA_V6 87 COLUMNS CLASSIFICATION                               │
├────┬───────────────────────────────────────┬─────────┬──────────────┬──────────────────────────────────┤
│ #  │ Category                              │ Count   │ Column Span  │ Role & Data Origin               │
├────┼───────────────────────────────────────┼─────────┼──────────────┼──────────────────────────────────┤
│ 1  │ Base OHLCV & Timeframe Grid           │ 8       │ Cols 1 – 8   │ MQL5 Admin Layer (Price Spine)   │
│ 2  │ Centroid Variant 1: `best_fit_a`      │ 8       │ Cols 9 – 16  │ Primary Best-Fit (Exclude=0)     │
│ 3  │ Centroid Variant 2: `best_fit_b`      │ 8       │ Cols 17 – 24 │ Secondary Best-Fit (Exclude=3)   │
│ 4  │ Centroid Variant 3: `cherry_a`        │ 8       │ Cols 25 – 32 │ OLS on Cherry-Picked Set A       │
│ 5  │ Centroid Variant 4: `cherry_b`        │ 8       │ Cols 33 – 40 │ OLS on Cherry-Picked Set B       │
│ 6  │ Centroid Variant 5: `most_recent`     │ 8       │ Cols 41 – 48 │ OLS on N Most Recent Centroids   │
│ 7  │ Centroid Variant 6: `non_a`           │ 8       │ Cols 49 – 56 │ OLS Excluding Recent Box A       │
│ 8  │ Centroid Variant 7: `non_b`           │ 8       │ Cols 57 – 64 │ OLS Excluding Recent Box B       │
│ 9  │ Fractal Lines & Support/Resistance    │ 5       │ Cols 65 – 69 │ Python `fractal_lines.py`        │
│ 10 │ Z-Score Candle Volatility             │ 3       │ Cols 70 – 72 │ Python `zscore_candle.py`        │
│ 11 │ ZigZag Market Structure & Metrics     │ 11      │ Cols 73 – 83 │ MQL5 Pivot + Python `zigzag.py`  │
│ 12 │ Provenance & Pipeline Metadata        │ 4       │ Cols 84 – 87 │ Ingestion & Audit Sync Systems   │
├────┴───────────────────────────────────────┴─────────┴──────────────┴──────────────────────────────────┤
│    Total                                   │ 87 Cols │ Cols 1 – 87  │ (79 original + 8 for Best-Fit B) │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 3. Column-by-Column Data Dictionary (Columns 1 – 87)

### Group 1: Base OHLCV & Timeframe Grid (Columns 1 – 8)

_Role: Core chronological and price spine aligned to standardized M5 (300-second) or M15 (900-second) bar boundaries._

| #   | Column Name     | Data Type | Origin           | Mathematical & Functional Description                                               |
| :-- | :-------------- | :-------- | :--------------- | :---------------------------------------------------------------------------------- |
| 1   | **`timestamp`** | `INTEGER` | MQL5 (Adjusted)  | Bar open timestamp in UTC Unix seconds, rounded to the exact bar boundary (M5/M15). |
| 2   | **`symbol`**    | `TEXT`    | Static           | Financial asset symbol, strictly locked to `'XAUUSD'` (Gold).                       |
| 3   | **`timeframe`** | `TEXT`    | MQL5             | Chart timeframe, locked to `'M5'` (Micro Execution) or `'M15'` (Macro Structure).   |
| 4   | **`open`**      | `DOUBLE`  | MQL5 `raw_ohlcv` | Opening price of the bar in USD per troy ounce.                                     |
| 5   | **`high`**      | `DOUBLE`  | MQL5 `raw_ohlcv` | Highest price achieved during the bar in USD per troy ounce.                        |
| 6   | **`low`**       | `DOUBLE`  | MQL5 `raw_ohlcv` | Lowest price reached during the bar in USD per troy ounce.                          |
| 7   | **`close`**     | `DOUBLE`  | MQL5 `raw_ohlcv` | Closing price of the bar in USD per troy ounce.                                     |
| 8   | **`volume`**    | `INTEGER` | MQL5 `raw_ohlcv` | Tick volume recorded during the bar interval.                                       |

---

### Groups 2 to 8: Centroid Regression 7 Variants (Columns 9 – 64)

_Underlying Methodology: Each variant extracts Singular Spectrum Analysis (SSA Window=30, Rank=6) and identifies crossover points of SSA against its EMA signal line (Signal=3). These crossover points are grouped into clusters (Centroids) via clustering algorithms to fit the baseline (Base_FL) and construct equidistant trendlines (UOEDT, LOEDT)._

#### 🔹 Centroid Variant 1: `best_fit_a` (Columns 9 – 16)

_Primary Instance: Configuration-identical to the former single `best_fit` variant (lossless rename in PostgreSQL); parameters `InpRegCentroids=5`, `InpExcludeRecentCentroids=0`, `InpTimeDecayLambda=0.000` (equal-weighting across all bars), and `MinTouches=2`. Includes all recent centroids without exclusion._

| #   | Column Name                     | Data Type | Origin           | Mathematical & Functional Description                                                                 |
| :-- | :------------------------------ | :-------- | :--------------- | :---------------------------------------------------------------------------------------------------- |
| 9   | **`best_fit_a_horiz_high_map`** | `DOUBLE`  | MQL5 Admin Layer | Highest peak fractal level of the active cycle (Upper Fractal Map Symbol 108).                        |
| 10  | **`best_fit_a_horiz_low_map`**  | `DOUBLE`  | MQL5 Admin Layer | Lowest valley fractal level of the active cycle (Lower Fractal Map Symbol 108).                       |
| 11  | **`best_fit_a_ssa`**            | `DOUBLE`  | MQL5 Admin Layer | Smoothed trendline derived from Singular Spectrum Analysis (SSA), filtering out high-frequency noise. |
| 12  | **`best_fit_a_ema_ssa`**        | `DOUBLE`  | MQL5 Admin Layer | Exponential Moving Average of the SSA trendline, serving as a directional trigger line.               |
| 13  | **`best_fit_a_crossing`**       | `INTEGER` | MQL5 Admin Layer | Crossover event flag ($1$ = crossover occurred on this bar, $0$ or `NULL` = no crossover).            |
| 14  | **`best_fit_a_base_fl`**        | `DOUBLE`  | Python Calc      | Centroid Flip Line (Base_FL / Baseline) computed via optimal WLS regression.                          |
| 15  | **`best_fit_a_uoedt`**          | `DOUBLE`  | Python Calc      | Upper Outermost Equidistant Trendline (UOEDT) — dynamic resistance / overbought boundary.             |
| 16  | **`best_fit_a_loedt`**          | `DOUBLE`  | Python Calc      | Lower Outermost Equidistant Trendline (LOEDT) — dynamic support / oversold boundary.                  |

#### 🔹 Centroid Variant 2: `best_fit_b` (Columns 17 – 24)

_Secondary Instance: Introduced on 2026-09-03; parameters `InpRegCentroids=5`, `InpExcludeRecentCentroids=3`, `InpTimeDecayLambda=0.000`, and `MinTouches=2`. Intentionally excludes the 3 most recent centroids to capture persistent structural trend without being biased by active short-term swings._

| #   | Column Name                     | Data Type | Origin           | Mathematical & Functional Description                         |
| :-- | :------------------------------ | :-------- | :--------------- | :------------------------------------------------------------ |
| 17  | **`best_fit_b_horiz_high_map`** | `DOUBLE`  | MQL5 Admin Layer | Highest peak fractal level for the Best-Fit B variant.        |
| 18  | **`best_fit_b_horiz_low_map`**  | `DOUBLE`  | MQL5 Admin Layer | Lowest valley fractal level for the Best-Fit B variant.       |
| 19  | **`best_fit_b_ssa`**            | `DOUBLE`  | MQL5 Admin Layer | Smoothed SSA trendline for Best-Fit B.                        |
| 20  | **`best_fit_b_ema_ssa`**        | `DOUBLE`  | MQL5 Admin Layer | Exponential Moving Average of SSA for Best-Fit B.             |
| 21  | **`best_fit_b_crossing`**       | `INTEGER` | MQL5 Admin Layer | Crossover flag for Best-Fit B ($1$ or $0$/`NULL`).            |
| 22  | **`best_fit_b_base_fl`**        | `DOUBLE`  | Python Calc      | Baseline (Base_FL) computed excluding the 3 newest centroids. |
| 23  | **`best_fit_b_uoedt`**          | `DOUBLE`  | Python Calc      | Upper Outermost EDT channel for Best-Fit B.                   |
| 24  | **`best_fit_b_loedt`**          | `DOUBLE`  | Python Calc      | Lower Outermost EDT channel for Best-Fit B.                   |

#### 🔹 Centroid Variant 3: `cherry_a` (Columns 25 – 32)

_Ordinary Least Squares (OLS) regression fitted across Cherry-Picked Centroid Set A._

- **25. `cherry_a_horiz_high_map`**, **26. `cherry_a_horiz_low_map`** _(DOUBLE - MQL5)_
- **27. `cherry_a_ssa`**, **28. `cherry_a_ema_ssa`** _(DOUBLE - MQL5)_
- **29. `cherry_a_crossing`** _(INTEGER - MQL5)_
- **30. `cherry_a_base_fl`**, **31. `cherry_a_uoedt`**, **32. `cherry_a_loedt`** _(DOUBLE - Python)_

#### 🔹 Centroid Variant 4: `cherry_b` (Columns 33 – 40)

_Ordinary Least Squares (OLS) regression fitted across Cherry-Picked Centroid Set B._

- **33. `cherry_b_horiz_high_map`**, **34. `cherry_b_horiz_low_map`** _(DOUBLE - MQL5)_
- **35. `cherry_b_ssa`**, **36. `cherry_b_ema_ssa`** _(DOUBLE - MQL5)_
- **37. `cherry_b_crossing`** _(INTEGER - MQL5)_
- **38. `cherry_b_base_fl`**, **39. `cherry_b_uoedt`**, **40. `cherry_b_loedt`** _(DOUBLE - Python)_

#### 🔹 Centroid Variant 5: `most_recent` (Columns 41 – 48)

_Ordinary Least Squares (OLS) regression anchored to the $N$ most recent centroids to track immediate momentum._

- **41. `most_recent_horiz_high_map`**, **42. `most_recent_horiz_low_map`** _(DOUBLE - MQL5)_
- **43. `most_recent_ssa`**, **44. `most_recent_ema_ssa`** _(DOUBLE - MQL5)_
- **45. `most_recent_crossing`** _(INTEGER - MQL5)_
- **46. `most_recent_base_fl`**, **47. `most_recent_uoedt`**, **48. `most_recent_loedt`** _(DOUBLE - Python)_

#### 🔹 Centroid Variant 6: `non_a` (Columns 49 – 56)

_Ordinary Least Squares (OLS) regression excluding recent Box A centroids to reveal underlying structural trend without recent noise._

- **49. `non_a_horiz_high_map`**, **50. `non_a_horiz_low_map`** _(DOUBLE - MQL5)_
- **51. `non_a_ssa`**, **52. `non_a_ema_ssa`** _(DOUBLE - MQL5)_
- **53. `non_a_crossing`** _(INTEGER - MQL5)_
- **54. `non_a_base_fl`**, **55. `non_a_uoedt`**, **56. `non_a_loedt`** _(DOUBLE - Python)_

#### 🔹 Centroid Variant 7: `non_b` (Columns 57 – 64)

_Ordinary Least Squares (OLS) regression excluding recent Box B centroids._

- **57. `non_b_horiz_high_map`**, **58. `non_b_horiz_low_map`** _(DOUBLE - MQL5)_
- **59. `non_b_ssa`**, **60. `non_b_ema_ssa`** _(DOUBLE - MQL5)_
- **61. `non_b_crossing`** _(INTEGER - MQL5)_
- **62. `non_b_base_fl`**, **63. `non_b_uoedt`**, **64. `non_b_loedt`** _(DOUBLE - Python)_

---

### Group 9: Fractal Trendlines & Best Support / Resistance (Columns 65 – 69)

_Role: Geometric trendlines and support/resistance boundaries optimized for maximum touch confirmation._

| #   | Column Name           | Data Type | Origin                    | Mathematical & Functional Description                                                        |
| :-- | :-------------------- | :-------- | :------------------------ | :------------------------------------------------------------------------------------------- |
| 65  | **`fractal_best_fl`** | `DOUBLE`  | Python `fractal_lines.py` | Centroid Flip Line fitted across upper peaks and lower bottoms with the highest touch score. |
| 66  | **`fractal_uoedt`**   | `DOUBLE`  | Python `fractal_lines.py` | Upper Outermost Equidistant Trendline parallel to Fractal Best FL.                           |
| 67  | **`fractal_loedt`**   | `DOUBLE`  | Python `fractal_lines.py` | Lower Outermost Equidistant Trendline parallel to Fractal Best FL.                           |
| 68  | **`best_resistance`** | `DOUBLE`  | Python `fractal_lines.py` | Single Best Resistance Line fitted across Upper Fractals maximizing touch count and span.    |
| 69  | **`best_support`**    | `DOUBLE`  | Python `fractal_lines.py` | Single Best Support Line fitted across Lower Fractals maximizing touch count and span.       |

---

### Group 10: Z-Score Candle Volatility (Columns 70 – 72)

_Role: Volatility expansion and compression classification relative to a 432-bar rolling sample._

| #   | Column Name               | Data Type | Origin                    | Mathematical & Functional Description                                                                                                                                                                                                                                                                                                                                                                                                     |
| :-- | :------------------------ | :-------- | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 70  | **`body_direction`**      | `INTEGER` | Python `zscore_candle.py` | Direction of the candlestick: $+1$ (Bullish / Close > Open), $-1$ (Bearish / Close < Open), $0$ (Doji / Close = Open).                                                                                                                                                                                                                                                                                                                    |
| 71  | **`body_size`**           | `DOUBLE`  | Python `zscore_candle.py` | Absolute body size Z-score: $\|Z\| = \frac{\|C - O\| - \mu}{\sigma}$ relative to the rolling 432-bar sample.                                                                                                                                                                                                                                                                                                                              |
| 72  | **`body_classification`** | `INTEGER` | Python `zscore_candle.py` | Candle classification code (Enum 0 to 5):<br>• `0`: UP_NORMAL ($\|Z\| < 1.5$, Bullish)<br>• `1`: UP_LARGE ($1.5 \le \|Z\| < 2.5$, Elevated Bullish Expansion)<br>• `2`: UP_EXTREME ($\|Z\| \ge 2.5$, Extreme Bullish Volatility Spike)<br>• `3`: DOWN_NORMAL ($\|Z\| < 1.5$, Bearish)<br>• `4`: DOWN_LARGE ($1.5 \le \|Z\| < 2.5$, Elevated Bearish Expansion)<br>• `5`: DOWN_EXTREME ($\|Z\| \ge 2.5$, Extreme Bearish Volatility Spike) |

---

### Group 11: ZigZag Market Structure & Metrics (Columns 73 – 83)

_Role: Captures Price Action and Smart Money Market Structure. Non-pivot bars contain `NULL`; values populate strictly on confirmed pivot bars._

| #   | Column Name                      | Data Type | Origin                     | Mathematical & Functional Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :-- | :------------------------------- | :-------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 73  | **`zigzag_point_type`**          | `TEXT`    | MQL5 `ZigZagExport`        | Pivot point type: `'Peak'` (Swing High) or `'Bottom'` (Swing Low).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 74  | **`zigzag_current_point`**       | `DOUBLE`  | MQL5 `ZigZagExport`        | Confirmed pivot price level in USD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 75  | **`zigzag_price_change`**        | `DOUBLE`  | Python `zigzag_metrics.py` | Dollar price difference from the preceding pivot ($\Delta P = P_{\text{current}} - P_{\text{previous}}$).                                                                                                                                                                                                                                                                                                                                                                                            |
| 76  | **`zigzag_pct_change`**          | `DOUBLE`  | Python `zigzag_metrics.py` | Percentage price move from the preceding pivot ($\% \Delta P = \frac{\Delta P}{P_{\text{previous}}} \times 100$).                                                                                                                                                                                                                                                                                                                                                                                    |
| 77  | **`zigzag_pct_change_class`**    | `INTEGER` | Python `zigzag_metrics.py` | Z-score classification of percentage price change ($0\text{--}2$ Bullish, $3\text{--}5$ Bearish).                                                                                                                                                                                                                                                                                                                                                                                                    |
| 78  | **`zigzag_bars`**                | `INTEGER` | Python `zigzag_metrics.py` | Number of elapsed bars in the current ZigZag leg (Wave Duration).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 79  | **`zigzag_bars_class`**          | `INTEGER` | Python `zigzag_metrics.py` | Z-score classification of the leg duration ($0\text{--}5$).                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 80  | **`zigzag_price_per_bar`**       | `DOUBLE`  | Python `zigzag_metrics.py` | Price velocity per bar ($\text{Velocity} = \frac{\|\Delta P\|}{\text{Bars}}$).                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 81  | **`zigzag_price_per_bar_class`** | `INTEGER` | Python `zigzag_metrics.py` | Z-score classification of price velocity ($0\text{--}5$).                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 82  | **`zigzag_slope`**               | `DOUBLE`  | Python `zigzag_metrics.py` | Geometric slope angle of the wave segment in degrees ($\arctan(\text{PricePerBar}) \times \frac{180}{\pi}$).                                                                                                                                                                                                                                                                                                                                                                                         |
| 83  | **`zigzag_category`**            | `TEXT`    | Python `zigzag_metrics.py` | Smart Money / Dow Market Structure category:<br>• `'HH'`: Higher High (Peak higher than two-previous Peak)<br>• `'HL'`: Higher Low (Bottom higher than two-previous Bottom = Uptrend)<br>• `'LH'`: Lower High (Peak lower than two-previous Peak = Downtrend/Reversal)<br>• `'LL'`: Lower Low (Bottom lower than two-previous Bottom = Downtrend)<br>• `'EQH'`: Equal High (Peak within $\pm 0.5\%$ of two-previous Peak)<br>• `'EQL'`: Equal Low (Bottom within $\pm 0.5\%$ of two-previous Bottom) |

---

### Group 12: Data Provenance & Pipeline Metadata (Columns 84 – 87)

_Role: Auditing, data integrity, cycle tracking, and sync confirmation across VPS, Gateway, and Database layers._

| #   | Column Name         | Data Type | Origin                | Mathematical & Functional Description                                          |
| :-- | :------------------ | :-------- | :-------------------- | :----------------------------------------------------------------------------- |
| 84  | **`cycle_id`**      | `INTEGER` | Pipeline Tracking     | Ingestion cycle ID referencing the `collection_cycles` table on Contabo VPS.   |
| 85  | **`collected_at`**  | `INTEGER` | Ingestion Worker      | UTC Unix timestamp when raw export files were ingested into SQLite staging.    |
| 86  | **`calculated_at`** | `INTEGER` | Python Worker         | UTC Unix timestamp when Python calc stack finished computing derived columns.  |
| 87  | **`synced_at`**     | `INTEGER` | Push Worker / Gateway | UTC Unix timestamp when the row was successfully synced to Railway PostgreSQL. |

---

## ⚙️ 4. Detailed Operation of the MQL5 Indicator Suite (`mq5/`) (13 Indicators)

Data ingestion relies on **13 MetaTrader 5 indicators** executing concurrently on Contabo VPS every 5 minutes at second :59 (`InpExportSecond = 59`):

### 1. `ohlcvexportlightweight_v2_29.mq5`

- **Function:** Exports raw Open, High, Low, Close, and Tick Volume data over a 3,000-bar lookback window.
- **Mechanism:** Utilizes `CopyTime`, `CopyOpen`, `CopyHigh`, `CopyLow`, `CopyClose`, and `CopyTickVolume` with up to 5 automated retries. Exports data in a clean tab-delimited text format with adjusted timestamps rounded to the bar grid.

### 2. Centroid Regression Indicator Group (7 Indicators)

- **`2EDTCentroidRegressionBestFitNonMostRecentA_v2_29.mq5` (Best-Fit A):**
  - **Primary Instance:** Runs on chart in isolated coexistence (bottom-right corner, button `V394_5LA_ExportButton`).
  - Uses Alglib SSA (Window=30, Rank=6, Signal Period=3) + DBSCAN Clustering (`InpMinPts=5`, `InpEpsilon=0.015`).
  - Parameters: `InpRegCentroids=5`, `InpExcludeRecentCentroids=0`, `InpTimeDecayLambda=0.000` (Equal-weighting across all bars), and `MinTouches=2`.
  - Exports files: `Centriod_Best_Fit_A_XAUUSD_{TF}.txt` and `Centriod_Best_Fit_A_XAUUSD_{TF}_Statistic.txt`.
- **`2EDTCentroidRegressionBestFitNonMostRecentB_v2_29.mq5` (Best-Fit B):**
  - **Secondary Instance:** Runs in parallel on the same chart (bottom-left corner, button `V394_5LB_ExportButton`, colored PaleTurquoise/DodgerBlue).
  - Parameters: `InpRegCentroids=5`, `InpExcludeRecentCentroids=3` (intentionally excludes the 3 newest centroids), `InpTimeDecayLambda=0.000`, and `MinTouches=2`.
  - Exports files: `Centriod_Best_Fit_B_XAUUSD_{TF}.txt` and `Centriod_Best_Fit_B_XAUUSD_{TF}_Statistic.txt`.
- **`2EDTCentroidRegressionCherryPickA_v2_29.mq5` & `CherryPickB`:**
  - Fits OLS regression lines through centroids selected via deterministic Cherry-Pick algorithms (Sets A and B).
- **`2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5`:**
  - Fits OLS regression lines through the $N$ most recent centroids to reflect current market momentum.
- **`2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5` & `NonMostRecentB`:**
  - Fits OLS regression lines while excluding recent centroid boxes (A and B) to capture persistent macro trends devoid of short-term noise.

### 3. Fractal Trendlines & Support/Resistance Indicator Group (3 Indicators)

- **`2EDTFractalBestFitv5_v2_29.mq5`:**
  - Identifies the highest-conviction flip line traversing both Upper and Lower 35-bar fractals with maximum touch count.
  - Calculates equidistant offsets to project UOEDT and LOEDT channel boundaries.
- **`SingleBestResistanceLinev3_v2_29.mq5`:**
  - Evaluates upper fractals to compute the single optimal resistance line with maximum touch score.
- **`SingleBestSupportLinev3_v2_29.mq5`:**
  - Evaluates lower fractals to compute the single optimal support line with maximum touch score.

### 4. `ZigZagExportv43_v2_29.mq5`

- **Function:** Identifies structural wave peaks and bottoms using ZigZag parameters (Depth=12, Deviation=5, Backstep=3).
- **Mechanism:**
  - Compares the current pivot with the preceding two pivots to categorize market structure (`HH`, `HL`, `LH`, `LL`, `EQH`, `EQL`).
  - Calculates rolling 50-segment sample Z-scores to classify wave magnitude (% Change), wave length (Bars), and price velocity (Price per Bar).

### 5. `zscoreohlccandleexport_v2_29.mq5`

- **Function:** Quantifies abnormal candlestick body volatility relative to historical distribution.
- **Mechanism:**
  - Computes sample mean ($\mu$) and sample standard deviation ($\sigma$) of candle body sizes $|Close - Open|$ across a rolling 432-bar window.
  - Generates signed and normalized Z-scores: $Z = \frac{|C - O| - \mu}{\sigma}$.
  - Categorizes candle bodies across 6 distinct states (0 to 5) based on direction and thresholds $Z_1 = 1.5$ (Large Expansion) and $Z_2 = 2.5$ (Extreme Volatility Spike).

---

_This specification is fully synchronized with the live PostgreSQL schema (87 columns), the Data Collection Pipeline Blueprint v2.29, and the latest Prisma MarketDataV6 model._
