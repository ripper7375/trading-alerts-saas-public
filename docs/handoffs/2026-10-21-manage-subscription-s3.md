# Manage Subscription S3: execution report

**Date:** 2026-10-21 · **Branch:** `main` (on `1f0b9755`, the committed S2) · **Status:** BUILT and verified locally. **NOT committed, NOT pushed, NOT
deployed; NO migration** (the three switch columns were added by S2's migration, `20261021000000_add_subscription_management_fields`, which still has to be
applied before any deploy). Spec: [plan v2.1](./2026-10-21-manage-subscription-proposal.md) §10 row S3, §7 W5a and W5b, §3 decisions D2, D3, E2, E3 and E4
(the order was the pasted task; it carries those decisions, all settled).

**Entry state, confirmed against live code before the first edit:** `main` on `1f0b9755` with a clean tree (S1 and S2 are committed; the S2 report and
`current-state.md` still say "NOT committed"); `pendingPlanType`, `pendingPlanEffectiveAt` and `stripeScheduleId` exist in the four `Subscription`
declarations and are read by nothing; no change-plan route or page; `invoicePlan` took the first recurring line in both copies; the cancel route set
`cancel_at_period_end` with no thought for a schedule; `handleSubscriptionUpdated` (both) synced only the cancel flag; `processAffiliateCommission` and
money-service's `creditAffiliateCommission` counted invoices with a cap taken from the current invoice's interval.

## 1. What S3 does now

| Item                                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B8, `invoicePlan`**                         | Picks the subscription's own non-proration line (`type: 'subscription'`, `proration: false`) and never depends on line order, in both copies. The real prorated upgrade invoice lists the monthly credit line FIRST; the old code recorded it as MONTHLY at $29 (seen in test mode).                                                                                                                                                                                                  |
| **W5a quote**                                 | `GET /api/subscription/change-plan/preview?billingPeriod=yearly` → Stripe's upcoming invoice for the item moved to the yearly SystemConfig price (D3) → `{ amountDueNowUsd, prorationDate, renewsOn, yearlyPriceUsd, creditUsd, taxUsd, inTrial }`. Nothing is created or charged.                                                                                                                                                                                                    |
| **W5a upgrade, now**                          | `POST /api/subscription/change-plan` `{ billingPeriod: 'yearly', prorationDate }` → `subscriptions.update` with `always_invoice`, the quote's `proration_date` and `payment_behavior: 'error_if_incomplete'` (E2). A declined card or a 3-D Secure request is a 402 `PAYMENT_FAILED`: the user stays monthly and is not charged. In a free trial (E3) the price changes, nothing is charged, and the first charge at the trial end is the yearly price. The row and an e-mail follow. |
| **W5b switch to monthly at renewal**          | `POST` `{ billingPeriod: 'monthly' }` → a Stripe Subscription Schedule: phase 1 the current yearly item until `current_period_end`, phase 2 the monthly price, `proration_behavior: 'none'`, `end_behavior: 'release'`. Stores `pendingPlanType = 'MONTHLY'`, `pendingPlanEffectiveAt`, `stripeScheduleId`. No refund, no credit. E-mail "switch scheduled".                                                                                                                          |
| **Keep yearly (undo)**                        | `DELETE /api/subscription/change-plan` → releases the schedule, clears the three columns. Safe to repeat: a schedule Stripe already dropped is simply cleared.                                                                                                                                                                                                                                                                                                                        |
| **W3 cancel releases the schedule**           | Both cancel routes read Stripe's subscription, release any attached schedule (or the one the row names), clear the pending columns, and only then set `cancel_at_period_end`. Stripe REFUSES `cancel_at_period_end` while a schedule manages the subscription (seen in test mode).                                                                                                                                                                                                    |
| **B9, switch part (both webhooks)**           | `handleSubscriptionUpdated` clears the three pending columns, in the same write, when the subscription starts billing monthly while the row holds a pending switch (phase 2 started), and releases the schedule, which stays attached through phase 2. The checkout-completed upsert also resets the three columns for a returning user.                                                                                                                                              |
| **E4 affiliate commission**                   | Both copies count **months of lifetime covered** (monthly 1, yearly 12, the prorated upgrade invoice 12), cap 24, on the amount actually collected. An invoice earns commission when fewer than 24 months came before it; one that crosses month 24 is paid in full, the next is not. A subscription that never switches gets exactly the old result.                                                                                                                                 |
| **`subscription-actions.ts`** (byte-mirrored) | New actions `upgrade_to_yearly`, `switch_to_monthly`, `keep_yearly`; display state `DOWNGRADE_PENDING`; `parseChangePlanBody` and the proration-date bounds; `effectivePendingPlan`, `liveIntervalOf`, `scheduleIdOf`, `planTypeForInterval`, `sameUsdPrice`.                                                                                                                                                                                                                         |
| **`GET /api/subscription`**                   | Adds `subscription.pendingPlanChange`; `planType` follows Stripe's live interval; a row that says ACTIVE during a trial is read as TRIALING; the explicit `select` gained the two pending columns (F21).                                                                                                                                                                                                                                                                              |
| **Money-service**                             | `GET /v1/stripe/subscriptions/change-plan/preview`, `POST` and `DELETE /v1/stripe/subscriptions/change-plan` (behind the `Idempotency-Key` interceptor, except the quote), outbox events `SUBSCRIPTION_UPGRADED` and `SUBSCRIPTION_DOWNGRADE_SCHEDULED`; the monolith routes forward to them when `MIGRATE_WRITE_APIS_MONEY_STRIPE=true`.                                                                                                                                             |
| **Pages**                                     | `/settings/billing/change-plan` (both plans with SystemConfig prices and the annual saving, the quote with the proration spelled out, the no-refund explanation); `/settings/billing` gets the "Change billing period" link, the pending-switch banner with "Keep yearly" (a confirm dialog), the "Switching to monthly" badge and the `?done=upgraded` / `?done=switch` notices.                                                                                                     |
| **E-mails (19 locales)**                      | "Upgraded to yearly" (what was charged, the yearly price, the next billing date; the free-trial wording says nothing was charged and gives the first-charge date) and "switch to monthly scheduled" (the date, the monthly price); 18 keys in 18 message files (`en-GB` inherits); the copy in `operation-service` is identical (the mirror test holds it).                                                                                                                           |
| **Texts**                                     | 56 `billing.*` keys × 19 dictionaries, real translations in the 17 non-English ones (**my drafts**, §2 item 15); "Not now" and "Back to billing" reuse each dictionary's own S2 text.                                                                                                                                                                                                                                                                                                 |

## 2. Decisions I took that the order did not spell out

Each is small and reversible; none changes what a customer is charged beyond the order's own steps.

1. **Stripe behaviour was checked in test mode BEFORE building** (test clocks, test cards, a throwaway script; §3.2). It settled the plan §11 open points and shaped four
   things: (a) the credit line is first on the upgrade invoice, so B8 is real; (b) the billing cycle resets on an upgrade, the yearly period starts now, and the
   quote's `amount_due` equals the charge when `proration_date` is passed; (c) a declined card gives a 402 and changes nothing; (d) **`cancel_at_period_end` is refused
   while any schedule is attached, and the schedule stays attached through phase 2** (the month after a downgrade), which is why the webhook releases it, and why cancel
   and the upgrade release any live schedule they find, not only the one the row names.
2. **The quote's time is bounded on the server** (not older than 30 minutes, not more than 60 seconds ahead): a credit for unused time grows with an earlier date, so a
   trusted `prorationDate` would let a user buy a cheaper upgrade by sending the start of the period. An old quote is `PRORATION_EXPIRED` and the page asks again.
3. **Optional price guard:** the page sends back the price it showed (`expectedYearlyPriceUsd`, `expectedMonthlyPriceUsd`); if SystemConfig changed meanwhile the answer
   is 409 `PRICE_CHANGED` and nothing is charged or scheduled. Cheap (one config read, no Stripe call); omitted, nothing is checked.
4. **The upgrade route writes the row itself** (`planType`, `amountUsd`, the new period end, the pending columns cleared), because the free-trial switch invoices $0 and the
   invoice webhook skips $0 invoices. For a paid switch the webhook writes the same values. If that write fails after Stripe agreed, the route still answers success
   (the customer was charged) and logs it; the webhooks and `GET` (which reads Stripe's interval) bring the page in line.
5. **Stripe wins where it differs from the row** (`effectivePendingPlan`): a switch is pending only while a schedule is attached AND the subscription still bills yearly,
   so a schedule released in Stripe's dashboard, or a renewal whose webhook is late, cannot leave a switch on the page; without Stripe the stored date decides.
6. **`switch_to_monthly` is not offered during a free trial** (plan §6 lists none); `upgrade_to_yearly` is (E3). A failed payment, a scheduled cancellation and a dLocal plan
   offer neither. New refusal codes: `ALREADY_PENDING`, `NOT_PENDING`, `PRICE_CHANGED`, `PAYMENT_FAILED`, `PRORATION_EXPIRED`, `INVALID_PRORATION_DATE`,
   `INVALID_BILLING_PERIOD`, `INVALID_EXPECTED_PRICE`, `DLOCAL_NO_CHANGE`, `UNSUPPORTED_SUBSCRIPTION` (a subscription with more than one item is never touched),
   `PLAN_CHANGE_UNAVAILABLE` (503 without `STRIPE_PRO_PRICE_ID`), `CHANGE_PLAN_ERROR`, `KEEP_YEARLY_ERROR`, `PREVIEW_ERROR`.
7. **E4 needs the months of the EARLIER invoices, and nothing stores them** (no migration was allowed). The commission code asks Stripe once (`invoices.list` for the
   subscription, 100 invoices) and reads each invoice's months from its plan line; it asks only when an earlier commission exists. An earlier invoice Stripe cannot
   resolve (a commission row with no invoice id, an invoice outside the list, Stripe unreachable) counts as **the plan the row had before this invoice**, so a
   subscription that never switched is counted exactly as before and a failed lookup never stops a commission. `getMaxCommissionCycles` stays (tested) and is no longer
   used by the credit paths. Two existing monolith tests of the annual cap now give the row `planType: 'YEARLY'`, which is what a yearly subscriber's row says.
8. **Schedule details:** `proration_behavior: 'none'` in both phases (accepted by Stripe); `automatic_tax` and the default payment method of the current phase are carried
   into phase 2; no idempotency key on the schedule calls (a key would replay a released schedule if the user switches, undoes and switches again within 24 hours); the
   upgrade's key is `change-plan:<subscription>:yearly:<prorationDate>`, so a double click replays the same answer (verified: still two invoices).
9. **After a declined card the page fetches a fresh quote.** The quote's time is part of the key, so Stripe would replay the same refusal for the same quote even with a new
   card; a new quote makes the next attempt a new one. (Found in review; tested.)
10. **Releasing a schedule that is already released or gone counts as released** (checked against Stripe's real answers for both cases), so "Keep yearly" is repeatable.
11. **Cancel order:** release the schedule, clear the pending columns, then cancel in Stripe, then the row. If the Stripe cancel fails after the release, the user's pending
    switch is gone (they can ask again); the alternative, cancelling first, is refused by Stripe.
12. **E-mails:** the upgrade sends this e-mail AND the existing payment receipt (`invoice.payment_succeeded`); the order asked for the e-mail, so both go. The consumer
    skips (does not retry) an event whose details it cannot read, as it does for a resume with no date. Event names: `SUBSCRIPTION_UPGRADED`,
    `SUBSCRIPTION_DOWNGRADE_SCHEDULED`.
13. **Money-service has its own copy of the loader** (`loadPlanChangeContext` in the controller, mirroring `lib/stripe/plan-change-context.ts`), as S2 did for cancel and
    resume; both are tested. `StripeModule` needed no change (`AffiliateConfigService` was already provided).
14. **The checkout-completed upsert resets the three pending columns** (both stacks), like the three cancellation columns in S2: a payments file, your look please (§5).
15. **Texts:** the 56 page keys and the 18 e-mail keys are my drafts in 17 languages; no native reader has seen them. The pt-BR page texts follow the pt-BR dictionary's
    own words ("subscrição", "faturamento"), the e-mail follows the e-mail's ("assinatura").

## 3. Evidence

Run from `D:\SaaS` unless noted; all on the working tree described above.

| Check                                                             | Result                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root `npx tsc --noEmit`                                           | exit 0                                                                                                                                                                                                                                                                                                                    |
| root `npm run lint`                                               | 0 errors; 5 warnings, the same five as before S3, none in a file S3 touched                                                                                                                                                                                                                                               |
| `prettier --check --end-of-line auto` on every changed `.ts/.tsx` | clean                                                                                                                                                                                                                                                                                                                     |
| root `npm run test:ci`                                            | **586 suites passed, 0 failed, 5 skipped as before; 20,147 tests passed, 315 skipped as before** (S2: 581 suites, 19,713 tests). The first full run had two failures, `rollback-rehearsal.test.ts` and `user-select-projections.test.ts`, whose Stripe mocks lacked the two functions cancel now calls; fixed and re-run. |
| root `npm run build`                                              | exit 0; `/api/subscription/change-plan`, `/api/subscription/change-plan/preview` and `/settings/billing/change-plan` are in the route list (`next-env.d.ts` was rewritten by it and restored with `git checkout`)                                                                                                         |
| money-service `tsc --noEmit` and full Jest (scratch copy)         | exit 0; 76 suites, 1,085 tests, 0 failed (S2: 74 and 933)                                                                                                                                                                                                                                                                 |
| operation-service `tsc --noEmit` and full Jest                    | exit 0; 63 suites, 685 tests, 0 failed (S2: 63 and 653), the e-mail mirror test included                                                                                                                                                                                                                                  |
| 19-locale coverage                                                | `compulsory-translation-coverage`, `dictionary-placeholders`, the e-mail catalog and mirror tests are in the full run; both new e-mails are built in all 19 locales in `templates.test.ts`; the 56 page keys pass the placeholder check (the insert script also refuses a mismatch)                                       |
| **Stripe test mode, the shipped helpers** (§3.2)                  | **27 of 27 checks** against the real `lib/stripe/stripe.ts` functions                                                                                                                                                                                                                                                     |
| 46 deliberate defects (mutation check, §3.1)                      | all 46 killed by a failing assertion                                                                                                                                                                                                                                                                                      |
| browser: change-plan page and billing banner, 375 px, dark, RTL   | as expected, through a temporary harness that is deleted (§3.3)                                                                                                                                                                                                                                                           |

New and changed tests: `invoice-plan.test.ts` (20, both copies), `subscription-actions-plan-change.test.ts`, `stripe-plan-change.test.ts` and money-service's
`stripe.service.plan-change.spec.ts` (the same 38 cases against both Stripe wrappers), `subscription-change-plan.test.ts` (67, the three monolith routes),
`stripe-subscription.controller.plan-change.spec.ts` (money-service's three endpoints), `billing-change-plan.test.tsx` (52, both pages), and the S3 cases in
`commission-cap.test.ts` and `affiliate.constants.spec.ts`, `conversion-processor.service.spec.ts`, `webhook-handlers.test.ts`, `stripe-webhook.service.spec.ts`,
`subscription-get.test.ts`, `subscription-cancel.test.ts`, the cancel cases of the money-service controller spec, `templates.test.ts`, `email-senders.test.ts`, and in
operation-service the consumer and e-mail specs.

### 3.1 Mutation check

46 deliberate defects, each run with the targeted tests and the file restored byte for byte (sha256 checked each time); **all 46 were killed by a failing assertion**:
`invoicePlan` back to the first line (both copies) · the upgrade offered on a yearly plan · the switch offered in a trial · a quote time of 30 days · a pending switch that
ignores Stripe dropping the schedule or phase 2 · the upgrade without `error_if_incomplete`, without invoicing now, without the quote time · phase 2 prorated · `end_behavior:
'cancel'` · a failed schedule setup not taken back · cancel not releasing (both stacks) · the webhook keeping the pending columns, not releasing the schedule, or clearing
while still yearly (both stacks) · the cap computed one invoice late or early · a yearly invoice counted as 1 month · the fallback ignored · no Stripe lookup (both stacks) ·
`GET` reading the stored plan · a stale quote time accepted · a declined card as a 500 (both stacks) · no price guard · the row not written after an upgrade · a schedule left
behind when the row cannot be written (both stacks) · keep yearly not releasing · the trial not read from Stripe · no outbox event · an unknown event type in
operation-service · an e-mail sent without readable details · the trial wording not chosen · one copy of the e-mail templates changed alone · the page without the quote time,
or navigating after a declined card · Keep yearly shown in admin view. **One was first ALIVE** (admin view): my fetch stub did not answer `?view_as=user`, so that test never
rendered data; the stub is fixed and the mutant is killed.

### 3.2 What the Stripe checks showed (test mode, test clocks, throwaway scripts that are not in the repository)

Before building, a raw probe settled the plan §11 points. Afterwards a second script imported the shipped `lib/stripe/stripe.ts` and ran its functions (`server-only` stubbed
for plain Node); both refused a non-test key and printed no secret; every test clock was deleted afterwards (so were their customers and subscriptions).

- **Upgrade:** quote $270.35 (the $290 yearly price minus a $19.65 credit for the unused 21 of 31 days of a $29 month); the charge was the same $270.35; the invoice lists the monthly credit line
  FIRST (`invoiceitem`, `proration: true`), so the old `invoicePlan` read it as MONTHLY; the new one reads YEARLY at $290; `getInvoiceMonthsById` gives 12 for the upgrade invoice and 1
  for the first; a replay with the same key left exactly two invoices.
- **Declined card (E2):** `card_declined`, `isStripeCardError` true, the subscription still monthly with the same period, no new invoice.
- **Free trial (E3):** the quote is $0 and the date is the trial end; the update keeps `trialing`, the trial end and a $0 invoice; at the trial end the first charge is $290 yearly.
- **Downgrade (W5b):** two phases, phase 1 ending at `current_period_end`, `end_behavior: 'release'`; the live subscription points at the schedule and is still yearly;
  **`cancel_at_period_end` is refused while it is attached**; releasing it leaves a yearly subscription; releasing again, and a schedule that does not exist, both count as released;
  at the renewal the subscription bills monthly, the schedule is STILL attached (phase 2), and the renewal invoice is recorded MONTHLY at $29; after the release the user can cancel.
- The `customer.subscription.updated` event at the renewal carries `previous_attributes.items` moving from the yearly to the monthly price (what the webhook keys on).
- Test clocks advance at most two intervals at a time (a clock with a monthly phase: two months), and allow 3 customers per clock.

### 3.3 Browser

The real pages were rendered through a temporary development page (a `fetch` stub with the API's response shapes; **deleted**, `git status` shows nothing of it, the dev server is
stopped): the two plan cards, the quote with its calculation and the tax row, the pending-switch banner and badge under `dir="rtl"`, the Keep yearly dialog; 375 px with dark mode
(the `dark` class: `darkMode: 'class'`) and `scrollWidth == innerWidth` (no horizontal overflow). Non-English text in a browser was not seen (the dev server renders every
non-English language as English, S1 §4); the two pages' tests render German and Arabic from the real dictionaries.

## 4. Not verified, and found

- **A real webhook delivery** through the handlers to a database (event shapes read from Stripe, handlers proven against a mocked Prisma in both stacks), and **money-service over HTTP**
  (Nest's guard and the idempotency interceptor on the new endpoints; the controller's methods are tested directly). The monolith's forward of a GET with a query string and of a
  DELETE uses the existing helper's `method` option and was tested with the helper mocked.
- **The pages signed in** (the Executor never enters login credentials) and **no e-mail was sent** (no key used; built and checked in all 19 locales, not seen in a mail client).
- **A real 3-D Secure challenge.** E2 was proven with a declined card (a 402); a 3-D Secure request is mapped the same way by status (402) and by test, not by a real challenge.
- **Stripe Tax.** The phase options carry `automatic_tax` through, but the test account's quotes had no tax; a tax line on the quote is covered by a test, not by Stripe.
- **Found, not changed:** the upgrade sends a payment receipt AND the new e-mail (§2 item 12); `handleSubscriptionDeleted` still sends a second "canceled" e-mail at the period end
  (S2 §4); `STRIPE_PRO_PRICE_ID` is read when `lib/stripe/stripe.ts` is loaded, so the routes answer 503 if it is missing (a plan change needs it, as checkout does); the monolith's
  18 full-row reads of `Subscription` (S2 §4) still need the migration applied first.

## 5. Davin: before S3 is deployed

1. **Nothing new to migrate; S2's migration must already be applied** (S2 §5 item 1). S3 adds no column and no variable (`STRIPE_PRO_PRICE_ID` is already needed by checkout; confirm it is set on
   money-service as well as the monolith).
2. **Deploy order: the migration, operation-service, money-service, the monolith.** operation-service BEFORE money-service: a `SUBSCRIPTION_UPGRADED` or `SUBSCRIPTION_DOWNGRADE_SCHEDULED` event
   reaching an old operation-service is answered `skipped` (unrecognised) and counted as delivered, so those e-mails would be lost (`infrastructure.md`).
3. **Look at the payment files:** `lib/stripe/stripe.ts`, `lib/stripe/webhook-handlers.ts`, `money-service/src/stripe/stripe-webhook.service.ts`,
   `money-service/src/affiliate/conversion-processor.service.ts`, `lib/affiliate/constants.ts` (and its money-service copy), `lib/stripe/invoice-plan.ts` (B8). Above all:
   the **E4 reading** (an invoice that crosses month 24 is paid in full and the next is not; the lookup of earlier invoices in Stripe and its fallback, §2 item 7) and that the
   webhook now releases a schedule in Stripe.
4. ~~Decide the two e-mails on an upgrade~~ **DECIDED by Davin (2026-10-21): keep both** (the payment receipt and "upgraded to yearly", §2 item 12).
5. **Look at `/settings/billing` and `/settings/billing/change-plan` signed in, once**, ideally one real test-mode run on localhost (upgrade with a test card, a declining card,
   schedule and keep yearly), since the Executor cannot sign in.
6. The 56 page texts and 18 e-mail texts are drafts for a native reader.
7. The commit and the push, when you want them (the pre-commit hook re-sorts classes of each staged file).

## 6. For the S4 order

- `lib/stripe/subscription-actions.ts` (byte-mirrored into money-service) now holds the billing-period actions; S4 adds `renew` there. Every action is `[]` for dLocal today and
  `DLOCAL_NO_CHANGE` is the answer of the change-plan routes (plan §7 W6: the period is chosen at renewal).
- `GET /api/subscription` has `pendingPlanChange` and the live `planType`; `renewsAutomatically` (plan §9.1) is still to add, with the dLocal "Expires on" banner.
- The mirror test (`subscription-actions.test.ts`) fails on any difference between the two copies; after editing one, `cp` it over the other (both are CRLF).
- Stripe test clocks: two intervals at a time, 3 customers per clock (S2 §6); a script for dLocal-free S4 checks does not need them.
