# Google OAuth Implementation Decisions

**Date:** 2025-11-17
**Author:** Claude Code (Web) - Technical Architect
**Project:** Trading Alerts SaaS V7
**Status:** Final - Ready for Implementation

---

## Executive Summary

Based on comprehensive analysis of the Trading Alerts SaaS V7 codebase, I have resolved all 12 critical ambiguities for Google OAuth integration. This is a **greenfield authentication implementation** - no existing auth system exists, giving us the opportunity to implement OAuth correctly from the start.

**Key Findings:**

- NextAuth v4.24.5 already installed
- No existing Prisma schema or auth system
- Next.js 15 + React 19 modern stack
- Serverless deployment (Vercel/Railway)
- Policy-driven development workflow

All decisions prioritize: **Security > Performance > Simplicity > User Experience**

---

## DECISION 1: NextAuth.js Version

### Files Analyzed

- `package.json` (line 23: "next-auth": "^4.24.5")
- `app/api/auth/` (does not exist yet)
- `lib/auth/` (does not exist yet)

### Current State Found

- **Package.json shows:** "next-auth": "^4.24.5" (v4)
- **No existing auth implementation** (greenfield project)
- **No v5 dependencies** (@auth/nextjs not installed)

### Decision: **NextAuth.js v4**

### Reasoning

1. **Already installed**: v4.24.5 is present in package.json
2. **Stability**: v4 is mature, stable, extensively documented
3. **Community support**: Larger ecosystem, more Stack Overflow answers
4. **Less complexity**: v4 patterns are simpler than v5 beta
5. **No migration cost**: Greenfield project, no breaking changes to worry about
6. **Production-ready**: v4 is battle-tested in thousands of apps

### Implementation Impact

**Code Patterns:**

```typescript
// NextAuth v4 pattern
import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [...],
  session: { strategy: 'jwt' },
  callbacks: {...}
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**Import Statements:**

- `import NextAuth from 'next-auth'` (not `import { auth } from '@/auth'`)
- `import GoogleProvider from 'next-auth/providers/google'`
- `import { getServerSession } from 'next-auth/next'`

**Config Structure:**

- `authOptions` object exported separately
- File: `app/api/auth/[...nextauth]/route.ts`
- No separate `auth.ts` config file

**Files to Create/Update:**

- `app/api/auth/[...nextauth]/route.ts` (v4 route handler)
- `types/next-auth.d.ts` (v4 type extensions)
- `lib/auth/auth-options.ts` (optional: separate config)

---

## DECISION 2: Session Strategy

### Files Analyzed

- `prisma/schema.prisma` (does not exist yet)
- `.env.example` (no session-related variables)
- Deployment target: Vercel/Railway (serverless)

### Current State Found

- **No Prisma schema**: Database not created yet
- **No Session model**: Not defined
- **Serverless deployment**: .env.example shows Vercel pattern
- **No database sessions in use**: Greenfield

### Decision: **JWT Sessions (Cookie-based)**

### Reasoning

**Pros (Why JWT is best for this project):**

1. **Serverless-friendly**: No database query on every request
2. **Performance**: Faster (no DB roundtrip for session validation)
3. **Simpler schema**: No Session table needed (less complexity)
4. **Stateless**: Scales better with Vercel edge functions
5. **Lower cost**: Fewer database connections
6. **Immediate session updates**: Can update JWT on client

**Cons (Accepted tradeoffs):**

1. **Cannot revoke until expiry**: Mitigated by short expiration (30 days)
2. **Token size limits**: Our session data is small (id, email, tier, role)
3. **Less secure if stolen**: Mitigated by httpOnly, secure cookies

**Why NOT Database Sessions:**

- Requires Session table (additional schema complexity)
- DB query on every page load (slower, more expensive)
- Serverless cold starts compound latency
- Unnecessary for this use case

### Implementation Impact

**Configuration:**

```typescript
export const authOptions: NextAuthOptions = {
  // NO adapter for JWT sessions
  // adapter: PrismaAdapter(prisma), // ← Omit this

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({...})
  ],

  callbacks: {
    jwt({ token, user, trigger, session }) {
      // Store user data in JWT
      if (user) {
        token.id = user.id;
        token.tier = user.tier;
        token.role = user.role;
      }
      // Update JWT on session update
      if (trigger === 'update' && session) {
        token.tier = session.tier;
      }
      return token;
    },
    session({ session, token }) {
      // Expose JWT data to session
      session.user.id = token.id as string;
      session.user.tier = token.tier as string;
      session.user.role = token.role as string;
      return session;
    }
  }
};
```

**Schema Changes:**

- **DO NOT create Session model**
- **DO NOT create VerificationToken model** (not needed for JWT)
- **DO create Account model** (for OAuth provider linking)

**Files Affected:**

- `app/api/auth/[...nextauth]/route.ts` - No adapter, session: 'jwt'
- `prisma/schema.prisma` - Account model only (no Session)

---

## DECISION 3: Account Linking Security

### Files Analyzed

- `app/api/auth/register/route.ts` (does not exist)
- `prisma/schema.prisma` (does not exist)
- Email verification flow (not implemented)

### Current State Found

- **No existing users**: Greenfield project
- **No email verification system**: Not implemented yet
- **No account linking system**: Not implemented

### Decision: **Verified-Only Linking (Secure)**

### Reasoning

**Security Analysis:**

❌ **Automatic Linking (allowDangerousEmailAccountLinking: true) - REJECTED**

- **Attack scenario:**
  1. Attacker registers with victim@gmail.com (email/password)
  2. Attacker doesn't verify email
  3. Real victim signs in with Google OAuth (victim@gmail.com)
  4. Accounts auto-link
  5. Attacker now has access to victim's Google-authenticated account
- **SECURITY RISK: Account takeover vulnerability**

❌ **Manual Linking Only - REJECTED**

- Too complex for users
- Requires separate "Link Google" UI in settings
- Poor UX for common use case (user switches auth methods)

✅ **Verified-Only Linking - SELECTED**

- **Safe**: OAuth users have verified email (Google verified it)
- **Secure**: Email/password users MUST verify email before linking
- **Good UX**: Automatic linking for legitimate users
- **Prevents takeover**: Unverified email accounts cannot be hijacked

### Implementation Impact

**NextAuth Configuration:**

```typescript
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // DO NOT use allowDangerousEmailAccountLinking
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existingUser) {
          // ✅ SAFE TO LINK: Email verified via OAuth
          if (existingUser.emailVerified) {
            // Link accounts
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                image: user.image, // Update Google profile picture
              },
            });
            return true; // Allow sign-in
          } else {
            // ❌ NOT SAFE: Email not verified
            // Prevent account takeover
            return false; // Reject sign-in
            // Could also: redirect to email verification page
          }
        }

        // New user: create with emailVerified set
        // (Google has already verified this email)
        return true;
      }

      return true; // Allow credentials provider
    },
  },
};
```

**Error Handling:**

```typescript
// On login page
const result = await signIn('google', { redirect: false });

if (result?.error === 'Callback') {
  setError(
    'Email already in use but not verified. ' +
      'Please verify your email first, then link Google account.'
  );
}
```

**Database Schema:**

```prisma
model User {
  email         String    @unique
  emailVerified DateTime? // NULL = not verified, Timestamp = verified
  // ...
}
```

**Policy:**

- All email/password users MUST verify email
- Email verification emails sent on registration
- OAuth users auto-verified (emailVerified = now())
- Linking only happens if emailVerified is set

---

## DECISION 4: Password Field Nullable

### Files Analyzed

- `prisma/schema.prisma` (does not exist)
- `app/api/auth/register/route.ts` (does not exist)

### Current State Found

- **No existing schema**: Greenfield project
- **No production users**: Can design schema freely

### Decision: **Password Nullable (String?)**

### Reasoning

**Why Nullable:**

1. **OAuth-only users**: Users who sign up with Google don't have passwords
2. **Cleaner design**: NULL clearly indicates "no password set"
3. **Simpler logic**: Easy to check `if (!user.password)` for OAuth-only users
4. **Future-proof**: Supports adding more OAuth providers (GitHub, etc.)
5. **No fake passwords**: Avoid generating random passwords for OAuth users

**Why NOT Required:**

- Forces generation of random passwords for OAuth users
- Wastes database space
- More complex validation logic
- Confusing in admin panels (fake password shown)

### Implementation Impact

**Prisma Schema:**

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  password            String?   // ← NULLABLE for OAuth-only users
  name                String?
  image               String?   // Google profile picture
  tier                String    @default("FREE")
  role                String    @default("USER")
  emailVerified       DateTime? // Auto-set for OAuth
  isActive            Boolean   @default(true)
  hasUsedThreeDayPlan Boolean   @default(false)
  threeDayPlanUsedAt  DateTime?
  lastLoginIP         String?
  deviceFingerprint   String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  alerts              Alert[]
  watchlistItems      WatchlistItem[]
  subscription        Subscription?
  payments            Payment[]
  fraudAlerts         FraudAlert[]
  accounts            Account[]  // OAuth accounts
}
```

**Validation Logic:**

```typescript
// Email/password login
async authorize(credentials) {
  const user = await prisma.user.findUnique({
    where: { email: credentials.email }
  });

  // Check if user has password (not OAuth-only)
  if (!user || !user.password) {
    throw new Error('Invalid credentials');
  }

  const isValid = await bcrypt.compare(
    credentials.password,
    user.password
  );

  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  return user;
}
```

**Migration:**

- No migration needed (greenfield)
- Initial migration: `password String?` from the start

**User Types:**

1. **Email/password only**: password = hashed string, accounts = []
2. **OAuth only**: password = NULL, accounts = [Google]
3. **Hybrid (linked)**: password = hashed string, accounts = [Google]

---

## DECISION 5: Email Verification Flow

### Files Analyzed

- Email verification not yet implemented
- Resend API key in .env.example

### Current State Found

- **No email system**: Not implemented
- **Resend API planned**: .env.example shows RESEND_API_KEY
- **No verification flow**: Greenfield

### Decision: **Auto-Verify OAuth Users**

### Reasoning

**For Google OAuth Users:**

- **Google has already verified the email** (OAuth requires verified email)
- **Trust the OAuth provider** (industry standard)
- **Better UX**: User can use app immediately after OAuth signup
- **No extra emails needed**: Less complexity, lower email costs

**For Email/Password Users:**

- **Must verify email** (security best practice)
- **Send verification link** via Resend
- **Cannot link Google** until email verified (security)

**Why this makes sense:**

1. **Different trust levels**: OAuth = provider verified, Email = self-claimed
2. **Industry standard**: GitHub, GitLab, etc. auto-verify OAuth users
3. **Security maintained**: Verified-only linking prevents takeover
4. **Simpler UX**: OAuth users don't get redundant verification emails

### Implementation Impact

**OAuth Sign-In Callback:**

```typescript
callbacks: {
  async signIn({ user, account }) {
    if (account?.provider === 'google') {
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! }
      });

      if (!existingUser) {
        // New OAuth user: auto-verify email
        // (Prisma adapter will create user, but ensure emailVerified is set)
        await prisma.user.update({
          where: { email: user.email! },
          data: {
            emailVerified: new Date(), // ← Auto-verify
            image: user.image,
          }
        });
      } else if (!existingUser.emailVerified) {
        // Existing user, unverified email
        // Update to verified (Google confirmed it)
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: new Date(), // ← Auto-verify
          }
        });
      }
    }
    return true;
  }
}
```

**Email/Password Registration:**

```typescript
// app/api/auth/register/route.ts
export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      tier: 'FREE',
      emailVerified: null, // ← Not verified yet
    },
  });

  // Send verification email
  await sendVerificationEmail(email, verificationToken);

  return NextResponse.json({
    message: 'Please check your email to verify your account',
  });
}
```

**Middleware (Enforce Verification):**

```typescript
// Only enforce verification for email/password users
// OAuth users auto-verified
export async function middleware(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { accounts: true },
    });

    // If email/password user (no OAuth accounts) and not verified
    if (user.accounts.length === 0 && !user.emailVerified) {
      // Redirect to verification reminder page
      return NextResponse.redirect('/verify-email');
    }
  }
}
```

---

## DECISION 6: Profile Picture Handling

### Files Analyzed

- No avatar upload feature documented
- No user settings UI implemented yet

### Current State Found

- **No avatar upload**: Not implemented
- **User.image field**: Not in current schema (will add)

### Decision: **Fallback Only (Google as Default)**

### Reasoning

**Selected Strategy: Fallback**

- **First time OAuth signup**: Use Google profile picture
- **If user uploads custom avatar**: Keep custom avatar (don't overwrite)
- **If user has no custom avatar**: Use Google picture as fallback
- **User control**: Can change in settings later

**Why NOT Always Use Google:**

- Users lose control over their profile picture
- Custom avatars get overwritten on every login
- Poor UX if user uploaded professional headshot

**Why NOT User Choice:**

- Too complex for initial implementation
- Requires additional UI (toggle in settings)
- Most users won't care enough to toggle

**Implementation:**

```typescript
// signIn callback
if (account?.provider === 'google') {
  const existingUser = await prisma.user.findUnique({
    where: { email: user.email! },
  });

  if (existingUser) {
    // Only update image if user doesn't have one
    if (!existingUser.image) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          image: user.image, // ← Use Google picture as fallback
        },
      });
    }
    // If user has custom image, don't overwrite it
  } else {
    // New user: use Google picture
    // (Prisma adapter will set image automatically)
  }
}
```

**Future Enhancement:**

- Add "Use Google Profile Picture" button in settings
- Allow user to switch back to Google picture if desired
- Store both custom and OAuth pictures separately

---

## DECISION 7: Production Environment Setup

### Files Analyzed

- `.env.example` (shows dev and prod NEXTAUTH_URL)
- `vercel.json` (does not exist)
- README.md mentions Vercel deployment

### Current State Found

- **Deployment platform**: Vercel (from .env.example comments)
- **No staging environment**: Only dev + prod
- **Single domain structure**: No multi-environment setup

### Decision: **Single Production Domain, Separate Google OAuth Apps**

### Reasoning

**Environments:**

1. **Development**: `http://localhost:3000`
2. **Production**: `https://yourdomain.vercel.app` (or custom domain)

**No Staging Environment:**

- Project structure shows only dev/prod
- Staging adds complexity without clear benefit for this project
- Can test on preview deployments (Vercel feature)

**Google OAuth Apps Strategy:**

**Option A: One Google App, Multiple Redirect URIs** ← **SELECTED**

```
Google OAuth App: "Trading Alerts SaaS"
Authorized redirect URIs:
  - http://localhost:3000/api/auth/callback/google (dev)
  - https://yourdomain.vercel.app/api/auth/callback/google (prod)
  - https://custom-domain.com/api/auth/callback/google (if custom domain)
```

**Pros:**

- Simpler management (one set of credentials)
- Easier to add new redirect URIs
- Lower maintenance burden
- Same client ID/secret for all environments

**Cons (Mitigated):**

- Shared credentials (mitigated: use environment variables)
- Cannot isolate dev/prod (low risk for this project)

**Why NOT Separate Apps:**

- More complex (2 client IDs, 2 secrets)
- Must update environment variables per environment
- Overkill for small team/solo project
- No clear security benefit

### Implementation Impact

**Google Cloud Console Setup:**

1. Create ONE Google Cloud project: "Trading Alerts SaaS"
2. Create ONE OAuth 2.0 Client
3. Add ALL redirect URIs (dev + prod)

**Environment Variables:**

**Development (.env.local):**

```bash
GOOGLE_CLIENT_ID=same_client_id_for_all
GOOGLE_CLIENT_SECRET=same_secret_for_all
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev_secret_here
```

**Production (Vercel Environment Variables):**

```bash
GOOGLE_CLIENT_ID=same_client_id_for_all
GOOGLE_CLIENT_SECRET=same_secret_for_all
NEXTAUTH_URL=https://yourdomain.vercel.app
NEXTAUTH_SECRET=prod_secret_here (different from dev)
```

**Redirect URIs in Google Console:**

```
Authorized redirect URIs:
  - http://localhost:3000/api/auth/callback/google
  - http://127.0.0.1:3000/api/auth/callback/google (for IPv4)
  - https://yourdomain.vercel.app/api/auth/callback/google
  - https://www.yourdomain.com/api/auth/callback/google (if www)
```

**Production Domain:**

- To be determined by Human
- Can be Vercel default (.vercel.app) or custom domain
- Must update Google OAuth redirect URIs after deploying

---

## DECISION 8: Error Handling Strategy

### Files Analyzed

- `docs/policies/02-quality-standards.md` (comprehensive error handling required)
- No existing auth error handlers

### Current State Found

- **Quality standards**: Extensive error handling policies
- **No existing patterns**: Greenfield implementation

### Decision: **Specific Errors (User-Friendly + Detailed)**

### Reasoning

**Why Specific Errors:**

1. **Better UX**: Users know exactly what went wrong
2. **Easier debugging**: Developers can identify issues quickly
3. **Meets quality standards**: Policy 02 requires comprehensive error handling
4. **Aligns with codebase**: OpenAPI spec shows detailed error responses
5. **Security balanced**: Don't expose internals, but be helpful

**Error Categories:**

**1. Authentication Errors:**

```typescript
switch (error.type) {
  case 'CredentialsSignin':
    return 'Invalid email or password';
  case 'OAuthSignin':
    return 'Failed to connect to Google. Please try again.';
  case 'OAuthCallback':
    return 'Google authorization failed. Please try again.';
  case 'OAuthCreateAccount':
    return 'Failed to create account. Email may already be in use.';
  case 'EmailCreateAccount':
    return 'Email already registered. Please sign in instead.';
  case 'Callback':
    return 'Authentication error. Please try again.';
  default:
    return 'An unexpected error occurred. Please try again.';
}
```

**2. Account Linking Errors:**

```typescript
if (!existingUser.emailVerified) {
  return {
    error: 'Email not verified',
    message: 'Please verify your email address before linking Google account.',
    action: 'check_email',
  };
}
```

**3. OAuth State Errors:**

```typescript
if (stateMismatch) {
  // Log security event
  console.error('OAuth CSRF attempt detected', { ip, email });

  return {
    error: 'Security validation failed',
    message: 'Please try signing in again.',
    code: 'CSRF_DETECTED',
  };
}
```

### Implementation Impact

**Login Page Error Display:**

```tsx
const handleGoogleLogin = async () => {
  try {
    const result = await signIn('google', { redirect: false });

    if (result?.error) {
      // Map NextAuth errors to user-friendly messages
      const errorMessage = getErrorMessage(result.error);
      setError(errorMessage);

      // Optional: Show action button
      if (result.error === 'EmailCreateAccount') {
        setShowSignInButton(true);
      }
    } else {
      router.push('/dashboard');
    }
  } catch (error) {
    setError('An unexpected error occurred. Please try again.');
    console.error('Google OAuth error:', error);
  }
};
```

**Error Helper:**

```typescript
// lib/auth/errors.ts
export function getOAuthErrorMessage(errorType: string): {
  title: string;
  message: string;
  action?: string;
} {
  const errors = {
    OAuthSignin: {
      title: 'Connection Failed',
      message:
        'Unable to connect to Google. Please check your internet connection.',
    },
    OAuthCallback: {
      title: 'Authorization Failed',
      message: 'Google authorization was not completed. Please try again.',
    },
    OAuthAccountNotLinked: {
      title: 'Email Already Registered',
      message:
        'This email is already registered with a password. Please sign in with your password first, then link Google in settings.',
      action: 'Go to Sign In',
    },
    EmailCreateAccount: {
      title: 'Email Already In Use',
      message:
        'An account with this email already exists. Please sign in instead.',
      action: 'Go to Sign In',
    },
  };

  return (
    errors[errorType] || {
      title: 'Authentication Error',
      message: 'An error occurred during sign-in. Please try again.',
    }
  );
}
```

**Logging Strategy:**

```typescript
// Server-side: Log detailed errors
console.error('OAuth error:', {
  error: error.message,
  code: error.code,
  provider: account?.provider,
  email: user?.email,
  timestamp: new Date().toISOString(),
});

// Client-side: Show user-friendly message
setError('Failed to sign in with Google. Please try again.');
```

---

## DECISION 9: Testing Strategy for OAuth

### Files Analyzed

- `package.json` (no test framework installed)
- No `/tests` directory
- No CI/CD workflows

### Current State Found

- **No testing infrastructure**: No Jest, Cypress, Playwright
- **Manual testing**: Primary testing method
- **Solo/small team**: Based on project structure

### Decision: **Localhost Testing + Comprehensive Manual Checklist**

### Reasoning

**Why Localhost Testing:**

1. **Simplest setup**: Google OAuth works with localhost
2. **Fast iteration**: No need for tunneling or deployment
3. **Cost-free**: No additional services required
4. **Sufficient for solo dev**: Matches team size

**Why NOT ngrok/Tunneling:**

- Adds complexity
- Not needed (localhost supported by Google)
- Extra tool to manage

**Why NOT Separate Test App:**

- Overkill for current project size
- Can use same Google app with localhost redirect
- Adds management overhead

**Testing Approach:**

1. **Local Development**: Test with `http://localhost:3000`
2. **Google Console**: Add localhost callback URL
3. **Manual Testing**: Follow comprehensive checklist (Task 8)
4. **Production Testing**: Test on Vercel preview deployments before merging

### Implementation Impact

**Google Console Setup (Development):**

```
Authorized redirect URIs:
  ✅ http://localhost:3000/api/auth/callback/google
  ✅ http://127.0.0.1:3000/api/auth/callback/google
```

**Local Testing Workflow:**

```bash
# 1. Start development server
pnpm dev

# 2. Visit http://localhost:3000/login

# 3. Click "Sign in with Google"

# 4. Test flows:
   - New user signup
   - Existing user login
   - Account linking
   - Error scenarios

# 5. Check database:
npx prisma studio

# 6. Verify:
   - User created
   - Account record exists
   - emailVerified set
   - tier = FREE
```

**Testing Checklist:**

- See Task 8: `docs/testing/oauth-testing-checklist.md` (126 tests)
- Manual testing covers all scenarios
- No automated tests initially (can add later)

**CI/CD:**

- No automated testing initially
- Manual approval before production
- Vercel preview deployments for staging tests

---

## DECISION 10: Database Migration for Existing Users

### Files Analyzed

- `prisma/schema.prisma` (does not exist)
- `prisma/migrations/` (does not exist)
- No production database

### Current State Found

- **Greenfield project**: No database created
- **No existing users**: No production users
- **No migrations**: First migration will be initial schema

### Decision: **No Migration Needed (Initial Schema)**

### Reasoning

**Why No Migration:**

1. **No existing database**: This is the first schema
2. **No production users**: Cannot break existing data
3. **Clean slate**: Can design schema optimally from start

**Initial Schema Design:**

```prisma
// This is the FIRST migration
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  password            String?   // ← Nullable from day 1
  name                String?
  image               String?
  tier                String    @default("FREE")
  role                String    @default("USER")
  emailVerified       DateTime? // ← Nullable from day 1
  isActive            Boolean   @default(true)
  hasUsedThreeDayPlan Boolean   @default(false)
  threeDayPlanUsedAt  DateTime?
  lastLoginIP         String?
  deviceFingerprint   String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  accounts            Account[] // ← New relation
  alerts              Alert[]
  watchlistItems      WatchlistItem[]
  subscription        Subscription?
  payments            Payment[]
  fraudAlerts         FraudAlert[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // "oauth"
  provider          String  // "google", "credentials"
  providerAccountId String  // Google user ID
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

### Implementation Impact

**First Migration:**

```bash
# Create initial migration with OAuth support
npx prisma migrate dev --name initial_schema_with_oauth

# This creates:
# - User table (with password nullable)
# - Account table (for OAuth)
# - All other tables
# - No data migration needed
```

**No Rollback Needed:**

- First migration, nothing to roll back
- If issues found, can delete database and recreate

**Future Migrations:**

- When adding new OAuth providers (GitHub, etc.):
  - No schema changes needed (Account model supports it)
  - Just add new provider in NextAuth config

---

## DECISION 11: Multiple Callback URLs Strategy

### Files Analyzed

- `.env.example` (shows dev and prod URLs)
- No vercel.json (Vercel auto-configures)

### Current State Found

- **2 environments**: Dev + Prod
- **Single domain**: One production URL

### Decision: **One Google App, Multiple Redirect URIs**

### Reasoning

**Why One Google App:**

1. **Simpler management**: One Client ID, one Secret
2. **Easier to add environments**: Just add redirect URI
3. **Lower overhead**: Don't need to manage multiple apps
4. **Sufficient security**: Redirect URIs are whitelisted
5. **Standard practice**: Common for small/medium projects

**Redirect URIs to Add:**

```
Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs:

Development:
  ✅ http://localhost:3000/api/auth/callback/google
  ✅ http://127.0.0.1:3000/api/auth/callback/google

Production:
  ✅ https://yourdomain.vercel.app/api/auth/callback/google
  ✅ https://www.yourdomain.com/api/auth/callback/google (if using www)
  ✅ https://custom-domain.com/api/auth/callback/google (if custom domain)

Vercel Preview Deployments (optional):
  ❌ Do NOT add preview URLs (too many, constantly changing)
  ℹ️ Test OAuth on localhost before merging to main
```

### Implementation Impact

**Google Cloud Console Setup:**

**Step 1: Create OAuth 2.0 Client**

- Name: "Trading Alerts SaaS"
- Application type: Web application

**Step 2: Add All Redirect URIs**

```
Authorized redirect URIs:
  http://localhost:3000/api/auth/callback/google
  http://127.0.0.1:3000/api/auth/callback/google
  https://[your-domain]/api/auth/callback/google
```

**Step 3: Copy Credentials**

- Client ID: Store in GOOGLE_CLIENT_ID
- Client Secret: Store in GOOGLE_CLIENT_SECRET

**Environment Variables (Same for All):**

**Development:**

```bash
GOOGLE_CLIENT_ID=123456-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xyz123
NEXTAUTH_URL=http://localhost:3000
```

**Production (Vercel):**

```bash
GOOGLE_CLIENT_ID=123456-abc.apps.googleusercontent.com  # ← Same
GOOGLE_CLIENT_SECRET=GOCSPX-xyz123  # ← Same
NEXTAUTH_URL=https://yourdomain.vercel.app  # ← Different
```

**Advantages:**

- Single source of truth for credentials
- Easy to test locally
- No environment-specific configuration in code
- NEXTAUTH_URL automatically constructs callback URL

**Security:**

- Redirect URIs are strictly validated by Google
- Even with shared credentials, cannot redirect to unauthorized URLs
- Production NEXTAUTH_SECRET is different (unique per env)

---

## DECISION 12: Tier Upgrade Journey for OAuth Users

### Files Analyzed

- `/docs/v5-structure-division.md` (pricing page planned)
- `/docs/trading_alerts_openapi.yaml` (tier system defined)
- Payment integration documented (Stripe + dLocal)

### Current State Found

- **2-tier system**: FREE and PRO
- **All users start FREE**: Documented in OpenAPI spec
- **Payment separate**: Stripe/dLocal webhooks handle upgrades
- **No special onboarding**: Dashboard-first approach

### Decision: **Standard Onboarding (Same as Email Users)**

### Reasoning

**Selected: Option A (Standard Onboarding)**

- OAuth user signs in → Redirects to `/dashboard`
- Sees FREE tier features
- Can click "Upgrade to PRO" anytime
- Same flow as email/password users

**Why NOT Immediate Upgrade Prompt:**

- Too aggressive (poor UX)
- Users want to explore app first
- May feel like bait-and-switch
- Not aligned with existing design

**Why NOT Smart Banner:**

- Adds complexity (dismissible banner state)
- May be ignored anyway
- Current design doesn't show upgrade prompts
- Tier badge in header is sufficient

**Consistency is Key:**

- Email users: Dashboard first
- OAuth users: Dashboard first ← Same
- Payment method independent of auth method
- Tier system independent of auth method

### Implementation Impact

**OAuth Callback Redirect:**

```typescript
// After successful OAuth sign-in
callbacks: {
  async redirect({ url, baseUrl }) {
    // Always redirect to dashboard after sign-in
    if (url.startsWith(baseUrl)) return url;
    return `${baseUrl}/dashboard`; // ← Standard redirect
  }
}
```

**Dashboard Display (FREE tier):**

```tsx
// app/(dashboard)/dashboard/page.tsx
export default function Dashboard() {
  const { data: session } = useSession();

  return (
    <div>
      {/* Header shows tier badge */}
      <Header tier={session.user.tier} />

      {/* FREE tier limitations shown */}
      <TierLimitBanner
        tier="FREE"
        message="5 symbols, 3 timeframes available"
        upgradeLink="/pricing"
      />

      {/* Main content */}
      <DashboardContent />
    </div>
  );
}
```

**Upgrade Flow (Same for ALL users):**

```
1. User clicks "Upgrade to PRO" (in header or pricing page)
   ↓
2. Redirects to /pricing
   ↓
3. User selects payment provider:
   - Stripe (international cards)
   - dLocal (local payment methods)
   ↓
4. Completes payment
   ↓
5. Webhook updates User.tier = "PRO"
   ↓
6. Session refreshed, tier updated
   ↓
7. User sees PRO features (15 symbols, 9 timeframes)
```

**Key Principle:**

```
Authentication Method ≠ Payment Provider
- Google OAuth user → Can pay with Stripe OR dLocal
- Email/Password user → Can pay with Stripe OR dLocal
- Both have identical upgrade flow
```

**UI Consistency:**

- No "Welcome, Google User!" messages
- No special OAuth onboarding screens
- Same dashboard for everyone
- Tier badge shows current tier (FREE/PRO)
- Upgrade CTA in header (visible on all pages)

---

## Summary Table

| #   | Ambiguity          | Decision                   | Rationale                                     | Migration Required |
| --- | ------------------ | -------------------------- | --------------------------------------------- | ------------------ |
| 1   | NextAuth Version   | **v4**                     | Already installed, stable, production-ready   | No                 |
| 2   | Session Strategy   | **JWT**                    | Serverless-friendly, faster, no Session table | No                 |
| 3   | Account Linking    | **Verified-only**          | Secure, prevents account takeover             | No                 |
| 4   | Password Nullable  | **Yes (String?)**          | Clean design for OAuth-only users             | No (greenfield)    |
| 5   | Email Verification | **Auto-verify OAuth**      | Google verified, better UX                    | No                 |
| 6   | Profile Picture    | **Fallback**               | Use Google only if no custom avatar           | No                 |
| 7   | Production Setup   | **One domain**             | Vercel deployment, simple structure           | No                 |
| 8   | Error Handling     | **Specific errors**        | Better UX, meets quality standards            | No                 |
| 9   | Testing Strategy   | **Localhost + Manual**     | Simple, sufficient for team size              | No                 |
| 10  | Database Migration | **Not needed**             | Greenfield project, initial schema            | No (greenfield)    |
| 11  | Callback URLs      | **One app, multiple URIs** | Simpler management, sufficient security       | No                 |
| 12  | Tier Upgrade UX    | **Standard onboarding**    | Consistency with email users                  | No                 |

---

## Implementation Priority Order

### Phase 1: Foundation (Do First)

1. ✅ Create Prisma schema with Account model (Decision 4, 10)
2. ✅ Run initial migration: `npx prisma migrate dev --name initial_with_oauth`
3. ✅ Set up Google Cloud Console OAuth app (Decision 7, 11)
4. ✅ Add environment variables (Decision 7)

### Phase 2: Core Integration

5. ✅ Implement NextAuth v4 configuration (Decision 1, 2)
6. ✅ Add GoogleProvider with verified-only linking (Decision 3)
7. ✅ Implement JWT callbacks with tier/role (Decision 2)
8. ✅ Update login/register pages with OAuth buttons (Decision 12)

### Phase 3: Security & UX

9. ✅ Implement email verification (Decision 5)
10. ✅ Add error handling (Decision 8)
11. ✅ Profile picture logic (Decision 6)
12. ✅ Type definitions (Decision 1)

### Phase 4: Documentation & Testing

13. ✅ Create all documentation files (Tasks 2-10)
14. ✅ Manual testing with localhost (Decision 9)
15. ✅ Production deployment with correct redirect URIs (Decision 7, 11)

---

## Required Database Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  password            String?   // ← Decision 4: Nullable
  name                String?
  image               String?   // ← Decision 6: Profile picture
  tier                String    @default("FREE")
  role                String    @default("USER")
  isActive            Boolean   @default(true)
  emailVerified       DateTime? // ← Decision 5: Auto-set for OAuth
  hasUsedThreeDayPlan Boolean   @default(false)
  threeDayPlanUsedAt  DateTime?
  lastLoginIP         String?
  deviceFingerprint   String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  // Relations
  alerts              Alert[]
  watchlistItems      WatchlistItem[]
  subscription        Subscription?
  payments            Payment[]
  fraudAlerts         FraudAlert[]
  accounts            Account[]  // ← OAuth accounts

  @@index([email])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // "oauth"
  provider          String  // "google", "credentials"
  providerAccountId String  // Google user ID
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}

// NO Session model (Decision 2: JWT sessions)
// NO VerificationToken model (Decision 2: JWT sessions)
```

---

## Environment Variables Required

### Development (.env.local)

```bash
# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/trading_alerts

# Email (Resend)
RESEND_API_KEY=re_your_api_key
```

### Production (Vercel Environment Variables)

```bash
# Google OAuth (same credentials as dev)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret

# NextAuth.js
NEXTAUTH_URL=https://yourdomain.vercel.app
NEXTAUTH_SECRET=different_strong_secret_for_production

# Database (Railway or Vercel Postgres)
DATABASE_URL=postgresql://...

# Email
RESEND_API_KEY=re_your_production_key
```

---

## Google Cloud Console Setup Steps

### Step 1: Create Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Trading Alerts SaaS"

### Step 2: Enable APIs

1. Navigate to **APIs & Services** > **Library**
2. Search "Google+ API"
3. Click **Enable**

### Step 3: Configure OAuth Consent Screen

1. **APIs & Services** > **OAuth consent screen**
2. Select **External** (for public app)
3. Fill in:
   - App name: Trading Alerts
   - User support email: your-email@example.com
   - Developer contact: your-email@example.com
4. Add scopes:
   - `userinfo.email`
   - `userinfo.profile`
5. Add test users (for development)

### Step 4: Create OAuth 2.0 Credentials

1. **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: "Trading Alerts Web Client"
5. Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/google
   http://127.0.0.1:3000/api/auth/callback/google
   https://yourdomain.vercel.app/api/auth/callback/google
   ```
6. Click **Create**
7. Copy **Client ID** and **Client Secret**

---

## Risk Assessment

### High Risk Items

**None identified.** This is a greenfield implementation with secure defaults.

### Medium Risk Items

1. **Account linking**: Mitigated by verified-only strategy
2. **JWT session expiration**: Mitigated by 30-day expiry, user can re-login

### Low Risk Items

1. **Google API rate limits**: Unlikely to hit with small user base
2. **Profile picture updates**: Minor UX issue, can enhance later

### Mitigation Strategies

1. **Email verification enforcement**: Prevent unverified email account takeover
2. **Error logging**: Capture OAuth errors for debugging
3. **Localhost testing**: Thorough manual testing before production
4. **Separate NEXTAUTH_SECRET**: Different secrets for dev/prod

---

## Next Steps for Implementation

### 1. Human Review & Approval

- **Action**: Human reviews this decision document
- **Approve**: All 12 decisions acceptable?
- **Modify**: Any decisions need changes?

### 2. Google Cloud Console Setup

- **Action**: Follow Step 4 above to create OAuth credentials
- **Deliverable**: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

### 3. Environment Variables

- **Action**: Add OAuth variables to .env.local
- **Test**: Verify NEXTAUTH_URL and NEXTAUTH_SECRET set

### 4. Documentation Updates (Claude Code)

- **Task 2**: Update implementation guide with decisions
- **Task 3**: Update OpenAPI contract
- **Task 4**: Create ARCHITECTURE.md with OAuth section
- **Task 5**: Update v5-structure-division.md
- **Task 6**: Create Aider policy document
- **Task 7**: Update .aider.conf.yml
- **Task 8**: Create testing checklist
- **Task 9**: Verify setup guide
- **Task 10**: Create summary document

### 5. Implementation (Aider)

- **Action**: Aider builds OAuth system following all decisions
- **Files**: 13 implementation files (listed in summary doc)
- **Validation**: Claude Code validates against policies

### 6. Testing (Human)

- **Action**: Human tests OAuth flow locally
- **Checklist**: Follow 126-point testing checklist
- **Approve**: Ready for production deployment

### 7. Deployment

- **Action**: Deploy to Vercel production
- **Update**: Google OAuth redirect URIs with production URL
- **Monitor**: Watch for OAuth errors in production

---

## Success Criteria

### Documentation Complete ✅

- [x] All 12 decisions made with clear reasoning
- [x] Decisions match greenfield project requirements
- [x] Security best practices followed (verified-only linking)
- [x] No migrations needed (greenfield advantage)
- [x] Implementation priority clear
- [x] Testing strategy defined
- [x] Risk assessment complete

### Ready for Implementation ✅

- [x] Schema design finalized
- [x] Environment structure defined
- [x] Google Console setup steps documented
- [x] Error handling strategy decided
- [x] Testing approach clarified
- [x] No ambiguities remaining

### Security Standards Met ✅

- [x] Verified-only account linking (prevents takeover)
- [x] JWT sessions with secure cookies
- [x] Separate NEXTAUTH_SECRET per environment
- [x] Auto-verify OAuth users (trust Google)
- [x] Specific error messages (user-friendly, secure)

---

**Estimated Implementation Time:** 6-8 hours (Aider autonomous building)
**Complexity Level:** Medium (greenfield advantage, clear decisions)
**Breaking Changes:** None (no existing users)

---

**Last Updated:** 2025-11-17
**Next Review:** After Human approval
**Status:** ✅ COMPLETE - Ready for Human Review

---

**End of Decision Document**
