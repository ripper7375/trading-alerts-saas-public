# Stack B Integration Guide

**Project:** Trading Alerts SaaS V7
**Component:** API Client Stack B Integration
**Architecture:** Multi-Stack Microservices
**Last Updated:** 2026-01-20
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Integration Checklist](#pre-integration-checklist)
3. [Integration Scenarios](#integration-scenarios)
4. [Step-by-Step Integration](#step-by-step-integration)
5. [Configuration Changes](#configuration-changes)
6. [Testing Integration](#testing-integration)
7. [Rollback Strategy](#rollback-strategy)
8. [Monitoring & Observability](#monitoring--observability)
9. [Common Issues & Solutions](#common-issues--solutions)

---

## Overview

### What is Stack B?

**Stack B** contains Parts 20-26 of the microservices architecture:

| Part | Feature | Endpoints |
|------|---------|-----------|
| Part 20 | Data Infrastructure | PostgreSQL, Redis, Sync |
| Part 21 | Market Data API | `/api/market-data/*`, `/api/queue/*` |
| Part 22 | Confluence Scores | `/api/confluence/*` |
| Part 23 | Leaderboard | `/api/leaderboard/*` |
| Part 24 | Surveillance | `/api/surveillance/*` |
| Part 25 | WebSocket/SSE | Real-time connections |
| Part 26 | Advanced Notifications | `/api/notifications/advanced` |

### Current State

```
┌────────────────────────────────────────────────────────────┐
│                    Current Architecture                     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Frontend (UI Only)                                        │
│  └─ API Client                                             │
│      ├─ Stack A ✅ CONNECTED (Parts 1-19)                 │
│      └─ Stack B ⚠️ NOT CONNECTED (Parts 20-26)            │
│                                                            │
│  Backend                                                   │
│  ├─ Stack A Services ✅ DEPLOYED                          │
│  │   └─ Railway (PostgreSQL) + Vercel (Next.js API)      │
│  └─ Stack B Services ⚠️ NOT DEPLOYED                      │
│      └─ Railway (PostgreSQL + Redis) + Contabo (Python)   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### After Integration

```
┌────────────────────────────────────────────────────────────┐
│                    After Integration                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Frontend (UI Only)                                        │
│  └─ API Client                                             │
│      ├─ Stack A ✅ CONNECTED (Parts 1-19)                 │
│      └─ Stack B ✅ CONNECTED (Parts 20-26)                │
│                                                            │
│  Backend                                                   │
│  ├─ Stack A Services ✅ DEPLOYED                          │
│  │   └─ Railway (PostgreSQL) + Vercel (Next.js API)      │
│  └─ Stack B Services ✅ DEPLOYED                          │
│      └─ Railway (PostgreSQL + Redis) + Contabo (Python)   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Pre-Integration Checklist

### Backend Readiness

Before integrating Stack B into the API Client, ensure backend services are deployed:

#### ✅ Part 20: Data Infrastructure

- [ ] PostgreSQL (TimescaleDB) deployed on Railway
- [ ] Redis deployed on Railway
- [ ] Python sync service running on Contabo VPS
- [ ] MQL5 indicators pushing data to SQLite
- [ ] SQLite → PostgreSQL sync working
- [ ] Environment variables configured:
  - `POSTGRESQL_URI`
  - `REDIS_URL`
  - `ADMIN_API_KEY`

**Validation:**
```bash
# Test PostgreSQL connection
psql $POSTGRESQL_URI -c "SELECT version();"

# Test Redis connection
redis-cli -u $REDIS_URL ping

# Test sync service
curl http://your-contabo-ip:5000/health
```

#### ✅ Part 21: Market Data API

- [ ] `/api/market-data/:symbol` endpoint deployed
- [ ] `/api/market-data/:symbol/:timeframe` endpoint deployed
- [ ] `/api/queue/status` endpoint deployed
- [ ] `/api/queue/jobs` endpoint deployed
- [ ] BullMQ queue processing jobs
- [ ] Rate limiting configured

**Validation:**
```bash
# Test market data endpoint
curl https://your-domain.vercel.app/api/market-data/XAUUSD

# Test queue status
curl https://your-domain.vercel.app/api/queue/status
```

#### ✅ Part 22: Confluence Scores

- [ ] `/api/confluence/:symbol` endpoint deployed
- [ ] `/api/confluence/:symbol/:timeframe/history` endpoint deployed
- [ ] Confluence calculation working
- [ ] Historical data available

**Validation:**
```bash
curl https://your-domain.vercel.app/api/confluence/XAUUSD
```

#### ✅ Part 23: Leaderboard

- [ ] `/api/leaderboard/:timeframe` endpoint deployed
- [ ] `/api/leaderboard/symbols` endpoint deployed
- [ ] `/api/leaderboard/timeframes` endpoint deployed
- [ ] Leaderboard calculation working
- [ ] Real-time updates configured

**Validation:**
```bash
curl https://your-domain.vercel.app/api/leaderboard/H4
```

#### ✅ Part 24: Surveillance

- [ ] `/api/surveillance` endpoint deployed
- [ ] `/api/surveillance/symbols` endpoint deployed
- [ ] `/api/surveillance/timeframes` endpoint deployed
- [ ] Multi-timeframe analysis working

**Validation:**
```bash
curl https://your-domain.vercel.app/api/surveillance
```

#### ✅ Part 25: WebSocket/SSE

- [ ] WebSocket server deployed
- [ ] SSE endpoint `/api/notifications/stream` available
- [ ] Connection pooling configured
- [ ] Heartbeat mechanism working

**Validation:**
```bash
# Test WebSocket connection
wscat -c wss://your-domain.vercel.app/ws

# Test SSE endpoint
curl https://your-domain.vercel.app/api/notifications/stream
```

#### ✅ Part 26: Advanced Notifications

- [ ] `/api/notifications/advanced` endpoint deployed
- [ ] Filtering and pagination working
- [ ] Push notification service configured

**Validation:**
```bash
curl https://your-domain.vercel.app/api/notifications/advanced?type=alert
```

---

## Integration Scenarios

### Scenario 1: Full Stack B Deployment (All Parts 20-26)

**When:** All Stack B services are fully deployed and tested.

**Steps:**
1. Update API Client to enable Stack B methods
2. Update frontend components to use Stack B features
3. Run integration tests
4. Deploy to production

**Timeline:** 1-2 weeks

---

### Scenario 2: Incremental Integration (Part by Part)

**When:** You want to deploy Stack B gradually.

**Steps:**
1. Deploy Part 20 (Infrastructure) first
2. Deploy Part 21 (Market Data API)
3. Update API Client to enable Part 21 methods
4. Test Part 21 in production
5. Deploy Part 22 (Confluence Scores)
6. Update API Client to enable Part 22 methods
7. Continue for Parts 23-26

**Timeline:** 3-4 weeks

---

### Scenario 3: Soft Launch (Beta Users Only)

**When:** You want to test Stack B with selected users first.

**Steps:**
1. Deploy all Stack B services
2. Add feature flag in API Client
3. Enable Stack B only for beta users
4. Collect feedback
5. Roll out to all users

**Timeline:** 2-3 weeks

---

## Step-by-Step Integration

### Phase 1: Preparation

#### Step 1.1: Verify Backend Deployment

```bash
# Check all Stack B endpoints are responding
./scripts/check-stack-b-health.sh
```

Create `scripts/check-stack-b-health.sh`:
```bash
#!/bin/bash

DOMAIN="https://your-domain.vercel.app"

echo "🔍 Checking Stack B Health..."

# Part 21: Market Data
echo "📊 Part 21: Market Data API"
curl -f "$DOMAIN/api/market-data/XAUUSD" || echo "❌ Failed"

# Part 22: Confluence
echo "📊 Part 22: Confluence Scores"
curl -f "$DOMAIN/api/confluence/XAUUSD" || echo "❌ Failed"

# Part 23: Leaderboard
echo "📊 Part 23: Leaderboard"
curl -f "$DOMAIN/api/leaderboard/H4" || echo "❌ Failed"

# Part 24: Surveillance
echo "📊 Part 24: Surveillance"
curl -f "$DOMAIN/api/surveillance" || echo "❌ Failed"

# Part 26: Advanced Notifications
echo "📊 Part 26: Advanced Notifications"
curl -f "$DOMAIN/api/notifications/advanced" || echo "❌ Failed"

echo "✅ Health check complete!"
```

#### Step 1.2: Review Current API Client

```bash
# View current Stack B implementation
cat lib/api/index.ts | grep -A 50 "Stack B Client"
```

Expected output shows Stack B methods returning 404 or throwing errors.

---

### Phase 2: Configuration

#### Step 2.1: Update Environment Variables

Add Stack B specific variables to `.env.local`:

```bash
# Stack B Infrastructure (Part 20)
POSTGRESQL_URI=postgresql://user:password@railway.app:5432/database
REDIS_URL=redis://default:password@railway.app:6379

# Stack B API URL (if different from Stack A)
NEXT_PUBLIC_STACK_B_API_URL=https://your-stack-b-domain.com

# WebSocket URL (Part 25)
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws

# Feature Flags
ENABLE_STACK_B=true
ENABLE_LEADERBOARD=true
ENABLE_SURVEILLANCE=true
ENABLE_WEBSOCKETS=true
```

#### Step 2.2: Update API Client Base URL

**Option A: Same Domain (Recommended)**

If Stack B is deployed on same Next.js instance:

```typescript
// lib/api/index.ts
const BASE_URL =
  typeof window !== 'undefined' ? '' : process.env['NEXT_PUBLIC_API_URL'] || '';

// No changes needed - Stack B uses same base URL
```

**Option B: Different Domain**

If Stack B is on separate domain:

```typescript
// lib/api/index.ts
const STACK_A_BASE_URL =
  typeof window !== 'undefined' ? '' : process.env['NEXT_PUBLIC_API_URL'] || '';

const STACK_B_BASE_URL =
  typeof window !== 'undefined'
    ? ''
    : process.env['NEXT_PUBLIC_STACK_B_API_URL'] || STACK_A_BASE_URL;

// Update apiCall to accept base URL
async function apiCall(
  endpoint: string,
  options: RequestInit = {},
  baseUrl: string = STACK_A_BASE_URL
) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// Update Stack B methods to use Stack B base URL
const stackB = {
  getMarketData: (symbol: string) =>
    apiCall(`/api/market-data/${symbol}`, { method: 'GET' }, STACK_B_BASE_URL),
  // ... rest of methods
};
```

---

### Phase 3: Enable Stack B Methods

#### Step 3.1: Remove Placeholder Implementations

**Before (Placeholder):**
```typescript
const stackB = {
  // WebSocket methods (placeholders - not testable without server)
  subscribeToNotifications: () => {
    throw new Error('WebSocket not implemented - Stack B not deployed');
  },
  subscribeToMarketData: () => {
    throw new Error('WebSocket not implemented - Stack B not deployed');
  },
  subscribeToLeaderBoard: () => {
    throw new Error('WebSocket not implemented - Stack B not deployed');
  },

  // SSE methods (placeholders - not testable without server)
  createNotificationsStream: () => {
    throw new Error('SSE not implemented - Stack B not deployed');
  },
};
```

**After (Real Implementation):**
```typescript
const stackB = {
  // WebSocket methods - ENABLED
  subscribeToNotifications: (
    callback: (notification: Notification) => void,
    options: { reconnect?: boolean } = {}
  ) => {
    const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] || 'ws://localhost:3000';
    const ws = new WebSocket(`${WS_URL}/notifications`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (options.reconnect) {
        setTimeout(() => stackB.subscribeToNotifications(callback, options), 5000);
      }
    };

    return () => ws.close();
  },

  subscribeToMarketData: (
    symbol: string,
    callback: (data: MarketData) => void
  ) => {
    const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] || 'ws://localhost:3000';
    const ws = new WebSocket(`${WS_URL}/market-data/${symbol}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    return () => ws.close();
  },

  subscribeToLeaderBoard: (
    timeframe: string,
    callback: (data: Leaderboard) => void,
    options: { reconnect?: boolean } = {}
  ) => {
    const WS_URL = process.env['NEXT_PUBLIC_WS_URL'] || 'ws://localhost:3000';
    const ws = new WebSocket(`${WS_URL}/leaderboard/${timeframe}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (options.reconnect) {
        setTimeout(() => stackB.subscribeToLeaderBoard(timeframe, callback, options), 5000);
      }
    };

    return () => ws.close();
  },

  // SSE methods - ENABLED
  createNotificationsStream: () => {
    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
    };

    return eventSource;
  },
};
```

#### Step 3.2: Add Type Definitions for WebSocket/SSE

```typescript
// lib/api/index.ts (add at top)

interface Notification {
  id: string;
  type: 'alert' | 'system' | 'trade';
  message: string;
  timestamp: string;
  read: boolean;
}

interface MarketData {
  symbol: string;
  timeframe: string;
  price: number;
  timestamp: string;
  indicators: Record<string, number>;
}

interface Leaderboard {
  timeframe: string;
  symbols: Array<{
    symbol: string;
    score: number;
    rank: number;
    change24h: number;
  }>;
  updatedAt: string;
}
```

---

### Phase 4: Update Frontend Components

#### Step 4.1: Uncomment Stack B Usage in Hooks

**File:** `frontend/hooks/use-api-client-example.ts`

**Before:**
```typescript
export function useRealTimeNotifications() {
  const [notifications, _setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // ⚠️ Uncomment when Stack B is deployed
    /*
    const unsubscribe = api.stackB.subscribeToNotifications(
      (notification) => {
        _setNotifications((prev) => [notification, ...prev.slice(0, 49)]);
      },
      { reconnect: true }
    );
    return () => unsubscribe();
    */
  }, []);

  return { notifications };
}
```

**After:**
```typescript
export function useRealTimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // ✅ Stack B is deployed - ENABLED
    const unsubscribe = api.stackB.subscribeToNotifications(
      (notification) => {
        setNotifications((prev) => [notification, ...prev.slice(0, 49)]);
      },
      { reconnect: true }
    );
    return () => unsubscribe();
  }, []);

  return { notifications };
}
```

#### Step 4.2: Update Dashboard to Use Stack B Features

**File:** `app/dashboard/page.tsx`

```typescript
'use client';

import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [stackAData, setStackAData] = useState<any>(null);
  const [stackBData, setStackBData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load Stack A data (existing functionality)
        const [alerts, watchlist, user] = await Promise.all([
          api.stackA.getAlerts(),
          api.stackA.getWatchlist(),
          api.stackA.getUser(),
        ]);

        setStackAData({ alerts, watchlist, user });

        // Load Stack B data (new functionality)
        const [leaderboard, surveillance, marketData] = await Promise.all([
          api.stackB.getLeaderBoard('H4'),
          api.stackB.getSurveillance(),
          api.stackB.getMarketData('XAUUSD'),
        ]);

        setStackBData({ leaderboard, surveillance, marketData });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Stack A Features */}
      <section>
        <h2>My Alerts ({stackAData?.alerts?.length || 0})</h2>
        {/* Display alerts */}
      </section>

      <section>
        <h2>Watchlist ({stackAData?.watchlist?.length || 0})</h2>
        {/* Display watchlist */}
      </section>

      {/* Stack B Features - NEW */}
      <section>
        <h2>Leaderboard (H4)</h2>
        {/* Display leaderboard */}
      </section>

      <section>
        <h2>Market Surveillance</h2>
        {/* Display surveillance */}
      </section>

      <section>
        <h2>Live Market Data - XAUUSD</h2>
        {/* Display market data */}
      </section>
    </div>
  );
}
```

---

### Phase 5: Testing

#### Step 5.1: Run Unit Tests

```bash
# Test Stack B endpoints
npm test -- __tests__/lib/api/stack-b-client.test.ts

# Expected: All tests should PASS (not 404 anymore)
```

**Update test expectations:**

**Before:**
```typescript
it('should throw 404 for GET /leaderboard/[timeframe] - getLeaderBoard() ⚠️', async () => {
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    json: async () => ({ error: 'Stack B not deployed' }),
  } as Response);

  const { api } = await import('@/lib/api');
  await expect(api.stackB.getLeaderBoard('H4')).rejects.toThrow();
});
```

**After:**
```typescript
it('should GET /leaderboard/[timeframe] - getLeaderBoard() ✅', async () => {
  const mockLeaderboard = {
    timeframe: 'H4',
    symbols: [
      { symbol: 'XAUUSD', score: 95, rank: 1 },
      { symbol: 'EURUSD', score: 87, rank: 2 },
    ],
  };

  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => mockLeaderboard,
  } as Response);

  const { api } = await import('@/lib/api');
  const leaderboard = await api.stackB.getLeaderBoard('H4');

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/leaderboard/H4',
    expect.objectContaining({ method: 'GET' })
  );
  expect(leaderboard).toEqual(mockLeaderboard);
});
```

#### Step 5.2: Run Integration Tests

```bash
npm test -- __tests__/integration/api-client-workflow.test.ts
```

#### Step 5.3: Test in Browser

1. Start dev server: `npm run dev`
2. Open `http://localhost:3000/test-api`
3. Click Stack B endpoint buttons
4. Verify they return 200 OK (not 404)

---

### Phase 6: Deployment

#### Step 6.1: Deploy to Staging

```bash
# Push to staging branch
git checkout staging
git merge main
git push origin staging

# Vercel will auto-deploy to staging environment
```

#### Step 6.2: Smoke Test on Staging

```bash
# Test Stack B endpoints on staging
curl https://staging.your-domain.vercel.app/api/leaderboard/H4
curl https://staging.your-domain.vercel.app/api/market-data/XAUUSD
curl https://staging.your-domain.vercel.app/api/surveillance
```

#### Step 6.3: Deploy to Production

```bash
# Merge to main and deploy
git checkout main
git merge staging
git push origin main

# Vercel will auto-deploy to production
```

---

## Configuration Changes

### Environment Variables to Add

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `POSTGRESQL_URI` | Yes | TimescaleDB connection | `postgresql://user:pass@railway.app:5432/db` |
| `REDIS_URL` | Yes | Redis connection | `redis://default:pass@railway.app:6379` |
| `NEXT_PUBLIC_STACK_B_API_URL` | No | Stack B API URL (if different) | `https://stack-b.your-domain.com` |
| `NEXT_PUBLIC_WS_URL` | Yes | WebSocket URL | `wss://your-domain.com/ws` |
| `ENABLE_STACK_B` | No | Feature flag | `true` |
| `ADMIN_API_KEY` | Yes | Admin endpoints auth | `your_secret_key` |

---

## Monitoring & Observability

### Metrics to Track

1. **API Response Times**
   - Stack B average response time
   - P50, P95, P99 latencies
   - Compare to Stack A baseline

2. **Error Rates**
   - 4xx errors (client errors)
   - 5xx errors (server errors)
   - WebSocket connection failures

3. **Usage Statistics**
   - Requests per endpoint
   - Most popular Stack B features
   - User adoption rate

### Logging

Add logging to API Client:

```typescript
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const startTime = Date.now();

  console.log(`[API] ${options.method || 'GET'} ${endpoint} - Started`);

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const duration = Date.now() - startTime;
    console.log(`[API] ${options.method || 'GET'} ${endpoint} - ${response.status} in ${duration}ms`);

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `API Error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[API] ${options.method || 'GET'} ${endpoint} - Error in ${duration}ms:`, error);
    throw error;
  }
}
```

---

## Rollback Strategy

### If Stack B Integration Fails

**Option 1: Revert API Client**

```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

**Option 2: Feature Flag Disable**

```typescript
// lib/api/index.ts
const STACK_B_ENABLED = process.env['ENABLE_STACK_B'] === 'true';

const stackB = STACK_B_ENABLED
  ? {
      // Real Stack B implementation
    }
  : {
      // Placeholder implementation (throws errors)
      getLeaderBoard: () => {
        throw new Error('Stack B disabled');
      },
    };
```

Then set `ENABLE_STACK_B=false` in Vercel environment variables.

**Option 3: Gradual Rollout**

```typescript
// Disable Stack B for percentage of users
const STACK_B_ROLLOUT_PERCENTAGE = 10; // 10% of users

const isStackBEnabled = () => {
  const userId = getUserId();
  const hash = hashCode(userId);
  return (hash % 100) < STACK_B_ROLLOUT_PERCENTAGE;
};

export const api = {
  stackA,
  get stackB() {
    if (!isStackBEnabled()) {
      throw new Error('Stack B not available for your account');
    }
    return stackBImpl;
  },
};
```

---

## Common Issues & Solutions

### Issue 1: CORS Errors

**Symptom:**
```
Access to fetch at 'https://stack-b.your-domain.com/api/leaderboard/H4' from origin 'https://your-domain.com' has been blocked by CORS policy
```

**Solution:**

Add CORS headers to Stack B API routes:

```typescript
// app/api/leaderboard/[timeframe]/route.ts
export async function GET(req: NextRequest) {
  const response = NextResponse.json(data);

  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return response;
}
```

---

### Issue 2: WebSocket Connection Failures

**Symptom:**
```
WebSocket connection to 'wss://your-domain.com/ws' failed
```

**Solution:**

1. Verify WebSocket server is running
2. Check firewall rules allow WebSocket connections
3. Add reconnection logic:

```typescript
subscribeToNotifications: (callback, options = { reconnect: true, maxRetries: 5 }) => {
  let retries = 0;

  function connect() {
    const ws = new WebSocket(`${WS_URL}/notifications`);

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (options.reconnect && retries < options.maxRetries) {
        retries++;
        setTimeout(connect, Math.pow(2, retries) * 1000); // Exponential backoff
      }
    };

    ws.onmessage = (event) => {
      retries = 0; // Reset on successful message
      callback(JSON.parse(event.data));
    };

    return () => ws.close();
  }

  return connect();
},
```

---

### Issue 3: 401 Unauthorized on Stack B Endpoints

**Symptom:**
```
API Error: 401 - Unauthorized
```

**Solution:**

Ensure authentication headers are passed:

```typescript
async function apiCall(endpoint: string, options: RequestInit = {}) {
  // Get session token
  const session = await getSession();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(session?.accessToken && { Authorization: `Bearer ${session.accessToken}` }),
      ...options.headers,
    },
    ...options,
  });

  // ... rest
}
```

---

## Summary

### Integration Checklist

- [ ] Backend Stack B services deployed and tested
- [ ] Environment variables configured
- [ ] API Client updated with real Stack B implementations
- [ ] WebSocket/SSE methods implemented
- [ ] Frontend components updated to use Stack B
- [ ] Unit tests updated and passing
- [ ] Integration tests passing
- [ ] Deployed to staging and tested
- [ ] Deployed to production
- [ ] Monitoring and logging in place
- [ ] Rollback strategy documented

### Key Takeaways

1. **Test Backend First** - Never integrate until backend is deployed and validated
2. **Incremental Integration** - Deploy part by part if possible
3. **Feature Flags** - Use flags for easy rollback
4. **Monitor Closely** - Watch metrics after integration
5. **Have Rollback Plan** - Be ready to revert if issues arise

---

**Next Steps:**
1. Review `03-api-client-updates.md` to learn how to handle API changes
2. Set up monitoring and alerting for Stack B
3. Train team on new Stack B features

---

**Last Updated:** 2026-01-20
**Maintained By:** Development Team
**Review Cycle:** After each major integration
