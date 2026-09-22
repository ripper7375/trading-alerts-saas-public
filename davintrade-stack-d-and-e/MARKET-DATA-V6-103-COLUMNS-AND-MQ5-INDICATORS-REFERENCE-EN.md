# DavinTrade Architecture Reference: 103 Columns in `market_data_v6` & MQL5 Indicator Suite (15 Indicators)

**Document Version:** 1.5.0  
**Document Code:** `MARKET-DATA-V6-103-COLUMNS-AND-MQ5-INDICATORS-REFERENCE-EN.md` _(Upgraded from 95 to 103 Columns via the 15th Indicator `S-R-AutoCalibration_v2_29.mq5`; Dual-Table Point-in-Time Architecture Active)_  
**Target Scope:** `XAUUSD` on `M5` and `M15` Timeframes  
**System Layer:** Data Pipeline (Stack C) ➔ PostgreSQL Datastore ➔ Conversational AI Co-Pilot (Stack D & E)  
**Last Updated:** 2026-09-22 _(Reflecting production deployment of migration `20260922000000_add_market_data_v6_sr2_levels` on Railway PostgreSQL, point-in-time snapshot table expanded to 77 drifting columns / 84 Prisma fields, 15th indicator onboarding with `sr_9..sr_16`, 12-source indicator statistics enum, and all 15 MQL5 indicators configured)_

---

## 📌 1. Executive Summary & Data Pipeline Architecture

The `market_data_v6` database table (hosted on PostgreSQL via Railway and SQLite on Contabo VPS) serves as the **Single Source of Truth (SSOT)** for all live quantitative technical analysis across the DavinTrade platform. This table consolidates raw candlestick price data (OHLCV) alongside advanced mathematical and statistical indicators:

1. **7 Singular Spectrum Analysis (SSA) Centroid Regression variants** (with isolated coexistence for `best_fit_a` and `best_fit_b`),
2. **Fractal Support/Resistance lines and 2EDT channels**,
3. **Auto-calibrated Support & Resistance primary multi-tier levels (`sr_1` to `sr_8`)** derived from Freedman-Diaconis IQR clustering (Indicator 14: `SupportAndResistantAutoCalibration_v2_29.mq5`),
4. **Auto-calibrated Support & Resistance secondary multi-tier levels (`sr_9` to `sr_16`)** derived from Freedman-Diaconis IQR clustering (Indicator 15: `S-R-AutoCalibration_v2_29.mq5`),
5. **Candle Body Volatility Z-Scores**, and
6. **Smart Money Concept (SMC) ZigZag Market Structure metrics**.

The database table comprises **103 core contract columns** in total _(upgraded sequentially from 79 columns ➔ 87 columns ➔ 95 columns ➔ 103 columns following the onboarding of the 15th indicator `S-R-AutoCalibration_v2_29.mq5`)_. In the Prisma ORM schema ([`prisma/market-data/schema.prisma`](file:///d:/SaaS%20Project/trading-alerts-saas-public/prisma/market-data/schema.prisma) and [`railway-gateway/prisma/schema.prisma`](file:///d:/SaaS%20Project/trading-alerts-saas-public/railway-gateway/prisma/schema.prisma)), 3 system-managed properties (`id` as cuid, `createdAt`, and `updatedAt`) bring the total field count to **106 fields**.

> [!NOTE]
> **Production PostgreSQL Migration Status (27 Migrations Applied on Railway as of 2026-09-22):**
> On 2026-09-22, `npx prisma migrate deploy` was executed against production PostgreSQL (Railway), successfully bringing the entire database schema up-to-date across 27 migrations:
>
> 1. **`market_data_v6` (103 Columns / 106 Prisma Fields):** Applied via migration `20260922000000_add_market_data_v6_sr2_levels`, adding columns `sr_9` through `sr_16`. Serves as the live operational table with UPSERT semantics.
> 2. **`indicator_statistics` (87 Columns / 12 Sources):** Applied via migration `20260920000000_add_indicator_statistics_extended` (adding 50 extended columns), with enum widened to 12 sources (`sr2_levels` enrolled on 2026-09-22).
> 3. **`market_data_point_in_time` (84 Prisma Fields / 77 Drifting Indicator Columns):** Created via `20260920000000_add_market_data_point_in_time` and expanded to 84 fields via `20260922000000_add_market_data_v6_sr2_levels` (adding `sr_9`..`sr_16`). Captures bar 1 as it stood upon close, completely eliminating look-ahead bias for backtesting and model training.
> 4. **Indicator Binaries & Scripts:** All 15 indicators (including `SupportAndResistantAutoCalibration_v2_29.mq5` and `S-R-AutoCalibration_v2_29.mq5`) are configured with exact 3,000-bar exports, 2-decimal gold price formatting, tick-gate separation, and isolated backfill paths.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              END-TO-END DATA GENERATION & STORAGE PIPELINE                             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. MT5 Terminal (Contabo VPS)                                                                          │
│    • 15 MQL5 Indicators export raw calculations every 5 minutes at second :59                         │
│    • 30 chart attachments per terminal (15 on M5 + 15 on M15; 60 total on A + B)                       │
│    • S&R calibrators operate with exact 3000-bar export, 2-decimal gold price, decoupled tick gates    │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 2. SQLite Ingestion & Python Calc Stack (Contabo VPS)                                                  │
│    • Ingests Admin Layer (OHLCV, Crossovers, Fractals, S&R Set 1 & 2, ZigZag Pivots) into staging      │
│    • Python Calc Modules (`centroid_regression.py`, `fractal_lines.py`, `zscore_candle.py`,           │
│      `zigzag_metrics.py`) calculate derived lines and statistical classifications                      │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 3. Push Worker ➔ Railway Gateway (NestJS)                                                              │
│    • Idempotent UPSERT on `(symbol, timeframe, timestamp)`                                            │
│    • Direct 1:1 validation via `gateway_contract_market_data.schema.json` (103 fields)                │
│                                                   │                                                    │
│                         ┌─────────────────────────┴─────────────────────────┐                          │
│                         ▼                                                   ▼                          │
│ 4A. PostgreSQL `market_data_v6`                         4B. PostgreSQL `market_data_point_in_time`    │
│     (Wide Table: 103 Cols / 106 Fields)                     (Append-Only Snapshot: 84 Fields / 77 Cols) │
│     • UPSERT on (symbol, timeframe, timestamp)              • INSERT ... ON CONFLICT DO NOTHING        │
│     • Dynamic sliding window (~3,000 bars)                  • Frozen state at bar close                │
│     • Continuous refit of historical lines                  • `snapshot_age_bars = 1` verification     │
│     • Foundation for:                                       • Foundation for:                          │
│       - Engine 1 (VANNA NL2SQL)                               - Quantitative Backtesting               │
│       - Engine 1.5A (MCD01-MCD10+ Discrete States)            - Fitness Function Scoring               │
│       - Engine 1.5B (JSONB54 Deduplicated Storyline)          - Machine Learning Training              │
│       - Engine 1.5C (WACS54 Weighted Confluence Score)        - Look-Ahead Bias Elimination            │
│       - Engine 2 (Live Multimodal Synthesis & Rules)                                                   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Overview of the 15 MQL5 Indicators (Exporting Raw Calculations Every 5 Minutes at Second :59)

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
│ 12 │ `SupportAndResistantAutoCalibration_v2_29.mq5`  │ 14th Indicator: Freedman-Diaconis IQR Clustering │
│    │                                                 │ 8 S&R auto-calibrated levels (sr_1 to sr_8)      │
│    │                                                 │ Prefix: SR_Levels, Export: SR_Levels_XAUUSD_{TF} │
│ 13 │ `S-R-AutoCalibration_v2_29.mq5`                 │ 15th Indicator: Freedman-Diaconis IQR Clustering │
│    │                                                 │ 8 S&R auto-calibrated levels (sr_9 to sr_16)     │
│    │                                                 │ Prefix: S_R_Levels, Export: S_R_Levels_XAUUSD... │
│    │                                                 │ Button: V440_SR2_ExportButton, Stats: sr2_levels │
│ 14 │ `ZigZagExportv43_v2_29.mq5`                     │ ZigZag (12,5,3), Structure (HH/HL/LH/LL/EQ),     │
│    │                                                 │ Rolling Z-Score 50 Segments (%Chg, Bar, Speed)   │
│ 15 │ `zscoreohlccandleexport_v2_29.mq5`              │ Candle Body Z-Score (Window 432, Z1=1.5, Z2=2.5) │
│    │                                                 │ Direction & Classification Enum (Codes 0 to 5)   │
└────┴─────────────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

## 📊 2. High-Level Classification Matrix (14 Groups / 103 Columns Total)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                MARKET_DATA_V6 103 COLUMNS CLASSIFICATION                               │
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
│ 10 │ S&R Auto-Calibration 1 (`sr_1`–`sr_8`)│ 8       │ Cols 70 – 77 │ 14th Indicator (Freedman-Diaconis│
│ 11 │ S&R Auto-Calibration 2 (`sr_9`–`sr_16`│ 8       │ Cols 78 – 85 │ 15th Indicator (Freedman-Diaconis│
│ 12 │ Z-Score Candle Volatility             │ 3       │ Cols 86 – 88 │ Python `zscore_candle.py`        │
│ 13 │ ZigZag Market Structure & Metrics     │ 11      │ Cols 89 – 99 │ MQL5 Pivot + Python `zigzag.py`  │
│ 14 │ Provenance & Pipeline Metadata        │ 4       │ Cols 100–103 │ Ingestion & Audit Sync Systems   │
├────┴───────────────────────────────────────┴─────────┴──────────────┴──────────────────────────────────┤
│    Total Contract Columns                  │ 103 Cols│ Cols 1 – 103 │ (95 previous + 8 for sr_9..sr_16)│
│    Prisma ORM Fields (incl. id/timestamps) │ 106 Flds│              │ (+ id, createdAt, updatedAt)     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 3. Column-by-Column Data Dictionary (Columns 1 – 103)

### Group 1: Base OHLCV & Timeframe Grid (Columns 1 – 8)

_Role: Core chronological and price spine aligned to standardized M5 (300-second) or M15 (900-second) bar boundaries._

| #   | Column Name     | Data Type | Nullability | Origin           | Mathematical & Functional Description                                               |
| :-- | :-------------- | :-------- | :---------- | :--------------- | :---------------------------------------------------------------------------------- |
| 1   | **`timestamp`** | `INTEGER` | `NOT NULL`  | MQL5 (Adjusted)  | Bar open timestamp in UTC Unix seconds, rounded to the exact bar boundary (M5/M15). |
| 2   | **`symbol`**    | `TEXT`    | `NOT NULL`  | Static           | Financial asset symbol, strictly locked to `'XAUUSD'` (Gold).                       |
| 3   | **`timeframe`** | `TEXT`    | `NOT NULL`  | MQL5             | Chart timeframe, locked to `'M5'` (Micro Execution) or `'M15'` (Macro Structure).   |
| 4   | **`open`**      | `DOUBLE`  | `NOT NULL`  | MQL5 `raw_ohlcv` | Opening price of the bar in USD per troy ounce.                                     |
| 5   | **`high`**      | `DOUBLE`  | `NOT NULL`  | MQL5 `raw_ohlcv` | Highest price achieved during the bar in USD per troy ounce.                        |
| 6   | **`low`**       | `DOUBLE`  | `NOT NULL`  | MQL5 `raw_ohlcv` | Lowest price reached during the bar in USD per troy ounce.                          |
| 7   | **`close`**     | `DOUBLE`  | `NOT NULL`  | MQL5 `raw_ohlcv` | Closing price of the bar in USD per troy ounce.                                     |
| 8   | **`volume`**    | `INTEGER` | `NOT NULL`  | MQL5 `raw_ohlcv` | Tick volume recorded during the bar interval.                                       |

---

### Groups 2 to 8: Centroid Regression 7 Variants (Columns 9 – 64)

_Underlying Methodology: Each variant extracts Singular Spectrum Analysis (SSA Window=30, Rank=6) and identifies crossover points of SSA against its EMA signal line (Signal=3). These crossover points are grouped into clusters (Centroids) via DBSCAN/clustering algorithms to fit the baseline (Base_FL) and construct equidistant trendlines (UOEDT, LOEDT)._

#### 🔹 Centroid Variant 1: `best_fit_a` (Columns 9 – 16)

_Primary Instance: Configuration-identical to the former single `best_fit` variant; parameters `InpRegCentroids=5`, `InpExcludeRecentCentroids=0`, `InpTimeDecayLambda=0.000` (equal-weighting across all bars), and `MinTouches=2`. Includes all recent centroids without exclusion._

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

### Group 10: Auto-Calibrated Support & Resistance Levels Set 1 (`sr_1` to `sr_8`) (Columns 70 – 77)

_Role: The 14th Indicator suite (`SupportAndResistantAutoCalibration_v2_29.mq5`, schema live on PostgreSQL via migration `20260916000000_add_market_data_v6_sr_levels` applied 2026-09-20). Automatically identifies high-density horizontal price reaction zones using Freedman-Diaconis Interquartile Range (IQR) clustering across recent fractals. Levels are assigned per bar relative to that bar's own close: `sr_1`..`sr_4` are the nearest active supports **below** close (`sr_1` closest), and `sr_5`..`sr_8` are the nearest active resistances **above** close (`sr_5` closest). Unresolved slots store `NULL` (never 0.0)._

> [!IMPORTANT]
> **Production Defect Fixes & Formatting Standard (Resolved 2026-09-20):**
> Four legacy defects originally noted in §6.3 of the 14th Indicator Design have been fully remediated:
>
> 1. **Row Count Alignment:** Corrected the off-by-one 3001-row export (which had an extra row at the oldest end) to export exactly 3,000 bars, perfectly aligning with the OHLCV spine.
> 2. **2-Decimal Price Formatting:** Updated to `SRPriceToString(val, 2)` (e.g. `2748.50`), removing 5-decimal truncation and matching XAUUSD standard contract precision.
> 3. **Tick Gate Separation:** Re-clustering via Freedman-Diaconis runs once per new bar open, while distance calculation and `sr_1`..`sr_8` slotting run per-tick to ensure zero intra-bar lag.
> 4. **Safe Backfill Handling:** Backfill exports write to a dedicated `{Prefix}_{Symbol}_{TF}_Backfill.txt` file outside the pipeline ingestion polling loop.

| #   | Column Name | Data Type | Nullability | Origin           | Mathematical & Functional Description                                                                   |
| :-- | :---------- | :-------- | :---------- | :--------------- | :------------------------------------------------------------------------------------------------------ |
| 70  | **`sr_1`**  | `DOUBLE`  | `NULLABLE`  | MQL5 14th Indiv. | **Support Level 1**: Closest auto-calibrated horizontal support level **below** this bar's close price. |
| 71  | **`sr_2`**  | `DOUBLE`  | `NULLABLE`  | MQL5 14th Indiv. | **Support Level 2**: Second closest auto-calibrated support level below this bar's close price.         |
| 72  | **`sr_3`**  | `DOUBLE`  | `NULLABLE`  | MQL5 14th Indiv. | **Support Level 3**: Third closest auto-calibrated support level below this bar's close price.          |
| 73  | **`sr_4`**  | `DOUBLE`  | `NULLABLE`  | MQL5 14th Indiv. | **Support Level 4**: Fourth closest (outermost tracked) support level below this bar's close price.     |
| 74  | **`sr_5`**  | `DOUBLE`  | `NULLABLE`  | MQL5 14th Indiv. | **Resistance Level 1**: Closest auto-calibrated horizontal resistance level **above** close price.      |
| 75  | **`sr_6`**  | `DOUBLE`  | `NULLABLE`  | MQL5 14th Indiv. | **Resistance Level 2**: Second closest auto-calibrated resistance level above this bar's close price.   |
| 76  | **`sr_7`**  | `DOUBLE`  | `NULLABLE`  | MQL5 14th Indiv. | **Resistance Level 3**: Third closest auto-calibrated resistance level above this bar's close price.    |
| 77  | **`sr_8`**  | `DOUBLE`  | `NULLABLE`  | MQL5 14th Indiv. | **Resistance Level 4**: Fourth closest (outermost tracked) resistance level above close price.          |

> [!TIP]
> **S&R Calibration Provenance (`indicator_statistics`):**
> While `market_data_v6` stores the resolved dollar levels (`sr_1` to `sr_8`), the companion table `indicator_statistics` (extended to 87 columns on 2026-09-20 via `20260920000000_add_indicator_statistics_extended`) records the mathematical parameters that generated them: `sr_fractals_n`, `sr_q25`, `sr_q75`, `sr_iqr`, `sr_optimal_step`, `sr_macro_clusters`, `sr_nearest_resistance`, `sr_nearest_support`, `sr_dist_resistance_pts`, and `sr_dist_support_pts`.

---

### Group 11: Auto-Calibrated Support & Resistance Levels Set 2 (`sr_9` to `sr_16`) (Columns 78 – 85)

_Role: The 15th Indicator suite (`S-R-AutoCalibration_v2_29.mq5`, schema live on PostgreSQL via migration `20260922000000_add_market_data_v6_sr2_levels` applied 2026-09-22). Replicated from the 14th indicator with prefix `S_R_Levels` to allow independent calibration configurations (e.g., custom date-anchored lookback windows `InpStartDateTime`/`InpEndDateTime`, alternative sensitivity factors, or secondary clustering regimes) while operating simultaneously on the same chart. Levels are assigned per bar relative to that bar's close: `sr_9`..`sr_12` are the nearest active supports **below** close (`sr_9` closest), and `sr_13`..`sr_16` are the nearest active resistances **above** close (`sr_13` closest). Unresolved slots store `NULL` (never 0.0)._

| #   | Column Name | Data Type | Nullability | Origin           | Mathematical & Functional Description                                                                              |
| :-- | :---------- | :-------- | :---------- | :--------------- | :----------------------------------------------------------------------------------------------------------------- |
| 78  | **`sr_9`**  | `DOUBLE`  | `NULLABLE`  | MQL5 15th Indiv. | **Support Level 5 (Set 2 Level 1)**: Closest auto-calibrated horizontal support level **below** close price.       |
| 79  | **`sr_10`** | `DOUBLE`  | `NULLABLE`  | MQL5 15th Indiv. | **Support Level 6 (Set 2 Level 2)**: Second closest auto-calibrated support level below close price.               |
| 80  | **`sr_11`** | `DOUBLE`  | `NULLABLE`  | MQL5 15th Indiv. | **Support Level 7 (Set 2 Level 3)**: Third closest auto-calibrated support level below close price.                |
| 81  | **`sr_12`** | `DOUBLE`  | `NULLABLE`  | MQL5 15th Indiv. | **Support Level 8 (Set 2 Level 4)**: Fourth closest (outermost tracked in Set 2) support level below close price.  |
| 82  | **`sr_13`** | `DOUBLE`  | `NULLABLE`  | MQL5 15th Indiv. | **Resistance Level 5 (Set 2 Level 1)**: Closest auto-calibrated horizontal resistance level **above** close price. |
| 83  | **`sr_14`** | `DOUBLE`  | `NULLABLE`  | MQL5 15th Indiv. | **Resistance Level 6 (Set 2 Level 2)**: Second closest auto-calibrated resistance level above close price.         |
| 84  | **`sr_15`** | `DOUBLE`  | `NULLABLE`  | MQL5 15th Indiv. | **Resistance Level 7 (Set 2 Level 3)**: Third closest auto-calibrated resistance level above close price.          |
| 85  | **`sr_16`** | `DOUBLE`  | `NULLABLE`  | MQL5 15th Indiv. | **Resistance Level 8 (Set 2 Level 4)**: Fourth closest (outermost tracked in Set 2) resistance level above close.  |

> [!TIP]
> **Set 2 S&R Calibration Provenance (`indicator_statistics` Enum `sr2_levels`):**
> The companion statistics for the 15th indicator export to `S_R_Levels_{Symbol}_{Timeframe}_Statistic.txt`. In PostgreSQL, these metrics populate the `indicator_statistics` table using the dedicated source enum `sr2_levels` (added in migration `20260922000000_add_market_data_v6_sr2_levels`), ensuring 100% mathematical auditability for both S&R calibrators in parallel.

---

### Group 12: Z-Score Candle Volatility (Columns 86 – 88)

_Role: Volatility expansion and compression classification relative to a 432-bar rolling sample._

| #   | Column Name               | Data Type | Origin                    | Mathematical & Functional Description                                                                                                                                                                                                                                                                                                                                                                                                     |
| :-- | :------------------------ | :-------- | :------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 86  | **`body_direction`**      | `INTEGER` | Python `zscore_candle.py` | Direction of the candlestick: $+1$ (Bullish / Close > Open), $-1$ (Bearish / Close < Open), $0$ (Doji / Close = Open).                                                                                                                                                                                                                                                                                                                    |
| 87  | **`body_size`**           | `DOUBLE`  | Python `zscore_candle.py` | Absolute body size Z-score: $\|Z\| = \frac{\|C - O\| - \mu}{\sigma}$ relative to the rolling 432-bar sample.                                                                                                                                                                                                                                                                                                                              |
| 88  | **`body_classification`** | `INTEGER` | Python `zscore_candle.py` | Candle classification code (Enum 0 to 5):<br>• `0`: UP_NORMAL ($\|Z\| < 1.5$, Bullish)<br>• `1`: UP_LARGE ($1.5 \le \|Z\| < 2.5$, Elevated Bullish Expansion)<br>• `2`: UP_EXTREME ($\|Z\| \ge 2.5$, Extreme Bullish Volatility Spike)<br>• `3`: DOWN_NORMAL ($\|Z\| < 1.5$, Bearish)<br>• `4`: DOWN_LARGE ($1.5 \le \|Z\| < 2.5$, Elevated Bearish Expansion)<br>• `5`: DOWN_EXTREME ($\|Z\| \ge 2.5$, Extreme Bearish Volatility Spike) |

---

### Group 13: ZigZag Market Structure & Metrics (Columns 89 – 99)

_Role: Captures Price Action and Smart Money Market Structure. Non-pivot bars contain `NULL`; values populate strictly on confirmed pivot bars._

| #   | Column Name                      | Data Type | Origin                     | Mathematical & Functional Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :-- | :------------------------------- | :-------- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 89  | **`zigzag_point_type`**          | `TEXT`    | MQL5 `ZigZagExport`        | Pivot point type: `'Peak'` (Swing High) or `'Bottom'` (Swing Low).                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 90  | **`zigzag_current_point`**       | `DOUBLE`  | MQL5 `ZigZagExport`        | Confirmed pivot price level in USD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 91  | **`zigzag_price_change`**        | `DOUBLE`  | Python `zigzag_metrics.py` | Dollar price difference from the preceding pivot ($\Delta P = P_{\text{current}} - P_{\text{previous}}$).                                                                                                                                                                                                                                                                                                                                                                                            |
| 92  | **`zigzag_pct_change`**          | `DOUBLE`  | Python `zigzag_metrics.py` | Percentage price move from the preceding pivot ($\% \Delta P = \frac{\Delta P}{P_{\text{previous}}} \times 100$).                                                                                                                                                                                                                                                                                                                                                                                    |
| 93  | **`zigzag_pct_change_class`**    | `INTEGER` | Python `zigzag_metrics.py` | Z-score classification of percentage price change ($0\text{--}2$ Bullish, $3\text{--}5$ Bearish).                                                                                                                                                                                                                                                                                                                                                                                                    |
| 94  | **`zigzag_bars`**                | `INTEGER` | Python `zigzag_metrics.py` | Number of elapsed bars in the current ZigZag leg (Wave Duration).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 95  | **`zigzag_bars_class`**          | `INTEGER` | Python `zigzag_metrics.py` | Z-score classification of the leg duration ($0\text{--}5$).                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 96  | **`zigzag_price_per_bar`**       | `DOUBLE`  | Python `zigzag_metrics.py` | Price velocity per bar ($\text{Velocity} = \frac{\|\Delta P\|}{\text{Bars}}$).                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 97  | **`zigzag_price_per_bar_class`** | `INTEGER` | Python `zigzag_metrics.py` | Z-score classification of price velocity ($0\text{--}5$).                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 98  | **`zigzag_slope`**               | `DOUBLE`  | Python `zigzag_metrics.py` | Geometric slope angle of the wave segment in degrees ($\arctan(\text{PricePerBar}) \times \frac{180}{\pi}$).                                                                                                                                                                                                                                                                                                                                                                                         |
| 99  | **`zigzag_category`**            | `TEXT`    | Python `zigzag_metrics.py` | Smart Money / Dow Market Structure category:<br>• `'HH'`: Higher High (Peak higher than two-previous Peak)<br>• `'HL'`: Higher Low (Bottom higher than two-previous Bottom = Uptrend)<br>• `'LH'`: Lower High (Peak lower than two-previous Peak = Downtrend/Reversal)<br>• `'LL'`: Lower Low (Bottom lower than two-previous Bottom = Downtrend)<br>• `'EQH'`: Equal High (Peak within $\pm 0.5\%$ of two-previous Peak)<br>• `'EQL'`: Equal Low (Bottom within $\pm 0.5\%$ of two-previous Bottom) |

---

### Group 14: Data Provenance & Pipeline Metadata (Columns 100 – 103)

_Role: Auditing, data integrity, cycle tracking, and sync confirmation across VPS, Gateway, and Database layers._

| #   | Column Name         | Data Type | Nullability | Origin                | Mathematical & Functional Description                                                       |
| :-- | :------------------ | :-------- | :---------- | :-------------------- | :------------------------------------------------------------------------------------------ |
| 100 | **`cycle_id`**      | `INTEGER` | `NOT NULL`  | Pipeline Tracking     | Ingestion cycle ID referencing the `collection_cycles` table on Contabo VPS.                |
| 101 | **`collected_at`**  | `INTEGER` | `NOT NULL`  | Ingestion Worker      | UTC Unix timestamp when raw export files were ingested into SQLite staging.                 |
| 102 | **`calculated_at`** | `INTEGER` | `NULLABLE`  | Python Worker         | UTC Unix timestamp when Python calc stack finished computing derived columns.               |
| 103 | **`synced_at`**     | `INTEGER` | `NULLABLE`  | Push Worker / Gateway | UTC Unix timestamp when the row was successfully synced to Railway PostgreSQL (or gateway). |

> [!NOTE]
> **Prisma ORM Mirror Mapping (106 Fields Total):**
> In the Next.js and Railway Gateway Prisma clients (`prisma/market-data/schema.prisma` and `railway-gateway/prisma/schema.prisma`), `market_data_v6` also incorporates:
>
> 1. `id String @id @default(cuid())` — standard globally unique identifier,
> 2. `terminal_id String` — sender ID (`'push_worker_v5'`),
> 3. `createdAt DateTime @default(now())`, and
> 4. `updatedAt DateTime @updatedAt`.

---

## 🛡️ 3.1 Dual-Table Architecture: Live Operational View (`market_data_v6`) vs. Immutable Point-in-Time Snapshot (`market_data_point_in_time`)

A foundational breakthrough implemented on 2026-09-20 and expanded on 2026-09-22 is the formal separation between **Live Operational Technical Analysis** and **Historical Point-in-Time Evaluation**.

### 1. Empirical Measurement of Historical Indicator Drift (Look-Ahead Bias)

As documented in [`HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md), indicators utilizing future price context to fit polynomial trendlines, SSA curves, and fractal channels continuously recompute their historical trajectories as new price bars form.

On 2026-09-20, an empirical drift test (`measure_indicator_drift.py`) was executed across two real MT5 captures taken 12 days apart (2026-09-07 vs. 2026-09-19) over **2,114 overlapping M15 bars**:

- **Dynamic Channels Drift:** `*_uoedt` (Upper Outermost Equidistant Trendlines) drifted on **100.0%** of comparable bars, with an average drift of **$19.26 USD** (reaching a maximum drift of **$22.86 USD**), representing **~14% of the entire median EDT channel width**.
- **SSA Smoothed Trendlines:** `*_ssa` shifted on **100.0%** of historical bars as new centroids adjusted the underlying singular spectrum decomposition.
- **Signal Flag Inversions:** `*_crossing` (a boolean signal indicator) flipped state on **0.71% of historical bars** (15 bars), proving that relying on re-fitted historical data in `market_data_v6` for backtesting produces artificial foresight (look-ahead bias).
- **Controls Confirmed Stable:** Baseline OHLCV candle prices and confirmed ZigZag structural pivot points exhibited **0.00% drift** across the entire 12-day window.

### 2. Dual Datastore Comparative Matrix

To guarantee mathematical integrity, the database datastore employs two complementary tables in production:

| Architectural Property     | Operational Table: `market_data_v6`                                                                                                                    | Snapshot Table: `market_data_point_in_time`                                                                                                           |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prisma Model**           | `MarketDataV6`                                                                                                                                         | `MarketDataPointInTime`                                                                                                                               |
| **Storage Semantics**      | Mutable Wide Table (Sliding ~3,000 bars)                                                                                                               | **Append-Only, Never Updated** (Immutable log)                                                                                                        |
| **Write Operation**        | Idempotent `UPSERT` on `(symbol, timeframe, timestamp)`                                                                                                | `INSERT ... ON CONFLICT DO NOTHING`                                                                                                                   |
| **Schema Footprint**       | 103 Contract Columns (106 Prisma Fields)                                                                                                               | 77 Drifting Indicator Columns + 4 Provenance + 3 PK (84 Fields)                                                                                       |
| **Historical Value State** | **Latest Refit:** Shows what indicators say about bar $T$ _today_                                                                                      | **Frozen Point-in-Time:** Shows what indicators said at bar $T$ _at close_                                                                            |
| **Primary Consumers**      | • Live Real-time Charting & Dashboards<br>• Real-time Conversational AI Copilot (Stack D & E)<br>• Live Alert Engines (VANNA NL2SQL, MCD01-10, WACS54) | • Quantitative Strategy Backtesting<br>• Machine Learning Model Training & Feature Stores<br>• Fitness Function Scoring & Signal Reliability Auditing |
| **Look-Ahead Bias**        | Exists on historical rows (by mathematical design)                                                                                                     | **Zero Look-Ahead Bias** (Strictly Point-in-Time)                                                                                                     |

```
                               ┌──────────────────────────────────────────────┐
                               │      Push Worker Payload (103 Columns)       │
                               └──────────────────────┬───────────────────────┘
                                                      │
                                                      ▼
                                       Railway NestJS Gateway Processor
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
         Upsert into `market_data_v6`                             Evaluate `barAgeInPeriods(timestamp)`
         (Updates all ~3,000 bars in-place)                                          │
                       │                                                             ▼
                       │                                                  Is Bar Closed? (Age >= 1)
                       │                                                    ├── No (Age 0) ➔ Skip snapshot
                       │                                                    └── Yes (Age >= 1) ➔
                       │                                                          INSERT ON CONFLICT DO NOTHING
                       │                                                          into `market_data_point_in_time`
                       │                                                          (84 Fields / 77 Drifting Cols)
                       ▼                                                             ▼
         Operational Querying (Live UI)                            Point-in-Time Backtesting (Zero Foresight)
```

### 3. The `snapshot_age_bars` Provenance Guard

The `market_data_point_in_time` table incorporates `snapshot_age_bars`:

- **`snapshot_age_bars = 1`:** The honest, ideal snapshot. The bar completed and was recorded on the very next collection cycle without queue backlog.
- **`snapshot_age_bars > 1`:** Indicates that the ingestion/push worker was delayed or recovering from a backlog (capturing the row with $N$ bars of subsequent hindsight).
- **Rule for Backtesters:** Any quantitative strategy evaluation or ML training pipeline **MUST** filter with `WHERE snapshot_age_bars = 1` to guarantee absolute immunity from look-ahead bias.

---

## ⚙️ 4. Detailed Operation of the MQL5 Indicator Suite (15 Indicators)

Data ingestion relies on **15 MetaTrader 5 indicators** executing concurrently on Contabo VPS every 5 minutes at second :59 (`InpExportSecond = 59`):

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

### 4. `SupportAndResistantAutoCalibration_v2_29.mq5` (The 14th Indicator — Set 1: `sr_1` to `sr_8`)

- **Function:** Dynamic Support & Resistance clustering using the **Freedman-Diaconis Interquartile Range (IQR)** rule to allocate price levels into 8 discrete slots (`sr_1` to `sr_8`).
- **Mathematical Engine:**
  $$h = 2 \cdot \text{IQR} \cdot N^{-1/3}$$
  Where $\text{IQR} = Q_{75} - Q_{25}$ and $N$ is the sample size of detected fractals.
- **Allocation Rule:**
  - Evaluated against each bar's close price.
  - Supports: `sr_1` is the nearest active support below close, followed by `sr_2`, `sr_3`, and `sr_4`.
  - Resistances: `sr_5` is the nearest active resistance above close, followed by `sr_6`, `sr_7`, and `sr_8`.
  - Unused or unresolved slots remain `NULL` (never 0.0).
- **Export Files:** `SR_Levels_XAUUSD_{TF}.txt` and `SR_Levels_XAUUSD_{TF}_Statistic.txt`.
- **Engineering Remediation of 4 Production Defects (2026-09-20):**
  1. **3001-Row Defect Resolution:** Loop corrected to export exactly `InpExportBars` (3,000 bars), establishing strict 1:1 row alignment with the OHLCV spine without dropping shift 0.
  2. **Price Formatting Precision:** Corrected from 5 decimal places to 2 decimal places using `SRPriceToString(val, 2)` (e.g., `2748.50`), adhering to Gold contract tick conventions.
  3. **Safe Isolated Backfill:** Backfill exports write to `{Prefix}_{Symbol}_{TF}_Backfill.txt` with configurable `InpBackfillBars`, isolated from the live polling loop.
  4. **Decoupled Intra-Bar Execution Gate:** Freedman-Diaconis clustering executes strictly once on new bar open (`time[0] != lastCalculationTime`), while buffer allocation and distance tracking execute every tick for sub-second proximity accuracy.

### 5. `S-R-AutoCalibration_v2_29.mq5` (The 15th Indicator — Set 2: `sr_9` to `sr_16`)

- **Function:** Replicated auto-calibrated Support & Resistance engine operating in parallel with the 14th indicator to provide an independent secondary S&R calibration regime (slots `sr_9` through `sr_16`).
- **Isolation & Coexistence Features:**
  - **File Prefix:** `InpExportFileName = "S_R_Levels"`, generating `S_R_Levels_XAUUSD_{TF}.txt` and companion `S_R_Levels_XAUUSD_{TF}_Statistic.txt`.
  - **Chart Button:** `V440_SR2_ExportButton` positioned with non-overlapping screen coordinates (`InpButtonX = 20`, `InpButtonY = 120`).
  - **Independent Calibration Parameters:** Configurable for alternative date windows (`InpStartDateTime` / `InpEndDateTime`), custom fractal lookbacks, or separate cluster sensitivity multipliers.
- **Allocation Rule:**
  - Evaluated against each bar's close price.
  - Supports: `sr_9` is the nearest active support below close, followed by `sr_10`, `sr_11`, and `sr_12`.
  - Resistances: `sr_13` is the nearest active resistance above close, followed by `sr_14`, `sr_15`, and `sr_16`.
  - Unused or unresolved slots remain `NULL` (never 0.0).
- **PostgreSQL Enum:** Registered under source enum `sr2_levels` in `indicator_statistics`.

### 6. `ZigZagExportv43_v2_29.mq5`

- **Function:** Identifies structural wave peaks and bottoms using ZigZag parameters (Depth=12, Deviation=5, Backstep=3).
- **Mechanism:**
  - Compares the current pivot with the preceding two pivots to categorize market structure (`HH`, `HL`, `LH`, `LL`, `EQH`, `EQL`).
  - Calculates rolling 50-segment sample Z-scores to classify wave magnitude (% Change), wave length (Bars), and price velocity (Price per Bar).

### 7. `zscoreohlccandleexport_v2_29.mq5`

- **Function:** Quantifies abnormal candlestick body volatility relative to historical distribution.
- **Mechanism:**
  - Computes sample mean ($\mu$) and sample standard deviation ($\sigma$) of candle body sizes $|Close - Open|$ across a rolling 432-bar window.
  - Generates signed and normalized Z-scores: $Z = \frac{|C - O| - \mu}{\sigma}$.
  - Categorizes candle bodies across 6 distinct states (0 to 5) based on direction and thresholds $Z_1 = 1.5$ (Large Expansion) and $Z_2 = 2.5$ (Extreme Volatility Spike).

---

## 🚀 5. Multi-Tier Deployment & Operational Status (as of 2026-09-22)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               MULTI-TIER DEPLOYMENT READINESS MATRIX                                   │
├────┬────────────────────────────┬─────────────┬────────────────────────────────────────────────────────┤
│ Tier│ Platform / Component       │ Status      │ Technical Verification Details                         │
├────┼────────────────────────────┼─────────────┼────────────────────────────────────────────────────────┤
│ 1  │ Railway PostgreSQL         │ READY (Live)│ 27 migrations applied; `market_data_v6` (103 cols),    │
│    │                            │             │ `indicator_statistics` (87 cols, 12 sources), and      │
│    │                            │             │ `market_data_point_in_time` (84 fields / 77 cols)      │
│    │                            │             │ verified live via migration `20260922000000...`.      │
│ 2  │ Railway NestJS Gateway     │ READY (Live)│ CI/CD automated deployment active on `origin/main`.    │
│    │                            │             │ 220 test suites PASS, 2,881 tests PASS.                │
│ 3  │ MQL5 Indicator Binaries    │ READY (Code)│ All 15 indicators configured and staged in             │
│    │                            │             │ `backend-stack-c/.../mq5` ready for MT5 execution.     │
│ 4  │ Contabo VPS Host           │ PENDING RDP │ Staged in `DEPLOY_TO_CONTABO_VPS_READY/`; awaiting     │
│    │                            │             │ manual RDP transfer & terminal restart by user.        │
└────┴────────────────────────────┴─────────────┴────────────────────────────────────────────────────────┘
```

---

_This specification is fully synchronized with the live PostgreSQL schema (103 contract columns / 106 Prisma fields), the Data Collection Pipeline Blueprint v2.29, the 14th & 15th Indicator Architecture Reports, the Look-Ahead Bias Mitigation Manifest, and the latest Prisma `MarketDataV6` and `MarketDataPointInTime` models. Production database migration `20260922000000_add_market_data_v6_sr2_levels` was officially applied and verified on Railway PostgreSQL on 2026-09-22._
