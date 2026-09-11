# DavinTrade Architecture Design: Currency & Gold Index Stack (Lane 4)

**Authoritative Architectural Specification & Implementation Blueprint**
**Status:** Production Ready / Implementation Baseline
**Target Deployment:** Contabo Windows VPS (MT5 + Python) ──► Railway Cloud (NestJS + Postgres + Redis) ──► Next.js Landing Page UI (`davintrade.app`)
**Document Path:** `D:\SaaS Project\trading-alerts-saas-public\davintrade-currency-index-stack\COMPREHENSIVE_ARCHITECTURE_DESIGN_CURRENCY_AND_GOLD_INDEX_STACK.md`

---

## 1. Executive Summary & Strategic Objectives

### 1.1 Business & Marketing Vision

The **Currency & Gold Index Stack** is the primary front-door marketing asset and utility hook for **DavinTrade SaaS** (`davintrade.app`).

Gold (`XAUUSD`) traders operate in a global multi-currency ecosystem. They rarely trade gold in isolation; rather, they constantly monitor the macro flow of capital across G8 currencies (`USD`, `EUR`, `GBP`, `JPY`, `AUD`, `NZD`, `CAD`, `CHF`).

By introducing an **Equal-Weighted G8 Currency Index Suite + Rebased Gold Index (XAUX)** with intraday floating-baseline sparklines on the DavinTrade landing page:

1. **Instant Quantitative Credibility (Aha! Moment):** First-time visitors immediately perceive DavinTrade as an institutional-grade quantitative intelligence terminal, not another generic retail signal bot.
2. **Habit-Forming Utility (Top of Mind):** Traders bookmark and pin DavinTrade to their smartphone home screen (PWA) to inspect currency strength and gold momentum every morning before the London/New York market open.
3. **Natural Conversion Ladder (Freemium ──► PRO Plan):**
   - **Free Tier (Landing Page):** Unbiased market overview of 9 indices + educational tooltips.
   - **PRO Plan Paywall:** Automated _Strong-vs-Weak 32-Currency-Pair Screener_ and real-time execution signals derived from this exact same data engine.

---

## 2. System Architecture & End-to-End Data Flow

In strict compliance with `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` (§2 & §5.5), this system is implemented as **"Lane 4: Currency & Gold Indices"** — a completely independent, parallel pipeline isolated from the load-bearing `market_data` (XAUUSD M5/M15 alert) pipeline.

```
┌──────────────────────────────────────── Windows VPS (Contabo) ────────────────────────────────────────┐
│                                                                                                       │
│  MT5 Terminal                                                                                         │
│  ├─ 7 Forex Charts (M5): EURUSD, USDJPY, GBPUSD, AUDUSD, NZDUSD, USDCAD, USDCHF                       │
│  │   └─ ohlcvexportlightweight_v2_29.mq5 ──(Exports OHLCV_*.txt every 1 min at :59)──┐                │
│  └─ 1 Gold Chart (M5): XAUUSD (Existing pipeline export)                              │                │
│                                                                                       ▼                │
│  Python Lane 4 Engine (currency_index_engine.py)                                     Local Disk        │
│  ├─ Cadence: Fires every 5 minutes at :05 (e.g. 12:00:05, 12:05:05...)              MQL5/Files/       │
│  ├─ 1. Ingest & Align 7 FX pairs + XAUUSD                                                              │
│  ├─ 2. Forward-Fill (ffill) missing bars to prevent NaN propagation                                   │
│  ├─ 3. Session Open Check (MT5 Server 00:00 for FX, 01:00 for Gold) ──► Rebase / Inception Reset      │
│  ├─ 4. Compute 8 Equal-Weighted Currency Indices + 1 Rebased Gold Index                                │
│  └─ 5. Push Batch via HTTPS ──────────────────────────────────────────────────────────┐                │
└───────────────────────────────────────────────────────────────────────────────────────┼────────────────┘
                                                                                        │ HTTPS POST
                                                                                        │ (Payload < 5 KB)
┌──────────────────────────────────────── Railway Cloud Infrastructure ─────────────────┼────────────────┐
│                                                                                       │                │
│  NestJS API Gateway                                                                   │                │
│  └─ POST /api/v1/market-indices ◄─────────────────────────────────────────────────────┘                │
│      ├─ Validate schema (gateway_contract_currency_indices.schema.json)                                │
│      ├─ Upsert PostgreSQL (`market_indices_m5` & `forex_ohlcv_m5`)                                     │
│      └─ Invalidate / Update Redis Cache Key (`cache:market_indices:today`, TTL: 60s)                   │
│                                                                                                        │
│  PostgreSQL Database                         Redis In-Memory Cache                                     │
│  ┌───────────────────────────────┐           ┌───────────────────────────────────────────┐             │
│  │ market_indices_m5             │           │ "cache:market_indices:today"              │             │
│  │ forex_ohlcv_m5                │           │ Aggregated 288-bar sparkline JSON payload │             │
│  └───────────────────────────────┘           └─────────────────────┬─────────────────────┘             │
└────────────────────────────────────────────────────────────────────┼───────────────────────────────────┘
                                                                     │ Fast HTTP GET
                                                                     │ (< 20ms Latency)
┌──────────────────────────────────────── Public Web Clients ────────┼───────────────────────────────────┐
│                                                                    ▼                                   │
│  Next.js 16 Landing Page (`davintrade.app`)                                                           │
│  └─ Hero Section Widget                                                                                │
│      ├─ SWR Hook (Polls every 60s, serves from Redis Cache)                                            │
│      ├─ Scrollable List (4 Visible, 5 Scrollable)                                                      │
│      ├─ Two-Tone Floating Sparkline SVG Component (Baseline = Inception / Prev Close)                  │
│      └─ Interactive Educational Tooltips (@radix-ui/react-tooltip)                                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Upstream: MT5 Data Export (Contabo VPS)

### 3.1 Exporter Component

- **Script:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/mq5/ohlcvexportlightweight_v2_29.mq5`
- **Deployed Timeframe:** `M5`
- **Pairs in Scope:**
  1. `EURUSD`
  2. `USDJPY`
  3. `GBPUSD`
  4. `AUDUSD`
  5. `NZDUSD`
  6. `USDCAD`
  7. `USDCHF`
     _(Note: `XAUUSD` M5 OHLCV is already being exported by the existing v2.29 pipeline)._

### 3.2 Configuration Parameters

```ini
InpSymbolSelection      = 0          ; SYMBOL_CURRENT
InpTimeframe            = 5          ; PERIOD_M5
InpBars                 = 3000       ; Sufficient history for intraday sessions
InpBaseFileName         = "OHLCV"    ; Output filename prefix
InpCleanFilenames       = true       ; Strips .i suffix from filename
InpAutoExport           = true       ; Automatically export every minute
InpExportSecond         = 59         ; Fires at :59 of every minute
InpTryBothSuffixVersions= true       ; Auto-detects standard vs .i symbols
```

### 3.3 Output File Contract

- Output directory: Terminal's `MQL5/Files/`
- Filename convention: `OHLCV_{SYMBOL}_M5.txt` (e.g. `OHLCV_EURUSD_M5.txt`, `OHLCV_USDJPY_M5.txt`)
- Format: Tab-separated, UTF-8, with header:
  `timestamp\topen\thigh\tlow\tclose\tvolume`
- Concurrency Safety: All MQL5 file handles must open with `FILE_SHARE_READ` to allow Python to read without file-lock collisions.

### 3.4 Authoritative MQL5 Source Code References

The mathematical models and exponent structures implemented in the Python Lane 4 Engine are directly transliterated from the authoritative MQL5 indicator scripts located in:
📂 `D:\SaaS Project\trading-alerts-saas-public\mql5-indicators\interesting-indicators\currency-and-gold-index\`

| Target Index | Authoritative MQL5 Source File | Mathematical Role & Formula Reference                                                                                      |
| :----------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **USDX**     | `USDX.mq5`                     | Geometric product of 7 USD crosses with equal weights ($W=0.142857$)                                                       |
| **AUDX**     | `AUDX.mq5`                     | AUD broad valuation across 7 crosses with equal weights ($W=0.142857$)                                                     |
| **CADX**     | `CADX.mq5`                     | CAD broad valuation across 7 crosses with equal weights ($W=0.142857$)                                                     |
| **CHFX**     | `CHFX.mq5`                     | CHF broad valuation across 7 crosses with equal weights ($W=0.142857$)                                                     |
| **GBPX**     | `GBPX.mq5`                     | GBP broad valuation across 7 crosses with equal weights ($W=0.142857$)                                                     |
| **JPYX**     | `JPYX.mq5`                     | JPY broad valuation across 7 crosses with equal weights ($W=0.142857$)                                                     |
| **NZDX**     | `NZDX.mq5`                     | NZD broad valuation across 7 crosses with equal weights ($W=0.142857$)                                                     |
| **EURX**     | _Derived Symmetrically_        | Synthesized from `USDX.mq5` / `GBPX.mq5` symmetry rules ($W=0.142857$)                                                     |
| **XAUX**     | `Rebased Gold Price H4.mq5`    | Inception rebasing math: $\text{Factor} = \frac{\text{BaseIndexValue}}{\text{InceptionPrice}}$, adapted to M5 session open |

> **Instruction for Claude Code:** When implementing `currency_index_engine.py`, inspect these specific `.mq5` files in `mql5-indicators/interesting-indicators/currency-and-gold-index/` to verify exponent signs, weights, and buffer calculations against the ground truth.

---

## 4. Python Calculation & Session Engine (Lane 4)

### 4.1 Execution Cadence & Alignment

- Engine runs as a dedicated Python daemon / cron on the Contabo VPS (`currency_index_engine.py`).
- **Trigger Schedule:** Every 5 minutes at second `:05` (e.g., `00:00:05`, `00:05:05`, `00:10:05`...).
- **Why at `:05`?** This guarantees the file written at `:59` contains the completed, immutable M5 candle.
- **Retry Buffer:** If any file is locked or incomplete, wait `65s` and retry on the next 1-minute export snapshot.

### 4.2 Handling Missing Ticks & Asynchronous Bars

Because illiquid pairs (e.g., NZDUSD in Asian night hours) may miss tick updates on certain 5-minute intervals:

- The Python ingestion layer performs a timestamp outer merge across all 7 pairs.
- Any missing bar close is populated using **Forward Fill (`ffill`)** from the preceding bar's close price.
- Calculation NEVER aborts due to a single missing tick.

### 4.3 MT5 Server Time & Session Reset Logic (Eightcap Broker Standard)

The production Contabo VPS terminal is standardized on **Eightcap** broker (Eightcap-Demo / Eightcap-Live), operating on **UTC+2 (Winter) / UTC+3 (Summer / US DST)**. As confirmed by the trading infrastructure team, **there is zero broker variance** in this deployment:

- **Forex Day Open (`00:00:00` Eightcap Server Time):**
  - Eightcap opens Forex market trading promptly at `00:00:00` server time.
  - The bar starting at `00:00:00` is the deterministic **Session Inception Bar** for all 8 Currency Indices (`USDX`, `EURX`, `JPYX`, `GBPX`, `AUDX`, `NZDX`, `CADX`, `CHFX`).
  - Base index value is set to `100.00`.
- **Gold Market Open (`01:00:00` / `01:01:00` Eightcap Server Time):**
  - Eightcap halts XAUUSD trading daily during the rollover maintenance window (`23:59 - 01:01` server time).
  - Therefore, the Gold Index (`XAUX`) Inception Bar is the first confirmed M5 bar at market open (`01:01:00` server time).
  - The base index value for `XAUX` is initialized to `100.00` based on this opening price.
- **Duration:** The sparkline on the landing page displays from Day Open (00:00 for FX, 01:01 for Gold) up to the current bar, resetting cleanly at the start of each new Eightcap trading day.

---

## 5. Mathematical Specifications for the 9 Indices

### 5.1 The 8 G8 Currency Indices (Equal-Weighted Geometric Model)

To eliminate the severe Euro-bias inherent in the traditional ICE US Dollar Index (where EUR represents 57.6%), DavinTrade implements an **Unbiased Equal-Weighted Geometric Basket** ($W_k = \frac{1}{7} \approx 0.142857$).

For any currency $X \in \{\text{USD, EUR, JPY, GBP, AUD, NZD, CAD, CHF}\}$, the index is calculated from the exchange rates against the remaining 7 currencies:

$$\text{Index}_X(t) = C_X \times \prod_{k=1}^{7} \left( \text{Rate}_k(t) \right)^{\pm W_k}$$

Where:

- Exponent is **$+W_k$** if Currency $X$ is the **Base** currency in the pair.
- Exponent is **$-W_k$** if Currency $X$ is the **Quote** currency in the pair.
- $C_X$ is the session normalization constant setting Inception Value = $100.00$:
  $$C_X = \frac{100.00}{\prod_{k=1}^{7} \left( \text{Rate}_k(\text{Inception}) \right)^{\pm W_k}}$$

#### Formula Matrix for All 8 Currency Indices:

| Index    | Base Currency | Formula ($W = 0.142857$)                                                                                                                                                                                      |
| :------- | :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **USDX** | USD           | $C_{\text{USD}} \cdot (\text{EURUSD})^{-W} \cdot (\text{USDJPY})^{+W} \cdot (\text{GBPUSD})^{-W} \cdot (\text{AUDUSD})^{-W} \cdot (\text{NZDUSD})^{-W} \cdot (\text{USDCAD})^{+W} \cdot (\text{USDCHF})^{+W}$ |
| **EURX** | EUR           | $C_{\text{EUR}} \cdot (\text{EURUSD})^{+W} \cdot (\text{EURJPY})^{+W} \cdot (\text{EURGBP})^{+W} \cdot (\text{EURAUD})^{+W} \cdot (\text{EURNZD})^{+W} \cdot (\text{EURCAD})^{+W} \cdot (\text{EURCHF})^{+W}$ |
| **JPYX** | JPY           | $C_{\text{JPY}} \cdot (\text{USDJPY})^{-W} \cdot (\text{EURJPY})^{-W} \cdot (\text{GBPJPY})^{-W} \cdot (\text{AUDJPY})^{-W} \cdot (\text{NZDJPY})^{-W} \cdot (\text{CADJPY})^{-W} \cdot (\text{CHFJPY})^{-W}$ |
| **GBPX** | GBP           | $C_{\text{GBP}} \cdot (\text{GBPUSD})^{+W} \cdot (\text{EURGBP})^{-W} \cdot (\text{GBPJPY})^{+W} \cdot (\text{GBPAUD})^{+W} \cdot (\text{GBPNZD})^{+W} \cdot (\text{GBPCAD})^{+W} \cdot (\text{GBPCHF})^{+W}$ |
| **AUDX** | AUD           | $C_{\text{AUD}} \cdot (\text{AUDUSD})^{+W} \cdot (\text{EURAUD})^{-W} \cdot (\text{GBPAUD})^{-W} \cdot (\text{AUDJPY})^{+W} \cdot (\text{AUDNZD})^{+W} \cdot (\text{AUDCAD})^{+W} \cdot (\text{AUDCHF})^{+W}$ |
| **NZDX** | NZD           | $C_{\text{NZD}} \cdot (\text{NZDUSD})^{+W} \cdot (\text{EURNZD})^{-W} \cdot (\text{GBPNZD})^{-W} \cdot (\text{AUDNZD})^{-W} \cdot (\text{NZDJPY})^{+W} \cdot (\text{NZDCAD})^{+W} \cdot (\text{NZDCHF})^{+W}$ |
| **CADX** | CAD           | $C_{\text{CAD}} \cdot (\text{USDCAD})^{-W} \cdot (\text{EURCAD})^{-W} \cdot (\text{GBPCAD})^{-W} \cdot (\text{AUDCAD})^{-W} \cdot (\text{NZDCAD})^{-W} \cdot (\text{CADJPY})^{+W} \cdot (\text{CADCHF})^{+W}$ |
| **CHFX** | CHF           | $C_{\text{CHF}} \cdot (\text{USDCHF})^{-W} \cdot (\text{EURCHF})^{-W} \cdot (\text{GBPCHF})^{-W} \cdot (\text{AUDCHF})^{-W} \cdot (\text{NZDCHF})^{-W} \cdot (\text{CADCHF})^{-W} \cdot (\text{CHFJPY})^{+W}$ |

_Note on Synthetic Crosses:_ Cross rates (e.g. `EURJPY`, `EURGBP`) are computed directly from the 7 primary USD pairs:
$$\text{EURJPY} = \text{EURUSD} \times \text{USDJPY}, \quad \text{EURGBP} = \frac{\text{EURUSD}}{\text{GBPUSD}}, \quad \text{AUDCAD} = \text{AUDUSD} \times \text{USDCAD}, \quad \text{etc.}$$
Thus, no cross-pair charts need to be opened in MT5!

---

### 5.2 Gold Index (XAUX) Rebased M5

Adapted from `Rebased Gold Price H4.mq5` into an M5 intraday index:

$$\text{XAUX}(t) = \frac{\text{XAUUSD}(t)}{\text{XAUUSD}(\text{Session Open})} \times 100.00$$

Where:

- $\text{XAUUSD}(\text{Session Open})$ is the market open price at `01:00:00` MT5 Server Time.
- $\text{XAUX}(t) > 100.00$ indicates net intraday appreciation.
- $\text{XAUX}(t) < 100.00$ indicates net intraday depreciation.

---

## 6. Downstream: Data Contracts, Storage & Caching

### 6.1 PostgreSQL Consolidated Schemas

To prevent schema bloat and high connection pooling costs, avoid creating separate tables per pair. Use two consolidated tables:

```sql
-- 1. Raw Forex OHLCV (5-Minute Bars)
CREATE TABLE IF NOT EXISTS forex_ohlcv_m5 (
    symbol VARCHAR(12) NOT NULL,
    bar_time TIMESTAMPTZ NOT NULL,
    open NUMERIC(12, 5) NOT NULL,
    high NUMERIC(12, 5) NOT NULL,
    low NUMERIC(12, 5) NOT NULL,
    close NUMERIC(12, 5) NOT NULL,
    volume BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (symbol, bar_time)
);
CREATE INDEX IF NOT EXISTS idx_forex_ohlcv_lookup
ON forex_ohlcv_m5 (symbol, bar_time DESC);

-- 2. Computed Currency & Gold Indices (5-Minute Bars)
CREATE TABLE IF NOT EXISTS market_indices_m5 (
    index_name VARCHAR(10) NOT NULL, -- 'XAUX', 'USDX', 'EURX', etc.
    bar_time TIMESTAMPTZ NOT NULL,
    value NUMERIC(12, 4) NOT NULL,
    change_pct NUMERIC(6, 3) NOT NULL, -- Relative % change from session open
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (index_name, bar_time)
);
CREATE INDEX IF NOT EXISTS idx_market_indices_lookup
ON market_indices_m5 (index_name, bar_time DESC);
```

### 6.2 Gateway Contract & Payload Safety

- Railway API Gateway (NestJS on Express) enforces a strict **100 KB payload ceiling** (HTTP 413 guard).
- The 5-minute push payload transmits exactly **9 rows** (one per index), with an estimated payload size of **~1.5 KB**, completely immune to 413 rejections.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GatewayContractCurrencyIndices",
  "type": "object",
  "required": ["bar_time", "indices"],
  "properties": {
    "bar_time": { "type": "string", "format": "date-time" },
    "indices": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["index_name", "value", "change_pct"],
        "properties": {
          "index_name": {
            "type": "string",
            "enum": [
              "XAUX",
              "USDX",
              "EURX",
              "JPYX",
              "GBPX",
              "AUDX",
              "NZDX",
              "CADX",
              "CHFX"
            ]
          },
          "value": { "type": "number" },
          "change_pct": { "type": "number" }
        }
      }
    }
  }
}
```

### 6.3 Redis Caching Strategy (Landing Page DDoS Guard)

Landing page visitors must **NEVER** query PostgreSQL directly.

- Key: `cache:market_indices:today`
- Cache Engine: Redis (or in-memory cache) with TTL = 60 seconds.
- Pre-computed response payload size: **~5 KB** total for all 9 indices.

```json
[
  {
    "symbol": "XAUX",
    "name": "Gold Index",
    "price": 699.82,
    "change_pct": -0.30,
    "previousClose": 701.90,
    "sparkline": [701.90, 702.10, 700.40, 698.50, ..., 699.82]
  },
  {
    "symbol": "USDX",
    "name": "USD Index",
    "price": 837.46,
    "change_pct": 0.10,
    "previousClose": 836.60,
    "sparkline": [836.60, 836.80, 837.10, ..., 837.46]
  }
]
```

---

## 7. Frontend UI: Hero Section Widget & Floating Sparkline

### 7.1 Visual Layout & Placement

- Embedded in the **Hero Section** of `davintrade.app`, positioned directly underneath the Primary CTA buttons (`Get Started Free`, `View Pricing`) and to the left of the `XAUUSD M15 Workbench` raccoon graphic.
- **Display Constraint:** The widget displays **4 indices visible simultaneously**, with a sleek custom scrollbar enabling users to scroll down to view the remaining 5 indices.
- **Component Height:** Fixed container height `~240px` with `overflow-y: auto`.

### 7.2 Floating-Baseline Sparkline Specifications

- Built with **Zero-Dependency Pure React SVG** for maximum rendering speed and zero main-thread jank.
- **Floating Reference Line (Baseline):**
  - Represents the session open / reference price.
  - Floats dynamically in the Y-space: at the top (if prices fell all day), at the bottom (if prices rose all day), or in the middle (if prices oscillated across positive/negative territory).
- **Color Psychology:**
  - Positive Session: Cyan / Green stroke (`#06b6d4` or `#22c55e`), subtle downward fading gradient.
  - Negative Session: Rose / Purple / Red stroke (`#f43f5e` or `#ef4444`), subtle downward fading gradient.
- **End-Point Dot (Circle Marker):** A distinct `3px` radius circle anchored at `(lastX, lastY)` indicating real-time price location.

```tsx
// components/market/floating-sparkline.tsx
'use client';

import React, { useId } from 'react';

interface FloatingSparklineProps {
  data: number[];
  previousClose: number;
  width?: number;
  height?: number;
}

export function FloatingSparkline({
  data,
  previousClose,
  width = 110,
  height = 38,
}: FloatingSparklineProps) {
  const gradientId = useId();
  if (!data || data.length < 2)
    return <div style={{ width, height }} className="bg-muted/10 rounded" />;

  const allValues = [...data, previousClose];
  let minVal = Math.min(...allValues);
  let maxVal = Math.max(...allValues);
  const diff = maxVal - minVal || 1;
  minVal -= diff * 0.08;
  maxVal += diff * 0.08;
  const range = maxVal - minVal;

  const padX = 4;
  const padY = 3;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const getY = (val: number) =>
    height - padY - ((val - minVal) / range) * chartH;
  const getX = (idx: number) => padX + (idx / (data.length - 1)) * chartW;

  const baselineY = getY(previousClose);
  const lastPrice = data[data.length - 1];
  const isGain = lastPrice >= previousClose;

  const strokeColor = isGain ? '#06b6d4' : '#f43f5e';
  const points = data.map((val, idx) => ({ x: getX(idx), y: getY(val) }));
  const linePath = `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      className="inline-block select-none overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line
        x1={0}
        y1={baselineY}
        x2={width}
        y2={baselineY}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeDasharray="2,2.5"
        strokeOpacity="0.4"
      />
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2.5"
        fill={strokeColor}
        stroke="#ffffff"
        strokeWidth="0.8"
      />
    </svg>
  );
}
```

---

## 8. Educational Tooltips: High-Conversion Knowledge Layer

Using `@radix-ui/react-tooltip`, hovering or tapping each index icon reveals a high-value explanation designed to bridge mathematics with trading alpha.

### 8.1 Tooltip Dictionary

#### 1. XAUX — Relative Gold Strength Index

- **Definition:** Measures pure intrinsic gold purchasing power against an equally weighted basket of the world's 8 major currencies (G8).
- **Formula:** $XAUUSD(t) / XAUUSD(\text{Day Open}) \times 100$
- **Gold Trading Edge:**
  > _"Identifies true institutional gold demand. If XAUUSD is rising while XAUX is flat, gold is merely benefiting from a depreciating US Dollar. If XAUX is aggressively breaking above its baseline, gold is experiencing genuine global capital inflow across all fiat currencies."_

#### 2. USDX — Unbiased US Dollar Index

- **Definition:** Equal-weighted US Dollar Index against EUR, JPY, GBP, AUD, NZD, CAD, and CHF. Free from the 57.6% Euro concentration bias of the legacy ICE DXY.
- **Formula:** Geometric product of 7 USD crosses with equal $14.28\%$ weighting.
- **Gold Trading Edge:**
  > _"The primary adversary of Gold. An intraday downward divergence on USDX paired with a rising XAUX confirms the highest-probability Long setups on XAUUSD."_

#### 3. EURX — Euro Currency Index

- **Definition:** Broad-spectrum Euro valuation against the other 7 global currencies.
- **Gold Trading Edge:**
  > _"Measures European liquidity and macro sentiment. A surging EURX often pressures USDX lower, providing strong secondary momentum for Gold rallies."_

#### 4. JPYX — Japanese Yen Index

- **Definition:** Broad Yen valuation tracking global Carry Trade sentiment.
- **Gold Trading Edge:**
  > _"The premier Risk-Off sentiment barometer. When JPYX and XAUX rise together, global investors are aggressively seeking safe-haven shelter. Ideal for riding sustained breakout trends."_

#### 5. GBPX — British Pound Index

- **Definition:** Equal-weighted British Pound valuation reflecting European high-beta capital flows.
- **Gold Trading Edge:**
  > _"Reflects risk appetite in London sessions. Sharp divergences between GBPX and USDX signal impending London Fix volatility in Gold."_

#### 6. AUDX — Australian Dollar Index

- **Definition:** The leading commodity currency index, heavily tied to raw material exports and Chinese industrial demand.
- **Gold Trading Edge:**
  > _"Gold and commodities proxy. When AUDX leads the currency board higher, physical commodities are in demand, confirming underlying macro support for Gold."_

#### 7. NZDX — New Zealand Dollar Index

- **Definition:** High-beta global trade barometer sensitive to worldwide economic expansion and dairy/commodity cycles.
- **Gold Trading Edge:**
  > _"Measures global risk-on/risk-off sentiment. Useful for detecting Asian session momentum shifts before Europe opens."_

#### 8. CADX — Canadian Dollar Index

- **Definition:** Energy and oil-correlated North American currency index.
- **Gold Trading Edge:**
  > _"Energy inflation indicator. Surging CADX points to rising energy prices, which typically boosts Gold's appeal as an inflation hedge."_

#### 9. CHFX — Swiss Franc Index

- **Definition:** European safe-haven and banking capital benchmark.
- **Gold Trading Edge:**
  > _"Geopolitical risk gauge. If Gold rises while CHFX surges, European geopolitical tensions or banking liquidity risks are escalating."_

---

## 9. Future Roadmap: PRO Plan Currency Screener (32 Pairs)

The computed 8 Currency Indices provide the mathematical substrate for DavinTrade's upcoming **PRO Plan Flagship Feature**:

### 9.1 Mathematical Derivation

Relative price momentum of any currency pair $A/B$ is directly derived from their respective index divergence:

$$\Delta\%(A/B) \approx \Delta\%(\text{Index}_A) - \Delta\%(\text{Index}_B)$$

### 9.2 The Strongest vs. Weakest Engine

1. At every M5 close, rank the 8 currency indices by intraday performance:
   $$Rank = [\text{Curr}_1 (\text{Strongest}), \text{Curr}_2, \dots, \text{Curr}_8 (\text{Weakest})]$$
2. **Top Long Pair Setup:** Buy $Rank_1 / Rank_8$ (Maximum Positive Momentum).
3. **Top Short Pair Setup:** Sell $Rank_8 / Rank_1$ (Maximum Downward Trend).
4. **Landing Page Conversion Hook:**
   > _"Today's Strongest Currency is **GBPX (+1.42%)** and Weakest is **JPYX (-1.18%)**._  
   > _🔒 [Unlock PRO Plan] to access the Real-Time 32-Pair Relative Strength Screener and Automated Entry/Exit Line Alerts."_

---

## 10. Audit Checklist & Implementation Roadmap for Claude Code

### Phase 1: VPS Ingestion & Math Engine (Contabo)

- [ ] Deploy `ohlcvexportlightweight_v2_29.mq5` on M5 charts of `EURUSD`, `USDJPY`, `GBPUSD`, `AUDUSD`, `NZDUSD`, `USDCAD`, `USDCHF`.
- [ ] Create `currency_index_engine.py` in `backend-stack-c/`:
  - Implement file reader with `FILE_SHARE_READ` tolerance.
  - Implement forward-fill (`ffill`) timestamp outer merge.
  - Cross-reference mathematical formulas and weights directly with `.mq5` indicators in `mql5-indicators/interesting-indicators/currency-and-gold-index/`.
  - Implement daily session reset logic for Eightcap (`00:00:00` for FX, `01:01:00` for Gold).
  - Implement equal-weight geometric formula for 8 FX indices + rebased formula for Gold.
  - Configure NSSM service `DavinTradeCurrencyIndexEngine`.

### Phase 2: Gateway Contract & PostgreSQL Schema (Railway)

- [ ] Apply migration for `forex_ohlcv_m5` and `market_indices_m5`.
- [ ] Add NestJS endpoint `POST /api/v1/market-indices` with JSON-Schema validation.
- [ ] Ensure batched upserts stay safely under the Express 100 KB payload limit.

### Phase 3: Redis Cache & Public API

- [ ] Set up Redis key `cache:market_indices:today` updated on every 5-minute push (TTL: 60s).
- [ ] Create public endpoint `GET /api/v1/public/market-indices/today`.

### Phase 4: Frontend Landing Page Widget (Next.js 16)

- [ ] Create `FloatingSparkline` SVG component in `components/market/floating-sparkline.tsx`.
- [ ] Build `CurrencyIndexHeroWidget` in `components/market/currency-index-hero-widget.tsx`:
  - 4 items visible, smooth vertical scroll for 5 remaining.
  - SWR integration fetching from `/api/v1/public/market-indices/today`.
  - Tooltips via `@radix-ui/react-tooltip`.
  - Responsive styles for Mobile (<400px) and Desktop.
- [ ] Integrate widget into `app/page.tsx` Hero Section.

### Phase 5: Verification & End-to-End Testing

- [ ] Verify zero latency impact on Lane 1 (`market_data` XAUUSD alerts).
- [ ] Confirm sparkline reflects accurate intraday floating baseline and endpoint marker.
- [ ] Test mobile responsive layout and tooltip tap behavior.
