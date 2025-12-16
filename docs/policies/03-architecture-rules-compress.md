# Architecture Rules for Aider with MiniMax M2

System design constraints for Trading Alerts SaaS - structure, data flow, and component integration.

---

## 1. DIRECTORY STRUCTURE

### 1.1 File Placement (follows v5-structure-division.md)

```
trading-alerts-saas/
├── app/                      # Next.js 15 App Router
│   ├── api/                 # API routes (serverless functions)
│   │   ├── alerts/route.ts                    # GET/POST /api/alerts
│   │   ├── alerts/[id]/route.ts               # GET/PATCH/DELETE /api/alerts/:id
│   │   └── indicators/[symbol]/[timeframe]/route.ts
│   ├── dashboard/           # Dashboard pages (Server Components)
│   ├── (marketing)/         # Marketing pages
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── ui/                 # shadcn/ui components
│   ├── alerts/
│   └── charts/
├── lib/                     # Business logic & utilities
│   ├── api-client/         # Auto-generated from OpenAPI (Next.js)
│   ├── mt5-client/         # Auto-generated from OpenAPI (Flask)
│   ├── db/                 # Database operations
│   ├── tier/               # Tier validation
│   └── utils/              # Pure functions
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/
├── mt5-service/            # Flask MT5 microservice
│   ├── app/
│   │   ├── routes/
│   │   └── services/
│   ├── requirements.txt
│   └── Dockerfile
└── docs/
```

### 1.2 Separation of Concerns

| Folder             | Responsibility           | Can Import           | Cannot Import     |
| ------------------ | ------------------------ | -------------------- | ----------------- |
| **app/api/**       | HTTP endpoints           | lib/, prisma         | components/       |
| **app/dashboard/** | Pages, Server Components | components/, lib/    | app/api/          |
| **components/**    | UI presentation          | lib/utils, lib/hooks | lib/db, app/api   |
| **lib/db/**        | Database operations      | prisma               | components/, app/ |
| **lib/tier/**      | Tier validation          | -                    | components/, app/ |
| **lib/utils/**     | Pure utilities           | -                    | Domain code       |

---

## 2. LAYER ARCHITECTURE

### 2.1 Five Layers

```
FRONTEND (app/dashboard, components)
    ↓ fetch()
API LAYER (app/api)
    ↓ calls
BUSINESS LOGIC (lib/)
    ↓ uses
DATABASE (lib/db, prisma)
    ↓ queries
EXTERNAL SERVICES (Flask MT5, Stripe, Email)
```

**Data Flow Rules:**

- ✅ Frontend → API routes via fetch()
- ✅ API routes → business logic functions
- ✅ Business logic → database operations
- ❌ Frontend NEVER calls database directly
- ❌ Business logic NEVER returns HTTP responses

---

## 3. TYPE SYSTEM

### 3.1 OpenAPI Specs = Source of Truth

**Files:**

- `docs/trading_alerts_openapi.yaml` → Next.js API types
- `docs/flask_mt5_openapi.yaml` → Flask MT5 types

**Generation:**

```bash
sh scripts/openapi/generate-nextjs-types.sh  # → lib/api-client/
sh scripts/openapi/generate-flask-types.sh   # → lib/mt5-client/
```

**Usage:**

```typescript
// ✅ GOOD
import type { Alert, CreateAlertRequest } from '@/lib/api-client';

// ❌ BAD
interface Alert { ... }  // Don't manually define OpenAPI types
```

---

## 4. AUTHENTICATION & AUTHORIZATION

### 4.1 NextAuth.js Configuration

**Version:** NextAuth.js v4.24.5
**Providers:** CredentialsProvider (Email/Password) + GoogleProvider (OAuth)
**Session:** JWT (serverless-friendly)

**Basic Setup:**

```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      async authorize(credentials) {
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user || !user.password) return null;
        if (!(await bcrypt.compare(credentials.password, user.password)))
          return null;
        return { id: user.id, email: user.email, tier: user.tier };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tier = user.tier;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.tier = token.tier;
      return session;
    },
  },
});
```

> See `docs/policies/08-google-oauth-implementation-rules.md` for complete OAuth setup.

### 4.2 Tier Validation

**Tier Rules:**

| Tier | Symbols                                  | Timeframes     | Combinations |
| ---- | ---------------------------------------- | -------------- | ------------ |
| FREE | 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) | 3 (H1, H4, D1) | 15           |
| PRO  | 15 (all)                                 | 9 (M5-D1)      | 135          |

**Implementation:**

```typescript
// lib/tier/validation.ts
const FREE_SYMBOLS = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'];
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
];
const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'];
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
];

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function validateChartAccess(
  tier: UserTier,
  symbol: string,
  timeframe: string
): void {
  const symbols = tier === 'PRO' ? PRO_SYMBOLS : FREE_SYMBOLS;
  const timeframes = tier === 'PRO' ? PRO_TIMEFRAMES : FREE_TIMEFRAMES;

  if (!symbols.includes(symbol)) {
    throw new ForbiddenError(`${tier} tier cannot access ${symbol}`);
  }
  if (!timeframes.includes(timeframe)) {
    throw new ForbiddenError(`${tier} tier cannot access ${timeframe}`);
  }
}
```

**Usage in API:**

```typescript
// app/api/indicators/[symbol]/[timeframe]/route.ts
export async function GET(req: Request, { params }) {
  const session = await getServerSession();
  if (!session)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    validateChartAccess(session.user.tier, params.symbol, params.timeframe);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const data = await fetchIndicatorData(params.symbol, params.timeframe);
  return Response.json(data);
}
```

**Critical:** Validate tiers on BOTH Next.js API routes AND Flask MT5 service.

### 4.3 Auth Check Locations

| Location              | Auth Check      | Tier Check      | Example               |
| --------------------- | --------------- | --------------- | --------------------- |
| **middleware.ts**     | ✅ (redirect)   | ❌              | Protect /dashboard/\* |
| **API routes**        | ✅ (401)        | ✅ (403)        | All /api/\*           |
| **Server Components** | ✅ (redirect)   | ✅ (UI)         | Dashboard pages       |
| **Client Components** | ❌ (useSession) | ✅ (disable UI) | Forms                 |

**Middleware Example:**

```typescript
// middleware.ts
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  if (request.nextUrl.pathname.startsWith('/dashboard') && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };
```

---

## 5. DATABASE PATTERNS

### 5.1 Prisma Only (No Raw SQL)

**Singleton Pattern:**

```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 5.2 Database Operations

```typescript
// lib/db/alerts.ts
import { prisma } from './prisma';
import type { Alert, Prisma } from '@prisma/client';

export async function createAlert(
  data: Prisma.AlertCreateInput
): Promise<Alert> {
  return prisma.alert.create({ data });
}

export async function getUserAlerts(userId: string): Promise<Alert[]> {
  return prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAlertById(
  alertId: string,
  userId: string
): Promise<Alert | null> {
  return prisma.alert.findFirst({ where: { id: alertId, userId } });
}

export async function updateAlert(
  alertId: string,
  userId: string,
  data: Prisma.AlertUpdateInput
): Promise<Alert> {
  return prisma.alert.update({ where: { id: alertId }, data });
}

export async function deleteAlert(
  alertId: string,
  userId: string
): Promise<void> {
  await prisma.alert.delete({ where: { id: alertId, userId } });
}

export async function countUserAlerts(userId: string): Promise<number> {
  return prisma.alert.count({ where: { userId } });
}
```

---

## 6. API ROUTE STRUCTURE

### 6.1 Standard Pattern

```typescript
// 1. Imports
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

// 2. Validation schema
const createSchema = z.object({ symbol: z.string().min(1) });

// 3. Handler
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await fetchData(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## 7. REACT COMPONENT STRUCTURE

### 7.1 Server Components (Default)

**Use when:** No interactivity, fetching data, SEO important

```typescript
// app/dashboard/page.tsx (no 'use client')
import { getServerSession } from 'next-auth';
import { getUserAlerts } from '@/lib/db/alerts';

export default async function DashboardPage() {
  const session = await getServerSession();
  const alerts = await getUserAlerts(session.user.id);
  return <AlertList alerts={alerts} />;
}
```

### 7.2 Client Components

**Use when:** React hooks, user interactions, browser APIs

```typescript
// components/alerts/alert-form.tsx
'use client';

import { useState } from 'react';

export function AlertForm() {
  const [symbol, setSymbol] = useState('EURUSD');
  async function handleSubmit(e: React.FormEvent) { /* ... */ }
  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

---

## 8. FLASK MT5 SERVICE - MULTI-TERMINAL ARCHITECTURE

### 8.1 Multi-Terminal Overview

**Architecture:** 15 separate MT5 terminals (one per symbol)

**Why:** Single terminal cannot handle 135 chart combinations efficiently. 15 terminals × 9 charts each = distributed load.

**Symbol Mapping:**

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

**Structure:**

```
mt5-service/
├── app/
│   ├── routes/
│   │   ├── indicators.py           # User-facing endpoints
│   │   └── admin_terminals.py      # Admin-only endpoints
│   ├── services/
│   │   ├── mt5_connection_pool.py  # Connection pool manager
│   │   ├── indicator_reader.py     # Reads from terminals
│   │   └── health_monitor.py       # Background health checks
│   └── middleware/
│       ├── auth.py                 # API key + admin auth
│       └── tier_validator.py       # Tier validation
├── config/
│   └── mt5_terminals.json          # 15 terminals config
└── run.py
```

### 8.2 Connection Pool Pattern

```python
# app/services/mt5_connection_pool.py
from typing import Dict, Optional
import MetaTrader5 as mt5
from threading import Lock

class MT5Connection:
    def __init__(self, config: dict):
        self.id = config['id']
        self.symbol = config['symbol']
        self.server = config['server']
        self.login = config['login']
        self.password = config['password']
        self.connected = False
        self.lock = Lock()

    def connect(self) -> bool:
        with self.lock:
            if not mt5.initialize(): return False
            authorized = mt5.login(self.login, self.password, self.server)
            if authorized: self.connected = True
            return authorized

class MT5ConnectionPool:
    def __init__(self, config_path: str):
        self.connections: Dict[str, MT5Connection] = {}
        self.symbol_to_connection: Dict[str, MT5Connection] = {}
        self._load_config(config_path)

    def get_connection_by_symbol(self, symbol: str) -> Optional[MT5Connection]:
        connection = self.symbol_to_connection.get(symbol)
        if connection and not connection.connected:
            connection.reconnect()
        return connection

_connection_pool = None
def get_connection_pool() -> MT5ConnectionPool:
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = MT5ConnectionPool('config/mt5_terminals.json')
        _connection_pool.connect_all()
    return _connection_pool
```

### 8.3 Admin Endpoints

**Required:**

```python
GET  /api/admin/terminals/health           # Health of all 15 terminals
POST /api/admin/terminals/{id}/restart     # Restart specific terminal
POST /api/admin/terminals/restart-all      # Restart all (critical)
GET  /api/admin/terminals/{id}/logs        # Terminal logs
GET  /api/admin/terminals/stats            # Aggregate stats
```

**Authentication:** Admin endpoints use `X-Admin-API-Key` header (separate from regular API key).

### 8.4 Tier Validation in Flask

```python
# app/middleware/tier_validator.py
FREE_SYMBOLS = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD']
PRO_SYMBOLS = ['AUDJPY', 'AUDUSD', 'BTCUSD', 'ETHUSD', 'EURUSD', 'GBPJPY', 'GBPUSD', 'NDX100', 'NZDUSD', 'US30', 'USDCAD', 'USDCHF', 'USDJPY', 'XAGUSD', 'XAUUSD']
FREE_TIMEFRAMES = ['H1', 'H4', 'D1']
PRO_TIMEFRAMES = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1']

def validate_tier_access(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        tier = request.headers.get('X-User-Tier', 'FREE')
        symbol = kwargs.get('symbol')
        timeframe = kwargs.get('timeframe')

        allowed_symbols = PRO_SYMBOLS if tier == 'PRO' else FREE_SYMBOLS
        if symbol not in allowed_symbols:
            return jsonify({'error': f'{tier} tier cannot access {symbol}'}), 403

        allowed_timeframes = PRO_TIMEFRAMES if tier == 'PRO' else FREE_TIMEFRAMES
        if timeframe not in allowed_timeframes:
            return jsonify({'error': f'{tier} tier cannot access {timeframe}'}), 403

        return f(*args, **kwargs)
    return decorated_function
```

**Usage:**

```python
# app/routes/indicators.py
@indicators_bp.route('/api/indicators/<symbol>/<timeframe>', methods=['GET'])
@validate_tier_access
def get_indicators(symbol: str, timeframe: str):
    pool = get_connection_pool()
    connection = pool.get_connection_by_symbol(symbol)

    if not connection or not connection.connected:
        return jsonify({'error': f'Terminal for {symbol} disconnected'}), 503

    data = fetch_indicator_data(connection, symbol, timeframe, bars=1000)
    data['metadata'] = {
        'terminal_id': connection.id,
        'fetchedAt': datetime.utcnow().isoformat()
    }
    return jsonify({'success': True, 'data': data}), 200
```

### 8.5 Next.js to Flask Communication

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
      'X-User-Tier': userTier,
      'X-API-Key': process.env.FLASK_API_KEY || '',
    },
  });

  if (!res.ok) throw new Error(`Flask API error: ${res.statusText}`);
  return res.json();
}
```

---

## 9. DEPENDENCY RULES

### 9.1 Pre-Approved Dependencies

**Next.js/React:** next (v15), react (v19), react-dom (v19)
**UI:** @radix-ui/\*, tailwindcss, lucide-react
**Forms:** zod, react-hook-form, @hookform/resolvers
**Auth:** next-auth, bcryptjs
**Database:** @prisma/client, prisma
**API:** axios
**Date:** date-fns
**Charts:** recharts or lightweight-charts
**Payments:** stripe, @stripe/stripe-js
**Flask:** Flask, MetaTrader5, python-dotenv, gunicorn

### 9.2 Require Approval

Escalate for new packages not listed, alternatives, or large dependencies (>100KB).

---

## 10. TESTING STRATEGY

### 10.1 Testing Pyramid

```
E2E Tests (Playwright) - Few (critical flows)
Integration Tests (Jest) - Some (API routes)
Unit Tests (Jest) - Many (lib/ functions)
```

**Examples:**

```typescript
// lib/tier/validation.test.ts (Unit)
describe('validateSymbolAccess', () => {
  it('allows FREE tier to access FREE symbols', () => {
    expect(() => validateSymbolAccess('FREE', 'EURUSD')).not.toThrow();
  });
  it('denies FREE tier access to PRO symbols', () => {
    expect(() => validateSymbolAccess('FREE', 'AUDJPY')).toThrow();
  });
});

// app/api/alerts/route.test.ts (Integration)
describe('POST /api/alerts', () => {
  it('creates alert for authenticated user', async () => {
    const response = await POST(mockRequest);
    expect(response.status).toBe(201);
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
VERCEL (Next.js)
  ├─ Serverless functions (app/api/*)
  ├─ Edge middleware
  └─ Env: NEXTAUTH_SECRET, DATABASE_URL, FLASK_MT5_URL, STRIPE_SECRET_KEY

RAILWAY PostgreSQL
  ├─ Production database
  └─ Automatic backups

RAILWAY Flask MT5
  ├─ Docker container
  └─ Python 3.11

MT5 Terminal (VPS/Local)
  └─ Windows/Linux with MT5 installed
```

### 11.2 Environment Variables

**Vercel:**

```bash
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=generated-secret
DATABASE_URL=postgresql://user:pass@railway.app/dbname
FLASK_MT5_URL=https://flask-service.railway.app
FLASK_API_KEY=generated-key
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
RESEND_API_KEY=re_...
```

**Railway Flask:**

```bash
MT5_SERVER=broker-server
MT5_LOGIN=account
MT5_PASSWORD=password
FLASK_API_KEY=same-as-nextjs
DATABASE_URL=postgresql://user:pass@railway.app/dbname
```

---

## 12. CHART DATA REFRESH STRATEGY

### 12.1 Polling Intervals

```typescript
const REFRESH_INTERVALS = {
  M5: 30000, // 30s (PRO only)
  M15: 60000, // 1m
  M30: 60000, // 1m
  H1: 120000, // 2m
  H2: 120000, // 2m
  H4: 300000, // 5m
  H8: 300000, // 5m
  H12: 600000, // 10m (PRO only)
  D1: 600000, // 10m
};
```

**Implementation:**

```typescript
// components/charts/trading-chart.tsx
'use client';

export function TradingChart({ symbol, timeframe }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchIndicatorData();
    const interval = setInterval(fetchIndicatorData, REFRESH_INTERVALS[timeframe]);
    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  async function fetchIndicatorData() {
    const res = await fetch(`/api/indicators/${symbol}/${timeframe}`);
    setData(await res.json());
  }

  return <Chart data={data} />;
}
```

**Rate Limits:**

- FREE: 60 requests/hour (~1 chart/minute)
- PRO: 300 requests/hour (~5 charts/minute)

---

## 13. AFFILIATE MARKETING ARCHITECTURE

### 13.1 2-Sided Marketplace

**User Types:** Affiliates, End Users, Admin

**Structure:**

```
AFFILIATE PORTAL
  ├─ /affiliate/register, /login, /dashboard (Affiliate JWT)
  └─ API: /api/affiliate/*

END USER PORTAL
  ├─ /auth/register, /dashboard (User JWT)
  └─ API: /api/user/*

ADMIN PANEL
  ├─ /admin/affiliates, /reports (Admin role)
  └─ API: /api/admin/*
```

### 13.2 Database Schema

**Relationships:**

```
Affiliate (1) ─┬─ (M) AffiliateCode
               └─ (M) Commission

AffiliateCode (1) ─── (1) Commission
User (1) ─────────── (M) Commission
Subscription (1) ─── (0..1) AffiliateCode
```

**Critical Fields:**

- `AffiliateCode.status`: `[ACTIVE, USED, EXPIRED, CANCELLED]`
- `AffiliateCode.code`: Unique, crypto.randomBytes(16)
- `Commission.status`: `[PENDING, PAID]`
- `Affiliate.paymentMethod`: `[BANK_TRANSFER, CRYPTO, GLOBAL_WALLET, LOCAL_WALLET]`

### 13.3 Separate Authentication

```typescript
// lib/auth/affiliate-auth.ts
export async function generateAffiliateToken(
  affiliate: Affiliate
): Promise<string> {
  return jwt.sign(
    { id: affiliate.id, email: affiliate.email, type: 'AFFILIATE' },
    process.env.AFFILIATE_JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

export function validateAffiliateToken(token: string) {
  const decoded = jwt.verify(token, process.env.AFFILIATE_JWT_SECRET!);
  if (decoded.type !== 'AFFILIATE') throw new Error('Invalid token type');
  return decoded;
}
```

### 13.4 Code Distribution (Automated Monthly Cron)

```typescript
// app/api/cron/distribute-codes/route.ts
export async function GET(req: NextRequest) {
  // Verify cron secret
  if (
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeAffiliates = await prisma.affiliate.findMany({
    where: { status: 'ACTIVE' },
  });

  // Fetch from SystemConfig
  const discountPercent = parseFloat(
    (
      await prisma.systemConfig.findUnique({
        where: { key: 'affiliate_discount_percent' },
      })
    )?.value || '20.0'
  );
  const commissionPercent = parseFloat(
    (
      await prisma.systemConfig.findUnique({
        where: { key: 'affiliate_commission_percent' },
      })
    )?.value || '20.0'
  );
  const codesPerMonth = parseInt(
    (
      await prisma.systemConfig.findUnique({
        where: { key: 'affiliate_codes_per_month' },
      })
    )?.value || '15'
  );

  for (const affiliate of activeAffiliates) {
    const codes = Array.from({ length: codesPerMonth }, () => ({
      code: generateRandomCode(affiliate.fullName),
      affiliateId: affiliate.id,
      status: 'ACTIVE',
      discountPercent,
      commissionPercent,
      expiresAt: endOfMonth(new Date()),
    }));

    await prisma.affiliateCode.createMany({ data: codes });
    await sendEmail(affiliate.email, 'Monthly Codes', codes);
  }

  return NextResponse.json({ success: true });
}
```

**Vercel Cron:**

```json
{
  "crons": [
    { "path": "/api/cron/distribute-codes", "schedule": "0 0 1 * *" },
    { "path": "/api/cron/expire-codes", "schedule": "59 23 28-31 * *" }
  ]
}
```

### 13.5 Commission Calculation

```typescript
// app/api/webhooks/stripe/route.ts
if (event.type === 'checkout.session.completed') {
  const affiliateCode = session.metadata?.affiliateCode;

  if (affiliateCode) {
    const code = await prisma.affiliateCode.update({
      where: { code: affiliateCode },
      data: {
        status: 'USED',
        usedAt: new Date(),
        usedByUserId: session.metadata.userId,
      },
    });

    const regularPrice = parseFloat(session.metadata.regularPrice);
    const discount = regularPrice * (code.discountPercent / 100);
    const netRevenue = regularPrice - discount;
    const commission = netRevenue * (code.commissionPercent / 100);

    await prisma.commission.create({
      data: {
        affiliateId: code.affiliateId,
        regularPrice,
        discountAmount: discount,
        netRevenue,
        commissionPercent: code.commissionPercent,
        commissionAmount: commission,
        status: 'PENDING',
      },
    });

    await sendEmail(code.affiliate.email, 'Commission Earned', {
      code: affiliateCode,
      amount: commission,
    });
  }
}
```

### 13.6 Centralized Configuration (SystemConfig)

**Schema:**

```prisma
model SystemConfig {
  id          String   @id @default(cuid())
  key         String   @unique
  value       String
  valueType   String   // "number", "boolean", "string"
  category    String   // "affiliate", "payment", "general"
  updatedAt   DateTime @updatedAt
}

model SystemConfigHistory {
  id         String   @id @default(cuid())
  configKey  String
  oldValue   String
  newValue   String
  changedBy  String
  changedAt  DateTime @default(now())
}
```

**Backend Pattern:**

```typescript
// ALWAYS fetch from SystemConfig
const configs = await prisma.systemConfig.findMany({
  where: {
    key: { in: ['affiliate_discount_percent', 'affiliate_commission_percent'] },
  },
});
const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));
const discountPercent = parseFloat(
  configMap.affiliate_discount_percent || '20.0'
);
```

**Frontend Hook:**

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export function PricingCard() {
  const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();
  return <p>With code: ${calculateDiscountedPrice(29)} (Save {discountPercent}%!)</p>;
}
```

**Endpoints:**

- `GET /api/config/affiliate` - Public (no auth)
- `PATCH /api/admin/settings/affiliate` - Admin only
- `GET /api/admin/settings/affiliate/history` - Admin only

### 13.7 Required Admin Reports

1. **P&L Report** - Monthly revenue, discounts, net, commissions, profit
2. **Sales Performance** - Affiliates ranked by conversion rate
3. **Commission Owings** - Pending commissions by payment method
4. **Code Inventory** - System-wide code status breakdown

### 13.8 Email Notifications (8 Types)

1. Affiliate registration (verification)
2. Welcome (after verification + codes)
3. Code usage (real-time)
4. Monthly distribution (1st of month)
5. Commission paid
6. Account suspended
7. Admin: New affiliate
8. Admin: Code request

### 13.9 Security Rules

- ✅ Affiliates view only their own codes/commissions
- ✅ Validate codes: exists, ACTIVE, not expired, not used
- ✅ Admin endpoints: `user.role === 'ADMIN'`
- ✅ Commissions only via Stripe webhook
- ✅ Code generation: `crypto.randomBytes(16).toString('hex')`
- ❌ Never allow affiliates to generate codes
- ❌ Never allow manual commission creation

---

## 14. PAYMENT GATEWAY ARCHITECTURE (DUAL PROVIDERS)

### 14.1 Single Subscription Model

**Schema:**

```prisma
model Subscription {
  id                     String   @id @default(cuid())
  userId                 String   @unique

  // Provider
  paymentProvider        String   // "STRIPE" or "DLOCAL"

  // Stripe (nullable for dLocal)
  stripeCustomerId       String?  @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?

  // dLocal (nullable for Stripe)
  dLocalPaymentId        String?  @unique
  dLocalCountry          String?
  dLocalCurrency         String?
  dLocalAmount           Float?

  // Shared
  planType               String   // "MONTHLY" or "THREE_DAY"
  amountUsd              Float
  status                 String   // "active", "canceled", "expired"
  expiresAt              DateTime
}
```

**Unified Access:**

```typescript
export async function getSubscriptionStatus(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return { tier: 'FREE', status: 'none' };

  if (sub.paymentProvider === 'STRIPE') {
    const stripeSub = await stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId
    );
    return {
      tier: stripeSub.status === 'active' ? 'PRO' : 'FREE',
      provider: 'STRIPE',
    };
  } else {
    return {
      tier: new Date() < sub.expiresAt ? 'PRO' : 'FREE',
      provider: 'DLOCAL',
    };
  }
}
```

### 14.2 Provider Strategy Pattern

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
    return stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_IDS[plan], quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
    });
  }
}

class DLocalProvider implements PaymentProvider {
  async createCheckoutSession(userId: string, plan: PlanType) {
    const { country, currency } = await getUserCountry(userId);
    const { amount, rate } = await convertUsdToLocal(PLANS[plan].usd, currency);
    return dlocal.createPayment({ amount, currency, country });
  }
}

export function getPaymentProvider(
  provider: 'STRIPE' | 'DLOCAL'
): PaymentProvider {
  return provider === 'STRIPE' ? new StripeProvider() : new DLocalProvider();
}
```

### 14.3 Early Renewal (dLocal Only)

```typescript
// app/api/payments/dlocal/renew/route.ts
export async function POST(req: NextRequest) {
  const sub = await prisma.subscription.findUnique({ where: { userId: session.user.id }});

  if (sub.paymentProvider !== 'DLOCAL') {
    return NextResponse.json({ error: 'Stripe auto-renews' }, { status: 400 });
  }

  if (sub.planType === 'THREE_DAY') {
    return NextResponse.json({ error: '3-day cannot renew' }, { status: 400 });
  }

  const remainingDays = Math.max(0, Math.ceil((sub.expiresAt - new Date()) / (1000*60*60*24)));
  const newExpiresAt = new Date(sub.expiresAt);
  newExpiresAt.setDate(newExpiresAt.getDate() + 30);

  const payment = await dlocal.createPayment({...});

  if (payment.status === 'completed') {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { expiresAt: newExpiresAt }
    });
    return NextResponse.json({ message: `${remainingDays} + 30 days stacked` });
  }
}
```

### 14.4 Currency Conversion (dLocal Only)

```typescript
// lib/payments/currency-converter.ts
export async function convertUsdToLocal(
  amountUsd: number,
  targetCurrency: string
) {
  const rate = await fetchExchangeRate('USD', targetCurrency);
  const localAmount = Math.round(amountUsd * rate * 100) / 100;
  return { amount: localAmount, rate };
}

// Usage
const { amount, rate } = await convertUsdToLocal(29.0, 'INR');
await prisma.payment.create({
  data: {
    provider: 'DLOCAL',
    amount, // Local (e.g., 2407.00 INR)
    currency: 'INR',
    amountUsd: 29.0, // USD equivalent
    exchangeRate: rate,
  },
});
```

### 14.5 3-Day Plan Anti-Abuse

```typescript
// app/api/payments/dlocal/checkout/route.ts
if (planType === 'THREE_DAY') {
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (user.hasUsedThreeDayPlan) {
    await prisma.fraudAlert.create({
      data: {
        alertType: '3DAY_PLAN_REUSE',
        severity: 'MEDIUM',
        description: 'User attempted 3-day plan more than once',
      },
    });
    return NextResponse.json(
      { error: '3-day plan can only be purchased once' },
      { status: 403 }
    );
  }

  // After payment success:
  await prisma.user.update({
    where: { id: user.id },
    data: { hasUsedThreeDayPlan: true, threeDayPlanUsedAt: new Date() },
  });
}
```

### 14.6 Fraud Detection

```typescript
// lib/payments/fraud-detector.ts
export async function detectFraud(userId: string, context: FraudContext) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { payments: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });

  // Pattern 1: Multiple failed payments (≥3 in 1 hour)
  const recentFailed = user.payments.filter(
    (p) => p.status === 'failed' && p.createdAt > new Date(Date.now() - 3600000)
  );
  if (recentFailed.length >= 3) {
    return createFraudAlert(userId, {
      alertType: 'MULTIPLE_FAILED_PAYMENTS',
      severity: 'HIGH',
    });
  }

  // Pattern 2: IP + device mismatch
  if (
    user.lastLoginIP !== context.ipAddress &&
    user.deviceFingerprint !== context.deviceFingerprint
  ) {
    return createFraudAlert(userId, {
      alertType: 'SUSPICIOUS_IP_CHANGE',
      severity: 'MEDIUM',
    });
  }

  return null;
}
```

### 14.7 Provider Selection by Country

```typescript
// lib/payments/provider-selector.ts
export const DLOCAL_COUNTRIES = [
  'IN',
  'NG',
  'PK',
  'VN',
  'ID',
  'TH',
  'ZA',
  'TR',
];

export const COUNTRY_CURRENCIES: Record<string, string> = {
  IN: 'INR',
  NG: 'NGN',
  PK: 'PKR',
  VN: 'VND',
  ID: 'IDR',
  TH: 'THB',
  ZA: 'ZAR',
  TR: 'TRY',
};

export function getAvailableProviders(countryCode: string): PaymentProvider[] {
  return DLOCAL_COUNTRIES.includes(countryCode)
    ? ['STRIPE', 'DLOCAL']
    : ['STRIPE'];
}

export function getCurrency(countryCode: string): string {
  return COUNTRY_CURRENCIES[countryCode] || 'USD';
}
```

### 14.8 Subscription Expiry (dLocal)

```typescript
// app/api/cron/check-expirations/route.ts (Daily at midnight UTC)
export async function GET(req: NextRequest) {
  const now = new Date();
  const expiringSubscriptions = await prisma.subscription.findMany({
    where: {
      paymentProvider: 'DLOCAL',
      status: 'active',
      OR: [
        { expiresAt: { lt: now }},
        { expiresAt: { lt: addDays(now, 3) }, renewalReminderSent: false }
      ]
    },
    include: { user: true }
  });

  for (const sub of expiringSubscriptions) {
    const daysUntilExpiry = Math.ceil((sub.expiresAt - now) / (1000*60*60*24));

    if (daysUntilExpiry <= 0) {
      // Expired
      await prisma.$transaction([
        prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' }}),
        prisma.user.update({ where: { id: sub.userId }, data: { tier: 'FREE' }})
      ]);
      await sendEmail(sub.user.email, 'Subscription Expired', {...});
    } else if (daysUntilExpiry <= 3 && !sub.renewalReminderSent) {
      // Expiring soon
      await prisma.subscription.update({ where: { id: sub.id }, data: { renewalReminderSent: true }});
      await sendEmail(sub.user.email, 'Expiring Soon', {...});
    }
  }

  return NextResponse.json({ checked: expiringSubscriptions.length });
}
```

**Vercel Cron:**

```json
{
  "crons": [{ "path": "/api/cron/check-expirations", "schedule": "0 0 * * *" }]
}
```

### 14.9 Stripe Trial (No Card Required)

**User Schema:**

```prisma
model User {
  hasUsedStripeTrial  Boolean  @default(false)
  stripeTrialStartedAt DateTime?
  signupIP            String?
  lastLoginIP         String?
  deviceFingerprint   String?
}
```

**Fraud Detection Patterns:**

1. IP abuse: ≥3 trials from same IP in 30 days (HIGH)
2. Device abuse: ≥2 trials from same device in 30 days (HIGH)
3. Disposable email: Known temp domains (MEDIUM)
4. Rapid signup: ≥5 accounts from IP in 1 hour (HIGH)

**Registration with Fraud Check:**

```typescript
// app/api/auth/register/route.ts
export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();
  const signupIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim();
  const deviceFingerprint = req.headers.get('x-device-fingerprint');

  // Check fraud
  const fraudCheck = await detectTrialAbuse({
    email,
    signupIP,
    deviceFingerprint,
  });

  if (fraudCheck) {
    await prisma.fraudAlert.create({
      data: {
        alertType: fraudCheck.type,
        severity: fraudCheck.severity,
        ipAddress: signupIP,
        deviceFingerprint,
      },
    });

    // Block HIGH severity
    if (fraudCheck.severity === 'HIGH') {
      return NextResponse.json(
        { error: 'Registration blocked' },
        { status: 403 }
      );
    }
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, 10),
      name,
      tier: 'FREE',
      signupIP,
      deviceFingerprint,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
```

**Fraud Detector:**

```typescript
// lib/fraud-detection.ts
const DISPOSABLE_DOMAINS = [
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
];

export async function detectTrialAbuse(context: FraudCheckContext) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // IP abuse
  if (context.signupIP) {
    const ipTrials = await prisma.user.count({
      where: {
        signupIP: context.signupIP,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });
    if (ipTrials >= 3)
      return { type: 'STRIPE_TRIAL_IP_ABUSE', severity: 'HIGH' };
  }

  // Device abuse
  if (context.deviceFingerprint) {
    const deviceTrials = await prisma.user.count({
      where: {
        deviceFingerprint: context.deviceFingerprint,
        hasUsedStripeTrial: true,
        stripeTrialStartedAt: { gte: thirtyDaysAgo },
      },
    });
    if (deviceTrials >= 2)
      return { type: 'STRIPE_TRIAL_DEVICE_ABUSE', severity: 'HIGH' };
  }

  // Disposable email
  const domain = context.email.split('@')[1];
  if (DISPOSABLE_DOMAINS.includes(domain))
    return { type: 'DISPOSABLE_EMAIL', severity: 'MEDIUM' };

  return null;
}
```

**Trial Start (No Card):**

```typescript
// app/api/payments/stripe/start-trial/route.ts
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (session.user.hasUsedStripeTrial) {
    return NextResponse.json({ error: 'Trial already used' }, { status: 403 });
  }

  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7);

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
        amountUsd: 0,
      },
    }),
  ]);

  return NextResponse.json({
    message: 'Trial started',
    trialEndsAt: trialEndDate,
  });
}
```

**Trial Expiry Cron (Every 6 hours):**

```typescript
// app/api/cron/stripe-trial-expiry/route.ts
export async function GET(req: NextRequest) {
  const now = new Date();
  const expiredTrials = await prisma.subscription.findMany({
    where: { paymentProvider: 'STRIPE', status: 'trialing', expiresAt: { lt: now }},
    include: { user: true }
  });

  for (const sub of expiredTrials) {
    const paidSub = await prisma.subscription.findFirst({
      where: { userId: sub.userId, paymentProvider: 'STRIPE', status: 'active', stripeSubscriptionId: { not: null }}
    });

    if (paidSub) {
      await prisma.subscription.delete({ where: { id: sub.id }});
    } else {
      await prisma.$transaction([
        prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' }}),
        prisma.user.update({ where: { id: sub.userId }, data: { tier: 'FREE' }})
      ]);
      await sendEmail(sub.user.email, 'Trial Expired', {...});
    }
  }

  return NextResponse.json({ checked: expiredTrials.length });
}
```

**Client-Side Fingerprinting:**

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
  ];
  return crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(components.join('|')))
    .then((hash) =>
      Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
}
```

### 14.10 Admin Fraud Management

**Available Actions:**

1. **DISMISS** - False positive
2. **SEND_WARNING** - Email warning
3. **BLOCK_ACCOUNT** - Disable account + downgrade to FREE
4. **UNBLOCK_ACCOUNT** - Restore access
5. **WHITELIST_USER** - Mark trusted (bypass future checks)

**Enforcement Endpoint:**

```typescript
// app/api/admin/fraud-alerts/[id]/actions/route.ts
export async function POST(req: NextRequest, { params }) {
  const session = await getServerSession();
  if (session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { action, notes, blockDuration } = await req.json();
  const alert = await prisma.fraudAlert.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  switch (action) {
    case 'BLOCK_ACCOUNT':
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
            resolution: blockDuration,
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            notes,
          },
        }),
      ]);
      await sendEmail(alert.user.email, 'Account Suspended', { reason: notes });
      return NextResponse.json({ success: true });

    case 'SEND_WARNING':
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
        description: alert.description,
        action: notes,
      });
      return NextResponse.json({ success: true });

    // ... other actions
  }
}
```

**Impact Table:**

| Action          | User Impact               | DB Changes                                 | Email |
| --------------- | ------------------------- | ------------------------------------------ | ----- |
| DISMISS         | None                      | FraudAlert.resolution = 'FALSE_POSITIVE'   | No    |
| SEND_WARNING    | Warning email             | FraudAlert.resolution = 'WARNING_SENT'     | Yes   |
| BLOCK_ACCOUNT   | Login disabled, tier=FREE | User.isActive=false, Sub.status='canceled' | Yes   |
| UNBLOCK_ACCOUNT | Access restored           | User.isActive=true                         | Yes   |
| WHITELIST_USER  | Future checks bypassed    | FraudAlert.resolution='WHITELISTED'        | No    |

---

## SUMMARY

### DO:

- Follow v5-structure-division.md for file placement
- Use OpenAPI specs for all types
- Validate auth + tier on all protected endpoints
- Use Prisma for database operations
- Server Components by default, Client Components when needed
- Keep business logic in lib/
- Validate tiers on BOTH Next.js AND Flask
- Use pre-approved dependencies
- Separate JWT auth for affiliates (AFFILIATE_JWT_SECRET)
- Validate affiliate codes: ACTIVE, not expired, not used
- Commissions via Stripe webhook only
- Codes: crypto.randomBytes (cryptographically secure)
- **Payments:** Single Subscription model with paymentProvider field
- **dLocal:** Store local currency + USD equivalent, real-time conversion
- **dLocal:** 3-day plan one-time use (hasUsedThreeDayPlan)
- **dLocal:** Daily expiry check (midnight UTC cron)
- **dLocal:** Early renewal with day stacking (monthly only)
- **Stripe:** Auto-renewal (no manual expiry checks)
- **Stripe Trial:** NO card required (40-60% conversion)
- **Stripe Trial:** Multi-signal fraud (IP, device, email, velocity)
- **Stripe Trial:** Check expiry every 6 hours
- **Stripe Trial:** Capture signupIP + deviceFingerprint at registration
- **Stripe Trial:** Block HIGH severity, flag MEDIUM for review
- **Admin:** Verify admin role before enforcement
- **Admin:** Block = downgrade to FREE + cancel subs + send email
- **Admin:** Require notes for audit trail

### DON'T:

- Manually define OpenAPI types
- Skip tier validation
- Use raw SQL
- Import components in lib/
- Call database from frontend
- Add dependencies without approval
- Unnecessary 'use client'
- Reuse user auth for affiliates
- Allow self-generated codes
- Manual commission creation
- Predictable code formats
- **Payments:** Separate Stripe/dLocal models
- **dLocal:** Show for unsupported countries
- **dLocal:** Hardcoded exchange rates
- **dLocal:** Multiple 3-day purchases
- **dLocal:** Skip fraud alerts
- **Stripe:** Manual renewal
- **Stripe:** Manual expiry checks (webhooks handle)
- **Stripe Trial:** Require card (kills conversion)
- **Stripe Trial:** Allow duplicate trials
- **Stripe Trial:** Skip fraud detection
- **Admin:** Non-admin enforcement
- **Admin:** Block without email
- **Admin:** Skip audit notes

Consistent architecture ensures maintainability and security across all 289 files.
