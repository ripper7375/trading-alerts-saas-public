# France / South Korea / Chinese Language Support Manifest — Work Completion Report

**Date:** 2026-09-03 – 2026-09-04
**Status:** Code complete, verified, committed, and pushed to `origin/main`
**Type:** Six sequential ad-hoc feature sessions (Davin-requested directly in chat, each) — outside
the phase/session numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Each session has
its own matching `CLAUDE.md` close-out entry (see §6 for the full commit history).

> **Scope note:** this document covers the full arc of work that started from Davin's request to
> add France (`FR`) and South Korea (`KR`) as supported countries/regions and French (`fr`), Korean
> (`ko`), and Chinese (`zh`, later also `zh-TW`) as display languages — including the large 18-batch
> site-wide locale-wiring audit that request's own live testing surfaced as a prerequisite, and two
> smaller follow-on sessions (the All Round Clock timezone dropdown, and Traditional Chinese) that
> landed in the same continuous run of work. It does **not** cover the UAE/dLocal/Arabic stack (see
> `davintrade-uae-dlocal-and-arabic-support-stack/`), which is an earlier, separate effort.

---

## 1. What was built

Six sessions, landed back to back on `main`:

1. **France & South Korea countries + French/Korean/Chinese languages** — the original request.
2. **The 18-batch site-wide locale-wiring audit** — triggered because Davin reported the new
   country/language selectors "failed to propagate their effect of change throughout web app (all
   pages, all components, and all elements)." Root cause: only 31/100 `page.tsx` files and 28/48
   shared components in the whole app ever called into the locale system at all — a large,
   pre-existing, systemic gap, not a defect in what had just shipped. Davin explicitly chose the
   full site-wide fix over a narrower patch (`AskUserQuestion`, confirmed in chat).
3. **`docs/policies/08-locale-i18n-compliance.md` rewrite** — folding the real, non-locale bugs and
   two confirmed recurring failure classes this audit surfaced back into the policy document Davin
   uses as the go-forward blueprint for wiring future pages.
4. **`components/auth/social-auth-buttons.tsx`** — a same-day follow-up fix Davin asked about
   directly (a public, pre-login component the 18-batch plan's file list hadn't named).
5. **All Round Clock timezone dropdown** — upgraded Settings → Language & Region's timezone picker
   from a hardcoded 13-entry regional list to full IANA-standard coverage with search.
6. **Traditional Chinese (`zh-TW`)** — added as its own selectable language alongside the existing
   Simplified Chinese (`zh`), after Davin asked which variant the app already had.

### 1.1 France & South Korea (countries) + French/Korean/Chinese (languages)

- `lib/country-config.ts`: new `fr`/`kr` entries in `SUPPORTED_COUNTRIES` — France (`FR`, 🇫🇷, `fr`,
  `EUR`/`€`, `Europe/Paris`, `DMY`, `24h`, exchange rate `0.92`); South Korea (`KR`, 🇰🇷, `ko`,
  `KRW`/`₩`, `Asia/Seoul`, `YMD`, `24h`, exchange rate `1350`). This is the single source of truth
  `middleware.ts` already reads via `SUPPORTED_COUNTRY_PREFIXES` — no `middleware.ts` change was
  needed for `/fr` / `/kr` URL-prefix routing to start working.
- `lib/i18n/locale-resolver.ts`: `fr: 'fr'` and `ko: 'kr'` added to `PRIMARY_COUNTRY_FOR_LANGUAGE`
  (pins each language's primary country, avoiding the "first object-key match wins" bug this file's
  own comment documents).
- `lib/preferences/defaults.ts` and its operation-service mirror
  `operation-service/src/users/users.schemas.ts`: `'FR'`/`'KR'` added to `SUPPORTED_COUNTRY_CODES`
  (13 → 15 codes), kept in lockstep per the existing dual-schema convention.
- `lib/preferences/geo-locale.ts`: France gets its own GeoIP locale bundle instead of falling
  through to the Eurozone default's German bundle.
- **New dictionary files** `lib/i18n/dictionaries/{fr,ko,zh}.json`, registered in
  `lib/i18n/get-dictionary.ts` — see §3 for growth detail.
- `app/settings/language/page.tsx`: French/Korean/Chinese added to the Language & Region page's
  standalone `languages` list, plus `Asia/Seoul` and `KRW` to its own `timezones`/`currencies`
  lists (Paris/`EUR` were already covered by the pre-existing Eurozone entries).
- `__tests__/api/user.test.ts`: fixed a stale test literal — `'FR'` was used as _the_ example of an
  unsupported country code; now genuinely supported, swapped to `'XX'` (this repo's existing
  convention for a placeholder unrecognized code).

### 1.2 The 18-batch site-wide locale-wiring audit

Wired locale calls (`useLocale()`/`t()` client-side, `getServerLanguage()`+`getDictionary()`
server-side) into every page and shared component still hardcoded to English, across the entire
app tree, in 18 independently-verified, independently-committed batches:

| #   | Batch                                               | Scope                                                                    |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Chrome                                              | Admin Nav + Affiliate Nav (unblocks header/nav chrome for 35+ pages)     |
| 2   | Dashboard core                                      | `app/dashboard/page.tsx` + stats/recent-alerts/upgrade-prompt components |
| 3   | Alerts core                                         | `app/alerts/**` pages + `alert-form`/`alerts-pro-upgrade` components     |
| 4   | Notifications                                       | `app/notifications/page.tsx` + `notification-list.tsx`                   |
| 5   | Charts cluster                                      | `trading-chart`, drawing toolbar/panels, MTF toggle                      |
| 6   | Checkout                                            | `app/checkout/**`, discount/payment/plan-selector components             |
| 7   | Settings chrome + overview                          | nav, overview page, appearance page                                      |
| 8   | Settings account                                    | `account-settings-client.tsx`                                            |
| 9   | Settings security                                   | `security/page.tsx` (1175 lines — largest file in the repo) + activity   |
| 10  | Settings privacy/profile/help + public delete pages | incl. 2 unauthenticated pages                                            |
| 11  | Admin users + fraud-alerts + errors                 | + `FraudAlertCard`/`FraudPatternBadge`                                   |
| 12  | Admin affiliates + reports + settings/affiliate     | 5 report pages                                                           |
| 13  | Admin disbursement + API usage                      | 7 disbursement pages                                                     |
| 14  | Admin system ops + broadcast + resources            | config-history/jobs/outbox/terminals                                     |
| 15  | Affiliate shared components + dashboard/codes       | `code-table`, `wise-recipient-form`                                      |
| 16  | Affiliate payouts/profile/resources/statements      | incl. 1 public resources page                                            |
| 17  | Auth                                                | login/register pages + forms                                             |
| 18  | Marketing                                           | landing hero/features/pricing, tier comparison, public status page       |

Two established patterns were reused throughout rather than invented per-batch: the Client
Component `useLocale()` pattern, and — for Server Components that show a confirmed-USD money
figure — `getServerLocalePreferences()` + `getCountryByCode()` + `formatCurrencyAmount()` (the
`admin/dashboards/revenue/page.tsx` precedent from an earlier session), since `useLocale()` isn't
reachable server-side.

**Dictionary growth for this batch alone:** `en-US.json`/`en-GB.json` grew from 2,281 → 4,040 keys
(+1,759); `fr.json`/`ko.json`/`zh.json` each grew from ~94 → 1,964 keys (+~1,870 each), every key
hand-translated per batch (not machine-bulk-generated), verified with a coverage-diff script each
time (see §3). `ar.json`/`th.json` were extended only for Batch 1's chrome, per the plan's own
scoping decision — batches 2–18 deliberately added fr/ko/zh only.

### 1.3 `docs/policies/08-locale-i18n-compliance.md` rewrite

Substantially revised (321 insertions / 38 deletions) to fold this session's real findings back
into the document Davin uses as the blueprint for wiring future pages/components:

- Documented a **second, distinct recurring failure class** beyond "zero locale wiring": a
  component already calling `useLocale()`/`t()` from earlier, unrelated authoring, but whose
  dictionary was never populated for its specific keys — silently rendering English regardless of
  locale. Found independently in 4 separate places this session (`admin/affiliates/[id]`, the two
  auth forms + login page, all of Batch 18's landing/pricing components, and
  `social-auth-buttons.tsx`).
- Added the Server Component money pattern, the status/enum `labelKey` pattern, "what NOT to
  translate" guidance, and a "never write local ad-hoc format helpers" warning.
- Rewrote the audit-script section with the real Node.js key-extraction/coverage-diff scripts used
  throughout this session, plus both recurring test-fix patterns (see §4).

### 1.4 `components/auth/social-auth-buttons.tsx`

A same-day, ad-hoc follow-up: Davin asked directly whether this component (rendered on the public,
pre-login `/login` and `/register` pages) was real and needed his own click-through verification.
It was out of the approved 18-batch file list, calling `useLocale()`/`t()` nowhere. Wired its 4
hardcoded strings (`Social login not configured.`, `Use email/password to sign in.`, `Sign in with
Google`, `Login with X`) and added translations to all 5 dictionaries. Needed no authenticated
verification at all — live-verified directly in a real browser.

### 1.5 All Round Clock timezone dropdown

Upgraded the Language & Region page's Timezone picker from a hardcoded 13-entry regional list to
every standard GMT offset from `-12:00` to `+14:00`:

- **New** `lib/utils/timezones.ts`: `getAllTimezones()` prefers `Intl.supportedValuesOf('timeZone')`
  (live-verified to resolve 419 real IANA identifiers) with a ~90-zone curated fallback for
  environments lacking that API; standardized `(GMT ±HH:MM) Region/City` labels, sorted by offset
  then alphabetically. 100% backward-compatible with every previously-stored preference by
  construction (every legacy value is a real IANA identifier already present in the full list).
- `app/settings/language/page.tsx`: the Timezone `<Select>` gained a free-text search box
  (city/country/GMT offset) filtering the full list live, with `stopPropagation()` on the input to
  avoid Radix `Select.Content`'s own keyboard typeahead hijacking it.

### 1.6 Traditional Chinese (`zh-TW`)

Added as a fully separate, selectable language alongside the existing Simplified Chinese (`zh`),
after Davin asked which variant the app already had (confirmed 100% Simplified via a 27-character-
pair marker comparison, not assumed).

- **New** `lib/i18n/dictionaries/zh-TW.json` (1,968 keys) — generated by converting every existing
  `zh.json` value with `opencc-js`'s `Converter({ from: 'cn', to: 'twp' })` profile (Taiwan
  _phrase_-level vocabulary substitution, not just character-set conversion: e.g. 软件→軟體,
  服务器→伺服器, 登录→登入 — not the Mainland-vocabulary-in-Traditional-characters a plain `to:
'tw'` character conversion would have produced). Two targeted polish passes on top of OpenCC's own
  output, found via a full-dictionary scan: `賬`→`帳` (97 occurrences) and `伙伴`→`夥伴` (14
  occurrences, all in "合作伙伴" business-partner contexts where OpenCC's phrase dictionary has an
  identity override that suppresses its own otherwise-correct 2-character rule).
- `lib/i18n/get-dictionary.ts`: `zh-TW` registered for server-side rendering. No change needed in
  `lib/context/locale-context.tsx` — non-static dictionaries already lazy-load generically via
  `import(\`@/lib/i18n/dictionaries/${language}.json\`)`.
- `app/settings/language/page.tsx`: relabeled the existing entry to "Chinese (Simplified) (简体中文)"
  for clarity, added `zh-TW` / "Chinese (Traditional) (繁體中文)" / 🇹🇼.
- **New dependency** `opencc-js@^1.4.2` (`pnpm add -w` — this is a pnpm workspace; plain `npm
install` fails on the `workspace:*` protocol), used only as a one-time generation tool for the
  static dictionary file, not a runtime dependency.
- Confirmed, not assumed: `lib/country-config.ts` has no China/Taiwan country entry at all — `zh`
  itself was already a language-only selector with no backing country, so `zh-TW` deliberately
  follows the same shape (no new country, no `middleware.ts`/`locale-resolver.ts` change).

---

## 2. Files changed

**135 files touched, 24,226 insertions / 6,886 deletions, across 32 commits.** Grouped by
sub-effort (full per-file detail for the smaller sessions; representative + aggregate for the
18-batch audit, whose own file list is reproduced batch-by-batch in §1.2's table and in each
batch's own commit).

### 2.1 France/South Korea + French/Korean/Chinese (4 commits, 14 files)

| File                                              | Change                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| `lib/country-config.ts`                           | New `fr`/`kr` `SUPPORTED_COUNTRIES` entries         |
| `lib/i18n/locale-resolver.ts`                     | `fr -> fr`, `ko -> kr` primary-country mapping      |
| `lib/preferences/defaults.ts`                     | `FR`/`KR` added to `SUPPORTED_COUNTRY_CODES`        |
| `operation-service/src/users/users.schemas.ts`    | Mirrored                                            |
| `lib/preferences/geo-locale.ts`                   | New France GeoIP locale bundle                      |
| `lib/i18n/dictionaries/fr.json`                   | **Added** (new file)                                |
| `lib/i18n/dictionaries/ko.json`                   | **Added** (new file)                                |
| `lib/i18n/dictionaries/zh.json`                   | **Added** (new file)                                |
| `lib/i18n/dictionaries/ar.json`                   | +2 keys (France/South Korea country names)          |
| `lib/i18n/dictionaries/en-GB.json` / `en-US.json` | +2 keys each                                        |
| `lib/i18n/get-dictionary.ts`                      | `fr`/`ko`/`zh` registered                           |
| `app/settings/language/page.tsx`                  | French/Korean/Chinese, Seoul timezone, KRW added    |
| `__tests__/api/user.test.ts`                      | Stale `'FR'`-as-unsupported literal fixed to `'XX'` |

### 2.2 18-batch site-wide locale-wiring audit (18 commits, ~100 files)

Every page/component listed in §1.2's batch table, plus its corresponding batch's dictionary
additions across `en-GB.json`/`en-US.json`/`fr.json`/`ko.json`/`zh.json` (and, Batch 1 only,
`ar.json`/`th.json`), plus each batch's own updated/newly-touched test file(s). Representative
sample of the highest-line-count files touched:

| File                                                | Notes                                               |
| --------------------------------------------------- | --------------------------------------------------- |
| `app/settings/security/page.tsx`                    | 474 lines changed — largest single file in the repo |
| `app/admin/disbursement/batches/[batchId]/page.tsx` | 341 lines changed                                   |
| `app/admin/disbursement/page.tsx`                   | 204 lines changed                                   |
| `app/admin/resources/page.tsx`                      | 262 lines changed                                   |
| `app/admin/disbursement/config/page.tsx`            | 235 lines changed                                   |
| `app/settings/account/account-settings-client.tsx`  | 370 lines changed                                   |
| `app/affiliate/dashboard/resources/page.tsx`        | 142 lines changed                                   |
| `app/affiliate/resources/page.tsx`                  | 144 lines changed                                   |

Full batch-by-batch file lists are preserved in each batch's own commit (`d86a45b8`..`a94b3e7a`,
§6) and in `CLAUDE.md`'s matching close-out entry.

### 2.3 Policy doc + social-auth-buttons (2 commits, 8 files)

| File                                                    | Change                                      |
| ------------------------------------------------------- | ------------------------------------------- |
| `docs/policies/08-locale-i18n-compliance.md`            | Rewritten — §2/§3/§5/§6/§8 (321 insertions) |
| `components/auth/social-auth-buttons.tsx`               | Wired `useLocale()`/`t()` for its 4 strings |
| `lib/i18n/dictionaries/en-GB.json` / `en-US.json`       | +3 keys each                                |
| `lib/i18n/dictionaries/fr.json` / `ko.json` / `zh.json` | +4 keys each                                |

### 2.4 All Round Clock timezone dropdown (2 commits, 3 files)

| File                                    | Change                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `lib/utils/timezones.ts`                | **Added** (new file, 207 lines) — `getAllTimezones()` + label formatting |
| `__tests__/lib/utils/timezones.test.ts` | **Added** (new file, 8 tests)                                            |
| `app/settings/language/page.tsx`        | Timezone `<Select>` rewired to the full IANA list + search               |

### 2.5 Traditional Chinese, zh-TW (1 commit, 5 files)

| File                               | Change                                           |
| ---------------------------------- | ------------------------------------------------ |
| `lib/i18n/dictionaries/zh-TW.json` | **Added** (new file, 1,968 keys)                 |
| `lib/i18n/get-dictionary.ts`       | `zh-TW` registered                               |
| `app/settings/language/page.tsx`   | `zh` relabeled "Simplified"; `zh-TW` entry added |
| `package.json` / `pnpm-lock.yaml`  | `opencc-js@^1.4.2` dependency added              |

### 2.6 Documentation (5 commits, `CLAUDE.md` only)

Session close-out entries after each of the 6 sessions above (one entry can cover two sessions
landed back-to-back with no intervening work) — `a7b4f4f2`, `dbc923c2`, `de5b122b`, `7b9ac575`,
`cb2a28ee`.

---

## 3. Dictionary growth

The single biggest artifact of this effort. All figures are final key counts as of the last commit
(`cb2a28ee`):

| Dictionary   | Before this effort | After this effort |                    Growth |
| ------------ | -----------------: | ----------------: | ------------------------: |
| `en-US.json` |              2,279 |             4,043 |                    +1,764 |
| `en-GB.json` |              2,279 |             4,043 |                    +1,764 |
| `fr.json`    |       _(new file)_ |             1,968 |                    +1,968 |
| `ko.json`    |       _(new file)_ |             1,968 |                    +1,968 |
| `zh.json`    |       _(new file)_ |             1,968 |                    +1,968 |
| `zh-TW.json` |       _(new file)_ |             1,968 |                    +1,968 |
| `ar.json`    |                584 |               618 | +34 (Batch 1 chrome only) |
| `th.json`    |              2,602 |             2,636 | +34 (Batch 1 chrome only) |

Every `fr`/`ko`/`zh` key was hand-translated per batch (not machine-bulk-generated), verified with
a repeatable technique used throughout: a Node.js regex-extraction script compiled the exact set of
`t()`/`dt()` key-fallback pairs actually added to source in that batch, translations were written
for exactly that set, and a second script diffed the translated-key-set against the extracted-key-
set to confirm an empty symmetric difference _before_ the dictionary file was touched — catching
both missed keys and stale/leftover ones. `zh-TW.json` is the one exception: generated
programmatically from `zh.json` via `opencc-js` rather than hand-translated (see §1.6) — the same
"good-faith AI-assisted, not professionally reviewed" quality bar applies to it as to every other
dictionary this repo has shipped.

Coverage is **curated-partial by design, not full parity** — `en-US.json`/`en-GB.json` are the
source of truth; a missing key in any other dictionary falls back to its own `fallback` argument or
the raw key (client-side `t()`) or wholesale to `en-GB` (server-side `getDictionary()`). A partial
dictionary degrades to English; it never breaks.

---

## 4. Test verification

| Checkpoint                                          | Result                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Baseline going into this effort (before `9dbd6f03`) | **165/165 suites, 2382/2382 tests**                                                                          |
| After France/South Korea + French/Korean/Chinese    | 165/165 suites, 2382/2382 tests (no new tests this session)                                                  |
| After All Round Clock timezone dropdown             | **166/166 suites, 2390/2390 tests** (+1 suite / +8 tests, `timezones.test.ts`)                               |
| After every one of the 18 audit batches             | **166/166 suites, 2390/2390 tests** — held constant across all 18 checkpoints, zero drift                    |
| After social-auth-buttons.tsx                       | 166/166 suites, 2390/2390 tests (existing `login-form.test.tsx`/`register-form.test.tsx`, 13/13, unaffected) |
| After Traditional Chinese (zh-TW)                   | 166/166 suites, 2390/2390 tests (no new tests — pure dictionary/wiring addition)                             |
| Re-confirmed by the pre-push hook on the final push | **166/166 suites, 2390/2390 tests**                                                                          |

`npx tsc --noEmit` and `npx eslint <changed files> --max-warnings 5` were run clean after every
single commit above (`npm run lint`/`next lint` remains broken repo-wide, per
`LESSONS-LEARNED.md` L38 — never used).

Two recurring pre-existing-test-breakage patterns, both already documented in
`LESSONS-LEARNED.md`, recurred repeatedly across the 18 batches and were fixed with the same
established techniques each time:

- **L40** (~20 occurrences): any component newly reaching `useLocale()` breaks a pre-existing test
  with `"useLocale must be used within a LocaleProvider"` — fixed by seeding
  `LOCALE_STORAGE_KEY` in `localStorage` and wrapping the render in `LocaleProvider`, plus mocking
  `next/navigation`'s `usePathname()`.
- **`next/headers`-outside-request-scope** (3 occurrences: `system-operations.test.tsx`,
  `commissions-payouts.test.tsx`, `public-pages.test.tsx`): any Server Component newly reaching
  `getServerLanguage()`/`getServerLocalePreferences()` needs `next/headers`'s `cookies()`/
  `headers()` mocked with a promise-wrapped mock store.

A related, sharper lesson learned mid-effort and applied for the rest of the session: a test can
pass **before** a dictionary key is populated (falls back to English) and then **break** once the
real translation lands, especially where translated text collides with unrelated same-text UI
elsewhere on the page (e.g. a translated "Completed" status badge colliding with an untranslated
"Completed" table-column header). Fixed with `{ selector: 'span' }` / `within(table)`
disambiguation, never by loosening the assertion — and every affected test was re-run **after**
dictionaries were populated, not just before, from that point on.

---

## 5. Live browser verification

Every session in this effort used the same real-browser verification approach, and every session
hit the same structural boundary: the Executor never enters credentials (per this repo's standing
safety rule), so the large majority of touched pages — settings, all of admin, the affiliate
dashboard — sit behind an auth gate and could not be visually click-through-verified.

**What was actually verified, live, in a real browser:**

- `/fr`, `/kr`: middleware country-prefix routing resolves correctly with zero build/import errors
  from the new dictionary files (a malformed one would fail the Next.js build immediately).
- `/affiliate/leaderboard`, `/academy`, `/academy/[id]`: fully public surfaces, confirmed rendering
  correctly in the newly-added languages with zero console/hydration errors (carried over from an
  earlier related session, re-confirmed unaffected here).
- `/login`, `/register` (pre-login state): confirmed rendering correctly in French, including
  `social-auth-buttons.tsx`'s "Se connecter avec Google" / "Se connecter avec X" and, later,
  Traditional Chinese's "登入您的 DavinTrade 帳戶" / "使用 Google 登入" — zero console errors both
  times (verified by seeding `davin_locale_preferences` in `localStorage` on an unauthenticated
  page, the same technique used for both the social-auth-buttons and zh-TW sessions).
- Marketing landing page (`/`): confirmed rendering correctly in Traditional Chinese — hero,
  pricing card currency formatting, feature list — zero console errors.
- The timezone search/select interaction (dropdown stays open while typing, offset-string search
  matches, selection updates the trigger label) was live-verified via a temporary, unauthenticated
  throwaway diagnostic route, deleted immediately after use and never committed — the real
  `/settings/language` page itself is auth-gated.
- Every account-delete/public-resources page touched by Batches 10/16 redirects or renders cleanly
  for an unauthenticated visitor with zero server errors.

**What is explicitly NOT yet live-verified** (needs Davin's own pass — full detail, one bullet per
sub-effort, is maintained in `CLAUDE.md`'s "Waiting on" section):

- The header's "Select Country & Region" dropdown actually showing/switching to 🇫🇷 France / 🇰🇷
  South Korea, and `/settings/language` itself for all three new display languages plus the new
  Traditional Chinese and timezone-search UI, as a logged-in user.
- The ~130 files the 18-batch audit touched, spot-checked at minimum on `/dashboard`, `/alerts`,
  `/settings/security`, the 7 `/admin/disbursement/*` pages, and the affiliate dashboard's
  payouts/profile/resources/statements pages.

---

## 6. Git history

32 commits on `main`, landed in this order, then pushed to `origin/main` (the pre-push hook's own
full `test:ci` run gated every push):

| Commit     | Summary                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `9dbd6f03` | `feat(i18n): add France and South Korea as supported countries/regions`                                 |
| `03b7f675` | `feat(i18n): add French, Korean, and Chinese dictionaries`                                              |
| `a5f3b03b` | `feat(settings): expose French, Korean, Chinese, Seoul timezone, and KRW on the Language & Region page` |
| `61f0ac5d` | `test: sync SUPPORTED_COUNTRY_CODES fixture with FR/KR, fix stale-unsupported test literal`             |
| `a7b4f4f2` | `docs: close out 2026-09-03 France/South Korea + French/Korean/Chinese ad-hoc session`                  |
| `4aeb83f7` | `feat(utils): add all-round-clock timezone utility`                                                     |
| `8a0bdcf8` | `feat(settings): wire Language & Region timezone dropdown to full IANA list`                            |
| `dbc923c2` | `docs: close out all-round-clock timezone dropdown ad-hoc session`                                      |
| `d86a45b8` | `feat(i18n): wire Admin Nav + Affiliate Nav chrome into locale system` (Batch 1/18)                     |
| `a13005c2` | `feat(i18n): wire dashboard core into locale system` (Batch 2/18)                                       |
| `4b2c7557` | `feat(i18n): wire alerts core into locale system` (Batch 3/18)                                          |
| `deaaa51f` | `feat(i18n): wire notifications into locale system` (Batch 4/18)                                        |
| `6e81f5c2` | `feat(i18n): wire charts cluster into locale system` (Batch 5/18)                                       |
| `6d3bfdd2` | `feat(i18n): wire checkout into locale system` (Batch 6/18)                                             |
| `567932d8` | `feat(locale): wire Settings chrome + overview into locale system` (Batch 7/18)                         |
| `9bbae4a1` | `feat(locale): wire Settings account page into locale system` (Batch 8/18)                              |
| `5e494152` | `feat(locale): wire Settings security page + activity into locale system` (Batch 9/18)                  |
| `13d4d0da` | `feat(locale): wire Settings privacy/profile/help + public delete pages` (Batch 10/18)                  |
| `56cacfab` | `feat(locale): wire Admin users + fraud-alerts + errors into locale system` (Batch 11/18)               |
| `91992068` | `feat(locale): wire Admin affiliates + reports + settings/affiliate` (Batch 12/18)                      |
| `56a5bf54` | `feat(i18n): wire admin disbursement + API usage pages into locale system` (Batch 13/18)                |
| `2448ada6` | `feat(i18n): wire admin system ops + broadcast + resources pages into locale system` (Batch 14/18)      |
| `ea555b44` | `feat(i18n): wire affiliate shared components + dashboard/codes into locale system` (Batch 15/18)       |
| `3192d9e5` | `feat(i18n): wire affiliate payouts/profile/resources/statements into locale system` (Batch 16/18)      |
| `e1fbd980` | `feat(i18n): wire auth login/register pages into locale system` (Batch 17/18)                           |
| `a94b3e7a` | `feat(i18n): wire marketing landing/pricing/status pages into locale system` (Batch 18/18)              |
| `de5b122b` | `docs: close out 18-batch site-wide locale audit ad-hoc session`                                        |
| `72b3a2ba` | `docs(policy): update locale/i18n compliance doc with 2026-09-03 audit findings`                        |
| `efe07233` | `feat(i18n): wire social-auth-buttons into locale system`                                               |
| `7b9ac575` | `docs: mark social-auth-buttons.tsx as resolved in Waiting-on / residual-gaps notes`                    |
| `af3816c5` | `feat(i18n): add Traditional Chinese (zh-TW) as a separate locale option`                               |
| `cb2a28ee` | `docs: log the zh-TW ad-hoc session in CLAUDE.md`                                                       |

---

## 7. Real, non-locale bugs found and fixed along the way

Not just translation gaps — five genuine bugs were found and fixed incidentally while wiring:

1. **Two more instances of a nonsensical `t(key, 'X').replace('X', 'Y')` key-reuse hack** (Batches
   12/13) — a pattern first caught in an earlier session — fixed with dedicated keys.
2. **`components/affiliate/code-table.tsx`** (Batch 15) switched from a hardcoded `date-fns`
   `'MMM d, yyyy'` format to `useLocale()`'s own `formatDate()` — a real, intentional format change
   (dates now follow the viewer's saved date-format preference), with the pre-existing test's date
   assertions updated to match.
3. **Two local ad-hoc currency-formatting helpers** (`affiliate/dashboard/{profile,statements}/
page.tsx`, Batch 16) doing no real currency conversion at all (`.toFixed(2)` with a hardcoded `$`
   prefix) — replaced with `useLocale()`'s real per-viewer-currency `formatCurrency()`.
4. **`register-form.tsx`** (Batch 17) had 5 genuinely un-wired hardcoded error strings that bypassed
   `t()` entirely, unlike the rest of the file — fixed by wrapping each in `t()`.
5. **`landing-pricing.tsx`** (Batch 18) had a real formatting bug: its FREE/PRO price figures used
   raw `$0`/`${price.toFixed(2)}` string interpolation despite the component already importing
   `formatCurrency` — the card's own advertised "Multi-Currency Local Checkout" line never actually
   applied to the price shown two lines above it. Fixed to call `formatCurrency()`.

Separately, this effort surfaced a **second, distinct "locale debt" failure class** beyond the
original "zero wiring" gap: components already calling `useLocale()`/`t()` from earlier, unrelated
authoring, using this codebase's literal-English-text-as-key convention, but whose dictionary rows
were never added — silently rendering English regardless of locale. Confirmed by direct dictionary
lookup, not guessed, in 4 independent places (`admin/affiliates/[id]/page.tsx`,
`login-form.tsx`/`register-form.tsx`/the login page's already-signed-in screen, all of Batch 18's
landing/pricing components, and `social-auth-buttons.tsx`). Now documented in
`docs/policies/08-locale-i18n-compliance.md` as its own named failure class.

---

## 8. Explicitly out of scope / deferred

- **`ar.json`/`th.json` extended for Batch 1 (chrome) only** — a deliberate scoping decision from
  the 18-batch plan; batches 2–18 added fr/ko/zh only, consistent with this effort's stated starting
  scope. `ar.json` is still missing a translated country name for every `SUPPORTED_COUNTRIES` entry
  except France/South Korea — a pre-existing gap from an earlier session, not introduced here.
- **`components/auth/social-auth-buttons.tsx`** — resolved same-day as a follow-up (§1.4); listed
  here only for completeness since it was originally deferred out of the 18-batch plan's own file
  list.
- **No Taiwan (`TW`) country added to `lib/country-config.ts`** for the `zh-TW` work — Davin's
  instruction was specifically a language option; a country would additionally require a
  currency/timezone/exchange-rate decision and touch the header's country dropdown, neither of
  which was asked for. Mirrors the existing `zh` precedent exactly.
- **Full authenticated click-through verification** — not performed for any page behind the auth
  gate in any of the six sessions, per this repo's standing rule that the Executor never enters
  credentials. See §5 and `CLAUDE.md`'s "Waiting on" section for the itemized list of what still
  needs Davin's own pass.
- **Translation quality caveat**, same standard as every dictionary this repo has shipped: all
  fr/ko/zh/zh-TW translations are good-faith AI-assisted work (hand-translated for fr/ko/zh,
  OpenCC-converted plus spot-checked polish passes for zh-TW), not professionally reviewed.
