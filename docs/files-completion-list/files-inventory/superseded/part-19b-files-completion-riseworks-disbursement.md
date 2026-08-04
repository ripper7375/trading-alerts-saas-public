# [SUPERSEDED] Part 19B: RiseWorks API Client & Provider - Files Inventory

> **STATUS: ⚠️ SUPERSEDED BY WISE DISBURSEMENT**
>
> **Superseded Date:** 2026-08-04
> **Reason:** RiseWorks blockchain API client and signature verification have been superseded by Wise API integration and `money-service` microservice client. All active disbursement operations use Wise direct bank transfer and are documented in [`part-19.5-files-completion-wise-disbursement.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-19.5-files-completion-wise-disbursement.md).

---

## 📜 Historical Summary & Superseded Scope

Part 19B originally implemented the RiseWorks client API interface:

- `lib/disbursement/providers/rise/riseworks-client.ts` — RiseWorks API authentication & endpoint wrappers
- `lib/disbursement/providers/rise/riseworks-provider.ts` — `PaymentProvider` implementation for RiseWorks
- `lib/disbursement/webhook/rise-webhook-handler.ts` — Webhook handler for RiseWorks status callbacks

---

## 🔀 Replacement System

- **New Disbursement System:** Wise Direct Bank Transfer ([Part 19.5 Completion List](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-19.5-files-completion-wise-disbursement.md))
- **Active Client:** `lib/money-service/client.ts` & Wise REST API endpoints
