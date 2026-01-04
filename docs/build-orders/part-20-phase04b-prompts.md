# Part 20 - Phase 04b: Next.js API Routes

**Purpose:** Create Next.js API routes to serve indicator data from PostgreSQL, using the library files created in Phase 04a.

---

## Usage Instructions

1. Start a fresh Claude Code (web) chat
2. Attach these 3 documents:
   - `docs/build-orders/part-20-architecture-design.md`
   - `docs/build-orders/part-20-implementation-plan.md`
   - `docs/open-api-documents/part-20-sqlite-sync-postgresql-openapi.yaml`
3. Copy and paste the prompt below

---

## Phase 04b Prompt

```
# Part 20 - Phase 04b: Next.js API Routes

## Context
I'm implementing Part 20 of Trading Alerts SaaS. Phases 1-3 and Phase 04a are complete.

Phase 04a created these library files that are now available:
- `lib/indicators/types.ts` - TypeScript types
- `lib/db/postgresql.ts` - PostgreSQL client
- `lib/db/queries.ts` - Database query functions
- `lib/tier/validation.ts` - Tier access validation
- `lib/market-hours/trading-sessions.ts` - Market hours config
- `lib/market-hours/validator.ts` - Market hours validation

This phase creates the API routes that use these libraries.

Please refer to the attached documents:
- `part-20-architecture-design.md` - Full architecture context
- `part-20-implementation-plan.md` - Phase 4 details
- `part-20-sqlite-sync-postgresql-openapi.yaml` - Complete API specification

## Prerequisites
- Phase 04a completed (all library files exist and compile)
- PostgreSQL has data from Phase 3 sync
- NextAuth.js configured in existing app

## Your Task
Create 4 API route files that import from the Phase 04a libraries.

## Files to Create

### 1. `app/api/indicators/[symbol]/[timeframe]/route.ts`
Create main indicators endpoint:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getIndicatorData, getDataFreshness } from '@/lib/db/queries';
import { validateTierAccess, isValidSymbol, isValidTimeframe } from '@/lib/tier/validation';
import { getMarketMetadata } from '@/lib/market-hours/validator';
import { IndicatorResponse } from '@/lib/indicators/types';

interface RouteParams {
  params: {
    symbol: string;
    timeframe: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<IndicatorResponse>> {
  try {
    const { symbol, timeframe } = params;
    const upperSymbol = symbol.toUpperCase();
    const upperTimeframe = timeframe.toUpperCase();

    // Validate symbol
    if (!isValidSymbol(upperSymbol)) {
      return NextResponse.json(
        { success: false, error: `Invalid symbol: ${symbol}` },
        { status: 400 }
      );
    }

    // Validate timeframe
    if (!isValidTimeframe(upperTimeframe)) {
      return NextResponse.json(
        { success: false, error: `Invalid timeframe: ${timeframe}` },
        { status: 400 }
      );
    }

    // Get user session and tier
    const session = await getServerSession(authOptions);
    const userTier = (session?.user as any)?.tier || 'FREE';

    // Validate tier access
    const accessResult = validateTierAccess(upperSymbol, upperTimeframe, userTier);
    if (!accessResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: accessResult.message,
        },
        { status: 403 }
      );
    }

    // Parse limit query param
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '1000', 10), 1),
      10000
    );

    // Fetch indicator data
    const data = await getIndicatorData(upperSymbol, upperTimeframe, limit);
    const lastUpdate = await getDataFreshness(upperSymbol, upperTimeframe);

    // Get market metadata
    const marketMetadata = getMarketMetadata(upperSymbol);

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        metadata: {
          symbol: upperSymbol,
          timeframe: upperTimeframe,
          tier: userTier,
          bars_returned: data.ohlc.length,
          last_update: lastUpdate?.toISOString() || new Date().toISOString(),
          pro_indicators_enabled: userTier === 'PRO',
          ...marketMetadata,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching indicator data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. `app/api/indicators/health/route.ts`
Create health check endpoint (no auth required):
```typescript
import { NextResponse } from 'next/server';
import { checkConnection, getPool } from '@/lib/db/postgresql';
import { getTableCount } from '@/lib/db/queries';

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  version: string;
  database: {
    connected: boolean;
    tables: number;
  };
  timestamp: string;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  try {
    const connected = await checkConnection();
    const tableCount = connected ? await getTableCount() : 0;

    const response: HealthResponse = {
      status: connected ? 'healthy' : 'unhealthy',
      version: '2.0.0', // Part 20 version
      database: {
        connected,
        tables: tableCount,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: connected ? 200 : 503,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        version: '2.0.0',
        database: {
          connected: false,
          tables: 0,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

### 3. `app/api/symbols/route.ts`
Create symbols endpoint:
```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAccessibleSymbols, ALL_SYMBOLS, FREE_SYMBOLS } from '@/lib/tier/validation';

interface SymbolsResponse {
  success: boolean;
  symbols: readonly string[];
  tier: string;
  total_available: number;
  free_symbols: readonly string[];
}

export async function GET(): Promise<NextResponse<SymbolsResponse>> {
  try {
    const session = await getServerSession(authOptions);
    const userTier = (session?.user as any)?.tier || 'FREE';

    const accessibleSymbols = getAccessibleSymbols(userTier);

    return NextResponse.json({
      success: true,
      symbols: accessibleSymbols,
      tier: userTier,
      total_available: ALL_SYMBOLS.length,
      free_symbols: FREE_SYMBOLS,
    });
  } catch (error) {
    console.error('Error fetching symbols:', error);
    return NextResponse.json(
      {
        success: false,
        symbols: FREE_SYMBOLS,
        tier: 'FREE',
        total_available: ALL_SYMBOLS.length,
        free_symbols: FREE_SYMBOLS,
      },
      { status: 500 }
    );
  }
}
```

### 4. `app/api/timeframes/route.ts`
Create timeframes endpoint:
```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAccessibleTimeframes, ALL_TIMEFRAMES, FREE_TIMEFRAMES } from '@/lib/tier/validation';

interface TimeframesResponse {
  success: boolean;
  timeframes: readonly string[];
  tier: string;
  total_available: number;
  free_timeframes: readonly string[];
}

export async function GET(): Promise<NextResponse<TimeframesResponse>> {
  try {
    const session = await getServerSession(authOptions);
    const userTier = (session?.user as any)?.tier || 'FREE';

    const accessibleTimeframes = getAccessibleTimeframes(userTier);

    return NextResponse.json({
      success: true,
      timeframes: accessibleTimeframes,
      tier: userTier,
      total_available: ALL_TIMEFRAMES.length,
      free_timeframes: FREE_TIMEFRAMES,
    });
  } catch (error) {
    console.error('Error fetching timeframes:', error);
    return NextResponse.json(
      {
        success: false,
        timeframes: FREE_TIMEFRAMES,
        tier: 'FREE',
        total_available: ALL_TIMEFRAMES.length,
        free_timeframes: FREE_TIMEFRAMES,
      },
      { status: 500 }
    );
  }
}
```

## Important Notes
- All routes import from Phase 04a library files
- Use NextAuth.js `getServerSession` for authentication
- Match Part 6 API response format for frontend compatibility
- All timestamps are Unix timestamps (UTC-based)
- Include market status metadata in indicator responses
- Health endpoint requires no authentication

## Success Criteria
- [ ] All 4 API route files compile without errors
- [ ] `npm run build` passes
- [ ] GET /api/indicators/health returns status
- [ ] GET /api/symbols returns symbol list
- [ ] GET /api/timeframes returns timeframe list
- [ ] GET /api/indicators/EURUSD/H1 returns data (with auth)
- [ ] FREE tier blocked from PRO symbols/timeframes (403)
- [ ] Market status metadata included in indicator response

## Testing Commands
```bash
# Build to verify compilation
npm run build

# Start dev server
npm run dev

# Test endpoints (in another terminal)
curl http://localhost:3000/api/indicators/health
curl http://localhost:3000/api/symbols
curl http://localhost:3000/api/timeframes
curl http://localhost:3000/api/indicators/EURUSD/H1
curl http://localhost:3000/api/indicators/BTCUSD/D1

# Test tier restriction (should return 403 for FREE tier)
curl http://localhost:3000/api/indicators/AUDJPY/M5
```

## Commit Instructions
After creating all files, commit with message:
```
feat(api): add Next.js API routes for indicator data

- Add indicators endpoint with tier validation
- Add health check endpoint
- Add symbols endpoint with tier filtering
- Add timeframes endpoint with tier filtering
- Include market status metadata in responses
- Replace Flask endpoints from Part 6
```
```

---

## Next Step

After Phase 04b compiles successfully, proceed to `part-20-phase05-prompts.md` (Redis Caching Layer).
