I'll analyze the failing job to find a solution for you. I found 4 TypeScript errors causing the job to fail. Let me retrieve the files to provide specific fixes: ## Solution for TypeScript Errors

There are 4 TypeScript errors that need to be fixed:

### 1. **Error in `route.ts` line 125** - Object is possibly 'undefined'

The issue is that `affiliate. commissions[0]` might be undefined when the array is empty.

**Fix for line 123-126:**

```typescript
const oldestPending =
  affiliate.commissions.length > 0
    ? (affiliate.commissions[0]?.earnedAt ?? null)
    : null;
```

### 2. **Errors in `affiliate-management.ts` lines 92-94** - Index signature access

TypeScript requires bracket notation for properties accessed via index signatures.

**Fix for lines 92-94:**

```typescript
if (status) where['status'] = status;
if (country) where['country'] = country;
if (paymentMethod) where['paymentMethod'] = paymentMethod;
```

### Complete Fixed Sections

**In `lib/admin/affiliate-management.ts` (lines 90-94):**

```typescript
// Build where clause
const where: Record<string, unknown> = {};
if (status) where['status'] = status;
if (country) where['country'] = country;
if (paymentMethod) where['paymentMethod'] = paymentMethod;
```

**In `app/api/admin/affiliates/reports/commission-owings/route.ts` (lines 122-126):**

```typescript
// Get oldest pending commission date
const oldestPending =
  affiliate.commissions.length > 0
    ? (affiliate.commissions[0]?.earnedAt ?? null)
    : null;
```

These changes will resolve all 4 TypeScript compilation errors and allow the type-check to pass.
