# SystemConfig fix and annual plan — Manifest of Work Completion

**Date:** 2026-09-26
**Branch:** `fix/16-language-localization-reaudit` (same branch as the 16-language round 3)
**State:** code complete and verified; committed and pushed 2026-09-26 on the branch above; **NOT merged, NOT deployed**
**Approved by Davin in chat:** Stripe option (a), the dLocal and codes-per-month fixes, the display
and email fixes, then a complete annual plan driven by SystemConfig. **Same day, round 2 (§10):**
local prices use the live exchange rate dLocal uses (option 1), with an "approximate, charged in USD"
note on `/pricing` and checkout.

---

## 0. Summary

Davin was concerned that configurable figures (subscription price, % discount, % commission) were
written into the code, where the SystemConfig settings could not reach them. An audit confirmed it:
**the admin's Base Price changed what pages showed but not what anyone was charged**, the codes
handed to affiliates ignored their setting, and several pages, emails and translations stated fixed
figures (some of them wrong).

Every one of those now reads SystemConfig. Davin then asked for a real annual plan; it is built end
to end on a new SystemConfig key, `affiliate_annual_price`, for both payment providers.

| Check                                               | Result                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Next app `tsc --noEmit`                             | clean                                                                                                                  |
| money-service `tsc --noEmit`                        | clean                                                                                                                  |
| Next app full `test:ci`                             | **246/246 suites · 3163/3163 tests**                                                                                   |
| money-service `jest`                                | **63/63 suites · 632/632 tests**                                                                                       |
| Mutation testing (old hardcoded behaviour put back) | **15/15 killed**, files restored byte-exact (sha256)                                                                   |
| ESLint on changed files                             | 0 errors; 2 pre-existing warnings (`register-form.tsx` hook deps, a directive block in `monthly-distribution.test.ts`) |
| Prettier on changed files                           | clean                                                                                                                  |
| Live `next dev`                                     | `/docs` "20%", `/pricing` monthly and annual views, landing card annual line, config API                               |

After round 2 (§10): full `test:ci` **247/247 suites · 3172/3172 tests**; 3 more mutants, all
killed.

---

## 1. What the audit found (2026-09-26)

| Area                             | Found                                                                            | Effect                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| dLocal charge                    | `PRICING.MONTHLY_USD` / `THREE_DAY_USD` ($29 / $1.99), both apps                 | Admin price change shown on pages, not charged                                                       |
| Stripe charge                    | `STRIPE_PRO_PRICE_ID`'s own amount                                               | Same                                                                                                 |
| Codes per month                  | `AFFILIATE_CONFIG.CODES_PER_MONTH` (15) in registration and both monthly jobs    | Admin setting promised on pages, not handed out                                                      |
| `/docs`                          | "Receive **30%** recurring commissions"                                          | Wrong: 20% configured; also in all 16 languages                                                      |
| 4 affiliate pages                | ``t(`${commissionPercent}% …`)`` template-literal keys                           | The key only matched a translation at exactly 30%; at 20% always English                             |
| `/affiliate/resources`           | Fixed "20% off", "20% recurring"                                                 | Would not follow a change                                                                            |
| Checkout                         | `$29/mo` written in                                                              | Same                                                                                                 |
| `/pricing` table, upgrade pop-up | `NEXT_PUBLIC_PRO_PRICE_MONTHLY` env price                                        | A second price source                                                                                |
| `/pricing`                       | Annual toggle (price × 10)                                                       | Advertised a plan checkout could not sell                                                            |
| Emails                           | "$29/month or $290/year"; payment-failed defaulted to $29                        | Wrong after a change; no annual plan existed                                                         |
| Stripe webhooks (both)           | Stored `amountUsd` 29 / 290; "paid ≥ $280 means yearly"                          | At a monthly price of $280 or more, a renewal would be recorded as yearly with an expiry a year away |
| Admin MRR (3 places)             | PRO users × 29                                                                   | Wrong after a change                                                                                 |
| `calculateStandardSale` (both)   | Fixed 20% / 20% defaults                                                         | Unused, but a trap                                                                                   |
| Dictionaries                     | 29 unused entries with wrong figures ("30% commission", "$49/mo", "$50 minimum") | Easy to reuse by mistake                                                                             |

**Already correct:** commissions (Stripe webhook, conversion processor) and the Stripe/dLocal
discount use each affiliate code's saved percentages; new codes save the current config; most user
pages read `useAffiliateConfig()`; payout settings are read fresh.

---

## 2. Decisions

| #   | Decision                                                                                                                                                                                                                                                                                           | By                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| D1  | Stripe follows the admin price with an **inline price on the same Stripe product** (option a). The configured Stripe Price is used as-is when it already charges that amount on that interval. New subscribers pay the admin price; existing subscriptions keep theirs. Nothing to edit in Stripe. | Davin                                                                                            |
| D2  | dLocal and codes-per-month read SystemConfig.                                                                                                                                                                                                                                                      | Davin                                                                                            |
| D3  | Displays and emails read SystemConfig; the env price is retired.                                                                                                                                                                                                                                   | Davin                                                                                            |
| D4  | A complete annual plan on a new key `affiliate_annual_price` (default **$290**, the old "10 months" figure).                                                                                                                                                                                       | Davin (default: Executor)                                                                        |
| D5  | Plan type `YEARLY` everywhere (the Stripe webhooks already used it); dLocal annual = one payment for **365 days**, like the 30-day monthly. `planType` is a free-text column, so **no migration**.                                                                                                 | Executor                                                                                         |
| D6  | Affiliate codes apply to the annual plan: the code's discount on the first (annual) charge, commission on the amount actually collected.                                                                                                                                                           | Executor — **Davin may want to review**: 20% off a full year is a larger discount in money terms |
| D7  | The savings badge is computed, never fixed: `1 − annual ÷ (12 × monthly)`, shown only when positive.                                                                                                                                                                                               | Executor                                                                                         |
| D8  | `/pricing` opens on Monthly (it opened on Annual before).                                                                                                                                                                                                                                          | Executor                                                                                         |
| D9  | Admin prices must be above zero (Stripe refuses a zero price); the settings API now rejects `≤ 0`.                                                                                                                                                                                                 | Executor                                                                                         |
| D10 | Local prices are converted at the **live** rate dLocal charges at (option 1), and `/pricing` and checkout say the local figure is approximate and that cards are charged in USD (§10).                                                                                                             | Davin                                                                                            |

---

## 3. What changed: SystemConfig figures

**Charges**

- `lib/stripe/stripe.ts` / `money-service/src/stripe/stripe.service.ts`: `buildProLineItem(priceId,
unitAmountUsd, billingPeriod)`; the Price is fetched once per process (a failed lookup is not
  cached). Checkout routes pass the SystemConfig price.
- dLocal create (`app/api/payments/dlocal/create/route.ts`, `DlocalPaymentController`) charges
  `getBasePriceUsd()` / `getThreeDayPriceUsd()` / `getAnnualPriceUsd()`.
- Stripe webhooks store the price charged at checkout, then the invoice line's price and interval
  (`lib/stripe/invoice-plan.ts`, mirrored in money-service). The dLocal webhook fallback (a payment
  row without an amount) uses SystemConfig.

**Affiliate codes:** `lib/affiliate/registration.ts`, `lib/cron/monthly-distribution.ts`,
`AffiliateCronService` read `affiliate_codes_per_month`.

**Displays:** `/pricing` (`tier-comparison.tsx`), the upgrade pop-up, checkout, `/docs`,
`/affiliate`, `/affiliate/join`, `/affiliate/register`, `/affiliate/resources`.

**Emails:** confirmation, payment-failed (the subscriber's own price and period), trial reminder and
upgrade prompt take the price as a parameter (`formatEmailUsd`; emails stay in USD, as charged).

**Admin:** MRR = PRO users × SystemConfig price (`/api/admin/analytics`,
`lib/admin/analytics/revenue.ts`, `AdminAnalyticsController`). `calculateStandardSale` takes its
rates as parameters.

**Retired:** `NEXT_PUBLIC_PRO_PRICE_MONTHLY` / `_YEARLY` (no longer read), `PRO_TIER_PRICE`.

---

## 4. What changed: the annual plan

**Setting.** `affiliate_annual_price` (USD per year). Editable at `/admin/settings/affiliate`
("Annual PRO Price"), audited in `SystemConfigHistory` like the other keys. Read by
`getAnnualPriceUsd()` (`lib/affiliate/db.ts`), `AffiliateConfigService.getAnnualPriceUsd()`,
`/api/config/affiliate` (`annualPrice`) and `useAffiliateConfig()` (`annualPrice`,
`annualSavingsPercent`).

**Card payments (Stripe).**

1. `/pricing` Annual view → `/checkout?billing=yearly`; checkout's card box has a Monthly / Annual
   choice.
2. `POST /api/checkout` with `billingPeriod: 'yearly'` (money-service `StripeCheckoutController`
   when its flag is on).
3. Line item: inline price, `recurring.interval = 'year'`, SystemConfig annual amount, same product
   and tax behaviour. The monthly Stripe Price is never reused for a yearly charge. An annual
   checkout without an annual price is refused.
4. `billingPeriod: 'yearly'` in session and subscription metadata. A yearly attempt gets its own
   idempotency key; monthly keys are unchanged.
5. 7-day trial as for monthly.
6. Webhook: `planType: 'YEARLY'`, `amountUsd` = annual price, next billing date +1 year; renewals
   read the interval from the invoice line.

**Local payments (dLocal).** `PlanSelector` offers Annual; `planType: 'YEARLY'` is accepted by
both create routes and the discount validator; charged at the annual price; the webhook gives 365
days; receipts say "Trading Alerts PRO - Annual" and cover 365 days; the return page says "Annual PRO".

**Account pages.** `/api/subscription` returns the subscriber's own `amountUsd`; the Settings →
Billing plan card shows that price with "/year" for annual plans (and each subscriber's own price
rather than today's). Stripe invoices in the billing list are labelled from the invoice line.

**Landing page.** The pricing card adds "or {price} per year (save {percent}%)".

---

## 5. Guard test

`__tests__/lib/systemconfig-figures-guard.test.ts` (6 tests) fails when:

- source text states a price or a discount/commission rate;
- code outside the default definitions reads `AFFILIATE_CONFIG.*` or dLocal `PRICING.*`;
- a price is assigned as a number literal (`amountUsd = 29`, `? 290 : 29`);
- `NEXT_PUBLIC_PRO_PRICE*` is read again;
- a dictionary string pairs a figure with a business word (with an allowlist of 9 non-SystemConfig
  samples: chart prices, alert tolerance, VAT).

---

## 6. Tests added or changed

| Test                                                                                                   | Proves                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/lib/stripe/stripe.test.ts`                                                                  | Stripe Price reused only when amount and interval match; inline monthly and **yearly** prices; one lookup per process; failed lookup retried; zero price refused; annual without a price refused; `billingPeriod` in metadata     |
| `money-service/src/stripe/stripe.service.spec.ts`                                                      | Same, money-service                                                                                                                                                                                                               |
| `__tests__/lib/stripe/webhook-handlers.test.ts`                                                        | Configured price ($35, not the default) stored and emailed; **yearly** checkout stores the annual price; invoice interval from the line ($300/month stays monthly); payment-failed quotes an annual subscriber's price and period |
| `money-service/src/stripe/stripe-webhook.service.spec.ts`                                              | Same, money-service                                                                                                                                                                                                               |
| `money-service/src/stripe/stripe-checkout.controller.spec.ts`                                          | Monthly passes the SystemConfig price; `billingPeriod: 'yearly'` passes the annual price and its own idempotency key                                                                                                              |
| `money-service/src/dlocal/dlocal-payment.controller.spec.ts`                                           | Monthly charges $35; **YEARLY** charges the annual $350                                                                                                                                                                           |
| `money-service/src/dlocal/dlocal-webhook.controller.spec.ts`                                           | **YEARLY** payment gives 365 days                                                                                                                                                                                                 |
| `__tests__/lib/cron/monthly-distribution.test.ts`, `money-service/src/crons/affiliate.service.spec.ts` | 12 codes when SystemConfig says 12                                                                                                                                                                                                |
| `__tests__/api/config-affiliate.test.ts`                                                               | `annualPrice` served from SystemConfig                                                                                                                                                                                            |
| `__tests__/components/payments/PlanSelector.test.tsx`                                                  | Annual option at the SystemConfig price with its saving; selects `YEARLY`                                                                                                                                                         |
| `__tests__/components/pricing/annual-plan.test.tsx` (new)                                              | `/pricing` monthly and annual views, links, saving; receipt plan names                                                                                                                                                            |
| `__tests__/lib/email/email.test.ts`                                                                    | Emails show the passed price; no `$29`, no `/year` on monthly emails                                                                                                                                                              |
| `money-service/src/admin/admin-analytics.controller.spec.ts`                                           | MRR from the configured price                                                                                                                                                                                                     |

Mocks deliberately use prices other than the defaults ($35 monthly, $350 annual), so a test passing
on a fixed $29/$290 is impossible.

---

## 7. Deployment checklist

1. **Deploy money-service and the Next app together.** Stripe checkout and the dLocal routes can be
   served by either (money-service flags), and both now send `billingPeriod`.
2. Remove `NEXT_PUBLIC_PRO_PRICE_MONTHLY` / `NEXT_PUBLIC_PRO_PRICE_YEARLY` from Vercel if set.
3. Set the annual price at `/admin/settings/affiliate` (until then the default $290 applies).
4. On staging: a Stripe test checkout, monthly and annual (expect an inline price on the PRO product,
   interval month / year); a dLocal test payment on the annual plan (expect 365 days); an admin
   price change followed by another checkout.
5. No migration and no Stripe dashboard change are needed.
6. After deploy, open `https://davintrade.app/api/fx/rates`: `source` should be `"live"`. If it
   says `"fallback"`, Vercel cannot reach exchangerate-api.com and every local price is at the
   fixed rates in `lib/country-config.ts` (§10).

---

## 8. Not done / open

- **Signed-in click-through** of checkout and Settings → Billing (the Executor does not sign in).
- **Switching plans** (monthly ↔ annual) for an existing subscriber: there is no upgrade/downgrade
  path; a subscriber cancels and subscribes again. Stripe proration was out of scope.
- **Admin MRR** counts every PRO user at the monthly price, so annual subscribers are estimated as
  monthly. A per-subscription MRR (annual ÷ 12) would be more accurate.
- **Affiliate commission cap** (`MAX_RECURRING_COMMISSION_CYCLES = 24`) counts invoices, so for an
  annual subscriber it means 24 years. Worth a decision if the cap is meant in time.
- **D6** (codes on the annual plan) is a business choice worth Davin's review.
- dLocal annual, like dLocal monthly, does not renew automatically.
- **money-service keeps its own copy of the dLocal converter** (§10.4): same API, 1-hour cache
  per currency, but a separate cache. When money-service serves dLocal, its rate can be up to an
  hour apart from the one on screen. Sharing one table would need a cross-service cache (Redis).
- **Fallback rates disagree** when the rate API is down: the display falls back to
  `CURRENCY_USD_RATES` (e.g. THB 35.0), dLocal to its own `FALLBACK_RATES` (THB 35.25). Only
  during an outage; worth unifying.
- **The landing-page pricing card** shows local prices too but has no note. The note could be added
  there with the same key.
- **Checkout's note is not verified live:** checkout needs a signed-in session. It uses the same
  logic as `/pricing` and is covered by the translation guard, but it has no rendered test.

---

## 9. Files

**New:** `lib/stripe/invoice-plan.ts`, `money-service/src/stripe/invoice-plan.ts`,
`__tests__/lib/systemconfig-figures-guard.test.ts`, `__tests__/components/pricing/annual-plan.test.tsx`,
this manifest.

**Next app:** `lib/stripe/{stripe,webhook-handlers}.ts`, `lib/affiliate/{db,constants,registration}.ts`,
`lib/cron/monthly-distribution.ts`, `lib/hooks/useAffiliateConfig.ts`, `lib/email/{email,subscription-emails}.ts`,
`lib/billing/dlocal-receipt.ts`, `lib/dlocal/{constants,three-day-validator.service}.ts`,
`lib/admin/{pnl-calculator,analytics/revenue}.ts`, `lib/{tier-config,constants/business-rules,utils/constants}.ts`,
`types/dlocal.ts`, `app/api/{checkout,subscription,invoices}/route.ts`,
`app/api/payments/dlocal/{create,validate-discount}/route.ts`, `app/api/webhooks/dlocal/route.ts`,
`app/api/config/affiliate/route.ts`, `app/api/admin/{analytics,settings/affiliate}/route.ts`,
`app/admin/settings/affiliate/page.tsx`, `app/checkout/{page,return/page}.tsx`,
`app/settings/billing/page.tsx`, `app/(marketing)/docs/page.tsx`,
`app/affiliate/{page,join/page,register/page,resources/page}.tsx`,
`components/pricing/tier-comparison.tsx`, `components/landing/landing-pricing.tsx`,
`components/payments/PlanSelector.tsx`, `components/ui/pro-upgrade-modal.tsx`,
`prisma/non-market-data/schema.prisma` (comments only), all 17 dictionaries, tests above.

**money-service:** `stripe/{stripe.service,stripe-checkout.controller,stripe-webhook.service}.ts`,
`dlocal/{dlocal-payment.controller,dlocal-webhook.controller,dlocal.constants,dlocal.types,three-day-validator.service}.ts`,
`affiliate/{affiliate-config.service,affiliate.constants}.ts`, `crons/affiliate.service.ts`,
`admin/{admin-analytics.controller,pnl-calculator}.ts`, specs above.

**Docs:** `docs/SYSTEMCONFIG-USAGE-GUIDE.md` (status section),
`davintrade-16-language-localization-remediation/16-language-localization-remediation-manifest-work-completion.md` (§9),
`CLAUDE.md`.

**Round 2 (§10):** new `lib/fx/usd-rates.ts`, `app/api/fx/rates/route.ts`,
`__tests__/lib/fx/usd-rates.test.ts`; changed `lib/dlocal/currency-converter.service.ts`,
`lib/country-config.ts`, `lib/context/locale-context.tsx`, `app/layout.tsx`, `app/providers.tsx`,
`components/providers/client-providers.tsx`, `app/admin/dashboards/{affiliates,executive,regional,revenue}/page.tsx`,
`app/affiliate/dashboard/payouts/page.tsx`, `app/admin/users/[id]/page.tsx`,
`components/pricing/tier-comparison.tsx`, `app/checkout/page.tsx`, all 17 dictionaries, `jest.setup.js`,
`__tests__/lib/dlocal/currency-converter.test.ts`, `__tests__/components/pricing/annual-plan.test.tsx`,
`__tests__/e2e/dlocal-payment-flow.test.ts`, `__tests__/integration/payment-creation.test.ts`;
docs `docs/SYSTEMCONFIG-USAGE-GUIDE.md`, `docs/policies/08-locale-i18n-compliance.md`, the
16-language manifest (§10), `CLAUDE.md`.

---

## 10. Round 2: live exchange rates and the "charged in USD" note

### 10.1 The problem

Local prices were converted from USD at **fixed** rates in `lib/country-config.ts`
(`CURRENCY_USD_RATES`, e.g. GBP 0.78, THB 35.0), while dLocal charged at the **live**
exchangerate-api.com rate. So a Thai visitor could see one baht figure on `/pricing` and be asked
for another at dLocal. Card payments go through Stripe **in USD**, and the card issuer converts
at its own rate, which no one on our side knows. Davin chose option 1: show local prices at the
live rate dLocal uses, and say plainly that the local figure is approximate and cards are charged
in USD.

### 10.2 What changed

- **One rate table.** New `lib/fx/usd-rates.ts` (server only) fetches
  `https://api.exchangerate-api.com/v4/latest/USD` at most once an hour and keeps the table in
  memory. The dLocal converter (`lib/dlocal/currency-converter.service.ts`) and the displays both
  read it, so dLocal and the page use the same rate from the same fetch.
  - **Display callers** get an expired table immediately and a refresh in the background, so a page
    never waits on the rate API.
  - **Charges** (`getUsdRateTable({ fresh: true })`) wait for a new table once the hour is up,
    so dLocal never charges at an expired rate.
  - 3-second timeout. If the API fails, an earlier live table is kept; with none, the fixed rates
    apply (as before).
- **Formatter.** `formatCurrencyAmount()` takes an optional `rates` map and uses it before the
  fixed rate. `useLocale().formatCurrency()` passes the live table, so every client price follows.
- **Delivery to the browser.** The root layout reads the table once (`getDisplayUsdRates()`) and
  passes it to `LocaleProvider`, so the first paint is already at the live rate. The provider
  refreshes it hourly from the new public `GET /api/fx/rates` (`s-maxage=3600`).
- **Server pages** that format USD (the 4 admin BI dashboards, admin user detail, affiliate
  payouts) pass the same table.
- **The notes** appear only when the display currency is not USD:
  - `/pricing` (`pricing.approx_note`), under the plan cards: "Prices in {currency} are
    approximate: converted from USD at a recent market rate. Card payments are charged in USD
    ({usdPrice}), and your bank converts them at its own rate. Local payment methods show the exact
    amount in your currency at checkout." `{usdPrice}` follows the Monthly/Annual toggle
    (e.g. "US$29.00 / month", "US$290.00 / year").
  - Checkout, card box (`checkout.card_charged_usd`): "You will be charged {usdPrice} in USD. The
    {currency} amount shown is approximate, converted at a recent market rate; your card issuer
    converts the charge at its own rate."
  - Both keys are translated in all 17 dictionaries (compulsory-page guard).

### 10.3 Verification

- `tsc` clean; Prettier and ESLint clean on the changed files.
- Full `test:ci` **247/247 suites · 3172/3172 tests**.
- New or extended tests:
  - `__tests__/lib/fx/usd-rates.test.ts` (6): one fetch per hour, stale-then-refresh for display,
    charges wait, fallback keeps the earlier live table, display rates cover every currency, the
    formatter uses a live rate when given.
  - Converter test: a charge after the hour gets the new rate.
  - `annual-plan.test.tsx`: the note is hidden in USD and names the USD charge for each period.
- `jest.setup.js` mocks `lib/fx/usd-rates` globally (fixed rates, no network). The suites that test
  real conversion against a mocked `fetch` opt out with `jest.unmock`: the converter test, the
  dLocal e2e flow, the payment-creation integration test.
- **Mutation, 3/3 killed**, each restore byte-exact (sha256): the formatter ignoring the live rate;
  the note hidden; a charge accepting a stale table (this one **survived at first**, which is why
  the converter test above was added).
- **Live on `next dev`:** `/api/fx/rates` returned `source: "live"` (GBP 0.755, THB 33.38).
  `/pricing` showed **£21.90** (the fixed rate would give £22.62) with the note naming "US$29.00 /
  month", then "US$290.00 / year" after the Annual switch. In Thai: **฿968.02** (= 29 × 33.38) with
  the Thai note. No new console errors.

### 10.4 Not covered

See §8: money-service's own converter copy, the fallback-rate mismatch, the landing card, and
checkout's note not seen live.
