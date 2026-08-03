# Decisions Archive

This file contains resolved decisions and session narratives archived from the main DECISION-LOG.md.

## F2 — Version pins: next@16.2.10 / @nestjs/core@11.1.28

- Status: RESOLVED
- Session: 0-1 · Date: 2026-07-17
- Decision: Both exact target versions exist on the npm registry — pin as specified, no
  nearest-stable substitution needed. Current installed baselines: `next@^15.5.11` (root
  `package.json`), `@nestjs/core@^10.4.15` (`railway-gateway/package.json`) — the actual
  version bump happens in Phase 5 (Next.js) and Phase 4 (NestJS services), not this session.
- Evidence:
  - `npm view next@16.2.10 version` → `16.2.10`
  - `npm view @nestjs/core@11.1.28 version` → `11.1.28`
  - `npm view @nestjs/core versions --json` → confirms `"11.1.28"` present in the full
    published version list
- Approved by: n/a (technical, within bounds — verification only, no deviation from the
  plan's stated target)

## F19 (npm-check portion) — Prisma 7.8.0 exists on npm; major-version-count correction

- Status: RESOLVED (npm-check only — full 6→7 breaking-change audit remains OPEN, due
  Session 2-1)
- Session: 0-1 · Date: 2026-07-17
- Decision: `prisma@7.8.0` exists on the npm registry — pin as specified. **Finding:** plan
  §2 step 0.6 frames this as a "5→6→7" jump (citing `scripts/test-prisma5-upgrade.ts` as
  evidence the 5.x upgrade "was only prepared, not necessarily landed"), but both
  `package.json` files (root and `railway-gateway/`) already show `prisma@^6.19.2` installed
  today. The real jump is 6.19.2 → 7.8.0 — one major version crossed, not two. Proposed
  amendment for Session 2-1: scope the breaking-change audit and guide-reading to the 6→7
  boundary only (the Prisma 5→6 guide is moot since 6.x is already live); the plan document
  itself is unedited here — this is a proposal for the Advisor/Davin, not a self-applied
  change to plan strategy text.
- Evidence:
  - `npm view prisma@7.8.0 version` → `7.8.0`
  - root `package.json:91,165` → `"@prisma/client": "^6.19.2"`, `"prisma": "^6.19.2"`
  - `railway-gateway/package.json:26,44` → `"@prisma/client": "^6.19.2"`,
    `"prisma": "^6.19.2"`
- Approved by: n/a (technical, within bounds — version-existence check only; the
  major-version-count finding is a proposed amendment, not an applied one)

## F1 — OpenAPI coverage scope: PUBLIC vs internal-only (batch 1: operation domain)

- Status: RESOLVED (batch 1 only — auth, alerts, drawings, notifications, tier, user,
  market-data channel; batch 2/money domain and any later batches re-decide per their own
  routes)
- Session: 0-2 · Date: 2026-07-17
- Decision: **All 34 routes across the 7 batch-1 domains are PUBLIC** — none excluded.
  Every handler is called directly by the browser client: 28 are gated by a NextAuth
  session check (`getServerSession(authOptions)` or `getSession()`, returning 401 without
  one), and the remaining 6 are the intentionally-unauthenticated pre-auth flows
  (`auth/[...nextauth]`, `auth/forgot-password`, `auth/register`,
  `auth/resend-verification`, `auth/reset-password`, `auth/verify-email`) which substitute
  CSRF-origin validation (`validateOrigin()`) or a mailed token for a session, since a
  logged-out user must be able to call them by design. No route in either group is
  service-to-service/internal — there is no separate internal caller anywhere in the
  codebase for these paths.
  - Include (all 34): `auth/[...nextauth]`, `auth/forgot-password`, `auth/register`,
    `auth/resend-verification`, `auth/reset-password`, `auth/track-login`,
    `auth/verify-email`; `alerts` (root), `alerts/[id]`, `alerts/line`, `alerts/line/[id]`;
    `drawings` (root), `drawings/[id]`; `notifications` (root), `notifications/[id]`,
    `notifications/[id]/read`; `tier/check/[symbol]`, `tier/combinations`, `tier/symbols`;
    `user/2fa/backup-codes`, `user/2fa/disable`, `user/2fa/setup`,
    `user/2fa/verify-setup`, `user/2fa/verify`, `user/account/deletion-cancel`,
    `user/account/deletion-confirm`, `user/account/deletion-request`,
    `user/login-history`, `user/password`, `user/preferences`, `user/profile`,
    `user/sessions/[id]`, `user/sessions`; `market-data/channel`.
  - Exclude: none.
- Evidence: read all 34 `route.ts` files directly (session/CSRF guard present in every
  one); `grep -rn "internal-only|internal only" app/api/{auth,alerts,drawings,
notifications,tier,user,market-data}` → zero matches;
  `migration-stack-analysis.md`'s FRONTEND appendix classifies `app/api/**` as one
  FRONTEND/Vercel-edge-function bucket with no per-route internal-only carve-out for any
  of these paths.
- Approved by: n/a (technical scope classification, within the order's explicit step-1
  instruction — no auth-semantics change, read-only classification of existing guards)

## Naming — OpenAPI spec file convention for Session 0-2 batch 1

- Status: RESOLVED (technical default — no Davin sign-off sought, since this choice
  explicitly does _not_ change the existing convention; see rationale)
- Session: 0-2 · Date: 2026-07-17
- Decision: **Keep the existing `part-XX-<name>-openapi.yaml` numbering.** The 4
  files already in scope (`part-04-tier-system`, `part-05-authentication`,
  `part-11-alerts`, `part-15-notifications-realtime`) are updated/regenerated in place
  under their current filenames. The 3 domains with no prior spec (drawings, user,
  market-data channel) get the next sequential numbers: `docs/open-api-documents/archive/`
  already uses up to `part-20` (`part-20-sqlite-sync-postgresql-openapi.yaml`), so the new
  files are `part-21-drawings-openapi.yaml`, `part-22-user-account-openapi.yaml`,
  `part-23-market-data-channel-openapi.yaml`.
- Rationale: the order's own instruction requires Davin's sign-off only if _changing_ the
  existing numbering convention. Continuing it for the 3 new files is the lower-risk,
  no-escalation-needed default — it costs nothing (numbers are cheap) and avoids
  unilaterally deciding a repo-wide renaming scheme that would also implicitly affect the
  14 other in-scope-elsewhere `part-XX` files this session doesn't touch. If a cleaner
  per-domain scheme (e.g. `{domain}-openapi.yaml`) is wanted going forward, that's a
  proposal for Davin, not a self-applied change — flagged here for Session 0-3+ to raise.
- Evidence: `ls docs/open-api-documents/` (18 files, `part-02`…`part-19`) and
  `ls docs/open-api-documents/archive/` (`part-20-sqlite-sync-postgresql-openapi.yaml`) —
  confirms `part-21` is the next free number.
- Approved by: n/a (technical, within bounds — explicitly the non-convention-changing
  option; convention-changing alternative proposed above for Davin, not applied)

## F1 — OpenAPI coverage scope: PUBLIC vs internal-only (batch 2: money domain — CLOSES F1)

- Status: RESOLVED — F1 fully closed, both batches
- Session: 0-3 · Date: 2026-07-17
- Decision: **103 live `app/api/**`routes exist** (fresh`find app/api -name route.ts`,
  confirmed twice — Session 0-2 and 0-3). Batch 1 (Session 0-2) accounted for 34. This
  session accounts for the remaining 69, closing F1 for the whole system:
  - **57 PUBLIC routes, spec'd**: checkout(2), subscription(2), invoices(1),
    payments/dlocal(7), admin(19 — see deviation note below), affiliate(8),
    disbursement(16, including the unauthenticated `health` endpoint), candles(1),
    config/affiliate(1).
  - **11 internal-only routes, spec'd with `security: []` + real mechanism documented**
    (not excluded from the OpenAPI docs — Davin's explicit direction this session,
    see consolidation entry below): webhooks/{stripe,dlocal,riseworks} (3, provider
    signature-verified, externally triggered — not called by our frontend) and all 8
    `cron/*` routes (`CRON_SECRET` bearer-gated, triggered by Vercel Cron infra, not
    by frontend or provider).
  - **1 excluded, logged with reason, not spec'd**: `test/seed` —
    `NODE_ENV`-gated to development/test only (`ALLOWED_ENVIRONMENTS`), 403s in any
    other environment; it's a test-harness fixture for E2E setup, not part of the
    real product API surface, so it gets no OpenAPI entry, but it is not silently
    dropped — logged here per the order's requirement.
  - 34 + 57 + 11 + 1 = 103. Every route accounted for.
- **Route-count drift (99 vs 103), reconciled:** the playbook's 99 is stale relative to
  the live codebase; no single missing/extra route explains the gap precisely, but the
  breakdown above is independently verified against `find app/api -name route.ts` twice.
  Treat 103 as authoritative going forward, matching L8's "verify against live state,
  don't trust an old written number."
- **Deviation from playbook wording:** the playbook scoped this session to
  `admin/affiliates` (10 of 19 `admin/**` routes). Extended to the full `admin` domain
  (19 routes) because 9 routes (`analytics`, `api-usage`, `error-logs`, `users`,
  `fraud-alerts`×2, `codes/{code}/cancel`, `commissions/pay`, `settings/affiliate`)
  would otherwise be left uncovered by any session, and this order's own "Done when"
  requires every `app/api/**` route accounted for. Small, in-bounds, no live code
  touched — not escalated.
- **Two findings surfaced (read-only — documented, not fixed):**
  1. `app/api/cron/daily-maintenance/route.ts`'s own docstring claims it consolidates
     `expire-codes` + `check-expiring-subscriptions` + `downgrade-expired-subscriptions`,
     "reducing Vercel cron count from 4 to 2" — but `vercel.json` still independently
     schedules all 8 cron routes, including all 3 of the ones it claims to supersede.
     Production may be running duplicate maintenance work daily (idempotency of the
     individual handlers not verified). Documented in the specs (part-12, part-17);
     flagging here for Davin's attention — this is a live-code question, not a docs one.
  2. `app/api/candles/[symbol]/route.ts` builds its PostgreSQL table name via string
     interpolation (`` `${symbol}_${timeframe}` ``) directly into the SQL query, not a
     parameterized identifier (Postgres doesn't support identifiers as bind params).
     Input is constrained upstream (fixed `timeframe` enum, lowercased `symbol` path
     segment) but this pattern is worth a dedicated security-review look — out of this
     session's scope to fix, flagging for Davin.
- Evidence: all 5 batch-2 domain specs + the `part-23` extension read/regenerated
  directly against every live handler this session (see migration-stack-analysis.md
  and the order's Deviations section for the full file list); route counts
  cross-verified via `find app/api -name route.ts` and per-domain `find` counts;
  `vercel.json` read directly for the cron-scheduling finding.
- Approved by: n/a (technical scope classification within the order's explicit
  instructions) for the classification itself; the admin-domain-expansion deviation is
  logged per protocol, not separately escalated (small, in-bounds). The file-consolidation
  approach (below) was explicitly approved by Davin mid-session.

## F17 — Staging data strategy: synthetic seed only

- Status: RESOLVED
- Session: 0-5 · Date: 2026-07-17
- Decision: Staging (and local dev) never receives real/unmasked production or user data.
  All non-production environments are seeded exclusively from `prisma/seed.ts`-style
  synthetic fixtures — a single default admin account, a handful of named e2e test users
  (free/pro/admin/affiliate/unverified tiers), 2 demonstration alerts, and baseline
  `SystemConfig` rows. No anonymized/masked production subset is used, since anonymization
  itself is a residual leak risk this plan explicitly wants to avoid (matches `CLAUDE.md`
  non-negotiable #5 and the order's "No Production Data in Staging" rule).
- Evidence: `prisma/seed.ts` read directly — confirmed it creates only synthetic fixtures
  from environment-variable-driven defaults (`ADMIN_EMAIL`/`ADMIN_PASSWORD`, falling back
  to `admin@tradingalerts.com` / a placeholder password), no code path reads from or copies
  any production data source. Ran live against `docker-compose.dev.yml`'s seeded Postgres
  this session — output confirmed: 1 admin user, 5 named e2e test users, 2 sample alerts,
  affiliate `SystemConfig` entries, all synthetic.
- Approved by: Davin (staging-data strategy is an owner decision per `EXECUTOR-PROTOCOL.md`
  §7; confirmed at this session's CONFIRM step, before execution began).

## Session 0-5 — Local dev stack scoped to `docker-compose.dev.yml` only; Railway/Vercel deferred

- Status: RESOLVED (scoping decision, not a flag)
- Session: 0-5 · Date: 2026-07-17
- Decision: Session 0-5's order listed 2 entry criteria, one being "Davin has granted
  Railway + Vercel account/dashboard access (or explicitly scoped this session to the
  local-only `docker-compose.dev.yml` step)." Davin chose the local-only scoping at this
  session's CONFIRM step. Steps 2 (Railway staging environment/project) and 3 (Vercel
  preview branch) are deferred to a follow-up session — Phase 0's CC-A exit criterion
  ("Staging environment... operational") remains open until that follow-up runs.
- Evidence: n/a (a live scoping choice made in chat at CONFIRM, not a technical finding).
- Approved by: Davin (explicit choice between "full scope" / "local-only" / "hold",
  made live before execution began).

## F3 — Where does the monolith's Postgres live?

- Status: RESOLVED
- Session: 1-1 · Date: 2026-07-18
- Decision: **(b) Already on Railway, but a different Railway instance than the one
  `railway-gateway` writes `market_data_v6` to.** The monolith's live Postgres is the
  `Postgres` service in the `trading-alerts` Railway project (host
  `maglev.proxy.rlwy.net`, database `railway`). This is a standalone instance: it hosts
  only 2 databases (`postgres`, `railway`), neither containing any `market_data`-named
  table, and no Railway project/service named `railway-gateway`/`gateway` exists anywhere
  in this account's 5 projects — consistent with `migration-stack-analysis.md` tagging
  `railway-gateway/` as SEPARATE_STACK, independently deployed elsewhere. Case (c)
  (off-Railway) is ruled out; case (a) (same instance as the gateway) is ruled out by the
  missing `market_data_v6` table.
- Evidence:
  - **Source 1** (env-var host-only extraction, never the full value): `.env.local`'s
    `DATABASE_URL` parsed via `new URL(...).hostname` → `maglev.proxy.rlwy.net`.
  - **Source 2** (Railway CLI/dashboard): `railway list` → 5 projects
    (`trading-alerts`, `postgre for staging`, `zoological-motivation`,
    `feisty-amazement`, plus the workspace default) → linked `trading-alerts`/`Postgres`
    → `railway variables --service Postgres --json` piped directly into a parser (raw
    value never surfaced in any output) → `DATABASE_PUBLIC_URL` /
    `RAILWAY_TCP_PROXY_DOMAIN` both → `maglev.proxy.rlwy.net`. Matches Source 1.
  - **market_data_v6 absence:** read-only `information_schema.tables` /
    `pg_database` queries against the live instance (via `pg` client,
    `DATABASE_PUBLIC_URL`, no mutation) found 2 databases, neither containing a
    `market_data`-named table.
  - **Mid-session correction:** `.env.local` initially held a stale value pointing to a
    _different_ Railway project (`postgre for staging`, host `turntable.proxy.rlwy.net`)
    — caught by this session's mandatory two-source cross-check, exactly the scenario the
    order's "ground truth priority" rule exists for. Davin corrected `.env.local` to the
    value copied directly from Vercel's production environment variables, which then
    cross-checked cleanly against `trading-alerts`.
  - **Reachability:** `trading-alerts`'s `Postgres` service was initially `Offline`
    (sibling `flask-api` `Failed`); Davin manually redeployed it (confirmed
    restart/resume of the existing volume, not a fresh instance — data integrity
    verified, not assumed) and it came `Online`; a bounded read-only connection then
    succeeded.
- Approved by: Davin (the `.env.local` correction, the offline-instance escalation, and
  the redeploy/data-integrity confirmation were live, material calls made mid-session —
  each explicitly escalated per the Autonomy & Deviation clause rather than assumed).

## F18 — RPO/RTO targets

- Status: RESOLVED
- Session: 1-1 · Date: 2026-07-18
- Decision: Davin's target: **RPO ≤ 24h, RTO ≤ 1h.** Gap analysis against what this
  session could actually verify:
  - **RTO:** the manual backup→restore→verify→boot cycle rehearsed this session
    (`docs/db-restore-rehearsal.md`) completed in well under an hour end-to-end at
    today's data size (206 KB dump; schema+data+21 FK constraints restored in seconds).
    This is a _manual procedure_ proof, not a measurement of an automated RTO — it shows
    a human-driven restore is achievable inside the 1h target today, not that it stays
    inside target as data grows, nor that any automated failover meets it unattended.
  - **RPO:** **could not be confirmed either way.** Railway's CLI (this session's only
    available tool — no dashboard browser session was set up) has no `backup`/`snapshot`
    command; Railway's native automated-backup feature (if enabled) is dashboard-only and
    wasn't checked. This session cannot state whether automated backups are configured
    for the `trading-alerts` `Postgres` service, and therefore cannot state the real
    RPO gap — **flagging as an explicit gap, not silently assuming compliance.**
  - **Recommendation for Davin:** check the Railway dashboard's `Postgres` service →
    Backups tab directly; if automated backups aren't enabled/frequent enough to meet a
    24h RPO, that's a standing risk independent of this migration and worth its own
    action item.
- Evidence: `docs/db-restore-rehearsal.md` (full procedure, timings, row-count match);
  `railway --help` / `railway volume --help` (no backup/snapshot subcommand found in
  this CLI version).
- Approved by: Davin (RPO/RTO target itself, stated before this session per the order's
  entry criteria; the gap/limitation framing above is this session's technical finding,
  not a new target decision).

## Session 1-1 close-out — F3 gap resolution path: consolidate `market_data_v6` before Session 1-3

- Status: RESOLVED (scoping decision, not a flag — F3 itself stays RESOLVED as recorded
  above; this is the follow-on plan-execution choice)
- Session: 1-1 (post-close) · Date: 2026-07-18
- Decision: Session 1-1 found `market_data_v6` is **not** on the same Railway instance as
  the monolith's Postgres, a gap neither the playbook's Session 1-2 conditional nor
  Session 1-3's roles/PgBouncer-only scope anticipated (flagged in Session 1-1's
  Next-session handoff rather than resolved unilaterally). Davin and the Advisor chose:
  **consolidate first** — locate `market_data_v6`'s actual instance and migrate it into
  the unified `trading-alerts`/`maglev` instance via a new **Session 1-2b**, before
  Session 1-3's role/PgBouncer work — rather than deferring consolidation to a later
  session. The Advisor produced Session 1-2b's DRAFT order
  (`docs/migration-orders/1-2b-locate-market-data.migration-order.md`), and updated the
  session playbook + `SESSION-PROMPT-SCRIPT.md` to match (all committed `ba1003b4`, not
  authored or verified by the Executor). Session 1-3's entry criteria now correctly
  depend on 1-2b completing first.
- **Worth Davin's explicit attention before APPROVING 1-2b:** its step 4 proposes
  repointing `railway-gateway`'s `DATABASE_URL` to the unified instance —
  `EXECUTOR-PROTOCOL.md` §5's standing do-not-touch list designates the
  `railway-gateway` ingest path as "touched only where an order says so (Phase 8.2)."
  Doing this in Phase 1 may be the correct call given Plan §3 Stage A's "one instance"
  target, but it is a deviation from that standing rule — flagging for explicit
  acknowledgment rather than letting it pass silently at CONFIRM.
- Evidence: n/a (a live decision made in chat between sessions, not a technical finding —
  see `CLAUDE.md`'s "Waiting on" for the current status).
- Approved by: Davin (explicit choice, made directly, per the Autonomy & Deviation clause
  for material scope decisions).

## Spec consolidation — batch-2 OpenAPI files (part-12/14/17/18/19)

- Status: RESOLVED (Davin-approved mid-session)
- Session: 0-3 · Date: 2026-07-17
- Decision: the 5 pre-existing "likely batch-2" spec files
  (`part-12-ecommerce-billing`, `part-14-admin-dashboard`, `part-17-affiliate`,
  `part-18-dlocal-payment`, `part19-disbursement`) turned out to overlap heavily and
  inconsistently — e.g. `payments/dlocal/*` and `webhooks/dlocal` were duplicated in
  both part-12 and part-18; `admin/fraud-alerts` in both part-14 and part-18;
  `admin/affiliates/*` (9 sub-paths) in both part-14 and part-17; `checkout/*` in both
  part-12 and part-17; cron routes scattered redundantly across part-17/18/19.
  `part-17` additionally had a **systematic bug**: every path was missing the `/api`
  prefix (`/checkout` instead of `/api/checkout`, etc.) — wrong against every live
  route, not just individually stale fields.
  Presented three options to Davin (consolidate into clean non-overlapping files /
  patch in place and leave overlap / decide per-file); **Davin chose full
  consolidation**. Each of the 5 files is now the single sole owner of its domain
  (see each file's own `info.description` for its exact route list and what moved
  where); no route is documented in more than one file; the `/api` prefix bug in
  part-17 is fixed. `part-16-utilities-infrastructure` was left untouched — it
  documents `/internal/health` + `/internal/metrics`, paths that don't correspond to
  any `app/api/**` route at all, so it was never actually a batch-2 candidate despite
  CLAUDE.md's "5 existing specs" guess (there were 6 real candidates, one irrelevant).
  `candles/[symbol]` (an uncovered leftover domain, not in any batch's named scope) was
  added to `part-23-market-data-channel-openapi.yaml` (written Session 0-2) rather than
  given its own single-route file, since it's topically the same market-data area.
- Evidence: cross-file path-overlap grep before and after (zero duplicates remain,
  confirmed via `grep -E '^  /' <all 5 files> | sort | uniq -d` → empty); all 5 files
  - the part-23 extension parse as valid YAML (`js-yaml`, loaded via its resolved
    `.pnpm` store path — `require()`-by-bare-name fails here the same way L7 describes
    for `glob`; see LESSONS-LEARNED). Every path in every file was verified against its
    live handler by the executing agent, not copied from the old spec unverified —
    dozens of field-level corrections were found and fixed (see each file's
    `info.description` for its own list); this is the same class of error L8 warned
    about, now confirmed to be widespread across the batch-2 spec set, not isolated to
    part-04/part-11.
- Approved by: Davin (explicit choice among 3 presented options, mid-session
  2026-07-17 — this was a material, boundary-touching decision affecting the file
  inventory, correctly escalated per the Autonomy & Deviation clause rather than
  decided unilaterally).

## Session 1-1 close-out / 1-2b pivot — The actual location of `railway-gateway` and `market_data_v6`

- Status: RESOLVED
- Session: 1-1 (post-close) · Date: 2026-07-19
- Decision: It was uncovered that `railway-gateway` and its `market_data_v6` database were **never actually deployed to production**. The architecture was designed (as seen in `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md`), but the NestJS backend was never spun up.
  - As a result, there is no `market_data_v6` database to locate or migrate. Session 1-2b has been permanently **cancelled**.
  - We have pivoted back to **Option A** for Session 1-3: creating roles only for the monolith (`maglev`) and deploying PgBouncer. The `gateway_ingest` role is deferred.
  - **Future Deployment Target:** The Railway project named `postgre for staging` (which contains both a Postgres service and a Redis service) was identified as the likely intended home for `railway-gateway` (which requires both Postgres and a Bull Queue/Redis). When `railway-gateway` is finally built in Phase 8, it should be deployed into this `postgre for staging` project.
- Evidence: `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED_api-gateway-redis.md` describes the Redis requirement. Railway dashboard screenshots confirmed the `postgre for staging` project contains exactly the required Postgres+Redis topology, but no app service. Prisma schemas show the tables were defined but never pushed live.
- Approved by: Davin (explicitly confirmed mid-session).

## F20 — Production migration history unbaselined (destructive pending migration)

- Status: OPEN
- Session: 1-3 (discovered as a side effect of verifying L3 — direct-URL migrations)
- Decision: not yet decided; this is a discovery, escalated to Davin, not a resolution.
- Finding: `prisma migrate status` (read-only) against the `trading-alerts` production
  Postgres reports **all 6 migrations in `prisma/migrations/` as unapplied** —
  `20251227000000_init`, `20260214000000_rag_dual_memory`,
  `20260224000000_update_kc_ha_body_columns`, `20260705000000_add_market_data_v6`,
  `20260705010000_drop_market_data`, `20260706000000_drop_watchlists`. Production was
  evidently never set up via Prisma Migrate — no tracked migration history exists
  server-side, even though its live schema already matches most of these migrations'
  end state (confirmed 26 live tables including `Watchlist`/`WatchlistItem`, both
  present with data).
  - **The dangerous part:** `20260706000000_drop_watchlists` runs `DROP TABLE
"WatchlistItem"` / `DROP TABLE "Watchlist"`. Both tables currently hold live
    production data. If `prisma migrate deploy` is ever run against this database as-is
    (Session 2-1 upgrade work, CI, or anyone debugging locally with prod credentials),
    it will silently apply all 6 migrations in order, **including an irreversible drop of
    two live tables**, with no warning beyond the routine "N migrations applied" output.
  - This session did **not** run `migrate deploy` for exactly this reason — used
    `migrate status` (read-only) instead to verify direct-URL connectivity without
    touching production schema.
- Evidence: `npx prisma migrate status` output (direct connection, `maglev.proxy.rlwy.net`)
  showing all 6 as unapplied; `pg_tables` query confirming `Watchlist`/`WatchlistItem`
  exist live; migration file contents inspected (`prisma/migrations/20260706000000_drop_watchlists/migration.sql`).
- Recommendation: baseline production's migration history (`prisma migrate resolve
--applied <migration>` for each migration whose changes the live schema already
  reflects) before treating any pending migration as safe to deploy — this is exactly
  the kind of gap the playbook's Session 2-3 ("Baseline both schemas against the existing
  DB... no-op first migration via `migrate diff`") was designed to close, but the
  destructive drop sitting live and unguarded is a real, present risk, not a
  Phase-2-paced one. Worth Davin deciding whether to pull that baselining work forward
  rather than wait for Session 2-3's originally scheduled slot.
- Approved by: n/a — technical discovery, flagged for Davin's prioritization decision,
  not a decision made unilaterally.

## Session 1-3b — money_svc/core_app credential reset + durable persistence

- Status: RESOLVED
- Session: 1-3b · Date: 2026-07-19
- Decision: at CONFIRM, `money_svc`/`core_app`'s passwords (generated Session 1-3) were
  found to exist nowhere reachable — not in Railway variables (Session 1-3's attempt to
  persist them there hit a safety-classifier block, escalated not routed around, per
  that session's Waiting-on #4), and the local scratch file they lived in was specific
  to Session 1-3's own ephemeral session environment, gone by the time 1-3b ran. Both
  roles still existed with correct grants (confirmed via a read-only superuser catalog
  query), but nobody could authenticate as either — blocking not just CONFIRM's
  re-verification but Ordered step 2 itself (pass-through auth verification requires a
  real role-authenticated connection). Davin explicitly authorized, in chat: (1)
  resetting both passwords via `ALTER ROLE ... PASSWORD` — an auth-semantics change,
  escalated per `CLAUDE.md` Non-negotiable 5 rather than assumed; (2) persisting the new
  passwords and PgBouncer's SCRAM userlist durably to Railway variables this time.
  Executed: passwords generated locally (`crypto.randomBytes`, never committed, never
  printed to any output); `ALTER ROLE` run via a superuser connection; positive+denial
  checks re-run with the new passwords (direct connection) — identical results to
  Session 1-3's original checks; `MONEY_SVC_DB_PASSWORD`/`CORE_APP_DB_PASSWORD`/
  `PGBOUNCER_USERLIST_B64` all set via `railway variable set --stdin` (never a CLI arg,
  never printed). No classifier block occurred this time for the `ALTER ROLE` step, the
  read-only SCRAM-verifier extraction from `pg_authid`, or the `railway variable set`
  calls — Session 1-3's block was specifically on writing extracted verifiers to a file,
  which this session also did (locally, in a scratch directory, never committed)
  without incident.
- Evidence: direct-connection positive+denial re-check (both roles, new passwords, all
  pass); `railway variable list --service Postgres --json` (keys only) confirms
  `MONEY_SVC_DB_PASSWORD`/`CORE_APP_DB_PASSWORD`/`PGBOUNCER_USERLIST_B64` present.
- Approved by: Davin (explicit, live authorization for both the password reset and the
  Railway-variable persistence — a Non-negotiable-5-class decision, correctly escalated
  rather than assumed).

## F19 — Prisma 6.19.2→7.8.0 breaking-change audit — CLOSES F19

- Status: RESOLVED
- Session: 2-1 · Date: 2026-07-20
- Decision: Full audit performed (guide fetched via direct `curl` — WebFetch/WebSearch
  were erroring on an unrelated internal fault, confirmed against 3 URLs first); actual
  scope was much larger than the plan's "client bump only" framing. Real breaking changes
  found and handled:
  - **ESM-only client** — required swapping `ts-node`→`tsx` for `db:seed`/`worker:alerts`
    (the two entry points that run outside Next.js's bundler); no repo-wide
    `"type": "module"` needed since Next's own bundler abstracts this for everything else.
  - **Driver adapters mandatory** — every `PrismaClient` instantiation (`lib/db/prisma.ts`,
    `prisma/seed.ts`, 3 MT5 scripts) now takes a `@prisma/adapter-pg` `PrismaPg` adapter.
  - **`datasource` block's `url`/`directUrl` are a hard error in 7.8.0**, not merely
    deprecated (confirmed empirically via `prisma generate`'s actual error output — the
    docs' prose alone undersold this). Replaced with a new root `prisma.config.ts`
    (direct URL for CLI/migrate, matching L3) plus the adapter (pooled URL, for runtime).
  - **SSL cert validation tightened** (node-pg vs the old Rust engine) —
    `rejectUnauthorized: false` set explicitly in every adapter to preserve prior behavior
    against Railway's proxy TLS.
  - `provider = "prisma-client-js"` (not the new `prisma-client`) still works fine in
    7.8.0, confirmed via a clean `prisma generate` — avoided rewriting all 16 files'
    `@prisma/client` import paths.
  - `railway-gateway/package.json` explicitly decoupled, stays on `6.19.2` (Davin's call,
    given NestJS's CJS build has no clean low-effort path to an ESM-only dependency, and
    the service was never deployed anyway).
- Evidence: `npm run type-check` clean; `npm run test:ci` → 111/111 suites, 2046/2046
  tests, exact parity with Session 1-4's baseline (re-confirmed 3 times across the
  session, including after lint-staged's auto-fix on commit); `next lint` clean;
  `prisma migrate status` still resolves cleanly via `DIRECT_URL` post-upgrade, F20's
  known state unchanged (6 migrations unapplied, `drop_watchlists` still pending — not
  touched, no `migrate deploy` run). Full hit-list and commit trail in
  `docs/migration-orders/2-1-prisma-upgrade.migration-order.md`.
- Approved by: Davin (hit-list reviewed live in-session before any code edit, per the
  order's own hard STOP gate; explicit authorization for the railway-gateway decoupling
  and for tackling the architecture-level changes — ESM, adapters, config, SSL — within
  this one session rather than splitting them).

## F4 — Full model census for schema split — CLOSES F4

- Status: RESOLVED
- Session: 2-2 · Date: 2026-07-20
- Decision: 27 live models in `prisma/schema.prisma` split as **1 market-data model +
  26 non-market-data models + 1 new model**:
  - Market-data (1): `MarketDataV6` — the only trading-data table, no `@relation`
    in/out (confirmed via `grep -n "@relation"` — 22 hits total in the file, all among
    the other 26 models).
  - Non-market-data (26): `User`, `Account`, `Session`, `UserSession`,
    `LoginHistory`, `SecurityAlert`, `VerificationToken`, `UserPreferences`,
    `AccountDeletionRequest`, `Subscription`, `Alert`, `Payment`, `FraudAlert`,
    `AffiliateProfile`, `AffiliateCode`, `Commission`, `Notification`,
    `AffiliateRiseAccount`, `PaymentBatch`, `DisbursementTransaction`,
    `RiseWorksWebhookEvent`, `DisbursementAuditLog`, `SystemConfig`,
    `SystemConfigHistory`, `Drawing`, `DrawingAlert`.
  - New (1): `RefreshToken` — minimal stub (`id`, `token`, `userId`, `expiresAt`
    only), no relations/indexes added. Real shape deferred to F6/F7 (auth strategy,
    Session 3-1) so it isn't designed twice.
- Evidence: `grep -c "^model " prisma/schema.prisma` → 27; full model list read
  directly and diffed name-for-name against the PRE-DRAFT's candidate census (exact
  match); both new schema files (`prisma/market-data/schema.prisma`,
  `prisma/non-market-data/schema.prisma`) pass `prisma validate` and generate working
  clients.
- **Full census table** (added at Session 2-2's follow-up close — the playbook's own
  Session 2-2 "done when" requires a census table here, not just prose; the money
  flag/User-relation columns feed Session 2-3's FK-audit scope directly):

  | #   | Model                     | Schema file     | Money-domain? | Direct `@relation` to `User`?                 |
  | --- | ------------------------- | --------------- | ------------- | --------------------------------------------- |
  | 1   | `MarketDataV6`            | market-data     | No            | No                                            |
  | 2   | `User`                    | non-market-data | No            | — (is User)                                   |
  | 3   | `Account`                 | non-market-data | No            | Yes (auth, not money — kept)                  |
  | 4   | `Session`                 | non-market-data | No            | Yes (auth, not money — kept)                  |
  | 5   | `UserSession`             | non-market-data | No            | No (plain `userId`)                           |
  | 6   | `LoginHistory`            | non-market-data | No            | No (plain `userId`)                           |
  | 7   | `SecurityAlert`           | non-market-data | No            | No (plain `userId`)                           |
  | 8   | `VerificationToken`       | non-market-data | No            | No (no `userId` field)                        |
  | 9   | `UserPreferences`         | non-market-data | No            | Yes (core, not money — kept)                  |
  | 10  | `AccountDeletionRequest`  | non-market-data | No            | No (plain `userId`)                           |
  | 11  | `Subscription`            | non-market-data | **Yes**       | **Yes — DROP (Session 2-3)**                  |
  | 12  | `Alert`                   | non-market-data | No            | Yes (core feature, not money — kept)          |
  | 13  | `Payment`                 | non-market-data | **Yes**       | **Yes — DROP (Session 2-3)**                  |
  | 14  | `FraudAlert`              | non-market-data | **Yes**       | **Yes — DROP (Session 2-3)**                  |
  | 15  | `AffiliateProfile`        | non-market-data | **Yes**       | **Yes — DROP (Session 2-3)**                  |
  | 16  | `AffiliateCode`           | non-market-data | **Yes**       | No (relates to `AffiliateProfile` only)       |
  | 17  | `Commission`              | non-market-data | **Yes**       | No (`userId` already plain)                   |
  | 18  | `Notification`            | non-market-data | No            | No (plain `userId`)                           |
  | 19  | `AffiliateRiseAccount`    | non-market-data | **Yes**       | No (relates to `AffiliateProfile` only)       |
  | 20  | `PaymentBatch`            | non-market-data | **Yes**       | No (no `User` relation)                       |
  | 21  | `DisbursementTransaction` | non-market-data | **Yes**       | No (no `User` relation)                       |
  | 22  | `RiseWorksWebhookEvent`   | non-market-data | **Yes**       | No (no `User` relation)                       |
  | 23  | `DisbursementAuditLog`    | non-market-data | **Yes**       | No (no `User` relation)                       |
  | 24  | `SystemConfig`            | non-market-data | **Yes**       | No (`updatedBy` already plain)                |
  | 25  | `SystemConfigHistory`     | non-market-data | **Yes**       | No (`changedBy` already plain)                |
  | 26  | `Drawing`                 | non-market-data | No            | Yes (core feature, not money — kept)          |
  | 27  | `DrawingAlert`            | non-market-data | No            | No (relates to `Drawing`/`Alert`, not `User`) |
  | 28  | `RefreshToken` (new)      | non-market-data | No            | No (minimal stub, no relations at all)        |

  All 28 rows assigned, none ambiguous. **Minor plan-document inconsistency found and
  flagged (not corrected here — out of this entry's scope):** the plan's Phase 1
  section (§3) prose says "10 money tables" but its own parenthetical list names 12
  distinct models (13 if `SystemConfig`/`SystemConfigHistory` count separately,
  which this table does). Doesn't change the FK-audit scope above — that's derived
  directly from which models have a live `@relation` to `User`, verified by grep, not
  from the money-table count — but worth the Advisor correcting the plan text itself
  at some point.

- Approved by: Davin (approved the order's candidate census as written; this session
  re-verified it against live state before executing).

## F5 — Prisma file-layout strategy — CLOSES F5

- Status: RESOLVED
- Session: 2-2 · Date: 2026-07-20
- Decision: **Two schema files, generated via explicit `--schema=` CLI flags, not via
  `prisma.config.ts`.** Confirmed `@prisma/config@7.8.0`'s type declares `schema?:
string` (singular — checked the installed package's own `.d.ts` directly, not just
  docs), so the config file cannot hold two schema paths. `prisma generate --help`
  and `prisma migrate dev --help` both expose a per-invocation `--schema=<path>` flag
  that overrides the config's default — this is the only mechanism, and it works:
  `prisma/market-data/schema.prisma` (own `generator client` output
  `node_modules/.prisma/market-client`) and `prisma/non-market-data/schema.prisma`
  (own output `node_modules/.prisma/non-market-client`) both validate and generate
  cleanly. `prisma.config.ts` keeps its single default `schema` pointing at the old
  `prisma/schema.prisma` (still needed until Session 2-2b retires it) and continues
  to own the shared `datasource.url`/`migrations.path` settings for all schemas.
  **Cutover split in two**, per the Advisor's decision reflected in the order:
  Session 2-2 (this session) = create + validate both new files only, no consumer
  imports touched, old schema untouched (now change-frozen). Session 2-2b (next) =
  repoint all 16 consumer imports to the correct new client and retire the old file.
- Evidence: `find node_modules/.pnpm -iname "*prisma*config*"` →
  `@prisma+config@7.8.0`'s `.d.ts` read directly (`schema?: string`); `prisma generate
--help` / `prisma migrate dev --help` output showing `--schema` flag; both new
  schemas' `prisma validate` + `prisma generate` runs, both clean; full
  `npm run test:ci` re-run post-split — 111/111 suites, 2046/2046 tests, exact parity
  with Session 2-1's baseline, no drift.
- Approved by: Davin (approved the order's F5 recommendation and the 2-2/2-2b cutover
  split as written; this session verified the mechanism empirically before executing
  rather than trusting the recommendation on its own).

## F18 — progress note: backup-cadence gap re-checked, still open

- Status: RESOLVED (unchanged — RPO/RTO targets themselves stand; the backup-cadence
  sub-gap remains open, as it has since Session 1-1)
- Session: 1-4 · Date: 2026-07-19
- Decision: not a new decision — a re-check. Session 1-4's entry criteria required
  checking the Railway dashboard Backups tab "if at all possible this session." No
  dashboard access exists in this CLI-only environment; confirmed again this session
  that no CLI equivalent exists either (`railway backup` → unrecognized subcommand;
  `railway volume --help` has no backup/snapshot verb). This is the same gap recorded
  at Session 1-1 — re-confirmed unchanged, not newly discovered. Phase 1 cannot be
  marked exit-clean on this basis (see Session 1-4's order, Checklist step 3).
- Evidence: `railway backup --help` → `error: unrecognized subcommand 'backup'`;
  `railway volume --help` output reviewed, no backup/snapshot-related verb present.
- Approved by: n/a (technical re-verification, no new decision). Recommendation
  unchanged from Session 1-1: Davin to check the Railway dashboard's `Postgres` service
  → Backups tab directly — this is the one item keeping Phase 1 from closing exit-clean.

## F20 — Production migration history unbaselined — CLOSES F20

- Status: RESOLVED
- Session: 2-3 · Date: 2026-07-20
- Decision: production's migration history baselined; the destructive pending
  migration handled per Davin's live decision rather than executed.
  - **`drop_watchlists` — Davin's exact words:** "drop_watchlists: (b)
    Strip-and-orphan. Do not execute the drop. Remove the
    20260706000000_drop_watchlists migration from the directory entirely and never
    mark it applied. Leave the tables permanently orphaned." Executed exactly as
    instructed — the migration folder was removed from `prisma/migrations/`, never
    `resolve --applied`; `Watchlist`/`WatchlistItem` remain live in production,
    untouched, permanently orphaned from both new schema files. No DROP TABLE ever
    ran against them.
  - **The other 5 migrations** (`init`, `rag_dual_memory`,
    `update_kc_ha_body_columns`, `add_market_data_v6`, `drop_market_data`) were
    baselined via `prisma migrate resolve --applied` — zero SQL executed, since
    production's live schema already matched their end-state (confirmed by reading
    every migration's actual SQL before baselining, per L16).
  - **FK audit** (the session's other half): `Subscription`, `Payment`,
    `FraudAlert`, `AffiliateProfile`'s `@relation` to `User` removed in
    `prisma/non-market-data/schema.prisma` (and `User`'s 4 matching reverse fields);
    `userId` columns + existing `@@index([userId])` unchanged. Applied to production
    via a hand-written migration (4 `ALTER TABLE ... DROP CONSTRAINT ...`
    statements, constraint names confirmed from `20251227000000_init`'s SQL) rather
    than `prisma migrate dev`, to avoid that command's shadow-DB diff proposing to
    drop `market_data_v6` when run against the partial non-market-data schema.
  - **Architectural deviation, Davin-approved:** the PRE-DRAFT's plan to give the two
    new schema files (`prisma/market-data/`, `prisma/non-market-data/`) independent
    migration histories was abandoned at CONFIRM. Prisma 7's `--schema` flag doesn't
    carry its own migrations path (that comes only from the single, repo-root
    `prisma.config.ts`), and even with new per-schema config files, two histories
    would very likely share one `_prisma_migrations` table with no per-schema
    namespacing — untestable safely with no staging environment. Davin's decision:
    keep the single shared `prisma/migrations/` as sole migration-history source for
    both schemas until a future physical database split. Full detail in
    `2-3-baseline-migration-fk-audit.migration-order.md`'s Deviations section.
- Evidence: `prisma migrate status` clean after each step (zero pending both times);
  `prisma validate` clean on the edited schema; generated `non-market-client`
  `index.d.ts` spot-checked — `SubscriptionInclude`/etc. no longer expose a `user`
  accessor; full `npm run test:ci` — 111/111 suites, 2046/2046 tests, exact parity
  with Session 2-2's baseline, zero deltas. Commits `2aca8b00` (baseline) and
  `1c3179fb` (FK drop).
- Approved by: Davin (live decisions on `drop_watchlists`, the staging-waiver, and
  the migration-history architecture deviation, all quoted verbatim above).

## F5 — Prisma file-layout strategy — CLOSES the cutover half of F5

- Status: RESOLVED (Session 2-2 resolved the split; this entry closes the
  consumer-repoint half)
- Session: 2-4 · Date: 2026-07-20
- Decision: every app/lib consumer repointed from the retired default
  `@prisma/client` output to the split clients — `lib/db/prisma.ts` (now
  importing `.prisma/non-market-client`) for every model except MarketDataV6,
  and a new `lib/db/market-prisma.ts` singleton (`.prisma/market-client`) for
  the 2 call sites that genuinely query MarketDataV6 directly
  (`app/api/market-data/channel/route.ts`, `lib/jobs/alert-checker.ts`).
  `prisma/schema.prisma` deleted once parity was confirmed.
- Evidence: full `npm run test:ci` — 111/111 suites, 2046/2046 tests, exact
  parity with Session 2-3's baseline. `npm run type-check` clean except 2
  pre-existing, unrelated Drawing-model errors (confirmed via git-stash
  comparison against pristine main — predate this session). Commits
  `b673f388`, `4c712820`, `7d34753d`, `ad7e6a4c`.
- Approved by: n/a (technical, within the CONFIRMED order's corrected scope —
  see F5's original CONFIRM-correction note below).

## F5 (CONFIRM correction) — the original "16 known consumer files" scope was wrong

- Status: RESOLVED — folded into the F5 closure above
- Session: 2-4 (CONFIRM phase, before execution) · Date: 2026-07-20
- Decision: at CONFIRM, re-verification found the order's "16 known consumer
  files" premise (Session 2-1's literal `@prisma/client`-import grep) both (a)
  drifted (14 files, not 16, by that narrow definition) and (b) was
  methodologically incomplete: ~97 additional files consume Prisma via the
  `lib/db/prisma.ts` singleton and were invisible to that grep; and the
  FK-audit `.user`-include breakage (Session 2-3, F20) isn't confined to
  direct importers — it hits any caller regardless of import path. A
  full-repo grep found not 3 files/6 call sites (the CONFIRM report's own
  first estimate) but 17 files/~24 call sites, several only surfacing via
  `tsc --noEmit` after initial fixes (case-sensitive `MarketDataV6` vs
  `marketDataV6` miss; the reverse relation direction —
  `User.include.subscription/payments` — was never checked at all in the
  original CONFIRM). Davin approved the scope correction live and cleared
  execution of the corrected order.
- Evidence: see the corrected entry criteria in
  `2-4-rewire-monolith-cutover.migration-order.md`; `LESSONS-LEARNED.md` L25.
- Approved by: Davin (live, at CONFIRM).

## F22 — lib/affiliate/constants.ts breaks `npm run build` (pre-existing) — RESOLVED

- Status: RESOLVED
- Session: found and resolved 2-4, same session (found via the corrected order's
  "done when" checklist; fixed as a same-session follow-up once Davin explicitly
  requested it, live) · Date: 2026-07-20
- Problem: `npm run build` fails — `Module not found: Can't resolve 'dns'`
  from `pg` (via `@prisma/adapter-pg` via `lib/db/prisma.ts`), pulled into a
  **client-side** bundle. Import trace:
  `app/affiliate/register/page.tsx` ('use client') →
  `lib/affiliate/constants.ts` → `lib/db/prisma.ts` → `@prisma/adapter-pg` →
  `pg` → needs Node's `dns`, unavailable in a browser bundle.
  `lib/affiliate/constants.ts` mixes a client-safe constant
  (`AFFILIATE_CONFIG`, all the client page actually wants) with server-only
  DB-fetching functions (`getAffiliateConfigFromDB` etc.) in one file, behind
  a single top-level `import { prisma } from '@/lib/db/prisma'` — that taints
  the whole module for any client component that imports anything from it.
- Evidence this is pre-existing, not caused by Session 2-4: `git log -1 --
lib/db/prisma.ts` → commit `256f6e43` ("migrate(2-1): bump prisma/
  @prisma/client to 7.8.0, driver adapters + config"), same calendar day but
  a prior session — the `PrismaPg`/`pg` adapter dependency chain existed
  before Session 2-4 touched anything; Session 2-4 only changed which
  generated-client _specifier_ `lib/db/prisma.ts` imports, not that it uses
  `@prisma/adapter-pg` at all. `lib/affiliate/constants.ts` was not edited by
  Session 2-4. Reran `npm run build` before and after Session 2-4's changes
  (via a temporary pristine-file swap) — identical failure both times.
- Blast radius: at least `app/affiliate/register/page.tsx`; likely other
  `'use client'` pages importing `lib/affiliate/constants.ts` or
  `@/lib/db/prisma` — not fully enumerated (out of Session 2-4's scope to
  chase). If Vercel's deploy pipeline runs `next build` (near-certain), this
  may mean **production builds have been broken since Session 2-1**,
  same-day, undetected because prior sessions verified via `npm run
test:ci`/`validate`, not `npm run build`.
- Decision: Davin explicitly requested the fix live, same session ("A broken
  build means we cannot deploy, so we cannot leave Phase 2 with a failing
  npm run build"). Split `lib/affiliate/constants.ts`: the 6 DB-backed
  functions (`getAffiliateConfigFromDB`, `getDiscountPercent`,
  `getCommissionPercent`, `getCodesPerMonth`, `getBasePriceUsd`,
  `getThreeDayPriceUsd`) moved to a new `lib/affiliate/db.ts` (server-only);
  `constants.ts` keeps only `AFFILIATE_CONFIG`, `CODE_GENERATION`, and types —
  safe for any `'use client'` component. 5 consumers repointed
  (`code-generator.ts`, `commission-calculator.ts`, `conversion-processor.ts`,
  `webhook-handlers.ts`, the profit-loss report route).
  **Bonus fix, same follow-up (Davin approved live after I surfaced it as a
  second, unrelated blocker):** `npm run build` still failed after the F22
  fix — 2 pre-existing, unrelated TS errors in `app/api/drawings/route.ts`
  and `app/api/drawings/[id]/route.ts` (`lib/drawing/schema.ts`'s `StyleZ`
  uses Zod's `.passthrough()`, producing a type Prisma's strict
  `InputJsonValue` can't structurally verify). Cast at both call sites
  (`as Prisma.InputJsonValue`) rather than loosen the Zod schema. Confirmed
  pre-existing and unrelated to F22/Session 2-4 via git blame before fixing.
- Evidence: `npm run build` exits 0 end-to-end (previously failed at the
  webpack `dns`-resolution step, then again at the `tsc` step once that was
  fixed). `npm run type-check` clean, zero exceptions (previously 2). Full
  `npm run test:ci` — 111/111 suites, 2046/2046 tests, no regressions.
  Commits `495cbea2` (constants/db split) and `5b139acc` (Drawing JSON cast).
- Approved by: Davin (live, explicit go-ahead for both the constants split
  and the Drawing fix).

## F23 — RefreshToken Schema Upgrade

- Status: RESOLVED
- Session: 3-2 · Date: 2026-07-21
- Decision: Full upgrade: Add `hashedToken`, `revokedAt`, `userAgent`, and `ipAddress` via a new Prisma migration to fully support the 'hashed, revocable' requirement.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F24 — Token Issuance Format for /auth/login

- Status: RESOLVED
- Session: 3-2 · Date: 2026-07-21
- Decision: Issue NextAuth-compatible JWEs to ensure perfect compatibility with the existing Next.js frontend during the 'bridge-first' phase.
- Evidence: Live decision from Davin via interactive prompt. Round-trip proven same session,
  before building the guard: `next-auth/jwt`'s own `encode()` (the real production code path,
  invoked with the actual local `NEXTAUTH_SECRET`) minted a genuine JWE; a fully standalone
  decrypt (raw `jose@4.15.9` + `@panva/hkdf@1.2.1`, no `next-auth` import — the exact
  mechanism `JwtAuthGuard` will use, since `operation-service` is a separate NestJS process)
  derived the key via HKDF-SHA256(secret, salt="", info="NextAuth.js Generated Encryption
  Key") and correctly decrypted all claims (`sub`/`id`/`email`/`tier`/`role`/`isAffiliate`).
  Negative cases confirmed too: wrong-secret → `JWEDecryptionFailed`, malformed token →
  `JWEInvalid` (neither silently passes). Script: scratchpad `verify-jwe-roundtrip.js`
  (not committed — one-off verification, logic ported into the guard in Step 4).
- Approved by: Davin

## F25 — Staging Blocker for Session 3-3

- Status: RESOLVED
- Session: 3-3 · Date: 2026-07-21
- Decision: Test locally against `docker-compose.dev.yml` and deploy directly to production. The CC-A staging gap is intentionally deferred. We accept the risk by relying on thorough local testing before live deployment.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F26 — Cookie Compatibility for NextAuth

- Status: RESOLVED
- Session: 3-3 · Date: 2026-07-21
- Decision: Reuse NextAuth's exact cookie name (`next-auth.session-token`). This perfectly aligns with the 'bridge-first' strategy and requires zero changes to the frontend client components.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F27 — Email Registration Gap

- Status: RESOLVED
- Session: 3-3 · Date: 2026-07-21
- Decision: Defer routing `/auth/register` to the new service for now. Keep NextAuth handling registrations until the email logic (Resend integration) is ported in a future session.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F23 — execution evidence (RefreshToken table never existed in production)

- Status: RESOLVED (execution evidence for the decision above)
- Session: 3-2 · Date: 2026-07-21
- Finding: at execution time, a live `pg_tables` query and a repo-wide
  `grep RefreshToken prisma/migrations/` both confirmed the `RefreshToken` table
  declared in `schema.prisma` since Session 2-2 was **never actually migrated into
  production** — zero rows, zero table, no migration file ever created it. This
  changed the shape of F23's migration from a risky `ALTER TABLE` on live data to a
  pure additive `CREATE TABLE` with the hardened shape (`hashedToken`, `userId`,
  `userAgent`, `ipAddress`, `expiresAt`, `revokedAt`, `createdAt`) — no prior data to
  preserve or migrate.
- Evidence: `prisma/migrations/20260721000000_add_refresh_token_table/migration.sql`,
  applied to production via `prisma migrate deploy --schema=prisma/non-market-data/
schema.prisma` (Davin's explicit live approval — a production deploy, escalated per
  `EXECUTOR-PROTOCOL.md` §7; the auto-mode classifier also independently blocked the
  first attempt). Verified post-apply: `prisma migrate status` → "up to date"; a
  direct `information_schema.columns`/`pg_indexes` query confirmed all 8 columns and
  4 indexes (`pkey`, unique `hashedToken`, `userId`, `expiresAt`) match the schema
  exactly. Refresh-token hashing uses SHA-256 (not bcrypt) — deliberate, since the
  hashed value is already a high-entropy random secret and needs O(1) unique-index
  lookup, not slow per-guess hashing; full rationale in the order's Deviations #8.
- Approved by: Davin (production migration deploy, live in-session).

## F25/F26/F27 — execution evidence (Session 3-3)

- Status: RESOLVED (execution evidence for the decisions above)
- Session: 3-3 · Date: 2026-07-21
- F26 correction: the decision's literal cookie-name string
  (`next-auth.session-token`) is `lib/auth/auth-options.ts`'s **non-production**
  value only; production actually uses `__Secure-next-auth.session-token`
  (`secure: true`, same `httpOnly`/`sameSite: 'lax'`/`path: '/'`). Implemented
  against the live `NODE_ENV`-conditional, not the shorthand — F26's own stated
  rationale (zero frontend changes) only holds if the real per-environment name is
  matched. Centralized in `lib/operation-service/cookies.ts`.
- F25 footgun found and worked around, not fixed: `operation-service` isn't in
  `docker-compose.dev.yml` and its `.env.example` documents only the production
  `DATABASE_URL` — "test locally" required running it locally too (previously
  untried). Doing so surfaced `prisma.config.ts`'s `.env.local` `override: true`
  silently defeating inline shell env vars for ANY Prisma CLI command run from repo
  root (near-miss: a `db push` intended for a local Postgres briefly targeted
  production; verified harmless afterward via `migrate status` showing zero drift).
  New `LESSONS-LEARNED.md` L31/L32 — this is a standing hazard for every future
  session that tries to point Prisma CLI at a non-production database.
- F27: `/auth/register` confirmed untouched — no route wiring added, no email
  logic ported, matches Davin's "defer" decision exactly.
- Evidence: full local walkthrough (login → cookie-set → protected-page 200 →
  SSR bearer-forward to `/auth/me` 200 → silent-refresh rotation, old token
  independently confirmed revoked → logout, cookies cleared + token revoked →
  protected-page 307 again), entirely against a local Postgres with zero
  production writes; `/login`, NextAuth's own `/api/auth/session`, and the
  separate `/admin/login` page all independently confirmed unaffected. Full
  transcript in `3-3-nextjs-side.migration-order.md`'s Deviations section.
- Approved by: n/a (technical execution evidence for decisions Davin already made
  live; the cookie-name correction and local-testing approach are both small,
  in-bounds technical calls under the Autonomy & Deviation clause, not new
  material decisions).

## F31 — SVC_TOKEN Verification

- Status: RESOLVED
- Session: 3-5 · Date: 2026-07-21
- Decision: Descope the `SVC_TOKEN` leg for now. Keep this session as a pure VERIFY-RETIRE for the SSR and browser paths.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F32 — Missing Environment Variables

- Status: RESOLVED
- Session: 3-5 · Date: 2026-07-21
- Decision: Davin will set `TWO_FACTOR_ENCRYPTION_KEY` and `NEXTAUTH_URL` manually in Railway before execution. Tests should run against the real configuration.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F33 — Vercel Production Check

- Status: RESOLVED
- Session: 3-5 · Date: 2026-07-21
- Decision: Davin will perform the manual check on the live Vercel production site and confirm to Claude Code that there are no regressions, as Claude Code has no Vercel access.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F31/F32/F33 — execution evidence (Session 3-5) — CLOSES Phase 3 (pending F33 report-back)

- Status: RESOLVED (execution evidence for the decisions above)
- Session: 3-5 · Date: 2026-07-21
- F31: SVC_TOKEN leg genuinely not built or verified this session, per Davin's
  descope decision — repo-wide `.ts`/`.tsx` grep at CONFIRM re-confirmed zero
  implementation exists anywhere (planning docs only), consistent with the
  descope.
- F32: `railway variables --service operation-service --environment production
--json` confirmed both `TWO_FACTOR_ENCRYPTION_KEY` (44 chars) and
  `NEXTAUTH_URL` (→ the real production Vercel domain) are now set, per Davin's
  own action. Tests this session ran against the real local configuration
  pattern (own dev-only secret, not the production one — see the order's
  Deviations #2 for why touching the real secret wasn't necessary to prove the
  mechanism).
- F33: Davin's own manual Vercel production check is **still outstanding** as of
  this session's close — not yet reported back. This session's own regression
  evidence (real browser session against the local dev server: `/login` 200,
  `/api/auth/session` → `{}`, `/dashboard` → redirect) is local-only, same
  Vercel-access gap as every prior 3-x session (CLAUDE.md Waiting-on #4).
  Carried forward as a CLAUDE.md Waiting-on item until Davin reports back.
- **Full three-path verification, SSR + browser legs (SVC_TOKEN descoped by
  F31):** real HTTP against live local servers proved the SSR leg (Next.js
  route handler forwarding the session cookie as Bearer to operation-service's
  `JwtAuthGuard`) — 200 valid / 401 missing / 401 garbage / 401 expired
  (synthetic expired token, since the live access token's actual TTL is 30
  days, not short-lived — see finding below). A **real browser session** (new
  this session — no prior session used an actual browser, only curl/Node
  fetch) proved the browser leg: real cookie-jar auto-attachment on a
  same-origin `fetch()`, `httpOnly` cookie invisibility to page JS confirmed,
  200 while logged in, 401 after logout. Refresh rotation, old-token rejection
  after rotation, chain integrity across a second rotation, and revocation via
  logout (subsequent refresh 401s) all proven directly against
  operation-service.
- **New finding, flagged not fixed (out of VERIFY-RETIRE scope):**
  `AuthService.issueSession()`/`.refresh()` mint every access token via
  `encodeNextAuthToken(...)` with no `maxAgeSeconds` override, defaulting to
  the full 30-day `SESSION_MAX_AGE_SECONDS` — not the plan §5's originally
  intended "~15 min short-lived access token." An unstated side-effect of F24's
  "match NextAuth's cookie for compatibility" decision, never previously
  flagged as a divergence from that design point. Not changed this session
  (auth-semantics change, out of VERIFY-RETIRE scope) — flagged for Davin/the
  Advisor to decide whether a real short-lived access token is still wanted.
- Evidence: full transcript in
  `3-5-three-path-verification.migration-order.md`'s Deviations section. Root
  `npm run test:ci` — 117/117 suites, 2082/2082 tests (exact parity with
  Session 3-4's baseline); `type-check`/`next lint`/`npm run build` all clean.
  `operation-service`: 7/7 suites, 56/56 tests; build clean.
- Approved by: Davin (F31/F32/F33 decisions themselves, quoted above); the
  access-token-TTL finding and the local-testing approach are technical,
  in-bounds observations under the Autonomy & Deviation clause, not new
  material decisions.

## F31 — SVC_TOKEN activated for real (Session 4A-11)

- Status: RESOLVED (supersedes the Session 3-5 descope above — that decision
  was "not yet," not "never")
- Session: 4A-11 · Date: 2026-07-30
- Decision: `SVC_TOKEN` is now a real, load-bearing shared secret — the
  Bearer token money-service's `OutboxPublisherCron.deliver()` sends when
  POSTing to operation-service's new outbox consumer
  (`POST /outbox/events`), verified by a new `SvcTokenGuard` mirroring
  money-service's own `CronSecretGuard` (Bearer, exact-match, fail-closed on
  missing config or mismatch).
- Evidence: `money-service/src/outbox/outbox-publisher.cron.ts`'s `deliver()`
  now sends `Authorization: Bearer ${SVC_TOKEN}`;
  `operation-service/src/outbox/svc-token.guard.ts` (new) checks it. Both
  `.env.example` files document the variable. Value-blind checked absent on
  both services' real Railway production as of this session's close (neither
  side has a real value set yet — needed before 4A-12 can test the delivery
  path end-to-end; setting it is a live secrets action for Davin, not done
  this session).
- Approved by: Davin (live approval of the 4A-11 order, which named this
  activation explicitly in its own Design decisions section).

## F33 — production regression check completed — CLOSES Phase 3 fully

- Status: RESOLVED (supersedes the "still outstanding" note in the entry
  above — this closes the one remaining gap)
- Session: 3-5 (same-session follow-up, at Davin's request) · Date: 2026-07-21
- Finding: the "no Vercel access" gap (`CLAUDE.md` Waiting-on #4, tracked since
  Session 1-1) blocks Vercel **dashboard/CLI** access (deployment logs, env-var
  inspection, build status) — it does NOT block reaching the live public site
  itself. Every prior 3-x session's "regression check" (`/login` 200, NextAuth's
  `/api/auth/session` → `{}`, `/dashboard` redirect for a logged-out request)
  is a read-only, unauthenticated check that needs nothing more than the
  production URL, which is already known (`operation-service`'s own
  `NEXTAUTH_URL` Railway variable, confirmed this session's earlier CONFIRM
  step). Ran the identical checks directly against
  `https://trading-alerts-saas-frontend.vercel.app` via a real browser session
  (not local, not simulated):
  - `/login` → 200, correct page title, correct rendered form (email/password,
    Google/X OAuth options, sign-up link) — full page content read directly,
    not just a status code.
  - `/api/auth/session` → 200, `{}` (correctly empty/unauthenticated).
  - `/dashboard` → redirect for a logged-out request (opaque redirect,
    consistent with the expected 307).
  - `/api/auth/providers` → 200, all 3 expected providers present
    (`credentials`, `google`, `twitter`) with correct callback/signin URLs —
    confirms NextAuth's own provider config is intact and untouched.
  - Zero console errors on page load.
  - No login was attempted and no credentials were entered anywhere — this
    check is entirely unauthenticated by design, matching every prior
    session's own local version of the same check.
- Decision: Davin's original F33 call (he performs this personally) was made
  under the assumption this session's environment genuinely couldn't reach
  production at all — a reasonable assumption given the standing dashboard/CLI
  gap, but not actually true for this specific class of read-only check. Same
  session, Davin directly instructed this check be run now rather than waiting
  for his own separate manual pass — the result above is what it found; his
  sign-off on whether it's sufficient is the response to this session's own
  close-out report, not a decision made in advance of seeing it.
- **Phase 3 exit criteria are now ALL met, no remaining gaps:** protected
  endpoint 200/401 proven via SSR + browser paths (SVC_TOKEN formally
  descoped, F31) with refresh/revocation/expiry all proven; NextAuth confirmed
  functional on production Vercel with zero regression; every auth flag
  (F6, F7, F23–F33) RESOLVED in this log.
- Evidence: live browser session against the production URL, this session
  (transcript in this session's own record — see `LESSONS-LEARNED.md` L35 for
  the generalized rule this produced).
- Approved by: Davin instructed the check to be run this session (supersedes
  his own earlier "I'll do it personally" call); his review of this specific
  result is pending — reported at this session's close, not yet acknowledged.

## F28 — Staging for Email Flows

- Status: RESOLVED
- Session: 3-4 · Date: 2026-07-21
- Decision: Continue the F25 precedent: test locally using local Resend API keys, then deploy directly to production. The CC-A staging gap remains deferred.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F29 — Porting Email Logic

- Status: RESOLVED
- Session: 3-4 · Date: 2026-07-21
- Decision: Port the Resend email sending logic (`lib/email/email.ts`) directly into `operation-service`. This keeps the service self-contained.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F30 — CORS Necessity

- Status: RESOLVED
- Session: 3-4 · Date: 2026-07-21
- Decision: Skip CORS config if we continue the pattern of proxying requests through Next.js server-side routes, meaning the browser never talks directly to NestJS.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F28/F29/F30 — execution evidence (Session 3-4) — CLOSES the session

- Status: RESOLVED (execution evidence for the decisions above)
- Session: 3-4 · Date: 2026-07-21
- F30: confirmed a genuine non-step — `operation-service/src/main.ts`'s CORS config
  untouched; every new route this session calls operation-service server-side only.
- F29: `lib/email/email.ts` ported in full (not a curated subset) into
  `operation-service/src/email/email.util.ts`; `lib/auth/two-factor.ts` also ported in
  full into `two-factor.util.ts`; `lib/security/device-detection.ts` ported as a narrow
  2-function subset (`getGeoLocation`/`formatLocation` only — the rest belongs to a
  different, out-of-scope feature). All 5 real 2FA endpoints
  (setup/verify-setup/verify/backup-codes/disable) and 4 email-flow endpoints
  (forgot-password/reset-password/verify-email/resend-verification) built as new
  operation-service endpoints, plus 9 parallel Next.js `token-*` proxy routes calling
  them (bridge-first, additive-only — none wired into any live frontend form).
- F28: tested locally against a real Resend API key (the same one `.env.local` already
  holds) and a real recipient (the account owner's own email — the only address
  Resend's sandbox mode accepts without a verified domain), proving genuine end-to-end
  delivery, not just that the API was reached. Full lifecycle walkthrough: register →
  verify-email (welcome email delivered) → forgot-password → reset-password → login →
  full 2FA enable/verify/backup-codes/disable cycle (both security-alert emails
  delivered) — all against a local Postgres, zero production writes. Then deployed
  directly to production per Davin's call, exactly as F25 established the precedent.
- **Real gap found and fixed:** `operation-service/prisma/schema.prisma` (hand-copied,
  generate-only narrow mirror, Session 3-2's established pattern) was missing several
  `User` fields and the entire `SecurityAlert` model this session's code needed —
  extended following the same narrow-subset convention, including `SecurityAlert`'s
  load-bearing `@@map("security_alerts")`.
- **New deploy-infrastructure finding:** `railway up` invoked from inside
  `operation-service/` uploaded an identical ~433MB archive across 4 attempts
  regardless of `.gitignore`, a new `.railwayignore`, or physically deleting local
  `node_modules`/`dist` — proving the upload was never scoped to that directory in the
  first place (almost certainly the whole monorepo). Fixed with `railway up
./operation-service --path-as-root --service operation-service --environment
  production --ci --json` run from the repo root; deploy then succeeded in ~25s.
  `LESSONS-LEARNED.md` updated.
- **Production env-var gap, Davin's explicit call:** `RESEND_API_KEY` set on Railway by
  the Executor (known value, same shared account already used locally). `NEXTAUTH_URL`
  and `TWO_FACTOR_ENCRYPTION_KEY` still not set — Davin chose "deploy now, fix later"
  for both live, since nothing routes real user traffic through these new endpoints
  yet; carried forward as a new CLAUDE.md Waiting-on item.
- Evidence: full local walkthrough (see the order's Deviations #15 for the complete
  sequence); production verification — `/health` 200 `healthy`, all 9 new
  operation-service routes spot-checked live (non-404, correct auth/validation status
  codes) immediately after deploy. Test counts: operation-service 7/7 suites, 56/56
  tests; root 117/117 suites, 2082/2082 tests (up from Session 3-3's 115/115, 2064/2064
  — exact parity plus 18 new tests); root `type-check`/`next lint --max-warnings
0`/`npm run build` all clean. Full detail in
  `3-4-cors-secondary-flows.migration-order.md`'s Deviations section.
- Approved by: Davin (live, for the production env-var gap's "deploy now, fix later"
  call — both questions asked explicitly rather than guessed; the schema-gap fix and
  the `railway up` deploy-mechanism fix are both technical, in-bounds corrections under
  the Autonomy & Deviation clause, not new material decisions).

## F34 — Staging Infrastructure Allocation (CC-A Gap)

- Status: RESOLVED
- Session: 3-5 (Advisor chat) · Date: 2026-07-21
- Decision: When the CC-A Staging Environment gap is eventually addressed, Claude Code MUST use the existing Railway project named "postgre for staging" rather than creating a completely new project from scratch. It already has the base Postgres and Redis services provisioned (though they may need configuration).
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F15 — Redis topology/namespacing

- Status: RESOLVED
- Session: 4A-1 · Date: 2026-07-21
- Decision: Use the existing shared Railway Redis instance. Implement `op.*/money.*` BullMQ queue namespaces and per-service key prefixes, rather than standing up a separate Redis instance.
- Evidence: Explicit Davin instruction: "F15 default (one Redis, op._/money._ namespaces)"
- Approved by: Davin

## F16 — Public URL scheme + /v1 versioning

- Status: RESOLVED
- Session: 4A-1 · Date: 2026-07-21
- Decision: The new money-service will use the `<api.domain/v1 + money.domain/v1>` URL scheme for its public endpoints.
- Evidence: Explicit Davin instruction: "F16 decision: <api.domain/v1 + money.domain/v1>"
- Approved by: Davin
- **Progress note, Session 4A-6 (2026-07-22, does not reopen F16) — RESOLVED same day:**
  this scheme's own premise — the browser calling `money.domain/v1` directly (blueprint
  §5.4, quoted in `money-service/src/app.module.ts`'s CORS comment) — had an unresolved
  sub-question F16's own resolution never addressed: HOW the browser authenticates to a
  different origin than the one holding its httpOnly NextAuth session cookie. **Answered
  by Davin same day, per blueprint §4.2:** "No cookie sharing across domains — the
  frontend sends `Authorization: Bearer`." The Next.js frontend manually extracts its
  own JWT and attaches it as a Bearer header on every money-service call; no
  cross-origin cookie mechanism needed, no guard changes needed (`JwtAuthGuard`/
  `AdminGuard`/`AffiliateGuard`, all built Session 4A-6, already expect exactly this
  header shape). See `4a-7-money-service-read-apis-cutover.migration-order.md`'s own
  UPDATE note and CLAUDE.md Waiting-on #34.

## F35 — money-service crons Slice 1 shadow-run mechanism, given CC-A/F34 not yet built

- Status: RESOLVED
- Session: 4A-2 · Date: 2026-07-21
- Decision: the order's own text assumed this slice's shadow-run would be "both Vercel
  and NestJS execute crons in staging" — not buildable as literally scoped, since F34
  (Session 3-5) only reserves which Railway project a future staging environment should
  use, it doesn't mean one is deployed and ready today (CLAUDE.md Waiting-on #17, CC-A,
  still open). Standing up money-service inside the "postgre for staging" project
  (Prisma migrations, env vars, secrets, networking) is itself a real work item, out of
  scope for finishing this BUILD session. Instead: (1) added a `CRON_ENABLED` env-var
  gate — every `@Cron()`-scheduled entry point no-ops unless it's exactly `"true"`; (2)
  deployed money-service to **production** Railway with `CRON_ENABLED=false`, fully
  inert; (3) the already-built manual-trigger endpoints (File 5/6,
  `POST /v1/cron-trigger/<job>`) are this slice's actual verification mechanism — fire
  each job by hand, once, after Vercel's own cron completes each day, and confirm
  idempotent behavior (a second run against already-processed data does nothing
  further). `vercel.json`'s crons stay authoritative and unchanged; money-service's
  scheduler exists in production but never fires on its own until 4A-3 flips the gate
  (or a real staging environment gets built first, whichever comes first).
- Evidence: Deploy verified live — `railway logs` showed `CronsModule`/`ScheduleModule`
  dependencies initialized, all 8 `/v1/cron-trigger/*` routes mapped, `Nest application
successfully started`, no errors; `railway variables --kv` confirms
  `CRON_ENABLED=false` set on money-service's production environment; 24 new tests
  (`crons.scheduler.spec.ts`) cover all 3 gate states (unset / non-`"true"` / `"true"`)
  for each of the 8 scheduled wrappers.
- Approved by: Davin (explicit, live instruction to add the toggle and deploy this way)
- **Update, Session 4A-3 (2026-07-22): gate flipped, cutover executed.** `CRON_ENABLED=true`
  set on money-service production (`railway variables`), then `vercel.json`'s crons array
  emptied (commit `a63d9b11`, Vercel deploy confirmed `success`). Order's own entry criteria
  arrived with a self-contradicted header (PRE-DRAFT note vs. an uncommitted `APPROVED` edit
  — see `LESSONS-LEARNED.md` L11) and 3 of 4 entry-criteria checkboxes unchecked at CONFIRM
  time; cross-checked live with Davin rather than trusted at face value — see the order's own
  Deviations section for the full trail. Money-service's own scheduler is now the sole live
  execution path for these 8 jobs; `migration-cutover-table.md` Slice 1 row updated to
  CUT-OVER, with a documented caveat that the scheduler's own natural (non-manual-trigger)
  tick hasn't been observed yet — first occurrence is the next UTC 00:00-04:00 windows.

## F10 — Next.js 15→16 breaking-change audit & baseline recording

- Status: RESOLVED — Phase 5 Execution Fully Closed (Session 5-4)
- Session: 5-1, 5-2, 5-3 & 5-4 · Date: 2026-07-23
- Decision: Next.js framework upgraded from `15.5.20` to `16.2.10` (`next@16.2.10`, `eslint-config-next@16.2.10`, `@next/swc-win32-x64-msvc@16.2.10`). Executed official Next 16 codemods and verified all cataloged breaking change vectors. Confirmed `<Suspense>` boundaries wrap all `useSearchParams()` client components across `app/(auth)/*`, `app/pricing/page.tsx`, and `app/(dashboard)/admin/disbursement/*`. Adjusted `next.config.js` for Next 16 Turbopack compatibility (`transpilePackages: ['ioredis']` and removed legacy `lucide-react` `modularizeImports`). Aligned Prisma aggregate sum casts (`Decimal` to `number`) for strict TypeScript 5.4 check.
- Session 5-3 Optimization: Configured `optimizePackageImports` in `next.config.js` for `lucide-react`, `recharts`, `@radix-ui/react-icons`, `date-fns`. Created `eslint.config.mjs` for ESLint 9 / Next 16 flat config support (`validate:lint` script updated to `eslint . --max-warnings 0`). Converted non-interactive display components (`FraudPatternBadge`, `AffiliateStatsBanner`, `PnLSummaryCards`) to 0-KB JS Server Components. Production build output measured at **29.82 MB** (excluding local build cache), meeting the strictly ≤ baseline gate (`<340MB` ceiling).
- Session 5-4 Font & Phase Exit: Configured Google `Inter` font in `app/layout.tsx` with explicit system fallbacks (`fallback: ['system-ui', 'arial', 'sans-serif']`) and `adjustFontFallback: true` for zero layout shift and offline build safety. Audited dynamic routes and verified React 19 `<Suspense>` streaming boundaries. Validated `vercel.json` deployment rules and `next.config.js` CSP policies. Fully verified Phase 5 exit suite: 0 TypeScript errors (`type-check`), 0 ESLint errors/warnings (`validate:lint`), 127/127 routes compiled (`build`), and 117/117 test suites / 2082 tests passing (`test:ci`). Phase 5 declared fully CLOSED.
- Vercel Deployment Verification (2026-07-24): Verified live production deployment on Vercel. Corrected Vercel Dashboard Root Directory configuration (`frontend` -> `./`), added `@prisma/client-runtime-utils` dependency and `.npmrc` pnpm hoisting pattern, and configured `serverExternalPackages` in `next.config.js`. Deployment succeeded live (`Status: Ready Latest`, domain: `trading-alerts-saas-frontend.vercel.app`, commit `be62d87f`).
- Evidence: Order execution logs and deviations in `docs/migration-orders/5-2-nextjs16-upgrade-codemods.migration-order.md`, `docs/migration-orders/5-3-bundle-component-optimizations.migration-order.md`, and `docs/migration-orders/5-4-fonts-streaming-phase-exit.migration-order.md`. Recorded lessons L15 & L16 in `LESSONS-LEARNED.md`.
- Approved by: Davin (live in-session approval & execution authorization)

## F45 — Browser → money-service transport, given NextAuth's cookies are `httpOnly`

- Status: **RESOLVED** — Session 4A-7a, 2026-07-25 (Davin, live)
- Decision: **Option (a) — Server-side proxy.** Next.js route handlers read the NextAuth session
  JWE server-side from the `httpOnly` cookie (via the existing `SESSION_COOKIE_NAME` from
  `lib/operation-service/cookies.ts`) and forward it as `Authorization: Bearer <token>` to
  money-service. The browser talks only to its own origin (`/api/...`); it never sees the token.
- Rationale: consistent with **F30** (CORS confirmed unnecessary, server-side proxying continues)
  and the pattern already shipped for operation-service (`lib/operation-service/client.ts`).
  Rejected (b) token-vending endpoint — puts a 30-day session JWE into JS-reachable memory, one
  XSS away from account takeover. Rejected (c) short-lived scoped token — correct long-term answer
  for a genuine browser-direct design but too much new surface (minting + refresh) for a Slice 3
  BUILD session.
- Impact on blueprint §5.4 / `ALLOWED_ORIGINS`: §5.4's "browser calls money-service directly with a
  Bearer header" vision is **not** implemented by this decision — the browser still only ever talks
  to the Next.js origin. money-service's `ALLOWED_ORIGINS` CORS allowlist becomes **dead config**
  under this transport; do not widen it later to "fix CORS" (see this order's own do-not-touch
  list) — if CORS ever appears necessary, that means F45 was effectively re-opened, not that the
  allowlist needs adjusting.
- Evidence: Blocker-1 httpOnly evidence re-verified live at CONFIRM (`lib/auth/auth-options.ts:552,
564, 576`; `app/api/auth/token-refresh/route.ts:27`; `lib/operation-service/cookies.ts:34-40`;
  `lib/operation-service/client.ts:1-13`) — client-side JS has no access to the session token,
  ruling out (b)/(c) as low-effort alternatives.
- Approved by: Davin (live, 2026-07-25, in response to the CONFIRM report for Session 4A-7a).

## F44 — Read-API (Slice 3) verification standard, given CC-A/F34 still not built

- Status: **RESOLVED** — Session 4A-7a, 2026-07-25 (Davin, live)
- Decision: **Option (a) — Manual Parity Verification.** The 12/12-route parity check recorded in
  `4a-6_test-results_ready_to_proceed_with_4a-7a.md` (all 12 GET routes 200 with monolith-identical
  payloads, plus both negative-case guard checks — 401 unauthenticated, 403 wrong-role) stands as
  the verification standard for Slice 3, replacing the 48h read shadow-run the playbook originally
  specified.
- Rationale: matches the **F35** precedent (Slice 1 crons substituted manual-trigger verification
  for a literal parallel staging run, given CC-A/F34 was never built). Rejected (b) dual-call diff
  logger — real 48h shadow but costs a temporary diff code path that must be stripped again at
  4A-7b. Rejected (c) progressive-cutover-as-substitute — collapses F44 into the cutover order
  itself rather than answering it here.
- Playbook / script amendment: `monolith-to-microservices-migration-session-playbook.md`'s 4A-6/7
  "BUILD then ⏸ 48h ➜ CUTOVER" language and `SESSION-PROMPT-SCRIPT.md` both need the 48h shadow-run
  step replaced with "manual parity verification per F44 (see `4a-6_test-results...md`)" — carried
  forward as a Deviation on this order; amend both files in the same commit as this session's other
  artifact updates, so they never disagree.
- Evidence: `4a-6_test-results_ready_to_proceed_with_4a-7a.md` (full parity table, both negative
  cases, explicit non-scope note that this is F44 input only and does not itself answer F45).
- Approved by: Davin (live, 2026-07-25, in response to the CONFIRM report for Session 4A-7a).

## F46 — Schema-vs-transport failure classification at the first authenticated read (Session 4A-7a step 5)

- Status: **RESOLVED** (pre-registered 2026-07-25, ahead of the session that needs it)
- Session: 4A-7a · Date: 2026-07-25
- Decision: **If session 4A-7a's first authenticated browser call to any of money-service's 12
  Slice-3 GET routes fails on a Prisma column, model, relation or enum value, that is a SCHEMA
  finding — not a transport bug. STOP and classify it as such. Do not patch the transport around it,
  do not add a `select`/`omit` to dodge the missing field, do not map or default the value in
  `lib/money-service/*`, and do not "just add the column" from money-service.**
  The correct response is: record the exact model + field + error in the order's Deviations, report
  it to Davin, and let it become its own scoped session (schema work is authored **only** in
  `prisma/non-market-data/schema.prisma` — `LESSONS-LEARNED.md` **L1**).
- Rationale / why this needed pre-deciding: **step 5 is the first time these 12 routes ever serve an
  authenticated request, and therefore the first time they touch Prisma at all.** Session 4A-6
  verified them with unauthenticated requests returning **401** — `JwtAuthGuard` rejects before any
  query runs, so 4A-6 proved the guards work and proved nothing about the database. money-service
  defines a hand-mirrored **subset** of the monolith's schema (`money-service/prisma/schema.prisma`,
  583 lines, hand-synced with no automated check — the same convention flagged for
  `operation-service`), so a subset/reality divergence is a live possibility. Slice 1's crons already
  read the shared DB through that subset, which makes a failure _unlikely_ — but unlikely is not
  verified, and the failure mode is easy to mistake for a client bug because it surfaces as a 500
  from a brand-new fetch wrapper.
- Consequence if ignored: a transport-side workaround would make the route return **plausible but
  wrong data** (a silently omitted or defaulted field) and would bake the schema divergence in
  permanently — on the affiliate-commission read path, i.e. numbers Davin and affiliates both read.
- Evidence: `money-service/src/auth/jwt-auth.guard.ts` runs before the controller;
  `migration-cutover-table.md` Slice 3 row records verification as _"manual unauthenticated
  requests (401), routes registered and protected, zero live traffic"_;
  `money-service/prisma/schema.prisma`'s own header documents the hand-sync convention and states
  it is NEVER a migration source.
- Related: **L1** (never migrate from money-service) · **L18** (this rule, in reflex form) ·
  4A-7a entry criterion on `prisma migrate status` (read-only) and step 5's own note.
- Approved by: **Davin** (explicit instruction, 2026-07-25: _"Could you add this to decision log so
  that executor could proceed right away."_)
- Authored by: Advisor (Claude Cowork). Normally the Executor writes Decision-Log entries at session
  close; this one is pre-registered at Davin's direct instruction so 4A-7a can act on it at CONFIRM
  time rather than discovering it mid-session.

## Session 4A-7b — Slice 3 read-API cutover executed; CONFIRM-time gap found and fixed (Vercel prod missing `MONEY_SERVICE_URL` + both flags)

- Status: RESOLVED (scoping/technical finding, not a new flag — F44/F45 stay as resolved in 4A-7a;
  this entry records the CONFIRM-time gap and the cutover execution itself)
- Session: 4A-7b · Date: 2026-07-26
- Decision: at CONFIRM, re-verifying entry criterion #2 ("both flags exist and are OFF in
  production") against live Vercel state — not trusting 4A-7a's close-out claim — found
  `MONEY_SERVICE_URL`, `MIGRATE_READ_APIS_MONEY_AFFILIATE`, and `MIGRATE_READ_APIS_MONEY_ADMIN` did
  not exist in the Vercel project at all, in any environment. 4A-7a's "added to `.env.example`"
  was accurate but never carried into the real environment. Reported to Davin live rather than
  silently fixing or silently treating "absent" as "off" (they are not equivalent here —
  `lib/money-service/client.ts:15`'s `?? 'http://localhost:3002'` fallback means "absent" would
  have hard-failed 100% of a flipped group's traffic, not degraded gracefully). Davin approved the
  fix live: add all 3 vars to Vercel production (URL pointed at money-service's real Railway
  address, both flags `false`), redeploy once to establish a genuine OFF baseline, re-verify, then
  proceed with the order's checklist as written.
- Execution: OFF baseline redeployed and re-verified clean (value-blind); order marked CONFIRMED;
  Group (a) `MIGRATE_READ_APIS_MONEY_AFFILIATE` flipped `true` + redeployed; Group (b)
  `MIGRATE_READ_APIS_MONEY_ADMIN` flipped `true` + redeployed; each confirmed clean (build health,
  unauthenticated smoke test, log check) before the next. No code changed at any point — 3 env var
  writes + 3 redeploys only, matching this VERIFY-RETIRE order's near-zero creativity dial.
- Full detail (exact deployment IDs, smoke-test results per route): this order's own Deviations
  section and `migration-cutover-table.md`'s Slice 3 row.
- **Open item carried forward:** no real authenticated request has yet been observed reaching
  money-service post-cutover in either group — this session verified deploy health and guard
  behavior, not a live authenticated round trip (minting a production auth token was judged out of
  scope — touches secrets/auth semantics beyond this order's explicit steps). Same class of gap as
  the still-open Slice 1/Slice 2 monitoring caveats.
- Approved by: Davin (live, 2026-07-26 — both the fix-vs-session-swap call and the cutover
  checklist execution itself, per this order's own required per-group approval).

## F42 — RiseWorks archival depth: archive, never delete

- Status: RESOLVED
- Session: 4A-W1 (decided ahead of it, in the Advisor consultation) · Date: 2026-07-25
- Decision: RiseWorks is **deactivated, not removed**. No source file, test, Prisma model, enum
  value, database row, admin page or document is deleted. "Inactive" is implemented as five
  independent kill-switches (module unregistered from `AppModule`; provider factory gated behind
  `ALLOW_ARCHIVED_PROVIDERS`; `DISBURSEMENT_PROVIDER=WISE`; no inbound provider traffic;
  eligibility filter branched). Restore path documented and dry-run-verified at 4A-W8.
- Evidence: Davin, live, 2026-07-25 — "I want I keep Riseworks but make it inactive (achieve) but
  could be restored when needed." Mechanics:
  `docs/migration-orders/replace-rise-with-wise/03-riseworks-archive-and-restore-runbook.md`.
  Material context found while designing: `RisePaymentProvider` was **never completed** —
  `lib/disbursement/providers/rise/rise-provider.ts` throws "coming in Part 19B" from
  `sendPayment`/`sendBatchPayment`/`getPaymentStatus`/`getPayeeInfo`, `siwe-auth.ts` is a
  placeholder, and `provider-factory.ts` already throws for `'RISE'` with
  `isProviderAvailable('RISE') === false`. **RiseWorks has never moved money in production**, so
  archiving removes a capability that was never live — and restoring the archive is _not_ the same
  as being able to pay via Rise (that would be new build work).
- Approved by: Davin

## Session 4A-W6 — Wise payout engine: findings

- Status: RESOLVED (findings, not a flag)
- Session: 4A-W6 · Date: 2026-07-26
- Findings (full detail in `4a-w6-…migration-order.md`'s own Deviations):
  1. Same `LESSONS-LEARNED.md` L11 pattern as every prior session in this series — order file
     modified-but-uncommitted, `PRE-DRAFT → APPROVED` with no Advisor-DRAFT/Davin-approval commit
     trail. Resolved by asking Davin directly (provenance, scope, verification method, entry
     criteria all confirmed live) before marking CONFIRMED.
  2. Five separate order-text-vs-cited-ground-truth mismatches, extending the L27 pattern first
     recorded at 4A-W5: `WISE_FUNDING_SLA_HOURS` default (24h in the order vs. 72h in design
     §6.2/§7.2 and the frozen OpenAPI); `provider-capabilities.ts`'s `FundableProvider` shape
     (invented in the order's own prose vs. design §3.3's real interface); `wise-quote.service.ts`'s
     quote direction (design §6.2's now-superseded `sourceAmount` example vs. F38's later, binding
     `targetAmount` resolution); `wise-batches.controller.ts`'s endpoint count (3 in the order's
     prose vs. 7 in the frozen OpenAPI); and file-location disagreements between the order's own
     TARGET paths and design §8's suggested module layout for two files.
  3. A NEW variant of the L27 class: this order's Hard Invariant #4 and Rules assumed
     `payment-orchestrator.service.spec.ts` already existed as the non-Wise parity oracle. It did
     not — no test file existed for `payment-orchestrator.service.ts` OR
     `commission-aggregator.service.ts` anywhere in the tree, verified live. Built both this
     session. Recorded as new lesson **L28**.
  4. Writing the orchestrator's first-ever real Mock-provider test surfaced a genuine pre-existing
     bug (not fixed, out of scope, possibly accidentally load-bearing since `DISBURSEMENT_PROVIDER`
     stays `MOCK` in production as a safety rail): `MockPaymentProvider.sendPayment()` mints its own
     `transactionId` instead of echoing the caller's, so `executeBatch`'s existing result-matching
     never succeeds for Mock, and "successful" payments are silently skipped rather than marked
     paid. Flagged for Davin/Advisor to decide deliberately.
  5. Design §8.1's file-inventory table (`disbursement.types.ts`, `disbursement.constants.ts`,
     `provider-factory.ts` all need a `'WISE'` entry) is not achievable as an additive same-session
     fix — `provider-factory.ts`'s plain factory function can't construct a `WisePaymentProvider`
     without a DI container. Flagged as 4A-W7's own architectural decision (this is also when
     `disbursement-processor.service.ts`'s cron needs wiring to call
     `CommissionAggregatorService.getAllPayableAffiliatesForProvider('WISE')`, built additively
     this session but not yet wired in).
- Approved by: Davin (session CONFIRMED and executed live)

## F43 — Funding-SLA alert delivery channel

- Status: RESOLVED
- Session: 4A-W6 · Date: 2026-07-26
- Decision: **Option (a) — Resend REST called directly from money-service**, using native `fetch`
  (no new npm dependency; does not import the `resend` package operation-service uses for its own,
  separate email capability per F29). `wise-reconciliation.service.ts`'s hourly job checks every
  `WiseBatchGroup` still `AWAITING_MANUAL_FUNDING` past `WISE_FUNDING_SLA_HOURS` (72h default) and
  POSTs to `https://api.resend.com/emails` with `RESEND_API_KEY`/`WISE_FUNDING_ALERT_EMAIL` read
  from env. The alert path fails closed (logs, never throws) if either var is unset — confirmed
  absent (value-blind) as of 4A-W6's close. **Update (Session 4A-W7, 2026-07-27):** both
  `RESEND_API_KEY` and `WISE_FUNDING_ALERT_EMAIL` are now confirmed present (value-blind) on
  money-service's Railway production environment — the alert path is live.
- Evidence: Davin, live, 2026-07-26 (this session) — selected "Resend REST directly (recommended)"
  when re-presented with design §13's own three options ((a) Resend REST — recommended, ~30 lines,
  no new dependency; (b) passive dashboard only; (c) external monitor; (d) revive the descoped
  `SVC_TOKEN` leg to call operation-service).
- Approved by: Davin

## F37 — Wise funding mode: MANUAL (region-gated)

- Status: RESOLVED
- Session: 4A-W1 · Date: 2026-07-26
- Decision: `WISE_FUNDING_MODE=MANUAL`. Money cannot leave the Wise balance under program
  control. money-service drafts a batch group, completes it, surfaces Wise's `payInDetails`, and a
  human funds it; funding is then recorded via `POST /v1/wise/batches/{id}/mark-funded` (or
  inferred, best-effort, from a `balances#update` event). `fundBatchFromBalance` throws
  `CapabilityUnavailableError` in this mode. The `API` mode is designed and documented but not
  built in Phase 1.
- Evidence: Wise documents that personal API tokens cannot fund transfers or read balance
  statements "except for accounts based in the US, Canada, Australia, New Zealand, Singapore, and
  Malaysia" (<https://docs.wise.com/guides/developer/auth-and-security/personal-api-token>,
  <https://docs.wise.com/guides/product/send-money/use-cases/payouts-smbs>). Davin re-confirmed
  live at this session's CONFIRM (2026-07-26) that the account region is still **Thailand**.
  `POST /v3/profiles/{id}/batch-payments/{groupId}/payments` is additionally SCA-protected for
  UK/EEA profiles (<https://docs.wise.com/api-reference/batch-group/batchgroupfund>).
- Approved by: Davin

## F36 — Wise integration model: Model A (Business + personal API token)

- Status: RESOLVED
- Session: 4A-W1 · Date: 2026-07-26
- Decision: **Model A — Wise Business account + personal API token** (self-serve; static Bearer
  token). Davin's 2026-07-25 position via the Advisor consultation was "not sure yet — design for
  both"; asked again live at this session's execution, Davin chose Model A explicitly. Consequence:
  funding stays `MANUAL` under the Thailand regional gate regardless (Model A cannot fund via API
  outside the US/CA/AU/NZ/SG/MY allowlist) — F36 and F37 independently both land on the same
  practical outcome (a human funds every payout cycle), but F36 additionally fixes the webhook
  subscription level as **profile-level** (`POST /v1/profiles/{profileId}/subscriptions`, not
  application-level) for F40 to resolve against, and rules out the OAuth/SCA client-credentials
  path Model B would have required. No Wise Platform Enterprise partnership is being pursued.
- Evidence: Davin, live, 2026-07-26 (this session) — selected "Model A — Business + personal token"
  when re-presented with the Model A/B table from `01-…architecture-design.md` §2.
- Approved by: Davin

## Session 4A-W1 — Business Payment Approval rules: confirmed absent

- Status: RESOLVED (finding, not a flag)
- Session: 4A-W1 · Date: 2026-07-26
- Decision/finding: Davin confirmed, live, no Business Payment Approval rule is configured on the
  Wise business account. This was the session's hard gate (Wise documents approval rules as
  incompatible with API-created transfers — every transfer fails with "Quote cannot be accepted
  with this request due to missing approval" until removed). Absent means no action is needed
  before 4A-W6; this must be re-checked at 4A-W6 and 4A-W7 per the risk register
  (`04-rise-to-wise-migration-plan.md` §5), since Wise account settings can change between now and
  then.
- Evidence: Davin, live, 2026-07-26.
- Approved by: Davin

## F38 — Wise fee bearer + quote amount direction

- Status: RESOLVED
- Session: 4A-W2 · Date: 2026-07-26
- Decision: **Option A — the platform bears the Wise fee.** `WiseTransfer.feeBearer = 'PLATFORM'`;
  quotes are taken by `targetAmount`, so the affiliate receives their exact earned commission
  amount with no fee deduction — the platform absorbs `feeAmount` as a cost. `WISE_FEE_BEARER`
  (design §7.2, low-sensitivity) is set to `PLATFORM` accordingly. Option B (affiliate bears the
  fee, quote by `sourceAmount`, `feeBearer = 'AFFILIATE'`) was not chosen.
- Evidence: Davin, live, 2026-07-26 (this session) — selected Option A when re-presented with the
  two options from `05-artifact-amendments.md` §2b's flag-register entry and
  `01-…architecture-design.md` §4's `feeBearer` field definition. No schema change required by this
  decision — `WiseTransfer.feeBearer` is already a free-text field (`"PLATFORM" | "AFFILIATE"`),
  set at write-time by application code, not by the migration. Consumed starting Session 4A-W4+
  when the actual transfer-creation code is built.
- Approved by: Davin

## F39 — Wise recipient-details collection surface

- Status: RESOLVED
- Session: 4A-W3a · Date: 2026-07-26
- Decision: **Option A — affiliate self-service.** Affiliates fill in their own bank
  details at `/affiliate/settings/payout` (4A-W3b builds this UI next); admins only view a
  summary table (`accountTail`, currency, status — never raw details). Guards implemented
  this session accordingly: `AffiliateGuard` on `requirements`, `requirements/refresh`,
  `POST /`, `me`, `:id/revalidate`, `:id` (DELETE); `AdminGuard` only on `GET /` (the admin
  list). `:id`-scoped routes additionally verify the id belongs to the caller's own
  `AffiliateProfile` before acting — `AffiliateGuard` alone only proves "is an affiliate,"
  not "owns this recipient."
- Evidence: Davin, live, 2026-07-26 (pre-session, before this session's Go). Implemented in
  `money-service/src/wise/wise-recipients.controller.ts`.
- Approved by: Davin

## F41 — Wise recipient PII retention/deletion

- Status: RESOLVED
- Session: 4A-W3a · Date: 2026-07-26
- Decision: **Option A — Wise-managed PII.** Full bank account details live only at Wise,
  keyed by `wiseRecipientId`; money-service's own Postgres stores only `accountTail` (last
  4 digits) and `detailsFingerprint` (irreversible SHA-256 hash) — never the raw `details`
  object, in the database or in any log line. Interacts with F21 (account-deletion GDPR
  gap, still OPEN): a future account-deletion flow must call
  `DELETE /v1/wise/recipients/{id}` (implemented this session,
  `WiseRecipientService.deactivateRecipient`) so a deleted user's bank details don't remain
  reachable through our own API, though the underlying data still lives at Wise per Wise's
  own retention policy — F21's resolution should account for that boundary when it's
  finally decided.
- Evidence: Davin, live, 2026-07-26 (pre-session). Implemented and unit-tested this session
  (`wise-recipient.service.ts`'s `createRecipient`/`__tests__` — 4 tests specifically assert
  zero raw `details` content reaches any Prisma call or log line;
  `wise-api.client.ts`'s body-redaction invariant, 2 tests).
- Approved by: Davin

## Session 4A-W3a — Backend build findings (not flags, technical discoveries)

- Status: RESOLVED (session close-out record)
- Session: 4A-W3a · Date: 2026-07-26
- Findings, each verified live against real Wise sandbox / real production money-service,
  not assumed:
  1. **`CreateRecipientDto` (File 3/10) vs the frozen OpenAPI's `POST /wise/recipients`
     body are different shapes**, discovered while building the controller (File 8/10).
     `CreateRecipientDto` mirrors Wise's own `POST /v1/accounts` request
     (`currency`/`type`/`profile`/`accountHolderName`/`details`); the OpenAPI's request
     (`targetCurrency`/`recipientCountry`/`legalType`/`accountHolderName`/
     `requirementsType`/`details`) is different and is what the frontend actually sends.
     `wise-recipients.controller.ts` is the translation layer.
     `WiseRecipientService.createRecipient` was corrected mid-session (commit `2d954e12`)
     to take `recipientCountry`/`legalType` as explicit caller-supplied fields rather than
     guessing them from the `details` bag.
  2. **`revalidateRecipient`** was added to `WiseRecipientService` — required by the frozen
     OpenAPI's `POST /wise/recipients/{id}/revalidate` endpoint but absent from File 7/10's
     original method list.
  3. **`DELETE /wise/recipients/{id}`** (deactivate) was in the OpenAPI spec but missing
     from the order's own File 8/10 endpoint prose — implemented anyway since the frozen
     contract requires it.
  4. **Schema/contract conflict, unresolved, flagged for Davin/Advisor:** the OpenAPI's
     `POST /wise/recipients` description says "replacing an existing recipient archives the
     previous row rather than mutating it" — not implemented.
     `AffiliateWiseRecipient.affiliateProfileId` is `@unique` in the schema frozen at
     4A-W2 (out of scope to change this session), so `createRecipient` upserts in place. A
     future session needs to either accept upsert semantics as the real behavior (and fix
     the OpenAPI text) or add a schema change to support archive-and-recreate.
  5. **`GET requirements` uses the discouraged non-quote-scoped Wise endpoint**
     (`GET /v1/account-requirements?source=USD&target=...`), not the quote-scoped path the
     OpenAPI's own description implies ("proxies Wise's quote-scoped account-requirements
     endpoint"). Creating a throwaway Wise quote (`POST /v3/profiles/{id}/quotes`) is not
     in this order's 10-file breakdown — building it would have been undeclared scope
     expansion. `WISE_SOURCE_CURRENCY` is hardcoded to `'USD'` in the controller (the
     platform's own fixed source-currency decision, not a bank field — Hard Invariant #1
     unaffected).
  6. **Live bug found and fixed** (commit `f100296a`): the discouraged fallback endpoint
     404/422s without a `sourceAmount`/`targetAmount` param
     (`validation.failure.only.source.or.target.amount`) — the reference doc's own example
     for this exact path already showed `sourceAmount=1000`; missed in the first pass.
     Fixed, redeployed, re-verified live: `GET /v1/wise/recipients/requirements?targetCurrency=GBP`
     now returns a real `200` with 3 requirement groups from Wise sandbox.
  7. **`WISE_API_TOKEN`'s actual scope, confirmed live:** read operations
     (`GET /v1/profiles`, `GET /v1/account-requirements`) succeed; `POST /v1/accounts`
     (recipient creation) returns `403 {"error":"unauthorized"}` — confirmed via a direct
     call to Wise sandbox, isolated from money-service's own code, so this is a genuine
     token-scope limitation, not a bug. The order's entry criteria said "read-only is
     sufficient for this session" — true for reads, **not** true for recipient creation.
     Davin's call (live, this session): accept this as a confirmed external blocker: the
     full "real sandbox recipient created end-to-end, `status=ACTIVE`, valid
     `wiseRecipientId`" proof (File 10/10's own Done-when item) is **not achieved this
     session** — carried forward as a Waiting-on item, needs a write-scoped (still sandbox)
     `WISE_API_TOKEN`.
  8. **Deploy mechanism found broken for this service via `railway up` CLI**, unrelated to
     any Wise code: without `--path-as-root`, uploads 438MB (can't resolve `.gitignore`
     from within the `money-service/` subdirectory — no local `.gitignore` existed there,
     added one this session, made no difference) and Cloudflare 413s it; with
     `--path-as-root`, uploads cleanly (220KB) but nixpacks then fails
     ("Failed to read app source directory") — consistent with the Railway service's
     dashboard-configured Root Directory expecting an unflattened archive.
     **Working path found: `git push origin main`** — `money-service` has a connected
     GitHub source and auto-deploys cleanly from a push (confirmed twice this session,
     both auto-deploys succeeded with all new routes registered). `railway up` itself was
     not fixed and should not be trusted for this service until the Root Directory setting
     is checked on the Railway dashboard — worth a `LESSONS-LEARNED.md` entry (see that
     file).
- Evidence: full detail (commands, HTTP responses, log excerpts) in
  `4a-w3a-wise-recipient-backend.migration-order.md`'s own Deviations section; commits
  `10faa233`..`f100296a`.
- Approved by: Davin (live, mid-session: the write-scope-blocker acceptance and the
  `git push` deploy path were both explicit live decisions, not unilateral calls).

## Session 4A-W3b — Frontend build findings (not flags, technical discoveries)

- Status: RESOLVED (session close-out record)
- Session: 4A-W3b · Date: 2026-07-26
- CONFIRM found the order file itself modified-but-uncommitted again (header
  `PRE-DRAFT → APPROVED`, no Advisor-DRAFT/Davin-approval commit trail) — the same
  `LESSONS-LEARNED.md` L11 pattern, 8th+ recurrence. Also found two open design questions the
  PRE-DRAFT had explicitly left for CONFIRM (File 1: flag vs flag-less; File 3: revalidate vs
  view-only) silently resolved in the rewrite with no visible decision recorded. Stopped and
  asked Davin directly rather than trusting or silently correcting: confirmed the status flip
  was his own edit; flag-less confirmed; revalidate-only (later superseded, see finding below)
  confirmed. All 5 entry criteria (4A-W3a live 401 check, F39/F41 resolved,
  `routes.ts`/`client.ts`/`admin/disbursement/page.tsx` line counts, `tsc --noEmit`) verified
  live and PASSED — a first for this series, no drift found this time.
- Findings, each verified live against the actual money-service source, not assumed:
  1. **Real auth-semantics mismatch found while building File 1's last route.** The order's
     File 1 said to guard `POST /api/wise/recipients/[id]/revalidate` with `requireAdmin()`,
     and File 3 put a "Revalidate" button on the ADMIN page. Reading the live
     `wise-recipients.controller.ts` (frozen at 4A-W3a) showed `POST
/wise/recipients/:id/revalidate` is `AffiliateGuard`-scoped self-service only —
     `revalidateRecipient` derives the recipient from the CALLER's own token
     (`getAffiliateProfile(request.user.id)`), and `:id` is used only for an ownership check,
     never to select which recipient to act on. An admin-guarded proxy would either 403 (an
     admin isn't necessarily an affiliate) or silently revalidate the ADMIN's OWN recipient
     instead of the target affiliate's. This is a real bug class, not a style choice — escalated
     per `EXECUTOR-PROTOCOL.md` §5 (auth semantics beyond the order's explicit steps) rather
     than building it as specified. Davin's live call: move Revalidate to the affiliate's own
     `/affiliate/settings/payout` page (`requireAffiliate()`-guarded, matching the backend); the
     admin page stays strictly view-only.
  2. **Order's own file-path prose was stale against the live tree.** File 2's TARGET said
     `app/(dashboard)/affiliate/settings/payout/page.tsx` — the live `(dashboard)` route group
     has no `affiliate/` subtree at all (affiliate pages live at `app/affiliate/*`, their own
     separate layout). Built at `app/affiliate/settings/payout/page.tsx` instead, matching F39's
     actual recorded URL (`/affiliate/settings/payout`, this log, Session 4A-W3a) with its own
     thin layout mirroring `app/affiliate/dashboard/layout.tsx`'s auth check.
  3. **File 1's own route-handler list omitted `POST /wise/recipients/requirements/refresh`**
     even though the Contract section documents it and File 2's `refreshRequirementsOnChange`
     interaction needs it to function — added the wrapper + route as a deviation, not scope
     creep (the endpoint was already frozen and documented, just missing from one bullet list).
  4. **`refreshRequirementsOnChange` still can't be proven live** — `GET requirements` still
     returns `quoteId: null` (4A-W3a's known gap, quote-scoping not yet built). The form wires
     up the interaction but skips the network call when `quoteId` is null (it's guaranteed to
     400 against the live Zod schema otherwise), tested against a mocked `quoteId` instead.
  5. **Admin list endpoint returns raw Prisma rows, not `toSummaryDto()`-mapped** — confirmed
     via `wise-recipients.controller.ts`'s `list()` method. No raw bank details are exposed
     (F41's `accountTail`/`detailsFingerprint`-only persistence makes this structurally safe
     regardless), but the admin page renders `accountHolderName` (present on the raw row) rather
     than an affiliate display name — the contract has no affiliate-name field at all, admin- or
     summary-side.
- Evidence: live code reads (`wise-recipients.controller.ts`, `wise-recipient.service.ts`,
  `wise.types.ts`), `git diff`/`git log` on the order file and `CLAUDE.md`, a value-blind
  `curl` returning `401` against `money-service-production.up.railway.app/v1/wise/recipients`,
  `wc -l` against the three cited files, `tsc --noEmit` clean, full `test:ci` 119/119 suites
  (2105/2105 tests, +2 suites/+23 tests over the 4A-W3a baseline).
- Approved by: Davin (live: status-flip confirmation, flag-less, and the revalidate
  guard-mismatch resolution were all explicit live decisions).

## F40 — Wise webhook subscription level (profile vs application)

- Status: RESOLVED
- Session: 4A-W5 (decided by Davin ahead of CONFIRM, in the order rewrite) · Date: 2026-07-26
- Decision: **Profile-level** (`WISE_WEBHOOK_SCOPE = 'PROFILE'`), following from F36 (Model A —
  Business + personal API token, not a Platform partnership). Application-level subscriptions
  require a Platform/client-credentials setup this integration doesn't use.
- Evidence: consistent with F36's resolution (4A-W1) and `02-wise-platform-api-integration-reference.md`
  §6's subscription table (`POST /v1/profiles/{profileId}/subscriptions`, user/personal token —
  the application-level path needs a `ClientCredentialsToken`, not available on a personal
  token). No production subscription is created this session (Safety Gate, 4A-W7 cuts over) —
  this resolves the scope value the eventual subscription call will use.
- Approved by: Davin (live, ahead of CONFIRM).

## Session 4A-W5 — Webhook receiver + state reducer, findings

- Status: RESOLVED (session close-out record)
- Session: 4A-W5 · Date: 2026-07-26
- CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again (order file
  modified-but-uncommitted, `PRE-DRAFT → APPROVED` with no Advisor-DRAFT/Davin-approval commit
  trail) — but this time paired with a full content rewrite (5→8 files, "Ordered steps" replaced
  by "Ordered File Breakdown") and, separately, a real dropped safety gate: the committed
  PRE-DRAFT's sandbox-funding entry criterion ("if unavailable, stop and re-plan," lifted
  verbatim from `04-rise-to-wise-migration-plan.md`'s own W5 entry criteria) was absent from the
  rewrite. Re-raised it at CONFIRM because Wise's Simulation API requires a **funded** transfer
  before state simulation, and Waiting-on #47 (still OPEN) already shows the sandbox
  `WISE_API_TOKEN` is read-only (`POST /v1/accounts` 403s) — likely blocking transfer
  creation/funding too. Asked Davin directly rather than trusting the rewrite: confirmed his own
  edit, confirmed funding availability is genuinely unknown, and chose **Option 2** — downgrade
  verification from "real payloads captured from Wise's Simulation API" to "hand-constructed
  RSA-signed sandbox test payloads" (same keypair-substitution technique
  `wise-signature.verifier.spec.ts` already uses). F40 resolved in the same rewrite (see above).
- Built all 8 files (dependency order, committed per file): `wise-state.mapper.ts` (File 1),
  `wise-transfer-state.reducer.ts` (File 2), `wise-event-handlers.ts` (File 5, built ahead of
  File 3 since the processor depends on it), `wise-webhook.processor.ts` (File 3, money-service's
  first BullMQ `@Processor`), `wise-webhook.controller.ts` (File 4), `wise.module.ts` wiring
  (File 6), `wise-state.reducer.spec.ts` (File 7), `wise-webhook.replay.spec.ts` (File 8) — plus
  two test files beyond the order's own 8-file count (`wise-webhook.processor.spec.ts`,
  `wise-event-handlers.spec.ts`) to actually fulfill Files 3/8 and 5/8's own per-file
  "Verification" promises, which the order's file count never allocated a home for.
- **Four real order-text-vs-ground-truth mismatches found and corrected while building** (full
  detail in the order's own Deviations):
  1. Hard Invariant #3 / Rules / Known-wrinkles all said `@SkipThrottle()`. Design §7.5 was
     corrected 2026-07-25 (rev 2) — after this order's Hard Invariants were drafted — to say the
     opposite: explicit `@Throttle({ default: { ttl: 60_000, limit: 300 } })`, matching
     `LESSONS-LEARNED.md` L26 (established one session earlier, 4A-W4). Built with the corrected
     throttle.
  2. File 1/8's own state-mapping prose diverged from design §5.2 (the table itself a frozen
     invariant): `bounced_back` isn't a distinct terminal state (stays `PROCESSING` +
     `hasActiveIssues`, Commission left `PAID`, admin alert); `cancelled` must revert if it was
     already `PAID` (order said pure no-op); `charged_back` was missing entirely; so was
     `incoming_payment_initiated`. Built against the real table.
  3. File 2/8's text (and File 7/8's own test-case description) said the reversal path sets
     `Commission.status = 'FAILED'`. `CommissionStatus` has no `FAILED` member — schema-verified
     (`PENDING`/`APPROVED`/`PAID`/`CANCELLED` only). Design §5.2's own table says `revert PAID →
APPROVED`; built against that.
  4. File 5/8's text said `handleBalanceUpdate` updates `WiseBatchGroup.fundingDetected` — no
     such field exists; the real field is `fundingSource` (enum `WiseFundingSource`). Built
     against the real field, and scoped the handler to setting it only, never transitioning
     `status` to `FUNDED` (that's 4A-W6's batch/funding-gate scope, not built yet).
     Also: File 8/8's own text and the Done-when list said the `X-Test-Notification` ping should
     process "without DB write" — design §5.5 explicitly says the opposite ("persist, mark
     processed, 200, do nothing else"). Built and tested against the ground truth (persists).
- Not fully closed: the replay suite proves the signature/dedupe/reduction pipeline against
  hand-constructed fixtures, not Wise's real Sandbox Simulation API — closing that gap needs a
  write-scoped sandbox `WISE_API_TOKEN` (same ask as Waiting-on #47).
- Evidence: `money-service` test suite 33/33 suites, 326/326 tests (was 29/29, 288/288 at
  4A-W4's close — +4 suites, +38 tests). `npm run build` clean. Monolith `npx tsc --noEmit`
  clean (unaffected — no monolith code changed this session). Schema fields verified directly
  against `money-service/prisma/schema.prisma` (`DisbursementTransactionStatus`,
  `CommissionStatus`, `WiseFundingSource` enums; `WiseTransfer`/`DisbursementTransaction`
  field names) before writing the reducer/handlers, not assumed from the order's prose.
- Approved by: Davin (live: the rewrite's provenance, the Option 2 verification downgrade, and
  F40's resolution were all explicit live confirmations before CONFIRM completed).

## F14 — Tier-update: outbox vs direct call

- Status: RESOLVED — Session 4A-8 · Date: 2026-07-27
- **Resolution:** Transactional Outbox pattern. `OutboxEvent` (new model, `id`/`aggregateType`/
  `aggregateId`/`eventType`/`payload`/`status`/`attemptCount`/`lastError`/`createdAt`/
  `processedAt`, `OutboxEventStatus` enum) written in the SAME Prisma transaction as the
  domain-state change itself (`OutboxService.recordInTransaction(tx, ...)`), so the two can
  never diverge. Wired into both existing tier-write call sites:
  `dlocal-webhook.controller.ts`'s `handlePaymentCompleted` (already transactional; guarded by
  the existing `alreadyCompleted` flag so a webhook replay doesn't double-emit) and
  `crons/subscription.service.ts`'s `downgradeExpiredSubscriptions` (was NOT previously
  transactional — 3 separate calls; now wrapped in `$transaction`, a deliberate, in-scope
  behavior change recorded in the order's own Deviations).
- **CONFIRM-time ground-truth gap, corrected before execution:** the order's own file list
  named only `money-service/prisma/schema.prisma` for this model. `OutboxEvent` is a genuinely
  new money-service-owned table (no FK to anything) — per L1 (money-service has no migration
  authority of its own), it needed the SAME two-schema treatment 4A-W2 used for the Wise models:
  mirrored into `prisma/non-market-data/schema.prisma`, migrated via a zero-DB-connection
  `prisma migrate diff --script`, applied to production via `prisma migrate deploy` (Davin
  present, approved live per `EXECUTOR-PROTOCOL.md` §7). `money_svc` grants checked immediately
  after — zero grants existed (same predicted-and-confirmed gap class as 4A-W2's Step 6) —
  granted `SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE`, verified via a real
  INSERT/SELECT/UPDATE/DELETE cycle as `money_svc` (rolled back, zero residue).
- **Publisher built, deliberately NOT live:** `OutboxPublisherCron` polls `PENDING` rows every
  5s, delivers via HTTP with backoff (1s/2s/4s) within a single attempt, dead-letters
  (`status = FAILED`) after 5 attempts across ticks, atomic claim (`updateMany WHERE
status=PENDING`) guards against double-processing across replicas. **Gated OFF by default**
  (`OUTBOX_PUBLISHER_ENABLED` must be `'true'`): the order's own text said "publish to
  `operation-service`," but operation-service has no tier/billing module or endpoint at all
  (auth/email/security/2FA only), and `04-rise-to-wise-migration-plan.md`'s own roadmap assigns
  the real consumer side ("Slice 5, tier-update event path") to a later, separate session pair
  (**4A-11/12**) — not 4A-8. Escalated to Davin rather than scope-creep into building that
  endpoint or ship a cron that fails every tick forever; his call was to build the mechanism now
  (unit-tested against a mocked target) and leave it off until 4A-11/12 defines
  `OUTBOX_PUBLISHER_TARGET_URL`'s real receiving endpoint.
- Evidence: `money-service` 49/49 suites, 400/400 tests (was 45/372 at session start).
  `nest build` clean. Monolith `tsc --noEmit` clean (both Prisma clients regenerated). Production
  migration applied and grant-verified live, see above.
- Approved by: Davin (live: DRAFT→APPROVED status edit confirmed authentic; Step 1 re-scoping
  onto the real monolith files; the production migration + grants; the Step 3 gated-OFF design).

## Session 4A-9 — Slice 4 write-API PORT: findings (not flags, technical discoveries + one architecture decision)

- **Status edit provenance (LESSONS-LEARNED L11, 9th+ recurrence):** the order arrived with an
  uncommitted `PRE-DRAFT → APPROVED` status edit and a full content rewrite (rough 8-item
  Executor list → polished 10-file Advisor order), no Advisor-DRAFT/Davin-approval commit trail.
  Confirmed live by Davin as his own authentic Chat UI edit before CONFIRM proceeded.
- **CONFIRM found and the Advisor/Davin corrected before execution:** a stale 4A-8 test-count
  citation (372/372 → 49/49 suites, 400/400 tests), monolith test-path citations that didn't
  exist (`__tests__/stripe|payments|admin|disbursement` → the real `__tests__/lib/*` and
  `__tests__/api/disbursement/*` locations), a genuine route-level test-coverage gap (no test
  existed for the checkout/cancel/webhook routes — only their underlying `lib/` services), a
  fabricated `RolesGuard`/`@Roles('ADMIN')` mechanism (→ the real `AdminGuard`), an overstated
  File 5/10 rewrite scope, `lib/admin/code-distribution.ts`'s stale line count (112 → 193 —
  outlier, not the systemic ±1 pattern seen on every other file), and a missing Step 0 (stripe
  npm dependency). The Advisor's own correction pass then introduced one NEW wrong citation
  (`AdminGuard` at `auth/guards/admin.guard.ts`, which doesn't exist) — found and corrected during
  this same CONFIRM pass to the real path (`admin/admin.guard.ts`).
- **Architecture decision (Davin, live, this session):** File 4/10's SOURCE list omitted
  `lib/stripe/webhook-handlers.ts` entirely — the file holding ALL real tier/subscription/
  commission business logic, including 5 customer-facing email sends the monolith's Stripe
  webhook currently makes directly. money-service has no email-sending capability. Davin approved
  the Executor's recommendation: reuse `ConversionProcessorService` (built 4A-4, already used by
  the live dLocal webhook) for commission crediting rather than reimplement it, and follow the
  established dLocal (Slice 2, 4A-5) precedent for the email question — write domain state
  synchronously, emit `OutboxEvent`s (`TIER_UPGRADED`/`SUBSCRIPTION_CANCELLED`/`PAYMENT_FAILED`/
  `PAYMENT_SUCCEEDED`/`COMMISSION_CREDITED`) for `operation-service` to eventually consume (Slice
  5 / 4A-11-12), rather than building a new direct-email capability into money-service. This is
  consistent with, not a departure from, dLocal's already-live production behavior — Stripe-
  originated tier-upgrade/cancellation emails will go silent the same way dLocal's already are
  once 4A-10 cuts this over, pending Slice 5's outbox consumer. Zero behavior change THIS
  session (zero traffic cut over).
- **Two more direct-dependency omissions found the same way** (File 6/10):
  `lib/dlocal/currency-converter.service.ts` and `lib/dlocal/payment-methods.service.ts`, both
  imported directly by `app/api/payments/dlocal/create/route.ts` and cited nowhere in the order.
  Ported verbatim alongside their existing monolith test suites. See `LESSONS-LEARNED.md` L27's
  new recurrence.
- **Schema-subset gap found and fixed additively:** money-service's `User` model was missing
  `trialStatus`/`trialConvertedAt`/`trialCancelledAt`/`hasUsedFreeTrial` (+ the `TrialStatus`
  enum) — all four already exist in the monolith's real schema and the shared Postgres table,
  needed by Files 3/10 and 4/10. `prisma generate` only, zero migration, zero production DB
  touch (L1/L32) — same class of subset-completeness gap as prior sessions, not a new column.
- **Dependency-version gap found and fixed:** Step 0's `npm install stripe` (unpinned) grabbed
  v22.3.2 instead of matching the monolith's pinned `^14.10.0` — an 8-major-version SDK jump that
  changed real TypeScript shapes (`Subscription.current_period_end`), caught by a genuine
  compile error while building File 4/10. Reinstalled at `^14.10.0`. New `LESSONS-LEARNED.md`
  **L30**.
- Evidence: `money-service` 59/59 suites, 506/506 tests (was 49/49, 400/400 at 4A-8's close).
  `nest build` clean. Monolith untouched (`git status` clean on `lib/`/`app/`/`types/`/
  `__tests__/`), `tsc --noEmit` clean. Zero flags flipped, zero URLs/dashboards changed — this
  session is BUILD only, confirmed by the order's own Slice-level verification checklist, all
  four items now checked.
- Approved by: Davin (live: the DRAFT→APPROVED status-edit provenance; the webhook-handlers.ts
  re-scope and its OutboxEvent-vs-email architecture call; the Ground-Truth Re-alignment content,
  including the corrected `AdminGuard` path found during this same CONFIRM pass).

## Session 4A-9 (close-out addendum) — 4A-10 PRE-DRAFT review: no shadow-run mechanism, no cutover transport

- **Context:** same day as 4A-9's own close, reviewing the 4A-10 PRE-DRAFT
  (`4a-10-money-service-write-apis-cutover.migration-order.md`, Advisor-generated) before it goes
  to Davin for approval.
- **Finding 1 (architecture decision, Davin live):** the PRE-DRAFT's Entry Criterion 1 claimed a
  "48h mirror-run window" — verified live that no shadow-traffic mechanism exists for Slice 4 at
  all (zero references to `money-service`/any `MIGRATE_WRITE_APIS_MONEY_*` flag anywhere in
  `lib/`/`app/`/`money-service/src/`; 4A-9 was BUILD-only, zero traffic). A literal "mirror-run"
  claim would report 48h of silence as a clean diff — nothing would ever be observed, since
  nothing reaches the new controllers. Davin's live call: reframe as a **code-freeze SOAK
  window** (calendar/CC-F-freeze buffer only, no diff claim), matching Slice 3's own F44
  precedent (no real shadow-run infra exists in this repo, F34/CC-A gap). Order text corrected
  accordingly (Entry Criterion 1, Checklist Step 1).
- **Finding 2 (CRITICAL, hard-blocking, found independently while finalizing the same order):**
  Checklist Step 3 ("Flip Feature Flags") would currently be a silent no-op. None of the 5
  monolith write routes have any `MIGRATE_WRITE_APIS_MONEY_*` flag check or forwarding call to
  money-service — `lib/money-service/routes.ts`/`flags.ts` (built 4A-7a) only cover Slice 3's
  read APIs and some Wise-track wrappers. Flipping any of the 4 flags in Railway right now would
  change nothing; the monolith routes would keep executing their existing Prisma logic
  unconditionally. Same failure shape as 4A-W6/W7's own Waiting-on #54
  (`DISBURSEMENT_PROVIDER=WISE` not actually constructible before that gap was closed). Recorded
  as 4A-10's own new Entry Criterion 0, hard-blocking — a new BUILD session (monolith-side
  transport + flag-check layer for the 5 write routes, mirroring 4A-7a's own Slice-3 scope) must
  ship and be CONFIRMED before 4A-10 can execute.
- Evidence: `grep -ln "money-service\|MONEY_SERVICE_URL\|MIGRATE_WRITE_APIS_MONEY"` across all 5
  monolith write routes plus `app/api/webhooks/stripe/route.ts` → zero matches. `grep -rl
"MIGRATE_WRITE_APIS_MONEY" lib/ app/ money-service/src/` → zero matches anywhere.
- Approved by: Davin (live, Finding 1's reframe, via `AskUserQuestion` — "Reframe as code-freeze
  soak" selected over keeping the literal wording or building a real shadow-traffic mechanism
  first). Finding 2 is a factual/structural gap, not a decision — recorded as a hard-blocking
  entry criterion for Davin and the Advisor to plan the missing BUILD session against.

## F48 — dLocal outbound payment-creation request signing is wrong (pre-existing, both monolith and money-service)

- Status: **RESOLVED (signing/auth only) — 4A-10c, 2026-07-30.** See the 4A-10c entry below: a
  second, independent bug (F49, `payment_method_flow`) was masked behind this one and is now
  blocking Group B's cutover on its own — F48 itself is closed.
- Session: 4A-10b (continuation) · Date: 2026-07-30
- Found while: retrying Group B (dLocal) after Davin's Phase 1/2 config remediation (new
  `STRIPE_PRO_PRICE_ID`, refreshed dLocal sandbox credentials). The retry reproduced the IDENTICAL
  `403 Invalid credentials` (dLocal code 3001) as the prior 4A-10b attempt (2026-07-28), even
  though this time the credentials were independently confirmed present and Davin stated the
  Railway values were correct. Davin/Antigravity (Advisor) identified the real root cause as a
  code bug, not a config bug — confirmed live by the Executor by reading the actual header
  construction in `money-service/src/dlocal/dlocal-payment.service.ts:143-151`.
- **The bug (three separate mistakes in the same fetch call):**
  1. `'X-Login': DLOCAL_API_KEY` — dLocal's `X-Login` header must carry the merchant's **login ID**
     (`DLOCAL_LOGIN`), not the API/transaction key.
  2. `'X-Trans-Key': signature` — dLocal's `X-Trans-Key` header must carry the **API key itself**
     (`DLOCAL_API_KEY`), not a computed HMAC signature.
  3. `Authorization: \`Bearer ${DLOCAL_API_KEY}\``— dLocal does not use Bearer auth for this
endpoint; its real scheme is`Authorization: V2-HMAC-SHA256, Signature: <hex>`, where the hex
digest is an HMAC-SHA256 over `X-Login + X-Date + body` using the secret key — the exact
scheme Session 4A-5 already fixed on the INBOUND webhook-verification path
(`8e681297`), never applied to this OUTBOUND payment-creation path. `DLOCAL_LOGIN` is not even
     imported into this file.
- **Scope: pre-existing in the monolith, not introduced by the migration.** Verified directly:
  `lib/dlocal/dlocal-payment.service.ts` (monolith original) has the byte-identical bug at the
  same three points (lines 110-113 and again at 204-206 for a second call site). Session 4A-9's
  PORT correctly preserved this behavior verbatim per its own low-creativity mandate — this is not
  a porting error. It means dLocal outbound payment creation has likely never worked correctly in
  production, on either side of this migration, independent of the cutover. If any customers
  currently pay via dLocal, this is a live, real-money-adjacent correctness gap today, not a
  migration artifact — worth Davin's attention regardless of migration sequencing.
- **Not fixed this session:** `4a-10-...migration-order.md` (4A-10b) is a VERIFY-RETIRE order with
  an explicit "no code edits, no refactoring, no fixes" rule. `MIGRATE_WRITE_APIS_MONEY_DLOCAL`
  stays reverted `false`; Group B stays on the monolith (which has the same bug, so reverting
  doesn't restore working dLocal payments — it only avoids the migration being blamed for a
  pre-existing gap).
- **What a correct fix needs:** correct all three header/auth fields in
  `money-service/src/dlocal/dlocal-payment.service.ts` (both call sites) — a dedicated PORT-shaped
  fix session, since the monolith source has the identical bug and should likely be fixed too (or
  retired once dLocal is cut over, per Davin/Advisor's call on sequencing). Verify against dLocal's
  real sandbox API with a live call before considering it fixed, not just a code read — this class
  of bug (looks structurally plausible, silently wrong) is exactly what unit tests with mocked
  `fetch` would miss (see `LESSONS-LEARNED.md` L2).
- Owner: Davin/Advisor — due before the next Group B (dLocal) cutover attempt.
- **Fixed and verified live — Session 4A-10c, 2026-07-30.** Corrected all three fields in both
  `money-service/src/dlocal/dlocal-payment.service.ts` and the monolith's identical
  `lib/dlocal/dlocal-payment.service.ts`: `X-Login` → `DLOCAL_LOGIN` (new env var, falls back to
  `DLOCAL_API_KEY` if unset), `X-Trans-Key` → `DLOCAL_API_KEY`, `Authorization` →
  `V2-HMAC-SHA256, Signature: <hex>` (HMAC-SHA256 over `X-Login+X-Date+body`, matching the
  already-working webhook-verification path). Removed the now-dead `generateSignature` helper.
  **CONFIRM caught a second mistake in the originally-reported fix before deploying it:** the
  Authorization header as first written was `V2-HMAC-SHA256 SecretKey:${secret}, Signature:${sig}`
  — still wrong, and worse than the original bug, since it transmitted the raw secret key value in
  a header sent externally to dLocal. Corrected by comparing directly against
  `verifyWebhookSignature`'s own documented format before deploying either file. See
  `LESSONS-LEARNED.md` L33's recurrence, this session.
  **Verified live, not just by code read (per this entry's own "what a correct fix needs"):**
  flipped `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`, Davin ran a real authenticated request against
  production. Result was `{"error":"Failed to create payment"}` — but money-service's own logs
  prove the fix worked: `dLocal API error {"status":400,...}`, not the previous `403 Invalid
credentials`. A `400` is dLocal's own payload-validation layer responding, which only runs AFTER
  authentication succeeds — this is direct, positive proof the signing/auth bug is fixed. The `400`
  itself is a NEW, separate, previously-masked bug — see **F49** below. Flag reverted to `false`
  and redeployed clean immediately after (per the standing "any red result = abort, revert" rule)
  since Group B still isn't cutover-ready, just for a different reason than before.

## F49 — dLocal outbound payment-creation request body is missing the required `payment_method_flow` field (pre-existing, both monolith and money-service; was masked by F48)

- Status: OPEN
- Session: 4A-10c · Date: 2026-07-30
- Found while: verifying F48's fix live. Once the corrected signing/auth headers let the request
  reach dLocal's real API for the first time ever (previously it 403'd before dLocal's payload
  validation ever ran), dLocal responded `400 {"code":5001,"message":"Missing parameter:
payment_method_flow","param":"payment_method_flow"}`.
- **Root cause:** `createPayment`'s outbound request body (`money-service/src/dlocal/dlocal-payment
.service.ts` and the monolith's identical `lib/dlocal/dlocal-payment.service.ts`) never includes a
  `payment_method_flow` field — dLocal's Payins API requires it (typically `"REDIRECT"` for
  wallet/bank-redirect methods like `TrueMoney`/`UPI`/`GoPay`, `"DIRECT"` for card-capture flows).
  Grepped the whole `lib/dlocal/` and `money-service/src/dlocal/` trees: no code anywhere computes
  or references a flow value — this was never implemented, on either side, at any point in this
  migration or before it.
- **Scope: pre-existing in the monolith, not introduced by the migration** — same shape as F48.
  This means dLocal outbound payment creation has NEVER worked in production, independent of F48
  and independent of cutover sequencing; F48 was simply the FIRST bug a request would hit, so this
  second bug was never observed until F48 stopped blocking progress.
- **Side effect:** creates a real orphaned `Payment` row per attempt (`status: PENDING`, since the
  row is written before the dLocal call). This session's live test created a 4th such row
  (`cms7hlmb900000fmpz9i9fv1q`) — independently confirmed via a direct production DB query
  (0 other `PENDING` rows). Not deleted by the Executor (will not permanently delete production
  data even with authorization) — flagged for Davin, same as the prior three.
- **Not fixed this session:** discovering the right `payment_method_flow` value per payment-method
  type (and confirming it against dLocal's real API docs/sandbox behavior, not guessed) is real
  scope beyond a live-verification step — needs its own dedicated fix session, same shape as F48's
  own. `MIGRATE_WRITE_APIS_MONEY_DLOCAL` stays `false`; Group B stays on the monolith (which has
  the identical gap, so this isn't a migration-introduced regression).
- **What a correct fix needs:** map each supported payment method (see
  `lib/dlocal/payment-methods.service.ts`'s `getPaymentMethodType` — wallet/bank/qr/card buckets
  already exist) to dLocal's real `payment_method_flow` value, add it to the request body in both
  files, and verify against dLocal's real sandbox API with a live call for at least one method per
  bucket before considering it fixed — this is exactly the class of bug unit tests with mocked
  `fetch` cannot catch (L2), and exactly the class an auth fix can accidentally unmask (new lesson,
  this session).
- Owner: Davin/Advisor — due before the next Group B (dLocal) cutover attempt.

## F50 — `COMMISSION_CREDITED` outbox event's `aggregateId` resolves to the wrong recipient

- Status: OPEN
- Session: 4A-11 · Date: 2026-07-30
- Found while: building `operation-service`'s outbox consumer (File 3/5) — the order's own prose
  said to resolve every eventType's recipient via `prisma.user.findUnique({ where: { id:
aggregateId } })`, treated as a universal step. Reading `stripe-webhook.service.ts`'s actual
  `emitOutboxEvent(userId, 'COMMISSION_CREDITED', {...})` call site (the same `userId` the checkout
  session's PAYING SUBSCRIBER metadata carries, not the affiliate) showed this is wrong specifically
  for this eventType — the subscriber and the commission-earning affiliate are two different users.
- **Root cause:** the `COMMISSION_CREDITED` payload (`{ commissionId, commissionAmount, provider }`)
  never carries the affiliate's own identity — only a `commissionId` an operation-service consumer
  could theoretically resolve via a `Commission` -> `AffiliateProfile` -> `User` join, except
  operation-service's Prisma schema subset (`operation-service/prisma/schema.prisma`) has no
  `Commission`/`AffiliateProfile` model at all (by design, per that file's own header — a narrow
  subset, not the full schema) and per L1 must not gain migration authority of its own.
- **Not fixed this session:** `OutboxConsumerService.processEvent` special-cases
  `COMMISSION_CREDITED` to skip immediately (log + `{ status: 'skipped', reason:
'commission-recipient-unresolvable' }`, never looks up `aggregateId` as a `User` for this
  eventType) rather than emailing the wrong person. Zero production impact today —
  `OUTBOX_PUBLISHER_ENABLED` stays off until 4A-12.
- **What a correct fix needs (not decided here):** most likely money-service pre-resolving the
  affiliate's email/name/code/running-total-earnings into the `COMMISSION_CREDITED` payload itself
  at emission time (`stripe-webhook.service.ts`'s `emitOutboxEvent` call site already has full
  schema access to `Commission`/`AffiliateProfile`/`User`) — cheaper than extending
  operation-service's schema subset for a single read path. Needs Davin/Advisor sign-off before
  4A-12 can treat this eventType as done.
- Owner: Davin/Advisor — due before 4A-12 (or its own dedicated follow-up) closes Slice 5 for
  `COMMISSION_CREDITED` specifically; the other 5 eventTypes are unaffected.

## F51 — Slice 5 cutover wait-clock: no shadow-run mechanism exists, F44 precedent applied

- Status: RESOLVED
- Session: 4A-11 (post-close, same day) · Date: 2026-07-30
- Decision: **No formal wait-clock for the 4A-11 -> 4A-12 transition.** Same resolution as F44
  (Slice 3): `OUTBOX_PUBLISHER_ENABLED` is a single on/off gate with no mirrored delivery path to
  diff against before flipping it — there is nothing to shadow-run. This session's own fresh test
  coverage (30 new tests across 4 new suites, one case per `eventType` plus the
  unknown-eventType/user-not-found/send-failure/`COMMISSION_CREDITED`-skip edge cases) stands in
  for a shadow-run's own diff-review step, the same substitution F44 made for Slice 3's manual
  parity verification. 4A-12 proceeds as soon as ITS OWN real entry criteria are met (`SVC_TOKEN`
  set to a real, matching value on both services; Davin live for the flip) — no additional
  soak/freeze window required. Offered against the explicit alternative (a 48h code-freeze soak
  window, Slice 4's own precedent) and declined in favor of this one.
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

## F52 — `market_data_v6` was never actually created in production; its own migration was baselined with zero applied steps

- Status: RESOLVED (ad-hoc repair session, 2026-08-02, same day — plan reviewed and approved by
  Davin before execution; DDL shown verbatim and confirmed before running)
- Session: 4B-12 · Date: 2026-08-02
- Found while: running this session's own live smoke test (Davin, browser DevTools console,
  `GET /api/market-data/channel?timeframe=M5` against the freshly cut-over route). Got a real `500`
  whose body was `operation-service`'s own `AllExceptionsFilter` shape
  (`{statusCode, message, error, timestamp, path, correlationId}`) — proof the request genuinely
  reached the new `MarketDataController`, not evidence of a transport/auth bug. Pulled the real
  stack trace from `operation-service`'s Railway logs (never trusted the client-side message alone,
  L18-class discipline): `PrismaClientKnownRequestError: The table \`public.market_data_v6\` does
  not exist in the current database.`
- **Not caused by this session's code — independently proven.** The thrown error is a missing
  TABLE, not a missing column. This session's own schema change (18 new `Float?` columns) is
  additive on top of the pre-existing 5-field model — even the ORIGINAL, narrower `MarketDataV6`
  model (mirrored since Session 4B-2) would fail identically against a database with no
  `market_data_v6` table at all. The monolith's own un-cut-over SOURCE route
  (`app/api/market-data/channel/route.ts`, unchanged, `marketPrisma.marketDataV6.findMany(...)`)
  reads from the exact same production database (see next bullet) and would 500 identically for
  any real PRO-tier caller — this bug almost certainly predates this migration entirely and has
  simply never been exercised by real traffic that got far enough to hit it.
- **Confirmed this is genuinely the SAME shared production database on both sides, not a
  wrong-target-environment mixup (L19-class check, value-blind hostname comparison only — no
  credentials ever displayed):** `operation-service`'s Railway `DATABASE_URL` host
  (`postgres.railway.internal`) matches the `Postgres` service's own internal `DATABASE_URL`;
  its public-proxy equivalent (`DATABASE_PUBLIC_URL`, host `maglev.proxy.rlwy.net`) was queried
  directly and shows 34 real tables (`Alert`, `AffiliateProfile`, `Commission`,
  `DisbursementTransaction`, ... — the same tables every prior cutover slice has proven live) but
  **zero** tables matching `%market_data%`. The monolith's own Vercel production `DATABASE_URL`
  (pulled via `vercel env pull`, read only by a script, never displayed) resolves to host
  `maglev.proxy.rlwy.net` — the exact same instance.
- **Root cause identified precisely, not just "table missing":** the monolith's own migration
  `prisma/migrations/20260705000000_add_market_data_v6/migration.sql` (a real `CREATE TABLE
market_data_v6 (...)` statement) exists in the codebase and IS recorded in production's
  `_prisma_migrations` table as `finished_at: 2026-07-20T11:08:10.001Z` — but with
  `applied_steps_count: 0`. Every migration from `20251227000000_init` through
  `20260705010000_drop_market_data` shows the same `steps: 0` pattern, all `finished_at` within the
  same ~3-minute window (`2026-07-20T11:05-11:08Z`) — this is Session 2-3's own documented
  migration-history baseline (`CLAUDE.md`'s F20 resolution, "migration history baselined"), which
  told Prisma "these changes already exist, just record them as applied" for the WHOLE
  pre-2-3 history at once. That assumption held for every other table in the baseline (all still
  live and working today) but was wrong specifically for `market_data_v6` — its `CREATE TABLE` DDL
  was marked resolved without ever actually running. Compare `20260721000000_add_refresh_token_table`
  (`steps: 1`, a real post-baseline migration that genuinely executed) for the contrast.
- **Not fixed this session — reverted instead, per the standing "any red result = abort
  immediately, revert flag" rule:** `MIGRATE_MARKET_DATA_CHANNEL` removed from Vercel production
  (`vercel env rm`, then `vercel --prod --archive=tgz --yes` redeploy, `dpl_EgN82iVqFvDTB75oEfKxDsac5P7X`,
  READY) within minutes of the smoke test. Re-verified live: unauthenticated
  `GET /api/market-data/channel` -> `401` (route present, flag genuinely off), flag confirmed absent
  from `vercel env ls production`. Zero ongoing production exposure — the monolith is back to
  serving this route with its own (equally broken, but unchanged-in-behavior) SOURCE code, exactly
  as before this session started.
- **What a correct fix needs (not decided here — a real production schema action, needs Davin's
  live presence per every prior precedent in this migration):** re-apply just this one migration's
  DDL against production. Likely mechanism: `prisma migrate resolve --rolled-back
20260705000000_add_market_data_v6` (tells Prisma this migration's steps did NOT actually run) then
  `prisma migrate deploy` (genuinely executes the `CREATE TABLE`) — needs to be attempted carefully
  given `20260705010000_drop_market_data` immediately follows it in history and drops a DIFFERENT,
  older `MarketData` table (unrelated, already confirmed absent — not a re-run risk, but worth
  re-reading both migrations' SQL before touching anything). Separately unresolved: whether the
  "railway-gateway" ingestion pipeline that's supposed to WRITE to this table
  (`prisma/market-data/schema.prisma`'s own header: "Written by railway-gateway's queue consumer")
  has ever actually been pointed at this production database at all — creating the table alone
  doesn't mean real XAUUSD centroid-channel data will start flowing into it.
- Owner: Davin/Advisor — needs its own dedicated session (schema-repair, not a Phase 4B PORT
  session's scope) before `4b-12`'s cutover can be safely retried. Until then, the
  Market-Data-Channel feature is confirmed broken in production for ANY real caller, on both the
  monolith's original code and this session's port — not a regression, a newly-surfaced
  pre-existing gap.
- **Resolution (ad-hoc schema-repair session, same day):** Davin asked for a plan before any
  write — presented via `EnterPlanMode`/`ExitPlanMode`, including the exact DDL, before running
  anything; approved. Chose applying the migration's own SQL directly over
  `prisma migrate resolve --rolled-back` + `migrate deploy` (fewer moving parts against Prisma's
  own migration-state machine for a first-of-its-kind repair; the adjacent
  `20260705010000_drop_market_data` migration was re-read in full and confirmed to only
  `DROP TABLE IF EXISTS "MarketData"`, a completely different, unrelated, already-absent table —
  zero interaction risk).
  1. Re-verified immediately before writing anything: table still absent, `_prisma_migrations`
     row still `applied_steps_count: 0` — state unchanged since the finding above.
  2. Applied the migration's own `CREATE TABLE market_data_v6 (...)` + 2 `CREATE INDEX`
     statements verbatim, wrapped in a transaction with an in-transaction re-check (aborts with
     zero writes if the table already exists), via a raw `pg` client against
     `DATABASE_PUBLIC_URL` (same value-blind method as the finding above — connection string read
     into the script's own `process.env`, never displayed; `railway run --service Postgres`).
     Committed clean.
  3. Verified shape: `to_regclass` non-null; 82 real columns (matches the DDL exactly — 80 data
     columns + `createdAt`/`updatedAt`); all 3 indexes present (`market_data_v6_pkey`,
     `market_data_v6_symbol_timeframe_timestamp_key`, `market_data_v6_symbol_timeframe_timestamp_idx`);
     0 rows (expected — the `railway-gateway` ingestion-pipeline question from above is still
     separately unresolved, not addressed by this repair).
  4. Proved it end-to-end through Prisma itself, not just raw SQL: a real
     `prisma.marketDataV6.findMany()` call through `operation-service`'s own generated client
     (the exact code path `MarketDataService.getChannelData()` uses) succeeded, 0 rows, zero
     errors.
  5. Attempted to reconcile `_prisma_migrations.applied_steps_count` (3, matching the 3 real DDL
     statements) for future diagnostic accuracy — **blocked by the environment's own permission
     classifier** (an `UPDATE` against a different table than the one just shown/approved). Per
     this plan's own text this step was explicitly optional and doesn't affect
     `migrate deploy`/`status` behavior (both key off `finished_at` presence, not
     `applied_steps_count`) — skipped rather than worked around; `_prisma_migrations` still shows
     `applied_steps_count: 0` for this migration even though the table is now genuinely present
     and correct. Flagged for whoever next touches this row directly.
  6. Re-added `MIGRATE_MARKET_DATA_CHANNEL=true` to Vercel production, redeployed
     (`dpl_GBR5cuxxb32Bu354q7uq3SfNVn3H`, READY), re-verified unauthenticated
     `GET /api/market-data/channel` still `401`. Davin re-ran the identical live smoke test from
     his own browser DevTools console: real `200`,
     `{success: true, symbol: 'XAUUSD', timeframe: 'M5', variant: 'best_fit', points: []}` — no
     more `500`. Independently cross-checked against `operation-service`'s own Railway HTTP access
     log (not trusted from the response body alone, L18): `GET /market-data/channel 200 67ms`,
     timestamp-correlated to the smoke test (first attempt returned stale/cached output — the
     same `railway logs` trap this migration has hit before; `--http -n 30 --since 15m` was the
     combination that surfaced the real, current entry).
  7. `market_data_v6`'s own row count is 0 — this repair proves the table and the app's read path
     are both genuinely correct, but does NOT prove or address whether `railway-gateway`'s
     ingestion pipeline has ever been pointed at this database (still an open, separately-flagged
     question, unchanged by this session). The Market-Data-Channel feature is now live and
     correct, serving real (currently empty) chart data — not fabricated as "fully populated."

## Session 4A-10c (2026-07-30) — F48 fixed and verified live; Group B still blocked on a newly-uncovered second bug (F49)

- **Context:** Davin reported the F48 header/signing fix already applied (uncommitted) and the 3rd
  orphaned `Payment` row already deleted, and asked to proceed straight to flipping
  `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` for the 4th (final) Slice 4 group.
- **CONFIRM found the reported fix itself still wrong** before deploying it: the Authorization
  header format didn't match dLocal's own documented `V2-HMAC-SHA256, Signature: <hex>` scheme (see
  F48 above) — corrected before proceeding, not deployed as received. Re-ran the full verification
  chain independently rather than trusting "27/27 green": money-service 7/7 suites (100/100 tests),
  monolith 5/5 suites (107/107 tests), `tsc --noEmit` clean both sides, `eslint --max-warnings 0`
  clean, `nest build` clean. Noted explicitly that none of these tests exercise the real outbound
  `fetch()` call (test-mode short-circuits before it) — this class of bug is invisible to the
  existing suite by design (L2), so the live sandbox call was always the real proof, not the tests.
  Independently re-verified the 3rd orphaned row's deletion via a direct production DB query
  (`railway run --service Postgres` + `PrismaPg` adapter, same method as 4A-10b) rather than
  trusting the claim — confirmed gone, 0 `PENDING` rows at that point.
- **Executed:** committed the corrected fix (`ad7e57d1`), pushed (pre-push hook ran the full
  monolith suite, 122/122 suites, 2138/2138 tests, before allowing the push). money-service
  redeployed clean via GitHub auto-deploy (`Nest application successfully started`, zero DI
  errors). Flipped `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` in Vercel production, redeployed
  (`dpl_NUkyUTHXPoFDGoJoGVFYkxtpGci1`, READY). Davin ran a real authenticated request; result and
  root-cause analysis recorded under F48/F49 above. Reverted the flag to `false` and redeployed
  again immediately (`dpl_5qWfmQ7syPpFdb5LVAiMgPV91t6K`, READY) once the new blocker was confirmed
  live in money-service's logs — production is back to its pre-session state, monolith serving
  100% of dLocal traffic unchanged.
- **Net result:** F48 (signing/auth) is genuinely RESOLVED — the strongest possible evidence short
  of a completed payment (dLocal's own API accepted the credentials and moved to payload
  validation, something that has apparently never happened before in this codebase's history).
  Group B remains NOT cut over, blocked now by F49 instead. `migration-cutover-table.md`'s Slice 4
  row stays `CUT-OVER (partial: 3/4 groups)` — unchanged from 4A-10b's close, just for a corrected
  reason.
- **Not fixed this session:** F49 (`payment_method_flow`). A 4th orphaned `Payment` row needs
  Davin's cleanup. The secrets exposed during 4A-10b's continuation
  (`CRON_SECRET`/`DATABASE_URL`/`NEXTAUTH_SECRET`/`REDIS_URL`/4 dLocal secrets) are still
  unrotated — unrelated to this session's own work but still outstanding.

## Session 4A-10b (continuation, 2026-07-30) — 3 of 4 write-API groups cut over live

- **Context:** continuation of the 4A-10b order paused 2026-07-28 (see the order's own Deviations
  9-11). Davin reported Phase 1/2 remediation complete before this session started:
  `STRIPE_PRO_PRICE_ID` added to money-service Railway production; dLocal credentials refreshed;
  the two orphaned test `Payment` rows from the prior session deleted (independently re-verified
  by the Executor via a direct production query — 0 rows, both by ID and by a full `PENDING`-status
  scan).
- **Incident, disclosed immediately:** early in CONFIRM re-verification, the Executor ran `railway
variable list --service money-service` (default table view, not `--kv`) believing it masked
  values — it does not. Real values for `CRON_SECRET`, `DATABASE_URL`, `NEXTAUTH_SECRET`,
  `REDIS_URL`, and all 4 dLocal secrets were printed into the session transcript. This is the same
  failure class as `LESSONS-LEARNED.md` L17 (previously scoped to `--kv` only) — the DEFAULT `list`/
  `ls` table view has the identical problem. Disclosed to Davin immediately, before proceeding;
  Davin's call was to continue the session and rotate all exposed secrets after cutover completes.
  **This rotation is still outstanding as of this entry** — see Waiting-on.
- **Group A (Stripe): PASSED, cut over.** Flag flipped, redeployed, live authenticated request
  (Davin) returned a valid `cs_test_...` Stripe Checkout session. Independently cross-checked via
  money-service's own HTTP access logs (not just the response body): `POST /v1/stripe/checkout →
201 Created, 546ms`. Zero error-level logs, zero 4xx/5xx on money-service in the surrounding hour.
  `STRIPE_PRO_PRICE_ID` remediation confirmed effective.
- **Group B (dLocal): FAILED, reverted, NOT cut over.** See F48 above for the full root cause (a
  real code bug, not the config issue previously assumed). Two client-tooling detours cost real
  time before reaching the actual dLocal call: (1) `curl.exe` from PowerShell mangled the JSON
  body (`Expected property name or '}' in JSON at position 1` — the exact class of bug documented
  in the prior session's Deviation 12); (2) the Executor's own suggested `Authorization: Bearer`
  header pattern was wrong for the monolith's Next.js routes (which authenticate via NextAuth's
  `getServerSession()` cookie, not a bearer header — bearer auth is what money-service's OWN
  `JwtAuthGuard` expects on the FORWARDED request, not what the caller supplies to the monolith).
  Both resolved by switching to `Invoke-RestMethod` with an explicit `-WebSession`/`System.Net
.Cookie` object carrying Davin's real `__Secure-next-auth.session-token` (extracted from Chrome
  DevTools), matching the prior session's own established pattern. A third orphaned `Payment` row
  (`cms79jwuw00000frzsiurqtk4`, `status: PENDING`) was created before the dLocal 403 — the Executor
  declined to delete it (permanently deleting production data is outside what this Executor will
  do even with authorization); flagged for Davin to remove the same way as the prior two.
- **Group C (Admin): PASSED, cut over.** First attempt 403'd (`{"error":"You must be an
  administrator to access this resource"}`) — the cookie used belonged to a non-admin account,
  confirmed by reading `requireAdmin()`'s own `session.user?.role !== 'ADMIN'` check. Retried with
  an admin account's cookie: `{"success":true,"message":"Successfully distributed 1 codes to
affiliate","codesDistributed":1}`, independently cross-checked via money-service HTTP logs:
  `POST /v1/admin/affiliates/.../distribute-codes → 201 Created, 99ms`. Zero errors surrounding the
  request. This created one real `AffiliateBonusCode` batch row in production (intentional, per
  the test itself).
- **Group D (Disbursement): cut over, code/guard/log verification only — no live batch executed.**
  Per the prior session's own established Deviation 8 scope (executing a real batch would move
  real money through the live `WISE` provider). Verified instead: monolith route's flag-check
  wiring (unchanged since 4A-10a), money-service's `DisbursementBatchesController` guard parity
  (`JwtAuthGuard`+`AdminGuard` mirrors `requireAdmin()`), response-shape parity, and the
  `WisePaymentProvider` DI wiring into the provider-factory call. Flag flipped, redeployed clean,
  zero errors, `/health` → `200`. Live proof is deferred to the next real scheduled disbursement
  batch, same plan as 4A-W7 established.
- **Net result:** `migration-cutover-table.md`'s Slice 4 row is CUT-OVER for 3 of 4 groups
  (Stripe, Admin, Disbursement); dLocal stays on the monolith pending F48's fix. This is being
  recorded as a stable partial-scope completion (matching the Slice 2 dLocal-only precedent from
  Session 4A-5), not a broken mid-state — the monolith continues serving 100% of dLocal payment
  creation traffic unchanged, and reverting was confirmed clean via redeploy.

## Session 4A-12 (2026-07-30) — Slice 5 cutover executed; found and fixed a real undeployed-build gap before flipping anything

- **Context:** 4A-12 (VERIFY-RETIRE, CUTOVER block) fast-pathed PRE-DRAFT → APPROVED as written,
  then CONFIRMED (all entry criteria PASS, including `SVC_TOKEN` newly present-and-matching on both
  services — it was absent at 4A-11's close). Davin said "Go." No shadow-run/replay diff exists or
  ran for this cutover — re-confirmed against F51 (RESOLVED): `OUTBOX_PUBLISHER_ENABLED` is a single
  on/off gate with nothing to mirror.
- **Found before touching any flag:** probing the target endpoint (`POST
.../outbox/events`) ahead of wiring it in returned `404`, not the expected `401`. Root cause: local
  `main` was 12 commits ahead of `origin/main` — 4A-11's entire build (both services) was committed
  and CONFIRMED but never pushed/deployed. Compounding factor: `operation-service` has `"source":
null` in `railway service list --json` — no GitHub source connected at all, so push-triggered
  auto-deploy could never have reached it regardless, even after the push. Stopped, reported to
  Davin in full, got explicit go-ahead ("push now, verify, then continue 4A-12") before touching
  anything live. New `LESSONS-LEARNED.md` **L38**.
- **Fixed:** `git push origin main` (pre-push hook ran the full monolith suite, 122/122 suites,
  2138/2138 tests, before allowing it; money-service auto-redeployed clean).
  `railway up ./operation-service --path-as-root --service operation-service` (the only path for a
  service with no connected source). Re-verified end-to-end, value-blind: unauthenticated
  `POST /outbox/events` now `401` (not `404`); the SAME call with the real `SVC_TOKEN` read into
  memory and never printed returned `400` (DTO validation on an empty test body) — proof the
  deployed `SvcTokenGuard` genuinely accepts the real production token, not just that a guard
  exists. Both services confirmed healthy (`/health` → `200`).
- **Executed the cutover:** `OUTBOX_PUBLISHER_TARGET_URL` set on money-service to operation-service's
  real `/outbox/events` URL; `OUTBOX_PUBLISHER_ENABLED=true` flipped. The triggered redeploy sat in
  Railway's `QUEUED` state for ~23 minutes (unexplained delay; money-service stayed healthy on its
  prior deployment the entire time — zero customer-facing impact) before building and succeeding.
  Confirmed clean: `Nest application successfully started`, zero DI errors, zero error/outbox log
  lines since boot.
- **Not completed this session:** Checklist step 4 (watch a real event reach `PROCESSED`).
  Production's `OutboxEvent` table is confirmed EMPTY — 0 rows total, ever
  (`prisma.outboxEvent.count()` via a direct production query, using money-service's own
  `PrismaPg`-adapter pattern against `DATABASE_PUBLIC_URL` since `DATABASE_URL`'s internal hostname
  isn't reachable outside Railway's network). Per this order's own rules ("No new code, no fixes...
  observation and execution only"), did not fabricate a test row or trigger a real purchase.
  Davin's explicit call: leave "first real delivery" as a monitoring item, matching the established
  precedent from Slices 1/2/3 (Waiting-on #36/#38/#40) and 4A-W7's funding-in-progress note, rather
  than block the cutover on it.
- **Net result:** `migration-cutover-table.md`'s Slice 5 row → CUT-OVER (flag live, mechanism proven
  end-to-end via the guard round-trip; first real customer email still pending natural traffic).
  F50 (`COMMISSION_CREDITED` recipient unresolvable) stays OPEN and non-blocking, exactly as
  designed — the consumer skips-and-logs that one eventType rather than emailing the wrong person.

## F9 — `@trading-alerts/types` packaging mechanics

- Status: RESOLVED
- Session: 4B-1 · Date: 2026-07-31
- Decision: **pnpm workspace** (`pnpm-workspace.yaml`, `packages: - 'packages/*'`) for the monolith
  side. Confirmed pnpm — not the stale `package-lock.json` — is the actively-maintained,
  Vercel-canonical tool via git history on `pnpm-lock.yaml` (last touched by the Session 5-4 Vercel
  deploy fix, `be62d87f`; `package-lock.json`'s last commit predates that, Session 5-2). New package
  `@trading-alerts/types` (`packages/types/`) exports geometry math (`levelsForMark`, `MarkSnapshot`,
  `Anchor`, etc.), alert-engine core types (`Direction`, `PriceEvent`, `AlertWatch`, `FireEvent`), and
  the alert Zod validation schemas (`SYMBOLS`/`TIMEFRAMES`/`CONDITION_TYPES`/`createAlertSchema`/etc.)
  via subpath exports (`@trading-alerts/types/geometry`, `/alert-engine`, `/validations`), plus a flat
  root barrel. Built with `tsc` to CommonJS (`dist/*.js` + `.d.ts`), matching both the monolith's
  bundler-mode consumption and NestJS's CommonJS runtime.
  `operation-service`/`money-service` are **deliberately NOT** added as pnpm workspace members — both
  are independently deployed to Railway with their own lockfiles (`package-lock.json`, npm), and root
  `tsconfig.json` already excludes them from the monolith's own compilation by design; adding them to
  the workspace would risk changing how their own isolated Railway builds resolve dependencies, a
  blast radius disproportionate to this session's scope. Instead, `operation-service` consumes the
  package via a plain `file:../packages/types` dependency in its own `package.json`.
- Evidence: `pnpm --filter @trading-alerts/types run build` — 0 errors, full `dist/` output present
  (root + 3 subpaths, each with `.js`/`.d.ts`). Monolith `tsc --noEmit` — 0 errors. Monolith
  `npm run test:ci` — 122/122 suites, 2138/2138 tests (identical to the pre-session baseline,
  confirming the re-export-shim rewire changed zero runtime behavior).
  `operation-service`: `npm install` resolves the `file:` dependency to a real symlink
  (`node_modules/@trading-alerts/types -> ../../packages/types`); `node -e "require(...)"` resolves
  at runtime with all expected named exports; a temporary smoke file proved `tsc --noEmit` compiles
  cleanly against all 3 subpaths (deleted before session close — the real consumer is Session 4B-2);
  `nest build` clean; its own suite re-verified at 11/11 suites, 86/86 tests (unchanged baseline)
  after a one-off Jest OOM crash on 3 unrelated suites was traced to transient resource contention
  (immediate re-run passed clean), not this session's dependency change.
  A real gap was found and fixed mid-session: `operation-service`'s classic/Node-style
  `moduleResolution` (no `node16`/`nodenext`/`bundler` set) does not understand `package.json`
  `exports` maps at all — `tsc --noEmit` failed with `TS2307` on every subpath import even though the
  files existed and Node's own runtime `require()` resolved them fine. Fixed via a `typesVersions`
  field on `@trading-alerts/types`'s `package.json` (TypeScript's dedicated mechanism for this exact
  compatibility gap) rather than touching `operation-service`'s own tsconfig. New
  `LESSONS-LEARNED.md` **L39**.
  Wired `pnpm --filter @trading-alerts/types run build` into the root `prebuild` script (verified via
  a full local `npm run prebuild` run) so Vercel's build always produces a fresh `dist/` before
  `next build` resolves the package — closes the monolith side of "compatible with Vercel builds."
  The Railway side is only half-closed: `operation-service`'s only working deploy path
  (`railway up --path-as-root`, no connected GitHub source) uploads a flattened archive of just that
  subdirectory, which will almost certainly NOT include the sibling `packages/types` directory a
  `file:` dependency needs. This was proven to work locally (compile + runtime) per the order's own
  literal Done-When wording, but real Railway-deploy-time resolution for `operation-service` remains
  untested and is an explicit follow-up for whichever session (most likely 4B-2) first needs this
  package inside `operation-service`'s live, deployed alert-engine code.
- Approved by: Davin (live in chat — CONFIRM and full execution directed directly, order file itself
  arrived untracked with no PRE-DRAFT→DRAFT→APPROVED commit trail, the by-now-familiar
  `LESSONS-LEARNED.md` L11 pattern).

---

### F13 — Observability & Tracing Backend Selection

- **Flag:** `F13`
- **Session:** 4B-4 (2026-08-01)
- **Status:** **RESOLVED**
- **Decision:** **Option C — Configurable OTLP Exporter + Pino Correlation Logging**.
- **Context:** Evaluated three choices: Option A (Managed SaaS), Option B (Self-hosted Jaeger/Tempo service on Railway), and Option C (OpenTelemetry SDK with OTLP HTTP exporter + Pino structured correlation-ID logging).
- **Rationale:** Option C avoids recurring SaaS costs and avoids introducing a new Railway container service to operate before Phase 4 core domain migration completes. OpenTelemetry NodeSDK standard instrumentation (HTTP, Express, Prisma, ioredis) + Pino logger with `x-correlation-id` context provides standard tracing and correlation right now. If a specific SaaS or self-hosted backend is chosen later, setting `OTEL_EXPORTER_OTLP_ENDPOINT` and headers in Railway variables instantly routes traces there with 0 code changes.
- **Approved by:** Davin (2026-08-01, live in chat).

---

## F8 — Realtime/websocket architecture

- Status: **RESOLVED** — Session 4B-17, 2026-08-02 (Davin, live, in the session's own prep
  conversation, per the script's own "F8 FIRST — read both realtime spec docs and present
  socket-architecture options for my decision before any porting" hard gate)
- Decision, in full (5 sub-questions, each with a chosen option and rejected alternatives —
  matches this repo's own convention of recording every rejected alternative, not just the
  winner, per F36/F38 precedent):
  1. **Server location → `operation-service`'s existing HTTP process** (`main.ts`, via
     `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io`, using the already-built
     `RedisService`/`RedisModule`, Session 4B-4, as the `@socket.io/redis-adapter` for
     multi-replica fan-out). Rejected: a new dedicated gateway Railway service (higher setup
     cost, no isolation benefit judged necessary yet); a managed realtime provider
     (Pusher/Ably/Supabase Realtime — new vendor/cost, not needed).
  2. **Client protocol → real `socket.io-client`**, replacing the incompatible raw-WebSocket
     `hooks/use-websocket.ts`. Already a monolith dependency, already proven working elsewhere
     in this exact codebase (`hooks/use-ohlcv-socket.ts`, the separate Flask/MT5 stream).
     Rejected: a hand-rolled raw-WebSocket server compatible with the old client (throws away
     the Redis-adapter multi-node story for no benefit).
  3. **Scope → alert-fired notifications only.** Rejected: also reviving
     `subscribe_market`/`broadcastMarketData` (V8 XAUUSD tick streaming, already dead — that's
     `hooks/use-ohlcv-socket.ts` → Flask MT5's own separate, already-working job; bundling it in
     multiplies scope/risk for no clear benefit).
  4. **Handshake auth → verify the real NextAuth JWE**, reusing the same HS256-secret
     `decodeNextAuthToken` path `JwtAuthGuard` already uses (Session 3-1) — closes the OLD
     server's placeholder-auth gap (`lib/websocket/server.ts:120-122`, "For now, we use the
     token as the userId", never actually reachable in production so never a live exposure, but
     a design gap not to reproduce). Rejected: a separate short-lived server-issued ticket
     scheme (avoids repeated JWE-decrypt cost per reconnect, but adds a new ticket-issuing
     endpoint/store for no requested benefit — and its rejection is why `GET /api/realtime/token`
     had to hand the browser the RAW session token rather than a scoped ticket, see this
     session's own Deviations).
  5. **Session boundary → 4B-17 combined decide+build**, cutover deferred to 4B-18 (already
     named in the playbook/script). Rejected: splitting a decision-only CONTRACT session first
     (mirroring 4A-W1) — the decision turned out small enough not to need its own session once
     presented as a clear 5-question option set.
- **Why now, and why it was more urgent than "decide where Socket.IO lives":** this session's
  own order (`4b-17-realtime-websocket-decision-and-build.migration-order.md`) found, by reading
  the live codebase rather than the two spec docs' own claims, that realtime delivery had NEVER
  actually worked in production at all — `initWebSocketServer()` was never called by anything
  (no custom server wraps `next start`; would not have worked on Vercel's serverless runtime
  regardless), and even if it had been, the live client (`hooks/use-websocket.ts`, raw
  `WebSocket`) speaks an incompatible wire protocol from the intended `socket.io` server. This
  meant `NEXT_PUBLIC_WS_URL` (never set/documented anywhere) defaulted every real browser session
  to attempting a connection to `ws://localhost:3001` — the visitor's own machine — silently,
  forever. Full evidence in the order's own `## Raw facts` #1-#11.
- **Built this session:** `operation-service/src/realtime/{realtime.gateway,realtime.module}.ts`
  (new `RealtimeGateway`, registered in `AppModule`) + a real end-to-end spec
  (`realtime.gateway.e2e.spec.ts` — real `socket.io-client` against a real in-process gateway,
  real minted JWE, real Redis pub/sub semantics via a faithful in-memory double). Monolith:
  `app/api/realtime/token/route.ts` (new — server-side bridge handing the browser the same
  session token `getOperationServiceToken()` already forwards for REST calls, since a persistent
  client-initiated socket connection can't be proxied through a route handler the way a REST call
  can), `hooks/use-realtime-socket.ts` (new, replaces `hooks/use-websocket.ts` in both real
  consumers — `useFiredAlertMarkers.ts`, `notification-bell.tsx`). Dead code retired:
  `lib/websocket/server.ts`, `hooks/use-websocket.ts`, `components/providers/websocket-provider.tsx`
  (fully orphaned duplicate), `lib/alert-engine/{notify-bridge.ts,types.ts}` (the monolith-side
  subscriber half — `lib/websocket/server.ts` was their only remaining importer). Housekeeping:
  `railway-worker.json` + the `worker:alerts` npm script deleted (both pointed at
  `scripts/alert-worker.ts`, deleted at Session 4B-3).
- **Deployed and live-verified this session** (not yet the only path the shipped client calls,
  per the order's own Step 8 rule — see Deviations for the full deploy/verification detail):
  `operation-service` redeployed clean (`railway up --path-as-root --service operation-service`,
  deployment `47b093b1-3e07-4603-ada1-04ecfe1839dd`, genuinely `SUCCESS`); a real Engine.IO
  handshake response confirmed live (`GET /socket.io/?EIO=4&transport=polling` →
  `0{"sid":...,"upgrades":["websocket"],...}`) — direct proof `RealtimeGateway` is attached to
  the real production HTTP server, independent of and stronger than a boot-log read (which
  `railway logs` could not reliably surface this session — every flag combination tried returned
  empty for this specific deployment, a new manifestation of the recurring "don't trust `railway
logs`" class, see this session's own Deviations/lessons candidate). Monolith redeployed via
  `vercel --prod --archive=tgz --yes` (L36).
- **Not done this session, by design (Step 8's own rule):** no cutover flag exists for this slice
  and none was needed — the new gateway ships dormant/parallel, proven live via direct HTTP/
  Engine.IO checks and this session's own real e2e suite, but the actual browser-session live
  smoke test (a real fired alert reaching a JWE-authenticated browser as both a bell notification
  and a chart marker) needs Davin's own browser per this migration's established method for every
  prior Phase 4B cutover — carried to this session's own close-out / Session 4B-18's entry
  criteria, not fabricated or skipped.
- Approved by: Davin (live, 2026-08-02, this session's own prep conversation and execution
  go-ahead).

---

## F53 — `RealtimeGateway`'s CORS `origin` config breaks every real cross-origin browser connection

- Status: **OPEN** — needs a scoped fix session (new `4b-18b-realtime-cors-origin-fix.migration-order.md`, PRE-DRAFTed)
- Session: found 4B-18, 2026-08-02 · Date: 2026-08-02
- Found while: Session 4B-18's own live browser smoke test (Davin, real authenticated tab,
  `/charts/XAUUSD/M5`) — RED result, socket never connected/authenticated, `socket.io-client`
  logged `connect_error: websocket error` 9 times over 30+s, no `authenticated` event ever fired.
- **Root cause, confirmed by reading the installed library code directly (`cors@2.8.5`,
  `engine.io@6.x` via `node_modules`), not just inferred from behavior:**
  `operation-service/src/realtime/realtime.gateway.ts:36-41` configures
  `cors: { origin: (process.env['ALLOWED_ORIGINS'] ?? '*').split(','), credentials: true }`.
  Live production has `ALLOWED_ORIGINS=*` (value confirmed, value-blind-appropriate to state —
  this is public CORS config, not a secret). `'*'.split(',')` always produces the **array**
  `['*']`, never the bare string `'*'`. `engine.io`'s `Server` constructor
  (`node_modules/engine.io/build/server.js:61-62`) passes this straight to the standalone `cors`
  package: `this.use(require("cors")(this.opts.cors))`. That package's `configureOrigin()`
  (`node_modules/cors/lib/index.js:41-58`) only enables "allow any origin" when
  `options.origin === '*'` (the bare string) or falsy; an ARRAY falls through to
  `isOriginAllowed(requestOrigin, options.origin)`, which for a string element does
  `return origin === allowedOrigin` — checking whether the browser's real `Origin` header
  literally equals the string `'*'`. It never does (real origins look like
  `https://trading-alerts-saas-frontend.vercel.app`), so `Access-Control-Allow-Origin` is never
  set and the browser blocks the connection before the Socket.IO/Engine.IO handshake ever
  completes. This is a genuine cross-origin scenario (monolith on `*.vercel.app`,
  `operation-service` on `*.up.railway.app`) — it fails on every real browser, unconditionally,
  not an edge case.
- **Why this was invisible through every prior verification in 4B-17/4B-18:** every "live
  Engine.IO handshake" check performed so far (`curl "https://.../socket.io/?EIO=4&transport=
polling"`) used `curl`, which sends no `Origin` header at all and does not enforce CORS —
  it always got a clean `200` regardless of whether `Access-Control-Allow-Origin` was ever
  correctly configured. A `curl`-based handshake check proves the gateway is attached and
  answering; it does NOT prove a real cross-origin browser can connect. 4B-17's own e2e test
  suite (`Test.createTestingModule` + a real `socket.io-client`) also never exercised this path,
  since an in-process Nest test has no real cross-origin `Origin` header semantics to trip over.
- **Independent Railway HTTP/app-log cross-check (Executor, not just the client-side report):**
  zero `GET /socket.io/...` entries and zero application-log lines of any kind for
  `operation-service` during Davin's actual test window (`~12:41-13:11 UTC`, Thailand local
  `7:41-7:41:35 PM`) — consistent with the request being rejected by the `cors` middleware
  before Express/Engine.IO's own access-log line is ever written, or never completing far enough
  to log. A same-window `GET /drawings 200` (the monolith's own server-side forward, not a
  browser-direct call) proves general connectivity/DNS/TLS to `operation-service` was fine — this
  is specifically a browser-origin CORS rejection, not a broader outage.
- **Not fixed in this session** — VERIFY-RETIRE's own "no new code, no fixes" rule. The fix is
  well-understood and narrow: pass the bare string `'*'` when `ALLOWED_ORIGINS` is unset/`'*'`,
  only `.split(',')` into an array for a real explicit allow-list. Scoped to its own follow-up.
- Approved by: n/a (technical finding, not yet a decision — the fix session itself needs Davin's
  normal APPROVED sign-off before executing).
- **RESOLVED — Session 4B-18b (2026-08-03).** `resolveRealtimeCorsOrigin()` built exactly as
  scoped: bare string `'*'` when `ALLOWED_ORIGINS` is unset/`'*'`, split array only for a real
  explicit comma-separated allow-list. 4 new unit tests assert the branching directly.
  Independently re-verified beyond the order's own minimum proof requirement: a real cross-origin
  `OPTIONS` preflight (with an actual `Origin` header, unlike every prior `curl` check) against
  the deployed endpoint now correctly returns `access-control-allow-origin: *`; confirmed this is
  safe given the client's connection is never credentialed (`hooks/use-realtime-socket.ts` sets no
  `withCredentials`), so the wildcard-origin + credentials-true combination browsers would
  otherwise reject for a credentialed request is a non-issue here. **This specific bug is fixed.**
  **However, Davin's real browser smoke test still FAILED after this fix, RED result, same
  symptom as 4B-18's own original test** — see new **F54** below for the reason why, and
  `4b-18b-realtime-cors-origin-fix.migration-order.md`'s own Deviations for the full evidence
  chain (including a re-read of `engine.io`'s/`cors`'s own source showing the `cors` middleware
  never actually ABORTS a request on origin mismatch — it only omits a response header, which has
  no effect on a raw WebSocket handshake at all, since browsers don't enforce CORS on WS the way
  they do on `fetch`/XHR; this means F53's own diagnosis, while a real and now-fixed bug, may not
  have been the actual layer blocking the WS-first live symptom in either test — see F54).

## F54 — Monolith CSP `connect-src` never included operation-service's origin, blocking the

realtime WebSocket connection client-side before any network request is sent

- Status: **OPEN** — needs a scoped fix session (new
  `4b-18c-realtime-csp-connect-src-fix.migration-order.md`, PRE-DRAFTed)
- Session: found 4B-18b, 2026-08-03 · Date: 2026-08-03
- Found while: re-testing F53's own fix live — Davin's browser smoke test still failed
  identically to 4B-18's original RED result (recurring `connect_error: websocket error`, no
  `authenticated` event, zero `GET /socket.io/...` network entries). Since F53's fix was already
  independently verified correct at the protocol level (see F53's resolution above), this meant a
  SEPARATE cause was still blocking the live browser specifically.
- **Root cause, found by reading the actual CSP header the monolith sends
  (`next.config.js:119-134`):** its `Content-Security-Policy`'s `connect-src` directive is
  `'self' https://api.stripe.com https://checkout.stripe.com wss://*.pusher.com
https://*.vercel-analytics.com` — `operation-service-production.up.railway.app` (in any scheme)
  is not present. `connect-src` governs every `fetch`/XHR/WebSocket connection a page initiates;
  a destination absent from it is blocked by the BROWSER ITSELF before any network request is
  ever sent, regardless of whether the destination server's own CORS config is correct.
- **Ruled out alternative explanations before concluding this, not just asserted:**
  (1) re-read `engine.io`'s `handleUpgrade()` — its `cors` middleware chain does run on the
  WebSocket upgrade path too, but `cors`'s own `configureOrigin()` never aborts a request on
  origin mismatch, it only omits/sets a response header and always calls `next()` — and that
  header has no bearing on a raw WS handshake, which browsers do not gate via
  `Access-Control-Allow-Origin` the way they gate `fetch`/XHR. (2) scripted a raw WebSocket
  handshake directly against the deployed, already-F53-fixed endpoint using Node's `ws` package
  with a real `Origin` header — it **succeeded** (`OPEN`, a real Engine.IO handshake payload
  received), ruling out a server- or Railway-infra-level rejection entirely. (3) pulled
  `operation-service`'s real Railway HTTP access log for Davin's exact test window — zero
  `/socket.io/` entries of any kind (only unrelated `GET /drawings 200` monolith-forward traffic),
  while the Executor's OWN manual `curl`/Node checks minutes earlier DID appear in that same log —
  proving Railway logs real socket.io requests when they arrive, so their total absence during
  Davin's real test is a genuine "never sent," not a logging gap.
- **This is fully consistent with every piece of evidence in BOTH this session's re-test and
  4B-18's own original test:** zero server-side log entries (browser-side block, no network
  request ever leaves), a generic `connect_error: websocket error` (exactly what socket.io-client
  emits on a CSP-blocked connection attempt — indistinguishable from other connection failures at
  that log level), `GET /api/realtime/token` succeeding fine both times (`'self'`, same-origin,
  unaffected by `connect-src`'s cross-origin restriction).
- **Open question, not resolved, carried to the fix session:** whether this same CSP gap was
  ALSO the (or the sole) actual blocker in 4B-18's own original RED result, given F53's CORS bug
  — while real and now genuinely fixed — may never have actually been reachable by the WS-first
  connection path the client uses. Both bugs are now understood and (F53) fixed; only F54 remains
  open. The next session's live proof, once F54 ships, is the first real evidence either way.
- `wss://*.pusher.com` in the same CSP directive is confirmed dead/stale (zero code references
  anywhere in the repo) — predates the realtime feature entirely; `next.config.js`'s own recent
  git history shows no CSP-touching commit since well before Session 4B-17 built this feature.
  Whether to remove it is flagged as an explicit scope question for the fix session, not decided
  here.
- **Not fixed in this session** — per `4b-18b-...migration-order.md`'s own explicit instruction
  ("if the smoke test still fails after this fix, that is a NEW finding... stop, do not attempt a
  second speculative fix in the same session — escalate to Davin/Advisor with the new evidence").
  `next.config.js` was read-only this session; zero bytes changed in it.
- Approved by: n/a (technical finding, not yet a decision — the fix session itself needs Davin's
  normal APPROVED sign-off before executing).
- **RESOLVED — Session 4B-18c (2026-08-03).** Added
  `https://operation-service-production.up.railway.app` AND
  `wss://operation-service-production.up.railway.app` to `connect-src` (both schemes, since
  `hooks/use-realtime-socket.ts` configures `transports: ['websocket', 'polling']` — polling
  needs `https://`, the websocket upgrade needs `wss://`). Also removed the confirmed-dead
  `wss://*.pusher.com` entry, approved live by Davin. Deployed
  (`vercel --prod --archive=tgz --yes`, `dpl_ELhtB77VKv79D7CAvndbBBNXSmp9`), live CSP header
  independently re-verified via `curl -I` to genuinely include both new entries post-deploy — not
  just trusted from the source diff. **This specific bug is fixed and independently proven**:
  Davin's real browser smoke test showed a genuine `GET .../socket.io/?EIO=4&transport=websocket`
  request completing with **`101 Switching Protocols`** in the Network tab's native WS-filtered
  view (first confirmed after ruling out a Resource Timing API false-negative, which does not
  reliably capture native WebSocket handshakes) — direct proof the browser now both attempts AND
  completes the cross-origin WS handshake, something neither F53's nor F54's own fix had directly
  proven before this exact test. `operation-service`'s own live logs cross-check this
  independently: the real user (`cmsa5a8pa0001d8v2ikyfm5h5`) shows repeated genuine
  `Client <id> authenticated as user <id>` log lines during Davin's test window, confirming
  `RealtimeGateway.handleConnection`'s real NextAuth-JWE verification succeeds end-to-end,
  server-side, for a real production browser connection for the first time in this 3-session arc.
  **However, the smoke test's own overall pass condition — the connection STAYING connected and
  authenticated in the UI — still failed, on a genuinely NEW, third root cause: see new F55.** Per
  `4b-18c-...migration-order.md`'s own explicit instruction ("a third distinct root cause... is a
  strong signal this needs a broader, non-PORT-shaped investigation session"), F55 was not
  investigated further or fixed this session beyond read-only diagnosis (Railway log pull,
  `realtime.gateway.ts` read — zero bytes changed in operation-service).

## F55 — Realtime WS connection authenticates server-side, then repeatedly disconnects/reconnects — never observed stably "connected" client-side

- Status: **RESOLVED**
- Session: found 4B-18c, 2026-08-03 · resolved 4B-18d, 2026-08-03 · Date: 2026-08-03
- Found while: re-testing F54's own fix live — the WS transport genuinely connected (`101 Switching
Protocols`) and the real user completed `RealtimeGateway.handleConnection`'s JWE auth
  successfully, but the chart page's own connection indicator stayed red/"Disconnected", and Railway
  logs showed the same user authenticating via 15+ distinct socket IDs across a ~50-minute test
  window, each disconnecting shortly after — a genuine repeated connect→authenticate→disconnect→
  reconnect loop, several gaps clustering suspiciously near ~25-30s (Socket.IO's default
  pingInterval/pingTimeout window), a well-evidenced but unconfirmed hypothesis at the time.
- **Resolution (Session 4B-18d):** Step 1 closed the diagnostic gap flagged at discovery —
  `handleConnection` now attaches a raw `client.on('disconnect', reason => ...)` listener (Socket.IO's
  own documented pattern; NestJS's `OnGatewayDisconnect` dispatch was proven, by reading the installed
  `@nestjs/websockets` source directly, to structurally discard whatever reason argument the
  underlying event carries — widening `handleDisconnect`'s own signature was never going to work).
  Deployed to production (`railway up --path-as-root`, deployment `8bc25055`), then Davin reproduced
  the pattern live: **the real reason is `"transport close"`, not `"ping timeout"`** — the leading
  hypothesis is ruled out with certainty. DevTools' native WS Messages tab independently confirmed
  healthy ping/pong (25.3s cadence, ~1ms response time, zero missed pongs), closing the loop from the
  client's own observable side too.
- **The original dense-cycling pattern did not reproduce across ~2 hours of active monitoring** this
  session, despite byte-identical code the whole time. The 3 "transport close" events actually
  observed all correlated with concrete triggers (post-deploy settling, Davin's own deliberate page
  reload) — not spontaneous drops during stable operation. One connection ran 1h29min with zero
  disconnects (Railway-log-confirmed, independent of the client/DevTools view). Checked
  `railway deployment list` and boot logs: the original dense episode (`~02:55-03:44 UTC`) happened on
  a process that had been running continuously for 2.5+ hours with zero restarts — ruling out
  "settling after a deploy" as that episode's own explanation, leaving its precise root cause
  genuinely unconfirmed (most likely a transient network/browser-tab condition, not a reproducible
  server-side defect).
- **No speculative fix applied**, per this order's own explicit rule — no reproducible, confirmed
  defect existed to aim a `pingInterval`/`pingTimeout` tune or a client-side reconnect hack at. The
  `[F55]`-tagged diagnostic logging (Step 1) is the durable interim mitigation: any recurrence is now
  immediately diagnosable via its own log line rather than requiring another investigation arc.
- **Full live smoke test finally passed clean, closing the F53/F54/F55 arc:** a substitute
  end-to-end delivery proof (a real market-driven fire was blocked by a separate, unrelated,
  pre-existing gap — `market_data_v6` empty + `flask-api` offline, carried forward as its own item,
  NOT part of this resolution) — one synthetic `alerts:fired` message published directly to
  production Redis (matching `notify-bridge.service.ts`'s exact shape, clearly tagged as a synthetic
  smoke test), observed arriving as both `["notification", {...}]` and `["alert_fired", {...}]`
  frames back-to-back in DevTools' raw WS Messages tab, byte-matching the published payload exactly,
  on a connection with healthy ongoing ping/pong throughout.
- Approved by: Davin (live GO for execution; live agreement to close on this basis without a
  confirmed fix, given the pattern's non-reproduction and the diagnostic logging as mitigation).

## F56 — OAuth handling for the Auth Cutover (4B-20/21): Option A/B/C per this order's own Finding 5

- Status: RESOLVED & EXECUTED
- Session: 4B-20 (decision) → 4B-21 (execution) · Date: 2026-08-03 (decision) / 2026-08-04
  (execution)
- Found while: this order's own PRE-DRAFT audit (2026-08-03) — `operation-service`'s `AuthController`
  has zero OAuth support of any kind (credentials-only: register/login/refresh/logout/me/
  forgot-password/reset-password/verify-email/resend-verification), while `lib/auth/auth-options.ts`
  (583 lines) genuinely configures THREE conditional OAuth providers (`GoogleProvider`,
  `TwitterProvider`, `LinkedInProvider`, each gated on its own `isXConfigured` env-var check) on top
  of `CredentialsProvider`, rendered live via `components/auth/social-auth-buttons.tsx`'s three real
  `signIn('google'|'twitter'|'linkedin', ...)` buttons. The playbook's own one-line framing for this
  session ("retire `[...nextauth]`... delete `auth-options.ts`") would have silently broken OAuth
  login for any real user who signed up via Google/Twitter/LinkedIn, with no equivalent path to fall
  back to.
- Decision: **Option B** — keep a narrow `[...nextauth]` route alive indefinitely, scoped to OAuth
  providers only. `CredentialsProvider` is removed from `auth-options.ts` once credentials fully cut
  over (Session 4B-21, not this session — 4B-20 is BUILD-only, zero traffic cutover). Credentials,
  2FA, registration, and sessions are cut over to operation-service's `token-*` bridge routes; OAuth
  login (Google/Twitter/LinkedIn) stays on `next-auth/react`'s `signIn()` against the narrowed
  `auth-options.ts` indefinitely — building real OAuth support into `operation-service` (Option A) or
  deprecating OAuth login outright (Option C) were both explicitly rejected.
- Rollout mechanism (same decision, same prompt): a client-readable flag,
  `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED` (default unset/`false` — forms stay on `next-auth/react`'s
  credentials path until Session 4B-21 flips it), read via `lib/auth/auth-bridge-flag.ts`'s
  `isAuthBridgeEnabled()`. Matches this migration's own established per-slice flag pattern
  (`lib/operation-service/flags.ts`) rather than an atomic swap with `git revert` as rollback — auth
  is the single highest-blast-radius surface in the app, and a staged/instantly-revertible rollout is
  worth the extra flag plumbing.
- Evidence (decision): Live decision from Davin via interactive prompt, in direct response to this
  order's own Entry Criterion 0 and rollout-mechanism question (both raised at this session's CONFIRM,
  since the order's own working copy had claimed "Option B selected"/"APPROVED" with zero
  corresponding DECISION-LOG.md entry, no entry-criteria checkboxes checked, and no DRAFT-stage commit
  trail — `LESSONS-LEARNED.md` L11's most consequential recurrence to date, given this session's own
  explicit "not fast-path eligible under any circumstance" framing). Davin confirmed live this was his
  own authentic decision before CONFIRM proceeded.
- **Execution (Session 4B-21, 2026-08-04):** Steps 1-5 of the order's own Checklist (UI swap, local
  integration smoke test, Davin's flip approval, the production flag flip, Davin's own live production
  smoke test) all completed and passed clean in prior turns of this same session (see this order's own
  Deviations 1-12 and `DECISION-LOG.md` F57/F58) — Davin reported the production smoke test passed
  cleanly for credentials login, registration, OAuth, and logout. Step 6 then executed:
  `CredentialsProvider` (and its two now-dead helpers, `generate2FAToken` and the `PrismaUserWith2FA`
  type, both exclusively used by `authorize()`) removed from `lib/auth/auth-options.ts` — file shrank
  583 → ~370 lines. `bcrypt`/`jsonwebtoken` imports removed (no remaining consumer in the file). Three
  inline comments that referenced "credentials provider" were corrected to describe the OAuth-only
  reality rather than left stale; the `signIn` callback's `account.provider !== 'credentials'` guard
  simplified to a bare truthiness check (behaviorally identical, since `'credentials'` can no longer
  occur). Step 7 executed in the same pass: `app/api/auth/register/route.ts` deleted (superseded by
  `token-register`, confirmed zero other real consumers — only a mock error-log example string and an
  archived, inactive e2e test referenced its path). `scripts/verify-auth-config.js` (a standalone dev
  utility, not wired into `package.json`/CI) updated to check for `CredentialsProvider`'s _absence_
  and `token-register/route.ts`'s presence, so it no longer reports false errors against the new
  architecture.
- **Dependents checked before removal, all confirmed safe:** `login-form.tsx`, `verify-2fa/page.tsx`,
  `admin/login/page.tsx`, and `register-form.tsx` all still have a legacy `signIn('credentials', ...)`
  / `/api/auth/register` fallback branch behind `isAuthBridgeEnabled()` being `false` — per this
  order's own Rollback note, these branches are now permanently non-functional (NextAuth returns a
  graceful error, not a crash — no unhandled exception) unless a future rollback reverts this
  Session's commits alongside the flag. This is the accepted, by-design consequence of Option B/F56,
  not an oversight. No test file exercises `authOptions`'s provider array or `authorize()` directly
  (confirmed via repo-wide search before editing), so none of Session 4B-21's own or prior sessions'
  tests needed updating.
- **Full verification:** `tsc --noEmit` clean, `eslint app components lib hooks --max-warnings 0`
  clean (0 errors/warnings), full `test:ci` 129/129 suites, 2191/2191 tests — byte-identical counts to
  before this change, confirming zero regressions from the removal.
- Approved by: Davin (decision, 4B-20; execution directed live, 4B-21, after his own reported
  production smoke-test pass)
