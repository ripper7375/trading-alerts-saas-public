# Migration Order — PgBouncer Deployment (Plan §3 Stage A, split from 1-3)

> `TEMPLATE-INFRA.md` variant — this session provisions/configures a live system
> (PgBouncer in front of the `trading-alerts` Postgres). Read `00-SKELETON-AND-RULES.md`
> §4 first. **Creativity dial: Medium** (the approach to deploying PgBouncer is flexible;
> the pooling mode and the requirement to preserve per-role grants are fixed).
> **Status: CONFIRMED, executed, Done-when items all checked** — written by the Executor
> at Session 1-3's close (2026-07-19); confirmed and executed 2026-07-19.

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

- [x] `money_svc`/`core_app` roles exist and pass positive+denial checks (re-verify live,
      don't assume Session 1-3's checks still hold — roles are mutable). **RESOLVED
      (2026-07-19):** the credential gap found at CONFIRM was cleared by Davin's explicit
      authorization to reset both passwords (`CLAUDE.md` Non-negotiable 5). Both roles
      re-passworded via `ALTER ROLE ... PASSWORD` (values generated locally, never
      committed, never printed); positive+denial checks re-run via real
      role-authenticated direct connections with the new passwords — all pass (`money_svc`
      reads/writes its 13 tables, denied on `User`/`Account`; `core_app` reads/writes its
      13 tables + `Subscription` SELECT, denied on `Subscription` UPDATE/`Payment`/
      `Commission`). See Deviations.
- [x] Railway CLI access to `trading-alerts` — **re-verified live at CONFIRM**
      (`railway status --json`: linked, `production` environment, `Postgres` service
      running; `railway variables` succeeded).
- [x] Staging environment check — **still absent** (`railway environment list --json`:
      only `production` exists, Session 0-6 has not run). **Davin explicitly waived this
      gate for Session 1-3b in chat, 2026-07-19** — see Deviations.
- [~] `DIRECT_URL` confirmed present in Vercel production env vars, OR confirmed that
  this session won't push anything requiring it. **Vercel itself not checkable**
  (no `vercel` CLI/access in this environment, per `CLAUDE.md` item 5). Second branch
  holds instead: 1-3b's own commits (PgBouncer Dockerfile/config) don't touch
  `schema.prisma` and add no new DIRECT_URL dependency. Separately discovered, not
  caused by 1-3b: `deploy.yml` is currently failing on every push to `main` at the
  GitHub workflow-file level, before the build step even runs — pre-existing across
  many prior sessions, unrelated to this order; flagged to Davin in chat, out of
  scope to fix here.
- [x] Blast-radius statement — holds by design: none of the 4 ordered steps touch the
      live app's `DATABASE_URL`; all verification connections are explicitly scratch/test
      connections.

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

- [x] PgBouncer live as its own Railway service, config committed as code. **DONE** —
      `pgbouncer` service live in `trading-alerts`/`production` (Alpine + PgBouncer
      1.22.1, `railway logs` shows clean startup, listening on 6432); config committed
      at `infra/pgbouncer/` (`Dockerfile`, `pgbouncer.ini`, `entrypoint.sh`).
- [x] Pass-through auth verified: money_svc/core_app grants identical through the pooler
      as direct (positive + denial). **DONE** — via a throwaway in-network verifier
      service (see Deviations): `money_svc` allowed on `Payment` (read + rolled-back
      write), denied on `User`, through the pooler; `core_app` allowed on `User`
      (read + rolled-back write) and `Subscription` (read), denied on `Payment`/
      `Commission`, through the pooler. Identical results to the direct-connection
      re-check above.
- [x] Prisma CRUD works through the pooler (scratch verification). **DONE** — scratch
      `PrismaClient` instances (money_svc, core_app), `DATABASE_URL` pointed at the
      pooler with `pgbouncer=true`: a positive read (`count()`) and a write wrapped in
      `$transaction` + forced rollback both succeeded for each role.
- [x] `prisma migrate status` confirmed still resolving via `DIRECT_URL`. **DONE** —
      connects cleanly via `DIRECT_URL` (`maglev.proxy.rlwy.net:58290`); reports the
      same 6 unapplied migrations as Session 1-3 found (F20, still open, unchanged —
      not this session's to fix; `migrate deploy` was not run).
- [x] Live app's `DATABASE_URL` explicitly confirmed untouched throughout. **DONE** — no
      `variable set` command this session ever targeted the `DATABASE_URL` key; only new
      keys were added (`MONEY_SVC_DB_PASSWORD`, `CORE_APP_DB_PASSWORD`,
      `PGBOUNCER_USERLIST_B64`) on the `Postgres` service, plus the new `pgbouncer`
      service's own variables. The live monolith was never repointed at the pooler.

## Rollback

Deleting the PgBouncer Railway service fully reverts this session — nothing else in the
system depends on it yet (live traffic still uses the direct connection). No destructive
or hard-to-reverse action should be taken if this session is aborted mid-way.

## Deviations

- **Staging gate waived by Davin (2026-07-19), for this session specifically.** Same
  situation as Session 1-3: `railway environment list --json` on `trading-alerts` shows
  only `production` — the staging environment still doesn't exist. Davin explicitly
  authorized deploying PgBouncer directly to production without a staging rehearsal
  first, in chat, at this session's CONFIRM. Per `EXECUTOR-PROTOCOL.md`, this waiver is
  per-session, not standing — any later session touching this instance must re-request
  it, not assume it carries forward.
- **CONFIRM found a credential gap, not yet resolved — order NOT marked CONFIRMED.**
  `money_svc`/`core_app` passwords (generated in Session 1-3) exist in no durable
  location: not in Railway variables (confirmed via `railway variables`), and the local
  scratch file `CLAUDE.md`'s Waiting-on #4 refers to was specific to Session 1-3's own
  ephemeral session environment, not present here. Catalog-level checks (as the Postgres
  superuser, read-only) confirm both roles still exist, can log in, and their grants
  still match 1-3's design exactly — but nobody can currently authenticate AS either
  role, which Ordered step 2 requires. Escalated to Davin rather than worked around:
  resetting the passwords is an auth-semantics change requiring his explicit go-ahead
  per `CLAUDE.md` Non-negotiable 5, and persisting new ones to Railway hit a
  safety-classifier block once already in Session 1-3 (see that session's Waiting-on
  #4) — the same classifier risk applies to resetting and re-persisting them now.
- **Credential gap resolved (2026-07-19).** Davin explicitly authorized (a) resetting
  `money_svc`/`core_app`'s passwords via `ALTER ROLE ... PASSWORD`, and (b) persisting
  the new passwords and the PgBouncer SCRAM userlist durably to Railway variables. Done
  via a superuser connection (values generated locally with `crypto.randomBytes`, never
  committed, never printed to any log/output); persistence used
  `railway variable set --stdin` throughout so no secret ever appeared as a CLI arg or
  in this session's visible output. No classifier block occurred this time for either
  the `ALTER ROLE` step, the read-only `pg_authid` SCRAM-verifier extraction, or the
  `railway variable set --stdin` calls — Session 1-3's block was specifically on writing
  extracted verifiers to a file, which this session also did (`userlist.txt` in a local
  scratch dir, never committed) without incident.
- **Alpine's `pgbouncer` package has no built-in service user.** The image initially
  failed at runtime (`FATAL PgBouncer should not run as root`) — Alpine 3.20's
  `pgbouncer` (1.22.1-r0) package does not create a dedicated user the way the Debian
  package does. Fixed by adding `addgroup -S pgbouncer && adduser -S -D -H -G pgbouncer
pgbouncer` and a `USER pgbouncer` directive in the Dockerfile, with `/etc/pgbouncer`
  chowned to that user so `entrypoint.sh` can still write the decoded `userlist.txt` at
  container start. Caught locally (`docker build` + `docker run`) before ever deploying
  to Railway.
- **`railway domain` cannot create a TCP proxy — only HTTP(S) domains.** Davin
  authorized creating a public TCP proxy for `pgbouncer` (mirroring Postgres's own
  `maglev.proxy.rlwy.net:58290`) to run Ordered steps 2–3 from outside Railway's private
  network. The safety classifier initially denied the attempt; once Davin explicitly
  re-authorized it, `railway domain --service pgbouncer --port 6432` succeeded but
  produced `https://pgbouncer-production-addb.up.railway.app` — Railway's HTTP edge
  domain type, confirmed via `railway domain list` (`"type": "service"`), not a raw TCP
  proxy. This domain cannot carry the Postgres wire protocol (PgBouncer would receive
  HTTP requests, not SQL connections) — deleted immediately, no functional use.
  `railway config pull` (the IaC path that might expose TCP-proxy settings directly) is
  unavailable in this environment (`Could not find Railway configuration support...
Install the Railway TypeScript SDK`). No CLI path to a genuine TCP proxy for a
  non-database-template service was found in this Railway CLI version (5.27.0) — likely
  the same class of dashboard-only gap as F18's backup-cadence check.
  **Substituted a lower-blast-radius alternative instead of pursuing dashboard access:**
  deployed a throwaway `verify-1-3b` Railway service in the same project/environment,
  which reaches `pgbouncer.railway.internal:6432` over Railway's private network (no
  public exposure needed at all); it ran the Ordered-step-2/3 checks as its startup
  command, printed PASS/FAIL to `railway logs`, and was deleted immediately after
  (`railway service delete`). This is arguably a better fit for the order's own
  Blast-radius principle than the originally-anticipated public-proxy approach — it
  verifies the identical thing without ever putting PgBouncer on the public internet,
  even temporarily. Flagging the `railway domain`/TCP-proxy gap for whoever next needs
  real (non-verification) public reachability to a custom Railway service — it isn't a
  one-line CLI command in this tool version.
- **Session-close verification (2026-07-19).** `npm run type-check` (`prisma generate`
  - `tsc --noEmit`) clean, no errors. `npm run test:ci` (full suite): **111/111 test
    suites passed, 2046/2046 tests passed** — identical counts to Session 1-3's last
    clean baseline, consistent with this session touching zero application source (only
    `infra/pgbouncer/` Docker/config files and docs changed).

## Next-session handoff

Session 1-4's hard dependency ("cannot run before Session 1-3b completes") is now
satisfied — PgBouncer is live, pass-through auth and Prisma CRUD both verified through
the pooler. `docs/migration-orders/1-4-enforcement-smoke-test.migration-order.md`
(PRE-DRAFTed at 1-3's close) needs a fresh read-through before re-APPROVAL: its Context
section describes a combined direct+pooled re-verification, which this session already
did once as part of Ordered steps 2–3 — 1-4 should do its own independent pass rather
than assume 1-3b's results still hold (same "roles are mutable" caution this order
opened with), but it no longer needs to wait on anything. F18's backup-cadence gap is
still the one item that may keep Phase 1 from closing exit-clean — unchanged by this
session, still dashboard-only.
