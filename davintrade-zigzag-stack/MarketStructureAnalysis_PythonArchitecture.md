# ZigZag Market Structure Analysis — Python Stack Architecture

**For Claude Code | Full Implementation Guide | v1.1 | May 2026**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Python Technology Stack](#2-python-technology-stack)
3. [Source Data Specifications](#3-source-data-specifications)
4. [Target Schema — dataformat (167 Columns)](#4-target-schema--dataformat-167-columns)
5. [Data Pipeline Architecture](#5-data-pipeline-architecture)
6. [Transformation Engine — 152 Derived Columns](#6-transformation-engine--152-derived-columns)
7. [PostgreSQL Storage Schema](#7-postgresql-storage-schema)
8. [Configurable Query Engine — Q1, Q2, Q3](#8-configurable-query-engine--q1-q2-q3)
9. [Module & File Structure](#9-module--file-structure)
10. [Configuration Schema](#10-configuration-schema)
11. [Column Mapping Quick Reference](#11-column-mapping-quick-reference)
12. [Implementation Checklist](#12-implementation-checklist)
13. [Appendix — Key Formula Reference](#13-appendix--key-formula-reference)

---

## 1. Executive Summary

This document is the authoritative specification for building a Python-based market structure analysis pipeline from MetaTrader 5 (MT5) ZigZag indicator exports. The system:

- Ingests 15-column raw TSV data from `ZigZag-Export-v43.mq5`
- Derives **152 additional columns** entirely in Python (MQL5 produces only the 15 raw columns)
- Persists the 167-column result to PostgreSQL
- Exposes three configurable query APIs for charting and signal generation

**The 15 MQL5 columns are the only input. All remaining 152 columns are computed by Python.**  
_(Exception: `Current%ChgClass`, `CurrentBarsClass`, `CurrentPrPerBarClass` arrive pre-classified from MQL5 via Z-Score; Python only shift()-derives their NthPrev variants.)_

### Three Query Modes

| #   | Name                      | Description                                                                       |
| --- | ------------------------- | --------------------------------------------------------------------------------- |
| Q1  | Horizontal S&R            | Last N ZigZag rows → up to K price levels above + K below current price (EQH/EQL) |
| Q2  | Important S&R             | Same as Q1 but restricted to IEQH/IEQL events only (large/extreme moves)          |
| Q3  | Green & Violet Trendlines | Last M rows → forward-projecting trendlines from ThumbUp/ThumbDown anchors        |

### Resource Inventory

| #   | File                                                       | Type                    | Role                                                                                    |
| --- | ---------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| 1   | `ZigZag-Export-v43.mq5`                                    | MQL5 Indicator          | Primary 15-column TSV source                                                            |
| 2   | `fractal-horizontal-trendline-export-window-period-v4.mq5` | MQL5 Indicator          | Supplementary 12-column fractal trendline TSV                                           |
| 3   | `v43_calculationlogic.xlsx`                                | Excel formula reference | 173-col authoritative formula logic for all derived columns (separator columns removed) |
| 4   | `v43_dataformat.xlsx`                                      | Excel data spec         | 167-col target schema — column names, order, dtypes                                     |
| 5   | `ZigZag_ColumnMapping_v43.xlsx`                            | Excel mapping table     | Cross-reference: calculationlogic ↔ dataformat columns + Python notes                   |
| 6   | `Green-Trendline.jpg`                                      | Visual spec             | Green trendline drawing rules for Q3                                                    |
| 7   | `Violet-Trendline.jpg`                                     | Visual spec             | Violet trendline drawing rules for Q3                                                   |

---

## 2. Python Technology Stack

> **Resources needed:** None (stack is derived from pipeline requirements in `v43_dataformat.xlsx` and `v43_calculationlogic.xlsx`)

| Library           | Version | Purpose                                                                      | Used In   |
| ----------------- | ------- | ---------------------------------------------------------------------------- | --------- |
| `pandas`          | >=2.1   | DataFrame ingestion, shift-based derivation, rolling stats, TSV merging      | §5, §6    |
| `numpy`           | >=1.26  | Vectorised arithmetic for %Diff, Z-Score, slope, boolean masking             | §5, §6    |
| `sqlalchemy`      | >=2.0   | ORM/Core for PostgreSQL table definitions, bulk inserts, migrations          | §7        |
| `psycopg2-binary` | >=2.9   | Low-level PostgreSQL driver under SQLAlchemy                                 | §7        |
| `scipy`           | >=1.11  | `linregress` for Q3 trendline slope fitting                                  | §8.3      |
| `matplotlib`      | >=3.8   | Optional: debug S&R + trendline overlay PNG rendering                        | §9        |
| `plotly`          | >=5.18  | Optional: interactive candlestick + overlay validation chart                 | §9        |
| `watchdog`        | >=4.0   | File-system watch on MT5 `MQL5\Files\` — triggers re-ingestion on TSV update | §5.1      |
| `pydantic`        | >=2.5   | Runtime dtype validation of ingested rows; Q1/Q2/Q3 config enforcement       | §5.1, §10 |
| `loguru`          | >=0.7   | Structured logging throughout the pipeline                                   | all       |
| `pytest`          | >=7.4   | Unit and integration testing                                                 | dev       |
| `black` / `ruff`  | latest  | Code formatting and linting                                                  | dev       |

---

## 3. Source Data Specifications

### 3.1 ZigZag-Export-v43.mq5 — Primary TSV Source

> **Resource:** `ZigZag-Export-v43.mq5`

The MQL5 indicator v1.43 appends one TSV row per **confirmed** ZigZag structural point. File location: `MQL5\Files\MarketStructureAnalysis_<SYMBOL>_<TF>.txt`. One additional **unconfirmed (live) row** is always appended as the last line — Python must strip it before any derivation.

#### 3.1.1 Export Header (15 columns)

```
TimeStamp  symbol  timeframe  close  Type  CurrentPoint  CurrentPrChg  Current%Chg
Current%ChgClass  CurrentBars  CurrentBarsClass  CurrentPrPerBar  CurrentPrPerBarClass
CurrentSlope  CurrentCategory
```

#### 3.1.2 Column Definitions

| Column                 | dtype            | Description                                                                                                                                                                         |
| ---------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TimeStamp`            | int64 (Unix UTC) | GMT Unix timestamp of the confirmed ZigZag bar                                                                                                                                      |
| `symbol`               | str              | MT5 symbol, e.g. `XAUUSD`                                                                                                                                                           |
| `timeframe`            | str              | Timeframe label, e.g. `M15`                                                                                                                                                         |
| `close`                | float64 (5 dp)   | Close price of the bar where ZZ point is confirmed                                                                                                                                  |
| `Type`                 | str              | `"Peak"` or `"Bottom"`                                                                                                                                                              |
| `CurrentPoint`         | float64 (5 dp)   | Price of the confirmed ZZ point (high for Peak, low for Bottom)                                                                                                                     |
| `CurrentPrChg`         | float64 (5 dp)   | Absolute price change from previous ZZ point                                                                                                                                        |
| `Current%Chg`          | float64 (2 dp)   | Percentage price change from previous ZZ point                                                                                                                                      |
| `Current%ChgClass`     | int 0–5          | **Pre-classified by MQL5** Z-Score bucket over 50-row window: 1=bull-normal, 2=bull-large, 3=bull-extreme, 4=bear-normal, 5=bear-large, 6=bear-extreme; thresholds Z1=1.41, Z2=1.88 |
| `CurrentBars`          | int              | Bar count from previous to current ZZ point                                                                                                                                         |
| `CurrentBarsClass`     | int 1–5          | **Pre-classified by MQL5** Bars Z-Score bucket (same threshold logic)                                                                                                               |
| `CurrentPrPerBar`      | float64 (5 dp)   | Price velocity = `CurrentPrChg / CurrentBars`                                                                                                                                       |
| `CurrentPrPerBarClass` | int 1–5          | **Pre-classified by MQL5** PrPerBar Z-Score bucket                                                                                                                                  |
| `CurrentSlope`         | float64 (4 dp)   | Segment slope in price units per bar                                                                                                                                                |
| `CurrentCategory`      | str              | `HH` / `HL` / `LH` / `LL` — market structure label                                                                                                                                  |

#### 3.1.3 Live-Row Handling

```python
df = df.iloc[:-1].reset_index(drop=True)   # always strip the last (unconfirmed) row
```

#### 3.1.4 TSV Reader

```python
import pandas as pd
from pathlib import Path

ZIGZAG_COLS = [
    'TimeStamp','symbol','timeframe','close','Type','CurrentPoint',
    'CurrentPrChg','Current%Chg','Current%ChgClass','CurrentBars',
    'CurrentBarsClass','CurrentPrPerBar','CurrentPrPerBarClass',
    'CurrentSlope','CurrentCategory'
]

def load_zigzag(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, sep='\t', header=0, names=ZIGZAG_COLS,
                     dtype={'TimeStamp':'int64','Current%ChgClass':'Int8',
                            'CurrentBarsClass':'Int8','CurrentPrPerBarClass':'Int8'})
    df = df.iloc[:-1].reset_index(drop=True)          # drop live row
    df['TimeStamp'] = pd.to_datetime(df['TimeStamp'], unit='s', utc=True)
    return df
```

---

### 3.2 fractal-horizontal-trendline-export-window-period-v4.mq5 — Supplementary Fractal TSV

> **Resource:** `fractal-horizontal-trendline-export-window-period-v4.mq5`

MQL5 indicator v5.60. Computes multi-point diagonal fractal trendlines across **3 configurable window periods** and exports one row per chart bar via an on-screen "Export Trendlines" button. File: `FractalTrendlines_<SYMBOL>_<TF>.txt`. This file is **supplementary** — not required for Q1/Q2/Q3 but can be merged on `timestamp` to enrich PostgreSQL rows with fractal trendline context.

#### 3.2.1 Export Header (12 columns)

```
timestamp  symbol  timeframe  close
horiz_peak_line_1_w1  horiz_bottom_line_1_w1
horiz_peak_line_1_w2  horiz_bottom_line_1_w2
horiz_peak_line_1_w3  horiz_bottom_line_1_w3
horiz_high_map  horiz_low_map
```

| Column                           | dtype               | Description                                                              |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| `timestamp`                      | int64 (Unix UTC)    | Unix timestamp of the bar                                                |
| `symbol` / `timeframe` / `close` | str / str / float64 | Same semantics as ZigZag export                                          |
| `horiz_peak_line_1_w1`           | float64 \| blank    | Price value of top-scoring resistance trendline for Window-1 at this bar |
| `horiz_bottom_line_1_w1`         | float64 \| blank    | Top-scoring support trendline for Window-1                               |
| `horiz_peak_line_1_w2`           | float64 \| blank    | Window-2 resistance trendline value                                      |
| `horiz_bottom_line_1_w2`         | float64 \| blank    | Window-2 support trendline value                                         |
| `horiz_peak_line_1_w3`           | float64 \| blank    | Window-3 resistance trendline value                                      |
| `horiz_bottom_line_1_w3`         | float64 \| blank    | Window-3 support trendline value                                         |
| `horiz_high_map`                 | float64 \| blank    | Raw fractal high map price at this bar                                   |
| `horiz_low_map`                  | float64 \| blank    | Raw fractal low map price at this bar                                    |

#### 3.2.2 Window Period Configuration (MQL5 inputs)

| Parameter                     | Default                | Description                                                    |
| ----------------------------- | ---------------------- | -------------------------------------------------------------- |
| `InpStartBar1` / `InpEndBar1` | 500 / 100              | Window-1 bar range                                             |
| `InpStartBar2` / `InpEndBar2` | 750 / 350              | Window-2 bar range                                             |
| `InpStartBar3` / `InpEndBar3` | 1000 / 600             | Window-3 bar range                                             |
| `InpScoringPreset`            | `ULTRA_PURE_STRUCTURE` | Scoring weights: fractals=45, slope=20, length=30, proximity=5 |
| `InpMinFractalTouch`          | 4                      | Minimum fractal touches for a line to qualify                  |

#### 3.2.3 Fractal TSV Reader

```python
FRACTAL_COLS = [
    'timestamp','symbol','timeframe','close',
    'horiz_peak_line_1_w1','horiz_bottom_line_1_w1',
    'horiz_peak_line_1_w2','horiz_bottom_line_1_w2',
    'horiz_peak_line_1_w3','horiz_bottom_line_1_w3',
    'horiz_high_map','horiz_low_map'
]

def load_fractal(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, sep='\t', header=0, names=FRACTAL_COLS)
    # blank cells arrive as NaN — correct behaviour, no fill needed
    df['timestamp'] = pd.to_datetime(df['timestamp'], unit='s', utc=True)
    return df
```

---

## 4. Target Schema — dataformat (167 Columns)

> **Resources:** `v43_dataformat.xlsx`, `ZigZag_ColumnMapping_v43.xlsx`

The target DataFrame (and PostgreSQL table) has **167 columns**. Columns 1–15 map directly from the ZigZag TSV. **Columns 16–167 (152 columns) are all derived in Python.**

| Column Range | dataformat Cols | Count | Group                                                                           |
| ------------ | --------------- | ----- | ------------------------------------------------------------------------------- |
| A–F          | 1–6             | 6     | Raw identity: TimeStamp, symbol, timeframe, close, Type, CurrentPoint           |
| G–Q          | 7–17            | 11    | `NthPrevPoint` for N ∈ {2,4,6,8,10,12,14,16,18,20,22}                           |
| R–AC         | 18–29           | 12    | `CurrentPrChg` + 11 × `NthPrevPrChg`                                            |
| AD–AO        | 30–41           | 12    | `Current%Chg` + 11 × `NthPrev%Chg`                                              |
| AP–BA        | 42–53           | 12    | `Current%ChgClass` + 11 × `NthPrev%ChgClass`                                    |
| BB–BM        | 54–65           | 12    | `CurrentBars` + 11 × `NthPrevBars`                                              |
| BN–BY        | 66–77           | 12    | `CurrentBarsClass` + 11 × `NthPrevBarsClass`                                    |
| BZ–CK        | 78–89           | 12    | `CurrentPrPerBar` + 11 × `NthPrevPrPerBar`                                      |
| CL–CW        | 90–101          | 12    | `CurrentPrPerBarClass` + 11 × `NthPrevPrPerBarClass`                            |
| CX–DI        | 102–113         | 12    | `CurrentSlope` + 11 × `NthPrevSlope`                                            |
| DJ–DU        | 114–125         | 12    | `CurrentCategory` + 11 × `NthPrevCategory`                                      |
| DV–EF        | 126–136         | 11    | `2Prev%Diff` … `22Prev%Diff`                                                    |
| EG–EQ        | 137–147         | 11    | `2PrevEQHL` … `22PrevEQHL` (`""` / `"EQH"` / `"EQL"`)                           |
| ER–EV        | 148–152         | 5     | `SR_Count` (0–4) + `SR_1`, `SR_2`, `SR_3`, `SR_4` (prices, deduped, descending) |
| EW–FG        | 153–163         | 11    | `2PrevImpEQHL` … `22PrevImpEQHL` (`""` / `"IEQH"` / `"IEQL"`)                   |
| FH–FK        | 164–167         | 4     | `ThumbUpPoint`, `ThumbUpType`, `ThumbDownPoint`, `ThumbDownType`                |

**Total: 167 columns (15 raw + 152 derived)**

---

## 5. Data Pipeline Architecture

### 5.1 Ingestion Layer

> **Resources:** `ZigZag-Export-v43.mq5`, `fractal-horizontal-trendline-export-window-period-v4.mq5`

`watchdog` monitors `MQL5\Files\`. On file modification, re-read the complete TSV and pass to the TransformEngine. Both TSV files are append-only; re-reading the full file is safe and correct.

```python
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class TSVHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if 'MarketStructureAnalysis' in event.src_path:
            df = load_zigzag(Path(event.src_path))
            df = TransformEngine().run(df)
            repository.upsert_batch(df, engine)
```

### 5.2 Transformation Layer

> **Resources:** `v43_calculationlogic.xlsx`, `ZigZag_ColumnMapping_v43.xlsx`

`TransformEngine.run(df)` executes all six phases in sequence and returns the 167-column DataFrame. See §6 for full phase specifications.

### 5.3 Storage Layer

> **Resource:** `v43_dataformat.xlsx`

```python
from sqlalchemy import create_engine

engine = create_engine('postgresql+psycopg2://user:pass@localhost/zzdb')

# Upsert on composite PK (TimeStamp, symbol, timeframe)
df.to_sql('zigzag_market_structure', engine,
          if_exists='append', index=False,
          method='multi', chunksize=500)
```

---

## 6. Transformation Engine — 152 Derived Columns

> **Resources:** `v43_calculationlogic.xlsx`, `ZigZag_ColumnMapping_v43.xlsx`, `v43_dataformat.xlsx`

All six phases execute in order. The output after Phase 6 is the complete 167-column dataformat DataFrame.

```python
STEPS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]   # N values for NthPrev
```

---

### Phase 1 — NthPrev Columns (110 columns, dataformat G–DU)

For every raw attribute, derive 11 NthPrev variants using `pandas.shift()`. The shift index is `N // 2` because every confirmed ZZ row advances the pointer by exactly 1 DataFrame row (alternating Peak/Bottom).

| Attribute (Current col)     | NthPrev dataformat range         | Python shift                             |
| --------------------------- | -------------------------------- | ---------------------------------------- |
| `CurrentPoint` (F)          | G–Q: `2PrevPoint`…`22PrevPoint`  | `df['CurrentPoint'].shift(n//2)`         |
| `CurrentPrChg` (R)          | S–AC: `2PrevPrChg`…`22PrevPrChg` | `df['CurrentPrChg'].shift(n//2)`         |
| `Current%Chg` (AD)          | AE–AO                            | `df['Current%Chg'].shift(n//2)`          |
| `Current%ChgClass` (AP)     | AQ–BA                            | `df['Current%ChgClass'].shift(n//2)`     |
| `CurrentBars` (BB)          | BC–BM                            | `df['CurrentBars'].shift(n//2)`          |
| `CurrentBarsClass` (BN)     | BO–BY                            | `df['CurrentBarsClass'].shift(n//2)`     |
| `CurrentPrPerBar` (BZ)      | CA–CK                            | `df['CurrentPrPerBar'].shift(n//2)`      |
| `CurrentPrPerBarClass` (CL) | CM–CW                            | `df['CurrentPrPerBarClass'].shift(n//2)` |
| `CurrentSlope` (CX)         | CY–DI                            | `df['CurrentSlope'].shift(n//2)`         |
| `CurrentCategory` (DJ)      | DK–DU                            | `df['CurrentCategory'].shift(n//2)`      |

```python
RAW_ATTRS = [
    'CurrentPoint','CurrentPrChg','Current%Chg','Current%ChgClass',
    'CurrentBars','CurrentBarsClass','CurrentPrPerBar',
    'CurrentPrPerBarClass','CurrentSlope','CurrentCategory'
]

for attr in RAW_ATTRS:
    short = attr[7:]   # strip "Current" prefix → "Point", "PrChg", etc.
    for n in STEPS:
        df[f'{n}Prev{short}'] = df[attr].shift(n // 2)
```

---

### Phase 2 — Percentage Difference (11 columns, dataformat DV–EF)

Measures how far each historical ZZ pivot sits from the current price, as a percentage.

> **Column alignment (v1.1):** After separator removal, calculationlogic DV–EF = dataformat DV–EF (identical column letters).

**Formula (from `v43_calculationlogic.xlsx` V43_New sheet):**

```
=(NthPrevPoint − CurrentPoint) / CurrentPoint × 100
```

```python
for n in STEPS:
    df[f'{n}Prev%Diff'] = (df[f'{n}PrevPoint'] - df['CurrentPoint']) / df['CurrentPoint'] * 100
```

---

### Phase 3 — EQHL Labels (11 columns, dataformat EG–EQ)

> **Column alignment (v1.1):** After separator removal, calculationlogic EG–EQ = dataformat EG–EQ (identical column letters).

Identifies Equal High (`EQH`) and Equal Low (`EQL`) patterns: a prior ZZ point whose price is within 0.25% of the current price, with matching Type and structure category.

**Rules:**

- `EQL`: `|NthPrev%Diff| ≤ 0.25` AND `Type = "Bottom"` AND `NthPrevCategory = "LL"`
- `EQH`: `|NthPrev%Diff| ≤ 0.25` AND `Type = "Peak"` AND `NthPrevCategory = "HH"`
- Otherwise: `""` (blank)

```python
for n in STEPS:
    diff = df[f'{n}Prev%Diff'].abs()
    cat  = df[f'{n}PrevCategory']
    eqhl = pd.Series('', index=df.index)
    mask_eql = (diff <= 0.25) & (df['Type'] == 'Bottom') & (cat == 'LL')
    mask_eqh = (diff <= 0.25) & (df['Type'] == 'Peak')   & (cat == 'HH')
    eqhl = eqhl.where(~mask_eql, 'EQL')
    eqhl = eqhl.where(~mask_eqh, 'EQH')
    df[f'{n}PrevEQHL'] = eqhl
```

---

### Phase 4 — S&R Compact Format (5 columns, dataformat ER–EV)

From the 11 sparse NthPrevS&R prices, generate a compact deduplicated descending list of up to 4 active S&R price levels. `SR_Count` holds the integer count (0–4).

> **Column alignment (v1.1):** In `v43_calculationlogic.xlsx` (V43_New sheet) the 11 sparse S&R helper columns occupy **ER–FB (cols 148–158)**. These are intermediate calculation columns with no direct 1:1 counterpart in dataformat. The 5 compact dataformat columns ER–EV (SR_Count, SR_1–4) are the Python-derived output of aggregating those 11 sparse columns.

**Logic:** For each row, collect `NthPrevPoint` wherever `NthPrevEQHL` is non-blank → deduplicate (round to 2 dp) → sort descending → take first 4.

```python
SR_EQHL_COLS  = [f'{n}PrevEQHL'  for n in STEPS]
SR_POINT_COLS = [f'{n}PrevPoint' for n in STEPS]

def compute_sr(row):
    prices = set()
    for eq_col, pt_col in zip(SR_EQHL_COLS, SR_POINT_COLS):
        if row[eq_col] in ('EQH', 'EQL'):
            prices.add(round(row[pt_col], 2))
    sorted_p = sorted(prices, reverse=True)[:4]
    return [len(sorted_p)] + sorted_p + [None] * (4 - len(sorted_p))

sr_data = df.apply(compute_sr, axis=1, result_type='expand')
sr_data.columns = ['SR_Count', 'SR_1', 'SR_2', 'SR_3', 'SR_4']
df = pd.concat([df, sr_data], axis=1)
```

> **Performance note:** For >10,000 rows, replace `apply()` with vectorised `np.where` stacking and `nlargest`. The `apply()` shown above is correct and fine for typical ZigZag histories (≤2,000 rows).

---

### Phase 5 — Impactful EQHL (11 columns, dataformat EW–FG)

> **Column alignment (v1.1):** In `v43_calculationlogic.xlsx` (V43_New sheet) the ImpEQHL columns are at **FC–FM (cols 159–169)** — 6 positions ahead of the dataformat EW–FG (cols 153–163). This +6 offset arises because calculationlogic carries 11 sparse S&R cols (ER–FB) while dataformat uses only 5 compact cols (ER–EV).

Escalates an EQHL event to "Impactful" (`IEQH`/`IEQL`) only when the associated NthPrev price-change class indicates a large or extreme move. Filters out weak consolidation touches.

**Rules:**

- `IEQL`: `NthPrevEQHL = "EQL"` AND `NthPrev%ChgClass ∈ {4, 5}` (bear-large or bear-extreme)
- `IEQH`: `NthPrevEQHL = "EQH"` AND `NthPrev%ChgClass ∈ {1, 2}` (bull-large or bull-extreme)
- Otherwise: `""` (blank)

```python
for n in STEPS:
    eqhl_col  = f'{n}PrevEQHL'
    class_col = f'{n}Prev%ChgClass'
    imp = pd.Series('', index=df.index)
    imp = imp.where(~((df[eqhl_col] == 'EQL') & (df[class_col].isin([4, 5]))), 'IEQL')
    imp = imp.where(~((df[eqhl_col] == 'EQH') & (df[class_col].isin([1, 2]))), 'IEQH')
    df[f'{n}PrevImpEQHL'] = imp
```

---

### Phase 6 — ThumbUp/ThumbDown Structural Anchors (4 columns, dataformat FH–FK)

> **Column alignment (v1.1):** In `v43_calculationlogic.xlsx` (V43_New sheet) the ThumbUp/Down columns are at **FN–FQ (cols 170–173)** — 6 positions ahead of the dataformat FH–FK (cols 164–167), for the same reason as Phase 5 (+6 offset).

Identifies structurally significant turning points used as trendline anchors in Q3.

**ThumbUpPoint rule — set `CurrentPoint` when:**

```
(CurrentCategory = "LL" AND Current%ChgClass = 5)   ← extreme bearish LL
OR
(CurrentCategory = "HH" AND Current%ChgClass = 2)   ← large bullish HH
```

**ThumbDownPoint:** the `CurrentPoint` of the **immediately preceding** ZigZag row whenever a ThumbUpPoint exists on the current row.

```python
# Phase 6a — ThumbUpPoint and ThumbUpType
thumb_up_mask = (
    ((df['CurrentCategory'] == 'LL') & (df['Current%ChgClass'] == 5)) |
    ((df['CurrentCategory'] == 'HH') & (df['Current%ChgClass'] == 2))
)
df['ThumbUpPoint'] = df['CurrentPoint'].where(thumb_up_mask, other=None)
df['ThumbUpType']  = df['Type'].where(thumb_up_mask, other='')

# Phase 6b — ThumbDownPoint and ThumbDownType
prev_point = df['CurrentPoint'].shift(1)
df['ThumbDownPoint'] = prev_point.where(thumb_up_mask, other=None)
df['ThumbDownType']  = df['ThumbUpType'].map(
    {'Peak': 'Bottom', 'Bottom': 'Peak', '': ''}
)
```

---

## 7. PostgreSQL Storage Schema

> **Resource:** `v43_dataformat.xlsx`

### 7.1 Table DDL (abridged)

```sql
CREATE TABLE zigzag_market_structure (
    time_stamp              TIMESTAMPTZ    NOT NULL,
    symbol                  VARCHAR(20)    NOT NULL,
    timeframe               VARCHAR(5)     NOT NULL,
    close                   NUMERIC(18,5),
    type                    VARCHAR(10),         -- 'Peak' | 'Bottom'
    current_point           NUMERIC(18,5),
    -- NthPrevPoint group (11 cols): prev_2_point … prev_22_point
    -- PrChg, %Chg, %ChgClass groups (10 attributes × 12 cols each = 110 cols)
    -- Category group (12 cols)
    -- %Diff group (11 cols): prev_2_pct_diff … prev_22_pct_diff
    -- EQHL group (11 cols): VARCHAR(5)
    sr_count                SMALLINT,
    sr_1                    NUMERIC(18,2),
    sr_2                    NUMERIC(18,2),
    sr_3                    NUMERIC(18,2),
    sr_4                    NUMERIC(18,2),
    -- ImpEQHL group (11 cols): VARCHAR(6)
    thumb_up_point          NUMERIC(18,5),
    thumb_up_type           VARCHAR(10),
    thumb_down_point        NUMERIC(18,5),
    thumb_down_type         VARCHAR(10),
    PRIMARY KEY (time_stamp, symbol, timeframe)
);
```

### 7.2 Upsert Pattern

```python
from sqlalchemy.dialects.postgresql import insert

def upsert_batch(df: pd.DataFrame, engine) -> None:
    records = df.to_dict(orient='records')
    stmt = insert(ZigZagRow).values(records)
    stmt = stmt.on_conflict_do_update(
        index_elements=['time_stamp', 'symbol', 'timeframe'],
        set_={c.key: c for c in stmt.excluded if c.key not in
              ['time_stamp', 'symbol', 'timeframe']}
    )
    with engine.begin() as conn:
        conn.execute(stmt)
```

---

## 8. Configurable Query Engine — Q1, Q2, Q3

### Configuration Parameters

| Parameter              | Q1  | Q2  | Q3  | Default | Description                                               |
| ---------------------- | --- | --- | --- | ------- | --------------------------------------------------------- |
| `lookback_n`           | ✓   | ✓   | —   | 100     | ZZ rows to scan for S&R levels                            |
| `max_k`                | ✓   | ✓   | —   | 5       | Max S&R levels above AND below current price              |
| `tol_pct`              | ✓   | ✓   | —   | 0.05%   | Cluster-collapse tolerance for nearby levels              |
| `lookback_m`           | —   | —   | ✓   | 150     | ZZ rows to scan for trendline anchors                     |
| `min_bar_gap_green`    | —   | —   | ✓   | 3       | Min bars between two Green anchors                        |
| `max_slope_pct_violet` | —   | —   | ✓   | 2.0     | Max % price-change per bar for Violet lines               |
| `max_dist_pct_violet`  | —   | —   | ✓   | 3.0     | Max % deviation of line value at bar 0 from current close |
| `min_touch_violet`     | —   | —   | ✓   | 2       | Connect to Next-N peak/bottom (default Next-2)            |

---

### 8.1 Q1 — Horizontal Support & Resistance

> **Resource:** `v43_dataformat.xlsx` — columns `SR_Count`, `SR_1`–`SR_4` (dataformat ER–EV; derived in Python from calculationlogic sparse ER–FB)

**Algorithm:**

1. Fetch last `N` confirmed ZZ rows.
2. `current_close` = last row's `close`.
3. Collect all non-null values from `SR_1`, `SR_2`, `SR_3`, `SR_4` across all N rows.
4. Deduplicate (round to 2 dp); cluster-collapse levels within `tol_pct`% of each other.
5. Partition into `above` (> close, sort ascending) and `below` (< close, sort descending).
6. Return first `K` from each partition.

```python
def q1_horizontal_sr(df: pd.DataFrame,
                     lookback_n: int = 100,
                     max_k: int = 5,
                     tol_pct: float = 0.05) -> dict:
    window = df.tail(lookback_n)
    close  = float(df.iloc[-1]['close'])
    prices = []
    for col in ['SR_1', 'SR_2', 'SR_3', 'SR_4']:
        prices += window[col].dropna().tolist()
    deduped   = sorted(set(round(p, 2) for p in prices))
    collapsed = _cluster_collapse(deduped, tol_pct)
    above = sorted([p for p in collapsed if p > close])[:max_k]
    below = sorted([p for p in collapsed if p < close], reverse=True)[:max_k]
    return {'above': above, 'below': below, 'current_close': close}

def _cluster_collapse(prices: list, tol_pct: float) -> list:
    """Merge prices within tol_pct % of each other into a single representative."""
    if not prices:
        return []
    result = [prices[0]]
    for p in prices[1:]:
        if abs(p - result[-1]) / result[-1] * 100 > tol_pct:
            result.append(p)
    return result
```

---

### 8.2 Q2 — Impactful Horizontal S&R (IEQH/IEQL Only)

> **Resource:** `v43_dataformat.xlsx` — columns `2PrevImpEQHL`…`22PrevImpEQHL` (dataformat EW–FG; calculationlogic FC–FM) and `2PrevPoint`…`22PrevPoint` (G–Q)

Same algorithm as Q1, but price levels are sourced exclusively from rows where `NthPrevImpEQHL ∈ {"IEQH", "IEQL"}`. The associated price is `NthPrevPoint` (not the compact SR format).

```python
IMP_EQHL_COLS  = [f'{n}PrevImpEQHL' for n in STEPS]
NTH_POINT_COLS = [f'{n}PrevPoint'   for n in STEPS]

def q2_important_sr(df: pd.DataFrame,
                    lookback_n: int = 100,
                    max_k: int = 5,
                    tol_pct: float = 0.05) -> dict:
    window = df.tail(lookback_n)
    close  = float(df.iloc[-1]['close'])
    prices = []
    for imp_col, pt_col in zip(IMP_EQHL_COLS, NTH_POINT_COLS):
        mask    = window[imp_col].isin(['IEQH', 'IEQL'])
        prices += window.loc[mask, pt_col].dropna().tolist()
    deduped   = sorted(set(round(p, 2) for p in prices))
    collapsed = _cluster_collapse(deduped, tol_pct)
    above = sorted([p for p in collapsed if p > close])[:max_k]
    below = sorted([p for p in collapsed if p < close], reverse=True)[:max_k]
    return {'above': above, 'below': below, 'current_close': close}
```

---

### 8.3 Q3 — Green & Violet ZigZag Trendlines

> **Resources:** `Green-Trendline.jpg`, `Violet-Trendline.jpg`, `v43_dataformat.xlsx` (ThumbUpPoint dataformat col FH; calculationlogic col FN — ThumbDownPoint dataformat col FJ; calculationlogic col FP)

#### 8.3.1 Anchor Extraction

```python
def extract_anchors(df: pd.DataFrame, lookback_m: int = 150) -> pd.DataFrame:
    window  = df.tail(lookback_m)
    anchors = window[window['ThumbUpPoint'].notna()][[
        'TimeStamp', 'ThumbUpPoint', 'ThumbUpType',
        'ThumbDownPoint', 'ThumbDownType'
    ]].copy().reset_index(drop=True)

    anchors['peak_price'] = anchors.apply(
        lambda r: r['ThumbUpPoint']   if r['ThumbUpType']   == 'Peak'
             else r['ThumbDownPoint'], axis=1)
    anchors['bottom_price'] = anchors.apply(
        lambda r: r['ThumbUpPoint']   if r['ThumbUpType']   == 'Bottom'
             else r['ThumbDownPoint'], axis=1)
    return anchors
```

#### 8.3.2 Green Trendlines

**Rules from `Green-Trendline.jpg`:**

1. Identify ThumbUp/ThumbDown Peaks and Bottoms as anchors.
2. **Peaks:** connect each Peak anchor to the immediately **next** Peak. If bar distance < `min_bar_gap`, skip and connect to **Next-2** instead.
3. **Bottoms:** same rule — next Bottom (or Next-2 if too close).
4. Project the line slope forward to bar 0 (current bar) by linear extrapolation.

```python
def build_green_trendlines(anchors: pd.DataFrame,
                           bar_data: pd.DataFrame,
                           min_bar_gap: int = 3) -> list[dict]:
    results = []
    for kind, price_col in [('peak', 'peak_price'), ('bottom', 'bottom_price')]:
        pts = anchors[anchors[price_col].notna()][
            ['TimeStamp', price_col]].reset_index(drop=True)
        for i in range(len(pts) - 1):
            j      = i + 1
            bar_gap = _bar_distance(pts.iloc[i]['TimeStamp'],
                                    pts.iloc[j]['TimeStamp'], bar_data)
            if bar_gap < min_bar_gap and j + 1 < len(pts):
                j += 1   # skip to Next-2
            seg = {
                'type':        kind,
                'color':       'green',
                'ts_start':    pts.iloc[i]['TimeStamp'],
                'price_start': pts.iloc[i][price_col],
                'ts_end':      pts.iloc[j]['TimeStamp'],
                'price_end':   pts.iloc[j][price_col],
            }
            seg['price_at_current'] = _extrapolate(seg, bar_data)
            results.append(seg)
    return results
```

#### 8.3.3 Violet Trendlines

**Rules from `Violet-Trendline.jpg`:**

1. Use the same ThumbUp/ThumbDown Peak and Bottom anchors.
2. **Peaks:** connect each Peak to **Next-2 Peak or further** (Next-3, 4, 5 — prefer the furthest valid one). Valid = both constraints satisfied:
   - **Slope constraint:** `|slope| ≤ max_slope_pct_violet %` price-change per bar.
   - **Proximity constraint:** extrapolated line price at bar 0 must be within `max_dist_pct_violet %` of current close.
3. **Bottoms:** same rules.

```python
def build_violet_trendlines(anchors: pd.DataFrame,
                             bar_data: pd.DataFrame,
                             min_touch: int = 2,
                             max_slope_pct: float = 2.0,
                             max_dist_pct: float = 3.0) -> list[dict]:
    results       = []
    current_close = float(bar_data.iloc[-1]['close'])

    for kind, price_col in [('peak', 'peak_price'), ('bottom', 'bottom_price')]:
        pts = anchors[anchors[price_col].notna()][
            ['TimeStamp', price_col]].reset_index(drop=True)

        for i in range(len(pts)):
            # Try Next-2 through Next-5
            for j in range(i + min_touch, min(i + 6, len(pts))):
                bars = _bar_distance(pts.iloc[i]['TimeStamp'],
                                     pts.iloc[j]['TimeStamp'], bar_data)
                if bars == 0:
                    continue
                pct_slope = (abs(pts.iloc[j][price_col] - pts.iloc[i][price_col])
                             / (pts.iloc[i][price_col] * bars) * 100)
                if pct_slope > max_slope_pct:
                    continue   # too steep
                seg = {
                    'type':        kind,
                    'color':       'violet',
                    'ts_start':    pts.iloc[i]['TimeStamp'],
                    'price_start': pts.iloc[i][price_col],
                    'ts_end':      pts.iloc[j]['TimeStamp'],
                    'price_end':   pts.iloc[j][price_col],
                }
                p_at_cur  = _extrapolate(seg, bar_data)
                dist_pct  = abs(p_at_cur - current_close) / current_close * 100
                if dist_pct > max_dist_pct:
                    continue   # too far from current price
                seg['price_at_current'] = p_at_cur
                results.append(seg)
                break   # take first valid j, move to next i
    return results
```

#### 8.3.4 Shared Helpers

```python
def _bar_distance(ts_a, ts_b, bar_data: pd.DataFrame) -> int:
    """Return number of ZZ rows between two timestamps."""
    idx_a = bar_data[bar_data['TimeStamp'] == ts_a].index
    idx_b = bar_data[bar_data['TimeStamp'] == ts_b].index
    if idx_a.empty or idx_b.empty:
        return 0
    return abs(int(idx_b[0]) - int(idx_a[0]))

def _extrapolate(seg: dict, bar_data: pd.DataFrame) -> float:
    """Extrapolate trendline slope to current (last) bar."""
    bars_total = _bar_distance(seg['ts_start'], bar_data.iloc[-1]['TimeStamp'], bar_data)
    seg_bars   = _bar_distance(seg['ts_start'], seg['ts_end'], bar_data)
    if seg_bars == 0:
        return seg['price_start']
    slope = (seg['price_end'] - seg['price_start']) / seg_bars
    return seg['price_start'] + slope * bars_total
```

---

## 9. Module & File Structure

```
zigzag_analysis/
├── ingest/
│   ├── zigzag_reader.py       # load_zigzag() — ZigZag-Export-v43 TSV
│   ├── fractal_reader.py      # load_fractal() — fractal trendline TSV
│   └── watcher.py             # watchdog FileSystemEventHandler
├── transform/
│   ├── engine.py              # TransformEngine.run(df) — orchestrates phases 1–6
│   ├── nth_prev.py            # Phase 1: shift-based NthPrev columns
│   ├── pct_diff.py            # Phase 2: %Diff computation
│   ├── eqhl.py                # Phase 3: EQHL labelling
│   ├── sr_compact.py          # Phase 4: SR_Count / SR_1–4
│   ├── imp_eqhl.py            # Phase 5: ImpEQHL labelling
│   └── thumbpoints.py         # Phase 6: ThumbUp/ThumbDown anchors
├── storage/
│   ├── models.py              # SQLAlchemy ORM — 167-col table
│   └── repository.py          # upsert_batch(df, engine)
├── queries/
│   ├── q1_horizontal_sr.py    # Q1 query function + _cluster_collapse helper
│   ├── q2_important_sr.py     # Q2 query function
│   └── q3_trendlines.py       # Q3: extract_anchors, build_green, build_violet, helpers
├── config.py                  # pydantic Settings — all Q parameters + file paths
├── pipeline.py                # Orchestrator: watch → ingest → transform → store
├── viz/
│   └── chart.py               # plotly/matplotlib debug overlay
└── tests/
    ├── test_transform.py       # Validate Phase 1–6 output vs v43_dataformat.xlsx rows
    ├── test_q1_q2.py
    └── test_q3_trendlines.py
```

---

## 10. Configuration Schema

```python
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # File paths
    zigzag_tsv_path:         Path  = Path('MQL5/Files/MarketStructureAnalysis_XAUUSD_M15.txt')
    fractal_tsv_path:        Path  = Path('MQL5/Files/FractalTrendlines_XAUUSD_M15.txt')
    # Database
    db_url:                  str   = 'postgresql+psycopg2://user:pass@localhost/zzdb'
    # Q1
    q1_lookback_n:           int   = 100
    q1_max_k:                int   = 5
    q1_tol_pct:              float = 0.05
    # Q2
    q2_lookback_n:           int   = 100
    q2_max_k:                int   = 5
    q2_tol_pct:              float = 0.05
    # Q3
    q3_lookback_m:           int   = 150
    q3_min_bar_gap_green:    int   = 3
    q3_min_touch_violet:     int   = 2
    q3_max_slope_pct_violet: float = 2.0
    q3_max_dist_pct_violet:  float = 3.0

    class Config:
        env_file = '.env'   # all params overridable via environment variables
```

---

## 11. Column Mapping Quick Reference

> **Resource:** `ZigZag_ColumnMapping_v43.xlsx` — authoritative cross-reference

> **v1.1 Note:** The 5 separator columns (DV, EH, ET, FF, FR) have been removed from `v43_calculationlogic.xlsx`. The calculationlogic file is now 173 columns (was 178). All offsets for G2 and G3 are now zero — those groups are column-letter identical between both files. G5 and G6 now carry a +6 offset (11 sparse S&R vs 5 compact S&R = 6-column difference).

Consult `ZigZag_ColumnMapping_v43.xlsx` when implementing any formula. The structural groups and their column offsets between the two Excel files are:

| Group                 | dataformat Range                | calculationlogic Range          | Offset | Notes                                                                                                 |
| --------------------- | ------------------------------- | ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| G1 — Identical (A–DU) | A–DU (cols 1–125)               | A–DU (cols 1–125)               | 0      | All raw + NthPrev columns — identical in both files                                                   |
| G2 — %Diff            | DV–EF (cols 126–136)            | DV–EF (cols 126–136)            | 0      | **Now identical** — separator DV removed from calculationlogic                                        |
| G3 — EQHL             | EG–EQ (cols 137–147)            | EG–EQ (cols 137–147)            | 0      | **Now identical** — separators EH removed from calculationlogic                                       |
| G4 — S&R              | ER–EV (cols 148–152, 5 compact) | ER–FB (cols 148–158, 11 sparse) | N/A    | dataformat: 5 compact (SR_Count + SR_1–4); calculationlogic: 11 sparse NthPrevS&R (intermediate step) |
| G5 — ImpEQHL          | EW–FG (cols 153–163)            | FC–FM (cols 159–169)            | +6     | Calc is 6 cols ahead: 11 sparse S&R vs 5 compact = 6-col difference                                   |
| G6 — ThumbUp/Down     | FH–FK (cols 164–167)            | FN–FQ (cols 170–173)            | +6     | Same +6 offset as G5                                                                                  |
| G7 — Separators       | —                               | _(removed)_                     | N/A    | DV, EH, ET, FF, FR were removed — no longer present in calculationlogic                               |

---

## 12. Implementation Checklist for Claude Code

Execute tasks in order. Each task states which resource(s) to read and which section contains the full spec.

| #   | Task                                                                                 | Resource(s)                                                  | Section    |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---------- |
| 1   | Implement `load_zigzag()` with live-row stripping and dtype casting                  | `ZigZag-Export-v43.mq5`                                      | §3.1.4     |
| 2   | Implement `load_fractal()` (supplementary)                                           | `fractal-horizontal-trendline-export-window-period-v4.mq5`   | §3.2.3     |
| 3   | Implement `watchdog` watcher for both TSV paths                                      | —                                                            | §5.1       |
| 4   | Implement Phase 1: NthPrev columns (110 cols) via `pandas.shift()`                   | `v43_calculationlogic.xlsx`, `ZigZag_ColumnMapping_v43.xlsx` | §6 Phase 1 |
| 5   | Implement Phase 2: %Diff (11 cols)                                                   | `v43_calculationlogic.xlsx`                                  | §6 Phase 2 |
| 6   | Implement Phase 3: EQHL labelling (11 cols)                                          | `v43_calculationlogic.xlsx`                                  | §6 Phase 3 |
| 7   | Implement Phase 4: SR compact format (5 cols)                                        | `v43_calculationlogic.xlsx`, `v43_dataformat.xlsx`           | §6 Phase 4 |
| 8   | Implement Phase 5: ImpEQHL labelling (11 cols)                                       | `v43_calculationlogic.xlsx`                                  | §6 Phase 5 |
| 9   | Implement Phase 6: ThumbUp/ThumbDown anchors (4 cols)                                | `v43_calculationlogic.xlsx`, `v43_dataformat.xlsx`           | §6 Phase 6 |
| 10  | Write unit tests — compare Phase 1–6 output against `v43_dataformat.xlsx` known rows | `v43_dataformat.xlsx`                                        | dev        |
| 11  | Define SQLAlchemy ORM model (167 cols matching `v43_dataformat.xlsx`)                | `v43_dataformat.xlsx`                                        | §7         |
| 12  | Implement `repository.upsert_batch()` with composite PK conflict handling            | —                                                            | §7.2       |
| 13  | Implement Q1 horizontal S&R query function                                           | `v43_dataformat.xlsx`                                        | §8.1       |
| 14  | Implement Q2 impactful S&R query function                                            | `v43_dataformat.xlsx`                                        | §8.2       |
| 15  | Implement `extract_anchors()` from ThumbUpPoint/ThumbDownPoint                       | `v43_dataformat.xlsx`                                        | §8.3.1     |
| 16  | Implement Green trendline builder (Peak→Next, min_bar_gap rule)                      | `Green-Trendline.jpg`                                        | §8.3.2     |
| 17  | Implement Violet trendline builder (Next-2+, slope + proximity constraints)          | `Violet-Trendline.jpg`                                       | §8.3.3     |
| 18  | Wire `pipeline.py` orchestrator: watch → ingest → transform → upsert                 | —                                                            | §5         |
| 19  | Implement pydantic `Settings` with all Q1/Q2/Q3 configurable parameters              | —                                                            | §10        |
| 20  | End-to-end validation against a known XAUUSD M15 export snapshot                     | `v43_dataformat.xlsx`                                        | dev        |

---

## 13. Appendix — Key Formula Reference

> **Resources:** `v43_calculationlogic.xlsx`, `ZigZag_ColumnMapping_v43.xlsx`

Column letters shown are from **`v43_calculationlogic.xlsx` (V43_New sheet — post separator-removal, 173 cols)**. For G1–G3 the letters are identical to `v43_dataformat.xlsx`; for G5–G6 use the +6 offset from §11 to find the dataformat column.

| Column Group                   | calculationlogic Col | dataformat Col                                        | Excel Formula (calculationlogic, row 2)                                                                   | Python Equivalent                                                    |
| ------------------------------ | -------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `2PrevPoint`                   | G                    | G                                                     | `=F2` [shift 1 row]                                                                                       | `df['2PrevPoint'] = df['CurrentPoint'].shift(1)`                     |
| `2Prev%Diff`                   | DV                   | DV                                                    | `=(G2 - F2) / F2 * 100`                                                                                   | `(df['2PrevPoint'] - df['CurrentPoint']) / df['CurrentPoint'] * 100` |
| `2PrevEQHL`                    | EG                   | EG                                                    | `=IF(AND(ABS(DV2)<=0.25,E2="Bottom",DK2="LL"),"EQL",IF(AND(ABS(DV2)<=0.25,E2="Peak",DK2="HH"),"EQH",""))` | See §6 Phase 3                                                       |
| `2PrevS&R` (sparse, calc only) | ER                   | _(no direct equiv — aggregated into SR_Count/SR_1–4)_ | `=IF(OR(EG2="EQL",EG2="EQH"),G2,"")`                                                                      | `NthPrevPoint` where `NthPrevEQHL != ""`                             |
| `SR_Count` (compact)           | _(derived)_          | ER                                                    | Python aggregate from ER–FB                                                                               | `len(sr_prices)` — see §6 Phase 4                                    |
| `SR_1` (compact)               | _(derived)_          | ES                                                    | Python aggregate from ER–FB                                                                               | `sorted(sr_prices, reverse=True)[0]`                                 |
| `2PrevImpEQHL`                 | FC                   | EW                                                    | `=IF(AND(EG2="EQL",OR(AQ2=4,AQ2=5)),"IEQL",IF(AND(EG2="EQH",OR(AQ2=1,AQ2=2)),"IEQH",""))`                 | See §6 Phase 5                                                       |
| `ThumbUpPoint`                 | FN                   | FH                                                    | `=IF(OR(AND(DJ2="LL",AP2=5),AND(DJ2="HH",AP2=2)),F2,"")`                                                  | See §6 Phase 6                                                       |
| `ThumbUpType`                  | FO                   | FI                                                    | `=IF(FN2<>"",E2,"")`                                                                                      | `df['Type'].where(thumb_up_mask, '')`                                |
| `ThumbDownPoint`               | FP                   | FJ                                                    | `=IF(FN2<>"",G2,"")` _(prev ZZ point)_                                                                    | `df['CurrentPoint'].shift(1).where(thumb_up_mask)`                   |
| `ThumbDownType`                | FQ                   | FK                                                    | `=IF(FO2="Peak","Bottom",IF(FO2="Bottom","Peak",""))`                                                     | `df['ThumbUpType'].map({'Peak':'Bottom','Bottom':'Peak','':''})`     |

### Z-Score Classification Thresholds

`Current%ChgClass`, `CurrentBarsClass`, `CurrentPrPerBarClass` are **pre-computed inside MQL5** over a rolling 50-segment window. Python does NOT recompute these — it receives them directly from the TSV.

| Class | Label        | Direction       |                     | Z   | range |
| ----- | ------------ | --------------- | ------------------- | --- | ----- |
| 1     | Bull Normal  | Bullish (HH/HL) | < 1.41              |
| 2     | Bull Large   | Bullish         | 1.41 ≤ \|Z\| < 1.88 |
| 3     | Bull Extreme | Bullish         | ≥ 1.88              |
| 4     | Bear Normal  | Bearish (LH/LL) | < 1.41              |
| 5     | Bear Large   | Bearish         | 1.41 ≤ \|Z\| < 1.88 |
| 6     | Bear Extreme | Bearish         | ≥ 1.88              |

---

_End of Architecture Document — v1.1 | May 2026_
_Change from v1.0: Separator columns (DV, EH, ET, FF, FR) removed from v43_calculationlogic.xlsx. Column mapping table in §11 and formula references in §13 updated accordingly. Calculationlogic is now 173 columns (was 178)._
