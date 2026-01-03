# Part 20 - Phase 04: Next.js API Routes

**Purpose:** Create Next.js API routes to serve indicator data from PostgreSQL, replacing the Flask endpoints from Part 6.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 04 Prompt

```
# Part 20 - Phase 04: Next.js API Routes

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-3 are complete.

This phase creates Next.js API routes to serve indicator data from PostgreSQL, replacing the Flask endpoints from Part 6.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Full architecture context
- `part-20-implementation-plan.md` - Phase 4 details
- `part-20-sqlite-sync-postgresql-openapi.yaml` - Complete API specification

## Prerequisites
- Phase 3 completed (PostgreSQL has data from sync)
- Existing Next.js app with NextAuth.js configured
- PostgreSQL connection string in environment variables

## Your Task
Create Next.js API routes and supporting library files.

## Files to Create

### 1. `lib/db/postgresql.ts`
Create PostgreSQL client:
- Use `pg` package with connection pool
- Export `query<T>(text, params)` function
- Export `getPool()` function
- Pool config: max 20 connections, 30s idle timeout

### 2. `lib/db/queries.ts`
Create database query functions:
- `getIndicatorData(symbol, timeframe, limit)`: Returns IndicatorData
  - Query from `{symbol}_{timeframe}` table
  - ORDER BY timestamp DESC, LIMIT
  - Transform rows to response format (OHLC array, indicator objects)
  - Handle NULL values for dynamic indicators
- `getDataFreshness(symbol, timeframe)`: Returns last sync timestamp
- `getTableRowCount(symbol, timeframe)`: Returns row count

### 3. `lib/indicators/types.ts`
Create TypeScript types matching OpenAPI schemas:
- `OHLCBar` interface
- `Fractals` interface
- `HorizontalTrendlines` interface
- `DiagonalTrendlines` interface
- `MomentumCandle` interface
- `KeltnerChannels` interface
- `ZigZag` interface
- `IndicatorData` interface (complete response)
- `IndicatorMetadata` interface

### 4. `lib/tier/validation.ts`
Create tier validation:
- `FREE_SYMBOLS`: ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']
- `FREE_TIMEFRAMES`: ['H1', 'H4', 'D1']
- `validateTierAccess(symbol, timeframe, tier)`: Returns { allowed, message }
- `getAccessibleSymbols(tier)`: Returns symbol array
- `getAccessibleTimeframes(tier)`: Returns timeframe array

### 5. `app/api/indicators/[symbol]/[timeframe]/route.ts`
Create main indicators endpoint:
- GET handler with params { symbol, timeframe }
- Validate symbol and timeframe against allowed values
- Get session and user tier (default FREE)
- Call validateTierAccess, return 403 if denied
- Parse `limit` query param (default 1000, max 10000)
- Call getIndicatorData
- Return response matching OpenAPI schema
- Handle errors with 500 response

### 6. `app/api/indicators/health/route.ts`
Create health endpoint:
- GET handler (no auth required)
- Check PostgreSQL connection
- Return status, version, table count

### 7. `app/api/symbols/route.ts`
Create symbols endpoint:
- GET handler
- Get user tier from session
- Return filtered symbols based on tier

### 8. `app/api/timeframes/route.ts`
Create timeframes endpoint:
- GET handler
- Get user tier from session
- Return filtered timeframes based on tier

## Important Notes
- Match Part 6 API response format for frontend compatibility
- Use existing NextAuth.js session handling
- All responses must match OpenAPI specification
- Include proper TypeScript types throughout

## Success Criteria
- [ ] All TypeScript files compile without errors
- [ ] GET /api/indicators/EURUSD/H1 returns data
- [ ] Tier validation blocks unauthorized access
- [ ] Response format matches Part 6 API
- [ ] Health endpoint returns correct status
- [ ] Symbols/timeframes endpoints work

## Testing Commands
```bash
# Start dev server
npm run dev

# Test endpoints
curl http://localhost:3000/api/indicators/health
curl http://localhost:3000/api/symbols
curl http://localhost:3000/api/timeframes
curl http://localhost:3000/api/indicators/EURUSD/H1
```

## Commit Instructions
After creating all files, commit with message:
```
feat(api): add Next.js API routes for indicator data

- Replace Flask endpoints with Next.js API routes
- Add PostgreSQL query layer
- Implement tier-based access control
- Match Part 6 API response format
- Add TypeScript types for indicators
```
```

---

## Next Step

After Phase 04, proceed to `part-20-phase05-prompts.md` (Redis Caching Layer).
