# Prisma V6 Upgrade & Railway Migration Reference

**Last Updated:** 2026-02-14
**Project:** Trading Alerts SaaS V7
**Purpose:** Reference document for current Prisma status and future upgrades/modifications/migrations

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Prisma Upgrade: V5.22 → V6.19.2](#2-prisma-upgrade-v522--v6192)
3. [Database: PostgreSQL on Railway](#3-database-postgresql-on-railway)
4. [Prisma Schema Overview](#4-prisma-schema-overview)
5. [Prisma Client Configuration](#5-prisma-client-configuration)
6. [Package Scripts Reference](#6-package-scripts-reference)
7. [Migration from Vercel to Railway](#7-migration-from-vercel-to-railway)
8. [Deployment Configuration](#8-deployment-configuration)
9. [Authentication & Prisma Adapter](#9-authentication--prisma-adapter)
10. [Troubleshooting & Known Issues Fixed](#10-troubleshooting--known-issues-fixed)
11. [Future Upgrade Checklist](#11-future-upgrade-checklist)

---

## 1. Current State Summary

| Item                          | Value                                       |
| ----------------------------- | ------------------------------------------- |
| **Prisma Version**            | `6.19.2`                                    |
| **@prisma/client**            | `^6.19.2`                                   |
| **@next-auth/prisma-adapter** | `^1.0.7`                                    |
| **Database**                  | PostgreSQL (Railway managed)                |
| **Schema File**               | `prisma/schema.prisma` (1086 lines)         |
| **Migrations**                | 1 initial migration (`20251227000000_init`) |
| **Tables**                    | 34 tables, 15 ENUM types                    |
| **Generator**                 | `prisma-client-js`                          |
| **Client Output**             | `../node_modules/.prisma/client`            |
| **App Deployment**            | Railway (container, persistent)             |
| **Previous Deployment**       | Vercel (serverless)                         |
| **Build System**              | NIXPACKS via `railway.json`                 |
| **Package Manager**           | npm (pnpm also supported)                   |

---

## 2. Prisma Upgrade: V5.22 → V6.19.2

### What Changed

| Area                 | V5 Behavior                   | V6 Behavior                             |
| -------------------- | ----------------------------- | --------------------------------------- |
| **Client location**  | `node_modules/.prisma/client` | Same (no change)                        |
| **Breaking changes** | —                             | `relationLoadStrategy`, `omit` field GA |
| **Performance**      | Standard                      | Improved query engine                   |
| **TypeScript**       | Strict types                  | Stricter generic inference              |

### Upgrade Commits

```
00a39b7  chore: upgrade Prisma from v5.22 to v6.19.2
0cf0467  fix: sync Prisma v6.19.2 across frontend package.json and lockfile
```

### Files Modified During Upgrade

| File                    | Change                                  |
| ----------------------- | --------------------------------------- |
| `package.json`          | `prisma` + `@prisma/client` → `^6.19.2` |
| `frontend/package.json` | Same, synced to `6.19.2`                |
| `package-lock.json`     | Regenerated for v6 dependencies         |

### Upgrade Command Used

```bash
npm install prisma@^6.19.2 @prisma/client@^6.19.2 --save-dev
npx prisma generate
```

### Post-Upgrade Validation

```bash
npm run type-check   # prisma generate + tsc --noEmit
npm run test:quick   # jest --bail --passWithNoTests
```

Both passed with zero errors after upgrade.

---

## 3. Database: PostgreSQL on Railway

### Connection String Format

```
postgresql://postgres:<PASSWORD>@<HOST>.proxy.rlwy.net:<PORT>/railway
```

### Environment Variables

| Variable         | Purpose                      | Where Set                          |
| ---------------- | ---------------------------- | ---------------------------------- |
| `DATABASE_URL`   | Primary Prisma connection    | Railway dashboard / `.env.staging` |
| `POSTGRESQL_URI` | TimescaleDB (future Part 20) | Railway dashboard                  |

### Staging Environment (`.env.staging`)

```env
DATABASE_URL=postgresql://postgres:<PASSWORD>@<HOST>.proxy.rlwy.net:<PORT>/railway
```

> **Note:** `.env.staging` is committed with staging credentials only.
> Production credentials are managed exclusively via Railway environment dashboard — never committed to the repo.

### Connection Pool Behavior

- **Railway container:** Persistent long-running process — connection pool is reused across requests.
- **Development:** PrismaClient singleton pattern prevents connection exhaustion during hot reloads.

```typescript
// lib/db/prisma.ts — Singleton pattern
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

---

## 4. Prisma Schema Overview

**File:** `prisma/schema.prisma`

### Generator Block

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client"
}
```

### Datasource Block

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Table Inventory (34 Tables)

| Category                   | Tables                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Auth / Users**           | `User`, `Account`, `Session`, `VerificationToken`, `UserSession`, `LoginHistory`, `SecurityAlert`                  |
| **Subscriptions**          | `Subscription`, `Payment`, `FraudAlert`                                                                            |
| **Alerts & Market Data**   | `Alert`, `Watchlist`, `WatchlistItem`, `MarketData` (61-column flat schema, EA v2.27+)                             |
| **User Settings**          | `UserPreferences`, `AccountDeletionRequest`, `Notification`                                                        |
| **Affiliate System**       | `AffiliateProfile`, `AffiliateCode`, `Commission`                                                                  |
| **Disbursement (Part 19)** | `AffiliateRiseAccount`, `PaymentBatch`, `DisbursementTransaction`, `RiseWorksWebhookEvent`, `DisbursementAuditLog` |
| **System**                 | `SystemConfig`, `SystemConfigHistory`                                                                              |

### ENUM Types (15)

`UserTier`, `SubscriptionStatus`, `TrialStatus`, `AffiliateStatus`, `CodeStatus`, `DistributionReason`, `CommissionStatus`, `FraudAlertStatus`, `FraudAlertSeverity`, `NotificationType`, `NotificationPriority`, `LoginStatus`, `SecurityAlertType`, `RiseWorksKycStatus`, `PaymentBatchStatus`, `DisbursementTransactionStatus`, `DisbursementProvider`, `AuditLogStatus`

### Migration History

| Migration             | Date       | Contents                                                               |
| --------------------- | ---------- | ---------------------------------------------------------------------- |
| `20251227000000_init` | 2025-12-27 | Full initial schema — 928 lines, all 34 tables, all ENUMs, all indexes |

> There is currently **one migration only**. All schema changes to date have been applied via `prisma db push` (dev) or are included in the init migration.

---

## 5. Prisma Client Configuration

### Generation

Prisma client is generated automatically before every build:

```json
// package.json
"prebuild": "(rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma || true) && prisma generate"
```

Key details:

- The `|| true` is intentional — makes the `rm` non-fatal so Railway container builds do not fail if the directory doesn't exist.
- Client is regenerated fresh on every Railway deploy.

### Import Path

```typescript
import { prisma } from '@/lib/db/prisma';
```

---

## 6. Package Scripts Reference

### Prisma / Database Scripts

```bash
# Generate Prisma client (runs automatically via prebuild)
npm run prisma:generate
npm run db:generate        # alias

# Development: create new migration + apply
npm run db:migrate         # prisma migrate dev

# Production: apply pending migrations only
npm run prisma:migrate     # prisma migrate deploy

# Push schema directly (no migration file, dev only)
npm run db:push            # prisma db push

# Seed the database
npm run db:seed            # ts-node prisma/seed.ts

# Open Prisma Studio (local GUI)
npm run db:studio          # prisma studio
```

### Build & Validation

```bash
npm run build              # prebuild (generate + clean) + next build
npm run type-check         # prisma generate + tsc --noEmit
npm run validate           # TypeScript + ESLint + Prettier + policy checks
npm run test:quick         # jest --bail --passWithNoTests
```

---

## 7. Migration from Vercel to Railway

### Why Railway

| Concern                    | Vercel (Serverless)                                | Railway (Container)                     |
| -------------------------- | -------------------------------------------------- | --------------------------------------- |
| **Connection pool**        | Cold starts reset pool                             | Persistent pool, always warm            |
| **Prisma compatibility**   | Requires connection pooling workaround (PgBouncer) | Native PostgreSQL, no workaround needed |
| **Build control**          | Managed by Vercel                                  | Full control via NIXPACKS               |
| **Long-running processes** | Not supported                                      | Supported natively                      |
| **Database proximity**     | External DB required                               | DB co-located on Railway                |

### What Vercel Config Still Does

`vercel.json` is still present in the repo and is not removed. It serves as a **build skip guard** for Claude development branches:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "if [[ \"$VERCEL_GIT_COMMIT_REF\" == claude/* ]] || [[ \"$VERCEL_GIT_COMMIT_REF\" == docs/* ]]; then exit 0; else exit 1; fi"
}
```

This causes Vercel to skip builds for any `claude/*` or `docs/*` branch. No Vercel truncation/cleanup was required.

### Railway Configuration Added

**`railway.json`** (root level):

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "pnpm run start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**`nixpacks.toml`** (root level):

```toml
[phases.build]
cacheDirectories = [".next/cache", "node_modules/.cache"]
```

> **Why `nixpacks.toml` was needed:** Without it, NIXPACKS auto-scanned the entire repo and failed because `seed-code/` directories contain folder names with spaces, which broke the builder. The config file forces NIXPACKS to use the defined build phase only.

**`.dockerignore`** (expanded):

Added entries to prevent NIXPACKS from copying large irrelevant directories into the build context:

```
seed-code/
archive/
coverage/
docs/
```

### Deployment Commits

```
35cb0f0  chore: add Railway deployment config (railway.json)
3089abc  fix: make prebuild rm non-fatal for Railway container compatibility
3e4c0f8  fix: add nixpacks.toml + expand .dockerignore to fix Railway build
```

---

## 8. Deployment Configuration

### Railway Build Process

```
1. GitHub push to main
       ↓
2. Railway detects push
       ↓
3. NIXPACKS builds container
   - Installs dependencies (npm/pnpm)
   - Runs: (rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma || true) && prisma generate
   - Runs: next build
       ↓
4. Container starts: pnpm run start
       ↓
5. Health check: GET / (300s timeout)
       ↓
6. Live — restarts ON_FAILURE (max 10 retries)
```

### Environment Variables (Railway Dashboard)

Must be set in Railway project settings — never in committed files:

```
DATABASE_URL           PostgreSQL connection string
NEXTAUTH_URL           https://your-app.railway.app
NEXTAUTH_SECRET        Random 32+ char secret
GOOGLE_CLIENT_ID       (if Google OAuth enabled)
GOOGLE_CLIENT_SECRET   (if Google OAuth enabled)
STRIPE_SECRET_KEY      (if payments enabled)
STRIPE_WEBHOOK_SECRET  (if payments enabled)
```

### Next.js Config — Deployment-Relevant Settings

```javascript
// next.config.js
images: {
  domains: [
    'lh3.googleusercontent.com', // Google OAuth avatars
    'avatars.githubusercontent.com', // GitHub OAuth avatars
    '*.vercel.app', // Vercel preview deploys
    '*.railway.app', // Railway deployments
  ];
}
```

---

## 9. Authentication & Prisma Adapter

### Stack

| Component        | Package                     | Version   |
| ---------------- | --------------------------- | --------- |
| Auth framework   | `next-auth`                 | `^4.24.5` |
| Prisma adapter   | `@next-auth/prisma-adapter` | `^1.0.7`  |
| Session strategy | JWT                         | —         |

### Custom Adapter Behavior

The standard `PrismaAdapter` is wrapped with custom logic in `lib/auth/auth-options.ts`:

```typescript
const baseAdapter = PrismaAdapter(prisma);

// Custom createUser sets defaults for OAuth sign-ups
createUser: async (data) => {
  return baseAdapter.createUser({
    ...data,
    tier: 'FREE',
    role: 'USER',
    emailVerified: new Date(), // Auto-verify OAuth users
  });
};
```

### Prisma Models Used by NextAuth

| Model               | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `User`              | Core user record                                           |
| `Account`           | OAuth provider linkage (Google, Twitter, LinkedIn)         |
| `Session`           | (Unused with JWT strategy, kept for adapter compatibility) |
| `VerificationToken` | Email verification tokens                                  |

### Auth Providers

| Provider    | Requires ENV                                   | Notes                                       |
| ----------- | ---------------------------------------------- | ------------------------------------------- |
| Google      | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`     | Conditional — only active if vars set       |
| Twitter/X   | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`   | Conditional                                 |
| LinkedIn    | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Conditional                                 |
| Credentials | —                                              | Email + bcryptjs password, 2FA/TOTP support |

---

## 10. Troubleshooting & Known Issues Fixed

### Issue 1: Railway Build Failed — Directory Names with Spaces

**Symptom:** NIXPACKS failed during auto-scan of `seed-code/` subdirectories containing spaces in folder names.

**Fix:** Added `nixpacks.toml` to define explicit build phase, bypassing auto-scan. Also expanded `.dockerignore` to exclude `seed-code/`, `archive/`, `coverage/`, `docs/`.

**Commit:** `3e4c0f8`

---

### Issue 2: Railway Build Failed — `rm -rf` Error

**Symptom:** `prebuild` script ran `rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma` — if those directories didn't exist in a fresh container, the command failed with non-zero exit, aborting the build.

**Fix:** Appended `|| true` to make the `rm` non-fatal:

```json
"prebuild": "(rm -rf .next tsconfig.tsbuildinfo node_modules/.prisma || true) && prisma generate"
```

**Commit:** `3089abc`

---

### Issue 3: Prisma V6 TypeScript Inference Stricter

**Symptom:** After upgrading to V6, some TypeScript usages that passed under V5 gave type errors due to stricter generic inference.

**Fix:** Ran `npm run type-check` after upgrade, fixed all type errors before merging PR.

---

### Issue 4: `.env.production.backup` Contained Plaintext Credentials

**Symptom:** A backup of the production `.env` file containing live database password and MT5 credentials was committed to the repo.

**Fix:** File was deleted and change pushed.

**Commit:** `abc65c8`

> **Action recommended:** Rotate any credentials (database password, MT5 account password) that appeared in the deleted file.

---

## 11. Future Upgrade Checklist

Use this checklist for any future Prisma upgrade or schema migration.

### Prisma Version Upgrade

```
[ ] Check Prisma changelog for breaking changes
    https://github.com/prisma/prisma/releases

[ ] Update package.json:
    "prisma": "^X.Y.Z"
    "@prisma/client": "^X.Y.Z"

[ ] Run: npm install

[ ] Regenerate client: npx prisma generate

[ ] Run type check: npm run type-check

[ ] Run tests: npm run test:quick

[ ] Update frontend/package.json to same version (keep in sync)

[ ] Commit both package.json files and lockfile together

[ ] Verify Railway build succeeds after push
```

### Adding a New Migration

```
[ ] Modify prisma/schema.prisma

[ ] Development — create migration:
    npm run db:migrate
    (generates prisma/migrations/<timestamp>_<name>/migration.sql)

[ ] Review generated SQL before applying

[ ] Production — deploy migration via Railway:
    npx prisma migrate deploy
    (or set as Railway start command temporarily)

[ ] Verify migration applied:
    npx prisma migrate status

[ ] Update this document's migration history table
```

### Schema Change Rules

| Operation                          | Safe?          | Notes                                             |
| ---------------------------------- | -------------- | ------------------------------------------------- |
| Add optional field                 | ✅ Safe        | No data loss                                      |
| Add required field with default    | ✅ Safe        | Default fills existing rows                       |
| Add required field without default | ⚠️ Careful     | Must provide value for existing rows              |
| Rename field                       | ❌ Breaking    | Prisma treats as drop + add — handle with raw SQL |
| Drop field                         | ❌ Destructive | Confirm data can be lost                          |
| Add table                          | ✅ Safe        | —                                                 |
| Drop table                         | ❌ Destructive | Confirm data can be lost                          |
| Change field type                  | ⚠️ Careful     | May require data migration                        |

### Railway Deployment Checklist

```
[ ] All new ENV vars added to Railway dashboard before deploying

[ ] prisma migrate deploy runs before app starts
    (can add as Railway pre-deploy command or include in start script)

[ ] Health check path (GET /) returns 200

[ ] Verify DATABASE_URL is correct in Railway environment

[ ] Check Railway build logs for NIXPACKS errors
    (if new dirs added to repo, update .dockerignore if needed)
```

---

## Document History

| Date       | Author      | Change                                                                           |
| ---------- | ----------- | -------------------------------------------------------------------------------- |
| 2026-02-14 | Claude Code | Initial document created — captures Prisma v6.19.2 upgrade and Railway migration |

---

_This document should be updated whenever Prisma is upgraded, schema is migrated, or deployment configuration changes._
