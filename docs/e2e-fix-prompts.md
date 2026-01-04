# Claude Code (Web) Fix Prompts

Use the attached `e2e-production-bug-report.md` as context for all prompts below.

---

## Prompt 1: Fix Billing Page - Cancel Modal & Resubscribe

**Priority:** High
**Files:** 1 file
**Estimated Tests Fixed:** 30 (CAN-003 to CAN-007, CAN-012)

```
Please fix the billing page to add a cancel confirmation modal and resubscribe functionality.

File to modify: app/(dashboard)/settings/billing/page.tsx

BUG #1 - Cancel Confirmation Modal Missing:
1. The "Cancel Plan" button (around line 179-184) currently triggers cancellation directly without confirmation
2. Add an AlertDialog component that wraps the cancel button
3. The dialog should show:
   - Title: "Cancel Subscription?"
   - Description warning about losing PRO features at end of billing period
   - "Keep My Plan" button to dismiss
   - "Yes, Cancel" button to confirm and proceed with cancellation
4. Only call the cancel API after user confirms in the modal

BUG #2 - No Resubscribe Option:
1. Check if subscription has cancelledAt set (meaning user cancelled but subscription hasn't expired)
2. For cancelled subscriptions, show:
   - "Cancelled" badge instead of "Active"
   - Expiration date ("Access until: [date]")
   - "Resubscribe" button instead of "Cancel Plan"
3. The Resubscribe button should call an API to reactivate the subscription

Use the AlertDialog component from @/components/ui/alert-dialog (shadcn/ui pattern).

After making changes, ensure the component properly handles all subscription states:
- ACTIVE: Show cancel button with confirmation modal
- CANCELLED (not expired): Show resubscribe button and expiry date
- EXPIRED: Show upgrade button
```

---

## Prompt 2: Add data-testid Attributes to Alerts Client

**Priority:** High
**Files:** 1 file
**Estimated Tests Fixed:** 40 (ALT-002 to ALT-007, ALT-014, ALT-025 to ALT-030)

```
Please add data-testid attributes to the alerts client component for E2E testing.

File to modify: app/(dashboard)/alerts/alerts-client.tsx

Add the following data-testid attributes:

1. Line ~454 - "Create New Alert" Button:
   Add: data-testid="create-alert-button"

2. Line ~333 - Each Alert Card container:
   Add: data-testid="alert-item"

3. Line ~353 - Symbol Badge inside alert card:
   Add: data-testid="alert-symbol"

4. Line ~354 - Timeframe span inside alert card:
   Add: data-testid="alert-timeframe"

5. Lines ~406, ~416 - Pause and Resume buttons:
   Add: data-testid="alert-toggle"

6. Line ~425 - Delete button:
   Add: data-testid="alert-delete-button"

7. Line ~517 - Status filter buttons container:
   Add: data-testid="status-filter" to the filter container

8. Line ~535 - Symbol filter Select:
   Add: data-testid="symbol-filter"

9. Line ~582 - Empty state Card (when no alerts):
   Add: data-testid="alerts-empty-state"

10. Line ~473 - Alert limit warning link:
    Add: data-testid="alert-limit-warning"

Example pattern:
// Before
<Button onClick={handleCreate}>+ Create New Alert</Button>

// After
<Button onClick={handleCreate} data-testid="create-alert-button">+ Create New Alert</Button>

// Before
<Card key={alert.id} className="...">

// After
<Card key={alert.id} className="..." data-testid="alert-item">

Ensure all interactive elements have test IDs so Playwright E2E tests can reliably select them.
```

---

## Prompt 3: Add data-testid Attributes to Alert Form

**Priority:** High
**Files:** 1 file
**Estimated Tests Fixed:** 25 (form-related tests)

```
Please add data-testid attributes to the alert form component for E2E testing.

File to modify: components/alerts/alert-form.tsx

Add the following data-testid attributes:

1. Line ~171 - Form element:
   Add: data-testid="alert-form"

2. Line ~184 - Symbol Select trigger:
   Add: data-testid="symbol-select"

3. Line ~194 - Each Symbol SelectItem:
   Add: data-testid="symbol-option"

4. Line ~210 - Timeframe Select trigger:
   Add: data-testid="timeframe-select"

5. Line ~220 - Each Timeframe SelectItem:
   Add: data-testid="timeframe-option"

6. Line ~234 - Condition selector container (radio buttons):
   Add: data-testid="condition-select" on the container div

7. Line ~272 - Price/Target value Input:
   Add: data-testid="price-input"

8. Line ~294 - Alert name Input:
   Add: data-testid="alert-name-input"

9. Line ~309 - Cancel Button:
   Add: data-testid="cancel-button"

10. Line ~318 - Submit Button:
    Add: data-testid="submit-alert-button"

11. Line ~174 - Error message div:
    Add: data-testid="error-message"

12. Add a success message element (if not exists) with:
    data-testid="success-message"

Example for Select components:
<Select>
  <SelectTrigger data-testid="symbol-select">
    <SelectValue placeholder="Select a symbol" />
  </SelectTrigger>
  <SelectContent>
    {availableSymbols.map((s) => (
      <SelectItem key={s} value={s} data-testid="symbol-option">
        {s}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## Prompt 4: Add Test Seed Data for Discount Codes

**Priority:** High
**Files:** 1 file
**Estimated Tests Fixed:** 60 (DSC-001 to DSC-011 API tests)

```
Please add discount code seed data to the database seeding script for E2E tests.

File to modify: prisma/seed.ts

Add the following test discount codes. First, check the Prisma schema for the DiscountCode model structure, then add seeding logic:

Required test codes:
1. TESTCODE10:
   - discountPercent: 10
   - commissionPercent: 5
   - status: 'ACTIVE'
   - expiresAt: 1 year from now

2. TESTCODE20:
   - discountPercent: 20
   - commissionPercent: 10
   - status: 'ACTIVE'
   - expiresAt: 1 year from now

3. EXPIREDCODE:
   - discountPercent: 15
   - commissionPercent: 7
   - status: 'EXPIRED'
   - expiresAt: yesterday (expired)

4. USEDCODE:
   - discountPercent: 10
   - commissionPercent: 5
   - status: 'USED'
   - usedAt: now
   - expiresAt: 1 year from now

5. SUSPENDEDAFF:
   - discountPercent: 10
   - commissionPercent: 5
   - status: 'ACTIVE'
   - expiresAt: 1 year from now
   - affiliateId: link to a test affiliate with SUSPENDED status

Implementation pattern:
1. Create or find a test affiliate user first
2. Use prisma.discountCode.upsert() for each code
3. Link codes to the test affiliate
4. For SUSPENDEDAFF code, ensure the linked affiliate has SUSPENDED status

Make sure to handle the case where the seed script runs multiple times (use upsert to avoid duplicates).
```

---

## Prompt 5: Add Discount Code Input to Checkout Flow

**Priority:** Medium
**Files:** 2-3 files
**Estimated Tests Fixed:** 40 (SUB-009 to SUB-012, DSC-012 to DSC-015)

```
Please add a discount code input to the checkout flow before redirecting to Stripe.

Current behavior: Users click "Upgrade to PRO" and are redirected directly to Stripe.
Expected behavior: Users should be able to enter a discount code before checkout.

Files to check/modify:
1. app/(dashboard)/pricing/page.tsx (or wherever the pricing page is)
2. May need a new component: components/checkout/checkout-preview.tsx
3. API route for discount validation: app/api/checkout/validate-code/route.ts

Implementation:
1. Create a CheckoutPreview component or modal that appears when user clicks upgrade
2. The component should include:
   - Plan summary (PRO Monthly $29 or PRO Yearly $290)
   - Discount code input field with data-testid="discount-code-input"
   - "Apply" button with data-testid="apply-code-button"
   - Display for discount amount when valid code applied
   - "Proceed to Checkout" button with data-testid="proceed-checkout-button"

3. When user applies a code:
   - Call GET /api/checkout/validate-code?code=XXX&planType=MONTHLY
   - If valid, show discount percentage and new price
   - If invalid, show error message

4. When user proceeds to checkout:
   - Pass the discount code to the Stripe checkout session creation
   - Stripe should apply the discount to the payment

Flow:
Click "Upgrade" → Show CheckoutPreview modal → Enter code (optional) → Apply → Proceed → Stripe

Use Dialog or Sheet component from shadcn/ui for the checkout preview modal.
```

---

## Prompt 6: Add data-testid to Alert Card and List Components

**Priority:** Medium
**Files:** 2 files
**Estimated Tests Fixed:** 10 (remaining alert tests)

```
Please add data-testid attributes to the alert card and list components.

Files to modify:
1. components/alerts/alert-card.tsx
2. components/alerts/alert-list.tsx

For alert-card.tsx:
1. The card container should have data-testid="alert-item"
2. Symbol display should have data-testid="alert-symbol"
3. Timeframe display should have data-testid="alert-timeframe"
4. Toggle/pause button should have data-testid="alert-toggle"
5. Delete button should have data-testid="alert-delete-button"
6. Edit button (if exists) should have data-testid="alert-edit-button"

For alert-list.tsx:
1. The list container should have data-testid="alerts-list"
2. Empty state should have data-testid="alerts-empty-state"
3. Confirm delete button in modal should have data-testid="confirm-delete"

Note: Check if these components are actually used or if alerts-client.tsx renders everything directly.
If alerts-client.tsx handles all rendering, focus only on that file (covered in Prompt 2).

Verify by checking how AlertCard and AlertList are imported and used in the codebase.
```

---

## Execution Order

1. **Prompt 1** (Billing) - Fixes 30 tests, standalone
2. **Prompt 2** (Alerts Client) - Fixes 40 tests, standalone
3. **Prompt 3** (Alert Form) - Fixes 25 tests, standalone
4. **Prompt 4** (Seed Data) - Fixes 60 tests, standalone
5. **Prompt 5** (Checkout Flow) - Fixes 40 tests, may depend on existing checkout structure
6. **Prompt 6** (Card/List) - Fixes 10 tests, verify if needed after Prompt 2

**Recommended approach:** Run prompts 1-4 first (independent fixes), then 5-6 (may require more context).

---

## Verification After Each Fix

After applying each prompt's fix, run the relevant tests:

```bash
# After Prompt 1 (Billing)
npx playwright test e2e/tests/path3-subscription-cancel.spec.ts --grep "CAN-003|CAN-004|CAN-005|CAN-006|CAN-007|CAN-012"

# After Prompts 2, 3, 6 (Alerts)
npx playwright test e2e/tests/path7-alert-notifications.spec.ts

# After Prompt 4 (Seed Data) - reseed database first
npx prisma db seed
npx playwright test e2e/tests/path4-discount-redemption.spec.ts

# After Prompt 5 (Checkout)
npx playwright test e2e/tests/path2-subscription-upgrade.spec.ts --grep "SUB-009|SUB-010|SUB-011|SUB-012"
npx playwright test e2e/tests/path4-discount-redemption.spec.ts --grep "DSC-012|DSC-013|DSC-014|DSC-015"
```
