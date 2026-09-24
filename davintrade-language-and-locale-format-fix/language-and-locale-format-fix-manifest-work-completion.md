# Language, Region and Locale Formats — Work Completion Manifest

|               |                                                                                                                                                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request**   | Davin, 2026-09-24, in chat, in three rounds, each with an annotated screenshot of `davintrade.app/settings/language`.                                                                                                                                                                  |
| **Goal**      | Language & Region settings that behave as the screenshots describe, with the chosen timezone, date format, time format and currency applied everywhere the app shows a time, date or price.                                                                                            |
| **Branch**    | `fix/currency-display-rate`, off `main` @ `28945efc`: `1461c3fb` (currency rate), `6f33f1d1` (docs), `a51ba861` (header → language → formats; IP timezone), `fd103f05` (timezone, formats and currency everywhere), plus this manifest's commit. **Pushed, not merged, not deployed.** |
| **Migration** | **None.** No schema change. Three new cookies (`davintrade-currency`, `davintrade-formats`, `davintrade-timezone`) carry the user's choices to server-rendered pages.                                                                                                                  |
| **Status**    | Code complete and verified locally (unit, component, full suite in local time and UTC, mutation checks, and a live browser check on throwaway routes). **Not verified:** a signed-in click-through on `davintrade.app`, and Vercel's IP-timezone header in production.                 |

---

## 1. What Davin asked, round by round

1. **"Could you clarify these?"** Two questions on the Settings page: does choosing Thai make THB the
   default display currency, and does Thai with GBP show GBP throughout the app? **The answer to
   both was no.** A real bug surfaced while checking: see §3.1. Davin then asked for all three
   proposed fixes.
2. **"I want operational as per image attached. Remove CNY, AUD and CAD."** The screenshot defined the
   rules in §2. CNY, AUD and CAD were removed because no supported country backs their rates.
3. **"Please make sure these."** The screenshot said timezone, date and time format, and currency
   must all be user-configurable. An audit found many places that never read those choices: see §3.3.

---

## 2. How Language & Region works now

| Setting                      | Where its value comes from                                                                                                             | Can the user override it?                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Country** (header menu)    | **GB** by default. A first-time visitor whose IP resolves to a supported country gets that country (existing ipapi lookup, unchanged). | Yes, in the header's "Select Country & Region" menu.                                                          |
| **Language**                 | The header country.                                                                                                                    | Yes, on the Settings page.                                                                                    |
| **Date format, time format** | The language (via its country; Thai → DD/MM/YYYY, 24-hour; English (US) → MM/DD/YYYY, 12-hour).                                        | Yes, each one. Changing the language resets them to that language's defaults.                                 |
| **Currency**                 | The language (Thai → THB, English (UK) → GBP).                                                                                         | Yes. Changing the language resets it.                                                                         |
| **Timezone**                 | **Detected from the IP address**: Vercel's `x-vercel-ip-timezone` header, then Cloudflare's `cf-timezone`, then the browser's zone.    | Yes. Picking one pins it; **Use detected timezone** unpins it. A country or language change never touches it. |

- A language with no country behind it (Chinese, Spanish, Portuguese) leaves date/time format and
  currency unchanged.
- A hint under the language menu says what the language controls. Under the timezone, the page shows
  **"Detected from your location: …"** and, after an override, a **Use detected timezone** button.
  These strings are translated into en-US, en-GB, th, fr, ko, zh, zh-TW and ar.
- **The header and the Settings page now always agree.** The page edits the live locale, the same
  state the header writes. Previously it loaded its form from the database, which nothing else reads,
  so picking Thailand in the header did not show up there, and saving the page silently undid the
  header's choice. Save still writes the database (`PUT /api/user/preferences`).

---

## 3. What was wrong, and the fix

### 3.1 Prices converted with the country's rate, not the currency's (`1461c3fb`)

`formatCurrency()` took the **symbol** from the chosen currency but the **exchange rate** from the
user's country. With Thai and GBP, a $29 PRO price showed as **£1,015**, which is 29 × 35 (THB) behind
a pound sign. The correct figure is **£22.62**. The same happened in the 5 server-rendered pages that
format USD (the 4 admin BI dashboards and affiliate payouts).

**Fix:** rates are looked up by currency (`CURRENCY_USD_RATES`, `exchangeRateForCurrency()` in
`lib/country-config.ts`). `formatCurrencyAmount()` no longer takes an exchange rate at all, so the
symbol and the figure cannot disagree. A 2026-09-01 comment had kept the old split on purpose, as
"original behavior". It was the bug.

**Currencies:** THB, INR, NGN, PKR, VND, IDR, ZAR and TRY were added to the dropdown. **CNY, AUD and
CAD were removed** (round 2): no supported country backs their rates, so any rate would have been a
guess. A stored CNY/AUD/CAD falls back to the language's currency, and the formatter shows plain USD
for any code without a rate, rather than a USD figure behind a foreign symbol.

### 3.2 Header, language and timezone (`a51ba861`)

- **Header → language → formats:** `setCountryCode()` and a language change in `LocaleProvider`
  apply the country's language, date/time format and currency, and never the timezone (`keepTimezone()`).
- **IP timezone:** `app/layout.tsx` reads the IP-timezone header and passes it to `LocaleProvider`.
  Until the user picks a timezone (`timezoneSetByUser`), the timezone follows the detected one. Locally
  there is no Vercel header, so it falls back to the browser's zone.
- **Server rendering:** Server Components only saw the language cookie, so Thai with GBP still showed
  THB on the BI dashboards. The chosen currency and a user-picked timezone are now cookies. Both the
  layout and `getServerLocalePreferences()` read them through one helper,
  `resolveRequestPreferences()`, so the two cannot disagree.
- **Existing users:** a stored timezone equal to the stored country's default is treated as
  automatic; any other value is kept as the user's own choice.

### 3.3 Applied everywhere (`fd103f05`)

| Gap                                                                                                                                   | Fix                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Every chart axis and crosshair printed UTC.** lightweight-charts prints timestamps as UTC, and none of the 5 charts set formatters. | New `components/charts/use-chart-time-options.ts`. Only the **labels** change; the data and tick positions stay UTC, so drawings, event markers and alerts are unaffected. Wired into all 5 charts (list in §4).                                                                                         |
| **`formatDate()` used the browser's clock**, not the chosen timezone, so near midnight it could show the wrong day.                   | New `lib/i18n/format-datetime.ts` (`formatDateInZone`, `formatTimeInZone`, `formatDateTimeInZone`) backs `formatDate`, `formatTimestamp` and a new `formatDateTime`, in the client context and in Server Components.                                                                                     |
| **About 20 files formatted dates themselves** (`toLocaleDateString('en-US')`, `date-fns` `PPp`, `lib/utils` `formatDate`).            | All now use the user's settings (list in §4).                                                                                                                                                                                                                                                            |
| **Server pages did not know the date/time format.**                                                                                   | New `davintrade-formats` cookie (`DMY.24h`), next to the currency and timezone cookies.                                                                                                                                                                                                                  |
| **Four prices hardcoded `$`.**                                                                                                        | The Settings overview's PRO price, the dashboard upgrade prompt, the affiliate signup's payout minimum and admin user-detail earnings now use `formatCurrency`. Six dictionaries embedded `$` around `{price}` (`${price}`, `{price} $`); the `$` was removed. The admin P&L label had the same pattern. |
| **The Settings page's own previews** used the browser's date and an `en-US` clock.                                                    | They use the same formatters as the rest of the app, with the values currently in the form.                                                                                                                                                                                                              |

### 3.4 Deliberately left as they are

- **Checkout's "≈ $x USD" line** (`PriceDisplay`): it states the actual USD charge.
- **Admin settings entered in USD** (for example the disbursement payout minimum): configuration
  values, not display prices.
- **Emails, PDF receipts and `lib/auth/session-tracker.ts`:** sent or stored, so there is no viewer
  whose settings could apply. They could read the user's saved database preferences if wanted.
- **Admin BI month buckets** (`lib/admin/analytics/date-windows.ts`) and the affiliate statements'
  month labels: whole months, so the timezone does not matter.

---

## 4. Files

**Core**

- `lib/country-config.ts`: rates by currency, `isSupportedCurrency()`, USD fallback.
- `lib/i18n/format-datetime.ts` (new): timezone-aware date, time and date-time formatting.
- `lib/i18n/locale-resolver.ts`: `timezoneSetByUser`, the currency/formats/timezone cookies,
  `IP_TIMEZONE_HEADERS`, `isValidTimezone()`, `preferenceCookieStrings()`, and a `resolvePreferences()`
  that takes the cookies and the detected timezone.
- `lib/i18n/server-locale.ts`: `resolveRequestPreferences()`, `detectedTimezoneFromHeaders()`.
- `lib/context/locale-context.tsx`: `keepTimezone()`, detected-timezone handling, legacy-storage
  normalisation, cookie writes, `formatDateTime`, `detectedTimezone`.
- `app/layout.tsx`, `app/providers.tsx`, `components/providers/client-providers.tsx`: pass the
  detected timezone down.

**Settings page:** `app/settings/language/page.tsx`.

**Charts:** `components/charts/use-chart-time-options.ts` (new), `components/charts/trading-chart.tsx`,
`components/currency-index-pro/chart/relative-strength-chart.tsx`,
`components/currency-index-pro/chart/hrma-smma-detail-modal.tsx`,
`components/currency-index-comparison/currency-index-comparison-chart.tsx`,
`components/market/xaux-usdx-comparison-chart.tsx`.

**Dates and prices, user-facing:** `app/alerts/alerts-client.tsx`, `app/settings/security/page.tsx`,
`app/settings/security/activity/page.tsx`, `app/settings/account/account-settings-client.tsx`,
`app/settings/page.tsx`, `app/affiliate/dashboard/payouts/page.tsx`, `app/affiliate/register/page.tsx`,
`app/checkout/return/page.tsx`, `app/(marketing)/status/page.tsx`,
`components/dashboard/upgrade-prompt.tsx`.

**Dates and prices, admin:** `app/admin/page.tsx`, `app/admin/errors/page.tsx`,
`app/admin/fraud-alerts/[id]/page.tsx`, `components/admin/FraudAlertCard.tsx`, `app/admin/users/page.tsx`,
`app/admin/users/[id]/page.tsx`, `app/admin/disbursement/page.tsx`,
`app/admin/disbursement/audit/page.tsx`, `app/admin/disbursement/recipients/page.tsx`,
`app/admin/disbursement/transactions/page.tsx`, `app/admin/system/jobs/page.tsx`,
`app/admin/system/terminals/page.tsx`, `app/admin/system/config-history/page.tsx`,
`app/admin/system/outbox/page.tsx`, `app/admin/affiliates/reports/code-flows/page.tsx`,
`app/admin/affiliates/reports/profit-loss/page.tsx`. Also the 4 admin BI dashboards, whose rate
lookup changed in `1461c3fb`: `app/admin/dashboards/{affiliates,executive,regional,revenue}/page.tsx`.

**Dictionaries:** `lib/i18n/dictionaries/{en-US,en-GB,th,fr,ko,zh,zh-TW,ar}.json` (3 new keys) and
`{en-US,en-GB,fr,ko,zh,zh-TW}.json` (`$` removed around `{price}`).

**Tests (new):** `__tests__/lib/country-config.test.ts`, `__tests__/lib/i18n/locale-resolver.test.ts`,
`__tests__/lib/i18n/format-datetime.test.ts`, `__tests__/lib/context/locale-context.test.tsx`,
`__tests__/components/charts/chart-time-options.test.ts`,
`__tests__/pages/settings/language.test.tsx`.
**Tests (updated):** `__tests__/components/charts/trading-chart.test.tsx`,
`__tests__/components/admin/fraud-alert-card.test.tsx` (now asserts the user's timezone and formats
instead of `/Jan/`), `__tests__/pages/affiliate/minimum-payout.test.tsx` (`$75` → `$75.00`, matching
the affiliate dashboard).

---

## 5. Verification

- **Static:** `tsc --noEmit`, ESLint and Prettier are clean on every changed file.
- **Full suite:** `npm run test:ci` gives **242/242 suites · 3099/3099 tests**, up from a baseline of
  236/3055, with no regressions. It was run **in local time (UTC+7) and with `TZ=UTC`**, which CI
  uses, because date output now depends on the timezone.
- **Mutation checks** (each change restored and verified byte-exact by sha256):

  | Mutation                                             | Result                                                                                                                                                                                                                              |
  | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `keepTimezone()` lets the country's timezone through | Killed, but only after adding a user-pinned-timezone test. At first it survived, because the detected-timezone effect covers for it when the timezone is automatic.                                                                 |
  | Detected timezone never applied                      | Killed (2 tests)                                                                                                                                                                                                                    |
  | Language change does not cascade                     | Killed (2 tests)                                                                                                                                                                                                                    |
  | Chart never receives time labels                     | Killed, but only after the test pinned stable preferences. At first it survived, because a preference change after mount re-applied the labels; in production, with nothing changing after load, the axis would have stayed in UTC. |
  | Formatter ignores the timezone                       | Killed (4 tests)                                                                                                                                                                                                                    |
  | Server ignores the formats cookie                    | Killed (1 test)                                                                                                                                                                                                                     |
  | Alerts page back to `en-US` (control)                | Survived as expected: no Alerts date test; the formatter it calls is tested directly.                                                                                                                                               |

- **Live, `next dev`, throwaway unauthenticated routes (all deleted):**
  - A fresh visitor gets GB, English (UK), GBP, DD/MM/YYYY and 24-hour, with the timezone detected
    as Asia/Bangkok.
  - Picking Thailand in the (stand-in) header switches the page to Thai and THB and leaves the
    timezone unchanged. It also writes the `davintrade-locale=th` and `davintrade-currency=THB`
    cookies.
  - Picking English (US) on the page sets MM/DD/YYYY, 12-hour and USD.
  - Server-rendered HTML with the `th` + `GBP` cookies shows **£22.62** and the user's timezone.
  - **A real lightweight-charts chart:** London → Tokyo moved the axis 9 hours, and the crosshair read
    `26/12/2024 08:00`, the next calendar day. Switching to MM/DD/YYYY and 12-hour gave
    `12/26/2024 8:00 AM` and axis labels such as `5:00 AM`.
  - No console errors from this change. The only errors seen were the signed-out 401s, local
    hot-reload sockets and the ticker tape's existing `allowTransparency` warning.

---

## 6. Found along the way

- **The Settings page could undo the header's country choice** (§2). The page read the database while
  the header wrote the live locale.
- **The admin P&L label** embedded `$` around `{price}`, the same pattern as the upgrade prompt.
- **Gotcha, `.git/index.lock`:** the desktop app's background `git status` polling holds the lock, so
  `git add`, `git commit` and lint-staged failed intermittently. Retrying once the lock had stayed
  free for about 2 seconds worked. **Do not use `git stash` here:** a `stash push` failed silently on
  the lock, and the following `pop` tried an unrelated 2026-09-12 lint-staged backup. It aborted, so
  nothing was lost, but it could have applied the wrong stash.
- **Gotcha, locked files:** Windows intermittently refused writes to files open elsewhere (Python
  `OSError 22`, Prettier `UNKNOWN`). A mutation harness must retry its writes and verify the restore.
- **Gotcha, Browser pane:** while the pane is hidden, the page stops rendering (`document.hidden`),
  and the `navigate` tool twice landed on `/` instead of the requested route. Setting
  `location.href` from inside the page worked.

---

## 7. Not verified / open

- **A signed-in click-through on `davintrade.app`.** The Executor never enters credentials. Suggested
  check after deploy:
  1. On `/settings/language`, pick Thai: currency should switch to THB.
  2. Change the currency to GBP, set a timezone and 12-hour time, then **Save** and reload.
  3. Confirm the `/terminal` chart axis, Alerts dates and prices on `/settings` all follow the saved
     settings.
  4. Pick a different country in the header, and confirm the Settings page follows it.
- **Vercel's `x-vercel-ip-timezone` header in production.** It does not exist locally, where the
  browser's zone was used instead.
- **First visit:** a visitor whose IP resolves to a supported country still starts in that country;
  GB is the default only without a match. This is existing behavior, left unchanged; say if GB should
  be the default for everyone.
- **Emails and PDF receipts** could use the user's saved preferences (§3.4). Not done.
- **Database → live locale on a new device:** a signed-in user's saved preferences are written to
  the database but not loaded back into the live locale on a new device. This is existing behavior,
  not changed.

---

## 8. Rollback

Revert the four code commits in reverse order: `fd103f05`, `a51ba861`, then `1461c3fb` (`6f33f1d1` is
docs only). There is no migration and no stored data to undo. The new cookies become unused, and
old stored preferences are read as before, since the new `timezoneSetByUser` field is optional.
