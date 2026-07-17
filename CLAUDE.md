# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 0, Session 0-3 (complete) — 2026-07-17.
- **Current order:**
  `docs/migration-orders/0-3-openapi-contracts-batch-2.migration-order.md`
  (CONFIRMED, executed)
- **Order status:** CONFIRMED — executed 2026-07-17
- **Waiting on:** (unchanged, carried over) A human with delete permission to remove 5
  remote branches — this session's git credential can push/create branches but gets
  `HTTP 403` on `git push --delete` for every branch tried. Branches needing deletion:
  `fix/tsconfig-exclude-case-sensitivity` and `salvage/windowed-centroid-cfl-indicator`
  (both already merged), plus 3 stale `claude/*` branches (no open PRs on any). Unrelated
  to Phase 0 work; carried over from the 2026-07-12 git audit.
- **Last session did:** Session 0-3 (OpenAPI contracts batch 2 — money domain, CONTRACT
  order). Confirmed both entry criteria at open (0-2 artifacts committed/pushed; batch-1
  route counts unchanged). **Closed F1 fully** (both batches) — see `DECISION-LOG.md`.
  103 live routes reconciled: batch-1(34) + batch-2 PUBLIC(57) + batch-2 internal-only,
  documented with `security: []`(11: 3 webhooks + 8 cron) + excluded test-harness(1:
  `test/seed`, logged with reason) = 103. Deviation: extended scope from the playbook's
  `admin/affiliates` (10 routes) to the full `admin` domain (19) so every admin route
  gets accounted for.
  Mid-session found the 6 candidate spec files for this batch overlapped inconsistently
  (same routes duplicated across `part-12`/`part-14`/`part-17`/`part-18`/`part19`;
  `part-17` had every path missing the `/api` prefix) — **stopped and asked Davin**, who
  chose full consolidation into non-overlapping sole-owner files. Delegated the 5-file
  regeneration to parallel agents (each given an explicit route list, no ambiguity),
  spot-checked 5 routes against source personally. Also added `candles/[symbol]` (an
  uncovered leftover domain) to `part-23-market-data-channel` and folded
  `config/affiliate` into `part-17`.
  **Two live-code findings surfaced, not fixed (read-only session):** (1) `vercel.json`
  schedules `cron/daily-maintenance` alongside the 3 jobs its own docstring claims to
  have consolidated — possible duplicate daily execution against subscriptions/codes;
  (2) `candles/[symbol]/route.ts` interpolates a dynamic table name into a raw SQL
  string rather than a parameterized identifier — worth a security-review look. Both in
  `DECISION-LOG.md`'s F1 batch-2 entry.
  Harvested L9 (cross-file spec overlap — diff path lists across all candidates before
  trusting any single file); noted L7's `require()`-hoisting issue recurred for
  `js-yaml`/`yaml`, same workaround (resolve via `.pnpm` path) generalizes it.
  Backlog carried forward, unchanged: add `glob` (and now also `js-yaml`/`yaml` if a
  checked-in script ever needs them) as direct `devDependencies` (LESSONS-LEARNED L7).
- **Next session must:** Session 0-4 — secret matrix + test baseline (INFRA-adapted
  order). PRE-DRAFT written:
  `docs/migration-orders/0-4-secret-matrix-test-baseline.migration-order.md` — flags one
  open question for Davin before APPROVED: should the secret matrix catalog names only,
  or does Davin want actual values included for a subset (names-only recommended,
  matches the INFRA template's standing "never in git" rule).
- **Open flags:** F1 fully RESOLVED (both batches, Session 0-3) · F2 RESOLVED
  (Session 0-1) · F19 npm-check RESOLVED (Session 0-1), full audit still OPEN (due
  Session 2-1) · F3–F18 OPEN (register: plan §11 · resolutions:
  `docs/migration-orders/DECISION-LOG.md`)

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).
