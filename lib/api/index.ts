/**
 * API Client -- Unified interface (Session 7-1 rewrite)
 *
 * ## SERVER-ONLY as of this session
 * `operationApi`/`moneyApi` below transitively import `next/headers` (via
 * `lib/operation-service/client.ts`'s and `lib/money-service/client.ts`'s
 * `OperationServiceError`/`MoneyServiceError` classes, which sit in the same
 * module as their `cookies()`-reading token helpers). Importing ANYTHING
 * from this file -- even a legacy `stackA` type -- into a `'use client'`
 * component will break the build: `LESSONS-LEARNED.md` L6, "a server-only
 * import anywhere in a module taints the whole module for every 'use
 * client' importer." Verified zero current importers anywhere in `app/`,
 * `components/`, or `hooks/` at Session 7-1's CONFIRM (this file has had no
 * live consumers since `app/test-api/page.tsx`, its only prior caller, was
 * deleted at Session 6-12) -- so nothing breaks today, but any future
 * consumer of this file must be a route handler or server component, never
 * client-side.
 *
 * ## New (Session 7-1): operationApi / moneyApi
 * Typed clients generated from operation-service's and money-service's own
 * live OpenAPI specs (`lib/api/generated/`, emitted via `@nestjs/swagger`
 * from the real controllers -- see `operation-service/scripts/
 * generate-openapi-spec.ts` and its money-service twin). Path/method/param
 * shapes are auto-emitted and cannot silently drift from the code the way
 * `stackA`/`stackB` below did (that drift is exactly what this whole
 * session exists to fix -- see `docs/open-api-documents/
 * OPENAPI-DRIFT-REPORT-pre-phase-7.md`). Request/response BODY types are
 * currently generic (`unknown`): both services validate via Zod through a
 * custom `ZodValidationPipe`, not class-validator DTOs, so `@nestjs/
 * swagger` has nothing to introspect for body shapes -- a real, disclosed
 * limitation, not silently claimed as complete; see this session's own
 * Deviations for the follow-up options (Zod-to-OpenAPI conversion, or
 * targeted `@ApiBody()` annotation on high-value routes).
 *
 * Regenerate via `npm run generate:api-client` at the repo root (chains
 * both services' `openapi:generate` with the `openapi-typescript` codegen
 * step) whenever a controller's routes change.
 *
 * Usage (inside a route handler or server component only):
 * ```ts
 * import { createOperationApi, unwrapOperationApi, getOperationServiceToken } from '@/lib/api';
 *
 * const token = await getOperationServiceToken();
 * const client = createOperationApi(token);
 * const alert = await unwrapOperationApi(await client.GET('/alerts/{id}', { params: { path: { id } } }));
 * ```
 *
 * ### Token-* bridge audit (Decision 3, Session 7-1)
 * `operationApi` wraps operation-service's OWN routes (e.g. `/auth/2fa/
 * setup`) directly -- it has no relationship to the monolith's separate
 * `app/api/auth/token-*` bridge route FILES (Next.js route handlers, not
 * NestJS controllers, so `@nestjs/swagger` never sees them and they were
 * never candidates for inclusion in `operationApi`'s generated surface in
 * the first place). The 6 dead `token-2fa-*` routes this note used to flag
 * were retired at Session 7-2.
 *
 * ## Retired (Session 7-3): stackA / stackB
 *
 * The legacy hand-rolled `stackA`/`stackB` clients (broken by design --
 * several methods sent the wrong HTTP method or path for their real route,
 * see `migration-stack-analysis.md`'s `lib/api/` appendix) had zero real
 * consumers as of Session 7-1 and were deleted at Session 7-3 once every
 * monolith route handler was confirmed migrated onto `operationApi`/
 * `moneyApi`. This module now strictly exports the generated-client surface
 * below.
 */

export {
  createMoneyApi,
  createOperationApi,
  type MoneyApiClient,
  type MoneyApiPaths,
  type OperationApiClient,
  type OperationApiPaths,
  unwrapMoneyApi,
  unwrapOperationApi,
} from './generated';
export { getMoneyServiceToken } from '@/lib/money-service/routes';
export { getOperationServiceToken } from '@/lib/operation-service/client';
