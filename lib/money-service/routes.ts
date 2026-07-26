// Typed wrappers for money-service's 12 Slice-3 GET routes (Session 4A-6),
// plus the server-side cookie read that backs F45's server-side-proxy
// decision. Server-only — see client.ts's header comment (L6).
//
// getMoneyServiceToken() reads the SAME raw NextAuth session JWE that
// getServerSession()/requireAffiliate()/requireAdmin() already validate in
// each route handler — this module does not re-implement auth, it only
// forwards the already-authenticated session's own token to money-service's
// JwtAuthGuard, which decrypts it independently (F7 bridge). Callers must run
// their existing monolith auth check FIRST and only reach these wrappers
// after it passes; that keeps auth semantics unchanged (Low creativity dial).

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/operation-service/cookies';

import { callMoneyServiceWithToken } from './client';

/** Raw NextAuth session JWE from the httpOnly cookie, or null if absent. Never re-derive SESSION_COOKIE_NAME (Session 3-3's own CONFIRM finding). */
export async function getMoneyServiceToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) searchParams.set(key, String(value));
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Affiliate dashboard routes
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchAffiliateDashboardStats<T>(
  token: string
): Promise<T> {
  return callMoneyServiceWithToken<T>('/v1/affiliate/dashboard/stats', token);
}

export async function fetchAffiliateDashboardCodes<T>(
  token: string,
  params: { status?: string; page?: number; limit?: number } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/affiliate/dashboard/codes${buildQuery(params)}`,
    token
  );
}

export async function fetchAffiliateDashboardCodeInventory<T>(
  token: string,
  params: { startDate?: string; endDate?: string } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/affiliate/dashboard/code-inventory${buildQuery(params)}`,
    token
  );
}

export async function fetchAffiliateDashboardCommissionReport<T>(
  token: string,
  params: {
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/affiliate/dashboard/commission-report${buildQuery(params)}`,
    token
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Admin routes
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchAdminAffiliates<T>(
  token: string,
  params: {
    status?: string;
    country?: string;
    paymentMethod?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/admin/affiliates${buildQuery(params)}`,
    token
  );
}

export async function fetchAdminAffiliateDetail<T>(
  token: string,
  id: string
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/admin/affiliates/${encodeURIComponent(id)}`,
    token
  );
}

export async function fetchAdminAnalytics<T>(token: string): Promise<T> {
  return callMoneyServiceWithToken<T>('/v1/admin/analytics', token);
}

export async function fetchAdminCodeFlowsReport<T>(
  token: string,
  params: { start?: string; end?: string } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/admin/affiliates/reports/code-flows${buildQuery(params)}`,
    token
  );
}

export async function fetchAdminCodeInventoryReport<T>(
  token: string,
  params: { period?: string } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/admin/affiliates/reports/code-inventory${buildQuery(params)}`,
    token
  );
}

export async function fetchAdminCommissionOwingsReport<T>(
  token: string,
  params: { page?: number; limit?: number; minBalance?: number } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/admin/affiliates/reports/commission-owings${buildQuery(params)}`,
    token
  );
}

export async function fetchAdminProfitLossReport<T>(
  token: string,
  params: { period?: string } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/admin/affiliates/reports/profit-loss${buildQuery(params)}`,
    token
  );
}

export async function fetchAdminSalesPerformanceReport<T>(
  token: string,
  params: { period?: string; limit?: number } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/admin/affiliates/reports/sales-performance${buildQuery(params)}`,
    token
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Wise recipient routes (Session 4A-W3b) — flag-less per Davin's live call
// at this session's CONFIRM; F39/F41 already resolved and nothing else
// reads these routes yet.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchWiseRecipientRequirements<T>(
  token: string,
  params: {
    targetCurrency: string;
    recipientCountry?: string;
    legalType?: string;
    addressRequired?: boolean;
  }
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/wise/recipients/requirements${buildQuery(params)}`,
    token
  );
}

/**
 * Not in this order's own File 1 route-handler list, but the Contract
 * section documents it and File 2's field-refresh interaction requires it —
 * added as a deviation (see order Deviations).
 */
export async function refreshWiseRecipientRequirements<T>(
  token: string,
  body: { quoteId: string; partial: Record<string, unknown> }
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    '/v1/wise/recipients/requirements/refresh',
    token,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function fetchWiseRecipientMe<T>(token: string): Promise<T> {
  return callMoneyServiceWithToken<T>('/v1/wise/recipients/me', token);
}

export async function createWiseRecipient<T>(
  token: string,
  body: {
    targetCurrency: string;
    recipientCountry: string;
    legalType: 'PRIVATE' | 'BUSINESS';
    accountHolderName: string;
    requirementsType: string;
    details: Record<string, unknown>;
  }
): Promise<T> {
  return callMoneyServiceWithToken<T>('/v1/wise/recipients', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchWiseRecipientsAdmin<T>(
  token: string,
  params: { status?: string; page?: number; pageSize?: number } = {}
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/wise/recipients${buildQuery(params)}`,
    token
  );
}

export async function revalidateWiseRecipient<T>(
  token: string,
  id: string
): Promise<T> {
  return callMoneyServiceWithToken<T>(
    `/v1/wise/recipients/${encodeURIComponent(id)}/revalidate`,
    token,
    { method: 'POST' }
  );
}
