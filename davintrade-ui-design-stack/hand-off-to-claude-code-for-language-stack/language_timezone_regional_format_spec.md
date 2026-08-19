# DavinTrade AI — Language, Timezone & Regional Format Hand-Off Specification

> **Document Purpose**: Technical hand-off documentation summarizing the completed client-side i18n/locale implementation, its verified current status, and the server-side database persistence + API tasks for **Claude Code** (fresh session) to evaluate and execute in the main codebase.

---

## 1. Executive Summary & Codebase Architecture Boundaries

### Dual-Codebase Roles & Responsibilities

1. **Seed Reference Frontend (`seed-code/trading-conversational-ai-ui-pages-increment/`)**:
   - **Path**: `D:\SaaS Project\trading-alerts-saas-public\seed-code\trading-conversational-ai-ui-pages-increment`
   - **Role**: Reference UI implementation, locale-resolution patterns, and verified formatting/translation conventions.
   - **Status**: Client-side locale engine is **complete and verified across all 97 routes** in the page inventory (`docs/files-completion-list/frontend-codebase-migration/ui-pages-replication.xlsx`). This supersedes the earlier, smaller `seed-code/trading-conversational-ai-ui/` (no `-pages-increment` suffix) reference repo this document originally pointed at — that repo covered only 31 pages; all file links below have been updated accordingly.
   - Claude Code can use this seed codebase as the pattern source to replace/build the equivalent frontend locale stack in the main repository.

2. **Main Target Full-Stack Codebase (`D:\SaaS Project\trading-alerts-saas-public\`)**:
   - **Path**: `D:\SaaS Project\trading-alerts-saas-public`
   - **Role**: Primary full-stack production application containing PostgreSQL/Prisma schemas (split across `prisma/market-data/schema.prisma` and `prisma/non-market-data/schema.prisma`), the `operation-service`/`money-service` microservices, Redis caches, authentication sessions, and backend REST APIs.
   - **CRITICAL IMPLEMENTATION DIRECTIVE**: **All server-side database persistence tasks (Prisma models, database migrations, server actions, auth session resolution, GeoIP header parsing, AI prompt injection, payment currency wiring) must be built and integrated directly into the main `D:\SaaS Project\trading-alerts-saas-public\` codebase, not in the seed-code subfolder.** The seed-code repo has no backend of its own — it is UI-only, and every "server-side" behavior described in this document (GeoIP, persistence, AI language injection) is currently either mocked, client-simulated, or simply absent there.
   - This document's `UserPreference` model is deliberately scoped to **language/region only**. Theme, accent color, and chart candle colors belong to a **separate `UserAppearance` model** — see `davintrade-ui-design-stack/hand-off-to-claude-code-for-appearance-stack/HYBRID_APPEARANCE_HANDOFF_SPECIFICATION.md`, already handed off and completed independently. Keep the two models and their migrations separate; do not merge appearance fields back into `UserPreference`.

---

## 2. Completed Client-Side Implementation Summary

All items below are implemented, committed, and verified (`tsc --noEmit` clean, browser-verified across multiple locales) in `seed-code/trading-conversational-ai-ui-pages-increment/`:

| Component                                                                                                    | Location                                                                                                                                                                                                                                                                                                                                                                                       | Status                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Country → locale config (12 countries)                                                                       | [`lib/country-config.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/country-config.ts)                                                                                                                                                                                                                                   | DONE                                                                                    |
| Single-source-of-truth resolver (shared byte-for-byte by middleware, SSR, and client hydration)              | [`lib/i18n/locale-resolver.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/i18n/locale-resolver.ts)                                                                                                                                                                                                                       | DONE                                                                                    |
| Dynamic country URL-prefix routing (rewrite, not redirect)                                                   | [`middleware.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/middleware.ts)                                                                                                                                                                                                                                                   | DONE                                                                                    |
| `LocaleProvider` React context + `useLocale()` hook (formatters, `t()`, preference setters)                  | [`lib/context/locale-context.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/context/locale-context.tsx)                                                                                                                                                                                                                 | DONE                                                                                    |
| Server-safe dictionary loader for `generateMetadata()`                                                       | [`lib/i18n/get-dictionary.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/i18n/get-dictionary.ts), [`lib/i18n/server-locale.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/i18n/server-locale.ts)                                                   | DONE                                                                                    |
| One-time client-side GeoIP auto-detection (`ipapi.co`) for first-ever guest visits with no stored preference | `lib/context/locale-context.tsx` (effect)                                                                                                                                                                                                                                                                                                                                                      | DONE — **client-side only**, see §4 caveat                                              |
| 12 locale dictionaries (`en-GB`, `en-US`, `th`, `de`, `es`, `ja`, `hi`, `vi`, `id`, `tr`, `ur`, `pt`)        | [`lib/i18n/dictionaries/`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/lib/i18n/dictionaries/)                                                                                                                                                                                                                                 | DONE — **2,258 keys each**, identical key set across all 12, zero missing/empty entries |
| Settings page + header dropdown dual-sync                                                                    | [`app/(dashboard)/settings/language/page.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/app/%28dashboard%29/settings/language/page.tsx), [`components/layout/app-header.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/trading-conversational-ai-ui-pages-increment/components/layout/app-header.tsx) | DONE, pre-existing                                                                      |
| Full hardcoded-content remediation across the entire page inventory                                          | 71 files (currency/date/number formatting + static text)                                                                                                                                                                                                                                                                                                                                       | DONE this session                                                                       |
| Pre-existing orphaned dictionary keys (code already called `t()`, no translation existed)                    | 1,245 keys across 91 files                                                                                                                                                                                                                                                                                                                                                                     | DONE this session                                                                       |

### This session's work, for the record

The dictionary went from **639 keys → 2,258 keys** per locale across two batches:

1. **374 keys** — strings that were previously hardcoded (raw `$x.toFixed(2)` currency, `.toLocaleDateString('en-US', ...)` dates, un-wrapped JSX text) across the admin, affiliate, disbursement, dashboard, settings, and marketing surfaces were wired through `t()`/`formatCurrency()`/`formatDate()`, then translated into all 12 locales.
2. **1,245 keys** — a full-codebase audit found `t('...')` calls that were **already correctly wired** but had never had a dictionary entry added for them at all (pre-existing gap, not something this session's edits introduced) — silently falling back to English forever. Found via `t\(\s*(['"])((?:\\.|(?!\1).)*)\1` regex extraction of every literal-string `t()` call site, diffed against `en-GB.json`. Translated into all 12 locales and merged.

One data-quality issue was found and corrected during this work: an external translation pass (Antigravity) fabricated ~316 dictionary entries across `vi`/`id`/`tr`/`ur` that didn't correspond to any real `t()` call in the codebase — caught by cross-referencing every "new" key against a live re-extraction of the actual code, and stripped before merging. A second issue — 9 **namespaced** keys (`nav.notifications`, `breadcrumb.admin`, `disbursement.back_to_admin`, etc., where the dictionary key is an internal identifier rather than literal display text) resolved to their own raw key string in `en-GB`/`en-US` instead of the human-readable label — was found via a live production screenshot and fixed using the exact fallback text from each call site. Both are worth knowing about if the fresh session encounters literal dictionary-key text or unexpectedly-English strings anywhere: check for the same class of bug (fabricated/unverified entries, namespaced-key mishandling) rather than assuming the dictionaries are unconditionally trustworthy.

---

## 3. Frontend Architecture & Centralized Propagation

The client-side UI uses a 3-tier hybrid architecture for language propagation across all 97 pages, components, overlays, charts, and (currently mocked) AI outputs:

1. **Dynamic Country URL Prefix Routing (`middleware.ts`)**:
   - `NextResponse.rewrite()` (not `redirect()`) for all 12 supported country routes (`/gb/`, `/in/`, `/ng/`, `/pk/`, `/vn/`, `/id/`, `/th/`, `/za/`, `/tr/`, `/us/`, `/eu/`, `/jp/`).
   - Preserves the browser address bar URL while activating that country's language/timezone/currency/date format. Forwards the matched prefix as request header `x-davin-country` so the server render (which sees the rewritten, prefix-stripped path) can still resolve the correct locale — this is what prevents an English→localized flash on first load.
   - Syncs the `davintrade-locale` cookie to the URL's resolved language so a later non-prefixed visit still server-renders correctly.

2. **Dual-Location Configuration Synchronization**:
   - **Location A**: Language Settings Page (`app/(dashboard)/settings/language/page.tsx`).
   - **Location B**: Header top-right country dropdown (`components/layout/app-header.tsx`).
   - Both interface with the same single source of truth (`LocaleProvider`). Selecting a country in either location instantly updates the other, the live clock, the currency formatter, and the active dictionary with zero state conflict.

3. **2,258-Key Dictionary Catalogue & On-Demand Code Splitting**:
   - All 12 dictionaries share an identical key set. `en-GB`/`en-US`/`th` are bundled synchronously (kept small, ~first-paint critical); the other 9 are lazy-loaded via `import(`@/lib/i18n/dictionaries/${language}.json`) so visiting `/jp/`only downloads`ja.json`.
   - Lookup convention: most dictionary keys **are** the literal English source string (`t('Some English Text')`); a smaller set of namespaced dot-keys (`nav.dashboard`, `breadcrumb.admin`, `settings.nav.profile`) are used with an explicit fallback (`t('nav.dashboard', 'Dashboard')`) for structured nav/breadcrumb items. Both conventions coexist by design — don't try to normalize one into the other.

4. **AI System Prompt Language Injection — NOT YET BUILT ANYWHERE**:
   - The seed-code chat UI (`components/chat-panel.tsx`, `market-comments-panel.tsx`) is fully mocked — there is no real LLM call to inject a language directive into. This is a **pure server-side task** for the main codebase's actual `/api/ai/chat`-equivalent route once one exists; there is no client-side reference pattern to copy for this specific piece. See §6.C for the shape it should take.

---

## 4. Server-Side GeoIP: current gap and what to build

The **client-side** `LocaleProvider` does its own one-time GeoIP lookup (`fetch('https://ipapi.co/json/')`) on first-ever visit with zero stored preference, then persists the result — but this only runs **after** hydration, so a brand-new guest's very first server-rendered HTML is always the `en-GB` default, then flips to the detected country on the client. This is a real, known, un-fixed FOUC-equivalent for locale (the appearance stack solved the analogous problem for theme via a cookie read in `app/layout.tsx`; locale has no server-side equivalent yet because there is no server to read a header from in the seed-code repo).

**Building the header-based GeoIP resolution described in §6.B (`cf-ipcountry` / `x-vercel-ip-country`) in the main codebase's middleware/route handler — not the client-side `ipapi.co` call — is what actually fixes this for real users**, and should take priority over trying to "port" the client-side fetch pattern, which doesn't need porting (it can stay as the guest/first-visit-before-any-server-round-trip fallback it already is).

---

## 5. 🇬🇧 Tier-1 Priority & dLocal Emerging Market Regions (12 Supported Countries)

Regenerated directly from the live `lib/country-config.ts` (source of truth — verify against that file if this table and the code ever disagree, live code wins):

| Country / Region                    | Prefix | Language          | Currency | Symbol | Timezone              | Date Format  | Time Format |
| ----------------------------------- | ------ | ----------------- | -------- | ------ | --------------------- | ------------ | ----------- |
| 🇬🇧 United Kingdom (Tier-1, default) | `gb`   | `en-GB`           | GBP      | £      | `Europe/London`       | `DD/MM/YYYY` | 24h         |
| 🇮🇳 India                            | `in`   | `hi` (Hindi)      | INR      | ₹      | `Asia/Kolkata`        | `DD/MM/YYYY` | 12h         |
| 🇳🇬 Nigeria                          | `ng`   | `en-US`           | NGN      | ₦      | `Africa/Lagos`        | `DD/MM/YYYY` | 24h         |
| 🇵🇰 Pakistan                         | `pk`   | `ur` (Urdu)       | PKR      | Rs     | `Asia/Karachi`        | `DD/MM/YYYY` | 12h         |
| 🇻🇳 Vietnam                          | `vn`   | `vi` (Vietnamese) | VND      | ₫      | `Asia/Ho_Chi_Minh`    | `DD/MM/YYYY` | 24h         |
| 🇮🇩 Indonesia                        | `id`   | `id` (Indonesian) | IDR      | Rp     | `Asia/Jakarta`        | `DD/MM/YYYY` | 24h         |
| 🇹🇭 Thailand                         | `th`   | `th` (Thai)       | THB      | ฿      | `Asia/Bangkok`        | `DD/MM/YYYY` | 24h         |
| 🇿🇦 South Africa                     | `za`   | `en-US`           | ZAR      | R      | `Africa/Johannesburg` | `DD/MM/YYYY` | 24h         |
| 🇹🇷 Turkey                           | `tr`   | `tr` (Turkish)    | TRY      | ₺      | `Europe/Istanbul`     | `DD/MM/YYYY` | 24h         |
| 🇺🇸 United States                    | `us`   | `en-US`           | USD      | $      | `America/New_York`    | `MM/DD/YYYY` | 12h         |
| 🇪🇺 Eurozone                         | `eu`   | `de` (German)     | EUR      | €      | `Europe/Berlin`       | `DD/MM/YYYY` | 24h         |
| 🇯🇵 Japan                            | `jp`   | `ja` (Japanese)   | JPY      | ¥      | `Asia/Tokyo`          | `YYYY-MM-DD` | 24h         |

Note three countries deliberately share `en-US` (`ng`, `za`, `us`) — `lib/i18n/locale-resolver.ts` pins a `PRIMARY_COUNTRY_FOR_LANGUAGE` map (`en-US` → `us`) so resolving a bare language code never nondeterministically picks Nigeria or South Africa by object-key order. Currency conversion in the UI uses a static `exchangeRate` multiplier per country in `country-config.ts` (mock display data, not a live FX feed) — the server-side payment integration in §5.D must use real-time or provider-quoted rates, not this table.

---

## 6. ⚙️ Server-Side Requirements (Claude Code Back-End Tasks — Main Codebase Only)

### A. Prisma Database Schema

Scoped to language/region only — **do not** add theme/accent/chart-color fields here, see §1. Add to whichever schema file the `User` model actually lives in (likely `prisma/non-market-data/schema.prisma` based on the existing `prisma:generate:non-market-data` script, but **verify against the live schema file before assuming** — per this repo's own migration-mode doctrine, live code wins over documentation):

```prisma
model UserPreference {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Mirrors lib/i18n/locale-resolver.ts's LocalePreferences interface exactly —
  // keep these two in sync if either changes.
  countryCode String   @default("GB")     // GB, IN, NG, PK, VN, ID, TH, ZA, TR, US, EU, JP
  language    String   @default("en-GB")  // en-GB, en-US, hi, ur, vi, id, th, tr, de, ja (+ es, pt: dictionaries exist, no country currently maps to them by default)
  timezone    String   @default("Europe/London") // IANA identifier
  dateFormat  String   @default("DMY")    // DMY, MDY, YMD
  timeFormat  String   @default("24h")    // 12h, 24h
  currency    String   @default("GBP")    // GBP, INR, NGN, PKR, VND, IDR, THB, ZAR, TRY, USD, EUR, JPY

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### B. REST API Endpoints & Server-Side GeoIP Detection (`app/api/user/preferences/route.ts`)

- **`GET /api/user/preferences`**:
  - **Auth**: Session cookie or Bearer token, matching this codebase's existing auth convention.
  - **Server GeoIP resolution** (see §4 — this is the actually-missing piece, not a nice-to-have): read `cf-ipcountry` or `x-vercel-ip-country` request headers to resolve a guest's country **before** first paint, mirroring the exact resolution precedence already implemented client-side in `resolvePreferences()` (`lib/i18n/locale-resolver.ts`): explicit stored/URL preference wins, then header-based geo, then the `en-GB`/`GB` default.
  - Response:
    ```json
    {
      "preferences": {
        "countryCode": "GB",
        "language": "en-GB",
        "timezone": "Europe/London",
        "dateFormat": "DMY",
        "timeFormat": "24h",
        "currency": "GBP"
      }
    }
    ```

- **`PUT /api/user/preferences`**:
  - Auth required.
  - Request body: `{ countryCode, language, timezone, dateFormat, timeFormat, currency }` — matches `LocalePreferences` exactly, so the client can eventually send its existing shape unmodified.

### C. AI System Prompt Language Middleware

Not built anywhere yet (§3.4). When the real LLM chat route exists, inject the resolved language into the system directive:

```typescript
const userLang = userPreferences?.language || 'en-GB';

const systemPrompt = `
You are DavinTrade AI, an expert technical market analyst.
SYSTEM DIRECTIVE: Respond directly in the user's preferred language: ${userLang}.
Maintain accurate financial and technical trading terminology.
`;
```

### D. dLocal & Stripe Multi-Currency Payment Backend Integration

When serving `/api/checkout` or initializing payment gateways:

1. Read `userPreference.currency` (`GBP`, `INR`, `VND`, `THB`, `NGN`, `PKR`, `IDR`, `ZAR`, `TRY`).
2. Pass the matching local currency code to the dLocal payment API / Stripe checkout session payload — **do not** use `country-config.ts`'s static `exchangeRate` for actual money movement (see §5 note); that table is UI display-only mock data.

---

## 7. 🔒 Auth Decoupling Strategy

- The client-side `LocaleProvider` operates **independently of auth state** by design — it must keep working identically for logged-out guests.
- Persistence today (client-only, pre-backend): `localStorage` key `davin_locale_preferences` (full `LocalePreferences` JSON) + cookie `davintrade-locale` (language only, 1-year `SameSite=Lax`) — both written together by `persistPreferences()` in `locale-context.tsx`.
- Once `GET/PUT /api/user/preferences` exists: on startup, an authenticated session should sync from Postgres via `credentials: 'include'`; a logged-out/guest session should continue functioning exactly as it does today, in local memory only, with zero auth errors or page crashes. Do not make any part of the locale system a hard dependency on being logged in.
