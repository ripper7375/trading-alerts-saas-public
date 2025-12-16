# v0.dev + SystemConfig Integration Guide

**Project:** Trading Alerts SaaS V7
**Purpose:** Guide for updating existing v0.dev pages and creating new ones with SystemConfig compatibility
**Created:** 2025-11-16
**Target:** All UI frontend pages and dashboards

---

## 📖 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Retrofitting Existing v0.dev Pages](#retrofitting-existing-v0dev-pages)
3. [Creating New v0.dev Pages](#creating-new-v0dev-pages)
4. [Common Patterns to Update](#common-patterns-to-update)
5. [Verification Checklist](#verification-checklist)
6. [Examples](#examples)

---

## 🎯 Overview

### The Problem

You previously asked v0.dev to create ~20 UI pages with **hardcoded** percentages:

```tsx
❌ BAD (Hardcoded):
<p>Earn 20% commission on every sale!</p>
<p>Save 20% with affiliate code</p>
<p>Price: $23.20/month (was $29.00)</p>
```

### The Solution

All pages need to use **dynamic** percentages from SystemConfig:

```tsx
✅ GOOD (Dynamic):
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function Component() {
  const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig();

  return (
    <>
      <p>Earn {commissionPercent}% commission on every sale!</p>
      <p>Save {discountPercent}% with affiliate code</p>
      <p>Price: ${calculateDiscountedPrice(29.00).toFixed(2)}/month (was $29.00)</p>
    </>
  );
}
```

### Pages Affected

**All UI frontend pages with affiliate-related content:**

- ✅ Marketing homepage (pricing section)
- ✅ Pricing page
- ✅ Checkout page
- ✅ Billing/subscription page
- ✅ Affiliate dashboard (all pages)
- ✅ Admin affiliate management pages
- ✅ Any future page showing discount/commission percentages

---

## 🔄 Retrofitting Existing v0.dev Pages

### Workflow Overview

```
Step 1: Identify pages with hardcoded percentages
Step 2: Prepare v0.dev prompt with SYSTEMCONFIG-USAGE-GUIDE.md
Step 3: Upload to v0.dev and get updated code
Step 4: Copy updated code to your project
Step 5: Verify it works
Step 6: Repeat for next page
```

---

## 📝 PROMPT TEMPLATE 1: Update Existing Page

### Copy this prompt to v0.dev:

````markdown
I need to update this existing React/Next.js component to use dynamic affiliate discount and commission percentages from a centralized configuration system (SystemConfig) instead of hardcoded values.

## Context

I've attached SYSTEMCONFIG-USAGE-GUIDE.md which explains the SystemConfig system. Please read it carefully before making changes.

**Current Problem:**
This component has hardcoded percentages (20%, 20%, $23.20, etc.) that need to become dynamic so admin can change them from a dashboard.

**Required Changes:**

1. Import the `useAffiliateConfig` hook at the top of the component
2. Use the hook to get current discount and commission percentages
3. Replace ALL hardcoded percentages with dynamic values from the hook
4. Use the `calculateDiscountedPrice()` helper for price calculations
5. Keep the component as a client component ('use client')

## Specific Requirements

**Import statement to add:**

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
```
````

**Hook usage pattern:**

```typescript
const {
  discountPercent, // Current discount % (e.g., 20)
  commissionPercent, // Current commission % (e.g., 20)
  calculateDiscountedPrice, // Helper: (price) => discounted price
} = useAffiliateConfig();
```

**Values to replace:**

| Hardcoded Value             | Replace With                                                                  |
| --------------------------- | ----------------------------------------------------------------------------- |
| `20%` (discount)            | `{discountPercent}%`                                                          |
| `20%` (commission)          | `{commissionPercent}%`                                                        |
| `$23.20` (discounted price) | `${calculateDiscountedPrice(29.00).toFixed(2)}`                               |
| `$5.80` (discount amount)   | `${(29.00 - calculateDiscountedPrice(29.00)).toFixed(2)}`                     |
| `$4.64` (commission amount) | `${(calculateDiscountedPrice(29.00) * (commissionPercent / 100)).toFixed(2)}` |

## Current Component Code

[PASTE YOUR COMPONENT CODE HERE]

## Expected Output

Please provide the updated component with:

1. Import statement added
2. Hook called at top of component function
3. All hardcoded percentages replaced with dynamic values
4. All price calculations using the helper function
5. Component remains functional and looks identical to user
6. Only the data source changes (hardcoded → dynamic)

## Important Notes

- Keep all styling, layout, and UI exactly the same
- Only change the data source from hardcoded to dynamic
- Ensure the component remains a client component ('use client')
- Do NOT change component structure, props, or exports
- Comments explaining the changes are appreciated

````

---

### How to Use This Prompt

**Step 1: Go to your v0.dev chat where the component was created**

**Step 2: Upload SYSTEMCONFIG-USAGE-GUIDE.md as an attachment**

**Step 3: Copy the prompt above and paste it into v0.dev**

**Step 4: Replace `[PASTE YOUR COMPONENT CODE HERE]` with your actual component code**

Example:
```tsx
// Replace this line:
[PASTE YOUR COMPONENT CODE HERE]

// With your actual code:
export default function PricingCard() {
  return (
    <div className="card">
      <h2>PRO Plan</h2>
      <p className="price">$23.20/month</p>
      <p className="discount">Save 20%!</p>
      <p className="commission">Affiliates earn 20% commission</p>
    </div>
  );
}
````

**Step 5: Send to v0.dev and wait for response**

**Step 6: Copy the updated code v0.dev provides**

**Step 7: Verify the changes** (see Verification Checklist below)

---

## 🆕 Creating New v0.dev Pages

### PROMPT TEMPLATE 2: Create New Page with SystemConfig

### Copy this prompt to v0.dev:

````markdown
I need to create a new [PAGE DESCRIPTION] component for my Next.js 15 application that displays affiliate discount and commission information.

## Important Requirements

I've attached SYSTEMCONFIG-USAGE-GUIDE.md which explains our centralized configuration system (SystemConfig). Please read it carefully.

**CRITICAL:** This component MUST use dynamic affiliate discount and commission percentages from the `useAffiliateConfig` hook. DO NOT hardcode any percentages like "20%" or prices like "$23.20".

## SystemConfig Integration Requirements

**1. Import the hook:**

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
```
````

**2. Use the hook in component:**

```typescript
const {
  discountPercent, // Current discount % (e.g., 20)
  commissionPercent, // Current commission % (e.g., 20)
  calculateDiscountedPrice, // Helper: (price) => discounted price
} = useAffiliateConfig();
```

**3. Display dynamic values:**

- Discount percentage: `{discountPercent}%`
- Commission percentage: `{commissionPercent}%`
- Discounted price: `${calculateDiscountedPrice(29.00).toFixed(2)}`
- Regular price: `$29.00` (this can be hardcoded)

## Component Requirements

[DESCRIBE YOUR COMPONENT REQUIREMENTS HERE]

Example:

- Display a pricing card with regular and discounted prices
- Show affiliate commission percentage
- Include a "Get Code" button
- Use shadcn/ui components
- Tailwind CSS for styling
- Responsive design (mobile-first)

## Design Preferences

[DESCRIBE DESIGN/STYLE PREFERENCES HERE]

Example:

- Modern, clean design
- Dark mode support
- Purple accent color (#8B5CF6)
- Card layout with hover effects

## Important Notes

- Component MUST be a client component ('use client')
- Do NOT hardcode percentages (20%, 20%, etc.)
- Do NOT hardcode calculated prices ($23.20, $5.80, $4.64, etc.)
- ALL percentage and price displays must use values from `useAffiliateConfig()`
- The component should work correctly even if admin changes percentages from 20% to 25% or any other value

## Expected Output

Please provide a complete Next.js 15 client component that:

1. Imports and uses the useAffiliateConfig hook correctly
2. Displays all percentages and prices dynamically
3. Matches the design requirements
4. Is fully responsive
5. Includes loading and error states (from the hook)

````

---

### How to Use This Prompt

**Step 1: Start a new v0.dev chat (or use existing one)**

**Step 2: Upload SYSTEMCONFIG-USAGE-GUIDE.md as an attachment**

**Step 3: Copy the prompt above and customize it:**

Replace `[PAGE DESCRIPTION]` with your page type:
- "affiliate dashboard earnings page"
- "pricing comparison table"
- "affiliate program landing page"
- "checkout page with discount code input"

Replace `[DESCRIBE YOUR COMPONENT REQUIREMENTS HERE]` with specific features you want.

Replace `[DESCRIBE DESIGN/STYLE PREFERENCES HERE]` with your styling preferences.

**Step 4: Send to v0.dev**

**Step 5: Review the generated code to ensure:**
- ✅ It imports `useAffiliateConfig` from `@/lib/hooks/useAffiliateConfig`
- ✅ It calls the hook and destructures the values
- ✅ It uses `{discountPercent}%` not `20%`
- ✅ It uses `{commissionPercent}%` not `20%`
- ✅ It uses `calculateDiscountedPrice()` not hardcoded `$23.20`

**Step 6: If v0.dev still hardcodes values, use this follow-up prompt:**

```markdown
I notice the code still has hardcoded percentages (20%, $23.20, etc.).

Please revise the component to use the dynamic values from useAffiliateConfig hook:

- Replace all instances of "20%" (discount) with {discountPercent}%
- Replace all instances of "20%" (commission) with {commissionPercent}%
- Replace "$23.20" with ${calculateDiscountedPrice(29.00).toFixed(2)}
- Replace "$5.80" with ${(29.00 - calculateDiscountedPrice(29.00)).toFixed(2)}

The component should display different values if admin changes the percentages from 20%/20% to 25%/25% or any other combination.
````

---

## 🔍 Common Patterns to Update

### Pattern 1: Hardcoded Discount Percentage in Text

**Before (v0.dev generated):**

```tsx
<p className="text-sm text-green-600">Save 20% with affiliate code!</p>
```

**After (SystemConfig compatible):**

```tsx
const { discountPercent } = useAffiliateConfig();

<p className="text-sm text-green-600">
  Save {discountPercent}% with affiliate code!
</p>;
```

---

### Pattern 2: Hardcoded Commission Percentage

**Before:**

```tsx
<div className="commission">
  <span className="text-2xl font-bold">20%</span>
  <span className="text-sm">Commission per sale</span>
</div>
```

**After:**

```tsx
const { commissionPercent } = useAffiliateConfig();

<div className="commission">
  <span className="text-2xl font-bold">{commissionPercent}%</span>
  <span className="text-sm">Commission per sale</span>
</div>;
```

---

### Pattern 3: Hardcoded Discounted Price

**Before:**

```tsx
<div className="pricing">
  <p className="text-3xl font-bold">$23.20</p>
  <p className="text-sm line-through">$29.00</p>
</div>
```

**After:**

```tsx
const { calculateDiscountedPrice } = useAffiliateConfig();
const regularPrice = 29.0;
const discountedPrice = calculateDiscountedPrice(regularPrice);

<div className="pricing">
  <p className="text-3xl font-bold">${discountedPrice.toFixed(2)}</p>
  <p className="text-sm line-through">${regularPrice.toFixed(2)}</p>
</div>;
```

---

### Pattern 4: Hardcoded Calculation in JSX

**Before:**

```tsx
<span>
  Discount: $5.80
</span>
<span>
  You pay: $23.20/month
</span>
<span>
  You earn: $4.64/sale
</span>
```

**After:**

```tsx
const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig();
const regularPrice = 29.00;
const discountedPrice = calculateDiscountedPrice(regularPrice);
const discountAmount = regularPrice - discountedPrice;
const commissionAmount = discountedPrice * (commissionPercent / 100);

<span>
  Discount: ${discountAmount.toFixed(2)}
</span>
<span>
  You pay: ${discountedPrice.toFixed(2)}/month
</span>
<span>
  You earn: ${commissionAmount.toFixed(2)}/sale
</span>
```

---

### Pattern 5: Hardcoded Values in Functions

**Before:**

```tsx
const calculateSavings = (price: number) => {
  return price * 0.2; // Hardcoded 20%
};

const calculateCommission = (price: number) => {
  const discounted = price * 0.8; // Hardcoded 20% discount
  return discounted * 0.2; // Hardcoded 20% commission
};
```

**After:**

```tsx
const { discountPercent, commissionPercent, calculateDiscountedPrice } =
  useAffiliateConfig();

const calculateSavings = (price: number) => {
  return price * (discountPercent / 100); // Dynamic
};

const calculateCommission = (price: number) => {
  const discounted = calculateDiscountedPrice(price); // Dynamic
  return discounted * (commissionPercent / 100); // Dynamic
};
```

---

### Pattern 6: Hardcoded in Array/Object Data

**Before:**

```tsx
const pricingTiers = [
  {
    name: 'Regular',
    price: 29.0,
    features: ['Access to all features'],
  },
  {
    name: 'With Code',
    price: 23.2, // Hardcoded
    discount: '20% off', // Hardcoded
    features: ['Access to all features', 'Save $5.80'], // Hardcoded
  },
];
```

**After:**

```tsx
const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();
const regularPrice = 29.0;
const discountedPrice = calculateDiscountedPrice(regularPrice);
const savings = regularPrice - discountedPrice;

const pricingTiers = [
  {
    name: 'Regular',
    price: regularPrice,
    features: ['Access to all features'],
  },
  {
    name: 'With Code',
    price: discountedPrice, // Dynamic
    discount: `${discountPercent}% off`, // Dynamic
    features: ['Access to all features', `Save $${savings.toFixed(2)}`], // Dynamic
  },
];
```

---

### Pattern 7: Conditional Rendering Based on Discount

**Before:**

```tsx
{
  hasDiscount && <Badge className="bg-green-500">20% OFF</Badge>;
}
```

**After:**

```tsx
const { discountPercent } = useAffiliateConfig();

{
  hasDiscount && <Badge className="bg-green-500">{discountPercent}% OFF</Badge>;
}
```

---

### Pattern 8: Calculations in useState/useMemo

**Before:**

```tsx
const [totalPrice, setTotalPrice] = useState(23.2); // Hardcoded

const finalPrice = useMemo(() => {
  return 29.0 * 0.8; // Hardcoded 20% discount
}, []);
```

**After:**

```tsx
const { calculateDiscountedPrice } = useAffiliateConfig();
const regularPrice = 29.0;

const [totalPrice, setTotalPrice] = useState(() =>
  calculateDiscountedPrice(regularPrice)
);

const finalPrice = useMemo(() => {
  return calculateDiscountedPrice(regularPrice); // Dynamic
}, [calculateDiscountedPrice]);
```

---

## ✅ Verification Checklist

After v0.dev updates your code, verify these items:

### Import Check

- [ ] Component imports `useAffiliateConfig` from `@/lib/hooks/useAffiliateConfig`
- [ ] Import statement is at the top of the file

### Hook Usage Check

- [ ] Component calls `useAffiliateConfig()` hook
- [ ] Hook is called at the top of the component function (before any returns)
- [ ] Values are destructured: `{ discountPercent, commissionPercent, calculateDiscountedPrice }`

### Hardcoded Value Check

- [ ] No hardcoded "20%" for discount
- [ ] No hardcoded "20%" for commission
- [ ] No hardcoded "$23.20" for discounted price
- [ ] No hardcoded "$5.80" for discount amount
- [ ] No hardcoded "$4.64" for commission amount
- [ ] No hardcoded "0.2" or "0.8" multipliers

### Dynamic Value Check

- [ ] Discount percentage uses `{discountPercent}%`
- [ ] Commission percentage uses `{commissionPercent}%`
- [ ] Discounted price uses `calculateDiscountedPrice(29.00)`
- [ ] All calculations use dynamic values, not hardcoded

### Client Component Check

- [ ] Component has `'use client'` directive at top
- [ ] No Server Component patterns (async component, direct DB calls)

### Functionality Check

- [ ] Component compiles without errors
- [ ] Component displays correctly in browser
- [ ] Values update when SystemConfig changes (test by manually changing config)

---

## 📊 Examples

### Example 1: Marketing Homepage Pricing Section

**Original v0.dev Code (Hardcoded):**

```tsx
// components/pricing-section.tsx
export default function PricingSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-purple-50 to-white">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">
          Simple, Transparent Pricing
        </h2>

        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">PRO Plan</h3>

            {/* ❌ Hardcoded prices */}
            <div className="mb-6">
              <p className="text-5xl font-bold text-purple-600">
                $23.20
                <span className="text-lg text-gray-500">/month</span>
              </p>
              <p className="text-sm text-gray-400 line-through">$29.00</p>
              <p className="text-green-600 font-semibold mt-2">
                Save 20% with affiliate code!
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-purple-800">
                💡 Have a referral code? Get 20% off this month!
              </p>
            </div>

            <button className="w-full bg-purple-600 text-white py-3 rounded-lg">
              Get Started
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 mt-8">
          Become an affiliate and earn 20% commission on every sale!
        </p>
      </div>
    </section>
  );
}
```

**Updated Code (SystemConfig Compatible):**

```tsx
// components/pricing-section.tsx
'use client';

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function PricingSection() {
  // ✅ Import and use the hook
  const { discountPercent, commissionPercent, calculateDiscountedPrice } =
    useAffiliateConfig();

  // Define regular price (this can be hardcoded)
  const regularPrice = 29.0;

  // Calculate dynamic values
  const discountedPrice = calculateDiscountedPrice(regularPrice);
  const savings = regularPrice - discountedPrice;

  return (
    <section className="py-20 bg-gradient-to-b from-purple-50 to-white">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">
          Simple, Transparent Pricing
        </h2>

        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">PRO Plan</h3>

            {/* ✅ Dynamic prices */}
            <div className="mb-6">
              <p className="text-5xl font-bold text-purple-600">
                ${discountedPrice.toFixed(2)}
                <span className="text-lg text-gray-500">/month</span>
              </p>
              <p className="text-sm text-gray-400 line-through">
                ${regularPrice.toFixed(2)}
              </p>
              <p className="text-green-600 font-semibold mt-2">
                Save {discountPercent}% with affiliate code!
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-purple-800">
                💡 Have a referral code? Get {discountPercent}% off this month!
              </p>
            </div>

            <button className="w-full bg-purple-600 text-white py-3 rounded-lg">
              Get Started
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 mt-8">
          Become an affiliate and earn {commissionPercent}% commission on every
          sale!
        </p>
      </div>
    </section>
  );
}
```

**v0.dev Prompt Used:**

```markdown
I need to update this pricing section component to use dynamic percentages from our SystemConfig system.

[Attached: SYSTEMCONFIG-USAGE-GUIDE.md]

Please update this component to:

1. Import useAffiliateConfig from '@/lib/hooks/useAffiliateConfig'
2. Replace hardcoded 20% discount with {discountPercent}%
3. Replace hardcoded 20% commission with {commissionPercent}%
4. Replace $23.20 with calculateDiscountedPrice(29.00)
5. Add 'use client' directive

Current code:
[pasted the original code above]
```

---

### Example 2: Affiliate Dashboard Earnings Widget

**Original v0.dev Code (Hardcoded):**

```tsx
// components/affiliate/earnings-widget.tsx
export default function EarningsWidget({
  salesCount = 0,
}: {
  salesCount: number;
}) {
  // ❌ Hardcoded commission percentage and price
  const commissionPerSale = 4.64;
  const totalEarnings = salesCount * commissionPerSale;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Your Earnings</h3>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">Commission Rate</p>
          <p className="text-2xl font-bold text-purple-600">20%</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Per Sale</p>
          <p className="text-2xl font-bold">${commissionPerSale.toFixed(2)}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-2xl font-bold">{salesCount}</p>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-gray-600">Total Earnings</p>
          <p className="text-3xl font-bold text-green-600">
            ${totalEarnings.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-6 p-4 bg-purple-50 rounded">
        <p className="text-sm text-purple-800">
          Each customer pays $23.20/month. You earn 20% of that!
        </p>
      </div>
    </div>
  );
}
```

**Updated Code (SystemConfig Compatible):**

```tsx
// components/affiliate/earnings-widget.tsx
'use client';

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function EarningsWidget({
  salesCount = 0,
}: {
  salesCount: number;
}) {
  // ✅ Use dynamic configuration
  const { commissionPercent, calculateDiscountedPrice } = useAffiliateConfig();

  // Calculate dynamic values
  const regularPrice = 29.0;
  const discountedPrice = calculateDiscountedPrice(regularPrice);
  const commissionPerSale = discountedPrice * (commissionPercent / 100);
  const totalEarnings = salesCount * commissionPerSale;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Your Earnings</h3>

      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">Commission Rate</p>
          <p className="text-2xl font-bold text-purple-600">
            {commissionPercent}%
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Per Sale</p>
          <p className="text-2xl font-bold">${commissionPerSale.toFixed(2)}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-2xl font-bold">{salesCount}</p>
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-gray-600">Total Earnings</p>
          <p className="text-3xl font-bold text-green-600">
            ${totalEarnings.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-6 p-4 bg-purple-50 rounded">
        <p className="text-sm text-purple-800">
          Each customer pays ${discountedPrice.toFixed(2)}/month. You earn{' '}
          {commissionPercent}% of that!
        </p>
      </div>
    </div>
  );
}
```

---

### Example 3: Checkout Page with Discount Code

**Original v0.dev Code (Hardcoded):**

```tsx
// components/checkout-summary.tsx
export default function CheckoutSummary({
  hasCode = false,
}: {
  hasCode: boolean;
}) {
  const regularPrice = 29.0;
  const discountedPrice = hasCode ? 23.2 : regularPrice; // ❌ Hardcoded

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Order Summary</h3>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span>PRO Plan (Monthly)</span>
          <span>${regularPrice.toFixed(2)}</span>
        </div>

        {hasCode && (
          <>
            <div className="flex justify-between text-green-600">
              <span>Affiliate Discount (20%)</span>
              <span>-$5.80</span>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-600 mb-2">
                🎉 You're saving 20% with this code!
              </p>
            </div>
          </>
        )}

        <div className="border-t pt-3 flex justify-between text-xl font-bold">
          <span>Total</span>
          <span>${discountedPrice.toFixed(2)}</span>
        </div>
      </div>

      {!hasCode && (
        <div className="mt-4 p-3 bg-purple-50 rounded text-sm text-purple-800">
          💡 Have an affiliate code? You could save 20%!
        </div>
      )}
    </div>
  );
}
```

**Updated Code (SystemConfig Compatible):**

```tsx
// components/checkout-summary.tsx
'use client';

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export default function CheckoutSummary({
  hasCode = false,
}: {
  hasCode: boolean;
}) {
  // ✅ Use dynamic configuration
  const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();

  const regularPrice = 29.0;
  const discountedPrice = hasCode
    ? calculateDiscountedPrice(regularPrice)
    : regularPrice;
  const savings = regularPrice - discountedPrice;

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Order Summary</h3>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span>PRO Plan (Monthly)</span>
          <span>${regularPrice.toFixed(2)}</span>
        </div>

        {hasCode && (
          <>
            <div className="flex justify-between text-green-600">
              <span>Affiliate Discount ({discountPercent}%)</span>
              <span>-${savings.toFixed(2)}</span>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs text-gray-600 mb-2">
                🎉 You're saving {discountPercent}% with this code!
              </p>
            </div>
          </>
        )}

        <div className="border-t pt-3 flex justify-between text-xl font-bold">
          <span>Total</span>
          <span>${discountedPrice.toFixed(2)}</span>
        </div>
      </div>

      {!hasCode && (
        <div className="mt-4 p-3 bg-purple-50 rounded text-sm text-purple-800">
          💡 Have an affiliate code? You could save {discountPercent}%!
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 Process Summary

### For Updating Existing ~20 Pages:

**Step-by-Step Workflow:**

1. **Prepare**
   - List all 20 pages that need updating
   - Have SYSTEMCONFIG-USAGE-GUIDE.md ready

2. **For Each Page:**
   - Open the v0.dev chat where it was created
   - Upload SYSTEMCONFIG-USAGE-GUIDE.md
   - Use PROMPT TEMPLATE 1 (update existing page)
   - Paste your current component code
   - Get updated code from v0.dev
   - Copy to your project
   - Verify using checklist
   - Commit changes

3. **Repeat** for all 20 pages

4. **Test**
   - Run the app
   - Check all pages display correctly
   - Change SystemConfig from admin dashboard
   - Verify all pages update within 5 minutes

---

### For Creating New Pages:

**Step-by-Step Workflow:**

1. **Prepare**
   - Have SYSTEMCONFIG-USAGE-GUIDE.md ready
   - Know what page you want to create

2. **Create:**
   - Start v0.dev chat
   - Upload SYSTEMCONFIG-USAGE-GUIDE.md
   - Use PROMPT TEMPLATE 2 (create new page)
   - Customize the prompt with your requirements
   - Get code from v0.dev
   - Verify it uses the hook correctly
   - If not, use follow-up prompt

3. **Implement:**
   - Copy code to your project
   - Test it works
   - Verify dynamic values display
   - Commit

---

## 📋 Quick Reference Card

### The Golden Rules for v0.dev + SystemConfig

**✅ ALWAYS DO:**

- Upload SYSTEMCONFIG-USAGE-GUIDE.md before asking v0.dev to update/create
- Use PROMPT TEMPLATE 1 for updating existing pages
- Use PROMPT TEMPLATE 2 for creating new pages
- Verify the code uses `useAffiliateConfig()` hook
- Check for hardcoded percentages and replace them

**❌ NEVER DO:**

- Ask v0.dev to create affiliate-related pages without mentioning SystemConfig
- Hardcode percentages like 20%, 20%, $23.20, etc.
- Skip uploading SYSTEMCONFIG-USAGE-GUIDE.md
- Accept code with hardcoded values without requesting fixes

**🔍 SEARCH FOR THESE IN v0.dev OUTPUT:**

- `20%` → Should be `{discountPercent}%` or `{commissionPercent}%`
- `$23.20` → Should be `${calculateDiscountedPrice(29.00).toFixed(2)}`
- `$5.80` → Should be calculated dynamically
- `$4.64` → Should be calculated dynamically
- `0.2` or `0.8` → Should use `discountPercent / 100`

**✅ VERIFY THESE IN v0.dev OUTPUT:**

- `import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';`
- `const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig();`
- `'use client'` at the top of the file
- No hardcoded percentages or prices

---

## 🎯 Success Criteria

You'll know your v0.dev integration is successful when:

✅ **All existing pages updated:**

- All ~20 original pages now use `useAffiliateConfig()` hook
- No hardcoded percentages remain
- All pages compile without errors

✅ **New pages created correctly:**

- Any new page you create uses the hook from the start
- v0.dev consistently generates SystemConfig-compatible code
- No need to manually retrofit new pages

✅ **Admin can change percentages:**

- Admin changes commission from 20% to 25% in dashboard
- All pages update within 5 minutes
- No code deployment needed

✅ **Developers understand the system:**

- Team knows to upload SYSTEMCONFIG-USAGE-GUIDE.md to v0.dev
- Team uses the prompt templates
- Team verifies generated code before accepting

---

## 📞 Need Help?

If v0.dev generates code that still has hardcoded values:

**Use this follow-up prompt:**

```markdown
I see the code still has hardcoded values. Please review SYSTEMCONFIG-USAGE-GUIDE.md again and update the code to:

1. Import: `import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';`
2. Use hook: `const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig();`
3. Replace ALL instances of:
   - "20%" (discount) → `{discountPercent}%`
   - "20%" (commission) → `{commissionPercent}%`
   - "$23.20" → `${calculateDiscountedPrice(29.00).toFixed(2)}`
   - "$5.80" → `${(29.00 - calculateDiscountedPrice(29.00)).toFixed(2)}`
   - "$4.64" → `${(calculateDiscountedPrice(29.00) \* (commissionPercent / 100)).toFixed(2)}`

Please provide the complete updated component with NO hardcoded percentages or prices.
```

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-16
**For:** Trading Alerts SaaS V7 - SystemConfig Integration with v0.dev
