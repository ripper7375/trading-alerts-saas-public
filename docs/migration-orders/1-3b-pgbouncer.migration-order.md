# Migration Order — PgBouncer Deployment (Plan §3 Stage A, split from 1-3)

> `TEMPLATE-INFRA.md` variant — this session provisions/configures a live system
> (PgBouncer in front of the `trading-alerts` Postgres). Read `00-SKELETON-AND-RULES.md`
> §4 first. **Creativity dial: Medium** (the approach to deploying PgBouncer is flexible;
> the pooling mode and the requirement to preserve per-role grants are fixed).
> **Status: PRE-DRAFT** — written by the Executor at Session 1-3's close (2026-07-19).

**Session:** 1-3b · **Phase:** Phase 1 (Railway PostgreSQL, Workstream 7) · **Variant:**
INFRA · **Generated:** 2026-07-19 · **Flags touched:** none new.

## Context carried over from Session 1-3

- **money_svc / core_app already exist and are verified**, independent of PgBouncer:
  `prisma/roles/roles.sql` applied to `trading-alerts` production Postgres, idempotency
  confirmed, positive + denial grant checks passed via real role-authenticated
  connections. This session must not disturb those grants — PgBouncer sits in front of
  the existing connection, it doesn't change what either role can do.
- **The whole point of this session is per-role pass-through auth.** If PgBouncer is
  configured with one fixed backend user (the common pattern for simple single-user
  Docker images, e.g. `edoburu/pgbouncer`'s `DATABASES_USER`/`DATABASES_PASSWORD` env
  vars), every client gets proxied to Postgres as that ONE user regardless of who they
  authenticated as — silently defeating Session 1-3's entire role split the moment
  traffic goes through the pooler. The `[databases]` entry in pgbouncer.ini must have
  **no fixed `user=`/`password=`**, so PgBouncer forwards each client's own authenticated
  role to the backend unchanged.
- **Design started, not finished, in Session 1-3:** a custom image
  (Alpine + `pgbouncer` package, `auth_type = scram-sha-256`, `auth_file` built at
  container start from a Railway-only base64 env var) using each role's existing SCRAM
  verifier (`SELECT rolpassword FROM pg_authid WHERE rolname IN (...)` — the stored
  hash, never the plaintext password) as the userlist entry. This avoids ever handling
  plaintext credentials for the pooler config. Mid-build, extracting those verifiers into
  a file triggered a safety-classifier block (reasonably — it's a credential-adjacent
  pattern). Whoever runs this session should either get that permission pre-cleared, or
  do the verifier-extraction step manually and hand off just the base64 blob, or find
  another sanctioned path — don't route around a classifier block; escalate it the way
  1-3 did.
- **F18 finding** (`DECISION-LOG.md`): RPO/RTO recorded, backup-cadence gap still open
  (dashboard-only, still unchecked as of 1-3's close).
- **F20 finding, new (`DECISION-LOG.md`):** production's Prisma migration history is
  completely unbaselined, and one pending migration (`drop_watchlists`) would DROP two
  live tables with data. **Do not run `prisma migrate deploy` in this session either** —
  use `prisma migrate status` (read-only) to verify direct-URL connectivity, exactly as
  1-3 did, unless F20 has been resolved (baselined) by the time this session runs.
- **Staging gate:** almost certainly still absent — check `railway environment list
--json` on `trading-alerts` fresh at CONFIRM; don't assume Session 0-6 has run just
  because time has passed. If still absent, this is the SAME escalation 1-3 made — get
  Davin's explicit waiver again (waivers are per-session, not standing).
- **Vercel/DIRECT_URL:** confirm whether `DIRECT_URL` has been added to Vercel's
  production env vars yet (1-3 added `directUrl` to schema.prisma but held the commit
  out of any push pending that). If still not done, that push is still blocked — same
  prerequisite applies to whatever this session pushes too if it touches schema.prisma
  or `.env`-adjacent config again.

## Entry criteria

- [ ] `money_svc`/`core_app` roles exist and pass positive+denial checks (re-verify live,
      don't assume Session 1-3's checks still hold — roles are mutable).
- [ ] Railway CLI access to `trading-alerts` (re-verify `railway status`).
- [ ] Staging environment check (`railway environment list --json`) — if absent, get
      Davin's waiver explicitly for this session before proceeding, same as 1-3.
- [ ] `DIRECT_URL` confirmed present in Vercel production env vars, OR confirmed that
      this session won't push anything requiring it.
- [ ] Blast-radius statement: PgBouncer is new infrastructure alongside the untouched
      direct connection — as long as the live app's actual `DATABASE_URL` is NOT
      repointed at the pooler during this session, current production traffic has zero
      exposure to PgBouncer misconfiguration. Confirm that repointing live traffic is
      explicitly out of scope here (that's a separate, later cutover — Session 2-4 rewires
      the monolith to use split clients) before starting.

## Ordered steps

1. **Build and deploy the PgBouncer service** (custom image; transaction-pooling mode;
   pass-through auth per Context above) as a new Railway service in the `trading-alerts`
   project, `production` environment, connected to the existing `Postgres` service via
   Railway private networking.
   _Verify:_ service deploys and stays healthy (`railway logs`); TCP proxy/domain
   established so it's reachable for verification.
   _Rollback:_ `railway service delete` the new service; nothing else changes.
2. **Verify pass-through auth preserves grants.** Connect through the PgBouncer URL as
   `money_svc` and separately as `core_app` (a scratch/test connection, NOT the live
   app) and re-run the same positive+denial checks Session 1-3 ran directly — the
   results must be identical through the pooler as they were direct.
   _Verify:_ `money_svc` denied on `User` through the pooler; `core_app` denied on
   `Payment` through the pooler; both can still act on their own tables.
   _Rollback:_ tear down the service (step 1's rollback) if pass-through doesn't hold —
   do not proceed to any live cutover with broken pass-through.
3. **Verify Prisma Client basic CRUD through the pooler** (`pgbouncer=true` on the
   connection string), via a scratch Prisma Client instance — not the live app's
   `DATABASE_URL`.
   _Verify:_ a simple read/write (wrapped in a rolled-back transaction) succeeds.
4. **Verify migrations still resolve via the DIRECT url**, not the pooler
   (`LESSONS-LEARNED.md` L3). Use `prisma migrate status` (read-only) — see F20 note
   above for why not `migrate deploy`.
   _Verify:_ `migrate status` connects successfully via `DIRECT_URL` and reports
   accurately (pending migrations are a separate, already-flagged issue — not this
   session's to fix).

## Rules specific to this variant

- **Nothing dashboard-only.** PgBouncer's Dockerfile/config land in a committed file
  (e.g. `infra/pgbouncer/`); Railway-only values (userlist secret, host/port references)
  documented as names in the secret matrix, values only in Railway.
- Production changes only after the identical change succeeds in staging, or Davin's
  explicit waiver (see Entry criteria).
- **Never break the always-on paths:** the live monolith's actual `DATABASE_URL` is not
  touched by this session — PgBouncer is introduced alongside, not as a replacement,
  until a later, separate cutover decision. State this explicitly at each step.
- Secrets: never a plaintext password in git or in this order — SCRAM verifiers /
  base64 blobs live only in Railway variables.

## Done when

- [ ] PgBouncer live as its own Railway service, config committed as code.
- [ ] Pass-through auth verified: money_svc/core_app grants identical through the pooler
      as direct (positive + denial).
- [ ] Prisma CRUD works through the pooler (scratch verification).
- [ ] `prisma migrate status` confirmed still resolving via `DIRECT_URL`.
- [ ] Live app's `DATABASE_URL` explicitly confirmed untouched throughout.

## Rollback

Deleting the PgBouncer Railway service fully reverts this session — nothing else in the
system depends on it yet (live traffic still uses the direct connection). No destructive
or hard-to-reverse action should be taken if this session is aborted mid-way.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for Session 1-4 — Enforcement smoke test — once this order closes)_
