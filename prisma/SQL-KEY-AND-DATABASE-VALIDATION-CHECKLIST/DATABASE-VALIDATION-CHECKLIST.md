# Database Validation Checklist

## Trading Alerts SaaS — Final Audit Criteria for Claude Code

> **How to Use This Document:**
> After Claude Code completes any database task, upload this checklist and instruct:
> _"Please validate the database implementation against every item in this checklist. For each item, respond with ✅ PASS, ❌ FAIL, or ⚠️ WARNING with a brief explanation. Produce a final audit report."_

---

## SECTION 1 — Prisma Schema Structure

### 1.1 Primary Keys

- [ ] Every model has exactly **one** `@id` field defined
- [ ] Primary key uses `@default(cuid())` or `@default(uuid())` — NOT `autoincrement()` unless specifically justified
- [ ] No model is missing a primary key field
- [ ] Primary key field is named consistently (e.g., `id` across all models)

### 1.2 Foreign Keys & Relations

- [ ] Every `@relation` has matching `fields` and `references` defined correctly
- [ ] Foreign key field names are consistent (e.g., `userId`, `symbolId`)
- [ ] Every foreign key column has a corresponding `@@index` defined
- [ ] Relation names are provided when two models have multiple relations between them
- [ ] Cascade delete/update behavior is explicitly defined where needed (`onDelete: Cascade`, `onDelete: Restrict`)

### 1.3 Unique Constraints

- [ ] `email` field on User model has `@unique`
- [ ] Any field that must be non-duplicated in business logic has `@unique` or `@@unique`
- [ ] Composite unique constraints use `@@unique([fieldA, fieldB])` syntax correctly
- [ ] No business-critical unique constraint is missing

### 1.4 Indexes

- [ ] Every foreign key field has a `@@index` entry
- [ ] Fields used in `WHERE` clauses frequently have `@@index` (e.g., `symbol`, `status`, `createdAt`)
- [ ] Fields used in `ORDER BY` frequently have `@@index`
- [ ] No redundant index duplicates a unique constraint (wasteful)
- [ ] Composite indexes are in the correct column order (most selective first)

### 1.5 Field Types & Defaults

- [ ] String fields have appropriate length considerations noted in comments
- [ ] Decimal/Float fields use `Decimal` type (not `Float`) for financial/price data
- [ ] All timestamp fields use `DateTime` type
- [ ] `createdAt` uses `@default(now())`
- [ ] `updatedAt` uses `@updatedAt`
- [ ] Boolean fields have explicit `@default(true)` or `@default(false)`
- [ ] Enum types are defined in schema and used where applicable (e.g., plan tiers, alert status)
- [ ] No field uses `String` where a more specific type is appropriate

### 1.6 Nullable vs Required Fields

- [ ] Fields that are genuinely optional are marked with `?` (e.g., `phone String?`)
- [ ] Fields that are always required are NOT nullable
- [ ] No critical field is accidentally nullable

---

## SECTION 2 — PostgreSQL Migration Files

### 2.1 Migration Integrity

- [ ] Migration file was generated via `prisma migrate dev` — NOT manually written
- [ ] Migration filename is descriptive (e.g., `20240101_add_user_table`)
- [ ] No migration file is empty or contains only comments
- [ ] Migration SQL contains `CREATE TABLE` statements for all new models
- [ ] Migration SQL contains `ALTER TABLE` for schema changes (not DROP + recreate unless intentional)

### 2.2 Constraints in SQL

- [ ] `PRIMARY KEY` constraint present in generated SQL for every table
- [ ] `FOREIGN KEY ... REFERENCES` constraint present for all relations
- [ ] `UNIQUE` constraint present for all `@unique` fields
- [ ] `NOT NULL` constraint present for all required (non-nullable) fields
- [ ] `DEFAULT` values are correctly translated from Prisma to SQL

### 2.3 Indexes in SQL

- [ ] `CREATE INDEX` statements exist for all `@@index` definitions
- [ ] `CREATE UNIQUE INDEX` statements exist for all `@@unique` definitions
- [ ] Index names are descriptive and consistent (e.g., `idx_alert_userId`)

### 2.4 Data Safety

- [ ] No `DROP TABLE` in migration unless intentional and confirmed
- [ ] No `DROP COLUMN` without explicit confirmation
- [ ] No destructive migration on a table that already contains data
- [ ] Migration is reversible (down migration exists or is noted as irreversible)

---

## SECTION 3 — Business Logic Validation

### 3.1 User & Authentication Tables

- [ ] User table has: `id`, `email` (unique), `createdAt`, `updatedAt`
- [ ] Password hash field is `String` type (never plain text)
- [ ] Email field has `@unique` constraint
- [ ] Session/token tables have expiry datetime fields
- [ ] User deletion cascades correctly to related data

### 3.2 Subscription & Tier Logic

- [ ] Subscription model is linked to User with `@relation`
- [ ] Plan tier uses Enum (e.g., `FREE`, `PRO`)
- [ ] Only ONE active subscription per user enforced via `@@unique([userId])`
- [ ] Subscription has `status` field (e.g., `ACTIVE`, `CANCELLED`, `EXPIRED`)
- [ ] Payment/billing reference fields are present if needed

### 3.3 Trading Alerts Specific

- [ ] Alert model has `symbol` field with index
- [ ] Alert model linked to User via foreign key with index
- [ ] Alert has `status` field (e.g., `ACTIVE`, `TRIGGERED`, `INACTIVE`)
- [ ] FREE tier symbol limit (5) is enforceable via query (not schema, but logic is noted)
- [ ] PRO tier symbol limit (15) is enforceable via query
- [ ] Alert timestamps (`createdAt`, `triggeredAt`) are present
- [ ] Price/level fields use `Decimal` type not `Float`

### 3.4 Data Integrity Rules

- [ ] A user cannot have alerts without a valid user record (FK enforced)
- [ ] Deleting a user cascades or restricts alert deletion (explicit `onDelete` set)
- [ ] No orphaned records possible based on relation definitions

---

## SECTION 4 — Performance & Scalability

### 4.1 Index Coverage

- [ ] All columns used in JOIN conditions are indexed
- [ ] All columns used in WHERE filters frequently are indexed
- [ ] All columns used for sorting (`ORDER BY createdAt DESC`) are indexed
- [ ] `symbol` column is indexed in alerts/signals table
- [ ] `userId` is indexed in every table that references users
- [ ] `status` fields that are frequently filtered are indexed

### 4.2 Query Performance Red Flags

- [ ] No full-table-scan risk on large tables (check for missing indexes)
- [ ] Pagination-ready fields have indexes (e.g., `createdAt`, `id`)
- [ ] No `SELECT *` patterns noted in any seed or test queries

### 4.3 Connection & Schema

- [ ] Database connection string uses connection pooling (e.g., `?pgbouncer=true` for Railway)
- [ ] `DATABASE_URL` is stored in `.env` — NOT hardcoded anywhere
- [ ] Schema uses appropriate PostgreSQL-specific features where beneficial

---

## SECTION 5 — Security

### 5.1 Sensitive Data

- [ ] No plain text passwords stored anywhere in schema
- [ ] API keys/tokens use `String` type and are never logged
- [ ] Sensitive fields (tokens, secrets) are not exposed in default select queries
- [ ] User PII fields are identified and noted for compliance

### 5.2 SQL Injection Prevention

- [ ] All database queries use Prisma Client (parameterized) — no raw SQL without `$queryRaw` review
- [ ] Any `$queryRaw` or `$executeRaw` usage is reviewed and justified
- [ ] No dynamic table/column names constructed from user input

### 5.3 Access Control Readiness

- [ ] Row-level data is always queryable by `userId` (no cross-user data leakage possible)
- [ ] No query returns data across users without explicit filtering

---

## SECTION 6 — Environment & Configuration

### 6.1 Environment Variables

- [ ] `DATABASE_URL` is defined in `.env` file
- [ ] `.env` is listed in `.gitignore`
- [ ] `.env.example` exists with placeholder values (no real credentials)
- [ ] Railway/production `DATABASE_URL` is separate from local development URL

### 6.2 Prisma Configuration

- [ ] `prisma/schema.prisma` has correct `provider = "postgresql"`
- [ ] `previewFeatures` are only enabled if required and documented
- [ ] `output` path for Prisma Client is correct if customized

### 6.3 Migration State

- [ ] `prisma migrate status` shows no pending migrations
- [ ] Migration history is consistent between local and production
- [ ] `prisma generate` has been run after schema changes
- [ ] Prisma Client version matches schema version

---

## SECTION 7 — Testing & Seed Data

### 7.1 Seed Data

- [ ] `prisma/seed.ts` (or `.js`) exists for development data
- [ ] Seed creates at least one FREE tier user and one PRO tier user
- [ ] Seed creates sample alerts for both tier types
- [ ] Seed is idempotent (can be run multiple times without duplicate errors)
- [ ] Seed uses `upsert` not `create` to prevent duplicate key errors

### 7.2 Schema Tests

- [ ] Unique constraint is tested (attempt to insert duplicate → should fail)
- [ ] Foreign key constraint is tested (attempt to insert orphan record → should fail)
- [ ] Nullable fields accept null without error
- [ ] Required fields reject null without error

---

## SECTION 8 — Documentation

### 8.1 Schema Documentation

- [ ] Each model has a comment explaining its purpose
- [ ] Non-obvious fields have inline comments
- [ ] Enum values have comments explaining each state
- [ ] Relation logic (cascade behavior) is commented

### 8.2 Migration Documentation

- [ ] Each migration file has a descriptive name
- [ ] Breaking migrations have a note explaining the impact
- [ ] A `DATABASE.md` or equivalent file documents the overall schema design

---

## FINAL AUDIT REPORT TEMPLATE

> Instruct Claude Code to complete this report after running the checklist:

```
## Database Audit Report
**Date:** [date]
**Task Completed:** [description]
**Audited By:** Claude Code

### Summary
- Total Checks: XX
- ✅ PASSED: XX
- ❌ FAILED: XX
- ⚠️ WARNINGS: XX

### Failed Items (must fix before deployment)
1. [Section X.X] — [Issue description] — [Recommended fix]

### Warning Items (should fix, not blocking)
1. [Section X.X] — [Issue description] — [Recommended fix]

### Passed Items
[List or confirm all passed]

### Overall Status
[ ] ✅ READY FOR DEPLOYMENT
[ ] ❌ REQUIRES FIXES BEFORE DEPLOYMENT
```

---

_Document Version: 1.0 | Trading Alerts SaaS V7 | Prisma + PostgreSQL_
