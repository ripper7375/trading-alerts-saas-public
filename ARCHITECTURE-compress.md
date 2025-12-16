# Trading Alerts SaaS - Architecture (Compressed)

## 1. Overview

Trading Alerts SaaS is a web app for traders to monitor financial markets and set automated alerts based on fractal support/resistance levels. Integrates with MetaTrader 5 (MT5) and provides tiered subscriptions (FREE/PRO).

**Key Features:**
- Real-time MT5 market data visualization
- Fractal-based support/resistance detection
- Automated alert system
- Watchlist management
- Tiered access control (FREE: 5 symbols × 3 TFs, PRO: 15 symbols × 9 TFs)
- Stripe + dLocal payment integration
- Affiliate marketing program (20% commission)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, NextAuth.js v4.24.5, Prisma 5, Zod |
| MT5 Service | Flask 3.x, Python 3.11, MetaTrader5 package |
| Database | PostgreSQL 15 (Railway) |
| Payments | Stripe (global), dLocal (8 emerging markets) |
| Deployment | Vercel (Next.js), Railway (PostgreSQL), Windows VPS (Flask + MT5) |

> **Note:** The Flask MT5 service runs on Windows VPS (not Railway) because the MetaTrader5 Python package requires Windows and direct access to MT5 terminal executables.

---

## 3. Architecture Diagram

```
Users (Browser) → Vercel (Next.js 15)
                    ├→ PostgreSQL (Railway)
                    └→ Windows VPS
                         ├→ Flask MT5 Service (Python + Gunicorn)
                         └→ 15 MT5 Terminals (co-located)
```

**External Services:** Stripe, dLocal, Resend (email)

> **Why Windows VPS?** MetaTrader5 Python package only runs on Windows. Flask and MT5 terminals must be on the same machine.

---

## 4. Database Schema (Key Models)

```
User          → alerts[], watchlists[], subscription
Alert         → userId, symbol, timeframe, condition, isActive
WatchlistItem → userId, symbol, timeframe
Subscription  → userId, paymentProvider (STRIPE|DLOCAL), expiresAt
Affiliate     → affiliateCodes[], commissions[]
Commission    → affiliateId, amount, status (PENDING|APPROVED|PAID)
Payment       → userId, provider, amount, currency, status
```

---

## 5. Tier System

| Feature | FREE | PRO |
|---------|------|-----|
| Symbols | 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) | 15 (all) |
| Timeframes | 3 (H1, H4, D1) | 9 (M5-D1) |
| Chart Combinations | 15 | 135 |
| Max Alerts | 5 | 20 |
| Max Watchlist | 5 | 50 |
| API Rate | 60 req/hr | 300 req/hr |

**Enforcement:** Backend validates on ALL tier-restricted endpoints; frontend disables UI (UX only).

---

## 6. Authentication

### User Auth (NextAuth.js)
- Providers: Google OAuth + Email/Password (Credentials)
- Sessions: JWT in httpOnly cookies (30 days)
- Security: Verified-only OAuth account linking prevents account takeover

### Affiliate Auth (Separate JWT)
- Custom JWT implementation with `AFFILIATE_JWT_SECRET`
- Status-based access: Must be APPROVED before login works
- Token stored in localStorage

---

## 7. API Structure

**Standard Pattern:**
```typescript
export async function GET(req: Request) {
  // 1. Authentication (getServerSession)
  // 2. Tier validation (validateChartAccess)
  // 3. Business logic
  // 4. Response (matching OpenAPI schema)
  // 5. Error handling
}
```

**Key Endpoints:**
- `/api/alerts` - Alert CRUD
- `/api/fractals/{symbol}/{timeframe}` - Fractal data from MT5
- `/api/watchlist` - Watchlist management
- `/api/payments/stripe/*` - Stripe checkout/webhooks
- `/api/payments/dlocal/*` - dLocal checkout/webhooks
- `/api/affiliate/*` - Affiliate portal
- `/api/admin/*` - Admin dashboard

---

## 8. Flask MT5 Service (Windows VPS)

**Deployment:** Windows VPS (NOT Railway Docker)

> **Critical:** The MetaTrader5 Python package requires Windows OS and local MT5 terminal installation. Cannot run in Linux containers.

**Architecture:** 15 MT5 terminals (1 per symbol, 9 timeframes each)

**Symbol Routing:**
- Connection pool routes requests to correct terminal by symbol
- Health monitoring with auto-reconnect

**Fractal Detection:**
- Horizontal Lines V5: Peak-to-Peak and Bottom-to-Bottom (3+ touches)
- Diagonal Lines V4: Mixed Peak-Bottom with alternating pattern (4+ touches)
- Uses 108-bar pattern for fractal detection

---

## 9. Payment System

### Stripe (International)
- Auto-renewal subscriptions
- 7-day free trial
- Monthly plan ($29 USD)

### dLocal (8 Emerging Markets)
- Manual renewal (no auto-renewal)
- 3-day plan + Monthly plan
- Countries: IN, NG, PK, VN, ID, TH, ZA, TR
- Local currency support

**Key Features:**
- Early renewal stacking (dLocal monthly)
- 3-day plan one-time use enforcement
- Fraud detection system

---

## 10. Affiliate System

**Flow:**
1. Affiliate registers → Admin approves
2. Affiliate generates referral code
3. User uses code → Subscribes via Stripe/dLocal
4. Commission calculated in webhook (20%)
5. Admin approves commission → Payout

**Security:**
- Crypto-secure code generation (`crypto.randomBytes`)
- Commission calculation ONLY in webhooks
- All payouts require admin approval

---

## 11. Data Flows

### Alert Creation
```
User → Frontend (form) → API (/api/alerts)
  → Auth check → Tier validation → Alert limit check
  → Prisma create → Return 201
```

### Chart Data
```
User → Frontend → API (/api/fractals)
  → Auth → Tier check → Flask MT5 Service
  → MT5 Terminal → Fractal calculation
  → Return data → Update chart
```

---

## 12. Security

- **Auth:** NextAuth.js + bcrypt password hashing
- **Input:** Zod validation on all inputs
- **Database:** Prisma prevents SQL injection
- **XSS:** React auto-escapes
- **Secrets:** Environment variables only
- **Tier:** Backend validation on ALL restricted endpoints
- **Fraud:** Multi-layer detection + admin review

---

## 13. Deployment

| Component | Platform | Method |
|-----------|----------|--------|
| Next.js | Vercel | Auto-deploy on push to main |
| PostgreSQL | Railway | Prisma migrations |
| Flask MT5 | Windows VPS | Gunicorn (same machine as MT5) |
| 15 MT5 Terminals | Windows VPS | Manual setup (co-located with Flask) |

> **Note:** Flask and MT5 terminals share the same Windows VPS because the MetaTrader5 Python package requires Windows and direct access to MT5 terminal processes.

---

## 14. Project Scale

- **18 Parts**, **289+ files**
- Core: 170 files
- Affiliate/Admin: 67 files
- dLocal Payment: 52 files

---

## 15. Development with Aider

**Workflow:**
1. Aider reads policies and build order
2. Generates code following patterns
3. Runs validation (TypeScript, ESLint, Prettier, Policy checks)
4. Auto-approves if passing, or escalates to human

**Validation Criteria:**
- 0 Critical issues → Auto-approve
- ≤2 High issues (auto-fixable) → Auto-fix then approve
- Otherwise → Escalate

---

**Last Updated:** 2025-12-11
