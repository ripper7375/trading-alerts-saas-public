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

| Flag | Topic                                                                         | Status                                                                                                                 |
| ---- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| F1   | OpenAPI coverage from live routes                                             | RESOLVED — fully closed, Session 0-3                                                                                   |
| F2   | Pin next@16.2.10 / @nestjs/core@11.1.28                                       | RESOLVED — Session 0-1                                                                                                 |
| F3   | Where does the monolith's Postgres live?                                      | RESOLVED — Session 1-1 (on Railway, different instance than railway-gateway)                                           |
| F4   | Full model census for schema split                                            | RESOLVED — Session 2-2                                                                                                 |
| F5   | Prisma file-layout strategy                                                   | RESOLVED — Session 2-2                                                                                                 |
| F6   | Auth strategy: bridge vs OpenAuth vs hand-rolled                              | OPEN — due Session 3-1 (Davin)                                                                                         |
| F7   | HS256 shared secret vs JWKS + rotation timing                                 | OPEN — due Session 3-1 (Davin)                                                                                         |
| F8   | Realtime/websocket architecture                                               | OPEN — due Session 4B-17                                                                                               |
| F9   | @trading-alerts/types packaging mechanics                                     | OPEN — due Session 4B-1                                                                                                |
| F10  | Next.js 15→16 breaking-change audit                                           | OPEN — due Session 5-1                                                                                                 |
| F11  | Frontend gap matrix                                                           | OPEN — due Session 6-1 (Davin triage)                                                                                  |
| F12  | Whole-plan duration estimate                                                  | OPEN — revisit after F1–F5                                                                                             |
| F13  | Observability/tracing backend                                                 | OPEN — due by first Phase 4 cutover                                                                                    |
| F14  | Tier-update: outbox vs direct call                                            | OPEN — due Session 4A-8                                                                                                |
| F15  | Redis topology/namespacing                                                    | RESOLVED — Session 4A-1 (Davin)                                                                                        |
| F16  | Public URL scheme + /v1 versioning                                            | RESOLVED — Session 4A-1 (Davin)                                                                                        |
| F17  | Staging data strategy                                                         | RESOLVED — Session 0-5 (Davin)                                                                                         |
| F18  | RPO/RTO targets                                                               | RESOLVED — Session 1-1 (RPO gap: automated-backup cadence unverified, dashboard-only)                                  |
| F19  | Prisma 6.19.2→7.8.0 breaking-change audit                                     | RESOLVED — Session 2-1                                                                                                 |
| F20  | Production migration history unbaselined                                      | RESOLVED — Session 2-3 (drop_watchlists stripped-and-orphaned per Davin; other 5 baselined; FK audit applied)          |
| F21  | 24h Account-Deletion GDPR gap                                                 | OPEN — found Session 2-3, requires Davin's product decision (hard-delete vs anonymize), scheduled for a future session |
| F22  | lib/affiliate/constants.ts breaks `npm run build` (pre-existing, likely live) | RESOLVED — Session 2-4 (same-session follow-up, Davin's explicit go-ahead)                                             |

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

## F6 — Auth strategy: bridge vs OpenAuth vs hand-rolled

- Status: RESOLVED
- Session: 3-1 · Date: 2026-07-21
- Decision: Confirm 'bridge first' - The new service verifies existing NextAuth tokens while NextAuth remains on Vercel.
- Evidence: Live decision from Davin via interactive prompt. At CONFIRM, a fresh full-repo
  search found the plan's 3 "missing" F6 reference docs actually exist
  (`backend-stack-a/hybrid-authentication-for-backend-stack-a/`, committed 2026-02-02,
  predates this migration) and recommend OpenAuth as primary reference — Davin reviewed
  and explicitly disregards them as superseded exploratory seed material for a future
  end-state; bridge-first stands per the plan's own §5 decision.
- Approved by: Davin

## F7 — HS256 shared secret vs JWKS + rotation timing

- Status: RESOLVED
- Session: 3-1 · Date: 2026-07-21
- Decision: Path B: Build JwtAuthGuard to decrypt NextAuth's JWE directly (no NextAuth changes, safer for live users, but ties NestJS to NextAuth JWE format).
- Evidence: Live decision from Davin via interactive prompt.
- Approved by: Davin

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
