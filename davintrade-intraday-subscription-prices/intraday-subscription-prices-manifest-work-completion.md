---
type: Concept/Manifest
status: completed
updated_at: 2026-10-13
owner: Codex
---

# Intraday subscription prices — Manifest of Work Completion

**Date:** 2026-10-13, Asia/Bangkok.
**Branch:** `main`; implementation branch `codex/intraday-subscription-prices`, merged through [PR #480](https://github.com/ripper7375/trading-alerts-saas-public/pull/480).
**State:** implementation complete, verified and published; merged to main; CurrencyBeacon observed on the public production pricing endpoint and landing page. Live money-service deployment, production Redis sharing and actual payments were not verified by this work.
**Source at manifest creation:** local `main`, HEAD `f7d7368650179a0a4958133c451cc3f1ba6f2702`.
**Approved by Davin in chat:** investigate subscription calculations and rate freshness; evaluate Yahoo Finance and other free providers; implement CurrencyBeacon hourly rates with Frankfurter fallback across relevant pages on a separate feature branch; then commit and push without creating a pull request. Davin subsequently reported creating and merging the pull request, requested the annual calculation check, and requested this completion manifest.

This manifest consolidates all five reports in this folder. Its numbered structure follows the [SystemConfig completion manifest](../davintrade-systemconfig/systemconfig-fix-manifest-work-completion.md). Earlier reports describe their own stage: statements such as “not committed,” “main unchanged” or “production unchanged” are superseded where later publication, merge or production observations establish a newer result. The original reports remain unchanged.

---

## 0. Summary

The original subscription prices were USD SystemConfig amounts converted into the viewer's currency. The app retrieved rates hourly, but its free ExchangeRate-API feed published daily data. Hourly retrieval therefore rarely changed the prices. Additional HTTP caching, hourly browser polling and display rounding could delay or hide a visible change.

Davin selected CurrencyBeacon for hourly data and Frankfurter for a daily fallback. Both the Next app and money-service now use that hierarchy, validate a complete USD rate table, share provider and freshness metadata through a versioned Redis record, and bound retained data. Open pages check the common table every five minutes and on focus, visibility return or reconnect. Source attribution identifies the actual provider used for the current snapshot.

USD prices, annual pricing, affiliate discounts, payment/grant rules and historical receipts retain their existing behavior. This work improves display and quote freshness; it does not resolve the separate dLocal amount/currency payload defect identified during the initial investigation.

| Check or outcome                        | Recorded result                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Root runtime and scoped test TypeScript | Exit 0; tests checked separately from root runtime types                                                      |
| Implementation root Jest                | 11 selected suites, 176 tests; passed in local timezone and UTC                                               |
| Implementation money-service Jest       | 3 selected suites, 61 tests; passed in local timezone and UTC                                                 |
| Publication full root Jest gate         | **351 suites / 9,750 tests**, exit 0; global coverage thresholds passed                                       |
| Publication fixture checks              | 2 suites / 46 tests, exit 0 after adapting old provider fixtures                                              |
| Mutation checks                         | Both deliberate cache/refresh interval mutants caught; byte-exact restoration verified                        |
| Provider verification                   | CurrencyBeacon and Frankfurter HTTP 200; complete 15-currency tables and root/money parser parity             |
| Local browser                           | Landing, pricing and About attribution verified; authenticated checkout unavailable                           |
| Publication                             | `cc5fc9f5` implementation and `c6f71a2c` documentation closure published                                      |
| Main integration                        | PR #480 merge recorded as `afc25efb`; current local main contains both publication commits                    |
| Public production observation           | Annual-price check read HTTP 200 configuration and active CurrencyBeacon snapshot matching Davin's screenshot |
| Annual calculation                      | Ten-month USD ratio and GBP display correct; 16.6667% savings rounded to 17%                                  |

These application test totals are historical gates from implementation/publication. They were not rerun against the later main HEAD merely to create this document. The manifest's own checks are recorded in §12.3.

---

## 1. What the audit found

| Area                       | Finding                                                                                                      | Effect                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Subscription base prices   | Public configuration supplied USD 20 monthly, USD 200 annual and USD 1.99 for the three-day plan             | Display prices came from configuration, rather than hardcoded local plan prices                               |
| Landing and pricing routes | `/#pricing` is the landing section; `/pricing` is a separate route with a billing toggle                     | Annual mode on `/pricing` shows annual price divided by twelve as a monthly equivalent, plus the annual total |
| Legacy rate source         | ExchangeRate-API's free/open policy described daily updates                                                  | More frequent app checks could not create intraday source data                                                |
| App delivery               | One-hour server/Redis caching, hourly browser refresh and additional shared HTTP caching                     | Source publication and app delivery both limited visible changes                                              |
| Rounding                   | Currency formatting rounded after conversion; values at least 1,000 used zero maximum decimal places         | Small rate movements could leave displayed figures unchanged                                                  |
| Payment currency selection | Viewer display currency and dLocal country currency are separate choices                                     | A GBP display preference and Thailand's THB checkout selection can coexist                                    |
| dLocal create payload      | Both create paths computed a local amount but supplied a USD numeric amount with the selected local currency | Separate payment correctness defect; no transaction was executed or corrected in this scope                   |

The research also evaluated Yahoo Finance and other free candidates. Yahoo exposed intraday FX information, but a supported free API entitlement for this commercial use was not established; two bounded live probes timed out. CurrencyBeacon was shortlisted for hourly data and Frankfurter v2 for daily fallback. exchangerate.dev had payment-use restrictions, and ExchangeRate.fun lacked verified upstream/operational evidence. Other candidates failed the recorded cadence, quota or free commercial-use criteria.

Those are research findings recorded on 2026-10-13, rather than newly revalidated provider offers. Initial anonymous provider probes failed in the research environment; later keyed/local implementation verification succeeded. The [price-trace report](2026-10-13-subscription-price-trace-codex.md) retains the detailed comparisons and primary-source links.

---

## 2. Decisions

| ID  | Decision                                                                                                                          | Authority or basis                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| D1  | Use CurrencyBeacon hourly rates as primary and Frankfurter v2 reference rates as fallback                                         | Davin's direct implementation request                               |
| D2  | Implement on `codex/intraday-subscription-prices`                                                                                 | Davin's separate-feature-branch request                             |
| D3  | Keep the key server-only in each app; authenticate using a Bearer header                                                          | Implemented design; no `NEXT_PUBLIC_` key or credential-bearing URL |
| D4  | Use one complete USD table covering all 15 supported currencies                                                                   | Shared display/converter contract and provider validation           |
| D5  | Cache successful primary data for one hour; retry configured-primary failure after 15 minutes; missing-key fallback caches hourly | Implemented cache policy, exercised by tests                        |
| D6  | Share versioned metadata and original expiry through `fx:usd_rates:v2`                                                            | Root/money consistency and bounded retained-data design             |
| D7  | Poll open pages every five minutes and refresh on focus, visibility return and reconnect; remove extra HTTP caching               | Intraday display propagation requirement                            |
| D8  | Preserve USD SystemConfig prices, discounts, grants, payment payload semantics and historical receipt amounts                     | Explicit implementation scope                                       |
| D9  | Publish the feature branch without creating a PR                                                                                  | Davin's later commit/push instruction; Codex complied               |
| D10 | Create and merge the PR into main                                                                                                 | Subsequently reported by Davin; local Git records PR #480           |
| D11 | Keep the existing annual calculation and rounded savings label                                                                    | Later live configuration/formatter check found no defect            |

The annual USD amount remains an independently configurable SystemConfig value. The verified USD 20/200 configuration happens to equal ten months; the code does not permanently enforce `annual = monthly × 10`.

---

## 3. What changed: providers, shared cache and freshness

**Provider requests.** Both apps request a complete CurrencyBeacon USD table from `https://api.currencybeacon.com/v1/latest`. A missing key, unavailable request or rejected response selects Frankfurter v2 at `https://api.frankfurter.dev/v2/rates`. A provider request has a three-second timeout and bypasses fetch caching. The apps choose one complete provider snapshot at a time.

**Coverage and validation.** The table covers USD, GBP, EUR, JPY, INR, NGN, PKR, VND, IDR, THB, ZAR, TRY, AED, KRW and BRL. Validation rejects incomplete tables, incorrect base/identity data, non-positive or non-finite rates, malformed dates and unacceptable source timestamps. Root and money-service parsers are checked for parity.

**Shared record.** Redis uses `fx:usd_rates:v2`, schema version 2. Records contain the rates, provider, provider-reported source time, original retrieval time and expiry. The old `fx:usd_rates` record is ignored. Readers honor the publisher's expiry, including the shorter configured-failure retry. Bounded Redis failures degrade to independent process caches; fixed reference tables remain process-local.

| State                                      | Behavior                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Valid process/shared record                | Use its provider and data until expiry before requesting a provider                                        |
| CurrencyBeacon succeeds                    | Cache for one hour; request again after expiry when a caller needs rates                                   |
| Configured CurrencyBeacon fails            | Try Frankfurter; retry the primary after 15 minutes on the next eligible request                           |
| Key absent                                 | Use Frankfurter and cache for one hour                                                                     |
| Both providers fail                        | Retain a valid previous complete table within its original age bounds; otherwise use fixed reference rates |
| Retained table shared with another process | Preserve original source/retrieval timestamps; re-sharing does not reset its age                           |

CurrencyBeacon retention is capped at eight hours from original retrieval or provider time, whichever is earlier. Frankfurter's daily source date may be up to seven days old to accommodate weekends/holidays, while the retrieved copy is still limited to eight hours. Browser state also expires during an outage or after offline suspension.

`rateUpdatedAt` records the provider's source field; `fetchedAt` records app retrieval. Source timestamps are provider-reported metadata, not an independent audit of market observation time. Hourly data and request-driven expiry do not promise continuous market-tick pricing.

---

## 4. What changed: pages and checkout quotes

- The existing root layout seeds `LocaleProvider`; the common refresh hook checks `/api/fx/rates` every five minutes and on focus, visibility return or reconnect, with request deduplication/cancellation.
- Shared currency formatting propagates new snapshots to landing `/#pricing`, `/pricing`, Stripe checkout estimates, registration offers, upgrade prompts and billing plan estimates. Historical charged receipts keep their original values.
- Landing, pricing, checkout and About display the current provider attribution and provider timestamp. Five new attribution keys are translated across all 19 dictionaries; dates follow user preferences.
- dLocal plan cards and the selected quote use the shared table. The quote refetches when the table changes, and obsolete amount/currency responses cannot overwrite a newer selection.
- A selected quote has a ten-second deadline; on failure or a stalled response it settles to an estimate from shared/canonical rates. Offline and stale-response behavior is bounded.
- The public conversion route accepts BRL, matching existing Brazil/converter support.
- FX and successful conversion responses use `Cache-Control: no-store`, preventing another browser/CDN cache interval from hiding server updates.

Stripe continues charging the existing USD plan amount. Converted display prices are indicative; the card issuer determines its own conversion. This feature does not prove correct local-provider charging or change the excluded dLocal payload behavior.

---

## 5. Guard and mutation checks

Implementation review corrected timestamp validation parity, sharing of age-bounded retained snapshots with cold readers, offline browser expiry and stalled/obsolete quote behavior. Final separate read-only review found no actionable defect in the reviewed provider/cache, refresh/expiry or quote-cancellation scope.

Two deliberate interval mutations were tested: backend hourly cache and five-minute client refresh. The first backend mutation initially survived because a test advanced time using the implementation's own TTL. The test was changed to advance an independent literal hour; the mutation then failed. Both final mutants were caught, original files were restored byte-exact, and restored targeted checks passed.

No dependency, schema, generated client, auth or payment delegation flag change was required. Real environment files were ignored and excluded from publication; key values were not printed or committed.

---

## 6. Tests added or changed

| Test or configuration                                                                             | What it verifies                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `__tests__/lib/fx/usd-rates.test.ts`                                                              | Primary/fallback selection, hourly movement, retry, retained snapshots and shared-cache behavior                   |
| `__tests__/lib/fx/shared-rate-store.test.ts`                                                      | Versioned complete records, timestamps, expiry and Redis failure handling                                          |
| `__tests__/lib/fx/usd-rates-parity.test.ts`                                                       | Shared/canonical fallback consistency                                                                              |
| `__tests__/lib/fx/public-rate-routes.test.ts`                                                     | Public snapshot/conversion contract and no-store responses                                                         |
| `__tests__/lib/fx/display-refresh.test.tsx`                                                       | Browser interval, focus/resume/reconnect, cancellation and expiry                                                  |
| `__tests__/lib/dlocal/currency-converter.test.ts`                                                 | Converter use of the common table and fresh conversion behavior                                                    |
| `__tests__/components/payments/{PriceDisplay,price-display-refresh,fx-rate-attribution}.test.tsx` | Quote refresh, deadline/race behavior and correct attribution                                                      |
| `__tests__/tsconfig.fx.json`                                                                      | Separate type coverage for changed tests, including the later real-reader fixtures                                 |
| `money-service/src/fx/{rate-providers,usd-rates}.spec.ts`                                         | Matching provider parsing, cache and age-bound behavior                                                            |
| `money-service/src/dlocal/currency-converter.service.spec.ts`                                     | Existing converter assertions adapted to the new provider fixture                                                  |
| `__tests__/e2e/dlocal-payment-flow.test.ts` and `__tests__/integration/payment-creation.test.ts`  | Complete CurrencyBeacon fixtures, deterministic fallback and preserved payment/grant assertions during publication |

Existing locale-context and annual-plan tests were also included in the implementation checks.

| Recorded gate                                                    | Stage / cwd                      | Exit        | Result or limitation                                                             |
| ---------------------------------------------------------------- | -------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| Root `tsc --noEmit --incremental false`                          | Implementation/publication; root | 0           | Runtime types; existing generated clients, no regeneration                       |
| `tsc -p __tests__/tsconfig.fx.json --noEmit --incremental false` | Implementation/publication; root | 0           | Changed test types; expanded for publication fixtures                            |
| Scoped ESLint / Prettier / whitespace                            | Implementation/publication; root | 0           | Changed scope passed; implementation lint used zero-warning limit                |
| Selected root Jest                                               | Implementation; root             | 0           | 11 suites / 176 tests, local timezone and UTC                                    |
| Selected money Jest and package tsc                              | Implementation; money-service    | 0           | 3 suites / 61 tests, local timezone and UTC; package types passed                |
| Full Jest `--bail --maxWorkers=2 --passWithNoTests --silent`     | Publication; root                | 0           | 351 suites / 9,750 tests and global coverage thresholds passed                   |
| Focused real-reader fixture rerun                                | Publication; root                | 0           | 2 suites / 46 tests                                                              |
| Cache/refresh mutations                                          | Implementation; root             | 0 harness   | Both mutants exited 1 as intended; originals restored                            |
| Live provider requests and parser parity                         | Implementation; root             | 0           | Both providers HTTP 200 and all 15 currencies                                    |
| Local browser evidence                                           | Implementation; local preview    | n/a         | Landing/pricing/About checked; sign-in boundary prevented authenticated checkout |
| Actual primary request after restart advice                      | Follow-up; root                  | 0           | Complete table in 934 ms using the existing local key                            |
| Production annual/configuration check                            | Follow-up; root                  | 0           | Public HTTP 200 responses and five formatter/arithmetic assertions               |
| Production build / shared generators                             | Implementation/publication       | Not run     | Deliberately excluded; no schema/client changes                                  |
| Money-service lint                                               | Implementation                   | Unavailable | No configured lint script; types/tests/formatting used                           |

The initial publication full gate failed on a remaining partial legacy-provider fixture. The two affected suites were adapted to complete CurrencyBeacon responses without weakening the expected NGN amount or payment/grant assertions; the full rerun passed. Publication coverage was statements 61.71%, branches 53.82%, functions 57.99% and lines 61.93%.

---

## 7. Publication, merge and activation

### 7.1 Recorded publication and main integration

- Implementation: [`cc5fc9f5`](https://github.com/ripper7375/trading-alerts-saas-public/commit/cc5fc9f56de8075d74a11416c82c3883a7806b66), `feat(fx): refresh subscription conversions with hourly rates`; exactly 59 allowlisted files.
- Documentation closure: [`c6f71a2c`](https://github.com/ripper7375/trading-alerts-saas-public/commit/c6f71a2c1b300ff702e434ec8cafe0c3469f09f8), `docs: record intraday FX branch publication`.
- Normal feature-branch push succeeded. The publication stage verified the remote feature SHA and ahead/behind 0/0; main was unchanged at that stage. No PR was created by Codex.
- Davin subsequently created/merged PR #480. Local Git records merge `afc25efb`, and ancestry checks against current main confirm both published commits are included.

The automatic hooks would stash dirty work or regenerate shared clients. Equivalent checks were run manually, including `lint-staged --no-stash --no-hide-partially-staged`; duplicate hooks were disabled only for the publication commands. No permanent hook configuration, broad reset/restore/clean, unrelated file staging or credential publication occurred.

### 7.2 Activation checklist

1. Configure `CURRENCYBEACON_API_KEY` in the actual Next server environment: Development, Preview or Production as appropriate. Local `.env.local` does not configure a deployed Vercel environment.
2. Configure the deployed money-service and every other process publishing to the same FX cache. Local development uses `money-service/.env`; keep keys server-only.
3. Restart local processes or redeploy/restart the affected deployed services after an environment change. A local development restart has no effect on a Vercel deployment.
4. Use the same Redis database for the services where shared snapshots are required. Verify the v2 key and expiry in an authorized operational check.
5. Let existing fallback cache expire, potentially up to one hour. On the next eligible request, a successful configured primary fetch publishes CurrencyBeacon. An immediate switch additionally requires refreshing both the specific shared FX record and warm process caches.
6. Check the target environment's `/api/fx/rates` and attribution for `provider: "currencybeacon"`. If fallback persists, inspect environment scope and unavailable/invalid-primary warnings without logging secrets.

These are operating requirements, not a claim that this documentation task performed environment changes or cache invalidation.

### 7.3 Production evidence and its boundary

The later annual-check report records public production configuration and FX requests returning HTTP 200. The provider was CurrencyBeacon and its timestamp matched Davin's landing-page screenshot. This establishes use of the new provider on the public frontend at that observation time.

It does not establish the protected preview's exact fallback cause, the deployed money-service version, every production Redis writer, a deployment identifier, hosted checkout success or an actual charged amount. No deployment was performed by the Codex implementation/publication/clarification scopes. Remote GitHub workflow results were not claimed as verified.

---

## 8. Not done / open

| Item                                    | Completion boundary / next ownership                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dLocal amount/currency payload          | Identified in the original investigation and excluded from this FX change. A separately authorized correction and payment validation remain necessary before relying on local charging correctness                         |
| Signed-in checkout and actual payments  | Local sign-in boundary observed; component/API tests passed. No authenticated end-to-end checkout or provider charge was exercised                                                                                         |
| Live money-service and production Redis | Parser/cache parity tested with deterministic stores; a live money-service boot, production cache write and current deployed sharing were not independently verified                                                       |
| Protected preview                       | Requests redirected to Vercel login. Its environment, logs and cache were not inspected; the earlier exact fallback reason remains unconfirmed                                                                             |
| CurrencyBeacon data-use entitlement     | Recorded terms contain conflicting commercial/app-reproduction and product/redistribution provisions. Attribution and eight-hour retention were implemented; no provider permission/contractual determination was obtained |
| Free quota and concurrent writers       | Research recorded hourly/5,000-call free terms. One shared hourly fetch is approximately 744 calls in a 31-day month, but retries, previews and cold processes add calls; no distributed quota lock or hard ceiling        |
| Daily fallback                          | Frankfurter maintains availability but cannot track intraday movements; fixed references are final estimates                                                                                                               |
| Production build / generators           | Not run by this feature's recorded gates; root prebuild mutates shared generated resources, which were outside scope                                                                                                       |
| Repository document issues              | Historical checker totals were 29, then 30 after a relocation; baseline at manifest creation is 29. These unrelated link/frontmatter issues are preserved                                                                  |

Existing browser warnings concerning legacy middleware, iframe attributes, checkout render-time navigation, old Browserslist data and Windows Watchpack scanning were observed and left outside scope. Unrelated mobile deletions, relocated folders and `next-env.d.ts` edits were preserved.

---

## 9. Files

This inventory describes the implementation/publication scope, not new runtime changes made while creating the manifest.

**Root FX and locale:** `lib/fx/{rate-contract,rate-providers,usd-rates,shared-rate-store,use-display-usd-rates}.ts`, `lib/country-config.ts`, `lib/context/locale-context.tsx`.

**Routes and conversion:** `app/api/fx/rates/route.ts`, `app/api/payments/dlocal/convert/route.ts`, `lib/dlocal/currency-converter.service.ts`.

**Pages and components:** `app/checkout/page.tsx`, `app/(marketing)/about/page.tsx`, `components/landing/landing-pricing.tsx`, `components/pricing/tier-comparison.tsx`, `components/payments/{PriceDisplay,fx-rate-attribution}.tsx`.

**Money-service:** `src/fx/{rate-providers,usd-rates,usd-fallback-rates}.ts` and provider/cache specs; `src/dlocal/currency-converter.service.spec.ts` fixture adaptation.

**Dictionaries:** attribution entries in `ar`, `de`, `en-GB`, `en-US`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `pt-BR`, `pt`, `th`, `tr`, `ur`, `vi`, `zh-TW`, `zh` under `lib/i18n/dictionaries/`.

**Tests and type coverage:** FX, converter and component suites listed in §6; the two real-reader publication suites; `__tests__/tsconfig.fx.json`.

**Environment examples:** root `.env.example` and `money-service/.env.example` contain the key name; real environment files and credentials are excluded.

**Guides and records:** [setup guide](../docs/fx/intraday-subscription-prices.md), implementation/publication task records and handoffs, the five consolidated reports below, and this manifest. The implementation commit contains 55 final source/test/example files plus four documents. The documentation closure is a separate commit.

The current manifest task adds only this file, its [task record](../docs/codex/tasks/2026-10-13-intraday-completion-manifest.md) and [closeout handoff](../docs/handoffs/2026-10-13-intraday-completion-manifest-codex.md).

---

## 10. Follow-up: preview provider attribution and restart remedy

Davin's preview screenshots showed “Indicative exchange rates: Frankfurter” while About described CurrencyBeacon with Frankfurter fallback. The source review confirmed both statements could be correct: About described the hierarchy, and the attribution named the provider supplying the current cached table.

Possible causes were a missing deployment key, a failed/rejected primary request or a valid cached Frankfurter snapshot. The protected preview redirected the read-only check to Vercel login, so the exact cause was not established. Both local environment files existed, were ignored/untracked, and did not travel with the Git push.

After Advisor advice to restart local development, the actual CurrencyBeacon function succeeded using the local key in 934 ms and returned all 15 currencies. Restarting clears process memory, but the restarted process can still read an unexpired Frankfurter table from Redis before fetching the primary. All cache publishers need their deployed keys; a writer missing its key can publish fallback again.

The remedy was therefore environment configuration in the actual target deployment, restart/redeploy, cache expiry and provider verification—not an unproven change to the provider-selection code. The later public production CurrencyBeacon observation supersedes a broad claim that the primary was inactive everywhere, while leaving the protected preview diagnosis unconfirmed.

---

## 11. Follow-up: annual pricing based on ten months

Davin's production screenshot displayed GBP 15.13/month and GBP 151.26/year, with an annotation suggesting GBP 151.13. Public configuration confirmed USD 20 monthly and USD 200 annual, exactly ten months. The actual shared formatter reproduced both displayed amounts.

Conversion uses the full shared rate precision and rounds each final price independently. An illustrative unrounded monthly equivalent of GBP 15.126 displays as GBP 15.13; ten unrounded equivalents total GBP 151.26. Multiplying the already-rounded monthly label gives GBP 151.30. GBP 151.13 does not follow the ten-month calculation.

The savings label uses:

```text
round((1 - annualUsd / (monthlyUsd * 12)) * 100)
= round((1 - 200 / 240) * 100)
= round(16.6667%)
= 17%
```

Thus “Save 17%” is the rounded saving for paying ten months instead of twelve. It is not an exact 17% reduction applied to the displayed monthly figure. Annual pricing remains independently configurable, and the savings calculation follows those values.

Five formatter/arithmetic assertions passed with exit 0. Separate review agreed that the screenshot's annual value and rounded percentage were correct. **No annual calculation fix was needed.** No USD price, FX source, discount or payment rule was changed for this follow-up.

---

## 12. Source records and final completion boundary

### 12.1 All source reports in this folder

| Report                                                                                  | Contribution                                                                                                      |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [Subscription price trace](2026-10-13-subscription-price-trace-codex.md)                | Original calculations, daily-feed diagnosis, Yahoo evaluation, free-provider shortlist and excluded dLocal defect |
| [Intraday implementation](2026-10-13-intraday-subscription-prices-codex.md)             | Provider/cache/UI scope, implementation tests, review fixes, live/local evidence and limits                       |
| [Preview provider clarification](2026-10-13-preview-fx-provider-clarification-codex.md) | Actual-provider attribution, local/deployed environment distinction and protected-preview limitation              |
| [Fallback remedy](2026-10-13-fx-fallback-remedy-codex.md)                               | Actual primary request success, Redis restart caveat and concrete activation steps                                |
| [Annual ten-month rounding check](2026-10-13-annual-ten-month-rounding-check-codex.md)  | Production CurrencyBeacon observation, USD 20/200 ratio, correct GBP rounding and rounded 17% saving              |

### 12.2 Supporting publication and operating records

- [Implementation task](../docs/codex/tasks/2026-10-13-intraday-subscription-prices.md).
- [Publication task](../docs/codex/tasks/2026-10-13-intraday-subscription-prices-publish.md).
- [Publication handoff](../docs/handoffs/2026-10-13-intraday-subscription-prices-codex-publish.md).
- [FX setup and maintenance guide](../docs/fx/intraday-subscription-prices.md).
- [PR #480](https://github.com/ripper7375/trading-alerts-saas-public/pull/480) and the publication commits in §7.1.
- [Manifest task](../docs/codex/tasks/2026-10-13-intraday-completion-manifest.md) and [closeout handoff](../docs/handoffs/2026-10-13-intraday-completion-manifest-codex.md).

### 12.3 Manifest verification

This is a documentation-only consolidation. Its verification covers factual review, current local Git ancestry, local links/frontmatter, formatting and whitespace. The detailed exits and results are recorded in the closeout handoff. Historical application test results are not presented as a new execution on current main.

| Manifest check                                             | Exit | Result                                                           |
| ---------------------------------------------------------- | ---- | ---------------------------------------------------------------- |
| Owned links, frontmatter, whitespace and numbered sections | 0    | Three documents, 18 local links and all thirteen sections passed |
| Targeted Prettier and scoped diff check                    | 0    | Owned documents passed; new-file whitespace checked explicitly   |
| Global operating-document checker                          | 1    | Same 29 existing baseline issues; none attributed to this task   |

Separate source and structure reviews completed. Final draft review attempts were unavailable because the selected model was at capacity; the integrator checked the draft against those completed reviews and the source records. No separate fresh-session sign-off was required for this documentation task.

**Completion:** the requested intraday provider, cache/refresh propagation, attribution and publication work is complete, with main integration and a recorded public production CurrencyBeacon observation. The annual-price concern is resolved. The explicitly listed deployment/payment/licensing limitations remain separate work; this manifest does not close them by implication.
