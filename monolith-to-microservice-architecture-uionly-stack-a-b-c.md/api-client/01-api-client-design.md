# API Client Design Documentation

**Project:** Trading Alerts SaaS V7
**Component:** Unified API Client (`lib/api/index.ts`)
**Architecture:** Multi-Stack Microservices (Stack A + Stack B + Stack C)
**Last Updated:** 2026-01-20
**Version:** 1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Design Patterns](#design-patterns)
4. [Component Structure](#component-structure)
5. [Type System](#type-system)
6. [Error Handling](#error-handling)
7. [Security Considerations](#security-considerations)
8. [Performance Optimizations](#performance-optimizations)
9. [Testing Strategy](#testing-strategy)
10. [Future Extensibility](#future-extensibility)

---

## Overview

### Purpose

The API Client provides a **unified, type-safe interface** for frontend components to communicate with multiple backend stacks without needing to know the underlying microservices architecture.

### Key Objectives

1. **Abstraction** - Hide backend complexity from frontend components
2. **Type Safety** - Leverage TypeScript for compile-time error detection
3. **Maintainability** - Single source of truth for all API interactions
4. **Extensibility** - Easy to add new stacks (Stack C, Stack D, etc.)
5. **Testability** - Mockable interface for unit and integration tests
6. **Performance** - Efficient HTTP calls with minimal overhead

### Architecture Context

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Unified API Client (lib/api/index.ts)         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │   Stack A    │  │   Stack B    │  │   Stack C    │    │ │
│  │  │   Client     │  │   Client     │  │   Client     │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Microservices                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Stack A    │  │   Stack B    │  │   Stack C    │          │
│  │  Parts 1-19  │  │  Parts 20-26 │  │ Parts 27-33  │          │
│  │  (Deployed)  │  │   (Future)   │  │   (Future)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Principles

### 1. Single Responsibility Principle (SRP)

Each stack client (`stackA`, `stackB`, `stackC`) is responsible **only** for its own endpoints:

```typescript
// ✅ GOOD: Each stack handles its own domain
const stackA = {
  getAlerts: () => apiCall('/api/alerts'), // Alerts domain
  getWatchlist: () => apiCall('/api/watchlist'), // Watchlist domain
};

const stackB = {
  getLeaderBoard: () => apiCall('/api/leaderboard/H4'), // Leaderboard domain
  getMarketData: () => apiCall('/api/market-data/...'), // Market data domain
};

// ❌ BAD: Mixing domains across stacks
const stackA = {
  getAlerts: () => apiCall('/api/alerts'),
  getLeaderBoard: () => apiCall('/api/leaderboard/H4'), // Wrong! Belongs to Stack B
};
```

### 2. Open/Closed Principle (OCP)

The API Client is **open for extension** (adding new stacks) but **closed for modification** (existing stacks don't change):

```typescript
// Adding Stack C doesn't require modifying Stack A or Stack B
const stackC = {
  getSocialTrading: () => apiCall('/api/social-trading'),
  getCopyTrade: () => apiCall('/api/copy-trade'),
};

export const api = {
  stackA,
  stackB,
  stackC, // ✅ Extension, not modification
};
```

### 3. Dependency Inversion Principle (DIP)

Frontend components depend on the **API Client abstraction**, not concrete HTTP implementations:

```typescript
// ✅ GOOD: Component depends on abstraction
import { api } from '@/lib/api';

function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    api.stackA.getAlerts().then(setAlerts); // Clean abstraction
  }, []);
}

// ❌ BAD: Component depends on concrete implementation
function AlertsPage() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetch('/api/alerts')
      .then((res) => res.json())
      .then(setAlerts); // Tightly coupled to fetch
  }, []);
}
```

### 4. Interface Segregation Principle (ISP)

Clients (components) only see the methods they need:

```typescript
// Alert component only needs alert methods
const { getAlerts, createAlert } = api.stackA;

// Leaderboard component only needs leaderboard methods
const { getLeaderBoard } = api.stackB;
```

### 5. Don't Repeat Yourself (DRY)

Common logic (headers, error handling, base URL) is centralized in the `apiCall` helper:

```typescript
// ✅ GOOD: Reusable helper
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

// All methods reuse this helper
const stackA = {
  getAlerts: () => apiCall('/api/alerts', { method: 'GET' }),
  createAlert: (data) =>
    apiCall('/api/alerts', { method: 'POST', body: JSON.stringify(data) }),
};
```

---

## Design Patterns

### 1. Facade Pattern

The API Client acts as a **facade** that simplifies complex backend interactions:

```
Frontend Component
       ↓
   API Client (Facade)
       ↓
┌──────┴──────────────┬─────────────┐
│                     │             │
Stack A API       Stack B API   Stack C API
```

**Benefits:**

- Components don't need to know about multiple stacks
- Consistent interface regardless of backend complexity
- Easy to swap implementations without affecting components

### 2. Factory Pattern

Stack clients are created using a factory-like approach:

```typescript
// Factory function for creating stack clients
function createStackClient(endpoints) {
  return Object.keys(endpoints).reduce((client, key) => {
    client[key] = (...args) => apiCall(endpoints[key](...args));
    return client;
  }, {});
}

// Usage (simplified concept)
const stackA = createStackClient({
  getAlerts: () => '/api/alerts',
  createAlert: (data) => ({
    endpoint: '/api/alerts',
    method: 'POST',
    body: data,
  }),
});
```

### 3. Strategy Pattern

Different HTTP methods (GET, POST, PUT, DELETE) are handled as strategies:

```typescript
// Strategy 1: GET request
getAlerts: () => apiCall('/api/alerts', { method: 'GET' });

// Strategy 2: POST request
createAlert: (data: AlertData) =>
  apiCall('/api/alerts', { method: 'POST', body: JSON.stringify(data) });

// Strategy 3: PUT request
updateAlert: (id: string, data: AlertData) =>
  apiCall(`/api/alerts/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// Strategy 4: DELETE request
deleteAlert: (id: string) => apiCall(`/api/alerts/${id}`, { method: 'DELETE' });
```

### 4. Proxy Pattern

The API Client acts as a proxy between frontend and backend:

```
Component → [API Client Proxy] → Backend API
           ↑
           │ Handles:
           │ - Authentication headers
           │ - Error transformation
           │ - Response parsing
           │ - Type validation
```

---

## Component Structure

### File Organization

```
lib/api/
├── index.ts              # Main API Client (entry point)
├── types.ts              # Type definitions (future)
├── interceptors.ts       # Request/Response interceptors (future)
├── stack-a-client.ts     # Stack A specific client (future refactor)
├── stack-b-client.ts     # Stack B specific client (future refactor)
└── utils/
    ├── error-handler.ts  # Centralized error handling (future)
    └── retry.ts          # Retry logic for failed requests (future)
```

### Current Structure (v1.0.0)

```typescript
/**
 * lib/api/index.ts
 */

// 1. Type Definitions (Lines 8-47)
interface AlertData { ... }
interface WatchlistData { ... }
interface UserData { ... }
interface SubscriptionData { ... }
interface PaymentData { ... }
interface SettingsData { ... }
interface QueryParams { ... }

// 2. Configuration (Lines 49-50)
const BASE_URL = typeof window !== 'undefined' ? '' : process.env['NEXT_PUBLIC_API_URL'] || '';

// 3. Helper Functions (Lines 52-70)
async function apiCall(endpoint: string, options: RequestInit = {}) { ... }

// 4. Stack A Client (Lines 72-142)
const stackA = {
  // Alerts API (4 methods)
  // Watchlist API (3 methods)
  // Charts API (1 method)
  // User Profile (2 methods)
  // Subscription (2 methods)
  // Notifications (2 methods)
  // Admin (2 methods)
  // Billing (2 methods)
  // Settings (2 methods)
  // Total: 19 methods
};

// 5. Stack B Client (Lines 144-199)
const stackB = {
  // Market Data API (2 methods)
  // Confluence Scores API (2 methods)
  // Leaderboard API (3 methods)
  // Surveillance API (3 methods)
  // Advanced Notifications API (1 method)
  // Queue Status API (2 methods)
  // WebSocket methods (3 placeholders)
  // SSE methods (1 placeholder)
  // Total: 17 methods
};

// 6. Export (Lines 201-204)
export const api = {
  stackA,
  stackB,
};
```

---

## Type System

### Type Safety Goals

1. **Zero `any` types** - Every parameter and return type is explicitly typed
2. **Compile-time validation** - TypeScript catches errors before runtime
3. **IDE autocomplete** - IntelliSense shows available methods and parameters
4. **Refactoring safety** - Changes cascade through the codebase

### Type Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                   API Client Types                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Request Data Types (Input)                            │
│  ├── AlertData                                         │
│  ├── WatchlistData                                     │
│  ├── UserData                                          │
│  ├── SubscriptionData                                  │
│  ├── PaymentData                                       │
│  ├── SettingsData                                      │
│  └── QueryParams                                       │
│                                                         │
│  Response Data Types (Output)                          │
│  ├── Alert[]                                           │
│  ├── Watchlist[]                                       │
│  ├── User                                              │
│  ├── Subscription                                      │
│  ├── Notification[]                                    │
│  └── ... (inferred from Prisma schema)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Type Definitions

#### Request Types (Input)

```typescript
// Flexible input - allows extra properties via index signature
interface AlertData {
  symbol?: string; // Required fields are explicit
  condition?: string;
  price?: number;
  value?: number;
  enabled?: boolean;
  [key: string]: unknown; // Allow extra properties for extensibility
}

interface WatchlistData {
  symbol: string; // This is required (no ?)
  [key: string]: unknown;
}

interface UserData {
  name?: string;
  email?: string;
  [key: string]: unknown;
}

interface SubscriptionData {
  tier?: string;
  status?: string;
  [key: string]: unknown;
}

interface PaymentData {
  amount: number; // Required
  currency?: string;
  [key: string]: unknown;
}

interface SettingsData {
  [key: string]: unknown; // Fully flexible
}

interface QueryParams {
  [key: string]: string | number | boolean; // Query params only allow primitives
}
```

**Design Rationale:**

- `[key: string]: unknown` allows for **extensibility** without breaking existing code
- Optional fields (`?`) allow partial updates
- Required fields (no `?`) enforce critical data
- `unknown` instead of `any` for type safety

#### Response Types (Inferred)

Response types are **inferred** from Prisma schema or API responses:

```typescript
// TypeScript infers the return type
const alerts = await api.stackA.getAlerts();
// alerts: Alert[] (inferred from Prisma schema)

const user = await api.stackA.getUser();
// user: User (inferred from Prisma schema)
```

**Future Enhancement:** Explicit response types from OpenAPI spec:

```typescript
// Future: Import from generated OpenAPI types
import type { Alert, User, Subscription } from '@/lib/types/api';

const stackA = {
  getAlerts: (): Promise<Alert[]> => apiCall('/api/alerts'),
  getUser: (): Promise<User> => apiCall('/api/user/profile'),
  getSubscription: (): Promise<Subscription> => apiCall('/api/subscription'),
};
```

---

## Error Handling

### Error Handling Strategy

```
┌──────────────────────────────────────────────────────────┐
│                 Error Handling Flow                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  1. HTTP Error (response.ok === false)                  │
│     ├─ 400 Bad Request → Validation error               │
│     ├─ 401 Unauthorized → Redirect to /sign-in          │
│     ├─ 403 Forbidden → Tier upgrade required            │
│     ├─ 404 Not Found → Endpoint doesn't exist           │
│     ├─ 429 Too Many Requests → Rate limited             │
│     └─ 500 Server Error → Retry with exponential backoff│
│                                                          │
│  2. Network Error (fetch throws)                        │
│     └─ Retry 3 times with exponential backoff           │
│                                                          │
│  3. Parse Error (JSON.parse fails)                      │
│     └─ Return raw response text                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Current Implementation

```typescript
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    // Try to parse error response
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));

    // Throw with descriptive message
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}
```

### Future Enhancement: Custom Error Classes

```typescript
// Future: lib/api/errors.ts
export class ApiError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class AuthError extends ApiError {
  constructor(endpoint: string) {
    super(401, endpoint, 'Unauthorized - Please sign in');
    this.name = 'AuthError';
  }
}

export class ValidationError extends ApiError {
  constructor(endpoint: string, errors: Record<string, string>) {
    super(400, endpoint, 'Validation failed', errors);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ApiError {
  constructor(endpoint: string, retryAfter: number) {
    super(429, endpoint, `Rate limited - Retry after ${retryAfter}s`, {
      retryAfter,
    });
    this.name = 'RateLimitError';
  }
}
```

---

## Security Considerations

### 1. Environment Variables

```typescript
// ✅ SECURE: Use bracket notation for strict TypeScript
const BASE_URL =
  typeof window !== 'undefined' ? '' : process.env['NEXT_PUBLIC_API_URL'] || '';
```

### 2. Authentication Headers

**Current:** Session-based auth (handled by Next.js middleware)

**Future Enhancement:** Add auth token to requests:

```typescript
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const session = await getSession(); // Get from NextAuth

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(session?.accessToken && {
        Authorization: `Bearer ${session.accessToken}`,
      }),
      ...options.headers,
    },
    ...options,
  });

  // ... rest of implementation
}
```

### 3. CSRF Protection

For mutations (POST, PUT, DELETE), include CSRF token:

```typescript
// Future enhancement
const csrfToken = await getCsrfToken();

const response = await fetch(`${BASE_URL}${endpoint}`, {
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
    ...options.headers,
  },
  ...options,
});
```

### 4. Input Sanitization

Always sanitize user input before sending to API:

```typescript
// ✅ GOOD: Sanitize before sending
const data = {
  symbol: sanitize(userInput.symbol),
  value: Number(userInput.value),
};
await api.stackA.createAlert(data);

// ❌ BAD: Send raw user input
await api.stackA.createAlert(userInput); // Potential XSS or injection
```

---

## Performance Optimizations

### 1. Parallel Requests

Use `Promise.all()` for independent requests:

```typescript
// ✅ GOOD: Parallel requests (faster)
const [alerts, watchlist, user] = await Promise.all([
  api.stackA.getAlerts(),
  api.stackA.getWatchlist(),
  api.stackA.getUser(),
]);

// ❌ BAD: Sequential requests (slower)
const alerts = await api.stackA.getAlerts();
const watchlist = await api.stackA.getWatchlist();
const user = await api.stackA.getUser();
```

### 2. Request Caching (Future)

Implement cache for GET requests:

```typescript
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const cacheKey = `${options.method || 'GET'}:${endpoint}`;

  // Check cache for GET requests
  if (options.method === 'GET' || !options.method) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  const data = await fetch(/* ... */);

  // Cache GET responses
  if (options.method === 'GET' || !options.method) {
    cache.set(cacheKey, { data, timestamp: Date.now() });
  }

  return data;
}
```

### 3. Request Deduplication (Future)

Prevent duplicate simultaneous requests:

```typescript
const pendingRequests = new Map<string, Promise<any>>();

async function apiCall(endpoint: string, options: RequestInit = {}) {
  const requestKey = `${options.method || 'GET'}:${endpoint}`;

  // Return existing promise if request is pending
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }

  const promise = fetch(/* ... */).finally(() => {
    pendingRequests.delete(requestKey);
  });

  pendingRequests.set(requestKey, promise);
  return promise;
}
```

---

## Testing Strategy

### 1. Unit Tests

Test individual methods in isolation:

```typescript
describe('Stack A Client', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('should call GET /api/alerts', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 1, symbol: 'XAUUSD' }],
    });

    const alerts = await api.stackA.getAlerts();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/alerts',
      expect.objectContaining({ method: 'GET' })
    );
    expect(alerts).toEqual([{ id: 1, symbol: 'XAUUSD' }]);
  });
});
```

### 2. Integration Tests

Test multiple methods together:

```typescript
it('should load dashboard data in parallel', async () => {
  // Mock responses
  setupMocks();

  const [alerts, watchlist, user] = await Promise.all([
    api.stackA.getAlerts(),
    api.stackA.getWatchlist(),
    api.stackA.getUser(),
  ]);

  expect(alerts).toBeDefined();
  expect(watchlist).toBeDefined();
  expect(user).toBeDefined();
});
```

### 3. E2E Tests

Test from UI to API:

```typescript
test('user can create alert', async ({ page }) => {
  await page.goto('/alerts');
  await page.click('[data-testid="create-alert-button"]');
  await page.fill('[name="symbol"]', 'XAUUSD');
  await page.click('[type="submit"]');

  await expect(page.locator('[data-testid="alert-created"]')).toBeVisible();
});
```

---

## Future Extensibility

### Adding Stack C

```typescript
// Step 1: Define Stack C types
interface SocialTradingData {
  strategyId: string;
  followAmount: number;
  [key: string]: unknown;
}

// Step 2: Create Stack C client
const stackC = {
  // Social Trading API
  getSocialStrategies: () => apiCall('/api/social-trading/strategies'),
  followStrategy: (data: SocialTradingData) =>
    apiCall('/api/social-trading/follow', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Copy Trading API
  getCopyTrades: () => apiCall('/api/copy-trading'),
  createCopyTrade: (data: unknown) =>
    apiCall('/api/copy-trading', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Step 3: Export
export const api = {
  stackA,
  stackB,
  stackC, // ✅ Added without modifying existing stacks
};
```

### Adding Real-Time Features

```typescript
// WebSocket support for Stack B
const stackB = {
  // ... existing methods

  // WebSocket methods
  subscribeToNotifications: (callback: (data: Notification) => void) => {
    const ws = new WebSocket(`${WS_URL}/notifications`);
    ws.onmessage = (event) => callback(JSON.parse(event.data));
    return () => ws.close();
  },

  // Server-Sent Events
  createNotificationsStream: () => {
    const eventSource = new EventSource('/api/notifications/stream');
    return eventSource;
  },
};
```

---

## Summary

### Key Design Principles

1. ✅ **Single Responsibility** - Each stack handles its own domain
2. ✅ **Type Safety** - Zero `any` types, explicit interfaces
3. ✅ **Reusability** - DRY with `apiCall` helper
4. ✅ **Extensibility** - Easy to add new stacks
5. ✅ **Testability** - Mockable interface
6. ✅ **Security** - Environment variables, auth headers, CSRF protection
7. ✅ **Performance** - Parallel requests, caching (future)
8. ✅ **Error Handling** - Centralized, descriptive errors

### Architecture Benefits

- **Frontend Simplicity** - Components use clean `api.stackA.method()` syntax
- **Backend Flexibility** - Can swap/migrate backends without affecting frontend
- **Development Speed** - TypeScript autocomplete guides developers
- **Maintenance** - Single file to update when API changes
- **Testing** - Easy to mock and test
- **Documentation** - Self-documenting with TypeScript types

---

**Next Steps:**

1. Read `02-stack-b-integration.md` to learn how to integrate Stack B
2. Read `03-api-client-updates.md` to learn how to handle API changes
3. Test the API Client using `TESTING-API-CLIENT.md`

---

**Last Updated:** 2026-01-20
**Maintained By:** Development Team
**Review Cycle:** After each major stack addition
