# Locale / i18n Compliance — Single Source of Truth

> **Purpose:** Every time a new frontend UI (page, component, or admin
> surface) has been built as an ad-hoc session — outside
> `docs/migration-orders/`'s numbered playbook, per `EXECUTOR-PROTOCOL.md`
> §6 — it has shipped with hardcoded English text, hand-rolled date/currency
> formatting, and zero connection to the locale system. This is not a
> one-off bug; it is a **recurring failure class**. This document is the
> reusable fix: what the locale system actually is, exactly how new code
> fails to use it (three distinct failure modes, all three now confirmed
> live against real code, not just two — see §3), the concrete
> remediation recipe for each, and a known-affected file
> inventory to start from. Read this before building or auditing any
> user-facing surface, and re-run its audit procedure (§5) before closing
> any session that adds one.

**Status:** Live document — verified against the codebase as of 2026-09-26.

> **Translation scope (Davin, 2026-09-26) — the rule every new page follows:**
>
> | Pages                                                                                                           | Rule                                                                                                               |
> | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
> | Public marketing, auth, and FREE/PRO user pages (`compulsoryPages()` in `scripts/i18n-translation-coverage.js`) | **Compulsory.** Every string translated in all 16 languages, and every date, time and price in the user's formats. |
> | Affiliate pages (`app/affiliate/**`)                                                                            | Encouraged, not required.                                                                                          |
> | Admin pages (`app/admin/**`)                                                                                    | Not required (internal). English is acceptable; `admin.*` keys may be missing from non-English dictionaries.       |
>
> Enforced by `__tests__/lib/i18n/compulsory-translation-coverage.test.ts`: it fails when a compulsory
> page uses a key that is untranslated in any language, or a literal `t()`/`dt()` key that exists in no
> dictionary. **Adding UI to a compulsory page therefore means adding the key to all 17 dictionaries
> with a real translation in each.** Where the correct translation equals the English (a brand name,
> "Heiken Ashi", German "Dashboard"), list the key under that language in
> `scripts/i18n-identical-ok.json`. The test cannot see text that never goes through `t()`: §5 Step 1
> still applies.
>
> On 2026-09-26 every compulsory page reached 100% in all 16 languages (manifest §8, below).

> **2026-09-25 update:** Full 16-language localization audit & remediation across
> all 113 pages (tracked in `docs/files-completion-list/davintrade-ui-page.xlsx`,
> Columns `H`–`W`). Identified and resolved **Failure Mode D** (SSR language
> dropout for languages without a backing country in `SUPPORTED_COUNTRIES`),
> reconciled all 17 dictionaries to exact key parity of 4,710 keys (closing
> the historical two-branch translation drift), wired `app/upgrade/success/page.tsx`
> (Failure Mode E), and verified zero regressions across all Claude Code invariant test suites.
>
> **Same-day re-audit (corrects the note above):**
>
> - The Failure Mode D fix had opened a script-injection path. It now accepts only known language codes.
> - The full test suite was not green; it is now 242/242.
> - 8 dictionary values had been cut or reworded; they are restored.
> - Key parity is not translation: the Tier-2 dictionaries hold English copies. Pages are now graded
>   on translation with `scripts/i18n-translation-coverage.js` (§5 Steps 2 and 5).
> - Hindi is added (column `X`), and right-to-left is server-rendered.
>
> See the §8 log and
> `davintrade-16-language-localization-remediation/16-language-localization-remediation-manifest-work-completion.md`
> §0 and §6.

> **2026-09-03 update:** a full 18-batch site-wide audit (see `CLAUDE.md`'s
> 2026-09-03 ad-hoc entry) wired the large majority of the app — this
> closed §6's original 5-stack inventory and went far beyond it (~130 files
> across pages/components/tests). It also **confirmed §3's Failure mode C
> live in production code, independently, three separate times** (not just
> the original spec's documented precedent — see the note in §3), and
> surfaced several new reusable patterns folded into §2 and §5 below:
> Server Component currency conversion, the status/enum-badge `labelKey`
> convention, an explicit warning against local ad-hoc format helpers, and
> the actual coverage-verification scripts (§5 previously only sketched
> these and admitted a Node script would be more reliable — it now has
> one). Read §6's own updated header before trusting its table as current.

> **If you read nothing else, read this:** §0 below is very likely the
> literal, direct cause of "I changed my language/region setting and
> nothing happened" — not the 5 stacks' hardcoded text (§3), which is a
> real, separate problem but a smaller one. Fix §0 first; it blocks live
> browser verification of everything else. _(2026-09-25: §0 Part 1 is
> fixed; Part 2 is still open. See the status note at the top of §0.)_

**Supersedes nothing; complements:**
[`davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/language_timezone_regional_format_spec.md`](../../davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/language_timezone_regional_format_spec.md)
(the original architecture hand-off) and its
[completion report](../../davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/LANGUAGE_TIMEZONE_REGIONAL_FORMAT_COMPLETION_REPORT.md)
(the server-side preferences API). Those two describe how the system was
**built**; this one describes why new code keeps **not using it**, and how
to fix that, generically, every time.

---

## 0. CRITICAL — the Settings → Language page saves to the database, but nothing ever reads that back. It has zero effect on the running app.

> **Status, 2026-09-25:**
>
> - **Part 1 is fixed** (`a51ba861`, see
>   `davintrade-language-and-locale-format-fix/language-and-locale-format-fix-manifest-work-completion.md`
>   §2). The page now edits the live locale, the same state the header writes. It takes its languages
>   from `SUPPORTED_LANGUAGES`, and `handleSave()` writes the database and then calls
>   `setLocalePreferences()`.
> - **Part 2 is still open.** A signed-in user's saved row is still never loaded back into the live
>   locale on a new device or browser.
>
> The trace below describes the state before Part 1 and is kept as a record.

Traced end to end, not assumed:

1. **[`app/settings/language/page.tsx`](../../app/settings/language/page.tsx)** is a fully self-contained implementation with its own standalone `languages`/`timezones`/`currencies` arrays (lines 39–75) — entirely disconnected from `lib/country-config.ts`'s `SUPPORTED_COUNTRIES`, the actual source of truth every other part of the system uses. _(Historical note: originally, `fr` and `zh` had no dictionary files at all; as of 2026-09-25, all 16 supported languages now have fully populated dictionaries in `lib/i18n/dictionaries/` with 100% key parity)._
2. `handleSave()` (line 147) does exactly one thing: `PUT /api/user/preferences`. It never imports `useLocale`, never calls `setLocalePreferences`/`setCountryCode`, never touches `localStorage` or the `davintrade-locale` cookie.
3. **Nothing downstream ever reads that saved row back.** `app/layout.tsx`'s server-side resolution (line 102) calls `resolvePreferences({ countryPrefix, cookieLanguage })` — and `resolvePreferences()`'s own signature in [`lib/i18n/locale-resolver.ts`](../../lib/i18n/locale-resolver.ts) (line 119) takes exactly those two parameters and nothing else. There is no third parameter for a stored user preference, no Prisma call, no session lookup — the function is structurally incapable of considering the database. `LocaleProvider`'s own client-side resolution effect (§2.A) is the same: URL prefix → `localStorage` → cookie → GeoIP. The database is never in that chain either.
4. The only file anywhere in the repo that actually calls `setCountryCode`/`setLocalePreferences` — i.e. the only real write path into the live locale system — is **[`components/layout/app-header.tsx`](../../components/layout/app-header.tsx)**'s header country dropdown (verified via `grep -rl "setCountryCode\|setLocalePreferences" app/ components/`, one match, no others). It works because it calls `setCountryCode(c.code)` directly from `useLocale()`, using `SUPPORTED_COUNTRIES` as its option list — exactly the pattern the Settings page should have used and doesn't.

**Net effect:** a user opens Settings → Language & Region, changes their language, clicks Save, gets a "Saved!" confirmation, and a real database row updates — and the rendered app does not change, on this load or any future one, from any device, ever, through this page. The header dropdown and URL country-prefix navigation both still work correctly (they never touched the database in the first place), so the system isn't fully broken — but the one settings page a user would naturally reach for is a complete no-op from their perspective.

### Fix — two parts, different risk levels

**Part 1 (low risk, do this first — fixes the immediate symptom):** make `handleSave()` also call `setLocalePreferences()` from `useLocale()`, mirroring `app-header.tsx`'s existing pattern, so a save takes effect in the current session immediately (writes through to `localStorage`/cookie, which every subsequent load already knows how to read):

```tsx
// Add to imports:
import { useLocale } from '@/lib/context/locale-context';

// Inside the component:
const { setLocalePreferences } = useLocale();

// At the end of handleSave(), after the PUT succeeds:
setLocalePreferences(settings);
```

Also replace the standalone `languages` array with one derived from `SUPPORTED_COUNTRIES`/`lib/country-config.ts` (note: `fr`, `zh`, `zh-TW`, `ko`, etc. are now fully backed by complete dictionaries).

**Part 2 (larger, needs explicit sign-off — the deeper gap):** even after Part 1, the stored database row is still never read back on a fresh session (new device, cleared storage, or a different browser) — the DB write is real but still orphaned for any read path except the Settings page's own `loadSettings()` on mount, which reads `GET /api/user/preferences` back into local component state (not into `LocaleProvider`). Wiring `app/layout.tsx`'s server resolution to consult the authenticated user's stored `UserPreferences` row (with correct precedence against the cookie/URL-prefix) is a session/auth-adjacent data-flow change — per `CLAUDE.md` non-negotiable #5 ("money and auth changes escalate... beyond the order's explicit steps → stop and ask Davin"), this needs Davin's explicit design sign-off, not a silent bundle-in alongside Part 1. Flag it; don't build it unasked.

---

## 1. The recurring pattern, stated plainly

The locale system (§2) is real, complete, and working — verified live in a
browser (`CLAUDE.md`'s 2026-08-30 UAE/Arabic ad-hoc entry: `/ae` correctly
resolves `lang="ar"` and `dir="rtl"` with zero console errors). The failure
is not in the system. It is that **every ad-hoc session that has shipped a
new page or component since has not called into it at all** — not "called
it incorrectly," not "forgot one string," but built the entire surface as
if the locale system didn't exist: plain English JSX literals, `date-fns`
`format()` or `.toLocaleDateString()` calls, hand-rolled `$${x.toFixed(2)}`
currency strings.

This happens because these sessions are, by the repo's own design
(`EXECUTOR-PROTOCOL.md` §6), scoped narrowly to their own feature and
verified against their own feature's correctness — `tsc`, `eslint`,
targeted tests, sometimes a live browser check of the RBAC/auth boundary.
None of those checks would ever fail because a string is hardcoded in
English; hardcoded English _is_ valid TypeScript, passes `eslint`, and
renders a perfectly correct-looking page to an English-speaking reviewer.
The gap is invisible to every verification method these sessions already
run — it only shows up when a non-English/non-`US` user actually loads the
page, which none of the past sessions' documented verification steps did.

## 2. The locale system, as it actually exists (reference)

Two entry points, because Next.js App Router has two rendering contexts and
this codebase deliberately keeps them separate:

### 2.A Client Components — `useLocale()`

```ts
import { useLocale } from '@/lib/context/locale-context';

const {
  t, // (keyOrText: string, fallback?: string) => string
  formatDate, // (utc: number | string | Date) => string — respects dateFormat (DMY/MDY/YMD)
  formatTimestamp, // same input, HH:MM:SS respecting timeFormat (12h/24h) and timezone
  formatCurrency, // (amountInUSD: number) => string — ⚠ input MUST be USD, see §4
  formatRelativeTime, // (minutesAgo: number) => string, itself i18n'd via t()
  language,
  countryCode,
  currency,
  timezone,
  dateFormat,
  timeFormat,
  countryConfig,
} = useLocale();
```

Defined in
[`lib/context/locale-context.tsx`](../../lib/context/locale-context.tsx).
Requires the component to be inside `LocaleProvider` (mounted globally via
`ClientProviders`) — throws `useLocale must be used within a LocaleProvider`
otherwise (this is `LESSONS-LEARNED.md`'s **L40**, a _test_-authoring
failure mode; production code never hits it because `LocaleProvider` is
already mounted app-wide, so its absence in a component is silent in
production, not a crash — nothing stops a component from simply never
calling the hook).

There is also a `<T>` wrapper component for pure-string children:
`<T>Some English Text</T>` — equivalent to `{t('Some English Text')}` but
usable without pulling in the hook.

### 2.B Server Components — `getServerLanguage()` + `getDictionary()`

```ts
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

const language = await getServerLanguage(); // resolves cookie + middleware header, same precedence as the client
const dict = getDictionary(language); // plain Record<string, string>, eager-loaded, all 13 locales
const label = dict['some.key'] ?? 'Fallback Text'; // no t()-style fuzzy fallback here — do the ?? yourself
```

Defined in
[`lib/i18n/server-locale.ts`](../../lib/i18n/server-locale.ts) and
[`lib/i18n/get-dictionary.ts`](../../lib/i18n/get-dictionary.ts). This is
the **only** correct way to localize a Server Component's `metadata`
export, or any text a Server Component renders directly without delegating
to a client child — there is no server equivalent of `t()`'s built-in
fallback/normalization, so every lookup needs its own `?? 'fallback'`.

**If the Server Component also shows a confirmed-USD money figure**,
`useLocale()`'s `formatCurrency()` isn't reachable (no hook on the
server) — use `getServerLocalePreferences()` (same file, returns the full
preference object instead of just `.language`) with
`getCountryByCode()`/`formatCurrencyAmount()` from
[`lib/country-config.ts`](../../lib/country-config.ts) instead. Verified
working in two independent Server Components (`app/admin/dashboards/
revenue/page.tsx`, the original reference; `app/affiliate/dashboard/
payouts/page.tsx` and `app/(marketing)/status/page.tsx`, wired fresh in
the 2026-09-03 audit):

```ts
import { getServerLocalePreferences } from '@/lib/i18n/server-locale';
import { formatCurrencyAmount } from '@/lib/country-config';
import { getDisplayUsdRates } from '@/lib/fx/usd-rates';

const prefs = await getServerLocalePreferences(); // { language, countryCode, currency, ... }
// The rate comes from the currency itself, so the symbol and the figure cannot
// disagree (Thai with GBP shows pounds). Pass the live table (2026-09-26) so the
// page matches the client and the dLocal charge; without it the fixed rate applies.
const { rates } = await getDisplayUsdRates();
const usd = (amountInUSD: number): string =>
  formatCurrencyAmount(amountInUSD, {
    currency: prefs.currency,
    language: prefs.language,
    rates,
  });
// usd(commission.amount) — same USD-input contract as formatCurrency(), see §4
```

### 2.C Supporting pieces

- **17 dictionaries (16 supported languages + regional variants)**: `en-GB`,
  `en-US`, `th`, `fr`, `ko`, `zh` (Simplified), `zh-TW` (Traditional), `de`,
  `es`, `ja`, `hi`, `vi`, `id`, `tr`, `ur`, `pt`, `ar` in
  [`lib/i18n/dictionaries/`](../../lib/i18n/dictionaries/). Client bundles
  `en-GB`/`en-US`/`th` synchronously, lazy-loads the rest; server loads all
  17 eagerly (no bundle-size concern server-side).
- **Master Parity Standard (4,710 keys)**: Every one of the 17 dictionary
  files must maintain exact key symmetry. In historical iterations, two-branch
  drift occurred (Customer/marketing keys added to `th.json` while Admin/fraud
  keys were added to `fr.json`/`ko.json`/`zh.json`). As of 2026-09-25, all
  keys are cross-populated, bringing all dictionaries to exactly 4,710
  keys, of which the source references 3,036 (counted by
  `scripts/i18n-translation-coverage.js`; the rest are unused). **Whenever adding a new key,
  it MUST be added to all 17 dictionaries at the same time** (with genuine
  translations or clean fallback) rather than letting files drift.
  **Parity is not translation.** The Tier-2 dictionaries (`es`, `de`, `pt`,
  `ja`, `ar`, `ur`, `vi`, `id`, `tr`, `hi`) were filled with English copies,
  so "missing key" checks no longer find untranslated text. Measure
  translation with `scripts/i18n-translation-coverage.js` (§5 Step 2); as of
  2026-09-25 about a quarter of the keys in use are translated in those
  languages, against 92–94% in `fr`/`ko`/`zh`/`zh-TW`/`th`.
- **Only known language codes are accepted.** `lib/i18n/languages.ts`
  (`SUPPORTED_LANGUAGES`, `isSupportedLanguage()`) is the list. The language
  cookie and localStorage are user-controlled, and the resolved language is
  written into `<html lang>` and an inline script in `app/layout.tsx`, so
  `resolvePreferences()` and `LocaleProvider` both reject anything else.
- **Two key conventions coexist by design** (do not normalize one into the
  other): most keys are the literal English string itself
  (`t('Some English Text')`), a smaller set are dot-namespaced
  (`t('nav.dashboard', 'Dashboard')`) for structured chrome.
- **A partial dictionary degrades safely, never breaks**: `t()` falls back
  to its own `fallback` param or the raw key; `getDictionary()` falls back
  to `en-GB` wholesale if a language key is missing entirely. However, rely
  on fallback only for graceful degradation during development — production
  standards require key parity across all 17 dictionaries to eliminate
  Failure Mode C.
- **`formatCurrency()` converts, it does not just format**: it multiplies
  the USD input by the chosen currency's rate and formats in that currency.
  Since 2026-09-26 the rate is the **live** hourly table in
  `lib/fx/usd-rates.ts` (the same one the dLocal charge uses), delivered by
  the root layout and refreshed from `GET /api/fx/rates`; the static table
  in `lib/country-config.ts` (`exchangeRateForCurrency()`) is only the
  fallback when the rate API is unreachable. Feeding it an amount already in a non-USD
  currency silently double-converts. See §4.
- **RTL**: `<html dir>` is `rtl` for `ar`/`ur` (`textDirection()` in
  `lib/i18n/languages.ts`), set by `app/layout.tsx` on the server and kept in
  step by `LocaleProvider` after a language change; no per-component work is
  needed for direction, only for text content.
- **Status/enum badges — the `labelKey` map pattern.** A badge that renders
  a Prisma enum value directly (`{status}` → `PENDING`, `ACTIVE`,
  `COMPLETED`, ...) is still a locale gap even once the surrounding page
  calls `t()`/`dt()` — the enum value itself never goes through
  translation. Used ~15+ times across the 2026-09-03 audit (payment-batch
  status, disbursement-transaction status, Wise-recipient status,
  affiliate-account status, audit-log status, system-health status). Don't
  invent a new shape per file — add a `labelKey` field alongside the
  existing `label`/className config and pass the page's own `t`/`dt`
  through:

  ```ts
  const STATUS_CONFIG: Record<Status, { className: string; labelKey: string; label: string }> = {
    PENDING: { className: '...', labelKey: 'admin.disbursement.tx_status_pending', label: 'Pending' },
    // ...
  };
  // in the badge helper (which must now take `t` as a parameter, not read it from a closure):
  function getStatusBadge(status: Status, t: (key: string, fallback?: string) => string) {
    const config = STATUS_CONFIG[status];
    return <Badge className={config.className}>{t(config.labelKey, config.label)}</Badge>;
  }
  ```

  **Grep for an existing key before adding a new one** — `tx_status_*`/
  `batch_status_*`/`audit_status_*` families already exist in
  `admin.disbursement.*` and are safe to reuse verbatim wherever the
  underlying value is genuinely the same English word (e.g. `COMPLETED`
  means the same thing whether it's a transaction, a batch, or a
  disbursement).

- **Not everything is a translation target — dynamic, backend-sourced
  strings stay as-is.** Audit-log `action` values, raw provider codes
  (`WISE`, `RISE`), a live `WiseTransfer.currentState`, or a system-status
  component's own `name`/`detail` text are data, not UI chrome — they come
  from the database or a third-party API in whatever shape it returns them
  and have no dictionary-key equivalent to translate to. Only the static
  labels _around_ that data (column headers, section titles, the enum
  badges above) are locale gaps. When in doubt, ask: would this value ever
  render for a French-language admin and an English-language admin
  identically because it's the same raw code either way? If yes, leave it.
- **Never write a local, ad-hoc `formatCurrency`/`formatDate` helper.**
  Found three times in the 2026-09-03 audit — a page defining its own
  `const formatCurrency = (val) => (Number(val) || 0).toFixed(2)` (with a
  separate hardcoded `$` in the JSX), or importing `date-fns`'s `format()`
  directly instead of the shared `formatDate()` — each one is a silent,
  permanent locale gap masquerading as working code (it renders a number,
  just never in the viewer's own currency or date format). If a component
  needs currency/date formatting and doesn't already have `useLocale()` or
  `getServerLocalePreferences()` in scope, that's the tell to add it, not
  to write a local formatter.
- **Three helpers added 2026-09-26** (all in `lib/context/locale-context.tsx` unless noted):
  - `<Translated k="key" fallback="English" />`: a translated string as an element, for Server
    Components and `loading` fallbacks that cannot call a hook (e.g. `app/charts/loading.tsx`).
  - `useOptionalTranslation()`: `t()` that returns the fallback outside a `LocaleProvider`. For shared
    UI primitives only (the dialog's "Close", toasts), which unit tests render without a provider.
  - `localizedMetadata()` in `lib/i18n/server-metadata.ts`: tab title and description in the
    visitor's language, from `generateMetadata()`. A static `export const metadata` is English only.
- **Validation messages:** zod schemas keep English messages; render them with
  `t(errors.field.message ?? '')` and add each message as a key. Rendering `errors.field.message`
  directly shows English in every language.
- **Durations:** `date-fns`'s `formatDistanceToNow` is English only. Use `Intl.NumberFormat(language,
{ style: 'unit', unit: 'hour' | 'day', unitDisplay: 'long' })` (see
  `app/settings/account/account-settings-client.tsx`).
- **`app/global-error.tsx`** replaces the root layout, so it has no provider: it reads the
  `davintrade-locale` cookie and imports that dictionary itself.

## 3. The three verified failure modes

Confirmed live in this codebase's own recently-shipped code (2026-08-31
and 2026-09-03 ad-hoc sessions), not hypothetical. All three — including
C, originally only a documented precedent — now have confirmed live
instances:

### Failure mode A — Client Component never calls `useLocale()`

`components/affiliate/commission-table.tsx`: imports `date-fns`'s `format`
directly, no `'use client'` locale import, no `useLocale()` call anywhere.
`components/billing/invoice-list.tsx`: builds its VAT line as
`` `incl. $${invoice.taxAmount.toFixed(2)} VAT (${ratePercent}%${countrySuffix})` ``
and renders the literal JSX string `"Reverse charge — 0% VAT"` — both a
hardcoded `$` symbol and hardcoded English, never touching `formatCurrency`
or `t()`.

**Fix pattern:**

```tsx
// Before
import { format } from 'date-fns';
// ...
<span>{format(commission.createdAt, 'MMM d, yyyy')}</span>
<span>${commission.amount.toFixed(2)}</span>
<Badge>Reverse charge — 0% VAT</Badge>

// After
import { useLocale } from '@/lib/context/locale-context';
// ...
const { formatDate, formatCurrency, t } = useLocale();
// ...
<span>{formatDate(commission.createdAt)}</span>
<span>{formatCurrency(commission.amount)}</span>  {/* only if amount is USD — see §4 */}
<Badge>{t('billing.reverse_charge', 'Reverse charge — 0% VAT')}</Badge>
```

### Failure mode B — Server Component never calls `getServerLanguage()`/`getDictionary()`

`app/(marketing)/academy/page.tsx` and `app/admin/tutorials/page.tsx`: both
pure Server Components; `academy/page.tsx`'s `metadata` export
(`title`/`description`) and its `CATEGORY_LABELS` record are plain hardcoded
English object literals — not even the _cheaper_ server-only localization
path was used, despite it requiring no client boundary at all.

**Fix pattern:**

```tsx
// Before
export const metadata = {
  title: 'DavinTrade Academy | Learn to Trade & Master the Platform',
  description: 'Free video tutorials on trading fundamentals...',
};
const CATEGORY_LABELS: Record<TutorialCategory, string> = {
  GETTING_STARTED: 'Getting Started',
  // ...
};

// After
import { getServerLanguage } from '@/lib/i18n/server-locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';

export async function generateMetadata() {
  const dict = getDictionary(await getServerLanguage());
  return {
    title:
      dict['academy.meta_title'] ??
      'DavinTrade Academy | Learn to Trade & Master the Platform',
    description:
      dict['academy.meta_description'] ??
      'Free video tutorials on trading fundamentals...',
  };
}

export default async function AcademyPage(props: AcademyPageProps) {
  const dict = getDictionary(await getServerLanguage());
  const CATEGORY_LABELS: Record<TutorialCategory, string> = {
    GETTING_STARTED:
      dict['academy.category.getting_started'] ?? 'Getting Started',
    // ...
  };
  // ...
}
```

If a page has both static chrome (Server-Component-renderable) and
interactive bits, keep the interactive bits as a small client child that
calls `useLocale()` itself — don't force a whole page to `'use client'`
just to reach the locale hook.

### Failure mode C — orphaned `t()` calls (CONFIRMED live, three independent instances — not just theoretical)

Originally recorded only as a documented precedent from the original spec
(§2 of `language_timezone_regional_format_spec.md`) with no confirmed
occurrence in this codebase. **The 2026-09-03 site-wide audit found it
live, independently, in three unrelated places**: `app/admin/
affiliates/[id]/page.tsx` (wired from an earlier, unrelated commit that
added the `t()` calls but never the dictionary rows they referenced);
`components/auth/{login-form,register-form}.tsx` plus `app/(auth)/login/
page.tsx`'s already-signed-in screen (both forms already called
`useLocale()`/`t()` throughout, using the literal-English-text-as-key
convention — `t('Welcome Back')` with no fallback arg — but the dictionary
had **zero** rows for any of those ~70 literal keys); and all of
`components/landing/{landing-hero,landing-features}.tsx`,
`components/pricing/tier-comparison.tsx`, and `components/marketing/
status-refresh-button.tsx` (same story, ~80 more literal keys, zero rows).

The important nuance this confirms: this failure mode is **not only** "A/B
got fixed, then a fresh gap of this exact shape appeared later." It also
happens at **original authoring time** — someone wires `useLocale()`/`t()`
correctly while building a brand-new page, satisfying failure modes A/B
completely, and simply never adds the corresponding dictionary keys in the
same change. The file looks fully compliant by every check in §5 step 1
(it clearly calls `useLocale`); only step 2's key-extraction-and-diff
catches it. **Don't skip step 2 just because step 1 came back clean** —
that's exactly the situation where step 2 is the only thing that would
catch a real gap.

Confirmed once wired correctly, `t()`/`getDictionary()` both degrade
safely (§2.C) — the failure is silent, not a crash, which is exactly why
it survives so long undetected.

### Failure mode C-2 — a dictionary that was already "done" falls behind a later key added to the same component (CONFIRMED live, 2026-09-18)

A variant of Failure mode C, distinct enough to name separately: this is
**not** a dictionary with zero coverage for a component — it's a
dictionary that was correctly, deliberately populated for a component at
the time that translation pass ran, which then silently regresses the
moment the component gains **one more key** in a later, unrelated
session.

Confirmed live on `components/marketing/marketing-navbar.tsx`: the
2026-09-18 session found `th`/`ja`/`de`/`es`/`pt`/`hi`/`vi`/`id`/`tr`/`ur`
all had real, correct translations for the navbar's original items
(`Features`/`Pricing`/`Docs`/`Blog`/`Affiliates`/`More`) — but were
missing exactly `Academy`, `EconNews`, and `Language`, the three items
added to that same navbar in later, unrelated sessions (2026-08-31 and
2026-09-04). Nothing about those later sessions' own verification could
have caught this: `useLocale()`/`t()` was already correctly wired (§5
step 1 clean), and the **other 9 dictionaries this repo actively
maintains** (`en-US`/`en-GB`/`fr`/`ko`/`zh`/`zh-TW`/`ar` at the time, plus
`th`) either got the new keys added in the same session or degrade
safely to English — so the gap was invisible from the perspective of
whichever session added the nav item, and only surfaces when a user on
one of the _other_ ~9 "legacy" dictionaries loads the page.

**Why this needs its own audit trigger, not just Step 2 as written:**
Step 2's extraction-and-diff already catches this correctly **if run**
— the failure isn't in the tooling, it's that nothing prompts a re-audit
of a component you didn't just author. §1's framing ("read this before
building or auditing any user-facing surface... re-run its audit
procedure before closing any session that adds one") reads naturally as
"session that adds a _new_ page/component," not "session that adds one
more nav link / footer link / dropdown item to an _existing_, already-
translated shared component." **The rule needs to cover both:** any
session that adds a key to a shared marketing/navigation/footer
component — however small the addition looks — must re-run Step 2
against that component's full key set across every dictionary, not just
confirm the new key renders correctly in whichever language the session
happened to test in. A one-line nav addition is exactly the kind of
change likely to be verified in English only and shipped without anyone
thinking of it as "adding UI."

### Failure mode D — SSR language dropout for languages without a backing country (CONFIRMED live, 2026-09-25)

A subtle, high-impact server-client resolution defect that caused pages in French, Korean, Chinese (Simplified/Traditional), Spanish, Portuguese, etc. to silently drop back to English (`en-GB`) on initial SSR or hard refresh.

**Root cause:**
In [`lib/country-config.ts`](../../lib/country-config.ts), `SUPPORTED_COUNTRIES` intentionally only includes countries where DavinTrade operates official payment channels or localized regional domains (e.g. `GB`, `US`, `TH`, `AE`, `FR`, `KR`, etc.). It intentionally **does not** include countries like China (`CN`) or Taiwan (`TW`) because `CNY` is withdrawn/unbacked.

When a user selected Chinese (`zh` or `zh-TW`), Spanish (`es`), or Portuguese (`pt`):

1. The user's cookie `davintrade-locale` correctly contained `{ "language": "zh" }`.
2. On server render, `app/layout.tsx` called `resolvePreferences({ countryPrefix, cookieLanguage: 'zh' })`.
3. In [`lib/i18n/locale-resolver.ts`](../../lib/i18n/locale-resolver.ts), `preferencesForLanguage('zh')` was called. Because there is no backing country in `SUPPORTED_COUNTRIES` whose primary language is `zh`, `preferencesForLanguage('zh')` correctly returned `null`.
4. **The flaw:** When `preferencesForLanguage` returned `null`, `resolvePreferences` dropped to the final fallback:
   ```ts
   // BEFORE (BUG):
   const prefs = preferencesForLanguage(cookieLanguage);
   if (prefs) return prefs;
   return defaultPreferences; // defaultPreferences has language: 'en-GB'!
   ```
   This completely discarded the user's `cookieLanguage`, rendering the page on SSR with English dictionary strings (`lang="en"`). When the client loaded, hydration mismatched or re-rendered with English until `localStorage` reconciled.

**The Fix:**
Retain the user's explicit `cookieLanguage` while keeping safe default regional formats,
**but only when it is a known language code**:

```ts
// AFTER (FIXED):
const language = isSupportedLanguage(cookieLanguage) ? cookieLanguage : null;
const fromLanguage = language
  ? (preferencesForLanguage(language) ?? { ...defaultPreferences, language })
  : defaultPreferences;
```

**⚠ The first version of this fix (2026-09-25) passed any cookie value through.** The
language is written into `<html lang>` and, unescaped, into the inline script in
`app/layout.tsx` (`var lang = '…'`), so a cookie such as `x'+alert(1)+'` executed as
script on the server-rendered page (reproduced against `next dev`). The re-audit the
same day added the `isSupportedLanguage()` check, JSON-encoded the value in the inline
script, and validated the localStorage copy in `LocaleProvider` and in the script's
self-heal branch. Tests: `__tests__/lib/i18n/locale-resolver.test.ts` ("ignores an
unknown language cookie") and `__tests__/lib/context/locale-context.test.tsx`.

**Limit of this fix:** Server Components and `<html lang>` now render the chosen
language on the first response. Client Components still paint English first for every
language except `en-GB`, `en-US` and `th` (the only dictionaries `LocaleProvider`
bundles synchronously), then switch once the dictionary loads. That is a bundle-size
trade-off, not this bug.
**CRITICAL INVARIANT:** Do **NOT** fix this by adding `cn` or `tw` to `SUPPORTED_COUNTRIES`, and do **NOT** make `preferencesForLanguage('zh')` return a country object! Doing so breaks the invariant tested in `__tests__/pages/settings/language.test.tsx` (`keeps the current values for a language with no country`), which requires that languages without a backing country leave the user's existing `dateFormat` and `currency` untouched.

### Failure mode E — post-action & success redirect pages left unwired (CONFIRMED live, 2026-09-25)

Pages that handle post-action callbacks or checkout redirects (e.g., `app/upgrade/success/page.tsx`, payment return URLs) often get created quickly and missed during initial audits because developers treat them as "simple static confirmation stubs."

**Impact:** A user navigates through a fully localized checkout experience in French or Korean, completes their transaction, and is redirected to an English-only success page (`"Payment Successful"`, `"Return to Dashboard"`). This damages trust at the most sensitive step of the customer journey.

**Fix pattern & test requirement:**
Always wire these pages with `useLocale()` / `t()`. When adding tests for these pages, strictly follow **L40** (`LESSONS-LEARNED.md`) by wrapping the test render in `LocaleProvider` and mocking `usePathname()` / `useSearchParams()`:

```tsx
// See __tests__/pages/checkout/upgrade-success.test.tsx for reference
import { render as rtlRender, screen } from '@testing-library/react';
import { LocaleProvider } from '@/lib/context/locale-context';

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}
```

### Failure mode F — server-rendered parts keep the old locale until a refresh (CONFIRMED live, 2026-09-25)

**Symptom.** After a language or format change without reloading the page, client-rendered text
switches, but anything a Server Component rendered keeps the old values. This includes layouts such
as the admin sidebar. Davin's screenshots showed exactly that on `/admin`: a Thai body, with a Korean
sidebar and header until he refreshed.

**Cause.** Server Components read locale from the cookies (`getServerLanguage()`,
`getServerLocalePreferences()`). Writing those cookies in the browser only affects the _next_ server
render. The Next.js client router also caches layouts and reuses them without asking the server, so a
layout rendered in the old language comes back unchanged on a later navigation.

**Fix, already in place.** `LocaleProvider` calls `syncLocaleCookiesAction`
(`app/actions/locale.ts`) whenever what the server renders from (`serverRenderKey()`) changes. Setting
cookies in a Server Action re-renders the current route in the same round trip and clears the client's
cached routes. **New code needs to do nothing extra, as long as it:**

- changes locale only through `useLocale()` (`setLocalePreferences`, `setCountryCode`), never by
  writing the cookies or localStorage directly;
- in a client component that draws text outside React (a canvas, a chart library's price-line
  titles), depends on the **translated strings** rather than on `t` itself. `t` changes identity on
  first-load reconciliation; the strings change only when the visible text does. See
  `components/currency-index-pro/chart/relative-strength-chart.tsx` for the band titles;
- does not keep translated or formatted display text in `useState` computed once. Compute it during
  render, or it will not follow a change.

**Test:** `__tests__/lib/context/locale-context.test.tsx` ("server-rendered parts follow a change") and
`__tests__/app/actions/locale.test.ts`. Full account:
`davintrade-16-language-localization-remediation/16-language-localization-remediation-manifest-work-completion.md` §7.

## 4. The one real gotcha: `formatCurrency()` expects USD

`formatCurrency(amountInUSD: number)` multiplies by the chosen currency's
rate (live, see §2.C) — it is a **convert-and-format** function, not a
format-only function. Before wiring it into any of the 5 recently-built
stacks, confirm the underlying figure is genuinely USD:

- **BI dashboards** (`lib/admin/analytics/revenue.ts` etc.): revenue merges
  Stripe `Invoice.amountTotal` (USD-only Price object, per
  `davintrade-dashboard-stack/...manifest-work-completion.md` §6.D finding)
  and dLocal `Payment.amountUSD` (named USD explicitly) — both genuinely
  USD. Safe to feed directly to `formatCurrency()`.
- **Tax invoicing** (`Invoice.taxAmount`, `Invoice.amountTotal`): same
  USD-only Stripe Price object backing every invoice in this codebase today
  — safe, but re-verify against live `Invoice` rows if multi-currency
  Stripe pricing is ever introduced (flagged as a future decision in the
  language spec's own §6.D and the BI dashboard completion report).
- **Affiliate commissions** (`Commission.amount`): verify against
  `money-service`'s commission-crediting logic before assuming USD — do not
  guess.

If a figure is _not_ USD (e.g., it's already in the user's local currency
from a stored `dLocal` charge), use `Intl.NumberFormat` directly with the
known currency code instead of `formatCurrency()`, or extend
`locale-context.tsx` with a currency-aware sibling function — don't force
a non-USD figure through `formatCurrency()`, which would double-convert it.

**A converted price is an estimate; say so where money is taken (rule, 2026-09-26).**
Card payments go through Stripe **in USD**, and the card issuer converts at its
own rate, which we cannot know. So wherever a converted price is shown next to
a way to pay, a note must say the local figure is approximate and name the USD
charge: `pricing.approx_note` on `/pricing`, `checkout.card_charged_usd` in
checkout's card box. Show it only when the display currency is not USD, and
format the USD figure with `formatChargedAmount(amount, 'USD', language)`, never
`formatCurrency()` (that would convert it). The landing-page pricing card does
not have the note yet.

### 4.A Country & Currency Invariants — never add unbacked countries/currencies to "fix" a language

`SUPPORTED_COUNTRIES` in [`lib/country-config.ts`](../../lib/country-config.ts) is tied to financial compliance, Stripe pricing models, and payment provider routing.

- Currencies `CNY`, `AUD`, and `CAD` were explicitly withdrawn/removed (see `davintrade-language-and-locale-format-fix/language-and-locale-format-fix-manifest-work-completion.md`).
- Countries without direct localized payment gateways (e.g. `CN`, `TW`) must **NEVER** be added to `SUPPORTED_COUNTRIES` solely to provide a language with a country mapping.
- Languages without a backing country (`zh`, `zh-TW`, `es`, `pt`) are first-class supported languages in DavinTrade; their regional formats simply default safely (e.g., `DMY` / `GBP` or whatever preferences the user has set) without forcing fictitious local currencies.
- Any attempt to add `cn` or `tw` into `SUPPORTED_COUNTRIES` breaks Claude Code's invariant test `__tests__/pages/settings/language.test.tsx` (`keeps the current values for a language with no country`). Keep `SUPPORTED_COUNTRIES` pristine.

## 5. Audit procedure — run this before closing any session that adds user-facing UI

Different from the original spec's audit (which assumed `t()` was already
called everywhere and looked for missing dictionary entries). This
procedure checks for **both** gaps in one pass — files with no locale
wiring at all (failure modes A/B), and files that wire it correctly but
never populate the dictionary (failure mode C, §3 — confirmed common, not
rare). This is the actual script sequence used and refined across the
2026-09-03 site-wide audit's 18 batches, not a sketch — copy it directly.

### Step 1 — files with zero locale-system usage (failure modes A/B)

```bash
git diff --name-only <base-branch>...HEAD -- 'app/**/*.tsx' 'components/**/*.tsx' \
  | xargs grep -L "useLocale\|getServerLanguage\|getDictionary" \
  | xargs grep -l "toFixed(\|toLocaleDateString(\|toLocaleString(\|date-fns"
```

This is the primary gate — it is what would have caught every file named
in §3 before merge. A file that shows up here needs the full A/B fix
pattern from §2, not just a dictionary key added.

### Step 2 — orphaned `t()`/`dt()` calls in files that DO call the locale system (failure mode C)

Extract every key actually referenced in the file(s) under audit, diff
against the dictionary, and confirm coverage programmatically — don't
eyeball it. This two-script pattern (extract → diff-and-translate →
re-verify) is what caught every failure-mode-C instance in §3's "CONFIRMED
live" note, and it must run **even on files where step 1 came back
clean** — that's precisely the situation it exists to catch.

```js
// extract-keys.js — run per file or file group under audit.
// Captures both conventions from §2.C: dotted keys with a literal fallback
// (t('some.key', 'Fallback')) and bare literal-text-as-key calls
// (t('Some English Text') with no second arg).
const fs = require('fs');
const files = [
  /* the files under audit */
];
const dotted =
  /(?:t|dt)\(\s*'([a-zA-Z0-9_.]+\.[a-zA-Z0-9_.]+)'\s*,\s*((?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"))\s*\)/gs;
const literal = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*\)/g;
const found = {};
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = dotted.exec(src))) {
    try {
      found[m[1]] = eval(m[2]);
    } catch {
      found[m[1]] = m[2];
    }
  }
  while ((m = literal.exec(src))) {
    const k = m[1] ?? m[2];
    found[k] = k;
  }
}
console.log(JSON.stringify(found, null, 2));
```

```js
// coverage-check.js — diff the extracted set against every dictionary,
// so you know exactly which keys are missing from which language before
// writing a single translation, and can re-verify translated-set ===
// missing-set afterward (empty symmetric difference) before applying.
const fs = require('fs');
const extracted = require('./extract-keys-output.json'); // from the script above
for (const lang of [
  'en-US',
  'en-GB',
  'fr',
  'ko',
  'zh',
  'ar',
  'th' /* ...as relevant */,
]) {
  const dict = JSON.parse(
    fs.readFileSync(`lib/i18n/dictionaries/${lang}.json`, 'utf8')
  );
  const missing = Object.keys(extracted).filter((k) => !(k in dict));
  console.log(lang, 'missing', missing.length, missing);
}
```

**Two things this misses that you must add by hand:** (1) keys referenced
via a variable, not a literal string — e.g. `t(config.labelKey, config.label)`
or `t(\`admin.system.status\_${status.toLowerCase()}\`, status)`— the
regex can't resolve these; walk every`labelKey`/dynamic-template call
site in the file and add its resolved key(s) manually. (2) Once you know
the missing set, write real per-language translations, not machine-bulk
output — then re-run the coverage check with the _translations_ file in
place of the raw missing list and confirm the symmetric difference against
the original missing set is empty before applying to any dictionary file.

**A third, confirmed-live variant of (1): an array of records, rendered
via `t(item.field)` (CONFIRMED live, 2026-09-18).**
`components/landing/landing-features.tsx` stores its 4 feature cards in a
plain `features` array (`{ title: 'AI Pattern Recognition', description:
'...', badge: 'Real-time AI' }`, ×4) and renders each field via
`t(item.title)` / `t(item.description)` / `t(item.badge)`. This file was
correctly included in the 2026-09-18 marketing-chrome session's audit
scope, and every other file in that scope used only literal `t('...')`
calls — but the extraction regex above matches `t(\s*'...'\s*)`, which
cannot see through a property access. The result: all 12 of those keys
(4 cards × 3 fields) were silently never counted as missing, and never
translated for `fr`/`ko`/`zh`/`zh-TW`/`ar` — while `th` (and the other
"legacy" dictionaries) already happened to have them from an earlier,
unrelated pass, producing the visible split Davin screenshotted (Thai
correct, Traditional Chinese still English, on the exact same page).

**Don't just "walk it by hand" — grep for this shape mechanically before
trusting a clean extraction run:**

```bash
grep -nE '\bt\(\s*[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_]' <files under audit>
```

Any hit is a call the extraction script cannot see. Trace it back to the
object/array literal the property comes from, add every field's resolved
string to the extracted key set by hand, and only then run the coverage
diff — a file that passes the regex-based extraction clean is not proof
it has no orphaned keys, only proof it has none of the _literal_ kind.

**Since 2026-09-25 a missing key is no longer the signal.** Every dictionary
holds all 4,710 keys, and untranslated keys hold English copies, so the
diff above finds nothing even where a page is entirely English. Measure
translation instead:

```bash
node scripts/i18n-translation-coverage.js                  # % of used keys translated, per language
node scripts/i18n-translation-coverage.js --explain "app/(marketing)/page.tsx" --lang fr
```

`--explain` lists the page's keys (its own file and the components it
imports) whose value is still identical to en-GB. `--pages list.txt --json
out.json` produces the per-page figures behind the grades in Step 5.

**Two extraction mistakes to avoid, both seen on 2026-09-25:**

- **An extractor that stops at an apostrophe** turned
  `t('admin.view_as.subtitle', "Open any affiliate's dashboard…")` into the
  value `"Open any affiliate"` in all 17 dictionaries (the view-as texts and
  `academy.admin.invalid_youtube_url` → `"Doesn"`). A dictionary value
  **overrides** the source fallback, so the cut text is what renders, and
  translations made from it are cut too. After generating values, diff each
  new English value against the fallback in the source; they must match.
- **A value that rewords the fallback** (`payments.using_estimated_rate` →
  "Using estimated exchange rate") silently changes the English UI and
  breaks tests that assert the source text. English dictionary values for
  dotted keys should equal the source fallback.

### Step 3 — spot-check hardcoded currency/date literals directly

```bash
git diff --name-only <base-branch>...HEAD -- 'app/**/*.tsx' 'components/**/*.tsx' \
  | xargs grep -nE '\$\{[a-zA-Z.]+\.toFixed\(|`\$\$?\{|const formatCurrency ?='
```

The last alternation (`const formatCurrency ?=`) catches the local
ad-hoc-helper anti-pattern from §2.C directly — a file defining its own
`formatCurrency` is a locale gap even though the name suggests otherwise.

### Step 4 — if wiring a file breaks an existing test, use the established fix, don't loosen the assertion

Two failure classes recur constantly once a file gains its first
`useLocale()`/`getServerLanguage()` call, and both have a known, copy-paste
fix (`LESSONS-LEARNED.md` **L40**; recurred 20+ times across the
2026-09-03 audit alone) — never fix either by weakening what the test
actually checks:

**"useLocale must be used within a LocaleProvider"** (any Client Component
test that renders a component now calling `useLocale()`):

```tsx
import { render as rtlRender, screen } from '@testing-library/react';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({ usePathname: () => '/the/real/path' }));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

beforeEach(() => {
  localStorage.setItem(
    LOCALE_STORAGE_KEY,
    JSON.stringify({
      countryCode: 'US',
      language: 'en-US',
      timezone: 'America/New_York',
      dateFormat: 'MDY',
      timeFormat: '12h',
      currency: 'USD',
    })
  ); // seeds past LocaleProvider's real geo-IP fetch(), which otherwise crashes Jest teardown
});
```

Seeding the fixture also changes real output the test may already assert
on — `formatCurrency()` drops decimals and adds a thousands separator once
an amount reaches 1000 (e.g. `"$1234.56"` → `"$1,235"`), and `formatDate()`
renders the seeded `dateFormat` (e.g. `01/15/2024` for MDY) instead of
whatever ad-hoc format the pre-existing test mocked. Update those
assertions to the real formatted output — this is a finding to fix, not a
regression to route around.

**"`cookies` was called outside a request scope"** (any Server Component
test that renders a component now calling `getServerLanguage()`/
`getServerLocalePreferences()`):

```ts
const mockCookieStore = { get: jest.fn(() => undefined) };
const mockHeaderStore = { get: jest.fn(() => null) };
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
  headers: jest.fn(() => Promise.resolve(mockHeaderStore)),
}));
```

Use `jest.mock(...)` at module scope for a file with a static `import` of
the page under test; use `jest.doMock(...)` inside a `beforeEach` (with
`jest.resetModules()` and a `require()` of the page inside the test body)
if the existing test file already does that for its other dependencies —
match whatever convention the file already uses rather than mixing both.

**One more collision to watch for once real translations replace English
fallbacks:** a raw enum value like `COMPLETED` rendered next to a column
header spelled the same way in title case (`Completed`) — once the badge
is translated via the `labelKey` pattern above, `screen.getByText
('Completed')` may now match both, where it previously only matched the
badge (because the header was the differently-cased literal `Completed`
and the raw enum was `COMPLETED`). Disambiguate with `{ selector: 'span' }`
or `within(screen.getByRole('table'))` rather than loosening to
`getAllByText` and asserting a length — that hides the fact you can no
longer tell which element you're checking.

### Step 5 — Verify and record status in Master Page Registry (`docs/files-completion-list/davintrade-ui-page.xlsx`)

The single canonical tracking matrix for page compliance across all 16 languages is:
[`docs/files-completion-list/davintrade-ui-page.xlsx`](../../docs/files-completion-list/davintrade-ui-page.xlsx)

- Columns `H` through `X` track each language across all 113 rows:
  English UK `en-GB` (H), English US `en-US` (I), Spanish `es` (J), German `de` (K), Portuguese `pt` (L),
  Japanese `ja` (M), Arabic `ar` (N), French `fr` (O), Korean `ko` (P), Chinese Simplified `zh` (Q),
  Chinese Traditional `zh-TW` (R), Urdu `ur` (S), Vietnamese `vi` (T), Indonesian `id` (U), Thai `th` (V),
  Turkish `tr` (W), Hindi `hi` (X).
- Status categories, **graded on translation, not on key presence** (the percentage behind each cell is
  in the workbook's `Translation Coverage` sheet, produced by `scripts/i18n-translation-coverage.js`):
  - `Pass`: at least 80% of the dictionary keys the page uses (its file and imported components) are translated.
  - `Partial`: 20–79% translated.
  - `Untranslated`: under 20% translated.
  - `N/A`: redirect stubs, removed routes, or pages with no localizable text.
- As of the 2026-09-25 re-audit, 101 pages are graded and 12 are N/A. Pass counts: `fr`/`ko`/`zh`/`zh-TW` 91,
  `th` 88, the Tier-2 languages 12–15 (most of their pages are Partial or Untranslated). **An earlier version
  of this paragraph reported 100 Pass in every language; that counted key presence, which the English copies
  in the Tier-2 dictionaries make meaningless.** Whenever a new page or route is added, add it to the
  spreadsheet and regrade with the script.

## 6. Known-affected inventory — complete, sourced and re-audited, not a sample

> **Superseded three times over — read this note before trusting the table
> below.** Every row was the gap inventory _before_
> `adhoc-locale-i18n-compliance.migration-order.md` closed it out
> (2026-09-01, 5 stacks, 23 files). That in turn was superseded by the
> **2026-09-03 site-wide audit** (18 batches, ~130 files), and subsequently by the
> **2026-09-25 16-language site-wide audit across all 113 pages** (tracked in
> `docs/files-completion-list/davintrade-ui-page.xlsx`, Columns `H`–`W`).
> As of 2026-09-25, all 113 pages in the repository are accounted for and **graded on translation**.
> Of these, 101 are graded and 12 are N/A. Pages passing: `fr`/`ko`/`zh`/`zh-TW` 91, `th` 88, and
> 12–15 for the Tier-2 languages. See §5 Step 5 and the workbook's `Translation Coverage` sheet. An
> earlier version of this note said 100 Pass in all 16 languages, which counted key presence.
> The table below is preserved as an immutable historical record of the original 5 stacks.
> **`components/auth/social-auth-buttons.tsx`**
> was flagged out of the 2026-09-03 audit's approved scope but fixed
> same-day as an ad-hoc follow-up (public pre-login page, no click-through
> needed — live-verified in French, zero console errors). **The one real
> residual gap as of 2026-09-03**: authenticated click-through verification
> for the large majority of newly-wired pages was not performed (Executor
> never enters credentials) — see `CLAUDE.md`'s "Waiting on" section for
> the current
> list of pages needing Davin's own pass.

**Where this list comes from:** every file below is drawn directly from the
"Files changed" table in each stack's own manifest-work-completion.md (the
authoritative build record for each of the 5 recently-built stacks — see
§7 for exact paths), filtered to files that render user-facing text, then
individually re-audited on 2026-09-01 with:

```bash
grep -L "useLocale\|getServerLanguage\|getDictionary" <file>
```

This means **Antigravity/Claude Code does not need to re-derive this list
from scratch or ask Davin to enumerate pages** — it's already the complete
frontend-file set from all 5 manifests, cross-checked against live code.
The only reason to re-run §5's audit before executing is to catch anything
that landed in the repo _after_ 2026-09-01.

**Severity key:** 🔴 CRITICAL (blocks the control itself, see §0) · 🟠 no
locale wiring at all (§3 failure modes A/B) · 🟢 verified correct
(reference example, not a gap).

| Stack                      | File                                                        | Status        | Notes                                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(system-wide)_            | `app/settings/language/page.tsx`                            | 🔴 CRITICAL   | §0 — saves to DB, never reaches `LocaleProvider`; standalone `fr`/`zh` options have no dictionary                                                             |
| _(system-wide, reference)_ | `components/layout/app-header.tsx`                          | 🟢 correct    | The only file that calls `setCountryCode`/`setLocalePreferences` — copy this pattern                                                                          |
| BI Dashboards              | `components/admin/analytics/kpi-summary-card.tsx`           | 🟠 A          | No `useLocale`                                                                                                                                                |
| BI Dashboards              | `components/admin/analytics/ranked-country-table.tsx`       | 🟠 A          | No `useLocale`                                                                                                                                                |
| BI Dashboards              | `components/admin/analytics/tax-threshold-gauge.tsx`        | 🟠 A          | No `useLocale`                                                                                                                                                |
| BI Dashboards              | `components/admin/analytics/donut-market-share.tsx`         | 🟠 A          | No `useLocale`                                                                                                                                                |
| BI Dashboards              | `components/admin/analytics/historical-trend-chart.tsx`     | 🟠 A          | No `useLocale`                                                                                                                                                |
| BI Dashboards              | `components/admin/analytics/top-affiliates-leaderboard.tsx` | 🟠 A          | No `useLocale`                                                                                                                                                |
| BI Dashboards              | `components/admin/analytics/timeframe-filter.tsx`           | 🟠 A          | No `useLocale`                                                                                                                                                |
| BI Dashboards              | `app/admin/dashboards/layout.tsx`                           | 🟠 B          | No `getServerLanguage`/`getDictionary`                                                                                                                        |
| BI Dashboards              | `app/admin/dashboards/dashboard-tabs.tsx`                   | 🟠 A          | Client component, no `useLocale`                                                                                                                              |
| BI Dashboards              | `app/admin/dashboards/page.tsx`                             | 🟠 B          | Redirect stub — low priority, minimal text                                                                                                                    |
| BI Dashboards              | `app/admin/dashboards/revenue/page.tsx`                     | 🟠 B          | No `getServerLanguage`/`getDictionary`                                                                                                                        |
| BI Dashboards              | `app/admin/dashboards/users/page.tsx`                       | 🟠 B          | No `getServerLanguage`/`getDictionary`                                                                                                                        |
| BI Dashboards              | `app/admin/dashboards/regional/page.tsx`                    | 🟠 B          | No `getServerLanguage`/`getDictionary`; also has money figures — check §4 before wiring `formatCurrency`                                                      |
| BI Dashboards              | `app/admin/dashboards/affiliates/page.tsx`                  | 🟠 B          | No `getServerLanguage`/`getDictionary`                                                                                                                        |
| BI Dashboards              | `app/admin/dashboards/executive/page.tsx`                   | 🟠 B          | No `getServerLanguage`/`getDictionary`                                                                                                                        |
| BI Dashboards              | `app/affiliate/leaderboard/page.tsx`                        | 🟠 B          | Public-facing page, no locale wiring                                                                                                                          |
| Tax Invoicing              | `components/billing/invoice-list.tsx`                       | 🟠 A          | Hardcoded `$`, hand-built VAT string, "Reverse charge — 0% VAT" literal                                                                                       |
| Tax Invoicing              | `app/settings/billing/page.tsx`                             | 🟠 A          | Passes tax fields through to `InvoiceList`, own text also unwired                                                                                             |
| Affiliate Commission       | `components/affiliate/commission-table.tsx`                 | 🟠 A          | `date-fns` `format()`, no currency/text localization                                                                                                          |
| Affiliate Commission       | `app/affiliate/dashboard/commissions/page.tsx`              | 🟠 A          | No `useLocale`                                                                                                                                                |
| Affiliate Commission       | `app/admin/affiliates/[id]/page.tsx`                        | 🟠 A          | No `useLocale`                                                                                                                                                |
| DavinTrade Academy         | `app/admin/tutorials/page.tsx`                              | 🟠 A/B        | Admin CRUD console, English-only throughout                                                                                                                   |
| DavinTrade Academy         | `app/(marketing)/academy/page.tsx`                          | 🟠 B          | Hardcoded `metadata`, hardcoded `CATEGORY_LABELS`                                                                                                             |
| DavinTrade Academy         | `app/(marketing)/academy/[id]/page.tsx`                     | 🟠 B          | No `getServerLanguage`/`getDictionary`                                                                                                                        |
| DavinTrade Academy         | `components/marketing/marketing-navbar.tsx`                 | 🟢 correct    | Already calls `useLocale()`/`t()` — the one nav-link addition didn't regress this                                                                             |
| UAE/dLocal + Arabic        | `components/payments/CountrySelector.tsx`                   | 🟠 unverified | Extended (not new) for `AE`; re-check — no locale-hook match found this pass                                                                                  |
| UAE/dLocal + Arabic        | `components/payments/PaymentMethodSelector.tsx`             | 🟠 unverified | Extended (not new) for `AE`; re-check                                                                                                                         |
| UAE/dLocal + Arabic        | `components/payments/PriceDisplay.tsx`                      | 🟠 unverified | Extended (not new) for `AE`; re-check — likely uses its own currency-symbol map (per `CLAUDE.md`'s 2026-08-30 entry) rather than `formatCurrency()`           |
| UAE/dLocal + Arabic        | _(the rest of this stack)_                                  | 🟢 correct    | `lib/i18n/dictionaries/ar.json`, RTL wiring, `AE` GeoIP bundle — cite as the template for closing dictionary gaps (curated-partial coverage, not full parity) |

**23 files need work** (1 critical control-path bug + 22 unwired UI files),
**2 confirmed correct** (cite as reference patterns), **3 flagged unverified**
(payments components extended for `AE` — audit showed no hook match, but
they may format currency via a different, pre-existing mechanism worth
checking directly before assuming they're broken).

## 7. Cross-references

- [`language_timezone_regional_format_spec.md`](../../davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/language_timezone_regional_format_spec.md) — original architecture hand-off, full dictionary/middleware/country-config detail.
- [`LANGUAGE_TIMEZONE_REGIONAL_FORMAT_COMPLETION_REPORT.md`](../../davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/LANGUAGE_TIMEZONE_REGIONAL_FORMAT_COMPLETION_REPORT.md) — server-side `UserPreference`/GeoIP work.
- `docs/migration-orders/LESSONS-LEARNED.md` **L22** (order/finding text is a floor not a ceiling — grep the pattern before declaring a spot-fix complete) and **L40** (`LocaleProvider`'s real `fetch()` in tests).
- `CLAUDE.md`'s 2026-08-30 UAE/dLocal/Arabic ad-hoc entry — the one recent session that _did_ wire a new surface into the locale system correctly; use its ~205-curated-key partial-dictionary approach as the template for closing gaps found here.
- `CLAUDE.md`'s 2026-09-03 ad-hoc entry — the full 18-batch site-wide audit this document's §5/§6 were updated from; the authoritative batch-by-batch record (files touched, dictionary growth, real bugs found, deferred items) for the session that closed the large majority of the gap this document exists to catch.

### §6's source documents — the 5 manifests §6's inventory was built from

Each has its own "## 2. Files changed" table with the exact file list and
change description; read these directly for any file whose purpose isn't
obvious from §6 alone, or if new files have landed in a stack since this
document's last verification date (§8):

- [`davintrade-dashboard-stack/business-intelligence-dashboard-and-vat-threshold-manifest-work-completion.md`](../../davintrade-dashboard-stack/business-intelligence-dashboard-and-vat-threshold-manifest-work-completion.md)
- [`davintrade-uae-dlocal-and-arabic-support-stack/uae-dlocal-and-arabic-support-manifest-work-completion.md`](../../davintrade-uae-dlocal-and-arabic-support-stack/uae-dlocal-and-arabic-support-manifest-work-completion.md)
- [`davintrade-vat-and-affiliate-commission-stack/tax-invoicing-manifest-work-completion.md`](../../davintrade-vat-and-affiliate-commission-stack/tax-invoicing-manifest-work-completion.md)
- [`davintrade-vat-and-affiliate-commission-stack/affiliate-commission-issues-fix-manifest-work-completion.md`](../../davintrade-vat-and-affiliate-commission-stack/affiliate-commission-issues-fix-manifest-work-completion.md)
- [`davintrade-education-stack/davintrade-academy-manifest-work-completion.md`](../../davintrade-education-stack/davintrade-academy-manifest-work-completion.md)

## 8. Verification log

Keep this current — it's what tells the next reader (human or AI) whether
§6's inventory is still trustworthy as-is or needs a re-audit first.

| Date       | What was verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | By                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 2026-09-01 | §0 traced end-to-end (`app/settings/language/page.tsx` → `handleSave` → `PUT /api/user/preferences` → nothing reads it back; `resolvePreferences()` signature confirmed to have no DB/session parameter; `app-header.tsx` confirmed as the only `setCountryCode`/`setLocalePreferences` call site via `grep -rl`). §6's full file list extracted from all 5 manifests' own "Files changed" tables and individually re-grepped for `useLocale`/`getServerLanguage`/`getDictionary`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Claude Code, ad-hoc session (not a numbered migration-order session)                                               |
| 2026-09-01 | `docs/migration-orders/adhoc-locale-i18n-compliance.migration-order.md` executed end to end, 5 batches, 5 commits. All 23 gap rows in §6 (plus the 3 flagged-unverified payments rows) now call `useLocale()`/`getServerLanguage()`+`getDictionary()` — re-verified individually, not just via the diff-scoped audit script (`app/admin/dashboards/page.tsx`, a zero-text redirect stub, deliberately left as the one exception). Repo-wide `tsc --noEmit` clean (monolith, `money-service`, `operation-service` — the latter two untouched); full monolith `npm run test:ci` **165/165 suites, 2382/2382 tests**, exact match to the pre-session baseline. Curated `ar`/`th` translations added for ~250 new dictionary keys across the 5 stacks; `en-GB`/`en-US` rely on the existing key-as-fallback convention except where Batch 1 added explicit identity entries. Live-verified in a real browser: `/affiliate/leaderboard` and `/academy` + `/academy/[id]` (the only fully public surfaces among the 5) render correctly in Arabic with `dir="rtl"`, zero console/server errors; the other surfaces (`/settings/language`, `/settings/billing`, `/admin/dashboards/*`, `/affiliate/dashboard/commissions`, `/admin/affiliates/[id]`, `/admin/tutorials`, `/checkout`) are all auth-gated and confirmed to compile and redirect cleanly for an unauthenticated visitor only — full authenticated click-through was not performed (the Executor does not enter credentials, per standing policy), matching this repo's own established handling of the same boundary in the BI-dashboard and Academy ad-hoc sessions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Claude Code, ad-hoc session (`adhoc-locale-i18n-compliance.migration-order.md`)                                    |
| 2026-09-03 | Full 18-batch site-wide audit — triggered by Davin reporting the France/South Korea + French/Korean/Chinese work shipped earlier the same day "failed to propagate throughout web app," diagnosed to a much larger pre-existing gap (only 31/100 `page.tsx` files, ~28/48 components wired at the start of this session) than the single-day feature that surfaced it. Davin explicitly chose full site-wide scope over a narrow fix. 18 batches, 18 commits, one per batch, covering the large majority of `app/`'s page tree and `components/`'s shared feature components (~130 files) — full batch list in `CLAUDE.md`'s 2026-09-03 ad-hoc entry. `tsc --noEmit` and `npx eslint` clean after every batch; full `npm run test:ci` run after every batch, **166/166 suites · 2390/2390 tests held constant, zero regressions, across all 18 checkpoints**. Dictionary growth: `en-US`/`en-GB` 2,281 → 4,040 keys (+1,759); `fr`/`ko`/`zh` ~94 → 1,964 keys each (+~1,870 each), every key's translated-set-vs-missing-set diff verified empty before applying, per §5 Step 2. **Confirmed §3's Failure mode C live in production code three independent times** (not merely the original spec's documented precedent) — see §3's updated note. Found and fixed 5 real non-locale bugs along the way (two more `t(key,'X').replace('X','Y')` nonsense-reuse hacks; a `date-fns`-vs-`formatDate()` real date-format change with test assertions updated to match, not loosened; two local ad-hoc `formatCurrency` helpers doing no real conversion, replaced with the shared one; 5 genuinely un-wired hardcoded error strings in `register-form.tsx`; a landing-page pricing card whose own advertised "Multi-Currency Local Checkout" line never actually applied to the price shown two lines above it). Fixed ~20+ pre-existing test files for the L40 LocaleProvider-wrap pattern and 3 for the `next/headers`-outside-request-scope pattern (§5 Step 4). **Authenticated click-through not performed** for the large majority of newly-wired pages (Executor never enters credentials) — flagged in `CLAUDE.md`'s "Waiting on" section, not silently skipped. `components/auth/social-auth-buttons.tsx` deliberately left unwired — shared by login/register but outside this session's approved 18-batch scope.                                                   | Claude Code, ad-hoc session (18-batch site-wide locale audit, not a numbered migration-order session)              |
| 2026-09-18 | Public marketing chrome (navbar/footer/hero/features/pricing card/tier-comparison/ticker): full translation coverage. Triggered by Davin's own screenshots of `davintrade.app` in Korean (navbar entirely English), Japanese, and Thai (both missing exactly `Academy`/`EconNews`/`Language`, added to the navbar in later sessions than those dictionaries' own last edit). Two root causes: `marketing-navbar.tsx`'s bare-literal `t()` keys had zero coverage in `fr`/`ko`/`zh`/`zh-TW` (a gap this table's own 2026-09-03 row already flagged and never closed); and a structural staleness gap where a key added to an already-"done" dictionary's component silently stays in English forever, since nothing re-checks a prior pass's coverage. Extracted all 109 `t()` keys from the full public marketing surface (not just the navbar) and checked all 17 dictionaries directly -- found 548 missing entries total (`ar` alone missing 85/109). Davin chose full 17-language coverage over a narrower fix. Added curated translations for all 548, keeping `DavinTrade`/ticker symbols/`PRO`/`FREE` in Latin script and `Gold Trade` as an identity mapping (confirmed brand-style via every dictionary that already had it). Verified: 0/109 missing across all 17 dictionaries on re-extraction; `tsc --noEmit` clean; full `test:ci` **220/220 suites, 2881/2881 tests**. Not verified live in a browser -- needs Davin's own click-through.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Claude Code, ad-hoc session (public marketing chrome translation coverage, not a numbered migration-order session) |
| 2026-09-18 | Fixed a real gap found live by Davin's own screenshots (`davintrade.app` in Traditional Chinese): the marketing-chrome session's own extraction script was structurally blind to `landing-features.tsx`'s 4 feature cards, whose title/description/badge are stored in a `features` array and rendered via `t(item.title)`/`t(item.badge)`/`t(item.description)` — a variable property reference, not a literal `t('...')` call the regex can match. Confirmed via grep that this pattern is isolated to this one file across the whole 2026-09-18 session's scope. Translated the 12 affected keys (4 cards × 3 fields) into `fr`/`ko`/`zh`/`zh-TW`/`ar` (`th`/`en-US`/`en-GB` already had them from an earlier, unrelated pass, which is why Thai rendered correctly while Chinese didn't). `§5` Step 2's own "two things this misses" caveat now names this concrete instance and adds a grep pattern (`t\(\s*[a-zA-Z_]\w*\.[a-zA-Z_]`) to catch it mechanically rather than relying on remembering to "walk it by hand." Verified: `tsc --noEmit` clean; JSON validity checked on all 5 edited dictionaries. Not re-verified live in a browser — needs Davin's own click-through. Commit `84b72453`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Claude Code, ad-hoc session (landing-features translation gap, not a numbered migration-order session)             |
| 2026-09-18 | Follow-on audit-and-remediation pass covering everything built or extended since the 2026-09-03 close (§6's table is not re-dated below; see this row instead). Since the working tree was clean, ran §5 Steps 1/3 against the live `app/`/`components/` tree rather than a diff. **Found 18 genuinely non-compliant files** (all confirmed by direct read before fixing, several other grep hits checked and confirmed already-correct per §2.C/§4 rather than false-positived in): the entire Currency Index PRO cluster (9 files, Failure mode A — zero `useLocale()` anywhere, including the Overbought/Oversold/Extreme titles drawn on the lightweight-charts canvas); the drawing toolbar `Toolbar.tsx` (same gap, every button's aria-label/title); `PlanSelector.tsx`/`register-form.tsx`/`notification-list.tsx` (already called `useLocale()` elsewhere but still hardcoded `$${x.toFixed(2)}` or a local `toLocaleDateString('en-US', ...)` for one specific figure — the exact §2.C anti-pattern); 6 admin affiliate pages with local ad-hoc `formatCurrency`/`formatDate` helpers despite `useLocale()` already in scope. A real bug surfaced by a test failure, not inspection: adding `t` to a chart effect's own dependency array double-drew the corridor price lines on first mount, because `t`'s identity changes when `LocaleProvider` reconciles `localStorage` after the initial SSR-preferences render. **Two pre-existing tests broke on L40** (`trading-advisory-banner.test.tsx`, `toolbar.test.tsx`), fixed with the established pattern; `PlanSelector.test.tsx`'s raw-USD price assertions updated to the real converted output per §5 Step 4. 58 new dotted keys given curated translations in the 8 actively-maintained dictionaries (`en-US`/`en-GB`/`fr`/`ko`/`zh`/`zh-TW`/`ar`/`th`); the 9 legacy dictionaries left untouched, degrading safely per §2.C. `npx tsc --noEmit` clean; `npx eslint` clean; full `npm run test:ci` **220/220 suites · 2881/2881 tests**, run three times, zero regressions. **Authenticated click-through not performed** (Executor never enters credentials) — needs Davin's own pass on `/pro/currency-index`, the drawing toolbar, and the 6 admin affiliate report pages in a non-English locale. Full account: `CLAUDE.md`'s 2026-09-18 locale/i18n audit entry. Committed and pushed in 6 commits. | Claude Code, ad-hoc session (locale/i18n compliance audit and remediation, not a numbered migration-order session) |
| 2026-09-25 | Full 16-language localization audit and remediation across all 113 pages in DavinTrade Web App (`davintrade-ui-page.xlsx` Columns `H`–`W`). Identified and resolved **Failure Mode D** (SSR language dropout bug in `lib/i18n/locale-resolver.ts` where non-country languages `zh`, `zh-TW`, `es`, `pt` dropped to `en-GB` on reload); preserved Claude Code's test invariant that languages with no country keep existing date/currency formats unchanged (`preferencesForLanguage` returns `null`). Reconciled historical two-branch translation drift, achieving **100% key parity across all 17 dictionaries** (4,710 keys each, covering 2,600/2,600 active page keys). Wired `app/upgrade/success/page.tsx` (Failure Mode E) with `useLocale()` and created L40-compliant test suite (`__tests__/pages/checkout/upgrade-success.test.tsx`). Verified non-regression: all 6 Claude Code test suites + new tests passed (**7 suites, 47/47 tests passed**); TypeScript compiler clean (**`npx tsc --noEmit` exit code 0**). Recorded in `davintrade-16-language-localization-remediation/16-language-localization-remediation-manifest-work-completion.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Antigravity AI, 16-language localization remediation session                                                       |
| 2026-09-25 | Re-audit of the row above, before commit. **Corrected four problems.** (1) Security: the Failure mode D fix passed any `davintrade-locale` cookie value through as the language, and `app/layout.tsx` interpolated it unescaped into an inline script; a crafted cookie executed as script (reproduced on `next dev`). Now `resolvePreferences()` and `LocaleProvider` accept only `SUPPORTED_LANGUAGES` codes, and the inline script JSON-encodes its values and validates the localStorage language before copying it to the cookie. (2) Truncated text: the extractor cut 4 fallbacks at an apostrophe (`admin.view_as.subtitle` → "Open any affiliate", `academy.admin.invalid_youtube_url` → "Doesn", plus 2 view-as titles), and reworded 4 payment messages; restored in all 17 dictionaries, with fr/ko/zh/zh-TW/th/ar retranslated from the full text. (3) Tests: full `test:ci` was 240/242 suites · 3092/3099 tests (the row above ran 7 targeted suites); `PriceDisplay` was fixed by (2), `commission-table.test.tsx` updated for the now-translated status badges; after the re-audit **242/242 · 3110/3110**, mutation 5/5 killed. (4) The 100%-Pass matrix counted key presence; regraded on translation with the new `scripts/i18n-translation-coverage.js` (§5 Steps 2 and 5). Also: Hindi added to `SUPPORTED_LANGUAGES` (India's header country set it, and the Settings dropdown showed blank) and as column X; `<html dir="rtl">` now server-rendered for `ar`/`ur`; §2.B's snippet (stale `exchangeRate` argument), §2.C, §4 and §5 Step 5's column map corrected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Claude Code, ad-hoc re-audit (same day)                                                                            |
| 2026-09-25 | Round 2, same day: **Failure mode F**. Server-rendered parts, cached layouts included, kept the old locale until a refresh (Davin's `/admin` screenshots: Thai body, Korean sidebar). `LocaleProvider` now syncs the locale cookies through a Server Action (`app/actions/locale.ts`), which re-renders the current route and clears the client's cached routes. The currency-index chart's canvas band titles now redraw on a language change. Verified live on `next dev` with no reload: the `/academy` heading and tab title, back-navigation to a cached page, and a `/status` date/time format. Full suite **243/243 · 3123/3123**; mutation 4/4 killed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Claude Code, ad-hoc round 2 (same day)                                                                             |
| 2026-09-26 | Round 3: Davin set the translation scope (compulsory: public, auth and FREE/PRO pages; encouraged: affiliate; not required: admin) after seeing `/admin` stay English in Japanese (`ja.json` held English copies). Wired text that bypassed the dictionaries (zod messages, payment/country/currency names, `/status`, tab titles, the HRMA/SMMA window, error pages, chat widget), fixed English-only date/duration formatting, translated every compulsory key in all 15 non-English languages, and added `scripts/i18n-identical-ok.json` plus the guard test `compulsory-translation-coverage.test.ts`. Full suite **244/244 · 3139/3139**; mutation 4/4 killed; live Japanese check of `/login`, `/status`, `/blog` on `next dev`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Claude Code, ad-hoc round 3                                                                                        |
| 2026-09-26 | Round 5: **live exchange rates.** `formatCurrency()`/`formatCurrencyAmount()` converted at the fixed `CURRENCY_USD_RATES` while dLocal charged at the live exchangerate-api.com rate, so `/pricing` and the dLocal charge could disagree. Davin chose option 1: new `lib/fx/usd-rates.ts` holds one hourly table shared by dLocal and every display (root layout → `LocaleProvider`, refreshed from `GET /api/fx/rates`; server pages pass `rates`); fixed rates are now only the fallback. New rule in §4: a converted price next to a way to pay carries a note that it is approximate and names the USD card charge (`pricing.approx_note`, `checkout.card_charged_usd`, all 17 dictionaries). Full `test:ci` **247/247 · 3172/3172**; mutation 3/3 killed; live `next dev`: `/pricing` £21.90 at GBP 0.755 (fixed: £22.62) with the note, Thai ฿968.02 (29 × 33.38) with the Thai note. §2.B, §2.C and §4 updated. Full account: `davintrade-systemconfig/systemconfig-fix-manifest-work-completion.md` §10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Claude Code, ad-hoc (option 1 approved by Davin)                                                                   |
