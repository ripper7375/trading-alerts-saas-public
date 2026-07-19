# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 1, Session 1-3b (complete — PgBouncer live, pass-through auth
  verified) — 2026-07-19. Phase 0 still formally open (CC-A gap unchanged, see below).
- **Current order:** `docs/migration-orders/1-3b-pgbouncer.migration-order.md`
  (CONFIRMED, executed, all 5 Done-when items checked)
- **Order status:** CONFIRMED — PgBouncer deployed to `trading-alerts`/`production` as
  its own Railway service (config committed at `infra/pgbouncer/`); money_svc/core_app
  pass-through auth and Prisma Client CRUD both verified through the pooler, identical
  to the direct-connection results; `prisma migrate status` still resolves via
  `DIRECT_URL`. Live app's `DATABASE_URL` untouched throughout.
- **Waiting on:** (1, blocking any push) `prisma/schema.prisma`'s `directUrl =
env("DIRECT_URL")` (commit `85e60fbc`) **is already on `origin/main`** — this note was
  stale as of Session 1-3b's CONFIRM; a fresh `git fetch` showed it had been pushed.
  Separately (and worse than the originally-predicted `P1012`): `deploy.yml` is
  currently failing on **every** push to `main` at the GitHub workflow-file level,
  before the build step even runs (`gh run list`/`gh run view`: "likely failed because
  of a workflow file issue", 0s runtime) — confirmed this predates the `directUrl`
  change (same failure on `docs`-only commits back through Session 0-3). No Vercel
  access exists in this environment to add `DIRECT_URL` or diagnose `deploy.yml`
  itself. **Davin must add `DIRECT_URL` to Vercel production env vars AND diagnose why
  `deploy.yml` fails immediately on every push** before trusting any future push to
  actually deploy. (2, urgent) Production's Prisma migration history is completely
  unbaselined (`prisma migrate status`: all 6 migrations unapplied server-side), and one
  pending migration (`drop_watchlists`) would DROP two live, data-holding tables
  (`Watchlist`/`WatchlistItem`) if `migrate deploy` is ever run as-is. Recorded as F20 in
  `DECISION-LOG.md`, unchanged by Session 1-3b (confirmed still open via a fresh
  read-only `migrate status` check) — worth deciding whether to baseline this ahead of
  its originally-scheduled slot (Session 2-3) given the live drop risk. (3, non-blocking)
  F18's RPO gap — Railway automated-backup cadence for `trading-alerts` `Postgres` still
  unverified via CLI (dashboard-only); worth Davin confirming directly. (4, RESOLVED
  Session 1-3b) money_svc/core_app's passwords were reset (Davin-authorized
  `ALTER ROLE`) and are now durably persisted as Railway variables
  (`MONEY_SVC_DB_PASSWORD`/`CORE_APP_DB_PASSWORD` on the `Postgres` service) — no longer
  dependent on any session's local scratch file. (5, unchanged, carried over) Davin to
  grant Vercel dashboard/preview-branch access so Session 0-6 can close Phase 0's CC-A
  gap — Railway access exists in this environment, Vercel access still unconfirmed. (6,
  unchanged, carried over) A human with delete permission to remove 5 remote branches —
  this session's git credential can push/create branches but gets `HTTP 403` on
  `git push --delete`. Branches: `fix/tsconfig-exclude-case-sensitivity`,
  `salvage/windowed-centroid-cfl-indicator` (both merged), plus 3 stale `claude/*`
  branches. Unrelated to Phase 0/1 work; carried over from the 2026-07-12 git audit. (7,
  new, non-blocking) This CLI version of `railway` (5.27.0) has no command to create a
  genuine TCP proxy for a custom service — `railway domain` only creates HTTP(S)
  domains, and `railway config pull` (the IaC path) needs an SDK not installed here.
  Worth Davin's awareness if a future session needs real (non-verification) public
  reachability to a Railway service that isn't one of their official database
  templates.
- **Last session did:** Session 1-3b (PgBouncer deployment, INFRA variant) —
  **CONFIRM found a real blocker (not the staging gate this time): money_svc/core_app's
  passwords existed nowhere reachable** — not in Railway variables, and Session 1-3's
  local scratch file didn't carry over to this session. Escalated rather than routed
  around; Davin explicitly authorized (a) an `ALTER ROLE ... PASSWORD` reset for both
  roles and (b) durably persisting the new passwords + PgBouncer's SCRAM userlist to
  Railway variables. Staging gate was also explicitly waived again for this session
  (per-session, not standing — same as 1-3). **Delivered:** `infra/pgbouncer/`
  (Alpine + PgBouncer 1.22.1, `scram-sha-256` pass-through auth, transaction pooling,
  no fixed backend user — hit and fixed a real bug locally first, Alpine's `pgbouncer`
  package has no built-in service user and refuses to run as root); deployed as its own
  Railway service in `trading-alerts`/`production`; money_svc/core_app re-verified live
  with the new passwords (direct connection) and again through the pooler — identical
  fences hold both ways; scratch Prisma Client CRUD verified through the pooler for both
  roles; `prisma migrate status` reconfirmed clean via `DIRECT_URL` (F20 unchanged,
  `migrate deploy` not run). **One tooling gap found and worked around, not fixed:**
  `railway domain` only creates HTTP(S) domains, not a genuine TCP proxy, so reaching
  the new pooler from outside Railway's network (needed to run the verification) wasn't
  possible that way — substituted a throwaway in-network verifier service (deployed,
  ran the checks against `pgbouncer.railway.internal`, read its logs, deleted) instead
  of pursuing public exposure further. All 5 Done-when items checked; PgBouncer stands
  deployed, nothing rolled back. Typecheck clean; full test suite re-run clean at
  session close (111 suites / 2046 tests passed — identical counts to Session 1-3's
  baseline, since no application source changed). 3 new lessons
  (`LESSONS-LEARNED.md` L17–L19): the
  Alpine `pgbouncer` non-root fix, the `railway domain` vs. TCP-proxy gap, and the
  private-in-network-verifier pattern for testing a pooler without public exposure.
- **Next session must:** Session 1-4 — Enforcement smoke test + Phase 1 exit review
  (VERIFY-RETIRE, fast-path eligible). PRE-DRAFTed:
  `docs/migration-orders/1-4-enforcement-smoke-test.migration-order.md` — currently back
  at **PRE-DRAFT** (Davin reverted an earlier premature APPROVAL before Session 1-3b had
  actually run; needs a fresh APPROVAL now that the hard dependency is genuinely
  satisfied). Its own Context section should get a quick read-through before
  re-APPROVAL — it describes a combined direct+pooled re-verification that Session 1-3b
  already did once as part of its own steps 2–3, so 1-4 should treat that as a prior
  data point, not skip its own independent pass (same "roles are mutable" caution 1-3b
  itself opened with). F18's backup-cadence gap is still the one item that may keep
  Phase 1 from closing exit-clean — unchanged, still dashboard-only, worth Davin
  checking directly before or during that session.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap) · F19 npm-check RESOLVED (Session 0-1),
  full audit still OPEN (due Session 2-1) · **F20 OPEN, urgent** (production migration
  history unbaselined, destructive pending drop — found Session 1-3, reconfirmed
  unchanged Session 1-3b) · F4–F16 OPEN
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
