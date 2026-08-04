# Part 02: Database Schema & Migrations - Files Completion List

**Last Updated:** 2026-08-04
**Status:** ✅ Complete (100%)

---

## 📋 Files Built in Part 02

### Core Database Files

**File 1/18:** ✅ `prisma/non-market-data/schema.prisma`

- **Status:** Complete
- **Description:** Non-market data Prisma schema containing 33 models and 22 enums
- **Models:** User, Account, Session, UserSession, UserPreferences, Subscription, Payment, Alert, Drawing, DrawingAlert, Affiliate, Wise & Rise Disbursements, OutboxEvent, RefreshToken, etc.
- **Features:**
  - 22 enums (`UserTier`, `SubscriptionStatus`, `WiseRecipientStatus`, `OutboxEventStatus`, etc.)
  - 33 database models
  - Split client output (`node_modules/.prisma/non-market-client`)
  - Complete indexes and relationships
  - Support for Stripe and dLocal payments
  - Wise (Part 19.5 active) and RiseWorks (Part 19 archived) disbursement integration
  - Security, fraud detection, 2FA TOTP, and hashed refresh tokens
  - Chart Drawing Engine & Line-Touch Alert support

**File 2/18:** ✅ `prisma/market-data/schema.prisma`

- **Status:** Complete
- **Description:** Market data Prisma schema containing the `MarketDataV6` model
- **Models:** MarketDataV6
- **Features:**
  - 79-column MarketDataV6 schema for XAUUSD Railway Gateway pipeline
  - Split client output (`node_modules/.prisma/market-client`)
  - Centroid-regression variants, EDT channels, Z-Score candle classification, and ZigZag fields

**File 3/18:** ✅ `lib/db/prisma.ts`

- **Status:** Complete
- **Description:** Prisma Client singleton for non-market client
- **Features:**
  - Singleton pattern for connection pooling in Next.js
  - Points to non-market client (`.prisma/non-market-client`)
  - Driver adapter configuration for Prisma 7 PgBouncer integration
  - Development vs production logging

**File 4/18:** ✅ `lib/db/market-prisma.ts`

- **Status:** Complete
- **Description:** Prisma Client singleton for market client (`MarketDataV6`)
- **Features:**
  - Dedicated singleton for market-data schema (`.prisma/market-client`)
  - Driver adapter configuration for Prisma 7 PgBouncer integration
  - Used by market-data routes (`/api/market-data/channel`) and alert checker worker

**File 5/18:** ✅ `lib/db/seed.ts`

- **Status:** Complete
- **Description:** Database seeding helper functions
- **Functions:**
  - `seedAdmin()` - Create admin user with PRO tier
  - `seedSampleAlerts()` - Create demonstration alerts (XAUUSD M5/M15)
  - `seedCompleteSetup()` - Complete admin setup
  - `cleanupTestData()` - Test data cleanup

**File 6/18:** ✅ `prisma/seed.ts`

- **Status:** Complete
- **Description:** Prisma seed script entry point
- **Features:**
  - Seeds Admin user, E2E test users (`free-test`, `pro-test`, `admin-test`, `affiliate-test`, `unverified`)
  - Seeds sample alerts for demonstration
  - Seeds `SystemConfig` entries for affiliate settings
  - Uses `.prisma/non-market-client`

**File 7/18:** ✅ `prisma/migrations/20251227000000_init/migration.sql`

- **Status:** Complete
- **Description:** Initial database migration
- **Contents:** SQL schema creation statements for core models

**File 8/18:** ✅ `prisma/migrations/20260214000000_rag_dual_memory/migration.sql`

- **Status:** Complete
- **Description:** RAG dual memory database migration

**File 9/18:** ✅ `prisma/migrations/20260224000000_update_kc_ha_body_columns/migration.sql`

- **Status:** Complete
- **Description:** Update KC HA body columns migration

**File 10/18:** ✅ `prisma/migrations/20260705000000_add_market_data_v6/migration.sql`

- **Status:** Complete
- **Description:** Migration adding MarketDataV6 table

**File 11/18:** ✅ `prisma/migrations/20260705010000_drop_market_data/migration.sql`

- **Status:** Complete
- **Description:** Migration dropping the old MarketData table

**File 12/18:** ✅ `prisma/migrations/20260720000000_drop_money_user_fk_constraints/migration.sql`

- **Status:** Complete
- **Description:** Migration dropping cross-domain foreign key constraints between money and user domains (modular monolith transition)

**File 13/18:** ✅ `prisma/migrations/20260721000000_add_refresh_token_table/migration.sql`

- **Status:** Complete
- **Description:** Migration adding the `RefreshToken` table for hashed refresh tokens

**File 14/18:** ✅ `prisma/migrations/20260726000000_wise_disbursement_additive/migration.sql`

- **Status:** Complete
- **Description:** Migration adding Wise disbursement system models (`AffiliateWiseRecipient`, `WiseTransfer`, `WiseBatchGroup`, `WiseWebhookEvent`, `WiseWebhookSubscription`)

**File 15/18:** ✅ `prisma/migrations/20260727000000_outbox_event_additive/migration.sql`

- **Status:** Complete
- **Description:** Migration adding the `OutboxEvent` table for transactional outbox event pattern

_(Note: The old `20260706000000_drop_watchlists` migration was stripped and orphaned per Decision F20 and is not present in `prisma/migrations/`)_

### Test Files

**File 16/18:** ✅ `__tests__/lib/db/prisma.test.ts`

- **Status:** Complete
- **Description:** Prisma client singleton tests
- **Coverage:** Client instantiation, development mode logging

**File 17/18:** ✅ `__tests__/lib/db/seed.test.ts`

- **Status:** Complete
- **Description:** Comprehensive seed function tests
- **Coverage:**
  - All seed helper functions (seedAdmin, seedSampleAlerts, etc.)
  - Input validation
  - Error handling
  - Relationship integrity
  - Complete setup workflow

### Documentation

**File 18/18:** ✅ `docs/open-api-documents/part-02-database-schema-openapi.yaml`

- **Status:** Complete
- **Description:** Complete OpenAPI 3.0 specification for database schema
- **Contents:**
  - Enums documented
  - Model schemas with full property definitions
  - Relationship documentation
  - Index specifications
  - Tier access rules (FREE vs PRO)
  - 79-column MarketDataV6 schema detailed
  - Security, affiliate, and disbursement models

---

## 📊 Status Summary

- **Total Files:** 18/18 (100%)
- **Core Database:** 15/15 files ✅ (2 schema files, 2 client singletons, 2 seed files, 9 active SQL migrations)
- **Tests:** 2/2 files ✅
- **Documentation:** 1/1 files ✅

---

## 🗄️ Database Models Overview (34 Total Models)

### User Management & Authentication (8 models)

1. **User** - Core user model with authentication, trial tracking, and 2FA
2. **Account** - OAuth account linking (NextAuth)
3. **Session** - NextAuth session management
4. **UserSession** - Extended session tracking with device, IP, and location metadata (`user_sessions`)
5. **UserPreferences** - User settings and preferences (JSON)
6. **VerificationToken** - Email verification tokens
7. **AccountDeletionRequest** - Account deletion workflow
8. **RefreshToken** - Hashed refresh tokens for persistent authentication session security

### Security & Fraud Detection (3 models)

1. **LoginHistory** - Login attempt tracking (`login_history`)
2. **SecurityAlert** - Security notifications (`security_alerts`)
3. **FraudAlert** - Pattern-based fraud detection and prevention

### Subscription & Payment (2 models)

1. **Subscription** - User subscriptions (Stripe + dLocal)
2. **Payment** - Payment transaction records

### Alerts & Chart Drawings (3 models)

1. **Alert** - Price and indicator alerts
2. **Drawing** - User chart drawing objects (Trendline, Horizontal Line, Channel, Fib Retrace, Fib Ext, Text)
3. **DrawingAlert** - Drawing line-touch alert link and configuration

_(Note: Watchlists and WatchlistItems were eliminated from the product for all tiers)_

### Market Data (1 model)

1. **MarketDataV6** - 79-column schema downstream store for XAUUSD Railway Gateway pipeline (`market_data_v6`)
   - 10 system columns (OHLCV + metadata)
   - 32 centroid-regression columns (best_fit, cherry_a, cherry_b, most_recent, non_a, non_b)
   - 5 fractal EDT columns
   - 3 Z-Score candle columns
   - 11 ZigZag columns
   - 3 provenance columns

### Affiliate Marketing (3 models)

1. **AffiliateProfile** - Affiliate account information and stats
2. **AffiliateCode** - Discount codes and tracking
3. **Commission** - Commission tracking and payments

### Disbursement Systems (10 models)

**Wise Disbursement System (Part 19.5 Active - 5 models):**

1. **AffiliateWiseRecipient** - Wise recipient account details per affiliate
2. **WiseTransfer** - Individual payout transfers via Wise
3. **WiseBatchGroup** - Wise batch payout group container
4. **WiseWebhookEvent** - Inbound Wise webhook event tracking and deduplication
5. **WiseWebhookSubscription** - Wise webhook registration tracking

**RiseWorks Disbursement System (Part 19 Archived/Retained - 5 models):**

1. **AffiliateRiseAccount** - RiseWorks account integration
2. **PaymentBatch** - Batch payment processing
3. **DisbursementTransaction** - Individual payout transactions
4. **RiseWorksWebhookEvent** - RiseWorks webhook event tracking
5. **DisbursementAuditLog** - Audit trail for disbursements

### Modular Monolith Infrastructure (1 model)

1. **OutboxEvent** - Transactional Outbox pattern for decoupled domain event publishing (money-service)

### System Configuration (2 models)

1. **SystemConfig** - Dynamic system settings (affiliate percentages, trial prices)
2. **SystemConfigHistory** - Config change audit trail

### Notifications (1 model)

1. **Notification** - User notifications (alerts, subscriptions, payments, system)

---

## 🔍 Schema Statistics

- **Total Models:** 34 (33 non-market + 1 market data V6)
- **Total Enums:** 22
- **Database Provider:** PostgreSQL
- **ORM:** Prisma 7.x (with PgBouncer driver adapter `@prisma/adapter-pg`)
- **Schema Split:** Two schema files (`prisma/non-market-data/schema.prisma`, `prisma/market-data/schema.prisma`) with distinct client generators
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

### Dual Prisma Schema Architecture

- **Non-market Client (`.prisma/non-market-client`):** Serves app logic, auth, billing, affiliates, alerts, and disbursements via `@/lib/db/prisma` singleton.
- **Market Client (`.prisma/market-client`):** Serves high-throughput `MarketDataV6` queries via `@/lib/db/market-prisma` singleton.

### Multi-Provider Support

- **Stripe:** Primary payment provider (monthly subscriptions)
- **dLocal:** Emerging markets (3-day plans, local payment methods)
- **Wise:** Active primary disbursement provider for affiliate payouts (Part 19.5)
- **RiseWorks:** Archived crypto disbursement provider (retained for restoration capability)

### Security Features

- **Hashed Refresh Tokens (`RefreshToken`):** SHA-256 digested tokens stored at rest
- **Two-Factor Authentication (TOTP):** Encrypted secrets and hashed backup codes
- **Device Tracking:** Browser, OS, geolocation
- **Login History:** Complete audit trail (`login_history`)
- **Fraud Detection:** Pattern-based alerts
- **Session Management:** Extended tracking separate from NextAuth (`user_sessions`)

### Chart Drawing Engine & Line Alerts

- Anchored drawing object storage (price/time coordinate anchors)
- Headless level evaluation and line-touch alert linkage (`DrawingAlert`)

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
- **Multi-Payment Support:** Wise payouts, bank transfer, crypto, local wallets

---

## 📝 Notes

- All models include proper indexing for performance
- Cascading deletes configured where appropriate
- Nullable fields clearly marked for optional data
- JSON fields used for flexible/extensible data (preferences, metadata, payInDetails, stateHistory)
- Unique constraints prevent data duplication
- Cross-domain foreign key constraints removed for modular monolith independence (`20260720000000_drop_money_user_fk_constraints`)

---

## 🔗 Related Documentation

- **Non-Market Schema Definition:** `prisma/non-market-data/schema.prisma`
- **Market Schema Definition:** `prisma/market-data/schema.prisma`
- **OpenAPI Spec:** `docs/open-api-documents/part-02-database-schema-openapi.yaml`
- **Build Order:** `docs/build-orders/part-02-database.md`
- **Type Definitions:** `types/indicator.ts`, `lib/tier/types.ts`
- **Constants:** `lib/tier/constants.ts`

---

**Part 02 Status:** ✅ Complete and production-ready
