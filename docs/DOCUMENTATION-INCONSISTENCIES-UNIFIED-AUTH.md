# Documentation Inconsistencies with Unified Authentication

**Date:** 2025-11-28
**Purpose:** Identify inconsistencies between build order docs and unified auth implementation
**Status:** ⚠️ CRITICAL - Documentation updates required

---

## ❌ CRITICAL INCONSISTENCIES FOUND

### File 1: `docs/build-orders/part-17a-affiliate-portal.md`

**Status:** ⚠️ **MAJOR INCONSISTENCIES** - Describes OLD separate auth system

#### Line 24: "Separate affiliate authentication system"

```diff
- Separate affiliate authentication system
+ Unified authentication system (single login for SaaS + Affiliate)
```

**Why Wrong:** With unified auth, affiliates use the same NextAuth system as SaaS users. No separate authentication needed.

---

#### Line 32: Dependencies mention "Affiliate" model

```diff
- Part 2 complete (Prisma schema updates for Affiliate, AffiliateCode, Commission models)
+ Part 2 complete (Prisma schema updates for AffiliateProfile, AffiliateCode, Commission models)
```

**Why Wrong:** The model is called `AffiliateProfile` (1-to-1 with User), not `Affiliate`.

---

#### Lines 43-51: File 1/32 describes wrong schema

```diff
**File 1/32:** `prisma/schema.prisma` (UPDATE EXISTING)

- Add Affiliate model (email, password, fullName, country, paymentMethod, status, etc.)
- Add AffiliateCode model (code, affiliateId, status, distributedAt, expiresAt, usedAt, etc.)
- Add Commission model (affiliateId, affiliateCodeId, userId, amount, status, earnedAt, paidAt, etc.)
+ ✅ User model already has isAffiliate field (line 79)
+ ✅ User model already has affiliateProfile relation (line 108)
+ Add AffiliateProfile model (userId, fullName, country, paymentMethod, status, etc.)
+ Add AffiliateCode model (code, affiliateProfileId, status, distributedAt, expiresAt, usedAt, etc.)
+ Add Commission model (affiliateProfileId, affiliateCodeId, userId, amount, status, earnedAt, paidAt, etc.)
```

**Why Wrong:**

1. There's NO `Affiliate` model with email/password - that would create separate authentication
2. Schema already has `User.isAffiliate` field and `AffiliateProfile` relationship
3. Foreign keys use `affiliateProfileId` not `affiliateId`

---

#### Lines 60-68: File 3/32 should NOT exist

```diff
**File 3/32:** `lib/auth/affiliate-auth.ts`

❌ DELETE THIS FILE FROM BUILD ORDER

- Create affiliate JWT functions (separate from user auth)
- Use AFFILIATE_JWT_SECRET environment variable
- Functions: createAffiliateToken(), verifyAffiliateToken(), getAffiliateFromToken()
- JWT payload includes type: 'AFFILIATE' discriminator
```

**Why Wrong:** With unified auth:

- Affiliates use same NextAuth JWT system
- No separate JWT secret needed
- Use `requireAffiliate()` from `lib/auth/session.ts` instead
- Session already includes `isAffiliate` boolean

**What to use instead:**

```typescript
// From lib/auth/session.ts (already exists)
export async function isAffiliate(): Promise<boolean>;
export async function requireAffiliate(): Promise<Session>;
export async function getAffiliateProfile();
```

---

#### Lines 74, 92, etc.: References to `affiliateId`

```diff
- Function: distributeCodes(affiliateId, count, reason)
- Functions: buildCodeInventoryReport(affiliateId, period)
- Functions: buildCommissionReport(affiliateId, period)
+ Function: distributeCodes(userId, count, reason)
+ Functions: buildCodeInventoryReport(userId, period)
+ Functions: buildCommissionReport(userId, period)
```

**Why Wrong:**

- With unified auth, you identify affiliates by `userId` (from User model)
- The `AffiliateProfile` links to `User` via `userId`
- No separate `affiliateId` needed

**Correct pattern:**

```typescript
// Get affiliate profile from userId
const profile = await prisma.affiliateProfile.findUnique({
  where: { userId: session.user.id },
});

// Or use helper
const profile = await getAffiliateProfile();
```

---

### File 2: `docs/build-orders/part-05-authentication.md`

**Status:** ⚠️ **INCOMPLETE** - Missing unified auth fields

#### Lines 51, 56: Type extensions incomplete

```diff
**File 1/19:** `types/next-auth.d.ts`

Purpose: Extend NextAuth types to include tier and auth method

Build Steps:
1. Create TypeScript declaration file
- 2. Extend Session interface to include tier
- 3. Extend JWT interface to include tier and authMethod
+ 2. Extend Session interface to include tier, role, and isAffiliate
+ 3. Extend User interface to include tier, role, and isAffiliate
+ 4. Extend JWT interface to include tier, role, and isAffiliate
4. Commit: `feat(auth): extend NextAuth types for tier support`
```

**Why Wrong:** The types now include unified auth support (`isAffiliate` boolean)

**Actual implementation (types/next-auth.d.ts):**

```typescript
interface Session {
  user: {
    id: string;
    tier: 'FREE' | 'PRO';
    role: 'USER' | 'ADMIN';
    isAffiliate: boolean; // ← MISSING from docs
    image?: string;
  } & DefaultSession['user'];
}
```

---

#### Lines 92-101: Session helpers incomplete

```diff
**File 4/19:** `lib/auth/session.ts`

Purpose: Session helper functions

Build Steps:
1. getServerSession wrapper
2. requireAuth() helper
3. getUserSession() helper
4. getUserTier() helper
+ 5. getUserRole() helper
+ 6. isAdmin() helper
+ 7. isAffiliate() helper
+ 8. requireAffiliate() helper
+ 9. getAffiliateProfile() helper
5. Commit: `feat(auth): add session helper functions`
```

**Why Wrong:** Missing affiliate-specific helpers that are now required for unified auth

**Actual implementation (lib/auth/session.ts):**

```typescript
// ✅ Already implemented
export async function isAffiliate(): Promise<boolean>;
export async function requireAffiliate(): Promise<Session>;
export async function getAffiliateProfile();
```

---

#### Lines 105-113: Permissions incomplete

```diff
**File 5/19:** `lib/auth/permissions.ts`

Purpose: Tier-based permission checking

Build Steps:
1. hasPermission(user, feature) function
2. requirePro() middleware
3. checkFeatureAccess() helper
+ 4. Affiliate permission checks (affiliate_dashboard, affiliate_codes, commission_reports)
+ 5. canAccessSymbol() and canAccessTimeframe() helpers
+ 6. checkTierLimits() helper
4. Commit: `feat(auth): add tier-based permissions`
```

**Why Wrong:** Missing affiliate-specific permissions that are now implemented

**Actual implementation (lib/auth/permissions.ts lines 97-123):**

```typescript
case 'affiliate_dashboard':
  const isAffiliateUser = session.user.isAffiliate;
  return {
    canAccess: isAffiliateUser,
    reason: isAffiliateUser ? undefined : 'Affiliate status required...',
  };

case 'affiliate_codes':
  return {
    canAccess: session.user.isAffiliate,
    //...
  };

case 'commission_reports':
  return {
    canAccess: session.user.isAffiliate,
    //...
  };
```

---

### File 3: `docs/implementation-guides/v5_part_e.md`

**Status:** ✅ **NOT RELEVANT** - File is about MQL5 indicators, not authentication

This file is correctly focused on MT5 integration and doesn't need updates for unified auth.

---

### File 4: `docs/policies/08-google-oauth-implementation-rules.md`

**Status:** ✅ **CORRECT** - No inconsistencies found

This policy correctly describes:

- NextAuth v4 with JWT sessions
- Google OAuth + credentials providers
- Account linking security (verified-only)
- No mention of separate affiliate auth

**No updates needed.**

---

### File 5: `docs/OAUTH_IMPLEMENTATION_READY.md`

**Status:** ✅ **CORRECT** - No inconsistencies found

This document correctly describes OAuth integration without conflicting with unified auth.

**No updates needed.**

---

## 📋 REQUIRED DOCUMENTATION UPDATES

### Priority 1: CRITICAL - Update Part 17A Build Order

**File:** `docs/build-orders/part-17a-affiliate-portal.md`

**Changes Required:**

1. **Line 24:** Remove "Separate affiliate authentication system"

   ```diff
   - Separate affiliate authentication system
   + Unified authentication (affiliates use same NextAuth as SaaS users)
   ```

2. **Line 32:** Update dependencies

   ```diff
   - Part 2 complete (Prisma schema updates for Affiliate, AffiliateCode, Commission models)
   + Part 2 complete (Schema already has User.isAffiliate, AffiliateProfile, AffiliateCode, Commission)
   + Part 5 complete (Authentication with unified auth support)
   ```

3. **Lines 43-51:** Update File 1/32 description

   ```diff
   **File 1/32:** `prisma/schema.prisma` (VERIFY EXISTING)

   - Add Affiliate model (email, password...)
   + ✅ Verify User.isAffiliate field exists (line 79)
   + ✅ Verify User.affiliateProfile relation exists (line 108)
   + ✅ Verify AffiliateProfile model exists (lines 292-335)
   + ✅ Verify AffiliateCode model exists (lines 337-370)
   + ✅ Verify Commission model exists (lines 372-411)
   + ✅ Verify Subscription.affiliateCodeId exists (line 133)
   - Run migration (already done)
   - Commit: `feat(affiliate): add database models for affiliate system`
   + Commit: `chore(affiliate): verify unified auth schema`
   ```

4. **Lines 60-68:** DELETE File 3/32 (lib/auth/affiliate-auth.ts)

   ```diff
   - **File 3/32:** `lib/auth/affiliate-auth.ts`
   - Create affiliate JWT functions (separate from user auth)
   - Use AFFILIATE_JWT_SECRET environment variable
   - ...

   ❌ FILE REMOVED - Use unified NextAuth authentication instead

   Use these helpers from lib/auth/session.ts:
   - isAffiliate() - check if user is affiliate
   - requireAffiliate() - require affiliate status
   - getAffiliateProfile() - get affiliate profile
   ```

5. **Throughout:** Replace `affiliateId` with `userId` or `affiliateProfileId`

   ```diff
   - distributeCodes(affiliateId, count, reason)
   + distributeCodes(userId, count, reason)  // or get from session.user.id

   - buildCodeInventoryReport(affiliateId, period)
   + buildCodeInventoryReport(userId, period)
   ```

6. **Add Note:** Explain unified auth to Aider

   ```markdown
   ## ⚠️ IMPORTANT: Unified Authentication

   This Part 17A build assumes **unified authentication** is already implemented (Part 5).

   **What this means:**

   - Affiliates are regular Users with `isAffiliate = true`
   - No separate Affiliate model with email/password
   - No separate JWT authentication system
   - Use `requireAffiliate()` from lib/auth/session.ts for protected routes
   - Identify affiliates by `session.user.id` (same as SaaS users)
   - AffiliateProfile links to User via `userId` (1-to-1 relation)

   **User Journey:**

   1. User registers/signs in → User record (isAffiliate = false)
   2. User clicks "Become Affiliate" → isAffiliate = true, AffiliateProfile created
   3. Same NextAuth session grants access to both SaaS + Affiliate features
   ```

---

### Priority 2: HIGH - Update Part 5 Build Order

**File:** `docs/build-orders/part-05-authentication.md`

**Changes Required:**

1. **Line 51:** Update type extensions

   ```diff
   **Purpose:** Extend NextAuth types to include tier and auth method

   + **Purpose:** Extend NextAuth types to include tier, role, and isAffiliate (unified auth)
   ```

2. **Lines 53-57:** Update build steps

   ```diff
   Build Steps:
   1. Create TypeScript declaration file
   - 2. Extend Session interface to include tier
   - 3. Extend JWT interface to include tier and authMethod
   + 2. Extend Session.user to include: id, tier, role, isAffiliate, image
   + 3. Extend User interface to include: tier, role, isAffiliate
   + 4. Extend JWT interface to include: id, tier, role, isAffiliate
   - 4. Commit: `feat(auth): extend NextAuth types for tier support`
   + 5. Commit: `feat(auth): extend NextAuth types for unified auth support`
   ```

3. **Lines 92-101:** Update session.ts build steps

   ```diff
   Build Steps:
   1. getServerSession wrapper
   2. requireAuth() helper
   3. getUserSession() helper
   4. getUserTier() helper
   + 5. getUserRole() helper
   + 6. isAdmin() helper
   + 7. hasTier() helper
   + 8. requireAdmin() helper
   + 9. requireTier() helper
   + 10. isAffiliate() helper (unified auth)
   + 11. requireAffiliate() helper (unified auth)
   + 12. getAffiliateProfile() helper (unified auth)
   - 5. Commit: `feat(auth): add session helper functions`
   + 13. Commit: `feat(auth): add session helpers with unified auth support`
   ```

4. **Lines 105-113:** Update permissions.ts build steps

   ```diff
   Build Steps:
   1. hasPermission(user, feature) function
   - 2. requirePro() middleware
   - 3. checkFeatureAccess() helper
   + 2. checkPermission() middleware
   + 3. canAccessSymbol() and canAccessTimeframe() helpers
   + 4. getAccessibleSymbols() and getAccessibleTimeframes() helpers
   + 5. checkTierLimits() helper
   + 6. Affiliate permissions: affiliate_dashboard, affiliate_codes, commission_reports
   - 4. Commit: `feat(auth): add tier-based permissions`
   + 7. Commit: `feat(auth): add tier-based and affiliate permissions`
   ```

5. **Add Section:** Unified Auth Requirements

   ```markdown
   ### Unified Authentication Support

   Part 5 now includes support for dual roles (SaaS user + Affiliate):

   **Schema Requirements (from Part 2):**

   - User.isAffiliate: Boolean @default(false)
   - User.affiliateProfile: AffiliateProfile? (1-to-1 relation)

   **Type Requirements:**

   - Session.user.isAffiliate: boolean
   - User.isAffiliate: boolean
   - JWT.isAffiliate: boolean

   **Helper Requirements:**

   - isAffiliate() - check if current user is affiliate
   - requireAffiliate() - require affiliate status or throw 403
   - getAffiliateProfile() - get affiliate profile if exists

   **Permission Requirements:**

   - affiliate_dashboard - requires isAffiliate = true
   - affiliate_codes - requires isAffiliate = true
   - commission_reports - requires isAffiliate = true
   ```

---

## 📊 Impact Summary

### Files Requiring Updates: 2

| File                           | Status        | Priority | Changes                                                            |
| ------------------------------ | ------------- | -------- | ------------------------------------------------------------------ |
| `part-17a-affiliate-portal.md` | ❌ Critical   | P1       | Remove separate auth, update schema refs, delete File 3/32         |
| `part-05-authentication.md`    | ⚠️ Incomplete | P2       | Add unified auth fields, update helpers, add affiliate permissions |

### Files Already Correct: 3

| File                                      | Status     | Notes                          |
| ----------------------------------------- | ---------- | ------------------------------ |
| `v5_part_e.md`                            | ✅ Correct | Not about authentication       |
| `08-google-oauth-implementation-rules.md` | ✅ Correct | No conflicts with unified auth |
| `OAUTH_IMPLEMENTATION_READY.md`           | ✅ Correct | No conflicts with unified auth |

---

## ✅ Verification Checklist

After updating documentation:

- [ ] Part 17A no longer mentions "separate affiliate authentication"
- [ ] Part 17A references `AffiliateProfile` not `Affiliate` model
- [ ] Part 17A File 3/32 (lib/auth/affiliate-auth.ts) removed from build order
- [ ] Part 17A uses `userId` or `affiliateProfileId` (not `affiliateId`)
- [ ] Part 17A explains unified auth approach
- [ ] Part 5 includes `isAffiliate` in type extensions
- [ ] Part 5 includes affiliate helpers in session.ts
- [ ] Part 5 includes affiliate permissions in permissions.ts
- [ ] Part 5 explains unified auth requirements

---

## 🎯 Next Steps

1. **Update Part 17A** (CRITICAL)
   - Remove all references to separate affiliate authentication
   - Update schema file descriptions
   - Delete File 3/32 from build order
   - Add unified auth explanation

2. **Update Part 5** (HIGH)
   - Add isAffiliate to type extension steps
   - Add affiliate helpers to session.ts steps
   - Add affiliate permissions to permissions.ts steps
   - Add unified auth requirements section

3. **Verify with Aider**
   - Test that Aider can follow updated build orders
   - Ensure no confusion about authentication approach
   - Confirm unified auth is properly documented

---

**Status:** ⚠️ Documentation updates required before proceeding with Part 17A build
