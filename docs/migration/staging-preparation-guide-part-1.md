# Staging Preparation Guide - Part 20 Migration

**Estimated Time:** 1 hour
**Skill Level:** Beginner-friendly
**Prerequisites:** Basic terminal/command line knowledge
**Purpose:** Set up a staging environment to safely test Part 20 migration and rollback

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites Checklist](#prerequisites-checklist)
3. [Step-by-Step Instructions](#step-by-step-instructions)
4. [Verification](#verification)
5. [Troubleshooting](#troubleshooting)
6. [Success Criteria](#success-criteria)

---

## Overview

### What is Staging?

Staging is a **copy of your production environment** where you can safely test changes without affecting real users. Think of it as a "practice run" before the real migration.

### Why Test in Staging?

- ✅ Catch issues before production
- ✅ Verify rollback works
- ✅ Practice the migration steps
- ✅ Measure actual timing
- ✅ Reduce production risk to near-zero

### What You'll Do

1. Create staging infrastructure (PostgreSQL, Redis)
2. Deploy current code to staging
3. Set up monitoring
4. Verify staging works like production
5. Prepare for rollback testing

---

## Prerequisites Checklist

Before starting, ensure you have:

### Access & Accounts

- [ ] Railway account (or your cloud provider)
- [ ] GitHub repository access
- [ ] SSH access to Contabo VPS (if using MT5 terminals)
- [ ] Admin credentials for your app

### Local Setup

- [ ] Git installed (`git --version`)
- [ ] Node.js installed (`node --version` - should be 18+)
- [ ] PostgreSQL client installed (`psql --version`)
- [ ] Redis CLI installed (`redis-cli --version`)
- [ ] Terminal/command prompt open

### Code Ready

- [ ] Latest code pulled from main branch
- [ ] All tests passing locally (`npm test`)
- [ ] Build succeeds (`npm run build`)

### Time & Resources

- [ ] 1 hour of uninterrupted time
- [ ] Notepad to document results
- [ ] Internet connection stable

**⚠️ If ANY checkbox is unchecked, complete it before proceeding.**

---

## Step-by-Step Instructions

### Phase 1: Create Staging Infrastructure (20 minutes)

#### Step 1.1: Create Staging PostgreSQL Database

**Platform: Railway (example - adapt for your provider)**

1. **Log in to Railway**
   - Go to https://railway.app
   - Click "Login" and authenticate

2. **Create New Project**
   - Click "New Project"
   - Name it: `trading-alerts-staging`
   - Region: Same as production (e.g., US West)

3. **Add PostgreSQL Service**
   - Click "+ New"
   - Select "Database" → "PostgreSQL"
   - Wait for deployment (2-3 minutes)

4. **Install TimescaleDB Extension**
   - Click on the PostgreSQL service
   - Go to "Connect" tab
   - Copy the connection string (save it!)
   - Open your terminal:

   ```bash
   # Connect to staging database
   psql "postgresql://postgres:[password]@[host]:5432/railway"

   # Install TimescaleDB extension
   CREATE EXTENSION IF NOT EXISTS timescaledb;

   # Verify installation
   \dx

   # You should see timescaledb in the list
   # Exit
   \q
   ```

   **Expected Output:**

   ```
   CREATE EXTENSION

   List of installed extensions
   Name         | Version | Schema
   -------------|---------|--------
   timescaledb  | 2.x.x   | public
   ```

5. **Save Connection Details**

   Create a file: `staging-credentials.txt` (keep this secure!)

   ```
   STAGING_POSTGRESQL_URI=postgresql://postgres:[password]@[host]:5432/railway
   ```

**✅ Checkpoint:** You have a staging PostgreSQL database with TimescaleDB.

---

#### Step 1.2: Create Staging Redis

1. **Add Redis Service to Railway**
   - In same `trading-alerts-staging` project
   - Click "+ New"
   - Select "Database" → "Redis"
   - Wait for deployment (1-2 minutes)

2. **Get Redis Connection URL**
   - Click on Redis service
   - Go to "Connect" tab
   - Copy the Redis URL

3. **Test Connection**

   ```bash
   redis-cli -u "redis://default:[password]@[host]:6379"

   # Test with PING command
   PING

   # Expected response: PONG

   # Exit
   quit
   ```

   **Expected Output:**

   ```
   PONG
   ```

4. **Save Connection Details**

   Add to `staging-credentials.txt`:

   ```
   STAGING_REDIS_URL=redis://default:[password]@[host]:6379
   ```

**✅ Checkpoint:** You have staging PostgreSQL and Redis ready.

---

### Phase 2: Deploy Database Schema to Staging (15 minutes)

#### Step 2.1: Prepare Schema Files

1. **Check if Schema Files Exist**

   ```bash
   ls -la prisma/schema.prisma
   ls -la docs/sqlite-and-mt5service/part-20-schema.sql
   ```

   **If files exist:** ✅ Proceed to next step
   **If files missing:** ⚠️ You need to complete Part 20 Phases 1-8 first

2. **Set Staging Environment Variables**

   ```bash
   # Create a staging environment file
   cat > .env.staging <<EOF
   POSTGRESQL_URI=$STAGING_POSTGRESQL_URI
   REDIS_URL=$STAGING_REDIS_URL
   NODE_ENV=staging
   EOF

   # Load staging variables
   export $(cat .env.staging | xargs)
   ```

3. **Verify Environment Variables**

   ```bash
   echo $POSTGRESQL_URI
   echo $REDIS_URL
   ```

   **Expected:** Should print your staging database URLs

**✅ Checkpoint:** Environment configured for staging.

---

#### Step 2.2: Create Database Tables

1. **Run Prisma Migrations**

   ```bash
   # Generate Prisma client
   npx prisma generate

   # Push schema to staging database
   npx prisma db push
   ```

   **Expected Output:**

   ```
   🚀  Your database is now in sync with your Prisma schema.

   ✔ Generated Prisma Client
   ```

2. **Verify Tables Created**

   ```bash
   psql $POSTGRESQL_URI -c "
   SELECT tablename
   FROM pg_tables
   WHERE schemaname='public'
   ORDER BY tablename;
   "
   ```

   **Expected Output:** List of tables including:
   - User tables (users, accounts, sessions)
   - Alert tables (alerts, alert_logs)
   - Indicator tables (135 tables like eurusd_h1, btcusd_m5, etc.)

3. **Count Indicator Tables**

   ```bash
   psql $POSTGRESQL_URI -c "
   SELECT COUNT(*) as indicator_tables
   FROM pg_tables
   WHERE schemaname='public'
   AND tablename LIKE '%_m5'
      OR tablename LIKE '%_h1'
      OR tablename LIKE '%_h4'
      OR tablename LIKE '%_d1';
   "
   ```

   **Expected Output:**

   ```
    indicator_tables
   ------------------
                  135
   ```

   **If not 135:** Check if all symbol×timeframe tables were created.

**✅ Checkpoint:** All database tables created in staging.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-07
**Next Review:** After rollback testing
