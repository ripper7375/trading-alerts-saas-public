# Migration Test Baseline

**Session:** 0-4 · **Date:** 2026-07-17 · **Scope:** full existing test suite, suite-by-suite.

## Summary

| Suite group            | Command                                                             | Suites  | Tests    | Result         | Time  |
| ---------------------- | ------------------------------------------------------------------- | ------- | -------- | -------------- | ----- |
| Root monolith          | `pnpm run test:ci` (`jest --ci --coverage --maxWorkers=2 --silent`) | 111     | 2046     | **all passed** | 48.3s |
| `railway-gateway` unit | `pnpm test` (`jest`)                                                | 2       | 20       | **all passed** | 60.2s |
| `railway-gateway` e2e  | `pnpm run test:e2e` (`jest --config ./test/jest-e2e.json`)          | 1       | 9        | **all passed** | 23.8s |
| **Total run**          |                                                                     | **114** | **2075** | **all passed** | —     |

No suite required a re-run — no unexpected failures occurred (nothing to rule out for flakiness).

**Cross-check against the Session 0-3 pre-push hook number** (111 suites / 2046 tests / 44.7s /
26.5% statement coverage): today's root run reproduces the exact same suite/test counts
(111/2046) with coverage at 26.54% (statements) — consistent, no drift. Timing varies within
normal noise (44.7s → 48.3s).

## Root monolith coverage (from `test:ci`)

Statements 26.54% (3720/14012) · Branches 18.27% (1120/6129) · Functions 27.67% (669/2417) ·
Lines 26.67% (3559/13340).

## Mocked vs. integration character (per L1)

**Zero suites in this baseline connect to a real Postgres or Redis instance.** Every suite
that ran — across all 114 — mocks its database/external-service boundary in some form. That
is not necessarily a problem (see below), but it means this baseline currently provides no
evidence about real database/service behavior, only about internal code-path correctness.
Breaking that down:

- **Root `**tests**/**`(111 suites):** standard Jest unit tests — DB/external calls mocked
throughout via`jest.fn()`/`jest.mock()`. This is expected and appropriate for the bulk of
  the suite.
- **`__tests__/lib/api/stack-a-client.test.ts` + `stack-b-client.test.ts`** — this is the
  **exact case L1 was written from**: `global.fetch` is mocked entirely, so these tests
  assert the mock was called correctly, not that the real endpoint contract holds.
  `lib/api/index.ts` is known-broken-by-design (frozen until Phase 7 per `CLAUDE.md`) —
  these tests passing is decoration, not verification, consistent with L1's original finding.
- **`__tests__/integration/*.test.ts` (6 files)** — named "integration" but mocking depth
  varies on inspection:
  - `user-registration-flow.test.ts` — declares an inline `mockPrismaClient` stub and never
    connects to a real database (`beforeAll` only logs "Setting up integration test
    environment..."); effectively a unit test despite the name and directory. Same L1
    pattern as the lib/api tests.
  - `api-client-workflow.test.ts` — mocks `global.fetch` entirely; same L1 pattern.
  - `payment-creation.test.ts`, `tier1-workflows.test.ts`, `tier2-workflows.test.ts`,
    `auth-email-flow.test.ts` — exercise **real internal lib functions** (currency
    conversion, commission calculation, route-handler logic) with only the true external
    boundary mocked (`@/lib/db/prisma`, `fetch`, `resend`, `next-auth`). This is meaningful
    regression coverage for internal business logic, even though it doesn't touch a real DB.
- **`railway-gateway/test/dto-contract.spec.ts` + `validation.service.spec.ts`** — unit-level,
  Prisma/queue mocked.
- **`railway-gateway/test/market-data.e2e-spec.ts`** — the strongest suite in this baseline:
  boots the real NestJS app (DI container, guards, `ValidationPipe`, HTTP routing) and drives
  it via `supertest` — genuine HTTP-level integration of the service's own code. Still mocks
  `PrismaService` and the Bull queue, so it doesn't touch real Postgres/Redis either.

**Takeaway for later sessions:** every "integration" test in this codebase today integrates
internal modules with each other, not with a real database or live service. When Phase 4
build sessions port slices to NestJS, don't treat a green suite here as proof the new service
talks to Postgres/Redis correctly — per L1, ask "what change in the real system would make
this fail?" First candidate to fix: `user-registration-flow.test.ts` and
`api-client-workflow.test.ts` are mislabeled/decorative and should either be wired to a real
test DB or renamed/moved — not this session's scope, flagging for a future one.

## Suites that couldn't run (flagged, not silently skipped)

| Suite                                                                                           | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test:api`, `test:api:flask` (Newman, Postman collections)                                      | Target `http://localhost:3000` (confirmed via `postman/environments/local.postman_environment.json`'s `baseUrl`). No server was started this session — starting one and hitting it with the full collection is outside a read-only cataloging/baseline session.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `test:e2e` and its variants (`test:e2e:ui/headed/debug/report/group-a/group-b/ci`) — Playwright | The script runs `playwright test --config=e2e/playwright.config.ts`, but that file does not exist on disk — only `e2e/archive/playwright.config.ts` does. Root cause found: `.github/workflows/e2e-tests.yml` explicitly checks for this exact path (`if [ -f "e2e/playwright.config.ts" ]`) and cleanly **skips** the whole job when it's absent, logging "E2E tests skipped — Playwright config not found... expected after Part 20 removal due to architecture changes." So this is a known, intentional state in CI, not a silent break. The gap: the bare `pnpm run test:e2e` invocation has no equivalent guard — attempted it locally to confirm, and unlike CI it does not fail fast; it was still running after 20s and had to be terminated to avoid a hung process. Not fixed this session (read-only) — a future session could either restore the config or add the same existence check to the npm script for a clean local skip. |
| `test:load:health/auth/alerts/checkout/websocket/spike/all` (k6)                                | Explicitly load/stress tests against a running server. Requires the `k6` binary and a live target — not appropriate to run in a read-only baseline session even if available.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `test:mt5:verify`, `test:mt5:deployment`, `test:mt5:monitor`, `test:mt5:all`                    | Read `scripts/verify-sync-deployment.ts`: it opens a **real** `PrismaClient` and a **real** Redis client against live `DATABASE_URL`/`REDIS_URL` to verify the Contabo VPS sync deployment. Running it would touch live infrastructure, which this order's rules explicitly prohibit ("no live system touched or configured"). Not run.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Notes

- Package manager: `pnpm` (per `CLAUDE.md`'s pnpm-strict `node_modules` note); commands run
  via `pnpm run <script>` / `pnpm test`.
- `railway-gateway/` is excluded from the root Jest config's `testPathIgnorePatterns` (it's a
  separate NestJS project with its own `package.json`/`tsconfig.json`), so its suites had to
  be run separately from within `railway-gateway/`.
- No suite was modified, no config was changed, and no live system was started to produce
  these numbers — per this order's rules.
