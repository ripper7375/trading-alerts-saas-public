# DavinTrade Architecture Design — Disbursement Payout Settings (`/admin/disbursement/settings`)

|                               |                                                                                                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**                    | Draft for feasibility review → implementation                                                                                                                                                         |
| **Author**                    | Davin (with Claude), 2026-09-23                                                                                                                                                                       |
| **Audience**                  | Claude Code (implementer)                                                                                                                                                                             |
| **Supersedes**                | Session 9-9 CONFIRM resolution (2026-08-23) — "keep `/admin/disbursement/config` as a placeholder"                                                                                                    |
| **Schema migration required** | **No** — reuses existing `SystemConfig` / `SystemConfigHistory` tables                                                                                                                                |
| **Builds on**                 | The SystemConfig pattern ("Part 17"): `docs/SYSTEMCONFIG-USAGE-GUIDE.md`, `docs/CLAUDECODE-SYSTEMCONFIG-INTEGRATION-GUIDE.md`. See §8A for what is reused and where this design intentionally differs |

---

## 0. Instructions for Claude Code

1. **Do Phase 0 (feasibility check) first.** Section 3 lists what this design assumes about the current code. Check each item against the repo before writing any code. If any item is wrong, **stop and report**; do not work around it.
2. Items marked **⚠ DECISION** have a recommended default. Build to the recommendation unless Davin has overridden it in the session order.
3. Follow the existing house conventions this repo already documents: DECISION-LOG entries, LESSONS-LEARNED L24 (money-service schema/constants are hand-synced, never a migration source), and the retired-route redirect-stub pattern (see `app/admin/disbursement/accounts/page.tsx`).
4. Do not change payout _money-movement_ logic (Wise transfer/funding, orchestrator execution) except at the specific enforcement points listed in §6 and the schedule change in §6A.
5. **You cannot see production environment variables or confirm a deploy.** Anything that depends on them (§6A.1 G1–G4) goes into the completion manifest as a check for Davin, not as a done item.

---

## 1. Goal

Replace the placeholder `/admin/disbursement/config` with a real **Payout Settings** page at `/admin/disbursement/settings`. An admin can change payout settings there, the changes are saved to the database, and both services use them on their next run with **no redeploy**. Each change is audited.

This implements the 3-step plan:

| Step                                  | Meaning in this design                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1. Supersede the Session 9-9 decision | New DECISION-LOG entry (§2) authorising real persistence                                                 |
| 2. Build the settings capability      | Persistence (§5), enforcement in both services (§6), API (§7), UI (§8)                                   |
| 3. Remove the partial config page     | `/admin/disbursement/config` becomes a redirect stub to `/settings`; its placeholder API is deleted (§9) |

---

## 2. Step 1 — Decision record (append to DECISION-LOG.md)

Find the existing `DECISION-LOG.md` (the code references it, e.g. entry F79 in `lib/auth/session.ts`). Append an entry in the same format as the existing ones. Suggested content:

> **F-next — Disbursement payout settings become DB-backed (supersedes Session 9-9 CONFIRM, 2026-08-23).**
> Session 9-9 kept `/admin/disbursement/config` as a placeholder over hardcoded/env config and did not build persistence, because that session was only a UI restyle. We are now building that persistence. Minimum payout, max batch size, commission approval window and a payouts on/off switch become `SystemConfig` rows (category `disbursement`), editable at `/admin/disbursement/settings`, audited in `SystemConfigHistory` + `DisbursementAuditLog`. **The payment provider stays env-var-only** (`DISBURSEMENT_PROVIDER`, requires redeploy) because it decides which system moves real money. The env var `DISBURSEMENT_ENABLED=false` remains a deploy-level emergency stop that the UI cannot override. `/admin/disbursement/config` is retired to a redirect.
>
> **F-next+1 — Automated payouts run monthly, not daily (Davin, 2026-09-23).** The published policy (affiliate register/dashboard copy, `AFFILIATE_CONFIG.PAYMENT_FREQUENCY = 'MONTHLY'`) says monthly. The code ran daily (`@Cron('0 2 * * *')`), carried over verbatim from `vercel.json` under a "do not change the timing" invariant. This decision overrides that invariant **for `process-pending-disbursements` only**. The payout run moves to the 1st of each month at 02:00 UTC. Commission approval (refund-window maturity) is split into its own job and stays daily. See §6A.

---

## 3. Current state (verified 2026-09-23). Re-check in Phase 0.

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Evidence                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| C1  | `MINIMUM_PAYOUT_USD = 50.0` and `MAX_BATCH_SIZE = 100` are **hardcoded constants**, not env vars. They are copied byte-for-byte in both services. (The config page's "every field is env-var-driven" wording is wrong for these two.)                                                                                                                                                                                                                                                                                                                                                        | `lib/disbursement/constants.ts`, `money-service/src/disbursement/disbursement.constants.ts`                     |
| C2  | `DISBURSEMENT_ENABLED` is read **only** by `GET /api/disbursement/config`. **Nothing enforces it.** The config page's text "When disabled, no new batches can be created or executed" is currently false.                                                                                                                                                                                                                                                                                                                                                                                    | grep: sole reader is `app/api/disbursement/config/route.ts:68`                                                  |
| C3  | `MAX_BATCH_SIZE` is used only as the default param of `splitIntoBatches()`, which has **zero callers** in either service. Batch size is not enforced anywhere; the cron puts every payable affiliate into one batch.                                                                                                                                                                                                                                                                                                                                                                         | `lib/disbursement/services/batch-manager.ts:319`, `money-service/src/disbursement/batch-manager.service.ts:328` |
| C4  | Provider comes from `getDefaultProvider()` → `DISBURSEMENT_PROVIDER` env, in both services.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | both `constants.ts` files; used by provider factories, money-service cron, admin disbursement layout badge      |
| C5  | `SystemConfig` + `SystemConfigHistory` already exist (init migration `20251227000000_init`). `SystemConfig` is already in money-service's hand-synced schema subset. Both services use **one shared Postgres**.                                                                                                                                                                                                                                                                                                                                                                              | `prisma/non-market-data/schema.prisma:1357,1386`; `money-service/prisma/schema.prisma:683`                      |
| C6  | money-service already reads `SystemConfig` live, uncached, per call: `affiliate_commission_approval_days` (default 14) in `DisbursementProcessorService.approveMaturedCommissions()`, and affiliate keys in `AffiliateConfigService`. **No admin UI writes `affiliate_commission_approval_days` today.**                                                                                                                                                                                                                                                                                     | `money-service/src/disbursement/disbursement-processor.service.ts`                                              |
| C7  | Write precedent: `PATCH /api/admin/settings/affiliate` upserts `SystemConfig` and inserts `SystemConfigHistory`. **Weakness to avoid:** the upsert and the history insert are not in one transaction.                                                                                                                                                                                                                                                                                                                                                                                        | `app/api/admin/settings/affiliate/route.ts`                                                                     |
| C8  | `/admin/system/config-history` already lists `SystemConfigHistory` (latest 50), so disbursement changes appear there with no extra work. Its doc comment ("zero readers or writers") is stale; the affiliate settings route writes to it.                                                                                                                                                                                                                                                                                                                                                    | `app/admin/system/config-history/page.tsx`                                                                      |
| C9  | Automated payouts: money-service `CronsScheduler` `@Cron('0 2 * * *')` → `DisbursementProcessorService.processAutomatedDisbursements()`. The only gate is the global `CRON_ENABLED`. The same handler is callable via `POST /v1/cron-trigger/process-pending-disbursements`.                                                                                                                                                                                                                                                                                                                 | `money-service/src/crons/crons.scheduler.ts`, `cron-trigger.controller.ts`                                      |
| C10 | Manual payout entry points (Next): `POST /api/disbursement/batches` (MOCK/RISE), `POST /api/disbursement/pay` (MOCK/RISE), `POST /api/disbursement/batches/[batchId]/execute`. Execute forwards to money-service `DisbursementBatchesController.execute` when `MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT=true`. Wise admin/recovery surface: money-service `WiseBatchesController` (`/v1/wise/batches*`).                                                                                                                                                                                        | files as named                                                                                                  |
| C11 | Minimum-payout readers: Next `CommissionAggregator` (5 uses), `app/api/disbursement/batches/preview/route.ts` (2 uses), and indirectly `affiliates/payable` and `pay`. money-service `CommissionAggregatorService` (6 uses, including the Wise-specific `getAllPayableAffiliatesForProvider`).                                                                                                                                                                                                                                                                                               | grep `MINIMUM_PAYOUT_USD`                                                                                       |
| C12 | `lib/disbursement/cron/disbursement-processor.ts` (Next) appears to be **dead code**; nothing in `app/` or `lib/` calls it. The money-service port replaced it.                                                                                                                                                                                                                                                                                                                                                                                                                              | grep                                                                                                            |
| C13 | `DEFAULT_RETRY_CONFIG` feeds `RetryHandler` in both services. It is an engineering setting, not an admin setting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | both `retry-handler` files                                                                                      |
| C14 | **A third and fourth copy of the $50 minimum reach affiliates.** `AFFILIATE_CONFIG.MINIMUM_PAYOUT = 50.0` (not deprecated, unlike its siblings) is used in affiliate-facing copy: `app/affiliate/register/page.tsx:373` (terms consent) and `:403` (benefits list), and `app/affiliate/dashboard/resources/page.tsx:378` (FAQ). `app/affiliate/dashboard/page.tsx:371` uses a literal `formatCurrency(50)`. money-service has a twin `AFFILIATE_CONFIG.MINIMUM_PAYOUT` with no readers. This is the "hardcoded values in other parts" problem the SystemConfig guide was written to prevent. | `lib/affiliate/constants.ts:76`, `money-service/src/affiliate/affiliate.constants.ts:67`                        |
| C15 | The SystemConfig propagation path is live: public `GET /api/config/affiliate` (`Cache-Control: public, s-maxage=300`) → `useAffiliateConfig()` SWR hook (`lib/hooks/useAffiliateConfig.ts`) → affiliate/pricing pages. The admin write side is `/admin/settings/affiliate`. `prisma/seed.ts` seeds the 5 affiliate keys with `upsert({ update: {} })`.                                                                                                                                                                                                                                       | files as named                                                                                                  |
| C16 | The old SystemConfig guides are partly stale. The generic `/api/admin/system-config*` endpoints they document were **never built** (each domain has its own route), and their key table omits `affiliate_three_day_price`. Treat them as a pattern reference, not as a description of the current code.                                                                                                                                                                                                                                                                                      | `app/api/admin/` has no `system-config` dir                                                                     |

---

## 4. Scope

### In scope (Phase 1)

| Setting                           | SystemConfig key                     | Type              | Default (= today's behaviour) | Bounds           | Status today                                                                                                       |
| --------------------------------- | ------------------------------------ | ----------------- | ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Payouts on/off                    | `disbursement_enabled`               | boolean           | `true`                        | —                | Displayed but has no effect (C2)                                                                                   |
| Minimum payout (USD)              | `disbursement_minimum_payout_usd`    | number, 2dp       | `50.00`                       | 1.00 – 10,000.00 | Hardcoded constant (C1). **Also shown to affiliates**, so it propagates through the SystemConfig public path (§8A) |
| Max payments per batch            | `disbursement_max_batch_size`        | integer           | `100`                         | 1 – 500          | Constant, never enforced (C3)                                                                                      |
| Commission approval window (days) | `affiliate_commission_approval_days` | integer           | `14`                          | 0 – 90           | Read live by money-service; no UI (C6)                                                                             |
| Payment provider                  | _(none — env only)_                  | read-only display | `DISBURSEMENT_PROVIDER`       | —                | Env var (C4)                                                                                                       |

**Key naming:** keep the existing key `affiliate_commission_approval_days` unchanged because money-service already reads it. The new keys use the `disbursement_` prefix and `category: 'disbursement'`.

**Zero-change deploy:** if no rows exist, every default equals current behaviour. Shipping the code changes nothing until an admin saves a value.

### Out of scope (Phase 2 candidates)

- **Subscription price, discount %, commission % and codes per month.** These are already SystemConfig-backed and editable at `/admin/settings/affiliate`. They stay on that page, and the payout settings page only links to it (§8A.4)
- Editing the provider from the UI (**⚠ D1**)
- An **admin-editable** payout schedule. Phase 1 fixes the cadence in code as monthly (§6A); making it editable later would need `SchedulerRegistry` dynamic jobs
- Retry/backoff tuning (C13), fees, currency, per-affiliate overrides
- Rewriting `/admin/system/config-history` (only its stale comment gets fixed)

---

## 5. Architecture

```
                 ┌──────────────── Shared Postgres ────────────────┐
                 │  SystemConfig (category='disbursement' rows)    │
                 │  SystemConfigHistory      DisbursementAuditLog  │
                 └───────▲──────────────────────────▲──────────────┘
          write (tx)     │ read                      │ read
┌────────────────────────┴───────────┐   ┌──────────┴──────────────────────────┐
│ Next.js app                         │   │ money-service (NestJS)              │
│  /admin/disbursement/settings (UI)  │   │  DisbursementSettingsService (DI)   │
│  GET/PATCH /api/disbursement/settings│  │   ↳ DisbursementProcessorService    │
│  lib/disbursement/settings.ts       │   │   ↳ CommissionAggregatorService     │
│   ↳ CommissionAggregator            │   │   ↳ DisbursementBatchesController   │
│   ↳ batches / pay / execute / preview│  │   ↳ WiseBatchesController (gate)    │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
```

### 5.1 Settings readers (one per service, hand-synced per L24)

**Next:** new `lib/disbursement/settings.ts`
**money-service:** new `money-service/src/disbursement/disbursement-settings.service.ts` (`@Injectable`, registered in `disbursement.module.ts`)

Both expose the same contract:

```ts
export interface DisbursementSettings {
  enabled: boolean; // DB value (default true)
  envKillSwitch: boolean; // true when process.env.DISBURSEMENT_ENABLED === 'false'
  effectiveEnabled: boolean; // enabled && !envKillSwitch
  minimumPayoutUsd: number;
  maxBatchSize: number;
  commissionApprovalDays: number;
}

// Next:          getDisbursementSettings(prisma): Promise<DisbursementSettings>
// money-service: DisbursementSettingsService.get(): Promise<DisbursementSettings>
```

Both files also define the same `DISBURSEMENT_SETTING_KEYS`, defaults and bounds table. Header comments should name the twin file, following the existing "ported byte-for-byte" convention.

**Read rules**

- A single `systemConfig.findMany({ where: { key: { in: [...] } } })` per call. **No cache.** Reads happen once per batch creation (daily cron plus rare admin actions), which matches money-service's existing uncached reads (C6). A saved change applies to the next run.
- Parse each value and **clamp-reject**: if a stored value is unparseable or out of bounds, use the default and `console.error` / log. Never throw from a malformed row.
- If the DB read fails, use the defaults and log the error. This is safe because creating a batch needs the same DB anyway, so a DB outage fails the payout run on its own.
- **Env kill-switch precedence:** `DISBURSEMENT_ENABLED=false` forces `effectiveEnabled=false` regardless of the DB value. The UI shows this state and cannot change it.

**Existing constants:** keep `MINIMUM_PAYOUT_USD`, `MAX_BATCH_SIZE` and `DEFAULT_RETRY_CONFIG` exported as they are (they become the defaults). This keeps `__tests__/lib/disbursement/constants.test.ts` green. Change the _call sites_, not the exports. Update the comment on each to "default; runtime value comes from SystemConfig via settings".

**Parity guard:** add a Next jest test that imports both key/default tables and asserts they are equal. If jest cannot resolve `money-service/src`, write a comment-level hand-sync note plus a test that reads the money-service file as text and asserts the key strings and defaults appear in it.

---

## 6. Enforcement points (this is what makes the settings real)

| #   | Location                                                                                                                      | Change                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | money-service `DisbursementProcessorService.processAutomatedDisbursements()`                                                  | Read settings first. **Step 0 (`approveMaturedCommissions`) still runs while paused (⚠ D5).** If `!effectiveEnabled`: log `cron.disbursement_skipped` (INFO, details include `reason: 'db_disabled' \| 'env_kill_switch'`) and return `success: true` with 0 batches.              |
| E2  | same method, batch creation                                                                                                   | Split `aggregates` into chunks of `maxBatchSize` using the existing `batchManager.splitIntoBatches()`. Create and execute one batch per chunk, and sum the results. **(⚠ D2).** With the default of 100 this behaves the same as today until more than 100 affiliates are payable. |
| E3  | same class, `approveMaturedCommissions()`                                                                                     | Use `settings.commissionApprovalDays` instead of reading the key inline, so there is one reader.                                                                                                                                                                                    |
| E4  | money-service `CommissionAggregatorService` (all 6 `MINIMUM_PAYOUT_USD` uses, including `getAllPayableAffiliatesForProvider`) | Inject `DisbursementSettingsService`. Resolve `minimumPayoutUsd` **once per public method call** and pass it down. Keep the "Below minimum payout of $X" messages, using the dynamic value.                                                                                         |
| E5  | money-service `DisbursementBatchesController.execute`                                                                         | If `!effectiveEnabled` → `409 { error: 'Disbursements are paused', code: 'DISBURSEMENTS_PAUSED' }`. Check this before the provider checks.                                                                                                                                          |
| E6  | money-service `WiseBatchesController`                                                                                         | **⚠ D4:** block `POST /` (prepare), `POST /:id/complete` and `POST /:id/fund` while paused (409, same body as E5). **Allow** `GET`s, `cancel` and `mark-funded`, because they record or undo things that already happened in the real world.                                       |
| E7  | Next `CommissionAggregator` (5 uses)                                                                                          | Same pattern as E4, using `getDisbursementSettings(this.prisma)`.                                                                                                                                                                                                                   |
| E8  | Next `app/api/disbursement/batches/preview/route.ts`                                                                          | Use the dynamic minimum for `statusReason` and `minimumThreshold`.                                                                                                                                                                                                                  |
| E9  | Next `POST /api/disbursement/batches`                                                                                         | Return 409 `DISBURSEMENTS_PAUSED` if paused. For the "all payable" path (no `affiliateIds`), split by `maxBatchSize` the same way as E2. For explicit `affiliateIds`, keep one batch and reject with 400 if the count is over `maxBatchSize`.                                       |
| E10 | Next `POST /api/disbursement/pay`                                                                                             | 409 if paused. The minimum is already covered through `aggregator.canPayout` (E7).                                                                                                                                                                                                  |
| E11 | Next `POST /api/disbursement/batches/[batchId]/execute`                                                                       | 409 if paused. Check this **before** the money-service forward branch, so both the forwarded path and the local path are gated (E5 also covers money-service called directly).                                                                                                      |
| E12 | Next `app/admin/disbursement/layout.tsx`                                                                                      | Next to the provider badge, show a red "Payouts paused" badge when `!effectiveEnabled`.                                                                                                                                                                                             |
| —   | `lib/disbursement/cron/disbursement-processor.ts` (Next)                                                                      | **Do not modify** if Phase 0 confirms it is dead (C12). Say so in the completion manifest.                                                                                                                                                                                          |

All 409 responses use the shape `{ error, code: 'DISBURSEMENTS_PAUSED' }` so the admin UI can show one clear message for them.

---

## 6A. Payout schedule: monthly (decision F-next+1)

**Current (verified):** `money-service/src/crons/crons.scheduler.ts` runs `scheduledProcessPendingDisbursements` with `@Cron('0 2 * * *')`, which is **daily**. That one job does two things: Step 0 approves matured commissions (refund window passed), then it pays every affiliate over the minimum.

**Target:** payouts happen **monthly**. Approvals keep happening **daily**, so affiliates see PENDING → APPROVED on time and the monthly run pays everything that matured during the month.

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | `scheduledProcessPendingDisbursements`: `@Cron('0 2 * * *')` → **`@Cron('0 2 1 * *')`** (1st of each month, 02:00 UTC = 09:00 Bangkok, during business hours for Wise `MANUAL` funding, F37). Update the JSDoc on `handleProcessPendingDisbursements` from `vercel.json "0 2 * * *"` to the new expression and cite F-next+1.                                                                                                                                                                    |
| S2  | **New daily job** `approve-matured-commissions`: add `handleApproveMaturedCommissions()`, which calls the existing public `DisbursementProcessorService.approveMaturedCommissions()` and logs the count through `TransactionLoggerService` as `cron.commissions_auto_approved`. Schedule it with `@Cron('0 2 * * *')` behind the same `isCronEnabled()` gate. Add `POST /v1/cron-trigger/approve-matured-commissions` to `cron-trigger.controller.ts` (`CronSecretGuard`, same as its siblings). |
| S3  | Keep Step 0 inside `processAutomatedDisbursements()`. Approval is idempotent, so the monthly run and any manual trigger still approve first and then pay. No behaviour change there.                                                                                                                                                                                                                                                                                                             |
| S4  | Scheduler header comment: amend the "UTC expressions are copied verbatim from `vercel.json` — CRITICAL invariant, do not change the timing" note with: "Exception: process-pending-disbursements moved to monthly (DECISION-LOG F-next+1); approve-matured-commissions added (daily)." `vercel.json` `crons` is already `[]`, so there is nothing to change there.                                                                                                                               |
| S5  | The pause switch (E1) applies to the monthly payout run. The daily approval job ignores it (D5: approval is bookkeeping).                                                                                                                                                                                                                                                                                                                                                                        |
| S6  | `/admin/disbursement/settings` shows a **read-only** "Payout schedule: Monthly — 1st of each month, 02:00 UTC" line and the computed **next run date**. Put the schedule string in one exported constant (e.g. `PAYOUT_CRON_EXPRESSION` in money-service and a mirrored display constant in `lib/disbursement/settings.ts`, per L24 hand-sync) so the page and the cron can't drift apart.                                                                                                       |
| S7  | Affiliate-facing copy already says "monthly", so no text change is needed. **Check** `"Payouts are processed monthly for balances over {amount}"` (dashboard) and the register/FAQ strings still read correctly with the §8A.2 dynamic amount.                                                                                                                                                                                                                                                   |

### 6A.1 ⚠ Go-live conditions. "Implemented" does not mean "effective"

Claude Code: merging §6A does **not** by itself make payouts monthly. Monthly payouts take effect only when **all** of the following are true. In the completion manifest, report §6A as **"code complete — pending deploy + verification by Davin"**, never as "monthly payouts live".

| #   | Condition                                                                                                                                                                                                    | Who   | How to check                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | The §6A change is **deployed to money-service** (Railway, `money-service/railway.toml`). Until then the old daily `0 2 * * *` schedule keeps running                                                         | Davin | Railway deploy log for money-service shows the new commit                                                                                     |
| G2  | `CRON_ENABLED=true` in money-service's **production** env. Every `@Cron` job, both payout and approval, skips itself otherwise (`isCronEnabled()`)                                                           | Davin | Railway → money-service → Variables. **Claude Code cannot see production env vars: do not assume a value, and state it as a check for Davin** |
| G3  | Payouts not paused: the new `disbursement_enabled` setting is `true` **and** env `DISBURSEMENT_ENABLED` is not `'false'` (§5.1). Otherwise the monthly run logs `cron.disbursement_skipped` and pays nothing | Davin | `/admin/disbursement/settings` status banner shows "Payouts active"                                                                           |
| G4  | `DISBURSEMENT_PROVIDER=WISE` in money-service production env if real payouts are intended (`MOCK` only simulates)                                                                                            | Davin | Same Variables screen; the settings page's read-only provider card                                                                            |

**What "paid on the 1st" means with Wise `MANUAL` funding (F37):** at 02:00 UTC on the 1st, the run **creates the batch and prepares the Wise transfers**. Money only moves after Davin funds the batch, within the 72h funding SLA (`WISE_FUNDING_SLA_HOURS`). Affiliate-facing copy that promises "paid on the 1st" should say "processed on the 1st" or "paid in the first days of each month" (check during §8A.2 / S7).

**Post-deploy verification (Davin; also list in the manifest):**

1. money-service startup/scheduler logs show `process-pending-disbursements` registered at `0 2 1 * *` and `approve-matured-commissions` at `0 2 * * *`.
2. `/admin/disbursement/settings` shows "Payout schedule: Monthly — 1st, 02:00 UTC" and the correct next run date.
3. Over the following days, commissions older than 14 days move PENDING → APPROVED daily, and **no new batch appears** in `/admin/disbursement/batches` until the 1st.
4. On the 1st: a batch appears (or `cron.disbursement_skipped` with a reason, if G3 was deliberately off), and the monthly report at 06:00 UTC reflects it.

**Effect on the first cutover:** the next payout after deploy happens on the 1st of the following month. Commissions approved in between build up and are paid in that run. There is no double payment: `disbursementTransaction: null` already excludes paid commissions. If Davin wants a final daily-style run before cutover, trigger `POST /v1/cron-trigger/process-pending-disbursements` manually before deploying.

---

## 7. API — `app/api/disbursement/settings/route.ts` (new)

Place it next to the existing `/api/disbursement/*` routes. It lives in the Next app only. This is a config write, not a money-movement write, so it needs no money-service forwarding flag. This matches `/api/admin/settings/affiliate`.

### `GET /api/disbursement/settings` — `requireAdmin()`

```jsonc
{
  "settings": {
    "enabled":                { "value": true,  "default": true, "source": "default", "updatedBy": null, "updatedAt": null },
    "minimumPayoutUsd":       { "value": 50,    "default": 50,   "min": 1, "max": 10000, "source": "database", "updatedBy": "<adminId>", "updatedAt": "ISO" },
    "maxBatchSize":           { "value": 100,   "default": 100,  "min": 1, "max": 500,   "source": "default", ... },
    "commissionApprovalDays": { "value": 14,    "default": 14,   "min": 0, "max": 90,    "source": "default", ... }
  },
  "effective": { "enabled": true, "envKillSwitch": false },
  "provider":  { "active": "WISE", "available": ["MOCK","WISE"], "source": "env", "envVar": "DISBURSEMENT_PROVIDER" },
  "recentChanges": [ /* last 10 SystemConfigHistory rows for these 4 keys */ ],
  "version": "ISO max(updatedAt) across the 4 rows, or null"
}
```

`provider.available` reuses `isProviderAvailable()` exactly as the current config route does.

### `PATCH /api/disbursement/settings` — `requireAdmin()`

Request body, validated with **zod** (the repo's standard):

```ts
z.object({
  enabled: z.boolean().optional(),
  minimumPayoutUsd: z.number().min(1).max(10000).multipleOf(0.01).optional(),
  maxBatchSize: z.number().int().min(1).max(500).optional(),
  commissionApprovalDays: z.number().int().min(0).max(90).optional(),
  reason: z.string().trim().min(5).max(500), // ⚠ D6: required
  expectedVersion: z.string().datetime().nullable(), // optimistic concurrency
}).refine((b) =>
  Object.keys(b).some((k) => !['reason', 'expectedVersion'].includes(k))
);
```

Behaviour:

1. Recompute the current `version`. If it differs from `expectedVersion`, return **409** `{ code: 'SETTINGS_STALE' }` so the UI reloads.
2. Drop fields whose new value equals the current effective value. If nothing is left, return `200 { changes: [] }` and write nothing.
3. In **one `prisma.$transaction`**, for each changed key:
   - `systemConfig.upsert`: on create set `valueType`, `category: 'disbursement'`, `description`, `updatedBy: adminId`; on update set `value` and `updatedBy`
   - `systemConfigHistory.create`: `{ configKey, oldValue, newValue, changedBy: adminEmail, reason }`. `oldValue` is the stored value, or the default string if no row exists yet
   - plus one `disbursementAuditLog.create`: `{ action: 'config.settings_updated', actor: adminId, status: 'INFO', details: { changes, reason } }`. Setting `enabled` to false uses `action: 'config.disbursements_paused'` / `status: 'WARNING'`, and setting it back to true uses `'config.disbursements_resumed'`. This makes pause and resume easy to find in `/admin/disbursement/audit`.
4. Return `200 { changes: [{ setting, oldValue, newValue }], effective, version }`.

Errors: `AuthError` → its status (same pattern as the other routes); zod → 400 with `details: error.flatten()`; anything else → 500 with a generic message.

---

## 8. UI — `app/admin/disbursement/settings/page.tsx` (new)

A client component in the same style as the retired config page: `useLocale().t(key, fallback)`, shadcn `Card` / `Badge` / `Button` / `AlertDialog`, semantic tokens (`bg-card`, `text-foreground`, `text-muted-foreground`).

Layout, top to bottom:

1. **Header:** title "Payout Settings" and subtitle "Changes apply to the next payout run — no redeploy needed."
2. **Status banner:**
   - `effectiveEnabled`: a green "Payouts active" banner
   - DB-disabled: an amber "Payouts paused by an admin" banner showing who and when (from `recentChanges`)
   - env kill switch: a red "Payouts stopped at deploy level (`DISBURSEMENT_ENABLED=false`). This page can't override it." banner, with the toggle disabled
3. **Settings form** (one card). One row per setting, each with an input, helper text, "Default: X", "Last changed by … on …", and a small "Reset to default" link:
   - Payouts enabled (switch). Helper text: "When off, the monthly auto-payout run (1st, 02:00 UTC) and all manual batch/pay/execute actions are blocked. Daily commission approval still runs."
   - Read-only: payout schedule and next run date (§6A S6)
   - Minimum payout (USD, number, step 0.01)
   - Max payments per batch (integer)
   - Commission approval window (days)
4. **Provider (read-only card):** active provider badge, available providers, and the note "Set by the `DISBURSEMENT_PROVIDER` environment variable on money-service; changing it requires a redeploy."
5. **Reason** textarea (required, min 5 chars) and a **Save** button, disabled until something changes and the reason is valid.
6. **Confirm dialog** (`AlertDialog`) listing each change as `old → new`. When pausing, show extra warning text.
7. **Recent changes:** the last 10 history rows, plus a link to `/admin/system/config-history`.

On a 409 `SETTINGS_STALE` response, show "Settings were changed by someone else — reloaded" and refetch. On save, refetch and show a success toast.

**i18n:** add new keys under `admin.disbursement.settings.*` (and `admin.disbursement.nav_settings`) to `lib/i18n/dictionaries/*.json`. Look at how previous sessions handled non-English dictionaries (the files differ a lot in size) and do the same. At minimum cover `en-US.json` and `en-GB.json`, with English fallbacks in every `t()` call.

---

## 8A. SystemConfig integration

Payout settings are a new category (`disbursement`) in the same SystemConfig system that already powers affiliate pricing. This section covers what the design reuses from that pattern, the one place it extends it, and where it intentionally differs.

### 8A.1 What is reused unchanged

| SystemConfig convention (per the guides)                                                                   | Applied here                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One row per setting in `SystemConfig`: string `value`, `valueType`, `description`, `category`, `updatedBy` | Yes. `category: 'disbursement'`, `valueType` `'number'` / `'boolean'`                                                                                                                                                                                            |
| Every change gets a `SystemConfigHistory` row with `oldValue` / `newValue` / `changedBy` / `reason`        | Yes. Stronger here: the write is transactional and `reason` is required (§7)                                                                                                                                                                                     |
| Defaults live in code, so a missing row means the default                                                  | Yes (§5.1)                                                                                                                                                                                                                                                       |
| Admin edits through a dedicated settings page, like Part 17's `/admin/settings/affiliate`                  | Yes: `/admin/disbursement/settings`                                                                                                                                                                                                                              |
| Seed rows with `upsert({ update: {} })` so existing values are never overwritten                           | Yes. Add the 3 new `disbursement_*` keys and `affiliate_commission_approval_days` to the SystemConfig block in `prisma/seed.ts`, using default values and the same pattern. Dev/staging then show real rows, and production is unaffected unless seed runs there |
| Changes are visible in `/admin/system/config-history`                                                      | Yes, automatically (C8)                                                                                                                                                                                                                                          |

### 8A.2 Extension: the minimum payout reaches affiliates through the public config path

The minimum payout is the one payout setting affiliates see. Today it is hardcoded in affiliate-facing UI (C14). Following the guide's own rule ("No Hardcoded Values in Other Parts" / "Retrofitting Existing Pages"):

1. **`app/api/config/affiliate/route.ts`:** add `minimumPayoutUsd: number` to `AffiliateConfigResponse`. Resolve it through `getDisbursementSettings(prisma)` (§5.1) so there is one reader and one set of defaults and bounds. Keep the existing `s-maxage=300` cache.
   - **Expose only `minimumPayoutUsd`.** `enabled`, batch size, the approval window and the provider are operational settings and must **not** appear on a public, unauthenticated endpoint.
2. **`lib/hooks/useAffiliateConfig.ts`:** add `minimumPayoutUsd` to `AffiliateConfig` and `UseAffiliateConfigReturn`, with default `50` in its `DEFAULTS`.
3. **Retrofit the 4 hardcoded spots:**

   | File                                             | Now                                                                   | Change to                                                                                 |
   | ------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
   | `app/affiliate/register/page.tsx:373`            | `$${AFFILIATE_CONFIG.MINIMUM_PAYOUT}` inside a `t()` template literal | `minimumPayoutUsd` from `useAffiliateConfig()` (the page already calls the hook, line 45) |
   | `app/affiliate/register/page.tsx:403`            | same                                                                  | same                                                                                      |
   | `app/affiliate/dashboard/page.tsx:371`           | literal `formatCurrency(50)`                                          | `formatCurrency(minimumPayoutUsd)` (the page already calls the hook, line 53)             |
   | `app/affiliate/dashboard/resources/page.tsx:378` | `AFFILIATE_CONFIG.MINIMUM_PAYOUT`                                     | `minimumPayoutUsd` from the hook (add the hook call)                                      |

   **i18n fix while you're there:** the two register-page strings interpolate values into the `t()` _key_ itself (``t(`…over $${…}`)``). Whenever the value differs from the dictionary key text, the translation lookup misses and the text falls back to English. Convert them to fixed keys with `{amount}` / `{percent}` placeholders plus `.replace()`, the pattern `app/affiliate/dashboard/page.tsx:358–371` already uses. Add the new keys to the dictionaries per §8.

4. **Deprecate** `AFFILIATE_CONFIG.MINIMUM_PAYOUT` in both `lib/affiliate/constants.ts` and `money-service/src/affiliate/affiliate.constants.ts` with `@deprecated Use SystemConfig 'disbursement_minimum_payout_usd' via getDisbursementSettings() / useAffiliateConfig().minimumPayoutUsd`, matching how its sibling fields are already deprecated. Do not delete it. After the retrofit it should have zero readers; confirm with grep.
5. **Dictionary strings with a baked-in `$50`:** `"Payout Threshold Progress ($50.00 Minimum)"`, `"Threshold ($50)"`, `"Below $50.00 minimum threshold"`, `"- Monthly automated payouts for balances over $50"` and the two partner-terms consent strings in `lib/i18n/dictionaries/en-US.json`. Grep for each one's usage. If it's used, convert it to an `{amount}` placeholder key. If it's orphaned, leave it alone and list it in the completion manifest. Leave the changelog entry "Minimum payout threshold lowered from $75.00 to $50.00" as it is; it's history.

**Propagation behaviour, stated plainly for the UI copy:** payout _enforcement_ (cron and manual actions) reads the value fresh from the DB and applies it from the next run. Affiliate-facing _display_ updates within ≤5 minutes (the CDN `s-maxage` plus the SWR interval). The admin "Save" success message should say both.

### 8A.3 Intentional differences from the old guides

| Guide says                                                       | This design                                                        | Why                                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Generic `/api/admin/system-config*` CRUD endpoints               | Not built. A dedicated `/api/disbursement/settings` route instead  | Those endpoints never existed (C16). Domain routes with zod bounds per key are the pattern the codebase actually uses |
| Consumers read through the 5-minute cached public endpoint / SWR | **Server-side payout logic reads SystemConfig directly, uncached** | Deciding who gets paid must never use a stale value. The cache is only for display                                    |
| All settings exposed on the public config endpoint               | Only `minimumPayoutUsd` is exposed                                 | The other payout settings are operational and not public information                                                  |
| `reason` optional                                                | `reason` required                                                  | These settings move money (D6)                                                                                        |

### 8A.4 Relationship to `/admin/settings/affiliate`

The two pages share one storage system and one audit history but manage different domains:

| Page                                 | Domain                                                 | Keys                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/settings/affiliate` (exists) | **Money in**: what customers pay, what affiliates earn | `affiliate_discount_percent`, `affiliate_commission_percent`, `affiliate_codes_per_month`, `affiliate_base_price`, `affiliate_three_day_price` |
| `/admin/disbursement/settings` (new) | **Money out**: when and how earned commission is paid  | `disbursement_enabled`, `disbursement_minimum_payout_usd`, `disbursement_max_batch_size`, `affiliate_commission_approval_days`                 |

Add a small "Related settings" line at the bottom of each page linking to the other. Do **not** move pricing, discount or commission fields onto the payout page, since that would give the same keys two editors.

### 8A.5 Related findings (record in the manifest; fix only if trivial and Davin agrees)

- **DONE (2026-09-23, before implementation):** `app/affiliate/dashboard/resources/page.tsx` now reads `commissionPercent` / `codesPerMonth` from `useAffiliateConfig()` instead of the deprecated `AFFILIATE_CONFIG.COMMISSION_PERCENT` / `CODES_PER_MONTH` (D8). It still imports `AFFILIATE_CONFIG` for `CODE_EXPIRY_DAYS` and for `MINIMUM_PAYOUT`, which the §8A.2 retrofit replaces. **Claude Code: do not redo this.** Verify it, and add a render test if you touch the file.
- **RESOLVED:** monthly (policy) vs daily (code). Davin confirmed **monthly**; implemented through §6A.

---

## 9. Step 3 — Retire `/admin/disbursement/config`

| File                                       | Change                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/admin/disbursement/config/page.tsx`   | Replace with a redirect stub to `/admin/disbursement/settings`. Add a doc comment in the same style as `accounts/page.tsx`: "Retired (Session X): superseded by /admin/disbursement/settings, DB-backed per DECISION-LOG F-next."                                                                                      |
| `app/api/disbursement/config/route.ts`     | **Grep for consumers first** (app, components, tests, `docs/*openapi*.yaml`, money-service). If the retired page was the only consumer, **delete the file**, since its PATCH is the placeholder being replaced. If anything else calls GET, make GET a thin adapter over `getDisbursementSettings()` and delete PATCH. |
| `app/admin/disbursement/layout.tsx`        | Nav: replace `{ labelKey: 'admin.disbursement.nav_configuration', label: 'Configuration', href: '/admin/disbursement/config' }` with `{ labelKey: 'admin.disbursement.nav_settings', label: 'Payout Settings', href: '/admin/disbursement/settings' }`.                                                                |
| i18n                                       | Remove config-page-only keys (`admin.disbursement.save_placeholder_notice`, `placeholder_note_*`, `confirm_config_update_*`, `provider_selection_note`, …) **only if grep shows no other users**.                                                                                                                      |
| `app/admin/system/config-history/page.tsx` | Fix the stale "zero readers or writers" comment (C8). No behaviour change.                                                                                                                                                                                                                                             |

---

## 10. Security & safety

- **AuthZ:** `requireAdmin()` on both handlers. money-service gates use the existing `JwtAuthGuard` and `AdminGuard`, which are already on those controllers.
- **Validation:** zod bounds on the server. UI bounds are only for convenience.
- **Audit:** every change is written to `SystemConfigHistory` (who/what/why) and `DisbursementAuditLog` (shown on the disbursement audit page), in the same transaction as the value.
- **Kill switch:** no admin can override the env-level stop. The DB-level pause blocks every entry point that creates or executes money movement (E1, E5, E6, E9–E11) and leaves recovery and recording actions available.
- **Provider** stays deploy-gated (D1).
- **Fail-safe reads:** a malformed row falls back to its default and logs an error. It never crashes the cron.
- **Rate limit (optional):** if the other admin write routes use `lib/rate-limit.ts`, apply the same limiter here. Otherwise follow the affiliate settings route precedent (none).

---

## 11. Tests

**Next (jest, `__tests__/`)**

- `__tests__/lib/disbursement/settings.test.ts`: defaults when there are no rows; DB values parsed; malformed or out-of-bounds values fall back to defaults; the env kill switch forces `effectiveEnabled=false`; a DB error returns defaults.
- `__tests__/api/disbursement/settings.test.ts`: GET 401/403/200 shape; PATCH zod bounds; reason required; no-op returns `changes: []` with no writes; stale `expectedVersion` returns 409; changed keys write upsert + history + audit inside `$transaction`; pausing writes action `config.disbursements_paused`.
- Update `__tests__/lib/disbursement/services/aggregator.test.ts`: the threshold follows the settings value, not the constant.
- Update `__tests__/api/disbursement/batches.test.ts`, `pay.test.ts`, `execute.test.ts`: 409 `DISBURSEMENTS_PAUSED` when paused; batch splitting (E9); execute gated before the forward branch.
- Parity test (§5.1).
- `__tests__/pages/admin/disbursement-settings.test.tsx`: renders values and defaults; Save disabled until something changes and a reason is entered; confirm dialog shows the diff; env kill-switch banner disables the toggle.
- Config page redirect test.
- SystemConfig path (§8A): **add** `__tests__/api/config-affiliate.test.ts` (none exists today). It should cover `minimumPayoutUsd` in the response (default 50, DB value when set), assert that `enabled` / batch size / approval days / provider are **absent**, and check that the existing 5 fields are unchanged. **Add** a hook test asserting `useAffiliateConfig()` exposes `minimumPayoutUsd` with default 50. Update the existing affiliate page tests (`__tests__/pages/affiliate/*`, `__tests__/api/affiliate-registration.test.ts` where relevant) so a mocked minimum of, say, 75 renders as $75 in the register, dashboard and resources pages.

**money-service (colocated `*.spec.ts`)**

- `disbursement-settings.service.spec.ts`: same cases as the Next settings test.
- `disbursement-processor.service.spec.ts`: paused → skipped, 0 batches, approval still runs; `maxBatchSize=2` with 5 aggregates → 3 batches; the approval window comes from settings.
- `crons/crons.scheduler.spec.ts`: add `scheduledApproveMaturedCommissions` → `handleApproveMaturedCommissions` to the existing scheduled→handler mapping table (lines ~243–265). Assert the `@Cron` metadata: payout = `'0 2 1 * *'`, approval = `'0 2 * * *'` (read with `Reflect.getMetadata` / `SchedulerRegistry` in the style the spec already uses). The CRON_ENABLED gate covers both. `cron-trigger.controller.spec.ts`: the new endpoint delegates correctly.
- `commission-aggregator.service.spec.ts`: the threshold is dynamic, including the Wise path.
- `controllers/disbursement-batches.controller.spec.ts` and `wise/__tests__/wise-batches.controller.spec.ts`: 409 while paused on the gated routes, allowed on cancel/mark-funded.

Run each package's full suite, not just the new files. The constants tests must stay green without changes.

---

## 12. Rollout

1. **No migration.** The tables are already in production (C5). Do **not** run `prisma migrate` from money-service (L24).
2. Deploy order: **money-service first, then the Next app.** Either order is safe, because missing rows mean defaults, which is today's behaviour. money-service first means the cron honours the settings before the UI can write them.
3. Staging verification:
   - Save minimum = 60 → `GET /api/disbursement/batches/preview` shows threshold 60 → trigger `POST /v1/cron-trigger/process-pending-disbursements` → affiliates between 50 and 59.99 are excluded.
   - Pause → trigger the cron → audit log shows `cron.disbursement_skipped` → manual execute returns 409 → resume → run proceeds.
   - Set `DISBURSEMENT_ENABLED=false` on staging → the UI shows the red banner and the toggle is disabled.
   - Schedule (§6A): trigger `POST /v1/cron-trigger/approve-matured-commissions` → matured PENDING commissions become APPROVED and nothing is paid. Confirm from the money-service startup/scheduler logs that `process-pending-disbursements` is registered at `0 2 1 * *`.
   - `/admin/disbursement/config` redirects; the nav shows "Payout Settings"; `/admin/system/config-history` lists the changes.
4. Production: deploy and change nothing. On first use, save with a reason and confirm the history row. Then work through §6A.1 G1–G4 and its post-deploy verification. Monthly payouts are not live until those pass.
5. **Rollback:** revert the code. Leftover `SystemConfig` rows do no harm because the old code ignores the new keys. `affiliate_commission_approval_days` keeps working, since the old code already read it.

---

## 13. Acceptance criteria

- [ ] DECISION-LOG entries added: F-next (supersedes Session 9-9) and F-next+1 (monthly payouts)
- [ ] Auto-payout runs on the 1st of each month at 02:00 UTC; commission approval still runs daily; the settings page shows the schedule and the next run date
- [ ] Manifest reports §6A as "code complete — pending deploy + verification" and lists go-live conditions G1–G4 and the post-deploy verification steps (§6A.1) for Davin
- [ ] `/admin/disbursement/settings` loads for admins and returns 403 for non-admins
- [ ] Changing each of the 4 settings persists, survives reload, and takes effect on the next cron run and on manual actions **without redeploy**
- [ ] Pause blocks E1/E5/E6/E9/E10/E11 with `DISBURSEMENTS_PAUSED`; commission approval keeps running; resume restores normal behaviour
- [ ] `DISBURSEMENT_ENABLED=false` cannot be overridden from the UI
- [ ] Every change writes `SystemConfigHistory` and `DisbursementAuditLog` in one transaction
- [ ] Provider is shown read-only and remains env-controlled
- [ ] Changing the minimum payout updates the affiliate register, dashboard and resources pages within ≤5 minutes; no `50` literal or `AFFILIATE_CONFIG.MINIMUM_PAYOUT` reader remains in affiliate-facing code
- [ ] `/api/config/affiliate` exposes `minimumPayoutUsd` and no other payout setting
- [ ] The 4 payout keys are seeded in `prisma/seed.ts` with `update: {}`; each settings page links to the other
- [ ] `/admin/disbursement/config` redirects; the placeholder API is removed or adapted per §9; the nav is updated
- [ ] No schema migration; the money-service schema is untouched
- [ ] All existing and new tests pass in both packages
- [ ] Completion manifest written (repo convention: `*-manifest-work-completion.md`). It should list files changed, the Phase 0 findings and any deviations
- [ ] `docs/files-completion-list/davintrade-ui-page.xlsx`: row 97 → Implemented (`app/admin/disbursement/settings/page.tsx`); row 19 → Retired / Redirect

---

## 14. Decisions (recommended defaults — build to these unless overridden)

| ID     | Question                                                                                         | Recommendation                                                                 | Why                                                                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Should the provider be editable in the UI?                                                       | **No.** Read-only, env-controlled                                              | It chooses which rail moves real money; a deploy is a deliberate safety step                                                                                                                                                                                            |
| **D2** | Max batch size: enforce or drop?                                                                 | **Enforce** (E2/E9)                                                            | Makes an existing but unused setting real; the default of 100 changes nothing today. Note: under Wise `MANUAL` funding (F37), each extra batch means one more funding step                                                                                              |
| **D3** | Include the commission approval window?                                                          | **Yes**                                                                        | Already read live by money-service with no UI; it is the refund window before commissions become payable                                                                                                                                                                |
| **D4** | What does "paused" block on the Wise admin surface?                                              | Block prepare/complete/fund; allow cancel/mark-funded/GETs                     | Stop new money movement while still allowing recovery and recording of real-world bank actions                                                                                                                                                                          |
| **D5** | Does commission approval run while paused?                                                       | **Yes**                                                                        | Approving is bookkeeping, not money movement                                                                                                                                                                                                                            |
| **D6** | Is a reason required on save?                                                                    | **Yes** (min 5 chars)                                                          | Money-affecting config; the affiliate route's optional reason is a weaker precedent                                                                                                                                                                                     |
| **D7** | Put the minimum payout on the public `/api/config/affiliate` endpoint?                           | **Yes, that field only**                                                       | Affiliates already see "$50" in public copy, so it is not sensitive, and it removes 4 hardcoded spots                                                                                                                                                                   |
| **D8** | Also fix the resources page's deprecated `COMMISSION_PERCENT` / `CODES_PER_MONTH` reads (§8A.5)? | ✅ **Done 2026-09-23**                                                         | Already fixed in the repo; verify only                                                                                                                                                                                                                                  |
| **D9** | Payout cadence                                                                                   | ✅ **Decided: monthly** (Davin). Recommended slot: **1st of month, 02:00 UTC** | Matches published policy. 02:00 UTC is 09:00 Bangkok, during business hours for Wise manual funding, and runs before `send-monthly-reports` (06:00 UTC on the 1st), so the monthly report includes the payout. Change only the day/time if Davin picks a different slot |

---

## 15. File change list (summary)

**New**

- `lib/disbursement/settings.ts`
- `money-service/src/disbursement/disbursement-settings.service.ts` (+ `.spec.ts`)
- `app/api/disbursement/settings/route.ts`
- `app/admin/disbursement/settings/page.tsx`
- Tests listed in §11

**Modified — money-service**

- `disbursement.module.ts` (provider registration)
- `disbursement-processor.service.ts` (E1–E3)
- `commission-aggregator.service.ts` (E4)
- `controllers/disbursement-batches.controller.ts` (E5)
- `wise/controllers/wise-batches.controller.ts` (E6)
- `disbursement.constants.ts` (comments only)
- `crons/crons.scheduler.ts` (S1, S2, S4) and `crons/cron-trigger.controller.ts` (S2), plus their specs

**Modified — Next**

- `lib/disbursement/services/commission-aggregator.ts` (E7)
- `app/api/disbursement/batches/preview/route.ts` (E8)
- `app/api/disbursement/batches/route.ts` (E9)
- `app/api/disbursement/pay/route.ts` (E10)
- `app/api/disbursement/batches/[batchId]/execute/route.ts` (E11)
- `app/admin/disbursement/layout.tsx` (E12 + nav)
- `app/admin/disbursement/config/page.tsx` (→ redirect)
- `app/admin/system/config-history/page.tsx` (comment)
- `lib/disbursement/constants.ts` (comments only)
- `lib/i18n/dictionaries/*.json`

**Modified — SystemConfig path (§8A)**

- `app/api/config/affiliate/route.ts` (+ `minimumPayoutUsd`)
- `lib/hooks/useAffiliateConfig.ts` (+ `minimumPayoutUsd`)
- `app/affiliate/register/page.tsx` (2 spots + i18n placeholder fix)
- `app/affiliate/dashboard/page.tsx` (literal `50`)
- `app/affiliate/dashboard/resources/page.tsx` (FAQ minimum only; D8 commission/codes already done)
- `lib/affiliate/constants.ts`, `money-service/src/affiliate/affiliate.constants.ts` (`@deprecated` on `MINIMUM_PAYOUT`)
- `prisma/seed.ts` (4 payout keys)
- `app/admin/settings/affiliate/page.tsx` ("Related settings" link)

**Deleted or adapted**

- `app/api/disbursement/config/route.ts` (per §9 grep)

**Docs**

- DECISION-LOG.md (new entry)
- Completion manifest
