# Frontend Multi-Backend Architecture - SIMPLIFIED

**Based on Inter-Stack Communication Matrix**
**Date:** 2026-01-18
**Version:** 2.0 (Simplified)

---

## 🎯 Architecture Overview

### **Communication Matrix:**

```
┌─────────────────────────────────────────────────────────┐
│              ALLOWED COMMUNICATION                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend (UI Only)                                     │
│    ├─ ✅ Can access Stack A                            │
│    ├─ ✅ Can access Stack B                            │
│    └─ ❌ CANNOT access Stack C (Admin only)            │
│                                                         │
│  Stack A                                                │
│    ├─ ✅ Can access Stack B                            │
│    └─ ✅ Can access Stack C                            │
│                                                         │
│  Stack B                                                │
│    ├─ ✅ Can access Stack A                            │
│    └─ ✅ Can access Stack C                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Simplified Architecture

### **Frontend Only Needs 2 Clients:**

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  API Clients:                                                │
│  ├─ api.stackA → Stack A (User, Auth, Billing, Admin)      │
│  └─ api.stackB → Stack B (Watchlist, Alerts, Analytics,    │
│                           Market Data via Stack C)          │
│                                                              │
└─────────┬────────────────────────────────┬──────────────────┘
          │                                │
          ▼                                ▼
┌──────────────────────┐       ┌──────────────────────┐
│   Stack A (Railway)  │       │   Stack B (Railway)  │
│                      │       │                      │
│  - User/Profile      │◄──────┤  - Watchlist        │
│  - Authentication    │       │  - Alerts           │
│  - Subscription      │       │  - Notifications    │
│  - Billing           │       │  - Confluence       │
│  - Admin             │       │  - Leader Board     │
│  - Affiliate         │       │  - Market Data API  │◄─┐
│  - Payments          │       │    (proxies to C)   │  │
│                      │       │                      │  │
│  Database A          │       │  Database B          │  │
│  (PostgreSQL)        │       │  (PostgreSQL)        │  │
└──────────────────────┘       │  Message Queue       │  │
                                │  (Redis/BullMQ)      │  │
                                └──────────┬───────────┘  │
                                           │              │
                                           ▼              │
                                ┌──────────────────────┐  │
                                │  Stack C (Contabo)   │  │
                                │                      │  │
                                │  - MT5 Data Collect  │  │
                                │  - SQLite Database   │  │
                                │  - Market Data       │  │
                                │                      │  │
                                │  ⚠️ Admin Access Only│  │
                                └──────────────────────┘  │
                                           ▲              │
                                           │              │
                                           └──────────────┘
```

---

## 📝 Updated Implementation

### **1. Simplified Environment Variables**

```bash
# frontend/.env.example

# ==========================================
# API ENDPOINTS (Simplified - Only 2!)
# ==========================================

# Backend Stack A (Main CRUD, Auth, Billing)
# Handles: User, Profile, Subscription, Billing, Admin, Affiliate, Payments
NEXT_PUBLIC_API_A_URL=

# Backend Stack B (Async Workers, Analytics, Market Data Gateway)
# Handles: Watchlist, Alerts, Notifications, Confluence, Leader Board
# Also proxies market data requests to Stack C
NEXT_PUBLIC_API_B_URL=

# ⚠️ NO NEXT_PUBLIC_API_C_URL - Frontend doesn't access Stack C directly!

# Development Mode - Enable MSW Mocks
NEXT_PUBLIC_USE_MOCKS=false

# ==========================================
# AUTHENTICATION (NextAuth)
# ==========================================
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# ... other vars
```

---

### **2. Simplified API Client Structure**

```typescript
// frontend/lib/api-clients/index.ts

import { StackAClient } from './stack-a-client';
import { StackBClient } from './stack-b-client';

// Only 2 clients needed!
export const api = {
  stackA: new StackAClient(),
  stackB: new StackBClient(),
};

// No stackC needed - Both Stack A and Stack B proxy market data from Stack C
```

---

### **3. Both Stack A and Stack B Can Handle Market Data**

```typescript
// frontend/lib/api-clients/stack-b-client.ts

export class StackBClient extends BaseApiClient {
  constructor() {
    const baseURL = process.env['NEXT_PUBLIC_API_B_URL'] || '/api';
    super(baseURL);
  }

  // ==========================================
  // MARKET DATA (Proxied from Stack C)
  // ==========================================

  async getCandles(symbol: string, timeframe: string, params?: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }) {
    // Stack B proxies this to Stack C (MT5 Python API)
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/candles/${symbol}/${timeframe}${query ? `?${query}` : ''}`);
  }

  async getIndicators(symbol: string, timeframe: string) {
    // Stack B fetches from Stack C, caches in Redis, adds confluence scores
    return this.get(`/indicators/${symbol}/${timeframe}`);
  }

  async getSymbols() {
    // Stack B fetches from Stack C, filters by tier, caches in Redis
    return this.get('/symbols');
  }

  async getTimeframes() {
    // Stack B fetches from Stack C, filters by tier, caches in Redis
    return this.get('/timeframes');
  }
}

// ⚠️ IMPORTANT: Stack A also has the same market data methods!
// Both Stack A and Stack B can access Stack C for market data.

  // ==========================================
  // WATCHLIST (Part 10)
  // ==========================================
  async getWatchlist() { ... }

  // ==========================================
  // ALERTS (Part 11)
  // ==========================================
  async getAlerts() { ... }

  // ==========================================
  // ANALYTICS (Parts 22-23)
  // ==========================================
  async getConfluenceScores(symbol: string) { ... }
  async getLeaderBoard() { ... }
}
```

---

### **4. Component Usage (Simpler!)**

```typescript
// frontend/app/charts/[symbol]/[timeframe]/page.tsx

import { api } from '@/lib/api-clients';

export default function ChartPage({ params }) {
  const { symbol, timeframe } = params;

  useEffect(() => {
    async function loadData() {
      // Get candles from Stack B (which proxies to Stack C)
      const candles = await api.stackB.getCandles(symbol, timeframe);

      // Get confluence scores from Stack B
      const confluence = await api.stackB.getConfluenceScore(symbol, timeframe);

      setChartData({ candles, confluence });
    }

    loadData();
  }, [symbol, timeframe]);

  return <TradingChart data={chartData} />;
}
```

**No need to know about Stack C!** ✅

---

## 🔄 How Stack B Proxies to Stack C

### **Backend Stack B Implementation:**

```typescript
// backend-stack-b/src/market-data/market-data.controller.ts

@Controller('candles')
export class MarketDataController {
  constructor(
    private marketDataService: MarketDataService,
    private cacheService: CacheService,
  ) {}

  @Get(':symbol/:timeframe')
  async getCandles(
    @Param('symbol') symbol: string,
    @Param('timeframe') timeframe: string,
    @Query() query: GetCandlesDto,
  ) {
    const cacheKey = `candles:${symbol}:${timeframe}`;

    // Check cache first
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    // Fetch from Stack C
    const candles = await this.marketDataService.fetchFromStackC(
      symbol,
      timeframe,
      query,
    );

    // Cache for 1 minute
    await this.cacheService.set(cacheKey, candles, 60);

    return candles;
  }
}
```

```typescript
// backend-stack-b/src/market-data/market-data.service.ts

@Injectable()
export class MarketDataService {
  private stackCClient: HttpService;

  constructor() {
    this.stackCClient = new HttpService({
      baseURL: process.env.STACK_C_URL, // http://contabo-vps:5000
    });
  }

  async fetchFromStackC(symbol: string, timeframe: string, query: any) {
    try {
      const response = await this.stackCClient.get(
        `/candles/${symbol}/${timeframe}`,
        { params: query },
      );
      return response.data;
    } catch (error) {
      throw new ServiceUnavailableException('Market data service unavailable');
    }
  }
}
```

**Benefits:**
- ✅ Stack B caches market data (reduces load on Stack C)
- ✅ Stack B can add confluence scores to market data
- ✅ Stack B handles errors from Stack C gracefully
- ✅ Frontend doesn't need to know Stack C exists

---

## 📊 Complexity Reduction

### **Before (3-Backend Architecture):**

| Aspect | Complexity |
|--------|------------|
| Frontend API clients | 3 clients (A, B, C) |
| Environment variables | 3 URLs |
| CORS configuration | 3 backends |
| Error handling | 3 separate error sources |
| Authentication | 3 backends to secure |
| Monitoring | 3 backends to monitor |
| Network hops | Frontend → Stack C (direct) |

### **After (2-Backend Architecture with Proxy):**

| Aspect | Complexity |
|--------|------------|
| Frontend API clients | 2 clients (A, B) ✅ |
| Environment variables | 2 URLs ✅ |
| CORS configuration | 2 backends ✅ |
| Error handling | 2 separate error sources ✅ |
| Authentication | 2 backends to secure ✅ |
| Monitoring | Frontend monitors 2 backends ✅ |
| Network hops | Frontend → Stack A/B → Stack C ✅ |
| Caching | Both Stack A and B cache Stack C data in Redis ✅ |
| Security | Frontend doesn't directly access Stack C ✅ |

**Reduction:** ~30% less complexity! 🎉

---

## 🔒 Security Benefits

### **Stack C is Not Directly Accessible from Frontend:**

```
✅ Advantages:
- Stack C (Contabo VPS) doesn't need public HTTPS
- Stack C doesn't need CORS configuration
- Stack C doesn't need JWT authentication from frontend
- Stack C only trusts requests from Stack B (internal network)
- Reduces attack surface
```

### **Stack B Acts as Security Gateway:**

```typescript
// Stack B validates user permissions before fetching from Stack C
async getCandles(user: User, symbol: string, timeframe: string) {
  // 1. Check user tier
  const canAccess = await this.tierService.validateAccess(
    user.tier,
    symbol,
    timeframe,
  );

  if (!canAccess) {
    throw new ForbiddenException('Symbol not allowed for your tier');
  }

  // 2. Fetch from Stack C (only if allowed)
  return this.fetchFromStackC(symbol, timeframe);
}
```

**Frontend can't bypass tier restrictions!** ✅

---

## 🚀 Migration Impact

### **Reduced Changes Needed:**

| Change | Before (3 backends) | After (2 backends) | Savings |
|--------|--------------------|--------------------|---------|
| API clients to create | 3 | 2 | -33% |
| Env vars to set | 3 | 2 | -33% |
| CORS configs | 3 | 2 | -33% |
| Components to update | ~20 | ~15 | -25% |
| Test scenarios | 9 (3²) | 4 (2²) | -55% |

**Overall Complexity Reduction:** ~35% 🎉

---

## ✅ Revised Checklist

### Must Do (Critical):
1. ✅ Refactor API client to 2-backend architecture (not 3)
2. ✅ Update environment variables (2 URLs, not 3)
3. ✅ Generate TypeScript types from Stack B OpenAPI specs
4. ✅ Update components to use api.stackA or api.stackB (not api.stackC)
5. ✅ Stack B implements market data proxy endpoints

### Stack B Must Implement:
6. ✅ Proxy endpoints for market data (GET /candles/:symbol/:timeframe)
7. ✅ Cache layer for Stack C data
8. ✅ Tier validation before fetching from Stack C
9. ✅ Error handling for Stack C unavailability

---

## 📋 Feature Routing Table

| Feature | Frontend Calls | Backend Handles | Proxies To |
|---------|---------------|-----------------|------------|
| User Profile | api.stackA | Stack A | - |
| Authentication | api.stackA | Stack A | - |
| Subscription | api.stackA | Stack A | - |
| Billing | api.stackA | Stack A | - |
| Admin | api.stackA | Stack A | - |
| Watchlist | api.stackB | Stack B | - |
| Alerts | api.stackB | Stack B | - |
| Notifications | api.stackB | Stack B | - |
| Confluence | api.stackB | Stack B | Stack C (for data) |
| Leader Board | api.stackB | Stack B | Stack C (for data) |
| **Market Data** | **api.stackB** | **Stack B** | **Stack C** ✅ |
| Charts | api.stackB | Stack B | Stack C ✅ |

---

## 🎯 Summary

### **Original Question:**
"Could not access Stack C from UI - could this reduce complexity?"

### **Answer:**
**YES! Significant complexity reduction (~35%):**

1. ✅ Frontend only needs 2 API clients (not 3)
2. ✅ Only 2 environment variables (not 3)
3. ✅ **Both Stack A and Stack B** proxy market data from Stack C
4. ✅ Frontend doesn't directly access Stack C (more secure)
5. ✅ Both stacks add caching layer in Redis for market data
6. ✅ Both stacks validate tier before fetching from Stack C
7. ✅ Simpler CORS configuration
8. ✅ Easier testing (4 scenarios vs 9)

### **Key Architecture Change:**
```
Frontend → Stack A/B → Stack C (MT5 Python API)
Not: Frontend → Stack C (direct) ❌
```

### **Implementation:**
- Frontend: Remove StackCClient, move methods to StackBClient
- Stack B: Implement proxy endpoints for market data
- Stack C: Only accepts requests from Stack B (internal)

**Much simpler and more secure!** 🎉

---

**Last Updated:** 2026-01-18
**Version:** 2.0 (Simplified based on inter-stack communication matrix)
**Complexity Reduction:** ~35%
