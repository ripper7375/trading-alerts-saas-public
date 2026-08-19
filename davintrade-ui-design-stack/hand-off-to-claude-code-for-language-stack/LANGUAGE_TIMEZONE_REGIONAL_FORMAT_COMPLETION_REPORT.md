# Language, Timezone & Regional Format — Server-Side Completion Report

> **Status:** PARTIAL COMPLETE — §6.A/§6.B built and verified; §6.C skipped
> (nothing to build against yet); §6.D deliberately not touched (see §5).
> **Executed by:** Claude Code, direct chat instruction (not run through the
> `docs/migration-orders/` Executor Protocol pipeline — this work originates
> from `davintrade-ui-design-stack/`, a separate track from the
> microservices-migration order system, so it carries no PRE-DRAFT/DRAFT/
> APPROVED/CONFIRMED lifecycle and no migration-order-numbered session. A
> short ad-hoc entry was still added to the root `CLAUDE.md`'s Current-state
> log per `EXECUTOR-PROTOCOL.md` §6's convention for ad-hoc sessions; this
> file is the full record.)
> **Source spec:** [`language_timezone_regional_format_spec.md`](./language_timezone_regional_format_spec.md)
> **Codebase:** `D:\SaaS Project\trading-alerts-saas-public\` (main only —
> the spec's own §1 scopes all server-side work to main, never seed-code)

---

## 1. What was requested

Four server-side tasks from the hand-off spec's §6, main codebase only:

- **A.** A `UserPreference` Prisma model (language/region fields only).
- **B.** `GET/PUT /api/user/preferences`, including server-side GeoIP header
  resolution (`cf-ipcountry`/`x-vercel-ip-country`) — named explicitly as
  "the actual gap this task closes, not just CRUD scaffolding."
- **C.** AI system-prompt language injection — only if a real LLM chat route
  already exists.
- **D.** Payment currency wiring — read `userPreference.currency` into the
  dLocal/Stripe payload, not `country-config.ts`'s mock exchange-rate table.

## 2. Key finding: the spec's central assumption was false against live code

The spec was written as if `/api/user/preferences` didn't exist yet. It
does. Live code already had:

- A generic-JSON `UserPreferences` model (**plural** — distinct from the
  spec's proposed singular `UserPreference`) in
  [`prisma/non-market-data/schema.prisma`](../../../prisma/non-market-data/schema.prisma),
  already storing `language`/`timezone`/`dateFormat`/`timeFormat`/`currency`
  (plus `theme`/`colorScheme`/privacy/notification fields unrelated to this
  spec).
- A fully working, auth-gated `GET/PUT /api/user/preferences` route
  ([`app/api/user/preferences/route.ts`](../../../app/api/user/preferences/route.ts)),
  Zod-validated, upserting into that model.
- The identical route mirrored into `operation-service`'s `UsersController`
  (`getPreferences`/`updatePreferences`), reachable behind the (default-off)
  `MIGRATE_USER_PROFILE` flag via `forwardRequestToOperationService()`.

Building the spec's literal `UserPreference` model + a new route at the same
`/api/user/preferences` path was not possible without colliding with this —
Next.js allows exactly one route handler per path, and a second Prisma model
covering the same data would immediately fork the source of truth between
two competing tables.

Per this repo's own live-code-wins doctrine (`CLAUDE.md` non-negotiable #7,
`docs/migration-orders/LESSONS-LEARNED.md` L22), **extended the existing
infrastructure instead of building a competing one**. This has a real
benefit beyond avoiding the collision: because `UserPreferences.preferences`
is a `Json` column, adding a new locale field to it requires **zero Prisma
migrations on either service** — sidestepping L1 (never migrate from a
service that only owns a schema subset) and L6 (`migrate dev`'s destructive
drift-reset risk against production) entirely, neither of which would have
applied to a JSON-blob addition but both of which a from-scratch typed model
would have had to navigate.

## 3. What was built (§6.A / §6.B)

| File                                                                                                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`lib/preferences/defaults.ts`](../../../lib/preferences/defaults.ts)                                         | Added `countryCode: string` to the `UserPreferences` interface and a new `SUPPORTED_COUNTRY_CODES` (12-value) const; `isValidPreference` validates it against that list; `DEFAULT_PREFERENCES.countryCode = 'US'`                                                                                                                                                                                                                                                                                                       |
| [`lib/preferences/geo-locale.ts`](../../../lib/preferences/geo-locale.ts)                                     | **New.** Server-only `GEO_COUNTRY_TO_LOCALE` map keyed by real ISO 3166-1 alpha-2 codes (not seed-code's synthetic `eu` prefix — no GeoIP header ever sends that literally; 20 Eurozone member codes are mapped individually to the shared EUR/`de`/Berlin bundle instead), plus `resolveLocaleFromCountryHeader()` and `extractGeoCountryHeader()` (checks `cf-ipcountry` first, then `x-vercel-ip-country`, matching the spec's own stated precedence)                                                                |
| [`app/api/user/preferences/route.ts`](../../../app/api/user/preferences/route.ts)                             | `countryCode` added to the PUT Zod schema (`z.enum(SUPPORTED_COUNTRY_CODES)`); GET now resolves the GeoIP header into a locale bundle **only when the authenticated user has no stored preferences row yet** — an existing row (even one that never explicitly set `countryCode`) is treated as an explicit preference and wins, matching the client-side `resolvePreferences()` precedence in `seed-code/.../lib/i18n/locale-resolver.ts` ("explicit stored/URL preference wins, then header-based geo, then default") |
| [`operation-service/src/users/users.schemas.ts`](../../../operation-service/src/users/users.schemas.ts)       | Mirrored `countryCode` into `updatePreferencesSchema`, `UserPreferencesShape`, `DEFAULT_PREFERENCES` — keeps the two services' data shape interchangeable                                                                                                                                                                                                                                                                                                                                                               |
| [`operation-service/src/users/users.controller.ts`](../../../operation-service/src/users/users.controller.ts) | Doc comment recording the GeoIP gap on this path (§4) rather than silently leaving it unexplained                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [`__tests__/api/user.test.ts`](../../../__tests__/api/user.test.ts)                                           | 8 new/updated cases: GeoIP resolution from `cf-ipcountry`, fallback to `x-vercel-ip-country`, unsupported-country-code fallback to defaults, stored-preference-wins-over-geo, `countryCode` PUT accept + reject                                                                                                                                                                                                                                                                                                         |

**Default value decision:** the spec's own Prisma snippet defaults
`countryCode`/`language`/`currency` to `GB`/`en-GB`/`GBP`. The _existing_
system already defaults to `US`/`en-US`/`USD` for every user with no stored
row. Silently switching that default would have changed the displayed
default currency for every current zero-preference user. Kept the existing
`US` default instead — this is a real behavior decision, called out here
rather than made silently.

## 4. Known gap left undone, and why

`operation-service`'s mirrored `getPreferences` **cannot** replicate the
GeoIP resolution as built, because `forwardRequestToOperationService()`
(`lib/operation-service/write-routes.ts`) only forwards `x-correlation-id`
and whatever `forwardedRequestContext()` carries — `user-agent` and
`x-forwarded-for` only. `cf-ipcountry`/`x-vercel-ip-country` are dropped
before a forwarded request ever reaches that process. Extending the shared
forwarder would affect every other route that uses it (alerts, 2FA,
sessions, account deletion), which is out of scope for a locale-preferences
task. This is currently moot in practice — `MIGRATE_USER_PROFILE` defaults
off everywhere, so the monolith's own GeoIP-resolving GET is what's actually
live — but documented directly on `UsersController` for whoever flips that
flag next.

## 5. §6.C — skipped (nothing exists to build against)

Grepped `app/api` for any chat/LLM/AI route — none exists anywhere in the
main codebase. This matches the spec's own §3.4 admission: "AI System
Prompt Language Injection — NOT YET BUILT ANYWHERE... a pure server-side
task for the main codebase's actual `/api/ai/chat`-equivalent route once
one exists." Nothing was built here, per the spec's own explicit
if-condition.

## 6. §6.D — deliberately not touched

Read both real payment-creation paths before deciding:

- **dLocal** ([`app/api/payments/dlocal/create/route.ts`](../../../app/api/payments/dlocal/create/route.ts)) already reads `currency` from an explicit, Zod-validated (`z.enum([...])`) request body and converts the charge via a real rate service (`lib/dlocal/currency-converter.service.ts`) — **never** `country-config.ts`'s mock `exchangeRate` table. The actual risk §6.D names ("do not use country-config.ts's exchangeRate table for real money") is already absent from this code path.
- **Stripe** ([`lib/stripe/stripe.ts`](../../../lib/stripe/stripe.ts)) has exactly one hardcoded `STRIPE_PRO_PRICE_ID` (USD-only) and zero multi-currency infrastructure — no per-currency Price objects, no presentment-currency setup. Wiring `userPreference.currency` into it for real would require creating new Stripe Price objects per currency in the Stripe dashboard/API first — a product-catalog decision, not a code change this session can make unilaterally.

`CLAUDE.md`'s own non-negotiable #5 ("Money and auth changes escalate...
beyond the order's explicit steps → stop and ask Davin") and
`EXECUTOR-PROTOCOL.md` §7 both treat payment-code changes as an escalation
class, not a default-proceed one. Given the core protective concern is
already satisfied on the live path (dLocal) and the other path (Stripe) has
no infrastructure to wire into without a separate product decision, left
both payment routes untouched rather than force a change into money-moving
code. `userPreference.currency` is already exposed via the now-`countryCode`
-complete `GET /api/user/preferences` response for a future checkout-UI
session to read and pre-populate with — that wiring is a frontend concern,
not a gap in this session's server-side scope.

## 7. Verification

- `tsc --noEmit` — clean on the monolith. On `operation-service`, one
  **pre-existing, unrelated** error surfaced
  (`auth.service.ts(252,261)`: `Property 'affiliateProfile' does not exist
on type 'PrismaService'`) — confirmed pre-existing via `git stash` +
  re-run against a clean `HEAD` tree, then `git stash pop` to restore this
  session's own changes. Not touched, not introduced this session.
- `eslint` on all 4 changed monolith files — clean, 0 warnings.
  `operation-service` has no `lint` script defined; nothing to run there.
- Monolith `test:ci` — **157/157 suites, 2379/2379 tests** (8 new/updated
  cases in `__tests__/api/user.test.ts`, zero regressions elsewhere).
- `operation-service` `src/users` suite — **63/63 unchanged** (schema
  widened, runtime behavior untouched — no new test needed there; the
  GeoIP gap in §4 is the reason, not an oversight).

## 8. Found, not investigated (unrelated to this session's own files)

The working tree carried two unstaged deletions
(`docs/MOBILE_UI_SPECIFICATION.md`,
`docs/prompt-to-antigravity-to-executing-MOBILE_UI_SPECIFICATION_MD.md`) and
an untracked `seed-code/lovable-mobile-app/docs/` directory that were not
present in this session's own opening `git status` snapshot. Confirmed via
the `git stash`/`pop` round-trip in §7 that this session's own tooling did
not cause them (they survived the round-trip unchanged either way). Left
as-is — not staged, not reverted, not otherwise acted on. Flagging here for
whichever session owns the ongoing docs reorg these appear to belong to.

## 9. Files changed

**New:**

- `lib/preferences/geo-locale.ts`
- This report.

**Modified:**

- `lib/preferences/defaults.ts`
- `app/api/user/preferences/route.ts`
- `operation-service/src/users/users.schemas.ts`
- `operation-service/src/users/users.controller.ts`
- `__tests__/api/user.test.ts`
- `CLAUDE.md` (ad-hoc session entry per `EXECUTOR-PROTOCOL.md` §6)

**Database / infrastructure:** none — this session required zero Prisma
migrations on either service (§2).

## 10. Suggested next steps (not started)

- Frontend: read `preferences.countryCode`/`.currency` from the now-complete
  `GET /api/user/preferences` response to pre-populate the checkout
  country/currency picker (closes the product-facing half of §6.D without
  touching payment-creation logic).
- A decision on Stripe multi-currency (new Price objects per currency, or
  Stripe Adaptive Pricing) if genuine multi-currency Stripe checkout is
  wanted — currently blocked on a product/pricing decision, not code.
- Whenever `MIGRATE_USER_PROFILE` is next flipped on: extend
  `forwardedRequestContext()` (or a preferences-specific variant) to carry
  `cf-ipcountry`/`x-vercel-ip-country` through to `operation-service`, then
  mirror the GeoIP resolution into `UsersService.getPreferences` (§4).
- §6.C once a real AI chat route exists — the spec's own §6.C snippet is
  ready to drop in at that point.
