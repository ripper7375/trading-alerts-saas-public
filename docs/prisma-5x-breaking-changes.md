# Prisma 5.x Breaking Changes Reference

## Quick Reference Table

| Change             | Impact | Action Required                          |
| ------------------ | ------ | ---------------------------------------- |
| JSON null handling | Medium | Use `Prisma.JsonNull` or `Prisma.DbNull` |
| DateTime defaults  | Low    | Update timestamp tests if needed         |
| Type strictness    | Low    | Fix any type errors                      |
| Node.js version    | Low    | Ensure Node 16.13+                       |

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
    metadata: Prisma.JsonNull,
  },
});

// Store database NULL
await prisma.config.create({
  data: {
    key: 'setting',
    metadata: Prisma.DbNull,
  },
});
```

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
expect(user.createdAt).toEqual(new Date()); // Might be off by milliseconds

// Better approach:
const user = await prisma.user.create({ data: { email: 'test@test.com' } });
expect(user.createdAt).toBeInstanceOf(Date); // Works
expect(Date.now() - user.createdAt.getTime()).toBeLessThan(5000); // Within 5 seconds
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
    invalidField: true, // TypeScript error in 5.x
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

### 5. Case-Insensitive Search

#### The Change

Prisma 5.x adds a `mode` option to string filters for case-insensitive search.

#### Example

```typescript
// Case-insensitive search (new in 5.x)
await prisma.user.findMany({
  where: {
    email: {
      contains: 'test',
      mode: 'insensitive', // New option
    },
  },
});
```

### 6. Metrics API

#### The Change

Prisma 5.x adds a built-in `$metrics` API for observability.

#### Example

```typescript
// Get metrics as JSON
const metrics = await prisma.$metrics.json();

// Get metrics in Prometheus format
const prometheus = await prisma.$metrics.prometheus();
```

### 7. Client Extensions

#### The Change

Prisma 5.x adds `$extends` for creating extended clients with custom functionality.

#### Example

```typescript
const xprisma = prisma.$extends({
  result: {
    user: {
      fullName: {
        needs: { firstName: true, lastName: true },
        compute(user) {
          return `${user.firstName} ${user.lastName}`;
        },
      },
    },
  },
});

const user = await xprisma.user.findFirst();
console.log(user.fullName); // Computed property
```

### 8. Relation Load Strategy

#### The Change

Prisma 5.x allows choosing between `query` and `join` strategies for relation loading.

#### Example

```typescript
// Use JOIN for loading relations (potentially faster for 1:1)
await prisma.user.findMany({
  include: { subscription: true },
  relationLoadStrategy: 'join',
});

// Use separate queries (default, better for 1:many)
await prisma.user.findMany({
  include: { alerts: true },
  relationLoadStrategy: 'query',
});
```

## Migration Checklist

- [ ] Search codebase for JSON field `null` assignments
- [ ] Review tests with timestamp assertions
- [ ] Check for any `select`/`include` with dynamic fields
- [ ] Review transaction timeout requirements
- [ ] Verify Node.js version >= 16.13
- [ ] Update type stubs if using manual declarations

## Files Affected in This Project

### Type Stubs Updated

- `types/prisma-stubs.d.ts` - Added all Prisma 5.x types

### Models with JSON Fields (may need null handling review)

- `UserPreferences.preferences` - JSON field
- `FraudAlert.additionalData` - Nullable JSON field
- `AffiliateProfile.paymentDetails` - JSON field
- `AffiliateRiseAccount.metadata` - Nullable JSON field
- `PaymentBatch.metadata` - Nullable JSON field
- `DisbursementTransaction.metadata` - Nullable JSON field
- `RiseWorksWebhookEvent.payload` - JSON field
- `DisbursementAuditLog.details` - Nullable JSON field

## Testing Commands

```bash
# Verify TypeScript compilation
pnpm tsc --noEmit

# Run the Prisma 5.x validation script
npx tsx scripts/test-prisma5-upgrade.ts

# Run full test suite
./scripts/run-all-tests.sh
```

## Rollback Procedure

If issues are discovered after upgrade:

1. **Immediate:** Revert to previous Vercel deployment
2. **Git:** `git revert <merge-commit>` and push
3. **Dependencies:** Restore `package.json` and `pnpm-lock.yaml` from backup
