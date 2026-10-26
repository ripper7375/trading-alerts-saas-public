# Manage Subscription S1: execution report

**Date:** 2026-10-21 · **Branch:** `main` (on `32fb6e75`) · **Status:** BUILT and verified locally. **NOT committed, NOT pushed, NOT
deployed, no migration.** Spec: [plan v2.1](./2026-10-21-manage-subscription-proposal.md) §10 row S1 (the order was the pasted task; it
carries decisions D1 to D8 and E1 to E4, all settled).

## 1. What S1 does now

| Item                                        | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **B1** a failed renewal removed PRO         | `customer.subscription.updated` no longer sets `tier: 'FREE'` for `past_due`. One rule, `tierForStripeStatus` (`lib/stripe/tier-rule.ts`, byte copy in `money-service/src/stripe/tier-rule.ts`): `active`, `trialing`, `past_due` keep PRO; `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `paused` and any unknown status are FREE. The handler only ever **removes** PRO (it never grants it): `invoice.payment_succeeded` grants it, and a late `past_due` event cannot undo `customer.subscription.deleted`. Both handlers changed. |
| **B2** a FREE user got no subscription data | `GET /api/subscription` returns the subscription block when the user is PRO **or** the row is `PAST_DUE`/`UNPAID`. New in the response: `allowedActions`, `displayState`, `subscription.openInvoiceUrl`.                                                                                                                                                                                                                                                                                                                                           |
| **B3** dead "Manage Subscription" button    | Removed from `/settings/billing`. Status banner on top (red, by `displayState`), action row and "Update card" drawn from `allowedActions`, "Update card" in the Payment Method block for Stripe subscribers.                                                                                                                                                                                                                                                                                                                                       |
| **B4** payment-failed e-mail link           | `${url}/settings/billing` in `lib/email/i18n/templates.ts` and its byte copy in `operation-service`.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **W1** update card                          | `POST /api/subscription/payment-method-session` (monolith, forwarded to `POST /v1/stripe/subscriptions/payment-method-session` in money-service when `MIGRATE_WRITE_APIS_MONEY_STRIPE=true`). Portal session with `configuration: STRIPE_PORTAL_CONFIGURATION_ID`, `flow_data.type = payment_method_update`, completion redirect `/settings/billing?done=card`. 503 `PORTAL_NOT_CONFIGURED` when the ID or `NEXTAUTH_URL` is unset.                                                                                                                |
| **W2** pay now                              | `openInvoiceUrl` = `hosted_invoice_url` of the subscription's newest open invoice (`getOpenInvoiceUrl`). "Pay now" opens it in a new tab; the page re-reads the subscription when the tab becomes visible again while a payment is failed.                                                                                                                                                                                                                                                                                                         |

`lib/stripe/subscription-actions.ts` (also byte-mirrored into money-service) is the one function that decides `allowedActions` and
`displayState`; the page and both W1 endpoints use it. **S2 to S4 extend it in both stacks** (test:
`__tests__/lib/stripe/subscription-actions.test.ts`, which also fails on any difference between the copies).

## 2. Decisions I took that the order did not spell out

Each is small and reversible; none touches money beyond B1's tier rule.

1. **`cancel` stays in `allowedActions` for every PRO user**, dLocal included, and is today's immediate cancel. D8 (no dLocal cancel) and
   B5/B7 are S2's; hiding the dLocal button in S1 would have been a change nobody ordered.
2. **PAST_DUE and UNPAID offer only Pay now and Update card, no Cancel** (plan §6 table).
3. **An UNPAID user (tier FREE) is not shown "Upgrade to PRO" or the PRO promo card**: `/api/checkout` would create a second Stripe
   subscription and overwrite their `Subscription` row. The banner is their way back.
4. **The Payment Method block also shows for UNPAID** (the card is exactly what has to be fixed).
5. **No idempotency cache and no outbox event on the W1 endpoint** (plan §9.1 gave every write route both). It writes nothing and
   charges nothing, and the idempotency interceptor would replay a cached portal URL for 24 h while Stripe expires it in minutes.
6. **The portal's own "return" link goes to `/settings/billing`; only completion goes to `?done=card`**, so returning without saving
   does not claim anything. The page shows an inline `role="status"` notice, not a toast, and drops `done` from the address bar.
7. **The monolith route refuses to guess `NEXTAUTH_URL`** (503), as money-service's checkout does since Remediation 6.5; the monolith's
   own checkout still falls back to `http://localhost:3000`.
8. **`GET /api/subscription` for a FREE user now also carries `allowedActions: []` and `displayState: 'FREE'`**, so
   `__tests__/api/user-select-projections.test.ts` asserts the new exact body.
9. **In admin view-as the response still describes the viewed user but `allowedActions` is `[]` and `openInvoiceUrl` is `null`**, and
   the page hides the actions on its own as well.
10. **`tierForStripeStatus` takes a `string`** and answers FREE for anything not in its table, including `toString` and `__proto__`
    (a first version with `?? 'FREE'` returned the prototype's members; a test found it).

## 3. Evidence

Run from `D:\SaaS` unless noted; all on the working tree described above.

| Check                                                                                         | Result                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root `npx tsc --noEmit`                                                                       | exit 0                                                                                                                                                                                                                                                                                                                  |
| root `npm run lint`                                                                           | 0 errors; 5 warnings, none in a file S1 touched                                                                                                                                                                                                                                                                         |
| `prettier --check --end-of-line auto` on every changed `.ts`/`.tsx`                           | clean                                                                                                                                                                                                                                                                                                                   |
| root `npm run test:ci`                                                                        | **577 suites passed, 0 failed; 19,480 tests passed, 315 skipped (as before)**, exit 0. A first run failed one test, `systemconfig-figures-guard`, which caught `amountUsd: 29` in the temporary browser page; it passed once that page was deleted. The 19-locale `compulsory-translation-coverage` test is in the run. |
| root `npm run build`                                                                          | exit 0 (`next-env.d.ts` was rewritten by it and restored with `git checkout`)                                                                                                                                                                                                                                           |
| money-service `tsc --noEmit` and full Jest (scratch copy, no `node_modules` in this checkout) | exit 0; 74 suites, 884 tests, 0 failed                                                                                                                                                                                                                                                                                  |
| operation-service `tsc --noEmit` and full Jest                                                | exit 0; 63 suites, 640 tests, 0 failed (the e-mail mirror test is in it)                                                                                                                                                                                                                                                |
| two mutants: `past_due: 'FREE'` in `tier-rule.ts`, and the B2 gate ignoring a failed payment  | 4 and 10 tests failed; both files restored byte-exact (sha256), mirrors identical                                                                                                                                                                                                                                       |

New and changed tests: `tier-rule.test.ts` (table and mirror), `subscription-actions.test.ts` (41), `subscription-get.test.ts` (9),
`subscription-payment-method-session.test.ts` (19), the `past_due` and table cases in `webhook-handlers.test.ts` and in money-service's
`stripe-webhook.service.spec.ts`, the W1 cases in `stripe-subscription.controller.spec.ts` and `stripe.service.spec.ts`, 21 page tests in
`billing.test.tsx` (banner states, Update card, refused portal answers, the `?done=card` notice, view-as, dLocal, Arabic, German and
Japanese from the real dictionaries), the B4 link in all 19 locales in `templates.test.ts`.

### 3.1 Stripe test mode (no login needed)

A throwaway script (not in the repository) used the test key from `.env.local` and refused to run on a live key. It created a test
clock, a customer with a card that declines the charge and a monthly subscription, and advanced the clock past the renewal:

- the subscription went **`past_due`** and had **one open invoice with a `hosted_invoice_url`** on `invoice.stripe.com` (what
  `getOpenInvoiceUrl` reads);
- `billingPortal.sessions.create` with `configuration: bpc_1USmup55Obu9Ws2AmwPZ26Bq` and the S1 `flow_data` returned an https
  `billing.stripe.com` URL whose flow is `payment_method_update` with `after_completion.redirect.return_url =
<NEXTAUTH_URL>/settings/billing?done=card`; a wrong configuration ID is rejected (nothing falls back to a default portal);
- the clock (with its customer and subscription) and a second throwaway customer were deleted afterwards.

The configuration `bpc_1USmup55Obu9Ws2AmwPZ26Bq` is test mode, active, **`is_default: true`**, and has payment-method update **and
invoice history ON**; cancel, plan update and customer update are off. S1 passes the ID explicitly, so the default flag does not
matter to it.

### 3.2 Browser

The real billing page was rendered through a temporary development page (a `fetch` stub with the API's new response shapes; deleted
after use, `git status` shows nothing of it): past-due banner, "Payment overdue" badge, PRO kept, no Cancel, "Update card" in the
Payment Method block, light and dark, at 375 px (no horizontal overflow), RTL layout under `lang="ar"`. Clicking "Update card" took
the pane to Stripe's card-only "Update payment method" form (a real test-mode portal session); the form's back link returned to
`/settings/billing`. **No card was entered.**

## 4. Not verified

- A real webhook delivery from Stripe through the handlers to a database. The handlers are proven by unit tests against a mocked
  Prisma in both stacks, and Stripe is proven to produce a `past_due` subscription; the join between them was not run.
- The page signed in (the Executor never enters login credentials). `MIGRATE_WRITE_APIS_MONEY_STRIPE=true` is set in the local
  `.env.local`, so a signed-in local check also needs money-service running with `STRIPE_PORTAL_CONFIGURATION_ID`.
- The completion redirect after SAVING a card, and the page's re-fetch after it (needs a card number typed into Stripe's page).
- Non-English text in the browser: the dev server renders every non-English language as English (the public `/pricing` page too, a
  hydration mismatch of the existing locale provider). The translations are held by `compulsory-translation-coverage.test.ts` and by
  three page tests that render Arabic, German and Japanese from the real dictionaries.
- The 12 new texts are my drafts; no native reader has seen them.

## 5. Davin: before S1 is deployed

1. **Stripe Dashboard, revenue recovery (plan §3.1, E1):** retry schedule, and the action after the last failed retry must be
   **cancel the subscription** or **mark it unpaid**, never "leave it past due", or PRO is kept for ever. The e-mail still promises
   "within 3 days".
2. **Set `STRIPE_PORTAL_CONFIGURATION_ID` (a live ID) on the monolith AND on money-service.** Without it "Update card" answers 503 and
   the page shows "We could not open the card update page". money-service also needs `NEXTAUTH_URL` (already required for checkout).
3. **Count users who are `PAST_DUE` with `tier = FREE`** (read only). They see the banner when S1 is live and get PRO back by paying;
   nothing restores them automatically.
4. **Deploy both the monolith and money-service**: both webhook handlers changed. No migration, so no ordering is required.
5. Look at `/settings/billing` signed in, in a past-due state, once.

## 6. For the S2 order

- `app/api/subscription/route.ts` still reads `Subscription` with `findUnique({ where: { userId } })` and no `select` (plan §9.3 names
  it); S2's six new columns make that a login-class failure if the migration is late. The W1 routes already use an explicit `select`.
- `subscription-actions.ts`: add `resume`, change-plan and renew there, in both stacks; `cancel` for dLocal goes away in S2 (D8).
- The plan card's Cancel button is still the immediate-cancel dialog; S2 replaces it with the cancel page.
- Stripe's portal opens in the browser's language (it showed Thai here); the `locale` parameter could take the user's app language.
  Not done.
- `billing.manage_subscription` is no longer used by any code; its 19 dictionary rows were left.
