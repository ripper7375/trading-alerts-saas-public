# Architectural Proposal: Applying "Fail Open" Resilience to MarketDataV6

**Target Audience:** Claude Code & DavinTrade Engineering  
**Scope:** `prisma/market-data/schema.prisma` (`MarketDataV6`, 103+ columns), Railway Gateway ingestion, and Next.js frontend/terminal readers.  
**Objective:** Prevent schema evolution lags, database timeouts, and missing experimental indicator columns from crashing live charts, websocket feeds, or market analysis.

---

## 1. Problem Statement: The "103-Column Monolith Query" Trap

`MarketDataV6` currently models over 100 indicator columns (centroid-regression variants `best_fit_a`, `best_fit_b`, `cherry_a`, EDT channels, ZigZag, SR2 levels, and cycle provenance).

Under standard Prisma query behavior without explicit projection:

```typescript
// DANGEROUS: Generates SELECT "id", "open", ..., "future_column_x" FROM "market_data_v6"
const bars = await prismaMarket.marketDataV6.findMany({
  where: { timeframe: 'M5' },
});
```

If a new indicator column is added in code but delayed in database migration (or deployed across services in a rolling update), PostgreSQL returns `Error 42703 (column does not exist)`. This results in:

- Complete chart blackout for end users (`500 Internal Server Error`).
- Terminal failure and blank screener views.
- WebSocket streaming and sensor cycle ingestion stoppage.

---

## 2. Core Principles of "Fail Open" for Market Data

In financial SaaS systems, **Market Continuity > Indicator Completeness**.  
Traders must never be locked out of viewing live price candles (OHLCV) simply because an experimental or secondary indicator fails to resolve.

```
       Incoming Ingestion / Query
                   │
                   ▼
       [ Core OHLCV Required ] ────► Fail Closed (Must have valid price)
                   │
                   ▼
  [ Secondary Indicators / Metrics ] ──► Fail Open (Degrade gracefully)
                   │
       ┌───────────┴───────────┐
       ▼                       ▼
 Column / DB OK         Column Missing / DB Lag
 ┌───────────────┐      ┌───────────────────────────┐
 │ Full Indicator│      │ Render OHLC Candles Only  │
 │ Visualization │      │ Log Non-Blocking Warning  │
 └───────────────┘      └───────────────────────────┘
```

---

## 3. Actionable Proposals to Discuss with Claude Code

### Proposal A: Reader-Side Isolation & Explicit Projection (Frontend / APIs)

- **Rule:** Never allow `MarketDataV6` queries without explicit `select`.
- **Pattern:** Separate **Core OHLCV Projections** from **Extended Indicator Projections**:

  ```typescript
  // 1. Core Tier (Guaranteed minimum viable chart)
  export const CORE_BAR_SELECT = {
    timestamp: true,
    open: true,
    high: true,
    low: true,
    close: true,
    volume: true,
  } as const;

  // 2. Safe Query with Fail-Open Fallback
  async function getBarsWithIndicators(timeframe: string) {
    try {
      // Attempt rich query with full indicators
      return await prismaMarket.marketDataV6.findMany({
        where: { timeframe },
        select: { ...CORE_BAR_SELECT, ...EXTENDED_INDICATOR_SELECT },
      });
    } catch (err: any) {
      if (
        err.code === 'P2021' ||
        err.code === 'P2022' ||
        err.message?.includes('column does not exist')
      ) {
        logger.warn(
          '[MarketData] Schema drift detected in indicators, failing open to Core OHLCV'
        );
        // Fail Open: Return basic price action without indicators so chart never blanks
        return await prismaMarket.marketDataV6.findMany({
          where: { timeframe },
          select: CORE_BAR_SELECT,
        });
      }
      throw err; // Genuine infrastructure outage still surfaces
    }
  }
  ```

### Proposal B: Ingestion Resilience (Railway Gateway Consumer)

- **Strict Core, Permissive Extended:** The gateway queue consumer should validate core fields (`terminal_id`, `timestamp`, `symbol`, `open`, `high`, `low`, `close`) strictly.
- **Schema Drift Protection:** If an `INSERT` fails due to a missing indicator column on a replica/staging database, sanitize the payload by stripping non-core fields and retrying the write for core OHLCV immediately.

### Proposal C: Sensor & Stack D Boundary Tolerance

- If an M15 or M5 cycle input misses an experimental indicator reading, the sensor evaluation bridge should default that specific indicator to `NEUTRAL` or `INSUFFICIENT_DATA` rather than throwing an unhandled exception that halts the 10-minute synthesis engine.

### Proposal D: Stale-While-Revalidate (SWR) Cache as a Shield

- Next.js `/api/market-data` routes should serve the last known valid snapshot from Redis or memory cache (`Cache-Control: stale-while-revalidate`) if a database timeout occurs during high market volatility spikes.

---

## 4. Key Questions for Claude Code

1. Which specific API routes in Next.js (`/api/market-data/*`, terminal chart routes) currently perform unbounded `findMany()` / `findFirst()` on `marketDataV6`?
2. Should we establish a reusable TypeScript wrapper (e.g. `safeMarketQuery()`) in `lib/market/` that guarantees Core OHLCV fallback?
3. How should the frontend chart component (`TradingChart` / Lightweight Charts) reflect degraded indicator state (e.g., subtle warning icon indicating "Indicator updating" while candles continue ticking)?
