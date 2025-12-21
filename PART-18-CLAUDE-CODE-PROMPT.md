# Part 18: dLocal Payment Integration - Claude Code Build Prompt

## Overview

**Part:** 18 of 18

**Feature:** dLocal Payment Integration for Emerging Markets

**Total Files:** 45 files (37 NEW + 8 MODIFIED from Part 12)

**Complexity:** High

**Dependencies:** Part 2 (Database), Part 5 (Auth), Part 12 (Stripe Integration)

---

## Prerequisites Check

Before starting, verify:

- [ ] Part 2 complete (Database & Prisma setup)

- [ ] Part 5 complete (Authentication with NextAuth)

- [ ] Part 12 complete (Stripe integration working)

- [ ] Node.js and npm working

- [ ] Git repository initialized

---

## ⚠️ CRITICAL: MUTUAL INTEGRATION WITH PART 12

**Part 18 does NOT replace Part 12 - it INTEGRATES with it to create a UNIFIED payment system.**

### Integration Architecture

```

┌─────────────────────────────────────────────────────────────────────────┐

│                        UNIFIED CHECKOUT FLOW                            │

├─────────────────────────────────────────────────────────────────────────┤

│                                                                         │

│  User visits /pricing (MODIFIED Part 12) OR /checkout (Part 18)        │

│                              ↓                                          │

│  Country Detection (Part 18: lib/geo/detect-country.ts)                │

│                              ↓                                          │

│  ┌─────────────────────────────────────────────────────────────────┐   │

│  │              PAYMENT METHOD SELECTION                            │   │

│  │  ┌─────────────────────┐    ┌─────────────────────────────────┐ │   │

│  │  │  STRIPE (Card)      │ OR │  dLOCAL (Local Methods)         │ │   │

│  │  │  - All countries    │    │  - 8 supported countries only   │ │   │

│  │  │  - Auto-renewal ✓   │    │  - Manual renewal only          │ │   │

│  │  │  - Monthly plan     │    │  - 3-day + Monthly plans        │ │   │

│  │  └─────────────────────┘    └─────────────────────────────────┘ │   │

│  └─────────────────────────────────────────────────────────────────┘   │

│                              ↓                                          │

│  ┌─────────────────────────────────────────────────────────────────┐   │

│  │              WEBHOOK PROCESSING                                  │   │

│  │  Stripe Webhook (Part 12)    dLocal Webhook (Part 18)           │   │

│  │  app/api/webhooks/stripe     app/api/webhooks/dlocal            │   │

│  │           ↓                            ↓                         │   │

│  │  ┌─────────────────────────────────────────────────────────┐    │   │

│  │  │         UNIFIED SUBSCRIPTION HANDLING                    │    │   │

│  │  │  - Update User.tier to PRO                              │    │   │

│  │  │  - Create Subscription with paymentProvider field       │    │   │

│  │  │  - Store expiresAt for dLocal (manual renewal)         │    │   │

│  │  └─────────────────────────────────────────────────────────┘    │   │

│  └─────────────────────────────────────────────────────────────────┘   │

│                                                                         │

└─────────────────────────────────────────────────────────────────────────┘

```

### Part 12 Files That MUST Be MODIFIED

These 8 files from Part 12 need updates for dLocal integration:

| # | File Path | Modification Type | Integration Purpose |

|---|-----------|-------------------|---------------------|

| 1 | `app/(marketing)/pricing/page.tsx` | **MAJOR** | Add country detection, show dLocal options, 3-day plan |

| 2 | `app/api/subscription/route.ts` | **MODERATE** | Return paymentProvider field, handle dLocal subs |

| 3 | `app/api/checkout/route.ts` | **MODERATE** | Route to correct provider based on selection |

| 4 | `app/api/invoices/route.ts` | **MODERATE** | Include dLocal payments in invoice list |

| 5 | `components/billing/subscription-card.tsx` | **MAJOR** | Show provider, manual renewal notice for dLocal |

| 6 | `lib/stripe/webhook-handlers.ts` | **MINOR** | Add paymentProvider field when creating subscription |

| 7 | `lib/stripe/stripe.ts` | **MINOR** | Add provider type exports |

| 8 | `lib/email/subscription-emails.ts` | **MODERATE** | Add provider-specific email content |

---

## Instructions for Claude Code

You are an autonomous code builder. Your task is to build **Part 18: dLocal Payment Integration** AND integrate it seamlessly with **Part 12 (Stripe)** to create a UNIFIED payment system.

### Critical Business Rules (MUST FOLLOW)

1. **dLocal vs Stripe Differences:**

   | Feature | Stripe | dLocal |

   |---------|--------|--------|

   | Auto-Renewal | ✅ Yes | ❌ NO - Manual renewal |

   | Free Trial | ✅ 7 days | ❌ NO trial |

   | Plans | Monthly only | 3-day + Monthly |

   | Discount Codes | ✅ All plans | ❌ Monthly ONLY |

   | Renewal Notifications | Stripe manages | WE send 3 days before |

   | Expiry Handling | Stripe auto-downgrades | WE downgrade via cron |

2. **3-Day Plan Anti-Abuse (CRITICAL):**
   - 3-day plan can ONLY be purchased ONCE per account (lifetime)

   - Track via `hasUsedThreeDayPlan` boolean on User model

   - CANNOT purchase 3-day plan if user has active subscription

   - Use `crypto.randomBytes()` for secure hashing (NOT Math.random)

3. **Supported Countries (8 total):**
   - IN (India) - INR - UPI, Paytm, PhonePe, Net Banking

   - NG (Nigeria) - NGN - Bank Transfer, USSD, Paystack

   - PK (Pakistan) - PKR - JazzCash, Easypaisa

   - VN (Vietnam) - VND - VNPay, MoMo, ZaloPay

   - ID (Indonesia) - IDR - GoPay, OVO, Dana, ShopeePay

   - TH (Thailand) - THB - TrueMoney, Rabbit LINE Pay, Thai QR

   - ZA (South Africa) - ZAR - Instant EFT, EFT

   - TR (Turkey) - TRY - Bank Transfer, Local Cards

4. **Pricing:**
   - 3-Day Plan: $1.99 USD (dLocal only, NO discount codes)

   - Monthly Plan: $29.00 USD (both Stripe & dLocal, discount codes allowed)

5. **Early Renewal Logic:**
   - Monthly: ALLOWED - extend from current expiry date

   - 3-Day: PROHIBITED if user has any active subscription

---

## Documents to Read First

Read these documents IN ORDER before generating any code:

```

1. PROGRESS-part-2.md (current progress tracker)

2. ARCHITECTURE-compress.md (system architecture)

3. docs/policies/05-coding-patterns-part-1.md (coding standards)

4. docs/policies/05-coding-patterns-part-2.md (additional patterns)

5. docs/policies/07-dlocal-integration-rules.md (dLocal-specific rules)

6. docs/build-orders/part-18-dlocal.md (build sequence)

7. docs/implementation-guides/v5_part_r.md (detailed requirements)

8. PART-12-CLAUDE-CODE-PROMPT.md (understand Part 12 patterns)

```

---

## All 45 Files to Build/Modify

### Phase A: Database & Types (3 files)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 1 | `prisma/schema.prisma` | UPDATE | Add Payment model, FraudAlert model, update User & Subscription |

| 2 | `types/dlocal.ts` | NEW | dLocal type definitions |

| 3 | `lib/dlocal/constants.ts` | NEW | Countries, currencies, pricing constants |

### Phase B: Services (5 files)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 4 | `lib/dlocal/currency-converter.service.ts` | NEW | USD to local currency conversion |

| 5 | `lib/dlocal/payment-methods.service.ts` | NEW | Fetch payment methods by country |

| 6 | `lib/dlocal/dlocal-payment.service.ts` | NEW | Create payments, verify webhooks |

| 7 | `lib/dlocal/three-day-validator.service.ts` | NEW | Anti-abuse validation for 3-day plan |

| 8 | `lib/geo/detect-country.ts` | NEW | IP geolocation country detection |

### Phase C: API Routes (11 files)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 9 | `app/api/payments/dlocal/methods/route.ts` | NEW | GET payment methods for country |

| 10 | `app/api/payments/dlocal/exchange-rate/route.ts` | NEW | GET exchange rate USD to currency |

| 11 | `app/api/payments/dlocal/convert/route.ts` | NEW | GET currency conversion |

| 12 | `app/api/payments/dlocal/create/route.ts` | NEW | POST create dLocal payment |

| 13 | `app/api/payments/dlocal/validate-discount/route.ts` | NEW | POST validate discount code |

| 14 | `app/api/payments/dlocal/[paymentId]/route.ts` | NEW | GET payment status |

| 15 | `app/api/webhooks/dlocal/route.ts` | NEW | POST webhook handler |

| 16 | `app/api/cron/check-expiring-subscriptions/route.ts` | NEW | GET cron - send reminders |

| 17 | `app/api/cron/downgrade-expired-subscriptions/route.ts` | NEW | GET cron - downgrade expired |

| 18 | `app/api/admin/fraud-alerts/route.ts` | NEW | GET/POST fraud alerts list |

| 19 | `app/api/admin/fraud-alerts/[id]/route.ts` | NEW | GET/PATCH fraud alert detail |

### Phase D: Cron Job Services (2 files)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 20 | `lib/cron/check-expiring-subscriptions.ts` | NEW | Send renewal reminders |

| 21 | `lib/cron/downgrade-expired-subscriptions.ts` | NEW | Downgrade expired users to FREE |

### Phase E: Frontend Components (6 files)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 22 | `components/payments/CountrySelector.tsx` | NEW | Country dropdown with flags |

| 23 | `components/payments/PlanSelector.tsx` | NEW | 3-day vs Monthly plan cards |

| 24 | `components/payments/PaymentMethodSelector.tsx` | NEW | Payment method grid |

| 25 | `components/payments/PriceDisplay.tsx` | NEW | Local currency + USD display |

| 26 | `components/payments/DiscountCodeInput.tsx` | NEW | Discount code input (monthly only) |

| 27 | `components/payments/PaymentButton.tsx` | NEW | Payment submit button |

### Phase F: Unified Checkout Page (1 file)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 28 | `app/checkout/page.tsx` | NEW | Unified checkout (Stripe + dLocal) |

### Phase G: Email Templates (4 files)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 29 | `emails/payment-confirmation.tsx` | NEW | Payment success email |

| 30 | `emails/renewal-reminder.tsx` | NEW | 3-day before expiry reminder |

| 31 | `emails/subscription-expired.tsx` | NEW | Expired notification |

| 32 | `emails/payment-failure.tsx` | NEW | Payment failed email |

### Phase H: Admin Fraud Dashboard (4 files)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 33 | `app/(dashboard)/admin/fraud-alerts/page.tsx` | NEW | Fraud alerts list page |

| 34 | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` | NEW | Fraud alert detail page |

| 35 | `components/admin/FraudAlertCard.tsx` | NEW | Fraud alert card component |

| 36 | `components/admin/FraudPatternBadge.tsx` | NEW | Severity/pattern badge |

### Phase I: Configuration (1 file)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 37 | `vercel.json` | UPDATE | Add cron job schedules |

### Phase J: Part 12 Integration - RETROFIT (8 files)

| # | File Path | Type | Description |

|---|-----------|------|-------------|

| 38 | `app/(marketing)/pricing/page.tsx` | MODIFY | Add dLocal support, country detection, 3-day plan |

| 39 | `app/api/subscription/route.ts` | MODIFY | Return paymentProvider, handle both providers |

| 40 | `app/api/checkout/route.ts` | MODIFY | Route to Stripe OR dLocal based on selection |

| 41 | `app/api/invoices/route.ts` | MODIFY | Include dLocal payments in results |

| 42 | `components/billing/subscription-card.tsx` | MODIFY | Show provider, manual renewal notice |

| 43 | `lib/stripe/webhook-handlers.ts` | MODIFY | Add paymentProvider when creating subscription |

| 44 | `lib/stripe/stripe.ts` | MODIFY | Export provider type constants |

| 45 | `lib/email/subscription-emails.ts` | MODIFY | Provider-specific email content |

---

## Phase J Details: Part 12 Retrofit Patterns

### File 38: `app/(marketing)/pricing/page.tsx` (MODIFY)

**Current State (Part 12):** Shows FREE vs PRO, Stripe-only checkout

**Required Changes:**

```typescript

// ADD: Import country detection and dLocal constants

import { detectCountry } from '@/lib/geo/detect-country';

import { isDLocalCountry, DLOCAL_SUPPORTED_COUNTRIES } from '@/lib/dlocal/constants';



// ADD: State for country and payment provider

const [detectedCountry, setDetectedCountry] = useState<string>('US');

const [showDLocalOptions, setShowDLocalOptions] = useState(false);



// ADD: useEffect for country detection

useEffect(() => {

  async function detect() {

    const country = await detectCountry();

    setDetectedCountry(country);

    setShowDLocalOptions(isDLocalCountry(country));

  }

  detect();

}, []);



// ADD: 3-Day Plan Card (only shown for dLocal countries)

{showDLocalOptions && (

  <Card className="border-2 border-purple-500">

    <CardHeader>

      <Badge className="bg-purple-500">dLocal Only</Badge>

      <CardTitle>3-Day Trial</CardTitle>

      <CardDescription>$1.99 - Try PRO for 3 days</CardDescription>

    </CardHeader>

    <CardContent>

      {/* 3-day plan features */}

      <Button onClick={() => router.push('/checkout?plan=3day')}>

        Try for $1.99

      </Button>

    </CardContent>

  </Card>

)}



// MODIFY: PRO Plan Card to show both payment options

<Card>

  <CardHeader>

    <CardTitle>PRO Monthly</CardTitle>

    <CardDescription>$29/month</CardDescription>

  </CardHeader>

  <CardContent>

    {/* Show payment method options */}

    <div className="space-y-2">

      <Button onClick={() => handleStripeCheckout()}>

        Pay with Card (Stripe)

      </Button>

      {showDLocalOptions && (

        <Button variant="outline" onClick={() => router.push('/checkout?plan=monthly')}>

          Pay with Local Methods

        </Button>

      )}

    </div>

  </CardContent>

</Card>

```

**Commit:** `feat(pricing): add dLocal support and 3-day plan option`

---

### File 39: `app/api/subscription/route.ts` (MODIFY)

**Current State (Part 12):** Returns Stripe subscription only

**Required Changes:**

```typescript
// MODIFY: GET handler to return paymentProvider

export async function GET(): Promise<NextResponse> {
  // ... existing auth check ...

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: 'ACTIVE' },
  });

  if (!subscription) {
    return NextResponse.json({
      tier: 'FREE',

      paymentProvider: null,

      expiresAt: null,
    });
  }

  // ADD: Different response based on provider

  return NextResponse.json({
    tier: 'PRO',

    paymentProvider: subscription.paymentProvider, // 'STRIPE' or 'DLOCAL'

    status: subscription.status,

    // Stripe-specific fields

    ...(subscription.paymentProvider === 'STRIPE' && {
      currentPeriodEnd: subscription.currentPeriodEnd,

      stripeSubscriptionId: subscription.stripeSubscriptionId,

      autoRenewal: true,
    }),

    // dLocal-specific fields

    ...(subscription.paymentProvider === 'DLOCAL' && {
      expiresAt: subscription.expiresAt,

      planType: subscription.planType, // 'THREE_DAY' or 'MONTHLY'

      autoRenewal: false,

      renewalReminderSent: subscription.renewalReminderSent,
    }),
  });
}
```

**Commit:** `feat(api): add paymentProvider support to subscription endpoint`

---

### File 40: `app/api/checkout/route.ts` (MODIFY)

**Current State (Part 12):** Creates Stripe checkout only

**Required Changes:**

```typescript
import { z } from 'zod';

// ADD: Request schema with provider

const checkoutSchema = z.object({
  provider: z.enum(['stripe', 'dlocal']).default('stripe'),

  planType: z.enum(['monthly', '3day']).default('monthly'),

  country: z.string().optional(),

  paymentMethod: z.string().optional(),

  discountCode: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ... existing auth check ...

  const body = await request.json();

  const { provider, planType, country, paymentMethod, discountCode } =
    checkoutSchema.parse(body);

  // Route to correct provider

  if (provider === 'dlocal') {
    // Validate dLocal eligibility

    if (!isDLocalCountry(country)) {
      return NextResponse.json(
        { error: 'dLocal not available in your country' },

        { status: 400 }
      );
    }

    // Redirect to dLocal payment creation

    // The actual dLocal payment is handled by /api/payments/dlocal/create

    return NextResponse.json({
      provider: 'dlocal',

      redirectUrl: `/checkout?provider=dlocal&plan=${planType}&country=${country}`,
    });
  }

  // Existing Stripe checkout logic

  const checkoutSession = await createCheckoutSession(
    session.user.id,

    session.user.email || '',

    successUrl,

    cancelUrl
  );

  return NextResponse.json({
    provider: 'stripe',

    sessionId: checkoutSession.id,

    url: checkoutSession.url,
  });
}
```

**Commit:** `feat(api): add provider routing to checkout endpoint`

---

### File 41: `app/api/invoices/route.ts` (MODIFY)

**Current State (Part 12):** Returns Stripe invoices only

**Required Changes:**

```typescript
export async function GET(): Promise<NextResponse> {
  // ... existing auth check ...

  // Get Stripe invoices (existing logic)

  let stripeInvoices: Invoice[] = [];

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id },
  });

  if (subscription?.stripeCustomerId) {
    const invoices = await getCustomerInvoices(subscription.stripeCustomerId);

    stripeInvoices = invoices.map((inv) => ({
      id: inv.id,

      provider: 'STRIPE' as const,

      date: new Date(inv.created * 1000).toISOString(),

      amount: (inv.amount_paid || 0) / 100,

      currency: inv.currency?.toUpperCase() || 'USD',

      status: inv.status as 'paid' | 'open' | 'failed',

      description: 'PRO Monthly Subscription',

      downloadUrl: inv.invoice_pdf || undefined,
    }));
  }

  // ADD: Get dLocal payments

  const dlocalPayments = await prisma.payment.findMany({
    where: {
      userId: session.user.id,

      provider: 'DLOCAL',

      status: 'COMPLETED',
    },

    orderBy: { completedAt: 'desc' },

    take: 12,
  });

  const dlocalInvoices: Invoice[] = dlocalPayments.map((payment) => ({
    id: payment.id,

    provider: 'DLOCAL' as const,

    date:
      payment.completedAt?.toISOString() || payment.initiatedAt.toISOString(),

    amount: Number(payment.amountUSD),

    currency: 'USD',

    localAmount: Number(payment.amount),

    localCurrency: payment.currency,

    status: 'paid' as const,

    description:
      payment.planType === 'THREE_DAY'
        ? '3-Day PRO Plan'
        : 'PRO Monthly Subscription',

    paymentMethod: payment.paymentMethod,

    country: payment.country,
  }));

  // Combine and sort by date

  const allInvoices = [...stripeInvoices, ...dlocalInvoices].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return NextResponse.json({ invoices: allInvoices });
}
```

**Commit:** `feat(api): include dLocal payments in invoices endpoint`

---

### File 42: `components/billing/subscription-card.tsx` (MODIFY)

**Current State (Part 12):** Shows Stripe subscription info only

**Required Changes:**

```typescript

interface SubscriptionCardProps {

  subscription?: {

    paymentProvider: 'STRIPE' | 'DLOCAL';

    status: string;

    // Stripe fields

    currentPeriodEnd?: string;

    paymentMethod?: { brand: string; last4: string };

    // dLocal fields

    expiresAt?: string;

    planType?: 'THREE_DAY' | 'MONTHLY';

    autoRenewal: boolean;

  };

  onUpgrade: () => void;

  onCancel: () => void;

  onRenew?: () => void; // NEW: For dLocal manual renewal

  isLoading?: boolean;

}



export function SubscriptionCard({

  subscription,

  onUpgrade,

  onCancel,

  onRenew,

  isLoading = false,

}: SubscriptionCardProps) {

  const { tier } = useAuth();

  const isPro = tier === 'PRO';

  const isDLocal = subscription?.paymentProvider === 'DLOCAL';



  // ... existing tier config ...



  return (

    <Card className={isPro ? 'border-2 border-blue-500' : ''}>

      <CardHeader>

        <div className="flex items-center justify-between">

          <CardTitle className="text-xl">Current Subscription</CardTitle>

          <div className="flex gap-2">

            <Badge className={config.color}>{config.label}</Badge>

            {/* ADD: Payment provider badge */}

            {isPro && (

              <Badge variant="outline">

                {isDLocal ? 'dLocal' : 'Stripe'}

              </Badge>

            )}

          </div>

        </div>

      </CardHeader>

      <CardContent className="space-y-6">

        {/* ... existing price and features ... */}



        {/* MODIFY: Billing info based on provider */}

        {isPro && subscription && (

          <>

            {isDLocal ? (

              // dLocal-specific info

              <>

                <div className="flex items-center gap-2 text-sm">

                  <Calendar className="h-4 w-4 text-muted-foreground" />

                  <span>

                    Expires: {new Date(subscription.expiresAt!).toLocaleDateString()}

                  </span>

                </div>

                {/* Manual renewal warning */}

                <Alert className="bg-yellow-50 border-yellow-200">

                  <AlertCircle className="h-4 w-4 text-yellow-600" />

                  <AlertDescription className="text-yellow-800">

                    dLocal subscriptions require manual renewal.

                    You'll receive a reminder 3 days before expiry.

                  </AlertDescription>

                </Alert>

                <div className="text-sm text-muted-foreground">

                  Plan: {subscription.planType === 'THREE_DAY' ? '3-Day Trial' : 'Monthly'}

                </div>

              </>

            ) : (

              // Stripe info (existing)

              <>

                <div className="flex items-center gap-2 text-sm">

                  <Calendar className="h-4 w-4 text-muted-foreground" />

                  <span>

                    Next billing: {new Date(subscription.currentPeriodEnd!).toLocaleDateString()}

                  </span>

                </div>

                {subscription.paymentMethod && (

                  <div className="flex items-center gap-2 text-sm">

                    <CreditCard className="h-4 w-4 text-muted-foreground" />

                    <span>

                      {subscription.paymentMethod.brand} ending in {subscription.paymentMethod.last4}

                    </span>

                  </div>

                )}

                <div className="flex items-center gap-2 text-sm text-green-600">

                  <RefreshCw className="h-4 w-4" />

                  <span>Auto-renewal enabled</span>

                </div>

              </>

            )}

          </>

        )}



        {/* MODIFY: Actions based on provider */}

        <div className="flex gap-3 pt-4">

          {!isPro ? (

            <Button onClick={onUpgrade} disabled={isLoading} className="flex-1">

              Upgrade to PRO

            </Button>

          ) : isDLocal ? (

            // dLocal actions

            <>

              <Button onClick={onRenew} disabled={isLoading} className="flex-1">

                Renew Now

              </Button>

              {/* No cancel for dLocal - just let it expire */}

            </>

          ) : (

            // Stripe actions (existing)

            <>

              <Button variant="outline" className="flex-1">

                Update Payment Method

              </Button>

              <Button variant="destructive" onClick={onCancel} disabled={isLoading}>

                Cancel Subscription

              </Button>

            </>

          )}

        </div>

      </CardContent>

    </Card>

  );

}

```

**Commit:** `feat(billing): add dLocal support to subscription card`

---

### File 43: `lib/stripe/webhook-handlers.ts` (MODIFY)

**Current State (Part 12):** Creates subscription without paymentProvider

**Required Changes:**

```typescript
export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('No userId in checkout session metadata');

    return;
  }

  // Update user tier to PRO

  const user = await prisma.user.update({
    where: { id: userId },

    data: { tier: 'PRO' },
  });

  // MODIFY: Create subscription WITH paymentProvider

  await prisma.subscription.create({
    data: {
      userId,

      stripeCustomerId: session.customer as string,

      stripeSubscriptionId: session.subscription as string,

      status: 'ACTIVE',

      paymentProvider: 'STRIPE', // ADD THIS

      planType: 'MONTHLY', // ADD THIS

      currentPeriodStart: new Date(),

      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),

      // Note: expiresAt not needed for Stripe (auto-renewal)
    },
  });

  // ... rest of existing logic ...
}
```

**Commit:** `feat(stripe): add paymentProvider to subscription creation`

---

### File 44: `lib/stripe/stripe.ts` (MODIFY)

**Current State (Part 12):** Stripe client only

**Required Changes:**

```typescript
// ADD: Export payment provider constants for unified use

export const PAYMENT_PROVIDERS = {
  STRIPE: 'STRIPE',

  DLOCAL: 'DLOCAL',
} as const;

export type PaymentProvider =
  (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

// ADD: Helper to check if provider is Stripe

export function isStripeProvider(provider: string): provider is 'STRIPE' {
  return provider === PAYMENT_PROVIDERS.STRIPE;
}

// ADD: Helper to check if provider is dLocal

export function isDLocalProvider(provider: string): provider is 'DLOCAL' {
  return provider === PAYMENT_PROVIDERS.DLOCAL;
}

// ... existing Stripe client and functions ...
```

**Commit:** `feat(stripe): add payment provider type exports`

---

### File 45: `lib/email/subscription-emails.ts` (MODIFY)

**Current State (Part 12):** Generic email templates

**Required Changes:**

```typescript
// ADD: Provider parameter to email functions

export function getUpgradeEmailTemplate(
  name: string,

  provider: 'STRIPE' | 'DLOCAL' = 'STRIPE',

  planType: 'THREE_DAY' | 'MONTHLY' = 'MONTHLY'
): EmailTemplate {
  const providerInfo =
    provider === 'DLOCAL'
      ? `

      <p><strong>Important:</strong> Your subscription was paid via local payment method (dLocal).</p>

      <p>Unlike card payments, dLocal subscriptions require manual renewal.</p>

      <p>We'll send you a reminder 3 days before your subscription expires.</p>

    `
      : `<p>Your subscription will automatically renew each month.</p>`;

  const planInfo =
    planType === 'THREE_DAY'
      ? '<p>Your 3-day PRO trial has begun!</p>'
      : '<p>Your monthly PRO subscription is now active!</p>';

  return {
    subject:
      planType === 'THREE_DAY'
        ? 'Your 3-Day PRO Trial Has Started!'
        : 'Welcome to Trading Alerts PRO!',

    html: `

      <h1>Welcome to Trading Alerts PRO!</h1>

      <p>Hi ${name},</p>

      ${planInfo}

      <p>You now have access to:</p>

      <ul>

        <li>15 trading symbols</li>

        <li>9 timeframes</li>

        <li>20 price alerts</li>

        <li>Priority support</li>

      </ul>

      ${providerInfo}

      <p>Happy trading!</p>

      <p>Trading Alerts Team</p>

    `,

    text: `...text version...`,
  };
}

// ADD: dLocal-specific renewal reminder email

export function getRenewalReminderEmailTemplate(
  name: string,

  expiryDate: Date,

  daysRemaining: number,

  renewalUrl: string
): EmailTemplate {
  return {
    subject: `Your PRO subscription expires in ${daysRemaining} days`,

    html: `

      <h1>Renewal Reminder</h1>

      <p>Hi ${name},</p>

      <p>Your Trading Alerts PRO subscription will expire on <strong>${expiryDate.toLocaleDateString()}</strong>.</p>

      <p>Since you paid with a local payment method, renewal is not automatic.</p>

      <p><a href="${renewalUrl}" style="...button styles...">Renew Now</a></p>

      <p>If you don't renew, your account will be downgraded to FREE tier with:</p>

      <ul>

        <li>5 trading symbols (down from 15)</li>

        <li>3 timeframes (down from 9)</li>

        <li>5 price alerts (down from 20)</li>

      </ul>

      <p>Trading Alerts Team</p>

    `,

    text: `...text version...`,
  };
}

// MODIFY: Add provider parameter to existing send functions

export async function sendUpgradeEmail(
  email: string,

  name: string,

  provider: 'STRIPE' | 'DLOCAL' = 'STRIPE',

  planType: 'THREE_DAY' | 'MONTHLY' = 'MONTHLY'
): Promise<void> {
  const template = getUpgradeEmailTemplate(name, provider, planType);

  // ... send email logic ...
}
```

**Commit:** `feat(email): add dLocal-specific email templates`

---

## Seed Code References (UI Patterns)

Use these seed files for UI reference patterns:

```

seed-code/v0-components/part-18-payment-method-selector/components/payment-method-selector.tsx

seed-code/v0-components/part-18-price-display-component/components/price-display.tsx

seed-code/v0-components/part-18-unified-checkout/app/checkout/page.tsx

seed-code/v0-components/part-18-renewal-reminder-email/app/preview-renewal-email/page.tsx

```

---

## Build Sequence (Updated with Integration Phase)

### Step 1-10: Build Part 18 NEW Files (Phases A-I)

Follow the original sequence for files 1-37 (database, types, services, APIs, components, checkout, emails, admin, config).

### Step 11: Retrofit Part 12 Files (Phase J)

**CRITICAL: Do Phase J AFTER all Part 18 files are built and tested.**

1. Start with `lib/stripe/stripe.ts` (minimal changes, exports only)

2. Then `lib/stripe/webhook-handlers.ts` (add paymentProvider field)

3. Then `lib/email/subscription-emails.ts` (add provider params)

4. Then API routes (`subscription`, `checkout`, `invoices`)

5. Finally frontend (`pricing page`, `subscription card`)

**Test after each modification to ensure existing Stripe flow still works!**

---

## Commit Strategy (Updated)

```bash

# Phases A-I (same as before)

# ...



# Phase J - Part 12 Retrofit

git add lib/stripe/stripe.ts

git commit -m "feat(stripe): add payment provider type exports"



git add lib/stripe/webhook-handlers.ts

git commit -m "feat(stripe): add paymentProvider to subscription creation"



git add lib/email/subscription-emails.ts

git commit -m "feat(email): add dLocal-specific email templates"



git add app/api/subscription/route.ts

git commit -m "feat(api): add paymentProvider support to subscription endpoint"



git add app/api/checkout/route.ts

git commit -m "feat(api): add provider routing to checkout endpoint"



git add app/api/invoices/route.ts

git commit -m "feat(api): include dLocal payments in invoices endpoint"



git add app/\(marketing\)/pricing/page.tsx

git commit -m "feat(pricing): add dLocal support and 3-day plan option"



git add components/billing/subscription-card.tsx

git commit -m "feat(billing): add dLocal support to subscription card"

```

---

## Environment Variables Required

Add to `.env`:

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

---

## Success Criteria (Updated)

Part 18 is complete when:

**New dLocal Files (37):**

- [ ] All 37 new files created

- [ ] Database migration successful

- [ ] dLocal services working

- [ ] dLocal API routes working

- [ ] dLocal webhooks processing

- [ ] Cron jobs configured

**Part 12 Integration (8):**

- [ ] Pricing page shows dLocal options for supported countries

- [ ] Pricing page shows 3-day plan option

- [ ] Checkout routes to correct provider

- [ ] Subscription API returns paymentProvider

- [ ] Invoices include both Stripe and dLocal payments

- [ ] Subscription card shows provider-specific UI

- [ ] Emails include provider-specific content

- [ ] **Existing Stripe flow still works!**

**Unified System:**

- [ ] Single checkout shows both Stripe and dLocal options

- [ ] Country detection works with manual override

- [ ] Payment methods load dynamically for 8 countries

- [ ] Prices display in local currency with USD equivalent

- [ ] 3-day plan works (dLocal only, one-time per account)

- [ ] Monthly plan works (both providers)

- [ ] Discount codes work on monthly only (rejected for 3-day)

- [ ] Webhook handles payment success/failure correctly

- [ ] Early renewal extends subscription correctly

- [ ] Renewal reminders sent 3 days before expiry (dLocal only)

- [ ] Expired subscriptions downgraded to FREE (dLocal only)

- [ ] Fraud alerts logged for suspicious patterns

- [ ] Admin can review fraud alerts

- [ ] All validation passes

---

## Critical Reminders

1. **NEVER apply Stripe auto-renewal logic to dLocal subscriptions**

2. **3-day plan is ONE-TIME per account - enforce via hasUsedThreeDayPlan**

3. **Discount codes NOT allowed on 3-day plan**

4. **Always verify webhook signatures before processing**

5. **Store BOTH local currency AND USD amounts in database**

6. **dLocal API secrets are SERVER-SIDE only**

7. **Early renewal EXTENDS from current expiry, not from today**

8. **Use crypto.randomBytes() for secure hashing, NOT Math.random()**

9. **TEST STRIPE FLOW after each Part 12 modification!**

10. **Phase J MUST be done AFTER Part 18 new files are complete**

---

## Reference Files

- Implementation Guide: `docs/implementation-guides/v5_part_r.md`

- Policy Document: `docs/policies/07-dlocal-integration-rules.md`

- Build Order: `docs/build-orders/part-18-dlocal.md`

- Coding Patterns: `docs/policies/05-coding-patterns-part-1.md` and `05-coding-patterns-part-2.md`

- Architecture: `ARCHITECTURE-compress.md`

- Progress: `PROGRESS-part-2.md`

- Part 12 Prompt: `PART-12-CLAUDE-CODE-PROMPT.md` (understand existing patterns)

---

**BEGIN BUILDING PART 18**

1. Start with Phase A (Database & Types)

2. Proceed through Phases B-I (NEW Part 18 files)

3. Test Part 18 independently

4. Then Phase J (Part 12 Retrofit)

5. Test unified system (both Stripe and dLocal)

6. Validate and commit after each phase
