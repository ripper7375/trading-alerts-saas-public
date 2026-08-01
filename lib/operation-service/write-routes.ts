// Monolith-side transport for Alerts CRUD's Session 4B-6 forwarding layer.
// Mirrors lib/money-service/write-routes.ts's shape (Session 4A-10a): the 4
// operation-service alert routes this forwards to are already full PORTs
// (Session 4B-5) — same auth, same validation, same business logic — so
// this helper does one thing generically: forward the caller's raw request
// (method, body, and any x-correlation-id header) to operation-service,
// carrying the caller's own NextAuth session JWE as a Bearer token (F45-class
// bridge, via getOperationServiceToken()). Callers run their own existing
// monolith auth check FIRST (unchanged) and only reach this after it passes.
//
// Unlike forwardWriteRequestToMoneyService, this also preserves the real
// response status code (not just the body) — two of the four forwarded
// routes (alert create, line-alert attach) have an existing, documented 201
// Created contract that a bare body-only passthrough would have silently
// downgraded to 200 (see client.ts's callOperationServiceWithTokenStatus()).

import type { NextRequest } from 'next/server';

import {
  callOperationServiceWithTokenStatus,
  getOperationServiceToken,
  OperationServiceError,
  type OperationServiceResponse,
} from './client';

export { OperationServiceError };

export interface ForwardRequestOptions {
  /** HTTP method to use against operation-service. Defaults to the incoming request's own method. */
  method?: string;
  /** Raw body to forward. Defaults to the incoming request's own raw text body for POST/PATCH/PUT; omitted for GET/DELETE. */
  body?: string;
}

const BODY_METHODS = new Set(['POST', 'PATCH', 'PUT']);

/**
 * Forwards `request` to `path` on operation-service, with the caller's
 * session token as a Bearer Authorization header. Returns the parsed JSON
 * response body AND the real response status. Throws OperationServiceError
 * for any non-2xx response — callers map `.status`/`.body` back onto their
 * own NextResponse, same convention as every other operation-service/
 * money-service route handler's own catch block in this codebase.
 */
export async function forwardRequestToOperationService<T>(
  request: NextRequest,
  path: string,
  options: ForwardRequestOptions = {}
): Promise<OperationServiceResponse<T>> {
  const token = await getOperationServiceToken();
  if (!token) {
    throw new OperationServiceError(401, {
      error: 'Unauthorized',
      message: 'No session token available to forward',
    });
  }

  const method = options.method ?? request.method;
  const correlationId = request.headers.get('x-correlation-id');

  let body = options.body;
  if (body === undefined && BODY_METHODS.has(method)) {
    body = await request.text();
  }

  return callOperationServiceWithTokenStatus<T>(path, token, {
    method,
    // Omit the body entirely when there isn't one, rather than forwarding
    // an empty string — matches forwardWriteRequestToMoneyService's own
    // convention for a genuinely bodyless request.
    ...(body ? { body } : {}),
    headers: correlationId ? { 'x-correlation-id': correlationId } : {},
  });
}
