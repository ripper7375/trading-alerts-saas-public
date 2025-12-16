# Subscription Model Clarification

**Project:** Trading Alerts SaaS V7
**Created:** 2025-11-16
**Purpose:** Clarify auto-renewal subscription model with optional affiliate codes

---

## 📋 TABLE OF CONTENTS

1. [Subscription Model Overview](#subscription-model-overview)
2. [Monthly-Only Subscription](#monthly-only-subscription)
3. [Auto-Renewal with Optional Codes](#auto-renewal-with-optional-codes)
4. [Code Input for Next Billing Cycle](#code-input-for-next-billing-cycle)
5. [Reminder System](#reminder-system)
6. [User Journeys](#user-journeys)
7. [Technical Implementation](#technical-implementation)

---

## 🎯 Subscription Model Overview

### Confirmed Model: **Option A - Auto-Renewal with Optional Codes**

**Key Principles:**

- ✅ Subscriptions **AUTO-RENEW** monthly (standard SaaS behavior)
- ✅ Users **STAY SUBSCRIBED** even without codes
- ✅ Affiliate codes are **OPTIONAL** for users
- ✅ Users can enter code for **NEXT billing cycle** via input box
- ✅ Reminder system prompts users to enter codes
- ✅ **MONTHLY ONLY** - No annual subscriptions during early stage

**Business Rationale:**

- Standard SaaS practice (like Netflix, Spotify, etc.)
- Lower churn - users don't lose access
- Users incentivized to find codes to save money
- Affiliates compete for users' attention monthly
- Flexible for ongoing development and feature changes

---

## 📅 Monthly-Only Subscription

### Decision: Skip Annual Subscriptions for Early Stage

**Why Monthly-Only:**

1. **Avoid High Commitment**
   - Annual subscriptions lock users for 12 months
   - Harder to make significant changes or pivots
   - Users hesitant to commit long-term to new SaaS

2. **Development Flexibility**
   - Still developing features and functionalities
   - May need to adjust pricing or features
   - Easier to iterate with monthly subscriptions

3. **Early Stage Strategy**
   - Build trust with monthly subscriptions first
   - Add annual option later (with discount) when product mature
   - Lower barrier to entry for new users

**Pricing Structure:**

```
PRO Plan (Monthly Only):
- Trial Period: 7-day free trial (no credit card required)
- Regular Price: $29.00/month (after trial ends)
- With Affiliate Code: $23.20/month (20% discount)
- Auto-renews monthly
- Cancel anytime

Trial Details:
- 7-day free trial with full PRO access
- No credit card required during trial
- After 7 days: Auto-converts to $29/month (if payment method added)
- Or downgrade to FREE tier (if no payment method)
- One trial per user (lifetime)

❌ NO Annual Plan Yet:
- Will be introduced in later phase
- After product is stable and mature
- Likely at ~$290/year (save ~17%)
```

**When to Add Annual:**

- After 6-12 months of operation
- When feature set is stable
- When user retention is proven
- When you want to offer bulk discount (e.g., 2 months free)

---

## 🎁 7-Day Free Trial (PRO Tier)

### Trial Activation and Flow

**Day 0 (Trial Starts):**

```
User clicks "Start 7-Day Trial" on pricing page
User account created (no credit card required)
User tier: FREE (actual tier)
Trial status: ACTIVE
Effective tier: PRO (trial gives PRO access)
User gets full PRO features immediately:
  ✅ 15 symbols
  ✅ 9 timeframes
  ✅ 20 alerts
  ✅ 50 watchlist items
```

**Day 5 (Reminder):**

```
Email sent: "2 days left in your trial. Add payment to continue PRO access."
Dashboard banner: "⏰ Your trial ends in 2 days. Add payment to keep PRO features."
User can:
  - Add payment method → Trial converts to paid after 7 days
  - Do nothing → Trial expires, downgrade to FREE tier
  - Cancel trial → Immediate downgrade to FREE tier
```

**Day 7 (Trial Ends):**

**Scenario A: User Added Payment During Trial**

```
Trial status: CONVERTED
User tier: PRO
Subscription status: ACTIVE (auto-renews)
First charge: $29.00/month (or $23.20 if affiliate code used)
User keeps all PRO features
```

**Scenario B: User Did NOT Add Payment**

```
Trial status: EXPIRED
User tier: FREE (downgraded)
Subscription status: INACTIVE
No charge
User loses PRO features:
  ❌ Only 5 symbols now
  ❌ Only 3 timeframes now
  ❌ Only 5 alerts now
Can upgrade to PRO anytime (no second trial)
```

**Trial Business Rules:**

- ✅ One free trial per user (lifetime)
- ✅ Tracked via `hasUsedFreeTrial` field
- ✅ Cannot restart trial after cancellation
- ✅ Cannot get trial if already on PRO tier
- ✅ Trial is provider-agnostic (works with Stripe, dLocal, etc.)

---

## 🔄 Auto-Renewal with Optional Codes

### How It Works

**Month 1 (Initial Signup - After Trial or Direct):**

```
OPTION A: User finished 7-day trial, added payment
Trial converted to paid subscription
Subscription status: ACTIVE (auto-renews)
First charge: $29.00 (or $23.20 if affiliate code used during trial)

OPTION B: User skipped trial, went straight to paid
User enters affiliate code: "SMITH-ABC123"
User pays: $23.20 (20% discount)
Subscription status: ACTIVE (auto-renews)
Affiliate earns: $4.64 commission
```

**Month 2 (First Renewal - No Code Entered):**

```
7 days before renewal: Email reminder sent
"Your PRO subscription renews on Dec 5 for $29.00"
"Want to save 20%? Enter an affiliate code in your billing settings!"

User doesn't enter code
Renewal date arrives
Stripe auto-charges: $29.00 (full price)
Subscription continues
No affiliate earns commission
```

**Month 3 (Renewal - User Enters Code):**

```
10 days before renewal: User sees in-app notification
"💡 Renewal coming! Enter code to save 20%"

User clicks notification → Goes to billing page
User enters new code: "JONES-XYZ789" in input box
User clicks "Apply to Next Billing"
System saves code for next renewal

Renewal date arrives
Stripe auto-charges: $23.20 (20% discount)
Affiliate JONES earns: $4.64 commission
Subscription continues
```

**Month 4 (Renewal - Code Expires):**

```
Code "JONES-XYZ789" was one-time use (already USED)
Code expired at end of previous month
No valid code for this renewal

Renewal date arrives
Stripe auto-charges: $29.00 (full price)
Subscription continues
No affiliate earns commission

User receives email: "You paid $29.00. Want to save next month? Find a new code!"
```

### Key Points:

✅ **User never loses access** (even without codes)
✅ **User can skip finding codes** (pays full price)
✅ **User incentivized to find codes** (saves money)
✅ **Affiliates compete monthly** (post new codes on social media)
✅ **Codes are one-time use** (user needs new code each month)
✅ **Codes expire monthly** (old codes don't work)

---

## 💳 Code Input for Next Billing Cycle

### UI Component: Code Input Box

**Location:** User Billing Dashboard (`/dashboard/billing`)

**Visual Design:**

```
┌─────────────────────────────────────────────────────────────┐
│  💳 Your Subscription                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PRO Plan - Monthly                                         │
│  Status: Active                                             │
│                                                              │
│  Next Billing Date: December 5, 2025                        │
│  Next Billing Amount: $29.00                                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 💡 Save 20% on Your Next Payment                       │ │
│  │                                                         │ │
│  │ Enter an affiliate code to get 20% off your next       │ │
│  │ billing cycle:                                          │ │
│  │                                                         │ │
│  │ [_______________________]  [ Apply Code ]              │ │
│  │  Enter code (e.g., SMITH-ABC123)                       │ │
│  │                                                         │ │
│  │ ✅ Code will be applied on your next billing date      │ │
│  │ ✅ One-time use - find new codes monthly               │ │
│  │ ✅ Follow affiliates on social media for codes         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Current Applied Code: None                                 │
│  (No code applied for next billing cycle)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**After User Enters Code:**

```
┌─────────────────────────────────────────────────────────────┐
│  💳 Your Subscription                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PRO Plan - Monthly                                         │
│  Status: Active                                             │
│                                                              │
│  Next Billing Date: December 5, 2025                        │
│  Next Billing Amount: $23.20 (20% off!) 🎉                 │
│  ↑ Was: $29.00 | You save: $5.80                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ✅ Code Applied Successfully!                           │ │
│  │                                                         │ │
│  │ Code: JONES-XYZ789                                      │ │
│  │ Affiliate: John Jones                                   │ │
│  │ Discount: 20% ($5.80 off)                               │ │
│  │ Valid for: Next billing cycle only                      │ │
│  │                                                         │ │
│  │ [ Remove Code ]                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  💡 Need a code for the month after? Follow affiliates on   │
│     social media for new codes!                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Code Validation Flow

**When user enters code:**

```typescript
// app/api/user/billing/apply-code/route.ts
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const { code } = await req.json();

  // 1. Validate code exists and is valid
  const affiliateCode = await prisma.affiliateCode.findUnique({
    where: { code },
  });

  if (!affiliateCode) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  // 2. Check code is ACTIVE (not USED, EXPIRED, CANCELLED)
  if (affiliateCode.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'This code has already been used or expired' },
      { status: 400 }
    );
  }

  // 3. Check code hasn't expired
  if (affiliateCode.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This code has expired' },
      { status: 400 }
    );
  }

  // 4. Check code hasn't been used
  if (affiliateCode.usedBy !== null) {
    return NextResponse.json(
      { error: 'This code has already been used' },
      { status: 400 }
    );
  }

  // 5. Save code to user's subscription metadata (for next billing)
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  // Update Stripe subscription metadata
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    metadata: {
      nextBillingCode: code, // Code to apply on next renewal
      nextBillingCodeId: affiliateCode.id,
    },
  });

  // 6. Save to database
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      nextBillingCodeId: affiliateCode.id, // Store for next billing
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Code will be applied on your next billing date',
    nextBillingAmount: 23.2,
    savings: 5.8,
  });
}
```

**On renewal date (Stripe webhook):**

```typescript
// app/api/webhooks/stripe/route.ts
if (event.type === 'invoice.payment_succeeded') {
  const invoice = event.data.object;
  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription
  );

  // Check if user has code scheduled for this billing cycle
  const nextBillingCode = subscription.metadata.nextBillingCode;

  if (nextBillingCode) {
    const code = await prisma.affiliateCode.findUnique({
      where: { code: nextBillingCode },
    });

    // Apply discount and create commission
    const regularPrice = 29.0;
    const discountedPrice = regularPrice * (1 - code.discountPercent / 100);
    const commissionAmount = discountedPrice * (code.commissionPercent / 100);

    await prisma.commission.create({
      data: {
        affiliateId: code.affiliateId,
        codeId: code.id,
        userId: invoice.customer,
        subscriptionId: invoice.subscription,
        regularPrice,
        discountPercent: code.discountPercent,
        discountedPrice,
        commissionPercent: code.commissionPercent,
        commissionAmount,
        status: 'PENDING',
      },
    });

    // Mark code as USED
    await prisma.affiliateCode.update({
      where: { id: code.id },
      data: {
        status: 'USED',
        usedBy: invoice.customer,
        usedAt: new Date(),
      },
    });

    // Clear the code from subscription metadata (one-time use)
    await stripe.subscriptions.update(invoice.subscription, {
      metadata: {
        nextBillingCode: null,
        nextBillingCodeId: null,
      },
    });

    await prisma.subscription.update({
      where: { stripeSubscriptionId: invoice.subscription },
      data: {
        nextBillingCodeId: null,
      },
    });
  }
}
```

---

## 🔔 Reminder System

### Multi-Channel Reminder Strategy

**Goal:** Prompt users to enter affiliate codes before renewal to save money

**Reminder Schedule:**

```
Day -10: First reminder (Email + In-app notification)
Day -7:  Second reminder (Email)
Day -3:  Final reminder (Email + In-app notification + Dashboard banner)
Day 0:   Renewal occurs
Day +1:  Post-renewal message (if no code was used)
```

### Reminder 1: 10 Days Before Renewal

**Email:**

```
Subject: 💰 Save 20% on your next payment - Renews in 10 days

Hi [User Name],

Your PRO subscription renews on [Date] for $29.00.

Want to save 20%? Enter an affiliate code in your billing settings!

┌────────────────────────────────────────┐
│  Regular Price: $29.00/month          │
│  With Code:     $23.20/month          │
│  You Save:      $5.80 (20%)           │
└────────────────────────────────────────┘

Where to find codes:
• Follow our affiliates on Twitter, Instagram, YouTube
• Ask in our community Discord
• Check affiliate program page

[Enter Code Now] → Go to Billing Settings

Have questions? Reply to this email.

Trading Alerts Team
```

**In-App Notification:**

```
┌─────────────────────────────────────────────────────────────┐
│ 💡 Renewal Coming in 10 Days                                │
│                                                              │
│ Save 20% on your next payment! Enter an affiliate code in   │
│ your billing settings.                                       │
│                                                              │
│ [ Enter Code ] [ Dismiss ]                                  │
└─────────────────────────────────────────────────────────────┘
```

### Reminder 2: 7 Days Before Renewal

**Email:**

```
Subject: ⏰ One week until renewal - Save $5.80 with a code

Hi [User Name],

Just a reminder: Your subscription renews in 7 days for $29.00.

You haven't entered a code yet. Enter one now to pay only $23.20!

[Enter Code in Billing Settings]

Where to find codes:
• Twitter: #TradingAlertsAffiliates
• Instagram: @tradingalertspro
• Our affiliate directory: [link]

Trading Alerts Team
```

### Reminder 3: 3 Days Before Renewal (Final)

**Email:**

```
Subject: 🚨 Final reminder: Save 20% before renewal (3 days left)

Hi [User Name],

This is your last reminder! Your subscription renews in 3 days.

Current renewal amount: $29.00
With affiliate code: $23.20 (save $5.80!)

Time is running out to apply a code for this billing cycle.

[Enter Code Now - Last Chance!]

Note: After renewal, you'll need to wait until next month to use a code.

Trading Alerts Team
```

**In-App Notification + Dashboard Banner:**

```
┌─────────────────────────────────────────────────────────────┐
│ 🚨 URGENT: Renewal in 3 Days                                │
│                                                              │
│ You're about to be charged $29.00. Enter a code now to save │
│ $5.80 (20% off)!                                             │
│                                                              │
│ [ Enter Code Now ] [ I'll pay full price ]                  │
└─────────────────────────────────────────────────────────────┘

Dashboard Banner (Red):
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Your subscription renews in 3 days for $29.00.           │
│    Enter a code to pay $23.20 instead!  [ Enter Code ]     │
└─────────────────────────────────────────────────────────────┘
```

### Post-Renewal Message (Day +1 - No Code Used)

**Email:**

```
Subject: Your subscription renewed for $29.00

Hi [User Name],

Your PRO subscription successfully renewed on [Date].

Amount charged: $29.00

💡 Want to save 20% next month?

Your next renewal is on [Date]. Apply an affiliate code before then
to pay only $23.20 instead of $29.00.

[Set Up Code for Next Month]

Where to find codes:
• Follow affiliates on social media
• Check our affiliate directory
• Ask in community Discord

Trading Alerts Team
```

### Post-Renewal Message (Day +1 - Code Was Used)

**Email:**

```
Subject: ✅ Your subscription renewed for $23.20 (20% off!)

Hi [User Name],

Your PRO subscription successfully renewed on [Date].

Amount charged: $23.20 (You saved $5.80!)
Affiliate code used: [CODE]

🎉 Great job finding a code!

💡 Want to save again next month?

Codes are one-time use and expire monthly. Find a NEW code before
your next renewal on [Date] to save 20% again.

[Browse Affiliate Directory]

Trading Alerts Team
```

---

## 👤 User Journeys

### Journey 0: New User - Trial to Paid Conversion

**Day 0:**

- User clicks "Start 7-Day Trial"
- Creates account (no credit card required)
- Immediately gets PRO access (15 symbols, 9 timeframes, 20 alerts)
- Explores features for 7 days

**Day 5:**

- Receives email: "2 days left in trial"
- Dashboard banner: "Add payment to keep PRO access"
- User decides to continue (likes the service)
- Adds credit card in billing settings
- Enters affiliate code "SMITH-ABC123" for 20% off first payment

**Day 7:**

- Trial ends
- Trial status: CONVERTED
- User tier: PRO
- First charge: $23.20 (with affiliate code)
- User keeps all PRO features
- Subscription: ACTIVE, auto-renews

**Day 8:**

- User receives email: "Welcome to PRO! You saved $5.80 with code SMITH-ABC123"
- User continues using service...

**Result:** User successfully converted from trial to paid subscriber with discount

---

### Journey 0b: Trial User - Expires Without Payment

**Day 0:**

- User clicks "Start 7-Day Trial"
- Gets PRO access for 7 days

**Day 5:**

- Receives trial expiring email
- User busy, ignores it

**Day 7:**

- Trial ends
- Trial status: EXPIRED
- User tier: FREE (downgraded)
- No charge
- User can only access 5 symbols, 3 timeframes now
- User receives email: "Your trial ended. Upgrade to PRO anytime for $29/month"

**Day 30:**

- User misses PRO features
- Clicks "Upgrade to PRO" in dashboard
- Adds payment (cannot get second trial)
- Pays $29/month
- Gets PRO access back

**Result:** User tried service for free, later upgraded when ready

---

### Journey 1: Active User Who Finds Codes Monthly

**Month 1 (After Trial):**

- User already converted from trial
- First charge: $23.20 (used code during trial)
- Subscription: ACTIVE, auto-renews

**Month 2:**

- Day -10: Receives email reminder
- Day -5: User finds new code "JONES-XYZ789" on Twitter
- Day -5: User enters code in billing dashboard
- Dashboard shows: "Next billing: $23.20 (20% off!)"
- Day 0: Renewal occurs, charged $23.20
- User receives confirmation: "You saved $5.80!"

**Month 3:**

- Day -7: Receives email reminder
- Day -4: User finds code "BROWN-DEF456" on Instagram
- Day -4: User enters code in dashboard
- Day 0: Renewal occurs, charged $23.20
- Pattern continues...

**Result:** User saves 20% every month by actively finding codes

### Journey 2: Busy User Who Sometimes Forgets

**Month 1:**

- User signs up with code "SMITH-ABC123"
- Pays $23.20
- Subscription: ACTIVE

**Month 2:**

- Day -10, -7, -3: Receives reminders
- User busy, ignores emails
- Day 0: Renewal occurs, charged $29.00 (full price)
- Day +1: Receives email "You paid $29.00. Save next month?"
- User thinks: "Oops, forgot to enter code"

**Month 3:**

- Day -10: Receives reminder
- User remembers: "I don't want to pay full price again!"
- Day -8: User finds code "JONES-XYZ789"
- Day -8: User enters code
- Day 0: Renewal occurs, charged $23.20
- User receives: "You saved $5.80!"

**Month 4:**

- User busy again, forgets
- Day 0: Charged $29.00
- Pattern alternates...

**Result:** User pays full price some months, discounted price other months. Never loses access.

### Journey 3: User Who Doesn't Care About Codes

**Month 1:**

- User signs up WITHOUT code (direct)
- Pays $29.00 (full price)
- Subscription: ACTIVE

**Month 2-12:**

- Receives reminder emails
- User ignores them (doesn't care about saving)
- Day 0 each month: Charged $29.00
- Subscription continues

**Result:** User pays full price monthly, never uses codes. This is fine!

---

## 🔧 Technical Implementation

### Database Schema Updates

**Subscription Table:**

```prisma
model Subscription {
  id                    String   @id @default(cuid())
  userId                String   @unique
  tier                  Tier     @default(FREE)
  stripeCustomerId      String?  @unique
  stripeSubscriptionId  String?  @unique
  stripePriceId         String?

  // Current billing cycle info
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?

  // Affiliate code tracking
  currentCodeId         String?  // Code used for CURRENT billing cycle
  nextBillingCodeId     String?  // Code scheduled for NEXT billing cycle

  // Pricing
  status                SubscriptionStatus
  cancelAtPeriodEnd     Boolean  @default(false)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relations
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  currentCode           AffiliateCode? @relation("CurrentCode", fields: [currentCodeId], references: [id])
  nextBillingCode       AffiliateCode? @relation("NextBillingCode", fields: [nextBillingCodeId], references: [id])
}
```

### API Endpoints

**POST /api/user/billing/apply-code**

- Validates affiliate code
- Saves code for next billing cycle
- Returns success with new billing amount

**DELETE /api/user/billing/remove-code**

- Removes code from next billing cycle
- User will pay full price on next renewal

**GET /api/user/billing/next-renewal**

- Returns next renewal date
- Returns amount (with or without code)
- Returns code info if applied

### Cron Jobs for Reminders

**Daily Cron: Check Upcoming Renewals**

```typescript
// app/api/cron/renewal-reminders/route.ts
export async function POST(req: NextRequest) {
  const now = new Date();

  // Find subscriptions renewing in 10 days (first reminder)
  const day10 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const subscriptions10 = await prisma.subscription.findMany({
    where: {
      currentPeriodEnd: {
        gte: day10,
        lt: new Date(day10.getTime() + 24 * 60 * 60 * 1000),
      },
      nextBillingCodeId: null, // No code applied yet
    },
    include: { user: true },
  });

  for (const sub of subscriptions10) {
    await sendRenewalReminder(sub.user, 10);
  }

  // Repeat for 7 days, 3 days
  // ...

  return NextResponse.json({ sent: subscriptions10.length });
}
```

### Stripe Integration

**Update subscription metadata when code applied:**

```typescript
await stripe.subscriptions.update(subscriptionId, {
  metadata: {
    nextBillingCode: codeValue,
    nextBillingCodeId: codeId,
    affiliateName: affiliate.fullName,
  },
});
```

**Apply code on renewal (webhook):**

```typescript
// On invoice.payment_succeeded
const metadata = subscription.metadata;
if (metadata.nextBillingCode) {
  // Apply discount, create commission
  // Mark code as USED
  // Clear metadata
}
```

---

## 📊 Summary

**Subscription Model:**

- ✅ Monthly-only (no annual during early stage)
- ✅ Auto-renewal enabled by default
- ✅ Users stay subscribed even without codes
- ✅ Affiliate codes are optional for users

**Code Application:**

- ✅ Input box in billing dashboard
- ✅ User enters code for NEXT billing cycle
- ✅ Code validated and saved
- ✅ Applied automatically on renewal date

**Reminder System:**

- ✅ Email reminders at -10, -7, -3 days
- ✅ In-app notifications
- ✅ Dashboard banners
- ✅ Post-renewal messages

**User Experience:**

- ✅ Never lose access (even without codes)
- ✅ Incentivized to find codes (save money)
- ✅ Flexible (can skip finding codes some months)
- ✅ Clear communication about savings

**Affiliate Competition:**

- ✅ Affiliates post codes on social media monthly
- ✅ Codes are one-time use
- ✅ Codes expire monthly
- ✅ Affiliates compete for user attention

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-16
**Status:** CONFIRMED - Ready for Implementation
