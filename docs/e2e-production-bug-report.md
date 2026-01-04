# E2E Test Production Bug Report

**Generated:** 2026-01-04
**Branch:** claude/investigate-ui-test-issues-LZaJj
**Status:** Test files validated, production fixes required

---

## Executive Summary

| Path | Tests | Passed | Failed | Production Bugs |
|------|-------|--------|--------|-----------------|
| Path 1: Authentication | 20 | 20 | 0 | None |
| Path 2: Subscription Upgrade | 110 | 95 | 15 | 1 (discount code input) |
| Path 3: Subscription Cancel | 95 | 63 | 32 | 2 (modal + resubscribe) |
| Path 4: Discount Redemption | 125 | 30 | 95 | 1 + test data missing |
| Path 5: Affiliate Commissions | 110 | 105 | 0 | None (5 skipped) |
| Path 6: Watchlist | - | - | - | Skipped (discontinued) |
| Path 7: Alert Notifications | 170 | 103 | 67 | 1 (missing data-testid) |

**Total Production Bugs to Fix:** 5 bugs across 8 files

---

## Bug #1: Cancel Confirmation Modal Missing

**Severity:** High
**Path:** Path 3 - Subscription Cancel
**Tests Affected:** CAN-003, CAN-004, CAN-005, CAN-006, CAN-007 (5 tests × 5 browsers = 25 failures)

### Location
```
File: app/(dashboard)/settings/billing/page.tsx
Lines: 179-184 (Cancel Plan button section)
```

### Current Behavior
The "Cancel Plan" button directly triggers cancellation without any confirmation dialog.

### Expected Behavior (per docs/mvp-manual-testing-checklist.md line 194)
1. Click "Cancel Plan" button
2. Confirmation modal appears with:
   - Warning message about losing PRO features
   - Cancellation reason dropdown (optional)
   - "Keep My Plan" button (dismiss)
   - "Yes, Cancel" button (confirm)
3. After confirmation, subscription is cancelled

### Fix Required
Add an AlertDialog component that:
- Shows confirmation message
- Optional: includes cancellation reason dropdown
- Has "Keep My Plan" and "Yes, Cancel" buttons
- Only proceeds with cancellation after user confirms

### Code Pattern
```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Wrap cancel button with AlertDialog
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Cancel Plan</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
      <AlertDialogDescription>
        You will lose access to PRO features at the end of your billing period.
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Keep My Plan</AlertDialogCancel>
      <AlertDialogAction onClick={handleCancel}>
        Yes, Cancel
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Bug #2: No Resubscribe Option for Cancelled Users

**Severity:** Medium
**Path:** Path 3 - Subscription Cancel
**Tests Affected:** CAN-012 (1 test × 5 browsers = 5 failures)

### Location
```
File: app/(dashboard)/settings/billing/page.tsx
```

### Current Behavior
Users with cancelled subscriptions (status: cancelled, cancelledAt: not null) see the same UI as active PRO users - no way to resubscribe.

### Expected Behavior
When subscription is cancelled but not yet expired:
1. Show "Subscription Cancelled" status badge
2. Display expiration date
3. Show "Resubscribe" button instead of "Cancel Plan"
4. Clicking "Resubscribe" should reactivate the subscription

### Fix Required
Add conditional rendering based on `subscription.cancelledAt`:
```tsx
{subscription.cancelledAt ? (
  <>
    <Badge variant="destructive">Cancelled</Badge>
    <p>Access until: {formatDate(subscription.expiresAt)}</p>
    <Button onClick={handleResubscribe}>Resubscribe</Button>
  </>
) : (
  <Button variant="destructive" onClick={handleCancel}>Cancel Plan</Button>
)}
```

---

## Bug #3: Discount Code Input Missing from Checkout

**Severity:** Medium
**Path:** Path 2 & Path 4 - Subscription Upgrade & Discount Redemption
**Tests Affected:** SUB-009 to SUB-012, DSC-012 to DSC-015 (8 tests × 5 browsers = 40 failures)

### Location
```
Files:
  - app/(dashboard)/pricing/page.tsx (or pricing component)
  - Checkout flow before Stripe redirect
```

### Current Behavior
Users are redirected directly to Stripe checkout without the ability to enter a discount code.

### Expected Behavior (per docs/policies/07-dlocal-integration-rules.md line 109)
1. User clicks "Upgrade to PRO"
2. Pre-checkout modal or page appears with:
   - Plan summary (PRO Monthly/Yearly)
   - Discount code input field
   - "Apply" button to validate code
   - Price display (original and discounted)
3. After applying valid code, show discount amount
4. "Proceed to Checkout" redirects to Stripe with discount applied

### Fix Required
Add a checkout preview component before Stripe redirect:
```tsx
// New component: components/checkout/checkout-preview.tsx
interface CheckoutPreviewProps {
  plan: 'MONTHLY' | 'YEARLY';
  onProceed: (discountCode?: string) => void;
}

export function CheckoutPreview({ plan, onProceed }: CheckoutPreviewProps) {
  const [discountCode, setDiscountCode] = useState('');
  const [discount, setDiscount] = useState<number | null>(null);

  const handleApplyCode = async () => {
    const result = await validateDiscountCode(discountCode, plan);
    if (result.valid) {
      setDiscount(result.discountPercent);
    }
  };

  return (
    <Card data-testid="checkout-preview">
      <Input
        data-testid="discount-code-input"
        value={discountCode}
        onChange={(e) => setDiscountCode(e.target.value)}
        placeholder="Enter discount code"
      />
      <Button data-testid="apply-code-button" onClick={handleApplyCode}>
        Apply
      </Button>
      {discount && <p>Discount: {discount}% off</p>}
      <Button data-testid="proceed-checkout-button" onClick={() => onProceed(discountCode)}>
        Proceed to Checkout
      </Button>
    </Card>
  );
}
```

---

## Bug #4: Missing Test Seed Data for Discount Codes

**Severity:** High (blocks 95 tests)
**Path:** Path 4 - Discount Redemption
**Tests Affected:** All API validation tests (DSC-001 to DSC-011)

### Location
```
File: prisma/seed.ts
```

### Current State
No discount codes are seeded in the test database.

### Required Seed Data
```typescript
// Add to prisma/seed.ts

const discountCodes = [
  {
    code: 'TESTCODE10',
    discountPercent: 10,
    commissionPercent: 5,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  },
  {
    code: 'TESTCODE20',
    discountPercent: 20,
    commissionPercent: 10,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  },
  {
    code: 'EXPIREDCODE',
    discountPercent: 15,
    commissionPercent: 7,
    status: 'EXPIRED',
    expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
  },
  {
    code: 'USEDCODE',
    discountPercent: 10,
    commissionPercent: 5,
    status: 'USED',
    usedAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  },
  {
    code: 'SUSPENDEDAFF',
    discountPercent: 10,
    commissionPercent: 5,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    // Link to a suspended affiliate
  },
];

// Seed codes
for (const code of discountCodes) {
  await prisma.discountCode.upsert({
    where: { code: code.code },
    update: code,
    create: {
      ...code,
      affiliateId: testAffiliate.id, // Link to test affiliate
    },
  });
}
```

---

## Bug #5: Missing data-testid Attributes on Alerts Page

**Severity:** High (blocks 67 tests)
**Path:** Path 7 - Alert Notifications
**Tests Affected:** ALT-002 to ALT-007, ALT-014, ALT-025 to ALT-030 (13 tests × 5 browsers = 65+ failures)

### Files to Fix

#### File 1: `app/(dashboard)/alerts/alerts-client.tsx`

| Line | Element | Required data-testid |
|------|---------|---------------------|
| 454 | "Create New Alert" Button | `data-testid="create-alert-button"` |
| 333 | Alert Card container | `data-testid="alert-item"` |
| 353 | Symbol Badge | `data-testid="alert-symbol"` |
| 354 | Timeframe span | `data-testid="alert-timeframe"` |
| 406 | Pause Button | `data-testid="alert-toggle"` |
| 416 | Resume Button | `data-testid="alert-toggle"` |
| 425 | Delete Button | `data-testid="alert-delete-button"` |
| 517 | Status filter buttons | `data-testid="status-filter"` |
| 535 | Symbol filter Select | `data-testid="symbol-filter"` |
| 582 | Empty state Card | `data-testid="alerts-empty-state"` |
| 473 | Alert limit warning | `data-testid="alert-limit-warning"` |

#### File 2: `app/(dashboard)/alerts/new/create-alert-client.tsx`

Check if this file uses AlertForm component. If it renders the form directly, add data-testid attributes similar to alert-form.tsx.

#### File 3: `components/alerts/alert-form.tsx`

| Line | Element | Required data-testid |
|------|---------|---------------------|
| 171 | Form element | `data-testid="alert-form"` |
| 184 | Symbol Select | `data-testid="symbol-select"` |
| 194 | Symbol SelectItem | `data-testid="symbol-option"` |
| 210 | Timeframe Select | `data-testid="timeframe-select"` |
| 220 | Timeframe SelectItem | `data-testid="timeframe-option"` |
| 234 | Condition selector | `data-testid="condition-select"` |
| 272 | Price Input | `data-testid="price-input"` |
| 294 | Alert name Input | `data-testid="alert-name-input"` |
| 309 | Cancel Button | `data-testid="cancel-button"` |
| 318 | Submit Button | `data-testid="submit-alert-button"` |
| 174 | Error message div | `data-testid="error-message"` |
| (new) | Success message | `data-testid="success-message"` |

#### File 4: `components/alerts/alert-card.tsx`

Add `data-testid` attributes to match the alert-item structure expected by tests.

#### File 5: `components/alerts/alert-list.tsx`

Ensure list container has appropriate test IDs if used.

### Example Fix Pattern
```tsx
// Before
<Button onClick={handleCreate}>+ Create New Alert</Button>

// After
<Button onClick={handleCreate} data-testid="create-alert-button">
  + Create New Alert
</Button>
```

```tsx
// Before
<Card key={alert.id} className="...">

// After
<Card key={alert.id} className="..." data-testid="alert-item">
```

---

## Summary of Files to Modify

| Priority | File | Bugs |
|----------|------|------|
| 1 | `app/(dashboard)/settings/billing/page.tsx` | #1, #2 |
| 2 | `prisma/seed.ts` | #4 |
| 3 | `app/(dashboard)/alerts/alerts-client.tsx` | #5 |
| 4 | `components/alerts/alert-form.tsx` | #5 |
| 5 | `components/alerts/alert-card.tsx` | #5 |
| 6 | `components/alerts/alert-list.tsx` | #5 |
| 7 | Pricing/Checkout flow | #3 |

---

## Verification Commands

After fixes, run tests to verify:

```bash
# Path 3 - Cancel subscription
npx playwright test e2e/tests/path3-subscription-cancel.spec.ts

# Path 4 - Discount codes (after seeding)
npx playwright test e2e/tests/path4-discount-redemption.spec.ts

# Path 7 - Alerts
npx playwright test e2e/tests/path7-alert-notifications.spec.ts
```

---

## Expected Results After Fixes

| Path | Current | Expected |
|------|---------|----------|
| Path 3 | 63 passed, 32 failed | 95 passed, 0 failed |
| Path 4 | 30 passed, 95 failed | 125 passed, 0 failed |
| Path 7 | 103 passed, 67 failed | 170 passed, 0 failed |

**Total improvement:** +294 tests passing
