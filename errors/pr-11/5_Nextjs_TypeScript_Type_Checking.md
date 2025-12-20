I'll analyze the failing job to find a solution for you. I found 4 TypeScript errors in the job. Let me retrieve the affected files to provide solutions: ## Solution for Failing Type Check

The TypeScript compiler is failing with 4 errors. Here are the fixes:

### 1. Fix in `app/api/admin/affiliates/reports/commission-owings/route.ts` (Line 125)

**Issue:** `affiliate.commissions[0]` is possibly undefined.

**Fix:** Add optional chaining:

```typescript
const oldestPending =
  affiliate.commissions.length > 0 ? affiliate.commissions[0]?.earnedAt : null;
```

### 2. Fixes in `lib/admin/affiliate-management.ts` (Lines 92-94)

**Issue:** Properties accessed on `where` object with index signature must use bracket notation.

**Fix:** Change from dot notation to bracket notation:

```typescript
// Build where clause
const where: Record<string, unknown> = {};
if (status) where['status'] = status;
if (country) where['country'] = country;
if (paymentMethod) where['paymentMethod'] = paymentMethod;
```

These changes will resolve all TypeScript errors and allow the CI pipeline to pass. The errors are strict type safety checks that require:

1. Optional chaining when accessing array elements that might not exist
2. Bracket notation for dynamically assigned properties on objects with index signatures
