# RiseWorks — Archive & Restore Runbook

**Authority:** Davin, 2026-07-25 (flag **F42**, RESOLVED):

> "I want I keep Riseworks but make it inactive (achieve) but could be restored when needed"

**Therefore the governing rule of this runbook is a prohibition:**

> **Nothing RiseWorks-related is deleted.** No source file, no test, no Prisma model, no enum value,
> no database row, no admin page, no documentation. "Archived" here means **deactivated and clearly
> labelled**, never removed. If a step in any future order says "delete the Rise …", that step
> contradicts F42 — stop and ask Davin.

This is deliberately _not_ the `TEMPLATE-VERIFY-RETIRE.md` **RETIRE** pattern (which deletes source
after a stability window). Part 19.5 has no retire step for Rise.

---

## 1. What "inactive" must mean, concretely

Five independent kill-switches. Each is individually sufficient to stop RiseWorks from doing
anything; together they make accidental reactivation essentially impossible.

| #      | Switch                          | Mechanism                                                                                                                                                                                                      | Reverse                             |
| ------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **A1** | **No live route**               | remove `RiseworksModule` from `money-service/src/app.module.ts` `imports`                                                                                                                                      | re-add one import line              |
| **A2** | **No provider construction**    | `provider-factory.ts` throws `ArchivedProviderError` for `'RISE'` unless `ALLOW_ARCHIVED_PROVIDERS=true`                                                                                                       | set the env var                     |
| **A3** | **Not the default provider**    | `DISBURSEMENT_PROVIDER=WISE` on Railway                                                                                                                                                                        | set it back to `RISE`               |
| **A4** | **No inbound provider traffic** | RiseWorks dashboard webhook URL stays pointed at the monolith and receives nothing (there is no live Rise integration to point anywhere)                                                                       | repoint to `/v1/webhooks/riseworks` |
| **A5** | **No eligibility path**         | `commission-aggregator.service.ts` filters on `AffiliateWiseRecipient.status='ACTIVE'` when the provider is `WISE`; the `AffiliateRiseAccount` KYC filter is preserved but only reachable on the `RISE` branch | provider flip re-enables it         |

Note the pre-existing state that makes this easy: **`RisePaymentProvider` was never finished.**
`lib/disbursement/providers/rise/rise-provider.ts` (225 lines) throws
`"RiseWorks sendPayment API integration coming in Part 19B"` from `sendPayment`,
`sendBatchPayment`, `getPaymentStatus` and `getPayeeInfo`; `siwe-auth.ts` (155 lines) is a
placeholder; and `provider-factory.ts` already throws for `'RISE'` and already returns
`isProviderAvailable('RISE') === false`. RiseWorks has therefore **never moved money in
production**. Archiving it removes a capability that was never live.

---

## 2. Archive checklist (session 4A-W8)

> **Rev 2 (2026-07-25, per `07-…` P4):** only **A3** — the `DISBURSEMENT_PROVIDER=MOCK→WISE` env
> flip, which _is_ the cutover mechanism — happens in `4A-W7`. **A1 and A2 are code changes and
> move here, to W8**, because `TEMPLATE-VERIFY-RETIRE.md` forbids code in a cutover session at dial
> near-zero. Consequence, and why it is harmless: between W7 and W8 both webhook routes stay
> registered, so `/v1/webhooks/riseworks` answers **401** to unsigned requests rather than 404 —
> but nothing points at it, RiseWorks has never sent it a single production request, and
> `RisePaymentProvider` cannot send a payment even if constructed. Zero traffic, zero risk, and the
> dormancy verification (§3) then all happens in one place where it can be evidenced properly.

### 2.1 money-service — deactivate, do not delete

- [ ] `money-service/src/app.module.ts` (75 lines): remove `RiseworksModule` from `imports` and
      remove its `import` line. **Replace with a comment**, not silence:
      `ts
    // Session 4A-W7 (Part 19.5, F42): RiseworksModule is ARCHIVED — deliberately NOT
    // imported, so /v1/webhooks/riseworks is not registered. Files remain on disk and
    // the DB tables/rows remain untouched. To restore: re-add the import + this entry,
    // set ALLOW_ARCHIVED_PROVIDERS=true and DISBURSEMENT_PROVIDER=RISE.
    // See docs/migration-orders/replace-rise-with-wise/03-riseworks-archive-and-restore-runbook.md
    // import { RiseworksModule } from './riseworks/riseworks.module';
    `
- [ ] `money-service/src/riseworks/riseworks-webhook.controller.ts` (186 lines),
      `riseworks.module.ts` (21 lines): **unchanged**, except an `ARCHIVED` banner appended to the
      existing file-header docblock. No logic edits.
- [ ] `money-service/src/disbursement/providers/rise/webhook-verifier.ts` (161 lines) and its
      `.spec.ts`: **unchanged** + banner. The spec must keep passing — it is the proof the archived
      code still works if restored.
- [ ] `money-service/src/disbursement/providers/provider-factory.ts` (105 lines): add
      `ARCHIVED_PROVIDERS`, an `ArchivedProviderError`, and the `ALLOW_ARCHIVED_PROVIDERS` gate.
      Keep the existing `case 'RISE'` block reachable behind the gate — do not replace its body.
- [ ] `money-service/src/disbursement/disbursement.constants.ts` (162 lines): `RISE_API_URLS`,
      `RISE_AMOUNT_FACTOR`, `usdToRiseUnits`, `riseUnitsToUsd`, `WEBHOOK_EVENT_TYPES` all stay.
      Add `WISE` to `SUPPORTED_PROVIDERS` and add `export const ARCHIVED_PROVIDERS = ['RISE'] as const;`
- [ ] `money-service/src/disbursement/disbursement.types.ts` (168 lines): `RiseWorksKycStatus`,
      `RiseWorksApiConfig`, `RiseWorksPayee`, `RiseWorksPayment`, `RiseWorksBatchPaymentRequest`,
      `RiseWorksWebhookPayload`, `PayableAffiliate.riseAccount` — **all retained**. Wise types are
      appended below them.
- [ ] `webhook-event-processor.service.ts` (288 lines): **unchanged.** It handles Rise's
      `payment.completed` / `payment.failed` / `invite.accepted`. Wise gets its own reducer
      (`wise-transfer-state.reducer.ts`); the two never share a code path.

### 2.2 Monolith (Next.js) — deactivate, do not delete

The monolith's Rise surface is larger and is **already** slated for retirement by the normal
migration flow (Slice 3/4 retire sessions). Part 19.5 does **not** accelerate that. Only these
markers are added:

- [ ] `lib/disbursement/providers/rise/` — `rise-provider.ts` (225), `siwe-auth.ts` (155),
      `webhook-verifier.ts` (160), `amount-converter.ts` (110): `ARCHIVED (Part 19.5, F42)` banner
      appended to each file header. **No code changes.**
- [ ] `app/api/webhooks/riseworks/route.ts` (174 lines): banner only. Leave the route deployed and
      responding — it is unreachable in practice (nothing points at it) and deleting it is a
      Slice-2 retire decision, not this runbook's.
- [ ] `app/api/disbursement/riseworks/accounts/route.ts` (257), `…/sync/route.ts` (119),
      `app/api/cron/sync-riseworks-accounts/route.ts` (86): banner only.
      ⚠️ **`sync-riseworks-accounts` is one of the 8 crons already CUT-OVER to money-service in
      Session 4A-3.** It runs on money-service's scheduler. Since `RisePaymentProvider.getPayeeInfo`
      throws, the job is already a no-op-with-error. **Archive step:** make its money-service
      counterpart short-circuit with a clear `ARCHIVED — skipping` log line instead of throwing,
      so the archived provider stops generating error noise in Railway logs.
      **Do not delete the job or change its cron expression (I5).**
- [ ] `app/(dashboard)/admin/disbursement/accounts/page.tsx`: gate the whole page behind
      `NEXT_PUBLIC_SHOW_ARCHIVED_DISBURSEMENT_UI === 'true'`; when off, render a short notice
      linking to `/admin/disbursement/recipients`. **File kept.**
- [ ] `app/(dashboard)/admin/disbursement/layout.tsx`: nav item "Accounts (RiseWorks)" hidden under
      the same flag; add "Recipients (Wise)". Remove RiseWorks branding text from the header.
- [ ] `app/(dashboard)/admin/disbursement/config/page.tsx`: the provider dropdown shows `RISE` as
      **disabled, labelled "archived"** — not removed from the options list.

### 2.3 Database — retain everything

- [ ] `AffiliateRiseAccount`, `RiseWorksWebhookEvent`, `RiseWorksKycStatus`,
      `DisbursementTransaction.amountRiseUnits`, `DisbursementTransaction.payeeRiseId`,
      `DisbursementProvider.RISE`: **no migration touches any of these.** The Part 19.5 migration is
      additive only (5 new tables + 1 new enum value).
- [ ] Add schema **comments** marking the Rise block as archived, in both
      `prisma/non-market-data/schema.prisma` (line ~660, the
      `// RISEWORKS DISBURSEMENT SYSTEM (Part 19)` banner) and the mirrored subset in
      `money-service/prisma/schema.prisma`. Comment-only changes produce **no** migration.
      `prisma
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RISEWORKS DISBURSEMENT SYSTEM (Part 19) — ARCHIVED 2026-07-25 (Part 19.5, F42)
    // Provider deactivated, NOT removed. Tables, rows, enum value and relations are
    // retained verbatim so RiseWorks can be restored. Superseded by the WISE* models
    // below. Do not drop, rename or backfill anything in this block.
    //━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `
- [ ] **Row retention: indefinite.** No purge job, no anonymisation pass. (If GDPR/PDPA later
      forces a decision about `AffiliateRiseAccount.email`, that belongs to flag **F21**/**F41**,
      not here.)

### 2.4 Documentation & inventories

- [ ] `riseworks/ARCHIVED.md` — new file at the top of the `riseworks/` tree stating the archive
      date, the authority (F42), the restore pointer, and an explicit "nothing here was deleted".
- [ ] `riseworks/Part-19/**` and `riseworks/Archive/**`: **left in place.** (Moving `Part-19/` into
      `Archive/` would churn paths referenced by four inventory files for no benefit.)
- [ ] `docs/files-completion-list/files-inventory/part19{a,b,c,d}-files-completion.md`: append the
      supersession note from `05-artifact-amendments.md` §6. Do not edit their existing tables —
      they are historical records of what Part 19 completed, and that remains true.
- [ ] `docs/migration-orders/4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md`:
      set header status to **REVOKED** with the reason and date. **Keep the file** (order files are
      the audit trail).
- [ ] `docs/migration-orders/migration-stack-analysis.md`: mark the Rise entries `ARCHIVED (Part 19.5)`
      rather than deleting them; add the new `src/wise/**` entries.

### 2.5 Secrets

- [ ] `RISE_WEBHOOK_SECRET` — was **never set** on Railway production (CLAUDE.md Waiting-on #26).
      Leave it unset. Nothing to rotate, nothing to remove.
- [ ] Any `RISE_*` variable that _is_ set: leave it, note it in the Decision Log entry. Removing it
      is a restore-cost with no security benefit, since no Rise code path can be constructed
      (A2 + A3).

---

## 3. Dormancy verification (the Done-when for 4A-W8)

Each item must be **evidenced**, not asserted:

- [ ] `grep -rn "RiseworksModule" money-service/src/app.module.ts` → only inside a comment.
- [ ] Boot money-service; hit `POST /v1/webhooks/riseworks` → **404** (route not registered).
      Before archival it returned 401 (missing signature) — that difference is the proof.
- [ ] `createPaymentProvider('RISE')` with `ALLOW_ARCHIVED_PROVIDERS` unset → throws
      `ArchivedProviderError`. Unit test asserts it.
- [ ] `getAvailableProviders()` → `['MOCK', 'WISE']` — `'RISE'` absent. Unit test asserts it.
- [ ] Railway: `DISBURSEMENT_PROVIDER` reads `WISE`. **Value-blind check for anything secret** — do
      not run `railway variables --kv` (Session 4A-5 leaked a secret into a transcript that way;
      `LESSONS-LEARNED.md` records it).
- [ ] `sync-riseworks-accounts` fires on its next natural tick and logs `ARCHIVED — skipping` with
      **no error**.
- [ ] `SELECT count(*) FROM "AffiliateRiseAccount";` and `… FROM "RiseWorksWebhookEvent";` return the
      **same counts as before** the archival commit. Record both numbers in the order's Deviations.
- [ ] Full money-service suite green — including every Rise spec. A skipped or deleted Rise test is
      a failed archival.
- [ ] `npm run validate` green on the monolith side.

---

## 4. Restore procedure

Target: **≤30 minutes**, no schema change, no data migration.

### 4.1 Preconditions

1. Davin's explicit instruction (money path — `EXECUTOR-PROTOCOL.md` §7).
2. A decision on _why_: Wise unavailable/blocked, or a commercial reversal. Record it in
   `DECISION-LOG.md` as an F42 amendment.
3. **Know what you are restoring to.** `RisePaymentProvider` was never completed — restoring it
   restores a provider that **cannot send a payment**. If the goal is actual Rise payouts, that is
   new build work (the never-written "Part 19B API integration"), scoped as its own session with
   `TEMPLATE-PORT.md`. **Restoring the archive ≠ being able to pay via Rise.** State this plainly to
   Davin before starting.

### 4.2 Steps

1. `money-service/src/app.module.ts`: uncomment the `RiseworksModule` import and its `imports` entry.
2. Railway (money-service): `ALLOW_ARCHIVED_PROVIDERS=true`, `DISBURSEMENT_PROVIDER=RISE`,
   and set `RISE_WEBHOOK_SECRET` to the value from the RiseWorks dashboard.
3. Deploy. Verify `POST /v1/webhooks/riseworks` returns **401** for an unsigned request (route live
   again) and **200** for a correctly signed replay fixture.
4. `commission-aggregator` eligibility automatically reverts to the `AffiliateRiseAccount` KYC path
   via the provider branch — verify with one dry-run batch preview, not a real batch.
5. RiseWorks dashboard: point the webhook URL at
   `https://money-service-production.up.railway.app/v1/webhooks/riseworks`.
   _(Blocked in the same way Session 4A-5-RW was: this needs RiseWorks to supply webhook/API
   settings, and the open `event` vs `event_type` field-name question must be resolved first — see
   the revoked `4a-5-rw-…` order for the detail. It is still unanswered.)_
6. Frontend: `NEXT_PUBLIC_SHOW_ARCHIVED_DISBURSEMENT_UI=true` to bring
   `/admin/disbursement/accounts` back.
7. Update `migration-cutover-table.md`, `CLAUDE.md`, `DECISION-LOG.md` (F42 amendment) and this
   runbook's changelog.

### 4.3 Running Wise and Rise simultaneously — don't

Technically possible (`DisbursementProvider` is per-`PaymentBatch`, and both webhook routes can be
registered at once). **Not recommended:** `Commission` has exactly one
`disbursementTransaction`, so a commission can only ever be paid by one provider, and two live
webhook reducers writing the same `AffiliateProfile` balance columns doubles the reconciliation
surface for no gain. If a dual-run is ever genuinely needed, it requires its own design session and
Davin's approval — it is out of scope for this runbook.

---

## 5. Inventory of everything archived (for the restore audit)

| Path                                                                     | Lines           | Kind                                | Archive action                                   |
| ------------------------------------------------------------------------ | --------------- | ----------------------------------- | ------------------------------------------------ |
| `money-service/src/riseworks/riseworks-webhook.controller.ts`            | 186             | controller                          | banner; module unregistered                      |
| `money-service/src/riseworks/riseworks.module.ts`                        | 21              | module                              | banner; unregistered                             |
| `money-service/src/riseworks/riseworks-webhook.controller.spec.ts`       | —               | test                                | unchanged, must keep passing                     |
| `money-service/src/disbursement/providers/rise/webhook-verifier.ts`      | 161             | HMAC verifier                       | banner only                                      |
| `money-service/src/disbursement/providers/rise/webhook-verifier.spec.ts` | —               | test                                | unchanged, must keep passing                     |
| `money-service/src/disbursement/webhook-event-processor.service.ts`      | 288             | Rise event reducer                  | **unchanged** — Wise never routes here           |
| `lib/disbursement/providers/rise/rise-provider.ts`                       | 225             | provider (**never completed**)      | banner only                                      |
| `lib/disbursement/providers/rise/siwe-auth.ts`                           | 155             | SIWE (**placeholder**)              | banner only                                      |
| `lib/disbursement/providers/rise/webhook-verifier.ts`                    | 160             | HMAC verifier                       | banner only                                      |
| `lib/disbursement/providers/rise/amount-converter.ts`                    | 110             | USD↔1e6 units                       | banner only                                      |
| `lib/disbursement/webhook/event-processor.ts`                            | 275             | Rise event reducer                  | banner only                                      |
| `app/api/webhooks/riseworks/route.ts`                                    | 174             | route                               | banner only; left deployed                       |
| `app/api/disbursement/riseworks/accounts/route.ts`                       | 257             | route                               | banner only                                      |
| `app/api/disbursement/riseworks/sync/route.ts`                           | 119             | route                               | banner only                                      |
| `app/api/cron/sync-riseworks-accounts/route.ts`                          | 86              | cron route (crons already cut over) | banner; money-service counterpart short-circuits |
| `app/(dashboard)/admin/disbursement/accounts/page.tsx`                   | —               | admin UI                            | flag-gated                                       |
| `prisma/non-market-data/schema.prisma` §RiseWorks (~lines 660–896)       | —               | 5 enums + 5 models                  | comment banner only; **no migration**            |
| `money-service/prisma/schema.prisma` §RiseWorks                          | —               | mirrored subset                     | comment banner only                              |
| `riseworks/**` (16 files)                                                | —               | docs                                | `ARCHIVED.md` added at the root                  |
| `docs/files-completion-list/files-inventory/part19{a,b,c,d}-*.md`        | 167/210/254/242 | inventories                         | supersession note appended                       |
| `docs/migration-orders/4a-5-rw-…migration-order.md`                      | 126             | order                               | status → REVOKED; file kept                      |

_Line counts verified 2026-07-25; re-verify at CONFIRM time._

---

## 6. Changelog

| Date                  | Change                                                                                                     | By       |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| 2026-07-25            | Runbook created; F42 resolved (archive-not-delete)                                                         | Advisor  |
| 2026-07-25            | Rev 2 (`07-…` P4): **A3 only** in 4A-W7; **A1/A2 moved to 4A-W8** — cutover sessions carry no code changes | Advisor  |
| _(fill on execution)_ | A3 (`DISBURSEMENT_PROVIDER=WISE`) applied at the 4A-W7 cutover                                             | Executor |
| _(fill on execution)_ | A1, A2, A4, A5 + docs/inventory applied at 4A-W8; dormancy verified; restore dry-run timed                 | Executor |
