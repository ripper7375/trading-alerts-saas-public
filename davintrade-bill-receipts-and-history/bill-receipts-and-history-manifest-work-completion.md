# Billing Receipts & Full Invoice History — Work Completion Manifest

|               |                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request**   | Davin, 2026-09-24, in chat, from a screenshot of `davintrade.app/settings/billing` (an empty "Invoice History").                                                    |
| **Scope**     | Three asks: (1) PDF receipts for dLocal payments, in Stripe's format; (2) a message explaining why on-screen amounts can differ from the PDF; (3) the full history. |
| **Branch**    | `feat/billing-receipts-and-history`, 4 code commits + 1 docs commit on top of `main` @ `a3343098`. **Pushed. Not merged, not deployed.**                            |
| **Migration** | **None.** No `schema.prisma` touched. Receipt numbers are derived from the payment itself, so no counter table was needed (§3.1).                                   |
| **New dep**   | `pdf-lib@^1.17.1` (pure JS, no native code, no font files).                                                                                                         |
| **Status**    | Code complete and verified locally. **Signed-in click-through and a real dLocal payment not done** (the Executor never enters credentials). Those are Davin's.      |

---

## 1. Background: what the page actually did before

Davin asked what a PRO user sees in billing history and whether PDFs can be downloaded. Reading
the code first gave this picture:

- The history table (`components/billing/invoice-list.tsx`) was fully built, with Date,
  Description, Amount, Status and Invoice columns. It looked empty only because the account had
  never paid.
- **Stripe** rows linked to Stripe's own PDF (`invoice_pdf`) and hosted invoice page.
- **dLocal** rows had nothing to download. The route said so: `invoicePdfUrl: null, // dLocal
doesn't provide PDF invoices`.
- The **Amount** column ran every figure through `formatCurrency()`, which converts **from USD**
  into the viewer's display currency at a fixed rate. So a $29 charge showed as "£22.62" while
  the Stripe PDF says "$29.00".
- `GET /api/invoices` fetched **12 per provider** and the page never enabled its own "Load More"
  button.

Davin asked for all three to be addressed.

## 2. Commits

| Commit     | What                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `725a3781` | Receipts backend: `lib/billing/*`, the receipt route, full-history API, Stripe helper, `pdf-lib` |
| `82294af8` | Billing UI: exact amounts, "Why amounts may differ" notice, paging, `ar`/`th` keys, page tests   |
| `1ad896a0` | CSS: stop hiding every new-tab link inside a table (§4)                                          |
| `636edcd2` | Style: format `app/globals.css` with Prettier and include `*.css` in `lint-staged`               |
| (docs)     | This manifest and the `CLAUDE.md` entry                                                          |

## 3. What was built

### 3.1 dLocal PDF receipts

**Route:** `GET /api/invoices/[id]/receipt` (`app/api/invoices/[id]/receipt/route.ts`). `id` is
our `Payment.id`, the same id the history API returns for a dLocal row.

- **401** when signed out.
- **404** unless the row is the caller's own, `provider: 'DLOCAL'`, `status: 'COMPLETED'`. The
  ownership check lives in the Prisma `where`, and "someone else's", "doesn't exist" and "not
  completed" all return the same 404, so the route can't be used to probe which ids exist.
- **200** `application/pdf`, `Content-Disposition: attachment;
filename="DavinTrade-Receipt-####-####.pdf"`, `Cache-Control: private, no-store` (a personal
  financial document must never land in a shared cache).

**Layout, modelled on Stripe's receipt PDF** (`lib/billing/receipt-pdf.ts`):

1. "Receipt" title, business name top right
2. Invoice number, receipt number, date paid, payment method
3. Seller block and "Bill to" block (name, email, country)
4. Headline: **"INR 1,930.34 paid on September 1, 2026"**
5. Line-item table: Description / Qty / Unit price / Amount, with the service period underneath
6. Totals: Subtotal, Discount (code), Total, **Amount paid**
7. Footer: "`####-####` · INR 1,930.34 paid on …" and "Page 1 of 1"

**One deliberate addition Stripe doesn't need.** dLocal prices are set in USD but collected in
local currency, so the line items and totals are in USD, and the receipt closes with the local
amount actually paid and the rate dLocal applied ("1 USD = 83.2043 INR"). That line is the
reconciliation a customer needs when the bank statement differs from the USD price.

**Data rules** (`lib/billing/dlocal-receipt.ts`, pure, no I/O):

- `Payment.amountUSD` is the **gross** list price, before any affiliate discount (confirmed in
  both `app/api/payments/dlocal/create/route.ts` and money-service's
  `dlocal-payment.controller.ts`). The charged USD is `amountUSD − discountAmount`.
- `Payment.amount` is what dLocal collected, in `Payment.currency`, after discount.
- The exchange rate is derived as `amount / chargedUsd`. It is `null` for a fully discounted
  payment, since there is nothing to divide by.
- Service period = `createdAt` + `duration` days (3 or 30).

**Numbering.** These are receipts for payments already taken, not tax invoices. Numbers are
derived deterministically from the payment id: receipt `####-####` (from a SHA-256 of the id),
invoice `DT-YYYYMMDD-XXXXXXXX`. So every download of the same payment is **byte-identical**
(PDF metadata dates are pinned to the payment date too), and no migration or counter table was
needed. **A jurisdiction that requires gap-free sequential invoice numbers would need a
persisted counter instead.**

**Seller block.** No legal entity or registered address is recorded anywhere in the repo, so it
is env-driven with a brand-only default (documented in `.env.example`):

| Env var                  | Effect                                                      |
| ------------------------ | ----------------------------------------------------------- |
| `BILLING_SELLER_NAME`    | Business name (default `DavinTrade`)                        |
| `BILLING_SELLER_ADDRESS` | Address lines, separated by `\|` or newlines (default none) |
| `BILLING_SELLER_TAX_ID`  | Printed as "Tax ID: …" (default none)                       |

`support@davintrade.app` and `davintrade.app` are always appended.

**Fonts.** `pdf-lib`'s 14 standard fonts need no font files, so the renderer runs unchanged on
Vercel. The trade-off is that they only encode WinAnsi (roughly Latin-1). So:

- amounts use ISO codes (`INR 1,930.34`) rather than `₹`, `฿`, `₫` or `₦`;
- Intl's no-break and thin spaces are normalised to plain spaces;
- a bill-to line that can't be encoded (a name in Thai or Arabic script) is **left off** rather
  than printed as `????`. The email line still identifies the customer.

Embedding a Unicode font (e.g. Noto Sans with `@pdf-lib/fontkit`) would lift all three limits, at
the cost of bundling a font file. Not done; see §9.

### 3.2 Full history API (`app/api/invoices/route.ts`)

- **Stripe:** new `getAllCustomerInvoices()` in `lib/stripe/stripe.ts` follows Stripe's cursor
  pagination (100 per page) via `autoPagingToArray`, capped at `MAX_INVOICE_HISTORY = 1000`.
  Monthly billing is 12 a year, so the cap only guards against a runaway loop.
- **dLocal:** all completed payments, same cap.
- Merged, sorted newest first. The response gains `total`. `?limit=N` still works for any caller
  that wants fewer (it had no other callers; the billing page is the only consumer).

**Amount semantics changed**, and the page is the only consumer:

| Field               | Now means                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `amount`+`currency` | **Exactly** what was charged, in the charged currency. Matches the PDF. For dLocal this is the local amount.          |
| `amountUsd` (new)   | USD value of that charge, net of discount. `null` when unknown (a Stripe invoice charged in a non-USD currency).      |
| `invoicePdfUrl`     | Stripe's PDF (falling back to the webhook-persisted `Invoice.invoicePdf`), or `/api/invoices/{id}/receipt` for dLocal |

Before, dLocal rows returned `amount = amountUSD` (gross, ignoring discount) next to
`currency = INR`, i.e. a USD number labelled as rupees.

### 3.3 The billing page

**Amount column** (`components/billing/invoice-list.tsx`):

- **Bold:** the exact charge in its own currency (`₹1,930.34`, `€34.51`, `US$29.00`), formatted
  with `formatChargedAmount()`. This is the sanctioned non-`formatCurrency()` path from
  `docs/policies/08-locale-i18n-compliance.md` §4: the figure is already in its real currency,
  and converting it again would be wrong.
- **Below it, when the charged currency differs from the display currency:** `≈ £18.10`, from
  `amountUsd` through the normal `formatCurrency()`. It has a tooltip saying it is indicative.
- The VAT line is now in the charged currency too.

**"Why amounts may differ" notice** (`role="note"`), shown above the table only when at least one
row has an indicative line:

- The bold amount is exactly what you were charged, and it matches the PDF.
- The ≈ figure converts it into {display currency} at an indicative rate, for reference only.
- _(when there are card charges)_ Card payments are charged in USD. A card in another currency
  gets converted by the bank at its own rate, possibly with a foreign-transaction fee.
- _(when there are dLocal charges)_ Local payments are priced in USD and converted by dLocal at
  the moment of payment; the rate is printed on each receipt.
- Exchange rates change daily and amounts are rounded.

**Plan card:** when the display currency isn't USD, under the "£22.62 /month" price: "Approximate
price in GBP. The plan is priced at US$29.00 USD; the amount you pay depends on the exchange rate
of your payment method."

**Paging:** the API returns everything; the page shows 12 rows, then **Load More** (+12) and
**Show all**, with "Showing X of Y invoices".

**FREE users with past invoices** now see the section too. Before, cancelling to FREE hid the
whole history, including receipts someone might need for tax or expenses. FREE users with no
invoices still see nothing, as before.

Download links carry accessible names: "Download receipt (PDF)" for dLocal, "Download invoice
(PDF)" for Stripe.

**Translations:** 12 new `billing.*` keys, all with English fallbacks, translated into `ar` and
`th`, the only two dictionaries that carry any `billing.*` keys (the 2026-09-01 compliance
session's precedent). Every other language falls back to English, like the rest of this page.

## 4. The pre-existing bug that mattered most: the buttons were invisible

Found during live verification. The invoice links were in the DOM with a 0×0 box. Walking the
computed styles found this rule in `app/globals.css`:

```css
/* Hide TradingView logo link in lightweight-charts */
a[href*='tradingview'],
a[title*='TradingView'],
.tv-lightweight-charts-logo,
[class*='logo'] a,
td a[target='_blank'] {
  display: none !important;
  ...
}
```

`td a[target='_blank']` matched **every link inside any table cell that opens in a new tab**.
The billing "View" and "PDF" buttons are exactly that, so **they have never been visible in
production, for Stripe users either**. It came in from the seed code in Session 9-1 (`533ae6db`).

**Fix:** scoped to `.tv-lightweight-charts td a[target='_blank']`. Two facts confirmed in the
library source before changing it:

- the chart's root element carries the class `tv-lightweight-charts` and lays itself out as a
  `<table>`, which is what the catch-all was written for;
- its logo link's `href` is `https://www.tradingview.com/?utm_medium=lwc-link…`, so
  `a[href*='tradingview']` still hides it.

Any other new-tab link in a table elsewhere in the app was hidden the same way, and is now
visible again.

## 5. Other bugs fixed along the way

| Bug                                                                          | Effect before                                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| dLocal rows used gross `amountUSD`                                           | A discounted $23.20 payment showed as $29                      |
| A Stripe invoice charged in EUR went through `formatCurrency()`              | Shown as "$34.51", and a GBP viewer would get it converted too |
| Stripe zero-decimal currencies (JPY, KRW, VND, …) were always divided by 100 | Would show ¥29 for a ¥2,900 charge                             |
| Stripe `invoice_pdf` missing from the list call had no fallback              | Now falls back to the webhook-persisted `Invoice.invoicePdf`   |

Two existing tests in `__tests__/pages/settings/billing.test.tsx` had **encoded** the EUR bug,
expecting `$34.51` and `incl. $5.51 VAT` for an invoice whose `currency` was `EUR`. They now
expect `€34.51` / `incl. €5.51 VAT`, which is what the Stripe PDF says. That is a correction, not
a loosened assertion.

## 6. Files changed

**New**

- `lib/billing/invoice-amounts.ts` — net USD, zero-decimal handling, implied rate, `formatChargedAmount()`
- `lib/billing/dlocal-receipt.ts` — receipt data builder, numbering, seller block
- `lib/billing/receipt-pdf.ts` — the `pdf-lib` renderer
- `app/api/invoices/[id]/receipt/route.ts` — the download route
- `__tests__/lib/billing/dlocal-receipt.test.ts` — 12 tests
- `__tests__/api/invoices.test.ts` — 8 tests (history API + receipt route)
- this manifest

**Modified**

- `app/api/invoices/route.ts` — full history, amount semantics, receipt links
- `lib/stripe/stripe.ts` — `getAllCustomerInvoices()`, `MAX_INVOICE_HISTORY`
- `components/billing/invoice-list.tsx` — amounts, notice, paging, accessible link names
- `app/settings/billing/page.tsx` — paging state, plan-price note, FREE-with-invoices section
- `app/globals.css` — the scoped rule (§4) and Prettier code style formatting
- `lib/i18n/dictionaries/{ar,th}.json` — 12 keys each
- `__tests__/pages/settings/billing.test.tsx` — 2 corrected assertions, 5 new tests
- `package.json`, `pnpm-lock.yaml` — `pdf-lib` (lockfile adds exactly `pdf-lib`,
  `@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `pako`, `tslib@1`); added `*.css` to `lint-staged`
- `.env.example` — the three `BILLING_SELLER_*` vars, documented without values
- `CLAUDE.md` — session entry

**Untouched:** money-service (the history API and receipts live in the monolith, which is where
`/api/invoices` has always been served), all Prisma schemas, `seed-code/`, `frontend/`.

## 7. Verification

**Static:** `tsc --noEmit` clean. ESLint clean on every changed file. Prettier clean on every
changed file, including `app/globals.css` (initially failed Prettier check from pre-existing
code on `main` and was left untouched in `1ad896a0`; subsequently formatted with Prettier and added
`*.css` to `lint-staged` in `package.json` under commit `636edcd2` so all files and CSS now pass
Prettier cleanly).

**Tests:** full `npm run test:ci` gives **232/232 suites · 3008/3008 tests**. That is the previous
baseline of 230/2983 plus exactly this work's 2 new suites and 25 new tests, with no regressions.

| Suite                                          | Tests | Covers                                                                                                             |
| ---------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| `__tests__/lib/billing/dlocal-receipt.test.ts` | 12    | Net USD, zero-decimal, rate, formatting, numbering, seller env, PDF text, determinism, Thai name                   |
| `__tests__/api/invoices.test.ts`               | 8     | 401s, dLocal row shape, complete history, `?limit`, non-USD Stripe, ownership `where`, PDF headers                 |
| `__tests__/pages/settings/billing.test.tsx`    | 12    | +5: local charge + ≈ + receipt link + notice, no notice when same currency, GBP viewer, paging, FREE with invoices |

The PDF tests read the text back **out of the generated file** (inflating its content streams)
rather than trusting the builder's input.

**Mutation checks, 5/5 killed, every restore byte-exact by sha256:**

| Mutant                                                  | Caught by           |
| ------------------------------------------------------- | ------------------- |
| Drop `userId` from the receipt route's `where`          | 1 test (`invoices`) |
| Use gross `amountUSD` instead of the net charge         | 1 test (`invoices`) |
| Default history cap back to 12                          | 1 test (`invoices`) |
| Format the charged amount with `formatCurrency()` again | 4 tests (`billing`) |
| Always slice the page's list to 12                      | 1 test (`billing`)  |

**Sample PDFs rendered and inspected visually:** a discounted INR monthly payment (discount row,
rate line, full bill-to) and a THB 3-day payment with a Thai-script name (name omitted, period
crossing into the next year: "Dec 30, 2026 – Jan 2, 2027").

## 8. Live verification (local `next dev`)

Through two throwaway unauthenticated routes (both deleted afterwards; the tree was clean):

- The real `InvoiceList` with 16 sample rows (INR dLocal, EUR Stripe with VAT, 14 USD Stripe) as
  an anonymous GBP viewer: the notice with its card and dLocal bullets; `₹1,930.34 / ≈ £18.10`;
  `€34.51` with no ≈ line (no USD basis) and `incl. €5.51 VAT (19%, DE)`; `US$29.00 / ≈ £22.62`;
  "Showing 12 of 16", then **Show all** → "Showing 16 of 16".
- **All 13 invoice links visible** after the CSS fix. Before it, every one measured 0×0.
- A receipt served through the Turbopack server bundle: 200, `application/pdf`, starts `%PDF-`,
  2,361 bytes, identical in size to the `tsx`-rendered sample (the output is deterministic).
- Signed out, the real `GET /api/invoices/pay_x/receipt` and `GET /api/invoices` both return **401**.
- Console: only the two 401s that were triggered on purpose.

## 9. Not verified / open items

- **Signed-in click-through on `/settings/billing`.** The Executor never enters credentials.
- **A real dLocal payment end to end.** Receipts have only been generated from sample rows. The
  first real one is worth opening and checking against dLocal's own confirmation.
- **A legal seller identity.** Receipts show only "DavinTrade" and the support contact until the
  `BILLING_SELLER_*` vars are set in Vercel. Customers who need receipts for tax or expenses will
  usually want a legal name and address.
- **Non-Latin names.** Omitted from the PDF (§3.1). A Unicode font would fix it.
- **Receipts are English only.** Stripe's PDFs follow the customer's Stripe locale; ours don't.
- **Refunded dLocal payments** are not listed. The history shows `COMPLETED` only, as before.
- **Other languages** fall back to English for the 12 new keys (only `ar`/`th` carry `billing.*`).
- **The displayed ≈ figure uses the app's static country exchange rates**
  (`lib/country-config.ts`), not live rates. The notice says it is indicative, which is accurate,
  but the rates still need periodic refreshing.

## 10. Rollback

No migration and no data writes, so rollback is a plain revert:

- `git revert 1ad896a0` restores the old CSS rule (and hides the buttons again).
- `git revert 82294af8 725a3781` restores the old page and API. The receipt route disappears,
  and dLocal rows go back to having no download.

Receipt PDFs are generated on request and never stored, so nothing needs cleaning up.
