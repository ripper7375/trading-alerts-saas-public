/**
 * API Client - Unified interface for Stack A and Stack B endpoints
 *
 * Stack A:  Currently deployed endpoints (Parts 1-19)
 * Stack B: Future endpoints (Parts 20-26) - will return 404 until deployed
 */

// Type definitions
interface AlertData {
  symbol?: string;
  condition?: string;
  price?: number;
  value?: number;
  enabled?: boolean;
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
  amount: number;
  currency?: string;
  [key: string]: unknown;
}

interface SettingsData {
  [key: string]: unknown;
}

interface QueryParams {
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
