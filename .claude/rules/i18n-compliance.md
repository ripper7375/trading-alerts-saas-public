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

- **Compulsory pages** (public marketing, auth, FREE/PRO user pages): any new text needs a key in
  **all 19 dictionaries** (`lib/i18n/dictionaries/*.json`; the list is `lib/i18n/languages.ts`:
  `en-US`, `en-GB`, `es`, `de`, `pt`, `pt-BR`, `it`, `ja`, `ar`, `fr`, `ko`, `zh`, `zh-TW`, `ur`,
  `hi`, `vi`, `id`, `th`, `tr`), with a **real translation in the 17 that are not English**, or
  `__tests__/lib/i18n/compulsory-translation-coverage.test.ts` fails (that test counts the 17
  non-English files; `en-GB` and `en-US` carry the English). They are 17 languages in 19 locales:
  English and Portuguese appear twice, and `zh` and `zh-TW` are two scripts. Affiliate pages are
  encouraged, admin pages are not required. Coverage script: `scripts/i18n-translation-coverage.js`.
  The intake path's fixed texts (`intake.*`, 28 keys) are held to one English registry,
  `lib/intake/text.ts`, by `__tests__/lib/intake/text.test.ts`; the replies to refusals also wait
  for counsel and a native read (ADR-098 D14). The AI chat panel's words (`chat.*`, 173 keys: Panel B and, since
  build step 7 part 9, Panel A's thread list as `chat.threads.*`, 28 keys; `components/chat/`) are held to one
  English registry, `components/chat/text.ts`, by
  `__tests__/components/chat/translation-coverage.test.ts` (every dictionary has every key, a real
  translation in the 17, the same `{placeholders}`, no hard-coded English in `components/chat/*.tsx`);
  they are drafts no native reader has seen. A model's words, prices, level names, sensor ids and state
  codes are never keys: they arrive in the reply and stay as they are.
  **The reply path's 19 locales are counted from `SUPPORTED_LANGUAGES`, not copied** (`lib/reply/eval/languages.ts`, the wording
  lists, the invalidation lines, the labelled set): a locale added to `lib/i18n/languages.ts` fails the pinned counts of the evaluation
  suite (`__tests__/lib/reply/eval-gate.test.ts`, the 19 demo recordings) until a decision says so, and "within 5 points of English" is
  measured per locale against `en-US` (ADR-099). The Free tier's recorded example (`config/reply/demo/<locale>.json`) is model output
  replayed from a recorded run, not dictionary text: it needs no key, and it is shown to a trader only when approved AND from a live run
  (`components/chat/demo-source.ts`).
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
