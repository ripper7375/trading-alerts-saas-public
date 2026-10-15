# WorldGoldMarket build plan

Date: 15 October 2026 · Owner/integrator: Codex · Phase/session unchanged

## Requested result

Add `/worldgoldmarket` to DavinTrade's public marketing shell. Add **WorldGold** after Pricing. Move Docs, Blog and Academy into More on desktop and its secondary section on mobile. Follow the supplied layout's content hierarchy using the app's existing theme, rather than copying its yellow annotation background.

The page lists all ten markets, flags, every supplied local unit, local currency prices, absolute and percentage change from the previous local working close, scheduled open/closed status, local source time, and collapsible official-market/hours/formula details. Translate its interface and reference notes in every one of the 19 existing app locales, including RTL layouts. Use selected numeric/date/time preferences while preserving each market's currency and timezone.

## Implementation sequence

1. **Catalog and arithmetic.** Define UK, Thailand, Hong Kong, Japan, India, UAE, Turkey, Germany/Eurozone, Switzerland and Australia. Normalize FX as local currency per USD, including reciprocal GBP/EUR/AUD pairs. Use exact Thai mass/purity arithmetic. Label Japanese and Indian tax assumptions and Turkey's 1.5% premium/120 TRY estimated mint fee as reference assumptions.
2. **Live inputs.** Read the latest completed XAUUSD M5 bar through the canonical PostgreSQL market client. Fetch CurrencyBeacon fiat rates with the existing server API key; use a separate namespaced cache because the subscription FX contract lacks AUD, CHF and HKD. Apply request timeout, complete/positive-rate validation, source-date validation, hourly refresh, deduplication and eight-hour raw-data retention. Expose missing/delayed sources honestly.
3. **Closing history.** Capture independently of page visits with an authenticated five-minute scheduled endpoint. At each accepted cutoff select gold and FX observations available at or before that cutoff. Store immutable calculated unit prices, formula version and source timestamps in PostgreSQL. Raw FX history expires within eight hours; long-term comparison needs the calculated close, not a retained raw exchange rate. Missing qualifying data remains unavailable. Never backfill yesterday with today's FX. Author a migration; do not apply it to shared databases.
4. **Page and navigation.** Render all ten responsive market rows, accessible collapsible details and refresh/loading/error states. Show all units' matching price/change/percentage. Show actual data attribution and timestamps separately. Integrate all 19 dictionaries and shared locale formatting.
5. **Verification and handoff.** Test formulas for all markets, DST/weekends/overnight sessions, stale data, unavailable and immutable closes, concurrent capture, providers and API authorization. Run runtime and test type checks, relevant lint/format/translation gates, and browser checks at desktop/mobile and RTL locales. Record migration/secret/scheduler prerequisites without changing production.

## Confirmed schedules

Davin accepted these reference benchmarks in this chat. All use IANA timezone rules and Monday–Friday except UAE daily, with Friday opening at 16:00. Public holidays and exceptional closures are unverified and explicitly disclosed.

| Market           | Timezone        | Daily closing benchmark | Other displayed sessions                                               |
| ---------------- | --------------- | ----------------------- | ---------------------------------------------------------------------- |
| UK               | Europe/London   | 17:00                   | 08:00–17:00                                                            |
| Thailand         | Asia/Bangkok    | 17:30                   | 09:00–17:30                                                            |
| Hong Kong        | Asia/Hong_Kong  | 16:30 floor             | Floor 09:00–16:30; electronic 07:00–05:00 next day                     |
| Japan            | Asia/Tokyo      | 15:45 day               | Day 08:45–15:45; night 17:00–06:00 next day                            |
| India            | Asia/Kolkata    | 23:30                   | 09:00–23:30; source's alternative 23:55 excluded by accepted benchmark |
| UAE              | Asia/Dubai      | 22:00                   | 10:00–22:00; Friday 16:00–22:00                                        |
| Turkey           | Europe/Istanbul | 18:00 BIST              | BIST 09:40–18:00; Bazaar 09:00–19:00                                   |
| Germany/Eurozone | Europe/Berlin   | 17:30                   | 09:00–17:30                                                            |
| Switzerland      | Europe/Zurich   | 17:30                   | 09:00–17:30                                                            |
| Australia        | Australia/Perth | 17:00                   | 09:00–17:00                                                            |

## Data decisions and prerequisites

CurrencyBeacon's official [API documentation](https://currencybeacon.com/api-documentation) and [supported-currency list](https://currencybeacon.com/supported-currencies) establish the required fiat currencies; XAU support is not established by that list. PostgreSQL/MT5 therefore supplies XAUUSD. Its M5 price is a completed-bar reference, not a live dealer bid/ask. CurrencyBeacon's hourly cached publication is shown with its actual timestamp; this is not an exact intraminute FX fixing.

Keep the existing subscription/payment FX contract and eight-hour raw-retention guard unchanged. The prior provider manifest records an unresolved data-use entitlement; this implementation does not settle it or extend raw-rate retention. Durable derived-price retention follows the requested comparison design, with that existing operational boundary recorded for the owner.

Production activation requires the migration, DATABASE_URL, REDIS_URL, CURRENCYBEACON_API_KEY, CRON_SECRET and a scheduler supporting five-minute invocation. The first baseline becomes available only after an observed eligible close. Weekend comparisons use the most recent eligible working close; missing expected closes must not silently become an older daily baseline. No migration application, credential changes, deployment, commit or push is part of this implementation request.

## Ownership

Backend, locale and UI files have disjoint owners under the [task record](../docs/codex/tasks/2026-10-15-worldgoldmarket.md). The integrator owns build/dev/check resources. Existing unrelated changes and supplied source files are preserved. The final handoff will report checks and remaining activation steps.

## Final implementation and language loading

Completed locally on 16 October 2026. The canonical translation source remains
the 19 files in `lib/i18n/dictionaries/`. Each contains 76 `worldGold.*` entries.
The WorldGold route synchronously bundles only those entries through
`lib/i18n/world-gold-messages.json` and `world-gold-text.ts`. This avoids the
observed lazy-dictionary fallback for Arabic while leaving the global locale
provider unchanged. Language and format preferences still come from `useLocale()`.

After editing a WorldGold translation, regenerate the route bundle and verify
its canonical parity test:

```powershell
node scripts/i18n/generate-world-gold-messages.cjs
node node_modules/jest/bin/jest.js --runTestsByPath __tests__/components/market/world-gold-market.test.tsx --runInBand --coverage=false
```

The generator does not modify the canonical dictionaries. The parity test
rejects a stale route bundle. Formula labels, country names, schedules,
reference assumptions, source/error/status text and metadata are localized;
technical tickers and official market names remain identifiers. Dates and
session clocks use the shared date/time formatter; already-denominated market
amounts use `lib/i18n/format-local-amount.ts` without subscription conversion.

The final evidence, migration activation boundary and file inventory are in
[the completion report](worldgoldmarket-manifest-work-completion.md) and
[the final handoff](../docs/handoffs/2026-10-16-worldgoldmarket-codex-completion.md).
