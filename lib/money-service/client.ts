// Server-only fetch helper for money-service (Session 4A-7a, F45 Option (a) —
// server-side proxy). Every caller runs in a Next.js route handler or server
// component — the browser never talks to money-service directly, so the
// NextAuth session JWE never has to leave the server (mirrors
// lib/operation-service/client.ts's pattern exactly, per F30/F45).
//
// Not exported from lib/api/index.ts — that module is known-broken by design
// (CLAUDE.md standing do-not-touch list, Phase 7's concern) and out of scope
// to touch here. Only ever import this from a route handler or server
// component (never a 'use client' file) — route handlers are inherently
// server-only in the App Router, so there's no L27-style bundling risk as
// long as that convention holds; this module doesn't add the `server-only`
// package to enforce it since it isn't already a project dependency (L6).

const BASE_URL = process.env['MONEY_SERVICE_URL'] ?? 'http://localhost:3002';

export interface MoneyServiceErrorBody {
  error?: string;
  message?: string;
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

async function parseJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

/**
 * Calls money-service and returns the parsed JSON body. Throws
 * MoneyServiceError for any non-2xx response — callers map `.status`/
 * `.body.error`/`.body.message` back onto the Next.js response themselves.
 */
export async function callMoneyService<T>(
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
    throw new MoneyServiceError(response.status, body as MoneyServiceErrorBody);
  }

  return body as T;
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
