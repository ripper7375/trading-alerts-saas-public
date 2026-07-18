# Decision Log — Flag Resolutions & Material Decisions

**What this is:** the append-only record of every flag resolution (F1–F19) and every
material decision made during the migration. The flag _register_ (what each flag asks) lives
in the plan §11; this file records _how each was resolved, by whom, with what evidence_.
The Executor writes entries at session close; Davin's sign-off is quoted where required.

**Entry format:**

```
## <ID> — <short title>
- Status: OPEN | RESOLVED | SUPERSEDED
- Session: <P-N where resolved>  ·  Date: <yyyy-mm-dd>
- Decision: <what was decided>
- Evidence: <commands run, docs read, URLs fetched, test results>
- Approved by: <Davin | n/a (technical, within bounds)>
```

---

## Flag register status (details in plan §11)

| Flag | Topic                                            | Status                                                                                |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| F1   | OpenAPI coverage from live routes                | RESOLVED — fully closed, Session 0-3                                                  |
| F2   | Pin next@16.2.10 / @nestjs/core@11.1.28          | RESOLVED — Session 0-1                                                                |
| F3   | Where does the monolith's Postgres live?         | RESOLVED — Session 1-1 (on Railway, different instance than railway-gateway)          |
| F4   | Full model census for schema split               | OPEN — due Session 2-2                                                                |
| F5   | Prisma file-layout strategy                      | OPEN — due Session 2-2 (revisit under F19)                                            |
| F6   | Auth strategy: bridge vs OpenAuth vs hand-rolled | OPEN — due Session 3-1 (Davin)                                                        |
| F7   | HS256 shared secret vs JWKS + rotation timing    | OPEN — due Session 3-1 (Davin)                                                        |
| F8   | Realtime/websocket architecture                  | OPEN — due Session 4B-17                                                              |
| F9   | @trading-alerts/types packaging mechanics        | OPEN — due Session 4B-1                                                               |
| F10  | Next.js 15→16 breaking-change audit              | OPEN — due Session 5-1                                                                |
| F11  | Frontend gap matrix                              | OPEN — due Session 6-1 (Davin triage)                                                 |
| F12  | Whole-plan duration estimate                     | OPEN — revisit after F1–F5                                                            |
| F13  | Observability/tracing backend                    | OPEN — due by first Phase 4 cutover                                                   |
| F14  | Tier-update: outbox vs direct call               | OPEN — due Session 4A-8                                                               |
| F15  | Redis topology/namespacing                       | OPEN — due Session 4A-1                                                               |
| F16  | Public URL scheme + /v1 versioning               | OPEN — due Session 4A-1 (Davin)                                                       |
| F17  | Staging data strategy                            | RESOLVED — Session 0-5 (Davin)                                                        |
| F18  | RPO/RTO targets                                  | RESOLVED — Session 1-1 (RPO gap: automated-backup cadence unverified, dashboard-only) |
| F19  | Prisma 6.19.2→7.8.0 breaking-change audit        | OPEN — npm check RESOLVED (0-1); full audit due Session 2-1                           |

---

_(Resolution entries append below this line — newest last)_

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
