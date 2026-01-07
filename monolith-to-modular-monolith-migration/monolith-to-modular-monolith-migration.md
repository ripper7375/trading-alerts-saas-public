# Migration from Monolith to Modular Monolith Architecture

## Document Overview

**Project**: SaaS Application Architecture Migration  
**Migration Type**: Monolith → Modular Monolith  
**Target**: Separate Frontend (Vercel) and Backend (Railway)  
**Technology Stack**: TypeScript, Next.js, Nest.js, PostgreSQL, TimescaleDB, Redis  
**Database**: Timescale Cloud (PostgreSQL + TimescaleDB)  
**Cache**: Upstash (Redis)  
**Timeline**: 8 Phases  
**Document Version**: 2.0  
**Last Updated**: January 2026

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture (Monolith)](#current-architecture-monolith)
3. [Target Architecture (Modular Monolith)](#target-architecture-modular-monolith)
4. [Migration Benefits](#migration-benefits)
5. [Migration Steps](#migration-steps)
   - [Step 1: Baseline Assessment](#step-1-baseline-assessment)
   - [Step 2: Extract Frontend](#step-2-extract-frontend)
   - [Step 3: Extract Backend](#step-3-extract-backend)
   - [Step 4: Frontend Optimization](#step-4-frontend-optimization)
   - [Step 5: Backend Upgrade to Nest.js](#step-5-backend-upgrade-to-nestjs)
   - [Step 6: Connect Frontend and Backend](#step-6-connect-frontend-and-backend)
   - [Step 7: Local Development E2E Testing](#step-7-local-development-e2e-testing)
   - [Step 8: Staging/Production E2E Testing](#step-8-stagingproduction-e2e-testing)
6. [Technical Specifications](#technical-specifications)
7. [Deployment Guide](#deployment-guide)
8. [Testing Strategy](#testing-strategy)
9. [Rollback Procedures](#rollback-procedures)
10. [Success Criteria](#success-criteria)

---

## Executive Summary

This document outlines the migration strategy from a **Monolithic Architecture** to a **Modular Monolith Architecture** for our SaaS application. The migration will separate frontend and backend concerns while maintaining the benefits of a single deployable backend application.

### Key Changes

- **Frontend**: Next.js application deployed on Vercel (UI components, pages, client-side logic only)
- **Backend**: Nest.js application deployed on Railway (API logic, database access, business rules)
- **Database**: Timescale Cloud - PostgreSQL + TimescaleDB (time-series data with hypertables)
- **Cache**: Upstash Redis (caching layer for improved performance)
- **Data Collection**: Contabo VPS (unchanged - MT5 terminals + sync script)

### Expected Outcomes

- ✅ Reduced JavaScript bundle size (faster Time to Interactive)
- ✅ Independent frontend and backend deployment
- ✅ Better code organization with modular structure
- ✅ Improved scalability and maintainability
- ✅ Enhanced developer experience
- ✅ Time-series data optimization with TimescaleDB hypertables
- ✅ Faster API responses with Redis caching
- ✅ Cost-effective architecture (~$90-130/month)

---

## Current Architecture (Monolith)

### Deployment Overview

```
┌─────────────────────────────────────┐
│  Vercel (Next.js Monolith)          │
│  - Frontend (UI, Pages, Components) │
│  - Backend (API Routes)             │
│  - Client-side Logic                │
│  - Server-side Logic                │
│  Cost: ~$0-20/month                 │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│  Railway (PostgreSQL)               │
│  - Application Database             │
│  Cost: ~$5-20/month                 │
└────────────┬────────────────────────┘
             ↑
             │ (Sync every 30-60 sec)
             │
┌─────────────────────────────────────┐
│  Contabo VPS (Windows)              │
│  - MT5 Terminals (×15)              │
│  - SQLite (Local)                   │
│  - Sync Script (Python/Node.js)     │
│  Cost: ~$30-50/month                │
└─────────────────────────────────────┘

Total Current Cost: ~$35-90/month
```

### Current Limitations

1. **Large JavaScript Bundle**: All code (frontend + backend dependencies) bundled together
2. **Tight Coupling**: Frontend and backend logic intertwined
3. **Limited Scalability**: Cannot scale frontend and backend independently
4. **Deployment Complexity**: Single deployment affects both UI and API
5. **Slower TTI (Time to Interactive)**: Heavy bundle impacts page load performance

---

## Target Architecture (Modular Monolith)

### Deployment Overview

```
┌─────────────────────────────────────┐
│  Vercel (Next.js - Frontend Only)   │
│  ┌───────────────────────────────┐  │
│  │ Server Components             │  │
│  │ - Product pages               │  │
│  │ - Blog posts                  │  │
│  │ - Static content              │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Client Components             │  │
│  │ - Login button                │  │
│  │ - Search filters              │  │
│  │ - Interactive forms           │  │
│  └───────────────────────────────┘  │
│  Cost: ~$0-20/month                 │
└────────────┬────────────────────────┘
             │ HTTPS (CORS)
             ↓
┌─────────────────────────────────────┐
│  Railway (Nest.js - Backend)        │
│  ┌───────────────────────────────┐  │
│  │ Core Module                   │  │
│  │ - Auth (JWT, OAuth)           │  │
│  │ - User Profile                │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Billing Module                │  │
│  │ - Payment (Stripe)            │  │
│  │ - Subscription Management     │  │
│  │ - Discount Codes              │  │
│  │ - Affiliate Tracking          │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Analytics Module              │  │
│  │ - Background Jobs             │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Notification Module           │  │
│  │ - Email (SendGrid)            │  │
│  │ - Push (Firebase)             │  │
│  │ - Queue Workers               │  │
│  └───────────────────────────────┘  │
│                                     │
│  Built-in Features:                 │
│  ✅ NestJS Guards (Auth)            │
│  ✅ Interceptors (Rate Limiting)    │
│  ✅ Pipes (Validation)              │
│  ✅ Bull Queue (Background Jobs)    │
│  ✅ Winston Logger (Logging)        │
│                                     │
│  Dockerized as Single App           │
│  Cost: ~$15-25/month                │
└────────────┬────────────────────────┘
             │
        ┌────┴─────┐
        ↓          ↓
┌───────────────┐  ┌─────────────────────────────────┐
│ Upstash       │  │ Timescale Cloud                 │
│ (Redis Cache) │  │ (PostgreSQL + TimescaleDB)      │
│               │  │                                 │
│ - Session     │  │ ┌────────────────────────────┐ │
│ - API cache   │  │ │ Application Tables:        │ │
│ - Rate limit  │  │ │ - users                    │ │
│ - Bull Queue  │  │ │ - payments                 │ │
│               │  │ │ - subscriptions            │ │
│ Cost:         │  │ │ - discounts                │ │
│ ~$5-10/month  │  │ │ - affiliates               │ │
└───────────────┘  │ │ - notifications            │ │
                   │ └────────────────────────────┘ │
                   │ ┌────────────────────────────┐ │
                   │ │ TimescaleDB Hypertables:   │ │
                   │ │ - market_data (time-series)│ │
                   │ │ - indicator_fractals       │ │
                   │ │ - indicator_lines          │ │
                   │ │ - indicator_pro            │ │
                   │ │ - user_activity_logs       │ │
                   │ └────────────────────────────┘ │
                   │ Cost: ~$25-50/month            │
                   └────────────┬───────────────────┘
                                ↑
                                │ (Sync every 30-60 sec)
                                │
┌─────────────────────────────────────┐
│  Contabo VPS (Windows)              │
│  - MT5 Terminals (×15)              │
│  - SQLite (Local)                   │
│  - Sync Script (UNCHANGED)          │
│  Cost: ~$30-50/month                │
└─────────────────────────────────────┘

Total Target Cost: ~$75-155/month
```

### Key Improvements

1. **Reduced JavaScript Bundle**: Frontend only includes UI code
2. **Clear Separation**: Frontend (UI) and Backend (API) are independent
3. **Independent Scaling**: Scale frontend and backend separately if needed
4. **Modular Backend**: Organized into logical modules (Core, Billing, Analytics, Notifications)
5. **Faster TTI**: Lightweight frontend loads quickly
6. **Better Developer Experience**: Clear boundaries, easier to maintain
7. **Time-Series Optimization**: TimescaleDB hypertables for efficient market data queries
8. **Improved Performance**: Redis caching reduces database load and API response times

---

## Migration Benefits

### Performance Benefits

| Metric                  | Before (Monolith)      | After (Modular Monolith)  | Improvement  |
| ----------------------- | ---------------------- | ------------------------- | ------------ |
| **JS Bundle Size**      | ~150KB                 | ~20KB                     | -87%         |
| **Time to Interactive** | 3-5 seconds            | <1 second                 | -80%         |
| **Initial Page Load**   | Blank/Loading          | Instant HTML              | Immediate    |
| **API Response Time**   | Same server            | Optimized backend         | Faster       |
| **Database Queries**    | Direct PostgreSQL      | TimescaleDB + Redis cache | 5-10× faster |
| **Time-Series Queries** | Slow (full table scan) | Optimized (hypertables)   | 100× faster  |

### Development Benefits

- ✅ **Clear Separation of Concerns**: Frontend team works on UI, backend team works on API
- ✅ **Independent Deployments**: Deploy frontend without touching backend (and vice versa)
- ✅ **Better Testing**: Unit tests, integration tests, E2E tests more organized
- ✅ **Type Safety**: Shared TypeScript types between frontend and backend
- ✅ **Module Isolation**: Changes in one module don't affect others

### Operational Benefits

- ✅ **Easier Debugging**: Separate logs for frontend and backend
- ✅ **Better Monitoring**: Track frontend and backend metrics independently
- ✅ **Gradual Migration**: Can migrate step-by-step without breaking production
- ✅ **Cost Effective**: Similar cost to current architecture
- ✅ **Future-Proof**: Easy to extract microservices later if needed

---

## Migration Steps

### Database Architecture Overview

Before diving into migration steps, it's important to understand the database architecture changes:

#### **Timescale Cloud (PostgreSQL + TimescaleDB)**

TimescaleDB is a PostgreSQL extension optimized for time-series data. It uses **hypertables** to automatically partition time-series data by time, dramatically improving query performance.

**Why TimescaleDB for Trading Data?**

- ✅ Market data is time-series by nature (OHLCV data with timestamps)
- ✅ Hypertables provide automatic partitioning and chunk management
- ✅ 10-100× faster queries for time-range operations
- ✅ Efficient data compression (reduces storage costs)
- ✅ Continuous aggregates for pre-computed analytics
- ✅ Data retention policies (automatic old data deletion)

**What are Hypertables?**
A hypertable is an abstraction layer that looks like a normal PostgreSQL table but is actually composed of many smaller "chunks" partitioned by time.

```sql
-- Regular table (slow for time-series)
SELECT * FROM market_data WHERE timestamp BETWEEN '2024-01-01' AND '2024-01-31';
-- Scans entire table

-- Hypertable (fast for time-series)
SELECT * FROM market_data WHERE timestamp BETWEEN '2024-01-01' AND '2024-01-31';
-- Only scans relevant time chunks
```

#### **Upstash (Redis Cache)**

Redis is an in-memory data store used for caching frequently accessed data.

**Why Redis Caching?**

- ✅ Sub-millisecond response times
- ✅ Reduces database load by 70-90%
- ✅ Improves API response times
- ✅ Handles session storage
- ✅ Powers rate limiting
- ✅ Manages Bull Queue for background jobs

**What to Cache?**

- User sessions (JWT tokens)
- API responses (frequently accessed data)
- Database query results (market data, analytics)
- Rate limit counters
- Background job queues

#### **Data Flow with Caching**

```
Client Request
      ↓
Backend API
      ↓
Check Redis Cache
      ↓
Cache Hit? → Return from Redis (fast!)
      ↓ No
Query TimescaleDB
      ↓
Store in Redis
      ↓
Return to Client
```

### Migration Phases Overview

```
Phase 1: Separation (Steps 1-3)
├─ Step 1: Baseline assessment
├─ Step 2: Extract frontend
└─ Step 3: Extract backend

Phase 2: Optimization (Steps 4-5)
├─ Step 4: Frontend optimization
└─ Step 5: Backend upgrade

Phase 3: Integration & Testing (Steps 6-8)
├─ Step 6: Connect frontend and backend
├─ Step 7: Local E2E testing
└─ Step 8: Production E2E testing
```

---

## Step 1: Baseline Assessment

### Objective

Document the current monolithic architecture and prepare for separation.

### Current State Analysis

**Location**: Vercel (Next.js monolith)  
**Technology Stack**:

- Next.js (TypeScript)
- React for UI
- Next.js API routes for backend
- PostgreSQL for database
- Deployment: Vercel (~$0-20/month) + Railway PostgreSQL (~$5-20/month)

### Tasks

1. **Document Current Architecture**

   ```bash
   # List all current routes
   ls -R pages/
   ls -R pages/api/

   # Document dependencies
   cat package.json

   # Review current file structure
   tree -L 3
   ```

2. **Identify Frontend vs Backend Code**
   - **Frontend**: All files in `pages/` (except `pages/api/`)
   - **Backend**: All files in `pages/api/`
   - **Shared**: Types, utilities, constants

3. **Create Dependency Map**

   ```typescript
   // Document which frontend components call which API routes
   // Example:
   // LoginPage -> /api/auth/login
   // DashboardPage -> /api/users/me, /api/analytics/stats
   // PaymentPage -> /api/payments/create, /api/subscriptions/current
   ```

4. **Backup Current State**
   ```bash
   git tag v1.0-monolith
   git push origin v1.0-monolith
   ```

### Deliverables

- ✅ Architecture documentation
- ✅ Dependency map
- ✅ Git tag for rollback
- ✅ List of all API endpoints
- ✅ List of all frontend routes

### Success Criteria

- [ ] All current functionality documented
- [ ] Clear understanding of frontend/backend boundaries
- [ ] Backup created for safe rollback

---

## Step 2: Extract Frontend

### Objective

Create a separate Next.js frontend application containing only UI components, pages, and client-side logic.

### Architecture Change

```
BEFORE:
monolith/
├── pages/
│   ├── index.tsx          (Frontend)
│   ├── dashboard.tsx      (Frontend)
│   ├── login.tsx          (Frontend)
│   └── api/               (Backend)
│       ├── auth/
│       ├── users/
│       └── payments/
└── package.json

AFTER:
frontend/                   ← NEW
├── pages/
│   ├── index.tsx
│   ├── dashboard.tsx
│   └── login.tsx
├── components/
├── lib/
└── package.json

monolith/                   (Still contains API routes)
└── pages/api/
```

### Tasks

1. **Create Frontend Directory**

   ```bash
   mkdir frontend
   cd frontend
   npx create-next-app@latest . --typescript --tailwind --app
   ```

2. **Copy Frontend Files**

   ```bash
   # Copy pages (except api/)
   cp -r ../monolith/pages/* ./pages/
   rm -rf ./pages/api

   # Copy components
   cp -r ../monolith/components ./

   # Copy styles
   cp -r ../monolith/styles ./

   # Copy public assets
   cp -r ../monolith/public ./
   ```

3. **Update Package Dependencies**

   ```json
   // frontend/package.json
   {
     "dependencies": {
       "next": "14.x",
       "react": "18.x",
       "react-dom": "18.x",
       "typescript": "5.x"
       // Only frontend dependencies
       // Remove backend dependencies (express, database drivers, etc.)
     }
   }
   ```

4. **Configure Environment Variables**

   ```bash
   # frontend/.env.local
   NEXT_PUBLIC_API_URL=http://localhost:5000  # For local dev
   # NEXT_PUBLIC_API_URL=https://api.yourdomain.com  # For production
   ```

5. **Update API Calls**

   ```typescript
   // frontend/lib/api.ts
   const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

   export async function apiCall(endpoint: string, options = {}) {
     const response = await fetch(`${API_URL}${endpoint}`, {
       ...options,
       headers: {
         'Content-Type': 'application/json',
         ...options.headers,
       },
     });

     if (!response.ok) {
       throw new Error(`API Error: ${response.status}`);
     }

     return response.json();
   }
   ```

6. **Test Frontend Locally**
   ```bash
   cd frontend
   npm install
   npm run dev
   # Should run on http://localhost:3000
   ```

### Deliverables

- ✅ Separate `frontend/` directory
- ✅ Next.js application with UI code only
- ✅ Environment variables configured
- ✅ API client library created
- ✅ Frontend runs independently on localhost:3000

### Success Criteria

- [ ] Frontend starts successfully
- [ ] All pages render (may show errors due to missing API)
- [ ] No backend dependencies in package.json
- [ ] Environment variables properly configured

---

## Step 3: Extract Backend

### Objective

Create a separate Next.js backend application containing only API routes, database logic, and business rules.

### Architecture Change

```
BEFORE:
monolith/
└── pages/api/
    ├── auth/
    ├── users/
    └── payments/

AFTER:
backend/                    ← NEW
└── pages/api/
    ├── auth/
    ├── users/
    └── payments/

frontend/                   (From Step 2)
└── pages/
```

### Tasks

1. **Create Backend Directory**

   ```bash
   mkdir backend
   cd backend
   npx create-next-app@latest . --typescript
   ```

2. **Copy Backend Files**

   ```bash
   # Copy only API routes
   mkdir -p pages
   cp -r ../monolith/pages/api ./pages/

   # Copy backend utilities
   cp -r ../monolith/lib/db ./lib/
   cp -r ../monolith/lib/auth ./lib/
   cp -r ../monolith/lib/email ./lib/

   # Copy prisma schema (if using Prisma)
   cp -r ../monolith/prisma ./
   ```

3. **Update Package Dependencies**

   ```json
   // backend/package.json
   {
     "dependencies": {
       "next": "14.x",
       "typescript": "5.x",
       // Backend-only dependencies
       "@prisma/client": "^5.x",
       "bcrypt": "^5.x",
       "jsonwebtoken": "^9.x",
       "stripe": "^14.x",
       "nodemailer": "^6.x"
     }
   }
   ```

4. **Configure Environment Variables**

   ```bash
   # backend/.env
   # Timescale Cloud (PostgreSQL + TimescaleDB)
   DATABASE_URL=postgresql://user:password@xxxxx.timescaledb.cloud:5432/dbname?sslmode=require

   # Upstash Redis
   REDIS_URL=redis://:password@xxxxx.upstash.io:6379

   # Authentication
   JWT_SECRET=your-secret-key

   # External Services
   STRIPE_SECRET_KEY=sk_test_...
   SENDGRID_API_KEY=SG...

   # Server
   PORT=5000
   ```

5. **Update Next.js Config**

   ```typescript
   // backend/next.config.js
   module.exports = {
     async headers() {
       return [
         {
           source: '/api/:path*',
           headers: [
             { key: 'Access-Control-Allow-Credentials', value: 'true' },
             {
               key: 'Access-Control-Allow-Origin',
               value: 'http://localhost:3000',
             },
             {
               key: 'Access-Control-Allow-Methods',
               value: 'GET,DELETE,PATCH,POST,PUT',
             },
             {
               key: 'Access-Control-Allow-Headers',
               value: 'Content-Type, Authorization',
             },
           ],
         },
       ];
     },
   };
   ```

6. **Test Backend Locally**

   ```bash
   cd backend
   npm install
   npm run dev -- -p 5000
   # Should run on http://localhost:5000
   ```

7. **Test API Endpoints**

   ```bash
   # Test health check
   curl http://localhost:5000/api/health

   # Test authentication
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}'
   ```

### Deliverables

- ✅ Separate `backend/` directory
- ✅ Next.js application with API routes only
- ✅ CORS configured for localhost:3000
- ✅ Environment variables configured
- ✅ Backend runs independently on localhost:5000

### Success Criteria

- [ ] Backend starts successfully on port 5000
- [ ] API endpoints respond correctly
- [ ] CORS headers included in responses
- [ ] Database connection works
- [ ] No frontend dependencies in package.json

---

## Step 4: Frontend Optimization

### Objective

Separate interactive elements from readable elements to reduce JavaScript bundle size and improve Time to Interactive (TTI).

### Concept: Server Components vs Client Components

**Server Components** (Default in Next.js 13+):

- Render on server
- Send as HTML to browser
- No JavaScript needed
- Fast initial load
- Use for: Text content, images, layouts, static data

**Client Components** (Use `"use client"` directive):

- Render on client
- Require JavaScript
- Interactive features
- Use for: Buttons, forms, filters, animations

### Architecture Change

```
BEFORE (Step 2):
pages/
├── dashboard.tsx          (All client-side, large bundle)

AFTER (Step 4):
pages/
├── dashboard.tsx          (Server Component - readable content)
└── components/
    └── AddToCartButton.tsx  ("use client" - interactive only)
```

### Tasks

1. **Identify Interactive vs Readable Elements**

   **Readable Elements** (Keep as Server Components):
   - Product descriptions
   - Blog posts
   - User profiles (view-only)
   - Data tables (read-only)
   - Static headers/footers
   - Images with captions

   **Interactive Elements** (Convert to Client Components):
   - Login/signup forms
   - Add to cart buttons
   - Search filters
   - Dropdown menus
   - Modals/dialogs
   - Animations
   - State management (useState, useEffect)

2. **Create Client Components**

   ```typescript
   // frontend/components/AddToCartButton.tsx
   "use client"  // ← Mark as Client Component

   import { useState } from 'react'

   export default function AddToCartButton({ productId }: { productId: string }) {
     const [quantity, setQuantity] = useState(1)
     const [loading, setLoading] = useState(false)

     const handleAddToCart = async () => {
       setLoading(true)
       try {
         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart/add`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ productId, quantity })
         })
       } finally {
         setLoading(false)
       }
     }

     return (
       <div className="flex items-center gap-2">
         <input
           type="number"
           value={quantity}
           onChange={(e) => setQuantity(Number(e.target.value))}
           min="1"
         />
         <button
           onClick={handleAddToCart}
           disabled={loading}
         >
           {loading ? 'Adding...' : 'Add to Cart'}
         </button>
       </div>
     )
   }
   ```

3. **Update Pages to Use Server Components**

   ```typescript
   // frontend/app/product/[id]/page.tsx
   // No "use client" directive = Server Component by default

   import AddToCartButton from '@/components/AddToCartButton'

   async function getProduct(id: string) {
     // This runs on the server
     const res = await fetch(`${process.env.API_URL}/api/products/${id}`)
     return res.json()
   }

   export default async function ProductPage({ params }: { params: { id: string } }) {
     const product = await getProduct(params.id)

     return (
       <div>
         {/* All this renders on server, sent as HTML */}
         <h1>{product.name}</h1>
         <img src={product.image} alt={product.name} />
         <p>{product.description}</p>
         <div className="price">${product.price}</div>

         {/* Only this component is client-side */}
         <AddToCartButton productId={product.id} />
       </div>
     )
   }
   ```

4. **Create More Client Components**

   ```typescript
   // frontend/components/SearchFilter.tsx
   "use client"

   import { useState } from 'react'
   import { useRouter } from 'next/navigation'

   export default function SearchFilter() {
     const [query, setQuery] = useState('')
     const router = useRouter()

     const handleSearch = (e: React.FormEvent) => {
       e.preventDefault()
       router.push(`/search?q=${query}`)
     }

     return (
       <form onSubmit={handleSearch}>
         <input
           type="search"
           value={query}
           onChange={(e) => setQuery(e.target.value)}
           placeholder="Search products..."
         />
         <button type="submit">Search</button>
       </form>
     )
   }
   ```

   ```typescript
   // frontend/components/LoginForm.tsx
   "use client"

   import { useState } from 'react'
   import { useRouter } from 'next/navigation'

   export default function LoginForm() {
     const [email, setEmail] = useState('')
     const [password, setPassword] = useState('')
     const [error, setError] = useState('')
     const router = useRouter()

     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault()
       setError('')

       try {
         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ email, password })
         })

         if (!response.ok) {
           throw new Error('Invalid credentials')
         }

         const data = await response.json()
         localStorage.setItem('token', data.token)
         router.push('/dashboard')
       } catch (err) {
         setError(err.message)
       }
     }

     return (
       <form onSubmit={handleSubmit}>
         <input
           type="email"
           value={email}
           onChange={(e) => setEmail(e.target.value)}
           placeholder="Email"
           required
         />
         <input
           type="password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
           placeholder="Password"
           required
         />
         {error && <p className="error">{error}</p>}
         <button type="submit">Login</button>
       </form>
     )
   }
   ```

5. **Measure Bundle Size**

   ```bash
   # Before optimization
   npm run build
   # Check .next/static/chunks size

   # After optimization
   npm run build
   # Should see significant reduction in chunk sizes
   ```

### Expected Results

**Before Optimization**:

```
Page                              Size     First Load JS
┌ ○ /                            5.2 kB        150 kB
├ ○ /dashboard                   8.1 kB        155 kB
└ ○ /products/[id]              12.3 kB        165 kB
```

**After Optimization**:

```
Page                              Size     First Load JS
┌ ○ /                            1.1 kB         20 kB   ← 87% reduction
├ ○ /dashboard                   2.3 kB         25 kB   ← 84% reduction
└ ○ /products/[id]               1.8 kB         22 kB   ← 87% reduction
```

### Deliverables

- ✅ Client Components created for all interactive elements
- ✅ Server Components used for all readable content
- ✅ Reduced JavaScript bundle size
- ✅ Improved Time to Interactive

### Success Criteria

- [ ] JavaScript bundle reduced by at least 60%
- [ ] All interactive elements work correctly
- [ ] Server-rendered content displays immediately
- [ ] Client components hydrate quickly

---

## Step 5: Backend Upgrade to Nest.js

### Objective

Convert the Next.js backend to Nest.js with proper module structure, CORS enabled, and Docker containerization.

### Why Nest.js?

- ✅ **Modular Architecture**: Built-in support for modules
- ✅ **TypeScript-First**: Better type safety
- ✅ **Dependency Injection**: Cleaner code organization
- ✅ **Built-in Features**: Guards, Interceptors, Pipes, Validation
- ✅ **Better Testing**: Comprehensive testing utilities
- ✅ **Scalable**: Easy to maintain and extend

### Architecture Change

```
BEFORE (Step 3):
backend/pages/api/
├── auth/
│   ├── login.ts
│   └── register.ts
├── users/
│   └── me.ts
└── payments/
    └── create.ts

AFTER (Step 5):
backend/src/
├── main.ts                 (Entry point with CORS)
├── app.module.ts           (Root module)
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   └── guards/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── users.controller.ts
│   ├── billing/
│   │   ├── billing.module.ts
│   │   ├── payments/
│   │   ├── subscriptions/
│   │   └── discounts/
│   ├── analytics/
│   └── notifications/
└── Dockerfile              (Docker configuration)
```

### Tasks

1. **Initialize Nest.js Project**

   ```bash
   # Install Nest CLI
   npm install -g @nestjs/cli

   # Create new Nest.js project
   cd backend
   nest new . --skip-git

   # Install additional dependencies
   npm install @nestjs/passport passport passport-jwt
   npm install @nestjs/jwt bcrypt
   npm install @prisma/client
   npm install class-validator class-transformer
   npm install @nestjs/config
   ```

2. **Configure Main Entry Point with CORS**

   ```typescript
   // backend/src/main.ts
   import { NestFactory } from '@nestjs/core';
   import { ValidationPipe } from '@nestjs/common';
   import { AppModule } from './app.module';

   async function bootstrap() {
     const app = await NestFactory.create(AppModule);

     // ✅ Enable CORS
     app.enableCors({
       origin: [
         'http://localhost:3000', // Local development
         'https://yourdomain.vercel.app', // Vercel preview
         'https://yourdomain.com', // Production
       ],
       credentials: true,
       methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
       allowedHeaders: ['Content-Type', 'Authorization'],
     });

     // Enable validation
     app.useGlobalPipes(
       new ValidationPipe({
         whitelist: true,
         transform: true,
       })
     );

     // Set global prefix
     app.setGlobalPrefix('api');

     const port = process.env.PORT || 5000;
     await app.listen(port);
     console.log(`🚀 Backend running on http://localhost:${port}`);
   }
   bootstrap();
   ```

3. **Create Module Structure**

   ```bash
   # Create modules
   nest generate module modules/auth
   nest generate module modules/users
   nest generate module modules/billing
   nest generate module modules/analytics
   nest generate module modules/notifications

   # Create services
   nest generate service modules/auth
   nest generate service modules/users

   # Create controllers
   nest generate controller modules/auth
   nest generate controller modules/users
   ```

4. **Implement Auth Module**

   ```typescript
   // backend/src/modules/auth/auth.controller.ts
   import {
     Controller,
     Post,
     Body,
     HttpCode,
     HttpStatus,
   } from '@nestjs/common';
   import { AuthService } from './auth.service';
   import { LoginDto, RegisterDto } from './dto';

   @Controller('auth')
   export class AuthController {
     constructor(private authService: AuthService) {}

     @Post('login')
     @HttpCode(HttpStatus.OK)
     async login(@Body() loginDto: LoginDto) {
       return this.authService.login(loginDto);
     }

     @Post('register')
     async register(@Body() registerDto: RegisterDto) {
       return this.authService.register(registerDto);
     }
   }
   ```

   ```typescript
   // backend/src/modules/auth/auth.service.ts
   import { Injectable, UnauthorizedException } from '@nestjs/common';
   import { JwtService } from '@nestjs/jwt';
   import * as bcrypt from 'bcrypt';
   import { PrismaService } from '../prisma/prisma.service';

   @Injectable()
   export class AuthService {
     constructor(
       private prisma: PrismaService,
       private jwt: JwtService
     ) {}

     async login(dto: LoginDto) {
       const user = await this.prisma.user.findUnique({
         where: { email: dto.email },
       });

       if (!user) {
         throw new UnauthorizedException('Invalid credentials');
       }

       const passwordMatch = await bcrypt.compare(dto.password, user.password);
       if (!passwordMatch) {
         throw new UnauthorizedException('Invalid credentials');
       }

       const token = this.jwt.sign({
         sub: user.id,
         email: user.email,
       });

       return {
         access_token: token,
         user: {
           id: user.id,
           email: user.email,
           name: user.name,
         },
       };
     }

     async register(dto: RegisterDto) {
       const hashedPassword = await bcrypt.hash(dto.password, 10);

       const user = await this.prisma.user.create({
         data: {
           email: dto.email,
           password: hashedPassword,
           name: dto.name,
         },
       });

       const token = this.jwt.sign({
         sub: user.id,
         email: user.email,
       });

       return {
         access_token: token,
         user: {
           id: user.id,
           email: user.email,
           name: user.name,
         },
       };
     }
   }
   ```

5. **Implement Users Module**

   ```typescript
   // backend/src/modules/users/users.controller.ts
   import { Controller, Get, UseGuards } from '@nestjs/common';
   import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
   import { CurrentUser } from '../auth/decorators/current-user.decorator';
   import { UsersService } from './users.service';

   @Controller('users')
   @UseGuards(JwtAuthGuard)
   export class UsersController {
     constructor(private usersService: UsersService) {}

     @Get('me')
     async getMe(@CurrentUser() user: any) {
       return this.usersService.findById(user.sub);
     }
   }
   ```

6. **Implement Billing Module**

   ```typescript
   // backend/src/modules/billing/billing.module.ts
   import { Module } from '@nestjs/common';
   import { PaymentsService } from './payments/payments.service';
   import { SubscriptionsService } from './subscriptions/subscriptions.service';
   import { DiscountsService } from './discounts/discounts.service';
   import { AffiliateService } from './affiliate/affiliate.service';
   import { PaymentsController } from './payments/payments.controller';
   import { SubscriptionsController } from './subscriptions/subscriptions.controller';

   @Module({
     controllers: [PaymentsController, SubscriptionsController],
     providers: [
       PaymentsService,
       SubscriptionsService,
       DiscountsService,
       AffiliateService,
     ],
     exports: [PaymentsService, SubscriptionsService],
   })
   export class BillingModule {}
   ```

7. **Set Up TimescaleDB Hypertables**

   TimescaleDB requires converting regular tables to hypertables for time-series optimization.

   ```typescript
   // backend/prisma/schema.prisma

   generator client {
     provider = "prisma-client-js"
   }

   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }

   // Regular application tables
   model User {
     id        String   @id @default(uuid())
     email     String   @unique
     password  String
     name      String
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }

   model Payment {
     id              String   @id @default(uuid())
     userId          String
     amount          Decimal
     currency        String
     status          String
     stripePaymentId String
     createdAt       DateTime @default(now())
     user            User     @relation(fields: [userId], references: [id])
   }

   // Time-series tables (will be converted to hypertables)
   model MarketData {
     id         BigInt   @id @default(autoincrement())
     symbol     String   // e.g., "EURUSD", "GBPUSD"
     timeframe  String   // e.g., "M1", "M5", "H1"
     timestamp  DateTime // Time column for hypertable
     open       Decimal
     high       Decimal
     low        Decimal
     close      Decimal
     volume     BigInt

     @@index([symbol, timeframe, timestamp])
     @@map("market_data")
   }

   model IndicatorFractals {
     id        BigInt   @id @default(autoincrement())
     symbol    String
     timeframe String
     timestamp DateTime // Time column for hypertable
     type      String   // "up" or "down"
     price     Decimal

     @@index([symbol, timeframe, timestamp])
     @@map("indicator_fractals")
   }

   model IndicatorLines {
     id         BigInt   @id @default(autoincrement())
     symbol     String
     timeframe  String
     timestamp  DateTime // Time column for hypertable
     lineType   String   // "support", "resistance"
     price      Decimal
     strength   Int

     @@index([symbol, timeframe, timestamp])
     @@map("indicator_lines")
   }

   model IndicatorPro {
     id        BigInt   @id @default(autoincrement())
     symbol    String
     timeframe String
     timestamp DateTime // Time column for hypertable
     indicator String   // Indicator name
     value     Decimal
     signal    String

     @@index([symbol, timeframe, timestamp])
     @@map("indicator_pro")
   }

   model UserActivityLog {
     id        BigInt   @id @default(autoincrement())
     userId    String
     action    String
     metadata  Json?
     timestamp DateTime @default(now())

     @@index([userId, timestamp])
     @@map("user_activity_logs")
   }
   ```

   ```sql
   -- backend/prisma/migrations/YYYYMMDDHHMMSS_create_hypertables/migration.sql

   -- Enable TimescaleDB extension
   CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

   -- Convert tables to hypertables
   -- This MUST be done AFTER creating the tables with Prisma migrate

   -- Convert market_data to hypertable
   SELECT create_hypertable(
     'market_data',
     'timestamp',
     chunk_time_interval => INTERVAL '1 day',
     if_not_exists => TRUE
   );

   -- Convert indicator_fractals to hypertable
   SELECT create_hypertable(
     'indicator_fractals',
     'timestamp',
     chunk_time_interval => INTERVAL '1 day',
     if_not_exists => TRUE
   );

   -- Convert indicator_lines to hypertable
   SELECT create_hypertable(
     'indicator_lines',
     'timestamp',
     chunk_time_interval => INTERVAL '1 day',
     if_not_exists => TRUE
   );

   -- Convert indicator_pro to hypertable
   SELECT create_hypertable(
     'indicator_pro',
     'timestamp',
     chunk_time_interval => INTERVAL '1 day',
     if_not_exists => TRUE
   );

   -- Convert user_activity_logs to hypertable
   SELECT create_hypertable(
     'user_activity_logs',
     'timestamp',
     chunk_time_interval => INTERVAL '7 days',
     if_not_exists => TRUE
   );

   -- Add compression policy (saves storage costs)
   SELECT add_compression_policy('market_data', INTERVAL '7 days');
   SELECT add_compression_policy('indicator_fractals', INTERVAL '7 days');
   SELECT add_compression_policy('indicator_lines', INTERVAL '7 days');
   SELECT add_compression_policy('indicator_pro', INTERVAL '7 days');

   -- Add retention policy (auto-delete old data)
   SELECT add_retention_policy('user_activity_logs', INTERVAL '90 days');

   -- Create continuous aggregates for common queries
   CREATE MATERIALIZED VIEW market_data_hourly
   WITH (timescaledb.continuous) AS
   SELECT
     time_bucket('1 hour', timestamp) AS hour,
     symbol,
     timeframe,
     first(open, timestamp) AS open,
     max(high) AS high,
     min(low) AS low,
     last(close, timestamp) AS close,
     sum(volume) AS volume
   FROM market_data
   GROUP BY hour, symbol, timeframe;

   -- Refresh continuous aggregate policy
   SELECT add_continuous_aggregate_policy('market_data_hourly',
     start_offset => INTERVAL '3 hours',
     end_offset => INTERVAL '1 hour',
     schedule_interval => INTERVAL '1 hour');

   -- Create indexes for better query performance
   CREATE INDEX idx_market_data_symbol_time ON market_data (symbol, timestamp DESC);
   CREATE INDEX idx_indicator_fractals_symbol_time ON indicator_fractals (symbol, timestamp DESC);
   ```

   ```bash
   # Run migrations
   npx prisma migrate dev --name create_hypertables

   # Generate Prisma Client
   npx prisma generate
   ```

8. **Configure Redis Caching**

   ```bash
   # Install Redis dependencies
   npm install ioredis @nestjs/cache-manager cache-manager-ioredis-yet
   npm install @nestjs/bull bull
   ```

   ```typescript
   // backend/src/redis/redis.module.ts
   import { Module, Global } from '@nestjs/common';
   import { CacheModule } from '@nestjs/cache-manager';
   import { redisStore } from 'cache-manager-ioredis-yet';
   import { ConfigModule, ConfigService } from '@nestjs/config';

   @Global()
   @Module({
     imports: [
       CacheModule.registerAsync({
         imports: [ConfigModule],
         inject: [ConfigService],
         useFactory: async (configService: ConfigService) => ({
           store: await redisStore({
             url: configService.get('REDIS_URL'),
             ttl: 300, // Default TTL: 5 minutes
           }),
         }),
       }),
     ],
     exports: [CacheModule],
   })
   export class RedisModule {}
   ```

   ```typescript
   // backend/src/app.module.ts
   import { Module } from '@nestjs/common';
   import { ConfigModule } from '@nestjs/config';
   import { BullModule } from '@nestjs/bull';
   import { RedisModule } from './redis/redis.module';
   import { AuthModule } from './modules/auth/auth.module';
   import { UsersModule } from './modules/users/users.module';
   import { BillingModule } from './modules/billing/billing.module';

   @Module({
     imports: [
       ConfigModule.forRoot({
         isGlobal: true,
       }),
       // Redis caching
       RedisModule,
       // Bull Queue (uses Redis)
       BullModule.forRootAsync({
         useFactory: () => ({
           redis: process.env.REDIS_URL,
         }),
       }),
       AuthModule,
       UsersModule,
       BillingModule,
     ],
   })
   export class AppModule {}
   ```

   ```typescript
   // backend/src/modules/market-data/market-data.service.ts
   import { Injectable, Inject } from '@nestjs/common';
   import { CACHE_MANAGER } from '@nestjs/cache-manager';
   import { Cache } from 'cache-manager';
   import { PrismaService } from '../prisma/prisma.service';

   @Injectable()
   export class MarketDataService {
     constructor(
       private prisma: PrismaService,
       @Inject(CACHE_MANAGER) private cacheManager: Cache
     ) {}

     async getMarketData(
       symbol: string,
       timeframe: string,
       startTime: Date,
       endTime: Date
     ) {
       const cacheKey = `market:${symbol}:${timeframe}:${startTime.toISOString()}:${endTime.toISOString()}`;

       // Check cache first
       const cached = await this.cacheManager.get(cacheKey);
       if (cached) {
         console.log('Cache hit!');
         return cached;
       }

       // Query TimescaleDB hypertable
       const data = await this.prisma.marketData.findMany({
         where: {
           symbol,
           timeframe,
           timestamp: {
             gte: startTime,
             lte: endTime,
           },
         },
         orderBy: {
           timestamp: 'asc',
         },
       });

       // Store in cache (TTL: 5 minutes)
       await this.cacheManager.set(cacheKey, data, 300000);

       return data;
     }

     async getLatestPrice(symbol: string, timeframe: string) {
       const cacheKey = `price:latest:${symbol}:${timeframe}`;

       // Check cache (short TTL for latest prices)
       const cached = await this.cacheManager.get(cacheKey);
       if (cached) {
         return cached;
       }

       // Query database
       const latest = await this.prisma.marketData.findFirst({
         where: { symbol, timeframe },
         orderBy: { timestamp: 'desc' },
       });

       // Cache for 10 seconds (frequent updates)
       await this.cacheManager.set(cacheKey, latest, 10000);

       return latest;
     }

     async getContinuousAggregate(
       symbol: string,
       startTime: Date,
       endTime: Date
     ) {
       // Query pre-computed hourly data (much faster)
       const result = await this.prisma.$queryRaw`
         SELECT * FROM market_data_hourly
         WHERE symbol = ${symbol}
           AND hour >= ${startTime}
           AND hour <= ${endTime}
         ORDER BY hour ASC
       `;

       return result;
     }
   }
   ```

   ```typescript
   // backend/src/modules/market-data/market-data.controller.ts
   import { Controller, Get, Query, UseGuards } from '@nestjs/common';
   import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
   import { MarketDataService } from './market-data.service';

   @Controller('market-data')
   @UseGuards(JwtAuthGuard)
   export class MarketDataController {
     constructor(private marketDataService: MarketDataService) {}

     @Get()
     async getMarketData(
       @Query('symbol') symbol: string,
       @Query('timeframe') timeframe: string,
       @Query('start') start: string,
       @Query('end') end: string
     ) {
       const startTime = new Date(start);
       const endTime = new Date(end);

       return this.marketDataService.getMarketData(
         symbol,
         timeframe,
         startTime,
         endTime
       );
     }

     @Get('latest')
     async getLatestPrice(
       @Query('symbol') symbol: string,
       @Query('timeframe') timeframe: string
     ) {
       return this.marketDataService.getLatestPrice(symbol, timeframe);
     }

     @Get('hourly')
     async getHourlyData(
       @Query('symbol') symbol: string,
       @Query('start') start: string,
       @Query('end') end: string
     ) {
       const startTime = new Date(start);
       const endTime = new Date(end);

       return this.marketDataService.getContinuousAggregate(
         symbol,
         startTime,
         endTime
       );
     }
   }
   ```

9. **Configure Environment Variables**

   ```typescript
   // backend/src/app.module.ts
   import { Module } from '@nestjs/common';
   import { ConfigModule } from '@nestjs/config';
   import { AuthModule } from './modules/auth/auth.module';
   import { UsersModule } from './modules/users/users.module';
   import { BillingModule } from './modules/billing/billing.module';

   @Module({
     imports: [
       ConfigModule.forRoot({
         isGlobal: true,
       }),
       AuthModule,
       UsersModule,
       BillingModule,
     ],
   })
   export class AppModule {}
   ```

   ```bash
   # backend/.env
   # Timescale Cloud (PostgreSQL + TimescaleDB)
   DATABASE_URL=postgresql://user:password@xxxxx.timescaledb.cloud:5432/dbname?sslmode=require

   # Upstash Redis
   REDIS_URL=redis://:password@xxxxx.upstash.io:6379

   # Authentication
   JWT_SECRET=your-secret-key
   JWT_EXPIRES_IN=7d

   # External Services
   STRIPE_SECRET_KEY=sk_test_...
   SENDGRID_API_KEY=SG...

   # Server
   PORT=5000
   ```

10. **Create Dockerfile**

    ```dockerfile
    # backend/Dockerfile
    FROM node:18-alpine AS builder

    WORKDIR /app

    # Copy package files
    COPY package*.json ./
    COPY prisma ./prisma/

    # Install dependencies
    RUN npm ci

    # Copy source code
    COPY . .

    # Generate Prisma Client
    RUN npx prisma generate

    # Build application
    RUN npm run build

    # Production stage
    FROM node:18-alpine

    WORKDIR /app

    # Copy package files
    COPY package*.json ./

    # Install production dependencies only
    RUN npm ci --only=production

    # Copy built application
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

    # Expose port
    EXPOSE 5000

    # Start application
    CMD ["node", "dist/main"]
    ```

11. **Create Docker Compose for Local Development**

```yaml
# backend/docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '5000:5000'
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    depends_on:
      - postgres
      - redis

  postgres:
    image: timescale/timescaledb:latest-pg15
    ports:
      - '5432:5432'
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

11. **Test Nest.js Backend**

    ```bash
    # Run locally
    npm run start:dev

    # Test endpoints
    curl http://localhost:5000/api/health

    # Build Docker image
    docker build -t backend:latest .

    # Run with Docker
    docker run -p 5000:5000 --env-file .env backend:latest
    ```

### Deliverables

- ✅ Nest.js backend with modular structure
- ✅ CORS configured for localhost and production
- ✅ Docker containerization
- ✅ All modules implemented (Auth, Users, Billing, etc.)
- ✅ TimescaleDB hypertables created for time-series data
- ✅ Redis caching configured
- ✅ Continuous aggregates for analytics
- ✅ Environment variables configured
- ✅ Docker Compose for local testing

### Success Criteria

- [ ] Nest.js backend runs on port 5000
- [ ] All API endpoints functional
- [ ] CORS allows requests from localhost:3000
- [ ] Docker image builds successfully
- [ ] Container runs and responds to requests
- [ ] TimescaleDB hypertables created successfully
- [ ] Redis cache working (verify cache hits)
- [ ] Time-series queries are 10-100× faster than before

---

## Step 6: Connect Frontend and Backend

### Objective

Establish communication between Vercel (or localhost:3000) and Railway (or localhost:5000) using the CORS configuration from Step 5.

### Connection Flow

```
Frontend (localhost:3000)
       ↓ HTTP Request (with CORS)
Backend (localhost:5000)
       ↓ CORS validates origin
Backend processes request
       ↓ CORS headers in response
Frontend receives data
```

### Tasks

1. **Verify CORS Configuration**

   ```typescript
   // backend/src/main.ts (already done in Step 5)
   app.enableCors({
     origin: [
       'http://localhost:3000', // ✅ Local development
       'https://yourdomain.vercel.app', // ✅ Vercel
       'https://yourdomain.com', // ✅ Production
     ],
     credentials: true,
   });
   ```

2. **Configure Frontend API Client**

   ```typescript
   // frontend/lib/api.ts
   const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

   class ApiClient {
     private baseURL: string;

     constructor() {
       this.baseURL = API_URL;
     }

     private async request(endpoint: string, options: RequestInit = {}) {
       const url = `${this.baseURL}/api${endpoint}`;

       const config: RequestInit = {
         ...options,
         headers: {
           'Content-Type': 'application/json',
           ...options.headers,
         },
         credentials: 'include', // Include cookies
       };

       // Add JWT token if available
       const token = localStorage.getItem('token');
       if (token) {
         config.headers['Authorization'] = `Bearer ${token}`;
       }

       const response = await fetch(url, config);

       if (!response.ok) {
         const error = await response.json();
         throw new Error(error.message || 'API request failed');
       }

       return response.json();
     }

     async get(endpoint: string) {
       return this.request(endpoint, { method: 'GET' });
     }

     async post(endpoint: string, data: any) {
       return this.request(endpoint, {
         method: 'POST',
         body: JSON.stringify(data),
       });
     }

     async put(endpoint: string, data: any) {
       return this.request(endpoint, {
         method: 'PUT',
         body: JSON.stringify(data),
       });
     }

     async delete(endpoint: string) {
       return this.request(endpoint, { method: 'DELETE' });
     }
   }

   export const api = new ApiClient();
   ```

3. **Update Environment Variables**

   ```bash
   # frontend/.env.local (Local development)
   NEXT_PUBLIC_API_URL=http://localhost:5000

   # frontend/.env.production (Production)
   NEXT_PUBLIC_API_URL=https://your-app.railway.app
   ```

4. **Test Connection - Login Flow**

   ```typescript
   // frontend/components/LoginForm.tsx
   "use client"

   import { useState } from 'react'
   import { useRouter } from 'next/navigation'
   import { api } from '@/lib/api'

   export default function LoginForm() {
     const [email, setEmail] = useState('')
     const [password, setPassword] = useState('')
     const [error, setError] = useState('')
     const [loading, setLoading] = useState(false)
     const router = useRouter()

     const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault()
       setError('')
       setLoading(true)

       try {
         // ✅ This will call http://localhost:5000/api/auth/login
         const data = await api.post('/auth/login', { email, password })

         // Store token
         localStorage.setItem('token', data.access_token)

         // Redirect to dashboard
         router.push('/dashboard')
       } catch (err: any) {
         setError(err.message)
       } finally {
         setLoading(false)
       }
     }

     return (
       <form onSubmit={handleSubmit}>
         <input
           type="email"
           value={email}
           onChange={(e) => setEmail(e.target.value)}
           placeholder="Email"
           required
         />
         <input
           type="password"
           value={password}
           onChange={(e) => setPassword(e.target.value)}
           placeholder="Password"
           required
         />
         {error && <p className="error">{error}</p>}
         <button type="submit" disabled={loading}>
           {loading ? 'Logging in...' : 'Login'}
         </button>
       </form>
     )
   }
   ```

5. **Test Connection - Dashboard Data**

   ```typescript
   // frontend/app/dashboard/page.tsx
   import { api } from '@/lib/api'

   async function getDashboardData() {
     // ✅ This will call http://localhost:5000/api/users/me
     return await api.get('/users/me')
   }

   export default async function DashboardPage() {
     const user = await getDashboardData()

     return (
       <div>
         <h1>Welcome, {user.name}</h1>
         <p>Email: {user.email}</p>
       </div>
     )
   }
   ```

6. **Manual Connection Test**

   ```bash
   # Start backend
   cd backend
   npm run start:dev
   # Backend running on http://localhost:5000

   # Start frontend (in another terminal)
   cd frontend
   npm run dev
   # Frontend running on http://localhost:3000

   # Test from browser console (http://localhost:3000)
   fetch('http://localhost:5000/api/health')
     .then(r => r.json())
     .then(console.log)
   # Should return: { status: 'ok' }

   # Test authentication
   fetch('http://localhost:5000/api/auth/login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       email: 'test@example.com',
       password: 'password123'
     })
   })
     .then(r => r.json())
     .then(console.log)
   # Should return: { access_token: '...', user: {...} }
   ```

7. **Debugging CORS Issues**

   **Symptom**: Browser shows "CORS policy" error

   **Check**:
   1. Backend CORS config includes frontend origin
   2. Frontend sends correct headers
   3. Backend returns CORS headers in response

   **Verify CORS headers**:

   ```bash
   curl -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        http://localhost:5000/api/auth/login \
        -v

   # Should see:
   # Access-Control-Allow-Origin: http://localhost:3000
   # Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH
   # Access-Control-Allow-Headers: Content-Type, Authorization
   ```

### Deliverables

- ✅ Frontend successfully calls backend API
- ✅ CORS configured and working
- ✅ Authentication flow works end-to-end
- ✅ Data fetching works in all pages

### Success Criteria

- [ ] No CORS errors in browser console
- [ ] Login flow completes successfully
- [ ] Dashboard loads user data from backend
- [ ] All API calls work correctly

---

## Step 7: Local Development E2E Testing

### Objective

Run Playwright E2E tests against localhost:3000 (frontend) and localhost:5000 (backend) to validate all interactive elements work correctly.

### Test Setup

```
Playwright Tests
      ↓
localhost:3000 (Next.js Frontend)
      ↓ API Calls
localhost:5000 (Nest.js Backend)
      ↓
PostgreSQL (Local or Railway)
```

### Tasks

1. **Install Playwright**

   ```bash
   cd frontend
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Configure Playwright**

   ```typescript
   // frontend/playwright.config.ts
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './e2e',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: 'html',

     use: {
       baseURL: 'http://localhost:3000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure',
     },

     projects: [
       {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] },
       },
     ],

     // Start dev server before tests
     webServer: {
       command: 'npm run dev',
       url: 'http://localhost:3000',
       reuseExistingServer: !process.env.CI,
       timeout: 120000,
     },
   });
   ```

3. **Create Test Utilities**

   ```typescript
   // frontend/e2e/helpers/auth.ts
   import { Page } from '@playwright/test';

   export async function login(page: Page, email: string, password: string) {
     await page.goto('/login');
     await page.fill('input[name="email"]', email);
     await page.fill('input[name="password"]', password);
     await page.click('button[type="submit"]');
     await page.waitForURL('/dashboard');
   }

   export async function logout(page: Page) {
     await page.click('button:has-text("Logout")');
     await page.waitForURL('/login');
   }
   ```

4. **Write Authentication Tests**

   ```typescript
   // frontend/e2e/auth.spec.ts
   import { test, expect } from '@playwright/test';
   import { login } from './helpers/auth';

   test.describe('Authentication Flow', () => {
     test('should login successfully with valid credentials', async ({
       page,
     }) => {
       await page.goto('/login');

       // Fill form
       await page.fill('input[name="email"]', 'test@example.com');
       await page.fill('input[name="password"]', 'password123');

       // Intercept API call
       const responsePromise = page.waitForResponse(
         (response) =>
           response.url().includes('/api/auth/login') &&
           response.status() === 200
       );

       // Submit
       await page.click('button[type="submit"]');

       // Verify API call was successful
       const response = await responsePromise;
       expect(response.ok()).toBeTruthy();

       // Verify redirect to dashboard
       await page.waitForURL('/dashboard');

       // Verify user is logged in
       await expect(page.locator('text=Welcome')).toBeVisible();
     });

     test('should show error with invalid credentials', async ({ page }) => {
       await page.goto('/login');

       await page.fill('input[name="email"]', 'wrong@example.com');
       await page.fill('input[name="password"]', 'wrongpassword');
       await page.click('button[type="submit"]');

       // Verify error message
       await expect(page.locator('text=Invalid credentials')).toBeVisible();

       // Verify still on login page
       expect(page.url()).toContain('/login');
     });

     test('should logout successfully', async ({ page }) => {
       // Login first
       await login(page, 'test@example.com', 'password123');

       // Logout
       await page.click('button:has-text("Logout")');

       // Verify redirect to login
       await page.waitForURL('/login');
     });
   });
   ```

5. **Write Interactive Element Tests**

   ```typescript
   // frontend/e2e/interactive-elements.spec.ts
   import { test, expect } from '@playwright/test';
   import { login } from './helpers/auth';

   test.describe('Interactive Elements', () => {
     test.beforeEach(async ({ page }) => {
       await login(page, 'test@example.com', 'password123');
     });

     test('Add to Cart button should work', async ({ page }) => {
       await page.goto('/products/123');

       // Click add to cart
       await page.click('button:has-text("Add to Cart")');

       // Verify API call
       const response = await page.waitForResponse((response) =>
         response.url().includes('/api/cart/add')
       );
       expect(response.status()).toBe(200);

       // Verify success message
       await expect(page.locator('text=Added to cart')).toBeVisible();
     });

     test('Search filter should work', async ({ page }) => {
       await page.goto('/products');

       // Type in search
       await page.fill('input[type="search"]', 'laptop');
       await page.click('button:has-text("Search")');

       // Verify URL updated
       await page.waitForURL(/\/products\?q=laptop/);

       // Verify results filtered
       await expect(page.locator('.product-card')).toHaveCount(5);
     });

     test('Subscription upgrade should work', async ({ page }) => {
       await page.goto('/subscription');

       // Click upgrade button
       await page.click('button:has-text("Upgrade to Pro")');

       // Fill payment form
       await page.fill('input[name="cardNumber"]', '4242424242424242');
       await page.fill('input[name="expiry"]', '12/25');
       await page.fill('input[name="cvc"]', '123');

       // Submit
       await page.click('button[type="submit"]');

       // Verify API call
       const response = await page.waitForResponse((response) =>
         response.url().includes('/api/subscriptions/upgrade')
       );
       expect(response.status()).toBe(200);

       // Verify success
       await expect(page.locator('text=Subscription upgraded')).toBeVisible();
     });
   });
   ```

6. **Run Tests**

   ```bash
   # Make sure both servers are running:
   # Terminal 1: Backend on localhost:5000
   # Terminal 2: Frontend on localhost:3000

   # Run all tests
   npm run test:e2e

   # Run specific test file
   npx playwright test e2e/auth.spec.ts

   # Run in UI mode (debug)
   npx playwright test --ui

   # Run in headed mode (see browser)
   npx playwright test --headed
   ```

7. **Add Package.json Scripts**

   ```json
   // frontend/package.json
   {
     "scripts": {
       "dev": "next dev",
       "build": "next build",
       "start": "next start",
       "test:e2e": "playwright test",
       "test:e2e:ui": "playwright test --ui",
       "test:e2e:headed": "playwright test --headed",
       "test:e2e:debug": "playwright test --debug"
     }
   }
   ```

### Expected Test Results

```
Running 15 tests using 4 workers

  ✓ e2e/auth.spec.ts:5:1 › should login successfully (2.3s)
  ✓ e2e/auth.spec.ts:25:1 › should show error with invalid credentials (1.8s)
  ✓ e2e/auth.spec.ts:35:1 › should logout successfully (1.5s)
  ✓ e2e/interactive-elements.spec.ts:8:1 › Add to Cart button should work (2.1s)
  ✓ e2e/interactive-elements.spec.ts:20:1 › Search filter should work (1.9s)
  ✓ e2e/interactive-elements.spec.ts:32:1 › Subscription upgrade should work (3.2s)

  15 passed (18s)
```

### Deliverables

- ✅ Playwright configured for local testing
- ✅ Authentication tests passing
- ✅ Interactive element tests passing
- ✅ All critical user flows validated

### Success Criteria

- [ ] All E2E tests pass
- [ ] Tests run against localhost:3000 and localhost:5000
- [ ] No CORS errors during tests
- [ ] All interactive elements work correctly

---

## Step 8: Staging/Production E2E Testing

### Objective

Deploy frontend to Vercel and backend to Railway, then run E2E tests against the deployed applications to ensure production readiness.

### Test Setup

```
Playwright Tests
      ↓
https://yourdomain.vercel.app (Deployed Frontend)
      ↓ API Calls
https://your-app.railway.app (Deployed Backend)
      ↓
PostgreSQL (Railway)
```

### Tasks

1. **Deploy Backend to Railway**

   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login to Railway
   railway login

   # Initialize project
   cd backend
   railway init

   # Link to project
   railway link

   # Deploy
   railway up

   # Note the deployed URL: https://your-app.railway.app
   ```

2. **Configure Railway Environment Variables**

   ```bash
   # Set environment variables in Railway dashboard
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-production-secret
   STRIPE_SECRET_KEY=sk_live_...
   SENDGRID_API_KEY=SG...
   PORT=5000
   NODE_ENV=production
   ```

3. **Deploy Frontend to Vercel**

   ```bash
   # Install Vercel CLI
   npm install -g vercel

   # Login to Vercel
   vercel login

   # Deploy
   cd frontend
   vercel

   # Follow prompts:
   # - Link to existing project or create new
   # - Set environment variables

   # Note the deployed URL: https://yourdomain.vercel.app
   ```

4. **Configure Vercel Environment Variables**

   ```bash
   # In Vercel dashboard or via CLI:
   vercel env add NEXT_PUBLIC_API_URL production
   # Enter: https://your-app.railway.app

   # Redeploy with new env vars
   vercel --prod
   ```

5. **Update CORS for Production**

   ```typescript
   // backend/src/main.ts
   app.enableCors({
     origin: [
       'http://localhost:3000', // Local
       'https://yourdomain.vercel.app', // ✅ Add your Vercel URL
       'https://yourdomain.com', // ✅ Add custom domain
     ],
     credentials: true,
   });
   ```

   ```bash
   # Redeploy backend with updated CORS
   cd backend
   railway up
   ```

6. **Create Production Test Configuration**

   ```typescript
   // frontend/playwright.config.ts
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './e2e',

     use: {
       baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure',
     },

     projects: [
       {
         name: 'local',
         use: {
           ...devices['Desktop Chrome'],
           baseURL: 'http://localhost:3000',
         },
       },
       {
         name: 'staging',
         use: {
           ...devices['Desktop Chrome'],
           baseURL: 'https://yourdomain.vercel.app',
         },
       },
     ],
   });
   ```

7. **Update Package Scripts**

   ```json
   // frontend/package.json
   {
     "scripts": {
       "test:e2e": "playwright test --project=local",
       "test:e2e:staging": "playwright test --project=staging",
       "test:e2e:production": "PLAYWRIGHT_BASE_URL=https://yourdomain.com playwright test"
     }
   }
   ```

8. **Run Production Tests**

   ```bash
   # Test against staging (Vercel deployment)
   npm run test:e2e:staging

   # Or set URL manually
   PLAYWRIGHT_BASE_URL=https://yourdomain.vercel.app npm run test:e2e
   ```

9. **Set Up CI/CD for Automated Testing**

   ```yaml
   # .github/workflows/e2e-tests.yml
   name: E2E Tests

   on:
     push:
       branches: [main, develop]
     pull_request:
       branches: [main]

   jobs:
     e2e-tests:
       runs-on: ubuntu-latest

       steps:
         - uses: actions/checkout@v3

         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'

         - name: Install dependencies
           run: |
             cd frontend
             npm ci

         - name: Install Playwright
           run: |
             cd frontend
             npx playwright install --with-deps

         - name: Run E2E tests against staging
           run: |
             cd frontend
             npm run test:e2e:staging
           env:
             PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}

         - name: Upload test results
           if: always()
           uses: actions/upload-artifact@v3
           with:
             name: playwright-report
             path: frontend/playwright-report/
             retention-days: 30
   ```

10. **Monitor Production**

    ```bash
    # Check backend health
    curl https://your-app.railway.app/api/health

    # Check frontend loads
    curl https://yourdomain.vercel.app

    # Monitor logs in Railway dashboard
    railway logs

    # Monitor logs in Vercel dashboard
    vercel logs
    ```

### Smoke Tests for Production

```typescript
// frontend/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Production Smoke Tests', () => {
  test('Homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Your App Name/);
  });

  test('API health check responds', async ({ page }) => {
    const response = await page.request.get(
      `${process.env.NEXT_PUBLIC_API_URL}/api/health`
    );
    expect(response.status()).toBe(200);
  });

  test('Login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('Can reach backend from frontend', async ({ page }) => {
    await page.goto('/login');

    // Try to login (will fail but API should be reachable)
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'test');

    const responsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/auth/login')
    );

    await page.click('button[type="submit"]');

    const response = await responsePromise;
    // Should get 401 Unauthorized (not CORS error)
    expect([401, 200]).toContain(response.status());
  });
});
```

### Deliverables

- ✅ Backend deployed to Railway
- ✅ Frontend deployed to Vercel
- ✅ Production environment variables configured
- ✅ E2E tests pass against deployed applications
- ✅ CI/CD pipeline for automated testing

### Success Criteria

- [ ] Backend accessible at Railway URL
- [ ] Frontend accessible at Vercel URL
- [ ] No CORS errors in production
- [ ] All E2E tests pass against production
- [ ] Monitoring and logging configured

---

## Technical Specifications

### Frontend Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Hooks, Context API
- **Forms**: React Hook Form + Zod validation
- **API Client**: Custom fetch wrapper
- **Testing**: Playwright (E2E)
- **Deployment**: Vercel

### Backend Stack

- **Framework**: Nest.js 10+
- **Language**: TypeScript
- **Database**: PostgreSQL 15+ (via Timescale Cloud)
- **Time-Series Extension**: TimescaleDB
- **Cache**: Redis (via Upstash)
- **ORM**: Prisma
- **Authentication**: JWT (passport-jwt)
- **Validation**: class-validator, class-transformer
- **Queue**: Bull (Redis-based)
- **Email**: SendGrid
- **Payment**: Stripe
- **Logging**: Winston
- **Testing**: Jest (unit), Supertest (integration)
- **Deployment**: Railway (Docker)

### Infrastructure

- **Frontend Hosting**: Vercel (~$0-20/month)
- **Backend Hosting**: Railway (~$15-25/month)
- **Database**: Timescale Cloud (~$25-50/month)
- **Cache**: Upstash Redis (~$5-10/month)
- **Data Collection**: Contabo VPS (~$30-50/month)
- **CDN**: Vercel Edge Network (included)
- **SSL**: Automatic (Vercel + Railway)

**Total Infrastructure Cost**: ~$75-155/month

### Module Structure

**Core Module**:

- Authentication (JWT, OAuth)
- User management
- Profile management

**Billing Module**:

- Payment processing (Stripe)
- Subscription management
- Discount codes
- Affiliate tracking

**Analytics Module**:

- User behavior tracking
- Trading data analysis
- Dashboard metrics
- Background job processing

**Notification Module**:

- Email notifications (SendGrid)
- Push notifications (Firebase)
- Alert system
- Queue-based delivery

---

## Deployment Guide

### Prerequisites

- Node.js 18+
- Docker installed
- Railway account
- Vercel account
- Timescale Cloud account (for PostgreSQL + TimescaleDB)
- Upstash account (for Redis)

### Setting Up Timescale Cloud

1. **Create Timescale Cloud Account**
   - Visit https://console.cloud.timescale.com/
   - Sign up for free tier or paid plan
   - Create a new service

2. **Create Database**

   ```
   Service name: your-app-db
   Region: Choose closest to Railway backend
   Plan: Development (free) or Production
   ```

3. **Get Connection String**

   ```
   postgresql://user:password@xxxxx.timescaledb.cloud:5432/dbname?sslmode=require
   ```

4. **Enable TimescaleDB Extension**
   ```sql
   -- Connect to your database and run:
   CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
   ```

### Setting Up Upstash Redis

1. **Create Upstash Account**
   - Visit https://console.upstash.com/
   - Sign up for free tier
   - Create a new Redis database

2. **Create Redis Database**

   ```
   Name: your-app-cache
   Region: Choose closest to Railway backend
   Type: Global (for better availability)
   ```

3. **Get Connection String**
   ```
   redis://:password@xxxxx.upstash.io:6379
   ```

### Backend Deployment (Railway)

1. **Prepare Backend**

   ```bash
   cd backend
   npm install
   npm run build
   docker build -t backend:latest .
   ```

2. **Deploy to Railway**

   ```bash
   railway login
   railway init
   railway up
   ```

3. **Configure Environment**
   - Set all environment variables in Railway dashboard
   - Configure Timescale Cloud database connection
   - Configure Upstash Redis connection
   - Set CORS origins to include Vercel URL

   ```bash
   # Required environment variables:
   DATABASE_URL=postgresql://user:password@xxxxx.timescaledb.cloud:5432/dbname?sslmode=require
   REDIS_URL=redis://:password@xxxxx.upstash.io:6379
   JWT_SECRET=your-production-secret
   STRIPE_SECRET_KEY=sk_live_...
   SENDGRID_API_KEY=SG...
   PORT=5000
   NODE_ENV=production
   ```

4. **Run Migrations and Create Hypertables**

   ```bash
   # Run Prisma migrations
   railway run npx prisma migrate deploy

   # Create hypertables (this is crucial!)
   railway run npx prisma db execute --file ./prisma/migrations/YYYYMMDDHHMMSS_create_hypertables/migration.sql

   # Or connect directly and run SQL
   psql $DATABASE_URL -f ./prisma/migrations/YYYYMMDDHHMMSS_create_hypertables/migration.sql
   ```

5. **Verify TimescaleDB Setup**

   ```sql
   -- Connect to Timescale Cloud and verify hypertables
   SELECT hypertable_name, num_chunks
   FROM timescaledb_information.hypertables;

   -- Should show:
   --  hypertable_name       | num_chunks
   -- -----------------------+------------
   --  market_data           |          1
   --  indicator_fractals    |          1
   --  indicator_lines       |          1
   --  indicator_pro         |          1
   --  user_activity_logs    |          1
   ```

6. **Test Redis Connection**

   ```bash
   # Test Redis from Railway environment
   railway run node -e "const Redis = require('ioredis'); const redis = new Redis(process.env.REDIS_URL); redis.ping().then(console.log)"
   # Should print: PONG
   ```

7. **Verify Deployment**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

### Frontend Deployment (Vercel)

1. **Prepare Frontend**

   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Deploy to Vercel**

   ```bash
   vercel login
   vercel
   ```

3. **Configure Environment**

   ```bash
   vercel env add NEXT_PUBLIC_API_URL production
   # Enter: https://your-app.railway.app
   ```

4. **Deploy Production**

   ```bash
   vercel --prod
   ```

5. **Verify Deployment**
   - Visit https://yourdomain.vercel.app
   - Test login flow
   - Check browser console for errors

---

## Testing Strategy

### Unit Tests (Backend)

```bash
# Run unit tests
cd backend
npm run test

# Coverage report
npm run test:cov
```

### Integration Tests (Backend)

```bash
# Run integration tests
cd backend
npm run test:e2e
```

### E2E Tests (Frontend)

```bash
# Local testing
cd frontend
npm run test:e2e

# Staging testing
npm run test:e2e:staging

# Production testing
npm run test:e2e:production
```

### Test Coverage Goals

- **Backend Unit Tests**: >80% coverage
- **Backend Integration Tests**: All API endpoints
- **E2E Tests**: All critical user flows
- **Smoke Tests**: Core functionality in production

---

## Rollback Procedures

### Rollback Frontend

```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

### Rollback Backend

```bash
# View previous deployments
railway deployment list

# Rollback to previous deployment
railway deployment rollback [deployment-id]
```

### Database Rollback

```bash
# Rollback database migration
npx prisma migrate rollback
```

### Emergency Rollback

1. Tag current monolith as stable
2. Redeploy monolith to Vercel
3. Update DNS if using custom domain
4. Notify team

---

## Success Criteria

### Performance Metrics

- [ ] JavaScript bundle size reduced by 60%+
- [ ] Time to Interactive < 2 seconds
- [ ] First Contentful Paint < 1 second
- [ ] Lighthouse score > 90
- [ ] Time-series queries 10-100× faster with hypertables
- [ ] Cache hit rate > 70%
- [ ] API response time < 200ms (with caching)

### Functional Requirements

- [ ] All authentication flows work
- [ ] All payment flows work
- [ ] All API endpoints functional
- [ ] No CORS errors in production
- [ ] All E2E tests pass
- [ ] TimescaleDB hypertables working correctly
- [ ] Redis caching functional
- [ ] Background jobs processing via Bull Queue

### Database Requirements

- [ ] TimescaleDB hypertables created
- [ ] Continuous aggregates functional
- [ ] Compression policies applied
- [ ] Retention policies configured
- [ ] Time-series queries optimized
- [ ] Redis cache hit rate monitored

### Operational Requirements

- [ ] Backend deployed to Railway
- [ ] Frontend deployed to Vercel
- [ ] CI/CD pipeline configured
- [ ] Monitoring and logging setup
- [ ] Error tracking configured
- [ ] Backup procedures documented

### Cost Requirements

- [ ] Total monthly cost < $160
- [ ] No unexpected cost spikes
- [ ] Resource usage monitored
- [ ] Timescale Cloud storage optimized with compression
- [ ] Redis cache hit rate > 70% (reduces database queries)

**Cost Breakdown**:

- Vercel: $0-20/month
- Railway: $15-25/month
- Timescale Cloud: $25-50/month
- Upstash Redis: $5-10/month
- Contabo VPS: $30-50/month
- **Total: $75-155/month**

---

## Monitoring & Optimization

### TimescaleDB Monitoring

#### **Check Hypertable Health**

```sql
-- View hypertables and their chunk counts
SELECT
  hypertable_name,
  num_chunks,
  total_size,
  uncompressed_size,
  compressed_size
FROM timescaledb_information.hypertables;

-- View chunk details
SELECT
  hypertable_name,
  range_start,
  range_end,
  is_compressed,
  chunk_size
FROM timescaledb_information.chunks
WHERE hypertable_name = 'market_data'
ORDER BY range_start DESC
LIMIT 10;

-- Check compression status
SELECT
  hypertable_name,
  compression_status,
  uncompressed_size,
  compressed_size,
  compression_ratio
FROM timescaledb_information.compression_statistics;
```

#### **Optimize Query Performance**

```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM market_data
WHERE symbol = 'EURUSD'
  AND timeframe = 'H1'
  AND timestamp BETWEEN '2024-01-01' AND '2024-01-31';

-- Create additional indexes if needed
CREATE INDEX idx_market_data_symbol_timeframe_time
ON market_data (symbol, timeframe, timestamp DESC);

-- Update statistics for query planner
ANALYZE market_data;
```

#### **Monitor Continuous Aggregates**

```sql
-- Check continuous aggregate refresh status
SELECT
  view_name,
  refresh_lag,
  last_successful_refresh
FROM timescaledb_information.continuous_aggregate_stats;

-- Manually refresh if needed
CALL refresh_continuous_aggregate('market_data_hourly', NULL, NULL);
```

### Redis Monitoring

#### **Monitor Cache Performance**

```typescript
// backend/src/modules/analytics/cache-stats.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import Redis from 'ioredis';

@Injectable()
export class CacheStatsService {
  private redis: Redis;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    // Get Redis client from cache manager
    this.redis = (this.cacheManager.store as any).client;
  }

  async getCacheStats() {
    const info = await this.redis.info('stats');

    // Parse info string
    const stats = {};
    info.split('\r\n').forEach((line) => {
      const [key, value] = line.split(':');
      if (key && value) {
        stats[key] = value;
      }
    });

    return {
      keyspace_hits: parseInt(stats['keyspace_hits'] || 0),
      keyspace_misses: parseInt(stats['keyspace_misses'] || 0),
      hit_rate: this.calculateHitRate(stats),
      total_keys: await this.redis.dbsize(),
      memory_used: stats['used_memory_human'],
    };
  }

  private calculateHitRate(stats: any): number {
    const hits = parseInt(stats['keyspace_hits'] || 0);
    const misses = parseInt(stats['keyspace_misses'] || 0);
    const total = hits + misses;

    return total > 0 ? (hits / total) * 100 : 0;
  }

  async clearCache(pattern?: string) {
    if (pattern) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return { cleared: keys.length };
    } else {
      await this.redis.flushdb();
      return { cleared: 'all' };
    }
  }
}
```

```typescript
// backend/src/modules/analytics/cache-stats.controller.ts
import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CacheStatsService } from './cache-stats.service';

@Controller('cache-stats')
@UseGuards(JwtAuthGuard)
export class CacheStatsController {
  constructor(private cacheStatsService: CacheStatsService) {}

  @Get()
  async getStats() {
    return this.cacheStatsService.getCacheStats();
  }

  @Delete()
  async clearCache(@Query('pattern') pattern?: string) {
    return this.cacheStatsService.clearCache(pattern);
  }
}
```

#### **Cache Performance Metrics**

```bash
# Connect to Upstash Redis CLI
redis-cli -u $REDIS_URL

# Check memory usage
INFO memory

# Check hit/miss ratio
INFO stats

# View all keys (use with caution in production)
KEYS *

# Monitor real-time commands
MONITOR
```

### Performance Optimization Tips

#### **TimescaleDB Optimizations**

1. **Use Appropriate Chunk Intervals**

   ```sql
   -- For high-frequency data (minutes)
   chunk_time_interval => INTERVAL '1 day'

   -- For low-frequency data (hours/days)
   chunk_time_interval => INTERVAL '7 days'
   ```

2. **Enable Compression**

   ```sql
   -- Saves 90%+ storage, slight query overhead
   SELECT add_compression_policy('market_data', INTERVAL '7 days');
   ```

3. **Use Continuous Aggregates**

   ```sql
   -- Pre-compute common aggregations
   CREATE MATERIALIZED VIEW daily_summary ...
   ```

4. **Set Retention Policies**
   ```sql
   -- Auto-delete old data
   SELECT add_retention_policy('user_activity_logs', INTERVAL '90 days');
   ```

#### **Redis Caching Strategies**

1. **Cache Frequently Accessed Data**
   - User sessions: TTL 7 days
   - API responses: TTL 5 minutes
   - Static data: TTL 1 hour
   - Real-time data: TTL 10 seconds

2. **Use Cache Invalidation**

   ```typescript
   // Invalidate cache on data updates
   async updateMarketData(data) {
     await this.prisma.marketData.create({ data })

     // Clear related caches
     await this.cacheManager.del(`market:${data.symbol}:*`)
   }
   ```

3. **Implement Cache Warming**

   ```typescript
   // Pre-populate cache with common queries
   @Cron('0 */5 * * * *') // Every 5 minutes
   async warmCache() {
     const symbols = ['EURUSD', 'GBPUSD', 'USDJPY']

     for (const symbol of symbols) {
       await this.getLatestPrice(symbol, 'H1')
     }
   }
   ```

4. **Monitor Cache Hit Rate**
   - Target: >70% hit rate
   - If <50%: TTL too short or wrong caching strategy
   - If >95%: TTL might be too long (stale data risk)

---

## Conclusion

This migration from Monolith to Modular Monolith architecture provides a clear path to improved performance, maintainability, and scalability while keeping costs reasonable. The 8-step approach ensures a gradual, testable migration that minimizes risk.

### Next Steps

1. Review this document with the team
2. Set up development environment
3. Begin with Step 1 (Baseline Assessment)
4. Follow steps sequentially
5. Test thoroughly at each step
6. Deploy to staging before production
7. Monitor post-deployment metrics

### Support & Resources

- Next.js Documentation: https://nextjs.org/docs
- Nest.js Documentation: https://docs.nestjs.com
- Railway Documentation: https://docs.railway.app
- Vercel Documentation: https://vercel.com/docs
- Playwright Documentation: https://playwright.dev
- TimescaleDB Documentation: https://docs.timescale.com
- Timescale Cloud Console: https://console.cloud.timescale.com
- Upstash Documentation: https://docs.upstash.com
- Upstash Console: https://console.upstash.com
- Redis Documentation: https://redis.io/docs
- Prisma Documentation: https://www.prisma.io/docs

---

**Document Version**: 2.0  
**Last Updated**: January 2026  
**Status**: Ready for Implementation  
**Infrastructure**: Vercel + Railway + Timescale Cloud + Upstash
