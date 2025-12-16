# Architecture Rules for Aider with MiniMax M2

## Purpose

This document defines the system design constraints for the Trading Alerts SaaS - how pieces fit together, what goes where, and how data flows. These rules ensure consistent architecture across all 170+ files while being beginner-friendly with clear explanations of WHY each architectural decision matters.

---

## 1. DIRECTORY STRUCTURE

### 1.1 Must Follow v5-structure-division.md Exactly

**Rule:** All files must be placed in locations specified by `docs/v5-structure-division.md`.

**Why this matters:** Consistent structure makes the codebase navigable. Next.js 15 App Router has specific conventions (app/api/, app/dashboard/, etc.) that must be followed for routing to work.

**Structure Overview:**

```
trading-alerts-saas/
├── app/                      # Next.js 15 App Router
│   ├── api/                 # API routes (Next.js serverless functions)
│   │   ├── alerts/
│   │   │   ├── route.ts                    # GET /api/alerts, POST /api/alerts
│   │   │   └── [id]/route.ts               # GET/PATCH/DELETE /api/alerts/:id
│   │   ├── indicators/
│   │   │   └── [symbol]/[timeframe]/route.ts  # GET /api/indicators/:symbol/:timeframe
│   │   └── auth/
│   │       └── [...nextauth]/route.ts      # NextAuth.js endpoints
│   ├── dashboard/           # Dashboard pages (Server Components by default)
│   │   ├── page.tsx         # /dashboard
│   │   ├── layout.tsx       # Dashboard layout wrapper
│   │   ├── alerts/
│   │   └── charts/
│   ├── (marketing)/         # Marketing pages (route group)
│   │   ├── page.tsx         # Homepage
│   │   └── pricing/
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── ui/                 # shadcn/ui components (button, select, etc.)
│   ├── alerts/
│   │   ├── alert-form.tsx
│   │   └── alert-card.tsx
│   ├── charts/
│   └── dashboard/
├── lib/                     # Business logic & utilities
│   ├── api-client/         # Auto-generated from OpenAPI (Next.js API types)
│   ├── mt5-client/         # Auto-generated from OpenAPI (Flask MT5 types)
│   ├── db/
│   │   ├── prisma.ts       # Prisma client instance
│   │   └── alerts.ts       # Alert database operations
│   ├── tier/
│   │   ├── validation.ts   # Tier access validation
│   │   └── constants.ts    # Tier limits and rules
│   ├── utils/
│   └── hooks/              # Custom React hooks
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
├── mt5-service/            # Flask MT5 microservice (separate from Next.js)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   └── indicators.py
│   │   └── services/
│   │       └── mt5_connector.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── run.py
├── docs/                   # Documentation
├── public/                 # Static assets
└── tests/                  # Tests

```

**Key Points:**

- **app/api/** = Server-side API routes (Next.js serverless functions)
- **app/dashboard/** = Dashboard pages (Server Components)
- **components/** = Reusable React components (mix of Server & Client)
- **lib/** = Business logic, utilities, database operations (no UI)
- **mt5-service/** = Separate Flask microservice for MT5 integration

---

### 1.2 Separation of Concerns

**Principle:** Each folder has a single responsibility.

| Folder             | Responsibility                    | Can Import From      | Cannot Import From           |
| ------------------ | --------------------------------- | -------------------- | ---------------------------- |
| **app/api/**       | HTTP endpoints, request/response  | lib/, prisma         | components/                  |
| **app/dashboard/** | Pages, layouts, Server Components | components/, lib/    | app/api/ (use fetch instead) |
| **components/**    | UI components, presentation logic | lib/utils, lib/hooks | lib/db, app/api              |
| **lib/db/**        | Database operations (Prisma)      | prisma               | components/, app/            |
| **lib/tier/**      | Tier validation logic             | -                    | components/, app/            |
| **lib/utils/**     | Pure utility functions            | -                    | Any domain-specific code     |

**Why this matters:** Separation prevents circular dependencies and makes testing easier. Components shouldn't know about database schema. API routes shouldn't import React components.

---

### 1.3 Visual Structure Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS 15 APP (Vercel)                       │
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │  app/dashboard/*     │     │     app/api/*                │  │
│  │  (Server Components) │────▶│  (API Routes/Serverless)     │  │
│  │                      │     │                              │  │
│  │  components/*        │     │  Uses: lib/db/*, lib/tier/*  │  │
│  │  (Client Components) │     └──────────┬───────────────────┘  │
│  └──────────────────────┘                │                      │
└─────────────────────────────────────────┼──────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
         ┌──────────────────┐   ┌─────────────────┐   ┌────────────────┐
         │  PostgreSQL DB   │   │ Flask MT5 API   │   │  Stripe API    │
         │   (Railway)      │   │  (Railway)      │   │   (External)   │
         └──────────────────┘   └─────────────────┘   └────────────────┘
                                         │
                                         ▼
                                ┌─────────────────┐
                                │  MT5 Terminal   │
                                │  (Local/VPS)    │
                                └─────────────────┘
```

---

## 2. LAYER ARCHITECTURE

### 2.1 Five Layers

The application is divided into 5 layers, each with specific responsibilities:

```
┌─────────────────────────────────────────┐
│  1. FRONTEND LAYER (app/dashboard)      │  ← Server & Client Components
│     - Pages (page.tsx)                  │  ← User-facing UI
│     - Layouts (layout.tsx)              │
│     - Components (components/*)         │
└─────────────────┬───────────────────────┘
                  │ fetch()
                  ▼
┌─────────────────────────────────────────┐
│  2. API LAYER (app/api)                 │  ← HTTP endpoints
│     - Route handlers (route.ts)         │  ← Request validation
│     - Middleware (middleware.ts)        │  ← Authentication
└─────────────────┬───────────────────────┘
                  │ calls
                  ▼
┌─────────────────────────────────────────┐
│  3. BUSINESS LOGIC LAYER (lib/)         │  ← Pure logic
│     - Tier validation (lib/tier)        │  ← No HTTP, no UI
│     - Utilities (lib/utils)             │  ← Reusable functions
└─────────────────┬───────────────────────┘
                  │ uses
                  ▼
┌─────────────────────────────────────────┐
│  4. DATABASE LAYER (lib/db, prisma)     │  ← Data persistence
│     - Prisma client (lib/db/prisma.ts)  │  ← ORM operations
│     - Schema (prisma/schema.prisma)     │  ← Database models
└─────────────────┬───────────────────────┘
                  │ queries
                  ▼
┌─────────────────────────────────────────┐
│  5. EXTERNAL SERVICES                   │  ← Third-party APIs
│     - Flask MT5 Service (HTTP)          │  ← Market data
│     - Stripe API (payments)             │  ← Subscriptions
│     - Email service (Resend)            │  ← Notifications
└─────────────────────────────────────────┘
```

**Why this matters:** Layered architecture allows changes to one layer without affecting others. For example, switching from Prisma to another ORM only requires changes to the Database Layer.

---

### 2.2 Data Flow Diagram

**Example: User creates an alert**

```
1. USER clicks "Create Alert" button
   │
   ▼
2. FRONTEND (components/alerts/alert-form.tsx)
   - Client Component with form state
   - Validates input with Zod (client-side)
   - Calls: fetch('/api/alerts', { method: 'POST', body: {...} })
   │
   ▼
3. API LAYER (app/api/alerts/route.ts)
   - Receives POST /api/alerts request
   - Checks authentication (getServerSession)
   - Validates input with Zod (server-side)
   - Calls business logic: validateChartAccess(tier, symbol, timeframe)
   │
   ▼
4. BUSINESS LOGIC (lib/tier/validation.ts)
   - validateChartAccess() checks if user's tier can access symbol/timeframe
   - If FREE tier + PRO symbol → throw ForbiddenError
   - If valid → continue
   │
   ▼
5. DATABASE LAYER (lib/db/alerts.ts or Prisma direct)
   - createAlert(userId, data)
   - Prisma: prisma.alert.create({ data: {...} })
   - Returns created Alert object
   │
   ▼
6. API LAYER (app/api/alerts/route.ts)
   - Returns Response.json(alert, { status: 201 })
   │
   ▼
7. FRONTEND (components/alerts/alert-form.tsx)
   - Receives response
   - Shows success message
   - Redirects to /alerts/{id}
```

**Key Rules:**

- ✅ Frontend calls API routes via fetch()
- ✅ API routes call business logic functions
- ✅ Business logic calls database operations
- ❌ Frontend NEVER calls database directly
- ❌ Business logic NEVER returns HTTP responses

---

## 3. TYPE SYSTEM

### 3.1 OpenAPI Specs = Source of Truth

**Rule:** All types are derived from OpenAPI specifications. Never manually define types that exist in OpenAPI.

**Why this matters:** OpenAPI specs define the contract between frontend and backend. Auto-generating types from specs ensures frontend and backend always agree on data structures.

**Files:**

- `docs/trading_alerts_openapi.yaml` → Types for Next.js API (`/api/alerts`, `/api/users`, etc.)
- `docs/flask_mt5_openapi.yaml` → Types for Flask MT5 API (`/api/indicators`, etc.)

**Auto-Generated Types:**

```bash
# Generate TypeScript types from Next.js OpenAPI
sh scripts/openapi/generate-nextjs-types.sh
# Creates: lib/api-client/models.ts, lib/api-client/api.ts

# Generate TypeScript types from Flask OpenAPI
sh scripts/openapi/generate-flask-types.sh
# Creates: lib/mt5-client/models.ts, lib/mt5-client/api.ts
```

**Usage:**

```typescript
// ✅ GOOD - Import types from auto-generated files
import type {
  Alert,
  CreateAlertRequest,
  AlertResponse,
} from '@/lib/api-client';

export async function POST(req: Request): Promise<Response> {
  const body: CreateAlertRequest = await req.json();

  const alert: Alert = await createAlert(body);

  const response: AlertResponse = {
    id: alert.id,
    userId: alert.userId,
    // ... matches OpenAPI schema
  };

  return Response.json(response);
}

// ❌ BAD - Manually defining types that exist in OpenAPI
interface Alert {
  // Don't do this! Use auto-generated type
  id: string;
  userId: string;
  // ...
}
```

---

### 3.2 Contract-Driven Development

**Process:**

```
1. Define API in OpenAPI YAML
   ├─ docs/trading_alerts_openapi.yaml
   └─ Define AlertResponse, CreateAlertRequest, etc.

2. Generate TypeScript types
   ├─ sh scripts/openapi/generate-nextjs-types.sh
   └─ Creates lib/api-client/models.ts

3. Implement API route using generated types
   ├─ app/api/alerts/route.ts
   └─ Import types from lib/api-client

4. Frontend uses same generated types
   ├─ components/alerts/alert-form.tsx
   └─ Import types from lib/api-client
```

**Benefits:**

- ✅ Frontend and backend can't drift apart (both use same types)
- ✅ Changes to API spec automatically flow to TypeScript
- ✅ Type errors caught at compile time, not runtime
- ✅ IDE autocomplete shows exact API structure

**Why this matters:** This is how professional teams prevent API contract bugs. If backend changes response structure, frontend gets TypeScript errors immediately.

---

## 4. AUTHENTICATION & AUTHORIZATION

### 4.1 NextAuth.js for Authentication

**Version:** NextAuth.js v4.24.5
**Providers:** Email/Password (CredentialsProvider) + Google OAuth (GoogleProvider)
**Session Strategy:** JWT (serverless-friendly, no database Session model)

> **📖 For Complete OAuth Implementation:** See `docs/policies/08-google-oauth-implementation-rules.md` for:
>
> - Google OAuth provider configuration
> - Verified-only account linking (security)
> - Account model setup
> - Nullable password handling for OAuth-only users

**Basic Setup (Email/Password):**

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google'; // NEW: OAuth support
import { prisma } from '@/lib/db/prisma';

const handler = NextAuth({
  providers: [
    // Provider 1: Google OAuth (see Policy 08 for full config)
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // Provider 2: Email/Password
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // Handle OAuth-only users (null password)
        if (!user || !user.password) {
          return null;
        }

        if (!(await bcrypt.compare(credentials.password, user.password))) {
          return null; // Invalid credentials
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier, // Add tier to session
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    // See Policy 08 for complete signIn callback with verified-only linking
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tier = user.tier;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.tier = token.tier;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };
```

**Why NextAuth:** Industry-standard, handles session management, CSRF protection, secure cookies, supports multiple providers (Email + OAuth).

---

### 4.2 Tier Validation Pattern

**Rule:** All endpoints serving symbol/timeframe data MUST validate tier access.

**Tier Rules (from docs/policies/00-tier-specifications.md):**

| Tier | Symbols                                  | Timeframes         | Chart Combinations |
| ---- | ---------------------------------------- | ------------------ | ------------------ |
| FREE | 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) | 3 (H1, H4, D1)     | 15                 |
| PRO  | 15 (all symbols)                         | 9 (all timeframes) | 135                |

**Implementation:**

```typescript
// lib/tier/validation.ts

import { UserTier } from '@/types';

const FREE_SYMBOLS = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'] as const;
const PRO_SYMBOLS = [
  'AUDJPY',
  'AUDUSD',
  'BTCUSD',
  'ETHUSD',
  'EURUSD',
  'GBPJPY',
  'GBPUSD',
  'NDX100',
  'NZDUSD',
  'US30',
  'USDCAD',
  'USDCHF',
  'USDJPY',
  'XAGUSD',
  'XAUUSD',
] as const;

const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;
const PRO_TIMEFRAMES = [
  'M5',
  'M15',
  'M30',
  'H1',
  'H2',
  'H4',
  'H8',
  'H12',
  'D1',
] as const;

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Validates if user's tier can access the specified symbol
 * @throws {ForbiddenError} If tier cannot access symbol
 */
export function validateSymbolAccess(tier: UserTier, symbol: string): void {
  const allowedSymbols = tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;

  if (!allowedSymbols.includes(symbol as any)) {
    throw new ForbiddenError(
      `${tier} tier cannot access ${symbol}. Available symbols: ${allowedSymbols.join(', ')}`
    );
  }
}

/**
 * Validates if user's tier can access the specified timeframe
 * @throws {ForbiddenError} If tier cannot access timeframe
 */
export function validateTimeframeAccess(
  tier: UserTier,
  timeframe: string
): void {
  const allowedTimeframes = tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  if (!allowedTimeframes.includes(timeframe as any)) {
    throw new ForbiddenError(
      `${tier} tier cannot access ${timeframe} timeframe. Available timeframes: ${allowedTimeframes.join(', ')}`
    );
  }
}

/**
 * Validates if user's tier can access the symbol+timeframe combination
 * @throws {ForbiddenError} If tier cannot access combination
 */
export function validateChartAccess(
  tier: UserTier,
  symbol: string,
  timeframe: string
): void {
  validateSymbolAccess(tier, symbol);
  validateTimeframeAccess(tier, timeframe);
}
```

**Usage in API routes:**

```typescript
// app/api/indicators/[symbol]/[timeframe]/route.ts

import { getServerSession } from 'next-auth';
import { validateChartAccess } from '@/lib/tier/validation';

export async function GET(
  req: Request,
  { params }: { params: { symbol: string; timeframe: string } }
) {
  try {
    // 1. Authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Tier validation - CRITICAL!
    const userTier = session.user.tier || 'FREE';
    try {
      validateChartAccess(userTier, params.symbol, params.timeframe);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return Response.json(
          {
            error: error.message,
            message: 'Upgrade to PRO for access to all symbols and timeframes',
          },
          { status: 403 }
        );
      }
      throw error;
    }

    // 3. Fetch data (user is authorized)
    const data = await fetchIndicatorData(params.symbol, params.timeframe);

    return Response.json(data);
  } catch (error) {
    console.error('GET /api/indicators error:', error);
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
```

**Critical:** Tier validation must happen on BOTH:

1. Next.js API routes (app/api/indicators/...)
2. Flask MT5 service (before fetching from MT5)

**Why:** Users could bypass Next.js and call Flask directly. Always validate at both layers.

---

### 4.3 Where to Check Auth

| Location              | Auth Check                  | Tier Check               | Example                      |
| --------------------- | --------------------------- | ------------------------ | ---------------------------- |
| **middleware.ts**     | ✅ Yes (redirect to /login) | ❌ No                    | Protect /dashboard/\* routes |
| **API routes**        | ✅ Yes (return 401)         | ✅ Yes (return 403)      | All /api/\* endpoints        |
| **Server Components** | ✅ Yes (redirect to /login) | ✅ Yes (show upgrade UI) | Dashboard pages              |
| **Client Components** | ❌ No (use useSession)      | ✅ Yes (disable UI)      | Forms, buttons               |

**Example: Middleware**

```typescript
// middleware.ts
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  // Protect /dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

---

## 5. DATABASE PATTERNS

### 5.1 Prisma Only (No Raw SQL)

**Rule:** Use Prisma ORM for all database operations. Avoid raw SQL unless absolutely necessary.

**Why this matters:** Prisma prevents SQL injection, provides type safety, handles connection pooling, and generates TypeScript types from schema.

**Prisma Client Setup:**

```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Why singleton pattern:** Next.js Hot Reload creates multiple Prisma instances in development. This pattern prevents "Too many database connections" errors.

---

### 5.2 Database Operation Patterns

**CRUD Examples:**

```typescript
// lib/db/alerts.ts

import { prisma } from './prisma';
import type { Alert, Prisma } from '@prisma/client';

/**
 * Create a new alert for a user
 */
export async function createAlert(
  data: Prisma.AlertCreateInput
): Promise<Alert> {
  return prisma.alert.create({ data });
}

/**
 * Get all alerts for a user, ordered by creation date
 */
export async function getUserAlerts(userId: string): Promise<Alert[]> {
  return prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get alert by ID, ensuring it belongs to the user
 */
export async function getAlertById(
  alertId: string,
  userId: string
): Promise<Alert | null> {
  return prisma.alert.findFirst({
    where: {
      id: alertId,
      userId, // Security: User can only access their own alerts
    },
  });
}

/**
 * Update an alert
 */
export async function updateAlert(
  alertId: string,
  userId: string,
  data: Prisma.AlertUpdateInput
): Promise<Alert> {
  return prisma.alert.update({
    where: { id: alertId },
    data,
  });
}

/**
 * Delete an alert
 */
export async function deleteAlert(
  alertId: string,
  userId: string
): Promise<void> {
  await prisma.alert.delete({
    where: {
      id: alertId,
      userId, // Security: User can only delete their own alerts
    },
  });
}

/**
 * Count user's alerts (for tier limit checking)
 */
export async function countUserAlerts(userId: string): Promise<number> {
  return prisma.alert.count({
    where: { userId },
  });
}
```

**Usage in API routes:**

```typescript
// app/api/alerts/route.ts
import { createAlert, getUserAlerts } from '@/lib/db/alerts';

export async function GET(req: Request) {
  const session = await getServerSession();
  const alerts = await getUserAlerts(session.user.id);
  return Response.json(alerts);
}

export async function POST(req: Request) {
  const session = await getServerSession();
  const body = await req.json();

  const alert = await createAlert({
    userId: session.user.id,
    symbol: body.symbol,
    timeframe: body.timeframe,
    condition: body.condition,
    isActive: true,
  });

  return Response.json(alert, { status: 201 });
}
```

---

## 6. API ROUTE STRUCTURE

### 6.1 Standard Pattern All Routes Follow

**Every API route (route.ts) follows this structure:**

```typescript
// 1. Imports
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

// 2. Input validation schema
const createSchema = z.object({
  symbol: z.string().min(1),
  // ...
});

// 3. GET handler
export async function GET(req: NextRequest) {
  try {
    // a. Authentication
    const session = await getServerSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // b. Business logic
    const data = await fetchData(session.user.id);

    // c. Response matching OpenAPI
    return NextResponse.json(data);
  } catch (error) {
    // d. Error handling
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// 4. POST handler
export async function POST(req: NextRequest) {
  try {
    // a. Authentication
    // b. Input validation
    // c. Tier validation (if applicable)
    // d. Business logic
    // e. Response
  } catch (error) {
    // f. Error handling
  }
}

// 5. Other methods (PATCH, DELETE, etc.) follow same pattern
```

See `docs/policies/02-quality-standards.md` section 5 for complete example.

---

## 7. REACT COMPONENT STRUCTURE

### 7.1 Server Components (Default)

**Use Server Components when:**

- No interactivity needed
- Fetching data from database
- SEO important

```typescript
// app/dashboard/page.tsx (Server Component - no 'use client')
import { getServerSession } from 'next-auth';
import { getUserAlerts } from '@/lib/db/alerts';

export default async function DashboardPage() {
  const session = await getServerSession();

  // Fetch data in Server Component
  const alerts = await getUserAlerts(session.user.id);

  return (
    <div>
      <h1>Dashboard</h1>
      <AlertList alerts={alerts} />
    </div>
  );
}
```

---

### 7.2 Client Components ('use client')

**Use Client Components when:**

- Using React hooks (useState, useEffect, etc.)
- Handling user interactions (onClick, etc.)
- Using browser APIs (localStorage, window)

```typescript
// components/alerts/alert-form.tsx (Client Component)
'use client';

import { useState } from 'react';

export function AlertForm() {
  const [symbol, setSymbol] = useState('EURUSD');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Handle submission
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

---

## 8. FLASK MT5 SERVICE - MULTI-TERMINAL ARCHITECTURE

### 8.1 Multi-Terminal Architecture Overview

**Critical Change:** The Flask MT5 service now manages **15 separate MT5 terminals** (one per symbol) instead of a single terminal.

**Why Multi-Terminal:**

- PRO tier = 15 symbols × 9 timeframes = 135 chart combinations
- Single MT5 terminal cannot efficiently handle 135 chart windows
- Solution: 15 terminals × 9 charts each = distributed, manageable load
- Fault isolation: if one terminal fails, other 14 symbols continue working

**Symbol-to-Terminal Mapping:**

```
MT5_01 → AUDJPY     MT5_09 → NZDUSD
MT5_02 → AUDUSD     MT5_10 → US30
MT5_03 → BTCUSD     MT5_11 → USDCAD
MT5_04 → ETHUSD     MT5_12 → USDCHF
MT5_05 → EURUSD     MT5_13 → USDJPY
MT5_06 → GBPJPY     MT5_14 → XAGUSD
MT5_07 → GBPUSD     MT5_15 → XAUUSD
MT5_08 → NDX100
```

**Updated Structure:**

```
mt5-service/
├── app/
│   ├── __init__.py                      # Flask app factory + pool initialization
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── indicators.py                # /api/indicators routes (user-facing)
│   │   └── admin_terminals.py           # /api/admin/terminals/* (admin-only)
│   ├── services/
│   │   ├── __init__.py
│   │   ├── mt5_connection_pool.py       # Connection pool manager (NEW)
│   │   ├── indicator_reader.py          # Reads from specific terminal (UPDATED)
│   │   └── health_monitor.py            # Background health checks (NEW)
│   └── middleware/
│       ├── __init__.py
│       ├── auth.py                      # API key auth (standard + admin) (NEW)
│       └── tier_validator.py            # Tier validation
├── config/
│   └── mt5_terminals.json               # Terminal configuration (15 terminals) (NEW)
├── requirements.txt                     # Python dependencies
├── Dockerfile                           # Container config
├── .env.example
└── run.py                              # Entry point
```

**Why separate service:** MT5 (MetaTrader 5) requires Python library (MetaTrader5 package). Next.js is JavaScript-only, so we use Flask for MT5 integration.

---

### 8.1.1 Connection Pool Pattern (NEW)

**Rule:** All MT5 terminal connections MUST be managed through the connection pool. Never create direct MT5 connections outside the pool.

**Connection Pool Responsibilities:**

- Initialize and maintain 15 MT5 connections on startup
- Route requests to correct terminal based on symbol
- Monitor terminal health every 60 seconds
- Auto-reconnect failed terminals
- Provide health status for admin dashboard
- Thread-safe access to connections

**Implementation Pattern:**

```python
# app/services/mt5_connection_pool.py

from typing import Dict, Optional
import MetaTrader5 as mt5
from threading import Lock

class MT5Connection:
    """Represents a single MT5 terminal connection"""
    def __init__(self, config: dict):
        self.id = config['id']           # e.g., "MT5_15"
        self.symbol = config['symbol']   # e.g., "XAUUSD"
        self.server = config['server']
        self.login = config['login']
        self.password = config['password']
        self.connected = False
        self.lock = Lock()  # Thread-safe access

    def connect(self) -> bool:
        """Connect to this specific MT5 terminal"""
        with self.lock:
            if not mt5.initialize():
                return False

            authorized = mt5.login(
                login=self.login,
                password=self.password,
                server=self.server
            )

            if authorized:
                self.connected = True
                return True
            return False

    def reconnect(self) -> bool:
        """Reconnect if connection lost"""
        self.disconnect()
        return self.connect()

class MT5ConnectionPool:
    """Manages pool of 15 MT5 connections"""
    def __init__(self, config_path: str):
        self.connections: Dict[str, MT5Connection] = {}
        self.symbol_to_connection: Dict[str, MT5Connection] = {}
        self._load_config(config_path)

    def connect_all(self) -> tuple[int, int]:
        """Connect to all MT5 terminals"""
        successful = 0
        for connection in self.connections.values():
            if connection.connect():
                successful += 1
        return successful, len(self.connections)

    def get_connection_by_symbol(self, symbol: str) -> Optional[MT5Connection]:
        """Get MT5 connection for a specific symbol"""
        connection = self.symbol_to_connection.get(symbol)
        if connection and not connection.connected:
            connection.reconnect()  # Auto-reconnect if disconnected
        return connection

# Global pool instance (singleton)
_connection_pool = None

def get_connection_pool() -> MT5ConnectionPool:
    """Get global connection pool instance"""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = MT5ConnectionPool('config/mt5_terminals.json')
        _connection_pool.connect_all()
    return _connection_pool
```

---

### 8.1.2 Admin Endpoints for Terminal Management (NEW)

**Rule:** Provide admin-only endpoints for monitoring and managing MT5 terminals.

**Required Admin Endpoints:**

```python
# app/routes/admin_terminals.py

GET  /api/admin/terminals/health           # Get health of all 15 terminals
POST /api/admin/terminals/{id}/restart     # Restart specific terminal
POST /api/admin/terminals/restart-all      # Restart all terminals (critical operation)
GET  /api/admin/terminals/{id}/logs        # Get terminal logs
GET  /api/admin/terminals/stats            # Aggregate statistics
```

**Authentication:** Admin endpoints MUST use separate admin API key (`X-Admin-API-Key`), not regular API key.

**Example:**

```python
from app.middleware.auth import require_admin_api_key

@admin_terminals_bp.route('/api/admin/terminals/health', methods=['GET'])
@require_admin_api_key  # Admin-only
def get_terminals_health():
    """Get health status of all 15 MT5 terminals"""
    pool = get_connection_pool()
    health = pool.get_health_summary()

    # Add admin-specific metrics
    for symbol, connection in pool.symbol_to_connection.items():
        health['terminals'][symbol]['uptime_percentage'] = connection.get_uptime_percentage()
        health['terminals'][symbol]['reconnect_count'] = connection.reconnect_count

    return jsonify(health), 200
```

---

### 8.2 Tier Validation in Flask

**Critical:** Flask service must also validate tiers (don't trust Next.js exclusively).

```python
# app/middleware/tier_validator.py

from flask import request, jsonify
from functools import wraps

FREE_SYMBOLS = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']
PRO_SYMBOLS = [
    'AUDJPY', 'AUDUSD', 'BTCUSD', 'ETHUSD', 'EURUSD',
    'GBPJPY', 'GBPUSD', 'NDX100', 'NZDUSD', 'US30',
    'USDCAD', 'USDCHF', 'USDJPY', 'XAGUSD', 'XAUUSD'
]

FREE_TIMEFRAMES = ['H1', 'H4', 'D1']
PRO_TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']

def validate_tier_access(f):
    """Middleware to validate tier access to symbol/timeframe"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get tier from header (Next.js passes this)
        tier = request.headers.get('X-User-Tier', 'FREE')
        symbol = kwargs.get('symbol')
        timeframe = kwargs.get('timeframe')

        # Validate symbol
        allowed_symbols = PRO_SYMBOLS if tier == 'PRO' else FREE_SYMBOLS
        if symbol not in allowed_symbols:
            return jsonify({
                'error': f'{tier} tier cannot access {symbol}',
                'message': 'Upgrade to PRO for access to all symbols'
            }), 403

        # Validate timeframe
        allowed_timeframes = PRO_TIMEFRAMES if tier == 'PRO' else FREE_TIMEFRAMES
        if timeframe not in allowed_timeframes:
            return jsonify({
                'error': f'{tier} tier cannot access {timeframe} timeframe',
                'message': 'Upgrade to PRO for access to all timeframes'
            }), 403

        return f(*args, **kwargs)

    return decorated_function
```

**Usage:**

```python
# app/routes/indicators.py

from flask import Blueprint, jsonify
from app.middleware.tier_validator import validate_tier_access
from app.services.mt5_connector import fetch_indicator_data

indicators_bp = Blueprint('indicators', __name__)

@indicators_bp.route('/api/indicators/<symbol>/<timeframe>', methods=['GET'])
@validate_tier_access  # Validate tier before fetching MT5 data
def get_indicators(symbol: str, timeframe: str):
    """Fetch indicator data from MT5 for symbol/timeframe (MULTI-TERMINAL VERSION)"""
    try:
        # Get connection pool
        pool = get_connection_pool()

        # Route to correct terminal based on symbol
        connection = pool.get_connection_by_symbol(symbol)

        if connection is None:
            return jsonify({'error': f'No terminal configured for {symbol}'}), 500

        if not connection.connected:
            return jsonify({
                'error': f'Terminal for {symbol} is currently disconnected',
                'terminal_id': connection.id
            }), 503

        # Fetch data using the specific terminal connection
        data = fetch_indicator_data(connection, symbol, timeframe, bars=1000)

        # Add metadata including which terminal served this request
        data['metadata'] = {
            'symbol': symbol,
            'timeframe': timeframe,
            'terminal_id': connection.id,  # Shows which MT5 was used
            'fetchedAt': datetime.utcnow().isoformat()
        }

        return jsonify({'success': True, 'data': data}), 200

    except Exception as e:
        logger.error(f"Error fetching indicator data: {e}")
        return jsonify({'error': 'Failed to fetch indicator data'}), 500
```

**Key Changes for Multi-Terminal:**

1. Get connection pool instance
2. Route to correct terminal using `pool.get_connection_by_symbol(symbol)`
3. Check if terminal is connected (return 503 if down)
4. Pass specific connection to fetch function
5. Include `terminal_id` in response metadata for transparency

---

### 8.3 How Next.js Calls Flask (UNCHANGED)

```typescript
// lib/mt5/fetch-indicators.ts

export async function fetchIndicatorsFromMT5(
  symbol: string,
  timeframe: string,
  userTier: 'FREE' | 'PRO'
): Promise<IndicatorData> {
  const flaskUrl = process.env.FLASK_MT5_URL || 'http://localhost:5001';

  const res = await fetch(`${flaskUrl}/api/indicators/${symbol}/${timeframe}`, {
    headers: {
      'X-User-Tier': userTier, // Pass tier to Flask for validation
      'X-API-Key': process.env.FLASK_API_KEY || '',
    },
  });

  if (!res.ok) {
    throw new Error(`Flask API error: ${res.statusText}`);
  }

  return res.json();
}
```

---

## 9. DEPENDENCY RULES

### 9.1 Allowed Dependencies (Pre-Approved)

These dependencies are approved for use without escalation:

**Next.js / React:**

- next (v15)
- react (v19)
- react-dom (v19)

**UI Components:**

- @radix-ui/\* (shadcn/ui dependencies)
- tailwindcss
- lucide-react (icons)

**Forms & Validation:**

- zod
- react-hook-form
- @hookform/resolvers

**Authentication:**

- next-auth
- bcryptjs

**Database:**

- @prisma/client
- prisma (dev dependency)

**API Client:**

- axios (for OpenAPI generated clients)

**Date/Time:**

- date-fns

**Charts:**

- recharts or lightweight-charts

**Payments:**

- stripe
- @stripe/stripe-js

**Flask (Python):**

- Flask
- MetaTrader5
- python-dotenv
- gunicorn (production server)

---

### 9.2 Require Approval for New Dependencies

**Escalate when you need:**

- New npm packages not in the list above
- Alternative libraries (e.g., dayjs instead of date-fns)
- Large dependencies (>100KB bundle size)

**Why this matters:** Every dependency adds attack surface, bundle size, and maintenance burden. Human approval ensures necessity.

---

## 10. TESTING STRATEGY

### 10.1 Testing Pyramid

```
         ┌──────────────┐
         │   E2E Tests  │  ← Few (critical user flows)
         │  (Playwright)│
         └──────────────┘
      ┌────────────────────┐
      │ Integration Tests  │  ← Some (API routes)
      │      (Jest)        │
      └────────────────────┘
   ┌──────────────────────────┐
   │    Unit Tests (Jest)     │  ← Many (business logic)
   │  lib/tier, lib/utils,    │
   │  lib/db functions        │
   └──────────────────────────┘
```

**Rules:**

1. **Unit tests** for business logic (lib/tier, lib/utils, lib/db functions)
2. **Integration tests** for API routes (test full request/response cycle)
3. **E2E tests** for critical flows (registration, creating alert, purchasing PRO)

---

### 10.2 Test Examples

**Unit Test:**

```typescript
// lib/tier/validation.test.ts
import { describe, it, expect } from '@jest/globals';
import { validateSymbolAccess, validateTimeframeAccess } from './validation';

describe('Tier Validation', () => {
  describe('validateSymbolAccess', () => {
    it('allows FREE tier to access FREE symbols', () => {
      expect(() => validateSymbolAccess('FREE', 'EURUSD')).not.toThrow();
      expect(() => validateSymbolAccess('FREE', 'BTCUSD')).not.toThrow();
    });

    it('denies FREE tier access to PRO symbols', () => {
      expect(() => validateSymbolAccess('FREE', 'AUDJPY')).toThrow();
      expect(() => validateSymbolAccess('FREE', 'GBPJPY')).toThrow();
    });

    it('allows PRO tier to access all symbols', () => {
      expect(() => validateSymbolAccess('PRO', 'EURUSD')).not.toThrow();
      expect(() => validateSymbolAccess('PRO', 'AUDJPY')).not.toThrow();
    });
  });
});
```

**Integration Test:**

```typescript
// app/api/alerts/route.test.ts
import { describe, it, expect } from '@jest/globals';
import { POST } from './route';

describe('POST /api/alerts', () => {
  it('creates alert for authenticated user', async () => {
    const mockRequest = new Request('http://localhost/api/alerts', {
      method: 'POST',
      body: JSON.stringify({
        symbol: 'EURUSD',
        timeframe: 'H1',
        condition: 'RSI > 70',
      }),
    });

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data.symbol).toBe('EURUSD');
  });

  it('returns 401 for unauthenticated user', async () => {
    // Test without session
  });

  it('returns 403 for FREE tier accessing PRO symbol', async () => {
    // Test tier validation
  });
});
```

---

## 11. DEPLOYMENT ARCHITECTURE

### 11.1 Services & Hosting

```
┌────────────────────────────────────────────────────┐
│              VERCEL (Next.js Frontend)              │
│  - Auto-deployment from GitHub main branch         │
│  - Serverless functions (app/api/*)                │
│  - Edge runtime for middleware                     │
│  - Environment: NEXTAUTH_SECRET, DATABASE_URL      │
└─────────────────────┬──────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌─────────────────────┐
│  RAILWAY        │      │  RAILWAY            │
│  PostgreSQL DB  │      │  Flask MT5 Service  │
│                 │      │  - Docker container │
│  - Production   │      │  - Python 3.11      │
│  - Backups      │      │  - MT5 connection   │
│  - Migrations   │      │                     │
└─────────────────┘      └─────────┬───────────┘
                                   │
                                   ▼
                          ┌─────────────────┐
                          │  MT5 Terminal   │
                          │  (VPS/Local)    │
                          └─────────────────┘
```

**Why this architecture:**

- **Vercel:** Best Next.js hosting, automatic scaling, edge runtime
- **Railway PostgreSQL:** Easy setup, automatic backups, good free tier
- **Railway Flask:** Docker support, easy deployment, same provider as DB (low latency)
- **MT5 Terminal:** Must run on Windows or Linux VPS with MT5 installed

---

### 11.2 Environment Variables

**Vercel (.env):**

```bash
# Next.js
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=generated-secret-from-openssl

# Database
DATABASE_URL=postgresql://user:pass@railway.app/dbname

# Flask MT5 Service
FLASK_MT5_URL=https://your-flask-service.railway.app
FLASK_API_KEY=generated-key

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Email
RESEND_API_KEY=re_...
```

**Railway Flask (.env):**

```bash
# MT5 Connection
MT5_SERVER=your-broker-server
MT5_LOGIN=your-mt5-account
MT5_PASSWORD=your-mt5-password

# API Security
FLASK_API_KEY=same-as-nextjs-FLASK_API_KEY

# Database (if Flask needs it)
DATABASE_URL=postgresql://user:pass@railway.app/dbname
```

---

## 12. CHART DATA REFRESH STRATEGY

### 12.1 Polling Approach (NOT WebSocket for MVP)

**Why polling:** Simpler, works with Vercel serverless, sufficient for 1-minute updates.

**Polling Intervals (from existing 03-architecture-rule.md):**

```typescript
const REFRESH_INTERVALS = {
  M5: 30000, // 30 seconds (PRO only - scalping)
  M15: 60000, // 1 minute
  M30: 60000, // 1 minute
  H1: 120000, // 2 minutes
  H2: 120000, // 2 minutes
  H4: 300000, // 5 minutes
  H8: 300000, // 5 minutes
  H12: 600000, // 10 minutes (PRO only - swing trading)
  D1: 600000, // 10 minutes
} as const;
```

**Implementation:**

```typescript
// components/charts/trading-chart.tsx
'use client';

import { useEffect, useState } from 'react';

interface TradingChartProps {
  symbol: string;
  timeframe: string;
}

export function TradingChart({ symbol, timeframe }: TradingChartProps) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetchIndicatorData();

    // Set up polling interval
    const interval = setInterval(
      fetchIndicatorData,
      REFRESH_INTERVALS[timeframe]
    );

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  async function fetchIndicatorData() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/indicators/${symbol}/${timeframe}`);
      const json = await res.json();
      setData(json.data);
    } catch (error) {
      console.error('Failed to fetch indicators:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading && !data) {
    return <div>Loading chart...</div>;
  }

  return <Chart data={data} />;
}
```

**Rate Limiting Consideration:**

- FREE tier: 60 requests/hour = supports ~1 chart polling every minute
- PRO tier: 300 requests/hour = supports ~5 charts polling every minute

**Future Enhancement (Post-MVP):** WebSocket for real-time push updates.

---

## 13. AFFILIATE MARKETING ARCHITECTURE

### 13.1 2-Sided Marketplace Structure

**Rule:** Affiliate marketing is implemented as a **2-sided marketplace** with three distinct user types: Affiliates, End Users, and Admin.

**Why this matters:** Clear separation ensures secure authentication, appropriate permissions, and maintainable code isolation.

**Architecture:**

```
┌──────────────────────────────────────────────────────────┐
│                  Trading Alerts SaaS                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  SIDE 1: AFFILIATE PORTAL                                │
│  ├─ /affiliate/register      (Public)                    │
│  ├─ /affiliate/verify        (Public)                    │
│  ├─ /affiliate/login         (Public)                    │
│  ├─ /affiliate/dashboard     (Protected: Affiliate JWT)  │
│  ├─ /affiliate/profile       (Protected: Affiliate JWT)  │
│  └─ API: /api/affiliate/*    (Affiliate authentication)  │
│                                                          │
│  SIDE 2: END USER PORTAL                                 │
│  ├─ /auth/register           (Public)                    │
│  ├─ /auth/login              (Public)                    │
│  ├─ /dashboard               (Protected: User JWT)       │
│  ├─ /dashboard/settings/billing (Checkout + Discount)    │
│  └─ API: /api/user/*         (User authentication)       │
│                                                          │
│  PLATFORM OPERATOR: ADMIN PANEL                          │
│  ├─ /admin/affiliates        (Protected: Admin role)     │
│  ├─ /admin/reports           (Protected: Admin role)     │
│  └─ API: /api/admin/*        (Admin authentication)      │
│                                                          │
│  CONNECTION POINT:                                       │
│  └─ User applies affiliate code at checkout →            │
│      Commission created → Affiliate notified             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 13.2 Database Schema for Affiliates

**Rule:** Three new tables must be added: `Affiliate`, `AffiliateCode`, and `Commission`.

**Location:** `prisma/schema.prisma`

**Key Relationships:**

```
Affiliate (1) ─┬─── (M) AffiliateCode
               └─── (M) Commission

AffiliateCode (1) ───── (1) Commission

User (1) ─────────────── (M) Commission (as customer)

Subscription (1) ───── (0..1) AffiliateCode (nullable)
```

**Critical Fields:**

- `AffiliateCode.status`: Enum `[ACTIVE, USED, EXPIRED, CANCELLED]` - lifecycle management
- `AffiliateCode.code`: Unique, cryptographically random (>12 chars) using `crypto.randomBytes`
- `Commission.status`: Enum `[PENDING, PAID]` - payment tracking
- `Affiliate.paymentMethod`: Enum `[BANK_TRANSFER, CRYPTO, GLOBAL_WALLET, LOCAL_WALLET]`

### 13.3 Separate Authentication Systems

**Rule:** Affiliates use separate JWT tokens from end users. No shared sessions.

**Why this matters:** Security isolation prevents affiliates from accessing user dashboards and vice versa.

**Implementation:**

```typescript
// lib/auth/affiliate-auth.ts
export async function generateAffiliateToken(
  affiliate: Affiliate
): Promise<string> {
  return jwt.sign(
    {
      id: affiliate.id,
      email: affiliate.email,
      type: 'AFFILIATE', // Critical: type discriminator
      status: affiliate.status,
    },
    process.env.AFFILIATE_JWT_SECRET!, // Separate secret
    { expiresIn: '7d' }
  );
}

// Middleware validates token type
export function validateAffiliateToken(token: string) {
  const decoded = jwt.verify(token, process.env.AFFILIATE_JWT_SECRET!);
  if (decoded.type !== 'AFFILIATE') {
    throw new Error('Invalid token type');
  }
  return decoded;
}
```

**DO NOT:**

- ❌ Reuse user authentication for affiliates
- ❌ Store both affiliate and user in same JWT
- ❌ Allow affiliate tokens to access user endpoints

### 13.4 Code Distribution Strategy

**Rule:** All code distribution uses automated monthly cron jobs (1st of month). Manual distribution is admin-only exception.

**Why this matters:** Consistent monthly rhythm ensures predictable inventory for affiliates and reduces administrative burden.

**Implementation:**

```typescript
// app/api/cron/distribute-codes/route.ts
export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  if (
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeAffiliates = await prisma.affiliate.findMany({
    where: { status: 'ACTIVE' },
  });

  // Fetch current config from SystemConfig table
  const discountConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_discount_percent' },
  });
  const commissionConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_commission_percent' },
  });
  const codesConfig = await prisma.systemConfig.findUnique({
    where: { key: 'affiliate_codes_per_month' },
  });

  const discountPercent = parseFloat(discountConfig?.value || '20.0');
  const commissionPercent = parseFloat(commissionConfig?.value || '20.0');
  const codesPerMonth = parseInt(codesConfig?.value || '15');

  for (const affiliate of activeAffiliates) {
    // Generate codes per affiliate (default 15, configurable via SystemConfig)
    const codes = Array.from({ length: codesPerMonth }, () => ({
      code: generateRandomCode(affiliate.fullName),
      affiliateId: affiliate.id,
      status: 'ACTIVE',
      discountPercent, // From SystemConfig
      commissionPercent, // From SystemConfig
      expiresAt: endOfMonth(new Date()),
    }));

    await prisma.affiliateCode.createMany({ data: codes });
    await sendEmail(affiliate.email, 'Monthly Codes Distributed', codes);
  }

  return NextResponse.json({ success: true });
}
```

**Vercel Configuration:**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/distribute-codes",
      "schedule": "0 0 1 * *" // 00:00 UTC on 1st of month
    },
    {
      "path": "/api/cron/expire-codes",
      "schedule": "59 23 28-31 * *" // 23:59 UTC on last day of month
    }
  ]
}
```

### 13.5 Commission Calculation Flow

**Rule:** Commissions are calculated at checkout and stored immediately, but status remains `PENDING` until admin marks as paid.

**Why this matters:** Ensures affiliate sees earned commissions in real-time while admin maintains payment control.

**Flow:**

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(req: NextRequest) {
  const event = await stripe.webhooks.constructEvent(/* ... */);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const affiliateCode = session.metadata?.affiliateCode;

    if (affiliateCode) {
      // 1. Mark code as USED
      const code = await prisma.affiliateCode.update({
        where: { code: affiliateCode },
        data: {
          status: 'USED',
          usedAt: new Date(),
          usedByUserId: session.metadata.userId,
        },
      });

      // 2. Calculate commission
      const regularPrice = parseFloat(session.metadata.regularPrice);
      const discountPercent = code.discountPercent;
      const discount = regularPrice * (discountPercent / 100);
      const netRevenue = regularPrice - discount;
      const commission = netRevenue * (code.commissionPercent / 100);

      // 3. Create Commission record (status: PENDING)
      await prisma.commission.create({
        data: {
          affiliateId: code.affiliateId,
          affiliateCodeId: code.id,
          userId: session.metadata.userId,
          subscriptionId: session.subscription,
          regularPrice,
          discountAmount: discount,
          netRevenue,
          commissionPercent: code.commissionPercent,
          commissionAmount: commission,
          status: 'PENDING', // Awaits admin payment
        },
      });

      // 4. Notify affiliate
      await sendEmail(code.affiliate.email, 'Commission Earned', {
        code: affiliateCode,
        amount: commission,
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

### 13.6 Accounting-Style Reports

**Rule:** All affiliate and admin reports use accounting-style opening/closing balance format.

**Why this matters:** Provides clear audit trail and matches affiliate's mental model of inventory/earnings.

**Pattern:**

```typescript
// Example: Code Inventory Report
interface CodeInventoryReport {
  reportMonth: string; // "2025-11"
  openingBalance: number; // (1.0) Codes at start of month
  received: number; // (1.1) + Codes distributed
  used: number; // (1.2) - Codes used by customers
  expired: number; // (1.3) - Codes expired
  cancelled: number; // (1.4) - Codes cancelled by admin
  closingBalance: number; // (1.5) = Codes remaining
  movements: {
    received: Array<{ date: string; quantity: number; notes: string }>;
    used: Array<{ date: string; code: string; commission: number }>;
  };
}

// Example: Commission Receivable Report
interface CommissionReport {
  reportMonth: string;
  openingBalance: number; // (2.0) Owed at start of month
  earned: number; // (2.1) + Earned this month
  paid: number; // (2.2) - Paid by admin
  closingBalance: number; // (2.3) = Still owed
  commissions: Array<{
    date: string;
    code: string;
    amount: number;
    status: 'PENDING' | 'PAID';
  }>;
}
```

### 13.7 Admin Business Intelligence Reports

**Rule:** Admin must have access to 4 key reports for business decision-making.

**Required Reports:**

1. **P&L Report** (`/api/admin/reports/profit-loss`)
   - Monthly revenue, discounts, net revenue, commissions, profit
   - 3-month default view
   - Profit margin calculation

2. **Sales Performance by Affiliate** (`/api/admin/reports/sales-performance`)
   - Ranked list of affiliates by conversion rate
   - Aggregate statistics (total codes, total revenue)
   - Conversion distribution histogram

3. **Commission Owings** (`/api/admin/reports/commission-owings`)
   - All affiliates with pending commissions
   - Grouped by payment method
   - Bulk payment capability

4. **Aggregate Code Inventory** (`/api/admin/reports/code-inventory`)
   - System-wide code status breakdown
   - Monthly distribution history
   - Overall conversion metrics

### 13.8 Email Notifications

**Rule:** 8 email types must be triggered automatically by system events.

**Required Email Templates:**

1. Affiliate registration (verification required)
2. Welcome email (after verification + 15 codes distributed)
3. Code usage notification (real-time when code applied)
4. Monthly code distribution (1st of month)
5. Commission payment processed (admin marks paid)
6. Account suspended (admin action)
7. Admin: New affiliate registered
8. Admin: Code request from affiliate

**Implementation:**

```typescript
// lib/email/templates.ts
export const EMAIL_TEMPLATES = {
  AFFILIATE_WELCOME: (data: { fullName: string; codes: number }) => ({
    subject: `Welcome to Trading Alerts Affiliate Program!`,
    html: `
      <h1>Welcome ${data.fullName}!</h1>
      <p>Your affiliate account is now active. We've distributed ${data.codes} discount codes.</p>
      <a href="https://trading-alerts.com/affiliate/dashboard">Login to Dashboard</a>
    `,
  }),
  CODE_USED: (data: { code: string; commission: number }) => ({
    subject: `🎉 Your code was just used! You earned $${data.commission}`,
    html: `
      <h1>Great news!</h1>
      <p>Code <strong>${data.code}</strong> was used. You earned $${data.commission}.</p>
    `,
  }),
  // ... 6 more templates
};
```

### 13.9 Security Considerations

**Critical Rules:**

1. ✅ Affiliates can only view their own codes and commissions
2. ✅ Discount codes must be validated for:
   - Exists in database
   - Status = ACTIVE
   - Not expired (expiresAt > now)
   - Not already used (usedAt = null)
3. ✅ Admin endpoints require role check: `user.role === 'ADMIN'`
4. ✅ Commission creation only via Stripe webhook (prevents fraud)
5. ✅ Code generation uses `crypto.randomBytes(16).toString('hex')` (not predictable)
6. ✅ Payment preferences encrypted at rest (bank account numbers, crypto addresses)

**DO NOT:**

- ❌ Allow affiliates to generate their own codes
- ❌ Allow manual commission creation by affiliates
- ❌ Expose admin reports to non-admin users
- ❌ Use sequential or predictable code formats

### 13.10 Integration with Existing Checkout Flow

**Rule:** Affiliate code validation happens BEFORE payment processing, discount applied to Stripe metadata.

**Modified Checkout Flow:**

```typescript
// app/api/checkout/create-session/route.ts
export async function POST(req: NextRequest) {
  const { priceId, affiliateCode } = await req.json();

  let discountPercent = 0;
  let affiliateCodeId = null;

  // Validate affiliate code if provided
  if (affiliateCode) {
    const code = await validateAffiliateCode(affiliateCode);
    if (code.valid) {
      discountPercent = code.discountPercent;
      affiliateCodeId = code.id;
    }
  }

  // Calculate prices
  const regularPrice = PRICES[priceId];
  const discountAmount = regularPrice * (discountPercent / 100);
  const finalPrice = regularPrice - discountAmount;

  // Create Stripe session with metadata
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: 'PRO Tier' },
          unit_amount: Math.round(finalPrice * 100),
          recurring: { interval: 'month' },
        },
        quantity: 1,
      },
    ],
    metadata: {
      affiliateCode: affiliateCode || null,
      affiliateCodeId: affiliateCodeId || null,
      regularPrice: regularPrice.toString(),
      discountPercent: discountPercent.toString(),
      userId: session.user.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
```

---

### 13.11 Centralized Configuration System (SystemConfig)

**Rule:** All affiliate discount and commission percentages MUST be fetched from SystemConfig table. Never hardcode these values.

**Why this matters:** Admin can change affiliate percentages from dashboard. All pages must reflect changes automatically without code deployment.

**Database Schema:**

```prisma
model SystemConfig {
  id          String   @id @default(cuid())
  key         String   @unique  // "affiliate_discount_percent", "affiliate_commission_percent", etc.
  value       String   // Stored as string, parsed as needed
  valueType   String   // "number", "boolean", "string"
  description String?
  category    String   // "affiliate", "payment", "general"
  updatedBy   String?
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())
}

model SystemConfigHistory {
  id         String   @id @default(cuid())
  configKey  String
  oldValue   String
  newValue   String
  changedBy  String
  changedAt  DateTime @default(now())
  reason     String?
}
```

**Backend Pattern (Code Generation):**

```typescript
// ALWAYS fetch from SystemConfig when generating affiliate codes
export async function POST(req: NextRequest) {
  // Fetch current config
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: ['affiliate_discount_percent', 'affiliate_commission_percent'],
      },
    },
  });

  const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));
  const discountPercent = parseFloat(
    configMap.affiliate_discount_percent || '20.0'
  );
  const commissionPercent = parseFloat(
    configMap.affiliate_commission_percent || '20.0'
  );

  // Use dynamic values
  await prisma.affiliateCode.create({
    data: {
      // ...
      discountPercent, // ✅ From SystemConfig
      commissionPercent, // ✅ From SystemConfig
    },
  });
}
```

**Frontend Pattern:**

```typescript
// ALWAYS use useAffiliateConfig() hook
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export function PricingCard() {
  const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();

  return (
    <div>
      <p>Regular: $29/month</p>
      <p>With code: ${calculateDiscountedPrice(29)} (Save {discountPercent}%!)</p>
    </div>
  );
}
```

**API Endpoints:**

- `GET /api/config/affiliate` - Public endpoint (no auth) for fetching current config
- `GET /api/admin/settings/affiliate` - Admin endpoint for viewing settings
- `PATCH /api/admin/settings/affiliate` - Admin endpoint for updating settings
- `GET /api/admin/settings/affiliate/history` - Admin endpoint for viewing change history

**Update Propagation:**

1. Admin changes percentages via dashboard
2. Backend updates SystemConfig table
3. Backend creates SystemConfigHistory entry
4. Frontend pages refresh within 1-5 minutes (SWR cache)
5. New codes generated use updated percentages
6. Existing codes keep original percentages (no retroactive changes)

**Critical Rules:**

- ✅ NEVER hardcode percentages (20%, 20%, etc.)
- ✅ ALWAYS fetch from SystemConfig in code generation
- ✅ ALWAYS use useAffiliateConfig() hook in frontend
- ✅ Cache config endpoint for 5 minutes to reduce DB load
- ✅ Provide fallback values if config query fails

---

## 14. PAYMENT GATEWAY ARCHITECTURE (DUAL PROVIDERS)

### 14.1 Single Subscription Model

**Rule:** Use ONE `Subscription` model for both Stripe and dLocal. The `paymentProvider` field distinguishes behavior.

**Why this matters:** Prevents data duplication, simplifies tier validation logic, and ensures consistent subscription status checks across the application.

**Database Schema:**

```prisma
model Subscription {
  id                     String   @id @default(cuid())
  userId                 String   @unique  // One subscription per user

  // Payment Provider (required)
  paymentProvider        String   // "STRIPE" or "DLOCAL"

  // Stripe fields (nullable for dLocal)
  stripeCustomerId       String?  @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  // dLocal fields (nullable for Stripe)
  dLocalPaymentId        String?  @unique
  dLocalCountry          String?
  dLocalCurrency         String?
  dLocalAmount           Float?

  // Shared fields (both providers)
  planType               String   // "MONTHLY" or "THREE_DAY"
  amountUsd              Float    // USD amount (both providers)
  status                 String   // "active", "canceled", "expired"
  expiresAt              DateTime // Critical for dLocal

  // ... other fields
}
```

**Implementation Pattern:**

```typescript
// ✅ GOOD - Single unified function for both providers
export async function getSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return { tier: 'FREE', status: 'none' };
  }

  // Provider-specific logic based on paymentProvider field
  if (subscription.paymentProvider === 'STRIPE') {
    // Check Stripe API for real-time status
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );
    return {
      tier: stripeSubscription.status === 'active' ? 'PRO' : 'FREE',
      provider: 'STRIPE',
      autoRenew: true,
    };
  } else {
    // dLocal: Check expiresAt field
    const now = new Date();
    return {
      tier: now < subscription.expiresAt ? 'PRO' : 'FREE',
      provider: 'DLOCAL',
      autoRenew: false,
      canRenew: true,
    };
  }
}

// ❌ BAD - Separate models or tables for each provider
// DON'T create StripeSubscription and DLocalSubscription models
```

---

### 14.2 Provider-Specific Logic Isolation

**Rule:** Isolate provider-specific logic in separate modules. Use strategy pattern for checkout, renewal, and cancellation.

**Why this matters:** Keeps code maintainable. Adding a third payment provider (e.g., PayPal) only requires creating a new strategy, not modifying existing code.

**Directory Structure:**

```
lib/
├── payments/
│   ├── stripe-client.ts       # Stripe SDK wrapper
│   ├── dlocal-client.ts       # dLocal API wrapper
│   ├── currency-converter.ts  # USD ↔ Local currency
│   ├── fraud-detector.ts      # Fraud detection logic
│   └── subscription-manager.ts # Unified subscription API
```

**Strategy Pattern:**

```typescript
// lib/payments/subscription-manager.ts

interface PaymentProvider {
  createCheckoutSession(
    userId: string,
    plan: PlanType
  ): Promise<CheckoutSession>;
  processPaymentCallback(data: unknown): Promise<Subscription>;
  renewSubscription(subscriptionId: string): Promise<Subscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
}

class StripeProvider implements PaymentProvider {
  async createCheckoutSession(userId: string, plan: PlanType) {
    // Stripe-specific logic
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: STRIPE_PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7, // Stripe has trial
      },
    });
    return session;
  }

  // ... other methods
}

class DLocalProvider implements PaymentProvider {
  async createCheckoutSession(userId: string, plan: PlanType) {
    // dLocal-specific logic
    const { country, currency } = await getUserCountry(userId);
    const { amount, rate } = await convertUsdToLocal(PLANS[plan].usd, currency);

    const payment = await dlocal.createPayment({
      amount,
      currency,
      country,
      // dLocal has NO trial period
    });
    return payment;
  }

  // ... other methods
}

// Factory function
export function getPaymentProvider(
  provider: 'STRIPE' | 'DLOCAL'
): PaymentProvider {
  return provider === 'STRIPE' ? new StripeProvider() : new DLocalProvider();
}

// Usage in API routes
export async function POST(req: NextRequest) {
  const { provider, plan } = await req.json();
  const paymentProvider = getPaymentProvider(provider);
  const session = await paymentProvider.createCheckoutSession(userId, plan);
  return NextResponse.json(session);
}
```

**Critical:** NEVER mix provider-specific logic in shared functions.

---

### 14.3 Early Renewal Support (dLocal Only)

**Rule:** dLocal monthly subscriptions support early renewal with day stacking. Stripe does NOT support this (auto-renews automatically).

**Why this matters:** dLocal does NOT auto-renew. Users must manually renew before expiry. Early renewal allows users to renew without losing remaining days.

**Implementation:**

```typescript
// app/api/payments/dlocal/renew/route.ts

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id }
  });

  // ✅ Only allow early renewal for dLocal monthly subscriptions
  if (subscription.paymentProvider !== 'DLOCAL') {
    return NextResponse.json({
      error: 'Stripe subscriptions auto-renew. No manual renewal needed.'
    }, { status: 400 });
  }

  if (subscription.planType === 'THREE_DAY') {
    return NextResponse.json({
      error: '3-day plan cannot be renewed. Purchase monthly plan instead.'
    }, { status: 400 });
  }

  // Calculate stacking
  const now = new Date();
  const expiresAt = new Date(subscription.expiresAt);
  const remainingDays = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // New expiry = current expiry + 30 days (stacks on top)
  const newExpiresAt = new Date(expiresAt);
  newExpiresAt.setDate(newExpiresAt.getDate() + 30);

  // Process payment
  const payment = await dlocal.createPayment({...});

  if (payment.status === 'completed') {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        expiresAt: newExpiresAt,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: `Renewed! ${remainingDays} remaining days + 30 new days = ${remainingDays + 30} total`,
      expiresAt: newExpiresAt
    });
  }
}
```

**Critical Rules:**

- ✅ dLocal monthly: Early renewal allowed, stacks days
- ✅ dLocal 3-day: NO renewal allowed (one-time use)
- ❌ Stripe: NO manual renewal (auto-renews via Stripe)

---

### 14.4 Currency Conversion Rules

**Rule:** Currency conversion ONLY applies to dLocal. Stripe always uses USD. Store both local currency amount AND USD equivalent.

**Why this matters:** Reporting and analytics need USD values for consistency. Exchange rates fluctuate, so we store the rate used at time of payment.

**Implementation:**

```typescript
// lib/payments/currency-converter.ts

export async function convertUsdToLocal(
  amountUsd: number,
  targetCurrency: string
): Promise<{ amount: number; rate: number }> {
  // Fetch real-time rate from exchange rate API
  const rate = await fetchExchangeRate('USD', targetCurrency);

  // Convert and round
  const localAmount = Math.round(amountUsd * rate * 100) / 100;

  return { amount: localAmount, rate };
}

// Usage in checkout
export async function POST(req: NextRequest) {
  const { country, planType } = await req.json();

  const usdPrice = planType === 'MONTHLY' ? 29.0 : 0.96;
  const currency = COUNTRY_CURRENCIES[country]; // IN → INR

  if (currency !== 'USD') {
    const { amount, rate } = await convertUsdToLocal(usdPrice, currency);

    // Store BOTH amounts
    const payment = await prisma.payment.create({
      data: {
        provider: 'DLOCAL',
        amount: amount, // ✅ Local currency amount (e.g., 2407.00 INR)
        currency: currency, // ✅ Local currency code (e.g., "INR")
        amountUsd: usdPrice, // ✅ USD equivalent (e.g., 29.00)
        exchangeRate: rate, // ✅ Rate used (e.g., 83.00)
        // ...
      },
    });
  }
}
```

**Critical Rules:**

- ✅ Stripe: Always USD, no conversion needed
- ✅ dLocal: Convert USD → local currency at checkout time
- ✅ Store BOTH `amount` (local) and `amountUsd` (USD) for all payments
- ✅ Store exchange rate used for audit trail
- ❌ NEVER convert for Stripe payments
- ❌ NEVER use hardcoded exchange rates (always fetch real-time)

---

### 14.5 3-Day Plan Anti-Abuse Protection

**Rule:** 3-day plan (dLocal only) can be purchased ONCE per account. Enforce via database constraint and application logic.

**Why this matters:** Prevents abuse where users create multiple accounts to repeatedly purchase cheap 3-day access.

**Database Schema:**

```prisma
model User {
  id                  String   @id @default(cuid())
  email               String   @unique

  // 3-day plan tracking
  hasUsedThreeDayPlan Boolean  @default(false)
  threeDayPlanUsedAt  DateTime?

  // Fraud detection
  lastLoginIP         String?
  deviceFingerprint   String?
}
```

**Implementation:**

```typescript
// app/api/payments/dlocal/checkout/route.ts

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const { planType, country, currency } = await req.json();

  if (planType === 'THREE_DAY') {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    // ✅ Check if already used
    if (user.hasUsedThreeDayPlan) {
      // Create fraud alert
      await prisma.fraudAlert.create({
        data: {
          userId: user.id,
          alertType: '3DAY_PLAN_REUSE',
          severity: 'MEDIUM',
          description: 'User attempted to purchase 3-day plan more than once',
          ipAddress: req.headers.get('x-forwarded-for'),
          deviceFingerprint: req.headers.get('x-device-fingerprint'),
        },
      });

      return NextResponse.json(
        {
          error:
            'The 3-day plan can only be purchased once per account. Please upgrade to monthly plan.',
          errorCode: '3DAY_PLAN_ALREADY_USED',
        },
        { status: 403 }
      );
    }

    // ✅ Check for active subscription
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'active',
        expiresAt: { gte: new Date() },
      },
    });

    if (activeSubscription) {
      return NextResponse.json(
        {
          error:
            'Cannot purchase 3-day plan while you have an active subscription',
          errorCode: 'ACTIVE_SUBSCRIPTION_EXISTS',
        },
        { status: 403 }
      );
    }

    // ✅ All checks passed, process payment
    // After payment success:
    await prisma.user.update({
      where: { id: user.id },
      data: {
        hasUsedThreeDayPlan: true,
        threeDayPlanUsedAt: new Date(),
      },
    });
  }
}
```

**Critical Rules:**

- ✅ Check `hasUsedThreeDayPlan` before allowing purchase
- ✅ Create `FraudAlert` if reuse attempt detected
- ✅ Block 3-day purchase if active subscription exists
- ✅ Mark `hasUsedThreeDayPlan = true` after successful payment
- ❌ NEVER allow multiple 3-day purchases per account
- ❌ NEVER skip fraud alert creation on abuse attempts

---

### 14.6 Fraud Detection Integration

**Rule:** All payment operations must trigger fraud detection checks. Create `FraudAlert` records for suspicious activity.

**Why this matters:** dLocal 3-day plan is cheap ($0.96 USD), making it attractive for abuse. Fraud detection prevents revenue loss and chargebacks.

**Fraud Patterns:**

```typescript
// lib/payments/fraud-detector.ts

export async function detectFraud(
  userId: string,
  context: FraudContext
): Promise<FraudAlert | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      fraudAlerts: { where: { resolution: null } },
    },
  });

  // Pattern 1: Multiple failed payments in short time
  const recentFailedPayments = user.payments.filter(
    (p) =>
      p.status === 'failed' &&
      p.createdAt > new Date(Date.now() - 60 * 60 * 1000)
  );
  if (recentFailedPayments.length >= 3) {
    return createFraudAlert(userId, {
      alertType: 'MULTIPLE_FAILED_PAYMENTS',
      severity: 'HIGH',
      description: `${recentFailedPayments.length} failed payments in last hour`,
    });
  }

  // Pattern 2: IP address + device fingerprint mismatch
  if (user.lastLoginIP && user.lastLoginIP !== context.ipAddress) {
    if (
      user.deviceFingerprint &&
      user.deviceFingerprint !== context.deviceFingerprint
    ) {
      return createFraudAlert(userId, {
        alertType: 'SUSPICIOUS_IP_CHANGE',
        severity: 'MEDIUM',
        description: 'IP and device fingerprint both changed',
      });
    }
  }

  // Pattern 3: 3-day plan reuse attempt (already handled in checkout)

  // Pattern 4: Rapid account creation from same IP
  // ... additional patterns

  return null;
}
```

**Admin Dashboard:**

```typescript
// app/admin/fraud-alerts/page.tsx
export default async function FraudAlertsPage() {
  const alerts = await prisma.fraudAlert.findMany({
    where: { resolution: null },
    include: {
      user: {
        select: {
          email: true,
          createdAt: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 5 }
        }
      }
    },
    orderBy: [
      { severity: 'desc' },
      { detectedAt: 'desc' }
    ]
  });

  return (
    <div>
      <h1>Fraud Alerts</h1>
      {alerts.map(alert => (
        <FraudAlertCard
          key={alert.id}
          alert={alert}
          onResolve={async (resolution, notes) => {
            await fetch(`/api/admin/fraud-alerts/${alert.id}/resolve`, {
              method: 'POST',
              body: JSON.stringify({ resolution, notes })
            });
          }}
        />
      ))}
    </div>
  );
}
```

**Critical Rules:**

- ✅ Create `FraudAlert` for ALL suspicious activity
- ✅ Include context: ipAddress, deviceFingerprint, additionalData
- ✅ Admin must review and resolve ALL fraud alerts
- ✅ Block user if fraud confirmed (`User.isActive = false`)
- ❌ NEVER auto-block users (always require admin review)
- ❌ NEVER delete fraud alerts (keep for audit trail)

---

### 14.7 Payment Provider Selection by Country

**Rule:** Payment provider selection is based on user's country. dLocal countries get both options, others only Stripe.

**Why this matters:** dLocal only supports 8 emerging market countries. International users MUST use Stripe.

**Supported Countries:**

```typescript
// lib/payments/provider-selector.ts

export const DLOCAL_COUNTRIES = [
  'IN', // India
  'NG', // Nigeria
  'PK', // Pakistan
  'VN', // Vietnam
  'ID', // Indonesia
  'TH', // Thailand
  'ZA', // South Africa
  'TR', // Turkey
] as const;

export const COUNTRY_CURRENCIES: Record<string, string> = {
  IN: 'INR',
  NG: 'NGN',
  PK: 'PKR',
  VN: 'VND',
  ID: 'IDR',
  TH: 'THB',
  ZA: 'ZAR',
  TR: 'TRY',
  // All other countries default to USD (Stripe)
};

export function getAvailableProviders(countryCode: string): PaymentProvider[] {
  if (DLOCAL_COUNTRIES.includes(countryCode as any)) {
    return ['STRIPE', 'DLOCAL']; // Both options
  } else {
    return ['STRIPE']; // Only Stripe for international
  }
}

export function getCurrency(countryCode: string): string {
  return COUNTRY_CURRENCIES[countryCode] || 'USD';
}

export function getLocalizedPrice(
  planType: 'MONTHLY' | 'THREE_DAY',
  country: string
): { amount: number; currency: string; display: string } {
  const usdPrice = planType === 'MONTHLY' ? 29.0 : 0.96;
  const currency = getCurrency(country);

  if (currency === 'USD') {
    return {
      amount: usdPrice,
      currency: 'USD',
      display: `$${usdPrice}`,
    };
  }

  // Fetch real-time conversion for dLocal countries
  const { amount, rate } = await convertUsdToLocal(usdPrice, currency);

  const symbols: Record<string, string> = {
    INR: '₹',
    NGN: '₦',
    PKR: '₨',
    VND: '₫',
    IDR: 'Rp',
    THB: '฿',
    ZAR: 'R',
    TRY: '₺',
  };

  return {
    amount,
    currency,
    display: `${symbols[currency] || ''}${amount.toLocaleString()}`,
  };
}
```

**Frontend Usage:**

```typescript
// components/payments/payment-provider-selector.tsx
'use client';

import { useEffect, useState } from 'react';
import { getAvailableProviders, getLocalizedPrice } from '@/lib/payments/provider-selector';

export function PaymentProviderSelector({ country }: { country: string }) {
  const providers = getAvailableProviders(country);
  const [selectedProvider, setSelectedProvider] = useState<'STRIPE' | 'DLOCAL'>('STRIPE');

  const monthlyPrice = getLocalizedPrice('MONTHLY', country);
  const threeDayPrice = getLocalizedPrice('THREE_DAY', country);

  return (
    <div>
      <h2>Choose Payment Method</h2>

      {providers.includes('STRIPE') && (
        <div onClick={() => setSelectedProvider('STRIPE')}>
          <h3>International Cards (Stripe)</h3>
          <p>Visa, Mastercard, Amex</p>
          <p>Monthly: ${monthlyPrice.display} USD</p>
          <p>✅ 7-day free trial</p>
          <p>✅ Auto-renewal</p>
        </div>
      )}

      {providers.includes('DLOCAL') && (
        <div onClick={() => setSelectedProvider('DLOCAL')}>
          <h3>Local Payment Methods (dLocal)</h3>
          <p>UPI, NetBanking, Mobile Wallets</p>
          <p>3-day trial: {threeDayPrice.display}</p>
          <p>Monthly: {monthlyPrice.display}</p>
          <p>❌ No auto-renewal (manual)</p>
        </div>
      )}

      <button onClick={() => handleCheckout(selectedProvider)}>
        Continue
      </button>
    </div>
  );
}
```

**Critical Rules:**

- ✅ Detect user country via IP geolocation or registration form
- ✅ Show dLocal option ONLY for supported countries
- ✅ Show currency in local format (₹, ₦, ₨, etc.)
- ✅ Allow country change if geolocation wrong
- ❌ NEVER show dLocal for unsupported countries
- ❌ NEVER assume USD for all users

---

### 14.8 Subscription Expiry Handling

**Rule:** dLocal subscriptions require explicit expiry handling. Stripe handles this automatically via webhooks.

**Why this matters:** dLocal subscriptions do NOT auto-renew. System must check expiry daily and downgrade users to FREE tier.

**Implementation:**

```typescript
// Cron job: Runs daily at midnight UTC
// app/api/cron/check-expirations/route.ts

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  if (
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find dLocal subscriptions expiring soon or expired
  const expiringSubscriptions = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'DLOCAL',
      status: 'active',
      OR: [
        { expiresAt: { lt: now } }, // Already expired
        {
          expiresAt: { lt: addDays(now, 3) }, // Expires within 3 days
          renewalReminderSent: false,
        },
      ],
    },
    include: { user: true },
  });

  for (const subscription of expiringSubscriptions) {
    const daysUntilExpiry = Math.ceil(
      (subscription.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 0) {
      // ✅ Expired - downgrade to FREE
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'expired' },
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: { tier: 'FREE' },
        }),
      ]);

      await sendEmail(subscription.user.email, 'Subscription Expired', {
        message:
          'Your PRO subscription has expired. Renew now to regain access.',
        renewUrl: 'https://app.com/dashboard/billing',
      });
    } else if (daysUntilExpiry <= 3 && !subscription.renewalReminderSent) {
      // ✅ Expiring soon - send reminder
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { renewalReminderSent: true },
      });

      await sendEmail(subscription.user.email, 'Subscription Expiring Soon', {
        message: `Your PRO subscription expires in ${daysUntilExpiry} days. Renew now to avoid interruption.`,
        renewUrl: 'https://app.com/dashboard/billing',
      });
    }
  }

  return NextResponse.json({ checked: expiringSubscriptions.length });
}
```

**Vercel Cron Configuration:**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-expirations",
      "schedule": "0 0 * * *" // Daily at midnight UTC
    }
  ]
}
```

**Critical Rules:**

- ✅ Run expiry check daily (midnight UTC)
- ✅ Send reminder 3 days before expiry
- ✅ Downgrade to FREE tier immediately when expired
- ✅ Mark `renewalReminderSent = true` after sending
- ❌ Stripe subscriptions: DO NOT check manually (webhooks handle it)
- ❌ NEVER downgrade active Stripe subscriptions

---

### 14.9 Stripe Trial Anti-Abuse (No Card Required)

**Rule:** Stripe 7-day trials do NOT require a credit card upfront (maximizes conversion ~40-60%). Use multi-signal fraud detection to prevent repeat trial abuse.

**Why this matters:** Requiring a card upfront kills conversion rates (drops to ~5-10%). Multi-signal detection maintains high conversion while preventing abuse through IP tracking, device fingerprinting, email pattern detection, and signup velocity monitoring.

**User Model Updates:**

```prisma
model User {
  // ... existing fields ...

  // Stripe trial tracking
  hasUsedStripeTrial  Boolean  @default(false)
  stripeTrialStartedAt DateTime?

  // Multi-signal fraud detection
  signupIP            String?    // IP address at registration
  lastLoginIP         String?    // Most recent login IP
  deviceFingerprint   String?    // Browser fingerprint from client

  fraudAlerts         FraudAlert[]
}
```

**Fraud Detection Patterns:**

1. **IP-Based Detection (HIGH Severity)**
   - Same IP used for ≥3 trial accounts in 30 days
   - Indicates VPN rotation or shared network abuse

2. **Device Fingerprint Detection (HIGH Severity)**
   - Same device fingerprint for ≥2 trial accounts in 30 days
   - Indicates user creating multiple accounts on same device

3. **Disposable Email Detection (MEDIUM Severity)**
   - Email matches known temporary email domains
   - Common patterns: `@mailinator.com`, `@10minutemail.com`, etc.

4. **Rapid Signup Detection (HIGH Severity)**
   - ≥5 account creations from same IP within 1 hour
   - Indicates automated bot attacks

**Registration Flow with Fraud Detection:**

```typescript
// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { detectTrialAbuse } from '@/lib/fraud-detection';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const validated = signupSchema.parse(body);

    // Extract fraud detection signals
    const signupIP =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.ip ||
      null;
    const deviceFingerprint = req.headers.get('x-device-fingerprint') || null;

    // ✅ Check for trial abuse BEFORE creating account
    const fraudCheck = await detectTrialAbuse({
      email: validated.email,
      signupIP,
      deviceFingerprint,
    });

    if (fraudCheck) {
      // Create FraudAlert for admin review
      await prisma.fraudAlert.create({
        data: {
          userId: null, // No user created yet
          alertType: fraudCheck.type,
          severity: fraudCheck.severity,
          description: fraudCheck.description,
          detectedAt: new Date(),
          ipAddress: signupIP,
          deviceFingerprint,
          additionalData: {
            email: validated.email,
            blockedAtRegistration: fraudCheck.severity === 'HIGH',
          },
        },
      });

      // ❌ Block HIGH severity attempts immediately
      if (fraudCheck.severity === 'HIGH') {
        return NextResponse.json(
          {
            error:
              'Unable to create account at this time. Please contact support if you believe this is an error.',
            errorCode: 'REGISTRATION_BLOCKED',
          },
          { status: 403 }
        );
      }

      // ⚠️ Allow MEDIUM severity but flag for admin review
      // Continue with account creation below
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);

    // Create user with fraud detection fields
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        password: hashedPassword,
        name: validated.name,
        tier: 'FREE',
        hasUsedStripeTrial: false,
        signupIP,
        lastLoginIP: signupIP,
        deviceFingerprint,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    console.error('User registration failed:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

**Fraud Detection Utility:**

```typescript
// lib/fraud-detection.ts
import { prisma } from '@/lib/prisma';

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'maildrop.cc',
];

interface FraudCheckContext {
  email: string;
  signupIP: string | null;
  deviceFingerprint: string | null;
}

interface FraudCheckResult {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export async function detectTrialAbuse(
  context: FraudCheckContext
): Promise<FraudCheckResult | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Pattern 1: IP-based abuse (≥3 trials from same IP in 30 days)
  if (context.signupIP) {
    const recentTrialsFromIP = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentTrialsFromIP >= 3) {
      return {
        type: 'STRIPE_TRIAL_IP_ABUSE',
        severity: 'HIGH',
        description: `IP address ${context.signupIP} used for ${recentTrialsFromIP} trial accounts in past 30 days`,
      };
    }
  }

  // Pattern 2: Device fingerprint abuse (≥2 trials from same device in 30 days)
  if (context.deviceFingerprint) {
    const recentTrialsFromDevice = await prisma.user.count({
      where: {
        deviceFingerprint: context.deviceFingerprint,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });

    if (recentTrialsFromDevice >= 2) {
      return {
        type: 'STRIPE_TRIAL_DEVICE_ABUSE',
        severity: 'HIGH',
        description: `Device fingerprint used for ${recentTrialsFromDevice} trial accounts in past 30 days`,
      };
    }
  }

  // Pattern 3: Disposable email domain
  const emailDomain = context.email.split('@')[1].toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.includes(emailDomain)) {
    return {
      type: 'DISPOSABLE_EMAIL_DETECTED',
      severity: 'MEDIUM',
      description: `Registration using disposable email domain: ${emailDomain}`,
    };
  }

  // Pattern 4: Rapid signup velocity (≥5 accounts from same IP in 1 hour)
  if (context.signupIP) {
    const rapidSignups = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (rapidSignups >= 5) {
      return {
        type: 'RAPID_SIGNUP_VELOCITY',
        severity: 'HIGH',
        description: `${rapidSignups} accounts created from IP ${context.signupIP} in past hour (bot attack)`,
      };
    }
  }

  return null; // No fraud detected
}
```

**Trial Start Endpoint (No Card Required):**

```typescript
// app/api/payments/stripe/start-trial/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Check if user already used their trial
    if (session.user.hasUsedStripeTrial) {
      return NextResponse.json(
        {
          error:
            'You have already used your free trial. Please subscribe to continue.',
          errorCode: 'TRIAL_ALREADY_USED',
        },
        { status: 403 }
      );
    }

    // Calculate trial end date (7 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    // ✅ Grant PRO tier for 7 days WITHOUT payment method
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          tier: 'PRO',
          hasUsedStripeTrial: true,
          stripeTrialStartedAt: new Date(),
        },
      }),
      prisma.subscription.create({
        data: {
          userId: session.user.id,
          paymentProvider: 'STRIPE',
          planType: 'MONTHLY',
          status: 'trialing',
          expiresAt: trialEndDate,
          amountUsd: 0, // Free trial
        },
      }),
    ]);

    return NextResponse.json(
      {
        message: 'Trial started successfully',
        trialEndsAt: trialEndDate.toISOString(),
        tier: 'PRO',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Trial start failed:', error);
    return NextResponse.json(
      { error: 'Failed to start trial' },
      { status: 500 }
    );
  }
}
```

**Trial Expiry Handler (Cron Job):**

```typescript
// app/api/cron/stripe-trial-expiry/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Verify Vercel Cron secret
  if (
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Find Stripe trials that have expired
  const expiredTrials = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'STRIPE',
      status: 'trialing',
      expiresAt: { lt: now },
    },
    include: { user: true },
  });

  for (const subscription of expiredTrials) {
    // Check if user converted to paid subscription
    const paidSubscription = await prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        paymentProvider: 'STRIPE',
        status: 'active',
        stripeSubscriptionId: { not: null }, // Has paid subscription
      },
    });

    if (paidSubscription) {
      // User converted - delete trial subscription
      await prisma.subscription.delete({
        where: { id: subscription.id },
      });
    } else {
      // User did NOT convert - downgrade to FREE
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'expired' },
        }),
        prisma.user.update({
          where: { id: subscription.userId },
          data: { tier: 'FREE' },
        }),
      ]);

      // Send trial expiry email
      await sendEmail(subscription.user.email, 'Trial Expired', {
        message:
          'Your 7-day PRO trial has ended. Subscribe now to continue enjoying PRO features!',
        ctaUrl: 'https://app.com/dashboard/billing',
      });
    }
  }

  return NextResponse.json({
    checked: expiredTrials.length,
    message: 'Trial expiry check completed',
  });
}
```

**Vercel Cron Configuration:**

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/stripe-trial-expiry",
      "schedule": "0 */6 * * *" // Every 6 hours
    },
    {
      "path": "/api/cron/check-expirations",
      "schedule": "0 0 * * *" // Daily (dLocal subscriptions)
    }
  ]
}
```

**Client-Side Device Fingerprinting:**

```typescript
// lib/fingerprint.ts (Client-side)
export function generateDeviceFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage
  ]

  const fingerprint = components.join('|')

  // Create hash using SubtleCrypto API
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint))
    .then(hash => Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    )
}

// Usage in registration form
// app/auth/register/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { generateDeviceFingerprint } from '@/lib/fingerprint'

export default function RegisterPage() {
  const [fingerprint, setFingerprint] = useState<string>('')

  useEffect(() => {
    generateDeviceFingerprint().then(setFingerprint)
  }, [])

  const handleSubmit = async (formData) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': fingerprint  // Send to server
      },
      body: JSON.stringify(formData)
    })
    // ... handle response
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Registration form fields */}
    </form>
  )
}
```

**Admin Fraud Alert Dashboard:**

```typescript
// app/api/admin/fraud-alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  // TODO: Verify admin role
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const severity = searchParams.get('severity') as
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | null;
  const reviewed = searchParams.get('reviewed') === 'true';

  const alerts = await prisma.fraudAlert.findMany({
    where: {
      ...(severity && { severity }),
      ...(reviewed !== null && {
        reviewedBy: reviewed ? { not: null } : null,
      }),
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          hasUsedStripeTrial: true,
        },
      },
    },
    orderBy: { detectedAt: 'desc' },
    take: 100,
  });

  return NextResponse.json(alerts);
}

// Mark fraud alert as reviewed
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession();

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { alertId, resolution, notes } = await req.json();

  const alert = await prisma.fraudAlert.update({
    where: { id: alertId },
    data: {
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
      resolution,
      notes,
    },
  });

  return NextResponse.json(alert);
}
```

**Critical Rules:**

- ✅ NO credit card required for trial start (maximizes conversion)
- ✅ Capture IP + device fingerprint at registration
- ✅ Check for fraud patterns BEFORE creating account
- ✅ Block HIGH severity attempts immediately
- ✅ Allow MEDIUM severity but create FraudAlert for admin review
- ✅ Mark `hasUsedStripeTrial = true` when trial starts
- ✅ Run trial expiry check every 6 hours (not daily like dLocal)
- ✅ Downgrade to FREE when trial expires without conversion
- ✅ Send trial expiry email with CTA to subscribe
- ✅ Use client-side fingerprinting (not server-side)
- ❌ NEVER require payment method for trial
- ❌ NEVER allow user to start trial twice (check hasUsedStripeTrial)
- ❌ NEVER auto-block users without admin review (create FraudAlert instead)
- ❌ NEVER skip fraud detection at registration
- ❌ NEVER use simple patterns (email-only checks are insufficient)

**Fraud Detection Effectiveness:**

- **Conversion Rate:** ~40-60% (vs ~5-10% with card requirement)
- **Abuse Detection:** 4 independent fraud signals
- **False Positive Rate:** <5% (admin review for all blocks)
- **Admin Overhead:** ~2-5 alerts per day (manageable)

---

### 14.10 Admin Fraud Management Actions

**Rule:** Admins must have comprehensive enforcement capabilities to manage fraud alerts beyond just reviewing them.

**Why this matters:** Detection without action is useless. Admins need tools to block abusers, warn users, whitelist trusted users, and maintain audit trails.

**Available Admin Actions:**

1. **DISMISS (False Positive)** - Alert was incorrect, no enforcement needed
2. **SEND_WARNING** - Email user about suspicious activity (soft warning)
3. **BLOCK_ACCOUNT (Temporary/Permanent)** - Disable user account and downgrade to FREE
4. **UNBLOCK_ACCOUNT** - Restore previously blocked user
5. **WHITELIST_USER** - Mark user as trusted (future fraud checks bypass)

**Admin Enforcement Endpoint:**

```typescript
// app/api/admin/fraud-alerts/[id]/actions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

type AdminAction =
  | 'DISMISS'
  | 'SEND_WARNING'
  | 'BLOCK_ACCOUNT'
  | 'UNBLOCK_ACCOUNT'
  | 'WHITELIST_USER';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // ✅ Verify admin role
  const session = await getServerSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { action, notes, blockDuration } = await req.json();

  const alert = await prisma.fraudAlert.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  switch (action) {
    case 'BLOCK_ACCOUNT':
      // ✅ Block user + downgrade tier + cancel subscriptions
      await prisma.$transaction([
        prisma.user.update({
          where: { id: alert.userId },
          data: { isActive: false, tier: 'FREE' },
        }),
        prisma.subscription.updateMany({
          where: { userId: alert.userId, status: 'active' },
          data: { status: 'canceled' },
        }),
        prisma.fraudAlert.update({
          where: { id: params.id },
          data: {
            resolution:
              blockDuration === 'PERMANENT'
                ? 'BLOCKED_PERMANENT'
                : 'BLOCKED_TEMPORARY',
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            notes: `${blockDuration} block. Reason: ${notes}`,
          },
        }),
      ]);

      // ✅ Send email notification
      await sendEmail(alert.user.email, 'Account Suspended', {
        subject: '🚫 Your account has been suspended',
        html: `Account suspended. Reason: ${notes}. Duration: ${blockDuration}.`,
      });

      return NextResponse.json({
        success: true,
        message: `Account blocked (${blockDuration})`,
      });

    case 'SEND_WARNING':
      // ✅ Email warning + update fraud alert
      await prisma.fraudAlert.update({
        where: { id: params.id },
        data: {
          resolution: 'WARNING_SENT',
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          notes,
        },
      });

      await sendEmail(alert.user.email, 'Security Alert', {
        subject: '⚠️ Suspicious activity detected',
        html: `We detected: ${alert.description}. Action required: ${notes}.`,
      });

      return NextResponse.json({
        success: true,
        message: 'Warning email sent',
      });

    // ... other actions (DISMISS, UNBLOCK_ACCOUNT, WHITELIST_USER)
  }
}
```

**Admin Dashboard UI Requirements:**

- **Filters:** Status (pending/resolved), Severity (HIGH/MEDIUM/LOW), Date range
- **Alert Details:** User info, fraud type, IP/device data, trial usage history
- **Action Buttons:** Dismiss, Send Warning, Block (Temp), Block (Perm), Whitelist
- **Confirmation Dialogs:** Required for destructive actions (blocking)
- **Notes Field:** Mandatory for all actions (audit trail)
- **Real-time Updates:** Alerts refresh after action taken

**Critical Rules:**

- ✅ Verify admin role before ANY action (check `session.user.role === 'ADMIN'`)
- ✅ Block action must downgrade user to FREE tier AND cancel subscriptions
- ✅ Send email notification for EVERY enforcement action (warning/block/unblock)
- ✅ Require admin notes for audit trail (notes field mandatory)
- ✅ Update FraudAlert.resolution field with specific resolution type
- ✅ Log admin who performed action (reviewedBy + reviewedAt)
- ✅ Confirmation dialog required for BLOCK_ACCOUNT action
- ❌ NEVER allow user to appeal via UI (must contact support)
- ❌ NEVER skip email notification (user must know why they're blocked)
- ❌ NEVER allow blocking without notes (audit trail essential)

**Enforcement Impact:**

| Action              | User Impact                 | Database Changes                                        | Email Sent |
| ------------------- | --------------------------- | ------------------------------------------------------- | ---------- |
| **DISMISS**         | None                        | FraudAlert.resolution = 'FALSE_POSITIVE'                | No         |
| **SEND_WARNING**    | Warning email received      | FraudAlert.resolution = 'WARNING_SENT'                  | Yes        |
| **BLOCK_ACCOUNT**   | Login disabled, tier = FREE | User.isActive = false, Subscription.status = 'canceled' | Yes        |
| **UNBLOCK_ACCOUNT** | Access restored             | User.isActive = true                                    | Yes        |
| **WHITELIST_USER**  | Future alerts bypassed      | FraudAlert.resolution = 'WHITELISTED'                   | No         |

**Admin Audit Trail:**

```prisma
model FraudAlert {
  // ... existing fields
  resolution        String?   // Resolution type
  reviewedBy        String?   // Admin user ID
  reviewedAt        DateTime? // When admin acted
  notes             String?   // Admin decision reasoning
}
```

**Email Templates:**

1. **Warning Email:**
   - Subject: "⚠️ Suspicious activity detected on your account"
   - Content: Alert type, description, admin notes, action required
   - CTA: "Contact support if this wasn't you"

2. **Block Email:**
   - Subject: "🚫 Your account has been suspended"
   - Content: Block reason, duration (temporary/permanent), support email
   - CTA: "Contact support@tradingalerts.com if you believe this is a mistake"

3. **Unblock Email:**
   - Subject: "✅ Your account has been restored"
   - Content: Account restored message, warning to follow terms of service
   - CTA: "Login to dashboard"

**Admin Metrics to Track:**

- Total fraud alerts created
- Alerts by severity (HIGH/MEDIUM/LOW)
- Resolution breakdown (dismissed/warned/blocked)
- Average admin review time
- Block rate (% of alerts resulting in blocks)
- False positive rate (dismissed alerts)

---

## Summary of Architecture Rules

✅ **DO:**

- Follow v5-structure-division.md for all file placements
- Use OpenAPI specs as source of truth for types
- Validate authentication + tier on all protected endpoints
- Use Prisma for all database operations
- Use Server Components by default, Client Components when needed
- Keep business logic in lib/, separate from UI
- Validate tiers on BOTH Next.js AND Flask services
- Use pre-approved dependencies
- Use separate JWT authentication for affiliates (AFFILIATE_JWT_SECRET)
- Validate affiliate codes before checkout (ACTIVE, not expired, not used)
- Create commissions via Stripe webhook only (prevents fraud)
- Use accounting-style reports (opening/closing balances)
- Generate codes with crypto.randomBytes (cryptographically secure)
- **Payment Providers:** Use single Subscription model with paymentProvider field
- **dLocal:** Store BOTH local currency amount AND USD equivalent
- **dLocal:** Convert USD to local currency at checkout time with real-time rates
- **dLocal:** Enforce 3-day plan one-time use with hasUsedThreeDayPlan flag
- **dLocal:** Create FraudAlert for all suspicious payment activity
- **dLocal:** Check subscription expiry daily (cron job at midnight UTC)
- **dLocal:** Support early renewal with day stacking for monthly plans
- **Stripe:** Allow Stripe to handle auto-renewal (do NOT manually check expiry)
- **Stripe Trial:** NO card required for 7-day trial (maximizes conversion ~40-60%)
- **Stripe Trial:** Use multi-signal fraud detection (IP, device, email, velocity)
- **Stripe Trial:** Check trial expiry every 6 hours (cron job)
- **Stripe Trial:** Capture signupIP + deviceFingerprint at registration
- **Stripe Trial:** Block HIGH severity fraud immediately, flag MEDIUM for admin review
- **Admin Fraud Actions:** Verify admin role before ANY enforcement action
- **Admin Fraud Actions:** Block user = downgrade to FREE + cancel subscriptions + send email
- **Admin Fraud Actions:** Require admin notes for ALL actions (audit trail)
- **Admin Fraud Actions:** Send email notification for warnings, blocks, and unblocks

❌ **DON'T:**

- Manually define types that exist in OpenAPI
- Skip tier validation on symbol/timeframe endpoints
- Use raw SQL (use Prisma instead)
- Import components in lib/ (separation of concerns)
- Call database directly from frontend
- Add new dependencies without approval
- Use 'use client' unnecessarily
- Reuse user authentication for affiliates
- Allow affiliates to generate their own codes
- Create commissions manually (only via webhook)
- Use predictable/sequential code formats
- **Payment Providers:** Create separate models for Stripe and dLocal subscriptions
- **dLocal:** Show dLocal option for unsupported countries
- **dLocal:** Use hardcoded exchange rates (always fetch real-time)
- **dLocal:** Allow multiple 3-day plan purchases per account
- **dLocal:** Skip fraud alert creation on abuse attempts
- **dLocal:** Auto-block users (always require admin review)
- **Stripe:** Implement manual renewal for Stripe subscriptions
- **Stripe:** Manually check Stripe subscription expiry (webhooks handle it)
- **Stripe Trial:** Require credit card for trial start (kills conversion rates)
- **Stripe Trial:** Allow users to start trial twice (check hasUsedStripeTrial flag)
- **Stripe Trial:** Skip fraud detection at registration
- **Stripe Trial:** Use single-signal detection (email-only checks are insufficient)
- **Admin Fraud Actions:** Allow non-admin users to perform enforcement actions
- **Admin Fraud Actions:** Block users without sending email notification
- **Admin Fraud Actions:** Skip admin notes (audit trail required)
- **Admin Fraud Actions:** Allow blocking without confirmation dialog

**Why these rules matter:** Consistent architecture makes the codebase navigable, maintainable, and secure. Following these patterns across all 289 files (including dual payment providers and affiliate system) ensures quality at scale.
