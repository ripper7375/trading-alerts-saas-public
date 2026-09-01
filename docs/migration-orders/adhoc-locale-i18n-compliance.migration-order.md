# Migration Order — Ad-hoc Session — Locale / i18n Compliance & Remediation

> **Context & Mandate:** Remediation of recurring i18n/locale omission across recently built surfaces
> and the critical disconnection in the Settings → Language page.
> Governed by `docs/policies/08-locale-i18n-compliance.md` (SSOT), `EXECUTOR-PROTOCOL.md` §6 (Ad-hoc sessions),
> and `00-SKELETON-AND-RULES.md` §1.0 / §4.
> **Creativity dial: Low-Medium** — UI structures, contracts, and business logic remain strictly unchanged;
> the work is purely wiring components to `useLocale()` / `getServerLanguage()` + `getDictionary()`,
> normalizing currency/date formatters, and adding curated dictionary keys.
> **Status: APPROVED** — Reviewed and authorized by Davin. Ready for Claude Code (Executor) to CONFIRM and execute.

**Session:** Ad-hoc (Outside Playbook Numbering) · **Phase:** Phase-Independent UI / Locale Remediation · **Variant:** UI-BUILD / REMEDIATION · **Status:** CLOSED SUCCESSFUL  
**Generated:** 2026-09-01 (Advisor / Antigravity) · **Approved:** 2026-09-01 (Davin) · **CONFIRMED:** 2026-09-01 (Executor) · **Closed:** 2026-09-01 (Executor) · **Flags touched:** none · **Estimated time:** ~4–5h (5 phased batches/checkpoints, gated on `tsc`, tests, and live browser verification).

> **CONFIRM note (Executor, 2026-09-01):** order file and `docs/policies/08-locale-i18n-compliance.md` are both untracked (zero git history) — the same recurring L3 status-integrity pattern as the last several sessions. Davin's own chat instruction directing execution of this specific, named order file is treated as his live confirmation of APPROVED status, consistent with how prior sessions (14-2, 14-3) resolved this identical pattern. `CLAUDE.md`'s only working-tree diff is the one-line pointer row this order's own "Key documents" table added — no unexplained drift. Baseline re-verified fresh before touching any file: `npx tsc --noEmit` clean, `npm run test:ci` **165/165 suites, 2382/2382 tests** — exact match to CLAUDE.md's last recorded baseline, zero drift.

---

## Decisions taken

> Five authoritative architectural and technical decisions made by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> One flagged item is surfaced separately for future design sign-off per `CLAUDE.md` non-negotiable #5.

1. **Settings Page Scope: Execute Part 1 Immediately; Isolate Part 2 for Future Sign-off**
   - **Chosen:** In `app/settings/language/page.tsx`, wire `handleSave()` to call `setLocalePreferences(settings)` from `useLocale()` (mirroring `components/layout/app-header.tsx`), persisting changes immediately to `localStorage` and the `davintrade-locale` cookie. Align the language dropdown by removing `fr` and `zh` (which lack dictionary files in `lib/i18n/dictionaries/`), restricting options to supported system languages.
   - **Rejected:** Bundling §0 Part 2 (consulting the authenticated database row in `app/layout.tsx` / `resolvePreferences()`) into this execution order.
   - **Why:** Part 1 immediately restores the user-facing control for the active session, future sessions in the same browser, and all subsequent SSR navigations reading the cookie. Part 2 alters server-side session/auth data flow across the layout boundary, falling under `CLAUDE.md` non-negotiable #5 — it must receive Davin's explicit design sign-off in a separate order rather than being silently bundled.
   - **How hard to undo:** Low (isolated to `app/settings/language/page.tsx`).

2. **Dictionary Coverage: Curated-Partial Strategy (UAE/Arabic Precedent)**
   - **Chosen:** Adopt the curated-partial dictionary approach established by the UAE/Arabic session (`CLAUDE.md`, 2026-08-30). Translate all dotted-namespace chrome keys (`nav.*`, `settings.*`, `billing.*`, `affiliate.*`, `academy.*`, `analytics.*`) and curated user-facing string keys into active target dictionaries (`ar.json`, `th.json`, `en-GB.json`, etc.) as needed by the 5 stacks, rather than forcing 100% parity across all 2,270 keys.
   - **Rejected:** Forcing 100% dictionary key parity across all 13 languages before merging, or leaving strings untranslated.
   - **Why:** `locale-context.tsx`'s `t()` safely degrades to its fallback parameter or the English string key; `getDictionary()` falls back to `en-GB` wholesale. Curated coverage delivers high fidelity for real user journeys without bloating scope or blocking delivery.
   - **How hard to undo:** Low (purely additive JSON entries).

3. **Batch Sequencing & Scope Discipline: 5 Sequenced Checkpoints with Pre-Batch Re-Audit**
   - **Chosen:** Sequence work in 5 per-stack batches: (1) Settings Page §0, (2) BI Dashboards, (3) VAT & Tax Invoicing, (4) Affiliate Commission, (5) Academy & Payments verification. Gated on green `tsc`, Jest tests, and live browser verification at every checkpoint. Treat `08-locale-i18n-compliance.md` §6 inventory as a **verified floor, not a ceiling**; Claude Code must run §5's audit command prior to each batch (`LESSONS-LEARNED.md` L22).
   - **Rejected:** A single massive sweep commit; skipping pre-batch audit; assuming the file list is exhaustive without grep verification.
   - **Why:** Isolates regression blast radius; mirrors the build manifests of the original feature stacks; ensures zero orphaned UI files.
   - **How hard to undo:** Low (clean git commits per batch).

4. **Currency Safety: Mandatory USD Pre-Condition Verification for `formatCurrency()`**
   - **Chosen:** Mandate an explicit data-model verification step before wiring any monetary field into `formatCurrency()`. Only figures confirmed to be USD-denominated (e.g. Stripe `Invoice.amountTotal`, dLocal `Payment.amountUSD`, affiliate `commissionAmount`) may be passed to `formatCurrency()`.
   - **Rejected:** Blindly wrapping all monetary variables or `$${...}` literals in `formatCurrency()`.
   - **Why:** `formatCurrency(amountInUSD)` multiplies the input by `countryConfig.exchangeRate`. Passing an amount already in local currency causes silent, disastrous double-conversion.
   - **How hard to undo:** Low.

5. **Payments Components Disposition (`CountrySelector`, `PaymentMethodSelector`, `PriceDisplay`)**
   - **Chosen:** In `components/payments/`: localize static labels, placeholders, and error messages via `useLocale()` / `t()`; format dates/timestamps via `formatDate()` / `formatRelativeTime()`. Keep `PriceDisplay.tsx`'s specialized dLocal dynamic conversion and API fallback pipeline intact — do **not** route `PriceDisplay` through `formatCurrency()`.
   - **Rejected:** Forcing `formatCurrency()` onto `PriceDisplay` (which would override its API rate lookup) or leaving user-facing strings unlocalized.
   - **Why:** Resolves the "unverified" status in §6 while preserving payment calculation integrity.
   - **How hard to undo:** Low.

---

### Flagged Follow-Up (Not in this session)

> ⚠ **NEEDS EXPLICIT SIGN-OFF (FUTURE SESSION):** §0 Part 2 — Modifying `app/layout.tsx` and `lib/i18n/locale-resolver.ts` to accept an authenticated user session/database preference and define its precedence against URL country-prefix and cookies. To be scheduled as a distinct auth/session slice order.

---

## Entry criteria

- [x] Current working tree is clean on `main` or designated feature branch. _(clean except this order's own untracked artifacts — see CONFIRM note above)_
- [x] Monolith baseline tests pass: `npm run test:ci` or `npm test` (verify baseline before touching files). _(165/165 suites, 2382/2382 tests)_
- [x] `npx tsc --noEmit` is clean across the repository.
- [x] Local dev server (`npm run dev`) or test environment is available for live browser verification.
- [x] Dev environment has `08-locale-i18n-compliance.md` accessible as the reference SSOT.

---

## Ordered Steps & Batch Execution Plan

### Batch 1: §0 Settings Page Remediation (`app/settings/language/page.tsx`)

> **Objective:** Make the Settings → Language & Region page write directly into the live `LocaleContext` so changes take effect immediately in the browser session and subsequent navigations.

1. **Pre-Audit & File Review:**
   - Review `app/settings/language/page.tsx` (lines 39–75 and 147–169).
2. **Implementation:**
   - Import `useLocale` from `@/lib/context/locale-context`.
   - Extract `const { setLocalePreferences } = useLocale();`.
   - In `handleSave()`, immediately following successful `PUT /api/user/preferences`, call `setLocalePreferences(settings)`.
   - Update `languages` array: remove `fr` (French) and `zh` (Chinese) which have no backing dictionary in `lib/i18n/dictionaries/`. Align remaining entries with `SUPPORTED_COUNTRIES` from `lib/country-config.ts`.
   - Wire static labels and section headers in `app/settings/language/page.tsx` to `t()`.
3. **Verification:**
   - `npx tsc --noEmit` clean.
   - Run relevant unit tests: `npx jest __tests__/api/user.test.ts`.
   - **Live Browser Verification:** Navigate to `/settings/language` in a real browser. Change language (e.g. to `ar` or `th`) and timezone. Click **Save**.
     - Verify "Saved!" alert displays.
     - Verify document `dir` flips to `rtl` (for `ar`) or language updates immediately in context.
     - Reload page (`F5`) — verify preferences persist across reload via cookie/localStorage.
4. **Commit:** `fix(i18n): wire settings language page to LocaleContext and prune unsupported locales`

---

### Batch 2: Business Intelligence Dashboards

> **Objective:** Wire all 7 BI components and 8 admin/affiliate dashboard pages to the locale system, replacing hardcoded date/currency/strings.

1. **Pre-Batch Re-Audit:**
   - Run §5 audit command for BI paths:
     ```bash
     git diff --name-only main...HEAD -- 'components/admin/analytics/*.tsx' 'app/admin/dashboards/**/*.tsx' 'app/affiliate/leaderboard/page.tsx' \
       | xargs grep -L "useLocale\|getServerLanguage\|getDictionary"
     ```
   - Check for any additional BI dashboard files created since 2026-09-01.
2. **USD Currency Verification:**
   - Re-verify: `revenue.ts` / `regional.ts` / `affiliates.ts` metrics merge Stripe `Invoice.amountTotal` and dLocal `Payment.amountUSD`. Both are USD-denominated. Confirmed safe for `formatCurrency()`.
3. **Component-Level Remediation (Client Components — Failure Mode A):**
   - Apply `useLocale()` (`t`, `formatDate`, `formatCurrency`) to:
     - `components/admin/analytics/kpi-summary-card.tsx`
     - `components/admin/analytics/ranked-country-table.tsx`
     - `components/admin/analytics/tax-threshold-gauge.tsx`
     - `components/admin/analytics/donut-market-share.tsx`
     - `components/admin/analytics/historical-trend-chart.tsx`
     - `components/admin/analytics/top-affiliates-leaderboard.tsx`
     - `components/admin/analytics/timeframe-filter.tsx`
     - `app/admin/dashboards/dashboard-tabs.tsx`
4. **Page-Level Remediation (Server Components — Failure Mode B):**
   - Apply `getServerLanguage()` and `getDictionary()` (`dict['analytics.*'] ?? 'Fallback'`) to:
     - `app/admin/dashboards/layout.tsx` (nav chrome, tabs)
     - `app/admin/dashboards/page.tsx` (redirect stub)
     - `app/admin/dashboards/revenue/page.tsx` (page header, card titles)
     - `app/admin/dashboards/users/page.tsx` (funnel titles, cohort labels)
     - `app/admin/dashboards/regional/page.tsx` (jurisdiction table headers, gauge labels)
     - `app/admin/dashboards/affiliates/page.tsx` (leaderboard titles, tier cards)
     - `app/admin/dashboards/executive/page.tsx` (command center headers, RAG matrix)
     - `app/affiliate/leaderboard/page.tsx` (public leaderboard title, rankings)
5. **Dictionary Updates:**
   - Add required `analytics.*` curated keys to `lib/i18n/dictionaries/en-GB.json`, `en-US.json`, `ar.json`, and `th.json`.
6. **Verification:**
   - `npx tsc --noEmit` clean.
   - `npm test __tests__/lib/admin/analytics/` and `__tests__/api/admin-analytics-*.test.ts`.
   - **Live Browser Verification:** Load `/admin/dashboards/revenue` and `/affiliate/leaderboard`. Switch locale to `ar` or `th` via header dropdown or `/settings/language`. Confirm currency symbols, numbers, dates, and localized labels update properly.
7. **Commit:** `fix(i18n): wire BI dashboards and analytics components to locale system`

---

### Batch 3: VAT & Tax Invoicing

> **Objective:** Remediate hardcoded `$`, hand-rolled VAT string concatenation, and literal English in the billing invoice history.

1. **Pre-Batch Re-Audit:**
   - Run audit command on billing files:
     - `components/billing/invoice-list.tsx`
     - `app/settings/billing/page.tsx`
2. **USD Currency Verification:**
   - Re-verify: Stripe `Invoice.taxAmount` and `Invoice.amount` are derived from Stripe USD pricing. Confirmed USD. Safe for `formatCurrency()`.
3. **Implementation (Client Components — Failure Mode A):**
   - In `components/billing/invoice-list.tsx`:
     - Import `useLocale` (`t`, `formatDate`, `formatCurrency`).
     - Replace `toLocaleDateString('en-US', ...)` with `formatDate(invoice.date)`.
     - Replace `${invoice.amount.toFixed(2)}` with `formatCurrency(invoice.amount)`.
     - Replace `"Reverse charge — 0% VAT"` with `t('billing.reverse_charge', 'Reverse charge — 0% VAT')`.
     - Replace `formatVatLine()` hand-rolled string with localized template: `t('billing.vat_included', 'incl. {amount} VAT ({rate}% {country})', { ... })` or structured `t()` segments with `formatCurrency(invoice.taxAmount)`.
     - Localize table headers (`Date`, `Description`, `Amount`, `Status`, `Invoice`), empty state, and status badges.
   - In `app/settings/billing/page.tsx`:
     - Wire page headers, subscription summary labels, and tax info via `useLocale()` / `t()`.
4. **Dictionary Updates:**
   - Add `billing.reverse_charge`, `billing.vat_included`, `billing.no_invoices`, etc., to `en-GB.json`, `en-US.json`, `ar.json`, `th.json`.
5. **Verification:**
   - `npx tsc --noEmit` clean.
   - Run billing tests: `npx jest __tests__/components/billing/` (or matching test suite).
   - **Live Browser Verification:** Load `/settings/billing`. Switch country to UK (`GBP`), UAE (`AED`), or Germany (`EUR`). Verify invoice dates match format (`DMY`), currency displays converted symbol (`£`, `AED`, `€`), and VAT lines format cleanly without broken `$` literals.
6. **Commit:** `fix(i18n): localize tax invoicing and billing history components`

---

### Batch 4: Affiliate Commissions & Clawbacks

> **Objective:** Localize affiliate commission tables, status badges, earnings displays, and clawback tooltips.

1. **Pre-Batch Re-Audit:**
   - Run audit command on affiliate files:
     - `components/affiliate/commission-table.tsx`
     - `app/affiliate/dashboard/commissions/page.tsx`
     - `app/admin/affiliates/[id]/page.tsx`
2. **USD Currency Verification:**
   - Re-verify: `Commission.commissionAmount` in `money-service` and monolith is USD-denominated. Safe for `formatCurrency()`.
3. **Implementation (Client Components — Failure Mode A):**
   - In `components/affiliate/commission-table.tsx`:
     - Import `useLocale` (`t`, `formatDate`, `formatCurrency`).
     - Remove `import { format } from 'date-fns'`.
     - Replace `format(new Date(commission.earnedAt), 'MMM d, yyyy')` with `formatDate(commission.earnedAt)`.
     - Replace `$${Math.abs(amount).toFixed(2)}` with `formatCurrency(Math.abs(amount))`.
     - Localize table headers (`Code`, `Amount`, `Status`, `Earned`, `Paid`), status badges (`PENDING`, `APPROVED`, `PAID`, `CANCELLED`), `Clawback` badge, and clawback tooltip string with `t()`.
   - In `app/affiliate/dashboard/commissions/page.tsx` & `app/admin/affiliates/[id]/page.tsx`:
     - Wire stats cards, filter labels, and detail summaries to `useLocale()` / `t()`.
4. **Dictionary Updates:**
   - Add `affiliate.commissions.*`, `affiliate.status.*`, `affiliate.clawback_tooltip` to dictionaries.
5. **Verification:**
   - `npx tsc --noEmit` clean.
   - Run affiliate tests: `npx jest __tests__/components/affiliate/` (or matching test suite).
   - **Live Browser Verification:** Load `/affiliate/dashboard/commissions`. Toggle locale and verify commission amounts, dates, and badges adapt to the selected locale.
6. **Commit:** `fix(i18n): localize affiliate commission table and dashboard pages`

---

### Batch 5: DavinTrade Academy & Payments Verification

> **Objective:** Localize public Academy and admin tutorial CRUD pages, and resolve/localize the 3 flagged payment components.

1. **Pre-Batch Re-Audit:**
   - Run audit command on Academy and Payments files:
     - `app/(marketing)/academy/page.tsx`
     - `app/(marketing)/academy/[id]/page.tsx`
     - `app/admin/tutorials/page.tsx`
     - `components/payments/CountrySelector.tsx`
     - `components/payments/PaymentMethodSelector.tsx`
     - `components/payments/PriceDisplay.tsx`
2. **Academy Remediation:**
   - In `app/(marketing)/academy/page.tsx` (Server Component — Failure Mode B):
     - Implement `generateMetadata()` calling `getServerLanguage()` and `getDictionary()`.
     - Localize `CATEGORY_LABELS` and hero copy using `dict['academy.category.*'] ?? '...'`.
   - In `app/(marketing)/academy/[id]/page.tsx` (Server Component — Failure Mode B):
     - Localize metadata and breadcrumbs/navigation chrome via `getServerLanguage()` and `getDictionary()`.
   - In `app/admin/tutorials/page.tsx` (Client Component — Failure Mode A):
     - Wire modal inputs, category select, table headers, and CRUD action buttons to `useLocale()` / `t()`.
3. **Payments Triaging & Remediation:**
   - In `components/payments/CountrySelector.tsx`:
     - Wire labels (`Select your country`, `Detecting your country...`, `Choose a country`) to `useLocale()` / `t()`.
   - In `components/payments/PaymentMethodSelector.tsx`:
     - Wire labels (`Payment method`, `Loading payment methods...`, `Select your preferred local payment option`, `Instant`, `1-2 hours`) to `useLocale()` / `t()`.
   - In `components/payments/PriceDisplay.tsx`:
     - Localize UI strings (`Calculating price...`, `1 USD =`, `Refresh`, `Updated`, relative time labels) via `useLocale()` / `t()`.
     - **DO NOT** replace the internal dLocal conversion call (`/api/payments/dlocal/convert`) with `formatCurrency()`. Preserve `PriceDisplay`'s explicit conversion logic.
4. **Dictionary Updates:**
   - Add `academy.*` and `payments.*` keys to target dictionaries.
5. **Verification:**
   - `npx tsc --noEmit` clean.
   - Run test suites: `npm test __tests__/lib/tutorials/` and `__tests__/components/payments/` (or matching).
   - **Live Browser Verification:** Load `/academy` and `/academy/[id]`. Switch language to `ar` and verify RTL layout, Arabic metadata, category pills, and video card descriptions render cleanly. Load payment checkout modal and verify localized country/method selectors.
6. **Commit:** `fix(i18n): localize Academy pages and payments components`

---

## Final Slice-Level Verification (Done When)

- [x] All 5 batches completed and committed individually with green checkpoints.
- [x] Repo-wide audit command (§5 of SSOT) re-run and confirms **zero** unhandled occurrences in the 5 stacks:
  ```bash
  git diff --name-only origin/main...HEAD -- 'app/**/*.tsx' 'components/**/*.tsx' \
    | xargs grep -L "useLocale\|getServerLanguage\|getDictionary" \
    | xargs grep -l "toFixed(\|toLocaleDateString(\|toLocaleString(\|date-fns"
  ```
  _(Empty output. Also individually re-verified all 29 files named in SSOT §6 directly —
  28/29 call one of the three markers; `app/admin/dashboards/page.tsx` is the one deliberate
  exception, a redirect stub with zero user-facing text.)_
- [x] `npx tsc --noEmit` clean across monolith, `money-service`, and `operation-service`.
- [x] Full monolith test suite passes: `npm run test:ci` (zero regressions against baseline). _(165/165 suites, 2382/2382 tests — exact match to the CONFIRM-time baseline)_
- [x] Live browser verification performed across all 5 affected surfaces:
  1. `/settings/language` (Save persists and updates live app context) — auth-gated; redirect + zero server errors confirmed, full click-through not performed (see Deviations)
  2. `/admin/dashboards/revenue` & `/affiliate/leaderboard` — `/affiliate/leaderboard` is public and **fully** live-verified (Arabic, RTL, zero console errors); `/admin/dashboards/revenue` is auth-gated, redirect + zero server errors confirmed
  3. `/settings/billing` (Invoice dates, currency, and VAT lines format correctly) — auth-gated; redirect + zero server errors confirmed
  4. `/affiliate/dashboard/commissions` (Commissions and clawback badges localized) — auth-gated; redirect + zero server errors confirmed
  5. `/academy` & payments modals (RTL and translated chrome verified) — `/academy` and `/academy/[id]` are public and **fully** live-verified (Arabic, RTL, translated category pills/CTA/related-tutorials, zero console errors); `/checkout` (mounts the 3 payments components) is auth-gated, redirect + zero server errors confirmed
- [x] `docs/policies/08-locale-i18n-compliance.md` §8 Verification Log updated.
- [x] `CLAUDE.md` state updated with session summary.

---

## Rollback

- Revert individual batch commits via git (`git revert <commit-hash>`).
- Since all changes are frontend rendering/formatting enhancements without database schema alterations or external service API contract changes, rollback is instantaneous and risk-free.

---

## Deviations

1. **Batch 1 — languages array left at 7 entries, not expanded to all 11 `SUPPORTED_COUNTRIES` languages.** The order's own text was ambiguous ("remove fr and zh... align remaining entries with `SUPPORTED_COUNTRIES`"). Chose the literal, minimal reading (drop the 2 dictionary-less entries only) over adding `hi`/`ur`/`vi`/`id`/`th`/`tr` to the picker, since the order never explicitly asked for full parity and Decision 2's curated-partial philosophy argues against over-expanding UI scope unasked. Low risk, easily expanded later.
2. **Batch 1 — reused 4 pre-existing, fully-translated-but-orphaned dictionary keys** (`settings.nav.language`, `form.display_language`, `form.date_format`, `form.time_format`) instead of minting new ones, because their stored English text happened to match this page's literal copy exactly (verified byte-for-byte before reuse, not just by key name) — a free win across all 13 dictionaries for those 4 strings.
3. **Batch 2 — `kpi-summary-card.tsx` and `tax-threshold-gauge.tsx` became async Server Components, not Client Components as the order's Step 3 literally grouped them.** Live code showed neither file has a `'use client'` directive, and neither does any currency formatting of its own (values arrive as pre-formatted prop strings) — an evidence-based correction per `EXECUTOR-PROTOCOL.md` §0 ("when the plan and the live code disagree, live code wins"), not a re-litigation of the order's intent. `ranked-country-table.tsx` and `top-affiliates-leaderboard.tsx` _did_ need to become genuine Client Components (via a new `'use client'` directive), because they format their own confirmed-USD columns and only `useLocale()`'s `formatCurrency()` can do the real currency conversion Decision 4 calls for.
4. **Batch 2 — added two new shared, framework-agnostic primitives** not named in the order: `formatCurrencyAmount()` (`lib/country-config.ts`) and `getServerLocalePreferences()` (`lib/i18n/server-locale.ts`). Needed so Server Component pages (revenue/regional/affiliates/executive) could format confirmed-USD figures with real per-user currency conversion, consistent with Decision 4, instead of falling back to USD-only display. `locale-context.tsx`'s own client `formatCurrency()` now delegates to the shared helper — verified byte-for-byte identical output (same currency-preference-over-country-config precedence the original had), not a behavior change.
5. **Every batch — pre-existing Jest test files exercising a component newly wired to `useLocale()` broke with `useLocale must be used within a LocaleProvider`** (`LESSONS-LEARNED.md` L40, recurred 4 more times this session: `billing.test.tsx`, `commission-table.test.tsx`, `commissions-payouts.test.tsx`, `PriceDisplay.test.tsx`). Fixed each with the established pattern (seed `LOCALE_STORAGE_KEY`, stub `usePathname`, wrap `render()`/`rerender()` in `<LocaleProvider>`). Two of these also needed real assertion updates, not just the wrapper, because `formatCurrency()`/`formatDate()` have real, pre-existing behavioral differences from the hardcoded formatting they replaced: amounts ≥ 1000 round to 0 decimals with a thousands separator, and dates render the seeded `dateFormat` instead of a fixed `'MMM d, yyyy'`/`en-US` shape. Recorded in `LESSONS-LEARNED.md` L40 rather than promoted to a new lesson (at the 40-entry cap).
6. **Not built: a repo-wide `jest.setup.js` default `LocaleProvider` mock**, despite this being L40's own explicitly-stated trigger after 4 sessions and now hit an additional 4 times in this one. Out of this order's scope (test infrastructure, not locale wiring) — flagged in `LESSONS-LEARNED.md` for whichever session next has room, not silently bundled in.
7. **`components/affiliate/commission-table.tsx`'s `CommissionTableProps` interface was exported** (previously module-private) so its own test file could import the type for a typed render helper — a zero-behavior-change visibility widening, not a business-logic change.
8. **Live browser verification was full for the 2 genuinely public surfaces** (`/affiliate/leaderboard`, `/academy` + `/academy/[id]`) but could only reach the auth redirect boundary for the other 8 admin/settings/checkout pages this order touches — the Executor is categorically prohibited from entering credentials, including the dev login page's own test-account autofill buttons, matching this repo's own established handling of the identical boundary in the 2026-08-31 BI-dashboard and Academy ad-hoc sessions. Not silently skipped: each redirect was confirmed to compile cleanly with zero server/console errors, and the dev server was left running. Full authenticated click-through of `/settings/language`, `/admin/dashboards/*`, `/settings/billing`, `/affiliate/dashboard/commissions`, `/admin/affiliates/[id]`, `/admin/tutorials`, and `/checkout` still needs Davin's own pass — see Waiting-on.
9. **A transient Turbopack HMR error** ("Identifier 'formatCurrency' has already been declared") appeared twice mid-session after incremental edits to files that each independently destructure `formatCurrency` from `useLocale()` in their own local scope (no real duplicate declaration exists in any single file — verified by direct grep). Confirmed as stale-HMR noise, not a real defect, by a full dev-server restart: the identical route compiled and redirected cleanly on a cold start. Not logged as a new lesson (single narrow trigger, not yet a generalizable reflex) but noted here for the record.

---

## Next-Session Handoff

Upon successful completion and verification of this ad-hoc remediation order:

- The codebase locale compliance gap is closed across all recent feature stacks.
- Davin will review the surfaced §0 Part 2 proposal (server-side DB preference resolution in `app/layout.tsx`) for scheduling in a future session.
