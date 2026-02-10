# Keltner Channel Sentiment Gate — State Machine Modification

## Trading Advisory Conversational AI — Formal Specification

**Document Version**: 1.0
**Date**: February 9, 2026
**Purpose**: Formal specification for adding a Keltner Channel-based sentiment gate to the state machine at the `BREAKOUT_DETECTED` transition point, resolving the fundamental flaw where the state machine waits for pullbacks that strong market sentiment makes unlikely.
**Companion To**: `State_Machine_Modification_for_txtai_Framework.md` (the base state machine specification this document modifies)
**Target Audience**: Claude Code (web) for implementation
**Scope**: Keltner Channel sentiment measurement integration into the state machine — covers indicator specification, sentiment zone classification, modified transition logic, schema changes, and all code modifications to the base state machine document.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Solution: Keltner Channel Sentiment Gate](#3-solution-keltner-channel-sentiment-gate)
4. [Indicator Specification](#4-indicator-specification)
5. [Sentiment Zone Model](#5-sentiment-zone-model)
6. [Modified State Machine Transitions](#6-modified-state-machine-transitions)
7. [Updated State Transition Diagram](#7-updated-state-transition-diagram)
8. [Updated Transition Table](#8-updated-transition-table)
9. [Implementation: Sentiment Gate Logic](#9-implementation-sentiment-gate-logic)
10. [Implementation: Keltner Data Retrieval](#10-implementation-keltner-data-retrieval)
11. [Schema Changes](#11-schema-changes)
12. [Updated AgentState Schema](#12-updated-agentstate-schema)
13. [Updated Hard Rules](#13-updated-hard-rules)
14. [Updated Routing Logic](#14-updated-routing-logic)
15. [Updated Response Table](#15-updated-response-table)
16. [Convergence Scoring Integration](#16-convergence-scoring-integration)
17. [LLM Prompt Modifications](#17-llm-prompt-modifications)
18. [VectorDB Knowledge Chunks](#18-vectordb-knowledge-chunks)
19. [Configuration](#19-configuration)
20. [Testing Strategy](#20-testing-strategy)
21. [Summary of All Changes to Base Document](#21-summary-of-all-changes-to-base-document)

---

## 1. Problem Statement

### The Flaw

The current state machine (as specified in `State_Machine_Modification_for_txtai_Framework.md`) enforces a rigid sequential flow:

```
BREAKOUT_DETECTED → AWAITING_PULLBACK → PULLBACK_TESTING → advisory
```

Every confirmed breakout must pass through `AWAITING_PULLBACK` and wait 8-12 bars for price to retrace. If no pullback occurs within the time window, the state transitions to `MISSED`.

### Why This Fails in Real Markets

The strongest and most profitable breakouts — those driven by confirmed market sentiment — often do not produce pullbacks. When institutional sentiment aligns in one direction, price breaks out and accelerates away from the broken trendline without retracing.

**Real-world example (BTCUSD H1, Feb 3-5, 2026):**

Price broke support at ~68,000 and dropped to ~61,000 (a 10% move) before any meaningful pullback. During this entire move, the state machine was stuck:

```
AWAITING_PULLBACK (8-12 bars waiting for pullback)
  → MISSED (pullback never came)
    → cooldown (4 more bars doing nothing)
      → IDLE (12-16 hours later, move is over)
```

The state machine's directional read was correct — the breakout was real, the move was strong — but the architecture **penalized being right** by requiring a pullback that strong sentiment made impossible.

### The Root Cause

The state machine does not measure **market sentiment strength** at the point of breakout. It treats all breakouts identically: wait for pullback, regardless of how likely that pullback is. The missing input is a quantitative measure of sentiment that predicts pullback likelihood.

---

## 2. Root Cause Analysis

### Why Pullbacks Happen (or Don't)

A pullback after breakout occurs when:

- Momentum behind the breakout is moderate — enough to break the trendline but not enough to sustain continuous movement
- Sufficient counter-sentiment exists to temporarily push price back toward the broken level
- Price has not deviated far from its mean — there is no overextension pressure in either direction

A pullback does NOT occur when:

- Market sentiment is strongly directional — most participants are confident in the same direction
- Momentum is accelerating, not just breaking through — price deviation from the mean is large and growing
- The breakout represents a genuine sentiment shift, not just a technical level break

### Price Deviation from Mean as Sentiment Proxy

Price deviation from its moving average is one of the most reliable measures of momentum strength and thereby market sentiment. This is a well-established principle:

- **Small deviation** = moderate momentum, price oscillates around the mean, pullbacks are normal
- **Large deviation** = strong momentum, sentiment is directional, pullbacks are suppressed
- **Extreme deviation** = overextension, mean reversion pressure builds, pullback becomes likely again

The TEMA/HRMA gap in the existing Blueprint captures this partially, but lacks:

1. **ATR normalization** — a 500-point gap on BTCUSD means different things at different volatility levels
2. **Universal scale** — the gap value requires instrument-specific thresholds
3. **Higher timeframe structural context** — the sentiment that determines pullback likelihood operates at the Navigation/structural level, not the Decision level

---

## 3. Solution: Keltner Channel Sentiment Gate

### Concept

Add a **sentiment gate** at the `BREAKOUT_DETECTED` state that uses the Keltner Channel band position on a higher timeframe (H4) to determine:

1. Whether the breakout is likely a fakeout (sentiment contradicts the breakout direction)
2. Whether a pullback should be expected (moderate sentiment)
3. Whether to skip pullback entirely and generate advisory immediately (strong confirmed sentiment)
4. Whether price is overextended and a pullback should be waited for despite strong sentiment

### Why Keltner Channel

The Keltner Channel provides exactly what's needed:

- **ATR-normalized bands** — automatically scales with volatility. "Price in band 3" means the same structural thing on BTCUSD, XAUUSD, and EURUSD (approximately 2× ATR from the mean).
- **10 discrete bands** — provides a universal, instrument-agnostic scale from 1 (ultra extreme upper) to 10 (ultra extreme lower) that maps directly to sentiment zones.
- **Higher timeframe projection** — the indicator natively supports multi-timeframe analysis, projecting H4-level structural bands onto the current chart. The sentiment that determines pullback likelihood is a macro force, not a micro one.
- **HRMA center line** — uses Hull-like RMA (a responsive, low-lag moving average) as the mean, providing a smooth and accurate center that adapts to regime changes.

### Design Principle

This is a **single additional input** at a **single decision point** in the state machine. No architectural overhaul, no multi-track evaluation, no parallel processing. One indicator reading on one timeframe modifies one transition's behavior.

---

## 4. Indicator Specification

### Indicator: Multi-Timeframe Keltner Channel — 10-Band System

**Source**: `Keltner Channel ATF_10 Bands_V2.mq5` (MQL5 indicator, to be replicated in Python for the agent pipeline)

### Computation

**Center Lines (Two HRMA lines forming the middle channel):**

The center is not a single line but two HRMA lines — one applied to the higher timeframe's High price, one to the Low price. This creates a channel center that reflects the higher timeframe's bar range.

- **Upper Middle** = HRMA(HTF High, period=54)
- **Lower Middle** = HRMA(HTF Low, period=54)

**HRMA (Hull-like RMA) Calculation:**

```
alpha1 = 2.0 / (period / 2.0 + 1)     # Half-period EMA smoothing
alpha2 = 2.0 / (period + 1)             # Full-period EMA smoothing
alpha3 = 2.0 / (sqrt(period) + 1)       # Square-root-period EMA smoothing

RMA1[i] = alpha1 * price[i] + (1 - alpha1) * RMA1[i-1]
RMA2[i] = alpha2 * price[i] + (1 - alpha2) * RMA2[i-1]
HRMA_raw = 2 * RMA1[i] - RMA2[i]
HRMA[i] = alpha3 * HRMA_raw + (1 - alpha3) * HRMA[i-1]
```

This is identical to the HRMA computation used in the existing TEMA/HRMA indicator system (Blueprint Section 2.3), but applied to HTF High and HTF Low prices separately instead of typical price.

**Outer Bands (ATR-based expansion from center):**

Each outer band is offset from the center by a multiple of ATR:

| Band # | Label               | Computation                    | ATR Multiplier |
| ------ | ------------------- | ------------------------------ | -------------- |
| 1      | Ultra Extreme Upper | UpperMiddle + multiplier × ATR | 4.0            |
| 2      | Extreme Upper       | UpperMiddle + multiplier × ATR | 3.0            |
| 3      | UpperMost           | UpperMiddle + multiplier × ATR | 2.0            |
| 4      | Upper               | UpperMiddle + multiplier × ATR | 1.0            |
| 5      | Upper Middle        | HRMA(HTF High)                 | — (center)     |
| 6      | Lower Middle        | HRMA(HTF Low)                  | — (center)     |
| 7      | Lower               | LowerMiddle - multiplier × ATR | 1.0            |
| 8      | LowerMost           | LowerMiddle - multiplier × ATR | 2.0            |
| 9      | Extreme Lower       | LowerMiddle - multiplier × ATR | 3.0            |
| 10     | Ultra Extreme Lower | LowerMiddle - multiplier × ATR | 4.0            |

### Parameters

| Parameter                   | Value | Rationale                                                                                                                                                                                  |
| --------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HRMA Period                 | 54    | Reduced from default 72 for greater responsiveness at higher timeframe (H4/H8). The higher the analysis timeframe, the more each bar represents, so a shorter period avoids excessive lag. |
| ATR Period                  | 162   | Long ATR window for stable volatility normalization. On H4 this represents ~27 days of context; on H8 this represents ~54 days.                                                            |
| ATR Multiplier (bands 1/10) | 4.0   | Ultra extreme — defines the absolute outer boundary of expected price deviation                                                                                                            |
| ATR Multiplier (bands 2/9)  | 3.0   | Extreme deviation zone                                                                                                                                                                     |
| ATR Multiplier (bands 3/8)  | 2.0   | Strong deviation zone                                                                                                                                                                      |
| ATR Multiplier (bands 4/7)  | 1.0   | Normal deviation zone                                                                                                                                                                      |

### Sentiment Measurement Timeframe

The Keltner Channel is computed on a **4× multiplier of the Primary Decision TF** to maintain consistent structural context:

| Decision Timeframe Model | Primary Decision TF | Sentiment Measurement TF (Keltner) | Ratio       |
| ------------------------ | ------------------- | ---------------------------------- | ----------- |
| Config A (H1 primary)    | H1                  | **H4**                             | H1 × 4 = H4 |
| Config B (H2 primary)    | H2                  | **H8**                             | H2 × 4 = H8 |

**Rationale - The 4× Pattern**:

- **Proportional structural filtering**: Both configs get exactly 4 bars of Primary Decision TF per sentiment reading
- **Consistent noise reduction**: Same relative filtering depth across both timeframe configurations
- **Timeframe hierarchy alignment**: Sentiment TF sits one full level above the Navigation Layer for both configs
- **Trading style coherence**: H4 for intraday (Config A), H8 for swing trading (Config B)

The 4× ratio ensures that the sentiment measurement provides the same relative structural backdrop regardless of whether you're trading on H1 or H2 primary timeframes.

---

## 5. Sentiment Zone Model

### Band Position Determination

The **Keltner band position** is a discrete integer from 1 to 10 representing which two adjacent bands the current close price falls between:

```python
def determine_keltner_band_position(close_price: float, bands: dict) -> int:
    """Determine which Keltner band zone the close price occupies.

    Band numbering from 1 (ultra extreme upper) to 10 (ultra extreme lower):
      Band 1: price >= Ultra Extreme Upper (above band 1)
      Band 2: price between Extreme Upper and Ultra Extreme Upper
      Band 3: price between UpperMost and Extreme Upper
      Band 4: price between Upper and UpperMost
      Band 5: price between Upper Middle and Upper
      Band 6: price between Lower and Lower Middle
      Band 7: price between LowerMost and Lower
      Band 8: price between Extreme Lower and LowerMost
      Band 9: price between Ultra Extreme Lower and Extreme Lower
      Band 10: price <= Ultra Extreme Lower (below band 10)

    Args:
        close_price: Current close price on the Decision TF.
        bands: Dict with all 10 band values from the Keltner indicator.

    Returns:
        Integer 1-10 representing the band position.
    """
    if close_price >= bands["ultra_extreme_upper"]:
        return 1
    elif close_price >= bands["extreme_upper"]:
        return 2
    elif close_price >= bands["uppermost"]:
        return 3
    elif close_price >= bands["upper"]:
        return 4
    elif close_price >= bands["upper_middle"]:
        return 5
    elif close_price >= bands["lower_middle"]:
        return 6
    elif close_price >= bands["lower"]:
        return 7
    elif close_price >= bands["lowermost"]:
        return 8
    elif close_price >= bands["extreme_lower"]:
        return 9
    else:
        return 10
```

### Directional Sentiment Zones

The band position has different implications depending on the **direction of the breakout relative to the prior trend**. A bullish reversal breakout (long entry from bearish regime) requires price to be in the upper bands to confirm sentiment has shifted. A bearish reversal breakout (short entry from bullish regime) requires price to be in the lower bands.

**Bullish Breakout (Long Entry) — Price pierces through negative slope trendline (resistance):**

| Keltner Band Position | Sentiment Zone                                | Interpretation                                                                                                                                                                                                                                                                                                                                          | State Machine Action                                                                                                   |
| --------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| <1, 1-2               | **Pullback is likely** (overextended)         | Price is at the ultra extreme/extreme upper bands — maximum deviation from the mean. While the bullish sentiment is real and the breakout is real, the entry NOW would be chasing into overextension. Mean reversion pressure is building at these extremes. The smart entry is to wait for the inevitable retracement from this overextended position. | → **AWAITING_PULLBACK** (overextended — pullback expected due to mean reversion)                                       |
| 2-3, 3-4              | **Pullback is unlikely** (momentum confirmed) | Price has pushed significantly above the mean into the strong deviation zone. Bullish sentiment is confirmed — price deviation from the mean indicates genuine directional conviction. A pullback to the broken trendline would require a large counter-move against this sentiment, which is unlikely while price is this extended above the mean.     | → **Generate advisory IMMEDIATELY** (skip pullback). Precise entry price recommendation deferred to separate workflow. |
| 4-5, 5-6              | **Pullback is likely** (normal)               | Price is near the Keltner center (the mean). Momentum is moderate — sufficient to break through the trendline but not sufficient to prevent a retrace. There is enough counter-sentiment to produce a normal pullback to the broken level. Standard breakout-pullback-confirmation flow applies.                                                        | → **AWAITING_PULLBACK** (normal flow)                                                                                  |
| 6-7 through >10       | **Fakeout is likely**                         | Price is still in the lower bands. Bearish sentiment is overwhelmingly dominant. The upward breakout lacks the momentum/sentiment support needed for a genuine trend reversal. This breakout is most likely a fakeout — a temporary bullish push that will be absorbed by the dominant bearish structure.                                               | → **INVALIDATED** (fakeout_detected)                                                                                   |

**Bearish Breakout (Short Entry) — Price pierces through positive slope trendline (support):**

| Keltner Band Position | Sentiment Zone                                | Interpretation                                                                                                                                                                                                                                                                                              | State Machine Action                                                                                                   |
| --------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| <1 through 4-5        | **Fakeout is likely**                         | Price is still in the upper bands. Bullish sentiment is overwhelmingly dominant. The downward breakout lacks the momentum/sentiment support needed for a genuine trend reversal. This breakout is most likely a fakeout — a temporary bearish push that will be absorbed by the dominant bullish structure. | → **INVALIDATED** (fakeout_detected)                                                                                   |
| 5-6, 6-7              | **Pullback is likely** (normal)               | Price is near or just below the Keltner center (the mean). Moderate bearish momentum — sufficient to break through the trendline but not sufficient to prevent a retrace. Standard breakout-pullback-confirmation flow applies.                                                                             | → **AWAITING_PULLBACK** (normal flow)                                                                                  |
| 7-8, 8-9              | **Pullback is unlikely** (momentum confirmed) | Price has pushed significantly below the mean into the strong deviation zone. Bearish sentiment is confirmed. A pullback to the broken trendline would require a large counter-move against this sentiment.                                                                                                 | → **Generate advisory IMMEDIATELY** (skip pullback). Precise entry price recommendation deferred to separate workflow. |
| 9-10, >10             | **Pullback is likely** (overextended)         | Price is at the ultra extreme/extreme lower bands — maximum deviation from the mean. Bearish sentiment is real but entry would be chasing into overextension. Mean reversion pressure building.                                                                                                             | → **AWAITING_PULLBACK** (overextended — pullback expected due to mean reversion)                                       |

### Sentiment Zone Summary Table

| Zone                                          | Long (Bullish Breakout) | Short (Bearish Breakout) | Outcome              |
| --------------------------------------------- | ----------------------- | ------------------------ | -------------------- |
| **Fakeout is likely**                         | Bands 6-7 through >10   | Bands <1 through 4-5     | INVALIDATED          |
| **Pullback is likely** (normal)               | Bands 4-5, 5-6          | Bands 5-6, 6-7           | AWAITING_PULLBACK    |
| **Pullback is unlikely** (momentum confirmed) | Bands 2-3, 3-4          | Bands 7-8, 8-9           | Advisory immediately |
| **Pullback is likely** (overextended)         | Bands <1, 1-2           | Bands 9-10, >10          | AWAITING_PULLBACK    |

---

## 6. Modified State Machine Transitions

### Changes to BREAKOUT_DETECTED Transitions

**Before (base document, Section 8.1, transitions #8-#11):**

```
BREAKOUT_DETECTED:
  quality_sufficient     → AWAITING_PULLBACK
  quality_insufficient   → INVALIDATED
  instant_fakeout        → INVALIDATED
  timeout                → INVALIDATED
```

**After (with Keltner Sentiment Gate):**

```
BREAKOUT_DETECTED:
  sentiment_fakeout      → INVALIDATED          (NEW — Keltner band contradicts breakout direction)
  momentum_confirmed     → IDLE (via advisory)   (NEW — Keltner confirms strong sentiment, skip pullback)
  quality_sufficient     → AWAITING_PULLBACK     (UNCHANGED — bands 5-6 or overextended)
  quality_insufficient   → INVALIDATED           (UNCHANGED)
  instant_fakeout        → INVALIDATED           (UNCHANGED)
  timeout                → INVALIDATED           (UNCHANGED)
```

### Evaluation Order at BREAKOUT_DETECTED

The Keltner sentiment gate is evaluated **after** basic breakout quality (body close, not an instant fakeout) but **before** the LLM convergence evaluation:

```
1. Hard rules check (instant_fakeout — price reversed through trendline)
   → If fires: INVALIDATED immediately, skip all below

2. Timeout check (3 bars without confirmation)
   → If fires: INVALIDATED immediately, skip all below

3. Basic breakout quality check (body close beyond trendline, not just wick)
   → If fails: quality_insufficient → INVALIDATED

4. ★ KELTNER SENTIMENT GATE (NEW) ★
   → Read H4 Keltner band position
   → Determine sentiment zone based on trade direction
   → If FAKEOUT zone:            sentiment_fakeout → INVALIDATED
   → If MOMENTUM CONFIRMED zone: momentum_confirmed → advisory immediately → IDLE
   → If NORMAL PULLBACK zone:    continue to step 5 (standard flow)
   → If OVEREXTENDED zone:       continue to step 5 (wait for pullback)

5. LLM convergence evaluation (standard quality_sufficient check)
   → quality_sufficient → AWAITING_PULLBACK
```

### Key Design Decision: Gate Not Override

The Keltner sentiment gate is a **gate** (hard decision point), not an override (soft adjustment). When the band position falls in the fakeout or momentum-confirmed zones, the decision is deterministic — the LLM is not consulted. This is intentional:

- **Fakeout zone**: If price hasn't even reached the center bands in the breakout direction, the structural sentiment objectively contradicts the breakout. No amount of LLM reasoning changes this.
- **Momentum confirmed zone**: If price is 2+ ATR from the mean in the breakout direction, the structural sentiment objectively confirms the breakout. Waiting for a pullback to a trendline that is now 2+ ATR away is not a judgment call — it's structurally unsound.

Only the **normal pullback** and **overextended** zones pass through to LLM evaluation, because those zones require contextual judgment (is the pullback zone constructive? is the overextension showing signs of reversal?).

---

## 7. Updated State Transition Diagram

Replace Section 4.2 of the base document with:

```
                         new_bar / user_trigger
                               │
                               ▼
                        ┌──────────┐
               ┌───────│   IDLE   │◄──── cooldown_expired ────────┐
               │        └────┬─────┘                               │
               │             │ (automatic)                         │
               │             ▼                                     │
               │        ┌──────────────┐                           │
               │        │  NAVIGATING  │                           │
               │        └────┬────┬────┘                           │
               │             │    │ regime_incompatible → IDLE     │
               │             │ regime_valid                        │
               │             ▼                                     │
               │        ┌──────────┐                               │
               │   ┌────│ SCANNING │◄─── inconclusive ──┐         │
               │   │    └────┬─────┘                     │         │
               │   │         │ breakout_found             │         │
               │   │         ▼                            │         │
               │   │  ┌──────────────────┐                │         │
               │   │  │ BREAKOUT_DETECTED│──timeout──────►│         │
               │   │  │                  │                │         │
               │   │  │ ★ KELTNER GATE ★ │                │         │
               │   │  └──┬───┬───┬───────┘                │         │
               │   │     │   │   │                        │         │
               │   │     │   │   │ momentum_confirmed     │         │
               │   │     │   │   ▼                        │         │
               │   │     │   │  ┌────────────────┐        │         │
               │   │     │   │  │RESPOND (advise)│→ IDLE  │         │
               │   │     │   │  └────────────────┘        │         │
               │   │     │   │                            │         │
               │   │     │   │ quality_sufficient         │         │
               │   │     │   │ (bands 5-6 or overextended)│         │
               │   │     │   ▼                            │         │
               │   │     │  ┌───────────────────┐         │         │
               │   │     │  │ AWAITING_PULLBACK ├─window_expired──►MISSED──►│
               │   │     │  └────┬──────────────┘         │         │
               │   │     │       │ pullback_arrived        │         │
               │   │     │       ▼                        │         │
               │   │     │  ┌─────────────────┐           │         │
               │   │     │  │PULLBACK_TESTING ├───────────┘         │
               │   │     │  └────┬────────────┘                     │
               │   │     │       │ bounce_confirmed                 │
               │   │     │       ▼                                  │
               │   │     │  ┌──────────┐                            │
               │   │     │  │ RESPOND  │ (generate advisory)        │
               │   │     │  └────┬─────┘                            │
               │   │     │       │ → auto-transition back to IDLE   │
               │   │     │       ▼                                  │
               │   │     │    IDLE                                  │
               │   │     │                                          │
               │   │     │ sentiment_fakeout /                      │
               │   │     │ quality_insufficient / instant_fakeout / │
               │   │     │ failed_breakout / level_broken / timeout │
               │   │     │          │                               │
               │   │     │          ▼                               │
               │   │     │   ┌──────────────┐                       │
               │   └─────┴───│ INVALIDATED  ├───────────────────────┘
                             └──────────────┘
```

**Key change from base document**: `BREAKOUT_DETECTED` now has three exit paths instead of two:

1. **sentiment_fakeout** → INVALIDATED (Keltner band contradicts breakout — new)
2. **momentum_confirmed** → RESPOND → IDLE (Keltner confirms strong sentiment, skip pullback — new)
3. **quality_sufficient** → AWAITING_PULLBACK (unchanged — for normal pullback and overextended zones)

---

## 8. Updated Transition Table

Replace Section 8.1 of the base document with this expanded table. New/modified rows are marked with ★:

| #   | From              | Condition                | To                 | Trigger                                           | Hard Rule? |
| --- | ----------------- | ------------------------ | ------------------ | ------------------------------------------------- | ---------- |
| 1   | IDLE              | `new_bar`                | NAVIGATING         | Cron / new bar close                              | No         |
| 2   | IDLE              | `user_trigger`           | NAVIGATING         | User requests evaluation                          | No         |
| 3   | NAVIGATING        | `regime_valid`           | SCANNING           | Regime classification complete                    | No         |
| 4   | NAVIGATING        | `regime_incompatible`    | IDLE               | No viable trade conditions                        | No         |
| 5   | SCANNING          | `breakout_found`         | BREAKOUT_DETECTED  | Candle closes beyond trendline                    | No         |
| 6   | SCANNING          | `structure_deteriorated` | IDLE               | Key S/R breaks against direction                  | No         |
| 7   | SCANNING          | `no_setup`               | IDLE               | LLM judges no setup developing                    | No         |
| ★8  | BREAKOUT_DETECTED | `sentiment_fakeout`      | INVALIDATED        | Keltner band in fakeout zone                      | **Yes**    |
| ★9  | BREAKOUT_DETECTED | `momentum_confirmed`     | IDLE (via respond) | Keltner band in momentum confirmed zone           | **Yes**    |
| 10  | BREAKOUT_DETECTED | `quality_sufficient`     | AWAITING_PULLBACK  | LLM + score + Keltner in normal/overextended zone | No         |
| 11  | BREAKOUT_DETECTED | `quality_insufficient`   | INVALIDATED        | LLM judges poor breakout                          | No         |
| 12  | BREAKOUT_DETECTED | `instant_fakeout`        | INVALIDATED        | Price reverses through trendline                  | **Yes**    |
| 13  | BREAKOUT_DETECTED | `timeout`                | INVALIDATED        | 3 bars without confirmation                       | **Yes**    |
| 14  | AWAITING_PULLBACK | `pullback_arrived`       | PULLBACK_TESTING   | Price enters tolerance zone                       | No         |
| 15  | AWAITING_PULLBACK | `window_expired`         | MISSED             | 8-12 bars without pullback                        | **Yes**    |
| 16  | AWAITING_PULLBACK | `failed_breakout`        | INVALIDATED        | Price closes back through trendline               | **Yes**    |
| 17  | PULLBACK_TESTING  | `bounce_confirmed`       | IDLE (via respond) | Active bounce + score >= ENTER                    | No         |
| 18  | PULLBACK_TESTING  | `level_broken`           | INVALIDATED        | Price breaks zone decisively                      | **Yes**    |
| 19  | PULLBACK_TESTING  | `inconclusive`           | SCANNING           | No clear rejection/bounce                         | No         |
| 20  | PULLBACK_TESTING  | `timeout`                | INVALIDATED        | 3-8 bars lingering                                | **Yes**    |
| 21  | MISSED            | `cooldown_expired`       | IDLE               | 4 bars elapsed                                    | **Yes**    |
| 22  | INVALIDATED       | `cooldown_expired`       | IDLE               | 4 bars elapsed                                    | **Yes**    |

**Changes from base document:**

- Row 8: Was `quality_sufficient → AWAITING_PULLBACK`. Now split into rows ★8, ★9, and 10.
- ★8 (`sentiment_fakeout`): NEW — hard rule. Keltner gate rejects the breakout before LLM is consulted.
- ★9 (`momentum_confirmed`): NEW — hard rule. Keltner gate confirms breakout with strong sentiment, generates advisory immediately, transitions to IDLE.
- Row 10 (`quality_sufficient`): Now only applies when Keltner zone is normal pullback (bands 5-6) or overextended (bands 1-2 for longs, bands 9-10 for shorts).
- Total transitions increased from 20 to 22.

---

## 9. Implementation: Sentiment Gate Logic

### Core Sentiment Gate Function

```python
# File: services/agent/sentiment_gate.py

from enum import Enum
from typing import Literal


class SentimentZone(str, Enum):
    """Keltner-derived sentiment classification."""
    FAKEOUT = "FAKEOUT"
    NORMAL_PULLBACK = "NORMAL_PULLBACK"
    MOMENTUM_CONFIRMED = "MOMENTUM_CONFIRMED"
    OVEREXTENDED = "OVEREXTENDED"


def classify_sentiment_zone(
    keltner_band_position: int,
    trade_direction: Literal["long", "short"]
) -> SentimentZone:
    """Classify the current market sentiment based on Keltner band position
    and intended trade direction.

    This function implements the 4-zone directional sentiment model.
    Band position is an integer from 1 (ultra extreme upper) to 10
    (ultra extreme lower). Positions outside 1-10 are represented as
    <1 (above band 1) and >10 (below band 10).

    For LONG (bullish breakout — price pierces negative slope trendline):
      Bands 6-7 through >10  → FAKEOUT (bearish sentiment still dominant)
      Bands 4-5, 5-6         → NORMAL_PULLBACK (moderate momentum, pullback expected)
      Bands 2-3, 3-4         → MOMENTUM_CONFIRMED (strong bullish, skip pullback)
      Bands <1, 1-2          → OVEREXTENDED (overbought, wait for retracement)

    For SHORT (bearish breakout — price pierces positive slope trendline):
      Bands <1 through 4-5   → FAKEOUT (bullish sentiment still dominant)
      Bands 5-6, 6-7         → NORMAL_PULLBACK (moderate momentum, pullback expected)
      Bands 7-8, 8-9         → MOMENTUM_CONFIRMED (strong bearish, skip pullback)
      Bands 9-10, >10        → OVEREXTENDED (oversold, wait for retracement)

    Args:
        keltner_band_position: Integer 1-10 from determine_keltner_band_position().
        trade_direction: "long" for bullish breakout, "short" for bearish breakout.

    Returns:
        SentimentZone classification.
    """
    if trade_direction == "long":
        if keltner_band_position >= 7:
            return SentimentZone.FAKEOUT
        elif keltner_band_position in (5, 6):
            return SentimentZone.NORMAL_PULLBACK
        elif keltner_band_position in (3, 4):
            return SentimentZone.MOMENTUM_CONFIRMED
        else:  # bands 1-2 (<1 maps to 1)
            return SentimentZone.OVEREXTENDED

    else:  # short
        if keltner_band_position <= 5:
            return SentimentZone.FAKEOUT
        elif keltner_band_position in (6, 7):
            return SentimentZone.NORMAL_PULLBACK
        elif keltner_band_position in (8, 9):
            return SentimentZone.MOMENTUM_CONFIRMED
        else:  # bands 10 (>10 maps to 10)
            return SentimentZone.OVEREXTENDED


def evaluate_sentiment_gate(agent_state: dict, keltner_data: dict) -> str | None:
    """Evaluate the Keltner Sentiment Gate at BREAKOUT_DETECTED.

    Called after hard rules (instant_fakeout, timeout) and basic breakout
    quality checks pass, but before LLM convergence evaluation.

    Args:
        agent_state: Current AgentState dict. Must have trade_direction set.
        keltner_data: Dict with all 10 band values and current close price.

    Returns:
        Condition string if the gate fires:
          - "sentiment_fakeout": Keltner contradicts breakout → INVALIDATED
          - "momentum_confirmed": Keltner confirms strong sentiment → advisory immediately
          - None: Normal pullback or overextended → continue to LLM evaluation
    """
    close_price = keltner_data["close_price"]
    bands = keltner_data["bands"]
    direction = agent_state["trade_direction"]

    band_position = determine_keltner_band_position(close_price, bands)
    zone = classify_sentiment_zone(band_position, direction)

    # Store in agent state for persistence and audit
    agent_state["keltner_band_position"] = band_position
    agent_state["keltner_sentiment_zone"] = zone.value

    if zone == SentimentZone.FAKEOUT:
        return "sentiment_fakeout"
    elif zone == SentimentZone.MOMENTUM_CONFIRMED:
        return "momentum_confirmed"
    else:
        # NORMAL_PULLBACK or OVEREXTENDED — continue to standard flow
        return None


def determine_keltner_band_position(close_price: float, bands: dict) -> int:
    """Determine which Keltner band zone the close price occupies.

    Args:
        close_price: Current close price.
        bands: Dict with keys: ultra_extreme_upper, extreme_upper, uppermost,
               upper, upper_middle, lower_middle, lower, lowermost,
               extreme_lower, ultra_extreme_lower.

    Returns:
        Integer 1-10 representing the band position.
    """
    if close_price >= bands["ultra_extreme_upper"]:
        return 1
    elif close_price >= bands["extreme_upper"]:
        return 2
    elif close_price >= bands["uppermost"]:
        return 3
    elif close_price >= bands["upper"]:
        return 4
    elif close_price >= bands["upper_middle"]:
        return 5
    elif close_price >= bands["lower_middle"]:
        return 6
    elif close_price >= bands["lower"]:
        return 7
    elif close_price >= bands["lowermost"]:
        return 8
    elif close_price >= bands["extreme_lower"]:
        return 9
    else:
        return 10
```

### Integration into State Machine Transitions

Update `StateMachine.TRANSITIONS` in the base document's Section 4.1:

```python
# In StateMachine class — updated TRANSITIONS dict

TRANSITIONS = {
    State.IDLE: {
        "new_bar": State.NAVIGATING,
        "user_trigger": State.NAVIGATING,
    },
    State.NAVIGATING: {
        "regime_valid": State.SCANNING,
        "regime_incompatible": State.IDLE,
    },
    State.SCANNING: {
        "breakout_found": State.BREAKOUT_DETECTED,
        "structure_deteriorated": State.IDLE,
        "no_setup": State.IDLE,
    },
    State.BREAKOUT_DETECTED: {
        "sentiment_fakeout": State.INVALIDATED,       # ★ NEW — Keltner gate
        "momentum_confirmed": State.IDLE,              # ★ NEW — Keltner gate (advisory generated before transition)
        "quality_sufficient": State.AWAITING_PULLBACK,
        "quality_insufficient": State.INVALIDATED,
        "instant_fakeout": State.INVALIDATED,
        "timeout": State.INVALIDATED,
    },
    State.AWAITING_PULLBACK: {
        "pullback_arrived": State.PULLBACK_TESTING,
        "window_expired": State.MISSED,
        "failed_breakout": State.INVALIDATED,
    },
    State.PULLBACK_TESTING: {
        "bounce_confirmed": State.IDLE,
        "level_broken": State.INVALIDATED,
        "inconclusive": State.SCANNING,
        "timeout": State.INVALIDATED,
    },
    State.MISSED: {
        "cooldown_expired": State.IDLE,
    },
    State.INVALIDATED: {
        "cooldown_expired": State.IDLE,
    },
}
```

---

## 10. Implementation: Keltner Data Retrieval

### Python Replication of Keltner Channel Computation

The MQL5 indicator must be replicated in Python for the agent pipeline. The agent retrieves pre-computed OHLC data from PostgreSQL and computes the Keltner bands in Python.

```python
# File: services/agent/keltner.py

import math
from typing import Optional


class KeltnerChannel:
    """Computes 10-band Keltner Channel from OHLC data.

    Replicates the MQL5 indicator: Keltner Channel ATF_10 Bands_V2.mq5
    Parameters matched to the indicator's configuration.
    """

    DEFAULT_CONFIG = {
        "hrma_period": 54,
        "atr_period": 162,
        "multiplier_ultra_extreme": 4.0,
        "multiplier_extreme": 3.0,
        "multiplier_uppermost": 2.0,
        "multiplier_upper": 1.0,
    }

    def __init__(self, config: Optional[dict] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}

    def compute(self, ohlc_data: list[dict]) -> dict:
        """Compute all 10 Keltner bands from OHLC data.

        Args:
            ohlc_data: List of dicts with keys: open, high, low, close, time.
                       Must be sorted chronologically (oldest first).
                       Length must be >= max(hrma_period, atr_period) + 1.

        Returns:
            Dict with all 10 band values for the latest bar, plus metadata:
            {
                "ultra_extreme_upper": float,
                "extreme_upper": float,
                "uppermost": float,
                "upper": float,
                "upper_middle": float,    # HRMA of highs
                "lower_middle": float,    # HRMA of lows
                "lower": float,
                "lowermost": float,
                "extreme_lower": float,
                "ultra_extreme_lower": float,
                "atr": float,             # Current ATR value
                "close_price": float,     # Latest close
                "band_position": int,     # 1-10
            }
        """
        period = self.config["hrma_period"]
        atr_period = self.config["atr_period"]

        highs = [bar["high"] for bar in ohlc_data]
        lows = [bar["low"] for bar in ohlc_data]
        closes = [bar["close"] for bar in ohlc_data]

        # Compute HRMA for highs (upper middle) and lows (lower middle)
        upper_middle_series = self._compute_hrma(highs, period)
        lower_middle_series = self._compute_hrma(lows, period)

        # Compute ATR
        atr_series = self._compute_atr(highs, lows, closes, atr_period)

        # Get latest values
        upper_middle = upper_middle_series[-1]
        lower_middle = lower_middle_series[-1]
        atr = atr_series[-1]
        close_price = closes[-1]

        # Compute all 10 bands
        bands = {
            "ultra_extreme_upper": upper_middle + self.config["multiplier_ultra_extreme"] * atr,
            "extreme_upper": upper_middle + self.config["multiplier_extreme"] * atr,
            "uppermost": upper_middle + self.config["multiplier_uppermost"] * atr,
            "upper": upper_middle + self.config["multiplier_upper"] * atr,
            "upper_middle": upper_middle,
            "lower_middle": lower_middle,
            "lower": lower_middle - self.config["multiplier_upper"] * atr,
            "lowermost": lower_middle - self.config["multiplier_uppermost"] * atr,
            "extreme_lower": lower_middle - self.config["multiplier_extreme"] * atr,
            "ultra_extreme_lower": lower_middle - self.config["multiplier_ultra_extreme"] * atr,
            "atr": atr,
            "close_price": close_price,
        }

        bands["band_position"] = determine_keltner_band_position(close_price, bands)

        return bands

    def _compute_hrma(self, prices: list[float], period: int) -> list[float]:
        """Compute HRMA (Hull-like RMA) series.

        HRMA = EMA3(2 * EMA1 - EMA2)
        Where:
          EMA1 = EMA(period/2)
          EMA2 = EMA(period)
          EMA3 = EMA(sqrt(period))
        """
        alpha1 = 2.0 / (period / 2.0 + 1)
        alpha2 = 2.0 / (period + 1)
        alpha3 = 2.0 / (math.sqrt(period) + 1)

        rma1 = [0.0] * len(prices)
        rma2 = [0.0] * len(prices)
        hrma = [0.0] * len(prices)

        rma1[0] = prices[0]
        rma2[0] = prices[0]
        hrma[0] = prices[0]

        for i in range(1, len(prices)):
            rma1[i] = alpha1 * prices[i] + (1 - alpha1) * rma1[i - 1]
            rma2[i] = alpha2 * prices[i] + (1 - alpha2) * rma2[i - 1]
            hrma_raw = 2 * rma1[i] - rma2[i]
            hrma[i] = alpha3 * hrma_raw + (1 - alpha3) * hrma[i - 1]

        return hrma

    def _compute_atr(self, highs: list[float], lows: list[float],
                     closes: list[float], period: int) -> list[float]:
        """Compute ATR (Average True Range) series using EMA smoothing."""
        n = len(highs)
        tr = [0.0] * n
        atr = [0.0] * n

        # First TR is just high - low
        tr[0] = highs[0] - lows[0]
        atr[0] = tr[0]

        alpha = 2.0 / (period + 1)

        for i in range(1, n):
            tr[i] = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1])
            )
            atr[i] = alpha * tr[i] + (1 - alpha) * atr[i - 1]

        return atr
```

### Market Data Retriever Extension

Add Keltner data fetching to the existing `market_data_retriever` tool (base document Section 11):

```python
# Addition to services/agent/tools.py — extend market_data_retriever

def fetch_keltner_data(instrument: str, tf_config: str) -> dict:
    """Fetch H4 OHLC data and compute Keltner Channel bands.

    The sentiment measurement timeframe is H4 for both Config A (H1 primary)
    and Config B (H2 primary).

    Args:
        instrument: Trading instrument (e.g., 'BTCUSD').
        tf_config: 'config_a' or 'config_b'.

    Returns:
        Dict with all 10 band values, ATR, close price, and band position.
    """
    sentiment_tf = "H4"  # Fixed for both configs

    # Fetch sufficient H4 bars for HRMA(54) and ATR(162) computation
    # Need at least 162 bars + buffer
    ohlc_data = query_ohlc(instrument, sentiment_tf, lookback=200)

    keltner = KeltnerChannel()  # Uses default config (period=54, atr=162)
    bands = keltner.compute(ohlc_data)

    return bands
```

### PostgreSQL Table for Pre-Computed Keltner Data (Optional)

If computing Keltner bands on every evaluation cycle is too slow, pre-compute and store:

```sql
-- Optional: Pre-computed Keltner Channel data
-- Updated by Flask MT5 Service on each H4 bar close

CREATE TABLE keltner_channel_data (
    id SERIAL PRIMARY KEY,
    instrument VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL DEFAULT 'H4',
    bar_time TIMESTAMP NOT NULL,

    -- Center lines
    upper_middle DECIMAL(20,5) NOT NULL,    -- HRMA(HTF High, 54)
    lower_middle DECIMAL(20,5) NOT NULL,    -- HRMA(HTF Low, 54)

    -- ATR
    atr DECIMAL(20,5) NOT NULL,             -- ATR(162)

    -- All 10 bands
    ultra_extreme_upper DECIMAL(20,5) NOT NULL,
    extreme_upper DECIMAL(20,5) NOT NULL,
    uppermost DECIMAL(20,5) NOT NULL,
    upper_band DECIMAL(20,5) NOT NULL,
    lower_band DECIMAL(20,5) NOT NULL,
    lowermost DECIMAL(20,5) NOT NULL,
    extreme_lower DECIMAL(20,5) NOT NULL,
    ultra_extreme_lower DECIMAL(20,5) NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_keltner_bar UNIQUE(instrument, timeframe, bar_time)
);

CREATE INDEX idx_keltner_lookup ON keltner_channel_data (instrument, timeframe, bar_time DESC);
```

---

## 11. Schema Changes

### PostgreSQL agent_state Table Additions

Add the following columns to the `agent_state` table defined in base document Section 6.1:

```sql
-- Add to agent_state table (after breakout_trendline JSONB column):

    -- Keltner sentiment data
    keltner_band_position INT,                 -- 1-10 band position at breakout
    keltner_sentiment_zone VARCHAR(30),        -- 'FAKEOUT', 'NORMAL_PULLBACK', 'MOMENTUM_CONFIRMED', 'OVEREXTENDED'
    keltner_bands_snapshot JSONB,              -- All 10 band values at time of evaluation
```

Update the CHECK constraint for `current_state` — no change needed (same states).

Add a new constraint:

```sql
    CONSTRAINT valid_sentiment_zone CHECK(
        keltner_sentiment_zone IS NULL OR keltner_sentiment_zone IN (
            'FAKEOUT', 'NORMAL_PULLBACK', 'MOMENTUM_CONFIRMED', 'OVEREXTENDED'
        )
    ),
    CONSTRAINT valid_band_position CHECK(
        keltner_band_position IS NULL OR (keltner_band_position >= 1 AND keltner_band_position <= 10)
    )
```

### Audit Log Table Additions

Add the following columns to the `audit_log` table:

```sql
-- Add to audit_log table:

    keltner_band_position INT,
    keltner_sentiment_zone VARCHAR(30),
```

---

## 12. Updated AgentState Schema

Add the following fields to the `AgentState` TypedDict in base document Section 7.1:

```python
# Add to AgentState class — after breakout_trendline field:

    # ── Keltner Sentiment Gate ──
    keltner_band_position: Optional[int]         # 1-10 band position at BREAKOUT_DETECTED
    keltner_sentiment_zone: Optional[str]        # SentimentZone enum value
    keltner_bands_snapshot: Optional[dict]       # All 10 band values at evaluation time
```

Add to `JSONB_FIELDS` in `AgentStateManager`:

```python
JSONB_FIELDS = {
    "navigation_trendlines", "decision_trendlines", "decision_momentum",
    "decision_tema_hrma", "sr_zone", "lot_allocations",
    "convergence_breakdown", "convergence_history",
    "price_pattern_state", "broken_levels", "breakout_trendline",
    "keltner_bands_snapshot",  # ★ NEW
}
```

Add to `_create_default_state()`:

```python
# Add to default state dict:
"keltner_band_position": None,
"keltner_sentiment_zone": None,
"keltner_bands_snapshot": None,
```

Add to `_reset_evaluation_context()`:

```python
# Add to context clearing:
agent_state["keltner_band_position"] = None
agent_state["keltner_sentiment_zone"] = None
agent_state["keltner_bands_snapshot"] = None
```

---

## 13. Updated Hard Rules

Update `check_hard_rules()` in base document Section 8.2 to include the sentiment gate:

```python
# File: services/agent/hard_rules.py — updated

from .state_machine import State
from .sentiment_gate import evaluate_sentiment_gate


def check_hard_rules(agent_state: dict, market_data: dict,
                     keltner_data: dict = None) -> str | None:
    """Check hard rules that override LLM judgment.

    Called before LLM evaluation. If a hard rule fires,
    the returned condition is applied immediately — no LLM needed.

    Evaluation order:
    1. Failed breakout invalidation (price through trendline)
    2. Keltner Sentiment Gate (at BREAKOUT_DETECTED only)

    Args:
        agent_state: Current agent state.
        market_data: Latest market data from PostgreSQL.
        keltner_data: Keltner Channel band data from H4. Required when
                      current_state is BREAKOUT_DETECTED.

    Returns:
        Condition string if a hard rule fires, None if LLM should evaluate.
    """
    current = State(agent_state["current_state"])

    # Rule 1: Failed breakout invalidation
    if current in (State.BREAKOUT_DETECTED, State.AWAITING_PULLBACK, State.PULLBACK_TESTING):
        if _price_closed_through_trendline(agent_state, market_data):
            if current == State.BREAKOUT_DETECTED:
                return "instant_fakeout"
            elif current == State.AWAITING_PULLBACK:
                return "failed_breakout"
            elif current == State.PULLBACK_TESTING:
                return "level_broken"

    # Rule 2: Keltner Sentiment Gate (BREAKOUT_DETECTED only)
    if current == State.BREAKOUT_DETECTED and keltner_data is not None:
        sentiment_result = evaluate_sentiment_gate(agent_state, keltner_data)
        if sentiment_result is not None:
            return sentiment_result
        # If None: normal pullback or overextended — continue to LLM

    return None
```

---

## 14. Updated Routing Logic

Update `route_after_evaluation()` in base document Section 5.3 to handle the `momentum_confirmed` path:

```python
# File: services/agent/routing.py — updated

from .state_machine import State


def route_after_evaluation(agent_state: dict) -> str:
    """Determine what to do after evaluation completes.

    Updated to handle momentum_confirmed path where advisory
    is generated immediately without pullback waiting.

    Args:
        agent_state: Current agent state after evaluation.

    Returns:
        One of: "build_zone_and_respond", "respond_momentum_advisory",
                "respond_status", "respond_recommendation"
    """
    current = State(agent_state["current_state"])
    score = agent_state.get("convergence_score", 0)
    sentiment_zone = agent_state.get("keltner_sentiment_zone")

    # ★ NEW: Momentum confirmed — generate advisory without zone/pullback
    if sentiment_zone == "MOMENTUM_CONFIRMED":
        return "respond_momentum_advisory"

    # Standard pullback-confirmed path
    if current == State.PULLBACK_TESTING and score >= 5.0:
        return "build_zone_and_respond"

    if current in (State.BREAKOUT_DETECTED, State.AWAITING_PULLBACK):
        return "respond_status"

    if current in (State.SCANNING,):
        return "respond_status"

    if current in (State.MISSED, State.INVALIDATED):
        return "respond_status"

    if current == State.IDLE:
        return "respond_status"

    return "respond_status"
```

---

## 15. Updated Response Table

Replace Section 5.4 of the base document with this expanded table:

| State at Respond Time           | Sentiment Zone     | Response Type            | Content                                                                                                                                                                                                                 |
| ------------------------------- | ------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IDLE                            | —                  | Market overview          | "No active setup. Market is [regime]. Monitoring for opportunities."                                                                                                                                                    |
| SCANNING                        | —                  | Setup developing         | "Watching for breakout on [trendline]. Convergence at [score]."                                                                                                                                                         |
| BREAKOUT_DETECTED               | —                  | Alert                    | "Breakout detected on [instrument] [TF]. Evaluating quality..."                                                                                                                                                         |
| ★ BREAKOUT_DETECTED             | FAKEOUT            | Invalidation             | "Breakout invalidated — Keltner band position [X] indicates [bearish/bullish] sentiment still dominant. Breakout lacks structural support for reversal. Likely fakeout."                                                |
| ★ BREAKOUT_DETECTED             | MOMENTUM_CONFIRMED | **Momentum Advisory**    | "**MOMENTUM ENTRY**: [instrument] [direction] breakout confirmed. Keltner band [X] — strong [bullish/bearish] sentiment, pullback unlikely. Convergence: [score]. [Separate workflow needed for precise entry prices.]" |
| ★ BREAKOUT_DETECTED             | OVEREXTENDED       | Alert + Caution          | "Breakout confirmed but price overextended (Keltner band [X]). Waiting for pullback from extreme — mean reversion expected."                                                                                            |
| AWAITING_PULLBACK               | NORMAL_PULLBACK    | Update                   | "Breakout confirmed. Waiting for pullback to [level]. [X] bars remaining."                                                                                                                                              |
| ★ AWAITING_PULLBACK             | OVEREXTENDED       | Update + Context         | "Breakout confirmed. Price overextended (band [X]) — pullback from extreme likely. Monitoring for retracement."                                                                                                         |
| PULLBACK_TESTING (score >= 5.0) | —                  | **Trade Recommendation** | Full recommendation with entry zone, lots, score breakdown, confidence.                                                                                                                                                 |
| PULLBACK_TESTING (score < 5.0)  | —                  | Caution                  | "Pullback at zone but convergence insufficient ([score]). Monitoring."                                                                                                                                                  |
| MISSED                          | —                  | Missed opportunity       | "Valid breakout but entry window expired. Cooldown [X] bars."                                                                                                                                                           |
| INVALIDATED                     | —                  | Invalidation report      | "Setup invalidated: [reason]. Cooldown [X] bars."                                                                                                                                                                       |

★ = New or modified rows from the Keltner Sentiment Gate addition.

### Momentum Advisory Response Template

The `momentum_confirmed` path produces a distinct advisory format that differs from the standard pullback-confirmed recommendation. It does NOT include entry zone construction or lot allocation (since there is no pullback zone to anchor entries). Precise entry price recommendations are handled by a **separate workflow** (not covered in this document).

```python
def generate_momentum_advisory(agent_state: dict) -> str:
    """Generate advisory for momentum-confirmed breakout (no pullback expected).

    This advisory acknowledges that a separate workflow is needed
    for precise entry price recommendation.

    Args:
        agent_state: Agent state with breakout and Keltner data.

    Returns:
        Advisory text for the chat UI.
    """
    direction_label = "LONG" if agent_state["trade_direction"] == "long" else "SHORT"
    band = agent_state["keltner_band_position"]
    instrument = agent_state["instrument"]
    score = agent_state.get("convergence_score", "N/A")
    regime = agent_state.get("regime_classification", "Unknown")
    breakout_price = agent_state.get("breakout_bar_price", "N/A")

    sentiment_desc = (
        "strong bullish" if agent_state["trade_direction"] == "long"
        else "strong bearish"
    )

    return (
        f"MOMENTUM ENTRY — {instrument} {direction_label}\n\n"
        f"Breakout confirmed at {breakout_price}. "
        f"H4 Keltner band position: {band} — {sentiment_desc} sentiment. "
        f"Pullback to broken trendline is unlikely at current momentum.\n\n"
        f"Regime: {regime}\n"
        f"Convergence: {score}\n"
        f"Sentiment zone: MOMENTUM CONFIRMED\n\n"
        f"Precise entry prices require separate analysis "
        f"(micro-timeframe S/R, consolidation levels within momentum move)."
    )
```

---

## 16. Convergence Scoring Integration

### New 6th Factor: Keltner Sentiment

The existing convergence scoring system uses 5 factors (Blueprint Section 5.3). The Keltner sentiment data adds context but does NOT become a 6th scoring factor. Instead, it operates as a **pre-filter gate** that determines which path the state machine takes.

However, the Keltner band position DOES inform the LLM's evaluation as contextual data. When the LLM evaluates breakout quality (in the normal pullback or overextended zones where LLM evaluation still occurs), the band position is included in the prompt as a factual input.

### Counter-Trend Modifier Interaction

The existing counter-trend modifier (0.6 to 1.0) from the Navigation layer continues to apply. The Keltner sentiment gate operates independently and earlier in the evaluation pipeline:

```
1. Keltner Sentiment Gate (hard gate — fakeout/momentum/normal/overextended)
   ↓ (if normal or overextended)
2. Counter-trend modifier applied to convergence score
   ↓
3. LLM evaluation with Keltner context included in prompt
```

A breakout that passes the Keltner fakeout filter but is counter-trend still has its convergence score reduced by the counter-trend modifier. These are complementary mechanisms:

- **Keltner gate**: "Is there structural sentiment support for this breakout?"
- **Counter-trend modifier**: "How much should we discount the score because the macro trend is against us?"

---

## 17. LLM Prompt Modifications

### Addition to Evaluation Prompt Template

Add the following section to the LLM evaluation prompt (base document Section 14) when the state is `BREAKOUT_DETECTED` and the sentiment zone is `NORMAL_PULLBACK` or `OVEREXTENDED`:

```
## Keltner Sentiment Context
Sentiment Measurement Timeframe: H4
Keltner Band Position: {keltner_band_position} (1=ultra extreme upper, 10=ultra extreme lower)
Sentiment Zone: {keltner_sentiment_zone}
ATR(162): {keltner_atr}
Upper Middle (HRMA of H4 High): {upper_middle}
Lower Middle (HRMA of H4 Low): {lower_middle}

Band position {keltner_band_position} for a {trade_direction} trade indicates:
{sentiment_zone_explanation}

Consider this structural sentiment context in your breakout quality evaluation.
For OVEREXTENDED zone: evaluate whether mean reversion signals are developing
(narrowing TEMA/HRMA gap, reduced momentum, absorption candles).
```

### Addition to System Prompt

Add to the trading agent system prompt (base document references Section 6.2 of Agentic RAG Implementation Architecture):

```
When evaluating breakouts:
- The Keltner Channel band position on H4 provides structural sentiment context.
  Band 5-6 is the center (mean). Bands 1-4 are above the mean (bullish deviation).
  Bands 7-10 are below the mean (bearish deviation).
- The further price deviates from the mean in the breakout direction, the stronger
  the sentiment confirmation. But extreme deviation (bands 1-2 or 9-10) indicates
  overextension where mean reversion is likely.
- You will only be consulted when the Keltner zone is NORMAL_PULLBACK or OVEREXTENDED.
  FAKEOUT and MOMENTUM_CONFIRMED are handled automatically before your evaluation.
```

---

## 18. VectorDB Knowledge Chunks

### New Chunk for Knowledge Base

Add the following chunk to the VectorDB (as specified in Agentic RAG Implementation Architecture Section 2.2):

| Chunk ID                 | Source Section                      | Content Summary                                                                                                                                                                                                  | Tokens (approx) | Key Metadata Tags                                                           |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| `sentiment-keltner-gate` | Keltner Sentiment Gate Modification | Keltner Channel 10-band sentiment measurement, 4-zone directional model (fakeout/normal/momentum/overextended), band position interpretation for long and short reversals, interaction with pullback expectation | ~800            | `sentiment`, `keltner`, `momentum`, `pullback`, `breakout`, `state-machine` |

**Metadata:**

```json
{
  "chunk_id": "sentiment-keltner-gate",
  "source_document": "keltner_sentiment_gate_modification",
  "section_title": "Keltner Channel Sentiment Gate",
  "layer": "decision",
  "topic_tags": [
    "sentiment",
    "keltner",
    "momentum",
    "pullback",
    "breakout",
    "fakeout",
    "overextended"
  ],
  "state_relevance": ["BREAKOUT_DETECTED", "AWAITING_PULLBACK"],
  "indicator_relevance": ["keltner", "tema-hrma", "momentum"],
  "version": "1.0",
  "last_updated": "2026-02-09"
}
```

---

## 19. Configuration

### Keltner Configuration Defaults

Add to the configuration section (base document Section 17):

```python
# Add to DEFAULT_CONFIG or separate keltner config

KELTNER_CONFIG = {
    # Indicator parameters
    "hrma_period": 54,                    # HRMA period (reduced from 72 for responsiveness at HTF)
    "atr_period": 162,                    # ATR period for band width
    "multiplier_ultra_extreme": 4.0,      # Bands 1 and 10
    "multiplier_extreme": 3.0,            # Bands 2 and 9
    "multiplier_uppermost": 2.0,          # Bands 3 and 8
    "multiplier_upper": 1.0,              # Bands 4 and 7

    # Sentiment measurement timeframe (4× Primary Decision TF ratio)
    "sentiment_tf_config_a": "H4",        # For H1 primary: H1 × 4 = H4
    "sentiment_tf_config_b": "H8",        # For H2 primary: H2 × 4 = H8

    # Sentiment zone thresholds (band positions)
    # Long (bullish breakout — price pierces negative slope trendline):
    "long_fakeout_threshold": 7,          # Bands >= 7 → fakeout
    "long_normal_bands": [5, 6],          # Bands 5-6 → normal pullback
    "long_momentum_bands": [3, 4],        # Bands 3-4 → momentum confirmed
    "long_overextended_threshold": 3,     # Bands < 3 → overextended

    # Short (bearish breakout — price pierces positive slope trendline):
    "short_fakeout_threshold": 5,         # Bands <= 5 → fakeout
    "short_normal_bands": [6, 7],         # Bands 6-7 → normal pullback
    "short_momentum_bands": [8, 9],       # Bands 8-9 → momentum confirmed
    "short_overextended_threshold": 9,    # Bands > 9 → overextended
}
```

### YAML Configuration Extension

Add to `config/txtai_app.yml`:

```yaml
# Keltner Sentiment Gate configuration
keltner:
  hrma_period: 54
  atr_period: 162
  sentiment_timeframe:
    config_a: H4 # H1 × 4 = H4
    config_b: H8 # H2 × 4 = H8
  multipliers:
    ultra_extreme: 4.0
    extreme: 3.0
    uppermost: 2.0
    upper: 1.0
  sentiment_zones:
    long:
      fakeout_above_or_equal: 7
      normal_bands: [5, 6]
      momentum_bands: [3, 4]
      overextended_below: 3
    short:
      fakeout_below_or_equal: 5
      normal_bands: [6, 7]
      momentum_bands: [8, 9]
      overextended_above: 9
```

---

## 20. Testing Strategy

### Unit Tests for Sentiment Gate

```python
# File: tests/test_sentiment_gate.py

import pytest
from services.agent.sentiment_gate import (
    classify_sentiment_zone,
    determine_keltner_band_position,
    evaluate_sentiment_gate,
    SentimentZone,
)


class TestKeltnerBandPosition:
    """Test band position determination from price and band values."""

    @pytest.fixture
    def sample_bands(self):
        """Sample Keltner bands for BTCUSD H4."""
        return {
            "ultra_extreme_upper": 80000.0,    # Band 1
            "extreme_upper": 77000.0,          # Band 2
            "uppermost": 74000.0,              # Band 3
            "upper": 71000.0,                  # Band 4
            "upper_middle": 68000.0,           # Band 5
            "lower_middle": 67000.0,           # Band 6
            "lower": 64000.0,                  # Band 7
            "lowermost": 61000.0,              # Band 8
            "extreme_lower": 58000.0,          # Band 9
            "ultra_extreme_lower": 55000.0,    # Band 10
        }

    def test_price_above_all_bands(self, sample_bands):
        assert determine_keltner_band_position(85000.0, sample_bands) == 1

    def test_price_in_extreme_upper(self, sample_bands):
        assert determine_keltner_band_position(78000.0, sample_bands) == 2

    def test_price_in_uppermost(self, sample_bands):
        assert determine_keltner_band_position(75000.0, sample_bands) == 3

    def test_price_in_upper(self, sample_bands):
        assert determine_keltner_band_position(72000.0, sample_bands) == 4

    def test_price_in_upper_middle(self, sample_bands):
        assert determine_keltner_band_position(68500.0, sample_bands) == 5

    def test_price_in_lower_middle(self, sample_bands):
        assert determine_keltner_band_position(67500.0, sample_bands) == 6

    def test_price_in_lower(self, sample_bands):
        assert determine_keltner_band_position(65000.0, sample_bands) == 7

    def test_price_in_lowermost(self, sample_bands):
        assert determine_keltner_band_position(62000.0, sample_bands) == 8

    def test_price_in_extreme_lower(self, sample_bands):
        assert determine_keltner_band_position(57000.0, sample_bands) == 9

    def test_price_below_all_bands(self, sample_bands):
        assert determine_keltner_band_position(50000.0, sample_bands) == 10


class TestSentimentZoneClassification:
    """Test directional sentiment zone classification."""

    # ── Long (Bullish Breakout — price pierces negative slope trendline) ──

    def test_long_fakeout_band_7(self):
        assert classify_sentiment_zone(7, "long") == SentimentZone.FAKEOUT

    def test_long_fakeout_band_8(self):
        assert classify_sentiment_zone(8, "long") == SentimentZone.FAKEOUT

    def test_long_fakeout_band_10(self):
        assert classify_sentiment_zone(10, "long") == SentimentZone.FAKEOUT

    def test_long_normal_band_5(self):
        assert classify_sentiment_zone(5, "long") == SentimentZone.NORMAL_PULLBACK

    def test_long_normal_band_6(self):
        assert classify_sentiment_zone(6, "long") == SentimentZone.NORMAL_PULLBACK

    def test_long_momentum_band_3(self):
        assert classify_sentiment_zone(3, "long") == SentimentZone.MOMENTUM_CONFIRMED

    def test_long_momentum_band_4(self):
        assert classify_sentiment_zone(4, "long") == SentimentZone.MOMENTUM_CONFIRMED

    def test_long_overextended_band_1(self):
        assert classify_sentiment_zone(1, "long") == SentimentZone.OVEREXTENDED

    def test_long_overextended_band_2(self):
        assert classify_sentiment_zone(2, "long") == SentimentZone.OVEREXTENDED

    # ── Short (Bearish Breakout — price pierces positive slope trendline) ──

    def test_short_fakeout_band_1(self):
        assert classify_sentiment_zone(1, "short") == SentimentZone.FAKEOUT

    def test_short_fakeout_band_3(self):
        assert classify_sentiment_zone(3, "short") == SentimentZone.FAKEOUT

    def test_short_fakeout_band_5(self):
        assert classify_sentiment_zone(5, "short") == SentimentZone.FAKEOUT

    def test_short_normal_band_6(self):
        assert classify_sentiment_zone(6, "short") == SentimentZone.NORMAL_PULLBACK

    def test_short_normal_band_7(self):
        assert classify_sentiment_zone(7, "short") == SentimentZone.NORMAL_PULLBACK

    def test_short_momentum_band_8(self):
        assert classify_sentiment_zone(8, "short") == SentimentZone.MOMENTUM_CONFIRMED

    def test_short_momentum_band_9(self):
        assert classify_sentiment_zone(9, "short") == SentimentZone.MOMENTUM_CONFIRMED

    def test_short_overextended_band_10(self):
        assert classify_sentiment_zone(10, "short") == SentimentZone.OVEREXTENDED


class TestSentimentGateEvaluation:
    """Test the full sentiment gate evaluation function."""

    @pytest.fixture
    def base_agent_state(self):
        return {
            "current_state": "BREAKOUT_DETECTED",
            "trade_direction": "long",
            "keltner_band_position": None,
            "keltner_sentiment_zone": None,
        }

    @pytest.fixture
    def sample_keltner_data(self):
        return {
            "close_price": 72000.0,
            "bands": {
                "ultra_extreme_upper": 80000.0,
                "extreme_upper": 77000.0,
                "uppermost": 74000.0,
                "upper": 71000.0,
                "upper_middle": 68000.0,
                "lower_middle": 67000.0,
                "lower": 64000.0,
                "lowermost": 61000.0,
                "extreme_lower": 58000.0,
                "ultra_extreme_lower": 55000.0,
            }
        }

    def test_long_momentum_confirmed(self, base_agent_state, sample_keltner_data):
        # Price at 75000 is in band 3 (between uppermost=74000 and extreme_upper=77000)
        sample_keltner_data["close_price"] = 75000.0  # Band 3
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "momentum_confirmed"
        assert base_agent_state["keltner_band_position"] == 3
        assert base_agent_state["keltner_sentiment_zone"] == "MOMENTUM_CONFIRMED"

    def test_long_fakeout(self, base_agent_state, sample_keltner_data):
        # Price at 62000 is in band 8 (between extreme_lower=58000 and lowermost=61000)
        sample_keltner_data["close_price"] = 62000.0  # Band 8
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "sentiment_fakeout"
        assert base_agent_state["keltner_sentiment_zone"] == "FAKEOUT"

    def test_long_fakeout_band_7(self, base_agent_state, sample_keltner_data):
        # Price at 65000 is in band 7 (between lowermost=61000 and lower=64000)
        sample_keltner_data["close_price"] = 65000.0  # Band 7
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "sentiment_fakeout"
        assert base_agent_state["keltner_sentiment_zone"] == "FAKEOUT"

    def test_long_normal_pullback(self, base_agent_state, sample_keltner_data):
        # Price at 68500 is in band 5 (between upper_middle=68000 and upper=71000)
        sample_keltner_data["close_price"] = 68500.0  # Band 5
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result is None  # Continue to LLM evaluation
        assert base_agent_state["keltner_sentiment_zone"] == "NORMAL_PULLBACK"

    def test_long_normal_pullback_band_6(self, base_agent_state, sample_keltner_data):
        # Price at 67500 is in band 6 (between lower_middle=67000 and upper_middle=68000)
        # Note: band 6 is still normal pullback for long
        sample_keltner_data["close_price"] = 67500.0  # Band 6
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result is None
        assert base_agent_state["keltner_sentiment_zone"] == "NORMAL_PULLBACK"

    def test_long_overextended(self, base_agent_state, sample_keltner_data):
        # Price at 85000 is in band 1 (above ultra_extreme_upper=80000)
        sample_keltner_data["close_price"] = 85000.0  # Band 1
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result is None  # Continue to LLM (wait for pullback from extreme)
        assert base_agent_state["keltner_sentiment_zone"] == "OVEREXTENDED"

    def test_short_momentum_confirmed(self, base_agent_state, sample_keltner_data):
        base_agent_state["trade_direction"] = "short"
        # Price at 59000 is in band 9 (between ultra_extreme_lower=55000 and extreme_lower=58000)
        sample_keltner_data["close_price"] = 59000.0  # Band 9
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "momentum_confirmed"

    def test_short_momentum_confirmed_band_8(self, base_agent_state, sample_keltner_data):
        base_agent_state["trade_direction"] = "short"
        # Price at 62000 is in band 8 (between extreme_lower=58000 and lowermost=61000)
        sample_keltner_data["close_price"] = 62000.0  # Band 8
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "momentum_confirmed"

    def test_short_fakeout(self, base_agent_state, sample_keltner_data):
        base_agent_state["trade_direction"] = "short"
        # Price at 75000 is in band 3 — fakeout for short
        sample_keltner_data["close_price"] = 75000.0  # Band 3
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "sentiment_fakeout"

    def test_short_fakeout_band_5(self, base_agent_state, sample_keltner_data):
        base_agent_state["trade_direction"] = "short"
        # Price at 68500 is in band 5 — still fakeout for short (bands <= 5)
        sample_keltner_data["close_price"] = 68500.0  # Band 5
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "sentiment_fakeout"

    def test_short_normal_pullback_band_6(self, base_agent_state, sample_keltner_data):
        base_agent_state["trade_direction"] = "short"
        # Price at 67500 is in band 6 — normal pullback for short
        sample_keltner_data["close_price"] = 67500.0  # Band 6
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result is None
        assert base_agent_state["keltner_sentiment_zone"] == "NORMAL_PULLBACK"

    def test_short_normal_pullback_band_7(self, base_agent_state, sample_keltner_data):
        base_agent_state["trade_direction"] = "short"
        # Price at 65000 is in band 7 — normal pullback for short
        sample_keltner_data["close_price"] = 65000.0  # Band 7
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result is None
        assert base_agent_state["keltner_sentiment_zone"] == "NORMAL_PULLBACK"

    def test_short_overextended(self, base_agent_state, sample_keltner_data):
        base_agent_state["trade_direction"] = "short"
        # Price at 50000 is in band 10 (below ultra_extreme_lower=55000)
        sample_keltner_data["close_price"] = 50000.0  # Band 10
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result is None  # Continue to LLM (wait for pullback from extreme)
        assert base_agent_state["keltner_sentiment_zone"] == "OVEREXTENDED"


class TestStateMachineIntegration:
    """Test that the state machine accepts the new transition conditions."""

    def test_sentiment_fakeout_transition(self):
        from services.agent.state_machine import StateMachine, State
        sm = StateMachine()
        target = sm.validate_transition(State.BREAKOUT_DETECTED, "sentiment_fakeout")
        assert target == State.INVALIDATED

    def test_momentum_confirmed_transition(self):
        from services.agent.state_machine import StateMachine, State
        sm = StateMachine()
        target = sm.validate_transition(State.BREAKOUT_DETECTED, "momentum_confirmed")
        assert target == State.IDLE
```

### Integration Test: Full Cycle with Keltner Gate

```python
class TestFullCycleWithKeltner:
    """End-to-end test: evaluation cycle with Keltner sentiment gate."""

    def test_momentum_confirmed_skips_pullback(self):
        """When Keltner confirms momentum, advisory is generated
        immediately without waiting for pullback."""
        # Setup: State in BREAKOUT_DETECTED, trade direction long
        # Keltner band position = 3 (momentum confirmed for long)
        # Expected: advisory generated, state transitions to IDLE
        # AWAITING_PULLBACK is never entered
        pass  # Implementation depends on full pipeline wiring

    def test_fakeout_invalidates_before_llm(self):
        """When Keltner detects fakeout, state transitions to INVALIDATED
        without consulting the LLM."""
        # Setup: State in BREAKOUT_DETECTED, trade direction long
        # Keltner band position = 8 (fakeout for long)
        # Expected: INVALIDATED, LLM never called
        pass

    def test_normal_pullback_follows_standard_flow(self):
        """When Keltner zone is normal pullback, standard flow applies."""
        # Setup: State in BREAKOUT_DETECTED, trade direction long
        # Keltner band position = 5 (normal pullback)
        # Expected: continues to LLM evaluation, then AWAITING_PULLBACK
        pass

    def test_overextended_waits_for_pullback(self):
        """When Keltner detects overextension, system waits for pullback
        from extreme despite strong momentum."""
        # Setup: State in BREAKOUT_DETECTED, trade direction long
        # Keltner band position = 1 (overextended)
        # Expected: AWAITING_PULLBACK (not momentum_confirmed)
        pass
```

---

## 21. Summary of All Changes to Base Document

This section provides a complete checklist of every modification needed in `State_Machine_Modification_for_txtai_Framework.md`:

### Section 4.1: State Machine Engine — `StateMachine.TRANSITIONS`

**Change**: Add two new conditions to `State.BREAKOUT_DETECTED`:

```python
"sentiment_fakeout": State.INVALIDATED,
"momentum_confirmed": State.IDLE,
```

### Section 4.2: State Transition Diagram

**Change**: Replace entire diagram with the updated version from Section 7 of this document. Key addition: `BREAKOUT_DETECTED` now has three exit paths (fakeout, momentum, standard).

### Section 5.3: Routing Logic — `route_after_evaluation()`

**Change**: Add `"respond_momentum_advisory"` return path when `keltner_sentiment_zone == "MOMENTUM_CONFIRMED"`. See Section 14 of this document.

### Section 5.4: Response Table

**Change**: Add 4 new rows for FAKEOUT, MOMENTUM_CONFIRMED, OVEREXTENDED, and momentum advisory responses. See Section 15 of this document.

### Section 6.1: PostgreSQL Schema — `agent_state` table

**Change**: Add 3 columns: `keltner_band_position INT`, `keltner_sentiment_zone VARCHAR(30)`, `keltner_bands_snapshot JSONB`. Add 2 CHECK constraints. See Section 11 of this document.

### Section 7.1: AgentState Schema

**Change**: Add 3 fields: `keltner_band_position`, `keltner_sentiment_zone`, `keltner_bands_snapshot`. See Section 12 of this document.

### Section 6.2: State Persistence Manager

**Change**: Add `"keltner_bands_snapshot"` to `JSONB_FIELDS`. Add 3 fields to `_create_default_state()`. Add 3 fields to `_reset_evaluation_context()`.

### Section 8.1: Transition Table

**Change**: Replace rows 8-13 with expanded rows including ★8 (`sentiment_fakeout`) and ★9 (`momentum_confirmed`). Total transitions: 20 → 22. See Section 8 of this document.

### Section 8.2: Hard Rules — `check_hard_rules()`

**Change**: Add `keltner_data` parameter. Add Keltner Sentiment Gate as Rule 2 (after failed breakout invalidation, before LLM evaluation). See Section 13 of this document.

### Section 14: LLM Prompt Construction

**Change**: Add "Keltner Sentiment Context" block to evaluation prompt template. See Section 17 of this document.

### Section 17: Configuration

**Change**: Add `KELTNER_CONFIG` dict with all indicator parameters and sentiment zone thresholds. See Section 19 of this document.

### Section 18: Testing Strategy

**Change**: Add test classes for sentiment gate, band position determination, and full cycle integration. See Section 20 of this document.

### Section 19: File Structure

**Change**: Add new files:

```
services/agent/
  ├── sentiment_gate.py          # ★ NEW — Sentiment zone classification + gate logic
  ├── keltner.py                 # ★ NEW — Keltner Channel computation (Python replication)
  ├── state_machine.py           # MODIFIED — 2 new transitions
  ├── hard_rules.py              # MODIFIED — Keltner gate as Rule 2
  ├── routing.py                 # MODIFIED — momentum_confirmed path
  ├── state_persistence.py       # MODIFIED — 3 new fields
  ├── schema.py                  # MODIFIED — 3 new fields
  └── ...
tests/
  ├── test_sentiment_gate.py     # ★ NEW — Comprehensive sentiment gate tests
  └── ...
```

### Audit Log Table

**Change**: Add `keltner_band_position INT` and `keltner_sentiment_zone VARCHAR(30)` columns to the `audit_log` table.

---

## Appendix A: Keltner Channel MQL5 Indicator Reference

**Source file**: `mql5-indicators/Keltner Channel ATF_10 Bands_V2.mq5`

**Key parameters as implemented in MQL5**:

| Parameter                      | MQL5 Variable                     | Default Value  | Python Equivalent          |
| ------------------------------ | --------------------------------- | -------------- | -------------------------- |
| Analysis Timeframe             | `AnalysisTimeframe`               | PERIOD_CURRENT | `sentiment_tf` (H4)        |
| HRMA Period                    | `HRMAPeriod`                      | 54             | `hrma_period`              |
| ATR Period                     | `ATRPeriod`                       | 162            | `atr_period`               |
| Ultra Extreme Upper Multiplier | `ATRMultiplier_UltraExtremeUpper` | 4.00           | `multiplier_ultra_extreme` |
| Extreme Upper Multiplier       | `ATRMultiplier_ExtremeUpper`      | 3.00           | `multiplier_extreme`       |
| UpperMost Multiplier           | `ATRMultiplier_UpperMost`         | 2.00           | `multiplier_uppermost`     |
| Upper Multiplier               | `ATRMultiplier_Upper`             | 1.00           | `multiplier_upper`         |

**Note**: The MQL5 indicator also has separate multiplier inputs for the lower bands (`ATRMultiplier_Lower`, `ATRMultiplier_LowerMost`, `ATRMultiplier_ExtremeLower`, `ATRMultiplier_UltraExtremeLower`). In the Python implementation, these use the same values as the upper bands (symmetric), but the configuration supports asymmetric multipliers if needed in the future.

**HRMA Period note**: The original MQL5 default was `HRMAPeriod = 72`. This has been changed to `HRMAPeriod = 54` (`input int HRMAPeriod = 54;`) for greater responsiveness when used at higher timeframes (H4, H8). At H4, each bar represents 4 hours, so a 54-period HRMA covers approximately 9 days of price data — sufficient for smooth trend tracking while remaining responsive to sentiment shifts.

---

## Appendix B: Real-World Validation — BTCUSD Feb 2026

The following real-world scenario from BTCUSD (January-February 2026) validates the sentiment gate design:

**Chart: BTCUSD H4 with 10-band Keltner Channel**

**Scenario 1 — First breakout with pullback (yellow area):**

- Price broke through a support trendline (drawn from H1) around 69,000-70,000
- At the time of breakout, price was trading between Keltner bands 5 and 6 (near the center)
- Keltner band position: ~5-6 → Sentiment Zone: **NORMAL_PULLBACK** (pullback is likely)
- State machine action: `quality_sufficient → AWAITING_PULLBACK`
- Result: Pullback occurred as expected. Price retraced to the broken trendline zone, tested it as resistance, and confirmed the breakout. Standard pullback-confirmation flow completed successfully.

**Scenario 2 — Second breakout without deep pullback (blue area):**

- After the pullback completed, price resumed its upward move and broke through a higher trendline around 71,000-72,000
- At the time of this second breakout, price was trading between Keltner bands 3 and 4 (strong bullish deviation from mean)
- Keltner band position: ~3-4 → Sentiment Zone: **MOMENTUM_CONFIRMED** (pullback is unlikely)
- State machine action (with sentiment gate): `momentum_confirmed → generate advisory immediately → IDLE`
- Result: Price continued upward or moved sideways without a deep pullback to the broken trendline. The sentiment gate correctly identified that strong bullish momentum made a traditional pullback entry impractical.

**Without the sentiment gate (current design)**: The state machine would have entered `AWAITING_PULLBACK` for the second breakout, waited 8-12 bars for a pullback that was structurally unlikely given the strong momentum, then transitioned to `MISSED`. The valid trade opportunity would have been lost.

**With the sentiment gate**: The system recognizes the strong momentum, generates an immediate advisory, and correctly defers precise entry price determination to a separate workflow designed for momentum entries.

---

_End of Keltner Channel Sentiment Gate Modification — Version 1.0_
