---
type: Concept/Guide
status: active
updated_at: 2026-10-13
---

# Intraday subscription currency conversion

Subscription base prices still come from USD SystemConfig values. Displayed
local prices multiply that USD amount by one complete USD exchange-rate table;
existing currency formatting, annual savings and affiliate discounts still apply.
This integration changes the rate source and refresh behavior, not USD plan prices.

## Server setup

Set `CURRENCYBEACON_API_KEY` separately in the Next server environment and the
money-service environment. For local development those files are `.env.local`
and `money-service/.env`. Restart each process after changing its environment.
Never use a `NEXT_PUBLIC_` key, commit a real key or paste it into a support log.
Requests authenticate with the server's Bearer header, not a credential-bearing URL.

Both applications should use the same configured Redis database. They share
`fx:usd_rates:v2`; the old `fx:usd_rates` record is ignored. Redis records contain
schema version, provider, rates, provider-reported timestamp, original retrieval
time and expiry. A failed Redis read/write is bounded and degrades to independent
process caches. Independent processes can make extra upstream calls and may
observe different snapshots, so shared Redis is recommended for production.
No new package, schema migration, cron job or payment delegation flag is needed.

[CurrencyBeacon's published free plan](https://currencybeacon.com/pricing)
provides hourly data and 5,000 monthly requests. One continuously used shared
cache needs roughly 744 successful hourly fetches in a 31-day month. Retries,
preview environments and concurrent cold processes also consume the account's
quota; the code does not guarantee a global request ceiling.

## Refresh and failure behavior

| Layer / state            | Behavior                                                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| CurrencyBeacon success   | Complete USD table cached for one hour, fetched again on the next request after expiry                                           |
| Configured primary fails | Try Frankfurter and retry the primary after 15 minutes                                                                           |
| Key missing              | Use Frankfurter and cache for one hour; intraday primary data is unavailable                                                     |
| Both providers fail      | Retain a valid previous complete table within its original age bounds; otherwise use canonical fixed reference rates             |
| Shared Redis             | Publish successful or retained provider snapshots with the same expiry and original timestamps; fixed rates remain process-local |
| Open browser             | Check `/api/fx/rates` every five minutes and on focus, visibility return or reconnect; abort/deduplicate overlapping requests    |
| HTTP/browser cache       | FX and successful conversion responses use `Cache-Control: no-store`; provider fetches also bypass Next fetch caching            |
| Stalled local quote      | After ten seconds, show an estimate calculated with the shared table instead of leaving a loading indicator indefinitely         |

The complete table covers USD, GBP, EUR, JPY, INR, NGN, PKR, VND, IDR, THB,
ZAR, TRY, AED, KRW and BRL. Invalid, partial, wrong-base, non-positive,
non-finite, malformed-time or excessively future responses are rejected.

CurrencyBeacon snapshots expire no later than eight hours after their original
retrieval or provider-reported time, whichever is earlier. Reusing a retained
snapshot never resets those timestamps. Frankfurter daily source dates must be
within seven days to accommodate weekends and holidays; our retained copy is
still limited to eight hours. Browser state also expires while offline and on
resume. Complete fixed reference rates provide the final estimate.

[Frankfurter](https://frankfurter.dev/) is a daily reference-rate fallback;
falling back to it does not provide intraday market tracking. Hourly caching is
not streaming FX: provider publication timing, cache expiry and the next browser
check affect when an updated price becomes visible. Small movements may also
round to the same displayed amount.

## Pages and quotes

The root layout seeds LocaleProvider with the server table. The common refresh
hook updates every `formatCurrency` consumer, including landing `/#pricing`,
`/pricing`, Stripe checkout estimates, registration offers, upgrade prompts and
billing plan estimates. dLocal plan cards use that table too. The selected
local-currency summary refetches when the shared snapshot changes; obsolete
amount/currency responses cannot overwrite a newer selection. The conversion
endpoint also accepts BRL, matching the existing Brazil country and converter.
Historical charged receipts keep their original amounts.

Source attribution and the provider-reported timestamp appear on landing,
pricing, checkout and About. The new text is translated in all 19 dictionaries;
dates follow the user's timezone and format preferences. `fetchedAt` is retrieval
time; `rateUpdatedAt` is the provider's date field, normalized to UTC. A source
label is not an independent audit of the provider's market observation time.

Stripe continues charging the existing USD plan amount. Local estimates can
move before purchase. The pre-existing dLocal create-payment payload issue
(USD amount paired with a local currency despite computing a local amount)
remains outside this FX integration; it must be resolved separately before
relying on local-payment charging correctness.

## Provider attribution and data-use terms

About links both providers. CurrencyBeacon's [terms](https://currencybeacon.com/terms)
require credit and limit stored data to eight hours. Its pricing page advertises
commercial use, while its terms also contain product/redistribution restrictions
and a permission to reproduce API data in an application. This documentation
records that ambiguity; the implementation does not establish DavinTrade's
contractual entitlement. Deployment remains a separate owner action.

## Verification and maintenance

The root tests cover hourly price movement, complete-table validation, primary
failure/daily fallback, retained shared snapshots, bounded outages, HTTP cache
headers, browser refresh/expiry, local quote races and provider attribution.
Money-service runs matching provider/cache and converter tests. Root tests have
a separate type-check configuration at `__tests__/tsconfig.fx.json`.

See the [implementation task](../codex/tasks/2026-10-13-intraday-subscription-prices.md)
and [handoff](../handoffs/2026-10-13-intraday-subscription-prices-codex.md) for the
exact checked paths, exits, live-provider and browser evidence, and limitations.
No production environment was changed or deployed by this implementation.
