// Server-only fetch helper for money-service (Session 4A-7a, F45 Option (a) —
// server-side proxy). Every caller runs in a Next.js route handler or server
// component — the browser never talks to money-service directly, so the
// NextAuth session JWE never has to leave the server (mirrors
// lib/operation-service/client.ts's pattern exactly, per F30/F45).
//
// Not exported from lib/api/index.ts — that module is known-broken by design
// (CLAUDE.md standing do-not-touch list, Phase 7's concern) and out of scope
// to touch here. Only ever import this from a route handler or server
// component (never a 'use client' file). The `import 'server-only'` below
// enforces it: Next.js 16 fails the build if a Client Component reaches this
// module (it resolves `server-only` itself, so the package is not a project
// dependency).

import 'server-only';

const BASE_URL = process.env['MONEY_SERVICE_URL'] ?? 'http://localhost:3002';

export interface MoneyServiceErrorBody {
  error?: string;
  message?: string;
  // Set by this module itself for a timeout: 'GATEWAY_TIMEOUT' (status 504).
  code?: string;
}

export class MoneyServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: MoneyServiceErrorBody
  ) {
    super(body.message ?? `money-service request failed (${status})`);
    this.name = 'MoneyServiceError';
  }
}

/**
 * Read calls (GET/HEAD) fail fast. When MIGRATE_* flags are on, the proxied
 * route handlers do not fall back to local Prisma on a throw, so a stalled
 * money-service would otherwise hang the Vercel function until the
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
 * Calls money-service and returns the parsed JSON body. Throws
 * MoneyServiceError for any non-2xx response — callers map `.status`/
 * `.body.error`/`.body.message` back onto the Next.js response themselves.
 * A timeout becomes MoneyServiceError(504, GATEWAY_TIMEOUT), so the same
 * mapping returns `{ error: 'Gateway timeout' }`. A caller-supplied
 * `init.signal` still wins: its abort is rethrown as is.
 */
export async function callMoneyService<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const timeoutMs = timeoutMsFor(init.method);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
      cache: 'no-store',
      signal,
    });

    const body = await parseJsonBody(response, timeoutSignal);

    if (!response.ok) {
      throw new MoneyServiceError(
        response.status,
        body as MoneyServiceErrorBody
      );
    }

    return body as T;
  } catch (error) {
    if (
      timeoutSignal.aborted &&
      !init.signal?.aborted &&
      !(error instanceof MoneyServiceError)
    ) {
      throw new MoneyServiceError(504, {
        error: 'Gateway timeout',
        code: 'GATEWAY_TIMEOUT',
        message: `The upstream service did not answer within ${timeoutMs} ms`,
      });
    }
    throw error;
  }
}

/** Forwards a bearer token — the raw NextAuth session JWE, read server-side from the httpOnly cookie by lib/money-service/routes.ts. money-service's JwtAuthGuard decrypts it directly (F7 bridge), so no re-encoding is needed here. */
export async function callMoneyServiceWithToken<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  return callMoneyService<T>(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
