---
type: Concept/Handoff
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-intraday-subscription-prices
owner: Codex
shared_state_writer: handoff-only
---

# Handoff: intraday subscription prices

Date: 2026-10-13, Asia/Bangkok.
From / to: Codex integrator and disjoint implementers / Davin and canonical state owner.
Authorization: [implementation task](../codex/tasks/2026-10-13-intraday-subscription-prices.md), Davin's direct request for CurrencyBeacon hourly rates with Frankfurter fallback, all relevant prices and a separate feature branch. Davin supplied keys in both local server environments.
Phase/session: unchanged; ad-hoc implementation.
Source: `D:\SaaS Project\trading-alerts-saas-public`, branch `codex/intraday-subscription-prices`, base and HEAD `d07855d9faa0de0cf7c535b456962d71d47ffab5`.
Status: implementation completed, independently reviewed and locally verified. Davin subsequently authorized commit and push; see the [publication task](../codex/tasks/2026-10-13-intraday-subscription-prices-publish.md). Deployment is not authorized.
Implementation-stage reviewed source/test/env-example snapshot: 53 files, aggregate SHA-256 `98d14a7b3730e26baded88f06044d1268098eec6c7dc2a6960f48d8480d98d91` (sorted path/SHA records; local manifest `.tmp/fx-preview/review-sha256.json`). Documentation is excluded from that digest to avoid a circular hash.

## Needs from Davin

No further input is needed for this implementation. Davin subsequently authorized commit and push without a PR; deployment remains a separate owner action. For production activation, configure the key in both deployment environments and keep both services on the same Redis database, then restart/redeploy under the applicable authorization. Local key presence and the live rates request have already been verified without printing credentials.

## Changed and verified

The [setup guide](../fx/intraday-subscription-prices.md) explains the cache, limits and activation requirements.

- Root and money-service request a complete CurrencyBeacon USD table with server-only Bearer authentication; Frankfurter v2 provides the complete daily fallback. No new dependency, schema, auth or payment flag changes.
- Both share the v2 Redis key and original expiry/source/retrieval metadata. Primary tables cache for one hour. A configured-primary failure retries after 15 minutes; missing-key fallback caches for one hour. Retained tables preserve their original age and can be shared with a cold reader. CurrencyBeacon data is bounded to eight hours, including browser state.
- LocaleProvider refreshes the common rates every five minutes and on focus/visibility/reconnect. Root layout already supplies the seed. Existing landing, pricing, Stripe estimate, registration, upgrade and billing formatters follow the new snapshot. Historical charged receipts stay fixed.
- Local checkout cards and selected total update together. The selected quote has a ten-second deadline and sequence guards against stale results. Its offline estimate now uses the shared/canonical rates. The existing converter's BRL support is also enabled at its public quote endpoint.
- FX and successful conversion HTTP responses use no-store caching. Source links/timestamps appear on landing, pricing, checkout and About; five attribution keys are translated across all 19 dictionaries.

Changed runtime paths:

- `lib/fx/{rate-contract,rate-providers,use-display-usd-rates,shared-rate-store,usd-rates}.ts`, `lib/country-config.ts`, `lib/context/locale-context.tsx`, `lib/dlocal/currency-converter.service.ts`.
- `app/api/fx/rates/route.ts`, `app/api/payments/dlocal/convert/route.ts`, `app/checkout/page.tsx`, `app/(marketing)/about/page.tsx`.
- `components/payments/{PriceDisplay,fx-rate-attribution}.tsx`, `components/landing/landing-pricing.tsx`, `components/pricing/tier-comparison.tsx`.
- `money-service/src/fx/{usd-fallback-rates,rate-providers,usd-rates}.ts`, both `.env.example` files, and the 19 dictionaries under `lib/i18n/dictionaries/`.

Tests/config changed or added:

- Root `__tests__/lib/fx/{usd-rates,shared-rate-store,usd-rates-parity,public-rate-routes}.test.ts`, `display-refresh.test.tsx`, `__tests__/lib/dlocal/currency-converter.test.ts`.
- `__tests__/components/payments/{PriceDisplay,price-display-refresh,fx-rate-attribution}.test.tsx`, `__tests__/tsconfig.fx.json`.
- Money `src/fx/{rate-providers,usd-rates}.spec.ts`, `src/dlocal/currency-converter.service.spec.ts` (provider fixture adaptation only).
- New task, this handoff and `docs/fx/intraday-subscription-prices.md`. No owned deletions or generated/client/schema changes.

| Check / command                                                                 | Cwd                 | Exit        | Result / limitation                                                                                                                 |
| ------------------------------------------------------------------------------- | ------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Installed root `tsc --noEmit --incremental false`                               | Repo root           | 0           | Full root runtime type check; no generators invoked                                                                                 |
| Installed root `tsc -p __tests__/tsconfig.fx.json --noEmit --incremental false` | Repo root           | 0           | Changed tests and imported consumers type checked                                                                                   |
| Scoped root ESLint with `--max-warnings 0`                                      | Repo root           | 0           | FX/context/converter, changed price components, marketing About, checkout and both routes                                           |
| Root Jest, 11 selected suites, `--runInBand --coverage=false --silent`          | Repo root           | 0           | 176 tests passed in local timezone and UTC; includes existing locale/pricing consumers                                              |
| Money Jest, provider/cache/converter specs, `--runInBand`                       | Money service       | 0           | 61 tests / 3 suites passed in local timezone and UTC                                                                                |
| Installed money `tsc --noEmit --incremental false`                              | Money service       | 0           | Full package, including its specs                                                                                                   |
| Hourly cache and five-minute client interval mutation checks                    | Repo root           | 0 harness   | Both deliberate mutants exit 1, byte-exact restoration confirmed, restored targeted cases exit 0                                    |
| Scoped Prettier and git diff whitespace checks                                  | Repo root           | 0           | Source/tests/new docs and examples checked; ignored examples use diff validation                                                    |
| Attribution translations                                                        | Repo root           | 0           | All five keys present/nonempty in 19 dictionaries; non-English values translated                                                    |
| Live provider verifier using existing keys, GET only                            | Repo root           | 0           | Both providers HTTP 200; complete 15-currency data; root and money parsers return identical snapshots                               |
| Local `/api/fx/rates` request                                                   | Local preview :3012 | 0           | HTTP 200, no-store header, active provider CurrencyBeacon; Redis disabled only in preview process                                   |
| Browser via computer-use, local landing / pricing / About                       | Local preview :3012 | n/a         | Real live provider attribution; monthly/annual conversions and provider timestamp render                                            |
| Browser checkout                                                                | Local preview :3012 | n/a         | Correct sign-in boundary observed; authenticated view unavailable; component tests verify rate/quote propagation                    |
| `node scripts/agents/check-operating-docs.mjs`                                  | Repo root           | 1           | Same 29 pre-existing moved-handoff/frontmatter/link errors; zero errors attributed to this task                                     |
| Root production build/full repository tests                                     | Repo root           | skipped     | Scope checks and dev compilation used; root prebuild deletes shared generated resources; no generator/build mutation was authorized |
| Money lint                                                                      | Money service       | unavailable | No configured package lint script; full TypeScript and scoped formatting used                                                       |

Root combined test paths: five FX suites (including shared-rate-store and display refresh), dLocal converter, locale-context, PriceDisplay, price-display-refresh, attribution and annual-plan. The executable path list is recorded in the task. Focused tests disable global whole-repository coverage thresholds; no whole-repository coverage claim is made.

Live verification confirmed CurrencyBeacon and Frankfurter HTTP 200, complete 15-currency tables and identical root/money parsing. Both configured keys were present and equal; no key values were displayed or added to tracked files. Raw CurrencyBeacon quote values are omitted from this durable report. The timestamp is provider-reported, not an independent observation-time audit.

Saved browser evidence (outside Git, this chat's visualization root): `intraday-fx-pricing.jpg` and `intraday-fx-attribution.jpg` under `C:/Users/WiN/.codex/visualizations/2026/10/12/01a1323c-0036-7632-a207-478fc393b06e/`. The local preview uses its existing USD 29 / 290 configuration; the screenshots are not a production price assertion. No USD base values or database records were changed.

## Review findings

All task findings are corrected and rechecked:

- Root timestamp validation previously accepted hour 24 while money rejected it; both now reject malformed clock components.
- Retained warm-process rates initially could not be read by a cold service after the original first-hour expiry; both now share bounded retained records without resetting timestamps.
- Offline browser state initially outlived the eight-hour limit; independent expiry and resume checks now replace it with fixed reference rates.
- Stalled conversion requests initially hid the selected quote indefinitely; deadline fallback and ownership/sequence guards now settle it safely.
- The first backend mutation survived because its test advanced time using the implementation's TTL. The test now advances an independent literal hour; the same mutant is caught. The client refresh mutant is also caught.

Independent final read-only review found no actionable defect in provider/cache parity, no-store routes, refresh/expiry or quote cancellation. It was an internal cross-scope review, not a fresh-session numbered-order gate. No live money-service boot or actual payment was independently exercised.

## Unconfirmed / found

- Production remains unchanged. No commit, push, merge, deployment, migration or delegation flag action was performed. Both temporary preview processes were stopped.
- The existing dLocal create-payment amount/currency defect remains excluded: routes compute a local amount but submit a USD amount with local currency. Do not treat this FX work as proof of local charging correctness. The defect was identified during the earlier price investigation, which is outside this implementation commit.
- CurrencyBeacon advertises commercial use but has restrictive/ambiguous data-use text. Attribution and eight-hour retention are implemented; the owner must resolve contractual entitlement separately. Frankfurter is daily fallback, not intraday data.
- Same-Redis sharing is covered with deterministic stores, not a live production cache write. Free-plan quota depends on cache sharing and cold-process count; there is no distributed quota lock.
- Browser warnings about legacy middleware, iframe `allowTransparency`, checkout render-time navigation, old Browserslist data and the Windows Watchpack root scan were observed and left outside scope. Disabling Redis for preview also produces unrelated market-cache warnings. The initial sandbox preview could not reach external fonts/providers; the authorized network-enabled preview passed.
- Existing deleted mobile-app files, moved/untracked mobile/design/indicator folders, earlier investigation records and modified `next-env.d.ts` were preserved. Claude shared state and active-tasks were not edited.

## Next action and ownership

Implementation ownership is released. The publication task owns the subsequent authorized commit and push of these scoped files. Another worktree does not automatically receive these changes; transfer an explicit scoped patch or a future authorized commit. The named canonical-state owner may publish this handoff to shared continuity. Activation, contractual clarification and the separate dLocal amount defect belong to their owners; no input is pending for this completed code scope.
