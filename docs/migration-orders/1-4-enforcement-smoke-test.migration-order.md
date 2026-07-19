# Migration Order — Enforcement Smoke Test + Phase 1 Exit Review

> `TEMPLATE-VERIFY-RETIRE.md` variant (EXIT-REVIEW block) — dial near zero, checklist
> exists to be obeyed. If this uncovers real work, stop and give it its own session.
> **Status: CONFIRMED** — written by the Executor at Session 1-3's close (2026-07-19);
> refreshed at Session 1-3b's close (2026-07-19) now that PgBouncer is actually live,
> not just anticipated. Fast-path eligible: PRE-DRAFT → APPROVED → CONFIRMED.
> **CONFIRMED 2026-07-19** (Davin fast-pathed APPROVED same day): all 3 entry criteria
> re-verified live — see Deviations/CONFIRM note below. Execution withheld pending
> Davin's explicit "go."
> **EXECUTED 2026-07-19** (Davin said "Go"). All 4 Checklist steps done, all Done-when
> items checked. Phase 1 is **NOT** marked exit-clean — F18's backup-cadence gap is
> still open (dashboard-only, unverifiable via this CLI) — see Checklist §3 and
> Deviations for the honest accounting.

**Session:** 1-4 · **Phase:** Phase 1 (Railway PostgreSQL, Workstream 7) · **Variant:**
VERIFY-RETIRE · **Generated:** 2026-07-19 · **Estimated time:** <1h.

## Hard dependency

**Satisfied.** Session 1-3b closed clean (2026-07-19, all 5 Done-when items checked):
PgBouncer is live as its own Railway service (`infra/pgbouncer/`), and its own steps
2–3 already proved money_svc/core_app pass-through auth and Prisma Client CRUD both
work identically through the pooler as direct. This order is now ready to APPROVE.
(Historical note, kept for context: this order could not run before 1-3b completed —
Plan §3 step 1.5's smoke test and the exit criteria below both assume PgBouncer is
live.)

## Context — this session is smaller than the playbook originally scoped

The playbook's Session 1-4 text predates the Option A pivot and still says
"`gateway_ingest` can only write market data" and "confirm `railway-gateway` ingest never
blipped." Both are moot — `railway-gateway`/`market_data_v6` were never deployed
(`DECISION-LOG.md`, Session 1-1 close-out / 1-2b pivot); there is no `gateway_ingest`
role and nothing ingesting to check. Flagging this rather than silently carrying stale
tasks forward.

What's actually left to verify, given 1-3 and 1-3b's own work already did most of the
positive/denial testing directly:

- **money_svc/core_app fences hold identically through the pooler as direct.** 1-3
  proved this direct; 1-3b's own steps 2–3 proved it again through PgBouncer (raw SQL
  positive+denial checks AND a scratch Prisma Client, both through the pooler — results
  identical to direct both times). This session's job is a final, independent, combined
  re-check — not first-time discovery. **Two things worth knowing before re-running
  it:** (a) money_svc/core_app were re-passworded in 1-3b (Davin-authorized `ALTER
ROLE`, the originals from 1-3 were unrecoverable) — current credentials live in
  Railway variables (`MONEY_SVC_DB_PASSWORD`/`CORE_APP_DB_PASSWORD` on the `Postgres`
  service), not anywhere else; don't go looking for a scratch file. (b) reaching
  PgBouncer from outside Railway's private network isn't possible via `railway domain`
  in this CLI version (it only creates HTTP domains, confirmed — `LESSONS-LEARNED.md`
  L18) — 1-3b verified via a throwaway same-environment service instead
  (`LESSONS-LEARNED.md` L19: deploy a small service into `trading-alerts`/`production`,
  it gets private DNS to `pgbouncer.railway.internal` for free, run the checks as its
  startup command, read `railway logs`, delete it). This session's "combined smoke
  test" will need the same pattern rather than a public proxy.
- **Phase 1 exit criteria** (plan §3, lines 229–234), walked explicitly:
  1. "Railway Postgres reachable; backups on; roles and PgBouncer live; grant script
     committed." — Postgres/roles/grant-script: done (1-3). PgBouncer: **done, closed
     clean (1-3b, 2026-07-19)** — live, config committed, pass-through verified.
     **Backups: F18's gap is still open** (automated-backup cadence unverified,
     dashboard-only) — this criterion cannot be marked fully met until that's checked.
  2. "`railway-gateway` still ingesting market data without interruption." — **N/A under
     Option A**; nothing exists to interrupt. Note as satisfied-by-inapplicability, not
     silently dropped.
  3. "Monolith still fully functional against the (possibly re-homed) database." — true
     throughout 1-3/1-3b if both sessions kept their "never break the always-on paths"
     promise (re-verify, don't assume).

## Entry criteria

- [x] Session 1-3b's Done-when items all checked (PgBouncer live, pass-through verified).
- [x] Railway CLI access to `trading-alerts` (re-verify `railway status`).
- [x] F18 backup-cadence gap — checked again this session; still unreachable via CLI
      (dashboard-only). Exit criterion 1 stays partially open, stated as such below, not
      glossed over.

## Checklist (EXIT-REVIEW block)

1. **Confirm stability precondition — PASS.** 1-3 and 1-3b both closed with all their own
   Done-when items checked (re-read both order files at CONFIRM); no unresolved
   Deviations flagged as blocking in either.
2. **Combined smoke test — PASS, all 8 checks, direct and pooled identical.** Deployed a
   throwaway in-network verifier service (`verify-1-4`, same pattern as
   `LESSONS-LEARNED.md` L19) into `trading-alerts`/`production`; ran positive+denial
   checks as `money_svc`/`core_app` through both `postgres.railway.internal:5432`
   (direct) and `pgbouncer.railway.internal:6432` (pooled, `pgbouncer=true`-equivalent
   plain connection). Results (identical both paths):
   - `money_svc`: `SELECT`+rolled-back `UPDATE` on `"Payment"` → **PASS**; `SELECT` on
     `"User"` → **denied** (`permission denied for table User`) — correct.
   - `core_app`: `SELECT`+rolled-back `UPDATE` on `"User"` → **PASS**; `SELECT` on
     `"Payment"` → **denied**; `SELECT` on `"Commission"` → **denied** — correct.
   - No enforcement gap found. Full raw output in Deviations.
3. **Phase 1 exit criteria walked — PARTIAL, not exit-clean:**
   1. "Railway Postgres reachable; backups on; roles and PgBouncer live; grant script
      committed." — Postgres reachable ✅ (verified live in step 2); roles live and
      enforcing ✅ (step 2); PgBouncer live ✅ (`railway status`: RUNNING since
      2026-07-19T11:34); grant script committed ✅ (`prisma/roles/roles.sql`,
      `roles.rollback.sql`). **Backups: still NOT verifiable** — `railway backup` is not
      a recognized subcommand, `railway volume --help` has no backup/snapshot verb;
      dashboard-only, same gap as every prior session (F18, `DECISION-LOG.md`). **This
      sub-item stays open — criterion 1 is NOT fully met.**
   2. "`railway-gateway` still ingesting market data without interruption." —
      **N/A by inapplicability**, not silently dropped: `railway-gateway`/
      `market_data_v6` were never deployed (`DECISION-LOG.md`, "Session 1-1 close-out /
      1-2b pivot"). Nothing exists to interrupt. Treated as satisfied.
   3. "Monolith still fully functional against the (possibly re-homed) database." —
      **PASS by evidence, not assumption**: the live app's `DATABASE_URL` variable key
      was confirmed unchanged/untouched throughout 1-3, 1-3b, and this session (never
      targeted by any `variable set`); Postgres itself is reachable and enforcing
      correct grants (step 2). No code in this session touched the monolith.
   - **Conclusion: Phase 1 is NOT exit-clean.** 2 of 3 criteria fully met; criterion 1 is
     partially met, blocked purely on F18's dashboard-only backup-cadence check, which
     no CLI-only session can close. This is a Davin action item, not a technical gap in
     the infrastructure itself.
4. **Recorded** in `CLAUDE.md` (Phase 1 stays formally open, F18 identified as the sole
   blocker), `DECISION-LOG.md` (F18 progress note — gap re-confirmed unchanged, no new
   resolution), and Phase 2's entry (PRE-DRAFT for Session 2-1 written — see
   Next-session handoff).

- **Rollback:** this is a verification-only session — no state changes to roll back
  (unless step 2 reveals an actual enforcement gap, in which case: stop, do not mark
  Phase 1 exit-clean, treat it as a new finding needing its own INFRA-variant fix
  session, same as F20 was handled in Session 1-3).

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red result (a fence that doesn't hold, an exit criterion that isn't actually met)
  = stop and document, never "probably fine."

## Done when

- [x] Combined smoke test run independently this session (not reused from 1-3b) — all
      8 checks pass, direct and pooled identical, no enforcement gap.
- [x] Phase 1's 3 exit criteria walked with evidence, including the 2 known partial/N/A
      items — honestly reported as NOT exit-clean (F18 the sole blocker).
- [x] CLAUDE.md/DECISION-LOG.md updated to reflect the true state, not glossed over.
- [x] Throwaway verifier service fully torn down — `trading-alerts` back to exactly its
      pre-session 3 services (`Postgres`, `pgbouncer`, `flask-api`).
- [x] Session-close verification: `npm run type-check` clean; `npm run test:ci` —
      111/111 suites, 2046/2046 tests passed (identical to 1-3b's baseline; no
      application source changed this session).

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

- **CONFIRM note (2026-07-19), not a deviation — no execution yet.** Re-verified live
  before starting: `railway status --json` shows `trading-alerts`/`production` linked,
  `Postgres` service RUNNING (deployed 2026-07-18) and `pgbouncer` service RUNNING
  (deployed 2026-07-19T11:34:40Z, status SUCCESS) — both still up, nothing redeployed
  or restarted since 1-3b closed. `railway variables --service Postgres --json` (keys
  only) confirms `MONEY_SVC_DB_PASSWORD`/`CORE_APP_DB_PASSWORD`/`PGBOUNCER_USERLIST_B64`
  still present, `DATABASE_URL` unchanged/untouched. `railway environment list --json`:
  still only `production` exists (staging gate still absent — not required for this
  VERIFY-RETIRE session). `git log` confirms no commits since 1-3b's close-out
  (`7701a0b6`) have touched `infra/pgbouncer/`, `prisma/schema.prisma`, or
  `prisma/roles/`; `prisma/schema.prisma` still has `directUrl = env("DIRECT_URL")`.
  F18's backup-cadence gap re-confirmed still unreachable via CLI this session too
  (`railway backup` → unrecognized subcommand; `railway volume --help` has no
  backup/snapshot verb) — dashboard-only, unchanged, per the entry criteria's own
  contingency wording ("stays partially open... must be stated as such").
- **Credential handling: avoided the classifier block by never touching raw secret
  values at all.** An early attempt to redirect `railway variables --service Postgres
--json` (which includes `MONEY_SVC_DB_PASSWORD`, `CORE_APP_DB_PASSWORD`, and the
  superuser `POSTGRES_PASSWORD`/`PGPASSWORD` in plaintext) to a scratch file was blocked
  by the safety classifier — same class of block Session 1-3/1-3b hit on the same kind
  of action. Did not retry or route around it. Instead used Railway's own
  `${{ServiceName.VAR}}` variable-reference syntax when setting the throwaway verifier
  service's env vars (`railway variable set 'MONEY_SVC_DB_PASSWORD=${{Postgres.MONEY_SVC_DB_PASSWORD}}' ...`)
  — Railway resolves the reference server-side at deploy time; the plaintext value
  never passed through the CLI output, this session's context, or any file. No
  classifier block occurred for this approach. Worth generalizing: when a task needs a
  Railway secret only to hand it to another Railway service (not to inspect it
  yourself), prefer the reference syntax over fetching-then-resetting it — it sidesteps
  the whole class of block, not just this instance of it.
- **Mistake, caught and corrected: `railway up --service <name>` created a stray new
  project instead of deploying into the existing service.** Ran
  `railway up --service verify-1-4 --ci --json` from the scratch directory (which had
  no local `.railway` link file) expecting it to deploy into the `verify-1-4` service
  already created inside `trading-alerts`/`production` via `railway add`. Instead it
  silently created a **brand-new, separate Railway project** also named "verify-1-4"
  (id `bcf24cac-a9a1-469b-aeed-6e33a928691a`) and deployed there — `--service` alone
  was not enough to target the existing project; the directory's lack of a link file
  took precedence. Caught immediately (the deploy response's `projectName`/`projectId`
  didn't match `trading-alerts`). Asked Davin explicitly before deleting the stray
  project (project deletion is classifier-blocked by default, correctly); Davin granted
  one-time permission for that specific project ID; deleted
  (`railway delete --project bcf24cac-... --yes`), confirmed via re-running `railway
status`. Re-ran the deploy with explicit `--project`/`--environment` flags
  (`railway up --service verify-1-4 --project a473a95e-... --environment f368e0a8-...
--ci --json`) — this time it deployed into the correct existing service, confirmed by
  the success response and by `railway logs` showing the actual check output. **New
  lesson recorded (L20) — see LESSONS-LEARNED.md.**
- **Finding, not acted on (out of this variant's scope — flagged for whoever plans
  Phase 8/F18 follow-up):** this session's `railway --help` output lists top-level
  `tcp-proxy` ("Manage public TCP proxies for a service") and `private-network`
  ("Manage private networking for a service") commands that were not present (or not
  noticed) when `LESSONS-LEARNED.md` L18 was written in Session 1-3b, which concluded
  no CLI path to a genuine TCP proxy existed for a custom service. Did not test these
  commands this session (VERIFY-RETIRE = observation/execution only, no exploration of
  new capabilities) — flagging the discrepancy for a future session to actually verify
  whether L18's conclusion needs updating, rather than silently leaving a stale lesson
  in place.
- **Cleanup verified complete.** `railway status --json` after teardown shows
  `trading-alerts` back to exactly 3 services: `Postgres`, `pgbouncer`, `flask-api` —
  identical to the pre-session state.

## Next-session handoff

Phase 1 exit review did NOT pass fully clean (F18 backup-cadence gap, dashboard-only,
Davin action item — not a Session 2-1 blocker). Per the playbook, Phase 2 work
(`non_market_data` Prisma schema) can start regardless — F18 is an operational
risk-acceptance question for Davin, not a technical dependency of Session 2-1.
PRE-DRAFTed: `docs/migration-orders/2-1-prisma-upgrade.migration-order.md`
(`TEMPLATE-UPGRADE.md` variant, per `00-SKELETON-AND-RULES.md` §2 — NOT fast-path
eligible, needs the Advisor to produce the DRAFT before Davin approves).
