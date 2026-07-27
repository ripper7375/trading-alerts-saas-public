# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session. Read `00-SKELETON-AND-RULES.md` first —
> §4 applies with the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT.
> Fast-path enabled: `PRE-DRAFT → APPROVED → CONFIRMED`.

**Session:** 4A-10b (CUTOVER) · **Variant:** VERIFY-RETIRE · **Status:** APPROVED
**Generated:** 2026-07-27 (Advisor) · **Estimated time:** <1h
**Phase / plan section:** Phase 4A — money-service · Slice 4 Cutover (Write APIs)
**Ground truth:** `4a-9-money-service-write-apis-port.migration-order.md`, `4a-10a-money-service-write-transport.migration-order.md`, `migration-cutover-table.md` (Slice 4).
**Flags touched:** `MIGRATE_WRITE_APIS_MONEY_STRIPE`, `MIGRATE_WRITE_APIS_MONEY_DLOCAL`, `MIGRATE_WRITE_APIS_MONEY_ADMIN`, `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT`
**Contract:** Zero code edits in this session — feature flag flips only, executed per-endpoint-group with Davin present.

---

## Pre-Cutover Manual Verification Requirements (Staging & Sandbox)

Before flipping any production feature flag, execute the following manual smoke tests in Staging / Sandbox to verify end-to-end correctness:

1. **Stripe Checkout Smoke Test:**
   - In Staging, set `MIGRATE_WRITE_APIS_MONEY_STRIPE=true`.
   - Issue POST request to `/api/checkout` with test user JWT.
   - Verify `200` response returning `{ sessionId: "cs_test_...", url: "https://checkout.stripe.com/..." }`.
   - Re-send request with identical `Idempotency-Key` header and verify cached response returned without duplicate Stripe session creation.

2. **dLocal Payment Creation Smoke Test:**
   - In Staging, set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` (`DLOCAL_API_URL=sandbox`).
   - Issue POST request to `/api/payments/dlocal/create` with test payload.
   - Verify `200` response with dLocal sandbox redirect URL, `Payment` row creation in DB, and that duplicate submit within 30s is rejected by `acquireCreatePaymentLock`.

3. **Admin Code Distribution Smoke Test:**
   - In Staging, set `MIGRATE_WRITE_APIS_MONEY_ADMIN=true`.
   - Issue POST request to `/api/admin/affiliates/[id]/distribute-codes` with admin session.
   - Verify `200` success, `AffiliateBonusCode` batch row created, and `OutboxEvent({ eventType: 'CODES_DISTRIBUTED' })` written to DB.

4. **Disbursement Batch Execution Smoke Test:**
   - In Staging, set `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT=true` (`DISBURSEMENT_PROVIDER=MOCK`).
   - Execute a test payout batch via `/api/disbursement/batches/[batchId]/execute`.
   - Verify `200` result, batch status transition to `COMPLETED`/`PROCESSING`, and unique constraint enforcement on `commissionId`.

5. **Rollback Rehearsal:**
   - Flip flag back `true -> false` in Staging and verify requests immediately route back to monolith handlers with 0ms delay.

---

## Entry criteria

- [ ] Session 4A-10a (Monolith Write Transport Build) CONFIRMED and closed.
- [ ] 48h code-freeze soak window elapsed clean (Started: 2026-07-27 12:52 UTC · Ends: 2026-07-29 12:52 UTC).
- [ ] Monolith source files (`app/api/checkout/route.ts`, `app/api/payments/dlocal/create/route.ts`, `app/api/subscription/cancel/route.ts`, `app/api/admin/affiliates/[id]/distribute-codes/route.ts`, `app/api/disbursement/batches/[batchId]/execute/route.ts`) verified CC-F (change-frozen).
- [ ] Staging / Sandbox manual smoke tests executed and 100% green per checklist above.
- [ ] Davin present for live cutover authorization.

---

## Checklist (CUTOVER block)

1. **Review 48h Soak & Staging Test Results:** Confirm zero errors across staging smoke tests and clean `money-service` production health logs.
2. **Davin Live Approval:** Davin explicitly approves flipping traffic for each endpoint group:
   - Group A: `MIGRATE_WRITE_APIS_MONEY_STRIPE=true`
   - Group B: `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`
   - Group C: `MIGRATE_WRITE_APIS_MONEY_ADMIN=true`
   - Group D: `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT=true`
3. **Flip Feature Flags:** Apply env variable flags in Railway production environment one group at a time.
4. **Monitor Health:** Observe Railway logs and error rate for 15 minutes per group. (Note: Transactional emails emit `OutboxEvent`s to `operation-service` following dLocal 4A-5 precedent; Slice 5 / 4A-11 delivers email worker).
5. **Update Artifacts:** Update `migration-cutover-table.md` (Slice 4 → CUTOVER), `CLAUDE.md`, and `DECISION-LOG.md`.

- **Rollback:** Revert feature flags to `false` in Railway dashboard (0ms traffic revert back to monolith handlers).

---

## Rules specific to this variant

- No new code edits, no refactoring, no fixes. Observation and execution only.
- Any red result or unexplained error = abort immediately, revert flag, schedule investigation.

---

## Deviations

_(should normally be empty)_

---

## Next-session handoff

PRE-DRAFT Session 4A-11 (Slice 5 / Outbox Email Worker Build).
