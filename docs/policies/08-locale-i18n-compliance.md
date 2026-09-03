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

**Status:** Live document — verified against the codebase as of 2026-09-03.

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
> browser verification of everything else.

**Supersedes nothing; complements:**
[`davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/language_timezone_regional_format_spec.md`](../../davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/language_timezone_regional_format_spec.md)
(the original architecture hand-off) and its
[completion report](../../davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/LANGUAGE_TIMEZONE_REGIONAL_FORMAT_COMPLETION_REPORT.md)
(the server-side preferences API). Those two describe how the system was
**built**; this one describes why new code keeps **not using it**, and how
to fix that, generically, every time.

---

## 0. CRITICAL — the Settings → Language page saves to the database, but nothing ever reads that back. It has zero effect on the running app.

Traced end to end, not assumed:

1. **[`app/settings/language/page.tsx`](../../app/settings/language/page.tsx)** is a fully self-contained implementation with its own standalone `languages`/`timezones`/`currencies` arrays (lines 39–75) — entirely disconnected from `lib/country-config.ts`'s `SUPPORTED_COUNTRIES`, the actual source of truth every other part of the system uses. Two of its nine language options, `fr` and `zh`, have **no dictionary file at all** in `lib/i18n/dictionaries/` — selecting either would silently degrade to English forever even if the rest of this bug were fixed.
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

Also replace the standalone `languages` array with one derived from `SUPPORTED_COUNTRIES`/`lib/country-config.ts` (or at minimum drop `fr`/`zh`, which have no backing dictionary) so the page can't offer a selection the rest of the system silently can't honor.

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
import { getCountryByCode, formatCurrencyAmount } from '@/lib/country-config';

const prefs = await getServerLocalePreferences(); // { language, countryCode, currency, ... }
const exchangeRate = getCountryByCode(prefs.countryCode).exchangeRate;
const usd = (amountInUSD: number): string =>
  formatCurrencyAmount(amountInUSD, {
    currency: prefs.currency,
    exchangeRate,
    language: prefs.language,
  });
// usd(commission.amount) — same USD-input contract as formatCurrency(), see §4
```

### 2.C Supporting pieces

- **13 dictionaries**: `en-GB`, `en-US`, `th`, `de`, `es`, `ja`, `hi`, `vi`,
  `id`, `tr`, `ur`, `pt`, `ar` in
  [`lib/i18n/dictionaries/`](../../lib/i18n/dictionaries/). Client bundles
  `en-GB`/`en-US`/`th` synchronously, lazy-loads the rest; server loads all
  13 eagerly (no bundle-size concern server-side).
- **Two key conventions coexist by design** (do not normalize one into the
  other): most keys are the literal English string itself
  (`t('Some English Text')`), a smaller set are dot-namespaced
  (`t('nav.dashboard', 'Dashboard')`) for structured chrome.
- **A partial dictionary degrades safely, never breaks**: `t()` falls back
  to its own `fallback` param or the raw key; `getDictionary()` falls back
  to `en-GB` wholesale if a language key is missing entirely. This is why
  the UAE/Arabic session (`CLAUDE.md`, 2026-08-30) could ship translating
  only ~205 of `en-US.json`'s ~2,270 keys rather than full parity — **that
  same partial-coverage strategy is the intended, sanctioned way to close
  gaps found via this document's audit (§5), not a reason to skip fixing
  them.**
- **`formatCurrency()` converts, it does not just format**: it multiplies
  the USD input by `countryConfig.exchangeRate` (a static, documented-
  approximate table in `lib/country-config.ts`) and formats in the user's
  currency. Feeding it an amount already in a non-USD currency silently
  double-converts. See §4.
- **RTL**: `document.documentElement.dir` is set to `rtl` for `ar`/`ur` by
  `LocaleProvider`'s own effect — automatic once the provider is mounted
  and the language is set; no per-component work needed for direction, only
  for text content.
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

## 4. The one real gotcha: `formatCurrency()` expects USD

`formatCurrency(amountInUSD: number)` multiplies by the country's
`exchangeRate` — it is a **convert-and-format** function, not a
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

## 6. Known-affected inventory — complete, sourced and re-audited, not a sample

> **Superseded twice over — read this note before trusting the table
> below.** Every row was the gap inventory _before_
> `adhoc-locale-i18n-compliance.migration-order.md` closed it out
> (2026-09-01, 5 stacks, 23 files). That in turn was superseded by the
> **2026-09-03 site-wide audit** (18 batches, ~130 files — the large
> majority of `app/`'s page tree and `components/`'s shared feature
> components; full batch-by-batch detail in `CLAUDE.md`'s 2026-09-03
> ad-hoc entry, not duplicated here to avoid two copies drifting apart).
> The 🔴/🟠 markers below are frozen as they were found on 2026-09-01 —
> every file in this table is now wired. **`components/auth/social-auth-buttons.tsx`**
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

| Date       | What was verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | By                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-09-01 | §0 traced end-to-end (`app/settings/language/page.tsx` → `handleSave` → `PUT /api/user/preferences` → nothing reads it back; `resolvePreferences()` signature confirmed to have no DB/session parameter; `app-header.tsx` confirmed as the only `setCountryCode`/`setLocalePreferences` call site via `grep -rl`). §6's full file list extracted from all 5 manifests' own "Files changed" tables and individually re-grepped for `useLocale`/`getServerLanguage`/`getDictionary`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Claude Code, ad-hoc session (not a numbered migration-order session)                                  |
| 2026-09-01 | `docs/migration-orders/adhoc-locale-i18n-compliance.migration-order.md` executed end to end, 5 batches, 5 commits. All 23 gap rows in §6 (plus the 3 flagged-unverified payments rows) now call `useLocale()`/`getServerLanguage()`+`getDictionary()` — re-verified individually, not just via the diff-scoped audit script (`app/admin/dashboards/page.tsx`, a zero-text redirect stub, deliberately left as the one exception). Repo-wide `tsc --noEmit` clean (monolith, `money-service`, `operation-service` — the latter two untouched); full monolith `npm run test:ci` **165/165 suites, 2382/2382 tests**, exact match to the pre-session baseline. Curated `ar`/`th` translations added for ~250 new dictionary keys across the 5 stacks; `en-GB`/`en-US` rely on the existing key-as-fallback convention except where Batch 1 added explicit identity entries. Live-verified in a real browser: `/affiliate/leaderboard` and `/academy` + `/academy/[id]` (the only fully public surfaces among the 5) render correctly in Arabic with `dir="rtl"`, zero console/server errors; the other surfaces (`/settings/language`, `/settings/billing`, `/admin/dashboards/*`, `/affiliate/dashboard/commissions`, `/admin/affiliates/[id]`, `/admin/tutorials`, `/checkout`) are all auth-gated and confirmed to compile and redirect cleanly for an unauthenticated visitor only — full authenticated click-through was not performed (the Executor does not enter credentials, per standing policy), matching this repo's own established handling of the same boundary in the BI-dashboard and Academy ad-hoc sessions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Claude Code, ad-hoc session (`adhoc-locale-i18n-compliance.migration-order.md`)                       |
| 2026-09-03 | Full 18-batch site-wide audit — triggered by Davin reporting the France/South Korea + French/Korean/Chinese work shipped earlier the same day "failed to propagate throughout web app," diagnosed to a much larger pre-existing gap (only 31/100 `page.tsx` files, ~28/48 components wired at the start of this session) than the single-day feature that surfaced it. Davin explicitly chose full site-wide scope over a narrow fix. 18 batches, 18 commits, one per batch, covering the large majority of `app/`'s page tree and `components/`'s shared feature components (~130 files) — full batch list in `CLAUDE.md`'s 2026-09-03 ad-hoc entry. `tsc --noEmit` and `npx eslint` clean after every batch; full `npm run test:ci` run after every batch, **166/166 suites · 2390/2390 tests held constant, zero regressions, across all 18 checkpoints**. Dictionary growth: `en-US`/`en-GB` 2,281 → 4,040 keys (+1,759); `fr`/`ko`/`zh` ~94 → 1,964 keys each (+~1,870 each), every key's translated-set-vs-missing-set diff verified empty before applying, per §5 Step 2. **Confirmed §3's Failure mode C live in production code three independent times** (not merely the original spec's documented precedent) — see §3's updated note. Found and fixed 5 real non-locale bugs along the way (two more `t(key,'X').replace('X','Y')` nonsense-reuse hacks; a `date-fns`-vs-`formatDate()` real date-format change with test assertions updated to match, not loosened; two local ad-hoc `formatCurrency` helpers doing no real conversion, replaced with the shared one; 5 genuinely un-wired hardcoded error strings in `register-form.tsx`; a landing-page pricing card whose own advertised "Multi-Currency Local Checkout" line never actually applied to the price shown two lines above it). Fixed ~20+ pre-existing test files for the L40 LocaleProvider-wrap pattern and 3 for the `next/headers`-outside-request-scope pattern (§5 Step 4). **Authenticated click-through not performed** for the large majority of newly-wired pages (Executor never enters credentials) — flagged in `CLAUDE.md`'s "Waiting on" section, not silently skipped. `components/auth/social-auth-buttons.tsx` deliberately left unwired — shared by login/register but outside this session's approved 18-batch scope. | Claude Code, ad-hoc session (18-batch site-wide locale audit, not a numbered migration-order session) |
