# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 1, Session 1-4 (complete — combined enforcement smoke test passed;
  Phase 1 formally NOT exit-clean, F18 the sole blocker) — 2026-07-19. Phase 0 still
  formally open (CC-A gap unchanged, see below).
- **Current order:** `docs/migration-orders/1-4-enforcement-smoke-test.migration-order.md`
  (CONFIRMED, executed, all Done-when items checked)
- **Order status:** EXECUTED — `money_svc`/`core_app` positive+denial checks re-run
  independently through both direct (`postgres.railway.internal:5432`) and pooled
  (`pgbouncer.railway.internal:6432`) connections: all 8 checks pass, identical both
  paths, no enforcement gap. Phase 1's 3 exit criteria walked with evidence: criteria 2
  (railway-gateway ingestion) and 3 (monolith functional against the DB) both PASS;
  criterion 1 (Postgres/roles/PgBouncer/grants/**backups**) is only partially met —
  everything except the automated-backup-cadence check (F18) is confirmed live.
  **Phase 1 is therefore NOT marked exit-clean** — this is a Davin dashboard-check
  action item, not a technical gap in the infra itself. Live app's `DATABASE_URL`
  untouched throughout, as in every prior Phase 1 session.
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
  templates. (8, new, non-blocking) Session 1-4's `railway --help` output shows
  top-level `tcp-proxy` and `private-network` commands that weren't present/noticed
  when item (7) above was written — possibly this CLI conclusion is stale. Not tested
  (out of scope for that session's VERIFY-RETIRE variant); worth a future session
  actually checking whether `railway tcp-proxy` supersedes the item-(7) workaround.
- **Last session did:** Session 1-4 (Enforcement smoke test + Phase 1 exit review,
  VERIFY-RETIRE variant) — CONFIRM re-verified all 3 entry criteria live (PgBouncer
  RUNNING, Railway CLI access, F18 still dashboard-only), executed on Davin's explicit
  "go." **Combined smoke test:** deployed a throwaway in-network verifier service
  (`verify-1-4`, `LESSONS-LEARNED.md` L19 pattern) into `trading-alerts`/`production`;
  ran `money_svc`/`core_app` positive+denial checks through both the direct
  (`postgres.railway.internal:5432`) and pooled (`pgbouncer.railway.internal:6432`)
  connections — all 8 checks pass identically both paths (`money_svc`: own-table
  read+rolled-back-write on `Payment` OK, `User` denied; `core_app`: own-table
  read+rolled-back-write on `User` OK, `Payment`/`Commission` denied). No enforcement
  gap. **Phase 1 exit criteria walked:** criterion 1 (Postgres/roles/PgBouncer/grants/
  backups) only partially met — backups still unverifiable via CLI (F18, re-confirmed
  unchanged); criteria 2 (railway-gateway) and 3 (monolith functional) both PASS.
  **Phase 1 is NOT marked exit-clean** — reported honestly rather than glossed over.
  **One real mistake, caught and corrected:** `railway up --service verify-1-4` from an
  unlinked scratch directory silently created a stray NEW Railway project instead of
  deploying into the already-created service inside `trading-alerts` — caught
  immediately via the deploy response's project name/ID mismatch. Asked Davin before
  deleting the stray project (destructive, classifier-blocked by default); Davin granted
  one-time permission for that specific project ID; deleted, confirmed gone; redeployed
  correctly using explicit `--project`/`--environment` flags. New lesson recorded
  (`LESSONS-LEARNED.md` L20). Verifier service fully torn down after — `trading-alerts`
  back to exactly its 3 original services. Also avoided re-triggering the credential
  classifier block (same class Session 1-3/1-3b hit) by using Railway's
  `${{Service.VAR}}` reference syntax for the verifier's password env vars — the actual
  secret values never passed through this session at all. Typecheck clean; full test
  suite re-run clean at session close (111 suites / 2046 tests passed — identical to
  Session 1-3b's baseline, no application source changed). One finding flagged, not
  acted on: `railway --help` now lists `tcp-proxy`/`private-network` commands not
  present when L18 was written — possibly stale, needs a future session to verify.
- **Next session must:** Session 2-1 — Prisma 6.19.2 → 7.8.0 upgrade in isolation
  (UPGRADE variant, F19 full audit). PRE-DRAFTed:
  `docs/migration-orders/2-1-prisma-upgrade.migration-order.md` — currently
  **PRE-DRAFT** (NOT fast-path eligible; needs the Advisor to produce the DRAFT, then
  Davin's APPROVAL, before a future session CONFIRMs and executes). Phase 1's open F18
  gap is explicitly NOT a blocker for this session (operational risk-acceptance
  question for Davin about the existing Postgres instance, unrelated to the Prisma
  client version) — flagged in the PRE-DRAFT's own Context section so 2-1 doesn't have
  to rediscover that reasoning.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · F19 npm-check RESOLVED (Session 0-1),
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
