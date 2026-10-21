# Manage Subscription S4: execution report

**Date:** 2026-10-21 · **Branch:** `main` (on `e02c8b08`, the committed S3) · **Status:** BUILT and verified locally. **NOT committed, NOT pushed, NOT
deployed; NO migration, no new variable.** Spec: [plan v2.1](./2026-10-21-manage-subscription-proposal.md) §10 row S4, §7 W6, §3 decision D6 and §4 defect B10
(the order was the pasted task). This is the last session of the Manage Subscription engine.

**Entry state, confirmed against live code before the first edit:** `main` on `e02c8b08` with a clean tree. **S1, S2 and S3 are committed**
(`48bf2bcf`, `1f0b9755`, `e02c8b08`); the S2 and S3 reports, `current-state.md` and `waiting-on.md` still said "NOT committed" (corrected in this session's
close). Live code before S4: both dLocal webhooks wrote `expiresAt = now + duration` (B10); `subscription-actions.ts` returned `[]` for every dLocal row and had no
EXPIRING state; `GET /api/subscription` had no `renewsAutomatically`; **and `POST /api/payments/dlocal/create` (monolith and money-service) answered 403 to any
active PRO subscriber, with `/checkout` showing "You're already a PRO member"**, so an early renewal could not happen at all (§2 item 1).

## 1. What S4 does now

| Item                                         | Result                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **B10 / D6, stacked expiry (both webhooks)** | `expiresAt = max(now, current expiry) + duration` (3, 30 or 365 days), through one helper `stackedExpiry` in `lib/dlocal/stacked-expiry.ts` and its byte copy in money-service. 10 days left + a monthly payment = 40 days, not 30. `renewalReminderSent` is reset on every successful payment (it already was; now tested).                                                         |
| **Replay claim (monolith)**                  | Stacking makes a replayed PAID webhook dangerous (it would add the period twice) and the monolith route had no claim. It now claims the payment inside the transaction, as money-service already did: a payment that is already COMPLETED changes neither the tier nor the expiry (§2 item 4).                                                                                       |
| **EXPIRING and `renew_now`**                 | `subscription-actions.ts` (byte-mirrored): display state `EXPIRING` for an ACTIVE dLocal plan within 72 hours of `expiresAt` (including a plan past its date that the daily cron has not downgraded yet); action `renew_now` for every ACTIVE dLocal plan, at any time (plan §6), never for Stripe, hidden in admin view-as; `renewsAutomatically()`.                                |
| **`GET /api/subscription`**                  | `subscription.renewsAutomatically` (`false` for dLocal; for Stripe `true` until a cancellation is scheduled); `displayState: 'EXPIRING'`; `allowedActions: ['renew_now']`.                                                                                                                                                                                                           |
| **Create-payment guard (both stacks)**       | An active PRO subscriber still gets 403, **except** a request with `renew: true` from a subscriber the server's own `allowedActionsOf` offers `renew_now` (a live dLocal plan). The flag alone proves nothing. A discount code is ignored on a renewal. **A payments file: your look, §5 item 2.**                                                                                   |
| **`/settings/billing`**                      | Banner "Your plan expires on {date}" with "Renew now" within three days; a "Expires soon" badge; "Renew now" also in the plan card for any active dLocal plan (from `allowedActions`, absent in admin view); `?done=renewed` shows "Your plan has been renewed. PRO now runs until {date}." only when the fresh data agrees.                                                         |
| **"Renew now" and the checkout**             | Links to `/checkout?plan=MONTHLY\|YEARLY&renew=1&country=XX` (a 3-day plan renews as monthly: it can be bought once). `CheckoutAccess` opens the checkout to a PRO user **only** after `GET /api/subscription` shows `renew_now` on a dLocal plan; `/checkout` and `/checkout/stripe` then go to `/checkout/dlocal` (Stripe would start a second subscription). See §2 items 6 to 8. |
| **Coming back**                              | The checkout remembers the payment id in `sessionStorage`; `/checkout/return` then offers "Back to billing" (`?done=renewed` once the payment is COMPLETED).                                                                                                                                                                                                                         |
| **Texts**                                    | 6 keys × 19 dictionaries (real translations in the 17 non-English ones, **my drafts**, §2 item 12): `billing.banner.expiring_title`, `billing.banner.expiring_body`, `billing.action.renew_now`, `billing.notice.renewed`, `billing.status.expiring`, `checkout.renew_note`. "Back to billing" reuses S2's `billing.cancel_flow.back_to_billing`.                                    |

## 2. Decisions I took that the order did not spell out

Each is small and reversible; the first two touch the payment path and are the ones to look at.

1. **The create-payment guard had to open for a renewal (both stacks).** The order's W6 ("Renew now opens the existing `/checkout`... success returns to billing") cannot work
   while `POST /api/payments/dlocal/create` refuses every `tier === 'PRO' && status === 'ACTIVE'` user and `CheckoutAccess` shows the already-PRO notice. The change is the
   narrowest I found: the request must carry `renew: true` AND `allowedActionsOf({ tier, status, provider })` must include `renew_now` (a live dLocal plan; Stripe and
   provider-less rows keep the 403). A new buyer is untouched. The checkout page does the same two checks before it opens (`GET /api/subscription`), so a hand-typed
   `?renew=1` opens nothing for a Stripe subscriber. No price, currency, lock or provider call changed.
2. **The stacking base is a LIVE dLocal row only** (`currentExpiryOf`: status ACTIVE, `dLocalPaymentId` set, a readable date), not the order's bare `currentExpiresAt`.
   A Stripe row also stores `expiresAt` (its next billing date), and a Stripe subscription cancelled before S2's period-end cancel could hold a date months ahead; a later
   dLocal purchase would have inherited it. For a live dLocal plan the result is exactly the order's formula.
3. **Why a helper in two copies, not the formula inline.** `stackedExpiry` and `currentExpiryOf` are one small import-free file, byte-copied into money-service with a test
   that fails on any difference (the `subscription-actions.ts` pattern), so the two webhooks cannot drift.
4. **The monolith webhook now claims the payment** (`updateMany ... status: { not: 'COMPLETED' }` inside the transaction, count 0 = a replay), exactly like money-service's
   Tier 2 §6.3 claim. Before S4 a replay rewrote `now + duration` (harmless then); with stacking it would add a period each time dLocal retries. On a replay the transaction
   now does nothing; the code after it (3-day mark, affiliate conversion, notification) runs as before, so a retry still repairs a failed step. A replay arriving after
   the plan lapsed no longer re-grants PRO either (it did before).
5. **`renew_now` for any ACTIVE dLocal plan**, not only inside the 3-day window (plan §6 lists it for "ACTIVE, monthly/yearly" and EXPIRING). The banner is the 72-hour
   part; the plan card has the button all the time.
6. **EXPIRING is `expiresAt - now <= 72 h`, past dates included.** A plan whose date has passed but which the daily cron has not downgraded yet is still PRO and renewable, so
   it is EXPIRING; its banner then reads "Your plan expires on {a past date}" (one text, as the order gave it; a separate "expired" wording is a small addition if wanted).
   A **3-day plan is EXPIRING from the moment it is bought** (its whole length is 72 hours); the banner and "Renew now" are right for it, the badge may feel early.
7. **A renewal is paid with dLocal only.** `/checkout` (the provider chooser) goes straight to `/checkout/dlocal` for a verified renewal, `/checkout/stripe` does the same, and
   the dLocal page drops "Change payment method", the 3-day plan and the discount code (also ignored by both create routes), and says when the current plan ends and that the
   days left are added. Country comes from the subscription row (`dLocalCountry`); the plan is the current period and can still be changed on the page.
8. **How the user gets back to billing.** `createPayment` sends dLocal only `notification_url`; the browser return page is configured on dLocal's side, so a marker cannot ride
   on it and the code cannot change it. The checkout stores the new payment id in `sessionStorage` (best effort; blocked storage just leaves today's buttons) and
   `/checkout/return` shows "Back to billing" when it matches: `/settings/billing?done=renewed` for COMPLETED, plain `/settings/billing` otherwise. The notice on billing
   is said only when the fresh read agrees (a dLocal PRO plan no longer inside 72 hours), so a hand-typed marker claims nothing.
9. **`renewsAutomatically` for Stripe** is `true` until a cancellation is scheduled, `false` for dLocal and for a row with no provider (plan §9.1 named the field; only the
   dLocal value was ordered).
10. **No renewal reminder e-mail exists, so none was localised.** `checkExpiringSubscriptions` (monolith and money-service) only flips `renewalReminderSent`; nothing sends a
    message. Found, not built (a new feature). The order's "dLocal expiring and renewal texts in the 19 dictionaries" are the six keys of §1.
11. **The renewal's confirmation is the first-purchase one.** The money-service `TIER_UPGRADED` outbox event and the monolith/money-service in-app notification "Welcome to PRO!"
    (hard-coded English) are sent for a renewal as for a first payment. Found, not changed.
12. **Texts:** the six keys are my drafts in 17 languages, in each dictionary's own register and vocabulary (de "Ihr Tarif", es "Tu plan", fr "forfait", pt "O seu plano" and pt-BR "Seu plano"); no native
    reader has seen them.

## 3. Evidence

Run from `D:\SaaS` unless noted; all on the working tree described above.

| Check                                                     | Result                                                                                                                                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root `npx tsc --noEmit`                                   | exit 0                                                                                                                                                                                                           |
| root `npm run lint`                                       | 0 errors; 5 warnings, the same five as before S4, none in a file S4 touched                                                                                                                                      |
| root `npm run test:ci`                                    | **593 suites passed, 0 failed, 5 skipped as before; 20,266 tests passed, 315 skipped as before** (S3: 586 suites, 20,147 tests), exit 0                                                                          |
| root `npm run build`                                      | exit 0 (no new route; `next-env.d.ts` was rewritten by it and restored with `git checkout`)                                                                                                                      |
| money-service `tsc --noEmit` and full Jest (scratch copy) | exit 0; 76 suites, 1,102 tests, 0 failed (S3: 76 and 1,085)                                                                                                                                                      |
| operation-service `tsc --noEmit` and full Jest            | exit 0; 63 suites, 685 tests, 0 failed (same as S3: S4 changes nothing there)                                                                                                                                    |
| 19-locale coverage                                        | `compulsory-translation-coverage` and `dictionary-placeholders` are in the full run; the insert script refused any placeholder mismatch; the billing tests render `ar`, `de` and `ja` from the real dictionaries |
| 32 deliberate defects (mutation check, §3.1)              | all 32 killed by a failing assertion                                                                                                                                                                             |
| browser                                                   | as expected, through a temporary harness that is deleted (§3.2)                                                                                                                                                  |

New and changed tests: `stacked-expiry.test.ts` (helper and the mirror check), `__tests__/api/webhooks/dlocal/stacked-expiry.test.ts` (the monolith webhook),
the stacked-expiry block of money-service's `dlocal-webhook.controller.spec.ts`, `subscription-actions-renew.test.ts` (EXPIRING, `renew_now`,
`renewsAutomatically`; covers both stacks, the mirror test keeps the copy identical), `subscription-get.test.ts` (nine S4 cases), `dlocal-create-renew.test.ts` and the
renewal block of money-service's `dlocal-payment.controller.spec.ts`, `billing-dlocal-renew.test.tsx` (18, banner, links, notices, view-as, `ar`/`de`/`ja`),
`dlocal-renewal.test.tsx` (17, the checkout gate and the renewal checkout), `checkout-return-renewal.test.tsx` (6). Three existing assertions that said "a dLocal row has
no actions" now say `['renew_now']` (`subscription-actions.test.ts` twice, `subscription-actions-plan-change.test.ts`), and two in `subscription-get.test.ts`.

### 3.1 Mutation check

32 deliberate defects, each run with the targeted tests and the file restored byte for byte (sha256 checked); **all 32 were killed by a failing assertion**: the webhook ignoring
the current expiry, stacking onto any row (Stripe too), no replay claim, `min` for `max` (both stacks) · a 24-hour window, an exclusive boundary, EXPIRING for Stripe rows ·
`renew_now` for a lapsed row · `renewsAutomatically` true for dLocal · the create routes trusting the `renew` flag, keeping the discount, or letting every PRO user through
(both stacks) · the checkout gate skipping the provider check, the `renew_now` check, or trusting the marker · no `renew` flag sent, a discount sent on a renewal, the payment
not remembered, the chooser not skipping Stripe · no Back to billing marker · no banner, a renewed notice without agreement, the renew link ignoring the plan or dropping
the marker · `GET` without the `expiresAt` fact. **One gap was found and closed before the run:** the provider check in the checkout gate was shadowed by the `renew_now`
check (no test sent `renew_now` for a Stripe plan); a test for it was added and the mutant is killed.

### 3.2 Browser

The real billing page and the real dLocal checkout were rendered through a temporary development page (a `fetch` stub with the API's response shapes and a fake PRO session;
**deleted**, `git status` shows nothing of it, the dev server is stopped): the "Your plan expires on {date}" banner with "Renew now", the "Expires soon" badge, the second
"Renew now" in the plan card and the prepaid note; the link target `/checkout?plan=MONTHLY&renew=1&country=IN`; the renewal checkout (back link to billing, the "days you have
left are added" note, India and Monthly preselected, no 3-day plan, no discount code, no "Change payment method"); `?done=renewed` on a plan that is no longer close to its end
(the "Your plan has been renewed. PRO now runs until {date}." notice, marker dropped from the address, one "Renew now" left, no banner). 375 px with dark mode and under
`dir="rtl"`: `scrollWidth == innerWidth` (no horizontal overflow), the banner mirrored. Non-English text in a browser was not seen (the dev server renders every non-English
language as English, S1 §4); the billing tests render Arabic, German and Japanese from the real dictionaries.

## 4. Not verified, and found

- **Not verified:** a real dLocal webhook delivery through the handlers to a database (both handlers proven against a mocked Prisma, event shapes as the existing code reads them);
  a real dLocal payment and its browser return (dLocal's return address is configured on its side, §2 item 8: "Back to billing" depends on the same tab's `sessionStorage`, and
  a payment finished in another browser shows today's buttons); the two pages signed in (the Executor never enters login credentials); money-service over HTTP (Nest's guard and
  the idempotency interceptor; the controller's methods are tested directly); non-English text in a browser.
- **Found, not changed:**
  - **No renewal reminder e-mail exists** (§2 item 10): both crons only flip `renewalReminderSent`. A reminder would be a new feature (a template in 19 locales, a consumer, an
    outbox event).
  - **A renewal sends the first-purchase confirmation** (§2 item 11): the `TIER_UPGRADED` e-mail and the hard-coded English notification "Welcome to PRO!".
  - A plan past its date that the daily cron has not downgraded reads "expires on {past date}"; a 3-day plan is EXPIRING from the moment it is bought (§2 item 6).
  - The monolith webhook still creates the "Welcome to PRO!" notification again on a replay (the claim guards the subscription, not the notification); money-service does not.
  - `POST /api/payments/dlocal/create` (monolith) still reads `Subscription` with a full-row `findUnique` (no `select`): one of the 18 full-row reads of S2 §4, so the
    migration of S2 must be applied before this is deployed too. S4 added no new full-row read.

## 5. Davin: before S4 is deployed

1. **Nothing new to migrate and no new variable.** S2's migration must already be applied (S2 §5 item 1). Deploy **both money-service and the monolith** (both dLocal webhooks and
   both create routes changed; dLocal calls whichever endpoint its dashboard points at, so neither can be skipped). operation-service is unchanged. The whole engine's order
   stays: the migration, operation-service, money-service, the monolith.
2. **Look at the payment files:** `app/api/payments/dlocal/create/route.ts` and `money-service/src/dlocal/dlocal-payment.controller.ts` (an active dLocal subscriber with
   `renew: true` now passes the guard, §2 item 1), `app/api/webhooks/dlocal/route.ts` and `money-service/src/dlocal/dlocal-webhook.controller.ts` (the stacked expiry, §2 items
   2 to 4, and the monolith's new replay claim), `lib/dlocal/stacked-expiry.ts` (and its copy).
3. **Confirm or change the small readings:** `renew_now` at any time, not only inside the 72 hours (§2 item 5); the "expires on {past date}" wording for a plan the cron has not
   downgraded yet and the 3-day plan's banner (§2 item 6); stacking only onto a live dLocal plan (§2 item 2).
4. **Look at `/settings/billing` and the renewal checkout signed in, once**, ideally one real run against dLocal's sandbox on localhost: pay a renewal and read `expiresAt` before
   and after (it should grow by the plan length, not be reset). The Executor cannot sign in.
5. **Check the return address on dLocal's dashboard** is `/checkout/return` (the existing page reads `payment_id`); the renewal flow relies on that page.
6. The six page texts are drafts for a native reader.
7. The commit and the push, when you want them (the pre-commit hook re-sorts classes of each staged file; `provider-checkout.tsx` and the billing page already carry the sorted order).
8. **Decide whether a renewal reminder e-mail is wanted** (§4): none exists today.

## 6. After S4: the engine is complete in code

S1 to S4 are built and tested: failed payments and card update (S1), cancel and resume (S2), billing-period changes (S3), dLocal renewal (S4). What remains is Davin's: the
Stripe Dashboard retry settings and `STRIPE_PORTAL_CONFIGURATION_ID` (plan §3.1), applying S2's migration, deploying in the order above, one signed-in test-mode run of the pages,
a native read of the drafted texts (S1 to S4), and the pushes (S1 to S3 are committed locally, S4 is not).
