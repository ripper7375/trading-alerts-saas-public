# API Client Updates & Maintenance Guide

**Project:** Trading Alerts SaaS V7
**Component:** API Client Modification Procedures
**Architecture:** Multi-Stack Microservices
**Last Updated:** 2026-01-20
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Change Types](#change-types)
3. [Update Procedures](#update-procedures)
4. [Stack A Modifications](#stack-a-modifications)
5. [Stack B Modifications](#stack-b-modifications)
6. [Cross-Stack Changes](#cross-stack-changes)
7. [Breaking Changes](#breaking-changes)
8. [Version Management](#version-management)
9. [Testing After Updates](#testing-after-updates)
10. [Deployment Workflow](#deployment-workflow)

---

## Overview

### Purpose

This guide provides **step-by-step procedures** for updating the API Client when backend services change. It covers:

- Adding new endpoints
- Modifying existing endpoints
- Deprecating old endpoints
- Handling breaking changes
- Version management
- Testing and deployment

### When to Update API Client

Update the API Client when:

1. ✅ **New endpoints** are added to Stack A or Stack B
2. ✅ **Endpoint URLs** change (e.g., `/api/user` → `/api/user/profile`)
3. ✅ **Request/response formats** change (new fields, renamed fields)
4. ✅ **HTTP methods** change (GET → POST, etc.)
5. ✅ **Authentication** requirements change
6. ✅ **New stacks** are added (Stack C, Stack D, etc.)
7. ✅ **Endpoints are deprecated** or removed

---

## Change Types

### 1. Non-Breaking Changes ✅ (Safe)

Changes that **don't break existing functionality**:

- **Adding new optional fields** to request types
- **Adding new response fields** (existing code ignores them)
- **Adding new endpoints** (doesn't affect existing endpoints)
- **Adding new stacks** (existing stacks unchanged)

**Example:**

```typescript
// Before
interface AlertData {
  symbol: string;
  value: number;
}

// After (non-breaking)
interface AlertData {
  symbol: string;
  value: number;
  priority?: string; // ✅ Optional field - non-breaking
}
```

### 2. Breaking Changes ❌ (Dangerous)

Changes that **break existing functionality**:

- **Removing fields** from request/response types
- **Renaming fields** without backward compatibility
- **Changing field types** (string → number)
- **Changing endpoint URLs** without redirects
- **Changing HTTP methods** (GET → POST)
- **Removing endpoints** without deprecation period

**Example:**

```typescript
// Before
interface AlertData {
  symbol: string;
  value: number;
}

// After (breaking!)
interface AlertData {
  symbol: string;
  threshold: number; // ❌ 'value' renamed to 'threshold' - BREAKING!
}
```

### 3. Deprecation Changes ⚠️ (Transition)

Changes that **mark old features for removal**:

- **Deprecation warnings** added
- **Old endpoints** still work but return warnings
- **New endpoints** available as replacements

**Example:**

```typescript
// Old endpoint (deprecated but still works)
getUser: () => {
  console.warn('⚠️ getUser() is deprecated. Use getUserProfile() instead.');
  return apiCall('/api/user', { method: 'GET' });
},

// New endpoint (recommended)
getUserProfile: () => apiCall('/api/user/profile', { method: 'GET' }),
```

---

## Update Procedures

### Procedure 1: Adding New Endpoint

**Scenario:** Backend team added `POST /api/alerts/bulk` endpoint.

#### Step 1: Review API Documentation

```bash
# Check endpoint specification
curl https://your-domain.com/api/alerts/bulk --help

# Or review OpenAPI/Swagger docs
open https://your-domain.com/api-docs
```

**Expected info:**

- Endpoint URL: `/api/alerts/bulk`
- HTTP Method: `POST`
- Request body: `{ alerts: AlertData[] }`
- Response: `{ created: number, failed: number }`
- Auth required: Yes

#### Step 2: Add Type Definition

```typescript
// lib/api/index.ts

// Add new request type
interface BulkAlertData {
  alerts: AlertData[];
}

// Add new response type (optional, can be inferred)
interface BulkAlertResponse {
  created: number;
  failed: number;
  errors?: string[];
}
```

#### Step 3: Add Method to Stack Client

```typescript
// lib/api/index.ts

const stackA = {
  // ... existing methods

  // NEW: Bulk create alerts
  createBulkAlerts: (data: BulkAlertData): Promise<BulkAlertResponse> =>
    apiCall('/api/alerts/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
```

#### Step 4: Add Tests

```typescript
// __tests__/lib/api/stack-a-client.test.ts

describe('Stack A - Alerts API', () => {
  it('should POST /api/alerts/bulk - createBulkAlerts()', async () => {
    const bulkData = {
      alerts: [
        { symbol: 'XAUUSD', value: 2000 },
        { symbol: 'EURUSD', value: 1.1 },
      ],
    };

    const mockResponse = {
      created: 2,
      failed: 0,
    };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockResponse,
    } as Response);

    const { api } = await import('@/lib/api');
    const result = await api.stackA.createBulkAlerts(bulkData);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/alerts/bulk',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(bulkData),
      })
    );
    expect(result).toEqual(mockResponse);
  });
});
```

#### Step 5: Update Documentation

```bash
# Update TESTING-API-CLIENT.md
vim TESTING-API-CLIENT.md

# Add new endpoint to the list:
# - `api.stackA.createBulkAlerts(data)` creates multiple alerts
```

#### Step 6: Commit Changes

```bash
git add lib/api/index.ts __tests__/lib/api/stack-a-client.test.ts
git commit -m "feat(api): add createBulkAlerts endpoint to Stack A

- Added BulkAlertData and BulkAlertResponse types
- Implemented createBulkAlerts method
- Added unit tests
- Updated documentation

Resolves: #123"
```

---

### Procedure 2: Modifying Existing Endpoint

**Scenario:** Backend changed `/api/user` → `/api/user/profile`.

#### Step 1: Identify Impact

```bash
# Find all usages of old endpoint
grep -r "getUser" lib/api/
grep -r "api.stackA.getUser" frontend/
grep -r "api.stackA.getUser" __tests__/
```

#### Step 2: Update API Client

```typescript
// lib/api/index.ts

const stackA = {
  // UPDATED: Changed endpoint URL
  getUser: () => apiCall('/api/user/profile', { method: 'GET' }), // Was: /api/user
  updateUser: (data: UserData) =>
    apiCall('/api/user/profile', {
      // Was: /api/user
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
```

#### Step 3: Update Tests

```typescript
// __tests__/lib/api/stack-a-client.test.ts

it('should GET /api/user/profile - getUser() ✅ UPDATED', async () => {
  // ... mock setup

  const { api } = await import('@/lib/api');
  const user = await api.stackA.getUser();

  expect(global.fetch).toHaveBeenCalledWith(
    '/api/user/profile', // ✅ UPDATED from /api/user
    expect.objectContaining({ method: 'GET' })
  );
});
```

#### Step 4: Run Tests

```bash
npm test -- __tests__/lib/api/stack-a-client.test.ts

# Verify all tests pass
```

#### Step 5: Commit

```bash
git add lib/api/index.ts __tests__/lib/api/stack-a-client.test.ts
git commit -m "fix(api): update user endpoints to /api/user/profile

Breaking change: User endpoints moved from /api/user to /api/user/profile

- Updated getUser() endpoint
- Updated updateUser() endpoint
- Updated tests
- Verified backward compatibility with backend redirects

Resolves: #124"
```

---

### Procedure 3: Changing Request/Response Types

**Scenario:** `AlertData` now requires `priority` field.

#### Step 1: Update Type Definition

```typescript
// lib/api/index.ts

// BEFORE
interface AlertData {
  symbol?: string;
  value?: number;
  [key: string]: unknown;
}

// AFTER
interface AlertData {
  symbol?: string;
  value?: number;
  priority: 'low' | 'medium' | 'high'; // ✅ Now required
  [key: string]: unknown;
}
```

#### Step 2: Check TypeScript Errors

```bash
npx tsc --noEmit

# Expected errors:
# frontend/components/AlertForm.tsx:45:10 - error TS2741:
# Property 'priority' is missing in type '{ symbol: string; value: number; }'
```

#### Step 3: Fix All Usages

```typescript
// frontend/components/AlertForm.tsx

// BEFORE
const data = {
  symbol: 'XAUUSD',
  value: 2000,
};

// AFTER
const data = {
  symbol: 'XAUUSD',
  value: 2000,
  priority: 'medium', // ✅ Added required field
};

await api.stackA.createAlert(data);
```

#### Step 4: Update Tests

```typescript
// __tests__/lib/api/stack-a-client.test.ts

it('should POST /api/alerts - createAlert()', async () => {
  const alertData = {
    symbol: 'XAUUSD',
    value: 2000,
    priority: 'high', // ✅ Added
  };

  // ... rest of test
});
```

#### Step 5: Run Full Test Suite

```bash
npm test
npm run type-check
npm run build

# Verify no errors
```

---

## Stack A Modifications

### Common Stack A Updates

| Update Type            | Frequency | Example                            |
| ---------------------- | --------- | ---------------------------------- |
| New alert endpoint     | Medium    | `POST /api/alerts/schedule`        |
| New watchlist filter   | Low       | `GET /api/watchlist?filter=active` |
| Chart timeframe added  | Low       | `GET /api/candles/:symbol?tf=M15`  |
| User settings expanded | Medium    | New fields in `SettingsData`       |
| Admin endpoint added   | Low       | `GET /api/admin/users/:id`         |

### Example: Adding New Admin Endpoint

```typescript
// lib/api/index.ts

const stackA = {
  // ... existing methods

  // Admin API - NEW ENDPOINT
  getAdminUser: (userId: string) =>
    apiCall(`/api/admin/users/${userId}`, { method: 'GET' }),

  updateAdminUser: (userId: string, data: UserData) =>
    apiCall(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAdminUser: (userId: string) =>
    apiCall(`/api/admin/users/${userId}`, { method: 'DELETE' }),
};
```

---

## Stack B Modifications

### Common Stack B Updates

| Update Type            | Frequency | Example                    |
| ---------------------- | --------- | -------------------------- |
| New market data symbol | High      | Support for crypto symbols |
| Leaderboard timeframe  | Medium    | Add M1, M5 timeframes      |
| Surveillance filters   | Medium    | Filter by symbol type      |
| WebSocket event type   | Low       | New event types            |

### Example: Adding Crypto Support to Market Data

#### Step 1: Update Type

```typescript
// lib/api/index.ts

// Add crypto symbol type
type MarketSymbol = string; // Any symbol including crypto

// Or be more specific
type MarketSymbol =
  | 'XAUUSD'
  | 'EURUSD'
  | 'GBPUSD' // Forex
  | 'BTCUSD'
  | 'ETHUSD'
  | 'BNBUSD'; // Crypto
```

#### Step 2: Update Method

```typescript
const stackB = {
  // No changes needed - already accepts any symbol
  getMarketData: (symbol: MarketSymbol) =>
    apiCall(`/api/market-data/${symbol}`, { method: 'GET' }),
};
```

#### Step 3: Update Documentation

```typescript
/**
 * Get real-time market data for a symbol
 * @param symbol - Forex pair (e.g., 'XAUUSD') or Crypto pair (e.g., 'BTCUSD')
 * @returns Market data with indicators
 * @example
 * // Forex
 * const gold = await api.stackB.getMarketData('XAUUSD');
 *
 * // Crypto
 * const bitcoin = await api.stackB.getMarketData('BTCUSD');
 */
getMarketData: (symbol: MarketSymbol) =>
  apiCall(`/api/market-data/${symbol}`, { method: 'GET' }),
```

---

## Cross-Stack Changes

### Scenario 1: Moving Endpoint from Stack A to Stack B

**Example:** `/api/notifications` moved from Stack A to Stack B.

#### Step 1: Add to Stack B

```typescript
const stackB = {
  // ... existing methods

  // Moved from Stack A
  getNotifications: () => apiCall('/api/notifications', { method: 'GET' }),
  markNotificationAsRead: (id: string) =>
    apiCall(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    }),
};
```

#### Step 2: Deprecate in Stack A

```typescript
const stackA = {
  // ... existing methods

  // DEPRECATED: Moved to Stack B
  /** @deprecated Use api.stackB.getNotifications() instead */
  getNotifications: () => {
    console.warn(
      '⚠️ api.stackA.getNotifications() is deprecated. Use api.stackB.getNotifications()'
    );
    return apiCall('/api/notifications', { method: 'GET' });
  },

  /** @deprecated Use api.stackB.markNotificationAsRead() instead */
  markNotificationAsRead: (id: string) => {
    console.warn(
      '⚠️ api.stackA.markNotificationAsRead() is deprecated. Use api.stackB.markNotificationAsRead()'
    );
    return apiCall(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
  },
};
```

#### Step 3: Update Frontend Components

```typescript
// BEFORE
const { notifications } = await api.stackA.getNotifications();

// AFTER
const { notifications } = await api.stackB.getNotifications();
```

#### Step 4: Remove Deprecated Methods (After Transition Period)

```typescript
const stackA = {
  // ... existing methods
  // ✅ Removed deprecated notification methods
};
```

---

### Scenario 2: Shared Functionality Across Stacks

**Example:** Both stacks need user profile data.

**Option A: Duplicate Method (Recommended for Independence)**

```typescript
const stackA = {
  getUser: () => apiCall('/api/user/profile', { method: 'GET' }),
};

const stackB = {
  getUser: () => apiCall('/api/user/profile', { method: 'GET' }), // Same endpoint
};
```

**Option B: Shared Method**

```typescript
// Shared methods (outside stack objects)
const shared = {
  getUser: () => apiCall('/api/user/profile', { method: 'GET' }),
};

export const api = {
  stackA: { ...stackA, ...shared },
  stackB: { ...stackB, ...shared },
  shared, // Also export separately
};
```

---

## Breaking Changes

### Handling Breaking Changes Safely

#### Strategy 1: Dual Support (Transition Period)

Support both old and new formats temporarily:

```typescript
// Support both old and new field names
interface AlertData {
  symbol?: string;
  value?: number;      // Old field
  threshold?: number;  // New field

  [key: string]: unknown;
}

// In the method, handle both
createAlert: (data: AlertData) => {
  const payload = {
    ...data,
    threshold: data.threshold ?? data.value, // Support both
  };
  return apiCall('/api/alerts', { method: 'POST', body: JSON.stringify(payload) });
},
```

#### Strategy 2: Version Prefix

Create v2 methods for breaking changes:

```typescript
const stackA = {
  // V1 (old, deprecated)
  /** @deprecated Use createAlertV2() */
  createAlert: (data: AlertDataV1) => apiCall('/api/v1/alerts', { ... }),

  // V2 (new)
  createAlertV2: (data: AlertDataV2) => apiCall('/api/v2/alerts', { ... }),
};
```

#### Strategy 3: Feature Flag

Use feature flags to control rollout:

```typescript
const USE_NEW_ALERTS_API = process.env['ENABLE_NEW_ALERTS_API'] === 'true';

const stackA = {
  createAlert: (data: AlertData) => {
    if (USE_NEW_ALERTS_API) {
      return apiCall('/api/v2/alerts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } else {
      return apiCall('/api/alerts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
  },
};
```

---

## Version Management

### Semantic Versioning for API Client

Follow Semantic Versioning (semver):

**Format:** `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (e.g., removed methods, renamed parameters)
- **MINOR**: New features (e.g., new endpoints, new optional fields)
- **PATCH**: Bug fixes (e.g., corrected endpoint URLs)

**Examples:**

- `1.0.0` → `1.1.0`: Added new `createBulkAlerts()` method (minor)
- `1.1.0` → `1.1.1`: Fixed typo in endpoint URL (patch)
- `1.1.1` → `2.0.0`: Removed deprecated methods (major)

### Update Version

```typescript
// lib/api/index.ts

/**
 * API Client Version: 2.0.0
 * Last Updated: 2026-01-20
 * Changelog:
 * - 2.0.0: Removed deprecated Stack A notification methods
 * - 1.1.0: Added bulk alerts endpoint
 * - 1.0.0: Initial release with Stack A and Stack B
 */
```

### Changelog

Maintain `CHANGELOG.md`:

````markdown
# Changelog

## [2.0.0] - 2026-01-20

### Breaking Changes

- Removed `stackA.getNotifications()` (moved to Stack B)
- Removed `stackA.markNotificationAsRead()` (moved to Stack B)

### Migration Guide

```typescript
// Before
await api.stackA.getNotifications();

// After
await api.stackB.getNotifications();
```
````

## [1.1.0] - 2026-01-15

### Added

- `stackA.createBulkAlerts()` - Bulk create alerts endpoint

## [1.0.0] - 2026-01-10

### Added

- Initial API Client with Stack A (19 methods)
- Initial API Client with Stack B (17 methods)

````

---

## Testing After Updates

### Test Checklist

After any API Client update, run this checklist:

#### 1. Unit Tests

```bash
# Test all Stack A methods
npm test -- __tests__/lib/api/stack-a-client.test.ts

# Test all Stack B methods
npm test -- __tests__/lib/api/stack-b-client.test.ts

# Test integration workflows
npm test -- __tests__/integration/api-client-workflow.test.ts
````

#### 2. Type Checking

```bash
npx tsc --noEmit

# Should show 0 errors
```

#### 3. Linting

```bash
npm run lint

# Should show 0 errors, 0 warnings
```

#### 4. Build

```bash
npm run build

# Should complete successfully
```

#### 5. Manual Testing

```bash
# Start dev server
npm run dev

# Test in browser console
# (Paste test script from TESTING-API-CLIENT.md)
```

#### 6. E2E Tests (if applicable)

```bash
npm run test:e2e
```

---

## Deployment Workflow

### Standard Deployment Process

```
┌─────────────────────────────────────────────────────────┐
│                  Deployment Workflow                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Update API Client Code                             │
│     ├─ Modify lib/api/index.ts                         │
│     ├─ Update types                                     │
│     └─ Update tests                                     │
│                                                         │
│  2. Run Local Tests                                     │
│     ├─ npm test (unit + integration)                   │
│     ├─ npm run type-check                              │
│     └─ npm run lint                                     │
│                                                         │
│  3. Commit Changes                                      │
│     └─ git commit -m "feat/fix: description"           │
│                                                         │
│  4. Push to Feature Branch                              │
│     └─ git push origin feature/api-client-update        │
│                                                         │
│  5. Create Pull Request                                 │
│     └─ Review by team                                   │
│                                                         │
│  6. Merge to Staging                                    │
│     └─ Auto-deploy to staging environment              │
│                                                         │
│  7. Test on Staging                                     │
│     └─ Smoke tests, manual QA                          │
│                                                         │
│  8. Merge to Main                                       │
│     └─ Auto-deploy to production                       │
│                                                         │
│  9. Monitor Production                                  │
│     └─ Check logs, metrics, error rates                │
│                                                         │
│  10. Rollback if Issues                                 │
│      └─ git revert or feature flag disable             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Deployment Commands

```bash
# 1. Create feature branch
git checkout -b feature/add-bulk-alerts

# 2. Make changes
vim lib/api/index.ts
vim __tests__/lib/api/stack-a-client.test.ts

# 3. Test locally
npm test
npm run type-check
npm run build

# 4. Commit
git add .
git commit -m "feat(api): add bulk alerts endpoint

- Added createBulkAlerts method
- Added BulkAlertData type
- Added tests
- Updated documentation"

# 5. Push
git push origin feature/add-bulk-alerts

# 6. Create PR (via GitHub UI)

# 7. After PR approval, merge to staging
git checkout staging
git merge feature/add-bulk-alerts
git push origin staging

# 8. Test on staging
curl https://staging.your-domain.com/api/alerts/bulk

# 9. Merge to main
git checkout main
git merge staging
git push origin main

# 10. Monitor production
# (Check Vercel logs, metrics dashboard)
```

---

## Summary

### Quick Reference

| Change Type         | Procedure                 | Testing             | Risk   |
| ------------------- | ------------------------- | ------------------- | ------ |
| Add new endpoint    | Procedure 1               | Unit tests          | Low    |
| Modify endpoint URL | Procedure 2               | Unit + Integration  | Medium |
| Change types        | Procedure 3               | Full suite          | High   |
| Add Stack C         | See Integration Guide     | E2E tests           | Medium |
| Breaking change     | Dual support / Versioning | Full suite + Manual | High   |

### Best Practices

1. ✅ **Always add tests** when updating API Client
2. ✅ **Run full test suite** before committing
3. ✅ **Update documentation** (JSDoc, README, guides)
4. ✅ **Use semantic versioning** for tracking changes
5. ✅ **Deprecate before removing** (transition period)
6. ✅ **Test on staging** before production
7. ✅ **Monitor after deployment** for errors
8. ✅ **Have rollback plan** ready

### Common Mistakes to Avoid

1. ❌ Updating endpoint without updating tests
2. ❌ Breaking changes without deprecation period
3. ❌ Forgetting to update TypeScript types
4. ❌ Not testing on staging before production
5. ❌ Removing methods without migration guide
6. ❌ Not documenting breaking changes
7. ❌ Deploying without running full test suite

---

**Next Steps:**

1. Review `01-api-client-design.md` for architecture principles
2. Review `02-stack-b-integration.md` for integration procedures
3. Bookmark this guide for future API Client updates

---

**Last Updated:** 2026-01-20
**Maintained By:** Development Team
**Review Cycle:** After each major update
