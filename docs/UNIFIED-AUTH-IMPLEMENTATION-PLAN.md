# Unified Authentication Implementation Plan

# SaaS User + Affiliate Dual Role Support

**Version:** 1.0
**Date:** 2025-11-28
**Status:** Active Implementation Plan
**For:** Aider autonomous building (Parts 5 Batch 2 → Part 18)

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Assessment of Part 5 Batch 1](#2-assessment-of-part-5-batch-1)
3. [Immediate Fixes for Part 5 Batch 1](#3-immediate-fixes-for-part-5-batch-1)
4. [Schema Updates for Unified Auth](#4-schema-updates-for-unified-auth)
5. [Authentication Flow Modifications](#5-authentication-flow-modifications)
6. [API Middleware Patterns](#6-api-middleware-patterns)
7. [Build Order Updates](#7-build-order-updates)
8. [Testing Strategy](#8-testing-strategy)
9. [Implementation Checklist](#9-implementation-checklist)

---

## 1. Executive Summary

### Current Situation

**✅ Completed (Part 5 Batch 1):**

- NextAuth v4 with Google OAuth + email/password
- JWT sessions with `tier` and `role` fields
- Permission system for tier-based access
- Secure account linking (verified-only)

**❌ Missing for Unified Auth:**

- No `isAffiliate` field in User model or session
- No affiliate-specific permissions
- Separate Affiliate model planned (would require dual auth)

### Proposed Solution: Unified Authentication

**Single authentication system supports dual roles:**

```typescript
// User can be BOTH SaaS user AND affiliate
{
  id: "user123",
  email: "john@example.com",
  role: "USER",        // USER or ADMIN (SaaS role)
  isAffiliate: true,   // NEW: Can also be affiliate
  tier: "PRO",         // SaaS tier
  affiliateProfile: {  // NEW: Only if isAffiliate = true
    // affiliate-specific data
  }
}
```

**User Flow:**

```
1. User registers → User record (role=USER, isAffiliate=false, tier=FREE)
2. User signs in (Google/email) → Single session
3. User upgrades to PRO → tier=PRO
4. User clicks "Become Affiliate" → isAffiliate=true, AffiliateProfile created
5. Same session now grants access to:
   - /dashboard (SaaS features)
   - /affiliate/dashboard (Affiliate portal)
```

**Benefits:**
✅ Single authentication (no separate affiliate login)
✅ Single session for both SaaS + Affiliate access
✅ Better UX (one login for all features)
✅ No email conflicts
✅ Role-based UI switching

---

## 2. Assessment of Part 5 Batch 1

### ✅ What's Good

**File: lib/auth/auth-options.ts**

- ✅ Line 59: `role: user.role` already in authorize()
- ✅ Line 138: `role: 'USER'` set for new OAuth users
- ✅ Line 172: `token.role = user.role` in JWT callback
- ✅ Line 190: `session.user.role = token.role` in session callback
- ✅ Verified-only OAuth linking (lines 85-90)

**File: lib/auth/session.ts**

- ✅ Line 66: `getUserRole()` helper exists
- ✅ Line 96: `requireAdmin()` checks role
- ✅ Good session helpers for tier checks

**File: lib/auth/permissions.ts**

- ✅ Line 34: `userRole = session.user.role`
- ✅ Line 37: Admin bypass for all features
- ✅ Symbol/timeframe validation by tier

**File: types/next-auth.d.ts**

- ✅ Line 9: `role: string` in Session.user
- ✅ Line 16: `role: string` in User
- ✅ Line 24: `role: string` in JWT

### ⚠️ What Needs Modification

**Missing Fields:**

- ❌ No `isAffiliate` field in User model
- ❌ No `isAffiliate` in session/JWT
- ❌ No affiliate-specific permissions
- ❌ No `AffiliateProfile` model (needs to be 1-to-1 with User)

**Type Limitations:**

- ⚠️ `role: string` too generic (should be `'USER' | 'ADMIN'`)
- ⚠️ No affiliate status tracking

---

## 3. Immediate Fixes for Part 5 Batch 1

### Fix 1: Update Prisma Schema (Part 2)

**File: prisma/schema.prisma**

Add `isAffiliate` field to User model:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  password      String?
  image         String?
  emailVerified DateTime?
  tier          UserTier @default(FREE)
  role          String   @default("USER")
  isActive      Boolean  @default(true)

  // NEW: Affiliate status
  isAffiliate   Boolean  @default(false)  // ← ADD THIS

  // ... existing trial fields ...

  accounts          Account[]
  alerts            Alert[]
  watchlists        Watchlist[]
  subscription      Subscription?
  payments          Payment[]
  fraudAlerts       FraudAlert[]
  sessions          Session[]
  affiliateProfile  AffiliateProfile?  // ← ADD THIS (nullable)

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([email])
  @@index([tier])
  @@index([isAffiliate])  // ← ADD THIS
  @@index([trialStatus])
  @@index([trialEndDate])
}

// NEW: Affiliate-specific data (1-to-1 with User)
model AffiliateProfile {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Affiliate Info
  fullName          String
  country           String

  // Social Media (optional)
  facebookUrl       String?
  instagramUrl      String?
  twitterUrl        String?
  youtubeUrl        String?
  tiktokUrl         String?

  // Payment Preferences
  paymentMethod     String   // 'BANK_TRANSFER', 'CRYPTO_USDT', 'PAYPAL', 'LOCAL_WALLET'
  paymentDetails    Json     // Flexible field for payment info

  // Stats
  totalCodesDistributed  Int      @default(0)
  totalCodesUsed         Int      @default(0)
  totalEarnings          Decimal  @default(0)
  pendingCommissions     Decimal  @default(0)
  paidCommissions        Decimal  @default(0)

  // Status
  status            String   @default("ACTIVE")  // ACTIVE, SUSPENDED, INACTIVE
  verifiedAt        DateTime?
  suspendedAt       DateTime?
  suspensionReason  String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relationships
  affiliateCodes    AffiliateCode[]
  commissions       Commission[]

  @@index([userId])
  @@index([status])
  @@index([country])
}

model AffiliateCode {
  id               String   @id @default(cuid())
  code             String   @unique

  // Ownership
  affiliateProfileId String
  affiliateProfile   AffiliateProfile @relation(fields: [affiliateProfileId], references: [id], onDelete: Cascade)

  // Configuration
  discountPercent  Int      // 0-50%
  commissionPercent Int     // 0-50%

  // Lifecycle
  status           String   @default("ACTIVE")  // ACTIVE, USED, EXPIRED, CANCELLED
  distributedAt    DateTime @default(now())
  expiresAt        DateTime
  usedAt           DateTime?
  cancelledAt      DateTime?
  distributionReason String @default("MONTHLY")  // INITIAL, MONTHLY, ADMIN_BONUS

  // Usage tracking
  usedBy           String?  // userId (if redeemed)
  subscriptionId   String?  // subscription created from this code

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  commissions      Commission[]

  @@index([affiliateProfileId])
  @@index([status])
  @@index([expiresAt])
  @@index([code])
}

model Commission {
  id                 String   @id @default(cuid())

  // Ownership
  affiliateProfileId String
  affiliateProfile   AffiliateProfile @relation(fields: [affiliateProfileId], references: [id], onDelete: Cascade)

  affiliateCodeId    String
  affiliateCode      AffiliateCode @relation(fields: [affiliateCodeId], references: [id])

  // Transaction
  userId             String   // SaaS user who upgraded
  subscriptionId     String?  // Subscription created

  // Amounts
  grossRevenue       Decimal  // Full subscription amount
  discountAmount     Decimal  // Discount given to user
  netRevenue         Decimal  // After discount
  commissionAmount   Decimal  // Affiliate earns this

  // Status
  status             String   @default("PENDING")  // PENDING, APPROVED, PAID, CANCELLED
  earnedAt           DateTime @default(now())
  approvedAt         DateTime?
  paidAt             DateTime?
  cancelledAt        DateTime?

  // Payment tracking
  paymentBatchId     String?
  paymentMethod      String?
  paymentReference   String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([affiliateProfileId])
  @@index([status])
  @@index([earnedAt])
  @@index([paidAt])
}
```

**Migration command:**

```bash
npx prisma migrate dev --name add_affiliate_support_to_user
```

---

### Fix 2: Update TypeScript Types

**File: types/next-auth.d.ts**

```typescript
import { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tier: 'FREE' | 'PRO'; // ← MAKE SPECIFIC
      role: 'USER' | 'ADMIN'; // ← MAKE SPECIFIC
      isAffiliate: boolean; // ← ADD THIS
      image?: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    tier: 'FREE' | 'PRO'; // ← MAKE SPECIFIC
    role: 'USER' | 'ADMIN'; // ← MAKE SPECIFIC
    isAffiliate: boolean; // ← ADD THIS
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    tier: 'FREE' | 'PRO'; // ← MAKE SPECIFIC
    role: 'USER' | 'ADMIN'; // ← MAKE SPECIFIC
    isAffiliate: boolean; // ← ADD THIS
  }
}
```

---

### Fix 3: Update NextAuth Configuration

**File: lib/auth/auth-options.ts**

**Change 1: Include isAffiliate in authorize() (line 53-60)**

```typescript
return {
  id: user.id,
  email: user.email,
  name: user.name,
  image: user.image,
  tier: user.tier,
  role: user.role,
  isAffiliate: user.isAffiliate, // ← ADD THIS
};
```

**Change 2: Set isAffiliate for new OAuth users (line 130-154)**

```typescript
await prisma.user.create({
  data: {
    email: user.email!,
    name: user.name,
    image: user.image,
    emailVerified: new Date(),
    password: null,
    tier: 'FREE',
    role: 'USER',
    isActive: true,
    isAffiliate: false, // ← ADD THIS
    accounts: {
      create: {
        type: _account.type,
        provider: _account.provider,
        providerAccountId: _account.providerAccountId,
        access_token: _account.access_token,
        refresh_token: _account.refresh_token,
        expires_at: _account.expires_at,
        token_type: _account.token_type,
        scope: _account.scope,
        id_token: _account.id_token,
      },
    },
  },
});
```

**Change 3: Update JWT callback (line 167-184)**

```typescript
async jwt({ token, user, account: _account, trigger, session }) {
  // Initial sign-in
  if (user) {
    token.id = user.id;
    token.tier = user.tier;
    token.role = user.role;
    token.isAffiliate = user.isAffiliate;  // ← ADD THIS
    token['image'] = user.image;
  }

  // Handle session update (e.g., tier change, affiliate status change)
  if (trigger === 'update' && session) {
    if (session.tier) token.tier = session.tier;
    if (session.name) token.name = session.name;
    if (session.image) token['image'] = session.image;
    if (typeof session.isAffiliate === 'boolean') {  // ← ADD THIS
      token.isAffiliate = session.isAffiliate;
    }
  }

  return token;
},
```

**Change 4: Update session callback (line 186-194)**

```typescript
async session({ session, token }) {
  if (session.user) {
    session.user.id = token.id as string;
    session.user.tier = token.tier as 'FREE' | 'PRO';
    session.user.role = token.role as 'USER' | 'ADMIN';
    session.user.isAffiliate = token.isAffiliate as boolean;  // ← ADD THIS
    session.user.image = token['image'] as string | undefined;
  }
  return session;
},
```

---

### Fix 4: Update Session Helpers

**File: lib/auth/session.ts**

**Add new helper: `isAffiliate()`**

```typescript
/**
 * Check if current user is an affiliate
 */
export async function isAffiliate(): Promise<boolean> {
  const session = await getSession();
  return session?.user?.isAffiliate ?? false;
}

/**
 * Check if current user has affiliate access
 * Throws error if not an affiliate
 */
export async function requireAffiliate(): Promise<Session> {
  const session = await requireAuth();

  if (!session.user.isAffiliate) {
    throw new AuthError(
      'Affiliate status required to access this resource',
      'FORBIDDEN',
      403
    );
  }

  return session;
}

/**
 * Get user's affiliate profile (if exists)
 */
export async function getAffiliateProfile() {
  const session = await getSession();

  if (!session?.user?.id || !session.user.isAffiliate) {
    return null;
  }

  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId: session.user.id },
  });

  return profile;
}
```

---

### Fix 5: Update Permissions

**File: lib/auth/permissions.ts**

**Add affiliate-specific permissions:**

```typescript
// Feature-specific permissions
switch (feature) {
  // ... existing cases ...

  case 'affiliate_dashboard':
    const isAffiliateUser = session.user.isAffiliate;
    return {
      canAccess: isAffiliateUser,
      reason: isAffiliateUser
        ? undefined
        : 'Affiliate status required. Apply to become an affiliate.',
      requiredRole: 'USER',
    };

  case 'affiliate_codes':
    return {
      canAccess: session.user.isAffiliate,
      reason: session.user.isAffiliate
        ? undefined
        : 'Affiliate status required to access codes',
      requiredRole: 'USER',
    };

  case 'commission_reports':
    return {
      canAccess: session.user.isAffiliate,
      reason: session.user.isAffiliate
        ? undefined
        : 'Affiliate status required to view commissions',
      requiredRole: 'USER',
    };

  default:
    return {
      canAccess: true,
      reason: 'Unknown feature - defaulting to allowed',
    };
}
```

---

### Fix 6: Update Subscription Model

**File: prisma/schema.prisma**

Add `affiliateCodeId` to Subscription model:

```prisma
model Subscription {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Affiliate tracking
  affiliateCodeId    String?  // ← ADD THIS (nullable)

  // Stripe fields (nullable for dLocal subscriptions)
  stripeCustomerId       String?  @unique
  stripeSubscriptionId   String?  @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  // ... rest of fields ...

  @@index([affiliateCodeId])  // ← ADD THIS
}
```

---

## 4. Schema Updates for Unified Auth

### Database Migration Steps

**Step 1: Create migration**

```bash
npx prisma migrate dev --name add_affiliate_support_to_user
```

**Step 2: Verify migration**

```bash
npx prisma migrate status
```

**Step 3: Generate Prisma client**

```bash
npx prisma generate
```

**Step 4: Test migration**

```bash
npx prisma db push --preview-feature
```

### Backward Compatibility

**Existing users:**

- All existing User records will have `isAffiliate = false` by default
- No breaking changes to existing functionality
- Existing sessions continue to work

**Data migration (if needed):**

```typescript
// scripts/migrate-existing-affiliates.ts
// If you have existing Affiliate records in a separate table
import { prisma } from '@/lib/db/prisma';

async function migrateExistingAffiliates() {
  // 1. Find all users who should be affiliates
  const affiliates = await prisma.affiliate.findMany(); // old table

  // 2. Update User records
  for (const affiliate of affiliates) {
    await prisma.user.update({
      where: { email: affiliate.email },
      data: {
        isAffiliate: true,
        affiliateProfile: {
          create: {
            fullName: affiliate.fullName,
            country: affiliate.country,
            // ... map other fields
          },
        },
      },
    });
  }

  console.log(`Migrated ${affiliates.length} affiliates`);
}
```

---

## 5. Authentication Flow Modifications

### User Journey: Becoming an Affiliate

**Scenario 1: Existing SaaS user becomes affiliate**

```typescript
// app/api/affiliate/apply/route.ts
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: Request) {
  const session = await requireAuth();

  // Check if already affiliate
  if (session.user.isAffiliate) {
    return NextResponse.json(
      { error: 'Already an affiliate' },
      { status: 400 }
    );
  }

  const body = await req.json();
  // Validate: fullName, country, paymentMethod, paymentDetails

  // Create affiliate profile
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      isAffiliate: true,
      affiliateProfile: {
        create: {
          fullName: body.fullName,
          country: body.country,
          paymentMethod: body.paymentMethod,
          paymentDetails: body.paymentDetails,
          status: 'PENDING_VERIFICATION',
        },
      },
    },
  });

  // Update session with new isAffiliate status
  // NextAuth will pick this up on next token refresh

  return NextResponse.json({ success: true });
}
```

**Scenario 2: User signs in (SaaS or Affiliate)**

```typescript
// User signs in with Google or email/password
// NextAuth handles authentication
// Session includes:
{
  user: {
    id: "user123",
    email: "john@example.com",
    role: "USER",
    tier: "PRO",
    isAffiliate: true  // ← Available immediately
  }
}

// Frontend can check:
if (session.user.isAffiliate) {
  // Show affiliate dashboard link
}
```

**Scenario 3: Affiliate uses code at checkout**

```typescript
// app/api/checkout/apply-code/route.ts
import { requireAuth } from '@/lib/auth/session';

export async function POST(req: Request) {
  const session = await requireAuth();
  const { code } = await req.json();

  // Validate code
  const affiliateCode = await prisma.affiliateCode.findUnique({
    where: { code },
    include: { affiliateProfile: { include: { user: true } } },
  });

  if (!affiliateCode) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  // Check if code owner is trying to use own code
  if (affiliateCode.affiliateProfile.userId === session.user.id) {
    return NextResponse.json(
      { error: 'Cannot use your own affiliate code' },
      { status: 400 }
    );
  }

  // Apply discount and track commission
  // ...
}
```

---

## 6. API Middleware Patterns

### Pattern 1: SaaS-only routes

```typescript
// app/api/alerts/route.ts
import { requireAuth } from '@/lib/auth/session';

export async function GET(req: Request) {
  const session = await requireAuth(); // Any authenticated user

  const alerts = await prisma.alert.findMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json(alerts);
}
```

### Pattern 2: Affiliate-only routes

```typescript
// app/api/affiliate/dashboard/route.ts
import { requireAffiliate } from '@/lib/auth/session';

export async function GET(req: Request) {
  const session = await requireAffiliate(); // Must be affiliate

  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      affiliateCodes: { where: { status: 'ACTIVE' } },
      commissions: { where: { status: 'PENDING' } },
    },
  });

  return NextResponse.json(profile);
}
```

### Pattern 3: Admin-only routes

```typescript
// app/api/admin/affiliates/route.ts
import { requireAdmin } from '@/lib/auth/session';

export async function GET(req: Request) {
  await requireAdmin(); // Must be admin

  const affiliates = await prisma.affiliateProfile.findMany({
    include: { user: true },
  });

  return NextResponse.json(affiliates);
}
```

### Pattern 4: Dual-role routes (SaaS + Affiliate)

```typescript
// app/api/user/profile/route.ts
import { requireAuth } from '@/lib/auth/session';

export async function GET(req: Request) {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      subscription: true,
      affiliateProfile: session.user.isAffiliate ? true : false,
    },
  });

  return NextResponse.json(user);
}
```

### Pattern 5: Permission-based access

```typescript
// app/api/features/check/route.ts
import { checkPermission } from '@/lib/auth/permissions';

export async function POST(req: Request) {
  const { feature } = await req.json();

  try {
    await checkPermission(feature);
    return NextResponse.json({ canAccess: true });
  } catch (error) {
    if (error instanceof TierAccessError) {
      return NextResponse.json(
        { canAccess: false, reason: error.message },
        { status: 403 }
      );
    }
    throw error;
  }
}
```

---

## 7. Build Order Updates

### Part 5 (Authentication) - REVISED

**Batch 1 (COMPLETED):**

- ✅ File 1: types/next-auth.d.ts
- ✅ File 2: lib/auth/errors.ts
- ✅ File 3: lib/auth/auth-options.ts
- ✅ File 4: lib/auth/session.ts
- ✅ File 5: lib/auth/permissions.ts

**Batch 2 (TO DO - with unified auth):**

- File 6: app/api/auth/[...nextauth]/route.ts (exports authOptions)
- File 7: middleware.ts (route protection)
- File 8: app/api/auth/session/route.ts (session refresh)
- File 9: components/auth/session-provider.tsx (client wrapper)
- File 10: app/(auth)/login/page.tsx

**Changes needed:**

- ✅ Session helpers already support `isAffiliate`
- ✅ Permissions can check affiliate status
- ✅ No separate affiliate JWT needed

---

### Part 17A (Affiliate Portal) - REVISED

**OLD approach (WRONG):**

- ❌ Separate Affiliate model with email
- ❌ Separate JWT auth system
- ❌ Separate login at /affiliate/login

**NEW approach (UNIFIED):**

- ✅ AffiliateProfile linked to User (1-to-1)
- ✅ Same NextAuth system
- ✅ Session includes `isAffiliate` flag
- ✅ No separate login required

**File changes:**

**File 1: prisma/schema.prisma (UPDATE)**

- Add AffiliateProfile, AffiliateCode, Commission models
- Add `isAffiliate` to User model
- Add `affiliateCodeId` to Subscription model

**File 3: DELETE - lib/auth/affiliate-auth.ts**

- ❌ NOT NEEDED - Use unified NextAuth

**File 4-7: UPDATE affiliate utilities**

- Keep code generator, commission calculator, etc.
- Change to use `userId` instead of `affiliateId`

**File 11: app/api/affiliate/auth/register/route.ts → RENAME**

- NEW: `app/api/affiliate/apply/route.ts`
- Change from "register new affiliate" to "apply for affiliate status"
- Updates existing User record instead of creating new Affiliate

**File 13: DELETE - app/api/affiliate/auth/login/route.ts**

- ❌ NOT NEEDED - Use regular /login

**File 14: DELETE - app/api/affiliate/auth/logout/route.ts**

- ❌ NOT NEEDED - Use regular /api/auth/signout

**All affiliate API routes:**

- Use `requireAffiliate()` instead of custom JWT validation
- Access user via `session.user.id`
- Query AffiliateProfile via `userId` relation

**Example:**

```typescript
// OLD (separate auth)
const affiliatePayload = verifyAffiliateToken(req.headers.get('Authorization'));
const profile = await prisma.affiliate.findUnique({
  where: { id: affiliatePayload.affiliateId },
});

// NEW (unified auth)
const session = await requireAffiliate();
const profile = await prisma.affiliateProfile.findUnique({
  where: { userId: session.user.id },
});
```

---

### Part 17B (Admin Portal) - REVISED

**No changes needed** - Admin routes already use `requireAdmin()`

**Affiliate admin routes:**

```typescript
// app/api/admin/affiliates/approve/route.ts
const session = await requireAdmin();

await prisma.affiliateProfile.update({
  where: { id: profileId },
  data: {
    status: 'ACTIVE',
    verifiedAt: new Date(),
  },
});

// Update user's isAffiliate flag
await prisma.user.update({
  where: { id: profile.userId },
  data: { isAffiliate: true },
});
```

---

### Part 18 (Payment Integration) - REVISED

**Affiliate code tracking at checkout:**

```typescript
// app/api/stripe/checkout/route.ts
export async function POST(req: Request) {
  const session = await requireAuth();
  const { priceId, affiliateCode } = await req.json();

  let affiliateCodeRecord = null;

  // Validate affiliate code if provided
  if (affiliateCode) {
    affiliateCodeRecord = await prisma.affiliateCode.findUnique({
      where: { code: affiliateCode, status: 'ACTIVE' },
    });

    if (!affiliateCodeRecord) {
      return NextResponse.json(
        { error: 'Invalid affiliate code' },
        { status: 400 }
      );
    }

    // Prevent self-usage
    const codeOwner = await prisma.affiliateProfile.findUnique({
      where: { id: affiliateCodeRecord.affiliateProfileId },
    });

    if (codeOwner?.userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot use your own affiliate code' },
        { status: 400 }
      );
    }
  }

  // Create Stripe checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    customer_email: session.user.email,
    metadata: {
      userId: session.user.id,
      affiliateCodeId: affiliateCodeRecord?.id || null,
    },
    // ... rest of checkout config
  });

  return NextResponse.json({ url: checkoutSession.url });
}
```

**Webhook: Track commission on upgrade:**

```typescript
// app/api/webhooks/stripe/route.ts
if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const { userId, affiliateCodeId } = session.metadata;

  // Create subscription
  const subscription = await prisma.subscription.create({
    data: {
      userId,
      stripeCustomerId: session.customer,
      affiliateCodeId: affiliateCodeId || null,
      // ... other fields
    },
  });

  // If affiliate code used, create commission
  if (affiliateCodeId) {
    const code = await prisma.affiliateCode.findUnique({
      where: { id: affiliateCodeId },
    });

    const grossRevenue = session.amount_total / 100;
    const discountAmount = (grossRevenue * code.discountPercent) / 100;
    const netRevenue = grossRevenue - discountAmount;
    const commissionAmount = (netRevenue * code.commissionPercent) / 100;

    await prisma.commission.create({
      data: {
        affiliateProfileId: code.affiliateProfileId,
        affiliateCodeId: code.id,
        userId,
        subscriptionId: subscription.id,
        grossRevenue,
        discountAmount,
        netRevenue,
        commissionAmount,
        status: 'PENDING',
      },
    });

    // Mark code as used
    await prisma.affiliateCode.update({
      where: { id: affiliateCodeId },
      data: {
        status: 'USED',
        usedAt: new Date(),
        usedBy: userId,
      },
    });
  }

  // Upgrade user tier
  await prisma.user.update({
    where: { id: userId },
    data: { tier: 'PRO' },
  });
}
```

---

## 8. Testing Strategy

### Unit Tests

**Test 1: isAffiliate field in session**

```typescript
// __tests__/lib/auth/session.test.ts
describe('isAffiliate()', () => {
  it('should return true for affiliate users', async () => {
    mockSession({ user: { isAffiliate: true } });
    expect(await isAffiliate()).toBe(true);
  });

  it('should return false for non-affiliate users', async () => {
    mockSession({ user: { isAffiliate: false } });
    expect(await isAffiliate()).toBe(false);
  });
});

describe('requireAffiliate()', () => {
  it('should allow affiliate users', async () => {
    mockSession({ user: { isAffiliate: true } });
    await expect(requireAffiliate()).resolves.toBeDefined();
  });

  it('should reject non-affiliate users', async () => {
    mockSession({ user: { isAffiliate: false } });
    await expect(requireAffiliate()).rejects.toThrow(
      'Affiliate status required'
    );
  });
});
```

**Test 2: Affiliate application flow**

```typescript
// __tests__/api/affiliate/apply.test.ts
describe('POST /api/affiliate/apply', () => {
  it('should convert user to affiliate', async () => {
    const user = await createTestUser();
    const response = await POST(
      {
        fullName: 'John Doe',
        country: 'US',
        paymentMethod: 'BANK_TRANSFER',
        paymentDetails: {
          /* ... */
        },
      },
      user
    );

    expect(response.status).toBe(200);

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    expect(updatedUser.isAffiliate).toBe(true);
  });

  it('should reject if already affiliate', async () => {
    const affiliate = await createTestAffiliate();
    const response = await POST(
      {
        /* ... */
      },
      affiliate
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Already an affiliate');
  });
});
```

**Test 3: Dual role access**

```typescript
// __tests__/integration/dual-role.test.ts
describe('Dual role user (SaaS + Affiliate)', () => {
  it('should access both SaaS and affiliate features', async () => {
    const user = await createTestUser({ isAffiliate: true, tier: 'PRO' });

    // Can access SaaS features
    const alerts = await GET('/api/alerts', user);
    expect(alerts.status).toBe(200);

    // Can access affiliate features
    const dashboard = await GET('/api/affiliate/dashboard', user);
    expect(dashboard.status).toBe(200);
  });
});
```

### Integration Tests

**Test 4: OAuth sign-in with affiliate status**

```typescript
describe('Google OAuth with existing affiliate', () => {
  it('should preserve isAffiliate on OAuth login', async () => {
    // 1. Create user with affiliate status
    const user = await prisma.user.create({
      data: {
        email: 'john@example.com',
        isAffiliate: true,
        affiliateProfile: {
          create: {
            /* ... */
          },
        },
      },
    });

    // 2. Sign in with Google OAuth
    const session = await signInWithGoogle('john@example.com');

    // 3. Verify session has isAffiliate
    expect(session.user.isAffiliate).toBe(true);
  });
});
```

**Test 5: Affiliate code usage prevents self-usage**

```typescript
describe('Affiliate code self-usage prevention', () => {
  it('should reject when affiliate tries to use own code', async () => {
    const affiliate = await createTestAffiliate();
    const code = await createTestCode(affiliate);

    const response = await POST(
      '/api/checkout/apply-code',
      {
        code: code.code,
      },
      affiliate
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot use your own affiliate code');
  });
});
```

### Manual Testing Checklist

**Scenario 1: New user becomes affiliate**

- [ ] User registers with email/password
- [ ] User verifies email
- [ ] User signs in
- [ ] User clicks "Become an Affiliate"
- [ ] User fills affiliate application form
- [ ] User submits application
- [ ] `isAffiliate` flag set to true
- [ ] AffiliateProfile created
- [ ] User can now access /affiliate/dashboard
- [ ] User still has access to /dashboard

**Scenario 2: Existing affiliate signs in with Google**

- [ ] User has existing account with isAffiliate=true
- [ ] User signs in with Google OAuth
- [ ] Session includes isAffiliate=true
- [ ] User can access affiliate dashboard
- [ ] User can access SaaS features

**Scenario 3: Affiliate uses code at checkout**

- [ ] Affiliate has active codes
- [ ] Affiliate tries to use own code → REJECTED
- [ ] Regular user uses affiliate's code → ACCEPTED
- [ ] Commission created
- [ ] Subscription linked to affiliate code

---

## 9. Implementation Checklist

### Phase 1: Schema Updates (NOW)

- [ ] Update `prisma/schema.prisma` with:
  - [ ] Add `isAffiliate` to User model
  - [ ] Add `AffiliateProfile` model
  - [ ] Add `AffiliateCode` model
  - [ ] Add `Commission` model
  - [ ] Add `affiliateCodeId` to Subscription model
- [ ] Create migration: `npx prisma migrate dev --name add_affiliate_support`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Commit changes

### Phase 2: Type Updates (NOW)

- [ ] Update `types/next-auth.d.ts`:
  - [ ] Add `isAffiliate: boolean` to Session.user
  - [ ] Add `isAffiliate: boolean` to User
  - [ ] Add `isAffiliate: boolean` to JWT
  - [ ] Make `tier` and `role` specific types
- [ ] Commit changes

### Phase 3: Auth Updates (NOW)

- [ ] Update `lib/auth/auth-options.ts`:
  - [ ] Line 60: Add `isAffiliate` to authorize return
  - [ ] Line 138: Set `isAffiliate: false` for new OAuth users
  - [ ] Line 172: Add `token.isAffiliate = user.isAffiliate`
  - [ ] Line 177: Handle `session.isAffiliate` updates
  - [ ] Line 190: Add `session.user.isAffiliate = token.isAffiliate`
- [ ] Update `lib/auth/session.ts`:
  - [ ] Add `isAffiliate()` helper
  - [ ] Add `requireAffiliate()` helper
  - [ ] Add `getAffiliateProfile()` helper
- [ ] Update `lib/auth/permissions.ts`:
  - [ ] Add `affiliate_dashboard` permission
  - [ ] Add `affiliate_codes` permission
  - [ ] Add `commission_reports` permission
- [ ] Commit changes

### Phase 4: Part 5 Batch 2 (CONTINUE)

- [ ] Build remaining Part 5 files with unified auth
- [ ] Test authentication flows
- [ ] Test session management

### Phase 5: Part 17 Updates (WHEN REACHED)

- [ ] Update build order documentation
- [ ] Remove separate affiliate auth files
- [ ] Update affiliate API routes to use `requireAffiliate()`
- [ ] Change affiliate application flow
- [ ] Test affiliate features

### Phase 6: Testing (ONGOING)

- [ ] Write unit tests for new helpers
- [ ] Write integration tests for dual roles
- [ ] Manual testing of all scenarios
- [ ] Update test documentation

---

## Summary

**Key Changes:**

1. ✅ **Single User model** - No separate Affiliate table
2. ✅ **isAffiliate flag** - Track affiliate status in User
3. ✅ **AffiliateProfile** - 1-to-1 relationship for affiliate data
4. ✅ **Unified NextAuth** - No separate JWT for affiliates
5. ✅ **Session includes isAffiliate** - Available in all requests
6. ✅ **Role-based helpers** - `requireAffiliate()`, `isAffiliate()`

**Benefits:**

- Single login for SaaS + Affiliate
- Better UX
- Simpler codebase
- No email conflicts
- Easy role switching

**Next Steps:**

1. Apply immediate fixes (Phase 1-3)
2. Continue Part 5 Batch 2
3. Update Part 17 build order when reached
4. Test thoroughly

---

**End of Implementation Plan**
