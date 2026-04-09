# DavinTrade Python Backend Stack B: H1-to-M5 SSA Interpolation Engine

### Version 1.0 — Architecture Blueprint for Claude Code Implementation

---

## Parallel Reference Document

> **Read alongside:** `davintrade-python-backend-architecture-v2.md` (Python Backend Stack A).
> Stack B is a downstream consumer of Stack A. It does **not** replace or modify any Stack A pipeline. All Stack A architectural principles, config schema conventions, and nomenclature conventions apply equally here and must be strictly preserved.

---

## 1. System Context & Motivation

### 1.1 What Stack A Produces

Stack A (`davintrade-python-backend-architecture-v2.md`) computes all SSA, EMA-SSA, entropy, and BPI/RPI/HMI indices. Its `run_ssa_pipeline()` function (Phase 4.0) produces, for each timeframe DataFrame, the following columns:

| Column      | Description                         |
| ----------- | ----------------------------------- |
| `timestamp` | Unix epoch (integer, seconds)       |
| `symbol`    | Instrument symbol (e.g., `XAUUSD`)  |
| `timeframe` | Timeframe label (e.g., `H1`, `M5`)  |
| `close`     | Raw OHLC close price                |
| `ssa`       | SSA-reconstructed trend on close    |
| `ema_ssa`   | EMA signal line applied to `ssa`    |
| `ssa_high`  | SSA-reconstructed trend on high     |
| `ssa_low`   | SSA-reconstructed trend on low      |
| `entropy`   | Rolling Shannon entropy value (0–1) |

Stack A runs this independently for every timeframe. The H1 DataFrame and the M5 DataFrame each carry these columns but exist on their own native time grids — they are never merged within Stack A.

### 1.2 The Gap Stack B Fills

Stack A has no mechanism to project H1-resolution SSA signals down onto the M5 timeline. The trader's M5 chart needs to display where the H1 SSA trend _would be_ at every M5 bar — not as a staircase step (forward-fill), but as a smooth geometric line that respects the exact slope between consecutive H1 endpoints.

This is **H1-to-M5 Linear Endpoint Interpolation**: for each H1 period (12 M5 bars), the H1 SSA values at the opening and closing H1 boundaries are used as the two anchor points of a straight line, and the 12 intermediate M5 bar values are read off that line.

### 1.3 Ground Truth Reference

The Excel workbook `ALGLIB_SSA_XAUUSD_timeframemapping.xlsx`, sheet `Mapped_H1_M5_Interporate`, contains the verified reference output:

- **Columns A–O**: Full M5-aligned working data, including interpolated H1 values in columns D–H
- **Columns R–AA**: Final consolidated output payload (the downstream consumer format)

Stack B's Python output must produce values numerically identical to columns R–AA when run on the same input data as exported by `ssa-export.mq5`. This workbook serves as the acceptance test fixture for implementation verification.

---

## 2. Architecture Position

```
┌─────────────────────────────────────────────────────┐
│               PYTHON BACKEND STACK A                │
│  ohlcv-export.mq5 → run_ssa_pipeline() → df_h1     │
│  ohlcv-export.mq5 → run_ssa_pipeline() → df_m5     │
│  execute_bpi_pipeline() / execute_rpi_pipeline()    │
│  execute_hmi_pipeline()                             │
└────────────────────────┬────────────────────────────┘
                         │ df_h1 (H1 SSA DataFrame)
                         │ df_m5 (M5 SSA DataFrame)
                         ▼
┌─────────────────────────────────────────────────────┐
│               PYTHON BACKEND STACK B                │
│  run_h1m5_interpolation_pipeline()                  │
│  ├── merge_h1_onto_m5_grid()                        │
│  └── build_interpolated_output()                    │
│                                                     │
│  OUTPUT: df_m5_aligned                              │
│  Columns R–AA equivalent:                           │
│  timestamp | symbol | timeframe | close |           │
│  ssa_h1_interp | ema_ssa_h1_interp |               │
│  ssa_m5 | ema_ssa_m5 | ssa_high_m5 | ssa_low_m5   │
└────────────────────────┬────────────────────────────┘
                         │ df_m5_aligned (JSON payload)
                         ▼
                   Next.js / ECharts Frontend
```

---

## 3. Data Contract: What Stack B Receives from Stack A

Stack B receives **two DataFrames** produced by `run_ssa_pipeline()` in Stack A. These are the only inputs to Stack B. No direct file I/O or MT5 API calls are made inside Stack B.

### 3.1 Input: `df_h1` — H1 SSA DataFrame

| Column      | Type    | Notes                                                              |
| ----------- | ------- | ------------------------------------------------------------------ |
| `timestamp` | int64   | Unix epoch seconds. Must be a proper `DatetimeIndex` after parsing |
| `symbol`    | str     | e.g., `XAUUSD`                                                     |
| `timeframe` | str     | Must be `H1`                                                       |
| `close`     | float64 | Raw H1 close price                                                 |
| `ssa`       | float64 | H1 SSA trend (from `compute_ssa()` on close)                       |
| `ema_ssa`   | float64 | H1 EMA signal (from `compute_ema()` on ssa)                        |
| `ssa_high`  | float64 | H1 SSA trend (from `compute_ssa()` on high)                        |
| `ssa_low`   | float64 | H1 SSA trend (from `compute_ssa()` on low)                         |
| `entropy`   | float64 | H1 Shannon entropy (informational — not interpolated)              |

> **Constraint:** `df_h1` must have at least 2 H1 bars whose timestamps fall within the M5 data range. Without two H1 anchor points, no interpolation segment can be formed.

### 3.2 Input: `df_m5` — M5 SSA DataFrame

| Column      | Type    | Notes                                                              |
| ----------- | ------- | ------------------------------------------------------------------ |
| `timestamp` | int64   | Unix epoch seconds. Must be a proper `DatetimeIndex` after parsing |
| `symbol`    | str     | e.g., `XAUUSD`                                                     |
| `timeframe` | str     | Must be `M5`                                                       |
| `close`     | float64 | Raw M5 close price (passed through unchanged to output)            |
| `ssa`       | float64 | M5 SSA trend (passed through to output as `ssa_m5`)                |
| `ema_ssa`   | float64 | M5 EMA signal (passed through to output as `ema_ssa_m5`)           |
| `ssa_high`  | float64 | M5 SSA high trend (passed through as `ssa_high_m5`)                |
| `ssa_low`   | float64 | M5 SSA low trend (passed through as `ssa_low_m5`)                  |
| `entropy`   | float64 | M5 Shannon entropy (informational — not used in interpolation)     |

---

## 4. Core Algorithm: H1-to-M5 Linear Endpoint Interpolation

### 4.1 Fundamental Relationship

One H1 bar covers exactly **12 M5 bars** (3,600 seconds ÷ 300 seconds per M5 bar = 12). This is a fixed structural constant for XAUUSD. It must be configurable per symbol via the Phase 6 config schema (see Section 7) to support future assets with different timeframe combinations.

### 4.2 Interpolation Formula

Let `H1[k]` denote the k-th H1 bar and `M5[k*12 + j]` denote the j-th M5 sub-bar within that H1 period, where `j = 0, 1, 2, ..., 12`.

For any SSA column `v` (e.g., `ssa`, `ema_ssa`, `ssa_high`, `ssa_low`):

```
v_m5[k*12 + j] = v_H1[k] + (j / 12) * (v_H1[k+1] - v_H1[k])
```

**Key properties of this formula:**

- At `j = 0`: `v_m5 = v_H1[k]` — the M5 bar at the H1 opening boundary equals the H1 opening value exactly
- At `j = 12`: `v_m5 = v_H1[k+1]` — the M5 bar at the H1 closing boundary equals the H1 closing value exactly (this M5 bar is simultaneously the _opening_ bar of the next H1 period)
- Between `j = 0` and `j = 12`: values change by a uniform step of `(v_H1[k+1] - v_H1[k]) / 12` per M5 bar

This is **two-endpoint linear interpolation**. It is NOT forward-fill (which would create staircase artifacts) and NOT cubic/spline interpolation (which would overshoot between anchors).

### 4.3 Columns Interpolated vs. Passed Through

| Column in Output    | Source                                  | Interpolated?  |
| ------------------- | --------------------------------------- | -------------- |
| `timestamp`         | M5 timestamp (col A)                    | No — M5 native |
| `symbol`            | M5 symbol (col I)                       | No — M5 native |
| `timeframe`         | M5 timeframe (col J)                    | No — M5 native |
| `close`             | M5 close (col K)                        | No — M5 native |
| `ssa_h1_interp`     | H1 `ssa` interpolated to M5 (col V)     | **Yes**        |
| `ema_ssa_h1_interp` | H1 `ema_ssa` interpolated to M5 (col W) | **Yes**        |
| `ssa_m5`            | M5 `ssa` from Stack A (col X)           | No — M5 native |
| `ema_ssa_m5`        | M5 `ema_ssa` from Stack A (col Y)       | No — M5 native |
| `ssa_high_m5`       | M5 `ssa_high` from Stack A (col Z)      | No — M5 native |
| `ssa_low_m5`        | M5 `ssa_low` from Stack A (col AA)      | No — M5 native |

> **Design decision:** Only `ssa` and `ema_ssa` from H1 are interpolated. `ssa_high_h1` and `ssa_low_h1` are computed in Stack A from the raw H1 high/low candles and represent H1-resolution band boundaries. These are deliberately excluded from the Stack B output payload because on the M5 consumer side, `ssa_high_m5` and `ssa_low_m5` (computed natively at M5 resolution) are the correct band references. Including H1 band interpolations alongside M5 band actuals would create an ambiguous dual-band signal. If a future use case requires H1 band interpolation, it must be added as a clearly named separate column pair (`ssa_high_h1_interp`, `ssa_low_h1_interp`) and documented explicitly.

---

## 5. Full Python Implementation

### 5.1 Dependencies

Stack B shares the same library requirements as Stack A. No additional libraries are needed.

```python
import numpy as np
import pandas as pd
```

### 5.2 `merge_h1_onto_m5_grid()`

This function merges the H1 SSA columns onto the M5 DatetimeIndex using a left join, placing H1 values only at the timestamps where H1 bars exist. All intermediate M5 rows receive NaN — which is then resolved by interpolation in the next step.

```python
def merge_h1_onto_m5_grid(df_h1: pd.DataFrame, df_m5: pd.DataFrame) -> pd.DataFrame:
    """
    Left-joins H1 SSA anchor columns onto the M5 DatetimeIndex.

    H1 values appear only at H1-boundary M5 rows. All intermediate M5 rows
    receive NaN in the H1 columns, ready for linear interpolation.

    Parameters:
        df_h1 : DataFrame from Stack A run_ssa_pipeline() on H1 data.
                Must have DatetimeIndex. Required columns: ssa, ema_ssa, ssa_high, ssa_low.
        df_m5 : DataFrame from Stack A run_ssa_pipeline() on M5 data.
                Must have DatetimeIndex. Required columns: close, ssa, ema_ssa, ssa_high, ssa_low.

    Returns:
        df_merged : M5-indexed DataFrame with H1 columns suffixed '_h1_anchor'.
                    H1 values present only at H1 boundary rows; NaN elsewhere.
    """
    h1_anchor_cols = ['ssa', 'ema_ssa', 'ssa_high', 'ssa_low']
    df_h1_slim = df_h1[h1_anchor_cols].add_suffix('_h1_anchor')

    df_merged = df_m5.join(df_h1_slim, how='left')

    return df_merged
```

### 5.3 `interpolate_h1_anchors()`

This function performs the actual linear interpolation on the NaN-filled H1 anchor columns. It uses `pandas.DataFrame.interpolate(method='index')` which respects the numeric index positions (time-aligned, since M5 bars are evenly spaced at 300 seconds each within a given H1 period).

```python
def interpolate_h1_anchors(df_merged: pd.DataFrame) -> pd.DataFrame:
    """
    Linearly interpolates H1 anchor values across the M5 grid.

    Uses method='index' so that interpolation is proportional to the position of
    each M5 bar's DatetimeIndex value between adjacent H1 anchor timestamps.
    This is mathematically equivalent to:
        v_m5[j] = v_H1[k] + (j/12) * (v_H1[k+1] - v_H1[k])
    for j = 0..12 within each H1 period.

    Parameters:
        df_merged : Output of merge_h1_onto_m5_grid(). Must have DatetimeIndex.

    Returns:
        df_merged with '_h1_anchor' columns fully interpolated (no NaNs
        between H1 boundaries). NaNs before the first H1 anchor or after
        the last H1 anchor are handled via backfill / forward-fill respectively.
    """
    anchor_cols = [c for c in df_merged.columns if c.endswith('_h1_anchor')]

    # Linear interpolation between H1 endpoints — exact two-endpoint formula
    df_merged[anchor_cols] = df_merged[anchor_cols].interpolate(
        method='index',
        limit_direction='both'
    )

    # Backfill any leading NaN rows that precede the first H1 anchor
    # (M5 bars that start before the earliest H1 bar in the dataset)
    df_merged[anchor_cols] = df_merged[anchor_cols].bfill()

    # Forward-fill any trailing NaN rows that follow the last H1 anchor
    # (M5 bars at the very end of the dataset with no H1[k+1] to anchor against)
    df_merged[anchor_cols] = df_merged[anchor_cols].ffill()

    return df_merged
```

> **Implementation note on `limit_direction='both'`:** This allows pandas to interpolate both forward (standard) and backward (for M5 bars before the very first H1 anchor in the dataset). Combined with the explicit `bfill()` and `ffill()` calls, this guarantees zero NaN values in the output regardless of dataset boundary conditions.

### 5.4 `build_interpolated_output()`

This function assembles the final output DataFrame in the canonical column order matching columns R–AA of the reference workbook.

```python
def build_interpolated_output(df_merged: pd.DataFrame) -> pd.DataFrame:
    """
    Assembles the final Stack B output DataFrame.

    Column mapping (mirrors Mapped_H1_M5_Interporate cols R–AA):
        R  timestamp           ← M5 DatetimeIndex (as Unix epoch int)
        S  symbol              ← df_m5 symbol
        T  timeframe           ← df_m5 timeframe (M5)
        U  close               ← df_m5 close (actual M5 close)
        V  ssa_h1_interp       ← H1 ssa interpolated to M5 grid
        W  ema_ssa_h1_interp   ← H1 ema_ssa interpolated to M5 grid
        X  ssa_m5              ← df_m5 ssa (actual M5 SSA from Stack A)
        Y  ema_ssa_m5          ← df_m5 ema_ssa (actual M5 EMA-SSA from Stack A)
        Z  ssa_high_m5         ← df_m5 ssa_high (actual M5 SSA high from Stack A)
        AA ssa_low_m5          ← df_m5 ssa_low  (actual M5 SSA low from Stack A)

    Parameters:
        df_merged : Output of interpolate_h1_anchors(). Must have DatetimeIndex.

    Returns:
        df_out : Clean output DataFrame with exactly the 10 columns above.
    """
    df_out = pd.DataFrame({
        'timestamp':         df_merged.index.astype(np.int64) // 10**9,
        'symbol':            df_merged['symbol'],
        'timeframe':         df_merged['timeframe'],
        'close':             df_merged['close'],
        'ssa_h1_interp':     df_merged['ssa_h1_anchor'],
        'ema_ssa_h1_interp': df_merged['ema_ssa_h1_anchor'],
        'ssa_m5':            df_merged['ssa'],
        'ema_ssa_m5':        df_merged['ema_ssa'],
        'ssa_high_m5':       df_merged['ssa_high'],
        'ssa_low_m5':        df_merged['ssa_low'],
    }, index=df_merged.index)

    return df_out
```

### 5.5 `run_h1m5_interpolation_pipeline()` — Master Function

This is the single entry point to Stack B. Stack A calls this function by passing the two DataFrames it already holds in RAM after `run_ssa_pipeline()`. No file I/O occurs inside Stack B.

```python
def run_h1m5_interpolation_pipeline(
    df_h1: pd.DataFrame,
    df_m5: pd.DataFrame,
    interp_cfg: dict
) -> pd.DataFrame:
    """
    Master execution function for Python Backend Stack B.

    Consumes H1 and M5 DataFrames from Stack A and produces a consolidated
    M5-aligned DataFrame containing both the H1 SSA signals (linearly
    interpolated to M5 resolution) and the actual M5 SSA signals.

    This pipeline is the Python equivalent of the data mapped in
    Mapped_H1_M5_Interporate sheet columns R–AA (ALGLIB_SSA_XAUUSD_timeframemapping.xlsx).

    Parameters:
        df_h1      : H1 DataFrame from Stack A run_ssa_pipeline(). Must have DatetimeIndex.
        df_m5      : M5 DataFrame from Stack A run_ssa_pipeline(). Must have DatetimeIndex.
        interp_cfg : Symbol-specific config dict from Phase 6 schema (interp_h1m5 block).

    Returns:
        df_m5_aligned : Final M5-aligned DataFrame with 10 output columns.
                        Zero NaN values guaranteed in all columns.
    """
    m5_per_h1 = interp_cfg.get('m5_bars_per_h1', 12)

    # Validate inputs
    _validate_interpolation_inputs(df_h1, df_m5, m5_per_h1)

    # Step 1: Left-join H1 anchor values onto M5 grid (NaN at intermediate rows)
    df_merged = merge_h1_onto_m5_grid(df_h1, df_m5)

    # Step 2: Linear interpolation between H1 endpoints across all M5 sub-bars
    df_merged = interpolate_h1_anchors(df_merged)

    # Step 3: Assemble canonical output DataFrame
    df_m5_aligned = build_interpolated_output(df_merged)

    return df_m5_aligned
```

### 5.6 `_validate_interpolation_inputs()` — Guard Function

```python
def _validate_interpolation_inputs(
    df_h1: pd.DataFrame,
    df_m5: pd.DataFrame,
    m5_per_h1: int
) -> None:
    """
    Validates that inputs meet the minimum requirements for interpolation.
    Raises ValueError with descriptive messages on failure.
    Raises no exception if all checks pass.
    """
    required_h1_cols = {'ssa', 'ema_ssa', 'ssa_high', 'ssa_low'}
    required_m5_cols = {'close', 'ssa', 'ema_ssa', 'ssa_high', 'ssa_low', 'symbol', 'timeframe'}

    if not isinstance(df_h1.index, pd.DatetimeIndex):
        raise ValueError("df_h1 must have a DatetimeIndex. "
                         "Convert timestamp column: df_h1.index = pd.to_datetime(df_h1['timestamp'], unit='s')")

    if not isinstance(df_m5.index, pd.DatetimeIndex):
        raise ValueError("df_m5 must have a DatetimeIndex. "
                         "Convert timestamp column: df_m5.index = pd.to_datetime(df_m5['timestamp'], unit='s')")

    missing_h1 = required_h1_cols - set(df_h1.columns)
    if missing_h1:
        raise ValueError(f"df_h1 is missing required Stack A SSA columns: {missing_h1}. "
                         f"Ensure run_ssa_pipeline() was called on H1 data before passing to Stack B.")

    missing_m5 = required_m5_cols - set(df_m5.columns)
    if missing_m5:
        raise ValueError(f"df_m5 is missing required Stack A SSA columns: {missing_m5}. "
                         f"Ensure run_ssa_pipeline() was called on M5 data before passing to Stack B.")

    # At least 2 H1 bars must fall within the M5 data range to form one interpolation segment
    h1_in_range = df_h1[(df_h1.index >= df_m5.index.min()) & (df_h1.index <= df_m5.index.max())]
    if len(h1_in_range) < 2:
        raise ValueError(
            f"Insufficient H1 bars within M5 range. "
            f"M5 range: {df_m5.index.min()} – {df_m5.index.max()}. "
            f"H1 bars in range: {len(h1_in_range)}. Minimum required: 2."
        )

    if m5_per_h1 <= 0:
        raise ValueError(f"m5_bars_per_h1 must be a positive integer. Got: {m5_per_h1}")
```

---

## 6. Output Schema

### 6.1 `df_m5_aligned` — Stack B Output DataFrame

The output is a single Pandas DataFrame indexed by `DatetimeIndex` (UTC). It contains exactly 10 columns:

| Column              | Type    | Description                                                                |
| ------------------- | ------- | -------------------------------------------------------------------------- |
| `timestamp`         | int64   | Unix epoch seconds (redundant with index; included for JSON serialization) |
| `symbol`            | str     | Instrument symbol (e.g., `XAUUSD`)                                         |
| `timeframe`         | str     | Always `M5`                                                                |
| `close`             | float64 | Actual M5 raw close price (from Stack A M5 DataFrame, unmodified)          |
| `ssa_h1_interp`     | float64 | H1 SSA trend linearly interpolated to M5 resolution                        |
| `ema_ssa_h1_interp` | float64 | H1 EMA-SSA signal linearly interpolated to M5 resolution                   |
| `ssa_m5`            | float64 | Actual M5 SSA trend (from Stack A M5 DataFrame, unmodified)                |
| `ema_ssa_m5`        | float64 | Actual M5 EMA-SSA signal (from Stack A M5 DataFrame, unmodified)           |
| `ssa_high_m5`       | float64 | Actual M5 SSA high band (from Stack A M5 DataFrame, unmodified)            |
| `ssa_low_m5`        | float64 | Actual M5 SSA low band (from Stack A M5 DataFrame, unmodified)             |

**Guarantee:** All 10 columns must be free of NaN values in the returned DataFrame. The `_validate_interpolation_inputs()` guard and the `bfill()`/`ffill()` calls in `interpolate_h1_anchors()` together ensure this.

### 6.2 JSON Payload Extension

The Stack B output extends the unified frontend API payload defined in Stack A Section 9. The following fields are appended to the existing JSON object:

```json
{
  "active_hmi": 85.2,
  "active_hmi_type": "Resistance",
  "active_rpi": 72.4,
  "active_rpi_type": "Resistance",
  "active_bpi": 61.8,
  "active_bpi_type": "Resistance Breakout",
  "distance_to_active": 4.25,
  "entropy": 0.42,
  "ssa_regime": "Transition",
  "upper_sandwich_price": 4747.7,
  "lower_sandwich_price": 4666.96,

  "ssa_h1_interp": 4619.847,
  "ema_ssa_h1_interp": 4616.096,
  "ssa_m5": 4627.215,
  "ema_ssa_m5": 4627.215,
  "ssa_high_m5": 4628.943,
  "ssa_low_m5": 4622.095,
  "ssa_cross_signal": "H1_above_M5"
}
```

**New field descriptions:**

| Field               | Source                               | Frontend use                          |
| ------------------- | ------------------------------------ | ------------------------------------- |
| `ssa_h1_interp`     | `ssa_h1_anchor` (interpolated)       | H1 trend line on M5 ECharts chart     |
| `ema_ssa_h1_interp` | `ema_ssa_h1_anchor` (interpolated)   | H1 signal line on M5 ECharts chart    |
| `ssa_m5`            | M5 `ssa` from Stack A                | M5 trend line on M5 ECharts chart     |
| `ema_ssa_m5`        | M5 `ema_ssa` from Stack A            | M5 signal line on M5 ECharts chart    |
| `ssa_high_m5`       | M5 `ssa_high` from Stack A           | M5 SSA upper band on M5 ECharts chart |
| `ssa_low_m5`        | M5 `ssa_low` from Stack A            | M5 SSA lower band on M5 ECharts chart |
| `ssa_cross_signal`  | Computed from H1 interp vs M5 actual | Cross-timeframe trend alignment label |

### 6.3 `ssa_cross_signal` Derivation

This field provides a readable cross-timeframe alignment label for the frontend.

```python
def compute_ssa_cross_signal(row: pd.Series) -> str:
    """
    Derives the H1-vs-M5 SSA cross-timeframe alignment signal for the latest bar.

    H1_above_M5 : H1 interpolated SSA trend is above M5 native SSA trend
                  → H1 macro bias is bullish relative to M5 micro trend
    H1_below_M5 : H1 interpolated SSA trend is below M5 native SSA trend
                  → H1 macro bias is bearish relative to M5 micro trend
    H1_aligned_M5: Both within 0.05% tolerance → neutral / convergence zone
    """
    tolerance = 0.0005  # 0.05% — configurable via interp_h1m5.cross_signal_tolerance_pct

    delta = row['ssa_h1_interp'] - row['ssa_m5']
    pct_delta = abs(delta) / row['ssa_m5']

    if pct_delta <= tolerance:
        return 'H1_aligned_M5'
    elif delta > 0:
        return 'H1_above_M5'
    else:
        return 'H1_below_M5'
```

---

## 7. Phase 6 Configuration Schema Extension

Stack B introduces a new `interp_h1m5` config block that extends the existing per-symbol config schema defined in Stack A Section 8. This block must be added alongside the existing `ssa_entropy`, `bpi_kinetic`, `rpi_structural`, and `hmi_structural` blocks.

```json
{
  "XAUUSD": {
    "hmi_structural": {
      "note": "HMI uses Final_Score and global_max_score only. No sigma_pct."
    },
    "rpi_structural": {
      "sigma_pct": 0.001
    },
    "bpi_kinetic": {
      "htf_macro_lookback_bars": 96,
      "htf_strong_threshold": 0.7,
      "htf_weak_threshold": 0.3,
      "htf_strong_multiplier": 1.5,
      "htf_weak_multiplier": 0.5,
      "ltf_proximity_threshold": 0.0015,
      "ltf_crawl_window": 20,
      "ltf_crawl_max_score_crosses": 2.0,
      "ltf_ignition_bonus": 1.2
    },
    "ssa_entropy": {
      "entropy_window": 50,
      "price_step_points": 0.01,
      "point_size": 0.01,
      "entropy_trend_threshold": 0.35,
      "entropy_chaotic_threshold": 0.65,
      "ssa_rank": 6,
      "ssa_signal_period": 3,
      "ssa_window_trend": 40,
      "ssa_window_transition": 20,
      "ssa_window_chaotic": 10
    },
    "interp_h1m5": {
      "m5_bars_per_h1": 12,
      "cross_signal_tolerance_pct": 0.0005,
      "interpolate_columns": ["ssa", "ema_ssa"]
    }
  },
  "DEFAULT": {
    "hmi_structural": {
      "note": "HMI uses Final_Score and global_max_score only. No sigma_pct."
    },
    "rpi_structural": {
      "sigma_pct": 0.001
    },
    "bpi_kinetic": {
      "htf_macro_lookback_bars": 96,
      "htf_strong_threshold": 0.7,
      "htf_weak_threshold": 0.3,
      "htf_strong_multiplier": 1.5,
      "htf_weak_multiplier": 0.5,
      "ltf_proximity_threshold": 0.0015,
      "ltf_crawl_window": 20,
      "ltf_crawl_max_score_crosses": 2.0,
      "ltf_ignition_bonus": 1.2
    },
    "ssa_entropy": {
      "entropy_window": 50,
      "price_step_points": 0.01,
      "point_size": 0.01,
      "entropy_trend_threshold": 0.35,
      "entropy_chaotic_threshold": 0.65,
      "ssa_rank": 6,
      "ssa_signal_period": 3,
      "ssa_window_trend": 40,
      "ssa_window_transition": 20,
      "ssa_window_chaotic": 10
    },
    "interp_h1m5": {
      "m5_bars_per_h1": 12,
      "cross_signal_tolerance_pct": 0.0005,
      "interpolate_columns": ["ssa", "ema_ssa"]
    }
  }
}
```

### `interp_h1m5` Config Fields

| Field                        | Default              | Description                                                                                       |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| `m5_bars_per_h1`             | `12`                 | Number of M5 bars per H1 bar. Fixed 12 for XAUUSD. Change for other TF pairs (e.g., 48 for H4-M5) |
| `cross_signal_tolerance_pct` | `0.0005`             | % tolerance for classifying `H1_aligned_M5` in `compute_ssa_cross_signal()`                       |
| `interpolate_columns`        | `["ssa", "ema_ssa"]` | Which H1 columns to interpolate. Extend to include `ssa_high`, `ssa_low` if needed                |

---

## 8. Integration Pattern with Stack A

Stack B is invoked immediately after Stack A's `execute_bpi_pipeline()` completes, since Stack A already holds both `df_m5` and `df_h1` (post `run_ssa_pipeline()`) in RAM at that point. No redundant SSA computation is performed.

```python
def execute_full_pipeline(
    df_m5_raw: pd.DataFrame,
    df_m15_raw: pd.DataFrame,
    df_h1_raw: pd.DataFrame,
    valid_line_cols: list,
    symbol_config: dict
) -> dict:
    """
    Unified master pipeline: Stack A (BPI/RPI/HMI) + Stack B (H1-M5 interpolation).

    df_m5_raw, df_m15_raw, df_h1_raw are raw OHLCV DataFrames from ohlcv-export.mq5
    with DatetimeIndex already set. All three are processed in one pass.
    """
    ssa_cfg    = symbol_config['ssa_entropy']
    interp_cfg = symbol_config['interp_h1m5']

    # ── STACK A: SSA pre-processing on all required timeframes ──────────────
    df_m5  = run_ssa_pipeline(df_m5_raw,  ssa_cfg)
    df_m15 = run_ssa_pipeline(df_m15_raw, ssa_cfg)
    df_h1  = run_ssa_pipeline(df_h1_raw,  ssa_cfg)

    # ── STACK A: BPI pipeline (uses df_m5 and df_m15) ────────────────────────
    bpi_df = execute_bpi_pipeline(df_m5, df_m15, valid_line_cols, symbol_config)

    # ── STACK A: RPI + HMI pipeline ───────────────────────────────────────────
    line_price_cols = [c for c in df_m5.columns if 'line' in c]
    line_score_cols = [c for c in df_m5.columns if 'score' in c]
    global_max_score = df_m5[[c for c in df_m5.columns if 'Final_Score' in c]].max().max()

    res_price, res_score, sup_price, sup_score = extract_dynamic_targets_with_scores(
        df_m5, line_price_cols, line_score_cols
    )
    rpi_df = calculate_universal_rpi_m5(
        df_m5, res_price, res_score, sup_price, sup_score,
        global_max_score,
        sigma_pct=symbol_config['rpi_structural']['sigma_pct']
    )
    hmi_df = calculate_hmi_m5(
        df_m5, res_price, res_score, sup_price, sup_score, global_max_score
    )

    # ── STACK B: H1-to-M5 interpolation (uses df_h1 and df_m5 from Stack A) ──
    # df_h1 and df_m5 are already in RAM from Stack A above — zero re-computation.
    df_m5_aligned = run_h1m5_interpolation_pipeline(df_h1, df_m5, interp_cfg)

    # ── BUILD UNIFIED JSON PAYLOAD ────────────────────────────────────────────
    latest_m5        = df_m5_aligned.iloc[-1]
    latest_bpi       = bpi_df.iloc[-1]
    latest_rpi       = rpi_df.iloc[-1]
    latest_hmi       = hmi_df.iloc[-1]
    latest_entropy   = df_m5['entropy'].dropna().iloc[-1]
    ssa_regime       = _map_entropy_to_regime(latest_entropy, ssa_cfg)

    payload = {
        # Stack A indices
        'active_hmi':             round(float(latest_hmi['active_hmi']), 2),
        'active_hmi_type':        latest_hmi['active_hmi_type'],
        'active_rpi':             round(float(latest_rpi['active_rpi']), 2),
        'active_rpi_type':        latest_rpi['active_rpi_type'],
        'active_bpi':             round(float(latest_bpi['active_bpi']), 2),
        'active_bpi_type':        latest_bpi['active_bpi_type'],
        'distance_to_active':     round(float(latest_rpi['distance_to_active']), 4),
        'entropy':                round(float(latest_entropy), 4),
        'ssa_regime':             ssa_regime,
        'upper_sandwich_price':   round(float(res_price.iloc[-1]), 2),
        'lower_sandwich_price':   round(float(sup_price.iloc[-1]), 2),

        # Stack B additions
        'ssa_h1_interp':          round(float(latest_m5['ssa_h1_interp']), 5),
        'ema_ssa_h1_interp':      round(float(latest_m5['ema_ssa_h1_interp']), 5),
        'ssa_m5':                 round(float(latest_m5['ssa_m5']), 5),
        'ema_ssa_m5':             round(float(latest_m5['ema_ssa_m5']), 5),
        'ssa_high_m5':            round(float(latest_m5['ssa_high_m5']), 5),
        'ssa_low_m5':             round(float(latest_m5['ssa_low_m5']), 5),
        'ssa_cross_signal':       compute_ssa_cross_signal(latest_m5),
    }

    return payload


def _map_entropy_to_regime(entropy: float, ssa_cfg: dict) -> str:
    """Maps entropy float to readable regime string — same thresholds as Stack A."""
    trend_threshold   = ssa_cfg.get('entropy_trend_threshold', 0.35)
    chaotic_threshold = ssa_cfg.get('entropy_chaotic_threshold', 0.65)

    if entropy < trend_threshold:
        return 'Trend'
    elif entropy < chaotic_threshold:
        return 'Transition'
    else:
        return 'Chaotic'
```

---

## 9. Data Flow Summary

```
Stack A (RAM):
  ohlcv-export.mq5 (H1) → run_ssa_pipeline(df_h1_raw) → df_h1
  ohlcv-export.mq5 (M5) → run_ssa_pipeline(df_m5_raw) → df_m5
  ohlcv-export.mq5 (M15)→ run_ssa_pipeline(df_m15_raw)→ df_m15

  df_m5 + df_m15 → execute_bpi_pipeline()  → bpi_df
  df_m5          → execute_rpi_pipeline()  → rpi_df
  df_m5          → execute_hmi_pipeline()  → hmi_df

Stack B (RAM):
  df_h1 + df_m5 → merge_h1_onto_m5_grid()   → df_merged (NaN at M5 sub-bars)
  df_merged     → interpolate_h1_anchors()   → df_merged (fully interpolated)
  df_merged     → build_interpolated_output()→ df_m5_aligned (10 clean columns)

Export to DB:
  All indices (bpi, rpi, hmi) + df_m5_aligned → unified JSON → PostgreSQL + Redis
```

---

## 10. Technical Stack

Stack B shares the complete technical stack defined in Stack A Section 10. No additional libraries are introduced.

| Purpose            | Library         | Notes                                                                        |
| ------------------ | --------------- | ---------------------------------------------------------------------------- |
| Core interpolation | `pandas`        | `DataFrame.interpolate(method='index')` — primary interpolation mechanism    |
| Numeric operations | `numpy`         | Array operations for `ssa_cross_signal` tolerance check                      |
| Config hot-reload  | `Redis Pub/Sub` | Same hot-reload hook as Stack A — `interp_h1m5` block reloaded on same cycle |
| Persistence        | `PostgreSQL`    | `df_m5_aligned` persisted alongside Stack A Golden node data                 |

---

## 11. Verification Against Reference Workbook

During implementation, Claude Code must verify Stack B outputs against the reference workbook `ALGLIB_SSA_XAUUSD_timeframemapping.xlsx` sheet `Mapped_H1_M5_Interporate` columns R–AA.

### Verification Procedure

```python
import pandas as pd
import numpy as np

def verify_stack_b_against_reference(df_m5_aligned: pd.DataFrame,
                                      reference_path: str,
                                      tolerance: float = 1e-4) -> dict:
    """
    Compares Stack B output against the reference Excel workbook.

    Reference columns (R–AA in Mapped_H1_M5_Interporate):
        R  = timestamp            → compare with df_m5_aligned['timestamp']
        V  = ssa_m5_interpolation → compare with df_m5_aligned['ssa_h1_interp']
        W  = ema_ssa_m5_interp    → compare with df_m5_aligned['ema_ssa_h1_interp']
        X  = ssa_m5               → compare with df_m5_aligned['ssa_m5']
        Y  = ema_ssa_m5           → compare with df_m5_aligned['ema_ssa_m5']
        Z  = ssa_high_m5          → compare with df_m5_aligned['ssa_high_m5']
        AA = ssa_low_m5           → compare with df_m5_aligned['ssa_low_m5']

    Returns dict with per-column max_abs_error and pass/fail status.
    """
    ref = pd.read_excel(reference_path, sheet_name='Mapped_H1_M5_Interporate',
                        header=0, usecols='R:AA')

    col_map = {
        'ssa_m5_interpolation':     'ssa_h1_interp',
        'ema_ssa_m5_interpolation': 'ema_ssa_h1_interp',
        'ssa_m5.1':                 'ssa_m5',
        'ema_ssa_m5.1':             'ema_ssa_m5',
        'ssa_high_m5.1':            'ssa_high_m5',
        'ssa_low_m5.1':             'ssa_low_m5',
    }

    results = {}
    for ref_col, out_col in col_map.items():
        if ref_col not in ref.columns or out_col not in df_m5_aligned.columns:
            results[out_col] = {'status': 'SKIP', 'reason': 'column not found'}
            continue

        ref_vals  = ref[ref_col].dropna().values
        out_vals  = df_m5_aligned[out_col].values[:len(ref_vals)]
        max_error = np.max(np.abs(ref_vals - out_vals))

        results[out_col] = {
            'status':        'PASS' if max_error <= tolerance else 'FAIL',
            'max_abs_error': round(float(max_error), 8),
            'tolerance':     tolerance,
        }

    return results
```

**Acceptance criterion:** All columns must return `status: PASS` with `max_abs_error ≤ 1e-4` (0.0001 price units). A failure in `ssa_h1_interp` or `ema_ssa_h1_interp` indicates a misalignment in the H1-to-M5 timestamp join or an incorrect interpolation method. A failure in `ssa_m5`, `ema_ssa_m5`, `ssa_high_m5`, or `ssa_low_m5` indicates a discrepancy in Stack A's `run_ssa_pipeline()` output (not a Stack B issue — report upstream to Stack A).

---

## 12. Core Architectural Principles for Stack B

| Principle                   | Implementation                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zero re-computation         | Stack B reuses `df_h1` and `df_m5` already in RAM from Stack A. No second call to `run_ssa_pipeline()`.                                                                                    |
| No staircase artifacts      | `interpolate(method='index')` not `ffill()`. Exact two-endpoint linear formula per H1 period.                                                                                              |
| No data leakage             | H1 SSA is interpolated from the H1 grid, not from any M5-derived signal. M5 SSA is computed natively in Stack A on the M5 grid. These two signals never cross-contaminate.                 |
| Vectorized performance      | `pandas.interpolate()` is fully vectorized. No Python for-loops over the M5 DatetimeIndex.                                                                                                 |
| Zero NaN output             | `bfill()` and `ffill()` guard clauses ensure no NaN propagates to the frontend payload.                                                                                                    |
| Feature orthogonality       | Stack B output columns are strictly additive to the unified payload. No Stack A index (BPI/RPI/HMI) is modified.                                                                           |
| RAM-first                   | All interpolation occurs in Pandas memory. Only the final `df_m5_aligned` is persisted.                                                                                                    |
| Zero hardcoded constants    | `m5_bars_per_h1` and `cross_signal_tolerance_pct` live in the `interp_h1m5` config block.                                                                                                  |
| Hot-reloadable              | Config block invalidated via same Redis Pub/Sub hook as Stack A — no server restart required.                                                                                              |
| Verifiable reference output | `ALGLIB_SSA_XAUUSD_timeframemapping.xlsx` columns R–AA serve as the numerical acceptance test fixture. `verify_stack_b_against_reference()` must be run during CI and on first deployment. |
