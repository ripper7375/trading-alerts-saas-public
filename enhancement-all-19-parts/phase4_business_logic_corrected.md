# Phase 4: Business Logic & APIs

**Sequential Execution Plan: Phase 4 of 6**
**Total Tasks**: 8
**Estimated Duration**: 6-8 hours
**Priority**: 🟢 FEATURE - Core business logic and API enhancements

---

## 🎯 Task 4.1: Tier-Based API Rate Limiting

**Priority**: MEDIUM | **Time**: 1 hour

#### Implementation with CORRECT Rate Limits

```typescript
// In app/api/indicators/[symbol]/[timeframe]/route.ts

import { tierRateLimits } from '@/lib/rate-limit';
import { getServerSession } from 'next-auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  const userTier = session?.user?.tier || 'FREE';

  // ✅ Apply tier-specific rate limit (60/hour FREE, 300/hour PRO)
  const rateLimit = tierRateLimits[userTier];
  const { success, limit, remaining, reset } = await rateLimit.limit(
    session?.user?.id || 'anonymous'
  );

  if (!success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message:
          userTier === 'FREE'
            ? 'Free tier: 60 requests per hour. Upgrade to Pro for 300 requests/hour.'
            : 'Pro tier: 300 requests per hour limit reached.',
        limit,
        remaining: 0,
        reset: new Date(reset).toISOString(),
        upgrade:
          userTier === 'FREE'
            ? {
                tier: 'PRO',
                newLimit: 300,
                price: '$29/month or $290/year',
                trial: '7-day free trial available',
              }
            : undefined,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.json(data, {
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    },
  });

  // ... rest of endpoint
}
```

---

## 🎯 Task 4.2: Indicator Data Caching

**Priority**: MEDIUM | **Time**: 1.5 hours

#### Implementation with CORRECT Timeframes

```typescript
// Create lib/cache.ts

import { redis } from './redis';

/**
 * ✅ CORRECT cache TTL - NO M1 or W1!
 * Includes H2, H8, H12
 */
const CACHE_TTL = {
  M5: 300, // 5 minutes
  M15: 900, // 15 minutes
  M30: 1800, // 30 minutes
  H1: 3600, // 1 hour
  H2: 7200, // 2 hours
  H4: 14400, // 4 hours
  H8: 28800, // 8 hours
  H12: 43200, // 12 hours
  D1: 86400, // 1 day
  // ❌ NO M1 or W1 in the system!
} as const;

export async function getCachedIndicatorData(
  symbol: string,
  timeframe: string
): Promise<any | null> {
  const key = `indicator:${symbol}:${timeframe}`;
  const cached = await redis.get(key);

  if (cached) {
    console.log(`Cache HIT: ${symbol}/${timeframe}`);
    return JSON.parse(cached as string);
  }

  console.log(`Cache MISS: ${symbol}/${timeframe}`);
  return null;
}

export async function setCachedIndicatorData(
  symbol: string,
  timeframe: string,
  data: any
): Promise<void> {
  const key = `indicator:${symbol}:${timeframe}`;
  const ttl = CACHE_TTL[timeframe as keyof typeof CACHE_TTL] || 3600;

  await redis.setex(key, ttl, JSON.stringify(data));
  console.log(`Cached: ${symbol}/${timeframe} for ${ttl}s`);
}

/**
 * ✅ Invalidate cache for a symbol across all timeframes
 */
export async function invalidateSymbolCache(symbol: string): Promise<void> {
  const timeframes = Object.keys(CACHE_TTL);
  const keys = timeframes.map((tf) => `indicator:${symbol}:${tf}`);

  if (keys.length > 0) {
    await Promise.all(keys.map((key) => redis.del(key)));
    console.log(`Invalidated cache for ${symbol}`);
  }
}
```

#### Apply to API Route

```typescript
// In app/api/indicators/[symbol]/[timeframe]/route.ts

import { getCachedIndicatorData, setCachedIndicatorData } from '@/lib/cache';

export async function GET(req: NextRequest, { params }) {
  // ... auth and validation ...

  // ✅ Check cache first
  const cached = await getCachedIndicatorData(symbol, timeframe);
  if (cached) {
    return NextResponse.json({
      success: true,
      data: cached,
      tier: userTier,
      cached: true,
      requestedAt: new Date().toISOString(),
    });
  }

  // Fetch from MT5
  const data = await fetchIndicatorData(symbol, timeframe, bars);

  // ✅ Cache with correct TTL (includes H2, H8, H12)
  await setCachedIndicatorData(symbol, timeframe, data);

  return NextResponse.json({
    success: true,
    data,
    tier: userTier,
    cached: false,
    requestedAt: new Date().toISOString(),
  });
}
```

---

## 🎯 Task 4.3: Indicator Tier Filtering

**Priority**: HIGH | **Time**: 1 hour

#### Implementation with CORRECT Indicator Lists

```typescript
// Create lib/indicator-filter.ts

/**
 * ✅ CORRECT indicator tier system
 */
const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;

const PRO_ONLY_INDICATORS = [
  'momentum_candles',
  'keltner_channels',
  'tema',
  'hrma',
  'smma',
  'zigzag',
] as const;

const ALL_INDICATORS = [...BASIC_INDICATORS, ...PRO_ONLY_INDICATORS] as const;

export type IndicatorId = (typeof ALL_INDICATORS)[number];
export type BasicIndicator = (typeof BASIC_INDICATORS)[number];
export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];

/**
 * Check if user can access indicator
 */
export function canAccessIndicator(
  indicator: string,
  tier: 'FREE' | 'PRO'
): boolean {
  if (tier === 'PRO') return ALL_INDICATORS.includes(indicator as any);
  return BASIC_INDICATORS.includes(indicator as any);
}

/**
 * Get accessible indicators for tier
 */
export function getAccessibleIndicators(tier: 'FREE' | 'PRO'): IndicatorId[] {
  if (tier === 'PRO') return [...ALL_INDICATORS];
  return [...BASIC_INDICATORS];
}

/**
 * Get locked indicators for tier
 */
export function getLockedIndicators(tier: 'FREE' | 'PRO'): ProOnlyIndicator[] {
  if (tier === 'PRO') return [];
  return [...PRO_ONLY_INDICATORS];
}

/**
 * Filter indicators based on tier access
 */
export function filterIndicatorData(data: any, tier: 'FREE' | 'PRO') {
  if (tier === 'PRO') {
    return data; // No filtering for PRO
  }

  // For FREE tier, remove PRO-only indicators
  const filtered = { ...data };

  if (filtered.proIndicators) {
    // Keep only the basic indicators data
    const allowedData: any = {};

    // Keep fractals and trendlines data if present
    Object.keys(filtered.proIndicators).forEach((key) => {
      const indicator = key.toLowerCase();
      if (BASIC_INDICATORS.includes(indicator as any)) {
        allowedData[key] = filtered.proIndicators[key];
      }
    });

    filtered.proIndicators = allowedData;
  }

  if (filtered.proIndicatorsTransformed) {
    const allowedTransformed: any = {};

    Object.keys(filtered.proIndicatorsTransformed).forEach((key) => {
      const indicator = key.toLowerCase();
      if (BASIC_INDICATORS.includes(indicator as any)) {
        allowedTransformed[key] = filtered.proIndicatorsTransformed[key];
      }
    });

    filtered.proIndicatorsTransformed = allowedTransformed;
  }

  return filtered;
}

/**
 * Generate upgrade info for locked indicators
 */
export function getIndicatorUpgradeInfo(
  requestedIndicators: string[],
  tier: 'FREE' | 'PRO'
) {
  const locked = requestedIndicators.filter(
    (ind) => !canAccessIndicator(ind, tier)
  );

  return {
    upgradeRequired: locked.length > 0,
    lockedIndicators: locked,
    accessibleIndicators: requestedIndicators.filter((ind) =>
      canAccessIndicator(ind, tier)
    ),
    upgradeMessage:
      locked.length > 0
        ? `Upgrade to Pro to access ${locked.join(', ')}. Only $29/month with 7-day free trial.`
        : null,
  };
}
```

#### Apply to API Route

```typescript
// In app/api/indicators/[symbol]/[timeframe]/route.ts

import {
  filterIndicatorData,
  getIndicatorUpgradeInfo,
} from '@/lib/indicator-filter';

export async function GET(req: NextRequest, { params }) {
  // ... after fetching data ...

  // ✅ Filter indicators based on tier
  const filteredData = filterIndicatorData(data, userTier);

  // ✅ Add upgrade info for FREE users
  const requestedIndicators =
    req.nextUrl.searchParams.get('indicators')?.split(',') || [];
  const upgradeInfo =
    userTier === 'FREE' && requestedIndicators.length > 0
      ? getIndicatorUpgradeInfo(requestedIndicators, userTier)
      : null;

  return NextResponse.json({
    success: true,
    data: filteredData,
    tier: userTier,
    ...(upgradeInfo?.upgradeRequired && {
      upgrade: {
        required: true,
        message: upgradeInfo.upgradeMessage,
        locked: upgradeInfo.lockedIndicators,
        tier: 'PRO',
        pricing: {
          monthly: '$29',
          yearly: '$290',
          trial: '7 days free',
        },
      },
    }),
    requestedAt: new Date().toISOString(),
  });
}
```

---

## 🎯 Task 4.4-4.8: Additional Features

**Task 4.4**: Alert System Loading States
**Task 4.5**: Alert Form Validation (react-hook-form)
**Task 4.6**: MT5 Service Integration Tests with CORRECT symbols/timeframes
**Task 4.7**: MT5 Pydantic Models with CORRECT validation
**Task 4.8**: Complete Business Logic Tests

---

## 🎯 MT5 Service Corrections

```python
# mt5-service/models/requests.py

from pydantic import BaseModel, Field, validator

# ✅ CORRECT symbols (15 total)
VALID_SYMBOLS = [
    'BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD',  # FREE (5)
    'AUDJPY', 'AUDUSD', 'ETHUSD', 'GBPJPY', 'GBPUSD',  # PRO exclusive
    'NDX100', 'NZDUSD', 'USDCAD', 'USDCHF', 'XAGUSD'   # PRO exclusive (10)
]

# ✅ CORRECT timeframes (9 total, NO M1 or W1!)
VALID_TIMEFRAMES = [
    'M5', 'M15', 'M30',           # Intraday short
    'H1', 'H2', 'H4', 'H8', 'H12', # Intraday medium
    'D1'                          # Daily
]

class IndicatorRequest(BaseModel):
    symbol: str = Field(..., min_length=1)
    timeframe: str = Field(..., min_length=1)
    bars: int = Field(default=1000, ge=1, le=5000)

    @validator('symbol')
    def validate_symbol(cls, v):
        if v.upper() not in VALID_SYMBOLS:
            raise ValueError(
                f'Invalid symbol: {v}. Must be one of: {", ".join(VALID_SYMBOLS)}'
            )
        return v.upper()

    @validator('timeframe')
    def validate_timeframe(cls, v):
        v_upper = v.upper()
        if v_upper not in VALID_TIMEFRAMES:
            raise ValueError(
                f'Invalid timeframe: {v}. Must be one of: {", ".join(VALID_TIMEFRAMES)}'
            )
        return v_upper
```

---

## ✅ Phase 4 Completion Checklist

### API Features ✅

- [ ] Rate limiting: 60/hour FREE, 300/hour PRO
- [ ] Caching with correct TTL (includes H2/H8/H12, NO M1/W1)
- [ ] Indicator filtering: 2 basic FREE, 8 total PRO
- [ ] Upgrade prompts with correct pricing

### Validation ✅

- [ ] Symbol validation: 15 total
- [ ] Timeframe validation: 9 total (NO M1/W1!)
- [ ] Indicator validation: basic vs PRO-only
- [ ] MT5 service validates correctly

### Quality ✅

- [ ] All tests passing
- [ ] Business logic tested
- [ ] Coverage >70%

---
