# DavinTrade Backend Architecture: MT5 to Pandas Trendline Scoring Engine

### Version 2.2 — Updated Blueprint for Claude Code Implementation

---

## Revision Notes (v1 → v2)

| #   | Change                                                                                       | Type          |
| --- | -------------------------------------------------------------------------------------------- | ------------- |
| 1   | SSA and entropy computation moved entirely to Python (NumPy) — Option B                      | Architecture  |
| 2   | `ssa-export.mq5` decommissioned — `run_ssa_pipeline()` consumes OHLC from `ohlcv-export.mq5` | Data Source   |
| 3   | `get_adaptive_ssa_window()` added to BPI pipeline — entropy-driven dynamic SSA window        | New Function  |
| 4   | Entropy → window chain documented explicitly                                                 | Clarification |
| 5   | Phase 4.0 Pre-Processing section added with full NumPy SSA + entropy code                    | New Section   |
| 6   | `execute_bpi_pipeline()` updated with SSA pre-processing insertion point                     | Code Update   |
| 7   | Phase 6 config schema extended with `ssa_entropy` block                                      | Config Update |
| 8   | OHLC vs fractal map column disambiguation added                                              | Clarification |

## Revision Notes (v2 → v2.1)

| #   | Change                                                                                                                                                | Type          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 9   | `compute_shannon_entropy()` rewritten to match `Entropy_IT.mq5` exactly — 3-state categorical (up/down/flat) replacing log-returns histogram approach | Critical Fix  |
| 10  | Phase 6 config schema: `entropy_bins` removed, `price_step_points` + `point_size` added to `ssa_entropy` block                                        | Config Fix    |
| 11  | `run_ssa_pipeline()` updated — removed `bins=` parameter, added `price_step_points` and `point_size`                                                  | Code Fix      |
| 12  | Section 10 library notes updated — entropy now uses `math.log2` not `np.histogram`                                                                    | Documentation |

> **Why this fix matters:** The original `compute_shannon_entropy()` used log-returns + 10-bin histogram, producing numerically different entropy values than `Entropy_IT.mq5`. The regime thresholds 0.35 and 0.65 were calibrated for the MQL5 3-state system. Using a different algorithm would cause Python to classify the same market bar differently than what the trader sees on their MT5 chart — directly undermining platform trust.

## Revision Notes (v2.1 → v2.2)

| #   | Change                                                                                                                  | Type          |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------- |
| 13  | Phase 5.1 added — HMI (Heat Map Index) pipeline: `calculate_hmi_m5()` + `execute_hmi_pipeline()`                        | New Index     |
| 14  | Phase 6 config schema: `hmi_structural` block added to XAUUSD and DEFAULT                                               | Config        |
| 15  | Section 9 unified API payload extended: `active_hmi`, `active_hmi_type`, `upper_sandwich_price`, `lower_sandwich_price` | API           |
| 16  | Section 11 Core Principles updated to reflect HMI orthogonality                                                         | Documentation |

> **HMI rationale:** HMI = Base structural power only (no proximity decay). RPI = same base power × Gaussian proximity decay. The two together give traders a complete picture: HMI tells you how strong the wall is regardless of distance; RPI tells you how relevant that strength is right now.

| #   | Change                                                                                                                                                | Type          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 9   | `compute_shannon_entropy()` rewritten to match `Entropy_IT.mq5` exactly — 3-state categorical (up/down/flat) replacing log-returns histogram approach | Critical Fix  |
| 10  | Phase 6 config schema: `entropy_bins` removed, `price_step_points` + `point_size` added to `ssa_entropy` block                                        | Config Fix    |
| 11  | `run_ssa_pipeline()` updated — removed `bins=` parameter, added `price_step_points` and `point_size`                                                  | Code Fix      |
| 12  | Section 10 library notes updated — entropy now uses `math.log2` not `np.histogram`                                                                    | Documentation |

> **Why this fix matters:** The original `compute_shannon_entropy()` used log-returns + 10-bin histogram, producing numerically different entropy values than `Entropy_IT.mq5`. The regime thresholds 0.35 and 0.65 were calibrated for the MQL5 3-state system. Using a different algorithm would cause Python to classify the same market bar differently than what the trader sees on their MT5 chart — directly undermining platform trust.

---

## MT5 Export Files Reference

| MQL5 File                                                  | Role                                                      | Export Columns                                                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ohlcv-export.mq5`                                         | Primary OHLCV data source                                 | `timestamp`, `symbol`, `timeframe`, `close`, `open`, `high`, `low`, `volume`                                                             |
| `fractal-horizontal-trendline-export-window-period-v3.mq5` | Trendline S&R data source                                 | `timestamp`, `symbol`, `timeframe`, `close`, `horiz_peak_line_1_w1..w3`, `horiz_bottom_line_1_w1..w3`, `horiz_high_map`, `horiz_low_map` |
| `ssa-export.mq5`                                           | **DECOMMISSIONED** — SSA now computed in Python via NumPy | N/A                                                                                                                                      |

> **Column Disambiguation:** `high`/`low` from `ohlcv-export.mq5` are raw OHLC candle prices fed into SSA computation. `horiz_high_map`/`horiz_low_map` from the fractal export are fractal marker prices fed into the Gaussian Proximity Scoring engine. These are separate columns from separate files and must not be confused.

---

## 1. System Overview

This document outlines the architecture for a Python (Pandas) backend designed to process algorithmic trendline and OHLCV data exported from MetaTrader 5 (MT5). The system ingests multi-timeframe (MTF), multi-window trendline data alongside OHLCV data, normalizes the time-series, and applies advanced structural density scoring to filter for high-probability Support and Resistance (S&R) nodes. The final output is a clean JSON payload for visualization in Next.js via Apache ECharts.

**Input Data Sources:**

- **OHLCV Source:** Tab-separated values from `ohlcv-export.mq5` (.txt). Timeframes: M5, M15, M30, H1, H2, H3, H4, H6, H8, H12, D1.
- **Trendline Source:** Tab-separated values from `fractal-horizontal-trendline-export-window-period-v3.mq5` (.txt). Columns: `timestamp`, `symbol`, `timeframe`, `close`, `horiz_peak_line_1_w1`, `horiz_bottom_line_1_w1` (repeated for w2, w3), `horiz_high_map`, `horiz_low_map`.

---

## 2. Phase 1: Data Ingestion & Time-Series Alignment

Because the MT5 exports consist of multiple timeframes, the data frequencies will not match (e.g., 12 data points in an H1 file for every 1 point in an H12 file).

- **Step 1.1 — Base DataFrame Creation:** Initialize a master Pandas DataFrame using the lowest timeframe (M5) timestamps as the primary `DatetimeIndex`.
- **Step 1.2 — HTF Merging:** Merge Higher Timeframe (HTF) data (M15 through H12) into the M5 master DataFrame using a left join on the timestamp.
- **Step 1.3 — Slope-Preserving Interpolation:** Missing HTF trendline values (NaNs resulting from the merge) must not be forward-filled (`ffill`), as this creates stair-step artifacts. Instead, use time-based linear interpolation to preserve the exact geometric slope of the HTF trendline on the M5 grid.

```python
import pandas as pd
import numpy as np

def merge_and_align_timeframes(df_base_m5, df_htf, suffix):
    """
    Merges a higher timeframe dataframe into the base M5 timeframe.
    Assumes indices are properly formatted Pandas DatetimeIndex.
    """
    # Left join the HTF data onto the M5 timeline
    df_merged = df_base_m5.join(df_htf.add_suffix(f'_{suffix}'), how='left')

    # Isolate the trendline columns that need slope-interpolation
    trendline_cols = [col for col in df_merged.columns if 'line' in col]

    # Interpolate using time to preserve exact geometric slopes between HTF anchors
    df_merged[trendline_cols] = df_merged[trendline_cols].interpolate(method='time')

    return df_merged
```

> **Implementation Directive:** `df_htf_line.interpolate(method='time', inplace=True)`

---

## 3. Phase 2: The Density & Scoring Engine

Once all timeframes are aligned on the M5 grid, the backend must calculate a composite "Structural Gravity Score" for every active trendline. This score is derived from three independent modules.

### Module 2.1: Horizontal Price Density Validation (Volume/Time Profile)

This module scores a trendline based on how much historical price action occurred at its current price level.

- **Mechanism:** Extract the `close` prices from the master DataFrame. Use `pd.cut()` to divide the entire historical price range into 50–100 horizontal bins.
- **Calculation:** Count the frequency of close prices in each bin to create a density profile.
- **Scoring:** For any given trendline at time `t`, identify which price bin its current value falls into. Assign a `Price_Density_Multiplier` (1.0 to 2.0) based on the relative heat/density of that specific bin.

```python
def get_price_density_multiplier(close_prices, target_line_price, num_bins=50):
    """
    Scores a trendline based on the density of historical close prices.
    close_prices: Pandas Series of historical close prices in the window
    target_line_price: Float of the trendline's current active price
    """
    valid_closes = close_prices.dropna().values
    hist, bin_edges = np.histogram(valid_closes, bins=num_bins)

    avg_density = np.mean(hist)
    if avg_density == 0:
        return 1.0

    bin_idx = np.digitize(target_line_price, bin_edges) - 1
    bin_idx = np.clip(bin_idx, 0, num_bins - 1)

    density_ratio = hist[bin_idx] / avg_density
    multiplier = 1.0 + min(0.5, density_ratio * 0.1)
    return multiplier
```

### Module 2.2: Gaussian Proximity Scoring (Fractal Heatmap)

This module calculates how closely a trendline aligns with raw market fractals (`horiz_high_map` and `horiz_low_map` from the fractal export), rewarding near-misses using a Gaussian distribution rather than a hard pass/fail cutoff.

- **Mechanism:** Extract all non-null values from `horiz_high_map` (for peak lines) and `horiz_low_map` (for bottom lines) across the lookback window.
- **Calculation:** For a given trendline, calculate the absolute vertical price distance ΔP between the trendline and every known fractal in the window.
- **Formula:** `W = e^(−ΔP² / 2σ²)` where σ is the dynamic tolerance (typically derived from a rolling ATR or a fixed percentage like 0.1%).
- **Scoring:** Sum the Gaussian weights of all fractals within the 3σ range. This outputs the `Gaussian_Touch_Score`.

```python
def calculate_gaussian_score(fractal_array, trendline_array, sigma):
    """
    Calculates the Gaussian heatmap score for a trendline.
    fractal_array: Pandas Series of horiz_high_map (contains NaNs where no fractal exists)
    trendline_array: Pandas Series of the trendline's prices over the same window
    sigma: Float representing the tolerance (e.g., derived from ATR)
    """
    valid_mask = fractal_array.notna()

    if not valid_mask.any():
        return 0.0

    delta_p = np.abs(trendline_array[valid_mask] - fractal_array[valid_mask])
    weights = np.exp(-(delta_p**2) / (2 * sigma**2))
    weights = np.where(delta_p <= (3 * sigma), weights, 0.0)

    return np.sum(weights)
```

### Module 2.3: Candidate Line Clustering (Cross-Timeframe Confluence)

This is the most critical module. It identifies "Confluence Nodes" where multiple lines from different timeframes and windows map to the exact same price and trajectory.

- **Mechanism:** At the current active bar, capture the active price and slope of all available lines (e.g., `M15_W1_Peak`, `H4_W3_Peak`, etc.).
- **Calculation:** Group lines that fall within a defined `Price_Proximity_Threshold` (e.g., 0.05% of the current price) AND a `Slope_Proximity_Threshold`.
- **Scoring:** Assign a base weight to each timeframe (e.g., H12 carries a 5x multiplier compared to M5). If a cluster contains lines from 3 or more distinct timeframes, apply a massive `Confluence_Multiplier`.

---

## 4. Phase 3: Aggregation and Output Formatting

### Step 3.1 — Composite Score Calculation

```
Final_Score = Gaussian_Touch_Score × Price_Density_Multiplier × Confluence_Multiplier
```

### Step 3.2 — Hybrid Threshold Filtering

Claude must implement a **Hybrid Thresholding Approach** using Pandas:

1. **Absolute Floor:** Filter out any trendlines where `Final_Score < absolute_minimum_score` (default 5.0). This prevents plotting "the best of the worst" in highly chaotic, unstructured markets.
2. **Relative Percentile:** On the remaining lines, use `pd.Series.quantile(0.90)` to find the 90th percentile score.
3. **The Final Cut:** Filter the DataFrame to only keep rows where `Final_Score >= percentile_threshold`.
4. **Sort:** Sort the final DataFrame by `Final_Score` descending so the strongest confluences are processed first.

```python
def filter_golden_trendlines(df_lines, absolute_min=5.0, percentile=0.90):
    """
    Filters the scored trendlines using a hybrid absolute/relative methodology.
    df_lines: Pandas DataFrame containing a 'Final_Score' column.
    """
    df_passed_floor = df_lines[df_lines['Final_Score'] >= absolute_min].copy()

    if df_passed_floor.empty:
        return df_passed_floor

    dynamic_threshold = df_passed_floor['Final_Score'].quantile(percentile)
    df_golden = df_passed_floor[df_passed_floor['Final_Score'] >= dynamic_threshold]
    df_golden = df_golden.sort_values(by='Final_Score', ascending=False).reset_index(drop=True)

    return df_golden
```

### Step 3.3 — JSON Serialization for ECharts

Convert surviving trendlines into an array of objects structured for Apache ECharts.

**Trendline schema:**

```json
{
  "id": "M15_W2_Peak",
  "coordinates": [[start_unix_timestamp, start_price], [end_unix_timestamp, end_price]],
  "lineStyle": { "color": "#FF0000", "type": "solid", "width": 2 }
}
```

**Confluence node marker schema:**

```json
{
  "coord": [unix_timestamp, price],
  "symbol": "diamond",
  "itemStyle": { "color": "#FFD700" }
}
```

### Data Flow Summary

```
Phase 1 (RAM): Pandas merges and interpolates the timeframes. Data stays in Python memory.
Phase 2 (RAM): Pandas runs Gaussian math, Density scoring, and Confluence clustering. Filters out the weakest 90%.
Export to DB:  Pandas persists the surviving "Golden" nodes to PostgreSQL and Redis only.
```

---

## 5. Phase 4.0: SSA & Entropy Pre-Processing (NumPy Pipeline)

> **Architecture Decision (v2):** `ssa-export.mq5` is decommissioned. All SSA and entropy computation is performed natively in Python using NumPy. `run_ssa_pipeline()` consumes OHLC columns (`open`, `high`, `low`, `close`) directly from the `ohlcv-export.mq5` export file.
>
> **Rationale:** This allows the Phase 6 ML optimization layer to tune SSA parameters (window, rank, entropy thresholds) dynamically per symbol via the SaaS config schema, without requiring MQL5 recompilation or redeployment.

### Entropy → SSA Adaptive Window Chain

```
close prices (ohlcv-export.mq5)
  → compute_shannon_entropy()       [produces rolling entropy value per bar]
  → get_adaptive_ssa_window()       [maps entropy to optimal SSA window L]
  → compute_ssa(L=adaptive)         [SVD-based reconstruction with adaptive window]
  → compute_ema(ssa_trend)          [signal line, equivalent to MQL5 SSASignalPeriod]
```

### Full NumPy Implementation

```python
import numpy as np
import pandas as pd

# ============================================================
# 1. SSA — mirrors ALGLIB CSSAModel (SVD method)
#    Equivalent to MQL5 SSAWindow + SSARank parameters
# ============================================================
def compute_ssa(series: np.ndarray, L: int, n_components: int) -> np.ndarray:
    """
    Singular Spectrum Analysis reconstruction.
    Exact algorithmic equivalent of ALGLIB SSACreate + SSAAddSequence (Hankel/SVD method).

    Parameters:
        series      : 1D numpy array of prices (close, high, or low)
        L           : Embedding window (was SSAWindow=30 in ssa-export.mq5)
        n_components: Singular vectors to keep (was SSARank=6 in ssa-export.mq5)

    Returns:
        Reconstructed trend as 1D numpy array (same length as input series)
    """
    N = len(series)
    K = N - L + 1  # number of columns in trajectory matrix

    # Step 1: Build Hankel trajectory matrix (L x K)
    trajectory = np.array([series[i:i + L] for i in range(K)]).T

    # Step 2: SVD decomposition — mirrors ALGLIB's internal SVD call
    U, sigma, Vt = np.linalg.svd(trajectory, full_matrices=False)

    # Step 3: Reconstruct using top-K singular components only
    reconstructed_matrix = np.zeros_like(trajectory)
    for i in range(min(n_components, len(sigma))):
        reconstructed_matrix += sigma[i] * np.outer(U[:, i], Vt[i, :])

    # Step 4: Diagonal averaging (Hankelization) back to 1D time series
    trend = np.zeros(N)
    count = np.zeros(N)
    for i in range(L):
        for j in range(K):
            trend[i + j] += reconstructed_matrix[i, j]
            count[i + j] += 1
    trend /= count

    return trend


# ============================================================
# 2. EMA Signal — mirrors SSASignalPeriod=3 in ssa-export.mq5
# ============================================================
def compute_ema(series: np.ndarray, period: int) -> np.ndarray:
    """EMA applied to SSA trend output."""
    alpha = 2.0 / (period + 1)
    ema = np.zeros_like(series)
    ema[0] = series[0]
    for i in range(1, len(series)):
        ema[i] = alpha * series[i] + (1 - alpha) * ema[i - 1]
    return ema


# ============================================================
# 3. Shannon Entropy — exact Python equivalent of Entropy_IT.mq5
#
# CRITICAL IMPLEMENTATION NOTE:
# This function mirrors CalculateEntropy() + ClassifyPriceMovement()
# in Entropy_IT.mq5 exactly. It uses the same 3-state categorical
# classification (up/down/flat), same log base 2, and same log2(3)
# normalizer. This ensures Python regime classifications (Trend /
# Transition / Chaotic) are numerically consistent with what
# Entropy_IT.mq5 displays on the trader's MT5 chart.
#
# Do NOT replace with log-returns + histogram approach — that
# produces different numeric values, making the 0.35 / 0.65
# regime thresholds (calibrated for 3-state system) invalid.
# ============================================================
def compute_shannon_entropy(
    close: np.ndarray,
    window: int = 50,
    price_step_points: float = 0.01,
    point_size: float = 0.01,
) -> np.ndarray:
    """
    Rolling Shannon entropy using 3-state price direction classification.
    Exact algorithmic equivalent of Entropy_IT.mq5 CalculateEntropy().

    Interpretation (matches Entropy_IT.mq5 regime labels exactly):
        < 0.35  = TREND MODE      (structured directional movement)
        0.35–0.65 = TRANSITION MODE (mixed / transitioning)
        > 0.65  = CHAOTIC MODE    (random, no directional dominance)

    Parameters:
        close             : 1D numpy array of close prices
        window            : Rolling lookback bars — EntropyPeriod in MQL5 (default 50)
        price_step_points : Minimum price change to classify as a move.
                            Equivalent to PriceStep * _Point in MQL5.
                            Default: 1 * 0.01 = 0.01 (1 point for XAUUSD)
        point_size        : _Point equivalent for the symbol (0.01 for XAUUSD)

    Returns:
        1D numpy array of normalized entropy values in [0, 1].
        NaN for warmup bars (index < window).
    """
    import math

    threshold = price_step_points  # mirrors: double threshold = PriceStep * _Point
    N = len(close)
    entropy_series = np.full(N, np.nan)

    # Classify each bar into 3 states — mirrors ClassifyPriceMovement() in MQL5
    # states: 1 = up, 2 = down, 0 = flat
    states = np.zeros(N, dtype=int)
    diff = np.diff(close)
    states[1:] = np.where(diff > threshold, 1,
                 np.where(diff < -threshold, 2, 0))

    log2_3 = math.log2(3)  # max entropy for 3-state system — normalizer in MQL5

    for i in range(window, N):
        window_states = states[i - window:i]

        p_up   = np.sum(window_states == 1) / window
        p_down = np.sum(window_states == 2) / window
        p_flat = np.sum(window_states == 0) / window

        # Shannon entropy in bits — mirrors MQL5: entropy -= p * MathLog(p) / M_LN2
        H = 0.0
        for p in (p_up, p_down, p_flat):
            if p > 0:
                H -= p * math.log2(p)

        # Normalize by log2(3) — mirrors MQL5: return entropy / (MathLog(3) / M_LN2)
        entropy_series[i] = H / log2_3

    return entropy_series


# ============================================================
# 4. Adaptive SSA Window — driven by entropy regime
# ============================================================
def get_adaptive_ssa_window(regime_entropy: float,
                             trend_threshold: float = 0.35,
                             chaotic_threshold: float = 0.65,
                             window_trend: int = 40,
                             window_transition: int = 20,
                             window_chaotic: int = 10) -> int:
    """
    Maps current entropy regime to optimal SSA embedding window.

    Low entropy  = structured trend  = longer window (catch sustained crawl)
    High entropy = chaotic           = shorter window (react faster, less noise)

    Thresholds and window values are configurable per symbol via Phase 6 config schema.
    """
    if regime_entropy < trend_threshold:
        return window_trend        # Trend regime
    elif regime_entropy < chaotic_threshold:
        return window_transition   # Transition regime
    else:
        return window_chaotic      # Chaotic regime


# ============================================================
# 5. Master SSA Pipeline — replaces ssa-export.mq5 entirely
#    Consumes OHLC from ohlcv-export.mq5
# ============================================================
def run_ssa_pipeline(df: pd.DataFrame, ssa_cfg: dict) -> pd.DataFrame:
    """
    Full SSA pipeline producing columns equivalent to the decommissioned ssa-export.mq5:
        ssa | ema_ssa | ssa_high | ssa_low | entropy

    Now adaptive: SSA window is driven by entropy, not a hardcoded constant.

    Parameters:
        df      : DataFrame with columns [close, open, high, low] from ohlcv-export.mq5
        ssa_cfg : Symbol-specific config dict from Phase 6 schema (ssa_entropy block)

    Returns:
        df with added columns: ssa, ema_ssa, ssa_high, ssa_low, entropy
    """
    close  = df['close'].values
    high   = df['high'].values
    low    = df['low'].values

    # 1. Compute rolling entropy to classify current regime
    # Uses 3-state MQL5-matching algorithm — see compute_shannon_entropy() notes
    entropy_series = compute_shannon_entropy(
        close,
        window=ssa_cfg.get('entropy_window', 50),
        price_step_points=ssa_cfg.get('price_step_points', 0.01),
        point_size=ssa_cfg.get('point_size', 0.01),
    )

    # 2. Select adaptive SSA window from latest non-NaN entropy value
    current_entropy = entropy_series[~np.isnan(entropy_series)][-1] if not np.all(np.isnan(entropy_series)) else 0.5
    L = get_adaptive_ssa_window(
        regime_entropy=current_entropy,
        trend_threshold=ssa_cfg.get('entropy_trend_threshold', 0.35),
        chaotic_threshold=ssa_cfg.get('entropy_chaotic_threshold', 0.65),
        window_trend=ssa_cfg.get('ssa_window_trend', 40),
        window_transition=ssa_cfg.get('ssa_window_transition', 20),
        window_chaotic=ssa_cfg.get('ssa_window_chaotic', 10)
    )

    n_components   = ssa_cfg.get('ssa_rank', 6)
    signal_period  = ssa_cfg.get('ssa_signal_period', 3)

    # 3. SSA on close, high, low — mirrors three separate SSA models in MQL5
    ssa_close = compute_ssa(close, L=L, n_components=n_components)
    ssa_high  = compute_ssa(high,  L=L, n_components=n_components)
    ssa_low   = compute_ssa(low,   L=L, n_components=n_components)

    # 4. EMA signal line on SSA close
    ema_ssa = compute_ema(ssa_close, period=signal_period)

    df = df.copy()
    df['ssa']      = ssa_close
    df['ema_ssa']  = ema_ssa
    df['ssa_high'] = ssa_high
    df['ssa_low']  = ssa_low
    df['entropy']  = entropy_series

    return df
```

### Output Column Mapping

| Decommissioned `ssa-export.mq5` Column | Python Equivalent                  | Source                   |
| -------------------------------------- | ---------------------------------- | ------------------------ |
| `ssa`                                  | `compute_ssa(close, L, rank)`      | `ohlcv-export.mq5` close |
| `ema_ssa`                              | `compute_ema(ssa_close, period=3)` | derived from ssa         |
| `ssa_high`                             | `compute_ssa(high, L, rank)`       | `ohlcv-export.mq5` high  |
| `ssa_low`                              | `compute_ssa(low, L, rank)`        | `ohlcv-export.mq5` low   |
| _(new)_ `entropy`                      | `compute_shannon_entropy(close)`   | feeds adaptive window    |

---

## 6. Phase 4: Breakout Probability Index (BPI) — Master Execution Pipeline

**System Overview:** The backend calculates a live Breakout Probability Index (0–100%). This index acts as a kinetic energy gauge measuring the probability of structural failure at the closest validated Support or Resistance boundary.

This model is fully Omnidirectional and Role Agnostic. It dynamically identifies active ceilings and floors based strictly on their relation to the current price, handling Support/Resistance polarity flips (Counter Positions). The pipeline detects price "crawling" (order absorption) using SSA and EMA-SSA crossovers on M5 (now computed via `run_ssa_pipeline()`), confirmed by a decoupled macro Higher Timeframe (M15) trend analysis.

> **v2 Integration Point:** `run_ssa_pipeline()` is called as **Step 0** inside `execute_bpi_pipeline()` before any BPI calculation begins. The M15 SSA is computed natively on the M15 DataFrame to prevent data leakage, then forward-filled onto the M5 grid.

```python
import pandas as pd
import numpy as np

def prepare_dynamic_targets(df_m5, valid_line_cols):
    """
    Handles Price-Relative Targeting and Counter Position (Role Reversal).
    Dynamically sorts all density-filtered S&R lines into Active Resistance
    or Active Support based strictly on their relation to the current close price.
    """
    df_lines = df_m5[valid_line_cols]

    # Active Resistance: closest validated line strictly ABOVE current close
    resistances = df_lines[df_lines > df_m5[['close']].values]
    closest_res = resistances.min(axis=1)

    # Active Support: closest validated line strictly BELOW current close
    supports = df_lines[df_lines < df_m5[['close']].values]
    closest_sup = supports.max(axis=1)

    return closest_res, closest_sup


def calculate_m15_trend_multipliers(df_m15, lookback_bars=96,
                                     strong_threshold=0.70,
                                     weak_threshold=0.30,
                                     strong_multiplier=1.5,
                                     weak_multiplier=0.5):
    """
    Calculates HTF trend multipliers strictly on the native M15 DataFrame.
    lookback_bars=96 represents a full 24-hour macro cycle.
    Must be called on the M15 DataFrame BEFORE forward-filling to M5.
    """
    is_bullish = df_m15['ssa'] > df_m15['ema_ssa']
    is_bearish = df_m15['ssa'] < df_m15['ema_ssa']

    bull_ratio = is_bullish.rolling(window=lookback_bars).mean()
    bear_ratio = is_bearish.rolling(window=lookback_bars).mean()

    bull_mult = np.where(bull_ratio >= strong_threshold, strong_multiplier,
                np.where(bull_ratio <= weak_threshold, weak_multiplier, 1.0))
    bear_mult = np.where(bear_ratio >= strong_threshold, strong_multiplier,
                np.where(bear_ratio <= weak_threshold, weak_multiplier, 1.0))

    return pd.DataFrame({
        'htf_bull_mult': bull_mult,
        'htf_bear_mult': bear_mult
    }, index=df_m15.index)


def calculate_bpi_m5(df_m5, htf_multipliers, closest_res, closest_sup,
                      proximity_threshold=0.0015, crawl_window=20,
                      crawl_max_score_crosses=2.0, ignition_bonus=1.2):
    """
    Calculates bidirectional BPI on the M5 grid using dynamic targets,
    applies order absorption and ignition logic, and executes Sandwich Selection.
    """
    # Merge HTF multipliers via forward-fill to map M15 macro trends to M5 bars
    df_m5 = df_m5.join(htf_multipliers, how='left').ffill()
    df_m5['htf_bull_mult'] = df_m5['htf_bull_mult'].fillna(1.0)
    df_m5['htf_bear_mult'] = df_m5['htf_bear_mult'].fillna(1.0)

    ssa_above   = df_m5['ssa'] > df_m5['ema_ssa']
    ssa_below   = df_m5['ssa'] < df_m5['ema_ssa']
    cross_event = df_m5['ssa'] != df_m5['ssa'].shift(1)

    dist_res = np.abs(closest_res - df_m5['close']) / df_m5['close']
    dist_sup = np.abs(df_m5['close'] - closest_sup) / df_m5['close']

    # --- SCENARIO A: BULLISH BREAKOUT (RESISTANCE) ---
    near_res            = dist_res <= proximity_threshold
    valid_crosses_bull  = cross_event & near_res
    cross_count_bull    = valid_crosses_bull.rolling(window=crawl_window).sum()
    base_crawl_bull     = np.clip(cross_count_bull / crawl_max_score_crosses, 0, 1.0) * 100.0
    ignite_bull         = ssa_above & (~ssa_above.shift(1).fillna(False))
    bonus_bull          = np.where(ignite_bull & near_res, ignition_bonus, 1.0)
    bpi_bullish         = base_crawl_bull * df_m5['htf_bull_mult'] * bonus_bull

    # --- SCENARIO B: BEARISH BREAKDOWN (SUPPORT) ---
    near_sup            = dist_sup <= proximity_threshold
    valid_crosses_bear  = cross_event & near_sup
    cross_count_bear    = valid_crosses_bear.rolling(window=crawl_window).sum()
    base_crawl_bear     = np.clip(cross_count_bear / crawl_max_score_crosses, 0, 1.0) * 100.0
    ignite_bear         = ssa_below & (~ssa_below.shift(1).fillna(False))
    bonus_bear          = np.where(ignite_bear & near_sup, ignition_bonus, 1.0)
    bpi_bearish         = base_crawl_bear * df_m5['htf_bear_mult'] * bonus_bear

    # --- SANDWICH SELECTION ---
    is_res_closer      = dist_res < dist_sup
    reported_bpi       = np.where(is_res_closer, bpi_bullish, bpi_bearish)
    reported_bpi_type  = np.where(is_res_closer, 'Resistance Breakout', 'Support Breakdown')

    return pd.DataFrame({
        'active_bpi':      np.clip(reported_bpi, 0, 99.9),
        'active_bpi_type': reported_bpi_type
    }, index=df_m5.index)


def execute_bpi_pipeline(df_m5, df_m15, valid_line_cols, symbol_config):
    """
    Master execution function for the complete BPI pipeline.
    Uses dynamic configs from Phase 6 schema.
    """
    bpi_cfg = symbol_config['bpi_kinetic']
    ssa_cfg = symbol_config['ssa_entropy']

    # Step 0 (v2 NEW): Compute adaptive SSA on both M5 and M15 before BPI calculation.
    # M15 SSA is computed NATIVELY on the M15 DataFrame to prevent data leakage,
    # then forward-filled onto M5 inside calculate_bpi_m5().
    df_m5  = run_ssa_pipeline(df_m5, ssa_cfg)
    df_m15 = run_ssa_pipeline(df_m15, ssa_cfg)

    # Step 1: Dynamic target identification
    closest_res, closest_sup = prepare_dynamic_targets(df_m5, valid_line_cols)

    # Step 2: Native HTF macro trend validation (on M15, before ffill)
    htf_multipliers = calculate_m15_trend_multipliers(
        df_m15,
        lookback_bars=bpi_cfg['htf_macro_lookback_bars'],
        strong_threshold=bpi_cfg['htf_strong_threshold'],
        weak_threshold=bpi_cfg['htf_weak_threshold'],
        strong_multiplier=bpi_cfg['htf_strong_multiplier'],
        weak_multiplier=bpi_cfg['htf_weak_multiplier']
    )

    # Step 3: Final omnidirectional BPI with Sandwich Selection
    bpi_df = calculate_bpi_m5(
        df_m5,
        htf_multipliers,
        closest_res,
        closest_sup,
        proximity_threshold=bpi_cfg['ltf_proximity_threshold'],
        crawl_window=bpi_cfg['ltf_crawl_window'],
        crawl_max_score_crosses=bpi_cfg['ltf_crawl_max_score_crosses'],
        ignition_bonus=bpi_cfg['ltf_ignition_bonus']
    )

    return bpi_df
```

---

## 7. Phase 5: Reversal Probability Index (RPI) — Master Execution Pipeline

**System Overview:** The backend calculates a live Reversal Probability Index (0–100%). This index acts as a "Structural Density Gauge," measuring the probability that the closest validated S&R boundary will cause a price bounce.

**Feature Orthogonality:** The RPI must be strictly decoupled from BPI. The RPI must not include any SSA, EMA-SSA, or HTF trend multiplier data. It is a purely spatial and structural measurement derived from the `Final_Score` of the trendline confluence and its real-time Gaussian proximity to current price.

```python
def extract_dynamic_targets_with_scores(df_m5, line_price_cols, line_score_cols):
    """
    Identifies closest Resistance (above) and Support (below),
    and extracts their associated Final_Scores for structural power calculation.
    """
    df_prices    = df_m5[line_price_cols]
    df_scores    = df_m5[line_score_cols]
    close_prices = df_m5[['close']].values

    # Active Resistance
    res_mask           = df_prices > close_prices
    resistances        = df_prices.where(res_mask)
    closest_res_idx    = resistances.idxmin(axis=1)
    closest_res_price  = resistances.min(axis=1)
    res_score_cols     = closest_res_idx.apply(
        lambda col: str(col).replace('line', 'score') if pd.notna(col) else np.nan
    )
    closest_res_score  = df_scores.lookup(df_m5.index, res_score_cols).fillna(0) \
                         if not res_score_cols.isna().all() else pd.Series(0, index=df_m5.index)

    # Active Support
    sup_mask           = df_prices < close_prices
    supports           = df_prices.where(sup_mask)
    closest_sup_idx    = supports.idxmax(axis=1)
    closest_sup_price  = supports.max(axis=1)
    sup_score_cols     = closest_sup_idx.apply(
        lambda col: str(col).replace('line', 'score') if pd.notna(col) else np.nan
    )
    closest_sup_score  = df_scores.lookup(df_m5.index, sup_score_cols).fillna(0) \
                         if not sup_score_cols.isna().all() else pd.Series(0, index=df_m5.index)

    return closest_res_price, closest_res_score, closest_sup_price, closest_sup_score


def calculate_universal_rpi_m5(df_m5, res_price, res_score, sup_price, sup_score,
                                 global_max_score, sigma_pct=0.001):
    """
    Calculates pure structural RPI on the M5 grid, completely independent of
    momentum/trend, and executes Sandwich Selection.
    """
    if global_max_score <= 0:
        global_max_score = 1.0

    # Base Power (0-100%): Derived purely from historical geometric density
    power_res = np.clip((res_score / global_max_score), 0, 1.0) * 100.0
    power_sup = np.clip((sup_score / global_max_score), 0, 1.0) * 100.0

    dist_res  = np.abs(res_price - df_m5['close'])
    dist_sup  = np.abs(df_m5['close'] - sup_price)

    # Gaussian Proximity Decay
    sigma = df_m5['close'] * sigma_pct
    w_res = np.exp(-(dist_res**2) / (2 * sigma**2))
    w_sup = np.exp(-(dist_sup**2) / (2 * sigma**2))

    rpi_resistance = power_res * w_res
    rpi_support    = power_sup * w_sup

    # Sandwich Selection
    is_res_closer     = dist_res < dist_sup
    reported_rpi      = np.where(is_res_closer, rpi_resistance, rpi_support)
    reported_dist     = np.where(is_res_closer, dist_res, dist_sup)
    reported_rpi_type = np.where(is_res_closer, 'Resistance', 'Support')

    return pd.DataFrame({
        'active_rpi':          np.clip(reported_rpi, 0, 99.9),
        'active_rpi_type':     reported_rpi_type,
        'distance_to_active':  reported_dist
    }, index=df_m5.index)


def execute_rpi_pipeline(df_m5, line_price_cols, line_score_cols, global_max_score, symbol_config):
    """
    Master execution function for the complete Pure Structural RPI pipeline.
    """
    rpi_cfg = symbol_config['rpi_structural']

    res_price, res_score, sup_price, sup_score = extract_dynamic_targets_with_scores(
        df_m5, line_price_cols, line_score_cols
    )

    rpi_df = calculate_universal_rpi_m5(
        df_m5, res_price, res_score, sup_price, sup_score,
        global_max_score,
        sigma_pct=rpi_cfg['sigma_pct']
    )

    return rpi_df
```

---

## 7.1 Phase 5.1: Heat Map Index (HMI) — Master Execution Pipeline

**System Overview:** HMI measures the **raw structural wall strength** without any proximity
concern. It is the distance-agnostic complement to RPI.

**Orthogonal Triplet Relationship:**

| Index   | Formula                                           | Answers                              |
| ------- | ------------------------------------------------- | ------------------------------------ |
| **HMI** | Base structural power only (no proximity decay)   | How thick/strong is the wall?        |
| **RPI** | Base structural power × Gaussian proximity decay  | How dangerous is the wall right now? |
| **BPI** | Crawl detection + HTF multiplier + ignition bonus | How hard is price hitting the wall?  |

**Interpretation pattern for traders:**

- High HMI + Low RPI = very strong wall but price is far from it — watch, not urgent
- High HMI + High RPI = very strong wall AND price is close — maximum structural danger
- High BPI = price is actively hammering whichever wall is closest

**Feature Orthogonality:** HMI must not include Gaussian proximity decay (sigma), SSA/EMA-SSA,
or HTF trend multipliers. It is a purely structural measurement derived solely from `Final_Score`
of trendline confluence. HMI reuses `extract_dynamic_targets_with_scores()` from Phase 5 — no
duplicate target extraction needed.

```python
def calculate_hmi_m5(df_m5, res_price, res_score, sup_price, sup_score, global_max_score):
    """
    Calculates pure structural HMI on the M5 grid — wall strength WITHOUT proximity decay.

    HMI = Base Power only
    RPI = Base Power × Gaussian Proximity Decay

    Uses the same Sandwich Selection pattern as RPI and BPI.
    Shares extract_dynamic_targets_with_scores() output — call once, feed to both HMI and RPI.
    """
    if global_max_score <= 0:
        global_max_score = 1.0

    # Base Power (0-100%) — identical starting point as RPI, proximity decay NOT applied
    hmi_resistance = np.clip((res_score / global_max_score), 0, 1.0) * 100.0
    hmi_support    = np.clip((sup_score / global_max_score), 0, 1.0) * 100.0

    dist_res = np.abs(res_price - df_m5['close'])
    dist_sup = np.abs(df_m5['close'] - sup_price)

    # Sandwich Selection — reports the closer wall, same as RPI/BPI
    is_res_closer     = dist_res < dist_sup
    reported_hmi      = np.where(is_res_closer, hmi_resistance, hmi_support)
    reported_hmi_type = np.where(is_res_closer, 'Resistance', 'Support')

    return pd.DataFrame({
        'active_hmi':      np.clip(reported_hmi, 0, 99.9),
        'active_hmi_type': reported_hmi_type,
    }, index=df_m5.index)


def execute_hmi_pipeline(df_m5, line_price_cols, line_score_cols, global_max_score):
    """
    Master execution function for the HMI pipeline.
    Reuses extract_dynamic_targets_with_scores() — share the result with execute_rpi_pipeline()
    to avoid redundant computation. Call pattern:

        res_price, res_score, sup_price, sup_score = extract_dynamic_targets_with_scores(...)
        hmi_df = calculate_hmi_m5(df_m5, res_price, res_score, sup_price, sup_score, max_score)
        rpi_df = calculate_universal_rpi_m5(df_m5, res_price, res_score, sup_price, sup_score, max_score)
    """
    res_price, res_score, sup_price, sup_score = extract_dynamic_targets_with_scores(
        df_m5, line_price_cols, line_score_cols
    )

    hmi_df = calculate_hmi_m5(
        df_m5, res_price, res_score, sup_price, sup_score, global_max_score
    )
    return hmi_df
```

---

## 8. Phase 6: Production Parameter Extraction & SaaS Configuration

**System Overview:** All hardcoded mathematical constants must be extracted into a centralized, dynamically updateable configuration schema. SaaS administrators and future ML optimization models must be able to adjust model sensitivities on a per-asset basis without modifying or redeploying the core Python codebase.

A **Redis Pub/Sub hot-reload hook** must be implemented so that when an ML script or the admin dashboard pushes updated parameters, the Python worker applies them on the very next calculation cycle without requiring a server restart.

### Complete Per-Symbol Config Schema

```json
{
  "XAUUSD": {
    "hmi_structural": {
      "note": "HMI uses Final_Score and global_max_score only. No sigma_pct — proximity decay is intentionally absent."
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
    }
  },
  "DEFAULT": {
    "hmi_structural": {
      "note": "HMI uses Final_Score and global_max_score only. No sigma_pct — proximity decay is intentionally absent."
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
    }
  }
}
```

### Config Loading Pattern with Hot-Reload

```python
def execute_bpi_pipeline(df_m5, df_m15, valid_line_cols, symbol_config):
    """
    Master execution function running the complete BPI pipeline using dynamic configs.
    symbol_config is fetched fresh per calculation cycle from Redis/DB cache.
    """
    bpi_cfg = symbol_config['bpi_kinetic']
    ssa_cfg = symbol_config['ssa_entropy']

    # Step 0: Adaptive SSA pre-processing (v2)
    df_m5  = run_ssa_pipeline(df_m5, ssa_cfg)
    df_m15 = run_ssa_pipeline(df_m15, ssa_cfg)

    # ... remaining pipeline steps use bpi_cfg values ...
```

---

## 9. Unified Frontend API Payload

All three indices (HMI, RPI, BPI) plus Sandwich trendline prices are returned in a single unified
JSON payload. Frontend gauge components and Sandwich indication labels read directly from this.

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
  "lower_sandwich_price": 4666.96
}
```

**Field descriptions:**

| Field                  | Source                                     | Frontend use                                  |
| ---------------------- | ------------------------------------------ | --------------------------------------------- |
| `active_hmi`           | `calculate_hmi_m5()`                       | HMI gauge chart value                         |
| `active_hmi_type`      | `calculate_hmi_m5()`                       | HMI gauge Sandwich Active Indication label    |
| `active_rpi`           | `calculate_universal_rpi_m5()`             | RPI gauge chart value                         |
| `active_rpi_type`      | `calculate_universal_rpi_m5()`             | RPI gauge Sandwich Active Indication label    |
| `active_bpi`           | `calculate_bpi_m5()`                       | BPI gauge chart value                         |
| `active_bpi_type`      | `calculate_bpi_m5()`                       | BPI gauge Sandwich Active Indication label    |
| `distance_to_active`   | `calculate_universal_rpi_m5()`             | Distance display (optional)                   |
| `entropy`              | `compute_shannon_entropy()`                | Regime display                                |
| `ssa_regime`           | mapped from entropy value                  | Regime label: Trend / Transition / Chaotic    |
| `upper_sandwich_price` | `closest_res_price` from target extraction | Upper Sandwich price label on ECharts heatmap |
| `lower_sandwich_price` | `closest_sup_price` from target extraction | Lower Sandwich price label on ECharts heatmap |

> **Interpretation:** HMI = wall thickness. RPI = current danger level. BPI = breakout kinetic energy.
> High HMI + High RPI + High BPI = a very strong wall is being actively hammered right now.

---

## 10. Technical Stack & Library Requirements

| Purpose                | Library                     | Notes                                                                                                                                        |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Core data manipulation | `pandas`, `numpy`           | All ΔP and distance calculations must be NumPy vectorized. Zero Python for-loops over DatetimeIndex.                                         |
| SSA decomposition      | `numpy` (built-in SVD)      | `np.linalg.svd` — direct equivalent of ALGLIB Hankel/SVD. No external SSA library required.                                                  |
| Entropy calculation    | `numpy` + `math` (built-in) | 3-state categorical classification matching `Entropy_IT.mq5` exactly. Uses `math.log2` + `log2(3)` normalizer. No external library required. |
| Binning & histograms   | `numpy.histogram`           | Rapid Volume/Time profile generation.                                                                                                        |
| Clustering (optional)  | `scikit-learn`              | DBSCAN or AgglomerativeClustering if proximity thresholding is insufficient for confluence detection.                                        |
| Async job queue        | `BullMQ` + `Redis`          | Config hot-reload via Redis Pub/Sub.                                                                                                         |
| Database               | `PostgreSQL`                | Only Golden nodes (top 10%) are persisted. Raw scoring stays in RAM.                                                                         |

---

## 11. Core Architectural Principles

| Principle                | Implementation                                                                 |
| ------------------------ | ------------------------------------------------------------------------------ |
| No data leakage          | M15 SSA computed natively on M15 grid, then ffilled to M5                      |
| No stair-step artifacts  | `interpolate(method='time')` not `ffill()` for HTF trendlines                  |
| Vectorized performance   | All ΔP / distance math is NumPy arrays — zero Python for-loops                 |
| Feature orthogonality    | HMI = raw wall power. RPI = wall power × proximity. BPI = SSA momentum only.   |
| RAM-first                | All Pandas scoring in memory. Only Golden nodes hit PostgreSQL/Redis.          |
| Zero hardcoded constants | All math parameters in per-symbol JSON config (Phase 6).                       |
| Hot-reloadable           | Redis Pub/Sub invalidates config cache without server restart.                 |
| Adaptive SSA             | Window L is entropy-driven per bar, not a fixed compile-time constant.         |
| Entropy consistency      | `compute_shannon_entropy()` matches `Entropy_IT.mq5` exactly — 3-state system. |
