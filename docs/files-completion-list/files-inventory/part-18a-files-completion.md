# Part 18A: dLocal Payment Creation Flow (Vertical Slice 1 of 3) - Files Inventory

## Status Summary

- **Total Production Files:** 15 files
- **Total Test Files:** 8 files
- **Grand Total:** 23 files
- **Frontend Mirror Files:** 13 files (services, types, routes)

---

## Phase A: Database & Types (3 production + 2 test = 5 files)

| #   | File Path                                | Type   | Lines | Description                              |
| --- | ---------------------------------------- | ------ | ----- | ---------------------------------------- |
| 1   | `prisma/schema.prisma`                   | UPDATE | -     | Add Payment model (basic fields for 18A) |
| 2   | `types/dlocal.ts`                        | NEW    | 151   | dLocal type definitions                  |
| 3   | `lib/dlocal/constants.ts`                | NEW    | 163   | Countries, currencies, pricing constants |
| T1  | `__tests__/types/dlocal.test.ts`         | TEST   | -     | Test type definitions                    |
| T2  | `__tests__/lib/dlocal/constants.test.ts` | TEST   | -     | Test country/currency mappings           |

### Types Defined (`types/dlocal.ts`)

- `PaymentProvider` - 'DLOCAL' | 'STRIPE'
- `DLocalCountry` - IN, NG, PK, VN, ID, TH, ZA, TR (8 countries)
- `DLocalCurrency` - INR, NGN, PKR, VND, IDR, THB, ZAR, TRY
- `PlanType` - 'THREE_DAY' | 'MONTHLY'
- `PaymentStatus` - PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED
- `DLocalPaymentRequest` / `DLocalPaymentResponse`
- `DLocalWebhookPayload`
- `CurrencyConversionResult`
- `PaymentMethodInfo`
- `CountryConfig`
- `CreatePaymentOptions`
- `PaymentStatusResponse`

### Constants Defined (`lib/dlocal/constants.ts`)

- `DLOCAL_SUPPORTED_COUNTRIES` - 8 countries array
- `COUNTRY_CURRENCY_MAP` - Country to currency mapping
- `COUNTRY_NAMES` - Display names
- `PAYMENT_METHODS` - Per-country payment methods
- `PRICING` - THREE_DAY_USD: $1.99, MONTHLY_USD: $29.00
- `PLAN_DURATION` - 3 days / 30 days
- Helper functions: `isDLocalCountry()`, `getCurrency()`, `getPaymentMethods()`, etc.

---

## Phase B: Core Services (5 production + 4 test = 9 files)

| #   | File Path                                         | Type | Lines | Description                      |
| --- | ------------------------------------------------- | ---- | ----- | -------------------------------- |
| 4   | `lib/dlocal/currency-converter.service.ts`        | NEW  | 156   | USD to local currency conversion |
| 5   | `lib/dlocal/payment-methods.service.ts`           | NEW  | 118   | Fetch payment methods by country |
| 6   | `lib/dlocal/dlocal-payment.service.ts`            | NEW  | 237   | Create payments, verify webhooks |
| 7   | `lib/geo/detect-country.ts`                       | NEW  | -     | IP geolocation country detection |
| 8   | `lib/logger.ts`                                   | NEW  | -     | Simple logging utility           |
| T3  | `__tests__/lib/dlocal/currency-converter.test.ts` | TEST | -     | TDD: Currency conversion         |
| T4  | `__tests__/lib/dlocal/payment-methods.test.ts`    | TEST | -     | TDD: Payment methods             |
| T5  | `__tests__/lib/dlocal/dlocal-payment.test.ts`     | TEST | -     | TDD: Payment creation            |
| T6  | `__tests__/lib/geo/detect-country.test.ts`        | TEST | -     | TDD: Country detection           |

### Service Capabilities

**Currency Converter Service:**

- `convertUSDToLocal()` - Convert USD to local currency
- Exchange rate caching (1-hour TTL)
- Fallback rates for offline mode
- exchangerate-api.com integration

**Payment Methods Service:**

- `getPaymentMethodsForCountry()` - Get available payment methods
- `isValidPaymentMethod()` - Validate payment method for country
- `getPaymentMethodDetails()` - Get detailed method info
- `getPaymentMethodType()` - Classify method type (bank, wallet, qr, card)

**dLocal Payment Service:**

- `createPayment()` - Create dLocal payment with HMAC-SHA256 signature
- `verifyWebhookSignature()` - Verify webhook signatures
- `mapDLocalStatus()` - Map dLocal status to internal status
- `generateSignature()` - HMAC SHA256 signature generation
- `generateOrderId()` - Unique order ID generation

---

## Phase C: API Routes (6 production + 1 test = 7 files)

| #   | File Path                                        | Type | Lines | Description                          |
| --- | ------------------------------------------------ | ---- | ----- | ------------------------------------ |
| 9   | `app/api/payments/dlocal/methods/route.ts`       | NEW  | 79    | GET payment methods for country      |
| 10  | `app/api/payments/dlocal/exchange-rate/route.ts` | NEW  | 79    | GET exchange rate USD to currency    |
| 11  | `app/api/payments/dlocal/convert/route.ts`       | NEW  | 98    | GET currency conversion              |
| 12  | `app/api/payments/dlocal/create/route.ts`        | NEW  | 217   | POST create dLocal payment           |
| 13  | `app/api/payments/dlocal/[paymentId]/route.ts`   | NEW  | 113   | GET payment status                   |
| 14  | `app/api/webhooks/dlocal/route.ts`               | NEW  | -     | POST webhook handler (BASIC version) |
| T7  | `__tests__/api/webhooks/dlocal/route.test.ts`    | TEST | -     | Unit test: Basic webhook handler     |

### API Endpoints Summary

| Method | Endpoint                             | Description                     |
| ------ | ------------------------------------ | ------------------------------- |
| GET    | `/api/payments/dlocal/methods`       | Get payment methods for country |
| GET    | `/api/payments/dlocal/exchange-rate` | Get USD exchange rate           |
| GET    | `/api/payments/dlocal/convert`       | Convert USD to local currency   |
| POST   | `/api/payments/dlocal/create`        | Create dLocal payment           |
| GET    | `/api/payments/dlocal/[paymentId]`   | Get payment status              |
| POST   | `/api/webhooks/dlocal`               | Handle dLocal webhooks          |

---

## Phase D: Integration Test (0 production + 1 test = 1 file)

| #   | File Path                                        | Type | Description                        |
| --- | ------------------------------------------------ | ---- | ---------------------------------- |
| T8  | `__tests__/integration/payment-creation.test.ts` | TEST | Integration: Complete payment flow |

---

## Phase E: Documentation (1 production + 0 test = 1 file)

| #   | File Path                 | Type | Description              |
| --- | ------------------------- | ---- | ------------------------ |
| 15  | `docs/part18a-handoff.md` | NEW  | Handoff doc for Part 18B |

---

## Frontend Mirror Files (13 files)

These files mirror the backend services for frontend deployment:

### Types

| File Path                  | Mirrors           |
| -------------------------- | ----------------- |
| `frontend/types/dlocal.ts` | `types/dlocal.ts` |

### Services

| File Path                                            | Mirrors                                     |
| ---------------------------------------------------- | ------------------------------------------- |
| `frontend/lib/dlocal/constants.ts`                   | `lib/dlocal/constants.ts`                   |
| `frontend/lib/dlocal/currency-converter.service.ts`  | `lib/dlocal/currency-converter.service.ts`  |
| `frontend/lib/dlocal/payment-methods.service.ts`     | `lib/dlocal/payment-methods.service.ts`     |
| `frontend/lib/dlocal/dlocal-payment.service.ts`      | `lib/dlocal/dlocal-payment.service.ts`      |
| `frontend/lib/dlocal/three-day-validator.service.ts` | `lib/dlocal/three-day-validator.service.ts` |

### API Routes

| File Path                                                               | Mirrors                                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| `frontend/app/api/payments/dlocal/methods/route.ts`                     | `app/api/payments/dlocal/methods/route.ts`                     |
| `frontend/app/api/payments/dlocal/exchange-rate/route.ts`               | `app/api/payments/dlocal/exchange-rate/route.ts`               |
| `frontend/app/api/payments/dlocal/convert/route.ts`                     | `app/api/payments/dlocal/convert/route.ts`                     |
| `frontend/app/api/payments/dlocal/create/route.ts`                      | `app/api/payments/dlocal/create/route.ts`                      |
| `frontend/app/api/payments/dlocal/[paymentId]/route.ts`                 | `app/api/payments/dlocal/[paymentId]/route.ts`                 |
| `frontend/app/api/payments/dlocal/validate-discount/route.ts`           | `app/api/payments/dlocal/validate-discount/route.ts`           |
| `frontend/app/api/payments/dlocal/check-three-day-eligibility/route.ts` | `app/api/payments/dlocal/check-three-day-eligibility/route.ts` |

---

## Supported Countries & Payment Methods

| Country      | Code | Currency | Payment Methods                     |
| ------------ | ---- | -------- | ----------------------------------- |
| India        | IN   | INR      | UPI, Paytm, PhonePe, Net Banking    |
| Nigeria      | NG   | NGN      | Bank Transfer, USSD, Paystack       |
| Pakistan     | PK   | PKR      | JazzCash, Easypaisa                 |
| Vietnam      | VN   | VND      | VNPay, MoMo, ZaloPay                |
| Indonesia    | ID   | IDR      | GoPay, OVO, Dana, ShopeePay         |
| Thailand     | TH   | THB      | TrueMoney, Rabbit LINE Pay, Thai QR |
| South Africa | ZA   | ZAR      | Instant EFT, EFT                    |
| Turkey       | TR   | TRY      | Bank Transfer, Local Cards          |

---

## Pricing

| Plan    | USD Price | Duration | Notes                        |
| ------- | --------- | -------- | ---------------------------- |
| 3-Day   | $1.99     | 3 days   | One-time, lifetime limit     |
| Monthly | $29.00    | 30 days  | Recurring via manual renewal |

---

## Total File Count

| Category                | Production | Test  | Total  |
| ----------------------- | ---------- | ----- | ------ |
| Phase A: Database/Types | 3          | 2     | 5      |
| Phase B: Services       | 5          | 4     | 9      |
| Phase C: API Routes     | 6          | 1     | 7      |
| Phase D: Integration    | 0          | 1     | 1      |
| Phase E: Documentation  | 1          | 0     | 1      |
| **Total**               | **15**     | **8** | **23** |
| Frontend Mirrors        | 13         | 0     | 13     |

---

## Update 2026-07-04

No new files; `app/api/payments/dlocal/create/route.ts` and `app/api/webhooks/dlocal/route.ts`
were **modified** (still complete) so the dLocal webhook routes affiliate conversions through the
shared `lib/affiliate/conversion-processor.ts`.
