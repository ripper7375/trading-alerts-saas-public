# Manage Subscription S2: execution report

**Date:** 2026-10-21 · **Branch:** `main` (on `48bf2bcf`, the committed S1) · **Status:** BUILT and verified locally. **NOT committed, NOT pushed, NOT
deployed; one migration FILE, NOT applied to any real database.** Spec: [plan v2.1](./2026-10-21-manage-subscription-proposal.md) §10 row S2, §9.3, §7 W3 and W4
(the order was the pasted task; it carries decisions D1 to D8 and E1 to E4, all settled).

**Entry state, confirmed against live code before the first edit:** `main` on `48bf2bcf` with a clean tree (S1 is committed; `current-state.md` still said "NOT
committed", corrected in this session); none of the six columns in any of the four declarations of `Subscription`; `app/api/subscription/route.ts` and
`cancel/route.ts` read `Subscription` with no `select`; the cancel route ended PRO at once and recorded the cancellation even when Stripe failed; the billing
page's Cancel button was the immediate-cancel dialog and the collected reason was never sent; neither webhook read `cancel_at_period_end`; the latest migration
was `20261019000000_add_user_deleted_at`.

## 1. What S2 does now

| Item                          | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The one migration**         | `prisma/migrations/20261021000000_add_subscription_management_fields/migration.sql`: six additive columns on `"Subscription"` (`cancelAtPeriodEnd BOOLEAN NOT NULL DEFAULT false`, `cancelRequestedAt`, `cancellationReason`, `pendingPlanType`, `pendingPlanEffectiveAt`, `stripeScheduleId`), with the pre-flight query, the rollout order and the rollback in its header (the F21 pattern). It is the statement Prisma itself generates for the two schemas. |
| **Schema sync**               | The six fields in `prisma/non-market-data/schema.prisma`, `money-service/prisma/schema.prisma` (mirrored by hand) and `types/prisma-stubs.d.ts`; `operation-service` unchanged (its 4-column read needs none). New guard `__tests__/lib/stripe/subscription-schema-sync.test.ts` compares the four declarations field by field and reads the migration.                                                                                                         |
| **F21 hardening**             | `GET /api/subscription` and `POST /api/subscription/cancel` read `Subscription` with an explicit `select`; so do the new resume route and money-service's cancel and resume. (18 other reads still name no columns, §4.)                                                                                                                                                                                                                                        |
| **W3 cancel at period end**   | `POST /api/subscription/cancel` `{ reason }` → `stripe.subscriptions.update(id, { cancel_at_period_end: true })` first, then the row (`cancelAtPeriodEnd`, `cancelRequestedAt`, `cancellationReason`), then the "canceled, access until" e-mail with `cancelAt` (monolith: sent directly; money-service: outbox `SUBSCRIPTION_CANCELLED` with `cancelAt`, in the same transaction). PRO and `status` are untouched until the period ends.                       |
| **D8 dLocal**                 | `DLOCAL_NO_CANCEL` (400, with `expiresAt`) from both stacks; `allowedActions` has no `cancel` for dLocal; the billing page shows "prepaid, ends on {date}, does not renew" in place of a button.                                                                                                                                                                                                                                                                |
| **Cancel page**               | `/settings/billing/cancel`: step 1 what you keep until the end of the paid period (a trial: "ends on {date}, you will not be charged") and which three PRO features pause; step 2 the reason (optional: a code or "other: …"); step 3 confirm. The billing page's immediate-cancel dialog is now a link to it.                                                                                                                                                  |
| **W4 resume**                 | `POST /api/subscription/resume` (monolith, forwarded to `POST /v1/stripe/subscriptions/resume` when `MIGRATE_WRITE_APIS_MONEY_STRIPE=true`): only while `CANCEL_SCHEDULED` and before the period end; Stripe `cancel_at_period_end: false`, the three columns cleared, outbox `SUBSCRIPTION_RESUMED`, new "subscription resumed" e-mail. On the page: "Resume subscription" in the banner and the plan card, behind a confirm dialog.                           |
| **B9 webhook sync**           | `handleSubscriptionUpdated` in `lib/stripe/webhook-handlers.ts` and `money-service/src/stripe/stripe-webhook.service.ts` stores `cancelAtPeriodEnd` from Stripe (and clears the "when" and "why" when it is off). `handleSubscriptionDeleted` is unchanged: it downgrades to FREE and clears `affiliateCodeId` when the period really ends.                                                                                                                     |
| **`subscription-actions.ts`** | (byte-mirrored) adds the `resume` action, the `CANCEL_SCHEDULED` display state, `cancelAtPeriodEnd` and `currentPeriodEnd` in the facts, no `cancel` for dLocal, and `parseCancellationReason` (one reason rule for both stacks).                                                                                                                                                                                                                               |
| **E-mails (19 locales)**      | "Cancel scheduled" is the existing "canceled" e-mail (it already prints the access-until date). New `buildSubscriptionResumedEmail`, 7 keys in 18 message files (`en-GB` inherits English); `lib/email/i18n/` and `operation-service/src/email/i18n/` are identical.                                                                                                                                                                                            |
| **Texts**                     | 39 new `billing.*` keys × 19 dictionaries, real translations in the 17 non-English ones (**my drafts**; §2 item 14).                                                                                                                                                                                                                                                                                                                                            |

## 2. Decisions I took that the order did not spell out

Each is small and reversible; none changes what a customer is charged.

1. **Stripe first, then the database.** The old route recorded the cancellation even when Stripe failed. Now a Stripe failure writes nothing and answers 500
   `CANCEL_ERROR`; if the database write fails after Stripe agreed, the flag is already set in Stripe, the webhook syncs it, and a retry is allowed.
2. **`GET /api/subscription` prefers Stripe's live `cancel_at_period_end` and `current_period_end`** over the stored columns (the stored values are the fallback when
   Stripe cannot be reached). Reason: checkout stores `now + 30 days` as the period end even for a 7-day trial until a webhook corrects it, and the cancel page
   promises that date; a cancellation scheduled in Stripe's dashboard also shows at once.
3. **The checkout-completed upsert (both stacks) resets the three cancellation columns.** `Subscription.userId` is unique, so a user who cancelled and subscribes
   again reuses the row and would be shown a stale "PRO ends on …". It is one line in each payment handler and touches no money, tier or grant: **a payments file,
   your look please (§5).**
4. **The webhook leaves `cancelRequestedAt` and `cancellationReason` alone while `cancel_at_period_end` is true, and clears them when it is false.**
5. **A failed payment outranks a scheduled cancellation** (`PAST_DUE` and `UNPAID` keep Pay now / Update card; no resume, no second cancel), and only a **Stripe** row
   can be `CANCEL_SCHEDULED` (a stale flag on a dLocal row is ignored).
6. **The reason** is optional free text of at most 500 characters (control characters become spaces; longer or not a string: 400 `INVALID_REASON`). The form
   sends a code (`too_expensive`, `not_using`, `missing_features`, `switching`, `other`) or `other: <the user's words>`.
7. **New refusal codes** (the order named one): `ALREADY_SCHEDULED`, `NOT_SCHEDULED`, `PERIOD_ENDED`, `NO_STRIPE_SUBSCRIPTION`, `INVALID_REASON`, `ACTION_NOT_ALLOWED`.
8. **Cancel and resume in money-service sit behind the `Idempotency-Key` interceptor** (plan §9.1); the card-session route does not (a cached portal link would be dead).
9. **The outbox payload for a scheduled cancellation** keeps `tier: 'PRO'` (it said `FREE` for the old immediate cancel) and adds `scheduled: true`; the consumer reads
   only `cancelAt`. operation-service **skips** (does not retry) a `SUBSCRIPTION_RESUMED` event with no readable `renewsAt`, as it does for a missing price.
10. **A dLocal PRO user gets a one-line "prepaid, ends on {date}" note** (one key). Without it, removing their Cancel button left the plan card silent. S4 still owns
    the dLocal expiring banner.
11. **`trialStatus` is not touched when the cancellation is scheduled**; the existing deleted handler sets `CANCELLED` when the trial really ends.
12. **Left in place, now unused:** `cancelSubscription` in `lib/stripe/stripe.ts` and in money-service's `StripeService` (the immediate cancel), and the old
    `billing.cancel_confirm_body` row ("cancelled immediately") in the 19 dictionaries.
13. **The pt-BR dictionary says "subscrição"** (it did before S2; the pt-BR **e-mail** says "assinatura"); the new pt-BR page texts follow the dictionary so one page does
    not mix two words.
14. **Texts:** the 39 page keys and the 7 e-mail keys are my drafts in 17 languages; no native reader has seen them.

## 3. Evidence

Run from `D:\SaaS` unless noted; all on the working tree described above.

| Check                                                                                | Result                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root `npx tsc --noEmit`                                                              | exit 0 (three times: after the code, after the formatting, after the last test edit)                                                                                                                                                                                                   |
| root `npm run lint`                                                                  | 0 errors; 5 warnings, the same five as before S2, none in a file S2 touched                                                                                                                                                                                                            |
| `prettier --check --end-of-line auto` on every changed `.ts`/`.tsx`                  | clean (every file was clean at HEAD, so `--write` on exactly these files only reformatted S2's own lines)                                                                                                                                                                              |
| root `npm run test:ci`                                                               | **581 suites passed, 0 failed, 5 skipped as before; 19,713 tests passed, 315 skipped as before**, exit 0 (S1: 577 suites, 19,480 tests). The first full run had one failure, `rollback-rehearsal.test.ts`, which asserted the old immediate-cancel answer; it asserts the new one now. |
| root `npm run build`                                                                 | exit 0; `/api/subscription/resume` and `/settings/billing/cancel` are in the route list (`next-env.d.ts` was rewritten by it and restored with `git checkout`)                                                                                                                         |
| money-service `tsc --noEmit` and full Jest (scratch copy, Prisma client regenerated) | exit 0; 74 suites, 933 tests, 0 failed (S1: 884)                                                                                                                                                                                                                                       |
| operation-service `tsc --noEmit` and full Jest                                       | exit 0; 63 suites, 653 tests, 0 failed (S1: 640), the e-mail mirror test included                                                                                                                                                                                                      |
| 19-locale coverage                                                                   | `compulsory-translation-coverage`, `dictionary-placeholders` and the e-mail catalog and mirror tests are in the full run; the resumed e-mail is built in all 19 locales in `templates.test.ts` and its senders are checked in `email-senders.test.ts`                                  |
| 25 deliberate defects (mutation check)                                               | all 25 killed by a failing assertion (§3.1)                                                                                                                                                                                                                                            |
| the migration on a scratch PostgreSQL 18.1                                           | pre-flight 0 → 6, existing rows keep their data, no drift, rollback and re-apply work (§3.2)                                                                                                                                                                                           |
| Stripe test mode: cancel → verify → resume → verify, trial, period end               | as expected in every case (§3.3)                                                                                                                                                                                                                                                       |
| browser: banner, resume, the three steps, 375 px, dark, RTL                          | as expected, through a temporary harness that is deleted (§3.4)                                                                                                                                                                                                                        |

New and changed tests: `subscription-schema-sync.test.ts` (21), `subscription-cancel.test.ts` and `subscription-resume.test.ts` (monolith routes), `billing-cancel.test.tsx`
(25, the three steps, the refusals, ar/de/ja from the real dictionaries), the S2 cases in `billing.test.tsx`, `subscription-get.test.ts`, `subscription-actions.test.ts`,
`webhook-handlers.test.ts`, `templates.test.ts` (resumed e-mail in 19 locales), `email-senders.test.ts`, `user-select-projections.test.ts` and
`rollback-rehearsal.test.ts` (both asserted the old immediate-cancel answer and now assert the new one); in money-service the controller, webhook and Stripe-service specs;
in operation-service the consumer and e-mail specs.

### 3.1 Mutation check

25 deliberate defects, each run with the targeted tests and the file restored byte for byte (sha256 checked each time); **all 25 were killed by a failing assertion**:
dLocal gets `cancel` again (both copies) · resume offered after the period end · one copy of `subscription-actions.ts` changed alone (the mirror test) · the
`ALREADY_SCHEDULED` check removed · dLocal let through the cancel route · the reason not stored · Stripe never asked · the resume `PERIOD_ENDED` check removed ·
the reason left behind by resume · `GET` ignoring Stripe's live flag · `GET` with a changed `select` · the webhook flag always true (monolith) · the checkout reset
removed · a money-service column type drifting · the billing page never `CANCEL_SCHEDULED` · the cancel page without its refusal · its reason not sent · the resumed
e-mail without its date · the consumer retrying (not skipping) a dateless resume · `SUBSCRIPTION_RESUMED` unknown again · money-service: dLocal let through, the wrong
outbox event type, `NOT_SCHEDULED` removed, the webhook flag read as scheduled when missing, the Stripe call ignoring the flag. Two first versions of the money-service
mutants broke compilation instead of an assertion; they were replaced by versions that compile and are killed by assertions.

### 3.2 The migration on a real PostgreSQL 18.1 (scratch server, no real database touched)

A throwaway server in the scratchpad (hidden, stopped afterwards): the schema at HEAD made by Prisma, two rows inserted (an `ACTIVE` one and a `PAST_DUE` one), then
the migration file applied. The pre-flight query from its header returned **0 columns before and 6 after**; both rows kept their data and got `cancelAtPeriodEnd =
false` and NULL in the other five; the column types are `boolean NOT NULL DEFAULT false`, `timestamp(3)` ×2 and `text` ×3; `prisma migrate diff` against the new
schema says **no difference** (exit 0) and against the old schema says there is one (exit 2); a write of the new columns works; the **documented rollback** drops all
six (pre-flight 0) and the migration applies again (6). The repo's own `prisma.config.ts` reads `.env.local`, so the drift check used a throwaway config naming only the
scratch server (deleted afterwards).

### 3.3 Stripe test mode (no login needed)

A throwaway script (not in the repository) used the test key from `.env.local`, refused to run on a live key, and used a test clock, test customers with `pm_card_visa`
and a test product, all deleted afterwards. The calls are the ones the code makes, `subscriptions.update(id, { cancel_at_period_end })`:

- **Cancel:** `cancel_at_period_end` false → true; `cancel_at` equals `current_period_end`; a retrieve agrees; a second cancel call is accepted (idempotent).
- **Resume:** true → false and `cancel_at` back to null; a second resume call is accepted; **after the clock passed the period end the resumed subscriptions were
  `active`, renewed for another month and paid.**
- **Cancelled, then the period ends:** after the clock passed the period end the subscription was `canceled` and Stripe sent `customer.subscription.deleted` with
  `cancel_at_period_end: true` and `cancel_at` = the period end (what `handleSubscriptionDeleted` reads).
- **Trial:** `cancel_at`, `current_period_end` and `trial_end` were the same instant; after the clock passed it the subscription was `canceled` and the only invoice
  was **paid / 0.00** (no charge).
- **What the webhook receives:** `customer.subscription.updated` events with `previous_attributes.cancel_at_period_end` false → true on cancel and true → false on
  resume, status `active` (or `trialing`) throughout.
- Stripe's test-clock limits (the first runs hit them): 3 customers per clock and 3 subscriptions per customer.

### 3.4 Browser

The real billing and cancel pages were rendered through a temporary development page (a `fetch` stub with the API's response shapes; **deleted**, `git status` shows
nothing of it, the dev server is stopped): the scheduled banner, the "Cancellation scheduled" badge, both Resume buttons and "PRO ends on:"; the resume dialog and a
real click on "Yes, resume" (the request was sent, the banner went, the notice and the ordinary PRO view came back); the three cancel steps with a real click on
"Confirm Cancellation" (`POST {"reason":"other: found a cheaper tool"}`, then navigation to `/settings/billing`, which the harness's missing login sent on to `/login`);
the trial wording; 375 px in dark mode (no horizontal overflow); the cancel page under `dir="rtl"` (the progress bar fills from the right, list markers and buttons
mirror, no overflow).

## 4. Not verified, and found

- **A real webhook delivery** from Stripe through the handlers to a database. The event shapes were read from Stripe and the handlers are proven by unit tests against a
  mocked Prisma in both stacks; the join between them was not run.
- **The pages signed in** (the Executor never enters login credentials), and **the monolith → money-service forward** with a real token and Redis: each side is tested
  alone (the forwarder is mocked, money-service's controller is called directly), the HTTP path through Nest's guard and the idempotency interceptor was not run.
- **No e-mail was sent** (no key used); the resumed e-mail is built and checked in all 19 locales and not seen in a mail client. Non-English **text in a browser** was not
  seen (the dev server renders every non-English language as English, S1 §4); three page tests render Arabic, German and Japanese from the real dictionaries.
- **Found, not changed: the "canceled" e-mail goes out twice.** It is sent when the cancellation is scheduled (this session) and again when Stripe ends the
  subscription at the period end, because both stacks' `handleSubscriptionDeleted` send it for every deletion (monolith: `sendSubscriptionCanceledEmail`; money-service: the
  outbox event with `cancelAt`). The second one says "Subscription Canceled, access until <that day>". The order said that handler continues as it is. Suggested: skip it
  when the row's `cancelAtPeriodEnd` was true (a small change in both handlers).
- **Found, not changed: 18 reads of `Subscription` still name no columns** and will fail until the migration is applied, so the apply-first order is mandatory (§5):
  monolith: `app/admin/users/[id]/page.tsx:144`, `lib/stripe/webhook-handlers.ts` (lines 194, 270, 348, 429, 639), `app/api/webhooks/dlocal/route.ts` (204, 243),
  `app/api/payments/dlocal/create/route.ts:133`, `app/api/invoices/route.ts:172`; money-service: `stripe-webhook.service.ts` (221, 299, 362, 434, 684),
  `dlocal-webhook.controller.ts` (240, 279), `dlocal-payment.controller.ts:134`. A hardening pass could give them a `select`; S2 did only the routes its order named.
- The `cancelSubscription` functions and the `billing.cancel_confirm_body` rows are unused now (§2 item 12). `scripts/test-prisma5-upgrade.ts` reads `Subscription` whole;
  it is a script and not deployed.
- money-service has no `node_modules` in this checkout: its `tsc` and Jest ran in the scratch copy `C:\Users\k_kav\AppData\Local\Temp\nci\money-service` (robocopy of the
  working tree, `prisma generate` after the schema change), safe to delete.

## 5. Davin: before S2 is deployed

1. **Apply the migration to production FIRST** (F21 rule): `prisma migrate status`, the pre-flight query in the migration's header (expect zero rows), then that one
   migration alone (`prisma db execute --file` then `prisma migrate resolve --applied`, with `--config prisma.production.config.ts`, never a bare `migrate deploy`; see
   `database-traps.md`). Until it is applied, deploying any service with the regenerated client fails on the 18 reads of §4.
2. **Deploy order: the migration, then operation-service, then money-service, then the monolith.** operation-service BEFORE money-service this time: a
   `SUBSCRIPTION_RESUMED` event reaching an old operation-service is answered `skipped` and counted as delivered, so that e-mail is lost (`infrastructure.md`).
3. **Look at the two payment files** `lib/stripe/webhook-handlers.ts` and `money-service/src/stripe/stripe-webhook.service.ts`: `handleSubscriptionUpdated` now writes
   `cancelAtPeriodEnd` (and nulls two columns when it is off), and the checkout-completed upsert resets the three cancellation columns (§2 items 3 and 4). No money,
   tier or grant logic changed.
4. **Decide the second "canceled" e-mail** (§4): leave it, or have both deleted handlers skip it when the cancellation was already announced.
5. **Look at `/settings/billing` and `/settings/billing/cancel` signed in, once**: a PRO subscription, the three steps, the "PRO ends on …" banner, Resume.
6. The Stripe Dashboard actions of S1 (retry settings, `STRIPE_PORTAL_CONFIGURATION_ID` on both services) still apply; S2 adds no variable.
7. The 39 page texts and the 7 e-mail texts are drafts for a native reader.
8. The commit and the push, when you want them (the pre-commit hook re-sorts classes of each staged file).

## 6. For the S3 order

- **W3 says "release any pending switch schedule, then cancel at period end".** S2 cannot do the first half: nothing creates a schedule yet (`pendingPlanType`,
  `pendingPlanEffectiveAt` and `stripeScheduleId` exist and are unused). S3 must make `cancel` release the schedule first (and clear the three columns), and must
  test in Stripe test mode whether `cancel_at_period_end` can be set on a subscription that a schedule manages.
- `subscription-actions.ts` already carries `cancelAtPeriodEnd` and `currentPeriodEnd` in its facts; S3 adds the change-plan and "keep yearly" actions and the pending
  display state there, in both stacks (the mirror test fails on any difference). Add the pending fields to the **`select`** of `GET /api/subscription`, never remove it.
- `handleSubscriptionUpdated` (both stacks) is where S3 clears the pending fields when phase 2 starts (B9, the switch part); the cancel sync is already there.
- S3's e-mails ("upgraded to yearly", "switch to monthly scheduled") go into the 19 locales the way the resumed one did: keys in `lib/email/i18n/messages/en-US.ts` first
  (the other 17 files are typed against it, so `tsc` finds any gap), then the folder copied to `operation-service/src/email/i18n/`.
- Stripe test clocks allow 3 customers per clock and 3 subscriptions per customer (§3.3); a script for S3's checks needs more than one clock or customer.
