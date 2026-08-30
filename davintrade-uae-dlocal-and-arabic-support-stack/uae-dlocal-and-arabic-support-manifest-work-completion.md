# UAE dLocal & Arabic Support Manifest — Work Completion Report

**Date:** 2026-08-30
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Ad-hoc feature session (Davin-requested directly in chat) — outside the phase/session
numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded in `CLAUDE.md`'s matching
ad-hoc note and in `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md`'s "ad-hoc work completed
outside the phase numbering" section.

> **Scope note:** this document covers the UAE (`AE`) dLocal payment + Arabic (`ar`) locale feature
> only. It does not touch or depend on the concurrent Session 14-2 (chat-stack) work that landed in
> this repo's history around the same time — see §6 below for how that was verified.

---

## 1. What was built

United Arab Emirates (`AE`) added end-to-end: dLocal payment processing (Local Cards, Apple Pay,
Bank Transfer; currency `AED`, pegged rate `3.67`), Arabic (`ar`) as the country's official
language with a new translation dictionary, and `Asia/Dubai`/DMY/12h as the regional defaults —
kept in lockstep across the monolith and its `money-service` mirror throughout.

### 1.1 dLocal payment types, constants & services (monolith + money-service)

- `'AE'` added to the `DLocalCountry` union and `'AED'` to `DLocalCurrency` in `types/dlocal.ts`
  and its byte-for-byte money-service mirror `money-service/src/dlocal/dlocal.types.ts`.
- `DLOCAL_SUPPORTED_COUNTRIES`, `COUNTRY_CURRENCY_MAP`, `COUNTRY_NAMES`, and `PAYMENT_METHODS`
  extended with `AE` in `lib/dlocal/constants.ts` and `money-service/src/dlocal/dlocal.constants.ts`
  — dLocal now supports **9** countries (`IN/NG/PK/VN/ID/TH/ZA/TR/AE`), up from 8.
- `DLOCAL_METHOD_CODE_MAP` gets `AE: { 'Local Cards': 'CARD', 'Apple Pay': 'APPLEPAY', 'Bank
Transfer': 'BANK_TRANSFER' }` (dLocal's real Payins API method codes, not this app's own display
  names — see the existing Session 4A-16/F76 pattern these files already document),
  `getDefaultPaymentMethod` returns `'Local Cards'` for `AE`, and `getPaymentMethodType` classifies
  `'Apple Pay'` as `'wallet'` — all in `lib/dlocal/payment-methods.service.ts` and its
  money-service mirror.
- `FALLBACK_RATES` and `SUPPORTED_CURRENCIES` gain `AED: 3.67` in
  `lib/dlocal/currency-converter.service.ts` and its money-service mirror.
- `createPaymentSchema`'s Zod `country`/`currency` enums extended with `'AE'`/`'AED'` in
  `app/api/payments/dlocal/create/route.ts` and `money-service/src/dlocal/dlocal-payment.controller.ts`.

### 1.2 Frontend payment components

- `components/payments/CountrySelector.tsx`: `AE: '🇦🇪'` added to `COUNTRY_FLAGS`.
- `components/payments/PaymentMethodSelector.tsx`: `AE` entry added to
  `PAYMENT_METHODS_BY_COUNTRY` (Credit/Debit Card, Apple Pay, Bank Transfer — matching processing
  times and icons per the existing per-country pattern).
- **Found and fixed one real, undocumented dependency the request didn't name:**
  `components/payments/PriceDisplay.tsx` keeps its own `Record<DLocalCurrency, ...>` maps
  (`CURRENCY_SYMBOLS`, `CURRENCY_NAMES`, `FALLBACK_RATES`) — `tsc --noEmit` caught the missing
  `AED` member immediately (the same "an order's file list omits a real direct dependency" class
  already documented elsewhere in this codebase's dLocal history). Fixed before declaring the
  session done, not deferred.

### 1.3 Country configuration, geo-locale & user preferences

- `lib/country-config.ts`: new `ae` entry in `SUPPORTED_COUNTRIES` (code `AE`, language `ar`,
  currency `AED`/symbol `AED`, timezone `Asia/Dubai`, `DMY`, `12h`, exchange rate `3.67`). This is
  the single source of truth `middleware.ts` already reads via `SUPPORTED_COUNTRY_PREFIXES` —
  **no `middleware.ts` change was needed** for `/ae` URL-prefix routing to start working.
- `'AE'` added to `SUPPORTED_COUNTRY_CODES` (now 13 codes) in both `lib/preferences/defaults.ts`
  and its operation-service mirror `operation-service/src/users/users.schemas.ts`.
- `lib/preferences/geo-locale.ts`: new `AE` bundle in `GEO_COUNTRY_TO_LOCALE` (for server-side
  GeoIP locale resolution from `cf-ipcountry`/`x-vercel-ip-country` headers).
- `lib/i18n/locale-resolver.ts`: `ar: 'ae'` added to `PRIMARY_COUNTRY_FOR_LANGUAGE` (pins Arabic's
  primary country the same way `en-US -> us` avoids the "first object-key match wins" bug this
  file's own comment already documents).

### 1.4 Arabic translation & RTL

- **New file** `lib/i18n/dictionaries/ar.json` — see §7 (scope note) for exactly what's covered
  and why full 2270-key parity with `en-US.json` was a deliberate non-goal.
- `lib/i18n/get-dictionary.ts`: `ar` imported and registered (the server-safe dictionary map used
  by `generateMetadata()` and other Server Components).
- `lib/context/locale-context.tsx`: the existing `<html lang>` effect extended to also set
  `document.documentElement.dir = 'rtl'` for `ar`/`ur`, `'ltr'` otherwise (was lang-only before).
- `app/settings/language/page.tsx`: Arabic (`ar`, 🇦🇪), `Asia/Dubai` ("Dubai / UAE (GST)"), and
  `AED` ("UAE Dirham") added to this page's own standalone `languages`/`timezones`/`currencies`
  lists.

---

## 2. Files changed

| File                                                          | Change                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `types/dlocal.ts`                                             | `AE`/`AED` added to `DLocalCountry`/`DLocalCurrency` unions       |
| `money-service/src/dlocal/dlocal.types.ts`                    | Mirrored                                                          |
| `lib/dlocal/constants.ts`                                     | `AE` in supported countries, currency map, names, payment methods |
| `money-service/src/dlocal/dlocal.constants.ts`                | Mirrored                                                          |
| `lib/dlocal/payment-methods.service.ts`                       | `AE` method-code map, default method, Apple Pay -> `wallet`       |
| `money-service/src/dlocal/payment-methods.service.ts`         | Mirrored                                                          |
| `lib/dlocal/currency-converter.service.ts`                    | `AED` fallback rate + supported-currency entry                    |
| `money-service/src/dlocal/currency-converter.service.ts`      | Mirrored                                                          |
| `app/api/payments/dlocal/create/route.ts`                     | Zod schema accepts `AE`/`AED`                                     |
| `money-service/src/dlocal/dlocal-payment.controller.ts`       | Mirrored                                                          |
| `components/payments/CountrySelector.tsx`                     | `AE` flag                                                         |
| `components/payments/PaymentMethodSelector.tsx`               | `AE` payment-method config                                        |
| `components/payments/PriceDisplay.tsx`                        | **Found dependency, fixed** — `AED` symbol/name/fallback rate     |
| `lib/country-config.ts`                                       | New `ae` country config entry                                     |
| `lib/preferences/defaults.ts`                                 | `AE` added to `SUPPORTED_COUNTRY_CODES`                           |
| `operation-service/src/users/users.schemas.ts`                | Mirrored                                                          |
| `lib/preferences/geo-locale.ts`                               | New `AE` GeoIP locale bundle                                      |
| `lib/i18n/locale-resolver.ts`                                 | `ar -> ae` primary-country mapping                                |
| `lib/i18n/dictionaries/ar.json`                               | **Added.** Arabic dictionary (see §7 for coverage)                |
| `lib/i18n/get-dictionary.ts`                                  | `ar` registered in the server-safe dictionary map                 |
| `lib/context/locale-context.tsx`                              | `dir="rtl"` for `ar`/`ur`                                         |
| `app/settings/language/page.tsx`                              | Arabic, Dubai (GST), AED added to standalone lists                |
| `__tests__/types/dlocal.test.ts`                              | 8->9 country/currency counts, `AE`/`AED` assertions               |
| `__tests__/lib/dlocal/constants.test.ts`                      | 8->9 length checks, `AE` config assertions                        |
| `__tests__/lib/dlocal/payment-methods.test.ts`                | `AE` method resolution, default method, Apple Pay type            |
| `__tests__/lib/dlocal/currency-converter.test.ts`             | `AED` exchange-rate/fallback coverage                             |
| `__tests__/api/user.test.ts`                                  | `'AE'` added to mocked `SUPPORTED_COUNTRY_CODES`                  |
| `__tests__/e2e/dlocal-payment-flow.test.ts`                   | `AE` case added to the parametrized country matrix                |
| `money-service/src/dlocal/payment-methods.service.spec.ts`    | Mirrored test additions                                           |
| `money-service/src/dlocal/currency-converter.service.spec.ts` | Mirrored test additions                                           |
| `CLAUDE.md`                                                   | Ad-hoc session note (§1 of this doc's own source)                 |
| `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md`         | Matching ad-hoc-work entry                                        |

**32 files touched (31 modified, 1 added)**, 524 insertions / 25 deletions across 4 commits.

---

## 3. Test verification

| Suite                                                                                                                         | Result                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Monolith Jest (scoped: `__tests__/lib/dlocal`, `types/dlocal.test.ts`, `api/user.test.ts`, `e2e/dlocal-payment-flow.test.ts`) | **195/195 passed**                                                                                        |
| Monolith Jest (full `test:quick`, via the pre-push hook)                                                                      | **154/154 suites · 2265/2265 tests passed**                                                               |
| money-service Jest (`src/dlocal`)                                                                                             | **112/112 passed**                                                                                        |
| TypeScript — monolith                                                                                                         | `tsc --noEmit`, 0 errors (after fixing the `PriceDisplay.tsx` gap in §1.2)                                |
| TypeScript — money-service                                                                                                    | `tsc --noEmit`, 0 errors                                                                                  |
| TypeScript — operation-service                                                                                                | `tsc --noEmit`, 0 errors                                                                                  |
| ESLint                                                                                                                        | Clean on every changed file (monolith + money-service + operation-service)                                |
| Prettier                                                                                                                      | Clean on every changed file (9 files needed `--write` for pre-existing formatting drift, none behavioral) |
| Policy validator (`scripts/validate-file.js`)                                                                                 | 0 issues on the touched API route                                                                         |

---

## 4. Live browser verification

Started the real dev server (`next dev`, Turbopack) and drove it directly rather than relying on
unit tests alone for the locale/RTL wiring:

- **`http://localhost:3000/ae`** resolves `document.documentElement.lang` to **`ar`** and `.dir` to
  **`rtl`**, with **zero console errors**. This confirms the `SUPPORTED_COUNTRIES`-driven
  middleware prefix routing picked up the new `ae` key automatically — no `middleware.ts` edit was
  needed, as expected from how that file is wired (see §1.3).
- `http://localhost:3000/checkout` correctly redirected to `/login?callbackUrl=/checkout` for an
  unauthenticated session (expected — checkout is auth-gated). The one console warning observed
  there (`setState` during render, `CheckoutContent`) is pre-existing behavior in the redirect
  path, unrelated to this session's purely-additive `Record<DLocalCurrency, ...>` changes — not
  introduced by this work.

---

## 5. Git history

Landed as 4 scoped commits on `main`, then pushed to `origin/main` (pre-push hook ran the full
154-suite/2265-test monolith suite before allowing the push):

| Commit     | Summary                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `3bb633a1` | `feat(payments): add UAE (AE) dLocal payment support` — §1.1, §1.2                                                  |
| `2f676856` | `feat(i18n): add Arabic locale, UAE regional format, and RTL support` — §1.3, §1.4                                  |
| `9068874e` | `test(payments): extend dLocal + preferences test suites for UAE (AE)` — §3                                         |
| `0369b166` | `docs(ad-hoc): record UAE (AE) dLocal + Arabic locale session` — this manifest's `CLAUDE.md`/roadmap source entries |

---

## 6. A note on concurrent work

While this session was in progress, another Claude Code session on the same machine independently
landed `458e5c91` — `migrate(chat-stack): CSP + global widget mounting (14-2 File 4/4)` — completing
the unrelated Session 14-2 (Support Centre chat widget) work. That commit only touched
`next.config.js`, `components/providers/client-providers.tsx`, and two chat-widget components —
none of which this feature depends on or modifies. Confirmed via `git show --stat` before pushing;
no conflict, no data loss, nothing from this feature's own file list overlaps with it.

---

## 7. Scope note: `lib/i18n/dictionaries/ar.json` coverage

`en-US.json` (and every other existing per-language dictionary) is exactly 2270 lines. Roughly
2190 of those lines are literal English marketing/mock-dashboard copy used as **self-referencing
keys** (e.g. `"Support $2,634.50 Confirmed": "Support $2,634.50 Confirmed"`) rather than
programmatically-namespaced i18n keys — largely seed/demo dashboard strings, several with baked-in
mock numeric data that wouldn't match real values even if translated.

`ar.json` translates:

- **Every real dotted-namespace key** (~65 total: `nav.*`, `breadcrumb.*`, `settings.*`,
  `header.*`, `chat.*`, `comments.*`, `chart.*`, `form.*`, `time.*`, `disbursement.*`) — this is
  the actual `t()`-driven chrome (navigation, the Language & Region settings page itself,
  dashboard/chat UI labels).
- **~140 curated literal keys** spanning navigation, dashboard summary labels, the alert-rule
  wizard, the pricing page, the checkout/payment flow, auth (sign in/up, 2FA, password reset),
  and admin/affiliate screen headers — chosen to cover exactly the areas the original request
  named: "navigation, dashboard, pricing, payments, and settings."

This is **not** full 2270-key parity with `en-US.json`, and that's a deliberate scope call, not an
oversight — and it's safe by construction, not just "probably fine":

- `locale-context.tsx`'s `t(keyOrText, fallback)` already falls back to its own `fallback` param,
  or the raw key text, for any key not present in the active dictionary.
- `get-dictionary.ts` (the server-safe mirror used by `generateMetadata()`) falls back to `en-GB`
  wholesale if a language key is entirely missing.

A user on the Arabic locale sees Arabic for every real UI-chrome string and every curated
high-traffic screen; anything outside that curated set degrades to English rather than breaking or
showing a raw key. Expanding coverage further is a follow-up content task, not a code change.

---

## 8. Explicitly out of scope

- **`frontend/` (SEPARATE_STACK)** — has its own byte-identical dLocal constants, payment
  components, and tests (`frontend/lib/dlocal/constants.ts`,
  `frontend/components/payments/CountrySelector.tsx`,
  `frontend/__tests__/lib/dlocal/constants.test.ts`, etc.). Per `EXECUTOR-PROTOCOL.md` §5 this
  tree is out of scope for this migration entirely and was deliberately left untouched.
- **`docs/policies/07-dlocal-integration-rules.md`** (and its `-compress.md` variant) — reference
  the pre-UAE 8-country list but weren't named in the original request; left as a follow-up doc
  update rather than scope creep into policy documentation.
- **Full `en-US.json`-parity Arabic translation** — see §7.
- **Automated RTL layout/CSS audit** — `dir="rtl"` is now correctly set on `<html>` for `ar`/`ur`,
  but no pass was made to check every component's own Tailwind classes (e.g. `ml-*`/`mr-*`,
  `text-left`/`text-right`) for RTL-correctness. Standard browser RTL text-flow behavior applies
  automatically; a full mirrored-layout audit is a separate, larger UI task.
