I'll analyze the failing job to find a solution for you. ## Solution for Failing Job

The build is failing due to a TypeScript error on **line 125** in `app/api/admin/affiliates/reports/commission-owings/route.ts`. The issue is that `affiliate.commissions[0]` is possibly undefined, even though you're checking the array length.

### The Problem

TypeScript doesn't infer that accessing `affiliate.commissions[0]` is safe after checking `affiliate.commissions.length > 0`.

### Fix

Replace lines 123-126 with a null-safe array access:

```typescript
const oldestPending =
  affiliate.commissions.length > 0
    ? (affiliate.commissions[0]?.earnedAt ?? null)
    : null;
```

Or use optional chaining directly:

```typescript
const oldestPending = affiliate.commissions[0]?.earnedAt ?? null;
```

The second option is cleaner since it handles both the empty array case and potential undefined access automatically.

**File location:** [app/api/admin/affiliates/reports/commission-owings/route.ts:125](https://github.com/ripper7375/trading-alerts-saas-public/blob/c7c9d41df1bfcfd2c6afa4318ea9bd19c24f32b5/app/api/admin/affiliates/reports/commission-owings/route.ts#L125)
