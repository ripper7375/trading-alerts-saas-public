# Migration Order — money-service: skeleton + deploy

> For sessions that **provision or configure live systems**: databases, roles, PgBouncer,
> Railway services, staging environments, CI pipelines, Redis/queues. Read
> `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium** (the approach is
> flexible; the end-state, grants, and names are fixed by the plan).

**Session:** 4A-1 · **Variant:** INFRA · **Status:** CONFIRMED
**Generated:** 2026-07-21 · **Confirmed:** 2026-07-21 · **Flags touched:** F15, F16 · **Estimated time:** 2h

**Confirm notes:** F15/F16 verified RESOLVED in `DECISION-LOG.md` (Davin backfilled the
resolution entries after the Advisor's DRAFT omitted them). Remaining entry-criteria items
resolved per Davin's explicit guidance this session: SVC_TOKEN deferred (no core↔money calls
exist yet); dLocal secrets not yet live — deploy with placeholder values, Davin supplies real
values at Slice 4; `money_svc` role authentication to be proven live as part of this session's
own deploy step (nothing has exercised that role yet, unlike `core_app` which is implicitly
proven live via `operation-service`).

## Entry criteria

- [x] F15 decision received: one shared Redis, `op.*/money.*` namespaces.
- [x] F16 decision received: `<api.domain/v1 + money.domain/v1>`.
- [x] `money_svc`/`core_app` Postgres roles + PgBouncer re-verified live and authenticatable
      (`core_app` implicitly proven live via `operation-service` being Online in production;
      `money_svc` proven directly this session — see Deviations).
- [x] Secret matrix reviewed: confirm which money-domain secrets already exist vs. need Davin to supply
      (`docs/secret-matrix.md` — Stripe/Resend confirmed-live; dLocal/RiseWorks values
      deferred per Davin's guidance, see Deviations).
- [x] Blast-radius statement: what could this session break if it goes wrong? Additive greenfield service; minimal risk to live monolith.

## Ordered steps

1. **Scaffold `money-service/` skeleton**
   Create the NestJS skeleton (blueprint §5.2's file tree) without business logic. Include `/health`, auth guard, and Prisma service. Set up the routing prefixes to use `<api.domain/v1 + money.domain/v1>` as decided in F16.
   _Verify:_ `money-service` builds locally.
   _Rollback:_ Delete the `money-service/` folder.

2. **Add `money-service` to root `tsconfig.json` `exclude`**
   Must be done in the same commit to prevent Next.js frontend build breakage.
   _Verify:_ Root project build continues to succeed.
   _Rollback:_ Revert `exclude` addition.

3. **Configure Redis (F15)**
   Use the existing shared Railway Redis instance. Implement `op.*`/`money.*` BullMQ queue namespaces and per-service key prefixes.
   _Verify:_ Connection to Redis succeeds from `money-service` skeleton.
   _Rollback:_ Remove Redis connection config from `money-service/`.

4. **Deploy `money-service` to Railway**
   Deploy via `railway up --path-as-root money-service`. Configure environment variables: `DATABASE_URL` (pointing through `pgbouncer.railway.internal`), `REDIS_URL`, `NEXTAUTH_SECRET`, and money-domain secrets (`STRIPE_SECRET_KEY`, etc.) per the 0-4 matrix. F31: Include `SVC_TOKEN` generation/validation if needed for any core↔money internal calls established here. Ensure CORS allows only Vercel origin(s) since frontend calls it directly.
   _Verify:_ Railway deploy succeeds, `/health` is live and reachable via PgBouncer.
   _Rollback:_ `railway service delete money-service`.

## Rules specific to this variant

- **Nothing dashboard-only.** Every setting lands in a committed file or is documented in the secret matrix.
- Production changes only after the identical change succeeded in staging.
- Never break the always-on paths: `railway-gateway` ingest and the live monolith must not blip — state explicitly how each step avoids them.
- Secrets: names in the matrix, values only in Railway/Vercel — never in git.

## Done when

- [x] `money-service` skeleton deployed on Railway and `/health` is reachable.
      `https://money-service-production.up.railway.app/health` → `{"status":"healthy","services":{"database":{"status":"up"}}}`.
- [x] Config as code committed; secret matrix updated; monitoring/health hooked.
      `package.json`/`tsconfig.json`/`nest-cli.json`/`jest.config.js`/`railway.toml`/
      `.env.example` all committed; no dashboard-only settings. Secret matrix itself
      (`docs/secret-matrix.md`) unchanged — nothing new to add, dLocal gaps it already
      documented are still accurate. "Monitoring" = the `/health` endpoint itself; no
      external alerting wired this session (not in scope — blueprint §5.3's alert
      thresholds are a later-session concern once there are real transactions to alert on).

## Rollback

1. Run `railway service delete money-service`.
2. Revert the commit adding `money-service/` and updating `tsconfig.json`.

## Deviations

1. **PgBouncer rejects TLS — money-service's `PrismaService` does NOT copy
   operation-service's `ssl: { rejectUnauthorized: false }`.** First deploy's `/health`
   reported `database: down` ("the server does not support SSL connections"). Removed the
   `ssl` option entirely (Railway's private network makes an app-level TLS hop redundant
   anyway); redeployed; `/health` now reports `database: up`. This is a genuine,
   previously-undiscovered divergence between the two services' actual DATABASE_URL
   targets — operation-service's connection must be reaching something that does support
   TLS (never verified directly, per the "never printed" secret policy), while
   money-service's explicitly goes through `pgbouncer.railway.internal` per this order's
   own step 4, and that PgBouncer listener does not support TLS. Do not copy
   operation-service's Prisma adapter `ssl` config into any future service without
   checking which target it actually reaches first. Recorded as LESSONS-LEARNED.md L36.
2. **Stripe/dLocal/RiseWorks/Resend secrets NOT set this session** (deviates from step 4's
   literal text, which listed them for configuration). Davin's explicit guidance at
   CONFIRM: none of this session's code (skeleton only, no domain controllers) actually
   reads any of these vars, so setting them would be dead configuration. Deploy succeeded
   without them — confirms Davin's own prediction ("if Railway allows it, deploy without
   them"). They'll be set for real (Davin, directly on Railway) when each slice's BUILD
   session actually wires the corresponding domain module.
3. **`SVC_TOKEN` deferred, not built** — Davin's explicit call at CONFIRM: no core↔money
   internal call exists in a skeleton-only session, so there's nothing for it to protect
   yet. Still zero real `SVC_TOKEN` implementation anywhere in the codebase (unchanged
   from F31/Session 3-5's finding).
4. **Blueprint §5.2's "pino JSON logs" not adopted.** Neither operation-service nor
   railway-gateway actually use pino (checked both) — it's blueprint-aspirational text,
   not an established pattern. Used NestJS's default `Logger` instead, matching every
   other service in this repo. Revisit only if real log-volume needs justify a dedicated
   structured logger later.
5. **Domain-module folders (`affiliate/`, `billing/`, `payments/`, `disbursement/`,
   `scheduler/`, `internal/`) NOT scaffolded as empty placeholders.** The order's step 1
   says "without business logic" — read as "don't build the folders at all yet" rather
   than "build empty folders now." Each domain module's own BUILD session (4A-4 onward)
   creates its folder alongside its first real code, avoiding dead scaffolding sitting
   unused for multiple sessions.
6. **No custom domain bound** (`money.<domain>/v1` per F16's URL-scheme decision) — the
   service is reachable at Railway's default `money-service-production.up.railway.app`
   only. The Nest-side `v1` route prefix is live and correct; DNS/custom-domain mapping to
   `money.<domain>` needs Davin's action at the registrar (same unresolved state
   operation-service has always been in — Waiting-on #4, Vercel/DNS access gap).

## Next-session handoff

_(PRE-DRAFTed at this close: `4a-2-money-service-crons-build.migration-order.md` —
Session 4A-2, blueprint §5.5 Slice 1's BUILD half only, PORT variant. Playbook explicitly
splits BUILD (4A-2) from CUTOVER (4A-3) for this slice — "never combine with new build
work" — so 4A-3's own PRE-DRAFT (TEMPLATE-VERIFY-RETIRE) comes at 4A-2's close, not now.)_
