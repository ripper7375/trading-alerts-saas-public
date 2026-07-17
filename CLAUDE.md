# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 0, Session 0-4 (complete) — 2026-07-17.
- **Current order:**
  `docs/migration-orders/0-4-secret-matrix-test-baseline.migration-order.md`
  (CONFIRMED, executed)
- **Order status:** CONFIRMED — executed 2026-07-17
- **Waiting on:** (unchanged, carried over) A human with delete permission to remove 5
  remote branches — this session's git credential can push/create branches but gets
  `HTTP 403` on `git push --delete` for every branch tried. Branches needing deletion:
  `fix/tsconfig-exclude-case-sensitivity` and `salvage/windowed-centroid-cfl-indicator`
  (both already merged), plus 3 stale `claude/*` branches (no open PRs on any). Unrelated
  to Phase 0 work; carried over from the 2026-07-12 git audit.
- **Last session did:** Session 0-4 (secret matrix + test baseline, INFRA-adapted,
  read-only). Confirmed entry criterion at open (0-3 artifacts committed/pushed,
  `origin/main` == local `main`); Davin confirmed the order's APPROVED text had been
  edited in-place uncommitted (unusual but legitimate — committed as part of CONFIRM).
  **Secret matrix (`docs/secret-matrix.md`):** catalogued every env-var name across the
  5 source files, names only (`.env`/`.env.local` values extracted via `grep`, never
  loaded into context). Found 3 of the 4 "confirmed-live" secrets (`CRON_SECRET`,
  `RISE_WEBHOOK_SECRET`, `DLOCAL_WEBHOOK_SECRET`) aren't in any of the 5 files at all —
  had to grep the actual consuming route/lib code to name them, then logged the gap.
  Also found `.env.example` missing all 4 dLocal vars and both cron/RiseWorks secrets,
  plus `MT5_LOGIN`/`PASSWORD` naming drift vs. live `MT5_LOGIN_01`/`PASSWORD_01` — not
  fixed (cataloging only, per the order's rules).
  **Test baseline (`docs/migration-test-baseline.md`):** 114 suites / 2075 tests, all
  passed (root 111/2046 — reproduces the Session 0-3 pre-push hook number exactly, no
  drift; `railway-gateway` unit+e2e 3/29). Per L1, found **zero suites touch a real
  Postgres/Redis** — every "integration"-named test mocks the DB/external boundary; 2 of
  the 6 (`user-registration-flow.test.ts`, `api-client-workflow.test.ts`) are fully
  mocked and effectively decorative, same pattern as the original L1 example
  (`__tests__/lib/api/stack-*-client.test.ts`) — flagged as a future-session candidate,
  not fixed here. 4 suite groups explicitly not run, each with a verified reason (not
  silently skipped): `test:api`/`test:api:flask` (Newman, needs a live local server),
  `test:load:*` (k6, same), `test:mt5:*` (opens real Prisma/Redis clients against live
  infra — confirmed by reading the script), and root `test:e2e` (Playwright config path
  doesn't exist on disk — but confirmed via `.github/workflows/e2e-tests.yml` that CI
  already guards this and skips cleanly; only the bare npm script lacks the same guard).
- **Next session must:** Session 0-5 — staging + local dev (INFRA, NOT read-only).
  PRE-DRAFT written: `docs/migration-orders/0-5-staging-local-dev.migration-order.md` —
  needs Davin's Railway + Vercel account access and an F17 (staging-data strategy)
  decision before it can go APPROVED; also flags an open scoping question (should the new
  `docker-compose.dev.yml` include `mt5-service`, given it's SEPARATE_STACK/out-of-scope?
  recommend no).
- **Open flags:** F1 fully RESOLVED (both batches, Session 0-3) · F2 RESOLVED
  (Session 0-1) · F19 npm-check RESOLVED (Session 0-1), full audit still OPEN (due
  Session 2-1) · F17 OPEN, due Session 0-5 (Davin: staging-data strategy) · F3–F16,
  F18 OPEN (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

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
