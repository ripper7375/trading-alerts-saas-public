---
type: Concept/Task
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-intraday-subscription-prices
owner: Codex
integrator: Codex primary agent
reviewer: Codex cross-scope read-only review
shared_state_writer: handoff-only
approval: 'Davin requested CurrencyBeacon hourly rates with Frankfurter fallback, intraday converted subscription prices on all relevant pages, and a separate feature branch.'
order_mode: ad-hoc; phase/session unchanged
base_commit: d07855d9faa0de0cf7c535b456962d71d47ffab5
worktree: 'D:\SaaS Project\trading-alerts-saas-public'
branch: codex/intraday-subscription-prices
---

# Objective

Implement the selected hourly provider and daily fallback, keep the shared FX
conversion consistent across subscription displays and local checkout quotes,
and update open pages promptly when the server's hourly rate snapshot changes.
Retain USD SystemConfig pricing, discounts and existing payment payload behavior.

## Scope and ownership

- Primary owns the canonical rate contract, display metadata/refresh logic, API
  response caching, page/checkout propagation, integration tests, setup docs/env
  examples and this task plus unique handoff.
- Root FX implementer owns `lib/fx/usd-rates.ts`, `lib/fx/shared-rate-store.ts`,
  `lib/fx/rate-providers.ts`, `__tests__/lib/fx/usd-rates.test.ts` and
  `__tests__/lib/fx/shared-rate-store.test.ts` only.
- Money FX implementer owns `money-service/src/fx/**` only, including mirrored
  provider/schema constants and package specs; later explicitly extended to
  fixture-only `money-service/src/dlocal/currency-converter.service.spec.ts`.
  No other money-service writes.
- Attribution implementer owns `components/payments/fx-rate-attribution.tsx`,
  `app/(marketing)/about/page.tsx`, the new attribution keys in
  `lib/i18n/dictionaries/*.json`, and its own attribution component test only.
- Primary integrates shared contracts and parity. Other implementers must not
  edit another writable scope, generate clients, build or mutate shared resources.
- Existing deleted `mobile-app/**`, modified `next-env.d.ts`, untracked moved
  mobile/design/indicator directories and earlier research records are preserved.
- Excluded: seed-code, generated clients, schemas, auth, USD base/discount/grant
  rules, provider payment payload defect previously reported, commits/pushes,
  account signup, production environment changes, deployment or payment calls.
- Allowed local verification artifacts: `.tmp/fx-preview/**` and this chat's
  visualization output root. Primary owns any dev server/test fixture process.

## Implementation contract

- Primary provider CurrencyBeacon `/v1/latest`, USD base and supported 15 symbols;
  server-only `CURRENCYBEACON_API_KEY` via Authorization Bearer header. Never
  include the key or raw credential-bearing fetch errors in logs/browser data.
- Frankfurter v2 `/rates?base=USD&quotes=...` is the complete-table fallback.
- Complete positive finite rate table is required, with USD exactly 1, correct
  USD base and valid source timestamps. Reject future/stale/malformed snapshots.
- Keep root and money-service on one versioned Redis contract/key:
  `fx:usd_rates:v2`; primary snapshots use one-hour fetch TTL. Missing Redis
  degrades to process memory and bounded provider fetches. Concurrent local
  refreshes are deduplicated.
- Primary failure retry is bounded to 15 minutes; no-key fallback caches hourly.
  CurrencyBeacon cached/retained data may never be served beyond eight hours.
  Daily fallback dates must be within seven days (weekends/holidays supported).
- Rate table carries provider and actual source update time separately from
  retrieval time. Redis records carry schema version and expiry time.
- Browser checks server rates every five minutes and on focus/visibility/online
  return. Only the server calls providers; HTTP/browser caches must not add an
  extra hour of staleness. Abort and deduplicate overlapping refreshes.
- dLocal plan cards and selected summary must use the refreshed shared rates.
  Changes to provider selection belong to this approved FX integration; the
  unrelated provider amount/currency payload defect remains excluded.
- Add required provider attribution to About with real translations. Document
  CurrencyBeacon's outstanding commercial/data-use terms issue and setup needs;
  do not invent a deployment approval gate for this authorized code task.

## Checklist

- [x] Inspect live instructions, current source, ownership, branch and HEAD.
- [x] Create `codex/intraday-subscription-prices`, preserving all existing edits.
- [x] Implement and test root/money provider chain, cache/schema and parity.
- [x] Refresh shared display rates and all affected subscription/checkout views.
- [x] Add provider attribution and configuration documentation.
- [x] Run appropriate types/lint/tests, independent review and browser evidence.
- [x] Record exact results/limitations in a unique handoff and finish owned docs.

## Decisions and deviations

- User chose the provider pair and authorized implementation directly. No repeat
  provider-choice approval is needed. Licensing ambiguity is recorded, not
  silently certified or resolved by code.
- Davin added the key to `.env.local` and `money-service/.env`. Presence and
  live read-only provider verification passed; no credentials were displayed.
- Read installed Next fetch/route-handler/environment guides before edits.
- No full root build until its destructive prebuild/shared client generation is
  explicitly coordinated. Root tsc alone does not type-check tests.

## Verification

- Root runtime tsc, scoped test tsc and scoped ESLint: exit 0.
- Root Jest: 11 suites / 176 tests, exit 0 in local timezone and UTC.
- Money provider/cache/converter Jest: 3 suites / 61 tests, exit 0 local and UTC;
  full package tsc exit 0.
- Mutation checks: hourly server cache and five-minute browser refresh mutants
  both rejected (exit 1); byte-exact restored baselines exit 0.
- Scoped formatting/diff and five attribution keys across 19 dictionaries:
  exit 0. Independent final review found no actionable remaining task defects.
- CurrencyBeacon + Frankfurter GETs: HTTP 200, complete 15 currencies, identical
  root/money parsing. Local FX route returns no-store and live primary metadata.
- Browser: landing, monthly/annual pricing and About passed with live data.
  Checkout redirects to sign-in; authenticated view not exercised. Its component
  integration tests prove refreshed plan cards and selected totals together.
- Full operating-doc checker: exit 1 with unchanged 29 pre-existing errors;
  this task's documents have no scoped errors. Full production build and global
  tests skipped; no shared generators or production cache writes.
- Full command/path details and limitations are in the
  [handoff](../../handoffs/2026-10-13-intraday-subscription-prices-codex.md).

Root selected suites:
`__tests__/lib/fx/{usd-rates,shared-rate-store,usd-rates-parity,public-rate-routes}.test.ts`,
`__tests__/lib/fx/display-refresh.test.tsx`,
`__tests__/lib/dlocal/currency-converter.test.ts`,
`__tests__/lib/context/locale-context.test.tsx`,
`__tests__/components/payments/{PriceDisplay,price-display-refresh,fx-rate-attribution}.test.tsx`,
`__tests__/components/pricing/annual-plan.test.tsx`.
Commands use the installed Jest with --runTestsByPath, --runInBand,
--coverage=false and --silent; UTC run sets TZ=UTC.

## Continuation

- Implementation scope is complete. Davin subsequently authorized commit and
  push on this feature branch, explicitly excluding PR creation. Publication is
  tracked in the [publication task](2026-10-13-intraday-subscription-prices-publish.md).
  No deployment is authorized.
- Retained Redis snapshots now share original timestamps for warm/cold parity;
  root integrator approved this contract refinement after read-only review.
- Client expiry scope was delegated explicitly to the attribution implementer,
  then released to the integrator after verification.
- Setup: [intraday FX guide](../../fx/intraday-subscription-prices.md).
- Handoff: `docs/handoffs/2026-10-13-intraday-subscription-prices-codex.md`.
