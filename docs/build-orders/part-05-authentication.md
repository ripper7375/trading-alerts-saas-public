# Part 5: Authentication System - Build Order

**From:** `docs/v5-structure-division.md` Part 5
**Total Files:** 20 files
**Estimated Time:** 6.5 hours
**Priority:** ⭐⭐⭐ High (Critical security component)
**Complexity:** High

---

## Overview

**Scope:** Complete authentication system with NextAuth.js, Google OAuth, email/password credentials, and tier-based permissions.

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_e.md` Section 5 - Authentication system implementation details and business logic
- `docs/policies/08-google-oauth-implementation-rules.md` - Google OAuth integration rules and security policies

**Key Changes from V4:**

- ✅ Google OAuth integration (new provider)
- ✅ Account model for OAuth provider linking
- ✅ User.password nullable (OAuth-only users don't need password)
- ✅ User.emailVerified auto-set for OAuth users
- ✅ Tier, role, and isAffiliate included in JWT session
- ✅ Verified-only account linking (security-first)
- ✅ Separate auth method tracking (credentials/google/both)
- ✅ Unified authentication for SaaS users, affiliates, and admins (RBAC)
- ✅ Admin and affiliate helper functions for access control

**Dependencies:**

- Part 2 complete (Prisma User, Account models)
- Part 3 complete (User, Tier types)
- Part 4 complete (Tier validation)

**Integration Points:**

- Provides authentication for ALL protected routes
- Session management for tier-gated features
- OAuth integration with Google
- Email verification workflow

---

## File Build Order

Build these files **in sequence**:

---

### Files 1-2: NextAuth Type Extensions

**File 1/20:** `types/next-auth.d.ts`

**Purpose:** Extend NextAuth types to include tier, role, and affiliate status

**Build Steps:**

1. Create TypeScript declaration file
2. Extend Session interface to include tier, role, and isAffiliate
3. Extend User interface to include tier, role, and isAffiliate
4. Extend JWT interface to include tier, role, authMethod, and isAffiliate
5. **Note:** isAffiliate supports unified authentication (SaaS user + affiliate dual roles)
6. Commit: `feat(auth): extend NextAuth types for tier and affiliate support`

---

**File 2/20:** `lib/auth/errors.ts`

**Purpose:** OAuth and auth error messages

**Build Steps:**

1. Define error types for OAuth failures
2. Add user-friendly error messages
3. Include error codes for different scenarios
4. Commit: `feat(auth): add auth error definitions`

---

### Files 3-5: NextAuth Configuration

**File 3/20:** `lib/auth/auth-options.ts`

**Purpose:** NextAuth configuration with Google OAuth + Credentials providers

**Reference:** `docs/policies/08-google-oauth-implementation-rules.md`

**Build Steps:**

1. Configure Google OAuth provider
2. Configure Credentials provider (email/password)
3. Add JWT session strategy
4. Include tier, role, and isAffiliate in JWT callback
5. Include tier, role, and isAffiliate in session callback
6. **Note:** Use type casts for Prisma enums (tier as 'FREE'|'PRO', role as 'USER'|'ADMIN')
7. Implement verified-only account linking
8. Add sign-in callback with tier validation
9. Commit: `feat(auth): configure NextAuth with Google OAuth and affiliate support`

---

**File 4/20:** `lib/auth/session.ts`

**Purpose:** Session helper functions including affiliate and admin support

**Build Steps:**

1. getServerSession wrapper (getSession)
2. requireAuth() helper - throws AuthError if no session
3. getUserSession() helper - returns session or null
4. getUserTier() helper - returns user tier
5. **isAffiliate()** helper - returns true if user is affiliate
6. **requireAffiliate()** helper - throws AuthError if user is not affiliate
7. **getAffiliateProfile()** helper - fetches AffiliateProfile for affiliate users
8. **isAdmin()** helper - returns true if user has ADMIN role
9. **requireAdmin()** helper - throws AuthError if user is not ADMIN
10. **Note:** Affiliate and admin helpers support unified auth (single session for multiple roles)
11. Commit: `feat(auth): add session, affiliate, and admin helper functions`

---

**File 5/20:** `lib/auth/permissions.ts`

**Purpose:** Tier-based, affiliate, and admin permission checking

**Build Steps:**

1. hasPermission(user, feature) function - checks tier-based permissions
2. requirePro() middleware - enforces PRO tier
3. checkFeatureAccess() helper - validates feature access
4. **Add affiliate permissions:**
   - 'affiliate_dashboard' - requires session.user.isAffiliate === true
   - 'affiliate_codes' - requires affiliate status
   - 'commission_reports' - requires affiliate status
5. **Add admin permissions:**
   - 'admin_dashboard' - requires session.user.role === 'ADMIN'
   - 'admin_users' - requires ADMIN role
   - 'admin_affiliates' - requires ADMIN role
   - 'admin_settings' - requires ADMIN role
   - 'admin_reports' - requires ADMIN role
6. **Note:** Unified auth - single session supports USER/ADMIN roles + affiliate status
7. Commit: `feat(auth): add tier-based, affiliate, and admin permissions`

---

### Files 6-10: API Routes

**File 6/20:** `app/api/auth/[...nextauth]/route.ts`

**Purpose:** NextAuth API route handler

**Build Steps:**

1. Import auth options
2. Create NextAuth handler
3. Export GET and POST handlers
4. Commit: `feat(auth): add NextAuth API route`

---

**File 7/20:** `app/api/auth/register/route.ts`

**Purpose:** User registration endpoint

**OpenAPI:** `POST /api/auth/register`

**Build Steps:**

1. Validate email/password with Zod
2. Check email doesn't exist
3. Hash password with bcrypt
4. Create user with FREE tier
5. Send verification email
6. Return success response
7. Commit: `feat(auth): add registration endpoint`

---

**File 8/20:** `app/api/auth/verify-email/route.ts`

**Purpose:** Email verification endpoint

**Build Steps:**

1. Validate verification token
2. Update user.emailVerified
3. Return success response
4. Commit: `feat(auth): add email verification`

---

**File 9/20:** `app/api/auth/forgot-password/route.ts`

**Purpose:** Password reset request

**Build Steps:**

1. Validate email exists
2. Generate reset token
3. Send reset email
4. Commit: `feat(auth): add forgot password endpoint`

---

**File 10/20:** `app/api/auth/reset-password/route.ts`

**Purpose:** Password reset with token

**Build Steps:**

1. Validate reset token
2. Hash new password
3. Update user password
4. Invalidate token
5. Commit: `feat(auth): add password reset endpoint`

---

### Files 11-17: Frontend Pages

**File 11/20:** `app/(auth)/layout.tsx`

**Purpose:** Auth pages layout

**Build Steps:**

1. Create simple centered layout
2. No authentication check (public pages)
3. Add logo/branding
4. Commit: `feat(auth): add auth pages layout`

---

**File 12/20:** `app/(auth)/login/page.tsx`

**Purpose:** Login page with Google OAuth + credentials

**Seed Reference:** `seed-code/v0-components/next-js-login-form/app/page.tsx`

**Custom Component Reference:** `seed-code/v0-components/next-js-login-form/components/login-form.tsx`

**Build Steps:**

1. Create login form (email/password)
2. Add "Sign in with Google" button
3. Handle sign-in with NextAuth
4. Show error messages
5. Redirect to dashboard on success
6. Commit: `feat(auth): add login page with Google OAuth`

---

**File 13/20:** `app/(auth)/register/page.tsx`

**Purpose:** Registration page

**Seed Reference:** `seed-code/v0-components/registration-form-component-v2/app/page.tsx`

**Build Steps:**

1. Create registration form
2. Validate inputs client-side
3. Call /api/auth/register
4. Show verification email sent message
5. Commit: `feat(auth): add registration page`

---

**File 14/20:** `app/(auth)/verify-email/page.tsx`

**Purpose:** Email verification page

**Build Steps:**

1. Get token from URL params
2. Call /api/auth/verify-email
3. Show success/failure message
4. Redirect to login
5. Commit: `feat(auth): add email verification page`

---

**File 15/20:** `app/(auth)/forgot-password/page.tsx`

**Purpose:** Forgot password page

**Seed Reference:** `seed-code/v0-components/forgot-password-form/app/page.tsx`

**Custom Component Reference:** `seed-code/v0-components/forgot-password-form/components/forgot-password-flow.tsx`

**Build Steps:**

1. Create forgot password form
2. Call /api/auth/forgot-password
3. Show email sent message
4. Commit: `feat(auth): add forgot password page`

---

**File 16/20:** `app/(auth)/reset-password/page.tsx`

**Purpose:** Reset password page

**Build Steps:**

1. Get token from URL params
2. Create reset password form
3. Call /api/auth/reset-password
4. Redirect to login on success
5. Commit: `feat(auth): add reset password page`

---

**File 17/20:** `app/admin/login/page.tsx`

**Purpose:** Dedicated admin login page (separate from user login)

**Seed Reference:** `seed-code/v0-components/next-js-login-form/app/page.tsx`

**Custom Component Reference:** `seed-code/v0-components/next-js-login-form/components/login-form.tsx`

**Build Steps:**

1. Create admin-themed login form (email/password only)
2. **Note:** No Google OAuth button (admins use credentials only for security)
3. Handle sign-in with NextAuth credentials provider
4. **After login:** Verify session.user.role === 'ADMIN', redirect to `/admin/dashboard`
5. **If not admin:** Show error "Admin credentials required" and logout
6. Different styling/branding from user login (admin theme)
7. **Security:** Only 2 admin accounts exist (pre-seeded in database)
8. Commit: `feat(auth): add admin login page`

**Admin Accounts (Pre-configured):**

- Admin 1: Pure admin (`role='ADMIN'`, `isAffiliate=false`, `tier='FREE'`)
- Admin 2: Admin + Affiliate (`role='ADMIN'`, `isAffiliate=true`, `tier='FREE'`)

**Note:** No admin registration endpoint - admins are manually seeded via Prisma seed script

---

### Files 18-20: Components

**File 18/20:** `components/auth/register-form.tsx`

**Purpose:** Registration form component

**Build Steps:**

1. Create form with React Hook Form + Zod
2. Email, password, name fields
3. Client-side validation
4. Submit handler
5. Commit: `feat(auth): add registration form component`

---

**File 19/20:** `components/auth/login-form.tsx`

**Purpose:** Login form component

**Build Steps:**

1. Email/password form
2. "Remember me" checkbox
3. "Forgot password?" link
4. Submit with signIn()
5. Commit: `feat(auth): add login form component`

---

**File 20/20:** `components/auth/social-auth-buttons.tsx`

**Purpose:** Google OAuth button

**Build Steps:**

1. "Sign in with Google" button
2. Call signIn('google')
3. Loading state
4. Error handling
5. Commit: `feat(auth): add Google OAuth button`

---

## Testing After Part Complete

1. **Test Registration Flow**

   ```bash
   # Start dev server
   pnpm dev

   # Navigate to /register
   # Register new user
   # Check database for user
   # Verify email workflow
   ```

2. **Test Google OAuth**

   ```bash
   # Navigate to /login
   # Click "Sign in with Google"
   # Complete OAuth flow
   # Verify user created with emailVerified=true
   ```

3. **Test Login**

   ```bash
   # Navigate to /login
   # Login with registered user
   # Verify session created
   # Check tier in session
   ```

4. **Test Password Reset**

   ```bash
   # Navigate to /forgot-password
   # Enter email
   # Check reset email sent
   # Use reset link
   # Reset password
   # Login with new password
   ```

5. **Test Admin Login**

   ```bash
   # Navigate to /admin/login
   # Login with admin credentials (from seed data)
   # Verify redirects to /admin/dashboard
   # Check session.user.role === 'ADMIN'

   # Try accessing /admin/login with regular user
   # Verify shows error "Admin credentials required"
   ```

---

## Admin Account Seeding

**Pre-configured Admin Accounts:**

Create a Prisma seed script to insert 2 admin accounts.

**Note:** Uses Prisma 7 with bracket notation for environment variables (Pattern 14).

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin 1: Pure Admin
  const admin1Email = process.env['ADMIN_EMAIL'] || 'admin@tradingalerts.com';
  const admin1Password = process.env['ADMIN_PASSWORD'] || 'Admin123!@#';
  const admin1PasswordHash = await bcrypt.hash(admin1Password, 10);

  await prisma.user.upsert({
    where: { email: admin1Email },
    update: {},
    create: {
      email: admin1Email,
      password: admin1PasswordHash,
      name: 'System Administrator',
      role: 'ADMIN',
      tier: 'FREE',
      isAffiliate: false,
      emailVerified: new Date(),
    },
  });

  // Admin 2: Admin + Affiliate
  const admin2Email =
    process.env['ADMIN_AFFILIATE_EMAIL'] || 'admin-affiliate@tradingalerts.com';
  const admin2Password =
    process.env['ADMIN_AFFILIATE_PASSWORD'] || 'AdminAffiliate123!@#';
  const admin2PasswordHash = await bcrypt.hash(admin2Password, 10);

  const admin2 = await prisma.user.upsert({
    where: { email: admin2Email },
    update: {},
    create: {
      email: admin2Email,
      password: admin2PasswordHash,
      name: 'Admin Affiliate Manager',
      role: 'ADMIN',
      tier: 'FREE',
      isAffiliate: true,
      emailVerified: new Date(),
    },
  });

  // Create AffiliateProfile for Admin 2
  if (admin2.isAffiliate) {
    await prisma.affiliateProfile.upsert({
      where: { userId: admin2.id },
      update: {},
      create: {
        userId: admin2.id,
        fullName: 'Admin Affiliate Manager',
        country: 'US',
        paymentMethod: 'PAYPAL',
        paymentDetails: { email: admin2Email },
        status: 'ACTIVE',
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Run seed:**

```bash
npx prisma db seed
```

**Environment Variables:**

```bash
# Add to .env.local (DO NOT commit real passwords!)
ADMIN_EMAIL=admin@tradingalerts.com
ADMIN_PASSWORD=Admin123!@#
ADMIN_AFFILIATE_EMAIL=admin-affiliate@tradingalerts.com
ADMIN_AFFILIATE_PASSWORD=AdminAffiliate123!@#
```

**Security Notes:**

- Change default passwords in production
- Store in secure password manager
- Consider adding IP whitelist for `/admin/login` route
- Optional: Add 2FA requirement for admin accounts

---

## Success Criteria

- ✅ All 20 files built and committed
- ✅ User registration works with email/password
- ✅ Google OAuth sign-in works (users only, not admins)
- ✅ Email verification works
- ✅ Password reset works
- ✅ **Admin login page** at `/admin/login` works (credentials only)
- ✅ **Admin accounts** pre-seeded (2 admins: pure admin + admin+affiliate)
- ✅ Tier, role, and isAffiliate included in session
- ✅ Affiliate helpers (isAffiliate, requireAffiliate, getAffiliateProfile) work correctly
- ✅ Admin helpers (isAdmin, requireAdmin) work correctly
- ✅ Affiliate permissions (affiliate_dashboard, affiliate_codes, commission_reports) enforced
- ✅ Admin permissions (admin_dashboard, admin_users, admin_affiliates, admin_settings, admin_reports) enforced
- ✅ Unified authentication supports multiple roles (USER/ADMIN + affiliate status)
- ✅ **Admin login redirects** to `/admin/dashboard` after successful login
- ✅ **Non-admin users** cannot access admin routes (403 Forbidden)
- ✅ Verified-only account linking enforced
- ✅ All auth pages render correctly
- ✅ PROGRESS.md updated

---

## Next Steps

- Ready for Part 6: Flask MT5 Service (auth integration)
- Ready for Part 8: Dashboard (requires authentication)
- Unblocks: All protected routes

---

## Escalation Scenarios

**Scenario 1: Google OAuth not working**

- Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
- Verify redirect URIs in Google Console
- Check NextAuth callback URL

**Scenario 2: Account linking fails**

- Verify emailVerified is set
- Check Account model exists
- Review verified-only linking logic

---

**Last Updated:** 2025-12-07 (Updated for Prisma 7.1.0)
**Alignment:** (E) Phase 3 → (B) Part 5 → (C) This file
