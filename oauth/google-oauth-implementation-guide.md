# Google OAuth Integration with NextAuth.js v5 - Comprehensive Implementation Guide

## Project Context

You are working on a **Trading Alerts SaaS** platform built with:

- **Framework:** Next.js 15 (App Router)
- **Authentication:** NextAuth.js v5 (Auth.js)
- **Database:** PostgreSQL with Prisma ORM
- **Current Auth:** Email/password (CredentialsProvider)
- **Goal:** Add Google OAuth as an **additional** login method (NOT replacing email/password)

## Critical Requirements

1. **Maintain Email/Password Login:** Google OAuth is ADDED, not replacing existing email auth
2. **Account Linking:** If a user signs up with email, then logs in with Google using the same email, link the accounts
3. **Tier Preservation:** Users' tier (FREE/PRO) must be preserved across login methods
4. **Database Schema:** Must support OAuth provider accounts
5. **OpenAPI Contract:** Must be updated to reflect new auth flows
6. **Backward Compatibility:** Existing email/password users must continue working without changes

## Tier System & Payment Providers

**IMPORTANT:** The tier system is connected to payment providers:

- **FREE Tier (Default):**
  - All new users (email/password OR Google OAuth) start as FREE
  - 5 symbols × 3 timeframes
  - 5 alerts maximum
  - No payment required

- **PRO Tier via Stripe:**
  - ONLY monthly subscription ($29/month)
  - Auto-renewal enabled
  - International credit/debit cards
  - 15 symbols × 9 timeframes
  - 20 alerts maximum

- **PRO Tier via dLocal:**
  - **Option 1:** 3-day subscription ($1.99)
  - **Option 2:** Monthly subscription ($29)
  - Manual renewal (NO auto-renewal)
  - Local payment methods (UPI, Paytm, JazzCash, etc.)
  - 15 symbols × 9 timeframes
  - 20 alerts maximum

**Key Point:** When implementing Google OAuth, ALL new users must start as FREE tier. The payment provider (Stripe vs dLocal) only matters when they upgrade to PRO.

---

## How Tier Upgrades Work (Post-Authentication)

**Authentication and payment are SEPARATE processes:**

1. **User Authentication (Google OAuth or Email/Password):**
   - Creates user account
   - Sets tier = FREE (default)
   - Handles login/logout
   - Manages session

2. **Tier Upgrade (Separate from Auth):**
   - User visits `/checkout` or `/pricing`
   - Selects payment provider (Stripe or dLocal)
   - Completes payment
   - Webhook updates `User.tier` to "PRO"
   - Subscription record created with `paymentProvider` field

**Example Flow:**

```
User signs up with Google OAuth
  ↓
User.tier = "FREE" (automatic)
  ↓
User explores app with FREE limitations
  ↓
User clicks "Upgrade to PRO"
  ↓
User selects payment provider:
  - Stripe → Monthly only ($29)
  - dLocal → 3-day ($1.99) OR Monthly ($29)
  ↓
Payment completed via webhook
  ↓
User.tier = "PRO" (updated)
  ↓
User gains access to PRO features
```

**Important:** OAuth implementation does NOT handle tier upgrades. That's handled by existing payment webhooks (Stripe/dLocal) in Part 12 (E-commerce) and Part 18 (dLocal Integration).

---

## PART 1: Database Schema Updates

### File: `prisma/schema.prisma`

**Action:** Add OAuth support models to existing schema

**Add these models AFTER the existing `User` model:**

```prisma
// OAuth Account model (for Google, GitHub, etc.)
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // "oauth", "email", etc.
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

// Session model (for database sessions - optional, we use JWT)
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

// Email verification tokens
model VerificationToken {
  identifier String   // Email address
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**Update the existing `User` model to add relations:**

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  password            String?   // Make NULLABLE for OAuth-only users
  name                String?
  image               String?   // NEW - Profile picture from Google
  tier                String    @default("FREE")
  role                String    @default("USER")
  isActive            Boolean   @default(true)
  emailVerified       DateTime? // NextAuth.js uses this
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
  accounts            Account[]     // NEW - OAuth accounts
  sessions            Session[]     // NEW - Sessions
}
```

**Run migration after updating schema:**

```bash
npx prisma migrate dev --name add_oauth_support
npx prisma generate
```

---

## PART 2: NextAuth Configuration Updates

### File: `app/api/auth/[...nextauth]/route.ts`

**Action:** Replace existing configuration with Google OAuth + Email support

```typescript
import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true, // Auto-link if email matches
    }),

    // Email/Password Provider (existing)
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
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
      },
    }),
  ],

  session: {
    strategy: 'jwt', // Use JWT for sessions
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // For Google OAuth
      if (account?.provider === 'google') {
        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        // If user exists but signed up with email/password, link accounts
        if (existingUser && !existingUser.emailVerified) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              emailVerified: new Date(),
              image: user.image, // Update with Google profile picture
            },
          });
        }

        // If NEW user via Google OAuth, ensure FREE tier
        if (!existingUser) {
          // Prisma adapter will create user, but we want to ensure tier is FREE
          // This is handled by the User model default: tier @default("FREE")
          console.log(
            `New Google OAuth user created: ${user.email} with FREE tier`
          );
        }

        // If existing PRO user signs in with Google, preserve their tier
        if (existingUser && existingUser.tier === 'PRO') {
          console.log(`Existing PRO user signed in via Google: ${user.email}`);
        }
      }

      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.tier = user.tier;
        token.role = user.role;
        token.image = user.image;
      }

      // Update token on session update
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
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      // Log sign-in events
      console.log(`User ${user.email} signed in via ${account?.provider}`);

      // Track new OAuth users
      if (isNewUser && account?.provider === 'google') {
        console.log(`New user registered via Google OAuth: ${user.email}`);
      }
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

---

## PART 3: Environment Variables

### File: `.env.local` (update) and `.env.example` (update)

**Add these variables:**

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# NextAuth Configuration (existing, ensure these exist)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
```

### File: `.env.example`

```bash
# Google OAuth (Get from Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=
```

---

## PART 4: Type Definitions

### File: `types/next-auth.d.ts` (create if doesn't exist)

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

---

## PART 5: Login Page UI Updates

### File: `app/(auth)/login/page.tsx`

**Action:** Add Google sign-in button

```tsx
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Email/Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Login
  const handleGoogleLogin = async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      await signIn('google', {
        callbackUrl,
      });
    } catch (err) {
      setError('Failed to sign in with Google');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your Trading Alerts account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isLoading}
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in with Google...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in with Email'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            Don't have an account?{' '}
            <a href="/register" className="text-primary hover:underline">
              Sign up
            </a>
          </div>
          <div className="text-sm text-muted-foreground text-center">
            <a href="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
```

---

## PART 6: Register Page UI Updates

### File: `app/(auth)/register/page.tsx`

**Action:** Add Google sign-up button (similar pattern to login)

```tsx
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Email Registration
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      // Auto sign-in after registration
      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError('Registration successful but sign-in failed');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth Registration
  const handleGoogleRegister = async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      await signIn('google', {
        callbackUrl: '/dashboard',
      });
    } catch (err) {
      setError('Failed to sign up with Google');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create an Account</CardTitle>
          <CardDescription>
            Start your free trial of Trading Alerts
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Google Sign Up Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleRegister}
            disabled={isGoogleLoading || isLoading}
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing up with Google...
              </>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or sign up with email
              </span>
            </div>
          </div>

          {/* Email Registration Form */}
          <form onSubmit={handleEmailRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                required
                disabled={isLoading || isGoogleLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <a href="/login" className="text-primary hover:underline">
              Sign in
            </a>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            By signing up, you agree to our{' '}
            <a href="/terms" className="text-primary hover:underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
```

---

## PART 7: OpenAPI Contract Updates

### File: `docs/trading_alerts_openapi.yaml`

**Action:** Add OAuth endpoints and update authentication schema

**Add this section to the `paths` object:**

```yaml
# OAuth Authentication Endpoints
/api/auth/callback/google:
  get:
    summary: Google OAuth Callback
    description: Handles the OAuth callback from Google after user authorization
    tags:
      - Authentication
    parameters:
      - name: code
        in: query
        required: true
        schema:
          type: string
        description: Authorization code from Google
      - name: state
        in: query
        required: false
        schema:
          type: string
        description: State parameter for CSRF protection
    responses:
      '302':
        description: Redirects to dashboard or error page
      '401':
        description: Authentication failed
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: 'OAuth authentication failed'

/api/auth/providers:
  get:
    summary: Get Available Authentication Providers
    description: Returns list of configured OAuth providers
    tags:
      - Authentication
    responses:
      '200':
        description: List of authentication providers
        content:
          application/json:
            schema:
              type: object
              properties:
                providers:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: string
                        example: 'google'
                      name:
                        type: string
                        example: 'Google'
                      type:
                        type: string
                        example: 'oauth'
```

**Update the existing `/api/auth/register` endpoint:**

```yaml
/api/auth/register:
  post:
    summary: Register New User (Email/Password)
    description: Creates a new user account with email and password
    tags:
      - Authentication
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - email
              - password
              - name
            properties:
              email:
                type: string
                format: email
                example: 'user@example.com'
              password:
                type: string
                minLength: 8
                example: 'SecurePass123!'
              name:
                type: string
                example: 'John Doe'
    responses:
      '201':
        description: User created successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                success:
                  type: boolean
                  example: true
                user:
                  type: object
                  properties:
                    id:
                      type: string
                    email:
                      type: string
                    name:
                      type: string
                    tier:
                      type: string
                      example: 'FREE'
      '400':
        description: Invalid input or email already exists
        content:
          application/json:
            schema:
              type: object
              properties:
                error:
                  type: string
                  example: 'Email already in use'
```

**Update authentication schema in `components.securitySchemes`:**

```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT token from NextAuth.js session.

        **Obtaining a token:**

        1. **Email/Password Login:**
           - POST /api/auth/callback/credentials
           - Body: { email, password }
           - Returns session cookie

        2. **Google OAuth Login:**
           - GET /api/auth/signin/google
           - Redirects to Google authorization
           - Returns to /api/auth/callback/google
           - Sets session cookie

        **Using the token:**
        - Session cookie is automatically included in requests
        - For API calls: Use getServerSession() server-side
        - For client components: Use useSession() hook

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: cuid
        email:
          type: string
          format: email
        name:
          type: string
          nullable: true
        image:
          type: string
          nullable: true
          description: Profile picture URL (from OAuth or uploaded)
        tier:
          type: string
          enum: [FREE, PRO]
        role:
          type: string
          enum: [USER, ADMIN]
        emailVerified:
          type: string
          format: date-time
          nullable: true
        createdAt:
          type: string
          format: date-time
        accounts:
          type: array
          items:
            $ref: '#/components/schemas/Account'
          description: OAuth provider accounts linked to this user

    Account:
      type: object
      properties:
        id:
          type: string
        provider:
          type: string
          enum: [google, credentials]
          description: OAuth provider name
        providerAccountId:
          type: string
          description: User ID from the OAuth provider
        type:
          type: string
          example: 'oauth'
      description: OAuth account linked to a user
```

---

## PART 8: Package Dependencies

### File: `package.json`

**Action:** Ensure these dependencies are present

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "next-auth": "^4.24.5",
    "@auth/prisma-adapter": "^1.0.12",
    "@prisma/client": "^5.7.0",
    "bcryptjs": "^2.4.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.10.5",
    "@types/react": "^18.2.45",
    "prisma": "^5.7.0",
    "typescript": "^5.3.3"
  }
}
```

**If missing, install:**

```bash
pnpm add next-auth@^4.24.5 @auth/prisma-adapter@^1.0.12
```

---

## PART 9: Documentation Updates

### File: `ARCHITECTURE.md`

**Action:** Update Section 6 (Authentication Flow) with OAuth information

**Replace Section 6.1 with:**

```markdown
### 6.1 User Registration

**Option A: Email/Password Registration**
```

1. User fills registration form (/register)
   ↓
2. POST /api/auth/register
   ↓
3. Validate input (email, password, name)
   ↓
4. Hash password with bcrypt
   ↓
5. Create user in database (default tier: FREE, role: USER)
   ↓
6. Send verification email (Resend) [OPTIONAL]
   ↓
7. Auto-login with credentials
   ↓
8. Redirect to /dashboard

```

**Option B: Google OAuth Registration**

```

1. User clicks "Sign up with Google" (/register)
   ↓
2. Redirect to Google OAuth consent screen
   ↓
3. User authorizes application
   ↓
4. Google redirects to /api/auth/callback/google
   ↓
5. NextAuth.js creates user automatically:
   - email: from Google profile
   - name: from Google profile
   - image: from Google profile picture
   - emailVerified: set to current timestamp
   - password: NULL (OAuth-only user)
   - tier: FREE (default) ← IMPORTANT
   - role: USER (default)
     ↓
6. Create Account record linking user to Google
   ↓
7. Create JWT session
   ↓
8. Redirect to /dashboard (FREE tier)

```

**Note:** User starts as FREE regardless of authentication method. Tier upgrades happen separately via payment flow.

### 6.2 User Login

**Option A: Email/Password Login**

```

1. User submits login form (/login)
   ↓
2. NextAuth.js CredentialsProvider validates
   ↓
3. Check email + password against database
   ↓
4. If valid: Create JWT session
   ↓
5. Store session in secure cookie
   ↓
6. Redirect to /dashboard

```

**Option B: Google OAuth Login**

```

1. User clicks "Sign in with Google" (/login)
   ↓
2. Redirect to Google OAuth consent screen
   ↓
3. User authorizes (or auto-approved if previously authorized)
   ↓
4. Google redirects to /api/auth/callback/google
   ↓
5. NextAuth.js finds existing user by email
   ↓
6. If user exists with email/password:
   - Link Google account (allowDangerousEmailAccountLinking: true)
   - Update emailVerified timestamp
   - Update profile image
     ↓
7. Create JWT session
   ↓
8. Redirect to /dashboard

```

### 6.3 Account Linking

When a user who registered with email/password later signs in with Google (same email), NextAuth.js automatically:

1. Links the Google Account to the existing User
2. Sets `emailVerified` (confirms email ownership via OAuth)
3. Updates profile picture from Google
4. Preserves existing tier, subscription, alerts, etc.

This allows users to sign in with either method after linking.
```

### 6.4 Tier Upgrade Flow (Post-Authentication)

**Important:** Tier upgrades are INDEPENDENT of authentication method.

```
User authenticated (Email/Password OR Google OAuth)
   ↓
User.tier = "FREE" (current)
   ↓
User visits /pricing or clicks "Upgrade to PRO"
   ↓
Checkout page detects user's country (IP geolocation)
   ↓
Display available payment providers:
   - International users: Stripe only
   - Emerging markets (IN, NG, PK, etc.): Stripe OR dLocal
   ↓
User selects payment provider:
   ┌─────────────────────┬─────────────────────┐
   │   STRIPE OPTION     │   DLOCAL OPTION     │
   ├─────────────────────┼─────────────────────┤
   │ Monthly: $29/month  │ 3-Day: $1.99        │
   │ Auto-renewal: YES   │ Monthly: $29/month  │
   │ Free trial: 7 days  │ Auto-renewal: NO    │
   └─────────────────────┴─────────────────────┘
   ↓
User completes payment
   ↓
Webhook fires (Stripe or dLocal)
   ↓
Actions:
   - Update User.tier = "PRO"
   - Create Subscription record
   - Set paymentProvider (STRIPE or DLOCAL)
   - Set planType (MONTHLY or THREE_DAY)
   - Set expiresAt date
   - Send confirmation email
   ↓
User session updated (tier: "PRO")
   ↓
User gains PRO access:
   - 15 symbols (was 5)
   - 9 timeframes (was 3)
   - 20 alerts (was 5)
```

**Key Points:**

- Authentication method (OAuth vs Email) does NOT affect tier
- Payment provider (Stripe vs dLocal) determines subscription options
- Stripe: Monthly only, auto-renewal
- dLocal: 3-day OR monthly, manual renewal
- All new users start FREE, upgrade independently

### File: `docs/v5-structure-division.md`

**Action:** Update Part 5 (Authentication System) file count and description

**Update Part 5 section:**

```markdown
## PART 5: Authentication System

**Scope:** Complete auth system with Email/Password + Google OAuth

**Folders & Files:**
```

app/(auth)/
├── layout.tsx
├── login/page.tsx # UPDATED: Add Google OAuth button
├── register/page.tsx # UPDATED: Add Google OAuth button
├── verify-email/page.tsx
├── forgot-password/page.tsx
└── reset-password/page.tsx

app/api/auth/
├── [...nextauth]/route.ts # UPDATED: Add GoogleProvider
├── register/route.ts
├── verify-email/route.ts
├── forgot-password/route.ts
└── reset-password/route.ts

components/auth/
├── register-form.tsx # UPDATED: OAuth integration
├── login-form.tsx # UPDATED: OAuth integration
├── forgot-password-form.tsx
└── social-auth-buttons.tsx # NEW: Reusable OAuth buttons

lib/auth/
├── auth-options.ts # UPDATED: Google OAuth config
├── session.ts # UPDATED: Handle OAuth sessions
└── permissions.ts

types/
└── next-auth.d.ts # NEW: NextAuth type extensions

middleware.ts # NextAuth + tier checks

```

**Key Changes from V4:**
- ✅ Added Google OAuth via NextAuth.js v5
- ✅ Account linking (email users can link Google)
- ✅ Profile picture from Google
- ✅ Auto email verification via OAuth
- ✅ Separate authentication paths (credentials vs oauth)
- ✅ Updated Prisma schema (Account, Session models)

**File Count:** ~20 files (was ~17)
```

---

## PART 10: Google Cloud Console Setup Guide

### File: `docs/setup/google-oauth-setup.md` (create new)

````markdown
# Google OAuth Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Name: "Trading Alerts SaaS" (or your project name)

## Step 2: Enable Google+ API

1. Navigate to **APIs & Services** > **Library**
2. Search for "Google+ API"
3. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** (for public app) or **Internal** (for workspace)
3. Fill in application information:
   - **App name:** Trading Alerts
   - **User support email:** your-email@example.com
   - **Developer contact:** your-email@example.com
4. Add scopes:
   - `userinfo.email`
   - `userinfo.profile`
5. Add test users (for development)
6. Save and continue

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: "Trading Alerts Web Client"
5. Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `https://yourdomain.com` (production)
6. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
7. Click **Create**
8. Copy **Client ID** and **Client Secret**

## Step 5: Add Credentials to Environment

Add to `.env.local`:

```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```
````

## Step 6: Test OAuth Flow

1. Start development server: `pnpm dev`
2. Go to `http://localhost:3000/login`
3. Click "Continue with Google"
4. Authorize the application
5. Verify redirect to dashboard
6. Check database for new Account record

## Step 7: Production Deployment

1. Update Google OAuth redirect URI with production domain
2. Add production credentials to Vercel environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_URL` (production domain)
   - `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
3. Deploy and test OAuth flow

## Troubleshooting

**Error: "redirect_uri_mismatch"**

- Verify redirect URI in Google Console exactly matches `/api/auth/callback/google`
- Check for trailing slashes
- Ensure protocol (http/https) matches

**Error: "invalid_client"**

- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check for extra spaces or line breaks in `.env.local`

**User not created in database**

- Check Prisma schema has Account, Session, VerificationToken models
- Run `npx prisma generate` and `npx prisma db push`
- Check database connection string

**Session not persisting**

- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your domain
- Clear browser cookies and try again

````

---

## PART 11: Testing Checklist

### File: `docs/testing/oauth-testing-checklist.md` (create new)

```markdown
# OAuth Testing Checklist

## ✅ Email/Password Authentication (Existing)

- [ ] User can register with email/password
- [ ] User can login with email/password
- [ ] Password validation works (min 8 chars)
- [ ] Error messages display correctly
- [ ] Session persists after login
- [ ] Logout works correctly

## ✅ Google OAuth Authentication (New)

### Registration Flow
- [ ] "Sign up with Google" button appears on /register
- [ ] Clicking button redirects to Google consent screen
- [ ] After authorization, user is created in database
- [ ] User.emailVerified is set automatically
- [ ] User.image is populated from Google profile picture
- [ ] User.password is NULL (OAuth-only user)
- [ ] **User.tier is set to "FREE" by default** ← CRITICAL
- [ ] **User does NOT get PRO access without payment** ← CRITICAL
- [ ] Account record is created linking user to Google
- [ ] Session is created and user is logged in
- [ ] User is redirected to /dashboard
- [ ] Dashboard shows FREE tier limitations (5 symbols, 3 timeframes, 5 alerts)

### Login Flow
- [ ] "Sign in with Google" button appears on /login
- [ ] Existing OAuth users can sign in successfully
- [ ] Session is created correctly
- [ ] User is redirected to /dashboard
- [ ] User tier is preserved in session

### Account Linking
- [ ] User with email/password can sign in with Google (same email)
- [ ] Google Account is linked to existing User
- [ ] User.emailVerified is updated
- [ ] User.image is updated from Google
- [ ] Existing tier, subscription, alerts are preserved
- [ ] **PRO users remain PRO after linking Google** ← CRITICAL
- [ ] **FREE users remain FREE after linking Google** ← CRITICAL
- [ ] User can subsequently sign in with either method

### Tier Upgrade Flow (Independent of Auth Method)
- [ ] **Google OAuth users start as FREE tier**
- [ ] **Google OAuth users can upgrade to PRO via Stripe payment**
- [ ] **Google OAuth users can upgrade to PRO via dLocal payment**
- [ ] **Email/password users can upgrade to PRO via Stripe payment**
- [ ] **Email/password users can upgrade to PRO via dLocal payment**
- [ ] Tier upgrade does NOT depend on authentication method
- [ ] Stripe PRO users have monthly subscription only
- [ ] dLocal PRO users can choose 3-day OR monthly subscription
- [ ] After Stripe payment, User.tier updates to "PRO"
- [ ] After dLocal payment, User.tier updates to "PRO"
- [ ] Session updates immediately after tier upgrade
- [ ] PRO features unlock after tier upgrade (15 symbols, 9 timeframes, 20 alerts)

### Error Handling
- [ ] Error displays if Google authorization is cancelled
- [ ] Error displays if OAuth callback fails
- [ ] Error displays if email already exists (non-OAuth user)
- [ ] Network errors are handled gracefully

## ✅ Database Integrity

- [ ] Account table has correct provider ("google")
- [ ] Account.providerAccountId is Google user ID
- [ ] User.emailVerified is set for OAuth users
- [ ] Session records are created correctly
- [ ] No duplicate users created with same email

## ✅ Security

- [ ] OAuth state parameter prevents CSRF
- [ ] Session tokens are httpOnly cookies
- [ ] JWT secrets are not exposed
- [ ] Redirect URIs are whitelisted in Google Console
- [ ] NEXTAUTH_URL is set correctly

## ✅ User Experience

- [ ] OAuth buttons have loading states
- [ ] Error messages are user-friendly
- [ ] Profile pictures display correctly
- [ ] Name is populated from Google profile
- [ ] Logout works for both auth methods

## ✅ Production Readiness

- [ ] Environment variables set in Vercel
- [ ] Production redirect URI added to Google Console
- [ ] NEXTAUTH_SECRET generated and set
- [ ] HTTPS enforced on production domain
- [ ] OAuth consent screen published
````

---

## PART 12: Migration Script (Optional)

### File: `scripts/migrate-existing-users.ts` (optional)

If you have existing users and want to allow them to link Google accounts later, this script ensures the schema is compatible:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking user schema compatibility...');

  // Count users without emailVerified
  const unverifiedUsers = await prisma.user.count({
    where: {
      emailVerified: null,
      password: { not: null }, // Email/password users
    },
  });

  console.log(
    `Found ${unverifiedUsers} email/password users without verified emails`
  );

  // Optional: Mark all existing email users as verified
  // Uncomment if you want to trust existing users
  /*
  const result = await prisma.user.updateMany({
    where: {
      emailVerified: null,
      password: { not: null },
    },
    data: {
      emailVerified: new Date(),
    },
  });

  console.log(`✅ Updated ${result.count} users`);
  */

  console.log('✅ Migration check complete');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Implementation Priority Order

1. **Database Schema** (Part 1) - Foundation for OAuth
2. **Environment Variables** (Part 3) - Required configuration
3. **NextAuth Configuration** (Part 2) - Core OAuth logic
4. **Type Definitions** (Part 4) - TypeScript support
5. **Google Cloud Setup** (Part 10) - Obtain credentials
6. **Login Page UI** (Part 5) - User-facing changes
7. **Register Page UI** (Part 6) - User-facing changes
8. **Documentation** (Parts 9, 10, 11) - Reference materials
9. **OpenAPI Contract** (Part 7) - API documentation
10. **Testing** (Part 11) - Validation

---

## Success Criteria

✅ Google OAuth button appears on login and register pages  
✅ Users can sign up with Google  
✅ Users can sign in with Google  
✅ **All new Google OAuth users start as FREE tier**  
✅ **Google OAuth users can upgrade to PRO independently**  
✅ Existing email users can link Google accounts  
✅ Profile pictures from Google display correctly  
✅ Session management works for both auth methods  
✅ Database schema supports OAuth accounts  
✅ OpenAPI contract reflects new endpoints  
✅ Documentation is updated  
✅ All tests pass  
✅ **Tier upgrades work identically for both auth methods**  
✅ **Payment provider selection (Stripe/dLocal) is independent of auth method**

---

## Common Issues and Solutions

### Issue 1: "redirect_uri_mismatch"

**Cause:** Redirect URI in Google Console doesn't match NextAuth callback URL

**Solution:**

- Verify Google Console redirect URI: `http://localhost:3000/api/auth/callback/google`
- Ensure no trailing slash
- Protocol must match (http for local, https for production)

### Issue 2: User.password is not nullable

**Cause:** Prisma schema doesn't allow NULL passwords for OAuth users

**Solution:**

- Update `password String` to `password String?` in schema.prisma
- Run migration: `npx prisma migrate dev --name allow_null_passwords`

### Issue 3: Session not persisting

**Cause:** NEXTAUTH_SECRET not set or incorrect

**Solution:**

- Generate secret: `openssl rand -base64 32`
- Add to `.env.local`: `NEXTAUTH_SECRET=<generated_secret>`
- Restart dev server

### Issue 4: Account not linking

**Cause:** Email case mismatch

**Solution:**

- Ensure email comparison is case-insensitive
- Add in NextAuth signIn callback:
  ```typescript
  const existingUser = await prisma.user.findUnique({
    where: { email: user.email?.toLowerCase() },
  });
  ```

---

## Verification Steps After Implementation

1. **Test New User Registration:**

   ```bash
   # Visit http://localhost:3000/register
   # Click "Continue with Google"
   # Verify user created in database
   # Check Account record exists
   # Verify emailVerified is set
   ```

2. **Test Existing User Login:**

   ```bash
   # Create user with email/password
   # Logout
   # Visit http://localhost:3000/login
   # Click "Sign in with Google" (same email)
   # Verify Account is linked
   # Verify can sign in with both methods
   ```

3. **Test Database Schema:**

   ```bash
   npx prisma studio
   # Check Account table exists
   # Check User.password is nullable
   # Check User.emailVerified is populated for OAuth users
   ```

4. **Test API Contract:**
   ```bash
   # Verify OpenAPI spec at /api/docs
   # Check new OAuth endpoints are documented
   # Verify authentication schema updated
   ```

---

## Additional Resources

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [Prisma Adapter Documentation](https://authjs.dev/reference/adapter/prisma)
- [Next.js 15 App Router](https://nextjs.org/docs/app)

---

## Notes for Autonomous Building (Aider)

**Policy Reminders:**

1. **Preserve Existing Auth:** Do NOT remove email/password authentication. Google OAuth is ADDITIVE.

2. **Database Migrations:** After updating schema, always run:

   ```bash
   npx prisma migrate dev --name <migration_name>
   npx prisma generate
   ```

3. **Environment Variables:** Never commit `.env.local`. Always update `.env.example` with placeholder values.

4. **Type Safety:** Update `types/next-auth.d.ts` to ensure TypeScript knows about custom session properties.

5. **Error Handling:** All OAuth flows must include try-catch blocks and user-friendly error messages.

6. **Testing:** Test BOTH authentication methods (email/password AND Google OAuth) after implementation.

7. **Documentation:** Update all architecture docs, OpenAPI contracts, and setup guides.

---

## End of Implementation Guide

This comprehensive guide covers all aspects of adding Google OAuth to your Trading Alerts SaaS platform while maintaining existing email/password authentication. Follow the parts in order, test thoroughly, and update all documentation.

---

## CRITICAL REMINDER: Authentication vs Payment Provider

**Authentication (This Guide):**

- Handles user login/registration
- Google OAuth OR Email/Password
- ALL new users → FREE tier (default)
- NO tier upgrades during authentication

**Payment & Tier Upgrades (Separate System):**

- Handled by Part 12 (E-commerce) and Part 18 (dLocal)
- User visits `/checkout` or `/pricing` AFTER authentication
- Selects payment provider:
  - **Stripe:** Monthly $29 only, auto-renewal
  - **dLocal:** 3-day $1.99 OR Monthly $29, manual renewal
- Webhook updates `User.tier` to "PRO"
- Works identically for BOTH Google OAuth and Email/Password users

**Key Principle:**

```
Authentication Method ≠ Payment Provider
Google OAuth user → Can use Stripe OR dLocal for PRO upgrade
Email/Password user → Can use Stripe OR dLocal for PRO upgrade
```

Do NOT mix authentication logic with payment/tier upgrade logic. They are completely separate concerns.
