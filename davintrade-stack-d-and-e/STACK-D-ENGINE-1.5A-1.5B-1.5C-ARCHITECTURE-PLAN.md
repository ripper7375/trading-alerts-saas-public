# DavinTrade Architecture Plan: Engine 1.5A, 1.5B, and 1.5C

**Document Version:** 1.1.0 (Iterative Refinement Draft)  
**Document Code:** `STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md`  
**System Layer:** Engine 1 (VANNA NL2SQL) ➔ **Engine 1.5 (Quantitative State, Narrative & Confluence)** ➔ Engine 2 (Synthesis & Rules) ➔ Stack E Workbench UI  
**Target Scope:** `XAUUSD` on `M5` (Micro Execution) and `M15` (Macro Structure)  
**Data Foundation:** PostgreSQL `market_data_v6` (87 Columns)  
**Last Updated:** 2026-09-06 _(Incorporating Non-Compensatory Minimum Threshold Gatekeeping, 4-Quadrant $2 \times 2$ Evaluation Matrix, and Cautionary Trade Setup Defect Flags)_

---

## 📌 1. Executive Overview & Problem Statement

### 1.1 The Role of Engine 1.5 in the DavinTrade Architecture

The DavinTrade conversational AI platform requires an intermediate quantitative translation layer between raw timeseries datastores and large language model (LLM) reasoning agents. Raw timeseries data (87 columns per bar across 54 bars = 4,698 raw float values) cannot be fed directly into LLMs without inducing severe context bloat, hallucination, and loss of mathematical rigor.

**Engine 1.5 solves this challenge through three deterministic, complementary sub-engines:**

1. **Engine 1.5A (Discrete State Machine, EDT Quality Engine & FREQ54):**  
   Discretizes continuous 87-column data into validated Market Condition Descriptions (`MCD01` to `MCD10+`), executes a **Non-Compensatory Minimum Threshold Gatekeeper** across a **$2 \times 2$ Evaluation Matrix (4 Quadrants: Model A/B on M5/M15)**, and computes 54-bar state density (`FREQ54`).
2. **Engine 1.5B (Narrative Storyline Deduplication & Payload Builder - JSONB54):**  
   Compresses 54 bars of chronological state transitions into a structured, deduplicated narrative JSON payload containing the 4-quadrant EDT quality audit and informational risk flags (Variance Ratio, Kurtosis).
3. **Engine 1.5C (Weighted Alert Confluence Scoring Engine - WACS54):**  
   Computes a deterministic 0–100 trade setup viability score using linear time-decay weighting ($55 - i$). Rather than suppressing trade setups when thresholds fail, it generates **Cautionary Trade Setup Cards with explicit Defect Flag Comments**, empowering the trader with informed risk awareness.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                ENGINE 1.5 END-TO-END DATA PROCESSING FLOW                              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. PostgreSQL `market_data_v6` (87 Columns)                                                            │
│    • Macro Query: Inception anchor to live bar (Full EDT Span: $N_{\text{span}}$ bars)                │
│    • Micro Query: Fixed 54-bar lookback ($i = 1 \dots 54$, live bar = 1)                                │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 2. ENGINE 1.5A: 4-QUADRANT QUALITY AUDIT & DISCRETE STATE MACHINE                                      │
│    ├─► 4-Quadrant Grid: Model A M5, Model B M5, Model A M15, Model B M15                               │
│    ├─► Minimum Threshold Gatekeeper: Pass/Fail evaluation for Coverage, $R^2$, Fitness, Symmetry       │
│    ├─► Micro Layer: Discretize 54 bars into MCD01–MCD10+ Discrete Vector States                        │
│    └─► Density Layer: Calculate FREQ54 occurrence count & density ratios                              │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 3. ENGINE 1.5B: NARRATIVE DEDUPLICATION & PAYLOAD BUILDER                                              │
│    ├─► Compress contiguous identical MCD states into episode blocks (run-length encoding)              │
│    ├─► Assemble `JSONB54` Payload (Header + 4-Quadrant Audit + Informational Flags + Storyline)         │
│    └─► Real-time push to Stack E Workbench UI ("Market Comments: LIVE" & "EDT Quality Metrics")        │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 4. ENGINE 1.5C: WEIGHTED CONFLUENCE SCORING & SETUP GENERATION (WACS54)                                │
│    ├─► Apply linear decay weighting: $w_i = (55 - i) / 1485$ across 54 bars                           │
│    ├─► Confluence Verdict:                                                                             │
│    │   • ALL GATES PASS ➔ Optimal / High-Conviction Trade Setup Card (Green Badge)                     │
│    │   • ANY GATE FAILS ➔ Cautionary Trade Setup Card + Defect Flags (Amber Badge + Risk Warnings)     │
│    └─► Quality transparency: Traders see projected levels alongside explicit defect disclosures        │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 5. Downstream Consumer: Engine 2 (Synthesis & Rules) ➔ Report 1, Report 1.5 & Trade Setup Card         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ 2. Core Methodological Decisions (Real-World Trading Grounding)

### 2.1 The Fallacy of Compensatory Averaging (Why Minimum Thresholds Overrule Composite Scores)

In academic modeling, it is common to compute a single composite score by averaging weighted metrics ($S = w_1 S_1 + w_2 S_2 + \dots$). **In professional trading, this is a dangerous mathematical fallacy:**

- _Example:_ If an EDT channel only spans 12 bars, its Bar Coverage is practically zero ($10\%$). However, because those 12 bars happen to form a tight line, its $R^2$ might be $0.98$ ($98\%$). A weighted average would yield $\approx 65\%$ (a passing grade!).
- _Reality:_ A 12-bar trendline is statistically meaningless noise. High correlation cannot compensate for an insufficient sample size.
- _Resolution:_ Engine 1.5 adopts a **Non-Compensatory Conjunctive Gatekeeper (All-Pass Minimum Threshold)**. Every pillar must independently satisfy its minimum acceptable standard.

### 2.2 Transparent Trade Setup Generation vs. Total Suppression

Suppressing trade setups completely when an EDT metric fails creates a poor user experience—traders are left in the dark about what the technical levels are indicating.

- _Resolution:_ **The system DOES NOT suppress the Trade Setup Card.**
- Instead, it generates a **Cautionary Trade Setup Card** with prominent **Defect Flags**, explicitly warning the trader:
  > _"Caution: This setup is derived from an EDT channel with low Bar Coverage (38 bars < 60). High whipsaw probability. Recommended action: Reduce position sizing by 50% and utilize a tight trailing stop."_

### 2.3 Demoting Variance Ratio & Kurtosis to Informational Context Flags

Financial markets exhibit non-stationary random-walk characteristics and regime shifts. Treating past sample moments (such as Kurtosis or Variance Ratio) as deterministic predictors of future price action introduces **False Precision** and **Lookback Bias**.

- _Resolution:_ Variance Ratio and Kurtosis are **not** gating criteria for trade execution. They are relegated to **Informational Context Flags in the JSONB payload**, enabling the LLM to provide nuanced, intelligent risk commentary without artificially blocking trade logic.

---

## 🔬 3. The 4-Quadrant Evaluation Matrix ($2 \times 2$ Grid)

Every 5-minute cycle, the EDT Quality Engine evaluates all 4 pillars plus informational flags across **four distinct configurations**:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE 4-QUADRANT EVALUATION MATRIX                                     │
├──────────────────────────────┬────────────────────────────────────┬────────────────────────────────────┤
│ Dimension                    │ Micro Execution Timeframe (M5)     │ Macro Structural Timeframe (M15)   │
├──────────────────────────────┼────────────────────────────────────┼────────────────────────────────────┤
│ **Model A: SSA Crossings**   │ **Quadrant 1: [Model A / M5]**     │ **Quadrant 3: [Model A / M15]**    │
│ *(Momentum Energy Pivots)*   │ Micro momentum inflection points,  │ Macro structural energy pivots,    │
│                              │ rapid momentum cycle shifts        │ foundational multi-session swing   │
├──────────────────────────────┼────────────────────────────────────┼────────────────────────────────────┤
│ **Model B: Close Price**     │ **Quadrant 2: [Model B / M5]**     │ **Quadrant 4: [Model B / M15]**    │
│ *(Price Action Reality)*     │ Micro candlestick execution,       │ Macro trend containment envelope,  │
│                              │ immediate boundary containment     │ multi-hour institutional highway   │
└──────────────────────────────┴────────────────────────────────────┴────────────────────────────────────┘
```

---

## ⚙️ 4. Engine 1.5A: Non-Compensatory Gatekeeping & State Machine

### 4.1 The 4 Core Pillars & Minimum Thresholds

For each quadrant in the $2 \times 2$ matrix, four fundamental pillars are evaluated against hard minimum thresholds:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   EDT MINIMUM THRESHOLD SPECIFICATIONS                                 │
├────┬────────────────────────┬──────────────────────────────────────────┬───────────────────────────────┤
│ #  │ Pillar Name (UI)       │ Mathematical Formula / Definition        │ Minimum Acceptable Threshold  │
├────┼────────────────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ 1  │ **Bar Coverage**       │ $N_{\text{span}} = \text{LiveBar} - \text{Anchor}_{\text{start}} + 1$│ **$N_{\text{span}} \ge 60$ bars**             │
│    │                        │ (Full structural span from start anchor) │ *(Ensures $\ge 5$h in M5,     │
│    │                        │                                          │  $\ge 15$h in M15)*           │
├────┼────────────────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ 2  │ **Regression $R^2$**   │ Evaluated independently for both models: │ • **Model A: $R^2 \ge 0.70$** │
│    │                        │ • Model A: $R^2_{\text{cross}}$          │ • **Model B: $R^2 \ge 0.65$** │
│    │                        │ • Model B: $R^2_{\text{close}}$          │ *(Guarantees linear validity)*│
├────┼────────────────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ 3  │ **EDT Fitness**        │ $\text{Fit Ratio} = \frac{\text{HalfHeight}}{\sqrt{\text{MSE}}}$│ **$1.50 \le \text{Fit Ratio} \le 3.20$**       │
│    │ *(Boundary Fit)*       │ Where $\text{HalfHeight} = \frac{UOEDT - LOEDT}{2}$│ • $< 1.50 \to \text{Over-fit (wicks breach)}$│
│    │                        │ and $\text{RMSE} = \sqrt{\text{MSE}_{\text{close}}}$   │ • $> 3.20 \to \text{Under-fit (too loose)}$  │
├────┼────────────────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ 4  │ **Baseline Symmetry**  │ Evaluates both geometry and price skew:  │ • **$0.60 \le \text{Geo Ratio} \le 1.65$**     │
│    │                        │ • $\text{Geo Ratio} = \frac{UOEDT - Base}{Base - LOEDT}$│ • **$|\text{Skewness}_{\text{close}}| \le 1.50$**│
│    │                        │ • $\text{Skewness}_{\text{close}}$       │ *(Rejects severely warped channels)*│
└────┴────────────────────────┴──────────────────────────────────────────┴───────────────────────────────┘
```

#### Quadrant Quality Verdict Formula:

$$\text{Quadrant\_Status} = (\text{Coverage} \ge 60) \land (R^2 \ge \theta_{R^2}) \land (1.5 \le \text{Fit} \le 3.2) \land (\text{Symmetry Valid})$$

- **`QUALIFIED (ALL-PASS)`:** All 4 pillars satisfy minimum thresholds $\to$ Green light for high-conviction trade setups.
- **`DEFECT_DETECTED`:** 1 or more pillars fail $\to$ Generates Defect Flags for the Trade Setup Card.

---

### 4.2 Informational Risk & Volatility Flags (Context Only, No Gating)

Computed across all 4 quadrants and packaged into the narrative payload:

- **Variance Ratio ($\text{Var Ratio} = \frac{\text{Var}_{2\text{nd}}}{\text{Var}_{1\text{st}}}$):**
  - $> 1.80 \to$ `FLAG: VOLATILITY_EXPANDING` (Breakout momentum or channel destabilization)
  - $0.70 - 1.50 \to$ `FLAG: VOLATILITY_STABLE` (Homoscedastic, clean mean-reversion)
  - $< 0.60 \to$ `FLAG: VOLATILITY_CONTRACTING` (Volatility squeeze, coil before expansion)
- **Kurtosis ($\text{Kurtosis}_{\text{close}}$):**
  - $> 4.00 \to$ `FLAG: HIGH_TAIL_RISK` (Fat tails / news wicks; LLM advises expanding SL buffer to $1.5 \times \text{ATR}$)
  - $\le 4.00 \to$ `FLAG: NORMAL_TAIL_RISK` (Standard Gaussian risk distribution)

---

### 4.3 Trend Direction Metric: Top CFL Angle (Scale-Invariant)

To evaluate trend bias without price-scale distortion across historical gold regimes, **`Top CFL Angle`** serves as the primary directional input for `MCD01`:

- $\text{Angle} > +30.0^\circ$: `STRONG_BULLISH`
- $+10.0^\circ \le \text{Angle} \le +30.0^\circ$: `MODERATE_BULLISH`
- $-10.0^\circ < \text{Angle} < +10.0^\circ$: `SIDEWAY_FLAT`
- $-30.0^\circ \le \text{Angle} \le -10.0^\circ$: `MODERATE_BEARISH`
- $\text{Angle} < -30.0^\circ$: `STRONG_BEARISH`

_(Raw Slope $b$ is retained for projecting future price levels: $P_{t+k} = P_t + b \cdot k$)._

---

### 4.4 Market Condition Descriptions (MCD01 to MCD10+) & FREQ54

Every bar in the fixed 54-bar lookback ($i = 1 \dots 54$) is evaluated across the 10 discrete condition vectors:

- `MCD01`: Primary Trend Vector (Top CFL Angle of `best_fit_a`)
- `MCD02`: Dual Variant Alignment (`best_fit_a` vs `best_fit_b` slope harmony)
- `MCD03`: EDT Boundary Proximity (Piercing, Testing, or Equilibrium relative to UOEDT/LOEDT)
- `MCD04`: Fractal Flip Line Status (Position relative to `fractal_best_fl`, `best_resistance`, `best_support`)
- `MCD05`: SSA Momentum Phase (SSA vs EMA_SSA spread and crossover state)
- `MCD06`: Candlestick Volatility Classification (`body_classification` 0 to 5)
- `MCD07`: Smart Money Structure (`zigzag_category`: HH, HL, LH, LL, EQH, EQL)
- `MCD08`: ZigZag Leg Dynamics (Price per bar velocity and wave duration classes)
- `MCD09`: Volatility Regime State (Expanding, Stable, or Contracting from Var Ratio)
- `MCD10`: Tail Risk Warning (Outlier spike detection from Kurtosis)

#### FREQ54 Signal Density:

For each discrete state $S$, compute:
$$\text{Count}_{54}(S) = \sum_{i=1}^{54} \mathbb{I}(\text{State}_i == S), \quad \text{Density}_{54}(S) = \frac{\text{Count}_{54}(S)}{54}$$

---

## 📜 5. Engine 1.5B: Narrative Storyline Deduplication & `JSONB54` Payload

### 5.1 Run-Length Episode Compression

Consecutive identical MCD states are compressed into temporal episodes to eliminate LLM token bloat:

```json
{
  "mcd": "MCD03_BOUNDARY",
  "episode": 2,
  "state": "TEST_LOWER_SUPPORT",
  "bars_span": "14-6",
  "duration_bars": 9,
  "rejection_confirmed": true,
  "wick_penetration_pips": 12
}
```

### 5.2 Complete `JSONB54` Output Payload Structure

The final structured payload delivered to PostgreSQL, the LLM, and Stack E:

```json
{
  "$schema": "https://davintrade.com/schemas/jsonb54-v1.1.json",
  "metadata": {
    "symbol": "XAUUSD",
    "timeframe": "M5",
    "timestamp_utc": 1788611580,
    "cycle_id": 41295
  },
  "edt_quality_audit": {
    "overall_status": "CAUTIONARY_DEFECTS_DETECTED",
    "passed_quadrants": 3,
    "failed_quadrants": 1,
    "quadrants": {
      "model_a_m5": {
        "span_bars": 184,
        "coverage_pass": true,
        "r2": 0.892,
        "r2_pass": true,
        "fit_ratio": 2.15,
        "fit_status": "Good-fit",
        "fit_pass": true,
        "geo_ratio": 0.98,
        "skewness": -0.05,
        "symmetry_pass": true,
        "quadrant_status": "PASS"
      },
      "model_b_m5": {
        "span_bars": 184,
        "coverage_pass": true,
        "r2": 0.815,
        "r2_pass": true,
        "fit_ratio": 2.2,
        "fit_status": "Good-fit",
        "fit_pass": true,
        "geo_ratio": 0.98,
        "skewness": -0.05,
        "symmetry_pass": true,
        "quadrant_status": "PASS"
      },
      "model_a_m15": {
        "span_bars": 42,
        "coverage_pass": false,
        "r2": 0.745,
        "r2_pass": true,
        "fit_ratio": 2.45,
        "fit_status": "Good-fit",
        "fit_pass": true,
        "geo_ratio": 0.85,
        "skewness": 0.32,
        "symmetry_pass": true,
        "quadrant_status": "FAIL",
        "defect_reasons": ["INSUFFICIENT_BAR_COVERAGE (42 < 60)"]
      },
      "model_b_m15": {
        "span_bars": 42,
        "coverage_pass": false,
        "r2": 0.68,
        "r2_pass": true,
        "fit_ratio": 2.6,
        "fit_status": "Good-fit",
        "fit_pass": true,
        "geo_ratio": 0.85,
        "skewness": 0.32,
        "symmetry_pass": true,
        "quadrant_status": "FAIL",
        "defect_reasons": ["INSUFFICIENT_BAR_COVERAGE (42 < 60)"]
      }
    },
    "defect_summary_flags": [
      "M15_COVERAGE_DEFECT: Channel history is young (42 bars). Macro trend boundary may shift on new centroids."
    ]
  },
  "informational_risk_flags": {
    "m5_variance_ratio": 1.08,
    "m5_volatility_regime": "STABLE",
    "m5_kurtosis": 3.1,
    "m5_tail_risk": "NORMAL",
    "m15_variance_ratio": 1.92,
    "m15_volatility_regime": "EXPANDING",
    "m15_kurtosis": 4.65,
    "m15_tail_risk": "HIGH_TAIL_RISK"
  },
  "trend_and_regime": {
    "m5_cfl_angle": 14.25,
    "m5_bias": "MODERATE_BULLISH",
    "m15_cfl_angle": 22.1,
    "m15_bias": "MODERATE_BULLISH",
    "alignment": "ALIGNED_BULLISH"
  },
  "support_resistance_matrix": {
    "uoedt": 2665.25,
    "base_fl": 2645.62,
    "loedt": 2634.5,
    "single_best_resistance": 2668.01,
    "single_best_support": 2629.61
  },
  "live_bar_snapshot": {
    "bar_index": 1,
    "close": 2635.8,
    "high": 2636.5,
    "low": 2634.2,
    "mcd_active_vector": [
      "MCD01_MOD_UP",
      "MCD02_ALIGNED",
      "MCD03_TEST_LOWER_SUPPORT",
      "MCD04_ABOVE_FLIP",
      "MCD05_EXPANDING_BULLISH",
      "MCD06_UP_NORMAL",
      "MCD07_HL_UPTREND",
      "MCD08_NORMAL_PACE",
      "MCD09_STABLE",
      "MCD10_NORMAL_RISK"
    ]
  },
  "deduplicated_storyline": [
    {
      "mcd": "MCD03",
      "episode": 1,
      "state": "EQUILIBRIUM_ZONE",
      "bars": "54-15",
      "duration": 40
    },
    {
      "mcd": "MCD03",
      "episode": 2,
      "state": "TEST_LOWER_SUPPORT",
      "bars": "14-6",
      "duration": 9,
      "rejection_confirmed": true
    },
    {
      "mcd": "MCD03",
      "episode": 3,
      "state": "REBOUND_TOWARDS_EQUILIBRIUM",
      "bars": "5-1",
      "duration": 5
    }
  ]
}
```

---

## 🧮 6. Engine 1.5C: Weighted Alert Confluence Score (`WACS54`) & Trade Card Rules

### 6.1 Linear Time-Decay Weighting Formulation

Prioritizes recent bars while preserving institutional memory over 54 bars:
$$w_i = 55 - i \quad \text{for } i \in [1, 54], \quad \sum_{i=1}^{54} w_i = 1,485$$

$$\text{WACS}_{54} = \frac{\sum_{i=1}^{54} (55 - i) \times \text{Conf\_Score}_i}{1,485}$$
Where $\text{Conf\_Score}_i \in [0, 100]$ evaluates multi-condition alignment at bar $i$:

1. Trend Angle Alignment ($25\%$)
2. Channel Boundary Touch at LOEDT/UOEDT ($30\%$)
3. Smart Money Structure Confirmation ($20\%$)
4. SSA Momentum Trigger / Crossover ($15\%$)
5. Price Action Candle Rejection ($10\%$)

### 6.2 Trade Setup Card Generation with Defect Flagging (No Censorship)

Rather than suppressing signals, the system evaluates the **4-Quadrant Audit** to determine badge classification and mandatory risk disclosures:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                TRADE SETUP CARD GENERATION MATRIX                                     │
├─────────────────────┬───────────────────┬───────────────────┬──────────────────────────────────────────┤
│ WACS54 Score        │ 4-Quadrant Status │ Card Badge Status │ Operational Action & Defect Disclosures  │
├─────────────────────┼───────────────────┼───────────────────┼──────────────────────────────────────────┤
│ **$\ge 80.0\%$**    │ **ALL PASS (4/4)**│ 🟢 **HIGH CONVICTION**│ Issue standard Order Card (BUY/SELL LIMIT)│
│                     │                   │                   │ Full position sizing, standard target RR │
├─────────────────────┼───────────────────┼───────────────────┼──────────────────────────────────────────┤
│ **$\ge 75.0\%$**    │ **1+ DEFECTS**    │ 🟡 **CAUTIONARY** │ Issue Order Card with **DEFECT FLAGS**:  │
│                     │                   │ **(DEFECT DETECTED)**│ • Embed specific failure notice on card │
│                     │                   │                   │ • Recommend 50% position sizing          │
│                     │                   │                   │ • Suggest tighter stop loss / quick TP1  │
├─────────────────────┼───────────────────┼───────────────────┼──────────────────────────────────────────┤
│ $50.0 - 74.9\%$     │ Any               │ ⚪ **WATCHLIST**   │ Emits monitoring alert; no order card    │
├─────────────────────┼───────────────────┼───────────────────┼──────────────────────────────────────────┤
│ **$< 50.0\%$**      │ Any               │ 🔴 **STAND ASIDE** │ Neutral market commentary                │
└─────────────────────┴───────────────────┴───────────────────┴──────────────────────────────────────────┘
```

#### Example of Cautionary Trade Setup Card on Stack E Workbench:

```text
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ TRADE SETUP CARD (CAUTIONARY)            BUY LIMIT @ $2634.50│
├─────────────────────────────────────────────────────────────────┤
│ TAKE PROFIT: $2648.00  |  STOP LOSS: $2628.50  |  RR: 1 : 2.25  │
├─────────────────────────────────────────────────────────────────┤
│ ⚠️ DEFECT WARNING FLAGS:                                        │
│ • M15 Bar Coverage Defect: Channel spans 42 bars (< 60 min).    │
│ • M15 Kurtosis Alert: 4.65 (High Tail Risk / Wick Outliers).    │
│ 💡 TRADER ADVISORY:                                             │
│ Setup technically valid via M5 structure, but macro container   │
│ is young. Recommended position sizing: 50% of standard risk.    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 7. Downstream UI Integration (Stack E Workbench)

The 4-quadrant audit maps directly to the Workbench UI components:

1. **"EDT Quality Metrics" Widget (Bottom-Right Panel):**
   - Shows M5 and M15 tabs (or a toggle between Model A and Model B).
   - Displays the 4 status bars with clear **`[ PASS ]`** (Green) or **`[ FAIL ]`** (Red) badges.
   - Prominently displays the quadrant audit verdict: `ALL QUALIFIED` or `CAUTIONARY (DEFECTS DETECTED)`.
2. **"Trade Setup Card" (Bottom-Right Action Area):**
   - High-conviction green badge when all gates pass.
   - Amber badge with collapsible/expandable defect warning disclosures when any metric is deficient.

---

_This specification represents Version 1.1.0, embedding real-world trading safeguards, multi-quadrant rigor, and transparent risk communication into the core of Engine 1.5._
