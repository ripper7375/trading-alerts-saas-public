# dLocal Payment Integration Rules

**Purpose:** Architectural and business rules for dLocal payment integration into Trading Alerts SaaS, enabling subscription payments from emerging markets via local payment methods.

---

## 1. BUSINESS RULES - dLocal vs Stripe

### 1.1 Critical Differences

| Feature               | Stripe                            | dLocal                               |
| --------------------- | --------------------------------- | ------------------------------------ |
| Auto-Renewal          | ✅ Automatic monthly              | ❌ Manual payment required           |
| Free Trial            | ✅ 7-day trial                    | ❌ No trial                          |
| Subscription Plans    | Monthly only                      | 3-day + Monthly                      |
| Discount Codes        | ✅ All plans                      | ❌ Monthly only (NOT 3-day)          |
| Payment Flow          | Card authorization → Subscription | One-time payment → Manual activation |
| Renewal Notifications | Stripe manages                    | **We send** 3 days before expiry     |
| Expiry Handling       | Stripe auto-downgrade             | **We downgrade** to FREE             |

**Rule:** Never apply Stripe's auto-renewal logic to dLocal.

---

### 1.2 Subscription Plans

```typescript
const DLOCAL_PLANS = {
  THREE_DAY: {
    duration: 3,
    price_usd: 1.99,
    code: 'DLOCAL_3DAY',
    discountAllowed: false, // ❌ NO discount codes
    trialPeriod: false,
    autoRenewal: false,
  },
  MONTHLY: {
    duration: 30,
    price_usd: 29.0,
    code: 'DLOCAL_MONTHLY',
    discountAllowed: true, // ✅ Discount codes allowed
    trialPeriod: false,
    autoRenewal: false,
  },
} as const;
```

**Rules:**

- 3-day plan exclusive to dLocal (NOT available with Stripe)
- Monthly dLocal = same price as Stripe ($29)
- All dLocal plans require manual renewal
- Never create Stripe-style subscription objects for dLocal

---

### 1.3 Discount Code Validation

```typescript
function canApplyDiscountCode(
  plan: string,
  provider: 'stripe' | 'dlocal'
): boolean {
  if (provider === 'stripe') return true;
  if (provider === 'dlocal') {
    return plan === 'DLOCAL_MONTHLY'; // Only monthly, NOT 3-day
  }
  return false;
}
```

**UI:** Hide discount input for 3-day plan, show for monthly.

---

### 1.4 Early Renewal & Subscription Stacking

**Monthly Plan (ALLOWED):**

```typescript
async function processEarlyRenewal(userId: string): Promise<Date> {
  const currentSub = await prisma.subscription.findUnique({
    where: { userId },
  });
  let newExpiryDate: Date;

  if (currentSub?.expiresAt && currentSub.expiresAt > new Date()) {
    // Extend from current expiry
    newExpiryDate = new Date(
      currentSub.expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000
    );
  } else {
    // Start from now
    newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  await prisma.subscription.update({
    where: { userId },
    data: {
      expiresAt: newExpiryDate,
      tier: 'PRO',
      status: 'ACTIVE',
      renewalReminderSent: false,
    },
  });

  return newExpiryDate;
}
```

**3-Day Plan (PROHIBITED):**

```typescript
async function canPurchaseThreeDayPlan(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  // Check 1: Already used 3-day plan (lifetime restriction)
  if (user.hasUsedThreeDayPlan) {
    return {
      allowed: false,
      reason: '3-day plan is a one-time offer. Please select monthly plan.',
    };
  }

  // Check 2: Has active subscription (any type)
  if (
    user.subscription?.expiresAt &&
    user.subscription.expiresAt > new Date()
  ) {
    return {
      allowed: false,
      reason:
        'Cannot purchase 3-day plan with active subscription. Use monthly to extend.',
    };
  }

  return { allowed: true };
}
```

---

### 1.5 Subscription Cancellation

**Stripe:** Cancellation allowed (stops auto-renewal)

**dLocal:** NO cancellation feature needed

- No auto-renewal to cancel
- User paid for fixed period (3 or 30 days)
- Subscription naturally expires
- UI shows "Renew" button (not "Cancel")

---

### 1.6 Currency Settlement

**Rule:** You receive USD only, regardless of user's payment currency.

**dLocal FX@Transfer Model:**

- Users pay in local currency (INR, PKR, NGN, VND, IDR, THB, ZAR, TRY)
- dLocal converts to USD at their exchange rate
- You receive fixed USD amount
- dLocal absorbs FX risk

**Database Storage:**

```typescript
model Payment {
  amount          Decimal  // e.g., 2407.00 (INR)
  currency        String   // e.g., 'INR'
  amountUSD       Decimal  // e.g., 29.00 (USD) - USE FOR REVENUE
  exchangeRate    Decimal? // e.g., 83.00
}
```

**Accounting:** Revenue calculations use `amountUSD` only.

---

### 1.7 3-Day Plan Anti-Abuse Rules

**SECURITY RISK:** 3-day = $0.663/day vs Monthly (20% off) = $0.773/day
User could abuse 3-day pricing by purchasing repeatedly.

**MANDATORY ANTI-ABUSE RULES:**

#### Rule 1: One-Time Use Per Account (PRIMARY)

```typescript
async function canPurchaseThreeDayPlan(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (user.hasUsedThreeDayPlan) {
    return {
      allowed: false,
      reason: '3-day plan is one-time introductory offer',
    };
  }

  if (
    user.subscription?.expiresAt &&
    user.subscription.expiresAt > new Date()
  ) {
    return {
      allowed: false,
      reason: 'Cannot purchase with active subscription',
    };
  }

  return { allowed: true };
}
```

#### Rule 2: Payment Method Tracking (SECONDARY)

```typescript
model Payment {
  paymentMethodHash  String?  // SHA256(email + payment_method_id)
}

async function detectMultiAccountAbuse(email: string, methodId: string): Promise<boolean> {
  const hash = createHash('sha256').update(`${email}:${methodId}`).digest('hex');
  const existing = await prisma.payment.findFirst({
    where: { planType: 'THREE_DAY', paymentMethodHash: hash }
  });
  return existing !== null;
}
```

#### Rule 3: Monitoring (TERTIARY)

Monitor suspicious patterns:

- Multiple accounts from same IP (threshold: 2 within 30 days)
- Multiple accounts from same device fingerprint
- Fresh account (<1 hour) purchasing 3-day plan

#### Database Schema Additions

```prisma
model User {
  hasUsedThreeDayPlan     Boolean  @default(false)
  threeDayPlanUsedAt      DateTime?
  accountCreatedAt        DateTime @default(now())
  lastLoginIP             String?
  deviceFingerprint       String?
}

model Payment {
  paymentMethodHash       String?
  purchaseIP              String?
  deviceFingerprint       String?
  accountAgeAtPurchase    Int?
}

model FraudAlert {
  id          String   @id @default(cuid())
  userId      String
  pattern     String   // 'MULTIPLE_ACCOUNTS_SAME_IP', etc.
  metadata    Json
  severity    String   // 'LOW' | 'MEDIUM' | 'HIGH'
  status      String   // 'PENDING_REVIEW' | 'CONFIRMED' | 'FALSE_POSITIVE'
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
  @@index([userId, status, createdAt])
}
```

---

## 2. ARCHITECTURE RULES

### 2.1 Unified Checkout Page

**Rule:** Single checkout page (`app/checkout/page.tsx`) for BOTH Stripe and dLocal.

```typescript
export default function CheckoutPage() {
  const [country, setCountry] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'stripe' | 'dlocal' | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'3day' | 'monthly'>('monthly');

  const handlePayment = () => {
    return selectedProvider === 'stripe' ? processStripeCheckout() : processDLocalCheckout();
  };

  return (
    <div>
      <CountrySelector country={country} onChange={setCountry} />
      <PlanSelector provider={selectedProvider} plan={selectedPlan} onChange={setSelectedPlan} />
      <PaymentMethodSelector onSelect={(provider, methodId) => {
        setSelectedProvider(provider);
        setSelectedMethod(methodId);
      }} />
      {canShowDiscountCode(selectedProvider, selectedPlan) && <DiscountCodeInput />}
      <PaymentButton onClick={handlePayment} />
    </div>
  );
}
```

**Rules:**

- ONE checkout page for both providers
- Country detection determines available methods
- Never show 3-day plan when Stripe selected
- Never redirect to separate pages by provider

---

### 2.2 Database Schema

**Rule:** Use existing `subscriptions` table with provider-specific columns.

```prisma
model Subscription {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Provider
  paymentProvider       PaymentProvider  @default(STRIPE)  // 'STRIPE' | 'DLOCAL'

  // Stripe-specific
  stripeSubscriptionId  String?
  stripeCustomerId      String?
  stripePriceId         String?

  // dLocal-specific
  dlocalPaymentId       String?
  dlocalPaymentMethod   String?  // 'UPI', 'PAYTM', 'GOPAY'
  dlocalCountry         String?  // 'IN', 'ID', 'PK'
  dlocalCurrency        String?  // 'INR', 'IDR', 'PKR'

  // Common fields
  status                SubscriptionStatus @default(ACTIVE)
  tier                  UserTier           @default(FREE)
  planType              PlanType           // 'THREE_DAY' | 'MONTHLY'
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  amount                Decimal
  amountUSD             Decimal
  currency              String
  discountCode          String?
  discountPercentage    Int?
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt
  cancelledAt           DateTime?
  expiresAt             DateTime?

  @@index([userId, paymentProvider, status, expiresAt])
}

enum PaymentProvider { STRIPE DLOCAL }
enum SubscriptionStatus { ACTIVE EXPIRED CANCELLED PAYMENT_FAILED PENDING }
enum PlanType { THREE_DAY MONTHLY }
```

---

### 2.3 Payment Transaction Logging

**Rule:** Log ALL payment attempts in separate `payments` table.

```prisma
model Payment {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])
  subscriptionId        String?
  subscription          Subscription? @relation(fields: [subscriptionId], references: [id])

  provider              PaymentProvider
  providerPaymentId     String
  providerStatus        String
  amount                Decimal
  amountUSD             Decimal
  currency              String
  country               String
  paymentMethod         String
  planType              PlanType
  duration              Int      // Days (3 or 30)
  discountCode          String?
  discountAmount        Decimal?
  status                PaymentStatus
  failureReason         String?
  initiatedAt           DateTime   @default(now())
  completedAt           DateTime?
  failedAt              DateTime?
  metadata              Json?

  @@index([userId, provider, providerPaymentId, status])
}

enum PaymentStatus { PENDING COMPLETED FAILED REFUNDED CANCELLED }
```

---

## 3. DATA FLOW ARCHITECTURE

### 3.1 dLocal Payment Flow

| Step                  | Component                                 | Actions                                                                                                                                                                                               |
| --------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Checkout**       | `/checkout`                               | User selects: country → plan (3-day/monthly) → payment method → discount (if monthly) → clicks "Pay"                                                                                                  |
| **2. API Call**       | `POST /api/payments/dlocal/create`        | Body: `{ planType, paymentMethodId, country, currency, amount, amountUSD, discountCode? }`                                                                                                            |
| **3. Validation**     | `app/api/payments/dlocal/create/route.ts` | Verify: auth, discount code (if monthly), country supported, no active subscription, call dLocal service                                                                                              |
| **4. Create Payment** | `lib/payments/dlocal-service.ts`          | Call dLocal API: `POST /payments` → Create Payment record (status: PENDING) → Return: `{ paymentId, redirectUrl }`                                                                                    |
| **5. User Payment**   | dLocal page                               | User redirected to `payment.redirectUrl` → Completes payment (UPI, Paytm, etc.)                                                                                                                       |
| **6. Webhook**        | `POST /api/webhooks/dlocal`               | dLocal fires webhook: `{ id, status: 'PAID', amount, currency }` → Verify signature → Update Payment (COMPLETED) → Create/Update Subscription → Upgrade user: FREE → PRO → Set expiresAt → Send email |
| **7. Redirect**       | `/payment/success`                        | User redirected back → Show success message → PRO access active                                                                                                                                       |

---

### 3.2 Subscription Expiry & Renewal Flow

**Rule:** dLocal has NO auto-renewal. We handle expiry manually.

**Daily Cron: Check Expiring (00:00 UTC)**

```typescript
export async function checkExpiringSubscriptions() {
  const expiringIn3Days = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'DLOCAL',
      status: 'ACTIVE',
      expiresAt: { gte: new Date(), lte: addDays(new Date(), 3) },
      renewalReminderSent: false,
    },
    include: { user: true },
  });

  for (const sub of expiringIn3Days) {
    await sendRenewalReminderEmail({
      to: sub.user.email,
      expiryDate: sub.expiresAt,
      renewalLink: `${process.env.APP_URL}/checkout?renew=${sub.id}`,
    });
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { renewalReminderSent: true },
    });
  }
}
```

**Hourly Cron: Downgrade Expired**

```typescript
export async function downgradeExpiredSubscriptions() {
  const expired = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'DLOCAL',
      status: 'ACTIVE',
      expiresAt: { lte: new Date() },
    },
    include: { user: true },
  });

  for (const sub of expired) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED', tier: 'FREE' },
      }),
      prisma.user.update({
        where: { id: sub.userId },
        data: { tier: 'FREE' },
      }),
    ]);
    await sendSubscriptionExpiredEmail({ to: sub.user.email });
  }
}
```

**Vercel Cron:**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/downgrade-expired-subscriptions",
      "schedule": "0 * * * *"
    }
  ]
}
```

---

## 4. NOTIFICATION SYSTEM

### 4.1 Email Templates

| Trigger                       | Subject                               | Key Content                                                                |
| ----------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| **Payment Confirmed**         | ✅ Payment Successful - PRO Activated | Payment: {amount} {currency}. PRO active until {expiryDate}.               |
| **Renewal Reminder (3 days)** | ⏰ PRO expires in 3 days              | Expires: {expiryDate}. Renew now. Use code RENEW20 for 20% off.            |
| **Renewal Reminder (1 day)**  | 🚨 URGENT: PRO expires tomorrow       | Last chance! Expires tomorrow at {expiryTime}. Don't lose PRO features.    |
| **Subscription Expired**      | 📉 PRO expired - Downgraded to FREE   | PRO expired. Downgraded to FREE tier. Reactivate PRO → /checkout           |
| **Payment Failed**            | ❌ Payment Failed                     | Payment of {amount} {currency} failed. Reason: {failureReason}. Try again. |

**Implementation:**

```typescript
const DLOCAL_EMAIL_TEMPLATES = {
  PAYMENT_CONFIRMED: {
    trigger: 'Webhook: status = PAID',
    subject: '✅ Payment Successful - PRO Activated',
  },
  RENEWAL_REMINDER_3DAYS: {
    trigger: 'Cron: 3 days before',
    subject: '⏰ PRO expires in 3 days',
  },
  RENEWAL_REMINDER_1DAY: {
    trigger: 'Cron: 1 day before',
    subject: '🚨 URGENT: PRO expires tomorrow',
  },
  SUBSCRIPTION_EXPIRED: {
    trigger: 'Cron: expiresAt reached',
    subject: '📉 PRO expired - Downgraded to FREE',
  },
  PAYMENT_FAILED: {
    trigger: 'Webhook: status = FAILED',
    subject: '❌ Payment Failed',
  },
} as const;
```

---

## 5. COUNTRY DETECTION & CURRENCY

### 5.1 Supported Countries

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

**Detection Flow:**

```typescript
export async function detectUserCountry(): Promise<string | null> {
  // 1. Check localStorage
  const saved = localStorage.getItem('user_country');
  if (saved && isDLocalCountry(saved)) return saved;

  // 2. IP geolocation
  const data = await fetch('https://ipapi.co/json/').then((r) => r.json());
  if (isDLocalCountry(data.country_code)) {
    localStorage.setItem('user_country', data.country_code);
    return data.country_code;
  }

  // 3. Browser language
  const langCountry = navigator.language.split('-')[1];
  if (isDLocalCountry(langCountry)) return langCountry;

  return null;
}
```

---

### 5.2 Currency Conversion

**Rule:** All pricing BASE in USD. Convert to local for dLocal display only. Store BOTH amounts.

**Stripe:** USD only, no conversion
**dLocal:** Local currency displayed, USD stored for revenue

```typescript
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
  const rate = await getExchangeRate('USD', targetCurrency);
  const amountLocal = Math.round(amountUSD * rate);
  return {
    amountUSD,
    amountLocal,
    currency: targetCurrency,
    exchangeRate: rate,
  };
}
```

**UI Display:**

```tsx
// STRIPE: USD only
{
  provider === 'stripe' && <div className="price-usd">$29.00/month</div>;
}

// DLOCAL: Local + USD reference
{
  provider === 'dlocal' && (
    <div>
      <div className="local-price">₹2,407/month</div>
      <div className="usd-equivalent">Approximately $29 USD</div>
    </div>
  );
}
```

---

## 6. ERROR HANDLING & EDGE CASES

### 6.1 Graceful Degradation

**Rule:** If dLocal API fails, fall back to Stripe. Never block checkout.

```typescript
export async function getPaymentMethodsForCountry(country: string) {
  const methods: PaymentMethod[] = [];

  try {
    if (isDLocalCountry(country)) {
      const dlocalMethods = await fetchDLocalMethods(country);
      if (dlocalMethods.length > 0) methods.push(...dlocalMethods);
    }
  } catch (error) {
    console.error('dLocal API failed, falling back to Stripe:', error);
  }

  // ALWAYS add Stripe as fallback
  methods.push({
    id: 'card',
    name: 'Credit/Debit Card',
    provider: 'stripe',
    recommended: !isDLocalCountry(country),
  });

  return methods;
}
```

---

### 6.2 Webhook Signature Verification

**Rule:** ALWAYS verify dLocal webhook signatures. Reject unsigned requests.

```typescript
import crypto from 'crypto';

function verifyDLocalSignature(body: any, signature: string | null): boolean {
  if (!signature) return false;

  const payload = JSON.stringify(body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.DLOCAL_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-signature');
  const body = await request.json();

  if (!verifyDLocalSignature(body, signature)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process webhook...
}
```

---

### 6.3 Duplicate Payment Prevention

**Rule:** Use idempotency keys.

```typescript
export async function createDLocalPayment(data: PaymentData) {
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${data.userId}-${data.planType}-${Date.now()}`)
    .digest('hex');

  const existing = await prisma.payment.findFirst({
    where: {
      userId: data.userId,
      metadata: { path: ['idempotencyKey'], equals: idempotencyKey },
      status: { in: ['PENDING', 'COMPLETED'] },
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 min
    },
  });

  if (existing) {
    console.log('Duplicate payment prevented:', idempotencyKey);
    return existing;
  }

  return await prisma.payment.create({
    data: { ...data, metadata: { idempotencyKey } },
  });
}
```

---

## 7. TESTING & ENVIRONMENT

### 7.1 Mock Data for Development

**Rule:** Use mock data for dLocal in dev/test. Never call real API.

```typescript
export const MOCK_DLOCAL_PAYMENT_METHODS = {
  IN: [
    { id: 'UP', name: 'UPI', type: 'BANK_TRANSFER', recommended: true },
    { id: 'PT', name: 'Paytm', type: 'WALLET', popular: true },
    { id: 'PP', name: 'PhonePe', type: 'WALLET' },
    { id: 'NB', name: 'Net Banking', type: 'BANK_TRANSFER' },
  ],
  PK: [
    { id: 'JC', name: 'JazzCash', type: 'WALLET', recommended: true },
    { id: 'EP', name: 'Easypaisa', type: 'WALLET', popular: true },
  ],
} as const;

export function getDLocalMethods(country: string) {
  return process.env.NODE_ENV === 'development'
    ? MOCK_DLOCAL_PAYMENT_METHODS[country] || []
    : fetchRealDLocalMethods(country);
}
```

---

### 7.2 Required Environment Variables

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

## 8. SECURITY RULES

### 8.1 Never Expose Secrets to Frontend

```typescript
// ❌ BAD - Exposes secret
export default function CheckoutPage() {
  const apiKey = process.env.DLOCAL_API_KEY; // DON'T!
  return <PaymentForm apiKey={apiKey} />;
}

// ✅ GOOD - Secrets stay server-side
export default function CheckoutPage() {
  const [selectedMethod, setSelectedMethod] = useState('UP');

  const handlePayment = async () => {
    await fetch('/api/payments/dlocal/create', {
      method: 'POST',
      body: JSON.stringify({ paymentMethodId: selectedMethod })
    });
  };
}
```

---

## 9. DISCOUNT CODE VALIDATION

```typescript
interface DiscountValidationResult {
  valid: boolean;
  reason?: string;
  discountPercentage?: number;
}

export async function validateDiscountCode(
  code: string,
  planType: PlanType,
  provider: PaymentProvider
): Promise<DiscountValidationResult> {
  // 1. Check if discount allowed for plan
  if (provider === 'DLOCAL' && planType === 'THREE_DAY') {
    return {
      valid: false,
      reason: 'Discount codes not available for 3-day plans',
    };
  }

  // 2. Look up code
  const discount = await prisma.discountCode.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!discount) return { valid: false, reason: 'Invalid discount code' };
  if (!discount.isActive)
    return { valid: false, reason: 'Code no longer active' };
  if (discount.expiresAt && discount.expiresAt < new Date()) {
    return { valid: false, reason: 'Code expired' };
  }
  if (discount.maxUses && discount.currentUses >= discount.maxUses) {
    return { valid: false, reason: 'Code reached usage limit' };
  }

  return { valid: true, discountPercentage: discount.percentage };
}
```

**UI:**

```tsx
export function DiscountCodeInput({ planType, paymentProvider }: Props) {
  // Hide for 3-day dLocal plans
  if (paymentProvider === 'DLOCAL' && planType === 'THREE_DAY') return null;

  const [code, setCode] = useState('');
  const [validation, setValidation] = useState<DiscountValidationResult | null>(
    null
  );

  const handleApply = async () => {
    const result = await validateDiscountCode(code, planType, paymentProvider);
    setValidation(result);
  };

  return (
    <div>
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
        <p className="success">{validation.discountPercentage}% off!</p>
      )}
    </div>
  );
}
```

---

## 10. AIDER ESCALATION TRIGGERS

**Rule:** Escalate these dLocal-specific scenarios to human.

| Trigger                            | Escalate | Reason                                          | Action                                                          |
| ---------------------------------- | -------- | ----------------------------------------------- | --------------------------------------------------------------- |
| **Payment Method Unavailable**     | Yes      | dLocal returns no methods for supported country | May indicate API issue. Disable dLocal for country temporarily? |
| **Exchange Rate Spike**            | Yes      | Rate changed >10% from last fetch               | Large price changes confuse users. Accept new rate or cache?    |
| **Webhook Signature Failures**     | Yes      | 5+ failures in 1 hour                           | Security issue or API change. Investigate webhook secret?       |
| **Payment Without Subscription**   | Yes      | Payment PAID but subscription not created       | User paid but no PRO access. Manual activation or refund?       |
| **Duplicate Active Subscriptions** | Yes      | User has >1 active subscription                 | Data integrity issue. Which to keep active?                     |

---

## 11. SUMMARY: DO's and DON'Ts

### ✅ DO:

- Use existing `subscriptions` table with provider columns
- Send renewal reminders 3 days before expiry (dLocal only)
- Manually downgrade dLocal to FREE on expiry
- Allow discount codes on dLocal MONTHLY only
- Hide discount input for 3-day plans
- Store BOTH local currency and USD amounts
- Verify webhook signatures before processing
- Fall back to Stripe if dLocal fails
- Use mock data for dev/test
- Apply all notification rules to dLocal users
- Log all payment attempts
- Use idempotency keys
- Keep API secrets server-side only
- Enforce 3-day plan one-time use per account
- Track payment methods for anti-abuse
- Validate country before processing

### ❌ DON'T:

- Create separate tables for dLocal subscriptions
- Apply Stripe auto-renewal logic to dLocal
- Offer free trial for dLocal
- Show 3-day plan when Stripe selected
- Allow discount codes on 3-day plans
- Expose dLocal API keys to frontend
- Process webhooks without signature verification
- Call real dLocal API in development
- Block checkout if country detection fails
- Create dLocal payments for unsupported countries
- Forget to update user.tier when subscription changes
- Hardcode exchange rates
- Allow 3-day plan purchase with active subscription
- Mix Stripe and dLocal subscription logic

---

**This document ensures dLocal integration is implemented correctly while maintaining full compliance with existing Stripe infrastructure and project architecture rules.**
