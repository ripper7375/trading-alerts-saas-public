---
type: Concept/Handoff
status: completed
updated_at: 2026-10-13
---

# Handoff: subscription price calculation investigation

Date: 2026-10-13, Asia/Bangkok
From / to: Codex primary agent / Davin and the canonical state owner
Task / authorization: [Price trace](../codex/tasks/2026-10-13-subscription-price-trace.md), Davin's direct explanation request
Phase/session: unchanged; ad-hoc investigation
Source: `D:\SaaS Project\trading-alerts-saas-public`, `main`, HEAD `dc8780313f348ef7a668bdf07a981ee2e7969b18`
Status: completed explanation; payment defect identified, implementation outside scope
Uncommitted review snapshot: no diff in the inspected runtime paths; stable HEAD and hashes below

## Needs from Davin

None to complete this explanation. A payment correction is separate work requiring
Davin's authorization. No payment, login, deployment, migration, commit, or push
was performed.

## Changed and verified

Only the task record and this handoff were created. Runtime source remains unchanged.
Two read-only subagents independently confirmed the dLocal amount/currency mismatch.

Public production API responses were read without credentials:

- [Pricing configuration](https://davintrade.app/api/config/affiliate): monthly USD 20,
  annual USD 200, 3-day USD 1.99, configured affiliate discount 20%; lastUpdated
  `2026-09-26T04:02:51.995Z`.
- [Display FX rates](https://davintrade.app/api/fx/rates): source `live`, GBP 0.756 and
  THB 33.53 per USD; fetchedAt `2026-10-12T22:43:57.948Z`, equivalent to
  2026-10-13 05:43:57.948 Asia/Bangkok.

| Screenshot price               | Calculation                        | Result       |
| ------------------------------ | ---------------------------------- | ------------ |
| Landing and Stripe monthly GBP | 20 x 0.756                         | GBP 15.12    |
| Landing annual GBP             | 200 x 0.756                        | GBP 151.20   |
| Thailand 3-day plan            | 1.99 x 33.53 = 66.7247, rounded    | THB 66.72    |
| Thailand monthly               | 20 x 33.53                         | THB 670.60   |
| Thailand annual                | 200 x 33.53                        | THB 6,706.00 |
| Annual savings badge           | round((1 - 200 / (20 x 12)) x 100) | 17%          |

`/#pricing` is the landing page's `LandingPricing` section, not a separate route.
The separate `/pricing` route renders `TierComparison`. Its annual toggle shows
annual USD price divided by 12 before display conversion: GBP 12.60/month,
billed at the USD 200 annual base price (display equivalent GBP 151.20/year).

Sources:

- `components/landing/landing-pricing.tsx:21-36,152-173` uses `useAffiliateConfig`
  and locale formatting; a `?ref=` parameter previews the configured monthly discount.
- `lib/hooks/useAffiliateConfig.ts:151-184` reads `/api/config/affiliate`, refreshes
  every five minutes, and computes the savings badge. The current live configuration
  differs from the loading/error defaults of USD 29 monthly and USD 290 annually.
- `lib/country-config.ts:267-296` multiplies USD by the selected currency's rate;
  formatting uses at most two decimal places, or zero when the converted amount
  is at least 1,000. This explains THB 6,706 in the annual card.
- `lib/context/locale-context.tsx:218-239,483-489` holds server-provided rates,
  refreshes them hourly, and applies the viewer's display currency. GBP can be the
  display preference while Thailand's separate payment-country selection uses THB.
- `lib/fx/usd-rates.ts:35,114-163` reads the exchangerate-api USD table, normally
  cached hourly and shared via Redis. An earlier live table or fixed rates may be
  used on failure. The fixed fallback rates include GBP 0.78 and THB 35.0.
- `components/payments/PlanSelector.tsx:64-74` formats the same USD bases using
  the chosen dLocal country's currency, independent of display currency.
- `app/checkout/page.tsx:432-471` shows the Stripe USD base converted for display
  and explicitly identifies the result as approximate. Card issuer FX determines
  the payer's actual local equivalent.
- `lib/stripe/stripe.ts:93-129` and money-service's equivalent build Stripe prices
  in USD cents. Automatic tax is enabled, so hosted checkout tax can affect the
  final total. A validated affiliate code applies a one-invoice discount;
  displayed plan cards continue to show the undiscounted base. Stripe code also
  configures a seven-day trial, a separate billing-timing detail from the paid
  dLocal three-day plan.

## Review findings

Confirmed source defect: dLocal receives a USD numeric amount with a local currency.
Both create paths compute and store `localAmount`, but pass `amount: chargeUsd`
with the selected local currency to `createPayment`:

- `app/api/payments/dlocal/create/route.ts:269-272`
- `money-service/src/dlocal/dlocal-payment.controller.ts:225-228`

The provider adapters serialize these fields unchanged:

- `lib/dlocal/dlocal-payment.service.ts:64-79,109`
- `money-service/src/dlocal/dlocal-payment.service.ts:101-116,146`

The primary [dLocal Create payment reference](https://docs.dlocal.com/reference/create-payment)
requires `amount` in the supplied `currency`. Therefore `{ amount: 20, currency:
"THB" }` describes THB 20, not USD 20 converted to THB 670.60. No second conversion
occurs in the adapters. Whether the production provider accepted or charged any
such request is unconfirmed. No purchase was executed. Neither implementation
was changed, and this explanation does not grant authority to fix payments.

The intended dLocal quote calculation is: round USD discount to cents, subtract it,
round USD net to cents, then round USD net x the country FX rate to two decimals.
The three-day plan disallows affiliate discount. Renewal/timing and availability
rules are separate from the price calculation.

## Verification

All command cwd values below are the repository root.

| Command / check                                 | Exit | Pass/fail/skip       | Evidence / limitation                                                                          |
| ----------------------------------------------- | ---- | -------------------- | ---------------------------------------------------------------------------------------------- |
| Git branch, HEAD, status and scoped source diff | 0    | pass                 | main and stable HEAD; inspected runtime files have no diff                                     |
| Public API reads with Invoke-RestMethod         | 0    | pass                 | Exact USD and FX values above; reviewed network escalation used                                |
| Node arithmetic assertions                      | 0    | 7 pass               | All screenshot values, annual equivalent and savings badge                                     |
| Primary dLocal contract review                  | n/a  | pass                 | Required amount unit independently confirmed by two reviewers                                  |
| Operating-document checker                      | 1    | 29 existing failures | All concern pre-existing deleted/moved handoffs and their links/frontmatter; no new task error |
| Targeted document formatting and diff checks    | 0    | pass                 | Targeted Prettier and git diff --check passed; no source edit                                  |
| Runtime tests, build, production charge         | n/a  | not run              | No code edit; builds/charges unnecessary and outside explanation scope                         |

Web retrieval of the site initially failed, and sandboxed network reads were denied.
Reviewed read-only network escalation returned the public API responses successfully.
Unrelated pre-existing deletions and moved/untracked documents remain untouched.

## Reviewed source hashes

SHA-256 at stable HEAD; no runtime writes were performed:

```text
components/landing/landing-pricing.tsx 0B142B1E946A1915EBA6A437087F0AF5EA174A6642FDF4EB0CDB342A37DA4E86
components/pricing/tier-comparison.tsx C8ECBA95E358C6A5F92571F574B54E0B4FAC5B0CEBF834E3CE93F535FE451AF8
lib/hooks/useAffiliateConfig.ts 8A18D9AA3DDFE73413BCBE23706A1426F4D72528FE493728CA821496C30163BF
lib/country-config.ts 2F274AE8EF71DA2E6222CF8D18D58EB3482A0C3529A20C609CC895892F88366F
lib/fx/usd-rates.ts 0B19769C9FE4A5CC11EBB4429A06FB5979BBFEB11AEC76BC054B7EFC717FBE45
app/checkout/page.tsx 2A0BD5934A69CADC51ACDEEFA110991108C305AEEAB9FE5F1E57ED4EEEFEDA93
app/api/payments/dlocal/create/route.ts D9C4816EC38CC82DDDA3E32FE6B56BACD0154C81E9E32060FD5E67767E28140B
lib/dlocal/dlocal-payment.service.ts DA6DDD4BFFAEAE3FB6D40FA3D6CADDF48D0E5FAD1A77D9449A7795B168002231
money-service/src/dlocal/dlocal-payment.controller.ts 181930A04289AFE1550CEAD51A3782D8C8DFAD8DDAC70A1BF2742A6C10C8E2DB
money-service/src/dlocal/dlocal-payment.service.ts 1336731C9CBCAEE591CC76517C8A969AD366538FF4C4BA4448006D19DAC82EDC
```

## Next action and ownership

Explanation scope complete. Davin may assign a targeted payment correction and
validation as a separate task. No production route/flag or actual transaction was
verified. Shared Claude state and Codex continuity were not claimed or modified;
this report remains available to their named state owner. No ownership transfer
or external message was performed.

## Follow-up: why prices change infrequently

Davin asked why converted prices rarely change while market FX continues moving.
Read-only follow-up reviewed at HEAD `d07855d9faa0de0cf7c535b456962d71d47ffab5`;
other repository work advanced HEAD between questions. Relevant source remained
unchanged in the worktree, and the earlier recorded FX/formatter hashes still match.

- Provider's [official data policy](https://www.exchangerate-api.com/product/our-exchange-rate-data)
  documents new Free & Open data every 24 hours. These are composite indicative
  midpoint rates, so a market quote moving intraday does not imply this feed changes.
- The [observed legacy v4 response](https://api.exchangerate-api.com/v4/latest/USD)
  is dated 2026-10-12, with `time_last_updated: 1791763202`, equivalent to
  2026-10-12 07:00:02 Bangkok. GBP 0.756 and THB 33.53 remain unchanged.
  Daily cadence for legacy v4 is an inference supported by the general Free/Open
  policy and snapshot; no surviving official v4-specific cadence guarantee was found.
- App data cache and shared Redis cache use one hour (`lib/fx/usd-rates.ts:34`,
  `lib/fx/shared-rate-store.ts:24`). Display calls can return an expired table while
  refreshing in the background (`lib/fx/usd-rates.ts:143-148`).
- The public display API additionally permits one-hour shared HTTP caching and
  ten minutes of stale-while-revalidate (`app/api/fx/rates/route.ts:23`).
- An open page requests refreshed display rates once per hour, not on every market
  tick (`lib/context/locale-context.tsx:223-236`).
- Formatting rounds prices to two decimals, or zero for amounts at least 1,000
  (`lib/country-config.ts:292-295`), so small changes can remain invisible.
- If upstream fetch fails, the app preserves an earlier live table and retries after
  five minutes; fixed rates are used when no live table is available. This behavior
  is verified in source, but no current outage was established.
- `source: live` means the table came from the provider; `fetchedAt` is when the app
  fetched it. The code does not retain upstream `time_last_updated`, so that label
  and timestamp do not establish continuously current market pricing.

Clarification to the previous answer: an hourly app refresh describes retrieval
cadence, not the provider's data publication cadence. Reducing the app cache alone
would not create more frequent upstream updates. No product behavior was changed.

Verification: source reads, HEAD/hash checks and provider documentation review
passed; the provider cadence was independently checked by a read-only subagent.

## Follow-up: provider identity and faster plans

Davin asked who supplies the rates and whether more frequent updates are available.
Current primary [provider pricing](https://www.exchangerate-api.com/) identifies
ExchangeRate-API as a product of AYR Tech (Pty) Ltd and lists monthly billing:
Free USD 0 (daily), Pro USD 10 (60-minute updates), Business USD 30 (five-minute
updates). The detailed pricing/data policy is more specific than an older generic
homepage FAQ statement that all paid users receive hourly data.

The [standard v6 endpoint](https://www.exchangerate-api.com/docs/standard-requests)
requires an API key and returns `conversion_rates`. Both existing FX modules call
the legacy no-key v4 endpoint and parse `rates`. A paid upgrade therefore needs
server-side endpoint/authentication and response-parsing integration; the current
URL would not become an authenticated paid feed merely by buying a plan. To use
five-minute data promptly, the shared/server/HTTP/browser one-hour caches and
refreshes also need a coordinated adjustment. No purchase or implementation was
requested or performed. Current published plan prices were verified by browsing;
no provider account or credentials were accessed. Source reads exited 0.

## Follow-up: Yahoo Finance free FX evaluation

Davin asked to check Yahoo Finance as a possible free provider with more frequent
FX updates. Two read-only reviewers separately checked technical access and
primary Yahoo data/usage documentation. Scope was research only; the current
subscription source and all money behavior remain unchanged.

### Findings

- Yahoo's [market-data provider table](https://help.yahoo.com/kb/finance/article-exchanges-data-delays-sln2310.html)
  labels global currency rates (`=X`) real-time, supplied by ICE Data Services.
  Yahoo's USD/GBP and USD/THB quote pages also display a generic delayed-quote
  label. The provider table establishes availability of intraday FX information,
  not a contractual promise of an update every specified minute for every pair.
- `GBP=X` represents USD/GBP and `THB=X` USD/THB, matching target-currency units
  per USD used by the current converter. `GBPUSD=X` is the inverse direction.
  Sources: [USD/GBP](https://uk.finance.yahoo.com/quote/GBP%3DX/) and
  [USD/THB](https://finance.yahoo.com/quote/THB%3DX/).
- The independent [yfinance download documentation](https://ranaroussi.github.io/yfinance/reference/api/yfinance.download.html)
  supports one-, two- and five-minute bars. Its
  [history source](https://raw.githubusercontent.com/ranaroussi/yfinance/main/yfinance/scrapers/history.py)
  uses Yahoo's chart endpoint. A bar resolution is not a source freshness guarantee
  or an authorized request quota.
- I found no published, supported Finance/FX API offering or commercial free API
  entitlement in [Yahoo's developer catalog](https://developer.yahoo.com/api/).
  This is a search finding, not proof that private agreements cannot exist.
  The [yfinance project](https://github.com/ranaroussi/yfinance) explicitly says
  it is unaffiliated with Yahoo and intended for research/education; its README
  describes Yahoo data API use as personal use.
- Yahoo Finance's own market-data help states that information displayed or
  provided by Yahoo Finance must not be redistributed. The
  [general Yahoo terms](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html)
  require prior permission for automated collection and restrict commercial reuse
  unless expressly allowed. Free access to website quotes does not establish
  permission to retrieve and use them in this commercial SaaS. No finance-specific
  permission for this use was found. Advertising API terms and Finance Community
  terms were excluded as unrelated evidence. This report identifies published
  terms, without deciding how a legal exception or private contract might apply.
- Current application hourly caches/HTTP caching/browser refresh would still
  limit visible updates after a source switch. A prospective adapter would also
  need symbol coverage, correct pair direction, quote timestamps separate from
  retrieval time, rate validation, stale-data handling and bounded fallback.

### Bounded live probe

Two read-only requests were attempted, one per pair, without credentials or
workarounds:

```text
https://query1.finance.yahoo.com/v8/finance/chart/GBP%3DX?interval=1m&range=1d
https://query1.finance.yahoo.com/v8/finance/chart/THB%3DX?interval=1m&range=1d
```

Each timed out after 15 seconds. Consequently no actual rate, one-minute bar or
freshness timestamp was obtained. The script exited 0 because it reports each
request failure as structured output; this is two failed probes, not a passed
live-data test. Web fetches for Yahoo's help and quote pages also returned HTTP
429; indexed primary-source Yahoo content was available for research. There were
no retries, proxy/identity changes, access-control bypasses or high-frequency
polling. These local failures do not establish that Yahoo fails everywhere.

### Conclusion and verification

Yahoo's data can be more frequent than the current daily indicative feed.
A supported, commercially permitted free Yahoo Finance FX API was not verified;
I do not recommend replacing the production subscription feed on the basis of
public website quotes or an unofficial library alone. No switch, implementation,
contact, purchase or account action was performed.

Independent reviews are complete. Source/document reads exited 0; the two live
probes failed as noted. Runtime tests/build were not run because there was no
runtime source change. Operating-document checks retain the separately recorded
pre-existing failures; targeted Prettier and git diff --check exited 0, and scoped task validation has zero errors. The full operating-doc checker exited 1 with the same 29 unrelated existing failures.

## Follow-up: free provider recommendations for DavinTrade

Davin requested searching and recommending other appropriate FREE exchange-rate
providers. Research and independent reviews covered current primary pricing,
commercial-use terms, cadence, coverage and the existing shared rate architecture.
No provider registration, API key, purchase, contact, implementation or deployment
was performed. Main remains `d07855d9faa0de0cf7c535b456962d71d47ffab5`.

### Application requirements and quota arithmetic

The app needs 15 display currencies: GBP, INR, NGN, PKR, VND, IDR, THB, ZAR, TRY,
USD, EUR, JPY, AED, KRW and BRL. The dLocal payment subset contains INR, NGN, PKR,
VND, IDR, THB, ZAR, TRY, AED and BRL. USD base fits both displays and current payment
conversion; the conversion itself is multiplication, so a paid conversion endpoint
is unnecessary when the rate-table license permits the intended use.

One shared rate-table request per hour consumes at most 744 requests in 31 days.
A 15-minute schedule uses 2,976; a five-minute schedule uses 8,928. Independent
hourly root/money-service requests would consume 1,488. Preserve one centrally
shared fetch/table to keep free quota use independent of page-view counts.
The current Redis design shares a table, but per-process race/refresh behavior is
not a hard global quota guarantee. Account traffic and failures would need budget.

The current `GET /api/fx/rates` publishes the display rate table and the dLocal
converter uses the same underlying table. A display-only provider cannot simply
replace this shared source if its terms exclude deriving payment amounts.

### Ranked shortlist

| Provider         | Current permanent free offer                                                                                                       | Fit / limitation                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CurrencyBeacon   | 5,000 calls/month, hourly, USD base, key required; all 15 currencies documented                                                    | Strongest technical free-hourly candidate. Production licensing needs clarification because actual terms conflict with commercial-use/app reproduction statements. |
| Frankfurter v2   | No key; no monthly/daily quotas, abuse rate limits; daily central-bank/official-source rates; all 15 current currencies documented | Most clearly documented free commercial API option, subject to underlying provider terms. Suitable daily fallback; it does not solve intraday freshness.           |
| exchangerate.dev | 5,000 calls/month, 10/min; indicative live observations delayed 15 minutes; commercial display with linked credit                  | Display-only candidate. Current pricing/methodology prohibits payment processing/execution; all required numeric coverage and freshness were not live verified.    |
| ExchangeRate.fun | Advertises free commercial use, hourly, no key or formal quota; samples include all 15                                             | Experimental only. Community operator, upstream identities/ingestion unverified and no successful live probe; not recommended as primary payment source.           |

**Recommendation:** shortlist CurrencyBeacon for an hourly display integration,
conditional on resolving its actual data-use terms, and Frankfurter as the daily
fallback candidate. Do not describe either as an already tested production feed.
No unconditional free hourly replacement for the full display-and-payment source
was established. A provider decision and implementation are separate work.

### Primary evidence and specific limitations

CurrencyBeacon:

- [Pricing](https://currencybeacon.com/pricing) advertises free 5,000 calls/month,
  hourly refresh, HTTPS/commercial use across its comparison. Free is described
  as a developer sandbox; base switching and guaranteed uptime SLA are absent.
- [Currency catalogue](https://currencybeacon.com/supported-currencies) lists all
  15 app currencies. [API docs](https://currencybeacon.com/api-documentation)
  require a key; USD is the default base, so free base switching is unnecessary.
- [Terms](https://currencybeacon.com/terms) section 4.2(d)/(e) restrict incorporating
  the product in services and data redistribution, while the subsequent API
  paragraph permits data reproduction in applications with credit in a terms/about
  page. That paragraph caps storing/caching at eight hours. These inconsistent
  provisions prevent an unqualified commercial-production recommendation. The
  existing public raw-table route and indefinite retention of earlier rates on
  repeated upstream failure would need specific attention in an authorized design.
  No contact requesting clarification was made.

Frankfurter:

- [Homepage and FAQ](https://frankfurter.dev/) explicitly allow commercial API use,
  say no keys and no monthly/daily quotas, and list SaaS billing as an intended use.
  Underlying provider terms still apply; this is not a claim of unrestricted raw
  data redistribution or a contractual SLA.
- The [v2 catalogue](https://frankfurter.dev/currencies/) currently lists 165 active
  and 58 archived codes (223 total). Independent review found every app code with
  coverage through present. Old ECB-only v1 currency lists are not the current v2
  coverage. Daily means no improvement over the current provider's daily schedule.

exchangerate.dev:

- [Current pricing](https://exchangerate.dev/pricing) shows $0 forever, 5,000/month,
  10/min and 15-minute-delayed observations, with visible linked credit for commercial
  display. Delay is not a guaranteed update interval; some currencies use daily fixes.
- [Terms revised 12 October 2026](https://exchangerate.dev/terms) and
  [methodology](https://exchangerate.dev/methodology) restrict this to indicative
  information and prohibit settlement/payment execution. Raw or derived rate data
  through an app's own API also requires a separate agreement. It is not suitable
  for a drop-in shared dLocal charge-rate replacement. Current pricing/docs mention
  broad intraday coverage, but all 15 numeric quotes were not verified here. Older
  localized pages have conflicting counts/quotas/terms; current terms take precedence.

ExchangeRate.fun:

- [Usage docs](https://exchangerate.fun/docs/) explicitly state free personal and
  commercial use and claimed hourly updates; sample includes all required codes.
- [Maintainer repository](https://github.com/haxqer/FreeExchangeRateApi) contains
  documentation rather than verifiable ingestion code. An open-source label and
  ten-year pledge do not verify source freshness, upstream licensing or availability.

### Exclusions

- Open Exchange Rates: [free pricing](https://openexchangerates.org/signup) is
  hourly/1,000 requests/month/USD and catalogue includes all required currencies.
  Its [FAQ](https://openexchangerates.org/faq) directs commercial/business/shopping
  cart use to paid plans; no explicit free commercial authorization was verified.
  Treat this as ambiguous eligibility, not a proven categorical legal prohibition.
- [CurrencyAPI.net](https://currencyapi.net/pricing/),
  [currencyapi.com](https://currencyapi.com/pricing/), and
  [exchangerate.host](https://exchangerate.host/pricing) explicitly limit their free
  plans to personal/private/noncommercial use. Their headline update frequencies
  must not be mistaken for commercial free-plan rights.
- [FCS](https://fcsapi.com/terms), [Twelve Data](https://twelvedata.com/terms) and
  [Alpha Vantage](https://www.alphavantage.co/terms_of_service/) have free commercial
  or external-display restrictions. Free Alpha Vantage quota is also 25 calls/day.
- CurrencyFreaks and fxapi permanent free data remains daily. TraderMade is a
  temporary live-data trial, not a permanent free feed. AllRatesToday's current
  [docs](https://allratestoday.com/docs) describe 300 lifetime calls, despite older
  documents claiming a monthly allowance. None provides the requested sustainable
  free commercial intraday replacement on the verified evidence.
- fxratesapi.com's official page only rendered Loading; relevant free terms and
  cadence remained unverified, so it is not recommended from that evidence.

### Verification and unavailable checks

Primary research and three read-only reviewer assignments are complete. Source
currency inspection and quota arithmetic exited 0. OXR, CurrencyBeacon and
Frankfurter coverage was verified in their published currency catalogues; this
is not a live-rate or uptime test. No account keys were obtained for the keyed APIs.

One anonymous request each to Frankfurter v2, ExchangeRate.fun and exchangerate.dev
was attempted after reviewed network escalation. All timed out at 15 seconds.
Wrappers exited 0 because errors were caught and printed; live probes are 0 passed,
3 failed. No actual numeric rate table or source timestamp was verified by these
probes. No retry, proxy/identity workaround or access-control bypass occurred.
These environment failures do not establish global provider unreliability.

Operating-document checker results remain separate from runtime recommendations.
No runtime test, build or payment was run because source remained unchanged.
