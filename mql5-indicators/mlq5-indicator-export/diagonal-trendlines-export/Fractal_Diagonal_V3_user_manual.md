# Fractal S&R Diagonal Lines — User Manual

**Version 1.03** | `Fractal_Diagonal_SIMPLE_EXPORT.mq5` | MetaTrader 5 Custom Indicator

_Companion to Fractal S&R Multi-Point Trendlines V5.54 — Zero conflicts, safe to use together_

---

## Table of Contents

1. [Overview](#1-overview)
2. [Installation](#2-installation)
3. [Diagonal Line Logic](#3-diagonal-line-logic)
4. [Input Parameters](#4-input-parameters)
5. [Scoring System](#5-scoring-system)
6. [Scoring Presets](#6-scoring-presets)
7. [Display Limits](#7-display-limits)
8. [Cache Behavior](#8-cache-behavior)
9. [Using with the Companion Indicator](#9-using-with-the-companion-indicator)
10. [Export Functionality](#10-export-functionality)
11. [Practical Tips](#11-practical-tips)

---

## 1. Overview

The Fractal S&R Diagonal Lines indicator (V1.03) automatically identifies diagonal support and resistance trendlines by connecting mixed fractal turning points (peaks and bottoms) along a common slope. It is the companion indicator to Fractal S&R Multi-Point Trendlines V5.54 and is designed to run alongside it on the same chart with zero conflicts.

Unlike the horizontal indicator which connects only peaks-to-peaks or bottoms-to-bottoms, this indicator connects **mixed fractal types** — a diagonal line may touch both peak fractals and bottom fractals as long as they align along the same slope. An **alternation bonus** rewards lines that exhibit a natural peak-bottom-peak-bottom touch pattern, which is a strong structural characteristic of valid diagonal S&R.

### Key Features

- Diagonal trendline detection using mixed peak and bottom fractals
- Strict touch qualification: minimum mixed touches, minimum peak touches, minimum bottom touches
- Alternation scoring: rewards lines where peaks and bottoms alternate naturally
- 5-factor weighted scoring with a dedicated `InpWeightAlternation` parameter
- Signed angle display: positive = ascending, negative = descending
- Up to 3 ascending and 3 descending lines displayed simultaneously
- 6 scoring presets covering all trading styles
- Cache invalidation on any parameter change for consistent recalculation
- Export functionality compatible with the companion horizontal indicator

---

## 2. Installation

Copy the file to your MetaTrader 5 Indicators folder:

```
MQL5/Indicators/
```

Compile using **F7** in MetaEditor, then attach to a chart from the Navigator panel. The indicator can coexist on the same chart as the horizontal indicator without any conflicts.

> **Note:** Both indicators share the same fractal detection concept but use entirely separate buffers, object names (`FSR_` vs `FSR_Diag_`), and global variables. You can safely run both on the same chart simultaneously.

---

## 3. Diagonal Line Logic

A valid diagonal line must pass all of the following criteria simultaneously.

### 3.1 Touch Requirements

| Rule                        | Description                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `InpMinMixedTouches`        | Total fractal points (peaks + bottoms combined) that must touch the line. Default: 4.      |
| `InpMinPeakTouches`         | Minimum of those touches that must be peak (high) fractals. Default: 2.                    |
| `InpMinBottomTouches`       | Minimum of those touches that must be bottom (low) fractals. Default: 2.                   |
| `InpMaxConsecutiveSameType` | Maximum allowed consecutive same-type touches before alternation is penalized. Default: 2. |

> **Example:** With defaults, a valid line needs at least 4 total touches, of which at least 2 must be peaks and at least 2 must be bottoms.

### 3.2 Geometric Requirements

| Rule                   | Description                                                                     |
| ---------------------- | ------------------------------------------------------------------------------- |
| `InpMinDiagonalLength` | Minimum line length in bars. Default: 80.                                       |
| `InpMinDiagonalAngle`  | Minimum absolute angle in degrees. Filters near-horizontal lines. Default: 2.0. |
| `InpMaxDiagonalAngle`  | Maximum absolute angle in degrees. Filters overly steep lines. Default: 45.0.   |

### 3.3 Angle Sign Convention

Angles in labels and scoring are signed to reflect direction:

- **Positive angle (+)** = ascending line (rising from left to right)
- **Negative angle (−)** = descending line (falling from left to right)
- Absolute value is used for filtering only; the sign is preserved in labels and export data

---

## 4. Input Parameters

### 4.1 Fractal Detection

| Parameter        | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| `InpFractalBars` | Number of bars for fractal detection (15–135). Default: 35. |

---

### 4.2 Diagonal Line Rules

| Parameter                   | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `InpMinMixedTouches`        | Minimum total fractal touches (peaks + bottoms). Default: 4.     |
| `InpMinPeakTouches`         | Minimum peak fractals among the touches. Default: 2.             |
| `InpMinBottomTouches`       | Minimum bottom fractals among the touches. Default: 2.           |
| `InpMaxConsecutiveSameType` | Max consecutive same-type touches before penalizing. Default: 2. |
| `InpMinDiagonalLength`      | Minimum line length in bars. Default: 80.                        |
| `InpMinDiagonalAngle`       | Minimum line angle in degrees. Default: 2.0.                     |
| `InpMaxDiagonalAngle`       | Maximum line angle in degrees. Default: 45.0.                    |

---

### 4.3 Tolerance Settings

| Parameter                   | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `InpToleranceType`          | Method: `TOLERANCE_PERCENT` or `TOLERANCE_ATR`.                |
| `InpTolerancePercent`       | Price tolerance as % for touch validation. Default: 1.5.       |
| `InpToleranceATRMultiplier` | ATR multiplier for tolerance in ATR mode. Default: 1.5.        |
| `InpATRPeriod`              | ATR period for angle normalization and tolerance. Default: 12. |

---

### 4.4 Display Settings

| Parameter                | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `InpLookbackBars`        | Historical bars to search. Default: 500.                                      |
| `InpExtensionBars`       | Bars to extend lines beyond last touch. Default: 100.                         |
| `InpMaxAscendingLines`   | Number of ascending (support) diagonal lines to show. Max: 3. Default: 3.     |
| `InpMaxDescendingLines`  | Number of descending (resistance) diagonal lines to show. Max: 3. Default: 3. |
| `InpAscendingLineColor`  | Color for ascending diagonal lines. Default: DodgerBlue.                      |
| `InpDescendingLineColor` | Color for descending diagonal lines. Default: OrangeRed.                      |

---

### 4.5 Labels

| Parameter            | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `InpShowLabels`      | Show angle and touch count labels on lines.                    |
| `InpLabelFontSize`   | Font size for labels. Default: 9.                              |
| `InpLabelOffsetBars` | Horizontal offset of labels in bars from line end. Default: 5. |

---

### 4.6 Scoring Weights

Controls how candidate lines are ranked. The indicator finds all valid diagonal lines and displays only the highest-scoring ones.

| Parameter              | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `InpScoringPreset`     | Select a predefined scoring profile, or Manual to use the weights below.     |
| `InpWeightFractals`    | [Manual] Score multiplier per fractal touch. Default: 25.                    |
| `InpWeightSlope`       | [Manual] Rewards lines with appropriate diagonal slope quality. Default: 15. |
| `InpWeightLength`      | [Manual] Rewards longer lines relative to lookback window. Default: 10.      |
| `InpWeightProximity`   | [Manual] Rewards lines closer to current price. Default: 50.                 |
| `InpWeightAlternation` | [Manual] Rewards peak-bottom alternating touch patterns. Default: 20.        |

> **Note:** `InpWeightAlternation` is unique to this indicator and has no equivalent in the horizontal indicator. It rewards natural zigzag touch patterns which are considered structurally stronger diagonal S&R levels.

---

### 4.7 Performance Optimization

| Parameter               | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `InpUseOptimizations`   | Master toggle for all performance features.                   |
| `InpUseCaching`         | Cache scored lines to avoid redundant recalculation.          |
| `InpUseSlopeFilter`     | Pre-filter candidates by slope before full validation.        |
| `InpUseEarlyExit`       | Stop searching once enough quality lines are found.           |
| `InpEarlyExitThreshold` | Score threshold for high-quality line counting in early exit. |
| `InpUseSpatialIndex`    | Use grid-based spatial indexing for faster fractal lookup.    |
| `InpSpatialGridSize`    | Grid cell count for spatial index. Default: 20.               |

---

### 4.8 Export Settings

| Parameter           | Description                             |
| ------------------- | --------------------------------------- |
| `InpExportFileName` | Base filename for exported CSV data.    |
| `InpIncludeHeader`  | Include column headers in export file.  |
| `InpExportBars`     | Number of bars to export. Default: 500. |

---

## 5. Scoring System

All valid diagonal lines are scored by a 5-factor composite formula. Higher score = displayed first.

```
score = (fractals_touched   × WeightFractals)
      + (alternating_bonus  × WeightAlternation)
      + (slope_score        × WeightSlope)
      + (length_ratio       × WeightLength)
      + proximity_score
```

### 5.1 Fractal Score

Each fractal point touching the line adds `WeightFractals` to the score. Identical to the horizontal indicator.

### 5.2 Alternation Score _(unique to this indicator)_

The alternation bonus rewards lines where peaks and bottoms alternate naturally (e.g., Peak → Bottom → Peak → Bottom). The bonus is the ratio of alternating transitions to total touch transitions, multiplied by `WeightAlternation`.

**Example:** A line with 5 touches in the sequence Peak-Bottom-Peak-Bottom-Peak has 4 alternating transitions out of 4 possible — bonus ratio = 1.0 (maximum). A line where the same type repeats consecutively receives a lower ratio.

### 5.3 Slope Score

For diagonal lines, slope scoring rewards lines that fall within the valid angle range (`InpMinDiagonalAngle` to `InpMaxDiagonalAngle`). Lines near the middle of this range score higher than those at the extremes.

### 5.4 Length Score

`length_ratio = min(length_bars / LookbackBars, 1.0)`, multiplied by `WeightLength`. Longer lines are considered more historically reliable.

### 5.5 Proximity Score

Identical stepped decay to the horizontal indicator:

| Distance from Current Price | Score Multiplier        |
| --------------------------- | ----------------------- |
| ≤ 0.05%                     | 100% of WeightProximity |
| ≤ 0.10%                     | 93%                     |
| ≤ 0.25%                     | 80%                     |
| ≤ 0.50%                     | 60%                     |
| ≤ 1.00%                     | 40%                     |
| ≤ 2.00%                     | 20%                     |
| > 2.00%                     | 0 points                |

---

## 6. Scoring Presets

Six preset profiles are selectable from `InpScoringPreset`. All 5 weights including Alternation are set by the preset. Manual mode uses the individual weight inputs.

| Preset                      | F      | S      | L      | P      | A      | Best For             |
| --------------------------- | ------ | ------ | ------ | ------ | ------ | -------------------- |
| Manual                      | Custom | Custom | Custom | Custom | Custom | Custom configuration |
| Preset 1 — Pure Structure   | 45     | 15     | 30     | 10     | 25     | Swing / D1           |
| Preset 2 — Structure-Biased | 35     | 15     | 25     | 25     | 20     | H1 / XAUUSD          |
| Preset 3 — Balanced         | 30     | 10     | 20     | 40     | 20     | General / M15–M30    |
| Preset 4 — Proximity-Biased | 20     | 5      | 10     | 65     | 10     | M5–M10 scalping      |
| Preset 5 — Pure Proximity   | 10     | 5      | 5      | 80     | 5      | M1 scalping only     |

_Column legend: F = Fractals, S = Slope, L = Length, P = Proximity, A = Alternation_

---

## 7. Display Limits

The indicator is compiled with a fixed number of buffers supporting a maximum of 3 ascending and 3 descending diagonal lines.

| Limit                             | Value                           |
| --------------------------------- | ------------------------------- |
| Max ascending (support) lines     | 3                               |
| Max descending (resistance) lines | 3                               |
| Total diagonal lines on chart     | 6                               |
| Lines ranked by                   | Composite score (highest first) |

---

## 8. Cache Behavior

The line cache prevents recalculation when chart data has not changed. The cache is invalidated and a full recalculation triggered when:

- Any scoring preset or weight value is changed
- Any other input parameter is modified
- A new bar forms on the chart
- New fractal data is detected

> Changing `InpScoringPreset` always triggers a full recalculation. The new weights are applied immediately without needing to reload the indicator.

---

## 9. Using with the Companion Indicator

This indicator is designed to complement Fractal S&R Multi-Point Trendlines V5.54. The two indicators differ as follows:

| Feature                 | Horizontal V5.54                 | Diagonal V1.03                     |
| ----------------------- | -------------------------------- | ---------------------------------- |
| Line direction          | Horizontal / near-flat           | Diagonal (ascending or descending) |
| Fractal types connected | Peaks only OR Bottoms only       | Mixed peaks AND bottoms            |
| Angle requirement       | Prefers flat lines               | Requires minimum angle             |
| Unique scoring factor   | None                             | Alternation bonus                  |
| Buffer names            | `ExtPeakLine*`, `ExtBottomLine*` | `DiagAscLine*`, `DiagDescLine*`    |
| Object name prefix      | `FSR_`                           | `FSR_Diag_`                        |
| Max lines on chart      | 3 peak + 3 bottom                | 3 ascending + 3 descending         |

Both indicators can be applied to the same chart simultaneously on the same symbol and timeframe without any visual or computational conflicts.

---

## 10. Export Functionality

An **Export** button is shown on the chart. Clicking it exports diagonal line data for the configured number of bars to a tab-delimited file in the MetaTrader data folder.

Exported columns include bar time, OHLC prices, and all 6 diagonal line values per bar. The filename is set by `InpExportFileName`.

---

## 11. Practical Tips

- **XAUUSD H1:** Start with Preset 2 (Structure-Biased) and `InpMinMixedTouches = 4`.
- **Strengthen alternation preference:** Increase `InpWeightAlternation` above 20 to strongly prioritize natural zigzag patterns over simple multi-touch lines.
- **Cleaner channel diagonals:** Set `InpMinDiagonalAngle = 5` and `InpMaxDiagonalAngle = 30` to focus on well-defined channel-type diagonals.
- **EA integration:** Use the export function to feed diagonal line prices into external trendline-touch execution logic.
- **Higher timeframe channels:** Use Preset 1 (Pure Structure) on D1/H4 to identify dominant diagonal channels that have held over hundreds of bars.
- **Reduce noise:** If too many lines appear and disappear frequently, increase `InpMinMixedTouches` from 4 to 5 or 6 for stronger validation requirements.
- **Pairing with horizontal:** Use ascending diagonals as dynamic support and horizontal bottom lines as static support for confluence-based entries.

---

_Fractal S&R Diagonal Lines V1.03 | MetaTrader 5 | 2025_
