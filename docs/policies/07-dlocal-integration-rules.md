# dLocal Payment Integration Rules for Aider

## Purpose

This document defines the architectural and business rules for integrating dLocal payment processing into the Trading Alerts SaaS, enabling users from emerging markets without international credit cards to subscribe to PRO plans. These rules ensure dLocal integrates seamlessly with existing Stripe infrastructure while maintaining policy compliance for Aider + Claude Code + Human workflow.

---

## 1. BUSINESS RULES - dLocal vs Stripe Differences

### 1.1 Critical Differences from Stripe

**Rule:** dLocal subscriptions behave fundamentally differently from Stripe subscriptions. Never apply Stripe's auto-renewal logic to dLocal.

| Feature                   | Stripe                            | dLocal                                            |
| ------------------------- | --------------------------------- | ------------------------------------------------- |
| **Auto-Renewal**          | ✅ Automatic monthly renewal      | ❌ NO auto-renewal - Manual payment required      |
| **Free Trial**            | ✅ 7-day free trial               | ❌ NO free trial period                           |
| **Subscription Plans**    | Monthly only                      | **3-day** (NEW) + Monthly                         |
| **Discount Codes**        | ✅ On all plans                   | ❌ Monthly only (NOT on 3-day)                    |
| **Payment Flow**          | Card authorization → Subscription | One-time payment → Manual subscription activation |
| **Renewal Notifications** | Stripe manages                    | **We must send** 3 days before expiry             |
| **Expiry Handling**       | Stripe auto-downgrade             | **We must manually downgrade** to FREE            |

**Why this matters:** Mixing Stripe and dLocal logic will cause incorrect subscription states, charge failures, and user access issues.

---

### 1.2 Subscription Duration Rules

**dLocal-Specific Plan Options:**

```typescript
// dLocal Subscription Plans
const DLOCAL_PLANS = {
  THREE_DAY: {
    duration: 3, // 3 days
    price_usd: 1.99, // Base price in USD
    code: 'DLOCAL_3DAY',
    discountAllowed: false, // ❌ NO discount codes
    trialPeriod: false, // ❌ NO trial
    autoRenewal: false, // ❌ Manual renewal only
  },
  MONTHLY: {
    duration: 30, // 30 days
    price_usd: 29.0, // Base price in USD
    code: 'DLOCAL_MONTHLY',
    discountAllowed: true, // ✅ Discount codes allowed
    trialPeriod: false, // ❌ NO trial
    autoRenewal: false, // ❌ Manual renewal only
  },
} as const;

// Stripe Plans (for comparison)
const STRIPE_PLANS = {
  MONTHLY: {
    duration: 30,
    price_usd: 29.0,
    code: 'STRIPE_MONTHLY',
    discountAllowed: true,
    trialPeriod: 7, // ✅ 7-day trial
    autoRenewal: true, // ✅ Auto-renewal
  },
} as const;
```

**Implementation:**

- ✅ 3-day plan is exclusive to dLocal (NOT available with Stripe)
- ✅ Monthly dLocal plan same price as Stripe ($29/month)
- ✅ All dLocal plans require manual renewal before expiry
- ❌ Never create Stripe-style subscription objects for dLocal

---

### 1.3 Discount Code Rules

**Rule:** Discount codes work differently for dLocal vs Stripe plans.

```typescript
// Discount code validation logic
function canApplyDiscountCode(
  plan: string,
  paymentProvider: 'stripe' | 'dlocal'
): boolean {
  // Stripe: All plans support discount codes
  if (paymentProvider === 'stripe') {
    return true;
  }

  // dLocal: Only MONTHLY plan supports discount codes
  if (paymentProvider === 'dlocal') {
    if (plan === 'DLOCAL_3DAY') {
      return false; // ❌ 3-day plan: NO discount codes
    }
    if (plan === 'DLOCAL_MONTHLY') {
      return true; // ✅ Monthly plan: discount codes allowed
    }
  }

  return false;
}
```

**UI Behavior:**

- When user selects **3-day dLocal plan**: Hide discount code input field entirely
- When user selects **Monthly dLocal plan**: Show discount code input with validation
- When user selects **Stripe plan**: Always show discount code input

---

### 1.4 Early Renewal & Subscription Stacking

**Rule:** dLocal users can renew BEFORE expiry. The system extends their PRO access by adding new period to remaining time.

#### Monthly Plan Early Renewal (ALLOWED)

**Business Logic:**

- ✅ User can pay for monthly subscription before current subscription expires
- ✅ System calculates: `remaining_days + 30_days = total_PRO_period`
- ✅ No limit on how early (can renew with 29 days remaining)
- ✅ Discount codes apply to renewal payments

**Example:**

```typescript
// User's current subscription
const currentSubscription = {
  expiresAt: new Date('2025-12-01'), // 10 days from now
  tier: 'PRO',
};

// User pays for monthly renewal today (Nov 21)
const renewalPayment = {
  planType: 'MONTHLY',
  duration: 30,
  paidAt: new Date('2025-11-21'),
};

// System calculation
const remainingDays = 10; // Days until Dec 1
const addedDays = 30; // New monthly period
const newExpiryDate = new Date('2025-12-31'); // 10 + 30 = 40 days from now

// Result: User gets 40 days of PRO access total
```

**Implementation:**

```typescript
async function processEarlyRenewal(
  userId: string,
  planType: 'MONTHLY'
): Promise<Date> {
  const currentSub = await prisma.subscription.findUnique({
    where: { userId },
  });

  let newExpiryDate: Date;

  if (currentSub && currentSub.expiresAt && currentSub.expiresAt > new Date()) {
    // User has active subscription - extend from current expiry
    const remainingMs = currentSub.expiresAt.getTime() - Date.now();
    const addedMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    newExpiryDate = new Date(currentSub.expiresAt.getTime() + addedMs);
  } else {
    // No active subscription - start from now
    newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  await prisma.subscription.update({
    where: { userId },
    data: {
      expiresAt: newExpiryDate,
      tier: 'PRO',
      status: 'ACTIVE',
      renewalReminderSent: false, // Reset reminder flag
    },
  });

  return newExpiryDate;
}
```

---

#### 3-Day Plan Early Renewal (PROHIBITED)

**Rule:** 3-day plan CANNOT be purchased if user has ANY active subscription.

**Validation:**

```typescript
async function canPurchaseThreeDayPlan(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
    },
  });

  // Check 1: Already used 3-day plan (lifetime restriction)
  if (user.hasUsedThreeDayPlan) {
    return {
      allowed: false,
      reason: '3-day plan is a one-time offer. Please select monthly plan.',
    };
  }

  // Check 2: Currently has active subscription (any type)
  if (
    user.subscription &&
    user.subscription.expiresAt &&
    user.subscription.expiresAt > new Date()
  ) {
    return {
      allowed: false,
      reason:
        'You already have an active PRO subscription. The 3-day plan cannot be purchased while you have active PRO access.',
    };
  }

  return { allowed: true };
}
```

**Why Prohibited:**

- Prevents abuse (user stacking multiple 3-day periods)
- 3-day plan is introductory offer, not renewable
- User should upgrade to monthly for continued access

**UI Behavior:**

```tsx
// Hide 3-day plan option if user has active subscription
{
  !hasActiveSubscription && !hasUsedThreeDayPlan && (
    <PlanOption value="3-day">3-Day PRO Plan - $1.99</PlanOption>
  );
}

{
  hasActiveSubscription && (
    <Notice>
      You already have active PRO access until {expiryDate}. You can renew with
      a monthly plan to extend your subscription.
    </Notice>
  );
}
```

---

### 1.5 Subscription Cancellation (dLocal vs Stripe)

**Rule:** dLocal subscriptions CANNOT be cancelled because there's no auto-renewal to cancel.

#### Stripe Cancellation (ALLOWED)

**Use Case:** Stop future automatic charges

```typescript
// Stripe user can cancel auto-renewal
async function cancelStripeSubscription(userId: string) {
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  // User keeps PRO access until current period ends
  // Then auto-downgrades to FREE
}
```

**UI:**

```tsx
{
  subscription.provider === 'STRIPE' && (
    <Button onClick={handleCancelSubscription}>Cancel Auto-Renewal</Button>
  );
}
```

---

#### dLocal Cancellation (NOT APPLICABLE)

**Rule:** NO cancellation feature for dLocal users.

**Why:**

- ❌ dLocal has NO auto-renewal
- ❌ User already paid for fixed period (3 or 30 days)
- ❌ No future charges to cancel
- ✅ Subscription naturally expires at end of period

**Instead:** User simply doesn't renew

```typescript
// dLocal user doesn't need to "cancel"
// They just don't make another payment
// System auto-downgrades to FREE when expiresAt is reached
```

**UI Behavior:**

```tsx
{
  subscription.provider === 'DLOCAL' && (
    <Notice>
      Your PRO subscription is active until {expiryDate}. No auto-renewal -
      simply renew before expiry to continue PRO access.
    </Notice>
  );
}

{
  /* DO NOT show cancellation button for dLocal users */
}
{
  subscription.provider === 'STRIPE' && (
    <Button variant="destructive">Cancel Subscription</Button>
  );
}
```

**Account Settings Page:**

```tsx
// Stripe user sees:
┌─────────────────────────────────────────┐
│  Current Plan: PRO (Monthly)            │
│  Next Billing: Dec 1, 2025 - $29.00    │
│  Auto-Renewal: ON                       │
│  [Cancel Subscription]                  │
└─────────────────────────────────────────┘

// dLocal user sees:
┌─────────────────────────────────────────┐
│  Current Plan: PRO (Monthly)            │
│  Expires: Dec 1, 2025                   │
│  Auto-Renewal: Not applicable           │
│  [Renew Subscription]                   │
└─────────────────────────────────────────┘
```

---

### 1.6 Currency Settlement (USD Only)

**Rule:** Regardless of what local currency users pay with, you receive USD only.

**dLocal FX@Transfer Model:**

- ✅ Users pay in **local currency** (INR, PKR, NGN, VND, IDR, THB, ZAR, TRY)
- ✅ dLocal converts to **USD** using their exchange rate
- ✅ You receive **USD only** in your dLocal account
- ✅ dLocal absorbs FX fluctuation risk (you get fixed USD amount)

**Database Storage:**

```typescript
// Always store both amounts
model Payment {
  // Amount user paid in local currency
  amount          Decimal  // e.g., 2407.00 (INR)
  currency        String   // e.g., 'INR'

  // Amount YOU receive in USD
  amountUSD       Decimal  // e.g., 29.00 (USD)

  // Exchange rate used (for audit trail)
  exchangeRate    Decimal? // e.g., 83.00 (INR per USD)
}
```

**Accounting:**

- ✅ Revenue calculations: Use `amountUSD` field only
- ✅ Financial reports: USD amounts only
- ✅ Tax calculations: Based on USD received
- ❌ Never calculate revenue from local currency amounts

---

### 1.7 3-Day Plan Anti-Abuse Rules

**SECURITY RISK IDENTIFIED:**

User could exploit 3-day plan pricing:

- 3-day plan: $1.99 ÷ 3 = **$0.663/day**
- Monthly (20% discount): $23.20 ÷ 30 = **$0.773/day**
- **Abuse scenario:** User buys 3-day plan repeatedly instead of monthly to save $3.30/month

**MANDATORY ANTI-ABUSE RULES:**

#### Rule 1: One-Time Use Per Account (PRIMARY DEFENSE)

**Rule:** 3-day plan can ONLY be purchased ONCE per user account, ever. Additionally, it CANNOT be purchased if user has ANY active subscription.

```typescript
// lib/dlocal/three-day-validator.ts
async function canPurchaseThreeDayPlan(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
    },
  });

  if (!user) {
    return {
      allowed: false,
      reason: 'User not found',
    };
  }

  // Check 1: Already used 3-day plan (lifetime restriction)
  if (user.hasUsedThreeDayPlan) {
    return {
      allowed: false,
      reason:
        '3-day plan is a one-time introductory offer. Please select monthly plan.',
    };
  }

  // Check 2: Currently has active subscription (any type - 3-day OR monthly)
  if (
    user.subscription &&
    user.subscription.expiresAt &&
    user.subscription.expiresAt > new Date()
  ) {
    return {
      allowed: false,
      reason:
        'You already have an active PRO subscription. The 3-day plan cannot be purchased while you have active PRO access. Use monthly plan to extend your subscription.',
    };
  }

  return { allowed: true };
}
```

#### Rule 2: Email + Payment Method Tracking (SECONDARY DEFENSE)

**Rule:** Track 3-day plan purchases by email AND payment method hash to prevent multi-account abuse.

```typescript
// Store payment method fingerprint
model Payment {
  // Hash of payment details (NOT full details for privacy)
  paymentMethodHash  String?  // SHA256(email + payment_method_id)
}

// Check for duplicate payment methods
async function detectMultiAccountAbuse(
  email: string,
  paymentMethodId: string
): Promise<boolean> {
  const hash = createHash('sha256')
    .update(`${email}:${paymentMethodId}`)
    .digest('hex');

  const existingPurchase = await prisma.payment.findFirst({
    where: {
      planType: 'THREE_DAY',
      paymentMethodHash: hash
    }
  });

  return existingPurchase !== null; // true = abuse detected
}
```

#### Rule 3: Monitoring & Alerts (TERTIARY DEFENSE)

**Rule:** Flag suspicious patterns for manual review.

```typescript
// Flag patterns indicating abuse attempts
const SUSPICIOUS_PATTERNS = {
  // Same IP purchasing 3-day plans on multiple accounts within 30 days
  MULTIPLE_ACCOUNTS_SAME_IP: {
    threshold: 2, // Max 2 accounts from same IP
    window: 30, // Within 30 days
  },

  // Same device fingerprint
  MULTIPLE_ACCOUNTS_SAME_DEVICE: {
    threshold: 2,
    window: 30,
  },

  // Account created immediately before 3-day purchase
  FRESH_ACCOUNT_PURCHASE: {
    accountAge: 1, // Account < 1 hour old
  },
};

// Log for manual review
async function logSuspiciousActivity(
  userId: string,
  pattern: string,
  metadata: Record<string, any>
) {
  await prisma.fraudAlert.create({
    data: {
      userId,
      pattern,
      metadata,
      severity: 'MEDIUM',
      status: 'PENDING_REVIEW',
    },
  });
}
```

#### Rule 4: UI Messaging

**Rule:** Clearly communicate 3-day plan restrictions upfront.

```tsx
// components/PlanSelector.tsx
{
  provider === 'dlocal' && (
    <div className="plan-option three-day">
      <h3>3-Day PRO Plan</h3>
      <p className="price">$1.99 (one-time)</p>

      {/* Clear messaging about restrictions */}
      <div className="restriction-notice">
        <AlertIcon />
        <p>
          <strong>One-time offer:</strong> Available once per account. After 3
          days, upgrade to monthly plan to continue PRO access.
        </p>
      </div>

      {hasUsedThreeDayPlan && (
        <div className="restriction-blocked">
          <p>
            You've already used the 3-day trial offer. Please select the monthly
            plan.
          </p>
        </div>
      )}

      <Button disabled={hasUsedThreeDayPlan} onClick={handleThreeDayPurchase}>
        {hasUsedThreeDayPlan ? 'Not Available' : 'Try 3 Days'}
      </Button>
    </div>
  );
}
```

#### Database Schema Additions

**Rule:** Track all 3-day plan usage for enforcement.

```prisma
model User {
  id                      String   @id @default(cuid())
  email                   String   @unique

  // NEW: 3-day plan tracking
  hasUsedThreeDayPlan     Boolean  @default(false)
  threeDayPlanUsedAt      DateTime?

  // NEW: Fraud detection
  accountCreatedAt        DateTime @default(now())
  lastLoginIP             String?
  deviceFingerprint       String?
}

model Payment {
  // ... existing fields ...

  // NEW: Anti-abuse tracking
  paymentMethodHash       String?
  purchaseIP              String?
  deviceFingerprint       String?
  accountAgeAtPurchase    Int?     // Account age in hours
}

// NEW: Fraud monitoring
model FraudAlert {
  id                      String   @id @default(cuid())
  userId                  String
  pattern                 String   // 'MULTIPLE_ACCOUNTS_SAME_IP', etc.
  metadata                Json
  severity                String   // 'LOW' | 'MEDIUM' | 'HIGH'
  status                  String   // 'PENDING_REVIEW' | 'CONFIRMED' | 'FALSE_POSITIVE'
  createdAt               DateTime @default(now())
  reviewedAt              DateTime?
  reviewedBy              String?

  user                    User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}
```

#### Implementation Checklist

- [ ] Add `hasUsedThreeDayPlan` boolean to User model
- [ ] Implement `canPurchaseThreeDayPlan()` validation function
- [ ] Add validation to `/api/payments/dlocal/create` endpoint
- [ ] Return 403 error if user already used 3-day plan
- [ ] UI: Check eligibility before showing 3-day option
- [ ] UI: Show "Not Available" message if already used
- [ ] Store payment method hash for all 3-day purchases
- [ ] Implement fraud detection monitoring (optional but recommended)
- [ ] Add admin dashboard to review fraud alerts
- [ ] Set up email alerts for high-severity fraud patterns

#### Error Responses

```typescript
// API response when 3-day plan already used
{
  error: '3-day plan is a one-time offer per account',
  code: 'THREE_DAY_PLAN_ALREADY_USED',
  message: 'You have already purchased the 3-day plan on [date]. Please select the monthly plan to continue.',
  usedAt: '2025-11-10T14:23:00Z',
  alternativePlans: [
    {
      id: 'DLOCAL_MONTHLY',
      name: 'Monthly PRO Plan',
      price: 29.00,
      discountEligible: true
    }
  ]
}
```

**Summary of Anti-Abuse Strategy:**

1. **Primary:** Enforce one-time use per account (hard block)
2. **Secondary:** Track by email + payment method (detect multi-account abuse)
3. **Tertiary:** Monitor suspicious patterns (manual review queue)
4. **UI/UX:** Clear messaging upfront (transparency)

---

## 2. ARCHITECTURE RULES

### 2.1 Unified Checkout Page

**Rule:** Single checkout page (`app/checkout/page.tsx`) displays BOTH Stripe and dLocal payment options.

**Why this matters:** Users should see all payment methods in one place. No country-specific separate pages or redirects before checkout.

**Structure:**

```typescript
// app/checkout/page.tsx - Unified Checkout Component
export default function CheckoutPage() {
  // 1. Detect country (IP geolocation + manual selector)
  const [country, setCountry] = useState<string | null>(null);

  // 2. Load payment methods dynamically
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // 3. User selects payment provider (stripe or dlocal)
  const [selectedProvider, setSelectedProvider] = useState<'stripe' | 'dlocal' | null>(null);

  // 4. User selects payment method (if dlocal: UPI, Paytm, etc.)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  // 5. User selects plan duration
  const [selectedPlan, setSelectedPlan] = useState<'3day' | 'monthly'>('monthly');

  // 6. Process payment based on selected provider
  const handlePayment = () => {
    if (selectedProvider === 'stripe') {
      return processStripeCheckout();
    } else if (selectedProvider === 'dlocal') {
      return processDLocalCheckout();
    }
  };

  return (
    <div>
      {/* Country Selector */}
      <CountrySelector country={country} onChange={setCountry} />

      {/* Plan Selector - Shows different options for Stripe vs dLocal */}
      <PlanSelector
        provider={selectedProvider}
        selectedPlan={selectedPlan}
        onChange={setSelectedPlan}
      />

      {/* Payment Methods Grid */}
      <PaymentMethodSelector
        methods={paymentMethods}
        onSelect={(provider, methodId) => {
          setSelectedProvider(provider);
          setSelectedMethod(methodId);
        }}
      />

      {/* Discount Code Input - Conditionally shown */}
      {canShowDiscountCode(selectedProvider, selectedPlan) && (
        <DiscountCodeInput />
      )}

      {/* Payment Button */}
      <PaymentButton onClick={handlePayment} />
    </div>
  );
}
```

**Key Rules:**

- ✅ ONE checkout page for both providers
- ✅ Country detection determines available payment methods
- ✅ Plan selection updates discount code availability
- ❌ Never redirect to different pages for Stripe vs dLocal
- ❌ Never show 3-day plan option when Stripe is selected

---

### 2.2 Database Schema Separation

**Rule:** Use existing `subscriptions` table with provider-specific columns. Do NOT create separate tables for dLocal.

**Schema:**

```prisma
model Subscription {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Payment Provider Field (NEW)
  paymentProvider       PaymentProvider  @default(STRIPE)  // 'STRIPE' | 'DLOCAL'

  // Stripe-specific fields
  stripeSubscriptionId  String?          // Null for dLocal subscriptions
  stripeCustomerId      String?
  stripePriceId         String?

  // dLocal-specific fields (NEW)
  dlocalPaymentId       String?          // Null for Stripe subscriptions
  dlocalPaymentMethod   String?          // e.g., 'UPI', 'PAYTM', 'GOPAY'
  dlocalCountry         String?          // e.g., 'IN', 'ID', 'PK'
  dlocalCurrency        String?          // e.g., 'INR', 'IDR', 'PKR'

  // Common fields (used by both providers)
  status                SubscriptionStatus @default(ACTIVE)
  tier                  UserTier           @default(FREE)
  planType              PlanType           // 'THREE_DAY' | 'MONTHLY'

  // Billing cycle
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime

  // Pricing
  amount                Decimal            // Amount paid in local currency
  amountUSD             Decimal            // Equivalent amount in USD
  currency              String             // Currency code (USD, INR, IDR, etc.)

  // Discount tracking
  discountCode          String?            // Null if no discount applied
  discountPercentage    Int?               // e.g., 20 for 20% off

  // Metadata
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt
  cancelledAt           DateTime?
  expiresAt             DateTime?          // For manual renewal tracking

  @@index([userId])
  @@index([paymentProvider])
  @@index([status])
  @@index([expiresAt])  // For renewal notification queries
}

// Enums
enum PaymentProvider {
  STRIPE
  DLOCAL
}

enum SubscriptionStatus {
  ACTIVE           // Currently active subscription
  EXPIRED          // Subscription period ended (dLocal)
  CANCELLED        // User cancelled (both)
  PAYMENT_FAILED   // Stripe payment failed
  PENDING          // Awaiting payment confirmation (dLocal)
}

enum PlanType {
  THREE_DAY        // dLocal only
  MONTHLY          // Both Stripe and dLocal
}
```

**Why this approach:**

- ✅ Single source of truth for all subscriptions
- ✅ Easy to query "active PRO users" regardless of provider
- ✅ Maintains referential integrity with User table
- ❌ Avoids complexity of multiple subscription tables
- ❌ Prevents data synchronization issues

---

### 2.3 Payment Transaction Logging

**Rule:** Log ALL payment attempts (successful and failed) in separate `payments` table for debugging and accounting.

**Schema:**

```prisma
model Payment {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])
  subscriptionId        String?
  subscription          Subscription? @relation(fields: [subscriptionId], references: [id])

  // Provider info
  provider              PaymentProvider  // 'STRIPE' | 'DLOCAL'
  providerPaymentId     String           // Stripe payment intent ID or dLocal payment ID
  providerStatus        String           // Provider's raw status string

  // Payment details
  amount                Decimal
  amountUSD             Decimal
  currency              String
  country               String           // User's country
  paymentMethod         String           // 'card', 'UPI', 'PAYTM', etc.

  // Plan details
  planType              PlanType
  duration              Int              // Days (3 or 30)

  // Discount details
  discountCode          String?
  discountAmount        Decimal?

  // Status
  status                PaymentStatus
  failureReason         String?          // If failed

  // Timestamps
  initiatedAt           DateTime   @default(now())
  completedAt           DateTime?
  failedAt              DateTime?

  // Metadata (store raw provider response for debugging)
  metadata              Json?

  @@index([userId])
  @@index([provider, providerPaymentId])
  @@index([status])
  @@index([createdAt])
}

enum PaymentStatus {
  PENDING              // Payment initiated, waiting for confirmation
  COMPLETED            // Payment successful
  FAILED               // Payment failed
  REFUNDED             // Payment refunded
  CANCELLED            // Payment cancelled by user
}
```

**Why separate payments table:**

- ✅ Complete audit trail for accounting
- ✅ Track failed payments for analytics
- ✅ Debug payment issues with raw provider responses
- ✅ Support refunds and chargebacks

---

## 3. DATA FLOW ARCHITECTURE

### 3.1 dLocal Payment Flow (Step-by-Step)

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Initiates Checkout                                    │
├─────────────────────────────────────────────────────────────────────┤
│ User on: /checkout                                                  │
│ Actions:                                                            │
│   1. Selects country (e.g., India)                                 │
│   2. Sees local currency price (₹2,490/month or ₹165/3 days)       │
│   3. Selects plan (3-day or Monthly)                               │
│   4. Selects payment method (UPI, Paytm, etc.)                     │
│   5. If Monthly: Can enter discount code                           │
│   6. Clicks "Pay Now"                                               │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend Calls API                                         │
├─────────────────────────────────────────────────────────────────────┤
│ POST /api/payments/dlocal/create                                   │
│ Body: {                                                             │
│   planType: 'MONTHLY',                                              │
│   paymentMethodId: 'UP',  // UPI                                    │
│   country: 'IN',                                                    │
│   currency: 'INR',                                                  │
│   amount: 2490,  // Local currency                                 │
│   amountUSD: 30,                                                    │
│   discountCode: 'WELCOME20' (if applicable)                        │
│ }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: API Route Handler Validates                                │
├─────────────────────────────────────────────────────────────────────┤
│ app/api/payments/dlocal/create/route.ts                            │
│   ✓ Verify user authentication                                     │
│   ✓ Validate discount code (if Monthly plan)                       │
│   ✓ Reject discount code if 3-day plan                             │
│   ✓ Validate country is in dLocal supported list                   │
│   ✓ Check user doesn't have active subscription already            │
│   ✓ Call: lib/payments/dlocal-service.ts                           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: dLocal Service Creates Payment                             │
├─────────────────────────────────────────────────────────────────────┤
│ lib/payments/dlocal-service.ts                                     │
│   → Calls dLocal API: POST /payments                               │
│   → Creates Payment record (status: PENDING)                       │
│   → Returns: { paymentId, redirectUrl, status: 'PENDING' }        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: User Redirected to dLocal Payment Page                     │
├─────────────────────────────────────────────────────────────────────┤
│ Frontend redirects: window.location.href = payment.redirectUrl     │
│ User completes payment on dLocal's page (UPI, Paytm, etc.)         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: dLocal Webhook Fires (Payment Success)                     │
├─────────────────────────────────────────────────────────────────────┤
│ POST /api/webhooks/dlocal                                          │
│ Body: {                                                             │
│   id: 'PAY_123',                                                    │
│   status: 'PAID',                                                   │
│   amount: 2490,                                                     │
│   currency: 'INR'                                                   │
│ }                                                                   │
│   ✓ Verify webhook signature                                       │
│   ✓ Update Payment record (status: COMPLETED)                      │
│   ✓ Create/Update Subscription record                              │
│   ✓ Upgrade user tier: FREE → PRO                                  │
│   ✓ Set expiresAt: NOW + 30 days (or 3 days)                       │
│   ✓ Send confirmation email                                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: User Redirected Back to SaaS                               │
├─────────────────────────────────────────────────────────────────────┤
│ dLocal redirects: https://yoursaas.com/payment/success             │
│ Frontend shows: "Payment successful! Welcome to PRO tier"          │
│ User now has PRO access for 3 or 30 days                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Subscription Expiry & Renewal Flow (dLocal)

**Critical Difference:** dLocal has NO auto-renewal. We must handle expiry manually.

```
┌─────────────────────────────────────────────────────────────────────┐
│ DAILY CRON JOB: Check Expiring Subscriptions                       │
├─────────────────────────────────────────────────────────────────────┤
│ File: lib/cron/check-subscription-expiry.ts                        │
│ Runs: Every day at 00:00 UTC                                       │
│ Query:                                                              │
│   SELECT * FROM subscriptions                                      │
│   WHERE paymentProvider = 'DLOCAL'                                 │
│   AND status = 'ACTIVE'                                            │
│   AND expiresAt BETWEEN NOW() AND NOW() + INTERVAL '3 days'       │
│                                                                     │
│ For each expiring subscription:                                    │
│   ✓ Send "Subscription expiring soon" email                        │
│   ✓ Show in-app notification                                       │
│   ✓ Include renewal link to /checkout                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ ON EXPIRY DATE: Downgrade to FREE                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Runs: Every hour, checks:                                          │
│   SELECT * FROM subscriptions                                      │
│   WHERE paymentProvider = 'DLOCAL'                                 │
│   AND status = 'ACTIVE'                                            │
│   AND expiresAt <= NOW()                                           │
│                                                                     │
│ For each expired subscription:                                     │
│   ✓ Update subscription.status = 'EXPIRED'                         │
│   ✓ Update user.tier = 'FREE'                                      │
│   ✓ Send "Subscription expired" email with renewal link            │
│   ✓ Log downgrade event                                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// lib/cron/subscription-expiry-check.ts

export async function checkExpiringSubscriptions() {
  // Find subscriptions expiring in 3 days
  const expiringIn3Days = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'DLOCAL',
      status: 'ACTIVE',
      expiresAt: {
        gte: new Date(),
        lte: addDays(new Date(), 3),
      },
      // Don't spam: only notify once
      renewalReminderSent: false,
    },
    include: { user: true },
  });

  for (const subscription of expiringIn3Days) {
    // Send renewal reminder email
    await sendRenewalReminderEmail({
      to: subscription.user.email,
      expiryDate: subscription.expiresAt,
      renewalLink: `${process.env.APP_URL}/checkout?renew=${subscription.id}`,
    });

    // Mark reminder sent
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { renewalReminderSent: true },
    });
  }
}

export async function downgradeExpiredSubscriptions() {
  // Find expired subscriptions
  const expired = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'DLOCAL',
      status: 'ACTIVE',
      expiresAt: {
        lte: new Date(),
      },
    },
    include: { user: true },
  });

  for (const subscription of expired) {
    // Downgrade user to FREE tier
    await prisma.$transaction([
      // Update subscription
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'EXPIRED',
          tier: 'FREE',
        },
      }),
      // Update user
      prisma.user.update({
        where: { id: subscription.userId },
        data: { tier: 'FREE' },
      }),
    ]);

    // Send expiry notification
    await sendSubscriptionExpiredEmail({
      to: subscription.user.email,
      renewalLink: `${process.env.APP_URL}/checkout`,
    });

    console.log(`Downgraded user ${subscription.userId} to FREE tier`);
  }
}
```

**Vercel Cron Configuration:**

```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 0 * * *"  // Daily at midnight UTC
    },
    {
      "path": "/api/cron/downgrade-expired-subscriptions",
      "schedule": "0 * * * *"  // Every hour
    }
  ]
}
```

---

## 4. NOTIFICATION SYSTEM

### 4.1 dLocal-Specific Notifications

**Rule:** ALL subscription notifications apply to dLocal users, including 3-day plan users.

**Email Templates Required:**

```typescript
const DLOCAL_EMAIL_TEMPLATES = {
  // 1. Payment Confirmation (immediate after payment)
  PAYMENT_CONFIRMED: {
    trigger: 'Webhook: status = PAID',
    subject: '✅ Payment Successful - PRO Access Activated',
    content: `
      Your payment of {amount} {currency} has been processed successfully.

      PRO Tier Access: ACTIVATED
      Plan: {planType}
      Expires: {expiryDate}

      {planType === '3DAY' && 'Enjoying the PRO features? Upgrade to monthly for better value!'}
    `,
  },

  // 2. Renewal Reminder - 3 Days Before Expiry
  RENEWAL_REMINDER_3DAYS: {
    trigger: 'Cron: 3 days before expiresAt',
    subject: '⏰ Your PRO subscription expires in 3 days',
    content: `
      Your PRO subscription will expire on {expiryDate}.

      Renew now to continue enjoying:
      ✓ 15 symbols × 9 timeframes = 135 chart combinations
      ✓ 20 alerts
      ✓ Priority support

      [Renew Now Button → /checkout?renew={subscriptionId}]

      {hasDiscountCode && 'Enter discount code RENEW20 for 20% off!'}
    `,
  },

  // 3. Renewal Reminder - 1 Day Before Expiry
  RENEWAL_REMINDER_1DAY: {
    trigger: 'Cron: 1 day before expiresAt',
    subject: '🚨 URGENT: PRO subscription expires tomorrow',
    content: `
      Last chance! Your PRO access expires tomorrow at {expiryTime}.

      Don't lose access to:
      ❌ 10 additional symbols (back to 5)
      ❌ 6 advanced timeframes (back to 3)
      ❌ 15 extra alerts (back to 5 max)

      [Renew Now]
    `,
  },

  // 4. Subscription Expired
  SUBSCRIPTION_EXPIRED: {
    trigger: 'Cron: expiresAt reached',
    subject: '📉 PRO subscription expired - Downgraded to FREE',
    content: `
      Your PRO subscription has expired.
      You've been downgraded to FREE tier.

      FREE Tier Limits:
      • 5 symbols only
      • 3 timeframes only
      • 5 max alerts

      [Reactivate PRO → /checkout]
    `,
  },

  // 5. Payment Failed
  PAYMENT_FAILED: {
    trigger: 'Webhook: status = FAILED',
    subject: '❌ Payment Failed',
    content: `
      We couldn't process your payment of {amount} {currency}.

      Reason: {failureReason}

      Please try again with a different payment method.
      [Try Again → /checkout]
    `,
  },
} as const;
```

**Implementation:**

```typescript
// lib/emails/send-dlocal-notification.ts

export async function sendDLocalNotification(
  type: keyof typeof DLOCAL_EMAIL_TEMPLATES,
  subscription: Subscription,
  user: User
) {
  const template = DLOCAL_EMAIL_TEMPLATES[type];

  // Replace placeholders with actual values
  const subject = template.subject;
  const content = template.content
    .replace('{amount}', subscription.amount.toString())
    .replace('{currency}', subscription.currency)
    .replace('{planType}', subscription.planType)
    .replace('{expiryDate}', formatDate(subscription.expiresAt))
    .replace('{subscriptionId}', subscription.id);

  // Send via Resend or your email provider
  await sendEmail({
    to: user.email,
    subject,
    html: renderEmailTemplate(content),
  });

  // Also create in-app notification
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: type,
      title: subject,
      message: content,
      read: false,
    },
  });
}
```

---

## 5. COUNTRY DETECTION & CURRENCY CONVERSION

### 5.1 Supported Countries

**Rule:** dLocal supports 8 emerging markets. Validate country before processing payment.

```typescript
const DLOCAL_SUPPORTED_COUNTRIES = {
  IN: { name: 'India', currency: 'INR', locale: 'en-IN' },
  NG: { name: 'Nigeria', currency: 'NGN', locale: 'en-NG' },
  PK: { name: 'Pakistan', currency: 'PKR', locale: 'en-PK' },
  VN: { name: 'Vietnam', currency: 'VND', locale: 'vi-VN' },
  ID: { name: 'Indonesia', currency: 'IDR', locale: 'id-ID' },
  TH: { name: 'Thailand', currency: 'THB', locale: 'th-TH' },
  ZA: { name: 'South Africa', currency: 'ZAR', locale: 'en-ZA' },
  TR: { name: 'Turkey', currency: 'TRY', locale: 'tr-TR' },
} as const;

function isDLocalCountry(countryCode: string): boolean {
  return countryCode in DLOCAL_SUPPORTED_COUNTRIES;
}
```

**Country Detection Flow:**

```typescript
// lib/geo/detect-country.ts

export async function detectUserCountry(): Promise<string | null> {
  try {
    // 1. Check localStorage for saved preference
    const savedCountry = localStorage.getItem('user_country');
    if (savedCountry && isDLocalCountry(savedCountry)) {
      return savedCountry;
    }

    // 2. Try IP geolocation API
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();

    if (isDLocalCountry(data.country_code)) {
      localStorage.setItem('user_country', data.country_code);
      return data.country_code;
    }

    // 3. Fallback to browser language
    const browserLang = navigator.language; // e.g., 'en-IN'
    const countryFromLang = browserLang.split('-')[1];
    if (isDLocalCountry(countryFromLang)) {
      return countryFromLang;
    }

    // 4. No dLocal country detected
    return null;
  } catch (error) {
    console.error('Country detection failed:', error);
    return null;
  }
}
```

---

### 5.2 Currency Conversion

**Rule:** Currency conversion ONLY applies to dLocal. Stripe always uses USD.

**Stripe Pricing:**

- ✅ Display: USD only ($29/month)
- ❌ NO currency conversion
- ❌ NO local currency display
- ✅ User pays in USD

**dLocal Pricing:**

- ✅ Display: Local currency (₹2,407/month)
- ✅ WITH currency conversion (USD → local)
- ✅ Show USD as secondary reference ("Approximately $29 USD")
- ✅ User pays in local currency
- ✅ Exchange rates from dLocal API

**Rule:** All pricing is BASE in USD. Convert to local currency for dLocal display only. Store BOTH amounts in database.

```typescript
// lib/payments/currency-converter.ts

interface PriceConversion {
  amountUSD: number;
  amountLocal: number;
  currency: string;
  exchangeRate: number;
}

export async function convertUSDToLocal(
  amountUSD: number,
  targetCurrency: string
): Promise<PriceConversion> {
  // Fetch live exchange rate from dLocal or fallback API
  const rate = await getExchangeRate('USD', targetCurrency);

  // Convert and round to nearest whole number
  const amountLocal = Math.round(amountUSD * rate);

  return {
    amountUSD,
    amountLocal,
    currency: targetCurrency,
    exchangeRate: rate,
  };
}

// Example usage
const monthly3DayPrice = await convertUSDToLocal(1.99, 'INR');
// Returns: { amountUSD: 1.99, amountLocal: 165, currency: 'INR', exchangeRate: 83 }

const monthlyPrice = await convertUSDToLocal(29.0, 'INR');
// Returns: { amountUSD: 29.00, amountLocal: 2490, currency: 'INR', exchangeRate: 83 }
```

**Display in UI:**

```tsx
// components/PriceDisplay.tsx

// STRIPE: USD only
{
  provider === 'stripe' && (
    <div className="price-display stripe">
      <div className="price-usd">
        $29.00<span className="frequency">/month</span>
      </div>
      {/* NO local currency conversion */}
    </div>
  );
}

// DLOCAL: Local currency with USD reference
{
  provider === 'dlocal' && (
    <div className="price-display dlocal">
      <div className="local-price">
        ₹2,407<span className="frequency">/month</span>
      </div>
      <div className="usd-equivalent">Approximately $29 USD</div>
    </div>
  );
}
```

---

## 6. ERROR HANDLING & EDGE CASES

### 6.1 Graceful Degradation

**Rule:** If dLocal API fails, always fall back to Stripe. Never block checkout.

```typescript
// lib/payments/payment-methods-service.ts

export async function getPaymentMethodsForCountry(country: string) {
  const methods: PaymentMethod[] = [];

  try {
    // 1. Try fetching dLocal methods if country is supported
    if (isDLocalCountry(country)) {
      const dlocalMethods = await fetchDLocalMethods(country);
      if (dlocalMethods.length > 0) {
        methods.push(...dlocalMethods);
      }
    }
  } catch (error) {
    console.error('dLocal API failed, falling back to Stripe:', error);
    // Continue to Stripe fallback
  }

  // 2. ALWAYS add Stripe card option as fallback
  methods.push({
    id: 'card',
    name: 'Credit/Debit Card',
    type: 'CARD',
    provider: 'stripe',
    icon: '💳',
    description: 'Visa, Mastercard, Amex',
    processingTime: 'Instant',
    recommended: !isDLocalCountry(country), // Recommended for non-dLocal countries
  });

  return methods;
}
```

---

### 6.2 Webhook Signature Verification

**Rule:** ALWAYS verify dLocal webhook signatures. Reject unsigned requests.

```typescript
// app/api/webhooks/dlocal/route.ts

import crypto from 'crypto';

function verifyDLocalSignature(body: any, signature: string | null): boolean {
  if (!signature) {
    console.error('Missing dLocal webhook signature');
    return false;
  }

  const payload = JSON.stringify(body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.DLOCAL_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    console.error('Invalid dLocal webhook signature');
  }

  return isValid;
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-signature');
  const body = await request.json();

  // Verify signature BEFORE processing
  if (!verifyDLocalSignature(body, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process webhook...
}
```

---

### 6.3 Duplicate Payment Prevention

**Rule:** Use idempotency keys to prevent duplicate charges.

```typescript
// lib/payments/dlocal-service.ts

export async function createDLocalPayment(data: PaymentData) {
  // Generate idempotency key from user + plan + timestamp
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${data.userId}-${data.planType}-${Date.now()}`)
    .digest('hex');

  // Check if payment with this key already exists
  const existingPayment = await prisma.payment.findFirst({
    where: {
      userId: data.userId,
      metadata: {
        path: ['idempotencyKey'],
        equals: idempotencyKey,
      },
      status: { in: ['PENDING', 'COMPLETED'] },
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
      },
    },
  });

  if (existingPayment) {
    console.log('Duplicate payment prevented:', idempotencyKey);
    return existingPayment;
  }

  // Create new payment...
  const payment = await prisma.payment.create({
    data: {
      ...data,
      metadata: {
        idempotencyKey,
      },
    },
  });

  return payment;
}
```

---

## 7. TESTING STRATEGY

### 7.1 Mock Data for Development

**Rule:** Use mock data for dLocal payment methods during development. Never call real API in dev/test.

```typescript
// lib/payments/__mocks__/dlocal-methods.ts

export const MOCK_DLOCAL_PAYMENT_METHODS = {
  IN: [
    {
      id: 'UP',
      name: 'UPI',
      type: 'BANK_TRANSFER',
      icon: '📲',
      recommended: true,
    },
    { id: 'PT', name: 'Paytm', type: 'WALLET', icon: '💙', popular: true },
    { id: 'PP', name: 'PhonePe', type: 'WALLET', icon: '💜' },
    { id: 'NB', name: 'Net Banking', type: 'BANK_TRANSFER', icon: '🏦' },
  ],
  PK: [
    {
      id: 'JC',
      name: 'JazzCash',
      type: 'WALLET',
      icon: '🎵',
      recommended: true,
    },
    { id: 'EP', name: 'Easypaisa', type: 'WALLET', icon: '💚', popular: true },
  ],
  // ... other countries
} as const;

// Use in development
export function getDLocalMethods(country: string) {
  if (process.env.NODE_ENV === 'development') {
    return MOCK_DLOCAL_PAYMENT_METHODS[country] || [];
  }

  // Production: Call real API
  return fetchRealDLocalMethods(country);
}
```

---

## 8. ENVIRONMENT VARIABLES

### 8.1 Required Variables

**Rule:** All dLocal API credentials must be environment variables. Never hardcode.

```bash
# .env.local

# dLocal API Configuration
DLOCAL_API_URL=https://api.dlocal.com
DLOCAL_API_LOGIN=your_dlocal_login
DLOCAL_API_KEY=your_dlocal_api_key
DLOCAL_API_SECRET=your_dlocal_secret_key
DLOCAL_WEBHOOK_SECRET=your_webhook_secret

# dLocal Country Detection
DLOCAL_COUNTRIES=IN,NG,PK,VN,ID,TH,ZA,TR

# Pricing (USD)
DLOCAL_3DAY_PRICE_USD=1.99
DLOCAL_MONTHLY_PRICE_USD=29.00

# Feature Flags
ENABLE_DLOCAL_PAYMENTS=true
ENABLE_3DAY_PLAN=true

# Existing Stripe (unchanged)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

## 9. SECURITY RULES

### 9.1 Never Expose Secrets to Frontend

**Rule:** dLocal API keys are server-side only. Never send to client.

```typescript
// ❌ BAD - Exposes secret to frontend
export default function CheckoutPage() {
  const apiKey = process.env.DLOCAL_API_KEY; // DON'T DO THIS!
  return <PaymentForm apiKey={apiKey} />;
}

// ✅ GOOD - Keep secrets server-side
export default function CheckoutPage() {
  // Frontend only knows payment method IDs
  const [selectedMethod, setSelectedMethod] = useState('UP');

  // API call to backend (secrets stay on server)
  const handlePayment = async () => {
    await fetch('/api/payments/dlocal/create', {
      method: 'POST',
      body: JSON.stringify({
        paymentMethodId: selectedMethod // Just the ID, not secrets
      })
    });
  };
}
```

---

## 10. DISCOUNT CODE VALIDATION

### 10.1 Special Handling for dLocal

**Rule:** Discount codes behave differently for dLocal vs Stripe plans.

```typescript
// lib/payments/discount-validator.ts

interface DiscountValidationResult {
  valid: boolean;
  reason?: string;
  discountPercentage?: number;
}

export async function validateDiscountCode(
  code: string,
  planType: PlanType,
  paymentProvider: PaymentProvider
): Promise<DiscountValidationResult> {
  // 1. Check if discount codes are allowed for this plan
  if (paymentProvider === 'DLOCAL' && planType === 'THREE_DAY') {
    return {
      valid: false,
      reason: 'Discount codes not available for 3-day plans',
    };
  }

  // 2. Look up discount code in database
  const discount = await prisma.discountCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { affiliateCode: true },
  });

  if (!discount) {
    return { valid: false, reason: 'Invalid discount code' };
  }

  // 3. Check if code is active
  if (!discount.isActive) {
    return { valid: false, reason: 'This code is no longer active' };
  }

  // 4. Check expiry date
  if (discount.expiresAt && discount.expiresAt < new Date()) {
    return { valid: false, reason: 'This code has expired' };
  }

  // 5. Check usage limits
  if (discount.maxUses && discount.currentUses >= discount.maxUses) {
    return { valid: false, reason: 'This code has reached its usage limit' };
  }

  // 6. Valid code!
  return {
    valid: true,
    discountPercentage: discount.percentage,
  };
}
```

**UI Implementation:**

```tsx
// components/checkout/DiscountCodeInput.tsx

export function DiscountCodeInput({ planType, paymentProvider }: Props) {
  // Don't render at all for 3-day dLocal plans
  if (paymentProvider === 'DLOCAL' && planType === 'THREE_DAY') {
    return null; // Hide component entirely
  }

  const [code, setCode] = useState('');
  const [validation, setValidation] = useState<DiscountValidationResult | null>(
    null
  );

  const handleApply = async () => {
    const result = await validateDiscountCode(code, planType, paymentProvider);
    setValidation(result);
  };

  return (
    <div className="discount-code-input">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter discount code"
      />
      <button onClick={handleApply}>Apply</button>

      {validation && !validation.valid && (
        <p className="error">{validation.reason}</p>
      )}

      {validation && validation.valid && (
        <p className="success">
          {validation.discountPercentage}% discount applied!
        </p>
      )}
    </div>
  );
}
```

---

## 11. AIDER ESCALATION TRIGGERS

### 11.1 When to Escalate to Human

**Rule:** Escalate these dLocal-specific scenarios to human decision maker.

```typescript
const DLOCAL_ESCALATION_TRIGGERS = {
  // 1. Country-specific payment method failures
  PAYMENT_METHOD_UNAVAILABLE: {
    trigger: 'dLocal returns no payment methods for supported country',
    escalate: true,
    reason: 'May indicate API issue or country restriction change',
    action: 'Ask human: Should we disable dLocal for this country temporarily?',
  },

  // 2. Exchange rate volatility
  EXCHANGE_RATE_SPIKE: {
    trigger: 'Exchange rate changed > 10% from last fetch',
    escalate: true,
    reason: 'Large price changes may confuse users',
    action: 'Ask human: Accept new rate or use cached rate?',
  },

  // 3. Webhook signature mismatch pattern
  WEBHOOK_SIGNATURE_FAILURES: {
    trigger: '5+ signature validation failures in 1 hour',
    escalate: true,
    reason: 'Possible security issue or dLocal API change',
    action: 'Ask human: Investigate webhook secret or API version mismatch?',
  },

  // 4. Payment success but subscription creation fails
  PAYMENT_WITHOUT_SUBSCRIPTION: {
    trigger: 'Payment status = PAID but subscription not created',
    escalate: true,
    reason: "User paid but didn't get PRO access",
    action: 'Ask human: Manual subscription activation or refund?',
  },

  // 5. Multiple active subscriptions
  DUPLICATE_ACTIVE_SUBSCRIPTIONS: {
    trigger: 'User has >1 active subscription',
    escalate: true,
    reason: 'Should not be possible, data integrity issue',
    action: 'Ask human: Which subscription to keep active?',
  },
} as const;
```

---

## 12. SUMMARY: DO's and DON'Ts

### ✅ DO:

- ✅ Use existing `subscriptions` table with provider-specific columns
- ✅ Send renewal reminders 3 days before expiry (dLocal only)
- ✅ Manually downgrade dLocal users to FREE on expiry
- ✅ Allow discount codes on dLocal MONTHLY plans only
- ✅ Hide discount code input for 3-day plans
- ✅ Store BOTH local currency and USD amounts in database
- ✅ Verify webhook signatures before processing
- ✅ Fall back to Stripe if dLocal API fails
- ✅ Use mock data for development and testing
- ✅ Apply all notification rules to dLocal users
- ✅ Log all payment attempts (success and failure)
- ✅ Use idempotency keys to prevent duplicate charges
- ✅ Keep dLocal API secrets server-side only

### ❌ DON'T:

- ❌ Don't create separate tables for dLocal subscriptions
- ❌ Don't apply Stripe auto-renewal logic to dLocal
- ❌ Don't offer 7-day free trial for dLocal
- ❌ Don't show 3-day plan option when Stripe is selected
- ❌ Don't allow discount codes on 3-day plans
- ❌ Don't expose dLocal API keys to frontend
- ❌ Don't process webhooks without signature verification
- ❌ Don't call real dLocal API in development
- ❌ Don't block checkout if country detection fails
- ❌ Don't create dLocal payments for countries not in supported list
- ❌ Don't forget to update user.tier when subscription changes
- ❌ Don't hardcode exchange rates (always fetch live rates)

---

**This policy document ensures dLocal integration is implemented correctly by Aider while maintaining full compliance with the existing Stripe infrastructure and project architecture rules.**
