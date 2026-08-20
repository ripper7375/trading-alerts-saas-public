# API Client Architecture

**Status:** current, authoritative · **Established:** Phase 7 (Sessions 7-1 → 7-3, 2026-08) ·
**Supersedes:** the legacy Stack A/Stack B design docs in
`backend-stack-a/api-client-between-frontend-and-stack-b/` (annotated `HISTORICAL/SUPERSEDED`
at Session 7-3, kept for audit trail — do not delete).

This is the canonical reference for how the monolith (`app/api/**` route handlers and server
components) talks to `operation-service` and `money-service`. If this document and the code
disagree, the code wins — regenerate this doc rather than trusting stale prose (the exact failure
class that made the legacy docs it replaces go stale in the first place).

---

## 1. Overview: `operationApi` and `moneyApi`

All monolith → microservice HTTP calls go through two typed clients exported from
`lib/api/index.ts`:

- **`operationApi`** — wraps `operation-service`'s routes (alerts, drawings, notifications, auth,
  user profile/preferences, tier checks). No `/v1` prefix; paths are the service's real root-level
  routes (e.g. `/alerts/{id}`).
- **`moneyApi`** — wraps `money-service`'s routes (affiliates, admin, Wise disbursement, dLocal,
  Stripe, cron triggers). Routes are prefixed `/v1` **except** `/health` and `/health-auth`
  (mirrors `money-service/src/main.ts`'s own `setGlobalPrefix()` exclude list).

Both are created per-request with a bearer token (or `null` for unauthenticated routes):

```ts
import {
  createOperationApi,
  unwrapOperationApi,
  getOperationServiceToken,
} from '@/lib/api';

const token = await getOperationServiceToken();
const client = createOperationApi(token);
const result = await client.GET('/alerts/{id}', { params: { path: { id } } });
const alert = await unwrapOperationApi(result);
```

The equivalent `createMoneyApi` / `unwrapMoneyApi` / `getMoneyServiceToken` triplet exists for
`money-service`. There is no third "combined" client and no default export — every call site
picks the specific service client it needs.

**Retired at Session 7-3:** the legacy hand-rolled `stackA`/`stackB` clients that `lib/api/
index.ts` exported before Phase 7. They were broken by design (several methods sent the wrong
HTTP method or path for their real route — see `migration-stack-analysis.md`'s `lib/api/`
appendix) and had zero real consumers as of Session 7-1. Nothing in this module today refers to
them.

---

## 2. Code generation workflow

Both clients are generated, never hand-written, so their types cannot silently drift from the
services' real routes the way `stackA`/`stackB` did.

```
operation-service controllers ──┐
                                 ├─► @nestjs/swagger emits OpenAPI JSON ─► openapi-typescript ─► schema.ts
money-service controllers ──────┘
```

1. Each service's `scripts/generate-openapi-spec.ts` boots the real `AppModule` DI graph and lets
   `@nestjs/swagger`'s `SwaggerModule` introspect the live controllers — the spec is emitted from
   running code, not maintained by hand.
2. `openapi-typescript` converts each service's spec JSON into a typed `paths`/`operations`
   interface at `lib/api/generated/{operation-api,money-api}/schema.ts`.
3. `lib/api/generated/{operation-api,money-api}/client.ts` wraps `openapi-fetch`'s typed client
   (path/method/param-typed against `schema.ts`, so a typo'd path or wrong method fails `tsc`, not
   just at runtime) and exposes `create*Api()` / `unwrap*Api()`.

Regenerate the whole chain with one command whenever a controller's routes change:

```bash
npm run generate:api-client
```

This chains both services' own `openapi:generate` scripts with the two `openapi-typescript`
invocations. Run it, then re-run `tsc --noEmit` — any route your code depended on that moved or
disappeared surfaces as a compile error immediately, not as a production 404.

---

## 3. Server-only constraint & error unwrapping conventions

**`lib/api/index.ts` (and everything it re-exports) is server-only.** `operationApi`/`moneyApi`
transitively import `next/headers` via `OperationServiceError`/`MoneyServiceError`'s home modules,
which sit alongside their `cookies()`-reading token helpers. Importing anything from this module
— even a type — into a `'use client'` component breaks the build
(`LESSONS-LEARNED.md` L6: "a server-only import anywhere in a module taints the whole module for
every `'use client'` importer"). Only import `@/lib/api` from a route handler or server component.

**Error unwrapping.** `openapi-fetch` itself never throws on a non-2xx response — it returns
`{ data, error, response }` and leaves the caller to decide. `unwrapOperationApi()` /
`unwrapMoneyApi()` convert that into this repo's existing throw-on-non-2xx convention:

```ts
export async function unwrapOperationApi<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): Promise<T> {
  if (!result.response.ok) {
    throw new OperationServiceError(result.response.status, result.error ?? {});
  }
  return result.data as T;
}
```

`OperationServiceError`/`MoneyServiceError` (defined in `lib/operation-service/client.ts` /
`lib/money-service/client.ts`) carry `.status` and `.body` — every existing caller of those
transport modules already expects this shape, so callers migrated onto the generated clients
(Session 7-2) needed no change to their own error handling.

A 204 No Content response has no body: `unwrapOperationApi`/`unwrapMoneyApi` return `undefined`
in that case, not `{}` — check for `undefined`, not falsy, if a 204 route's caller needs to branch
on "no content."

---

## 4. ESLint rule: no direct microservice `fetch()`

Session 7-2 added a `no-restricted-syntax` rule banning direct `fetch()` calls against
`OPERATION_SERVICE_URL`, `MONEY_SERVICE_URL`, or a bare microservice port, anywhere outside:

- `lib/api/generated/` (the generated clients themselves),
- `lib/*-service/client.ts` (the transport modules `unwrap*Api` throws through),
- one allowlisted exception: `lib/status/check-system-status.ts`'s legitimate direct `/health`
  fetch.

New code that needs to call a microservice route goes through `operationApi`/`moneyApi` — never a
hand-rolled `fetch()` — so this ESLint rule is the enforcement mechanism, not just a convention.

---

## 5. Known gaps and the `/v1` prefix / query-param workaround

**`/v1` prefix asymmetry (money-service only).** Every `money-service` route in the generated
schema is prefixed `/v1` except `/health` and `/health-auth`. `operation-service` has no such
prefix at all. This isn't a bug to fix — it mirrors each service's own `main.ts` — but it means a
money-service caller must remember the prefix; the generated `schema.ts` is the source of truth
for which routes are excluded, not assumption.

**Generated body/query schemas are incomplete for Zod-validated routes (`LESSONS-LEARNED.md` L29,
L32).** Both services validate request bodies via a custom `ZodValidationPipe`, not
class-validator DTOs. `@nestjs/swagger` has no decorator metadata to introspect for a Zod schema,
so:

- Request/response **bodies** come through as generic (`type: object` / `Record<string, never>`)
  — real, but not narrowly typed. Cast at the call site as needed; this is deliberate, not an
  oversight (a full Zod-to-OpenAPI decorator conversion across ~107 routes is out of scope for a
  LOW-dial session — tracked as a future hardening pass, see below).
- **Query parameters** are worse: `parameters.query` is typed `never` on every Zod-validated
  operation, not just generic — a caller passing real query params gets a compile error, not a
  loose-but-working type. Before writing a call against any generated operation that takes query
  params, grep the real `schema.ts` for that operation's `parameters.query` rather than assuming
  the shape from another route or another session's disclosed gap.

**The established workaround** (proven at Session 7-2, reused throughout `lib/money-service/
routes.ts`): build the query string with a small `buildQuery()` helper, append it to the literal
path, and cast the concatenated string back to the path type with a single narrowly-scoped
`pathWithQuery()` helper — one cast per call site, not one cast per parameter:

```ts
function buildQuery(
  params: Record<string, string | number | boolean | undefined>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) searchParams.set(key, String(value));
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

function pathWithQuery<P extends keyof paths>(base: P, query: string): P {
  return `${base}${query}` as P;
}

// usage:
const result = await api.GET(
  pathWithQuery(
    '/v1/affiliate/dashboard/codes',
    buildQuery({ status, page, limit })
  ),
  {}
);
```

This preserves byte-for-byte identical query serialization to what a hand-rolled `fetch()` would
have produced, while still routing through the sanctioned typed client (so the ESLint rule in §4
sees no raw `fetch()`).

**Future work (not this session):** a scoped Zod-to-OpenAPI conversion (or targeted `@ApiBody()`/
`@ApiQuery()` decorators on high-value routes) would let generated types replace both workarounds
above. Tracked as a residual in `MASTER-ROADMAP-PHASES-7-15.md` §5, recommended before Session
12-0's OpenAPI freeze for Stack D so its own client generation starts from a clean spec.
