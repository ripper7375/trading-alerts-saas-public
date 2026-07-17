# Migration Order — Find the Database + Rehearse Restore (F3, CC-G)

> `TEMPLATE-CONTRACT.md` variant (per `00-SKELETON-AND-RULES.md` §2's own table: "1-1" is
> listed under CONTRACT, not INFRA — this is an investigation + a one-time restore
> rehearsal, not standing provisioning). Borrows INFRA's Rollback-per-step convention for
> the restore-rehearsal step, since it does touch a live system (a scratch DB instance).
> **Status: PRE-DRAFT** — written by the Executor at Davin's explicit request during
> Session 0-5's wrap-up, ahead of the normal chain order (see Context note below).

**Session:** 1-1 · **Phase:** Phase 1 (Railway PostgreSQL, Workstream 7) · **Variant:** CONTRACT
· **Status:** PRE-DRAFT · **Generated:** 2026-07-17 · **Flags touched:** F3 (where does the
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

- [ ] Session 0-5 artifacts committed and pushed: `docker-compose.dev.yml`, `CLAUDE.md`,
      `DECISION-LOG.md`, `LESSONS-LEARNED.md` (L10/L11), `migration-stack-analysis.md` — done,
      commits `2bd6b413`/`a3ead03b`/`a011f11a`, `origin/main` matches.
- [ ] Davin has granted Railway dashboard access + database credentials sufficient to (a)
      identify the live `DATABASE_URL`'s host and (b) take a backup/snapshot and restore it
      to a scratch instance. (Same access this order shares with the still-pending "Session
      0-6" staging provisioning — see Context note.)
- [ ] Davin has provided an F18 answer (acceptable RPO/RTO — e.g., "≤24h RPO, ≤1h RTO") OR
      explicitly defers it to a later session (F18's Decision Log entry would then record
      "deferred," not a target).
- [ ] Blast-radius statement: worst case, a mishandled backup/restore rehearsal is read-only
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
   production/staging — no shared network access, no real traffic ever reaches it. Verify
   row counts (or a representative per-table sample, given schema size) match between the
   source and the restored scratch copy. Boot the monolith against the scratch restore
   using a temporary, throwaway env file (`.env.scratch` or equivalent) — **never** point
   the live `.env`/deployment config at the scratch instance — and confirm the app starts
   cleanly against it.
   _Verify:_ row-count/checksum match documented per table (or documented sampling
   methodology if full comparison is impractical); app boot log shows no DB errors.
   _Rollback:_ destroy the scratch instance immediately after the rehearsal — it's a
   point-in-time copy for verification only, nothing in it needs to persist.
4. **Record F18 in `DECISION-LOG.md`** — Davin's stated RPO/RTO targets, plus how the
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

- [ ] F3 answered and recorded in `DECISION-LOG.md`, with two-source evidence (host only).
- [ ] Restore rehearsal documented (row-count/checksum comparison; app-boot confirmation)
      in a new doc (e.g. `docs/db-restore-rehearsal.md`) or this order's Deviations section.
- [ ] F18 recorded in `DECISION-LOG.md` (Davin's RPO/RTO answer + gap analysis vs. actual
      backup cadence), or explicitly marked deferred if Davin hasn't decided yet.
- [ ] Scratch instance destroyed; live monolith and `railway-gateway` ingest unaffected
      throughout (explicitly confirmed, not assumed).

## Rollback

Read-only against the live database (a backup/snapshot never mutates its source); the only
new resource this session creates is the temporary scratch instance, torn down at step 3's
own rollback note. If this session is aborted mid-way, nothing besides the scratch instance
(if already provisioned) needs undoing — no impact to production, staging, or the existing
local dev stack.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for whichever session follows — branches on this session's own F3 finding: if
F3 finds the DB **already on Railway**, Session 1-2 ["Relocate database to Railway"] is
SKIPPED per the playbook's own conditional, and the handoff drafts Session 1-3 [Roles +
PgBouncer, INFRA variant] instead. If F3 finds the DB **off-Railway**, the handoff drafts
Session 1-2 as written in the playbook. Written at this session's actual close, once the
finding is known — not assumed here.)_
