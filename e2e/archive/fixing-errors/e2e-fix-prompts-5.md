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
