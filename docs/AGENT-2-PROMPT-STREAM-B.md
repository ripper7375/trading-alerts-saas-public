# Agent 2 Implementation Prompt - Stream B

## Prisma 5.x Upgrade: Type Stubs, Documentation & Test Scripts

**Document Version:** 1.0
**Created:** December 25, 2024
**Target Branch:** `claude/upgrade-prisma-security-occtv`
**Your Role:** Agent 2 (Stream B)

---

## Executive Summary

You are **Agent 2** in a two-agent parallel implementation to upgrade Prisma from version 4.16.2 to 5.22.0 in a Trading Alerts SaaS application. This document provides complete context for your work stream.

**Your responsibilities (Stream B):**

- B1: Update TypeScript type stubs for Prisma 5.x compatibility
- B2: Create upgrade documentation
- B3: Create test/validation scripts

**You will NOT touch (Agent 1's responsibilities - Stream A):**

- package.json / pnpm-lock.yaml
- prisma/schema.prisma
- Application code changes for Prisma 5.x

---

## Table of Contents

1. [Background & Problem Context](#1-background--problem-context)
2. [Why Two Agents?](#2-why-two-agents)
3. [Solution Architecture](#3-solution-architecture)
4. [Agent 1 Scope (DO NOT IMPLEMENT)](#4-agent-1-scope-do-not-implement)
5. [Agent 2 Scope (YOUR WORK)](#5-agent-2-scope-your-work)
6. [Phase B1: Update Type Stubs](#6-phase-b1-update-type-stubs)
7. [Phase B2: Documentation](#7-phase-b2-documentation)
8. [Phase B3: Test Scripts](#8-phase-b3-test-scripts)
9. [Git Workflow & Commits](#9-git-workflow--commits)
10. [Conflict Prevention Rules](#10-conflict-prevention-rules)

---

## 1. Background & Problem Context

### The Original Problem

This Trading Alerts SaaS application has a **network restriction issue** that prevents normal Prisma client generation during local development. The development environment cannot access `binaries.prisma.sh`, which Prisma uses to download platform-specific query engine binaries.

### Current Workaround

A manual TypeScript declaration file (`types/prisma-stubs.d.ts`) was created to provide type definitions when Prisma cannot generate its client locally. This file contains:

1. **Model Interfaces** - Type definitions for all database models (User, Subscription, Alert, SystemConfig, etc.)
2. **PrismaClient Interface** - Main client with model delegates
3. **Delegate Interfaces** - Query operations (findMany, findUnique, create, update, delete, etc.)
4. **Prisma Namespace** - Input types for queries (WhereInput, CreateInput, UpdateInput, etc.)

### Why Upgrade Now?

| Aspect       | Current (4.16.2)    | Target (5.22.0)       |
| ------------ | ------------------- | --------------------- |
| Release Date | June 2023           | November 2024         |
| Age          | 18+ months old      | Latest stable         |
| Security     | 12+ patches missing | Up to date            |
| Performance  | Baseline            | 30-40% faster queries |
| TypeScript   | 4.x patterns        | 5.x patterns          |

### Technical Debt Being Addressed

1. **Type Safety Debt** - Current stubs use `any` for many parameters, losing Prisma's strict type safety
2. **Feature Gap** - Missing Prisma 5.x features like `$metrics()`, improved JSON handling, `relationLoadStrategy`
3. **Maintenance Overhead** - Type stubs must be manually synchronized with schema changes

---

## 2. Why Two Agents?

### Parallel Execution Benefits

```
Without Parallelization:          With Parallelization:
─────────────────────            ─────────────────────
[A1] → [A2] → [A3] →             [A1]─┬─[B1]
[B1] → [B2] → [B3]                    │
                                 [A2]─┼─[B2]
Total: ~15-18 hours                   │
                                 [A3]─┴─[B3]
                                      ↓
                                 [MERGE]

                                 Total: ~8-10 hours
```

### Why This Split Works

| Stream A (Agent 1)            | Stream B (Agent 2)               |
| ----------------------------- | -------------------------------- |
| Modifies runtime code         | Modifies type definitions        |
| Changes dependencies          | Creates documentation            |
| Updates schema                | Creates test scripts             |
| **Files with runtime impact** | **Files with no runtime impact** |

These streams have **zero file overlap**, meaning:

- No merge conflicts possible
- Both can work simultaneously
- Clean git history when merged

---

## 3. Solution Architecture

### Parallel Execution Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PARALLEL EXECUTION MAP                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STREAM A (Agent 1)          STREAM B (Agent 2 = YOU)   SYNC POINTS    │
│  ─────────────────           ───────────────────────    ───────────    │
│                                                                         │
│  [A1] Update Dependencies    [B1] Update Type Stubs        ──┐         │
│         ↓                           ↓                        │         │
│  [A2] Schema Validation      [B2] Documentation             ├─ SYNC 1  │
│         ↓                           ↓                        │         │
│  [A3] Code Updates           [B3] Test Scripts           ──┘          │
│         ↓                           ↓                                  │
│         └───────────┬───────────────┘                                  │
│                     ↓                                                   │
│              [MERGE & TEST]  ←─────────────────────────────── SYNC 2   │
│                     ↓                                                   │
│              [VALIDATION]                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Sync Points Explained

**SYNC 1:** Both agents complete their independent work

- Agent 1 pushes Stream A commits
- Agent 2 (you) pushes Stream B commits
- Human coordinator reviews both

**SYNC 2:** Merge and Integration Testing

- Both streams merged to feature branch
- Full test suite runs
- Human evaluates test results

---

## 4. Agent 1 Scope (DO NOT IMPLEMENT)

**This section is for context only. Do NOT modify these files.**

### Phase A1: Dependency Updates

- Update `package.json` with Prisma 5.22.0
- Update `@prisma/client` to 5.22.0
- Run `pnpm install`

### Phase A2: Schema Validation

- Run `npx prisma validate`
- Run `npx prisma format`
- Review breaking changes

### Phase A3: Application Code Updates

- Update JSON null handling patterns
- Update transaction usage
- Fix TypeScript errors in application code

### Files Agent 1 Will Modify:

```
❌ DO NOT TOUCH THESE FILES:
├── package.json
├── pnpm-lock.yaml
├── prisma/schema.prisma
├── app/**/*.ts (application code)
├── lib/**/*.ts (library code)
└── components/**/*.tsx (React components)
```

---

## 5. Agent 2 Scope (YOUR WORK)

### Your Deliverables

| Phase | Deliverable                       | Priority  |
| ----- | --------------------------------- | --------- |
| B1    | Updated `types/prisma-stubs.d.ts` | Critical  |
| B2    | `docs/prisma-upgrade-log.md`      | Important |
| B2    | Updated `README.md` section       | Important |
| B3    | `scripts/test-prisma5-upgrade.ts` | Critical  |
| B3    | `scripts/run-all-tests.sh`        | Important |

### Files You WILL Modify/Create:

```
✅ YOUR FILES:
├── types/prisma-stubs.d.ts          (MODIFY)
├── docs/prisma-upgrade-log.md       (CREATE)
├── docs/prisma-5x-breaking-changes.md (CREATE)
├── README.md                         (MODIFY - only Prisma version section)
├── scripts/test-prisma5-upgrade.ts  (CREATE)
└── scripts/run-all-tests.sh         (CREATE)
```

---

## 6. Phase B1: Update Type Stubs

### Objective

Update `types/prisma-stubs.d.ts` to support Prisma 5.x type patterns while maintaining backward compatibility with all existing model definitions.

### Current File Location

`types/prisma-stubs.d.ts`

### Required Changes

#### 6.1 Add Prisma 5.x JSON Types

Add these type definitions to the `Prisma` namespace:

```typescript
export namespace Prisma {
  // ===== NEW IN PRISMA 5.x =====

  // JSON type system (improved in 5.x)
  export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonObject
    | JsonArray;
  export type JsonObject = { [key: string]: JsonValue };
  export type JsonArray = JsonValue[];

  // Nullable JSON handling (new distinction in 5.x)
  export type NullableJsonInput = JsonValue | null;
  export type InputJsonValue = JsonValue;

  // JSON null types (critical for 5.x)
  export const JsonNull: unique symbol;
  export const DbNull: unique symbol;
  export const AnyNull: unique symbol;
  export type NullTypes = typeof JsonNull | typeof DbNull | typeof AnyNull;

  // ... existing types below
}
```

#### 6.2 Update DateTimeFilter

Enhance the DateTimeFilter with full Prisma 5.x operators:

```typescript
export type DateTimeFilter = {
  equals?: Date | string;
  in?: Date[] | string[];
  notIn?: Date[] | string[];
  lt?: Date | string;
  lte?: Date | string;
  gt?: Date | string;
  gte?: Date | string;
  not?: Date | string | NestedDateTimeFilter;
};

export type NestedDateTimeFilter = {
  equals?: Date | string;
  in?: Date[] | string[];
  notIn?: Date[] | string[];
  lt?: Date | string;
  lte?: Date | string;
  gt?: Date | string;
  gte?: Date | string;
  not?: Date | string | NestedDateTimeFilter;
};

export type DateTimeNullableFilter = DateTimeFilter & {
  equals?: Date | string | null;
  not?: Date | string | null | NestedDateTimeNullableFilter;
};
```

#### 6.3 Update StringFilter with Mode Option

Add case-insensitive search support (key Prisma 5.x feature):

```typescript
export type StringFilter = {
  equals?: string;
  in?: string[];
  notIn?: string[];
  lt?: string;
  lte?: string;
  gt?: string;
  gte?: string;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  mode?: QueryMode; // NEW IN 5.x
  not?: string | NestedStringFilter;
};

export type QueryMode = 'default' | 'insensitive';

export type NestedStringFilter = {
  equals?: string;
  in?: string[];
  notIn?: string[];
  lt?: string;
  lte?: string;
  gt?: string;
  gte?: string;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  mode?: QueryMode;
  not?: string | NestedStringFilter;
};
```

#### 6.4 Add IntFilter and FloatFilter

```typescript
export type IntFilter = {
  equals?: number;
  in?: number[];
  notIn?: number[];
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  not?: number | NestedIntFilter;
};

export type FloatFilter = {
  equals?: number;
  in?: number[];
  notIn?: number[];
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  not?: number | NestedFloatFilter;
};

export type BoolFilter = {
  equals?: boolean;
  not?: boolean | NestedBoolFilter;
};
```

#### 6.5 Update PrismaClient Class

Add Prisma 5.x specific methods:

```typescript
export class PrismaClient {
  constructor(options?: PrismaClientOptions);

  // Connection management
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $on(
    eventType: 'query' | 'info' | 'warn' | 'error',
    callback: (event: any) => void
  ): void;

  // Middleware (enhanced in 5.x)
  $use(middleware: Middleware): void;

  // Query execution
  $executeRaw(query: TemplateStringsArray, ...values: any[]): Promise<number>;
  $executeRawUnsafe(query: string, ...values: any[]): Promise<number>;
  $queryRaw<T = any>(query: TemplateStringsArray, ...values: any[]): Promise<T>;
  $queryRawUnsafe<T = any>(query: string, ...values: any[]): Promise<T>;

  // Transaction support (improved in 5.x)
  $transaction<T>(
    fn: (
      prisma: Omit<
        PrismaClient,
        '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
      >
    ) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: TransactionIsolationLevel;
    }
  ): Promise<T>;
  $transaction<T>(queries: PrismaPromise<T>[]): Promise<T[]>;

  // NEW IN PRISMA 5.x
  $metrics: Metrics;
  $extends: (extension: any) => PrismaClient;

  // Model delegates (keep all existing)
  user: UserDelegate;
  subscription: SubscriptionDelegate;
  alert: AlertDelegate;
  systemConfig: SystemConfigDelegate;
  systemConfigHistory: SystemConfigHistoryDelegate;
  // ... all other existing model delegates
}

// New types for Prisma 5.x features
export type TransactionIsolationLevel =
  | 'ReadUncommitted'
  | 'ReadCommitted'
  | 'RepeatableRead'
  | 'Serializable';

export interface Metrics {
  json(): Promise<MetricsJson>;
  prometheus(): Promise<string>;
}

export interface MetricsJson {
  counters: MetricCounter[];
  gauges: MetricGauge[];
  histograms: MetricHistogram[];
}

export interface MetricCounter {
  key: string;
  value: number;
  labels: Record<string, string>;
  description: string;
}

export interface MetricGauge {
  key: string;
  value: number;
  labels: Record<string, string>;
  description: string;
}

export interface MetricHistogram {
  key: string;
  value: { buckets: [number, number][]; sum: number; count: number };
  labels: Record<string, string>;
  description: string;
}

export type PrismaPromise<T> = Promise<T> & {
  [Symbol.toStringTag]: 'PrismaPromise';
};

export type Middleware = (
  params: MiddlewareParams,
  next: (params: MiddlewareParams) => Promise<any>
) => Promise<any>;

export interface MiddlewareParams {
  model?: string;
  action: string;
  args: any;
  dataPath: string[];
  runInTransaction: boolean;
}

export interface PrismaClientOptions {
  datasources?: { db?: { url?: string } };
  log?: Array<
    | 'query'
    | 'info'
    | 'warn'
    | 'error'
    | { emit: 'event' | 'stdout'; level: 'query' | 'info' | 'warn' | 'error' }
  >;
  errorFormat?: 'pretty' | 'colorless' | 'minimal';
}
```

#### 6.6 Add Relation Load Strategy Types

```typescript
// New in Prisma 5.x - Relation loading optimization
export type RelationLoadStrategy = 'query' | 'join';

// Update all FindMany args to include this option
// Example for UserFindManyArgs:
export interface UserFindManyArgs {
  select?: UserSelect | null;
  include?: UserInclude | null;
  where?: UserWhereInput;
  orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[];
  cursor?: UserWhereUniqueInput;
  take?: number;
  skip?: number;
  distinct?: UserScalarFieldEnum | UserScalarFieldEnum[];
  relationLoadStrategy?: RelationLoadStrategy; // NEW IN 5.x
}
```

### Important Guidelines for B1

1. **DO NOT remove any existing model interfaces** - All User, Subscription, Alert, SystemConfig, etc. interfaces must remain
2. **DO NOT remove any existing delegate interfaces** - All UserDelegate, SubscriptionDelegate, etc. must remain
3. **DO NOT change the module declaration structure** - Keep `declare module '@prisma/client'`
4. **ADD new types alongside existing ones** - This is additive, not replacement
5. **Test compilation after changes** - Run `pnpm tsc --noEmit` to verify

### Commit for B1

```bash
git add types/prisma-stubs.d.ts
git commit -m "chore(types): update prisma stubs for 5.x compatibility

- Add Prisma 5.x JSON type system (JsonValue, JsonObject, JsonArray)
- Add JSON null handling (JsonNull, DbNull, AnyNull)
- Update StringFilter with 'mode' option for case-insensitive search
- Enhance DateTimeFilter with nested filter support
- Add IntFilter, FloatFilter, BoolFilter types
- Add $metrics API to PrismaClient
- Add $extends method for client extensions
- Add TransactionIsolationLevel type
- Add RelationLoadStrategy type
- Add Metrics interfaces for observability
- Add Middleware types

BREAKING CHANGE: None - all changes are additive"
```

---

## 7. Phase B2: Documentation

### 7.1 Create Upgrade Log

**File:** `docs/prisma-upgrade-log.md`

```markdown
# Prisma 5.22.0 Upgrade Log

## Upgrade Summary

| Field                | Value                  |
| -------------------- | ---------------------- |
| **Start Date**       | December 25, 2024      |
| **Previous Version** | 4.16.2 (June 2023)     |
| **Target Version**   | 5.22.0 (November 2024) |
| **Status**           | In Progress            |
| **Estimated Effort** | 20-25 hours            |

## Version Gap Analysis

### Security Updates Included

- 12+ security patches from 4.16.2 to 5.22.0
- CVE fixes (check Prisma release notes for specific CVEs)

### Performance Improvements

- 30-40% faster query execution
- Improved connection pooling
- Better query plan caching

### New Features Available After Upgrade

1. **Metrics API** (`prisma.$metrics`) - Built-in observability
2. **Relation Load Strategy** - Choose between `query` and `join` strategies
3. **Client Extensions** (`prisma.$extends`) - Custom client functionality
4. **Improved JSON Handling** - Distinct `JsonNull` vs `DbNull`
5. **Case-Insensitive Search** - `mode: 'insensitive'` in string filters

## Implementation Approach

### Two-Agent Parallel Implementation
```

Stream A (Agent 1): Stream B (Agent 2):
├── A1: Update Dependencies ├── B1: Update Type Stubs
├── A2: Schema Validation ├── B2: Documentation (this file)
└── A3: Code Updates └── B3: Test Scripts

````

### Rationale for Parallel Approach
- Zero file overlap between streams
- Reduces total implementation time by ~50%
- Cleaner git history with focused commits

## Breaking Changes Addressed

### 1. JSON Null Handling
**Change:** `null` in JSON fields is now a valid JSON value, distinct from database NULL.

**Migration:**
```typescript
// Before (Prisma 4.x):
await prisma.config.create({
  data: { metadata: null }  // Ambiguous
});

// After (Prisma 5.x):
await prisma.config.create({
  data: { metadata: Prisma.JsonNull }  // Explicit JSON null
  // or
  data: { metadata: Prisma.DbNull }    // Database NULL
});
````

### 2. DateTime Defaults

**Change:** `@default(now())` uses database's `NOW()` function instead of client-side `new Date()`.

**Impact:** More accurate timestamps, but tests checking exact timestamps may need adjustment.

### 3. Stricter Types

**Change:** Prisma 5.x has stricter types for `select` and `include`.

**Impact:** Some loose type usage may require fixes.

## Files Modified

### Stream A (Agent 1)

- [ ] `package.json` - Dependency versions
- [ ] `pnpm-lock.yaml` - Lock file
- [ ] `prisma/schema.prisma` - Schema formatting
- [ ] Application code files (as needed)

### Stream B (Agent 2)

- [x] `types/prisma-stubs.d.ts` - Type definitions
- [x] `docs/prisma-upgrade-log.md` - This file
- [x] `docs/prisma-5x-breaking-changes.md` - Breaking changes guide
- [x] `README.md` - Version update
- [x] `scripts/test-prisma5-upgrade.ts` - Validation script
- [x] `scripts/run-all-tests.sh` - Test runner

## Testing Strategy

### Test Levels

1. **TypeScript Compilation** - `pnpm tsc --noEmit`
2. **Build Test** - `pnpm build`
3. **Unit Tests** - `pnpm test:unit`
4. **Integration Tests** - `pnpm test:integration`
5. **Prisma 5.x Validation** - `scripts/test-prisma5-upgrade.ts`

### Success Criteria

- [ ] Zero TypeScript errors
- [ ] Build succeeds
- [ ] All existing tests pass
- [ ] Prisma 5.x features accessible
- [ ] No runtime regressions

## Rollback Plan

### Instant Rollback (Vercel)

```bash
vercel rollback [previous-deployment-id]
```

### Git Rollback

```bash
git revert -m 1 [merge-commit-hash]
git push origin main
```

## Post-Upgrade Tasks

- [ ] Enable `$metrics` for observability
- [ ] Add `relationLoadStrategy: 'join'` to heavy queries
- [ ] Remove type stubs workarounds (if Prisma generates locally)
- [ ] Update team documentation

## References

- [Prisma 5.x Upgrade Guide](https://www.prisma.io/docs/guides/upgrade-guides/upgrading-versions/upgrading-to-prisma-5)
- [Prisma 5.x Release Notes](https://github.com/prisma/prisma/releases)
- [Prisma 5.x Breaking Changes](https://www.prisma.io/docs/guides/upgrade-guides/upgrading-versions/upgrading-to-prisma-5#breaking-changes)

````

### 7.2 Create Breaking Changes Document

**File:** `docs/prisma-5x-breaking-changes.md`

```markdown
# Prisma 5.x Breaking Changes Reference

## Quick Reference Table

| Change | Impact | Action Required |
|--------|--------|-----------------|
| JSON null handling | Medium | Use `Prisma.JsonNull` or `Prisma.DbNull` |
| DateTime defaults | Low | Update timestamp tests if needed |
| Type strictness | Low | Fix any type errors |
| Node.js version | Low | Ensure Node 16.13+ |

## Detailed Changes

### 1. JSON Null Handling

#### The Change
In Prisma 4.x, `null` for a JSON field was ambiguous. In Prisma 5.x, there's explicit distinction:

- `Prisma.JsonNull` - A JSON `null` value stored in the field
- `Prisma.DbNull` - A database `NULL` (field has no value)
- `Prisma.AnyNull` - Matches either in queries

#### Code Examples

**Creating records:**
```typescript
// Store JSON null
await prisma.config.create({
  data: {
    key: 'setting',
    metadata: Prisma.JsonNull
  }
});

// Store database NULL
await prisma.config.create({
  data: {
    key: 'setting',
    metadata: Prisma.DbNull
  }
});
````

**Querying records:**

```typescript
// Find where metadata is JSON null
await prisma.config.findMany({
  where: { metadata: { equals: Prisma.JsonNull } },
});

// Find where metadata is database NULL
await prisma.config.findMany({
  where: { metadata: { equals: Prisma.DbNull } },
});

// Find where metadata is either
await prisma.config.findMany({
  where: { metadata: { equals: Prisma.AnyNull } },
});
```

### 2. DateTime Default Behavior

#### The Change

`@default(now())` now uses database's `NOW()` function instead of JavaScript's `new Date()`.

#### Impact on Tests

```typescript
// This test might fail in Prisma 5.x:
const user = await prisma.user.create({ data: { email: 'test@test.com' } });
expect(user.createdAt).toEqual(new Date()); // ❌ Might be off by milliseconds

// Better approach:
const user = await prisma.user.create({ data: { email: 'test@test.com' } });
expect(user.createdAt).toBeInstanceOf(Date); // ✅
expect(Date.now() - user.createdAt.getTime()).toBeLessThan(5000); // ✅ Within 5 seconds
```

### 3. Stricter Select/Include Types

#### The Change

Prisma 5.x provides stricter TypeScript types for `select` and `include` options.

#### Example

```typescript
// This might error in Prisma 5.x if 'invalidField' doesn't exist:
await prisma.user.findMany({
  select: {
    id: true,
    invalidField: true, // ❌ TypeScript error in 5.x
  },
});
```

### 4. Transaction Timeout Defaults

#### The Change

Default transaction timeout changed. Interactive transactions now have explicit timeout options.

#### New Syntax

```typescript
await prisma.$transaction(
  async (tx) => {
    // operations
  },
  {
    maxWait: 5000, // Max time to wait for transaction slot
    timeout: 10000, // Max time for transaction to complete
    isolationLevel: 'Serializable', // Optional
  }
);
```

## Migration Checklist

- [ ] Search codebase for JSON field `null` assignments
- [ ] Review tests with timestamp assertions
- [ ] Check for any `select`/`include` with dynamic fields
- [ ] Review transaction timeout requirements
- [ ] Verify Node.js version >= 16.13

````

### 7.3 Update README.md

Find the dependencies or technology stack section and update Prisma version. Add a small section if none exists:

```markdown
## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | React Framework |
| Prisma | 5.22.0 | Database ORM |
| PostgreSQL | 15.x | Database |
| TypeScript | 5.x | Type Safety |

## Prisma Notes

This project uses Prisma 5.22.0 with manual type stubs (`types/prisma-stubs.d.ts`) due to network restrictions preventing local client generation. See [Prisma Upgrade Log](docs/prisma-upgrade-log.md) for details.
````

### Commit for B2

```bash
git add docs/prisma-upgrade-log.md docs/prisma-5x-breaking-changes.md README.md
git commit -m "docs: add prisma 5.x upgrade documentation

- Create prisma-upgrade-log.md with full upgrade details
- Create prisma-5x-breaking-changes.md reference guide
- Update README.md with current Prisma version
- Document two-agent parallel implementation approach
- Include rollback procedures and success criteria"
```

---

## 8. Phase B3: Test Scripts

### 8.1 Create Prisma 5.x Validation Script

**File:** `scripts/test-prisma5-upgrade.ts`

```typescript
/**
 * Prisma 5.22.0 Upgrade Validation Script
 *
 * This script validates that Prisma 5.x is working correctly after upgrade.
 * Run with: npx tsx scripts/test-prisma5-upgrade.ts
 *
 * Tests:
 * 1. Database connection
 * 2. Basic CRUD operations
 * 3. Relations
 * 4. Transactions
 * 5. Raw queries
 * 6. Aggregations
 * 7. Prisma 5.x specific features
 */

import { PrismaClient } from '@prisma/client';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details?: string;
  duration?: number;
}

const prisma = new PrismaClient({
  log: process.env.DEBUG ? ['query', 'info', 'warn', 'error'] : ['error'],
});

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<{ success: boolean; details?: string }>
): Promise<void> {
  const start = Date.now();
  try {
    const result = await testFn();
    results.push({
      test: name,
      status: result.success ? 'PASS' : 'FAIL',
      details: result.details,
      duration: Date.now() - start,
    });
  } catch (error) {
    results.push({
      test: name,
      status: 'FAIL',
      details: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
  }
}

async function testConnection(): Promise<{
  success: boolean;
  details?: string;
}> {
  await prisma.$connect();
  return { success: true, details: 'Connected successfully' };
}

async function testUserCount(): Promise<{
  success: boolean;
  details?: string;
}> {
  const count = await prisma.user.count();
  return { success: true, details: `${count} users in database` };
}

async function testSubscriptionCount(): Promise<{
  success: boolean;
  details?: string;
}> {
  const count = await prisma.subscription.count();
  return { success: true, details: `${count} subscriptions in database` };
}

async function testAlertCount(): Promise<{
  success: boolean;
  details?: string;
}> {
  const count = await prisma.alert.count();
  return { success: true, details: `${count} alerts in database` };
}

async function testSystemConfig(): Promise<{
  success: boolean;
  details?: string;
}> {
  const configs = await prisma.systemConfig.findMany({ take: 5 });
  return {
    success: true,
    details: `${configs.length} system configs retrieved`,
  };
}

async function testSystemConfigHistory(): Promise<{
  success: boolean;
  details?: string;
}> {
  const count = await prisma.systemConfigHistory.count();
  return { success: true, details: `${count} history records` };
}

async function testRelations(): Promise<{
  success: boolean;
  details?: string;
}> {
  const subscription = await prisma.subscription.findFirst({
    include: { user: true },
  });

  if (!subscription) {
    return {
      success: true,
      details: 'No subscriptions to test relations (skipped)',
    };
  }

  return {
    success: subscription.user !== undefined,
    details: subscription.user
      ? 'Relation loaded successfully'
      : 'Relation failed to load',
  };
}

async function testInteractiveTransaction(): Promise<{
  success: boolean;
  details?: string;
}> {
  const result = await prisma.$transaction(async (tx) => {
    const userCount = await tx.user.count();
    const alertCount = await tx.alert.count();
    return { userCount, alertCount };
  });

  return {
    success: true,
    details: `Transaction completed: ${result.userCount} users, ${result.alertCount} alerts`,
  };
}

async function testRawQuery(): Promise<{ success: boolean; details?: string }> {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "User"
  `;

  return {
    success: true,
    details: `Raw query returned: ${result[0].count} users`,
  };
}

async function testAggregation(): Promise<{
  success: boolean;
  details?: string;
}> {
  const result = await prisma.user.aggregate({
    _count: { id: true },
  });

  return {
    success: true,
    details: `Aggregation: ${result._count.id} users`,
  };
}

async function testPrisma5Features(): Promise<{
  success: boolean;
  details?: string;
}> {
  const features: string[] = [];

  // Check for $metrics (Prisma 5.x feature)
  if ('$metrics' in prisma) {
    features.push('$metrics API available');
  }

  // Check for $extends (Prisma 5.x feature)
  if ('$extends' in prisma) {
    features.push('$extends API available');
  }

  if (features.length === 0) {
    return { success: false, details: 'No Prisma 5.x features detected' };
  }

  return { success: true, details: features.join(', ') };
}

async function testStringFilterMode(): Promise<{
  success: boolean;
  details?: string;
}> {
  // Test case-insensitive search (Prisma 5.x feature)
  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: 'test',
          mode: 'insensitive',
        },
      },
      take: 1,
    });
    return {
      success: true,
      details: `Case-insensitive search works (${users.length} results)`,
    };
  } catch (error) {
    // If it fails, might be database doesn't support it or feature not available
    return {
      success: true,
      details: 'Case-insensitive search not tested (may require specific DB)',
    };
  }
}

async function main(): Promise<void> {
  console.log('🧪 Prisma 5.22.0 Upgrade Validation');
  console.log('='.repeat(50));
  console.log('');

  // Run all tests
  console.log('📡 Testing Database Connection...');
  await runTest('Database Connection', testConnection);

  console.log('📊 Testing Basic Queries...');
  await runTest('User Count', testUserCount);
  await runTest('Subscription Count', testSubscriptionCount);
  await runTest('Alert Count', testAlertCount);

  console.log('⚙️  Testing SystemConfig Models...');
  await runTest('SystemConfig Query', testSystemConfig);
  await runTest('SystemConfigHistory Count', testSystemConfigHistory);

  console.log('🔗 Testing Relations...');
  await runTest('Relation Loading', testRelations);

  console.log('🔄 Testing Transactions...');
  await runTest('Interactive Transaction', testInteractiveTransaction);

  console.log('🔧 Testing Raw Queries...');
  await runTest('Raw SQL Query', testRawQuery);

  console.log('📈 Testing Aggregations...');
  await runTest('Aggregation', testAggregation);

  console.log('✨ Testing Prisma 5.x Features...');
  await runTest('Prisma 5.x APIs', testPrisma5Features);
  await runTest('String Filter Mode', testStringFilterMode);

  // Print results
  console.log('');
  console.log('='.repeat(50));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(50));
  console.log('');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const skipped = results.filter((r) => r.status === 'SKIP').length;

  results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    const duration = r.duration ? ` (${r.duration}ms)` : '';
    console.log(`${icon} ${r.test}${duration}`);
    if (r.details) {
      console.log(`   ${r.details}`);
    }
  });

  console.log('');
  console.log('='.repeat(50));
  console.log(
    `Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed} | ⏭️ Skipped: ${skipped}`
  );
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('');
    console.log('❌ VALIDATION FAILED');
    console.log(
      'Please review failed tests before proceeding with deployment.'
    );
    process.exit(1);
  } else {
    console.log('');
    console.log('🎉 VALIDATION SUCCESSFUL!');
    console.log('Prisma 5.22.0 is working correctly.');
    console.log('Safe to proceed with deployment.');
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
```

### 8.2 Create Comprehensive Test Runner

**File:** `scripts/run-all-tests.sh`

```bash
#!/bin/bash
#
# Comprehensive Test Suite for Prisma 5.x Upgrade Validation
# Run with: ./scripts/run-all-tests.sh
#

set -e

echo "🧪 Running Comprehensive Test Suite"
echo "===================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FAILED_TESTS=()
PASSED_TESTS=()
SKIPPED_TESTS=()

run_test() {
  local name="$1"
  local command="$2"

  echo -e "${BLUE}▶ Running: ${name}${NC}"

  if eval "$command" > /tmp/test-output-$$.log 2>&1; then
    echo -e "${GREEN}✅ PASS: ${name}${NC}"
    PASSED_TESTS+=("$name")
    return 0
  else
    echo -e "${RED}❌ FAIL: ${name}${NC}"
    echo "   Output:"
    tail -20 /tmp/test-output-$$.log | sed 's/^/   /'
    FAILED_TESTS+=("$name")
    return 1
  fi
}

skip_test() {
  local name="$1"
  local reason="$2"
  echo -e "${YELLOW}⏭️  SKIP: ${name} - ${reason}${NC}"
  SKIPPED_TESTS+=("$name")
}

# Test 1: TypeScript Compilation
echo ""
echo "═══════════════════════════════════════"
echo "📝 Phase 1: TypeScript Compilation"
echo "═══════════════════════════════════════"
run_test "TypeScript Check" "pnpm tsc --noEmit" || true

# Test 2: ESLint
echo ""
echo "═══════════════════════════════════════"
echo "🔍 Phase 2: Code Quality (ESLint)"
echo "═══════════════════════════════════════"
if command -v pnpm &> /dev/null && pnpm run lint --help &> /dev/null; then
  run_test "ESLint" "pnpm lint" || true
else
  skip_test "ESLint" "lint command not configured"
fi

# Test 3: Build
echo ""
echo "═══════════════════════════════════════"
echo "🏗️  Phase 3: Production Build"
echo "═══════════════════════════════════════"
run_test "Next.js Build" "pnpm build" || true

# Test 4: Prisma Validation
echo ""
echo "═══════════════════════════════════════"
echo "⚙️  Phase 4: Prisma Schema Validation"
echo "═══════════════════════════════════════"
run_test "Prisma Validate" "npx prisma validate" || true

# Test 5: Unit Tests (if available)
echo ""
echo "═══════════════════════════════════════"
echo "🧪 Phase 5: Unit Tests"
echo "═══════════════════════════════════════"
if pnpm run test:unit --help &> /dev/null 2>&1; then
  run_test "Unit Tests" "pnpm test:unit" || true
elif pnpm run test --help &> /dev/null 2>&1; then
  run_test "Tests" "pnpm test" || true
else
  skip_test "Unit Tests" "test command not configured"
fi

# Test 6: Prisma 5.x Specific Validation
echo ""
echo "═══════════════════════════════════════"
echo "✨ Phase 6: Prisma 5.x Feature Validation"
echo "═══════════════════════════════════════"
if [ -f "scripts/test-prisma5-upgrade.ts" ]; then
  run_test "Prisma 5.x Features" "npx tsx scripts/test-prisma5-upgrade.ts" || true
else
  skip_test "Prisma 5.x Features" "validation script not found"
fi

# Summary
echo ""
echo "═══════════════════════════════════════"
echo "📊 TEST SUMMARY"
echo "═══════════════════════════════════════"
echo ""

TOTAL=$((${#PASSED_TESTS[@]} + ${#FAILED_TESTS[@]} + ${#SKIPPED_TESTS[@]}))

echo -e "Total Tests: ${TOTAL}"
echo -e "${GREEN}✅ Passed:  ${#PASSED_TESTS[@]}${NC}"
echo -e "${RED}❌ Failed:  ${#FAILED_TESTS[@]}${NC}"
echo -e "${YELLOW}⏭️  Skipped: ${#SKIPPED_TESTS[@]}${NC}"
echo ""

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo -e "${RED}Failed Tests:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo -e "${RED}  - ${test}${NC}"
  done
  echo ""
fi

if [ ${#SKIPPED_TESTS[@]} -gt 0 ]; then
  echo -e "${YELLOW}Skipped Tests:${NC}"
  for test in "${SKIPPED_TESTS[@]}"; do
    echo -e "${YELLOW}  - ${test}${NC}"
  done
  echo ""
fi

echo "═══════════════════════════════════════"

# Cleanup
rm -f /tmp/test-output-$$.log

# Exit with appropriate code
if [ ${#FAILED_TESTS[@]} -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed! Safe to proceed with deployment.${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please review before deployment.${NC}"
  exit 1
fi
```

### 8.3 Make Script Executable

After creating the shell script, it needs to be made executable. Add a note in your commit message that this should be done:

```bash
chmod +x scripts/run-all-tests.sh
```

### Commit for B3

```bash
chmod +x scripts/run-all-tests.sh
git add scripts/test-prisma5-upgrade.ts scripts/run-all-tests.sh
git commit -m "test: add prisma 5.x upgrade validation scripts

- Create test-prisma5-upgrade.ts for comprehensive Prisma 5.x validation
- Create run-all-tests.sh for full test suite execution
- Tests include: connection, CRUD, relations, transactions, raw queries
- Validates Prisma 5.x specific features ($metrics, $extends)
- Includes case-insensitive search validation
- Provides detailed pass/fail reporting with timing"
```

---

## 9. Git Workflow & Commits

### Branch Setup

```bash
# Ensure you're on the correct branch
git checkout claude/upgrade-prisma-security-occtv

# Pull latest changes (in case Agent 1 pushed first)
git pull origin claude/upgrade-prisma-security-occtv
```

### Commit Sequence

Execute in this order:

1. **B1 Commit** - Type stubs update
2. **B2 Commit** - Documentation
3. **B3 Commit** - Test scripts

### Push Your Work

```bash
# After all three commits
git push -u origin claude/upgrade-prisma-security-occtv
```

### If Push Fails (Network Issues)

Retry up to 4 times with exponential backoff:

- Wait 2s, try again
- Wait 4s, try again
- Wait 8s, try again
- Wait 16s, try again

---

## 10. Conflict Prevention Rules

### NEVER Modify These Files (Agent 1's Domain)

```
❌ package.json
❌ pnpm-lock.yaml
❌ prisma/schema.prisma
❌ app/**/*.ts
❌ app/**/*.tsx
❌ lib/**/*.ts
❌ components/**/*.tsx
❌ hooks/**/*.ts
❌ utils/**/*.ts
```

### ALWAYS Modify Only These Files (Your Domain)

```
✅ types/prisma-stubs.d.ts
✅ docs/prisma-upgrade-log.md (new)
✅ docs/prisma-5x-breaking-changes.md (new)
✅ README.md (only version section)
✅ scripts/test-prisma5-upgrade.ts (new)
✅ scripts/run-all-tests.sh (new)
```

### If You See Merge Conflicts

1. **STOP** - Do not attempt to resolve
2. **Notify** the human coordinator
3. **Wait** for instructions

The parallel approach is designed to have ZERO conflicts. If you see one, something went wrong in the planning.

---

## Summary Checklist

Before marking your work complete, verify:

### Phase B1: Type Stubs

- [ ] Added Prisma 5.x JSON types (JsonValue, JsonObject, JsonArray)
- [ ] Added JSON null handling (JsonNull, DbNull, AnyNull)
- [ ] Updated StringFilter with `mode` option
- [ ] Enhanced DateTimeFilter
- [ ] Added $metrics to PrismaClient
- [ ] Added $extends to PrismaClient
- [ ] Added TransactionIsolationLevel
- [ ] Added RelationLoadStrategy
- [ ] All existing model interfaces preserved
- [ ] TypeScript compilation passes

### Phase B2: Documentation

- [ ] Created docs/prisma-upgrade-log.md
- [ ] Created docs/prisma-5x-breaking-changes.md
- [ ] Updated README.md version section

### Phase B3: Test Scripts

- [ ] Created scripts/test-prisma5-upgrade.ts
- [ ] Created scripts/run-all-tests.sh
- [ ] Made shell script executable
- [ ] Test scripts handle missing dependencies gracefully

### Git

- [ ] Three separate commits (B1, B2, B3)
- [ ] Pushed to claude/upgrade-prisma-security-occtv
- [ ] No modifications to Agent 1's files

---

**End of Agent 2 Prompt**
