# Multi-Backend Sync Strategy for Frontend

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                                │
│         Part 5: Authentication + Part 27: Frontend UI Only          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Multi-Backend API Client Strategy:                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────┐          │
│  │ API Client Router                                     │          │
│  │ ├─ Stack A Client (NEXT_PUBLIC_API_A_URL)           │          │
│  │ └─ Stack B Client (NEXT_PUBLIC_API_B_URL)           │          │
│  │                                                       │          │
│  │ ❌ NO Stack C Client - Frontend CANNOT access C     │          │
│  └──────────────────────────────────────────────────────┘          │
│                                                                     │
└──────┬────────────────┬──────────────────────────────────────────────┘
       │                │
       │                │         ┌──────────────────────────┐
       │                │         │ Backend C (Contabo VPS)  │
       │                │         │ MT5 Terminals + SQLite   │
       │                │         │ Part 26: Market Data     │
       ▼                ▼         │ Admin Access (SSH/RDP)   │
┌──────────────┐ ┌──────────────┐└─────┬────────────────────┘
│ Backend A    │ │ Backend B    │      │
│ (Railway)    │ │ (Railway)    │      │ ❌ NO direct access
│              │◄├──────────────┤      │    from Stack A/B
├──────────────┤ ├──────────────┤      │
│ Parts:       │ │ Parts:       │      │ One-way push only
│ 2,3,4,6,7,8, │ │ 20,21,22,23, │      ▼
│ 9,10,11,12,  │ │ 24,26        │ ┌────────────────┐
│ 13,14,15,16, │ │              │ │ Redis Queue    │
│ 17A,17B,18,  │ │ Job Queue    │◄┤ (Upstash)      │
│ 19           │ │ Consumers ───┘ │ Bull/BullMQ    │
│              │ │ Analytics    │  └────────────────┘
│ Database A   │ │ Surveillance │
│ (Prisma+     │ │ Notifications│  ┌────────────────┐
│  PostgreSQL) │ │              │  │ Redis Cache    │
│              │ │ Database B   │◄─┤ (Upstash)      │
│              │ │ TimescaleDB  │  │ Leaderboard,   │
└──────────────┘ └──────────────┘  │ Sessions, etc. │
                                    └────────────────┘
```

## Communication Patterns Summary

### ✅ Allowed Communication Patterns:

```
1. Frontend (Next.js, Vercel) → Stack A (Nest.js, Railway)
   ├─ GET /api/alerts
   ├─ POST /api/watchlist
   ├─ PATCH /api/user/settings
   └─ All CRUD operations for Parts 2-19

2. Frontend (Next.js, Vercel) → Stack B (Nest.js, Railway)
   ├─ GET /notifications (real-time via Redis)
   ├─ GET /leaderboard/:timeframe (cached in Redis)
   ├─ GET /surveillance/symbols
   └─ Analytics and message queue operations (Parts 20-26)

3. Frontend → Stack A (MT5 Flask Service) + Stack B simultaneously
   ├─ Promise.all([
   │    api.stackA.getAlerts(),           // Nest.js API
   │    api.stackA.getFlaskMT5Data(),     // Flask MT5 Service
   │    api.stackB.getLeaderBoard(),      // Analytics
   │    api.stackB.getNotifications()     // Redis-based notifications
   │  ])
   └─ ⚡ Parallel requests: ~500ms vs ~1500ms sequential

4. Stack A (Nest.js) → Stack B (Nest.js)
   ├─ Trigger analytics jobs in message queue
   ├─ Fetch surveillance data
   └─ Cross-stack operations

5. Stack A (Nest.js) → PostgreSQL (Prisma, Timescale Cloud)
   ├─ Database A: User data, alerts, watchlist, subscriptions
   └─ Main application database

6. Stack B (Nest.js) → PostgreSQL (Prisma, Timescale Cloud)
   ├─ Database B: Analytics, surveillance, message queue
   └─ Worker database for async operations

7. Stack B (Nest.js) → TimescaleDB (Timescale Cloud) + Redis (Upstash)
   ├─ Read from HyperTables (time-series data)
   │  └─ 15 tables (1 per symbol), 90k rows max (10k × 9 timeframes)
   ├─ Redis Queue: "market-data-sync" (Bull/BullMQ)
   │  └─ Workers batch 50 bars before SQL INSERT
   ├─ Backfill Worker (Python) handles SQLite recovery (0.1% fallback)
   ├─ Python Pandas Dataframe for deep calculation (Confluence Scores)
   └─ Additional Redis use cases:
      ├─ Leaderboard (sorted sets - ZSET)
      ├─ Notification Real-time (pub/sub)
      ├─ Login Session (session store)
      └─ Rate Limiting (counters with TTL)

8. Stack C (Contabo VPS) → Redis Queue (Upstash) - One-way HTTP POST
   ├─ 5 MT5 Terminals - V2.24 EA (3 symbol/terminal = 15 total)
   ├─ Success rate: 99.9% direct to Redis, 0.1% fallback to SQLite
   ├─ SQLite backup only (~10 MB, mostly empty)
   └─ Backfill Worker (Python) recovers from SQLite when needed
```

### ❌ FORBIDDEN Communication Patterns:

**CRITICAL SECURITY POLICY:**

```
1. ❌ Frontend (Next.js, Vercel) → Stack C (MT5 Terminals EA, Contabo) ❌
   └─ Frontend CANNOT access Contabo VPS directly
   └─ Security: Market data infrastructure completely isolated
   └─ Access: Admin SSH/RDP only

2. ❌ Stack A (Nest.js, Railway) → Stack C (MT5 Terminals EA, Contabo) ❌
   └─ Stack A does NOT directly query Stack C
   └─ Data already in PostgreSQL (arrived via Redis Queue → Workers)
   └─ Security isolation enforced - no incoming connections to Stack C

3. ❌ Stack B (Nest.js, Railway) → Stack C (MT5 Terminals EA, Contabo) ❌
   └─ Stack B does NOT directly query Stack C
   └─ Stack B Workers CONSUME from Redis Queue (Stack C pushes to Redis)
   └─ One-way flow: Stack C (HTTP POST) → Redis → Stack B (consume)
   └─ Security isolation enforced - no incoming connections to Stack C

4. ❌ Stack C → Frontend (direct push) ❌
   └─ Stack C does not push data directly to frontend
   └─ Data flows through Redis → Workers → Database → Frontend

5. ❌ Any direct HTTP/API calls to Stack C ❌
   └─ Stack C only accessible via Redis Job Queue
   └─ Complete network isolation from Railway stacks
```

### 🔄 Data Collection Flow (Stack C → Frontend):

**The ONLY way data flows from Stack C to the application:**

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTABO VPS (Stack C)                                           │
│                                                                 │
│ 5 MT5 Terminals - V2.24 EA (3 symbol/terminal)                 │
│                                                                 │
│ Collection Logic (per bar):                                    │
│ 1. Try Redis Publish (fast) ───┐                              │
│    ├─ Success (99.9%) ✅ Done  │                              │
│    └─ Failed (0.1%) ❌          │                              │
│         └─ SQLite backup        │                              │
│         └─ Mark for backfill    │                              │
│                                 │                              │
│ SQLite Database (15 files):    │                              │
│ ├─ Mostly empty (only failures)│                              │
│ ├─ Size: ~10 MB (vs 90 MB)    │                              │
│ └─ Backfill Worker PY handles  │                              │
│                                 │                              │
└─────────────────────────────────┼──────────────────────────────┘
                                  │ (1) HTTP POST
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ UPSTASH REDIS (Message Broker)                                  │
│                                                                 │
│ Bull Queue: "market-data-sync"                                 │
│ ├─ Receives 99.9% of data real-time                            │
│ ├─ Queue contains: symbol, timeframe, OHLCV data, timestamps   │
│ ├─ (92% fast path) → (8.1% recovery)                          │
│ └─ Decouples MT5 from Railway backend                          │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ (3) Bull Queue Consumer
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ RAILWAY WORKERS (Backend = Nest.js)                            │
│                                                                 │
│ Primary: Process Redis queue (main flow)                       │
│ Secondary: Backfill from SQLite (recovery - Backfill Worker PY)│
│                                                                 │
│ Processing Steps:                                              │
│ ├─ Validate (data integrity checks)                            │
│ ├─ Batch (50 bars) - optimize bulk inserts                     │
│ └─ Insert (batched SQL operations)                             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ (5) SQL INSERT
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ RAILWAY POSTGRESQL (Backend = Nest.js)                         │
│ PostgreSQL (Railway / Timescale Cloud)                         │
│                                                                 │
│ Database Structure:                                            │
│ ├─ 15 tables (1 per symbol)                                    │
│ ├─ 90,000 rows max (10k × 9 timeframes)                        │
│ ├─ HyperTables (TimescaleDB) for time-series optimization      │
│ └─ Complete dataset (fast path + recovered)                    │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ├──────────────────────┐
                                  ▼                      ▼
┌────────────────────────────────────────┐  ┌──────────────────────┐
│ Python Pandas Dataframe                │  │ TradingView Charts   │
│ (Deep Calculation)                     │  │ Lightweight Library  │
│                                        │  │ (Next.js Frontend)   │
│ Pre-Computation of:                    │  └──────────────────────┘
│ └─ Confluence Scores                   │
└────────────┬───────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Watchlist + Alert Notification System                          │
│ Backend = Nest.js                                               │
│ UI = Next.js                                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Key Implementation Details:**

1. **MT5 EA Collection (Contabo VPS)**
   - 5 MT5 Terminals running V2.24 EA
   - 3 symbols per terminal = 15 symbols total
   - Per-bar collection logic with Redis-first approach

2. **Dual-Path Strategy (99.9% vs 0.1%)**
   - **Fast Path (99.9%)**: MT5 → HTTP POST → Redis → Workers → PostgreSQL
   - **Backup Path (0.1%)**: MT5 → SQLite → Backfill Worker (Python) → PostgreSQL
   - SQLite is mostly empty (~10 MB vs 90 MB in dual-write)

3. **Redis Message Broker (Upstash)**
   - Bull Queue: "market-data-sync"
   - 92% fast path + 8.1% recovery = 100% data completeness
   - Decouples MT5 terminals from backend infrastructure

4. **Railway Workers (NestJS)**
   - Consumes from Bull Queue
   - Validates data integrity
   - **Batches 50 bars** before SQL INSERT (performance optimization)
   - Primary flow: Redis queue
   - Secondary flow: Backfill Worker (Python) for SQLite recovery

5. **PostgreSQL Database (Railway/Timescale)**
   - 15 tables (1 per symbol)
   - 90,000 rows maximum (10k bars × 9 timeframes)
   - TimescaleDB HyperTables for time-series optimization
   - Stores complete dataset from both paths

6. **Data Processing & Analytics**
   - **Python Pandas Dataframe**: Deep calculation engine
   - Pre-computes Confluence Scores
   - Feeds into Watchlist + Alert Notification System

7. **Frontend (Next.js on Vercel)**
   - TradingView Lightweight Charts Library
   - Displays charts and confluence scores
   - Queries PostgreSQL via Stack A/B APIs
   - Never communicates with Stack C directly

**Key Security Principle:**

- Stack C is a **one-way data producer** only
- Stack C → HTTP POST → Redis Queue (push only, 99.9% success rate)
- Backup path: Stack C → SQLite → Backfill Worker (0.1% fallback)
- No incoming connections to Stack C from Stack A, B, or Frontend
- Admin access to Stack C only via SSH/RDP for maintenance

**Additional Redis Use Cases (not shown in data flow diagram):**

- **Leaderboard**: Redis ZSET (sorted sets with scores)
- **Notification Real-time**: Redis Pub/Sub
- **Login Session**: Redis session store
- **Rate Limiting**: Redis counters with TTL

## Strategy: Contract-First Development

### Step 1: Define API Contracts for Backend Stack B

Create OpenAPI specifications BEFORE building Backend Stack B:

```yaml
# backend-stack-b/openapi/watchlist-api.yaml
openapi: 3.0.0
info:
  title: Backend Stack B - Watchlist & Alerts API
  version: 1.0.0
  description: Async processing for watchlist and alerts

paths:
  /watchlist:
    get:
      summary: Get user watchlist
      responses:
        '200':
          description: Watchlist items
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/WatchlistItem'
    post:
      summary: Add to watchlist
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateWatchlistRequest'

  /alerts:
    get:
      summary: Get user alerts
      responses:
        '200':
          description: User alerts
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Alert'

components:
  schemas:
    WatchlistItem:
      type: object
      required: [id, userId, symbol, timeframe]
      properties:
        id:
          type: string
        userId:
          type: string
        symbol:
          type: string
        timeframe:
          type: string
        createdAt:
          type: string
          format: date-time
```

### Step 2: Generate TypeScript Types from Contracts

```bash
# Install OpenAPI generator
npm install -g openapi-typescript

# Generate types for Stack B
openapi-typescript backend-stack-b/openapi/watchlist-api.yaml \
  --output frontend/types/api-stack-b.ts

# Generate types for Stack A
openapi-typescript backend-stack-a/openapi/main-api.yaml \
  --output frontend/types/api-stack-a.ts
```

### Step 3: Multi-Backend API Client Architecture

```typescript
// frontend/lib/api-clients/base-client.ts
export class BaseApiClient {
  protected baseURL: string;
  protected defaultHeaders: HeadersInit;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  protected async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new ApiError(response.status, await response.text());
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
```

```typescript
// frontend/lib/api-clients/stack-a-client.ts
import { BaseApiClient } from './base-client';
import type { paths as StackAPaths } from '@/types/api-stack-a';

export class StackAClient extends BaseApiClient {
  constructor() {
    super(process.env['NEXT_PUBLIC_API_A_URL'] || '/api');
  }

  // Stack A: Main CRUD operations
  async getUser(userId: string) {
    return this.get<StackAPaths['/users/{id}']['get']['responses']['200']>(
      `/users/${userId}`
    );
  }

  async getSubscription() {
    return this.get(`/subscription`);
  }

  async getDashboard() {
    return this.get(`/dashboard`);
  }
}

export const stackAClient = new StackAClient();
```

```typescript
// frontend/lib/api-clients/stack-b-client.ts
import { BaseApiClient } from './base-client';
import type { paths as StackBPaths } from '@/types/api-stack-b';

export class StackBClient extends BaseApiClient {
  constructor() {
    // Stack B might not be deployed yet - provide fallback
    const baseURL =
      process.env['NEXT_PUBLIC_API_B_URL'] ||
      process.env['NEXT_PUBLIC_API_A_URL'] || // Fallback to Stack A during development
      '/api';
    super(baseURL);
  }

  // Stack B: Message Queue & Analytics operations

  // Notifications (Part 26)
  async getNotifications() {
    return this.get(`/notifications`);
  }

  // Market Data Broker (Part 21)
  async getMarketData(symbol: string) {
    return this.get(`/market-data/${symbol}`);
  }

  // Analytics endpoints (Part 22)
  async getConfluenceScores(symbol: string) {
    return this.get(`/confluence/${symbol}`);
  }

  // Leader board (Part 23)
  async getLeaderBoard(timeframe: string) {
    return this.get(`/leaderboard/${timeframe}`);
  }

  // Surveillance (Part 24)
  async getSymbolsSurveillance() {
    return this.get(`/surveillance/symbols`);
  }

  async getTimeframesSurveillance() {
    return this.get(`/surveillance/timeframes`);
  }
}

export const stackBClient = new StackBClient();
```

```typescript
// frontend/lib/api-clients/index.ts
export { stackAClient } from './stack-a-client';
export { stackBClient } from './stack-b-client';

// ❌ NO stackCClient - Frontend cannot directly access Stack C
// Stack C (Contabo VPS) is only accessible by Stack A & B for market data collection
// Admin access only via SSH/RDP

// Unified export for convenience
export const api = {
  stackA: stackAClient,
  stackB: stackBClient,
};
```

### Step 4: Usage in Components

```typescript
// frontend/app/leaderboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-clients';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        // This calls Stack B (Analytics - Part 23)
        const data = await api.stackB.getLeaderBoard('H4');
        setLeaderboard(data);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  return (
    <div>
      <h1>Symbols/Timeframes Leader Board</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {leaderboard.leaders?.map((item) => (
            <li key={item.symbol}>{item.symbol} - Score: {item.score}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

#### Example: Simultaneous Requests to Stack A and Stack B

```typescript
// frontend/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-clients';

export default function DashboardPage() {
  const [alerts, setAlerts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // ✅ Make parallel requests to Stack A and Stack B simultaneously
        // This reduces total load time significantly!
        const [alertsData, leaderboardData, notificationsData] = await Promise.all([
          api.stackA.getAlerts(),        // Stack A - Part 11
          api.stackB.getLeaderBoard('H4'), // Stack B - Part 23
          api.stackB.getNotifications(),   // Stack B - Part 26
        ]);

        setAlerts(alertsData);
        setLeaderboard(leaderboardData);
        setNotifications(notificationsData);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div className="dashboard">
      <h1>Trading Dashboard</h1>

      {/* Data from Stack A */}
      <section className="alerts-section">
        <h2>Active Alerts (Stack A)</h2>
        <ul>
          {alerts.map((alert) => (
            <li key={alert.id}>{alert.symbol} - {alert.condition}</li>
          ))}
        </ul>
      </section>

      {/* Data from Stack B */}
      <section className="leaderboard-section">
        <h2>Top Symbols (Stack B)</h2>
        <ul>
          {leaderboard.leaders?.map((item) => (
            <li key={item.symbol}>{item.symbol} - Score: {item.score}</li>
          ))}
        </ul>
      </section>

      {/* Data from Stack B */}
      <section className="notifications-section">
        <h2>Recent Notifications (Stack B)</h2>
        <ul>
          {notifications.map((notif) => (
            <li key={notif.id}>{notif.message}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

**Benefits of Simultaneous Requests:**

- ⚡ **Faster page loads**: 3 parallel requests complete in ~500ms vs 1500ms sequential
- 🎯 **Better UX**: Users see complete dashboard data faster
- 🔄 **Independent failures**: If Stack B is slow, Stack A data still loads
- 📊 **Real-time data**: Both stacks provide fresh data simultaneously

### Step 5: Mock Server for Stack B During Development

While Backend Stack B is being built, use Mock Service Worker (MSW):

```typescript
// frontend/mocks/stack-b-handlers.ts
import { http, HttpResponse } from 'msw';

const STACK_B_URL =
  process.env['NEXT_PUBLIC_API_B_URL'] || 'http://localhost:3002';

export const stackBHandlers = [
  // GET /notifications (Part 26)
  http.get(`${STACK_B_URL}/notifications`, () => {
    return HttpResponse.json([
      {
        id: '1',
        type: 'alert',
        message: 'XAUUSD price alert triggered',
        timestamp: new Date().toISOString(),
        read: false,
      },
      {
        id: '2',
        type: 'system',
        message: 'Market data sync completed',
        timestamp: new Date().toISOString(),
        read: true,
      },
    ]);
  }),

  // GET /market-data/:symbol (Part 21 - Message Broker)
  http.get(`${STACK_B_URL}/market-data/:symbol`, ({ params }) => {
    const { symbol } = params;
    return HttpResponse.json({
      symbol,
      price: Math.random() * 2000 + 1000,
      timestamp: new Date().toISOString(),
    });
  }),

  // GET /confluence/:symbol (Part 22 - Analytics)
  http.get(`${STACK_B_URL}/confluence/:symbol`, ({ params }) => {
    const { symbol } = params;
    return HttpResponse.json({
      symbol,
      score: Math.floor(Math.random() * 100),
      indicators: ['RSI', 'MACD', 'SMA'],
    });
  }),

  // GET /leaderboard/:timeframe (Part 23)
  http.get(`${STACK_B_URL}/leaderboard/:timeframe`, ({ params }) => {
    const { timeframe } = params;
    return HttpResponse.json({
      timeframe,
      leaders: [
        { symbol: 'XAUUSD', score: 95 },
        { symbol: 'BTCUSD', score: 88 },
        { symbol: 'EURUSD', score: 75 },
      ],
    });
  }),

  // GET /surveillance/symbols (Part 24)
  http.get(`${STACK_B_URL}/surveillance/symbols`, () => {
    return HttpResponse.json({
      symbols: ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD'],
      underSurveillance: ['XAUUSD', 'BTCUSD'],
    });
  }),

  // GET /surveillance/timeframes (Part 24)
  http.get(`${STACK_B_URL}/surveillance/timeframes`, () => {
    return HttpResponse.json({
      timeframes: ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'],
      underSurveillance: ['H1', 'H4'],
    });
  }),
];
```

```typescript
// frontend/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { stackBHandlers } from './stack-b-handlers';

export const worker = setupWorker(...stackBHandlers);
```

```typescript
// frontend/app/layout.tsx (add in development mode)
'use client';

import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    if (
      process.env['NODE_ENV'] === 'development' &&
      process.env['NEXT_PUBLIC_USE_MOCKS'] === 'true'
    ) {
      // Start MSW for Stack B mocking
      import('../mocks/browser').then(({ worker }) => {
        worker.start({
          onUnhandledRequest: 'bypass', // Only mock Stack B, bypass Stack A
        });
      });
    }
  }, []);

  return children;
}
```

### Step 6: Environment Variables for Multi-Backend

```bash
# frontend/.env.local (Development)

# Stack A - Main CRUD operations (Parts 2-19)
# Database A, Flask MT5 Service, OHLCV data API, Dashboard, Charts,
# Watchlist, Alerts, E-commerce, Settings, Admin, Notifications,
# Utilities, Affiliate Marketing, dLocal Payments, Riseworks Disbursements
NEXT_PUBLIC_API_A_URL=http://localhost:3001

# Stack B - Message Queue & Analytics (Parts 20-26)
# Database B, Market Data Broker, Confluence Scores, Leader Board,
# Surveillance, Advance Notifications
# Not deployed yet, so use mocks
NEXT_PUBLIC_API_B_URL=http://localhost:3002
NEXT_PUBLIC_USE_MOCKS=true

# ❌ NO Stack C URL - Frontend cannot access Stack C
# Stack C (Contabo VPS - Part 26) is only accessible by Stack A & B
# Admin access only via SSH/RDP for MT5 terminals + SQLite database

# Auth (shared across all stacks)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
```

```bash
# frontend/.env.production (Vercel - Production)

# Stack A - Deployed to Railway Container A (Parts 2-19)
NEXT_PUBLIC_API_A_URL=https://trading-alerts-stack-a.railway.app

# Stack B - Deployed to Railway Container B (Parts 20-26)
NEXT_PUBLIC_API_B_URL=https://trading-alerts-stack-b.railway.app
# If not ready, can temporarily point to Stack A during migration:
# NEXT_PUBLIC_API_B_URL=https://trading-alerts-stack-a.railway.app

# ❌ NO Stack C URL - Frontend forbidden to access Stack C
# Stack C is internal backend infrastructure only

NEXTAUTH_URL=https://trading-alerts-frontend.vercel.app
NEXTAUTH_SECRET=production-secret
```

## Development Workflow

### Phase 1: Frontend Development (NOW)

```
✅ Define OpenAPI contracts for Stack B (Parts 20-26)
✅ Generate TypeScript types from contracts
✅ Create stackBClient with typed methods
✅ Use MSW to mock Stack B responses
✅ Build frontend components using api.stackB.*
✅ Test frontend with mocked data
✅ ❌ NO Stack C client - Market data accessed via Stack A/B only
```

### Phase 2: Backend Stack B Development (Parallel)

```
🔨 Build Nest.js services following OpenAPI contracts
🔨 Implement Parts 20-26:
   - Part 20: Database B (Prisma, Cache)
   - Part 21: Market Data Collection (Message Broker + Worker Database)
   - Part 22: Confluence Scores Computation and Analysis
   - Part 23: Symbols/Timeframes Leader Board
   - Part 24: Symbols/Timeframes Under Surveillance
   - Part 26: Advance Notifications & Real-time
🔨 Setup Redis Job Queue consumers (Bull/BullMQ)
🔨 ❌ NO direct Stack B → Stack C integration (FORBIDDEN)
🔨 Stack B consumes jobs from Redis Queue pushed by Stack C
🔨 Test backend independently
🔨 Deploy to Railway Container B
```

### Phase 3: Integration

```
🔗 Update NEXT_PUBLIC_API_B_URL to Railway URL
🔗 Disable MSW mocks (set NEXT_PUBLIC_USE_MOCKS=false)
🔗 Test frontend → Backend Stack A integration
🔗 Test frontend → Backend Stack B integration
🔗 Verify Redis Job Queue flow: Stack C → Redis → Stack B Workers
🔗 ❌ Verify Stack A & B CANNOT directly access Stack C (security test)
🔗 Both teams can work in parallel!
```

## Benefits of This Approach

### ✅ Parallel Development

- Frontend team can build UI now
- Backend team can build APIs later
- No waiting for each other

### ✅ Contract-Driven

- OpenAPI spec is single source of truth
- TypeScript types auto-generated
- Breaking changes caught early

### ✅ Easy Testing

- Frontend can test with mocks
- Backend can test independently
- Integration testing straightforward

### ✅ Gradual Rollout

- Deploy Stack A first
- Deploy Stack B when ready
- Fallback to Stack A if Stack B fails

### ✅ Clear Separation

- Each stack has dedicated client
- Easy to route requests
- Simple to monitor which stack is slow

## Sync Functionality Matrix

| Frontend Feature        | Backend Stack | Client Used                               | Status                |
| ----------------------- | ------------- | ----------------------------------------- | --------------------- |
| User Profile            | Stack A       | `api.stackA.getUser()`                    | ✅ Ready              |
| Subscription            | Stack A       | `api.stackA.getSubscription()`            | ✅ Ready              |
| Dashboard (Part 8)      | Stack A       | `api.stackA.getDashboard()`               | ✅ Ready              |
| Charts (Part 9)         | Stack A       | `api.stackA.getCharts()`                  | ✅ Ready              |
| Watchlist (Part 10)     | Stack A       | `api.stackA.getWatchlist()`               | ✅ Ready              |
| Alerts (Part 11)        | Stack A       | `api.stackA.getAlerts()`                  | ✅ Ready              |
| E-commerce (Part 12)    | Stack A       | `api.stackA.getBilling()`                 | ✅ Ready              |
| **Market Data Broker**  | **Stack B**   | **`api.stackB.getMarketData()`**          | 🔨 Use mocks          |
| **Notifications (Adv)** | **Stack B**   | **`api.stackB.getNotifications()`**       | 🔨 Use mocks          |
| **Confluence Scores**   | **Stack B**   | **`api.stackB.getConfluenceScores()`**    | 🔨 Use mocks          |
| **Leader Board**        | **Stack B**   | **`api.stackB.getLeaderBoard()`**         | 🔨 Use mocks          |
| **Surveillance**        | **Stack B**   | **`api.stackB.getSymbolsSurveillance()`** | 🔨 Use mocks          |
| ❌ Market Data (Raw)    | Stack C       | ❌ **FORBIDDEN**                          | ⛔ No frontend access |

## Migration Path

### Current State (Monolith)

```
Frontend (Vercel) → Next.js API routes (All-in-one)
```

### Intermediate State (Stack A deployed, Stack B mocked)

```
Frontend (Vercel) → Stack A (Railway) [Real - Parts 2-19]
                  → Stack B (Mocked via MSW) [Parts 20-26]

Stack A ──────────┐
                  ├──→ Stack C (Contabo VPS) [Market Data Collection]
Stack B ──────────┘

❌ Frontend CANNOT access Stack C directly
```

### Final State (All stacks deployed)

```
Frontend (Vercel) → Stack A (Railway) [Real - Parts 2-19]
                  → Stack B (Railway) [Real - Parts 20-26]

Stack A ──────────┐
                  ├──→ Stack C (Contabo VPS) [MT5 + SQLite]
Stack B ──────────┘

✅ Frontend → Stack A ✅
✅ Frontend → Stack B ✅
❌ Frontend → Stack C ❌ (Forbidden)
✅ Stack A → Stack C ✅
✅ Stack B → Stack C ✅
```

## Testing Strategy

### Unit Tests (Frontend)

```typescript
// Test with mocked Stack B client
describe('LeaderboardPage', () => {
  it('loads leaderboard from Stack B', async () => {
    // Mock returns data
    const mockData = {
      timeframe: 'H4',
      leaders: [{ symbol: 'XAUUSD', score: 95 }],
    };
    jest.spyOn(api.stackB, 'getLeaderBoard').mockResolvedValue(mockData);

    render(<LeaderboardPage />);

    await waitFor(() => {
      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
      expect(screen.getByText('Score: 95')).toBeInTheDocument();
    });
  });
});

describe('WatchlistPage', () => {
  it('loads watchlist from Stack A', async () => {
    // Mock returns data from Stack A
    const mockData = [{ id: '1', symbol: 'XAUUSD', timeframe: 'H1' }];
    jest.spyOn(api.stackA, 'getWatchlist').mockResolvedValue(mockData);

    render(<WatchlistPage />);

    await waitFor(() => {
      expect(screen.getByText('XAUUSD - H1')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests (E2E)

```typescript
// Test.spec.ts (Playwright)
test('leaderboard integration', async ({ page }) => {
  // If Stack B deployed: use real URL
  // If Stack B not deployed: MSW will intercept

  await page.goto('/leaderboard');

  // Should load data from Stack B
  await expect(page.locator('text=XAUUSD')).toBeVisible();
  await expect(page.locator('text=Score:')).toBeVisible();
});

test('watchlist integration', async ({ page }) => {
  // Stack A should handle watchlist

  await page.goto('/watchlist');

  // Should load data from Stack A
  await expect(page.locator('text=XAUUSD')).toBeVisible();
});

test('cannot access Stack C directly', async ({ page }) => {
  // Verify frontend cannot call Stack C endpoints
  const response = await page.request.get(
    process.env.STACK_C_URL + '/market-data'
  );

  // Should be blocked/forbidden
  expect([403, 404, 0]).toContain(response.status());
});
```

## Recommended Timeline

### Week 1-2: Contracts & Frontend (No Backend Stack B needed)

- [ ] Define OpenAPI specs for Stack B (Parts 20-26)
- [ ] Generate TypeScript types
- [ ] Create stackBClient (NO stackCClient)
- [ ] Setup MSW mocks for Stack B
- [ ] Build frontend components
- [ ] Document that frontend cannot access Stack C

### Week 3-6: Backend Stack B Development (Parallel)

- [ ] Build Nest.js services for Stack B
- [ ] Build Database B (Part 20)
- [ ] Build Market Data Collection (Part 21 - Message Broker + Worker Database)
- [ ] Build Analytics (Parts 22, 23 - Confluence Scores + Leader Board)
- [ ] Build Surveillance (Part 24)
- [ ] Build Advance Notifications (Part 26)
- [ ] Setup Redis Job Queue consumers (Bull/BullMQ)
- [ ] Configure Stack B Workers to consume from Redis Queue
- [ ] ❌ NO direct Stack B → Stack C communication (FORBIDDEN)
- [ ] Test backend independently

### Week 7: Integration

- [ ] Deploy Stack B to Railway
- [ ] Update NEXT_PUBLIC_API_B_URL
- [ ] Disable mocks
- [ ] Integration testing
  - [ ] Frontend → Stack A ✅
  - [ ] Frontend → Stack B ✅
  - [ ] Frontend → Stack C ❌ (verify blocked)
  - [ ] Stack A → Stack C ❌ (verify FORBIDDEN - security test)
  - [ ] Stack B → Stack C ❌ (verify FORBIDDEN - security test)
  - [ ] Stack C → Redis Queue ✅ (verify data flow)
  - [ ] Stack B Workers → Redis Queue ✅ (verify consumption)
- [ ] Production deployment

---

## Summary of Communication Rules

Based on the latest microservice architecture:

### ✅ Frontend CAN communicate with:

- **Stack A (Railway)** - Parts 2-19 (Main CRUD, Dashboard, Watchlist, Alerts, etc.)
- **Stack B (Railway)** - Parts 20-26 (Message Queue, Analytics, Surveillance, Notifications)

### ❌ Frontend CANNOT communicate with:

- **Stack C (Contabo VPS)** - Part 26 Market Data Collection (MT5 + SQLite)
  - **Only admin access via SSH/RDP**
  - **Data flows through Redis Job Queue, NOT direct access**

### ✅ Backend Stacks CAN communicate with each other:

- **Stack A ↔ Stack B** ✅ (bidirectional communication)
  - Stack A can trigger jobs in Stack B's message queue
  - Stack A can fetch analytics/surveillance data from Stack B
  - Stack B can query user/subscription data from Stack A

### ❌ Backend Stacks CANNOT directly communicate with Stack C:

- **Stack A → Stack C** ❌ (FORBIDDEN - security isolation)
- **Stack B → Stack C** ❌ (FORBIDDEN - security isolation)
- **Data flows via Redis Job Queue only:**
  - Stack C → Redis Queue → Stack B Workers → Database → Stack A/B APIs → Frontend

### ✅ Frontend CAN communicate with multiple stacks simultaneously:

- **Frontend → Stack A and Stack B in parallel** ✅
  - Load dashboard data from Stack A while fetching analytics from Stack B
  - Reduces total page load time by making concurrent requests
  - Example: Dashboard shows user alerts (Stack A) + leader board (Stack B) at the same time

---

## Answer to Your Question

**Do you need complete Backend Stack B first?**

**NO!** You can:

1. ✅ Define API contracts now (Parts 20-26)
2. ✅ Build frontend with mocks now
3. ✅ Build Backend Stack B in parallel
4. ✅ Connect them later
5. ✅ **CRITICAL:** Do NOT create Stack C client for frontend

The key is **contract-first development** using OpenAPI specs.

---

## Architecture Changes Summary

### Updated Parts Distribution:

- **Frontend Stack (Vercel)**: Part 5 (Auth), Part 27 (UI Only)
- **Backend Stack A (Railway)**: Parts 2-19
  - Database A, Types, Tier System, Flask MT5, OHLCV API
  - Dashboard, Charts, Watchlist, Alerts
  - E-commerce, Settings, Admin Dashboard, Basic Notifications
  - Utilities, Affiliate Marketing, dLocal, Riseworks
- **Backend Stack B (Railway)**: Parts 20-26
  - Database B, Message Broker, Analytics
  - Confluence Scores, Leader Board, Surveillance
  - Advance Notifications & Real-time
- **Backend Stack C (Contabo VPS)**: Part 26 (Market Data Collection only)
  - MT5 terminals + SQLite database
  - **Admin access only (SSH/RDP)**
  - **No frontend access**

---

**Next Steps:**

1. Create OpenAPI specs for Backend Stack B (Parts 20-26)
   - Include Redis connection specs (Leaderboard, Notifications, Job Queue, Sessions, Rate Limiting)
2. Generate TypeScript types
3. Create multi-backend API clients (Stack A + Stack B ONLY)
4. **DO NOT create Stack C client** - Frontend cannot access it
5. Setup MSW mocks for Stack B
6. Build frontend components using api.stackA._ and api.stackB._
7. Backend team builds Stack B following contracts
8. Setup Redis Job Queue consumers in Stack B (Bull/BullMQ)
9. **❌ DO NOT configure direct Stack B → Stack C communication (FORBIDDEN)**
10. Configure Stack C to push jobs to Redis Queue (one-way data flow)

Both teams can work in parallel! 🚀

**Remember:**

- ✅ Frontend can talk to Stack A and Stack B
- ❌ Frontend can NEVER talk to Stack C
- ❌ Stack A/B can NEVER directly access Stack C
- ✅ Data flows: Stack C → Redis Queue → Stack B Workers → Database → Frontend
