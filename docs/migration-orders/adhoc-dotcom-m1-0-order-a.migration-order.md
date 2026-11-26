# Migration Order — Ad-hoc (`M1.0` / Order A) — `.app` Public Contracts, `?lang=` Setter & Feature-Truth Cleanup

> **Context & Mandate:** First cross-repo foundation milestone (`M1.0`) for `davintrade.com` on the `davintrade.app` monolith (`trading-alerts-saas-public`). Implements Davin's settled decisions **`Q1`** (one-shot `?lang=` cookie setter) and **`Q3`** (feature-truth cleanup & live capability truth), plus `CR-03` / `ME-01` / `ME-08` public config and FX endpoints documented in `davintrade-dot-com/DAVINTRADE-DOT-COM-ARCHITECTURE.md` (`v3.1`) and `davintrade-dot-com/OWNER-DECISIONS-Q1-Q13.md`.
> Governed by `.claude/rules/non-negotiables.md`, `.claude/rules/i18n-compliance.md`, `docs/migration-orders/EXECUTOR-PROTOCOL.md`, and `docs/migration-orders/00-SKELETON-AND-RULES.md`.
> **Creativity dial: Low** — Existing `.app` billing, checkout, auth, and Stack D flag boundaries remain invariant; additive public API fields, one query-param cookie setter, and truthful feature removal only.
> **Status: EXECUTED** (Executor, 2026-11-26, in a pull request awaiting Davin's merge; confirmed with the amendments in _CONFIRM amendments_ below) — Produced by Advisor (Antigravity) from live code inspection on 2026-11-26 and explicitly approved (`APPROVED`) by Davin on 2026-11-26. Ready for Executor (Claude Code) to verify against live files (`CONFIRMED`) and execute.

**Session:** Ad-hoc (`M1.0` / Order A) · **Phase:** `davintrade.com` Phase 1 Prerequisite (`M1.0`) · **Variant:** CONTRACT / UI-CLEANUP · **Status:** EXECUTED  
**Generated:** 2026-11-26 (Advisor / Antigravity) · **Approved:** 2026-11-26 (Davin) · **Flags touched:** reads `isReplyEnabled` / Stack D flags read-only (no flag flips) · **Estimated time:** ~2–3h

---

## Decisions taken

> Judgment calls made by the Advisor per `00-SKELETON-AND-RULES.md` §1.0, grounded in live `.app` source files and existing Jest tests inspected on 2026-11-26. Items touching public pricing/terms, caching semantics, or locale routing carry **`⚠ NEEDS EXPLICIT SIGN-OFF`**.

1. **`GET /api/config/affiliate` Public Schema Extension & Fallback Cache Guard (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** Keep all 8 existing JSON fields unchanged (`discountPercent`, `commissionPercent`, `codesPerMonth`, `regularPrice`, `threeDayPrice`, `annualPrice`, `minimumPayoutUsd`, `lastUpdated`) and add: `schemaVersion: 1`, `source: 'live' | 'fallback'`, `trialDays` (`TRIAL_CONFIG.DURATION_DAYS` = `7`), `maxCommissionMonths` (`AFFILIATE_CONSTANTS.MAX_RECURRING_COMMISSION_MONTHS` = `24`), `codeExpiryDays` (`AFFILIATE_CONSTANTS.CODE_EXPIRY_DAYS` = `30`), `payoutMethod` (`'WISE'`), `payoutFrequency` (`'MONTHLY'`), `maxAlertsFree` (`FREE_TIER_CONFIG.MAX_ACTIVE_ALERTS` = `5`), `maxAlertsPro` (`PRO_TIER_CONFIG.MAX_ACTIVE_ALERTS` = `20`), `rateLimitFree` (`FREE_TIER_CONFIG.RATE_LIMIT_PER_MINUTE`), `rateLimitPro` (`PRO_TIER_CONFIG.RATE_LIMIT_PER_MINUTE`). Keep `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` ONLY when `source === 'live'`; set **`Cache-Control: no-store`** on the catch/`fallback` response so transient `<PROD_DB>` outages never populate CDN cache or overwrite `.com`'s last-good cache. Update `AffiliateConfig` interface in `lib/hooks/useAffiliateConfig.ts` and assertions in `__tests__/api/config-affiliate.test.ts` (still asserting zero exposure of `disbursement_enabled`, `disbursement_max_batch_size`, `affiliate_commission_approval_days`, or payout `provider` internals).
   - **Rejected:** Putting internal disbursement admin flags in `/api/config/affiliate`, or returning `200` with `s-maxage=300` on fallback errors.
   - **Why:** Verified `getDisbursementSettings()` in `app/api/config/affiliate/route.ts` must never leak operational/batch controls (checked by `__tests__/api/config-affiliate.test.ts:93-126`). Note: `payoutMethod` / `payoutFrequency` intentionally avoid the substring `'provider'` tested by `test.ts:121`.
   - **How hard to undo:** Low (single route + hook type + unit test).

2. **New `GET /api/config/capabilities` Endpoint (`status: 'live' | 'beta' | 'planned'`)**
   - **Chosen:** Create `app/api/config/capabilities/route.ts` returning `schemaVersion: 1`, `asOf` ISO timestamp, `tiers` snapshot (`symbols: SYMBOLS`, `timeframes: TIMEFRAMES`, `free: { maxActiveAlerts, maxWatchlistItems, rateLimitPerMinute }`, `pro: { maxActiveAlerts, maxWatchlistItems, rateLimitPerMinute, trialDays }`), and `capabilities` map with explicit `{ status: 'live' | 'beta' | 'planned', available: boolean }`, reading `isReplyEnabled(process.env)` from `lib/reply/server/flags.ts` (and checking `lib/intake/server/flags.ts` read-only) so `interactiveAiAnalyst` is `'planned'` (`available: false`) while `REPLY_ENABLED !== 'true'`, `dataExport` is `'planned'` (`available: false`), `prioritySupport` is `'planned'` (`available: false`), and core terminal/alerts/charts/dualModelPatternConfluence are `'live'` (`available: true`). Cache `public, s-maxage=300, stale-while-revalidate=60`.
   - **Rejected:** Letting `.com` hardcode tier/feature matrices or hit internal auth-guarded endpoints.
   - **Why:** Enforces Architecture D4 / Q3 live-only truth from `.app`'s real config & env flags without importing UI dictionaries into route handlers (`.claude/rules/i18n-compliance.md`).
   - **How hard to undo:** Low (standalone new route + unit test).

3. **`GET /api/fx/rates` CDN Cache Header Upgrade (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** Change `app/api/fx/rates/route.ts` `Cache-Control` from `'no-store'` to `'public, s-maxage=3600, stale-while-revalidate=300'` (update the header comment in `route.ts` and the assertion in `__tests__/lib/fx/public-rate-routes.test.ts:16-28`), while keeping `GET /api/payments/dlocal/convert` strictly **`'no-store'`**.
   - **Rejected:** Leaving `/api/fx/rates` uncacheable (`no-store`), or caching `/api/payments/dlocal/convert`.
   - **Why:** `/api/fx/rates` serves only public marketing/display rates already refreshed hourly on the server (`DAVINTRADE-DOT-COM-ARCHITECTURE.md` §4 D4 & §17); checkout quotes remain protected at `convert/route.ts` (`no-store`).
   - **How hard to undo:** Trivial (1 header line + 1 test assertion).

4. **`middleware.ts` One-Shot `?lang=` Cookie Setter (`Q1`) (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** In `middleware.ts`, BEFORE/WITHOUT disturbing `countryPrefix` routing: ONLY when the request has **no** supported `countryPrefix`, `pathname` is a page route (matcher already skips `/api/*` and static assets), and `request.nextUrl.searchParams.get('lang')` **exact-matches** `isSupportedLanguage(lang)` from `lib/i18n/languages.ts`: build a `NextResponse.redirect(cleanUrl, 307)` stripping ONLY the `lang` query param (preserving `from`, `ref`, `attr_id`, UTM params, etc.) and setting `LOCALE_COOKIE` (`'davintrade-locale'`) with `{ path: '/', maxAge: 31536000, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }` (matching `finishWithLocale()` attributes). Ignore unknown `lang` values and ignore `?lang=` on already-prefixed URLs (e.g., `/th/...`, `/eu/...`).
   - **Rejected:** Adding new URL country prefixes (`/es`, `/it`, `/zh`, `/pt`), changing `/eu` (`de`), or overriding `currency`/`timezone` cookies on `.app`.
   - **Why:** Exact implementation of Davin's `Q1` decision (`OWNER-DECISIONS-Q1-Q13.md` pp. 49–72) and `finishWithLocale()` (`middleware.ts:272-290`).
   - **How hard to undo:** Low (isolated helper in `middleware.ts` + dedicated middleware Jest spec).

5. **`.app` Feature-Truth & Privacy Export Cleanup (`Q3`) (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:**
     - In `components/pricing/tier-comparison.tsx`: remove `'Data Export'` (lines 91–95) and `'Priority Support'` (lines 96–100 + line 239 mention) completely; gate `'Interactive AI Analyst'` (lines 56–60 & lines 285–288) and `'Monthly AI Token Quota'` (lines 61–65) behind an explicit boolean prop (e.g., `aiAnalystEnabled?: boolean` defaulting `false`, fed cleanly from Server Component `app/(marketing)/pricing/page.tsx` reading `isReplyEnabled(process.env)` — making `app/(marketing)/pricing/page.tsx` read `process.env` cleanly on request or via a small wrapper without breaking client tests). Also inspect `components/landing/landing-pricing.tsx` lines 1–120 at CONFIRM time for any `'Priority Support'` / `'Data Export'` / `'Interactive AI Analyst'` strings (note: lines 121–218 use `'Multi-Model AI Confluence (Pro)'` and `'Dual AI Model Pattern Verification'`, which describe shipped chart pattern confluence, NOT Stack D Interactive AI Analyst).
     - In `app/settings/privacy/page.tsx`: remove the `setTimeout(..., 2000)` mock `handleDataExport` (lines 129–139) and fake `"Export Requested!"` success state (lines 272–307); replace with an honest `"Email us to request your data"` action linking via `<a href="mailto:privacy@davintrade.app?subject=...">` (matching `app/(marketing)/privacy/page.tsx:188` and the real `mailto:` remediation precedent in `app/settings/help/page.tsx`).
     - **i18n Compliance:** Either reuse existing keys across all 19 `lib/i18n/dictionaries/*.json` OR add any new keys across ALL 19 dictionaries with real non-English translations in the 17 non-English files, and prove green with `__tests__/lib/i18n/compulsory-translation-coverage.test.ts` (`i18n-compliance.md`).
   - **Rejected:** Keeping misleading "Coming Soon" / mock buttons or leaving English fallback literals untranslated in 17 dictionaries.
   - **Why:** Satisfies Q3 (`OWNER-DECISIONS-Q1-Q13.md` lines 112–116) while respecting `.app`'s enforced 19-locale dictionary CI check and preserving `__tests__/components/pricing/annual-plan.test.tsx`.
   - **How hard to undo:** Low (isolated component diffs).

6. **Parent Working-Tree Hygiene**
   - **Chosen:** Because `trading-alerts-saas-public` currently has concurrent uncommitted edits/untracked files outside `davintrade-dot-com` (including `MCD0`/`railway-gateway` WIP noted in `M0.2-report.md`), Claude Code must **NOT** use `git stash`, broad `git checkout/restore/reset`, or touch unrelated files, and must run targeted test suites + `pnpm run type-check` + targeted ESLint instead of assuming unrelated Stack D tests are clean (reporting any pre-existing unrelated failures clearly if a full suite runs).
   - **How hard to undo:** N/A (safety constraint).

---

## CONFIRM amendments (Davin, 2026-11-26, in chat) — these override the text below

- **A1 Tier figures:** publish live values — alerts Free `0` / Pro `100`. No rate-limit fields and no watchlist fields on either endpoint.
- **A2 Claim scope:** also fix `landing-pricing.tsx`, `app/settings/billing/page.tsx` and `app/upgrade/success/page.tsx` (19-locale text). E-mail (`subscription.pro6`) is a follow-up.
- **A3 AI status:** `live` only when `REPLY_ENABLED=true` **and** `REPLY_ALLOWED_USER_IDS` is unset; `beta` (`available: false`) while the allow-list is set; `planned` when off.
- **A4 `dualModelPatternConfluence`:** `planned`, `available: false` (no implementation found).
- **A5 Code expiry:** publish `codeExpiry: 'END_OF_ISSUE_MONTH'`; drop `codeExpiryDays`.
- **A6 Pricing rows:** say in-app alert notifications (not Email/Push); remove the Market Comments row and bullet.

---

## Entry criteria

_(Verify at CONFIRM time before editing any file)_

- [ ] Order status explicitly marked **`APPROVED`** by Davin (changed from `DRAFT` before execution).
- [ ] Run `git status --short` and `git branch --show-current` in `D:\SaaS Project\trading-alerts-saas-public`; record pre-existing modified/untracked files and verify zero unintended edits to `davintrade-dot-com/` exclusions.
- [ ] Re-read live files before editing:
  - `app/api/config/affiliate/route.ts`, `lib/hooks/useAffiliateConfig.ts`, `__tests__/api/config-affiliate.test.ts`
  - `app/api/fx/rates/route.ts`, `__tests__/lib/fx/public-rate-routes.test.ts`
  - `lib/affiliate/constants.ts`, `lib/tier-config.ts`, `packages/types/src/tier/constants.ts`, `lib/reply/server/flags.ts`, `lib/intake/server/flags.ts`
  - `middleware.ts`, `lib/i18n/languages.ts`, `lib/i18n/locale-resolver.ts`
  - `components/pricing/tier-comparison.tsx`, `components/landing/landing-pricing.tsx` (lines 1–120 too), `app/(marketing)/pricing/page.tsx`, `app/settings/privacy/page.tsx`, `app/upgrade/success/page.tsx` (check line 75 `'Priority Support & All Notifications'` — verify whether in-scope or flag if needed)
- [ ] Baseline check passes on our target suites (`npx jest __tests__/api/config-affiliate.test.ts __tests__/lib/fx/public-rate-routes.test.ts __tests__/components/pricing/annual-plan.test.tsx __tests__/lib/i18n/compulsory-translation-coverage.test.ts`).

---

## Ordered steps

### Step 0 — CONFIRM & Record Baseline

- Re-verify all files above match this order. If live code contradicts any assumption (e.g., another caller depends on removed `TierComparison` or `useAffiliateConfig` shape, or concurrent edits touch `middleware.ts` / `pricing`), STOP and ask Davin per `EXECUTOR-PROTOCOL.md`.
- Flip order header status to `CONFIRMED`.

### Step 1 — Extend `GET /api/config/affiliate` + Fallback No-Store Guard

- Edit `app/api/config/affiliate/route.ts`:
  - Import constants from `@/lib/affiliate/constants` (`AFFILIATE_CONSTANTS`), `@/lib/tier-config` (`FREE_TIER_CONFIG`, `PRO_TIER_CONFIG`), and `@/packages/types/src/tier/constants` or `@/lib/tier-config` (`TRIAL_CONFIG`).
  - Include `schemaVersion: 1`, `source: 'live'` on DB success (`Cache-Control: public, s-maxage=300, stale-while-revalidate=60`), and `source: 'fallback'` on DB error (`Cache-Control: no-store`).
  - Add non-secret public program/tier terms: `trialDays`, `maxCommissionMonths`, `codeExpiryDays`, `payoutMethod`, `payoutFrequency`, `maxAlertsFree`, `maxAlertsPro`, `rateLimitFree`, `rateLimitPro`.
  - Double-check `getDisbursementSettings()` operational settings remain strictly unexposed (`disbursement_enabled`, `disbursement_max_batch_size`, `affiliate_commission_approval_days`, raw payout provider internals).
- Update `AffiliateConfig` interface in `lib/hooks/useAffiliateConfig.ts` (and check any other consumers of `/api/config/affiliate` response type).
- Update `__tests__/api/config-affiliate.test.ts` to verify all new fields, `source: 'live'` vs `'fallback'`, `Cache-Control: no-store` on fallback, and continued absence of forbidden operational keys.
- _Verify:_ `npx jest __tests__/api/config-affiliate.test.ts __tests__/hooks/use-affiliate-config.test.tsx __tests__/lib/systemconfig-figures-guard.test.ts` passes cleanly.

### Step 2 — Create `GET /api/config/capabilities`

- Add `app/api/config/capabilities/route.ts` (no dictionary imports!).
- Expose:
  - `schemaVersion: 1`, `asOf` ISO timestamp
  - `tiers`: `{ symbols: SYMBOLS, timeframes: TIMEFRAMES, free: { maxActiveAlerts, maxWatchlistItems, rateLimitPerMinute }, pro: { maxActiveAlerts, maxWatchlistItems, rateLimitPerMinute, trialDays } }`
  - `capabilities`: `{ interactiveAiAnalyst: { status: isReplyEnabled(process.env) ? 'live' : 'planned', available: isReplyEnabled(process.env) }, dualModelPatternConfluence: { status: 'live', available: true }, priceBreachAlerts: { status: 'live', available: true }, multiTimeframeCharts: { status: 'live', available: true }, dataExport: { status: 'planned', available: false }, prioritySupport: { status: 'planned', available: false } }` (verify exact flag names and tier fields in live `packages/types/src/tier/constants.ts`, `lib/tier-config.ts`, `lib/reply/server/flags.ts`, `lib/intake/server/flags.ts` at CONFIRM time).
- Set `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`.
- Add unit test `__tests__/api/config-capabilities.test.ts` covering default prod flags (`interactiveAiAnalyst.status === 'planned'`), `REPLY_ENABLED === 'true'` (`'live'`), `dataExport` & `prioritySupport` `'planned'`, cache header, and zero secrets/dict imports.
- _Verify:_ `npx jest __tests__/api/config-capabilities.test.ts __tests__/lib/i18n/route-handlers-and-dictionaries.test.ts` passes cleanly.

### Step 3 — Make `GET /api/fx/rates` CDN-Cacheable

- Update `app/api/fx/rates/route.ts`: set `Cache-Control: public, s-maxage=3600, stale-while-revalidate=300` and update the route header comment accurately.
- Confirm `app/api/payments/dlocal/convert/route.ts` stays untouched (`Cache-Control: no-store`).
- Update `__tests__/lib/fx/public-rate-routes.test.ts` to assert `public, s-maxage=3600, stale-while-revalidate=300` on `/api/fx/rates` and `no-store` on `/api/payments/dlocal/convert`.
- _Verify:_ `npx jest __tests__/lib/fx/public-rate-routes.test.ts __tests__/lib/fx/display-refresh.test.tsx __tests__/components/payments/price-display-refresh.test.tsx` passes cleanly.

### Step 4 — Add One-Shot `?lang=` Setter in `middleware.ts` (`Q1`)

- Extract a clean, unit-testable helper (either exported from `middleware.ts` or in `lib/i18n/` imported by `middleware.ts`) implementing Q1's exact rules:
  - Skip if URL has a `countryPrefix` (`isSupportedCountryPrefix` matched).
  - Read `lang = request.nextUrl.searchParams.get('lang')`.
  - If `lang` exact-matches `isSupportedLanguage(lang)`:
    - Clone `request.nextUrl`, delete `lang` query param (preserving all other search params).
    - Return `NextResponse.redirect(targetUrl, 307)` with `LOCALE_COOKIE` set to `lang` (`path: '/'`, `maxAge: 31536000`, `sameSite: 'lax'`, `secure: process.env.NODE_ENV === 'production'`).
  - If `lang` is absent or invalid (`!isSupportedLanguage(lang)`): do nothing and let existing middleware logic proceed normally (do NOT strip unknown params or overwrite cookies).
- Keep all existing auth guards, CSRF `validateOrigin`, CSP headers, and `finishWithLocale()` behavior unchanged.
- Add unit tests covering: (a) unprefixed `/?lang=es` -> 307 to `/` + sets `davintrade-locale=es`, preserves `?from=dotcom&ref=ABC`; (b) `/?lang=zh-TW` -> sets `zh-TW`; (c) invalid `/?lang=zz` -> ignored, no cookie/redirect; (d) prefixed `/th/pricing?lang=es` -> ignored (`countryPrefix` wins); (e) `/eu/pricing` remains untouched.
- _Verify:_ Middleware unit tests pass (`npx jest <new/existing middleware tests>`).

### Step 5 — `.app` Feature-Truth & Privacy Export Cleanup (`Q3`) + 19-Locale i18n

- Inspect `components/landing/landing-pricing.tsx` (lines 1–120) and `app/settings/privacy/page.tsx` + `components/pricing/tier-comparison.tsx` completely before editing.
- **`components/pricing/tier-comparison.tsx` & `app/(marketing)/pricing/page.tsx`:**
  - Remove `'Data Export'` row and `'Priority Support'` row + `'& priority support'` phrase on line 239.
  - Gate `'Interactive AI Analyst'`, `'Monthly AI Token Quota'`, and `'Interactive AI Analyst (500k Tokens/Mo)'` rows behind `aiAnalystEnabled` prop (`boolean`, default `false`). Wire `app/(marketing)/pricing/page.tsx` (reading `isReplyEnabled(process.env)` server-side; mark `export const dynamic = 'force-dynamic'` or evaluate safely without exposing server flag bundle cleanly) so rows only appear when Stack D Interactive AI Analyst is actually enabled.
- **`app/settings/privacy/page.tsx`:**
  - Remove `setTimeout(..., 2000)` mock export and fake `"Export Requested!"` state.
  - Replace the `"Request Data Export"` button with an honest `<a href="mailto:privacy@davintrade.app?subject=Data%20Export%20Request">` button/link styled consistently (`Button asChild` or anchor-wrapped `Button`) explaining to email `privacy@davintrade.app` to request a data copy.
- **19-Locale Dictionary Compliance:**
  - For every new UI string or key used in `tier-comparison.tsx` and `app/settings/privacy/page.tsx`, add matching entries across ALL 19 files in `lib/i18n/dictionaries/*.json` with genuine non-English translations in the 17 non-English files.
- _Verify:_
  - `npx jest __tests__/lib/i18n/compulsory-translation-coverage.test.ts` passes (all 19 locales, zero untranslated keys!).
  - `npx jest __tests__/components/pricing/annual-plan.test.tsx` (plus new/updated tests for gated AI rows, removed `Data Export` / `Priority Support`, and privacy `mailto:` UI) passes cleanly.

### Step 6 — Final Verification, Documentation & Handoff

- Run full scoped verification suite in parent repo:
  - `pnpm run type-check` (and verify tests type-check cleanly — note parent `tsconfig.json` behavior)
  - Targeted ESLint on every touched file (`npx eslint ...`)
  - All unit tests touched or related (`__tests__/api/config-affiliate.test.ts`, `__tests__/api/config-capabilities.test.ts`, `__tests__/hooks/use-affiliate-config.test.tsx`, `__tests__/lib/systemconfig-figures-guard.test.ts`, `__tests__/lib/fx/public-rate-routes.test.ts`, `__tests__/lib/fx/display-refresh.test.tsx`, `__tests__/components/payments/price-display-refresh.test.tsx`, `__tests__/components/pricing/annual-plan.test.tsx`, `__tests__/lib/i18n/compulsory-translation-coverage.test.ts`, `__tests__/lib/i18n/route-handlers-and-dictionaries.test.ts`, and middleware test)
  - Rule 9 scan on modified/created files (`git grep -n -E 'postgres(ql)?://|supabase\.co|@db\.|redis://|rediss://' -- ...` and no hardcoded internal IPv4s)
- **Do NOT commit or push** unless Davin explicitly asks!
- Update this order (`Status: EXECUTED` / check checkboxes / fill `Deviations` if any), write report `davintrade-dot-com/handoffs/M1.0-report.md`, and update `davintrade-dot-com/IMPLEMENTATION-STATUS.md` (`M1.0` -> `DONE` or `WAITING_DAVIN` for commit/PR review, and `Next Action Now` -> **`M0.3` Cloudflare R2 & Media Pipeline**, followed by `M0.5`).

---

## Done when

_Ticked as amended by A1–A6; "nothing committed" holds._

- [x] `GET /api/config/affiliate` returns `schemaVersion`, `source: 'live' | 'fallback'`, and extended non-secret program terms (`24` months, `7` trial days, `WISE`, `MONTHLY`, alert/rate limits), sets `Cache-Control: no-store` on fallback, and preserves all forbidden-key guards.
- [x] `GET /api/config/capabilities` exists, reflects `isReplyEnabled(process.env)` accurately (`interactiveAiAnalyst` `'planned'` while Stack D is off), imports zero UI dictionaries, and sets `s-maxage=300, stale-while-revalidate=60`.
- [x] `GET /api/fx/rates` serves `Cache-Control: public, s-maxage=3600, stale-while-revalidate=300` while `/api/payments/dlocal/convert` remains `no-store`.
- [x] `middleware.ts` handles unprefixed `?lang=<valid>` via `307` strip + `davintrade-locale` cookie and ignores invalid/prefixed `?lang=`.
- [x] `TierComparison` removes `Data Export` & `Priority Support`, gates `Interactive AI Analyst` & `Monthly AI Token Quota` rows off when Stack D is disabled, and `app/settings/privacy/page.tsx` replaces the 2000ms export mock with an honest `mailto:privacy@davintrade.app` request flow.
- [x] `pnpm run type-check`, ESLint on touched files, and all targeted Jest suites (including `compulsory-translation-coverage.test.ts` across all 19 locales) exit `0`.
- [x] `davintrade-dot-com/handoffs/M1.0-report.md` written and `davintrade-dot-com/IMPLEMENTATION-STATUS.md` updated; no unintended files touched; nothing committed/pushed without Davin's instruction.

---

## Rollback

- Pure Next.js code & test diff on local checkout (`trading-alerts-saas-public`); revert modified/created files individually with targeted restore if needed before commit, or `git revert` if already merged into `main`. No database migrations or external infra mutations in this order.

---

## Deviations

_(Filled during execution with what/why/impact if live code requires any adjustment.)_

### CONFIRM findings (Executor, 2026-11-26)

Branch `main` at `7436a2bd`. Every Order A target file is clean in the working tree (the many other
uncommitted files are outside scope and untouched). Baseline: 5 suites, 129/129 tests pass
(`config-affiliate`, `public-rate-routes`, `annual-plan`, `compulsory-translation-coverage`,
`middleware`).

**Contradictions needing Davin:**

1. Alert limits: the order says Free `5` / Pro `20`. Live code
   (`packages/types/src/tier/constants.ts`, enforced in `app/api/alerts/route.ts`) is Free `0` /
   Pro `100`.
2. Rate limit: the live field is `rateLimit` = `60` / `300` **per hour**, not per minute. No caller
   of `getRateLimit()` or other enforcement of these figures was found.
3. `maxWatchlistItems` does not exist (watchlists were removed from the product).
4. `REPLY_ENABLED=true` alone does not mean "live": while `REPLY_ALLOWED_USER_IDS` is set (staging
   week, ADR-099), only listed users have the analyst.
5. Unbacked claims outside the order's file list: `components/landing/landing-pricing.tsx` ("5
   Standard Alert Rules", "Unlimited Price Breach Alerts"); `app/settings/billing/page.tsx`
   ("priority support"); `app/upgrade/success/page.tsx` ("Priority Support & All Notifications",
   "SMS alerts"); `subscription.pro6` in the Pro e-mail ("Priority Support & Data Export",
   `lib/email/i18n/` and its byte copy in `operation-service`).

**Corrections the Executor can apply without a decision:** the constant is `AFFILIATE_CONFIG`
(not `AFFILIATE_CONSTANTS`); tier fields are `maxAlerts` / `rateLimit` (no `MAX_ACTIVE_ALERTS` /
`RATE_LIMIT_PER_MINUTE`); the `middleware.ts` matcher **does** match `/api/*`, so the `?lang=` setter
must exclude API paths explicitly.

---

### Execution deviations (2026-11-26)

- `replyAvailability()` added to `lib/reply/server/flags.ts`; the capabilities route and `/pricing`
  added to the importer allow-list in `__tests__/lib/reply/boundaries.test.ts`.
- The Free card's "Read-Only AI Analyst (Chat Locked)" line is gated with the other analyst lines.
- Full Jest run: one failure in the untouched `lazy-charts.test.tsx`; it passes when run alone.
- Review items and unverified paths: `davintrade-dot-com/handoffs/M1.0-report.md`.

---

## Next-session handoff

- After Davin reviews/merges `M1.0` PR on `trading-alerts-saas-public`, the next milestone per Davin's 2026-11-26 sequence is **`M0.3` (Cloudflare R2 `davintrade-marketing-media` bucket + media pipeline)** in `davintrade-dot-com/web/`, followed LAST in Phase 0 by **`M0.5`** (once Davin completes asset review and provides **`Q14`** layout references).
