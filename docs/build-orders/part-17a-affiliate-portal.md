# Part 17A: Affiliate Marketing Platform - Affiliate Portal - Build Order

**From:** `docs/v5-structure-division.md` Part 17 (Phases A-D)
**Total Files:** 32 files
**Estimated Time:** 24 hours (3 days)
**Priority:** ⭐⭐ Medium (Post-MVP)
**Complexity:** High

---

## Overview

**Scope:** Affiliate portal with self-service registration, authentication, code distribution, and commission tracking for affiliate users.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_q.md` - Affiliate marketing business logic, commission structure, and system workflows
- `docs/policies/06-aider-instructions.md` Section 12 - Affiliate-specific patterns and validation rules
- `docs/v5-structure-division.md` Part 17 - Complete file list and structural organization

**Key Features:**

- Self-service affiliate registration
- Unified authentication (single session for SaaS user + affiliate roles)
- Monthly code distribution (15 codes/affiliate)
- Commission tracking ($5 per PRO upgrade)
- Accounting-style reports
- Integration with Stripe checkout

**Dependencies:**

- Part 2 complete (Prisma schema updates for User.isAffiliate, AffiliateProfile, AffiliateCode, Commission models)
- Part 5 complete (Unified authentication with affiliate support via session.user.isAffiliate)
- Part 12 complete (Stripe integration for commission tracking)

**Next Part:** Part 17B (Admin Portal + Automation) - Phases E-H

---

## File Build Order

### Phase A: Foundation (10 files, ~6 hours)

**File 1/32:** `prisma/schema.prisma` (ALREADY UPDATED - VERIFY ONLY)

- **Note:** Schema already updated with unified auth approach
- User model has: isAffiliate Boolean field (default false)
- AffiliateProfile model (1-to-1 with User via userId): fullName, country, paymentMethod, status, etc.
- AffiliateCode model: code, affiliateProfileId, status, distributedAt, expiresAt, usedAt, etc.
- Commission model: affiliateProfileId, affiliateCodeId, userId, amount, status, earnedAt, paidAt, etc.
- Enums: AffiliateStatus, CodeStatus, DistributionReason, PaymentMethod, CommissionStatus
- Subscription model: has affiliateCodeId field
- **Action:** Verify schema matches unified auth design (no separate Affiliate model)
- Pattern: See v5_part_q.md Section 13 (Database Schema)
- Commit: `chore(affiliate): verify schema for unified auth` (no changes expected)

**File 2/32:** `prisma/migrations/YYYYMMDD_add_affiliate_models.sql`

- Migration for affiliate tables (if not already created)
- Dependencies: File 1
- Run: `npx prisma migrate dev --name add_affiliate_models`
- Commit: (included in File 1 commit)

**File 3/32:** ~~`lib/auth/affiliate-auth.ts`~~ **REMOVED - NOT NEEDED WITH UNIFIED AUTH**

- **Note:** With unified authentication, affiliates use the same NextAuth session as SaaS users
- **Instead:** Use `session.user.isAffiliate` to check affiliate status
- **Authentication:** Handled by existing `lib/auth/session.ts` helpers (requireAuth, requireAffiliate, getAffiliateProfile)
- **No separate JWT needed** - single session for dual roles (SaaS user + affiliate)
- **Pattern:** Use existing NextAuth session from Part 5

**File 4/32:** `lib/affiliate/code-generator.ts`

- Generate crypto-secure affiliate codes
- Function: generateUniqueCode() using crypto.randomBytes()
- Function: distributeCodes(affiliateProfileId, count, reason)
- Code format: 8 characters, alphanumeric uppercase
- Pattern: Pattern 8 from 06-aider-instructions.md Section 12.2
- Dependencies: File 1-2
- Commit: `feat(affiliate): add crypto-secure code generator`

**File 5/32:** `lib/affiliate/commission-calculator.ts`

- Calculate commission amounts
- Fixed $5 per PRO upgrade
- Functions: calculateCommission(netRevenue, discount)
- Pattern: Pattern 9 from 06-aider-instructions.md Section 12.2
- Dependencies: File 1-2
- Commit: `feat(affiliate): add commission calculator`

**File 6/32:** `lib/affiliate/report-builder.ts`

- Build accounting-style reports
- Functions: buildCodeInventoryReport(affiliateProfileId, period)
- Functions: buildCommissionReport(affiliateProfileId, period)
- Reconciliation logic (opening + additions - reductions = closing)
- Pattern: Pattern 10 from 06-aider-instructions.md Section 12.2
- Dependencies: File 1-2
- Commit: `feat(affiliate): add report builder for accounting reports`

**File 7/32:** `lib/affiliate/validators.ts`

- Validate affiliate codes
- Functions: validateCode(code), isCodeActive(code), isCodeExpired(code)
- Dependencies: File 1-2
- Commit: `feat(affiliate): add code validation helpers`

**File 8/32:** `lib/email/templates/affiliate/welcome.tsx`

- Welcome email template (React Email)
- Sent after email verification
- Includes: 15 initial codes, dashboard link, getting started tips
- Dependencies: None (standalone)
- Commit: `feat(affiliate): add welcome email template`

**File 9/32:** `lib/email/templates/affiliate/code-distributed.tsx`

- Monthly code distribution email template
- Includes: code count, expiry date, current balance
- Dependencies: None (standalone)
- Commit: `feat(affiliate): add code distribution email template`

**File 10/32:** `lib/email/templates/affiliate/code-used.tsx`

- Code used notification email template
- Includes: code, commission earned, new balance
- Dependencies: None (standalone)
- Commit: `feat(affiliate): add code used email template`

---

### Phase B: Affiliate Portal Backend (11 files, ~8 hours)

**File 11/32:** `app/api/affiliate/auth/register/route.ts`

- POST: Create affiliate account for existing authenticated user
- **Auth:** Require NextAuth session (user must be logged in)
- Body: { fullName, country, paymentMethod, paymentDetails, terms }
- **Note:** Email/password not needed - user already authenticated via NextAuth
- Validation: User not already affiliate (session.user.isAffiliate === false), required fields
- Action: Set User.isAffiliate = true, create AffiliateProfile with PENDING_VERIFICATION status, send verification email
- Pattern: Pattern 1 (Next.js 15 App Router) from 05-coding-patterns.md
- Dependencies: Files 1-4
- Commit: `feat(api): add affiliate registration endpoint`

**File 12/32:** `app/api/affiliate/auth/verify-email/route.ts`

- POST: Verify email and activate affiliate
- **Auth:** Require NextAuth session
- Body: { token }
- Action: Mark AffiliateProfile.status as ACTIVE, distribute 15 initial codes, send welcome email
- Dependencies: Files 1-4, 8
- Commit: `feat(api): add affiliate email verification endpoint`

**File 13/32:** ~~`app/api/affiliate/auth/login/route.ts`~~ **REMOVED - USE NEXTAUTH**

- **Note:** Affiliates login via existing `/api/auth/signin` (NextAuth)
- **No separate affiliate login needed** - single authentication system
- **Pattern:** Use NextAuth signIn from Part 5

**File 14/32:** ~~`app/api/affiliate/auth/logout/route.ts`~~ **REMOVED - USE NEXTAUTH**

- **Note:** Affiliates logout via existing `/api/auth/signout` (NextAuth)
- **No separate affiliate logout needed** - single authentication system
- **Pattern:** Use NextAuth signOut from Part 5

**File 15/32:** `app/api/affiliate/dashboard/stats/route.ts`

- GET: Dashboard quick stats
- **Auth:** Require NextAuth session with affiliate status (use `requireAffiliate()` helper)
- Return: { totalCodesDistributed, activeCodesCount, usedCodesCount, totalEarnings, pendingCommissions, paidCommissions, currentMonthEarnings, conversionRate }
- Dependencies: Files 1-2, Part 5 (auth helpers)
- Commit: `feat(api): add affiliate dashboard stats endpoint`

**File 16/32:** `app/api/affiliate/dashboard/codes/route.ts`

- GET: List affiliate codes (paginated)
- **Auth:** Require NextAuth session with affiliate status (use `requireAffiliate()` helper)
- Query params: status, page, limit
- Return: codes array with status, distributed date, expiry, usage
- Dependencies: Files 1-2, Part 5 (auth helpers)
- Commit: `feat(api): add affiliate codes list endpoint`

**File 17/32:** `app/api/affiliate/dashboard/code-inventory/route.ts`

- GET: Code inventory report (accounting-style)
- **Auth:** Require NextAuth session with affiliate status (use `requireAffiliate()` helper)
- Query params: period (month/year)
- Return: { openingBalance, additions, reductions, closingBalance }
- Dependencies: Files 1-2, 6, Part 5 (auth helpers)
- Commit: `feat(api): add code inventory report endpoint`

**File 18/32:** `app/api/affiliate/dashboard/commission-report/route.ts`

- GET: Commission report (accounting-style)
- **Auth:** Require NextAuth session with affiliate status (use `requireAffiliate()` helper)
- Query params: period (month/year)
- Return: { openingBalance, earned, payments, closingBalance }
- Dependencies: Files 1-2, 6, Part 5 (auth helpers)
- Commit: `feat(api): add commission report endpoint`

**File 19/32:** `app/api/affiliate/profile/route.ts`

- GET: Get affiliate profile
- PATCH: Update affiliate profile (name, country)
- **Auth:** Require NextAuth session with affiliate status (use `requireAffiliate()` helper)
- Dependencies: Files 1-2, Part 5 (auth helpers)
- Commit: `feat(api): add affiliate profile endpoints`

**File 20/32:** `app/api/affiliate/profile/payment/route.ts`

- PUT: Update payment method and details
- **Auth:** Require NextAuth session with affiliate status (use `requireAffiliate()` helper)
- Body: { paymentMethod, paymentDetails }
- Dependencies: Files 1-2, Part 5 (auth helpers)
- Commit: `feat(api): add affiliate payment method update endpoint`

**File 21/32:** `app/api/checkout/validate-code/route.ts` (NEW)

- POST: Validate affiliate code before checkout
- Body: { code }
- Return: { valid: boolean, affiliateCode?: object, error?: string }
- Validation: code exists, status ACTIVE, not expired
- Dependencies: Files 1, 7
- Commit: `feat(api): add affiliate code validation for checkout`

---

### Phase C: Integration with Stripe (2 files, ~3 hours)

**File 22/32:** `app/api/checkout/create-session/route.ts` (UPDATE EXISTING)

- Add: affiliateCode parameter (optional)
- Validate code if provided (call validateCode)
- Include affiliateCodeId and affiliateProfileId in Stripe metadata
- Apply discount when code valid (10% off: $29 → $26.10)
- Dependencies: Files 1, 7, 21
- Commit: `feat(checkout): integrate affiliate code discount`

**File 23/32:** `app/api/webhooks/stripe/route.ts` (UPDATE EXISTING)

- Update: checkout.session.completed handler
- Check if session.metadata includes affiliateCodeId and affiliateProfileId
- Create Commission record ($5 fixed, linked to affiliateProfileId)
- Mark AffiliateCode as USED
- Update AffiliateProfile totalEarnings and codesUsed
- Send code-used email notification
- Pattern: Pattern 9 from 06-aider-instructions.md (Commission creation ONLY via webhook)
- Dependencies: Files 1, 5, 10
- Commit: `feat(webhook): add commission creation for affiliate codes`

---

### Phase D: Affiliate Portal Frontend (9 files, ~7 hours)

**File 24/32:** `app/affiliate/layout.tsx`

- Affiliate-specific layout (extends user dashboard with affiliate sections)
- **Auth:** Check session.user.isAffiliate (redirect if false)
- Sidebar navigation: Dashboard, Codes, Commissions, Profile
- Header with affiliate name and NextAuth signOut button
- Seed: `seed-code/v0-components/part-17a-affiliate-dashboard/app/affiliate/dashboard/page.tsx`
- Dependencies: Part 5 (NextAuth session)
- Commit: `feat(affiliate): add affiliate portal layout`

**File 25/32:** `app/affiliate/register/page.tsx`

- Affiliate registration page for existing authenticated users
- **Auth:** Require NextAuth session (user must be logged in first)
- **Note:** No email/password fields - user already authenticated
- Form: fullName, country, paymentMethod, paymentDetails, terms checkbox
- Submit to POST /api/affiliate/auth/register
- Seed: `seed-code/v0-components/part-17a-affiliate-registration/app/affiliate/register/page.tsx`
- Dependencies: File 11, Part 5 (NextAuth session)
- Commit: `feat(affiliate): add registration page`

**File 26/32:** `app/affiliate/verify/page.tsx`

- Email verification page
- **Auth:** Require NextAuth session
- Extracts token from URL query (?token=xxx)
- Calls POST /api/affiliate/auth/verify-email
- Shows success/error message
- Dependencies: File 12, Part 5 (NextAuth session)
- Commit: `feat(affiliate): add email verification page`

**File 27/32:** ~~`app/affiliate/login/page.tsx`~~ **REMOVED - USE NEXTAUTH LOGIN**

- **Note:** Affiliates login via existing `/login` page (NextAuth)
- **No separate affiliate login page needed** - single authentication system
- **Pattern:** After NextAuth login, user can navigate to `/affiliate/register` to become an affiliate

**File 28/32:** `app/affiliate/dashboard/page.tsx`

- Main affiliate dashboard
- Quick stats cards (using /api/affiliate/dashboard/stats)
- Recent activity table (last 10 code uses)
- Action buttons (View Reports, Update Payment)
- Dependencies: Files 15, 24
- Commit: `feat(affiliate): add dashboard page`

**File 29/32:** `app/affiliate/dashboard/codes/page.tsx`

- Code inventory report page
- Fetch data from GET /api/affiliate/dashboard/code-inventory
- Display: opening balance, additions (monthly, bonus), reductions (used, expired), closing balance
- Drill-down: click numbers to see details
- Chart: Bar chart showing monthly trends
- Dependencies: Files 17, 24
- Commit: `feat(affiliate): add code inventory report page`

**File 30/32:** `app/affiliate/dashboard/commissions/page.tsx`

- Commission report page
- Fetch data from GET /api/affiliate/dashboard/commission-report
- Display: opening balance, earned (with code details), payments, closing balance
- Period selector (month/year)
- Dependencies: Files 18, 24
- Commit: `feat(affiliate): add commission report page`

**File 31/32:** `app/affiliate/dashboard/profile/page.tsx`

- Profile overview page
- Display: name, email, country, status, registration date
- Edit button → navigate to /affiliate/dashboard/profile/payment
- Dependencies: Files 19, 24
- Commit: `feat(affiliate): add profile page`

**File 32/32:** `app/affiliate/dashboard/profile/payment/page.tsx`

- Payment preferences page
- Form: paymentMethod dropdown, paymentDetails (conditional fields based on method)
- Submit to PUT /api/affiliate/profile/payment
- Dependencies: Files 20, 24
- Commit: `feat(affiliate): add payment preferences page`

---

## Environment Variables

Add to `.env.example` and `.env.local`:

```bash
# Affiliate System
# Note: No AFFILIATE_JWT_SECRET needed - using unified NextAuth session
AFFILIATE_COMMISSION_AMOUNT=5.00
AFFILIATE_MINIMUM_PAYOUT=50.00
AFFILIATE_CODES_PER_MONTH=15
```

---

## Success Criteria

- ✅ All required files created (some removed due to unified auth)
- ✅ Affiliate registration for authenticated users works
- ✅ Email verification activates affiliate status
- ✅ Unified authentication works (single NextAuth session for SaaS + affiliate roles)
- ✅ Code generation is crypto-secure (crypto.randomBytes)
- ✅ Commission creation works ONLY via Stripe webhook
- ✅ Accounting reports reconcile correctly (opening + earned - paid = closing)
- ✅ User checkout flow accepts affiliate codes and applies discount
- ✅ session.user.isAffiliate correctly reflects affiliate status

---

## Testing Checklist

**Affiliate Portal:**

- [ ] User must be logged in via NextAuth before affiliate registration
- [ ] Registration sets User.isAffiliate = true and creates AffiliateProfile with PENDING_VERIFICATION
- [ ] Email verification activates and distributes 15 codes
- [ ] NextAuth session includes isAffiliate: true after activation
- [ ] requireAffiliate() helper correctly enforces affiliate status
- [ ] Dashboard stats display correctly
- [ ] Code inventory report reconciles
- [ ] Commission report reconciles
- [ ] Payment method update works

**Code Usage Flow:**

- [ ] User can apply code at checkout
- [ ] Invalid/expired/used code rejected
- [ ] Webhook creates commission correctly
- [ ] Code marked as USED
- [ ] Affiliate earnings updated
- [ ] Notification emails sent

---

**Last Updated:** 2025-11-26
**Next Part:** Part 17B (Admin Portal + Automation)
