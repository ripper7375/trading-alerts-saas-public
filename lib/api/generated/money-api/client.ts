/**
 * Typed client for money-service (Session 7-1, Step 3).
 *
 * Wraps `openapi-fetch`, typed against the auto-emitted `paths` schema
 * (./schema.ts -- regenerate via `pnpm generate:api-client` at the monolith
 * root). Paths already carry the real `/v1` prefix (money-service's
 * generate-openapi-spec.ts replicates main.ts's
 * setGlobalPrefix('v1', { exclude: ['health', 'health-auth'] }) before
 * emitting) -- callers pass bare paths like `/v1/wise/recipients`, not
 * `/wise/recipients`, mirroring the asymmetry against operationApi
 * documented in this order's own Decision 2.
 *
 * Request/response BODIES are currently typed `unknown` -- money-service
 * validates via Zod through ZodValidationPipe, not class-validator DTOs, so
 * @nestjs/swagger has nothing to introspect for body shapes (see
 * money-service/scripts/generate-openapi-spec.ts's own header, and this
 * order's Deviations for the follow-up plan).
 *
 * Server-only -- like lib/money-service/client.ts, which this reuses for the
 * actual network call and error-shape convention. Only import from a route
 * handler or server component, never a 'use client' file (no current
 * importer anywhere in app/, components/, or hooks/ as of Session 7-1 --
 * verified at CONFIRM).
 */
import createFetchClient, { type Client } from 'openapi-fetch';

import {
  MoneyServiceError,
  type MoneyServiceErrorBody,
} from '@/lib/money-service/client';

import type { paths } from './schema';

const BASE_URL = process.env['MONEY_SERVICE_URL'] ?? 'http://localhost:3002';

export type MoneyApiClient = Client<paths>;

/**
 * Creates a typed money-service client for one request-scoped token. Pass
 * the caller's own resolved token (getMoneyServiceToken()).
 */
export function createMoneyApi(token: string | null): MoneyApiClient {
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
 * throw-on-non-2xx convention every other money-service caller in this
 * codebase already expects (MoneyServiceError).
 */
export async function unwrapMoneyApi<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): Promise<T> {
  if (!result.response.ok) {
    throw new MoneyServiceError(
      result.response.status,
      (result.error as MoneyServiceErrorBody | undefined) ?? {}
    );
  }
  return result.data as T;
}
