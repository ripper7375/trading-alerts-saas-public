---
paths:
  - 'app/**/*.tsx'
  - 'components/**/*.tsx'
  - 'lib/i18n/**'
  - 'lib/context/locale-context.tsx'
  - 'lib/country-config.ts'
type: Concept/StandingRules
authority: binding
source: 'docs/policies/08-locale-i18n-compliance.md (SSOT) + rules recorded in CLAUDE.md session logs 2026-09-01..09-26'
tags: [frontend, i18n, locale, currency, testing]
---

<!-- `paths:` makes Claude Code load this rule only when UI or i18n files are read. -->

# Locale / i18n compliance for any UI work

**Source of truth:** `docs/policies/08-locale-i18n-compliance.md` — read it before building new
frontend UI. The recurring failure class is "new UI ships with zero locale wiring".

- **Compulsory pages** (public marketing, auth, FREE/PRO user pages): any new text needs a real
  translation in **all 17 dictionaries** (`lib/i18n/dictionaries/*.json`), or
  `__tests__/lib/i18n/compulsory-translation-coverage.test.ts` fails. Affiliate pages are
  encouraged, admin pages are not required. Coverage script: `scripts/i18n-translation-coverage.js`.
- **Client Components:** `useLocale()` → `t()`, `formatCurrency()`, `formatDate()`,
  `formatDateTime()`. **Server Components:** `getServerLanguage()`/`getDictionary()`; for USD
  amounts `getServerLocalePreferences()` + `formatCurrencyAmount()` (`lib/country-config.ts`).
- **Never write a local ad-hoc `formatCurrency`/`formatDate`** (`toLocaleString('en-US')`,
  hardcoded `$`, `date-fns` `PPp`). Dates/times go through `lib/i18n/format-datetime.ts` so the
  user's timezone, date format and time format apply.
- **Key convention:** many components use the literal English string as the key
  (`t('Features')`) — such a key only translates if a dictionary row exists for it. Dotted keys
  take an English fallback (`t('nav.x', 'X')`).
- **Dynamic keys are invisible to extractors:** `t(item.title)` is missed by the literal-key
  regex. Grep `t\(\s*[a-zA-Z_]\w*\.[a-zA-Z_]` and check those by hand.
- **Tests:** a component that newly calls `useLocale()` breaks every test that renders it
  without a `LocaleProvider` (`LESSONS-LEARNED.md` L40). Wrap it and seed `localStorage` so the
  provider's geo-IP `fetch` does not leak past teardown into an unrelated suite. Server
  Components that newly call `cookies()`/`headers()` need a `jest.mock('next/headers', …)`.
- **Prices:** the money actually charged is USD (Stripe/dLocal); displays use the shared hourly
  rate table (`lib/fx/usd-rates.ts`). SystemConfig figures (price, % discount, % commission,
  codes per month) must never be hardcoded — `__tests__/lib/systemconfig-figures-guard.test.ts`
  guards this.
- **Formatting check:** this checkout is CRLF while Prettier expects LF; use
  `prettier --check --end-of-line auto` to see real issues.
