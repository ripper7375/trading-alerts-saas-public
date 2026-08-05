# 🔒 Preparatory Tier Access Redefinition & Core Refactoring Specification (Parts 02–33)

**Document Version:** 1.0.0  
**Status:** Authoritative Specification for Claude Code Execution  
**Target Scope:** Global Tier Access Rights & Preparatory Refactoring for Parts 26–33  
**Date:** 2026-08-05

---

## 1. Executive Summary & Purpose

This document provides the **complete, authoritative definition of access rights** between the **Free Tier** and the **Pro Tier** across the entire DavinTrade SaaS application (Parts 02 through 33).

It specifically details the **6 Core Codebase Preparatory Areas (Parts 03, 04, 05, 16, 22, 24/25)** that must be updated _before_ Claude Code begins executing **Parts 26–33 (Stack D: Conversational AI Analyst** and **Stack E: Live Market Comments & Quality Metrics)**.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               MASTER TIER ACCESS RIGHTS SUMMARY                                   │
├──────────────────────────────────┬───────────────────────────────┬────────────────────────────────┤
│ Feature / Stack                  │ FREE Tier                     │ PRO Tier                       │
├──────────────────────────────────┼───────────────────────────────┼────────────────────────────────┤
│ Symbol & Timeframe Data          │ XAUUSD (M5 + M15)             │ XAUUSD (M5 + M15)              │
│ Price & Line Alerts              │ 🔒 0 Alerts (Disabled)        │ ⚡ 100 Active Alerts           │
│ API Rate Limit                   │ 🐌 60 requests / hour         │ ⚡ 300 requests / hour          │
│ MTF Channel Overlay (M5 on M15)  │ 🔒 Locked                     │ ⚡ Unlocked (`/api/channel`)   │
│ Stack D: AI Analyst Chat         │ 🔒 100% Locked (No Access)    │ ⚡ Unlocked (Monthly Token Quota)│
│ Stack E: Market Comment Feeds    │ 🔒 Locked (No Feeds)          │ ⚡ Live Socket.IO Stream        │
│ Stack E: Market Quality Metrics  │ 🔒 Locked (No Metrics)        │ ⚡ 4 Live Statistical Metrics  │
└──────────────────────────────────┴───────────────────────────────┴────────────────────────────────┘
```

---

## 2. Complete Master Tier Access Rights Matrix (Parts 02–33)

### 📊 2.1 Baseline Platform Access (Parts 02–25)

1. **Symbol & Timeframe Access (Parts 02, 04, 16, 23, 25):**
   - **FREE Tier:** Access to `XAUUSD` on `M5` and `M15` timeframes; full access to all 79 `market_data_v6` numerical columns.
   - **PRO Tier:** Identical data access (`XAUUSD`, `M5` + `M15`, all 79 columns).

2. **Price & Drawing-Engine Line Alerts (Part 11 & Part 21):**
   - **FREE Tier:** **`0` Max Alerts** (`FREE_TIER_CONFIG.maxAlerts = 0`). Alert creation is completely disabled.
   - **PRO Tier:** **`100` Active Alerts** (`PRO_TIER_CONFIG.maxAlerts = 100`). Pro users can create, update, and manage drawing line-touch alerts on chart handles.

3. **API Rate Limiting (Part 16):**
   - **FREE Tier:** **60 API requests/hour** (`rateLimit = 60`).
   - **PRO Tier:** **300 API requests/hour** (`rateLimit = 300`).

4. **Multi-Timeframe Visualisation Channel Overlay (`M5 on M15`) (Part 24 Engine 2):**
   - **FREE Tier:** 🔒 Locked switch with PRO upgrade prompt.
   - **PRO Tier:** ⚡ Unlocked (`GET /api/market-data/channel` returns M5 `uoedt`, `base_fl`, `loedt` channel overlays on M15 charts).

5. **Notification Channels (Part 15):**
   - **FREE Tier:** Basic UI badge count.
   - **PRO Tier:** Real-time Socket.IO push alerts + email notifications when price/line alerts trigger.

6. **Pricing & Free Trial (Part 12 & Part 18 & Part 22):**
   - **FREE Tier:** $0/month forever.
   - **PRO Tier:** $29/month (configurable via `NEXT_PUBLIC_PRO_PRICE_MONTHLY`), includes a 7-day free trial with full PRO access.

---

### 🤖 2.2 Stack D: Conversational AI Analyst Access (Parts 26–30)

- **FREE Tier:** 🔒 **No Access to Chat.**
  - Clicking `Ask Gemini` or opening Panel 1 displays a locked PRO banner: _"AI Analyst Chat is exclusive to PRO subscribers."_
  - Server endpoints (`/api/ai/chat`, `/api/ai/chat/stream`) return `403 Forbidden` (`reason: "TIER_PRO_REQUIRED"`).

- **PRO Tier:** ⚡ **Full Chat Access with Monthly Token Usage Quota.**
  - Full access to chat with `Gemini 3.6 Flash`, `Gemini 3.6 Pro`, and `Claude 3.5 Sonnet`.
  - Computer Vision analysis of Part 24 3-panel chart PNG images.
  - Interactive `TradeSetupCard` and `MarketHealthCard` generation.
  - Subject to a configurable **Monthly Token Usage Quota** (e.g. 500,000 tokens/month, tracked in Redis + PostgreSQL `token_usage_log`).

---

### 📰 2.3 Stack E: Live Market Comments & Quality Metrics Access (Parts 31–33)

- **FREE Tier:** 🔒 **No Feeds & No Quality Metrics.**
  - Right-hand panel (Panel 3) displays a blurred/locked preview overlay with a PRO upgrade button.
  - Socket.IO gateway suppresses `market_comments_stream` events for FREE tier client connections.

- **PRO Tier:** ⚡ **Full Real-Time Feeds & Quality Metrics Unlocked.**
  - Real-time scrollable Market Comments stream (`[Alert Icon / Timestamp / Short Comment / Call Action]`).
  - Live statistical Quality Metrics readouts (`Bar Coverage 92%`, `Regression R² 72%`, `EDT Fitness 27%`, `Baseline Symmetry 32%`).

---

## 3. The 6 Core Preparatory Codebase Refactoring Areas

Before Claude Code begins implementing Parts 26–33, the following 6 core codebase sections must be updated:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                    6 CORE PREPARATORY REFACTORING AREAS BEFORE PARTS 26–33                        │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Part 3 & `lib/tier-config.ts`  ➔ Update Single Source of Truth TierConfig Interfaces              │
│ 2. Part 4 & NestJS TierGuard      ➔ Add `canAccessAiAnalyst()` & `canAccessMarketComments()`      │
│ 3. Part 5 & JWT Auth Claims       ➔ Embed `tier` & `tokenQuota` claims inside JWT tokens          │
│ 4. Part 16 & Redis Rate Limiter   ➔ Implement monthly token usage tracking (`ai_tokens:userId`)    │
│ 5. Part 22 & Prisma User Schema   ➔ Add `profile` JSONB column + `TokenUsageLog` model            │
│ 6. Part 24/25 & Microservice DTOs ➔ Forward `X-User-Tier` headers across gateway boundaries       │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 🛠️ Core Area 1: Part 3 (`@trading-alerts/types`) & `lib/tier-config.ts` Update

Update `lib/tier-config.ts` to include the canonical Tier Configuration for Stack D & E:

```typescript
// File: lib/tier-config.ts & operation-service/src/tier/tier.schemas.ts

export interface TierConfig {
  name: string;
  price: number;
  symbols: number;
  timeframes: number;
  chartCombinations: number;
  maxAlerts: number;
  rateLimit: number;

  // NEW STACK D & E ACCESS RIGHTS:
  aiAnalystAllowed: boolean;
  aiMonthlyTokenQuota: number; // 0 for FREE, 500,000 for PRO
  marketCommentsFeedAllowed: boolean;
  marketQualityMetricsAllowed: boolean;
}

export const FREE_TIER_CONFIG: TierConfig = {
  name: 'FREE',
  price: 0,
  symbols: 1,
  timeframes: 2,
  chartCombinations: 2,
  maxAlerts: 0,
  rateLimit: 60,

  // Stack D & E Gating for FREE:
  aiAnalystAllowed: false, // FREE tier cannot access chat
  aiMonthlyTokenQuota: 0, // 0 tokens
  marketCommentsFeedAllowed: false, // FREE tier has no comment feeds
  marketQualityMetricsAllowed: false, // FREE tier has no quality metrics
};

export const PRO_TIER_CONFIG: TierConfig = {
  name: 'PRO',
  price: PRO_MONTHLY_PRICE,
  symbols: 1,
  timeframes: 2,
  chartCombinations: 2,
  maxAlerts: 100,
  rateLimit: 300,

  // Stack D & E Gating for PRO:
  aiAnalystAllowed: true, // PRO tier has chat access
  aiMonthlyTokenQuota: 500_000, // 500k monthly token quota
  marketCommentsFeedAllowed: true, // Live comment feeds enabled
  marketQualityMetricsAllowed: true, // Live quality metrics enabled
};
```

---

### 🛠️ Core Area 2: Part 4 (Tier Guard & Validation) — `lib/tier-validation.ts` & `tier.guard.ts`

Add validation functions in `lib/tier-validation.ts` and NestJS `TierGuard`:

```typescript
// File: lib/tier-validation.ts

export function canAccessAiAnalyst(tier: Tier): ValidationResult {
  if (!TIER_CONFIGS[tier].aiAnalystAllowed) {
    return {
      allowed: false,
      reason:
        'AI Analyst Chat is exclusive to PRO subscribers. Upgrade to access real-time AI chart analysis.',
    };
  }
  return { allowed: true };
}

export function canAccessMarketComments(tier: Tier): ValidationResult {
  if (!TIER_CONFIGS[tier].marketCommentsFeedAllowed) {
    return {
      allowed: false,
      reason:
        'Live Market Comments and Quality Metrics require a PRO subscription.',
    };
  }
  return { allowed: true };
}
```

In `operation-service/src/auth/tier.guard.ts`:

```typescript
@Injectable()
export class TierGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Validate Stack D routes (/api/ai/**)
    if (request.url.startsWith('/api/ai')) {
      if (!user || user.tier !== 'PRO') {
        throw new ForbiddenException(
          'AI Analyst Chat is exclusive to PRO subscribers.'
        );
      }
    }

    return true;
  }
}
```

---

### 🛠️ Core Area 3: Part 5 (Authentication & JWT Claims)

Ensure `tier` and token usage claims are baked into JWT tokens during authentication:

```typescript
// File: operation-service/src/auth/auth.service.ts

export interface JwtPayload {
  sub: string;
  email: string;
  tier: 'FREE' | 'PRO';
  aiMonthlyTokenQuota: number;
}
```

---

### 🛠️ Core Area 4: Part 16 (Utilities & Redis Token Limiter)

Implement monthly token usage tracking in `RedisService`:

```typescript
// File: operation-service/src/redis/redis.service.ts

export class RedisService {
  async trackAiTokenUsage(
    userId: string,
    tokensUsed: number,
    monthlyQuota: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const monthKey = new Date().toISOString().slice(0, 7); // "2026-08"
    const key = `ai_tokens:${userId}:${monthKey}`;

    const currentUsage = await this.redis.incrby(key, tokensUsed);
    if (currentUsage === tokensUsed) {
      // Set TTL to 35 days on first write
      await this.redis.expire(key, 35 * 86400);
    }

    const remaining = Math.max(0, monthlyQuota - currentUsage);
    return {
      allowed: currentUsage <= monthlyQuota,
      remaining,
    };
  }
}
```

---

### 🛠️ Core Area 5: Part 22 (User Profile & Prisma Schema)

Extend PostgreSQL schema via Prisma in `operation-service/prisma/schema.prisma`:

```prisma
// File: operation-service/prisma/schema.prisma

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  tier      Tier     @default(FREE)
  profile   Json?    // { preferredLlm: "gemini-3-6-flash", riskTolerance: "moderate" }

  tokenLogs TokenUsageLog[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model TokenUsageLog {
  id           String   @id @default(uuid())
  userId       String
  model        String   // "gemini-3-6-flash" | "claude-3-5-sonnet"
  promptTokens Int
  imageTokens  Int      @default(0)
  completionTokens Int
  estimatedCostUsd Float
  timestamp    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, timestamp])
}
```

---

### 🛠️ Core Area 6: Part 24 & 25 (Microservice Header Forwarding)

Ensure Next.js proxy routes forward `X-User-Tier` and `X-User-Id` headers to `Operation-Service` and Railway Gateway:

```typescript
// File: lib/operation-service/client.ts

headers: {
  'Content-Type': 'application/json',
  'X-User-Tier': session?.user?.tier ?? 'FREE',
  'X-User-Id': session?.user?.id,
}
```

---

## 🗺️ 4. Claude Code Execution Handoff Plan

When passing this document to Claude Code along with `STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE.md` and `STACK-E-POSTGRESQL-JSONB-MARKET-COMMENTS-ARCHITECTURE.md`, instruct Claude Code to execute in the following order:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE EXECUTION ORDER                                    │
│                                                                                        │
│  [PHASE 1: PREPARATORY REFACTORING]                                                    │
│  1. Execute Core Area 1: Update `lib/tier-config.ts` & `@trading-alerts/types`         │
│  2. Execute Core Area 2: Update `lib/tier-validation.ts` & NestJS `TierGuard`          │
│  3. Execute Core Area 3: Update JWT payload in `operation-service/src/auth/`           │
│  4. Execute Core Area 4: Add Redis `trackAiTokenUsage()` sliding-window limiter        │
│  5. Execute Core Area 5: Run Prisma migration for `profile` JSONB & `TokenUsageLog`    │
│  6. Execute Core Area 6: Update Next.js client header forwarding                      │
│                                                                                        │
│  [PHASE 2: STACK D & E BUILDING (PARTS 26–33)]                                         │
│  7. Build Parts 26–30 (Stack D Multimodal Conversational AI Analyst)                   │
│  8. Build Parts 31–33 (Stack E Live Market Comments & Quality Metrics)                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 🏆 Conclusion

This specification guarantees that **Stack D and Stack E are built upon a secure, tier-validated, and cost-controlled infrastructure**. Claude Code can execute the preparatory refactoring first, ensuring seamless delivery of Parts 26–33!
