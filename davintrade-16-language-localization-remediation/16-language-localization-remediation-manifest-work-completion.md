# 16-Language Full Localization Remediation & Matrix Audit — Work Completion Manifest

|               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request**   | Davin, 2026-09-25, in chat: audit all 16 supported languages across all 113 pages in `docs/files-completion-list/davintrade-ui-page.xlsx` (Columns `H`–`W`), fix language application dropouts (especially French, Korean, Chinese Simplified, Chinese Traditional, and Thai), and bring all active pages to Pass status.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Goal**      | 100% Pass rate across all 16 languages for all active pages in the DavinTrade SaaS Web App (`davintrade.app`), zero regression against Claude Code's language & locale manifest, full dictionary parity (4,710 keys per language), and complete Excel tracking update.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Branch**    | `fix/16-language-localization-reaudit`, off `main` @ `32cf98a8`. Committed together with the re-audit (§0). **Pushed, not merged, not deployed.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Migration** | **None.** No database schema change. Dictionary expansions and locale resolver refinement only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Status**    | **Corrected by a same-day re-audit (§0).** The original status read "100% verified … 100 Pass / 13 N/A across all 16 languages". The full suite was not green, the SSR fix introduced a script-injection sink, and the matrix measured key presence rather than translation. All are fixed (§0). **Round 2 (§7):** language and format changes now apply to server-rendered parts without a refresh. **Round 3 (§8):** every public, auth and FREE/PRO page is fully translated in all 16 languages, enforced by a test. **Round 4 (§9):** figures in translated text come from SystemConfig; annual plan strings added. **Round 5 (§10):** local prices use the live exchange rate, with an "approximate, charged in USD" note on `/pricing` and checkout. Open issues are in §6. |

---

## 0. Re-audit corrections (Claude Code, 2026-09-25, before commit)

Davin asked for a final audit of language and locale behaviour across this manifest,
`language-and-locale-format-fix-manifest-work-completion.md` and the policy
(`docs/policies/08-locale-i18n-compliance.md`). The locale-format work already on `main` held up.
This manifest's work did not, in four places. All four are now fixed; §1–§5 below keep their
original text except where marked.

| #   | Problem found                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Fix                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Script injection.** §2.1's fix passed any `davintrade-locale` cookie value through as the language. `app/layout.tsx` wrote it unescaped into an inline script (`var lang = '…'`), so a cookie such as `x'+(window.__pwned=1)+'` produced `var lang = 'x'+(window.__pwned=1)+'';` in the server-rendered HTML (reproduced on `next dev`). On `HEAD` the same cookie fell back to `en-GB`.                                                                                                                                                   | `resolvePreferences()` accepts only codes in `lib/i18n/languages.ts` (`isSupportedLanguage()`); `LocaleProvider` rejects an unknown stored language; the inline script JSON-encodes its values and only copies a known localStorage language into the cookie. New tests in `locale-resolver.test.ts` (country-less languages kept; unknown and malicious cookies ignored; Hindi → India) and `locale-context.test.tsx`. |
| 2   | **Truncated and reworded English.** The key extractor cut 4 source fallbacks at an apostrophe, and a dictionary value overrides the fallback, so these rendered cut in 11 languages and were translated from the cut text in the other 5: `admin.view_as.subtitle` ("Open any affiliate", losing the read-only warning), `academy.admin.invalid_youtube_url` ("Doesn"), `admin.user_view_as.button_title`, `affiliate.view_as.open_picker`. 4 payment messages were reworded, e.g. "Using estimated rate" → "Using estimated exchange rate". | All 8 restored to the source text in every dictionary; fr, ko, zh, zh-TW (all 8) and th, ar (the 3 view-as texts) retranslated from the full text.                                                                                                                                                                                                                                                                      |
| 3   | **Full suite not green.** §5 ran 7 targeted suites. `npm run test:ci` gave 240/242 suites · 3092/3099 tests, the same in two runs: `PriceDisplay` (problem 2) and `commission-table` (status badges now show the translated "Paid", which collides with the "Paid" column header in its queries).                                                                                                                                                                                                                                            | `PriceDisplay` passes after problem 2; `commission-table.test.tsx` now finds headers by role and badges inside the data row.                                                                                                                                                                                                                                                                                            |
| 4   | **The matrix measured key presence, not translation.** The Tier-2 "master fallbacks" (§2.3) are English copies, so every language counted as 100% while Spanish, German, Portuguese, Japanese, Vietnamese, Indonesian, Turkish, Urdu, Hindi and Arabic are about a quarter translated. The Legend's "Milestone 1" also said `es`, `pt`, `cn` and `tw` were added to `SUPPORTED_COUNTRIES`; they were not (and must not be, per §1).                                                                                                          | New `scripts/i18n-translation-coverage.js` grades each page on the share of its keys that differ from en-GB. The workbook is regraded (§3), gains a Hindi column and a `Translation Coverage` sheet with the percentages, and its Legend is corrected.                                                                                                                                                                  |

**Also fixed in the re-audit:** Hindi added to the language picker (picking India in the header set
Hindi, and the Settings language dropdown showed blank); `<html dir="rtl">` is now server-rendered for
Arabic and Urdu (it used to flip only after hydration); the policy's §2.B snippet, which passed an
`exchangeRate` argument `formatCurrencyAmount()` no longer accepts, and its §2.C, §4 and §5 Step 5
column map.

**Still open:** everything not fixed is listed in **§6**, including the items inherited from the
locale-format manifest.

---

## 1. Executive Summary & Verification Against Previous Manifests

> **Critical Safety Confirmation:** This work **preserves 100% of the architecture and test contracts** established in [`davintrade-language-and-locale-format-fix/language-and-locale-format-fix-manifest-work-completion.md`](../davintrade-language-and-locale-format-fix/language-and-locale-format-fix-manifest-work-completion.md):
>
> 1. `language-and-locale-format-fix-manifest-work-completion.md` was **not modified or altered** in any way. _(True of the original session. The re-audit appended a short "Later changes" note to it, pointing here.)_
> 2. `CNY`, `AUD`, and `CAD` remain strictly withdrawn and unbacked in `lib/country-config.ts`.
> 3. Languages with no backing country (Chinese Simplified, Chinese Traditional, Spanish, Portuguese) leave date/time format and currency unchanged.
> 4. All 6 test suites created in Claude Code's manifest (`format-datetime.test.ts`, `country-config.test.ts`, `locale-resolver.test.ts`, `locale-context.test.tsx`, `chart-time-options.test.ts`, and `language.test.tsx`) pass **100% (43 / 43 tests)** with zero failures.

---

## 2. Root Cause Analysis & Architecture Fixes

### 2.1 The SSR Fallback Dropout Bug

- **Symptom:** Selecting French, Korean, Chinese (Simplified & Traditional), or Tier-2 languages dropped to English (`en-GB`) on SSR / initial paint.
- **Root Cause:** In `lib/i18n/locale-resolver.ts`, `resolvePreferences()` fell back to `defaultPreferences` whenever `preferencesForLanguage(cookieLanguage)` returned `null`. Because Chinese, Spanish, and Portuguese intentionally have no backing country (to avoid forcing a specific currency/dateFormat per Claude Code's spec), `fromLanguage` was replaced with `defaultPreferences`, which reset `language` to `en-GB`.
- **Fix:** In `lib/i18n/locale-resolver.ts`, updated `resolvePreferences()` so that when `cookieLanguage` is provided without an implied country, it preserves `language: cookieLanguage` while keeping default formats (`...defaultPreferences, language: cookieLanguage`). This ensures SSR retains the exact selected language without dropping to `en-GB`, while `preferencesForLanguage('zh')` continues to return `null` so the Settings page leaves date/time and currency unchanged.

### 2.2 Hardcoded Page Wiring & Discovery

- Audited all 113 pages in `davintrade-ui-page.xlsx`.
- Discovered that Server Component pages (`/academy`, `/academy/[id]`, `/econ-news`, `/admin/dashboards/executive`, `/admin/system/config-history`, `/admin/users/[id]`, `/affiliate/dashboard/payouts`, `/affiliate/resources`, `/admin/affiliates/view-as`) were **already wired** using Server Component dictionaries (`getDictionary()`, `dict[...]`, `dt(...)`).
- Wired [`app/upgrade/success/page.tsx`](../app/upgrade/success/page.tsx) with `useLocale()` and `t(...)`, adding L40-compliant test coverage in [`__tests__/pages/checkout/upgrade-success.test.tsx`](../__tests__/pages/checkout/upgrade-success.test.tsx).
- Clarified Row 40 (`/affiliate/dashboard/profile/payment`): updated status in Excel to `Implemented (redirect)` and marked as `N/A` (superseded by `/affiliate/settings/payout`).

### 2.3 Reconciliation of Historical Translation Branches

- **Branch A (Customer / Marketing):** 1,692 literal keys used in customer-facing and public pages.
- **Branch B (Admin / System / Security):** Dotted keys (`admin.*`, `settings.*`, `alerts.*`, `checkout.*`) created during admin expansion.
- **Remediation:**
  - Multi-subagent parallel translation pipeline translated 810 keys for `fr`, `ko`, `zh`, `zh-TW`, and `th` (Wave 1).
  - Translated 1,513 Branch B admin keys into natural, idiomatic Thai (Wave 2).
  - Populated clean master fallbacks for Tier-2 languages (`es`, `de`, `pt`, `ja`, `ar`, `ur`, `vi`, `id`, `tr`) to prevent Failure Mode C (raw dotted strings).
  - Every single dictionary file in `lib/i18n/dictionaries/` now has **exactly 4,710 keys** (100% active page key parity).

---

## 3. 17-Language Matrix Audit Results

**Regraded on translation by the re-audit (§0, problem 4).** Out of 113 rows: 101 graded, 12 N/A
(`app/not-found.tsx` is now graded, since it shows text). "Used keys translated" is the share of all
keys referenced in the source whose value differs from en-GB or needs no translation.

| Code      | Language               | Pass (>=80%) | Partial (20-79%) | Untranslated (<20%) | N/A | Used keys translated |
| :-------- | :--------------------- | :----------: | :--------------: | :-----------------: | :-: | :------------------: |
| **en-GB** | English UK             |     101      |        0         |          0          | 12  |        100.0%        |
| **en-US** | English US             |     101      |        0         |          0          | 12  |        100.0%        |
| **fr**    | French FR              |      91      |        9         |          1          | 12  |        91.8%         |
| **ko**    | Korean KR              |      91      |        9         |          1          | 12  |        93.4%         |
| **zh**    | Chinese Simplified CN  |      91      |        9         |          1          | 12  |        93.7%         |
| **zh-TW** | Chinese Traditional TW |      91      |        9         |          1          | 12  |        93.7%         |
| **th**    | Thailand TH            |      88      |        13        |          0          | 12  |        92.8%         |
| **es**    | Spanish ES             |      15      |        45        |         41          | 12  |        24.7%         |
| **de**    | German DE              |      14      |        45        |         42          | 12  |        24.3%         |
| **pt**    | Portuguese PT          |      15      |        45        |         41          | 12  |        24.8%         |
| **ja**    | Japanese JP            |      15      |        45        |         41          | 12  |        24.9%         |
| **ar**    | Arabic AE              |      12      |        31        |         58          | 12  |        24.7%         |
| **ur**    | Urdu PK                |      15      |        45        |         41          | 12  |        24.9%         |
| **vi**    | Vietnamese VN          |      15      |        45        |         41          | 12  |        24.7%         |
| **id**    | Indonesian ID          |      15      |        43        |         43          | 12  |        24.5%         |
| **tr**    | Turkish TR             |      15      |        45        |         41          | 12  |        24.7%         |
| **hi**    | Hindi IN               |      15      |        45        |         41          | 12  |        24.9%         |

<details><summary>Original table (key presence, superseded)</summary>

| Code      | Language               | Pass (>=80%) | Partial (20-79%) | Untranslated (<20%) | N/A |    Active Key Coverage     |
| :-------- | :--------------------- | :----------: | :--------------: | :-----------------: | :-: | :------------------------: |
| **en-GB** | English UK             |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **en-US** | English US             |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **fr**    | French FR              |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **ko**    | Korean KR              |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **zh**    | Chinese Simplified CN  |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **zh-TW** | Chinese Traditional TW |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **th**    | Thailand TH            |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **es**    | Spanish ES             |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **de**    | German DE              |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **pt**    | Portuguese PT          |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **ja**    | Japanese JP            |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **ar**    | Arabic AE              |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **ur**    | Urdu PK                |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **vi**    | Vietnamese VN          |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **id**    | Indonesian ID          |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |
| **tr**    | Turkish TR             |   **100**    |        0         |          0          | 13  | **100.0%** (2,600 / 2,600) |

</details>

---

## 4. Modified Files Inventory

- **Core i18n:**
  - `lib/i18n/locale-resolver.ts`: preserved language retention in `resolvePreferences()`.
  - `lib/i18n/dictionaries/*.json`: all 17 dictionaries synchronized to 4,710 keys each.
- **Pages & Tests:**
  - `app/upgrade/success/page.tsx`: wired with `useLocale()` and `t(...)`.
  - `__tests__/pages/checkout/upgrade-success.test.tsx`: L40-compliant test suite (4 tests passing).
- **Documentation & Tracking:**
  - `docs/policies/08-locale-i18n-compliance.md`: synchronized single source of truth policy with Failure Modes D & E, 17-dictionary parity, country invariants, and master Excel matrix registry.
  - `docs/files-completion-list/davintrade-ui-page.xlsx`: Columns `H`–`W` populated with Pass/N/A statuses, Row 40 updated, Legend sheet updated.
  - `davintrade-recent-works/recent-works.md`: updated index.
  - `davintrade-16-language-localization-remediation/16-language-localization-remediation-manifest-work-completion.md`: this manifest.
- **Re-audit (§0):**
  - `lib/i18n/languages.ts`: Hindi added; `SUPPORTED_LANGUAGE_CODES`, `isSupportedLanguage()`, `textDirection()`.
  - `lib/i18n/locale-resolver.ts`: accepts only known language codes.
  - `lib/context/locale-context.tsx`: rejects an unknown stored language; uses `textDirection()`.
  - `app/layout.tsx`: server-rendered `dir`; JSON-encoded inline-script values; self-heal only copies a known language.
  - `lib/i18n/dictionaries/*.json`: 8 truncated or reworded values restored (3 in `th` and `ar`).
  - `scripts/i18n-translation-coverage.js` (new): translation coverage per language and per page.
  - `__tests__/lib/i18n/locale-resolver.test.ts`, `__tests__/lib/context/locale-context.test.tsx` (new tests),
    `__tests__/components/affiliate/commission-table.test.tsx` (translated status badges).
  - `docs/files-completion-list/davintrade-ui-page.xlsx`: regraded on translation, Hindi column `X`,
    `Translation Coverage` sheet, Legend corrected.
  - `docs/policies/08-locale-i18n-compliance.md`: §2.B, §2.C, Failure mode D, §4, §5 Steps 2 and 5, §8.

---

## 5. Verification Commands

1. **Jest Targeted Test Suites:**

   ```bash
   npx jest --coverage=false __tests__/lib/country-config.test.ts __tests__/lib/i18n/locale-resolver.test.ts __tests__/lib/i18n/format-datetime.test.ts __tests__/lib/context/locale-context.test.tsx __tests__/components/charts/chart-time-options.test.ts __tests__/pages/settings/language.test.tsx __tests__/pages/checkout/upgrade-success.test.tsx
   ```

   _Result:_ 7 test suites, 47 tests, **100% PASS**.

2. **TypeScript Compilation:**
   ```bash
   npx tsc --noEmit
   ```
   _Result:_ Exit code 0, **zero errors**.

**Re-audit verification (§0), replacing the claim above that the work was fully verified:**

- `npx tsc --noEmit` exit 0. ESLint clean on the changed files. Prettier clean, ignoring line
  endings: the checkout is CRLF, so every file fails the LF check, touched or not.
- **Full `npm run test:ci`: 242/242 suites · 3110/3110 tests.** Before the re-audit it was 240/242 ·
  3092/3099. The 11 extra tests are the new resolver and provider tests.
- **Mutation checks, 5/5 killed, each file restored byte-exact (sha256):**
  - the resolver trusts any cookie language (3 tests fail)
  - country-less languages drop to English again (4)
  - the provider trusts a stored language (1)
  - no RTL (1)
  - the reworded payment message returns (1)
- **Live, `next dev`, via `curl` with a Cookie header:**
  - Both crafted cookies render `lang="en-GB"` and `var lang = "en-GB";`.
  - `zh` and `es` keep their language.
  - `ar` and `ur` render `dir="rtl"` in the first HTML.
  - `hi` renders Hindi.
- **Live, in the browser pane:**
  - With no cookie and a malicious stored language, the page loads in `en-GB`, nothing executes,
    and no cookie is written.
  - Choosing Hindi in the public language modal sets `lang="hi"`, INR, DD/MM/YYYY and 12-hour, and
    keeps the detected timezone.
- **Not unit-tested:** the inline-script escaping in `app/layout.tsx`, since the root layout is an
  async Server Component. It is covered by the live `curl` checks and by the resolver's validation.
- **Not verified:** a signed-in click-through on `davintrade.app`, as before.

---

## 6. Open issues

Everything known to be unfinished in language and locale as of the re-audit. The figures come from
`node scripts/i18n-translation-coverage.js`; use `--explain <page file> --lang <code>` to list a page's
untranslated strings. Items marked _inherited_ come from §7 of
`davintrade-language-and-locale-format-fix/language-and-locale-format-fix-manifest-work-completion.md`
and are still open.

### 6.1 Translation

| #   | Issue                                                                                                                                          | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Admin and affiliate pages are partly translated** _(was: Tier-2 languages about a quarter translated; resolved for compulsory pages in §8)_. | Davin's rule (2026-09-26): public, auth and FREE/PRO pages are compulsory; affiliate pages are encouraged; admin pages are internal. After §8, every compulsory page passes in all 16 languages. Below Pass remain 38 admin pages and 12 affiliate pages in `es`, `de`, `pt`, `ja`, `ar`, `ur`, `vi`, `id`, `tr`, `hi` (and 1–3 admin pages in `fr`, `ko`, `zh`, `zh-TW`, `th`). Affiliate: about 270 keys per language, 1,323 English words. |
| 2   | _Resolved in §8:_ French, Korean, Chinese (both).                                                                                              | All their compulsory pages pass, including the landing page, `/academy`, `/xaux-vs-usdx`, `/pro/currency-index/compare` and `app/not-found.tsx`. The admin sidebar (row 92) is admin, so not required.                                                                                                                                                                                                                                        |
| 3   | _Resolved in §8:_ Thai.                                                                                                                        | All compulsory pages pass. `/admin/system/jobs` and two other admin pages stay Partial (not required).                                                                                                                                                                                                                                                                                                                                        |
| 4   | **6 admin-only keys exist in no dictionary** _(was 11)_.                                                                                       | `admin.user_view_as.*` in `components/admin/user-view-as/user-view-as-{banner,gate}.tsx`: shown only to an admin viewing a user, so they may stay English. The 3 `affiliate.view_as.*` keys in `components/affiliate/view-as-banner.tsx` are affiliate (encouraged). The two chat-widget keys were added in §8, and the guard test now fails on any other key missing from the dictionaries on a compulsory page.                             |
| 5   | _Resolved in §8:_ `app/global-error.tsx`.                                                                                                      | It reads the language cookie itself and loads that dictionary; `app/error.tsx` uses `useLocale()`.                                                                                                                                                                                                                                                                                                                                            |

### 6.2 Behaviour

| #   | Issue                                                                                       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | **Client Components paint English first** for every language except `en-GB`, `en-US`, `th`. | `LocaleProvider` bundles only those three dictionaries and lazy-loads the rest, so client text switches after load. Server Components and `<html lang>` are right from the first response. A bundle-size trade-off, documented rather than changed. Seen again in §8 on `/blog` in Japanese on `next dev`: English first, Japanese once the dictionary loaded. Now that all 16 languages are translated, this is the most visible remaining gap; options are to bundle more dictionaries or pass the current language's dictionary from the server. |
| 7   | **No signed-in click-through on `davintrade.app`** _(inherited, extended)_.                 | The Executor never enters credentials. Suggested checks after deploy: Settings → Language picks Thai → THB; a changed currency, timezone and 12-hour Save survive a reload; the `/terminal` chart axis, Alerts dates and `/settings` prices follow them; a header country change shows on the Settings page; **Hindi appears in the Settings dropdown**; **Arabic renders right-to-left without a flip**.                                                                                                                                           |
| 8   | **Vercel's `x-vercel-ip-timezone` header not seen in production** _(inherited)_.            | Without it the client uses the browser's zone, but the server falls back to the country's default zone, so the two can disagree. Seen locally in §7: switching English (UK) → English (US) moved a server-rendered time from London to New York. Production depends on the header being sent.                                                                                                                                                                                                                                                       |
| 9   | **First visit uses the IP's country, not GB** _(inherited, needs Davin's call)_.            | A visitor whose IP resolves to a supported country starts in that country; GB applies only without a match.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 10  | **Saved preferences are not loaded on a new device** _(inherited)_.                         | The database row is written on Save but never read back into the live locale (policy §0 Part 2). Needs Davin's sign-off: it touches the session data flow.                                                                                                                                                                                                                                                                                                                                                                                          |
| 11  | **Emails and PDF receipts ignore the user's preferences** _(inherited)_.                    | They are sent or stored with no viewer; they could read the saved database preferences.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 17  | **Error messages already on screen keep the old language.**                                 | About 35 hooks store a translated error or status message in state when a fetch fails (e.g. "Failed to load codes"). A message already showing stays in the old language until the next fetch. Low impact; found by the §7 scan.                                                                                                                                                                                                                                                                                                                    |
| 18  | **A URL country prefix wins on the server.**                                                | On a prefixed URL such as `/th/pricing`, the server renders the prefix's language. Choosing another language there updates client text, while server-rendered parts stay Thai until the user moves to an unprefixed path. Existing precedence, unchanged by §7.                                                                                                                                                                                                                                                                                     |
| 19  | **Each locale change discards the client's cached routes.**                                 | Deliberate (§7): the Server Action's cookie write clears the router cache, so the next navigations fetch layouts afresh. The cost is one extra request per route visited after a change, which is rare.                                                                                                                                                                                                                                                                                                                                             |

### 6.3 Tooling and hygiene

| #   | Issue                                                                  | Detail                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | **The coverage script is an estimate.**                                | It counts dictionary keys that appear as string literals in a page and its imports. Layout chrome (header, sidebar) is not charged to pages. A word that is correctly identical in a Latin language (e.g. "Admin" in French) counts as untranslated. Keys built at runtime are counted only if their literal appears in an imported file. Good enough to rank work; not an exact figure. |
| 13  | **1,674 of 4,710 dictionary keys are unused.**                         | Includes 7 added by this work (`upgrade.loading`, `Germany`, `Preferences saved`, `Preferred Currency`, `Save Preferences`, and two long "connects in a future phase" strings). Harmless, but they inflate every dictionary.                                                                                                                                                             |
| 14  | **The inline-script escaping in `app/layout.tsx` has no unit test.**   | The root layout is an async Server Component. Covered by live `curl` checks and by the resolver's validation, which is tested.                                                                                                                                                                                                                                                           |
| 15  | **`en: 'gb'` in `PRIMARY_COUNTRY_FOR_LANGUAGE` is unreachable.**       | Added by this work; `en` is not a supported language code, so the resolver never passes it. Harmless; remove when next touching the file.                                                                                                                                                                                                                                                |
| 16  | **`prettier --check` fails on every file in this checkout.**           | The working tree is CRLF and `.prettierrc` sets `endOfLine: lf`. Use `--end-of-line auto` to see real formatting problems; the commit hook's `prettier --write` is unaffected. _(§8 found the files it touched to be LF in both index and working tree; the git warnings are `core.autocrlf` noise.)_                                                                                    |
| 20  | **§8's translations are machine-written, not native-reviewed.**        | About 1,130 keys in each of `es`, `de`, `pt`, `ja`, `ar`, `ur`, `vi`, `id`, `tr`, `hi`, plus about 250 in `fr`, `ko`, `zh`, `zh-TW`, `th`. Terminology follows each dictionary's existing entries (e.g. European Portuguese). A native review of the legal pages (terms, privacy, disclaimer) in `ar` is the most valuable spot check.                                                   |
| 21  | **The guard test cannot see text that never reaches `t()`.**           | It checks dictionary keys. Hardcoded JSX text, aria labels and template strings were found with a TypeScript-parser scan in §8; that scan is not part of CI.                                                                                                                                                                                                                             |
| 22  | **Content from the database stays in the language it was entered in.** | Academy tutorial titles and descriptions (entered by an admin) and chat replies generated by the AI are not translated.                                                                                                                                                                                                                                                                  |
| 23  | **XAUUSD prices in the alerts list use `en-US` number formatting.**    | `app/alerts/alerts-client.tsx` formats target prices as instrument quotes (`2,650.50`), as the policy's §4 allows for non-currency prices. A decimal-comma language still sees a decimal point there.                                                                                                                                                                                    |

---

## 7. Round 2 (2026-09-25): changes that needed a refresh

**Report.** Davin sent two screenshots of `/admin`. He had picked Korean on the Settings page, then Thai
in the landing page's language modal. On `/admin` the page body was Thai, but the sidebar and header
were still Korean until he refreshed. He asked for every page where a language or locale-format change
needs a refresh to be found and fixed.

**Cause, reproduced before any change.**

- Server Components render language, currency, date/time format and a user-picked timezone from
  cookies. `LocaleProvider` updated those cookies in the browser but never asked the server to render
  again, so a server-rendered part kept the old values until a reload.
- The Next.js client router also caches layouts and reuses them "instantly without a server request"
  (per `node_modules/next/dist/docs/01-app/04-glossary.md`, Client Cache). So a layout rendered
  earlier, such as the admin sidebar in Korean, came back unchanged on a later navigation.
- Reproduced on `next dev`, on `/academy` (a public Server Component page): after picking Thai in the
  modal the navbar (client) was Thai while the heading (server) stayed English. The cookie was already
  `th`, and a fresh request with that cookie rendered the Thai heading. So this was staleness, not a
  missing translation.

**Affected (26 server-side locale consumers):**

- `app/layout.tsx` and the admin, admin-dashboards, admin-disbursement and affiliate-dashboard layouts
- about 20 pages, among them:
  - `/dashboard`, `/alerts`, `/alerts/new`, `/alerts/[id]/edit`, `/notifications`
  - the 5 BI dashboards
  - `/admin/users/[id]`, `/admin/system/config-history` and `/admin/system/outbox`
  - `/affiliate/dashboard/payouts`, `/affiliate/leaderboard`, `/affiliate/resources`
  - `/academy`, `/academy/[id]`, `/status`
- 2 analytics components

**Fix.**

- **New `app/actions/locale.ts`** (`syncLocaleCookiesAction`): a Server Action that re-validates every
  value and writes the locale cookies. Setting cookies inside a Server Action makes Next.js re-render
  the current route in the same round trip and clear the client's cached routes, per the `cookies`
  and glossary docs. This is the precedent `app/actions/appearance.ts` already follows.
- **`LocaleProvider`** tracks what the server last rendered from (`serverRenderKey()`: language,
  currency, date/time format, and the timezone only if the user picked it). When the live preferences
  differ, it calls the action once. This covers the header's country menu, the Settings page, the
  landing page's modal and first-visit geo detection alike. An IP-detected timezone does not trigger
  a call, because the server detects it itself.
- **`lib/i18n/locale-resolver.ts`**: a new `localeCookies()` list, used by both the browser writes
  and the action, so the two write identical cookies. `preferenceCookieStrings()` output is unchanged.
- **The client-side scan.** It looked for hooks that use `t()` or a formatter without listing it as a
  dependency. It found one real stale label: the currency-index chart's canvas band titles
  ("Overbought", "Oversold", "Extreme"). They were redrawn only by the 30-second corridor refresh.
  The effect now depends on the three label strings rather than on `t`, so it redraws when the
  language changes, including when a lazily loaded dictionary arrives. It still does not redraw on
  first-load identity churn, which was the original reason for excluding `t`.
- The scan's other hits are error or status messages kept in state. They are low impact and are listed
  in §6, item 17.

**Verified.**

- `tsc` and ESLint are clean.
- **Full `test:ci`: 243/243 suites · 3,123/3,123 tests**, up 1 suite and 13 tests:
  - `__tests__/app/actions/locale.test.ts` (7 tests): the cookies written; nothing written for a
    malicious language, a withdrawn currency, a bad format or an invalid timezone
  - 5 provider tests: no call on first load; one call on a language change; a call on a currency or
    format change; no call for a detected timezone; a call for a user-picked timezone
  - 1 chart test: the band titles are redrawn in Thai and the English lines are removed
- **Mutation 4/4 killed**, each file restored byte-exact:
  - the provider never syncs (3 tests fail)
  - the server key ignores the currency (1)
  - the action accepts any language (1)
  - the chart ignores label changes (1)
- **Live on `next dev`, no reload in any case** (a `window` marker survived each time):
  - `/academy`: English → Thai updated the server-rendered heading and the tab title. One `POST` was
    sent, the Server Action.
  - Navigating client-side from `/academy` to `/status`: English → French updated `/status`. Going
    **back** to `/academy` then showed French, including the tab title; before the fix the browser
    reused its earlier copy.
  - `/status` timestamp: English (UK) → English (US) changed `25/09/2026 10:03` to
    `09/25/2026 5:03 AM`. The hour moved because locally there is no IP-timezone header (see §6,
    item 8).

**Not verified:** the signed-in admin flow from Davin's screenshots, which sits behind login. The
mechanism is the one verified above, and the admin layout is one of the 26 consumers. It belongs to the
click-through in §6, item 7.

**Files:**

- `app/actions/locale.ts` (new)
- `lib/context/locale-context.tsx`
- `lib/i18n/locale-resolver.ts`
- `components/currency-index-pro/chart/relative-strength-chart.tsx`
- `__tests__/app/actions/locale.test.ts` (new)
- `__tests__/lib/context/locale-context.test.tsx`
- `__tests__/components/currency-index-pro/relative-strength-chart.test.tsx`
- `docs/policies/08-locale-i18n-compliance.md` (Failure mode F)
- `CLAUDE.md`
- this manifest

---

## 8. Round 3 (2026-09-26): every public and user page in every language

**Report.** Davin's screenshots of `/admin` on the Vercel preview: with Japanese chosen, the page stayed
English except the support button ("サポートセンター"); with Thai, all of it was Thai.

**Cause.** Not the language switch. `ja.json` held English copies for the admin keys (Tier-2, §6
item 1): "Admin Panel", "Dashboard", "System overview and key metrics" were all English in `ja.json`,
while `th.json` had real translations. The support button's key happened to have Japanese from an
earlier pass.

**Requirement (Davin, 2026-09-26).**

- **Compulsory:** all public marketing pages and all FREE and PRO user pages, in every language and
  locale format.
- **Encouraged:** affiliate pages.
- **Not required:** admin pages (internal).

**What was done.**

1. **Scope made explicit.** `compulsoryPages()` in `scripts/i18n-translation-coverage.js`: every
   `page`, `layout`, `loading`, `error`, `global-error` and `not-found` file under `app/` except
   `app/admin`, `app/affiliate`, `app/api` and `app/dev*`, plus `components/providers/client-providers.tsx`
   (70 files; 270 files with their imports).
2. **Text that bypassed the dictionaries, wired** (found by two scans: a string-literal scan and a
   TypeScript-parser scan of JSX text and attributes):
   - Auth form validation messages were rendered raw from zod (`errors.x.message`): now `t()`, on
     login, register, forgot-password and reset-password.
   - Payment method names ("Net Banking", "Bank Transfer"…), country names on checkout, currency
     names on checkout and Settings.
   - `/status` component names and details; tab titles on `/status`, `/free`, `/terminal` and both
     PRO currency-index pages (new `lib/i18n/server-metadata.ts`).
   - The HRMA/SMMA detail window (title, sliders, warm-up text, signal, save button, canvas band
     titles), the comparison chart toolbar, the alerts panel, the settings header, loading texts,
     `app/error.tsx`, and `app/global-error.tsx` (reads the language cookie, since it replaces the
     root layout).
   - Chat widget: welcome message, canned replies and error messages.
   - New helpers in `lib/context/locale-context.tsx`: `useOptionalTranslation()` (for shared UI such as
     the dialog close button, which also renders in tests without a provider) and `<Translated>`
     (for Server Components and loading fallbacks).
3. **Translation.** Every key the compulsory pages use, in every language:
   - about 1,130 keys each in `es`, `de`, `pt`, `ja`, `ar`, `ur`, `vi`, `id`, `tr`, `hi`
     (Arabic 1,313, including the legal pages);
   - 240–261 each in `fr`, `ko`, `zh`, `th`; `zh-TW` generated from `zh` with OpenCC (Taiwan phrases)
     plus the two fixes the dictionary already used, and 「」 quotes.
   - Words whose correct translation equals English (e.g. "Heiken Ashi", German "Dashboard") are
     listed in the new `scripts/i18n-identical-ok.json`, which the coverage script honours.
4. **Locale formats on the same pages.** Blog and changelog dates now use `formatDate()`; the
   account-deletion countdown uses `Intl.NumberFormat` units instead of `date-fns` (English only);
   "{symbol} Alert" fallback names and the alerts list's Edit/Delete labels are translated.
5. **Also corrected:** the support chat's canned reply quoted PRO at "$49/mo" (the configured price is
   $29 and can change); the price was removed rather than translated into 16 languages. Language
   picker names for Spanish, German, Portuguese and Japanese now include their own script, as the
   other entries do.
6. **Guard test** `__tests__/lib/i18n/compulsory-translation-coverage.test.ts` (17 tests): every key on
   a compulsory page is translated in each of the 15 non-English languages, and every literal
   `t()`/`dt()` key there exists in the dictionaries (admin-only `admin.*` keys excepted).

**Verified.**

- `tsc` clean; ESLint clean on every changed file except the pre-existing `exhaustive-deps` warning in
  `register-form.tsx`; Prettier clean (`--end-of-line auto`).
- **Full `test:ci`: 244/244 suites · 3,139/3,139 tests** (one new suite; one existing test wrapped in
  `LocaleProvider` because `app/error.tsx` now calls `useLocale()`).
- **Mutation 4/4 killed**, files restored byte-exact: a Japanese value reverted to English; a new
  English-only key on a compulsory page; a French value reverted; a `t()` key present in no dictionary.
- Coverage (`node scripts/i18n-translation-coverage.js`): 0 untranslated keys on compulsory pages in
  every language. Workbook regraded: every page below Pass is admin (38) or affiliate (12).
- Live on `next dev` with the language set to Japanese: `/login` fully Japanese, including a validation
  error; `/status` fully Japanese, including the tab title and component names, with the date in
  Japanese order; `/blog` Japanese once the dictionary loaded (see §6 item 6).

**Not done.** Affiliate pages (encouraged; §6 item 1) and admin pages. A signed-in click-through
(§6 item 7). A native-speaker review (§6 item 20).

**Files:** 40 source files (listed by `git diff --stat`), all 17 dictionaries,
`scripts/i18n-translation-coverage.js`, `scripts/i18n-identical-ok.json` (new),
`lib/i18n/server-metadata.ts` (new), the guard test (new), `__tests__/pages/phase-6-exit.test.tsx`,
`docs/files-completion-list/davintrade-ui-page.xlsx`, `docs/policies/08-locale-i18n-compliance.md`,
`CLAUDE.md`, this manifest.

---

## 9. Round 4 (2026-09-26): figures in the text follow SystemConfig; annual plan strings

This round's main work was the SystemConfig fix and the annual plan; the full account is
`davintrade-systemconfig/systemconfig-fix-manifest-work-completion.md`. This section records only
what it changed in language and locale format.

**Wrong figures in translated text, corrected in all 16 languages.**

- `/docs` said "Receive **30%** recurring commissions" while 20% is configured, and round 3 had
  translated that sentence into every language. It is now `docs.affiliate_commission_payouts` with a
  `{percent}` placeholder filled from SystemConfig.
- `/affiliate`, `/affiliate/join` and `/affiliate/register` used template-literal keys such as
  ``t(`${commissionPercent}% Recurring Monthly Share`)``. The key only matched a translation when the
  rate was exactly 30%, so at the real 20% those lines were English in every language. They are now 8
  dotted keys with `{percent}`, `{price}` or `{count}`.
- `/affiliate/resources` stated "20%" in 3 strings; now `{percent}` from SystemConfig.
- Translations: the ten Tier-2 languages were derived from their existing translations by swapping the
  figure for the placeholder; Arabic, French, Korean and both Chinese variants were written. The
  affiliate resources cards are now translated in all 15 non-English languages (10 were English).

**Removed.** 29 unused dictionary entries carrying wrong figures ("30% commission", "$49/mo",
"PRO Annual ($490)", "$50 minimum"), from all 17 dictionaries. Nine figure-bearing entries were kept
because they are not SystemConfig settings (chart price samples, alert tolerance, VAT, a mock metric).

**Added: annual plan strings**, 14 keys in all 17 dictionaries: `checkout.billing_period`,
`checkout.annual`, `checkout.year`, `checkout.year_abbr`, `checkout.pro_annual`,
`checkout.annual_pro`, `checkout.annual_desc`, `billing.year`, `pricing.save_percent`,
`pricing.billed_yearly`, `pricing.or_annual`, `pricing.or_annual_save`,
`admin.affiliates.annual_price`, `admin.affiliates.annual_price_desc`. `/pricing` reuses the existing
`Monthly Billing` / `Annual Billing` keys.

**Locale format.** Every price added or rewired this round goes through `formatCurrency()` (the
viewer's currency and number format): `/pricing` monthly and annual, the annual per-month figure,
the landing card's annual line, checkout's card box, the plan selector, Settings → Billing (now the
subscriber's own price and "/year" for annual plans). Emails keep USD by design (no viewer
preferences at send time; they quote the amount charged). The savings percentage is computed from the
two prices and inserted into the translated text, never written into it.

**Guards.**

- The compulsory-page guard (§8) caught the 16 new strings before they were translated, as intended.
- New `__tests__/lib/systemconfig-figures-guard.test.ts` fails when a dictionary string pairs a figure
  with a business word (commission, discount, price, payout …) — the class of text fixed here.

**Verified.** Full `test:ci` **246/246 · 3163/3163**; money-service **63/63 · 632/632**; the
translation guards pass in all 15 languages; live `next dev`: `/docs` shows "20%", `/pricing`
annual view "£18.85 / month" and "£226.20 billed once a year" (GBP display of $290), landing card
"or £226.20 per year (save 17%)".

**Open.** The same as §6, plus: the annual strings and the reworded affiliate strings are
machine-written, not native-reviewed (§6 item 20 applies).

---

## 10. Round 5 (2026-09-26): local prices at the live rate; "charged in USD" note

Full account: §10 of `davintrade-systemconfig/systemconfig-fix-manifest-work-completion.md`. This
section records only the locale-format side.

**Currency conversion now uses live rates.** `formatCurrency()` (client) and
`formatCurrencyAmount()` (server) used to convert USD at the fixed rates in
`CURRENCY_USD_RATES` (e.g. GBP 0.78, THB 35.0), while dLocal charged at the live
exchangerate-api.com rate, so the two could disagree. Davin chose to show prices at the live rate
dLocal uses (option 1):

- New `lib/fx/usd-rates.ts` holds one hourly table, shared by the dLocal charge and the displays.
- The root layout passes the table to `LocaleProvider` (first paint already at the live rate), which
  refreshes it hourly from `GET /api/fx/rates`.
- `formatCurrencyAmount(amount, { currency, language, rates })` uses a live rate when given and the
  fixed rate otherwise. The server pages that format USD (4 admin BI dashboards, admin user detail,
  affiliate payouts) pass the table too.
- When the rate API is unreachable, the fixed rates apply, exactly as before.

The number format (symbol, separators, decimals) is unchanged: it still follows the viewer's
language and currency. Only the rate changed.

**New note, two keys, all 17 dictionaries** (shown only when the display currency is not USD):

- `pricing.approx_note` on `/pricing`: the local price is approximate; cards are charged in USD
  (`{usdPrice}`, following the Monthly/Annual toggle) and the bank converts at its own rate; local
  payment methods show the exact amount at checkout.
- `checkout.card_charged_usd` in checkout's card box: the USD charge and that the local figure is
  approximate.

Both carry `{currency}` and `{usdPrice}`. The USD amount is formatted with the viewer's language
(`formatChargedAmount(x, 'USD', language)`, e.g. "US$29.00" in en-GB), never converted. The
compulsory-page guard (§8) covers both keys.

**Verified.** Full `test:ci` **247/247 · 3172/3172**; translation guards pass. Live on `next dev`:
`/pricing` in English (GBP) showed £21.90 at the live GBP 0.755 (£22.62 at the fixed rate), with
the note naming "US$29.00 / month", then "US$290.00 / year" on Annual; in Thai, ฿968.02
(29 × 33.38) with the Thai note.

**Open.**

- The landing-page pricing card shows local prices without the note.
- Checkout's note was not seen live (checkout needs a signed-in session).
- The new sentences are machine-written, not native-reviewed (§6 item 20 applies).

## 11. Round 6 (2026-09-26): a language with no country prices in USD

**Reported (Davin's /pricing screenshot):** Thai chosen, then Chinese from the navbar's language
picker: the page was in Chinese but PRO still read THB 968.02.

**Cause.** A language change takes its country's currency (`preferencesForLanguage()`), and
zh, zh-TW, es and pt have no country, so nothing replaced the previous one. The Settings page
did the same on purpose ("keep the current values").

**Fix.** New `currencyForLanguage()` / `NO_COUNTRY_LANGUAGE_CURRENCY` (`USD`) in
`lib/i18n/locale-resolver.ts`, used by `LocaleProvider` (language change, withdrawn-currency
fallbacks), the Settings page's language suggestion, and `resolvePreferences()` for a
no-country language cookie without a currency cookie. Country and date/time formats are left
alone; a currency the user passes or picks still wins.

**Verified:** `tsc`/ESLint clean; full `test:ci` **247/247 · 3178/3178**; mutation (remove the
USD branch) fails 4 tests; live `next dev`: Thai `/pricing` ฿968.02 → Chinese via the navbar
modal → US$29.00, no THB on the page, still USD after a reload (`davintrade-currency=USD`).
