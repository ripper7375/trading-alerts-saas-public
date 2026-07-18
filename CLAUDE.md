# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 1, Session 1-1 (complete) — 2026-07-18. Phase 0 still formally
  open (CC-A gap unchanged, see below) — Phase 1 work continues ahead of Phase 0's close
  at Davin's explicit direction, same precedent set when Session 1-1 was PRE-DRAFTED.
- **Current order:**
  `docs/migration-orders/1-1-find-database-restore-rehearsal.migration-order.md`
  (CONFIRMED, executed — all 4 steps done)
- **Order status:** CONFIRMED — executed 2026-07-18, all "Done when" boxes checked.
- **Waiting on:** (1, resolved this close-out, now superseded — see below) the
  market_data_v6 scope-gap question from Session 1-1 is **decided**: Davin + the Advisor
  chose to consolidate `market_data_v6` into the unified `trading-alerts`/`maglev`
  instance _before_ Session 1-3, via new **Session 1-2b** (DRAFT order already written by
  the Advisor: `docs/migration-orders/1-2b-locate-market-data.migration-order.md`; the
  playbook and `SESSION-PROMPT-SCRIPT.md` were updated to match, committed `ba1003b4`).
  **New blocking item:** Session 1-2b is still `DRAFT`, not `APPROVED` — needs Davin's
  sign-off (plus its own entry criteria: `railway-gateway`'s actual production
  `DATABASE_URL`) before the Executor can CONFIRM and execute it. **Worth Davin's explicit
  attention before approving:** 1-2b's step 4 (repoint `railway-gateway`'s `DATABASE_URL`
  to the unified instance) touches the `railway-gateway` ingest path — this repo's own
  standing do-not-touch list (`EXECUTOR-PROTOCOL.md` §5) designates that path as "touched
  only where an order says so (Phase 8.2)," i.e. much later in the plan. Doing it here in
  Phase 1 may be the right call (Stage A's "one instance" target arguably requires it),
  but it's a deviation from that standing rule worth Davin/the Advisor confirming
  knowingly, not something the Executor should wave through silently at CONFIRM.
  (2, non-blocking, carried over) F18's RPO gap — whether Railway automated backups are actually
  enabled for the `trading-alerts` `Postgres` service couldn't be checked via CLI
  (dashboard-only); worth Davin confirming directly. (3, unchanged, carried over) Davin
  to grant Vercel dashboard/preview-branch access so Session 0-6 can close Phase 0's CC-A
  gap — Railway access now exists in this environment (granted this session), but Vercel
  access for Session 0-6's own scope is still unconfirmed. (4, unchanged, carried over) A
  human with delete permission to remove 5 remote branches — this session's git
  credential can push/create branches but gets `HTTP 403` on `git push --delete`.
  Branches: `fix/tsconfig-exclude-case-sensitivity`, `salvage/windowed-centroid-cfl-indicator`
  (both merged), plus 3 stale `claude/*` branches. Unrelated to Phase 0/1 work; carried
  over from the 2026-07-12 git audit.
- **Last session did:** Session 1-1 (find the database + restore rehearsal, CONTRACT
  variant). At CONFIRM, entry criterion 2 (Railway access + DB credentials) initially
  FAILED — neither was present in this environment despite the order being APPROVED;
  Davin then set up Railway CLI auth + `.env.local`'s `DATABASE_URL` live, re-verified,
  order moved to CONFIRMED. **F3 resolved** (`DECISION-LOG.md`): monolith's live Postgres
  is the `trading-alerts` Railway project's `Postgres` service (host
  `maglev.proxy.rlwy.net`) — on Railway, but a **different instance** than whatever
  `railway-gateway` writes `market_data_v6` to (confirmed: this instance's 2 databases
  contain no `market_data`-named table; no `railway-gateway`/`gateway` project or service
  exists anywhere in this Railway account). Two real mid-session findings, both escalated
  to Davin rather than assumed: (a) `.env.local` initially pointed to the **wrong**
  Railway project (`postgre for staging`, not `trading-alerts`) — caught by the order's
  mandatory two-source cross-check, Davin corrected it to the value copied from Vercel
  production; (b) the corrected target's `Postgres` service was found **Offline**
  (sibling `flask-api` **Failed**) — Davin manually redeployed (confirmed restart of the
  existing volume, not a fresh/data-losing instance) and it came Online. **Restore
  rehearsal** (`docs/db-restore-rehearsal.md`): `pg_dump` (Docker `postgres:17-alpine`,
  connection string never printed) → isolated localhost-only scratch Docker container →
  `pg_restore` → **exact row-count match across all 26 tables** → app booted clean against
  `.env.scratch` (`.env.local` never touched) → `GET /` `HTTP 200` ×2, zero DB errors in
  logs → everything torn down (scratch container removed, dump file + temp scripts
  deleted, confirmed via `git status`/`docker ps -a`). **F18 recorded** (RPO ≤ 24h,
  RTO ≤ 1h target) with an explicit gap: automated-backup cadence unverifiable via CLI.
  **Backup mechanism deviated from the order's suggested wording** ("Railway's native
  snapshot" → used `pg_dump` instead, CLI has no backup/snapshot subcommand) — noted in
  the order's Deviations and F18's Decision Log entry. **New scope question surfaced for
  Phase 1's remaining sessions:** Plan §3 Stage A's target is one instance hosting both
  `market_data_v6` and `non_market_data` — this session found they're on different
  instances (and `railway-gateway`'s own instance is still unlocated), which neither the
  playbook's Session 1-2 conditional nor Session 1-3's roles/PgBouncer-only scope
  anticipated. Flagged prominently in Session 1-3's PRE-DRAFT rather than silently
  absorbed. 4 new lessons recorded (`LESSONS-LEARNED.md` L12–L14): Git-Bash Docker
  bind-mount path mangling (`MSYS_NO_PATHCONV=1`), `postgres:17` pull flakiness on this
  network (`-alpine` variant worked), and a backgrounded dev server's launch PID not
  being its actual listening PID.
- **Next session must:** Session 1-2b — Locate and migrate `market_data_v6` (INFRA).
  DRAFT written by the Advisor: `docs/migration-orders/1-2b-locate-market-data.migration-
order.md` (not generated by the Executor — see "Waiting on" #1 for the Phase-8.2
  standing-rule note worth reviewing before APPROVING it). Needs Davin's APPROVAL, then
  the Executor's CONFIRM (re-verify entry criteria + runtime state, same as every other
  session), before execution. Session 1-3's own entry criteria already correctly depend
  on 1-2b completing first (`docs/migration-orders/1-3-roles-pgbouncer.migration-
order.md`). Session 1-2 ("Relocate database to Railway," the original playbook session)
  remains correctly SKIPPED per its own conditional (F3 = already on Railway) — 1-2b is a
  distinct, newly-inserted session, not a revival of 1-2.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap) · F19 npm-check RESOLVED (Session 0-1),
  full audit still OPEN (due Session 2-1) · F4–F16 OPEN (register: plan §11 ·
  resolutions: `docs/migration-orders/DECISION-LOG.md`)

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
