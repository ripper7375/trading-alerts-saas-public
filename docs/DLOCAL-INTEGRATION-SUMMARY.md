# dLocal Payment Integration - Complete Summary

> **Status (2026-11-23): not live, to be retired.** dLocal declined to open a production account for DavinTrade, so this
> integration has only run in the sandbox and will never take a real payment. This document is kept as the design of the
> code until the retirement order removes it; do not read anything below as live behaviour. See the first item of
> [waiting-on](../.claude/state/waiting-on.md).

## Executive Summary

This document provides a complete overview of the dLocal payment integration for Trading Alerts SaaS, enabling users from 8 emerging markets to subscribe to PRO plans using local payment methods without international credit cards.

**Last Updated:** 2025-11-16
**Implementation Status:** ✅ Phase 1 Complete - Documentation & Planning
**Next Phase:** Phase 3 - Building with Aider (Part 18)

---

## 1. Business Context

### Problem Statement

**Current Situation:**

- Stripe (current payment provider) requires international credit/debit cards
- Many users in emerging markets (India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey) don't have international cards
- These users cannot access PRO features, limiting market penetration

**Solution:**

- Integrate dLocal payment gateway for emerging markets
- Support local payment methods (UPI, Paytm, JazzCash, GoPay, etc.)
- Maintain existing Stripe integration for other markets

**Expected Impact:**

- Expand addressable market to 8+ countries
- Enable 50-70% of emerging market users to subscribe (who previously couldn't)
- No changes to existing Stripe users

---

## 2. Key Differences: dLocal vs Stripe

| Feature                | Stripe              | dLocal                        | Impact                                |
| ---------------------- | ------------------- | ----------------------------- | ------------------------------------- |
| **Auto-Renewal**       | ✅ Automatic        | ❌ Manual renewal required    | We must send renewal reminders        |
| **Free Trial**         | ✅ 7 days           | ❌ None                       | dLocal users start paying immediately |
| **Subscription Plans** | Monthly ($29)       | 3-day ($1.99) + Monthly ($29) | New 3-day plan exclusive to dLocal    |
| **Discount Codes**     | ✅ All plans        | ❌ Monthly only               | 3-day plan ineligible for discounts   |
| **Renewal Process**    | Stripe auto-charges | User must manually renew      | Cron jobs handle expiry/downgrades    |
| **Notifications**      | Stripe manages      | We send all emails            | More notification templates needed    |

---

## 3. Supported Markets

### Countries (8 total)

| Country      | Code | Currency | Popular Payment Methods              |
| ------------ | ---- | -------- | ------------------------------------ |
| India        | IN   | INR (₹)  | UPI, Paytm, PhonePe, Net Banking     |
| Nigeria      | NG   | NGN (₦)  | Bank Transfer, USSD, Paystack, Verve |
| Pakistan     | PK   | PKR (Rs) | JazzCash, Easypaisa                  |
| Vietnam      | VN   | VND (₫)  | VNPay, MoMo, ZaloPay                 |
| Indonesia    | ID   | IDR (Rp) | GoPay, OVO, Dana, ShopeePay          |
| Thailand     | TH   | THB (฿)  | TrueMoney, Rabbit LINE Pay, Thai QR  |
| South Africa | ZA   | ZAR (R)  | Instant EFT, EFT                     |
| Turkey       | TR   | TRY (₺)  | Bank Transfer, Local Cards           |

### Pricing (USD Base)

| Plan        | Duration | Price (USD) | Discount Codes | Auto-Renewal | Notes                |
| ----------- | -------- | ----------- | -------------- | ------------ | -------------------- |
| **3-Day**   | 3 days   | $1.99       | ❌ NO          | ❌ NO        | dLocal only          |
| **Monthly** | 30 days  | $29.00      | ✅ YES         | ❌ NO        | Same price as Stripe |

**Local Currency Conversion:**

- All prices displayed in local currency
- Example (India): $29 = ₹2,407 (at ~83 INR/USD rate)
- Example (3-day India): $1.99 = ₹165

---

## 4. System Architecture

### 4.1 Unified Checkout Flow

```
User visits /checkout
    ↓
Country Detection (IP geolocation + manual selector)
    ↓
Payment Methods Loaded Dynamically
    ├─ dLocal Methods (if IN, NG, PK, VN, ID, TH, ZA, TR)
    │   ├─ UPI (India)
    │   ├─ JazzCash (Pakistan)
    │   ├─ GoPay (Indonesia)
    │   └─ ... etc
    └─ Stripe Card (always available as fallback)
    ↓
User Selects:
    ├─ Payment Provider (Stripe or dLocal)
    ├─ Payment Method (if dLocal: UPI, Paytm, etc.)
    ├─ Plan (3-day or Monthly)
    └─ Discount Code (if Monthly plan)
    ↓
Payment Processing:
    ├─ Stripe: Redirect to Stripe Checkout
    └─ dLocal: Redirect to dLocal Payment Page
    ↓
Webhook Receives Status
    ├─ Success: Upgrade to PRO, send email
    └─ Failure: Log failure, notify user
    ↓
User Returns to SaaS (PRO access activated)
```

### 4.2 Database Schema Changes

**Subscription Model Updates:**

```prisma
model Subscription {
  // NEW FIELDS for dLocal support
  paymentProvider       PaymentProvider  @default(STRIPE)  // 'STRIPE' | 'DLOCAL'

  // dLocal-specific fields (NULL for Stripe subscriptions)
  dlocalPaymentId       String?
  dlocalPaymentMethod   String?          // e.g., 'UPI', 'PAYTM', 'GOPAY'
  dlocalCountry         String?          // e.g., 'IN', 'ID', 'PK'
  dlocalCurrency        String?          // e.g., 'INR', 'IDR', 'PKR'

  // Pricing (used by both providers)
  planType              PlanType         // 'THREE_DAY' | 'MONTHLY'
  amount                Decimal          // Local currency amount
  amountUSD             Decimal          // USD equivalent
  currency              String           // Currency code

  // Manual renewal tracking (dLocal only)
  expiresAt             DateTime?
  renewalReminderSent   Boolean          @default(false)

  // ... existing Stripe fields remain unchanged
}
```

**New Payment Transaction Log:**

```prisma
model Payment {
  id                    String   @id @default(cuid())
  userId                String
  subscriptionId        String?

  provider              PaymentProvider  // 'STRIPE' | 'DLOCAL'
  providerPaymentId     String
  providerStatus        String

  amount                Decimal
  amountUSD             Decimal
  currency              String
  country               String
  paymentMethod         String

  planType              PlanType
  duration              Int              // 3 or 30 days
  discountCode          String?

  status                PaymentStatus    // 'PENDING' | 'COMPLETED' | 'FAILED'
  failureReason         String?

  initiatedAt           DateTime   @default(now())
  completedAt           DateTime?
  metadata              Json?
}
```

---

## 5. API Endpoints (New)

### 5.1 Payment Methods

**GET** `/api/payments/dlocal/methods?country={code}`

Returns available payment methods for a country.

**Response:**

```json
[
  {
    "id": "UP",
    "name": "UPI",
    "type": "BANK_TRANSFER",
    "flow": "REDIRECT",
    "provider": "dlocal",
    "icon": "📲",
    "description": "Pay via GPay, PhonePe, Paytm",
    "processingTime": "Instant",
    "recommended": true,
    "popular": true
  },
  {
    "id": "CARD",
    "name": "Credit/Debit Card",
    "type": "CARD",
    "flow": "DIRECT",
    "provider": "stripe",
    "icon": "💳",
    "description": "Visa, Mastercard, Amex",
    "processingTime": "Instant",
    "recommended": false
  }
]
```

### 5.2 Currency Conversion

**GET** `/api/payments/dlocal/convert?amount=29&currency=INR`

Converts USD to local currency.

**Response:**

```json
{
  "amountUSD": 29.0,
  "amountLocal": 2407,
  "currency": "INR",
  "exchangeRate": 83
}
```

### 5.3 Create Payment

**POST** `/api/payments/dlocal/create`

Creates a dLocal payment.

**Request:**

```json
{
  "planType": "MONTHLY",
  "paymentMethodId": "UP",
  "country": "IN",
  "currency": "INR",
  "amount": 2407,
  "amountUSD": 29.0,
  "discountCode": "WELCOME20",
  "payer": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response:**

```json
{
  "id": "PAY_dlocal_123",
  "status": "PENDING",
  "amount": 2407,
  "currency": "INR",
  "redirectUrl": "https://checkout.dlocal.com/pay/xyz",
  "expiresAt": "2025-11-16T11:00:00Z"
}
```

### 5.4 Webhook

**POST** `/api/webhooks/dlocal`

Receives payment status updates from dLocal.

**Webhook Payload:**

```json
{
  "id": "PAY_dlocal_123",
  "status": "PAID",
  "amount": 2407,
  "currency": "INR",
  "payment_method_id": "UP",
  "order_id": "SUB-user123-1234567890",
  "created_date": "2025-11-16T10:45:00Z"
}
```

**Actions on PAID status:**

1. Update payment record → COMPLETED
2. Create/update subscription → ACTIVE
3. Upgrade user tier → PRO
4. Send confirmation email
5. Set expiry date (NOW + 3 or 30 days)

---

## 6. Subscription Lifecycle (dLocal)

### 6.1 Payment Success Flow

```
Payment Webhook (status = PAID)
    ↓
1. Update Payment record (status: COMPLETED)
    ↓
2. Create Subscription record:
    - paymentProvider: DLOCAL
    - status: ACTIVE
    - tier: PRO
    - expiresAt: NOW + duration (3 or 30 days)
    ↓
3. Upgrade User tier: FREE → PRO
    ↓
4. Send confirmation email:
    - Payment successful
    - PRO access activated
    - Expiry date: {expiresAt}
    ↓
User can now access PRO features
```

### 6.2 Renewal Reminder Flow (3 days before expiry)

```
Cron Job: Daily at 00:00 UTC
    ↓
Query: Find subscriptions expiring in 3 days
WHERE paymentProvider = 'DLOCAL'
  AND status = 'ACTIVE'
  AND expiresAt BETWEEN NOW() AND NOW() + 3 days
  AND renewalReminderSent = false
    ↓
For each subscription:
    ├─ Send renewal reminder email:
    │   - Subject: "⏰ Your PRO subscription expires in 3 days"
    │   - Content: Renewal link, discount code (if available)
    │   - CTA: [Renew Now]
    └─ Mark renewalReminderSent = true
```

### 6.3 Expiry & Downgrade Flow

```
Cron Job: Every hour
    ↓
Query: Find expired subscriptions
WHERE paymentProvider = 'DLOCAL'
  AND status = 'ACTIVE'
  AND expiresAt <= NOW()
    ↓
For each subscription:
    ├─ Update subscription:
    │   - status: EXPIRED
    │   - tier: FREE
    └─ Update user:
        - tier: FREE
    ↓
Send expiry notification email:
    - Subject: "📉 PRO subscription expired"
    - Content: Downgraded to FREE, renewal link
    - CTA: [Reactivate PRO]
    ↓
User loses PRO access:
    - 15 symbols → 5 symbols
    - 9 timeframes → 3 timeframes
    - 20 alerts → 5 alerts
```

### 6.4 Cron Jobs Configuration

**Vercel Cron (vercel.json):**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 0 * * *" // Daily at midnight UTC
    },
    {
      "path": "/api/cron/downgrade-expired-subscriptions",
      "schedule": "0 * * * *" // Every hour
    }
  ]
}
```

---

## 7. Email Notifications (dLocal-Specific)

### 7.1 Payment Confirmed

**Trigger:** Webhook status = PAID
**Subject:** ✅ Payment Successful - PRO Access Activated

```
Your payment of ₹2,407 INR has been processed successfully.

PRO Tier Access: ACTIVATED
Plan: Monthly Subscription
Expires: December 16, 2025

Enjoying the PRO features? Renew before expiry to keep access!

[Manage Subscription]
```

### 7.2 Renewal Reminder (3 Days Before)

**Trigger:** Cron job (3 days before expiresAt)
**Subject:** ⏰ Your PRO subscription expires in 3 days

```
Your PRO subscription will expire on December 16, 2025.

Renew now to continue enjoying:
✓ 15 symbols × 9 timeframes = 135 chart combinations
✓ 20 alerts
✓ Priority support

[Renew Now]

💡 Tip: Enter discount code RENEW20 for 20% off!
```

### 7.3 Renewal Reminder (1 Day Before)

**Trigger:** Cron job (1 day before expiresAt)
**Subject:** 🚨 URGENT: PRO subscription expires tomorrow

```
Last chance! Your PRO access expires tomorrow.

Don't lose access to:
❌ 10 additional symbols (back to 5)
❌ 6 advanced timeframes (back to 3)
❌ 15 extra alerts (back to 5 max)

[Renew Now]
```

### 7.4 Subscription Expired

**Trigger:** Cron job (expiresAt reached)
**Subject:** 📉 PRO subscription expired - Downgraded to FREE

```
Your PRO subscription has expired.
You've been downgraded to FREE tier.

FREE Tier Limits:
• 5 symbols only
• 3 timeframes only
• 5 max alerts

[Reactivate PRO]
```

### 7.5 Payment Failed

**Trigger:** Webhook status = FAILED
**Subject:** ❌ Payment Failed

```
We couldn't process your payment of ₹2,407 INR.

Reason: Insufficient funds

Please try again with a different payment method or wallet.

[Try Again]
```

---

## 8. Implementation Plan

### Phase 1: Documentation & Planning ✅ COMPLETE

**Status:** ✅ Complete
**Files Created:**

- `docs/policies/07-dlocal-integration-rules.md` - Aider policy document
- `docs/dlocal-openapi-endpoints.yaml` - API specification
- `docs/implementation-guides/v5_part_r.md` - Part 18 implementation guide
- `docs/DLOCAL-INTEGRATION-SUMMARY.md` - This document

**Time Invested:** ~6 hours

---

### Phase 2: Foundation Setup (Not Started)

**Prerequisites:**

- Phase 1 complete (Parts 1-17 built)
- Stripe integration working
- User authentication working

**No additional setup needed** - dLocal uses existing infrastructure

---

### Phase 3: Building Part 18 (4 weeks, 120 hours)

**Week 1: Database & Services (30 hours)**

Files to create:

- ✅ Update `prisma/schema.prisma`
- ✅ Create migration
- ✅ `types/dlocal.ts`
- ✅ `lib/dlocal/constants.ts`
- ✅ `lib/dlocal/currency-converter.service.ts`
- ✅ `lib/dlocal/payment-methods.service.ts`
- ✅ `lib/dlocal/dlocal-payment.service.ts`
- ✅ `lib/geo/detect-country.ts`

**Week 2: API Routes (30 hours)**

Files to create:

- ✅ `app/api/payments/dlocal/methods/route.ts`
- ✅ `app/api/payments/dlocal/exchange-rate/route.ts`
- ✅ `app/api/payments/dlocal/convert/route.ts`
- ✅ `app/api/payments/dlocal/create/route.ts`
- ✅ `app/api/payments/dlocal/validate-discount/route.ts`
- ✅ `app/api/payments/dlocal/[paymentId]/route.ts`
- ✅ `app/api/webhooks/dlocal/route.ts`

**Week 3: Cron Jobs & Emails (30 hours)**

Files to create:

- ✅ `lib/cron/check-expiring-subscriptions.ts`
- ✅ `lib/cron/downgrade-expired-subscriptions.ts`
- ✅ `app/api/cron/check-expiring-subscriptions/route.ts`
- ✅ `app/api/cron/downgrade-expired-subscriptions/route.ts`
- ✅ Update `vercel.json`
- ✅ `lib/emails/send-renewal-reminder.ts`
- ✅ `lib/emails/send-expired-notification.ts`
- ✅ `lib/emails/send-payment-confirmation.ts`
- ✅ `lib/emails/send-payment-failure.ts`

**Week 4: Frontend & Testing (30 hours)**

Files to create:

- ✅ `components/payments/CountrySelector.tsx`
- ✅ `components/payments/PlanSelector.tsx`
- ✅ `components/payments/PaymentMethodSelector.tsx`
- ✅ `components/payments/PriceDisplay.tsx`
- ✅ `components/payments/DiscountCodeInput.tsx`
- ✅ `components/payments/PaymentButton.tsx`
- ✅ Update `app/checkout/page.tsx`
- ✅ Testing & debugging

**Total Files:** ~45 files

---

## 9. Testing Strategy

### 9.1 Unit Tests

- ✅ Currency conversion (USD → INR, NGN, PKR, etc.)
- ✅ Discount code validation
- ✅ Payment methods fetching
- ✅ Webhook signature verification
- ✅ Expiry date calculations

### 9.2 Integration Tests

- ✅ Complete payment flow (mock dLocal API)
- ✅ Webhook handling (PAID, REJECTED, CANCELLED)
- ✅ Subscription creation
- ✅ User tier upgrade/downgrade
- ✅ Cron job execution

### 9.3 End-to-End Tests (Manual)

**Test Scenario 1: India - UPI Payment (Monthly)**

1. User selects India → Sees UPI, Paytm, PhonePe, Card
2. Selects Monthly plan → Sees ₹2,407/month
3. Selects UPI payment method
4. Enters discount code "WELCOME20" → Price: ₹1,926 (20% off)
5. Clicks "Pay Now" → Redirected to dLocal UPI page
6. Completes UPI payment → Redirected back
7. Webhook fires → Subscription created (ACTIVE)
8. User tier: FREE → PRO
9. Email received: "Payment Successful"
10. Dashboard shows PRO features unlocked

**Expected:** ✅ All steps pass

**Test Scenario 2: Pakistan - 3-Day Plan (No Discount)**

1. User selects Pakistan → Sees JazzCash, Easypaisa, Card
2. Selects 3-Day plan → Sees Rs 552/3 days
3. Discount code input hidden (3-day plan restriction)
4. Selects JazzCash payment method
5. Completes payment
6. PRO access for 3 days
7. Day 3: Renewal reminder email sent
8. Day 4: Subscription expires → Downgraded to FREE

**Expected:** ✅ All steps pass

**Test Scenario 3: Cron Job Testing**

1. Create dLocal subscription with expiresAt = NOW + 3 days
2. Run cron: `GET /api/cron/check-expiring-subscriptions`
3. Verify renewal reminder email sent
4. Verify `renewalReminderSent = true` in database
5. Fast-forward time to expiresAt
6. Run cron: `GET /api/cron/downgrade-expired-subscriptions`
7. Verify subscription status = EXPIRED
8. Verify user tier = FREE
9. Verify expiry notification email sent

**Expected:** ✅ All steps pass

---

## 10. Success Criteria

### Functional Requirements

| Requirement                             | Status       | Notes          |
| --------------------------------------- | ------------ | -------------- |
| Single checkout page for both providers | ⏳ Not built | Part of Week 4 |
| Country detection with manual override  | ⏳ Not built | Part of Week 4 |
| Payment methods load dynamically        | ⏳ Not built | Part of Week 2 |
| Prices display in local currency        | ⏳ Not built | Part of Week 4 |
| 3-day plan exclusive to dLocal          | ⏳ Not built | Part of Week 4 |
| Discount codes on monthly only          | ⏳ Not built | Part of Week 4 |
| Payment processing works (8 countries)  | ⏳ Not built | Part of Week 2 |
| Webhooks handle success/failure         | ⏳ Not built | Part of Week 2 |
| Renewal reminders sent (3 days)         | ⏳ Not built | Part of Week 3 |
| Auto-downgrade on expiry                | ⏳ Not built | Part of Week 3 |

### Non-Functional Requirements

| Requirement              | Target                 | Status        |
| ------------------------ | ---------------------- | ------------- |
| Page load time           | < 3 seconds            | ⏳ Not tested |
| Payment method selection | Instant update         | ⏳ Not tested |
| Mobile responsive        | All screen sizes       | ⏳ Not tested |
| Accessibility            | WCAG 2.1 AA            | ⏳ Not tested |
| Error messages           | Clear & actionable     | ⏳ Not tested |
| API fallback             | Graceful degradation   | ⏳ Not tested |
| Webhook security         | Signature verification | ⏳ Not tested |
| Secrets handling         | Server-side only       | ⏳ Not tested |

---

## 11. Environment Variables

### Required Variables

```bash
# dLocal API Configuration
DLOCAL_API_URL=https://api.dlocal.com
DLOCAL_API_LOGIN=your_dlocal_login
DLOCAL_API_KEY=your_dlocal_api_key
DLOCAL_API_SECRET=your_dlocal_secret_key
DLOCAL_WEBHOOK_SECRET=your_webhook_secret

# dLocal Pricing (USD)
DLOCAL_3DAY_PRICE_USD=1.99
DLOCAL_MONTHLY_PRICE_USD=29.00

# Feature Flags
ENABLE_DLOCAL_PAYMENTS=true
ENABLE_3DAY_PLAN=true

# Cron Job Secret
CRON_SECRET=your_cron_secret_here
```

### Setup Instructions

1. Get dLocal credentials from https://dlocal.com
2. Add to `.env.local` for development
3. Add to Vercel environment variables for production
4. Configure webhook URL at dLocal dashboard:
   ```
   Production: https://yourdomain.com/api/webhooks/dlocal
   Staging: https://staging.yourdomain.com/api/webhooks/dlocal
   ```

---

## 12. Deployment Checklist

### Before Deploying to Production

- [ ] dLocal API credentials configured
- [ ] Webhook URL configured at dLocal dashboard
- [ ] Webhook secret matches `.env.local`
- [ ] Cron jobs configured in `vercel.json`
- [ ] Cron secret matches `.env.local`
- [ ] All 8 countries tested with mock payments
- [ ] Email templates tested
- [ ] Currency conversion tested
- [ ] Discount code validation tested
- [ ] Expiry cron jobs tested
- [ ] Database migration applied
- [ ] All environment variables set in Vercel

### Post-Deployment Monitoring

- [ ] Monitor webhook delivery success rate
- [ ] Monitor payment success/failure rates by country
- [ ] Monitor cron job execution logs
- [ ] Monitor email delivery rates
- [ ] Monitor subscription expiry handling
- [ ] Monitor exchange rate API performance
- [ ] Monitor dLocal API error rates

---

## 13. Cost Analysis

### dLocal Transaction Fees (Estimated)

| Country   | Payment Method | dLocal Fee | Net Revenue (from $29) |
| --------- | -------------- | ---------- | ---------------------- |
| India     | UPI            | ~2-3%      | $28.13 - $28.42        |
| Pakistan  | JazzCash       | ~3-4%      | $27.84 - $28.13        |
| Indonesia | GoPay          | ~3-4%      | $27.84 - $28.13        |
| Nigeria   | Bank Transfer  | ~3-5%      | $27.55 - $28.13        |

**Note:** Exact fees depend on dLocal contract. Contact dLocal for pricing.

### Infrastructure Costs

| Service             | Cost          | Notes                              |
| ------------------- | ------------- | ---------------------------------- |
| dLocal API calls    | Included      | No additional API call charges     |
| Vercel Cron Jobs    | Free          | 2 cron jobs (included in Pro plan) |
| Email Notifications | ~$0.001/email | Using Resend or similar            |
| Database Storage    | Minimal       | ~100 bytes per payment record      |

**Total Additional Cost:** < $1/month for infrastructure

---

## 14. Risk Mitigation

### Technical Risks

| Risk                     | Probability | Impact | Mitigation                                          |
| ------------------------ | ----------- | ------ | --------------------------------------------------- |
| dLocal API downtime      | Medium      | High   | Fallback to Stripe, show error message              |
| Webhook failures         | Low         | High   | Retry mechanism, manual reconciliation              |
| Exchange rate volatility | Medium      | Medium | Cache rates for 1 hour, fallback rates              |
| Cron job failures        | Low         | High   | Monitoring alerts, manual execution option          |
| Payment fraud            | Low         | High   | Webhook signature verification, transaction logging |

### Business Risks

| Risk                        | Probability | Impact | Mitigation                                  |
| --------------------------- | ----------- | ------ | ------------------------------------------- |
| Low conversion (3-day plan) | Medium      | Medium | A/B testing, user feedback                  |
| High churn (manual renewal) | High        | High   | 3-day + 1-day renewal reminders             |
| Country-specific issues     | Medium      | Medium | Gradual rollout, country-by-country testing |

---

## 15. Future Enhancements

### Phase 2 Improvements (After Launch)

1. **Auto-Renewal for dLocal** (if dLocal adds support)
   - Reduce manual renewal friction
   - Improve retention rates

2. **More Payment Methods**
   - Add country-specific methods as dLocal expands
   - Test and add new payment flows

3. **Subscription Analytics Dashboard**
   - Track dLocal vs Stripe conversion rates
   - Monitor churn by country
   - Analyze 3-day to monthly conversion

4. **Localization**
   - Translate checkout page to local languages
   - Currency symbol formatting
   - Country-specific messaging

5. **Referral Program Integration**
   - Affiliate discounts for dLocal users
   - Combine with existing affiliate system (Part 17)

---

## 16. Documentation Links

### Internal Documentation

- **Policy Rules:** `docs/policies/07-dlocal-integration-rules.md`
- **Implementation Guide:** `docs/implementation-guides/v5_part_r.md`
- **OpenAPI Spec:** `docs/dlocal-openapi-endpoints.yaml`
- **Integration Prompt:** `dlocal/dlocal-integration-prompt.md`

### External Resources

- dLocal API Documentation: https://docs.dlocal.com
- dLocal Dashboard: https://dashboard.dlocal.com
- Supported Payment Methods: https://docs.dlocal.com/reference/payment-methods
- Exchange Rates API: https://docs.dlocal.com/reference/exchange-rates

---

## 17. Contact & Support

### Development Team

- **Implementation:** Aider (MiniMax M2 model)
- **Validation:** Claude Code (automated)
- **Escalations:** Human decision maker

### dLocal Support

- **Technical Support:** support@dlocal.com
- **Account Manager:** (Assigned after signup)
- **Dashboard:** https://dashboard.dlocal.com

---

## Summary

### What We Built (Phase 1)

✅ Comprehensive policy document for Aider
✅ Complete OpenAPI specification for dLocal endpoints
✅ Detailed implementation guide (Part 18)
✅ Database schema design
✅ Integration summary (this document)

### What's Next (Phase 3)

⏳ Build all 45 files over 4 weeks
⏳ Test payment flows for all 8 countries
⏳ Deploy to production
⏳ Monitor and optimize

### Expected Timeline

- **Phase 1 (Complete):** 6 hours ✅
- **Phase 3 (Building):** 120 hours (4 weeks)
- **Total:** ~126 hours

### Success Metrics

**Target:**

- 50% of emerging market users can now subscribe (previously 0%)
- 3-day plan conversion rate > 15%
- 3-day to monthly upgrade rate > 30%
- Manual renewal rate > 60%

---

**This integration is ready for implementation in Phase 3 using the Aider + Claude Code + Human workflow.**
