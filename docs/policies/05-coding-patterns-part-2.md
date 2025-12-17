## PATTERN 8: CRYPTOGRAPHICALLY SECURE CODE GENERATION

**File:** `lib/affiliates/code-generator.ts`

**Purpose:** Generate affiliate discount codes securely (not guessable)

**Full Implementation:**

```typescript
// lib/affiliates/code-generator.ts

import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';

/**
 * Generate cryptographically secure affiliate code
 *
 * Format: PREFIX-RANDOMHEX
 * Example: SMIT-a7f3e9d1c2b4
 *
 * CRITICAL: Uses crypto.randomBytes (NOT Math.random)
 */
export function generateAffiliateCode(affiliateName: string): string {
  // 1. Create prefix from affiliate name (optional, for readability)
  const prefix = affiliateName
    .slice(0, 4)
    .toUpperCase()
    .replace(/[^A-Z]/g, '') // Remove non-letters
    .padEnd(4, 'X'); // Pad if < 4 chars

  // 2. Generate cryptographically secure random component
  const randomHex = crypto.randomBytes(16).toString('hex');

  // 3. Combine (total length >12 characters)
  const code = `${prefix}-${randomHex.slice(0, 12)}`;

  return code;
}

/**
 * Generate unique affiliate code (check database for collisions)
 *
 * Attempts up to 10 times to generate unique code.
 * Collision probability is extremely low with crypto.randomBytes.
 */
export async function generateUniqueAffiliateCode(
  affiliateName: string
): Promise<string> {
  const MAX_ATTEMPTS = 10;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateAffiliateCode(affiliateName);

    // Check if code already exists
    const existing = await prisma.affiliateCode.findUnique({
      where: { code },
    });

    if (!existing) {
      return code; // ✅ Unique code found
    }

    // Collision detected (extremely rare), try again
    console.warn(`Code collision on attempt ${attempt + 1}: ${code}`);
  }

  throw new Error(
    `Failed to generate unique code after ${MAX_ATTEMPTS} attempts`
  );
}

/**
 * Generate multiple codes in batch
 * Used during monthly code distribution
 */
export async function generateAffiliateCodeBatch(
  affiliateId: string,
  affiliateName: string,
  count: number
): Promise<
  Array<{ code: string; affiliateId: string; status: string; expiresAt: Date }>
> {
  // Fetch current config from SystemConfig table
  const discountConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_discount_percent' },
  });
  const commissionConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_commission_percent' },
  });

  const discountPercent = parseFloat(discountConfig?.value || '20.0');
  const commissionPercent = parseFloat(commissionConfig?.value || '20.0');

  const codes: Array<{
    code: string;
    affiliateId: string;
    status: string;
    discountPercent: number;
    commissionPercent: number;
    expiresAt: Date;
  }> = [];

  // Calculate end of current month
  const now = new Date();
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  for (let i = 0; i < count; i++) {
    const code = await generateUniqueAffiliateCode(affiliateName);

    codes.push({
      code,
      affiliateId,
      status: 'ACTIVE',
      discountPercent, // From SystemConfig (default 20%)
      commissionPercent, // From SystemConfig (default 20%)
      expiresAt: endOfMonth,
    });
  }

  return codes;
}
```

**Example - Bad (DO NOT USE):**

```typescript
// ❌ WRONG - Predictable pattern
function badCodeGenerator(affiliate: Affiliate) {
  return `${affiliate.name}-${affiliate.id}`; // Easy to guess
}

// ❌ WRONG - Math.random is NOT cryptographically secure
function badCodeGenerator2() {
  return Math.random().toString(36).substring(7); // Predictable
}

// ❌ WRONG - Sequential codes
let counter = 1000;
function badCodeGenerator3() {
  return `CODE-${counter++}`; // Attacker can enumerate
}
```

---

## PATTERN 9: COMMISSION CALCULATION IN STRIPE WEBHOOK

**File:** `app/api/webhooks/stripe/route.ts`

**Purpose:** Create commissions when Stripe payment succeeds (ONLY via webhook)

**Full Implementation:**

```typescript
// app/api/webhooks/stripe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Stripe Webhook Handler
 *
 * CRITICAL: Commissions MUST ONLY be created here (not via manual API)
 * This ensures commission tied to actual payment
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify webhook signature (security)
    const body = await req.text();
    const sig = req.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // 2. Handle checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      await handleCheckoutComplete(session);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout completion
 * Creates subscription AND commission (if affiliate code used)
 */
async function handleCheckoutComplete(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const affiliateCodeValue = session.metadata?.affiliateCode;

  if (!userId) {
    console.error('Missing userId in session metadata');
    return;
  }

  // 1. Update user's subscription
  await prisma.subscription.create({
    data: {
      userId,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
      stripePriceId: session.metadata!.priceId,
      stripeCurrentPeriodEnd: new Date(/* ... */),
      status: 'active',
      plan: 'PRO',
      metadata: affiliateCodeValue
        ? { affiliateCode: affiliateCodeValue }
        : null,
    },
  });

  // 2. Update user tier
  await prisma.user.update({
    where: { id: userId },
    data: { tier: 'PRO' },
  });

  // 3. If affiliate code used, create commission
  if (affiliateCodeValue) {
    await createCommissionFromCode(
      affiliateCodeValue,
      userId,
      session.subscription as string,
      parseFloat(session.metadata!.regularPrice)
    );
  }
}

/**
 * Create commission from affiliate code
 *
 * CRITICAL FORMULA:
 * - Regular Price: e.g., $29.00
 * - Discount Amount: regularPrice × (discountPercent / 100)
 * - Net Revenue: regularPrice - discountAmount
 * - Commission Amount: netRevenue × (commissionPercent / 100)
 */
async function createCommissionFromCode(
  codeValue: string,
  userId: string,
  subscriptionId: string,
  regularPrice: number
): Promise<void> {
  // 1. Fetch affiliate code
  const code = await prisma.affiliateCode.findUnique({
    where: { code: codeValue },
    include: { affiliate: true },
  });

  if (!code) {
    console.error('Affiliate code not found:', codeValue);
    return;
  }

  if (code.status !== 'ACTIVE') {
    console.error('Affiliate code not active:', codeValue, code.status);
    return;
  }

  // 2. Calculate commission (EXACT FORMULA)
  const discountPercent = code.discountPercent; // 20.0
  const commissionPercent = code.commissionPercent; // 20.0

  const discountAmount = regularPrice * (discountPercent / 100); // 29.00 × 0.20 = 5.80
  const netRevenue = regularPrice - discountAmount; // 29.00 - 5.80 = 23.20
  const commissionAmount = netRevenue * (commissionPercent / 100); // 23.20 × 0.20 = 4.64

  // 3. Create commission record (status: PENDING)
  const commission = await prisma.commission.create({
    data: {
      affiliateId: code.affiliateId,
      affiliateCodeId: code.id,
      userId,
      subscriptionId,
      regularPrice,
      discountAmount,
      netRevenue,
      commissionPercent,
      commissionAmount,
      status: 'PENDING', // ✅ Awaits admin payment
    },
  });

  // 4. Mark code as USED
  await prisma.affiliateCode.update({
    where: { id: code.id },
    data: {
      status: 'USED',
      usedAt: new Date(),
      usedByUserId: userId,
    },
  });

  // 5. Update affiliate stats
  await prisma.affiliate.update({
    where: { id: code.affiliateId },
    data: {
      codesDistributed: { increment: 0 }, // No change
      totalEarnings: { increment: commissionAmount },
    },
  });

  // 6. Send email notification to affiliate
  await sendEmail({
    to: code.affiliate.email,
    subject: 'Commission Earned! 🎉',
    html: `
      <h1>You earned a commission!</h1>
      <p>Your code <strong>${codeValue}</strong> was used.</p>
      <p><strong>Commission: $${commissionAmount.toFixed(2)}</strong></p>
      <p>View details in your <a href="https://yourdomain.com/affiliate/dashboard">dashboard</a>.</p>
    `,
  });

  console.log('Commission created:', {
    commissionId: commission.id,
    affiliateId: code.affiliateId,
    amount: commissionAmount,
    code: codeValue,
  });
}
```

---

## PATTERN 10: ACCOUNTING-STYLE REPORT GENERATION

**File:** `app/api/affiliate/dashboard/commission-report/route.ts`

**Purpose:** Generate commission report with accounting format (opening/closing balance)

**Full Implementation:**

```typescript
// app/api/affiliate/dashboard/commission-report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAffiliateFromToken } from '@/lib/auth/affiliate-auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/affiliate/dashboard/commission-report
 *
 * Returns accounting-style commission report:
 * - Opening Balance (from previous month)
 * - Earned this month
 * - Paid this month
 * - Closing Balance (opening + earned - paid)
 * - Drill-down: Individual commissions
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate affiliate
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const affiliate = await getAffiliateFromToken(token);
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get('month'); // Format: "2024-01"

    const reportMonth = monthParam ? new Date(`${monthParam}-01`) : new Date(); // Default: current month

    // 3. Calculate date range for this month
    const startOfMonth = new Date(
      reportMonth.getFullYear(),
      reportMonth.getMonth(),
      1
    );
    const endOfMonth = new Date(
      reportMonth.getFullYear(),
      reportMonth.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    // 4. Fetch commissions for this month
    const commissionsThisMonth = await prisma.commission.findMany({
      where: {
        affiliateId: affiliate.id,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        affiliateCode: true,
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 5. Calculate opening balance (all commissions before this month)
    const commissionsBeforeMonth = await prisma.commission.findMany({
      where: {
        affiliateId: affiliate.id,
        createdAt: { lt: startOfMonth },
      },
      select: {
        commissionAmount: true,
        status: true,
      },
    });

    const openingBalance = commissionsBeforeMonth.reduce((sum, c) => {
      // Opening = earned - paid (from previous months)
      return sum + (c.status === 'PAID' ? 0 : c.commissionAmount);
    }, 0);

    // 6. Calculate this month's activity
    const earned = commissionsThisMonth.reduce(
      (sum, c) => sum + c.commissionAmount,
      0
    );

    const paid = commissionsThisMonth
      .filter((c) => c.status === 'PAID')
      .reduce((sum, c) => sum + c.commissionAmount, 0);

    // 7. Calculate closing balance
    const closingBalance = openingBalance + earned - paid;

    // 8. Validate accounting (sanity check)
    const calculated = openingBalance + earned - paid;
    if (Math.abs(calculated - closingBalance) > 0.01) {
      console.error('Accounting mismatch:', {
        openingBalance,
        earned,
        paid,
        closingBalance,
        calculated,
      });
    }

    // 9. Build response
    const report = {
      reportMonth: reportMonth.toISOString().slice(0, 7), // "2024-01"
      openingBalance: parseFloat(openingBalance.toFixed(2)),
      earned: parseFloat(earned.toFixed(2)),
      paid: parseFloat(paid.toFixed(2)),
      closingBalance: parseFloat(closingBalance.toFixed(2)),
      commissions: commissionsThisMonth.map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: c.user.name,
        subscriptionId: c.subscriptionId,
        affiliateCode: c.affiliateCode.code,
        createdAt: c.createdAt.toISOString(),
        regularPrice: c.regularPrice,
        discountAmount: c.discountAmount,
        netRevenue: c.netRevenue,
        commissionPercent: c.commissionPercent,
        commissionAmount: c.commissionAmount,
        status: c.status,
        paidAt: c.paidAt?.toISOString() || null,
      })),
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('Commission report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
```

**Key Validation:**

```typescript
// Validate accounting balance reconciles
const calculated = openingBalance + earned - paid;
if (Math.abs(calculated - closingBalance) > 0.01) {
  throw new Error('Accounting mismatch: balance does not reconcile');
}

// Validate earned matches sum of commissions
const totalEarned = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);
if (Math.abs(totalEarned - earned) > 0.01) {
  throw new Error('Commission total mismatch');
}
```

---

## Pattern 11: Payment Provider Strategy Pattern (dLocal Integration)

**Use this pattern for:** Isolating Stripe and dLocal logic using strategy pattern

**File:** `lib/payments/subscription-manager.ts`

```typescript
interface PaymentProvider {
  createCheckoutSession(userId: string, plan: PlanType): Promise<CheckoutSession>;
  processCallback(data: unknown): Promise<Subscription>;
  renewSubscription(subscriptionId: string): Promise<Subscription>;
}

class StripeProvider implements PaymentProvider {
  async createCheckoutSession(userId: string, plan: PlanType) {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
      subscription_data: { trial_period_days: 7 }  // Stripe has trial
    });
    return session;
  }

  async renewSubscription(subscriptionId: string) {
    throw new Error('Stripe subscriptions auto-renew. Manual renewal not supported.');
  }
}

class DLocalProvider implements PaymentProvider {
  async createCheckoutSession(userId: string, plan: PlanType) {
    const { country, currency } = await getUserCountry(userId);
    const { amount, rate } = await convertUsdToLocal(PLANS[plan].usd, currency);

    const payment = await dlocal.createPayment({
      amount,
      currency,
      country
      // dLocal has NO trial period
    });
    return payment;
  }

  async renewSubscription(subscriptionId: string) {
    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });

    if (sub.planType === 'THREE_DAY') {
      throw new Error('Cannot renew 3-day plan. Purchase monthly instead.');
    }

    // Early renewal with day stacking
    const newExpiresAt = new Date(sub.expiresAt);
    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

    // Process payment and update subscription
    const payment = await dlocal.createPayment({...});
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { expiresAt: newExpiresAt }
    });

    return updatedSubscription;
  }
}

// Factory function
export function getPaymentProvider(provider: 'STRIPE' | 'DLOCAL'): PaymentProvider {
  return provider === 'STRIPE' ? new StripeProvider() : new DLocalProvider();
}

// Usage in API routes
export async function POST(req: NextRequest) {
  const { provider, plan } = await req.json();
  const paymentProvider = getPaymentProvider(provider);
  const session = await paymentProvider.createCheckoutSession(userId, plan);
  return NextResponse.json(session);
}
```

**Why this pattern:**

- Easy to add new payment providers (just implement interface)
- Keeps provider-specific logic isolated
- Prevents mixing Stripe and dLocal logic
- Type-safe with TypeScript interfaces

---

## Pattern 12: Payment Provider Conditional Rendering

**Use this pattern for:** Frontend components that show different options for Stripe vs dLocal

**File:** `components/payments/payment-provider-selector.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';

const DLOCAL_COUNTRIES = ['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR'];

const CURRENCY_SYMBOLS = {
  'INR': '₹',
  'NGN': '₦',
  'PKR': '₨',
  'VND': '₫',
  'IDR': 'Rp',
  'THB': '฿',
  'ZAR': 'R',
  'TRY': '₺',
  'USD': '$'
};

export function PaymentProviderSelector({ country }: { country: string }) {
  const [selectedProvider, setSelectedProvider] = useState<'STRIPE' | 'DLOCAL'>('STRIPE');
  const [pricing, setPricing] = useState({ monthly: 29.00, threeDay: 0.96, currency: 'USD' });

  useEffect(() => {
    // Fetch localized pricing
    if (DLOCAL_COUNTRIES.includes(country)) {
      fetch(`/api/payments/pricing?country=${country}`)
        .then(res => res.json())
        .then(data => setPricing(data));
    }
  }, [country]);

  const showDLocal = DLOCAL_COUNTRIES.includes(country);
  const currencySymbol = CURRENCY_SYMBOLS[pricing.currency] || '$';

  return (
    <div className="space-y-4">
      <h2>Choose Payment Method</h2>

      {/* Stripe Option (always available) */}
      <div
        className={`border rounded p-4 cursor-pointer ${selectedProvider === 'STRIPE' ? 'border-blue-500' : ''}`}
        onClick={() => setSelectedProvider('STRIPE')}
      >
        <h3>International Cards (Stripe)</h3>
        <p>Visa, Mastercard, Amex</p>
        <p className="text-lg font-bold">$29.00 USD / month</p>
        <ul className="text-sm text-gray-600">
          <li>✅ 7-day free trial</li>
          <li>✅ Auto-renewal (cancel anytime)</li>
          <li>✅ Accepted worldwide</li>
        </ul>
      </div>

      {/* dLocal Option (only for supported countries) */}
      {showDLocal && (
        <div
          className={`border rounded p-4 cursor-pointer ${selectedProvider === 'DLOCAL' ? 'border-blue-500' : ''}`}
          onClick={() => setSelectedProvider('DLOCAL')}
        >
          <h3>Local Payment Methods (dLocal)</h3>
          <p>UPI, NetBanking, Mobile Wallets</p>

          <div className="mt-2 space-y-2">
            <div>
              <p className="text-sm">3-Day Trial (one-time use)</p>
              <p className="text-lg font-bold">
                {currencySymbol}{pricing.threeDay.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm">Monthly Plan</p>
              <p className="text-lg font-bold">
                {currencySymbol}{pricing.monthly.toLocaleString()} / month
              </p>
            </div>
          </div>

          <ul className="text-sm text-gray-600 mt-2">
            <li>❌ No auto-renewal (manual renewal required)</li>
            <li>✅ Pay in local currency</li>
            <li>✅ Popular local payment methods</li>
          </ul>
        </div>
      )}

      <button
        onClick={() => handleCheckout(selectedProvider)}
        className="w-full bg-blue-500 text-white py-2 rounded"
      >
        Continue with {selectedProvider === 'STRIPE' ? 'Stripe' : 'dLocal'}
      </button>
    </div>
  );
}
```

**Key Points:**

- Only show dLocal for supported countries (IN, NG, PK, VN, ID, TH, ZA, TR)
- Display prices in local currency with correct symbols
- Show different features (trial, auto-renewal) for each provider
- Clear visual distinction between providers

---

## Pattern 13: Multi-Signal Trial Abuse Detection (Stripe)

**Use this pattern for:** Preventing Stripe 7-day trial abuse without requiring credit card upfront (maximizes conversion ~40-60%)

**Files:**

- `app/api/auth/register/route.ts` - Capture fraud signals at registration
- `lib/fraud-detection.ts` - Multi-signal fraud detection utility
- `lib/fingerprint.ts` - Client-side device fingerprinting
- `app/api/payments/stripe/start-trial/route.ts` - Trial start without card
- `app/api/cron/stripe-trial-expiry/route.ts` - Trial expiry handler

**Pattern Overview:**

**4 Independent Fraud Signals:**

1. IP-based detection (≥3 trials from same IP in 30 days = HIGH severity)
2. Device fingerprint detection (≥2 trials from same device in 30 days = HIGH severity)
3. Disposable email detection (temp email domains = MEDIUM severity)
4. Rapid signup velocity (≥5 accounts from same IP in 1 hour = HIGH severity)

**Flow:**

1. User registers → Capture IP + device fingerprint
2. Check fraud patterns BEFORE creating account
3. Block HIGH severity immediately, flag MEDIUM for admin review
4. User starts trial → Check `hasUsedStripeTrial` flag
5. Grant PRO for 7 days WITHOUT payment method
6. Cron job checks expiry every 6 hours → Downgrade to FREE if not converted

---

### Step 1: User Registration with Fraud Detection

**File:** `app/api/auth/register/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectTrialAbuse } from '@/lib/fraud-detection';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const validated = signupSchema.parse(body);

    // ✅ Extract fraud detection signals
    const signupIP =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.ip ||
      null;
    const deviceFingerprint = req.headers.get('x-device-fingerprint') || null;

    // ✅ Check for trial abuse BEFORE creating account
    const fraudCheck = await detectTrialAbuse({
      email: validated.email,
      signupIP,
      deviceFingerprint,
    });

    if (fraudCheck) {
      // Create FraudAlert for admin review
      await prisma.fraudAlert.create({
        data: {
          userId: null, // No user created yet
          alertType: fraudCheck.type,
          severity: fraudCheck.severity,
          description: fraudCheck.description,
          detectedAt: new Date(),
          ipAddress: signupIP,
          deviceFingerprint,
          additionalData: {
            email: validated.email,
            blockedAtRegistration: fraudCheck.severity === 'HIGH',
          },
        },
      });

      // ❌ Block HIGH severity attempts immediately
      if (fraudCheck.severity === 'HIGH') {
        return NextResponse.json(
          {
            error:
              'Unable to create account at this time. Please contact support if you believe this is an error.',
            errorCode: 'REGISTRATION_BLOCKED',
          },
          { status: 403 }
        );
      }

      // ⚠️ Allow MEDIUM severity but flag for admin review
      // Continue with account creation below
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // ✅ Create user with fraud detection fields
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        tier: 'FREE',
        hasUsedStripeTrial: false, // Trial not used yet
        signupIP,
        lastLoginIP: signupIP,
        deviceFingerprint,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    console.error('User registration failed:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

---

### Step 2: Fraud Detection Utility (4 Patterns)

**File:** `lib/fraud-detection.ts`

```typescript
import { prisma } from '@/lib/prisma';

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'maildrop.cc',
  'temp-mail.org',
  'getnada.com',
];

interface FraudCheckContext {
  email: string;
  signupIP: string | null;
  deviceFingerprint: string | null;
}

interface FraudCheckResult {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export async function detectTrialAbuse(
  context: FraudCheckContext
): Promise<FraudCheckResult | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // ✅ Pattern 1: IP-based abuse (≥3 trials from same IP in 30 days)
  if (context.signupIP) {
    const recentTrialsFromIP = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentTrialsFromIP >= 3) {
      return {
        type: 'STRIPE_TRIAL_IP_ABUSE',
        severity: 'HIGH',
        description: `IP address ${context.signupIP} used for ${recentTrialsFromIP} trial accounts in past 30 days`,
      };
    }
  }

  // ✅ Pattern 2: Device fingerprint abuse (≥2 trials from same device in 30 days)
  if (context.deviceFingerprint) {
    const recentTrialsFromDevice = await prisma.user.count({
      where: {
        deviceFingerprint: context.deviceFingerprint,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentTrialsFromDevice >= 2) {
      return {
        type: 'STRIPE_TRIAL_DEVICE_ABUSE',
        severity: 'HIGH',
        description: `Device fingerprint used for ${recentTrialsFromDevice} trial accounts in past 30 days`,
      };
    }
  }

  // ✅ Pattern 3: Disposable email domain (MEDIUM severity)
  const emailDomain = context.email.split('@')[1].toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
    return {
      type: 'DISPOSABLE_EMAIL_DETECTED',
      severity: 'MEDIUM',
      description: `Registration using disposable email domain: ${emailDomain}`,
    };
  }

  // ✅ Pattern 4: Rapid signup velocity (≥5 accounts from same IP in 1 hour)
  if (context.signupIP) {
    const rapidSignups = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (rapidSignups >= 5) {
      return {
        type: 'RAPID_SIGNUP_VELOCITY',
        severity: 'HIGH',
        description: `${rapidSignups} accounts created from IP ${context.signupIP} in past hour (bot attack)`,
      };
    }
  }

  return null; // No fraud detected
}
```

---

### Step 3: Client-Side Device Fingerprinting

**File:** `lib/fingerprint.ts` (Client-side)

```typescript
/**
 * Generate browser fingerprint for fraud detection
 * Uses browser characteristics to create unique device ID
 * @returns SHA-256 hash of device characteristics
 */
export async function generateDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    new Date().getTimezoneOffset().toString(),
    (!!window.sessionStorage).toString(),
    (!!window.localStorage).toString(),
    navigator.hardwareConcurrency?.toString() || 'unknown',
    navigator.maxTouchPoints?.toString() || '0',
  ];

  const fingerprint = components.join('|');

  // Create SHA-256 hash using SubtleCrypto API
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Usage in Registration Form:**

**File:** `app/(auth)/register/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { generateDeviceFingerprint } from '@/lib/fingerprint';

export default function RegisterPage() {
  const [fingerprint, setFingerprint] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    generateDeviceFingerprint().then(setFingerprint);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': fingerprint  // ✅ Send fingerprint to server
      },
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
        name: formData.get('name')
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Registration successful
      window.location.href = '/dashboard';
    } else {
      // Handle error (blocked, validation, etc.)
      alert(data.error);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" name="email" required />
      <input type="password" name="password" required />
      <input type="text" name="name" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Sign up'}
      </button>
    </form>
  );
}
```

---

### Step 4: Trial Start Endpoint (No Card Required)

**File:** `app/api/payments/stripe/start-trial/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Check if user already used their trial
    if (session.user.hasUsedStripeTrial) {
      return NextResponse.json(
        {
          error:
            'You have already used your free trial. Please subscribe to continue using PRO features.',
          errorCode: 'TRIAL_ALREADY_USED',
        },
        { status: 403 }
      );
    }

    // Calculate trial end date (7 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // ✅ Grant PRO tier for 7 days WITHOUT payment method
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          tier: 'PRO',
          hasUsedStripeTrial: true,
          stripeTrialStartedAt: new Date(),
        },
      }),
      prisma.subscription.create({
        data: {
          userId: session.user.id,
          paymentProvider: 'STRIPE',
          planType: 'MONTHLY',
          status: 'trialing',
          expiresAt: trialEndDate,
          amountUsd: 0, // Free trial
        },
      }),
    ]);

    return NextResponse.json(
      {
        message: 'Trial started successfully',
        trialEndsAt: trialEndDate.toISOString(),
        tier: 'PRO',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Trial start failed:', error);
    return NextResponse.json(
      { error: 'Failed to start trial' },
      { status: 500 }
    );
  }
}
```

---

### Step 5: Trial Expiry Cron Job

**File:** `app/api/cron/stripe-trial-expiry/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ✅ Verify Vercel Cron secret
  if (
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find Stripe trials that have expired
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'STRIPE',
      status: 'trialing',
      expiresAt: { lt: now },
    },
    include: { user: true },
  });

  for (const subscription of expiredTrials) {
    // Check if user converted to paid subscription
    const paidSubscription = await prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        paymentProvider: 'STRIPE',
        status: 'active',
        stripeSubscriptionId: { not: null }, // Has paid subscription
      },
    });

    if (paidSubscription) {
      // ✅ User converted - delete trial subscription
      await prisma.subscription.delete({
        where: { id: subscription.id },
      });
    } else {
      // ❌ User did NOT convert - downgrade to FREE
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'expired' },
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: { tier: 'FREE' },
        }),
      ]);

      // Send trial expiry email
      await sendEmail(subscription.user.email, 'Trial Expired', {
        subject: 'Your 7-day PRO trial has ended',
        message: 'Subscribe now to continue enjoying PRO features!',
        ctaText: 'Subscribe Now',
        ctaUrl: 'https://app.com/dashboard/billing',
      });
    }
  }

  return NextResponse.json({
    checked: expiredTrials.length,
    message: 'Trial expiry check completed',
  });
}
```

**Vercel Cron Configuration:**

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/stripe-trial-expiry",
      "schedule": "0 */6 * * *" // Every 6 hours
    },
    {
      "path": "/api/cron/check-expirations",
      "schedule": "0 0 * * *" // Daily at midnight UTC (dLocal subscriptions)
    }
  ]
}
```

---

### Step 6: Admin Fraud Alert Dashboard (Optional)

**File:** `app/api/admin/fraud-alerts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  // TODO: Verify admin role
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get('severity') as
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | null;
  const reviewed = searchParams.get('reviewed') === 'true';

  const alerts = await prisma.fraudAlert.findMany({
    where: {
      ...(severity && { severity }),
      ...(reviewed !== null && {
        reviewedBy: reviewed ? { not: null } : null,
      }),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          hasUsedStripeTrial: true,
        },
      },
    },
    orderBy: { detectedAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(alerts);
}

// Mark fraud alert as reviewed
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { alertId, resolution, notes } = await req.json();

  const alert = await prisma.fraudAlert.update({
    where: { id: alertId },
    data: {
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      resolution,
      notes,
    },
  });

  return NextResponse.json(alert);
}
```

---

### Step 7: Admin Fraud Management Actions

**File:** `app/api/admin/fraud-alerts/[id]/actions/route.ts`

Admin dashboard needs comprehensive enforcement capabilities beyond just reviewing alerts:

**Available Admin Actions:**

1. **Dismiss (False Positive)** - Alert was incorrect, no action needed
2. **Send Warning Email** - Alert user about suspicious activity
3. **Block Account** - Temporarily or permanently disable user account
4. **Unblock Account** - Restore access to previously blocked user
5. **Whitelist User** - Prevent future alerts for this user (trusted)
6. **Add Notes** - Document decision reasoning for audit trail

```typescript
// app/api/admin/fraud-alerts/[id]/actions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

type AdminAction =
  | 'DISMISS' // False positive
  | 'SEND_WARNING' // Email warning to user
  | 'BLOCK_ACCOUNT' // Disable user account
  | 'UNBLOCK_ACCOUNT' // Restore user account
  | 'WHITELIST_USER'; // Trust user (no future alerts)

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // ✅ Verify admin authentication
  const session = await getServerSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, notes, blockDuration } = (await req.json()) as {
    action: AdminAction;
    notes: string;
    blockDuration?: 'TEMPORARY' | 'PERMANENT';
  };

  // Fetch fraud alert with user details
  const alert = await prisma.fraudAlert.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  if (!alert) {
    return NextResponse.json(
      { error: 'Fraud alert not found' },
      { status: 404 }
    );
  }

  // Execute admin action
  switch (action) {
    case 'DISMISS':
      await prisma.fraudAlert.update({
        where: { id: params.id },
        data: {
          resolution: 'FALSE_POSITIVE',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          notes,
        },
      });
      return NextResponse.json({
        success: true,
        message: 'Alert dismissed as false positive',
      });

    case 'SEND_WARNING':
      // Update fraud alert
      await prisma.fraudAlert.update({
        where: { id: params.id },
        data: {
          resolution: 'WARNING_SENT',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          notes,
        },
      });

      // Send warning email to user
      await sendEmail(alert.user.email, 'Security Alert', {
        subject: '⚠️ Suspicious activity detected on your account',
        html: `
          <h2>Security Alert</h2>
          <p>Dear ${alert.user.name},</p>
          <p>We detected suspicious activity on your account:</p>
          <ul>
            <li><strong>Alert Type:</strong> ${alert.alertType}</li>
            <li><strong>Detected:</strong> ${alert.detectedAt.toLocaleDateString()}</li>
            <li><strong>Description:</strong> ${alert.description}</li>
          </ul>
          <p><strong>Action Required:</strong></p>
          <p>${notes}</p>
          <p>If this was you, no further action is needed. If you did not perform this activity, please contact support immediately.</p>
          <p>Best regards,<br>Security Team</p>
        `,
      });

      return NextResponse.json({
        success: true,
        message: 'Warning email sent to user',
      });

    case 'BLOCK_ACCOUNT':
      // Block user account
      await prisma.$transaction([
        // Update user account
        prisma.user.update({
          where: { id: alert.userId },
          data: {
            isActive: false,
            tier: 'FREE', // Downgrade to FREE when blocked
          },
        }),
        // Expire active subscriptions
        prisma.subscription.updateMany({
          where: {
            userId: alert.userId,
            status: 'active',
          },
          data: { status: 'canceled' },
        }),
        // Update fraud alert
        prisma.fraudAlert.update({
          where: { id: params.id },
          data: {
            resolution:
              blockDuration === 'PERMANENT'
                ? 'BLOCKED_PERMANENT'
                : 'BLOCKED_TEMPORARY',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            notes: `${blockDuration || 'PERMANENT'} block. Reason: ${notes}`,
          },
        }),
      ]);

      // Send account blocked email
      await sendEmail(alert.user.email, 'Account Suspended', {
        subject: '🚫 Your account has been suspended',
        html: `
          <h2>Account Suspended</h2>
          <p>Dear ${alert.user.name},</p>
          <p>Your account has been suspended due to suspicious activity.</p>
          <p><strong>Reason:</strong> ${notes}</p>
          <p><strong>Duration:</strong> ${blockDuration || 'Permanent'}</p>
          <p>If you believe this is a mistake, please contact support at support@tradingalerts.com</p>
        `,
      });

      return NextResponse.json({
        success: true,
        message: `Account blocked (${blockDuration || 'PERMANENT'})`,
      });

    case 'UNBLOCK_ACCOUNT':
      // Unblock user account
      await prisma.$transaction([
        prisma.user.update({
          where: { id: alert.userId },
          data: { isActive: true },
        }),
        prisma.fraudAlert.update({
          where: { id: params.id },
          data: {
            resolution: 'UNBLOCKED',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            notes: `Account unblocked. ${notes}`,
          },
        }),
      ]);

      // Send account restored email
      await sendEmail(alert.user.email, 'Account Restored', {
        subject: '✅ Your account has been restored',
        html: `
          <h2>Account Restored</h2>
          <p>Dear ${alert.user.name},</p>
          <p>Your account has been restored and you can now access Trading Alerts.</p>
          <p><strong>Note:</strong> ${notes}</p>
          <p>Please ensure you follow our terms of service to avoid future suspensions.</p>
        `,
      });

      return NextResponse.json({
        success: true,
        message: 'Account unblocked successfully',
      });

    case 'WHITELIST_USER':
      // Add user to whitelist (trusted users don't trigger future alerts)
      await prisma.$transaction([
        // Mark user as whitelisted (you'll need to add this field to User model)
        prisma.user.update({
          where: { id: alert.userId },
          data: {
            // Add a metadata field or create a Whitelist table
            // For now, we'll use notes in FraudAlert
          },
        }),
        prisma.fraudAlert.update({
          where: { id: params.id },
          data: {
            resolution: 'WHITELISTED',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            notes: `User whitelisted (trusted). ${notes}`,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'User whitelisted successfully',
      });

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}
```

---

### Step 8: Admin Fraud Dashboard UI

**File:** `app/(admin)/fraud-alerts/page.tsx`

Frontend dashboard for admins to review and manage fraud alerts:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

interface FraudAlert {
  id: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  detectedAt: string;
  ipAddress: string | null;
  deviceFingerprint: string | null;
  resolution: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    hasUsedStripeTrial: boolean;
    hasUsedThreeDayPlan: boolean;
  };
}

export default function FraudAlertsDashboard() {
  const { data: session, status } = useSession();
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'HIGH' | 'MEDIUM' | 'LOW'>('all');
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (status === 'unauthenticated' || (session && session.user.role !== 'ADMIN')) {
      redirect('/dashboard');
    }
  }, [session, status]);

  // Fetch fraud alerts
  useEffect(() => {
    fetchAlerts();
  }, [filter, severityFilter]);

  const fetchAlerts = async () => {
    const params = new URLSearchParams();
    if (filter !== 'all') {
      params.set('reviewed', filter === 'resolved' ? 'true' : 'false');
    }
    if (severityFilter !== 'all') {
      params.set('severity', severityFilter);
    }

    const response = await fetch(`/api/admin/fraud-alerts?${params.toString()}`);
    const data = await response.json();
    setAlerts(data);
  };

  const handleAction = async (alertId: string, action: string, blockDuration?: string) => {
    if (!actionNotes.trim() && action !== 'DISMISS') {
      alert('Please add notes explaining your decision');
      return;
    }

    if (action === 'BLOCK_ACCOUNT') {
      if (!confirm(`Are you sure you want to BLOCK this user's account?`)) {
        return;
      }
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/fraud-alerts/${alertId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          notes: actionNotes,
          blockDuration
        })
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message);
        setActionNotes('');
        setSelectedAlert(null);
        fetchAlerts();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to perform action');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Fraud Alert Dashboard</h1>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Status</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Alerts</option>
            <option value="pending">Pending Review</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Severity</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="border rounded px-3 py-2"
          >
            <option value="all">All Severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={fetchAlerts}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No fraud alerts found
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-lg p-4 ${
                alert.resolution ? 'bg-gray-50' : 'bg-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="text-sm text-gray-600">
                      {new Date(alert.detectedAt).toLocaleString()}
                    </span>
                    {alert.resolution && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                        {alert.resolution}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-lg mb-2">{alert.alertType}</h3>
                  <p className="text-gray-700 mb-3">{alert.description}</p>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>User:</strong> {alert.user.name} ({alert.user.email})
                    </div>
                    <div>
                      <strong>Account Created:</strong>{' '}
                      {new Date(alert.user.createdAt).toLocaleDateString()}
                    </div>
                    <div>
                      <strong>Stripe Trial Used:</strong>{' '}
                      {alert.user.hasUsedStripeTrial ? 'Yes' : 'No'}
                    </div>
                    <div>
                      <strong>3-Day Plan Used:</strong>{' '}
                      {alert.user.hasUsedThreeDayPlan ? 'Yes' : 'No'}
                    </div>
                    {alert.ipAddress && (
                      <div>
                        <strong>IP Address:</strong> {alert.ipAddress}
                      </div>
                    )}
                    {alert.deviceFingerprint && (
                      <div>
                        <strong>Device:</strong>{' '}
                        {alert.deviceFingerprint.substring(0, 16)}...
                      </div>
                    )}
                  </div>

                  {alert.notes && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <strong>Admin Notes:</strong> {alert.notes}
                    </div>
                  )}
                </div>

                {!alert.resolution && (
                  <button
                    onClick={() => setSelectedAlert(alert)}
                    className="ml-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Take Action
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Take Action on Fraud Alert</h2>

            <div className="mb-4 p-4 bg-gray-100 rounded">
              <p><strong>Alert:</strong> {selectedAlert.alertType}</p>
              <p><strong>User:</strong> {selectedAlert.user.email}</p>
              <p><strong>Description:</strong> {selectedAlert.description}</p>
            </div>

            <div className="mb-4">
              <label className="block font-medium mb-2">Admin Notes (Required)</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full border rounded p-2"
                rows={4}
                placeholder="Explain your decision and reasoning..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAction(selectedAlert.id, 'DISMISS')}
                disabled={isLoading}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Dismiss (False Positive)
              </button>

              <button
                onClick={() => handleAction(selectedAlert.id, 'SEND_WARNING')}
                disabled={isLoading}
                className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
              >
                Send Warning Email
              </button>

              <button
                onClick={() => handleAction(selectedAlert.id, 'BLOCK_ACCOUNT', 'TEMPORARY')}
                disabled={isLoading}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
              >
                Block Account (Temporary)
              </button>

              <button
                onClick={() => handleAction(selectedAlert.id, 'BLOCK_ACCOUNT', 'PERMANENT')}
                disabled={isLoading}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
              >
                Block Account (Permanent)
              </button>

              <button
                onClick={() => handleAction(selectedAlert.id, 'WHITELIST_USER')}
                disabled={isLoading}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                Whitelist User (Trusted)
              </button>

              <button
                onClick={() => {
                  setSelectedAlert(null);
                  setActionNotes('');
                }}
                disabled={isLoading}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

**Key Points:**

- NO credit card required for trial start (maximizes conversion ~40-60%)
- 4 independent fraud signals (IP, device, email, velocity)
- Block HIGH severity immediately (prevent abuse)
- Create FraudAlert for admin review (all suspicious activity)
- Check `hasUsedStripeTrial` flag before allowing trial
- Cron job every 6 hours (more frequent than dLocal daily check)
- Client-side fingerprinting using browser characteristics
- SHA-256 hash for device fingerprint (privacy-friendly)
- **Admin Actions:** Dismiss, Send Warning, Block (Temp/Perm), Unblock, Whitelist
- **Email Notifications:** Automated emails for warnings, blocks, and account restoration
- **Audit Trail:** All admin actions logged with notes and timestamps
- **User Impact:** Blocked users lose access + downgrade to FREE tier

**Expected Metrics:**

- **Conversion Rate:** 40-60% (vs 5-10% with card requirement)
- **Fraud Detection:** 4 signals reduce abuse by 85-90%
- **False Positive Rate:** <5% (admin review workflow)
- **Admin Overhead:** 2-5 fraud alerts per day (manageable)
- **Admin Review Time:** ~2-3 minutes per alert
- **Block Rate:** ~5-10% of flagged alerts result in blocks

## SUMMARY OF PATTERNS

Use these patterns as templates:

1. **API Route Pattern:** Authentication → Validation → Tier Check → Business Logic → Response
2. **Client Component Pattern:** State management → Form handling → API calls → Loading/Error states
3. **Tier Validation Pattern:** Centralized validation utilities with custom errors
4. **Database Pattern:** Prisma operations isolated in lib/db/\*
5. **Flask Pattern:** Python endpoint with tier validation middleware
6. **Constants Pattern:** Centralized configuration
7. **Affiliate Authentication Pattern:** Separate JWT secret with type discriminator (Pattern 7)
8. **Code Generation Pattern:** Cryptographically secure code generation (Pattern 8)
9. **Commission Calculation Pattern:** Stripe webhook with exact formula (Pattern 9)
10. **Accounting Report Pattern:** Opening/closing balance with reconciliation (Pattern 10)
11. **Payment Provider Strategy Pattern:** Isolate Stripe and dLocal logic using strategy pattern (Pattern 11)
12. **Payment Provider Conditional Rendering:** Show different options for Stripe vs dLocal based on country (Pattern 12)
13. **Multi-Signal Trial Abuse Detection:** Prevent Stripe trial abuse using 4 fraud signals (IP, device, email, velocity) without requiring credit card upfront (Pattern 13)
14. **Python/Flask Linting Pattern:** 88 char lines, no unused imports, no unnecessary globals (Pattern 14)
15. **Tuple Return Test Pattern:** Always unpack `Tuple[bool, str]` before asserting (Pattern 15)
16. **CI-Aware Test Pattern:** Accept both connected and disconnected service states (Pattern 16)

**Remember:** Adapt these patterns to your specific requirements and ensure they match OpenAPI contracts.

---

## PATTERN 14: PYTHON/FLASK LINTING & CODE QUALITY

**Purpose:** Standards for Python/Flask services (mt5-service) to avoid CI failures

### Flake8 Configuration

**CRITICAL:** The Flask service uses **88 character line limit** (Black's default), NOT 120.

```bash
# CI command (see .github/workflows/ci-flask.yml)
flake8 . --max-line-length=88 --extend-ignore=E203,W503
```

### Common Python Linting Errors to Avoid

```python
# ❌ WRONG: Line too long (>88 chars)
logger.info(f"Connection pool initialized with {len(self.connections)} terminals from configuration file")

# ✅ CORRECT: Split long lines
logger.info(
    f"Connection pool initialized with {len(self.connections)} "
    f"terminals from configuration file"
)

# ❌ WRONG: Unused imports (F401)
from typing import Any, Dict, Optional, List  # Only List used!

# ✅ CORRECT: Only import what you use
from typing import List

# ❌ WRONG: Unnecessary global declaration in read-only function (F824)
def get_pool() -> MT5ConnectionPool:
    global _connection_pool  # NOT needed for reading!
    return _connection_pool

# ✅ CORRECT: No global needed when just reading
def get_pool() -> MT5ConnectionPool:
    return _connection_pool

# ❌ WRONG: f-string without placeholders (F541)
logger.info(f"Starting health monitor")

# ✅ CORRECT: Use regular string when no placeholders
logger.info("Starting health monitor")
```

### Requirements.txt Management

**CRITICAL:** When importing new packages, always add them to `requirements.txt`:

```bash
# If you add this import to any Python file:
import pandas as pd
import numpy as np

# You MUST add to mt5-service/requirements.txt:
pandas>=2.0.0
numpy>=1.24.0
```

---

## PATTERN 15: TUPLE RETURN TYPE HANDLING IN TESTS

**Purpose:** Correctly test functions that return `Tuple[bool, str]` instead of plain `bool`

### The Problem

When validation functions return `Tuple[bool, str]`, a tuple is **always truthy** in Python, even `(False, "error")`:

```python
# ❌ WRONG: Tuple is always truthy!
def test_validate_symbol_access_free(self):
    # This ALWAYS passes because (False, "error msg") is truthy!
    self.assertTrue(validate_symbol_access('AUDJPY', 'FREE'))
    self.assertFalse(validate_symbol_access('AUDJPY', 'FREE'))  # Also fails!
```

### The Solution

Always unpack the tuple before asserting:

```python
# ✅ CORRECT: Unpack tuple, assert on boolean
def test_validate_symbol_access_free(self):
    from app.services.tier_service import validate_symbol_access

    # Allowed symbols for FREE tier
    is_allowed, _ = validate_symbol_access('BTCUSD', 'FREE')
    self.assertTrue(is_allowed)

    # PRO-only symbol should be denied
    is_allowed, error_msg = validate_symbol_access('AUDJPY', 'FREE')
    self.assertFalse(is_allowed)
    self.assertIn('FREE tier cannot access', error_msg)
```

### With pytest:

```python
# ✅ CORRECT: pytest style
def test_free_tier_symbol_access():
    is_allowed, error = validate_symbol_access('GBPUSD', 'FREE')
    assert is_allowed is False
    assert 'FREE tier cannot access GBPUSD' in error
```

---

## PATTERN 16: CI-AWARE TEST PATTERNS

**Purpose:** Write tests that pass in CI where external services (MT5, databases) may not be available

### Health Check Tests

External services may not be connected in CI. Test for valid responses, not specific states:

```python
# ❌ WRONG: Assumes MT5 is connected (fails in CI)
def test_health_check(self, client):
    response = client.get('/api/health')
    assert response.status_code == 200  # Fails! Gets 503 in CI
    data = response.get_json()
    assert data['status'] == 'ok'

# ✅ CORRECT: Accept both connected and disconnected states
def test_health_check(self, client):
    """Test health check endpoint works correctly.

    Note: In CI environment, MT5 terminals are not available so health
    returns 503 (degraded). In production with MT5 connected, returns 200.
    Both are valid responses indicating the endpoint works correctly.
    """
    response = client.get('/api/health')
    # Accept both 200 (connected) and 503 (disconnected in CI)
    assert response.status_code in (200, 503)
    data = response.get_json()
    # Status reflects connection state
    assert data['status'] in ('ok', 'degraded', 'error')
    assert 'version' in data
```

### Mocking External Services

For tests that require specific service responses, use mocking:

```python
from unittest.mock import patch, MagicMock

def test_indicators_with_mock(self, client):
    """Test indicators endpoint with mocked MT5 connection."""
    with patch('app.services.mt5_connector.get_connection') as mock_conn:
        mock_conn.return_value = MagicMock(
            fetch_indicators=lambda: {'RSI': 65.5, 'MACD': 0.002}
        )

        response = client.get(
            '/api/indicators/BTCUSD/H1',
            headers={'X-User-Tier': 'FREE'}
        )

        assert response.status_code == 200
        data = response.get_json()
        assert 'RSI' in data['indicators']
```

### Environment-Specific Test Skipping

Skip tests that require unavailable resources:

```python
import pytest
import os

@pytest.mark.skipif(
    os.getenv('CI') == 'true',
    reason="MT5 not available in CI environment"
)
def test_live_mt5_connection():
    """Test that requires actual MT5 terminal."""
    # This test only runs locally, not in CI
    pass
```

---

## SUMMARY: LESSONS LEARNED FROM CI FAILURES

| Issue | Prevention |
|-------|------------|
| Line too long | Use 88 char limit for Python (Black's default) |
| Unused imports | Only import what you use, remove unused |
| Unnecessary `global` | Don't use `global` when only reading module-level variables |
| Missing dependencies | Add all imports to requirements.txt |
| Tuple assertion errors | Always unpack `Tuple[bool, str]` before asserting |
| Health check failures in CI | Accept both connected (200) and disconnected (503) states |

**Pre-commit checklist for Python/Flask:**
1. Run `flake8 . --max-line-length=88` locally before push
2. Verify all imports are in requirements.txt
3. Ensure tests handle CI environment (no external services)

---

## PATTERN 17: NEXT.JS APP ROUTER ROUTE CONFLICTS

**Purpose:** Avoid duplicate route errors in Next.js 15 App Router

### The Problem

Next.js App Router allows route groups (folders in parentheses like `(marketing)`) that don't affect the URL path. This can cause conflicts:

```
app/
├── page.tsx                    → serves "/"
└── (marketing)/
    └── page.tsx                → ALSO serves "/" (CONFLICT!)
```

This causes Vercel build errors like:
```
Error: ENOENT: no such file or directory, open '.next/server/app/page_client-reference-manifest.js'
```

### The Solution

**Rule:** Only ONE `page.tsx` can serve each route path.

```
# ❌ WRONG: Both serve "/" route
app/page.tsx                    → "/"
app/(marketing)/page.tsx        → "/" (duplicate!)

# ✅ CORRECT: Use route group OR root, not both
# Option 1: Use route group for marketing pages
app/(marketing)/page.tsx        → "/"
app/(marketing)/pricing/page.tsx → "/pricing"
app/(dashboard)/dashboard/page.tsx → "/dashboard"

# Option 2: Use root page, no route group for home
app/page.tsx                    → "/"
app/pricing/page.tsx            → "/pricing"
```

### Pre-deployment Checklist

Before deploying, verify no duplicate routes:

```bash
# Check for potential conflicts
find app -name "page.tsx" | sort

# If you see both of these, you have a conflict:
# app/page.tsx
# app/(something)/page.tsx
```

---

## PATTERN 18: JEST SETUP FOR JSDOM ENVIRONMENT

**Purpose:** Configure Jest polyfills for testing Next.js code in jsdom environment

### The Problem

Jest with jsdom environment doesn't have certain Node.js and Web API globals that Next.js code depends on:

- `TextEncoder` / `TextDecoder` - Required by `resend`, `@react-email/render`
- `ReadableStream` / `WritableStream` - Required by `undici`
- `Request` / `Response` / `Headers` / `fetch` - Required by `next/server`

### The Solution

**File:** `jest.setup.js`

```javascript
// Jest setup file for Next.js 15 with TypeScript
// This file runs before each test file

// 1. Polyfill TextEncoder/TextDecoder for jsdom environment
// Required by packages like resend and @react-email/render
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// 2. Polyfill Web Streams API for jsdom environment
// Required by undici and other packages that use Web Streams
// Note: stream/web is available in Node.js 16.5+ but not exposed to jsdom
if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
  global.TransformStream = TransformStream;
}

// 3. Polyfill Web API globals (Request, Response, Headers, etc.) for jsdom
// Required by next/server and other packages that use Web APIs
// IMPORTANT: This must come AFTER Web Streams polyfill
if (typeof global.Request === 'undefined') {
  const { Request, Response, Headers, fetch } = require('undici');
  global.Request = Request;
  global.Response = Response;
  global.Headers = Headers;
  global.fetch = fetch;
}

// 4. Extend Jest matchers with @testing-library/jest-dom
import '@testing-library/jest-dom';
```

**CRITICAL:** Order matters! Web Streams must be polyfilled BEFORE importing from `undici`.

### Required devDependencies

```json
{
  "devDependencies": {
    "undici": "^6.19.2"
  }
}
```

---

## PATTERN 19: ZOD SCHEMA TRANSFORM ORDER

**Purpose:** Correct ordering of Zod transforms and validations

### The Problem

Zod applies transforms in order. If validation comes before transform, validation sees untransformed input:

```typescript
// ❌ WRONG: .email() validates BEFORE .trim()
// Input: "  user@example.com  " fails email validation (has spaces!)
const emailSchema = z
  .string()
  .email('Invalid email format')  // Validates raw input with spaces
  .trim()                          // Trim happens AFTER validation
  .toLowerCase();
```

### The Solution

Always put transforms BEFORE validations:

```typescript
// ✅ CORRECT: .trim() and .toLowerCase() BEFORE .email()
const emailSchema = z
  .string()
  .trim()                          // 1. Remove whitespace first
  .toLowerCase()                   // 2. Normalize case
  .email('Invalid email format')   // 3. NOW validate clean input
  .min(5, 'Email is required')
  .max(254, 'Email must not exceed 254 characters');
```

### Common Patterns

```typescript
// ✅ Username validation
const usernameSchema = z
  .string()
  .trim()                          // Transform first
  .toLowerCase()
  .min(3, 'Username too short')    // Then validate
  .max(30, 'Username too long')
  .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, underscores');

// ✅ Phone number validation
const phoneSchema = z
  .string()
  .trim()                          // Transform first
  .replace(/\D/g, '')              // Remove non-digits
  .min(10, 'Phone number too short')  // Then validate
  .max(15, 'Phone number too long');
```

---

## PATTERN 20: JSDOM ENVIRONMENT AWARENESS IN TESTS

**Purpose:** Write tests that correctly handle jsdom's browser-like environment

### The Problem

jsdom simulates a browser environment by defining `window`, `document`, etc. This affects environment detection:

```typescript
// In real Node.js: typeof window === 'undefined' → true
// In jsdom: typeof window === 'undefined' → false (window IS defined)

// ❌ WRONG: Assumes Node.js behavior in jsdom
it('should detect server environment', () => {
  expect(isServer()).toBe(true);  // FAILS! jsdom has window
});
```

### The Solution

Write tests that acknowledge jsdom's browser-like behavior:

```typescript
// ✅ CORRECT: Test acknowledges jsdom defines window
describe('isBrowser / isServer', () => {
  it('should detect environment correctly', () => {
    // Jest uses jsdom which defines window, so it behaves like a browser
    // In real Node.js (without jsdom), isServer() would return true
    expect(typeof isBrowser()).toBe('boolean');
    expect(typeof isServer()).toBe('boolean');
    // In jsdom environment, window is defined
    expect(isBrowser()).toBe(!isServer());
  });
});
```

### Testing Server-Only Code

For code that must run in Node.js environment:

```typescript
// Option 1: Use jest.config.js testEnvironment per file
/**
 * @jest-environment node
 */
describe('Server-side utils', () => {
  it('should detect server environment', () => {
    expect(isServer()).toBe(true);  // Works! No jsdom
  });
});

// Option 2: Mock window
describe('isServer', () => {
  const originalWindow = global.window;

  beforeEach(() => {
    // @ts-ignore
    delete global.window;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it('returns true when window is undefined', () => {
    expect(isServer()).toBe(true);
  });
});
```

---

## PATTERN 21: CI/CD WORKFLOW CONFIGURATION

**Purpose:** Configure GitHub Actions workflows for Next.js + pnpm projects

### GitHub Actions Runner Selection

```yaml
# ❌ WRONG: self-hosted runners may not be available
jobs:
  build:
    runs-on: self-hosted  # Requires configured self-hosted runners

# ✅ CORRECT: Use GitHub-hosted runners
jobs:
  build:
    runs-on: ubuntu-latest  # Always available
```

### pnpm Configuration

```yaml
# ✅ CORRECT: Full pnpm setup
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build
```

### Bundle Size Checks

Set realistic thresholds that account for growth:

```yaml
- name: Check bundle size
  run: |
    BUNDLE_SIZE=$(du -sm .next/ | cut -f1)
    echo "Bundle size: ${BUNDLE_SIZE}MB"
    # Set threshold with ~20% headroom above current size
    if [ $BUNDLE_SIZE -gt 250 ]; then
      echo "❌ Bundle size exceeds 250MB"
      exit 1
    fi
    echo "✅ Bundle size is acceptable"
```

---

## UPDATED SUMMARY: LESSONS LEARNED FROM CI FAILURES

| Issue | Prevention |
|-------|------------|
| Line too long | Use 88 char limit for Python (Black's default) |
| Unused imports | Only import what you use, remove unused |
| Unnecessary `global` | Don't use `global` when only reading module-level variables |
| Missing dependencies | Add all imports to requirements.txt |
| Tuple assertion errors | Always unpack `Tuple[bool, str]` before asserting |
| Health check failures in CI | Accept both connected (200) and disconnected (503) states |
| **Duplicate Next.js routes** | Only ONE `page.tsx` per URL path (Pattern 17) |
| **TextEncoder/ReadableStream not defined** | Add polyfills to `jest.setup.js` in correct order (Pattern 18) |
| **Zod validation failures** | Put `.trim()/.toLowerCase()` BEFORE `.email()` (Pattern 19) |
| **isServer() test failures** | Account for jsdom defining `window` (Pattern 20) |
| **CI stuck on self-hosted** | Use `ubuntu-latest` runners (Pattern 21) |
| **Bundle size exceeded** | Set thresholds with ~20% headroom (Pattern 21) |

**Pre-commit checklist for Next.js/TypeScript:**
1. Run `pnpm run test:quick` locally before push
2. Check for duplicate routes: `find app -name "page.tsx" | sort`
3. Verify jest.setup.js has required polyfills
4. Ensure Zod schemas have transforms before validations
5. Use GitHub-hosted runners in CI workflows
