# Fractal S&R Multi-Point Trendlines — User Manual

**Version 5.54** | `Fractal_horizotal_V5_WORKING_EXPORT.mq5` | MetaTrader 5 Custom Indicator

---

## Table of Contents

1. [Overview](#1-overview)
2. [Installation](#2-installation)
3. [Input Parameters](#3-input-parameters)
4. [Scoring System](#4-scoring-system)
5. [Scoring Presets](#5-scoring-presets)
6. [Display Limits](#6-display-limits)
7. [Cache Behavior](#7-cache-behavior)
8. [Alert System](#8-alert-system)
9. [Export Functionality](#9-export-functionality)
10. [Compatibility & Usage Notes](#10-compatibility--usage-notes)

---

## 1. Overview

The Fractal S&R Multi-Point Trendlines indicator (V5.54) automatically detects horizontal support and resistance levels by connecting multiple fractal turning points into trendlines. Unlike simple two-point trendlines, this indicator requires a minimum number of fractal touches to validate a line, ensuring only structurally significant levels are displayed.

The indicator operates on a scoring system that ranks all valid candidate lines by multiple factors and displays only the highest-ranked ones. This approach filters noise and surfaces the most relevant price levels for your trading timeframe and style.

### Key Features

- Dual fractal detection: 108-bar arrow symbols and 119-bar secondary symbols
- Multi-point trendline validation requiring minimum fractal touches
- 5-factor weighted scoring system with 6 preset profiles
- Up to 3 peak (resistance) and 3 bottom (support) trendlines displayed simultaneously
- Configurable angle filtering, tolerance, ATR-based normalization
- Proximity alerts with cooldown management
- Export functionality for trendline data
- Performance optimization: caching, slope filter, spatial indexing

---

## 2. Installation

Copy the file to your MetaTrader 5 Indicators folder:

```
MQL5/Indicators/
```

Compile by opening the file in MetaEditor and pressing **F7**, or attach directly to a chart via the Navigator panel.

> **Note:** The file is encoded in UTF-8 without BOM. MetaEditor will compile it correctly without any encoding conversion.

---

## 3. Input Parameters

Parameters are organized into labelled sections in the Inputs tab.

---

### 3.1 Symbol 108 Settings

| Parameter         | Description                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `InpFractalBars`  | Number of bars for fractal detection (15–135). Default: 35. Larger values find fewer but stronger fractals. |
| `InpSymbolSize`   | Arrow symbol size: Small, Normal, Large. Default: Large.                                                    |
| `InpSymbolOffset` | Vertical pixel offset for the 108 arrow symbol.                                                             |

---

### 3.2 Symbol 119 Settings

| Parameter                 | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `InpShowSymbol119`        | Toggle secondary 119-bar fractal arrows on/off.        |
| `InpFractalBars119`       | Fractal window for 119-bar symbol (5–19). Default: 13. |
| `InpSymbolSize119`        | Symbol size for 119-bar arrows.                        |
| `InpSymbol119PeakColor`   | Color for 119-bar peak arrows.                         |
| `InpSymbol119BottomColor` | Color for 119-bar bottom arrows.                       |

---

### 3.3 Multi-Point Trendline Settings

| Parameter                   | Description                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `InpShowTrendlines`         | Master toggle to show/hide all trendlines.                        |
| `InpMinFractalTouch`        | Minimum fractal points a line must touch to qualify. Default: 3.  |
| `InpMinLineLength`          | Minimum length in bars. Default: 20.                              |
| `InpMaxLineLength`          | Maximum length in bars. 0 = unlimited. Default: 0.                |
| `InpMaxAngleDegrees`        | Maximum allowed slope angle in degrees. Default: 60.              |
| `InpToleranceType`          | Tolerance method: Percent-based or ATR-based.                     |
| `InpTolerancePercent`       | Price tolerance as % for fractal touch validation. Default: 1.5.  |
| `InpToleranceATRMultiplier` | ATR multiplier for touch tolerance in ATR mode. Default: 1.5.     |
| `InpATRPeriod`              | ATR period for angle normalization and tolerance. Default: 12.    |
| `InpLookbackBars`           | Historical bars to search for fractals. Default: 500.             |
| `InpExtensionBars`          | Bars to extend trendlines beyond last touch. Default: 100.        |
| `InpMaxPeakLines`           | Number of peak (resistance) lines to display. Max: 3. Default: 3. |
| `InpMaxBottomLines`         | Number of bottom (support) lines to display. Max: 3. Default: 3.  |
| `InpPeakLineColor`          | Color for peak/resistance trendlines.                             |
| `InpBottomLineColor`        | Color for bottom/support trendlines.                              |

---

### 3.4 Scoring Weights

Controls how candidate trendlines are ranked. The indicator finds all valid lines, scores each, and displays the top-ranked results.

| Parameter            | Description                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `InpScoringPreset`   | Select a predefined scoring profile, or Manual to use the weights below. |
| `InpWeightFractals`  | [Manual] Score multiplier per fractal touch. Default: 25.                |
| `InpWeightSlope`     | [Manual] Rewards flatter (more horizontal) lines. Default: 15.           |
| `InpWeightLength`    | [Manual] Rewards longer lines relative to lookback window. Default: 10.  |
| `InpWeightProximity` | [Manual] Rewards lines closer to current price. Default: 50.             |

> **Note:** Manual weight inputs are ignored when any preset other than "Manual" is selected. Changing the preset or any weight value triggers a full recalculation automatically.

---

### 3.5 Alert Settings

| Parameter                   | Description                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `InpMasterAlertSwitch`      | Global on/off for all alerts. Default: false.                    |
| `InpEnableAlerts`           | Enable/disable pop-up alerts.                                    |
| `InpTolerancePercent_Alert` | Price distance % from trendline to trigger alert. Default: 0.05. |
| `InpAlertOnce`              | Alert only once per approach until price moves away.             |
| `InpSendNotification`       | Send push notification to MT5 mobile app.                        |
| `InpPlaySound`              | Play an audio alert sound.                                       |
| `InpAlertSound`             | Sound file name. Default: alert2.wav.                            |
| `InpAlertCooldownSeconds`   | Minimum seconds between repeat alerts. Default: 300.             |

---

### 3.6 Display Settings

| Parameter                 | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| `InpShowLabels`           | Show price/angle labels on trendlines.                         |
| `InpLabelFontSize`        | Font size for labels. Default: 9.                              |
| `InpLabelOffsetBars`      | Horizontal offset of labels in bars from line end.             |
| `InpEnableColorIntensity` | Fade line color based on distance from price.                  |
| `InpMaxFadeDistance`      | Distance in % at which lines reach maximum fade. Default: 5.0. |

---

### 3.7 Angle Filtering

| Parameter              | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| `InpEnableAngleFilter` | Toggle angle-based line filtering. Default: false.         |
| `InpMinLineAngle`      | Minimum absolute angle in degrees to accept. Default: 0.5. |
| `InpMaxLineAngle`      | Maximum absolute angle in degrees to accept. Default: 45.  |

---

### 3.8 Performance Optimization

| Parameter               | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `InpUseOptimizations`   | Master toggle for all performance features.                   |
| `InpUseCaching`         | Cache scored lines to avoid recalculation on unchanged data.  |
| `InpUseSlopeFilter`     | Pre-filter lines by slope before full validation.             |
| `InpUseEarlyExit`       | Stop searching once enough high-quality lines are found.      |
| `InpEarlyExitThreshold` | Minimum score to count a line as high-quality for early exit. |
| `InpUseSpatialIndex`    | Use grid-based spatial index to speed up fractal lookup.      |
| `InpSpatialGridSize`    | Grid cell count for spatial index. Default: 20.               |

---

### 3.9 Export Settings

| Parameter           | Description                                        |
| ------------------- | -------------------------------------------------- |
| `InpExportFileName` | Base name for the exported CSV file.               |
| `InpIncludeHeader`  | Include column headers in export.                  |
| `InpExportBars`     | Number of bars to include in export. Default: 500. |

---

## 4. Scoring System

All candidate trendlines are evaluated by a composite score. Higher score = displayed first.

```
score = (fractals_touched × WeightFractals)
      + (slope_score      × WeightSlope)
      + (length_ratio     × WeightLength)
      + proximity_score
```

### 4.1 Fractal Score

Each additional fractal point touching the line adds `WeightFractals` to the score. A line with 5 touches scores higher than one with 3 touches. This is the only unbounded component — more touches means proportionally higher score.

### 4.2 Slope Score

Rewards flatter lines. Calculated as `(90 - |angle|) / 90`, so a perfectly horizontal line scores 1.0 while a steep diagonal line scores near 0. Result is multiplied by `WeightSlope`.

### 4.3 Length Score

Rewards lines spanning a greater portion of the lookback window. `length_ratio = min(length_bars / LookbackBars, 1.0)`, multiplied by `WeightLength`.

### 4.4 Proximity Score

Rewards lines close to the current price using a stepped decay table:

| Distance from Current Price | Score Multiplier        |
| --------------------------- | ----------------------- |
| ≤ 0.05%                     | 100% of WeightProximity |
| ≤ 0.10%                     | 93%                     |
| ≤ 0.25%                     | 80%                     |
| ≤ 0.50%                     | 60%                     |
| ≤ 1.00%                     | 40%                     |
| ≤ 2.00%                     | 20%                     |
| > 2.00%                     | 0 points                |

> **Key insight:** High `WeightProximity` causes trendlines to re-rank and potentially swap as price moves through different zones. Lower values produce more stable, structure-based displays.

---

## 5. Scoring Presets

Six preset scoring profiles are available from the `InpScoringPreset` dropdown.

| Preset                      | Fractals | Slope  | Length | Proximity | Stability | Best For             |
| --------------------------- | -------- | ------ | ------ | --------- | --------- | -------------------- |
| Manual                      | Custom   | Custom | Custom | Custom    | —         | Custom configuration |
| Preset 1 — Pure Structure   | 45       | 15     | 30     | 10        | ★★★★★     | Swing trading / D1   |
| Preset 2 — Structure-Biased | 35       | 15     | 25     | 25        | ★★★★☆     | H1 / XAUUSD          |
| Preset 3 — Balanced         | 30       | 10     | 20     | 40        | ★★★☆☆     | General / M15–M30    |
| Preset 4 — Proximity-Biased | 20       | 5      | 10     | 65        | ★★☆☆☆     | M5–M10 scalping      |
| Preset 5 — Pure Proximity   | 10       | 5      | 5      | 80        | ★☆☆☆☆     | M1 scalping only     |

> **Tip for XAUUSD M10:** Preset 2 (Structure-Biased) is recommended. It produces stable zones without excessive line swapping as gold price moves through sessions.

---

## 6. Display Limits

The indicator supports a hard maximum of **3 peak lines** and **3 bottom lines**, determined by the number of compiled indicator buffers.

| Limit                       | Value                           |
| --------------------------- | ------------------------------- |
| Max peak (resistance) lines | 3                               |
| Max bottom (support) lines  | 3                               |
| Total lines on chart        | 6                               |
| Lines ranked by             | Composite score (highest first) |

Setting `InpMaxPeakLines` or `InpMaxBottomLines` above 3 has no effect — `FilterTopLines()` will still truncate to 3 because only 3 buffers exist in the compiled indicator.

---

## 7. Cache Behavior

The indicator caches computed trendlines to avoid unnecessary recalculation on every tick. The cache is invalidated (full recalculation triggered) when:

- Any input parameter is changed, including scoring weights or preset
- New fractal data is detected on a new bar
- The indicator is reloaded or reattached to the chart

Switching between scoring presets always triggers a full recalculation. The new weights are applied immediately and correctly on the very next bar calculation.

---

## 8. Alert System

Alerts fire when the current price approaches within `InpTolerancePercent_Alert` of any active trendline. The system supports four independent proximity conditions, each with its own cooldown timer.

**To activate alerts:**

1. Set `InpMasterAlertSwitch = true`
2. Enable specific alert types: popup (`InpEnableAlerts`), push notification (`InpSendNotification`), sound (`InpPlaySound`)

> `InpAlertCooldownSeconds` prevents alert spam. Default is 300 seconds (5 minutes) per condition.

---

## 9. Export Functionality

An **Export** button appears on the chart when the indicator is active. Clicking it writes a tab-delimited file to the MetaTrader data folder containing trendline data for the configured number of bars.

The exported file includes: bar time, OHLC prices, and all active trendline values per bar. Filename is set by `InpExportFileName` with a `.csv` extension.

---

## 10. Compatibility & Usage Notes

- Compatible with all MT5 symbols and timeframes
- Designed for use alongside **Fractal S&R Diagonal Lines V1.03** — zero buffer or object naming conflicts
- Higher `InpLookbackBars` values increase CPU usage; for M1 charts consider reducing to 200–300
- `InpUseSpatialIndex` improves performance on high fractal-count setups but adds memory overhead
- `InpUseEarlyExit` is suitable only if you accept potentially lower-quality line results in exchange for faster calculation
- The default scoring (Manual, Proximity=50) prioritizes lines nearest to current price; adjust toward Preset 1 or 2 for more stable structural levels

---

_Fractal S&R Multi-Point Trendlines V5.54 | MetaTrader 5 | 2025_
