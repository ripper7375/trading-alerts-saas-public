# Migration Order — Roles + PgBouncer (Plan §3 Stage A)

> `TEMPLATE-INFRA.md` variant — this session provisions/configures a live system (Postgres
> roles, PgBouncer). Read `00-SKELETON-AND-RULES.md` §4 first. **Creativity dial: Medium**
> (the approach to deploying PgBouncer is flexible; the role names and grants are fixed by
> Plan §3).
> **Status: PRE-DRAFT** — written by the Executor at Session 1-1's close (2026-07-18), per
> that order's own Next-session handoff. Session 1-2 ("Relocate database to Railway") was
> **skipped**: Session 1-1 found F3 = already on Railway (case (b)), so per the playbook's
> own conditional, the chain goes straight here.

**Session:** 1-3 · **Phase:** Phase 1 (Railway PostgreSQL, Workstream 7) · **Variant:** INFRA
· **Status:** PRE-DRAFT · **Generated:** 2026-07-18 · **Flags touched:** none new (executes
Plan §3 Stage A directly) · **Estimated time:** unknown — depends on whether the
market_data_v6 scope gap below needs resolving first (see Context).

## Context carried over from Session 1-1 — read before drafting further

- **F3 finding** (`DECISION-LOG.md`): the monolith's live Postgres is the `trading-alerts`
  Railway project's `Postgres` service (`maglev.proxy.rlwy.net`). Confirmed via direct
  query that **this instance does NOT contain `market_data_v6`** — it hosts only 2
  databases (`postgres`, `railway`), neither with any `market_data`-named table. No
  Railway project/service named `railway-gateway`/`gateway` exists anywhere in this
  account, so `railway-gateway`'s actual Postgres target remains unidentified.
- **Scope gap this creates (flagging, not silently absorbing, per
  `00-SKELETON-AND-RULES.md` §4):** Plan §3's Stage A target is explicit — "**ONE** Railway
  PostgreSQL instance hosting **both** `market_data_v6` and `non_market_data`" — and step
  1.1's own flag note frames this as a binary: _same instance as `railway-gateway`_ (role
  work only) vs. _hosted elsewhere_ (Session 1-2's relocation). Session 1-1 found a
  **third case neither branch anticipated**: on Railway, reachable, schema-verified as the
  real monolith DB — but a _different_ Railway instance than `railway-gateway`'s, and
  `railway-gateway`'s own instance was never located (it's not visible in this Railway
  account at all; may be a separate Railway account/team, or off-Railway despite its
  name). **This session's playbook scope (roles + PgBouncer on the monolith's existing
  instance) does not by itself achieve Stage A's "one instance hosting both domains"
  target** — that would additionally require either relocating `market_data_v6` into this
  instance, or locating and auditing `railway-gateway`'s actual database access first.
  **This is a decision for Davin/the Advisor, not something to resolve unilaterally
  in-session:** should Session 1-3 proceed as scoped (roles + PgBouncer on the monolith's
  own tables only, deferring market_data_v6 consolidation to a later, newly-needed
  session), or does the consolidation question need resolving first? Recommend the
  Advisor draft that decision explicitly before this order is APPROVED.
- **F18 finding:** RPO/RTO targets recorded (RPO ≤ 24h, RTO ≤ 1h), with an open gap —
  whether Railway's automated backups are actually enabled for the `trading-alerts`
  `Postgres` service could not be verified via CLI (dashboard-only feature, not checked).
  Worth confirming before this session, since role/PgBouncer changes are easier to trust
  if backups are known-good first.
- **Playbook scope** (`monolith-to-microservices-migration-session-playbook.md`, Session
  1-3): "Write idempotent `prisma/roles/roles.sql` creating `money_svc`, `core_app`,
  `gateway_ingest` with the plan §3 grants; apply it. Deploy PgBouncer (transaction mode);
  verify Prisma runtime works through the pooler and migrations run on the direct URL."
- **Plan §3 grants** (exact, do not redesign):
  - `money_svc` — ALL privileges on the 10 money tables (`AffiliateProfile`,
    `AffiliateCode`, `Commission`, `Payment`, `Subscription`, `SystemConfig`(+`History`),
    `FraudAlert`, `AffiliateRiseAccount`, `PaymentBatch`, `DisbursementTransaction`,
    `RiseWorksWebhookEvent`, `DisbursementAuditLog`); SELECT on nothing else.
  - `core_app` — no privileges on money tables (temporary read-only grant on `Subscription`
    during transition, revoked at cutover).
  - `gateway_ingest` — write access to `market_data_v6` only. **Given this session's own
    scope-gap finding above, this role cannot be meaningfully granted on the monolith's
    current instance until the market_data_v6 question is resolved** — creating the role
    with no matching table would be a no-op that looks done but isn't.
  - PgBouncer in front, transaction-pooling mode; Prisma migrations go through the DIRECT
    url, runtime traffic through the pooled url (never swap them — `LESSONS-LEARNED.md`
    L3).

## Entry criteria

- [ ] Davin/Advisor has resolved the market_data_v6 scope-gap question above — either
      "proceed roles+PgBouncer-only, consolidation is a separate future session" or
      "resolve consolidation first, folding it into this order's steps."
- [ ] F18's backup-cadence gap checked (Railway dashboard Backups tab) — not strictly
      blocking, but should be known before trusting role changes on this instance.
- [ ] Railway CLI access to the `trading-alerts` project (already established this
      session, reusable — `railway link -p trading-alerts -s Postgres -e production`).
- [ ] Blast-radius statement: role creation and grant changes are additive and reversible
      (`DROP ROLE`/`REVOKE`); the real risk is PgBouncer misconfiguration breaking the
      live monolith's DB connectivity — staging verification required before any
      production PgBouncer change, per this variant's own rule.

## Ordered steps

_(each step = change → immediate verification → rollback note; stage before production)_

1. **Write `prisma/roles/roles.sql`** — idempotent (`CREATE ROLE IF NOT EXISTS` /
   `DO $$ ... $$` guards), creating `money_svc`, `core_app`, `gateway_ingest` with exactly
   the grants in Context above (scoped to whichever tables the entry-criteria decision
   above settles on for `gateway_ingest`).
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
  avoids disrupting current traffic. `railway-gateway`'s ingest path is a separate,
  still-unlocated instance per this session's own Context note, so it is likely
  unaffected by construction — but do not assume this without re-confirming once
  `railway-gateway`'s actual instance is known.
- Secrets: role names/grants documented here and in the secret matrix if new
  connection-string variables are introduced; values only in Railway, never in git.

## Done when

- [ ] `prisma/roles/roles.sql` committed, applied, idempotency verified.
- [ ] Role grants verified live (positive + negative/denial checks) for at least
      `money_svc` and `core_app`; `gateway_ingest` scoped per the entry-criteria decision.
- [ ] PgBouncer live; Prisma runtime works through the pooler; migrations confirmed still
      using the direct URL.
- [ ] `railway-gateway` ingest (wherever it actually lives) and the live monolith
      confirmed unaffected throughout (explicitly checked, not assumed).

## Rollback

Role creation/grants are reversible via paired `DROP ROLE`/`REVOKE` scripts (written but
not applied unless needed). PgBouncer introduction is reversible by re-pointing traffic to
the direct URL and removing the PgBouncer service. If aborted mid-session, no destructive
or hard-to-reverse action should have been taken — confirm before ending the session.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for Session 1-4 — Enforcement smoke test — once this order closes)_
