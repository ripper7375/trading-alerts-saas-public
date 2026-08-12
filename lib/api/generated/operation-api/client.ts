/**
 * Typed client for operation-service (Session 7-1, Step 3).
 *
 * Wraps `openapi-fetch`, typed against the auto-emitted `paths` schema
 * (./schema.ts -- regenerate via `pnpm generate:api-client` at the monolith
 * root, which re-runs `npm run openapi:generate` in operation-service and
 * re-derives schema.ts from the fresh spec). Path/method/param shapes come
 * straight from the live controllers and cannot silently drift the way a
 * hand-authored client can; request/response BODIES are currently typed
 * `unknown` -- operation-service validates via Zod through
 * ZodValidationPipe, not class-validator DTOs, so @nestjs/swagger has
 * nothing to introspect for body shapes (see
 * operation-service/scripts/generate-openapi-spec.ts's own header, and this
 * order's Deviations for the follow-up plan). Callers that need a typed
 * request/response body today should still type it explicitly at the call
 * site, same as the existing callOperationServiceWithToken<T>() convention.
 *
 * Server-only -- like lib/operation-service/client.ts, which this reuses for
 * the actual network call and error-shape convention. Only import from a
 * route handler or server component, never a 'use client' file (no current
 * importer anywhere in app/, components/, or hooks/ as of Session 7-1 --
 * verified at CONFIRM -- so there is no existing L6-class bundling risk, but
 * that changes the moment a client component imports anything from
 * lib/api/index.ts once this is re-exported from there).
 */
import createFetchClient, { type Client } from 'openapi-fetch';

import {
  OperationServiceError,
  type OperationServiceErrorBody,
} from '@/lib/operation-service/client';

import type { paths } from './schema';

const BASE_URL =
  process.env['OPERATION_SERVICE_URL'] ?? 'http://localhost:3001';

export type OperationApiClient = Client<paths>;

/**
 * Creates a typed operation-service client for one request-scoped token.
 * Pass the caller's own resolved token (getOperationServiceToken()) -- null
 * is valid for the handful of deliberately-unauthenticated operation-service
 * routes (2FA mid-login verify, account-deletion confirm/cancel -- see
 * operation-service/src/users/users.controller.ts's own guard omissions).
 */
export function createOperationApi(token: string | null): OperationApiClient {
  return createFetchClient<paths>({
    baseUrl: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * Unwraps an openapi-fetch `{ data, error, response }` result into the
 * throw-on-non-2xx convention every other operation-service caller in this
 * codebase already expects (OperationServiceError) -- so a route handler
 * calling through operationApi can reuse its existing try/catch(
 * OperationServiceError) branches unchanged, rather than learning a second
 * error-handling shape.
 */
export async function unwrapOperationApi<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): Promise<T> {
  if (!result.response.ok) {
    throw new OperationServiceError(
      result.response.status,
      (result.error as OperationServiceErrorBody | undefined) ?? {}
    );
  }
  return result.data as T;
}
