## 4. Technology Stack

### 4.1 Frontend

```yaml
Framework: Next.js 15.0 (App Router) # 🆕 V5: Upgraded from 14
Language: TypeScript 5.x
UI Library: React 19 # 🆕 V5: Upgraded from 18
Styling: Tailwind CSS 3.x
Component Library: shadcn/ui (Radix UI)
Charts: TradingView Lightweight Charts 4.x
State Management:
  - Zustand (client state)
  - React Query / TanStack Query (server state)
Forms: React Hook Form + Zod validation
Real-time: Socket.IO Client
Icons: Lucide React
PWA: next-pwa
Features: # 🆕 V5: New Next.js 15 features
  - Partial Prerendering (PPR)
  - React Compiler
  - Turbopack (dev server)
```

### 4.2 Backend (Next.js)

```yaml
API Routes: Next.js 15 built-in
Authentication: NextAuth.js v5
Database ORM: Prisma 5.x
Validation: Zod
Background Jobs: BullMQ
Rate Limiting: upstash/ratelimit
Email: Resend
Payments: Stripe SDK (2-tier system) # 🆕 V5: FREE + PRO only
WebSocket: Socket.IO
Tier Management: Custom middleware # 🆕 V5: Tier-based access control
```

### 4.3 MT5 Microservice

```yaml
Framework: Flask 3.0
Language: Python 3.11+
MT5 Integration: MetaTrader5 library
CORS: Flask-CORS
Logging: Loguru
Deployment: Docker
Access Control: Tier-based validation # 🆕 V5: Validates symbol access

CRITICAL: Reads from YOUR custom indicators
  - Fractal Horizontal Line_V5.mq5 (ATTACH IN NEXT CHAT)
  - Fractal Diagonal Line_V4.mq5 (ATTACH IN NEXT CHAT)

COMMERCIAL MODEL: # 🆕 V5: Centralized data source
  - YOUR MT5 terminal = ONLY data source
  - Users subscribe to access YOUR data
  - Users CANNOT connect their own MT5
```

### 4.4 Databases

```yaml
Primary Database: PostgreSQL 15
Cache & Queue: Redis 7
ORM: Prisma (TypeScript)
Migrations: Prisma Migrate
Schema Changes: # 🆕 V5: New models
  - WatchlistItem model (symbol+timeframe)
  - 2-tier UserTier enum (FREE, PRO)
  - Removed ENTERPRISE tier
```

### 4.5 DevOps & Infrastructure

```yaml
Version Control: Git + GitHub
CI/CD: GitHub Actions
Container: Docker + Docker Compose
Hosting Options:
  - Next.js: Vercel / Railway / AWS
  - Flask: Railway / Fly.io / AWS ECS
  - Database: Supabase / Railway / AWS RDS
  - Redis: Upstash / Railway / AWS ElastiCache
Monitoring: Sentry (errors) + Vercel Analytics
CDN: Vercel Edge Network / CloudFlare
```

### 4.6 Development Tools

```yaml
IDE: VS Code
Linting: ESLint + Prettier
Type Checking: TypeScript strict mode
API Testing: Postman / Thunder Client
Database GUI: Prisma Studio / TablePlus
Git Client: GitHub Desktop / GitKraken
Package Manager: pnpm (recommended)
Node Version: 18+ (required for Next.js 15) # 🆕 V5: Updated requirement
```

### 4.7 Constants & Configuration

**🆕 V5: Updated Timeframes and Tier System**

```typescript
// lib/constants/timeframes.ts
export const TIMEFRAMES = {
  M15: 'M15',
  M30: 'M30',
  H1: 'H1',
  H2: 'H2', // 🆕 V5: Added
  H4: 'H4',
  H8: 'H8', // 🆕 V5: Added
  D1: 'D1',
} as const;

export type Timeframe = keyof typeof TIMEFRAMES;

// MT5 timeframe constants
export const MT5_TIMEFRAMES: Record<Timeframe, number> = {
  M15: 15,
  M30: 30,
  H1: 16385,
  H2: 16386, // 🆕 V5: Added
  H4: 16388,
  H8: 16392, // 🆕 V5: Added
  D1: 16408,
};

// Timeframe display names
export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M15: '15 Minutes',
  M30: '30 Minutes',
  H1: '1 Hour',
  H2: '2 Hours', // 🆕 V5: Added
  H4: '4 Hours',
  H8: '8 Hours', // 🆕 V5: Added
  D1: '1 Day',
};
```

```typescript
// lib/constants/tiers.ts
// 🆕 V5: Commercial SaaS tier system

export const TIER_SYMBOLS = {
  FREE: ['XAUUSD'], // Only 1 symbol
  PRO: [
    'AUDUSD',
    'BTCUSD',
    'ETHUSD',
    'EURUSD',
    'GBPUSD',
    'NDX100',
    'US30',
    'USDJPY',
    'XAGUSD',
    'XAUUSD',
  ], // 10 symbols
} as const;

export type UserTier = 'FREE' | 'PRO';

// Symbol display names
export const SYMBOL_LABELS: Record<string, string> = {
  XAUUSD: 'Gold/USD',
  AUDUSD: 'AUD/USD',
  BTCUSD: 'Bitcoin/USD',
  ETHUSD: 'Ethereum/USD',
  EURUSD: 'EUR/USD',
  GBPUSD: 'GBP/USD',
  NDX100: 'Nasdaq 100',
  US30: 'Dow Jones 30',
  USDJPY: 'USD/JPY',
  XAGUSD: 'Silver/USD',
};

// Access control helpers
export function canAccessSymbol(tier: UserTier, symbol: string): boolean {
  return TIER_SYMBOLS[tier].includes(symbol);
}

export function canAccessCombination(
  tier: UserTier,
  symbol: string,
  timeframe: string
): boolean {
  return (
    TIER_SYMBOLS[tier].includes(symbol) &&
    Object.keys(TIMEFRAMES).includes(timeframe)
  );
}

export function getAvailableSymbols(tier: UserTier): string[] {
  return TIER_SYMBOLS[tier];
}

// Tier limits
export const TIER_LIMITS = {
  FREE: {
    symbols: 1,
    alerts: 5,
    watchlistItems: 10,
    apiCallsPerHour: 60,
  },
  PRO: {
    symbols: 10,
    alerts: 100,
    watchlistItems: 100,
    apiCallsPerHour: 600,
  },
} as const;

// Pricing
export const TIER_PRICING = {
  FREE: {
    price: 0,
    currency: 'USD',
    interval: 'month',
  },
  PRO: {
    price: 29,
    currency: 'USD',
    interval: 'month',
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
} as const;
```

---

## 5. Project Structure

### 5.1 Next.js Application Structure

```
trading-alerts-saas/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── app/
│   ├── (auth)/                      # Auth routes group
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                 # Protected routes group
│   │   ├── layout.tsx               # Dashboard layout with sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── charts/
│   │   │   ├── page.tsx
│   │   │   └── [symbol]/
│   │   │       ├── page.tsx
│   │   │       └── [timeframe]/
│   │   │           └── page.tsx     # 🆕 V5: Tier-gated access
│   │   ├── alerts/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       └── edit/
│   │   │           └── page.tsx
│   │   ├── watchlist/
│   │   │   └── page.tsx             # 🆕 V5: Symbol+Timeframe combos
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── profile/
│   │       ├── subscription/        # 🆕 V5: 2-tier management
│   │       └── notifications/
│   │
│   ├── (marketing)/                 # Public routes group
│   │   ├── page.tsx                 # Landing page
│   │   ├── pricing/
│   │   │   └── page.tsx             # 🆕 V5: FREE vs PRO comparison
│   │   ├── features/
│   │   │   └── page.tsx
│   │   ├── blog/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts
│   │   ├── indicators/
│   │   │   ├── route.ts             # GET /api/indicators
│   │   │   └── [symbol]/
│   │   │       ├── route.ts         # 🆕 V5: Tier validation
│   │   │       └── [timeframe]/
│   │   │           └── route.ts     # 🆕 V5: Tier + TF validation
│   │   ├── alerts/
│   │   │   ├── route.ts             # GET, POST /api/alerts
│   │   │   └── [id]/
│   │   │       └── route.ts         # GET, PUT, DELETE /api/alerts/:id
│   │   ├── watchlist/
│   │   │   ├── route.ts             # 🆕 V5: Symbol+TF operations
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── user/
│   │   │   ├── profile/
│   │   │   │   └── route.ts
│   │   │   ├── preferences/
│   │   │   │   └── route.ts
│   │   │   └── tier/                # 🆕 V5: Tier info endpoint
│   │   │       └── route.ts
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts         # 🆕 V5: 2-tier webhooks
│   │
│   ├── layout.tsx                   # Root layout
│   ├── globals.css
│   └── error.tsx
│
├── components/
│   ├── ui/                          # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx                # 🆕 V5: For tier badges
│   │   └── ...
│   ├── layout/
│   │   ├── header.tsx               # 🆕 V5: Shows tier badge
│   │   ├── footer.tsx
│   │   ├── sidebar.tsx              # 🆕 V5: Tier-aware navigation
│   │   └── mobile-nav.tsx
│   ├── dashboard/
│   │   ├── stats-card.tsx
│   │   ├── recent-alerts.tsx
│   │   ├── tier-banner.tsx          # 🆕 V5: Upgrade prompts for FREE
│   │   └── watchlist-widget.tsx     # 🆕 V5: Shows symbol+TF
│   ├── charts/
│   │   ├── trading-chart.tsx
│   │   ├── indicator-overlay.tsx
│   │   ├── chart-controls.tsx
│   │   └── timeframe-selector.tsx   # 🆕 V5: 7 timeframes (M15-D1)
│   ├── alerts/
│   │   ├── alert-list.tsx
│   │   ├── alert-form.tsx           # 🆕 V5: Symbol+TF selection
│   │   ├── alert-card.tsx
│   │   └── notification-toast.tsx
│   ├── watchlist/
│   │   ├── watchlist-table.tsx      # 🆕 V5: Shows symbol+TF combos
│   │   ├── add-watchlist-item.tsx   # 🆕 V5: Select symbol+TF
│   │   └── tier-locked-symbols.tsx  # 🆕 V5: Shows locked symbols
│   ├── pricing/
│   │   ├── pricing-card.tsx         # 🆕 V5: FREE vs PRO cards
│   │   ├── feature-comparison.tsx   # 🆕 V5: Symbol access comparison
│   │   └── upgrade-button.tsx       # 🆕 V5: Stripe checkout
│   ├── auth/
│   │   ├── login-form.tsx
│   │   ├── register-form.tsx
│   │   └── social-auth-buttons.tsx
│   └── providers/
│       ├── auth-provider.tsx
│       ├── theme-provider.tsx
│       └── websocket-provider.tsx
│
├── lib/
│   ├── auth/
│   │   ├── auth-options.ts
│   │   └── session.ts               # 🆕 V5: Includes tier in session
│   ├── db/
│   │   ├── prisma.ts
│   │   └── seed.ts
│   ├── api/
│   │   ├── mt5-client.ts            # Flask service client
│   │   ├── indicators.ts
│   │   └── alerts.ts
│   ├── validations/
│   │   ├── auth.ts
│   │   ├── alert.ts
│   │   ├── watchlist.ts             # 🆕 V5: Symbol+TF validation
│   │   └── user.ts
│   ├── utils/
│   │   ├── helpers.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   ├── constants/                   # 🆕 V5: New constants directory
│   │   ├── timeframes.ts            # 🆕 V5: 7 timeframes
│   │   └── tiers.ts                 # 🆕 V5: Tier system
│   ├── middleware/
│   │   └── tier-guard.ts            # 🆕 V5: Tier-based access control
│   └── jobs/
│       ├── alert-checker.ts
│       └── queue.ts
│
├── hooks/
│   ├── use-indicators.ts
│   ├── use-alerts.ts
│   ├── use-websocket.ts
│   ├── use-auth.ts
│   ├── use-tier.ts                  # 🆕 V5: Tier management hook
│   └── use-toast.ts
│
├── types/
│   ├── index.ts
│   ├── indicator.ts
│   ├── alert.ts
│   ├── user.ts
│   ├── tier.ts                      # 🆕 V5: Tier types
│   └── api.ts
│
├── prisma/
│   ├── schema.prisma                # 🆕 V5: Updated schema
│   ├── seed.ts
│   └── migrations/
│
├── public/
│   ├── icons/
│   │   ├── icon-192x192.png
│   │   └── icon-512x512.png
│   ├── images/
│   └── manifest.json
│
├── middleware.ts                    # Auth & rate limiting + tier checks
├── next.config.js                   # 🆕 V5: Next.js 15 config
├── tailwind.config.ts
├── tsconfig.json
├── package.json                     # 🆕 V5: Next 15, React 19
├── .env.local
├── .env.example
├── .eslintrc.json
├── .prettierrc
└── README.md
```

### 5.2 Flask Microservice Structure

```
mt5-service/
├── app/
│   ├── __init__.py
│   ├── routes/
│   │   ├── __init__.py
│   │   └── indicators.py            # 🆕 V5: Tier validation added
│   ├── services/
│   │   ├── __init__.py
│   │   ├── mt5_service.py           # Reads YOUR .mq5 indicators
│   │   └── tier_validator.py       # 🆕 V5: Validates symbol access
│   └── utils/
│       ├── __init__.py
│       └── helpers.py
│
├── indicators/                      # ◄── COPY YOUR .mq5 FILES HERE
│   ├── README.md                    # Instructions for MT5 setup
│   ├── Fractal Horizontal Line_V5.mq5  # ◄── FROM YOUR UPLOAD
│   └── Fractal Diagonal Line_V4.mq5     # ◄── FROM YOUR UPLOAD
│
├── config/
│   ├── __init__.py
│   ├── timeframes.py                # 🆕 V5: 7 timeframes
│   └── tiers.py                     # 🆕 V5: Tier-symbol mapping
│
├── tests/
│   ├── test_indicators.py
│   └── test_tier_validation.py      # 🆕 V5: Tier access tests
│
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env
├── .env.example
└── README.md                        # 🆕 V5: Updated with tier info
```

**🆕 V5: Flask Configuration Files**

```python
# config/timeframes.py
TIMEFRAMES = {
    'M15': 15,
    'M30': 30,
    'H1': 16385,
    'H2': 16386,   # V5: Added
    'H4': 16388,
    'H8': 16392,   # V5: Added
    'D1': 16408,
}

VALID_TIMEFRAMES = list(TIMEFRAMES.keys())
```

```python
# config/tiers.py
TIER_SYMBOLS = {
    'FREE': ['XAUUSD'],
    'PRO': [
        'AUDUSD', 'BTCUSD', 'ETHUSD', 'EURUSD', 'GBPUSD',
        'NDX100', 'US30', 'USDJPY', 'XAGUSD', 'XAUUSD',
    ],
}

def can_access_symbol(tier: str, symbol: str) -> bool:
    """Validate if a tier can access a symbol"""
    return symbol in TIER_SYMBOLS.get(tier, [])
```

---
