# Part 18B: dLocal Subscription Lifecycle Management (Vertical Slice 2 of 3) - Files Inventory

## Status Summary

- **Total Production Files:** 15 files
- **Total Test Files:** 4 files
- **Grand Total:** 19 files

---

## Phase A: Database Updates (1 production + 0 test = 1 file)

| #   | File Path              | Type   | Description                        |
| --- | ---------------------- | ------ | ---------------------------------- |
| 1   | `prisma/schema.prisma` | UPDATE | Add subscription fields for dLocal |

### Database Changes

- Add `paymentProvider` field to Subscription model
- Add `expiresAt` field for manual renewal tracking
- Add `dLocalPaymentId` for linking to Payment records

---

## Phase B: Services (3 production + 3 test = 6 files)

| #   | File Path                                                    | Type | Lines | Description                          |
| --- | ------------------------------------------------------------ | ---- | ----- | ------------------------------------ |
| 2   | `lib/dlocal/three-day-validator.service.ts`                  | NEW  | 177   | Anti-abuse validation for 3-day plan |
| 3   | `lib/cron/check-expiring-subscriptions.ts`                   | NEW  | -     | Send renewal reminders               |
| 4   | `lib/cron/downgrade-expired-subscriptions.ts`                | NEW  | -     | Downgrade expired users to FREE      |
| T1  | `__tests__/lib/dlocal/three-day-validator.test.ts`           | TEST | -     | TDD: 3-day plan validation           |
| T2  | `__tests__/lib/cron/check-expiring-subscriptions.test.ts`    | TEST | -     | TDD: Expiring subscription logic     |
| T3  | `__tests__/lib/cron/downgrade-expired-subscriptions.test.ts` | TEST | -     | TDD: Downgrade logic                 |

### Three-Day Validator Service Capabilities

- `canPurchaseThreeDayPlan()` - Check 3-day plan eligibility
- `markThreeDayPlanUsed()` - Mark plan as used (anti-abuse)
- Lifetime limit enforcement (once per account)
- Active subscription checking
- `ThreeDayPlanEligibilityResult` interface

### Cron Job Capabilities

**Check Expiring Subscriptions:**

- Find subscriptions expiring in 3 days
- Send renewal reminder emails
- Log processing results

**Downgrade Expired Subscriptions:**

- Find expired subscriptions (past expiresAt date)
- Update subscription status to EXPIRED
- Downgrade user tier to FREE
- Send expiry notification email

---

## Phase C: Enhanced Webhook (1 production + 1 test = 2 files)

| #   | File Path                                     | Type   | Description                                 |
| --- | --------------------------------------------- | ------ | ------------------------------------------- |
| 5   | `app/api/webhooks/dlocal/route.ts`            | MODIFY | Complete webhook with subscription creation |
| T4  | `__tests__/api/webhooks/dlocal/route.test.ts` | UPDATE | Test subscription creation                  |

### Webhook Enhancements

**Events Handled:**

- `payment.paid` - Payment successful → Create subscription, upgrade to PRO
- `payment.rejected` - Payment failed → Update status, send failure email
- `payment.cancelled` - Payment cancelled → Update status

**Process Flow (payment.paid):**

1. Verify webhook signature (HMAC-SHA256)
2. Find payment in database
3. Update payment status to COMPLETED
4. Create/update subscription with correct duration
5. Upgrade user to PRO tier
6. Mark 3-day plan as used (if applicable)
7. Send confirmation email

---

## Phase D: Cron API Routes (2 production + 0 test = 2 files)

| #   | File Path                                               | Type | Description                  |
| --- | ------------------------------------------------------- | ---- | ---------------------------- |
| 6   | `app/api/cron/check-expiring-subscriptions/route.ts`    | NEW  | GET cron - send reminders    |
| 7   | `app/api/cron/downgrade-expired-subscriptions/route.ts` | NEW  | GET cron - downgrade expired |

### Cron Endpoints

| Method | Endpoint                                    | Schedule        | Description             |
| ------ | ------------------------------------------- | --------------- | ----------------------- |
| GET    | `/api/cron/check-expiring-subscriptions`    | Daily 00:00 UTC | Send renewal reminders  |
| GET    | `/api/cron/downgrade-expired-subscriptions` | Daily 01:00 UTC | Downgrade expired users |

---

## Phase E: 3-Day Eligibility API (1 production + 0 test = 1 file)

| #   | File Path                                                      | Type | Lines | Description                 |
| --- | -------------------------------------------------------------- | ---- | ----- | --------------------------- |
| 8   | `app/api/payments/dlocal/check-three-day-eligibility/route.ts` | NEW  | 64    | GET check 3-day eligibility |

### Eligibility Check Response

```json
{
  "eligible": true,
  "reason": null
}
```

Or if not eligible:

```json
{
  "eligible": false,
  "reason": "ALREADY_USED" | "ACTIVE_SUBSCRIPTION"
}
```

---

## Phase F: Part 12 API Integration (5 production + 0 test = 5 files)

| #   | File Path                          | Type   | Description                                    |
| --- | ---------------------------------- | ------ | ---------------------------------------------- |
| 9   | `app/api/subscription/route.ts`    | MODIFY | Return paymentProvider, handle both providers  |
| 10  | `app/api/invoices/route.ts`        | MODIFY | Include dLocal payments in results             |
| 11  | `lib/stripe/stripe.ts`             | MODIFY | Export provider type constants                 |
| 12  | `lib/stripe/webhook-handlers.ts`   | MODIFY | Add paymentProvider when creating subscription |
| 13  | `lib/email/subscription-emails.ts` | NEW    | Provider-specific email templates              |

### Integration Details

**Subscription API Changes:**

- Return `paymentProvider` field (STRIPE or DLOCAL)
- Handle both provider types in subscription queries
- Support manual renewal status for dLocal subscriptions

**Invoice API Changes:**

- Include dLocal payments in invoice listing
- Merge payment records from both providers
- Sort by date across providers

**Stripe Integration:**

- Export `PaymentProvider` constants
- Add `paymentProvider: 'STRIPE'` to subscription creation

**Email Templates:**

- Provider-specific email content
- Different renewal instructions for dLocal (manual) vs Stripe (auto)

---

## Phase G: Configuration (1 production + 0 test = 1 file)

| #   | File Path     | Type   | Description            |
| --- | ------------- | ------ | ---------------------- |
| 14  | `vercel.json` | UPDATE | Add cron job schedules |

### Vercel Cron Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-subscriptions",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/downgrade-expired-subscriptions",
      "schedule": "0 1 * * *"
    }
  ]
}
```

---

## Phase H: Documentation (1 production + 0 test = 1 file)

| #   | File Path                 | Type | Description              |
| --- | ------------------------- | ---- | ------------------------ |
| 15  | `docs/part18b-handoff.md` | NEW  | Handoff doc for Part 18C |

---

## Subscription Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────┐
│              dLocal Subscription Lifecycle                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. User initiates payment (Part 18A)                      │
│     └── Payment status: PENDING                            │
│                                                             │
│  2. dLocal webhook: payment.paid                           │
│     ├── Update payment status: COMPLETED                   │
│     ├── Create subscription (3-day or 30-day)              │
│     ├── Upgrade user tier: FREE → PRO                      │
│     ├── Mark 3-day plan used (if applicable)               │
│     └── Send confirmation email                            │
│                                                             │
│  3. Daily cron: check-expiring-subscriptions               │
│     ├── Find subscriptions expiring in 3 days              │
│     └── Send renewal reminder emails                       │
│                                                             │
│  4. Daily cron: downgrade-expired-subscriptions            │
│     ├── Find expired subscriptions                         │
│     ├── Update status: ACTIVE → EXPIRED                    │
│     ├── Downgrade tier: PRO → FREE                         │
│     └── Send expiry notification                           │
│                                                             │
│  5. User manually renews (restart from step 1)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Anti-Abuse Measures

| Measure                   | Implementation                          |
| ------------------------- | --------------------------------------- |
| 3-Day Plan Lifetime Limit | One 3-day plan per user account         |
| Active Subscription Check | Prevent purchase if already PRO         |
| Payment History Tracking  | Track all dLocal payments per user      |
| Webhook Signature Verify  | HMAC-SHA256 signature validation        |
| Idempotent Processing     | Prevent duplicate subscription creation |

---

## Total File Count

| Category                     | Production | Test  | Total  |
| ---------------------------- | ---------- | ----- | ------ |
| Phase A: Database            | 1          | 0     | 1      |
| Phase B: Services            | 3          | 3     | 6      |
| Phase C: Enhanced Webhook    | 1          | 1     | 2      |
| Phase D: Cron API Routes     | 2          | 0     | 2      |
| Phase E: Eligibility API     | 1          | 0     | 1      |
| Phase F: Part 12 Integration | 5          | 0     | 5      |
| Phase G: Configuration       | 1          | 0     | 1      |
| Phase H: Documentation       | 1          | 0     | 1      |
| **Total**                    | **15**     | **4** | **19** |

---

## Update 2026-07-04

No new files; `app/api/webhooks/dlocal/route.ts` and `vercel.json` were **modified** (still
complete) as part of the shared affiliate-conversion refactor and cron-schedule touch-up.
