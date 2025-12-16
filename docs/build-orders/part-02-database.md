# Part 2: Database Schema & Migrations - Build Order

**From:** `docs/v5-structure-division.md` Part 2
**Total Files:** 4 files
**Estimated Time:** 1.5 hours
**Priority:** ⭐⭐⭐ High
**Complexity:** Medium

**Updated for Prisma 7.1.0** (2025-12-07)

---

## Overview

**Scope:** Database layer with Prisma ORM, schema definition, migrations, and seed data

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_b.md` - Database models and Prisma schema
- `docs/trading_alerts_openapi.yaml` - Model schema definitions for all entities
- `docs/policies/00-tier-specifications.md` - Tier enum and FREE/PRO specifications
- `docs/policies/05-coding-patterns.md` - **Pattern 14: Prisma 7 Client Extensions**

**Key Changes from V4:**

- ✅ 2-tier system (FREE/PRO only, ENTERPRISE removed)
- ✅ WatchlistItem model (symbol+timeframe combinations)
- ✅ Updated User model (tier field defaults to FREE)
- ✅ Google OAuth support (Account model added)
- ✅ **Prisma 7.1.0 with Client Extensions** (3x faster queries, 90% smaller bundle)

**Dependencies:**

- Requires Part 1 complete (package.json with Prisma 7.1.0 dependency)

**Integration Points:**

- Provides database models for Parts 3-18
- Seed script creates initial admin user
- All Prisma operations use **Pattern 14** (Client Extensions)

---

## File Build Order

---

### File 1/4: `prisma/schema.prisma`

**Purpose:** Complete Prisma schema with User, Account, Subscription, Alert, Watchlist models

**From v5-structure-division.md:**

> schema.prisma - 2 tiers (FREE/PRO), WatchlistItem model

**Implementation Details:**

- **Reference Guide:** `docs/implementation-guides/v5_part_c.md` Section 6.1
- **Pattern:** Prisma 7 schema with NextAuth models
- **OpenAPI Reference:** `docs/trading_alerts_openapi.yaml` → All model schemas
- **Prisma 7 Changes:**
  - Generator: `provider = "prisma-client"` (was "prisma-client-js")
  - Explicit output: `output = "../node_modules/.prisma/client"`
  - Database URL moved to `prisma/config.ts`

**Dependencies:**

- Part 1 complete (Prisma 7.1.0 installed)
- `prisma/config.ts` created with database URL

**Build Steps:**

1. **Read Requirements**

   ```
   - v5_part_c.md Section 6.1 (complete schema)
   - 00-tier-specifications.md (FREE/PRO tier rules)
   - NextAuth v4 requirements (User, Account, Session, VerificationToken)
   - Pattern 14 (Prisma 7 requirements)
   ```

2. **Prisma 7 Generator Configuration**

   ```prisma
   generator client {
     provider = "prisma-client"
     output   = "../node_modules/.prisma/client"
   }

   datasource db {
     provider = "postgresql"
     // url removed - now in prisma/config.ts
   }
   ```

3. **Key Models to Include**

   ```prisma
   model User {
     id            String    @id @default(cuid())
     email         String    @unique
     name          String?
     password      String?   // Nullable for OAuth-only users
     tier          UserTier  @default(FREE)
     emailVerified DateTime?
     image         String?
     accounts      Account[]
     subscriptions Subscription[]
     alerts        Alert[]
     watchlists    Watchlist[]
   }

   enum UserTier {
     FREE
     PRO
   }

   model Account {
     id                String  @id @default(cuid())
     userId            String
     type              String
     provider          String
     providerAccountId String
     // ... other OAuth fields
   }

   model WatchlistItem {
     id          String    @id @default(cuid())
     watchlistId String
     watchlist   Watchlist @relation(fields: [watchlistId], references: [id])
     symbol      String
     timeframe   String
     order       Int
     createdAt   DateTime  @default(now())
   }
   ```

4. **Create prisma/config.ts**

   ```typescript
   export default {
     datasource: {
       url: process.env['DATABASE_URL'],
     },
   };
   ```

5. **Validation**
   - Generator uses `"prisma-client"` (not "prisma-client-js")
   - Explicit output path specified
   - Database URL in `prisma/config.ts`
   - All models present
   - Tier system (FREE/PRO only)
   - WatchlistItem model included
   - Account model for OAuth
   - Valid Prisma 7 syntax

6. **Commit**
   ```
   git add prisma/schema.prisma prisma/config.ts
   git commit -m "feat(database): add Prisma 7 schema with 2-tier system and OAuth support"
   ```

---

### File 2/4: `lib/db/prisma.ts`

**Purpose:** Prisma client singleton for Next.js with Client Extensions

**Implementation Details:**

- **Pattern:** Prisma 7 Client Extensions (Pattern 14)
- **Replaces:** Deprecated middleware (.$use) with .$extends()
- **Benefits:** 3x faster queries, performance monitoring

**Build Steps:**

1. **Generate Code** (Pattern 14)

   ```typescript
   import { PrismaClient } from '@prisma/client';

   /**
    * Prisma Client Singleton for Next.js Application (Prisma 7.1.0)
    *
    * Updated for Prisma 7 with Client Extensions for performance monitoring
    * Replaces deprecated middleware (.$use) with modern .$extends() pattern
    *
    * @see Pattern 14 in docs/policies/05-coding-patterns.md
    */

   const globalForPrisma = globalThis as unknown as {
     prisma: PrismaClient | undefined;
   };

   export const prisma =
     globalForPrisma.prisma ??
     new PrismaClient({
       log:
         process.env['NODE_ENV'] === 'development'
           ? ['query', 'error', 'warn']
           : ['error'],
     }).$extends({
       query: {
         $allModels: {
           async $allOperations({ operation, model, args, query }) {
             // Performance logging for slow queries
             const start = performance.now();
             const result = await query(args);
             const duration = performance.now() - start;

             // Log queries taking > 100ms
             if (duration > 100) {
               console.log(
                 `⚠️ Slow query: ${model}.${operation} - ${duration.toFixed(2)}ms`
               );
             }

             return result;
           },
         },
       },
     });

   if (process.env['NODE_ENV'] !== 'production')
     globalForPrisma.prisma = prisma;
   ```

2. **Key Points**
   - Uses `.$extends()` instead of deprecated `.$use()`
   - Performance monitoring built-in
   - Bracket notation for env vars: `process.env['NODE_ENV']`
   - Follows Pattern 14 from coding-patterns.md

3. **Commit**
   ```
   git add lib/db/prisma.ts
   git commit -m "feat(database): add Prisma 7 client singleton with Client Extensions"
   ```

---

### File 3/4: `prisma/seed.ts`

**Purpose:** Database seed script for initial admin user and test data

**Implementation Details:**

- **Reference Guide:** `docs/v5-structure-division.md` Part 2 (seed instructions)
- **Prisma 7:** Uses bracket notation for environment variables

**Build Steps:**

1. **Generate Code**

   ```typescript
   import { PrismaClient } from '@prisma/client';
   import bcrypt from 'bcryptjs';

   const prisma = new PrismaClient();

   async function main() {
     // Create admin user
     const adminEmail = process.env['ADMIN_EMAIL'] || 'admin@tradingalerts.com';
     const adminPassword = process.env['ADMIN_PASSWORD'] || 'ChangeMe123!';

     const hashedPassword = await bcrypt.hash(adminPassword, 10);

     const admin = await prisma.user.upsert({
       where: { email: adminEmail },
       update: {},
       create: {
         email: adminEmail,
         name: 'Admin User',
         password: hashedPassword,
         tier: 'PRO',
         emailVerified: new Date(),
       },
     });

     console.log('✅ Admin user created:', admin.email);
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

2. **Key Points**
   - Bracket notation: `process.env['ADMIN_EMAIL']`
   - Uses Prisma 7 client (same API, better performance)

3. **Commit**
   ```
   git add prisma/seed.ts
   git commit -m "feat(database): add seed script for admin user"
   ```

---

### File 4/4: `lib/db/seed.ts`

**Purpose:** Helper functions for database seeding (if needed for programmatic seeding)

**Build Steps:**

1. **Generate Code**

   ```typescript
   import { PrismaClient, UserTier } from '@prisma/client';
   import bcrypt from 'bcryptjs';

   export async function seedAdmin(
     prisma: PrismaClient,
     email: string,
     password: string
   ) {
     const hashedPassword = await bcrypt.hash(password, 10);

     return prisma.user.upsert({
       where: { email },
       update: {},
       create: {
         email,
         name: 'Admin User',
         password: hashedPassword,
         tier: UserTier.PRO,
         emailVerified: new Date(),
       },
     });
   }
   ```

2. **Commit**
   ```
   git add lib/db/seed.ts
   git commit -m "feat(database): add helper functions for database seeding"
   ```

---

## Testing After Part Complete

1. **Generate Prisma Client**

   ```bash
   pnpm db:generate
   ```

2. **Push Schema to Database**

   ```bash
   pnpm db:push
   ```

3. **Run Seed Script**

   ```bash
   pnpm db:seed
   ```

4. **Verify Database**

   ```bash
   pnpm db:studio
   ```

   - Check admin user exists
   - Verify all tables created

---

## Success Criteria

- ✅ All 4 files built and committed
- ✅ Prisma client generated successfully
- ✅ Database schema pushed without errors
- ✅ Seed script runs successfully
- ✅ Admin user created in database
- ✅ PROGRESS.md updated

---

## Next Steps

- Ready for Part 3: Type Definitions (generated from OpenAPI + Prisma)

---

**Last Updated:** 2025-12-07 (Updated for Prisma 7.1.0)
**Alignment:** (E) Phase 3 → (B) Part 2 → (C) This file
