# Multi-Backend Sync Strategy for Frontend

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                                │
│                    Part 5: Authentication                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Multi-Backend API Client Strategy:                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────┐          │
│  │ API Client Router                                     │          │
│  │ ├─ Stack A Client (NEXT_PUBLIC_API_A_URL)           │          │
│  │ ├─ Stack B Client (NEXT_PUBLIC_API_B_URL)           │          │
│  │ └─ Stack C Client (NEXT_PUBLIC_API_C_URL)           │          │
│  └──────────────────────────────────────────────────────┘          │
│                                                                     │
└──────┬────────────────┬────────────────┬──────────────────────────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Backend A    │ │ Backend B    │ │ Backend C    │
│ (Railway)    │ │ (Railway)    │ │ (Contabo)    │
├──────────────┤ ├──────────────┤ ├──────────────┤
│ Parts:       │ │ Parts:       │ │ Parts:       │
│ 2,3,4,6,7,8, │ │ 10,11,15,    │ │ 24           │
│ 9,12,13,14,  │ │ 20,21,22,23  │ │              │
│ 16,17A,17B,  │ │              │ │ Market Data  │
│ 18,19        │ │ Async/Worker │ │ Collection   │
│              │ │ Database B   │ │              │
│ Database A   │ │ Message Queue│ │ SQLite + MT5 │
│ (Main DB)    │ │ Analytics    │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

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
    const baseURL = process.env['NEXT_PUBLIC_API_B_URL'] ||
                    process.env['NEXT_PUBLIC_API_A_URL'] || // Fallback to Stack A during development
                    '/api';
    super(baseURL);
  }

  // Stack B: Async/Worker operations
  async getWatchlist() {
    return this.get<StackBPaths['/watchlist']['get']['responses']['200']>(
      `/watchlist`
    );
  }

  async addToWatchlist(data: any) {
    return this.post(`/watchlist`, data);
  }

  async getAlerts() {
    return this.get(`/alerts`);
  }

  async getNotifications() {
    return this.get(`/notifications`);
  }

  // Analytics endpoints (Part 22)
  async getConfluenceScores(symbol: string) {
    return this.get(`/confluence/${symbol}`);
  }

  // Leader board (Part 23)
  async getLeaderBoard(timeframe: string) {
    return this.get(`/leaderboard/${timeframe}`);
  }
}

export const stackBClient = new StackBClient();
```

```typescript
// frontend/lib/api-clients/index.ts
export { stackAClient } from './stack-a-client';
export { stackBClient } from './stack-b-client';
export { stackCClient } from './stack-c-client'; // For Part 24

// Unified export for convenience
export const api = {
  stackA: stackAClient,
  stackB: stackBClient,
  stackC: stackCClient,
};
```

### Step 4: Usage in Components

```typescript
// frontend/app/watchlist/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-clients';

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWatchlist() {
      try {
        // This calls Stack B
        const data = await api.stackB.getWatchlist();
        setWatchlist(data);
      } catch (error) {
        console.error('Failed to load watchlist:', error);
      } finally {
        setLoading(false);
      }
    }

    loadWatchlist();
  }, []);

  return (
    <div>
      <h1>Watchlist</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {watchlist.map((item) => (
            <li key={item.id}>{item.symbol} - {item.timeframe}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Step 5: Mock Server for Stack B During Development

While Backend Stack B is being built, use Mock Service Worker (MSW):

```typescript
// frontend/mocks/stack-b-handlers.ts
import { http, HttpResponse } from 'msw';

const STACK_B_URL = process.env['NEXT_PUBLIC_API_B_URL'] || 'http://localhost:3002';

export const stackBHandlers = [
  // GET /watchlist
  http.get(`${STACK_B_URL}/watchlist`, () => {
    return HttpResponse.json([
      {
        id: '1',
        userId: 'user-123',
        symbol: 'XAUUSD',
        timeframe: 'H1',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        userId: 'user-123',
        symbol: 'BTCUSD',
        timeframe: 'H4',
        createdAt: new Date().toISOString(),
      },
    ]);
  }),

  // POST /watchlist
  http.post(`${STACK_B_URL}/watchlist`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      {
        id: Math.random().toString(36),
        ...body,
        createdAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // GET /alerts
  http.get(`${STACK_B_URL}/alerts`, () => {
    return HttpResponse.json([
      {
        id: '1',
        symbol: 'XAUUSD',
        condition: 'price > 2000',
        active: true,
      },
    ]);
  }),

  // GET /leaderboard/:timeframe
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
    if (process.env['NODE_ENV'] === 'development' &&
        process.env['NEXT_PUBLIC_USE_MOCKS'] === 'true') {
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

# Stack A - Main CRUD operations (Parts 2-9, 12-14, 16-19)
NEXT_PUBLIC_API_A_URL=http://localhost:3001

# Stack B - Async/Workers (Parts 10-11, 15, 20-23)
# Not deployed yet, so use mocks
NEXT_PUBLIC_API_B_URL=http://localhost:3002
NEXT_PUBLIC_USE_MOCKS=true

# Stack C - Market Data (Part 24)
NEXT_PUBLIC_API_C_URL=http://contabo-vps-ip:5000

# Auth (shared across all stacks)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
```

```bash
# frontend/.env.production (Vercel - Production)

# Stack A - Deployed to Railway Container A
NEXT_PUBLIC_API_A_URL=https://trading-alerts-stack-a.railway.app

# Stack B - Deployed to Railway Container B (when ready)
NEXT_PUBLIC_API_B_URL=https://trading-alerts-stack-b.railway.app
# If not ready, can temporarily point to Stack A:
# NEXT_PUBLIC_API_B_URL=https://trading-alerts-stack-a.railway.app

# Stack C - Deployed to Contabo VPS
NEXT_PUBLIC_API_C_URL=https://your-contabo-domain.com

NEXTAUTH_URL=https://trading-alerts-frontend.vercel.app
NEXTAUTH_SECRET=production-secret
```

## Development Workflow

### Phase 1: Frontend Development (NOW)
```
✅ Define OpenAPI contracts for Stack B
✅ Generate TypeScript types from contracts
✅ Create stackBClient with typed methods
✅ Use MSW to mock Stack B responses
✅ Build frontend components using api.stackB.*
✅ Test frontend with mocked data
```

### Phase 2: Backend Stack B Development (Parallel)
```
🔨 Build Nest.js services following OpenAPI contracts
🔨 Implement Parts 10, 11, 15, 20-23
🔨 Test backend independently
🔨 Deploy to Railway Container B
```

### Phase 3: Integration
```
🔗 Update NEXT_PUBLIC_API_B_URL to Railway URL
🔗 Disable MSW mocks (set NEXT_PUBLIC_USE_MOCKS=false)
🔗 Test frontend → Backend Stack B integration
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

| Frontend Feature | Backend Stack | Client Used | Status |
|-----------------|---------------|-------------|--------|
| User Profile | Stack A | `api.stackA.getUser()` | ✅ Ready |
| Subscription | Stack A | `api.stackA.getSubscription()` | ✅ Ready |
| Dashboard | Stack A | `api.stackA.getDashboard()` | ✅ Ready |
| **Watchlist** | **Stack B** | **`api.stackB.getWatchlist()`** | 🔨 Use mocks |
| **Alerts** | **Stack B** | **`api.stackB.getAlerts()`** | 🔨 Use mocks |
| **Notifications** | **Stack B** | **`api.stackB.getNotifications()`** | 🔨 Use mocks |
| **Confluence Scores** | **Stack B** | **`api.stackB.getConfluenceScores()`** | 🔨 Use mocks |
| **Leader Board** | **Stack B** | **`api.stackB.getLeaderBoard()`** | 🔨 Use mocks |
| Market Data | Stack C | `api.stackC.getCandles()` | ✅ Ready |

## Migration Path

### Current State
```
Frontend (Vercel) → Next.js API routes
```

### Intermediate State (Stack A deployed, Stack B mocked)
```
Frontend (Vercel) → Stack A (Railway) [Real]
                  → Stack B (Mocked via MSW)
                  → Stack C (Contabo) [Real]
```

### Final State (All stacks deployed)
```
Frontend (Vercel) → Stack A (Railway) [Real]
                  → Stack B (Railway) [Real]
                  → Stack C (Contabo) [Real]
```

## Testing Strategy

### Unit Tests (Frontend)
```typescript
// Test with mocked Stack B client
describe('WatchlistPage', () => {
  it('loads watchlist from Stack B', async () => {
    // Mock returns data
    const mockData = [{ id: '1', symbol: 'XAUUSD' }];
    jest.spyOn(api.stackB, 'getWatchlist').mockResolvedValue(mockData);

    render(<WatchlistPage />);

    await waitFor(() => {
      expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests (E2E)
```typescript
// Test.spec.ts (Playwright)
test('watchlist integration', async ({ page }) => {
  // If Stack B deployed: use real URL
  // If Stack B not deployed: MSW will intercept

  await page.goto('/watchlist');

  // Should load data from Stack B
  await expect(page.locator('text=XAUUSD')).toBeVisible();
});
```

## Recommended Timeline

### Week 1-2: Contracts & Frontend (No Backend Stack B needed)
- [ ] Define OpenAPI specs for Stack B
- [ ] Generate TypeScript types
- [ ] Create stackBClient
- [ ] Setup MSW mocks
- [ ] Build frontend components

### Week 3-6: Backend Stack B Development (Parallel)
- [ ] Build Nest.js services for Parts 10, 11, 15
- [ ] Build Database B (Part 20)
- [ ] Build Message Broker (Part 21)
- [ ] Build Analytics (Parts 22, 23)
- [ ] Test backend independently

### Week 7: Integration
- [ ] Deploy Stack B to Railway
- [ ] Update NEXT_PUBLIC_API_B_URL
- [ ] Disable mocks
- [ ] Integration testing
- [ ] Production deployment

---

## Answer to Your Question

**Do you need complete Backend Stack B first?**

**NO!** You can:

1. ✅ Define API contracts now
2. ✅ Build frontend with mocks now
3. ✅ Build Backend Stack B in parallel
4. ✅ Connect them later

The key is **contract-first development** using OpenAPI specs.

---

**Next Steps:**
1. Create OpenAPI specs for Backend Stack B (Parts 10, 11, 15, 20-23)
2. Generate TypeScript types
3. Create multi-backend API clients
4. Setup MSW mocks
5. Build frontend components
6. Backend team builds Stack B following contracts

Both teams can work in parallel! 🚀
