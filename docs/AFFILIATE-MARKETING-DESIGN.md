# Affiliate Marketing Program - Design Specification

**Project:** Trading Alerts SaaS V7
**Feature:** Affiliate Marketing Program Integration
**Created:** 2025-11-14
**Status:** Design Phase
**Current Milestone:** 1.6 (Phase 1: Documentation & Policies)

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Business Requirements](#business-requirements)
3. [System Architecture](#system-architecture)
4. [Database Schema Changes](#database-schema-changes)
5. [API Endpoints](#api-endpoints)
6. [User Flows](#user-flows)
7. [Admin Workflows](#admin-workflows)
8. [Commission Calculation Logic](#commission-calculation-logic)
9. [Security Considerations](#security-considerations)
10. [Integration Points](#integration-points)
11. [Implementation Phases](#implementation-phases)
12. [Testing Strategy](#testing-strategy)

---

## 1. EXECUTIVE SUMMARY

### Overview

Build a **2-sided marketplace platform** that operates both as a SaaS provider AND distributor. This comprehensive affiliate marketing system enables:

**Affiliate Marketers (Side 1):**

- Self-service registration and authentication
- Personal dashboard with code inventory and commission reports
- Profile management with payment preferences
- Real-time tracking of conversions and earnings

**End Users (Side 2):**

- Apply affiliate discount codes at checkout
- Upgrade from FREE to PRO tier with discounts

**Admin (Platform Operator):**

- Manage affiliate accounts and code distribution
- View P&L, sales performance, and commission owings reports
- Process monthly commission payouts
- Monitor aggregate code inventory across all affiliates

### Key Business Model

- **Automated Code Distribution:** 15 codes per affiliate at registration + 15 monthly
- **Code Lifecycle:** All codes expire at end of month automatically
- **Code Format:** Cryptographically random >12 characters (e.g., `SxTYo25#1dpgiNguD`)
- **Commission Formula:** `[(Regular Price × (100% - %discount)) × %commission]`
- **Payment Options:** Bank transfers, Crypto (USDT), Global wallets (PayPal, Apple Pay, Google Pay, Stripe), Local wallets

### Success Criteria

- ✅ Affiliates can self-register and manage their business independently
- ✅ Automated monthly code distribution (15 codes per affiliate)
- ✅ Comprehensive accounting-style reports (opening/closing balances)
- ✅ Admin can view P&L and sales performance across all affiliates
- ✅ Flexible payment preferences with 4 different options
- ✅ Zero fraudulent code usage

---

## 2. BUSINESS REQUIREMENTS

### 2.1 Affiliate Registration & Authentication

**Affiliate Self-Registration:**

```
1. Public registration page: /affiliate/register
2. Required fields:
   - Full Name
   - Email (unique, verified)
   - Password (min 8 chars, hashed with bcrypt)
   - Country
   - Social Media Channels (optional: Facebook, Instagram, Twitter, YouTube, TikTok)
   - Payment Preference (one of 4 options - see 2.6)
3. Email verification required before activation
4. Upon successful registration:
   - Affiliate account created
   - 15 discount codes auto-generated
   - Welcome email sent with login credentials
```

**Affiliate Authentication:**

```
- Separate login system from end users
- Login page: /affiliate/login
- JWT-based session management
- Forgot password flow
- 2FA optional (future enhancement)
```

### 2.2 Discount Code System

**Code Generation:**

- **Format:** Cryptographically random >12 characters (e.g., `SxTYo25#1dpgiNguD`)
- **Uniqueness:** Enforced at database level
- **Security:** Using crypto.randomBytes for generation
- **Ownership:** Each code belongs to exactly one affiliate

**Automated Code Distribution:**

```
1. At Registration: 15 codes generated automatically
2. Monthly Distribution: 15 new codes at beginning of each month (automated cron job)
3. Code Expiry: All codes expire at end of month (last day 23:59:59)
4. Code Cancellation: Admin can cancel specific codes before expiry
```

**Code Configuration:**

```
- Code: "SxTYo25#1dpgiNguD" (auto-generated, >12 chars)
- Discount Percentage: Set by admin (0-50%)
- Commission Percentage: Set by admin (0-50%)
- Affiliate Owner: affiliate_id (relationship)
- Distributed Date: Timestamp when given to affiliate
- Expiry Date: End of current month (auto-calculated)
- Status: Active | Used | Expired | Cancelled
- Used By: user_id (if redeemed)
- Used At: Timestamp (if redeemed)
```

### 2.3 Code Inventory Tracking (Accounting Style)

**Monthly Code Inventory Formula:**

```
(1.0) Opening codes balance (at beginning of current month)
(1.1) + Discount codes received from Admin during current month
(1.2) - Codes used by free tier users to upgrade to pro plan
(1.3) - Codes expired (at end of month)
(1.4) - Codes cancelled by Admin
(1.5) = Closing codes balance
```

**Example Report for November 2025:**

```
Affiliate: John Doe (john@example.com)

Opening Balance (Nov 1):        10 codes
+ Received (Nov 1):             15 codes (monthly distribution)
- Used (during Nov):            -3 codes
- Expired (Nov 30):             -5 codes (unused)
- Cancelled by Admin:           -2 codes
= Closing Balance (Nov 30):     15 codes

Drill-down capability:
- Click on "Used (3)" → View 3 specific codes with user details
- Click on "Expired (5)" → View 5 expired codes
- Click on "Cancelled (2)" → View 2 cancelled codes with reason
```

### 2.4 Commission Calculation

**Formula:**

```
Commission (USD) = (Regular Price × (100% - Discount%)) × Commission%
```

**Examples:**

| Regular Price | Discount % | Discounted Price | Commission % | Affiliate Earns |
| ------------- | ---------- | ---------------- | ------------ | --------------- |
| $29.00        | 20%        | $23.20           | 30%          | $6.96           |
| $29.00        | 50%        | $14.50           | 40%          | $5.80           |
| $29.00        | 10%        | $26.10           | 25%          | $6.53           |

### 2.5 Commission Receivable Tracking (Accounting Style)

**Monthly Commission Receivable Formula:**

```
(2.0) Opening commission receivable balance (beginning of month)
(2.1) + Commission earned during current month (from code usage)
(2.2) - Commission paid during current month (by admin)
(2.3) = Closing commission receivable
```

**Example Report for November 2025:**

```
Affiliate: John Doe (john@example.com)

Opening Balance (Nov 1):        $15.50 (unpaid from Oct)
+ Earned (during Nov):          $20.88 (3 conversions)
- Paid (Nov 5):                 -$15.50 (Oct commission payout)
= Closing Balance (Nov 30):     $20.88 (pending Dec payout)

Drill-down capability:
- Click on "Earned ($20.88)" → View 3 conversions with user emails, dates, amounts
- Click on "Paid ($15.50)" → View payment details (method, date, reference)
```

### 2.6 Payment Preferences

**4 Payment Options:**

```
1. Local Bank Transfers (in local currency)
   - Bank Name
   - Account Number
   - Account Holder Name
   - Swift Code / Routing Number
   - Currency (e.g., USD, EUR, GBP)

2. Crypto Transfers (USDT)
   - Crypto Wallet Address (USDT)
   - Network (TRC20 / ERC20 / BEP20)

3. Global Digital Wallets (in USD)
   - PayPal Email
   - Apple Pay ID
   - Google Pay Email
   - Stripe Connect Account

4. Local/Regional Digital Wallets (in local currency)
   - Wallet Provider Name
   - Wallet ID / Phone Number
   - Currency
```

**Affiliate Profile Fields:**

```
- Personal Info: Full Name, Email, Country
- Social Media: Facebook, Instagram, Twitter, YouTube, TikTok URLs
- Payment Preference: Selected option (1-4)
- Payment Details: Fields based on selected option
- Tax Info: Optional (Tax ID, VAT number)
```

### 2.7 Payment Lifecycle

```
User Applies Code → Checkout with Discount → Payment Success
    ↓
Commission Record Created (Status: PENDING)
    ↓
Commission Accumulated (Monthly)
    ↓
Admin Reviews Commission Owings Report (First Week of Month)
    ↓
Admin Makes External Payments per Payment Preference
    ↓
Admin Marks Commissions as PAID (with payment reference)
    ↓
Affiliate Notified (Email) + Balance Updated
```

### 2.8 User Restrictions

**Who Can Use Codes:**

- ✅ FREE tier users upgrading to PRO (first-time signup)
- ✅ Existing PRO users at renewal (monthly discount application)
- ✅ All users can apply NEW, UNUSED, UNEXPIRED codes each month

**Competitive Monthly Model:**
This design drives affiliate competition by requiring users to find NEW codes monthly:

- User applies Affiliate B's code in Month 1 → Affiliate B earns commission
- User applies Affiliate C's code in Month 2 → Affiliate C earns commission (Affiliate B gets nothing)
- User applies Affiliate D's code in Month 3 → Affiliate D earns commission (B and C get nothing)
- Result: Affiliates must continuously post codes on social media to earn

**Code Validation:**

- Code must exist in database
- Code must be ACTIVE (not Used, Expired, or Cancelled)
- Code must not be expired (expiresAt > now)
- Code must be UNUSED (usedBy = null)
- Code must be NEW (generated current month, not expired from previous months)
- User can apply code at:
  - Initial signup: FREE → PRO with discount ($23.20)
  - Monthly renewal: PRO → PRO with discount ($23.20 instead of $29.00)
  - Without code at renewal: User pays full price ($29.00)

### 2.9 Subscription Model (Monthly-Only for Early Stage)

**Subscription Type:**

- ✅ **MONTHLY subscriptions ONLY** during early stage (no annual plans)
- ❌ **NO annual subscriptions** until product is mature and stable

**Subscription Behavior:**

- **AUTO-RENEWAL:** Subscriptions automatically renew every month
- **Continuous Access:** Users NEVER lose access (unless they cancel or payment fails)
- **Optional Codes:** Users can OPTIONALLY enter affiliate codes to save 20%
- **Code Application:** Users enter codes in billing dashboard BEFORE renewal date
- **Code Effect:** Code applies to NEXT billing cycle only (one-time use)

**Pricing Structure:**

```
PRO Plan (Monthly):
- Regular Price: $29.00/month
- With Affiliate Code: $23.20/month (20% discount)
- Auto-renews monthly
- Cancel anytime
- No long-term commitment

❌ Annual Plan: NOT AVAILABLE YET
- Will be introduced later when product is mature
- Likely pricing: ~$290/year (save ~17% vs monthly)
- Requires long-term commitment (not suitable for early stage)
```

**Rationale for Monthly-Only:**

1. **Development Flexibility**
   - Still building features and functionalities
   - Need flexibility to iterate quickly
   - Easier to make changes without annual commitments
   - Can adjust pricing or features based on feedback

2. **Lower User Commitment Barrier**
   - New users hesitant to commit for 12 months
   - Monthly allows users to "try before they buy" long-term
   - Easier to attract early adopters
   - Lower psychological barrier to signup

3. **Business Strategy**
   - Build trust first with monthly subscriptions
   - Prove product value month by month
   - Add annual option later as upsell opportunity
   - Annual plan can be launched with data on user retention

**When to Introduce Annual:**

- After 6-12 months of operation
- When feature set is stable and mature
- When monthly churn rate is <5%
- When product-market fit is proven
- As an upsell opportunity for existing satisfied users

**Renewal Cycle Flow:**

```
Day -10: User receives first reminder email
         "Your subscription renews in 10 days for $29.00"
         "Enter a code to save 20%!"

Day -7:  User receives second reminder email
         "One week until renewal"

Day -3:  User receives final reminder email + in-app notification
         "Last chance to enter code!"

User Action:
- Option A: User enters code in billing dashboard
  → Next billing: $23.20 (discounted)
  → Affiliate earns commission

- Option B: User doesn't enter code
  → Next billing: $29.00 (full price)
  → No affiliate earns commission
  → User stays subscribed (auto-renewal continues)

Day 0:   Stripe auto-charges user (with or without discount)
         Subscription continues for another month

Repeat:  Cycle repeats monthly
         User always has option to enter code or skip
```

**Key Benefits:**

- ✅ Users never lose access unexpectedly
- ✅ Users can choose to save money by finding codes
- ✅ Affiliates compete monthly for commissions
- ✅ Low churn (auto-renewal)
- ✅ Flexible for ongoing development
- ✅ No annual commitment pressure on users

---

## 3. SYSTEM ARCHITECTURE

### 3.1 Overall Platform Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     2-SIDED MARKETPLACE PLATFORM                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   ADMIN PANEL      │  │ AFFILIATE PORTAL│  │  USER CHECKOUT  │  │
│  │  (Platform Mgmt)   │  │  (Self-Service) │  │  (Redeem Codes) │  │
│  └────────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                       SHARED SERVICES LAYER                          │
│  - Authentication (NextAuth.js with 3 roles: Admin, Affiliate, User)│
│  - Code Generation Service (crypto.randomBytes)                     │
│  - Commission Calculation Engine                                    │
│  - Email Notification Service                                       │
│  - Report Generation Service                                        │
├──────────────────────────────────────────────────────────────────────┤
│                         DATABASE LAYER                               │
│  PostgreSQL + Prisma ORM                                            │
│  - User (end users)                                                 │
│  - Affiliate (marketers)                                            │
│  - AffiliateCode (discount codes)                                   │
│  - Commission (earnings tracking)                                   │
│  - Subscription (user subscriptions)                                │
├──────────────────────────────────────────────────────────────────────┤
│                      EXTERNAL INTEGRATIONS                           │
│  - Stripe (payment processing)                                      │
│  - SendGrid/Resend (transactional emails)                           │
│  - Vercel Cron (monthly automation)                                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Affiliate Portal Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AFFILIATE REGISTRATION                        │
│  /affiliate/register                                            │
│  1. Affiliate fills registration form                           │
│  2. Email verification sent                                     │
│  3. Upon verification:                                          │
│     - Affiliate record created                                  │
│     - 15 codes auto-generated (status: Active)                  │
│     - Welcome email with dashboard link                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AFFILIATE DASHBOARD                           │
│  /affiliate/dashboard (Main Hub)                                │
│                                                                  │
│  Navigation:                                                     │
│  ├─ Dashboard (Overview)                                        │
│  ├─ Code Inventory Report                                       │
│  ├─ Commission Receivable Report                                │
│  ├─ Profile Settings                                            │
│  └─ Help & Resources                                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌──────────────────┐ ┌───────────────┐ ┌──────────────────┐
│  CODE INVENTORY  │ │  COMMISSION   │ │     PROFILE      │
│     REPORT       │ │    REPORT     │ │    MANAGEMENT    │
├──────────────────┤ ├───────────────┤ ├──────────────────┤
│ Opening Balance  │ │ Opening $     │ │ Personal Info    │
│ + Received       │ │ + Earned      │ │ Social Media     │
│ - Used           │ │ - Paid        │ │ Payment Prefs    │
│ - Expired        │ │ = Closing $   │ │ Tax Info         │
│ - Cancelled      │ │               │ │                  │
│ = Closing Bal    │ │ Drill-downs:  │ │ Update Password  │
│                  │ │ - Conversions │ │                  │
│ Drill-downs:     │ │ - Payments    │ │                  │
│ - Used codes     │ │               │ │                  │
│ - Expired list   │ │               │ │                  │
└──────────────────┘ └───────────────┘ └──────────────────┘
```

### 3.3 Admin Panel Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ADMIN DASHBOARD                             │
│  /admin/affiliates (Main Hub)                                   │
│                                                                  │
│  Navigation:                                                     │
│  ├─ Affiliate Management (list all affiliates)                  │
│  ├─ Code Distribution (manual/auto)                             │
│  ├─ Profit & Loss Report (3 months)                             │
│  ├─ Sales Performance by Affiliate                              │
│  ├─ Commission Owings Report                                    │
│  ├─ Aggregate Code Inventory (all affiliates)                   │
│  └─ System Settings                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┬──────────────────┐
          ▼                ▼                ▼                  ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
│   P&L        │ │   SALES     │ │  COMMISSION  │ │  AGGREGATE   │
│   REPORT     │ │ PERFORMANCE │ │   OWINGS     │ │    CODE      │
│  (3 months)  │ │  BY AFFILIATE│ │    REPORT    │ │  INVENTORY   │
├──────────────┤ ├─────────────┤ ├──────────────┤ ├──────────────┤
│ Month 1:     │ │ Affiliate 1 │ │ Pending:     │ │ All Affs:    │
│  Revenue     │ │  Conversions│ │  Affiliate 1 │ │ Active: 450  │
│  -Discounts  │ │  Revenue    │ │    $34.80    │ │ Used: 120    │
│  -Commissions│ │  Discount   │ │  Affiliate 2 │ │ Expired: 80  │
│  =Profit     │ │  Commission │ │    $20.88    │ │ Cancelled: 5 │
│              │ │             │ │              │ │              │
│ Month 2: ... │ │ Affiliate 2 │ │ Total Owe:   │ │ Chart View   │
│ Month 3: ... │ │  ...        │ │  $125.40     │ │ Trend View   │
│              │ │             │ │              │ │              │
│ Summary      │ │ Drill-down: │ │ Actions:     │ │ Filter by    │
│ Chart View   │ │ - User list │ │ - Bulk pay   │ │ affiliate    │
└──────────────┘ └─────────────┘ └──────────────┘ └──────────────┘
```

### 3.4 User Checkout Flow Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER CHECKOUT FLOW                            │
│  /checkout (FREE tier user upgrading to PRO)                    │
│                                                                  │
│  1. User clicks "Upgrade to PRO"                                │
│  2. Checkout page shows:                                        │
│     - Regular price: $29.00/month                               │
│     - Input field: "Have an affiliate code?"                    │
│  3. User enters code (e.g., SxTYo25#1dpgiNguD)                  │
│  4. Real-time validation via API                                │
│  5. If valid:                                                   │
│     - Show discount: $29.00 → $23.20 (20% off)                 │
│     - Show affiliate name (optional)                            │
│  6. User clicks "Pay with Stripe"                               │
│  7. Stripe checkout with custom unit_amount (2320 cents)        │
│  8. Metadata includes: {codeId, affiliateId, discountPercent}   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STRIPE WEBHOOK HANDLER                         │
│  /api/webhooks/stripe                                           │
│                                                                  │
│  Event: checkout.session.completed                              │
│  1. Extract metadata (codeId, affiliateId)                      │
│  2. Create Subscription record                                  │
│  3. Upgrade user.tier to PRO                                    │
│  4. Update AffiliateCode:                                       │
│     - status: Active → Used                                     │
│     - usedBy: user_id                                           │
│     - usedAt: timestamp                                         │
│  5. Create Commission record:                                   │
│     - affiliateId, codeId, userId                               │
│     - commissionAmount (calculated)                             │
│     - status: PENDING                                           │
│  6. Send emails:                                                │
│     - User: "Welcome to PRO"                                    │
│     - Affiliate: "Your code was used! Earned $6.96"             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Automated Monthly Processes

```
┌─────────────────────────────────────────────────────────────────┐
│              MONTHLY AUTOMATION (Vercel Cron)                    │
│  Schedule: 1st day of month, 00:00 UTC                          │
│                                                                  │
│  Job 1: CODE DISTRIBUTION                                       │
│  ────────────────────────────────────────────────────────────   │
│  1. Query all active affiliates                                 │
│  2. For each affiliate:                                         │
│     - Generate 15 new codes                                     │
│     - Set expiresAt = end of current month                      │
│     - Set status = Active                                       │
│     - Insert into AffiliateCode table                           │
│  3. Send email to affiliate: "15 new codes distributed"         │
│                                                                  │
│  Job 2: CODE EXPIRY                                             │
│  ────────────────────────────────────────────────────────────   │
│  Schedule: Last day of month, 23:59 UTC                         │
│  1. Query all Active codes where expiresAt < now                │
│  2. Update status: Active → Expired                             │
│  3. Log expiry events for reporting                             │
│                                                                  │
│  Job 3: MONTHLY REPORT EMAIL                                    │
│  ────────────────────────────────────────────────────────────   │
│  Schedule: 1st day of month, 09:00 UTC                          │
│  1. Generate monthly report for each affiliate:                 │
│     - Code inventory summary                                    │
│     - Commission earned summary                                 │
│     - Closing balances                                          │
│  2. Send email with PDF attachment (optional)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.6 Component Breakdown

**New Components for Affiliate Portal:**

1. **Affiliate Auth** (`app/affiliate/(auth)/`)
   - Registration page
   - Login page
   - Email verification
   - Password reset

2. **Affiliate Dashboard** (`app/affiliate/dashboard/`)
   - Overview page with stats
   - Code inventory report
   - Commission receivable report
   - Profile management

3. **Admin Affiliate Manager** (`app/admin/affiliates/`)
   - Affiliate list and details
   - Manual code distribution
   - P&L report (3 months)
   - Sales performance by affiliate
   - Commission owings report
   - Aggregate code inventory

4. **Shared Services** (`lib/affiliate/`)
   - Code generator (`code-generator.ts`)
   - Code validator (`validator.ts`)
   - Commission calculator (`commission.ts`)
   - Report generator (`reports.ts`)
   - Automated jobs (`cron-jobs.ts`)

5. **API Endpoints** (`app/api/affiliate/`, `app/api/admin/affiliate/`)
   - Affiliate registration, login, profile
   - Code inventory and commission reports
   - Admin management and reporting
   - Code validation for checkout

6. **Database Models** (Prisma)
   - Affiliate model (new)
   - AffiliateCode model (updated with status enum)
   - Commission model (updated with affiliate relationship)

7. **Checkout Integration** (Update existing `app/checkout/`)
   - Code input field
   - Real-time validation
   - Price preview with discount

8. **Webhook Handler** (Update existing `/api/webhooks/stripe/route.ts`)
   - Handle code usage
   - Create commission
   - Update code status
   - Send notifications

9. **Automated Jobs** (`app/api/cron/`)
   - Monthly code distribution
   - Monthly code expiry
   - Monthly report emails

---

## 4. DATABASE SCHEMA CHANGES

### 4.1 New Tables

**Table: `Affiliate`** (New - Core entity for affiliate marketers)

```prisma
model Affiliate {
  id                String   @id @default(cuid())

  // Authentication
  email             String   @unique
  password          String                      // Hashed with bcrypt
  emailVerified     DateTime?                   // Email verification timestamp

  // Personal Info
  fullName          String
  country           String                      // ISO country code (e.g., "US", "GB")

  // Social Media (Optional)
  facebookUrl       String?
  instagramUrl      String?
  twitterUrl        String?
  youtubeUrl        String?
  tiktokUrl         String?

  // Payment Preferences (4 options - one selected)
  paymentMethod     PaymentMethod               // BANK, CRYPTO, GLOBAL_WALLET, LOCAL_WALLET

  // Payment Details - Bank Transfer
  bankName          String?
  bankAccountNumber String?
  bankAccountHolder String?
  bankSwiftCode     String?
  bankCurrency      String?                     // "USD", "EUR", "GBP", etc.

  // Payment Details - Crypto
  cryptoWalletAddress String?
  cryptoNetwork     String?                     // "TRC20", "ERC20", "BEP20"

  // Payment Details - Global Wallet
  paypalEmail       String?
  applePayId        String?
  googlePayEmail    String?
  stripeConnectId   String?

  // Payment Details - Local Wallet
  localWalletProvider String?
  localWalletId     String?
  localWalletCurrency String?

  // Tax Info (Optional)
  taxId             String?
  vatNumber         String?

  // Status
  status            AffiliateStatus @default(PENDING_VERIFICATION)

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  codes             AffiliateCode[]
  commissions       Commission[]

  @@index([email])
  @@index([status])
}

enum PaymentMethod {
  BANK_TRANSFER      // Local bank transfers in local currency
  CRYPTO             // USDT to crypto wallet
  GLOBAL_WALLET      // PayPal, Apple Pay, Google Pay, Stripe
  LOCAL_WALLET       // Local/regional digital wallets
}

enum AffiliateStatus {
  PENDING_VERIFICATION  // Email not verified yet
  ACTIVE                // Email verified, can operate
  SUSPENDED             // Temporarily disabled by admin
  TERMINATED            // Permanently disabled
}
```

**Table: `AffiliateCode`** (Updated with comprehensive tracking)

```prisma
model AffiliateCode {
  id                String   @id @default(cuid())

  // Code Details
  code              String   @unique        // "SxTYo25#1dpgiNguD" (>12 chars random)
  discountPercent   Int                     // 20 (represents 20%)
  commissionPercent Int                     // 20 (represents 20%)

  // Ownership
  affiliateId       String                  // Belongs to which affiliate

  // Distribution & Expiry
  distributedAt     DateTime @default(now()) // When given to affiliate
  expiresAt         DateTime                 // Auto-set to end of month

  // Status Tracking
  status            CodeStatus @default(ACTIVE)

  // Usage Tracking (when status = USED)
  usedBy            String?                  // User ID who redeemed
  usedAt            DateTime?                // When redeemed

  // Cancellation Tracking (when status = CANCELLED)
  cancelledBy       String?                  // Admin ID who cancelled
  cancelledAt       DateTime?                // When cancelled
  cancellationReason String?                 // Why cancelled

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  affiliate         Affiliate    @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  userWhoUsed       User?        @relation("CodeUsedByUser", fields: [usedBy], references: [id])
  adminWhoCancelled User?        @relation("CodeCancelledByAdmin", fields: [cancelledBy], references: [id])
  commissions       Commission[]

  @@index([code])
  @@index([affiliateId])
  @@index([status])
  @@index([expiresAt])
}

enum CodeStatus {
  ACTIVE      // Available for use
  USED        // Redeemed by user
  EXPIRED     // Passed expiry date
  CANCELLED   // Manually cancelled by admin
}
```

**Table: `Commission`** (Updated with affiliate relationship)

```prisma
model Commission {
  id                  String   @id @default(cuid())

  // Relationships
  affiliateId         String                    // Affiliate who earned this
  codeId              String                    // Which code was used
  userId              String                    // User who upgraded
  subscriptionId      String   @unique          // Stripe subscription ID

  // Price Breakdown
  regularPrice        Decimal  @db.Decimal(10, 2) // 29.00
  discountPercent     Int                         // 20
  discountedPrice     Decimal  @db.Decimal(10, 2) // 23.20
  commissionPercent   Int                         // 20
  commissionAmount    Decimal  @db.Decimal(10, 2) // 4.64

  // Payment Status
  status              CommissionStatus @default(PENDING)
  paidAt              DateTime?
  paidBy              String?                     // Admin who marked as paid
  paymentReference    String?                     // External payment ref (e.g., PayPal transaction ID)
  paymentMethod       String?                     // How paid (copied from affiliate profile)
  paymentNotes        String?                     // Admin notes

  // Timestamps
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  // Relations
  affiliate           Affiliate     @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  code                AffiliateCode @relation(fields: [codeId], references: [id])
  user                User          @relation("UserCommissions", fields: [userId], references: [id])
  paidByUser          User?         @relation("CommissionPaidBy", fields: [paidBy], references: [id])

  @@index([affiliateId])
  @@index([codeId])
  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@index([paidAt])
}

enum CommissionStatus {
  PENDING    // Not yet paid
  PAID       // Paid by admin
  CANCELLED  // Subscription refunded/cancelled
}
```

**Table: `SystemConfig`** (Centralized Settings Management)

```prisma
model SystemConfig {
  id          String   @id @default(cuid())
  key         String   @unique  // "affiliate_discount_percent", "affiliate_commission_percent", etc.
  value       String   // Stored as string, parsed as needed (e.g., "20.0", "15", "true")
  valueType   String   // "number", "boolean", "string"
  description String?  // Human-readable description of what this setting controls
  category    String   // "affiliate", "payment", "general"
  updatedBy   String?  // Admin user ID who made the last change
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@index([category])
  @@index([key])
}
```

**Purpose:** Allows admins to dynamically change affiliate discount and commission percentages from the admin dashboard without code changes. When admin updates these values, all pages (marketing site, user dashboard, affiliate dashboard, admin panels) automatically reflect the new percentages within 1-5 minutes via frontend caching and SWR auto-refresh.

**Table: `SystemConfigHistory`** (Audit Trail for Settings Changes)

```prisma
model SystemConfigHistory {
  id         String   @id @default(cuid())
  configKey  String   // Which setting was changed (e.g., "affiliate_discount_percent")
  oldValue   String   // Previous value before change
  newValue   String   // New value after change
  changedBy  String   // Admin user ID or email who made the change
  changedAt  DateTime @default(now())
  reason     String?  // Optional: why the change was made (admin can provide context)

  @@index([configKey])
  @@index([changedAt])
}
```

**Purpose:** Provides complete audit trail of all configuration changes. Allows admins to review who changed what settings, when, and why. Essential for compliance and debugging.

**Default Configuration Values:**

```typescript
// Initial seed data for SystemConfig table
const defaultConfig = [
  {
    key: 'affiliate_discount_percent',
    value: '20.0',
    valueType: 'number',
    description: 'Default discount percentage for affiliate codes',
    category: 'affiliate',
  },
  {
    key: 'affiliate_commission_percent',
    value: '20.0',
    valueType: 'number',
    description: 'Default commission percentage for affiliates',
    category: 'affiliate',
  },
  {
    key: 'affiliate_codes_per_month',
    value: '15',
    valueType: 'number',
    description: 'Number of codes distributed to each affiliate monthly',
    category: 'affiliate',
  },
];
```

**Important Note:** When admin changes these default percentages, existing AffiliateCode and Commission records retain their original percentages (snapshot at creation time). Only NEW codes generated after the change will use the new percentages. This ensures historical accuracy and prevents retroactive changes to existing agreements.

### 4.2 Existing Table Updates

**Table: `User`** (Add relations for admin operations)

```prisma
model User {
  // ... existing fields ...

  role              Role     @default(USER)  // USER | ADMIN

  // New relations for affiliate system
  codeUsages        AffiliateCode[] @relation("CodeUsedByUser")
  codeCancellations AffiliateCode[] @relation("CodeCancelledByAdmin")
  commissions       Commission[]    @relation("UserCommissions")
  paidCommissions   Commission[]    @relation("CommissionPaidBy")
}

enum Role {
  USER     // Regular end user
  ADMIN    // Platform administrator
}
```

**Table: `Subscription`** (Add discount tracking)

```prisma
model Subscription {
  // ... existing fields ...

  // New fields for affiliate tracking
  codeId          String?        // AffiliateCode ID (if discount code used)
  originalPrice   Decimal?       // 29.00 (regular PRO price)
  discountedPrice Decimal?       // 23.20 (actual charged amount with discount)
}
```

### 4.3 Migration Strategy

**Prisma Migration Steps:**

```bash
# 1. Update schema.prisma with new models
# 2. Generate migration
npx prisma migrate dev --name add_affiliate_system

# This will create migration SQL automatically
```

**Generated Migration SQL (Example):**

```sql
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CRYPTO', 'GLOBAL_WALLET', 'LOCAL_WALLET');
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'TERMINATED');
CREATE TYPE "CodeStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable: Affiliate
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "fullName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "twitterUrl" TEXT,
    "youtubeUrl" TEXT,
    "tiktokUrl" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountHolder" TEXT,
    "bankSwiftCode" TEXT,
    "bankCurrency" TEXT,
    "cryptoWalletAddress" TEXT,
    "cryptoNetwork" TEXT,
    "paypalEmail" TEXT,
    "applePayId" TEXT,
    "googlePayEmail" TEXT,
    "stripeConnectId" TEXT,
    "localWalletProvider" TEXT,
    "localWalletId" TEXT,
    "localWalletCurrency" TEXT,
    "taxId" TEXT,
    "vatNumber" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable: AffiliateCode
CREATE TABLE "AffiliateCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL UNIQUE,
    "discountPercent" INTEGER NOT NULL,
    "commissionPercent" INTEGER NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "CodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateCode_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE,
    CONSTRAINT "AffiliateCode_usedBy_fkey" FOREIGN KEY ("usedBy") REFERENCES "User" ("id"),
    CONSTRAINT "AffiliateCode_cancelledBy_fkey" FOREIGN KEY ("cancelledBy") REFERENCES "User" ("id")
);

-- CreateTable: Commission
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "affiliateId" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL UNIQUE,
    "regularPrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "discountedPrice" DECIMAL(10,2) NOT NULL,
    "commissionPercent" INTEGER NOT NULL,
    "commissionAmount" DECIMAL(10,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "paymentReference" TEXT,
    "paymentMethod" TEXT,
    "paymentNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Commission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate" ("id") ON DELETE CASCADE,
    CONSTRAINT "Commission_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "AffiliateCode" ("id"),
    CONSTRAINT "Commission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id"),
    CONSTRAINT "Commission_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User" ("id")
);

-- Update Subscription table
ALTER TABLE "Subscription" ADD COLUMN "codeId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "originalPrice" DECIMAL(10,2);
ALTER TABLE "Subscription" ADD COLUMN "discountedPrice" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Affiliate_email_idx" ON "Affiliate"("email");
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");
CREATE INDEX "AffiliateCode_code_idx" ON "AffiliateCode"("code");
CREATE INDEX "AffiliateCode_affiliateId_idx" ON "AffiliateCode"("affiliateId");
CREATE INDEX "AffiliateCode_status_idx" ON "AffiliateCode"("status");
CREATE INDEX "AffiliateCode_expiresAt_idx" ON "AffiliateCode"("expiresAt");
CREATE INDEX "Commission_affiliateId_idx" ON "Commission"("affiliateId");
CREATE INDEX "Commission_codeId_idx" ON "Commission"("codeId");
CREATE INDEX "Commission_userId_idx" ON "Commission"("userId");
CREATE INDEX "Commission_status_idx" ON "Commission"("status");
CREATE INDEX "Commission_createdAt_idx" ON "Commission"("createdAt");
CREATE INDEX "Commission_paidAt_idx" ON "Commission"("paidAt");
```

### 4.4 Database Relationships Diagram

```
┌─────────────┐         ┌──────────────┐         ┌────────────┐
│   User      │         │  Affiliate   │         │Subscription│
│  (End User) │         │ (Marketer)   │         │            │
├─────────────┤         ├──────────────┤         ├────────────┤
│ id          │◄────┐   │ id           │◄────┐   │ id         │
│ email       │     │   │ email        │     │   │ userId     │
│ tier        │     │   │ fullName     │     │   │ codeId     │◄──┐
│ role        │     │   │ country      │     │   │ stripeId   │   │
└─────────────┘     │   │ paymentMethod│     │   └────────────┘   │
                    │   └──────────────┘     │                    │
                    │          │             │                    │
                    │          │ 1:N         │                    │
                    │          ▼             │                    │
                    │   ┌──────────────┐     │                    │
                    │   │AffiliateCode │     │                    │
                    │   ├──────────────┤     │                    │
                    │   │ id           │─────┘                    │
                    └───│ affiliateId  │                          │
                        │ code         │◄─────────────────────────┘
                        │ status       │
                        │ usedBy       │
                        │ expiresAt    │
                        └──────┬───────┘
                               │ 1:N
                               ▼
                        ┌──────────────┐
                        │ Commission   │
                        ├──────────────┤
                        │ id           │
                        │ affiliateId  │──┐
                        │ codeId       │  │
                        │ userId       │  │
                        │ amount       │  │
                        │ status       │  │
                        └──────────────┘  │
                               │          │
                               └──────────┘
                               (all link back to entities above)
```

---

## 5. API ENDPOINTS

### 5.1 Affiliate Authentication Endpoints

**POST /api/affiliate/register** - Affiliate Self-Registration

```typescript
Request:
{
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe",
  "country": "US",                           // ISO code
  "facebookUrl": "https://facebook.com/john", // Optional
  "instagramUrl": "...",                     // Optional
  "paymentMethod": "CRYPTO",                 // BANK_TRANSFER | CRYPTO | GLOBAL_WALLET | LOCAL_WALLET

  // Payment details based on method (CRYPTO example):
  "cryptoWalletAddress": "TXa1b2c3...",
  "cryptoNetwork": "TRC20"
}

Response (201):
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "affiliateId": "clx...",
  "email": "john@example.com"
}

// System automatically:
// 1. Sends email verification link
// 2. Creates affiliate record with status: PENDING_VERIFICATION
// 3. Does NOT generate codes yet (wait for email verification)
```

**POST /api/affiliate/verify-email** - Email Verification

```typescript
Request:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // From email link
}

Response (200):
{
  "success": true,
  "message": "Email verified successfully. 15 codes have been generated for you.",
  "affiliateId": "clx...",
  "codesGenerated": 15
}

// System automatically:
// 1. Updates status: PENDING_VERIFICATION → ACTIVE
// 2. Generates 15 discount codes
// 3. Sends welcome email with dashboard link
```

**POST /api/affiliate/login** - Affiliate Login

```typescript
Request:
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // JWT token
  "affiliate": {
    "id": "clx...",
    "email": "john@example.com",
    "fullName": "John Doe",
    "status": "ACTIVE"
  }
}

Response (401) - Invalid Credentials:
{
  "error": "Invalid email or password"
}

Response (403) - Email Not Verified:
{
  "error": "Please verify your email before logging in",
  "emailVerified": false
}
```

**POST /api/affiliate/forgot-password** - Password Reset Request

```typescript
Request:
{
  "email": "john@example.com"
}

Response (200):
{
  "success": true,
  "message": "Password reset link sent to your email"
}
```

**POST /api/affiliate/reset-password** - Reset Password

```typescript
Request:
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword123!"
}

Response (200):
{
  "success": true,
  "message": "Password reset successfully"
}
```

### 5.2 Affiliate Dashboard Endpoints

**GET /api/affiliate/dashboard** - Dashboard Overview

```typescript
Headers:
  Authorization: Bearer <affiliate_token>

Response (200):
{
  "affiliate": {
    "id": "clx...",
    "fullName": "John Doe",
    "email": "john@example.com",
    "country": "US"
  },
  "summary": {
    "activeCodes": 12,
    "usedCodes": 3,
    "expiredCodes": 5,
    "pendingCommission": 20.88,
    "paidCommission": 69.60,
    "totalEarnings": 90.48,
    "thisMonthConversions": 3
  },
  "recentActivity": [
    {
      "type": "CODE_USED",
      "code": "SxTYo25#1dpgiNguD",
      "user": "user@example.com",
      "amount": 6.96,
      "date": "2025-11-14T10:00:00Z"
    }
  ]
}
```

**GET /api/affiliate/codes/inventory** - Code Inventory Report

```typescript
Headers:
  Authorization: Bearer <affiliate_token>

Query Params:
- month: "2025-11"  // Specific month, or current month if not provided

Response (200):
{
  "month": "2025-11",
  "report": {
    "openingBalance": 10,
    "received": 15,
    "used": 3,
    "expired": 5,
    "cancelled": 2,
    "closingBalance": 15
  },
  "drillDown": {
    "receivedCodes": [
      {
        "code": "SxTYo25#1dpgiNguD",
        "receivedAt": "2025-11-01T00:00:00Z",
        "expiresAt": "2025-11-30T23:59:59Z",
        "status": "ACTIVE"
      }
      // ... 14 more
    ],
    "usedCodes": [
      {
        "code": "ABC123DEF456GHI",
        "usedBy": "user@example.com",
        "usedAt": "2025-11-05T14:30:00Z",
        "commission": 6.96
      }
      // ... 2 more
    ],
    "expiredCodes": [
      // ... 5 expired codes
    ],
    "cancelledCodes": [
      {
        "code": "XYZ789...",
        "cancelledBy": "admin@platform.com",
        "cancelledAt": "2025-11-15T09:00:00Z",
        "reason": "Suspected fraudulent use"
      }
      // ... 1 more
    ]
  }
}
```

**GET /api/affiliate/commissions/receivable** - Commission Receivable Report

```typescript
Headers:
  Authorization: Bearer <affiliate_token>

Query Params:
- month: "2025-11"

Response (200):
{
  "month": "2025-11",
  "report": {
    "openingBalance": 15.50,
    "earned": 20.88,
    "paid": 15.50,
    "closingBalance": 20.88
  },
  "drillDown": {
    "earnedCommissions": [
      {
        "id": "clx1...",
        "code": "SxTYo25#1dpgiNguD",
        "user": "user@example.com",
        "amount": 6.96,
        "earnedAt": "2025-11-05T14:30:00Z",
        "status": "PENDING"
      },
      {
        "id": "clx2...",
        "code": "ABC123DEF456GHI",
        "user": "user2@example.com",
        "amount": 6.96,
        "earnedAt": "2025-11-12T09:15:00Z",
        "status": "PENDING"
      },
      {
        "id": "clx3...",
        "code": "XYZ789GHI012JKL",
        "user": "user3@example.com",
        "amount": 6.96,
        "earnedAt": "2025-11-20T16:45:00Z",
        "status": "PENDING"
      }
    ],
    "paidCommissions": [
      {
        "id": "clx_old1...",
        "amount": 15.50,
        "paidAt": "2025-11-05T10:00:00Z",
        "paymentReference": "PayPal: TXN123456789",
        "paymentMethod": "CRYPTO",
        "month": "2025-10"
      }
    ]
  }
}
```

**GET /api/affiliate/profile** - Get Affiliate Profile

```typescript
Headers:
  Authorization: Bearer <affiliate_token>

Response (200):
{
  "id": "clx...",
  "email": "john@example.com",
  "fullName": "John Doe",
  "country": "US",
  "socialMedia": {
    "facebook": "https://facebook.com/john",
    "instagram": "https://instagram.com/john",
    "twitter": null,
    "youtube": null,
    "tiktok": null
  },
  "paymentMethod": "CRYPTO",
  "paymentDetails": {
    "cryptoWalletAddress": "TXa1b2c3...",
    "cryptoNetwork": "TRC20"
  },
  "taxInfo": {
    "taxId": "US123456789",
    "vatNumber": null
  },
  "status": "ACTIVE",
  "createdAt": "2025-10-01T00:00:00Z"
}
```

**PATCH /api/affiliate/profile** - Update Profile

```typescript
Headers:
  Authorization: Bearer <affiliate_token>

Request:
{
  "fullName": "John Updated Doe",  // Optional
  "country": "GB",                 // Optional
  "facebookUrl": "...",            // Optional
  "paymentMethod": "GLOBAL_WALLET",// If changing payment method
  "paypalEmail": "john@paypal.com" // New payment details
}

Response (200):
{
  "success": true,
  "message": "Profile updated successfully",
  "affiliate": { /* updated profile */ }
}
```

### 5.3 Admin Affiliate Management Endpoints

**GET /api/admin/affiliates** - List All Affiliates

```typescript
Headers:
  Authorization: Bearer <admin_token>

Query Params:
- status: "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED" | "TERMINATED" | "all"
- page: 1
- limit: 50
- search: "john@example.com" | "John Doe"

Response (200):
{
  "affiliates": [
    {
      "id": "clx...",
      "email": "john@example.com",
      "fullName": "John Doe",
      "country": "US",
      "status": "ACTIVE",
      "activeCodes": 12,
      "totalConversions": 25,
      "totalEarnings": 174.00,
      "pendingCommission": 20.88,
      "createdAt": "2025-10-01T00:00:00Z"
    }
    // ... more affiliates
  ],
  "total": 150,
  "page": 1,
  "pages": 3
}
```

**GET /api/admin/affiliates/:id** - Get Affiliate Details

```typescript
Headers:
  Authorization: Bearer <admin_token>

Response (200):
{
  "affiliate": {
    "id": "clx...",
    "email": "john@example.com",
    "fullName": "John Doe",
    "country": "US",
    "socialMedia": { /* ... */ },
    "paymentMethod": "CRYPTO",
    "paymentDetails": { /* ... */ },
    "status": "ACTIVE",
    "createdAt": "2025-10-01T00:00:00Z"
  },
  "stats": {
    "activeCodes": 12,
    "usedCodes": 25,
    "expiredCodes": 48,
    "cancelledCodes": 2,
    "totalConversions": 25,
    "totalEarnings": 174.00,
    "pendingCommission": 20.88,
    "paidCommission": 153.12
  },
  "recentConversions": [
    {
      "code": "SxTYo25#1dpgiNguD",
      "user": "user@example.com",
      "amount": 6.96,
      "date": "2025-11-14T10:00:00Z"
    }
    // ... last 10 conversions
  ]
}
```

**POST /api/admin/affiliates/:id/distribute-codes** - Manual Code Distribution

```typescript
Headers:
  Authorization: Bearer <admin_token>

Request:
{
  "count": 15,                    // Number of codes to generate
  "discountPercent": 20,          // Discount %
  "commissionPercent": 30         // Commission %
}

Response (201):
{
  "success": true,
  "codesGenerated": 15,
  "codes": [
    "SxTYo25#1dpgiNguD",
    "ABC123DEF456GHI",
    // ... 13 more
  ],
  "affiliateEmail": "john@example.com",
  "emailSent": true
}
```

**PATCH /api/admin/affiliates/:id/status** - Update Affiliate Status

```typescript
Headers:
  Authorization: Bearer <admin_token>

Request:
{
  "status": "SUSPENDED",  // ACTIVE | SUSPENDED | TERMINATED
  "reason": "Suspected fraudulent activity"
}

Response (200):
{
  "success": true,
  "affiliate": {
    "id": "clx...",
    "status": "SUSPENDED",
    "updatedAt": "2025-11-14T10:00:00Z"
  }
}
```

**POST /api/admin/affiliates/codes/:id/cancel** - Cancel Specific Code

```typescript
Headers:
  Authorization: Bearer <admin_token>

Request:
{
  "reason": "Code leaked publicly"
}

Response (200):
{
  "success": true,
  "code": {
    "id": "clx...",
    "code": "SxTYo25#1dpgiNguD",
    "status": "CANCELLED",
    "cancelledBy": "admin_id",
    "cancelledAt": "2025-11-14T10:00:00Z",
    "cancellationReason": "Code leaked publicly"
  }
}
```

### 5.4 Admin Reporting Endpoints (Business Intelligence)

**GET /api/admin/reports/profit-loss** - Profit & Loss Report (3 Months)

```typescript
Headers:
  Authorization: Bearer <admin_token>

Query Params:
- months: 3  // Number of months to include (default 3)

Response (200):
{
  "reportPeriod": "September 2025 - November 2025",
  "monthlyData": [
    {
      "month": "2025-09",
      "revenue": 2900.00,        // Total PRO subscriptions sold (100 × $29)
      "discounts": 580.00,       // Total discounts given (20 codes × 20% × $29)
      "netRevenue": 2320.00,     // revenue - discounts
      "commissions": 696.00,     // Total commissions owed (20 × $6.96)
      "profit": 1624.00,         // netRevenue - commissions
      "profitMargin": 70.0       // (profit / netRevenue) × 100
    },
    {
      "month": "2025-10",
      "revenue": 3480.00,
      "discounts": 696.00,
      "netRevenue": 2784.00,
      "commissions": 835.20,
      "profit": 1948.80,
      "profitMargin": 70.0
    },
    {
      "month": "2025-11",
      "revenue": 4060.00,
      "discounts": 812.00,
      "netRevenue": 3248.00,
      "commissions": 974.40,
      "profit": 2273.60,
      "profitMargin": 70.0
    }
  ],
  "summary": {
    "totalRevenue": 10440.00,
    "totalDiscounts": 2088.00,
    "totalNetRevenue": 8352.00,
    "totalCommissions": 2505.60,
    "totalProfit": 5846.40,
    "avgProfitMargin": 70.0,
    "totalConversions": 360,
    "avgRevenuePerConversion": 29.00
  },
  "chartData": {
    "labels": ["Sep", "Oct", "Nov"],
    "revenue": [2900, 3480, 4060],
    "profit": [1624, 1949, 2274]
  }
}
```

**GET /api/admin/reports/sales-performance** - Sales Performance by Affiliate

```typescript
Headers:
  Authorization: Bearer <admin_token>

Query Params:
- month: "2025-11"  // Specific month, or current month if not provided
- sortBy: "revenue" | "conversions" | "commission"  // Default: revenue DESC
- page: 1
- limit: 50

Response (200):
{
  "month": "2025-11",
  "affiliates": [
    {
      "affiliateId": "clx1...",
      "affiliateName": "John Doe",
      "affiliateEmail": "john@example.com",
      "conversions": 25,
      "totalRevenue": 580.00,       // Sum of discountedPrice from conversions
      "totalDiscount": 145.00,      // Sum of discount amounts given
      "totalCommission": 174.00,    // Sum of commission earned
      "avgDiscount": 20.0,          // Average discount %
      "avgCommission": 30.0,        // Average commission %
      "conversionValue": 23.20      // Avg revenue per conversion
    },
    {
      "affiliateId": "clx2...",
      "affiliateName": "Jane Smith",
      "affiliateEmail": "jane@example.com",
      "conversions": 18,
      "totalRevenue": 417.60,
      "totalDiscount": 104.40,
      "totalCommission": 125.28,
      "avgDiscount": 20.0,
      "avgCommission": 30.0,
      "conversionValue": 23.20
    }
    // ... more affiliates
  ],
  "totals": {
    "totalConversions": 140,
    "totalRevenue": 3248.00,
    "totalDiscount": 812.00,
    "totalCommission": 974.40,
    "avgConversionsPerAffiliate": 9.3
  },
  "drillDown": {
    "availableFor": ["clx1...", "clx2...", ...]  // Affiliate IDs with detail views
  }
}
```

**GET /api/admin/reports/sales-performance/:affiliateId** - Drill-down: Affiliate Detail

```typescript
Headers:
  Authorization: Bearer <admin_token>

Path Params:
- affiliateId: "clx1..."

Query Params:
- month: "2025-11"

Response (200):
{
  "affiliate": {
    "id": "clx1...",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "month": "2025-11",
  "conversions": [
    {
      "date": "2025-11-05T14:30:00Z",
      "code": "SxTYo25#1dpgiNguD",
      "user": "user1@example.com",
      "regularPrice": 29.00,
      "discountPercent": 20,
      "discountedPrice": 23.20,
      "commissionPercent": 30,
      "commissionAmount": 6.96
    },
    {
      "date": "2025-11-12T09:15:00Z",
      "code": "ABC123DEF456GHI",
      "user": "user2@example.com",
      "regularPrice": 29.00,
      "discountPercent": 20,
      "discountedPrice": 23.20,
      "commissionPercent": 30,
      "commissionAmount": 6.96
    }
    // ... 23 more conversions
  ],
  "summary": {
    "totalConversions": 25,
    "totalRevenue": 580.00,
    "totalCommission": 174.00
  }
}
```

**GET /api/admin/reports/commission-owings** - Commission Owings Report

```typescript
Headers:
  Authorization: Bearer <admin_token>

Query Params:
- status: "PENDING" | "all"  // Default: PENDING only
- sortBy: "amount" | "affiliate" | "date"  // Default: amount DESC

Response (200):
{
  "reportDate": "2025-11-14T10:00:00Z",
  "affiliates": [
    {
      "affiliateId": "clx1...",
      "affiliateName": "John Doe",
      "affiliateEmail": "john@example.com",
      "pendingAmount": 174.00,
      "oldestUnpaidDate": "2025-10-05T14:30:00Z",  // Oldest PENDING commission
      "pendingCount": 25,
      "paymentMethod": "CRYPTO",
      "paymentDetails": {
        "cryptoWalletAddress": "TXa1b2c3...",
        "cryptoNetwork": "TRC20"
      }
    },
    {
      "affiliateId": "clx2...",
      "affiliateName": "Jane Smith",
      "affiliateEmail": "jane@example.com",
      "pendingAmount": 125.28,
      "oldestUnpaidDate": "2025-10-12T11:20:00Z",
      "pendingCount": 18,
      "paymentMethod": "GLOBAL_WALLET",
      "paymentDetails": {
        "paypalEmail": "jane@paypal.com"
      }
    }
    // ... more affiliates
  ],
  "totals": {
    "totalOwed": 1248.00,
    "totalAffiliates": 15,
    "totalCommissions": 180,
    "byPaymentMethod": {
      "BANK_TRANSFER": 350.00,
      "CRYPTO": 450.00,
      "GLOBAL_WALLET": 348.00,
      "LOCAL_WALLET": 100.00
    }
  },
  "actions": {
    "bulkPayUrl": "/api/admin/reports/commission-owings/bulk-pay"
  }
}
```

**POST /api/admin/reports/commission-owings/bulk-pay** - Bulk Pay Commissions

```typescript
Headers:
  Authorization: Bearer <admin_token>

Request:
{
  "commissionIds": ["clx1...", "clx2...", "clx3..."],  // IDs to mark as paid
  "paymentReference": "PayPal Batch: BATCH123456",      // External reference
  "paymentNotes": "Paid via PayPal on 2025-12-05"      // Optional notes
}

Response (200):
{
  "success": true,
  "paidCount": 43,
  "totalAmount": 299.28,
  "paidAt": "2025-12-05T10:00:00Z",
  "affiliatesNotified": 3,  // Number of emails sent
  "details": [
    {
      "affiliateId": "clx1...",
      "affiliateName": "John Doe",
      "amount": 174.00,
      "commissionsCount": 25
    },
    {
      "affiliateId": "clx2...",
      "affiliateName": "Jane Smith",
      "amount": 125.28,
      "commissionsCount": 18
    }
  ]
}
```

**GET /api/admin/reports/aggregate-code-inventory** - Aggregate Code Inventory (All Affiliates)

```typescript
Headers:
  Authorization: Bearer <admin_token>

Query Params:
- month: "2025-11"  // Specific month, or current month if not provided

Response (200):
{
  "month": "2025-11",
  "aggregateReport": {
    "totalAffiliates": 15,
    "openingBalance": 150,    // All affiliates at start of month
    "distributed": 225,       // 15 affiliates × 15 codes
    "used": 140,
    "expired": 80,
    "cancelled": 5,
    "closingBalance": 150     // Active codes at end of month
  },
  "byStatus": {
    "ACTIVE": 150,
    "USED": 140,
    "EXPIRED": 80,
    "CANCELLED": 5
  },
  "topPerformingAffiliates": [
    {
      "affiliateId": "clx1...",
      "affiliateName": "John Doe",
      "usedCodes": 25,
      "conversionRate": 55.5    // (used / (received - expired - cancelled)) × 100
    },
    {
      "affiliateId": "clx2...",
      "affiliateName": "Jane Smith",
      "usedCodes": 18,
      "conversionRate": 42.9
    }
    // ... top 10
  ],
  "chartData": {
    "labels": ["Active", "Used", "Expired", "Cancelled"],
    "values": [150, 140, 80, 5]
  },
  "trendData": {
    "labels": ["Sep", "Oct", "Nov"],
    "distributed": [180, 210, 225],
    "used": [95, 110, 140],
    "conversionRate": [38.5, 40.7, 46.7]
  }
}
```

### 5.5 Public Endpoints (Code Validation for Checkout)

**POST /api/public/validate-code** - Validate Discount Code (for checkout)

```typescript
Headers:
  Authorization: Bearer <user_token>  // Regular user token (FREE tier)

Request:
{
  "code": "SxTYo25#1dpgiNguD"
}

Response (200) - Valid:
{
  "valid": true,
  "code": "SxTYo25#1dpgiNguD",
  "discountPercent": 20,
  "originalPrice": 29.00,
  "discountedPrice": 23.20,
  "savings": 5.80,
  "expiresAt": "2025-11-30T23:59:59Z",
  "affiliateName": "John Doe"  // Optional: show who shared the code
}

Response (400) - Invalid (Code doesn't exist):
{
  "valid": false,
  "error": "INVALID_CODE",
  "message": "Invalid discount code"
}

Response (400) - Expired:
{
  "valid": false,
  "error": "CODE_EXPIRED",
  "message": "This code expired on 2025-10-31"
}

Response (400) - Already Used:
{
  "valid": false,
  "error": "CODE_USED",
  "message": "This code has already been used"
}

Response (400) - Cancelled:
{
  "valid": false,
  "error": "CODE_CANCELLED",
  "message": "This code is no longer active"
}

Response (403) - User Not Eligible (REMOVED - All users can apply codes):
// This error response is NO LONGER USED
// Both FREE and PRO users can apply discount codes
// FREE users: Apply at initial signup
// PRO users: Apply at monthly renewal

Response (200):
{
  "codes": [
    {
      "id": "clx...",
      "code": "SAVE20PRO",
      "discountPercent": 20,
      "commissionPercent": 30,
      "affiliateEmail": "affiliate@example.com",
      "expiresAt": "2025-12-31T23:59:59Z",
      "isActive": true,
      "usageCount": 5,              // Calculated from Commission table
      "totalCommissions": 34.80     // Sum of commission amounts
    }
  ],
  "total": 25,
  "page": 1,
  "pages": 1
}
```

**PATCH /api/admin/affiliate/codes/:id** - Update Code

```typescript
Request:
{
  "isActive": false  // Disable code
}

Response (200):
{
  "id": "clx...",
  "code": "SAVE20PRO",
  "isActive": false,  // Updated
  "updatedAt": "2025-11-14T11:00:00Z"
}
```

**GET /api/admin/affiliate/commissions** - Commission Report

```typescript
Query Params:
- status: "PENDING" | "PAID" | "CANCELLED" | "all"
- month: "2025-11"  // Filter by month
- affiliateEmail: "affiliate@example.com"
- page: 1
- limit: 100

Response (200):
{
  "commissions": [
    {
      "id": "clx...",
      "code": "SAVE20PRO",
      "affiliateEmail": "affiliate@example.com",
      "userName": "John Doe",
      "userEmail": "john@example.com",
      "regularPrice": 29.00,
      "discountedPrice": 23.20,
      "commissionAmount": 6.96,
      "status": "PENDING",
      "createdAt": "2025-11-14T10:00:00Z"
    }
  ],
  "summary": {
    "totalCommissions": 139.20,
    "pendingAmount": 69.60,
    "paidAmount": 69.60,
    "count": 20
  }
}
```

**POST /api/admin/affiliate/commissions/bulk-pay** - Mark as Paid

```typescript
Request:
{
  "commissionIds": ["clx1...", "clx2...", "clx3..."],
  "note": "Paid via PayPal on 2025-12-05"
}

Response (200):
{
  "updated": 3,
  "totalAmount": 20.88,
  "paidAt": "2025-12-05T10:00:00Z"
}
```

### 5.2 Public Endpoints

**POST /api/affiliate/validate-code** - Validate Discount Code

```typescript
Request:
{
  "code": "SAVE20PRO"
}

Response (200) - Valid:
{
  "valid": true,
  "code": "SAVE20PRO",
  "discountPercent": 20,
  "originalPrice": 29.00,
  "discountedPrice": 23.20,
  "savings": 5.80,
  "expiresAt": "2025-12-31T23:59:59Z"
}

Response (400) - Invalid:
{
  "valid": false,
  "error": "Code expired",
  "message": "This discount code expired on 2025-10-31"
}
```

**GET /api/affiliate/my-commissions** - Affiliate's Earnings (Future)

```typescript
// Optional: Allow affiliates to log in and view their earnings
Headers:
  Authorization: Bearer <affiliate_token>

Response (200):
{
  "codes": [
    {
      "code": "SAVE20PRO",
      "usageCount": 5,
      "pendingCommissions": 34.80,
      "paidCommissions": 69.60,
      "totalEarnings": 104.40
    }
  ],
  "summary": {
    "totalPending": 34.80,
    "totalPaid": 69.60,
    "allTimeEarnings": 104.40
  }
}
```

### 5.3 Modified Endpoints

**POST /api/checkout/create-session** - Update for Discount Codes

```typescript
Request:
{
  "priceId": "price_...",
  "discountCode": "SAVE20PRO"  // NEW: Optional discount code
}

Response (200):
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/...",
  "discountApplied": {
    "code": "SAVE20PRO",
    "discountPercent": 20,
    "originalPrice": 29.00,
    "finalPrice": 23.20
  }
}
```

---

## 6. USER FLOWS

### 6.1 FREE User Applies Discount Code at Signup

```
1. User (FREE tier) navigates to /pricing
   ↓
2. Clicks "Upgrade to PRO" button
   ↓
3. Checkout page displays:
   - Regular price: $29.00/month
   - Input field: "Have a discount code?"
   ↓
4. User enters: "SMITH-ABC123" (Affiliate B's code)
   ↓
5. Client calls: POST /api/affiliate/validate-code
   ↓
6. API validates:
   ✅ Code exists
   ✅ Code status = ACTIVE
   ✅ Code not expired (expiresAt > now)
   ✅ Code not used (usedBy = null)
   ✅ Code is NEW (generated current month)
   ↓
7. If valid → Show discounted price:
   "Regular: $29.00
    Discount (20%): -$5.80
    You pay: $23.20/month"
   ↓
8. User clicks "Proceed to Payment"
   ↓
9. Client calls: POST /api/checkout/create-session
   {
     "priceId": "price_pro_monthly",
     "discountCode": "SAVE20PRO"
   }
   ↓
10. Server creates Stripe checkout with:
    - Custom unit_amount: 2320 (cents)
    - Metadata: { discountCode: "SAVE20PRO", codeId: "clx..." }
    ↓
11. User completes Stripe payment
    ↓
12. Stripe webhook fires: checkout.session.completed
    ↓
13. Webhook handler:
    a. Create/update Subscription record
    b. Upgrade user.tier to "PRO"
    c. Extract metadata.discountCode
    d. Create Commission record:
       {
         codeId: "clx...",
         userId: "user123",
         subscriptionId: "sub_...",
         regularPrice: 29.00,
         discountPercent: 20,
         discountedPrice: 23.20,
         commissionPercent: 30,
         commissionAmount: 6.96,
         status: "PENDING"
       }
    e. Send email to affiliate: "Code SAVE20PRO used successfully!"
    ↓
14. User receives confirmation email
15. User tier upgraded to PRO
16. Commission tracked for affiliate
```

### 6.2 PRO User Applies Discount Code Before Auto-Renewal (MONTHLY COMPETITION)

**IMPORTANT:** Subscriptions AUTO-RENEW monthly. Users stay subscribed even without codes.
Users can optionally enter codes in billing dashboard to save 20% on next renewal.

```
SCENARIO: User A used Affiliate B's code in Month 1
          Now it's Month 2, User A finds Affiliate C's code on Instagram
          Affiliates B and C compete for this month's commission

MONTH 2 RENEWAL CYCLE:

Day -10 (10 days before renewal):
1. User A (PRO tier) receives first reminder email:
   "Your PRO subscription renews on Dec 5 for $29.00"
   "💡 Save 20%! Enter an affiliate code in your billing settings"
   [Enter Code Now] button → Links to /dashboard/billing
   ↓
2. User A also sees in-app notification:
   "💡 Renewal in 10 days - Save $5.80 with a code!"
   ↓

Day -7 (7 days before renewal):
3. User A receives second reminder email:
   "One week until renewal - $29.00 scheduled"
   "Find a code to pay only $23.20!"
   ↓

Day -5:
4. User A follows Affiliate C on Instagram
   ↓
5. Affiliate C posts: "Use code JONES-XYZ789 to save 20% this month!"
   ↓
6. User A copies code: "JONES-XYZ789"
   ↓
7. User navigates to /dashboard/billing
   ↓
8. Billing dashboard displays:
   ┌────────────────────────────────────────────┐
   │ 💳 Your Subscription                       │
   │                                             │
   │ PRO Plan - Monthly                         │
   │ Status: Active (Auto-renews)               │
   │                                             │
   │ Next Billing Date: Dec 5, 2025             │
   │ Next Billing Amount: $29.00                │
   │                                             │
   │ 💡 Save 20% on Next Payment                │
   │ [Enter code here____] [Apply Code]         │
   └────────────────────────────────────────────┘
   ↓
9. User enters "JONES-XYZ789" and clicks "Apply Code"
   ↓
10. Frontend calls: POST /api/user/billing/apply-code
    Body: { "code": "JONES-XYZ789" }
    ↓
11. API validates code:
    ✅ Code exists
    ✅ Code status = ACTIVE
    ✅ Code not expired (expiresAt = Dec 31)
    ✅ Code not used (usedBy = null)
    ✅ Code is NEW (generated Dec 1)
    ↓
12. If valid → API saves code for next billing:
    a. Update Stripe subscription metadata:
       {
         nextBillingCode: "JONES-XYZ789",
         nextBillingCodeId: "clx...",
         affiliateName: "John Jones"
       }
    b. Update Subscription record:
       nextBillingCodeId: "clx..."
    ↓
13. API returns success:
    {
      "success": true,
      "message": "Code will be applied on Dec 5",
      "nextBillingAmount": 23.20,
      "savings": 5.80
    }
    ↓
14. Dashboard updates to show:
    ┌────────────────────────────────────────────┐
    │ 💳 Your Subscription                       │
    │                                             │
    │ PRO Plan - Monthly                         │
    │ Status: Active (Auto-renews)               │
    │                                             │
    │ Next Billing Date: Dec 5, 2025             │
    │ Next Billing Amount: $23.20 (20% off!) 🎉 │
    │ ↑ Was: $29.00 | You save: $5.80           │
    │                                             │
    │ ✅ Code Applied: JONES-XYZ789              │
    │ Affiliate: John Jones                       │
    │ [Remove Code]                               │
    └────────────────────────────────────────────┘
    ↓

Day 0 (Renewal date - Dec 5):
15. Stripe auto-renewal triggers (scheduled charge)
    ↓
16. Stripe webhook fires: invoice.payment_succeeded
    ↓
17. Webhook handler checks subscription metadata:
    nextBillingCode = "JONES-XYZ789" (exists!)
    ↓
18. Webhook retrieves code from database:
    code = await prisma.affiliateCode.findUnique({
      where: { code: "JONES-XYZ789" }
    })
    ↓
19. Webhook calculates commission:
    regularPrice: 29.00
    discountedPrice: 29.00 × 0.8 = 23.20
    commissionAmount: 23.20 × 0.20 = 4.64
    ↓
20. Webhook creates Commission record:
    {
      affiliateId: "affiliate_C_id",
      codeId: "clx...",
      userId: "user_A_id",
      subscriptionId: "sub_...",
      regularPrice: 29.00,
      discountPercent: 20,
      discountedPrice: 23.20,
      commissionPercent: 20,
      commissionAmount: 4.64,
      status: "PENDING"
    }
    ↓
21. Webhook marks code as USED:
    - status: ACTIVE → USED
    - usedBy: "user_A_id"
    - usedAt: current timestamp
    ↓
22. Webhook clears code from subscription metadata:
    nextBillingCode: null
    nextBillingCodeId: null
    (Code is one-time use, user needs new code next month)
    ↓
23. User is charged $23.20 (discounted price)
    ↓
24. Affiliate C receives email:
    "🎉 Code JONES-XYZ789 used! Commission earned: $4.64"
    ↓
25. User receives email:
    "✅ Subscription renewed for $23.20 (saved $5.80!)"
    "Code used: JONES-XYZ789"
    "💡 Want to save again next month? Find a new code!"
    ↓
26. Affiliate B gets NOTHING this month (User switched to Affiliate C)
    ↓

MONTH 3 (Next cycle):
27. User A can:
    - Enter Affiliate D's new code → Save $5.80
    - Enter Affiliate B's new code → Save $5.80
    - Enter Affiliate C's new code → Save $5.80
    - Enter NO code → Pay $29.00 full price
    ↓
28. Affiliates compete again for Month 3 commission
29. Cycle repeats monthly
30. User NEVER loses access (auto-renewal continues regardless)

RESULT:
✅ Monthly affiliate competition drives social media engagement
✅ Users incentivized to find codes (save money)
✅ Users stay subscribed even if they skip finding codes
✅ Low churn (auto-renewal)
✅ Flexible for users (optional codes)
```

### 6.3 Invalid Code Scenarios

**Scenario A: Code doesn't exist**

```
User enters: "FAKE123"
API Response (400):
{
  "valid": false,
  "error": "invalid_code",
  "message": "Invalid discount code"
}
UI: Show error message below input field
```

**Scenario B: Code expired**

```
User enters: "EXPIRED2024"
API Response (400):
{
  "valid": false,
  "error": "code_expired",
  "message": "This code expired on 2024-12-31"
}
```

**Scenario C: PRO User at Renewal (NOW VALID)**

```
User tier: PRO (at renewal checkout)
User enters: "SAVE20PRO" (NEW, UNUSED code from current month)
API Response (200):
{
  "valid": true,
  "code": "SAVE20PRO",
  "discountPercent": 20,
  "originalPrice": 29.00,
  "discountedPrice": 23.20,
  "savings": 5.80,
  "expiresAt": "2025-11-30T23:59:59Z",
  "message": "Code applied! Your renewal will be $23.20 instead of $29.00"
}
```

**Scenario D: Code disabled by admin**

```
User enters: "DISABLED123"
API Response (400):
{
  "valid": false,
  "error": "code_disabled",
  "message": "This discount code is no longer active"
}
```

---

## 7. ADMIN WORKFLOWS

### 7.1 Create New Discount Code

```
Admin Dashboard → Affiliates → Create Code

1. Click "Create New Code" button
   ↓
2. Form displays:
   - Code (auto-generated or custom): [SAVE20PRO]
   - Discount Percentage: [20] % (max 50%)
   - Commission Percentage: [30] % (max 50%)
   - Affiliate Email: [affiliate@example.com]
   - Expiry Date: [2025-12-31] (optional)
   ↓
3. Admin fills form and clicks "Create"
   ↓
4. Client validates:
   - Discount 0-50%
   - Commission 0-50%
   - Valid email format
   - Expiry date in future (if provided)
   ↓
5. POST /api/admin/affiliate/codes
   ↓
6. Server:
   - Checks code uniqueness
   - Creates AffiliateCode record
   - Returns created code
   ↓
7. UI shows success message + new code in table
   ↓
8. Admin can copy code and send to affiliate marketer
```

### 7.2 Disable/Enable Code

```
Admin Dashboard → Affiliates → Codes List

1. View table of all codes
   ↓
2. Find code to disable (e.g., "SAVE20PRO")
   ↓
3. Click toggle switch: Active → Inactive
   ↓
4. Confirmation dialog: "Disable code SAVE20PRO?"
   ↓
5. PATCH /api/admin/affiliate/codes/:id
   { "isActive": false }
   ↓
6. Code status updated
   ↓
7. Future validation requests for this code will fail
   (Existing subscriptions not affected)
```

### 7.3 Monthly Commission Payout

```
First week of December 2025:

1. Admin logs in to dashboard
   ↓
2. Navigate: Dashboard → Affiliates → Commissions
   ↓
3. Filter by:
   - Status: PENDING
   - Month: November 2025
   ↓
4. View report showing:

   Affiliate          | Conversions | Total Commission
   ------------------ | ----------- | ----------------
   affiliate1@x.com   | 5           | $34.80
   affiliate2@x.com   | 3           | $20.88
   affiliate3@x.com   | 2           | $13.92
   ------------------ | ----------- | ----------------
   TOTAL              | 10          | $69.60
   ↓
5. Admin makes external payments:
   - PayPal transfer to affiliate1@x.com: $34.80
   - PayPal transfer to affiliate2@x.com: $20.88
   - PayPal transfer to affiliate3@x.com: $13.92
   ↓
6. Admin returns to dashboard:
   - Select all November commissions
   - Click "Mark as Paid"
   - Add note: "Paid via PayPal on 2025-12-05"
   ↓
7. POST /api/admin/affiliate/commissions/bulk-pay
   {
     "commissionIds": ["clx1", "clx2", ..., "clx10"],
     "note": "Paid via PayPal on 2025-12-05"
   }
   ↓
8. Server updates all commissions:
   - status: PENDING → PAID
   - paidAt: 2025-12-05T10:00:00Z
   - paidBy: admin_user_id
   ↓
9. System sends emails to all affiliates:

   Subject: "Your November commission has been paid"
   Body:
   "Hi,

   Your affiliate commission for November 2025 has been paid.

   Code: SAVE20PRO
   Conversions: 5
   Amount Paid: $34.80
   Payment Method: PayPal

   Thank you for promoting Trading Alerts!"
   ↓
10. Commission balances cleared
11. Repeat next month
```

---

## 8. COMMISSION CALCULATION LOGIC

### 8.1 Calculation Function

**File:** `lib/affiliate/commission.ts`

```typescript
export interface CommissionCalculation {
  regularPrice: number;
  discountPercent: number;
  discountedPrice: number;
  commissionPercent: number;
  commissionAmount: number;
  savings: number;
}

export function calculateCommission(
  regularPrice: number, // 29.00
  discountPercent: number, // 20
  commissionPercent: number // 30
): CommissionCalculation {
  // Validate inputs
  if (discountPercent < 0 || discountPercent > 50) {
    throw new Error('Discount must be 0-50%');
  }

  if (commissionPercent < 0 || commissionPercent > 50) {
    throw new Error('Commission must be 0-50%');
  }

  // Calculate discounted price
  const discountAmount = regularPrice * (discountPercent / 100);
  const discountedPrice = regularPrice - discountAmount;

  // Calculate commission
  const commissionAmount = discountedPrice * (commissionPercent / 100);

  return {
    regularPrice: parseFloat(regularPrice.toFixed(2)),
    discountPercent,
    discountedPrice: parseFloat(discountedPrice.toFixed(2)),
    commissionPercent,
    commissionAmount: parseFloat(commissionAmount.toFixed(2)),
    savings: parseFloat(discountAmount.toFixed(2)),
  };
}

// Example usage
const result = calculateCommission(29.0, 20, 30);
console.log(result);
// {
//   regularPrice: 29.00,
//   discountPercent: 20,
//   discountedPrice: 23.20,
//   commissionPercent: 30,
//   commissionAmount: 6.96,
//   savings: 5.80
// }
```

### 8.2 Edge Cases

**Case 1: 0% Discount (Code gives commission only)**

```typescript
calculateCommission(29.0, 0, 30);
// Result:
// discountedPrice: 29.00
// commissionAmount: 8.70
// User pays full price, affiliate still earns
```

**Case 2: 50% Discount (Maximum)**

```typescript
calculateCommission(29.0, 50, 40);
// Result:
// discountedPrice: 14.50
// commissionAmount: 5.80
```

**Case 3: 0% Commission (Pure discount, no affiliate)**

```typescript
calculateCommission(29.0, 15, 0);
// Result:
// discountedPrice: 24.65
// commissionAmount: 0.00
// Useful for admin promo codes
```

---

## 9. SECURITY CONSIDERATIONS

### 9.1 Code Generation

**Secure Random Code:**

```typescript
import crypto from 'crypto';

export function generateDiscountCode(prefix: string = 'TRADE'): string {
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${random}`;
}

// Examples:
// TRADE8A3B2C1D
// SAVE4F9E1A7B
// PRO20256D8C4A
```

**Uniqueness Check:**

```typescript
async function createCode(data: CreateCodeRequest) {
  let code = data.code || generateDiscountCode();

  // Ensure uniqueness
  const existing = await prisma.affiliateCode.findUnique({
    where: { code },
  });

  if (existing) {
    throw new Error('Code already exists');
  }

  return prisma.affiliateCode.create({ data: { ...data, code } });
}
```

### 9.2 Validation Security

**Rate Limiting:**

```typescript
// Prevent brute-force code guessing
import rateLimit from 'express-rate-limit';

const codeValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 validation attempts
  message: 'Too many validation attempts, try again later',
});

// Apply to POST /api/affiliate/validate-code
```

**SQL Injection Prevention:**

```typescript
// ✅ SAFE - Using Prisma (parameterized queries)
const code = await prisma.affiliateCode.findUnique({
  where: { code: userInput }, // Prisma escapes automatically
});

// ❌ UNSAFE - Raw SQL (don't do this)
const code = await prisma.$queryRaw`
  SELECT * FROM AffiliateCode WHERE code = ${userInput}
`;
```

### 9.3 Fraud Prevention

**One-time Use Per User:**

```typescript
// Check if user already used this code
const existingCommission = await prisma.commission.findFirst({
  where: {
    userId: currentUser.id,
    codeId: code.id,
  },
});

if (existingCommission) {
  throw new Error('You already used this discount code');
}
```

**User Eligibility (UPDATED - Supports Monthly Competition):**

```typescript
// Both FREE and PRO users can use codes
// FREE users: Apply at signup
// PRO users: Apply at renewal to get discount

// User can apply code if:
// 1. FREE tier (upgrading to PRO)
// 2. PRO tier at renewal checkout (applying new monthly code)

// No restrictions - all users eligible for codes
// This enables monthly affiliate competition:
// - Month 1: User uses Affiliate B's code
// - Month 2: User uses Affiliate C's code
// - Month 3: User uses Affiliate D's code

// Validation focuses on CODE status, not user tier
if (code.status !== 'ACTIVE') {
  throw new Error('This code is not active');
}

if (code.usedBy !== null) {
  throw new Error('This code has already been used');
}

if (code.expiresAt < new Date()) {
  throw new Error('This code has expired');
}
```

### 9.4 Admin Authorization

**Restrict Admin Actions:**

```typescript
// Middleware for admin-only routes
export async function requireAdmin(req: Request) {
  const session = await getServerSession();

  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }

  return session;
}

// Apply to all /api/admin/affiliate/* routes
```

---

## 10. INTEGRATION POINTS

### 10.1 Stripe Integration

**Create Checkout with Discount:**

```typescript
// app/api/checkout/create-session/route.ts

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { priceId, discountCode } = await req.json();
  const session = await getServerSession();

  let finalPrice = 2900; // $29.00 in cents (default)
  let codeData = null;

  // Validate discount code if provided
  if (discountCode) {
    const validation = await validateDiscountCode(discountCode, session.user);

    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    finalPrice = Math.round(validation.discountedPrice * 100); // Convert to cents
    codeData = validation;
  }

  // Create Stripe checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer_email: session.user.email,
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product: process.env.STRIPE_PRO_PRODUCT_ID,
          recurring: { interval: 'month' },
          unit_amount: finalPrice, // Discounted price
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: session.user.id,
      discountCode: discountCode || '',
      codeId: codeData?.codeId || '',
      originalPrice: '29.00',
      discountedPrice: (finalPrice / 100).toFixed(2),
    },
    success_url: `${process.env.NEXT_PUBLIC_URL}/checkout/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/pricing`,
  });

  return Response.json({
    sessionId: checkoutSession.id,
    url: checkoutSession.url,
    discountApplied: codeData,
  });
}
```

**Webhook Handler:**

```typescript
// app/api/webhooks/stripe/route.ts

export async function POST(req: Request) {
  const event = await stripe.webhooks.constructEvent(
    await req.text(),
    req.headers.get('stripe-signature')!,
    process.env.STRIPE_WEBHOOK_SECRET!
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata;

    // Create subscription record
    const subscription = await prisma.subscription.create({
      data: {
        userId: metadata.userId,
        stripeCustomerId: session.customer,
        stripePriceId: session.subscription,
        stripeCurrentPeriodEnd: new Date(session.current_period_end * 1000),
        status: 'active',
        discountCodeId: metadata.codeId || null,
        originalPrice: parseFloat(metadata.originalPrice),
        discountedPrice: parseFloat(metadata.discountedPrice),
      },
    });

    // Upgrade user tier
    await prisma.user.update({
      where: { id: metadata.userId },
      data: { tier: 'PRO' },
    });

    // Create commission record if code used
    if (metadata.codeId) {
      const code = await prisma.affiliateCode.findUnique({
        where: { id: metadata.codeId },
      });

      if (code) {
        const calc = calculateCommission(
          parseFloat(metadata.originalPrice),
          code.discountPercent,
          code.commissionPercent
        );

        await prisma.commission.create({
          data: {
            codeId: code.id,
            userId: metadata.userId,
            subscriptionId: subscription.id,
            regularPrice: calc.regularPrice,
            discountPercent: calc.discountPercent,
            discountedPrice: calc.discountedPrice,
            commissionPercent: calc.commissionPercent,
            commissionAmount: calc.commissionAmount,
            status: 'PENDING',
          },
        });

        // Email affiliate
        await sendAffiliateNotification(code.affiliateEmail, {
          code: code.code,
          userName: session.customer_details.email,
          amount: calc.commissionAmount,
        });
      }
    }
  }

  return Response.json({ received: true });
}
```

### 10.2 Email Notifications

**Affiliate Code Used:**

```typescript
// lib/email/affiliate-notifications.ts

export async function sendAffiliateNotification(
  affiliateEmail: string,
  data: {
    code: string;
    userName: string;
    amount: number;
  }
) {
  await sendEmail({
    to: affiliateEmail,
    subject: `Your code ${data.code} was used!`,
    html: `
      <h2>Great news!</h2>
      <p>Your discount code <strong>${data.code}</strong> was just used.</p>
      <p><strong>User:</strong> ${data.userName}</p>
      <p><strong>Commission earned:</strong> $${data.amount.toFixed(2)}</p>
      <p>This commission will be paid during the first week of next month.</p>
      <p>Keep sharing your code to earn more!</p>
    `,
  });
}
```

**Commission Payment Confirmation:**

```typescript
export async function sendPaymentConfirmation(
  affiliateEmail: string,
  data: {
    month: string;
    count: number;
    totalAmount: number;
    codes: string[];
  }
) {
  await sendEmail({
    to: affiliateEmail,
    subject: `Your ${data.month} commission has been paid`,
    html: `
      <h2>Commission Payment Confirmed</h2>
      <p>Your affiliate commission for ${data.month} has been paid.</p>
      <ul>
        <li><strong>Conversions:</strong> ${data.count}</li>
        <li><strong>Codes:</strong> ${data.codes.join(', ')}</li>
        <li><strong>Amount Paid:</strong> $${data.totalAmount.toFixed(2)}</li>
      </ul>
      <p>Thank you for promoting Trading Alerts SaaS!</p>
    `,
  });
}
```

---

## 11. IMPLEMENTATION PHASES

### Phase 1: Core Infrastructure (Week 1)

**Estimated Time:** 8 hours

**Tasks:**

- [ ] Create Prisma schema for `AffiliateCode` and `Commission`
- [ ] Run database migration
- [ ] Create `lib/affiliate/commission.ts` calculation logic
- [ ] Create `lib/affiliate/validator.ts` validation logic
- [ ] Write unit tests for calculation and validation

**Files Created:**

- `prisma/migrations/YYYYMMDD_add_affiliate_tables.sql`
- `lib/affiliate/commission.ts`
- `lib/affiliate/validator.ts`
- `lib/affiliate/__tests__/commission.test.ts`
- `lib/affiliate/__tests__/validator.test.ts`

---

### Phase 2: Admin Dashboard (Week 2)

**Estimated Time:** 12 hours

**Tasks:**

- [ ] Create admin affiliate dashboard page
- [ ] Build code creation form
- [ ] Build codes list with enable/disable toggle
- [ ] Build commission report page
- [ ] Build bulk payment marking interface
- [ ] API endpoints: POST/GET/PATCH `/api/admin/affiliate/codes`
- [ ] API endpoint: GET `/api/admin/affiliate/commissions`
- [ ] API endpoint: POST `/api/admin/affiliate/commissions/bulk-pay`

**Files Created:**

- `app/admin/affiliates/page.tsx`
- `app/admin/affiliates/codes/page.tsx`
- `app/admin/affiliates/commissions/page.tsx`
- `app/api/admin/affiliate/codes/route.ts`
- `app/api/admin/affiliate/codes/[id]/route.ts`
- `app/api/admin/affiliate/commissions/route.ts`
- `app/api/admin/affiliate/commissions/bulk-pay/route.ts`
- `components/admin/code-form.tsx`
- `components/admin/commission-table.tsx`

---

### Phase 3: Checkout Integration (Week 3)

**Estimated Time:** 10 hours

**Tasks:**

- [ ] Add discount code input to checkout page
- [ ] Implement real-time code validation
- [ ] Show price breakdown (regular → discounted)
- [ ] Update Stripe checkout session creation
- [ ] Add discount code to Stripe metadata
- [ ] API endpoint: POST `/api/affiliate/validate-code`
- [ ] UI components for discount code flow

**Files Modified:**

- `app/checkout/page.tsx`
- `app/api/checkout/create-session/route.ts`

**Files Created:**

- `app/api/affiliate/validate-code/route.ts`
- `components/checkout/discount-code-input.tsx`
- `components/checkout/price-breakdown.tsx`

---

### Phase 4: Webhook & Commission Tracking (Week 3)

**Estimated Time:** 6 hours

**Tasks:**

- [ ] Update Stripe webhook handler
- [ ] Extract discount code from metadata
- [ ] Create commission record on successful payment
- [ ] Update subscription table with discount info
- [ ] Send affiliate notification email
- [ ] Handle commission cancellation on refund

**Files Modified:**

- `app/api/webhooks/stripe/route.ts`

**Files Created:**

- `lib/email/affiliate-notifications.ts`

---

### Phase 5: Testing & Documentation (Week 4)

**Estimated Time:** 8 hours

**Tasks:**

- [ ] End-to-end testing of full flow
- [ ] Postman collection for affiliate endpoints
- [ ] Admin guide documentation
- [ ] Affiliate guide documentation
- [ ] Update OpenAPI specification
- [ ] Security audit
- [ ] Performance testing

**Files Created:**

- `docs/AFFILIATE-ADMIN-GUIDE.md`
- `docs/AFFILIATE-MARKETER-GUIDE.md`
- `postman/affiliate-endpoints.json`
- Updated: `docs/trading_alerts_openapi.yaml`

---

### Phase 6: Optional Enhancements (Future)

**Estimated Time:** 16 hours

**Tasks:**

- [ ] Affiliate self-service dashboard
- [ ] Real-time commission tracking
- [ ] Code usage analytics
- [ ] Multi-tier commission structure
- [ ] Automated monthly payout emails
- [ ] Affiliate referral links
- [ ] Code performance reports

---

## 12. TESTING STRATEGY

### 12.1 Unit Tests

**Commission Calculation:**

```typescript
// lib/affiliate/__tests__/commission.test.ts

describe('calculateCommission', () => {
  it('should calculate 20% discount, 20% commission correctly', () => {
    const result = calculateCommission(29.0, 20, 20);
    expect(result.discountedPrice).toBe(23.2);
    expect(result.commissionAmount).toBe(4.64);
  });

  it('should handle 0% discount', () => {
    const result = calculateCommission(29.0, 0, 20);
    expect(result.discountedPrice).toBe(29.0);
    expect(result.commissionAmount).toBe(5.8);
  });

  it('should throw error for discount > 50%', () => {
    expect(() => calculateCommission(29.0, 60, 30)).toThrow();
  });
});
```

**Code Validation:**

```typescript
describe('validateDiscountCode', () => {
  it('should accept valid code for FREE user', async () => {
    const result = await validateDiscountCode('SAVE20PRO', freeUser);
    expect(result.valid).toBe(true);
    expect(result.discountedPrice).toBe(23.2);
  });

  it('should reject expired code', async () => {
    const result = await validateDiscountCode('EXPIRED123', freeUser);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('code_expired');
  });

  it('should reject for PRO user', async () => {
    const result = await validateDiscountCode('SAVE20PRO', proUser);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('not_eligible');
  });
});
```

### 12.2 Integration Tests

**Full Checkout Flow:**

```typescript
describe('Affiliate Checkout Flow', () => {
  it('should complete checkout with discount code', async () => {
    // 1. Create test code
    const code = await createTestCode({
      code: 'TEST20',
      discountPercent: 20,
      commissionPercent: 30,
    });

    // 2. Login as FREE user
    const user = await loginAsTestUser({ tier: 'FREE' });

    // 3. Validate code
    const validation = await POST('/api/affiliate/validate-code', {
      code: 'TEST20',
    });
    expect(validation.valid).toBe(true);

    // 4. Create checkout session
    const session = await POST('/api/checkout/create-session', {
      priceId: 'price_pro',
      discountCode: 'TEST20',
    });
    expect(session.url).toBeDefined();

    // 5. Simulate Stripe webhook
    await simulateStripeWebhook('checkout.session.completed', {
      metadata: {
        userId: user.id,
        codeId: code.id,
        discountCode: 'TEST20',
        originalPrice: '29.00',
        discountedPrice: '23.20',
      },
    });

    // 6. Verify commission created
    const commission = await prisma.commission.findFirst({
      where: { userId: user.id, codeId: code.id },
    });
    expect(commission).toBeDefined();
    expect(commission.commissionAmount).toBe(6.96);
    expect(commission.status).toBe('PENDING');

    // 7. Verify user upgraded
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(updatedUser.tier).toBe('PRO');
  });
});
```

### 12.3 Manual Testing Checklist

**Admin Functions:**

- [ ] Create discount code with custom settings
- [ ] Auto-generate random code
- [ ] Disable code (verify validation fails after)
- [ ] Enable previously disabled code
- [ ] View commission report filtered by month
- [ ] View commission report filtered by status
- [ ] Mark commissions as paid (bulk)
- [ ] Verify email sent to affiliate after payment

**User Functions:**

- [ ] Apply valid code at checkout (FREE user)
- [ ] See discounted price preview
- [ ] Complete payment with discount
- [ ] Verify tier upgraded to PRO
- [ ] Try to apply code as PRO user (should fail)
- [ ] Try to apply expired code (should fail)
- [ ] Try to apply disabled code (should fail)
- [ ] Try to apply non-existent code (should fail)

**Security Tests:**

- [ ] Try SQL injection in code input
- [ ] Try XSS in code input
- [ ] Attempt rate limit bypass (10+ validations/15min)
- [ ] Try to access admin endpoints as regular user
- [ ] Verify commissions created only on successful payment
- [ ] Verify one code per user enforcement

---

## 13. DOCUMENTATION UPDATES REQUIRED

Based on this design, the following existing documents need updates:

### 13.1 Database Schema

**File:** `docs/v5-structure-division.md` → Part 2: Database Schema

**Changes:**

- Add `AffiliateCode` table
- Add `Commission` table
- Update `User` relations
- Update `Subscription` with discount fields

---

### 13.2 API Specification

**File:** `docs/trading_alerts_openapi.yaml`

**New Endpoints to Add:**

```yaml
/api/admin/affiliate/codes:
  get: # List codes
  post: # Create code

/api/admin/affiliate/codes/{id}:
  patch: # Update code

/api/admin/affiliate/commissions:
  get: # Commission report

/api/admin/affiliate/commissions/bulk-pay:
  post: # Mark as paid

/api/affiliate/validate-code:
  post: # Validate code
```

**Updated Endpoints:**

```yaml
/api/checkout/create-session:
  post:
    requestBody:
      properties:
        discountCode: # Add optional field
```

---

### 13.3 Architecture Rules

**File:** `docs/policies/03-architecture-rules.md`

**New Section to Add:**

```markdown
## Affiliate Marketing Rules

1. **Commission Calculation:**
   - ALWAYS use lib/affiliate/commission.ts
   - NEVER calculate inline in components or API routes
   - Round to 2 decimal places

2. **Code Validation:**
   - ALWAYS check: exists, active, not expired, user eligible
   - Rate limit validation endpoint (10 attempts / 15 min)
   - Log validation attempts for fraud detection

3. **Stripe Integration:**
   - ALWAYS pass discount code in metadata
   - Create custom price (don't use Stripe coupons for MVP)
   - Create commission ONLY after payment success

4. **Admin Authorization:**
   - ALL /api/admin/affiliate/\* routes require ADMIN role
   - Log all admin actions (create, disable, payout)
```

---

### 13.4 Coding Patterns

**File:** `docs/policies/05-coding-patterns.md`

**New Pattern to Add:**

```markdown
## Pattern 8: Affiliate Discount Code Validation

### Use Case

Validate discount code before checkout

### Code Example

\`\`\`typescript
// app/api/affiliate/validate-code/route.ts
import { getServerSession } from 'next-auth';
import { validateDiscountCode } from '@/lib/affiliate/validator';

export async function POST(req: NextRequest) {
try {
const session = await getServerSession();
if (!session) {
return NextResponse.json(
{ error: 'Unauthorized' },
{ status: 401 }
);
}

    const { code } = await req.json();
    const result = await validateDiscountCode(code, session.user);

    if (!result.valid) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);

} catch (error) {
console.error('Code validation failed:', error);
return NextResponse.json(
{ error: 'Validation failed' },
{ status: 500 }
);
}
}
\`\`\`
```

---

### 13.5 Project Structure

**File:** `docs/v5-structure-division.md`

**New Part to Add:**

```markdown
## PART 17: Affiliate Marketing System

**Scope:** Affiliate code management and commission tracking

**Folders & Files:**
\`\`\`
app/admin/affiliates/
├── page.tsx # Affiliate dashboard
├── codes/page.tsx # Code management
└── commissions/page.tsx # Commission reports

app/api/admin/affiliate/
├── codes/route.ts
├── codes/[id]/route.ts
├── commissions/route.ts
└── commissions/bulk-pay/route.ts

app/api/affiliate/
└── validate-code/route.ts

lib/affiliate/
├── commission.ts # Calculation logic
├── validator.ts # Validation logic
└── **tests**/
├── commission.test.ts
└── validator.test.ts

components/admin/
├── code-form.tsx
└── commission-table.tsx

components/checkout/
├── discount-code-input.tsx
└── price-breakdown.tsx
\`\`\`

**File Count:** ~15 files
```

---

### 13.6 Testing Guide

**File:** `postman/TESTING-GUIDE.md`

**New Scenario to Add:**

```markdown
## Scenario 6: Affiliate Marketing Flow

### Prerequisites

- Admin user logged in
- FREE tier test user created

### Step 1: Admin Creates Code

\`\`\`
POST /api/admin/affiliate/codes
Authorization: Bearer {{admin_token}}

Body:
{
"code": "SAVE20PRO",
"discountPercent": 20,
"commissionPercent": 30,
"affiliateEmail": "affiliate@test.com",
"expiresAt": "2025-12-31T23:59:59Z"
}

Expected: 201 Created, code object returned
Save {{code_id}} for later tests
\`\`\`

### Step 2: User Validates Code

\`\`\`
POST /api/affiliate/validate-code
Authorization: Bearer {{free_user_token}}

Body:
{
"code": "SAVE20PRO"
}

Expected: 200 OK
{
"valid": true,
"discountedPrice": 23.20,
"savings": 5.80
}
\`\`\`

### Step 3: User Completes Checkout

\`\`\`
POST /api/checkout/create-session
Authorization: Bearer {{free_user_token}}

Body:
{
"priceId": "price_pro_monthly",
"discountCode": "SAVE20PRO"
}

Expected: 200 OK, Stripe checkout URL
\`\`\`

### Step 4: Simulate Webhook (Dev Only)

Complete Stripe checkout in test mode
Webhook fires automatically

### Step 5: Verify Commission Created

\`\`\`
GET /api/admin/affiliate/commissions?status=PENDING
Authorization: Bearer {{admin_token}}

Expected: 200 OK
Commission record with:

- commissionAmount: 6.96
- status: PENDING
  \`\`\`

### Step 6: Mark Commission as Paid

\`\`\`
POST /api/admin/affiliate/commissions/bulk-pay
Authorization: Bearer {{admin_token}}

Body:
{
"commissionIds": ["{{commission_id}}"],
"note": "Paid via PayPal"
}

Expected: 200 OK
\`\`\`

### Step 7: Verify Status Updated

\`\`\`
GET /api/admin/affiliate/commissions/{{commission_id}}
Authorization: Bearer {{admin_token}}

Expected: 200 OK
{
"status": "PAID",
"paidAt": "2025-11-14T..."
}
\`\`\`
```

---

### 13.7 Progress Tracking

**File:** `PROGRESS.md`

**Update Phase 3 Build Order:**

```markdown
### PART 17: Affiliate Marketing System (Week 11, 8 hours)

**What:** Discount code generation, commission tracking, admin management.

**Files:** 15 files

**Command:**
\`\`\`bash
Build Part 17: Affiliate Marketing from docs/AFFILIATE-MARKETING-DESIGN.md

Create database schema, admin dashboard, checkout integration, commission tracking.
\`\`\`

**Testing:**

- [ ] Admin can create codes
- [ ] User can apply code at checkout
- [ ] Commission created on payment
- [ ] Admin can mark commissions as paid
- [ ] Emails sent to affiliates
```

---

## 14. SUMMARY & NEXT STEPS

### What We're Building

A **comprehensive 2-sided marketplace platform** that operates as both SaaS provider AND distributor:

**Side 1 - Affiliate Marketers (Independent Distributors):**

1. Self-service registration with email verification
2. Personal dashboard with code inventory and commission reports (accounting-style)
3. Profile management with 4 payment preference options
4. Real-time tracking of conversions and earnings
5. Monthly automated code distribution (15 codes)

**Side 2 - End Users (FREE/PRO tiers):**

1. Apply affiliate discount codes at checkout
2. Upgrade from FREE to PRO tier with discounts
3. One-time use per user

**Platform Operator - Admin:**

1. Manage all affiliates (list, view, suspend, terminate)
2. Manual code distribution when needed
3. Cancel specific codes
4. View comprehensive reports:
   - P&L Report (3 months)
   - Sales Performance by Affiliate (with drill-downs)
   - Commission Owings Report
   - Aggregate Code Inventory across all affiliates
5. Process monthly commission payouts (bulk operations)

### Key Features

- ✅ **Affiliate Self-Service Portal** - Complete registration, authentication, and dashboard
- ✅ **Automated Monthly Code Distribution** - 15 codes per affiliate at month start
- ✅ **Automatic Code Expiry** - All codes expire at end of month
- ✅ **Code Format** - Cryptographically secure >12 characters
- ✅ **Accounting-Style Reports** - Opening/closing balances with drill-downs
- ✅ **4 Payment Options** - Bank transfer, Crypto (USDT), Global wallets, Local wallets
- ✅ **Business Intelligence** - P&L, Sales Performance, Commission Owings, Aggregate Inventory
- ✅ **Secure Code Validation** - Comprehensive fraud prevention
- ✅ **Stripe Integration** - Custom pricing with metadata tracking

### Technical Highlights

- **3 new database tables** (Affiliate, AffiliateCode, Commission)
- **4 new enums** (PaymentMethod, AffiliateStatus, CodeStatus, CommissionStatus)
- **30+ new API endpoints** (auth, dashboard, admin management, reporting, validation)
- **60+ new files** (components, utilities, cron jobs, tests)
- **NextAuth.js** with 3 roles (Admin, Affiliate, User)
- **Vercel Cron** for monthly automation
- **Stripe integration** via custom pricing and metadata
- **Transactional emails** for verification, notifications, reports
- **Report generation** with drill-down capabilities

### Time Estimate

**Total:** ~120 hours across 8 phases

**Phase 1: Database & Core Infrastructure (16h)**

- Prisma schema with 3 models + 4 enums
- Code generator utility (>12 chars random)
- Commission calculator
- Report generator utilities

**Phase 2: Affiliate Authentication (16h)**

- Registration with email verification
- Login/logout
- Password reset flow
- JWT token management

**Phase 3: Affiliate Dashboard (24h)**

- Dashboard overview page
- Code inventory report (with drill-downs)
- Commission receivable report (with drill-downs)
- Profile management (4 payment options)

**Phase 4: Admin Affiliate Management (20h)**

- Affiliate list and details
- Manual code distribution
- Status management (suspend/terminate)
- Code cancellation

**Phase 5: Admin Business Intelligence Reports (24h)**

- P&L Report (3 months)
- Sales Performance by Affiliate (with drill-down)
- Commission Owings Report
- Aggregate Code Inventory
- Chart generation

**Phase 6: Checkout Integration (12h)**

- Code validation API
- Checkout page integration
- Price preview
- Stripe custom pricing

**Phase 7: Webhook & Automation (16h)**

- Stripe webhook updates
- Commission creation
- Code status updates
- Monthly cron jobs (distribution, expiry)
- Monthly report emails

**Phase 8: Testing & Documentation (12h)**

- Unit tests
- Integration tests
- API documentation
- User guides

### Your Current Status

**Milestone 1.6** - Phase 1 (Documentation & Policies)

### Immediate Next Steps

1. **Review this design document**
   - Ask questions if anything is unclear
   - Suggest modifications if needed

2. **Update affected documents** (see Section 13)
   - `docs/v5-structure-division.md`
   - `docs/trading_alerts_openapi.yaml`
   - `docs/policies/03-architecture-rules.md`
   - `docs/policies/05-coding-patterns.md`
   - `postman/TESTING-GUIDE.md`
   - `PROGRESS.md`

3. **Complete Phase 1** (your current phase)
   - Finish Milestone 1.6 (Aider comprehension tests)
   - Complete Milestone 1.7 (Readiness check)

4. **Proceed with Phase 2-3** (Foundation & Building)
   - Build original 16 parts first
   - Add Part 17 (Affiliate Marketing) after core features complete

5. **Test comprehensively**
   - Unit tests for calculation logic
   - Integration tests for full flow
   - Manual testing checklist

---

## 15. DESIGN DECISIONS MADE & OPEN QUESTIONS

### ✅ Decisions Made (Per Business Plan)

1. **Code Format:** ✅ DECIDED
   - Cryptographically random >12 characters
   - Example: `SxTYo25#1dpgiNguD`
   - Auto-generated using `crypto.randomBytes`

2. **Affiliate Self-Service:** ✅ DECIDED
   - Full self-service portal (not optional, core requirement)
   - Affiliate registration and authentication
   - Dashboard with code inventory and commission reports
   - Profile management with payment preferences

3. **Code Distribution:** ✅ DECIDED
   - 15 codes at account creation (after email verification)
   - 15 new codes monthly (automated via cron)
   - Codes expire at end of month automatically

4. **Code Usage:** ✅ DECIDED
   - One-time use per code (status: ACTIVE → USED)
   - One code per user (no multiple discount codes)
   - Admin can cancel codes manually

5. **Payment Options:** ✅ DECIDED
   - 4 payment methods:
     1. Local bank transfers (local currency)
     2. Crypto (USDT with TRC20/ERC20/BEP20)
     3. Global wallets (PayPal, Apple Pay, Google Pay, Stripe)
     4. Local/regional wallets
   - Manual payout process (admin marks as paid)

6. **Reporting:** ✅ DECIDED
   - Accounting-style reports (opening/closing balances)
   - Drill-down capabilities
   - 4 admin reports: P&L, Sales Performance, Commission Owings, Aggregate Inventory

### ❓ Open Questions for Future Discussion

1. **Discount and Commission Percentages:**
   - ✅ DECIDED: Platform-wide defaults of 20% discount, 20% commission
   - Current design: Admin can set per code batch (defaults to 20%/20%)
   - Future consideration: Performance-based commission tiers for top affiliates

2. **Automated Payout Integration:**
   - Current design: Manual external payments
   - Question: Future integration with Stripe Connect for automated payouts?
   - Question: Crypto payment automation via smart contracts?

3. **Recurring Commissions:**
   - Current design: One-time commission on initial upgrade
   - Question: Should affiliates earn recurring commissions on renewals?
   - Question: If yes, what percentage? (e.g., 10% recurring vs 30% initial)

4. **Affiliate Tiers/Levels:**
   - Current design: All affiliates equal
   - Question: Should there be Bronze/Silver/Gold tiers with different benefits?
   - Question: Benefits could include: higher commission %, more codes, priority support

5. **Code Customization:**
   - Current design: Auto-generated random codes only
   - Question: Should affiliates request vanity codes? (e.g., "JOHNDOE2025")
   - Risk: Vanity codes are less secure, easier to guess

6. **Multi-Currency Support:**
   - Current design: All prices in USD
   - Question: Should we support pricing in local currencies?
   - Question: How to handle commission calculations with exchange rates?

7. **Affiliate Marketing Assets:**
   - Question: Should platform provide marketing materials? (banners, landing pages, email templates)
   - Question: Affiliate referral links vs just discount codes?

8. **Performance Bonuses:**
   - Question: Should high-performing affiliates get bonuses? (e.g., 50+ conversions/month)
   - Question: Structure: flat bonus or increased commission %?

9. **Code Sharing Restrictions:**
   - Current design: Affiliates can share codes anywhere
   - Question: Should codes be restricted to specific channels? (e.g., this code only for Instagram)
   - Question: How to enforce? (User reports channel during checkout)

---

**Document Status:** Complete Design Specification
**Ready for:** Review & Implementation Planning
**Contact:** Project Owner for decisions on open questions
