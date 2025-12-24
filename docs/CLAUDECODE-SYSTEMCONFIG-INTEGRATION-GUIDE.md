# Claude Code (Web) + SystemConfig Integration Guide

**Project:** Trading Alerts SaaS V7
**Purpose:** Guide for updating existing UI pages and creating new ones with SystemConfig compatibility using Claude Code (web)
**Created:** 2025-11-16
**Updated:** 2025-12-24
**Target:** All UI frontend pages and dashboards across ALL parts

---

## 📖 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Part 17 Admin Portal - Configuration Source](#part-17-admin-portal---configuration-source)
3. [Cross-Part Integration](#cross-part-integration)
4. [Retrofitting Existing Pages](#retrofitting-existing-pages)
5. [Creating New Pages](#creating-new-pages)
6. [Common Patterns to Update](#common-patterns-to-update)
7. [Verification Checklist](#verification-checklist)
8. [Examples](#examples)

---

## 🎯 Overview

### The Problem

You previously had ~20 UI pages created with **hardcoded** percentages:

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

## 🎛️ Part 17 Admin Portal - Configuration Source

### Admin Configures %Discount and %Commission in Part 17

**Part 17 (Affiliate Marketing Platform)** contains the **Admin System Config** portal where administrators configure all affiliate-related percentages:

```
┌─────────────────────────────────────────────────────────────┐
│              PART 17 - ADMIN SYSTEM CONFIG                  │
│                (Configuration Source)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Admin Portal: /admin/settings/affiliate                   │
│                                                             │
│  Configurable Values:                                       │
│  ┌─────────────────────────────────────────────────┐       │
│  │ affiliate_discount_percent:   [  20.0  ] %     │       │
│  │ affiliate_commission_percent: [  20.0  ] %     │       │
│  │ affiliate_codes_per_month:    [   15   ]       │       │
│  │ affiliate_base_price:         [ 29.00  ] $     │       │
│  └─────────────────────────────────────────────────┘       │
│                                                             │
│  [Save Changes]                                             │
│                                                             │
│  All changes are:                                           │
│  ✓ Stored in SystemConfig database table                   │
│  ✓ Audited in SystemConfigHistory table                    │
│  ✓ Applied in real-time (no restart required)              │
│  ✓ Propagated to ALL other parts automatically             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoints in Part 17

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/system-config` | GET | List all system configurations |
| `/api/admin/system-config/{key}` | GET | Get specific config by key |
| `/api/admin/system-config/{key}` | PUT | Update config (with audit trail) |
| `/api/admin/system-config/history` | GET | View configuration change history |
| `/api/config/affiliate` | GET | Public endpoint for frontend (cached) |

---

## 🔗 Cross-Part Integration

### Configuration Propagates from Part 17 to All Other Parts

When admin changes %discount or %commission in Part 17, the new values **automatically propagate** to all other parts:

```
┌─────────────────────────────────────────────────────────────┐
│                    PART 17 (Source)                         │
│              Admin changes discount to 25%                  │
└─────────────────────────────────┬───────────────────────────┘
                                  │
                                  │ SystemConfig Database
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    ALL OTHER PARTS                          │
│              (Automatically receive new values)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Part 5 (Pricing Page):        Shows "Save 25%!"          │
│  Part 8 (Checkout):            Applies 25% discount        │
│  Part 9 (Billing Dashboard):   Shows "$21.75/month"        │
│  Part 14 (Admin Dashboard):    Reports 25% metrics         │
│  Part 17 (Affiliate Portal):   Affiliates see 25%          │
│  Part 18 (Marketing Pages):    Displays "25% off"          │
│  Any Future Part:              Uses current config          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### ⚠️ CRITICAL: Other Parts Must NOT Have Hardcoded Values

**Parts 5, 8, 9, 14, 18, etc. MUST NOT contain hardcoded discount/commission values.**

They MUST use the SystemConfig integration:

| Part | Files to Check | What to Replace |
|------|----------------|-----------------|
| Part 5 | Pricing components | Hardcoded `20%`, `$23.20` |
| Part 8 | Checkout page | Hardcoded discount calculations |
| Part 9 | Billing dashboard | Hardcoded subscription prices |
| Part 14 | Admin overview | Hardcoded metrics/percentages |
| Part 18 | Marketing pages | Hardcoded promotional text |

### How Other Parts Should Access Config

**Frontend Components (Client-Side):**

```typescript
// ✅ CORRECT - Uses dynamic config from Part 17
'use client';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

export function PricingCard() {
  const { discountPercent, calculateDiscountedPrice } = useAffiliateConfig();

  return (
    <div>
      <p>Save {discountPercent}% with affiliate code!</p>
      <p>Only ${calculateDiscountedPrice(29.00).toFixed(2)}/month</p>
    </div>
  );
}
```

**Backend/API Routes (Server-Side):**

```typescript
// ✅ CORRECT - Fetches from SystemConfig database
import { getAffiliateConfigFromDB } from '@/lib/affiliate/constants';

export async function GET(request: Request) {
  const config = await getAffiliateConfigFromDB();

  const discount = config.discountPercent;  // Current value from Part 17
  const commission = config.commissionPercent;  // Current value from Part 17

  // Use dynamic values...
}
```

### Affiliate Code Business Logic

**Important:** Each affiliate code stores its own `discountPercent` and `commissionPercent` at creation time:

```
┌─────────────────────────────────────────────────────────────┐
│              AFFILIATE CODE CREATION                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Admin sets config in Part 17:                          │
│     discount = 20%, commission = 20%                        │
│                                                             │
│  2. Code "ABC123" created:                                  │
│     code.discountPercent = 20.0  ← Snapshot at creation    │
│     code.commissionPercent = 20.0 ← Snapshot at creation   │
│                                                             │
│  3. Admin later changes to 25%/25%                         │
│                                                             │
│  4. Code "ABC123" is redeemed:                             │
│     Uses stored 20%/20% ← Honors original promise!         │
│                                                             │
│  5. NEW codes created after change:                         │
│     code.discountPercent = 25.0  ← Uses new config         │
│     code.commissionPercent = 25.0 ← Uses new config        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

This ensures:
- ✅ **Customer Trust**: Discount promised when code was issued is honored
- ✅ **Affiliate Trust**: Commission rate promised when code was issued is honored
- ✅ **Business Flexibility**: New codes use updated rates

---

## 🔄 Retrofitting Existing Pages

### Workflow Overview with Claude Code (Web)

```
Step 1: Identify pages with hardcoded percentages
Step 2: Ask Claude Code to update the file with SystemConfig
Step 3: Claude Code reads the file and SYSTEMCONFIG-USAGE-GUIDE.md
Step 4: Claude Code updates the code directly in your project
Step 5: Review the changes and verify
Step 6: Repeat for next page
```

---

## 📝 PROMPT TEMPLATE 1: Update Existing Page

### Use this prompt with Claude Code (web):

```markdown
Please update the file `[FILE_PATH]` to use dynamic affiliate discount and commission percentages from our SystemConfig system instead of hardcoded values.

## Context

Please read `docs/SYSTEMCONFIG-USAGE-GUIDE.md` which explains our SystemConfig system.

**Current Problem:**
This component has hardcoded percentages (20%, 20%, $23.20, etc.) that need to become dynamic so admin can change them from a dashboard.

**Required Changes:**

1. Import the `useAffiliateConfig` hook at the top of the component
2. Use the hook to get current discount and commission percentages
3. Replace ALL hardcoded percentages with dynamic values from the hook
4. Use the `calculateDiscountedPrice()` helper for price calculations
5. Ensure the component is a client component ('use client')

## Specific Requirements

**Import statement to add:**

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
```

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

## Expected Output

Please update the component with:

1. Import statement added
2. Hook called at top of component function
3. All hardcoded percentages replaced with dynamic values
4. All price calculations using the helper function
5. Component remains functional and looks identical to user
6. Only the data source changes (hardcoded → dynamic)

## Important Notes

- Keep all styling, layout, and UI exactly the same
- Only change the data source from hardcoded to dynamic
- Ensure the component is a client component ('use client')
- Do NOT change component structure, props, or exports
```

---

### How to Use This Prompt

**Step 1: Open Claude Code (web) in your project**

**Step 2: Use the prompt above, replacing `[FILE_PATH]` with the actual file path**

Example:
```
Please update the file `components/pricing-section.tsx` to use dynamic affiliate...
```

**Step 3: Claude Code will:**
- Read the file automatically
- Read the SYSTEMCONFIG-USAGE-GUIDE.md
- Update the code with the necessary changes
- Show you the changes in a diff

**Step 4: Review the changes and approve**

**Step 5: Verify the changes** (see Verification Checklist below)

---

## 🆕 Creating New Pages

### PROMPT TEMPLATE 2: Create New Page with SystemConfig

### Use this prompt with Claude Code (web):

```markdown
Please create a new [PAGE DESCRIPTION] component at `[FILE_PATH]` for my Next.js 15 application that displays affiliate discount and commission information.

## Important Requirements

Please read `docs/SYSTEMCONFIG-USAGE-GUIDE.md` which explains our centralized configuration system (SystemConfig).

**CRITICAL:** This component MUST use dynamic affiliate discount and commission percentages from the `useAffiliateConfig` hook. DO NOT hardcode any percentages like "20%" or prices like "$23.20".

## SystemConfig Integration Requirements

**1. Import the hook:**

```typescript
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
```

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
```

---

### How to Use This Prompt

**Step 1: Open Claude Code (web) in your project**

**Step 2: Copy the prompt above and customize it:**

Replace `[PAGE DESCRIPTION]` with your page type:
- "affiliate dashboard earnings page"
- "pricing comparison table"
- "affiliate program landing page"
- "checkout page with discount code input"

Replace `[FILE_PATH]` with where you want the file created:
- `components/affiliate/earnings-page.tsx`
- `components/pricing/comparison-table.tsx`

Replace `[DESCRIBE YOUR COMPONENT REQUIREMENTS HERE]` with specific features you want.

Replace `[DESCRIBE DESIGN/STYLE PREFERENCES HERE]` with your styling preferences.

**Step 3: Send to Claude Code (web)**

**Step 4: Claude Code will:**
- Read the SYSTEMCONFIG-USAGE-GUIDE.md
- Create the component file with proper SystemConfig integration
- Show you the complete code

**Step 5: Review the generated code to ensure:**
- ✅ It imports `useAffiliateConfig` from `@/lib/hooks/useAffiliateConfig`
- ✅ It calls the hook and destructures the values
- ✅ It uses `{discountPercent}%` not `20%`
- ✅ It uses `{commissionPercent}%` not `20%`
- ✅ It uses `calculateDiscountedPrice()` not hardcoded `$23.20`

**Step 6: If Claude Code still hardcodes values, use this follow-up prompt:**

```markdown
I notice the code still has hardcoded percentages (20%, $23.20, etc.).

Please revise the component to use the dynamic values from useAffiliateConfig hook:

- Replace all instances of "20%" (discount) with {discountPercent}%
- Replace all instances of "20%" (commission) with {commissionPercent}%
- Replace "$23.20" with ${calculateDiscountedPrice(29.00).toFixed(2)}
- Replace "$5.80" with ${(29.00 - calculateDiscountedPrice(29.00)).toFixed(2)}

The component should display different values if admin changes the percentages from 20%/20% to 25%/25% or any other combination.
```

---

## 🔍 Common Patterns to Update

### Pattern 1: Hardcoded Discount Percentage in Text

**Before:**

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

After Claude Code updates your code, verify these items:

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

**Prompt to Claude Code:**

```markdown
Please update the file `components/pricing-section.tsx` to use dynamic percentages from our SystemConfig system.

Read `docs/SYSTEMCONFIG-USAGE-GUIDE.md` for context.

Please update this component to:

1. Import useAffiliateConfig from '@/lib/hooks/useAffiliateConfig'
2. Replace hardcoded 20% discount with {discountPercent}%
3. Replace hardcoded 20% commission with {commissionPercent}%
4. Replace $23.20 with calculateDiscountedPrice(29.00)
5. Add 'use client' directive if not present
```

**Result (Claude Code will update the file):**

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

---

### Example 2: Affiliate Dashboard Earnings Widget

**Prompt to Claude Code:**

```markdown
Please update the file `components/affiliate/earnings-widget.tsx` to use dynamic commission percentages and prices from our SystemConfig system.

Read `docs/SYSTEMCONFIG-USAGE-GUIDE.md` for context.

Replace:
- Hardcoded commission percentage (20%)
- Hardcoded price calculations ($4.64)

With dynamic values from useAffiliateConfig hook.
```

**Result (Claude Code will update the file):**

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

**Prompt to Claude Code:**

```markdown
Please create a new checkout summary component at `components/checkout-summary.tsx` that:

1. Shows regular price and discounted price when affiliate code is applied
2. Uses SystemConfig for dynamic discount percentages
3. Reads `docs/SYSTEMCONFIG-USAGE-GUIDE.md` for the pattern

Props:
- hasCode: boolean (whether affiliate code is applied)

Must use useAffiliateConfig hook - no hardcoded percentages or prices.
```

**Result (Claude Code will create the file):**

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
   - Open Claude Code (web) in your project

2. **For Each Page:**
   - Ask Claude Code to update the file using PROMPT TEMPLATE 1
   - Claude Code reads the file and SYSTEMCONFIG-USAGE-GUIDE.md
   - Claude Code updates the file directly
   - Review the diff and approve changes
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
   - Know what page you want to create
   - Open Claude Code (web) in your project

2. **Create:**
   - Ask Claude Code to create the file using PROMPT TEMPLATE 2
   - Claude Code reads SYSTEMCONFIG-USAGE-GUIDE.md
   - Claude Code creates the file with proper SystemConfig integration
   - Review the code
   - Verify it uses the hook correctly

3. **Implement:**
   - Test the component
   - Verify dynamic values display
   - Commit

---

## 📋 Quick Reference Card

### The Golden Rules for Claude Code (Web) + SystemConfig

**✅ ALWAYS DO:**

- Reference SYSTEMCONFIG-USAGE-GUIDE.md in your prompts
- Use PROMPT TEMPLATE 1 for updating existing pages
- Use PROMPT TEMPLATE 2 for creating new pages
- Verify the code uses `useAffiliateConfig()` hook
- Check for hardcoded percentages and ask Claude Code to replace them

**❌ NEVER DO:**

- Ask Claude Code to create affiliate-related pages without mentioning SystemConfig
- Accept code with hardcoded percentages like 20%, 20%, $23.20, etc.
- Skip referencing SYSTEMCONFIG-USAGE-GUIDE.md in your prompts
- Accept code with hardcoded values without requesting fixes

**🔍 SEARCH FOR THESE IN CLAUDE CODE OUTPUT:**

- `20%` → Should be `{discountPercent}%` or `{commissionPercent}%`
- `$23.20` → Should be `${calculateDiscountedPrice(29.00).toFixed(2)}`
- `$5.80` → Should be calculated dynamically
- `$4.64` → Should be calculated dynamically
- `0.2` or `0.8` → Should use `discountPercent / 100`

**✅ VERIFY THESE IN CLAUDE CODE OUTPUT:**

- `import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';`
- `const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig();`
- `'use client'` at the top of the file
- No hardcoded percentages or prices

---

## 🎯 Success Criteria

You'll know your Claude Code (web) integration is successful when:

✅ **All existing pages updated:**

- All ~20 original pages now use `useAffiliateConfig()` hook
- No hardcoded percentages remain
- All pages compile without errors

✅ **New pages created correctly:**

- Any new page you create uses the hook from the start
- Claude Code consistently generates SystemConfig-compatible code
- No need to manually retrofit new pages

✅ **Admin can change percentages:**

- Admin changes commission from 20% to 25% in dashboard
- All pages update within 5 minutes
- No code deployment needed

✅ **Developers understand the system:**

- Team knows to reference SYSTEMCONFIG-USAGE-GUIDE.md when using Claude Code
- Team uses the prompt templates
- Team verifies generated code before accepting

---

## 📞 Need Help?

If Claude Code generates code that still has hardcoded values:

**Use this follow-up prompt:**

```markdown
I see the code still has hardcoded values. Please review `docs/SYSTEMCONFIG-USAGE-GUIDE.md` again and update the code to:

1. Import: `import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';`
2. Use hook: `const { discountPercent, commissionPercent, calculateDiscountedPrice } = useAffiliateConfig();`
3. Replace ALL instances of:
   - "20%" (discount) → `{discountPercent}%`
   - "20%" (commission) → `{commissionPercent}%`
   - "$23.20" → `${calculateDiscountedPrice(29.00).toFixed(2)}`
   - "$5.80" → `${(29.00 - calculateDiscountedPrice(29.00)).toFixed(2)}`
   - "$4.64" → `${(calculateDiscountedPrice(29.00) * (commissionPercent / 100)).toFixed(2)}`

Please provide the complete updated component with NO hardcoded percentages or prices.
```

---

## 🚀 Advantages of Claude Code (Web)

**Compared to previous v0.dev workflow:**

✅ **Direct File Access**
- Claude Code reads files directly from your project
- No need to manually upload guide documents
- Seamless integration with your codebase

✅ **In-Place Editing**
- Claude Code edits files directly in your project
- No copy/paste needed
- See diffs before approving changes

✅ **Context Awareness**
- Claude Code understands your full project structure
- Can reference other files and patterns
- More consistent code generation

✅ **Interactive Workflow**
- Ask follow-up questions immediately
- Iterate on changes quickly
- Real-time verification

---

**Document Version:** 2.1.0
**Last Updated:** 2025-12-24
**For:** Trading Alerts SaaS V7 - SystemConfig Integration with Claude Code (Web)
**Source of Truth:** Part 17 Admin Portal (`/admin/settings/affiliate`)
