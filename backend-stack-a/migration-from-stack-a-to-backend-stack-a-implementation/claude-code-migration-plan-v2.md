# Migration Plan for Claude Code (Web): Next.js Stack A → NestJS Backend Stack A

**Project:** Trading Alerts SaaS V7  
**Your Role:** AI Agent responsible for autonomous migration  
**Repository:** [User's GitHub repository with full Next.js codebase]  
**Timeline:** 12-14 weeks (phased approach)  
**Architecture Target:** NestJS Modular Monolith

---

## Context: What You Need to Know

### Project Overview

This is a **Trading Alerts SaaS platform** that:

- Integrates with MetaTrader 5 for forex/gold/crypto trading
- Has a **two-tier model**: FREE (5 symbols) and PRO (15 symbols)
- Currently built as Next.js monolith
- Needs migration to NestJS **before launch** (no users yet)

### Your Scope: Stack A Only

You are migrating **ONLY Backend Stack A** (the core SaaS functionality):

| Part     | Component                    | Current Location                       | Target                              |
| -------- | ---------------------------- | -------------------------------------- | ----------------------------------- |
| Part 2   | Database (Prisma, Cache)     | Next.js `/src/lib/prisma.ts`           | NestJS shared module                |
| Part 3   | Types                        | Next.js `/src/types`                   | npm package `@trading-alerts/types` |
| Part 4   | Tier System                  | Next.js `/src/app/api/tier`            | NestJS business module              |
| Part 5   | Authentication               | Next.js `/src/app/api/auth`            | NestJS shared module                |
| Part 6   | Flask MT5 Service            | External service (don't migrate)       | Integration layer only              |
| Part 7   | OHLCV Data API               | Next.js `/src/app/api/ohlcv`           | NestJS trading module               |
| Part 8   | Dashboard & Layout           | Next.js `/src/app/dashboard`           | NestJS operation module             |
| Part 9   | Charts & Visualization       | Next.js `/src/app/api/charts`          | NestJS trading module               |
| Part 10  | Watchlist System             | Next.js `/src/app/api/watchlist`       | NestJS trading module               |
| Part 11  | Alerts System                | Next.js `/src/app/api/alerts`          | NestJS trading module               |
| Part 12  | E-commerce & Billing         | Next.js `/src/app/api/billing`         | NestJS business module              |
| Part 13  | Settings System              | Next.js `/src/app/api/settings`        | NestJS operation module             |
| Part 14  | Admin Dashboard              | Next.js `/src/app/api/admin`           | NestJS operation module             |
| Part 15  | Notifications & Real-time    | Next.js `/src/app/api/notifications`   | NestJS shared module                |
| Part 16  | Utilities & Infrastructure   | Next.js `/src/lib/utils`               | NestJS shared module                |
| Part 17A | Affiliate Marketing Portal   | Next.js `/src/app/api/affiliate`       | NestJS business module              |
| Part 17B | Affiliate Admin & Automation | Next.js `/src/app/api/affiliate/admin` | NestJS business module              |
| Part 18  | dLocal Payments              | Next.js `/src/app/api/payments`        | NestJS business module              |
| Part 19  | Riseworks Disbursements      | Next.js `/src/app/api/disbursements`   | NestJS business module              |

**DO NOT migrate:**

- Frontend code (stays in Next.js)
- Stack B (being built separately - handles indicators, confluence scores, leaderboard)
- Stack C (MT5 on Contabo VPS)
- Stack D (RAG system)
- Stack E (Chat UI)

### Target Architecture

```
trading-alerts-nestjs/               # New NestJS monorepo
├── apps/
│   └── api/                         # Main Backend Stack A
│       └── src/
├── libs/
│   ├── shared/                      # Foundation modules
│   │   ├── database/                # Part 2: Prisma + Cache
│   │   ├── auth/                    # Part 5: Authentication
│   │   ├── notifications/           # Part 15: Emails, etc.
│   │   └── utils/                   # Part 16: Utilities
│   ├── trading/                     # Trading features
│   │   ├── alerts/                  # Part 11
│   │   ├── watchlist/               # Part 10
│   │   ├── charts/                  # Part 9
│   │   └── ohlcv/                   # Part 7
│   ├── business/                    # Business features
│   │   ├── tier/                    # Part 4
│   │   ├── billing/                 # Part 12
│   │   ├── payments/                # Part 18
│   │   ├── disbursements/           # Part 19
│   │   └── affiliate/               # Part 17A & 17B
│   └── operation/                   # Operation features
│       ├── dashboard/               # Part 8
│       ├── settings/                # Part 13
│       └── admin/                   # Part 14
└── packages/
    └── types/                       # Part 3: Shared TypeScript types
```

---

## Phase 0: Preparation & Analysis

### Step 0.1: Analyze Existing Codebase

**Your Task:**

1. Navigate to the user's Next.js repository
2. Run dependency analysis to find unused packages
3. Document your findings

**Commands to execute:**

```bash
# Navigate to Next.js project
cd ~/projects/nextjs-stack-a-backup

# Quick check for unused dependencies
npx depcheck > unused-deps.txt

# Review output
cat unused-deps.txt
```

**What to analyze:**

- [ ] Which npm packages are unused? (can be removed from new NestJS project)
- [ ] Which packages are critical? (must be installed in NestJS)
- [ ] Are there any custom middleware or plugins? (need special migration attention)
- [ ] What's the current Prisma schema structure?
- [ ] How is authentication currently implemented?
- [ ] What external services are integrated? (Stripe, dLocal, etc.)

**Output Expected:**

Create a file `migration-analysis.md` with:

- List of unused dependencies
- List of critical dependencies
- Notes on complex implementations
- Potential migration challenges

---

### Step 0.2: Setup NestJS Workspace

**Your Task:**

Create a new NestJS monorepo using Nx workspace.

**Commands:**

```bash
cd ~/projects
npx create-nx-workspace@latest trading-alerts-nestjs \
  --preset=nest \
  --appName=api \
  --style=css \
  --nxCloud=false \
  --packageManager=npm

cd trading-alerts-nestjs
```

**Then:**

1. Initialize Git repository
2. Create `.env.local` file (copy structure from Next.js project, don't copy secrets)
3. Setup Railway configuration file `railway.json`
4. Install Prisma and copy existing schema from Next.js project

**What you need to study from the codebase:**

- **Current environment variables:** Look at `.env.example` or `.env` in Next.js project
- **Prisma schema:** Copy from `prisma/schema.prisma` in Next.js project
- **Package dependencies:** Review `package.json` to understand what's needed

**Validation:**

- [ ] `npm run build` succeeds
- [ ] `npm run serve:api` starts server on port 3000
- [ ] Git repository initialized with initial commit

---

## Phase 1: Foundation Layer (Week 3-4)

### Priority: These MUST Be Migrated First

**Why?** All other modules depend on these foundational components.

---

### Part 2: Database Module (Prisma + Cache)

**Your Task:**

Migrate database access layer from Next.js to NestJS.

**What to study in the codebase:**

- **Current Prisma setup:** How is PrismaClient initialized in Next.js?
- **Caching implementation:** Is Redis used? How is caching handled?
- **Database queries:** Look at existing API routes to understand query patterns

**What to create:**

1. **Shared library:** `libs/shared/database`
2. **PrismaService:** Injectable NestJS service wrapping Prisma Client
3. **CacheService:** Redis-based caching service
4. **DatabaseModule:** Global module exporting both services

**Key Requirements:**

- Use `@Global()` decorator for DatabaseModule
- Implement `OnModuleInit` and `OnModuleDestroy` lifecycle hooks
- Add `cleanDatabase()` method for testing
- Configure connection pooling

**If you're unsure about something:**

- **Redis URL format:** Check the Next.js `.env` file for `REDIS_URL`
- **Prisma extensions:** Look for any Prisma middleware or extensions in current codebase
- **Database transaction patterns:** Study how transactions are currently handled

**Validation Criteria:**

- [ ] `PrismaService` connects to database successfully
- [ ] `CacheService` connects to Redis successfully
- [ ] Unit tests pass for both services
- [ ] Can be imported in other modules via `@Global()` decorator

---

### Part 3: Types Package

**Your Task:**

Extract TypeScript types into a standalone npm package.

**What to study in the codebase:**

- **Existing types:** Located in `types/tier.ts` and `types/` directory
- **Symbol definitions:** `FREE_TIER_SYMBOLS` and `PRO_TIER_SYMBOLS` in `types/tier.ts`
- **Tier configuration:** `TIER_CONFIG` in `types/tier.ts` and `lib/tier-config.ts`
- **API response structures:** Look at how API responses are typed
- **Prisma-generated types:** Review `@prisma/client` usage

**What to create:**

1. **Package:** `packages/types/` with its own `package.json` and `tsconfig.json`
2. **Core types (from actual codebase):**

**Tier & Symbols:**

```typescript
export type Tier = 'FREE' | 'PRO';

export const FREE_TIER_SYMBOLS = [
  'BTCUSD', // Bitcoin
  'EURUSD', // Euro
  'USDJPY', // Yen
  'US30', // Dow Jones
  'XAUUSD', // Gold
] as const;

export const PRO_TIER_EXCLUSIVE_SYMBOLS = [
  'AUDJPY', // Forex Cross
  'AUDUSD', // Forex Major
  'ETHUSD', // Crypto - Ethereum
  'GBPJPY', // Forex Cross
  'GBPUSD', // Forex Major
  'NDX100', // Index - Nasdaq 100
  'NZDUSD', // Forex Major
  'USDCAD', // Forex Major
  'USDCHF', // Forex Major
  'XAGUSD', // Commodities - Silver
] as const;

export const PRO_TIER_SYMBOLS = [
  ...FREE_TIER_SYMBOLS,
  ...PRO_TIER_EXCLUSIVE_SYMBOLS,
] as const; // 15 total

export type Symbol = (typeof PRO_TIER_SYMBOLS)[number];
```

**Timeframes:**

```typescript
export type Timeframe =
  | 'M5' // PRO only
  | 'M15' // PRO only
  | 'M30' // PRO only
  | 'H1' // FREE + PRO
  | 'H2' // PRO only
  | 'H4' // FREE + PRO
  | 'H8' // PRO only
  | 'H12' // PRO only
  | 'D1'; // FREE + PRO

export const FREE_TIER_TIMEFRAMES: Timeframe[] = ['H1', 'H4', 'D1'];
export const PRO_TIER_TIMEFRAMES: Timeframe[] = [
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

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M5: '5 Minutes',
  M15: '15 Minutes',
  M30: '30 Minutes',
  H1: '1 Hour',
  H2: '2 Hours',
  H4: '4 Hours',
  H8: '8 Hours',
  H12: '12 Hours',
  D1: '1 Day',
};
```

**Tier Configuration:**

```typescript
export interface TierLimits {
  maxAlerts: number;
  maxWatchlists: number;
  allowedSymbols: string[];
  allowedTimeframes: Timeframe[];
  pricing: {
    monthlyPrice: number;
    yearlyPrice?: number;
    hasFreeTrial: boolean;
    trialDays?: number;
  };
  features: {
    advancedCharts: boolean;
    exportData: boolean;
    apiAccess: boolean;
    prioritySupport: boolean;
  };
}

export const TIER_CONFIG: Record<Tier, TierLimits> = {
  FREE: {
    maxAlerts: 5,
    maxWatchlists: 1,
    allowedSymbols: [...FREE_TIER_SYMBOLS],
    allowedTimeframes: FREE_TIER_TIMEFRAMES,
    pricing: {
      monthlyPrice: 0,
      hasFreeTrial: false,
    },
    features: {
      advancedCharts: false,
      exportData: false,
      apiAccess: false,
      prioritySupport: false,
    },
  },
  PRO: {
    maxAlerts: 20,
    maxWatchlists: 5,
    allowedSymbols: [...PRO_TIER_SYMBOLS],
    allowedTimeframes: PRO_TIER_TIMEFRAMES,
    pricing: {
      monthlyPrice: affiliate_base_price,
      hasFreeTrial: true,
      trialDays: 7,
    },
    features: {
      advancedCharts: true,
      exportData: true,
      apiAccess: true,
      prioritySupport: true,
    },
  },
};
```

**Trial & Subscription Status:**

```typescript
export type TrialStatus =
  | 'NOT_STARTED'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CONVERTED'
  | 'CANCELLED';

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'CANCELED'
  | 'PAST_DUE'
  | 'UNPAID'
  | 'TRIALING';
```

**Alert Types:**

```typescript
// Study codebase to verify these alert types
export type AlertType = 'BUY' | 'SELL' | 'SUPPORT' | 'RESISTANCE';
```

**OHLCV & API Response Types:**

```typescript
export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

**Package name:** `@trading-alerts/types`

**If you're unsure about something:**

- **Symbol list completeness:** Verify all 15 PRO symbols are correctly defined
- **Additional enums:** Search codebase for other enum types that should be shared
- **DTO types:** Look for validation schemas that should become shared types

**Validation Criteria:**

- [ ] Package builds successfully with `npm run build`
- [ ] Types can be imported in NestJS: `import { TradingSymbol } from '@trading-alerts/types'`
- [ ] All 15 PRO symbols are correctly defined
- [ ] All 9 timeframes are correctly defined
- [ ] No TypeScript errors when using exported types

---

### Part 16: Utilities Module

**Your Task:**

Migrate utility functions into shared NestJS library.

**What to study in the codebase:**

- **Utility locations:** Search for files in `/src/lib/utils`, `/src/utils`, `/src/helpers`
- **Validation logic:** Find where email, password, symbol validation happens
- **Formatting helpers:** Look for price formatting, date formatting functions
- **Crypto utilities:** Check password hashing implementation (likely bcrypt)

**What to create:**

1. **Library:** `libs/shared/utils`
2. **Utility classes:**
   - `ValidationUtils`: Symbol, email, price validation
   - `FormattingUtils`: Price, date, symbol formatting
   - `CryptoUtils`: Password hashing, token generation

**Key Requirements:**

- All methods should be **static** (no instance creation needed)
- Throw NestJS exceptions (`BadRequestException`, etc.)
- Include comprehensive JSDoc comments
- Write unit tests for each utility function

**If you're unsure about something:**

- **Bcrypt rounds:** Check current password hashing configuration
- **Validation regex patterns:** Find existing regex for email, symbol validation
- **Price decimal places:** Determine how many decimals are used for different symbols (gold vs forex)

**Validation Criteria:**

- [ ] `ValidationUtils.validateSymbol('XAUUSD')` returns `'XAUUSD'`
- [ ] `ValidationUtils.validateSymbol('invalid')` throws `BadRequestException`
- [ ] `CryptoUtils.hashPassword()` produces bcrypt hashes
- [ ] All utility classes have 90%+ test coverage

---

## Phase 2: Core Infrastructure (Week 5-6)

### Priority: Required for All Features

---

### Part 5: Authentication Module

**Your Task:**

Migrate authentication system to NestJS with **JWT strategy (token-based, not session-based)**.

**Authentication Architecture:**

- **JWT-based authentication** (NOT session-based)
- Uses `@nestjs/jwt` and `passport-jwt` packages
- Stateless tokens (no server-side sessions or cookies)
- Bearer token in `Authorization` header
- Token payload contains: user ID, email, tier
- Token expires in 7 days (configurable)
- No Redis/session store needed for authentication

**What to study in the codebase:**

- **Current auth implementation:** Look at `/src/app/api/auth` or similar
- **JWT configuration:** Find JWT secret, expiration time
- **User registration flow:** Study validation, password hashing, user creation
- **Login flow:** Study credential validation, token generation
- **Protected routes:** See how authentication is enforced

**What to create:**

1. **Library:** `libs/shared/auth`
2. **DTOs:**
   - `LoginDto`: Email + password validation
   - `RegisterDto`: Email + password validation with strength requirements
3. **AuthService:** Registration, login, token generation, user validation
4. **JwtStrategy:** Passport JWT strategy for token validation
5. **Guards:**
   - `JwtAuthGuard`: Protect routes requiring authentication
6. **Decorators:**
   - `@Public()`: Mark routes as public (skip auth)
   - `@CurrentUser()`: Extract user from request

**Key Requirements:**

- Use `@nestjs/passport` and `passport-jwt`
- Hash passwords with bcrypt (10+ rounds)
- JWT tokens expire in 7 days (configurable)
- Validate email format and password strength
- Return user object WITHOUT password field

**If you're unsure about something:**

- **Password requirements:** Check if there are specific password rules (length, complexity)
- **User roles:** Are there user roles beyond tier (e.g., ADMIN, USER)?
- **Refresh tokens:** Is there a refresh token mechanism?

**Validation Criteria:**

- [ ] `POST /auth/register` creates new user with hashed password
- [ ] `POST /auth/login` returns JWT token
- [ ] Protected routes return 401 without valid token
- [ ] `@CurrentUser()` decorator extracts user correctly
- [ ] E2E tests pass for auth flows

---

### Part 4: Tier System Module

**Your Task:**

Implement tier-based access control (FREE vs PRO).

**What to study in the codebase:**

- **Tier configuration:** Review `lib/tier-config.ts` for core tier settings
- **Tier validation:** Study `lib/tier-validation.ts` for validation functions
- **Tier helpers:** Check `lib/tier-helpers.ts` for utility functions
- **Symbol/Timeframe arrays:** Already defined in `types/tier.ts`
- **Subscription model:** How do users upgrade to PRO? (Check billing integration)
- **Tier checks:** Where in the codebase are tier checks performed?

**What to create:**

1. **Library:** `libs/business/tier`
2. **TierService:**
   - Get user tier
   - Upgrade/downgrade tier (with trial support)
   - Check symbol access
   - Check timeframe access
   - Get allowed symbols/timeframes for tier
   - Validate alert/watchlist limits
3. **Guards:**
   - `TierAccessGuard`: Validate symbol AND timeframe access based on user tier
4. **Decorators:**
   - `@RequireTier('PRO')`: Mark routes requiring specific tier
5. **Validation Functions:**
   - `validateTierAccess(tier, symbol)`: Returns `{ allowed, reason? }`
   - `validateTimeframeAccess(tier, timeframe)`: Returns `{ allowed, reason? }`
   - `validateChartAccess(tier, symbol, timeframe)`: Validate combination
   - `canCreateAlert(tier, currentAlerts)`: Check against limit
   - `canAddWatchlistItem(tier, currentItems)`: Check against limit

**Key Requirements from Actual Codebase:**

**FREE Tier:**

- **Symbols:** 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- **Timeframes:** 3 (H1, H4, D1)
- **Chart Combinations:** 15 (5 × 3)
- **Max Alerts:** 5
- **Max Watchlist Items:** 5
- **Rate Limit:** 60 requests/hour
- **Price:** $0
- **Features:** Basic functionality only

**PRO Tier:**

- **Symbols:** 15 (FREE 5 + 10 exclusive: AUDJPY, AUDUSD, ETHUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, USDCAD, USDCHF, XAGUSD)
- **Timeframes:** 9 (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- **Chart Combinations:** 135 (15 × 9)
- **Max Alerts:** 20
- **Max Watchlist Items:** 50
- **Rate Limit:** 300 requests/hour
- **Price:** $ affiliate_base_price/month
- **Trial:** 7 days free trial
- **Features:** Advanced charts, export data, API access, priority support

**Validation Logic:**

- Throw `ForbiddenException` when FREE user tries PRO-only symbol
- Throw `ForbiddenException` when FREE user tries PRO-only timeframe
- Throw `ForbiddenException` when user exceeds alert limit
- Throw `ForbiddenException` when user exceeds watchlist limit
- Clear error messages explaining tier limitations and upgrade path

**If you're unsure about something:**

- **Tier upgrade flow:** How does a user upgrade from FREE to PRO? (Payment integration?)
- **Tier downgrade:** Can users downgrade? What happens to their data?
- **Grace period:** Is there a trial period for PRO tier?

**Validation Criteria:**

- [ ] FREE user can create alert for XAUUSD (FREE tier symbol)
- [ ] FREE user can create alert for BTCUSD (FREE tier symbol)
- [ ] FREE user gets 403 error for ETHUSD (PRO-only symbol)
- [ ] FREE user gets 403 error for GBPUSD (PRO-only symbol)
- [ ] FREE user gets 403 error for M5 timeframe (PRO-only)
- [ ] PRO user can create alerts for all 15 symbols
- [ ] PRO user can use all 9 timeframes
- [ ] `TierAccessGuard` correctly rejects invalid access
- [ ] E2E tests pass for tier validation

---

### Part 15: Notifications Module

**Your Task:**

Migrate email and notification system.

**What to study in the codebase:**

- **Email service:** Find current email implementation (Nodemailer? SendGrid?)
- **Email templates:** Look for email HTML templates
- **Notification triggers:** When are emails sent? (Alert triggered, welcome email, etc.)
- **SMTP configuration:** Get SMTP settings from environment variables

**What to create:**

1. **Library:** `libs/shared/notifications`
2. **EmailService:**
   - Send alert notifications
   - Send welcome emails
   - Send password reset emails
   - Send subscription confirmations
3. **Templates:** HTML email templates (if needed)

**Key Requirements:**

- Use Nodemailer (unless current implementation uses different service)
- HTML email templates with proper formatting
- Async email sending (don't block API responses)
- Error handling (log failures, don't crash)

**If you're unsure about something:**

- **Email provider:** Is it SMTP or service like SendGrid/Mailgun?
- **Email queue:** Are emails queued or sent immediately?
- **Email content:** What exactly should each email type contain?
- **Unsubscribe mechanism:** Is there an unsubscribe feature?

**Validation Criteria:**

- [ ] `EmailService.sendAlertNotification()` sends email successfully
- [ ] Email appears in user's inbox with correct content
- [ ] Failed emails are logged but don't crash the app
- [ ] Unit tests mock email sending

---

## Phase 3: Trading Features (Week 7-8)

### Priority: Core Product Features

---

### Part 11: Alerts System

**Your Task:**

Migrate the core alerts functionality - the heart of the SaaS.

**What to study in the codebase:**

- **Current alerts API:** Review all endpoints in `/src/app/api/alerts`
- **Alert data model:** Check Prisma schema for Alert model
- **Alert creation logic:** Understand validation, business rules
- **Alert triggering:** How are alerts triggered? (Background job? Real-time?)
- **Alert notification flow:** When alert triggers, what happens?

**What to create:**

1. **Library:** `libs/trading/alerts`
2. **DTOs:**
   - `CreateAlertDto`: Symbol, type, price, timeframe validation
   - `UpdateAlertDto`: Partial update validation

**Example CreateAlertDto:**

```typescript
import { IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { Timeframe } from '@trading-alerts/types';

export class CreateAlertDto {
  @IsString()
  @Transform(({ value }) => value.toUpperCase())
  symbol: string;

  @IsEnum(['BUY', 'SELL', 'SUPPORT', 'RESISTANCE'])
  type: AlertType;

  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'])
  timeframe: Timeframe;
}
```

3. **Pipes:**
   - `ParseSymbolPipe`: Transform lowercase to uppercase, validate format
4. **AlertsService:** CRUD operations + business logic
5. **AlertsController:** REST API endpoints
6. **AlertsModule:** Wire everything together

**API Endpoints to implement:**

- `POST /alerts` - Create new alert
- `GET /alerts` - Get all user's alerts
- `GET /alerts/:id` - Get specific alert
- `PATCH /alerts/:id` - Update alert
- `DELETE /alerts/:id` - Delete alert

**Key Requirements:**

- Use `@UseGuards(JwtAuthGuard, TierAccessGuard)` on controller
- Use `ValidationPipe` with `whitelist: true` to strip unknown properties
- Transform symbol to uppercase in DTO
- Validate price is positive number
- Only allow user to access their own alerts
- Use Prisma transactions for complex operations
- Enforce alert limits (5 for FREE, 20 for PRO)

**If you're unsure about something:**

- **Alert types:** Are there more alert types than BUY, SELL, SUPPORT, RESISTANCE?
- **Multiple alerts per symbol:** Can user create multiple alerts for same symbol?
- **Alert expiration:** Do alerts expire after certain time?
- **Alert priority:** Is there any priority system?
- **Triggered alerts:** What happens after alert is triggered? (Delete? Archive? Keep?)

**Validation Criteria:**

- [ ] `POST /alerts` creates alert and returns 201
- [ ] Symbol automatically transforms to uppercase
- [ ] FREE user cannot create GBPUSD alert (403) - PRO-only symbol
- [ ] FREE user cannot create alert with M5 timeframe (403) - PRO-only
- [ ] User can only see their own alerts
- [ ] E2E tests cover all CRUD operations
- [ ] Proper error messages for validation failures
- [ ] Alert limit enforcement (5 for FREE, 20 for PRO)

---

### Part 10: Watchlist System

**Your Task:**

Migrate watchlist functionality (user's saved symbol lists).

**What to study in the codebase:**

- **Watchlist API:** Find existing watchlist endpoints
- **Data model:** Check Prisma schema for Watchlist model
- **Symbol storage:** How are symbols stored? (Array? Separate table?)
- **Max watchlists:** Any limit on number of watchlists per user?

**What to create:**

1. **Library:** `libs/trading/watchlist`
2. **DTOs:**
   - `CreateWatchlistDto`: Name, symbols array
   - `UpdateWatchlistDto`: Update name or symbols
3. **WatchlistService:** CRUD + symbol management
4. **WatchlistController:** REST endpoints
5. **WatchlistModule:** Module definition

**API Endpoints:**

- `POST /watchlists` - Create watchlist
- `GET /watchlists` - Get all user's watchlists
- `GET /watchlists/:id` - Get specific watchlist
- `PATCH /watchlists/:id` - Update watchlist
- `DELETE /watchlists/:id` - Delete watchlist
- `POST /watchlists/:id/symbols` - Add symbol to watchlist
- `DELETE /watchlists/:id/symbols/:symbol` - Remove symbol

**Key Requirements:**

- Validate all symbols in watchlist are within user's tier
- Prevent duplicate symbols in same watchlist
- Apply guards (JwtAuthGuard, TierAccessGuard)
- Enforce watchlist item limits (5 for FREE, 50 for PRO)

**If you're unsure about something:**

- **Default watchlist:** Is there a default watchlist for new users?
- **Max symbols per watchlist:** Any limit?
- **Shared watchlists:** Can watchlists be shared with other users?

**Validation Criteria:**

- [ ] User can create watchlist with multiple symbols
- [ ] FREE user cannot add GBPUSD to watchlist (PRO-only symbol)
- [ ] FREE user cannot exceed 5 watchlist items (limit enforcement)
- [ ] PRO user can have up to 50 watchlist items
- [ ] Symbols are validated and transformed to uppercase
- [ ] E2E tests pass

---

### Part 9: Charts & Visualization

**Your Task:**

Migrate chart data API that serves data for TradingView Lightweight Charts.

**What to study in the codebase:**

- **Chart API endpoints:** Find current chart data endpoints
- **Integration with Flask MT5 Service (Part 6):** How does Next.js call Flask?
- **Data transformation:** How is MT5 data transformed for frontend?
- **Timeframe handling:** How are different timeframes requested?

**What to create:**

1. **Library:** `libs/trading/charts`
2. **ChartService:**
   - Fetch OHLCV data from Flask MT5 service
   - Transform data for TradingView format
   - Cache chart data (use CacheService from Part 2)
3. **ChartController:** REST endpoints
4. **ChartModule:** Module definition

**API Endpoints:**

- `GET /charts/:symbol/:timeframe` - Get chart data
- `GET /charts/:symbol/:timeframe/latest` - Get latest candle

**Key Requirements:**

- Proxy requests to Flask MT5 Service (Part 6)
- Don't duplicate data processing - Flask handles MT5 connection
- Cache responses for 1-5 minutes (depending on timeframe)
- Apply tier validation (FREE/PRO symbols and timeframes)
- Return data in TradingView Lightweight Charts format

**If you're unsure about something:**

- **Flask MT5 Service endpoints:** What are the exact endpoints exposed by Flask?
- **Data format:** What format does Flask return? What format does frontend expect?
- **Historical data limits:** How much historical data to return?
- **Real-time updates:** Is there WebSocket streaming? Or polling?

**Note to Claude Code:**

**⚠️ IMPORTANT:** Part 6 (Flask MT5 Service) is an **external microservice** that you do NOT migrate. You only need to create an **HTTP client** to call it. Study the codebase to find:

1. Flask service URL (environment variable)
2. API endpoints exposed by Flask
3. Request/response formats

If you cannot find this information in the codebase, note it in your migration log and ask the user for Flask API documentation.

**Validation Criteria:**

- [ ] Chart endpoint returns OHLCV data successfully
- [ ] Data is cached appropriately
- [ ] Tier validation works correctly (symbols and timeframes)
- [ ] Integration with Flask service is functional

---

### Part 7: OHLCV Data API

**Your Task:**

Migrate raw OHLCV (Open, High, Low, Close, Volume) data access API.

**What to study in the codebase:**

- **OHLCV endpoints:** Find how raw OHLCV data is currently accessed
- **Difference from Part 9:** Is this different from charts API? (Study both)
- **Data source:** Does this also come from Flask MT5 service?
- **Part 7 purpose:** Part 7 fetches OHLCV data and passes to Part 6 (Flask)

**What to create:**

1. **Library:** `libs/trading/ohlcv`
2. **OhlcvService:** Fetch and process OHLCV data
3. **OhlcvController:** REST endpoints
4. **OhlcvModule:** Module definition

**If you're unsure about something:**

- **Part 7 vs Part 9:** Study the codebase to understand if these are truly separate concerns or if they should be combined
- **Data storage:** Is OHLCV data stored in PostgreSQL or always fetched from Flask?

**Note to Claude Code:**

**⚠️ STUDY NEEDED:** The distinction between Part 7 (OHLCV Data API) and Part 9 (Charts & Visualization) needs clarification:

1. **Study the codebase** to understand if these are:
   - Same thing with different names?
   - Different endpoints serving different purposes?
   - One being raw data, other being chart-formatted data?

2. **If they're the same:** Merge into single library `libs/trading/charts-ohlcv`
3. **If they're different:** Document the distinction in your migration log

**Important:** Part 7 fetches OHLCV data and passes to Part 6. All technical indicator calculations are handled by **Stack B** (not part of this migration).

**Validation Criteria:**

- [ ] OHLCV endpoint returns correct data format
- [ ] Integration with Flask MT5 service works
- [ ] Distinction from Part 9 (if any) is clear
- [ ] No indicator calculations in Stack A (those are in Stack B)

---

## Phase 4: Business Features (Week 9-10)

### Priority: Monetization Features

---

### Part 12: E-commerce & Billing

**Your Task:**

Migrate Stripe/payment integration for PRO tier subscriptions.

**What to study in the codebase:**

- **Current payment implementation:** Find Stripe integration code
- **Subscription flow:** How does user upgrade to PRO?
- **Webhook handling:** How are Stripe webhooks processed?
- **Pricing:** What is the PRO tier price? Monthly? Annual?
- **Payment methods:** What payment methods are supported?

**What to create:**

1. **Library:** `libs/business/billing`
2. **BillingService:**
   - Create checkout session
   - Handle webhooks
   - Manage subscriptions
   - Cancel subscriptions
3. **BillingController:** API endpoints + webhook endpoint
4. **BillingModule:** Module definition

**API Endpoints:**

- `POST /billing/checkout` - Create Stripe checkout session
- `POST /billing/webhook` - Stripe webhook handler
- `GET /billing/subscription` - Get user's subscription status
- `DELETE /billing/subscription` - Cancel subscription

**Key Requirements:**

- Use `stripe` npm package
- Verify webhook signatures
- Update user tier in database after successful payment
- Handle subscription cancellations
- Idempotency for webhook processing
- Support 7-day free trial for PRO tier

**If you're unsure about something:**

- **Stripe keys:** Where are Stripe publishable and secret keys stored?
- **Pricing IDs:** What are the Stripe price IDs for PRO tier?
- **Payment methods:** Credit card only? Or also PayPal, etc.?

**Validation Criteria:**

- [ ] Checkout session creation works
- [ ] Webhook updates user tier correctly
- [ ] Subscription cancellation works
- [ ] Webhook signature verification prevents fraud
- [ ] 7-day trial activation works

---

### Part 18: dLocal Payments

**Your Task:**

Migrate dLocal payment gateway integration (international payments).

**What to study in the codebase:**

- **dLocal implementation:** Find current dLocal integration
- **Use case:** Why is dLocal used in addition to Stripe? (Regional support?)
- **Payment flow:** How does dLocal payment flow work?
- **Webhook handling:** dLocal webhook processing

**What to create:**

1. **Library:** `libs/business/payments`
2. **PaymentsService:** dLocal API calls
3. **PaymentsController:** Endpoints + webhooks
4. **PaymentsModule:** Module definition

**If you're unsure about something:**

- **dLocal vs Stripe:** When is dLocal used vs Stripe? (Region-based routing?)
- **dLocal SDK:** Is there an npm package or REST API?
- **Supported countries:** Which countries use dLocal?

**Validation Criteria:**

- [ ] dLocal payment initiation works
- [ ] Webhooks update user tier
- [ ] Multiple payment methods supported

---

### Part 19: Riseworks Disbursements

**Your Task:**

Migrate Riseworks payment disbursement system (likely for affiliate payouts).

**What to study in the codebase:**

- **Riseworks integration:** Find current implementation
- **Use case:** When are disbursements made? (Affiliate commissions?)
- **Payout flow:** How are payouts initiated and tracked?

**What to create:**

1. **Library:** `libs/business/disbursements`
2. **DisbursementsService:** Riseworks API integration
3. **DisbursementsController:** API endpoints
4. **DisbursementsModule:** Module definition

**If you're unsure about something:**

- **Riseworks purpose:** Confirm this is for affiliate payouts
- **Payout triggers:** When/how are payouts initiated?
- **Minimum payout:** Any minimum amount for disbursement?

**Validation Criteria:**

- [ ] Payout initiation works
- [ ] Payout status tracking works
- [ ] Integration with affiliate system (Part 17)

---

### Part 17A & 17B: Affiliate Marketing System

**Your Task:**

Migrate affiliate marketing platform (portal + admin).

**What to study in the codebase:**

- **Affiliate program structure:** How does affiliate system work?
- **Commission calculation:** How are commissions calculated? (affiliate_commission_percent)
- **Affiliate tracking:** How are referrals tracked? (Cookies? Query params?)
- **Admin features:** What can admins do? (Approve affiliates, view stats, etc.)

**What to create:**

1. **Library:** `libs/business/affiliate`
2. **AffiliateService:**
   - Register affiliate
   - Generate tracking links
   - Calculate commissions
   - Track conversions
3. **AffiliateController:** Affiliate portal endpoints
4. **AffiliateAdminController:** Admin management endpoints
5. **AffiliateModule:** Module definition

**API Endpoints:**

**Affiliate Portal (17A):**

- `POST /affiliate/register` - Become an affiliate
- `GET /affiliate/dashboard` - Affiliate stats
- `GET /affiliate/links` - Get tracking links
- `GET /affiliate/earnings` - View earnings

**Affiliate Admin (17B):**

- `GET /admin/affiliates` - List all affiliates
- `PATCH /admin/affiliates/:id/approve` - Approve/reject affiliate
- `GET /admin/affiliates/:id/stats` - View affiliate performance
- `POST /admin/affiliates/:id/payout` - Initiate payout

**Key Requirements:**

- Track referrals with unique links
- Calculate commissions on successful conversions
- Integrate with Part 19 (Riseworks) for payouts
- Admin guard for admin endpoints

**If you're unsure about something:**

- **Commission rate:** affiliate_commission_percent
- **Cookie duration:** How long do referral cookies last?
- **Approval process:** Are affiliates auto-approved or manually approved?
- **Payout schedule:** When are affiliates paid? (Monthly? On-demand?)

**Validation Criteria:**

- [ ] Affiliate can register and get tracking links
- [ ] Referrals are tracked correctly
- [ ] Commissions calculated accurately
- [ ] Admin can manage affiliates
- [ ] Integration with disbursement system

---

## Phase 5: Operation Features (Week 11-12)

### Priority: Platform Management

---

### Part 14: Admin Dashboard

**Your Task:**

Migrate admin management and monitoring APIs.

**What to study in the codebase:**

- **Admin endpoints:** Find all admin-only API routes
- **Admin permissions:** How is admin access controlled?
- **Admin features:** What can admins do?
  - User management?
  - View all alerts?
  - Platform statistics?
  - Content moderation?

**What to create:**

1. **Library:** `libs/operation/admin`
2. **AdminService:** Admin operations
3. **AdminController:** Admin endpoints
4. **Guards:**
   - `AdminGuard`: Verify user has admin role
5. **AdminModule:** Module definition

**API Endpoints:**

- `GET /admin/users` - List all users
- `GET /admin/users/:id` - Get user details
- `PATCH /admin/users/:id/tier` - Manually change user tier
- `DELETE /admin/users/:id` - Delete user
- `GET /admin/stats` - Platform statistics
- `GET /admin/alerts` - View all alerts (across all users)

**Key Requirements:**

- All endpoints protected by `AdminGuard`
- Admin role stored in database (user.role = 'ADMIN')
- Comprehensive logging of admin actions
- Rate limiting on sensitive operations

**If you're unsure about something:**

- **Admin role assignment:** How does a user become an admin?
- **Admin permissions granularity:** Are there different admin levels?
- **Audit logging:** Are admin actions logged separately?

**Validation Criteria:**

- [ ] Only admin users can access admin endpoints
- [ ] Regular users get 403 on admin routes
- [ ] Admin can modify user tiers
- [ ] Admin actions are logged
- [ ] E2E tests verify admin access control

---

### Part 13: Settings System

**Your Task:**

Migrate user settings and preferences.

**What to study in the codebase:**

- **Settings storage:** How are user preferences stored?
- **Settings types:** What settings exist?
  - Notification preferences?
  - Display preferences?
  - Trading preferences?
- **Settings validation:** Any constraints on setting values?

**What to create:**

1. **Library:** `libs/operation/settings`
2. **SettingsService:** CRUD for user settings
3. **SettingsController:** Settings endpoints
4. **SettingsModule:** Module definition

**API Endpoints:**

- `GET /settings` - Get user settings
- `PATCH /settings` - Update settings
- `POST /settings/reset` - Reset to defaults

**If you're unsure about something:**

- **Settings schema:** What's the complete list of available settings?
- **Default values:** What are the default settings for new users?
- **Settings validation:** Are there rules for valid setting values?

**Validation Criteria:**

- [ ] User can update their settings
- [ ] Invalid settings are rejected
- [ ] Settings persist across sessions

---

### Part 8: Dashboard & Layout

**Your Task:**

Migrate dashboard data API.

**What to study in the codebase:**

- **Dashboard data:** What data is displayed on the dashboard?
- **Aggregations:** Are there statistics, charts, summaries?
- **Real-time data:** Is dashboard data real-time or cached?

**What to create:**

1. **Library:** `libs/operation/dashboard`
2. **DashboardService:** Aggregate and format dashboard data
3. **DashboardController:** Dashboard endpoints
4. **DashboardModule:** Module definition

**API Endpoints:**

- `GET /dashboard` - Get dashboard overview
- `GET /dashboard/stats` - Get statistics
- `GET /dashboard/recent-alerts` - Recent alerts

**If you're unsure about something:**

- **Dashboard layout:** What exactly is shown on the dashboard?
- **Performance:** Are expensive queries cached?

**Note to Claude Code:**

Part 8 might be minimal if the dashboard is mostly frontend rendering with data from other endpoints (alerts, watchlists, etc.). Study the codebase to determine if a separate dashboard API is needed or if it's just aggregating existing endpoints.

**Validation Criteria:**

- [ ] Dashboard endpoint returns expected data
- [ ] Performance is acceptable (< 500ms)
- [ ] Data is user-specific and respects tier

---

## Phase 6: Final Integration & Deployment (Week 13-14)

### Step 6.1: Wire All Modules Together

**Your Task:**

Update the main `AppModule` to import all feature modules.

**What to do:**

1. Edit `apps/api/src/app.module.ts`
2. Import all libraries from `libs/`
3. Configure global pipes, guards, interceptors
4. Setup global exception filter

**Key Configuration:**

```typescript
// Use these decorators/settings:
- @Global() for DatabaseModule
- APP_GUARD provider for JwtAuthGuard (makes all routes protected by default)
- APP_PIPE provider for ValidationPipe (global validation)
- ConfigModule.forRoot({ isGlobal: true })
```

**Validation:**

- [ ] All endpoints are accessible via `/api/*` prefix
- [ ] Authentication works globally
- [ ] Validation works on all DTOs
- [ ] Database connections established

---

### Step 6.2: Generate OpenAPI Documentation

**Your Task:**

Setup Swagger/OpenAPI documentation.

**What to do:**

1. Install `@nestjs/swagger`
2. Configure Swagger in `main.ts`
3. Add API decorators to controllers:
   - `@ApiTags()`
   - `@ApiOperation()`
   - `@ApiResponse()`
   - `@ApiBearerAuth()`
4. Generate OpenAPI JSON file

**Expected Output:**

- Swagger UI at `http://localhost:4000/api/docs`
- OpenAPI JSON file saved to `openapi-stack-a.json`

**Validation:**

- [ ] Swagger UI displays all endpoints
- [ ] Authentication scheme is documented
- [ ] Request/response examples are accurate
- [ ] OpenAPI JSON file is valid

---

### Step 6.3: Setup Testing Infrastructure

**Your Task:**

Ensure comprehensive testing is in place.

**What to do:**

1. Configure Jest for all libraries
2. Create E2E test suite in `apps/api/test/`
3. Setup test database
4. Write E2E tests for critical flows:
   - Authentication
   - Alerts CRUD
   - Tier validation
   - Payment flows
   - Admin operations

**Testing Requirements:**

- **Unit tests:** 80%+ coverage for services
- **E2E tests:** Cover all critical user journeys
- **Test database:** Use separate database URL for tests
- **Test cleanup:** Clean database between tests

**Validation:**

- [ ] `nx test` runs all unit tests
- [ ] `nx e2e api` runs all E2E tests
- [ ] Tests run in CI/CD pipeline
- [ ] Coverage reports generated

---

### Step 6.4: Deployment Configuration

**Your Task:**

Prepare for Railway deployment.

**What to do:**

1. Create `railway.json` configuration
2. Setup environment variables in Railway
3. Configure health check endpoint
4. Setup database connection pooling
5. Configure logging

**Railway Configuration:**

- Build command: `npm run build:api`
- Start command: `node dist/apps/api/main.js`
- Health check: `/health`
- Environment variables: Copy from `.env` (except secrets)

**Validation:**

- [ ] `railway up` deploys successfully
- [ ] Health check endpoint responds
- [ ] Database connection works in production
- [ ] Environment variables loaded correctly

---

### Step 6.5: Integration with Existing Stacks

**Your Task:**

Ensure Backend Stack A integrates with other stacks.

**What to verify:**

1. **Frontend Stack A:** Can Next.js frontend call new NestJS API?
2. **Flask MT5 Service (Part 6):** Chart and OHLCV endpoints work?
3. **Contabo MT5 (Stack C):** Data flows correctly?

**If there are issues:**

- Check CORS configuration
- Verify API base URLs in frontend
- Test Flask service connectivity
- Validate data formats match expectations

**Validation:**

- [ ] Frontend can authenticate users
- [ ] Frontend can create/view alerts
- [ ] Charts display correctly
- [ ] Real-time data flows work

---

## Final Validation Checklist

### Functionality Tests

Run these tests to confirm migration success:

- [ ] **User Registration:** Can create new FREE tier user
- [ ] **User Login:** Can login and receive JWT token
- [ ] **Create Alert (FREE tier):** Can create XAUUSD alert with H1 timeframe
- [ ] **Create Alert (FREE tier - symbol reject):** GBPUSD alert returns 403
- [ ] **Create Alert (FREE tier - timeframe reject):** XAUUSD with M5 timeframe returns 403
- [ ] **Alert Limit (FREE tier):** Cannot create 6th alert (max 5)
- [ ] **Upgrade to PRO:** Payment flow works (7-day trial available)
- [ ] **Create Alert (PRO tier):** Can create GBPUSD alert with M5 timeframe
- [ ] **Alert Limit (PRO tier):** Can create up to 20 alerts
- [ ] **Watchlist CRUD:** Can manage watchlists
- [ ] **Watchlist Limit (FREE tier):** Cannot exceed 5 items
- [ ] **Watchlist Limit (PRO tier):** Can have up to 50 items
- [ ] **Charts:** Can fetch chart data for allowed symbols/timeframes
- [ ] **Admin Access:** Admin can access admin endpoints
- [ ] **Admin Access (reject):** Regular user gets 403 on admin routes
- [ ] **Affiliate Registration:** Can become affiliate
- [ ] **Affiliate Tracking:** Referral links work
- [ ] **Settings Update:** Can save user preferences

### Performance Tests

- [ ] **API Latency:** Average response time < 200ms
- [ ] **Database Queries:** No N+1 queries
- [ ] **Caching:** Frequently accessed data is cached
- [ ] **Load Test:** Handles 50 concurrent users

### Security Tests

- [ ] **Authentication Required:** Protected routes return 401 without token
- [ ] **Tier Validation:** FREE users cannot access PRO features
- [ ] **Admin Protection:** Admin routes require admin role
- [ ] **SQL Injection:** Prisma prevents SQL injection
- [ ] **XSS Protection:** Input validation prevents XSS

### Documentation

- [ ] **OpenAPI Spec:** Complete and accurate
- [ ] **README:** Updated with NestJS setup instructions
- [ ] **Migration Log:** Document all changes and decisions

---

## Common Issues & Solutions

### Issue: "Cannot find module '@trading-alerts/types'"

**Cause:** Types package not built or linked correctly.

**Solution:**

```bash
cd packages/types
npm run build
cd ../..
npm install
```

---

### Issue: "Prisma Client not found"

**Cause:** Prisma Client not generated.

**Solution:**

```bash
npx prisma generate
npm run build
```

---

### Issue: "Authentication not working"

**Cause:** JWT secret mismatch or missing.

**Solution:**

- Verify `JWT_SECRET` in `.env`
- Check Railway environment variables
- Ensure same secret used for signing and verifying

---

### Issue: "CORS errors from frontend"

**Cause:** CORS not configured or incorrect origin.

**Solution:**

```typescript
// In main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
});
```

---

## Notes & Reminders

### What You Should NOT Do

❌ **Don't migrate Part 6 (Flask MT5 Service)** - This is external, just integrate with it  
❌ **Don't migrate Frontend code** - Frontend stays in Next.js  
❌ **Don't build Stack B, C, D, E** - User is handling those separately  
❌ **Don't implement indicator calculations** - Those are in Stack B  
❌ **Don't guess at implementation details** - Study the codebase first  
❌ **Don't skip validation steps** - Test after each phase

### What You SHOULD Do

✅ **Study the codebase thoroughly** before implementing each part  
✅ **Use NestJS best practices** - Pipes, Guards, Decorators, DTOs  
✅ **Write comprehensive tests** - Unit and E2E  
✅ **Document your decisions** - Create migration log  
✅ **Commit frequently** - After each successful part  
✅ **Ask for clarification** - If something is unclear in codebase

### When You're Unsure

If you encounter something ambiguous or missing in the codebase:

1. **Document it** in a `MIGRATION_NOTES.md` file
2. **Make a reasonable assumption** based on NestJS best practices
3. **Flag it for user review** with a comment like:
   ```typescript
   // TODO: Verify this implementation with user
   // Assumption: Password reset tokens expire after 1 hour
   ```
4. **Continue with migration** - Don't block on every uncertainty

---

## Expected Deliverables

At the end of migration, you should have:

1. **✅ NestJS Monorepo**
   - All 20 parts migrated
   - Proper module structure
   - Working Nx workspace

2. **✅ OpenAPI Documentation**
   - Complete API specification
   - Swagger UI accessible
   - Exported JSON file

3. **✅ Test Suite**
   - Unit tests (80%+ coverage)
   - E2E tests (critical paths)
   - Load tests (basic)

4. **✅ Deployment Configuration**
   - Railway configuration
   - Environment variables documented
   - Health checks working

5. **✅ Migration Documentation**
   - `MIGRATION_NOTES.md` with decisions made
   - `CHANGELOG.md` with all changes
   - Updated `README.md`

---

## Timeline Summary

| Week  | Phase   | Focus                                            |
| ----- | ------- | ------------------------------------------------ |
| 1-2   | Phase 0 | Preparation & Analysis                           |
| 3-4   | Phase 1 | Foundation (Database, Types, Utils)              |
| 5-6   | Phase 2 | Infrastructure (Auth, Tier, Notifications)       |
| 7-8   | Phase 3 | Trading Features (Alerts, Watchlist, Charts)     |
| 9-10  | Phase 4 | Business Features (Billing, Payments, Affiliate) |
| 11-12 | Phase 5 | Operation Features (Admin, Settings, Dashboard)  |
| 13-14 | Phase 6 | Integration & Deployment                         |

**Total: 12-14 weeks**

---

## Your Mission, Claude Code

You are an **autonomous agent** responsible for this migration. You have:

- ✅ Full access to the user's GitHub repository
- ✅ Complete visibility into the Next.js codebase
- ✅ Authority to make implementation decisions
- ✅ Ability to study and understand existing patterns

Your goal: **Deliver a production-ready NestJS Backend Stack A** that:

- Maintains all existing functionality
- Follows NestJS best practices
- Includes comprehensive tests
- Has proper documentation
- Is ready for deployment

**Start with Phase 0 and proceed systematically through each phase.**

**Good luck! 🚀**

---

## 📊 Quick Reference: Tier Specifications

| Feature                 | FREE Tier                                | PRO Tier                                                                                   |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Symbols**             | 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) | 15 (FREE + AUDJPY, AUDUSD, ETHUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, USDCAD, USDCHF, XAGUSD) |
| **Timeframes**          | 3 (H1, H4, D1)                           | 9 (M5, M15, M30, H1, H2, H4, H8, H12, D1)                                                  |
| **Chart Combinations**  | 15                                       | 135                                                                                        |
| **Max Alerts**          | 5                                        | 20                                                                                         |
| **Max Watchlist Items** | 5                                        | 50                                                                                         |
| **Rate Limit**          | 60/hour                                  | 300/hour                                                                                   |
| **Price**               | $0                                       | affiliate_base_price/month                                                                 |
| **Free Trial**          | No                                       | 7 days                                                                                     |
| **Advanced Charts**     | ❌                                       | ✅                                                                                         |
| **Export Data**         | ❌                                       | ✅                                                                                         |
| **API Access**          | ❌                                       | ✅                                                                                         |
| **Priority Support**    | ❌                                       | ✅                                                                                         |

**Authentication:** JWT-based (stateless tokens, no sessions)

**Important:** All technical indicator calculations (momentum candles, Keltner channels, etc.) are handled by **Stack B**, not Stack A. Stack A only fetches raw OHLCV data.

---

_Migration Plan Created: 2025-01-31_  
_Version: 2.0.0_  
_Target: NestJS v10 + Nx Workspace_
