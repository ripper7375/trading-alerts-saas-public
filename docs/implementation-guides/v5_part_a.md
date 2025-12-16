# Trading Alerts SaaS - Complete Implementation Plan V5

## Commercial SaaS with Next.js 15 + Flask Architecture

**Version:** 5.0 (Commercial Model)  
**Last Updated:** November 2025  
**Architecture:** Next.js 15 (App Router) + Flask Microservice  
**Timeline:** 6 weeks MVP → 7 months Full SaaS

---

## ⚠️ REQUIRED FILES CHECKLIST - READ THIS FIRST!

### 📋 Files You MUST Attach in Next Chat

Before starting implementation in your next chat, you will need these files from this conversation:

#### 1. **MQL5 Indicator Files** (REQUIRED)

- ✅ `Fractal Horizontal Line_V5.mq5` (REQUIRED - provides horizontal support/resistance lines)
- ✅ `Fractal Diagonal Line_V4.mq5` (REQUIRED - provides diagonal trend lines)
- 📦 `OHLC Download_V4.mq5` (OPTIONAL - utility for exporting OHLC data to files, NOT used by Flask)

**Why needed:** The Flask MT5 service reads buffer indices from the 2 Fractal indicators. Buffer positions must match your indicator code. The OHLC Download tool is included for reference but is NOT required for the SaaS platform.

**How to attach:**

```
In your next chat, upload the 2 REQUIRED Fractal indicator files and say:
"I'm implementing the Trading Alerts SaaS. Here are my MQL5 indicators.
Please help me set up [specific phase]."
```

#### 2. **This Implementation Guide** (REQUIRED)

- ✅ This markdown document (download it now!)

**Why needed:** Complete reference for all implementation phases

**How to use:**

```
In your next chat, paste relevant sections or say:
"According to my implementation plan, I'm at Phase 2: Authentication.
Can you help me implement [specific feature]?"
```

#### 3. **Python Market AI Engine** (OPTIONAL REFERENCE)

- ⚠️ `market_ai_engine.py` (from documents you uploaded earlier)

**Why optional:** We're rewriting the Flask service from scratch with cleaner architecture. However, you can reference it for:

- MT5 connection logic
- Buffer reading approach
- Error handling patterns

**How to use if needed:**

```
"I have my old market_ai_engine.py. Can you show me how to migrate
the MT5 connection logic to the new Flask service architecture?"
```

### 📦 What You DON'T Need to Attach

❌ **TradingView Lightweight Charts** - It's an npm package

```bash
# Just install when needed:
npm install lightweight-charts
```

❌ **Next.js boilerplate** - You'll create it fresh

```bash
npx create-next-app@latest trading-alerts-saas
```

❌ **Database files** - You'll set up fresh with Prisma

---

## 📋 Quick Start Checklist

Before your next chat, ensure you have:

```
☐ Downloaded this implementation guide (markdown file)
☐ Located your 2 MQL5 indicator files:
  ☐ Fractal Horizontal Line_V5.mq5
  ☐ Fractal Diagonal Line_V4.mq5
☐ (Optional) Saved market_ai_engine.py for reference
☐ Noted which phase you want to start with
☐ Prepared your MT5 credentials (Login, Password, Server)
☐ Decided on initial symbol to test (e.g., "EURUSD" - FREE tier accessible)
☐ Installed development tools (VS Code, Node.js 18+, Python 3.11+)
```

### 🎯 Recommended Next Chat Message

```
Hi! I'm ready to implement the Trading Alerts SaaS (V5 - Commercial Model).

[Attach: Fractal Horizontal Line_V5.mq5]
[Attach: Fractal Diagonal Line_V4.mq5]

I want to start with Phase [1/2/3/etc]: [Phase Name]

My setup:
- MT5 Symbol: [Your symbol]
- Operating System: [Windows/Mac/Linux]
- Development experience: [Beginner/Intermediate/Advanced]

Can you help me with [specific task]?
```

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Backend Service Functionalities](#3-backend-service-functionalities)
4. [Technology Stack](#4-technology-stack)
5. [Project Structure](#5-project-structure)
6. [Database Schema](#6-database-schema)
7. [Implementation Guide](#7-implementation-guide)
8. [MQL5 Indicators Integration](#8-mql5-indicators-integration)
9. [Complete Backend Services Implementation](#9-complete-backend-services-implementation)
10. [Code Examples](#10-code-examples)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Guide](#12-deployment-guide)
13. [Timeline & Milestones](#13-timeline--milestones)
14. [Cost Estimation](#14-cost-estimation)
15. [Maintenance & Monitoring](#15-maintenance--monitoring)
16. [Appendix: File Attachment Template](#16-appendix-file-attachment-template)

---

## 1. Executive Summary

### Project Overview

Build a commercial SaaS platform for trading alerts and signal generation with real-time chart visualization, integrating MT5 indicators with web-based TradingView Lightweight Charts.

**🆕 V5 KEY CHANGE - Commercial Model:**

- **Single Data Source:** YOUR MT5 terminal is the ONLY data source
- **Users CANNOT connect their own MT5**
- **2-Tier System:** FREE (5 symbols × 3 timeframes) + PRO (15 symbols × 9 timeframes)
- **9 Timeframes:** M5, M15, M30, H1, H2, H4, H8, H12, D1 (added M5, H12 for PRO tier)

### Development Stages

- **MVP (6 weeks):** Core functionality with database, auth, and basic features
- **Early Stage (4 weeks):** Multiple indicators and symbols
- **Mid Stage (6 weeks):** Alert system with real-time notifications
- **Late Stage (4 weeks):** Mobile PWA for iOS and Android
- **Ultimate Stage (8+ weeks):** ML signals and full SaaS features

### Key Differentiator

Hybrid architecture leveraging Next.js 15 for primary backend/frontend and Flask microservice exclusively for MT5 integration from YOUR centralized MT5 terminal.

### Critical Requirements

- **Your custom MQL5 indicators** must be attached in next chat
- Indicators must be compiled and running in YOUR MT5 terminal
- Flask service will read from YOUR specific indicator buffers
- **Commercial SaaS:** Users subscribe to access YOUR data, not connect their own MT5

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR MT5 TERMINAL                        │
│               (SINGLE CENTRALIZED SOURCE)                   │
│   Running YOUR Custom Indicators:                          │
│   • Fractal Horizontal Line_V5.mq5 ◄── ATTACH IN NEXT CHAT│
│   • Fractal Diagonal Line_V4.mq5   ◄── ATTACH IN NEXT CHAT│
│                                                             │
│   Symbols Available:                                        │
│   FREE Tier:  BTCUSD, EURUSD, USDJPY, US30, XAUUSD       │
│               (5 symbols)                                   │
│   PRO Tier:   AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD,    │
│               GBPJPY, GBPUSD, NDX100, NZDUSD, US30,       │
│               USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD      │
│               (15 symbols)                                  │
│                                                             │
│   Timeframes:                                              │
│   FREE Tier:  H1, H4, D1 (3 total)                        │
│   PRO Tier:   M5, M15, M30, H1, H2, H4, H8, H12, D1 (9)  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Indicator Buffers
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              FLASK MICROSERVICE                             │
│         (Python - MT5 Integration Only)                     │
│  • Read indicator buffers from YOUR .mq5 files             │
│  • Buffer indices match YOUR indicator code                │
│  • Validate tier-based symbol access                       │
│  • Convert to JSON                                          │
│  • Expose REST endpoint                                     │
│  • Docker containerized                                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/JSON with Tier Validation
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              NEXT.JS 15 APPLICATION                         │
│         (TypeScript - Primary Backend + Frontend)           │
│                                                             │
│  Backend (API Routes):                                      │
│  ├── /api/auth/* - Authentication (NextAuth.js)            │
│  ├── /api/indicators/* - Fetch from Flask (tier-gated)     │
│  ├── /api/alerts/* - Alert CRUD operations                 │
│  ├── /api/watchlist/* - User watchlists (symbol+timeframe) │
│  ├── /api/user/* - User management                         │
│  └── /api/webhooks/* - Stripe payments (2 tiers)           │
│                                                             │
│  Frontend (Pages):                                          │
│  ├── / - Landing page (SSG)                                │
│  ├── /login, /register - Auth pages (SSR)                  │
│  ├── /dashboard - Main dashboard (SSR, tier-aware)         │
│  ├── /charts/[symbol] - Chart viewer (CSR, tier-gated)     │
│  ├── /alerts - Alert management (SSR)                      │
│  ├── /pricing - 2-tier plans (FREE + PRO)                  │
│  └── /settings - User settings (SSR)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              DATA LAYER                                     │
│                                                             │
│  PostgreSQL:                                                │
│  ├── Users (FREE/PRO tiers only)                          │
│  ├── Subscriptions (2-tier system)                        │
│  ├── Alerts, Alert Notifications                           │
│  ├── Watchlists (symbol+timeframe combinations)           │
│  ├── WatchlistItems (new model for combinations)          │
│  └── Indicator Cache                                       │
│                                                             │
│  Redis:                                                     │
│  ├── Session storage                                       │
│  ├── Rate limiting                                         │
│  ├── Indicator data cache                                  │
│  └── Job queue (BullMQ)                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              WEBSOCKET SERVER                               │
│         (Socket.IO - Real-time Updates)                     │
│  • Price updates                                            │
│  • Alert notifications                                      │
│  • Indicator changes                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              USERS (SUBSCRIBERS)                            │
│  • Web Browser (Desktop/Mobile)                            │
│  • PWA (iOS/Android)                                       │
│  • FREE: Access 5 symbols on 3 timeframes (15 combos)     │
│  • PRO: Access 15 symbols on 9 timeframes (135 combos)    │
│  • CANNOT connect their own MT5                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**Indicator Data Flow (Commercial Model):**

```
YOUR MT5 (ONLY source) → Flask (tier validation) → Next.js API → Redis Cache → Frontend
```

**Tier-Based Access Flow:**

```
User Request → Session (tier check) → Symbol validation → Timeframe validation → Data/403
```

**Alert Flow:**

```
Background Job → Check Conditions → Trigger → WebSocket → User Notification
```

**Authentication Flow:**

```
User Login → NextAuth.js → JWT → Protected Routes → Tier-based API Access
```

### 2.3 Commercial SaaS Model - Tier System

**🆕 V5: 2-Tier System (Enterprise removed for MVP)**

```typescript
// Tier-based symbol access
export const TIER_SYMBOLS = {
  FREE: ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'], // 5 symbols
  PRO: [
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
  ], // 15 symbols
} as const;

// Tier-based timeframe access
export const TIER_TIMEFRAMES = {
  FREE: ['H1', 'H4', 'D1'], // 3 timeframes
  PRO: ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'], // 9 timeframes
} as const;

// All timeframes
export const TIMEFRAMES = {
  M5: 'M5', // 🆕 V7: Re-added (PRO only - scalping)
  M15: 'M15',
  M30: 'M30',
  H1: 'H1',
  H2: 'H2',
  H4: 'H4',
  H8: 'H8',
  H12: 'H12', // 🆕 V7: Added (PRO only - swing trading)
  D1: 'D1',
};

// Access control helpers
export function canAccessSymbol(tier: 'FREE' | 'PRO', symbol: string): boolean {
  return TIER_SYMBOLS[tier].includes(symbol);
}

export function canAccessTimeframe(
  tier: 'FREE' | 'PRO',
  timeframe: string
): boolean {
  return TIER_TIMEFRAMES[tier].includes(timeframe);
}

export function canAccessCombination(
  tier: 'FREE' | 'PRO',
  symbol: string,
  timeframe: string
): boolean {
  return (
    TIER_SYMBOLS[tier].includes(symbol) &&
    TIER_TIMEFRAMES[tier].includes(timeframe)
  );
}
```

**Tier Comparison:**

| Feature            | FREE                                     | PRO                                       |
| ------------------ | ---------------------------------------- | ----------------------------------------- |
| Symbols            | 5 (BTCUSD, EURUSD, USDJPY, US30, XAUUSD) | 15 symbols                                |
| Timeframes         | 3 (H1, H4, D1)                           | 9 (M5, M15, M30, H1, H2, H4, H8, H12, D1) |
| Chart Combinations | 15 (5×3)                                 | 135 (15×9)                                |
| Watchlists         | 5 items max                              | 50 items max                              |
| Alerts             | 5 max                                    | 20 max                                    |
| API Rate Limit     | 60/hour                                  | 300/hour                                  |
| Real-time Updates  | Yes                                      | Yes                                       |
| Price              | $0                                       | $29/month                                 |

---

## 3. Backend Service Functionalities

### 3.1 Core Backend Services Overview

The platform includes 6 essential backend service functionalities:

1. **Registration (Sign Up)** - Complete user onboarding system
2. **Login (Sign In)** - Secure authentication with session management
3. **Settings & Configuration** - Comprehensive user preferences management
   - 3.1 User Profile
   - 3.2 Page Appearance (Theme, Layout)
   - 3.3 User Account Management
   - 3.4 Privacy Settings
   - 3.5 Billing & Subscription (2-tier system)
   - 3.6 Language Preferences
   - 3.7 Get Help & Support
   - 3.8 Learn More / Documentation
   - 3.9 Log Out
4. **Admin Dashboard** - System administration and monitoring
5. **E-commerce (Plans)** - 2-tier subscription plans and payment processing
6. **System Notifications** - Critical monitoring and alerts

### 3.2 Service Functionalities Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND SERVICES                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. REGISTRATION SERVICE                                    │
│     ├── Email Validation                                    │
│     ├── Password Hashing                                    │
│     ├── Email Verification                                  │
│     ├── Default Tier Assignment (FREE)                      │
│     └── Welcome Email                                       │
│                                                             │
│  2. LOGIN SERVICE                                           │
│     ├── Credential Validation                               │
│     ├── JWT Token Generation (includes tier)                │
│     ├── Session Management                                  │
│     ├── 2FA Support (Optional)                              │
│     └── Remember Me                                         │
│                                                             │
│  3. SETTINGS & CONFIGURATION                                │
│     ├── 3.1 User Profile (Name, Avatar, Bio)               │
│     ├── 3.2 Page Appearance (Dark/Light, Layout)           │
│     ├── 3.3 User Account (Email, Password, Delete)         │
│     ├── 3.4 Privacy (Data, Visibility)                     │
│     ├── 3.5 Billing (2-tier: FREE/PRO, Payment Methods)    │
│     ├── 3.6 Language (i18n Support)                        │
│     ├── 3.7 Get Help (Support Tickets, Chat)               │
│     ├── 3.8 Learn More (Docs, Tutorials)                   │
│     └── 3.9 Log Out (Session Termination)                  │
│                                                             │
│  4. ADMIN DASHBOARD                                         │
│     ├── User Management (tier distribution)                │
│     ├── System Analytics                                    │
│     ├── Revenue Reports (FREE→PRO conversions)             │
│     ├── API Usage Monitoring (by tier)                     │
│     ├── Error Logs                                          │
│     └── Configuration Management                            │
│                                                             │
│  5. E-COMMERCE (2-TIER PLANS)                              │
│     ├── View Plans (FREE vs PRO comparison)                │
│     ├── Plan Features (symbol access differences)          │
│     ├── Stripe Checkout (PRO only)                         │
│     ├── Subscription Management                             │
│     ├── Invoice History                                     │
│     ├── Upgrade/Downgrade                                   │
│     └── Payment Method Management                           │
│                                                             │
│  6. SYSTEM NOTIFICATIONS                                    │
│     ├── Real-time Alerts (WebSocket)                        │
│     ├── Email Notifications                                 │
│     ├── System Health Monitoring                            │
│     ├── Critical Error Alerts                               │
│     ├── Performance Degradation Warnings                    │
│     └── Maintenance Notifications                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Service Integration Flow

```
User Registration Flow:
User → Registration Form → Validation → Create User (FREE tier) → Send Verification Email → Email Verified → Welcome Email → Dashboard

User Login Flow:
User → Login Form → Credential Check → JWT Generation (with tier) → Session Creation → Dashboard

Tier-Gated Data Access Flow:
User → Request Symbol/Timeframe → Check JWT Tier → Validate Access → Fetch Data / Return 403

Settings Update Flow:
User → Settings Page → Update Request → Validation → Database Update → Success Notification

Admin Actions Flow:
Admin → Admin Dashboard → Action Request → Authorization Check → Execute Action → Audit Log → Response

E-commerce Flow (2-Tier):
User → View Plans (FREE vs PRO) → Select PRO → Stripe Checkout → Payment → Subscription Created → Tier Upgraded → Confirmation Email → Dashboard

System Monitoring Flow:
System Event → Monitor Service → Threshold Check → Notification Service → WebSocket/Email → Admin/User
```

### 3.4 API Endpoints Summary

```
Authentication & Registration:
POST   /api/auth/register          - User registration (defaults to FREE)
POST   /api/auth/login             - User login (returns tier in JWT)
POST   /api/auth/logout            - User logout
POST   /api/auth/verify-email      - Email verification
POST   /api/auth/forgot-password   - Password reset request
POST   /api/auth/reset-password    - Password reset

Settings & Configuration:
GET    /api/user/profile           - Get user profile (includes tier)
PUT    /api/user/profile           - Update user profile
GET    /api/user/preferences       - Get preferences
PUT    /api/user/preferences       - Update preferences
PUT    /api/user/appearance        - Update theme/layout
PUT    /api/user/privacy           - Update privacy settings
DELETE /api/user/account           - Delete account
GET    /api/user/billing           - Get billing info (tier, subscription)
PUT    /api/user/language          - Update language

Admin Dashboard:
GET    /api/admin/users            - List all users (with tier info)
GET    /api/admin/analytics        - System analytics (tier distribution)
GET    /api/admin/revenue          - Revenue reports
GET    /api/admin/api-usage        - API usage stats (by tier)
GET    /api/admin/error-logs       - System error logs
PUT    /api/admin/user/:id         - Update user (can change tier)
DELETE /api/admin/user/:id         - Delete user

E-commerce (2-Tier System):
GET    /api/plans                  - List plans (FREE + PRO only)
POST   /api/checkout               - Create checkout session (PRO upgrade)
POST   /api/webhooks/stripe        - Stripe webhook
GET    /api/subscription           - Get subscription
PUT    /api/subscription/cancel    - Cancel subscription (downgrade to FREE)
PUT    /api/subscription/upgrade   - Upgrade FREE→PRO
GET    /api/invoices               - Get invoice history

Notifications:
GET    /api/notifications          - Get all notifications
PUT    /api/notifications/:id/read - Mark as read
DELETE /api/notifications/:id      - Delete notification
GET    /api/system/health          - System health status

Tier-Gated Indicator Access:
GET    /api/indicators/:symbol/:timeframe - Get indicator data (tier-gated)
```

---
