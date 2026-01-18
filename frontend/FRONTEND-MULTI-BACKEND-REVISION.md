# Frontend Revisions for Multi-Backend Compatibility

**Purpose:** Update Next.js UI (Step 4) to work seamlessly with Backend Stack A, B, and C
**Date:** 2026-01-18
**Status:** Revision Required ⚠️

---

## 🎯 Current State vs Required State

### **Current (Single Backend)**
```
Frontend (Vercel)
    ↓ NEXT_PUBLIC_API_URL
    ↓
Backend Stack A (Railway)
```

**Problem:** Can only talk to ONE backend at a time.

### **Required (Multi-Backend)**
```
Frontend (Vercel)
    ├─ NEXT_PUBLIC_API_A_URL → Backend Stack A (Railway)
    ├─ NEXT_PUBLIC_API_B_URL → Backend Stack B (Railway)
    └─ NEXT_PUBLIC_API_C_URL → Backend Stack C (Contabo)
```

**Solution:** Frontend routes requests to appropriate backend based on feature.

---

## 📋 Revision Checklist

### ✅ Phase 1: API Client Architecture (REQUIRED)

**Current File:** `frontend/lib/api-client.ts` (Single backend)

**Needs:**
1. ❌ Update to base client pattern
2. ❌ Create Stack A client
3. ❌ Create Stack B client
4. ❌ Create Stack C client
5. ❌ Create unified API export

### ✅ Phase 2: Environment Variables (REQUIRED)

**Current:**
```bash
NEXT_PUBLIC_API_URL=https://backend.railway.app
```

**Needs:**
```bash
NEXT_PUBLIC_API_A_URL=https://stack-a.railway.app
NEXT_PUBLIC_API_B_URL=https://stack-b.railway.app
NEXT_PUBLIC_API_C_URL=https://contabo-vps.com
```

### ✅ Phase 3: TypeScript Types (REQUIRED)

**Current:** No type definitions for Stack B

**Needs:**
1. ❌ Generate types from Stack B OpenAPI specs
2. ❌ Update import paths in components
3. ❌ Type-safe API client methods

### ✅ Phase 4: Component Updates (REQUIRED)

**Current:** Components use single `apiClient`

**Needs:** Update to use multi-backend API:
```typescript
// OLD
const data = await apiClient.get('/watchlist');

// NEW
const data = await api.stackB.getWatchlist();
```

### ✅ Phase 5: MSW Mocks Setup (OPTIONAL for Development)

**Current:** No mocks

**Needs:** Mock Stack B for parallel development

---

## 🔧 Detailed Revision Steps

### **STEP 1: Refactor API Client to Base Pattern**

#### Current File Structure:
```
frontend/lib/
└── api-client.ts (single client)
```

#### New File Structure:
```
frontend/lib/api-clients/
├── base-client.ts          ← Base class (shared logic)
├── stack-a-client.ts       ← Stack A specific methods
├── stack-b-client.ts       ← Stack B specific methods
├── stack-c-client.ts       ← Stack C specific methods
└── index.ts                ← Unified export
```

#### Action Items:

**1.1 Create Base Client**

```typescript
// frontend/lib/api-clients/base-client.ts
export class BaseApiClient {
  protected baseURL: string;
  protected defaultHeaders: HeadersInit;
  protected credentials: RequestCredentials;

  constructor(baseURL: string, config?: ApiClientConfig) {
    this.baseURL = baseURL;

    // Remove trailing slash
    if (this.baseURL.endsWith('/')) {
      this.baseURL = this.baseURL.slice(0, -1);
    }

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config?.headers,
    };

    this.credentials = config?.credentials || 'include';
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
      credentials: this.credentials,
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw new ApiError(response.status, error.message, error.details);
    }

    return response.json();
  }

  private async parseError(response: Response) {
    try {
      return await response.json();
    } catch {
      return { message: response.statusText };
    }
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  isExternalAPI(): boolean {
    return !this.baseURL.startsWith('/');
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

**1.2 Create Stack A Client**

```typescript
// frontend/lib/api-clients/stack-a-client.ts
import { BaseApiClient } from './base-client';

export class StackAClient extends BaseApiClient {
  constructor() {
    const baseURL = process.env['NEXT_PUBLIC_API_A_URL'] || '/api';
    super(baseURL);
  }

  // ==========================================
  // USER & PROFILE (Part 2)
  // ==========================================

  async getUser(userId: string) {
    return this.get(`/user/${userId}`);
  }

  async updateProfile(data: any) {
    return this.patch('/user/profile', data);
  }

  // ==========================================
  // SUBSCRIPTION & BILLING (Part 12)
  // ==========================================

  async getSubscription() {
    return this.get('/subscription');
  }

  async createCheckout(planId: string, code?: string) {
    return this.post('/checkout', { planId, code });
  }

  async cancelSubscription() {
    return this.post('/subscription/cancel', {});
  }

  // ==========================================
  // DASHBOARD (Part 8)
  // ==========================================

  async getDashboard() {
    return this.get('/dashboard');
  }

  // ==========================================
  // SETTINGS (Part 13)
  // ==========================================

  async getSettings() {
    return this.get('/user/preferences');
  }

  async updateSettings(data: any) {
    return this.put('/user/preferences', data);
  }

  // ==========================================
  // ADMIN (Part 14)
  // ==========================================

  async getAdminUsers(params?: any) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/admin/users${query ? `?${query}` : ''}`);
  }

  async getAdminAnalytics() {
    return this.get('/admin/analytics');
  }

  // ==========================================
  // AFFILIATE (Parts 17A, 17B)
  // ==========================================

  async getAffiliateDashboard() {
    return this.get('/affiliate/dashboard/stats');
  }

  async getAffiliateCodes() {
    return this.get('/affiliate/dashboard/codes');
  }

  async getAffiliateCommissions() {
    return this.get('/affiliate/dashboard/commissions');
  }

  // ==========================================
  // PAYMENTS (Parts 18, 19)
  // ==========================================

  async createDLocalPayment(data: any) {
    return this.post('/payments/dlocal/create', data);
  }

  async getPaymentMethods(country: string) {
    return this.get(`/payments/dlocal/methods?country=${country}`);
  }
}

export const stackAClient = new StackAClient();
```

**1.3 Create Stack B Client**

```typescript
// frontend/lib/api-clients/stack-b-client.ts
import { BaseApiClient } from './base-client';

export class StackBClient extends BaseApiClient {
  constructor() {
    // Fallback to Stack A during development if Stack B not deployed
    const baseURL = process.env['NEXT_PUBLIC_API_B_URL'] ||
                    process.env['NEXT_PUBLIC_API_A_URL'] ||
                    '/api';
    super(baseURL);
  }

  // ==========================================
  // WATCHLIST (Part 10)
  // ==========================================

  async getWatchlist(params?: {
    sort?: 'createdAt' | 'symbol' | 'timeframe';
    order?: 'asc' | 'desc';
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/watchlist${query ? `?${query}` : ''}`);
  }

  async addToWatchlist(data: {
    symbol: string;
    timeframe: string;
    notes?: string;
  }) {
    return this.post('/watchlist', data);
  }

  async removeFromWatchlist(id: string) {
    return this.delete(`/watchlist/${id}`);
  }

  async reorderWatchlist(order: string[]) {
    return this.post('/watchlist/reorder', { order });
  }

  async bulkAddToWatchlist(items: Array<{ symbol: string; timeframe: string }>) {
    return this.post('/watchlist/bulk', { items });
  }

  // ==========================================
  // ALERTS (Part 11)
  // ==========================================

  async getAlerts(params?: {
    status?: 'active' | 'inactive' | 'triggered' | 'all';
    symbol?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/alerts${query ? `?${query}` : ''}`);
  }

  async createAlert(data: {
    symbol: string;
    timeframe: string;
    condition: 'above' | 'below' | 'crosses_above' | 'crosses_below';
    targetPrice: number;
    notificationChannels?: ('email' | 'push' | 'sms')[];
    message?: string;
  }) {
    return this.post('/alerts', data);
  }

  async updateAlert(id: string, data: Partial<{
    condition: string;
    targetPrice: number;
    active: boolean;
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

  async testAlert(id: string) {
    return this.post(`/alerts/test/${id}`, {});
  }

  // ==========================================
  // NOTIFICATIONS (Part 15)
  // ==========================================

  async getNotifications(params?: {
    status?: 'read' | 'unread' | 'all';
    type?: 'alert' | 'system' | 'subscription' | 'affiliate' | 'all';
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/notifications${query ? `?${query}` : ''}`);
  }

  async markNotificationRead(id: string, read: boolean) {
    return this.patch(`/notifications/${id}`, { read });
  }

  async deleteNotification(id: string) {
    return this.delete(`/notifications/${id}`);
  }

  async markAllNotificationsRead() {
    return this.post('/notifications/mark-all-read', {});
  }

  async getNotificationPreferences() {
    return this.get('/notifications/preferences');
  }

  async updateNotificationPreferences(preferences: any) {
    return this.put('/notifications/preferences', preferences);
  }

  async subscribeToPush(subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    deviceType?: 'web' | 'ios' | 'android';
  }) {
    return this.post('/notifications/push/subscribe', subscription);
  }

  async unsubscribeFromPush(endpoint: string) {
    return this.post('/notifications/push/unsubscribe', { endpoint });
  }

  async getRealtimeConnection() {
    return this.get('/realtime/connection');
  }

  // ==========================================
  // ANALYTICS (Parts 22 & 23)
  // ==========================================

  async getConfluenceScores(symbol: string, timeframes?: string[]) {
    const query = timeframes ? `?timeframes=${timeframes.join(',')}` : '';
    return this.get(`/confluence/${symbol}${query}`);
  }

  async getConfluenceScore(symbol: string, timeframe: string) {
    return this.get(`/confluence/${symbol}/${timeframe}`);
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
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/leaderboard${query ? `?${query}` : ''}`);
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

  async triggerConfluenceComputation(data?: {
    symbols?: string[];
    timeframes?: string[];
  }) {
    return this.post('/analytics/compute/trigger', data || {});
  }

  async getComputationJobStatus(jobId: string) {
    return this.get(`/analytics/jobs/${jobId}`);
  }
}

export const stackBClient = new StackBClient();
```

**1.4 Create Stack C Client**

```typescript
// frontend/lib/api-clients/stack-c-client.ts
import { BaseApiClient } from './base-client';

export class StackCClient extends BaseApiClient {
  constructor() {
    const baseURL = process.env['NEXT_PUBLIC_API_C_URL'] ||
                    'http://localhost:5000';
    super(baseURL);
  }

  // ==========================================
  // MARKET DATA (Part 24)
  // ==========================================

  async getCandles(symbol: string, timeframe: string, params?: {
    startTime?: number;
    endTime?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams(params as any).toString();
    return this.get(`/candles/${symbol}/${timeframe}${query ? `?${query}` : ''}`);
  }

  async getIndicators(symbol: string, timeframe: string) {
    return this.get(`/indicators/${symbol}/${timeframe}`);
  }

  async getSymbols() {
    return this.get('/symbols');
  }

  async getTimeframes() {
    return this.get('/timeframes');
  }

  async getHealthStatus() {
    return this.get('/health');
  }
}

export const stackCClient = new StackCClient();
```

**1.5 Create Unified Export**

```typescript
// frontend/lib/api-clients/index.ts
export { BaseApiClient, ApiError } from './base-client';
export { StackAClient, stackAClient } from './stack-a-client';
export { StackBClient, stackBClient } from './stack-b-client';
export { StackCClient, stackCClient } from './stack-c-client';

// Unified API object for convenience
export const api = {
  stackA: stackAClient,
  stackB: stackBClient,
  stackC: stackCClient,
};

// Helper to get appropriate client based on feature
export function getApiClient(feature: string) {
  switch (feature) {
    case 'watchlist':
    case 'alerts':
    case 'notifications':
    case 'analytics':
    case 'confluence':
    case 'leaderboard':
      return api.stackB;

    case 'candles':
    case 'indicators':
    case 'market-data':
      return api.stackC;

    default:
      return api.stackA;
  }
}
```

---

### **STEP 2: Update Environment Variables**

#### Current `.env.example`:
```bash
NEXT_PUBLIC_API_URL=
```

#### New `.env.example`:
```bash
# ==========================================
# API ENDPOINTS (Multi-Backend Architecture)
# ==========================================

# Backend Stack A (Main CRUD, Auth, Billing)
# Parts: 2, 3, 4, 6, 7, 8, 9, 12, 13, 14, 16, 17A, 17B, 18, 19
# Development: http://localhost:3001
# Production: https://trading-alerts-stack-a.railway.app
NEXT_PUBLIC_API_A_URL=

# Backend Stack B (Async Workers, Analytics, Real-time)
# Parts: 10 (Watchlist), 11 (Alerts), 15 (Notifications), 20-23 (Analytics)
# Development: http://localhost:3002
# Production: https://trading-alerts-stack-b.railway.app
NEXT_PUBLIC_API_B_URL=

# Backend Stack C (Market Data Collection)
# Part: 24 (MT5 Data Collection)
# Development: http://localhost:5000
# Production: http://your-contabo-vps-ip:5000
NEXT_PUBLIC_API_C_URL=

# Development Mode - Enable MSW Mocks for Stack B
# Set to 'true' to use mocks while Stack B is being built
# Set to 'false' when Stack B is deployed
NEXT_PUBLIC_USE_MOCKS=false

# ==========================================
# AUTHENTICATION (NextAuth)
# ==========================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# ==========================================
# OAUTH PROVIDERS
# ==========================================
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# ==========================================
# EMAIL SERVICE (Resend)
# ==========================================
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# ==========================================
# FEATURE FLAGS (for gradual rollout)
# ==========================================
NEXT_PUBLIC_ENABLE_STACK_B=false  # Enable Stack B features when ready
NEXT_PUBLIC_ENABLE_STACK_C=true   # Stack C (market data) already working
```

#### Update `.env.local` (Development):
```bash
# Development - All stacks running locally
NEXT_PUBLIC_API_A_URL=http://localhost:3001
NEXT_PUBLIC_API_B_URL=http://localhost:3002
NEXT_PUBLIC_API_C_URL=http://localhost:5000
NEXT_PUBLIC_USE_MOCKS=true  # Use mocks for Stack B during development

NEXT_PUBLIC_ENABLE_STACK_B=true  # Enable in development
NEXT_PUBLIC_ENABLE_STACK_C=true
```

#### Vercel Environment Variables (Production):
```bash
NEXT_PUBLIC_API_A_URL=https://trading-alerts-stack-a.railway.app
NEXT_PUBLIC_API_B_URL=https://trading-alerts-stack-b.railway.app
NEXT_PUBLIC_API_C_URL=http://contabo-vps-ip:5000
NEXT_PUBLIC_USE_MOCKS=false

NEXT_PUBLIC_ENABLE_STACK_B=true  # Enable when Stack B deployed
NEXT_PUBLIC_ENABLE_STACK_C=true
```

---

### **STEP 3: Generate TypeScript Types from OpenAPI**

```bash
# Install generator
npm install --save-dev openapi-typescript

# Add scripts to package.json
{
  "scripts": {
    "generate:types": "npm run generate:stack-b",
    "generate:stack-b": "npm run generate:watchlist && npm run generate:alerts && npm run generate:notifications && npm run generate:analytics",
    "generate:watchlist": "openapi-typescript ../backend-stack-b/openapi/watchlist-api.yaml --output types/api-stack-b-watchlist.ts",
    "generate:alerts": "openapi-typescript ../backend-stack-b/openapi/alerts-api.yaml --output types/api-stack-b-alerts.ts",
    "generate:notifications": "openapi-typescript ../backend-stack-b/openapi/notifications-api.yaml --output types/api-stack-b-notifications.ts",
    "generate:analytics": "openapi-typescript ../backend-stack-b/openapi/analytics-api.yaml --output types/api-stack-b-analytics.ts"
  }
}

# Run generation
npm run generate:types
```

---

### **STEP 4: Update Components to Use Multi-Backend API**

#### Example: Watchlist Component

**Before:**
```typescript
// ❌ OLD - Single backend
import { apiClient } from '@/lib/api-client';

const watchlist = await apiClient.get('/watchlist');
```

**After:**
```typescript
// ✅ NEW - Multi-backend
import { api } from '@/lib/api-clients';

const watchlist = await api.stackB.getWatchlist();
```

#### Component Updates Needed:

| Page/Component | Old API Call | New API Call |
|----------------|-------------|--------------|
| `/watchlist` | `apiClient.get('/watchlist')` | `api.stackB.getWatchlist()` |
| `/alerts` | `apiClient.get('/alerts')` | `api.stackB.getAlerts()` |
| `/alerts/new` | `apiClient.post('/alerts', data)` | `api.stackB.createAlert(data)` |
| `/notifications` | `apiClient.get('/notifications')` | `api.stackB.getNotifications()` |
| `/dashboard` | `apiClient.get('/dashboard')` | `api.stackA.getDashboard()` |
| `/charts/[symbol]/[timeframe]` | `apiClient.get('/candles')` | `api.stackC.getCandles()` |
| `/leaderboard` | N/A (new feature) | `api.stackB.getLeaderBoard()` |
| `/confluence/[symbol]` | N/A (new feature) | `api.stackB.getConfluenceScores()` |

---

### **STEP 5: Setup MSW Mocks for Stack B (Optional)**

```bash
# Install MSW
npm install --save-dev msw
```

```typescript
// frontend/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { stackBHandlers } from './stack-b/handlers';

export const worker = setupWorker(...stackBHandlers);
```

```typescript
// frontend/app/layout.tsx
'use client';

import { useEffect } from 'react';

export default function RootLayout({ children }) {
  useEffect(() => {
    if (
      process.env['NODE_ENV'] === 'development' &&
      process.env['NEXT_PUBLIC_USE_MOCKS'] === 'true'
    ) {
      import('../mocks/browser').then(({ worker }) => {
        worker.start({
          onUnhandledRequest: 'bypass', // Only mock Stack B
        });
      });
    }
  }, []);

  return children;
}
```

---

## 📊 Migration Impact Analysis

### Components Requiring Updates:

| Component | Current Backend | New Backend | Priority |
|-----------|-----------------|-------------|----------|
| Watchlist page | Stack A | Stack B | HIGH |
| Alerts page | Stack A | Stack B | HIGH |
| Alert creation | Stack A | Stack B | HIGH |
| Notifications | Stack A | Stack B | MEDIUM |
| Dashboard | Stack A | Stack A | No change |
| Charts | Stack A | Stack C | MEDIUM |
| Profile | Stack A | Stack A | No change |
| Billing | Stack A | Stack A | No change |

**Total Components to Update:** ~15-20 components

---

## ⚙️ Feature Flags for Gradual Rollout

```typescript
// frontend/lib/feature-flags.ts
export const featureFlags = {
  useStackB: process.env['NEXT_PUBLIC_ENABLE_STACK_B'] === 'true',
  useStackC: process.env['NEXT_PUBLIC_ENABLE_STACK_C'] === 'true',
};

// Usage in components
if (featureFlags.useStackB) {
  // Use Stack B
  const watchlist = await api.stackB.getWatchlist();
} else {
  // Fallback to Stack A
  const watchlist = await api.stackA.getWatchlist();
}
```

---

## 🧪 Testing Strategy

### Phase 1: Local Development
```bash
# Test with all stacks locally
NEXT_PUBLIC_API_A_URL=http://localhost:3001
NEXT_PUBLIC_API_B_URL=http://localhost:3002
NEXT_PUBLIC_API_C_URL=http://localhost:5000
```

### Phase 2: Stack B with Mocks
```bash
# Stack A real, Stack B mocked
NEXT_PUBLIC_API_A_URL=https://stack-a.railway.app
NEXT_PUBLIC_USE_MOCKS=true  # MSW mocks Stack B
```

### Phase 3: All Stacks Real
```bash
# Production
NEXT_PUBLIC_API_A_URL=https://stack-a.railway.app
NEXT_PUBLIC_API_B_URL=https://stack-b.railway.app
NEXT_PUBLIC_API_C_URL=http://contabo-vps:5000
NEXT_PUBLIC_USE_MOCKS=false
```

---

## ✅ Summary of Required Changes

### Must Do (Critical):
1. ✅ Refactor API client to multi-backend architecture
2. ✅ Update environment variables (.env.example, Vercel)
3. ✅ Generate TypeScript types from Stack B OpenAPI specs
4. ✅ Update components to use new API structure

### Should Do (Recommended):
5. ✅ Setup MSW mocks for parallel development
6. ✅ Add feature flags for gradual rollout
7. ✅ Add error boundaries for each backend
8. ✅ Add retry logic per backend

### Nice to Have (Optional):
9. ⭕ Add monitoring/logging per backend
10. ⭕ Add performance tracking per backend
11. ⭕ Add A/B testing infrastructure
12. ⭕ Add automatic failover logic

---

## 🚀 Migration Timeline

### Week 1: Infrastructure
- [ ] Refactor API client architecture
- [ ] Update environment variables
- [ ] Setup TypeScript type generation
- [ ] Test with local backends

### Week 2: Component Migration
- [ ] Update watchlist components
- [ ] Update alerts components
- [ ] Update notifications components
- [ ] Update charts (for Stack C)

### Week 3: Testing & Deployment
- [ ] Test with MSW mocks
- [ ] Integration testing with real Stack B
- [ ] Deploy to Vercel
- [ ] Monitor and fix issues

**Total Time:** ~3 weeks

---

## 📋 Validation Checklist

After migration, verify:

- [ ] Frontend can call Stack A endpoints ✅
- [ ] Frontend can call Stack B endpoints ✅
- [ ] Frontend can call Stack C endpoints ✅
- [ ] Environment variables work in dev ✅
- [ ] Environment variables work in production ✅
- [ ] TypeScript types are correct ✅
- [ ] No TypeScript errors ✅
- [ ] All components use new API structure ✅
- [ ] MSW mocks work (if enabled) ✅
- [ ] Feature flags work ✅
- [ ] Error handling works for each backend ✅
- [ ] Authentication works across all backends ✅
- [ ] CORS configured on all backends ✅
- [ ] Build succeeds ✅
- [ ] Deploy succeeds ✅

---

**Last Updated:** 2026-01-18
**Status:** Revision Required
**Priority:** HIGH (before Stack B deployment)
