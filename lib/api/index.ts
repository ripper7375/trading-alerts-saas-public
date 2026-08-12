/**
 * API Client -- Unified interface (Session 7-1 rewrite)
 *
 * ## SERVER-ONLY as of this session
 * `operationApi`/`moneyApi` below transitively import `next/headers` (via
 * `lib/operation-service/client.ts`'s and `lib/money-service/client.ts`'s
 * `OperationServiceError`/`MoneyServiceError` classes, which sit in the same
 * module as their `cookies()`-reading token helpers). Importing ANYTHING
 * from this file -- even a legacy `stackA` type -- into a `'use client'`
 * component will break the build: `LESSONS-LEARNED.md` L6, "a server-only
 * import anywhere in a module taints the whole module for every 'use
 * client' importer." Verified zero current importers anywhere in `app/`,
 * `components/`, or `hooks/` at Session 7-1's CONFIRM (this file has had no
 * live consumers since `app/test-api/page.tsx`, its only prior caller, was
 * deleted at Session 6-12) -- so nothing breaks today, but any future
 * consumer of this file must be a route handler or server component, never
 * client-side.
 *
 * ## New (Session 7-1): operationApi / moneyApi
 * Typed clients generated from operation-service's and money-service's own
 * live OpenAPI specs (`lib/api/generated/`, emitted via `@nestjs/swagger`
 * from the real controllers -- see `operation-service/scripts/
 * generate-openapi-spec.ts` and its money-service twin). Path/method/param
 * shapes are auto-emitted and cannot silently drift from the code the way
 * `stackA`/`stackB` below did (that drift is exactly what this whole
 * session exists to fix -- see `docs/open-api-documents/
 * OPENAPI-DRIFT-REPORT-pre-phase-7.md`). Request/response BODY types are
 * currently generic (`unknown`): both services validate via Zod through a
 * custom `ZodValidationPipe`, not class-validator DTOs, so `@nestjs/
 * swagger` has nothing to introspect for body shapes -- a real, disclosed
 * limitation, not silently claimed as complete; see this session's own
 * Deviations for the follow-up options (Zod-to-OpenAPI conversion, or
 * targeted `@ApiBody()` annotation on high-value routes).
 *
 * Regenerate via `npm run generate:api-client` at the repo root (chains
 * both services' `openapi:generate` with the `openapi-typescript` codegen
 * step) whenever a controller's routes change.
 *
 * Usage (inside a route handler or server component only):
 * ```ts
 * import { createOperationApi, unwrapOperationApi, getOperationServiceToken } from '@/lib/api';
 *
 * const token = await getOperationServiceToken();
 * const client = createOperationApi(token);
 * const alert = await unwrapOperationApi(await client.GET('/alerts/{id}', { params: { path: { id } } }));
 * ```
 *
 * ### Token-* bridge audit (Decision 3, this session)
 * `operationApi` wraps operation-service's OWN routes (e.g. `/auth/2fa/
 * setup`) directly -- it has no relationship to the monolith's separate
 * `app/api/auth/token-*` bridge route FILES (Next.js route handlers, not
 * NestJS controllers, so `@nestjs/swagger` never sees them and they were
 * never candidates for inclusion in `operationApi`'s generated surface in
 * the first place). Of the monolith's 14 `token-*` bridge routes + 1
 * `[...nextauth]` catch-all, 6 (`token-2fa-{setup,verify-setup,verify,
 * status,disable,backup-codes}`) are confirmed dead code (Session 4B-22,
 * re-confirmed via a zero-consumer grep at this session's CONFIRM) --
 * flagged here for a future retirement session, not deleted now (this
 * order's own Retire section: "nothing retired this session").
 *
 * ## Legacy (broken by design, Session 7-2/7-3 retires): stackA / stackB
 *
 * Stack A:  Currently deployed endpoints (Parts 1-19)
 * Stack B: Future endpoints (Parts 20-26) - will return 404 until deployed
 *
 * @deprecated Known broken against live routes (`updateAlert()` sends `PUT`
 * where the route only accepts `PATCH`; `markNotificationAsRead()` sends
 * `PATCH /api/notifications/{id}` where the route needs
 * `POST /api/notifications/{id}/read`; `updateSettings()` sends `PATCH
 * /api/user/preferences` where the route only accepts `PUT`;
 * `stackB.getMarketData()`/`getOHLCV()` call a path shape that doesn't
 * match the one real market-data route,
 * `GET /api/market-data/channel?symbol=&timeframe=&variant=&limit=`) --
 * see `migration-stack-analysis.md`'s `lib/api/` appendix and this
 * session's own Deviation 0 for the full, re-verified mismatch list.
 * Zero real consumers as of Session 7-1. Not fixed or removed this session
 * (Session 7-2/7-3's scope, per this order's own Rules and Retire section)
 * -- kept as-is so nothing that might still reference these named exports
 * breaks, but do not build new code against `stackA`/`stackB`.
 */

export {
  createMoneyApi,
  createOperationApi,
  type MoneyApiClient,
  type MoneyApiPaths,
  type OperationApiClient,
  type OperationApiPaths,
  unwrapMoneyApi,
  unwrapOperationApi,
} from './generated';
export { getMoneyServiceToken } from '@/lib/money-service/routes';
export { getOperationServiceToken } from '@/lib/operation-service/client';

// Type definitions
export interface AlertData {
  symbol?: string;
  condition?: string;
  price?: number;
  value?: number;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface UserData {
  name?: string;
  email?: string;
  [key: string]: unknown;
}

export interface SubscriptionData {
  tier?: string;
  status?: string;
  [key: string]: unknown;
}

export interface PaymentData {
  amount: number;
  currency?: string;
  [key: string]: unknown;
}

export interface SettingsData {
  [key: string]: unknown;
}

export interface QueryParams {
  [key: string]: string | number | boolean;
}

const BASE_URL =
  typeof window !== 'undefined' ? '' : process.env['NEXT_PUBLIC_API_URL'] || '';

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
  // Alerts API (Part 11)
  getAlerts: () => apiCall('/api/alerts', { method: 'GET' }),
  createAlert: (data: AlertData) =>
    apiCall('/api/alerts', { method: 'POST', body: JSON.stringify(data) }),
  updateAlert: (id: string, data: AlertData) =>
    apiCall(`/api/alerts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAlert: (id: string) =>
    apiCall(`/api/alerts/${id}`, { method: 'DELETE' }),

  // Watchlist API removed in V8 (watchlists eliminated from the product)

  // Charts API (Part 9) - CORRECTED
  getChartData: (symbol: string) =>
    apiCall(`/api/candles/${symbol}`, { method: 'GET' }),

  // User Profile - CORRECTED
  getUser: () => apiCall('/api/user/profile', { method: 'GET' }),
  updateUser: (data: UserData) =>
    apiCall('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Subscription API (Part 4)
  getSubscription: () => apiCall('/api/subscription', { method: 'GET' }),
  updateSubscription: (data: SubscriptionData) =>
    apiCall('/api/subscription', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Notifications API (Part 15)
  getNotifications: () => apiCall('/api/notifications', { method: 'GET' }),
  markNotificationAsRead: (id: string) =>
    apiCall(`/api/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    }),

  // Admin API - CORRECTED
  getAdminStats: () => apiCall('/api/admin/analytics', { method: 'GET' }),
  getAffiliates: (params?: QueryParams) => {
    const query = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : '';
    return apiCall(`/api/admin/affiliates${query}`, { method: 'GET' });
  },

  // Billing & Payments - CORRECTED
  getBillingHistory: () => apiCall('/api/invoices', { method: 'GET' }),
  createPayment: (data: PaymentData) =>
    apiCall('/api/payments/dlocal/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Settings - CORRECTED
  getSettings: () => apiCall('/api/user/preferences', { method: 'GET' }),
  updateSettings: (data: SettingsData) =>
    apiCall('/api/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// Stack B Client - Future endpoints (will return 404 until deployed)
const stackB = {
  // Market Data API (Part 21)
  getMarketData: (symbol: string) =>
    apiCall(`/api/market-data/${symbol}`, { method: 'GET' }),
  getOHLCV: (symbol: string, timeframe: string) =>
    apiCall(`/api/market-data/${symbol}/${timeframe}`, { method: 'GET' }),

  // Confluence Scores API (Part 22)
  getConfluenceScores: (symbol: string) =>
    apiCall(`/api/confluence/${symbol}`, { method: 'GET' }),
  getConfluenceHistory: (symbol: string, timeframe: string) =>
    apiCall(`/api/confluence/${symbol}/${timeframe}/history`, {
      method: 'GET',
    }),

  // Leaderboard API (Part 23)
  getLeaderBoard: (timeframe: string) =>
    apiCall(`/api/leaderboard/${timeframe}`, { method: 'GET' }),
  getTopSymbols: (limit: number) =>
    apiCall(`/api/leaderboard/symbols?limit=${limit}`, { method: 'GET' }),
  getTopTimeframes: (limit: number) =>
    apiCall(`/api/leaderboard/timeframes?limit=${limit}`, { method: 'GET' }),

  // Surveillance API (Part 24)
  getSurveillance: () => apiCall('/api/surveillance', { method: 'GET' }),
  getSymbolsSurveillance: () =>
    apiCall('/api/surveillance/symbols', { method: 'GET' }),
  getTimeframesSurveillance: () =>
    apiCall('/api/surveillance/timeframes', { method: 'GET' }),

  // Advanced Notifications API (Part 26)
  getAdvancedNotifications: (params: QueryParams) => {
    const query = `?${new URLSearchParams(params as Record<string, string>).toString()}`;
    return apiCall(`/api/notifications/advanced${query}`, { method: 'GET' });
  },

  // Queue Status API (Part 21)
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
