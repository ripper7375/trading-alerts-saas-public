# V5 Part S: dLocal Payment Integration - Implementation Guide

**For:** Trading Alerts SaaS V7
**Part:** 18 - dLocal Payments
**Total Files:** 45 files
**Complexity:** High
**Last Updated:** 2025-11-21

---

## Overview

Payment processing for emerging markets (India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey) using dLocal, enabling users without international credit cards to subscribe via local payment methods.

### Why dLocal?

**Problem:** Stripe requires international credit cards, which many users in emerging markets don't have.

**Solution:** dLocal supports 50+ local payment methods:

- India: UPI, Paytm, PhonePe, Google Pay
- Nigeria: Bank Transfer, Paystack, Flutterwave
- Pakistan: EasyPaisa, JazzCash, Bank Transfer
- Vietnam: MoMo, ZaloPay, Bank Transfer
- Indonesia: GoPay, OVO, DANA
- Thailand: TrueMoney, PromptPay, Bank Transfer
- South Africa: SnapScan, Instant EFT
- Turkey: Bank Transfer, Credit Card

### Key Features

- 8 supported countries
- 50+ local payment methods
- Unified checkout (Stripe + dLocal together)
- Country detection (IP geolocation)
- Real-time currency conversion
- Two plan options:
  - **3-day PRO trial:** $1.99 (dLocal exclusive, no auto-renewal)
  - **Monthly PRO:** $29 (Stripe + dLocal)
- Discount codes (monthly plans only)
- Manual renewal (no auto-renewal for dLocal)
- Payment tracking and status monitoring

---

## Business Requirements

### 1. Supported Countries & Currencies

| Country      | Currency           | Code | Example Price (Monthly)  |
| ------------ | ------------------ | ---- | ------------------------ |
| India        | Indian Rupee       | INR  | ₹2,450 ($29 × 84.5)      |
| Nigeria      | Nigerian Naira     | NGN  | ₦46,400 ($29 × 1,600)    |
| Pakistan     | Pakistani Rupee    | PKR  | ₨8,120 ($29 × 280)       |
| Vietnam      | Vietnamese Dong    | VND  | ₫730,000 ($29 × 25,172)  |
| Indonesia    | Indonesian Rupiah  | IDR  | Rp459,550 ($29 × 15,850) |
| Thailand     | Thai Baht          | THB  | ฿1,015 ($29 × 35)        |
| South Africa | South African Rand | ZAR  | R551 ($29 × 19)          |
| Turkey       | Turkish Lira       | TRY  | ₺1,015 ($29 × 35)        |

### 2. Pricing Plans

**3-Day PRO Trial** (dLocal Exclusive):

- Price: $1.99 USD (converted to local currency)
- Duration: 3 days
- Features: Full PRO access
- Renewal: Manual only (NO auto-renewal)
- Available: dLocal countries only

**Monthly PRO**:

- Price: $29 USD (converted to local currency)
- Duration: 30 days
- Features: Full PRO access
- Renewal: Manual (for dLocal), Auto (for Stripe)
- Available: All countries (Stripe + dLocal)
- Discount codes: Supported (5%, 10%, 15% off)

### 3. Payment Flow

**Step 1: Country Detection**

- Detect user country from IP address (use ipapi.co or similar)
- If country is one of 8 supported → Show dLocal option
- If country is other → Show Stripe only

**Step 2: Plan Selection**

- User selects: 3-Day Trial ($1.99) OR Monthly ($29)
- If monthly: Show discount code input
- Display price in local currency

**Step 3: Payment Method Selection**

- Fetch available payment methods from dLocal API for user's country
- Display payment methods as grid (icons + names)
- User selects payment method

**Step 4: Create Payment**

- Call dLocal API to create payment
- Receive redirect URL
- Redirect user to dLocal-hosted payment page

**Step 5: Payment Completion**

- dLocal processes payment
- dLocal redirects back to our success URL
- We verify payment status via dLocal API
- Update user tier to PRO
- Set expiry date (3 days or 30 days from now)
- Send confirmation email

**Step 6: Payment Status**

- User can check payment status on billing page
- Show: "Payment pending", "Payment successful", "Payment failed"

### 4. Payment Status Sync

**Webhook Handler:**

- dLocal sends webhook on payment status change
- Events: `payment.completed`, `payment.failed`, `payment.refunded`
- Verify webhook signature
- Update payment status in database
- If completed: Activate PRO access
- If failed: Send failure email with retry instructions

**Status Polling (Backup):**

- If webhook not received within 10 minutes, poll dLocal API
- Check payment status every 2 minutes (max 5 attempts)
- Update status when received

### 5. Subscription Expiry & Renewal

**Expiry Checking (Cron Job):**

- Run daily at midnight UTC
- Find all dLocal PRO subscriptions expiring today
- Send renewal reminder email (3 days before, 1 day before)
- On expiry day: Downgrade to FREE tier

**Renewal Flow:**

- No auto-renewal for dLocal (manual only)
- User clicks "Renew" button → Redirected to checkout
- Select same plan (3-day or monthly)
- Complete payment process again

---

## Currency Conversion

**Exchange Rate API:**

- Use exchangerate-api.com or similar
- Fetch rates once per day
- Cache rates in Redis (24-hour TTL)
- Formula: `Local Price = USD Price × Exchange Rate`

**Price Display:**

```typescript
function getLocalPrice(usdPrice: number, currency: string): string {
  const rate = await getExchangeRate(currency);
  const localPrice = usdPrice * rate;
  return formatCurrency(localPrice, currency);
}

// Example:
// $29 USD in India (INR, rate: 84.5)
// = 29 × 84.5 = ₹2,450.50
```

**Rounding Rules:**

- Round to nearest whole number for most currencies
- For IDR and VND: Round to nearest 100 (e.g., 459,550 → 459,600)

---

## Payment Methods by Country

**India (INR):**

- UPI
- Paytm
- PhonePe
- Google Pay
- Bank Transfer

**Nigeria (NGN):**

- Bank Transfer
- USSD
- Paystack
- Flutterwave

**Pakistan (PKR):**

- EasyPaisa
- JazzCash
- Bank Transfer

**Vietnam (VND):**

- MoMo
- ZaloPay
- ViettelPay
- Bank Transfer

**Indonesia (IDR):**

- GoPay
- OVO
- DANA
- Bank Transfer

**Thailand (THB):**

- TrueMoney
- PromptPay
- Bank Transfer

**South Africa (ZAR):**

- SnapScan
- Instant EFT
- Bank Transfer

**Turkey (TRY):**

- Credit Card
- Bank Transfer

---

## API Integration

### dLocal API Endpoints

**1. Create Payment:**

```
POST https://api.dlocal.com/v2/payments
```

**Request:**

```json
{
  "amount": 2450.5,
  "currency": "INR",
  "country": "IN",
  "payment_method_id": "UPI",
  "order_id": "order_123",
  "notification_url": "https://yourdomain.com/api/webhooks/dlocal",
  "success_url": "https://yourdomain.com/checkout/success",
  "cancel_url": "https://yourdomain.com/checkout/cancel"
}
```

**Response:**

```json
{
  "id": "PAY-123",
  "status": "pending",
  "redirect_url": "https://pay.dlocal.com/..."
}
```

**2. Get Payment Status:**

```
GET https://api.dlocal.com/v2/payments/{payment_id}
```

**Response:**

```json
{
  "id": "PAY-123",
  "status": "completed",
  "amount": 2450.5,
  "currency": "INR"
}
```

**3. Get Payment Methods:**

```
GET https://api.dlocal.com/v2/payment-methods?country={country_code}
```

**Response:**

```json
{
  "payment_methods": [
    {
      "id": "UPI",
      "name": "UPI",
      "type": "bank_transfer",
      "logo_url": "https://..."
    },
    ...
  ]
}
```

### Our API Endpoints

**POST /api/dlocal/payment-methods**

- Query: `?country={country_code}`
- Return: List of available payment methods for country

**POST /api/dlocal/exchange-rate**

- Query: `?currency={currency_code}`
- Return: Current exchange rate

**POST /api/dlocal/convert**

- Body: `{ usdAmount: 29, currency: 'INR' }`
- Return: Converted amount in local currency

**POST /api/dlocal/create-payment**

- Body: `{ plan: '3day' | 'monthly', paymentMethodId: 'UPI', country: 'IN' }`
- Return: Payment object with redirect URL

**GET /api/dlocal/payment-status/[id]**

- Return: Payment status

**POST /api/dlocal/validate-discount**

- Body: `{ code: 'SAVE10' }`
- Return: `{ valid: true, discount: 10 }` or `{ valid: false }`

**POST /api/webhooks/dlocal**

- Webhook handler for dLocal payment events

---

## UI/UX Requirements

### Unified Checkout Page

**Country Detection:**

- Auto-detect country from IP
- Show flag and country name
- Allow manual country change (dropdown)

**Payment Provider Selection:**

- If Stripe country: Show Stripe option only
- If dLocal country: Show both Stripe and dLocal options
- Clear indication of which provider supports which methods

**Plan Selection:**

- Two cards: "3-Day Trial ($1.99)" and "Monthly ($29)"
- 3-Day Trial: Only for dLocal countries, prominent badge "Try PRO for $1.99"
- Monthly: Available for all, option to enter discount code

**Payment Method Grid:**

- Display as grid of cards (3-4 per row)
- Each card shows:
  - Payment method logo
  - Payment method name
  - "Popular" badge (if applicable)
- Highlight selected method with border

**Price Display:**

- Show price in USD and local currency
- Example: "$29 USD (₹2,450 INR)"
- Update real-time when discount code applied

**Continue Button:**

- Disabled until plan and payment method selected
- Loading state during payment creation
- Redirect to dLocal payment page

### Billing Page Integration

**dLocal Subscription Section:**

- Show "Active until {expiryDate}"
- "Renew Now" button (manual renewal)
- Payment history table (past dLocal payments)
- Status badges: Completed / Pending / Failed

---

## Email Templates

### Payment Confirmation

**Subject:** Payment Successful - Welcome to PRO! 🎉

**Body:**

```
Hi {name},

Your payment of {amount} {currency} was successful!

Plan: {plan_name} ({duration})
Valid until: {expiry_date}

You now have full PRO access.

View invoice: {invoice_url}

Trading Alerts Team
```

### Renewal Reminder (3 days before)

**Subject:** Your PRO subscription expires in 3 days

**Body:**

```
Hi {name},

Your PRO subscription expires on {expiry_date}.

Renew now to keep your PRO access: {renew_url}

Plans:
• 3-Day Trial: {3day_price}
• Monthly: {monthly_price}

Trading Alerts Team
```

### Renewal Reminder (1 day before)

**Subject:** ⚠️ Your PRO subscription expires tomorrow

### Subscription Expired

**Subject:** Your PRO subscription has expired

**Body:**

```
Hi {name},

Your PRO subscription expired on {expiry_date}.

You've been downgraded to FREE tier.

Want to continue with PRO? Renew now: {renew_url}

Trading Alerts Team
```

### Payment Failed

**Subject:** Payment Failed - Please retry

**Body:**

```
Hi {name},

Your payment of {amount} {currency} failed.

Reason: {failure_reason}

Please try again: {retry_url}

Need help? Contact support: {support_email}

Trading Alerts Team
```

---

## Database Schema

**Payment Model:**

```prisma
model Payment {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  provider        String   // 'stripe' or 'dlocal'
  paymentId       String   @unique // Provider payment ID

  amount          Float
  currency        String
  status          String   // 'pending', 'completed', 'failed'

  plan            String   // '3day' or 'monthly'
  expiryDate      DateTime?

  paymentMethod   String?  // e.g., 'UPI', 'card'
  country         String?

  metadata        Json?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Subscription Model (Update):**

```prisma
model Subscription {
  // ... existing fields

  provider        String   // 'stripe' or 'dlocal'
  expiryDate      DateTime? // For dLocal (no auto-renewal)
  autoRenew       Boolean  @default(false) // false for dLocal
}
```

---

## Discount Codes

**Supported Discounts:**

- SAVE5: 5% off monthly plan
- SAVE10: 10% off monthly plan
- SAVE15: 15% off monthly plan

**Validation:**

- Codes are case-insensitive
- Only valid for monthly plan (not 3-day trial)
- One code per purchase
- No expiration (always valid)

**Application:**

- Apply before currency conversion
- Example: $29 - 10% = $26.10 → Convert to INR

**Storage:**

- Store used codes in Payment metadata
- Track discount usage for analytics

---

## Security Considerations

### Webhook Verification

**dLocal Webhook Signature:**

```typescript
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === expectedSignature;
}
```

**Best Practices:**

- Always verify signature before processing
- Use environment variable for webhook secret
- Log all webhook events
- Handle idempotency (same event received multiple times)

### Payment Data Security

**DO NOT Store:**

- Credit card numbers
- Bank account numbers
- Payment method credentials

**DO Store:**

- dLocal payment ID
- Payment status
- Amount and currency
- Expiry date

---

## Testing

### Test Mode

**dLocal Test API:**

- Use sandbox environment: https://sandbox.dlocal.com
- Test API keys from dLocal dashboard
- Test payment methods available

**Test Payment Methods:**

- UPI: Use test UPI ID `test@upi`
- Card: Use test card numbers from dLocal docs
- Bank Transfer: Simulate with test credentials

**Test Scenarios:**

- Successful payment → Verify PRO access granted
- Failed payment → Verify error handling
- Expired subscription → Verify downgrade to FREE
- Renewal → Verify manual renewal works

---

## Performance Considerations

### Caching

**Exchange Rates:**

- Cache for 24 hours
- Update once per day at midnight UTC

**Payment Methods:**

- Cache for 1 hour per country
- Invalidate on dLocal API updates

### Webhook Processing

**Async Processing:**

- Receive webhook → Return 200 OK immediately
- Queue event for background processing
- Process asynchronously to avoid timeout

---

## Summary

dLocal integration enables emerging market access:

1. ✅ **8 Countries** - India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey
2. ✅ **50+ Payment Methods** - Local payment options
3. ✅ **Currency Conversion** - Real-time exchange rates
4. ✅ **3-Day Trial** - Low-cost entry point ($1.99)
5. ✅ **Manual Renewal** - No auto-charge surprises
6. ✅ **Unified Checkout** - Stripe + dLocal together
7. ✅ **Discount Codes** - Monthly plan discounts

**Priority:** Medium - Post-MVP expansion feature.

**Revenue Impact:** Opens $580B emerging markets ($58,000/month potential at 10K users).

---

**Reference:** This guide works with `docs/build-orders/part-18-dlocal.md` for file-by-file build instructions.
