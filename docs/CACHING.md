# Caching System

## Overview

The Trading Alerts SaaS uses intelligent caching for indicator data to improve performance and reduce load on the MT5 service.

## Cache Behavior

**First Request (Cache MISS)**:

- Fetches data from MT5 service (~500-1000ms)
- Transforms and validates data
- Stores in cache with TTL based on timeframe
- Returns data to user

**Subsequent Requests (Cache HIT)**:

- Retrieves data from cache (~50-100ms)
- Returns immediately without MT5 call
- **10x faster response time**

## Cache TTL by Timeframe

| Timeframe | TTL    | Duration   |
| --------- | ------ | ---------- |
| M5        | 300s   | 5 minutes  |
| M15       | 900s   | 15 minutes |
| M30       | 1800s  | 30 minutes |
| H1        | 3600s  | 1 hour     |
| H2        | 7200s  | 2 hours    |
| H4        | 14400s | 4 hours    |
| H8        | 28800s | 8 hours    |
| H12       | 43200s | 12 hours   |
| D1        | 86400s | 24 hours   |

**Reasoning**: Shorter timeframes change more frequently, so they have shorter cache TTL. Longer timeframes are more stable, so they can be cached longer.

## Cache Keys

Format: `indicator:{SYMBOL}:{TIMEFRAME}:{BARS}`

Examples:

- `indicator:XAUUSD:H1:1000`
- `indicator:EURUSD:M5:500`
- `indicator:BTCUSD:D1:1000`

## API Response Headers

**Cache HIT**:

```
X-Cache: HIT
```

**Cache MISS**:

```
X-Cache: MISS
X-Cache-Status: Stored
```

## Monitoring Cache Performance

**Check cache statistics**:

```bash
GET /api/cache/stats
```

**Response**:

```json
{
  "success": true,
  "stats": {
    "hits": 150,
    "misses": 50,
    "sets": 50,
    "deletes": 5,
    "total": 200,
    "hitRate": "75.00%",
    "hitRateDecimal": 0.75,
    "cacheSize": 45
  },
  "timestamp": "2025-12-28T12:00:00.000Z"
}
```

## Cache Implementation Details

**Location**: `lib/cache/indicator-cache.ts`

**Storage**: In-memory cache (can be replaced with Redis)

**Features**:

- Automatic TTL based on timeframe
- Fire-and-forget cache writes (non-blocking)
- Safe error handling (cache failures don't break requests)
- Symbol-level invalidation
- Statistics tracking

## Development

**Clear cache in tests**:

```typescript
import { clearAllCache } from '@/lib/cache/indicator-cache';

beforeEach(async () => {
  await clearAllCache();
});
```

**Invalidate specific cache**:

```typescript
import { invalidateCachedData } from '@/lib/cache/indicator-cache';

await invalidateCachedData('XAUUSD', 'H1', 1000);
```

**Invalidate entire symbol**:

```typescript
import { invalidateSymbolCache } from '@/lib/cache/indicator-cache';

await invalidateSymbolCache('XAUUSD');
```

## Performance Response Metadata

The indicator API includes performance metadata in responses:

**Cache HIT Response**:

```json
{
  "success": true,
  "data": { ... },
  "cached": true,
  "cacheHit": true,
  "performance": {
    "cached": true,
    "estimatedSpeedup": "10x faster (no MT5 service call)"
  },
  "requestedAt": "2025-12-28T12:00:00.000Z"
}
```

**Cache MISS Response**:

```json
{
  "success": true,
  "data": { ... },
  "cached": false,
  "performance": {
    "cached": false,
    "note": "First request - data cached for subsequent requests"
  },
  "requestedAt": "2025-12-28T12:00:00.000Z"
}
```
