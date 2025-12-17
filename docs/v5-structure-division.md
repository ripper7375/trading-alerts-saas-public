# V5 Project Structure Division - 18 Logical Parts

## Overview

The V5 project structure is divided into **18 logical parts** that can be built systematically. Each part represents a cohesive set of files and folders.

---

## PART 1: Foundation & Root Configuration

**Scope:** Root-level configuration files

**Folders & Files:**

```
trading-alerts-saas/
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── .env.local (gitignored)
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── .gitignore
└── README.md
```

**Key Changes from V4:**

- ✅ `next.config.js` - Updated for Next.js 15
- ✅ `package.json` - Next.js 15, React 19 dependencies
- ✅ `.env.example` - 2-tier system variables

**File Count:** ~12 files

---

## PART 2: Database Schema & Migrations

**Scope:** Database layer with Prisma

**Folders & Files:**

```
prisma/
├── schema.prisma
├── seed.ts              # ← Seeds initial admin user
└── migrations/

lib/db/
├── prisma.ts
└── seed.ts              # ← Admin creation script
Create new file: docs/admin-seed-instructions.md
```

# Admin User Creation Guide

## During Development (Part 2: Database)

After creating Prisma schema, create seed script:

**File:** `prisma/seed.ts`

typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
// Create first admin user
const adminEmail = process.env.ADMIN_EMAIL || 'admin@tradingalerts.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

const hashedPassword = await bcrypt.hash(adminPassword, 10);

const admin = await prisma.user.upsert({
where: { email: adminEmail },
update: {},
create: {
email: adminEmail,
name: 'Admin User',
password: hashedPassword,
role: 'ADMIN',
tier: 'PRO',
emailVerified: new Date(),
isActive: true,
},
});

console.log('✅ Admin user created:', admin.email);
}

main()
.catch((e) => {
console.error(e);
process.exit(1);
})
.finally(async () => {
await prisma.$disconnect();
});
Add to package.json:

{
"scripts": {
"db:seed": "ts-node prisma/seed.ts"
},
"prisma": {
"seed": "ts-node prisma/seed.ts"
}
}
Run after first migration:

# Create database

npx prisma migrate dev --name init

# Seed admin user

pnpm db:seed

# Or with custom credentials

ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=SecurePass123! pnpm db:seed
Default Credentials (CHANGE IN PRODUCTION):

Email: admin@davintrade.com
Password: ChangeMe123!
Role: ADMIN
Tier: PRO
First Login:

Go to /login
Login with admin credentials
Change password in Settings
You now have admin access to /admin dashboard

**Key Changes from V4:**

- ✅ `schema.prisma` - 2 tiers (FREE/PRO), WatchlistItem model
- ✅ Remove ENTERPRISE enum
- ✅ Add WatchlistItem model for symbol+timeframe

**File Count:** ~4 files + migrations folder

---

## PART 3: Type Definitions

**Scope:** TypeScript types for V5

**Folders & Files:**

```
types/
├── index.ts
├── indicator.ts
├── alert.ts
├── user.ts
├── tier.ts          # NEW in V5
└── api.ts
```

**Key Changes from V4:**

- ✅ Add `tier.ts` - Tier types and constants
- ✅ Update `user.ts` - Remove ENTERPRISE
- ✅ Update all types for 2-tier system

**File Count:** ~6 files

---

## PART 4: Tier System & Constants

**Scope:** Core tier management system (NEW in V5)

**Folders & Files:**

```
lib/tier/
├── constants.ts     # NEW - TIER_SYMBOLS, TIMEFRAMES
├── middleware.ts    # NEW - Tier access control
└── validator.ts     # NEW - Symbol access validation

lib/config/
└── plans.ts         # Updated for 2 tiers
```

**Key Changes from V5:**

- ✅ NEW folder: `lib/tier/`
- ✅ Timeframes: M5, H12 added; FREE tier limited to 3 timeframes (H1, H4, D1)
- ✅ Symbol lists per tier: FREE (5 symbols), PRO (15 symbols)
- ✅ Access validation functions for BOTH symbols AND timeframes
- ✅ PRO-only timeframes: M5, M15, M30, H2, H8, H12
- ✅ 5 new symbols added: AUDJPY, GBPJPY, NZDUSD, USDCAD, USDCHF

**File Count:** ~4 files

---

## PART 5: Authentication System

**Scope:** Complete auth system with Google OAuth + Email/Password

**Authentication Stack:**

- NextAuth.js v4.24.5 (already installed)
- Google OAuth 2.0 provider
- Email/Password credentials provider
- JWT sessions (serverless-friendly)
- Verified-only account linking (security-first)

**Folders & Files:**

```
app/(auth)/
├── layout.tsx
├── login/page.tsx              # Updated: "Sign in with Google" button
├── register/page.tsx
├── verify-email/page.tsx
├── forgot-password/page.tsx
└── reset-password/page.tsx

app/api/auth/
├── [...nextauth]/route.ts      # Updated: Google OAuth + Credentials providers
├── register/route.ts
├── verify-email/route.ts
├── forgot-password/route.ts
└── reset-password/route.ts

components/auth/
├── register-form.tsx
├── login-form.tsx
├── forgot-password-form.tsx
└── social-auth-buttons.tsx     # Updated: Google OAuth button

lib/auth/
├── auth-options.ts             # Updated: Google OAuth provider, verified-only linking
├── session.ts                  # Updated: tier in session, OAuth user support
├── permissions.ts              # NEW: Tier permissions
└── errors.ts                   # NEW: OAuth error messages

types/
└── next-auth.d.ts              # NEW: Extend NextAuth types for tier, authMethod

prisma/schema.prisma            # Updated: User.password nullable, Account model added
```

**Key Changes from V4:**

- ✅ Default new users to FREE tier (both OAuth and email/password)
- ✅ Add tier to JWT and session
- ✅ NEW: `permissions.ts` for tier-based access
- ✅ **NEW: Google OAuth integration with verified-only linking**
- ✅ **NEW: Account model for OAuth provider linking**
- ✅ **NEW: User.password nullable (OAuth-only users)**
- ✅ **NEW: User.emailVerified auto-set for OAuth users**
- ✅ **NEW: Profile picture from Google OAuth (fallback strategy)**

**OAuth Security Features:**

- 🔒 Verified-only account linking (prevents account takeover)
- 🔒 Auto-verified email for Google OAuth users
- 🔒 Separate auth method tracking (credentials/google/both)
- 🔒 JWT session strategy (no database Session model)

**File Count:** ~19 files (+2 from V4: errors.ts, next-auth.d.ts)

---

## PART 6: Flask MT5 Service

**Scope:** Complete Flask microservice

**Folders & Files:**

```
mt5-service/
├── app/
│   ├── __init__.py
│   ├── routes/
│   │   ├── __init__.py
│   │   └── indicators.py    # Updated: tier validation
│   ├── services/
│   │   ├── __init__.py
│   │   ├── mt5_service.py   # Updated: tier checks, H2/H8
│   │   └── tier_service.py  # NEW: Tier validation
│   └── utils/
│       ├── __init__.py
│       ├── helpers.py
│       └── constants.py     # NEW: Timeframes, symbols
├── indicators/
│   ├── README.md
│   ├── Fractal Horizontal Line_V5.mq5
│   └── Fractal Diagonal Line_V4.mq5
├── tests/
│   └── test_indicators.py
├── Dockerfile
├── .dockerignore
├── requirements.txt
├── run.py
├── .env
└── .env.example
```

**Key Changes from V5:**

- ✅ NEW: `tier_service.py`
- ✅ Updated timeframe mapping: M5, H12 added; 9 total timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- ✅ Tier validation for BOTH symbols AND timeframes before reading indicators
- ✅ Tier parameter in all functions
- ✅ FREE tier validation: 5 symbols × 3 timeframes only
- ✅ PRO tier validation: 15 symbols × 9 timeframes
- ✅ 5 new symbols in MT5 symbol mapping: AUDJPY, GBPJPY, NZDUSD, USDCAD, USDCHF

**File Count:** ~15 files

---

## PART 7: Indicators API & Tier Routes

**Scope:** Next.js API routes for indicators and tier checking

**Folders & Files:**

```
app/api/tier/
├── symbols/route.ts         # NEW: Get allowed symbols
├── check/[symbol]/route.ts  # NEW: Check symbol access
└── combinations/route.ts    # NEW: Symbol+timeframe combos

app/api/indicators/
├── route.ts
└── [symbol]/[timeframe]/route.ts  # Updated: tier validation

lib/api/
└── mt5-client.ts           # Flask API client
```

**Key Changes from V4:**

- ✅ NEW folder: `app/api/tier/`
- ✅ Tier validation in indicators API
- ✅ Symbol access checking before Flask call

**File Count:** ~6 files

---

## PART 8: Dashboard & Layout Components

**Scope:** Main dashboard and layout

**Folders & Files:**

```
app/(dashboard)/
├── layout.tsx              # Updated: Show tier badge
└── dashboard/page.tsx      # Updated: Tier-based stats

components/layout/
├── header.tsx              # Updated: Show tier
├── sidebar.tsx             # Updated: Tier-based menu
├── mobile-nav.tsx
└── footer.tsx

components/dashboard/
├── stats-card.tsx
├── recent-alerts.tsx
└── watchlist-widget.tsx    # Updated: Symbol+timeframe
```

**Key Changes from V4:**

- ✅ Show user tier in header
- ✅ Tier-based navigation items
- ✅ Dashboard stats per tier

**File Count:** ~9 files

---

## PART 9: Charts & Visualization

**Scope:** Trading charts and TradingView integration

**Folders & Files:**

```
app/(dashboard)/charts/
├── page.tsx                # Updated: Tier-filtered symbols
└── [symbol]/[timeframe]/page.tsx  # Updated: Tier check

components/charts/
├── trading-chart.tsx       # Updated: Load from tier-allowed
├── indicator-overlay.tsx
├── chart-controls.tsx
└── timeframe-selector.tsx  # Updated: H2, H8; no M1, M5

hooks/
├── use-indicators.ts       # Updated: Tier validation
└── use-auth.ts
```

**Key Changes from V5:**

- ✅ Timeframe selector: M5, H12 added; FREE tier limited to H1, H4, D1
- ✅ Symbol selector shows tier-allowed symbols (FREE: 5 symbols, PRO: 15 symbols)
- ✅ Chart page validates BOTH symbol AND timeframe access
- ✅ PRO-only timeframes: M5, M15, M30, H2, H8, H12

**File Count:** ~8 files

---

## PART 10: Watchlist System (NEW Structure)

**Scope:** Symbol+Timeframe watchlist management

**Folders & Files:**

```
app/(dashboard)/watchlist/
└── page.tsx                # NEW: Symbol+timeframe UI

app/api/watchlist/
├── route.ts                # Updated: Symbol+timeframe model
├── [id]/route.ts           # Updated: Delete item
└── reorder/route.ts        # NEW: Reorder items

components/watchlist/
├── symbol-selector.tsx     # NEW: Tier-filtered selector
├── timeframe-grid.tsx      # NEW: Timeframe selection
└── watchlist-item.tsx      # NEW: Shows symbol+timeframe

hooks/
└── use-watchlist.ts        # Updated: Symbol+timeframe
```

**Key Changes from V4:**

- ✅ Complete rewrite: Symbol+timeframe combinations
- ✅ Tier-based symbol filtering
- ✅ WatchlistItem model usage

**File Count:** ~8 files

---

## PART 11: Alerts System

**Scope:** Alert management and notifications

**Folders & Files:**

```
app/(dashboard)/alerts/
├── page.tsx
└── new/page.tsx            # Updated: Tier-allowed symbols

app/api/alerts/
├── route.ts                # Updated: Validate symbol access
└── [id]/route.ts

components/alerts/
├── alert-list.tsx
├── alert-form.tsx          # Updated: Tier-filtered symbols
└── alert-card.tsx

lib/jobs/
├── alert-checker.ts        # Background job
└── queue.ts

hooks/
└── use-alerts.ts
```

**Key Changes from V4:**

- ✅ Alert form shows only tier-allowed symbols
- ✅ API validates symbol access before creating alert

**File Count:** ~10 files

---

## PART 12: E-commerce & Billing (2 Tiers)

**Scope:** Subscription and payment system

**Pricing:**

- FREE tier: $0/month (XAUUSD only, 5 alerts)
- PRO tier: $29/month (10 symbols, 20 alerts) # ← CONFIRMED

**Features:**

- Stripe integration for PRO upgrades
- Webhook handling for subscription events
- Invoice management
- Upgrade/downgrade flows

**Folders & Files:**

```
app/(marketing)/pricing/
└── page.tsx                # Updated: FREE vs PRO only

app/api/subscription/
├── route.ts
└── cancel/route.ts         # Downgrade to FREE

app/api/checkout/
└── route.ts                # Pro upgrade only

app/api/invoices/
└── route.ts

app/api/webhooks/stripe/
└── route.ts                # POST handler (Next.js 15 App Router)

components/billing/
├── subscription-card.tsx   # Updated: Show 2 tiers
└── invoice-list.tsx

lib/stripe/
├── stripe.ts
└── webhook-handlers.ts     # Updated: 2-tier handling
```

**Key Changes from V4:**

- ✅ Remove ENTERPRISE tier completely
- ✅ Pricing page: FREE (XAUUSD) vs PRO (10 symbols)
- ✅ Symbol comparison table
- ✅ Upgrade/downgrade flows for 2 tiers

**File Count:** ~11 files

---

## PART 13: Settings System

**Scope:** User settings pages

**Folders & Files:**

```
app/(dashboard)/settings/
├── layout.tsx
├── profile/page.tsx
├── appearance/page.tsx
├── account/page.tsx
├── privacy/page.tsx
├── billing/page.tsx        # Updated: 2 tiers
├── language/page.tsx
└── help/page.tsx

app/api/user/
├── profile/route.ts
├── preferences/route.ts
├── password/route.ts
└── account/
    ├── deletion-request/route.ts
    ├── deletion-confirm/route.ts
    └── deletion-cancel/route.ts

lib/preferences/
└── defaults.ts

components/providers/
├── theme-provider.tsx
└── websocket-provider.tsx
```

**Key Changes from V4:**

- ✅ Billing page: Show FREE/PRO tiers
- ✅ Remove Enterprise mentions

**File Count:** ~17 files

---

## PART 14: Admin Dashboard (Optional for MVP)

**Scope:** Admin pages and APIs

**Folders & Files:**

```
app/(dashboard)/admin/
├── layout.tsx
├── page.tsx                # Updated: Track FREE/PRO distribution
├── users/page.tsx          # Updated: Show user tiers
├── api-usage/page.tsx      # Updated: Usage per tier
└── errors/page.tsx

app/api/admin/
├── users/route.ts
├── analytics/route.ts      # Updated: Tier analytics
├── api-usage/route.ts
└── error-logs/route.ts
```

**Key Changes from V4:**

- ✅ Track FREE vs PRO user distribution
- ✅ Revenue analytics per tier
- ✅ API usage per tier

**File Count:** ~9 files

---

## PART 15: Notifications & Real-time

**Scope:** Notification system and WebSocket

**Folders & Files:**

```
app/api/notifications/
├── route.ts
└── [id]/
    ├── read/route.ts
    └── route.ts

components/notifications/
├── notification-bell.tsx
└── notification-list.tsx

lib/websocket/
└── server.ts

lib/monitoring/
└── system-monitor.ts       # Updated: Monitor tier stats

hooks/
├── use-websocket.ts
└── use-toast.ts
```

**Key Changes from V4:**

- ✅ Monitor tier-based system health
- ✅ Track per-tier metrics

**File Count:** ~9 files

---

## PART 16: Utilities & Infrastructure

**Scope:** Helper functions and deployment

**Folders & Files:**

```
lib/email/
└── email.ts

lib/tokens.ts

lib/errors/
├── error-handler.ts
├── api-error.ts
└── error-logger.ts

lib/redis/
└── client.ts

lib/cache/
└── cache-manager.ts

lib/validations/
├── auth.ts
├── alert.ts
├── watchlist.ts           # NEW: Symbol+timeframe validation
└── user.ts

lib/utils/
├── helpers.ts
├── formatters.ts
└── constants.ts           # Updated: Timeframes

.github/workflows/
├── ci-nextjs.yml
├── ci-flask.yml
└── deploy.yml

docker-compose.yml         # Updated: All services
.dockerignore

app/layout.tsx             # Root layout
app/globals.css
app/error.tsx

app/(marketing)/
├── layout.tsx
└── page.tsx               # Landing page

public/
├── icons/
├── images/
└── manifest.json

tests/                     # Future: Testing
```

**Key Changes from V5:**

- ✅ NEW: `watchlist.ts` validation for symbol+timeframe combinations
- ✅ Updated constants: M5, H12 added; 9 total timeframes (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- ✅ Updated symbol constants: 15 total symbols (added AUDJPY, GBPJPY, NZDUSD, USDCAD, USDCHF)
- ✅ Tier-specific constants: FREE_SYMBOLS (5), PRO_SYMBOLS (15), FREE_TIMEFRAMES (3), PRO_TIMEFRAMES (9)
- ✅ Docker compose for all services

**File Count:** ~25 files

---

## 📊 Summary Statistics

| Part | Name           | Files | Priority | Complexity |
| ---- | -------------- | ----- | -------- | ---------- |
| 1    | Foundation     | ~12   | ⭐⭐⭐   | Low        |
| 2    | Database       | ~4    | ⭐⭐⭐   | Medium     |
| 3    | Types          | ~6    | ⭐⭐⭐   | Low        |
| 4    | Tier System    | ~4    | ⭐⭐⭐   | Medium     |
| 5    | Authentication | ~17   | ⭐⭐⭐   | High       |
| 6    | Flask Service  | ~15   | ⭐⭐⭐   | High       |
| 7    | Indicators API | ~6    | ⭐⭐⭐   | Medium     |
| 8    | Dashboard      | ~9    | ⭐⭐     | Medium     |
| 9    | Charts         | ~8    | ⭐⭐⭐   | High       |
| 10   | Watchlist      | ~8    | ⭐⭐     | Medium     |
| 11   | Alerts         | ~10   | ⭐⭐     | Medium     |
| 12   | E-commerce     | ~11   | ⭐⭐⭐   | High       |
| 13   | Settings       | ~17   | ⭐⭐     | Low        |
| 14   | Admin          | ~9    | ⭐       | Medium     |
| 15   | Notifications  | ~9    | ⭐⭐     | Medium     |
| 16   | Utilities      | ~25   | ⭐⭐     | Low        |

**Total: ~170 files across 16 parts**

---

## 🎯 Build Order Recommendation

### **Phase 1: Foundation (Week 1)**

```
Parts 1, 2, 3, 4
- Root config
- Database schema
- Types
- Tier system
```

### **Phase 2: Core Systems (Week 2)**

```
Parts 5, 6
- Authentication
- Flask MT5 Service
```

### **Phase 3: Main Features (Week 3-4)**

```
Parts 7, 8, 9
- Indicators API
- Dashboard
- Charts
```

### **Phase 4: User Features (Week 5)**

```
Parts 10, 11, 12
- Watchlist
- Alerts
- E-commerce
```

### **Phase 5: Polish (Week 6)**

```
Parts 13, 14, 15, 16
- Settings
- Admin (optional)
- Notifications
- Utilities
```

---

## SEED CODE: V0.dev Component References

**Scope:** Visual references and seed code for UI frontend components (31 total components + 1 Python AI engine)

**Purpose:** These files serve as visual prototypes and coding patterns for Aider to build production-ready components for the complete Trading Alerts SaaS V7 UI.

**Actual Folder Structure (as implemented):**

```
seed-code/
├── market_ai_engine.py                # Flask MT5 AI engine reference (Part 6)
│
└── v0-components/
    ├── README.md                      # Complete V0 component mapping guide
    │
    # ========== PART 5: AUTHENTICATION (3 components) ==========
    ├── next-js-login-form/
    │   ├── app/page.tsx               # → app/(auth)/login/page.tsx
    │   ├── app/layout.tsx
    │   ├── components/login-form.tsx  # Custom component with form logic
    │   ├── components/theme-provider.tsx
    │   └── components/ui/             # shadcn/ui primitives
    │
    ├── registration-form-component-v2/
    │   ├── app/page.tsx               # → app/(auth)/register/page.tsx
    │   └── components/...
    │
    ├── forgot-password-form/
    │   ├── app/page.tsx               # → app/(auth)/forgot-password/page.tsx
    │   ├── components/forgot-password-flow.tsx  # Custom component
    │   └── components/...
    │
    # ========== PART 8: DASHBOARD (3 components) ==========
    ├── dashboard-layout/
    │   ├── app/page.tsx               # → app/(dashboard)/layout.tsx
    │   └── components/...
    │
    ├── dashboard-home-component/
    │   ├── app/page.tsx               # → app/(dashboard)/page.tsx
    │   ├── components/dashboard-home.tsx  # Custom component
    │   └── components/...
    │
    ├── footer-component/
    │   ├── app/page.tsx               # → components/layout/footer.tsx
    │   ├── components/marketing-footer.tsx  # Custom component
    │   └── components/...
    │
    # ========== PART 9: CHARTS (2 components) ==========
    ├── trading-chart-component/
    │   ├── app/page.tsx               # → components/charts/trading-chart.tsx
    │   ├── components/trading-chart.tsx  # Custom component (523 lines)
    │   └── components/...
    │
    ├── chart-controls-component/
    │   ├── app/page.tsx               # → components/charts/chart-controls.tsx
    │   ├── components/chart-controls.tsx      # Main component
    │   ├── components/symbol-selector.tsx     # Sub-component
    │   ├── components/timeframe-selector.tsx  # Sub-component
    │   ├── components/upgrade-modal.tsx       # Modal component
    │   └── components/...
    │
    # ========== PART 10: WATCHLIST (1 component) ==========
    ├── watchlist-page-component/
    │   ├── app/watchlist/page.tsx     # → app/(dashboard)/watchlist/page.tsx
    │   └── components/...
    │
    # ========== PART 11: ALERTS (3 components) ==========
    ├── alerts-management-page/
    │   ├── app/page.tsx               # → app/(dashboard)/alerts/page.tsx
    │   └── components/...
    │
    ├── create-price-alert-modal/
    │   ├── app/page.tsx               # → components/alerts/alert-modal.tsx
    │   ├── components/create-alert-modal.tsx  # Custom component
    │   └── components/...
    │
    ├── alert-card-component/
    │   ├── app/page.tsx               # → components/alerts/alert-card.tsx
    │   ├── components/alert-card.tsx  # Custom component (241 lines)
    │   └── components/...
    │
    # ========== PART 12: E-COMMERCE (2 components) ==========
    ├── pricing-page-component-v3/
    │   ├── app/pricing/page.tsx       # → app/(marketing)/pricing/page.tsx
    │   └── components/...
    │
    ├── billing-and-subscription-page-v3/
    │   ├── app/billing/page.tsx       # → app/(dashboard)/settings/billing/page.tsx
    │   └── components/...
    │
    # ========== PART 13: SETTINGS (2 components) ==========
    ├── settings-page-with-tabs-v3/
    │   ├── app/settings/page.tsx      # → app/(dashboard)/settings/layout.tsx
    │   └── components/...
    │
    ├── profile-settings-form/
    │   ├── app/profile/settings/page.tsx           # → app/(dashboard)/settings/profile/page.tsx
    │   ├── components/photo-upload-modal.tsx       # Custom modal component
    │   ├── components/unsaved-changes-modal.tsx    # Custom modal component
    │   └── components/...
    │
    # ========== PART 14: ADMIN DASHBOARD (3 components) ==========
    ├── part-14-admin-dashboard-overview/
    │   ├── app/admin/dashboard/page.tsx  # → app/admin/dashboard/page.tsx
    │   └── components/...
    │
    ├── part-14-admin-user-management/
    │   ├── app/admin/users/page.tsx   # → app/admin/users/page.tsx
    │   └── components/...
    │
    ├── part-14-api-usage-analytics/
    │   ├── app/admin/api-usage/page.tsx  # → app/admin/api-usage/page.tsx
    │   └── components/...
    │
    # ========== PART 15: NOTIFICATIONS (1 component) ==========
    ├── notification-component-v3/
    │   ├── app/page.tsx               # → components/layout/notification-bell.tsx
    │   ├── components/notification-bell.tsx  # Custom component
    │   └── components/...
    │
    # ========== PART 16: UTILITIES (3 components) ==========
    ├── next-js-marketing-homepage-v2/
    │   ├── app/page.tsx               # → app/(marketing)/page.tsx
    │   └── components/...
    │
    ├── empty-states-components/
    │   ├── app/page.tsx               # → components/ui/empty-state.tsx
    │   ├── components/empty-states.tsx  # Custom component
    │   └── components/...
    │
    ├── user-profile-dropdown/
    │   ├── app/page.tsx               # → components/layout/user-menu.tsx
    │   ├── components/user-profile-dropdown.tsx  # Custom component
    │   └── components/...
    │
    # ========== PART 17A: AFFILIATE PORTAL (2 components) ==========
    ├── part-17a-affiliate-dashboard/
    │   ├── app/affiliate/dashboard/page.tsx  # → app/affiliate/dashboard/page.tsx
    │   └── components/...
    │
    ├── part-17a-affiliate-registration/
    │   ├── app/affiliate/register/page.tsx  # → app/affiliate/register/page.tsx
    │   └── components/...
    │
    # ========== PART 17B: AFFILIATE ADMIN (2 components) ==========
    ├── part-17b-admin-affiliate-management/
    │   ├── app/admin/affiliates/page.tsx  # → app/admin/affiliates/page.tsx
    │   └── components/...
    │
    ├── part-17b-admin-pnl-report/
    │   ├── app/admin/affiliates/pnl-report/page.tsx  # → app/admin/affiliates/pnl-report/page.tsx
    │   └── components/...
    │
    # ========== PART 18: DLOCAL PAYMENTS (4 components) ==========
    ├── part-18-payment-method-selector/
    │   ├── app/page.tsx               # → components/payments/payment-method-selector.tsx
    │   ├── components/payment-method-selector.tsx  # Custom component
    │   └── components/...
    │
    ├── part-18-price-display-component/
    │   ├── app/page.tsx               # → components/payments/price-display.tsx
    │   ├── components/price-display.tsx  # Custom component
    │   └── components/...
    │
    ├── part-18-renewal-reminder-email/
    │   ├── app/preview-renewal-email/page.tsx  # → Email template preview
    │   └── components/...
    │
    └── part-18-unified-checkout/
        ├── app/checkout/page.tsx      # → app/checkout/page.tsx
        └── components/...
```

**Component Categories:**

| Category              | Components | Purpose                                                      |
| --------------------- | ---------- | ------------------------------------------------------------ |
| Authentication        | 3          | Login, register, password reset                              |
| Dashboard             | 3          | Layout, home page, footer                                    |
| Charts                | 2          | Trading chart, chart controls with tier filtering            |
| Watchlist             | 1          | Symbol+timeframe management                                  |
| Alerts                | 3          | Alert list, create modal, alert card                         |
| E-commerce            | 2          | Pricing page, billing/subscription                           |
| Settings              | 2          | Settings layout, profile with modals                         |
| Admin Dashboard       | 3          | Admin overview, user management, API analytics               |
| Notifications         | 1          | Notification bell dropdown                                   |
| Utilities             | 3          | Marketing homepage, empty states, user menu                  |
| Affiliate Portal      | 2          | Affiliate dashboard, registration                            |
| Affiliate Admin       | 2          | Admin affiliate management, P&L reports                      |
| dLocal Payments       | 4          | Payment methods, price display, email, checkout              |
| **Total**             | **31**     | **Complete UI frontend coverage + 20 custom components**     |

**How Aider Uses These Files:**

1. **Pattern 1: Direct Page Adaptation**
   - Read v0 page component structure
   - Adapt for Next.js 15 App Router (app directory)
   - Replace mock data with real API calls
   - Add tier validation logic
   - Add authentication checks (session management)
   - Example: `next-js-marketing-homepage-v2/app/page.tsx` → `app/(marketing)/page.tsx`

2. **Pattern 2: Component Extraction**
   - Extract reusable components from seed files
   - Create standalone component files
   - Add tier-based filtering and validation
   - Connect to real-time data sources
   - Example: `chart-controls-component/components/chart-controls.tsx` → `components/charts/chart-controls.tsx`

3. **Pattern 3: Modal/Dialog Components**
   - Adapt modal UI from seed files
   - Add form validation (React Hook Form + Zod)
   - Connect to API endpoints
   - Add success/error handling
   - Example: `create-price-alert-modal/app/page.tsx` → `components/alerts/alert-modal.tsx`

4. **Pattern 4: Layout Wrappers**
   - Use as structural template
   - Add NextAuth session handling
   - Integrate tier badges and user menus
   - Add responsive navigation
   - Example: `settings-page-with-tabs-v3/app/settings/page.tsx` → `app/(dashboard)/settings/layout.tsx`

**Key Features of All Seed Components:**

- **TradingView Lightweight Charts Integration**
  - Professional-grade charting for financial data
  - Interactive crosshair and tooltips
  - Zoom and pan functionality
  - Mobile-optimized touch gestures

- **Modern UI Components (shadcn/ui + Radix UI)**
  - 14 Radix UI components integrated
  - Consistent design system across all pages
  - Fully accessible (ARIA compliant)
  - Dark mode support
  - Mobile-responsive layouts

- **Form Handling with Validation**
  - React Hook Form for all forms
  - Zod schemas for validation
  - Real-time error messages
  - User-friendly feedback

- **Tier-Based Access Control**
  - FREE vs PRO feature differentiation
  - Upgrade prompts for restricted features
  - Symbol and timeframe filtering
  - Alert count limits

- **Mock Data → Real Data Transformation**
  - Seed files use hardcoded mock data
  - Production files connect to live APIs:
    - `/api/indicators` (Flask MT5 service)
    - `/api/alerts` (Alert management)
    - `/api/watchlist` (Watchlist management)
    - `/api/tier` (Tier validation)
    - `/api/subscription` (Billing/upgrades)
    - `/api/user` (Profile management)

**Complete Integration Workflow:**

```
V0.dev Generation
    ↓
seed-code/v0-components/{component-name}/app/page.tsx
seed-code/v0-components/{component-name}/components/{custom-component}.tsx
    ↓
Aider Reads (via .aider.conf.yml)
    ├── 31 main page.tsx files (UI demos)
    └── 20 custom component files (business logic)
    ↓
Aider Adapts with:
    ├── API Integration (real endpoints)
    ├── Tier Validation (FREE/PRO checks)
    ├── Authentication (NextAuth sessions)
    ├── TypeScript Types (OpenAPI-generated)
    ├── Error Handling (try-catch, error states)
    └── Loading States (Skeleton, Spinner)
    ↓
Claude Code Validates
    ├── Type Safety Check
    ├── Quality Standards Check
    ├── Architecture Rules Check
    └── Coding Patterns Check
    ↓
Production Files:
    ├── app/(marketing)/* (public pages)
    ├── app/(auth)/* (authentication)
    ├── app/(dashboard)/* (main app)
    ├── app/admin/* (admin portal)
    ├── app/affiliate/* (affiliate portal)
    └── components/* (reusable UI)
```

**Dependencies (All Installed in package.json ✅):**

- `next@^15.0.0` - Next.js framework
- `react@^19.0.0` + `react-dom@^19.0.0` - React library
- `@radix-ui/react-*` (14 components) - UI primitives
- `lucide-react@^0.303.0` - Icon library
- `tailwind-merge@^2.2.0` + `clsx@^2.1.0` - Styling utilities
- `lightweight-charts@^4.1.1` - TradingView charts
- `react-hook-form@^7.49.0` + `zod@^3.22.4` - Form handling
- `next-auth@^4.24.5` - Authentication
- `@prisma/client@^5.7.0` - Database ORM
- `stripe@^14.10.0` - Payment processing
- `date-fns@^3.0.6` - Date formatting
- `react-image-crop@^10.1.5` - Avatar cropping

**File Count:** 31 V0 component directories + 20 custom component files + 1 Python AI engine = 52 total seed reference files

**Usage in .aider.conf.yml:**

All seed component files are configured as `read-only` references in Aider's configuration. Aider reads these files to understand:

- UI layout patterns and structure
- Component composition and nesting
- Styling conventions (Tailwind CSS classes)
- Interactive behaviors (onClick, onChange events)
- Form structure and validation patterns
- Responsive design breakpoints

**API Endpoints Required (from V0 components):**

| Endpoint                    | Method                   | Used By                  | Purpose              |
| --------------------------- | ------------------------ | ------------------------ | -------------------- |
| `/api/auth/register`        | POST                     | Registration             | Create user account  |
| `/api/auth/forgot-password` | POST                     | Forgot Password          | Send reset email     |
| `/api/dashboard/stats`      | GET                      | Dashboard Overview       | Get user stats       |
| `/api/watchlist`            | GET, POST, DELETE        | Watchlist Page           | Manage watchlist     |
| `/api/alerts`               | GET, POST, PATCH, DELETE | Alert Modal, Alerts List | Manage alerts        |
| `/api/tier/symbols`         | GET                      | Chart Controls           | Get allowed symbols  |
| `/api/subscription`         | GET, POST                | Billing Page             | Manage subscription  |
| `/api/user/profile`         | GET, PATCH               | Profile Settings         | Update profile       |
| `/api/notifications`        | GET, PATCH               | Notification Bell        | Manage notifications |

**Production File Mapping (Conceptual Overview):**

> **Note:** The names below are simplified for clarity. For actual V0 file paths, see the "SEED CODE: V0.dev Component References" section earlier in this document. The complete folder structure shows all 31 components with their actual paths (e.g., `next-js-login-form/app/page.tsx` instead of `login-page.tsx`).

```
V0 Components → Production Locations (Conceptual):

Public Pages:
  1. homepage.tsx          → app/(marketing)/page.tsx
  2. pricing-page.tsx      → app/(marketing)/pricing/page.tsx
  3. registration-page.tsx → app/(auth)/register/page.tsx

Auth:
  4. login-page.tsx              → app/(auth)/login/page.tsx
  5. forgot-password-page.tsx    → app/(auth)/forgot-password/page.tsx

Dashboard:
  6. dashboard-overview.tsx      → app/(dashboard)/dashboard/page.tsx
  7. watchlist-page.tsx          → app/(dashboard)/watchlist/page.tsx
  8. alert-creation-modal.tsx    → components/alerts/alert-modal.tsx
  9. alerts-list.tsx             → app/(dashboard)/alerts/page.tsx
  10. billing-page.tsx           → app/(dashboard)/settings/billing/page.tsx
  11. settings-layout.tsx        → app/(dashboard)/settings/layout.tsx
  12. profile-settings.tsx       → app/(dashboard)/settings/profile/page.tsx

Components:
  13. chart-controls.tsx         → components/charts/chart-controls.tsx
  14. empty-states.tsx           → components/ui/empty-state.tsx
  15. notification-bell.tsx      → components/layout/notification-bell.tsx
  16. user-menu.tsx              → components/layout/user-menu.tsx
  17. footer.tsx                 → components/layout/footer.tsx

Existing Seed (3):
  ✅ dashboard-layout.tsx  → app/(dashboard)/layout.tsx
  ✅ trading-chart.tsx     → components/charts/trading-chart.tsx
  ✅ alert-card.tsx        → components/alerts/alert-card.tsx
```

**Important Notes:**

- ⚠️ These are **reference implementations** with mock data only
- ⚠️ Do NOT copy seed files directly to production without adaptation
- ✅ Use as visual guide and structural pattern reference
- ✅ Aider must adapt with real API integration, tier validation, auth checks
- ✅ All production files must include TypeScript types (no `any`)
- ✅ All production files must include error handling and loading states
- ✅ Follow coding patterns from `docs/policies/05-coding-patterns.md`
- ✅ Validate with Claude Code before committing

**Related Documentation:**

- **Complete Mapping:** `docs/ui-components-map.md` - Detailed component-by-component guide
- **Seed Component README:** `seed-code/v0-components/README.md` - Full structure and usage guide
- **Coding Patterns:** `docs/policies/05-coding-patterns.md` - Code standards
- **Quality Standards:** `docs/policies/02-quality-standards.md` - Quality requirements

---

## PART 17: Affiliate Marketing Platform (2-Sided Marketplace)

**Purpose:** Complete 2-sided marketplace for affiliate-driven growth with self-service portal, automated code distribution, accounting-style reports, and admin BI dashboard.

**Priority:** ⭐⭐ (Post-MVP, implement before scaling) **Estimated Time:** 120 hours

### 17.1 Affiliate Portal Frontend

```
app/
├── affiliate/
│   ├── layout.tsx                    # Affiliate-specific layout
│   ├── register/
│   │   └── page.tsx                  # Registration with payment prefs
│   ├── verify/
│   │   └── page.tsx                  # Email verification page
│   ├── login/
│   │   └── page.tsx                  # Affiliate login
│   ├── dashboard/
│   │   ├── page.tsx                  # Main dashboard (stats, codes, commissions)
│   │   ├── commissions/
│   │   │   └── page.tsx              # Detailed commission report
│   │   ├── codes/
│   │   │   └── page.tsx              # Code inventory report
│   │   └── profile/
│   │       ├── page.tsx              # Profile overview
│   │       └── payment/
│   │           └── page.tsx          # Payment preferences
```

### 17.2 Affiliate API Routes

```
app/api/affiliate/
├── auth/
│   ├── register/
│   │   └── route.ts                  # POST - Create affiliate account
│   ├── verify-email/
│   │   └── route.ts                  # POST - Verify email, distribute codes
│   ├── login/
│   │   └── route.ts                  # POST - Authenticate affiliate
│   └── logout/
│       └── route.ts                  # POST - Invalidate token
├── dashboard/
│   ├── stats/
│   │   └── route.ts                  # GET - Quick stats (codes, earnings)
│   ├── code-inventory/
│   │   └── route.ts                  # GET - Accounting-style report
│   ├── commission-report/
│   │   └── route.ts                  # GET - Accounting-style report
│   └── codes/
│       └── route.ts                  # GET - List active codes
└── profile/
    ├── route.ts                      # GET, PATCH - Profile data
    └── payment/
        └── route.ts                  # PUT - Update payment preferences
```

### 17.3 Admin Affiliate Management

```
app/
├── admin/
│   └── affiliates/
│       ├── page.tsx                  # List all affiliates (paginated)
│       ├── [id]/
│       │   └── page.tsx              # Individual affiliate details
│       └── reports/
│           ├── profit-loss/
│           │   └── page.tsx          # P&L Report (3 months)
│           ├── sales-performance/
│           │   └── page.tsx          # Sales by affiliate
│           ├── commission-owings/
│           │   └── page.tsx          # Pending commissions
│           └── code-inventory/
│               └── page.tsx          # Aggregate inventory

app/api/admin/
├── affiliates/
│   ├── route.ts                      # GET - List all, POST - Manual create
│   ├── [id]/
│   │   ├── route.ts                  # GET, PATCH, DELETE
│   │   ├── distribute-codes/
│   │   │   └── route.ts              # POST - Manual distribution
│   │   └── suspend/
│   │       └── route.ts              # POST - Suspend account
│   └── reports/
│       ├── profit-loss/
│       │   └── route.ts              # GET - P&L report
│       ├── sales-performance/
│       │   └── route.ts              # GET - Sales by affiliate
│       ├── commission-owings/
│       │   └── route.ts              # GET - Pending commissions
│       └── code-inventory/
│           └── route.ts              # GET - Aggregate inventory
├── codes/
│   └── [id]/
│       └── cancel/
│           └── route.ts              # POST - Cancel specific code
└── commissions/
    ├── pay/
    │   └── route.ts                  # POST - Mark individual paid
    └── bulk-pay/
        └── route.ts                  # POST - Mark multiple paid
```

### 17.4 User Checkout Integration

```
app/api/checkout/
├── validate-code/
│   └── route.ts                      # POST - Validate affiliate code
└── create-session/
    └── route.ts                      # Modified: Include discount code

app/api/webhooks/stripe/
└── route.ts                          # Modified: Create commission on checkout
```

### 17.5 Automated Processes (Cron Jobs)

```
app/api/cron/
├── distribute-codes/
│   └── route.ts                      # Monthly distribution (1st, 00:00 UTC)
├── expire-codes/
│   └── route.ts                      # Monthly expiry (last day, 23:59 UTC)
└── send-monthly-reports/
    └── route.ts                      # Email reports to affiliates
```

**Vercel Cron Configuration:**

```json
{
  "crons": [
    {
      "path": "/api/cron/distribute-codes",
      "schedule": "0 0 1 * *"
    },
    {
      "path": "/api/cron/expire-codes",
      "schedule": "59 23 28-31 * *"
    }
  ]
}
```

### 17.6 Business Logic & Utilities

```
lib/
├── affiliate/
│   ├── code-generator.ts             # Crypto-secure code generation
│   ├── commission-calculator.ts      # Commission formula
│   ├── report-builder.ts             # Accounting-style reports
│   └── validators.ts                 # Code validation logic
├── auth/
│   └── affiliate-auth.ts             # Separate JWT for affiliates
└── email/
    └── templates/
        └── affiliate/
            ├── welcome.tsx           # Welcome email template
            ├── code-distributed.tsx  # Monthly codes template
            ├── code-used.tsx         # Commission earned template
            └── payment-processed.tsx # Payment confirmation
```

### 17.7 Components

```
components/
├── affiliate/
│   ├── dashboard/
│   │   ├── stats-card.tsx            # Quick stats display
│   │   ├── code-inventory-table.tsx  # Inventory report table
│   │   └── commission-table.tsx      # Commission report table
│   ├── forms/
│   │   ├── register-form.tsx         # Registration with payment prefs
│   │   └── payment-preferences-form.tsx
│   └── reports/
│       ├── code-inventory-report.tsx
│       └── commission-report.tsx
└── admin/
    └── affiliate/
        ├── affiliate-list.tsx        # Paginated list with filters
        ├── affiliate-details-card.tsx
        ├── distribute-codes-modal.tsx
        ├── suspend-account-modal.tsx
        └── reports/
            ├── profit-loss-report.tsx
            ├── sales-performance-report.tsx
            ├── commission-owings-table.tsx
            └── code-inventory-chart.tsx
```

### 17.8 Database Schema

```
prisma/
└── schema.prisma                     # Add 3 new models:
                                      # - Affiliate
                                      # - AffiliateCode
                                      # - Commission
                                      # + Update Subscription (affiliateCodeId)
```

**Migration Files:**

```
prisma/migrations/
└── 20251114_add_affiliate_marketing/
    └── migration.sql                 # CREATE TABLE statements
```

### 17.9 Key Features

**Affiliate Portal:**

- ✅ Self-service registration with payment preferences (Bank, Crypto, Wallets)
- ✅ Email verification → Auto-distribute 15 codes
- ✅ Separate JWT authentication system
- ✅ Real-time dashboard with code inventory and commissions
- ✅ Accounting-style reports (opening/closing balances)
- ✅ Profile management with payment method updates

**Admin Portal:**

- ✅ Affiliate list with search, filter, pagination
- ✅ Individual affiliate details with performance metrics
- ✅ Manual code distribution (bonus codes)
- ✅ Account suspension/reactivation
- ✅ 4 Business Intelligence reports:
  1. P&L Report (3-month view)
  2. Sales Performance by Affiliate (ranked)
  3. Commission Owings (payment processing)
  4. Aggregate Code Inventory (system-wide)

**Automation:**

- ✅ Monthly code distribution (15 codes per active affiliate)
- ✅ Monthly code expiry (end of month)
- ✅ Email notifications (8 types)
- ✅ Commission calculation at checkout (via Stripe webhook)

**Security:**

- ✅ Separate authentication system (no shared sessions)
- ✅ Cryptographically secure code generation (crypto.randomBytes)
- ✅ Code validation (ACTIVE, not expired, not used)
- ✅ Commission creation only via webhook (prevents fraud)
- ✅ Payment data encryption at rest

### 17.10 File Count

| Category               | Files  | Description                                      |
| ---------------------- | ------ | ------------------------------------------------ |
| Affiliate Portal Pages | 8      | Registration, login, dashboard, reports, profile |
| Affiliate API Routes   | 11     | Auth, dashboard stats, reports                   |
| Admin Portal Pages     | 5      | List, details, 4 BI reports                      |
| Admin API Routes       | 14     | CRUD, reports, commission payment                |
| Cron Jobs              | 3      | Distribution, expiry, reports                    |
| Business Logic         | 8      | Code gen, validation, reports                    |
| Components             | 15     | Forms, tables, reports, modals                   |
| Database               | 3      | Affiliate, AffiliateCode, Commission models      |
| **Total**              | **67** | **Estimated 120 hours**                          |

### 17.11 Integration Points

**Modified Files (from existing parts):**

```
app/
├── api/
│   ├── checkout/create-session/route.ts  # Add discount code validation
│   └── webhooks/stripe/route.ts          # Add commission creation
└── dashboard/settings/billing/page.tsx    # Add discount code input

prisma/schema.prisma                       # Add 3 new models + enum
```

**Dependencies (no new packages required):**

- Uses existing: bcrypt, jsonwebtoken, @prisma/client
- Uses existing: stripe, resend (for emails)
- Uses existing: vercel/cron

---

## PART 18: dLocal Payment Integration (Emerging Markets)

**Scope:** Payment processing for users from emerging markets (India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey) using local payment methods (UPI, Paytm, JazzCash, GoPay, etc.) without international credit cards.

**Why this exists:** Stripe requires international credit/debit cards. Many users in emerging markets don't have these cards, limiting PRO subscriptions. dLocal bridges this gap by supporting 50+ local payment methods popular in each country.

### 18.1 Core Features

**Business Requirements:**

- ✅ Support 8 emerging markets (IN, NG, PK, VN, ID, TH, ZA, TR)
- ✅ 50+ local payment methods (UPI, Paytm, JazzCash, GoPay, etc.)
- ✅ Unified checkout page (Stripe + dLocal together)
- ✅ Country detection (IP geolocation + manual selector)
- ✅ Real-time currency conversion (USD → local currency)
- ✅ 3-day PRO plan ($1.99) - dLocal exclusive
- ✅ Monthly PRO plan ($29) - both providers
- ✅ Manual renewal (NO auto-renewal for dLocal)
- ✅ Discount codes on monthly plans ONLY (NOT 3-day)

**Technical Requirements:**

- ✅ Webhook signature verification
- ✅ Payment transaction logging
- ✅ Cron jobs for renewal reminders & expiry
- ✅ Email notifications (5 types)
- ✅ Graceful fallback to Stripe if dLocal fails

### 18.2 Key Differences from Stripe

| Feature               | Stripe                 | dLocal                           |
| --------------------- | ---------------------- | -------------------------------- |
| Auto-Renewal          | ✅ Yes                 | ❌ NO - Manual renewal required  |
| Free Trial            | ✅ 7 days              | ❌ NO trial period               |
| Plans                 | Monthly only           | **3-day** + Monthly              |
| Discount Codes        | ✅ All plans           | ❌ Monthly ONLY (not 3-day)      |
| Renewal Notifications | Stripe manages         | **We send** 3 days before expiry |
| Expiry Handling       | Stripe auto-downgrades | **We downgrade** via cron job    |
| Payment Flow          | Card authorization     | Redirect to local payment page   |

### 18.3 Database Schema (Additions)

**File:** `prisma/schema.prisma` (UPDATE EXISTING)

```prisma
model Subscription {
  // ... existing fields ...

  // NEW: Payment provider field
  paymentProvider       PaymentProvider  @default(STRIPE)

  // NEW: dLocal-specific fields (NULL for Stripe)
  dlocalPaymentId       String?
  dlocalPaymentMethod   String?          // 'UPI', 'PAYTM', 'GOPAY', etc.
  dlocalCountry         String?          // 'IN', 'ID', 'PK', etc.
  dlocalCurrency        String?          // 'INR', 'IDR', 'PKR', etc.

  // NEW: Plan type
  planType              PlanType         @default(MONTHLY)

  // NEW: Amount tracking
  amount                Decimal          // Local currency amount
  amountUSD             Decimal          // USD equivalent
  currency              String

  // NEW: Manual renewal tracking (dLocal only)
  expiresAt             DateTime?
  renewalReminderSent   Boolean          @default(false)

  // ... rest of existing fields ...
}

// NEW: Payment transaction log
model Payment {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id])
  subscriptionId        String?
  subscription          Subscription? @relation(fields: [subscriptionId], references: [id])

  provider              PaymentProvider
  providerPaymentId     String
  providerStatus        String

  amount                Decimal
  amountUSD             Decimal
  currency              String
  country               String
  paymentMethod         String

  planType              PlanType
  duration              Int              // 3 or 30 days

  discountCode          String?
  discountAmount        Decimal?

  status                PaymentStatus
  failureReason         String?

  initiatedAt           DateTime   @default(now())
  completedAt           DateTime?
  failedAt              DateTime?
  metadata              Json?

  @@index([userId])
  @@index([provider, providerPaymentId])
  @@index([status])
}

// NEW: Enums
enum PaymentProvider {
  STRIPE
  DLOCAL
}

enum PlanType {
  THREE_DAY
  MONTHLY
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  CANCELLED
}

// UPDATED: Add new statuses
enum SubscriptionStatus {
  ACTIVE
  EXPIRED     // NEW - dLocal subscription expired
  CANCELLED
  PAYMENT_FAILED
  PENDING     // NEW - awaiting payment confirmation
}
```

### 18.4 File Structure

```
types/
└── dlocal.ts                                        # NEW - dLocal types

lib/
├── dlocal/
│   ├── constants.ts                                 # NEW - Country/currency mappings
│   ├── currency-converter.service.ts                # NEW - USD → local currency
│   ├── payment-methods.service.ts                   # NEW - Fetch payment methods
│   └── dlocal-payment.service.ts                    # NEW - Create payments
├── cron/
│   ├── check-expiring-subscriptions.ts              # NEW - Renewal reminders
│   └── downgrade-expired-subscriptions.ts           # NEW - Auto-downgrade
└── geo/
    └── detect-country.ts                            # NEW - IP geolocation

app/
├── api/
│   ├── payments/
│   │   └── dlocal/
│   │       ├── methods/route.ts                     # NEW - Get payment methods
│   │       ├── exchange-rate/route.ts               # NEW - Get exchange rate
│   │       ├── convert/route.ts                     # NEW - Convert USD to local
│   │       ├── create/route.ts                      # NEW - Create payment
│   │       ├── validate-discount/route.ts           # NEW - Validate discount code
│   │       └── [paymentId]/route.ts                 # NEW - Get payment status
│   ├── webhooks/
│   │   └── dlocal/route.ts                          # NEW - Payment webhooks
│   └── cron/
│       ├── check-expiring-subscriptions/route.ts    # NEW - Renewal cron
│       └── downgrade-expired-subscriptions/route.ts # NEW - Expiry cron
└── checkout/
    └── page.tsx                                     # UPDATED - Unified checkout

components/
└── payments/
    ├── CountrySelector.tsx                          # NEW - Country picker
    ├── PlanSelector.tsx                             # NEW - 3-day vs Monthly
    ├── PaymentMethodSelector.tsx                    # NEW - Payment method grid
    ├── PriceDisplay.tsx                             # NEW - Local currency display
    ├── DiscountCodeInput.tsx                        # NEW - Discount validation
    └── PaymentButton.tsx                            # NEW - Pay button

lib/emails/
├── send-renewal-reminder.ts                         # NEW - 3-day reminder email
├── send-expired-notification.ts                     # NEW - Expiry email
├── send-payment-confirmation.ts                     # NEW - Success email
└── send-payment-failure.ts                          # NEW - Failure email

docs/
├── policies/
│   └── 07-dlocal-integration-rules.md               # NEW - Aider policy
├── dlocal-openapi-endpoints.yaml                   # NEW - API spec
├── implementation-guides/
│   └── v5_part_r.md                                 # NEW - Implementation guide
└── DLOCAL-INTEGRATION-SUMMARY.md                   # NEW - Summary doc

vercel.json                                          # UPDATED - Add cron jobs
```

### 18.5 API Endpoints (7 new)

| Endpoint                                 | Method | Purpose                                   |
| ---------------------------------------- | ------ | ----------------------------------------- |
| `/api/payments/dlocal/methods`           | GET    | Get available payment methods for country |
| `/api/payments/dlocal/exchange-rate`     | GET    | Get USD to local currency rate            |
| `/api/payments/dlocal/convert`           | GET    | Convert USD amount to local currency      |
| `/api/payments/dlocal/create`            | POST   | Create dLocal payment                     |
| `/api/payments/dlocal/validate-discount` | POST   | Validate discount code                    |
| `/api/payments/dlocal/[paymentId]`       | GET    | Get payment status                        |
| `/api/webhooks/dlocal`                   | POST   | Payment status webhooks                   |

### 18.6 Cron Jobs (2 new)

| Cron Job                          | Schedule        | Purpose                                       |
| --------------------------------- | --------------- | --------------------------------------------- |
| `check-expiring-subscriptions`    | Daily 00:00 UTC | Send renewal reminders (3 days before expiry) |
| `downgrade-expired-subscriptions` | Hourly          | Downgrade PRO → FREE on expiry                |

**Vercel Cron Configuration:**

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/downgrade-expired-subscriptions",
      "schedule": "0 * * * *"
    }
  ]
}
```

### 18.7 Email Notifications (5 types)

1. **Payment Confirmed** - Immediate after webhook (status = PAID)
2. **Renewal Reminder (3 days)** - 3 days before expiry
3. **Renewal Reminder (1 day)** - 1 day before expiry
4. **Subscription Expired** - After expiry date reached
5. **Payment Failed** - If webhook status = FAILED

### 18.8 Supported Countries & Payment Methods

| Country           | Currency | Popular Methods                      |
| ----------------- | -------- | ------------------------------------ |
| India (IN)        | INR (₹)  | UPI, Paytm, PhonePe, Net Banking     |
| Nigeria (NG)      | NGN (₦)  | Bank Transfer, USSD, Paystack, Verve |
| Pakistan (PK)     | PKR (Rs) | JazzCash, Easypaisa                  |
| Vietnam (VN)      | VND (₫)  | VNPay, MoMo, ZaloPay                 |
| Indonesia (ID)    | IDR (Rp) | GoPay, OVO, Dana, ShopeePay          |
| Thailand (TH)     | THB (฿)  | TrueMoney, Rabbit LINE Pay, Thai QR  |
| South Africa (ZA) | ZAR (R)  | Instant EFT, EFT                     |
| Turkey (TR)       | TRY (₺)  | Bank Transfer, Local Cards           |

### 18.9 Pricing

| Plan        | Duration | Price (USD) | Discount Codes | Auto-Renewal |
| ----------- | -------- | ----------- | -------------- | ------------ |
| **3-Day**   | 3 days   | $1.99       | ❌ NO          | ❌ NO        |
| **Monthly** | 30 days  | $29.00      | ✅ YES         | ❌ NO        |

**Local Currency Examples (India):**

- 3-day: $1.99 = ₹165 (at ~83 INR/USD)
- Monthly: $29.00 = ₹2,407 (at ~83 INR/USD)

### 18.10 Payment Flow

```
User visits /checkout
    ↓
Country Detection (IP geolocation + manual selector)
    ↓
Load Payment Methods (dLocal + Stripe card)
    ↓
User Selects:
    - Payment Method (UPI, Paytm, etc.)
    - Plan (3-day or Monthly)
    - Discount Code (if Monthly plan)
    ↓
Create Payment (POST /api/payments/dlocal/create)
    ↓
Redirect to dLocal Payment Page
    ↓
User Completes Payment
    ↓
Webhook Fires (status = PAID)
    ↓
Actions:
    - Update Payment (status: COMPLETED)
    - Create Subscription (ACTIVE)
    - Upgrade User (FREE → PRO)
    - Set Expiry (NOW + 3 or 30 days)
    - Send Confirmation Email
    ↓
User Returns to SaaS (PRO access activated)
```

### 18.11 Renewal & Expiry Flow

```
Day -3: Renewal Reminder Email Sent
    ↓
Day 0: Subscription Expires
    ↓
Cron Job: Downgrade Expired Subscriptions
    ↓
Actions:
    - Update Subscription (status: EXPIRED)
    - Update User (tier: FREE)
    - Send Expiry Email
    ↓
User Loses PRO Access:
    - 15 symbols → 5 symbols
    - 9 timeframes → 3 timeframes
    - 20 alerts → 5 alerts
```

### 18.12 Environment Variables

```bash
# dLocal API Configuration
DLOCAL_API_URL=https://api.dlocal.com
DLOCAL_API_LOGIN=your_dlocal_login
DLOCAL_API_KEY=your_dlocal_api_key
DLOCAL_API_SECRET=your_dlocal_secret_key
DLOCAL_WEBHOOK_SECRET=your_webhook_secret

# dLocal Pricing (USD)
DLOCAL_3DAY_PRICE_USD=1.99
DLOCAL_MONTHLY_PRICE_USD=29.00

# Feature Flags
ENABLE_DLOCAL_PAYMENTS=true
ENABLE_3DAY_PLAN=true

# Cron Job Secret
CRON_SECRET=your_cron_secret_here
```

### 18.13 File Count

| Category            | Files      | Description                                            |
| ------------------- | ---------- | ------------------------------------------------------ |
| Type Definitions    | 1          | dLocal types                                           |
| Services            | 4          | Currency, payment methods, payments, country detection |
| API Routes          | 9          | Payment endpoints + webhooks + cron                    |
| Cron Jobs           | 2          | Renewal reminders + expiry                             |
| Frontend Components | 6          | Country selector, plan selector, payment methods, etc. |
| Email Templates     | 4          | Confirmation, reminders, expiry, failure               |
| Database            | 2          | Payment model + Subscription updates                   |
| Documentation       | 4          | Policy, OpenAPI, guide, summary                        |
| Configuration       | 2          | vercel.json + .env updates                             |
| **Total**           | **34 new** | **+ 11 updates = 45 files total**                      |

**Estimated Time:** 120 hours (4 weeks)

### 18.14 Integration Points

**Modified Files (from existing parts):**

```
app/checkout/page.tsx                    # Add dLocal payment options
prisma/schema.prisma                     # Add Payment model + Subscription fields
vercel.json                              # Add cron jobs
.env.local                               # Add dLocal variables
docs/trading_alerts_openapi.yaml         # Add dLocal endpoints
```

**Dependencies (no new packages required):**

- Uses existing: crypto (Node.js built-in)
- Uses existing: @prisma/client, stripe
- Uses existing: resend (for emails)
- Uses existing: vercel/cron

### 18.15 Testing Checklist

**Unit Tests:**

- [ ] Currency conversion (USD → INR, NGN, PKR, etc.)
- [ ] Discount code validation (reject on 3-day plan)
- [ ] Payment methods fetching
- [ ] Webhook signature verification
- [ ] Expiry date calculations

**Integration Tests:**

- [ ] Complete payment flow (mock dLocal API)
- [ ] Webhook handling (PAID, REJECTED, CANCELLED)
- [ ] Subscription creation
- [ ] User tier upgrade/downgrade
- [ ] Cron job execution

**E2E Tests (Manual):**

- [ ] India → UPI → Monthly → Discount code → Payment success
- [ ] Pakistan → 3-day → No discount → Payment success
- [ ] Renewal reminder sent 3 days before expiry
- [ ] Subscription expires → User downgraded to FREE

### 18.16 Success Criteria

- ✅ Single checkout page shows both Stripe and dLocal
- ✅ Country detection works with manual override
- ✅ Payment methods load dynamically for 8 countries
- ✅ Prices display in local currency
- ✅ 3-day plan exclusive to dLocal
- ✅ Discount codes work on monthly only
- ✅ Payment processing works for all countries
- ✅ Webhooks handle success/failure correctly
- ✅ Renewal reminders sent 3 days before expiry
- ✅ Expired subscriptions downgraded automatically

### 18.17 Key Documentation

- **Policy:** `docs/policies/07-dlocal-integration-rules.md`
- **Implementation Guide:** `docs/implementation-guides/v5_part_r.md`
- **OpenAPI Spec:** `docs/dlocal-openapi-endpoints.yaml`
- **Summary:** `docs/DLOCAL-INTEGRATION-SUMMARY.md`
- **Original Spec:** `dlocal/dlocal-integration-prompt.md`

---

## 📊 Updated Summary Statistics

| Part     | Name                | Files   | Priority   | Complexity    |
| -------- | ------------------- | ------- | ---------- | ------------- |
| 1        | Foundation          | ~12     | ⭐⭐⭐     | Low           |
| 2        | Database            | ~4      | ⭐⭐⭐     | Medium        |
| 3        | Types               | ~6      | ⭐⭐⭐     | Low           |
| 4        | Tier System         | ~4      | ⭐⭐⭐     | Medium        |
| 5        | Authentication      | ~17     | ⭐⭐⭐     | High          |
| 6        | Flask Service       | ~15     | ⭐⭐⭐     | High          |
| 7        | Indicators API      | ~6      | ⭐⭐⭐     | Medium        |
| 8        | Dashboard           | ~9      | ⭐⭐       | Medium        |
| 9        | Charts              | ~8      | ⭐⭐⭐     | High          |
| 10       | Watchlist           | ~8      | ⭐⭐       | Medium        |
| 11       | Alerts              | ~10     | ⭐⭐       | Medium        |
| 12       | E-commerce          | ~11     | ⭐⭐⭐     | High          |
| 13       | Settings            | ~17     | ⭐⭐       | Low           |
| 14       | Admin               | ~9      | ⭐         | Medium        |
| 15       | Notifications       | ~9      | ⭐⭐       | Medium        |
| 16       | Utilities           | ~25     | ⭐⭐       | Low           |
| 17       | Affiliate Marketing | ~67     | ⭐⭐       | High          |
| 18       | dLocal Payments     | ~45     | ⭐⭐       | High          |
| **Seed** | **V0 Components**   | **~52** | **⭐⭐⭐** | **Reference** |

**Total: ~170 production files + ~52 seed reference files (31 V0 components + 20 custom components + 1 Python AI engine)**
