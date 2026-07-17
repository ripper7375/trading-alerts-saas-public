# Migration Order — Secret Matrix + Test Baseline

> `TEMPLATE-INFRA.md` variant (adapted for catalog/documentation). **Status: CONFIRMED** —
> formulated by the Advisor from the Executor's Session 0-3 PRE-DRAFT notes; re-verified by
> the Executor against codebase/git state 2026-07-17 (entry criterion PASS: Session 0-3
> artifacts committed and pushed, `origin/main` matches local `main`); Davin confirmed the
> APPROVED text in chat.

**Session:** 0-4 · **Phase:** Phase 0 (Foundation) · **Variant:** INFRA (adapted, read-only) · **Status:** CONFIRMED
**Generated:** 2026-07-17 · **Flags touched:** none directly (secret matrix informs F6/F7/F15 later) · **Estimated time:** ~3-4h

## Context carried over from Session 0-3

- **Playbook scope:** "Build the per-service secret matrix (plan 0.4) from `vercel.json`, `.env*`, `docker-compose.yml`, `railway-worker.json`, `railway-gateway/.env.example`. Run the FULL existing test suite; commit results as `docs/migration-test-baseline.md`."
- **Secret Cataloging Rule:** Catalog secret **NAMES ONLY, never values**. This is a strict directive for the secret matrix. This remains a read-only documentation session.
- **`vercel.json` crons:** Session 0-3 confirmed 8 `crons` entries in `vercel.json`. Note any duplicate-scheduling issues found (like `daily-maintenance`) and carry this context into the test baseline run.
- **Test Baseline Reality Check:** The pre-push hook ran the full suite once (111 suites / 2046 tests, all passed, 44.7s). This is a useful aggregate, but the formal baseline requires suite-by-suite characterization (mocked vs. real) per `LESSONS-LEARNED.md` (L1).
- **pnpm Strictness (L7/L9):** `node_modules` is pnpm-strict (non-flat). Resolve package paths via `.pnpm` if hoisting fails for ad-hoc scripts.

## Entry criteria

- [x] Session 0-3 artifacts committed and pushed: 5 regenerated specs (`part-12`, `part-14`, `part-17`, `part-18`, `part19`), 1 extended spec (`part-23`, added `candles`), `DECISION-LOG.md` (F1 fully closed + consolidation decision), `LESSONS-LEARNED.md` (L7 recurrence note + new L9), `migration-stack-analysis.md`, updated `CLAUDE.md`. Confirmed via `git log` (local `main` == `origin/main` at `18c2f03b`) and by reading all 6 spec files, the F1 batch-2 `DECISION-LOG.md` entry, and L9 in `LESSONS-LEARNED.md` directly at session open.

## Ordered steps

1. **Build the per-service secret matrix**
   - Enumerate every secret/env-var name referenced across `vercel.json`, `.env*` files, `docker-compose.yml`, `railway-worker.json`, `railway-gateway/.env.example`.
   - Cross-reference against confirmed live secrets: `CRON_SECRET`, `RISE_WEBHOOK_SECRET`, Stripe's webhook signing secret, and dLocal's HMAC secret.
   - For each secret document: name, which service(s)/route(s) consume it, and which file(s) reference it. **NAMES ONLY, NEVER VALUES.**
   - Output: A new file `docs/secret-matrix.md`.
   - _Verify:_ Every secret referenced in Session 0-3's specs (the 4 above) appears in the matrix; spot-check 2-3 `.env*`/config files against the matrix for completeness.

2. **Run the full existing test suite**
   - Identify every test command in scope (root `package.json` scripts, any `railway-gateway/` or other sub-package test scripts).
   - Run each; record pass/fail/skip counts per suite.
   - Per L1: flag which suites are integration-style (real DB/service) vs. fully-mocked.
   - _Verify:_ Re-run any suite with unexpected failures once to rule out flakiness before recording it as a real failure.

3. **Commit the baseline**
   - Output: `docs/migration-test-baseline.md` — document pass/fail/skip counts per suite, test command used, date, and explicitly flag any suites that couldn't run and why.

## Rules specific to this variant

- **Never catalog secret values.** Catalog NAMES ONLY.
- Do not modify `vercel.json`, `.env*`, `docker-compose.yml`, or any config file — cataloging only. Do not resolve issues found (e.g., the daily-maintenance cron overlap).
- Creativity dial: Medium (matrix format and test-recording format are flexible; which secrets/suites exist is not).

## Done when

- [x] Secret matrix (`docs/secret-matrix.md`) committed, covering every name referenced across the 5 listed source files (NAMES ONLY) — commit `a1cfbcf8`.
- [x] Matrix cross-referenced against the 4 secrets Session 0-3 already confirmed live — all 4 present (3 required a live-code grep since they're absent from the 5 files; logged as a gap, see Deviations).
- [x] `docs/migration-test-baseline.md` committed with pass/fail/skip counts per suite — 114 suites / 2075 tests, all passed (commits `5d6cdfab`, corrected `dba2a545`).
- [x] Mocked-vs-integration character noted per L1 in the test baseline — zero suites touch a real Postgres/Redis; 2 mislabeled "integration" tests found fully mocked, flagged for a future session.
- [x] Any suites that couldn't run explicitly flagged with a reason — `test:api`/`test:api:flask` (Newman), `test:load:*` (k6), `test:mt5:*`, root `test:e2e` (Playwright, config missing but CI already guards it).

## Rollback

None required — read-only/document session, no live system touched or configured.

## Deviations

1. **Live `.env`/`.env.local` values were never loaded into context.** The order says
   "enumerate every secret/env-var name referenced across... `.env*` files" — read literally
   this could mean opening every matching file. Instead of `Read`-ing `.env`/`.env.local`
   (which, unlike `.env.example`, contain real values), names were extracted with
   `grep -oE '^[A-Z_]+=' | sed 's/=$//'` so only the left-hand side ever entered the
   transcript. Stricter than the letter of the order, in the spirit of "NAMES ONLY, NEVER
   VALUES." `.env.staging` and `.env.example` were read in full — both are placeholder/
   near-empty, no live values.
2. **3 of the 4 "confirmed-live" secrets aren't in any of the 5 catalog files.**
   `CRON_SECRET`, `RISE_WEBHOOK_SECRET`, and the dLocal HMAC secret (actual name:
   `DLOCAL_WEBHOOK_SECRET`) don't appear in `vercel.json`, any `.env*`, `docker-compose.yml`,
   `railway-worker.json`, or `railway-gateway/.env.example`. To satisfy the order's own
   verify clause ("every secret referenced in Session 0-3's specs appears in the matrix"),
   grepped the actual consuming route/lib code (`app/api/cron/*`, `app/api/webhooks/
riseworks`, `lib/dlocal/dlocal-payment.service.ts`) to find their real env-var names —
   necessary, not optional, to close that verify step. Logged as a completeness gap in the
   matrix rather than silently working around it.
3. **`frontend/` and `seed-code/` excluded from all consumer-mapping greps** — both are
   out-of-scope mirror/template dirs per `CLAUDE.md`'s standing do-not-touch list (Section 5).
   Confirmed via directory listing before grepping, not assumed.
4. **Ran `railway-gateway`'s `test:e2e` script** in addition to its plain `test` script — the
   order says "any `railway-gateway/`... test scripts," and this one only mocks Prisma/Bull
   (confirmed by reading the spec file first), so it's self-contained and safe for a
   read-only session. Root's own `test:e2e` (Playwright) was a different case — see below.
5. **Root `test:api`/`test:api:flask` (Newman), `test:load:*` (k6), and `test:mt5:*` were not
   run** — each targets a live local server or, for `test:mt5:*`, opens real Prisma/Redis
   clients against live infra (confirmed by reading `scripts/verify-sync-deployment.ts`).
   Running any of them would touch a live system, which this order's Rollback section rules
   out. Documented with reasons in the test baseline per the order's explicit requirement,
   not silently skipped.
6. **Root `test:e2e` (Playwright) was attempted, then re-investigated after an initial
   mischaracterization.** `package.json`'s script points at `e2e/playwright.config.ts`,
   which doesn't exist (only `e2e/archive/playwright.config.ts` does). First pass wrote this
   up as a stale/broken reference reaching CI; before finalizing, checked
   `.github/workflows/e2e-tests.yml` directly and found it explicitly checks for that exact
   path and skips the job cleanly when absent, logging "expected after Part 20 removal." So
   CI already handles this correctly — corrected the test baseline doc (two commits: initial
   write, then a correction) before session close rather than leaving the wrong conclusion
   in an artifact. The real (minor) gap: the bare `pnpm run test:e2e` invocation lacks the
   same existence guard and hangs past 20s instead of failing fast — noted, not fixed.

## Next-session handoff

_(PRE-DRAFT for Session 0-5 — staging + local dev — written at this session's close)_
