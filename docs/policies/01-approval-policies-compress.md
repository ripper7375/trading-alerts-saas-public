# Approval Policies for Aider with MiniMax M2

This document defines when Aider should **auto-approve**, **auto-fix**, or **escalate** during autonomous development.

---

## 1. AUTO-APPROVE CONDITIONS

Aider auto-commits when ALL conditions met:

### 1.1 Code Quality Requirements

✅ **TypeScript Types:**

- All functions have explicit return types
- All parameters have type annotations
- No `any` types (except justified with JSDoc)
- Interfaces/types defined for complex objects

```typescript
// Good
function createAlert(
  userId: string,
  symbol: string,
  timeframe: string
): Promise<Alert> {}

// Bad
function createAlert(userId, symbol, timeframe) {} // ❌ No types
```

✅ **Error Handling:**

- All API routes wrapped in try/catch
- All Prisma queries wrapped in try/catch
- All external API calls (MT5, Stripe) wrapped in try/catch
- User-friendly error messages (no raw error objects)
- Errors logged with context

```typescript
// Good
export async function GET(req: Request) {
  try {
    const data = await prisma.alert.findMany();
    return Response.json(data);
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    return Response.json(
      { error: 'Failed to fetch alerts. Please try again.' },
      { status: 500 }
    );
  }
}
```

✅ **JSDoc Comments:**

- All public functions have JSDoc
- JSDoc includes: description, @param, @returns
- Complex logic has inline comments explaining "why"

```typescript
/**
 * Creates a new alert for a user with tier validation
 * @param userId - User's unique identifier
 * @param symbol - Trading symbol (e.g., "EURUSD")
 * @param timeframe - Chart timeframe (e.g., "H1")
 * @returns Promise resolving to created alert
 * @throws ForbiddenError if user's tier cannot access symbol/timeframe
 */
async function createAlert(
  userId: string,
  symbol: string,
  timeframe: string
): Promise<Alert> {}
```

### 1.2 Security Requirements

✅ **No Secrets in Code:**

- No API keys, passwords, tokens in code
- All secrets in .env files (gitignored)
- .env.example with placeholder values

```typescript
const apiKey = process.env.MT5_API_KEY; // ✅
const apiKey = 'sk_live_abc123'; // ❌
```

✅ **Input Validation:**

- All user inputs validated with Zod schemas
- SQL injection prevented
- XSS prevention

```typescript
const createAlertSchema = z.object({
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']),
  condition: z.string().min(1).max(500),
});

const validated = createAlertSchema.parse(body); // ✅
```

✅ **Tier Validation:**

- All symbol/timeframe endpoints validate tier access
- FREE users cannot access PRO-only symbols/timeframes
- Validation on BOTH Next.js and Flask MT5 service

```typescript
import { validateChartAccess } from '@/lib/tier/validation';

validateChartAccess(userTier, params.symbol, params.timeframe); // ✅
```

### 1.3 API Contract Compliance

✅ **Matches OpenAPI Specification:**

- Response structure matches YAML spec exactly
- All required fields present
- Correct HTTP status codes (200, 400, 401, 403, 404, 500)
- Response types match auto-generated types in lib/api-client/

### 1.4 Architecture Compliance

✅ **Files in Correct Locations:**

- Files placed per v5-structure-division.md
- API routes in `app/api/`
- Components in `components/`
- Business logic in `lib/`
- Database utilities in `lib/db/`
- Tier logic in `lib/tier/`

### 1.5 Automated Validation Results

✅ **Validation Thresholds:**

- **0 Critical issues** (security, contract violations)
- **≤2 High issues** (missing error handling, wrong types, tier validation missing)
- Medium/Low issues acceptable (will be auto-fixed if possible)

**Severity Levels:**

- **Critical:** Security vulnerabilities, API contract violations, exposed secrets
- **High:** Missing error handling, incorrect types, missing tier validation
- **Medium:** Missing JSDoc, suboptimal patterns
- **Low:** Formatting, style preferences

### 1.6 Complete AUTO-APPROVE Checklist

- [ ] All functions have TypeScript types
- [ ] All API routes have try/catch error handling
- [ ] All public functions have JSDoc comments
- [ ] No secrets hardcoded
- [ ] All inputs validated with Zod
- [ ] Tier validation present on protected endpoints
- [ ] Response matches OpenAPI schema exactly
- [ ] File in correct location per v5-structure-division.md
- [ ] Automated validation: 0 Critical, ≤2 High issues
- [ ] All High issues are auto-fixable

**If ALL conditions met → AUTO-APPROVE → COMMIT**

---

## 2. AUTO-FIX CONDITIONS

Aider auto-fixes (max 3 attempts) when issues are **fixable**:

### 2.1 Fixable Issues

✅ **Missing TypeScript Types:** Add return types, parameter types, interfaces

✅ **Missing Error Handling:** Wrap in try/catch, add error logging

✅ **Missing JSDoc:** Add documentation with @param, @returns

✅ **ESLint/Prettier Errors:** Run `pnpm lint --fix`, `pnpm format`

### 2.2 Auto-Fix Process

```
1. Generate code
2. Run Automated validation
3. If fixable issues found (and <3 retry attempts):
   a. Apply auto-fix
   b. Re-run validation
   c. If passes → AUTO-APPROVE → COMMIT
   d. If still issues → Retry (up to 3 total)
4. If 3 attempts exhausted → ESCALATE
```

### 2.3 Maximum Retry Attempts

**Limit:** 3 retry attempts per file

**After 3 failed attempts → ESCALATE**

---

## 3. ESCALATE CONDITIONS

Aider **STOPS and notifies you** when encountering:

### 3.1 Critical Security Vulnerabilities

**Escalate immediately:**

- SQL injection vulnerabilities
- XSS vulnerabilities
- Authentication bypass attempts
- Exposed secrets/API keys
- Missing authentication on protected routes
- Tier validation bypasses

### 3.2 API Contract Violations (Can't Auto-Fix)

**Escalate when:**

- OpenAPI spec requires field missing in database schema
- Response doesn't match spec after 3 fix attempts
- Type mismatches requiring migration

### 3.3 Policy Conflicts or Gaps

**Escalate when:**

- Two policies contradict
- Scenario not covered by any policy
- Unclear requirements in specs
- Multiple valid approaches, unsure which to choose

### 3.4 Architectural Design Decisions

**Escalate when:**

- Multiple valid architectural approaches exist
- Need pattern choice (server vs client component)
- New folder structure needed not in v5-structure-division.md
- Introducing new abstraction layers

### 3.5 New Dependency Additions

**Escalate when:**

- New npm/pip package needed
- Dependency adds significant bundle size
- Alternative dependencies with trade-offs

### 3.6 Database Schema Changes

**Escalate when:**

- New table/model needed
- Adding/removing fields from existing models
- Changing field types (data migration required)
- Adding/removing relations

### 3.7 Breaking Changes to Existing APIs

**Escalate when:**

- Changing API response structure that breaks frontend
- Removing API endpoints
- Changing required fields
- Modifying authentication requirements

### 3.8 Automated Validation Failures

**Escalate when:**

- > 3 High severity issues after auto-fix
- Any Critical issues
- 3 retry attempts exhausted
- Unclear how to fix validation errors

### 3.9 Unclear Requirements

**Escalate when:**

- Specs ambiguous or contradictory
- Missing information for implementation
- Conflicting requirements from different docs
- Edge cases not covered

### 3.10 Test Failures

**Escalate when:**

- TypeScript compilation errors
- Jest tests fail
- Build failures (pnpm build)
- Integration test failures

---

## 4. ESCALATION MESSAGE FORMAT

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  ESCALATION REQUIRED ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue Type: [Category from 3.1-3.10]
File: [filename with path]
Feature: [what you're building]
Severity: [Critical/High/Medium/Low]

Problem:
[Clear explanation in 2-3 sentences]

Policy Violation/Gap:
[Which policy is unclear or violated]

Context:
[Code snippet, error message, or spec excerpt]

Suggested Solutions:
1. [Option 1 with pros/cons]
2. [Option 2 with pros/cons]
3. [Option 3 with pros/cons]

Recommendation:
[Best judgment with reasoning]

Awaiting human decision...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 5. SUMMARY DECISION TREE

```
Generate code
     ↓
Run automated validation (npm run validate)
     ↓
╔════════════════════════════════════════════╗
║ Check ALL approval conditions (Section 1)   ║
╚════════════════════════════════════════════╝
     ↓
     ├─ All conditions met?
     │  └─ YES → AUTO-APPROVE → COMMIT ✅
     │
     ├─ Fixable issues? (Section 2)
     │  └─ YES → AUTO-FIX → Re-validate
     │           ↓
     │           ├─ Fixed? → AUTO-APPROVE → COMMIT ✅
     │           └─ Not fixed after 3 tries? → ESCALATE ⚠️
     │
     └─ Critical issue or unclear? (Section 3)
        └─ YES → ESCALATE ⚠️
```

---

## 6. APPROVAL CONDITIONS QUICK REFERENCE

| Condition               | Check                           | Severity if Missing |
| ----------------------- | ------------------------------- | ------------------- |
| TypeScript types        | All functions typed             | High                |
| Error handling          | try/catch on all API routes     | High                |
| JSDoc comments          | All public functions            | Medium              |
| No secrets              | No hardcoded keys               | Critical            |
| Input validation        | Zod validation on all inputs    | High                |
| Tier validation         | Symbol/timeframe access checked | Critical            |
| OpenAPI compliance      | Response matches spec           | Critical            |
| Architecture compliance | File in correct location        | Medium              |
| Automated validation    | 0 Critical, ≤2 High             | -                   |

**If ANY Critical → ESCALATE**
**If >2 High → ESCALATE**
**Otherwise → AUTO-FIX or AUTO-APPROVE**

---

## 7. AFFILIATE MARKETING SPECIFIC POLICIES

Applies to Part 17 (Affiliate Marketing Platform) - 67 files

### 7.1 Affiliate Authentication

✅ **Separate JWT Secret:**

- MUST use `AFFILIATE_JWT_SECRET` (NOT user JWT secret)
- Token payload MUST include `type: 'AFFILIATE'` discriminator
- Token validation MUST check type field

```typescript
// Good
export function generateAffiliateToken(affiliate: Affiliate): string {
  return jwt.sign(
    {
      id: affiliate.id,
      email: affiliate.email,
      type: 'AFFILIATE',
      status: affiliate.status,
    },
    process.env.AFFILIATE_JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

export function validateAffiliateToken(token: string) {
  const decoded = jwt.verify(token, process.env.AFFILIATE_JWT_SECRET!);
  if (decoded.type !== 'AFFILIATE') throw new Error('Invalid token type');
  return decoded;
}

// Bad
const token = jwt.sign(affiliate, process.env.JWT_SECRET); // ❌ Same secret
const token = jwt.sign({ id: affiliate.id }, process.env.JWT_SECRET); // ❌ No discriminator
```

### 7.2 Affiliate Code Generation

✅ **Cryptographically Secure:**

- MUST use `crypto.randomBytes(16).toString('hex')`
- Code length MUST be ≥12 characters
- MUST check uniqueness before saving
- NEVER predictable patterns (sequential, affiliate name, etc.)

```typescript
// Good
import crypto from 'crypto';

function generateAffiliateCode(affiliateName: string): string {
  const random = crypto.randomBytes(16).toString('hex');
  const prefix = affiliateName
    .slice(0, 4)
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return `${prefix}-${random.slice(0, 12)}`;
}

async function createUniqueCode(affiliateName: string): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateAffiliateCode(affiliateName);
    const existing = await prisma.affiliateCode.findUnique({ where: { code } });
    if (!existing) return code;
    attempts++;
  }
  throw new Error('Failed to generate unique code after 10 attempts');
}

// Bad
return `${affiliate.name}-${affiliate.id}`; // ❌ Predictable
return `CODE-${codeCounter++}`; // ❌ Sequential
return Math.random().toString(36).substring(7); // ❌ NOT cryptographically secure
```

### 7.3 Commission Calculation

✅ **Commission Requirements:**

- MUST create commissions ONLY via Stripe webhook (not manual)
- MUST validate affiliate code before creating commission
- MUST use formula: `netRevenue × (commissionPercent / 100)`
- MUST store all intermediate values (regularPrice, discountAmount, netRevenue)
- MUST set status to 'PENDING' initially (NOT 'PAID')

```typescript
// Good - In Stripe webhook handler
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const affiliateCodeValue = session.metadata?.affiliateCode;

  if (affiliateCodeValue) {
    const code = await prisma.affiliateCode.findUnique({
      where: { code: affiliateCodeValue },
    });

    if (!code || code.status !== 'ACTIVE') {
      console.error('Invalid affiliate code:', affiliateCodeValue);
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const regularPrice = parseFloat(session.metadata.regularPrice);
    const discountPercent = code.discountPercent;
    const commissionPercent = code.commissionPercent;
    const discountAmount = regularPrice * (discountPercent / 100);
    const netRevenue = regularPrice - discountAmount;
    const commissionAmount = netRevenue * (commissionPercent / 100);

    await prisma.commission.create({
      data: {
        affiliateId: code.affiliateId,
        affiliateCodeId: code.id,
        userId: session.metadata.userId,
        subscriptionId: session.subscription,
        regularPrice,
        discountAmount,
        netRevenue,
        commissionPercent,
        commissionAmount,
        status: 'PENDING',
      },
    });
  }
}

// Bad
const commission = regularPrice * 0.3; // ❌ Should be netRevenue × 0.30
status: 'PAID'; // ❌ Should start PENDING
```

### 7.4 Payment Method Validation

✅ **Required field combinations:**

```typescript
// BANK_TRANSFER requires:
- bankName (string, min 1)
- bankAccountNumber (string, min 5)
- bankAccountHolderName (string, min 1)

// CRYPTO requires:
- cryptoWalletAddress (string, min 20, max 100)
- preferredCryptocurrency (enum: BTC, ETH, USDT)

// GLOBAL_WALLET requires:
- globalWalletType (enum: PayPal, Payoneer, Wise)
- globalWalletIdentifier (string, email format)

// LOCAL_WALLET requires:
- localWalletType (enum: GCash, Maya, TrueMoney)
- localWalletIdentifier (string, min 10)
```

### 7.5 Accounting-Style Reports

✅ **Report Structure:**

- MUST follow format: Opening Balance → Activity → Closing Balance
- MUST match opening balance = previous closing balance
- MUST include drill-down capability
- MUST aggregate correctly

```typescript
// Validate accounting balance
const calculated = openingBalance + earned - paid;
if (Math.abs(calculated - closingBalance) > 0.01) {
  throw new Error('Accounting mismatch: balance does not reconcile');
}
```

### 7.6 Affiliate-Specific Approval Checklist

- [ ] Affiliate auth uses AFFILIATE_JWT_SECRET
- [ ] Token includes type: 'AFFILIATE' discriminator
- [ ] Code generation uses crypto.randomBytes() (NOT Math.random)
- [ ] Code length ≥12 characters
- [ ] Code uniqueness checked before creation
- [ ] Commissions created ONLY via Stripe webhook
- [ ] Commission calculation uses correct formula
- [ ] All commission intermediate values stored
- [ ] Commission status starts as PENDING
- [ ] Payment method validation matches required fields
- [ ] Accounting reports include opening/closing balances
- [ ] Report balances reconcile (opening + earned - paid = closing)

**If ANY violated → ESCALATE**

### 7.7 Affiliate Quick Reference

| Requirement                       | Check                             | Severity if Violated |
| --------------------------------- | --------------------------------- | -------------------- |
| Separate JWT secret               | Uses AFFILIATE_JWT_SECRET         | Critical             |
| Token type discriminator          | Includes type: 'AFFILIATE'        | Critical             |
| Crypto-secure code generation     | Uses crypto.randomBytes()         | Critical             |
| Commission via webhook only       | Created in Stripe webhook         | Critical             |
| Correct commission formula        | netRevenue × commissionPercent    | High                 |
| Payment method validation         | Required fields present           | High                 |
| Accounting balance reconciliation | opening + earned - paid = closing | High                 |
| Code uniqueness check             | Checks existing before creating   | Medium               |

### 7.8 Dynamic Configuration System

✅ **SystemConfig Usage:**

- Frontend MUST use `useAffiliateConfig()` hook for percentages
- NEVER hardcode discount/commission percentages (20%, 20%, etc.)
- Code generation MUST read from SystemConfig table
- Admin UI MUST use SystemConfig for settings

```typescript
// Good (Frontend)
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export function PricingCard() {
  const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();
  const regularPrice = 29.00;
  const discountedPrice = calculateDiscountedPrice(regularPrice);

  return (
    <div>
      <p>Regular: ${regularPrice}/month</p>
      <p>With code: ${discountedPrice}/month (Save {discountPercent}%!)</p>
    </div>
  );
}

// Good (Backend)
const discountConfig = await prisma.systemConfig.findUnique({
  where: { key: 'affiliate_discount_percent' }
});
const discountPercent = parseFloat(discountConfig?.value || '20.0');

// Bad
const discountPercent = 20.0;  // ❌ Hardcoded
```

**Critical Rules:**

1. ✅ ALWAYS use `useAffiliateConfig()` in frontend
2. ✅ ALWAYS fetch from SystemConfig in backend
3. ✅ NEVER hardcode percentages
4. ✅ Cache config endpoint 5 minutes
5. ✅ Provide fallback values if query fails

---

## 8. DLOCAL PAYMENT INTEGRATION (Part 18)

### 8.1 Payment Provider Validation

✅ **Auto-Approve if:**

- MUST use single `Subscription` model with `paymentProvider` field ("STRIPE" or "DLOCAL")
- MUST make Stripe fields nullable for dLocal subscriptions
- MUST make dLocal fields nullable for Stripe subscriptions
- MUST store BOTH `amount` (local) AND `amountUsd`
- MUST check `paymentProvider` before provider-specific logic

```typescript
// Good - Single model
model Subscription {
  paymentProvider String // "STRIPE" or "DLOCAL"

  // Stripe fields (nullable)
  stripeCustomerId String? @unique
  stripePriceId String?

  // dLocal fields (nullable)
  dLocalPaymentId String? @unique
  dLocalCurrency String?

  // Shared
  planType String
  amountUsd Float
  expiresAt DateTime
}

// Bad - Separate models
model StripeSubscription { }  // ❌
model DLocalSubscription { }  // ❌
```

### 8.2 Currency Conversion

✅ **Auto-Approve if:**

- MUST convert USD → local ONLY for dLocal
- MUST fetch real-time exchange rates (NEVER hardcoded)
- MUST store exchange rate in Payment record
- MUST round to 2 decimal places
- Stripe payments remain in USD

```typescript
// Good
const { amount, rate } = await convertUsdToLocal(29.0, 'INR');
await prisma.payment.create({
  data: {
    amount: 2407.0,
    currency: 'INR',
    amountUsd: 29.0,
    exchangeRate: 83.0,
  },
});

// Bad
const amount = 29.0 * 83; // ❌ Hardcoded rate
```

### 8.3 3-Day Plan Anti-Abuse

✅ **Auto-Approve if:**

- MUST check `hasUsedThreeDayPlan === false` before purchase
- MUST create `FraudAlert` if reuse attempt detected
- MUST block if active subscription exists
- MUST mark `hasUsedThreeDayPlan = true` after payment
- MUST include ipAddress and deviceFingerprint

```typescript
// Good
if (planType === 'THREE_DAY') {
  if (user.hasUsedThreeDayPlan) {
    await prisma.fraudAlert.create({
      data: {
        userId: user.id,
        alertType: '3DAY_PLAN_REUSE',
        severity: 'MEDIUM',
        ipAddress: req.headers.get('x-forwarded-for'),
        deviceFingerprint: req.headers.get('x-device-fingerprint'),
      },
    });
    return NextResponse.json(
      { error: '3-day plan already used' },
      { status: 403 }
    );
  }

  // After payment
  await prisma.user.update({
    where: { id: user.id },
    data: { hasUsedThreeDayPlan: true, threeDayPlanUsedAt: new Date() },
  });
}
```

### 8.4 Early Renewal Logic

✅ **Auto-Approve if:**

- MUST allow ONLY for dLocal monthly subscriptions
- MUST block for dLocal 3-day plans
- MUST block for Stripe (auto-renews)
- MUST calculate: `current expiresAt + 30 days` (stacking)

```typescript
// Good
if (subscription.paymentProvider !== 'DLOCAL') {
  return NextResponse.json(
    { error: 'Stripe subscriptions auto-renew' },
    { status: 400 }
  );
}

if (subscription.planType === 'THREE_DAY') {
  return NextResponse.json(
    { error: 'Cannot renew 3-day plan' },
    { status: 400 }
  );
}

const newExpiresAt = new Date(subscription.expiresAt);
newExpiresAt.setDate(newExpiresAt.getDate() + 30); // Stack days

// Bad
const newExpiresAt = addDays(new Date(), 30); // ❌ Doesn't stack
```

### 8.5 Subscription Expiry Handling

✅ **Auto-Approve if:**

- MUST check expiry ONLY for dLocal (NOT Stripe)
- MUST run via cron daily at midnight UTC
- MUST send reminder 3 days before expiry
- MUST downgrade to FREE when `expiresAt < now`
- MUST mark `renewalReminderSent = true`

```typescript
// Good
const expiringSubscriptions = await prisma.subscription.findMany({
  where: {
    paymentProvider: 'DLOCAL',  // Only dLocal
    status: 'active',
    OR: [
      { expiresAt: { lt: now } },
      { expiresAt: { lt: addDays(now, 3) }, renewalReminderSent: false }
    ]
  }
});

for (const sub of expiringSubscriptions) {
  if (daysUntilExpiry <= 0) {
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' } }),
      prisma.user.update({ where: { id: sub.userId }, data: { tier: 'FREE' } })
    ]);
    await sendEmail(sub.user.email, 'Subscription Expired', {...});
  } else if (daysUntilExpiry <= 3 && !sub.renewalReminderSent) {
    await prisma.subscription.update({ data: { renewalReminderSent: true } });
    await sendEmail(sub.user.email, 'Expiring Soon', {...});
  }
}
```

### 8.6 Fraud Detection Integration

✅ **Auto-Approve if:**

- MUST call fraud detection on ALL payment operations
- MUST create `FraudAlert` for suspicious patterns
- MUST include severity: "LOW", "MEDIUM", "HIGH"
- MUST require admin review before blocking
- MUST keep fraud alerts for audit (NEVER delete)

```typescript
// Good
const fraudAlert = await detectFraud(userId, {
  ipAddress: req.headers.get('x-forwarded-for'),
  deviceFingerprint: req.headers.get('x-device-fingerprint'),
  paymentAmount: amount,
});

if (fraudAlert) {
  await prisma.fraudAlert.create({
    data: {
      userId,
      alertType: fraudAlert.type,
      severity: fraudAlert.severity,
      description: fraudAlert.description,
      ipAddress: fraudAlert.ipAddress,
      deviceFingerprint: fraudAlert.deviceFingerprint,
      additionalData: fraudAlert.context,
    },
  });

  await sendAdminNotification('New Fraud Alert', fraudAlert);
}

// Bad
if (detectedFraud) {
  await prisma.user.update({ data: { isActive: false } }); // ❌ Don't auto-block
}
```

### 8.7 Payment Provider Selection

✅ **Auto-Approve if:**

- MUST show dLocal ONLY for: IN, NG, PK, VN, ID, TH, ZA, TR
- MUST show prices in local currency for dLocal countries
- MUST use correct currency symbols (₹, ₦, ₨, ₫, Rp, ฿, R, ₺)

```typescript
// Good
export const DLOCAL_COUNTRIES = [
  'IN',
  'NG',
  'PK',
  'VN',
  'ID',
  'TH',
  'ZA',
  'TR',
];

export function getAvailableProviders(countryCode: string): PaymentProvider[] {
  if (DLOCAL_COUNTRIES.includes(countryCode)) {
    return ['STRIPE', 'DLOCAL'];
  }
  return ['STRIPE'];
}

// Bad
return ['STRIPE', 'DLOCAL']; // ❌ Missing country check
```

### 8.8 Stripe Trial Abuse Detection

✅ **Auto-Approve if:**

- MUST check fraud BEFORE creating user account
- MUST capture `signupIP` and `deviceFingerprint` at registration
- MUST implement all 4 fraud patterns (IP, device, email, velocity)
- MUST block HIGH severity immediately
- MUST create FraudAlert for all suspicious activity
- MUST allow MEDIUM but flag for admin
- MUST check `hasUsedStripeTrial` before trial
- NO credit card required for trial

```typescript
// Good - Registration with fraud detection
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { email, password, name } = await req.json();

  const signupIP =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.ip || null;
  const deviceFingerprint = req.headers.get('x-device-fingerprint') || null;

  // Check fraud BEFORE creating account
  const fraudCheck = await detectTrialAbuse({
    email,
    signupIP,
    deviceFingerprint,
  });

  if (fraudCheck) {
    await prisma.fraudAlert.create({
      data: {
        userId: null,
        alertType: fraudCheck.type,
        severity: fraudCheck.severity,
        description: fraudCheck.description,
        ipAddress: signupIP,
        deviceFingerprint,
        additionalData: {
          email,
          blockedAtRegistration: fraudCheck.severity === 'HIGH',
        },
      },
    });

    if (fraudCheck.severity === 'HIGH') {
      return NextResponse.json(
        { error: 'Registration blocked' },
        { status: 403 }
      );
    }
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      tier: 'FREE',
      hasUsedStripeTrial: false,
      signupIP,
      lastLoginIP: signupIP,
      deviceFingerprint,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
```

**Fraud Detection - 4 Patterns:**

```typescript
export async function detectTrialAbuse(context: {
  email: string;
  signupIP: string | null;
  deviceFingerprint: string | null;
}): Promise<FraudCheckResult | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Pattern 1: IP abuse (≥3 trials from same IP in 30 days)
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
        description: `IP ${context.signupIP} used for ${recentTrialsFromIP} trials in 30 days`,
      };
    }
  }

  // Pattern 2: Device abuse (≥2 trials from same device in 30 days)
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
        description: `Device used for ${recentTrialsFromDevice} trials in 30 days`,
      };
    }
  }

  // Pattern 3: Disposable email (MEDIUM)
  const emailDomain = context.email.split('@')[1].toLowerCase();
  const disposableDomains = [
    'mailinator.com',
    '10minutemail.com',
    'guerrillamail.com',
  ];

  if (disposableDomains.includes(emailDomain)) {
    return {
      type: 'DISPOSABLE_EMAIL_DETECTED',
      severity: 'MEDIUM',
      description: `Disposable email domain: ${emailDomain}`,
    };
  }

  // Pattern 4: Rapid velocity (≥5 accounts from same IP in 1 hour)
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
        description: `${rapidSignups} accounts from ${context.signupIP} in 1 hour (bot attack)`,
      };
    }
  }

  return null;
}
```

**Trial Start (No Card):**

```typescript
// Good - Trial WITHOUT payment method
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  if (session.user.hasUsedStripeTrial) {
    return NextResponse.json(
      {
        error: 'You have already used your free trial',
        errorCode: 'TRIAL_ALREADY_USED',
      },
      { status: 403 }
    );
  }

  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7);

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
        amountUsd: 0,
      },
    }),
  ]);

  return NextResponse.json({
    message: 'Trial started',
    trialEndsAt: trialEndDate,
    tier: 'PRO',
  });
}
```

**Device Fingerprinting (Client):**

```typescript
// lib/fingerprint.ts
export async function generateDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
  ];

  const fingerprint = components.join('|');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Usage in registration
const fingerprint = await generateDeviceFingerprint();

fetch('/api/auth/register', {
  headers: {
    'Content-Type': 'application/json',
    'X-Device-Fingerprint': fingerprint,
  },
  body: JSON.stringify({ email, password, name }),
});
```

**Trial Expiry Cron (Every 6 Hours):**

```typescript
// app/api/cron/stripe-trial-expiry/route.ts
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expiredTrials = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'STRIPE',
      status: 'trialing',
      expiresAt: { lt: new Date() }
    },
    include: { user: true }
  });

  for (const subscription of expiredTrials) {
    const paidSubscription = await prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        paymentProvider: 'STRIPE',
        status: 'active',
        stripeSubscriptionId: { not: null }
      }
    });

    if (paidSubscription) {
      await prisma.subscription.delete({ where: { id: subscription.id } });
    } else {
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'expired' }
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: { tier: 'FREE' }
        })
      ]);

      await sendEmail(subscription.user.email, 'Trial Expired', {
        message: 'Subscribe now to regain PRO features',
        ctaUrl: 'https://app.com/dashboard/billing'
      });
    }
  }

  return NextResponse.json({ checked: expiredTrials.length });
}

// vercel.json
{
  "crons": [{
    "path": "/api/cron/stripe-trial-expiry",
    "schedule": "0 */6 * * *"
  }]
}
```

🚨 **ESCALATE if:**

- Fraud detection skipped at registration
- Single-signal detection used
- Credit card required for trial
- No FraudAlert for suspicious activity
- User can start trial multiple times
- Trial expiry check missing
- Device fingerprint not captured
- HIGH severity not blocked

### 8.9 Admin Fraud Management

✅ **Auto-Approve if:**

- MUST verify admin role before enforcement (`session.user.role === 'ADMIN'`)
- MUST update FraudAlert.resolution for ALL actions
- MUST log admin identity (reviewedBy + reviewedAt)
- MUST send email for warnings, blocks, unblocks
- MUST require admin notes for audit
- BLOCK_ACCOUNT must downgrade to FREE
- BLOCK_ACCOUNT must cancel subscriptions
- BLOCK_ACCOUNT requires confirmation dialog

```typescript
// Good - Admin enforcement
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, notes, blockDuration } = await req.json();
  const alert = await prisma.fraudAlert.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  switch (action) {
    case 'BLOCK_ACCOUNT':
      await prisma.$transaction([
        prisma.user.update({
          where: { id: alert.userId },
          data: { isActive: false, tier: 'FREE' },
        }),
        prisma.subscription.updateMany({
          where: { userId: alert.userId, status: 'active' },
          data: { status: 'canceled' },
        }),
        prisma.fraudAlert.update({
          where: { id: params.id },
          data: {
            resolution:
              blockDuration === 'PERMANENT'
                ? 'BLOCKED_PERMANENT'
                : 'BLOCKED_TEMPORARY',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            notes: `${blockDuration} block. Reason: ${notes}`,
          },
        }),
      ]);

      await sendEmail(alert.user.email, 'Account Suspended', {
        subject: '🚫 Your account has been suspended',
        html: `<h2>Account Suspended</h2><p>Reason: ${notes}</p><p>Duration: ${blockDuration}</p>`,
      });

      return NextResponse.json({
        success: true,
        message: `Account blocked (${blockDuration})`,
      });

    case 'SEND_WARNING':
      await prisma.fraudAlert.update({
        where: { id: params.id },
        data: {
          resolution: 'WARNING_SENT',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          notes,
        },
      });

      await sendEmail(alert.user.email, 'Security Alert', {
        subject: '⚠️ Suspicious activity detected',
        html: `<p>${alert.description}</p><p>${notes}</p>`,
      });

      return NextResponse.json({ success: true });

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

      return NextResponse.json({ success: true });

    case 'UNBLOCK_ACCOUNT':
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
            notes,
          },
        }),
      ]);

      await sendEmail(alert.user.email, 'Account Restored', {
        subject: '✅ Your account has been restored',
        html: `<p>Your account has been restored. ${notes}</p>`,
      });

      return NextResponse.json({ success: true });
  }
}
```

🚨 **ESCALATE if:**

- Admin role check missing
- Email notification skipped
- Admin notes not required
- FraudAlert.resolution not updated
- Block doesn't downgrade to FREE
- Block doesn't cancel subscriptions
- No confirmation dialog for BLOCK_ACCOUNT
- reviewedBy/reviewedAt not logged

---

## CRITICAL RULES SUMMARY

**dLocal Integration:**

1. Single Subscription model (both providers)
2. Real-time currency conversion (no hardcoded rates)
3. 3-day plan one-time use (with fraud detection)
4. Early renewal with day stacking (dLocal monthly only)
5. Daily expiry check (dLocal only, via cron)
6. Fraud detection on all payment operations
7. Country-based provider selection (8 dLocal countries)
8. Store both local currency and USD

**Stripe Trial Anti-Abuse:** 9. NO card required for trial (conversion ~40-60%) 10. Multi-signal fraud detection (IP, device, email, velocity) 11. Check fraud BEFORE creating account 12. Block HIGH severity, flag MEDIUM 13. Trial expiry check every 6 hours (cron) 14. One trial per user (hasUsedStripeTrial) 15. Capture signupIP + deviceFingerprint 16. Create FraudAlert for all suspicious activity

**Admin Fraud Management:** 17. Verify admin role before actions 18. Block = downgrade FREE + cancel + email 19. Require admin notes (audit trail) 20. Send email for warnings/blocks/unblocks 21. Confirmation dialog for BLOCK_ACCOUNT 22. Log reviewedBy + reviewedAt

**If ANY Critical violated → ESCALATE immediately**

---

**End of Approval Policies**
