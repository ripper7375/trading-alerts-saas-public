# Trading Alerts SaaS - System Architecture

## 1. System Overview

**What the Project Does:**

Trading Alerts SaaS is a web application that enables traders to monitor multiple financial markets (Forex, Crypto, Indices, Commodities) and set automated alerts based on fractal-based support and resistance levels. The system integrates with MetaTrader 5 (MT5) to fetch real-time market data and provides a tiered subscription model (FREE and PRO) with varying levels of access. Additionally, it operates as a **2-sided marketplace** with an affiliate marketing program that allows partners to promote the platform and earn commissions.

**Key Features:**

- Real-time market data visualization from MT5
- Fractal-based support/resistance detection with multi-point trendlines
- Automated alert system when price approaches key levels
- Watchlist management for favorite symbol/timeframe combinations
- Tiered access control (FREE: 5 symbols × 3 timeframes, PRO: 15 symbols × 9 timeframes)
- Subscription management with Stripe integration
- Responsive dashboard built with Next.js 15 and shadcn/ui
- **Affiliate Marketing Program** (2-sided marketplace)
  - Affiliates can register and generate unique referral codes
  - Earn 20% commission on referred PRO subscriptions
  - Dedicated affiliate portal with analytics and payment tracking
  - Admin dashboard for managing affiliates and commission approvals

**Technical Indicators:**

- **Fractal Horizontal Lines V5** (Peak-to-Peak and Bottom-to-Bottom trendlines)
- **Fractal Diagonal Lines V4** (Mixed Peak-Bottom ascending/descending trendlines)

---

## 2. Tech Stack

### Frontend

- **Framework:** Next.js 15 (App Router)
- **Runtime:** React 19
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Charts:** Recharts or lightweight-charts
- **Forms:** React Hook Form + Zod validation
- **Icons:** Lucide React

### Backend (Next.js)

- **API Routes:** Next.js 15 serverless functions
- **Authentication:** NextAuth.js v4.24.5 (Google OAuth + Email/Password, JWT sessions)
- **Database ORM:** Prisma 5
- **Validation:** Zod
- **API Contract:** OpenAPI 3.0 (trading_alerts_openapi.yaml v7.1.0)

### Backend (Flask Microservice)

- **Framework:** Flask 3.x
- **Language:** Python 3.11
- **MT5 Integration:** MetaTrader5 Python package
- **API Contract:** OpenAPI 3.0 (flask_mt5_openapi.yaml)
- **Production Server:** Gunicorn

### Database

- **Primary Database:** PostgreSQL 15
- **Hosting:** Railway
- **ORM:** Prisma (TypeScript)
- **Migrations:** Prisma Migrate

### External Services

- **MT5 Terminal:** MetaTrader 5 (Windows/Linux VPS)
- **Payments:** Stripe (international cards) + dLocal (emerging market local payments)
- **Email:** Resend
- **Deployment:** Vercel (Next.js), Railway (PostgreSQL + Flask)

### AI Development

- **Model:** MiniMax M2 (via OpenAI-compatible API)
- **Validation:** Claude Code
- **Autonomous Builder:** Aider

---

## 3. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      USERS (Browsers)                            │
│    FREE Tier  |  PRO Tier  |  AFFILIATES  |  ADMINS            │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL (Edge Network)                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │           NEXT.JS 15 APPLICATION (SSR + API)               │ │
│  │                                                            │ │
│  │  Frontend:                    Backend API:                │ │
│  │  ├─ Server Components         ├─ /api/alerts             │ │
│  │  ├─ Client Components         ├─ /api/fractals           │ │
│  │  ├─ Dashboard UI              ├─ /api/users              │ │
│  │  ├─ Charts                    ├─ /api/watchlist          │ │
│  │  ├─ Forms                     ├─ /api/auth (NextAuth)    │ │
│  │  ├─ Affiliate Portal          ├─ /api/affiliate/*        │ │
│  │  └─ Admin Dashboard           ├─ /api/admin/affiliates/* │ │
│  │                               └─ /api/webhooks (Stripe)  │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────┬──────────────────────────┬───────────────────────────┘
            │                          │
            │                          │
    ┌───────▼──────────────┐      ┌────────▼──────────────────────┐
    │  PostgreSQL DB   │      │  Flask MT5 Service        │
    │   (Railway)      │      │    (Railway)              │
    │                  │      │                           │
    │ - Users          │      │ - MT5 Connection Pool     │
    │ - Alerts         │      │ - Symbol Router           │
    │ - Watchlists     │      │ - Fractal Detection       │
    │ - Subscriptions  │      │ - Trendline Calc          │
    │ - Affiliates     │      │ - Tier Validation         │
    │ - AffiliateCodes │      │ - Health Monitoring       │
    │ - Commissions    │      └────────┬──────────────────┘
    └──────────────────┘               │ Manages 15 connections
                                       │ (1 per symbol)
                                       ▼
                    ┌──────────────────────────────────────┐
                    │   15 MT5 Terminals (VPS)             │
                    │   Each: 1 symbol × 9 timeframes      │
                    ├──────────────────────────────────────┤
                    │ MT5_01 (AUDJPY)  │ MT5_09 (NZDUSD)  │
                    │ MT5_02 (AUDUSD)  │ MT5_10 (US30)    │
                    │ MT5_03 (BTCUSD)  │ MT5_11 (USDCAD)  │
                    │ MT5_04 (ETHUSD)  │ MT5_12 (USDCHF)  │
                    │ MT5_05 (EURUSD)  │ MT5_13 (USDJPY)  │
                    │ MT5_06 (GBPJPY)  │ MT5_14 (XAGUSD)  │
                    │ MT5_07 (GBPUSD)  │ MT5_15 (XAUUSD)  │
                    │ MT5_08 (NDX100)  │                  │
                    ├──────────────────────────────────────┤
                    │ Each runs 9 chart windows:           │
                    │ M5, M15, M30, H1, H2, H4, H8, H12, D1│
                    │ With fractal indicators loaded       │
                    └──────────────────────────────────────┘

    External Services:
    ├─ Stripe (Int'l Cards + Commissions) ─┐
    ├─ dLocal (Emerging Markets) ──────────┤
    └─ Resend (Email) ──────────────────┐  │
                                        │  │
                                    ┌───▼──▼──────┐
                                    │  Webhooks    │
                                    │  (Vercel)    │
                                    │  - Track refs│
                                    │  - Calc comm.│
                                    │  - Payments  │
                                    └──────────────┘
```

---

## 4. Component Breakdown

### 4.1 Frontend (Next.js - Vercel)

**Location:** `app/` directory

**Responsibilities:**

- Server-side rendering (SSR) for SEO and performance
- Client-side interactivity (forms, real-time updates)
- User authentication UI (login, register, profile)
- Dashboard with charts, alerts, watchlists
- Tier-aware UI (disable PRO features for FREE users)

**Key Files:**

```
app/
├── (marketing)/
│   ├── page.tsx                 # Homepage
│   ├── pricing/page.tsx         # Pricing page
│   └── layout.tsx               # Marketing layout
├── dashboard/
│   ├── page.tsx                 # Dashboard home (Server Component)
│   ├── layout.tsx               # Dashboard layout with nav
│   ├── alerts/
│   │   ├── page.tsx             # Alerts list
│   │   └── [id]/page.tsx        # Alert detail
│   ├── charts/
│   │   └── page.tsx             # Live charts with fractals
│   ├── watchlist/
│   │   └── page.tsx             # Watchlist management
│   └── settings/
│       └── page.tsx             # User settings
├── api/                         # API Routes (serverless functions)
│   ├── alerts/route.ts
│   ├── fractals/[symbol]/[timeframe]/route.ts
│   ├── auth/[...nextauth]/route.ts
│   └── webhooks/stripe/route.ts
└── layout.tsx                   # Root layout

components/
├── ui/                          # shadcn/ui primitives
├── alerts/
│   ├── alert-form.tsx           # Create/edit alert (Client Component)
│   ├── alert-card.tsx           # Display alert
│   └── alert-list.tsx           # List of alerts
├── charts/
│   ├── fractal-chart.tsx        # Chart with fractal indicators
│   └── trendline-overlay.tsx   # Trendline visualization
└── dashboard/
    └── nav.tsx                  # Dashboard navigation
```

**Tech Notes:**

- Default to **Server Components** (async, fetch data directly)
- Use **Client Components** (`'use client'`) only when needed (state, events, hooks)
- Data fetching: Server Components fetch directly, Client Components use `/api` routes
- Real-time updates: Polling (not WebSocket for MVP)

---

### 4.1.1 Affiliate Portal & Admin Dashboard (Part 17)

**Location:** `app/affiliate/` and `app/admin/` directories

**Responsibilities:**

- Affiliate registration, login, and code generation
- Affiliate analytics dashboard (referred users, earnings, payment status)
- Admin management of affiliates (approval, suspension)
- Commission tracking and approval workflow
- Separate authentication system for affiliates (not NextAuth)

**Key Files:**

```
app/
├── affiliate/
│   ├── register/page.tsx          # Affiliate registration form
│   ├── login/page.tsx              # Affiliate login (separate from user login)
│   ├── dashboard/page.tsx          # Affiliate analytics dashboard
│   ├── codes/page.tsx              # Generate and manage referral codes
│   ├── earnings/page.tsx           # Commission tracking and payment requests
│   └── layout.tsx                  # Affiliate portal layout
├── admin/
│   ├── affiliates/
│   │   ├── page.tsx                # List all affiliates
│   │   ├── [id]/page.tsx           # Affiliate detail and management
│   │   ├── pending/page.tsx        # Pending affiliate approvals
│   │   └── commissions/page.tsx    # Commission approval workflow
│   └── layout.tsx                  # Admin layout
└── api/
    ├── affiliate/
    │   ├── auth/
    │   │   ├── register/route.ts   # Affiliate registration endpoint
    │   │   └── login/route.ts      # Affiliate JWT login
    │   ├── codes/
    │   │   ├── route.ts            # Generate/list affiliate codes
    │   │   └── [code]/route.ts     # Code validation and usage
    │   ├── dashboard/route.ts      # Affiliate analytics data
    │   └── earnings/route.ts       # Commission history
    └── admin/
        └── affiliates/
            ├── route.ts            # List/create affiliates
            ├── [id]/route.ts       # Update/delete affiliate
            ├── [id]/approve/route.ts    # Approve affiliate
            ├── [id]/suspend/route.ts    # Suspend affiliate
            └── commissions/
                ├── route.ts        # List commissions
                └── [id]/approve/route.ts # Approve commission payout

components/
├── affiliate/
│   ├── affiliate-code-generator.tsx  # Crypto-secure code generation UI
│   ├── affiliate-stats-cards.tsx     # Analytics cards (referrals, earnings)
│   ├── earnings-table.tsx            # Commission history table
│   └── payment-request-form.tsx      # Request payout form
└── admin/
    ├── affiliate-approval-card.tsx   # Approve/reject affiliate
    ├── affiliate-list-table.tsx      # Admin affiliate management table
    ├── commission-approval-queue.tsx # Commission approval UI
    └── affiliate-accounting-report.tsx # Accounting-style reports
```

**Authentication Pattern (Separate from User Auth):**

```typescript
// Affiliate authentication uses separate JWT (not NextAuth)
// Pattern 7: Separate JWT for affiliates

// lib/auth/affiliate-jwt.ts
import jwt from 'jsonwebtoken';

const AFFILIATE_JWT_SECRET = process.env.AFFILIATE_JWT_SECRET!; // Separate secret

export function generateAffiliateToken(affiliateId: string, email: string) {
  return jwt.sign(
    { affiliateId, email, type: 'affiliate' },
    AFFILIATE_JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyAffiliateToken(token: string) {
  try {
    return jwt.verify(token, AFFILIATE_JWT_SECRET) as AffiliateJWTPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid affiliate token');
  }
}

// Middleware for affiliate routes
export async function affiliateAuthMiddleware(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) throw new UnauthorizedError('No token provided');

  const payload = verifyAffiliateToken(token);
  return payload;
}
```

**Affiliate Code Generation (Crypto-Secure):**

```typescript
// Pattern 8: Crypto-secure affiliate code generation
import crypto from 'crypto';

export function generateAffiliateCode(prefix: string = 'REF'): string {
  // Crypto-secure random bytes (not Math.random)
  const randomBytes = crypto.randomBytes(8);
  const code = randomBytes.toString('base64url').toUpperCase().slice(0, 12);
  return `${prefix}-${code}`;
}
```

**Commission Calculation (Webhook-Only):**

```typescript
// Pattern 9: Commission calculation only in Stripe webhook
// app/api/webhooks/stripe/route.ts

export async function POST(req: Request) {
  const event = await stripe.webhooks.constructEvent(/* ... */);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Check for affiliate referral in metadata
    const affiliateCode = session.metadata?.affiliate_code;

    if (affiliateCode) {
      // Find affiliate code in database
      const code = await prisma.affiliateCode.findUnique({
        where: { code: affiliateCode },
        include: { affiliate: true },
      });

      if (code && code.affiliate.status === 'APPROVED') {
        // Calculate 20% commission
        const subscriptionAmount = session.amount_total / 100; // cents to dollars
        const commissionAmount = subscriptionAmount * 0.2;

        // Create commission record (pending approval)
        await prisma.commission.create({
          data: {
            affiliateId: code.affiliateId,
            userId: session.client_reference_id,
            subscriptionId: session.subscription,
            amount: commissionAmount,
            status: 'PENDING',
            stripeChargeId: session.payment_intent,
          },
        });

        // Increment affiliate code usage count
        await prisma.affiliateCode.update({
          where: { id: code.id },
          data: { usageCount: { increment: 1 } },
        });
      }
    }
  }

  return Response.json({ received: true });
}
```

**Tech Notes:**

- Separate authentication system for affiliates (JWT, not NextAuth)
- Crypto-secure code generation (`crypto.randomBytes`, not `Math.random`)
- Commission calculation ONLY in Stripe webhook (single source of truth)
- Accounting-style reports for admin (Pattern 10)
- All commission payouts require admin approval

---

### 4.2 Backend API (Next.js API Routes - Vercel)

**Location:** `app/api/` directory

**Responsibilities:**

- RESTful API endpoints for frontend
- Authentication and authorization (NextAuth.js)
- Tier validation before data access
- Database operations via Prisma
- Business logic layer
- Webhook handlers (Stripe)

**API Structure:**

```typescript
// Standard pattern for ALL API routes:
export async function GET(req: Request) {
  try {
    // 1. Authentication
    const session = await getServerSession();
    if (!session)
      return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Tier validation (if applicable)
    const userTier = session.user.tier || 'FREE';
    validateChartAccess(userTier, symbol, timeframe);

    // 3. Business logic
    const data = await fetchFractalData();

    // 4. Response matching OpenAPI schema
    return Response.json(data);
  } catch (error) {
    // 5. Error handling
    console.error('Error:', error);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

**Key Endpoints:**

- `GET /api/alerts` - Fetch user's alerts
- `POST /api/alerts` - Create new alert (with tier validation)
- `GET /api/fractals/{symbol}/{timeframe}` - Fetch fractal data from MT5
- `GET /api/users/me` - Get current user profile
- `POST /api/webhooks/stripe` - Handle Stripe payment events

**Tech Notes:**

- All endpoints defined in `docs/trading_alerts_openapi.yaml`
- Auto-generated TypeScript types in `lib/api-client/`
- Tier validation uses `lib/tier/validation.ts`
- Database operations use `lib/db/` utilities

---

### 4.3 Business Logic Layer

**Location:** `lib/` directory

**Responsibilities:**

- Pure business logic (no HTTP, no UI)
- Tier validation utilities
- Database operation wrappers
- Shared utilities and helpers
- Custom React hooks

**Key Modules:**

```
lib/
├── tier/
│   ├── validation.ts            # Tier access validation
│   └── constants.ts             # Tier limits and rules
├── db/
│   ├── prisma.ts                # Prisma client singleton
│   ├── alerts.ts                # Alert CRUD operations
│   ├── users.ts                 # User CRUD operations
│   └── watchlist.ts             # Watchlist CRUD operations
├── utils/
│   ├── date-helpers.ts          # Date formatting (date-fns)
│   └── error-handlers.ts        # Custom error classes
└── hooks/
    ├── use-alerts.ts            # Client-side alert data hook
    └── use-session.ts           # Wrapper for useSession
```

**Separation of Concerns:**

- `lib/tier/` → Tier validation (used by API routes)
- `lib/db/` → Database operations (used by API routes)
- `lib/utils/` → Pure utilities (used everywhere)
- `lib/hooks/` → React hooks (used by Client Components)

---

### 4.4 Database Layer (Prisma + PostgreSQL)

**Location:** `prisma/schema.prisma`

**Responsibilities:**

- Data persistence
- Relational data modeling
- Type-safe database queries
- Migrations

**Schema Overview:**

```prisma
model User {
  id                  String   @id @default(cuid())
  email               String   @unique
  password            String   // Hashed with bcrypt
  name                String?
  tier                String   @default("FREE")  // "FREE" or "PRO"
  role                String   @default("USER")  // "USER" or "ADMIN"
  isActive            Boolean  @default(true)
  emailVerified       DateTime?
  hasUsedThreeDayPlan Boolean  @default(false)  // dLocal 3-day plan anti-abuse
  threeDayPlanUsedAt  DateTime?                  // When 3-day plan was purchased
  lastLoginIP         String?                    // Fraud detection
  deviceFingerprint   String?                    // Fraud detection
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  alerts              Alert[]
  watchlistItems      WatchlistItem[]
  subscription        Subscription?
  payments            Payment[]
  fraudAlerts         FraudAlert[]
}

model Alert {
  id          String   @id @default(cuid())
  userId      String
  symbol      String
  timeframe   String
  condition   String   // "price_near_fractal_horizontal", "price_near_fractal_diagonal", etc.
  targetPrice Double?  // Optional target price for alert
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  triggeredAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isActive])
}

model WatchlistItem {
  id        String   @id @default(cuid())
  userId    String
  symbol    String
  timeframe String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, symbol, timeframe])
  @@index([userId])
}

model Subscription {
  id                     String   @id @default(cuid())
  userId                 String   @unique

  // Payment Provider (Stripe or dLocal)
  paymentProvider        String   // "STRIPE" or "DLOCAL"

  // Stripe fields (nullable for dLocal subscriptions)
  stripeCustomerId       String?  @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  // dLocal fields (nullable for Stripe subscriptions)
  dLocalPaymentId        String?  @unique  // Transaction reference
  dLocalCountry          String?             // Country code (IN, NG, PK, etc.)
  dLocalCurrency         String?             // Local currency (INR, NGN, PKR, etc.)
  dLocalAmount           Float?              // Amount in local currency

  // Shared fields
  planType               String   // "MONTHLY" or "THREE_DAY" (dLocal only)
  amountUsd              Float    // Amount in USD (converted for dLocal)
  status                 String   // "active", "canceled", "past_due", "expired"
  expiresAt              DateTime // Explicit expiry date (critical for dLocal)
  renewalReminderSent    Boolean  @default(false)  // For dLocal manual renewal
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  commissions Commission[]
  payments    Payment[]
}

// Affiliate Marketing Models (Part 17)

model Affiliate {
  id              String   @id @default(cuid())
  email           String   @unique
  password        String   // Hashed with bcrypt
  companyName     String?
  contactName     String
  status          String   @default("PENDING")  // "PENDING", "APPROVED", "SUSPENDED", "REJECTED"
  totalEarnings   Float    @default(0.0)
  totalReferrals  Int      @default(0)
  paymentEmail    String?  // PayPal or bank email for payouts
  taxId           String?  // Tax ID for 1099 reporting
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  affiliateCodes  AffiliateCode[]
  commissions     Commission[]

  @@index([status])
  @@index([email])
}

model AffiliateCode {
  id          String   @id @default(cuid())
  affiliateId String
  code        String   @unique  // Crypto-secure generated code (e.g., "REF-ABC123XYZ")
  usageCount  Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  affiliate   Affiliate @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  commissions Commission[]

  @@index([affiliateId])
  @@index([code])
}

model Commission {
  id              String   @id @default(cuid())
  affiliateId     String
  userId          String?  // User who subscribed (optional if subscription deleted)
  subscriptionId  String?  // Stripe subscription ID
  codeId          String   // Which affiliate code was used
  amount          Float    // Commission amount (20% of subscription)
  status          String   @default("PENDING")  // "PENDING", "APPROVED", "PAID", "REJECTED"
  stripeChargeId  String?  // Stripe payment intent ID for audit trail
  paidAt          DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  affiliate       Affiliate @relation(fields: [affiliateId], references: [id], onDelete: Cascade)
  affiliateCode   AffiliateCode @relation(fields: [codeId], references: [id])
  subscription    Subscription? @relation(fields: [subscriptionId], references: [id])

  @@index([affiliateId])
  @@index([status])
  @@index([createdAt])
}

// System Configuration (Centralized Settings)
// Allows admin to change affiliate percentages dynamically

model SystemConfig {
  id          String   @id @default(cuid())
  key         String   @unique  // "affiliate_discount_percent", "affiliate_commission_percent", etc.
  value       String   // Stored as string, parsed as needed
  valueType   String   // "number", "boolean", "string"
  description String?  // Human-readable description
  category    String   // "affiliate", "payment", "general"
  updatedBy   String?  // Admin user ID who made the change
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@index([category])
  @@index([key])
}

model SystemConfigHistory {
  id         String   @id @default(cuid())
  configKey  String   // Which setting was changed
  oldValue   String   // Previous value
  newValue   String   // New value
  changedBy  String   // Admin user ID or email
  changedAt  DateTime @default(now())
  reason     String?  // Optional: why the change was made

  @@index([configKey])
  @@index([changedAt])
}

// Payment Models (Part 18: dLocal Integration)

model Payment {
  id                 String   @id @default(cuid())
  userId             String
  subscriptionId     String?

  // Payment Provider
  provider           String   // "STRIPE" or "DLOCAL"

  // Transaction Details
  amount             Float    // Amount in original currency
  currency           String   // Currency code (USD, INR, NGN, etc.)
  amountUsd          Float    // Amount converted to USD (for reporting)

  // Provider References
  providerPaymentId  String   @unique  // Stripe charge ID or dLocal transaction ID
  providerStatus     String   // Provider-specific status

  // Metadata
  country            String?  // User's country (for dLocal)
  paymentMethod      String?  // Payment method used (card, UPI, PIX, etc.)
  ipAddress          String?  // IP address for fraud detection
  deviceFingerprint  String?  // Device fingerprint for fraud detection

  // Status and Timestamps
  status             String   // "pending", "completed", "failed", "refunded"
  completedAt        DateTime?
  failedAt           DateTime?
  failedReason       String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscription Subscription? @relation(fields: [subscriptionId], references: [id])

  @@index([userId])
  @@index([provider])
  @@index([status])
  @@index([createdAt])
}

model FraudAlert {
  id                String   @id @default(cuid())
  userId            String

  // Alert Details
  alertType         String   // "3DAY_PLAN_REUSE", "MULTIPLE_ACCOUNTS", "SUSPICIOUS_IP", etc.
  severity          String   // "LOW", "MEDIUM", "HIGH"
  description       String   // Human-readable description of the issue

  // Detection Metadata
  detectedAt        DateTime @default(now())
  ipAddress         String?
  deviceFingerprint String?
  additionalData    Json?    // Flexible field for extra context

  // Admin Review
  reviewedBy        String?  // Admin user ID who reviewed
  reviewedAt        DateTime?
  resolution        String?  // "FALSE_POSITIVE", "BLOCKED", "WARNING_SENT", etc.
  notes             String?  // Admin notes

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([alertType])
  @@index([severity])
  @@index([detectedAt])
}
```

**Migration Workflow:**

1. Update `prisma/schema.prisma`
2. Local: `npx prisma migrate dev --name description`
3. Railway: `DATABASE_URL=[Railway] npx prisma migrate deploy`
4. Verify: `npx prisma studio`

---

### 4.5 Flask MT5 Service (Railway) - Multi-Terminal Architecture

**Location:** `mt5-service/` directory

**Responsibilities:**

- Manage 15 MT5 terminal connections (connection pool)
- Route requests to correct terminal based on symbol
- Fetch real-time market data from appropriate terminal
- Calculate fractal indicators (using MQL5 indicators)
- Calculate trendlines (horizontal and diagonal)
- Validate tier access (double-check)
- Monitor terminal health and auto-reconnect failed terminals
- Provide admin endpoints for terminal management
- Serve fractal data via REST API

**Why Multiple Terminals:**

- PRO tier requires 135 chart combinations (15 symbols × 9 timeframes)
- Single MT5 terminal cannot efficiently handle 135 chart windows
- Solution: 15 terminals × 9 charts each = distributed load (manageable)
- Fault isolation: if one terminal fails, others continue working

**Symbol-to-Terminal Mapping:**

```
MT5_01 → AUDJPY    MT5_09 → NZDUSD
MT5_02 → AUDUSD    MT5_10 → US30
MT5_03 → BTCUSD    MT5_11 → USDCAD
MT5_04 → ETHUSD    MT5_12 → USDCHF
MT5_05 → EURUSD    MT5_13 → USDJPY
MT5_06 → GBPJPY    MT5_14 → XAGUSD
MT5_07 → GBPUSD    MT5_15 → XAUUSD
MT5_08 → NDX100
```

**Structure:**

```
mt5-service/
├── app/
│   ├── __init__.py                      # Flask app factory + pool initialization
│   ├── routes/
│   │   ├── indicators.py                # /api/indicators routes (user-facing)
│   │   └── admin_terminals.py           # /api/admin/terminals routes (admin-only)
│   ├── services/
│   │   ├── mt5_connection_pool.py       # MT5 connection pool manager
│   │   ├── indicator_reader.py          # Indicator buffer reader
│   │   ├── fractal_calculator.py        # Fractal detection logic
│   │   └── health_monitor.py            # Background health monitoring
│   └── middleware/
│       ├── auth.py                      # API key auth (standard + admin)
│       └── tier_validator.py            # Tier validation
├── config/
│   └── mt5_terminals.json               # Terminal configuration (15 terminals)
├── indicators/
│   ├── Fractal_Horizontal_Line_V5.mq5
│   └── Fractal_Diagonal_Line_V4.mq5
├── requirements.txt                     # Python dependencies
├── Dockerfile                           # Container config
├── .env.example
└── run.py                               # Entry point
```

**Key Endpoint (Multi-Terminal):**

```python
# GET /api/indicators/{symbol}/{timeframe}
from app.services.mt5_connection_pool import get_connection_pool

@indicators_bp.route('/api/indicators/<symbol>/<timeframe>', methods=['GET'])
@require_api_key
@validate_tier_access  # Tier validation middleware
def get_indicators(symbol: str, timeframe: str):
    """Fetch indicator data from appropriate MT5 terminal"""
    try:
        # Get connection pool instance
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
        logger.info(f"Fetching {symbol} {timeframe} from {connection.id}")
        data = fetch_indicator_data(connection, symbol, timeframe, bars=1000)

        # Add metadata including which terminal served the request
        data['metadata'] = {
            'symbol': symbol,
            'timeframe': timeframe,
            'bars_returned': len(data.get('ohlc', [])),
            'terminal_id': connection.id,  # Which MT5 served this request
            'fetchedAt': datetime.utcnow().isoformat()
        }

        return jsonify({
            'success': True,
            'data': data
        }), 200

    except Exception as e:
        logger.error(f"Error fetching indicator data: {e}")
        return jsonify({'error': 'Failed to fetch data from MT5'}), 500
```

**Admin Health Endpoint:**

```python
# GET /api/admin/terminals/health (Admin-only)
@admin_terminals_bp.route('/api/admin/terminals/health', methods=['GET'])
@require_admin_api_key
def get_terminals_health():
    """Get health status of all 15 MT5 terminals (Admin only)"""
    try:
        pool = get_connection_pool()
        health = pool.get_health_summary()

        # Add admin-specific metrics
        for symbol, connection in pool.symbol_to_connection.items():
            if symbol in health['terminals']:
                health['terminals'][symbol]['uptime_percentage'] = connection.get_uptime_percentage()
                health['terminals'][symbol]['reconnect_count'] = connection.reconnect_count

        return jsonify(health), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get terminal health'}), 500
```

**Fractal Detection:**

- **Horizontal Lines:** Peak-to-Peak and Bottom-to-Bottom multi-point trendlines
  - Detects fractals using 108-bar pattern (configurable)
  - Connects 3+ fractal points in near-horizontal lines
  - Displays angles (positive for ascending, negative for descending)
- **Diagonal Lines:** Mixed Peak-Bottom trendlines
  - Ascending support (Bottom → Peak)
  - Descending resistance (Peak → Bottom)
  - Requires alternating peak/bottom touches
  - Minimum 4 touches with proper alternation

**Why Separate Service:**

- MT5 Python library requires Python (Next.js is JavaScript)
- MQL5 indicators need MT5 terminal connection
- Isolates MT5 connection from main app
- Can scale independently
- Easier to debug MT5-specific issues

**Multi-Terminal Architecture Benefits:**

- **Scalability:** 15 terminals × 9 charts = 135 total (vs 135 on one terminal)
- **Performance:** Each terminal handles only 9 charts (very manageable load)
- **Fault Tolerance:** If MT5_03 (BTCUSD) fails, other 14 symbols still work
- **Auto-Recovery:** Health monitor automatically reconnects failed terminals
- **Admin Visibility:** Dashboard shows real-time status of all 15 terminals
- **Symbol Routing:** Automatic routing to correct terminal (transparent to clients)

**Deployment Configuration:**

- **Option 1 (Development):** Single VPS with 15 MT5 instances
  - Cost: ~$80/month (32GB RAM, 8 cores)
  - Simpler to manage
  - Single point of failure

- **Option 2 (Production - Recommended):** 3 VPS with 5 MT5 each
  - Cost: ~$150/month (3 × $50)
  - Fault tolerance (if one VPS fails, 10 symbols still work)
  - Better resource distribution
  - Professional reliability

**Reference Documentation:**

- Implementation guide: `docs/flask-multi-mt5-implementation.md`
- Deployment strategy: `docs/mt5-terminal-mapping.md`
- Admin dashboard: `docs/admin-mt5-dashboard-implementation.md`

---

### 4.6 Payment Gateway Architecture (Part 18: dLocal Integration)

**Location:** `app/api/payments/` directory

**Responsibilities:**

- Dual payment provider system (Stripe + dLocal)
- International cards via Stripe (global reach)
- Local payment methods via dLocal (8 emerging markets)
- Currency conversion and exchange rate management
- Early renewal logic for dLocal monthly subscriptions
- 3-day plan anti-abuse protection
- Fraud monitoring and detection
- Payment transaction audit trail

**Supported Countries (dLocal):**

- 🇮🇳 India (INR) - UPI, NetBanking, Cards
- 🇳🇬 Nigeria (NGN) - Bank Transfer, Cards, Mobile Money
- 🇵🇰 Pakistan (PKR) - EasyPaisa, JazzCash, Bank Transfer
- 🇻🇳 Vietnam (VND) - MoMo, ZaloPay, Bank Transfer
- 🇮🇩 Indonesia (IDR) - GoPay, OVO, Bank Transfer
- 🇹🇭 Thailand (THB) - PromptPay, TrueMoney, Bank Transfer
- 🇿🇦 South Africa (ZAR) - EFT, SnapScan, Cards
- 🇹🇷 Turkey (TRY) - Bank Transfer, Cards

**Key Files:**

```
app/
├── api/
│   ├── payments/
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts           # Create Stripe checkout session
│   │   │   ├── portal/route.ts             # Customer portal for management
│   │   │   └── webhook/route.ts            # Stripe webhook handler
│   │   ├── dlocal/
│   │   │   ├── checkout/route.ts           # Create dLocal payment
│   │   │   ├── callback/route.ts           # dLocal payment callback
│   │   │   ├── renew/route.ts              # Manual renewal endpoint
│   │   │   └── webhook/route.ts            # dLocal webhook handler
│   │   ├── provider-select/route.ts        # Return available providers by country
│   │   └── subscription/
│   │       ├── status/route.ts             # Get current subscription status
│   │       └── cancel/route.ts             # Cancel subscription (Stripe only)
│   └── admin/
│       ├── payments/
│       │   └── route.ts                    # Payment transaction list
│       └── fraud-alerts/
│           ├── route.ts                    # Fraud alerts dashboard
│           └── [id]/resolve/route.ts       # Resolve fraud alert

lib/
├── payments/
│   ├── stripe-client.ts                    # Stripe SDK wrapper
│   ├── dlocal-client.ts                    # dLocal API wrapper
│   ├── currency-converter.ts               # USD ↔ Local currency conversion
│   ├── fraud-detector.ts                   # Fraud detection logic
│   └── subscription-manager.ts             # Unified subscription management

components/
└── payments/
    ├── payment-provider-selector.tsx       # Choose Stripe or dLocal
    ├── stripe-checkout-button.tsx          # Stripe checkout UI
    ├── dlocal-checkout-form.tsx            # dLocal payment form
    └── subscription-status-card.tsx        # Display subscription details
```

**Dual Payment Provider System:**

```typescript
// Pattern 11: Payment Provider Selection by Country
// lib/payments/provider-selector.ts

export function getAvailableProviders(countryCode: string): PaymentProvider[] {
  const DLOCAL_COUNTRIES = ['IN', 'NG', 'PK', 'VN', 'ID', 'TH', 'ZA', 'TR'];

  if (DLOCAL_COUNTRIES.includes(countryCode)) {
    // Users in emerging markets can choose Stripe or dLocal
    return ['STRIPE', 'DLOCAL'];
  } else {
    // International users only get Stripe
    return ['STRIPE'];
  }
}
```

**Key Differences: Stripe vs dLocal**

| Feature             | Stripe                                                  | dLocal                                       |
| ------------------- | ------------------------------------------------------- | -------------------------------------------- |
| **Auto-Renewal**    | ✅ Yes (recurring billing)                              | ❌ No (manual renewal)                       |
| **Trial Period**    | ✅ 7-day free trial                                     | ❌ No trial                                  |
| **Payment Methods** | Cards (Visa, MC, Amex)                                  | Local methods (UPI, PIX, Mobile Money, etc.) |
| **Currency**        | USD only                                                | Local currency (INR, NGN, PKR, etc.)         |
| **Plan Types**      | Monthly only                                            | 3-day + Monthly                              |
| **Cancellation**    | ✅ User can cancel anytime                              | ❌ No cancellation (expires naturally)       |
| **Refunds**         | Via Stripe dashboard                                    | Via dLocal dashboard                         |
| **Webhook Events**  | `checkout.session.completed`, `customer.subscription.*` | `payment.completed`, `payment.refunded`      |

**Early Renewal Logic (dLocal Monthly Only):**

```typescript
// Pattern 12: Early Renewal with Stacking Days
// app/api/payments/dlocal/renew/route.ts

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  // Check if subscription is active
  if (subscription && subscription.status === 'active') {
    const now = new Date();
    const expiresAt = new Date(subscription.expiresAt);
    const remainingDays = Math.ceil(
      (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (remainingDays > 0) {
      // Early renewal: Stack remaining days + 30 new days
      const newExpiresAt = new Date(expiresAt);
      newExpiresAt.setDate(newExpiresAt.getDate() + 30);

      // Process payment first
      const payment = await dLocalClient.createPayment({
        amount: 29.0,
        currency: subscription.dLocalCurrency,
        userId: session.user.id,
      });

      if (payment.status === 'completed') {
        // Update subscription with new expiry date
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            expiresAt: newExpiresAt,
            updatedAt: now,
          },
        });

        return NextResponse.json({
          success: true,
          message: `Renewed! ${remainingDays} days + 30 days = ${remainingDays + 30} days total`,
          expiresAt: newExpiresAt,
        });
      }
    }
  }

  return NextResponse.json({ error: 'Renewal failed' }, { status: 400 });
}
```

**3-Day Plan Anti-Abuse Protection:**

```typescript
// Pattern 13: 3-Day Plan One-Time Use Enforcement
// app/api/payments/dlocal/checkout/route.ts

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  const { planType, country, currency } = await req.json();

  if (planType === 'THREE_DAY') {
    // Check if user has already used 3-day plan
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    if (user.hasUsedThreeDayPlan) {
      // Create fraud alert
      await prisma.fraudAlert.create({
        data: {
          userId: user.id,
          alertType: '3DAY_PLAN_REUSE',
          severity: 'MEDIUM',
          description: 'User attempted to purchase 3-day plan more than once',
          ipAddress: req.headers.get('x-forwarded-for'),
          deviceFingerprint: req.headers.get('x-device-fingerprint')
        }
      });

      return NextResponse.json({
        error: 'The 3-day plan can only be purchased once per account. Please choose the monthly plan.',
        errorCode: '3DAY_PLAN_ALREADY_USED'
      }, { status: 403 });
    }

    // Check if user has an active subscription
    const activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        status: 'active',
        expiresAt: { gte: new Date() }
      }
    });

    if (activeSubscription) {
      return NextResponse.json({
        error: 'Cannot purchase 3-day plan while you have an active subscription',
        errorCode: 'ACTIVE_SUBSCRIPTION_EXISTS'
      }, { status: 403 });
    }
  }

  // Proceed with payment creation
  const payment = await dLocalClient.createPayment({...});
  // ...
}
```

**Fraud Monitoring System:**

```typescript
// Pattern 14: Fraud Detection and Admin Dashboard
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

  // Rule 1: Multiple failed payments in short time
  const recentFailedPayments = user.payments.filter(
    (p) =>
      p.status === 'failed' &&
      p.createdAt > new Date(Date.now() - 60 * 60 * 1000) // Last hour
  );

  if (recentFailedPayments.length >= 3) {
    return createFraudAlert(userId, {
      alertType: 'MULTIPLE_FAILED_PAYMENTS',
      severity: 'HIGH',
      description: `${recentFailedPayments.length} failed payments in the last hour`,
    });
  }

  // Rule 2: IP address change with device fingerprint mismatch
  if (user.lastLoginIP && user.lastLoginIP !== context.ipAddress) {
    if (
      user.deviceFingerprint &&
      user.deviceFingerprint !== context.deviceFingerprint
    ) {
      return createFraudAlert(userId, {
        alertType: 'SUSPICIOUS_IP_CHANGE',
        severity: 'MEDIUM',
        description: 'IP address and device fingerprint both changed',
      });
    }
  }

  // Rule 3: 3-day plan reuse attempt (already checked in checkout)
  // Rule 4: Rapid subscription creation/cancellation pattern
  // ... additional rules

  return null;
}
```

**Currency Conversion:**

```typescript
// Pattern 15: Real-Time Currency Conversion
// lib/payments/currency-converter.ts

export async function convertUsdToLocal(
  amountUsd: number,
  targetCurrency: string
): Promise<{ amount: number; rate: number }> {
  // Fetch real-time exchange rate from reliable API
  const rate = await fetchExchangeRate('USD', targetCurrency);

  // Convert amount
  const localAmount = amountUsd * rate;

  // Round to 2 decimal places
  const roundedAmount = Math.round(localAmount * 100) / 100;

  return {
    amount: roundedAmount,
    rate,
  };
}

// Example: $29 USD → ₹2,407 INR (assuming 1 USD = 83 INR)
const { amount, rate } = await convertUsdToLocal(29.0, 'INR');
// amount = 2407.00, rate = 83.00
```

**Subscription Status Management:**

```typescript
// Pattern 16: Unified Subscription Status Check
// lib/payments/subscription-manager.ts

export async function getSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    return {
      tier: 'FREE',
      status: 'none',
      provider: null,
      expiresAt: null,
      canRenew: false,
    };
  }

  const now = new Date();
  const expiresAt = new Date(subscription.expiresAt);
  const isExpired = now > expiresAt;

  if (subscription.paymentProvider === 'STRIPE') {
    // Stripe: Check Stripe API for real-time status
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    return {
      tier: stripeSubscription.status === 'active' ? 'PRO' : 'FREE',
      status: stripeSubscription.status,
      provider: 'STRIPE',
      expiresAt: new Date(stripeSubscription.current_period_end * 1000),
      canRenew: false, // Stripe handles renewal automatically
      autoRenew: true,
    };
  } else {
    // dLocal: Check expiresAt field
    return {
      tier: isExpired ? 'FREE' : 'PRO',
      status: isExpired ? 'expired' : 'active',
      provider: 'DLOCAL',
      expiresAt,
      canRenew: true, // Manual renewal allowed
      autoRenew: false,
      daysRemaining: isExpired
        ? 0
        : Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          ),
    };
  }
}
```

**Tech Notes:**

- Single `Subscription` model for both Stripe and dLocal (provider field distinguishes)
- `Payment` model tracks all transactions for audit trail
- `FraudAlert` model enables admin review of suspicious activity
- Currency conversion happens at checkout time (rate stored in Payment record)
- dLocal subscriptions do NOT auto-renew (manual renewal via email reminders)
- 3-day plan is one-time use per account (enforced at checkout + database constraint)
- Stripe subscriptions use standard Stripe customer portal for cancellation
- dLocal subscriptions expire naturally (no cancellation needed)

---

## 5. Data Flow

### 5.1 User Creates an Alert

```
1. USER clicks "Create Alert" button in dashboard
   │
   ▼
2. FRONTEND (components/alerts/alert-form.tsx - Client Component)
   - Displays form with tier-aware symbol/timeframe dropdowns
   - FREE users see 5 symbols (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) × 3 timeframes (H1, H4, D1)
   - PRO users see all 15 symbols × 9 timeframes
   - User fills: symbol=XAUUSD, timeframe=H1, condition="price_near_fractal"
   - Client-side validation with Zod
   - On submit: fetch('/api/alerts', { method: 'POST', body: {...} })
   │
   ▼
3. API LAYER (app/api/alerts/route.ts)
   - Receives POST /api/alerts request
   - Step 1: Authentication check (getServerSession)
     * If no session → return 401 Unauthorized
   - Step 2: Input validation with Zod
     * Validate symbol, timeframe, condition
     * If invalid → return 400 Bad Request
   - Step 3: Tier validation
     * Get user's tier from session (FREE or PRO)
     * Call validateChartAccess(tier, symbol, timeframe)
     * If FREE user tries AUDJPY (PRO-only) → return 403 Forbidden
   - Step 4: Check alert count limit
     * Count user's existing alerts
     * FREE tier: max 5 alerts
     * PRO tier: max 20 alerts
     * If limit reached → return 403 Forbidden
   - Step 5: Create alert in database
     * Call prisma.alert.create({ data: {...} })
   - Step 6: Return created alert (matching OpenAPI schema)
     * Return 201 Created with alert object
   │
   ▼
4. BUSINESS LOGIC (lib/tier/validation.ts)
   - validateChartAccess(tier, symbol, timeframe)
   - Checks if tier can access symbol (FREE: 5 symbols, PRO: 15 symbols)
   - Checks if tier can access timeframe (FREE: 3 TFs, PRO: 9 TFs)
   - If violation → throw ForbiddenError
   │
   ▼
5. DATABASE LAYER (Prisma)
   - prisma.alert.create({
       data: {
         userId: session.user.id,
         symbol: 'XAUUSD',
         timeframe: 'H1',
         condition: 'price_near_fractal_horizontal',
         isActive: true,
       }
     })
   - PostgreSQL on Railway receives INSERT statement
   - Returns created alert object with id, createdAt, etc.
   │
   ▼
6. API LAYER returns response to FRONTEND
   - Response.json(alert, { status: 201 })
   │
   ▼
7. FRONTEND receives response
   - Form shows success message
   - Redirects to /dashboard/alerts
   - Alert appears in list
```

---

### 5.2 User Views Live Chart with Fractals

```
1. USER navigates to /dashboard/charts?symbol=XAUUSD&timeframe=H1
   │
   ▼
2. FRONTEND (app/dashboard/charts/page.tsx - Server Component)
   - Fetches initial data on server-side
   - Passes to FractalChart Client Component
   │
   ▼
3. FRONTEND (components/charts/fractal-chart.tsx - Client Component)
   - Displays chart with initial fractal data
   - Sets up polling interval (60s for FREE, 30s for PRO)
   - Every N seconds: fetch('/api/fractals/XAUUSD/H1')
   │
   ▼
4. API LAYER (app/api/fractals/[symbol]/[timeframe]/route.ts)
   - Receives GET /api/fractals/XAUUSD/H1
   - Step 1: Authentication (getServerSession)
   - Step 2: Tier validation (validateChartAccess)
   - Step 3: Call Flask MT5 service
     * fetch('http://flask-service/api/fractals/XAUUSD/H1', {
         headers: { 'X-User-Tier': userTier }
       })
   │
   ▼
5. FLASK MT5 SERVICE (mt5-service/app/routes/fractals.py)
   - Receives GET /api/fractals/XAUUSD/H1
   - Middleware validates tier (double-check security)
   - Calls MT5 connector: fetch_fractal_data('XAUUSD', 'H1')
   │
   ▼
6. MT5 CONNECTOR (mt5-service/app/services/fractal_calculator.py)
   - Connects to MT5 terminal (local or VPS)
   - Fetches XAUUSD H1 candles (OHLCV data)
   - Detects fractals using 108-bar pattern
   - Calculates horizontal trendlines:
     * Peak-to-Peak lines (resistance)
     * Bottom-to-Bottom lines (support)
   - Calculates diagonal trendlines:
     * Ascending support (Bottom → Peak)
     * Descending resistance (Peak → Bottom)
   - Returns fractal data with trendlines
   │
   ▼
7. FLASK returns data to Next.js API
   - JSON response with horizontal and diagonal lines
   │
   ▼
8. API LAYER returns data to FRONTEND
   - Response.json({
       symbol,
       timeframe,
       horizontal_lines: [...],
       diagonal_lines: [...],
       metadata
     })
   │
   ▼
9. FRONTEND updates chart
   - FractalChart component receives new data
   - Updates chart visualization with:
     * Red lines for resistance (peak-to-peak, descending)
     * Green lines for support (bottom-to-bottom, ascending)
     * Labels showing touches, bar length, angles
   - Shows "Last updated: X seconds ago"
   - Cycle repeats every N seconds
```

---

### 5.3 Affiliate Referral and Commission Flow

```
1. AFFILIATE registers and generates unique code
   │
   ▼
2. AFFILIATE shares referral link: yourapp.com/register?ref=REF-ABC123XYZ
   │
   ▼
3. NEW USER clicks referral link
   - Referral code stored in session/cookie
   - User proceeds to registration
   │
   ▼
4. NEW USER subscribes to PRO tier
   - Proceeds to Stripe checkout
   - Affiliate code attached to Stripe session metadata
   │
   ▼
5. STRIPE processes payment successfully
   - Sends webhook to /api/webhooks/stripe
   │
   ▼
6. WEBHOOK HANDLER (app/api/webhooks/stripe/route.ts)
   - Verifies Stripe signature
   - Extracts affiliate_code from session.metadata
   - Validates affiliate code exists and affiliate is APPROVED
   │
   ▼
7. COMMISSION CALCULATION (ONLY in webhook)
   - Calculate 20% of subscription amount
   - Create Commission record (status: PENDING)
   - Link to: affiliateId, userId, subscriptionId, codeId
   - Increment affiliateCode.usageCount
   - Update affiliate.totalReferrals
   │
   ▼
8. ADMIN reviews commission in /admin/affiliates/commissions
   - Verifies subscription is legitimate
   - Checks for fraud patterns
   - Approves or rejects commission
   │
   ▼
9. COMMISSION APPROVED
   - Update commission.status = "APPROVED"
   - Update affiliate.totalEarnings += commission.amount
   - Send email notification to affiliate
   │
   ▼
10. AFFILIATE requests payout via /affiliate/earnings
    - Admin processes payment (external to system)
    - Update commission.status = "PAID"
    - Record commission.paidAt timestamp
```

**Key Security Notes:**

- Commission calculation ONLY happens in Stripe webhook (single source of truth)
- Affiliate code stored in Stripe metadata (tamper-proof)
- All commissions require admin approval before payout
- Separate JWT authentication for affiliates (not NextAuth)
- Crypto-secure code generation prevents guessing

---

### 5.4 Payment Flow (Stripe vs dLocal)

#### 5.4.1 Stripe Payment Flow (International Cards)

```
1. USER clicks "Upgrade to PRO" button
   │
   ▼
2. FRONTEND detects user's country (geo-location API)
   - If international (not in dLocal countries) → Only Stripe option shown
   - If emerging market → Show both Stripe and dLocal options
   │
   ▼
3. USER selects Stripe payment method
   │
   ▼
4. FRONTEND calls POST /api/payments/stripe/checkout
   - Includes: priceId (monthly plan), affiliateCode (if referral)
   │
   ▼
5. API creates Stripe Checkout Session
   - Mode: 'subscription' (recurring billing)
   - Price: $29/month with 7-day free trial
   - Metadata: { userId, affiliateCode, country }
   - Success URL: /dashboard?payment=success
   - Cancel URL: /pricing?payment=canceled
   │
   ▼
6. FRONTEND redirects to Stripe Checkout page
   - User enters card details (Stripe-hosted, PCI-compliant)
   - Stripe validates card and processes payment
   │
   ▼
7. STRIPE sends webhook: checkout.session.completed
   - Webhook received at /api/payments/stripe/webhook
   │
   ▼
8. WEBHOOK HANDLER processes payment
   - Verify Stripe signature (security)
   - Extract userId, affiliateCode from metadata
   - Create/update Subscription record:
     * paymentProvider: 'STRIPE'
     * stripeCustomerId, stripePriceId, stripeCurrentPeriodEnd
     * planType: 'MONTHLY'
     * amountUsd: 29.00
     * status: 'active'
     * expiresAt: stripeCurrentPeriodEnd (auto-renews before this date)
   - Create Payment record for audit trail
   - Update User.tier to 'PRO'
   - If affiliateCode present → Calculate 20% commission (see 5.3)
   │
   ▼
9. STRIPE sends email receipt to user
   │
   ▼
10. USER redirected to /dashboard (tier is now PRO)
    - Dashboard shows PRO features unlocked
    - 15 symbols × 9 timeframes available
```

#### 5.4.2 dLocal Payment Flow (Emerging Markets)

```
1. USER clicks "Upgrade to PRO" button
   │
   ▼
2. FRONTEND detects user's country = India (IN)
   - Shows both Stripe and dLocal options
   - dLocal displays local payment methods: UPI, NetBanking, Cards
   - Shows pricing in INR (₹2,407) converted from $29 USD
   │
   ▼
3. USER selects dLocal → chooses plan type
   - Option A: 3-day plan (₹80 / $0.96 USD) - Try before monthly
   - Option B: Monthly plan (₹2,407 / $29 USD) - Full month access
   │
   ▼
4. FRONTEND calls POST /api/payments/dlocal/checkout
   - Includes: planType ('THREE_DAY' or 'MONTHLY'), country, currency, paymentMethod
   │
   ▼
5. API validates 3-day plan eligibility (if applicable)
   - Check if user.hasUsedThreeDayPlan === false
   - Check if user has no active subscription
   - If violations → Return 403 error + create FraudAlert
   │
   ▼
6. API converts USD to INR (real-time exchange rate)
   - $29 USD → ₹2,407 INR (rate: 83.00)
   - Store both amounts in database
   │
   ▼
7. API creates dLocal payment request
   - POST https://api.dlocal.com/v1/payments
   - Body: { amount: 2407, currency: 'INR', country: 'IN', payment_method: 'UPI', ... }
   - dLocal returns payment URL for user to complete
   │
   ▼
8. FRONTEND redirects to dLocal payment page
   - User completes payment (UPI app, NetBanking, etc.)
   - dLocal processes payment
   │
   ▼
9. dLocal sends callback to /api/payments/dlocal/callback
   - Payment status: 'completed' or 'failed'
   │
   ▼
10. CALLBACK HANDLER processes payment
    - If THREE_DAY plan:
      * Create Subscription:
        - paymentProvider: 'DLOCAL'
        - planType: 'THREE_DAY'
        - expiresAt: now + 3 days
        - status: 'active'
      * Update User:
        - tier: 'PRO'
        - hasUsedThreeDayPlan: true
        - threeDayPlanUsedAt: now
    - If MONTHLY plan:
      * Create Subscription:
        - paymentProvider: 'DLOCAL'
        - planType: 'MONTHLY'
        - expiresAt: now + 30 days
        - status: 'active'
      * Update User.tier: 'PRO'
    - Create Payment record for audit trail
    - Send confirmation email
    │
    ▼
11. USER redirected to /dashboard (tier is now PRO)
    - Dashboard shows PRO features unlocked
    - Subscription expiry date displayed (no auto-renewal)
```

#### 5.4.3 dLocal Early Renewal Flow (Monthly Only)

```
1. USER has active dLocal monthly subscription
   - Expires in 10 days (20 days remaining)
   │
   ▼
2. USER clicks "Renew Now" button in dashboard
   │
   ▼
3. FRONTEND calls POST /api/payments/dlocal/renew
   - Includes current subscription ID
   │
   ▼
4. API calculates early renewal:
   - Current expiresAt: 2025-11-27
   - Days remaining: 10 days
   - New expiresAt: 2025-11-27 + 30 days = 2025-12-27
   - Total days from now: 10 + 30 = 40 days
   │
   ▼
5. API creates dLocal payment for ₹2,407 INR
   - Same process as initial monthly payment
   │
   ▼
6. dLocal payment completed
   │
   ▼
7. API updates Subscription:
   - expiresAt: 2025-12-27 (stacked 30 days on top of remaining)
   - updatedAt: now
   - Create new Payment record
   │
   ▼
8. FRONTEND shows success message:
   "Renewed! You now have 40 days of PRO access (10 remaining + 30 new)"
```

#### 5.4.4 dLocal Subscription Expiry Flow

```
1. CRON JOB runs daily at midnight (Vercel Cron or external)
   - Queries all dLocal subscriptions where expiresAt < now + 3 days
   │
   ▼
2. For each expiring subscription:
   - If 3 days before expiry + renewalReminderSent = false:
     * Send email: "Your subscription expires in 3 days. Renew now!"
     * Update renewalReminderSent: true
   - If 1 day before expiry:
     * Send email: "Last chance! Your subscription expires tomorrow."
   - If expiresAt < now (expired):
     * Update Subscription.status: 'expired'
     * Update User.tier: 'FREE'
     * Send email: "Your subscription has expired. Renew to regain PRO access."
   │
   ▼
3. USER receives email and clicks "Renew" link
   - Redirects to /dashboard/billing
   - Shows "Your subscription expired. Click to renew."
   - User clicks renew → Same flow as initial monthly payment
   - New subscription created (expiresAt: now + 30 days)
```

#### 5.4.5 Fraud Detection Flow

```
1. USER attempts suspicious action:
   - Example: Tries to purchase 3-day plan twice
   │
   ▼
2. API detects fraud pattern (lib/payments/fraud-detector.ts)
   - Checks fraud rules
   │
   ▼
3. FraudAlert created in database:
   - alertType: '3DAY_PLAN_REUSE'
   - severity: 'MEDIUM'
   - description: "User attempted to purchase 3-day plan more than once"
   - ipAddress, deviceFingerprint captured
   │
   ▼
4. ADMIN receives notification (email or dashboard badge)
   │
   ▼
5. ADMIN reviews fraud alert in /admin/fraud-alerts
   - Views user history: payments, subscriptions, login IPs
   - Decides action:
     * FALSE_POSITIVE → Dismiss alert
     * WARNING_SENT → Send warning email to user
     * BLOCKED → Block user account (isActive: false)
   │
   ▼
6. ADMIN resolves alert:
   - POST /api/admin/fraud-alerts/[id]/resolve
   - Update FraudAlert:
     * reviewedBy: admin.id
     * reviewedAt: now
     * resolution: 'BLOCKED'
     * notes: "Confirmed abuse pattern. Account blocked."
   - If BLOCKED → Update User.isActive: false
```

**Key Payment Architecture Notes:**

1. **Single Subscription Model:** One `Subscription` record per user, regardless of provider
2. **Provider Field:** Distinguishes Stripe vs dLocal behavior throughout codebase
3. **Explicit Expiry:** Both providers use `expiresAt` field (Stripe syncs from `stripeCurrentPeriodEnd`)
4. **No Auto-Renewal for dLocal:** Manual renewal via email reminders + dashboard button
5. **Early Renewal Stacking:** dLocal monthly allows stacking remaining days (Stripe does not)
6. **Currency Conversion:** Only for dLocal (Stripe stays USD); both store `amountUsd` for reporting
7. **Fraud Prevention:** Multiple layers: hasUsedThreeDayPlan flag, IP tracking, device fingerprinting, admin review
8. **Audit Trail:** Every payment creates `Payment` record with full transaction details
9. **Commission Tracking:** Affiliate commissions calculated for both Stripe and dLocal (same 20% logic)

---

## 6. Authentication Flow

### 6.1 User Registration (Email/Password)

```
1. User fills registration form (/register)
   ↓
2. POST /api/auth/register
   ↓
3. Validate input (email, password, name)
   ↓
4. Hash password with bcrypt
   ↓
5. Create user in database (default tier: FREE, role: USER, password: hashed, emailVerified: null)
   ↓
6. Send verification email (Resend)
   ↓
7. Return success (redirect to /verify-email)
```

### 6.2 User Login (NextAuth.js - Dual Methods)

**Method 1: Email/Password (CredentialsProvider)**

```
1. User submits login form with email/password
   ↓
2. NextAuth.js CredentialsProvider
   ↓
3. Validate email + password against database
   ↓
4. If valid: Create JWT session
   ↓
5. Store session in secure httpOnly cookie
   ↓
6. Redirect to /dashboard
```

**Method 2: Google OAuth (GoogleProvider)**

```
1. User clicks "Sign in with Google" button
   ↓
2. POST /api/auth/signin/google
   ↓
3. Redirect to Google OAuth consent screen
   ↓
4. User authorizes application (scopes: email, profile)
   ↓
5. Google redirects to /api/auth/callback/google with authorization code
   ↓
6. NextAuth exchanges code for access token + user profile
   ↓
7. Check if user exists in database (by email)
   ↓
8a. IF user exists AND emailVerified IS NOT NULL:
    → Link Google account (create Account record)
    → Update user.image from Google if null
    → Create JWT session
    → Redirect to /dashboard
   ↓
8b. IF user exists AND emailVerified IS NULL:
    → REJECT (prevents account takeover attack)
    → Return error: "Cannot link to unverified account"
   ↓
8c. IF user does NOT exist:
    → Create new user (password: null, emailVerified: now(), tier: FREE, image: Google avatar)
    → Create Account record (provider: google, providerAccountId: Google user ID)
    → Create JWT session
    → Redirect to /dashboard
```

**Security Feature: Verified-Only Account Linking**

This prevents the #1 OAuth account takeover attack:

```
Attack Scenario (WITHOUT verified-only linking):
1. Attacker registers victim@gmail.com with password (unverified)
2. Real victim tries "Sign in with Google" with victim@gmail.com
3. System auto-links accounts → Attacker now controls victim's OAuth account

Defense (WITH verified-only linking):
1. Attacker registers victim@gmail.com with password (emailVerified: null)
2. Real victim tries "Sign in with Google" with victim@gmail.com
3. System detects emailVerified IS NULL → REJECTS linking
4. Victim's Google account remains secure
```

### 6.3 Session Management

**NextAuth.js Configuration (Updated for OAuth):**

```typescript
// app/api/auth/[...nextauth]/route.ts
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    // Provider 1: Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),

    // Provider 2: Email/Password
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // Check password (handle OAuth-only users with null password)
        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    // CRITICAL: Verified-only account linking
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        // SECURITY: Prevent account takeover via OAuth
        if (existingUser && !existingUser.emailVerified) {
          console.error('Prevented account takeover attempt:', user.email);
          return false; // REJECT linking to unverified account
        }

        // If new user: Create with FREE tier
        if (!existingUser) {
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
              password: null, // OAuth-only user
              tier: 'FREE',
              role: 'USER',
              accounts: {
                create: {
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                },
              },
            },
          });
        } else {
          // Existing verified user: Link Google account if not already linked
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: 'google',
                providerAccountId: account.providerAccountId,
              },
            },
          });

          if (!existingAccount) {
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }

          // Update profile picture from Google if user doesn't have one
          if (!existingUser.image && user.image) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { image: user.image },
            });
          }
        }
      }

      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      // Initial sign-in
      if (user) {
        token.id = user.id;
        token.tier = user.tier;
        token.role = user.role;
      }

      // Session update (tier changed via subscription)
      if (trigger === 'update' && session?.tier) {
        token.tier = session.tier;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tier = token.tier as 'FREE' | 'PRO';
        session.user.role = token.role as 'USER' | 'ADMIN';
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login', // OAuth errors redirect to login page
  },
};
```

**Database Models (Prisma):**

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?   // Nullable for OAuth-only users
  name          String?
  image         String?   // Profile picture (from Google or upload)
  emailVerified DateTime? // CRITICAL for verified-only linking
  tier          Tier      @default(FREE)
  role          Role      @default(USER)
  isActive      Boolean   @default(true)

  accounts      Account[] // OAuth provider accounts
  alerts        Alert[]
  watchlists    Watchlist[]
  subscription  Subscription?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLogin     DateTime?
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // "oauth"
  provider          String  // "google"
  providerAccountId String  // Google user ID
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

// NO Session model (using JWT sessions)
```

**Protected Routes (Middleware):**

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}
```

---

### 6.4 Affiliate Authentication Flow (Separate from Users)

**Why Separate:** Affiliates are NOT users of the platform; they are partners who promote it. They need different authentication, permissions, and data access.

```
1. Affiliate registers at /affiliate/register
   ↓
2. POST /api/affiliate/auth/register
   ↓
3. Create Affiliate record (status: PENDING)
   ↓
4. Admin approves affiliate at /admin/affiliates/[id]/approve
   ↓
5. Affiliate.status = "APPROVED"
   ↓
6. Affiliate logs in at /affiliate/login
   ↓
7. POST /api/affiliate/auth/login
   ↓
8. Validate email + password (bcrypt)
   ↓
9. Generate JWT token (separate secret: AFFILIATE_JWT_SECRET)
   ↓
10. Return { token, affiliate: { id, email, status, totalEarnings } }
   ↓
11. Client stores token in localStorage
   ↓
12. All affiliate API requests include: Authorization: Bearer <token>
   ↓
13. Server validates with verifyAffiliateToken(token)
```

**Key Differences from User Auth:**

- **Separate JWT secret:** `AFFILIATE_JWT_SECRET` (not NextAuth)
- **Separate session storage:** Token in localStorage (not httpOnly cookie)
- **No NextAuth:** Manual JWT implementation
- **Different permissions:** Affiliates can ONLY access `/api/affiliate/*` routes
- **Approval required:** Affiliates must be approved by admin before login works

**Middleware Protection:**

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // User dashboard routes (NextAuth)
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const session = await getServerSession();
    if (!session) return NextResponse.redirect(new URL('/login', request.url));
  }

  // Affiliate portal routes (JWT)
  if (request.nextUrl.pathname.startsWith('/affiliate')) {
    const token = request.cookies.get('affiliate_token')?.value;
    if (!token)
      return NextResponse.redirect(new URL('/affiliate/login', request.url));

    try {
      verifyAffiliateToken(token);
    } catch {
      return NextResponse.redirect(new URL('/affiliate/login', request.url));
    }
  }

  // Admin routes (NextAuth with role check)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const session = await getServerSession();
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}
```

---

## 7. Tier System

### 7.1 Tier Definitions

| Feature                   | FREE Tier                                | PRO Tier                                                                                                                  |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Price**                 | $0/month                                 | $29/month                                                                                                                 |
| **Symbols**               | 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) | 15 (AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD) |
| **Timeframes**            | 3 (H1, H4, D1)                           | 9 (M5, M15, M30, H1, H2, H4, H8, H12, D1)                                                                                 |
| **Chart Combinations**    | 15 (5 × 3)                               | 135 (15 × 9)                                                                                                              |
| **Max Alerts**            | 5                                        | 20                                                                                                                        |
| **Max Watchlist Items**   | 5                                        | 50                                                                                                                        |
| **API Rate Limit**        | 60 req/hour (1 per minute)               | 300 req/hour (5 per minute)                                                                                               |
| **Chart Update Interval** | 60 seconds                               | 30 seconds                                                                                                                |

### 7.2 Tier Enforcement

**Backend Validation (CRITICAL):**

```typescript
// lib/tier/validation.ts
export function validateChartAccess(
  tier: UserTier,
  symbol: string,
  timeframe: string
) {
  // Validate symbol
  const allowedSymbols = tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  if (!allowedSymbols.includes(symbol)) {
    throw new ForbiddenError(`${tier} tier cannot access ${symbol}`);
  }

  // Validate timeframe
  const allowedTimeframes = tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;
  if (!allowedTimeframes.includes(timeframe)) {
    throw new ForbiddenError(
      `${tier} tier cannot access ${timeframe} timeframe`
    );
  }
}

// lib/tier/constants.ts
export const FREE_SYMBOLS = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'];
export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'];

export const PRO_SYMBOLS = [
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
];
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
];
```

**Used in:**

- Next.js API routes: `app/api/fractals/[symbol]/[timeframe]/route.ts`
- Flask MT5 service: `mt5-service/app/middleware/tier_validator.py`

**Frontend UI (User Experience):**

```typescript
// components/charts/symbol-selector.tsx
<Select>
  {SYMBOLS.map(symbol => (
    <SelectItem
      value={symbol.value}
      disabled={!canAccessSymbol(userTier, symbol.value)}
    >
      {symbol.label}
      {symbol.proOnly && userTier === 'FREE' && ' 🔒 PRO'}
    </SelectItem>
  ))}
</Select>
```

---

## 8. Fractal Indicator System

### 8.1 Fractal Detection Algorithm

**Base Pattern (108-Bar Fractals):**

- Uses configurable N-bar pattern (default: 35 bars = 17 bars each side)
- **Upper Fractal (Peak):** High[i] must be highest among surrounding bars
- **Lower Fractal (Bottom):** Low[i] must be lowest among surrounding bars

**Code Pattern (from MQL5):**

```cpp
bool IsUpperFractal(const double &high[], int index, int side_bars) {
   double center_high = high[index];

   // Check left side
   for(int i = 1; i <= side_bars; i++)
      if(center_high <= high[index - i])
         return false;

   // Check right side
   for(int i = 1; i <= side_bars; i++)
      if(center_high < high[index + i])
         return false;

   return true;
}
```

### 8.2 Horizontal Trendlines (Fractal Horizontal Line V5)

**Purpose:** Connect fractals at similar price levels

**Algorithm:**

1. **Detect fractals** using 108-bar pattern
2. **Find multi-point lines:**
   - Connect 3+ peaks (Peak-to-Peak resistance)
   - Connect 3+ bottoms (Bottom-to-Bottom support)
3. **Tolerance:** ±1.5% or 1.5× ATR
4. **Angle calculation:** ATR-normalized (preserves sign)
   - Positive angle = ascending
   - Negative angle = descending
5. **Scoring system:**
   - Fractals touched × 25 points
   - Slope quality × 15 points
   - Line length × 10 points
   - Proximity to current price × 50 points
6. **Display:** Top 3 peak lines + top 3 bottom lines

**Alert Conditions:**

- Price approaches fractal peak + nearby trendline
- Price approaches fractal bottom + nearby trendline

### 8.3 Diagonal Trendlines (Fractal Diagonal Line V4)

**Purpose:** Detect trendline channels with alternating peaks/bottoms

**Algorithm:**

1. **Detect fractals** using same 108-bar pattern
2. **Find diagonal lines:**
   - **Ascending Support:** Bottom → Peak (positive slope)
   - **Descending Resistance:** Peak → Bottom (negative slope)
3. **Mixed touch requirement:**
   - Minimum 4 total touches
   - At least 2 peaks AND 2 bottoms
   - Maximum 2 consecutive same-type touches (alternating pattern)
4. **Angle filtering:** 2° to 45° (configurable)
5. **Display:** Top 3 ascending + top 3 descending lines

**Alert Conditions:**

- Price approaches diagonal support line
- Price approaches diagonal resistance line

### 8.4 Performance Optimizations

Both indicators include advanced optimizations:

1. **Slope Filter:** Pre-filters invalid slopes before full calculation
2. **Spatial Grid:** 20×20 grid indexes fractals by location for faster lookup
3. **Line Cache:** Caches calculated lines when fractal map unchanged
4. **Early Exit:** Stops searching after finding N high-quality lines

**Performance Impact:**

- 60-80% reduction in calculation time
- Caching prevents redundant recalculation
- Spatial indexing reduces O(n²) to O(n log n)

---

## 9. Deployment Architecture

### 9.1 Production Environment

```
┌──────────────────────────────────────────────────────────┐
│                  VERCEL (Next.js)                         │
│  - Auto-deploy from GitHub main branch                   │
│  - Serverless functions for API routes                   │
│  - Edge runtime for middleware                           │
│  - Environment variables: NEXTAUTH_SECRET, DATABASE_URL  │
└──────────┬───────────────────────────┬─────────────────────┘
           │                        │
           ▼                        ▼
┌──────────────────┐      ┌──────────────────────┐
│  RAILWAY         │      │  RAILWAY             │
│  PostgreSQL      │      │  Flask MT5 Service   │
│                  │      │                      │
│  - Production DB │      │  - Docker container  │
│  - Auto backups  │      │  - Python 3.11       │
│  - Migrations    │      │  - MT5 connection    │
└──────────────────┘      └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │  MT5 Terminal        │
                          │  (Windows VPS)       │
                          │                      │
                          │  - Broker: [Your]    │
                          │  - Real-time data    │
                          │  - Fractal Indicators│
                          └──────────────────────┘
```

### 9.2 Deployment Steps

**1. Next.js (Vercel):**

```bash
# Connect GitHub repo to Vercel
# Configure environment variables:
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=[generated-secret]
DATABASE_URL=[Railway PostgreSQL URL]
FLASK_MT5_URL=https://your-flask-service.railway.app
STRIPE_SECRET_KEY=[Stripe secret]
RESEND_API_KEY=[Resend API key]

# Vercel auto-deploys on push to main
git push origin main
```

**2. PostgreSQL (Railway):**

```bash
# Already deployed in Phase 2
# Run migrations:
DATABASE_URL=[Railway URL] npx prisma migrate deploy
```

**3. Flask MT5 Service (Railway):**

```bash
# Push to Railway
railway up

# Configure environment variables:
MT5_SERVER=[broker server]
MT5_LOGIN=[MT5 account]
MT5_PASSWORD=[MT5 password]
FLASK_API_KEY=[same as Next.js]
```

**4. MT5 Terminal Setup:**

```
1. Install MT5 on Windows VPS or local machine
2. Copy indicator files to MT5 Indicators folder:
   - Fractal_Horizontal_Line_V5.mq5
   - Fractal_Diagonal_Line_V4.mq5
3. Compile indicators in MetaEditor
4. Connect Flask service to MT5 terminal
5. Test indicator data retrieval
```

---

## 10. AI Development with MiniMax M2

### 10.1 Policy-Driven Development

**Workflow:**

```
1. Create 6 Policy Documents (Phase 1)
   - 01-approval-policies.md
   - 02-quality-standards.md
   - 03-architecture-rules.md
   - 04-escalation-triggers.md
   - 05-coding-patterns.md
   - 06-aider-instructions.md

2. Configure Aider with MiniMax M2
   - .aider.conf.yml loads all policies
   - MiniMax M2 API for cost-effective building

3. Autonomous Building (Phase 3)
   - Aider builds files following policies
   - Auto-validates with Claude Code
   - Auto-approves if quality standards met
   - Auto-fixes common issues
   - Escalates complex decisions to human

4. Human Role
   - Handles escalations (1-2 per part)
   - Makes architectural decisions
   - Tests completed features
   - Updates policies based on learnings
```

### 10.2 Cost-Effectiveness

**MiniMax M2 vs Alternatives:**

- MiniMax M2: ~80% cheaper than Claude/GPT-4
- Quality: Sufficient for code generation with validation
- Validation: Claude Code ensures quality regardless of model
- Result: 170+ files built at fraction of cost

---

## 11. Seed Code Foundation

### 11.1 Reference Repositories

**1. market_ai_engine.py (Flask/MT5 Reference):**

- **What:** Python Flask server with MT5 integration
- **Used for:** Part 6 (Flask MT5 Service)
- **Reference patterns:**
  - Flask route structure
  - MT5 connection handling
  - Indicator data fetching
  - Error handling in Python

**2. nextjs/saas-starter (Backend/Auth Reference):**

- **What:** Next.js SaaS template with auth, database, payments
- **Used for:** Parts 5 (Auth), 7 (API Routes), 12 (E-commerce), **Part 17 (Affiliate Marketing)**
- **Reference patterns:**
  - NextAuth.js configuration
  - Prisma database patterns
  - Stripe payment integration
  - API route structure
  - Middleware patterns
  - **Stripe webhook handling (critical for commission calculation)**

**3. next-shadcn-dashboard-starter (Frontend/UI Reference):**

- **What:** Next.js dashboard with shadcn/ui components
- **Used for:** Parts 8-14 (All UI components), **Part 17 (Affiliate Portal & Admin Dashboard)**
- **Reference patterns:**
  - Dashboard layout structure
  - shadcn/ui component usage
  - Chart components (Recharts)
  - Form patterns (React Hook Form)
  - Navigation structure
  - Responsive design
  - **Analytics dashboards (for affiliate earnings tracking)**
  - **Admin management interfaces (for affiliate approval workflow)**

### 11.2 How Aider Uses Seed Code

**Aider references seed code as:**

- **Inspiration** (not copy/paste)
- **Pattern reference** (adapt to our requirements)
- **Best practices** (proven approaches)

**Always adapted for:**

- Our OpenAPI contracts
- Our tier system (FREE: 5×3, PRO: 15×9)
- Our specific business logic (fractal-based alerts)
- Our quality standards

---

## 12. Security Considerations

### 12.1 Authentication & Authorization

- ✅ NextAuth.js for session management
- ✅ JWT-based sessions (secure, httpOnly cookies)
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Protected routes with middleware
- ✅ API routes check session on every request

### 12.2 Tier Security

- ✅ Backend validation on ALL tier-restricted endpoints
- ✅ Double validation (Next.js + Flask)
- ✅ Frontend disables UI (UX), backend enforces (security)
- ✅ Never trust client-provided tier information

### 12.3 Input Validation

- ✅ Zod schemas validate all user inputs
- ✅ OpenAPI specs define valid request shapes
- ✅ Prisma prevents SQL injection
- ✅ React automatically escapes XSS

### 12.4 Secrets Management

- ✅ All secrets in environment variables
- ✅ .env files gitignored
- ✅ .env.example with placeholders
- ✅ No secrets in logs or error messages

---

## Summary

This architecture enables:

- ✅ **Scalability:** Serverless Next.js, independent Flask service
- ✅ **Security:** Multi-layer validation, NextAuth.js + separate affiliate JWT, Prisma, fraud detection
- ✅ **Performance:** Server Components, edge runtime, polling, optimized indicators
- ✅ **Maintainability:** TypeScript, OpenAPI contracts, Prisma
- ✅ **Cost-Effectiveness:** Vercel free tier, Railway affordable, MiniMax M2 AI
- ✅ **Developer Experience:** Policy-driven AI development, 80% autonomous building
- ✅ **Trading Accuracy:** Advanced fractal detection with multi-point trendlines
- ✅ **2-Sided Marketplace:** Affiliate marketing program with commission tracking
- ✅ **Revenue Growth:** 20% commission model incentivizes partner promotion
- ✅ **Global Payment Reach:** Dual payment providers (Stripe + dLocal for 8 emerging markets)
- ✅ **Local Currency Support:** USD + 8 local currencies (INR, NGN, PKR, VND, IDR, THB, ZAR, TRY)
- ✅ **Flexible Plans:** Monthly (Stripe + dLocal) + 3-day trial (dLocal only)
- ✅ **Fraud Protection:** Multi-layer anti-abuse system with admin monitoring dashboard

**Project Scale:** **18 Parts**, **289 files total** (170 core + 67 affiliate/admin + **52 dLocal payment**)

**Payment Providers:**

- **Stripe:** International cards (auto-renewal, 7-day trial, monthly only)
- **dLocal:** Local payment methods in 8 countries (manual renewal, 3-day + monthly plans)

**Supported Markets:**

- 🌍 Global (Stripe): Visa, Mastercard, Amex (USD)
- 🇮🇳 India: UPI, NetBanking, Cards (INR)
- 🇳🇬 Nigeria: Bank Transfer, Mobile Money (NGN)
- 🇵🇰 Pakistan: EasyPaisa, JazzCash (PKR)
- 🇻🇳 Vietnam: MoMo, ZaloPay (VND)
- 🇮🇩 Indonesia: GoPay, OVO (IDR)
- 🇹🇭 Thailand: PromptPay, TrueMoney (THB)
- 🇿🇦 South Africa: EFT, SnapScan (ZAR)
- 🇹🇷 Turkey: Bank Transfer, Cards (TRY)

## **Next Steps:** Proceed to Phase 2 (CI/CD & Database Foundation) or Phase 3 (Autonomous Building with Aider + MiniMax M2).

## Development Workflow - Phase 3: Autonomous Building with Aider

**Last Updated:** 2025-11-24

### Aider's Dual Role

Aider serves as both the **autonomous builder** and **automated validator** for Phase 3:

#### 1. Autonomous Builder

- Generates code following policies from `.aider.conf.yml`
- Applies patterns from `docs/policies/05-coding-patterns.md`
- Follows build orders from `docs/build-orders/part-*.md`
- Creates 170+ files across 18 parts

#### 2. Automated Validator

- Executes validation tools after each file
- Analyzes validation results
- Makes approve/fix/escalate decisions
- Commits approved code automatically

### Validation System Architecture

```
┌─────────────────────────────────────────────────┐
│                   AIDER                         │
│        (Autonomous Builder & Validator)         │
├─────────────────────────────────────────────────┤
│                                                 │
│  Step 1: Read Requirements & Policies           │
│  Step 2: Generate Code                          │
│  Step 3: Run Validation (npm run validate)     │
│          ↓                                      │
│     ┌───────────────────────────┐              │
│     │ AUTOMATED VALIDATION      │              │
│     ├───────────────────────────┤              │
│     │ • TypeScript (tsc)        │              │
│     │ • ESLint (next lint)      │              │
│     │ • Prettier (--check)      │              │
│     │ • Policy Validator        │              │
│     └───────────────────────────┘              │
│          ↓                                      │
│  Step 4: Analyze Results & Decide              │
│  Step 5: Act (Approve/Fix/Escalate)            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Validation Tools

#### 1. TypeScript Compiler (`tsc --noEmit`)

- **Purpose:** Type safety validation
- **Configuration:** `tsconfig.json`
- **Checks:**
  - No `any` types
  - All parameters typed
  - All return types specified
  - Null safety
  - Type consistency

#### 2. ESLint (`next lint`)

- **Purpose:** Code quality validation
- **Configuration:** `.eslintrc.json`
- **Checks:**
  - Code quality rules
  - React hooks usage
  - Import organization
  - Unused variables
  - Console.log statements

#### 3. Prettier (`prettier --check`)

- **Purpose:** Code formatting validation
- **Configuration:** `.prettierrc`
- **Checks:**
  - Consistent formatting
  - Proper indentation
  - Quote style (single quotes)
  - Semicolons
  - Line length (80 characters)

#### 4. Custom Policy Validator

- **Purpose:** Project-specific policy validation
- **Implementation:** `scripts/validate-file.js`
- **Checks:**
  - Authentication checks (protected routes)
  - Tier validation (symbol/timeframe endpoints)
  - Error handling (try-catch blocks)
  - Security patterns (no hardcoded secrets)
  - Input validation (Zod schemas)
  - SQL injection prevention
  - API contract compliance

### Phase 3 Workflow

```
1. START AIDER
   > aider

2. LOAD PART BUILD ORDER
   > /read docs/build-orders/part-11-alerts.md
   > /read docs/implementation-guides/v5_part_k.md

3. BUILD FILES
   > "Build Part 11 following the build order file-by-file"

4. AIDER GENERATES CODE
   [Reads policies, patterns, requirements]
   [Generates file: app/api/alerts/route.ts]

5. AIDER RUNS VALIDATION
   > npm run validate

   Results:
   🔍 TypeScript: ✅ 0 errors
   🔍 ESLint: ✅ 0 errors, 0 warnings
   🔍 Prettier: ✅ Formatted correctly
   🔍 Policies: ✅ 0 Critical, 0 High, 0 Medium, 0 Low

6. AIDER MAKES DECISION
   - 0 Critical ✓
   - 0 High ✓
   → APPROVE

7. AIDER COMMITS
   > git add app/api/alerts/route.ts
   > git commit -m "feat(alerts): add alerts endpoint

   - Validation: 0 Critical, 0 High, 0 Medium, 0 Low
   - Pattern: API Route Pattern
   - Model: MiniMax M2"

8. REPEAT FOR NEXT FILE
   [Continue for all 170+ files]
```

### Decision Criteria

#### ✅ AUTO-APPROVE

- 0 Critical issues
- ≤2 High issues (all auto-fixable)
- TypeScript passes (0 errors)
- ESLint passes (0 errors, 0 warnings)
- Prettier passes
- Policy validator passes

#### 🔧 AUTO-FIX

- Formatting issues → `npm run format`
- ESLint auto-fixable → `npm run lint:fix`
- Import organization
- Minor style issues

**Command:** `npm run fix`

#### 🚨 ESCALATE TO HUMAN

- > 0 Critical issues (security, auth, tier bypass)
- > 2 High issues
- Architectural decisions needed
- Ambiguous requirements

### Success Metrics (Target)

| Metric            | Target       | Indicates            |
| ----------------- | ------------ | -------------------- |
| Auto-Approve Rate | 85-92%       | System working well  |
| Auto-Fix Rate     | 6-12%        | Minor issues caught  |
| Escalation Rate   | 2-5%         | Major issues flagged |
| Validation Time   | <10 sec/file | Fast validation      |

### Commands

```bash
# Complete validation
npm run validate

# Individual validators
npm run validate:types     # TypeScript only
npm run validate:lint      # ESLint only
npm run validate:format    # Prettier only
npm run validate:policies  # Policy validator only

# Auto-fix
npm run fix                # Fix ESLint + Prettier

# Tests
npm test                   # Run Jest tests
```

### Documentation

- **Complete Guide:** `VALIDATION-SETUP-GUIDE.md`
- **Workflow Analysis:** `docs/CLAUDE-CODE-WORKFLOW-ANALYSIS.md`
- **Responsibility Checklist:** `docs/CLAUDE-CODE-VALIDATION-CHECKLIST.md`
- **Aider Instructions:** `docs/policies/06-aider-instructions.md`

---

**Phase 3 Status:** ✅ Ready for autonomous building
**Validation System:** ✅ Fully operational
**Next Step:** Start building with Aider
