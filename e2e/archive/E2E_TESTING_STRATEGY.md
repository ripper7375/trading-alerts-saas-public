# E2E Testing Strategy - Trading Alerts SaaS

**Last Updated:** 2025-12-29
**Framework:** Playwright
**Purpose:** Comprehensive E2E testing for 7 critical user journeys

---

## 📖 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Critical Path Analysis](#critical-path-analysis)
3. [Test Architecture](#test-architecture)
4. [Path 1: Login and Authentication](#path-1-login-and-authentication)
5. [Path 2: Subscription Upgrade](#path-2-subscription-upgrade-free-to-pro)
6. [Path 3: PRO User Cancels Subscription](#path-3-pro-user-cancels-subscription)
7. [Path 4: Discount Code Redemption](#path-4-discount-code-redemption)
8. [Path 5: Monthly Affiliate Commissions](#path-5-monthly-affiliate-commissions)
9. [Path 6: MT5 Data and Charts](#path-6-mt5-data-and-charts)
10. [Path 7: Alert Triggers and Notifications](#path-7-alert-triggers-and-notifications)
11. [Test Data Strategy](#test-data-strategy)
12. [Running Tests](#running-tests)

---

## 🎯 Overview

This document outlines the E2E testing strategy for the Trading Alerts SaaS application. Each test covers a complete entry-to-exit user journey, ensuring critical business flows work correctly.

### Technology Stack

- **Framework:** Playwright (TypeScript)
- **Test Runner:** @playwright/test
- **Browsers:** Chromium, Firefox, WebKit
- **CI Integration:** GitHub Actions compatible

### Test Principles

1. **User-centric:** Tests simulate real user behavior
2. **Independent:** Each test can run in isolation
3. **Deterministic:** Same inputs produce same results
4. **Fast feedback:** Optimized for CI/CD pipelines

---

## 🔍 Critical Path Analysis

### Path Criticality Matrix

| Path | Business Impact | Risk Level | Priority |
|------|----------------|------------|----------|
| 1. Authentication | Critical (access control) | High | P0 |
| 2. Subscription Upgrade | Critical (revenue) | High | P0 |
| 3. Subscription Cancel | High (retention) | Medium | P1 |
| 4. Discount Codes | High (affiliate revenue) | Medium | P1 |
| 5. Affiliate Commissions | High (partner ecosystem) | Medium | P1 |
| 6. MT5 Data + Charts | Critical (core feature) | High | P0 |
| 7. Alert Triggers | Critical (core feature) | High | P0 |

---

## 🏗️ Test Architecture

### Directory Structure

```
e2e/
├── E2E_TESTING_STRATEGY.md    # This document
├── playwright.config.ts        # Playwright configuration
├── fixtures/
│   ├── auth.fixture.ts        # Authentication fixtures
│   ├── database.fixture.ts    # Database seeding fixtures
│   └── payment.fixture.ts     # Payment mocking fixtures
├── pages/
│   ├── login.page.ts          # Login page object
│   ├── register.page.ts       # Registration page object
│   ├── dashboard.page.ts      # Dashboard page object
│   ├── pricing.page.ts        # Pricing page object
│   ├── checkout.page.ts       # Checkout page object
│   ├── alerts.page.ts         # Alerts page object
│   └── charts.page.ts         # Charts page object
├── tests/
│   ├── path1-authentication.spec.ts
│   ├── path2-subscription-upgrade.spec.ts
│   ├── path3-subscription-cancel.spec.ts
│   ├── path4-discount-redemption.spec.ts
│   ├── path5-affiliate-commissions.spec.ts
│   ├── path6-mt5-charts.spec.ts
│   └── path7-alert-notifications.spec.ts
└── utils/
    ├── test-data.ts           # Test data generators
    ├── api-helpers.ts         # API helper functions
    └── stripe-mock.ts         # Stripe test mode helpers
```

---

## 🔐 Path 1: Login and Authentication

### User Journey

```
┌──────────────────────────────────────────────────────────────┐
│                 AUTHENTICATION FLOW                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Entry Points:                                               │
│    1. Email/Password Registration                            │
│    2. OAuth Login (Google, Twitter, LinkedIn)                │
│    3. Email/Password Login                                   │
│    4. Password Reset                                         │
│                                                              │
│  Flow: Registration                                          │
│    /register → Fill form → Submit                            │
│       ↓                                                      │
│    Email verification sent → /verify-email/pending           │
│       ↓                                                      │
│    Click email link → /verify-email?token=xxx                │
│       ↓                                                      │
│    Account verified → Redirect to /login                     │
│       ↓                                                      │
│    Login → Dashboard                                         │
│                                                              │
│  Flow: Login                                                 │
│    /login → Enter credentials → Submit                       │
│       ↓                                                      │
│    Session created → Redirect to /dashboard                  │
│                                                              │
│  Flow: OAuth                                                 │
│    /login → Click OAuth provider                             │
│       ↓                                                      │
│    Redirect to provider → Authorize                          │
│       ↓                                                      │
│    Callback → Session created → /dashboard                   │
│                                                              │
│  Flow: Password Reset                                        │
│    /forgot-password → Enter email → Submit                   │
│       ↓                                                      │
│    Reset email sent → Click link                             │
│       ↓                                                      │
│    /reset-password?token=xxx → New password                  │
│       ↓                                                      │
│    Password updated → /login                                 │
│                                                              │
│  Exit Points:                                                │
│    ✓ Dashboard access (authenticated)                        │
│    ✗ Error message (invalid credentials)                     │
│    ✗ Verification required (unverified email)                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Test Scenarios

| ID | Scenario | Steps | Expected Outcome |
|----|----------|-------|------------------|
| AUTH-001 | New user registration | Register → Verify → Login | Dashboard access |
| AUTH-002 | Login with valid credentials | Login | Dashboard redirect |
| AUTH-003 | Login with invalid password | Login | Error: Invalid credentials |
| AUTH-004 | Login with unverified email | Login | Error: Verify email first |
| AUTH-005 | OAuth login (Google) | OAuth flow | Dashboard redirect |
| AUTH-006 | Password reset flow | Request → Reset | Can login with new password |
| AUTH-007 | Session persistence | Login → Refresh page | Stay authenticated |
| AUTH-008 | Logout | Click logout | Redirect to login |
| AUTH-009 | Protected route access | Visit /dashboard without auth | Redirect to login |
| AUTH-010 | Invalid reset token | Use expired/invalid token | Error message |

### Critical Assertions

```typescript
// Registration flow
- Email field validates format
- Password meets requirements (min 8 chars)
- Duplicate email shows error
- Verification email is sent
- Verification token works once

// Login flow
- Session cookie is set
- User tier is in session
- Redirect preserves intended destination
- Rate limiting on failed attempts

// Security
- Password is hashed (not visible in requests)
- CSRF protection active
- Session expires correctly
```

---

## 💳 Path 2: Subscription Upgrade (FREE to PRO)

### User Journey

```
┌──────────────────────────────────────────────────────────────┐
│              SUBSCRIPTION UPGRADE FLOW                       │
│           (Flow B: Unified Payment Flow)                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Entry: FREE user on dashboard                               │
│                                                              │
│  Dashboard → "Upgrade to PRO" button                         │
│     ↓                                                        │
│  /pricing → Select PRO plan                                  │
│     ↓                                                        │
│  [Optional: Enter discount code] → Apply                     │
│     ↓                                                        │
│  Country detected (Cloudflare headers)                       │
│     ↓                                                        │
│  /checkout → Unified Checkout Page                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  PRIMARY: Stripe International Payment                 │  │
│  │  ──────────────────────────────────────────────────    │  │
│  │  • PRO Monthly: $29/mo                                 │  │
│  │  • Cards (Visa, Mastercard, Amex)                      │  │
│  │  • Wallets (Apple Pay, Google Pay, PayPal)             │  │
│  │  • [Continue to Payment] button                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │  SECONDARY: dLocal Local Payment Methods               │  │
│  │  ──────────────────────────────────────────────────    │  │
│  │  • 8 countries: IN, NG, PK, VN, ID, TH, ZA, TR         │  │
│  │  • Select plan: 3-Day ($1.99) or Monthly ($29)         │  │
│  │  • Select local payment method (UPI, Paytm, etc.)      │  │
│  │  • View price in local currency                        │  │
│  │  • [Pay with Local Method] button                      │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                              │
│  User chooses payment option:                                │
│                                                              │
│  OPTION A: Stripe (International Payments)                   │
│     Click "Continue to Payment"                              │
│        ↓                                                     │
│     Redirect to Stripe hosted checkout                       │
│        ↓                                                     │
│     Select: Card / Apple Pay / Google Pay / PayPal           │
│        ↓                                                     │
│     Complete payment                                         │
│        ↓                                                     │
│     Stripe webhook: checkout.session.completed               │
│        ↓                                                     │
│     Subscription created → User tier = PRO                   │
│        ↓                                                     │
│     Success page → Dashboard (PRO features unlocked)         │
│                                                              │
│  OPTION B: dLocal (Local Payment Methods)                    │
│     Select country (auto-detected or manual)                 │
│        ↓                                                     │
│     Select plan: 3-Day Trial ($1.99) or Monthly ($29)        │
│        ↓                                                     │
│     Select payment method (UPI, Paytm, Bank Transfer, etc.)  │
│        ↓                                                     │
│     [Optional: Enter discount code] → Apply (monthly only)   │
│        ↓                                                     │
│     Click "Pay with Local Method"                            │
│        ↓                                                     │
│     Create dLocal payment → Redirect to payment provider     │
│        ↓                                                     │
│     Complete payment on provider                             │
│        ↓                                                     │
│     dLocal webhook: PAID status                              │
│        ↓                                                     │
│     Subscription created → User tier = PRO                   │
│        ↓                                                     │
│     Success page → Dashboard (PRO features unlocked)         │
│                                                              │
│  Exit Points:                                                │
│     ✓ PRO tier active, all features unlocked                 │
│     ✗ Payment failed → Remain FREE                           │
│     ✗ User cancels checkout → Remain FREE                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Test Scenarios

| ID | Scenario | Steps | Expected Outcome |
|----|----------|-------|------------------|
| SUB-001 | Stripe checkout success | Select plan → Pay | PRO tier active |
| SUB-002 | Stripe with discount code | Apply code → Pay | Discounted price, PRO active |
| SUB-003 | Stripe payment fails | Card declined | Error, remain FREE |
| SUB-004 | dLocal 3-day trial (India) | Select 3-day → UPI → Pay | PRO for 3 days |
| SUB-005 | dLocal monthly (Nigeria) | Select monthly → Bank | PRO for 30 days |
| SUB-006 | dLocal with discount | Apply code → Pay | Discounted, PRO active |
| SUB-007 | 3-day trial ineligible | Already used trial | Only monthly shown |
| SUB-008 | Cancel checkout | Abandon payment | Remain FREE |
| SUB-009 | PRO features unlocked | After upgrade | Access all symbols/timeframes |
| SUB-010 | Webhook retry | Webhook fails once | Eventually processes |

### Critical Assertions

```typescript
// Before upgrade
- User tier is FREE
- Limited to 5 symbols
- Limited to 3 timeframes
- Max 5 alerts

// Checkout
- Correct price displayed
- Discount code validation works
- Currency conversion accurate (dLocal)
- Payment session created

// After upgrade
- User tier is PRO
- Access to 15 symbols
- Access to 9 timeframes
- Max 20 alerts
- Subscription record created
- Payment record created
```

---

## ❌ Path 3: PRO User Cancels Subscription

### User Journey

```
┌──────────────────────────────────────────────────────────────┐
│            SUBSCRIPTION CANCELLATION FLOW                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Entry: PRO user on dashboard/settings                       │
│                                                              │
│  Flow:                                                       │
│    Dashboard → Settings → Subscription tab                   │
│       ↓                                                      │
│    View current subscription details                         │
│       ↓                                                      │
│    Click "Cancel Subscription"                               │
│       ↓                                                      │
│    Confirmation modal (retention attempt)                    │
│       ↓                                                      │
│    Confirm cancellation                                      │
│       ↓                                                      │
│    API: POST /api/subscription/cancel                        │
│       ↓                                                      │
│    If Stripe: Cancel at period end                           │
│    If dLocal: Mark as cancelled                              │
│       ↓                                                      │
│    Subscription status = CANCELLED                           │
│       ↓                                                      │
│    User retains PRO until expiry date                        │
│       ↓                                                      │
│    After expiry: Tier downgraded to FREE                     │
│                                                              │
│  Exit Points:                                                │
│    ✓ Subscription cancelled, PRO until expiry                │
│    ✓ After expiry: Downgraded to FREE                        │
│    ✗ Error during cancellation                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Test Scenarios

| ID | Scenario | Steps | Expected Outcome |
|----|----------|-------|------------------|
| CAN-001 | Cancel Stripe subscription | Settings → Cancel | Cancelled at period end |
| CAN-002 | Cancel dLocal subscription | Settings → Cancel | Marked as cancelled |
| CAN-003 | PRO access until expiry | After cancel | Still PRO until date |
| CAN-004 | Downgrade after expiry | Expiry date passes | Tier becomes FREE |
| CAN-005 | Alerts reduced after downgrade | Had 15 alerts | Oldest 10 deactivated |
| CAN-006 | Watchlist reduced | Had 30 items | Oldest 25 removed |
| CAN-007 | Cancel non-existent sub | No active sub | Error message |
| CAN-008 | Resubscribe after cancel | Cancel → Resubscribe | New subscription active |

### Critical Assertions

```typescript
// Before cancellation
- Subscription status is ACTIVE
- User tier is PRO

// After cancellation request
- Subscription status is CANCELLED
- cancelledAt date is set
- User tier remains PRO
- expiresAt date unchanged

// After expiry (cron job)
- User tier becomes FREE
- Subscription marked as EXPIRED
- Excess alerts deactivated
- Excess watchlist items removed
- User notified via email
```

---

## 🏷️ Path 4: Discount Code Redemption

### User Journey

```
┌──────────────────────────────────────────────────────────────┐
│              DISCOUNT CODE REDEMPTION FLOW                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Entry: User on checkout page                                │
│                                                              │
│  Flow:                                                       │
│    Checkout page → "Have a discount code?"                   │
│       ↓                                                      │
│    Enter code → Click "Apply"                                │
│       ↓                                                      │
│    API: GET /api/checkout/validate-code?code=XXX             │
│       ↓                                                      │
│    Validation checks:                                        │
│      - Code exists and is ACTIVE                             │
│      - Affiliate profile is ACTIVE                           │
│      - Code not expired                                      │
│      - Plan type allows discounts (not 3-day)                │
│       ↓                                                      │
│    If valid: Display discount                                │
│      - Original price: $29.00                                │
│      - Discount (10%): -$2.90                                │
│      - Final price: $26.10                                   │
│       ↓                                                      │
│    Complete payment with discounted price                    │
│       ↓                                                      │
│    On success:                                               │
│      - Code marked as USED                                   │
│      - Commission created for affiliate                      │
│      - User gets PRO at discounted rate                      │
│                                                              │
│  Commission Calculation:                                     │
│    Gross revenue: $29.00                                     │
│    Discount amount: $2.90 (10%)                              │
│    Net revenue: $26.10                                       │
│    Commission (20% of net): $5.22                            │
│                                                              │
│  Exit Points:                                                │
│    ✓ Discount applied, payment at reduced rate               │
│    ✓ Affiliate commission created                            │
│    ✗ Invalid code → Error message                            │
│    ✗ 3-day plan → Discounts not allowed                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Test Scenarios

| ID | Scenario | Steps | Expected Outcome |
|----|----------|-------|------------------|
| DSC-001 | Valid discount code | Enter code → Apply | Price reduced |
| DSC-002 | Invalid code | Enter wrong code | Error: Invalid code |
| DSC-003 | Expired code | Enter expired code | Error: Code expired |
| DSC-004 | Already used code | Enter used code | Error: Already used |
| DSC-005 | Suspended affiliate code | Affiliate suspended | Error: Code not valid |
| DSC-006 | Discount on 3-day plan | Try to apply | Error: Not available |
| DSC-007 | Commission created | Complete purchase | Commission record exists |
| DSC-008 | Code status updated | Complete purchase | Code status = USED |
| DSC-009 | 20% discount code | Apply 20% code | $23.20 final price |
| DSC-010 | Case insensitive | Enter lowercase | Code validated |

### Critical Assertions

```typescript
// Code validation
- Code lookup is case-insensitive
- Expiry date checked
- Affiliate status checked
- Plan type restrictions enforced

// Price calculation
- Discount percentage correct
- Final price = original * (1 - discount/100)
- Displayed price matches payment amount

// After purchase
- AffiliateCode.status = 'USED'
- AffiliateCode.usedAt = timestamp
- AffiliateCode.usedBy = userId
- Commission record created
- Commission amount calculated correctly
```

---

## 💰 Path 5: Monthly Affiliate Commissions

### User Journey

```
┌──────────────────────────────────────────────────────────────┐
│           AFFILIATE COMMISSION FLOW                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Entry: Affiliate viewing dashboard                          │
│                                                              │
│  Flow A: View Commission Summary                             │
│    Affiliate Dashboard → Commission Report                   │
│       ↓                                                      │
│    API: GET /api/affiliate/dashboard/commission-report       │
│       ↓                                                      │
│    Display:                                                  │
│      - Total Earnings (all time)                             │
│      - Pending Commissions                                   │
│      - Paid Commissions                                      │
│      - Monthly breakdown                                     │
│       ↓                                                      │
│    Filter by month/status                                    │
│                                                              │
│  Flow B: Monthly Commission Calculation (Cron)               │
│    Cron: First of month                                      │
│       ↓                                                      │
│    Aggregate all PENDING commissions per affiliate           │
│       ↓                                                      │
│    Mark commissions as APPROVED                              │
│       ↓                                                      │
│    Create disbursement batch                                 │
│       ↓                                                      │
│    Process payouts via RiseWorks                             │
│       ↓                                                      │
│    Update commission status to PAID                          │
│       ↓                                                      │
│    Update affiliate profile totals                           │
│                                                              │
│  Flow C: Code Distribution                                   │
│    Cron: Monthly code distribution                           │
│       ↓                                                      │
│    For each ACTIVE affiliate:                                │
│      - Generate new codes                                    │
│      - Set expiry (30 days)                                  │
│      - Update totalCodesDistributed                          │
│       ↓                                                      │
│    Notify affiliates via email                               │
│                                                              │
│  Exit Points:                                                │
│    ✓ Commission dashboard shows accurate totals              │
│    ✓ Monthly payouts processed                               │
│    ✓ New codes distributed                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Test Scenarios

| ID | Scenario | Steps | Expected Outcome |
|----|----------|-------|------------------|
| AFF-001 | View commission dashboard | Login as affiliate | Stats displayed |
| AFF-002 | Monthly summary accurate | Multiple commissions | Correct totals |
| AFF-003 | Filter by month | Select specific month | Only that month's data |
| AFF-004 | Commission status pending | New commission | Status = PENDING |
| AFF-005 | Commission approval | Run approval cron | Status = APPROVED |
| AFF-006 | Payout processing | Run payout cron | Status = PAID |
| AFF-007 | Code distribution | Run distribution cron | New codes issued |
| AFF-008 | Expired codes cleanup | Run expiry cron | Old codes expired |
| AFF-009 | Affiliate profile totals | After payouts | Totals updated |
| AFF-010 | Commission breakdown | View details | Per-transaction data |

### Critical Assertions

```typescript
// Commission creation
- Triggered by discount code use
- Correct commission percentage applied
- Linked to affiliate profile and code

// Monthly aggregation
- All PENDING commissions included
- Correct sum per affiliate
- Monthly boundary respected

// Payout processing
- Disbursement batch created
- RiseWorks API called
- Transaction IDs recorded
- Status updated to PAID

// Affiliate totals
- totalEarnings incremented
- pendingCommissions decremented
- paidCommissions incremented
```

---

## 📊 Path 6: MT5 Data and Charts

### User Journey

```
┌──────────────────────────────────────────────────────────────┐
│              MT5 DATA AND CHARTS FLOW                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Entry: User on dashboard/charts page                        │
│                                                              │
│  Flow:                                                       │
│    Dashboard → Charts section                                │
│       ↓                                                      │
│    Select symbol from dropdown                               │
│      - FREE: BTCUSD, EURUSD, USDJPY, US30, XAUUSD           │
│      - PRO: + GBPUSD, AUDUSD, USDCAD, etc.                  │
│       ↓                                                      │
│    Select timeframe                                          │
│      - FREE: H1, H4, D1                                      │
│      - PRO: + M5, M15, M30, H2, H8, H12                     │
│       ↓                                                      │
│    API: GET /api/tier/check/[symbol]                         │
│      - Validates symbol access for user's tier               │
│       ↓                                                      │
│    Fetch chart data:                                         │
│      - Connect to MT5 service (Flask backend)                │
│      - GET /api/mt5/candles?symbol=X&timeframe=Y            │
│       ↓                                                      │
│    Render TradingView Lightweight Charts                     │
│      - Candlestick chart                                     │
│      - Volume bars                                           │
│      - Technical indicators                                  │
│       ↓                                                      │
│    Real-time updates via WebSocket                           │
│      - New candles                                           │
│      - Price updates                                         │
│                                                              │
│  Tier Validation:                                            │
│    FREE user tries PRO symbol → 403 Forbidden                │
│    FREE user tries PRO timeframe → 403 Forbidden             │
│    PRO user → Full access                                    │
│                                                              │
│  Exit Points:                                                │
│    ✓ Chart displayed with correct data                       │
│    ✓ Real-time updates working                               │
│    ✗ Tier restriction → Upgrade prompt                       │
│    ✗ MT5 service down → Error message                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Test Scenarios

| ID | Scenario | Steps | Expected Outcome |
|----|----------|-------|------------------|
| MT5-001 | Load FREE symbol | Select BTCUSD | Chart renders |
| MT5-002 | Load PRO symbol as FREE | Select GBPUSD | Upgrade prompt |
| MT5-003 | Load PRO symbol as PRO | Select GBPUSD | Chart renders |
| MT5-004 | FREE timeframe access | Select H4 | Chart renders |
| MT5-005 | PRO timeframe blocked | FREE selects M5 | Upgrade prompt |
| MT5-006 | Change symbol | Switch BTCUSD→EURUSD | Chart updates |
| MT5-007 | Change timeframe | Switch H1→H4 | Chart updates |
| MT5-008 | Historical data loaded | Scroll left | More candles load |
| MT5-009 | Real-time updates | Price changes | Chart updates live |
| MT5-010 | MT5 service error | Service unavailable | Error message shown |

### Critical Assertions

```typescript
// Tier validation
- /api/tier/symbols returns correct list per tier
- /api/tier/check/[symbol] enforces access
- 403 returned for unauthorized access

// Chart rendering
- TradingView chart initializes
- Candlestick data displayed
- Correct OHLCV values
- Timezone handling correct

// Real-time
- WebSocket connection established
- New candles appear
- Price updates reflected
- Reconnection on disconnect
```

---

## 🔔 Path 7: Alert Triggers and Notifications

### User Journey

```
┌──────────────────────────────────────────────────────────────┐
│           ALERT TRIGGERS AND NOTIFICATIONS                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Entry: User creating/managing alerts                        │
│                                                              │
│  Flow A: Create Alert                                        │
│    Dashboard → Alerts → Create New Alert                     │
│       ↓                                                      │
│    Select symbol (tier-validated)                            │
│       ↓                                                      │
│    Select timeframe (tier-validated)                         │
│       ↓                                                      │
│    Set condition:                                            │
│      - Price touches trend line                              │
│      - Price above/below level                               │
│       ↓                                                      │
│    API: POST /api/alerts                                     │
│       ↓                                                      │
│    Validations:                                              │
│      - Symbol/timeframe access                               │
│      - Alert limit (5 FREE, 20 PRO)                          │
│       ↓                                                      │
│    Alert created and active                                  │
│                                                              │
│  Flow B: Alert Triggers                                      │
│    MT5 service monitors prices                               │
│       ↓                                                      │
│    Price approaches/touches trend line                       │
│       ↓                                                      │
│    Alert condition met                                       │
│       ↓                                                      │
│    Create notification:                                      │
│      - Type: ALERT                                           │
│      - Priority: HIGH                                        │
│       ↓                                                      │
│    Real-time delivery:                                       │
│      - WebSocket push to dashboard                           │
│      - Email notification                                    │
│      - Browser notification (if enabled)                     │
│       ↓                                                      │
│    Update alert:                                             │
│      - lastTriggered = now                                   │
│      - triggerCount++                                        │
│                                                              │
│  Flow C: View Notifications                                  │
│    Dashboard → Notification bell icon                        │
│       ↓                                                      │
│    API: GET /api/notifications                               │
│       ↓                                                      │
│    Display notification list                                 │
│       ↓                                                      │
│    Click notification → Mark as read                         │
│       ↓                                                      │
│    API: POST /api/notifications/[id]/read                    │
│                                                              │
│  Exit Points:                                                │
│    ✓ Alert created and monitoring                            │
│    ✓ Real-time notification when triggered                   │
│    ✓ Notification history accessible                         │
│    ✗ Alert limit reached → Upgrade prompt                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Test Scenarios

| ID | Scenario | Steps | Expected Outcome |
|----|----------|-------|------------------|
| ALT-001 | Create alert | Fill form → Save | Alert created |
| ALT-002 | Alert limit FREE | Create 6th alert | Error: Limit reached |
| ALT-003 | Alert limit PRO | Create up to 20 | All created |
| ALT-004 | Symbol validation | PRO symbol as FREE | Error: Upgrade required |
| ALT-005 | Alert triggers | Price meets condition | Notification sent |
| ALT-006 | Real-time notification | Alert triggers | Dashboard shows toast |
| ALT-007 | Email notification | Alert triggers | Email received |
| ALT-008 | Notification list | View notifications | All alerts listed |
| ALT-009 | Mark as read | Click notification | isRead = true |
| ALT-010 | Delete alert | Delete button | Alert removed |
| ALT-011 | Deactivate alert | Toggle off | isActive = false |
| ALT-012 | Trigger count | Alert fires 3x | triggerCount = 3 |

### Critical Assertions

```typescript
// Alert creation
- Symbol/timeframe tier validation
- Alert count limit enforced
- Condition JSON valid
- isActive defaults to true

// Alert trigger
- Price monitoring active
- Condition evaluation correct
- lastTriggered updated
- triggerCount incremented

// Notifications
- Notification record created
- Priority set correctly
- Real-time push works
- Email sent (if enabled)

// User interaction
- Mark as read works
- Unread count updates
- Notification deleted properly
```

---

## 📋 Test Data Strategy

### Test Users

```typescript
const testUsers = {
  // FREE tier user
  freeUser: {
    email: 'free@test.com',
    password: 'TestPassword123!',
    tier: 'FREE',
  },

  // PRO tier user
  proUser: {
    email: 'pro@test.com',
    password: 'TestPassword123!',
    tier: 'PRO',
  },

  // Admin user
  admin: {
    email: 'admin@test.com',
    password: 'AdminPassword123!',
    role: 'ADMIN',
  },

  // Affiliate user
  affiliate: {
    email: 'affiliate@test.com',
    password: 'AffiliatePassword123!',
    isAffiliate: true,
  },
};
```

### Test Codes

```typescript
const testCodes = {
  valid10: 'TESTCODE10', // 10% discount, active
  valid20: 'TESTCODE20', // 20% discount, active
  expired: 'EXPIREDCODE', // Expired code
  used: 'USEDCODE', // Already used
  suspended: 'SUSPENDEDAFF', // Affiliate suspended
};
```

### Database Seeding

```typescript
// Before each test suite
beforeAll(async () => {
  await seedTestUsers();
  await seedAffiliateCodes();
  await seedAlerts();
});

// After each test suite
afterAll(async () => {
  await cleanupTestData();
});
```

---

## 🚀 Running Tests

### Commands

```bash
# Install Playwright
npm install -D @playwright/test
npx playwright install

# Run all E2E tests
npm run test:e2e

# Run specific path
npm run test:e2e -- --grep "Path 1"

# Run with UI
npm run test:e2e:ui

# Run in headed mode
npm run test:e2e -- --headed

# Generate report
npm run test:e2e:report
```

### CI Configuration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 📊 Coverage Goals

| Path | Scenarios | Critical | High | Medium |
|------|-----------|----------|------|--------|
| 1. Authentication | 10 | 4 | 4 | 2 |
| 2. Subscription Upgrade | 10 | 5 | 3 | 2 |
| 3. Subscription Cancel | 8 | 3 | 3 | 2 |
| 4. Discount Redemption | 10 | 4 | 4 | 2 |
| 5. Affiliate Commissions | 10 | 3 | 5 | 2 |
| 6. MT5 Charts | 10 | 4 | 4 | 2 |
| 7. Alert Notifications | 12 | 5 | 5 | 2 |
| **Total** | **70** | **28** | **28** | **14** |

---

**Last Updated:** 2025-12-29
**Version:** 1.0.0
