# AFFILIATE & ADMIN JOURNEY DOCUMENTATION

**Last Updated:** 2025-11-14
**For:** Trading Alerts SaaS V7 - Affiliate Marketing Platform
**Purpose:** Comprehensive journey documentation for affiliates and administrators

---

## 📖 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Affiliate Journey](#affiliate-journey)
   - 2.1 [Registration & Onboarding](#21-affiliate-registration--onboarding)
   - 2.2 [Email Verification](#22-email-verification)
   - 2.3 [First Login & Dashboard](#23-first-login--dashboard)
   - 2.4 [Daily Dashboard Workflow](#24-daily-dashboard-workflow)
   - 2.5 [Profile Management](#25-profile-management)
   - 2.6 [Code Usage Notifications](#26-code-usage-notifications)
3. [Admin Journey](#admin-journey)
   - 3.1 [Affiliate Management](#31-affiliate-management)
   - 3.2 [Business Intelligence Reports](#32-business-intelligence-reports)
   - 3.3 [Manual Code Distribution](#33-manual-code-distribution)
   - 3.4 [Commission Payment Processing](#34-commission-payment-processing)
   - 3.5 [Code Cancellation](#35-code-cancellation)
4. [Affiliate-Admin Interactions](#affiliate-admin-interactions)
5. [Automated Monthly Processes](#automated-monthly-processes)
6. [Email Notifications](#email-notifications)
7. [Error Scenarios](#error-scenarios)

---

## 1. OVERVIEW

This document describes the complete journey for two key user types in the affiliate marketing platform:

### Affiliate Marketers (Side 1 of Marketplace)

- **Role:** Promote Trading Alerts SaaS to potential customers
- **Goal:** Earn commissions from successful conversions
- **Access:** Self-service portal at `/affiliate/*`
- **Key Activities:**
  - Register and verify email
  - Manage discount codes inventory
  - Track commission earnings
  - Set payment preferences
  - Monitor performance

### Platform Administrators (Platform Operator)

- **Role:** Manage affiliate program and business operations
- **Goal:** Optimize affiliate performance and profitability
- **Access:** Admin panel at `/admin/affiliates/*`
- **Key Activities:**
  - Approve/reject affiliate applications
  - Distribute codes manually
  - View business intelligence reports
  - Process commission payments
  - Monitor aggregate performance

### Connection to End Users

The affiliate and admin journeys are **largely separate** from the end user journey. The only connection point is:

- **User applies discount code at checkout** → Affiliate earns commission

This connection is documented separately in the main user journey documentation.

---

## 2. AFFILIATE JOURNEY

---

## 2.1 Affiliate Registration & Onboarding

### Journey Start: Public Registration Page

**URL:** `/affiliate/register`

**Page Components:**

```
┌─────────────────────────────────────────────────────────┐
│         Trading Alerts - Affiliate Program              │
│                                                          │
│  Join our affiliate program and earn commissions!       │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │  REGISTRATION FORM                          │        │
│  │                                             │        │
│  │  Email: [________________]                  │        │
│  │  Password: [________________]               │        │
│  │  Confirm Password: [________________]       │        │
│  │                                             │        │
│  │  Full Name: [________________]              │        │
│  │  Country: [Select ▼]                        │        │
│  │                                             │        │
│  │  --- Social Media (Optional) ---            │        │
│  │  Facebook: [________________]               │        │
│  │  Instagram: [________________]              │        │
│  │  Twitter: [________________]                │        │
│  │  YouTube: [________________]                │        │
│  │  TikTok: [________________]                 │        │
│  │                                             │        │
│  │  --- Payment Preferences ---                │        │
│  │  Payment Method:                            │        │
│  │  ( ) Bank Transfer                          │        │
│  │  ( ) Cryptocurrency                         │        │
│  │  ( ) Global E-Wallet                        │        │
│  │  ( ) Local E-Wallet                         │        │
│  │                                             │        │
│  │  [Show Payment Details Fields]              │        │
│  │                                             │        │
│  │  [ ] I agree to Terms & Conditions          │        │
│  │                                             │        │
│  │  [Register as Affiliate]                    │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Already have an account? [Login]                       │
└─────────────────────────────────────────────────────────┘
```

### Step-by-Step Flow:

#### Step 1: Affiliate Fills Registration Form

**Required Fields:**

- Email (unique, validated)
- Password (min 8 characters, hashed with bcrypt)
- Full Name
- Country (ISO country code)

**Optional Fields:**

- Social media URLs (Facebook, Instagram, Twitter, YouTube, TikTok)

**Payment Preference (Required - Choose One):**

**Option A: Bank Transfer**

- Bank Name
- Bank Account Number
- Bank Account Holder Name

**Option B: Cryptocurrency**

- Crypto Wallet Address
- Preferred Cryptocurrency (BTC, ETH, USDT)

**Option C: Global E-Wallet**

- Global Wallet Type (PayPal, Payoneer, Wise)
- Wallet Email or ID

**Option D: Local E-Wallet**

- Local Wallet Type (GCash, Maya, TrueMoney, etc.)
- Wallet Phone Number or ID

#### Step 2: Form Validation

**Frontend Validation:**

- Email format valid
- Password strength check
- Password confirmation matches
- Country selected
- At least one payment method filled
- Terms & conditions checked

**API Call:**

```
POST /api/affiliate/auth/register

Request Body:
{
  "email": "john@example.com",
  "password": "SecurePass123",
  "fullName": "John Smith",
  "country": "US",
  "facebookUrl": "https://facebook.com/johnsmith",
  "instagramUrl": "https://instagram.com/johnsmith",
  "paymentMethod": "BANK_TRANSFER",
  "bankName": "Chase Bank",
  "bankAccountNumber": "1234567890",
  "bankAccountHolderName": "John Smith"
}
```

#### Step 3: Backend Processing

**Database Operations:**

1. Check if email already exists
2. Hash password with bcrypt
3. Create Affiliate record with status = `PENDING_VERIFICATION`
4. Generate email verification token (JWT, expires in 24 hours)

**Database Record Created:**

```prisma
Affiliate {
  id: "clf1234567890",
  email: "john@example.com",
  password: "$2b$10$hashed...",
  emailVerified: null,
  fullName: "John Smith",
  country: "US",
  facebookUrl: "https://facebook.com/johnsmith",
  instagramUrl: "https://instagram.com/johnsmith",
  paymentMethod: BANK_TRANSFER,
  bankName: "Chase Bank",
  bankAccountNumber: "1234567890",
  bankAccountHolderName: "John Smith",
  status: PENDING_VERIFICATION,
  createdAt: "2025-11-14T10:30:00Z",
  codesDistributed: 0,
  totalEarnings: 0
}
```

#### Step 4: Success Response

**API Response:**

```json
{
  "success": true,
  "message": "Registration successful! Please check your email to verify your account.",
  "affiliateId": "clf1234567890"
}
```

**UI Feedback:**

```
┌─────────────────────────────────────────────────────────┐
│  ✓ Registration Successful!                             │
│                                                          │
│  We've sent a verification email to john@example.com    │
│                                                          │
│  Please check your inbox and click the verification     │
│  link to activate your affiliate account.               │
│                                                          │
│  [OK]                                                    │
└─────────────────────────────────────────────────────────┘
```

#### Step 5: Verification Email Sent

**Email Trigger:** Automated email sent via Resend/SendGrid

**Email Template:**

```
Subject: Verify Your Affiliate Account - Trading Alerts

Hi John,

Welcome to the Trading Alerts Affiliate Program!

To activate your account and start earning commissions, please verify your email address by clicking the link below:

[Verify Email Address]
https://trading-alerts.com/affiliate/verify?token=eyJhbGciOiJIUzI1NiIs...

This link will expire in 24 hours.

If you didn't create this account, please ignore this email.

Best regards,
Trading Alerts Team
```

---

## 2.2 Email Verification

### Journey: Email Verification Flow

#### Step 1: Affiliate Clicks Verification Link

**Link Format:**

```
https://trading-alerts.com/affiliate/verify?token=eyJhbGciOiJIUzI1NiIs...
```

**Page Load:** `/affiliate/verify`

#### Step 2: Token Validation

**API Call:**

```
POST /api/affiliate/auth/verify-email

Request Body:
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Backend Processing:**

1. Decode JWT token
2. Check if token expired
3. Check if email already verified
4. Update Affiliate record:
   - Set `emailVerified = now()`
   - Change status from `PENDING_VERIFICATION` to `ACTIVE`

#### Step 3: First Code Distribution (Automated)

**Trigger:** Email verification successful

**Automated Process:**

```
1. Query: Get newly verified affiliate
2. Generate 15 discount codes:
   - Generate cryptographically random codes (>12 chars)
   - Set affiliateId = verified affiliate
   - Set status = ACTIVE
   - Set expiresAt = end of current month
   - Set discountPercent = 20% (default)
   - Set commissionPercent = 20% (default)
3. Create 15 AffiliateCode records
4. Update Affiliate.codesDistributed += 15
5. Send welcome email with login instructions
```

**Database Records Created (15 codes):**

```prisma
AffiliateCode {
  id: "code_001",
  code: "SMITH-A7K9P2M5",
  affiliateId: "clf1234567890",
  status: ACTIVE,
  discountPercent: 20.0,
  commissionPercent: 20.0,
  createdAt: "2025-11-14T10:35:00Z",
  expiresAt: "2025-11-30T23:59:59Z",
  usedAt: null,
  usedByUserId: null
}
// ... 14 more codes
```

#### Step 4: Welcome Email Sent

**Email Template:**

```
Subject: Welcome to Trading Alerts Affiliate Program!

Hi John,

Your affiliate account is now active! 🎉

We've distributed your first batch of 15 discount codes. You can now:

1. Login to your affiliate dashboard
2. View your discount codes
3. Share codes with potential customers
4. Track your commissions in real-time

[Login to Dashboard]
https://trading-alerts.com/affiliate/login

Dashboard Highlights:
- 15 active discount codes ready to share
- Real-time commission tracking
- Detailed performance reports
- Monthly automatic code distribution (15 codes/month)

Commission Structure:
- 20% discount for customers
- 20% commission for you on net revenue

Questions? Reply to this email or visit our Help Center.

Happy promoting!
Trading Alerts Team
```

#### Step 5: Verification Success Page

**UI Display:**

```
┌─────────────────────────────────────────────────────────┐
│  ✓ Email Verified Successfully!                         │
│                                                          │
│  Your affiliate account is now active.                  │
│                                                          │
│  We've distributed 15 discount codes to your account.   │
│  Check your email for login instructions.               │
│                                                          │
│  [Go to Login Page]                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 2.3 First Login & Dashboard

### Journey: First-Time Dashboard Access

#### Step 1: Affiliate Navigates to Login Page

**URL:** `/affiliate/login`

**Page Components:**

```
┌─────────────────────────────────────────────────────────┐
│         Trading Alerts - Affiliate Login                │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │  LOGIN                                      │        │
│  │                                             │        │
│  │  Email: [________________]                  │        │
│  │  Password: [________________]               │        │
│  │                                             │        │
│  │  [ ] Remember me                            │        │
│  │                                             │        │
│  │  [Login]                                    │        │
│  │                                             │        │
│  │  [Forgot Password?]                         │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  Don't have an account? [Register]                      │
└─────────────────────────────────────────────────────────┘
```

#### Step 2: Login Authentication

**API Call:**

```
POST /api/affiliate/auth/login

Request Body:
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Backend Processing:**

1. Find Affiliate by email
2. Verify password with bcrypt
3. Check status = ACTIVE (reject if PENDING_VERIFICATION or SUSPENDED)
4. Generate JWT token (expires in 7 days)
5. Update lastLoginAt timestamp

**API Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "affiliate": {
    "id": "clf1234567890",
    "email": "john@example.com",
    "fullName": "John Smith",
    "status": "ACTIVE"
  }
}
```

#### Step 3: Redirect to Dashboard

**URL:** `/affiliate/dashboard`

**First-Time Dashboard View:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Trading Alerts - Affiliate Dashboard                              │
│  Welcome back, John Smith! 👋                                       │
│  Last login: Today at 10:40 AM                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 QUICK STATS                                                     │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐   │
│  │ Total Codes  │ Active Codes │ Used Codes   │ Total Earned  │   │
│  │     15       │      15      │      0       │    $0.00      │   │
│  └──────────────┴──────────────┴──────────────┴──────────────┘   │
│                                                                     │
│  🎯 GETTING STARTED (First-time user tips)                         │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  ✓ Account verified                                        │   │
│  │  ✓ 15 discount codes distributed                           │   │
│  │  ⏩ Share your codes to start earning!                     │   │
│  │                                                            │   │
│  │  Next Steps:                                               │   │
│  │  1. View your discount codes below                         │   │
│  │  2. Copy codes and share on social media                   │   │
│  │  3. Track conversions in real-time                         │   │
│  │  4. Get paid monthly for commissions earned                │   │
│  │                                                            │   │
│  │  [View Tutorial] [Hide Tips]                               │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  💰 COMMISSION RECEIVABLE                                          │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Opening Balance: $0.00                                    │   │
│  │  + Earned This Month: $0.00                                │   │
│  │  - Paid This Month: $0.00                                  │   │
│  │  = Closing Balance: $0.00                                  │   │
│  │                                                            │   │
│  │  [View Detailed Report]                                    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  🎫 DISCOUNT CODES INVENTORY                                       │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Opening Balance: 0 codes                                  │   │
│  │  + Received This Month: 15 codes                           │   │
│  │  - Used: 0 codes                                           │   │
│  │  - Expired: 0 codes                                        │   │
│  │  - Cancelled: 0 codes                                      │   │
│  │  = Closing Balance: 15 codes                               │   │
│  │                                                            │   │
│  │  [View All Codes]                                          │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📋 YOUR ACTIVE CODES (15)                                         │
│  ┌────────────────────┬──────────┬────────────┬──────────────┐   │
│  │ Code               │ Discount │ Expires    │ Status       │   │
│  ├────────────────────┼──────────┼────────────┼──────────────┤   │
│  │ SMITH-A7K9P2M5     │ 10%      │ Nov 30     │ Active [📋] │   │
│  │ SMITH-B3N7Q8R2     │ 10%      │ Nov 30     │ Active [📋] │   │
│  │ SMITH-C9W4T6Y1     │ 10%      │ Nov 30     │ Active [📋] │   │
│  │ ... (12 more)                                              │   │
│  │ [Show All]                                                 │   │
│  └────────────────────┴──────────┴────────────┴──────────────┘   │
│                                                                     │
│  [📋] = Copy to clipboard                                          │
└─────────────────────────────────────────────────────────────────────┘
```

#### Step 4: Data Loading (API Calls)

**API Call 1: Get Dashboard Stats**

```
GET /api/affiliate/dashboard/stats

Response:
{
  "totalCodes": 15,
  "activeCodes": 15,
  "usedCodes": 0,
  "expiredCodes": 0,
  "totalEarnings": 0.00,
  "pendingCommissions": 0.00
}
```

**API Call 2: Get Code Inventory**

```
GET /api/affiliate/dashboard/code-inventory

Response:
{
  "reportMonth": "2025-11",
  "openingBalance": 0,
  "received": 15,
  "used": 0,
  "expired": 0,
  "cancelled": 0,
  "closingBalance": 15,
  "movements": [
    {
      "date": "2025-11-14",
      "type": "RECEIVED",
      "quantity": 15,
      "notes": "Initial distribution after email verification"
    }
  ]
}
```

**API Call 3: Get Active Codes**

```
GET /api/affiliate/dashboard/codes?status=ACTIVE

Response:
{
  "codes": [
    {
      "id": "code_001",
      "code": "SMITH-A7K9P2M5",
      "discountPercent": 20.0,
      "commissionPercent": 30.0,
      "status": "ACTIVE",
      "expiresAt": "2025-11-30T23:59:59Z",
      "usedAt": null
    }
    // ... 14 more codes
  ],
  "total": 15
}
```

---

## 2.4 Daily Dashboard Workflow

### Journey: Returning Affiliate Daily Activities

#### Activity 1: Check Commission Earnings

**Navigation:** Dashboard → "View Detailed Report" under Commission Receivable

**URL:** `/affiliate/dashboard/commissions`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Commission Receivable Report                                       │
│  Period: November 2025                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 SUMMARY                                                         │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  (2.0) Opening Balance (Nov 1)        $0.00               │   │
│  │  (2.1) + Earned This Month             $87.00             │   │
│  │  (2.2) - Paid This Month               $0.00              │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │   │
│  │  (2.3) = Closing Balance               $87.00             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  💵 EARNED THIS MONTH ($87.00) - DRILL DOWN                        │
│  ┌────────┬──────────────┬─────────┬──────────┬────────────┐     │
│  │ Date   │ Code Used    │ Tier    │ Price    │ Commission │     │
│  ├────────┼──────────────┼─────────┼──────────┼────────────┤     │
│  │ Nov 15 │ SMITH-A7K9P2M5│ PRO    │ $29.00   │ $4.64      │     │
│  │ Nov 18 │ SMITH-B3N7Q8R2│ PRO    │ $29.00   │ $4.64      │     │
│  │ Nov 20 │ SMITH-C9W4T6Y1│ PRO    │ $29.00   │ $4.64      │     │
│  │ Nov 22 │ SMITH-A7K9P2M5│ PREMIUM│ $99.00   │ $26.73     │     │
│  │ Nov 25 │ SMITH-D5X2Z8M4│ PRO    │ $29.00   │ $4.64      │     │
│  │ Nov 28 │ SMITH-E8Y3W7N6│ PRO    │ $29.00   │ $4.64      │     │
│  │ Nov 29 │ SMITH-F2K9L4P1│ PRO    │ $29.00   │ $4.64      │     │
│  │ Nov 30 │ SMITH-G6M3Q8T5│ PRO    │ $29.00   │ $4.64      │     │
│  │ Nov 30 │ SMITH-H9R4V2X7│ PRO    │ $29.00   │ $4.64      │     │
│  │ Nov 30 │ SMITH-I3T7Y5Z1│ PRO    │ $29.00   │ $4.64      │     │
│  └────────┴──────────────┴─────────┴──────────┴────────────┘     │
│                                                                     │
│  📝 COMMISSION CALCULATION                                         │
│  Example (Nov 22):                                                 │
│  - Regular Price: $99.00                                           │
│  - Discount (10%): $9.90                                           │
│  - Net Revenue: $89.10                                             │
│  - Your Commission (30%): $26.73                                   │
│                                                                     │
│  [Export PDF] [Export CSV]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
GET /api/affiliate/dashboard/commission-report?month=2025-11

Response:
{
  "reportMonth": "2025-11",
  "openingBalance": 0.00,
  "earned": 87.00,
  "paid": 0.00,
  "closingBalance": 87.00,
  "commissions": [
    {
      "id": "comm_001",
      "date": "2025-11-15T14:30:00Z",
      "code": "SMITH-A7K9P2M5",
      "tier": "PRO",
      "regularPrice": 29.00,
      "discount": 5.80,
      "netRevenue": 23.20,
      "commissionPercent": 20.0,
      "commissionAmount": 4.64,
      "status": "PENDING"
    }
    // ... more commissions
  ]
}
```

#### Activity 2: Monitor Code Inventory

**Navigation:** Dashboard → "View All Codes" under Code Inventory

**URL:** `/affiliate/dashboard/codes`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Code Inventory Report                                              │
│  Period: November 2025                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 INVENTORY SUMMARY                                               │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  (1.0) Opening Balance (Nov 1)        0 codes             │   │
│  │  (1.1) + Received This Month           15 codes            │   │
│  │  (1.2) - Used                          10 codes            │   │
│  │  (1.3) - Expired                       0 codes             │   │
│  │  (1.4) - Cancelled                     0 codes             │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │   │
│  │  (1.5) = Closing Balance               5 codes            │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📥 CODES RECEIVED (15) - DRILL DOWN                               │
│  ┌────────┬──────────────────────┬─────────────────────────┐     │
│  │ Date   │ Quantity             │ Notes                   │     │
│  ├────────┼──────────────────────┼─────────────────────────┤     │
│  │ Nov 14 │ 15 codes             │ Initial distribution    │     │
│  └────────┴──────────────────────┴─────────────────────────┘     │
│                                                                     │
│  📤 CODES USED (10) - DRILL DOWN                                   │
│  ┌────────┬──────────────┬──────────────┬─────────────────┐      │
│  │ Date   │ Code         │ Used By User │ Commission      │      │
│  ├────────┼──────────────┼──────────────┼─────────────────┤      │
│  │ Nov 15 │ SMITH-A7K9P2M5│ user_123    │ $7.83           │      │
│  │ Nov 18 │ SMITH-B3N7Q8R2│ user_456    │ $7.83           │      │
│  │ Nov 20 │ SMITH-C9W4T6Y1│ user_789    │ $7.83           │      │
│  │ ... (7 more)                                             │      │
│  └────────┴──────────────┴──────────────┴─────────────────┘      │
│                                                                     │
│  ✅ ACTIVE CODES (5)                                               │
│  ┌──────────────────┬──────────┬────────────┬─────────────┐      │
│  │ Code             │ Discount │ Expires    │ Action      │      │
│  ├──────────────────┼──────────┼────────────┼─────────────┤      │
│  │ SMITH-K4M9P7Q2   │ 10%      │ Nov 30     │ [📋 Copy]  │      │
│  │ SMITH-L8N2R6T3   │ 10%      │ Nov 30     │ [📋 Copy]  │      │
│  │ SMITH-M3Q7W9Y5   │ 10%      │ Nov 30     │ [📋 Copy]  │      │
│  │ SMITH-N6T2X8Z4   │ 10%      │ Nov 30     │ [📋 Copy]  │      │
│  │ SMITH-O9V4Y3K7   │ 10%      │ Nov 30     │ [📋 Copy]  │      │
│  └──────────────────┴──────────┴────────────┴─────────────┘      │
│                                                                     │
│  [Export PDF] [Export CSV]                                         │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
GET /api/affiliate/dashboard/code-inventory?month=2025-11

Response:
{
  "reportMonth": "2025-11",
  "openingBalance": 0,
  "received": 15,
  "used": 10,
  "expired": 0,
  "cancelled": 0,
  "closingBalance": 5,
  "movements": {
    "received": [
      {
        "date": "2025-11-14",
        "quantity": 15,
        "notes": "Initial distribution after email verification"
      }
    ],
    "used": [
      {
        "date": "2025-11-15T14:30:00Z",
        "code": "SMITH-A7K9P2M5",
        "usedBy": "user_123",
        "commission": 4.64
      }
      // ... 9 more
    ]
  },
  "activeCodes": [
    {
      "code": "SMITH-K4M9P7Q2",
      "discountPercent": 20.0,
      "expiresAt": "2025-11-30T23:59:59Z"
    }
    // ... 4 more
  ]
}
```

#### Activity 3: Copy and Share Codes

**Interaction:** Click [📋 Copy] button next to any active code

**Frontend Action:**

```javascript
// Copy to clipboard
navigator.clipboard.writeText('SMITH-K4M9P7Q2');

// Show toast notification
('Code SMITH-K4M9P7Q2 copied to clipboard!');
```

**Sharing Strategy (Affiliate's Responsibility):**

- Post on Facebook: "Get 10% off Trading Alerts PRO with code SMITH-K4M9P7Q2!"
- Instagram story with code overlay
- YouTube video description with code
- TikTok video with code in caption
- Email to subscribers
- Blog post with affiliate disclosure

---

## 2.5 Profile Management

### Journey: Update Payment Preferences

**Navigation:** Dashboard → Profile → Payment Settings

**URL:** `/affiliate/profile/payment`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Payment Preferences                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  💳 CURRENT PAYMENT METHOD                                          │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Bank Transfer                                             │   │
│  │  Bank: Chase Bank                                          │   │
│  │  Account: ****7890                                         │   │
│  │  Holder: John Smith                                        │   │
│  │                                                            │   │
│  │  [Change Payment Method]                                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📝 CHANGE PAYMENT METHOD                                           │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Select New Method:                                        │   │
│  │  (•) Bank Transfer                                         │   │
│  │  ( ) Cryptocurrency                                        │   │
│  │  ( ) Global E-Wallet                                       │   │
│  │  ( ) Local E-Wallet                                        │   │
│  │                                                            │   │
│  │  --- Bank Transfer Details ---                            │   │
│  │  Bank Name: [Chase Bank________]                           │   │
│  │  Account Number: [1234567890___]                           │   │
│  │  Account Holder: [John Smith____]                          │   │
│  │                                                            │   │
│  │  [Update Payment Method]                                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ⚠️  IMPORTANT NOTES                                               │
│  - Payment method changes take effect immediately                  │
│  - Future commission payments will use the new method              │
│  - Pending payments will still use the old method                  │
│  - Ensure all payment details are accurate to avoid delays         │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
PUT /api/affiliate/profile/payment

Request Body:
{
  "paymentMethod": "CRYPTO",
  "cryptoWalletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "preferredCryptocurrency": "USDT"
}

Response:
{
  "success": true,
  "message": "Payment method updated successfully",
  "affiliate": {
    "id": "clf1234567890",
    "paymentMethod": "CRYPTO",
    "cryptoWalletAddress": "0x742d...bEb",
    "preferredCryptocurrency": "USDT"
  }
}
```

---

## 2.6 Code Usage Notifications

### Journey: Real-Time Notification When Code is Used

**Trigger:** User applies affiliate code at checkout and completes payment

**Notification Channels:**

#### Channel 1: Email Notification

**Email Template:**

```
Subject: 🎉 Your code was just used! You earned $4.64

Hi John,

Great news! Someone just used your discount code to upgrade to PRO.

CODE USED: SMITH-K4M9P7Q2
CUSTOMER TIER: PRO (Monthly)
REGULAR PRICE: $29.00
DISCOUNT GIVEN: $5.80 (20%)
NET REVENUE: $23.20
YOUR COMMISSION: $4.64 (20%)

Total Earnings This Month: $46.40

[View Dashboard] to see detailed breakdown.

Keep sharing your codes!
Trading Alerts Team
```

#### Channel 2: In-App Notification

**Dashboard Notification Badge:**

```
┌─────────────────────────────────────┐
│  🔔 Notifications (1 new)           │
│                                     │
│  • Your code SMITH-K4M9P7Q2 was     │
│    used! +$4.64 commission earned   │
│    (2 minutes ago)                  │
└─────────────────────────────────────┘
```

#### Channel 3: Optional SMS (Future Enhancement)

**SMS Format:**

```
Trading Alerts: Your code SMITH-K4M9P7Q2 was used! +$4.64 commission. View details: https://ta.co/aff/cmm/xyz
```

---

## 3. ADMIN JOURNEY

---

## 3.1 Affiliate Management

### Journey: View and Manage All Affiliates

**Navigation:** Admin Panel → Affiliates → Affiliate List

**URL:** `/admin/affiliates`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Affiliate Management                                               │
│  Admin: Sarah Johnson (sarah@trading-alerts.com)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 OVERVIEW                                                        │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐   │
│  │ Total        │ Active       │ Pending      │ Suspended    │   │
│  │ Affiliates   │ Affiliates   │ Verification │ Affiliates   │   │
│  │    47        │     42       │      3       │      2       │   │
│  └──────────────┴──────────────┴──────────────┴──────────────┘   │
│                                                                     │
│  🔍 SEARCH & FILTER                                                 │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Search: [_______________] [🔍 Search]                     │   │
│  │  Status: [All ▼]  Country: [All ▼]  Sort: [Earnings ▼]    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  👥 AFFILIATE LIST (47)                                            │
│  ┌────┬─────────────┬────────┬──────────┬─────────┬────────┐     │
│  │ ID │ Name        │ Status │ Codes    │ Earnings│ Actions│     │
│  ├────┼─────────────┼────────┼──────────┼─────────┼────────┤     │
│  │001 │John Smith   │Active  │15/15 used│$1,240   │[View]  │     │
│  │002 │Jane Doe     │Active  │12/15 used│$987     │[View]  │     │
│  │003 │Bob Lee      │Active  │8/15 used │$654     │[View]  │     │
│  │004 │Alice Wong   │Pending │0/0       │$0       │[View]  │     │
│  │005 │Mike Chen    │Active  │15/15 used│$1,450   │[View]  │     │
│  │... │             │        │          │         │        │     │
│  │ [Page 1 of 5] [Next]                                      │     │
│  └────┴─────────────┴────────┴──────────┴─────────┴────────┘     │
│                                                                     │
│  [+ Add Affiliate Manually] [Export CSV] [Bulk Actions ▼]          │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
GET /api/admin/affiliates?page=1&limit=20&status=all&sort=earnings

Response:
{
  "affiliates": [
    {
      "id": "clf1234567890",
      "fullName": "John Smith",
      "email": "john@example.com",
      "status": "ACTIVE",
      "country": "US",
      "totalCodes": 15,
      "usedCodes": 15,
      "totalEarnings": 1240.00,
      "pendingCommissions": 240.00,
      "createdAt": "2025-11-14T10:30:00Z",
      "lastLoginAt": "2025-11-14T15:20:00Z"
    }
    // ... more affiliates
  ],
  "pagination": {
    "total": 47,
    "page": 1,
    "limit": 20,
    "pages": 3
  },
  "summary": {
    "totalAffiliates": 47,
    "activeAffiliates": 42,
    "pendingVerification": 3,
    "suspendedAffiliates": 2
  }
}
```

### Journey: View Individual Affiliate Details

**Navigation:** Affiliate List → Click [View] on specific affiliate

**URL:** `/admin/affiliates/clf1234567890`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Affiliate Details - John Smith                                     │
│  [← Back to List]                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📋 BASIC INFORMATION                                               │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Full Name: John Smith                                     │   │
│  │  Email: john@example.com                                   │   │
│  │  Country: United States                                    │   │
│  │  Status: Active ✅                                         │   │
│  │  Joined: November 14, 2025                                 │   │
│  │  Last Login: November 14, 2025 at 3:20 PM                  │   │
│  │                                                            │   │
│  │  [Suspend Account] [Send Email]                            │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📱 SOCIAL MEDIA                                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Facebook: facebook.com/johnsmith                          │   │
│  │  Instagram: instagram.com/johnsmith                        │   │
│  │  Twitter: Not provided                                     │   │
│  │  YouTube: Not provided                                     │   │
│  │  TikTok: Not provided                                      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  💳 PAYMENT INFORMATION                                             │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Method: Bank Transfer                                     │   │
│  │  Bank: Chase Bank                                          │   │
│  │  Account: ****7890                                         │   │
│  │  Holder: John Smith                                        │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📊 PERFORMANCE SUMMARY                                             │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Total Codes Distributed: 15                               │   │
│  │  Codes Used: 15 (100% conversion!)                         │   │
│  │  Total Earnings: $1,240.00                                 │   │
│  │  Pending Commissions: $240.00                              │   │
│  │  Paid Commissions: $1,000.00                               │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  🎫 CODE HISTORY                                                    │
│  ┌────────┬──────────────┬──────────┬────────────┬──────────┐    │
│  │ Date   │ Code         │ Status   │ Used By    │ Earned   │    │
│  ├────────┼──────────────┼──────────┼────────────┼──────────┤    │
│  │ Nov 14 │ SMITH-A7K9P2M5│ Used    │ user_123   │ $7.83    │    │
│  │ Nov 14 │ SMITH-B3N7Q8R2│ Used    │ user_456   │ $7.83    │    │
│  │ ... (13 more codes)                                       │    │
│  │ [Show All 15]                                             │    │
│  └────────┴──────────────┴──────────┴────────────┴──────────┘    │
│                                                                     │
│  💰 COMMISSION PAYMENTS                                             │
│  ┌────────┬────────────┬──────────┬─────────────────────────┐    │
│  │ Date   │ Amount     │ Method   │ Status                  │    │
│  ├────────┼────────────┼──────────┼─────────────────────────┤    │
│  │ Oct 31 │ $500.00    │ Bank     │ Paid ✅                 │    │
│  │ Sep 30 │ $500.00    │ Bank     │ Paid ✅                 │    │
│  │ [Show All Payments]                                       │    │
│  └────────┴────────────┴──────────┴─────────────────────────┘    │
│                                                                     │
│  🔧 ADMIN ACTIONS                                                   │
│  [Distribute Codes Manually] [Cancel Active Codes] [Mark Payment]  │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
GET /api/admin/affiliates/clf1234567890

Response:
{
  "affiliate": {
    "id": "clf1234567890",
    "fullName": "John Smith",
    "email": "john@example.com",
    "country": "US",
    "status": "ACTIVE",
    "createdAt": "2025-11-14T10:30:00Z",
    "lastLoginAt": "2025-11-14T15:20:00Z",
    "socialMedia": {
      "facebook": "facebook.com/johnsmith",
      "instagram": "instagram.com/johnsmith"
    },
    "payment": {
      "method": "BANK_TRANSFER",
      "bankName": "Chase Bank",
      "bankAccountNumber": "****7890",
      "bankAccountHolderName": "John Smith"
    },
    "performance": {
      "totalCodesDistributed": 15,
      "usedCodes": 15,
      "totalEarnings": 1240.00,
      "pendingCommissions": 240.00,
      "paidCommissions": 1000.00
    },
    "codes": [
      {
        "id": "code_001",
        "code": "SMITH-A7K9P2M5",
        "status": "USED",
        "usedAt": "2025-11-14T14:30:00Z",
        "usedBy": "user_123",
        "commission": 4.64
      }
      // ... more codes
    ],
    "payments": [
      {
        "id": "pay_001",
        "date": "2025-10-31T00:00:00Z",
        "amount": 500.00,
        "method": "BANK_TRANSFER",
        "status": "PAID"
      }
      // ... more payments
    ]
  }
}
```

---

## 3.2 Business Intelligence Reports

### Report 1: Profit & Loss (P&L) Report

**Navigation:** Admin Panel → Reports → P&L Report

**URL:** `/admin/reports/profit-loss`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Profit & Loss Report                                               │
│  Period: September 2025 - November 2025 (Last 3 months)             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 SUMMARY                                                         │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Total Revenue: $10,440.00                                 │   │
│  │  Total Discounts: $1,044.00                                │   │
│  │  Net Revenue: $9,396.00                                    │   │
│  │  Total Commissions: $2,818.80                              │   │
│  │  Total Profit: $6,577.20                                   │   │
│  │  Profit Margin: 70.0%                                      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📈 MONTHLY BREAKDOWN                                               │
│  ┌──────┬─────────┬──────────┬─────────┬────────────┬────────┐   │
│  │ Month│ Revenue │ Discounts│ Net Rev │ Commissions│ Profit │   │
│  ├──────┼─────────┼──────────┼─────────┼────────────┼────────┤   │
│  │ Sep  │ $2,900  │ $290     │ $2,610  │ $783.00    │ $1,827 │   │
│  │ Oct  │ $3,480  │ $348     │ $3,132  │ $939.60    │ $2,192 │   │
│  │ Nov  │ $4,060  │ $406     │ $3,654  │ $1,096.20  │ $2,558 │   │
│  ├──────┼─────────┼──────────┼─────────┼────────────┼────────┤   │
│  │ Total│$10,440  │ $1,044   │ $9,396  │ $2,818.80  │ $6,577 │   │
│  └──────┴─────────┴──────────┴─────────┴────────────┴────────┘   │
│                                                                     │
│  📉 PROFIT MARGIN TREND                                             │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Sep: ██████████████████████████████████████████  70.0%   │   │
│  │  Oct: ██████████████████████████████████████████  70.0%   │   │
│  │  Nov: ██████████████████████████████████████████  70.0%   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  💡 INSIGHTS                                                        │
│  • Consistent 70% profit margin across all months                  │
│  • Revenue growing 20% month-over-month                            │
│  • Affiliate channel profitable with good ROI                      │
│                                                                     │
│  [Export PDF] [Export CSV] [View Detailed Breakdown]               │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
GET /api/admin/reports/profit-loss?months=3

Response:
{
  "reportPeriod": "September 2025 - November 2025",
  "summary": {
    "totalRevenue": 10440.00,
    "totalDiscounts": 1044.00,
    "netRevenue": 9396.00,
    "totalCommissions": 2818.80,
    "totalProfit": 6577.20,
    "profitMargin": 70.0
  },
  "monthlyData": [
    {
      "month": "2025-09",
      "revenue": 2900.00,
      "discounts": 290.00,
      "netRevenue": 2610.00,
      "commissions": 783.00,
      "profit": 1827.00,
      "profitMargin": 70.0
    },
    {
      "month": "2025-10",
      "revenue": 3480.00,
      "discounts": 348.00,
      "netRevenue": 3132.00,
      "commissions": 939.60,
      "profit": 2192.40,
      "profitMargin": 70.0
    },
    {
      "month": "2025-11",
      "revenue": 4060.00,
      "discounts": 406.00,
      "netRevenue": 3654.00,
      "commissions": 1096.20,
      "profit": 2557.80,
      "profitMargin": 70.0
    }
  ]
}
```

### Report 2: Sales Performance by Affiliate

**Navigation:** Admin Panel → Reports → Sales Performance

**URL:** `/admin/reports/sales-performance`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sales Performance by Affiliate                                     │
│  Period: November 2025                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🏆 TOP PERFORMERS (November)                                       │
│  ┌────┬─────────────┬───────┬────────┬─────────┬────────────┐     │
│  │Rank│ Affiliate   │ Codes │ Conv % │ Revenue │ Commissions│     │
│  ├────┼─────────────┼───────┼────────┼─────────┼────────────┤     │
│  │ 1  │Mike Chen    │15/15  │ 100%   │ $1,450  │ $435.00    │     │
│  │ 2  │John Smith   │15/15  │ 100%   │ $1,240  │ $372.00    │     │
│  │ 3  │Jane Doe     │12/15  │ 80%    │ $987    │ $296.10    │     │
│  │ 4  │Bob Lee      │8/15   │ 53%    │ $654    │ $196.20    │     │
│  │ 5  │Sarah Johnson│5/15   │ 33%    │ $412    │ $123.60    │     │
│  │... │             │       │        │         │            │     │
│  │ [View All 42 Active Affiliates]                          │     │
│  └────┴─────────────┴───────┴────────┴─────────┴────────────┘     │
│                                                                     │
│  📊 AGGREGATE STATISTICS                                            │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Total Affiliates: 42 active                               │   │
│  │  Total Codes Distributed: 630                              │   │
│  │  Total Codes Used: 504 (80% conversion)                    │   │
│  │  Total Revenue: $41,328                                    │   │
│  │  Total Commissions: $12,398.40                             │   │
│  │  Average Revenue per Affiliate: $984.00                    │   │
│  │  Average Conversion Rate: 80%                              │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  🎯 CONVERSION RATE DISTRIBUTION                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  90-100%: 15 affiliates ███████████████                    │   │
│  │  70-89%:  12 affiliates ████████████                       │   │
│  │  50-69%:  8 affiliates  ████████                           │   │
│  │  30-49%:  5 affiliates  █████                              │   │
│  │  0-29%:   2 affiliates  ██                                 │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Export PDF] [Export CSV] [View Trends]                           │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
GET /api/admin/reports/sales-performance?month=2025-11

Response:
{
  "reportMonth": "2025-11",
  "topPerformers": [
    {
      "rank": 1,
      "affiliateId": "clf9876543210",
      "affiliateName": "Mike Chen",
      "codesDistributed": 15,
      "codesUsed": 15,
      "conversionRate": 100.0,
      "revenue": 1450.00,
      "commissions": 435.00
    }
    // ... more affiliates
  ],
  "aggregate": {
    "totalAffiliates": 42,
    "totalCodesDistributed": 630,
    "totalCodesUsed": 504,
    "overallConversionRate": 80.0,
    "totalRevenue": 41328.00,
    "totalCommissions": 12398.40,
    "averageRevenuePerAffiliate": 984.00
  },
  "conversionDistribution": {
    "90-100%": 15,
    "70-89%": 12,
    "50-69%": 8,
    "30-49%": 5,
    "0-29%": 2
  }
}
```

### Report 3: Commission Owings Report

**Navigation:** Admin Panel → Reports → Commission Owings

**URL:** `/admin/reports/commission-owings`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Commission Owings Report                                           │
│  As of: November 30, 2025                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  💰 TOTAL COMMISSION OWINGS                                         │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                                                            │   │
│  │  Total Owed to All Affiliates: $5,240.00                  │   │
│  │                                                            │   │
│  │  [Process All Payments] [Export for Accounting]           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📋 AFFILIATES WITH PENDING COMMISSIONS (28 affiliates)             │
│  ┌─────────────┬─────────────┬──────────┬──────────┬────────┐     │
│  │ Affiliate   │ Payment     │ Pending  │ Last Paid│ Action │     │
│  │             │ Method      │ Amount   │          │        │     │
│  ├─────────────┼─────────────┼──────────┼──────────┼────────┤     │
│  │ Mike Chen   │ Bank        │ $435.00  │ Oct 31   │[Pay]   │     │
│  │ John Smith  │ Bank        │ $372.00  │ Oct 31   │[Pay]   │     │
│  │ Jane Doe    │ Crypto      │ $296.10  │ Oct 31   │[Pay]   │     │
│  │ Bob Lee     │ PayPal      │ $196.20  │ Oct 31   │[Pay]   │     │
│  │ Sarah J.    │ Bank        │ $123.60  │ Oct 31   │[Pay]   │     │
│  │ ... (23 more affiliates)                                 │     │
│  │ [Page 1 of 3] [Next]                                     │     │
│  └─────────────┴─────────────┴──────────┴──────────┴────────┘     │
│                                                                     │
│  💳 PAYMENT METHOD BREAKDOWN                                        │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Bank Transfer: $3,140.00 (18 affiliates)                 │   │
│  │  Cryptocurrency: $1,260.00 (6 affiliates)                 │   │
│  │  Global E-Wallet: $630.00 (3 affiliates)                  │   │
│  │  Local E-Wallet: $210.00 (1 affiliate)                    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  🔧 BULK ACTIONS                                                    │
│  [ ] Select All                                                     │
│  [Mark Selected as Paid] [Export Selected] [Send Payment Reminders]│
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
GET /api/admin/reports/commission-owings

Response:
{
  "asOfDate": "2025-11-30",
  "totalOwings": 5240.00,
  "affiliatesWithPending": 28,
  "affiliates": [
    {
      "affiliateId": "clf9876543210",
      "affiliateName": "Mike Chen",
      "paymentMethod": "BANK_TRANSFER",
      "pendingAmount": 435.00,
      "lastPaidDate": "2025-10-31",
      "bankDetails": {
        "bankName": "Wells Fargo",
        "accountNumber": "****5678"
      }
    }
    // ... more affiliates
  ],
  "paymentMethodBreakdown": {
    "BANK_TRANSFER": { "amount": 3140.00, "count": 18 },
    "CRYPTO": { "amount": 1260.00, "count": 6 },
    "GLOBAL_WALLET": { "amount": 630.00, "count": 3 },
    "LOCAL_WALLET": { "amount": 210.00, "count": 1 }
  }
}
```

### Report 4: Aggregate Code Inventory

**Navigation:** Admin Panel → Reports → Code Inventory

**URL:** `/admin/reports/code-inventory`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Aggregate Code Inventory Report                                    │
│  Period: November 2025                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 AGGREGATE INVENTORY SUMMARY                                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  (1.0) Opening Balance (Nov 1)        126 codes           │   │
│  │  (1.1) + Distributed This Month       630 codes           │   │
│  │  (1.2) - Used                          504 codes          │   │
│  │  (1.3) - Expired                       0 codes            │   │
│  │  (1.4) - Cancelled                     2 codes            │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │   │
│  │  (1.5) = Closing Balance               250 codes          │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  🎫 CODE STATUS BREAKDOWN                                           │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Active: 250 codes                                         │   │
│  │  Used: 504 codes (lifetime)                                │   │
│  │  Expired: 0 codes                                          │   │
│  │  Cancelled: 2 codes                                        │   │
│  │  Total Ever Distributed: 756 codes                         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📈 USAGE METRICS                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Overall Conversion Rate: 80%                              │   │
│  │  Average Codes per Affiliate: 15                           │   │
│  │  Average Usage per Affiliate: 12                           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📅 MONTHLY DISTRIBUTION HISTORY                                    │
│  ┌──────┬──────────────┬──────┬─────────┬──────────────────┐     │
│  │ Month│ Distributed  │ Used │ Expired │ Conversion Rate  │     │
│  ├──────┼──────────────┼──────┼─────────┼──────────────────┤     │
│  │ Sep  │ 600          │ 480  │ 0       │ 80%              │     │
│  │ Oct  │ 630          │ 504  │ 0       │ 80%              │     │
│  │ Nov  │ 630          │ 504  │ 0       │ 80%              │     │
│  └──────┴──────────────┴──────┴─────────┴──────────────────┘     │
│                                                                     │
│  [Export PDF] [Export CSV] [View Details by Affiliate]             │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
GET /api/admin/reports/code-inventory?month=2025-11

Response:
{
  "reportMonth": "2025-11",
  "inventorySummary": {
    "openingBalance": 126,
    "distributed": 630,
    "used": 504,
    "expired": 0,
    "cancelled": 2,
    "closingBalance": 250
  },
  "statusBreakdown": {
    "active": 250,
    "used": 504,
    "expired": 0,
    "cancelled": 2,
    "totalEverDistributed": 756
  },
  "metrics": {
    "overallConversionRate": 80.0,
    "averageCodesPerAffiliate": 15,
    "averageUsagePerAffiliate": 12
  },
  "monthlyHistory": [
    {
      "month": "2025-09",
      "distributed": 600,
      "used": 480,
      "expired": 0,
      "conversionRate": 80.0
    }
    // ... more months
  ]
}
```

---

## 3.3 Manual Code Distribution

### Journey: Distribute Codes to Specific Affiliate

**Trigger:** Admin wants to give bonus codes or make up for technical issues

**Navigation:** Affiliate Details → [Distribute Codes Manually]

**URL:** `/admin/affiliates/clf1234567890/distribute-codes`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Manual Code Distribution                                           │
│  Affiliate: John Smith (john@example.com)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📋 DISTRIBUTION FORM                                               │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Number of Codes: [____]  (max 50 per request)            │   │
│  │                                                            │   │
│  │  Discount Percentage: [10]% (default)                      │   │
│  │  Commission Percentage: [30]% (default)                    │   │
│  │                                                            │   │
│  │  Expiry Date: [2025-12-31] (end of month default)         │   │
│  │                                                            │   │
│  │  Reason (internal notes):                                  │   │
│  │  [_____________________________________________]           │   │
│  │  [_____________________________________________]           │   │
│  │                                                            │   │
│  │  [ ] Send email notification to affiliate                 │   │
│  │                                                            │   │
│  │  [Generate & Distribute Codes]                             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ⚠️  IMPORTANT NOTES                                               │
│  - Manually distributed codes are tracked separately               │
│  - Codes will be added to affiliate's inventory immediately        │
│  - Email notification is recommended to inform affiliate           │
│  - Document reason for audit trail                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
POST /api/admin/affiliates/clf1234567890/distribute-codes

Request Body:
{
  "quantity": 10,
  "discountPercent": 10.0,
  "commissionPercent": 30.0,
  "expiresAt": "2025-12-31T23:59:59Z",
  "reason": "Bonus codes for excellent performance in November",
  "sendEmail": true
}

Response:
{
  "success": true,
  "message": "10 codes distributed successfully",
  "codes": [
    {
      "code": "SMITH-X7Y9Z2M5",
      "discountPercent": 20.0,
      "commissionPercent": 30.0,
      "expiresAt": "2025-12-31T23:59:59Z"
    }
    // ... 9 more codes
  ]
}
```

**Email Sent to Affiliate:**

```
Subject: Bonus Codes Distributed!

Hi John,

Great news! You've received 10 bonus codes for your excellent performance.

REASON: Bonus codes for excellent performance in November

Your new codes are now available in your dashboard:
- Total bonus codes: 10
- Discount: 10%
- Commission: 30%
- Expires: December 31, 2025

[View Dashboard] to see your new codes.

Keep up the great work!
Trading Alerts Team
```

---

## 3.4 Commission Payment Processing

### Journey: Mark Commission as Paid

**Navigation:** Commission Owings Report → Click [Pay] for specific affiliate

**URL:** `/admin/commissions/pay/clf1234567890`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mark Commission as Paid                                            │
│  Affiliate: Mike Chen (mike@example.com)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  💰 PAYMENT DETAILS                                                 │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Pending Commission Amount: $435.00                        │   │
│  │                                                            │   │
│  │  Payment Method: Bank Transfer                             │   │
│  │  Bank: Wells Fargo                                         │   │
│  │  Account: ****5678                                         │   │
│  │  Holder: Mike Chen                                         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  📋 COMMISSION BREAKDOWN (10 commissions)                           │
│  ┌────────┬──────────────┬─────────┬────────────────────────┐     │
│  │ Date   │ Code         │ Amount  │ Status                 │     │
│  ├────────┼──────────────┼─────────┼────────────────────────┤     │
│  │ Nov 15 │ CHEN-A7K9P2M5│ $43.50  │ Pending                │     │
│  │ Nov 18 │ CHEN-B3N7Q8R2│ $43.50  │ Pending                │     │
│  │ ... (8 more)                                              │     │
│  │ [Show All 10]                                             │     │
│  └────────┴──────────────┴─────────┴────────────────────────┘     │
│                                                                     │
│  ✅ CONFIRM PAYMENT                                                 │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Payment Date: [2025-11-30] (today)                        │   │
│  │                                                            │   │
│  │  Payment Reference (optional):                             │   │
│  │  [e.g., bank transaction ID, crypto hash, etc.]           │   │
│  │  [_____________________________________________]           │   │
│  │                                                            │   │
│  │  [ ] Send payment confirmation email to affiliate         │   │
│  │                                                            │   │
│  │  [Mark as Paid] [Cancel]                                   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ⚠️  This action will:                                             │
│  • Update all 10 pending commissions to PAID status                │
│  • Record payment date and reference                               │
│  • Update affiliate's total paid commissions                       │
│  • Send confirmation email (if checked)                            │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
POST /api/admin/commissions/pay

Request Body:
{
  "affiliateId": "clf9876543210",
  "paymentDate": "2025-11-30",
  "paymentReference": "BANK-TXN-12345678",
  "sendEmail": true
}

Response:
{
  "success": true,
  "message": "Payment marked successfully",
  "summary": {
    "affiliateId": "clf9876543210",
    "affiliateName": "Mike Chen",
    "totalPaid": 435.00,
    "commissionsUpdated": 10,
    "paymentDate": "2025-11-30",
    "paymentReference": "BANK-TXN-12345678"
  }
}
```

**Database Updates:**

```sql
-- Update all pending commissions for this affiliate
UPDATE commissions
SET status = 'PAID',
    paidAt = '2025-11-30',
    paymentReference = 'BANK-TXN-12345678'
WHERE affiliateId = 'clf9876543210'
  AND status = 'PENDING';

-- Update affiliate's total paid
UPDATE affiliates
SET totalPaidCommissions = totalPaidCommissions + 435.00
WHERE id = 'clf9876543210';
```

**Email Sent to Affiliate:**

```
Subject: Commission Payment Processed - $435.00

Hi Mike,

Your commission payment has been processed!

PAYMENT DETAILS:
Amount: $435.00
Date: November 30, 2025
Method: Bank Transfer to Wells Fargo ****5678
Reference: BANK-TXN-12345678

This payment covers 10 commissions earned in November 2025.

You should receive the funds in your bank account within 2-3 business days.

[View Payment History] in your dashboard.

Questions? Reply to this email.

Thank you for promoting Trading Alerts!
Trading Alerts Team
```

---

## 3.5 Code Cancellation

### Journey: Cancel Specific Codes

**Trigger:** Admin discovers fraud, duplicate distribution, or other issues

**Navigation:** Affiliate Details → Code History → [Cancel] specific code

**URL:** `/admin/codes/code_001/cancel`

**Page Components:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Cancel Discount Code                                               │
│  Code: SMITH-A7K9P2M5                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🎫 CODE DETAILS                                                    │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Code: SMITH-A7K9P2M5                                      │   │
│  │  Affiliate: John Smith (john@example.com)                  │   │
│  │  Status: Active                                            │   │
│  │  Discount: 10%                                             │   │
│  │  Commission: 30%                                           │   │
│  │  Created: November 14, 2025                                │   │
│  │  Expires: November 30, 2025                                │   │
│  │  Used: No                                                  │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ❌ CANCEL CODE                                                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Reason for Cancellation (required):                       │   │
│  │  ( ) Duplicate distribution                                │   │
│  │  ( ) Fraudulent activity                                   │   │
│  │  ( ) Technical error                                       │   │
│  │  (•) Other (specify below)                                 │   │
│  │                                                            │   │
│  │  Additional Notes:                                         │   │
│  │  [_____________________________________________]           │   │
│  │  [_____________________________________________]           │   │
│  │                                                            │   │
│  │  [ ] Notify affiliate via email                            │   │
│  │                                                            │   │
│  │  [Cancel Code] [Back]                                      │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ⚠️  WARNING                                                       │
│  • This action is IRREVERSIBLE                                     │
│  • Code will be permanently deactivated                            │
│  • Affiliate will lose this code from inventory                    │
│  • If already used, cancellation will NOT affect commission        │
└─────────────────────────────────────────────────────────────────────┘
```

**API Call:**

```
POST /api/admin/codes/code_001/cancel

Request Body:
{
  "reason": "OTHER",
  "notes": "Accidentally distributed twice due to technical glitch",
  "notifyAffiliate": true
}

Response:
{
  "success": true,
  "message": "Code SMITH-A7K9P2M5 cancelled successfully",
  "code": {
    "id": "code_001",
    "code": "SMITH-A7K9P2M5",
    "status": "CANCELLED",
    "cancelledAt": "2025-11-30T10:00:00Z",
    "cancelReason": "Accidentally distributed twice due to technical glitch"
  }
}
```

**Database Update:**

```sql
UPDATE affiliate_codes
SET status = 'CANCELLED',
    cancelledAt = '2025-11-30T10:00:00Z',
    cancelReason = 'Accidentally distributed twice due to technical glitch'
WHERE id = 'code_001';
```

**Email Sent to Affiliate (if checked):**

```
Subject: Discount Code Cancelled - SMITH-A7K9P2M5

Hi John,

We've cancelled one of your discount codes due to a technical issue.

CODE CANCELLED: SMITH-A7K9P2M5
REASON: Accidentally distributed twice due to technical glitch

This code has been removed from your inventory and is no longer valid.

If you have any questions or concerns, please contact our support team.

Apologies for any inconvenience.
Trading Alerts Team
```

---

## 3.6 Affiliate Settings Management

**Purpose:** Admin can change system-wide affiliate discount and commission percentages from the dashboard. All pages automatically reflect new values within 1-5 minutes.

**Access:** Admin Dashboard → Settings → Affiliate System

**Scenario:** Admin wants to increase commission from 20% to 25% to attract more affiliates for Q1 marketing campaign.

---

### Step-by-Step Workflow:

**1. Navigate to Settings**

```
┌─────────────────────────────────────────────────────────────┐
│  Admin Dashboard                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 Analytics     👥 Users     💳 Affiliates     ⚙️ Settings  │
│                                                   ^^^^       │
│                                                  [CLICK]     │
└─────────────────────────────────────────────────────────────┘
```

**2. View Current Settings**

```
┌─────────────────────────────────────────────────────────────┐
│  Settings → Affiliate System Configuration                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Current Affiliate Settings                                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Customer Discount                                       │ │
│  │ 20.0 %                                                  │ │
│  │ Last updated: Nov 10, 2025 by admin@tradingalerts.com │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Affiliate Commission                                    │ │
│  │ 20.0 %                                                  │ │
│  │ Last updated: Nov 10, 2025 by admin@tradingalerts.com │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Codes Per Affiliate Monthly                             │ │
│  │ 15 codes                                                │ │
│  │ Last updated: Nov 10, 2025 by admin@tradingalerts.com │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [ Edit Settings ]     [ View Change History ]             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**3. Click "Edit Settings"**

```
┌─────────────────────────────────────────────────────────────┐
│  Update Affiliate Settings                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Customer Discount Percentage                               │
│  [20.0] %  (0 - 100)                                        │
│                                                              │
│  Affiliate Commission Percentage                            │
│  [20.0] %  (0 - 100)                                        │
│                                                              │
│  Codes Per Affiliate Monthly                                │
│  [15] codes  (1 - 100)                                      │
│                                                              │
│  Reason for Change (Optional)                               │
│  [Increasing commission to attract more affiliates for Q1  │
│   marketing campaign                                     ] │
│                                                              │
│  ⚠️  IMPORTANT NOTICE:                                       │
│  • Existing codes and commissions keep original percentages│
│  • Only NEW codes generated after this change will use new │
│    percentages                                              │
│  • All web pages will update within 1-5 minutes            │
│  • Change will be logged to audit history                  │
│                                                              │
│  Live Preview:                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Regular PRO Price: $29.00/month                       │  │
│  │ Customer with code pays: $23.20/month                 │  │
│  │ Platform revenue: $18.56                              │  │
│  │ Affiliate earns: $4.64                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [ Cancel ]                          [ Save Changes ]       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**4. Admin Changes Commission to 25%**

```
  Affiliate Commission Percentage
  [25.0] % ← Changed from 20.0 to 25.0
```

**5. Live Preview Updates Automatically**

```
  Live Preview:
  ┌──────────────────────────────────────────────────────┐
  │ Regular PRO Price: $29.00/month                       │
  │ Customer with code pays: $23.20/month (20% discount) │
  │ Platform revenue: $17.40  ← Updated                   │
  │ Affiliate earns: $5.80    ← Updated (was $4.64)       │
  └──────────────────────────────────────────────────────┘
```

**6. Admin Clicks "Save Changes"**

**7. Confirmation Dialog**

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️  Confirm Settings Update                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  You are about to update:                                   │
│                                                              │
│  • Affiliate Commission: 20.0% → 25.0%                      │
│                                                              │
│  Impact:                                                    │
│  • 523 existing codes: Keep 20% commission ✅               │
│  • New codes: Will use 25% commission 🆕                    │
│  • All web pages update within 5 minutes 🔄                 │
│                                                              │
│  This action will be logged to audit history.               │
│                                                              │
│  [ Go Back ]                           [ Confirm Update ]   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**8. Success Notification**

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ Settings Updated Successfully                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Affiliate commission changed from 20% to 25%               │
│                                                              │
│  Changes are now propagating across:                        │
│  ✅ Marketing homepage                                       │
│  ✅ Pricing page                                             │
│  ✅ User dashboard                                           │
│  ✅ Affiliate dashboard                                      │
│  ✅ Admin panels                                             │
│  ✅ Email templates                                          │
│                                                              │
│  All pages will reflect new values within 1-5 minutes.     │
│                                                              │
│  [ View Change History ]             [ Back to Dashboard ]  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### View Change History

**Admin clicks "View Change History"**

```
┌─────────────────────────────────────────────────────────────┐
│  Affiliate Settings Change History                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Filter: [All Settings ▼]    Search: [                  ] │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Nov 15, 2025 3:45 PM - admin@tradingalerts.com       │  │
│  │ Changed: Affiliate Commission                         │  │
│  │ Old Value: 20.0%  →  New Value: 25.0%                 │  │
│  │ Reason: Increasing commission to attract more         │  │
│  │         affiliates for Q1 marketing campaign          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Nov 10, 2025 10:00 AM - admin@tradingalerts.com      │  │
│  │ Changed: Codes Per Affiliate Monthly                  │  │
│  │ Old Value: 10  →  New Value: 15                       │  │
│  │ Reason: Increasing code distribution for holiday      │  │
│  │         season promotion                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Nov 1, 2025 12:00 AM - SYSTEM                         │  │
│  │ Changed: Customer Discount                            │  │
│  │ Old Value: 10.0%  →  New Value: 20.0%                 │  │
│  │ Reason: Updated business model from 10%/30% to 20%/20%│  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Showing 3 of 3 changes                                     │
│                                                              │
│  [ Export to CSV ]                      [ Back ]            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### API Sequence Diagram

```
Admin                 Frontend                Backend              Database
  │                      │                      │                    │
  │  1. Navigate to Settings                   │                    │
  ├─────────────────────>│                      │                    │
  │                      │  GET /api/admin/settings/affiliate       │
  │                      ├─────────────────────>│                    │
  │                      │                      │  SELECT * FROM    │
  │                      │                      │  SystemConfig     │
  │                      │                      ├───────────────────>│
  │                      │                      │<───────────────────┤
  │                      │<─────────────────────┤                    │
  │  2. Display current settings               │                    │
  │<─────────────────────┤                      │                    │
  │                      │                      │                    │
  │  3. Change commission to 25%               │                    │
  ├─────────────────────>│                      │                    │
  │                      │  (Live preview updates locally)            │
  │                      │                      │                    │
  │  4. Click Save       │                      │                    │
  ├─────────────────────>│                      │                    │
  │                      │  PATCH /api/admin/settings/affiliate      │
  │                      ├─────────────────────>│                    │
  │                      │  {                   │                    │
  │                      │    commissionPercent: 25.0,                │
  │                      │    reason: "Q1 campaign"                   │
  │                      │  }                   │                    │
  │                      │                      │  BEGIN TRANSACTION │
  │                      │                      ├───────────────────>│
  │                      │                      │  UPDATE SystemConfig│
  │                      │                      │  SET value='25.0'  │
  │                      │                      ├───────────────────>│
  │                      │                      │  INSERT INTO       │
  │                      │                      │  SystemConfigHistory│
  │                      │                      ├───────────────────>│
  │                      │                      │  COMMIT            │
  │                      │                      ├───────────────────>│
  │                      │<─────────────────────┤                    │
  │  5. Success notification                   │                    │
  │<─────────────────────┤                      │                    │
  │                      │                      │                    │
  │  6. All pages auto-refresh within 5min (SWR cache)              │
  │                      │                      │                    │
```

---

### Database Changes

**SystemConfig Table:**

```sql
-- Before
UPDATE SystemConfig
SET value = '25.0', updatedBy = 'admin_user_id', updatedAt = NOW()
WHERE key = 'affiliate_commission_percent';

-- After
key: 'affiliate_commission_percent'
value: '25.0'  (was '20.0')
updatedBy: 'clxyz123admin'
updatedAt: '2025-11-15 15:45:00'
```

**SystemConfigHistory Table (Audit Trail):**

```sql
INSERT INTO SystemConfigHistory (
  id, configKey, oldValue, newValue, changedBy, changedAt, reason
) VALUES (
  'clhist789',
  'affiliate_commission_percent',
  '20.0',
  '25.0',
  'admin@tradingalerts.com',
  '2025-11-15 15:45:00',
  'Increasing commission to attract more affiliates for Q1 marketing campaign'
);
```

---

### Impact on Existing Data

**Existing Codes (DO NOT CHANGE):**

```sql
-- 523 existing codes keep original 20% commission
SELECT id, code, discountPercent, commissionPercent
FROM AffiliateCode
WHERE createdAt < '2025-11-15 15:45:00';

Result:
- All 523 codes still have commissionPercent = 20.0 ✅
- No retroactive changes to preserve historical accuracy
```

**New Codes (USE NEW VALUES):**

```sql
-- Next monthly distribution (Dec 1) generates codes with 25% commission
-- Code distribution cron job fetches from SystemConfig:
const commissionConfig = await prisma.systemConfig.findUnique({
  where: { key: 'affiliate_commission_percent' }
});
const commissionPercent = parseFloat(commissionConfig.value); // 25.0

-- Generates codes with new percentage
INSERT INTO AffiliateCode (commissionPercent, ...)
VALUES (25.0, ...);  -- Uses updated value
```

---

### Frontend Pages Auto-Update

**Pages that automatically reflect new 25% commission:**

1. **Marketing Homepage** (`/`)
   - "Affiliates earn 25% commission" (was 20%)
   - useAffiliateConfig() hook fetches from /api/config/affiliate

2. **Pricing Page** (`/pricing`)
   - Calculator shows "$5.80 commission" (was $4.64)

3. **Affiliate Dashboard** (`/affiliate/dashboard`)
   - Earnings preview shows new percentages
   - "You'll earn $5.80 per sale" (was $4.64)

4. **Admin Panels** (`/admin/affiliates/*`)
   - Commission calculation preview shows 25%

5. **Email Templates**
   - Welcome emails show "25% commission on every sale"
   - Code distribution emails reference current percentages

**Update Mechanism:**

- SWR refreshes /api/config/affiliate every 5 minutes
- Admin can force immediate refresh by reloading page
- Cache invalidation ensures consistency

---

## 4. AFFILIATE-ADMIN INTERACTIONS

### Interaction 1: Affiliate Requests Additional Codes

**Scenario:** Affiliate has used all 15 codes and wants more before next monthly distribution

**Affiliate Action:**

1. Login to dashboard
2. Navigate to Profile → Contact Admin
3. Fill request form:

```
┌─────────────────────────────────────────────────────────────┐
│  Request Additional Codes                                   │
│                                                              │
│  Current Codes Available: 0                                 │
│  Next Distribution: December 1, 2025 (2 days)               │
│                                                              │
│  Reason for Request:                                        │
│  [I've used all my codes and have 5 more potential         │
│   customers ready to purchase. Please provide additional   │
│   codes to maximize conversions before month-end.]         │
│                                                              │
│  Requested Quantity: [10]                                   │
│                                                              │
│  [Submit Request]                                            │
└─────────────────────────────────────────────────────────────┘
```

**Admin Receives:**

- Email notification: "John Smith requested 10 additional codes"
- Dashboard notification badge

**Admin Review:**

1. Navigate to Affiliate Details for John Smith
2. Review performance (100% conversion rate)
3. Decide: Approve or Reject

**If Approved:**

- Admin distributes 10 codes manually
- Email sent to affiliate: "Your request has been approved! 10 new codes distributed."

**If Rejected:**

- Admin sends message: "Thank you for your request. Please wait for next monthly distribution on Dec 1."

---

### Interaction 2: Admin Suspends Affiliate Account

**Scenario:** Admin detects fraudulent activity

**Admin Action:**

1. Navigate to Affiliate Details
2. Click [Suspend Account]
3. Fill suspension form:

```
┌─────────────────────────────────────────────────────────────┐
│  Suspend Affiliate Account                                  │
│  Affiliate: John Smith                                      │
│                                                              │
│  Reason:                                                    │
│  (•) Fraudulent activity                                    │
│  ( ) Terms of service violation                             │
│  ( ) Other                                                  │
│                                                              │
│  Details:                                                   │
│  [Detected code sharing on unauthorized platforms]         │
│                                                              │
│  [ ] Deactivate all active codes                            │
│  [ ] Hold pending commissions                               │
│  [•] Send suspension notice email                           │
│                                                              │
│  [Suspend Account]                                           │
└─────────────────────────────────────────────────────────────┘
```

**API Call:**

```
POST /api/admin/affiliates/clf1234567890/suspend

Request Body:
{
  "reason": "FRAUDULENT_ACTIVITY",
  "details": "Detected code sharing on unauthorized platforms",
  "deactivateCodes": true,
  "holdCommissions": true,
  "sendEmail": true
}
```

**Effects:**

- Affiliate status changed to SUSPENDED
- All active codes deactivated
- Login disabled
- Pending commissions held

**Email Sent to Affiliate:**

```
Subject: Account Suspended - Action Required

Dear John,

Your affiliate account has been suspended due to a violation of our terms of service.

REASON: Fraudulent activity
DETAILS: Detected code sharing on unauthorized platforms

IMPACTS:
• Your account access has been disabled
• All active discount codes have been deactivated
• Pending commissions are on hold pending investigation

If you believe this is an error, please contact us at affiliates@trading-alerts.com within 7 days.

Trading Alerts Team
```

---

### Interaction 3: Affiliate Updates Payment Method

**Scenario:** Affiliate wants to change from Bank Transfer to Cryptocurrency

**Affiliate Action:**

1. Login to dashboard
2. Navigate to Profile → Payment Settings
3. Change payment method from Bank Transfer to Cryptocurrency
4. Fill crypto wallet details
5. Click [Update Payment Method]

**Backend Processing:**

```
POST /api/affiliate/profile/payment

Request:
{
  "paymentMethod": "CRYPTO",
  "cryptoWalletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "preferredCryptocurrency": "USDT"
}
```

**Admin Notification:**

- Email: "John Smith updated payment method from BANK_TRANSFER to CRYPTO"
- Admin can view change history in Affiliate Details

**Impact on Next Payment:**

- Future commission payments will use new crypto wallet
- Admin sees updated payment details in Commission Owings Report

---

## 5. AUTOMATED MONTHLY PROCESSES

### Process 1: Monthly Code Distribution (Vercel Cron)

**Schedule:** 1st day of each month, 00:00 UTC

**Cron Configuration:**

```typescript
// api/cron/distribute-codes/route.ts

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Query all active affiliates
  const activeAffiliates = await prisma.affiliate.findMany({
    where: { status: 'ACTIVE' },
  });

  // 2. For each affiliate, generate 15 codes
  for (const affiliate of activeAffiliates) {
    const codes = [];
    for (let i = 0; i < 15; i++) {
      const randomCode = await generateRandomCode(affiliate.fullName);
      codes.push({
        code: randomCode,
        affiliateId: affiliate.id,
        status: 'ACTIVE',
        discountPercent: 20.0,
        commissionPercent: 20.0,
        expiresAt: endOfMonth(new Date()),
      });
    }

    // 3. Bulk insert codes
    await prisma.affiliateCode.createMany({ data: codes });

    // 4. Update affiliate stats
    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { codesDistributed: { increment: 15 } },
    });

    // 5. Send email notification
    await sendEmail({
      to: affiliate.email,
      subject: 'Monthly Codes Distributed',
      body: `Hi ${affiliate.fullName}, your 15 new codes are ready!`,
    });
  }

  return NextResponse.json({
    success: true,
    affiliatesProcessed: activeAffiliates.length,
    codesDistributed: activeAffiliates.length * 15,
  });
}
```

**vercel.json:**

```json
{
  "crons": [
    {
      "path": "/api/cron/distribute-codes",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

---

### Process 2: Monthly Code Expiry (Vercel Cron)

**Schedule:** Last day of each month, 23:59 UTC

**Cron Job:**

```typescript
// api/cron/expire-codes/route.ts

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find all ACTIVE codes that expire today
  const expiredCodes = await prisma.affiliateCode.updateMany({
    where: {
      status: 'ACTIVE',
      expiresAt: {
        lte: new Date(),
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  // Send summary email to admin
  await sendEmail({
    to: 'admin@trading-alerts.com',
    subject: 'Monthly Code Expiry Report',
    body: `${expiredCodes.count} codes expired on ${new Date().toLocaleDateString()}`,
  });

  return NextResponse.json({
    success: true,
    codesExpired: expiredCodes.count,
  });
}
```

**vercel.json:**

```json
{
  "crons": [
    {
      "path": "/api/cron/expire-codes",
      "schedule": "59 23 28-31 * *"
    }
  ]
}
```

---

## 6. EMAIL NOTIFICATIONS

### Email 1: Affiliate Registration (Verification Required)

**Trigger:** New affiliate registers
**Recipient:** Affiliate
**Subject:** Verify Your Affiliate Account - Trading Alerts

**Body:**

```
Hi [Full Name],

Welcome to the Trading Alerts Affiliate Program!

To activate your account and start earning commissions, please verify your email address by clicking the link below:

[Verify Email Address]

This link will expire in 24 hours.

If you didn't create this account, please ignore this email.

Best regards,
Trading Alerts Team
```

---

### Email 2: Welcome Email (After Verification)

**Trigger:** Email verification successful
**Recipient:** Affiliate
**Subject:** Welcome to Trading Alerts Affiliate Program!

**Body:**

```
Hi [Full Name],

Your affiliate account is now active! 🎉

We've distributed your first batch of 15 discount codes. You can now:

1. Login to your affiliate dashboard
2. View your discount codes
3. Share codes with potential customers
4. Track your commissions in real-time

[Login to Dashboard]

Dashboard Highlights:
- 15 active discount codes ready to share
- Real-time commission tracking
- Detailed performance reports
- Monthly automatic code distribution (15 codes/month)

Commission Structure:
- 20% discount for customers
- 20% commission for you on net revenue

Questions? Reply to this email or visit our Help Center.

Happy promoting!
Trading Alerts Team
```

---

### Email 3: Code Usage Notification

**Trigger:** User applies affiliate code at checkout
**Recipient:** Affiliate
**Subject:** 🎉 Your code was just used! You earned $[Amount]

**Body:**

```
Hi [Full Name],

Great news! Someone just used your discount code to upgrade to [Tier].

CODE USED: [Code]
CUSTOMER TIER: [Tier]
REGULAR PRICE: $[Price]
DISCOUNT GIVEN: $[Discount] (20%)
NET REVENUE: $[Net]
YOUR COMMISSION: $[Commission] (20%)

Total Earnings This Month: $[Total]

[View Dashboard] to see detailed breakdown.

Keep sharing your codes!
Trading Alerts Team
```

---

### Email 4: Monthly Code Distribution

**Trigger:** Automated monthly distribution (1st of month)
**Recipient:** Affiliate
**Subject:** Monthly Codes Distributed - 15 New Codes

**Body:**

```
Hi [Full Name],

Your monthly discount codes have been distributed!

NEW CODES: 15
EXPIRES: [End of Month]
DISCOUNT: 10%
YOUR COMMISSION: 30%

[View Codes in Dashboard]

Tips for Success:
• Share codes across all your social media platforms
• Include codes in YouTube video descriptions
• Post regularly to maintain visibility
• Track which platforms drive most conversions

Need more codes? Contact us if you run out before month-end.

Happy promoting!
Trading Alerts Team
```

---

### Email 5: Commission Payment Processed

**Trigger:** Admin marks commission as paid
**Recipient:** Affiliate
**Subject:** Commission Payment Processed - $[Amount]

**Body:**

```
Hi [Full Name],

Your commission payment has been processed!

PAYMENT DETAILS:
Amount: $[Amount]
Date: [Date]
Method: [Payment Method]
Reference: [Reference Number]

This payment covers [Count] commissions earned in [Month].

You should receive the funds in your [payment method] within 2-3 business days.

[View Payment History] in your dashboard.

Questions? Reply to this email.

Thank you for promoting Trading Alerts!
Trading Alerts Team
```

---

### Email 6: Account Suspended

**Trigger:** Admin suspends affiliate account
**Recipient:** Affiliate
**Subject:** Account Suspended - Action Required

**Body:**

```
Dear [Full Name],

Your affiliate account has been suspended due to a violation of our terms of service.

REASON: [Reason]
DETAILS: [Details]

IMPACTS:
• Your account access has been disabled
• All active discount codes have been deactivated
• Pending commissions are on hold pending investigation

If you believe this is an error, please contact us at affiliates@trading-alerts.com within 7 days.

Trading Alerts Team
```

---

### Email 7: Admin - New Affiliate Registration

**Trigger:** New affiliate registers (after verification)
**Recipient:** Admin
**Subject:** New Affiliate Registered - [Full Name]

**Body:**

```
New affiliate has joined the program:

NAME: [Full Name]
EMAIL: [Email]
COUNTRY: [Country]
JOINED: [Date]
PAYMENT METHOD: [Method]

SOCIAL MEDIA:
- Facebook: [URL or "Not provided"]
- Instagram: [URL or "Not provided"]
- YouTube: [URL or "Not provided"]

[View Affiliate Details]

15 codes have been distributed automatically.
```

---

### Email 8: Admin - Code Request from Affiliate

**Trigger:** Affiliate requests additional codes
**Recipient:** Admin
**Subject:** Code Request - [Affiliate Name] wants [Quantity] codes

**Body:**

```
Affiliate has requested additional codes:

AFFILIATE: [Full Name]
EMAIL: [Email]
CURRENT CODES: [Available/Total]
CONVERSION RATE: [Rate]%
REQUESTED: [Quantity] codes

REASON:
[Affiliate's reason]

[Approve Request] [View Affiliate Details]
```

---

## 7. ERROR SCENARIOS

### Error 1: Duplicate Email During Registration

**Scenario:** Affiliate tries to register with email already in system

**API Response:**

```json
{
  "success": false,
  "error": "Email already registered",
  "message": "This email is already associated with an affiliate account. Please login instead."
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────┐
│  ❌ Registration Failed                                  │
│                                                          │
│  This email is already registered.                      │
│                                                          │
│  [Login Instead] [Forgot Password?]                     │
└─────────────────────────────────────────────────────────┘
```

---

### Error 2: Expired Verification Token

**Scenario:** Affiliate clicks verification link after 24 hours

**API Response:**

```json
{
  "success": false,
  "error": "Token expired",
  "message": "This verification link has expired. Please request a new one."
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️  Verification Link Expired                          │
│                                                          │
│  This verification link is no longer valid.             │
│  Please request a new verification email.               │
│                                                          │
│  [Resend Verification Email]                             │
└─────────────────────────────────────────────────────────┘
```

---

### Error 3: Login with Unverified Email

**Scenario:** Affiliate tries to login before verifying email

**API Response:**

```json
{
  "success": false,
  "error": "Email not verified",
  "message": "Please verify your email before logging in. Check your inbox for the verification link."
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️  Email Not Verified                                 │
│                                                          │
│  Please verify your email before logging in.            │
│  Check your inbox for the verification link.            │
│                                                          │
│  [Resend Verification Email]                             │
└─────────────────────────────────────────────────────────┘
```

---

### Error 4: Suspended Account Login

**Scenario:** Affiliate tries to login with suspended account

**API Response:**

```json
{
  "success": false,
  "error": "Account suspended",
  "message": "Your account has been suspended. Please contact support for assistance."
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────┐
│  🚫 Account Suspended                                    │
│                                                          │
│  Your account has been suspended.                       │
│  Please contact support for assistance.                 │
│                                                          │
│  [Contact Support]                                       │
└─────────────────────────────────────────────────────────┘
```

---

### Error 5: Invalid Discount Code at Checkout

**Scenario:** User enters invalid or expired affiliate code at checkout

**API Response:**

```json
{
  "success": false,
  "error": "Invalid code",
  "message": "This discount code is invalid or has expired."
}
```

**UI Display (Checkout Page):**

```
┌─────────────────────────────────────────────────────────┐
│  Discount Code                                          │
│                                                          │
│  Code: [SMITH-INVALID___] [Apply]                       │
│                                                          │
│  ❌ This discount code is invalid or has expired.       │
└─────────────────────────────────────────────────────────┘
```

---

### Error 6: Code Already Used

**Scenario:** User tries to use affiliate code that was already used by another user

**API Response:**

```json
{
  "success": false,
  "error": "Code already used",
  "message": "This discount code has already been used and is no longer valid."
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────┐
│  Discount Code                                          │
│                                                          │
│  Code: [SMITH-A7K9P2M5__] [Apply]                       │
│                                                          │
│  ❌ This code has already been used.                    │
│  Please contact the affiliate for a new code.           │
└─────────────────────────────────────────────────────────┘
```

---

### Error 7: Payment Processing Failed

**Scenario:** Admin tries to mark commission as paid but database update fails

**API Response:**

```json
{
  "success": false,
  "error": "Database error",
  "message": "Failed to process payment. Please try again or contact technical support."
}
```

**UI Display:**

```
┌─────────────────────────────────────────────────────────┐
│  ❌ Payment Processing Failed                            │
│                                                          │
│  An error occurred while processing the payment.        │
│  Please try again. If the problem persists, contact     │
│  technical support.                                     │
│                                                          │
│  [Try Again] [Contact Support]                           │
└─────────────────────────────────────────────────────────┘
```

---

### Error 8: Cron Job Failure (Code Distribution)

**Scenario:** Automated monthly code distribution fails

**Admin Email Notification:**

```
Subject: ⚠️ URGENT - Monthly Code Distribution Failed

Admin,

The automated monthly code distribution cron job failed.

DATE: December 1, 2025
TIME: 00:00 UTC
ERROR: Database connection timeout

IMPACT:
- Active affiliates did NOT receive their monthly 15 codes
- Manual distribution required

ACTION REQUIRED:
1. Investigate database connection issue
2. Manually run code distribution script
3. Verify all affiliates received codes

[View Cron Logs] [Run Manual Distribution]

System Administrator
```

**Admin Action:**

- Navigate to Admin Panel → System → Cron Jobs
- Click [Run Manual Distribution]
- System distributes codes to all affiliates who didn't receive them
- Confirm success

---

## SUMMARY

This document comprehensively covers:

✅ **Affiliate Journey:**

- Registration & onboarding
- Email verification
- First login & dashboard
- Daily workflow (commissions, codes, profile)
- Code usage notifications

✅ **Admin Journey:**

- Affiliate management (list, details)
- Business intelligence reports (P&L, Sales Performance, Commission Owings, Code Inventory)
- Manual code distribution
- Commission payment processing
- Code cancellation

✅ **Affiliate-Admin Interactions:**

- Code requests
- Account suspensions
- Payment method updates

✅ **Automated Processes:**

- Monthly code distribution (Vercel Cron)
- Monthly code expiry (Vercel Cron)

✅ **Email Notifications:**

- 8 different email templates for various triggers

✅ **Error Scenarios:**

- 8 common error cases with proper handling

---

**Next Steps:**

1. Create mermaid diagrams for these journeys
2. Minimal update to user journey (checkout discount code)
3. Update remaining documentation (DB schema, OpenAPI spec, etc.)

**Estimated Completion:** ~4 hours for journey docs + 3 hours for diagrams = 7 hours total

---

**Last Updated:** 2025-11-14
**Version:** 1.0.0
**Status:** Complete ✅
