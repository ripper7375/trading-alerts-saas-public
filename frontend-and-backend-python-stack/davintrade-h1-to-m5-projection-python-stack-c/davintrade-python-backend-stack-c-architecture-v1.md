# DavinTrade Python Backend Stack C: H1 Band Slope-Regression & Asymmetric Projection Engine

### Version 1.1 — Architecture Blueprint for Claude Code Implementation

> **Changelog v1.0 → v1.1**
>
> - Sections 1, 3, 4, 5, 6, 9: Revised to reflect that columns AF, AG, AH, AN, AQ–AW extend **beyond bar 0 (current data)** into future M5 bars within the current H1 period.
> - Added `generate_forward_m5_timeline()` function — the new Step 0 that synthetically extends the M5 grid to cover the remaining bars of the current H1 period.
> - Corrected AF, AG, AH column descriptions: these are **not** simple pass-throughs from Stack B.
> - Corrected AJ, AK, AO, AP population rules: conditionally populated based on H1 period completion state.
> - Clarified AL, AM NaN semantics and AN forward-fill coverage.

---

## Parallel Reference Documents

> **Read alongside:**
>
> - `davintrade-python-backend-architecture-v2.md` — Python Backend Stack A (SSA computation)
> - `davintrade-python-backend-stack-b-architecture-v1.md` — Python Backend Stack B (H1-to-M5 interpolation)
>
> Stack C is a downstream consumer of Stack B. It does **not** replace or modify any Stack A or Stack B pipeline. All architectural principles, config schema conventions, and nomenclature from both upstream documents apply equally here.

---

## 1. System Context & Motivation

### 1.1 What Stack B Produces (Stack C Input)

Stack B (`davintrade-python-backend-stack-b-architecture-v1.md`) produces `df_m5_aligned` — a 12-column M5-aligned DataFrame that projects H1 SSA signals down onto the M5 timeline via linear endpoint interpolation. The relevant columns Stack C consumes are:

| Stack B Column              | Excel Col | Description                              |
| --------------------------- | --------- | ---------------------------------------- |
| `timestamp`                 | R         | M5 Unix timestamp (historical data only) |
| `symbol`                    | S         | Instrument symbol                        |
| `timeframe`                 | T         | Always `M5`                              |
| `close`                     | U         | Actual M5 close price (historical only)  |
| `ssa_h1_interp`             | V         | H1 `ssa` interpolated to M5              |
| `ema_ssa_h1_interp`         | W         | H1 `ema_ssa` interpolated to M5          |
| `ssa_high_m5_interpolation` | Z         | H1 `ssa_high` interpolated to M5         |
| `ssa_low_m5_interpolation`  | AB        | H1 `ssa_low` interpolated to M5          |

> **Important:** Stack B's output (`df_m5_aligned`, cols R–AC) is limited to **bar 0 (current data)**. It contains no rows beyond the most recently closed M5 bar.

### 1.2 The Gap Stack C Fills

Stack B establishes where the H1 SSA band boundaries (`ssa_high`, `ssa_low`) sit at every M5 bar via interpolation. However, a trader needs more than static band positions — they need to know:

1. **The trend direction of the H1 SSA channel** — is the H1 macro structure currently bullish or bearish relative to its own signal line?
2. **The momentum (slope) of the H1 band boundaries** — is the ceiling rising or falling? Is the floor rising or falling? At what rate per M5 bar?
3. **A regression baseline for each band** — what is the geometrically smoothed trajectory of each band boundary within the current H1 period?
4. **An asymmetric forward projection** — where will each band boundary be at the _next_ M5 bar, using a conservative rule: project only in the direction that represents the more cautious outcome for the trader.
5. **A forward-extended M5 timeline** — project all four of the above into the **remaining M5 bars of the current H1 period that have not yet closed**, giving the trader a full picture of where the band boundaries will be through the end of the current H1 candle.

Stack C computes all five of these. The output DataFrame extends beyond bar 0 with **synthetic future M5 rows** covering the remaining bars in the current H1 period. This is the key architectural difference between Stack B (historical only) and Stack C (historical + intra-period future projection).

### 1.3 Ground Truth Reference

The Excel workbook `ALGLIB_SSA_XAUUSD_timeframemapping.xlsx`, sheet `Mapped_H1_M5_Interporate`, columns **AF to AW** (18 columns) contains the verified reference output. Stack C's Python output must be numerically identical to these columns when run on the same input data.

**Key observation from the reference workbook:** Column R (Stack B timestamp) ends at bar 0 (timestamp `1775700900`, row 1001). Columns AF–AW continue for 8 additional rows (timestamps `1775701200` through `1775703300`), which are the 8 remaining M5 bars of the current H1 period. These rows have no Stack B data (R is empty); they are generated entirely by Stack C.

---

## 2. Architecture Position

```
┌─────────────────────────────────────────────────────┐
│               PYTHON BACKEND STACK A                │
│  run_ssa_pipeline() → df_h1, df_m5, df_m15          │
└────────────────────────┬────────────────────────────┘
                         │ df_h1, df_m5
                         ▼
┌─────────────────────────────────────────────────────┐
│               PYTHON BACKEND STACK B                │
│  run_h1m5_interpolation_pipeline()                  │
│  OUTPUT: df_m5_aligned (cols R–AC, 12 cols)         │
│          ← historical data only, up to bar 0 →      │
└────────────────────────┬────────────────────────────┘
                         │ df_m5_aligned + df_h1
                         ▼
┌─────────────────────────────────────────────────────┐
│               PYTHON BACKEND STACK C                │
│  run_band_projection_pipeline()                     │
│  ├── generate_forward_m5_timeline()   ← NEW Step 0  │
│  ├── compute_ssa_trend_signal()                     │
│  ├── compute_h1_period_slopes()                     │
│  ├── compute_band_regression()                      │
│  └── compute_asymmetric_band_projection()           │
│                                                     │
│  OUTPUT: df_band_projection (cols AF–AW, 18 cols)   │
│    ← historical data + future H1-period bars →      │
└────────────────────────┬────────────────────────────┘
                         │ df_band_projection (JSON payload)
                         ▼
                   Next.js / ECharts Frontend
```

---

## 3. Data Contract: What Stack C Receives

Stack C receives **two DataFrames** produced by upstream stacks. No direct file I/O or MT5 API calls are made inside Stack C.

### 3.1 Input: `df_m5_aligned` — Stack B Output DataFrame

The complete 12-column DataFrame produced by `run_h1m5_interpolation_pipeline()`. Stack C uses the following columns:

| Column                      | Usage in Stack C                                                             |
| --------------------------- | ---------------------------------------------------------------------------- |
| `timestamp`                 | Source for forward timeline construction (col AF)                            |
| `symbol`                    | Source for symbol field (col AG)                                             |
| `timeframe`                 | Source for timeframe field (col AH)                                          |
| `close`                     | Pass-through to output (col AI, historical bars only)                        |
| `ssa_h1_interp`             | Source for trend signal and regression (cols AJ, AL, AM — completed periods) |
| `ema_ssa_h1_interp`         | Source for trend signal (cols AK, AL, AM — completed periods only)           |
| `ssa_high_m5_interpolation` | H1 band anchor reference (col AO — completed periods only)                   |
| `ssa_low_m5_interpolation`  | H1 band anchor reference (col AP — completed periods only)                   |

### 3.2 Input: `df_h1` — H1 SSA DataFrame (from Stack A)

Stack C requires the H1 DataFrame to extract H1 anchor values at each H1 boundary. Specifically, it needs the **H1-resolution `ssa_high` and `ssa_low`** values at each H1 timestamp to compute the per-period slope and to lock the regression anchor.

| Column     | Usage in Stack C                                                               |
| ---------- | ------------------------------------------------------------------------------ |
| `ssa_high` | H1 anchor values for slope computation (col AR) and regression anchor (col AT) |
| `ssa_low`  | H1 anchor values for slope computation (col AS) and regression anchor (col AU) |

> **Why `df_h1` is needed for the regression anchor:** For the current (in-progress) H1 period, `ssa_high_m5_interpolation` (col AO) is only populated at x_count=1 (the boundary anchor row) and is NaN for x_count=2..12. The regression anchor value at x_count=1 is identical to `df_h1['ssa_high']` at that boundary timestamp, so reading the anchor directly from `df_h1` avoids any dependency on the AO NaN state and is correct for all periods.

---

## 4. Core Algorithm: Six Computation Steps

### Step 0 — Forward M5 Timeline Extension

Before any computation begins, Stack C **extends the M5 DataFrame** to cover the remaining M5 bars of the current H1 period that have not yet closed.

**Determination of remaining bars:**

At run time, bar 0 is the last row in `df_m5_aligned`. Its x_count position within the current H1 period is determined by comparing its timestamp against the most recent H1 boundary timestamp. The number of future M5 bars to generate is:

```
remaining_bars = m5_bars_per_h1 - x_count_of_bar_0
```

**Example (from reference workbook):** Bar 0 is at timestamp `1775700900`. The current H1 period started at `1775700000` (x_count=1). Bar 0 is at x_count=4. Remaining bars = 12 − 4 = 8. Future timestamps generated: `1775701200, 1775701500, 1775701800, 1775702100, 1775702400, 1775702700, 1775703000, 1775703300`.

**Future row content:**

- `timestamp_forward` = synthetic M5 timestamp (bar0_timestamp + n × 300, n = 1..remaining)
- `symbol` = same as bar 0
- `timeframe` = same as bar 0 ("M5")
- `close` = NaN (not yet known)
- `ssa_h1_interp`, `ema_ssa_h1_interp` = NaN (interpolation cannot be completed without next H1 anchor)
- `ssa_high_m5_interpolation`, `ssa_low_m5_interpolation` = NaN (same reason)

The extended DataFrame `df_m5_extended` replaces `df_m5_aligned` as the base for all subsequent steps.

### 4.1 Step 1 — Forward Timeline & Conditionally Populated Block (Cols AF–AK, AO–AP)

This block maps columns from `df_m5_extended` to the Stack C output. The content is **not uniformly populated** — several columns are conditionally NaN.

| Output Col | Name                        | Population Rule                                                                                        |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| AF         | `timestamp_forward`         | All rows: historical M5 timestamp from R (historical rows) or synthetic future timestamp (future rows) |
| AG         | `symbol_forward`            | All rows: constant symbol ("XAUUSD")                                                                   |
| AH         | `timeframe_forward`         | All rows: constant timeframe ("M5")                                                                    |
| AI         | `close`                     | Historical rows only: actual M5 close. NaN for future rows.                                            |
| AJ         | `ssa_m5_interpolation`      | Completed H1 periods (all x_count=1..12) + x_count=1 anchor of current period. NaN otherwise.          |
| AK         | `ema_ssa_m5_interpolation`  | Same population rule as AJ.                                                                            |
| AO         | `ssa_high_m5_interpolation` | Same population rule as AJ.                                                                            |
| AP         | `ssa_low_m5_interpolation`  | Same population rule as AJ.                                                                            |

> **Population rule explained:** H1-to-M5 interpolation requires both the current H1 anchor (start) and the _next_ H1 anchor (end) to complete. For completed H1 periods, both endpoints are known, so interpolated values are available for all 12 M5 bars (x_count 1..12). For the current in-progress H1 period, only the starting anchor (x_count=1) is known; the ending anchor has not yet been produced by Stack A. Therefore, only the x_count=1 row has a value; all subsequent rows (x_count=2..12, including future bars) are NaN. **This is intentional and correct** — the NaN state conveys that full interpolation cannot yet be performed.

> **AF is not a pass-through from Stack B column R:** Column R (Stack B) ends at bar 0 and has no rows beyond it. Column AF (Stack C) is constructed independently as the forward-extended M5 timestamp timeline. For historical rows, AF equals R numerically; for future rows, AF contains synthetically generated timestamps. AF, AG, and AH are constructed by `generate_forward_m5_timeline()`, not copied from Stack B.

### 4.2 Step 2 — SSA Trend Signal (Cols AL–AN)

**Col AL — `ssa_emassa_m5_interpolation_diff`:**

The instantaneous separation between the H1 SSA trend and its EMA signal line, mapped to M5 resolution:

```
AL[k] = AJ[k] - AK[k]
      = ssa_h1_interp[k] - ema_ssa_h1_interp[k]
```

**NaN semantics:** AL is NaN wherever AJ or AK is NaN (i.e., x_count > 1 of the current H1 period and all future rows).

**Col AM — `ssa_m5_interpolation_trend`:**

Binary trend classification derived directly from the sign of `AL`:

```
AM[k] = 'Bullish' if AL[k] > 0 else 'Bearish'
```

**NaN semantics:** AM is NaN wherever AL is NaN.

**Col AN — `ssa_m5_interpolation_trend_projection`:**

Forward-facing label carrying the current trend classification. This column is **populated for ALL rows** including the current in-progress H1 period rows and future rows, by forward-filling the last valid `AM` value:

```
AN[k] = AM[k]         if AM[k] is not NaN
AN[k] = last valid AM  if AM[k] is NaN  (forward-fill)
```

This is the explicit "projection" of the trend signal — the last known Bullish/Bearish determination is carried forward into bars where no interpolated SSA values are yet available. When new data arrives, `AN` will be updated with the actual computed value.

### 4.3 Step 3 — H1 Period Counter (Col AQ)

**Col AQ — `x_count_regression`:**

A counter from 1 to 12 that identifies the position of each M5 bar within its parent H1 period. The counter resets to 1 at every H1 boundary. **This counter is populated for ALL rows in `df_m5_extended`, including synthetic future rows.**

```
AQ[k] = position of bar k within its H1 period (1..12)
```

For the current incomplete H1 period, the counter continues beyond bar 0 into the synthetic future rows. If bar 0 is at x_count=4, future rows carry x_count=5, 6, ..., 12.

> **Critical implementation note:** The counter must align to actual H1 boundary timestamps, not to a modulo of the DataFrame row index. H1 boundary rows are those where `df_h1` timestamps coincide with `df_m5_extended` timestamps. For future synthetic rows, the x_count continues the sequence from bar 0's position.

### 4.4 Step 4 — H1 Period Slopes (Cols AR–AS)

These are the most critical inputs to the regression and projection engine. **Slopes are populated for ALL rows in `df_m5_extended`, including future rows.**

**Col AR — `slope_12_ssa_high_m5_interpolation`:**

The per-M5-bar rate of change of the H1 `ssa_high` band boundary, computed from consecutive H1 anchor values:

```
AR[period N] = (ssa_high_H1[N] - ssa_high_H1[N-1]) / 12
```

Where `ssa_high_H1[N]` is the H1 `ssa_high` value at the N-th H1 anchor timestamp. This slope is **constant for all 12 M5 bars** within period N, including future synthetic bars.

- Period 0 (no prior H1 anchor available): `AR = NaN`
- Period 1 onward: computed from consecutive H1 anchors

**Col AS — `slope_12_ssa_low_m5_interpolation`:**

```
AS[period N] = (ssa_low_H1[N] - ssa_low_H1[N-1]) / 12
```

Same NaN rule applies for period 0.

> **Slope is available for the current (in-progress) H1 period:** The slope formula uses `H1[N]` (current anchor, already known at bar 0) and `H1[N-1]` (previous anchor, also already known). It does NOT require the _next_ H1 anchor. Therefore, slope computation proceeds normally for the current period, including for all synthetic future rows. This is the foundation that allows regression and projection to extend into the future.

### 4.5 Step 5 — Band Regression Lines (Cols AT–AU)

The regression line is a linearly extrapolated trajectory starting from the H1 anchor value at the beginning of each H1 period, advancing by one slope unit per M5 bar. **Regression is populated for ALL rows including future rows.**

**Col AT — `ssa_high_m5_regression`:**

```
AT[k] = ssa_high_H1[N] + (x_count[k] - 1) * slope_high[k]
```

Where `ssa_high_H1[N]` is the H1 `ssa_high` value from `df_h1` at the start of period N (x_count=1 boundary). This is identical to `AO` at x_count=1, but is read directly from `df_h1` to avoid dependency on AO's NaN state.

Expanded:

- At x_count = 1: `AT = ssa_high_H1[N]` (equals the H1 anchor value)
- At x_count = 2: `AT = ssa_high_H1[N] + slope_high`
- At x_count = k: `AT = ssa_high_H1[N] + (k-1) × slope_high`
- At x_count = 12: `AT = ssa_high_H1[N] + 11 × slope_high`

This computation extends into future rows without interruption because both the anchor and slope are known from `df_h1`.

**Col AU — `ssa_low_m5_regression`:**

```
AU[k] = ssa_low_H1[N] + (x_count[k] - 1) * slope_low[k]
```

Identical structure to AT but using the `ssa_low` anchor and `slope_low`.

> **Regression lines are NaN for period 0**, since `slope_high` and `slope_low` are NaN when no prior H1 anchor exists.

### 4.6 Step 6 — Asymmetric Band Projection (Cols AV–AW)

This is the core trading signal engine. **Projection is populated for ALL rows including future rows.** For future synthetic rows, the projection gives the trader explicit forward visibility into where each band boundary will be at the end of the current H1 period.

#### The Asymmetric Band Projection Rule

**Col AV — `ssa_high_m5_projection` (Upper Ceiling Projection):**

```
AV[k] = AT[k] + AR[k]   if AR[k] > 0   (ceiling is RISING — project upward)
AV[k] = AT[k]            if AR[k] <= 0  (ceiling is FALLING or flat — hold at current regression)
```

**Col AW — `ssa_low_m5_projection` (Lower Floor Projection):**

```
AW[k] = AU[k] + AS[k]   if AS[k] < 0   (floor is FALLING — project downward)
AW[k] = AU[k]            if AS[k] >= 0  (floor is RISING or flat — hold at current regression)
```

**Summary of the Asymmetric Rule:**

| Band | Slope Direction | Projection Behaviour | Trading Interpretation                        |
| ---- | --------------- | -------------------- | --------------------------------------------- |
| HIGH | Rising (> 0)    | `regression + slope` | Ceiling moves up — project the expanding room |
| HIGH | Falling (≤ 0)   | `regression` (holds) | Ceiling contracting — conservative hold       |
| LOW  | Falling (< 0)   | `regression + slope` | Floor drops — project the support failure     |
| LOW  | Rising (≥ 0)    | `regression` (holds) | Floor rising — conservative hold              |

---

## 5. Full Python Implementation

### 5.1 Dependencies

```python
import numpy as np
import pandas as pd
```

### 5.2 `generate_forward_m5_timeline()` — Step 0: Forward Extension

```python
def generate_forward_m5_timeline(
    df_m5_aligned: pd.DataFrame,
    df_h1: pd.DataFrame,
    interp_cfg: dict
) -> pd.DataFrame:
    """
    Extends the M5 DataFrame beyond bar 0 to cover the remaining M5 bars
    of the current H1 period.

    Stack B's df_m5_aligned ends at bar 0 (most recent closed M5 bar).
    The current H1 period may not have completed — some M5 bars within it
    have not yet closed. This function generates synthetic rows for those
    future bars and appends them to df_m5_aligned.

    Generated future rows have:
        - timestamp_forward:  bar0_ts + n*300  (n = 1..remaining_bars)
        - symbol:             same as bar 0
        - timeframe:          same as bar 0 ("M5")
        - close:              NaN (not yet available)
        - ssa_h1_interp, ema_ssa_h1_interp:           NaN (incomplete H1 period)
        - ssa_high_m5_interpolation, ssa_low_m5_interpolation: NaN (same reason)
        - All other columns:  NaN

    Parameters:
        df_m5_aligned : Stack B output. Must have DatetimeIndex (UTC).
        df_h1         : Stack A H1 SSA DataFrame. Must have DatetimeIndex (UTC).
        interp_cfg    : Symbol config dict (interp_h1m5 block). Uses m5_bars_per_h1.

    Returns:
        df_m5_extended : df_m5_aligned with synthetic future rows appended.
                         DatetimeIndex extends to cover the end of the current H1 period.
    """
    m5_per_h1    = interp_cfg.get('m5_bars_per_h1', 12)
    m5_interval  = pd.Timedelta(seconds=300)

    bar0_ts = df_m5_aligned.index[-1]   # Most recent closed M5 bar (bar 0)
    bar0_symbol   = df_m5_aligned['symbol'].iloc[-1]
    bar0_timeframe = df_m5_aligned['timeframe'].iloc[-1]

    # Find the most recent H1 boundary at or before bar 0
    h1_boundaries = df_h1.index[df_h1.index <= bar0_ts]
    if len(h1_boundaries) == 0:
        return df_m5_aligned  # No H1 boundary found — no extension possible

    current_h1_start = h1_boundaries[-1]

    # x_count of bar 0 within its H1 period
    bars_since_h1_start = int((bar0_ts - current_h1_start) / m5_interval) + 1
    x_count_bar0 = bars_since_h1_start  # 1-based position

    remaining_bars = m5_per_h1 - x_count_bar0
    if remaining_bars <= 0:
        return df_m5_aligned  # Bar 0 is already the last bar of its H1 period

    # Generate synthetic future timestamps
    future_timestamps = [bar0_ts + m5_interval * n for n in range(1, remaining_bars + 1)]
    future_index = pd.DatetimeIndex(future_timestamps, tz=bar0_ts.tzinfo)

    # Build future rows — all value columns are NaN except symbol/timeframe
    future_rows = pd.DataFrame(
        index=future_index,
        columns=df_m5_aligned.columns
    )
    future_rows['symbol']    = bar0_symbol
    future_rows['timeframe'] = bar0_timeframe
    # All numeric columns remain NaN

    # Reconstruct timestamp column (int64 seconds) from index for future rows
    if 'timestamp' in df_m5_aligned.columns:
        future_rows['timestamp'] = future_index.astype(np.int64) // 10**9

    df_m5_extended = pd.concat([df_m5_aligned, future_rows])
    return df_m5_extended
```

### 5.3 `compute_ssa_trend_signal()`

```python
def compute_ssa_trend_signal(df_m5_extended: pd.DataFrame) -> pd.DataFrame:
    """
    Computes the H1 SSA trend signal columns from Stack B interpolated values.

    Produces:
        ssa_emassa_m5_interpolation_diff  (col AL): ssa_h1_interp - ema_ssa_h1_interp
        ssa_m5_interpolation_trend        (col AM): 'Bullish' if diff > 0 else 'Bearish'
        ssa_m5_interpolation_trend_projection (col AN): same as AM; forward-filled for ALL rows

    AL and AM are NaN wherever ssa_h1_interp or ema_ssa_h1_interp are NaN
    (i.e., x_count > 1 of the current H1 period, and all future synthetic rows).

    AN is populated for ALL rows via forward-fill, carrying the last known
    Bullish/Bearish signal forward through the current-period and future rows.

    Parameters:
        df_m5_extended : Forward-extended M5 DataFrame from generate_forward_m5_timeline().
                         Must have DatetimeIndex.
                         Required columns: ssa_h1_interp, ema_ssa_h1_interp.

    Returns:
        DataFrame with columns: ssa_emassa_diff, ssa_trend, ssa_trend_projection
        indexed on df_m5_extended.index.
    """
    diff = df_m5_extended['ssa_h1_interp'] - df_m5_extended['ema_ssa_h1_interp']

    # trend is NaN where diff is NaN
    trend = diff.apply(
        lambda x: 'Bullish' if x > 0 else ('Bearish' if x < 0 else 'Bullish')
        if pd.notna(x) else np.nan
    )

    # trend_projection forward-fills over all NaN rows (current period + future)
    trend_projection = trend.ffill()

    return pd.DataFrame({
        'ssa_emassa_diff':        diff,
        'ssa_trend':              trend,
        'ssa_trend_projection':   trend_projection,
    }, index=df_m5_extended.index)
```

### 5.4 `compute_h1_period_slopes()`

```python
def compute_h1_period_slopes(
    df_m5_extended: pd.DataFrame,
    df_h1: pd.DataFrame,
    interp_cfg: dict
) -> pd.DataFrame:
    """
    Computes the per-H1-period slope of ssa_high and ssa_low band boundaries,
    and assigns an x_count position (1..12) to every M5 bar, including future bars.

    The slope for H1 period N is:
        slope_high[N] = (ssa_high_H1[N] - ssa_high_H1[N-1]) / m5_bars_per_h1
        slope_low[N]  = (ssa_low_H1[N]  - ssa_low_H1[N-1])  / m5_bars_per_h1

    Period 0 (no prior H1 anchor) produces NaN slopes.
    Slope is constant for all 12 M5 bars within a period, including synthetic future bars.

    Parameters:
        df_m5_extended : Forward-extended M5 DataFrame.
        df_h1          : H1 DataFrame from Stack A. Must have DatetimeIndex.
                         Required columns: ssa_high, ssa_low.
        interp_cfg     : Symbol config dict. Uses m5_bars_per_h1.

    Returns:
        DataFrame with columns: x_count, slope_high, slope_low
        indexed on df_m5_extended.index.
        All rows populated including synthetic future rows.
    """
    m5_per_h1   = interp_cfg.get('m5_bars_per_h1', 12)
    m5_interval = pd.Timedelta(seconds=300)

    n_rows = len(df_m5_extended)
    x_count    = np.zeros(n_rows, dtype=int)
    slope_high = np.full(n_rows, np.nan)
    slope_low  = np.full(n_rows, np.nan)

    m5_timestamps = df_m5_extended.index

    # Identify all H1 boundary timestamps that fall within or before the extended M5 range
    h1_in_range = df_h1[df_h1.index <= m5_timestamps[-1]].copy()
    h1_timestamps = h1_in_range.index

    # Map H1 boundary timestamps to M5 row positions
    h1_positions = []
    for ts in h1_timestamps:
        pos_arr = np.searchsorted(m5_timestamps, ts)
        if pos_arr < n_rows and m5_timestamps[pos_arr] == ts:
            h1_positions.append(pos_arr)

    # Assign x_count (1..12) and slopes for each H1 period
    for period_idx, h1_pos in enumerate(h1_positions):
        end_pos = h1_positions[period_idx + 1] if period_idx + 1 < len(h1_positions) else n_rows
        period_len = end_pos - h1_pos

        for j in range(period_len):
            if h1_pos + j < n_rows:
                x_count[h1_pos + j] = j + 1  # 1-based

        # Slope requires a prior H1 anchor
        if period_idx == 0:
            continue  # Period 0: NaN slopes

        hi_curr = h1_in_range['ssa_high'].iloc[period_idx]
        hi_prev = h1_in_range['ssa_high'].iloc[period_idx - 1]
        lo_curr = h1_in_range['ssa_low'].iloc[period_idx]
        lo_prev = h1_in_range['ssa_low'].iloc[period_idx - 1]

        s_high = (hi_curr - hi_prev) / m5_per_h1
        s_low  = (lo_curr - lo_prev) / m5_per_h1

        for j in range(period_len):
            if h1_pos + j < n_rows:
                slope_high[h1_pos + j] = s_high
                slope_low[h1_pos + j]  = s_low

    return pd.DataFrame({
        'x_count':    x_count,
        'slope_high': slope_high,
        'slope_low':  slope_low,
    }, index=df_m5_extended.index)
```

### 5.5 `compute_band_regression()`

```python
def compute_band_regression(
    df_m5_extended: pd.DataFrame,
    df_h1: pd.DataFrame,
    df_slopes: pd.DataFrame
) -> pd.DataFrame:
    """
    Computes linear regression lines for ssa_high and ssa_low band boundaries
    across each H1 period on the extended M5 grid.

    Formula:
        regression_high[k] = ssa_high_H1[N] + (x_count[k] - 1) * slope_high[k]
        regression_low[k]  = ssa_low_H1[N]  + (x_count[k] - 1) * slope_low[k]

    The anchor ssa_high_H1[N] and ssa_low_H1[N] are read from df_h1 at the H1 boundary
    timestamp (x_count == 1 row). Reading from df_h1 directly avoids dependency on
    AO/AP column NaN state (AO/AP are NaN for x_count > 1 of the current period).

    Regression is computed for ALL rows including synthetic future rows.
    NaN where slope is NaN (period 0 warmup).

    Parameters:
        df_m5_extended : Forward-extended M5 DataFrame.
        df_h1          : Stack A H1 SSA DataFrame. Required: ssa_high, ssa_low.
        df_slopes      : Output of compute_h1_period_slopes(). Required: x_count, slope_high, slope_low.

    Returns:
        DataFrame with columns: regression_high, regression_low
        indexed on df_m5_extended.index. All rows populated (NaN for period 0 only).
    """
    n_rows = len(df_m5_extended)
    regression_high = np.full(n_rows, np.nan)
    regression_low  = np.full(n_rows, np.nan)

    x_count    = df_slopes['x_count'].values
    slope_hi   = df_slopes['slope_high'].values
    slope_lo   = df_slopes['slope_low'].values

    m5_timestamps = df_m5_extended.index

    anchor_hi = None
    anchor_lo = None

    for k in range(n_rows):
        if np.isnan(slope_hi[k]):
            continue  # Period 0 — no slope, regression is NaN

        if x_count[k] == 1:
            # H1 period boundary — lock in anchor from df_h1
            ts = m5_timestamps[k]
            if ts in df_h1.index:
                anchor_hi = df_h1.loc[ts, 'ssa_high']
                anchor_lo = df_h1.loc[ts, 'ssa_low']
            else:
                anchor_hi = None
                anchor_lo = None

        if anchor_hi is not None and not np.isnan(anchor_hi):
            regression_high[k] = anchor_hi + (x_count[k] - 1) * slope_hi[k]
            regression_low[k]  = anchor_lo + (x_count[k] - 1) * slope_lo[k]

    return pd.DataFrame({
        'regression_high': regression_high,
        'regression_low':  regression_low,
    }, index=df_m5_extended.index)
```

### 5.6 `compute_asymmetric_band_projection()`

```python
def compute_asymmetric_band_projection(
    df_regression: pd.DataFrame,
    df_slopes: pd.DataFrame
) -> pd.DataFrame:
    """
    Computes asymmetric one-step-ahead projections for band boundaries.

    Asymmetric Band Projection Rule:
        ssa_high projection:
            slope_high > 0  → projection = regression_high + slope_high  (ceiling rising)
            slope_high <= 0 → projection = regression_high               (ceiling falling: hold)

        ssa_low projection:
            slope_low < 0   → projection = regression_low + slope_low    (floor falling)
            slope_low >= 0  → projection = regression_low                (floor rising: hold)

    Projection is computed for ALL rows including synthetic future rows.

    Parameters:
        df_regression : Output of compute_band_regression(). Required: regression_high, regression_low.
        df_slopes     : Output of compute_h1_period_slopes(). Required: slope_high, slope_low.

    Returns:
        DataFrame with columns: projection_high, projection_low
        indexed on df_regression.index.
    """
    reg_hi  = df_regression['regression_high'].values
    reg_lo  = df_regression['regression_low'].values
    slp_hi  = df_slopes['slope_high'].values
    slp_lo  = df_slopes['slope_low'].values

    n_rows = len(df_regression)
    projection_high = np.full(n_rows, np.nan)
    projection_low  = np.full(n_rows, np.nan)

    for k in range(n_rows):
        if np.isnan(reg_hi[k]) or np.isnan(slp_hi[k]):
            continue

        projection_high[k] = reg_hi[k] + slp_hi[k] if slp_hi[k] > 0 else reg_hi[k]
        projection_low[k]  = reg_lo[k] + slp_lo[k] if slp_lo[k] < 0 else reg_lo[k]

    return pd.DataFrame({
        'projection_high': projection_high,
        'projection_low':  projection_low,
    }, index=df_regression.index)
```

### 5.7 `build_band_projection_output()`

```python
def build_band_projection_output(
    df_m5_extended: pd.DataFrame,
    df_trend: pd.DataFrame,
    df_slopes: pd.DataFrame,
    df_regression: pd.DataFrame,
    df_projection: pd.DataFrame
) -> pd.DataFrame:
    """
    Assembles the final Stack C output DataFrame in the canonical column order
    matching Mapped_H1_M5_Interporate cols AF–AW.

    Column mapping:
        AF  timestamp_forward               ← df_m5_extended.timestamp (historical) + synthetic (future)
        AG  symbol_forward                  ← df_m5_extended.symbol  (all rows)
        AH  timeframe_forward               ← df_m5_extended.timeframe  (all rows)
        AI  close                           ← df_m5_extended.close  (historical NaN future)
        AJ  ssa_m5_interpolation            ← df_m5_extended.ssa_h1_interp  (completed periods only)
        AK  ema_ssa_m5_interpolation        ← df_m5_extended.ema_ssa_h1_interp  (completed periods only)
        AL  ssa_emassa_m5_interpolation_diff← df_trend.ssa_emassa_diff  (NaN where AJ/AK are NaN)
        AM  ssa_m5_interpolation_trend      ← df_trend.ssa_trend  (NaN where AL is NaN)
        AN  ssa_m5_interp_trend_projection  ← df_trend.ssa_trend_projection  (ALL rows, forward-filled)
        AO  ssa_high_m5_interpolation       ← df_m5_extended.ssa_high_m5_interpolation  (completed periods only)
        AP  ssa_low_m5_interpolation        ← df_m5_extended.ssa_low_m5_interpolation  (completed periods only)
        AQ  x_count_regression              ← df_slopes.x_count  (ALL rows)
        AR  slope_12_ssa_high               ← df_slopes.slope_high  (ALL rows)
        AS  slope_12_ssa_low                ← df_slopes.slope_low  (ALL rows)
        AT  ssa_high_m5_regression          ← df_regression.regression_high  (ALL rows)
        AU  ssa_low_m5_regression           ← df_regression.regression_low  (ALL rows)
        AV  ssa_high_m5_projection          ← df_projection.projection_high  (ALL rows)
        AW  ssa_low_m5_projection           ← df_projection.projection_low  (ALL rows)

    Returns:
        df_out : Clean output DataFrame with exactly 18 columns.
                 Row count = len(df_m5_aligned) + remaining_future_bars_in_current_H1_period.
    """
    df_out = pd.DataFrame({
        'timestamp_forward':                df_m5_extended['timestamp'],
        'symbol_forward':                   df_m5_extended['symbol'],
        'timeframe_forward':                df_m5_extended['timeframe'],
        'close':                            df_m5_extended['close'],
        'ssa_m5_interpolation':             df_m5_extended['ssa_h1_interp'],
        'ema_ssa_m5_interpolation':         df_m5_extended['ema_ssa_h1_interp'],
        'ssa_emassa_m5_interpolation_diff': df_trend['ssa_emassa_diff'],
        'ssa_m5_interpolation_trend':       df_trend['ssa_trend'],
        'ssa_m5_interpolation_trend_projection': df_trend['ssa_trend_projection'],
        'ssa_high_m5_interpolation':        df_m5_extended['ssa_high_m5_interpolation'],
        'ssa_low_m5_interpolation':         df_m5_extended['ssa_low_m5_interpolation'],
        'x_count_regression':               df_slopes['x_count'],
        'slope_12_ssa_high':                df_slopes['slope_high'],
        'slope_12_ssa_low':                 df_slopes['slope_low'],
        'ssa_high_m5_regression':           df_regression['regression_high'],
        'ssa_low_m5_regression':            df_regression['regression_low'],
        'ssa_high_m5_projection':           df_projection['projection_high'],
        'ssa_low_m5_projection':            df_projection['projection_low'],
    }, index=df_m5_extended.index)

    return df_out
```

### 5.8 `run_band_projection_pipeline()` — Master Function

```python
def run_band_projection_pipeline(
    df_m5_aligned: pd.DataFrame,
    df_h1: pd.DataFrame,
    interp_cfg: dict
) -> pd.DataFrame:
    """
    Master execution function for Python Backend Stack C.

    Consumes Stack B's df_m5_aligned (historical data only) and Stack A's df_h1
    to produce a consolidated 18-column DataFrame containing:
      - Forward-extended M5 timeline covering remaining H1-period bars (Step 0)
      - H1 SSA trend direction signal (cols AL–AN)
      - H1 period slope of band boundaries (cols AQ–AS, ALL rows including future)
      - Per-M5-bar band regression lines (cols AT–AU, ALL rows including future)
      - Asymmetric one-step-ahead band projections (cols AV–AW, ALL rows including future)

    The output row count exceeds df_m5_aligned row count by the number of remaining
    M5 bars in the current H1 period (0 to 11 future rows).

    This pipeline is the Python equivalent of
    Mapped_H1_M5_Interporate sheet columns AF–AW
    (ALGLIB_SSA_XAUUSD_timeframemapping.xlsx).

    Parameters:
        df_m5_aligned : Stack B output. Must have DatetimeIndex. Historical data only.
        df_h1         : Stack A H1 SSA DataFrame. Must have DatetimeIndex.
        interp_cfg    : Symbol-specific config dict (interp_h1m5 block from Phase 6 schema).

    Returns:
        df_band_projection : Final 18-column output DataFrame.
                             Indexed on extended DatetimeIndex covering bar 0 + future bars.
    """
    _validate_band_projection_inputs(df_m5_aligned, df_h1)

    # Step 0: Extend the M5 grid to cover remaining bars of current H1 period
    df_m5_extended = generate_forward_m5_timeline(df_m5_aligned, df_h1, interp_cfg)

    # Step 1 & 2: Trend signal (NaN for current partial period; AN forward-filled for all rows)
    df_trend = compute_ssa_trend_signal(df_m5_extended)

    # Step 3: H1 period counter + slopes (all rows, including future)
    df_slopes = compute_h1_period_slopes(df_m5_extended, df_h1, interp_cfg)

    # Step 4: Band regression lines (all rows, including future; anchor from df_h1)
    df_regression = compute_band_regression(df_m5_extended, df_h1, df_slopes)

    # Step 5: Asymmetric one-step-ahead band projection (all rows, including future)
    df_projection = compute_asymmetric_band_projection(df_regression, df_slopes)

    # Step 6: Assemble canonical output
    df_band_projection = build_band_projection_output(
        df_m5_extended, df_trend, df_slopes, df_regression, df_projection
    )

    return df_band_projection
```

### 5.9 `_validate_band_projection_inputs()` — Guard Function

```python
def _validate_band_projection_inputs(
    df_m5_aligned: pd.DataFrame,
    df_h1: pd.DataFrame
) -> None:
    """
    Validates inputs to Stack C. Raises ValueError with descriptive messages on failure.
    """
    required_m5 = {'timestamp', 'symbol', 'timeframe', 'close',
                   'ssa_h1_interp', 'ema_ssa_h1_interp',
                   'ssa_high_m5_interpolation', 'ssa_low_m5_interpolation'}
    required_h1 = {'ssa_high', 'ssa_low'}

    if not isinstance(df_m5_aligned.index, pd.DatetimeIndex):
        raise ValueError("df_m5_aligned must have a DatetimeIndex.")

    if not isinstance(df_h1.index, pd.DatetimeIndex):
        raise ValueError("df_h1 must have a DatetimeIndex.")

    missing_m5 = required_m5 - set(df_m5_aligned.columns)
    if missing_m5:
        raise ValueError(
            f"df_m5_aligned is missing required Stack B columns: {missing_m5}. "
            f"Ensure run_h1m5_interpolation_pipeline() was called before Stack C."
        )

    missing_h1 = required_h1 - set(df_h1.columns)
    if missing_h1:
        raise ValueError(
            f"df_h1 is missing required Stack A SSA columns: {missing_h1}. "
            f"Ensure run_ssa_pipeline() was called on H1 data."
        )

    h1_in_range = df_h1[df_h1.index <= df_m5_aligned.index.max()]
    if len(h1_in_range) < 2:
        raise ValueError(
            f"Insufficient H1 bars at or before M5 range for slope computation. "
            f"Found {len(h1_in_range)}, minimum required: 2."
        )
```

---

## 6. Output Schema

### 6.1 `df_band_projection` — Stack C Output DataFrame

18 columns, indexed by `DatetimeIndex` (UTC). Row count = `len(df_m5_aligned)` + number of remaining M5 bars in the current H1 period (between 0 and 11 future rows).

| Column                                  | Type    | Excel Col | Population      | Description                                                                                            |
| --------------------------------------- | ------- | --------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `timestamp_forward`                     | int64   | AF        | All rows        | Forward M5 timestamp. Historical rows: same as Stack B col R. Future rows: synthetic.                  |
| `symbol_forward`                        | str     | AG        | All rows        | Instrument symbol (constant).                                                                          |
| `timeframe_forward`                     | str     | AH        | All rows        | Always `M5` (constant).                                                                                |
| `close`                                 | float64 | AI        | Historical only | Actual M5 close. NaN for future rows.                                                                  |
| `ssa_m5_interpolation`                  | float64 | AJ        | Conditional     | H1 `ssa` interpolated to M5. Populated for completed H1 periods + x_count=1 of current. NaN otherwise. |
| `ema_ssa_m5_interpolation`              | float64 | AK        | Conditional     | H1 `ema_ssa` interpolated to M5. Same rule as AJ.                                                      |
| `ssa_emassa_m5_interpolation_diff`      | float64 | AL        | Conditional     | AJ − AK. NaN where AJ or AK is NaN.                                                                    |
| `ssa_m5_interpolation_trend`            | str     | AM        | Conditional     | `'Bullish'` if AL > 0, `'Bearish'` if AL < 0. NaN where AL is NaN.                                     |
| `ssa_m5_interpolation_trend_projection` | str     | AN        | All rows        | Forward-fill of AM over all NaN rows. Never NaN (after first valid AM value).                          |
| `ssa_high_m5_interpolation`             | float64 | AO        | Conditional     | H1 `ssa_high` interpolated to M5. Same population rule as AJ.                                          |
| `ssa_low_m5_interpolation`              | float64 | AP        | Conditional     | H1 `ssa_low` interpolated to M5. Same population rule as AJ.                                           |
| `x_count_regression`                    | int32   | AQ        | All rows        | M5 position within H1 period (1–12). Continues into future rows.                                       |
| `slope_12_ssa_high`                     | float64 | AR        | All rows        | `(ssa_high_H1[N] − ssa_high_H1[N-1]) / 12`. Constant per period. NaN for period 0.                     |
| `slope_12_ssa_low`                      | float64 | AS        | All rows        | `(ssa_low_H1[N]  − ssa_low_H1[N-1])  / 12`. Same rule.                                                 |
| `ssa_high_m5_regression`                | float64 | AT        | All rows        | `ssa_high_H1[N] + (x_count−1) × slope_high`. NaN for period 0.                                         |
| `ssa_low_m5_regression`                 | float64 | AU        | All rows        | `ssa_low_H1[N] + (x_count−1) × slope_low`. NaN for period 0.                                           |
| `ssa_high_m5_projection`                | float64 | AV        | All rows        | `regression_high + slope_high` if rising; else `regression_high`. NaN for period 0.                    |
| `ssa_low_m5_projection`                 | float64 | AW        | All rows        | `regression_low + slope_low` if falling; else `regression_low`. NaN for period 0.                      |

### 6.2 Population Summary by Row Type

| Row Type                                   | AI  | AJ/AK/AO/AP | AL/AM | AN           | AQ–AW |
| ------------------------------------------ | --- | ----------- | ----- | ------------ | ----- |
| Historical / completed H1 period (x=1..12) | ✓   | ✓           | ✓     | ✓ (computed) | ✓     |
| Historical / current H1 period x_count=1   | ✓   | ✓ (anchor)  | ✓     | ✓ (computed) | ✓     |
| Historical / current H1 period x_count>1   | ✓   | NaN         | NaN   | ✓ (ffill)    | ✓     |
| Synthetic future bars (x_count>bar0)       | NaN | NaN         | NaN   | ✓ (ffill)    | ✓     |

### 6.3 JSON Payload Extension

Stack C further extends the unified frontend API payload defined in Stack A Section 9 and Stack B Section 6.2. The `bar_0` fields reflect bar 0 only; the `forward` array carries all rows including future:

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
  "ssa_high_m5_interpolation": 4639.044,
  "ssa_high_m5": 4628.943,
  "ssa_low_m5_interpolation": 4598.718,
  "ssa_low_m5": 4622.095,
  "ssa_cross_signal": "H1_above_M5",

  "ssa_emassa_diff": 3.751,
  "ssa_trend": "Bullish",
  "ssa_trend_projection": "Bullish",
  "x_count_regression": 4,
  "slope_high": 0.147972,
  "slope_low": 0.0,
  "ssa_high_regression": 4732.0128,
  "ssa_low_regression": 4714.4966,
  "ssa_high_projection": 4732.1608,
  "ssa_low_projection": 4714.4966,

  "forward_bars": [
    {
      "timestamp": 1775700900,
      "x_count": 4,
      "ssa_high_projection": 4732.1608,
      "ssa_low_projection": 4714.4966,
      "ssa_trend_projection": "Bullish"
    },
    {
      "timestamp": 1775701200,
      "x_count": 5,
      "ssa_high_projection": 4732.3087,
      "ssa_low_projection": 4714.4966,
      "ssa_trend_projection": "Bullish"
    },
    {
      "timestamp": 1775701500,
      "x_count": 6,
      "ssa_high_projection": 4732.4567,
      "ssa_low_projection": 4714.4966,
      "ssa_trend_projection": "Bullish"
    },
    {
      "timestamp": 1775703300,
      "x_count": 12,
      "ssa_high_projection": 4733.3445,
      "ssa_low_projection": 4714.4966,
      "ssa_trend_projection": "Bullish"
    }
  ]
}
```

---

## 7. Phase 6 Configuration Schema Extension

Stack C reuses the `interp_h1m5` config block defined in Stack B. The `m5_bars_per_h1` parameter governs both the slope divisor and the number of future bars generated by `generate_forward_m5_timeline()`.

If per-symbol asymmetric projection thresholds need to be adjustable, a future `band_projection` block can be added:

```json
{
  "XAUUSD": {
    "interp_h1m5": {
      "m5_bars_per_h1": 12,
      "cross_signal_tolerance_pct": 0.0005,
      "interpolate_columns": ["ssa", "ema_ssa", "ssa_high", "ssa_low"]
    },
    "band_projection": {
      "slope_high_floor": 0.0,
      "slope_low_ceiling": 0.0
    }
  }
}
```

| Field               | Default | Description                                                                                  |
| ------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `slope_high_floor`  | `0.0`   | Minimum slope_high to trigger forward projection of ceiling. Default: any positive triggers. |
| `slope_low_ceiling` | `0.0`   | Maximum slope_low to trigger forward projection of floor. Default: any negative triggers.    |

---

## 8. Integration Pattern with Stack A and Stack B

```python
def execute_full_pipeline(
    df_m5_raw: pd.DataFrame,
    df_m15_raw: pd.DataFrame,
    df_h1_raw: pd.DataFrame,
    valid_line_cols: list,
    symbol_config: dict
) -> dict:
    """
    Unified master pipeline: Stack A + Stack B + Stack C.
    """
    ssa_cfg    = symbol_config['ssa_entropy']
    interp_cfg = symbol_config['interp_h1m5']

    # ── STACK A: SSA on all timeframes ──────────────────────────────────────
    df_m5  = run_ssa_pipeline(df_m5_raw,  ssa_cfg)
    df_m15 = run_ssa_pipeline(df_m15_raw, ssa_cfg)
    df_h1  = run_ssa_pipeline(df_h1_raw,  ssa_cfg)

    # ── STACK A: BPI / RPI / HMI ────────────────────────────────────────────
    bpi_df = execute_bpi_pipeline(df_m5, df_m15, valid_line_cols, symbol_config)
    line_price_cols  = [c for c in df_m5.columns if 'line' in c]
    line_score_cols  = [c for c in df_m5.columns if 'score' in c]
    global_max_score = df_m5[[c for c in df_m5.columns if 'Final_Score' in c]].max().max()
    res_price, res_score, sup_price, sup_score = extract_dynamic_targets_with_scores(
        df_m5, line_price_cols, line_score_cols
    )
    rpi_df = calculate_universal_rpi_m5(
        df_m5, res_price, res_score, sup_price, sup_score,
        global_max_score, sigma_pct=symbol_config['rpi_structural']['sigma_pct']
    )
    hmi_df = calculate_hmi_m5(df_m5, res_price, res_score, sup_price, sup_score, global_max_score)

    # ── STACK B: H1-to-M5 interpolation (historical bars only, up to bar 0) ─
    df_m5_aligned = run_h1m5_interpolation_pipeline(df_h1, df_m5, interp_cfg)

    # ── STACK C: Forward extension + band slope, regression, projection ──────
    # df_m5_aligned from Stack B + df_h1 from Stack A.
    # Output extends beyond bar 0 into remaining H1-period future bars.
    df_band_projection = run_band_projection_pipeline(df_m5_aligned, df_h1, interp_cfg)

    # ── UNIFIED JSON PAYLOAD ─────────────────────────────────────────────────
    latest_m5    = df_m5_aligned.iloc[-1]          # bar 0 from Stack B
    bar0_idx     = len(df_m5_aligned) - 1          # index of bar 0 in df_band_projection
    latest_bp    = df_band_projection.iloc[bar0_idx]  # Stack C values at bar 0
    latest_bpi   = bpi_df.iloc[-1]
    latest_rpi   = rpi_df.iloc[-1]
    latest_hmi   = hmi_df.iloc[-1]
    latest_ent   = df_m5['entropy'].dropna().iloc[-1]
    ssa_regime   = _map_entropy_to_regime(latest_ent, ssa_cfg)

    # Build forward_bars array from bar 0 through end of H1 period
    forward_rows = df_band_projection.iloc[bar0_idx:]
    forward_bars = [
        {
            'timestamp':            int(row['timestamp_forward']),
            'x_count':              int(row['x_count_regression']),
            'ssa_high_projection':  round(float(row['ssa_high_m5_projection']), 5),
            'ssa_low_projection':   round(float(row['ssa_low_m5_projection']), 5),
            'ssa_trend_projection': row['ssa_m5_interpolation_trend_projection'],
        }
        for _, row in forward_rows.iterrows()
    ]

    payload = {
        # Stack A
        'active_hmi':             round(float(latest_hmi['active_hmi']), 2),
        'active_hmi_type':        latest_hmi['active_hmi_type'],
        'active_rpi':             round(float(latest_rpi['active_rpi']), 2),
        'active_rpi_type':        latest_rpi['active_rpi_type'],
        'active_bpi':             round(float(latest_bpi['active_bpi']), 2),
        'active_bpi_type':        latest_bpi['active_bpi_type'],
        'distance_to_active':     round(float(latest_rpi['distance_to_active']), 4),
        'entropy':                round(float(latest_ent), 4),
        'ssa_regime':             ssa_regime,
        'upper_sandwich_price':   round(float(res_price.iloc[-1]), 2),
        'lower_sandwich_price':   round(float(sup_price.iloc[-1]), 2),
        # Stack B
        'ssa_h1_interp':          round(float(latest_m5['ssa_h1_interp']), 5),
        'ema_ssa_h1_interp':      round(float(latest_m5['ema_ssa_h1_interp']), 5),
        'ssa_m5':                 round(float(latest_m5['ssa_m5']), 5),
        'ema_ssa_m5':             round(float(latest_m5['ema_ssa_m5']), 5),
        'ssa_high_m5_interpolation': round(float(latest_m5['ssa_high_m5_interpolation']), 5),
        'ssa_high_m5':            round(float(latest_m5['ssa_high_m5']), 5),
        'ssa_low_m5_interpolation':  round(float(latest_m5['ssa_low_m5_interpolation']), 5),
        'ssa_low_m5':             round(float(latest_m5['ssa_low_m5']), 5),
        'ssa_cross_signal':       compute_ssa_cross_signal(latest_m5),
        # Stack C — bar 0 values
        'ssa_emassa_diff':        round(float(latest_bp['ssa_emassa_m5_interpolation_diff']), 5)
                                  if pd.notna(latest_bp['ssa_emassa_m5_interpolation_diff']) else None,
        'ssa_trend':              latest_bp['ssa_m5_interpolation_trend']
                                  if pd.notna(latest_bp['ssa_m5_interpolation_trend']) else None,
        'ssa_trend_projection':   latest_bp['ssa_m5_interpolation_trend_projection'],
        'x_count_regression':     int(latest_bp['x_count_regression']),
        'slope_high':             round(float(latest_bp['slope_12_ssa_high']), 5),
        'slope_low':              round(float(latest_bp['slope_12_ssa_low']), 5),
        'ssa_high_regression':    round(float(latest_bp['ssa_high_m5_regression']), 5),
        'ssa_low_regression':     round(float(latest_bp['ssa_low_m5_regression']), 5),
        'ssa_high_projection':    round(float(latest_bp['ssa_high_m5_projection']), 5),
        'ssa_low_projection':     round(float(latest_bp['ssa_low_m5_projection']), 5),
        # Stack C — full forward array (bar 0 through end of H1 period)
        'forward_bars':           forward_bars,
    }

    return payload
```

---

## 9. Data Flow Summary

```
Stack A (RAM):
  ohlcv H1  → run_ssa_pipeline() → df_h1  (ssa_high, ssa_low anchors for Stack C)
  ohlcv M5  → run_ssa_pipeline() → df_m5
  ohlcv M15 → run_ssa_pipeline() → df_m15
  df_m5 + df_m15 → execute_bpi_pipeline()  → bpi_df
  df_m5          → execute_rpi_pipeline()  → rpi_df
  df_m5          → execute_hmi_pipeline()  → hmi_df

Stack B (RAM):
  df_h1 + df_m5 → run_h1m5_interpolation_pipeline()
               → df_m5_aligned (12 cols, R–AC, historical data only, up to bar 0)

Stack C (RAM):
  Step 0: df_m5_aligned + df_h1 → generate_forward_m5_timeline()
        → df_m5_extended  (df_m5_aligned + synthetic future rows for remaining H1-period bars)

  Step 1-2: df_m5_extended → compute_ssa_trend_signal()
          → df_trend  (AL: diff [NaN for partial period], AM: trend label [NaN for partial period],
                       AN: trend projection [ALL rows, ffill])

  Step 3: df_m5_extended + df_h1 → compute_h1_period_slopes()
        → df_slopes  (AQ: x_count [ALL rows], AR/AS: slopes [ALL rows, NaN period 0 only])

  Step 4: df_m5_extended + df_h1 + df_slopes → compute_band_regression()
        → df_regression  (AT/AU: regression lines [ALL rows, NaN period 0 only])

  Step 5: df_regression + df_slopes → compute_asymmetric_band_projection()
        → df_projection  (AV/AW: projections [ALL rows, NaN period 0 only])

  Step 6: all above → build_band_projection_output()
        → df_band_projection  (18 cols, AF–AW)
           Row count = Stack B rows + (m5_bars_per_h1 - x_count_of_bar_0) future rows

Export:
  All three stacks → unified JSON payload → PostgreSQL + Redis
  Payload includes forward_bars[] array for full H1-period band projection display
```

---

## 10. Verification Against Reference Workbook

```python
def verify_stack_c_against_reference(
    df_band_projection: pd.DataFrame,
    reference_path: str,
    tolerance: float = 1e-4
) -> dict:
    """
    Compares Stack C output against reference workbook columns AF–AW.

    Reference columns (Mapped_H1_M5_Interporate AF–AW):
        AQ = x_count_regression              → df_band_projection['x_count_regression']
        AR = slope_12_ssa_high               → df_band_projection['slope_12_ssa_high']
        AS = slope_12_ssa_low                → df_band_projection['slope_12_ssa_low']
        AT = ssa_high_m5_regression          → df_band_projection['ssa_high_m5_regression']
        AU = ssa_low_m5_regression           → df_band_projection['ssa_low_m5_regression']
        AV = ssa_high_m5_projection          → df_band_projection['ssa_high_m5_projection']
        AW = ssa_low_m5_projection           → df_band_projection['ssa_low_m5_projection']

    Note: AL (diff) and AM/AN (trend labels) are also verified but only for
    rows where the reference has non-null values.

    Returns dict with per-column max_abs_error and pass/fail status.
    """
    ref = pd.read_excel(reference_path, sheet_name='Mapped_H1_M5_Interporate',
                        header=0, usecols='AF:AW')

    numeric_col_map = {
        'ssa_emassa_m5_interpolation_diff':     'ssa_emassa_m5_interpolation_diff',
        'x_count_regression':                   'x_count_regression',
        'slope_12_ssa_high_m5_interpolation':   'slope_12_ssa_high',
        'slope_12_ssa_low_m5_interpolation':    'slope_12_ssa_low',
        'ssa_high_m5_regression':               'ssa_high_m5_regression',
        'ssa_low_m5_regression':                'ssa_low_m5_regression',
        'ssa_high_m5_projection':               'ssa_high_m5_projection',
        'ssa_low_m5_projection':                'ssa_low_m5_projection',
    }

    label_col_map = {
        'ssa_m5_interpolation_trend':            'ssa_m5_interpolation_trend',
        'ssa_m5_interpolation_trend_projection': 'ssa_m5_interpolation_trend_projection',
    }

    results = {}

    for ref_col, out_col in numeric_col_map.items():
        if ref_col not in ref.columns or out_col not in df_band_projection.columns:
            results[out_col] = {'status': 'SKIP', 'reason': 'column not found'}
            continue
        # Use only rows where reference has non-null values
        ref_series = ref[ref_col].dropna()
        ref_vals = ref_series.values
        out_vals = df_band_projection[out_col].dropna().values[:len(ref_vals)]
        max_error = np.max(np.abs(ref_vals - out_vals))
        results[out_col] = {
            'status':        'PASS' if max_error <= tolerance else 'FAIL',
            'max_abs_error': round(float(max_error), 8),
            'tolerance':     tolerance,
            'rows_compared': len(ref_vals),
        }

    for ref_col, out_col in label_col_map.items():
        if ref_col not in ref.columns or out_col not in df_band_projection.columns:
            results[out_col] = {'status': 'SKIP', 'reason': 'column not found'}
            continue
        ref_series = ref[ref_col].dropna()
        ref_vals = ref_series.values
        out_vals = df_band_projection[out_col].dropna().values[:len(ref_vals)]
        mismatches = int(np.sum(ref_vals != out_vals))
        results[out_col] = {
            'status':       'PASS' if mismatches == 0 else 'FAIL',
            'mismatches':   mismatches,
            'rows_compared': len(ref_vals),
        }

    return results
```

**Acceptance criteria:**

- All numeric columns: `PASS` with `max_abs_error ≤ 1e-4`
- Both label columns (`ssa_trend`, `ssa_trend_projection`): `mismatches = 0`
- `slope_12_ssa_high` / `slope_12_ssa_low` FAIL → H1 anchor misidentification
- `ssa_high/low_m5_regression` FAIL → Anchor lock or x_count propagation error
- Projection columns FAIL → Asymmetric rule conditional check error
- Future row values (timestamps beyond bar 0) must pass independently — run the comparison on the full output including future rows against the reference's future rows

---

## 11. Technical Stack

Stack C shares the complete technical stack from Stack A Section 10 and Stack B Section 10. No additional libraries are introduced.

| Purpose                    | Library      | Notes                                                                                                                                                                                                                                      |
| -------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Slope and regression math  | `numpy`      | All arithmetic vectorized; `np.full`, `np.nan`, `np.searchsorted`                                                                                                                                                                          |
| DataFrame assembly         | `pandas`     | Output assembled via `pd.DataFrame()` with extended `DatetimeIndex`                                                                                                                                                                        |
| Forward timeline extension | `pandas`     | `pd.concat()` for appending synthetic future rows; `pd.DatetimeIndex` for timestamps                                                                                                                                                       |
| Excel reference reading    | `openpyxl`   | Required by `pd.read_excel()` to open `.xlsx` files. Used in `verify_stack_c_against_reference()` only. File: `ALGLIB_SSA_XAUUSD_timeframemapping.xlsx`, sheet: `Mapped_H1_M5_Interporate`, cols: `AF:AW`. Install: `pip install openpyxl` |
| Config hot-reload          | `Redis`      | Reuses same Pub/Sub hook as Stack A and B                                                                                                                                                                                                  |
| Persistence                | `PostgreSQL` | `df_band_projection` persisted alongside Stack A/B data                                                                                                                                                                                    |

---

## 12. Warm-Up Behaviour: Pre-Boundary Bars and Period 0

Stack C has **two distinct warm-up levels** that affect different columns and span different numbers of rows. Both are non-computable conditions — they are not bugs but structural consequences of requiring prior H1 data to perform slope and regression calculations.

### 12.1 Warm-Up Level 1 — Pre-Boundary Bars (x_count = 0)

**Condition:** M5 data starts mid-H1-period (before the first H1 boundary timestamp in the M5 range).

These are the same leading bars described in Stack B Section 12. In Stack C's `compute_h1_period_slopes()`, the `x_count` array is initialised to `np.zeros(n_rows, dtype=int)`. The assignment loop only runs over M5 rows that have a matching H1 boundary timestamp. Any M5 bars that precede the first H1 boundary in the data range are never touched by the loop and remain at `x_count = 0`.

`x_count = 0` is the designated indicator for pre-boundary warm-up bars in Stack C. It is an intentional sentinel value, not a valid counter position.

| Column                                             | Value during Level 1 warm-up | Reason                                        |
| -------------------------------------------------- | ---------------------------- | --------------------------------------------- |
| `timestamp_forward`                                | Populated                    | Generated by `generate_forward_m5_timeline()` |
| `symbol_forward`, `timeframe_forward`              | Populated                    | Constants                                     |
| `close`                                            | Populated                    | Actual M5 close from Stack B                  |
| `ssa_m5_interpolation`, `ema_ssa_m5_interpolation` | Populated (bfill constant)   | Stack B bfill propagation                     |
| `ssa_high/low_m5_interpolation`                    | Populated (bfill constant)   | Same                                          |
| `ssa_emassa_m5_interpolation_diff`                 | Populated                    | Computable from bfill values                  |
| `ssa_m5_interpolation_trend`                       | Populated                    | Derived from diff                             |
| `ssa_m5_interpolation_trend_projection`            | Populated                    | Forward-fill                                  |
| `x_count_regression`                               | **0**                        | Sentinel — never assigned                     |
| `slope_12_ssa_high`, `slope_12_ssa_low`            | **NaN**                      | No H1 period assignment                       |
| `ssa_high/low_m5_regression`                       | **NaN**                      | Depends on slope                              |
| `ssa_high/low_m5_projection`                       | **NaN**                      | Depends on regression                         |

**Number of Level 1 rows:** 0 to 11. Zero when M5 data starts exactly at an H1 boundary (the ideal and reference-confirmed case). Maximum 11 when M5 starts at x_count = 12 of an H1 period.

**Reference dataset:** Zero Level 1 warm-up bars. M5 data begins at `1775127600` (x_count = 1), so the first M5 row immediately belongs to an H1 period.

### 12.2 Warm-Up Level 2 — Period 0 (x_count = 1..12, Slope Unavailable)

**Condition:** The first H1 period within the M5 data range. The starting H1 anchor for this period is known, but there is no **prior** H1 anchor to compute the slope (`slope = (H1[N] − H1[N-1]) / 12` requires H1[N-1]).

Period 0 always spans exactly **12 M5 bars** (or fewer if the M5 data starts partway into the first H1 period). x_count runs 1..12 normally. The interpolation values (AJ, AK, AO, AP) are fully populated because Stack B can interpolate the full period (both the start and end H1 anchors are within or near the M5 data range). However all slope-dependent columns are NaN.

| Column                                       | Value during Period 0 | Reason                                        |
| -------------------------------------------- | --------------------- | --------------------------------------------- |
| `timestamp_forward`                          | Populated             | Normal                                        |
| `close`                                      | Populated             | Actual M5 close                               |
| `ssa_m5_interpolation` (AJ)                  | **Populated**         | Stack B has both H1 endpoints for this period |
| `ema_ssa_m5_interpolation` (AK)              | **Populated**         | Same                                          |
| `ssa_high/low_m5_interpolation` (AO/AP)      | **Populated**         | Same                                          |
| `ssa_emassa_m5_interpolation_diff` (AL)      | **Populated**         | Computable from AJ/AK                         |
| `ssa_m5_interpolation_trend` (AM)            | **Populated**         | Derived from AL                               |
| `ssa_m5_interpolation_trend_projection` (AN) | **Populated**         | Forward-fill or computed                      |
| `x_count_regression` (AQ)                    | **1..12**             | Valid counter                                 |
| `slope_12_ssa_high` (AR)                     | **NaN**               | No prior H1 anchor                            |
| `slope_12_ssa_low` (AS)                      | **NaN**               | No prior H1 anchor                            |
| `ssa_high_m5_regression` (AT)                | **NaN**               | Depends on slope                              |
| `ssa_low_m5_regression` (AU)                 | **NaN**               | Depends on slope                              |
| `ssa_high_m5_projection` (AV)                | **NaN**               | Depends on regression                         |
| `ssa_low_m5_projection` (AW)                 | **NaN**               | Depends on regression                         |

**Reference dataset confirmation:** Rows 2–13 of `Mapped_H1_M5_Interporate` are the Period 0 rows. AR, AT, AV, AW are all `---` (NaN) for all 12 rows. Row 14 (x_count = 1, second H1 period) is the first row with fully computed slope, regression, and projection values (AR = 0.820761, AT = 4648.8933, AV = 4649.7140).

### 12.3 Total Warm-Up Depth and First Fully Computed Bar

| Warm-up level                     | Rows affected   | Columns fully NaN      |
| --------------------------------- | --------------- | ---------------------- |
| Level 1 (pre-boundary, x_count=0) | 0..11           | AR, AS, AT, AU, AV, AW |
| Level 2 (Period 0, x_count=1..12) | 12 (typically)  | AR, AS, AT, AU, AV, AW |
| **Total**                         | **12..23 rows** |                        |

The **first fully computed bar** (all 18 output columns populated) is the x_count=1 row of the **second H1 period** within the M5 data range. In the reference dataset this is row 14, timestamp `1775131200`.

Minimum H1 data requirement: **at least 2 H1 boundaries** must appear within or at the start of the M5 data range before any slope/regression/projection value can be produced.

### 12.4 Identifying Warm-Up Rows in Code

```python
def get_stack_c_warmup_info(
    df_band_projection: pd.DataFrame,
    interp_cfg: dict
) -> dict:
    """
    Returns warm-up diagnostics for the Stack C output DataFrame.

    Identifies:
        - level1_rows : number of pre-boundary bars (x_count == 0)
        - period0_rows: number of Period 0 bars (x_count >= 1, slope is NaN)
        - first_valid_row: index of first row with fully computed slope/regression/projection
        - total_warmup_rows: level1_rows + period0_rows

    Parameters:
        df_band_projection : Stack C output DataFrame.
        interp_cfg         : Symbol config dict (uses m5_bars_per_h1 for sanity check).

    Returns:
        dict with warm-up diagnostics.
    """
    xc    = df_band_projection['x_count_regression']
    slope = df_band_projection['slope_12_ssa_high']

    level1_mask   = (xc == 0)
    period0_mask  = (xc >= 1) & (slope.isna())
    valid_mask    = (xc >= 1) & (slope.notna())

    level1_rows   = int(level1_mask.sum())
    period0_rows  = int(period0_mask.sum())
    total_warmup  = level1_rows + period0_rows

    first_valid_idx = df_band_projection.index[valid_mask][0] if valid_mask.any() else None

    return {
        'level1_rows':      level1_rows,    # pre-boundary bars (x_count=0)
        'period0_rows':     period0_rows,   # Period 0: x_count 1..12, slope NaN
        'total_warmup_rows': total_warmup,
        'first_valid_row':  first_valid_idx,
    }
```

### 12.5 Recommendation for Claude Code

When implementing Stack C:

1. Call `get_stack_c_warmup_info()` once after each `run_band_projection_pipeline()` call. Log the result. Expected values for the reference dataset: `level1_rows=0`, `period0_rows=12`, `total_warmup_rows=12`, `first_valid_row=1775131200`.
2. **Level 1 rows** (`x_count = 0`) must not be passed to any regression or projection calculation. The current implementation already handles this — slope is NaN for these rows, so `compute_band_regression()` and `compute_asymmetric_band_projection()` skip them via the `np.isnan(slope_hi[k])` guard.
3. **Period 0 rows** (`x_count = 1..12`, slope NaN) contain valid trend signal columns (AL, AM, AN) and valid interpolated band values (AJ, AK, AO, AP). They are suitable for frontend display of the H1 SSA trend. However, the regression and projection columns (AT–AW) must not be plotted — they are NaN and the frontend chart library must treat them as gaps, not zero values.
4. **The `verify_stack_c_against_reference()` function** compares against the reference workbook which contains NaN for AR, AT, AV, AW in the Period 0 rows. The `.dropna()` call inside the verify function correctly skips these rows — only non-null reference values are compared. No special warm-up handling is needed in the verify function.
5. **Minimum data requirement:** Provide at least `2 × m5_bars_per_h1 + 1` M5 bars (25 bars for 12-bar H1 periods) before expecting any non-NaN slope output. In practice, the production M5 feed always carries hundreds of bars, so this constraint is rarely binding.

---

## 13. Core Architectural Principles for Stack C

| Principle                   | Implementation                                                                                                                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forward extension           | Stack C extends beyond bar 0 into the current H1 period's remaining M5 bars. This is Stack C's unique contribution vs Stack B (historical-only).                                                                                                                                                                 |
| Zero re-computation         | `df_h1` and `df_m5_aligned` are already in RAM from Stacks A and B. No second SSA or interpolation call.                                                                                                                                                                                                         |
| Vectorized performance      | `np.searchsorted` for H1 boundary lookup. `np.full` + single loop over H1 periods for slope assignment (not row-by-row).                                                                                                                                                                                         |
| Feature orthogonality       | Stack C produces band trajectory signals only. It does not modify BPI, RPI, or HMI values from Stack A.                                                                                                                                                                                                          |
| Conservative projection     | The Asymmetric Band Projection Rule prevents overstating favorable channel conditions. Upper bands project only when rising; lower bands project only when falling.                                                                                                                                              |
| Honest NaN semantics        | AJ, AK, AO, AP, AL, AM are NaN for rows where H1 interpolation cannot be completed (x_count > 1 of current period). These NaN values are intentional — they convey that full interpolation awaits the next H1 anchor. AN forward-fills over these NaN values to ensure the trend projection is always available. |
| RAM-first                   | All regression and projection math in NumPy arrays. Only final DataFrame hits PostgreSQL.                                                                                                                                                                                                                        |
| Zero hardcoded constants    | `m5_bars_per_h1` lives in `interp_h1m5` config and governs both slope divisor and future bar count.                                                                                                                                                                                                              |
| Hot-reloadable              | Config invalidated via same Redis Pub/Sub hook as Stack A and B.                                                                                                                                                                                                                                                 |
| Verifiable reference output | `ALGLIB_SSA_XAUUSD_timeframemapping.xlsx` columns AF–AW serve as the numerical acceptance test fixture. `verify_stack_c_against_reference()` must pass for all rows — both historical and future.                                                                                                                |
