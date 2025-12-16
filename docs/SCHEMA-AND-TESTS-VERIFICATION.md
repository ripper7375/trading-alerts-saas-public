# Schema and Tests Verification for Unified Authentication

**Date:** 2025-11-28
**Purpose:** Verify unified auth schema and tests are correct before rebuilding lib/auth/\*
**Status:** ✅ VERIFIED - Ready for Aider rebuild

---

## ✅ 1. Prisma Schema Verification

### User Model (Unified Auth Support)

✅ **isAffiliate field added:**

```prisma
// Line 78-79
// Affiliate System (Unified Auth)
isAffiliate   Boolean  @default(false)  // Can be both SaaS user AND affiliate
```

✅ **affiliateProfile relation added:**

```prisma
// Line 108
affiliateProfile  AffiliateProfile?  // Nullable - only if isAffiliate = true
```

✅ **Index added:**

```prisma
// Line 117
@@index([isAffiliate])
```

### Subscription Model (Affiliate Tracking)

✅ **affiliateCodeId field added:**

```prisma
// Line 132-133
// Affiliate tracking
affiliateCodeId    String?  // Track which affiliate code was used (nullable)
```

✅ **Index added:**

```prisma
// Line 159
@@index([affiliateCodeId])
```

### Affiliate Models

✅ **AffiliateProfile model** (lines 292-335)

- userId (unique, 1-to-1 with User)
- fullName, country
- Social media URLs (optional)
- paymentMethod, paymentDetails (Json)
- Stats: totalCodesDistributed, totalCodesUsed, totalEarnings, etc.
- status: AffiliateStatus enum
- Relations: affiliateCodes[], commissions[]

✅ **AffiliateCode model** (lines 337-370)

- code (unique)
- affiliateProfileId
- discountPercent, commissionPercent
- status: CodeStatus enum
- distributedAt, expiresAt, usedAt, cancelledAt
- distributionReason: DistributionReason enum
- usedBy (userId), subscriptionId

✅ **Commission model** (lines 372-411)

- affiliateProfileId
- affiliateCodeId
- userId (SaaS user who upgraded)
- grossRevenue, discountAmount, netRevenue, commissionAmount
- status: CommissionStatus enum
- earnedAt, approvedAt, paidAt, cancelledAt
- Payment tracking fields

### Enums

✅ **AffiliateStatus** (lines 36-41)

- PENDING_VERIFICATION, ACTIVE, SUSPENDED, INACTIVE

✅ **CodeStatus** (lines 43-48)

- ACTIVE, USED, EXPIRED, CANCELLED

✅ **DistributionReason** (lines 50-54)

- INITIAL, MONTHLY, ADMIN_BONUS

✅ **CommissionStatus** (lines 56-61)

- PENDING, APPROVED, PAID, CANCELLED

---

## ✅ 2. TypeScript Types Verification

### types/next-auth.d.ts

✅ **Session.user interface:**

```typescript
user: {
  id: string;
  tier: 'FREE' | 'PRO';           // Specific types (not string)
  role: 'USER' | 'ADMIN';         // Specific types (not string)
  isAffiliate: boolean;           // Unified auth support
  image?: string;
}
```

✅ **User interface:**

```typescript
interface User extends DefaultUser {
  tier: 'FREE' | 'PRO';
  role: 'USER' | 'ADMIN';
  isAffiliate: boolean;
}
```

✅ **JWT interface:**

```typescript
interface JWT extends DefaultJWT {
  id: string;
  tier: 'FREE' | 'PRO';
  role: 'USER' | 'ADMIN';
  isAffiliate: boolean;
}
```

---

## ✅ 3. Test Files Verification

### **tests**/lib/auth/errors.test.ts (5.7 KB)

✅ Tests all error classes:

- AuthError (message, code, statusCode, name)
- OAuthError (provider)
- CredentialsError (default and custom messages)
- AccountLinkingError
- TierAccessError

✅ Tests error message helpers:

- getOAuthErrorMessage (7 OAuth error types)
- getAuthErrorMessage (8 auth error codes)

**Test Suites:** 7
**Test Cases:** ~30
**Expected Coverage:** ~100% of errors.ts

---

### **tests**/lib/auth/session.test.ts (14 KB)

✅ Tests all session helper functions:

- getSession() - success, null, error
- requireAuth() - authenticated, unauthenticated
- getUserSession() - with/without session
- getUserTier() - FREE, PRO, default
- getUserRole() - USER, ADMIN, default
- isAdmin() - true/false/no session
- hasTier() - tier validation
- requireAdmin() - success/failure
- requireTier() - tier requirement validation
- getSessionOrRedirect() - authenticated/unauthenticated

✅ Tests unified auth functions:

- isAffiliate() - affiliate status checks
- requireAffiliate() - affiliate validation
- getAffiliateProfile() - profile retrieval/null scenarios

**Test Suites:** 14
**Test Cases:** ~60
**Mocks:** NextAuth getServerSession, Prisma database
**Expected Coverage:** ~95% of session.ts

---

### **tests**/lib/auth/permissions.test.ts (17 KB)

✅ Tests permission system:

- hasPermission() for all features:
  - Authentication requirements
  - Admin permissions (admin_dashboard)
  - Tier permissions (all_symbols, all_timeframes)
  - Alert limits (FREE: 5, PRO: 20)
  - Watchlist limits (FREE: 5, PRO: 50)
  - API rate limits (FREE: 60/hr, PRO: 300/hr)

✅ Tests unified auth permissions:

- affiliate_dashboard (requires isAffiliate=true)
- affiliate_codes (requires isAffiliate=true)
- commission_reports (requires isAffiliate=true)

✅ Tests access controls:

- canAccessSymbol() - FREE (5) vs PRO (15)
- canAccessTimeframe() - FREE (3) vs PRO (9)
- canAccessCombination() - symbol + timeframe
- getAccessibleSymbols() - returns correct arrays
- getAccessibleTimeframes() - returns correct arrays
- checkTierLimits() - alerts and watchlist limits

✅ Tests permission middleware:

- checkPermission() - throws AuthError/TierAccessError
- withPermission() - higher-order function

**Test Suites:** 11
**Test Cases:** ~85
**Mocks:** Session and tier helpers
**Expected Coverage:** ~95% of permissions.ts

---

### **tests**/lib/auth/auth-options.test.ts (11 KB)

✅ Tests NextAuth configuration:

- authOptions validation (session, pages, providers, callbacks, events)

✅ Tests credentials provider:

- authorize() function with 12+ scenarios:
  - Missing credentials (email/password)
  - User not found
  - OAuth-only user (no password)
  - Invalid password
  - Inactive user
  - Successful authentication (FREE/USER)
  - Successful authentication (PRO/ADMIN/Affiliate)

✅ Tests callbacks:

- JWT callback (initial sign-in and updates)
- Session callback (user population from token)
- SignIn callback validation

✅ Tests exports:

- GET and POST handlers

**Test Suites:** 8
**Test Cases:** ~35
**Mocks:** bcryptjs, Prisma database, NextAuth
**Expected Coverage:** ~70% of auth-options.ts

---

## ✅ 4. Implementation Files Status

### Current State (To Be Deleted)

```
lib/auth/errors.ts          ✅ Has tests (100% coverage expected)
lib/auth/session.ts         ✅ Has tests (95% coverage expected)
lib/auth/permissions.ts     ✅ Has tests (95% coverage expected)
lib/auth/auth-options.ts    ✅ Has tests (70% coverage expected)
```

### Why Delete and Rebuild?

1. ❌ Current implementation has merge conflicts
2. ❌ Type errors causing CI/CD failures
3. ❌ Error loop between fixes and new issues
4. ✅ Schema is correct (unified auth ready)
5. ✅ Tests are comprehensive (210+ test cases)
6. ✅ Types are correct (isAffiliate support)

### What Aider Will Rebuild Against

1. ✅ **Schema constraints** (prisma/schema.prisma)
   - User.isAffiliate boolean
   - AffiliateProfile 1-to-1 relation
   - Subscription.affiliateCodeId tracking

2. ✅ **Type constraints** (types/next-auth.d.ts)
   - Session/User/JWT with isAffiliate
   - Specific tier/role types

3. ✅ **Test constraints** (**tests**/lib/auth/\*.test.ts)
   - 210+ test cases defining expected behavior
   - All functions signatures defined
   - All error scenarios covered

---

## ✅ 5. Verification Summary

### Schema Status

✅ User model has unified auth fields (isAffiliate, affiliateProfile)
✅ Subscription tracks affiliate codes (affiliateCodeId)
✅ All affiliate models defined (AffiliateProfile, AffiliateCode, Commission)
✅ All affiliate enums defined (4 enums with proper values)
✅ All indexes added for query optimization
✅ Schema is complete and correct for unified authentication

### Types Status

✅ NextAuth types extended with isAffiliate
✅ Tier and role types are specific unions (not generic strings)
✅ All custom properties properly typed
✅ Types align with Prisma schema

### Tests Status

✅ 4 comprehensive test files created (48 KB total)
✅ 210+ test cases across 40 test suites
✅ All functions have test coverage defined
✅ Tests define expected behavior for Aider to follow
✅ Proper mocking of dependencies (NextAuth, Prisma, bcrypt)

### Implementation Status

⚠️ Current lib/auth/\*.ts files have conflicts
✅ Ready for deletion and rebuild
✅ Aider has clear constraints (schema + types + tests)
✅ Rebuild will match test expectations

---

## ✅ 6. Next Steps for User

### Step 1: Delete Conflicting Implementation

```bash
rm lib/auth/*.ts
```

This removes:

- lib/auth/errors.ts
- lib/auth/session.ts
- lib/auth/permissions.ts
- lib/auth/auth-options.ts

### Step 2: Run Aider with Part 5 Batch 1

Aider prompt:

```
Rebuild Part 5 Batch 1 (Authentication Core) with these constraints:

1. Schema: Use prisma/schema.prisma (unified auth with isAffiliate)
2. Types: Use types/next-auth.d.ts (Session/User/JWT with isAffiliate)
3. Tests: Match __tests__/lib/auth/*.test.ts (210+ test cases)

Build files in order:
1. lib/auth/errors.ts (match errors.test.ts - 30 tests)
2. lib/auth/session.ts (match session.test.ts - 60 tests)
3. lib/auth/permissions.ts (match permissions.test.ts - 85 tests)
4. lib/auth/auth-options.ts (match auth-options.test.ts - 35 tests)

Requirements:
- NextAuth v4 (NOT v5)
- JWT sessions (no database sessions)
- Google OAuth + email/password credentials
- Unified auth (single login for SaaS + Affiliate)
- Return null from authorize() (not throw errors)
- Type cast Prisma enums to specific types

Verify: npm test __tests__/lib/auth/
```

### Step 3: Verify Tests Pass

```bash
npm test __tests__/lib/auth/
```

Expected result: All 210+ tests pass

### Step 4: Verify Coverage

```bash
npm test -- --coverage
```

Expected result: All thresholds exceeded

---

## ✅ 7. Success Criteria

After Aider rebuild:

- ✅ All 210+ tests pass
- ✅ Statement coverage > 22%
- ✅ Branch coverage > 17%
- ✅ Line coverage > 22%
- ✅ Function coverage > 31%
- ✅ No TypeScript errors
- ✅ No merge conflicts
- ✅ CI/CD pipeline passes

---

**Status:** ✅ VERIFIED - Schema and tests are correct and ready
**Action:** User can now delete lib/auth/\*.ts and run Aider
**Confidence:** HIGH - Tests provide clear implementation contract
