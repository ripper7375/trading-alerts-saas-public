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

- [ ] Session 0-3 artifacts committed and pushed: 5 regenerated specs (`part-12`, `part-14`, `part-17`, `part-18`, `part19`), 1 extended spec (`part-23`, added `candles`), `DECISION-LOG.md` (F1 fully closed + consolidation decision), `LESSONS-LEARNED.md` (L7 recurrence note + new L9), `migration-stack-analysis.md`, updated `CLAUDE.md`.

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

- [ ] Secret matrix (`docs/secret-matrix.md`) committed, covering every name referenced across the 5 listed source files (NAMES ONLY).
- [ ] Matrix cross-referenced against the 4 secrets Session 0-3 already confirmed live.
- [ ] `docs/migration-test-baseline.md` committed with pass/fail/skip counts per suite.
- [ ] Mocked-vs-integration character noted per L1 in the test baseline.
- [ ] Any suites that couldn't run explicitly flagged with a reason.

## Rollback

None required — read-only/document session, no live system touched or configured.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for Session 0-5 — staging + local dev — written at this session's close)_
