/**
 * API Helper Functions for E2E Tests
 *
 * Provides utilities for making API calls during tests.
 *
 * @module e2e/utils/api-helpers
 */

import { APIRequestContext, expect } from '@playwright/test';

/**
 * API response type
 */
interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Make authenticated API request
 */
export async function authenticatedRequest<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  options: {
    data?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
): Promise<ApiResponse<T>> {
  const response = await request.fetch(path, {
    method,
    data: options.data,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const status = response.status();
  let data: T;
  try {
    data = await response.json();
  } catch {
    data = (await response.text()) as unknown as T;
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of response.headersArray()) {
    headers[key] = value;
  }

  return { status, data, headers };
}

/**
 * Get user session info
 */
export async function getSession(
  request: APIRequestContext
): Promise<{
  user: {
    id: string;
    email: string;
    name: string;
    tier: string;
    role: string;
    isAffiliate: boolean;
  } | null;
}> {
  const response = await request.get('/api/auth/session');
  if (response.ok()) {
    return await response.json();
  }
  return { user: null };
}

/**
 * Get user's subscription status
 */
export async function getSubscription(request: APIRequestContext): Promise<{
  subscription: {
    id: string;
    status: string;
    tier: string;
    provider: string;
    expiresAt: string;
    cancelledAt: string | null;
  } | null;
}> {
  const response = await request.get('/api/subscription');
  if (response.ok()) {
    return await response.json();
  }
  return { subscription: null };
}

/**
 * Get user's alerts
 */
export async function getAlerts(request: APIRequestContext): Promise<{
  alerts: Array<{
    id: string;
    symbol: string;
    timeframe: string;
    condition: string;
    isActive: boolean;
    lastTriggered: string | null;
    triggerCount: number;
  }>;
  total: number;
}> {
  const response = await request.get('/api/alerts');
  if (response.ok()) {
    return await response.json();
  }
  return { alerts: [], total: 0 };
}

/**
 * Create an alert via API
 */
export async function createAlert(
  request: APIRequestContext,
  alertData: {
    symbol: string;
    timeframe: string;
    condition: string;
    alertType: string;
    name?: string;
  }
): Promise<{
  success: boolean;
  alert?: {
    id: string;
    symbol: string;
    timeframe: string;
  };
  error?: string;
}> {
  const response = await request.post('/api/alerts', {
    data: alertData,
  });

  if (response.ok()) {
    const data = await response.json();
    return { success: true, alert: data };
  }

  const error = await response.json();
  return { success: false, error: error.message || error.error };
}

/**
 * Delete an alert via API
 */
export async function deleteAlert(
  request: APIRequestContext,
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await request.delete(`/api/alerts/${alertId}`);

  if (response.ok()) {
    return { success: true };
  }

  const error = await response.json();
  return { success: false, error: error.message || error.error };
}

/**
 * Get user's notifications
 */
export async function getNotifications(request: APIRequestContext): Promise<{
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  }>;
  unreadCount: number;
}> {
  const response = await request.get('/api/notifications');
  if (response.ok()) {
    return await response.json();
  }
  return { notifications: [], unreadCount: 0 };
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  request: APIRequestContext,
  notificationId: string
): Promise<{ success: boolean }> {
  const response = await request.post(`/api/notifications/${notificationId}/read`);
  return { success: response.ok() };
}

/**
 * Validate discount code via API
 */
export async function validateDiscountCode(
  request: APIRequestContext,
  code: string,
  planType: string = 'MONTHLY'
): Promise<{
  valid: boolean;
  discountPercent?: number;
  message?: string;
}> {
  const response = await request.get(
    `/api/checkout/validate-code?code=${encodeURIComponent(code)}&planType=${planType}`
  );
  return await response.json();
}

/**
 * Get affiliate dashboard stats
 */
export async function getAffiliateStats(request: APIRequestContext): Promise<{
  totalEarnings: number;
  pendingCommissions: number;
  paidCommissions: number;
  totalCodesDistributed: number;
  totalCodesUsed: number;
  conversionRate: number;
}> {
  const response = await request.get('/api/affiliate/dashboard/stats');
  if (response.ok()) {
    return await response.json();
  }
  return {
    totalEarnings: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    totalCodesDistributed: 0,
    totalCodesUsed: 0,
    conversionRate: 0,
  };
}

/**
 * Get affiliate codes
 */
export async function getAffiliateCodes(request: APIRequestContext): Promise<{
  codes: Array<{
    id: string;
    code: string;
    status: string;
    discountPercent: number;
    commissionPercent: number;
    usedAt: string | null;
    expiresAt: string;
  }>;
}> {
  const response = await request.get('/api/affiliate/dashboard/codes');
  if (response.ok()) {
    return await response.json();
  }
  return { codes: [] };
}

/**
 * Get commission report
 */
export async function getCommissionReport(
  request: APIRequestContext,
  params?: { month?: string; status?: string }
): Promise<{
  commissions: Array<{
    id: string;
    grossRevenue: number;
    discountAmount: number;
    netRevenue: number;
    commissionAmount: number;
    status: string;
    earnedAt: string;
    paidAt: string | null;
  }>;
  summary: {
    totalEarnings: number;
    pendingAmount: number;
    paidAmount: number;
  };
}> {
  const queryParams = new URLSearchParams();
  if (params?.month) queryParams.set('month', params.month);
  if (params?.status) queryParams.set('status', params.status);

  const response = await request.get(
    `/api/affiliate/dashboard/commission-report?${queryParams.toString()}`
  );
  if (response.ok()) {
    return await response.json();
  }
  return {
    commissions: [],
    summary: { totalEarnings: 0, pendingAmount: 0, paidAmount: 0 },
  };
}

/**
 * Get accessible symbols for current user
 */
export async function getAccessibleSymbols(
  request: APIRequestContext
): Promise<{
  symbols: string[];
  tier: string;
}> {
  const response = await request.get('/api/tier/symbols');
  if (response.ok()) {
    return await response.json();
  }
  return { symbols: [], tier: 'FREE' };
}

/**
 * Check symbol access
 */
export async function checkSymbolAccess(
  request: APIRequestContext,
  symbol: string
): Promise<{
  hasAccess: boolean;
  tier: string;
  requiresUpgrade: boolean;
}> {
  const response = await request.get(`/api/tier/check/${symbol}`);
  if (response.ok()) {
    return await response.json();
  }
  return { hasAccess: false, tier: 'FREE', requiresUpgrade: true };
}

/**
 * Cancel subscription via API
 */
export async function cancelSubscription(
  request: APIRequestContext,
  reason?: string
): Promise<{
  success: boolean;
  subscription?: {
    status: string;
    cancelledAt: string;
    expiresAt: string;
  };
  error?: string;
}> {
  const response = await request.post('/api/subscription/cancel', {
    data: { reason },
  });

  if (response.ok()) {
    const data = await response.json();
    return { success: true, subscription: data };
  }

  const error = await response.json();
  return { success: false, error: error.message || error.error };
}

/**
 * Trigger webhook simulation (for testing)
 */
export async function triggerWebhook(
  request: APIRequestContext,
  provider: 'stripe' | 'dlocal',
  event: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean }> {
  const response = await request.post(`/api/test/webhooks/${provider}`, {
    data: { event, payload },
    headers: {
      'x-test-secret': process.env.TEST_SECRET || 'test-secret',
    },
  });
  return { success: response.ok() };
}
