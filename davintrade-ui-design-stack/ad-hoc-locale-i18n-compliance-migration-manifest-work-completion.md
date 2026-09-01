# Locale / i18n Compliance Remediation Manifest — Work Completion Report

**Date:** 2026-09-01
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Ad-hoc migration order (Davin-approved directly in chat) — outside the phase/session
numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Governed by
`docs/policies/08-locale-i18n-compliance.md` (SSOT) and executed via
`docs/migration-orders/adhoc-locale-i18n-compliance.migration-order.md`, now `CLOSED SUCCESSFUL`.
Recorded in `CLAUDE.md`'s matching ad-hoc note.

> **Scope note:** this document covers the locale/i18n wiring remediation across the 5
> most-recently-built feature stacks (Settings→Language, BI Dashboards, VAT/Tax Invoicing,
> Affiliate Commissions, DavinTrade Academy + Payments) plus the §0 CRITICAL Settings-page bug.
> It does not touch business logic, UI structure, or data contracts in any of those stacks —
> every change is either "wire this string/date/currency through the existing locale system" or
> a same-behavior refactor to make that possible.

---

## 1. What was built

The SSOT (`08-locale-i18n-compliance.md`) documented a recurring failure class: every ad-hoc
session that shipped a new page or component since the locale system was built (UAE/Arabic
session onward) never called into it at all — hardcoded English JSX, `date-fns`/
`toLocaleDateString('en-US', ...)` calls, hand-rolled `$${x.toFixed(2)}` currency strings — plus
one standalone critical bug: the Settings → Language page saved a preference to the database but
nothing downstream ever read it back, so Save was a complete no-op for the running app. This
session closed both gaps across 5 sequenced batches, one commit each.

### 1.1 Batch 1 — Settings → Language page (the §0 critical fix)

- `app/settings/language/page.tsx`: `handleSave()` now also calls `setLocalePreferences()` from
  `useLocale()` after the `PUT /api/user/preferences` succeeds — mirroring
  `components/layout/app-header.tsx`'s existing working write path — so a save takes effect
  immediately in the current session (`localStorage` + the `davintrade-locale` cookie), not just
  in the database.
- `fr` and `zh` removed from the page's own standalone `languages` array — neither has a backing
  dictionary in `lib/i18n/dictionaries/`, so selecting either would have silently degraded to
  English forever even with the write-path fixed.
- Section headers, labels, and button states wired to `t()`. Reused 4 pre-existing, fully
  translated but orphaned dictionary keys (`settings.nav.language`, `form.display_language`,
  `form.date_format`, `form.time_format`) after verifying their stored English text matched this
  page's literal copy byte-for-byte — a free win across all 13 dictionaries.

### 1.2 Batch 2 — Business Intelligence Dashboards

All 7 `components/admin/analytics/*.tsx` components and 8 admin/affiliate dashboard pages wired
to the locale system:

- **Found via live code, not the order's own grouping:** `kpi-summary-card.tsx` and
  `tax-threshold-gauge.tsx` had no `'use client'` directive and did no currency formatting of
  their own — made async Server Components (`getServerLanguage()`+`getDictionary()`) instead of
  the Client Components the order's text assumed, avoiding an unforced client-bundle increase.
- `ranked-country-table.tsx` and `top-affiliates-leaderboard.tsx` genuinely needed to become
  Client Components (`'use client'` added), since they format their own confirmed-USD columns and
  only `useLocale()`'s `formatCurrency()` does real per-viewer currency conversion.
- **Two new shared primitives added**, not named in the order but needed to route Server
  Component dashboard pages' confirmed-USD figures through the same currency conversion the
  client side uses: `formatCurrencyAmount()` (`lib/country-config.ts`) and
  `getServerLocalePreferences()` (`lib/i18n/server-locale.ts`). `locale-context.tsx`'s own client
  `formatCurrency()` now delegates to the shared helper — verified byte-for-byte identical output.
- `app/affiliate/leaderboard/page.tsx` (public marketing page) localized in the same batch.

### 1.3 Batch 3 — VAT & Tax Invoicing

- `components/billing/invoice-list.tsx`: replaced `toLocaleDateString('en-US', ...)` with
  `formatDate()`, `$${amount.toFixed(2)}` with `formatCurrency()`, and the hand-rolled VAT-line
  string concatenation with a curated, translatable template. Status badges and the reverse-charge
  badge routed through `t()`.
- `app/settings/billing/page.tsx`: subscription summary, cancel-flow dialog, payment method, and
  usage sections all wired to `useLocale()`.
- Both `Invoice.amount`/`Invoice.taxAmount` confirmed USD (Stripe-only pricing) before wiring into
  `formatCurrency()`, per the order's Decision 4 mandate.

### 1.4 Batch 4 — Affiliate Commissions & Clawbacks

- `components/affiliate/commission-table.tsx`: dropped `date-fns` entirely in favor of
  `formatDate()`/`formatCurrency()`; status badges, the Clawback badge, and its tooltip now route
  through `t()`.
- `app/affiliate/dashboard/commissions/page.tsx` and `app/admin/affiliates/[id]/page.tsx` given
  the same treatment — the admin detail page also drops its own local `$`-hardcoded
  `formatCurrency`/`en-US` `formatDate` helpers in favor of `useLocale()`'s.
- `Commission.commissionAmount` USD-safety verified by tracing `money-service`'s dLocal webhook
  path directly (`grossRevenueUsd` is explicitly converted to USD before being credited,
  regardless of payment provider) rather than assumed from the field's naming convention alone.

### 1.5 Batch 5 — DavinTrade Academy & Payments

- `app/(marketing)/academy/page.tsx` and `academy/[id]/page.tsx`: `generateMetadata()` wired to
  `getServerLanguage()`+`getDictionary()`; `CATEGORY_LABELS`, hero copy, category filter pills,
  featured badge, and CTA sections all localized.
- `app/admin/tutorials/page.tsx`: full CRUD console (dialogs, table, status toggle, success/error
  messages) wired to `useLocale()`/`t()`; dropped its own local `en-US`-hardcoded `formatDate`.
- `components/payments/{CountrySelector,PaymentMethodSelector,PriceDisplay}.tsx`: static labels
  localized via `t()`. `PriceDisplay`'s dLocal conversion pipeline and its own
  `formatLocalAmount()`/`formatUsdAmount()` number formatting left **untouched** per the order's
  explicit Decision 5 — its API-driven exchange rate must not be routed through `formatCurrency()`,
  which would silently double-convert it. Its relative-time helper now delegates to
  `useLocale()`'s own `formatRelativeTime()` instead of a bespoke reimplementation.

---

## 2. Files changed

| File                                                                    | Change                                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `app/settings/language/page.tsx`                                        | §0 fix: `setLocalePreferences()` wired, `fr`/`zh` removed, labels localized                   |
| `components/admin/analytics/kpi-summary-card.tsx`                       | Async Server Component, `t()`/dict wiring                                                     |
| `components/admin/analytics/ranked-country-table.tsx`                   | New `'use client'`, `useLocale()`, `formatCurrency()`                                         |
| `components/admin/analytics/tax-threshold-gauge.tsx`                    | Async Server Component, `t()`/dict wiring                                                     |
| `components/admin/analytics/donut-market-share.tsx`                     | `useLocale()`, locale-aware number formatting                                                 |
| `components/admin/analytics/historical-trend-chart.tsx`                 | `useLocale()`, tooltip labels translated                                                      |
| `components/admin/analytics/top-affiliates-leaderboard.tsx`             | New `'use client'`, `useLocale()`, `formatCurrency()`                                         |
| `components/admin/analytics/timeframe-filter.tsx`                       | `useLocale()`, label translated                                                               |
| `app/admin/dashboards/layout.tsx`                                       | Async, `getServerLanguage()`+`getDictionary()`                                                |
| `app/admin/dashboards/dashboard-tabs.tsx`                               | `useLocale()`, tab labels translated                                                          |
| `app/admin/dashboards/revenue/page.tsx`                                 | `getServerLocalePreferences()`, `formatCurrencyAmount()`, full localization                   |
| `app/admin/dashboards/users/page.tsx`                                   | `getServerLanguage()`+`getDictionary()`, full localization                                    |
| `app/admin/dashboards/regional/page.tsx`                                | `getServerLocalePreferences()`, `formatCurrencyAmount()`, full localization                   |
| `app/admin/dashboards/affiliates/page.tsx`                              | `getServerLocalePreferences()`, `formatCurrencyAmount()`, full localization                   |
| `app/admin/dashboards/executive/page.tsx`                               | `getServerLocalePreferences()`, `formatCurrencyAmount()`, full localization                   |
| `app/affiliate/leaderboard/page.tsx`                                    | `getServerLanguage()`+`getDictionary()`, full localization                                    |
| `components/billing/invoice-list.tsx`                                   | `formatDate()`/`formatCurrency()`, VAT-line template, status badges                           |
| `app/settings/billing/page.tsx`                                         | Full `useLocale()` wiring across subscription/cancel/usage sections                           |
| `components/affiliate/commission-table.tsx`                             | Dropped `date-fns`, `formatDate()`/`formatCurrency()`, `CommissionTableProps` exported        |
| `app/affiliate/dashboard/commissions/page.tsx`                          | Full `useLocale()` wiring                                                                     |
| `app/admin/affiliates/[id]/page.tsx`                                    | Dropped local `formatCurrency`/`formatDate` helpers for `useLocale()`'s                       |
| `app/(marketing)/academy/page.tsx`                                      | `generateMetadata()`, category labels, hero/CTA localized                                     |
| `app/(marketing)/academy/[id]/page.tsx`                                 | `getServerLanguage()`+`getDictionary()`, full localization                                    |
| `app/admin/tutorials/page.tsx`                                          | Full `useLocale()` wiring, dropped local `formatDate` helper                                  |
| `components/payments/CountrySelector.tsx`                               | `useLocale()`, labels translated                                                              |
| `components/payments/PaymentMethodSelector.tsx`                         | `useLocale()`, labels + processing-time badges translated                                     |
| `components/payments/PriceDisplay.tsx`                                  | `useLocale()` for labels + `formatRelativeTime()` only — conversion pipeline untouched        |
| `lib/country-config.ts`                                                 | **New** `formatCurrencyAmount()` shared helper                                                |
| `lib/context/locale-context.tsx`                                        | `formatCurrency()` now delegates to the shared helper (same output)                           |
| `lib/i18n/server-locale.ts`                                             | **New** `getServerLocalePreferences()`                                                        |
| `lib/i18n/dictionaries/ar.json`                                         | ~250 new curated Arabic translations across all 5 stacks                                      |
| `lib/i18n/dictionaries/th.json`                                         | ~250 new curated Thai translations across all 5 stacks                                        |
| `lib/i18n/dictionaries/en-GB.json`                                      | A handful of Batch 1 identity entries                                                         |
| `lib/i18n/dictionaries/en-US.json`                                      | A handful of Batch 1 identity entries                                                         |
| `__tests__/pages/settings/billing.test.tsx`                             | **Fixed** — wrapped in `LocaleProvider`, seeded US/USD preferences                            |
| `__tests__/components/affiliate/commission-table.test.tsx`              | **Fixed** — same, plus 2 assertions updated for real `formatCurrency()`/`formatDate()` output |
| `__tests__/pages/affiliate/commissions-payouts.test.tsx`                | **Fixed** — same `LocaleProvider` wrap                                                        |
| `__tests__/components/payments/PriceDisplay.test.tsx`                   | **Fixed** — same, plus geo-IP fetch-count fix                                                 |
| `docs/migration-orders/adhoc-locale-i18n-compliance.migration-order.md` | **Added.** The executed order itself                                                          |
| `docs/policies/08-locale-i18n-compliance.md`                            | **Added.** The governing SSOT; §6 pointer note + §8 log entry added at close                  |
| `docs/migration-orders/LESSONS-LEARNED.md`                              | L40 recurrence note (5th–8th occurrences in this session)                                     |
| `CLAUDE.md`                                                             | Ad-hoc session note + Waiting-on updates (this doc's own source)                              |

**42 files touched (2 added, 40 modified)**, 2,928 insertions / 701 deletions across 6 commits.

---

## 3. Test verification

| Suite                                                                                                                                                                 | Result                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monolith Jest, full suite (`npm run test:ci`), re-run fresh at CONFIRM and again at CLOSE                                                                             | **165/165 suites · 2382/2382 tests passed** (exact match, zero regressions)                                                                                                                                               |
| Monolith Jest, scoped per-batch runs (analytics, billing, commission-table, commissions-payouts, PriceDisplay, admin-tutorials, tutorials service/validators/youtube) | **All green** — 6/6, 7/7, 34/34, 92/92, 109/109 across the relevant batch re-runs                                                                                                                                         |
| TypeScript — monolith                                                                                                                                                 | `tsc --noEmit`, 0 errors, re-checked after every file edit                                                                                                                                                                |
| TypeScript — money-service                                                                                                                                            | `tsc --noEmit`, 0 errors (untouched this session — baseline confirmed unchanged)                                                                                                                                          |
| TypeScript — operation-service                                                                                                                                        | `tsc --noEmit`, 0 errors (untouched this session — baseline confirmed unchanged)                                                                                                                                          |
| ESLint (`app components lib hooks`, `--max-warnings 0`)                                                                                                               | 4 pre-existing `no-img-element` warnings on Academy/tutorials files, confirmed via `<img>` tag count diff to predate this session (same class already documented in `CLAUDE.md`'s 2026-08-31 Academy entry); 0 new issues |
| Repo-wide locale audit (order's own final check, `git diff origin/main...HEAD` + grep)                                                                                | **Zero unhandled occurrences**                                                                                                                                                                                            |
| Manual per-file re-audit of all 29 files named in the SSOT's §6 inventory                                                                                             | **28/29** call `useLocale()`/`getServerLanguage()`/`getDictionary()` directly; the one exception (`app/admin/dashboards/page.tsx`, a redirect stub with zero user-facing text) is a deliberate, documented non-issue      |

---

## 4. Live browser verification

Started the real dev server (`next dev`, Turbopack) and drove it directly for every surface this
order touches, not just the two that don't require authentication:

- **`http://localhost:3000/affiliate/leaderboard`** (public) — full page renders in Arabic with
  `document.documentElement.dir` = **`rtl`**, every translated string confirmed by literal page
  text (hero, badge, table headers, empty state, bottom CTA), **zero console/server errors**.
- **`http://localhost:3000/academy`** and **`http://localhost:3000/academy/[id]`** (public) — same
  result: Arabic title via `generateMetadata()`, `dir="rtl"`, translated category pills, featured
  badge, CTA sections, back-link, and Related Tutorials header, **zero console/server errors**.
- **The other 8 pages this order touches are all auth-gated**
  (`/settings/language`, `/admin/dashboards/*` ×5, `/settings/billing`,
  `/affiliate/dashboard/commissions`, `/admin/affiliates/[id]`, `/admin/tutorials`, `/checkout`) —
  each confirmed to compile cleanly and redirect to `/login?callbackUrl=...` for an
  unauthenticated visitor with **zero server errors**, both on the running dev server and again
  after a full cold restart (ruling out a transient Turbopack HMR error — see §8). Full
  authenticated click-through was **not** performed: the Executor is categorically prohibited from
  entering credentials, including the dev login page's own test-account autofill buttons, matching
  this repo's own established handling of the identical boundary in the 2026-08-31 BI-dashboard
  and Academy ad-hoc sessions. Dev server left running for Davin's own pass.

---

## 5. Git history

Landed as 6 scoped commits on `main` (one per batch, plus a closing docs commit), then pushed to
`origin/main`:

| Commit     | Summary                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `8d9e2046` | `fix(i18n): wire settings language page to LocaleContext and prune unsupported locales` — §1.1                                              |
| `a4f05b8d` | `fix(i18n): wire BI dashboards and analytics components to locale system` — §1.2                                                            |
| `b2c8b027` | `fix(i18n): localize tax invoicing and billing history components` — §1.3                                                                   |
| `358198f3` | `fix(i18n): localize affiliate commission table and dashboard pages` — §1.4                                                                 |
| `e0a454b8` | `fix(i18n): localize Academy pages and payments components` — §1.5                                                                          |
| `53e3e1fb` | `docs: close out locale/i18n compliance ad-hoc order (CLOSED SUCCESSFUL)` — this manifest's `CLAUDE.md`/order/policy/lessons source entries |

---

## 6. A note on concurrent work

No concurrent commits landed on `main` while this session was in progress — `git log
6d8489ad..53e3e1fb` shows an unbroken, linear sequence of exactly this session's 6 commits.

---

## 7. Scope note: curated-partial dictionary coverage

Following the same precedent the UAE/Arabic session established (and this order's own Decision
2), dictionary coverage was **curated, not exhaustive**: every literal string actually rendered by
the 5 stacks' chrome got a real `t()`/`dict[]` call site, but only `ar.json` and `th.json` (the two
locales the order's own live-verification steps named) received real translations for the ~250
new keys this introduced — `en-GB.json`/`en-US.json` rely on the locale system's existing
key-as-fallback convention (a missing key falls back to the literal English text passed as the
`t()` fallback parameter), except for the handful of Batch 1 keys where an identity entry was
added for consistency with that page's existing dictionary neighbors.

This is safe by construction, the same way the UAE/Arabic session's partial coverage was:
`t(keyOrText, fallback)` degrades to its `fallback` param or the raw key for any dictionary
missing an entry; `getDictionary()` falls back to `en-GB` wholesale if a language is missing
entirely. A user on `es`/`de`/`ja`/`pt`/`hi`/`vi`/`id`/`tr`/`ur` sees correct English for these 5
stacks rather than a broken or raw-key render; expanding curated coverage to more locales is a
follow-up content task, not a code change.

---

## 8. Explicitly out of scope

- **§0 Part 2 (`app/layout.tsx` / `lib/i18n/locale-resolver.ts` reading the authenticated user's
  stored database preference)** — flagged in the order itself as `⚠ NEEDS EXPLICIT SIGN-OFF
(FUTURE SESSION)`. This alters server-side session/auth data flow across the layout boundary,
  which `CLAUDE.md` non-negotiable #5 requires Davin's explicit design sign-off for, in a separate
  order — not bundled into this remediation.
- **Full 13-language dictionary parity** — see §7. Only `ar`/`th` got real translations for the
  new keys this session added; the other 9 locales fall back to English for this specific batch of
  strings.
- **A repo-wide `jest.setup.js` default `LocaleProvider` mock** — `LESSONS-LEARNED.md` L40's own
  stated trigger after 4 prior sessions was hit 4 more times in this one (8 occurrences total).
  Out of this order's scope (test infrastructure, not locale wiring); flagged again for whichever
  session next has room to add it.
- **Authenticated click-through of the 8 auth-gated pages this order touches** — needs Davin's own
  login pass; the Executor does not enter credentials under any circumstances. See §4 and
  `CLAUDE.md`'s Waiting-on section.
- **Pre-existing, unrelated ESLint errors** in 4 test files this session never touched
  (`admin-affiliates.test.ts`, `payment-creation.test.ts`, `pnl-calculator.test.ts`,
  `detect-country.test.ts`) and the pre-existing `no-img-element` warnings on Academy/tutorials
  pages (see §3) — confirmed unrelated via direct diff, left untouched per scope discipline.
- **`scripts/validate-file.js` (`npm run validate:policies`)** — fails on this machine with
  `Cannot find module 'glob'`; `glob` isn't a declared dependency anywhere in `package.json`. A
  pre-existing environment/tooling gap unrelated to locale work, not fixed as a drive-by.
- **A transient Turbopack HMR error** ("Identifier 'formatCurrency' has already been declared")
  observed twice mid-session — confirmed as stale-HMR noise via a full dev-server restart (the
  identical route compiled and redirected cleanly on a cold start), not a real code defect. No
  action taken; not logged as a new lesson (single narrow trigger so far).
