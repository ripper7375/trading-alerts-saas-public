// Server-only fetch helper for operation-service (Session 3-3's "SSR fetch
// helpers" candidate step). Every caller runs in a Next.js route handler or
// server component — the browser never talks to operation-service directly,
// so the access token never has to leave the server (also sidesteps CORS
// entirely; operation-service's ALLOWED_ORIGINS is irrelevant to this path).
//
// Not exported from lib/api/index.ts — that module is known-broken by design
// (CLAUDE.md standing do-not-touch list, Phase 7's concern) and out of scope
// to touch here. Only ever import this from a route handler or server
// component (never a 'use client' file). The `import 'server-only'` below
// enforces it: Next.js 16 fails the build if a Client Component reaches this
// module (it resolves `server-only` itself, so the package is not a project
// dependency).

import 'server-only';

import { cookies } from 'next/headers';

import {
  emailHintFromCookieHeader,
  emailHintToHeaders,
} from '@/lib/email/i18n/languages';

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
  // Set by this module itself for a timeout: 'GATEWAY_TIMEOUT' (status 504).
  code?: string;
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

/**
 * Read calls (GET/HEAD) fail fast. When MIGRATE_* flags are on, the proxied
 * route handlers do not fall back to local Prisma on a throw, so a stalled
 * operation-service would otherwise hang the Vercel function until the
 * platform kills it.
 */
export const READ_TIMEOUT_MS = 5_000;

/**
 * Writes (POST/PUT/PATCH/DELETE) get a longer budget than the downstream
 * transaction takes, and are NEVER retried here. A short timeout on a
 * non-idempotent write could sever the connection after the upstream has
 * already charged or disbursed; a retry could do it twice. A timed-out write
 * is an unknown outcome: it is reported as 504 and the caller must not assume
 * the write did or did not happen.
 */
export const WRITE_TIMEOUT_MS = 15_000;

const READ_METHODS = new Set(['GET', 'HEAD']);

function timeoutMsFor(method: string | undefined): number {
  return READ_METHODS.has((method ?? 'GET').toUpperCase())
    ? READ_TIMEOUT_MS
    : WRITE_TIMEOUT_MS;
}

async function parseJsonBody(
  response: Response,
  timeoutSignal: AbortSignal
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    // A timeout that fires while the body is still streaming must not be
    // swallowed into `{}` and returned as a success.
    if (timeoutSignal.aborted) throw error;
    return {};
  }
}

/**
 * One round trip: fetch (bounded by the method's timeout), parse the JSON
 * body, throw OperationServiceError for a non-2xx. A timeout becomes
 * OperationServiceError(504, GATEWAY_TIMEOUT) so every route handler's
 * existing `.status`/`.body` mapping returns `{ error: 'Gateway timeout' }`.
 * A caller-supplied `init.signal` still wins: its abort is rethrown as is.
 */
async function request(
  path: string,
  init: RequestInit
): Promise<OperationServiceResponse<unknown>> {
  const timeoutMs = timeoutMsFor(init.method);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      cache: 'no-store',
      signal,
    });

    const body = await parseJsonBody(response, timeoutSignal);

    if (!response.ok) {
      throw new OperationServiceError(
        response.status,
        body as OperationServiceErrorBody
      );
    }

    return { status: response.status, body };
  } catch (error) {
    if (
      timeoutSignal.aborted &&
      !init.signal?.aborted &&
      !(error instanceof OperationServiceError)
    ) {
      throw new OperationServiceError(504, {
        error: 'Gateway timeout',
        code: 'GATEWAY_TIMEOUT',
        message: `The upstream service did not answer within ${timeoutMs} ms`,
      });
    }
    throw error;
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
  const { body } = await request(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

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
  const { status, body } = await request(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return { status, body: body as T };
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
  const { status, body } = await request(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  return { status, body: body as T };
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

/**
 * Forwards client metadata and tracing/locale context from the incoming
 * Next.js request to operation-service — audit fields (RefreshToken.userAgent/
 * ipAddress, not security-critical, see jwt-auth.guard.ts / main.ts's own
 * comments), request tracing, and the 2026-08-19 GeoIP context. Session 11-2
 * (DECISION-LOG.md): previously forwarded only `user-agent`/`x-forwarded-for`,
 * silently dropping everything else — the reason the GeoIP work couldn't be
 * mirrored into operation-service. Downstream services ignore headers they
 * don't recognize, so this list is deliberately a superset of what any single
 * caller needs today.
 */
export function forwardedRequestContext(request: {
  headers: { get(name: string): string | null };
}): Record<string, string> {
  const forwardedHeaderNames = [
    // Tracing
    'x-correlation-id',
    'x-request-id',
    // Network & client
    'user-agent',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-real-ip',
    // Context & locale (2026-08-19 GeoIP)
    'x-user-id',
    'x-user-tier',
    'x-user-country',
    'x-user-currency',
    'x-user-timezone',
  ] as const;

  const headers: Record<string, string> = {};
  for (const name of forwardedHeaderNames) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  Object.assign(headers, forwardedEmailLocale(request));

  return headers;
}

/**
 * The reader's language and formats, as headers, so operation-service can
 * write the e-mails it sends (verification, password reset, account deletion,
 * ...) in them. Taken from the same `davintrade-*` cookies the app renders
 * from (and the IP-derived timezone), and validated before they are forwarded
 * (lib/email/i18n/languages.ts): nothing else of the request goes with them.
 *
 * Part of `forwardedRequestContext()`; routes that call operation-service
 * without forwarding the whole context (so its rate limits and audit fields
 * keep seeing the monolith) pass this alone.
 */
export function forwardedEmailLocale(request: {
  headers: { get(name: string): string | null };
}): Record<string, string> {
  const hint = emailHintFromCookieHeader(request.headers.get('cookie'));
  hint.timezone ??=
    request.headers.get('x-vercel-ip-timezone') ??
    request.headers.get('cf-timezone') ??
    undefined;
  return emailHintToHeaders(hint);
}
