

# Enhanced API Client Documentation

## Overview

The enhanced API Client provides a comprehensive solution for communicating with the Trading Alerts SaaS microservice architecture, supporting both Stack A and Stack B backends.

## ⚠️ Important: Stack Availability Status

- **✅ Stack A (Parts 2-19)**: AVAILABLE NOW - All endpoints deployed and working
- **⚠️ Stack B (Parts 20-26)**: FUTURE DEPLOYMENT - Endpoints not yet available

**Current Recommendation**: Only use `api.stackA` methods in production. All `api.stackB` methods will throw 404 errors until Stack B is deployed.

## Features

✅ **Multi-Stack Routing** - Unified access to Stack A and Stack B
✅ **WebSocket Support** - Real-time bidirectional communication
✅ **Server-Sent Events (SSE)** - Server push for live updates
✅ **Automatic Retry** - Exponential backoff for 429, 503, 504 errors
✅ **Request Timeout** - Configurable timeout for all requests
✅ **Request Cancellation** - AbortController support
✅ **Type Safety** - Full TypeScript support
✅ **Connection Pooling** - Manages WebSocket connections efficiently

---

## Architecture

```
Frontend (Next.js, Vercel)
  ├─ api.stackA (StackAClient) ✅ AVAILABLE
  │   ├─ baseURL: NEXT_PUBLIC_API_A_URL or /api
  │   ├─ Parts 2-19: Alerts, Watchlist, User, Subscription, etc.
  │   └─ REST API only
  │
  └─ api.stackB (StackBClient) ⚠️ FUTURE
      ├─ baseURL: NEXT_PUBLIC_API_B_URL or fallback to Stack A
      ├─ Parts 20-26: Analytics, Real-time, Surveillance
      ├─ REST API + WebSocket + SSE
      └─ Status: NOT YET DEPLOYED (all methods will throw 404)
```

## Recent Corrections (2025-01-19)

The API Client has been updated to match the current codebase after Part 20 deletion:

### ✅ StackAClient Endpoint Corrections
- `getChartData()`: Changed from `/charts/[symbol]/[timeframe]` → `/candles/[symbol]`
- `getUser()`: Changed from `/user` → `/user/profile`
- `updateUser()`: Changed from `/user` → `/user/profile`
- `getAdminStats()`: Changed from `/admin/stats` → `/admin/analytics`
- `getBillingHistory()`: Changed from `/billing/history` → `/invoices`
- `getSettings()`: Changed from `/settings` → `/user/preferences`
- `updateSettings()`: Changed from `/settings` → `/user/preferences`
- `getDashboard()`: Removed (endpoint not yet implemented)

### ⚠️ StackBClient Status
- **All 17 methods** are marked as FUTURE (Stack B not deployed yet)
- Methods include JSDoc warnings: `⚠️ FUTURE: Stack B not deployed yet`
- Using any StackBClient method will throw 404 errors until Stack B deployment

---

## Installation

No installation needed - already included in the project.

## Environment Variables

```bash
# .env.local

# Stack A (Main CRUD operations)
NEXT_PUBLIC_API_A_URL=http://localhost:3001
# or in production:
# NEXT_PUBLIC_API_A_URL=https://trading-alerts-stack-a.railway.app

# Stack B (Analytics & Real-time)
NEXT_PUBLIC_API_B_URL=http://localhost:3002
# or in production:
# NEXT_PUBLIC_API_B_URL=https://trading-alerts-stack-b.railway.app

# If NEXT_PUBLIC_API_B_URL is not set, it falls back to NEXT_PUBLIC_API_A_URL
# If neither is set, both default to /api (Next.js API routes)
```

---

## Usage

### Basic REST API Calls

```typescript
import { api } from '@/lib/api';

// ✅ Stack A - Get alerts (WORKS NOW)
const alerts = await api.stackA.getAlerts();

// ✅ Stack A - Get watchlist (WORKS NOW)
const watchlist = await api.stackA.getWatchlist();

// ✅ Stack A - Get user profile (WORKS NOW)
const user = await api.stackA.getUser();

// ⚠️ Stack B - NOT YET AVAILABLE (will throw 404)
// const leaderboard = await api.stackB.getLeaderBoard('H4'); // DON'T USE YET

// ✅ Parallel requests to Stack A (WORKS NOW)
const [alerts, watchlist, subscription] = await Promise.all([
  api.stackA.getAlerts(),
  api.stackA.getWatchlist(),
  api.stackA.getSubscription()
]);
```

### WebSocket (Real-time)

⚠️ **WebSocket features are NOT YET AVAILABLE** (Stack B not deployed)

```typescript
import { api } from '@/lib/api';

// ⚠️ DON'T USE YET - Stack B not deployed
// This will fail with WebSocket connection error

// Subscribe to real-time notifications (FUTURE)
// const unsubscribe = api.stackB.subscribeToNotifications(
//   (notification) => {
//     console.log('New notification:', notification);
//   },
//   {
//     reconnect: true,
//     onError: (error) => {
//       console.error('WebSocket error:', error);
//     },
//     onClose: (event) => {
//       console.log('WebSocket closed:', event.code);
//     }
//   }
// );
```

### Server-Sent Events (SSE)

⚠️ **SSE features are NOT YET AVAILABLE** (Stack B not deployed)

```typescript
import { api } from '@/lib/api';

// ⚠️ DON'T USE YET - Stack B not deployed
// This will fail with connection error

// Create SSE connection (FUTURE)
// const eventSource = api.stackB.createNotificationsStream();
// eventSource.onmessage = (event) => {
//   const notification = JSON.parse(event.data);
//   console.log('SSE notification:', notification);
// };
```

### Request Timeout

```typescript
import { api } from '@/lib/api';

// Request with 10 second timeout
try {
  const data = await api.stackA.get('/slow-endpoint', {
    timeout: 10000 // 10 seconds
  });
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Request timed out');
  }
}
```

### Request Cancellation

```typescript
import { api } from '@/lib/api';

// Create AbortController
const controller = new AbortController();

// Start request
const promise = api.stackA.get('/endpoint', {
  signal: controller.signal
});

// Cancel request (e.g., on component unmount)
controller.abort();

// Handle cancellation
try {
  const data = await promise;
} catch (error) {
  if (error.message.includes('cancelled')) {
    console.log('Request was cancelled');
  }
}
```

### Custom Retry Configuration

```typescript
import { api } from '@/lib/api';

// Override default retry config for specific request
const data = await api.stackB.get('/endpoint', {
  retry: {
    maxRetries: 5,        // Default: 3
    retryDelay: 2000,     // Default: 1000ms
    backoff: 'linear',    // Default: 'exponential'
    retryOn: [429, 500, 502, 503, 504] // Default: [429, 503, 504]
  }
});
```

---

## React Hook Examples

### Example 1: Load data from Stack A

```typescript
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

function useDashboardData() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // ✅ Only Stack A endpoints (all work now)
        const [alerts, watchlist, notifications] = await Promise.all([
          api.stackA.getAlerts(),
          api.stackA.getWatchlist(),
          api.stackA.getNotifications()
        ]);

        setData({ alerts, watchlist, notifications });
      } catch (error) {
        console.error('Failed to load:', error);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  return { data, isLoading };
}
```

### Example 2: Real-time notifications (FUTURE)

⚠️ **This example will NOT work until Stack B is deployed**

```typescript
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

// ⚠️ DON'T USE YET - Stack B WebSocket not available
// function useRealTimeNotifications() {
//   const [notifications, setNotifications] = useState([]);
//
//   useEffect(() => {
//     // Subscribe to WebSocket (FUTURE - Stack B)
//     const unsubscribe = api.stackB.subscribeToNotifications(
//       (notification) => {
//         setNotifications(prev => [notification, ...prev]);
//       },
//       { reconnect: true }
//     );
//
//     // Cleanup on unmount
//     return () => {
//       unsubscribe();
//     };
//   }, []);
//
//   return { notifications };
// }

// ✅ USE THIS INSTEAD - Poll Stack A notifications
function usePollingNotifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const data = await api.stackA.getNotifications();
        setNotifications(data);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    }

    // Initial fetch
    fetchNotifications();

    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  return { notifications };
}
```

### Example 3: Cancellable request

```typescript
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';

function useCancellableRequest(endpoint: string) {
  const [data, setData] = useState(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;

    async function load() {
      try {
        const result = await api.stackA.get(endpoint, {
          signal: controller.signal,
          timeout: 10000
        });
        setData(result);
      } catch (error) {
        if (!error.message.includes('cancelled')) {
          console.error('Request error:', error);
        }
      }
    }

    load();

    // Cancel on unmount
    return () => {
      controller.abort();
    };
  }, [endpoint]);

  return { data };
}
```

---

## API Reference

### StackAClient Methods

| Method | Description | Example |
|--------|-------------|---------|
| `getAlerts()` | Get user alerts | `api.stackA.getAlerts()` |
| `createAlert(data)` | Create new alert | `api.stackA.createAlert({ symbol: 'XAUUSD' })` |
| `updateAlert(id, data)` | Update alert | `api.stackA.updateAlert('123', { active: false })` |
| `deleteAlert(id)` | Delete alert | `api.stackA.deleteAlert('123')` |
| `getWatchlist()` | Get watchlist | `api.stackA.getWatchlist()` |
| `addToWatchlist(data)` | Add to watchlist | `api.stackA.addToWatchlist({ symbol: 'BTCUSD' })` |
| `removeFromWatchlist(id)` | Remove from watchlist | `api.stackA.removeFromWatchlist('123')` |
| `getDashboard()` | Get dashboard data | `api.stackA.getDashboard()` |
| `getChartData(symbol, tf)` | Get chart data | `api.stackA.getChartData('XAUUSD', 'H1')` |
| `getUser()` | Get user profile | `api.stackA.getUser()` |
| `updateUser(data)` | Update user profile | `api.stackA.updateUser({ name: 'John' })` |
| `getSubscription()` | Get subscription | `api.stackA.getSubscription()` |
| `getNotifications()` | Get basic notifications | `api.stackA.getNotifications()` |
| `getAdminStats()` | Get admin stats | `api.stackA.getAdminStats()` |

### StackBClient Methods

| Method | Description | Example |
|--------|-------------|---------|
| `getMarketData(symbol)` | Get market data | `api.stackB.getMarketData('XAUUSD')` |
| `getOHLCV(symbol, tf)` | Get OHLCV data | `api.stackB.getOHLCV('XAUUSD', 'H1')` |
| `getConfluenceScores(symbol)` | Get confluence scores | `api.stackB.getConfluenceScores('XAUUSD')` |
| `getLeaderBoard(timeframe)` | Get leaderboard | `api.stackB.getLeaderBoard('H4')` |
| `getTopSymbols(limit)` | Get top symbols | `api.stackB.getTopSymbols(10)` |
| `getSurveillance()` | Get surveillance data | `api.stackB.getSurveillance()` |
| `getSymbolsSurveillance()` | Get symbols under surveillance | `api.stackB.getSymbolsSurveillance()` |
| `getAdvancedNotifications()` | Get advanced notifications | `api.stackB.getAdvancedNotifications()` |
| `subscribeToNotifications(cb)` | Subscribe to real-time notifications (WS) | See WebSocket section |
| `subscribeToMarketData(symbol, cb)` | Subscribe to market data (WS) | See WebSocket section |
| `subscribeToLeaderBoard(tf, cb)` | Subscribe to leaderboard (WS) | See WebSocket section |
| `createNotificationsStream()` | Create SSE connection | See SSE section |
| `getQueueStatus()` | Get queue status | `api.stackB.getQueueStatus()` |

### Common Methods (Both Clients)

| Method | Description | Example |
|--------|-------------|---------|
| `get(endpoint, options)` | GET request | `client.get('/endpoint', { timeout: 5000 })` |
| `post(endpoint, data, options)` | POST request | `client.post('/endpoint', { data })` |
| `put(endpoint, data, options)` | PUT request | `client.put('/endpoint', { data })` |
| `patch(endpoint, data, options)` | PATCH request | `client.patch('/endpoint', { data })` |
| `delete(endpoint, options)` | DELETE request | `client.delete('/endpoint')` |
| `getBaseURL()` | Get base URL | `client.getBaseURL()` |
| `isExternalAPI()` | Check if external API | `client.isExternalAPI()` |
| `disconnectAll()` | Disconnect all WebSockets | `client.disconnectAll()` |

---

## Error Handling

```typescript
import { api, ApiError } from '@/lib/api';

try {
  const data = await api.stackA.getAlerts();
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message);
    console.error('Status:', error.status);
    console.error('Data:', error.data);

    // Handle specific status codes
    if (error.status === 429) {
      console.log('Rate limited - request will auto-retry');
    } else if (error.status === 401) {
      console.log('Unauthorized - redirect to login');
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Retry Logic

The client automatically retries requests on:
- **429** - Rate Limiting (respects Retry-After header)
- **503** - Service Unavailable
- **504** - Gateway Timeout

**Default retry configuration:**
```typescript
{
  maxRetries: 3,
  retryDelay: 1000, // 1 second base delay
  retryOn: [429, 503, 504],
  backoff: 'exponential' // 1s, 2s, 4s, 8s...
}
```

**Exponential backoff:**
- Attempt 0: immediate
- Attempt 1: wait 1s (1000 * 2^0)
- Attempt 2: wait 2s (1000 * 2^1)
- Attempt 3: wait 4s (1000 * 2^2)

---

## WebSocket Connection Management

```typescript
// WebSocket connections are pooled per endpoint
// Attempting to subscribe twice to the same endpoint will reuse connection

// Subscribe
const unsubscribe1 = api.stackB.subscribeToNotifications(callback1);
const unsubscribe2 = api.stackB.subscribeToNotifications(callback2); // ⚠️ Warning: already subscribed

// Unsubscribe
unsubscribe1(); // Closes WebSocket

// Disconnect all
api.disconnectAll(); // Closes all WebSocket connections
```

---

## Best Practices

### 1. Always cleanup in useEffect

```typescript
useEffect(() => {
  const unsubscribe = api.stackB.subscribeToNotifications(callback);

  return () => {
    unsubscribe(); // ✅ Always cleanup
  };
}, []);
```

### 2. Use AbortController for cancellable requests

```typescript
useEffect(() => {
  const controller = new AbortController();

  fetchData(controller.signal);

  return () => {
    controller.abort(); // ✅ Cancel on unmount
  };
}, []);
```

### 3. Handle errors gracefully

```typescript
try {
  const data = await api.stackA.getAlerts();
} catch (error) {
  if (error instanceof ApiError) {
    // Show user-friendly error message
    toast.error(error.message);
  }
}
```

### 4. Use parallel requests when possible

```typescript
// ✅ Good - parallel (fast)
const [alerts, leaderboard] = await Promise.all([
  api.stackA.getAlerts(),
  api.stackB.getLeaderBoard('H4')
]);

// ❌ Bad - sequential (slow)
const alerts = await api.stackA.getAlerts();
const leaderboard = await api.stackB.getLeaderBoard('H4');
```

### 5. Set appropriate timeouts

```typescript
// Short timeout for quick operations
await api.stackA.getUser({ timeout: 5000 });

// Longer timeout for heavy computations
await api.stackB.getConfluenceScores('XAUUSD', { timeout: 30000 });
```

---

## Migration Guide

### From old apiClient to new api

**Before:**
```typescript
import { apiClient } from '@/lib/api-client';

const alerts = await apiClient.get('/alerts');
```

**After:**
```typescript
import { api } from '@/lib/api';

// Use specific stack
const alerts = await api.stackA.getAlerts();

// Or generic method
const alerts = await api.stackA.get('/alerts');
```

### Backward Compatibility

The old `apiClient` singleton still exists for backward compatibility:

```typescript
import { apiClient } from '@/lib/api-client';

// Still works
const data = await apiClient.get('/endpoint');
```

---

## Troubleshooting

### WebSocket not connecting

1. Check baseURL is correct
2. Ensure backend supports WebSocket
3. Check CORS configuration
4. Verify WebSocket endpoint exists

### Requests timing out

1. Increase timeout: `{ timeout: 60000 }`
2. Check network connection
3. Verify backend is responding

### Rate limiting (429 errors)

- Requests will automatically retry after the `Retry-After` period
- Check backend rate limit configuration
- Consider implementing request throttling on frontend

---

## Performance Tips

1. **Use WebSocket for frequent updates** instead of polling
2. **Enable auto-reconnect** for WebSocket connections
3. **Batch requests** when possible with `Promise.all()`
4. **Set reasonable timeouts** to avoid hanging requests
5. **Close unused WebSocket connections** with `unsubscribe()`

---

## Support

For issues or questions:
- Check the MULTI-BACKEND-SYNC-STRATEGY.md documentation
- Review example hooks in `/hooks/use-api-client-example.ts`
- Test with development logging enabled (NODE_ENV=development)

---

**Last Updated:** 2025-01-19
**Version:** 2.0.0 (Enhanced with WebSocket, SSE, Retry, Timeout, Cancellation)
