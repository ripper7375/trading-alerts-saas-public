# Part 18C: User Experience & Admin Dashboard (Vertical Slice 3 of 3) - Files Inventory

## Status Summary

- **Total Production Files:** 24 files
- **Total Test Files:** 3 files
- **Grand Total:** 27 files
- **Frontend Mirror Files:** 8 files (components, checkout page)

---

## Phase A: Payment UI Components (7 production + 2 test = 9 files)

| #   | File Path                                               | Type | Description                        |
| --- | ------------------------------------------------------- | ---- | ---------------------------------- |
| 1   | `components/payments/CountrySelector.tsx`               | NEW  | Country dropdown with flags        |
| 2   | `components/payments/PlanSelector.tsx`                  | NEW  | 3-day vs Monthly plan cards        |
| 3   | `components/payments/PaymentMethodSelector.tsx`         | NEW  | Payment method grid                |
| 4   | `components/payments/PriceDisplay.tsx`                  | NEW  | Local currency + USD display       |
| 5   | `components/payments/DiscountCodeInput.tsx`             | NEW  | Discount code input (monthly only) |
| 6   | `components/payments/PaymentButton.tsx`                 | NEW  | Payment submit button              |
| 7   | `components/payments/index.ts`                          | NEW  | Component exports barrel file      |
| T1  | `__tests__/components/payments/PlanSelector.test.tsx`   | TEST | Component test: Plan selector      |
| T2  | `__tests__/components/payments/PriceDisplay.test.tsx`   | TEST | Component test: Price display      |

### Component Features

**CountrySelector:**
- Dropdown with 8 supported countries
- Country flags display
- Auto-detect country from IP
- Currency display alongside country

**PlanSelector:**
- 3-Day plan card ($1.99 USD)
- Monthly plan card ($29.00 USD)
- Visual plan comparison
- Eligibility indicators

**PaymentMethodSelector:**
- Grid of payment methods per country
- Payment method icons/logos
- Method type badges (Bank, Wallet, QR, Card)
- Interactive selection

**PriceDisplay:**
- Local currency amount (primary)
- USD equivalent (secondary)
- Real-time conversion
- Exchange rate display

**DiscountCodeInput:**
- Input field with validation
- Apply button with loading state
- Success/error feedback
- Only enabled for monthly plan

**PaymentButton:**
- Submit button with loading state
- Disabled states handling
- Error display

---

## Phase B: Unified Checkout Page (1 production + 0 test = 1 file)

| #   | File Path               | Type | Description                        |
| --- | ----------------------- | ---- | ---------------------------------- |
| 8   | `app/checkout/page.tsx` | NEW  | Unified checkout (Stripe + dLocal) |

### Checkout Page Features

**Flow B: Unified Payment Flow** - Both Stripe and dLocal on same page

- **Stripe (Primary)**: International card payments shown first
  - Prominent card at top with shadow styling
  - Pay with Visa, Mastercard, American Express
  - PRO Monthly at $29/mo
  - Available for all users globally

- **dLocal (Secondary)**: Local payment methods shown below
  - Alternative option with dashed border styling
  - Country auto-detection to filter payment methods
  - 8 supported countries: IN, NG, PK, VN, ID, TH, ZA, TR
  - Local currency pricing with real-time conversion
  - 3-day plan eligibility checking (one-time per user)
  - Discount code application (monthly plan only)
  - Country-specific payment methods (UPI, Paytm, bank transfer, etc.)

---

## Phase C: Email Templates (5 production + 0 test = 5 files)

| #   | File Path                           | Type | Description                  |
| --- | ----------------------------------- | ---- | ---------------------------- |
| 9   | `emails/payment-confirmation.tsx`   | NEW  | Payment success email        |
| 10  | `emails/renewal-reminder.tsx`       | NEW  | 3-day before expiry reminder |
| 11  | `emails/subscription-expired.tsx`   | NEW  | Expired notification         |
| 12  | `emails/payment-failure.tsx`        | NEW  | Payment failed email         |
| 13  | `emails/index.ts`                   | NEW  | Email template exports       |

### Email Template Features

**Payment Confirmation:**
- Plan type and duration
- Amount paid (local + USD)
- Subscription expiry date
- Payment method used
- Manual renewal instructions (for dLocal)

**Renewal Reminder:**
- Days until expiry
- Current plan details
- Renewal link
- Price in local currency

**Subscription Expired:**
- Expiry confirmation
- Features now unavailable
- Re-subscribe CTA
- Pricing reminder

**Payment Failure:**
- Failure reason
- Retry instructions
- Alternative payment methods
- Support contact

---

## Phase D: Admin Fraud Dashboard (6 production + 0 test = 6 files)

| #   | File Path                                          | Type | Description                |
| --- | -------------------------------------------------- | ---- | -------------------------- |
| 14  | `app/(dashboard)/admin/fraud-alerts/page.tsx`      | NEW  | Fraud alerts list page     |
| 15  | `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` | NEW  | Fraud alert detail page    |
| 16  | `app/api/admin/fraud-alerts/route.ts`              | NEW  | GET/POST fraud alerts API  |
| 17  | `app/api/admin/fraud-alerts/[id]/route.ts`         | NEW  | GET/PUT single alert API   |
| 18  | `components/admin/FraudAlertCard.tsx`              | NEW  | Fraud alert card component |
| 19  | `components/admin/FraudPatternBadge.tsx`           | NEW  | Severity/pattern badge     |

### Fraud Dashboard Features

**Fraud Alert List Page:**
- Paginated list of fraud alerts
- Filter by status (New, Investigating, Resolved)
- Filter by severity (Low, Medium, High, Critical)
- Filter by pattern type
- Date range filter

**Fraud Alert Detail Page:**
- Full alert details
- User information
- Payment history
- Pattern analysis
- Investigation notes
- Resolution actions

**Fraud Alert API:**
- List alerts with filters
- Create new fraud alert
- Get single alert details
- Update alert status/resolution

**Fraud Patterns Detected:**
- Multiple 3-day plan attempts
- Rapid payment failures
- Country hopping
- Unusual payment methods
- High-value repeated failures

---

## Phase E: Part 12 Frontend Integration (2 production + 0 test = 2 files)

| #   | File Path                                  | Type   | Description                          |
| --- | ------------------------------------------ | ------ | ------------------------------------ |
| 20  | `app/(marketing)/pricing/page.tsx`         | MODIFY | Add dLocal support, 3-day plan       |
| 21  | `components/billing/subscription-card.tsx` | MODIFY | Show provider, manual renewal notice |

### Pricing Page Updates

- Display 3-day plan option
- Show local currency prices based on location
- dLocal vs Stripe provider indication
- Available payment methods by region

### Subscription Card Updates

- Display payment provider (Stripe or dLocal)
- Manual renewal notice for dLocal subscriptions
- Expiry date display
- Renewal button for dLocal (links to checkout)

---

## Phase F: Discount Validation API (1 production + 0 test = 1 file)

| #   | File Path                                            | Type | Lines | Description                 |
| --- | ---------------------------------------------------- | ---- | ----- | --------------------------- |
| 22  | `app/api/payments/dlocal/validate-discount/route.ts` | NEW  | 138   | POST validate discount code |

### Discount Validation Features

**Request:**
```json
{
  "code": "SAVE20",
  "planType": "MONTHLY"
}
```

**Response (Valid):**
```json
{
  "valid": true,
  "code": "SAVE20",
  "discountType": "PERCENTAGE",
  "discountValue": 20,
  "finalPrice": 23.20
}
```

**Response (Invalid):**
```json
{
  "valid": false,
  "error": "Code not found or expired"
}
```

**Validation Rules:**
- Discount codes only for MONTHLY plan
- Check code existence and expiry
- Verify usage limits
- Calculate final price after discount

---

## Phase G: E2E Tests (0 production + 1 test = 1 file)

| #   | File Path                                     | Type | Description                      |
| --- | --------------------------------------------- | ---- | -------------------------------- |
| T3  | `__tests__/e2e/dlocal-payment-flow.test.ts`   | TEST | End-to-end: Complete dLocal flow |

### E2E Test Coverage

- Country selection flow
- Plan selection (3-day vs monthly)
- Payment method selection
- Price display and conversion
- Discount code application
- Payment creation
- Webhook processing
- Subscription activation
- Email sending

---

## Frontend Mirror Files (8 files)

These files mirror the backend components for frontend deployment:

### Components
| File Path                                              | Mirrors                                      |
| ------------------------------------------------------ | -------------------------------------------- |
| `frontend/components/payments/CountrySelector.tsx`     | `components/payments/CountrySelector.tsx`    |
| `frontend/components/payments/PlanSelector.tsx`        | `components/payments/PlanSelector.tsx`       |
| `frontend/components/payments/PaymentMethodSelector.tsx` | `components/payments/PaymentMethodSelector.tsx` |
| `frontend/components/payments/PriceDisplay.tsx`        | `components/payments/PriceDisplay.tsx`       |
| `frontend/components/payments/DiscountCodeInput.tsx`   | `components/payments/DiscountCodeInput.tsx`  |
| `frontend/components/payments/PaymentButton.tsx`       | `components/payments/PaymentButton.tsx`      |
| `frontend/components/payments/index.ts`                | `components/payments/index.ts`               |

### Checkout Page
| File Path                          | Mirrors                   |
| ---------------------------------- | ------------------------- |
| `frontend/app/checkout/page.tsx`   | `app/checkout/page.tsx`   |

---

## User Journey Flow

```
┌─────────────────────────────────────────────────────────────┐
│       Unified Payment Flow (Flow B) - Stripe Primary        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User visits /pricing or /checkout                       │
│     └── Country auto-detected via IP (for dLocal options)   │
│                                                             │
│  2. Checkout Page displays TWO payment options:             │
│                                                             │
│     ┌─────────────────────────────────────────────────┐     │
│     │  PRIMARY: Stripe International Card Payment     │     │
│     │  ─────────────────────────────────────────────  │     │
│     │  • PRO Monthly: $29/mo                          │     │
│     │  • Visa, Mastercard, American Express           │     │
│     │  • [Pay with Card] button                       │     │
│     └─────────────────────────────────────────────────┘     │
│                                                             │
│     ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐     │
│     │  SECONDARY: dLocal Local Payment Methods        │     │
│     │  ─────────────────────────────────────────────  │     │
│     │  • Select country (auto-detected)               │     │
│     │  • Select plan (3-Day $1.99 or Monthly $29)     │     │
│     │  • Select local payment method                  │     │
│     │  • View price in local currency                 │     │
│     │  • Apply discount code (monthly only)           │     │
│     │  • [Pay with Local Method] button               │     │
│     └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘     │
│                                                             │
│  3. User chooses payment option:                            │
│                                                             │
│     OPTION A: Stripe (International Cards)                  │
│     ├── Click "Pay with Card"                               │
│     ├── Redirect to Stripe Checkout                         │
│     ├── Enter card details → Pay                            │
│     ├── Stripe webhook: checkout.session.completed          │
│     └── Subscription created → PRO tier unlocked            │
│                                                             │
│     OPTION B: dLocal (Local Payment Methods)                │
│     ├── Select country, plan, payment method                │
│     ├── Click "Pay with Local Method"                       │
│     ├── Redirect to dLocal payment page                     │
│     ├── Complete payment with local method                  │
│     ├── dLocal webhook: payment.paid                        │
│     └── Subscription created → PRO tier unlocked            │
│                                                             │
│  4. Success → Dashboard with PRO features unlocked          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Exports (`components/payments/index.ts`)

```typescript
export { CountrySelector } from './CountrySelector';
export { PlanSelector } from './PlanSelector';
export { PaymentMethodSelector } from './PaymentMethodSelector';
export { PriceDisplay } from './PriceDisplay';
export { DiscountCodeInput } from './DiscountCodeInput';
export { PaymentButton } from './PaymentButton';
```

---

## Total File Count

| Category                      | Production | Test | Total |
| ----------------------------- | ---------- | ---- | ----- |
| Phase A: UI Components        | 7          | 2    | 9     |
| Phase B: Checkout Page        | 1          | 0    | 1     |
| Phase C: Email Templates      | 5          | 0    | 5     |
| Phase D: Fraud Dashboard      | 6          | 0    | 6     |
| Phase E: Part 12 Integration  | 2          | 0    | 2     |
| Phase F: Discount API         | 1          | 0    | 1     |
| Phase G: E2E Tests            | 0          | 1    | 1     |
| **Total**                     | **22**     | **3**| **25**|
| Frontend Mirrors              | 8          | 0    | 8     |

---

## Complete Part 18 Summary

| Part   | Description                        | Production | Test | Total |
| ------ | ---------------------------------- | ---------- | ---- | ----- |
| 18A    | Payment Creation Flow              | 15         | 8    | 23    |
| 18B    | Subscription Lifecycle             | 15         | 4    | 19    |
| 18C    | User Experience & Admin            | 22         | 3    | 25    |
| **Total** | **dLocal Payment Integration**  | **52**     | **15**| **67**|
| Frontend Mirrors | All Parts                 | 21         | 0    | 21    |
