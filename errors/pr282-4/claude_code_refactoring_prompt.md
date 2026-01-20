# Claude Code Refactoring Task: Fix PR #282 Compilation Failures

## Context

Three consecutive compilation attempts have failed with persistent module resolution errors and TypeScript compilation issues. The current debugging approach is introducing new problems instead of fixing existing ones. A systematic refactor is required.

## Problem Analysis

### Critical Issue #1: Missing Module Resolution (Persistent across all 3 attempts)

- **Error**: `Cannot find module '@/lib/api'` in 41+ test files
- **Impact**: All tests for Stack A and Stack B clients failing
- **Root Cause**: Missing `lib/api/index.ts` module and incorrect module path configuration

### Critical Issue #2: TypeScript Compilation Errors (Different each attempt)

- **Attempt 1**: Line 61 - `unsubscribeNotificationsRef` declared but never read
- **Attempt 2**: Line 136 - `setupRealTimeNotifications` declared but never read
- **Attempt 3**: Line 332 - `setNotifications` declared but never read
- **Pattern**: Each fix introduces new unused variable errors in `hooks/use-api-client-example.ts`

## Refactoring Objectives

### Phase 1: Create Missing API Module (CRITICAL)

1. Create `lib/api/index.ts` with complete Stack A and Stack B client implementations
2. Ensure proper TypeScript exports
3. Validate import resolution

### Phase 2: Fix Module Resolution Configuration

1. Update `tsconfig.json` to ensure `@/` path alias points correctly
2. Update `jest.config.js` moduleNameMapper to resolve `@/lib/api`
3. Validate configuration works for both runtime and tests

### Phase 3: Fix TypeScript Strict Mode Violations

1. Review entire `hooks/use-api-client-example.ts` file
2. Remove OR properly implement all unused variables
3. Ensure no new TypeScript errors are introduced

## Implementation Instructions

### Task 1: Create `lib/api/index.ts`

Create a new file at `lib/api/index.ts` with the following complete implementation:

```typescript
/**
 * API Client - Unified interface for Stack A and Stack B endpoints
 *
 * Stack A: Currently deployed endpoints (Parts 1-19)
 * Stack B: Future endpoints (Parts 20-26) - will return 404 until deployed
 *
 * Updated: 2025-01-20
 */

const BASE_URL =
  typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
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

// Stack A Client - Currently deployed endpoints
const stackA = {
  // Alerts API (Part 11) - 4 methods
  getAlerts: () => apiCall('/api/alerts', { method: 'GET' }),
  createAlert: (data: any) =>
    apiCall('/api/alerts', { method: 'POST', body: JSON.stringify(data) }),
  updateAlert: (id: string, data: any) =>
    apiCall(`/api/alerts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAlert: (id: string) =>
    apiCall(`/api/alerts/${id}`, { method: 'DELETE' }),

  // Watchlist API (Part 10) - 3 methods
  getWatchlist: () => apiCall('/api/watchlist', { method: 'GET' }),
  addToWatchlist: (data: any) =>
    apiCall('/api/watchlist', { method: 'POST', body: JSON.stringify(data) }),
  removeFromWatchlist: (id: string) =>
    apiCall(`/api/watchlist/${id}`, { method: 'DELETE' }),

  // Charts API (Part 9) - CORRECTED endpoint
  getChartData: (symbol: string) =>
    apiCall(`/api/candles/${symbol}`, { method: 'GET' }),

  // User Profile - CORRECTED endpoint
  getUser: () => apiCall('/api/user/profile', { method: 'GET' }),
  updateUser: (data: any) =>
    apiCall('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Subscription API (Part 4) - 2 methods
  getSubscription: () => apiCall('/api/subscription', { method: 'GET' }),
  updateSubscription: (data: any) =>
    apiCall('/api/subscription', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Notifications API (Part 15) - 2 methods
  getNotifications: () => apiCall('/api/notifications', { method: 'GET' }),
  markNotificationAsRead: (id: string) =>
    apiCall(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    }),

  // Admin API - CORRECTED endpoint
  getAdminStats: () => apiCall('/api/admin/analytics', { method: 'GET' }),
  getAffiliates: (params?: any) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return apiCall(`/api/admin/affiliates${query}`, { method: 'GET' });
  },

  // Billing & Payments - CORRECTED endpoint
  getBillingHistory: () => apiCall('/api/invoices', { method: 'GET' }),
  createPayment: (data: any) =>
    apiCall('/api/payments/dlocal/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Settings - CORRECTED endpoint
  getSettings: () => apiCall('/api/user/preferences', { method: 'GET' }),
  updateSettings: (data: any) =>
    apiCall('/api/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Stack B Client - Future endpoints (will return 404 until deployed)
const stackB = {
  // Market Data API (Part 21) - 2 methods
  getMarketData: (symbol: string) =>
    apiCall(`/api/market-data/${symbol}`, { method: 'GET' }),
  getOHLCV: (symbol: string, timeframe: string) =>
    apiCall(`/api/market-data/${symbol}/${timeframe}`, { method: 'GET' }),

  // Confluence Scores API (Part 22) - 2 methods
  getConfluenceScores: (symbol: string) =>
    apiCall(`/api/confluence/${symbol}`, { method: 'GET' }),
  getConfluenceHistory: (symbol: string, timeframe: string) =>
    apiCall(`/api/confluence/${symbol}/${timeframe}/history`, {
      method: 'GET',
    }),

  // Leaderboard API (Part 23) - 3 methods
  getLeaderBoard: (timeframe: string) =>
    apiCall(`/api/leaderboard/${timeframe}`, { method: 'GET' }),
  getTopSymbols: (limit: number) =>
    apiCall(`/api/leaderboard/symbols?limit=${limit}`, { method: 'GET' }),
  getTopTimeframes: (limit: number) =>
    apiCall(`/api/leaderboard/timeframes?limit=${limit}`, { method: 'GET' }),

  // Surveillance API (Part 24) - 3 methods
  getSurveillance: () => apiCall('/api/surveillance', { method: 'GET' }),
  getSymbolsSurveillance: () =>
    apiCall('/api/surveillance/symbols', { method: 'GET' }),
  getTimeframesSurveillance: () =>
    apiCall('/api/surveillance/timeframes', { method: 'GET' }),

  // Advanced Notifications API (Part 26) - 1 method
  getAdvancedNotifications: (params: any) => {
    const query = `?${new URLSearchParams(params).toString()}`;
    return apiCall(`/api/notifications/advanced${query}`, { method: 'GET' });
  },

  // Queue Status API (Part 21) - 2 methods
  getQueueStatus: () => apiCall('/api/queue/status', { method: 'GET' }),
  getQueueJobs: (status: string) =>
    apiCall(`/api/queue/jobs?status=${status}`, { method: 'GET' }),

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

export const api = {
  stackA,
  stackB,
};
```

### Task 2: Verify Module Resolution Configuration

Check and update if necessary:

**File: `tsconfig.json`**
Ensure the paths configuration includes:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**File: `jest.config.js` or `jest.config.ts`**
Ensure moduleNameMapper includes:

```javascript
module.exports = {
  // ...existing config
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

### Task 3: Fix `hooks/use-api-client-example.ts`

Review the entire file and fix all unused variable declarations:

**Strategy:**

1. Search for all variables that are "declared but never read"
2. For each unused variable, determine if it should be:
   - **Option A**: Removed entirely (if truly unused)
   - **Option B**: Prefixed with underscore (if intentionally unused): `_variableName`
   - **Option C**: Actually implemented (if it's meant to be used but the code is incomplete)

**Specific Issues to Address:**

- Line 61: `unsubscribeNotificationsRef` - determine usage or remove
- Line 136: `setupRealTimeNotifications` - determine usage or remove
- Line 332: `setNotifications` - determine usage or remove

**Important**: Use TypeScript's convention of prefixing intentionally unused variables with underscore: `_variableName`

### Task 4: Validation

After implementing changes:

1. **Verify Module Creation**

   ```bash
   ls -la lib/api/index.ts
   ```

2. **Run Type Check**

   ```bash
   npm run type-check
   # or
   npx tsc --noEmit
   ```

3. **Run Tests**

   ```bash
   npm test
   ```

4. **Run Build**
   ```bash
   npm run build
   ```

## Success Criteria

✅ **All of these must pass:**

1. `lib/api/index.ts` file exists and exports `api` object with `stackA` and `stackB` properties
2. TypeScript compilation completes without errors
3. All 41+ test files can resolve `@/lib/api` import
4. No "declared but never read" TypeScript errors in any file
5. `npm run build` completes successfully
6. Stack A tests pass (Stack B tests may fail with expected 404 errors)

## Important Notes

- **DO NOT** introduce new TypeScript errors while fixing existing ones
- **DO NOT** skip validation steps
- **DO NOT** make partial fixes - complete each phase before moving to the next
- **DO** test after each major change
- **DO** use systematic approach: create module → configure paths → fix TypeScript → validate

## Expected Outcome

After this refactor:

- ✅ All module resolution errors resolved
- ✅ TypeScript strict mode compliance achieved
- ✅ Build pipeline passes
- ✅ Test suite can execute (Stack A passes, Stack B expected 404s)
- ✅ CI/CD pipeline turns green

## Reference Information

- **Branch**: `claude/monolith-to-microservices-XtABN`
- **Failing PR**: #282
- **Failed Job IDs**: 60827498067, 60829335438, 60830161125
- **Core Files to Modify**:
  - `lib/api/index.ts` (CREATE)
  - `hooks/use-api-client-example.ts` (FIX)
  - `jest.config.js` or `jest.config.ts` (VERIFY/UPDATE)
  - `tsconfig.json` (VERIFY/UPDATE)

---

## Execution Command

Execute this refactoring systematically, phase by phase, with validation after each phase. Report any issues immediately rather than proceeding to the next phase.
