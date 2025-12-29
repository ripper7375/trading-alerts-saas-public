# Part 18B: dLocal Subscription Lifecycle Management (Vertical Slice 2 of 3) - List of files completion

## All 20 Files are completed

### Status Summary
- **Completed:** 20/20 files (100%)
- **Missing:** None
- **Note:** All dLocal subscription lifecycle management files verified and functional


### Phase A: Database Updates (1 production + 0 test = 1 file)

| #   | File Path              | Type   | Description                        |
| --- | ---------------------- | ------ | ---------------------------------- |
| 1   | `prisma/schema.prisma` | UPDATE | Add subscription fields for dLocal |

### Phase B: Services (3 production + 3 test = 6 files)

| #   | File Path                                          | Type | Description                          |
| --- | -------------------------------------------------- | ---- | ------------------------------------ |
| 2   | `lib/dlocal/three-day-validator.service.ts`        | NEW  | Anti-abuse validation for 3-day plan |
| 3   | `lib/cron/check-expiring-subscriptions.ts`         | NEW  | Send renewal reminders               |
| 4   | `lib/cron/downgrade-expired-subscriptions.ts`      | NEW  | Downgrade expired users to FREE      |
| T1  | `__tests__/lib/dlocal/three-day-validator.test.ts` | TEST | TDD: 3-day plan validation           |
| T2  | `__tests__/lib/cron/check-expiring.test.ts`        | TEST | TDD: Expiring subscription logic     |
| T3  | `__tests__/lib/cron/downgrade-expired.test.ts`     | TEST | TDD: Downgrade logic                 |

### Phase C: Enhanced Webhook (1 production + 1 test = 2 files)

| #   | File Path                                     | Type   | Description                                 |
| --- | --------------------------------------------- | ------ | ------------------------------------------- |
| 5   | `app/api/webhooks/dlocal/route.ts`            | MODIFY | Complete webhook with subscription creation |
| T4  | `__tests__/api/webhooks/dlocal/route.test.ts` | UPDATE | Test subscription creation                  |

### Phase D: Cron API Routes (2 production + 2 test = 4 files)

| #   | File Path                                               | Type | Description                  |
| --- | ------------------------------------------------------- | ---- | ---------------------------- |
| 6   | `app/api/cron/check-expiring-subscriptions/route.ts`    | NEW  | GET cron - send reminders    |
| 7   | `app/api/cron/downgrade-expired-subscriptions/route.ts` | NEW  | GET cron - downgrade expired |
| T5  | `__tests__/api/cron/check-expiring.test.ts`             | TEST | Unit test: Expiring cron     |
| T6  | `__tests__/api/cron/downgrade-expired.test.ts`          | TEST | Unit test: Downgrade cron    |

### Phase E: Part 12 API Integration (5 production + 0 test = 5 files)

| #   | File Path                          | Type   | Description                                    |
| --- | ---------------------------------- | ------ | ---------------------------------------------- |
| 8   | `app/api/subscription/route.ts`    | MODIFY | Return paymentProvider, handle both providers  |
| 9   | `app/api/invoices/route.ts`        | MODIFY | Include dLocal payments in results             |
| 10  | `lib/stripe/stripe.ts`             | MODIFY | Export provider type constants                 |
| 11  | `lib/stripe/webhook-handlers.ts`   | MODIFY | Add paymentProvider when creating subscription |
| 12  | `lib/email/subscription-emails.ts` | NEW    | Provider-specific email templates              |

### Phase F: Configuration (1 production + 0 test = 1 file)

| #   | File Path     | Type   | Description            |
| --- | ------------- | ------ | ---------------------- |
| 13  | `vercel.json` | UPDATE | Add cron job schedules |

### Phase G: Documentation (1 production + 0 test = 1 file)

| #   | File Path                 | Type | Description              |
| --- | ------------------------- | ---- | ------------------------ |
| 14  | `docs/part18b-handoff.md` | NEW  | Handoff doc for Part 18C |
