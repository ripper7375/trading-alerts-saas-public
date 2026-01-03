# Part 20 - Phase 06: Confluence Score System

**Purpose:** Implement the multi-timeframe confluence score calculation - a PRO-only feature that analyzes 117 indicators (13 indicators × 9 timeframes) at a specific point in time.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 06 Prompt

```
# Part 20 - Phase 06: Confluence Score System

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-5 are complete.

This phase implements the multi-timeframe confluence score calculation - a PRO-only feature that analyzes 117 indicators (13 indicators × 9 timeframes) at a specific point in time.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 9 (Confluence Score Calculation)
- `part-20-implementation-plan.md` - Phase 6 details
- `part-20-sqlite-sync-postgresql-openapi.yaml` - Confluence endpoints specification

## Prerequisites
- Phase 5 completed (Redis caching working)
- PostgreSQL has data in all 135 tables

## Your Task
Create the confluence score system with API endpoints.

## Files to Create

### 1. `lib/confluence/types.ts`
Create TypeScript types:
```typescript
interface TimeframeData {
  ohlc: OHLCBar;
  fractals: Fractals | null;
  horizontal_trendlines: HorizontalTrendlines | null;
  diagonal_trendlines: DiagonalTrendlines | null;
  momentum_candles: MomentumCandle[];
  keltner_channels: KeltnerChannels;
  tema: number | null;
  hrma: number | null;
  smma: number | null;
  zigzag: ZigZag;
}

interface MultiTimeframeData {
  M5: TimeframeData;
  M15: TimeframeData;
  // ... all 9 timeframes
}

interface TimeframeSignal {
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-1
  signals: SignalDetail[];
}

interface ConfluenceResult {
  confluence_score: number; // 0-10
  max_score: number;
  signals: { bullish: number; bearish: number; neutral: number };
  breakdown: Record<string, TimeframeSignal>;
  all_117_indicators: MultiTimeframeData;
}
```

### 2. `lib/db/multi-timeframe-query.ts`
Create multi-timeframe query function:
- `getMultiTimeframeData(symbol, timestamp)`:
  - Query all 9 timeframe tables for the symbol
  - For each timeframe, get the row closest to (but not after) timestamp
  - Handle timeframe alignment (H2 at 16:00, not 17:00)
  - Return MultiTimeframeData object
  - Use parallel queries for performance

### 3. `lib/confluence/signals.ts`
Create signal detection functions:
- `detectSignals(tfData: TimeframeData)`: Returns SignalDetail[]
  - Check price vs TEMA/HRMA/SMMA (above = bullish)
  - Check Keltner channel position
  - Check momentum candle presence
  - Check ZigZag direction
  - Check fractal breaks
- `getTrendDirection(signals)`: Returns 'bullish' | 'bearish' | 'neutral'
- `getSignalStrength(signals)`: Returns 0-1 strength value

### 4. `lib/confluence/calculator.ts`
Create confluence calculator:
- `calculateConfluenceScore(data: MultiTimeframeData)`: Returns ConfluenceResult
  - Loop through all 9 timeframes
  - Detect signals for each
  - Count bullish/bearish/neutral
  - Calculate alignment score (how many agree)
  - Calculate average strength
  - Combine into 0-10 confluence score
  - Formula: `alignment * 5 + avgStrength * 5`

### 5. `lib/cache/confluence-cache.ts`
Create confluence caching:
- `getCacheKey(symbol, timestamp)`: Returns cache key
- `getCachedConfluence(symbol, timestamp)`: Check cache
- `cacheConfluence(symbol, timestamp, result)`: Store with TTL
- Historical timestamps: cache indefinitely
- Current timestamp: cache 30 seconds

### 6. `app/api/confluence/[symbol]/route.ts`
Create confluence endpoint:
- GET handler
- Require PRO tier (return 403 for FREE)
- Accept optional `timestamp` query param
- Check cache first
- Calculate confluence if not cached
- Return ConfluenceResponse per OpenAPI spec

## Important Notes
- This is PRO-only feature
- Must handle missing data gracefully (some timeframes may have NULL)
- Historical confluences should be cached indefinitely
- Use parallel queries for performance

## Success Criteria
- [ ] Multi-timeframe query returns all 117 indicators
- [ ] Signal detection works for each indicator type
- [ ] Confluence score calculated correctly (0-10 scale)
- [ ] PRO tier validation works
- [ ] Caching works for both current and historical
- [ ] Response matches OpenAPI specification

## Testing Commands
```bash
# Test confluence (need PRO session)
curl -H "Cookie: next-auth.session-token=..." \
  "http://localhost:3000/api/confluence/EURUSD"

# Test with specific timestamp
curl -H "Cookie: next-auth.session-token=..." \
  "http://localhost:3000/api/confluence/EURUSD?timestamp=2026-01-03T17:00:00Z"
```

## Commit Instructions
After creating all files, commit with message:
```
feat(confluence): add multi-timeframe confluence score system

- Add confluence score API endpoint
- Query 117 indicators across 9 timeframes
- Calculate alignment and strength scores
- Cache confluence results
- PRO tier only access
```
```

---

## Next Step

After Phase 06, proceed to `part-20-phase07-prompts.md` (Testing Framework).
