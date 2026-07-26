# Migration Order — INFRA variant (+ PORT rules)

> For sessions that **provision or configure live systems**: databases, roles, PgBouncer,
> Railway services, staging environments, CI pipelines, Redis/queues. Read
> `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium** (the approach is
> flexible; the end-state, grants, and names are fixed by the plan/design doc). PORT rules apply
> to the schema-authoring step: the 5 new models + enum value are copied from
> `01-part-19.5-wise-disbursement-architecture-design.md` §4 verbatim, not redesigned.

**Session:** 4A-W2 · **Variant:** INFRA + PORT · **Status:** PRE-DRAFT
**Generated:** 2026-07-26 (Executor, at 4A-W1's close) · **Flags touched:** F38 (resolve — fee
bearer determines whether `feeBearer`/`feeAmount` semantics are per-transfer or global)
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 2 of 8
**Target service:** monolith (`prisma/non-market-data/schema.prisma`, sole migration author, L1) +
money-service (`prisma/schema.prisma`, hand-mirrored subset, `prisma generate` only)
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md`
§4 "4A-W2 — Additive schema migration", cross-checked against
`01-part-19.5-wise-disbursement-architecture-design.md` §4 (the actual model definitions) and
`06-part-19.5-file-inventory-PLANNED.md` §7 (expected DB objects).

---

## Why this session, why now

4A-W1 (CONFIRMED, executed 2026-07-26) resolved the two commercial flags that shape this schema
(F36 → Model A, F37 → `MANUAL` funding) and froze the OpenAPI contract + the Wise-state mapping
table that this schema exists to serve. Every later Part 19.5 session (W3 onward) writes to the 5
new tables this session creates — doing the additive migration alone, in its own session, keeps
the highest-consequence step (a Prisma migration against the shared production DB) isolated and
independently revertable, per `04-…plan.md` §2.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] 4A-W1 closed CONFIRMED; F36/F37 resolved (both true as of 4A-W1's close — Model A / `MANUAL`).
- [ ] A fresh production DB backup exists, or Railway's backup cadence is confirmed. **F18's known
      gap** (RPO backup-cadence never verified via CLI — dashboard-only) — state it at CONFIRM,
      don't attempt to fix it in this session.
- [ ] `prisma migrate status` against the shared production DB is clean, run **from the monolith
      only** — never from money-service (`LESSONS-LEARNED.md` L1).
- [ ] Davin present — this is a production schema change (`EXECUTOR-PROTOCOL.md` §7).
- [ ] Blast-radius statement: this migration is purely additive (5 new tables + one new enum
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
`01-part-19.5-wise-disbursement-architecture-design.md` §4.1–4.2: the `DisbursementProvider` enum
gets a `WISE` value (`RISE` stays, now commented `// ARCHIVED 2026-07-25 (Part 19.5, F42)`);
`DisbursementTransaction`/`PaymentBatch`/`AffiliateProfile` each get one new back-relation field
(no new column); 5 new models (`AffiliateWiseRecipient`, `WiseTransfer`, `WiseBatchGroup`,
`WiseWebhookEvent`, `WiseWebhookSubscription`) with their enums (`WiseRecipientStatus`,
`WiseBatchGroupStatus`, `WiseFundingSource`). Nothing else in the file changes.
_Verify:_ `prisma validate --schema=prisma/non-market-data/schema.prisma` passes; `git diff`
shows only additions (no line in the existing 1023 removed or altered, only enum value + 3
back-relation lines + new blocks appended).
_Rollback:_ discard the uncommitted schema edit; nothing has touched the database yet.

### 2. Generate and hand-read the migration SQL — **do not apply yet**

`prisma migrate dev --create-only --schema=prisma/non-market-data/schema.prisma`. **Read the
generated SQL by eye before doing anything else.** It must contain only `CREATE TABLE` ×5,
`CREATE INDEX` ×n, and `ALTER TYPE "DisbursementProvider" ADD VALUE 'WISE'`.
_Verify:_ grep the generated `.sql` file for `DROP`, `ALTER COLUMN`, `RENAME` — zero matches. Any
match aborts the session and escalates to Davin/Advisor rather than proceeding.
_Rollback:_ delete the generated migration folder; nothing applied to any database yet.

### 3. Apply to production — Davin present

Apply the migration against the shared production Postgres (`EXECUTOR-PROTOCOL.md` §7 — schema +
money, Davin must be present for this specific step).
_Verify:_ `prisma migrate status` clean immediately after; a read-only query confirms all 5 tables

- the new enum value exist; row counts on every pre-existing table unchanged (before/after
  `SELECT count(*)` on `AffiliateRiseAccount`, `RiseWorksWebhookEvent`, `DisbursementTransaction`,
  `PaymentBatch`, `AffiliateProfile` — must be identical).
  _Rollback:_ `DROP TABLE` the 5 new tables, in FK-dependency order (`WiseTransfer` before
  `AffiliateWiseRecipient`/`WiseBatchGroup`; `WiseWebhookSubscription`/`WiseWebhookEvent` have no
  inbound FKs). **Cannot** drop the `WISE` enum value if any row already used it — leave it in
  place if so (inert, per design §12).

### 4. Hand-mirror the subset into money-service — `prisma generate` only

Mirror the 5 new models + enum value into `money-service/prisma/schema.prisma` (583 lines) as a
**subset**, following that file's own existing conventions (narrow relations — only what
money-service code actually traverses). Run `prisma generate` **only** — never `db push` or
`migrate deploy` from money-service (`LESSONS-LEARNED.md` L1; this is the single most important
rule in this session).
_Verify:_ `money-service` builds (`npm run build` in that workspace); the generated Prisma Client
types include the 5 new models.
_Rollback:_ revert the schema-subset edit + regenerate; no database action involved in this step.

### 5. Grant check — prove, don't assume

Confirm the `money_svc` role can `SELECT`/`INSERT`/`UPDATE` all 5 new tables (blueprint §5.1). New
tables do **not** inherit grants automatically unless default privileges were set when the role
was created — **this is the most likely silent failure of this session** per the risk register
(`04-…plan.md` §5).
_Verify:_ as `money_svc` (or the pooled connection money-service actually uses), run one real
`INSERT`/`SELECT`/`UPDATE`/`DELETE` against each of the 5 new tables (throwaway row, cleaned up
after) — not a grant listing alone, which can lie by omission.
_Rollback:_ `GRANT` the missing privileges explicitly if the check fails; re-verify.

### 6. Audit `amountRiseUnits`/`payeeRiseId` readers for null-tolerance

Re-confirm design §3.5(b)'s finding still holds against the live tree:
`report-builder.service.ts`, `admin-affiliate-reports.controller.ts`, and the admin transaction
pages already handle `null` correctly (per 4A-W1's design-doc read). This step is a
**verification**, not new code — no reader should need editing yet (the actual `affiliateId`
empty-string bug, design §3.5(a), is fixed in **4A-W6**, not here).
_Verify:_ cite the exact lines re-checked; note any drift from the design doc's claim.

### 7. Add archived-block schema comments

From `03-riseworks-archive-and-restore-runbook.md` §2.3 — comment-only annotations on the
RiseWorks-related models/fields in `prisma/non-market-data/schema.prisma`, marking them archived
context. **No migration** — comments do not require a schema change to apply.
_Verify:_ `prisma validate` still passes after adding comments (comments are inert to Prisma).

### 8. Full suite both sides; update artefacts; PRE-DRAFT W3

Run the monolith's `tsc --noEmit` + `eslint --max-warnings 0` + relevant test suites (per
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

- [ ] Migration applied; `prisma migrate status` clean; 5 tables + the `WISE` enum value exist in
      production.
- [ ] `money_svc` proved (by real query, not grant listing) to `SELECT`/`INSERT`/`UPDATE` all 5 new
      tables.
- [ ] `money-service` builds; `prisma generate` output includes the 5 new models.
- [ ] Pre-existing tables' row counts unchanged (recorded in Deviations, before/after).
- [ ] Monolith `tsc --noEmit` + `eslint --max-warnings 0` + test suites green; money-service
      `lint`+`test` green.
- [ ] F38 resolved (fee bearer + quote amount direction) with a `DECISION-LOG.md` entry.
- [ ] CLAUDE.md, DECISION-LOG.md, `migration-stack-analysis.md` updated.
- [ ] `4a-w3-…migration-order.md` exists at status `PRE-DRAFT`.

---

## Rollback

Revert the migration: `DROP TABLE` the 5 new tables (FK-safe order, see Step 3). The `WISE` enum
value cannot be dropped once used by any row — leave it in place if so; it is inert. No existing
table, row, or RiseWorks data is touched at any point in this session (F42 invariant — see
`01-…design.md` §1.2, I2).

---

## Deviations

_(filled DURING execution — what / why / impact.)_

**Carried forward from 4A-W1's close, expected to be re-stated here if still true at this
session's own CONFIRM:**

- THB cannot be tested end-to-end in Wise's sandbox (UK-region, GBP/USD/EUR only) — does not block
  this session (no Wise API calls happen here), but re-state for continuity into W3.

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
- _The THB sandbox limitation, still carried forward._
