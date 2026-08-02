// Server-only fetch helper for operation-service (Session 3-3's "SSR fetch
// helpers" candidate step). Every caller runs in a Next.js route handler or
// server component — the browser never talks to operation-service directly,
// so the access token never has to leave the server (also sidesteps CORS
// entirely; operation-service's ALLOWED_ORIGINS is irrelevant to this path).
//
// Not exported from lib/api/index.ts — that module is known-broken by design
// (CLAUDE.md standing do-not-touch list, Phase 7's concern) and out of scope
// to touch here. Only ever import this from a route handler or server
// component (never a 'use client' file) — route handlers are inherently
// server-only in the App Router, so there's no L27-style bundling risk as
// long as that convention holds; this module doesn't add the `server-only`
// package to enforce it since it isn't already a project dependency.

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from './cookies';

const BASE_URL =
  process.env['OPERATION_SERVICE_URL'] ?? 'http://localhost:3001';

export interface OperationServiceErrorBody {
  error?: string;
  message?: string;
  // Session 3-4: RateLimitError's body (verify-email's 5s guard,
  // resend-verification's 60s per-user limit) carries this alongside
  // error/message — see operation-service/src/auth/auth-error.filter.ts.
  retryAfter?: number;
}

export class OperationServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: OperationServiceErrorBody
  ) {
    super(body.message ?? `operation-service request failed (${status})`);
    this.name = 'OperationServiceError';
  }
}

async function parseJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/**
 * Calls operation-service and returns the parsed JSON body. Throws
 * OperationServiceError for any non-2xx response — callers map `.status`/
 * `.body.error`/`.body.message` back onto the Next.js response themselves,
 * since each route's success shape differs (e.g. login's 200
 * twoFactorRequired branch is NOT an error and must be handled before this
 * throws anything).
 */
export async function callOperationService<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  });

  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new OperationServiceError(
      response.status,
      body as OperationServiceErrorBody
    );
  }

  return body as T;
}

/** Forwards a bearer access token — for SSR reads of guarded endpoints (`/auth/me` and later resource endpoints). */
export async function callOperationServiceWithToken<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  return callOperationService<T>(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export interface OperationServiceResponse<T> {
  status: number;
  body: T;
}

/**
 * Same as callOperationServiceWithToken, but also surfaces the real response
 * status (Session 4B-6) — needed by write-routes.ts's generic forwarder,
 * since two of the four forwarded Alerts CRUD routes (alert create,
 * line-alert attach) have an existing, documented 201 Created contract that
 * a bare body-only passthrough would silently downgrade to 200.
 */
export async function callOperationServiceWithTokenStatus<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<OperationServiceResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new OperationServiceError(
      response.status,
      body as OperationServiceErrorBody
    );
  }

  return { status: response.status, body: body as T };
}

/**
 * Same as callOperationServiceWithTokenStatus, but the Bearer header is
 * OPTIONAL (Session 4B-11) — for the 3 monolith `app/api/user/*` routes
 * whose operation-service targets are deliberately unauthenticated in
 * SOURCE (2FA mid-login verify, account-deletion confirm/cancel). Attaches
 * `Authorization` only when a token is actually available; never throws for
 * a missing one (unlike getOperationServiceToken()'s other callers, which
 * treat absence as a 401).
 */
export async function callOperationServiceWithOptionalTokenStatus<T>(
  path: string,
  accessToken: string | null,
  init: RequestInit = {}
): Promise<OperationServiceResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    cache: 'no-store',
  });

  const body = await parseJsonBody(response);

  if (!response.ok) {
    throw new OperationServiceError(
      response.status,
      body as OperationServiceErrorBody
    );
  }

  return { status: response.status, body: body as T };
}

/**
 * Raw NextAuth session JWE from the httpOnly cookie, or null if absent
 * (Session 4B-6). Mirrors lib/money-service/routes.ts's
 * getMoneyServiceToken() — same F45-class server-side-proxy bridge: the
 * caller's own already-validated session cookie is forwarded as this
 * module's Bearer token, never re-derived or re-validated here.
 */
export async function getOperationServiceToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return (
    cookieStore.get(SESSION_COOKIE_NAME)?.value ??
    cookieStore.get('__Secure-next-auth.session-token')?.value ??
    cookieStore.get('next-auth.session-token')?.value ??
    null
  );
}

/** Best-effort forwarding of the real client's IP/user-agent for operation-service's audit fields (RefreshToken.userAgent/ipAddress) — not security-critical, see jwt-auth.guard.ts / main.ts's own comments on this. */
export function forwardedRequestContext(request: {
  headers: { get(name: string): string | null };
}): Record<string, string> {
  const userAgent = request.headers.get('user-agent');
  const forwardedFor = request.headers.get('x-forwarded-for');
  const headers: Record<string, string> = {};
  if (userAgent) headers['user-agent'] = userAgent;
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  return headers;
}
