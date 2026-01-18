## Backend Stack B - Implementation Guide

**Parts Covered:** 10, 11, 15, 20-23
**Status:** OpenAPI Contracts Defined ✅
**Next:** Generate Types & Build Frontend

---

## 📋 Overview

This guide shows how to use the OpenAPI contracts to build frontend NOW while backend team builds Stack B in parallel.

### OpenAPI Specifications Created:

1. **watchlist-api.yaml** - Part 10: Watchlist System
2. **alerts-api.yaml** - Part 11: Alerts System
3. **notifications-api.yaml** - Part 15: Notifications & Real-time
4. **analytics-api.yaml** - Parts 22 & 23: Confluence Scores & Leader Board

---

## 🚀 Quick Start (Frontend Development)

### Step 1: Install OpenAPI Generator

```bash
# Install globally
npm install -g openapi-typescript

# Or as dev dependency
cd frontend
npm install --save-dev openapi-typescript
```

### Step 2: Generate TypeScript Types

```bash
# From project root
cd /home/user/trading-alerts-saas-public

# Generate types for each API
openapi-typescript backend-stack-b/openapi/watchlist-api.yaml \
  --output frontend/types/api-stack-b-watchlist.ts

openapi-typescript backend-stack-b/openapi/alerts-api.yaml \
  --output frontend/types/api-stack-b-alerts.ts

openapi-typescript backend-stack-b/openapi/notifications-api.yaml \
  --output frontend/types/api-stack-b-notifications.ts

openapi-typescript backend-stack-b/openapi/analytics-api.yaml \
  --output frontend/types/api-stack-b-analytics.ts
```

**Add to package.json:**

```json
{
  "scripts": {
    "generate:types:stack-b": "npm run generate:watchlist && npm run generate:alerts && npm run generate:notifications && npm run generate:analytics",
    "generate:watchlist": "openapi-typescript ../backend-stack-b/openapi/watchlist-api.yaml --output types/api-stack-b-watchlist.ts",
    "generate:alerts": "openapi-typescript ../backend-stack-b/openapi/alerts-api.yaml --output types/api-stack-b-alerts.ts",
    "generate:notifications": "openapi-typescript ../backend-stack-b/openapi/notifications-api.yaml --output types/api-stack-b-notifications.ts",
    "generate:analytics": "openapi-typescript ../backend-stack-b/openapi/analytics-api.yaml --output types/api-stack-b-analytics.ts"
  }
}
```

### Step 3: Create Stack B API Client

```typescript
// frontend/lib/api-clients/stack-b-client.ts
import { BaseApiClient } from './base-client';
import type { paths as WatchlistPaths } from '@/types/api-stack-b-watchlist';
import type { paths as AlertsPaths } from '@/types/api-stack-b-alerts';
import type { paths as NotificationsPaths } from '@/types/api-stack-b-notifications';
import type { paths as AnalyticsPaths } from '@/types/api-stack-b-analytics';

export class StackBClient extends BaseApiClient {
  constructor() {
    // Use Stack B URL or fallback to Stack A during development
    const baseURL = process.env['NEXT_PUBLIC_API_B_URL'] ||
                    process.env['NEXT_PUBLIC_API_A_URL'] ||
                    '/api';
    super(baseURL);
  }

  // ==========================================
  // WATCHLIST METHODS (Part 10)
  // ==========================================

  async getWatchlist(params?: {
    sort?: 'createdAt' | 'symbol' | 'timeframe';
    order?: 'asc' | 'desc';
  }) {
    type Response = WatchlistPaths['/watchlist']['get']['responses']['200']['content']['application/json'];
    const query = new URLSearchParams(params as any).toString();
    return this.get<Response>(`/watchlist${query ? `?${query}` : ''}`);
  }

  async addToWatchlist(data: {
    symbol: string;
    timeframe: string;
    notes?: string;
  }) {
    type Request = WatchlistPaths['/watchlist']['post']['requestBody']['content']['application/json'];
    type Response = WatchlistPaths['/watchlist']['post']['responses']['201']['content']['application/json'];
    return this.post<Response>('/watchlist', data as Request);
  }

  async removeFromWatchlist(id: string) {
    return this.delete(`/watchlist/${id}`);
  }

  async reorderWatchlist(order: string[]) {
    return this.post('/watchlist/reorder', { order });
  }

  // ==========================================
  // ALERTS METHODS (Part 11)
  // ==========================================

  async getAlerts(params?: {
    status?: 'active' | 'inactive' | 'triggered' | 'all';
    symbol?: string;
    limit?: number;
    offset?: number;
  }) {
    type Response = AlertsPaths['/alerts']['get']['responses']['200']['content']['application/json'];
    const query = new URLSearchParams(params as any).toString();
    return this.get<Response>(`/alerts${query ? `?${query}` : ''}`);
  }

  async createAlert(data: {
    symbol: string;
    timeframe: string;
    condition: 'above' | 'below' | 'crosses_above' | 'crosses_below';
    targetPrice: number;
    notificationChannels?: ('email' | 'push' | 'sms')[];
    message?: string;
  }) {
    type Request = AlertsPaths['/alerts']['post']['requestBody']['content']['application/json'];
    type Response = AlertsPaths['/alerts']['post']['responses']['201']['content']['application/json'];
    return this.post<Response>('/alerts', data as Request);
  }

  async updateAlert(id: string, data: Partial<{
    condition: string;
    targetPrice: number;
    active: boolean;
    message: string;
  }>) {
    return this.patch(`/alerts/${id}`, data);
  }

  async deleteAlert(id: string) {
    return this.delete(`/alerts/${id}`);
  }

  async toggleAlert(id: string, active: boolean) {
    return this.post(`/alerts/${id}/toggle`, { active });
  }

  async getAlertHistory(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/alerts/history${query ? `?${query}` : ''}`);
  }

  // ==========================================
  // NOTIFICATIONS METHODS (Part 15)
  // ==========================================

  async getNotifications(params?: {
    status?: 'read' | 'unread' | 'all';
    type?: 'alert' | 'system' | 'subscription' | 'affiliate' | 'all';
    limit?: number;
    offset?: number;
  }) {
    type Response = NotificationsPaths['/notifications']['get']['responses']['200']['content']['application/json'];
    const query = new URLSearchParams(params as any).toString();
    return this.get<Response>(`/notifications${query ? `?${query}` : ''}`);
  }

  async markNotificationRead(id: string, read: boolean) {
    return this.patch(`/notifications/${id}`, { read });
  }

  async markAllNotificationsRead() {
    return this.post('/notifications/mark-all-read', {});
  }

  async getNotificationPreferences() {
    type Response = NotificationsPaths['/notifications/preferences']['get']['responses']['200']['content']['application/json'];
    return this.get<Response>('/notifications/preferences');
  }

  async updateNotificationPreferences(preferences: any) {
    return this.put('/notifications/preferences', preferences);
  }

  async subscribeTopush(subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    deviceType?: 'web' | 'ios' | 'android';
  }) {
    return this.post('/notifications/push/subscribe', subscription);
  }

  async getRealtimeConnection() {
    type Response = NotificationsPaths['/realtime/connection']['get']['responses']['200']['content']['application/json'];
    return this.get<Response>('/realtime/connection');
  }

  // ==========================================
  // ANALYTICS METHODS (Parts 22 & 23)
  // ==========================================

  async getConfluenceScores(symbol: string, timeframes?: string[]) {
    type Response = AnalyticsPaths['/confluence/{symbol}']['get']['responses']['200']['content']['application/json'];
    const query = timeframes ? `?timeframes=${timeframes.join(',')}` : '';
    return this.get<Response>(`/confluence/${symbol}${query}`);
  }

  async getConfluenceScore(symbol: string, timeframe: string) {
    type Response = AnalyticsPaths['/confluence/{symbol}/{timeframe}']['get']['responses']['200']['content']['application/json'];
    return this.get<Response>(`/confluence/${symbol}/${timeframe}`);
  }

  async getConfluenceHistory(symbol: string, params: {
    timeframe: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/confluence/${symbol}/history?${query}`);
  }

  async getLeaderBoard(params?: {
    metric?: 'confluence' | 'volatility' | 'momentum' | 'volume';
    limit?: number;
    allowedOnly?: boolean;
  }) {
    type Response = AnalyticsPaths['/leaderboard']['get']['responses']['200']['content']['application/json'];
    const query = new URLSearchParams(params as any).toString();
    return this.get<Response>(`/leaderboard${query ? `?${query}` : ''}`);
  }

  async getLeaderBoardByTimeframe(timeframe: string, params?: {
    metric?: string;
    limit?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/leaderboard/${timeframe}${query ? `?${query}` : ''}`);
  }

  async getSymbolRankings(symbol: string, metric?: string) {
    const query = metric ? `?metric=${metric}` : '';
    return this.get(`/leaderboard/symbol/${symbol}${query}`);
  }

  async getMarketOverview() {
    return this.get('/analytics/market-overview');
  }
}

export const stackBClient = new StackBClient();
```

### Step 4: Create MSW Mocks

```typescript
// frontend/mocks/stack-b/watchlist-handlers.ts
import { http, HttpResponse } from 'msw';

const baseURL = process.env['NEXT_PUBLIC_API_B_URL'] || 'http://localhost:3002';

export const watchlistHandlers = [
  // GET /watchlist
  http.get(`${baseURL}/watchlist`, () => {
    return HttpResponse.json({
      watchlist: [
        {
          id: '1',
          userId: 'user-123',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          userId: 'user-123',
          symbol: 'BTCUSD',
          timeframe: 'H4',
          order: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 2,
      metadata: {
        maxItems: 50,
      },
    });
  }),

  // POST /watchlist
  http.post(`${baseURL}/watchlist`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      {
        id: Math.random().toString(36).substr(2, 9),
        userId: 'user-123',
        ...body,
        order: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // DELETE /watchlist/:id
  http.delete(`${baseURL}/watchlist/:id`, ({ params }) => {
    return HttpResponse.json({
      message: 'Watchlist item removed',
      id: params.id,
    });
  }),
];
```

```typescript
// frontend/mocks/stack-b/alerts-handlers.ts
import { http, HttpResponse } from 'msw';

const baseURL = process.env['NEXT_PUBLIC_API_B_URL'] || 'http://localhost:3002';

export const alertsHandlers = [
  // GET /alerts
  http.get(`${baseURL}/alerts`, () => {
    return HttpResponse.json({
      alerts: [
        {
          id: '1',
          userId: 'user-123',
          symbol: 'XAUUSD',
          timeframe: 'H1',
          condition: 'above',
          targetPrice: 2050.00,
          active: true,
          notificationChannels: ['email', 'push'],
          triggerCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      total: 1,
      metadata: {
        maxAlerts: 20,
        activeCount: 1,
      },
    });
  }),

  // POST /alerts
  http.post(`${baseURL}/alerts`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      {
        id: Math.random().toString(36).substr(2, 9),
        userId: 'user-123',
        ...body,
        active: true,
        triggerCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),
];
```

```typescript
// frontend/mocks/stack-b/index.ts
import { watchlistHandlers } from './watchlist-handlers';
import { alertsHandlers } from './alerts-handlers';
import { notificationsHandlers } from './notifications-handlers';
import { analyticsHandlers } from './analytics-handlers';

export const stackBHandlers = [
  ...watchlistHandlers,
  ...alertsHandlers,
  ...notificationsHandlers,
  ...analyticsHandlers,
];
```

### Step 5: Use in Components

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
        // This calls Stack B (or MSW mock if Stack B not deployed)
        const data = await api.stackB.getWatchlist();
        setWatchlist(data.watchlist);
      } catch (error) {
        console.error('Failed to load watchlist:', error);
      } finally {
        setLoading(false);
      }
    }

    loadWatchlist();
  }, []);

  async function handleAddToWatchlist(symbol: string, timeframe: string) {
    try {
      const newItem = await api.stackB.addToWatchlist({
        symbol,
        timeframe,
      });
      setWatchlist((prev) => [...prev, newItem]);
    } catch (error) {
      console.error('Failed to add to watchlist:', error);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>My Watchlist</h1>
      <ul>
        {watchlist.map((item) => (
          <li key={item.id}>
            {item.symbol} - {item.timeframe}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 🧪 Testing Strategy

### With MSW Mocks (Stack B Not Deployed)

```bash
# Start frontend with mocks enabled
NEXT_PUBLIC_USE_MOCKS=true npm run dev
```

**MSW intercepts requests:**
```
Frontend → api.stackB.getWatchlist()
  → fetch('http://localhost:3002/watchlist')
  → MSW intercepts
  → Returns mock data
  → Frontend receives data ✅
```

### With Real Stack B (After Deployment)

```bash
# Deploy Stack B to Railway
cd backend-stack-b
railway up

# Update .env.local
NEXT_PUBLIC_API_B_URL=https://trading-alerts-stack-b.railway.app
NEXT_PUBLIC_USE_MOCKS=false

# Start frontend
npm run dev
```

**Real requests:**
```
Frontend → api.stackB.getWatchlist()
  → fetch('https://trading-alerts-stack-b.railway.app/watchlist')
  → Stack B on Railway handles request
  → Returns real data
  → Frontend receives data ✅
```

---

## 📦 Backend Development (Nest.js)

Backend team can build Stack B following the OpenAPI contracts:

### Step 1: Generate Nest.js Boilerplate

```bash
# Install OpenAPI generator CLI
npm install -g @openapitools/openapi-generator-cli

# Generate Nest.js controllers/DTOs from OpenAPI
openapi-generator-cli generate \
  -i backend-stack-b/openapi/watchlist-api.yaml \
  -g typescript-nestjs \
  -o backend-stack-b/src/watchlist
```

### Step 2: Implement Services

```typescript
// backend-stack-b/src/watchlist/watchlist.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WatchlistService {
  constructor(private prisma: PrismaService) {}

  async getWatchlist(userId: string) {
    return this.prisma.watchlistItem.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
  }

  async addToWatchlist(userId: string, data: CreateWatchlistDto) {
    // Implementation follows OpenAPI contract
    return this.prisma.watchlistItem.create({
      data: {
        userId,
        symbol: data.symbol,
        timeframe: data.timeframe,
        notes: data.notes,
      },
    });
  }
}
```

---

## ⚙️ Environment Variables

### Frontend (.env.local)

```bash
# Development (with mocks)
NEXT_PUBLIC_API_A_URL=http://localhost:3001
NEXT_PUBLIC_API_B_URL=http://localhost:3002
NEXT_PUBLIC_USE_MOCKS=true

# Production (Vercel)
NEXT_PUBLIC_API_A_URL=https://trading-alerts-stack-a.railway.app
NEXT_PUBLIC_API_B_URL=https://trading-alerts-stack-b.railway.app
NEXT_PUBLIC_USE_MOCKS=false
```

### Backend Stack B (.env)

```bash
# Railway Container B
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
MESSAGE_QUEUE_URL=redis://...
JWT_SECRET=your-secret
NEXTAUTH_SECRET=same-as-vercel
PORT=3002
```

---

## ✅ Summary

### What We Have NOW:

1. ✅ **OpenAPI Contracts** - Complete API specifications
2. ✅ **TypeScript Types** - Auto-generated from contracts
3. ✅ **Frontend API Client** - Type-safe Stack B client
4. ✅ **MSW Mocks** - Mock data for development
5. ✅ **Implementation Guide** - This document

### What Frontend Can Do NOW:

- ✅ Build UI components using api.stackB.*
- ✅ Test with MSW mocks (no backend needed)
- ✅ Full type safety from OpenAPI specs
- ✅ Deploy to Vercel with mocks

### What Backend Can Do (Parallel):

- 🔨 Build Nest.js services following contracts
- 🔨 Implement Parts 10, 11, 15, 20-23
- 🔨 Test independently
- 🔨 Deploy to Railway when ready

### When Stack B is Ready:

1. Deploy Stack B to Railway
2. Update `NEXT_PUBLIC_API_B_URL` on Vercel
3. Set `NEXT_PUBLIC_USE_MOCKS=false`
4. Redeploy frontend
5. Done! ✅

**No code changes needed in components!** 🎉

---

**Last Updated:** 2026-01-18
**Status:** Ready for parallel development
**Next:** Generate types, create client, build frontend
