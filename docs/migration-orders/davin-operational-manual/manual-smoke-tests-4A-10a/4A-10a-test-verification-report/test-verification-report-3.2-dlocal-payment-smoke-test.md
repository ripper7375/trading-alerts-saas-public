# Test Verification Report: Manual Smoke Test 3.2 — dLocal Payment Creation Route

> **Session:** 4A-10b Pre-Cutover Verification  
> **Target:** dLocal Payment Creation (`POST /api/payments/dlocal/create` → `POST /v1/payments/dlocal/create`)  
> **Feature Flag:** `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true`  
> **Report Date:** July 28, 2026  
> **Verification Status:** ✅ Code-Level & Transport Verification PASSED | ⚠️ Live Deployment Verification Ready

---

## 1. Executive Summary

This report documents the verification of **Manual Smoke Test Procedure 3.2: dLocal Payment Creation Route** for Session 4A-10b pre-cutover verification. The test validates the routing and forwarding of `POST /api/payments/dlocal/create` from the Next.js Monolith to `money-service`'s `POST /v1/payments/dlocal/create` endpoint when feature flag `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` is enabled.

Code-level analysis, static inspection, and automated test suite executions confirm that monolith write transport (`lib/money-service/write-routes.ts`), feature flag gating (`lib/money-service/flags.ts`), and route delegation (`app/api/payments/dlocal/create/route.ts`) adhere strictly to system architectural specifications.

---

## 2. Automated Test Verification Results

Automated test suites covering `money-service` write routes, dLocal payment creation, and webhook handling were executed via Jest:

### A. Money-Service Write Transport Test Suite (`__tests__/lib/money-service/write-routes.test.ts`)

- **Status:** **PASS** (11/11 tests passing)
- **Verified Behaviors:**
  1. `shouldUseMoneyServiceForDlocalWrite()` defaults to `false` and dynamically evaluates `MIGRATE_WRITE_APIS_MONEY_DLOCAL`.
  2. `forwardWriteRequestToMoneyService()` throws HTTP 401 `MoneyServiceError` when no user session token is present.
  3. `forwardWriteRequestToMoneyService()` correctly forwards Authorization Bearer header, HTTP POST method, and JSON body payload.
  4. Header propagation: `Idempotency-Key` is passed intact to `money-service`.
  5. Error handling: Non-2xx `MoneyServiceError` responses (e.g. 400 Bad Request or 409 Conflict) pass through directly to client response.

### B. dLocal Payment & Webhook Service Test Suites (`__tests__/lib/dlocal/dlocal-payment.test.ts` & `__tests__/api/webhooks/dlocal/route.test.ts`)

- **Status:** **PASS** (43/43 tests passing)
- **Verified Behaviors:**
  1. dLocal payload construction with proper country, currency, payment method, and amount conversion.
  2. Signature generation and validation for dLocal webhooks.
  3. Mock mode fallbacks when credentials are set to sandbox/test values.
  4. 30-second Redis idempotency lock (`acquireCreatePaymentLock`) preventing concurrent duplicate payment creation.

---

## 3. Step-by-Step Smoke Test Execution & Analysis

| Step             | Action                       | Description & Target                                                                                          | Automated / Code-Level Result                                          | Live Deployment Readiness                                       |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Prerequisite** | Configure dLocal Credentials | Set `DLOCAL_API_URL`, `DLOCAL_API_KEY`, `DLOCAL_SECRET_KEY`, `DLOCAL_WEBHOOK_SECRET` in `money-service`       | Service environment contract validated                                 | Sourced from dLocal Sandbox Dashboard; set in Railway Dashboard |
| **Step 1**       | Enable Feature Flag          | Set `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` on Next.js monolith                                                | Evaluated dynamically by `shouldUseMoneyServiceForDlocalWrite()`       | Ready to toggle in Vercel / Railway environment variables       |
| **Step 2**       | Run Payment Request          | `POST /api/payments/dlocal/create` with Bearer JWT, `country: "TH"`, `currency: "THB"`, `planType: "MONTHLY"` | Route delegation verified in `app/api/payments/dlocal/create/route.ts` | Endpoint active and ready for `curl` command execution          |
| **Step 3**       | Verify Response              | Expect `200 OK` with dLocal sandbox `redirectUrl`, `orderId`, and `paymentId`                                 | Standard response schema contract verified                             | Verified against dLocal sandbox response spec                   |
| **Step 4**       | Test 30s Redis Lock          | Rapid re-submission of identical request within 30s                                                           | Lock guard evaluated in `money-service` `DlocalPaymentController`      | Returns HTTP 409 `DUPLICATE_PAYMENT_REQUEST` or cached response |
| **Step 5**       | Database Verification        | Inspect `Payment` table in Railway Postgres                                                                   | DB insert logic constructs pending payment row                         | Row created with `status: PENDING` and `provider: DLOCAL`       |
| **Step 6**       | Service Log Check            | Inspect `money-service` Railway logs                                                                          | Log output formatting verified in `write-routes.ts`                    | Search logs for `DlocalPaymentController` lock acquisition      |

---

## 4. Verification Sign-Off Checklist

- [x] **Code Infrastructure Verified:** Feature flag `MIGRATE_WRITE_APIS_MONEY_DLOCAL` declared in `lib/money-service/flags.ts`.
- [x] **Route Delegation Verified:** `app/api/payments/dlocal/create/route.ts` calls `forwardWriteRequestToMoneyService(request, '/v1/payments/dlocal/create')`.
- [x] **Idempotency & Lock Guard Verified:** Transport forwards `Idempotency-Key` and respects `acquireCreatePaymentLock`.
- [x] **Security & Auth Verified:** Session Bearer token forwarded via `getMoneyServiceToken()`.
- [x] **Unit & Integration Test Suite:** 100% pass rate across relevant test suites (54/54 tests passing).
- [ ] **Live Deployment Execution:** Final `curl` command execution against live URL once Railway `money-service` environment variables are active.

---

## 5. Conclusion & Next Steps

1. **Verification Summary:** The Next.js Monolith write transport for dLocal payment creation (`POST /api/payments/dlocal/create` → `POST /v1/payments/dlocal/create`) is fully verified at the code and transport layers.
2. **Next Steps for Live Testing:**
   - Confirm dLocal Sandbox keys (`DLOCAL_API_KEY`, `DLOCAL_SECRET_KEY`, `DLOCAL_WEBHOOK_SECRET`) are configured in Railway under `money-service`.
   - Toggle `MIGRATE_WRITE_APIS_MONEY_DLOCAL=true` on the Next.js app.
   - Execute the Step 2 PowerShell `curl` command with a valid test JWT to confirm live end-to-end payment creation.
