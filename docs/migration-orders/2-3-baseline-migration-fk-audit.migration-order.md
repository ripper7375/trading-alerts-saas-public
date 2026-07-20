# Migration Order — Baseline migration history + cross-domain FK audit (F20)

> `TEMPLATE-PORT.md` variant per `00-SKELETON-AND-RULES.md` §2's table (2-2…2-4 all
> PORT, low creativity dial), but this session touches production database state
> directly — borrows `TEMPLATE-INFRA.md`'s entry-criteria/rollback rigor for that
> part, per §2's "mixed types" rule. Read `00-SKELETON-AND-RULES.md` §4 first, and
> `LESSONS-LEARNED.md` L16 (never `migrate deploy` against an unfamiliar production DB
> without reading `migrate status` and every pending migration's SQL first) before
> touching the migration CLI at all.
> **Creativity dial: Low for the FK-audit schema edits (pure structural removal); ZERO
> for anything touching live production data** — the `drop_watchlists` handling below
> is Davin's decision, not a technical judgment call.
> **Status: EXECUTED** — CONFIRMed and both steps executed 2026-07-20. F20 RESOLVED.
> `drop_watchlists` handled per Davin's live decision: option (b), strip-and-orphan.
> Migration history baselined (5 migrations), FK-drop migration applied (4
> constraints). Full test:ci parity (111/111, 2046/2046). See Deviations below —
> the two-migration-histories mechanism was found unworkable at CONFIRM and Davin
> approved a deviation (single shared `prisma/migrations/`) on the spot.

**Session:** 2-3 · **Phase:** Phase 2 (`non_market_data` Prisma Schema, Workstream 6),
plan steps 2.3–2.4 · **Variant:** PORT + INFRA-borrowed rigor · **Generated:**
2026-07-20 · **Flags touched:** F20 (production migration history unbaselined,
urgent, OPEN since Session 1-3) — this session closes it, contingent on Davin's
`drop_watchlists` decision below. **Estimated time:** unestimated (F12 open) — likely
longer than 2-2 given the live-data decision required.
**Target service:** monolith-internal (same repo; touches the shared production
Postgres instance directly — this is NOT a same-database-no-writes session like 2-2).
**Contract:** none (internal Prisma migration history + schema structure; no external
API shape changes — though dropped `include: { user: true }` capability on 4 models
is an internal-contract change consumers must adapt to in Session 2-4).

## Context carried over from Session 2-2 (schema split)

- **Two new schema files exist and are proven:** `prisma/market-data/schema.prisma`
  (`MarketDataV6` only) and `prisma/non-market-data/schema.prisma` (26 models +
  `RefreshToken`). Both `prisma validate` clean, both generate working clients. F4/F5
  RESOLVED in `DECISION-LOG.md`.
- **Old `prisma/schema.prisma` is still the only schema the app's 16 real consumers
  import from** — this session does NOT touch consumer imports (that's Session 2-4);
  it only touches migration history and the two NEW schema files' model definitions.
- **F20, unchanged since Session 1-3, re-stated here because this session closes it:**
  `prisma migrate status` (read-only, direct connection) found **all 6 migrations in
  `prisma/migrations/` unapplied server-side** — no tracked history exists even though
  production's live schema already matches most of their end-state. The 6, in order:
  `20251227000000_init`, `20260214000000_rag_dual_memory`,
  `20260224000000_update_kc_ha_body_columns`, `20260705000000_add_market_data_v6`,
  `20260705010000_drop_market_data`, `20260706000000_drop_watchlists`. **The last one
  runs `DROP TABLE "WatchlistItem"` / `DROP TABLE "Watchlist"` — both tables
  confirmed live with data in production (Session 1-3's `pg_tables` check).** If
  `migrate deploy` is ever run against this DB as-is, all 6 apply in order including
  that drop, silently, with no warning beyond routine "N migrations applied" output.
- **The product decision to remove Watchlist/WatchlistItem already happened** (see
  the comment at `prisma/schema.prisma` between `Alert` and `Payment`: "V8 migration
  (2026-07): Watchlist and WatchlistItem models removed — watchlists were eliminated
  from the product for all tiers") — carried byte-for-byte into
  `prisma/non-market-data/schema.prisma`. So the _target_ schema state has always
  intended these tables gone; the open question is purely **how and when** the live
  data gets reconciled with that decision, not whether it should be.
- **Money↔User FK audit scope, identified via direct grep against the live
  `prisma/non-market-data/schema.prisma` this session (re-verify at CONFIRM, this is
  a snapshot):** of the 26 non-market models, exactly **9** have a Prisma `@relation`
  to `User` (`Account`, `Session`, `UserPreferences`, `Subscription`, `Alert`,
  `Payment`, `FraudAlert`, `AffiliateProfile`, `Drawing`). Cross-referencing against
  the plan's 10-money-table list (§4, Phase 2 intro) narrows this to exactly **4**
  money-domain relations to convert to opaque references: `Subscription`, `Payment`,
  `FraudAlert`, `AffiliateProfile`. The other 5 (`Account`, `Session`,
  `UserPreferences`, `Alert`, `Drawing`) are core/auth/product features, not money —
  their `User` relations stay untouched. All 4 already carry `@@index([userId])`
  independent of the relation, so "keep the column + index" (plan step 2.4's
  instruction) requires **no new index** — only removing the `@relation` field
  itself, its DB-level FK constraint, and the 4 corresponding reverse-side fields on
  `User` (`subscription`, `payments`, `fraudAlerts`, `affiliateProfile`).
- **Found along the way, not this session's job:** grepping for what currently
  _uses_ the `onDelete: Cascade` behavior on these 4 relations turned up nothing in
  production code — the only `prisma.user.delete()` call sites in the whole repo are
  `lib/db/seed.ts`/`frontend/lib/db/seed.ts` (test-fixture teardown) and two test
  files asserting the method exists. `app/api/user/account/deletion-confirm/route.ts`
  promises "your account will be deleted in 24 hours" (GDPR language), but no cron
  route (checked all 8 under `app/api/cron/`) or queue job (checked
  `lib/jobs/queue.ts`) appears to perform that deletion. **This means today's
  production risk from dropping the cascade is low** (nothing live exercises it), but
  it's a separate, real-looking gap worth Davin's attention independent of this
  migration — flagged as a background task, not fixed here (scope discipline).

## Davin must decide before this session executes past Step 1

**`drop_watchlists` handling — pick one, live, before Step 2 runs:**

- **(a) Execute the drop for real, now.** Take a fresh `pg_dump` of `Watchlist` +
  `WatchlistItem` first (both tables, full data, timestamped, stored somewhere
  durable — not just this session's scratch space), confirm the backup restores
  cleanly, THEN mark `drop_watchlists` as applied (baselining a migration whose SQL
  actually still needs to run is not baselining — it's `migrate deploy`, and this
  session must not conflate the two). This finally makes live state match the V8
  product decision and the current schema.
- **(b) Never apply it — treat the tables as permanently orphaned/legacy.** Remove
  `20260706000000_drop_watchlists` from the migrations directory entirely (or mark it
  in a way Prisma will never try to apply again), baseline the other 5 as applied,
  and leave `Watchlist`/`WatchlistItem` live in Postgres untouched, unreferenced by
  either new schema file, forever (or until a deliberate future cleanup session).
- **Do not let this session pick silently.** Baselining a migration that hasn't
  actually run, just to make `migrate status` go quiet, is exactly the shortcut
  `LESSONS-LEARNED.md` L16 exists to prevent.

**No staging environment exists** (Phase 0's CC-A gap, still open) — like Session
2-1, this session's production-affecting steps have no staging rehearsal path. Davin
must explicitly waive that (as he did for 2-1) or this session stops at Step 1.

## Entry criteria

- [x] Session 2-2 fully closed — F4/F5 RESOLVED in `DECISION-LOG.md`, both new schema
      files `prisma validate` clean — re-verified at CONFIRM (both still valid).
- [x] **Fresh, not memory-trusted** `prisma migrate status` re-run against production —
      confirmed still 6 unapplied, `drop_watchlists` still last/only destructive one,
      no migration file changed since Session 1-3's original finding.
- [x] Row-count check on `Watchlist`/`WatchlistItem` — **skipped by Davin's explicit
      instruction**: irrelevant under option (b) since the tables are left untouched
      either way.
- [x] Money↔User FK-audit model list re-verified via direct grep against live
      `prisma/non-market-data/schema.prisma`: exactly 9 `@relation`s to `User`,
      narrows to the same 4 money models, all 4 already carry `@@index([userId])` —
      zero drift from this PRE-DRAFT's census.
- [x] **Open technical question — answered, and it changed the plan.** Prisma 7's
      `--schema` flag does NOT carry its own migrations path; that comes only from
      `prisma.config.ts`, which is a single, repo-root, singular `migrations.path`.
      No per-schema config files or migration directories existed. Empirically
      confirmed via `prisma migrate status --schema=prisma/market-data/schema.prisma`
      still reading from `prisma/migrations`. Building the two-history mechanism would
      have required new per-schema config files AND an untested assumption (two
      independent histories sharing one `_prisma_migrations` table in one DB without
      collision) — with no staging environment to test it safely. Presented to Davin;
      he approved a deviation instead of building/testing the mechanism blind. See
      Deviations.
- [x] Davin's live decision on `drop_watchlists` obtained BEFORE Step 2 ran: **option
      (b), strip-and-orphan** — quoted in Deviations below.

## Integration points

- **In:** none new (no consumer imports touched — that's Session 2-4).
- **Out:** none new.
- **Owns:** migration history for `prisma/market-data/schema.prisma` and
  `prisma/non-market-data/schema.prisma` (new — did not exist before this session);
  the FK-audit edits to the 4 money models + `User`'s reverse-side fields in
  `prisma/non-market-data/schema.prisma`.

## Ordered steps

### Step 1 — Read-only audit (no writes to production or any schema file)

- Re-run `prisma migrate status`, the `Watchlist`/`WatchlistItem` row-count check,
  and the FK-audit grep (all entry criteria above).
- Research the two-migration-histories-one-database question (open technical
  question above).
- **Present findings to Davin. STOP — hard gate, same pattern as Session 2-1's Step 1.** Do not proceed to Step 2 without his live `drop_watchlists` decision and
  staging-waiver.

### Step 2 — Baseline migration history (production-affecting; requires Davin's live go-ahead from Step 1)

- **SOURCE:** none (no schema/model changes in this step — purely migration-history
  bookkeeping) → **TARGET:** production's `_prisma_migrations` table, via
  `prisma migrate resolve --applied <name>`.
- **CRITICAL REQUIREMENT:** The very first migration file generated for the new schemas MUST be a no-op baseline — never a massive `CREATE TABLE` script (which `migrate dev --name init` would do). Use `prisma migrate diff` or create an empty SQL file, then `resolve --applied` it to baseline the new schema directories.
- **Kind:** infra/migration bookkeeping, not a port.
- **Mechanism for `drop_watchlists` specifically:** per Davin's Step-1 decision — either
  actually run the drop (backed up first) then mark applied, or strip it from the
  migrations directory and never mark it applied at all. Document exactly which, and
  why, in Deviations.
- **Parity proof:** `prisma migrate status` reports zero pending migrations for both
  new schemas afterward; production's live table set matches expectations (26
  non-market tables + `market_data_v6`, with `Watchlist`/`WatchlistItem` either gone
  — option (a) — or still present but consciously orphaned — option (b)).
- **Commit:** `migrate(2-3): baseline production migration history for both split schemas`

### Step 3 — Cross-domain FK audit (schema edit + a real, reviewed migration)

- **SOURCE:** `prisma/non-market-data/schema.prisma`'s `Subscription`, `Payment`,
  `FraudAlert`, `AffiliateProfile` models (each currently has `user User
@relation(fields: [userId], references: [id], onDelete: Cascade)`) and `User`'s 4
  matching reverse-side fields (`subscription`, `payments`, `fraudAlerts`,
  `affiliateProfile`) → **TARGET:** same file, relation fields removed, `userId`
  columns + their existing `@@index([userId])` kept unchanged.
- **Kind:** port + adapt (structural removal, no new fields).
- **Invariants:** `userId` values themselves don't change; every existing query
  `WHERE userId = ...` keeps working identically. What changes: (1) the DB-level FK
  constraint + its `ON DELETE CASCADE` no longer exists — a `User` delete no longer
  auto-removes these rows (see the cascade-usage finding above: nothing live
  exercises this today, but flag it, don't bury it); (2) Prisma Client's
  `include: { user: true }` / `select: { user: ... }` on these 4 models stops
  compiling — Session 2-4 must grep for and adapt any such call site.
- **Generate the actual migration** (`prisma migrate dev --schema=prisma/non-market-
data/schema.prisma --name drop_money_user_fk_constraints`), **read the generated
  SQL before applying** (must be 4 `ALTER TABLE ... DROP CONSTRAINT ...` statements,
  nothing else — if Prisma's diff proposes anything else, e.g. a column type change
  or unexpected drop, STOP and ask Davin), then apply via `migrate deploy` against
  the direct URL.
- **Parity proof:** full `npm run test:ci` re-run — expect the same 111/111 · 2046/2046
  baseline UNLESS an existing test asserts on the now-removed relation includes, in
  which case that's a finding (L4: a ported test needing its assertion changed is a
  finding, not a fix) — document any such test in Deviations with justification
  before touching its assertion.
- **Commit:** `migrate(2-3): drop money-table FK constraints to User (opaque references)`

## Rules specific to this variant

- **Zero creativity on the `drop_watchlists` decision** — it is Davin's call, made
  live, not inferred from "the schema already doesn't have these models so probably
  fine to drop." Document his exact words/decision in Deviations.
- **First migration must be a no-op baseline — never a create.** Do not generate a massive `CREATE TABLE` migration for the new schemas.
- Changing a ported test's assertion requires a written justification in Deviations
  (L4).
- Read every migration's actual SQL before running `resolve --applied` on it — never
  trust a migration's filename alone (L16).
- This session ends with migration history baselined AND the FK audit fully applied
  (schema edit + real migration + green tests) — not half-done. If Step 1's findings
  force a scope cut (e.g. Davin unavailable to decide `drop_watchlists` live), stop
  after Step 1, document the blocker, and do not guess.

## Slice-level verification (done when)

- [x] `prisma migrate status` reports zero pending migrations (single shared history,
      per the deviation — not "both new schemas" as originally worded; see Deviations).
- [x] `drop_watchlists` handled per Davin's explicit Step-1 decision: option (b) —
      `20260706000000_drop_watchlists/` removed from `prisma/migrations/` entirely,
      never marked applied, commit `2aca8b00`.
- [x] `prisma/non-market-data/schema.prisma`'s 4 money-model relations to `User`
      removed; `prisma validate` clean; generated client's `SubscriptionInclude` (and
      the other 3) spot-checked in `index.d.ts` — no `user` accessor remains.
- [x] The FK-drop migration's SQL reviewed before applying (hand-written, 4
      `ALTER TABLE ... DROP CONSTRAINT ...` statements, nothing else); applied cleanly
      via `prisma migrate deploy`; `prisma migrate status` clean afterward.
- [x] Full `npm run test:ci` — 111/111 suites, 2046/2046 tests, exact parity with
      Session 2-2's baseline, zero deltas.
- [x] F20 RESOLVED in `DECISION-LOG.md`, with Davin's `drop_watchlists` decision quoted.

## Cutover & rollback

- **Baselining (Step 2):** not reversible in the conventional sense — marking
  migrations "applied" just aligns Prisma's bookkeeping with reality; if `drop_watchlists`
  is actually executed (option a), rollback means restoring from the pre-drop backup,
  not a schema revert.
- **FK-drop migration (Step 3):** reversible via a follow-up migration that re-adds
  the FK constraint (`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ...`) — write and
  test this rollback migration BEFORE applying the forward one, per INFRA-borrowed
  rigor, so a bad apply has a known-good reverse path ready, not improvised after the
  fact.

## Deviations

**1. `drop_watchlists` — Davin's live decision, quoted verbatim:**

> "drop_watchlists: (b) Strip-and-orphan. Do not execute the drop. Remove the
> 20260706000000_drop_watchlists migration from the directory entirely and never
> mark it applied. Leave the tables permanently orphaned."

Executed exactly as instructed: the migration folder was `git rm`'d, never
`resolve --applied`, `Watchlist`/`WatchlistItem` were never touched (no DROP TABLE
ever ran against them). The row-count re-check in the entry criteria was explicitly
waived by Davin as moot under this option: "Skip it. Since we are taking option (b)
and leaving the tables alone, the row count is irrelevant."

**2. Staging-waiver — quoted verbatim:** "Staging-waiver: I explicitly waive the
staging requirement for this session. You are authorized to proceed with production
writes." No staging environment exists (Phase 0's CC-A gap, still open); this
session's Step 2/Step 3 production writes proceeded without a staging rehearsal on
that explicit basis, same pattern as Session 2-1.

**3. Two independent migration histories — abandoned, single shared history kept
instead. This is the significant deviation from the PRE-DRAFT's plan.** CONFIRM's
research (the order's own open technical question) found:

- Prisma 7's `--schema` CLI flag does not carry its own migrations directory — that
  path comes exclusively from `prisma.config.ts`'s singular `migrations.path`. Only
  one `prisma.config.ts` exists in the repo, hardcoded to `prisma/migrations`.
  Empirically confirmed: `prisma migrate status --schema=prisma/market-data/schema.prisma`
  still read from `prisma/migrations`, not a market-data-specific folder.
- Building the originally-scoped mechanism would have required creating two new
  `prisma.config.ts`-equivalent files (via `--config=`), each with its own `schema`
  and `migrations.path` — infrastructure that doesn't exist yet, PRE-DRAFT-scoped
  but not actually specified in enough detail to build blind.
- Even after building that, Prisma's `_prisma_migrations` metadata table name isn't
  configurable per-schema in this version. Two independent histories against the
  same database/`public` schema would very likely share **one** metadata table, and
  each config's `migrate status`/`deploy` only sees its own local migrations folder
  — meaning each would likely report the other's applied rows as "in the table but
  not found locally." Whether that's cosmetic or genuinely breaks `deploy` was
  untestable safely: no staging environment exists to rehearse it (Phase 0 CC-A gap).
- Davin's own follow-on point sharpened this further, quoted verbatim: "Because
  Prisma does not support custom `_prisma_migrations` tables, and running migrations
  from a partial schema against a shared DB will generate destructive drops for the
  other schema's tables, we must deviate from the plan." This is exactly correct —
  confirmed independently below.

**Decision (Davin's, quoted verbatim):** "Do not create separate migration
histories for the two new schemas. We will retain the single, original
prisma/migrations folder as our sole source of truth for database migrations until
the databases are physically split. For Step 2, baseline the 5 remaining migrations
using the original history folder. For Step 3, you must apply the FK drop by
creating the new migration inside the original shared prisma/migrations folder."

**Executed as:** Step 2 baselined all 5 remaining migrations (all `resolve
--applied`, zero SQL executed, since production's live schema already matched
their end-state) via the single `prisma/migrations/` folder — commit `2aca8b00`.

**4. Step 3's mechanism further deviates from the order's literal command** (a
consequence of deviation #3, not a separate decision — flagged for transparency).
The order's Ordered Steps literally said to run
`prisma migrate dev --schema=prisma/non-market-data/schema.prisma --name
drop_money_user_fk_constraints`. This was **not run**. `migrate dev` rebuilds a
shadow database from the full shared migration history and diffs it against
whichever single schema file is passed — since `prisma/non-market-data/schema.prisma`
does not declare `MarketDataV6` (that model lives only in the sibling
`prisma/market-data/schema.prisma`), this diff would have proposed `DROP TABLE
"market_data_v6"` alongside the intended FK drops. This is precisely the failure
mode Davin's point 4 above describes.

Instead: the 4 FK constraint names (`Subscription_userId_fkey`, `Payment_userId_fkey`,
`FraudAlert_userId_fkey`, `AffiliateProfile_userId_fkey`) were confirmed directly
from `prisma/migrations/20251227000000_init/migration.sql`'s `ADD CONSTRAINT`
statements (read in full per L16 before any baselining), and the migration file was
hand-written with exactly 4 `ALTER TABLE ... DROP CONSTRAINT ...` statements —
matching the order's own "must be 4 ALTER TABLE ... DROP CONSTRAINT ... statements,
nothing else" parity check, achieved via a safer path than the literal instruction.
Placed inside the shared `prisma/migrations/` folder as instructed, applied via
`prisma migrate deploy` (which applies pending SQL files in timestamp order with no
shadow-DB diffing involved — the mechanism that made this safe). Commit `1c3179fb`.

**5. Consequence for Session 2-4 (next session, not this one):** the "two schema
files, two migration histories" architecture originally implied by Phase 2's plan is
now "two schema files (for separate Prisma Client generation/type boundaries), one
shared migration history" until a future, not-yet-scheduled physical database split.
Session 2-4's scope (repoint 16 consumer imports) is unaffected by this — it was
never going to touch migration history — but the plan document (`monolith-to-
microservices-migration-implementation-plan.md`) should be updated to reflect this
constraint before any future session assumes the two-history model is real.

## Known wrinkles / do-not-touch

- `railway-gateway/prisma/schema.prisma`'s `MarketDataV6` mirror is untouched by this
  session (no market-data changes here at all).
- `lib/api/index.ts` — known-broken by design, Phase 7's problem, not this session's.
- The account-deletion GDPR gap found above is flagged as a separate background item
  — do not fix it as part of this session (scope discipline); it's independent of
  the FK audit even though it was found while researching cascade-delete usage.
- Do not let "Session 2-2's `RefreshToken` stub only has 4 fields" tempt an expansion
  here — F6/F7 (auth strategy) still own that model's real shape, due Session 3-1.

## Next-session handoff

_Session 2-4 — Rewire the monolith (repoint imports, retire old schema)._ PRE-DRAFTed
already: `docs/migration-orders/2-4-rewire-monolith-cutover.migration-order.md`.
Depends on this session's FK-audit output (Session 2-4's consumer-repointing step
must adapt any `.user` relation include on `Payment`/`Subscription`/`FraudAlert`/
`AffiliateProfile` that this session's Step 3 removes).
