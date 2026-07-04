# Part 17A-1: Affiliate Portal - Foundation & Backend APIs with TDD - List of files completion

**Last Updated:** 2026-07-04
**Total Files:** 27 files (20 implementation + 7 test files)

---

## PART 17A-1: 26 FILES ARE BUILT

### PHASE 0: TEST INFRASTRUCTURE (2 files) ✅

├─ Step 1: T1 - ✅ `__tests__/setup.ts`
└─ Step 2: T2 - ✅ `__tests__/helpers/supertest-setup.ts`

### PHASE A: FOUNDATION (14 files) ✅

#### Database Schema (1 file)

├─ Step 3: F1 - ✅ `prisma/schema.prisma` (VERIFY)
│ └─ Models: AffiliateProfile (16 cols), AffiliateCode (11 cols), Commission (14 cols), SystemConfig

#### Library Files (8 files)

├─ Step 4: F2 - ✅ `lib/affiliate/constants.ts`
│ └─ Exports: AFFILIATE_CONFIG, CODE_GENERATION, getAffiliateConfigFromDB(), getDiscountPercent(), getCommissionPercent()
├─ Step 5: F3 - ✅ `lib/affiliate/types.ts`
│ └─ Exports: TypeScript interfaces for AffiliateProfile, AffiliateCode, Commission
├─ Step 6: F4 - ✅ `lib/affiliate/code-generator.ts`
│ └─ Exports: generateUniqueCode(), distributeCodes() - uses SystemConfig for percentages
├─ Step 7: F5 - ✅ `lib/affiliate/commission-calculator.ts`
│ └─ Exports: calculateDiscount(), calculateNetRevenue(), calculateCommission(), calculateFullBreakdown(), \*WithDynamicConfig variants
├─ Step 8: F6 - ✅ `lib/affiliate/report-builder.ts`
│ └─ Exports: buildDashboardStats(), buildCodeInventoryReport(), buildCommissionSummary()
├─ Step 9: F7 - ✅ `lib/affiliate/validators.ts`
│ └─ Exports: Zod schemas for registration, codes, payments, profile updates, queries
└─ Step 10: F8 - ✅ `lib/affiliate/registration.ts`
└─ Exports: registerAffiliate(), verifyAffiliateEmail() - distributes initial codes on verification

#### Email Templates (3 files)

├─ Step 11: F9 - ✅ `lib/email/templates/affiliate/welcome.tsx`
│ └─ Sent on affiliate registration, contains verification link
├─ Step 12: F10 - ✅ `lib/email/templates/affiliate/code-distributed.tsx`
│ └─ Sent when codes are distributed (monthly or bonus)
└─ Step 13: F11 - ✅ `lib/email/templates/affiliate/code-used.tsx`
└─ Sent when affiliate code is used by customer

#### Test Files for Foundation (3 files)

├─ Step 14: T3 - ✅ `__tests__/lib/affiliate/code-generator.test.ts`
│ └─ Tests: generateUniqueCode(), distributeCodes(), code format validation
├─ Step 15: T4 - ✅ `__tests__/lib/affiliate/commission-calculator.test.ts`
│ └─ Tests: All calculator functions with various input scenarios
└─ Step 16: T5 - ✅ `__tests__/lib/affiliate/registration.test.ts`
└─ Tests: Registration flow, email verification, initial code distribution

### PHASE B: BACKEND APIs (11 files) ✅

#### Affiliate Authentication (2 files)

├─ Step 17: F12 - ✅ `app/api/affiliate/auth/register/route.ts`
│ └─ POST: Register user as affiliate, creates AffiliateProfile, sends verification email
└─ Step 18: F13 - ✅ `app/api/affiliate/auth/verify-email/route.ts`
└─ POST: Verify email token, activate affiliate, distribute initial codes

#### Affiliate Dashboard APIs (4 files)

├─ Step 19: F14 - ✅ `app/api/affiliate/dashboard/stats/route.ts`
│ └─ GET: Dashboard statistics (active codes, used codes, earnings, balances)
├─ Step 20: F15 - ✅ `app/api/affiliate/dashboard/codes/route.ts`
│ └─ GET: Paginated list of affiliate codes with status filter
├─ Step 21: F16 - ✅ `app/api/affiliate/dashboard/code-inventory/route.ts`
│ └─ GET: Code inventory report (opening/closing balance, additions, reductions)
└─ Step 22: F17 - ✅ `app/api/affiliate/dashboard/commission-report/route.ts`
└─ GET: Commission history with summary (paginated)

#### Affiliate Profile APIs (2 files)

├─ Step 23: F18 - ✅ `app/api/affiliate/profile/route.ts`
│ └─ GET/PUT: Retrieve and update affiliate profile (name, country)
└─ Step 24: F19 - ✅ `app/api/affiliate/profile/payment/route.ts`
└─ PUT: Update payment method and details

#### Checkout Integration (2 files)

├─ Step 25: F20 - ✅ `app/api/checkout/validate-code/route.ts` (NEW)
│ └─ POST: Validate affiliate code, return discount percentage
└─ Step 26: F21 - ✅ `app/api/checkout/route.ts` (UPDATE)
└─ POST: Create checkout session with affiliate code support

#### Public Configuration (1 file)

└─ Step 27: F22 - ✅ `app/api/config/affiliate/route.ts`
└─ GET: Public affiliate config (no auth, cached 5 min) - discountPercent, commissionPercent, codesPerMonth

### UPDATE 2026-07-04: Shared Conversion Processing (1 file) ✅

└─ F23 - ✅ `lib/affiliate/conversion-processor.ts` (NEW)
└─ Provider-agnostic affiliate-conversion handler called by BOTH Stripe and dLocal
webhooks when a payment carrying an affiliate code completes: marks the code USED
(idempotent), creates the PENDING Commission, updates AffiliateProfile counters, and
sends the `code-used` email. Base price via `getBasePriceUsd()`; discount/commission
% snapshotted from the code. Extracted so both payment providers share one code path.

---

## Status Summary

| Category            | Count  | Status      |
| ------------------- | ------ | ----------- |
| Test Infrastructure | 2      | ✅ Complete |
| Foundation Library  | 9      | ✅ Complete |
| Email Templates     | 3      | ✅ Complete |
| Foundation Tests    | 3      | ✅ Complete |
| Backend APIs        | 11     | ✅ Complete |
| **TOTAL**           | **27** | **100%**    |

---

## Database Schema Notes

The affiliate system uses a **normalized flat-column structure** (not the old JSON structure):

### AffiliateProfile (16 columns)

- `id`, `userId`, `fullName`, `country`
- Social URLs: `youtubeUrl`, `twitterUrl`, `instagramUrl`, `tiktokUrl`, `websiteUrl`
- Payment: `paymentMethod`, `paymentDetails` (JSON)
- Stats: `codesDistributed`, `codesUsed`, `pendingBalance`, `paidBalance`
- Status: `status`, `verificationToken`, `suspensionReason`, `suspendedAt`

### AffiliateCode (11 columns)

- `id`, `code`, `affiliateProfileId`
- Config: `discountPercent`, `commissionPercent`
- Status: `status` (ACTIVE, USED, EXPIRED, CANCELLED)
- Dates: `distributedAt`, `distributionReason`, `expiresAt`, `usedAt`
- Usage: `usedByUserId`, `subscriptionId`

### Commission (14 columns)

- `id`, `affiliateProfileId`, `affiliateCodeId`, `userId`
- Amounts: `grossRevenue`, `discountAmount`, `netRevenue`, `commissionAmount`
- Status: `status` (PENDING, APPROVED, PAID, CANCELLED)
- Tracking: `earnedAt`, `approvedAt`, `paidAt`, `paymentReference`

### SystemConfig (Dynamic Configuration)

- All affiliate settings stored in database (not hardcoded)
- Keys: `affiliate_discount_percent`, `affiliate_commission_percent`, `affiliate_codes_per_month`, `affiliate_base_price`
- Changes audited via `SystemConfigHistory` table
- Applied in real-time (no restart required)

---

## Notes

- Steps 1-2 verify existing test infrastructure
- Step 3 verifies Prisma schema has required models
- All configuration values are dynamic via SystemConfig table
- Checkout integration (Steps 25-26) adds affiliate code support to existing checkout flow
- Public config endpoint allows frontend to display discount info without authentication
- **Updated 2026-07-04:** added `lib/affiliate/conversion-processor.ts` (shared Stripe/dLocal
  conversion handler); modified `lib/affiliate/report-builder.ts` (added
  `buildGlobalCodeInventoryReport()` for the new admin code-flows report),
  `app/api/checkout/route.ts` and `app/api/checkout/validate-code/route.ts`
