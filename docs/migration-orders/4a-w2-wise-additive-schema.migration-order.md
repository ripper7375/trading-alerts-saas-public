# Migration Order — INFRA variant (+ PORT rules)

> For sessions that **provision or configure live systems**: databases, roles, PgBouncer,
> Railway services, staging environments, CI pipelines, Redis/queues. Read
> `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium** (the approach is
> flexible; the end-state, grants, and names are fixed by the plan/design doc). PORT rules apply
> to the schema-authoring step: the 5 new models + enum value are copied from
> `01-part-19.5-wise-disbursement-architecture-design.md` §4 verbatim, not redesigned.

**Session:** 4A-W2 · **Variant:** INFRA + PORT · **Status:** CONFIRMED
**Generated:** 2026-07-26 (Advisor) · **Estimated time:** ~2h
**Flags touched:** **F38** (resolve — fee bearer + quote amount direction determines semantics of `WiseTransfer.feeBearer`/`feeAmount`)
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 2 of 8
**Target service:** monolith (`prisma/non-market-data/schema.prisma`, sole migration author, L1) +
money-service (`prisma/schema.prisma`, hand-mirrored subset, `prisma generate` only)
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md`
§4 "4A-W2 — Additive schema migration", cross-checked against
`01-part-19.5-wise-disbursement-architecture-design.md` §4 (the actual model definitions) and
`06-part-19.5-file-inventory-PLANNED.md` §7 (expected DB objects).

---

## Why this session, why now

4A-W1 (APPROVED / CONFIRMED, executed 2026-07-26) resolved the commercial flags shaping this schema
(F36 → Model A, F37 → `MANUAL` funding mode) and froze the OpenAPI contract + the Wise-state mapping
table that this schema exists to serve. Every downstream Part 19.5 session (W3 onward) writes to the
5 new tables this session creates — doing the additive migration alone, in its own session, keeps the
highest-consequence step (a Prisma migration against the shared production DB) isolated and
independently revertable, per `04-…plan.md` §2.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [x] **Session 4A-W1 is closed CONFIRMED**; F36/F37 resolved (both confirmed in 4A-W1 — Model A / `MANUAL`).
- [x] A fresh production DB backup exists, or Railway's backup cadence is confirmed. **F18's known
      gap** (RPO backup-cadence never verified via CLI — dashboard-only) — stated at CONFIRM,
      unresolved, not fixed in this session (unchanged standing gap, non-blocking per prior sessions).
- [x] `prisma migrate status` against the shared production DB is clean, run **from the monolith
      only** — never from money-service (`LESSONS-LEARNED.md` L1). Verified via `DIRECT_URL`
      (confirmed the real production connection, see Deviations).
- [x] **Davin present** — this is a production schema change (`EXECUTOR-PROTOCOL.md` §7).
- [x] Codebase claims in the design doc hold against the live tree:
      `prisma/non-market-data/schema.prisma` (1023 lines),
      `money-service/prisma/schema.prisma` (583 lines).
- [x] **Blast-radius statement:** this migration is purely additive (5 new tables + one new enum
      value + 3 back-relations on existing models). Worst case if something goes wrong: the new
      tables fail to create (no data loss on existing tables) or a back-relation is malformed
      (caught by `prisma validate` before it ever reaches production). The one irreversible
      element is the enum value: Postgres cannot `DROP` an enum value once any row uses it — if
      this session needs to roll back after any `WISE`-provider row exists, the value must be left
      in place (harmless, per `01-…design.md` §12).

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Ordered steps

_(each step = change → immediate verification → rollback note)_

### 1. Author the 5 new models + `WISE` enum value + 3 back-relations

In **`prisma/non-market-data/schema.prisma`** (1023 lines) only. Copy verbatim from
`01-part-19.5-wise-disbursement-architecture-design.md` §4.1–4.2:

- The `DisbursementProvider` enum gets a `WISE` value (`RISE` stays, commented `// ARCHIVED 2026-07-25 (Part 19.5, F42)`);
- `DisbursementTransaction`, `PaymentBatch`, `AffiliateProfile` each get one new back-relation field (no new database column);
- 5 new models (`AffiliateWiseRecipient`, `WiseTransfer`, `WiseBatchGroup`, `WiseWebhookEvent`, `WiseWebhookSubscription`) with their enums (`WiseRecipientStatus`, `WiseBatchGroupStatus`, `WiseFundingSource`).

Nothing else in the file changes.
_Verify:_ `npx prisma validate --schema=prisma/non-market-data/schema.prisma` passes; `git diff`
shows only additions (no line in the existing 1023 lines removed or altered, only enum value + 3
back-relation lines + new model blocks appended).
_Rollback:_ discard the uncommitted schema edit; nothing has touched the database yet.

### 2. Generate and hand-read the migration SQL — **do not apply yet**

Run from the repo root:
`npx prisma migrate dev --create-only --schema=prisma/non-market-data/schema.prisma --name wise_disbursement_additive`

**Read the generated SQL by eye before doing anything else.** It must contain ONLY:

- `CREATE TABLE` ×5
- `CREATE INDEX` ×n
- `ALTER TYPE "DisbursementProvider" ADD VALUE 'WISE'`

_Verify:_ Grep the generated `.sql` file for `DROP`, `ALTER COLUMN`, `RENAME` — **must return zero matches**. Any match aborts the session immediately and escalates to Davin/Advisor rather than proceeding.
_Rollback:_ delete the generated migration folder; nothing has been applied to any database yet.

### 3. Resolve F38 (fee bearer + quote amount direction) with Davin

Present F38 options from `05-artifact-amendments.md` §2b and `01-…` §4:

- Option A: Platform bears fee (`feeBearer = 'PLATFORM'`). Affiliate receives exact commission amount (`targetAmount`).
- Option B: Affiliate bears fee (`feeBearer = 'AFFILIATE'`). Fee deducted from payout amount (`sourceAmount`).

_Verify:_ `DECISION-LOG.md` entry recorded using the F38 block from `05-…` §2b with Davin's decision.

### 4. Apply to production — Davin present

Apply the migration against the shared production Postgres (`EXECUTOR-PROTOCOL.md` §7 — schema +
money, Davin must be present for this specific step):
`npx prisma migrate deploy --schema=prisma/non-market-data/schema.prisma`

_Verify:_ `npx prisma migrate status` clean immediately after; a read-only query confirms all 5 tables
and the new enum value exist; row counts on pre-existing tables are unchanged (before/after
`SELECT count(*)` on `AffiliateRiseAccount`, `RiseWorksWebhookEvent`, `DisbursementTransaction`,
`PaymentBatch`, `AffiliateProfile` — recorded in Deviations, must be identical).
_Rollback:_ `DROP TABLE` the 5 new tables in FK-dependency order (`WiseTransfer` before
`AffiliateWiseRecipient`/`WiseBatchGroup`; `WiseWebhookSubscription`/`WiseWebhookEvent` have no
inbound FKs). **Cannot** drop the `WISE` enum value if any row already used it — leave it in
place if so (inert, per design §12).

### 5. Hand-mirror the subset into money-service — `prisma generate` ONLY

Mirror the 5 new models + enum values into **`money-service/prisma/schema.prisma`** (583 lines) as a
**subset**, following that file's own existing conventions (narrow relations — only what
money-service code actually traverses per L24). Run `prisma generate` **ONLY** — never `db push` or
`migrate deploy` from money-service (`LESSONS-LEARNED.md` L1; this is the single most important
rule in this session).
_Verify:_ `money-service` builds (`npm run build` in `money-service` directory); the generated Prisma Client
types include the 5 new models.
_Rollback:_ revert the schema-subset edit + regenerate; no database action involved in this step.

### 6. Grant check — prove with real queries, don't assume

Confirm the `money_svc` role can `SELECT`/`INSERT`/`UPDATE`/`DELETE` all 5 new tables (blueprint §5.1). New
tables do **not** inherit grants automatically unless default privileges were set when the role
was created — **this is the most likely silent failure of this session** per the risk register
(`04-…plan.md` §5).
_Verify:_ As `money_svc` (or the pooled connection money-service actually uses), run one real
`INSERT`/`SELECT`/`UPDATE`/`DELETE` cycle against each of the 5 new tables using throwaway test rows (cleaned up
after) — **not a grant listing alone**, which can lie by omission.
_Rollback:_ `GRANT` the missing privileges explicitly if the check fails; re-verify.

### 7. Audit `amountRiseUnits`/`payeeRiseId` readers for null-tolerance

Re-confirm design §3.5(b)'s finding still holds against the live tree:
`report-builder.service.ts`, `admin-affiliate-reports.controller.ts`, and the admin transaction
pages already handle `null` correctly (per 4A-W1's design-doc read). This step is a
**verification**, not new code — no reader should need editing yet (the actual `affiliateId`
empty-string bug, design §3.5(a), is fixed in **4A-W6**, not here).
_Verify:_ cite the exact lines re-checked; note any drift from the design doc's claim.

### 8. Add archived-block schema comments

From `03-riseworks-archive-and-restore-runbook.md` §2.3 — comment-only annotations on the
RiseWorks-related models/fields in `prisma/non-market-data/schema.prisma`, marking them archived
context. **No migration** — comments do not require a schema change to apply.
_Verify:_ `npx prisma validate --schema=prisma/non-market-data/schema.prisma` still passes after adding comments (comments are inert to Prisma).

### 9. Full suite both sides; update artefacts; PRE-DRAFT W3

Run the monolith's `npx tsc --noEmit` + `npx eslint --max-warnings 0` + relevant test suites (per
`LESSONS-LEARNED.md` L20 — `validate:format`/`validate:policies` are not this repo's real green
bar on Windows) and money-service's own `lint`+`test` scripts. Update CLAUDE.md, DECISION-LOG.md
(F38), `migration-stack-analysis.md` (new models). PRE-DRAFT
`4a-w3-wise-recipient-onboarding.migration-order.md` (PORT for the backend + UI-BUILD for the
form), seeded from `04-…plan.md` §4 "4A-W3".

---

## Rules specific to this variant

- **Nothing dashboard-only.** The schema change is committed as `.prisma` source + a versioned
  migration folder — never applied ad hoc against production without a corresponding commit.
- Production changes only after `prisma validate` and the hand-read SQL check both pass — there is
  no staging Postgres to rehearse against (F34/CC-A gap, same constraint 4A-2/4A-3 operated under).
- **money-service never authors a migration** (L1) — `prisma generate` only, always.
- Secrets: none introduced this session (F38 is a data-shape decision, not a secret).

---

## Done when

- [x] Migration applied; `prisma migrate status` clean; 5 tables + the `WISE` enum value exist in
      production.
- [x] `money_svc` proved by real query (throwaway `INSERT`/`SELECT`/`UPDATE`/`DELETE`), not grant listing, to access all 5 new tables. (Initial check FAILED — zero grants; fixed live with Davin's approval, re-verified clean — see Deviations.)
- [x] `money-service` builds; `prisma generate` output includes the 5 new models; no `db push` or `migrate deploy` run from money-service (L1).
- [x] Generated SQL verified by eye: contains ONLY `CREATE TABLE`, `CREATE INDEX`, `ALTER TYPE ... ADD VALUE`; zero matches for `DROP`, `ALTER COLUMN`, or `RENAME`.
- [x] Pre-existing tables' row counts unchanged (recorded in Deviations, before/after).
- [x] Monolith `tsc --noEmit` + `eslint --max-warnings 0` + test suites green; money-service
      `test` green (no `lint` script exists in money-service — order text inaccuracy, see Deviations).
- [x] F38 resolved (fee bearer + quote amount direction) with a `DECISION-LOG.md` entry.
- [x] CLAUDE.md, DECISION-LOG.md, `migration-stack-analysis.md` updated.
- [x] `4a-w3-wise-recipient-onboarding.migration-order.md` exists at status `PRE-DRAFT`.

---

## Rollback

Revert the migration: `DROP TABLE` the 5 new tables (FK-safe order: `WiseTransfer` before `AffiliateWiseRecipient`/`WiseBatchGroup`; `WiseWebhookSubscription`/`WiseWebhookEvent` have no inbound FKs). The `WISE` enum value cannot be dropped once used by any row — leave it in place if so; it is inert. No existing table, row, or RiseWorks data is touched at any point in this session (F42 invariant — see `01-…design.md` §1.2, I2).

---

## Deviations

_(filled DURING execution — what / why / impact.)_

**Carried forward from 4A-W1's close, expected to be re-stated here if still true at this
session's own CONFIRM:**

- THB cannot be tested end-to-end in Wise's sandbox (UK-region, GBP/USD/EUR only) — does not block
  this session (no Wise API calls happen here), but re-state for continuity into W3.

**This session (CONFIRM time):**

- Order arrived with an uncommitted edit flipping `PRE-DRAFT` → `APPROVED` directly (no `DRAFT`
  stage ever committed, no approval commit trail) and, independently, all four of the order's own
  line-count entry-criteria numbers had shifted `+1` away from both the last committed version and
  the live codebase (`prisma/non-market-data/schema.prisma` 1023→1024,
  `money-service/prisma/schema.prisma` 583→584) — same shape as 4A-W1's own recurrence of
  `LESSONS-LEARNED.md` L11. Stopped and asked Davin live rather than trusting or silently
  correcting; Davin confirmed live it was his own intentional edit and asked for the four numbers
  to be corrected back to the live-tree values (done) while keeping `APPROVED`.

**This session (Step 2 — migration SQL generation):**

- The order's literal Step 2 command, `prisma migrate dev --create-only`, is **unsafe on this
  database** and must not be used again as written. `migrate dev` performs live drift detection
  (actual production schema vs. replaying the committed migration history) before it will generate
  anything; production has pre-existing drift **unrelated to this session's Wise changes**
  (`LoginStatus`/`SecurityAlertType` enums, `Drawing`/`DrawingAlert`/`login_history`/
  `security_alerts`/`user_sessions` tables, four `twoFactorX` columns on `User`, and orphaned
  legacy tables `Watchlist`/`WatchlistItem`/`market_data_v6`/`mt5_accounts`/etc. — all pre-dating
  this session, likely applied via `db push` or ad hoc SQL in past sessions rather than tracked
  migrations, compounded by no `SHADOW_DATABASE_URL` being configured anywhere). On hitting this
  drift, `migrate dev` printed **"We need to reset the 'public' schema... All data will be lost"**
  and only aborted (exit 130) because the confirmation prompt hit non-interactive stdin — it did
  not run to completion. No destructive action executed; verified directly via a real query against
  production immediately after (not just `migrate status`): `User` 7 rows, `Subscription` 1,
  `AffiliateProfile` 1 — all non-zero, all returned without error. Stopped, reported the near-miss
  in full to Davin, and got explicit go-ahead before touching the database connection again.
  **Fix:** used `prisma migrate diff --from-schema <pre-edit schema snapshot> --to-schema
prisma/non-market-data/schema.prisma --script` instead — a pure datamodel-to-datamodel diff that
  never connects to any database (live or shadow), so it can never propose a reset. Also note:
  Prisma 7's CLI flag names differ from the order's text — `--to-schema`, not
  `--to-schema-datamodel`; `migrate diff` does not accept a `--schema` flag at all. Output verified
  clean (232 lines: 3 `CreateEnum`, 1 `AlterEnum ADD VALUE`, 5 `CreateTable`, N `CreateIndex`, 5
  `AddForeignKey`; zero matches for `DROP`/`ALTER COLUMN`/`RENAME`) and written to
  `prisma/migrations/20260726000000_wise_disbursement_additive/migration.sql`. Nothing applied to
  any database. **This is a structural landmine worth a `LESSONS-LEARNED.md` entry at session
  close**: `prisma migrate dev` (in any form) must never be run against this production database
  again given the current drift — only `migrate diff` (schema-to-schema) or `migrate deploy`
  (apply-only, no drift check) are safe. Recorded as `LESSONS-LEARNED.md` L22.

**This session (post-SQL-generation, verifying against the wrong database):**

- After generating the SQL, ran a "did anything get lost" check via a script mirroring
  `lib/db/prisma.ts`'s own connection pattern (`DATABASE_URL`) — a reasonable-looking sanity
  check that was actually pointed at the wrong database. Applied the migration via
  `migrate deploy` against `DIRECT_URL` (per `prisma.config.ts`, the correct target for all
  CLI/migration operations), then re-verified via `DATABASE_URL` and found zero new tables —
  looked like the migration had silently failed. Compared connection hosts (redacted, no
  credentials ever printed): `DATABASE_URL` = `turntable.proxy.rlwy.net:55082`, `DIRECT_URL` =
  `maglev.proxy.rlwy.net:58290` — genuinely different databases (different `User`/`Subscription`
  row counts), not two proxy fronts to one instance. Stopped and asked Davin rather than
  guessing which was real production; confirmed live: `maglev`/`DIRECT_URL` is production,
  `turntable`/`DATABASE_URL` is this checkout's staging target. The migration had in fact landed
  correctly the first time — re-verified via `DIRECT_URL`: all 5 tables + `WISE` enum value
  present, pre-existing table row counts (`AffiliateRiseAccount` 0, `RiseWorksWebhookEvent` 1,
  `DisbursementTransaction` 0, `PaymentBatch` 0, `AffiliateProfile` 1) consistent with the
  additive-only SQL (zero `UPDATE`/`DELETE`/`ALTER TABLE` statements in the applied migration,
  so no pre-existing row could have been touched regardless). Recorded as a recurrence on
  `LESSONS-LEARNED.md` L19. **Evidence-gap disclosure (F42, `AffiliateRiseAccount` /
  `RiseWorksWebhookEvent` specifically):** the ONLY pre-migration count captured for these two
  tables used `DATABASE_URL` (staging) by mistake, before this session discovered the DB-identity
  split — there is no genuine pre-migration snapshot of these two tables from production. What
  exists instead: three independent post-migration reads from `DIRECT_URL` (immediately post-apply,
  after the Step 6 grant-check rollback, and once more at session close-out) all agreeing exactly
  (`AffiliateRiseAccount` 0, `RiseWorksWebhookEvent` 1), plus the structural proof that the applied
  SQL contains zero statements capable of touching either table. This is weaker than a true
  before/after pair — flagged explicitly rather than presented as equivalent to one.

**Step 3 (F38):**

- Davin resolved live: **Option A** — platform bears the fee (`feeBearer = 'PLATFORM'`),
  quotes taken by `targetAmount`, affiliate receives their exact earned commission with no
  deduction. No schema impact (`feeBearer` is already a free-text field, set by application code
  starting 4A-W4+, not by this migration). Full entry in `DECISION-LOG.md`.

**Step 6 (grant check):**

- First real-query attempt (`INSERT` into `AffiliateWiseRecipient` as `money_svc`, via
  `SET ROLE` from the production owner connection rather than the `money_svc` credential itself
  — which isn't available locally, set directly on Railway per money-service's own
  `.env.example`) failed: `permission denied for table AffiliateWiseRecipient`. Read-only
  `information_schema.role_table_grants` check confirmed `money_svc` had **zero** grants on all
  5 new tables, vs. the full standard set (`SELECT`/`INSERT`/`UPDATE`/`DELETE`/`REFERENCES`/
  `TRIGGER`/`TRUNCATE`) already present on `PaymentBatch`. Exactly the risk register's predicted
  "most likely silent failure of this session" (`04-…plan.md` §5). This is a role-grant change —
  escalated to Davin per `EXECUTOR-PROTOCOL.md` §7 rather than just applying the order's own
  suggested fix unilaterally; Davin approved the full privilege set (matching existing tables).
  `GRANT` applied, re-verified via the same real-query method (INSERT/SELECT/UPDATE/DELETE, all
  5 tables) — all passed. Entire check (parent-chain rows + the 5-table cycle) ran inside one
  transaction that was rolled back at the end regardless of outcome; confirmed zero residue via
  a post-check row count across every table touched.

**Step 7 (null-tolerance audit):**

- The order's own text named `report-builder.service.ts` and
  `admin-affiliate-reports.controller.ts` as files to re-check — neither file references
  `amountRiseUnits` or `payeeRiseId` at all (grepped, zero matches), and neither is cited in
  design §3.5(b) either (the order's own claimed source). Design §3.5(b) actually names 5
  different files: `transaction.service.ts`, `payment-orchestrator.service.ts`,
  `app/api/disbursement/batches/[batchId]/route.ts`,
  `app/(dashboard)/admin/disbursement/transactions/page.tsx`,
  `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx`. Verified all 5 against the
  live tree instead — all still null-safe, matching the design doc almost line-for-line, no
  reader needed editing. Bug (a) (`payment-orchestrator.service.ts:118`'s empty-string
  `affiliateId`/`riseId`) confirmed still present, correctly out of scope until 4A-W6.

**Step 9 (test suites):**

- The order's text said "money-service's own `lint`+`test` scripts" — `npm run` in
  money-service lists `build`/`start*`/`test*`/`prisma:generate` only; no `lint` script exists
  and no ESLint config/dependency is present in that package at all. Ran `test` only (24/24
  suites, 260/260 tests, all green) and `build` (clean).
- A first `eslint --max-warnings 0 .` invocation (my own command, not the order's) incorrectly
  scanned the entire repo tree — `e2e/archive/`, the separate `frontend-and-backend-python-stack/`
  (explicitly out of scope, CLAUDE.md §5 do-not-touch), and Next.js's own `.next/types` build
  output — producing 9534 unrelated pre-existing problems. Corrected to the project's own
  `validate:lint` scope (`eslint app components lib hooks --max-warnings 0`, per
  `LESSONS-LEARNED.md` L14): 0 errors, 0 warnings.
- Adding `WISE` to the `DisbursementProvider` enum surfaced one real `tsc --noEmit` error:
  `types/disbursement.ts`'s hand-written `DisbursementProvider` union (`'RISE' | 'MOCK'`) didn't
  include `'WISE'`, breaking `app/api/disbursement/batches/[batchId]/execute/route.ts`'s calls
  into `lib/disbursement/providers/provider-factory.ts`. Fixed by adding `'WISE'` to the union —
  confirmed safe first: both `isProviderAvailable()` and `createPaymentProvider()` already
  default to `false`/throw for any provider not explicitly `case`d, so this is a type-only,
  zero-behavior-change fix required directly by this session's own schema edit, not scope creep.
  Three other pre-existing hand-written `'RISE' | 'MOCK'` unions were found
  (`types/prisma-stubs.d.ts`, `money-service/src/disbursement/disbursement.types.ts`,
  `app/api/disbursement/transactions/route.ts`) but none currently cause a compile/build error,
  so none were touched (scope discipline — `frontend/`'s copies are out of scope entirely per
  CLAUDE.md §5).

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema and rows** — F42: archived, never deleted, never renamed. This
  session's only RiseWorks-adjacent action is the comment-only annotation in Step 7.
- **`prisma/market-data/schema.prisma`** — entirely out of scope; this session touches
  `non-market-data` only.
- **No new npm dependency** — nothing in this session needs one.

---

## Next-session handoff

_(PRE-DRAFT `4a-w3-wise-recipient-onboarding.migration-order.md` at this session's close —
variant `TEMPLATE-PORT.md` (backend) + `TEMPLATE-UI-BUILD.md` (form), seeded from
`04-rise-to-wise-migration-plan.md` §4 "4A-W3". Must carry, at minimum:_

- _F39 (who fills the recipient form) and F41 (PII retention) both need resolving with Davin._
- _The real THB account-requirements schema must be fetched from **production** (read-only, no
  money) as a committed fixture — sandbox cannot produce it._
- _Explicit body redaction for `POST /v1/accounts` — never log the `details` object (§7.4)._
- _`WISE_API_TOKEN` read-only is sufficient for this session; full access is not needed until W6._
- _The THB sandbox limitation, still carried forward.)_
