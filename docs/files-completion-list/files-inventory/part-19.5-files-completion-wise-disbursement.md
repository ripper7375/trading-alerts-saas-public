# Part 19.5: Wise Disbursement System - List of Files Completion

**Last Updated:** 2026-08-04
**Status:** ✅ Complete (100%)

---

## 📊 Overview

Part 19.5 encompasses the complete Wise Direct Bank Transfer Disbursement System, replacing legacy blockchain/RiseWorks payouts. The system enables global affiliates to submit bank account details (IBAN, ACH, SWIFT/BIC, local account numbers) with dynamic currency requirement validation, automated compliance checks, money-service microservice decoupling, and batch payout execution from the admin portal.

---

## 📋 Production Files Inventory (18 Files)

### 1. Database Schema & Models (`prisma/non-market-data/schema.prisma`, 1 file)

| #   | File Path                                 | Status   | Description                                                     |
| --- | ----------------------------------------- | -------- | --------------------------------------------------------------- |
| 1   | ✅ `prisma/non-market-data/schema.prisma` | Complete | `WiseRecipient`, `WisePayoutBatch`, and `WisePayoutItem` models |

---

### 2. Money Service Integration & Decoupling Bridge (`lib/money-service/`, 5 files)

| #   | File Path                              | Status   | Description                                                                                                 |
| --- | -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| 2   | ✅ `lib/money-service/client.ts`       | Complete | Client wrapper communicating with decoupled `money-service` microservice                                    |
| 3   | ✅ `lib/money-service/flags.ts`        | Complete | Feature flags (`shouldUseMoneyServiceForWiseRecipients`, `shouldUseMoneyServiceForDisbursement`)            |
| 4   | ✅ `lib/money-service/routes.ts`       | Complete | Money service route declarations & proxy handlers                                                           |
| 5   | ✅ `lib/money-service/wise-types.ts`   | Complete | Wise API payload types (`WiseRecipientRequirementField`, `WiseRecipientInput`, `WiseQuote`, `WiseTransfer`) |
| 6   | ✅ `lib/money-service/write-routes.ts` | Complete | Money service write-route proxy helpers                                                                     |

---

### 3. Wise Recipient API Routes (`app/api/wise/recipients/`, 5 files)

| #   | File Path                                                  | Status   | Description                                                                                             |
| --- | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| 7   | ✅ `app/api/wise/recipients/route.ts`                      | Complete | `GET`: List user's bank accounts; `POST`: Create & validate new Wise recipient account                  |
| 8   | ✅ `app/api/wise/recipients/me/route.ts`                   | Complete | `GET`: Fetch active Wise recipient for current affiliate                                                |
| 9   | ✅ `app/api/wise/recipients/requirements/route.ts`         | Complete | `GET`: Fetch dynamic bank account requirements for target currency (USD, EUR, GBP, VND, NGN, BRL, etc.) |
| 10  | ✅ `app/api/wise/recipients/requirements/refresh/route.ts` | Complete | `POST`: Force refresh requirement definitions from Wise API                                             |
| 11  | ✅ `app/api/wise/recipients/[id]/revalidate/route.ts`      | Complete | `POST`: Re-validate existing recipient details against Wise compliance API                              |

---

### 4. Admin & Affiliate Payout UI Pages (4 files)

| #   | File Path                                                          | Status   | Description                                                                   |
| --- | ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------- |
| 12  | ✅ `app/(dashboard)/admin/disbursement/recipients/page.tsx`        | Complete | Admin page for reviewing and approving affiliate Wise recipient bank accounts |
| 13  | ✅ `app/(dashboard)/admin/disbursement/batches/page.tsx`           | Complete | Admin payout batch management overview                                        |
| 14  | ✅ `app/(dashboard)/admin/disbursement/batches/[batchId]/page.tsx` | Complete | Wise batch detail view & itemized payout status                               |
| 15  | ✅ `app/affiliate/dashboard/profile/payment/page.tsx`              | Complete | Affiliate payout settings page with embedded Wise recipient onboarding form   |

---

### 5. UI Components & Type Definitions (3 files)

| #   | File Path                                         | Status   | Description                                                                                             |
| --- | ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| 16  | ✅ `components/affiliate/wise-recipient-form.tsx` | Complete | Dynamic bank account onboarding form rendering currency-specific fields                                 |
| 17  | ✅ `components/admin/pay-commission-modal.tsx`    | Complete | Modal for executing commission payouts to Wise recipients                                               |
| 18  | ✅ `types/disbursement.ts`                        | Complete | TypeScript interfaces for Wise disbursement (`DisbursementProvider = 'WISE'`, statuses, batch payloads) |

---

## 🧪 Test Suite (`__tests__/`)

- `__tests__/api/wise-recipients.test.ts` — Integration tests for `/api/wise/recipients/*` endpoints
- `__tests__/components/affiliate/wise-recipient-form.test.tsx` — Unit tests for dynamic Wise bank requirement form component
- `__tests__/lib/money-service/rollback-rehearsal.test.ts` — Rehearsal tests for money-service fallback & rollback

---

## 📊 Status Summary

- **Total Production Files:** 18/18 (100%)
- **Database Models:** 3 models (`WiseRecipient`, `WisePayoutBatch`, `WisePayoutItem`)
- **Money Service Bridge:** 5 files
- **Wise API Routes:** 5 endpoints
- **UI Pages & Components:** 6 files
- **Type Definitions:** 1 file
- **Tests:** 3 test suites

---

## 🎯 Architecture & Wise Integration Features

### 1. Dynamic Currency Requirements

- Bank account field requirements adapt dynamically based on currency selected (e.g., routing number + account number for `USD`, IBAN + SWIFT/BIC for `EUR`/`GBP`, local bank code for `VND`/`NGN`).

### 2. Money Service Decoupling (Session 4A Cutover)

- Outbound payouts and recipient registration requests are proxied via `lib/money-service/client.ts` to the isolated `money-service` backend, with fallback flags (`shouldUseMoneyServiceForWiseRecipients`).

---

## 🔗 Related Documentation

- **Affiliate Portal:** `docs/files-completion-list/files-inventory/part-17a1-files-completion-affiliate.md`
- **Admin Dashboard:** `docs/files-completion-list/files-inventory/part-14-files-completion-admin-dashboard.md`
- **Migration Orders:** `docs/migration-orders/4a-w1-wise-contracts-and-decisions.migration-order.md` through `4a-w8-riseworks-archival.migration-order.md`

---

**Part 19.5 Status:** ✅ Complete and production-ready
