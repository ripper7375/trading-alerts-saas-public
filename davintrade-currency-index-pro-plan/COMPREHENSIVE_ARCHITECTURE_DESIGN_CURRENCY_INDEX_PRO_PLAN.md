# DavinTrade Architecture Design: Currency Index PRO Plan Analysis Engine & 28-Pair Relative Strength Screener

**Authoritative Architectural Specification & Technical Implementation Blueprint**  
**Document Path:** `davintrade-currency-index-pro-plan/COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_INDEX_PRO_PLAN.md`  
**Target Execution Environment:** Contabo Windows VPS (MT5 + Python Lane 4) ──► Railway Cloud (NestJS API Gateway + PostgreSQL + Redis) ──► Next.js 16 Pro Terminal (`davintrade.app/pro/currency-index`)  
**Audience:** Claude Code, Core Engineering Team, Lead Quantitative Architect  
**Status:** Approved for Feasibility Assessment & Implementation

---

## 1. Executive Summary & Strategic Business Objective

### 1.1 The Freemium-to-PRO Monetization Engine

The foundational **Lane 4 (Currency & Gold Index Stack)** established an equal-weighted, 0.00%-normalized sparkline widget on the public landing page (`davintrade.app`) as specified in [`COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_AND_GOLD_INDEX_STACK.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-currency-index-stack/COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_AND_GOLD_INDEX_STACK.md) and live-verified in [`currency-index-manifest-work-completion.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-currency-index-stack/currency-index-manifest-work-completion.md).

While the Free Tier provides public macro visibility across 9 standalone sparklines, the **PRO Plan** transitions users from passive market observers into active, high-probability execution traders.

As illustrated in [`landing-page-with-currency-index-add-pro-plan.png`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-currency-index-pro-plan/landing-page-with-currency-index-add-pro-plan.png), a locked conversion banner sits immediately below the live sparklines:

> 🔒 **"Access the Real-Time 28-Pair Relative Strength Screener Using Currency Indexes Approach and Automated Entry/Exit Line Alerts"** ──► `[ Upgrade to PRO ]`

### 1.2 Core Quantitative Edge: Solving "Analysis Paralysis"

Retail Forex traders typically monitor 28 individual candlestick charts in isolation, leading to information overload, late entries, and whipsaws. The **DavinTrade Currency Index PRO Engine** consolidates all 8 major currencies (`USD`, `EUR`, `GBP`, `JPY`, `AUD`, `CAD`, `CHF`, `NZD`) onto a **single unified multi-line canvas**, instantly highlighting:

1. **Capital Flow Divergence:** Exactly which currency institutions are buying, and which they are dumping.
2. **The "Best Pair" Selection:** Automatically pairing the **Strongest Currency** with the **Weakest Currency** to maximize volatility and win rate.
3. **Statistical Mean Reversion:** Identifying when a currency is mathematically overextended from its daily open and confirming trend reversals via high-speed, lag-reduced moving average crossovers.

---

## 2. Behavioral Psychology & "The Hook Model" for Day Traders

To ensure explosive Daily Active Usage (DAU) and sticky monthly subscription retention, the UI/UX incorporates three neuromarketing and gamification mechanics:

### 2.1 The "8-Horse Race" (Normalized Daily Reset at 00:00 MT5)

- Rather than displaying multi-week historical drift, all 8 currency index lines are **pinned to $0.00\%$ at daily market open (00:00 MT5 server time)**.
- Every morning, traders witness all 8 currencies burst from the same starting gate. As the Asian, London, and New York sessions unfold, the lines fan out into clear leaders and laggards.
- This creates an addictive **daily ritual**: Day traders open DavinTrade every morning and at every major session open to see who is leading today's race.

### 2.2 Live Reset Countdown Timer

- Placed prominently above the chart: `⏳ Daily Session Resets in: 03h 42m 15s`.
- **Psychological Trigger:** Reinforces scarcity and urgency. Day traders know that holding positions across the daily rollover incurs high spread spikes and negative swap charges. The ticking clock prompts decisive action during peak liquidity hours.

### 2.3 Spread Delta Gauge (The Jackpot Meter)

- Dynamically measures the absolute percentage distance between the strongest and weakest currency:
  $$\Delta_{\text{Spread}} = \text{Index}_{\text{Highest}} - \text{Index}_{\text{Lowest}}$$
- **Visual Status Triggers:**
  - $\Delta < 0.80\%$: `[ LOW VOLATILITY ]` (Muted slate badge)
  - $0.80\% \le \Delta < 1.40\%$: `[ ACTIVE DIVERGENCE ]` (Amber badge)
  - $\Delta \ge 1.40\%$: `[ 🔥 EXTREME GAP: 1.74% ]` (Pulsing neon red/orange glow)
- When the gauge pulses with `EXTREME GAP`, traders immediately recognize an anomalous market distortion ready to be exploited.

---

## 3. Dynamic Overbought / Oversold Corridors (Dynamic ADR-%)

### 3.1 Problem with Static Thresholds

A static threshold (e.g., fixed $\pm 0.75\%$) fails across changing market regimes:

- On quiet summer days or bank holidays, indices may peak at $\pm 0.45\%$, producing zero trading signals.
- On high-impact news days (CPI, NFP, FOMC), indices routinely blast through $\pm 0.75\%$ within minutes, triggering premature counter-trend entries (catching a falling knife).

### 3.2 The Unified 8-Currency Basket Mathematical Model (Requirement 1 & 2)

At **00:00 MT5 server time**, the system executes a background calculation to establish today's default **Dynamic Volatility Corridors**.

Because all 8 currencies are plotted on the same visual canvas ([`currency-index-analysis-for-pro-plan.png`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-currency-index-pro-plan/currency-index-analysis-for-pro-plan.png)), drawing 16 individual boundary lines would create visual chaos. Therefore, the system computes a **Shared Global Basket Threshold** derived from the historical intraday maximum excursions of all 8 currencies:

#### Mathematical Formulation:

Let $N$ be the lookback period in trading days (**Default $N = 20$ days**, user-adjustable from $5$ to $60$ days per Requirement 1).
For each historical day $d \in [1, N]$ and each currency index $c \in \{\text{USDX}, \text{EURX}, \text{GBPX}, \text{JPYX}, \text{AUDX}, \text{CADX}, \text{CHFX}, \text{NZDX}\}$:

1. **Intraday Peak Gain ($H_{c,d}$):**
   $$H_{c,d} = \max_{t \in \text{Day } d} \left( \frac{\text{Index}_{c,t}}{\text{Index}_{c,\text{Open}}} - 1 \right) \times 100\%$$
2. **Intraday Peak Loss ($L_{c,d}$):**
   $$L_{c,d} = \left| \min_{t \in \text{Day } d} \left( \frac{\text{Index}_{c,t}}{\text{Index}_{c,\text{Open}}} - 1 \right) \right| \times 100\%$$
3. **Combined Intraday Maximum Excursion ($E_{c,d}$):**
   $$E_{c,d} = \frac{H_{c,d} + L_{c,d}}{2}$$
4. **Basket Mean Excursion ($\mu_{\text{basket}}$):**
   $$\mu_{\text{basket}} = \frac{1}{8N} \sum_{c=1}^{8} \sum_{d=1}^{N} E_{c,d}$$
5. **Basket Standard Deviation ($\sigma_{\text{basket}}$):**
   $$\sigma_{\text{basket}} = \sqrt{ \frac{1}{8N - 1} \sum_{c=1}^{8} \sum_{d=1}^{N} (E_{c,d} - \mu_{\text{basket}})^2 }$$

#### Dual-Zone Target Goalposts Plotted at 00:00:

- **Tier 1: Strike / Warning Zone (75th Percentile Proxy):**
  $$\text{Overbought}_{\text{Tier1}} = +\mu_{\text{basket}}$$
  $$\text{Oversold}_{\text{Tier1}} = -\mu_{\text{basket}}$$
  _(Signals that a currency has reached its average historical daily stretch; prepare for potential reversal)._
- **Tier 2: Extreme Exhaustion Zone (90th+ Percentile Proxy):**
  $$\text{Overbought}_{\text{Tier2}} = +(\mu_{\text{basket}} + 1.0 \cdot \sigma_{\text{basket}})$$
  $$\text{Oversold}_{\text{Tier2}} = -(\mu_{\text{basket}} + 1.0 \cdot \sigma_{\text{basket}})$$
  _(Signals extreme rubber-band stretching; prime high-R:R mean reversion setup)._

### 3.3 Full User Customization & Override (Requirement 3)

While the calculated `Dynamic ADR-%` serves as the intelligent daily default, PRO users maintain complete control via UI inputs or sliders:

- **Overbought Override:** Slider range $+0.30\%$ to $+2.00\%$ (step 0.05%).
- **Oversold Override:** Slider range $-0.30\%$ to $-2.00\%$ (step 0.05%).
- **Lookback Period Override:** $5, 10, 20, 30, 60$ days.
- **`[ ↺ Reset to Today's Auto Default ]` Button:** Instantly restores today's mathematically calculated $\pm \mu_{\text{basket}}$.
- **Client-Side Real-Time Reactivity:** Dragging the slider immediately shifts the horizontal dashed lines on the chart and updates the Analysis Table status badges with 0ms server roundtrip.

---

## 4. Two-Stage Signal Confirmation Engine (HRMA x SMMA)

As specified in [`confirmation-trade-signals.png`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-currency-index-pro-plan/confirmation-trade-signals.png), relying solely on Overbought/Oversold levels leads to premature entries against strong trends. DavinTrade implements a strict **Two-Stage Confluence Model (Stage A + Stage B)**.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TWO-STAGE SIGNAL ENGINE                                           │
├─────────────────────────────────────────────────┬─────────────────────────────────────────────────┤
│ STAGE A: Surveillance (Macro Extreme)           │ STAGE B: Execution Trigger (Micro Momentum)     │
├─────────────────────────────────────────────────┼─────────────────────────────────────────────────┤
│ Currency Index enters Overbought / Oversold     │ Fast Hull-RMA (HRMA 36) crosses                 │
│ Dynamic Corridor (e.g. Index >= +0.78% or <= -0.78%)│ Slow Smoothed MA (SMMA 13) in reversal direction│
│ Status: ⏳ PENDING CONFIRMATION                  │ Status: 🚀 CONFIRMED REVERSAL TRIGGER            │
└─────────────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

### 4.1 Quantitative Formula: Hull-Like RMA (HRMA)

Extracted directly from [`HRMA_Modified Buffers.mq5`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-currency-index-pro-plan/HRMA_Modified%20Buffers.mq5):
The HRMA reduces lag dramatically using a triple-smoothed exponential weighting structure:

$$\alpha_1 = \frac{2}{\frac{len}{2} + 1}, \quad \alpha_2 = \frac{2}{len + 1}, \quad \alpha_3 = \frac{2}{\sqrt{len} + 1}$$

Where default $len = 36$ (user-customizable from $10$ to $100$):
For price array $P[t]$:

1. First RMA buffer:
   $$RMA_1[t] = \alpha_1 P[t] + (1 - \alpha_1) RMA_1[t-1]$$
2. Second RMA buffer:
   $$RMA_2[t] = \alpha_2 P[t] + (1 - \alpha_2) RMA_2[t-1]$$
3. Intermediate Hull Difference:
   $$HRMA_{\text{diff}}[t] = 2 \cdot RMA_1[t] - RMA_2[t]$$
4. Final HRMA Line:
   $$HRMA[t] = \alpha_3 HRMA_{\text{diff}}[t] + (1 - \alpha_3) HRMA[t-1]$$

### 4.2 Quantitative Formula: Smoothed Moving Average (SMMA)

Extracted directly from [`SMMA_Modified Buffers.mq5`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-currency-index-pro-plan/SMMA_Modified%20Buffers.mq5):
The SMMA (Wilder's Smoothing) provides a stable, low-noise baseline trend:
Where default $len = 13$ (user-customizable from $5$ to $50$):

1. Initial Bar ($t = len - 1$):
   $$SMMA[len - 1] = \frac{1}{len} \sum_{i=0}^{len-1} P[i]$$
2. Subsequent Bars ($t \ge len$):
   $$SMMA[t] = \frac{SMMA[t-1] \cdot (len - 1) + P[t]}{len}$$

### 4.3 Exact Trigger Definitions

- **Confirmed Bearish Reversal (Sell Currency):**
  1. Currency Index was in **Overbought Zone** ($\ge \text{OB Threshold}$) within the last $K = 6$ bars ($90$ minutes).
  2. $HRMA[t-1] \ge SMMA[t-1]$ AND $HRMA[t] < SMMA[t]$ (**Bearish Cross** on closed bar).
- **Confirmed Bullish Reversal (Buy Currency):**
  1. Currency Index was in **Oversold Zone** ($\le \text{OS Threshold}$) within the last $K = 6$ bars.
  2. $HRMA[t-1] \le SMMA[t-1]$ AND $HRMA[t] > SMMA[t]$ (**Bullish Cross** on closed bar).

---

## 5. Dual-Timeframe Architecture (M5 vs M15)

To balance real-time user responsiveness with institutional signal stability, the system strictly delineates between **M5** and **M15** data flows (Requirements 4, 5, and 6).

### 5.1 Zero-Overhead Resampling (No Extra MT5 Charts)

- In Lane 4, the MT5 terminal on Contabo VPS already exports M5 raw candles for all 7 pairs (`EURUSD`, `USDJPY`, `GBPUSD`, `AUDUSD`, `NZDUSD`, `USDCAD`, `USDCHF`).
- **Resampling Strategy:** Rather than opening 8 additional M15 charts on MT5 (which wastes VPS RAM and CPU), the server/client pipeline constructs M15 bars synthetically by aggregating triplets of M5 bars:
  - Bar 1 (:00–:05), Bar 2 (:05–:10), Bar 3 (:10–:15) $\longrightarrow$ 1 M15 bar.
  - $\text{Open}_{\text{M15}} = \text{Open}_{\text{M5, 1}}$
  - $\text{High}_{\text{M15}} = \max(\text{High}_{\text{M5, 1}}, \text{High}_{\text{M5, 2}}, \text{High}_{\text{M5, 3}})$
  - $\text{Low}_{\text{M15}} = \min(\text{Low}_{\text{M5, 1}}, \text{Low}_{\text{M5, 2}}, \text{Low}_{\text{M5, 3}})$
  - $\text{Close}_{\text{M15}} = \text{Close}_{\text{M5, 3}}$

### 5.2 Component Timeframe Separation

1. **Interactive Chart View (Requirement 4):**
   - Header toggle button: `[ M5 (Scalp 288 Bars) | M15 (Trend 96 Bars) ]`.
   - Allows traders to inspect micro-price action or clean macro swings.
2. **Dashboard Table (Requirement 5):**
   - Fed strictly by **M5**: Updates every 5 minutes with real-time price, current % change, intraday high/low, and instantaneous momentum velocity. Gives the dashboard a living, breathing pulse.
3. **Analysis Table (Requirement 6):**
   - Fed strictly by **M15 closed bars**: The Stage B HRMA x SMMA signal detection runs exclusively on M15 bars. This filters out intra-candle M5 wicks, eliminating up to 75% of false whipsaws.

---

## 6. Universal 28-Pair Confluence Screener & Forex Quoting Rules

### 6.1 Critical Forex Quote vs Base Currency Logic

A common retail error is assuming an index signal translates identically across all pairs. In Forex quoting convention (`BASE / QUOTE`):
$$\text{Long Pair } = \text{Buy Base} + \text{Sell Quote}$$
$$\text{Short Pair } = \text{Sell Base} + \text{Buy Quote}$$

#### The Universal Quoting Invariant:

- When Currency $X$ is **Overbought** (Expect $X$ to weaken $\rightarrow$ **Sell $X$**):
  - If $X$ is **Base** (e.g. $X = \text{EUR}$ in `EURUSD`): $\longrightarrow$ **SELL EURUSD**
  - If $X$ is **Quote** (e.g. $X = \text{JPY}$ in `USDJPY`, `EURJPY`, `GBPJPY`): $\longrightarrow$ **BUY USDJPY, BUY EURJPY, BUY GBPJPY**
- When Currency $X$ is **Oversold** (Expect $X$ to strengthen $\rightarrow$ **Buy $X$**):
  - If $X$ is **Base** (e.g. $X = \text{GBP}$ in `GBPJPY`): $\longrightarrow$ **BUY GBPJPY**
  - If $X$ is **Quote** (e.g. $X = \text{USD}$ in `EURUSD`): $\longrightarrow$ **SELL EURUSD**

### 6.2 Complete 28-Pair Confluence Matrix

The screener evaluates all 28 pure Forex major and minor currency crosses derived from the G8 currency basket $\binom{8}{2} = 28$:

```
Pair Categories (28 Total):
- USD Pairs (7): EURUSD, GBPUSD, AUDUSD, NZDUSD, USDJPY, USDCAD, USDCHF
- EUR Crosses (6): EURGBP, EURJPY, EURAUD, EURNZD, EURCAD, EURCHF
- GBP Crosses (5): GBPJPY, GBPAUD, GBPNZD, GBPCAD, GBPCHF
- AUD Crosses (4): AUDJPY, AUDNZD, AUDCAD, AUDCHF
- NZD Crosses (3): NZDJPY, NZDCAD, NZDCHF
- CAD Crosses (2): CADJPY, CADCHF
- CHF Crosses (1): CHFJPY
```

#### Scoring & Ranking Algorithm for "Top 5 Setups" (Requirement 9):

Each pair is assigned a dynamic **Exploit Score ($S$)**:
$$S_{\text{Pair}} = \left| \text{Index}_{\text{Base}} - \text{Index}_{\text{Quote}} \right| \times W_{\text{Stage}}$$

Where Confluence Weight $W_{\text{Stage}}$:

- $W = 1.0$: Baseline Divergence (Neither currency in extreme zone).
- $W = 1.5$: Single Confluence (One currency in Stage A zone).
- $W = 2.5$: Single Confirmed (One currency confirmed Stage B HRMA cross).
- $W = 4.0$: **Double Confluence (Golden Setup):** One currency Confirmed Sell AND the other Confirmed Buy.

The top 5 scoring pairs populate the **Top 5 Highest Potential Trades** table.

### 6.3 Mandatory Risk Disclaimer & Candlestick Inspection Advisory (Requirement 9)

Prominently anchored above the screener and signals table:

> ⚠️ **Professional Trading Advisory & Risk Protocol:**  
> _"DavinTrade Currency Index Analysis is a relative-strength macro screener designed to highlight institutional capital flow anomalies. **Before executing any order, traders MUST inspect the live candlestick chart of the target pair (evaluating Price Action, Key Support/Resistance structures, Order Blocks, and broker spread)** to confirm exact execution timing and manage risk."_

Each row in the Top 5 and Analysis tables includes a direct quick-action button: `[ 🔍 View Chart ]` opening the respective pair's interactive candlestick modal.

---

## 7. High-Impact News Timeline Markers (Requirement 8)

### 7.1 Integration with Existing Manifest & Schema

Leveraging the live-verified news pipeline documented in [`market-session-and-high-impact-news-manifest-work-completion.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-news-stack/market-session-and-high-impact-news-manifest-work-completion.md), the system links directly to the `EconomicEvent` table in `prisma/market-data/schema.prisma`.

### 7.2 Chart Timeline Overlay

On the Relative Strength multi-line chart, the system projects **Vertical Timeline Markers** for all `HIGH`-importance events scheduled for the current trading day:

```
                +0.78% ---------------------------------------------------- [Overbought]
                       |             |                          |
                       |             |   🔴 14:00 (GBP CPI)     |   🔴 19:30 (USD NFP)
                       |             |       ┆                  |       ┆
                0.00% =======================┆==========================┆=========== [Baseline]
                       |             |       ┆                  |       ┆
                       |             |       ┆                  |       ┆
                -0.78% ----------------------┆--------------------------┆----------- [Oversold]
                      00:00        08:00   14:00                      19:30         23:59
```

- **Query Filter:**
  `SELECT * FROM "EconomicEvent" WHERE importance = 'HIGH' AND currency IN ('USD','EUR','GBP','JPY','AUD','CAD','CHF','NZD') AND event_time BETWEEN :day_start AND :day_end ORDER BY event_time ASC;`
- **Visual Design:**
  - Vertical dashed neon-amber line cutting across the time axis.
  - Event Flag Badge at top: e.g., `🇬🇧 GBP: CPI YoY (14:00 Server)`.
  - **Hover Tooltip:** Shows Event Title, Country, Forecast, Previous, and Affected Pairs.
  - **Pre-News Alert:** 15 minutes before the vertical line, the chart header displays a pulsing banner: `⚠️ High Impact Event Approaching: USD Non-Farm Payrolls in 14m`.

---

## 8. Database Architecture & Schema Extensions (Requirement 7)

To support 20-day historical lookback aggregations, user custom presets, and persistent alert histories without burdening the live `market_indices_m5` table, four dedicated models are introduced into the PostgreSQL schema.

### 8.1 Prisma Schema Definition (`prisma/market-data/schema.prisma`)

```prisma
/// Pre-aggregated daily metrics per currency index to make 5-60 day lookback
/// corridor queries instantaneous (< 2ms) without scanning raw intraday ticks.
model DailyCurrencyIndexMetrics {
  id            String   @id @default(cuid())
  date          DateTime @db.Date // MT5 00:00 midnight date
  index_name    String   @db.VarChar(10) // USDX, EURX, GBPX, JPYX, AUDX, CADX, CHFX, NZDX
  open_value    Float    // Inception index value at 00:00
  peak_high_pct Float    // Max intraday % gain from open
  peak_low_pct  Float    // Max intraday % loss from open (absolute value)
  close_pct     Float    // % change at 23:59 session close
  created_at    DateTime @default(now())

  @@unique([date, index_name])
  @@index([date])
  @@map("daily_currency_index_metrics")
}

/// Stores the daily system-calculated Dynamic Volatility Corridors for each calendar day.
model DailyVolatilityCorridor {
  id               String   @id @default(cuid())
  date             DateTime @unique @db.Date
  lookback_days    Int      @default(20)
  strike_zone_pct  Float    // Tier 1 Overbought/Oversold (+- mu)
  extreme_zone_pct Float    // Tier 2 Extreme Exhaustion (+- (mu + sigma))
  mean_excursion   Float    // Raw mu
  std_dev          Float    // Raw sigma
  calculated_at    DateTime @default(now())

  @@map("daily_volatility_corridors")
}

/// Audit log of generated Stage A and Stage B trading signals.
model CurrencyIndexSignal {
  id          String   @id @default(cuid())
  timeframe   String   @default("M15") // M15
  bar_time    DateTime // Exact bar open timestamp
  index_name  String   @db.VarChar(10)
  index_value Float
  hrma_val    Float
  smma_val    Float
  zone_state  String   @db.VarChar(20) // OVERBOUGHT | OVERSOLD | NEUTRAL
  signal_type String   @db.VarChar(30) // CONFIRMED_BUY | CONFIRMED_SELL | NONE
  top_pairs   Json     // Array of suggested pairs: [{"pair": "GBPJPY", "action": "BUY", "rank": 1}]
  created_at  DateTime @default(now())

  @@index([bar_time, index_name])
  @@map("currency_index_signals")
}

/// User-specific custom overrides for indicator periods and zones.
model UserCurrencyIndexPreference {
  id              String   @id @default(cuid())
  user_id         String   @unique
  lookback_days   Int      @default(20)
  use_auto_zones  Boolean  @default(true)
  custom_ob_pct   Float?   // e.g. 0.85
  custom_os_pct   Float?   // e.g. -0.85
  hrma_period     Int      @default(36)
  smma_period     Int      @default(13)
  preferred_tf    String   @default("M15") // M5 or M15
  updated_at      DateTime @updatedAt

  @@map("user_currency_index_preferences")
}
```

---

## 9. API Gateway Contracts & Endpoints

All endpoints are hosted on the Railway NestJS Gateway under `/api/v1/market-indices/pro`.

### 9.1 Endpoint: `GET /api/v1/market-indices/pro/chart`

Returns the synchronized multi-line series for all 8 currencies, dynamic corridor goalposts, and high-impact news markers.

**Query Parameters:**

- `timeframe`: `M5` | `M15` (default `M15`)
- `date`: `YYYY-MM-DD` (default today)

**Response Payload Contract (JSON):**

```json
{
  "success": true,
  "serverTime": "2026-09-12T08:30:00Z",
  "resetCountdownSeconds": 12600,
  "timeframe": "M15",
  "corridor": {
    "lookbackDays": 20,
    "strikeZonePct": 0.78,
    "extremeZonePct": 1.05,
    "isAuto": true
  },
  "highImpactNews": [
    {
      "id": "cuid_news_01",
      "eventTime": 1789135200,
      "currency": "GBP",
      "eventName": "Consumer Price Index YoY",
      "countryCode": "GB",
      "forecast": "2.2%",
      "previous": "2.0%"
    },
    {
      "id": "cuid_news_02",
      "eventTime": 1789155000,
      "currency": "USD",
      "eventName": "Non-Farm Payrolls",
      "countryCode": "US",
      "forecast": "165K",
      "previous": "142K"
    }
  ],
  "series": {
    "timestamps": [1789104000, 1789104900, 1789105800],
    "USDX": [-0.05, -0.12, 0.08],
    "EURX": [0.1, 0.22, 0.35],
    "GBPX": [0.25, 0.55, 0.82],
    "JPYX": [-0.2, -0.45, -0.79],
    "AUDX": [0.02, 0.05, -0.04],
    "CADX": [-0.1, -0.15, -0.22],
    "CHFX": [0.08, 0.14, 0.18],
    "NZDX": [0.01, -0.02, -0.08]
  }
}
```

### 9.2 Endpoint: `GET /api/v1/market-indices/pro/screener`

Returns the dual-table dataset: fast M5 Dashboard Table + noise-reduced M15 Analysis Table with ranked Top 5 opportunities.

**Response Payload Contract (JSON):**

```json
{
  "success": true,
  "updatedAt": "2026-09-12T08:30:00Z",
  "spreadDelta": {
    "spreadPct": 1.61,
    "status": "EXTREME",
    "leader": { "currency": "GBP", "changePct": 0.82 },
    "laggard": { "currency": "JPY", "changePct": -0.79 }
  },
  "top5Trades": [
    {
      "rank": 1,
      "pair": "GBPJPY",
      "action": "STRONG BUY",
      "divergenceSpread": 1.61,
      "confluenceLevel": "DOUBLE_CONFIRMED",
      "stageAStatus": "Both in Extreme Zone",
      "stageBStatus": "Confirmed M15 Cross",
      "statusLabel": "PRIME READY"
    },
    {
      "rank": 2,
      "pair": "EURJPY",
      "action": "BUY",
      "divergenceSpread": 1.14,
      "confluenceLevel": "SINGLE_CONFIRMED",
      "stageAStatus": "JPY Oversold",
      "stageBStatus": "Confirmed M15 Cross",
      "statusLabel": "ACTIVE"
    }
  ],
  "dashboardTableM5": [
    {
      "currency": "USD",
      "price": 101.45,
      "changePct": 0.08,
      "highPct": 0.15,
      "lowPct": -0.18,
      "momentum": "NEUTRAL"
    }
  ],
  "analysisTableM15": [
    {
      "currency": "JPY",
      "indexName": "JPYX",
      "currentPct": -0.79,
      "zone": "OVERSOLD",
      "hrma": -0.77,
      "smma": -0.72,
      "crossoverState": "BULLISH_REVERSAL_CONFIRMED",
      "recommendedActions": [
        { "pair": "USDJPY", "action": "BUY" },
        { "pair": "EURJPY", "action": "BUY" },
        { "pair": "GBPJPY", "action": "BUY" }
      ]
    }
  ]
}
```

---

## 10. Frontend Component Architecture & UI Layout

Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS**, and **TradingView Lightweight Charts v4**.

```
components/currency-index-pro/
├── pro-currency-index-cockpit.tsx          # Master Page Container
├── chart/
│   ├── relative-strength-chart.tsx        # Multi-line Canvas + Horizontal Bands + Vertical News
│   ├── chart-control-header.tsx           # Timeframe switch, Countdown, Spread Delta Gauge
│   ├── indicator-settings-modal.tsx       # Sliders for Lookback, OB/OS, HRMA, SMMA
│   └── high-impact-news-tooltip.tsx       # Interactive tooltip on vertical timeline markers
├── tables/
│   ├── top5-screener-card.tsx             # Ranked Top 5 highest-probability pairs
│   ├── trading-advisory-banner.tsx        # Mandatory Candlestick Inspection Disclaimer
│   ├── dashboard-table-m5.tsx             # Real-time M5 price velocity table
│   └── analysis-table-m15.tsx             # M15 Stage A/B Signals & Pair Mapper
└── hooks/
    ├── use-pro-currency-chart.ts          # SWR data fetcher with real-time polling (30s)
    └── use-indicator-preferences.ts       # LocalStorage + DB Preference sync
```

### Visual Layout Mockup (PRO Cockpit):

```
+---------------------------------------------------------------------------------------------------------+
|  [ ⏳ Reset in: 03h 42m ]   [ M5 | M15 ]   [ 🔥 MAX GAP: 1.61% - LONG GBPJPY ]   [ ⚙️ Settings (PRO) ]   |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  +1.05%  ------------------------------------------------------------- [Tier 2 Extreme Exhaustion]     |
|                                                     🔴 14:00 (GBP CPI)                                  |
|  +0.78%  - - - - - - - - - - - - - - - - - - - - - - - -┆- - - - - - - [Tier 1 Strike Zone: Overbought] |
|                                                         ┆                                               |
|   0.00%  ===============================================┆================================== [Baseline]   |
|                                                         ┆                                               |
|  -0.78%  - - - - - - - - - - - - - - - - - - - - - - - -┆- - - - - - - [Tier 1 Strike Zone: Oversold]   |
|                                                         ┆                                               |
|  -1.05%  -----------------------------------------------┆------------- [Tier 2 Extreme Exhaustion]     |
|         00:00                06:00                    14:00                     20:00             23:59 |
+---------------------------------------------------------------------------------------------------------+
| ⚠️ TRADING ADVISORY: Always verify target pair's candlestick chart & S/R before executing orders!      |
+---------------------------------------------------------------------------------------------------------+
| 🏆 TOP 5 HIGHEST POTENTIAL TRADES (REAL-TIME SCREENER)                                                  |
| 1. GBPJPY  |  STRONG BUY   |  Spread: 1.61% 🔥  |  Double Confirmed (Stage A+B)  |  [ 🔍 View Chart ]   |
| 2. EURJPY  |  BUY          |  Spread: 1.14%     |  Stage B Confirmed Cross       |  [ 🔍 View Chart ]   |
+---------------------------------------------------------------------------------------------------------+
| 📊 DASHBOARD TABLE (M5 Fast Data)         | 🎯 ANALYSIS TABLE (M15 Reversal Signals)                    |
| Currency | Price | Change% | High% | Low% | Index | Status   | HRMA x SMMA Cross | Target Pairs     |
| GBP      | 1.312 | +0.82%  | +0.85 | +0.1 | GBPX  | Overbought| Bearish Reversal | SELL GBPUSD, ... |
| JPY      | 142.3 | -0.79%  | +0.10 | -0.8 | JPYX  | Oversold  | Bullish Reversal | BUY USDJPY, ...  |
+---------------------------------------------------------------------------------------------------------+
```

---

## 11. Implementation Roadmap & Execution Plan for Claude Code

The implementation is structured into 5 logical, verifiable phases:

### Phase 1: Database Migration & 00:00 MT5 Midnight Cron

1. Update `prisma/market-data/schema.prisma` with the 4 new models (`DailyCurrencyIndexMetrics`, `DailyVolatilityCorridor`, `CurrencyIndexSignal`, `UserCurrencyIndexPreference`).
2. Run migration using the repo's verified direct connection parameter:
   `pnpm prisma migrate dev --name add_pro_currency_index_tables`.
3. Implement a nightly cron service (`daily-corridor-aggregator.service.ts`) running at 00:00:15 MT5:
   - Aggregates the previous day's peak excursion data into `DailyCurrencyIndexMetrics`.
   - Computes the new $\mu_{\text{basket}}$ and $\sigma_{\text{basket}}$ across the last 20 days.
   - Upserts today's `DailyVolatilityCorridor`.

### Phase 2: Gateway Calculation Services & Resampling Engine

1. Implement `pro-currency-index.service.ts` in NestJS Gateway:
   - Raw M5-to-M15 Resampling utility function.
   - High-Impact News query integration from `EconomicEvent`.
   - Real-time HRMA (36) and SMMA (13) calculation buffers.
   - Confluence scoring engine for the 28-pair ranking.
2. Expose REST endpoints:
   - `GET /api/v1/market-indices/pro/chart`
   - `GET /api/v1/market-indices/pro/screener`
   - `GET/PUT /api/v1/market-indices/pro/preferences`

### Phase 3: High-Performance Frontend Chart & News Markers

1. Build `relative-strength-chart.tsx` using Lightweight Charts:
   - 8 custom color-coded LineSeries initialized to 0.00% at bar 0.
   - Dynamic PriceLines for Tier 1 and Tier 2 Overbought/Oversold thresholds.
   - Add Custom Plugin / Markers for High-Impact News vertical timeline indicators.
2. Implement header controls:
   - Timeframe switcher (`M5` vs `M15`).
   - Countdown timer hook (`use-session-countdown.ts`).
   - Spread Delta Gauge with dynamic pulse animations.

### Phase 4: Screener Tables, Settings Modal & Disclaimer Banner

1. Build `top5-screener-card.tsx` with dynamic sorting and action badge styling.
2. Build `dashboard-table-m5.tsx` and `analysis-table-m15.tsx`.
3. Embed `trading-advisory-banner.tsx` with risk disclaimers and candlestick preview modals.
4. Implement `indicator-settings-modal.tsx` with debounced reactivity and persistence.

### Phase 5: Verification & End-to-End Validation

1. Verify MT5 server-time alignment (GMT+3) with news release timestamps.
2. Backtest HRMA x SMMA M15 crossover precision against MQL5 indicator output.
3. Validate client-side recalculation performance (< 16ms, 60fps render cycle).

---

## 12. Verification & Acceptance Checklist

| ID     | Verification Item                 | Target Acceptance Criteria                                                                                         | Status  |
| :----- | :-------------------------------- | :----------------------------------------------------------------------------------------------------------------- | :------ |
| **V1** | **Dynamic Corridor Accuracy**     | $\mu_{\text{basket}}$ computed from 20-day historical excursions matches Python pandas verification within 0.001%. | Pending |
| **V2** | **Forex Quoting Direction**       | JPYX Overbought triggers **BUY USDJPY**, **BUY EURJPY**, **BUY GBPJPY** in 100% of cases.                          | Pending |
| **V3** | **Dual Timeframe Integrity**      | Dashboard Table updates on M5; Analysis Table signals trigger strictly on closed M15 bars.                         | Pending |
| **V4** | **News Timeline Alignment**       | High-impact events appear at the exact minute timestamp on the chart time-axis.                                    | Pending |
| **V5** | **User Customization Reactivity** | Adjusting OB/OS sliders updates chart threshold lines and table badges in < 5ms.                                   | Pending |
| **V6** | **Top 5 Ranking Stability**       | Double Confluence pairs (Stage A + Stage B) receive highest ranking weight ($W = 4.0$).                            | Pending |
| **V7** | **Advisory Banner Presence**      | Disclaimer is permanently visible above the screener with functional chart preview triggers.                       | Pending |

---

_Authored by Antigravity Quantitative Architecture Team for DavinTrade SaaS Platform._
