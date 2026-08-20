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
//
// Session 7-2 Step 1c: every wrapper below now calls through
// createMoneyApi()/unwrapMoneyApi() (lib/api/generated/money-api/client.ts,
// Session 7-1) instead of the raw callMoneyServiceWithToken() transport, per
// this order's Decision 3(c). money-service's generated OpenAPI spec has NO
// typed query parameters anywhere (every operation's `parameters.query` is
// `never` — @nestjs/swagger captured path/method shape but not Zod-validated
// query DTOs, worse than the "generic type: object" body gap Session 7-1
// disclosed for request bodies). For the routes that take real query params,
// the existing buildQuery() string is still built exactly as before and
// appended to the literal path, then cast — this preserves byte-for-byte
// identical query serialization while still routing through the sanctioned
// typed client (so Step 3's lint rule sees no raw fetch() here). Flagged in
// this order's own Deviations for a possible future Zod-to-OpenAPI session.

import { cookies } from 'next/headers';

import {
  createMoneyApi,
  unwrapMoneyApi,
} from '@/lib/api/generated/money-api/client';
import type { paths } from '@/lib/api/generated/money-api/schema';
import { SESSION_COOKIE_NAME } from '@/lib/operation-service/cookies';

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

/**
 * Casts a literal base path + appended query string to `keyof paths` — the
 * generated spec has no typed query parameters (see header comment), so this
 * is the one narrowly-scoped escape hatch every query-bearing GET below uses.
 * The runtime request is unaffected: openapi-fetch just concatenates
 * baseUrl + this string, exactly as callMoneyServiceWithToken did before.
 */
function pathWithQuery<P extends keyof paths>(base: P, query: string): P {
  return `${base}${query}` as P;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Affiliate dashboard routes
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function fetchAffiliateDashboardStats<T>(
  token: string
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET('/v1/affiliate/dashboard/stats', {});
  return unwrapMoneyApi<T>(result);
}

export async function fetchAffiliateDashboardCodes<T>(
  token: string,
  params: { status?: string; page?: number; limit?: number } = {}
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery('/v1/affiliate/dashboard/codes', buildQuery(params)),
    {}
  );
  return unwrapMoneyApi<T>(result);
}

export async function fetchAffiliateDashboardCodeInventory<T>(
  token: string,
  params: { startDate?: string; endDate?: string } = {}
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery('/v1/affiliate/dashboard/code-inventory', buildQuery(params)),
    {}
  );
  return unwrapMoneyApi<T>(result);
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
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery(
      '/v1/affiliate/dashboard/commission-report',
      buildQuery(params)
    ),
    {}
  );
  return unwrapMoneyApi<T>(result);
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
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery('/v1/admin/affiliates', buildQuery(params)),
    {}
  );
  return unwrapMoneyApi<T>(result);
}

export async function fetchAdminAffiliateDetail<T>(
  token: string,
  id: string
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET('/v1/admin/affiliates/{id}', {
    params: { path: { id } },
  });
  return unwrapMoneyApi<T>(result);
}

export async function fetchAdminAnalytics<T>(token: string): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET('/v1/admin/analytics', {});
  return unwrapMoneyApi<T>(result);
}

export async function fetchAdminCodeFlowsReport<T>(
  token: string,
  params: { start?: string; end?: string } = {}
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery(
      '/v1/admin/affiliates/reports/code-flows',
      buildQuery(params)
    ),
    {}
  );
  return unwrapMoneyApi<T>(result);
}

export async function fetchAdminCodeInventoryReport<T>(
  token: string,
  params: { period?: string } = {}
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery(
      '/v1/admin/affiliates/reports/code-inventory',
      buildQuery(params)
    ),
    {}
  );
  return unwrapMoneyApi<T>(result);
}

export async function fetchAdminCommissionOwingsReport<T>(
  token: string,
  params: { page?: number; limit?: number; minBalance?: number } = {}
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery(
      '/v1/admin/affiliates/reports/commission-owings',
      buildQuery(params)
    ),
    {}
  );
  return unwrapMoneyApi<T>(result);
}

export async function fetchAdminProfitLossReport<T>(
  token: string,
  params: { period?: string } = {}
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery(
      '/v1/admin/affiliates/reports/profit-loss',
      buildQuery(params)
    ),
    {}
  );
  return unwrapMoneyApi<T>(result);
}

export async function fetchAdminSalesPerformanceReport<T>(
  token: string,
  params: { period?: string; limit?: number } = {}
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery(
      '/v1/admin/affiliates/reports/sales-performance',
      buildQuery(params)
    ),
    {}
  );
  return unwrapMoneyApi<T>(result);
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
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery('/v1/wise/recipients/requirements', buildQuery(params)),
    {}
  );
  return unwrapMoneyApi<T>(result);
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
  const api = createMoneyApi(token);
  const result = await api.POST('/v1/wise/recipients/requirements/refresh', {
    body: body as never,
  });
  return unwrapMoneyApi<T>(result);
}

export async function fetchWiseRecipientMe<T>(token: string): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET('/v1/wise/recipients/me', {});
  return unwrapMoneyApi<T>(result);
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
  const api = createMoneyApi(token);
  const result = await api.POST('/v1/wise/recipients', {
    body: body as never,
  });
  return unwrapMoneyApi<T>(result);
}

export async function fetchWiseRecipientsAdmin<T>(
  token: string,
  params: { status?: string; page?: number; pageSize?: number } = {}
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.GET(
    pathWithQuery('/v1/wise/recipients', buildQuery(params)),
    {}
  );
  return unwrapMoneyApi<T>(result);
}

export async function revalidateWiseRecipient<T>(
  token: string,
  id: string
): Promise<T> {
  const api = createMoneyApi(token);
  const result = await api.POST('/v1/wise/recipients/{id}/revalidate', {
    params: { path: { id } },
  });
  return unwrapMoneyApi<T>(result);
}
