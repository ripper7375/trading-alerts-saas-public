# Migration Order — Roles + PgBouncer (Plan §3 Stage A)

> `TEMPLATE-INFRA.md` variant — this session provisions/configures a live system (Postgres
> roles, PgBouncer). Read `00-SKELETON-AND-RULES.md` §4 first. **Creativity dial: Medium**
> (the approach to deploying PgBouncer is flexible; the role names and grants are fixed by
> Plan §3).

**Session:** 1-3 · **Phase:** Phase 1 (Railway PostgreSQL, Workstream 7) · **Variant:** INFRA
· **Status:** CONFIRMED · **Generated:** 2026-07-18 · **Confirmed:** 2026-07-19 ·
**Flags touched:** none new (executes Plan §3 Stage A directly).

## Context carried over from Session 1-1 & 1-2b investigation

- **F3 finding** (`DECISION-LOG.md`): the monolith's live Postgres is the `trading-alerts`
  Railway project's `Postgres` service (`maglev.proxy.rlwy.net`). Confirmed via direct
  query that **this instance does NOT contain `market_data_v6`**.
- **Crucial Discovery (The 1-2b investigation):** The `market_data_v6` database and the `railway-gateway` backend were architected but **never deployed to production**. Therefore, `market_data_v6` does not exist in _any_ database yet, and `railway-gateway` is not running.
- **Option A Decision:** Because the gateway does not exist, we are executing **Option A**. This session proceeds with setting up roles and PgBouncer for the existing monolith (`maglev`) only. We explicitly **drop** the `gateway_ingest` role from this session's scope. Consolidation of `market_data_v6` will be handled in a future phase if and when the gateway is built.
- **F18 finding:** RPO/RTO targets recorded (RPO ≤ 24h, RTO ≤ 1h), with an open gap —
  whether Railway's automated backups are actually enabled for the `trading-alerts`
  `Postgres` service could not be verified via CLI (dashboard-only feature, not checked).
  Worth confirming before this session, since role/PgBouncer changes are easier to trust
  if backups are known-good first.
- **Playbook scope** (`monolith-to-microservices-migration-session-playbook.md`, Session
  1-3): "Write idempotent `prisma/roles/roles.sql` creating `money_svc`, `core_app`
  with the plan §3 grants; apply it. Deploy PgBouncer (transaction mode);
  verify Prisma runtime works through the pooler and migrations run on the direct URL."
- **Plan §3 grants** (exact, do not redesign):
  - `money_svc` — ALL privileges on the 10 money tables (`AffiliateProfile`,
    `AffiliateCode`, `Commission`, `Payment`, `Subscription`, `SystemConfig`(+`History`),
    `FraudAlert`, `AffiliateRiseAccount`, `PaymentBatch`, `DisbursementTransaction`,
    `RiseWorksWebhookEvent`, `DisbursementAuditLog`); SELECT on nothing else.
  - `core_app` — no privileges on money tables (temporary read-only grant on `Subscription`
    during transition, revoked at cutover).
  - PgBouncer in front, transaction-pooling mode; Prisma migrations go through the DIRECT
    url, runtime traffic through the pooled url (never swap them — `LESSONS-LEARNED.md`
    L3).

## Entry criteria

- [ ] F18's backup-cadence gap checked (Railway dashboard Backups tab) — not strictly
      blocking, but should be known before trusting role changes on this instance.
      **Still unchecked at CONFIRM** (dashboard-only, no browser session available this
      session either) — non-blocking per this criterion's own wording, carried forward.
- [x] Railway CLI access to the `trading-alerts` project — **re-verified live at CONFIRM**
      (`railway status`: linked to `trading-alerts`/`production`, `Postgres` service
      Online).
- [x] Blast-radius statement: role creation and grant changes are additive and reversible
      (`DROP ROLE`/`REVOKE`); the real risk is PgBouncer misconfiguration breaking the
      live monolith's DB connectivity. **Staging verification is NOT possible** — `railway
  environment list --json` on `trading-alerts` confirms only one environment
      (`production`) exists; Session 0-6 (which would create a staging shell) has not
      run. **Davin explicitly waived the staging gate for this session in chat
      (2026-07-19)** — see Deviations.

## Ordered steps

_(each step = change → immediate verification → rollback note; stage before production)_

1. **Write `prisma/roles/roles.sql`** — idempotent (`CREATE ROLE IF NOT EXISTS` /
   `DO $$ ... $$` guards), creating `money_svc` and `core_app` with exactly
   the grants in Context above.
   _Verify:_ script is idempotent — running it twice produces no errors/changes the
   second time.
   _Rollback:_ paired `DROP ROLE`/`REVOKE` script, not applied unless needed.
2. **Apply the grant script** to the `trading-alerts` `Postgres` instance.
   _Verify:_ connect as each role directly; confirm `money_svc` can read/write its 10
   tables and gets permission-denied on everything else; `core_app` gets permission-denied
   on money tables (except the temporary `Subscription` read).
   _Rollback:_ re-run the paired revoke script.
3. **Deploy PgBouncer** (Railway template or sidecar) in transaction-pooling mode in
   front of the `trading-alerts` `Postgres` service.
   _Verify:_ Prisma runtime connects through the pooled URL (`pgbouncer=true` flag) and
   works for basic CRUD; `prisma migrate deploy` still targets the DIRECT url and
   succeeds (per L3 — never swap these).
   _Rollback:_ point traffic back at the direct URL, tear down the PgBouncer service.
4. **Denial smoke test** (mirrors Session 1-4's later, fuller version, but a lightweight
   check here is worth doing immediately): as `money_svc`, attempt `SELECT * FROM
"User"` — must FAIL. As `core_app`, attempt `SELECT * FROM "Payment"` — must FAIL.
   _Verify:_ both denials confirmed, documented with the exact error.

## Rules specific to this variant

- **Nothing dashboard-only.** `roles.sql` and any PgBouncer config land in a committed
  file — never a Railway-dashboard-only setting undocumented anywhere.
- Production changes only after the identical change succeeds in staging — but note
  Session 0-5/0-6 status: staging (Railway shells) may still not exist depending on
  whether Session 0-6 has run; if not, escalate rather than skipping the staging gate.
- **Never break the always-on paths:** the live monolith's current DB connectivity must
  not blip while PgBouncer is being introduced — state explicitly, at each step, how it
  avoids disrupting current traffic.
- Secrets: role names/grants documented here and in the secret matrix if new
  connection-string variables are introduced; values only in Railway, never in git.

## Done when

- [x] `prisma/roles/roles.sql` committed, applied, idempotency verified. **DONE** — applied
      to `trading-alerts` production Postgres; re-run produced no changes/errors.
- [x] Role grants verified live (positive + negative/denial checks) for `money_svc` and
      `core_app`. **DONE** — real role-authenticated connections, writes wrapped in
      rolled-back transactions (zero production data touched). `money_svc`: reads/writes
      its 13 tables, denied on `User`/`Account`. `core_app`: reads/writes its 13 tables,
      SELECT-only on `Subscription`, denied on `Payment`/`Commission`. Also satisfies
      step 4's denial smoke test.
- [ ] PgBouncer live; Prisma runtime works through the pooler; migrations confirmed still
      using the direct URL. **SPLIT OUT to a new Session 1-3b** — see Deviations. Not
      done in this session.

## Rollback

Role creation/grants are reversible via paired `DROP ROLE`/`REVOKE` scripts (written but
not applied unless needed). PgBouncer introduction is reversible by re-pointing traffic to
the direct URL and removing the PgBouncer service. If aborted mid-session, no destructive
or hard-to-reverse action should have been taken — confirm before ending the session.

## Deviations

- **Staging gate waived by Davin (2026-07-19).** This variant's own rule requires
  production changes only after the identical change succeeds in staging. At CONFIRM,
  `railway environment list --json` showed `trading-alerts` has exactly one environment
  (`production`) — Session 0-6, which would create the Railway staging shell, has not
  run (Vercel access for it still unconfirmed per CLAUDE.md). Per the order's own
  instruction ("if not, escalate rather than skipping the staging gate"), this was
  escalated in chat rather than silently skipped. Davin's explicit response: _"I
  explicitly waive the staging gate requirement for Session 1-3... proceed with
  executing Session 1-3 directly against production."_ Impact: role-grant and PgBouncer
  changes below are verified directly against production via narrow, reversible checks
  (not a full staging rehearsal first) — extra care taken at each step per the variant's
  "never break the always-on paths" rule (see steps 2–3 below for exactly how each step
  avoids disrupting current traffic).

- **PgBouncer split out to a new Session 1-3b (Davin's call, 2026-07-19).** Getting this
  right requires per-role pass-through auth — PgBouncer must forward each client's own
  authenticated role (`money_svc`, `core_app`) to the backend unchanged, or the whole
  point of this session's role separation is defeated the moment traffic goes through
  the pooler. The common single-user PgBouncer Docker images don't support that out of
  the box; a custom image (Dockerfile + SCRAM-verifier userlist pulled from
  `pg_authid`, fed in via a Railway-only base64 variable, never plaintext, never in git)
  was designed but not finished — mid-build, a safety classifier correctly flagged the
  credential-extraction step for review. Rather than route around it, this was escalated
  to Davin, who chose to defer PgBouncer entirely to a dedicated follow-up session
  (Session 1-3b, PRE-DRAFTed below) rather than rush it. money_svc/core_app (this
  session's actual scope) are unaffected — they're fully created, granted, and verified
  independent of PgBouncer's existence.

- **`directUrl` added to schema.prisma without yet touching Vercel.** Per L3, migrations
  need a direct (non-pooled) connection distinct from runtime traffic — added
  `directUrl = env("DIRECT_URL")` to the datasource block now, ahead of Session 1-3b,
  and set `DIRECT_URL` in `.env.local` (same value as today's `DATABASE_URL` — identical
  connection until PgBouncer exists). **This change is committed locally but NOT
  pushed to origin.** `deploy.yml` auto-deploys to Vercel on every push to `main`, and
  Vercel's build runs `prisma generate`/validate using its own env vars — without
  `DIRECT_URL` set there first, that step fails (reproduced locally: `Error:
Environment variable not found: DIRECT_URL`, P1012). No Vercel dashboard/CLI access
  exists in this environment to add it directly (same gap CLAUDE.md already tracks for
  Session 0-6). Blocking prerequisite before any push — see CLAUDE.md Waiting-on.

- **money_svc/core_app passwords are currently only in a local scratch file, not
  Railway.** Generated locally to apply `roles.sql`, then a second safety-classifier
  block hit when attempting to persist them as Railway variables (`railway variables -s
Postgres set ...`) — same reasonable caution as the userlist-extraction block above,
  escalated rather than routed around. **This is a real gap, not just a formality:**
  Postgres only stores the SCRAM hash, never the plaintext, so if the scratch file is
  lost before these are persisted somewhere durable, the only recovery is an `ALTER
ROLE ... PASSWORD` reset (roles/grants themselves are unaffected — this only concerns
  who currently holds valid credentials for them). Davin should persist these to Railway
  variables (or reset the passwords) before this session's scratch file ages out.

- **`prisma migrate deploy` was never run** (only the read-only `prisma migrate status`)
  to verify direct-URL connectivity for L3. Status revealed production's migration
  history is completely unbaselined and one pending migration would drop two live
  tables with data (`Watchlist`/`WatchlistItem`) — see `DECISION-LOG.md` F20. Running
  `deploy` for real would have applied that drop as a side effect of this session's own
  verification step; substituted `status` instead and escalated the finding rather than
  proceeding.

## Next-session handoff

This order is **partially complete** — roles done and verified, PgBouncer split out.
Next session is **1-3b — PgBouncer deployment** (PRE-DRAFT:
`docs/migration-orders/1-3b-pgbouncer.migration-order.md`), not Session 1-4. Session 1-4
(Enforcement smoke test) still needs PgBouncer live first, per its own scope.
