# [SUPERSEDED] Part 19D: RiseWorks Admin & Affiliate Portal Integration - Files Inventory

> **STATUS: ⚠️ SUPERSEDED BY WISE DISBURSEMENT**
>
> **Superseded Date:** 2026-08-04
> **Reason:** RiseWorks payout UI components and onboarding forms were superseded by Wise recipient onboarding (`wise-recipient-form.tsx`) and Wise recipient administration (`/admin/disbursement/recipients`). See [`part-19.5-files-completion-wise-disbursement.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-19.5-files-completion-wise-disbursement.md).

---

## 📜 Historical Summary & Superseded Scope

Part 19D originally implemented RiseWorks portal components:

- `app/affiliate/settings/payout/page.tsx` (RiseWorks ID input)
- `components/admin/riseworks-kyc-badge.tsx`
- `app/api/disbursement/rise-id/route.ts`

---

## 🔀 Replacement System

- **New Disbursement System:** Wise Direct Bank Transfer ([Part 19.5 Completion List](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-19.5-files-completion-wise-disbursement.md))
- **Active Onboarding UI:** `components/affiliate/wise-recipient-form.tsx` & `app/api/wise/recipients/route.ts`
