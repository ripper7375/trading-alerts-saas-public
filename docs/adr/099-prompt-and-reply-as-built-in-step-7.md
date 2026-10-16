# ADR-099: The prompt and the reply, as built in step 7

- **Status:** Settled for what is built and proved offline. Decisions D1 to D25 of the step 7 plan were approved by Davin on 2026-10-14 ("as recommended"); the readings of each part were put to him in that part's hand-off, and those he answered are in `current-state.md` (the contracts of part 1 as built; the readings of part 2; the behaviour of Panel A of part 9 on 2026-10-16). The rest stand unless he objects. Written down in part 10, 2026-10-16. **NOT part of this approval, and still open:** which two models launch (D1), the Pro allowance (D4), the provisioning of the key and the spend cap (D5), the archive (D17), the live-run budget (D25), the live behaviour of any model, the 17 languages of the wording lists, the invalidation lines, the `chat.*` texts and the Free recording (all my drafts, Appendix D), and every number of cost and time (a stand-in run measures none).
- **Date:** 2026-10-16
- **Section:** 5 · Prompt & AI reply (with 7.3 to 7.7)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.1 to §5.15, §7.3 to §7.7; amends [ADR-047](047-one-day-of-ohlc-in-compact-form.md), [ADR-048](048-context-caps-and-cut-order.md), [ADR-050](050-metering-from-actual-cost.md), [ADR-052](052-report-1-as-structured-json.md), [ADR-053](053-number-check-on-every-reply.md), [ADR-054](054-replies-shown-after-their-checks.md), [ADR-055](055-models-at-launch.md), [ADR-056](056-wording-guide-in-16-languages.md), [ADR-057](057-follow-ups-and-chat-history.md), [ADR-072](072-free-tier.md), [ADR-073](073-pro-quota-method.md), [ADR-075](075-one-trace-per-answer.md), [ADR-076](076-retention.md), [ADR-078](078-degraded-modes.md), [ADR-079](079-golden-scenarios.md) and [ADR-098](098-intake-routing-and-knowledge-service.md) D5
- **Plan and hand-offs:** `docs/handoffs/2026-10-14-step7-plan.md`; `2026-10-14-step7-part1.md` to `2026-10-16-step7-part10.md`

## Context

Chapter 5 of the architecture says what the reply path is; the plan (ten parts) found eighteen places where the chapter, the roadmap or the order did not match the repository (S7-F1 to S7-F18) and asked for twenty-five decisions. The path is now built, offline: a fixture model stands in for every model, a throwaway PostgreSQL 18.1 stood in for the ledger and the tables, and nothing is switched on (`REPLY_ENABLED` is set nowhere). This record says what was decided, what was read two ways and how, and where the code departs from a sentence of the architecture.

## Decision

### D1. Six candidates, no launch pair (⚠ open until S1 and S2) (refines ADR-055)

The order and the roadmap named Gemini 2.5 Flash, the picker and §5.6 named Gemini 3.6 Flash, ADR-055 named none. **`config/ai-models.ts` is the registry and holds six candidates, every row an unverified placeholder on the safe side** (no JSON-schema mode, no caching, no vision, no price, no language, a window at the floor), and a checker that runs when the module loads refuses a damaged table (`lib/reply/gateway/registry.ts`). A model is `passed` only with a recorded LIVE evaluation run for the current fingerprint (D25, below); only passed models reach the picker and the fallback; the launch pair is one default and one fallback of **another vendor**, both passed. The pair is named after runbook S1 (what OpenRouter serves, at what price, with which providers) and S2 (the evaluation). `REPLY_DISABLED_MODELS` switches a model off with no code change.

### D2. A unit is one micro-dollar (⚠ built as ordered) (refines ADR-073, ADR-050)

One unit is one micro-dollar of the gateway's reported cost, always a whole number: $1.00 is 1,000,000 units. A period is a UTC calendar month. The stored fact is the integer cost; the interface shows a share and "about N analyses left" computed from the MEASURED cost of the chosen model (or "not measured yet"), never a raw number of units or tokens. A call whose cost the provider did not report is worked out from the registry's dated price and flagged `cost_estimated`.

### D3. The ledger is two PostgreSQL tables and one invariant (⚠ built as ordered) (refines ADR-050, ADR-074)

`ai_quota_periods` (one row per trader per month: `limit`, `used`, `reserved`, and the database CHECK `used + reserved <= limit`) and `ai_usage_reservations` (one row per request, keyed by the request id: `RESERVED`, `SETTLED`, `RELEASED`, `EXPIRED`, a composite foreign key so a reservation can never point at another trader's period, and a transition trigger). Reserve is ONE statement that takes the hold only if it fits; settle is ONE idempotent statement that charges `LEAST(actual, what is left)` and gives the hold back (the cost the balance could not take is the business's, recorded as `absorbedUnits`); release gives it back; a reaper expires reservations past their deadline, one statement per period. The request id is the key, so a double click or a retry cannot charge twice. The Redis counter of `lib/rate-limit.ts` is not used (it counts tokens on call, has no refund or read-only call, and fails open). The real server found two defects in the SQL that no model could show; the three rules for any new ledger SQL are in the part 6 hand-off and `environment-gotchas.md`.

### D4. The Pro allowance is set from a measurement, and no token number is published until then (⚠ open until S3 and S4) (ADR-073)

`PRO_MONTHLY_UNITS` is unset; the quota port refuses every request while it is (fail closed). The allowance is the Pro price times the share Davin allows for model spend, divided by the cost of a unit, in exact integers (`scripts/reply/measure-units.js --price --share`). The 500,000 tokens the pricing page prints today are against ADR-073 and are changed in S4. A month's limit rises at once and never falls mid-month.

### D5. One key, the existing HMAC key, a spend cap (⚠ open: nothing is provisioned) (ADR-077)

`OPENROUTER_API_KEY` (`INTAKE_UNDERSTAND_API_KEY` kept as an alias) appears only in the `Authorization` header of `lib/reply/gateway/openrouter.ts`, the one file that calls the network (a test reads every file for it); every request carries `provider.data_collection: "deny"`. The user hash of the trace reuses `ENGINE4_AUDIT_HMAC_KEY` and its version, so one deletion rule covers every audit table. The ledger uses no key (it is the balance, deleted with the account). A monthly spend cap on the OpenRouter account is set before S1.

### D6. The last price is the close of the last closed M5 bar, labelled with the bar (amends §5.5, ADR-047)

§5.5's example line (`LAST PRICE 4377.99 at 20:55:05 (forming, not a close)`) has no stored source (ADR-011 keeps the forming bar out of sensors and OHLC, and `CurrentCycleResponse` carries no forming price). The prompt says `LAST PRICE 4377.99 · close of the last closed M5 bar (opened 18 Sep 20:50 UTC)`, from the packet (step 6's decision D8), or `LAST PRICE unavailable`. §5.5 carries the note.

### D7. The budget is `min(19,600, floor(model budget / (1 + margin)))`; the estimator is deterministic; no dependency (amends §5.4, refines ADR-048)

§5.4's ten caps add up to exactly 19,600, so the cut order could never fire as written. It is read as **the order in which components shrink when the assembled prompt exceeds the budget of the chosen model**: chat history first (older turns become a summary), then knowledge chunks, then the OHLC (summary mode, about 500), then the readings' details; the board, the synthesis line, the warnings, the profile, the events and the question are never cut (a component that cannot be cut and is over its cap is kept and listed). The estimator is deterministic (digits, letters, CJK and other characters with a per-model calibration and a safety margin), adds no tokenizer library (a `package.json` change under `security-overrides.md`), and real counts from the gateway's `usage` go to the trace. The window is 24 hours to the last closed bar (288 M5 and 96 M15).

### D8. `/api/intake` and `/api/intake/instant` are dev-only tools (⚠ built as ordered) (amends ADR-098 D5)

They call the Understand model with no hold. `isIntakeEnabled` is false in any production build (`NODE_ENV=production`, a Vercel preview included) whatever `INTAKE_ENABLED` says, and the throwaway `/api/test/ai-metering` route is deleted. The one metered front door is `POST /api/chat/message`, which holds the worst case of the whole request, the Understand call included, before it is made.

### D9. Which intent gets which shape (refines ADR-052)

Report 1: DIRECTION, ENTRY_TIMING, INSTANT_M5_INSPECT, INSTANT_M15_INSPECT. `answer.v1` (a short answer: `locale`, `text`, `cites`, `action` which is `null` or `OPEN_TRADE_SETUP`): EXIT_TARGETS, RISK_SIZING (never a size: it points to Report 2), EXPLAIN, NEWS. REPORT_2: no model, the Trade Setup action. STALE answers EXPLAIN and NEWS only (the calendar has its own status). A chart is sent for the two Panel C intents and the first Direction or Entry question of a (thread, cycle), only when the data status allows it, the tier allows it and the model can read an image, and only if its stamp is this cycle's (`chartMatchesCycle`, first called here).

### D10. `report1.v1` and the six sections (approved as built, 2026-10-14) (refines ADR-052)

The model writes five keys: `headline`, `zones[]`, `rationale[]`, `watch[]`, `risks[]`; a line is `{ text, cites[] }`, and a `{value id}` is the only way a number reaches the trader. The server composes the six sections: summary (the headline plus the **direction line copied from the synthesis reading**), alignment (the engines' channel lines plus `rationale`), levels (the engines alone), zones (the stored zones the model picked, field for field), what would change (`watch`), risks and news (`risks` plus the calendar block). The schema has **no direction field**; a golden test per scenario holds the structured direction equal to the reading.

### D11. One regeneration, shared (refines ADR-053)

§5.8 and §5.9 each say "once". It is one extra model call in all, spent on whichever goes wrong first: a reply that is not the schema (a retry) or a number or phrase that fails its check. After it a number still wrong is shown as "not verified" in the reader's language, and a phrase or a schema still wrong gives the board-only fixed answer. The ledger's reservation covers the answer twice and no more.

### D12. The "always" rows of §5.9 are structural where a language-neutral rule exists (refines ADR-056)

The `{Zn.invalidation}` line of every chosen zone (the composer adds the language's line when the model's `watch` lacks it), the stamp, the sample size and the stand-aside are enforced as structure; the conditional phrasing is measured, not enforced (a lexical test across 17 languages would fail good replies). The five "never" rows are checked lexically with a script-aware matcher over 17 language files (2,620 phrases for the 19 locales) and a three-tier direction guard. Every list is a draft until a native reader signs it.

### D13. Numbers the check exempts (refines ADR-053)

Identifiers and timeframes; small counts and ordinals not next to `$`, `%`, `:` or a decimal point; the dates of the stamp. A price or distance matches within $0.05, a percentage, a ratio and a count exactly, a time to the minute. The value dictionary (`checks/value-dictionary.ts`) is one source for three users: the prompt shows ids beside values, the resolver fills placeholders, and the check judges the literals a model typed anyway.

### D14. The history summary is built by code (refines ADR-057)

The last 10 messages are kept; older turns are a running summary of at most 300 tokens built by code from the stored reports (never from a trader's words), so there is no model call, nothing to number-check and the result is reproducible.

### D15. Thread titles are deterministic (refines ADR-057)

`XAUUSD · M15 · LONG · 18 SEP 20:55` (symbol, chart for an instant prompt, bias, slot; the intent word when there is no bias); the trader can rename, and a rename is never replaced by a derived title.

### D16. What the trace holds (⚠ legal record) (refines ADR-075)

One row per answer, written once at the end, in seven strict groups (request, data, knowledge, model, checks, risk, time) with no field that could hold the question; "missed knowledge" is the intent, the sensors, the locale, a chunk count and the packet fingerprint. Twelve projected columns are checked by the database against their groups. The user id is never inside a group or a reply (so an account deletion leaves a keyed hash and no personal data). Engine 4's risk group is attached later through `attachRisk`, which takes Report 2 as the exact text Engine 4 serializes.

### D17. An unarchived trace cannot be deleted (⚠ open: no archive exists) (refines ADR-076)

ADR-076 keeps audit rows 7 years and the architecture keeps `request_traces` 90 days in PostgreSQL "then archived"; no code writes an archive. **A database trigger refuses `DELETE` of a trace that has not been archived and refuses `TRUNCATE`**, a pure planner says what is due (90 days old and not archived: due for the archive; archived and 90 days old: the live copy may go), and no job is scheduled. Until the archive exists traces stay in PostgreSQL (runbook S7).

### D18. Chat retention (refines ADR-076)

A message lives 12 months from its own time (`expires_at`); a trader's delete removes the thread at once and says so plainly, naming what survives (the audit record of each request, which holds no part of the trader's questions); an account deletion removes everything.

### D19. The Free recording is a golden scenario in 19 locales, shown only when approved AND live (refines ADR-072)

Scenario M01 (the real 18 Sep cycle, an M5 instant prompt) is a member of the golden set, so the recording is what the evaluation's language runs produce. `config/reply/demo/<locale>.json` is the recorded run's replies played through the real pipeline again. **`loadDemo` returns a recording to a trader only when `config/reply/demo/approval.json` is APPROVED and the files come from a LIVE run**; a stand-in recording is never shown, approved or not. Today the 19 files come from the stand-in run and Free sees "not available yet".

### D20. The fixed answer is made of ids, statuses and state codes (refines ADR-055)

The board's `summary_line` is one free-text English line each sensor writes and the 32 state codes have no translations outside the playbooks, so the fixed answer (both models down, a second wording failure, a failed schema, the deadline) carries the direction word, the rule id, the statuses, the state codes, the levels and the stamp, and no sensor sentence. Part 5 added to part 1's result contract the fixed reasons `MARKET_CLOSED` and `NO_SYNTHESIS` and a `notes` field (`CHART_OTHER_CYCLE`, `CHART_UNAVAILABLE`), so a reply can say a chart was dropped or that no synthesis exists, in codes the interface turns into words.

### D21. Staging is a flag plus an allow-list (⚠ built as ordered)

`REPLY_ENABLED` exactly `true` turns the routes on (404 for everybody otherwise); `REPLY_ALLOWED_USER_IDS` (comma-separated) makes every trader not on it a Free one for the gate, an existing empty list lets nobody in. The chart badges are a separate global switch (`INTAKE_INSTANT_PROMPTS_ENABLED`) and are not part of the allow-list.

### D22. One entitlement table (refines ADR-074)

`config/entitlements.ts` and its readers; the gate, the quota port and the chat routes read it. Engine 4's routes and the chart download still decide in their own way (part 6, reading 11).

### D23. A request has a deadline of 55 seconds (the plan's own figure)

Per-call timeouts of 25 s (primary) and 20 s (fallback), `maxDuration = 60` on the message route; past the deadline the answer is the board-only fixed answer and the reservation is settled for what was spent. **The Vercel plan's limit was not checked.**

### D24. The stream is stage events and one whole result (refines ADR-054)

NDJSON: `stage` events (GATE, UNDERSTAND, DATA, CONTEXT, MODEL, CHECKS, each started then done with its milliseconds, or skipped) and exactly one terminal event (`result`, `refusal` or `error`). The reply is shown whole after its checks, never token by token; the roadmap's "Report 1 stream" is corrected.

### D25. A live run is gated by a budget the owner sets (⚠ open) (refines ADR-079)

`scripts/reply/eval-run.js --live` refuses to start without `--cap-usd`, stops after the call that reaches it and writes nothing then, and never edits the registry. A pass is 680 cells, 634 of them written by the model under test; the plan's two passes are about 1,270 calls per model.

## The evaluation suite (part 10)

**What is run.** `config/reply/golden/scenarios.v1.json` holds **34 golden scenarios** in five families: the 16 stored cycles, each for both trader types, FRESH, in all 19 locales (CYCLE); the DELAYED overlay (DATA); the ten rows of §7.6, row 1 and row 6 with two scenarios each and each row quoted word for word from the document by a test (DEGRADED); a wrong price, a listed phrase in all 19 locales, malformed JSON and a zone id that does not exist (PLANTED); and the Free recording (DEMO). Each carries what must be true afterwards, written from the architecture before anything is run, and is approved through a generated `review.md` and an `approval.json` that only a person writes (`scripts/reply/golden-tool.js`). (A count of "about 24" in §7.7 is read as a floor; the extra ten are the second trader type's cells, the two split rows, the DELAYED overlay and the demo.)

**How it is run.** A cell (a scenario, a trader type, a locale, a pass) goes through the REAL orchestrator over the orchestrator tests' world: the real intake path over the stored golden cycle, gate, answer gate, assembler, checks, composer, ledger over its model, and the thread, message and trace stores; the answer model is the fixture model with scripted replies (the STAND-IN) or a real port (a LIVE run). The day of bars is the test world's seeded walk **anchored so that its last closed bar closes at the cycle's own last price** (otherwise the prompt would show a market that contradicts itself). `judgeReplies` (pure) finds what the checks find in the recorded replies by the same sequence the answer step follows, and the harness throws when it and the orchestrator disagree.

**The bars (§5.10), as arithmetic** (`lib/reply/eval/scoring.ts`): golden scenarios (direction equals the synthesis reading, zone ids valid, stand-aside kept), schema (valid after at most one retry), numbers (no unverified number shown), wording (no listed phrase shown), all 19 locales within 5 points of English (a language's score is the share of its scored runs that pass every check without a retry, a regeneration or a flag, in basis points; only scenarios written by the model and run in all 19 locales are scored), cost and time recorded, and one row of the suite's own: every cell meets the expectation its scenario was approved with.

**The fingerprint** names the configuration a run is evidence about: model slug and the host that served it, prompt version and hash, wording-lists hash, caps hash and the hash of the scenarios with the digests of the worlds they run on. Any change makes the run stale.

**The gate** (`__tests__/lib/reply/eval-gate.test.ts`, `evalGate`): a `passed` model needs a LIVE run for the current fingerprint whose bars all hold, whose `languages_ok` lists all 19 locales and whose model is the one named. It fails, each shown by a deliberate defect, on a `passed` model with no run, a run that is missing, a run that is damaged, a stand-in run offered as evidence, a run of another model, a stale fingerprint (each of its parts), a language 6 points under English, a direction that is not the synthesis reading's, an unverified number or a listed phrase shown, a schema that stayed wrong and a cost that was not recorded.

**The STAND-IN run** (`config/reply/eval-runs/stand-in.json`) is committed first, labelled STAND-IN word for word on its first line and on every table. It shows the mechanism end to end and **measures nothing about a model, a language or a price**: the replies are written by the test harness (the sentences in 17 languages are my drafts), the costs are under a fictional price, the time is zero. CI recomputes it byte for byte with no paid call (`eval-run.js --check`), replays its recorded replies through the checks (`--replay`), and proves §5.14 items 5, 6, 7 and 8 by named tests (`__tests__/lib/reply/golden/acceptance-5-14.test.ts`).

## What was read two ways, and how

- **"Within 5 points"** is measured per locale against `en-US` (`en-GB` is a locale of the run, not the baseline), and a locale with no scored run fails rather than passing for want of data.
- **"The 16 stored cycles for both trader types with the five data-status overlays"** is read as the 16 cycles with both trader types FRESH, plus DELAYED as its own scenario, plus STALE, MARKET_CLOSED and RETUNING as rows 1, 2 and 5 of §7.6: five statuses, one per row of the set, without a 16 x 2 x 5 matrix nobody could read. The full 16 x 2 x 4 grid (128 Report 1s) is run by the §5.14 item 7 test against the STORED readings.
- **Rows 9 and 10 of §7.6 are decided inside Engine 4** (the blackout, the offer check). Their scenarios hold the reply path's half (the calendar block says it is late and shows its age; the chat only opens the modal); the other half is Engine 4's approved worked examples 08 and 09.
- **Report 2 is never judged by the evaluation.** It is a fixed template over one validated setup (ADR-097) and no model writes a number in it.

## What this does not settle

Which models launch; what a message costs; whether a model is good in Urdu; whether the drafts of 17 languages read as they should; whether provider caching engages; whether the Vercel plan allows the deadline; the archive. They are runbook S1 to S5 and S7, `waiting-on.md` and Appendix D of the architecture.

## Consequences

- A model cannot join without a live run for the configuration that would be deployed, and a change to the prompt, the wording lists, the caps or the scenarios sends it back to be run again.
- Everything is off, and the cost of turning it on is a sequence of stages (the runbook) each of which needs a person; **rollback is a flag, not a revert of code or data**, but an environment variable on Vercel needs a redeploy to take effect, so "instant" means minutes.
- The stand-in recording cannot reach a trader; the Free tier shows "not available yet" until a live run is recorded, read and signed.
