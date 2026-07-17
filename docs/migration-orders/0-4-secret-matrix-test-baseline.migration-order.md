# Migration Order — Secret Matrix + Test Baseline

> `TEMPLATE-INFRA.md` variant (closest fit — this session catalogs/documents rather than
> provisions, so several INFRA sections are adapted; no live system is provisioned or
> reconfigured this session). **Status: PRE-DRAFT** — written by the Executor at Session
> 0-3's close, informed by that session's findings. Needs an Advisor DRAFT pass and Davin's
> APPROVED before the next Executor session can CONFIRM and run it.

**Session:** 0-4 · **Phase:** Phase 0 (Foundation) · **Variant:** INFRA (adapted, read-only)
**Generated:** 2026-07-17 · **Flags touched:** none directly (secret matrix informs F6/F7/F15
later) · **Estimated time:** ~3-4h (test suite runtime is the unknown — full suite has not
been run and timed this migration; budget extra if it's slow or flaky)

## Context carried over from Session 0-3

- **Playbook scope** (`monolith-to-microservices-migration-session-playbook.md`, Session
  0-4): "Build the per-service secret matrix (plan 0.4) from `vercel.json`, `.env*`,
  `docker-compose.yml`, `railway-worker.json`, `railway-gateway/.env.example`. Run the FULL
  existing test suite; commit results as `docs/migration-test-baseline.md`."
- **Davin decision needed at APPROVED time** (playbook flags this explicitly): should the
  matrix catalog secret **names only**, or does Davin want to grant access to actual values
  for a subset? **Recommend names-only** — matches `TEMPLATE-INFRA.md`'s own standing rule
  ("Secrets: names in the matrix, values only in Railway/Vercel — never in git") and keeps
  this a read-only documentation session like 0-2/0-3, no new secret-handling risk.
- **`vercel.json` is already partially catalogued** from Session 0-3's F1 work: its 8
  `crons` entries are known (see `DECISION-LOG.md` F1 batch-2 entry), including the
  suspected `daily-maintenance` duplicate-scheduling issue flagged there — worth carrying
  into this session's test-baseline run (if `check-expiring-subscriptions`,
  `downgrade-expired-subscriptions`, or `expire-codes` have existing tests, their baseline
  pass/fail is relevant context for whoever eventually resolves that finding).
- **Lessons directly applicable:**
  - L1 (`LESSONS-LEARNED.md`): a test suite that mocks its entire boundary proves nothing —
    when recording the baseline, note _which_ suites are meaningfully asserting against
    real behavior vs. fully-mocked, not just raw pass/fail counts.
  - L7/L9: `node_modules` is pnpm-strict (non-flat) — don't assume a package used only by
    an ad-hoc script is actually reachable via bare `require()`; resolve via its `.pnpm`
    path if hoisting fails.

## Entry criteria

- [ ] Session 0-3 artifacts committed and pushed: 5 regenerated specs (`part-12`, `part-14`,
      `part-17`, `part-18`, `part19`), 1 extended spec (`part-23`, added `candles`),
      `DECISION-LOG.md` (F1 fully closed + consolidation decision), `LESSONS-LEARNED.md`
      (L7 recurrence note + new L9), `migration-stack-analysis.md`, updated `CLAUDE.md`.
- [ ] Davin has confirmed the names-only-vs-values question (see above) before work starts.

## Ordered steps

1. **Build the per-service secret matrix**
   - Enumerate every secret/env-var name referenced across `vercel.json`, `.env*` files
     (names only — never commit an actual `.env` file's values), `docker-compose.yml`,
     `railway-worker.json`, `railway-gateway/.env.example`.
   - Cross-reference against what Session 0-3 already surfaced: `CRON_SECRET` (all 8 cron
     routes), `RISE_WEBHOOK_SECRET` (RiseWorks webhook), Stripe's webhook signing secret
     (used by `constructWebhookEvent`), dLocal's HMAC secret (used by
     `verifyWebhookSignature`) — these 4 are already confirmed live and load-bearing.
   - For each secret: name, which service(s)/route(s) consume it, which file(s) reference
     it, and — per the Davin decision above — name only or actual value.
   - Output: the matrix itself (format TBD by Advisor/Davin — could be a table in this
     order's own doc, or a new `docs/migration-orders/secret-matrix.md`).
   - _Verify:_ every secret referenced in Session 0-3's specs (the 4 above) appears in the
     matrix; spot-check 2-3 `.env*`/config files against the matrix for completeness.

2. **Run the full existing test suite**
   - Identify every test command in scope (root `package.json` scripts, any
     `railway-gateway/` or other sub-package test scripts).
   - Run each; record pass/fail/skip counts per suite, not just an aggregate number.
   - Per L1: flag which suites are integration-style (real DB/service) vs. fully-mocked —
     a green fully-mocked suite is weaker evidence than a smaller green integration suite.
   - _Verify:_ re-run any suite with unexpected failures once to rule out flakiness before
     recording it as a real failure.

3. **Commit the baseline**
   - Output: `docs/migration-test-baseline.md` — pass/fail/skip counts per suite, test
     command used, date, any suites that couldn't run and why (missing env var, missing
     service dependency, etc. — don't silently skip and omit).

## Rules specific to this variant

- Read-only for secret _values_ unless Davin explicitly grants access at APPROVED time and
  the matrix format supports storing them (still never in git — see Entry criteria).
- Do not modify `vercel.json`, `.env*`, `docker-compose.yml`, or any config file — cataloging
  only, this session doesn't fix anything it finds (e.g. the daily-maintenance cron overlap
  from 0-3 is a finding to note, not resolve, here).
- Creativity dial: Medium (matrix format and test-recording format are flexible; which
  secrets/suites exist is not).

## Done when

- [ ] Secret matrix committed, covering every name referenced across the 5 listed source
      files, cross-referenced against the 4 secrets Session 0-3 already confirmed live.
- [ ] `docs/migration-test-baseline.md` committed with pass/fail/skip counts per suite,
      mocked-vs-integration character noted per L1, and any suites that couldn't run
      explicitly flagged with a reason.

## Rollback

None required — read-only/document session, no live system touched or configured.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for Session 0-5 — staging + local dev — written at this session's close)_
