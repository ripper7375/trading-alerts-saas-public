# Tax Invoicing Manifest — Work Completion Report

**Source design doc:** [`DavinTrade Architecture Design - Global SaaS Billing & Multi-Jurisdiction Tax.md`](./DavinTrade%20Architecture%20Design%20-%20Global%20SaaS%20Billing%20%26%20Multi-Jurisdiction%20Tax.md)
**Date:** 2026-08-29
**Status:** Code complete; database migration applied to production and verified; Stripe Dashboard / Irish OSS registration still manual (guidance below)

> **Scope note:** this document covers the multi-jurisdiction VAT/tax-invoicing feature only. The same working session also fixed an unrelated pre-existing bug in the affiliate commission flow and added a refund/dispute-clawback mechanism — none of that touches tax calculation or invoicing, so it's tracked separately in [`affiliate-commission-issues-fix.md`](./affiliate-commission-issues-fix.md).

---

## 1. What was built

Implemented in both the monolith and its dark-launched `money-service` mirror — checkout writes are flag-gated between the two (`shouldUseMoneyServiceForStripeWrite()`), so both needed identical changes to avoid one path collecting tax correctly and the other not.

### 1.1 Checkout — automatic tax (design doc §3)

- **`automatic_tax: { enabled: true }`**, **`tax_id_collection: { enabled: true }`**, and **`billing_address_collection: 'required'`** added to `createCheckoutSession` in `lib/stripe/stripe.ts` and its mirror `money-service/src/stripe/stripe.service.ts`. Stripe now calculates VAT/GST from IP, billing address, and card BIN in real time, and validates any EU VAT number entered against VIES for the 0% reverse-charge case.
- **Returning customers get `customer_update`.** Stripe rejects `customer_update` unless an existing `customer` id is attached, and this checkout always used a bare `customer_email`. Added an optional `existingStripeCustomerId` parameter — `app/api/checkout/route.ts` and `money-service/src/stripe/stripe-checkout.controller.ts` now look up the subscriber's stored `stripeCustomerId` first, and when one exists, pass `customer` + `customer_update: {address:'auto', name:'auto'}` instead, satisfying the EU two-factor address-proof rule for re-subscribing customers.

### 1.2 Webhook — tax capture (design doc §4, "Nuance 1")

Signature verification and dual-event dispatch (`checkout.session.completed` / `invoice.payment_succeeded`) already existed. The gap was that the finalized tax breakdown, PDF, and hosted URL — which only exist once `invoice.payment_succeeded` fires, never on `checkout.session.completed` — were never persisted.

- New `extractInvoiceTaxRecord` helper in `lib/stripe/webhook-handlers.ts` and `money-service/src/stripe/stripe-webhook.service.ts`. Pulls `tax`, `total`, `currency`, the customer's billing country, any VIES-validated VAT id, and the effective line-item tax rate off a finalized invoice, derives a `reverseCharge` reporting flag (0% tax + a tax id on file), and upserts it into the new `Invoice` row keyed on `stripeInvoiceId` — idempotent against Stripe's at-least-once webhook delivery.
- Wired into `handleInvoiceSucceeded` right after the existing subscription-renewal write; in money-service it runs inside the same `$transaction` as the renewal write and outbox event.

### 1.3 Schema & migration (design doc §5)

- New `Invoice` model added to **both** `prisma/non-market-data/schema.prisma` and `money-service/prisma/schema.prisma` (bare scalar `userId`/`subscriptionId`, no relation objects — matching this codebase's existing convention on `Payment`/`Subscription`). money-service carries its own copy purely so `this.prisma.invoice` typechecks against the same physical table.
- Hand-written, additive-only migration: `prisma/migrations/20260829000000_vat_tax_invoicing_stack/migration.sql` — `CREATE TABLE "Invoice"`, four indexes, and the `v_country_trailing_12m_sales` view from §5.2 that drives the OSS quarterly export and the UK £90k / US nexus watch lists. Written by hand rather than via `prisma migrate dev`/`db push` — see §4 for why, and for what that check turned up.

### 1.4 Dashboard API (design doc §8, Phase 5)

The doc asks for a `GET` endpoint returning `invoice_pdf` and `hosted_invoice_url`. `GET /api/invoices` already existed and already unifies Stripe + dLocal history, so it was extended instead of duplicated:

- Each Stripe line is enriched with the matching `Invoice` row (one batched `findMany` per request, joined in memory by `stripeInvoiceId`), adding `taxAmount`, `taxRate`, `taxCountry`, `customerTaxId`, `reverseCharge`, and `hostedInvoiceUrl` to the response.
- dLocal rows report a flat `taxRate: 0`, matching §1.1's "0% local tax for MVP" for those eight markets.
- The live Stripe API call stays as-is, so invoice history predating this rollout still resolves correctly.

### 1.5 Billing page — tax breakdown UI

The API-only rollout (§1.4) left the tax fields unread by the frontend. Added afterward, once asked for:

- `components/billing/invoice-list.tsx`: under the invoice's total amount, a taxed row now shows a muted line — `incl. $5.51 VAT (19%, DE)` — built from a single formatted string (`formatVatLine`) rather than mixed JSX text/expression children, specifically to avoid JSX's line-break whitespace collapsing silently inserting stray spaces around the parenthesis/comma. **The displayed total was never additive** — `amount` from the API is always the tax-inclusive figure actually charged; the VAT line clarifies how much of it is tax, it doesn't add to it.
- A validated B2B reverse-charge invoice (`reverseCharge: true`) shows an outline **"Reverse charge — 0% VAT"** badge instead of the VAT line — the two are mutually exclusive, matching how Stripe itself never applies both a tax rate and reverse charge to the same invoice.
- Untaxed invoices (US, dLocal's flat-rate markets, or any invoice with `taxAmount: 0`) render exactly as before — no line, no badge, zero visual change.
- A new **"View"** icon-button (external-link icon) appears next to the existing PDF download button whenever `hostedInvoiceUrl` is present, linking to Stripe's hosted invoice page.
- `app/settings/billing/page.tsx`'s local `Invoice` interface and its `GET /api/invoices` response mapping were extended to pass the five new fields through — previously they were explicitly dropped even though the API already returned some adjacent fields (`currency`, `provider`, `planType`) unused.

Three tests added to `__tests__/pages/settings/billing.test.tsx`, exercising the EU-VAT line, the reverse-charge badge, and the untaxed case explicitly (regression guard for "zero visual change" above).

---

## 2. Files changed

| File                                                                     | Change                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `lib/stripe/stripe.ts`                                                   | Automatic tax config + `existingStripeCustomerId` param          |
| `lib/stripe/webhook-handlers.ts`                                         | `extractInvoiceTaxRecord` + `Invoice` upsert                     |
| `app/api/checkout/route.ts`                                              | Look up existing Stripe customer before checkout                 |
| `app/api/invoices/route.ts`                                              | Merge tax breakdown into invoice history response                |
| `prisma/non-market-data/schema.prisma`                                   | New `Invoice` model                                              |
| `prisma/migrations/20260829000000_vat_tax_invoicing_stack/migration.sql` | **Added.** Table, indexes, `v_country_trailing_12m_sales` view   |
| `money-service/prisma/schema.prisma`                                     | Mirrored `Invoice` model                                         |
| `money-service/src/stripe/stripe.service.ts`                             | Mirrored checkout tax config                                     |
| `money-service/src/stripe/stripe-checkout.controller.ts`                 | Mirrored existing-customer lookup                                |
| `money-service/src/stripe/stripe-webhook.service.ts`                     | Mirrored tax capture in its own transaction                      |
| `__tests__/lib/stripe/stripe.test.ts`                                    | +3 tests: tax config, email vs. existing-customer paths          |
| `__tests__/lib/stripe/webhook-handlers.test.ts`                          | +4 tests: upsert shape, reverse charge, EU rate, unknown country |
| `money-service/src/stripe/stripe.service.spec.ts`                        | +1 test: existing-customer path                                  |
| `money-service/src/stripe/stripe-checkout.controller.spec.ts`            | +1 test; fixed a call-arity assertion                            |
| `money-service/src/stripe/stripe-webhook.service.spec.ts`                | +2 tests: upsert shape, reverse charge                           |
| `components/billing/invoice-list.tsx`                                    | VAT line, reverse-charge badge, hosted-invoice "View" link       |
| `app/settings/billing/page.tsx`                                          | Pass the 5 new tax fields through to `InvoiceList`               |
| `__tests__/pages/settings/billing.test.tsx`                              | +3 tests: EU VAT line, reverse-charge badge, untaxed no-op case  |

18 files touched (17 modified, 1 added), 14 new tests.

---

## 3. Test verification

| Suite                         | Result                                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monolith `test:ci` (full run) | **151/151 suites · 2214/2214 tests** (re-run after adding the billing-page UI tests)                                                                            |
| money-service full suite      | **61/62 suites · 535/536 tests** — the one failure is `prisma.shutdown.spec.ts`'s SIGTERM-timing test, a documented pre-existing flake unrelated to this change |
| TypeScript — monolith         | `tsc --noEmit`, 0 errors                                                                                                                                        |
| TypeScript — money-service    | `tsc --noEmit`, 0 errors                                                                                                                                        |

---

## 4. Database migration — status and what the pre-flight check found

**This is the one item that needed a stop-and-check before touching anything, and it turned up something worth knowing regardless of this feature.**

Running `prisma migrate status` against the live Railway Postgres database showed **all 10 migrations** — including the very first one, `20251227000000_init` — as "not yet applied." That's expected for a database that had never run a single migration; it is _not_ what you'd expect from a database that's clearly live and populated with real users, subscriptions, and payments.

Read-only inspection of the live database (`information_schema`, `pg_constraint` — no writes) confirmed why: the **`_prisma_migrations` bookkeeping table doesn't exist at all**, but the actual schema changes from 8 of the 9 pre-existing migrations are already live:

| Migration                                       | Live state                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `20251227000000_init`                           | ✅ Already live (`User`, `Subscription`, `Payment`, etc. all exist) |
| `20260214000000_rag_dual_memory`                | ❌ **Not applied** — none of its 6 tables exist                     |
| `20260224000000_update_kc_ha_body_columns`      | Moot — its target (`MarketData`) no longer exists                   |
| `20260705000000_add_market_data_v6`             | ✅ Live (`market_data_v6` exists, 1 row)                            |
| `20260705010000_drop_market_data`               | ✅ Live (`MarketData` confirmed gone)                               |
| `20260720000000_drop_money_user_fk_constraints` | ✅ Live (all 4 named FK constraints confirmed dropped)              |
| `20260721000000_add_refresh_token_table`        | ✅ Live (`RefreshToken` exists)                                     |
| `20260726000000_wise_disbursement_additive`     | ✅ Live (all 5 Wise tables exist)                                   |
| `20260727000000_outbox_event_additive`          | ✅ Live (`OutboxEvent` exists, matching column set)                 |

This matches this repo's own documented practice (`LESSONS-LEARNED.md` L6, and the Session 11-3/8-2/2-3 history in `CLAUDE.md`) of applying schema changes via hand-reviewed `prisma db execute` rather than `prisma migrate dev`/`deploy` — because this database's two Prisma schemas share one physical datasource, and Prisma's diff engine has previously proposed dropping the sibling schema's live tables when run the ordinary way. That practice is exactly why none of these got recorded in a migrations ledger that, it turns out, was never created in the first place.

**Why this matters for "just apply the migration":** running `prisma migrate deploy` as-is would have tried to re-run `init` first — `CREATE TABLE "User"` against a database where `User` already exists — and failed immediately, before ever reaching this feature's migration. Forcing past that with a full re-run would additionally have deployed `rag_dual_memory`'s 6 tables live as an unintended side effect of an unrelated request.

**The correct, standard remediation** (Prisma's own "baselining an existing database" procedure) is to mark the 8 already-applied migrations as resolved in the ledger — a bookkeeping-only operation, `prisma migrate resolve --applied <name>`, which does **not** execute any SQL — while deliberately leaving `rag_dual_memory` un-baselined so it stays exactly as it is today (not this session's call to make). Only then does `prisma migrate deploy` see just the one genuinely new migration and apply only that.

That sequence touches ledger entries going back to the original 2025 `init` migration, which is more than "run this one migration" implies on its face, so it was held for explicit sign-off rather than run automatically — approved 2026-08-29, then executed and verified.

```bash
# Step 1 — baseline the 8 migrations already reflected live (bookkeeping only, no SQL executed):
npx prisma migrate resolve --applied 20251227000000_init --schema=prisma/non-market-data/schema.prisma
npx prisma migrate resolve --applied 20260224000000_update_kc_ha_body_columns --schema=prisma/non-market-data/schema.prisma
npx prisma migrate resolve --applied 20260705000000_add_market_data_v6 --schema=prisma/non-market-data/schema.prisma
npx prisma migrate resolve --applied 20260705010000_drop_market_data --schema=prisma/non-market-data/schema.prisma
npx prisma migrate resolve --applied 20260720000000_drop_money_user_fk_constraints --schema=prisma/non-market-data/schema.prisma
npx prisma migrate resolve --applied 20260721000000_add_refresh_token_table --schema=prisma/non-market-data/schema.prisma
npx prisma migrate resolve --applied 20260726000000_wise_disbursement_additive --schema=prisma/non-market-data/schema.prisma
npx prisma migrate resolve --applied 20260727000000_outbox_event_additive --schema=prisma/non-market-data/schema.prisma
```

`rag_dual_memory` is intentionally left out of this step, so it remains not-applied — deploying that feature is a separate decision for whoever owns it.

**Step 2 deviated from the plan above, in a stricter direction.** `prisma migrate deploy` applies every _unresolved_ migration in chronological order, and `rag_dual_memory` (`20260214...`) sorts before this feature's migration (`20260829...`) — running `deploy` at that point would have applied `rag_dual_memory`'s 6 tables live as a side effect, exactly what baselining was meant to avoid. Caught this from `migrate status`'s output before running it, so instead of `deploy`, the exact same `prisma db execute --file <script>` + `prisma migrate resolve --applied` pattern this codebase already uses elsewhere (Session 11-3/8-2/2-3) was used here too — applies precisely this migration's reviewed SQL and nothing else, then records it in the ledger:

```bash
npx prisma db execute --file prisma/migrations/20260829000000_vat_tax_invoicing_stack/migration.sql
npx prisma migrate resolve --applied 20260829000000_vat_tax_invoicing_stack --schema=prisma/non-market-data/schema.prisma
```

**Verified post-apply, all via read-only queries:**

- `Invoice` table exists, `v_country_trailing_12m_sales` view exists and queries cleanly (0 rows, as expected — no invoices have been created against it yet).
- `market_data_v6` still holds exactly 1 row — untouched.
- `mt5_accounts` (and the rest of `rag_dual_memory`'s tables) still don't exist — correctly left alone.
- `_prisma_migrations` now correctly lists all 9 legitimately-applied migrations plus this feature's, with `rag_dual_memory` correctly absent.

---

## 5. Manual actions still required

### 5.1 Stripe Dashboard configuration (design doc §6)

None of this has a code surface — it's all Dashboard clicks. Steps below, current as of Stripe's published Tax documentation; screen labels can shift, so if something doesn't match exactly, search Stripe's own "Tax registrations" and "Product tax codes" help articles for the current wording.

1. **Turn on Stripe Tax.** Dashboard → **Settings → Tax** → if not already enabled, click through Stripe's setup flow. This is a prerequisite for `automatic_tax` (already wired into checkout by this session's code) to actually calculate anything.
2. **Set the product tax code.** Dashboard → **Product catalog** → open the PRO subscription's Price/Product → **Tax code** field → set to **`txcd_10501000`** ("Software as a service (SaaS) — business use or personal use"). This is what tells Stripe's tax engine to treat DavinTrade as a digital SaaS product under each jurisdiction's digital-service rules, rather than defaulting to "general — tangible goods" (which would misclassify the tax treatment everywhere).
3. **Add the EU Non-Union OSS tax registration** — do this _after_ completing §5.2 below, since it needs the `EU372XXXXXX` number that registration produces. Dashboard → **Settings → Tax → Tax registrations → Add registration** → country/region **European Union** → registration type **Non-Union OSS scheme** → enter the Irish-issued OSS number. Until this registration is added, Stripe Tax will calculate what EU VAT _would_ be owed (useful for monitoring) but Checkout won't actually charge it.
4. **Add the UK domestic registration once the £90k rolling threshold is approached** (design doc §1.1 row 3) — same screen, country **United Kingdom**, using the UK VAT number once HMRC-registered. Not needed at launch if turnover is under threshold; Stripe Tax will keep monitoring UK sales in the meantime.
5. **Customize the invoice template.** Dashboard → **Settings → Invoicing (or Billing → Invoice template)** → set:
   - Company name and the UK Ltd's registered office address (must match the Certificate of Incorporation used in §5.2).
   - Default memo/footer: _"DavinTrade — Algorithmic Analysis & SaaS Platform. VAT Reverse Charge applies to eligible non-UK business customers."_
6. **Test before going live.** Use a Stripe **test-mode** checkout with a Test Clock: run one session with a German billing address (should show 19% VAT) and one with a validated B2B EU VAT ID (should show 0% + "Reverse Charge" note). This mirrors the design doc's own Phase 6 checklist item and is the one verification step this session couldn't do without live dashboard/test-mode access.

### 5.2 Irish Revenue OSS registration (design doc §7)

This is a genuine government registration under the EU VAT **Non-Union One-Stop-Shop (OSS) scheme**, which lets a non-EU business (a UK Ltd qualifies, post-Brexit) file _one_ quarterly VAT return covering all 27 EU member states, through a single member state of identification — this doc's choice is Ireland. High-level steps; verify current form names against [revenue.ie](https://www.revenue.ie)'s own OSS pages, since government portals change their exact screens more often than this guidance gets updated:

1. **Confirm eligibility.** Non-Union OSS is for businesses with no EU establishment supplying digital/electronic services (which covers DavinTrade's SaaS access) to EU **consumers** (B2C only — B2B sales stay on the reverse-charge path already wired into checkout, and don't go through OSS at all).
2. **Register for Revenue's OSS service.** Go to Revenue's **One Stop Shop (OSS)** section and select **Non-Union scheme** registration. As a non-resident business you'll typically need to register for Revenue Online Service (ROS) access before or as part of this — Revenue's non-resident registration path issues the credentials needed to file.
3. **Submit the registration application**, providing:
   - UK Certificate of Incorporation.
   - Registered office address (must match what goes on Stripe invoices — see §5.1 step 5).
   - Director/officer details.
   - A contact email and the bank account VAT remittances will be paid from.
   - The effective date of the first EU B2C sale requiring VAT collection.
4. **Receive the OSS VAT identification number**, issued in the format **`EU372XXXXXX`** (the `372` prefix is Ireland's Non-Union OSS scheme code). Add this number into Stripe per §5.1 step 3.
5. **File quarterly, every quarter without exception once registered** (a nil return is still required for a quarter with no EU B2C sales):

   | Quarter | Covers    | Filing deadline |
   | ------- | --------- | --------------- |
   | Q1      | Jan – Mar | Apr 30          |
   | Q2      | Apr – Jun | Jul 31          |
   | Q3      | Jul – Sep | Oct 31          |
   | Q4      | Oct – Dec | Jan 31          |

   Each quarter: export Stripe's **Tax → EU OSS filing report** (Dashboard → Reports, or the Tax section directly) for gross EUR sales and VAT collected per member state; log into ROS, locate the OSS return, enter the country-by-country totals from that report, submit, and pay the total VAT due as a **single EUR wire transfer** — Revenue disburses the correct share to each member state automatically. This is exactly what the new `v_country_trailing_12m_sales` view (§1.3) exists to cross-check against.

6. **Keep records for 10 years** (OSS's retention requirement is longer than this codebase's general audit-log retention) — archive each quarter's exported Stripe report alongside the filed return.

---

## 6. Frontend UI

**No frontend change was required for correctness.** `components/billing/invoice-list.tsx` and `app/settings/billing/page.tsx` originally destructured only `{ id, date, amount, status, description, invoicePdfUrl }` off each invoice from `GET /api/invoices` — they already ignored fields like `currency`, `provider`, and `planType` that existed before this change. The new tax fields were purely additive to that same response; nothing would have broken by leaving the UI untouched.

**Implemented anyway, on request — see §1.5 above for the full detail.** Summary: a taxed invoice's amount now shows a muted `incl. $5.51 VAT (19%, DE)` line underneath (never additive — `amount` is always the tax-inclusive total actually charged); a validated B2B invoice shows a "Reverse charge — 0% VAT" badge instead of that line; untaxed invoices (US, dLocal, or any zero-tax record) render pixel-identical to before; and a "View" link to Stripe's hosted invoice page appears next to the PDF download button when available. Three new tests in `__tests__/pages/settings/billing.test.tsx` cover all three display states, including the untaxed no-change case as an explicit regression guard.

---

## 7. Explicitly out of scope

- **`mode: 'payment'` / conditional `invoice_creation`** (design doc §3.1) — Stripe Checkout Sessions have two relevant modes: `subscription` (recurring billing) and `payment` (a single one-time charge). In `subscription` mode Stripe automatically generates a proper Invoice object — with a PDF and the tax breakdown this feature now captures — for every billing cycle, no extra flag needed. In `payment` mode it does **not**: a one-time charge produces a bare PaymentIntent/Charge with no Invoice/PDF unless `invoice_creation: { enabled: true }` is explicitly passed, which is what this doc section is about. DavinTrade's checkout only ever builds `mode: 'subscription'` sessions (`STRIPE_PRO_PRICE_ID` is the only price, there's no lifetime-license or one-off-addon product), so subscriptions already get invoices automatically and this flag has nothing to attach to today. Worth remembering if a one-time product ever ships — without this flag, that purchase would silently have no PDF invoice and no tax breakdown captured for it.
- **Live Stripe Test Clock end-to-end run** (design doc Phase 6) — covered by the Jest unit tests against the same German-VAT and B2B-reverse-charge fixtures, but a live dashboard/test-mode run is called out in §5.1 step 6 above as still worth doing by hand.
