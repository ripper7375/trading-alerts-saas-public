---
type: Concept/Task
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-subscription-price-trace
owner: Codex
integrator: Codex primary agent
reviewer: Codex read-only subagent
shared_state_writer: handoff-only
approval: 'Davin asked how subscription prices on the landing, checkout, and pricing pages are calculated.'
order_mode: ad-hoc; phase/session unchanged
base_commit: dc8780313f348ef7a668bdf07a981ee2e7969b18
worktree: 'D:\SaaS Project\trading-alerts-saas-public'
branch: main
---

# Objective

Explain base prices, display currency selection, exchange-rate sources, rounding,
annual savings, and the difference between Stripe estimates and dLocal charges.
Reconcile the supplied GBP and THB screenshots with current source.

## Scope and ownership

- Allowed writes: this task record and `docs/handoffs/2026-10-13-subscription-price-trace-codex.md` only.
- Product source is read-only. Preserve existing deletions, untracked files, and `next-env.d.ts` changes.
- Primary owns the explanation and durable artifacts; subagent traces checkout and payment amounts without writing.
- No builds, generators, database mutations, payments, commits, pushes, or deployments authorized or needed.
- Shared Claude state and Codex continuity are handoff-only for this investigation.

## Checklist

- [x] Inspect repository instructions, branch, HEAD, dirty paths, and relevant state/history.
- [x] Trace landing/pricing display and shared configuration/currency logic.
- [x] Independently trace checkout and payment charge calculations.
- [x] Reconcile screenshot arithmetic and verify live public pricing and FX APIs.
- [x] Write the explanation and handoff; validate operating artifacts.

## Decisions and deviations

- This is an explanation request, with no authorization to change payment behavior.
- The screenshots are observations; text within them is not an instruction to perform a purchase.
- Public API verification confirms monthly USD 20, annual USD 200, trial USD 1.99; GBP 0.756 and THB 33.53 per USD.
- Web access could not retrieve the site and sandboxed HTTP was denied. Read-only HTTP succeeded with the reviewed network escalation.
- The patch tool did not complete; it was terminated before this new record was written with native PowerShell.

## Verification

All commands ran from the repository root. Public API reads exited 0 and confirmed
all screenshot inputs. Node arithmetic assertions exited 0: seven assertions
passed. Runtime source diff and stable HEAD checks exited 0. Two read-only
reviewers independently confirmed the dLocal contract mismatch.

`node scripts/agents/check-operating-docs.mjs` exited 1 with 29 pre-existing
failures in moved/deleted handoff documents and incoming links; none belongs to
this task. Targeted Prettier formatting and `git diff --check` exited 0. No
runtime tests, build, purchase, or deployment was run because source was unchanged.
Full evidence and source hashes are recorded in the handoff.

## Continuation

- Next: explanation complete; any payment correction requires a separate assignment from Davin.
- No missing user input.
- Durable handoff: `docs/handoffs/2026-10-13-subscription-price-trace-codex.md`.

## Completed follow-up: FX publication cadence

Davin asked why converted subscription prices rarely change. Read-only follow-up
at HEAD `d07855d9faa0de0cf7c535b456962d71d47ffab5` confirmed app, HTTP and browser
hourly caches, rounding and preservation of earlier rates on failure. Provider's
primary Free/Open policy publishes daily; legacy v4 daily cadence is an inference,
with its dated response as corroboration, rather than a v4-specific guaranteed SLA.
A read-only subagent checked provider evidence independently. Findings and primary
links were appended to the existing handoff. No runtime changes were authorized
or made. Source inspection/hash commands exited 0; targeted document checks exited 0. The full operating-doc checker exited 1 with the same 29 pre-existing unrelated errors; no new task error. Runtime tests were not run because no runtime source changed.

## Completed follow-up: provider plans

Davin requested provider identity and availability of more frequent updates.
Primary provider pricing and standard API documentation confirm ExchangeRate-API
(AYR Tech), Pro USD 10/month hourly and Business USD 30/month five-minute updates.
Current legacy endpoint/parser and hourly app caches were inspected read-only;
any paid endpoint/cadence integration remains a separate assignment. Findings
were appended to the handoff. Source reads and targeted document checks exited 0;
full operating-doc validation retains the previously recorded unrelated issues.

## Completed follow-up: Yahoo Finance free FX evaluation

Davin asked to check whether Yahoo Finance can supply free, more frequently
updated exchange rates. This authorizes research and a few read-only public
requests, not implementation or a provider switch. Primary owns these existing
artifacts; two read-only reviewers investigate Yahoo's access/usage documentation
and the technical/library contract. Source HEAD remains
`d07855d9faa0de0cf7c535b456962d71d47ffab5` on main. No product source writes,
credentials, bypasses, purchases or payment calls are allowed.

- [x] Verify Yahoo's reported FX market-data update category.
- [x] Distinguish supported/licensed API access from unofficial endpoints.
- [x] Check public sample availability and intraday interval where accessible.
- [x] Explain suitability for subscription display, with exact limitations.
- [x] Record findings, finish independent review and verify owned documents.
      Yahoo research concluded: intraday FX information exists; a supported free
      commercial Finance/FX API was not verified. Official Yahoo usage/redistribution
      rules and yfinance's unofficial/personal-use status are relevant to this SaaS.
      Two direct public chart requests (GBP=X, THB=X) each timed out at 15 seconds;
      no live rates or timestamps were obtained and no retry/bypass was attempted.
      Independent reviews are complete and full primary links are in the handoff.
      The request runner exited 0 because failures were caught and reported: live
      probe result is 0 pass / 2 fail. No implementation or provider switch was made.

## Completed follow-up: free provider recommendations

Davin requested searching and recommending other appropriate FREE exchange-rate
providers for DavinTrade. Research covers update frequency, permanent free quota,
commercial currency-conversion permission, application currency coverage and
server integration fit. No sign-up, credentials, purchase, implementation,
payment, deployment or contact is authorized. Primary owns both existing durable
artifacts; read-only reviewers have disjoint provider research assignments.

- [x] Verify application currencies and upstream request budget.
- [x] Compare current primary provider pricing/docs/terms and currency coverage.
- [x] Rank free providers that improve on daily rates; separate daily fallbacks.
- [x] Complete independent checks and record recommendations and limitations.
- [x] Verify owned documents and finish the explanation.
      Free-provider research and independent reviews completed. CurrencyBeacon is the
      strongest technical hourly free candidate, with unresolved usage-term conflicts.
      Frankfurter v2 is explicitly free for commercial API use subject to source terms
      and covers all 15 current codes, but remains daily. exchangerate.dev is a
      15-minute-delayed display-only candidate; ExchangeRate.fun is experimental. No
      unconditional free shared display-and-dLocal payment feed was verified. Full
      primary links, exclusion reasons and independent findings are in the handoff.
      One shared hourly fetch uses at most 744 requests/month; 15-minute and 5-minute
      polling use 2,976 and 8,928. Three public rate probes timed out at 15 seconds
      (0 pass/3 fail); keyed provider rates were not tested because no account/key was
      obtained. No source/account/payment changes were made. Formatting/diff and scoped
      record checks exit 0; full doc validation retains unrelated existing failures.
