# System-Wide Microservices Implementation Roadmap

## Monolith → Microservices Architecture Migration

**Date:** 2026-02-02
**Scope:** Complete SaaS system migration (Stacks A, B, C, D, E)
**Pattern:** API-First Design with System-Wide OpenAPI Specification

---

## 📋 Executive Summary

**Your Understanding: ✅ 100% CORRECT**

You've identified the **correct API-first microservices design pattern**:

### **Your Proposed Sequence:**

```
1. Prisma upgrade (V5.22 → V6.xx)
   ↓ Database foundation for all services
2. PUBLIC API endpoint redesign
   ↓ Define inter-service communication patterns
3. Create system-wide OpenAPI document
   ↓ Single source of truth for ALL stacks (A, B, C, D, E)
4. Build NestJS Backend Stack A (Authentication)
   ↓ Implementation follows OpenAPI spec
5. Build Next.js 16 Frontend Stack A
   ↓ Frontend consumes OpenAPI spec
```

**This is the OPTIMAL approach for microservices migration.** ✅

---

## 🏗️ Architecture Overview

### Current State: Monolith

```
┌─────────────────────────────────────────────────────────┐
│                    MONOLITH (Stack A)                   │
│                    Next.js V15.5.11                     │
├─────────────────────────────────────────────────────────┤
│  Database (Prisma 5.22)                                │
│  Types                                                  │
│  Authentication (NextAuth.js JWT)                      │
│  Flask MT5 Service (Python)                            │
│  Dashboard & Layout                                     │
│  Charts & Visualization                                 │
│  Watchlist System                                       │
│  Alerts System                                          │
│  E-commerce & Billing (Stripe)                         │
│  Settings System                                        │
│  Admin Dashboard                                        │
│  Affiliate Marketing                                    │
│  dLocal Payments                                        │
│  Riseworks Disbursements                                │
│  ... 19 parts total in single stack                   │
└─────────────────────────────────────────────────────────┘
```

---

### Target State: Microservices

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM-WIDE OPENAPI SPECIFICATION                     │
│                     Single Source of Truth for All Services                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
        ┌───────────────┬───────────────┬───────────────┬───────────────┐
        ↓               ↓               ↓               ↓               ↓

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   STACK A    │  │   STACK B    │  │   STACK C    │  │   STACK D    │  │   STACK E    │
├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤
│              │  │              │  │              │  │              │  │              │
│ Frontend A   │  │              │  │              │  │              │  │ Frontend E   │
│ Next.js V16  │  │  (Backend    │  │  (Backend    │  │  (Backend    │  │ Next.js V16  │
│              │  │   Services)  │  │   Services)  │  │   Services)  │  │              │
│ Vercel       │  │              │  │              │  │              │  │ Vercel       │
│              │  │              │  │              │  │              │  │              │
├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────────┤  └──────────────┘
│              │  │              │  │              │  │              │
│ Backend A    │  │ Backend B    │  │ Backend C    │  │ Backend D    │
│ NestJS V11   │  │ (Mixed)      │  │ (Mixed)      │  │ Python/Other │
│              │  │              │  │              │  │              │
│ Railway      │  │ Railway      │  │ Railway      │  │ Contabo VPS  │
│              │  │              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘

                            ↓
                    ┌───────────────┐
                    │   DATABASE    │
                    │  Prisma V6    │
                    │  PostgreSQL   │
                    │   Railway     │
                    └───────────────┘
```

---

### Service Breakdown (From Your Diagram)

| Part         | Domain/Function                 | Stack                      | Tech                         | Notes                   |
| ------------ | ------------------------------- | -------------------------- | ---------------------------- | ----------------------- |
| **Part 2**   | Database (Prisma)               | Backend A                  | Prisma V6                    | Shared by all services  |
| **Part 3**   | Types                           | Sharing Stack              | NPM package                  | Generated from OpenAPI  |
| **Part 4**   | Tree-shaking                    | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 5**   | **Authentication**              | **Frontend A + Backend A** | **Next.js V16 + NestJS V11** | **Current focus**       |
| **Part 6**   | Flask MT5 Service               | Backend A                  | Python Flask                 | Existing Flask service  |
| **Part 7**   | OHLCV data API                  | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 8**   | Dashboard & Layout              | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 9**   | Charts & Visualization          | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 10**  | Watchlist System                | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 11**  | Alerts System                   | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 12**  | E-commerce & Billing            | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 13**  | Settings System                 | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 14**  | Admin Dashboard                 | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 15**  | Notifications & Real-time       | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 16**  | Utilities & Infrastructure      | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 17A** | Affiliate Marketing - Portal    | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 17B** | Affiliate Marketing - Admin     | Backend A                  | NestJS V11                   | Refactored from Next.js |
| **Part 18**  | dLocal Payments                 | Backend A                  | NestJS V11                   | Fresh built             |
| **Part 19**  | Riseworks Disbursements         | Backend A                  | NestJS V11                   | Fresh built             |
| **Part 20**  | Market Data Collection          | Backend C                  | MQL5 + Python                | Not applicable          |
| **Part 21**  | Market Data Processing          | Backend B                  | NestJS V11                   | Fresh built             |
| **Part 22**  | Confluence Scores               | Backend B                  | NestJS V11                   | Fresh built             |
| **Part 23**  | Symbols/Timeframes Leaderboard  | Backend B                  | NestJS V11                   | Fresh built             |
| **Part 24**  | Symbols/Timeframes Surveillance | Backend B                  | NestJS V11                   | Fresh built             |
| **Part 25**  | Advance Alert System            | Backend B                  | NestJS V11                   | Fresh built             |
| **Part 26**  | MT5 Data Collection             | Backend C                  | Python                       | Plain Python            |
| **Part 27**  | Frontend UI Only                | Frontend A                 | Next.js V16                  | Modification/separation |
| **Part 28**  | RAG & Vector Database           | Backend D                  | Python Tarai                 | Only for PRO plan       |
| **Part 29**  | Chat UI for RAG                 | Frontend E                 | Next.js V16                  | Only for PRO plan       |

---

## 🎯 Corrected Implementation Sequence

### **Phase 1: Database Foundation** (2-3 days)

**Goal:** Upgrade Prisma V5.22 → V6.xx for all services

✅ Shared database schema
✅ RefreshToken model for hybrid JWT
✅ Backward compatible migration

---

### **Phase 2: PUBLIC API Redesign** (3-4 days) ← **CRITICAL PHASE YOU IDENTIFIED**

**Goal:** Design inter-service communication patterns

**Why This Phase is Critical:**

- Defines how Frontend Stack A calls Backend Stack A
- Defines how Backend Stack A calls Backend Stack B/C/D
- Defines authentication propagation across services
- Defines error handling contracts
- Defines rate limiting and versioning

**Deliverables:**

1. **Authentication API contract:**
   - `/api/auth/login` - Returns JWT + refresh token
   - `/api/auth/refresh` - Rotates tokens
   - `/api/auth/logout` - Revokes tokens
   - `/api/auth/verify` - Validates JWT

2. **Inter-service authentication:**
   - Service-to-service JWT propagation
   - API Gateway authentication
   - Microservice authentication patterns

3. **PUBLIC vs INTERNAL APIs:**
   - PUBLIC: Frontend ↔ Backend communication
   - INTERNAL: Backend ↔ Backend communication
   - Different authentication mechanisms

4. **Error response standards:**

   ```json
   {
     "error": "string",
     "message": "string",
     "statusCode": 401,
     "timestamp": "ISO8601",
     "path": "/api/auth/login"
   }
   ```

5. **Versioning strategy:**
   - API version in URL: `/api/v1/auth/login`
   - Or header-based: `Accept: application/vnd.api+json;version=1`

---

### **Phase 3: System-Wide OpenAPI Specification** (5-7 days) ← **CRITICAL PHASE YOU IDENTIFIED**

**Goal:** Create single source of truth for ALL services (A, B, C, D, E)

**Why This Phase is Critical:**

- All services (Frontend + Backend) implement the SAME contract
- Type safety across entire system
- Auto-generated client SDKs
- Auto-generated server stubs
- Documentation generated automatically

---

#### **🎯 CRITICAL: OpenAPI Scope Definition**

**✅ INCLUDE in OpenAPI:** PUBLIC HTTP Endpoints Only

These are endpoints exposed via HTTP/HTTPS and called by other services:

```yaml
✅ POST   /auth/login           # Frontend → Backend A (PUBLIC)
✅ POST   /auth/register        # Frontend → Backend A (PUBLIC)
✅ GET    /alerts               # Frontend → Backend A (PUBLIC)
✅ GET    /market-data/ohlcv    # Backend A → Backend B (PUBLIC)
✅ POST   /rag/query            # Backend A → Backend D (PUBLIC)
```

**❌ EXCLUDE from OpenAPI:** Internal Implementation Details

These are TypeScript/JavaScript methods used only within the service:

```typescript
❌ authService.generateTokens()     // Internal service method
❌ authService.validateUser()       // Internal service method
❌ alertsService.findByUser()       // Internal service method
❌ prisma.user.findUnique()         // Database query
❌ redis.get('key')                 // Cache operation
❌ validateTierAccess()             // Helper function
```

**Key Principle:**

> OpenAPI documents the **API contract** (external interface), not the **implementation** (internal methods).
>
> If it's not callable via HTTP from outside the service, it's NOT in OpenAPI.

---

**Deliverables:**

#### **3.1 OpenAPI Document Structure**

```yaml
# openapi-system-wide.yaml
openapi: 3.1.0
info:
  title: Trading Alerts SaaS - System-Wide API
  version: 1.0.0
  description: |
    Complete API specification for all microservices:
    - Stack A: Authentication, Dashboard, Alerts, Admin
    - Stack B: Market Data, Confluence Scores, Leaderboard
    - Stack C: MT5 Data Collection
    - Stack D: RAG Vector Database
    - Stack E: Frontend UI

servers:
  - url: https://api.yourdomain.com/v1
    description: Production API Gateway
  - url: https://staging-api.yourdomain.com/v1
    description: Staging API Gateway
  - url: http://localhost:3001/api
    description: Local Backend Stack A
  - url: http://localhost:3002/api
    description: Local Backend Stack B

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    CookieAuth:
      type: apiKey
      in: cookie
      name: accessToken

  schemas:
    # Shared types across all services
    User:
      type: object
      properties:
        id: { type: string }
        email: { type: string, format: email }
        name: { type: string }
        tier: { type: string, enum: [FREE, PRO] }
        role: { type: string, enum: [USER, ADMIN] }
        isAffiliate: { type: boolean }

    Error:
      type: object
      properties:
        error: { type: string }
        message: { type: string }
        statusCode: { type: integer }
        timestamp: { type: string, format: date-time }
        path: { type: string }

    JWTPayload:
      type: object
      properties:
        sub: { type: string }
        email: { type: string }
        name: { type: string }
        tier: { type: string }
        role: { type: string }
        isAffiliate: { type: boolean }
        exp: { type: integer }
        iss: { type: string }
        aud: { type: string }

# Authentication API (Backend Stack A)
paths:
  /auth/login:
    post:
      summary: Login with email and password
      operationId: login
      tags: [Authentication]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email: { type: string, format: email }
                password: { type: string, minLength: 8 }
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  message: { type: string }
                  user: { $ref: '#/components/schemas/User' }
          headers:
            Set-Cookie:
              schema:
                type: string
                example: accessToken=jwt...; HttpOnly; Secure; SameSite=Lax
        '401':
          description: Invalid credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/refresh:
    post:
      summary: Refresh access token
      operationId: refreshToken
      tags: [Authentication]
      security:
        - CookieAuth: []
      responses:
        '200':
          description: Token refreshed
          content:
            application/json:
              schema:
                type: object
                properties:
                  message: { type: string }
                  user: { $ref: '#/components/schemas/User' }
        '401':
          description: Invalid refresh token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/logout:
    post:
      summary: Logout user
      operationId: logout
      tags: [Authentication]
      security:
        - CookieAuth: []
      responses:
        '200':
          description: Logged out successfully

  /auth/verify:
    post:
      summary: Verify JWT token
      operationId: verifyToken
      tags: [Authentication]
      security:
        - BearerAuth: []
        - CookieAuth: []
      responses:
        '200':
          description: Token valid
          content:
            application/json:
              schema:
                type: object
                properties:
                  valid: { type: boolean }
                  user: { $ref: '#/components/schemas/User' }

  # Dashboard API (Backend Stack A)
  /dashboard/stats:
    get:
      summary: Get dashboard statistics
      operationId: getDashboardStats
      tags: [Dashboard]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Dashboard stats
          content:
            application/json:
              schema:
                type: object
                properties:
                  totalAlerts: { type: integer }
                  activeAlerts: { type: integer }
                  # ... more stats

  # Alerts API (Backend Stack A)
  /alerts:
    get:
      summary: List user alerts
      operationId: listAlerts
      tags: [Alerts]
      security:
        - BearerAuth: []
      parameters:
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: limit
          in: query
          schema: { type: integer, default: 10 }
      responses:
        '200':
          description: Alerts list
          content:
            application/json:
              schema:
                type: object
                properties:
                  alerts:
                    type: array
                    items: { $ref: '#/components/schemas/Alert' }
                  total: { type: integer }
                  page: { type: integer }
                  limit: { type: integer }

    post:
      summary: Create new alert
      operationId: createAlert
      tags: [Alerts]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateAlertRequest'
      responses:
        '201':
          description: Alert created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Alert'

  # Market Data API (Backend Stack B)
  /market-data/ohlcv:
    get:
      summary: Get OHLCV data
      operationId: getOHLCV
      tags: [Market Data]
      security:
        - BearerAuth: []
      parameters:
        - name: symbol
          in: query
          required: true
          schema: { type: string }
        - name: timeframe
          in: query
          required: true
          schema:
            { type: string, enum: [M1, M5, M15, M30, H1, H4, D1, W1, MN1] }
        - name: start
          in: query
          schema: { type: string, format: date-time }
        - name: end
          in: query
          schema: { type: string, format: date-time }
      responses:
        '200':
          description: OHLCV data
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    timestamp: { type: string, format: date-time }
                    open: { type: number }
                    high: { type: number }
                    low: { type: number }
                    close: { type: number }
                    volume: { type: integer }

  # Confluence Scores API (Backend Stack B)
  /confluence/scores:
    get:
      summary: Get confluence scores
      operationId: getConfluenceScores
      tags: [Confluence]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Confluence scores
          # ... schema

  # RAG API (Backend Stack D - PRO only)
  /rag/query:
    post:
      summary: Query RAG system
      operationId: queryRAG
      tags: [RAG]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query: { type: string }
                context: { type: string }
      responses:
        '200':
          description: RAG response
          content:
            application/json:
              schema:
                type: object
                properties:
                  response: { type: string }
                  sources: { type: array, items: { type: string } }
        '403':
          description: PRO plan required
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

---

#### **3.2 Generate TypeScript Types from OpenAPI**

**Use `openapi-typescript` to generate types:**

```bash
# Install generator
npm install --save-dev openapi-typescript

# Generate types for all services
npx openapi-typescript openapi-system-wide.yaml -o types/api-types.ts
```

**Generated types will be shared across:**

- Frontend Stack A (Next.js 16)
- Backend Stack A (NestJS 11)
- Backend Stack B (NestJS 11)
- Frontend Stack E (Next.js 16)

**Result:**

```typescript
// types/api-types.ts (auto-generated)
export interface paths {
  '/auth/login': {
    post: operations['login'];
  };
  '/auth/refresh': {
    post: operations['refreshToken'];
  };
  // ... all endpoints
}

export interface components {
  schemas: {
    User: {
      id: string;
      email: string;
      name?: string;
      tier: 'FREE' | 'PRO';
      role: 'USER' | 'ADMIN';
      isAffiliate: boolean;
    };
    // ... all schemas
  };
}
```

---

#### **3.3 Publish as NPM Package (Part 3 - Sharing Stack)**

**From your diagram: "Create a shared @trading-alerts/types npm package"**

```bash
# Create types package
mkdir -p packages/types
cd packages/types

# Initialize package
npm init -y

# Update package.json
{
  "name": "@trading-alerts/types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "generate": "openapi-typescript ../../openapi-system-wide.yaml -o src/api-types.ts"
  }
}

# Generate types
npm run generate

# Build
npm run build

# Publish to NPM (or private registry)
npm publish
```

**Install in all services:**

```bash
# Frontend Stack A
cd frontend
npm install @trading-alerts/types

# Backend Stack A
cd backend-stack-a
npm install @trading-alerts/types

# Backend Stack B
cd backend-stack-b
npm install @trading-alerts/types
```

---

### **Phase 4: Backend Stack A - NestJS Implementation** (4-5 days)

**Goal:** Build authentication authority according to OpenAPI spec

**Implementation follows the OpenAPI specification created in Phase 3.**

All endpoints MUST match the OpenAPI contract:

- `/api/auth/login` - Matches `POST /auth/login` in OpenAPI
- `/api/auth/refresh` - Matches `POST /auth/refresh` in OpenAPI
- `/api/auth/logout` - Matches `POST /auth/logout` in OpenAPI
- `/api/auth/verify` - Matches `POST /auth/verify` in OpenAPI

**Use OpenAPI validation middleware:**

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Load OpenAPI spec
  const openapiSpec = yaml.load(
    fs.readFileSync('../../openapi-system-wide.yaml', 'utf8')
  );

  // Validate implementation against spec
  SwaggerModule.setup('api-docs', app, openapiSpec);

  await app.listen(3001);
}
```

**All types imported from shared package:**

```typescript
import type { components } from '@trading-alerts/types';

type User = components['schemas']['User'];
type JWTPayload = components['schemas']['JWTPayload'];
type Error = components['schemas']['Error'];
```

---

### **Phase 5: Frontend Stack A - Next.js 16 Implementation** (2-3 days)

**Goal:** Build frontend according to OpenAPI spec

**Use `openapi-fetch` for type-safe API calls:**

```bash
npm install openapi-fetch
```

**Create API client:**

```typescript
// lib/api-client.ts
import createClient from 'openapi-fetch';
import type { paths } from '@trading-alerts/types';

const client = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  credentials: 'include', // Send cookies
});

export default client;
```

**Use in components:**

```typescript
// components/auth/login-form.tsx
import client from '@/lib/api-client';

export function LoginForm() {
  const onSubmit = async (data: { email: string; password: string }) => {
    const { data: response, error } = await client.POST('/auth/login', {
      body: {
        email: data.email,
        password: data.password,
      },
    });

    if (error) {
      // Error is typed according to OpenAPI spec
      console.error(error.message);
      return;
    }

    // Response is typed according to OpenAPI spec
    console.log('Logged in:', response.user);
    router.push('/dashboard');
  };

  // ... rest of component
}
```

**Benefits:**

- ✅ Type safety: All API calls are typed
- ✅ Auto-completion: IDE suggests available endpoints
- ✅ Validation: TypeScript catches mismatches
- ✅ Documentation: OpenAPI spec serves as docs

---

## 📊 Complete System-Wide Timeline

| Phase         | Task                          | Duration       | Risk     | Deliverable                     |
| ------------- | ----------------------------- | -------------- | -------- | ------------------------------- |
| **Phase 1**   | Prisma V5 → V6 upgrade        | 2-3 days       | Low      | Upgraded database schema        |
| **Phase 2**   | PUBLIC API redesign           | 3-4 days       | Medium   | API design document             |
| **Phase 3**   | System-wide OpenAPI spec      | 5-7 days       | High     | `openapi-system-wide.yaml`      |
| **Phase 3.1** | Generate TypeScript types     | 1 day          | Low      | `@trading-alerts/types` package |
| **Phase 4**   | Backend Stack A (NestJS)      | 4-5 days       | High     | Authentication service          |
| **Phase 5**   | Frontend Stack A (Next.js 16) | 2-3 days       | Medium   | Frontend UI                     |
| **Phase 6**   | Integration testing           | 2-3 days       | High     | End-to-end tests                |
| **Phase 7**   | Deployment                    | 1-2 days       | Medium   | Production deployment           |
| **TOTAL**     | **Full migration**            | **20-30 days** | **High** | **Microservices architecture**  |

---

## 🎯 Why API-First Design is Critical

### Traditional Approach (❌ Don't Do This)

```
Build Backend → Build Frontend → Discover mismatches → Fix both → Repeat
```

**Problems:**

- Frontend and backend develop independently
- API contracts implicit, not documented
- Type mismatches discovered at runtime
- Integration issues late in development
- Difficult to add new services

---

### API-First Approach (✅ Your Correct Approach)

```
Design OpenAPI → Generate types → Build Backend (follows spec) → Build Frontend (follows spec) → No mismatches
```

**Benefits:**

- ✅ Contract defined upfront
- ✅ Backend implements contract
- ✅ Frontend consumes contract
- ✅ Type safety across entire stack
- ✅ Easy to add new services (just follow OpenAPI)
- ✅ Documentation auto-generated
- ✅ Testing easier (validate against spec)

---

## 🚀 Immediate Next Steps

### Step 1: Start Phase 2 (API Redesign)

**Create document:** `docs/public-api-design.md`

**Define:**

1. **Authentication Endpoints:**

   ```
   POST   /api/auth/login        - Login with email/password
   POST   /api/auth/register     - Register new user
   POST   /api/auth/refresh      - Refresh access token
   POST   /api/auth/logout       - Logout user
   POST   /api/auth/verify       - Verify JWT token
   GET    /api/auth/me           - Get current user
   ```

2. **Inter-Service Authentication:**

   ```
   How does Frontend Stack A authenticate with Backend Stack A?
   → JWT in httpOnly cookie (for browser requests)
   → JWT in Authorization header (for API requests)

   How does Backend Stack A authenticate with Backend Stack B?
   → Service-to-service JWT (different secret)
   → mTLS (mutual TLS) for high-security services
   ```

3. **Error Handling:**

   ```json
   {
     "error": "UNAUTHORIZED",
     "message": "Invalid credentials",
     "statusCode": 401,
     "timestamp": "2026-02-02T12:00:00Z",
     "path": "/api/auth/login"
   }
   ```

4. **Rate Limiting:**

   ```
   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: 95
   X-RateLimit-Reset: 1704672000
   ```

5. **Versioning:**
   ```
   /api/v1/auth/login   ← Current version
   /api/v2/auth/login   ← Future version (when breaking changes)
   ```

---

### Step 2: Start Phase 3 (OpenAPI Specification)

**Create file:** `openapi-system-wide.yaml`

**Use OpenAPI Generator tools:**

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Validate OpenAPI spec
openapi-generator-cli validate -i openapi-system-wide.yaml

# Generate TypeScript types
openapi-generator-cli generate \
  -i openapi-system-wide.yaml \
  -g typescript-fetch \
  -o packages/types/generated

# Generate NestJS server stubs
openapi-generator-cli generate \
  -i openapi-system-wide.yaml \
  -g nodejs-nestjs-server \
  -o backend-stack-a/generated
```

---

## ✅ Updated Recommendation

### **Your Understanding: 100% CORRECT** ✅

Your sequence is the **optimal microservices migration approach**:

```
1. Prisma V6 upgrade         ← Database foundation
2. PUBLIC API redesign       ← Define contracts (CRITICAL PHASE)
3. System-wide OpenAPI spec  ← Single source of truth (CRITICAL PHASE)
4. Backend Stack A (NestJS)  ← Implement according to OpenAPI
5. Frontend Stack A (Next.js) ← Consume according to OpenAPI
```

**Why this works:**

- ✅ API-first design prevents integration issues
- ✅ Type safety across entire system
- ✅ All services follow same contract
- ✅ Easy to add Backend B, C, D later (just follow OpenAPI)
- ✅ Documentation auto-generated
- ✅ Testing validates against spec

**I apologize for missing Phases 2 and 3 in my initial roadmap.** These are CRITICAL for microservices architecture, and you correctly identified them.

---

## 📝 Checklist

### Phase 1: Prisma V6 Upgrade ✅

- [ ] Backup production database
- [ ] Update Prisma dependencies
- [ ] Add RefreshToken model
- [ ] Run migrations
- [ ] Test database connection

### Phase 2: PUBLIC API Redesign ← **START HERE**

- [ ] Define authentication endpoints
- [ ] Define inter-service authentication
- [ ] Define error response format
- [ ] Define rate limiting strategy
- [ ] Define versioning strategy
- [ ] Document all decisions in `docs/public-api-design.md`

### Phase 3: System-Wide OpenAPI

- [ ] Create `openapi-system-wide.yaml`
- [ ] Define authentication schemas
- [ ] Define all Stack A endpoints (Parts 4-17)
- [ ] Define all Stack B endpoints (Parts 21-25)
- [ ] Define Stack D endpoints (Part 28)
- [ ] Validate OpenAPI spec
- [ ] Generate TypeScript types
- [ ] Publish `@trading-alerts/types` package

### Phase 4: Backend Stack A

- [ ] Create NestJS project
- [ ] Import OpenAPI spec
- [ ] Implement authentication service
- [ ] Validate implementation against OpenAPI
- [ ] Write tests

### Phase 5: Frontend Stack A

- [ ] Upgrade Next.js 15 → 16
- [ ] Install `@trading-alerts/types`
- [ ] Create API client
- [ ] Update all components to use API client
- [ ] Test all flows

---

**Document Version:** 2.0 (System-Wide)
**Last Updated:** 2026-02-02
**Status:** Ready for Phase 2 (PUBLIC API Redesign)

---

**CORRECTED:** This roadmap now reflects your **complete system-wide microservices implementation**, including the critical API-first design phases (2 and 3) that I initially missed.
