/**
 * Wise API Constants (Session 4A-W3a, File 2/10)
 *
 * Endpoints, headers, and timeout/retry defaults for Wise Platform API
 * calls. Sourced from
 * docs/migration-orders/replace-rise-with-wise/02-wise-platform-api-integration-reference.md
 * §3-4 (frozen reference, not a redesign target — PORT dial Low).
 */

export const PROFILES_URL = '/v1/profiles';
export const ACCOUNTS_URL = '/v1/accounts';
export const ACCOUNT_REQUIREMENTS_URL = '/v1/account-requirements';
export const QUOTES_URL = '/v3/profiles';
export const WEBHOOK_SUBSCRIPTIONS_URL = '/v3/profiles';

export const CORRELATION_HEADER = 'X-External-Correlation-Id';
export const ACCEPT_MINOR_VERSION_HEADER = 'Accept-Minor-Version';
export const MINOR_VERSION_1 = '1';

export const DEFAULT_TIMEOUT_MS = 10000;
export const MAX_RETRIES = 3;
export const INITIAL_RETRY_DELAY_MS = 500;
export const RETRY_BACKOFF_DELAYS_MS = [500, 1000, 2000] as const;

/** Wise recipient endpoint path builder — quote-scoped account requirements. */
export function quoteAccountRequirementsPath(quoteId: string): string {
  return `/v1/quotes/${quoteId}/account-requirements`;
}
