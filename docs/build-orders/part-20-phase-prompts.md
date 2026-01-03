# Part 20: Phase Implementation Prompts for Claude Code (Web)

**Usage Instructions:**
1. Start a fresh Claude Code (web) chat for each phase
2. Attach these 3 documents to each chat:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt for the specific phase you want to implement
4. Complete phases in order (Phase 1 → Phase 9) due to dependencies

---

## Phase 1 Prompt: Database Schema Setup

```
# Part 20 - Phase 1: Database Schema Setup

## Context
I'm implementing Part 20 of Trading Alerts SaaS, which replaces Part 6 (Flask MT5 Service + Python MT5 API) with a new architecture: MQL5 Service → SQLite → Sync → PostgreSQL.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 6 (Data Model)
- `part-20-implementation-plan.md` - Phase 1 details
- `part-20-sqlite-sync-postgresql-openapi.yaml` - Schema references

## Your Task
Create the database schemas for both SQLite (local MT5 machine) and PostgreSQL (Railway cloud).

## Files to Create

### 1. `sql/sqlite_schema.sql`
Create SQLite schema with:
- 15 tables (one per symbol): AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD
- 14 columns per table:
  - `timestamp` INTEGER PRIMARY KEY (Unix timestamp)
  - `open`, `high`, `low`, `close` REAL NOT NULL
  - `fractals` TEXT (JSON)
  - `horizontal_trendlines` TEXT (JSON)
  - `diagonal_trendlines` TEXT (JSON)
  - `momentum_candles` TEXT (JSON)
  - `keltner_channels` TEXT (JSON)
  - `tema`, `hrma`, `smma` REAL
  - `zigzag` TEXT (JSON)
- Create index on timestamp for each table

### 2. `sql/postgresql_schema.sql`
Create PostgreSQL schema with:
- 135 tables (15 symbols × 9 timeframes)
- Table naming: `{symbol}_{timeframe}` all lowercase (e.g., `eurusd_m5`, `eurusd_h1`)
- Timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1
- Same 14 columns but use:
  - `timestamp` TIMESTAMPTZ PRIMARY KEY
  - `DOUBLE PRECISION` instead of REAL
  - `JSONB` instead of TEXT for JSON columns
- Include `CREATE EXTENSION IF NOT EXISTS timescaledb;`

### 3. `sql/timescaledb_setup.sql`
Create TimescaleDB configuration:
- Convert all 135 tables to hypertables using `create_hypertable()`
- Add retention policies (calculate based on 10,000 rows per timeframe):
  - M5: ~35 days, M15: ~105 days, M30: ~210 days
  - H1: ~417 days, H2: ~834 days, H4: ~1667 days
  - H8: ~3333 days, H12: ~5000 days, D1: ~10000 days
- Add compression policies (compress after 7 days)
- Create descending timestamp indexes

### 4. `sql/seed_data.sql`
Create test seed data:
- Insert 100 sample rows for EURUSD in SQLite format
- Include realistic OHLC values for EURUSD (around 1.0850)
- Include sample JSON for fractals, trendlines, and indicators
- Add comments explaining the data structure

## Success Criteria
- [ ] All SQL files are syntactically valid
- [ ] SQLite schema creates 15 tables with correct columns
- [ ] PostgreSQL schema creates 135 tables with correct naming
- [ ] TimescaleDB hypertables configured correctly
- [ ] Seed data insertable without errors

## Commit Instructions
After creating all files, commit with message:
```
feat(db): add Part 20 database schemas for SQLite and PostgreSQL

- Add SQLite schema for 15 symbol tables (local MT5 data)
- Add PostgreSQL schema for 135 timeframe tables (cloud)
- Configure TimescaleDB hypertables and retention policies
- Add seed data for development testing
```
```

---

## Phase 2 Prompt: MQL5 Service Development

```
# Part 20 - Phase 2: MQL5 Service Development

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phase 1 (Database Schema) is complete.

This phase creates the MQL5 Service that runs inside MT5 terminals to collect indicator data and write to SQLite.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 5.2 (MQL5 Service Details)
- `part-20-implementation-plan.md` - Phase 2 details

## Prerequisites
- Phase 1 completed (SQL schemas exist)
- MT5 terminal with custom indicators installed:
  - Fractal Horizontal Line_V5.mq5
  - Fractal Diagonal Line_V4.mq5
  - Body Size Momentum Candle_V2.mq5
  - Keltner Channel_ATF_10 Bands.mq5
  - TEMA_HRMA_SMA-SMMA_Modified Buffers.mq5
  - ZigZagColor & MarketStructure_JSON Export_V27_TXT Input.mq5

## Your Task
Create the MQL5 Service and supporting include files.

## Files to Create

### 1. `mql5/Services/DataCollector.mq5`
Create MQL5 Service with:
- `#property service` declaration (NOT an EA)
- Input parameters:
  - `CollectionInterval` (int, default 30 seconds)
  - `DatabasePath` (string, default "C:\\MT5Data\\trading_data.db")
- OnStart() function with:
  - DatabaseOpen() to create/open SQLite database
  - Call to CreateTableIfNotExists() for the symbol
  - InitializeIndicators() to get all indicator handles using iCustom()
  - Main loop: `while(!IsStopped())` with Sleep()
  - CollectAndStoreData() called each interval
  - Cleanup: ReleaseIndicators() and DatabaseClose()
- InitializeIndicators() function:
  - Get handles for all 6 custom indicators using iCustom()
  - Return false if any handle is INVALID_HANDLE
- CollectAndStoreData() function:
  - CopyRates() to get OHLC data
  - Call buffer reading functions for each indicator
  - Build INSERT OR REPLACE SQL statement
  - DatabaseExecute() to write to SQLite
- ReleaseIndicators() function:
  - IndicatorRelease() for all handles

### 2. `mql5/Include/IndicatorBuffers.mqh`
Create include file with functions:
- `double GetIndicatorValue(int handle, int buffer_index)` - single value
- `string GetFractalsJSON(int handle)` - JSON with peaks/bottoms arrays
- `string GetHorizontalLinesJSON(int handle)` - JSON with 6 line arrays
- `string GetDiagonalLinesJSON(int handle)` - JSON with 6 line arrays
- `string GetMomentumJSON(int handle)` - JSON array of momentum candles
- `string GetKeltnerJSON(int handle)` - JSON with 10 band arrays
- `string GetZigZagJSON(int handle)` - JSON with peaks/bottoms
- Each function should:
  - Use CopyBuffer() to read indicator buffers
  - Filter out EMPTY_VALUE entries
  - Build proper JSON string
  - Handle errors gracefully

### 3. `mql5/Include/SymbolUtils.mqh`
Create include file with functions:
- `string NormalizeSymbol(string broker_symbol)` - strips suffixes like .i, .pro, m, .raw, .std
- `bool IsSymbolSupported(string symbol)` - checks against 15 supported symbols
- `bool CreateTableIfNotExists(int db, string symbol)` - creates SQLite table with correct schema

## Important Notes
- MQL5 Service runs 24/7 without needing a chart
- Use `#include <IndicatorBuffers.mqh>` and `#include <SymbolUtils.mqh>`
- All JSON must be valid (escape special characters)
- Handle database errors gracefully with Print() logging
- Buffer indices must match the actual indicator implementations

## Success Criteria
- [ ] All MQL5 files compile without errors in MetaEditor
- [ ] Service starts from Tools → Services in MT5
- [ ] SQLite database created at specified path
- [ ] Table created with correct schema
- [ ] Data written every 30 seconds
- [ ] All 13 indicator values captured in correct JSON format
- [ ] Symbol suffix correctly stripped (EURUSD.i → EURUSD)

## Commit Instructions
After creating all files, commit with message:
```
feat(mql5): add DataCollector service for MT5 indicator data

- Add MQL5 Service that runs continuously in MT5 terminal
- Read indicator buffers using CopyBuffer()
- Write to SQLite every 30 seconds
- Handle symbol suffix normalization
- Support all 13 indicators
```
```

---

## Phase 3 Prompt: Sync Script Development

```
# Part 20 - Phase 3: Sync Script Development

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-2 are complete.

This phase creates the Python sync script that transfers data from SQLite (local) to PostgreSQL (Railway cloud), filtering by timeframes.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 4.3 (Timeframe Categorization), Section 6.3 (Data Storage Rules)
- `part-20-implementation-plan.md` - Phase 3 details

## Prerequisites
- Phase 1 completed (SQL schemas exist)
- Phase 2 completed (MQL5 Service writing to SQLite)
- PostgreSQL database on Railway with TimescaleDB extension

## Your Task
Create the Python sync script and supporting modules.

## Files to Create

### 1. `sync/config.py`
Create configuration module:
```python
SQLITE_PATH = "C:\\MT5Data\\trading_data.db"  # Or from env var
POSTGRESQL_URI = os.getenv("POSTGRESQL_URI")  # Railway connection string

SYMBOLS = [
    "AUDJPY", "AUDUSD", "BTCUSD", "ETHUSD", "EURUSD",
    "GBPJPY", "GBPUSD", "NDX100", "NZDUSD", "US30",
    "USDCAD", "USDCHF", "USDJPY", "XAGUSD", "XAUUSD"
]

TIMEFRAMES = ["M5", "M15", "M30", "H1", "H2", "H4", "H8", "H12", "D1"]

SYNC_INTERVAL_SECONDS = 30
MAX_ROWS_PER_TABLE = 10000
```

### 2. `sync/timeframe_filter.py`
Create timeframe filtering logic:
- `TIMEFRAME_DIVISORS` dict mapping timeframe to minutes
- `filter_by_timeframe(rows, timeframe)` function:
  - M5: minutes divisible by 5 (00, 05, 10, ...)
  - M15: minutes divisible by 15 (00, 15, 30, 45)
  - M30: minutes divisible by 30 (00, 30)
  - H1: minute == 0 (on the hour)
  - H2: minute == 0 AND hour % 2 == 0
  - H4: minute == 0 AND hour % 4 == 0
  - H8: minute == 0 AND hour % 8 == 0
  - H12: minute == 0 AND hour % 12 == 0
  - D1: hour == 0 AND minute == 0 (midnight)
- `get_latest_timeframe_timestamp(timeframe)` - get most recent valid timestamp

### 3. `sync/db_connections.py`
Create database connection management:
- `get_sqlite_connection()` - returns sqlite3.Connection
- `get_postgresql_connection()` - returns connection from psycopg2 pool
- `return_postgresql_connection(conn)` - returns connection to pool
- Use connection pooling for PostgreSQL (SimpleConnectionPool)
- Handle connection errors gracefully

### 4. `sync/sync_to_postgresql.py`
Create main sync script with DataSyncer class:
- `__init__`: Initialize last_sync_timestamps dict, load from sync_state.json
- `load_sync_state()`: Load timestamps from JSON file
- `save_sync_state()`: Save timestamps to JSON file
- `sync_symbol(symbol)`: Main sync logic for one symbol
  - Query SQLite for rows > last_sync_timestamp
  - For each timeframe, filter rows and insert into PostgreSQL
  - Update last_sync_timestamp
- `insert_to_postgresql(conn, table_name, rows)`:
  - Use execute_batch for efficiency
  - Handle UPSERT with ON CONFLICT DO UPDATE
  - Convert Unix timestamp to PostgreSQL TIMESTAMPTZ
- `enforce_row_limit(conn, table_name)`:
  - Delete oldest rows if count > MAX_ROWS_PER_TABLE
- `run()`: Sync all symbols, save state, log completion
- Add `if __name__ == "__main__"` block

### 5. `sync/requirements.txt`
```
psycopg2-binary>=2.9.9
python-dotenv>=1.0.0
```

## Important Notes
- Sync script runs via cron every 30 seconds on Contabo VPS
- Handle network failures gracefully (retry logic)
- Log all sync operations for debugging
- Dynamic indicators (fractals, trendlines) only store latest values - older = NULL
- Use batch inserts for performance

## Success Criteria
- [ ] All Python files pass syntax check
- [ ] Sync script connects to both SQLite and PostgreSQL
- [ ] Timeframe filtering correctly categorizes data
- [ ] Data appears in correct PostgreSQL tables
- [ ] Sync state persisted between runs
- [ ] Row limit enforced (max 10,000 per table)
- [ ] Errors logged but don't crash the script

## Testing Commands
```bash
# Test sync script manually
cd sync
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python sync_to_postgresql.py

# Verify data in PostgreSQL
psql $POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
```

## Commit Instructions
After creating all files, commit with message:
```
feat(sync): add SQLite to PostgreSQL sync script

- Create DataSyncer class for reliable data transfer
- Implement timeframe filtering for 9 timeframes
- Add database connection pooling
- Persist sync state between runs
- Handle errors gracefully with logging
```
```

---

## Phase 4 Prompt: Next.js API Routes

```
# Part 20 - Phase 4: Next.js API Routes

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

## Phase 5 Prompt: Redis Caching Layer

```
# Part 20 - Phase 5: Redis Caching Layer

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-4 are complete.

This phase adds Redis caching for rapid data retrieval, reducing PostgreSQL load.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 7.3 (Redis Caching Strategy)
- `part-20-implementation-plan.md` - Phase 5 details

## Prerequisites
- Phase 4 completed (API routes working)
- Redis instance on Railway
- REDIS_URL environment variable configured

## Your Task
Create Redis caching layer and integrate with existing API routes.

## Files to Create

### 1. `lib/cache/redis.ts`
Create Redis client:
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const CACHE_TTL = 30; // 30 seconds to match sync interval

export async function get<T>(key: string): Promise<T | null>;
export async function set(key: string, value: any, ttl?: number): Promise<void>;
export async function del(key: string): Promise<void>;
export async function invalidatePattern(pattern: string): Promise<void>;
export default redis;
```

### 2. `lib/cache/indicator-cache.ts`
Create indicator-specific caching:
- `getCacheKey(symbol, timeframe)`: Returns `indicators:{symbol}:{timeframe}:latest`
- `getIndicatorDataCached(symbol, timeframe, limit)`:
  - Check Redis cache first
  - If hit, return cached data
  - If miss, fetch from PostgreSQL
  - Cache the result with TTL
  - Return data
- `invalidateIndicatorCache(symbol, timeframe?)`:
  - Delete specific key or pattern

### 3. `lib/cache/cache-invalidation.ts`
Create cache invalidation utilities:
- `invalidateOnSync(symbols: string[])`:
  - Called after sync script runs
  - Invalidates cache for synced symbols
- `invalidateAll()`:
  - Clear entire indicator cache
- `getCacheStats()`:
  - Return hit rate, memory usage, key count

### 4. Update `app/api/indicators/[symbol]/[timeframe]/route.ts`
Modify to use caching:
- Import `getIndicatorDataCached` from cache module
- Replace direct DB call with cached version
- Add `data_source: 'cache' | 'postgresql'` to metadata

## Additional Updates

### 5. Update `lib/db/queries.ts`
- Rename `getIndicatorData` to `getIndicatorDataFromDb`
- Export for use by cache module

### 6. Create `app/api/admin/cache/clear/route.ts`
Admin endpoint to clear cache:
- POST handler with AdminApiKey auth
- Accept optional `pattern` in body
- Call appropriate invalidation function
- Return keys_cleared count

## Important Notes
- TTL = 30 seconds matches sync interval
- Use ioredis package for Redis client
- Handle Redis connection errors gracefully
- Fallback to PostgreSQL if Redis unavailable

## Success Criteria
- [ ] Redis client connects successfully
- [ ] First API call fetches from PostgreSQL
- [ ] Second API call (within 30s) returns from cache
- [ ] Cache invalidation works
- [ ] API still works if Redis is down
- [ ] Admin cache clear endpoint works

## Testing Commands
```bash
# Install ioredis if not present
npm install ioredis

# Test cache behavior
curl http://localhost:3000/api/indicators/EURUSD/H1  # First call - DB
curl http://localhost:3000/api/indicators/EURUSD/H1  # Second call - Cache

# Check metadata.data_source in response

# Clear cache (admin)
curl -X POST -H "X-Admin-API-Key: $ADMIN_KEY" \
  http://localhost:3000/api/admin/cache/clear
```

## Commit Instructions
After creating all files, commit with message:
```
feat(cache): add Redis caching layer for indicator data

- Configure Redis client with 30s TTL
- Add indicator caching functions
- Integrate cache with API routes
- Add cache invalidation utilities
- Add admin cache clear endpoint
```
```

---

## Phase 6 Prompt: Confluence Score System

```
# Part 20 - Phase 6: Confluence Score System

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

## Phase 7 Prompt: Testing Framework

```
# Part 20 - Phase 7: Testing Framework

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-6 are complete.

This phase implements comprehensive testing with unit tests, integration tests, and API tests.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 10 (Testing Framework)
- `part-20-implementation-plan.md` - Phase 7 details

## Prerequisites
- Phases 1-6 completed (all functionality working)
- Jest already configured in the project

## Your Task
Create comprehensive test suite for Part 20.

## Files to Create

### 1. `__tests__/setup.ts`
Create test setup:
- Mock environment variables
- Mock database connections for unit tests
- Setup/teardown helpers
- Test utilities

### 2. `jest.config.js` (update if needed)
Ensure Jest is configured for:
- TypeScript support
- Path aliases (@/)
- Coverage reporting
- Test file patterns

### 3. `__tests__/unit/timeframe-filter.test.ts`
Unit tests for timeframe filtering:
- Test M5 filtering (5-minute boundaries)
- Test M15 filtering (15-minute boundaries)
- Test M30 filtering (30-minute boundaries)
- Test H1 filtering (hourly boundaries)
- Test H2, H4, H8, H12 filtering
- Test D1 filtering (midnight only)
- Test edge cases (empty data, invalid timestamps)

### 4. `__tests__/unit/confluence-calculator.test.ts`
Unit tests for confluence calculation:
- Test signal detection for each indicator type
- Test trend direction calculation
- Test strength calculation
- Test overall confluence score
- Test with missing/null data
- Test score bounds (0-10)

### 5. `__tests__/unit/symbol-utils.test.ts`
Unit tests for symbol utilities:
- Test suffix stripping (EURUSD.i → EURUSD)
- Test multiple suffix patterns
- Test already-normalized symbols
- Test supported symbol validation

### 6. `__tests__/unit/tier-validation.test.ts`
Unit tests for tier validation:
- Test FREE tier symbol access
- Test FREE tier timeframe access
- Test PRO tier full access
- Test denied access messages

### 7. `__tests__/integration/db-queries.test.ts`
Integration tests for database queries:
- Test getIndicatorData returns correct format
- Test multi-timeframe query
- Test with real PostgreSQL (use test database)
- Test connection pooling

### 8. `__tests__/integration/cache-integration.test.ts`
Integration tests for caching:
- Test cache miss → DB fetch → cache set
- Test cache hit returns cached data
- Test cache invalidation
- Test TTL expiration
- Test Redis fallback

### 9. `__tests__/api/indicators.test.ts`
API tests for indicators endpoint:
- Test GET /api/indicators/EURUSD/H1 returns 200
- Test invalid symbol returns 400
- Test invalid timeframe returns 400
- Test FREE tier denied PRO symbol returns 403
- Test response matches OpenAPI schema
- Test limit parameter works

### 10. `__tests__/api/confluence.test.ts`
API tests for confluence endpoint:
- Test GET /api/confluence/EURUSD returns 200 for PRO
- Test FREE tier returns 403
- Test timestamp parameter works
- Test all 117 indicators present
- Test score is 0-10

## Important Notes
- Use mocks for unit tests
- Use test database for integration tests
- API tests can use mocked session
- Aim for >80% code coverage

## Success Criteria
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All API tests pass
- [ ] Code coverage > 80%
- [ ] Tests run in CI pipeline

## Testing Commands
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- __tests__/unit/timeframe-filter.test.ts

# Run in watch mode
npm test -- --watch
```

## Commit Instructions
After creating all files, commit with message:
```
test(part20): add comprehensive testing framework

- Add unit tests for timeframe filtering
- Add unit tests for confluence calculation
- Add unit tests for symbol utilities
- Add integration tests for database and cache
- Add API tests for all endpoints
- Configure Jest with TypeScript
```
```

---

## Phase 8 Prompt: E2E Testing Migration

```
# Part 20 - Phase 8: E2E Testing Migration

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-7 are complete.

This phase migrates E2E tests from Part 6 to Part 20 architecture and adds new critical path tests.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Section 10.2 (Critical Path for E2E Testing)
- `part-20-implementation-plan.md` - Phase 8 details

## Prerequisites
- Phase 7 completed (unit and integration tests passing)
- Playwright installed in the project

## Your Task
Create E2E tests for Part 20 critical paths.

## Files to Create

### 1. `playwright.config.ts` (update if needed)
Configure Playwright:
- Base URL for local dev
- Test directory: e2e/
- Browser: chromium
- Retries for CI
- Screenshot on failure

### 2. `e2e/critical-path.spec.ts`
Create critical path E2E test:

```typescript
test.describe('Part 20 Critical Path', () => {
  test('Complete data flow from database to frontend', async ({ page }) => {
    // Step 1: Verify PostgreSQL has data
    // - Call /api/health/postgresql
    // - Assert tables = 135, connected = true

    // Step 2: Verify sync is recent
    // - Call /api/health/sync
    // - Assert last_sync within 60 seconds

    // Step 3: API returns correct data
    // - Call /api/indicators/EURUSD/H1
    // - Assert success = true
    // - Assert ohlc array not empty
    // - Assert all indicator fields present

    // Step 4: Chart renders correctly
    // - Navigate to /dashboard/chart/EURUSD/H1
    // - Wait for chart component to be visible
    // - Assert candlesticks rendered
    // - Assert indicators overlaid

    // Step 5: Indicators display on chart
    // - Assert fractal markers visible
    // - Assert trendlines visible
  });

  test('Tier access control works', async ({ page }) => {
    // Login as FREE user
    // Try to access PRO symbol - should see upgrade prompt
    // Try to access PRO timeframe - should see upgrade prompt
  });

  test('Confluence score for PRO users', async ({ page }) => {
    // Login as PRO user
    // Navigate to confluence view
    // Assert score displayed (0-10)
    // Assert all 9 timeframes shown
  });
});
```

### 3. `e2e/chart-rendering.spec.ts`
Create chart rendering tests:

```typescript
test.describe('Chart Rendering', () => {
  test('Chart loads with correct data', async ({ page }) => {
    // Navigate to chart page
    // Wait for loading to complete
    // Verify OHLC candles match API data
  });

  test('Timeframe switching works', async ({ page }) => {
    // Start on H1
    // Switch to H4
    // Verify data reloads
    // Verify chart updates
  });

  test('Symbol switching works', async ({ page }) => {
    // Start on EURUSD
    // Switch to XAUUSD
    // Verify data reloads
  });

  test('Indicators toggle on/off', async ({ page }) => {
    // Toggle fractals off
    // Assert markers hidden
    // Toggle back on
    // Assert markers visible
  });
});
```

## Part 6 Test Migration Mapping

| Part 6 Test | Part 20 Replacement |
|-------------|---------------------|
| Flask health check | PostgreSQL/Redis health check |
| Flask /api/indicators | Next.js /api/indicators |
| MT5 connection test | SQLite data freshness check |
| Python indicator calc | Verify PostgreSQL has correct values |
| Connection pool test | Database connection pool test |

## Important Notes
- E2E tests require running app and database
- Use test data fixtures for consistent results
- Add data-testid attributes to components if needed
- Tests should be independent (no order dependency)

## Success Criteria
- [ ] Critical path test passes
- [ ] Chart rendering tests pass
- [ ] Tier access tests pass
- [ ] Confluence tests pass
- [ ] Tests run in CI pipeline
- [ ] All Part 6 E2E behaviors covered

## Testing Commands
```bash
# Install Playwright browsers
npx playwright install

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test e2e/critical-path.spec.ts

# Generate report
npx playwright show-report
```

## Commit Instructions
After creating all files, commit with message:
```
test(e2e): migrate Part 6 E2E tests to Part 20 architecture

- Add critical path E2E test
- Add chart rendering E2E tests
- Add tier access E2E tests
- Configure Playwright
- Map all Part 6 test cases
```
```

---

## Phase 9 Prompt: Migration, Integration & Cutover (COMPREHENSIVE)

**Note:** This is the merged and comprehensive Phase 9. It combines deployment scripts with complete code migration steps.

```
# Part 20 - Phase 9: Migration, Integration & Cutover

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-8 are complete and all tests passing.

This phase handles:
1. Code migration - Update all Part 6 references to use Part 20
2. Deployment scripts - Create scripts for deployment and rollback
3. Production cutover - Execute the migration

Please refer to the attached documents:
- `part-20-architecture-design.md` - Architecture context
- `part-20-implementation-plan.md` - Phase 9 details
- `part-20-sqlite-sync-postgresql-openapi.yaml` - API specification

## Prerequisites
- Phases 1-8 completed with all tests passing
- Production PostgreSQL on Railway ready
- Production Redis on Railway ready
- MQL5 Services deployed to all 15 MT5 terminals
- Sync script tested in staging
- Phase 0 analysis completed (docs/migration/part6-to-part20-analysis.md)

## Your Task
Execute complete migration from Part 6 to Part 20.

---

## PART A: Code Migration

### Step A1: Update Environment Variables

**Files to modify:** `.env.example`, `.env.local.example`

**Remove these Part 6 variables:**
```bash
# REMOVE THESE:
MT5_API_URL=http://localhost:5001
MT5_API_KEY=xxx
MT5_ADMIN_API_KEY=xxx
FLASK_PORT=5001
```

**Add/verify Part 20 variables:**
```bash
# ADD THESE:
POSTGRESQL_URI=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
SQLITE_PATH=C:\MT5Data\trading_data.db  # Contabo VPS only
SYNC_INTERVAL=30
ADMIN_API_KEY=your-admin-key
```

### Step A2: Update Next.js API Routes

**For any file that calls Flask, update to use Part 20:**

```typescript
// BEFORE (Part 6 - calling Flask)
const response = await fetch(`${process.env.MT5_API_URL}/api/indicators/${symbol}/${timeframe}`);
const data = await response.json();

// AFTER (Part 20 - direct database via cache)
import { getIndicatorDataCached } from '@/lib/cache/indicator-cache';
const data = await getIndicatorDataCached(symbol, timeframe, limit);
```

**Files to check and update:**
- `app/api/indicators/[symbol]/[timeframe]/route.ts` - Should use Part 20 implementation
- `app/api/mt5/health/route.ts` - Update to check PostgreSQL/Redis
- `app/api/mt5/symbols/route.ts` - Use Part 20 tier validation
- `app/api/mt5/timeframes/route.ts` - Use Part 20 tier validation

### Step A3: Update/Remove Service Layer

**Files to DELETE or mark deprecated:**
```
lib/services/mt5-client.ts      → DELETE
lib/services/flask-api.ts       → DELETE
lib/api/mt5-service.ts          → DELETE
```

**Files to UPDATE (if they import from deleted files):**
```typescript
// Update any file that imported from mt5-client.ts
// to use Part 20 modules instead:
import { getIndicatorDataCached } from '@/lib/cache/indicator-cache';
import { validateTierAccess } from '@/lib/tier/validation';
```

### Step A4: Update Test Mocks

**Update test files to mock Part 20 instead of Part 6:**

```typescript
// BEFORE: Mock Flask
jest.mock('@/lib/services/mt5-client', () => ({
  fetchIndicators: jest.fn().mockResolvedValue(mockData)
}));

// AFTER: Mock Part 20
jest.mock('@/lib/cache/indicator-cache', () => ({
  getIndicatorDataCached: jest.fn().mockResolvedValue(mockData)
}));
```

**Files to update:**
- All test files in `__tests__/` that mock MT5/Flask
- Update E2E tests if they reference Flask URLs

### Step A5: Update Docker Configuration

**Modify `docker-compose.yml`:**

```yaml
# REMOVE this service block entirely:
# mt5-flask-service:
#   build: ./mt5-service
#   ports:
#     - "5001:5001"
#   environment:
#     - MT5_API_KEY=${MT5_API_KEY}

# UPDATE nextjs service:
services:
  nextjs:
    environment:
      - POSTGRESQL_URI=${POSTGRESQL_URI}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis

  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      - POSTGRES_DB=trading_alerts
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

### Step A6: Archive Part 6 Code

**DO NOT DELETE - Archive for rollback capability:**

```bash
# Create archive directory
mkdir -p archive/part6-flask-mt5

# Move Part 6 files
mv mt5-service/ archive/part6-flask-mt5/

# Create README in archive
```

**Create `archive/part6-flask-mt5/README.md`:**
```markdown
# Part 6 - Flask MT5 Service (ARCHIVED)

**Status:** Archived on [DATE]
**Replaced by:** Part 20 (SQLite + Sync to PostgreSQL)

This code is kept for rollback capability only. Do not use in production.

## Why Archived
Python MT5 API cannot access custom indicator buffers (iCustom not available).
Part 20 uses MQL5 Services to read indicators directly from MT5.

## Rollback Instructions
See: docs/migration/rollback-to-part6.md
```

### Step A7: Update Documentation

**Add deprecation notice to `docs/build-orders/part-06-flask-mt5.md`:**
```markdown
> ⚠️ **DEPRECATED**: Part 6 has been superseded by Part 20.
> See `docs/build-orders/part-20-architecture-design.md` for current architecture.
```

**Update `README.md` if it references Part 6 architecture.**

---

## PART B: Deployment Scripts

### File 1: `scripts/deploy-part20.sh`

```bash
#!/bin/bash
set -e

echo "========================================="
echo "Part 20 Deployment Script"
echo "========================================="

# Pre-deployment checks
echo "Step 1: Pre-deployment checks..."
npm test || { echo "Tests failed!"; exit 1; }
psql $POSTGRESQL_URI -c "SELECT 1" || { echo "PostgreSQL not accessible!"; exit 1; }
redis-cli -u $REDIS_URL PING || { echo "Redis not accessible!"; exit 1; }

echo "Step 2: Enable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/enable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "Step 3: Deploy application..."
# Railway/Vercel auto-deploys on git push
git push origin main

echo "Step 4: Wait for deployment..."
sleep 60

echo "Step 5: Start sync script on Contabo VPS..."
ssh contabo "cd /opt/trading-alerts/sync && ./start-sync.sh"

echo "Step 6: Verify data flowing..."
curl https://your-app.com/api/health | jq .

echo "Step 7: Run smoke tests..."
curl https://your-app.com/api/indicators/EURUSD/H1 | jq '.success'

echo "Step 8: Disable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/disable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "========================================="
echo "Deployment complete!"
echo "========================================="
```

### File 2: `scripts/rollback-to-part6.sh`

```bash
#!/bin/bash
set -e

echo "========================================="
echo "ROLLBACK: Part 20 → Part 6"
echo "========================================="

echo "WARNING: This will restore Flask MT5 service"
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

echo "Step 1: Enable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/enable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "Step 2: Stop sync script..."
ssh contabo "cd /opt/trading-alerts/sync && ./stop-sync.sh"

echo "Step 3: Restore Part 6 code..."
cp -r archive/part6-flask-mt5/mt5-service ./

echo "Step 4: Restore environment variables..."
# Restore MT5_API_URL, MT5_API_KEY in production env

echo "Step 5: Start Flask service..."
docker-compose up -d mt5-flask-service

echo "Step 6: Verify Flask responding..."
curl http://localhost:5001/api/health | jq .

echo "Step 7: Disable maintenance mode..."
curl -X POST https://your-app.com/api/admin/maintenance/disable \
  -H "X-Admin-API-Key: $ADMIN_API_KEY"

echo "========================================="
echo "Rollback complete. Part 6 is active."
echo "Please investigate Part 20 issues."
echo "========================================="
```

### File 3: `docs/migration/rollback-to-part6.md`

```markdown
# Rollback to Part 6 (Emergency Only)

## When to Use
Only if Part 20 has critical issues that cannot be fixed quickly:
- Error rate > 5% for 10+ minutes
- Data sync failing for 5+ minutes
- Chart accuracy issues
- Database connection failures

## Prerequisites
- Part 6 code exists in `archive/part6-flask-mt5/`
- MT5 terminals still running with indicators
- Flask dependencies still in requirements

## Quick Rollback (15 minutes)
```bash
./scripts/rollback-to-part6.sh
```

## Manual Rollback Steps
1. Enable maintenance mode
2. Stop sync script on Contabo VPS
3. Restore Part 6 code: `cp -r archive/part6-flask-mt5/mt5-service ./`
4. Restore environment variables (MT5_API_URL, etc.)
5. Start Flask service
6. Verify Flask health endpoint
7. Disable maintenance mode

## Post-Rollback
- Investigate Part 20 issues
- Create fix plan
- Schedule re-migration attempt
```

### File 4: `docs/DEPLOYMENT-CHECKLIST.md`

```markdown
# Part 20 Deployment Checklist

## Pre-Deployment (Day Before)

### Infrastructure
- [ ] PostgreSQL on Railway with TimescaleDB
- [ ] Redis on Railway
- [ ] All 135 tables created with indexes
- [ ] Retention policies configured

### MT5 Setup (Contabo VPS)
- [ ] All 15 MT5 terminals running
- [ ] MQL5 DataCollector service on each terminal
- [ ] SQLite database created and receiving data
- [ ] Sync script tested (SQLite → PostgreSQL)

### Code
- [ ] Phase 0 analysis completed
- [ ] Phases 1-8 code merged to main
- [ ] All Part 6 references updated (Part A steps)
- [ ] All tests passing in CI
- [ ] Build succeeds

## Deployment Day

### Pre-Cutover
- [ ] Notify users of maintenance window (if needed)
- [ ] Backup current production database
- [ ] Test rollback script in staging
- [ ] Confirm team availability

### Cutover
- [ ] Enable maintenance mode
- [ ] Deploy new code
- [ ] Start sync script
- [ ] Verify PostgreSQL has data
- [ ] Verify Redis cache working
- [ ] Verify API endpoints responding
- [ ] Run smoke tests
- [ ] Disable maintenance mode

### Post-Cutover (Monitor 1 hour)
- [ ] Error rate < 1%
- [ ] API response time < 500ms
- [ ] Chart accuracy matches MT5
- [ ] Sync running every 30s
- [ ] Redis cache hit rate > 80%

### Post-Cutover (24 hours)
- [ ] No critical errors
- [ ] User feedback positive
- [ ] Part 6 code archived

### Cleanup (After 30 days stable)
- [ ] Delete archive/part6-flask-mt5/
- [ ] Remove Part 6 references from docs
- [ ] Close migration tracking issues
```

---

## PART C: Verification

### API Endpoint Verification
```bash
# Health check
curl https://your-app.com/api/health

# Indicators (should return data from PostgreSQL)
curl https://your-app.com/api/indicators/EURUSD/H1

# Symbols (tier-filtered)
curl https://your-app.com/api/symbols

# Timeframes (tier-filtered)
curl https://your-app.com/api/timeframes

# Confluence (PRO only)
curl https://your-app.com/api/confluence/EURUSD
```

### Data Accuracy Verification
- [ ] Open MT5 terminal with EURUSD H1 chart
- [ ] Open web app with same chart
- [ ] Compare: OHLC values match
- [ ] Compare: Fractals match
- [ ] Compare: Trendlines match

### Performance Verification
- [ ] API response time < 200ms (cached)
- [ ] API response time < 500ms (uncached)
- [ ] Redis cache hit rate > 80%

---

## Success Criteria
- [ ] All Part 6 references removed from active code
- [ ] Part 6 code archived (not deleted)
- [ ] All API endpoints working
- [ ] Data accuracy verified
- [ ] Performance acceptable
- [ ] Rollback script tested
- [ ] Documentation updated

## Commit Instructions
After completing all migration steps:

```
feat: migrate from Part 6 (Flask) to Part 20 (SQLite + Sync + PostgreSQL)

BREAKING CHANGE: Flask MT5 service removed

Migration includes:
- Remove Flask service and MT5 Python API dependencies
- Update API routes to use PostgreSQL directly
- Update environment variables
- Update Docker configuration
- Archive Part 6 code for rollback capability
- Add deployment and rollback scripts
- Update all documentation

Part 6 archived to: archive/part6-flask-mt5/
```
```

---

## Summary

| Phase | Focus | Files | Est. Time |
|-------|-------|-------|-----------|
| 0 | Migration Analysis | 1 analysis doc | 1-2 hours |
| 1 | Database Schema Setup | 4 SQL files | 1-2 hours |
| 2 | MQL5 Service Development | 3 MQL5 files | 2-3 hours |
| 3 | Sync Script Development | 5 Python files | 2-3 hours |
| 4 | Next.js API Routes | 8 TypeScript files | 3-4 hours |
| 5 | Redis Caching Layer | 4 TypeScript files | 2 hours |
| 6 | Confluence Score System | 6 TypeScript files | 3-4 hours |
| 7 | Testing Framework | 10 test files | 3-4 hours |
| 8 | E2E Testing Migration | 3 E2E test files | 2-3 hours |
| 9 | Migration & Cutover | 4 scripts + code changes | 3-4 hours |

**Total: ~45 files + code migration, 22-31 hours of implementation**

**Note:** Phase 0 prompt is in `part-20-migration-prompts.md`. Run Phase 0 BEFORE starting Phase 1.

---

## Usage Tips

1. **Start Fresh**: Each phase requires a new Claude Code chat to manage context effectively.

2. **Attach Documents**: Always attach all 3 documents to each chat.

3. **Verify Before Proceeding**: Ensure each phase passes its success criteria before moving to the next.

4. **Commit Regularly**: Each phase should result in a commit with the provided message.

5. **Test Thoroughly**: Run the provided test commands after each phase.
