## 6. Database Schema

### 6.1 Prisma Schema

```prisma
// prisma/schema.prisma
// 🆕 V5: Updated for 2-tier system and symbol+timeframe watchlists

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER MANAGEMENT
// ============================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  passwordHash  String?
  emailVerified DateTime?
  image         String?
  tier          UserTier  @default(FREE)        // 🆕 V5: Defaults to FREE

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLogin     DateTime?
  isActive      Boolean   @default(true)

  // Relations
  accounts      Account[]
  sessions      Session[]
  alerts        Alert[]
  watchlists    Watchlist[]
  preferences   UserPreference[]
  subscription  Subscription?
  apiUsage      ApiUsage[]
  notifications Notification[]

  @@index([email])
  @@index([tier])
}

// 🆕 V5: Updated to 2-tier system (removed ENTERPRISE)
enum UserTier {
  FREE          // 1 symbol (XAUUSD), 7 timeframes
  PRO           // 10 symbols, 7 timeframes each
}

// ============================================
// AUTHENTICATION (NextAuth.js)
// ============================================

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
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

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================
// ALERTS & NOTIFICATIONS
// ============================================

model Alert {
  id            String      @id @default(cuid())
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  name          String?
  symbol        String
  timeframe     String                          // 🆕 V5: One of 7 timeframes
  alertType     AlertType
  condition     Json        // Flexible JSON for different alert conditions

  isActive      Boolean     @default(true)
  lastTriggered DateTime?
  triggerCount  Int         @default(0)

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  notifications AlertNotification[]

  @@index([userId, isActive])
  @@index([symbol, timeframe, isActive])
}

enum AlertType {
  PRICE_TOUCH_LINE
  PRICE_CROSS_LINE
  FRACTAL_NEW
  LINE_BREAK
  INDICATOR_VALUE
  CUSTOM
}

model AlertNotification {
  id           String   @id @default(cuid())
  alertId      String
  alert        Alert    @relation(fields: [alertId], references: [id], onDelete: Cascade)

  triggeredAt  DateTime @default(now())
  price        Float
  details      Json
  isRead       Boolean  @default(false)
  readAt       DateTime?

  @@index([alertId, isRead])
  @@index([triggeredAt])
}

// ============================================
// WATCHLISTS (🆕 V5: Symbol+Timeframe Combinations)
// ============================================

// 🆕 V5: New model for symbol+timeframe combinations
model WatchlistItem {
  id          String    @id @default(cuid())
  watchlistId String
  watchlist   Watchlist @relation(fields: [watchlistId], references: [id], onDelete: Cascade)

  symbol      String    // e.g., "XAUUSD"
  timeframe   String    // e.g., "H1" (one of 7 timeframes)
  order       Int       @default(0)

  createdAt   DateTime  @default(now())

  @@unique([watchlistId, symbol, timeframe])
  @@index([watchlistId])
  @@index([symbol, timeframe])
}

// 🆕 V5: Updated to use WatchlistItem relation
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  name      String
  items     WatchlistItem[]  // 🆕 V5: Changed from symbols String[]
  order     Int      @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

// ============================================
// USER PREFERENCES
// ============================================

model UserPreference {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  category String // e.g., "chart", "alerts", "notifications"
  key      String
  value    Json

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, category, key])
  @@index([userId])
}

// ============================================
// SUBSCRIPTIONS & PAYMENTS (🆕 V5: 2-Tier System)
// ============================================

model Subscription {
  id                     String              @id @default(cuid())
  userId                 String              @unique
  user                   User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  stripeCustomerId       String              @unique
  stripeSubscriptionId   String?             @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  status                 SubscriptionStatus  @default(INACTIVE)
  plan                   UserTier           @default(FREE)  // 🆕 V5: FREE or PRO only

  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt
  canceledAt             DateTime?
  cancelAtPeriodEnd      Boolean             @default(false)

  @@index([userId])
  @@index([stripeCustomerId])
}

enum SubscriptionStatus {
  ACTIVE
  INACTIVE
  CANCELED
  PAST_DUE
  UNPAID
  TRIALING
}

// ============================================
// GENERAL NOTIFICATIONS
// ============================================

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  type      NotificationType
  title     String
  message   String   @db.Text
  data      Json?

  isRead    Boolean  @default(false)
  readAt    DateTime?

  createdAt DateTime @default(now())

  @@index([userId, isRead])
  @@index([createdAt])
}

enum NotificationType {
  ALERT
  SYSTEM
  BILLING
  SECURITY
  FEATURE
}

// ============================================
// INDICATOR DATA CACHE
// ============================================

model IndicatorCache {
  id         String   @id @default(cuid())
  symbol     String
  timeframe  String   // 🆕 V5: One of 7 timeframes (M15, M30, H1, H2, H4, H8, D1)
  timestamp  DateTime

  dataType   String   // "horizontal", "diagonal", "fractal"
  data       Json     // Full indicator data

  createdAt  DateTime @default(now())
  expiresAt  DateTime // Cache expiry

  @@unique([symbol, timeframe, dataType, timestamp])
  @@index([symbol, timeframe, expiresAt])
}

// ============================================
// API USAGE & ANALYTICS
// ============================================

model ApiUsage {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  endpoint  String
  method    String
  status    Int
  duration  Int      // milliseconds

  symbol    String?
  timeframe String?  // 🆕 V5: One of 7 timeframes
  tier      String?  // 🆕 V5: Track tier for analytics

  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([endpoint, createdAt])
  @@index([tier, createdAt])  // 🆕 V5: Index for tier analytics
}

// ============================================
// SYSTEM LOGS (Optional - for debugging)
// ============================================

model SystemLog {
  id        String   @id @default(cuid())
  level     LogLevel
  source    String   // "api", "job", "webhook"
  message   String   @db.Text
  metadata  Json?

  createdAt DateTime @default(now())

  @@index([level, createdAt])
  @@index([source, createdAt])
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
  FATAL
}
```

### 6.2 Database Relationships Diagram

```
User
├── (1:N) Account
├── (1:N) Session
├── (1:N) Alert
│   └── (1:N) AlertNotification
├── (1:N) Watchlist                  # 🆕 V5: Updated
│   └── (1:N) WatchlistItem         # 🆕 V5: New model
├── (1:N) UserPreference
├── (1:1) Subscription               # 🆕 V5: 2-tier system
├── (1:N) Notification
└── (1:N) ApiUsage

IndicatorCache (standalone, no relations)
SystemLog (standalone, no relations)
```

### 6.3 Key Schema Changes in V5

**🆕 V5 Changes Summary:**

1. **UserTier Enum**: Removed `ENTERPRISE`, only `FREE` and `PRO`
2. **WatchlistItem Model**: New model for storing symbol+timeframe combinations
3. **Watchlist Model**: Changed from `symbols String[]` to `items WatchlistItem[]`
4. **Timeframes**: All timeframe fields now support 7 values: M15, M30, H1, H2, H4, H8, D1
5. **ApiUsage**: Added `tier` field for tier-based analytics

---

## 7. Implementation Guide

### Phase 1: Foundation Setup (Week 1)

#### 7.1 Initialize Next.js 15 Project

**🆕 V5: Updated for Next.js 15 with Turbopack**

```bash
# Create Next.js 15 app with TypeScript
npx create-next-app@latest trading-alerts-saas \
  --typescript \
  --tailwind \
  --app \
  --turbopack \
  --src-dir=false

cd trading-alerts-saas

# Verify Next.js 15 and React 19
cat package.json | grep -E "next|react"
# Should show: "next": "15.0.0" and "react": "19.0.0"

# Install dependencies
pnpm install

# Install additional packages
pnpm install @prisma/client prisma
pnpm install next-auth@beta  # NextAuth.js v5
pnpm install zod react-hook-form @hookform/resolvers
pnpm install zustand
pnpm install @tanstack/react-query
pnpm install socket.io-client
pnpm install lucide-react
pnpm install lightweight-charts  # TradingView Charts
pnpm install stripe @stripe/stripe-js  # 🆕 V5: Payment processing
pnpm install -D @types/node
```

#### 7.2 Setup Prisma with V5 Schema

```bash
# Initialize Prisma
npx prisma init

# Copy V5 schema from section 6.1 to prisma/schema.prisma
# Make sure to include:
# - 2-tier UserTier enum (FREE, PRO)
# - WatchlistItem model
# - Updated Watchlist model

# Create and run migrations
npx prisma migrate dev --name init_v5_schema

# Generate Prisma Client
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

#### 7.3 Environment Variables

Create `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/trading_alerts_v5"

# NextAuth (v5)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Flask MT5 Service
MT5_API_URL="http://localhost:5001"
MT5_API_KEY="your-secret-api-key"

# Redis
REDIS_URL="redis://localhost:6379"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"

# 🆕 V5: Stripe (2-tier system)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_PRO_PRICE_ID="price_..."  # Your PRO plan price ID

# Sentry (monitoring)
SENTRY_DSN="your-sentry-dsn"

# 🆕 V5: Tier Configuration
NEXT_PUBLIC_FREE_TIER_SYMBOL="XAUUSD"
NEXT_PUBLIC_PRO_TIER_PRICE="29"
```

#### 7.4 Next.js 15 Configuration

**🆕 V5: Updated next.config.js for Next.js 15**

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 🆕 V5: Next.js 15 experimental features
  experimental: {
    ppr: true, // Partial Prerendering
    reactCompiler: true, // React Compiler (React 19)
  },

  // Image optimization
  images: {
    domains: ['localhost', 'your-domain.com'],
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // Webpack configuration
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
};

module.exports = nextConfig;
```

#### 7.5 Setup shadcn/ui

```bash
# Initialize shadcn/ui
npx shadcn-ui@latest init

# Add required components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add form
npx shadcn-ui@latest add badge      # 🆕 V5: For tier badges
npx shadcn-ui@latest add table      # 🆕 V5: For watchlist tables
npx shadcn-ui@latest add tabs       # 🆕 V5: For pricing comparison
```

#### 7.6 Create Constants Files

**🆕 V5: Create timeframes and tiers constants**

```bash
mkdir -p lib/constants
```

```typescript
// lib/constants/timeframes.ts
// 🆕 V5: 7 timeframes (removed M1, M5; added H2, H8)
export const TIMEFRAMES = {
  M15: 'M15',
  M30: 'M30',
  H1: 'H1',
  H2: 'H2',
  H4: 'H4',
  H8: 'H8',
  D1: 'D1',
} as const;

export type Timeframe = keyof typeof TIMEFRAMES;

export const MT5_TIMEFRAMES: Record<Timeframe, number> = {
  M15: 15,
  M30: 30,
  H1: 16385,
  H2: 16386,
  H4: 16388,
  H8: 16392,
  D1: 16408,
};

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  M15: '15 Minutes',
  M30: '30 Minutes',
  H1: '1 Hour',
  H2: '2 Hours',
  H4: '4 Hours',
  H8: '8 Hours',
  D1: '1 Day',
};

export function isValidTimeframe(tf: string): tf is Timeframe {
  return Object.keys(TIMEFRAMES).includes(tf);
}
```

```typescript
// lib/constants/tiers.ts
// 🆕 V5: Commercial 2-tier system
export const TIER_SYMBOLS = {
  FREE: ['XAUUSD'],
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
  ],
} as const;

export type UserTier = 'FREE' | 'PRO';

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

#### 7.7 Database Seeding

**🆕 V5: Seed with 2-tier data**

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create test users with different tiers
  const hashedPassword = await bcrypt.hash('password123', 10);

  // FREE tier user
  const freeUser = await prisma.user.upsert({
    where: { email: 'free@test.com' },
    update: {},
    create: {
      email: 'free@test.com',
      name: 'Free User',
      passwordHash: hashedPassword,
      tier: 'FREE',
      emailVerified: new Date(),
    },
  });

  // PRO tier user
  const proUser = await prisma.user.upsert({
    where: { email: 'pro@test.com' },
    update: {},
    create: {
      email: 'pro@test.com',
      name: 'Pro User',
      passwordHash: hashedPassword,
      tier: 'PRO',
      emailVerified: new Date(),
    },
  });

  // Create watchlists with symbol+timeframe combinations
  const freeWatchlist = await prisma.watchlist.create({
    data: {
      userId: freeUser.id,
      name: 'My Watchlist',
      items: {
        create: [
          { symbol: 'XAUUSD', timeframe: 'H1', order: 0 },
          { symbol: 'XAUUSD', timeframe: 'H4', order: 1 },
          { symbol: 'XAUUSD', timeframe: 'D1', order: 2 },
        ],
      },
    },
  });

  const proWatchlist = await prisma.watchlist.create({
    data: {
      userId: proUser.id,
      name: 'My Watchlist',
      items: {
        create: [
          { symbol: 'XAUUSD', timeframe: 'H1', order: 0 },
          { symbol: 'EURUSD', timeframe: 'H4', order: 1 },
          { symbol: 'BTCUSD', timeframe: 'D1', order: 2 },
          { symbol: 'XAUUSD', timeframe: 'M15', order: 3 },
        ],
      },
    },
  });

  console.log('✅ Seeded database with V5 data');
  console.log('Free User:', freeUser.email, '- Tier:', freeUser.tier);
  console.log('Pro User:', proUser.email, '- Tier:', proUser.tier);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run seeding:

```bash
npx prisma db seed
```

#### 7.8 Project Structure Verification

```bash
# Verify your project has all required directories
ls -la

# Should see:
# app/
# components/
# lib/
# prisma/
# public/
# next.config.js
# package.json (with Next 15, React 19)
# tsconfig.json
```

---

**🎯 Phase 1 Complete Checklist:**

```
✅ Next.js 15 project created with Turbopack
✅ React 19 installed
✅ Prisma initialized with V5 schema
✅ Environment variables configured
✅ shadcn/ui components installed
✅ Constants files created (timeframes + tiers)
✅ Database seeded with test data
✅ 2-tier system configured
✅ WatchlistItem model implemented
✅ 7 timeframes configured (M15, M30, H1, H2, H4, H8, D1)
```

**Next Steps:**

- Phase 2: Authentication with NextAuth.js v5
- Phase 3: Flask MT5 Service Setup
- Phase 4: API Routes with Tier Validation
- Phase 5: Frontend Components

---
