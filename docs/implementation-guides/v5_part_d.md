# V5_Part D: Authentication System

## Phase 2: Authentication System (Week 1-2)

### 7.5 Setup NextAuth.js

Create `lib/auth/auth-options.ts`:

```typescript
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db/prisma';
import { compare } from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials');
        }

        const isValid = await compare(credentials.password, user.passwordHash);

        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier, // V5: Tier included for access control
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tier = user.tier; // V5: Add tier to JWT
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tier = token.tier as 'FREE' | 'PRO'; // V5: Type-safe tier
      }
      return session;
    },
  },
};
```

Create API route `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

### 7.6 User Registration with Default Tier

Create `app/api/auth/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user with FREE tier as default (V5: Commercial SaaS model)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        tier: 'FREE', // V5: All new users start with FREE tier
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 7.7 Protected Route Middleware

Create `middleware.ts`:

```typescript
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // V5: ENTERPRISE tier removed, simplified admin check
    // Admin routes can be protected separately if needed
    if (path.startsWith('/admin') && token?.email !== process.env.ADMIN_EMAIL) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/charts/:path*',
    '/alerts/:path*',
    '/settings/:path*',
    '/admin/:path*',
  ],
};
```

### 7.8 Type Definitions for Next.js 15

Create `types/next-auth.d.ts`:

```typescript
import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    tier: 'FREE' | 'PRO'; // V5: 2-tier system
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      tier: 'FREE' | 'PRO'; // V5: 2-tier system
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    tier: 'FREE' | 'PRO'; // V5: 2-tier system
  }
}
```

### 7.9 Tier-Based Access Helpers

Create `lib/tier-access.ts`:

```typescript
// V5: Tier-based symbol access control

export const TIER_SYMBOLS = {
  FREE: ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'], // 5 symbols
  PRO: [
    'AUDJPY', // V7: Added
    'AUDUSD',
    'BTCUSD',
    'ETHUSD',
    'EURUSD',
    'GBPJPY', // V7: Added
    'GBPUSD',
    'NDX100',
    'NZDUSD', // V7: Added
    'US30',
    'USDCAD', // V7: Added
    'USDCHF', // V7: Added
    'USDJPY',
    'XAGUSD',
    'XAUUSD',
  ], // 15 symbols
} as const;

export const TIER_TIMEFRAMES = {
  FREE: ['H1', 'H4', 'D1'], // 3 timeframes
  PRO: ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'], // 9 timeframes
} as const;

export const TIMEFRAMES = {
  M5: 'M5', // V7: Re-added (PRO only - scalping)
  M15: 'M15',
  M30: 'M30',
  H1: 'H1',
  H2: 'H2',
  H4: 'H4',
  H8: 'H8',
  H12: 'H12', // V7: Added (PRO only - swing trading)
  D1: 'D1',
} as const;

export type UserTier = 'FREE' | 'PRO';
export type Symbol = string;
export type Timeframe = keyof typeof TIMEFRAMES;

/**
 * Check if a tier can access a specific symbol
 */
export function canAccessSymbol(tier: UserTier, symbol: Symbol): boolean {
  return TIER_SYMBOLS[tier].includes(symbol);
}

/**
 * Check if a tier can access a symbol-timeframe combination
 */
export function canAccessCombination(
  tier: UserTier,
  symbol: Symbol,
  timeframe: string
): boolean {
  return (
    TIER_SYMBOLS[tier].includes(symbol) &&
    Object.keys(TIMEFRAMES).includes(timeframe)
  );
}

/**
 * Get all symbols accessible by a tier
 */
export function getAccessibleSymbols(tier: UserTier): readonly string[] {
  return TIER_SYMBOLS[tier];
}

/**
 * Get upgrade message for FREE users
 */
export function getUpgradeMessage(symbol: Symbol): string {
  return `Upgrade to PRO to access ${symbol}`;
}
```

### 7.10 Session Hook for Client Components

Create `lib/hooks/use-session.ts`:

```typescript
'use client';

import { useSession as useNextAuthSession } from 'next-auth/react';

export function useSession() {
  const { data: session, status } = useNextAuthSession();

  return {
    session,
    status,
    user: session?.user,
    tier: session?.user?.tier ?? 'FREE',
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  };
}
```

### 7.11 Server-Side Session Helper

Create `lib/auth/get-session.ts`:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

export async function getTier() {
  const session = await getSession();
  return session?.user?.tier ?? 'FREE';
}
```

---

## Authentication Testing Checklist

### User Registration

- [ ] New users created with tier='FREE'
- [ ] Email validation works
- [ ] Password hashing works
- [ ] Duplicate email rejected

### User Login

- [ ] Credentials validated correctly
- [ ] JWT includes tier field
- [ ] Session includes tier field
- [ ] Last login timestamp updated

### Access Control

- [ ] Middleware protects routes
- [ ] Tier helpers validate symbol access correctly
- [ ] Tier helpers validate timeframe access correctly
- [ ] FREE tier can access 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- [ ] FREE tier can access 3 timeframes (H1, H4, D1)
- [ ] PRO tier can access all 15 symbols
- [ ] PRO tier can access all 9 timeframes
- [ ] M5 and H12 timeframes blocked for FREE tier

### Next.js 15 Compatibility

- [ ] Auth routes work in Next.js 15
- [ ] Session management works
- [ ] Middleware functions correctly
- [ ] Type definitions correct

---
