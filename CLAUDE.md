# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 1, Session 1-3 (partially complete — roles done, PgBouncer split
  out) — 2026-07-19. Phase 0 still formally open (CC-A gap unchanged, see below).
- **Current order:** `docs/migration-orders/1-3-roles-pgbouncer.migration-order.md`
  (CONFIRMED, partially executed — roles done-when items checked; PgBouncer item split
  to new Session 1-3b, PRE-DRAFTed)
- **Order status:** CONFIRMED — money_svc/core_app created, granted, and verified live
  (positive + denial checks) against `trading-alerts` production Postgres. PgBouncer
  deployment NOT done this session — see Next session must.
- **Waiting on:** (1, blocking any push) `prisma/schema.prisma` now has
  `directUrl = env("DIRECT_URL")` (committed locally, commit `85e60fbc`, **NOT pushed**).
  `deploy.yml` auto-deploys to Vercel on every push to `main`; Vercel's build runs
  `prisma generate` with its own env vars, which will fail (`P1012`, reproduced locally)
  without `DIRECT_URL` set there. No Vercel access exists in this environment to add it.
  **Davin must add `DIRECT_URL` to Vercel production env vars (same value as current
  `DATABASE_URL`) before anyone pushes this commit (or any later one built on top of it)
  to `main`.** (2, urgent, new — F20) Production's Prisma migration history is
  completely unbaselined (`prisma migrate status`: all 6 migrations unapplied
  server-side), and one pending migration (`drop_watchlists`) would DROP two live,
  data-holding tables (`Watchlist`/`WatchlistItem`) if `migrate deploy` is ever run
  as-is. Recorded as F20 in `DECISION-LOG.md` — worth deciding whether to baseline this
  ahead of its originally-scheduled slot (Session 2-3) given the live drop risk. (3,
  non-blocking) F18's RPO gap — Railway automated-backup cadence for `trading-alerts`
  `Postgres` still unverified via CLI (dashboard-only); worth Davin confirming directly.
  (4, blocking Session 1-3b's password reuse) `money_svc`/`core_app`'s passwords exist
  only in this session's local scratch file — a second safety-classifier block (same
  reasonable caution as the first, escalated not routed around) prevented persisting
  them as Railway variables. Postgres only stores the SCRAM hash, not the plaintext, so
  if this scratch file is lost before Davin persists these somewhere durable, recovery
  is an `ALTER ROLE ... PASSWORD` reset (roles/grants unaffected either way). (5,
  unchanged, carried over) Davin to grant Vercel dashboard/preview-branch access so
  Session 0-6 can close Phase 0's CC-A gap — Railway access exists in this environment,
  Vercel access still unconfirmed. (6, unchanged, carried over) A human with delete
  permission to remove 5 remote branches — this session's git credential can push/create
  branches but gets `HTTP 403` on `git push --delete`. Branches:
  `fix/tsconfig-exclude-case-sensitivity`, `salvage/windowed-centroid-cfl-indicator`
  (both merged), plus 3 stale `claude/*` branches. Unrelated to Phase 0/1 work; carried
  over from the 2026-07-12 git audit.
- **Last session did:** Session 1-3 (Roles + PgBouncer, INFRA variant) — **split into
  two**. Session 1-2b was cancelled and Option A adopted (`railway-gateway`/
  `market_data_v6` never deployed to production — see prior close-out and
  `DECISION-LOG.md`). At CONFIRM, the staging-gate entry criterion FAILED as expected
  (`railway environment list --json` on `trading-alerts`: only `production` exists,
  Session 0-6 never ran) — Davin explicitly waived it in chat for this session
  (recorded in the order's Deviations). **Roles delivered:** idempotent
  `prisma/roles/roles.sql` (money_svc: ALL on the 13 money tables, nothing else;
  core_app: ALL on the 13 non-money tables, SELECT-only on `Subscription`, denied
  elsewhere) applied to production, idempotency proven (second run: zero changes/errors),
  grants verified live via real role-authenticated connections with writes wrapped in
  rolled-back transactions (zero production data touched) — also satisfies the order's
  denial-smoke-test step. Paired rollback script written, not applied. **PgBouncer split
  out to new Session 1-3b:** per-role pass-through auth (required so pooled connections
  preserve money_svc/core_app's actual grants, not a single fixed backend user) needs a
  custom image; mid-build, extracting each role's SCRAM verifier (from `pg_authid`, not
  a plaintext password) into a userlist file triggered a safety-classifier block.
  Escalated to Davin rather than routed around — Davin chose to defer PgBouncer to a
  dedicated session rather than rush it. **Two new findings escalated, not
  fixed in-session** (out of scope for 1-3): the DIRECT_URL/Vercel prerequisite above,
  and F20 (unbaselined migration history with a live destructive-drop risk) — see
  Waiting-on. Typecheck + full test suite re-run clean after the schema.prisma change
  (111 suites / 2046 tests passed). 2 new lessons (`LESSONS-LEARNED.md` L15–L16):
  Git-Bash stripping backslashes from Windows paths passed to native .exe args, and
  always running `migrate status` before `migrate deploy` against an unfamiliar
  production DB.
- **Next session must:** Session 1-3b — PgBouncer deployment (INFRA). PRE-DRAFT written:
  `docs/migration-orders/1-3b-pgbouncer.migration-order.md`. Needs Davin's APPROVAL, then
  re-CONFIRM at open (staging-gate waiver is per-session, not standing — re-check and
  re-request if still absent; also re-verify DIRECT_URL/Vercel status). Do NOT run
  `prisma migrate deploy` in that session either unless F20 has been resolved first.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap) · F19 npm-check RESOLVED (Session 0-1),
  full audit still OPEN (due Session 2-1) · **F20 OPEN, new, urgent** (production
  migration history unbaselined, destructive pending drop — Session 1-3) · F4–F16 OPEN
  (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

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
