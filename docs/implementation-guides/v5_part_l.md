# V5 Part L: E-commerce & Billing - Implementation Guide

**For:** Trading Alerts SaaS V7
**Part:** 12 - E-commerce & Billing
**Total Files:** 11 files
**Complexity:** High
**Last Updated:** 2025-11-21

---

## Overview

This guide provides the business logic and requirements for implementing the e-commerce and billing system using Stripe for the 2-tier subscription model (FREE vs PRO).

### Purpose

Enable users to upgrade from FREE to PRO tier, manage subscriptions, view invoices, and handle payment-related operations through Stripe integration.

### Key Features

- 2-tier pricing (FREE: $0/month, PRO: $29/month)
- Stripe Checkout integration
- Subscription management (upgrade/downgrade)
- Invoice history and downloads
- Webhook handling for subscription events
- Email notifications for billing events

---

## Business Requirements

###1. 2-Tier Pricing Model

**FREE Tier:**

- Price: $0/month (no payment required)
- Features:
  - 5 symbols (XAUUSD only in V5)
  - 3 timeframes (M15, H1, D1)
  - 5 alerts
  - Basic support

**PRO Tier:**

- Price: $29/month
- Billing: Monthly recurring via Stripe
- Features:
  - 10 symbols (XAUUSD, EURUSD, GBPUSD, USDJPY, AUDUSD, BTCUSD, ETHUSD, XAGUSD, NDX100, US30)
  - 7 timeframes (M15, M30, H1, H2, H4, H8, D1)
  - 20 alerts
  - Priority support
  - Advanced features

### 2. Subscription Lifecycle

**User Journey - Upgrade to PRO:**

1. User on FREE tier clicks "Upgrade to PRO" button
2. System creates Stripe Checkout session
3. User redirected to Stripe-hosted checkout page
4. User completes payment with credit card
5. Stripe sends `checkout.session.completed` webhook
6. System updates user tier to PRO in database
7. System sends upgrade confirmation email
8. User redirected back to dashboard with PRO access

**User Journey - Cancel PRO (Downgrade to FREE):**

1. User on PRO tier clicks "Cancel Subscription" button
2. System shows confirmation modal: "Are you sure? You'll lose PRO features."
3. User confirms cancellation
4. System cancels Stripe subscription (immediate cancellation)
5. Stripe sends `customer.subscription.deleted` webhook
6. System updates user tier to FREE in database
7. System sends cancellation confirmation email
8. User continues with FREE tier access

**Subscription Status Sync:**

- System syncs with Stripe via webhooks (real-time)
- Backup: Daily cron job checks subscription status for all PRO users
- If Stripe subscription inactive → downgrade to FREE

### 3. Stripe Integration

**Checkout Flow:**

```typescript
// Create Checkout Session
const session = await stripe.checkout.sessions.create({
  customer_email: user.email,
  line_items: [
    {
      price: process.env.STRIPE_PRO_PRICE_ID, // $29/month
      quantity: 1,
    },
  ],
  mode: 'subscription',
  success_url: `${process.env.NEXTAUTH_URL}/dashboard?upgrade=success`,
  cancel_url: `${process.env.NEXTAUTH_URL}/pricing?upgrade=cancelled`,
  metadata: {
    userId: user.id,
    tier: 'PRO',
  },
});
```

**Required Stripe Products:**

1. **PRO Monthly Subscription**
   - Product name: "Trading Alerts PRO"
   - Price: $29.00 USD
   - Billing: Monthly recurring
   - Price ID: Store in `STRIPE_PRO_PRICE_ID` environment variable

### 4. Webhook Events Handling

**Critical Events:**

**`checkout.session.completed`:**

- User completed payment
- Action:
  1. Extract userId from metadata
  2. Update user tier to PRO
  3. Create Subscription record in database
  4. Send upgrade confirmation email
  5. Log event

**`customer.subscription.updated`:**

- Subscription details changed (e.g., payment method updated)
- Action:
  1. Log event
  2. Sync subscription data to database
  3. If status changed from active → inactive: downgrade to FREE

**`customer.subscription.deleted`:**

- Subscription cancelled or expired
- Action:
  1. Update user tier to FREE
  2. Delete/mark Subscription record as cancelled
  3. Send cancellation email
  4. Log event

**`invoice.payment_failed`:**

- Payment failed (expired card, insufficient funds)
- Action:
  1. Send payment failure email to user
  2. Keep PRO access for 3 days grace period
  3. If not resolved after 3 days → downgrade to FREE
  4. Log event

**`invoice.payment_succeeded`:**

- Monthly payment successful
- Action:
  1. Update subscription nextBillingDate
  2. Send payment receipt email
  3. Log event

**Webhook Security:**

- Verify webhook signature using Stripe webhook secret
- Return 400 Bad Request if signature invalid
- Return 200 OK immediately after processing
- Process events asynchronously to avoid timeout

### 5. Invoice Management

**Invoice History:**

- Fetch invoices from Stripe API
- Display in user's billing settings page
- Show: Date, Amount, Status (Paid/Failed), Download link

**Invoice Data:**

```typescript
interface Invoice {
  id: string;
  date: Date;
  amount: number; // $29.00
  status: 'paid' | 'open' | 'failed';
  invoicePdfUrl: string; // Stripe-hosted PDF
  description: string; // "Trading Alerts PRO - Monthly"
}
```

**Pagination:**

- Show last 12 invoices (1 year)
- Load more on demand

---

## UI/UX Requirements

### Pricing Page (`/pricing`)

**Layout:**

- 2 pricing cards side-by-side (FREE vs PRO)
- Comparison table below cards

**FREE Card:**

- Title: "FREE"
- Price: "$0/month"
- Features list with checkmarks
- Button: "Current Plan" (if on FREE) or "Downgrade" (if on PRO)
- Style: Simple, muted colors

**PRO Card:**

- Title: "PRO"
- Price: "$29/month"
- Popular badge: "⭐ Most Popular"
- Features list with checkmarks (more features than FREE)
- Button: "Upgrade to PRO" (prominent, primary color)
- Style: Highlighted, border with accent color

**Comparison Table:**
| Feature | FREE | PRO |
|---------|------|-----|
| Symbols | 5 | 10 |
| Timeframes | 3 | 7 |
| Alerts | 5 | 20 |
| Support | Basic | Priority |
| Price | $0/month | $29/month |

### Billing Settings Page (`/settings/billing`)

**Current Subscription Section:**

- Display current tier (FREE or PRO)
- If PRO:
  - Show next billing date
  - Show payment method (last 4 digits of card)
  - Button: "Cancel Subscription" (red, secondary)
  - Button: "Update Payment Method" → Opens Stripe portal

**Invoice History Section:**

- Table of past invoices
- Columns: Date, Description, Amount, Status, Download
- Download button opens Stripe PDF in new tab

**Upgrade Section (if on FREE):**

- "Upgrade to PRO" button
- Shows PRO benefits
- Prominent call-to-action

### Upgrade Success Flow

**After Successful Payment:**

1. Redirect to `/dashboard?upgrade=success`
2. Show success toast: "🎉 Welcome to PRO! Your account has been upgraded."
3. Dashboard immediately shows PRO features unlocked
4. User receives confirmation email

**After Cancelled Checkout:**

1. Redirect to `/pricing?upgrade=cancelled`
2. Show info message: "Upgrade cancelled. You can upgrade anytime!"

### Downgrade Confirmation Modal

**When User Clicks "Cancel Subscription":**

**Modal Content:**

```
⚠️ Cancel PRO Subscription?

You will lose access to:
• 10 symbols (back to 5)
• 7 timeframes (back to 3)
• 20 alerts (back to 5)
• Priority support

Your subscription will be cancelled immediately.

[Cancel] [Yes, Cancel Subscription]
```

---

## Email Templates

### 1. Upgrade Confirmation Email

**Subject:** Welcome to Trading Alerts PRO! 🎉

**Body:**

```
Hi {name},

Welcome to Trading Alerts PRO!

Your account has been successfully upgraded. You now have access to:
✓ 10 trading symbols
✓ 7 timeframes
✓ 20 price alerts
✓ Priority support

Your subscription: $29/month
Next billing date: {nextBillingDate}

Manage your subscription: {billingUrl}

Happy trading!
Trading Alerts Team
```

### 2. Cancellation Confirmation Email

**Subject:** Your PRO subscription has been cancelled

**Body:**

```
Hi {name},

Your Trading Alerts PRO subscription has been cancelled.

You now have FREE tier access:
• 5 trading symbols
• 3 timeframes
• 5 price alerts

You can upgrade again anytime: {pricingUrl}

Thank you for trying PRO!
Trading Alerts Team
```

### 3. Payment Failed Email

**Subject:** Payment Failed - Action Required

**Body:**

```
Hi {name},

We couldn't process your payment for Trading Alerts PRO ($29/month).

Reason: {failureReason}

Please update your payment method within 3 days to keep your PRO access:
{updatePaymentUrl}

If not resolved, your account will be downgraded to FREE tier.

Need help? Reply to this email.

Trading Alerts Team
```

### 4. Payment Receipt Email

**Subject:** Payment Receipt - Trading Alerts PRO

**Body:**

```
Hi {name},

Your payment was successful!

Amount: $29.00
Date: {paymentDate}
Next billing date: {nextBillingDate}

Download invoice: {invoiceUrl}

Thank you for being a PRO member!
Trading Alerts Team
```

---

## API Endpoints

### POST /api/checkout

**Purpose:** Create Stripe Checkout session for PRO upgrade

**Request:**

```json
{
  "priceId": "price_xxx", // Stripe Price ID for $29/month
  "successUrl": "/dashboard?upgrade=success",
  "cancelUrl": "/pricing?upgrade=cancelled"
}
```

**Response:**

```json
{
  "sessionId": "cs_xxx",
  "url": "https://checkout.stripe.com/pay/cs_xxx"
}
```

**Logic:**

1. Verify user is authenticated
2. Check user is on FREE tier (can't upgrade if already PRO)
3. Create Stripe Checkout session
4. Return session URL
5. Client redirects to Stripe

### POST /api/subscription/cancel

**Purpose:** Cancel PRO subscription (immediate downgrade)

**Request:** Empty body

**Response:**

```json
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "tier": "FREE"
}
```

**Logic:**

1. Verify user is authenticated
2. Check user is on PRO tier
3. Fetch Stripe subscription ID from database
4. Cancel Stripe subscription
5. Update user tier to FREE
6. Send cancellation email
7. Return success

### GET /api/invoices

**Purpose:** List user's invoices

**Response:**

```json
{
  "invoices": [
    {
      "id": "in_xxx",
      "date": "2025-11-01",
      "amount": 29.0,
      "status": "paid",
      "invoicePdfUrl": "https://pay.stripe.com/invoice/xxx/pdf",
      "description": "Trading Alerts PRO - Monthly"
    }
  ]
}
```

**Logic:**

1. Verify user is authenticated
2. Fetch Stripe customer ID from database
3. Fetch invoices from Stripe API
4. Return formatted invoice list

### POST /api/webhooks/stripe

**Purpose:** Handle Stripe webhook events

**Request:** Stripe webhook payload (signed)

**Response:** `200 OK` (empty body)

**Logic:**

1. Verify webhook signature
2. Extract event type and data
3. Route to appropriate handler based on event type
4. Process event asynchronously
5. Return 200 OK immediately

---

## Error Handling

### Common Errors

**User Already on PRO:**

```json
{
  "error": "Already subscribed",
  "message": "You are already on the PRO tier",
  "code": "ALREADY_PRO"
}
```

**User Not on PRO (trying to cancel):**

```json
{
  "error": "No subscription",
  "message": "You don't have an active PRO subscription",
  "code": "NO_SUBSCRIPTION"
}
```

**Stripe API Error:**

```json
{
  "error": "Payment processing failed",
  "message": "Unable to process payment. Please try again.",
  "code": "STRIPE_ERROR"
}
```

**Webhook Signature Invalid:**

```json
{
  "error": "Invalid signature",
  "message": "Webhook signature verification failed",
  "code": "INVALID_SIGNATURE"
}
```

---

## Testing Requirements

### Manual Testing Checklist

**Upgrade Flow:**

- [ ] FREE user can access checkout
- [ ] Stripe checkout page loads correctly
- [ ] Test card payment succeeds (use Stripe test card: 4242424242424242)
- [ ] Webhook received and processed
- [ ] User tier updated to PRO
- [ ] Confirmation email sent
- [ ] User redirected to dashboard with success message

**Downgrade Flow:**

- [ ] PRO user can cancel subscription
- [ ] Confirmation modal displays
- [ ] Subscription cancelled in Stripe
- [ ] User tier updated to FREE
- [ ] Cancellation email sent

**Invoice History:**

- [ ] Invoices display correctly
- [ ] Download links work
- [ ] Pagination works (if more than 12 invoices)

### Stripe Test Cards

**Successful Payment:**

- Card: 4242 4242 4242 4242
- Exp: Any future date
- CVC: Any 3 digits

**Payment Failure:**

- Card: 4000 0000 0000 0341 (Card declined)

**3D Secure Required:**

- Card: 4000 0025 0000 3155

---

## Security Considerations

### Webhook Security

**Signature Verification:**

```typescript
const sig = req.headers['stripe-signature'];
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

try {
  const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  // Process event
} catch (err) {
  return res.status(400).send(`Webhook Error: ${err.message}`);
}
```

**Best Practices:**

- Always verify signature before processing
- Use environment variable for webhook secret
- Log all webhook events
- Handle idempotency (same event received multiple times)

### PCI Compliance

**Stripe Handles:**

- Credit card storage
- Payment processing
- PCI compliance

**We NEVER:**

- Store credit card numbers
- Handle raw card data
- Process payments directly

**We Store:**

- Stripe customer ID
- Stripe subscription ID
- Subscription status
- Last 4 digits of card (from Stripe)

---

## Migration from V4

**Changes:**

- Remove ENTERPRISE tier completely
- Update pricing: PRO is now $29/month (was $19/month in V4)
- Simplify subscription logic (only 2 tiers instead of 3)

**Database Migration:**

```sql
-- Update existing ENTERPRISE users to PRO
UPDATE users SET tier = 'PRO' WHERE tier = 'ENTERPRISE';

-- Cancel ENTERPRISE subscriptions (manual process)
-- Contact ENTERPRISE users about tier change
```

---

## Performance Considerations

### Webhook Processing

**Async Processing:**

- Receive webhook → Return 200 OK immediately
- Queue event for background processing
- Process event asynchronously (avoids timeout)

**Retry Logic:**

- Stripe retries failed webhooks automatically
- Implement idempotency to handle duplicate events

### Invoice Fetching

**Caching:**

- Cache invoice list for 5 minutes
- Invalidate cache on new payment

**Pagination:**

- Fetch invoices in batches of 12
- Load more on demand

---

## Summary

The E-commerce & Billing system provides seamless subscription management for the 2-tier model. Key implementation focus:

1. ✅ **Stripe Checkout** - Hosted payment page
2. ✅ **Webhook Handling** - Real-time subscription sync
3. ✅ **Upgrade/Downgrade** - Smooth tier transitions
4. ✅ **Invoice Management** - Download receipts
5. ✅ **Email Notifications** - Keep users informed
6. ✅ **Security** - PCI-compliant, signature verification

**Priority:** High - Critical for revenue generation.

---

**Reference:** This guide works with `docs/build-orders/part-12-ecommerce.md` for file-by-file build instructions.
