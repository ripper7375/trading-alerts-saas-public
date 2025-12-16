# Aider Comprehension Test Suite

## Overview

This document provides a **comprehensive test plan** to verify that Aider fully understands your Trading Alerts SaaS project context before starting autonomous development in Phase 3.

**Purpose:** Catch knowledge gaps early before Aider builds 170+ files.

**Time Required:** 45-60 minutes

**When to Run:** After completing Phase 1 (policies created, Aider configured)

---

## 📋 Test Categories

1. **Policy Understanding** (6 tests)
2. **Architecture Knowledge** (8 tests)
3. **Tier System Mastery** (5 tests)
4. **Technical Stack Familiarity** (6 tests)
5. **OpenAPI Contract Knowledge** (5 tests)
6. **Coding Patterns Mastery** (7 tests)
7. **Workflow Understanding** (5 tests)
8. **Planning Ability** (4 tests)

**Total: 46 comprehensive tests**

---

## Starting Aider for Testing

```bash
cd /path/to/trading-alerts-saas-v7
py -3.11 -m aider --model anthropic/MiniMax-M2
```

**Verify files loaded:**

```
✓ docs/policies/00-tier-specifications.md
✓ docs/policies/01-approval-policies.md
✓ docs/policies/02-quality-standards.md
✓ docs/policies/03-architecture-rules.md
✓ docs/policies/04-escalation-triggers.md
✓ docs/policies/05-coding-patterns.md
✓ docs/policies/06-aider-instructions.md
✓ docs/v5-structure-division.md
✓ docs/trading_alerts_openapi.yaml
✓ docs/flask_mt5_openapi.yaml
✓ PROGRESS.md
```

**If all files loaded** → ✅ Proceed with tests
**If files missing** → ❌ Fix `.aider.conf.yml` first

---

## Category 1: Policy Understanding (6 Tests)

### Test 1.1: Approval Conditions

**Command:**

```
Summarize the approval policies for this project. When do you auto-approve code, when do you auto-fix, and when do you escalate?
```

**Expected Answer (Key Points):**

- **Auto-approve when:**
  - 0 Critical issues
  - ≤2 High issues from Claude Code validation
  - All TypeScript types present
  - Error handling included
  - JSDoc comments present
  - OpenAPI contract compliance
  - Architecture rules followed
  - Tier validation implemented

- **Auto-fix when:**
  - Missing TypeScript types
  - Missing error handling
  - Missing JSDoc comments
  - ESLint/Prettier errors
  - Maximum 3 retry attempts

- **Escalate when:**
  - Critical security vulnerabilities
  - > 3 High severity issues
  - OpenAPI contract violations (can't auto-fix)
  - Policy conflicts or unclear rules
  - Architectural design decisions
  - New npm/pip dependencies
  - Database schema changes
  - Breaking changes to existing APIs
  - Unclear requirements

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 1.2: Quality Standards

**Command:**

```
What are the key quality standards for TypeScript code in this project? Explain why we avoid 'any' types.
```

**Expected Answer (Key Points):**

- **TypeScript Standards:**
  - No `any` types (breaks type safety)
  - Use `interface` for object shapes, `type` for unions/intersections
  - Explicit return types on functions
  - Strict null checking (`| null | undefined` when needed)
  - JSDoc comments on all public functions

- **Why avoid 'any':**
  - Defeats purpose of TypeScript
  - Hides bugs at compile time
  - No IDE autocomplete
  - Reduces code maintainability
  - Makes refactoring dangerous

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 1.3: Architecture Rules

**Command:**

```
Describe the directory structure for this Next.js 15 application. Where should API routes, components, and business logic go?
```

**Expected Answer (Key Points):**

- **Directory Structure (per v5-structure-division.md):**
  - `app/` - Next.js 15 App Router pages and layouts
  - `app/api/` - API route handlers
  - `components/` - React components (UI building blocks)
  - `lib/` - Business logic, utilities, database operations
  - `prisma/` - Database schema and migrations
  - `public/` - Static assets
  - `styles/` - Global CSS

- **Separation of Concerns:**
  - API routes → thin layer, call business logic
  - Business logic → in `lib/`, reusable
  - Components → UI only, fetch from API routes
  - Database operations → Prisma in `lib/db/`

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 1.4: Escalation Triggers

**Command:**

```
Give me 3 examples of situations where you would escalate to me instead of making a decision yourself.
```

**Expected Answer (Examples):**

1. **Architectural Decision:**
   - "Should I use React Context or Zustand for state management? Both are valid."

2. **Security Issue:**
   - "I found a potential SQL injection vulnerability in generated code. This requires human review."

3. **Unclear Requirements:**
   - "The OpenAPI spec defines `alertCondition` as a string, but doesn't specify allowed values. Should I validate against a predefined list or accept any string?"

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 1.5: Coding Patterns

**Command:**

```
What coding pattern should I use for a Next.js API route? List the key components.
```

**Expected Answer (Key Points):**

- **Pattern 1 from 05-coding-patterns.md:**
  1. Imports (Next.js, types, business logic)
  2. Export async function (GET, POST, PUT, DELETE)
  3. Authentication check (NextAuth)
  4. Request validation (Zod schema)
  5. Tier validation (check FREE/PRO limits)
  6. Business logic (call functions from `lib/`)
  7. Response (matches OpenAPI schema)
  8. Error handling (try/catch, proper status codes)
  9. JSDoc comment explaining endpoint

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 1.6: Workflow Steps

**Command:**

```
Walk me through your workflow for generating a single file. What are the steps from reading requirements to committing code?
```

**Expected Answer (Key Points):**

1. **Read Requirements:**
   - v5-structure-division.md (file location)
   - OpenAPI spec (API contract)
   - v5_part_X.md (implementation details)
   - 05-coding-patterns.md (code template)

2. **Plan Implementation:**
   - Choose appropriate pattern
   - Adapt for specific endpoint/component
   - Ensure matches OpenAPI contract
   - List all requirements

3. **Generate Code:**
   - Use pattern as template
   - Implement all required elements
   - Follow quality standards

4. **Validate:**
   - Run: `claude code "validate [filename]"`
   - Parse validation output
   - Categorize issues by severity

5. **Decide:**
   - Check 01-approval-policies.md
   - If conditions met → APPROVE
   - If fixable issues → AUTO-FIX (max 3 attempts)
   - If stuck/unclear → ESCALATE

6. **Act:**
   - APPROVE: Commit with detailed message
   - AUTO-FIX: Fix issues, re-validate, retry
   - ESCALATE: Format message, notify human, WAIT

7. **Update Progress:**
   - Update PROGRESS.md
   - Report status every 3 files

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

## Category 2: Architecture Knowledge (8 Tests)

### Test 2.1: System Overview

**Command:**

```
Describe the high-level architecture of this Trading Alerts SaaS. What are the main components and how do they interact?
```

**Expected Answer (Key Points):**

- **Components:**
  1. **Next.js Frontend** - User interface (React, shadcn/ui)
  2. **Next.js API Routes** - Backend API (authentication, CRUD operations)
  3. **Flask MT5 Service** - External microservice (MT5 data, indicators)
  4. **PostgreSQL Database** - Data persistence (user accounts, alerts)
  5. **MetaTrader 5 Terminal** - Market data source

- **Interactions:**
  - User → Next.js UI → Next.js API → Business Logic → PostgreSQL
  - Next.js API → Flask MT5 Service → MT5 Terminal → Market Data
  - Authentication: NextAuth.js manages sessions
  - Payments: Stripe for tier upgrades

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 2.2: Data Flow - Alert Creation

**Command:**

```
Explain the data flow when a user creates an alert. Trace the request from UI to database and back.
```

**Expected Answer (Flow):**

1. User fills form in `components/alerts/alert-form.tsx`
2. Form validation (Zod schema)
3. Submit button → `fetch('/api/alerts', { method: 'POST', body: JSON.stringify(data) })`
4. Request hits `app/api/alerts/route.ts` → POST handler
5. Authentication check (NextAuth session)
6. Request validation (Zod schema)
7. Tier validation (check symbol/timeframe access)
8. Business logic (`lib/db/alerts.ts` → `createAlert(userId, data)`)
9. Prisma inserts into database
10. Response returned (matches `AlertResponse` from OpenAPI)
11. UI updates (show success message, refresh list)

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 2.3: Authentication Flow

**Command:**

```
How does authentication work in this application? Explain the login process and how protected routes are secured.
```

**Expected Answer (Key Points):**

- **Technology:** NextAuth.js
- **Login Flow:**
  1. User submits credentials → POST /api/auth/signin
  2. NextAuth validates credentials against database
  3. JWT token generated and stored in HTTP-only cookie
  4. User redirected to dashboard

- **Protected Routes:**
  - Middleware checks session on every request
  - API routes: `const session = await getServerSession(authOptions)`
  - If no session → 401 Unauthorized
  - If session exists → extract `userId` for queries

- **Token Storage:** HTTP-only cookies (secure, can't be accessed by JS)

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 2.4: File Location - API Route

**Command:**

```
Where should the POST /api/alerts endpoint file be located? Give the exact file path.
```

**Expected Answer:**

```
app/api/alerts/route.ts
```

**Explanation:**

- Next.js 15 App Router uses file-system routing
- `/api/alerts` → `app/api/alerts/` folder
- HTTP methods → exported functions in `route.ts`

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 2.5: File Location - Component

**Command:**

```
Where should the AlertForm component be located? Give the exact file path.
```

**Expected Answer:**

```
components/alerts/alert-form.tsx
```

**Explanation:**

- Components organized by feature
- `alerts/` folder groups all alert-related components
- kebab-case file naming (`alert-form.tsx`)
- Component name is PascalCase (`AlertForm`)

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 2.6: Database Pattern

**Command:**

```
How should database operations be structured? Where do Prisma queries go?
```

**Expected Answer (Key Points):**

- **Location:** `lib/db/` folder
- **Organization:** One file per model (e.g., `lib/db/alerts.ts`, `lib/db/users.ts`)
- **Pattern:**
  - Export functions for CRUD operations
  - Each function uses Prisma Client
  - Include error handling
  - Add JSDoc comments

- **Example:**

```typescript
// lib/db/alerts.ts
import { prisma } from '@/lib/prisma';
import type { Alert } from '@prisma/client';

/**
 * Create a new alert for a user
 */
export async function createAlert(
  userId: string,
  data: CreateAlertData
): Promise<Alert> {
  return await prisma.alert.create({
    data: {
      userId,
      ...data,
    },
  });
}
```

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 2.7: Flask MT5 Integration

**Command:**

```
How does the Next.js application communicate with the Flask MT5 service? What data is passed?
```

**Expected Answer (Key Points):**

- **Communication:** HTTP requests from Next.js API routes to Flask endpoints
- **Flask URL:** `http://localhost:5001` (dev), environment variable for production
- **Data Passed:**
  - Headers: `X-User-Tier` (for tier validation in Flask)
  - Query params: symbol, timeframe, period (for indicator requests)

- **Example Flow:**
  1. User requests RSI data for BTCUSD
  2. Next.js API route → `fetch('http://localhost:5001/api/indicators/rsi?symbol=BTCUSD&timeframe=H1&period=14')`
  3. Flask validates tier, connects to MT5, fetches data
  4. Flask returns JSON response
  5. Next.js forwards to frontend

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 2.8: Deployment Architecture

**Command:**

```
Where will the different parts of this application be deployed?
```

**Expected Answer:**

- **Vercel:** Next.js frontend and API routes
- **Railway:**
  - PostgreSQL database
  - Flask MT5 service (Docker container)
- **Local/VPS:** MetaTrader 5 terminal (can't be cloud-hosted)

**Connections:**

- Vercel → Railway PostgreSQL (connection string in env)
- Vercel → Railway Flask (HTTP requests to Flask service URL)
- Flask → MT5 Terminal (localhost if on same machine, or network connection)

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

## Category 3: Tier System Mastery (5 Tests)

### Test 3.1: Tier Limits

**Command:**

```
What are the tier restrictions in this project? List exactly what FREE and PRO tiers can access.
```

**Expected Answer:**

- **FREE Tier:**
  - 5 symbols: BTCUSD, EURUSD, USDJPY, US30, XAUUSD
  - 3 timeframes: H1, H4, D1
  - Max 10 alerts

- **PRO Tier:**
  - 15 symbols: BTCUSD, EURUSD, USDJPY, GBPUSD, USDCHF, AUDUSD, NZDUSD, USDCAD, US30, US500, USTEC, XAUUSD, XAGUSD, USOIL, UKOUSD
  - 9 timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1
  - Max 50 alerts

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 3.2: Tier Validation - Symbol

**Command:**

```
A FREE tier user tries to create an alert for GBPUSD. What should happen? What HTTP status code and error message?
```

**Expected Answer:**

- **HTTP Status:** `403 Forbidden`
- **Error Response:**

```json
{
  "error": "Forbidden",
  "message": "Symbol GBPUSD is not available for FREE tier. Upgrade to PRO to access this symbol.",
  "availableSymbols": ["BTCUSD", "EURUSD", "USDJPY", "US30", "XAUUSD"]
}
```

- **Where Validation Happens:**
  - Next.js API route: `app/api/alerts/route.ts`
  - Validation function: `lib/tier/validation.ts` → `validateSymbolAccess(tier, symbol)`
  - Before Prisma insert

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 3.3: Tier Validation - Timeframe

**Command:**

```
A FREE tier user tries to create an alert for BTCUSD with M15 timeframe. What should happen?
```

**Expected Answer:**

- **HTTP Status:** `403 Forbidden`
- **Error Response:**

```json
{
  "error": "Forbidden",
  "message": "Timeframe M15 is not available for FREE tier. Upgrade to PRO to access this timeframe.",
  "availableTimeframes": ["H1", "H4", "D1"]
}
```

- **Validation:** Same pattern as symbol validation, check timeframe access

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 3.4: Tier Validation in Flask

**Command:**

```
How does the Flask MT5 service enforce tier restrictions? What header is used?
```

**Expected Answer:**

- **Header:** `X-User-Tier` (value: "FREE" or "PRO")
- **Validation:** Flask reads header, validates symbol/timeframe access before querying MT5
- **If Violation:**
  - HTTP Status: `403 Forbidden`
  - Error message: Similar to Next.js format

- **Why Validate in Flask:**
  - Defense in depth (validate in both Next.js and Flask)
  - Direct Flask API calls must also enforce restrictions
  - Prevent bypassing Next.js validation

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 3.5: Tier Upgrade Flow

**Command:**

```
Describe the flow when a user upgrades from FREE to PRO tier. What changes in the database and what new access do they gain?
```

**Expected Answer:**

1. **User clicks "Upgrade to PRO"**
2. **POST /api/subscriptions/checkout** → Create Stripe checkout session
3. **User completes payment on Stripe**
4. **Stripe webhook** → POST /api/webhooks/stripe
5. **Webhook handler:**
   - Verify webhook signature
   - Update user record: `tier: "PRO"`, `stripeSubscriptionId: "sub_xyz"`
   - Create subscription record in database
6. **User redirected to dashboard**
7. **New Access:**
   - All 15 symbols now accessible
   - All 9 timeframes now accessible
   - Max alerts increased to 50
   - UI shows "PRO" badge

**Database Changes:**

- `User.tier`: "FREE" → "PRO"
- `User.stripeCustomerId`: Set
- `User.stripeSubscriptionId`: Set
- New row in `Subscription` table

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

## Category 4: Technical Stack Familiarity (6 Tests)

### Test 4.1: Next.js 15 Knowledge

**Command:**

```
What are the key differences between Server Components and Client Components in Next.js 15? When should each be used?
```

**Expected Answer:**

- **Server Components (Default):**
  - Rendered on server
  - Can directly access database (Prisma)
  - No client-side JavaScript
  - Better performance
  - Use for: Pages, layouts, static content

- **Client Components ('use client'):**
  - Rendered in browser
  - Can use hooks (useState, useEffect)
  - Interactive features
  - Access to browser APIs
  - Use for: Forms, interactive UI, state management

- **When to Use Each:**
  - Server: Data fetching, SEO-critical pages, static layouts
  - Client: Forms with validation, real-time updates, user interactions

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 4.2: Prisma Knowledge

**Command:**

```
How do we query the database in this project? Show an example of creating and reading an alert using Prisma.
```

**Expected Answer:**

```typescript
import { prisma } from '@/lib/prisma';

// Create an alert
const newAlert = await prisma.alert.create({
  data: {
    userId: 'user_123',
    symbol: 'BTCUSD',
    timeframe: 'H1',
    condition: 'RSI_OVERSOLD',
    threshold: 30,
    enabled: true,
  },
});

// Read user's alerts
const alerts = await prisma.alert.findMany({
  where: {
    userId: 'user_123',
    enabled: true,
  },
  orderBy: {
    createdAt: 'desc',
  },
});
```

- **No raw SQL** (use Prisma ORM)
- **Type-safe** (auto-generated types)
- **Relation handling** (include related data)

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 4.3: TypeScript Types

**Command:**

```
Where do the TypeScript types for API requests and responses come from? Should I manually define them?
```

**Expected Answer:**

- **Source:** Auto-generated from OpenAPI specs
- **Generation Scripts:**
  - `scripts/openapi/generate-nextjs-types.sh` → `lib/api-client/`
  - `scripts/openapi/generate-flask-types.sh` → `lib/mt5-client/`

- **Usage:**

```typescript
import { Alert, CreateAlertRequest, AlertResponse } from '@/lib/api-client';
```

- **NEVER manually define types that exist in OpenAPI** (single source of truth)
- **Only manual types:** Internal utility types, React component props

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 4.4: Validation Library

**Command:**

```
What library should be used for request validation in API routes?
```

**Expected Answer:**

- **Library:** Zod
- **Why:** Type-safe, integrates with TypeScript, good error messages

- **Example:**

```typescript
import { z } from 'zod';

const CreateAlertSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.enum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']),
  condition: z.string(),
  threshold: z.number().min(0).max(100),
  enabled: z.boolean().default(true),
});

// In API route
const body = CreateAlertSchema.parse(await request.json());
```

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 4.5: UI Component Library

**Command:**

```
What UI component library is used for this project? Give examples of 3 components.
```

**Expected Answer:**

- **Library:** shadcn/ui (built on Radix UI + Tailwind CSS)

- **Example Components:**
  1. `Button` - `components/ui/button.tsx`
  2. `Input` - `components/ui/input.tsx`
  3. `Card` - `components/ui/card.tsx`

- **Usage:**

```tsx
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

<Button variant="primary" size="lg">Create Alert</Button>
<Input type="text" placeholder="Symbol..." />
```

- **Seed Code Reference:** `seed-code/next-shadcn-dashboard-starter/` has examples

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 4.6: Payment Integration

**Command:**

```
What payment provider is used for tier upgrades? How is it integrated?
```

**Expected Answer:**

- **Provider:** Stripe
- **Integration:**
  - Stripe Checkout for payment flow
  - Stripe Webhooks for subscription updates
  - Stripe Customer Portal for subscription management

- **Flow:**
  1. User clicks upgrade → Create Stripe Checkout Session
  2. Redirect to Stripe Checkout
  3. User pays
  4. Stripe webhook → Update database
  5. User now has PRO access

- **Seed Code Reference:** `seed-code/saas-starter/` has Stripe integration examples

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

## Category 5: OpenAPI Contract Knowledge (5 Tests)

### Test 5.1: OpenAPI Files

**Command:**

```
What OpenAPI specification files exist in this project and what do they define?
```

**Expected Answer:**

1. **trading_alerts_openapi.yaml:**
   - Next.js API routes
   - ~38 endpoints
   - Authentication, users, alerts, subscriptions, dashboard

2. **flask_mt5_openapi.yaml:**
   - Flask MT5 service endpoints
   - ~12 endpoints
   - Market data, indicators, symbols

**Purpose:** Single source of truth for API contracts

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 5.2: Endpoint Definition

**Command:**

```
How do I know what request body, response format, and status codes an endpoint should use?
```

**Expected Answer:**

- **Read the OpenAPI spec** for that endpoint
- **Example:** POST /api/alerts
  - Request body schema: `CreateAlertRequest`
  - Response schema: `AlertResponse` (success) or `ErrorResponse` (failure)
  - Status codes:
    - 201: Alert created successfully
    - 400: Invalid request body
    - 401: Unauthorized (no auth token)
    - 403: Forbidden (tier restriction)
    - 500: Internal server error

**OpenAPI = Contract:** Implementation MUST match spec exactly

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 5.3: Type Safety from OpenAPI

**Command:**

```
Explain how OpenAPI specs ensure type safety throughout the application.
```

**Expected Answer:**

1. **OpenAPI specs define schemas** (request/response shapes)
2. **OpenAPI Generator creates TypeScript types** from schemas
3. **TypeScript enforces types** at compile time
4. **API routes use generated types:**

```typescript
import { CreateAlertRequest, AlertResponse } from '@/lib/api-client';

export async function POST(
  request: NextRequest
): Promise<NextResponse<AlertResponse>> {
  const body: CreateAlertRequest = await request.json();
  // TypeScript ensures body matches CreateAlertRequest shape
  // TypeScript ensures response matches AlertResponse shape
}
```

5. **Components use same types:**

```tsx
import { Alert } from '@/lib/api-client';

export function AlertList({ alerts }: { alerts: Alert[] }) {
  // TypeScript knows Alert shape
}
```

**Benefit:** Change OpenAPI → Regenerate types → TypeScript catches all breaking changes

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 5.4: Contract Violation Handling

**Command:**

```
What should happen if I write code that doesn't match the OpenAPI contract? For example, returning a field that's not in the spec.
```

**Expected Answer:**

1. **TypeScript compilation error** (if using generated types)
2. **Claude Code validation error** (contract violation)
3. **Escalation trigger** (per 04-escalation-triggers.md)

**Correct Response:**

- ❌ Don't return extra fields
- ✅ Update OpenAPI spec if field is needed
- ✅ Regenerate types
- ✅ Then implement

**OpenAPI First:** Spec drives implementation, not the other way around

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 5.5: Postman Collection Generation

**Command:**

```
How do we create Postman collections for testing? Do we write them manually?
```

**Expected Answer:**

- **Import from OpenAPI specs** (not manual)
- **Process:**
  1. Open Postman
  2. Import → Files → Select `trading_alerts_openapi.yaml`
  3. Postman auto-generates collection with all endpoints
  4. Configure variables (baseUrl, authToken)
  5. Test endpoints

**Benefit:** OpenAPI = Single source of truth for API docs, types, AND tests

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

## Category 6: Coding Patterns Mastery (7 Tests)

### Test 6.1: API Route Pattern

**Command:**

```
Plan the structure for a POST /api/alerts endpoint. Don't write the code yet, just outline what it should contain and in what order.
```

**Expected Answer (Structure):**

1. **Imports:**
   - Next.js: `NextRequest`, `NextResponse`
   - Auth: `getServerSession`, `authOptions`
   - Validation: `z` (Zod)
   - Types: `CreateAlertRequest`, `AlertResponse`
   - Business logic: `createAlert` from `lib/db/alerts`
   - Tier validation: `validateSymbolAccess`, `validateTimeframeAccess`

2. **Export POST function** (async)

3. **Try/catch block**

4. **Authentication check:**
   - Get session
   - If no session → 401

5. **Request body validation:**
   - Parse JSON
   - Validate with Zod schema
   - If invalid → 400 with error details

6. **Tier validation:**
   - Get user tier from session/database
   - Validate symbol access
   - Validate timeframe access
   - If violation → 403 with helpful message

7. **Business logic:**
   - Call `createAlert(userId, data)`
   - Prisma inserts into database

8. **Success response:**
   - Return 201 with alert object (matches `AlertResponse`)

9. **Error handling:**
   - Catch errors
   - Log for debugging
   - Return 500 with generic error message

10. **JSDoc comment** explaining endpoint

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 6.2: Client Component Pattern

**Command:**

```
Plan the structure for an AlertForm client component. What are the key elements?
```

**Expected Answer (Structure):**

1. **'use client' directive** (at top of file)

2. **Imports:**
   - React hooks: `useState`
   - Form library: React Hook Form
   - UI components: `Button`, `Input`, `Select`
   - Types: `CreateAlertRequest`

3. **Component definition:**
   - Props: `onSuccess?: () => void`
   - State: `isLoading`, `error`, form state

4. **Form setup:**
   - React Hook Form with Zod resolver
   - Default values

5. **Submit handler:**
   - Set loading state
   - Try fetch to `/api/alerts`
   - Handle success (call `onSuccess`, show toast)
   - Handle errors (display error message)
   - Finally: clear loading state

6. **JSX Return:**
   - Form element
   - Input fields (symbol, timeframe, condition, threshold)
   - Submit button (disabled when loading)
   - Error display (if error exists)

7. **Loading states:**
   - Disable inputs when submitting
   - Show spinner on button

8. **TypeScript types:**
   - Proper typing for all props, state, handlers

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 6.3: Tier Validation Utility Pattern

**Command:**

```
Describe the tier validation utility functions. What functions should exist and what do they do?
```

**Expected Answer (from 05-coding-patterns.md Pattern 3):**

**File:** `lib/tier/validation.ts`

**Functions:**

1. **`canAccessSymbol(tier: TierType, symbol: string): boolean`**
   - Returns true if tier can access symbol
   - FREE → only 5 symbols
   - PRO → all 15 symbols

2. **`canAccessTimeframe(tier: TierType, timeframe: string): boolean`**
   - Returns true if tier can access timeframe
   - FREE → only H1, H4, D1
   - PRO → all 9 timeframes

3. **`getAvailableSymbols(tier: TierType): string[]`**
   - Returns array of symbols for tier

4. **`getAvailableTimeframes(tier: TierType): string[]`**
   - Returns array of timeframes for tier

5. **`validateSymbolAccess(tier: TierType, symbol: string): void`**
   - Throws error if tier can't access symbol
   - Used in API routes for validation

6. **`validateTimeframeAccess(tier: TierType, timeframe: string): void`**
   - Throws error if tier can't access timeframe

**All functions:** Include JSDoc, TypeScript types, handle edge cases

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 6.4: Database Utility Pattern

**Command:**

```
Describe the pattern for database utility functions. Use alerts as an example - what functions should exist in lib/db/alerts.ts?
```

**Expected Answer (from 05-coding-patterns.md Pattern 4):**

**File:** `lib/db/alerts.ts`

**Functions:**

1. **`createAlert(userId: string, data: CreateAlertData): Promise<Alert>`**
   - Insert new alert
   - Return created alert

2. **`getAlerts(userId: string): Promise<Alert[]>`**
   - Get all alerts for user
   - Ordered by createdAt DESC

3. **`getAlertById(alertId: string): Promise<Alert | null>`**
   - Get single alert by ID
   - Return null if not found

4. **`updateAlert(alertId: string, data: UpdateAlertData): Promise<Alert>`**
   - Update alert fields
   - Return updated alert

5. **`deleteAlert(alertId: string): Promise<void>`**
   - Delete alert
   - No return value

6. **`getActiveAlerts(userId: string): Promise<Alert[]>`**
   - Get only enabled alerts
   - For alert checking

**All functions:**

- Import Prisma client
- Use Prisma queries (no raw SQL)
- Include error handling
- Add JSDoc comments
- TypeScript types from @prisma/client

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 6.5: Error Handling Pattern

**Command:**

```
Show me the error handling pattern for API routes. How should errors be caught and returned?
```

**Expected Answer:**

```typescript
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validation
    const body = await request.json();
    const validated = CreateAlertSchema.parse(body);

    // Business logic
    const alert = await createAlert(session.user.id, validated);

    // Success response
    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    // Zod validation error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Invalid request body',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Tier validation error (custom error class)
    if (error instanceof TierAccessError) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: error.message,
          availableSymbols: error.allowedValues,
        },
        { status: 403 }
      );
    }

    // Log unexpected errors
    console.error('Unexpected error in POST /api/alerts:', error);

    // Generic error response (don't expose internal details)
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
```

**Key Points:**

- Try/catch around entire handler
- Specific error handling (auth, validation, tier, etc.)
- User-friendly error messages
- Proper HTTP status codes
- Log errors for debugging
- Don't expose sensitive info in error messages

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 6.6: Constants File Pattern

**Command:**

```
Describe the pattern for constants files. What should be in lib/constants/tiers.ts?
```

**Expected Answer (from 05-coding-patterns.md Pattern 6):**

**File:** `lib/constants/tiers.ts`

**Contents:**

1. **Tier enum/type:**

```typescript
export type TierType = 'FREE' | 'PRO';
```

2. **Symbol constants:**

```typescript
export const FREE_SYMBOLS = [
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'US30',
  'XAUUSD',
] as const;
export const PRO_SYMBOLS = [
  'BTCUSD',
  'EURUSD',
  'USDJPY',
  'GBPUSD',
  'USDCHF',
  'AUDUSD',
  'NZDUSD',
  'USDCAD',
  'US30',
  'US500',
  'USTEC',
  'XAUUSD',
  'XAGUSD',
  'USOIL',
  'UKOUSD',
] as const;
```

3. **Timeframe constants:**

```typescript
export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;
export const PRO_TIMEFRAMES = [
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
```

4. **Limits:**

```typescript
export const TIER_LIMITS = {
  FREE: {
    symbols: FREE_SYMBOLS,
    timeframes: FREE_TIMEFRAMES,
    maxAlerts: 10,
  },
  PRO: {
    symbols: PRO_SYMBOLS,
    timeframes: PRO_TIMEFRAMES,
    maxAlerts: 50,
  },
} as const;
```

**Why:** Centralize tier rules, easy to update, type-safe

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 6.7: Seed Code Usage

**Command:**

```
When should you reference the seed code repositories, and how should they be used?
```

**Expected Answer (from 06-aider-instructions.md):**

**Seed Code Repositories:**

1. **market_ai_engine.py:**
   - **Use for:** Part 6 (Flask MT5 Service)
   - **Reference:** Flask route patterns, MT5 API usage, indicator fetching
   - **Adapt, don't copy:** Use as pattern reference, customize for our OpenAPI spec

2. **seed-code/saas-starter/:**
   - **Use for:** Parts 5 (Auth), 7 (API Routes), 12 (E-commerce)
   - **Reference:** NextAuth config, Prisma patterns, Stripe integration, middleware
   - **Key files:** `app/api/auth/[...nextauth]/route.ts`, `lib/stripe.ts`, `middleware.ts`, `prisma/schema.prisma`

3. **seed-code/next-shadcn-dashboard-starter/:**
   - **Use for:** Parts 8-14 (All UI/Frontend)
   - **Reference:** Dashboard layout, shadcn/ui components, charts, forms
   - **Key files:** `app/dashboard/layout.tsx`, `components/ui/*`, `components/charts/*`, `lib/utils.ts`

**Important:** Seed code is REFERENCE only. Always:

- Adapt to our OpenAPI contracts
- Follow our tier system
- Use our specific business logic
- Match our quality standards

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

## Category 7: Workflow Understanding (5 Tests)

### Test 7.1: MiniMax M2 Model

**Command:**

```
What AI model should you use for this project? Why was it chosen?
```

**Expected Answer:**

- **Model:** MiniMax M2 (via Anthropic-compatible API)
- **Why Chosen:**
  - Cost-effective (vs Claude Opus, GPT-4)
  - Good balance of quality and cost
  - Handles coding tasks well
  - Suitable for autonomous development
  - Anthropic-compatible API

**Command to start Aider:**

```bash
py -3.11 -m aider --model anthropic/MiniMax-M2
```

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 7.2: File Loading on Startup

**Command:**

```
What files should you load automatically when starting? List them.
```

**Expected Answer (from .aider.conf.yml):**

- Policy documents:
  - docs/policies/00-tier-specifications.md
  - docs/policies/01-approval-policies.md
  - docs/policies/02-quality-standards.md
  - docs/policies/03-architecture-rules.md
  - docs/policies/04-escalation-triggers.md
  - docs/policies/05-coding-patterns.md
  - docs/policies/06-aider-instructions.md
- V7 guides:
  - docs/v7/v7_overview.md
  - docs/v7/v7_phase_3_building.md
- Structure:
  - docs/v5-structure-division.md
- API contracts:
  - docs/trading_alerts_openapi.yaml
  - docs/flask_mt5_openapi.yaml
- Seed code:
  - seed-code/market_ai_engine.py
- Progress:
  - PROGRESS.md

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 7.3: Progress Reporting

**Command:**

```
How often should you report progress to me? What information should you include?
```

**Expected Answer:**

- **Frequency:** Every 3 files completed
- **Information to Include:**
  - Part name and number
  - Files completed / Total files
  - List of completed files
  - Escalations count
  - Next file to build

**Example Report:**

```
📊 PROGRESS UPDATE
Part 11: Alerts
Files completed: 6/14
- ✅ app/api/alerts/route.ts
- ✅ app/api/alerts/[id]/route.ts
- ✅ components/alerts/alert-form.tsx
- ✅ components/alerts/alert-list.tsx
- ✅ lib/db/alerts.ts
- ✅ lib/constants/alert-conditions.ts
Escalations: 1 (alert condition validation pattern)
Next: components/alerts/alert-card.tsx
```

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 7.4: Commit Message Format

**Command:**

```
What format should commit messages use? Show an example.
```

**Expected Answer:**
**Format:** Conventional Commits

**Structure:**

```
<type>(<scope>): <description>

- Validation: X Critical, Y High, Z Medium issues
- All approval conditions met: yes/no
- Pattern used: [pattern name from 05-coding-patterns.md]
- Model: MiniMax M2
```

**Example:**

```
feat(alerts): add POST /api/alerts endpoint

- Validation: 0 Critical, 0 High, 2 Medium issues
- All approval conditions met: yes
- Pattern used: Pattern 1 (Next.js API Route)
- Model: MiniMax M2
```

**Types:** feat, fix, docs, refactor, test, chore

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 7.5: Self-Improvement Loop

**Command:**

```
How should you learn from escalations and improve over time?
```

**Expected Answer:**

1. **When I escalate:** Document the issue and policy gap
2. **When human resolves:** Note the decision
3. **After resolution:** Check if policies need updating
4. **Human updates policies:** Reload and apply new rules
5. **Next similar scenario:** Follow updated policy (no escalation needed)

**Example:**

- **Escalation:** "Should I use library X or Y for feature Z?"
- **Human decides:** "Use library X"
- **Human updates:** Add to 05-coding-patterns.md: "For feature Z, use library X because [reason]"
- **Next time:** I see feature Z in requirements, I use library X (no escalation)

**Result:** Progressive improvement → Fewer escalations over time

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

## Category 8: Planning Ability (4 Tests)

### Test 8.1: Part Planning

**Command:**

```
Plan the implementation for Part 11: Alerts. Don't build it yet. List the files you would create, in what order, and why that order.
```

**Expected Answer (Example):**

**Order and Rationale:**

1. **lib/constants/alert-conditions.ts** - Foundation (constants needed by other files)
2. **lib/constants/tiers.ts** - Foundation (tier rules needed for validation)
3. **lib/tier/validation.ts** - Utilities (validation functions needed by API routes)
4. **lib/db/alerts.ts** - Database layer (CRUD operations needed by API routes)
5. **app/api/alerts/route.ts** - API endpoint (GET all, POST create)
6. **app/api/alerts/[id]/route.ts** - API endpoint (GET one, PUT update, DELETE)
7. **components/alerts/alert-form.tsx** - UI component (depends on API routes existing)
8. **components/alerts/alert-list.tsx** - UI component (displays alerts)
9. **components/alerts/alert-card.tsx** - UI component (single alert display)
10. **app/alerts/page.tsx** - Page (combines all components)

**Why This Order:**

- Bottom-up: Build foundations first (constants, utils, DB)
- Backend before frontend: API routes before UI components
- Dependencies: Each file can reference previously built files

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 8.2: Dependency Identification

**Command:**

```
Part 11 (Alerts) depends on which other parts being completed first? Explain why.
```

**Expected Answer:**
**Dependencies:**

1. **Part 2 (Database):**
   - Need: Prisma schema with Alert model
   - Why: Can't create alerts table without schema

2. **Part 5 (Authentication):**
   - Need: NextAuth configured, authOptions defined
   - Why: Alert endpoints are protected, need authentication

3. **Part 1-4 (Foundation):**
   - Need: Next.js project structure, basic setup
   - Why: Can't create files without project structure

**Independent From:**

- Parts 6, 8-10, 12-16 (can build alerts without these)

**Build Order:** Part 1-4 → Part 2 → Part 5 → Part 11

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 8.3: Requirement Interpretation

**Command:**

```
Read the description for POST /api/alerts in trading_alerts_openapi.yaml. Without writing code, tell me what this endpoint must do, what it must validate, and what it must return.
```

**Expected Answer (Based on OpenAPI Spec):**
**Must Do:**

- Accept alert creation request from authenticated user
- Create new alert in database
- Enforce tier restrictions
- Return created alert

**Must Validate:**

1. **Authentication:** User must be logged in (check session)
2. **Request Body:** Must match CreateAlertRequest schema
   - symbol: non-empty string
   - timeframe: valid enum value
   - condition: valid alert condition
   - threshold: number (appropriate range for condition)
   - enabled: boolean (optional, default true)
3. **Tier Restrictions:**
   - User's tier can access requested symbol
   - User's tier can access requested timeframe
4. **Business Rules:**
   - User hasn't exceeded max alerts for their tier

**Must Return:**

- **Success (201):** Alert object matching AlertResponse schema
- **Errors:**
  - 400: Invalid request body (with details)
  - 401: Not authenticated
  - 403: Tier restriction violation (with helpful message)
  - 500: Server error (generic message)

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

### Test 8.4: Multi-File Coordination

**Command:**

```
If I'm building the alert creation feature, explain how the different files (API route, form component, database utility, validation utility) work together. Trace a complete request flow.
```

**Expected Answer (Complete Flow):**

**1. User Interaction:**

- File: `components/alerts/alert-form.tsx`
- User fills form (symbol, timeframe, condition, threshold)
- Client-side validation (React Hook Form + Zod)
- Click "Create Alert"

**2. HTTP Request:**

- Form submits: `fetch('/api/alerts', { method: 'POST', body: JSON.stringify(formData) })`

**3. API Route Entry:**

- File: `app/api/alerts/route.ts` → POST function
- Receive request

**4. Authentication:**

- Code: `const session = await getServerSession(authOptions)`
- If no session → return 401

**5. Request Validation:**

- Code: `const body = CreateAlertSchema.parse(await request.json())`
- If invalid → return 400 with Zod errors

**6. Tier Validation:**

- File: `lib/tier/validation.ts`
- Code: `validateSymbolAccess(session.user.tier, body.symbol)`
- Code: `validateTimeframeAccess(session.user.tier, body.timeframe)`
- If violation → return 403 with helpful message

**7. Database Operation:**

- File: `lib/db/alerts.ts` → `createAlert` function
- Code: `const alert = await createAlert(session.user.id, body)`
- Prisma inserts into alerts table

**8. Response:**

- API route returns: `NextResponse.json(alert, { status: 201 })`

**9. UI Update:**

- Form receives response
- Show success message
- Clear form or redirect to alerts list
- Optionally refresh alerts list

**Files Involved:**

- `components/alerts/alert-form.tsx` (UI)
- `app/api/alerts/route.ts` (API entry point)
- `lib/tier/validation.ts` (tier validation logic)
- `lib/db/alerts.ts` (database operations)
- `lib/constants/tiers.ts` (tier definitions)

**Result:** ✅ PASS / ❌ FAIL

**Notes:**

---

## 📊 Test Results Summary

### Category Results

| Category                       | Tests  | Passed | Failed | Pass Rate |
| ------------------------------ | ------ | ------ | ------ | --------- |
| 1. Policy Understanding        | 6      |        |        | %         |
| 2. Architecture Knowledge      | 8      |        |        | %         |
| 3. Tier System Mastery         | 5      |        |        | %         |
| 4. Technical Stack Familiarity | 6      |        |        | %         |
| 5. OpenAPI Contract Knowledge  | 5      |        |        | %         |
| 6. Coding Patterns Mastery     | 7      |        |        | %         |
| 7. Workflow Understanding      | 5      |        |        | %         |
| 8. Planning Ability            | 4      |        |        | %         |
| **TOTAL**                      | **46** |        |        | **%**     |

### Overall Assessment

**Minimum Pass Criteria:**

- ✅ **80% overall pass rate** (37/46 tests passed)
- ✅ **All "critical" tests passed** (Tests 1.1, 1.2, 2.1, 3.1, 5.2, 6.1)

**Results:**

- [ ] **READY FOR PHASE 3** - Proceed with autonomous building
- [ ] **NEEDS IMPROVEMENT** - Review failed tests, update policies, retest

### Failed Tests Analysis

**If any tests failed, document here:**

1. **Test ID:** [e.g., 3.2]
   - **Issue:** [What Aider got wrong]
   - **Root Cause:** [Why it failed - missing policy? Unclear documentation?]
   - **Fix:** [What needs to be updated]

2. **Test ID:**
   - **Issue:**
   - **Root Cause:**
   - **Fix:**

---

## 🔧 Remediation Steps

**If Aider fails tests, follow these steps:**

### Step 1: Analyze Failures

For each failed test:

1. Understand what Aider misunderstood
2. Identify which policy document is unclear or missing information
3. Check if seed code examples would help

### Step 2: Update Policies

Update relevant policy documents:

- **Policy Understanding failures** → Update 01-approval-policies.md or 06-aider-instructions.md
- **Architecture failures** → Update 03-architecture-rules.md
- **Tier System failures** → Update 00-tier-specifications.md
- **Pattern failures** → Update 05-coding-patterns.md

**Make changes specific and clear.** Add examples.

### Step 3: Restart Aider

After updating policies:

```bash
# Exit current Aider session
/exit

# Restart to load updated policies
py -3.11 -m aider --model anthropic/MiniMax-M2
```

### Step 4: Retest

Re-run failed tests. Aider should now pass with updated policies.

### Step 5: Document

Update `PROGRESS.md`:

```markdown
## Aider Comprehension Testing

- Date: 2024-01-15
- Initial Pass Rate: 38/46 (83%)
- Failed Tests: 3.2, 5.3, 6.1
- Policies Updated: 00-tier-specifications.md, 05-coding-patterns.md
- Retest Pass Rate: 46/46 (100%)
- Status: ✅ READY FOR PHASE 3
```

---

## 💡 Beginner Tips for Testing

### Tip 1: Don't Rush

Take time to carefully evaluate Aider's answers. Partial understanding now = problems later.

### Tip 2: Ask Follow-Up Questions

If an answer is vague, ask Aider to elaborate:

```
Can you give a specific example of [X]?
Walk me through the code for [Y].
```

### Tip 3: Test Critical Areas First

If short on time, prioritize:

- Category 1 (Policies)
- Category 3 (Tier System)
- Category 6 (Coding Patterns)

### Tip 4: Use This as a Learning Tool

As you test Aider, you'll also learn the project deeply. If you don't understand something Aider says, ask Claude Chat for clarification!

### Tip 5: Document Everything

Keep notes during testing. They'll be useful when handling escalations later.

---

## ✅ Certification

Once Aider passes with ≥80% (and all critical tests):

**I certify that Aider has demonstrated sufficient understanding of the Trading Alerts SaaS V7 project to proceed with autonomous development in Phase 3.**

- **Date:** **\*\***\_\_\_**\*\***
- **Pass Rate:** **\_**% (\_\_\_\_/46 tests)
- **Tester Name:** **\*\***\_\_\_**\*\***
- **Ready for Phase 3:** [ ] YES [ ] NO

---

## 📚 Additional Resources

- **Policy Documents:** `docs/policies/`
- **Architecture:** `ARCHITECTURE.md`
- **Implementation Guide:** `IMPLEMENTATION-GUIDE.md`
- **V7 Overview:** `docs/v7/v7_overview.md`
- **Phase 3 Building Guide:** `docs/v7/v7_phase_3_building.md`

---

**💡 Final Note:** These tests ensure Aider understands your project before building 170+ files. A few hours of testing now saves many hours of debugging later. Trust the process! 🚀

---

_Last Updated: 2024-01-15_
_Aider Comprehension Test Suite for Trading Alerts SaaS V7_
