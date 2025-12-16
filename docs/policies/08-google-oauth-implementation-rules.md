# Policy 08: Google OAuth Implementation Rules

**Version:** 1.0  
**Date:** 2025-11-17  
**Scope:** Part 5 (Authentication System) - Google OAuth Integration  
**Status:** Active  
**Decision Document:** `docs/decisions/google-oauth-decisions.md`

---

## 1. Core Principles

### 1.1 Additive, Not Replacement

- Google OAuth is ADDED to existing email/password authentication
- Email/password login MUST continue working (even though not implemented yet)
- All new users (OAuth or email) start as FREE tier
- No breaking changes to future authentication flow

### 1.2 Security First (CRITICAL)

Based on Decision #3 - this is the MOST IMPORTANT policy:

**Account Linking Strategy: VERIFIED-ONLY**

```typescript
// CRITICAL SECURITY RULE
if (existingUser && !existingUser.emailVerified) {
  // REJECT: Cannot link unverified email accounts
  return false; // Prevents account takeover attack
}
```

**Why This Matters:**

- Prevents account takeover vulnerability
- Attacker cannot hijack OAuth user by registering unverified email first
- Industry-standard security practice

### 1.3 Tier Independence

- ALL new users (OAuth or email) start as FREE tier
- Authentication method does NOT affect tier
- Payment provider selection is independent of auth method
- Tier upgrades handled by existing payment webhooks (Parts 12 & 18)

---

## 2. Technical Decisions (From Decision Document)

**Reference:** `docs/decisions/google-oauth-decisions.md`

### 2.1 NextAuth Version: v4 (Decision #1)

**Required:** NextAuth.js v4.24.5 (already installed)

**Code Pattern:**

```typescript
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

**DO NOT use v5 patterns:**

- ❌ `import { auth } from '@/auth'`
- ❌ Separate `auth.ts` config file

### 2.2 Session Strategy: JWT (Decision #2)

**Required:** JWT sessions (cookie-based, no database)

**Configuration:**

```typescript
// NO adapter (JWT sessions don't need Prisma adapter)
session: {
  strategy: 'jwt',
  maxAge: 30 * 24 * 60 * 60, // 30 days
}
```

**DO NOT:**

- ❌ Add `adapter: PrismaAdapter(prisma)`
- ❌ Create Session model in Prisma schema
- ❌ Use `strategy: 'database'`

**Why:** 27% faster, serverless-friendly, no DB queries per request

### 2.3 Database Schema (Decisions #4, #10)

**Prisma Schema Requirements:**

```prisma
model User {
  password      String?   // ← NULLABLE (Decision #4)
  emailVerified DateTime? // ← NULLABLE (Decision #5)
  image         String?   // ← Google profile picture
  accounts      Account[] // ← OAuth provider accounts

  // NO sessions relation (JWT strategy)
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // "oauth"
  provider          String  // "google"
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

// NO Session model (Decision #2: JWT sessions)
// NO VerificationToken model (not needed for JWT)
```

### 2.4 Account Linking: Verified-Only (Decision #3)

**Implementation in signIn callback:**

```typescript
callbacks: {
  async signIn({ user, account, profile }) {
    if (account?.provider === 'google') {
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email! }
      });

      if (existingUser) {
        // SECURITY CHECK: Only link if email is verified
        if (!existingUser.emailVerified) {
          // REJECT: Prevent account takeover
          console.warn('OAuth rejected: Email not verified', { email: user.email });
          return false;
        }

        // SAFE TO LINK: Email verified
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            image: user.image, // Update Google profile picture (Decision #6)
            emailVerified: new Date(), // Ensure verified timestamp
          }
        });
      } else {
        // NEW USER: Auto-verify (Google verified the email)
        // Prisma adapter will create user, but ensure emailVerified is set
        await prisma.user.update({
          where: { email: user.email! },
          data: {
            emailVerified: new Date(), // Decision #5: Auto-verify OAuth
          }
        });
      }
    }

    return true; // Allow sign-in
  }
}
```

---

## 3. File Implementation Rules

### 3.1 NextAuth Configuration

**File:** `app/api/auth/[...nextauth]/route.ts`

**MUST Include:**

- ✅ NextAuth v4 import pattern
- ✅ GoogleProvider with correct credentials
- ✅ CredentialsProvider (for future email/password)
- ✅ Session strategy: 'jwt'
- ✅ NO adapter (JWT sessions)
- ✅ signIn callback with verified-only linking
- ✅ jwt callback with tier and role
- ✅ session callback with tier and role

**Template:**

```typescript
import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  // NO adapter (JWT sessions)
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // NO allowDangerousEmailAccountLinking
    }),

    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          tier: user.tier,
          role: user.role,
        };
      }
    })
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! }
        });

        if (existingUser && !existingUser.emailVerified) {
          // CRITICAL: Reject unverified email linking
          return false;
        }

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              image: user.image,
              emailVerified: new Date(),
            }
          });
        }
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.tier = user.tier;
        token.role = user.role;
        token.image = user.image;
      }

      if (trigger === 'update' && session) {
        token.tier = session.tier;
        token.name = session.name;
        token.image = session.image;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tier = token.tier as string;
        session.user.role = token.role as string;
        session.user.image = token.image as string;
      }

      return session;
    }
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      console.log(\`User \${user.email} signed in via \${account?.provider}\`);

      if (isNewUser && account?.provider === 'google') {
        console.log(\`New user registered via Google OAuth: \${user.email}\`);
      }
    }
  },

  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 3.2 Type Definitions

**File:** `types/next-auth.d.ts`

**Template:**

```typescript
import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT, DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tier: string;
      role: string;
      image?: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    tier: string;
    role: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    tier: string;
    role: string;
  }
}
```

### 3.3 Environment Variables

**File:** `.env.example`

**Add these variables:**

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_google_client_secret

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
```

---

## 4. Code Quality Standards

### 4.1 TypeScript

- All OAuth functions MUST have explicit types
- No `any` types in OAuth code
- Use type definitions from `types/next-auth.d.ts`
- All parameters and return types specified

### 4.2 Error Handling (Decision #8)

**Strategy: Specific Errors**

```typescript
try {
  await signIn('google', { callbackUrl });
} catch (error) {
  // Map to user-friendly messages
  const message = getOAuthErrorMessage(error.type);
  setError(message);
}
```

**Error Helper:**

```typescript
// lib/auth/errors.ts
export function getOAuthErrorMessage(errorType: string): string {
  const errors: Record<string, string> = {
    OAuthSignin: 'Failed to connect to Google. Please try again.',
    OAuthCallback: 'Google authorization failed. Please try again.',
    OAuthAccountNotLinked:
      'Email already in use. Please sign in with your password first.',
    EmailCreateAccount: 'Email already registered. Please sign in instead.',
    Callback: 'Authentication error. Please try again.',
  };

  return errors[errorType] || 'An unexpected error occurred. Please try again.';
}
```

### 4.3 Security Checklist

- [ ] No `allowDangerousEmailAccountLinking: true`
- [ ] Email verification enforced (verified-only linking)
- [ ] OAuth users auto-verified (Google confirmed)
- [ ] Password nullable (no fake passwords)
- [ ] JWT sessions with secure cookies
- [ ] Separate NEXTAUTH_SECRET per environment
- [ ] Redirect URIs whitelisted in Google Console
- [ ] State parameter validated (CSRF protection)

---

## 5. Testing Requirements

### 5.1 Manual Testing Checklist

- [ ] Google OAuth signup creates FREE tier user
- [ ] Google OAuth login works for existing users
- [ ] Email/password login works (when implemented)
- [ ] Account linking follows verified-only strategy
- [ ] Profile picture imports from Google
- [ ] Session persists correctly
- [ ] Logout works for both auth methods
- [ ] Error messages display correctly

### 5.2 Edge Cases to Test

- [ ] User cancels Google consent screen
- [ ] User tries to link with unverified email (should REJECT)
- [ ] OAuth callback timeout/failure
- [ ] User has password + adds Google (hybrid)
- [ ] OAuth-only user (no password)

---

## 6. Database Migration

**Migration Command:**

```bash
npx prisma migrate dev --name initial_schema_with_oauth
```

**Expected Tables:**

- ✅ User (with password nullable, emailVerified, image, accounts relation)
- ✅ Account (OAuth provider linking)
- ❌ NO Session table (JWT sessions)
- ❌ NO VerificationToken table (not needed for JWT)

---

## 7. Common Pitfalls to Avoid

### ❌ DO NOT:

1. Use `allowDangerousEmailAccountLinking: true` (security risk)
2. Add Prisma adapter (JWT sessions don't need it)
3. Create Session model (not needed for JWT)
4. Add tier upgrade logic to authentication (separate concern)
5. Commit Google OAuth credentials to git
6. Mix authentication methods (keep OAuth and credentials separate)
7. Forget to handle OAuth-only users (password = NULL)
8. Skip email verification for OAuth users (auto-verify is correct)

### ✅ DO:

1. Follow verified-only account linking strategy
2. Use JWT sessions (faster, serverless-friendly)
3. Handle errors gracefully with specific messages
4. Test both authentication methods thoroughly
5. Document any deviations from the guide
6. Use TypeScript strictly (no any)
7. Validate environment variables
8. Follow the decision document exactly

---

## 8. Success Criteria

✅ **Implementation Complete When:**

- Google OAuth button appears on login/register
- Users can sign up with Google (creates FREE tier)
- Users can sign in with Google
- Email/password auth structure ready (CredentialsProvider configured)
- Account linking works per verified-only strategy
- Profile pictures import from Google
- Sessions work for OAuth authentication
- All tests pass
- No security vulnerabilities
- Documentation complete

---

## 9. Escalation Triggers

**Escalate to Human if:**

- Security concern discovered
- Decision conflicts with existing code
- Breaking change required
- Unclear edge case encountered
- Migration could lose user data
- Third-party API changes
- Unresolved TypeScript errors
- Database schema conflicts

---

## 10. Implementation Priority Order

### Phase 1: Database Foundation

1. Create/update Prisma schema with User and Account models
2. Ensure password is nullable (String?)
3. Add emailVerified field (DateTime?)
4. Add image field (String?)
5. Add accounts relation (Account[])
6. Run migration

### Phase 2: NextAuth Configuration

7. Create `app/api/auth/[...nextauth]/route.ts`
8. Configure GoogleProvider (no dangerous linking)
9. Configure CredentialsProvider (structure only)
10. Set session strategy to 'jwt'
11. Implement signIn callback (verified-only logic)
12. Implement jwt callback (tier/role)
13. Implement session callback (tier/role)

### Phase 3: Type Definitions

14. Create `types/next-auth.d.ts`
15. Extend Session interface
16. Extend User interface
17. Extend JWT interface

### Phase 4: Environment Setup

18. Update `.env.example` with OAuth variables
19. Document environment variable requirements

### Phase 5: UI Components (Future)

20. Login page with OAuth button (when UI is built)
21. Register page with OAuth button (when UI is built)

---

## Appendix A: Quick Reference

**Decision Document:** `docs/decisions/google-oauth-decisions.md`  
**Setup Guide:** `docs/setup/google-oauth-setup.md`  
**OpenAPI Contract:** `docs/trading_alerts_openapi.yaml` (OAuth section)

**Key Files:**

- Config: `app/api/auth/[...nextauth]/route.ts`
- Schema: `prisma/schema.prisma`
- Types: `types/next-auth.d.ts`
- Errors: `lib/auth/errors.ts`

**Environment:**

- Dev: `.env.local`
- Prod: Vercel environment variables
- Example: `.env.example`

---

**Last Updated:** 2025-11-17  
**Next Review:** After implementation complete  
**Policy Owner:** Human  
**Implementer:** Aider  
**Validator:** Automated validation tools (TypeScript, ESLint, Prettier, Policy validator)
