// Monolith-side write-API transport for money-service's Slice 4 (Session
// 4A-10a). Unlike lib/money-service/routes.ts's typed per-endpoint GET
// wrappers, the 5 write routes this forwards for are already full PORTs in
// money-service (Session 4A-9) — same auth, same validation, same business
// logic. So this helper does one thing generically: forward the caller's
// raw request body untouched to money-service, carrying the same
// Authorization Bearer token the read-API transport already forwards (F45
// bridge, via routes.ts's getMoneyServiceToken()) plus the client's
// Idempotency-Key header if one was sent. Callers run their own existing
// monolith auth check FIRST (unchanged) and only reach this after it
// passes — same convention as routes.ts.

import type { NextRequest } from 'next/server';

import { callMoneyServiceWithToken, MoneyServiceError } from './client';
import { getMoneyServiceToken } from './routes';

export { MoneyServiceError };

export interface ForwardWriteRequestOptions {
  /** HTTP method to use against money-service. Defaults to 'POST' — every Slice 4 write route this transport serves is a POST. */
  method?: string;
}

/**
 * Forwards `request`'s raw body + Idempotency-Key header (if present) to
 * `path` on money-service, with the caller's session token as a Bearer
 * Authorization header. Returns the parsed JSON response body, or throws
 * MoneyServiceError for any non-2xx response (mirrors client.ts's contract
 * — callers map `.status`/`.body` back onto their own NextResponse).
 */
export async function forwardWriteRequestToMoneyService<T>(
  request: NextRequest,
  path: string,
  options: ForwardWriteRequestOptions = {}
): Promise<T> {
  const token = await getMoneyServiceToken();
  if (!token) {
    throw new MoneyServiceError(401, {
      error: 'Unauthorized',
      message: 'No session token available to forward',
    });
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');
  const rawBody = await request.text();

  return callMoneyServiceWithToken<T>(path, token, {
    method: options.method ?? 'POST',
    // Omit the body entirely when the request had none, rather than
    // forwarding an empty string — matches how a genuinely bodyless POST
    // (e.g. subscription cancel, batch execute) is actually sent.
    ...(rawBody ? { body: rawBody } : {}),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  });
}
