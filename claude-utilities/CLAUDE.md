# DavinTrade Project Context

## Project Overview

DavinTrade is a trading analytics and alerts SaaS platform targeting retail traders. It combines MT5 terminal integration, Python machine learning pipeline, and a Next.js dashboard to provide intelligent trading alerts based on technical analysis.

---

## Tech Stack

### Cloud Deployment

- **Backend:** NestJS 11 on Railway
- **Database:** PostgreSQL on Railway
- **Cache:** Redis on Railway
- **Frontend:** Next.js 16 on Vercel
- **MT5 Infrastructure:** Contabo VPS (Windows Server 2022)
- **Package Manager:** npm

### Key Libraries

- **NestJS:** @nestjs/core, @nestjs/typeorm, @nestjs/passport
- **Frontend:** React 18, Next.js 16, Apache ECharts, TradingView Lightweight Charts
- **Python Backend:** NumPy (SVD), Scipy, Pandas, Scikit-learn (DBSCAN, KMeans)
- **Message Queue:** Celery + Redis
- **ORM:** Prisma 5.x

---

## NestJS Backend Structure

```
src/
├── auth/                    # JWT authentication, session management
├── users/                   # User profiles, preferences
├── subscriptions/           # FREE/PRO tier logic, Cryptomus payments
├── mt5/                     # MT5 terminal connection, symbol sync
├── indicators/              # Cached indicator data from Python pipeline
├── alerts/                  # Alert generation and delivery
├── charts/                  # OHLC data endpoints, dual-panel support
├── cache/                   # Redis layer (entropy, fractal clusters)
├── workers/                 # Celery task orchestration
├── prisma/                  # Database schema, migrations
└── shared/                  # Utilities, guards, pipes
```

### Key Endpoints (REST)

- `POST /auth/login` → JWT token
- `GET /indicators/{symbol}/{timeframe}` → Chart data + alerts
- `GET /cache/entropy/{symbol}` → Current entropy regime (3-state)
- `GET /cache/fractals/{symbol}` → Support/resistance clusters
- `POST /alerts/trigger` → Manual alert from MT5 EA
- `PATCH /subscriptions/{userId}` → Upgrade to PRO

---

## PostgreSQL Schema (Prisma)

### Core Models

- **User** — auth, tier (FREE/PRO), email
- **Account** — MT5 terminal credentials, server details
- **Indicator** — cached indicator runs (symbol, timeframe, cached_data)
- **Alert** — generated alerts (trigger, price, time, status)
- **Chart** — OHLC candles (symbol, open, high, low, close, volume)
- **Trade** — historical trades (entry, exit, pnl)
- **Subscription** — payment status, renewal date (Cryptomus)
- **ApiKey** — affiliate/public key management

### Relationships

- User → has many Accounts
- Account → has many Indicators, Alerts, Trades
- Alert → belongs to Indicator

---

## Redis Schema

### Active Cache Keys (TTL = 5 minutes)

| Key Pattern               | Value                  | Purpose                                                |
| ------------------------- | ---------------------- | ------------------------------------------------------ |
| `entropy:{symbol}:{tf}`   | `0 \| 1 \| 2`          | Entropy state (0=Trending, 1=Consolidating, 2=Chaotic) |
| `fractal:{symbol}:{tf}`   | JSON clusters          | Support/resistance centroids (DBSCAN output)           |
| `kde:{symbol}:{tf}`       | 2D heatmap array       | Probability density field                              |
| `gauge:{symbol}:{tf}`     | {HMI, RPI, BPI}        | Indicator gauge values                                 |
| `active_trades:{user_id}` | Array of trade objects | Open positions                                         |

### Key Design Pattern

- Keys expire after 5 minutes (force fresh computation on stale data)
- Bulk refresh on MT5 OHLC updates
- No garbage collection; TTL handles cleanup

---

## Python Celery Worker Pipeline

### Stage 1: Data Ingestion

- Input: OHLC candles from MT5 (H4, M15, M10)
- Source: NestJS pulls from Contabo VPS
- Format: {symbol, open, high, low, close, volume, timestamp}

### Stage 2: SSA (Singular Spectrum Analysis)

- Algorithm: NumPy SVD decomposition on closing prices
- Window size: Last 120 candles
- Output: Trend component, seasonal component, residuals
- Cached? Yes (expensive compute, reused by entropy stage)

### Stage 3: Shannon Entropy Classification

- Algorithm: 3-state categorical matching `Entropy_IT.mq5`
  - **Trending:** Low entropy (< 0.4)
  - **Consolidating:** Medium entropy (0.4–0.7)
  - **Chaotic:** High entropy (> 0.7)
- Input: SSA residuals + RSI
- Output: Entropy value + regime label
- Redis Cache: `entropy:{symbol}:{tf}`

### Stage 4: Fractal Clustering

- Algorithm: DBSCAN (eps=0.002, min_samples=3) seeded by K-Means (k=5)
- Input: Support/resistance fractal pivots detected from EAs
- Output: Cluster centroids + density scores
- Special Handling: Extreme S&R preserved in dedicated Redis key
- Purpose: Identify key price levels without noise

### Stage 5: Kernel Density Estimation (KDE)

- Algorithm: Scipy Gaussian KDE on fractal clusters
- Grid: 100×100 price/time resolution
- Output: 2D heatmap (probability field)
- Use: Visualized as heatmap in Next.js dashboard

### Stage 6: Gauge Indicators

- Compute: HMI (Heiken Ashi Momentum Index), RPI (Relative Position Index), BPI (Bollinger Position Index)
- Output: Numeric values 0–100
- Cached: `gauge:{symbol}:{tf}`

### Task Execution

```
trigger: MT5 EA posts new OHLC
↓
NestJS /indicators endpoint
↓
Celery queue receives: {symbol, timeframe, candles[]}
↓
Stage 1 (SSA) → Stage 2 (Entropy) → Stage 3 (Fractals) → Stage 4 (KDE) → Stage 5 (Gauges)
↓
Redis bulk update
↓
Next.js dashboard subscribes (WebSocket or polling)
```

### Task Naming Convention

- `process_entropy_{symbol}_{tf}` — Entropy calculation
- `cluster_fractals_{symbol}_{tf}` — Fractal clustering
- `compute_kde_{symbol}_{tf}` — Heatmap generation
- `cache_all_gauges_{symbol}` — All gauge indicators

---

## Next.js Frontend

### Dashboard Layout

- **Left Panel:** TradingView Lightweight Charts (candlesticks + alert overlays)
- **Right Panel:** Apache ECharts heatmap (KDE probability field)
- **Bottom:** Gauge indicators (HMI, RPI, BPI)
- **Top Navbar:** Symbol selector, timeframe buttons, subscription badge

### Key Pages

- `/dashboard` — Main trading view (FREE: limited symbols, PRO: all)
- `/alerts` — Historical alert log, performance metrics
- `/settings` — Account, MT5 connection, webhook config
- `/pricing` — FREE vs PRO feature comparison

### Data Fetching

- Chart data: REST API `/indicators/{symbol}/{tf}`
- Heatmap: REST API `/cache/kde/{symbol}`
- Entropy: WebSocket or `useSWR` polling `/cache/entropy/{symbol}`
- Real-time updates: Polling every 5 seconds (or WebSocket upgrade)

### Chart Libraries

- **TradingView LWC:** Candlesticks, OHLC, volume
- **Apache ECharts:** Heatmaps, gauges, histograms

---

## MQL5 EA & Indicators

### Key EAs

1. **Auto_Entropy_IT.mq5** — Automated live trading based on entropy regime
   - Subscribes to entropy output from Python pipeline
   - Places trades on regime transitions
   - Risk management: Fixed risk per trade (1–2% of account)

2. **Fractal_Horizontal_V5.mq5** — Support/resistance detection
   - Identifies pivot highs/lows
   - Feeds clusters into DBSCAN

3. **SimpleDataCollector.mq5** — Candle collection & export
   - Exports OHLC to CSV/database
   - Runs on M10, M15, H4 timeframes

### Key Indicators

- **Entropy_IT.mq5** — Shannon entropy (reference implementation)
- **ALGLIB_SSA.mq5** — Singular Spectrum Analysis
- **Fractal_Diagonal_V4.mq5** — Fractal S&R diagonal trendlines

### Constants (Non-negotiable)

- Trading Symbol: XAUUSD (gold)
- Timeframes: M10, M15, H4 (no others)
- Lot Size: 0.1–0.5 (scaled by account risk)
- Take Profit: 50–100 pips
- Stop Loss: 20–30 pips
- Max Trades/Day: 5
- Account Size: $1000–$10,000 (tested range)

---

## Coding Conventions

### TypeScript/NestJS

```typescript
// File naming: kebab-case.service.ts, kebab-case.controller.ts
// Function naming: camelCase
// Interfaces: IPascalCase
// Classes: PascalCase
// Constants: UPPER_SNAKE_CASE

// Always use strict typing
function calculateEntropy(prices: number[]): number {
  // ...
}

// Comments for complex logic only
// FIXME: This computation is O(n^2), optimize with KD-tree
```

### Python (Celery)

```python
# File naming: snake_case.py
# Function naming: snake_case
# Type hints: Required (PEP 484)
from typing import List, Dict, Tuple

def calculate_entropy(prices: List[float]) -> Tuple[float, str]:
    """Compute 3-state entropy regime."""
    # ...

# Comments for domain logic
# TODO: Add VANNA RAG integration for buy/sell reasoning
```

### MQL5

```mql5
// Variable naming: CamelCase
// Constants: UPPER_CASE
// Comment all magic numbers

#define ENTROPY_THRESHOLD_LOW 0.4
#define ENTROPY_THRESHOLD_HIGH 0.7

double CalculateEntropy(double priceArray[]) {
  // Implementation
}
```

### Critical Sections

- Mark with `// FIXME:` if review is needed
- Mark with `// TODO:` if future work is planned
- Payment logic, auth checks, EA entry/exit: Always add comments

---

## Deployment Pipeline

### Development Workflow

1. Feature branch in GitHub (`trading-alerts-saas-public`)
2. Claude Code `/plan` → break into phases
3. Local testing + `/security-review` before PR
4. NestJS tests in Railway CI/CD

### Production Deployment

- **Backend:** `git push → Railway auto-deploy`
- **Frontend:** `git push → Vercel auto-deploy`
- **MT5:** Manual VPS update (SSH to Contabo)

### Database Migrations

```bash
npx prisma migrate dev --name add_new_field
npx prisma generate  # Regenerate client
```

---

## Context-Saving Tips for Claude Code

### When to Use /memory

- After architecture decisions (schema changes, pipeline design)
- Before switching branches
- When context approaches 80%

### Exclude from /add-dir

- `tests/`, `__tests__/`, `.test.ts` (test bloat)
- `node_modules/`, `.next/`, `dist/` (build artifacts)
- `.git/`, `node_modules/` (version control)

### Keep in context

- `src/` (source code)
- `prisma/schema.prisma` (critical)
- `CLAUDE.md` (this file)

---

## Key Decisions & Rationale

1. **SSA + Entropy + DBSCAN Pipeline**
   - Why: Combines trend detection + noise handling + clustering
   - Alternative rejected: Simple moving averages (too noisy)

2. **3-State Entropy (not continuous)**
   - Why: Matches MQL5 reference, trader-friendly classification
   - Alternative rejected: Continuous entropy (over-complicated UI)

3. **Redis 5-min TTL**
   - Why: Fresh enough for intraday, prevents stale signals
   - Alternative rejected: Permanent cache (would miss regime changes)

4. **Dual-Panel UI (LWC + ECharts)**
   - Why: Candlesticks (LWC) + heatmap (ECharts) in one view
   - Alternative rejected: Single chart (loses heatmap insights)

---

## Known Limitations & TODOs

- [ ] VANNA RAG integration for buy/sell reasoning
- [ ] WebSocket for real-time instead of polling
- [ ] Multi-symbol support (currently XAUUSD only, Free tier)
- [ ] ML model retraining pipeline
- [ ] Alert notification via Slack/Email (Cryptomus only)

---

## Resources & References

- **Architecture Doc:** `methodology-of-providing-trading-recommendation.jpg`
- **GitHub Repo:** `trading-alerts-saas-public`
- **MT5 Docs:** MT5 MQL5 Reference on MQL5.com
- **Prisma Schema:** `/src/prisma/schema.prisma`
