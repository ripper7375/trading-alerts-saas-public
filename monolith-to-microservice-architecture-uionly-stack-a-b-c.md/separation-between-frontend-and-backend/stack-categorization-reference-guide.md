# Stack Categorization Reference Guide

**Trading Alerts SaaS V7 - Microservice Architecture**

> **Purpose**: Definitive guide for categorizing files into FRONTEND, BACKEND, SHARING, or TEST stacks to ensure proper deployment separation between Vercel (Next.js) and Railway (Nest.js).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Categorization Rules](#core-categorization-rules)
3. [FRONTEND Stack](#frontend-stack)
4. [BACKEND Stack](#backend-stack)
5. [SHARING Stack](#sharing-stack)
6. [TEST Stack](#test-stack)
7. [Decision Trees](#decision-trees)
8. [Edge Cases & Special Patterns](#edge-cases--special-patterns)
9. [Common Mistakes](#common-mistakes)
10. [Validation Checklist](#validation-checklist)

---

## Architecture Overview

### Deployment Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Trading Alerts SaaS V7                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │   FRONTEND       │         │    BACKEND       │         │
│  │   (Next.js)      │◄───────►│   (Nest.js)      │         │
│  │   Deploy: Vercel │  Types  │   Deploy: Railway│         │
│  └──────────────────┘         └──────────────────┘         │
│          ▲                            ▲                     │
│          │                            │                     │
│          └────────────┬───────────────┘                     │
│                       │                                     │
│                  ┌────▼─────┐                               │
│                  │ SHARING  │                               │
│                  │ (Types)  │                               │
│                  └──────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

### Stack Definitions

| Stack        | Deployment | Purpose                | Key Characteristics                    |
| ------------ | ---------- | ---------------------- | -------------------------------------- |
| **FRONTEND** | Vercel     | UI + Edge Functions    | Next.js app, components, API routes    |
| **BACKEND**  | Railway    | Business Logic + DB    | Services, controllers, email rendering |
| **SHARING**  | Both       | Types + Config         | Interfaces, constants, build scripts   |
| **TEST**     | Neither    | Testing Infrastructure | E2E, integration tests, test utilities |

---

## Core Categorization Rules

### The Three Questions Method

When categorizing any file, ask these three questions in order:

```
1. WHERE is it deployed?
   └─► FRONTEND (Vercel) or BACKEND (Railway) or BOTH (Sharing) or NEITHER (Test)

2. WHAT does it do?
   └─► UI/Client logic → FRONTEND
   └─► Business/Server logic → BACKEND
   └─► Shared contracts → SHARING
   └─► Testing → TEST

3. WHAT does it depend on?
   └─► React/Next.js APIs → FRONTEND
   └─► Server-only APIs (fs, db) → BACKEND
   └─► Nothing specific → SHARING or TEST
```

### Priority Rules (Apply in Order)

1. **React Hooks Pattern**: `use-*.ts` anywhere → **FRONTEND** (highest priority)
2. **Test Files**: Tests follow their subject's stack
3. **Next.js API Routes**: `app/api/**/*.ts` → **FRONTEND** (edge functions)
4. **Server-Side Rendering**: Email templates → **BACKEND** (even if `.tsx`)
5. **Directory Convention**: Follow framework-specific directories
6. **File Extension**: Last resort (`.tsx` usually FRONTEND, but not always)

---

## FRONTEND Stack

### Deployment Target

**Vercel** - Next.js application with Edge Functions

### Primary Indicators

✅ **ALWAYS FRONTEND**:

- Files in `app/` directory (Next.js App Router)
- Files with `use-` prefix (React hooks)
- React components (`.tsx` in component directories)
- Client-side hooks and contexts
- Static assets and public files
- Next.js configuration

### Directory Patterns

```
FRONTEND/
├── app/                                    # Next.js App Router
│   ├── (routes)/                          # Route groups
│   │   ├── page.tsx                       # Pages
│   │   ├── layout.tsx                     # Layouts
│   │   ├── loading.tsx                    # Loading states
│   │   ├── error.tsx                      # Error boundaries
│   │   └── not-found.tsx                  # 404 pages
│   ├── api/                               # 🔥 API Routes (Edge Functions)
│   │   └── **/route.ts                    # ALL API routes
│   └── globals.css                        # Global styles
│
├── components/                             # React Components
│   ├── ui/                                # UI components
│   ├── forms/                             # Form components
│   ├── layouts/                           # Layout components
│   └── **/*.tsx                           # All components
│
├── hooks/                                  # React Hooks
│   └── use-*.ts                           # Custom hooks
│
├── context/                                # React Context
│   └── *-context.tsx                      # Context providers
│
├── lib/                                    # Frontend Utilities
│   ├── client/                            # Client-only code
│   ├── utils/client*.ts                   # Client utilities
│   └── **/use-*.ts                        # 🔥 React hooks anywhere
│
├── public/                                 # Static Assets
│   ├── images/                            # Images
│   ├── fonts/                             # Fonts
│   └── manifest.json                      # PWA manifest
│
├── styles/                                 # Styling
│   ├── globals.css                        # Global CSS
│   └── *.module.css                       # CSS modules
│
├── next.config.js                          # Next.js config
├── tailwind.config.ts                      # Tailwind config
├── postcss.config.js                       # PostCSS config
└── vercel.json                             # Vercel deployment config
```

### Test Files for FRONTEND

```
__tests__/
├── components/                             # Component tests
│   └── **/*.test.tsx                      # React component tests
│
├── hooks/                                  # Hook tests
│   └── **/*.test.ts                       # React hook tests
│
└── app/                                    # Page/Route tests
    └── **/*.test.tsx                      # Page component tests
```

### Special Cases

#### 1. Next.js API Routes (CRITICAL)

```typescript
// app/api/users/route.ts
// ✅ FRONTEND - This is a Vercel Edge Function
export async function GET(request: Request) {
  // Runs on Vercel Edge Network
}
```

**WHY?** Next.js API routes are part of the Next.js application bundle that deploys to Vercel. They are NOT separate backend services.

#### 2. React Hooks Anywhere

```typescript
// lib/websocket/use-mt5-websocket.ts
// ✅ FRONTEND - Hook pattern (use-*) overrides directory
export function useMT5WebSocket() {
  // React hook - can only run in React components
}
```

**WHY?** React hooks can only run in React components, regardless of file location.

#### 3. Server Components vs Client Components

```typescript
// app/dashboard/page.tsx
// ✅ FRONTEND - Both Server and Client Components are FRONTEND
export default async function DashboardPage() {
  // Next.js Server Component (runs on Vercel during SSR)
  const data = await fetchData();
  return <Dashboard data={data} />;
}

// components/chart.tsx
// ✅ FRONTEND - Client Component also FRONTEND
'use client';
export function Chart({ data }) {
  // Runs in browser
}
```

**WHY?** Both are part of the Next.js application, just different rendering strategies.

### Files to EXCLUDE from FRONTEND

❌ **Not FRONTEND**:

- Email templates (`emails/**/*.tsx`) → BACKEND
- Server-side utilities (`lib/server/**/*`) → BACKEND
- Database models (`prisma/**/*`) → BACKEND
- Business logic services → BACKEND
- Build scripts (`scripts/**/*`) → SHARING

---

## BACKEND Stack

### Deployment Target

**Railway** - Nest.js API server with business logic

### Primary Indicators

✅ **ALWAYS BACKEND**:

- Database operations (Prisma)
- Business logic services
- Server-side utilities
- Email rendering services
- Cron jobs and background workers
- Server-only dependencies (filesystem, etc.)

### Directory Patterns

```
BACKEND/
├── src/                                    # Nest.js Application
│   ├── modules/                           # Feature modules
│   │   └── **/*.module.ts                 # Nest.js modules
│   ├── controllers/                       # API Controllers
│   │   └── **/*.controller.ts             # HTTP endpoints
│   ├── services/                          # Business Logic
│   │   └── **/*.service.ts                # Services
│   ├── guards/                            # Auth Guards
│   │   └── **/*.guard.ts                  # Authentication
│   ├── interceptors/                      # Interceptors
│   │   └── **/*.interceptor.ts            # Request/Response
│   ├── pipes/                             # Validation Pipes
│   │   └── **/*.pipe.ts                   # Input validation
│   ├── filters/                           # Exception Filters
│   │   └── **/*.filter.ts                 # Error handling
│   ├── entities/                          # Database Entities
│   │   └── **/*.entity.ts                 # ORM entities
│   └── dto/                               # Data Transfer Objects
│       └── **/*.dto.ts                    # API contracts
│
├── prisma/                                 # Database ORM
│   ├── schema.prisma                      # Database schema
│   ├── seed.ts                            # Database seeding
│   └── migrations/                        # Database migrations
│       └── **/*.sql                       # Migration files
│
├── lib/                                    # Server Utilities
│   ├── server/                            # Server-only code
│   ├── db/                                # Database utilities
│   ├── auth/                              # Auth utilities
│   ├── email/                             # 🔥 Email service
│   ├── jobs/                              # Background jobs
│   ├── cron/                              # Cron utilities
│   └── **/*.ts                            # Server utilities (NOT use-*)
│
├── emails/                                 # 🔥 Email Templates
│   └── **/*.tsx                           # Server-side React rendering
│
└── nest-cli.json                           # Nest.js CLI config
```

### Test Files for BACKEND

```
__tests__/
├── lib/                                    # 🔥 Business Logic Tests
│   ├── admin/                             # Admin utilities
│   ├── affiliate/                         # Affiliate logic
│   ├── auth/                              # Auth logic
│   ├── cron/                              # Cron jobs
│   ├── db/                                # Database utilities
│   ├── email/                             # Email service
│   ├── stripe/                            # Payment integration
│   └── **/*.test.ts                       # All lib tests → BACKEND
│
└── api/                                    # API Integration Tests
    └── **/*.integration.test.ts           # Full API tests
```

### Special Cases

#### 1. Email Templates (CRITICAL)

```typescript
// emails/payment-confirmation.tsx
// ✅ BACKEND - Server-side rendering for emails
export function PaymentConfirmationEmail({ user, amount }) {
  // Rendered by email service on server
  return (
    <Html>
      <Body>...</Body>
    </Html>
  );
}
```

**WHY?** These `.tsx` files are rendered on the server by the email service (e.g., React Email), not in the browser. They use React syntax for convenience, but are server-side templates.

#### 2. Lib Directory Utilities

```typescript
// lib/stripe/stripe.ts
// ✅ BACKEND - Server-side payment logic
import Stripe from 'stripe';

export async function createPayment() {
  // Uses server-only Stripe secret key
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe.paymentIntents.create({...});
}
```

**WHY?** Uses server-only secrets and APIs.

#### 3. Prisma Database Layer

```typescript
// lib/db/prisma.ts
// ✅ BACKEND - Database client
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

**WHY?** Database operations are server-only.

### Files to EXCLUDE from BACKEND

❌ **Not BACKEND**:

- React hooks (`use-*.ts`) → FRONTEND
- React components in components/ → FRONTEND
- Next.js pages and layouts → FRONTEND
- Client-side utilities → FRONTEND
- Type definitions only → SHARING

---

## SHARING Stack

### Deployment Target

**Both** - Consumed by both FRONTEND and BACKEND

### Primary Indicators

✅ **ALWAYS SHARING**:

- TypeScript type definitions
- Shared interfaces and constants
- Enums used by both stacks
- Configuration that affects both
- Build scripts and tooling

### Directory Patterns

```
SHARING/
├── types/                                  # Type Definitions
│   ├── user.ts                            # User types
│   ├── alert.ts                           # Alert types
│   ├── subscription.ts                    # Subscription types
│   └── **/*.ts                            # All type files
│
├── interfaces/                             # Shared Interfaces
│   └── **/*.interface.ts                  # Interface definitions
│
├── constants/                              # Shared Constants
│   ├── api-routes.ts                      # API route constants
│   ├── tiers.ts                           # Tier constants
│   └── **/*.constants.ts                  # Constant definitions
│
├── enums/                                  # Enums
│   └── **/*.enum.ts                       # Enum definitions
│
├── shared/                                 # Shared Utilities
│   ├── validators/                        # Validation functions
│   └── formatters/                        # Format functions
│
├── scripts/                                # 🔥 Build Scripts
│   ├── verify-auth-config.js              # Config verification
│   ├── generate-types.js                  # Type generation
│   └── **/*.js                            # Build tooling
│
├── tsconfig.json                           # TypeScript config
├── .env.example                            # Environment template
└── package.json                            # Dependencies (monorepo)
```

### Special Cases

#### 1. Build and Configuration Scripts

```javascript
// scripts/verify-auth-config.js
// ✅ SHARING - Used by both stacks during build
module.exports = function verifyAuthConfig() {
  // Validates environment variables for both deployments
};
```

**WHY?** Build scripts are not deployed with either stack but are used by both during development and CI/CD.

#### 2. Type-Only Files

```typescript
// types/user.ts
// ✅ SHARING - Pure type definitions
export interface User {
  id: string;
  email: string;
  tier: 'FREE' | 'PRO';
}

export type UserRole = 'USER' | 'ADMIN' | 'AFFILIATE';
```

**WHY?** Type definitions are used by both FRONTEND (for type safety) and BACKEND (for validation and logic). They are erased at runtime (TypeScript), so no deployment target.

#### 3. API Route Constants

```typescript
// constants/api-routes.ts
// ✅ SHARING - Used by both to construct/match routes
export const API_ROUTES = {
  ALERTS: '/api/alerts',
  USER: '/api/user',
  SUBSCRIPTION: '/api/subscription',
} as const;
```

**WHY?** Frontend uses these to make API calls, backend might use them for route matching or documentation.

### Guidelines for SHARING

**DO Include**:

- Types that define contracts between frontend and backend
- Constants that need to stay in sync
- Validation schemas used by both (e.g., Zod schemas)
- Enum definitions
- Build and development scripts

**DON'T Include**:

- Implementation logic → Goes to FRONTEND or BACKEND
- React components → FRONTEND
- Database models → BACKEND
- Test utilities → TEST

---

## TEST Stack

### Deployment Target

**Neither** - Testing infrastructure only

### Primary Indicators

✅ **ALWAYS TEST**:

- End-to-end tests (cross-stack)
- Integration tests (multi-service)
- Test setup and utilities
- Test fixtures and mocks
- Framework-agnostic test infrastructure

### Directory Patterns

```
TEST/
└── __tests__/
    ├── e2e/                                # End-to-End Tests
    │   ├── user-registration.test.ts      # Full user flows
    │   ├── payment-flow.test.ts           # Payment flows
    │   └── **/*.test.ts                   # Cross-stack tests
    │
    ├── integration/                        # Integration Tests
    │   ├── api-client-workflow.test.ts    # Multi-API tests
    │   ├── auth-email-flow.test.ts        # Auth + Email tests
    │   └── **/*.test.ts                   # Multi-service tests
    │
    ├── helpers/                            # Test Utilities
    │   ├── setup.ts                       # Global setup
    │   ├── supertest-setup.ts             # HTTP test setup
    │   └── **/*.ts                        # Test helpers
    │
    └── fixtures/                           # Test Data
        └── **/*.json                      # Mock data
```

### Test Categorization Rules

#### Rule 1: Tests Follow Their Subject

Tests are categorized based on **what they test**, not where they live:

| What's Being Tested    | Test Category | Example                                   |
| ---------------------- | ------------- | ----------------------------------------- |
| React component        | FRONTEND      | `__tests__/components/Button.test.tsx`    |
| React hook             | FRONTEND      | `__tests__/hooks/use-auth.test.ts`        |
| Next.js API route      | FRONTEND      | `__tests__/api/users.test.ts`             |
| Business logic in lib/ | BACKEND       | `__tests__/lib/stripe/payments.test.ts`   |
| Email rendering        | BACKEND       | `__tests__/lib/email/templates.test.ts`   |
| Full user flow         | TEST          | `__tests__/e2e/checkout.test.ts`          |
| Multiple services      | TEST          | `__tests__/integration/auth-flow.test.ts` |

#### Rule 2: Stack-Specific Test Files

```typescript
// __tests__/api/users/route.test.ts
// ✅ FRONTEND - Tests Next.js API route endpoint
describe('GET /api/users', () => {
  it('returns user list', async () => {
    // Tests app/api/users/route.ts (FRONTEND)
  });
});

// __tests__/lib/auth/permissions.test.ts
// ✅ BACKEND - Tests business logic in lib/
describe('Permission Calculator', () => {
  it('calculates user permissions', () => {
    // Tests lib/auth/permissions.ts (BACKEND)
  });
});

// __tests__/e2e/user-registration.test.ts
// ✅ TEST - Tests full flow across both stacks
describe('User Registration E2E', () => {
  it('completes full registration', async () => {
    // Tests FRONTEND UI + FRONTEND API + BACKEND logic
  });
});
```

#### Rule 3: Test Infrastructure

Test setup, utilities, and framework-agnostic helpers → **TEST**

```typescript
// __tests__/helpers/supertest-setup.ts
// ✅ TEST - Framework setup for all tests
import request from 'supertest';

export function createTestClient() {
  return request(app);
}
```

### Special Cases

#### 1. Mock Files

```typescript
// __tests__/__mocks__/prisma.ts
// ✅ TEST - Mock for testing
export const prismaMock = {
  user: {
    findUnique: jest.fn(),
  },
};
```

**WHY?** Mocks are only for testing, not deployed.

#### 2. Test Fixtures

```json
// __tests__/fixtures/users.json
// ✅ TEST - Test data
[{ "id": "1", "email": "test@example.com" }]
```

**WHY?** Fixtures are test data, not application data.

---

## Decision Trees

### Decision Tree 1: File Categorization

```
START: Categorizing file: [filepath]
│
├─► Contains "use-" prefix?
│   └─► YES → FRONTEND (React Hook)
│
├─► In app/ directory?
│   ├─► app/api/ → FRONTEND (Next.js API Route)
│   └─► Other app/ → FRONTEND (Next.js Page/Layout)
│
├─► In emails/ or lib/email/templates/?
│   └─► YES → BACKEND (Server-side Email Template)
│
├─► In __tests__/?
│   ├─► e2e/ or integration/ → TEST
│   ├─► components/ or hooks/ → FRONTEND
│   ├─► api/ → FRONTEND (tests Next.js routes)
│   └─► lib/ → BACKEND (tests business logic)
│
├─► In types/, interfaces/, constants/, enums/?
│   └─► YES → SHARING (Type Definitions)
│
├─► In scripts/?
│   └─► YES → SHARING (Build Scripts)
│
├─► In components/, hooks/, context/?
│   └─► YES → FRONTEND (React Code)
│
├─► In lib/?
│   ├─► lib/client/ → FRONTEND
│   ├─► lib/server/ → BACKEND
│   └─► lib/**/*.ts (not use-*) → BACKEND
│
├─► In prisma/, src/, services/?
│   └─► YES → BACKEND (Server Code)
│
├─► Config file?
│   ├─► next.config.js, vercel.json → FRONTEND
│   ├─► nest-cli.json → BACKEND
│   └─► tsconfig.json, package.json → SHARING
│
└─► UNCLEAR → Review manually
```

### Decision Tree 2: .tsx File Categorization

```
START: File ends with .tsx
│
├─► In components/ directory?
│   └─► YES → FRONTEND
│
├─► In app/ directory?
│   └─► YES → FRONTEND
│
├─► In emails/ directory?
│   └─► YES → BACKEND (Email Template)
│
├─► In lib/email/templates/?
│   └─► YES → BACKEND (Email Template)
│
├─► In __tests__/components/?
│   └─► YES → FRONTEND (Component Test)
│
└─► DEFAULT → FRONTEND (React Component)
```

### Decision Tree 3: Test File Categorization

```
START: File in __tests__/ or ends with .test.ts/.spec.ts
│
├─► In __tests__/e2e/?
│   └─► YES → TEST
│
├─► In __tests__/integration/?
│   └─► YES → TEST
│
├─► In __tests__/helpers/ or __tests__/fixtures/?
│   └─► YES → TEST
│
├─► In __tests__/components/?
│   └─► YES → FRONTEND
│
├─► In __tests__/hooks/?
│   └─► YES → FRONTEND
│
├─► In __tests__/api/?
│   └─► YES → FRONTEND (tests Next.js API routes)
│
├─► In __tests__/lib/?
│   └─► YES → BACKEND (tests business logic)
│
└─► UNCLEAR → Follow subject (what's being tested)
```

---

## Edge Cases & Special Patterns

### Pattern 1: React Hook Detection

**Rule**: Any file matching `use-*.ts` or `use-*.tsx` → **FRONTEND**

```typescript
// ✅ FRONTEND - Anywhere with use- prefix
lib / websocket / use - mt5 - websocket.ts;
hooks / use - auth.ts;
components / dashboard / use - chart - data.ts;
```

**Why?** React hooks can ONLY run in React components, regardless of directory structure.

**Exceptions**: None - this rule has highest priority.

### Pattern 2: Email Templates

**Rule**: Files in `emails/` or `lib/email/templates/` → **BACKEND**

```typescript
// ✅ BACKEND - Email templates
emails / welcome.tsx;
emails / payment - confirmation.tsx;
lib / email / templates / affiliate / monthly - report.tsx;
```

**Why?** Even though they use `.tsx` (JSX syntax), these are rendered on the server by the email service, not in a browser.

**Implementation**:

```typescript
// BACKEND: lib/email/email.service.ts
import { render } from '@react-email/render';
import { WelcomeEmail } from '@/emails/welcome';

export async function sendWelcomeEmail(user: User) {
  const html = render(<WelcomeEmail user={user} />);
  await sendEmail({ to: user.email, html });
}
```

### Pattern 3: Next.js API Routes

**Rule**: Files matching `app/api/**/route.ts` → **FRONTEND**

```typescript
// ✅ FRONTEND - Next.js API Route (Edge Function)
// app/api/users/route.ts
export async function GET(request: Request) {
  return Response.json({ users: [] });
}
```

**Why?** Next.js API routes are edge functions that deploy with your Next.js app to Vercel's edge network. They are NOT a separate backend service.

**Tests**: Tests for API routes also go to FRONTEND

```typescript
// ✅ FRONTEND - Tests the Next.js API route
// __tests__/api/users.test.ts
describe('GET /api/users', () => {
  it('returns users', async () => {
    const response = await fetch('/api/users');
    expect(response.ok).toBe(true);
  });
});
```

### Pattern 4: Server vs Client Components

**Rule**: ALL Next.js components → **FRONTEND**, regardless of Server/Client

```typescript
// ✅ FRONTEND - Server Component
// app/dashboard/page.tsx
export default async function Dashboard() {
  const data = await fetchData(); // Runs on Vercel during SSR
  return <div>{data}</div>;
}

// ✅ FRONTEND - Client Component
// components/chart.tsx
'use client';
export function Chart({ data }) {
  const [state, setState] = useState(data); // Runs in browser
  return <canvas />;
}
```

**Why?** Both are part of Next.js rendering strategy. Server Components run during SSR on Vercel; Client Components hydrate in the browser. Both deploy together.

### Pattern 5: Lib Directory Split

**Rule**: `lib/` content depends on subdirectory and naming

```typescript
// ✅ FRONTEND
lib / client / utils.ts; // Explicitly client-side
lib / utils / client - helper.ts; // Contains "client"
lib / hooks / use - something.ts; // React hook pattern

// ✅ BACKEND
lib / server / utils.ts; // Explicitly server-side
lib / db / prisma.ts; // Database client
lib / auth / jwt.ts; // Auth logic
lib / email / service.ts; // Email service
lib / stripe / payments.ts; // Payment processing

// ✅ SHARING
lib / validators / zod.ts; // Validation schemas used by both
lib / constants / api - routes.ts; // Shared constants
```

**Decision Logic**:

1. Check for `client/` or `server/` subdirectory → Explicit
2. Check for `use-*` pattern → FRONTEND
3. Check for server-only dependencies (prisma, fs, etc.) → BACKEND
4. Check if only types/constants → SHARING
5. Default for `lib/**/*.ts` (excluding above) → BACKEND

### Pattern 6: Configuration Files

**Rule**: Configuration files categorized by what they configure

```javascript
// ✅ FRONTEND
next.config.js; // Next.js configuration
vercel.json; // Vercel deployment
tailwind.config.ts; // Tailwind (frontend styling)
postcss.config.js; // PostCSS (frontend build)

// ✅ BACKEND
nest - cli.json; // Nest.js CLI
prisma / schema.prisma; // Database schema

// ✅ SHARING
tsconfig.json.env.example; // TypeScript (both use) // Environment template (both use)
package.json.gitignore.eslintrc.js; // Dependencies (monorepo) // Git (both use) // ESLint (both use)
```

### Pattern 7: Test File Naming

**Rule**: Test file location/name indicates what's being tested

```typescript
// Tests follow their subject's category

// ✅ FRONTEND
__tests__ / components / Button.test.tsx; // → components/Button.tsx
__tests__ / hooks / use - auth.test.ts; // → hooks/use-auth.ts
__tests__ / app / dashboard / page.test.tsx; // → app/dashboard/page.tsx
__tests__ / api / users / route.test.ts; // → app/api/users/route.ts

// ✅ BACKEND
__tests__ / lib / stripe / payments.test.ts; // → lib/stripe/payments.ts
__tests__ / lib / email / service.test.ts; // → lib/email/service.ts
__tests__ / lib / auth / permissions.test.ts; // → lib/auth/permissions.ts

// ✅ TEST (Framework-agnostic)
__tests__ / e2e / checkout - flow.test.ts; // Full stack flow
__tests__ / integration / payment.test.ts; // Multi-service test
__tests__ / helpers / setup.ts; // Test infrastructure
```

### Pattern 8: Prisma Generated Types

**Rule**: Prisma client and generated types → **BACKEND**

```typescript
// ✅ BACKEND - Prisma client
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();

// ✅ SHARING - If you export only types
// types/prisma.ts
export type { User, Subscription } from '@prisma/client';
```

**Why?** The Prisma client itself is server-only. However, if you extract types to share with frontend, those types can be SHARING.

### Pattern 9: Middleware

**Rule**: Next.js middleware → **FRONTEND**

```typescript
// ✅ FRONTEND - Next.js middleware
// middleware.ts
export function middleware(request: NextRequest) {
  // Runs on Vercel Edge Network
  return NextResponse.next();
}
```

**Why?** Next.js middleware runs on Vercel's edge network, part of the Next.js deployment.

### Pattern 10: API Client Libraries

**Rule**: API client used by frontend → **FRONTEND**

```typescript
// ✅ FRONTEND - API client for frontend to call backend
// lib/api/client.ts
export async function getUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// ✅ BACKEND - API client in backend to call external APIs
// lib/api/external-api-client.ts
export async function fetchExternalData() {
  const response = await fetch('https://external-api.com/data', {
    headers: { Authorization: `Bearer ${SERVER_SECRET}` },
  });
  return response.json();
}
```

**Decision**: Where is it used? If called from React components → FRONTEND. If called from server services → BACKEND.

---

## Common Mistakes

### Mistake 1: Categorizing API Route Tests as BACKEND

❌ **Wrong**:

```
__tests__/api/users.test.ts → BACKEND
```

✅ **Correct**:

```
__tests__/api/users.test.ts → FRONTEND
```

**Why?** These tests are testing Next.js API routes (`app/api/users/route.ts`) which are FRONTEND (Vercel Edge Functions). Tests follow their subject.

---

### Mistake 2: Assuming .tsx Always Means FRONTEND

❌ **Wrong**:

```
emails/welcome.tsx → FRONTEND
lib/email/templates/monthly-report.tsx → FRONTEND
```

✅ **Correct**:

```
emails/welcome.tsx → BACKEND
lib/email/templates/monthly-report.tsx → BACKEND
```

**Why?** These are server-side email templates rendered by the email service, not browser components.

---

### Mistake 3: Not Detecting React Hooks by Pattern

❌ **Wrong**:

```
lib/websocket/use-mt5-websocket.ts → BACKEND (because it's in lib/)
```

✅ **Correct**:

```
lib/websocket/use-mt5-websocket.ts → FRONTEND (use-* pattern)
```

**Why?** The `use-*` pattern indicates a React hook, which can ONLY run in React components, regardless of directory location.

---

### Mistake 4: Splitting Next.js app/ Directory

❌ **Wrong**:

```
app/page.tsx → FRONTEND
app/api/users/route.ts → BACKEND
```

✅ **Correct**:

```
app/page.tsx → FRONTEND
app/api/users/route.ts → FRONTEND
```

**Why?** The ENTIRE `app/` directory is part of Next.js and deploys to Vercel as one application. Never split it.

---

### Mistake 5: Categorizing All lib/ as Backend

❌ **Wrong**:

```
lib/hooks/use-auth.ts → BACKEND
lib/client/utils.ts → BACKEND
```

✅ **Correct**:

```
lib/hooks/use-auth.ts → FRONTEND
lib/client/utils.ts → FRONTEND
```

**Why?** `lib/` is a common utilities directory that can contain both frontend and backend code. Check subdirectories and patterns.

---

### Mistake 6: Missing Build Scripts

❌ **Wrong**:

```
scripts/verify-auth-config.js → (not categorized)
```

✅ **Correct**:

```
scripts/verify-auth-config.js → SHARING
```

**Why?** Build scripts are used by both stacks during development and CI/CD, so they're shared infrastructure.

---

### Mistake 7: Categorizing Integration Tests by Directory

❌ **Wrong**:

```
__tests__/integration/api-workflow.test.ts → BACKEND (because it tests API)
```

✅ **Correct**:

```
__tests__/integration/api-workflow.test.ts → TEST
```

**Why?** Integration and E2E tests that span multiple services are framework-agnostic and belong in TEST category.

---

### Mistake 8: Mixing Server Components with Backend

❌ **Wrong**:

```
app/dashboard/page.tsx → BACKEND (because it fetches data server-side)
```

✅ **Correct**:

```
app/dashboard/page.tsx → FRONTEND (it's a Next.js page)
```

**Why?** Next.js Server Components are still part of the Next.js app (FRONTEND). They run during SSR on Vercel, not on a separate backend service.

---

### Mistake 9: Type-Only Files as Frontend

❌ **Wrong**:

```
types/user.ts → FRONTEND (because frontend uses it)
```

✅ **Correct**:

```
types/user.ts → SHARING (both frontend and backend use it)
```

**Why?** Type definitions used by both stacks should be SHARING to maintain a single source of truth.

---

### Mistake 10: Prisma Schema as Sharing

❌ **Wrong**:

```
prisma/schema.prisma → SHARING (defines shared types)
```

✅ **Correct**:

```
prisma/schema.prisma → BACKEND (database schema)
```

**Why?** While it defines types used elsewhere, the schema itself is backend infrastructure. Extract types to `types/` if you need to share them.

---

## Validation Checklist

Use this checklist to validate your categorization:

### Pre-Categorization Questions

Before categorizing a file, verify:

- [ ] I understand what this file does
- [ ] I know which APIs/dependencies it uses
- [ ] I know where this code runs (browser, server, build time, test)
- [ ] I've checked for special patterns (use-_, emails/_, scripts/\*)

### Post-Categorization Validation

After categorizing all files, verify:

#### FRONTEND Stack

- [ ] All `app/` directory contents are FRONTEND
- [ ] All `app/api/` routes are FRONTEND (not BACKEND)
- [ ] All React components are FRONTEND
- [ ] All React hooks (`use-*`) are FRONTEND
- [ ] No server-only code (Prisma, fs, etc.) in FRONTEND
- [ ] No email templates in FRONTEND

#### BACKEND Stack

- [ ] All Prisma/database code is BACKEND
- [ ] All `emails/**/*.tsx` are BACKEND
- [ ] All business logic services are BACKEND
- [ ] All `lib/**/*` (except `use-*` hooks) are BACKEND
- [ ] No React hooks in BACKEND
- [ ] No React components in BACKEND

#### SHARING Stack

- [ ] Only type definitions, constants, and configs
- [ ] No implementation logic in SHARING
- [ ] Build scripts are in SHARING
- [ ] TypeScript config is in SHARING

#### TEST Stack

- [ ] E2E tests are in TEST
- [ ] Integration tests are in TEST
- [ ] Test utilities are in TEST
- [ ] Component tests are in FRONTEND
- [ ] Lib tests are in BACKEND
- [ ] API route tests are in FRONTEND

### Deployment Validation

Before deploying, verify:

- [ ] FRONTEND can be deployed to Vercel without BACKEND files
- [ ] BACKEND can be deployed to Railway without FRONTEND files
- [ ] Both stacks can import from SHARING
- [ ] TEST files are not deployed to either stack

### Common Pattern Checks

Run through these common patterns:

- [ ] All Next.js API routes: `app/api/**/route.ts` → FRONTEND ✓
- [ ] All React hooks: `**/use-*.ts` → FRONTEND ✓
- [ ] All email templates: `emails/**/*.tsx` → BACKEND ✓
- [ ] All lib tests: `__tests__/lib/**/*.test.ts` → BACKEND ✓
- [ ] All API tests: `__tests__/api/**/*.test.ts` → FRONTEND ✓
- [ ] All build scripts: `scripts/**/*` → SHARING ✓
- [ ] All type definitions: `types/**/*` → SHARING ✓

---

## Quick Reference Card

### One-Page Cheat Sheet

```
┌─────────────────────────────────────────────────────────────┐
│              STACK CATEGORIZATION CHEAT SHEET                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FRONTEND (Vercel - Next.js)                                │
│  ├─ app/**/*                    All Next.js app files       │
│  ├─ app/api/**/*.ts              🔥 API routes (edge)        │
│  ├─ components/**/*              React components           │
│  ├─ **/use-*.ts                 🔥 React hooks anywhere     │
│  ├─ hooks/**/*                   React hooks                │
│  ├─ public/**/*                  Static assets              │
│  ├─ lib/client/**/*              Client utilities           │
│  ├─ __tests__/components/**/*   Component tests             │
│  ├─ __tests__/hooks/**/*        Hook tests                  │
│  └─ __tests__/api/**/*          🔥 API route tests          │
│                                                              │
│  BACKEND (Railway - Server)                                 │
│  ├─ lib/**/*                    Server utilities (no use-*) │
│  ├─ emails/**/*.tsx             🔥 Email templates          │
│  ├─ lib/email/templates/**/*   🔥 Email templates          │
│  ├─ prisma/**/*                 Database ORM                │
│  ├─ src/**/*                    Nest.js source              │
│  └─ __tests__/lib/**/*         🔥 Business logic tests     │
│                                                              │
│  SHARING (Both Stacks)                                      │
│  ├─ types/**/*                  Type definitions            │
│  ├─ constants/**/*              Shared constants            │
│  ├─ scripts/**/*                🔥 Build scripts            │
│  ├─ tsconfig.json               TypeScript config           │
│  └─ .env.example                Environment template        │
│                                                              │
│  TEST (Testing Infrastructure)                              │
│  ├─ __tests__/e2e/**/*         End-to-end tests             │
│  ├─ __tests__/integration/**/* Integration tests            │
│  └─ __tests__/helpers/**/*     Test utilities               │
│                                                              │
│  🔥 = Commonly missed patterns                              │
└─────────────────────────────────────────────────────────────┘

PRIORITY RULES (Apply in Order):
1. use-*.ts pattern → FRONTEND (highest priority)
2. Tests follow subject → Check what's being tested
3. app/api/ routes → FRONTEND (edge functions)
4. emails/**/*.tsx → BACKEND (server-side rendering)
5. Directory convention → Follow framework patterns
6. File extension → Last resort (.tsx usually FRONTEND)

THREE QUESTIONS:
1. WHERE deployed? → FRONTEND (Vercel) / BACKEND (Railway) / BOTH / NEITHER
2. WHAT does it do? → UI / Business Logic / Types / Testing
3. WHAT depends on? → React APIs / Server APIs / Nothing / Test Frameworks
```

---

## Conclusion

This guide provides the complete methodology for categorizing files in Trading Alerts SaaS V7. The key principles are:

1. **Tests follow their subjects** - categorize based on what's being tested
2. **Patterns override directories** - `use-*` is always FRONTEND
3. **Context matters** - `.tsx` can be BACKEND for email templates
4. **Deployment drives categorization** - think about where code runs

When in doubt:

1. Apply the three questions method
2. Check the decision trees
3. Review common mistakes
4. Validate using the checklist

Remember: The goal is proper separation for independent deployment to Vercel (FRONTEND) and Railway (BACKEND), while sharing types and configurations (SHARING) and maintaining test infrastructure (TEST).

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Maintained By**: Trading Alerts SaaS V7 Team
