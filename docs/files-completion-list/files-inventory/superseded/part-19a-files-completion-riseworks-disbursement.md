# [SUPERSEDED] Part 19A: RiseWorks Disbursement Foundation - Files Inventory

> **STATUS: ⚠️ SUPERSEDED BY WISE DISBURSEMENT**
>
> **Superseded Date:** 2026-08-04
> **Reason:** RiseWorks blockchain disbursement has been fully replaced by Wise direct bank transfer disbursement (4A-W1 through 4A-W8 migration cutover). All payout operations, affiliate onboarding, recipient requirement validation, and batch execution are now handled via Wise and documented in [`part-19.5-files-completion-wise-disbursement.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-19.5-files-completion-wise-disbursement.md).

---

## 📜 Historical Summary & Superseded Scope

Part 19A originally established the foundation for the RiseWorks crypto/blockchain disbursement system:

- Abstract `PaymentProvider` base class (`lib/disbursement/providers/base-provider.ts`)
- RiseWorks provider skeleton (`lib/disbursement/providers/rise/`)
- RiseWorks crypto amount conversions (`RISE_AMOUNT_FACTOR = 1e6`) and KYC status models (`RiseWorksKycStatus`)

---

## 🔀 Replacement System

- **New Disbursement System:** Wise Direct Bank Transfer ([Part 19.5 Completion List](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-19.5-files-completion-wise-disbursement.md))
- **API Routes:** `/api/wise/recipients/*`, `/api/admin/disbursement/*`
- **Microservice:** `money-service` (`lib/money-service/*`)
