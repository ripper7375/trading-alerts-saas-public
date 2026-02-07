# Agentic AI Trading Model — Architecture Design Blueprint

**Document Type:** Architecture Reference for Agentic RAG System  
**Version:** 2.1  
**Purpose:** Definitive specification for implementing the multi-timeframe trading workflow as an AI agentic system within Trading Alerts SaaS  
**Scope:** Covers the complete pipeline from market structure assessment through trade entry execution, including the indicator system definitions, decision logic, state machine design, and LLM-based judgment principles

---

## 1. Foundational Architecture

### 1.1 The 2-3-2 Timeframe Model

The trading system operates on a **2-3-2 layered architecture** where each layer serves a distinct cognitive function. The number refers to how many timeframes participate in each layer. This architecture is designed to be short enough to avoid signal decay and pipeline latency while comprehensive enough to capture structural context, make informed decisions, and execute with precision.

**Navigation Layer (2 timeframes) — The Compass**

The Navigation Layer establishes macro structural context. It answers one question: _"What is the dominant directional regime, and would a trade in the intended direction be with-trend or counter-trend?"_

This layer is **read-only for trade entry** — it informs directional bias and confidence weighting but never triggers entries on its own. Its outputs are consumed by the Decision Layer as contextual inputs rather than actionable signals.

The Navigation Layer evaluates trendline slopes, TEMA/HRMA positioning, and momentum candle characteristics across two higher timeframes to produce an **aggregate regime classification** and a **counter-trend flag** if the intended trade direction opposes the macro structure.

**Decision Layer (3 timeframes) — The Judge**

The Decision Layer is where the trade entry determination is made. Rather than relying on a single timeframe as a binary gate, the Decision Layer spans three adjacent timeframes to create an **entry zone** with proportional lot allocation. This solves two critical problems: missed trades when price doesn't reach the exact single-timeframe level, and poor fill quality when price only briefly touches a single level before reversing.

The three Decision timeframes work together as a zone: the upper timeframe identifies the widest structural context for the entry zone, the primary timeframe generates the core go/no-go signal, and the lower timeframe refines the entry zone's lower boundary. The system can split the total position into multiple smaller lots distributed across S/R levels identified on each of the three timeframes.

The Decision Layer synthesizes all three indicator systems (Trendlines, Momentum Candles, TEMA/HRMA) into a **convergence assessment** using both rule-based criteria and LLM judgment. It produces one of four outputs: ENTER (with zone map and lot allocation), WAIT (setup developing but not confirmed), NO TRADE (insufficient signal quality), or INVALIDATED (disqualifying condition detected).

**Execution Layer (2 timeframes) — The Surgeon**

The Execution Layer handles precision timing and optimal entry price. Once the Decision Layer produces an ENTER signal with a defined zone, the Execution Layer narrows the entry window to minimize adverse excursion. It answers: _"At what exact price and moment within the approved zone should each lot be placed?"_

The Execution Layer uses two lower timeframes to identify micro-structure support/resistance touches and optimal fill points within the Decision Layer's approved zone.

### 1.2 Configurable Timeframe Mapping

The 2-3-2 skeleton is fixed, but the specific timeframes assigned to each slot are **configurable per instrument and per user preference**. The system supports two primary configurations aligned with the target user base (day-traders and swing-traders):

**Configuration A — H1 Primary Decision Timeframe**

| Layer      | Role    | Timeframes  |
| ---------- | ------- | ----------- |
| Navigation | Compass | H4, H2      |
| Decision   | Judge   | H2, H1, M30 |
| Execution  | Surgeon | M15, M5     |

Best suited for: Day-trading, shorter swing trades, instruments with high intraday volatility.

Note: H2 appears in both Navigation and Decision. In Navigation, H2 is evaluated for its contribution to macro regime classification (trendline slope, overall direction). In Decision, H2 is evaluated for its specific S/R levels and entry zone boundaries. The same data is read twice through different analytical lenses.

**Configuration B — H2 Primary Decision Timeframe**

| Layer      | Role    | Timeframes |
| ---------- | ------- | ---------- |
| Navigation | Compass | H8, H4     |
| Decision   | Judge   | H4, H2, H1 |
| Execution  | Surgeon | M30, M15   |

Best suited for: Swing trading, multi-day holds, instruments with slower price development cycles.

Note: H4 serves the same dual role here as H2 does in Configuration A.

**Instrument-Specific Defaults**

Different instruments exhibit different volatility characteristics and price development speeds. The system should provide sensible defaults while allowing user override:

| Instrument Category            | Suggested Default                            | Rationale                                            |
| ------------------------------ | -------------------------------------------- | ---------------------------------------------------- |
| Crypto majors (BTCUSD, ETHUSD) | Config A (H1 primary)                        | High intraday volatility, frequent structural breaks |
| Forex majors (EURUSD, GBPUSD)  | Config A or B depending on volatility regime | Moderate volatility, session-dependent               |
| Gold (XAUUSD)                  | Config B (H2 primary)                        | Smoother intraday dynamics, longer swing cycles      |
| Forex crosses, crypto altcoins | Config A (H1 primary)                        | Higher relative volatility, more noise on lower TFs  |

---

## 2. Indicator System Specifications

### 2.1 Fractal Trendline System (Fractal Horizontal Line V5)

**Computation:** The indicator identifies fractal pivot points using two sensitivity levels — a major fractal (default 35-bar) for large structural pivots and a minor fractal (default 13-bar) for finer structure. It constructs multi-point trendlines by connecting fractal highs (peak lines, red) and fractal lows (bottom lines, green). A scoring algorithm ranks candidate trendlines using four weighted factors:

| Factor                     | Weight | Purpose                                         |
| -------------------------- | ------ | ----------------------------------------------- |
| Fractal touches            | 25%    | More touches = stronger structural significance |
| Slope angle                | 15%    | Moderate slopes preferred over extreme angles   |
| Line length (bars)         | 10%    | Longer lines = more established structure       |
| Proximity to current price | 50%    | Nearest lines are most immediately actionable   |

**Key parameters:**

| Parameter          | Default | Function                                             |
| ------------------ | ------- | ---------------------------------------------------- |
| Major fractal bars | 35      | Large-structure pivot detection                      |
| Minor fractal bars | 13      | Fine-structure pivot detection                       |
| Min fractal touch  | 3       | Minimum contact points for trendline validity        |
| Tolerance type     | Percent | How the interaction zone is calculated               |
| Tolerance value    | 1.5%    | Width of the interaction zone around each trendline  |
| Lookback bars      | 400     | Historical range for trendline construction          |
| Extension bars     | 100     | Forward projection length                            |
| Max peak lines     | 3       | Maximum simultaneous resistance trendlines displayed |
| Max bottom lines   | 3       | Maximum simultaneous support trendlines displayed    |

**Interpretation for the agentic system:**

Red trendlines represent resistance — price approaching from below faces selling pressure. Green trendlines represent support — price approaching from above finds buying interest. The **trendline slope** is a primary input for regime classification: descending red lines above price indicate bearish structural pressure; ascending green lines below price indicate bullish structural support. The slope angle (in degrees) is directly usable as a numerical feature for the regime scoring system.

The **tolerance zone** (1.5% band around each trendline) defines the interaction region where price is considered "at the trendline." This is critical for the agentic system — trendline evaluation should use **fuzzy logic** based on distance-to-trendline as a continuous percentage value, not a binary above/below determination. A price that is 0.3% from a trendline is more meaningfully "at" the trendline than one that is 1.4% away, even though both fall within the tolerance zone.

**Trendline role reversal principle:** When price breaks through a trendline, the line's function reverses. Broken resistance (red) becomes support; broken support (green) becomes resistance. This role reversal is the foundation of the breakout + pullback confirmation strategy. The agentic system must track trendline state transitions (intact → broken → role-reversed → retested → confirmed/failed).

### 2.2 Body Size Momentum Candle System (V2)

**Computation:** For each candle, the indicator calculates the absolute body size (|Close - Open|), then computes a Z-Score against a 432-period rolling window of body sizes. The Z-Score measures how many standard deviations the current candle's body is from the historical mean. Candles are classified into six categories:

| Z-Score         | Bullish (Close ≥ Open)    | Bearish (Close < Open)    |
| --------------- | ------------------------- | ------------------------- |
| < 1.5           | Normal (no color overlay) | Normal (no color overlay) |
| ≥ 1.5 and < 2.5 | Large (Light Green)       | Large (Hot Pink)          |
| ≥ 2.5           | Extreme (Dark Green)      | Extreme (Dark Red)        |

**Key parameter:** Z-Score MA Length = 432 bars. This is the lookback window for calculating the mean and standard deviation of body sizes. The 432-period window provides approximately 18 days of context on H1, or 54 days on M15, which captures a meaningful statistical sample across different market conditions.

**Interpretation framework — Invigorated vs. Exhausting:**

The same momentum candle has completely different implications depending on its **context** — where it appears within the price structure, what preceded it, and what follows it. This contextual interpretation is one of the primary areas where LLM judgment is essential because the classification cannot be reduced to a simple rule set.

**Invigorated momentum** — The momentum candle represents genuine directional force likely to continue:

- Appears early in a move (within the first few candles after a structural break)
- Body size is increasing relative to recent candles (acceleration)
- Subsequent candles maintain or grow in body size
- TEMA/HRMA gap is widening in the direction of the candle
- The candle breaks through or away from a trendline with conviction

**Exhausting momentum** — The momentum candle represents a climactic thrust likely to reverse or stall:

- Appears after an extended run (many consecutive candles in the same direction)
- Represents the largest body in the sequence (climactic expansion)
- Followed by immediately smaller bodies, doji candles, or reversal candles
- TEMA/HRMA gap has been wide and is beginning to narrow
- The candle arrives at a significant higher-timeframe S/R level after a long approach

**Critical principle for pullback evaluation:** During a pullback to a S/R level, momentum candles of _either_ direction can be valid. A bearish momentum candle hitting a support zone and failing to break it is not a disqualifying signal — it is potentially a **spring/shakeout** pattern where sellers exhausted their force against the level. The relevant question is not "what color was the momentum candle?" but "did price actively reject from the level and bounce back toward the prior high/low within a reasonable time window?" Simply not breaking the level is insufficient — price that passively sits on support without bouncing is susceptible to eventual breakdown. True confirmation requires active rejection: price tests the level, demonstrates visible bounce force (rising candles moving away from the level), and resumes directional movement toward the prior swing high/low. This principle means the agentic system should NOT automatically invalidate entries when bearish momentum appears during a pullback to support — but it SHOULD require subsequent bullish response demonstrating that buyers actively defended the level, not merely that sellers paused.

### 2.3 TEMA/HRMA Moving Average System

**Computation:**

**TEMA (Triple Exponential Moving Average)** — Period 9, applied to typical price ((H+L+C)/3). Formula: 3×EMA(9) - 3×EMA(EMA(9)) + EMA(EMA(EMA(9))). This is the fast line (displayed in gray/silver). TEMA has very low lag relative to its smoothing — it tracks price closely while filtering minor noise.

**HRMA (Hull-like RMA)** — Period 18, applied to typical price. Uses a hybrid approach: two EMAs with periods len/2 (=9) and len (=18) are blended as 2×RMA1 - RMA2, then smoothed with a third EMA using period √len (≈4.24). This is the slow line (displayed in blue/cyan). HRMA provides smoothed trend direction with moderate lag.

**Additional lines computed but not actively displayed:**

- SMA (Period 2) — effectively a pass-through, not used for trading signals
- SMMA (Period 36) — smoothed moving average, available as supplementary data

**Key parameter reference:**

| Line | Period | Applied Price | Display     | Role                            |
| ---- | ------ | ------------- | ----------- | ------------------------------- |
| TEMA | 9      | Typical       | Gray/Silver | Fast trend tracker              |
| HRMA | 18     | Typical       | Blue/Cyan   | Slow trend baseline             |
| SMA  | 2      | Typical       | Hidden      | Calculation intermediate        |
| SMMA | 36     | Typical       | Hidden      | Available for extended analysis |

**Interpretation — The Gap Analysis:**

The primary analytical output is the **gap between TEMA and HRMA** — its direction, width, and rate of change. This gap functions as a real-time momentum and trend-state gauge:

| Gap State         | TEMA Position            | Gap Trend | Interpretation                                 |
| ----------------- | ------------------------ | --------- | ---------------------------------------------- |
| Wide bullish      | TEMA above HRMA          | Widening  | Strong bullish momentum, trend accelerating    |
| Narrow bullish    | TEMA above HRMA          | Narrowing | Bullish momentum fading, potential transition  |
| Crossover bullish | TEMA crossing above HRMA | N/A       | Trend state transition from bearish to bullish |
| Intertwined       | TEMA ≈ HRMA              | Flat      | Ranging/consolidation, no directional edge     |
| Crossover bearish | TEMA crossing below HRMA | N/A       | Trend state transition from bullish to bearish |
| Narrow bearish    | TEMA below HRMA          | Narrowing | Bearish momentum fading, potential transition  |
| Wide bearish      | TEMA below HRMA          | Widening  | Strong bearish momentum, trend accelerating    |

**Critical nuance for pullback evaluation:** During a pullback, TEMA will naturally converge toward or cross below HRMA on the lower timeframes. This is expected behavior, not a disqualifying signal. On the Decision and Execution timeframes, the TEMA/HRMA relationship during a pullback should be interpreted with the understanding that a healthy pullback temporarily disrupts the fast line without invalidating the trend structure. The relevant evaluation is whether the _primary Decision timeframe's_ TEMA/HRMA relationship remains constructive (TEMA holds above HRMA or quickly recrosses above), not whether every lower timeframe maintains perfect alignment throughout the pullback.

---

## 3. Core Trading Strategy: Breakout + Pullback Confirmation

### 3.1 Strategy Definition

The primary entry strategy is **breakout of a trendline followed by pullback confirmation** (also called throwback for resistance breaks, pullback for support breaks). This is a two-phase process where Phase A (breakout) generates the signal and Phase B (pullback) confirms the signal's validity by testing whether the trendline has genuinely changed its structural role.

**Phase A — Breakout Detection**

A breakout occurs when price crosses through a trendline and closes beyond it. For a long entry, this means a candle body closing above a red (resistance) trendline. For a short entry, a candle body closing below a green (support) trendline.

Breakout quality assessment factors (evaluated as a holistic picture, not as binary pass/fail checkboxes):

- **Body close beyond the trendline** — The candle body (not just the wick) should close on the new side of the trendline. A wick-only penetration is a weaker signal.
- **Momentum context** — Is there momentum (Large/Extreme candle) on or near the breakout bar? Momentum adds conviction but is not mandatory — breakouts on normal-sized candles are valid if other factors support them.
- **TEMA/HRMA state** — Is the TEMA/HRMA relationship supporting the breakout direction? A TEMA cross in the breakout direction strengthens the signal. However, TEMA may lag the breakout by 1-3 bars, so the cross may confirm after the breakout rather than simultaneously.
- **Navigation Layer alignment** — Is the breakout with-trend or counter-trend relative to the macro regime? With-trend breakouts have higher base probability of success.

**Phase B — Pullback Confirmation**

After the breakout, price retraces toward the broken trendline. The previously broken trendline should now function in its reversed role (broken resistance becomes support, broken support becomes resistance).

Pullback confirmation assessment (principle-based, not rule-based):

- **Price returns to the trendline zone** — Price enters the tolerance zone of the broken trendline from the new side. The pullback doesn't need to touch the trendline exactly; reaching the tolerance zone is sufficient.
- **The level holds AND price actively bounces back** — This is the core confirmation criterion, and it has two mandatory components. First, the level must not break (price does not close decisively through the trendline on the wrong side). Second — and equally important — price must **actively bounce away from the level and resume movement toward the prior swing high/low** within a reasonable time window. Passive holding (price lingering at the level without directional resumption) is NOT confirmation. Price that sits on support without bouncing is exhibiting absorption behavior — buyers are present enough to prevent a break but not dominant enough to drive a reversal — and is susceptible to eventual breakdown as selling pressure accumulates. Genuine confirmation looks like: price touches the zone, forms 1-3 candles at or near the level, then produces rising candles that move decisively away from the level back toward the breakout direction. The time window for this bounce should be proportional to the Decision timeframe — roughly 3-8 bars on the primary Decision TF. If price has been sitting on the level for longer than this without bouncing, the setup is weakening and the LLM should downgrade confidence or transition to WAIT.
- **Momentum during pullback is contextual** — There is no requirement for a specific momentum candle type during pullback on the Decision timeframes. Normal-sized candles drifting back to the trendline represent a healthy, orderly pullback. If momentum candles do appear at the pullback level, they should be interpreted as follows:
  - _Bullish momentum candle at support_ = buyers stepping in aggressively = strong confirmation, especially if it immediately drives price back toward the prior high/low
  - _Bearish momentum candle at support that fails to break the level AND is followed by a bullish bounce_ = exhausting seller force followed by active buyer response = strong confirmation (spring/shakeout pattern — but the bounce must materialize, not just the hold)
  - _Bearish momentum candle at support with no subsequent bounce_ = sellers testing the level and buyers not responding with force = weakening setup, increase caution — passive absorption without rejection is a precursor to breakdown
  - _Bearish momentum candle that breaks back through the trendline_ = failed breakout = invalidation
- **Time tolerance** — Pullbacks don't happen instantly. The system should allow a reasonable number of bars for the pullback to develop and for the bounce to materialize. If price breaks out and moves strongly in the breakout direction without pulling back, the system transitions to evaluating whether a delayed pullback will occur or whether the entry opportunity has been missed (in which case, no entry is taken and the system resets). Conversely, if price pulls back to the level but then stalls without bouncing for an extended period, the system should recognize this as deteriorating confirmation quality — the longer price lingers at the level without bouncing, the higher the probability of eventual breakdown.

**Why two phases:** Phase A alone generates many false signals (fakeouts). The market frequently pokes through trendlines to trigger stops or test liquidity before reversing. Phase B filters these false breakouts by requiring the market to "prove" that the new price level is accepted — and proof requires not just passive survival but **active rejection and directional resumption**. If the broken resistance holds as new support on the pullback and price bounces back toward the breakout direction, the breakout is legitimate. If price merely sits at the level without bouncing, the jury is still out — the level hasn't been proven, only tested. If price falls back through, the breakout was false and capital is preserved.

### 3.2 Split-Lot Zone Entry Model

Rather than placing the entire position at a single price point, the Decision Layer produces an **entry zone** spanning S/R levels from the three Decision timeframes, and the total position is distributed across those levels using a pyramid allocation approach.

#### 3.2.1 Timeframe-Agnostic S/R Collection

A critical design principle: **S/R levels from different timeframes do not follow a predictable price ordering**. An M30 ascending trendline may sit above an H1 horizontal support, which may sit above an H2 descending trendline's current projection. The trendline geometry — slope, intercept, and projection at the current bar — determines the price level, not the timeframe hierarchy.

The system collects all relevant S/R levels from all three Decision timeframes without assuming any ordering. Each level is tagged with its source timeframe and structural properties but treated as a member of a unified pool.

#### 3.2.2 Proximity Clustering into S/R Zones

Once all S/R levels are collected, the system groups them by **proximity** into clusters that form a single S/R Zone. Levels that are close together (within a configurable proximity threshold, e.g., 1.5-2.0% of price) are treated as a single zone that will either hold or break as a unit.

**Clustering procedure:**

1. Collect all S/R levels from the three Decision timeframes (may include multiple trendlines per TF — for example, H1 might contribute 4 support trendlines while H2 contributes 1).

2. Sort all collected levels by price.

3. Group levels into clusters where the distance between adjacent levels is within the proximity threshold. A gap larger than the threshold creates a separate cluster.

4. For each cluster, compute the **zone boundaries** (highest and lowest level in the cluster) and the **zone midpoint**.

5. If all levels fall within a single cluster, the entry zone is that one unified zone. If levels separate into multiple clusters, the system evaluates whether to use the cluster nearest to the breakout level (most relevant) or treat the clusters as independent zones (rare — typically indicates the S/R levels are structurally unrelated).

**Example (illustrative):**

Suppose a hypothetical XAUUSD long setup produces these S/R levels across the Decision timeframes:

- H2: 1 trendline at 1,838.50
- H1: 4 trendlines at 1,835.00, 1,836.20, 1,837.00, 1,837.80
- M30: 1 trendline at 1,834.00

All six levels fall within a ~4.50 range (1,834.00 – 1,838.50), which at a price of ~1,840 is approximately 0.24% — well within the proximity threshold. They form a single cluster, creating an entry zone of 1,834.00 – 1,838.50 with 6 structural support points.

#### 3.2.3 Structural Density Weighting

Not all S/R levels within a zone carry equal structural weight. A level backed by 4 converging trendlines from H1 has more structural significance than a level backed by a single trendline from H2 or M30. The system assigns a **structural density score** to each level and to the zone as a whole.

**Density scoring factors:**

| Factor                                          | Score Contribution                                                         | Rationale                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Number of trendlines at/near the level          | +1 per trendline within 0.3% of each other                                 | Multiple trendlines converging = stronger structural significance |
| Trendline touch count (from Fractal V5 scoring) | Weighted by touches                                                        | More fractal touches = more market-validated level                |
| Timeframe of origin                             | Higher TF trendlines weighted more heavily (H2: 1.5x, H1: 1.0x, M30: 0.7x) | Higher TF structure is more structurally significant              |
| Trendline status (intact vs. recently broken)   | Broken trendlines excluded or heavily penalized                            | A broken level provides no structural support                     |

**Zone-level density score** = sum of all individual level density scores within the cluster. A zone with density score of 8+ (e.g., 4 H1 trendlines + 1 H2 + 1 M30, all intact) is structurally robust. A zone with density score of 2 (e.g., 1 H2 trendline + 1 broken M30) is structurally fragile.

**Density impact on lot sizing:** The total position size allocated to the zone should be modulated by the zone's density score. A structurally dense zone justifies full position allocation. A structurally thin zone should trigger reduced total allocation (e.g., 60-80% of normal size) because the structural basis for the trade is weaker. This is a risk management lever — market risk is uncontrollable, but exposure relative to structural quality is controllable.

**Dynamic density degradation:** If a level within the zone breaks during the pullback test (e.g., the M30 trendline is pierced and broken), the system must recalculate the zone's density score in real-time, removing the broken level. If the recalculated density falls below a minimum threshold (configurable, e.g., density < 3), the zone is considered too thin and the trade should be downgraded to WAIT or cancelled.

#### 3.2.4 Pyramid Lot Allocation

Within the S/R Zone, lots are allocated using a **pyramid approach** — smaller lots first (at the shallowest pullback levels), progressively larger lots deeper into the zone. This optimizes risk management: if the zone fails entirely, the majority of exposure was at the deepest levels that were never reached, limiting actual loss. If the zone holds and bounces, the larger lots at deeper levels provide a better weighted average entry.

**Pyramid allocation model:**

Given N levels within the zone, ordered from shallowest pullback (first to be reached) to deepest pullback (best price if reached):

| Level Position             | Allocation Weight                        | Rationale                                                                        |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| Shallowest (first reached) | Smallest lot (e.g., 15-20% of total)     | Most likely to fill, but highest entry price; limits exposure if zone fails      |
| Mid-zone levels            | Progressive increase (e.g., 20-30% each) | Intermediate probability and price                                               |
| Deepest (best price)       | Largest lot (e.g., 30-40% of total)      | Best price if reached; if zone fails before reaching this, exposure is minimized |

**Alternative: Even allocation** — If the zone is narrow (all levels within <0.5% of price), the difference between pyramid and even allocation is minimal. In tight zones, even allocation (equal lot size per level) is simpler and acceptable. The pyramid approach provides the most benefit when the zone is wider (0.5-2.0% of price).

**The user should be able to configure** which allocation model to use (pyramid vs. even) and the specific weight distribution within the pyramid.

**Example (illustrative, continuing from above):**

Zone: 1,834.00 – 1,838.50 with 6 structural levels. Using pyramid allocation:

| Level           | Price    | Source        | Lot % | Order                   |
| --------------- | -------- | ------------- | ----- | ----------------------- |
| L1 (shallowest) | 1,838.50 | H2 trendline  | 10%   | Limit buy, placed first |
| L2              | 1,837.80 | H1 trendline  | 12%   | Limit buy               |
| L3              | 1,837.00 | H1 trendline  | 15%   | Limit buy               |
| L4              | 1,836.20 | H1 trendline  | 18%   | Limit buy               |
| L5              | 1,835.00 | H1 trendline  | 20%   | Limit buy               |
| L6 (deepest)    | 1,834.00 | M30 trendline | 25%   | Limit buy               |

If price pulls back to 1,837.00 and bounces (L1, L2, L3 filled = 37% of total position), the entry is partial but capital risk is controlled. If price pulls all the way to 1,834.00 before bouncing, 100% fills at a weighted average of approximately 1,835.80 — significantly better than entering 100% at the first touch of 1,838.50.

### 3.3 Price Pattern Confirmation at S/R Zones

Beyond trendline structure, momentum candles, and TEMA/HRMA analysis, **price patterns forming at the S/R Zone** provide an additional layer of confirmation that the zone is likely to hold and produce an active bounce.

#### 3.3.1 Recognized Patterns

The following price patterns, when forming at or within an S/R Zone, increase confidence that the zone will reject price and produce directional resumption:

**Double Bottom (for long entries) / Double Top (for short entries)**

The most directly relevant pattern. Price tests the S/R Zone, bounces partially, then returns to test the zone a second time at approximately the same level. The second test failing to break through the zone is strong evidence that the level has absorbed all available selling pressure and buyers are in control. The "W" shape (double bottom) or "M" shape (double top) is a classic reversal pattern that directly validates the zone's structural integrity.

Key characteristics:

- The two lows (for double bottom) should be at approximately the same price level (within 0.5% of each other), ideally within the S/R Zone
- The bounce between the two tests (the middle peak of the "W") demonstrates that buyers are present and capable of driving price away from the zone
- The second test that holds is stronger confirmation than the first test, because it proves the zone survived repeated pressure
- The neckline (the middle peak) becomes a breakout trigger — price closing above it after the second test confirms the pattern

**Higher Low at the Zone (for longs) / Lower High at the Zone (for shorts)**

A variation where the second test doesn't reach as deep as the first test — the pullback makes a higher low within the zone. This is actually stronger than a double bottom because it shows diminishing selling force. Each successive test generates less downward penetration, indicating sellers are progressively weakening.

**Hammer / Pin Bar Rejection at the Zone**

A single-candle pattern where price probes deep into the zone (long lower wick) but closes well above the zone boundary. This demonstrates aggressive buying at the zone level within a single bar — a compressed version of the test-and-bounce sequence. Multiple hammer candles at the zone compound the signal.

**Bullish Engulfing at the Zone (for longs)**

A two-candle pattern where a bearish candle at the zone is immediately followed by a larger bullish candle that engulfs the prior candle's body. This represents sellers testing the zone followed by an overwhelming buyer response — a micro-level version of the spring/shakeout followed by bounce pattern.

#### 3.3.2 Price Pattern as Convergence Factor

Price patterns at the S/R Zone are integrated into the convergence assessment as the **fifth scoring factor**. This expands the convergence score from four factors to five.

| Factor                        | +2                                                                                                              | +1                                                                                                                                | 0                                                                                         | -1                                                                                                                          | -2                                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Price Pattern at S/R Zone** | Completed double bottom/top with neckline break; or higher low/lower high confirming diminishing opposing force | Developing double bottom/top (second test in progress); or hammer/pin bar rejection at zone; or bullish/bearish engulfing at zone | No recognizable price pattern at zone (neutral — not all setups produce classic patterns) | Price pattern forming that suggests zone weakness (e.g., each test penetrates deeper into the zone — lower lows at support) | Completed reversal pattern against the trade direction at the zone (e.g., double top forming at support for a long trade — buyers tested the ceiling twice and failed) |

**Updated convergence score:**

Raw score range is now -10 to +10 (five factors × -2 to +2 each).

Adjusted thresholds (recalibrated for the expanded score range):

| Adjusted Score | Decision                                            |
| -------------- | --------------------------------------------------- |
| ≥ +5.0         | ENTER — sufficient convergence for trade entry      |
| +2.5 to +4.9   | WAIT — setup is developing, monitor for improvement |
| -2.4 to +2.4   | NO TRADE — insufficient signal quality              |
| ≤ -2.5         | NO TRADE — active counter-signals present           |

**Important:** A price pattern score of 0 (no recognizable pattern) is the most common outcome and is intentionally neutral. Not all valid setups produce textbook chart patterns. The Price Pattern factor is a **bonus confirmation** when present, not a requirement. A setup with Trendline: +2, Momentum: +1, TEMA/HRMA: +1, Navigation: +1, Price Pattern: 0 = score of +5.0, which meets the ENTER threshold. The price pattern doesn't need to contribute for the trade to be valid.

---

## 4. Navigation Layer — Detailed Specification

### 4.1 Purpose and Constraints

The Navigation Layer produces exactly two outputs consumed by the Decision Layer:

1. **Aggregate Regime Classification** — A directional label (Strong Bearish, Bearish, Neutral, Bullish, Strong Bullish) derived from trendline slope analysis across both navigation timeframes.
2. **Counter-Trend Flag** — A boolean indicating whether the intended trade direction opposes the aggregate regime, plus a confidence modifier that adjusts the Decision Layer's entry threshold.

The Navigation Layer does NOT produce entry signals, target levels, or timing information. It is a contextual input, not a decision engine.

### 4.2 Aggregate Regime Classification via Trendline Slope Scoring

Rather than subjectively labeling the regime from a single timeframe, the system computes a numerical **Aggregate Slope Score** by averaging the slope characteristics of active trendlines across both Navigation timeframes.

**Procedure:**

1. For each Navigation timeframe, retrieve the top-ranked trendlines (by the Fractal V5 scoring system). Typically the top 1-2 peak (red/resistance) lines and top 1-2 bottom (green/support) lines.

2. For each trendline, extract the **slope angle in degrees**. The Fractal V5 indicator computes this — descending trendlines have negative angles, ascending trendlines have positive angles.

3. Compute the **Net Slope** for each timeframe: average the slopes of the resistance trendlines and the support trendlines. If both sets of trendlines are descending, the Net Slope is negative. If both are ascending, it's positive. If they diverge (one ascending, one descending), they partially cancel, producing a near-zero Net Slope (ranging).

4. Compute the **Aggregate Slope Score** as the weighted average of Net Slopes across both Navigation timeframes, with the higher timeframe weighted more heavily (e.g., 60/40 split) since it represents more structural significance.

5. Map the Aggregate Slope Score to a regime label:

| Aggregate Slope Score | Regime Label      |
| --------------------- | ----------------- |
| < -15°                | Strong Bearish    |
| -15° to -5°           | Bearish           |
| -5° to +5°            | Neutral / Ranging |
| +5° to +15°           | Bullish           |
| > +15°                | Strong Bullish    |

These thresholds are starting defaults and should be calibrated per instrument based on historical trendline slope distributions.

**TEMA/HRMA confirmation:** The TEMA/HRMA state on Navigation timeframes provides secondary confirmation. If both Navigation timeframes show TEMA below HRMA with wide gaps, this reinforces a bearish regime classification. If the TEMA/HRMA relationship contradicts the trendline slopes (e.g., slopes are bearish but TEMA is crossing above HRMA), this signals a potential regime transition and the system should note elevated uncertainty.

**Momentum candle context:** Recent momentum candles on Navigation timeframes inform whether the current regime is _accelerating_ (invigorated momentum in the trend direction) or _decelerating_ (exhausting momentum, momentum in the counter-trend direction, or absence of momentum candles after an extended move). Deceleration on Navigation timeframes increases the probability that a counter-trend trade on the Decision timeframes will succeed, because the macro trend is losing force.

### 4.3 Counter-Trend Confidence Modifier

When the intended trade direction opposes the aggregate regime, the system applies a **confidence modifier** that raises the entry threshold in the Decision Layer. This doesn't prohibit the trade — it makes the system demand stronger confirmation before entering.

| Regime vs. Trade Direction                                        | Modifier               | Effect on Decision Layer                                       |
| ----------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| With-trend (e.g., Long when regime is Bullish)                    | 1.0x (no modification) | Standard entry criteria                                        |
| Neutral (e.g., Long when regime is Neutral)                       | 0.9x                   | Slightly elevated criteria                                     |
| Counter-trend (e.g., Long when regime is Bearish)                 | 0.75x                  | Meaningfully elevated criteria                                 |
| Strongly counter-trend (e.g., Long when regime is Strong Bearish) | 0.6x                   | Substantially elevated criteria; trade is tactical bounce only |

The modifier is applied to the convergence score in the Decision Layer (described in Section 5). A lower modifier means a higher raw convergence score is needed to reach the ENTER threshold.

### 4.4 Navigation Layer — LLM Judgment Role

**Where rules apply:** Slope computation, Net Slope averaging, Aggregate Slope Score thresholds, counter-trend flag derivation — these are deterministic calculations that the system performs algorithmically.

**Where LLM judgment applies:**

- **Regime transition detection:** When the Aggregate Slope Score is near a threshold boundary (e.g., -6° — technically Bearish but close to Neutral), the LLM should evaluate qualitative factors that the slope score alone doesn't capture. Are new trendlines forming that suggest structural change? Has the slope been trending toward Neutral over recent evaluations? Is there a divergence between trendline slopes and TEMA/HRMA behavior?

- **Momentum contextualization:** Determining whether momentum candles on Navigation timeframes represent invigorated or exhausting force requires contextual judgment that cannot be fully captured by rules. The LLM evaluates the sequence of momentum candles, their position within the price structure, and the broader pattern of body size evolution.

- **Anomaly handling:** If the Navigation timeframes show contradictory signals (e.g., upper Navigation TF is strongly bearish while lower Navigation TF is transitioning bullish), the LLM synthesizes the conflicting information and determines whether this represents noise, a genuine transition, or a temporary counter-trend move within the larger trend.

---

## 5. Decision Layer — Detailed Specification

### 5.1 Purpose and Outputs

The Decision Layer is the core engine of the trading system. It processes inputs from the Navigation Layer (regime classification, counter-trend modifier) combined with its own three-timeframe analysis to produce a trade decision.

**Outputs:**

| Output      | Description                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| ENTER       | Trade setup confirmed. Includes entry zone map, lot allocation weights, and confidence level.                           |
| WAIT        | Setup is developing but not yet confirmed. Includes which conditions are pending.                                       |
| NO TRADE    | Insufficient signal quality. Includes brief reason (e.g., "no breakout detected", "convergence score below threshold"). |
| INVALIDATED | A disqualifying condition was detected after a prior WAIT or ENTER-pending state. Resets the state machine.             |

### 5.2 Three-Timeframe Analysis Procedure

The Decision Layer evaluates three timeframes in parallel (not sequentially) to construct the entry zone and assess signal quality.

**For each of the three Decision timeframes, evaluate:**

1. **Trendline map** — Identify all active red (resistance) and green (support) trendlines. Determine price's position relative to each. Identify any trendlines that have been recently broken (role reversal candidates). Calculate distance-to-nearest-trendline as a continuous percentage.

2. **Breakout status** — Has price broken above a resistance trendline (for longs) or below a support trendline (for shorts) on this timeframe? If yes, has a pullback occurred? What is the pullback's status (not started, in progress, at the trendline zone, bounced)?

3. **Momentum candle assessment** — Are there Large or Extreme candles near the key trendlines? What is their directional context (invigorated vs. exhausting)? Are they supporting or contradicting the intended trade direction?

4. **TEMA/HRMA state** — What is the gap state (from the table in Section 2.3)? Is TEMA above, crossing, or below HRMA? What is the gap's rate of change?

5. **S/R level identification** — What is the most significant S/R level on this timeframe that would serve as an entry point if the trade is taken? This feeds the zone construction.

### 5.3 Convergence Assessment — Hybrid Rule + LLM Approach

The convergence assessment combines quantifiable rule-based scoring with LLM judgment for factors that resist quantification.

**Rule-based convergence score (computed algorithmically):**

Each factor is scored on a scale from -2 to +2 for a long trade (reverse for short):

| Factor                              | +2                                                                                                              | +1                                                                                                                          | 0                                                                                                      | -1                                                                                                            | -2                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Trendline**                       | Price above broken resistance, pullback confirmed with active bounce back toward prior high                     | Price above broken resistance, pullback in progress or at level (bounce not yet confirmed)                                  | Price at resistance, no breakout yet                                                                   | Price below resistance, no breakout                                                                           | Price broke above then fell back (failed breakout)         |
| **Momentum**                        | Extreme bullish candle at key level, or exhausting bearish candle followed by strong bullish bounce             | Large bullish candle at key level, or exhausting bearish candle at support (bounce pending)                                 | No significant momentum candles near key levels                                                        | Large bearish candle away from support, or bearish momentum at support with no subsequent bounce (absorption) | Extreme bearish candle breaking through support            |
| **TEMA/HRMA (Primary Decision TF)** | TEMA above HRMA, gap widening                                                                                   | TEMA crossing above HRMA, or above with stable gap                                                                          | TEMA and HRMA intertwined/flat                                                                         | TEMA crossing below HRMA                                                                                      | TEMA below HRMA, gap widening                              |
| **Navigation Regime**               | With-trend (regime matches trade direction)                                                                     | Neutral regime                                                                                                              | Counter-trend but showing deceleration                                                                 | Counter-trend, regime intact                                                                                  | Strongly counter-trend, regime accelerating                |
| **Price Pattern at S/R Zone**       | Completed double bottom/top with neckline break; or higher low/lower high confirming diminishing opposing force | Developing double bottom/top (second test in progress); hammer/pin bar rejection at zone; bullish/bearish engulfing at zone | No recognizable price pattern at zone (neutral — most common; not all setups produce classic patterns) | Pattern suggests zone weakness (each successive test penetrates deeper — lower lows at support)               | Completed reversal pattern against trade direction at zone |

**Raw convergence score** = sum of the five factors, range -10 to +10.

**Adjusted convergence score** = Raw score × Counter-trend modifier (from Section 4.3).

**Rule-based thresholds (defaults, recalibrated for 5-factor scoring):**

| Adjusted Score | Decision                                            |
| -------------- | --------------------------------------------------- |
| ≥ +5.0         | ENTER — sufficient convergence for trade entry      |
| +2.5 to +4.9   | WAIT — setup is developing, monitor for improvement |
| -2.4 to +2.4   | NO TRADE — insufficient signal quality              |
| ≤ -2.5         | NO TRADE — active counter-signals present           |

**Note on the Price Pattern factor:** A score of 0 (no recognizable pattern) is the most common outcome and is intentionally neutral. Not all valid setups produce textbook chart patterns. The Price Pattern factor is a **bonus confirmation** when present, not a requirement. A setup with Trendline: +2, Momentum: +1, TEMA/HRMA: +1, Navigation: +1, Price Pattern: 0 = +5.0, which meets the ENTER threshold without any price pattern contribution.

**LLM judgment overlay:**

The rule-based score provides a starting point, but several situations require LLM discretion to override or adjust the score:

**Score is near the ENTER threshold (e.g., +4.0 to +6.0):**
The LLM evaluates qualitative factors that the scoring system doesn't fully capture. For example: Is the breakout candle clean with a full body beyond the trendline, or messy with a long wick? Is the pullback orderly (normal-sized candles drifting back) or chaotic (rapid volatile swings back and forth)? Has the bounce from the pullback level been decisive (strong candles moving away from the level toward the prior high/low) or tentative (small candles barely lifting off the level)? Are the three Decision timeframes showing the same structural story, or is one of them telling a different narrative? How dense is the S/R Zone — does it have strong structural backing from multiple converging trendlines, or is it resting on thin structure? The LLM can push a +4.0 to ENTER if the qualitative picture is exceptionally clean — particularly if the bounce is sharp and decisive with a structurally dense zone. Conversely, the LLM should hold a +6.0 at WAIT if the pullback has reached the level but the bounce is weak or nonexistent (absorption behavior rather than active rejection), or if the zone's structural density is concerning.

**Conflicting signals across Decision timeframes:**
When the three Decision timeframes show different breakout statuses (e.g., primary TF shows breakout confirmed, upper TF shows still below resistance, lower TF shows pullback in progress), the LLM weighs the relative importance and determines whether the setup is valid or whether the conflicting signals represent genuine uncertainty.

**Unusual market conditions:**
During high-impact news events, gap openings, or anomalous volatility spikes, the standard scoring system may produce misleading results. The LLM can recognize these conditions and apply appropriate skepticism or patience.

**Exhaustion patterns:**
The difference between an invigorated and exhausting momentum candle is contextual and pattern-dependent. The LLM evaluates the momentum candle within its structural context — where it appears in the move, what preceded it, what the higher-timeframe context suggests — and adjusts the Momentum score accordingly.

### 5.4 Entry Zone Construction

Once the Decision Layer produces an ENTER signal, it constructs the entry zone following the procedure defined in Section 3.2.

**Zone construction summary (see Section 3.2 for full specification):**

1. Collect all relevant S/R levels from all three Decision timeframes — **do not assume any TF-based price ordering**. Tag each level with its source TF, trendline touch count, and structural properties.

2. Sort levels by price and apply **proximity clustering** (Section 3.2.2) to group nearby levels into unified S/R Zones. Levels within 1.5-2.0% of price are treated as a single zone.

3. Compute the **structural density score** (Section 3.2.3) for the zone. If multiple trendlines from the same or different TFs converge on the same price area, the zone is structurally dense and commands higher confidence. If only 1-2 trendlines support the zone, it is structurally thin and warrants reduced position sizing.

4. Apply **pyramid lot allocation** (Section 3.2.4) — smallest lots at the shallowest pullback levels, progressively larger lots deeper into the zone. This controls risk exposure: if the zone fails, the smallest lots are hit first. If the zone holds and bounces, the largest lots fill at the best prices.

5. Evaluate for **price patterns at the zone** (Section 3.3) — double bottom/top, higher low/lower high, hammer rejections, or bullish/bearish engulfing patterns forming at the zone. If present, score the Price Pattern factor in the convergence assessment.

6. Perform dynamic density recalculation if any level within the zone breaks during the pullback test. Remove broken levels and recompute the zone density. If density falls below the minimum threshold, downgrade to WAIT or cancel.

7. Package the zone map (all price levels with pyramid lot allocations, zone density score, and price pattern assessment) and pass to the Execution Layer.

### 5.5 Decision Layer — Disqualifying Conditions

Certain conditions override the convergence score and immediately produce an INVALIDATED output. These are hard rules, not subject to LLM override:

1. **Failed breakout** — Price broke above/below the trendline but has now returned to the wrong side and closed there. The structural premise of the trade is negated.

2. **Extreme counter-directional momentum on primary Decision TF** — An Extreme (Z ≥ 2.5) momentum candle in the opposite direction of the intended trade appears on the primary Decision timeframe after the breakout, breaking back through the trendline. This represents overwhelming counter-force.

3. **Navigation regime acceleration against the trade** — If the Navigation Layer's regime was already counter-trend AND is now showing fresh momentum candles accelerating in the regime direction (not exhausting), the macro environment is actively hostile to the trade.

**Conditions that are NOT automatically disqualifying** (evaluated by LLM judgment):

- Bearish momentum candle during pullback that doesn't break the S/R level — potential spring/shakeout, but the LLM must monitor for the subsequent bounce. A spring without a bounce is just absorption, not confirmation. The LLM should score this as +1 (pending) until the bounce materializes, at which point it becomes +2, or as -1 if the bounce fails to appear within 2-3 bars on the primary Decision TF.
- TEMA crossing below HRMA on Execution timeframes during pullback (expected behavior during retracement)
- A single lower timeframe losing its bullish structure during an otherwise healthy pullback on the primary Decision TF
- Moderate bearish momentum candle on a Navigation timeframe that could represent exhaustion of the macro trend rather than its acceleration

---

## 6. Execution Layer — Detailed Specification

### 6.1 Purpose and Constraints

The Execution Layer receives the entry zone map from the Decision Layer and handles precision timing for order placement. Its job is to answer: _"At what exact price and moment within the approved zone should each lot be placed?"_

**Critical design principle:** The Execution Layer's criteria should be **minimal and practical**. The Decision Layer has already performed the heavy analytical work and determined that the trade should be taken. The Execution Layer should not re-evaluate the trade thesis — it should focus solely on optimizing the fill price within the approved zone.

### 6.2 Execution Criteria — Principle-Based

The Execution Layer uses two timeframes to refine entry timing. Rather than a rigid checklist that must be fully satisfied (which leads to missed entries and analysis paralysis), the Execution Layer operates on a simple principle:

**"Has price reached the target S/R level within the zone, and is that level actively rejecting price back toward the trade direction?"**

That's the core question. Everything else is refinement. Note that the Execution Layer inherits the same bounce-back principle from the Decision Layer — passive holding at the level is not sufficient for order execution. The Execution Layer should observe initial signs of active rejection before placing market orders.

**Evaluating "has price reached the level":**

- Price is within or has entered the tolerance zone of the target S/R level identified by the Decision Layer
- The upper Execution timeframe (e.g., M15 in Config A) provides the first confirmation that price is in the zone
- The lower Execution timeframe (e.g., M5 in Config A) provides the precision view for exact timing

**Evaluating "is the level actively rejecting":**

- Price tests the level and begins producing candles that move away from it in the trade direction (the earliest micro-evidence of bounce)
- Wicks rejecting from the level (price probes the level but closes away from it) are the first sign of active rejection
- A single candle poking through the level is not automatically failure — evaluate whether the subsequent candle recovers and bounces. The 1.5% tolerance zone accommodates minor overshoot, but recovery must be visible within 1-3 candles on the lower Execution TF
- Price lingering at the level for extended periods on the Execution TF (e.g., 8+ candles on M5 without directional movement away from the level) is a warning sign — the level is absorbing rather than rejecting, and the Execution Layer should delay order placement until directional movement resumes or flag the deterioration to the Decision Layer

**What the Execution Layer does NOT require:**

- TEMA above HRMA on Execution timeframes (this is often violated during healthy pullbacks)
- A specific momentum candle type at the entry level (most entries happen on normal-sized candles)
- Perfect trendline support structure on the Execution timeframes (micro-structure is noisy and unreliable compared to Decision-level structure)
- All conditions aligned simultaneously (Execution TFs are inherently noisy; demanding perfection means never entering)

**What the Execution Layer CAN use as positive refinements (when available):**

- A bullish candle bouncing off the S/R level on the lower Execution TF — this IS the active rejection signal; a clean bounce candle moving away from the level provides the highest-confidence entry timing
- TEMA crossing above HRMA on an Execution TF during the bounce adds confirmation that micro-momentum has shifted in the trade direction
- Micro-structure ascending trendline on the lower Execution TF provides a clear visual structure for entry placement
- Momentum candle (any direction) followed by active bounce away from the level = the strongest Execution-level signal (especially the spring/shakeout pattern: bearish momentum tests the level, fails, then price bounces aggressively)

### 6.3 Order Placement Logic

For each lot in the entry zone:

1. **Limit order approach (preferred):** Place a limit buy order at the target S/R level for the lot. The order sits at the level and fills when price reaches it during the pullback. This provides the best fill price but risks non-fill if price doesn't reach the level.

2. **Market order approach (when price is already at the level and bouncing):** If price has already pulled back to the target level and the Execution Layer observes active rejection (candles bouncing away from the level in the trade direction), a market order at the current price is appropriate. Do not place market orders while price is still falling toward the level or passively sitting at it — wait for the first visible bounce candle.

3. **Partial fill management:** If price pulls back to the upper lot level but not to the lower lot levels, the filled portion of the position is live. The unfilled limit orders can be maintained for a defined time window (configurable, e.g., 4-8 bars on the primary Decision TF) and then cancelled if not reached.

### 6.4 Execution Layer — LLM Judgment Role

**Where rules apply:** Order placement at defined S/R levels, tolerance zone calculations, time-based order cancellation — these are mechanical operations.

**Where LLM judgment applies:**

- **Pace assessment:** If price is falling rapidly toward the entry zone with heavy bearish momentum, the LLM may determine that the pullback is more aggressive than a normal retracement and recommend waiting for visible signs of active rejection (bounce candles moving away from the level) before executing, even if the price is at the target level. Arriving at the level is not enough — the bounce must begin. A level can survive one candle then break on the next if the selling force is overwhelming, which is why the Execution Layer should observe the first bounce candle before committing capital.

- **Zone adjustment:** If micro-structure on the Execution TFs reveals a more precise S/R level slightly different from the Decision Layer's calculated level (e.g., a cluster of M5 wicks at a specific price that's 0.2% away from the calculated level), the LLM can adjust the entry price to the more precise level.

- **Urgency assessment:** If only the shallowest lot level has been reached and price is rapidly resuming in the trade direction, the LLM can decide to fill the remaining lots at market rather than waiting for the deeper levels that may never be reached.

---

## 7. State Machine Specification

### 7.1 States

The agentic system operates as a state machine with well-defined states and transition conditions. Each state has specific data requirements, evaluation criteria, and allowed transitions.

```
IDLE
  No active trade evaluation. System monitors for new evaluation triggers.
  Trigger: New bar on primary Decision TF, or manual user trigger.

NAVIGATING
  Processing Navigation Layer (2 timeframes).
  Computes: Aggregate Slope Score, Regime Classification, Counter-Trend Flag.
  Duration: Single evaluation cycle (one pass through both Navigation TFs).

SCANNING
  Processing Decision Layer (3 timeframes) for breakout detection.
  Evaluates: Trendline map, breakout status, momentum, TEMA/HRMA on all three Decision TFs.
  Computes: Raw convergence score (preliminary — breakout may not have occurred yet).
  Can persist for: Many bars. This is the "watching for a setup" state.

BREAKOUT_DETECTED
  A breakout has been identified on at least the primary Decision TF.
  Evaluates: Breakout quality (body close vs. wick, momentum context, TEMA/HRMA state).
  Computes: Updated convergence score with breakout status.
  Duration: 1-3 bars. If breakout is not confirmed within this window, transitions to INVALIDATED.

AWAITING_PULLBACK
  Breakout confirmed. Waiting for price to retrace toward the broken trendline.
  Monitors: Price distance from broken trendline, direction of recent candles.
  Can persist for: Configurable bar limit (default: 8-12 bars on primary Decision TF).
  If pullback doesn't occur within the time window, transitions to MISSED (not INVALIDATED —
  the breakout was real but the entry window was missed).

PULLBACK_TESTING
  Price has entered the tolerance zone of the broken trendline.
  Evaluates: Is the level actively rejecting price and producing a bounce back toward
  the prior swing high/low? (See Section 3.1 for confirmation criteria)
  Monitors: Bounce quality — are candles moving away from the level in the trade direction?
  Time-based degradation: If price lingers at the level for >3-8 bars on primary Decision TF
  without bouncing, confidence degrades progressively.
  This is where the split-lot zone is actively being tested.
  Computes: Final convergence score, entry zone map with lot allocations.

EXECUTING
  Decision = ENTER. Orders being placed through the Execution Layer.
  Monitors: Fill status of each lot, Execution TF conditions.
  Duration: Until all lots are filled, or timeout triggers unfilled lot cancellation.

ENTERED
  Position is live. At least one lot has been filled.
  System transitions to trade management mode (outside the scope of this document,
  as the user manages stop loss via Risk Per Trade and exit via R:R ratio).

MISSED
  Breakout was valid but pullback entry window expired without fill.
  The setup is no longer actionable. System resets to IDLE after cooldown.

INVALIDATED
  A disqualifying condition was detected (see Section 5.5).
  System resets to IDLE after cooldown.
```

### 7.2 Transition Map

```
IDLE → NAVIGATING
  Trigger: New bar on primary Decision TF (periodic evaluation cycle)

NAVIGATING → SCANNING
  Condition: Navigation Layer produces valid regime classification
  Passes: Regime label, counter-trend flag, confidence modifier

NAVIGATING → IDLE
  Condition: Navigation Layer detects conditions incompatible with any trade
  Example: Extreme regime acceleration with no exhaustion signals and user has
           restricted counter-trend trading

SCANNING → BREAKOUT_DETECTED
  Condition: Candle on primary Decision TF closes beyond a key trendline
  in the intended trade direction

SCANNING → IDLE
  Condition: Structure deteriorates (key support/resistance level breaks against
  the trade direction), or LLM judgment determines no viable setup is developing

BREAKOUT_DETECTED → AWAITING_PULLBACK
  Condition: Breakout quality is sufficient (LLM judgment + convergence score ≥ WAIT threshold)
  Time limit: Must transition within 3 bars; otherwise → INVALIDATED

BREAKOUT_DETECTED → INVALIDATED
  Condition: Breakout quality is insufficient, or price immediately reverses through
  the trendline (instant fakeout)

AWAITING_PULLBACK → PULLBACK_TESTING
  Condition: Price enters the tolerance zone of the broken trendline from the new side

AWAITING_PULLBACK → MISSED
  Condition: Bar count exceeds pullback time window without price returning to the zone.
  Price continued strongly in breakout direction — entry opportunity missed.

AWAITING_PULLBACK → INVALIDATED
  Condition: Price falls back through the broken trendline and closes on the wrong side
  (failed breakout after initial confirmation)

PULLBACK_TESTING → EXECUTING
  Condition: Level is actively rejecting price with visible bounce toward trade direction
  (LLM evaluation) AND final convergence score ≥ ENTER threshold

PULLBACK_TESTING → INVALIDATED
  Condition: Level breaks. Price closes decisively through the trendline on the wrong side.
  The breakout has failed.

PULLBACK_TESTING → WAIT (back to SCANNING)
  Condition: Level test is inconclusive — price is lingering at the level without bouncing
  (absorption behavior) or price leaves the zone without clear resolution.
  LLM judgment: "Needs more data — no active rejection observed yet."
  Graceful fallback to continued monitoring. If lingering persists beyond the time window
  (3-8 bars on primary Decision TF), confidence should be meaningfully downgraded.

EXECUTING → ENTERED
  Condition: At least one lot has been filled

EXECUTING → INVALIDATED
  Condition: While orders are pending, a disqualifying condition is detected.
  Unfilled orders are cancelled. Filled orders remain live (cannot un-enter a position).

MISSED → IDLE
  Automatic transition after cooldown period (configurable, default: 4 bars on primary Decision TF)

INVALIDATED → IDLE
  Automatic transition after cooldown period
```

### 7.3 State Persistence Requirements

The state machine must maintain the following data across evaluation cycles:

| Data                                           | Persistence Scope                                                                  | Purpose                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Current state                                  | Until state transition                                                             | Core state tracking                                                                       |
| Breakout bar index and price                   | From BREAKOUT_DETECTED until ENTERED or reset                                      | Reference point for pullback distance calculation                                         |
| Broken trendline parameters (slope, intercept) | From BREAKOUT_DETECTED until ENTERED or reset                                      | Trendline continues to move; must project its current position                            |
| Convergence score history                      | Rolling window of last 10 evaluations                                              | Trend detection in score evolution                                                        |
| Navigation regime history                      | Rolling window of last 5 evaluations                                               | Regime transition detection                                                               |
| S/R Zone map (all levels, clustered)           | From PULLBACK_TESTING until ENTERED or reset                                       | Zone boundaries and individual level tracking                                             |
| Zone structural density score                  | From PULLBACK_TESTING until ENTERED or reset; **recalculated if any level breaks** | Dynamic zone quality assessment                                                           |
| Pyramid lot allocation plan                    | From PULLBACK_TESTING until ENTERED or reset                                       | Lot allocation targets per level                                                          |
| Price pattern state at zone                    | From PULLBACK_TESTING until ENTERED or reset                                       | Tracks developing patterns (e.g., "first bottom formed at X, monitoring for second test") |
| Broken levels within zone                      | From PULLBACK_TESTING until ENTERED or reset                                       | Tracks which levels have failed; triggers density recalculation                           |
| Fill status per lot                            | From EXECUTING until ENTERED                                                       | Partial fill tracking                                                                     |
| Bar counter in current state                   | Per state                                                                          | Time-based transition triggers                                                            |

---

## 8. LLM Judgment Framework — Principles for Agentic Decision-Making

### 8.1 The Rule-Principle Spectrum

The trading system operates on a spectrum from hard rules (deterministic, never overridden) to soft principles (evaluated by LLM judgment with contextual discretion). This hybrid approach is essential because:

- **Pure rule-based systems** are brittle. Markets produce infinite variations of price patterns, and rigid rules either miss valid setups (overly restrictive) or enter invalid setups (overly permissive). The backtesting paradox: rules optimized for historical data invariably encounter novel conditions they weren't designed for.

- **Pure judgment-based systems** are inconsistent. Without any structural framework, the LLM would make different decisions on identical setups depending on prompt context, potentially drift in decision quality over time, and lack auditability.

The solution is a **rule scaffold with LLM judgment at defined discretion points**. Rules handle what can be quantified reliably. LLM judgment handles what requires contextual interpretation.

### 8.2 Hard Rules (Never Overridden)

These rules are deterministic and the LLM must always respect them:

1. **Failed breakout invalidation** — If price closes back through the broken trendline on the primary Decision TF, the state transitions to INVALIDATED regardless of any other positive signals.

2. **Entry zone boundaries** — The LLM cannot place orders outside the Decision Layer's constructed entry zone. The zone can be adjusted (per Section 6.4) but not abandoned.

3. **State machine transitions** — The LLM cannot skip states. IDLE cannot jump directly to EXECUTING. The sequential flow must be respected.

4. **Cooldown enforcement** — After INVALIDATED or MISSED, the cooldown period must elapse before re-evaluation. This prevents revenge trading patterns.

5. **Counter-trend modifier application** — The confidence modifier from the Navigation Layer must be applied to the convergence score. The LLM cannot ignore the counter-trend flag.

6. **Position sizing constraints** — Lot allocations must respect the user's configured risk parameters (Risk Per Trade / Max Loss Per Trade). The LLM cannot increase position size beyond these limits.

### 8.3 Soft Principles (LLM Discretion)

These are areas where the LLM applies judgment within guardrails:

**Principle 1: Breakout quality is holistic, not checklist-based.**
The LLM evaluates the overall picture of a breakout — body close position, candle shape, momentum context, TEMA/HRMA state, zone structural density, volume/activity context — and makes a qualitative assessment of breakout conviction. A breakout with 4 out of 5 factors positive and 1 neutral is different from a breakout with 3 positive and 2 negative, even if the convergence score is the same.

**Principle 2: Pullback evaluation requires active rejection and bounce, not passive holding.**
The LLM does not require specific candle types, specific MA configurations, or specific timeframe alignments during a pullback. However, it does require evidence that the broken trendline is **actively functioning in its new role** — meaning price must not only survive the test but visibly bounce back toward the prior swing high/low within a reasonable time window. Passive holding (price sitting at the level without directional resumption) is a warning sign of absorption rather than rejection, and the LLM should recognize this distinction. The longer price lingers at a level without bouncing, the more the LLM should degrade confidence in the setup. The LLM evaluates the quality of the bounce — its speed, its magnitude relative to the pullback, and whether it shows genuine buying interest (for longs) or just a temporary pause in selling.

**Principle 3: Momentum interpretation requires both context and subsequent response.**
The LLM interprets momentum candles based on where they appear in the price structure, not solely on their color. A bearish Extreme candle at a support level that is followed by an active bullish bounce is strongly bullish information (spring/shakeout). However, a bearish Extreme candle at a support level that is followed by continued passivity or further selling is bearish information — the exhaustion narrative requires a buyer response to be validated. Similarly, a bullish Extreme candle after 20 consecutive bullish candles may be exhaustion rather than continuation. The LLM weighs both the initial momentum event AND the market's subsequent response to that event.

**Principle 4: Conflicting signals require synthesis, not paralysis.**
When different timeframes or different indicators produce contradictory signals, the LLM must still produce a decision (even if that decision is WAIT). The LLM weighs the reliability and relevance of each conflicting signal, considers which timeframe's signal is more structurally significant, and produces a net assessment. "Conflicting signals" is not a valid reason for indefinite WAIT — the LLM should either determine which signal dominates or set a time-based threshold for resolution.

**Principle 5: Market conditions modulate strategy expectations.**
In high-volatility environments, tolerance zones may need to be mentally widened, pullbacks may be deeper and more violent, and momentum candles may be more frequent but less individually significant. In low-volatility environments, smaller breakouts carry more significance, momentum candles are rarer but more meaningful, and the system should be more patient. The LLM adapts its interpretation framework to current market conditions.

### 8.4 Graceful Fallback Hierarchy

When the rule-based system produces ambiguous or borderline results, the LLM follows a fallback hierarchy:

```
Level 1: Rule-Based Decision
  If convergence score is clearly above or below thresholds → follow the score.
  No LLM override needed.

Level 2: LLM Contextual Adjustment
  If convergence score is near a threshold boundary (within ±1.0 of ENTER or NO TRADE) →
  LLM evaluates qualitative factors including zone structural density, bounce quality,
  and price pattern development. Adjusts the effective score up or down by up to 1.5 points.
  Decision follows the adjusted score.

Level 3: LLM Synthesis of Conflicting Signals
  If individual convergence factors are split (e.g., Trendline: +2, Momentum: -1, TEMA: +1,
  Navigation: -2, Price Pattern: +1 → raw score = +1, but with extreme divergence among factors) →
  LLM determines which factors are most structurally relevant in the current context and
  produces a weighted judgment. Zone density score serves as a tiebreaker — a dense zone
  with conflicting signals is more likely to hold than a thin zone with conflicting signals.
  Must document reasoning.

Level 4: LLM Discretionary Override
  In genuinely unusual conditions (major news event, structural market dislocation,
  indicator malfunction/anomaly) → LLM can override the rule-based output.
  Must flag the override prominently in the trade log.
  Override can only move the decision toward caution (e.g., ENTER → WAIT),
  never toward aggression (e.g., NO TRADE → ENTER).

Level 5: Default to WAIT
  If none of the above levels produces a clear decision → output WAIT.
  WAIT is always the safe default. No capital is risked, and the system continues monitoring.
  The LLM should specify what conditions would resolve the ambiguity.
```

**Design rationale for one-directional override:** The override can only increase caution (Level 4) because the cost of a false positive (entering a bad trade and losing money) is asymmetric with the cost of a false negative (missing a good trade and preserving capital). Missing a trade is disappointing; taking a bad trade is damaging. The system should be biased toward preservation.

### 8.5 LLM Evaluation Prompt Template

When the agentic system invokes the LLM for judgment at any discretion point, the prompt should include:

```
Context provided to LLM:
  - Current state machine state
  - Navigation Layer output (regime, modifier, raw data summary)
  - Decision Layer convergence score breakdown (per-factor scores, all 5 factors)
  - All three Decision TF trendline maps with distance-to-nearest calculations
    and projected price levels at current bar
  - S/R Zone cluster composition (all levels, source TFs, proximity grouping)
  - Zone structural density score and contributing factors
  - Broken levels within zone (if any) and recalculated density
  - Price pattern assessment at zone (pattern type, development status, evidence)
  - Recent momentum candle classifications on all Decision TFs
  - TEMA/HRMA gap states on all Decision TFs
  - Breakout bar details (if applicable)
  - Pullback status (if applicable) — including bounce quality assessment
  - Pyramid lot allocation plan (if zone constructed)
  - Historical convergence score trend (last 5-10 evaluations)

Question to LLM:
  "Given the above market state, evaluate [specific discretion point].
   Provide your assessment and a confidence level (high/medium/low).
   If your assessment differs from the rule-based output, explain which
   contextual factors drive the difference."

Expected LLM output:
  - Assessment (e.g., "Breakout quality: High — clean body close, momentum aligned")
  - Confidence: High / Medium / Low
  - Score adjustment (if applicable): e.g., "+0.5 — qualitative factors strengthen the signal"
  - Zone quality note (if applicable): e.g., "Dense zone (score 7) with developing double bottom"
  - Reasoning: Brief contextual explanation
```

---

## 9. Trade Management Context (Boundary Definition)

While stop loss and take profit are explicitly outside the scope of this trading entry system (the user determines these via Risk Per Trade and R:R ratio), the agentic system needs to understand the boundary between the entry workflow and the management workflow.

**Entry system responsibility ends when:**

- At least one lot has been filled (state = ENTERED)
- The entry zone map, fill prices, and fill times have been logged
- The entry system has handed off to the trade management module

**Information the entry system passes to trade management:**

- Entry price(s) and lot sizes per fill
- The broken trendline parameters (for potential re-evaluation of the trade thesis)
- The convergence score at entry and the regime classification
- Whether the trade is with-trend or counter-trend
- The Navigation Layer's regime classification (for context on expected move magnitude)

**Information the entry system does NOT determine:**

- Stop loss price (determined by user's Risk Per Trade formula)
- Take profit price (determined by stop loss distance × R:R ratio)
- Position management rules (trailing stops, partial exits, etc.)

---

## 10. Implementation Architecture Notes

### 10.1 Data Pipeline Requirements

The agentic system requires the following data to be pre-computed and stored in the database (PostgreSQL), refreshed on each new bar:

| Data Type                                                   | Per Timeframe       | Storage                     | Refresh Trigger                                                                                                              |
| ----------------------------------------------------------- | ------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| OHLC candle data                                            | Yes (all 6-7 TFs)   | Time-series table           | New bar close                                                                                                                |
| Trendline parameters (slope, intercept, score, touch count) | Yes                 | Trendline table with TF key | New bar close                                                                                                                |
| Trendline distance-to-price (%)                             | Yes                 | Computed column or view     | New bar close                                                                                                                |
| Trendline projected price at current bar                    | Yes                 | Computed column or view     | New bar close (critical for TF-agnostic zone construction — the projected price determines where the level sits, not the TF) |
| Momentum candle Z-Score and classification                  | Yes                 | Candle classification table | New bar close                                                                                                                |
| TEMA value                                                  | Yes                 | MA table                    | New bar close                                                                                                                |
| HRMA value                                                  | Yes                 | MA table                    | New bar close                                                                                                                |
| TEMA-HRMA gap (absolute and as % of price)                  | Yes                 | Computed column or view     | New bar close                                                                                                                |
| Aggregate Slope Score                                       | Navigation TFs only | Regime table                | New bar on higher Navigation TF                                                                                              |
| S/R Zone clusters (proximity-grouped levels)                | Decision TFs        | Zone table                  | New bar close on primary Decision TF; recalculated when any trendline updates                                                |
| Zone structural density score                               | Per zone cluster    | Zone table                  | Recalculated with zone clusters; also recalculated dynamically if a level breaks during pullback testing                     |
| Recent swing highs/lows (for price pattern detection)       | Decision TFs        | Swing point table           | New bar close; used to detect double bottom/top, higher low/lower high patterns forming at zone                              |

### 10.2 Agentic RAG Integration

The agentic system retrieves the pre-computed data from the database and constructs the evaluation context for each state machine cycle. The RAG retrieval should:

1. **Fetch current bar data** for all timeframes in the active configuration
2. **Fetch trendline data** with priority on trendlines nearest to current price (leveraging the Fractal V5 proximity weighting). Include projected price at current bar for each trendline — this is the actual S/R level used for zone construction.
3. **Fetch momentum candle history** for the last N bars on each Decision TF (N = 20-30, to provide sequence context for invigorated vs. exhausting classification)
4. **Construct S/R Zone clusters** by collecting all trendline projected prices from the three Decision TFs, sorting by price, and grouping by proximity (Section 3.2.2). Compute structural density score for each cluster (Section 3.2.3).
5. **Detect price patterns at the zone** by analyzing recent swing highs/lows relative to zone boundaries. Identify developing or completed double bottoms/tops, higher lows/lower highs, hammer rejections, and engulfing patterns (Section 3.3).
6. **Fetch state machine persistence data** (current state, breakout bar info, zone map, zone density, broken levels, price pattern state, etc.)
7. **Construct the LLM evaluation prompt** using the template from Section 8.5, including zone density score and price pattern assessment
8. **Execute the LLM evaluation** at the appropriate discretion points
9. **Update the state machine** based on combined rule-based and LLM outputs
10. **Log the decision** with full audit trail (convergence score including Price Pattern factor, zone density, LLM reasoning, state transition, etc.)

### 10.3 Evaluation Cycle Timing

The system evaluates on each new bar close of the **primary Decision timeframe**. For Config A (H1 primary), this means one evaluation cycle per hour. For Config B (H2 primary), one cycle every two hours.

Within each cycle, the system:

1. Refreshes all data from the database
2. Runs the Navigation Layer (deterministic computation)
3. Runs the Decision Layer (rule-based scoring + LLM judgment)
4. Processes state machine transitions
5. If state = EXECUTING, runs the Execution Layer using the faster Execution TF data

The Execution Layer may run more frequently than the primary Decision TF cycle because it uses lower timeframes. When state = EXECUTING, the system can evaluate on each new bar of the lower Execution TF (e.g., every 5 minutes in Config A) to monitor fill status and zone holding.

### 10.4 Audit and Observability

Every state machine transition and every LLM judgment call should be logged with:

| Log Field                     | Content                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Timestamp                     | Evaluation cycle time                                                                                                    |
| State (from → to)             | State transition                                                                                                         |
| Trigger                       | What caused the transition                                                                                               |
| Convergence score             | Raw and adjusted scores with per-factor breakdown (5 factors: Trendline, Momentum, TEMA/HRMA, Navigation, Price Pattern) |
| LLM judgment (if invoked)     | Assessment, confidence, score adjustment, reasoning                                                                      |
| Navigation regime             | Current classification and modifier                                                                                      |
| Trendline context             | Key trendlines with distance-to-price and projected price levels                                                         |
| TEMA/HRMA state               | Gap state on primary Decision TF                                                                                         |
| Momentum context              | Recent classifications on Decision TFs                                                                                   |
| S/R Zone (if applicable)      | Zone boundaries, all levels with source TFs, proximity cluster composition                                               |
| Zone structural density       | Density score and contributing factors; broken levels flagged                                                            |
| Pyramid allocation plan       | Lot allocation per level within zone                                                                                     |
| Price pattern at zone         | Pattern type (if any), development status (forming/completed/none), supporting evidence                                  |
| Override flag (if applicable) | Whether LLM overrode rule-based output and why                                                                           |

This audit trail serves two purposes: post-trade analysis for strategy refinement, and debugging/validation of the agentic system's decision quality.

---

## Appendix A: Indicator Parameter Reference (Complete)

| Indicator   | Parameter          | Default Value       | Database Column Suggestion   |
| ----------- | ------------------ | ------------------- | ---------------------------- |
| Fractal V5  | Major fractal bars | 35                  | `fractal_major_period`       |
| Fractal V5  | Minor fractal bars | 13                  | `fractal_minor_period`       |
| Fractal V5  | Min fractal touch  | 3                   | `trendline_min_touches`      |
| Fractal V5  | Tolerance type     | Percent             | `trendline_tolerance_type`   |
| Fractal V5  | Tolerance value    | 1.5%                | `trendline_tolerance_value`  |
| Fractal V5  | Lookback bars      | 400                 | `trendline_lookback`         |
| Fractal V5  | Extension bars     | 100                 | `trendline_extension`        |
| Fractal V5  | Max peak lines     | 3                   | `max_resistance_lines`       |
| Fractal V5  | Max bottom lines   | 3                   | `max_support_lines`          |
| Fractal V5  | Weight: fractals   | 25%                 | `score_weight_fractals`      |
| Fractal V5  | Weight: slope      | 15%                 | `score_weight_slope`         |
| Fractal V5  | Weight: length     | 10%                 | `score_weight_length`        |
| Fractal V5  | Weight: proximity  | 50%                 | `score_weight_proximity`     |
| Fractal V5  | Max angle degrees  | 60°                 | `trendline_max_angle`        |
| Momentum V2 | Z-Score MA length  | 432                 | `momentum_zscore_period`     |
| Momentum V2 | Large threshold    | 1.5 Z               | `momentum_large_threshold`   |
| Momentum V2 | Extreme threshold  | 2.5 Z               | `momentum_extreme_threshold` |
| TEMA/HRMA   | SMA period         | 2                   | `sma_period`                 |
| TEMA/HRMA   | SMMA period        | 36                  | `smma_period`                |
| TEMA/HRMA   | HRMA period        | 18                  | `hrma_period`                |
| TEMA/HRMA   | TEMA period        | 9                   | `tema_period`                |
| TEMA/HRMA   | Applied price      | Typical ((H+L+C)/3) | `ma_applied_price`           |

## Appendix B: Timeframe Configuration Matrix

| Config | Nav Upper | Nav Lower | Decision Upper | Decision Primary | Decision Lower | Exec Upper | Exec Lower |
| ------ | --------- | --------- | -------------- | ---------------- | -------------- | ---------- | ---------- |
| A (H1) | H4        | H2        | H2             | H1               | M30            | M15        | M5         |
| B (H2) | H8        | H4        | H4             | H2               | H1             | M30        | M15        |

## Appendix C: Convergence Score Quick Reference

**Factor scoring (-2 to +2 per factor, for LONG direction):**

| Score | Trendline                                                               | Momentum                                                                           | TEMA/HRMA                 | Navigation                            | Price Pattern at Zone                                                                     |
| ----- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| +2    | Broken resistance confirmed: pullback + active bounce toward prior high | Extreme bullish at key level, or exhausting bearish followed by strong bounce      | TEMA > HRMA, gap widening | With-trend, regime supports direction | Completed double bottom with neckline break; or higher low confirming diminishing selling |
| +1    | Breakout occurred, pullback in progress (bounce pending)                | Large bullish, or exhausting bearish at support (bounce pending)                   | TEMA crossing above HRMA  | Neutral regime                        | Developing double bottom (2nd test in progress); hammer/engulfing rejection at zone       |
| 0     | At resistance, no breakout                                              | No significant momentum at key levels                                              | TEMA ≈ HRMA, intertwined  | N/A (neutral is +1)                   | No recognizable pattern (most common — neutral, not negative)                             |
| -1    | Below resistance, no breakout                                           | Large bearish away from support, or bearish at support with no bounce (absorption) | TEMA crossing below HRMA  | Counter-trend with deceleration       | Each successive test penetrates deeper into zone (lower lows at support)                  |
| -2    | Failed breakout (price fell back)                                       | Extreme bearish breaking support                                                   | TEMA < HRMA, gap widening | Strongly counter-trend, accelerating  | Completed reversal pattern against trade direction at zone                                |

**Raw score range:** -10 to +10 (five factors)  
**Adjusted score:** Raw × Counter-trend modifier (0.6 to 1.0)  
**ENTER threshold:** ≥ +5.0 (default)  
**WAIT threshold:** +2.5 to +4.9  
**NO TRADE:** < +2.5

## Appendix D: State Machine Transition Diagram (Text Representation)

```
                    ┌──────────────┐
                    │     IDLE     │◄──── cooldown ────┐
                    └──────┬───────┘                   │
                           │ new bar trigger           │
                    ┌──────▼───────┐                   │
                    │  NAVIGATING  │                   │
                    └──────┬───────┘                   │
                           │ regime computed           │
                    ┌──────▼───────┐    no setup       │
                    │   SCANNING   ├───────────────────┤
                    └──────┬───────┘                   │
                           │ breakout on primary TF    │
                 ┌─────────▼──────────┐  bad quality   │
                 │ BREAKOUT_DETECTED  ├───────────────►│
                 └─────────┬──────────┘                │
                           │ quality confirmed         │
                ┌──────────▼───────────┐  price runs   │
                │  AWAITING_PULLBACK   ├──► MISSED ───►│
                └──────────┬───────────┘               │
                           │ price enters zone    fail │
                  ┌────────▼─────────┐   breaks back   │
                  │ PULLBACK_TESTING ├────────────────►│
                  └────────┬─────────┘                 │
                           │ level holds + bounce + score ≥ 5   │
                     ┌─────▼──────┐                    │
                     │  EXECUTING  ├──► INVALIDATED ──►┘
                     └─────┬──────┘
                           │ lot(s) filled
                     ┌─────▼──────┐
                     │   ENTERED   │
                     └────────────┘
                    (handoff to trade management)
```

---

_End of Architecture Blueprint — Version 2.1_
