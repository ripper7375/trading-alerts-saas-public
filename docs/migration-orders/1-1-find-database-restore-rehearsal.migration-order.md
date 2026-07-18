# Migration Order — Find the Database + Rehearse Restore (F3, CC-G)

> `TEMPLATE-CONTRACT.md` variant (per `00-SKELETON-AND-RULES.md` §2's own table: "1-1" is
> listed under CONTRACT, not INFRA — this is an investigation + a one-time restore
> rehearsal, not standing provisioning). Borrows INFRA's Rollback-per-step convention for
> the restore-rehearsal step, since it does touch a live system (a scratch DB instance).
> **Status: CONFIRMED** — re-verified by the Executor at session open (2026-07-18): all 4
> entry criteria hold (Session 0-5 artifacts pushed/matching origin; Railway CLI
> authenticated + `.env.local` DATABASE_URL present; F18 answer recorded; blast-radius
> statement self-satisfied by this document).

**Session:** 1-1 · **Phase:** Phase 1 (Railway PostgreSQL, Workstream 7) · **Variant:** CONTRACT
· **Status:** CONFIRMED · **Generated:** 2026-07-18 · **Flags touched:** F3 (where does the
monolith's Postgres live?), F18 (RPO/RTO targets) · **Estimated time:** unknown — depends on
restore-rehearsal duration against however large the live DB is; budget for a split if the
scratch restore runs long.

## Context carried over from Session 0-5

- **Chain-order note (flagging, not silently absorbing, per `00-SKELETON-AND-RULES.md` §4):**
  `00-SKELETON-AND-RULES.md` §1.5 says "chain length is exactly one — never draft two
  sessions ahead." Session 0-5 already produced a PRE-DRAFT for its own next session
  (Railway + Vercel staging provisioning, informally "Session 0-6") inside its own
  "Next-session handoff" section — that session does not yet exist as a standalone file.
  Phase 0 is **not** formally closed: the Phase 0 Exit Review (in `0-5-staging-local-dev
.migration-order.md`) found 4/5 exit criteria met, with CC-A (staging shells) the sole
  gap. This order (Session 1-1) is being PRE-DRAFTed now anyway, at Davin's **explicit**
  instruction, ahead of both Phase 0's formal close and the pending 0-6 session. Both this
  order and 0-6 need the same not-yet-granted **Railway dashboard/account access** — Davin
  can decide which runs first (or whether to combine them) once that access lands; nothing
  in this order depends on 0-6 having run first.
- **Playbook scope** (`monolith-to-microservices-migration-session-playbook.md`, Session
  1-1): "Resolve F3: inspect live `DATABASE_URL`s / Railway dashboard; document where the
  monolith's Postgres actually lives. Take a backup and restore it to a scratch instance;
  verify row counts and that the app boots against the restore. Record F18 (your RPO/RTO
  answer) in the Decision Log." Playbook's "Your input" table: "database credentials/
  dashboard access; your F18 decision (e.g., '≤24h RPO, ≤1h RTO')."
- **Lead, not a fact, on F3:** the Session 0-4 secret matrix (`docs/secret-matrix.md`)
  catalogued `DATABASE_URL` in `.env.example`/`.env`/`.env.local`/`docker-compose.yml`.
  `.env.example`'s placeholder value follows the pattern
  `postgresql://postgres:your_password@your_region.railway.app:5432/railway` — this
  _suggests_ (does not confirm) the live DB may already be Railway-hosted, possibly even
  the same instance `railway-gateway` writes `market_data_v6` to. Session 0-4's rules
  never read live `.env`/`.env.local` **values** (names-only extraction), so this remains
  genuinely unresolved — exactly F3's open question, not a foregone conclusion.
- **Plan §3 design target** (Phase 1, Stage A): one Railway Postgres instance hosting both
  `market_data_v6` and `non_market_data`, with `money_svc`/`core_app`/`gateway_ingest`
  roles + PgBouncer — that's Sessions 1-3/1-4's work, not this one. This session only
  answers "where does it live today" and proves a restore works; it does not create roles,
  deploy PgBouncer, or move data.
- **Conditional downstream effect:** per the playbook, Session 1-2 ("Relocate database to
  Railway") **runs only if this session's F3 finding is "off-Railway."** If F3 finds the
  DB already on Railway, 1-2 is skipped entirely and the chain goes straight to 1-3 (Roles
  - PgBouncer, INFRA variant) — this order's own Next-session handoff will reflect
    whichever branch F3 lands on.

## Entry criteria

- [x] Session 0-5 artifacts committed and pushed: `docker-compose.dev.yml`, `CLAUDE.md`,
      `DECISION-LOG.md`, `LESSONS-LEARNED.md` (L10/L11), `migration-stack-analysis.md` — done,
      commits `2bd6b413`/`a3ead03b`/`a011f11a`, `origin/main` matches.
- [x] Davin has granted Railway dashboard access + database credentials sufficient to (a)
      identify the live `DATABASE_URL`'s host and (b) take a backup/snapshot and restore it
      to a scratch instance. (Same access this order shares with the still-pending "Session
      0-6" staging provisioning — see Context note.) Verified 2026-07-18: Railway CLI
      authenticated (`railway whoami` → account confirmed), `.env.local` carries a
      `DATABASE_URL` key.
- [x] Davin has provided an F18 answer: **RPO ≤ 24h, RTO ≤ 1h**.
- [x] Blast-radius statement: worst case, a mishandled backup/restore rehearsal is read-only
      against the live DB (snapshots don't mutate source data) — the actual risk surface is
      the **scratch instance** (must never be network-reachable by production/staging
      traffic) and accidental credential exposure (this order's own rule: host only, never
      full connection strings or passwords, in any artifact or transcript).

## Ordered steps

_(investigate → produce → verify; a claim without a source is not a finding)_

1. **Locate the monolith's live Postgres host.** Extract only the **hostname** from the
   live `DATABASE_URL` (e.g. `node -e "console.log(new URL(process.env.DATABASE_URL)
.hostname)"` or equivalent) — never print, log, or commit the full connection string
   or password, matching Session 0-4's names-only discipline. Cross-check that hostname
   against the Railway dashboard's project/service list to determine: (a) already the same
   Railway Postgres instance `railway-gateway` connects to for `market_data_v6`, (b) a
   _different_ Railway instance, or (c) off-Railway entirely (Vercel Postgres, Supabase,
   self-hosted, etc.).
   _Verify:_ hostname confirmed via two independent sources (env-var host-only extraction +
   Railway dashboard) before writing F3's resolution — a single source is not enough per
   this variant's "ground truth priority" rule.
2. **Record F3 in `DECISION-LOG.md`** — the resolution (which of a/b/c above) with evidence
   (the two-source cross-check, host value only).
3. **Rehearse a restore.** Take a backup (Railway's native snapshot mechanism if (a)/(b)
   above, or `pg_dump` if (c)) and restore it to a **scratch instance**, isolated from
   production/staging — no shared network access, no real traffic ever reaches it. **Destructive nothing:** this is a strictly read-only operation against the source database; no data may be modified or deleted on the live instance. Verify
   row counts (or a representative per-table sample, given schema size) match between the
   source and the restored scratch copy. Boot the monolith against the scratch restore
   using a temporary, throwaway env file (`.env.scratch` or equivalent) — **never** point
   the live `.env`/deployment config at the scratch instance — and confirm the app starts
   cleanly against it.
   _Verify:_ row-count/checksum match documented per table (or documented sampling
   methodology if full comparison is impractical); app boot log shows no DB errors.
   _Rollback:_ destroy the scratch instance immediately after the rehearsal — it's a
   point-in-time copy for verification only, nothing in it needs to persist.
4. **Record F18 in `DECISION-LOG.md`** — Davin's stated RPO/RTO targets (**RPO ≤ 24h, RTO ≤ 1h**), plus how the
   backup cadence discovered in step 1/3 (automated? how frequent? retention?) compares
   against that target (meets it / gap identified).

## Rules specific to this variant

- **Ground truth priority:** live Railway dashboard/env > docs. This session must not
  print, log, or commit a full `DATABASE_URL` or any credential value anywhere (transcript,
  Decision Log, this order's own Deviations section) — host only, same rule as the Session
  0-4 secret matrix.
- **No data relocation, no live `DATABASE_URL` change, no role/PgBouncer work in this
  session** — those are Session 1-2 (conditional), 1-3, 1-4 respectively.
- The scratch restore instance is throwaway: provisioned, verified, and torn down within
  this session — it must never become a standing resource anyone depends on afterward.
- `railway-gateway`'s ingest write path (`market_data_v6`) must never blip during this
  session's investigation or restore rehearsal — read-only snapshot mechanisms only against
  the live instance.

## Done when

- [x] F3 answered and recorded in `DECISION-LOG.md`, with two-source evidence (host only).
- [x] Restore rehearsal documented (row-count/checksum comparison; app-boot confirmation)
      in a new doc (e.g. `docs/db-restore-rehearsal.md`) or this order's Deviations section.
- [x] F18 recorded in `DECISION-LOG.md` (RPO ≤ 24h, RTO ≤ 1h target + gap analysis vs. actual
      backup cadence).
- [x] Scratch instance destroyed; live monolith and `railway-gateway` ingest unaffected
      throughout (explicitly confirmed, not assumed).

## Rollback

Read-only against the live database (a backup/snapshot never mutates its source); the only
new resource this session creates is the temporary scratch instance, torn down at step 3's
own rollback note. If this session is aborted mid-way, nothing besides the scratch instance
(if already provisioned) needs undoing — no impact to production, staging, or the existing
local dev stack.

## Deviations

**Step 1, in progress (2026-07-18) — hostname cross-check surfaced a project-naming
mismatch, session paused pending Davin's check (not an entry-criterion failure, a
mid-investigation finding):**

- Source 1 (`.env.local` `DATABASE_URL`, host-only extraction): hostname
  `turntable.proxy.rlwy.net`, port 55082, db `railway`.
- Source 2 (Railway CLI, account has 5 projects: `trading-alerts`, `postgre for staging`,
  `zoological-motivation`, `feisty-amazement`, and one more workspace project not yet
  needed for this check): the production-sounding **`trading-alerts`** project's `Postgres`
  service resolves to `maglev.proxy.rlwy.net` — does **not** match Source 1. The
  **`postgre for staging`** project's `Postgres` service resolves to
  `turntable.proxy.rlwy.net` — **matches** Source 1. That same `postgre for staging`
  project also hosts a service literally named `trading-alerts-saas-public` (this exact
  repo, deployed from `ripper7375/trading-alerts-saas-public`), currently status
  **Failed**.
- No Railway project/service named `railway-gateway` was found anywhere in the account,
  so the order's case-(a) test ("same instance `railway-gateway` writes `market_data_v6`
  to") could not yet be checked from the Railway project list alone — `railway-gateway`'s
  own config (in this monorepo) would need to be read to get its comparison hostname.
- **Not yet written to `DECISION-LOG.md`** — F3's resolution depends on which project
  Davin confirms is actually production, since the naming (`trading-alerts` vs. `postgre
for staging`) points the opposite direction from the live `.env.local` value. Escalated
  to Davin rather than guessing; session paused at his request ("let me check and get back
  to you") before any backup/restore action against either instance.
- Railway CLI local link left pointed at `feisty-amazement` (the last project checked
  during cross-referencing) — local metadata only (`.railway/` link state), no infra
  action taken against any instance; safe to relink to whichever project Davin confirms.

**Step 1, continued (2026-07-18) — Davin corrected `.env.local` to the true production
`DATABASE_URL` (copied from Vercel production env vars); re-check surfaced a second,
more serious finding — the target instance appears unreachable, session paused again:**

- Source 1 re-checked: `.env.local` `DATABASE_URL` hostname now `maglev.proxy.rlwy.net`
  (port 58290, db `railway`) — **matches** Source 2 (`trading-alerts` project's `Postgres`
  service `DATABASE_PUBLIC_URL`/`RAILWAY_TCP_PROXY_DOMAIN`). Two-source cross-check for
  the _hostname_ itself is satisfied.
- However, `railway status` on the linked `trading-alerts` project shows the `Postgres`
  service itself as **"○ Offline"**, and the project's other service, `flask-api`, as
  **"● Failed"**.
- A bounded (8s timeout), read-only connectivity probe from this environment (`pg` client,
  `DATABASE_PUBLIC_URL`, `SELECT ... FROM information_schema.tables`, no query mutated
  anything, no credential value logged) got **`ECONNRESET`** on connect — consistent with
  Railway's TCP proxy accepting the connection but the backend Postgres container not
  actually running, matching the dashboard's "Offline" status rather than contradicting it.
  (An earlier attempt using the plain `DATABASE_URL` Railway CLI injects failed
  `ENOTFOUND postgres.railway.internal` — that's expected/uninteresting, it's Railway's
  private-network hostname, not resolvable from outside Railway; not a finding, just a
  wrong variable choice corrected by using `DATABASE_PUBLIC_URL` instead.)
- Net: the hostname Davin copied from Vercel production **is** confirmed (via Railway's own
  project records) to be the intended production instance's address — but that instance
  does not currently appear to be accepting connections. This could mean a live production
  outage (worth checking independently of this migration order), a Vercel env var pointing
  at a stopped/paused Railway service, or a transient blip coinciding with this check.
  **Not yet resolved — did not proceed to the backup/restore step (step 3) against an
  unreachable target.** F3's hostname sub-finding is solid; F3 is not yet written to
  `DECISION-LOG.md` pending Davin's read on the reachability finding, since "the DB lives
  at host X" and "X is currently up" are different claims and the order's own evidence bar
  ("a claim without a source is not a finding") applies to both.
- A temporary local probe script (`.tmp-db-check.js`, project root, never committed) was
  created and deleted in the same turn — confirmed absent from `git status` afterward.

**Steps 2-4, completed (2026-07-18) — Davin upgraded the Railway account and manually
redeployed the `Postgres` service (confirmed restart of the existing volume, not a fresh
instance); reachability and F3/F18 resolution then completed as follows:**

- **F3 resolved to (b)**: on Railway (`trading-alerts` project, `Postgres` service,
  `maglev.proxy.rlwy.net`), but a _different_ instance than whatever `railway-gateway`
  writes `market_data_v6` to — confirmed by querying the live instance directly
  (`pg_database`/`information_schema.tables`): only 2 databases exist on this server
  (`postgres`, `railway`), neither containing any `market_data`-named table. Full entry:
  `DECISION-LOG.md` F3.
- **Backup-mechanism deviation from the order's suggested approach:** the order suggests
  "Railway's native snapshot mechanism if (a)/(b)" — this session's Railway CLI (the only
  access set up) has no `backup`/`snapshot` subcommand; that feature is dashboard-only and
  wasn't exercised. Used `pg_dump` (case-(c)-style) instead, run inside a throwaway
  `postgres:17-alpine` Docker container, reading via `DATABASE_PUBLIC_URL` injected by
  `railway run` (never printed/logged). Functionally equivalent for this rehearsal's
  purpose (prove backup→restore→verify→boot works); flagged here since it technically
  diverges from the order's exact wording. Noted as an open gap in F18's Decision Log
  entry — Davin should separately verify whether Railway's automated/native backups are
  actually enabled for this service via the dashboard.
- **Scratch instance:** a throwaway `postgres:17-alpine` Docker container, bound to
  `127.0.0.1:<docker-assigned-port>` only (stronger isolation than a second cloud
  instance — no network path to it exists outside this machine). Restore via
  `pg_restore --no-owner --no-privileges`: clean, all 21 FK constraints + indexes
  recreated, zero errors.
- **Row-count verification:** exact match across all 26 tables between production and
  the restored scratch copy (`User`=1, `SystemConfig`=5, `login_history`=4,994,
  `security_alerts`=42, `user_sessions`=2, all other 21 tables=0). Full detail:
  `docs/db-restore-rehearsal.md`.
- **App-boot verification:** built `.env.scratch` by copying `.env.local` and repointing
  only `DATABASE_URL` to the scratch container — `.env.local` was never modified, per the
  order's explicit rule. Booted `next dev` on port 3099 with `.env.scratch`'s values
  exported into the process environment (so they take precedence over Next's own `.env`
  loading). `GET /` → `HTTP 200` twice, 51,587-byte real page, zero DB/Prisma errors in
  the server log.
- **Teardown:** scratch app process killed (had to force-kill the actual `next-server`
  child PID directly — the wrapper PID captured at launch wasn't the real listener;
  worth remembering if this pattern recurs), scratch Docker container removed
  (`docker rm -f`), dump file and all temp scripts/`.env.scratch` deleted — confirmed via
  `git status` and `docker ps -a` that nothing from this rehearsal persists anywhere.
- **Docker-on-Windows note (candidate lesson):** `docker pull postgres:17` (the full,
  non-alpine image) repeatedly failed mid-pull with `local error: tls: bad record MAC`
  across 3 attempts; `postgres:17-alpine` pulled cleanly on the first alpine attempt.
  Separately, bind-mounting `-v "$(pwd)/dir:/dump"` from Git Bash silently produced
  `pg_dump: could not open output file "/dump/...": No such file or directory` — MSYS
  path conversion was mangling the _container-side_ `/dump` path too; fixed with
  `MSYS_NO_PATHCONV=1`. Both undocumented before this session — see `LESSONS-LEARNED.md`
  L12/L13 below.
- **F18 resolved** with an explicit RPO gap (automated-backup cadence unverified — CLI has
  no backup-inspection command, dashboard wasn't checked). Full entry: `DECISION-LOG.md`
  F18.

## Next-session handoff

**F3 resolved to "already on Railway"** (case (b)) — per this order's own conditional,
Session 1-2 ("Relocate database to Railway") is **SKIPPED**. The chain goes straight to
**Session 1-3 (Roles + PgBouncer, INFRA variant)**: create the `money_svc`/`core_app`/
`gateway_ingest` Postgres roles and deploy PgBouncer in front of the `trading-alerts`
`Postgres` service, per Plan §3 Stage A's target architecture. Entry criteria to carry
into that order: Railway CLI access to the `trading-alerts` project (already
established, reusable), and Davin's confirmation of exactly which roles/privilege
boundaries he wants for `money_svc` vs. `core_app` vs. `gateway_ingest` before any role
DDL is drafted (a privilege-boundary decision, not a technical default — escalate per
CLAUDE.md non-negotiable #5, money/auth-adjacent). Note for that session: this instance
does **not** currently host `market_data_v6` (confirmed this session) — if Plan §3's
target of "one instance hosting both `market_data_v6` and `non_market_data`" still holds,
Session 1-3/1-4 will also need a data-consolidation step neither this order nor the
original playbook wording anticipated; flag this explicitly to Davin/the Advisor when
drafting 1-3's order rather than silently absorbing the scope change.

_(PRE-DRAFT for whichever session follows — branches on this session's own F3 finding: if
F3 finds the DB **already on Railway**, Session 1-2 ["Relocate database to Railway"] is
SKIPPED per the playbook's own conditional, and the handoff drafts Session 1-3 [Roles +
PgBouncer, INFRA variant] instead. If F3 finds the DB **off-Railway**, the handoff drafts
Session 1-2 as written in the playbook. Written at this session's actual close, once the
finding is known — not assumed here.)_
