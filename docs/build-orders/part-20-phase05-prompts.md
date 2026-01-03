# Part 20 - Phase 05: Redis Caching Layer

**Purpose:** Add Redis caching for rapid data retrieval, reducing PostgreSQL load.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 05 Prompt

```
# Part 20 - Phase 05: Redis Caching Layer

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

## Next Step

After Phase 05, proceed to `part-20-phase06-prompts.md` (Confluence Score System).
