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
