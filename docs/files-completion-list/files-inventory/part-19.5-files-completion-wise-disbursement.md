# Part 19.5: Wise Disbursement System - List of Files Completion

**Last Updated:** 2026-08-14
**Status:** ✅ Complete (100% verified)

---

## 📊 Overview

Part 19.5 implements the active Wise Disbursement System: affiliate bank account onboarding, dynamic field requirements validation, batch payout scheduling, webhook status tracking, and admin disbursement operations.

---

## 📋 Production Files Inventory (18 Files)

### Wise API Endpoints (`app/api/wise/` and `app/api/disbursement/`)

| #   | File Path                                                    | Status   | Description                                                   |
| --- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------- |
| 1   | ✅ `app/api/wise/recipients/route.ts`                        | Complete | Wise recipient creation endpoint                              |
| 2   | ✅ `app/api/wise/recipients/me/route.ts`                     | Complete | Current affiliate Wise recipient profile endpoint             |
| 3   | ✅ `app/api/wise/recipients/[id]/revalidate/route.ts`        | Complete | Wise recipient bank account revalidation endpoint             |
| 4   | ✅ `app/api/wise/recipients/requirements/route.ts`           | Complete | Dynamic Wise recipient bank field requirements retriever      |
| 5   | ✅ `app/api/wise/recipients/requirements/refresh/route.ts`   | Complete | Cache refresh endpoint for dynamic bank field schemas         |
| 6   | ✅ `app/api/disbursement/batches/route.ts`                   | Complete | Payout batches listing and creation endpoint                  |
| 7   | ✅ `app/api/disbursement/batches/preview/route.ts`           | Complete | Payout batch pre-flight calculation and fee preview           |
| 8   | ✅ `app/api/disbursement/batches/[batchId]/route.ts`         | Complete | Single payout batch detail and item status endpoint           |
| 9   | ✅ `app/api/disbursement/batches/[batchId]/execute/route.ts` | Complete | Batch execution trigger route                                 |
| 10  | ✅ `app/api/disbursement/affiliates/payable/route.ts`        | Complete | List affiliates eligible for commission payout                |
| 11  | ✅ `app/api/disbursement/config/route.ts`                    | Complete | Disbursement provider (Wise / RiseWorks) global configuration |
| 12  | ✅ `app/api/disbursement/transactions/route.ts`              | Complete | Historical disbursement transaction ledger                    |

### Admin Disbursement Pages (`app/(dashboard)/admin/disbursement/`)

| #   | File Path                                                     | Status   | Description                                            |
| --- | ------------------------------------------------------------- | -------- | ------------------------------------------------------ |
| 13  | ✅ `app/(dashboard)/admin/disbursement/layout.tsx`            | Complete | Admin disbursement section layout                      |
| 14  | ✅ `app/(dashboard)/admin/disbursement/page.tsx`              | Complete | Disbursement overview dashboard                        |
| 15  | ✅ `app/(dashboard)/admin/disbursement/batches/page.tsx`      | Complete | Payout batches management table                        |
| 16  | ✅ `app/(dashboard)/admin/disbursement/recipients/page.tsx`   | Complete | Registered payout recipients and verification statuses |
| 17  | ✅ `app/(dashboard)/admin/disbursement/transactions/page.tsx` | Complete | Complete transaction ledger with export                |
| 18  | ✅ `components/affiliate/wise-recipient-form.tsx`             | Complete | Modal dialog for entering Wise recipient bank details  |

---

## 🔗 Related Documentation

- **Affiliate Portal Frontend:** [`docs/files-completion-list/files-inventory/part-17a2-files-completion-affiliate.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-17a2-files-completion-affiliate.md)

---

**Part 19.5 Status:** ✅ Complete and production-ready
