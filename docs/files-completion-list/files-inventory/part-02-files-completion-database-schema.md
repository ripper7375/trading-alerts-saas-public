# Part 02: Database Schema & Migrations - Files Completion List

**Last Updated:** 2026-02-11
**Status:** ✅ Complete (100%)

---

## 📋 Files Built in Part 02

### Core Database Files

**File 1/8:** ✅ `prisma/schema.prisma`

- **Status:** Complete
- **Description:** Complete Prisma schema with 30+ models, including MarketDataV6 schema
- **Models:** User, Subscription, Alert, Watchlist, MarketDataV6, Affiliate, Disbursement, etc.
- **Features:**
  - 15 enums (UserTier, SubscriptionStatus, etc.)
  - 30+ database models
  - Complete indexes and relationships
  - Support for Stripe and dLocal payments
  - MarketDataV6 downstream store (79-field centroid-regression/EDT-channel/ZigZag schema)
  - Affiliate marketing system
  - RiseWorks disbursement integration
  - Security and fraud detection models

**File 2/8:** ✅ `lib/db/prisma.ts`

- **Status:** Complete
- **Description:** Prisma Client singleton for Next.js
- **Features:**
  - Singleton pattern for connection pooling
  - Development vs production logging
  - Hot reload support
  - Type-safe database access

**File 3/8:** ✅ `lib/db/seed.ts`

- **Status:** Complete
- **Description:** Database seeding helper functions
- **Functions:**
  - `seedAdmin()` - Create admin user with PRO tier
  - `seedDefaultWatchlist()` - Create default watchlist
  - `seedSampleWatchlistItems()` - Add FREE tier symbols
  - `seedSampleAlerts()` - Create demonstration alerts
  - `seedCompleteSetup()` - Complete admin setup
  - `cleanupTestData()` - Test data cleanup

**File 4/8:** ✅ `prisma/seed.ts`

- **Status:** Complete
- **Description:** Prisma seed script entry point
- **Uses:** Functions from `lib/db/seed.ts`

**File 5/13:** ✅ `prisma/migrations/20251227000000_init/migration.sql`

- **Status:** Complete
- **Description:** Initial database migration
- **Contents:** SQL schema creation statements for all models

**File 6/13:** ✅ `prisma/migrations/20260214000000_rag_dual_memory/migration.sql`

- **Status:** Complete
- **Description:** RAG dual memory database migration

**File 7/13:** ✅ `prisma/migrations/20260224000000_update_kc_ha_body_columns/migration.sql`

- **Status:** Complete
- **Description:** Update KC HA body columns migration

**File 8/13:** ✅ `prisma/migrations/20260705000000_add_market_data_v6/migration.sql`

- **Status:** Complete
- **Description:** Migration adding MarketDataV6 table

**File 9/13:** ✅ `prisma/migrations/20260705010000_drop_market_data/migration.sql`

- **Status:** Complete
- **Description:** Migration dropping the old MarketData table

**File 10/13:** ✅ `prisma/migrations/20260706000000_drop_watchlists/migration.sql`

- **Status:** Complete
- **Description:** Migration dropping the `Watchlist`/`WatchlistItem` tables (V8: watchlist
  feature removed for all tiers — see `change-to-new-design.md`)

### Test Files

**File 11/13:** ✅ `__tests__/lib/db/prisma.test.ts`

- **Status:** Complete
- **Description:** Prisma client singleton tests
- **Coverage:** Client instantiation, development mode logging

**File 12/13:** ✅ `__tests__/lib/db/seed.test.ts`

- **Status:** Complete
- **Description:** Comprehensive seed function tests
- **Coverage:**
  - All seed helper functions (seedAdmin, seedDefaultWatchlist, etc.)
  - Input validation
  - Error handling
  - Relationship integrity
  - Complete setup workflow

### Documentation

**File 13/13:** ✅ `docs/open-api-documents/part-02-database-schema-openapi.yaml`

- **Status:** ✅ **NEW** - Created 2026-01-24
- **Description:** Complete OpenAPI 3.0 specification for database schema
- **Contents:**
  - All 15 enums documented
  - 30+ model schemas with full property definitions
  - Relationship documentation
  - Index specifications
  - Tier access rules (FREE vs PRO)
  - 79-column MarketDataV6 schema detailed
  - Security, affiliate, and disbursement models

---

## 📊 Status Summary

- **Total Files:** 13/13 (100%)
- **Core Database:** 10/10 files ✅ (added `20260706000000_drop_watchlists` migration, 2026-07-07)
- **Tests:** 2/2 files ✅
- **Documentation:** 1/1 files ✅

---

## 🗄️ Database Models Overview

### User Management (7 models)

1. **User** - Core user model with authentication and tier management
2. **Account** - OAuth account linking (NextAuth)
3. **Session** - NextAuth session management
4. **UserSession** - Extended session tracking with device/location
5. **UserPreferences** - User settings and preferences
6. **VerificationToken** - Email verification tokens
7. **AccountDeletionRequest** - Account deletion workflow

### Security (3 models)

1. **LoginHistory** - Login attempt tracking
2. **SecurityAlert** - Security notifications
3. **FraudAlert** - Fraud detection and prevention

### Subscription & Payment (2 models)

1. **Subscription** - User subscriptions (Stripe + dLocal)
2. **Payment** - Payment transaction records

### Alerts & Watchlists (4 models)

1. **Alert** - Price and indicator alerts
2. **Watchlist** - User watchlist containers
3. **WatchlistItem** - Watchlist items (symbol + timeframe)
4. **Notification** - User notifications

### Market Data (1 model)

1. **MarketDataV6** - 79-column schema downstream store for XAUUSD Railway Gateway pipeline
   - 10 system columns (OHLCV + metadata)
   - 32 centroid-regression columns (best_fit, cherry_a, cherry_b, most_recent, non_a, non_b)
   - 5 fractal EDT columns
   - 3 Z-Score candle columns
   - 11 ZigZag columns
   - 3 provenance columns

### Affiliate Marketing (3 models)

1. **AffiliateProfile** - Affiliate account information
2. **AffiliateCode** - Discount codes and tracking
3. **Commission** - Commission tracking and payments

### Disbursement System (5 models)

1. **AffiliateRiseAccount** - RiseWorks account integration
2. **PaymentBatch** - Batch payment processing
3. **DisbursementTransaction** - Individual payout transactions
4. **RiseWorksWebhookEvent** - Webhook event tracking
5. **DisbursementAuditLog** - Audit trail for disbursements

### System Configuration (2 models)

1. **SystemConfig** - Dynamic system settings
2. **SystemConfigHistory** - Config change audit trail

---

## 🔍 Schema Statistics

- **Total Models:** 30+
- **Total Enums:** 15
- **Database Provider:** PostgreSQL
- **ORM:** Prisma 5.x
- **Migration Strategy:** Prisma Migrate

### MarketDataV6 Schema Details

- **Total Columns:** 79
- **Purpose:** Downstream store for Railway Gateway pipeline (supersedes old MarketData model).

**Indicator Groups:**

1. Centroid-regression variants (32 columns) - best_fit, cherry_a, cherry_b, most_recent, non_a, non_b
2. Fractal EDT + single best lines (5 columns)
3. Z-Score candle (3 columns)
4. ZigZag (11 columns)
5. Provenance (3 columns)

---

## 🎯 Key Features

### Multi-Provider Support

- **Stripe:** Primary payment provider (monthly subscriptions)
- **dLocal:** Emerging markets (3-day plans, local payment methods)
- **RiseWorks:** Crypto disbursements for affiliates

### Security Features

- **Two-Factor Authentication (TOTP)** with backup codes
- **Device Tracking:** Browser, OS, geolocation
- **Login History:** Complete audit trail
- **Fraud Detection:** Pattern-based alerts
- **Session Management:** Extended tracking separate from NextAuth

### Trial System

- **7-Day PRO Trial:** General trial period management
- **Anti-Abuse Protection:**
  - Stripe trial tracking (`hasUsedStripeTrial`)
  - dLocal 3-day plan tracking (`hasUsedThreeDayPlan`)
  - Device fingerprinting
  - IP tracking

### Affiliate System

- **Unified Authentication:** Users can be both SaaS users AND affiliates
- **Code Distribution:** Initial, monthly, admin bonus
- **Commission Tracking:** Pending, approved, paid, cancelled
- **Multi-Payment Support:** Bank transfer, crypto (USDT), PayPal, local wallets

---

## 📝 Notes

- All models include proper indexing for performance
- Cascading deletes configured where appropriate
- Nullable fields clearly marked for optional data
- JSON fields used for flexible/extensible data (preferences, metadata)
- Unique constraints prevent data duplication
- Relationship integrity enforced at database level

---

## 🔗 Related Documentation

- **Schema Definition:** `prisma/schema.prisma`
- **OpenAPI Spec:** `docs/open-api-documents/part-02-database-schema-openapi.yaml`
- **Build Order:** `docs/build-orders/part-02-database.md`
- **Type Definitions:** `types/indicator.ts`, `lib/tier/types.ts`
- **Constants:** `lib/tier/constants.ts`

---

**Part 02 Status:** ✅ Complete and production-ready
